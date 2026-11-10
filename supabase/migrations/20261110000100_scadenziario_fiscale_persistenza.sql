-- PREPARATA SOLTANTO: non applicata. Nessun aggiornamento di baseline/guardie.
BEGIN;
DO $pre$
BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres'
 OR to_regnamespace('artecna_contabilita') IS NULL
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_operare_impresa(uuid)') IS NULL
 OR to_regclass('artecna_contabilita.scadenze_fiscali') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN('leggi_scadenze_fiscali','crea_scadenza_fiscale','aggiorna_scadenza_fiscale','archivia_scadenza_fiscale'))
 THEN RAISE EXCEPTION 'Prerequisiti/collisioni scadenziario non verificati'; END IF;
END $pre$;

CREATE TABLE artecna_contabilita.scadenze_fiscali (
 id uuid PRIMARY KEY,
 tipo text NOT NULL CHECK(length(btrim(tipo)) BETWEEN 1 AND 80 AND tipo=btrim(tipo)),
 periodo_riferimento text NOT NULL CHECK(length(btrim(periodo_riferimento)) BETWEEN 1 AND 120 AND periodo_riferimento=btrim(periodo_riferimento)),
 data_scadenza date NOT NULL CHECK(isfinite(data_scadenza)),
 importo_previsto numeric(14,2) CHECK(importo_previsto IS NULL OR (importo_previsto>=0 AND importo_previsto<='999999999999.99'::numeric)),
 stato text NOT NULL DEFAULT 'da_verificare' CHECK(stato IN('previsto','da_verificare','da_pagare','pagato')),
 importo_pagato numeric(14,2) CHECK(importo_pagato IS NULL OR (importo_pagato>=0 AND importo_pagato<='999999999999.99'::numeric)),
 data_pagamento date CHECK(data_pagamento IS NULL OR (isfinite(data_pagamento) AND importo_pagato IS NOT NULL)),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=2000),
 riferimento_documento text NOT NULL DEFAULT '' CHECK(length(riferimento_documento)<=300),
 includi_nei_totali boolean NOT NULL DEFAULT false,
 revisione bigint NOT NULL DEFAULT 0 CHECK(revisione>=0 AND revisione<=9007199254740991),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_by uuid NOT NULL,
 archiviata_at timestamptz,
 archiviata_by uuid,
 motivo_archiviazione text,
 CHECK(updated_at>=created_at),
 CHECK((archiviata_at IS NULL AND archiviata_by IS NULL AND motivo_archiviazione IS NULL)
    OR (archiviata_at IS NOT NULL AND archiviata_by IS NOT NULL AND motivo_archiviazione IS NOT NULL AND length(btrim(motivo_archiviazione)) BETWEEN 1 AND 2000))
);
CREATE INDEX scadenze_fiscali_data_idx ON artecna_contabilita.scadenze_fiscali(data_scadenza,id) WHERE archiviata_at IS NULL;
CREATE UNIQUE INDEX scadenze_fiscali_identita_attiva_idx ON artecna_contabilita.scadenze_fiscali
 (lower(tipo),lower(periodo_riferimento),data_scadenza,riferimento_documento) WHERE archiviata_at IS NULL;
ALTER TABLE artecna_contabilita.scadenze_fiscali ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.scadenze_fiscali FORCE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.scadenze_fiscali FROM PUBLIC,anon,authenticated,service_role;
-- Neutralizza eventuali default ACL anche per altri grantee, soltanto sul nuovo oggetto.
DO $acl$ DECLARE r record; BEGIN
 FOR r IN SELECT DISTINCT a.grantee FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  WHERE c.oid='artecna_contabilita.scadenze_fiscali'::regclass AND a.grantee<>0 AND a.grantee<>c.relowner
 LOOP EXECUTE format('REVOKE ALL ON artecna_contabilita.scadenze_fiscali FROM %I',pg_get_userbyid(r.grantee)); END LOOP;
END $acl$;
-- Nessuna policy browser: RLS deny-by-default. Le RPC postgres SECURITY DEFINER,
-- come i reader contabili esistenti, controllano SEMPRE il guard JWT prima dei dati.
-- Non si affida a FORCE RLS la limitazione del proprietario/superuser.

CREATE FUNCTION artecna_contabilita.scadenza_autorizza() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE u uuid; BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Scadenziario riservato al titolare aziendale attivo'; END IF;
 RETURN u;
END $f$;

