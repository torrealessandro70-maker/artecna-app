BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;
CREATE TEMP TABLE incassi_catalogo_prima (voce text NOT NULL) ON COMMIT DROP;
DO $pre$
DECLARE corpo text; terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
 SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR md5((SELECT prosrc FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure))<>'e653969ab1719f575d07038a3cbdd143'
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
    IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 OR right(corpo,length(terminale))<>terminale THEN
  RAISE EXCEPTION 'Baseline Hard Delete V3 divergente';
 END IF;
 EXECUTE 'INSERT INTO pg_temp.incassi_catalogo_prima '||left(corpo,length(corpo)-length(terminale))||'SELECT x FROM objects';
END
$pre$;


CREATE TABLE artecna_contabilita.incassi_lordi_clienti (
 id uuid PRIMARY KEY,
 acconto_id uuid NOT NULL REFERENCES public.acconti_cantiere(id) ON DELETE RESTRICT,
 cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,
 importo numeric(14,2) NOT NULL CHECK (importo>0),
 ricevuto_il date NOT NULL,
 metodo text NOT NULL CHECK (metodo IN ('bonifico','contanti','altro')),
 riferimento text NOT NULL CHECK (length(riferimento) BETWEEN 1 AND 200),
 fonte text NOT NULL CHECK (length(fonte) BETWEEN 1 AND 200),
 autore uuid NOT NULL,
 confermato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(cantiere_id,metodo,riferimento)
);
CREATE TABLE artecna_contabilita.quote_lorde_clienti (
 id uuid PRIMARY KEY,
 incasso_id uuid NOT NULL REFERENCES artecna_contabilita.incassi_lordi_clienti(id) ON DELETE RESTRICT,
 fattura_id uuid NOT NULL REFERENCES public.fatture_emesse(id) ON DELETE RESTRICT,
 importo numeric(14,2) NOT NULL CHECK (importo>0),
 autore uuid NOT NULL,
 attribuito_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoca_id uuid UNIQUE,
 revocato_at timestamptz,
 revocato_da uuid,
 CHECK (num_nonnulls(revoca_id,revocato_at,revocato_da) IN (0,3))
);
CREATE INDEX incassi_lordi_clienti_acconto ON artecna_contabilita.incassi_lordi_clienti(acconto_id);
CREATE INDEX quote_lorde_clienti_incasso ON artecna_contabilita.quote_lorde_clienti(incasso_id);
CREATE INDEX quote_lorde_clienti_fattura ON artecna_contabilita.quote_lorde_clienti(fattura_id);
ALTER TABLE artecna_contabilita.incassi_lordi_clienti ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.quote_lorde_clienti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.incassi_lordi_clienti,artecna_contabilita.quote_lorde_clienti FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.conferma_incasso_lordo_cliente(p_id uuid,p_acconto uuid,p_importo numeric,
 p_data date,p_metodo text,p_riferimento text,p_fonte text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; c uuid; r artecna_contabilita.incassi_lordi_clienti;
BEGIN
 SELECT cantiere_id INTO c FROM public.acconti_cantiere WHERE id=p_acconto FOR NO KEY UPDATE;
 u:=artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
 p_riferimento:=lower(btrim(p_riferimento));
 p_fonte:=btrim(p_fonte);
 IF p_id IS NULL OR p_importo IS NULL OR NOT (p_importo BETWEEN 0.01 AND 999999999999.99)
 OR p_importo<>round(p_importo,2) OR p_data IS NULL OR NOT isfinite(p_data)
 OR p_data>(now() AT TIME ZONE 'Europe/Rome')::date
 OR p_metodo IS NULL OR p_metodo NOT IN ('bonifico','contanti','altro')
 OR coalesce(length(p_riferimento),0) NOT BETWEEN 1 AND 200
 OR coalesce(length(p_fonte),0) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Dati del pagamento incompleti o non validi' USING ERRCODE='22023';
 END IF;
 INSERT INTO artecna_contabilita.incassi_lordi_clienti(id,acconto_id,cantiere_id,importo,ricevuto_il,metodo,riferimento,fonte,autore)
 VALUES(p_id,p_acconto,c,p_importo,p_data,p_metodo,p_riferimento,p_fonte,u)
 ON CONFLICT DO NOTHING RETURNING * INTO r;
 IF NOT FOUND THEN
  SELECT * INTO r FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_id;
  IF NOT FOUND OR (r.acconto_id,r.cantiere_id,r.importo,r.ricevuto_il,r.metodo,r.riferimento,r.fonte,r.autore)
   IS DISTINCT FROM (p_acconto,c,p_importo,p_data,p_metodo,p_riferimento,p_fonte,u) THEN
   RAISE EXCEPTION 'Pagamento gia registrato o richiesta discordante' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN to_jsonb(r);
END $$;

CREATE FUNCTION artecna_contabilita.totale_fattura_finanziario(f public.fatture_emesse)
RETURNS numeric LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT CASE WHEN f.totale BETWEEN 0.01 AND 999999999999.99 AND f.totale=round(f.totale,2)
  AND coalesce(f.bluenext_tipo,'')<>'TD04' AND coalesce(to_jsonb(f)->>'tipo_documento','')<>'TD04'
  AND NOT EXISTS(SELECT FROM artecna_contabilita.sdi_corrente s WHERE s.fattura_id=f.id AND s.tipo='TD04')
  THEN f.totale END
$$;

CREATE FUNCTION public.attribuisci_incasso_lordo_cliente(p_id uuid,p_incasso uuid,p_fattura uuid,p_importo numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; f public.fatture_emesse; i artecna_contabilita.incassi_lordi_clienti;
 q artecna_contabilita.quote_lorde_clienti; limite numeric;
BEGIN
 PERFORM artecna_contabilita.autorizza(p_fattura);
 SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_fattura FOR NO KEY UPDATE;
 u:=artecna_contabilita.autorizza(p_fattura);
 SELECT * INTO i FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_incasso FOR UPDATE;
 IF NOT FOUND OR i.cantiere_id IS DISTINCT FROM f.cantiere_id OR NOT EXISTS(
 SELECT FROM public.acconti_cantiere a WHERE a.id=i.acconto_id AND a.cantiere_id=i.cantiere_id)
 THEN RAISE EXCEPTION 'Pagamento non disponibile per la fattura' USING ERRCODE='42501'; END IF;
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(i.acconto_id);
 IF p_id IS NULL OR p_importo IS NULL OR NOT (p_importo BETWEEN 0.01 AND 999999999999.99)
 OR p_importo<>round(p_importo,2) THEN RAISE EXCEPTION 'Quota non valida' USING ERRCODE='22023'; END IF;
 SELECT * INTO q FROM artecna_contabilita.quote_lorde_clienti WHERE id=p_id;
 IF FOUND THEN
  IF (q.incasso_id,q.fattura_id,q.importo,q.autore) IS DISTINCT FROM (p_incasso,p_fattura,p_importo,u)
  THEN RAISE EXCEPTION 'Richiesta discordante' USING ERRCODE='23505'; END IF;
  RETURN to_jsonb(q);
 END IF;
 limite:=artecna_contabilita.totale_fattura_finanziario(f);
 IF limite IS NULL OR EXISTS(SELECT FROM artecna_contabilita.sdi_corrente s WHERE s.rettifica_id=f.id)
 OR (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.quote_lorde_clienti WHERE incasso_id=i.id AND revocato_at IS NULL)+p_importo>i.importo
 OR (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.quote_lorde_clienti WHERE fattura_id=f.id AND revocato_at IS NULL)+p_importo>limite
 THEN RAISE EXCEPTION 'Quota indisponibile o fattura rettificata da verificare' USING ERRCODE='23514'; END IF;
 INSERT INTO artecna_contabilita.quote_lorde_clienti(id,incasso_id,fattura_id,importo,autore)
 VALUES(p_id,p_incasso,p_fattura,p_importo,u) RETURNING * INTO q;
 RETURN to_jsonb(q);
END $$;

CREATE FUNCTION public.revoca_quota_lorda_cliente(p_id uuid,p_quota uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; q artecna_contabilita.quote_lorde_clienti; i artecna_contabilita.incassi_lordi_clienti;
BEGIN
 SELECT * INTO q FROM artecna_contabilita.quote_lorde_clienti WHERE id=p_quota;
 IF NOT FOUND OR p_id IS NULL THEN RAISE EXCEPTION 'Quota non disponibile' USING ERRCODE='42501'; END IF;
 PERFORM artecna_contabilita.autorizza(q.fattura_id);
 PERFORM FROM public.fatture_emesse WHERE id=q.fattura_id FOR NO KEY UPDATE;
 u:=artecna_contabilita.autorizza(q.fattura_id);
 SELECT * INTO STRICT i FROM artecna_contabilita.incassi_lordi_clienti WHERE id=q.incasso_id FOR UPDATE;
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(i.acconto_id);
 SELECT * INTO STRICT q FROM artecna_contabilita.quote_lorde_clienti WHERE id=p_quota FOR UPDATE;
 IF q.revoca_id=p_id AND q.revocato_da=u THEN RETURN to_jsonb(q); END IF;
 IF q.revocato_at IS NOT NULL THEN RAISE EXCEPTION 'Quota gia revocata' USING ERRCODE='23514'; END IF;
 UPDATE artecna_contabilita.quote_lorde_clienti SET revoca_id=p_id,revocato_at=clock_timestamp(),revocato_da=u
 WHERE id=q.id RETURNING * INTO q;
 RETURN to_jsonb(q);
END $$;

CREATE TABLE artecna_contabilita.imputazioni_acconti (
 richiesta_id uuid PRIMARY KEY,
 acconto_id uuid NOT NULL REFERENCES public.acconti_cantiere(id) ON DELETE RESTRICT,
 cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,
 revisione integer NOT NULL CHECK (revisione>0),
 destinazione text NOT NULL CHECK (destinazione IN ('contratto','economia','da_verificare')),
 importo_origine numeric,
 data_origine date,
 motivo text NOT NULL CHECK (length(motivo) BETWEEN 1 AND 500),
 autore uuid NOT NULL,
 registrata_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(acconto_id,revisione)
);
ALTER TABLE artecna_contabilita.imputazioni_acconti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.imputazioni_acconti FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.imputa_acconto_cliente(p_richiesta uuid,p_acconto uuid,p_revisione integer,p_destinazione text,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; a public.acconti_cantiere; i artecna_contabilita.imputazioni_acconti; rev integer;
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_acconto FOR NO KEY UPDATE;
 u:=artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
 p_motivo:=btrim(p_motivo);
 IF p_richiesta IS NULL OR p_revisione IS NULL OR p_revisione<0
 OR p_destinazione IS NULL OR p_destinazione NOT IN ('contratto','economia','da_verificare')
 OR coalesce(length(p_motivo),0) NOT BETWEEN 1 AND 500
 OR (p_destinazione='contratto' AND (a.importo IS NULL OR NOT(a.importo BETWEEN 0.01 AND 999999999999.99)
  OR a.importo<>round(a.importo,2))) THEN RAISE EXCEPTION 'Imputazione non valida' USING ERRCODE='22023'; END IF;
 SELECT * INTO i FROM artecna_contabilita.imputazioni_acconti WHERE richiesta_id=p_richiesta;
 IF FOUND THEN
  IF (i.acconto_id,i.revisione,i.destinazione,i.motivo,i.autore) IS DISTINCT FROM (p_acconto,p_revisione+1,p_destinazione,p_motivo,u)
  THEN RAISE EXCEPTION 'Richiesta discordante' USING ERRCODE='23505'; END IF;
  RETURN to_jsonb(i);
 END IF;
 SELECT coalesce(max(revisione),0) INTO rev FROM artecna_contabilita.imputazioni_acconti WHERE acconto_id=p_acconto;
 IF rev<>p_revisione THEN RAISE EXCEPTION 'Imputazione cambiata. Rileggere lo storico.' USING ERRCODE='40001'; END IF;
 INSERT INTO artecna_contabilita.imputazioni_acconti
 (richiesta_id,acconto_id,cantiere_id,revisione,destinazione,importo_origine,data_origine,motivo,autore)
 VALUES(p_richiesta,a.id,a.cantiere_id,rev+1,p_destinazione,a.importo,a.data_incasso,p_motivo,u)
 RETURNING * INTO i;
 RETURN to_jsonb(i);
END $$;

CREATE FUNCTION public.riepilogo_incassi_lordi_cantiere(p_cantiere uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); risultato jsonb;
BEGIN
 IF p_cantiere IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS NOT TRUE
 THEN RAISE EXCEPTION 'Cantiere non accessibile' USING ERRCODE='42501'; END IF;
 WITH acconti AS (
  SELECT a.importo,CASE WHEN (i.importo_origine,i.data_origine) IS NOT DISTINCT FROM (a.importo,a.data_incasso)
   THEN coalesce(i.destinazione,'da_verificare') ELSE 'da_verificare' END AS destinazione
  FROM public.acconti_cantiere a LEFT JOIN LATERAL (
   SELECT destinazione,importo_origine,data_origine FROM artecna_contabilita.imputazioni_acconti
   WHERE acconto_id=a.id ORDER BY revisione DESC LIMIT 1) i ON true
  WHERE a.cantiere_id=p_cantiere
 ), pagamenti AS (
  SELECT coalesce(sum(i.importo),0) AS lordo FROM artecna_contabilita.incassi_lordi_clienti i WHERE i.cantiere_id=p_cantiere
 ), quote AS (
  SELECT q.fattura_id,sum(q.importo) AS lordo FROM artecna_contabilita.quote_lorde_clienti q
  JOIN artecna_contabilita.incassi_lordi_clienti i ON i.id=q.incasso_id
  WHERE i.cantiere_id=p_cantiere AND q.revocato_at IS NULL GROUP BY q.fattura_id
 ), documenti AS (
  SELECT artecna_contabilita.totale_fattura_finanziario(f) t,coalesce(q.lordo,0) l,f.importo_incassato,
   EXISTS(SELECT FROM artecna_contabilita.sdi_corrente WHERE rettifica_id=f.id) AS rettificata,
   EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL) AS storico
  FROM public.fatture_emesse f LEFT JOIN quote q ON q.fattura_id=f.id WHERE f.cantiere_id=p_cantiere
 ), saldi AS (
  SELECT t,CASE WHEN t IS NOT NULL AND NOT rettificata AND l>0 AND l<=t
   AND (l=t OR importo_incassato=0 AND NOT storico) THEN t-l END AS residuo FROM documenti
 )
 SELECT jsonb_build_object(
  'acconti_netto',(SELECT coalesce(sum(importo),0) FROM acconti WHERE destinazione='contratto'),
  'acconti_da_verificare',(SELECT count(*) FROM acconti WHERE destinazione='da_verificare'),
  'acconti_economia',(SELECT count(*) FROM acconti WHERE destinazione='economia'),
  'fatture',(SELECT CASE WHEN count(*) FILTER(WHERE t IS NULL)=0 THEN coalesce(sum(t),0) END FROM saldi),
  'pagamenti',lordo,'attribuiti',(SELECT coalesce(sum(quote.lordo),0) FROM quote),
  'non_attribuiti',lordo-(SELECT coalesce(sum(quote.lordo),0) FROM quote),
  'residuo',(SELECT CASE WHEN count(*) FILTER(WHERE residuo IS NULL)=0 THEN coalesce(sum(residuo),0) END FROM saldi),
  'fatture_da_verificare',(SELECT count(*) FROM saldi WHERE residuo IS NULL)
 ) INTO risultato FROM pagamenti;
 RETURN risultato;
END $$;

REVOKE ALL ON FUNCTION public.imputa_acconto_cliente(uuid,uuid,integer,text,text),
 public.riepilogo_incassi_lordi_cantiere(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.imputa_acconto_cliente(uuid,uuid,integer,text,text),
 public.riepilogo_incassi_lordi_cantiere(uuid) TO authenticated;

CREATE FUNCTION public.leggi_incassi_lordi_cliente(p_id uuid,p_contesto text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE f public.fatture_emesse; c uuid; t numeric; attribuito numeric;
BEGIN
 IF p_contesto='acconto' THEN
  PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_id);
  SELECT cantiere_id INTO c FROM public.acconti_cantiere WHERE id=p_id;
 ELSIF p_contesto='fattura' THEN
  PERFORM artecna_contabilita.autorizza(p_id);
  SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_id;
  c:=f.cantiere_id;
  t:=artecna_contabilita.totale_fattura_finanziario(f);
  SELECT coalesce(sum(importo),0) INTO attribuito FROM artecna_contabilita.quote_lorde_clienti WHERE fattura_id=p_id AND revocato_at IS NULL;
 ELSE RAISE EXCEPTION 'Contesto non valido' USING ERRCODE='22023';
 END IF;
 RETURN jsonb_build_object('imputazione_effettiva',CASE WHEN p_contesto='acconto' THEN coalesce((
 SELECT CASE WHEN (i.importo_origine,i.data_origine) IS NOT DISTINCT FROM (a.importo,a.data_incasso)
  THEN i.destinazione END FROM artecna_contabilita.imputazioni_acconti i JOIN public.acconti_cantiere a ON a.id=i.acconto_id
 WHERE i.acconto_id=p_id ORDER BY i.revisione DESC LIMIT 1),'da_verificare') END,'imputazioni',CASE WHEN p_contesto='acconto' THEN coalesce((
 SELECT jsonb_agg(to_jsonb(i) ORDER BY i.revisione DESC) FROM artecna_contabilita.imputazioni_acconti i
 WHERE i.acconto_id=p_id),'[]') END,'totale',t,'attribuito',attribuito,'residuo',
 CASE WHEN t IS NOT NULL AND attribuito>0 AND attribuito<=t AND NOT EXISTS(
 SELECT FROM artecna_contabilita.sdi_corrente WHERE rettifica_id=p_id) AND
 (attribuito=t OR f.importo_incassato=0 AND NOT EXISTS(
 SELECT FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=p_id AND scollegato_at IS NULL))
 THEN t-attribuito END,
 'incassi',coalesce((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('disponibile',i.importo-coalesce((
 SELECT sum(q.importo) FROM artecna_contabilita.quote_lorde_clienti q WHERE q.incasso_id=i.id AND q.revocato_at IS NULL),0)) ORDER BY i.ricevuto_il,i.id)
 FROM artecna_contabilita.incassi_lordi_clienti i WHERE i.cantiere_id=c AND (p_contesto='fattura' OR i.acconto_id=p_id)),'[]'),
 'quote',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('numero_fattura',d.numero_fattura) ORDER BY q.attribuito_at,q.id)
 FROM artecna_contabilita.quote_lorde_clienti q JOIN public.fatture_emesse d ON d.id=q.fattura_id
 JOIN artecna_contabilita.incassi_lordi_clienti i ON i.id=q.incasso_id
 WHERE i.cantiere_id=c AND (p_contesto='fattura' AND q.fattura_id=p_id OR p_contesto='acconto' AND i.acconto_id=p_id)),'[]'));
