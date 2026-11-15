BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;
CREATE TEMP TABLE cro_catalogo_prima (voce text NOT NULL) ON COMMIT DROP;
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
 EXECUTE 'INSERT INTO pg_temp.cro_catalogo_prima '||left(corpo,length(corpo)-length(terminale))||'SELECT x FROM objects';
END
$pre$;



CREATE TABLE artecna_contabilita.rettifiche_riferimenti_incassi (
 richiesta_id uuid PRIMARY KEY,
 incasso_id uuid NOT NULL REFERENCES artecna_contabilita.incassi_lordi_clienti(id) ON DELETE RESTRICT,
 revisione integer NOT NULL CHECK(revisione>0),
 riferimento_precedente text NOT NULL,
 riferimento_nuovo text NOT NULL,
 motivo text NOT NULL,
 fonte text NOT NULL,
 autore uuid NOT NULL,
 rettificato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(incasso_id,revisione)
);
ALTER TABLE artecna_contabilita.rettifiche_riferimenti_incassi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.rettifiche_riferimenti_incassi FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rettifica_riferimento_incasso_lordo_cliente(p_richiesta uuid,p_incasso uuid,
 p_revisione integer,p_riferimento text,p_fonte text,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE i artecna_contabilita.incassi_lordi_clienti; h artecna_contabilita.rettifiche_riferimenti_incassi;
 u uuid; c uuid; rev integer;
BEGIN
 SELECT * INTO i FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_incasso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento non accessibile' USING ERRCODE='42501'; END IF;
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(i.acconto_id);
 SELECT cantiere_id INTO c FROM public.acconti_cantiere WHERE id=i.acconto_id FOR NO KEY UPDATE;
 u:=artecna_contabilita.autorizza_acconto_fiscale(i.acconto_id);
 IF c IS DISTINCT FROM i.cantiere_id THEN RAISE EXCEPTION 'Pagamento non accessibile' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('incassi-riferimenti:'||c::text,0));
 SELECT * INTO STRICT i FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_incasso FOR UPDATE;
 p_riferimento:=lower(btrim(p_riferimento)); p_fonte:=btrim(p_fonte); p_motivo:=btrim(p_motivo);
 IF i.metodo<>'bonifico' OR p_richiesta IS NULL OR p_revisione IS NULL OR p_revisione NOT BETWEEN 0 AND 2147483646
 OR coalesce(length(p_riferimento),0) NOT BETWEEN 1 AND 200
 OR coalesce(length(p_fonte),0) NOT BETWEEN 1 AND 200
 OR coalesce(length(p_motivo),0) NOT BETWEEN 1 AND 500
 THEN RAISE EXCEPTION 'Dati della rettifica non validi' USING ERRCODE='22023'; END IF;
 SELECT * INTO h FROM artecna_contabilita.rettifiche_riferimenti_incassi WHERE richiesta_id=p_richiesta;
 IF FOUND THEN
  IF (h.incasso_id,h.revisione,h.riferimento_nuovo,h.fonte,h.motivo,h.autore)
   IS DISTINCT FROM (p_incasso,p_revisione+1,p_riferimento,p_fonte,p_motivo,u)
  THEN RAISE EXCEPTION 'Richiesta duplicata con dati discordanti' USING ERRCODE='23505'; END IF;
  RETURN to_jsonb(h)||jsonb_build_object('richiesta_duplicata',true);
 END IF;
 SELECT coalesce(max(revisione),0) INTO rev
 FROM artecna_contabilita.rettifiche_riferimenti_incassi WHERE incasso_id=p_incasso;
 IF rev<>p_revisione THEN RAISE EXCEPTION 'Riferimento aggiornato in un altra sessione. Rileggi lo storico.' USING ERRCODE='40001'; END IF;
 IF i.riferimento=p_riferimento THEN RAISE EXCEPTION 'Il nuovo riferimento coincide con quello registrato' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT FROM artecna_contabilita.incassi_lordi_clienti x WHERE x.id<>i.id AND x.cantiere_id=c
  AND x.metodo=i.metodo AND (x.riferimento=p_riferimento OR EXISTS(
   SELECT FROM artecna_contabilita.rettifiche_riferimenti_incassi s WHERE s.incasso_id=x.id
   AND p_riferimento IN(s.riferimento_precedente,s.riferimento_nuovo))))
 THEN RAISE EXCEPTION 'Riferimento gia utilizzato da un altro pagamento' USING ERRCODE='23505'; END IF;
 INSERT INTO artecna_contabilita.rettifiche_riferimenti_incassi
 (richiesta_id,incasso_id,revisione,riferimento_precedente,riferimento_nuovo,motivo,fonte,autore)
 VALUES(p_richiesta,p_incasso,rev+1,i.riferimento,p_riferimento,p_motivo,p_fonte,u) RETURNING * INTO h;
 UPDATE artecna_contabilita.incassi_lordi_clienti SET riferimento=p_riferimento WHERE id=p_incasso;
 RETURN to_jsonb(h)||jsonb_build_object('richiesta_duplicata',false);
END $$;