CREATE FUNCTION artecna_contabilita.scadenza_payload(p_dati jsonb) RETURNS artecna_contabilita.scadenze_fiscali
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $f$
DECLARE k text; v text; r artecna_contabilita.scadenze_fiscali;
BEGIN
 IF p_dati IS NULL OR jsonb_typeof(p_dati)<>'object' OR
  NOT p_dati ?& ARRAY['tipo','periodo_riferimento','data_scadenza','importo_previsto','stato','importo_pagato','data_pagamento','note','riferimento_documento','includi_nei_totali']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_dati) x WHERE x NOT IN('tipo','periodo_riferimento','data_scadenza','importo_previsto','stato','importo_pagato','data_pagamento','note','riferimento_documento','includi_nei_totali'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload scadenza incompleto o con campi riservati'; END IF;
 FOREACH k IN ARRAY ARRAY['tipo','periodo_riferimento','data_scadenza','stato','note','riferimento_documento'] LOOP
  IF jsonb_typeof(p_dati->k)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo testuale non valido'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['importo_previsto','importo_pagato'] LOOP
  IF p_dati->k<>'null'::jsonb THEN
   v:=p_dati->>k;
   IF jsonb_typeof(p_dati->k)<>'string' OR length(v)>15 OR v!~'^[0-9]+([.][0-9]{1,2})?$'
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importo: stringa decimale non negativa, massimo due decimali'; END IF;
   IF v::numeric>999999999999.99 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importo oltre numeric(14,2)'; END IF;
  END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['data_scadenza','data_pagamento'] LOOP
  IF p_dati->k<>'null'::jsonb THEN
   v:=p_dati->>k;
   IF jsonb_typeof(p_dati->k)<>'string' OR v!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char(v::date,'YYYY-MM-DD')<>v
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Data scadenza/pagamento non valida'; END IF;
  END IF;
 END LOOP;
 IF jsonb_typeof(p_dati->'includi_nei_totali')<>'boolean'
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inclusione nei totali non valida'; END IF;
 r:=jsonb_populate_record(NULL::artecna_contabilita.scadenze_fiscali,p_dati);
 IF length(btrim(r.tipo)) NOT BETWEEN 1 AND 80 OR r.tipo<>btrim(r.tipo)
 OR length(btrim(r.periodo_riferimento)) NOT BETWEEN 1 AND 120 OR r.periodo_riferimento<>btrim(r.periodo_riferimento)
 OR r.stato NOT IN('previsto','da_verificare','da_pagare','pagato') OR length(r.note)>2000 OR length(r.riferimento_documento)>300
 OR (r.data_pagamento IS NOT NULL AND r.importo_pagato IS NULL)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campi della scadenza non coerenti'; END IF;
 RETURN r;
END $f$;

CREATE FUNCTION artecna_contabilita.scadenza_json(r artecna_contabilita.scadenze_fiscali) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $f$
 SELECT to_jsonb($1)||jsonb_build_object('importo_previsto',($1).importo_previsto::text,'importo_pagato',($1).importo_pagato::text,'revisione',($1).revisione::text)
$f$;

CREATE FUNCTION public.leggi_scadenze_fiscali(p_includi_archiviate boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE risultato jsonb; n bigint;
BEGIN
 PERFORM artecna_contabilita.scadenza_autorizza();
 IF p_includi_archiviate IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Filtro archivio mancante'; END IF;
 SELECT count(*),coalesce(jsonb_agg(artecna_contabilita.scadenza_json(s) ORDER BY data_scadenza,id),'[]'::jsonb)
 INTO n,risultato FROM artecna_contabilita.scadenze_fiscali s WHERE p_includi_archiviate OR archiviata_at IS NULL;
 IF n>5000 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Archivio oltre il limite del reader: nessun risultato troncato'; END IF;
 RETURN jsonb_build_object('versione',1,'totale',n,'include_archiviate',p_includi_archiviate,'righe',risultato);
END $f$;

CREATE FUNCTION public.crea_scadenza_fiscale(p_id uuid,p_dati jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE u uuid; d artecna_contabilita.scadenze_fiscali; r artecna_contabilita.scadenze_fiscali; t timestamptz:=clock_timestamp();
BEGIN
 u:=artecna_contabilita.scadenza_autorizza();
 IF p_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità richiesta mancante'; END IF;
 d:=artecna_contabilita.scadenza_payload(p_dati);
 INSERT INTO artecna_contabilita.scadenze_fiscali(id,tipo,periodo_riferimento,data_scadenza,importo_previsto,stato,importo_pagato,data_pagamento,note,riferimento_documento,includi_nei_totali,created_at,created_by,updated_at,updated_by)
 VALUES(p_id,d.tipo,d.periodo_riferimento,d.data_scadenza,d.importo_previsto,d.stato,d.importo_pagato,d.data_pagamento,d.note,d.riferimento_documento,d.includi_nei_totali,t,u,t,u)
 ON CONFLICT(id) DO NOTHING RETURNING * INTO r;
 IF NOT FOUND THEN
  SELECT * INTO r FROM artecna_contabilita.scadenze_fiscali WHERE id=p_id;
  IF r.id IS NULL OR r.created_by<>u OR r.revisione<>0 OR r.archiviata_at IS NOT NULL OR
   ROW(r.tipo,r.periodo_riferimento,r.data_scadenza,r.importo_previsto,r.stato,r.importo_pagato,r.data_pagamento,r.note,r.riferimento_documento,r.includi_nei_totali)
   IS DISTINCT FROM ROW(d.tipo,d.periodo_riferimento,d.data_scadenza,d.importo_previsto,d.stato,d.importo_pagato,d.data_pagamento,d.note,d.riferimento_documento,d.includi_nei_totali)
  THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Identità già usata: rileggere, nessun retry automatico'; END IF;
 END IF;
 RETURN artecna_contabilita.scadenza_json(r);
END $f$;

CREATE FUNCTION public.aggiorna_scadenza_fiscale(p_id uuid,p_revisione_attesa bigint,p_dati jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE u uuid; d artecna_contabilita.scadenze_fiscali; r artecna_contabilita.scadenze_fiscali;
BEGIN
 u:=artecna_contabilita.scadenza_autorizza();
 IF p_id IS NULL OR p_revisione_attesa IS NULL OR p_revisione_attesa<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità/revisione mancante'; END IF;
 d:=artecna_contabilita.scadenza_payload(p_dati);
 UPDATE artecna_contabilita.scadenze_fiscali SET tipo=d.tipo,periodo_riferimento=d.periodo_riferimento,data_scadenza=d.data_scadenza,
 importo_previsto=d.importo_previsto,stato=d.stato,importo_pagato=d.importo_pagato,data_pagamento=d.data_pagamento,note=d.note,
 riferimento_documento=d.riferimento_documento,includi_nei_totali=d.includi_nei_totali,revisione=revisione+1,updated_at=clock_timestamp(),updated_by=u
 WHERE id=p_id AND revisione=p_revisione_attesa AND archiviata_at IS NULL RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Conflitto revisione o scadenza non attiva: rileggere, nessun retry automatico'; END IF;
 RETURN artecna_contabilita.scadenza_json(r);
END $f$;

CREATE FUNCTION public.archivia_scadenza_fiscale(p_id uuid,p_revisione_attesa bigint,p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE u uuid; r artecna_contabilita.scadenze_fiscali; t timestamptz:=clock_timestamp();
BEGIN
 u:=artecna_contabilita.scadenza_autorizza();
 IF p_id IS NULL OR p_revisione_attesa IS NULL OR p_revisione_attesa<0 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità, revisione o motivo archiviazione non valido'; END IF;
 UPDATE artecna_contabilita.scadenze_fiscali SET archiviata_at=t,archiviata_by=u,motivo_archiviazione=btrim(p_motivo),
 revisione=revisione+1,updated_at=t,updated_by=u
 WHERE id=p_id AND revisione=p_revisione_attesa AND archiviata_at IS NULL RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Conflitto archiviazione: rileggere, nessun retry automatico'; END IF;
 RETURN artecna_contabilita.scadenza_json(r);
END $f$;

REVOKE ALL ON FUNCTION artecna_contabilita.scadenza_autorizza(),artecna_contabilita.scadenza_payload(jsonb),artecna_contabilita.scadenza_json(artecna_contabilita.scadenze_fiscali) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.leggi_scadenze_fiscali(boolean),public.crea_scadenza_fiscale(uuid,jsonb),public.aggiorna_scadenza_fiscale(uuid,bigint,jsonb),public.archivia_scadenza_fiscale(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_scadenze_fiscali(boolean),public.crea_scadenza_fiscale(uuid,jsonb),public.aggiorna_scadenza_fiscale(uuid,bigint,jsonb),public.archivia_scadenza_fiscale(uuid,bigint,text) TO authenticated;
COMMIT;
