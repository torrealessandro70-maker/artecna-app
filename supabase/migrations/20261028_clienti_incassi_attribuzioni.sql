-- Solo relazioni: nessun movimento, cumulativo o documento viene riscritto.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres'
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_operare_impresa(uuid)') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
 OR to_regnamespace('artecna_contabilita') IS NOT NULL
 THEN RAISE EXCEPTION 'Prerequisiti attribuzioni clienti non verificati'; END IF;
END $$;
CREATE SCHEMA artecna_contabilita;
REVOKE ALL ON SCHEMA artecna_contabilita FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE artecna_contabilita.attribuzioni_clienti (
 id uuid PRIMARY KEY, -- identità della richiesta, riusata dopo un esito incerto
 fattura_id uuid NOT NULL,
 acconto_id uuid NOT NULL,
 cantiere_id uuid NOT NULL,
 cliente_confermato text NOT NULL CHECK (btrim(cliente_confermato)<>''),
 importo numeric(14,2) NOT NULL CHECK(importo>0),
 verificato boolean NOT NULL CHECK(verificato),
 creato_da uuid NOT NULL,
 creato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 scollegato_at timestamptz,
 scollegato_da uuid,
 richiesta_scollega uuid UNIQUE,
 CHECK ((scollegato_at IS NULL AND scollegato_da IS NULL AND richiesta_scollega IS NULL)
     OR (scollegato_at IS NOT NULL AND scollegato_da IS NOT NULL AND richiesta_scollega IS NOT NULL))
);
CREATE INDEX attribuzioni_clienti_fattura ON artecna_contabilita.attribuzioni_clienti(fattura_id);
CREATE INDEX attribuzioni_clienti_acconto ON artecna_contabilita.attribuzioni_clienti(acconto_id);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.attribuzioni_clienti FROM PUBLIC,anon,authenticated,service_role;

-- I riferimenti alle tabelle legacy sono certificati dai writer e protetti dai
-- trigger sotto (anche dopo scollegamento). Nessuna FK aggiunta al dominio
-- cleanup storico con inventario FK fail-closed; nessun CASCADE o bypass.
CREATE FUNCTION artecna_contabilita.autorizza(p_fattura uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; c uuid;
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO c FROM public.fatture_emesse WHERE id=p_fattura;
 IF u IS NULL OR c IS NULL
 OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 OR artecna_guardie.utente_puo_modificare_cantiere(u,c) IS NOT TRUE
 OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=c)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Fattura non accessibile o contesto Cantiere non verificabile'; END IF;
 RETURN u;
END $$;