END $$;

CREATE FUNCTION artecna_contabilita.proteggi_incassi_lordi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='acconti_cantiere' THEN
  IF OLD.cantiere_id IS DISTINCT FROM NEW.cantiere_id AND EXISTS(
   SELECT FROM artecna_contabilita.incassi_lordi_clienti WHERE acconto_id=OLD.id UNION ALL
   SELECT FROM artecna_contabilita.imputazioni_acconti WHERE acconto_id=OLD.id)
  THEN RAISE EXCEPTION 'Acconto con incasso lordo documentato' USING ERRCODE='23514'; END IF;
 ELSIF (OLD.cantiere_id,OLD.numero_fattura,OLD.cliente,OLD.totale) IS DISTINCT FROM
       (NEW.cantiere_id,NEW.numero_fattura,NEW.cliente,NEW.totale) AND EXISTS(
   SELECT FROM artecna_contabilita.quote_lorde_clienti WHERE fattura_id=OLD.id)
 THEN RAISE EXCEPTION 'Fattura con attribuzione finanziaria documentata' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acconti_incassi_lordi_guard BEFORE UPDATE ON public.acconti_cantiere
 FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_incassi_lordi();
CREATE TRIGGER fatture_incassi_lordi_guard BEFORE UPDATE ON public.fatture_emesse
 FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_incassi_lordi();