CREATE FUNCTION public.leggi_rettifiche_incasso_lordo_cliente(p_acconto uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.revisione DESC)
 FROM artecna_contabilita.rettifiche_riferimenti_incassi h JOIN artecna_contabilita.incassi_lordi_clienti i ON i.id=h.incasso_id
 JOIN public.acconti_cantiere a ON a.id=i.acconto_id AND a.cantiere_id=i.cantiere_id WHERE a.id=p_acconto),'[]');
END $$;
REVOKE ALL ON FUNCTION public.rettifica_riferimento_incasso_lordo_cliente(uuid,uuid,integer,text,text,text),
 public.leggi_rettifiche_incasso_lordo_cliente(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rettifica_riferimento_incasso_lordo_cliente(uuid,uuid,integer,text,text,text),
 public.leggi_rettifiche_incasso_lordo_cliente(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.conferma_incasso_lordo_cliente(p_id uuid,p_acconto uuid,p_importo numeric,
 p_data date,p_metodo text,p_riferimento text,p_fonte text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; c uuid; r artecna_contabilita.incassi_lordi_clienti; riferimento_iniziale text;
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
 PERFORM pg_advisory_xact_lock(hashtextextended('incassi-riferimenti:'||c::text,0));
 SELECT * INTO r FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_id;
 IF FOUND THEN
  SELECT riferimento_precedente INTO riferimento_iniziale FROM artecna_contabilita.rettifiche_riferimenti_incassi
  WHERE incasso_id=r.id AND revisione=1;
  IF (r.acconto_id,r.cantiere_id,r.importo,r.ricevuto_il,r.metodo,coalesce(riferimento_iniziale,r.riferimento),r.fonte,r.autore)
   IS DISTINCT FROM (p_acconto,c,p_importo,p_data,p_metodo,p_riferimento,p_fonte,u)
  THEN RAISE EXCEPTION 'Richiesta duplicata con dati discordanti' USING ERRCODE='23505'; END IF;
  RETURN to_jsonb(r)||jsonb_build_object('richiesta_duplicata',true);
 END IF;
 IF EXISTS(SELECT FROM artecna_contabilita.rettifiche_riferimenti_incassi s
 JOIN artecna_contabilita.incassi_lordi_clienti x ON x.id=s.incasso_id
 WHERE x.cantiere_id=c AND x.metodo=p_metodo AND p_riferimento IN (s.riferimento_precedente,s.riferimento_nuovo))
 THEN RAISE EXCEPTION 'Pagamento gia presente. Verificare il riferimento nello storico.' USING ERRCODE='23505'; END IF;
 INSERT INTO artecna_contabilita.incassi_lordi_clienti(id,acconto_id,cantiere_id,importo,ricevuto_il,metodo,riferimento,fonte,autore)
 VALUES(p_id,p_acconto,c,p_importo,p_data,p_metodo,p_riferimento,p_fonte,u)
 ON CONFLICT DO NOTHING RETURNING * INTO r;
 IF NOT FOUND THEN
  IF EXISTS(SELECT FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_id)
  THEN RAISE EXCEPTION 'Richiesta duplicata con dati discordanti' USING ERRCODE='23505'; END IF;
  RAISE EXCEPTION 'Pagamento gia presente. Consultare il pagamento esistente.' USING ERRCODE='23505';
 END IF;
 RETURN to_jsonb(r)||jsonb_build_object('richiesta_duplicata',false);
END $$;

CREATE TEMP TABLE cro_catalogo_dopo (voce text NOT NULL) ON COMMIT DROP;
DO $delta$
DECLARE corpo text; delta text[]; attesi text[];
DECLARE terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
 SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
 EXECUTE 'INSERT INTO pg_temp.cro_catalogo_dopo '||left(corpo,length(corpo)-length(terminale))||'SELECT x FROM objects';
 SELECT array_agg(voce ORDER BY voce COLLATE "C") INTO delta
 FROM (SELECT voce FROM pg_temp.cro_catalogo_dopo EXCEPT ALL SELECT voce FROM pg_temp.cro_catalogo_prima) x;
 SELECT array_agg(voce ORDER BY voce COLLATE "C") INTO attesi FROM (
  SELECT 'r:artecna_contabilita.'||relname||':'||pg_get_userbyid(relowner)||':'||coalesce(relacl::text,'')||':'||relrowsecurity||':'||relforcerowsecurity AS voce
  FROM pg_class WHERE oid='artecna_contabilita.rettifiche_riferimenti_incassi'::regclass
  UNION ALL SELECT 'c:'||attrelid::regclass::text||':'||attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull
  FROM pg_attribute WHERE attnum>0 AND NOT attisdropped AND attrelid='artecna_contabilita.rettifiche_riferimenti_incassi'::regclass
  UNION ALL SELECT 'f:'||conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid,true)||':'||convalidated
  FROM pg_constraint WHERE conrelid='artecna_contabilita.rettifiche_riferimenti_incassi'::regclass
 ) x;
 IF delta IS DISTINCT FROM attesi OR EXISTS(
 SELECT voce FROM pg_temp.cro_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.cro_catalogo_dopo
 ) THEN RAISE EXCEPTION 'Delta inatteso del catalogo Hard Delete V3'; END IF;
 UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
END
$delta$;
COMMIT;