CREATE FUNCTION public.leggi_attribuzioni_cliente(p_fattura_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE f public.fatture_emesse%ROWTYPE; result jsonb;
BEGIN
 PERFORM artecna_contabilita.autorizza(p_fattura_id);
 SELECT * INTO f FROM public.fatture_emesse WHERE id=p_fattura_id;
 SELECT jsonb_build_object('fattura',jsonb_build_object('id',f.id,'numero_fattura',f.numero_fattura,
  'data_fattura',f.data_fattura,'cliente',f.cliente,'totale',f.totale,'cantiere_id',f.cantiere_id,
  'importo_incassato',f.importo_incassato,'stato',f.stato),
  'attribuito',coalesce((SELECT sum(importo) FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL),0),
  'collegamenti',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.creato_at,l.id) FROM artecna_contabilita.attribuzioni_clienti l WHERE l.fattura_id=f.id),'[]'),
  'acconti',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'data_incasso',a.data_incasso,
   'descrizione',a.descrizione,'importo',a.importo,'provenienza','acconti_cantiere',
   'attribuito',coalesce((SELECT sum(l.importo) FROM artecna_contabilita.attribuzioni_clienti l WHERE l.acconto_id=a.id AND l.scollegato_at IS NULL),0)) ORDER BY a.data_incasso,a.id)
   FROM public.acconti_cantiere a WHERE a.cantiere_id=f.cantiere_id),'[]'),
  'incassi_non_fatturati_ambigui', (SELECT count(*) FROM public.incassi_non_fatturati WHERE cantiere_id=f.cantiere_id),
  'situazione','Da riconciliare','residuo_verificato',NULL)
 INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.collega_incasso_cliente(p_richiesta_id uuid,p_fattura_id uuid,p_acconto_id uuid,p_importo numeric,p_verificato boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; f public.fatture_emesse%ROWTYPE; a public.acconti_cantiere%ROWTYPE;
 l artecna_contabilita.attribuzioni_clienti%ROWTYPE; sf numeric; sa numeric; tipo text;
BEGIN
 -- Lo stesso lock è acquisito dai guard dei writer legacy: tutte le quote sono
 -- ricontrollate dopo attese reali, mai sulla disponibilità inviata dal client.
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Usare una transazione READ COMMITTED per le attribuzioni'; END IF;
 u:=artecna_contabilita.autorizza(p_fattura_id);
 IF p_richiesta_id IS NULL OR p_acconto_id IS NULL OR p_verificato IS DISTINCT FROM true
 OR p_importo IS NULL OR p_importo::text IN ('NaN','Infinity','-Infinity')
 OR p_importo<=0 OR p_importo>999999999999.99 OR p_importo<>round(p_importo,2)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Conferma e importo monetario non validi'; END IF;
 SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=p_richiesta_id;
 IF FOUND THEN
  IF l.creato_da<>u OR l.fattura_id<>p_fattura_id OR l.acconto_id<>p_acconto_id OR l.importo<>p_importo
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità richiesta già usata per un’altra operazione'; END IF;
  -- Anche una richiesta già scollegata resta tale: un retry non la riapre.
  RETURN to_jsonb(l);
 END IF;
 SELECT * INTO f FROM public.fatture_emesse WHERE id=p_fattura_id;
 SELECT * INTO a FROM public.acconti_cantiere WHERE id=p_acconto_id;
 IF NOT FOUND OR a.cantiere_id IS DISTINCT FROM f.cantiere_id OR a.cantiere_id IS NULL
 OR a.data_incasso IS NULL OR a.importo IS NULL OR a.importo::text IN ('NaN','Infinity','-Infinity')
 OR a.importo<=0 OR a.importo<>round(a.importo,2)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acconto non disponibile nel contesto verificato'; END IF;
 tipo:=to_jsonb(f)->>'tipo_documento';
 IF f.totale IS NULL OR f.totale::text IN ('NaN','Infinity','-Infinity') OR f.totale<=0 OR f.totale<>round(f.totale,2)
 OR f.data_fattura IS NULL OR coalesce(btrim(f.cliente),'')=''
 OR coalesce(f.stato,'') NOT IN ('emessa','parziale','incassata')
 OR (tipo IS NOT NULL AND tipo NOT IN ('fattura','TD01'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Documento non supportato: verificare totale, tipo e stato'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL
   AND (cantiere_id<>f.cantiere_id OR cliente_confermato<>btrim(f.cliente)))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acconto già attribuito a un cliente diverso'; END IF;
 SELECT coalesce(sum(importo),0) INTO sf FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL;
 SELECT coalesce(sum(importo),0) INTO sa FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL;
 IF sf+p_importo>f.totale OR sa+p_importo>a.importo
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Quota superiore alla disponibilità del movimento o del documento'; END IF;
 INSERT INTO artecna_contabilita.attribuzioni_clienti(id,fattura_id,acconto_id,cantiere_id,cliente_confermato,importo,verificato,creato_da)
 VALUES(p_richiesta_id,f.id,a.id,f.cantiere_id,btrim(f.cliente),p_importo,true,u) RETURNING * INTO l;
 RETURN to_jsonb(l);
END $$;

CREATE FUNCTION public.scollega_incasso_cliente(p_richiesta_id uuid,p_collegamento_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE l artecna_contabilita.attribuzioni_clienti%ROWTYPE; u uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Usare una transazione READ COMMITTED per lo scollegamento'; END IF;
 SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=p_collegamento_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Collegamento non accessibile'; END IF;
 u:=artecna_contabilita.autorizza(l.fattura_id);
 IF p_richiesta_id IS NULL OR EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti WHERE richiesta_scollega=p_richiesta_id AND id<>l.id)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità scollegamento non valida'; END IF;
 IF l.scollegato_at IS NULL THEN
  UPDATE artecna_contabilita.attribuzioni_clienti SET scollegato_at=clock_timestamp(),scollegato_da=u,richiesta_scollega=p_richiesta_id WHERE id=l.id RETURNING * INTO l;
 END IF;
 RETURN to_jsonb(l);
END $$;

CREATE FUNCTION artecna_contabilita.proteggi_origine() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE presente boolean; attiva boolean; cambiata boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF TG_TABLE_NAME='fatture_emesse' THEN
  SELECT count(*)>0,coalesce(bool_or(scollegato_at IS NULL),false) INTO presente,attiva FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=OLD.id;
 ELSE
  SELECT count(*)>0,coalesce(bool_or(scollegato_at IS NULL),false) INTO presente,attiva FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=OLD.id;
 END IF;
 IF TG_OP='DELETE' THEN
  IF presente THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Origine conservata dallo storico attribuzioni: eliminazione non consentita'; END IF;
  RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='fatture_emesse' THEN
  cambiata:=jsonb_build_array(to_jsonb(NEW)->'id',to_jsonb(NEW)->'totale',to_jsonb(NEW)->'data_fattura',to_jsonb(NEW)->'cantiere_id',to_jsonb(NEW)->'cantiere',to_jsonb(NEW)->'cliente',to_jsonb(NEW)->'stato',to_jsonb(NEW)->'importo_incassato',to_jsonb(NEW)->'tipo_documento')
   IS DISTINCT FROM jsonb_build_array(to_jsonb(OLD)->'id',to_jsonb(OLD)->'totale',to_jsonb(OLD)->'data_fattura',to_jsonb(OLD)->'cantiere_id',to_jsonb(OLD)->'cantiere',to_jsonb(OLD)->'cliente',to_jsonb(OLD)->'stato',to_jsonb(OLD)->'importo_incassato',to_jsonb(OLD)->'tipo_documento');
 ELSE
  cambiata:=jsonb_build_array(NEW.id,NEW.importo,NEW.data_incasso,NEW.cantiere_id,NEW.cantiere) IS DISTINCT FROM jsonb_build_array(OLD.id,OLD.importo,OLD.data_incasso,OLD.cantiere_id,OLD.cantiere);
 END IF;
 -- Anche l'identità di un'origine storica resta immutabile.
 IF (attiva AND cambiata) OR (presente AND NEW.id<>OLD.id)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Scollegare prima le attribuzioni attive; identità storica non modificabile'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fatture_emesse_attribuzioni_guard BEFORE UPDATE OR DELETE ON public.fatture_emesse FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_origine();
CREATE TRIGGER acconti_attribuzioni_guard BEFORE UPDATE OR DELETE ON public.acconti_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_origine();
CREATE FUNCTION artecna_contabilita.proteggi_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti)
 THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Storico attribuzioni presente: TRUNCATE non consentito'; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER fatture_emesse_attribuzioni_truncate BEFORE TRUNCATE ON public.fatture_emesse FOR EACH STATEMENT EXECUTE FUNCTION artecna_contabilita.proteggi_truncate();
CREATE TRIGGER acconti_attribuzioni_truncate BEFORE TRUNCATE ON public.acconti_cantiere FOR EACH STATEMENT EXECUTE FUNCTION artecna_contabilita.proteggi_truncate();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA artecna_contabilita FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.leggi_attribuzioni_cliente(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.collega_incasso_cliente(uuid,uuid,uuid,numeric,boolean) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.scollega_incasso_cliente(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_attribuzioni_cliente(uuid),public.collega_incasso_cliente(uuid,uuid,uuid,numeric,boolean),public.scollega_incasso_cliente(uuid,uuid) TO authenticated;
COMMIT;