REVOKE ALL ON FUNCTION artecna_contabilita.totale_fattura_finanziario(public.fatture_emesse),
 artecna_contabilita.proteggi_incassi_lordi(),public.conferma_incasso_lordo_cliente(uuid,uuid,numeric,date,text,text,text),
 public.attribuisci_incasso_lordo_cliente(uuid,uuid,uuid,numeric),public.revoca_quota_lorda_cliente(uuid,uuid),
 public.leggi_incassi_lordi_cliente(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.conferma_incasso_lordo_cliente(uuid,uuid,numeric,date,text,text,text),
 public.attribuisci_incasso_lordo_cliente(uuid,uuid,uuid,numeric),public.revoca_quota_lorda_cliente(uuid,uuid),
 public.leggi_incassi_lordi_cliente(uuid,text) TO authenticated;

CREATE TEMP TABLE incassi_catalogo_dopo (voce text NOT NULL) ON COMMIT DROP;
DO $hd$
DECLARE corpo text; delta text[]; attesi text[];
DECLARE terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
 SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
 EXECUTE 'INSERT INTO pg_temp.incassi_catalogo_dopo '||left(corpo,length(corpo)-length(terminale))||'SELECT x FROM objects';
 SELECT array_agg(voce ORDER BY voce COLLATE "C") INTO delta
 FROM (SELECT voce FROM pg_temp.incassi_catalogo_dopo EXCEPT ALL SELECT voce FROM pg_temp.incassi_catalogo_prima) x;
 SELECT array_agg(voce ORDER BY voce COLLATE "C") INTO attesi FROM (
  SELECT 'r:artecna_contabilita.'||relname||':'||pg_get_userbyid(relowner)||':'||coalesce(relacl::text,'')||':'||relrowsecurity||':'||relforcerowsecurity AS voce
  FROM pg_class WHERE oid IN ('artecna_contabilita.incassi_lordi_clienti'::regclass,'artecna_contabilita.quote_lorde_clienti'::regclass,'artecna_contabilita.imputazioni_acconti'::regclass)
  UNION ALL SELECT 'c:'||attrelid::regclass::text||':'||attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull
  FROM pg_attribute WHERE attnum>0 AND NOT attisdropped AND attrelid IN ('artecna_contabilita.incassi_lordi_clienti'::regclass,'artecna_contabilita.quote_lorde_clienti'::regclass,'artecna_contabilita.imputazioni_acconti'::regclass)
  UNION ALL SELECT 'f:'||conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid,true)||':'||convalidated
  FROM pg_constraint WHERE conrelid IN ('artecna_contabilita.incassi_lordi_clienti'::regclass,'artecna_contabilita.quote_lorde_clienti'::regclass,'artecna_contabilita.imputazioni_acconti'::regclass)
  UNION ALL SELECT 't:'||tgrelid::regclass::text||':'||pg_get_triggerdef(oid,true)||':'||tgenabled::text
  FROM pg_trigger WHERE (tgrelid,tgname) IN (('public.acconti_cantiere'::regclass,'acconti_incassi_lordi_guard'),
   ('public.fatture_emesse'::regclass,'fatture_incassi_lordi_guard'))
  UNION ALL SELECT 'p:'||oid::regprocedure::text||':'||md5(prosrc)||':'||prosecdef||':'||coalesce(proconfig::text,'')||':'||pg_get_userbyid(proowner)||':'||coalesce(proacl::text,'')
  FROM pg_proc WHERE oid='artecna_contabilita.proteggi_incassi_lordi()'::regprocedure
 ) x;
 IF delta IS DISTINCT FROM attesi OR EXISTS(
 SELECT voce FROM pg_temp.incassi_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.incassi_catalogo_dopo
 ) THEN RAISE EXCEPTION 'Delta inatteso del catalogo Hard Delete V3'; END IF;
 UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
END
$hd$;
COMMIT;
