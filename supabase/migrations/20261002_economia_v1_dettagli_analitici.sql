-- Economia V1: dettagli analitici del template ufficiale Extra v2.
-- Applicare manualmente dopo 20261002_economia_conflitto_revisione.sql.
-- Nessun upload Storage; nessuna modifica al CHECK della descrizione.
BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.economia_righe'::regclass
             AND attname IN ('tipo_riga','dettagli_analitici') AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Estensione analitica già presente: nessuna riapplicazione automatica';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.economia_righe'::regclass
                 AND conname='economia_righe_descrizione_check' AND contype='c' AND convalidated) THEN
    RAISE EXCEPTION 'Vincolo legacy descrizione assente';
  END IF;
END;
$preflight$;

ALTER TABLE public.economia_righe
  ADD COLUMN tipo_riga text NOT NULL DEFAULT 'generica',
  ADD COLUMN dettagli_analitici jsonb,
  ADD CONSTRAINT economia_righe_tipo_riga_check CHECK (tipo_riga IN ('generica','manodopera','materiale')),
  ADD CONSTRAINT economia_righe_dettagli_analitici_check CHECK (
    (tipo_riga='generica' AND dettagli_analitici IS NULL) OR
    (tipo_riga IN ('manodopera','materiale') AND dettagli_analitici IS NOT NULL
      AND jsonb_typeof(dettagli_analitici)='object'
      AND dettagli_analitici ? 'version' AND dettagli_analitici->'version'='1'::jsonb)),
  ADD CONSTRAINT economia_righe_analitiche_origine_check CHECK (tipo_riga='generica' OR origine='file');
GRANT UPDATE(tipo_riga,dettagli_analitici) ON public.economia_righe TO artecna_economia_rpc;

-- Helpers interni SECURITY INVOKER: nessun accesso alle tabelle, nessun grant client.
CREATE FUNCTION public.economia_oggetto_analitico(p_v jsonb,p_keys text[]) RETURNS void
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $helper$
BEGIN
  IF p_v IS NULL OR jsonb_typeof(p_v)<>'object'
    OR NOT (p_v ?& p_keys)
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_v) k WHERE NOT (k=ANY(p_keys))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Struttura dettagli Economia non valida';
  END IF;
END;
$helper$;

CREATE FUNCTION public.economia_numero_sorgente(p_cella jsonb) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $helper$
DECLARE v text;
BEGIN
  v:=p_cella->>'valore';
  IF v IS NULL OR v='' THEN RETURN NULL; END IF;
  IF p_cella->>'tipo'<>'n' OR v !~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Numero Excel originale non valido';
  END IF;
  RETURN v::numeric;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Numero Excel fuori intervallo';
END;
$helper$;

CREATE FUNCTION public.economia_valida_dettagli(
  p_tipo text,p_d jsonb,p_snapshot jsonb,p_snapshot_version integer,p_indice integer,
  p_q numeric,p_p numeric,p_um text,p_descrizione text,p_chiusura boolean
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path TO pg_catalog,pg_temp AS $validator$
DECLARE
  src jsonb; op jsonb; norm jsonb; celle jsonb; cella jsonb; voce jsonb;
  campi text[]; colonne text[]; opkeys text[]; foglio text; riga integer;
  k text; c text; i integer; grezzo numeric; valore numeric; q0 numeric; p0 numeric; t0 numeric;
  ws jsonb:='[]'::jsonb; wo jsonb:='[]'::jsonb; warning jsonb;
  data_src date; ref_src text; parts text[]; inizio numeric; fine numeric; pausa numeric; ore numeric;
BEGIN
  IF p_tipo='generica' THEN
    IF p_d IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga generica con dettagli analitici'; END IF;
    RETURN NULL;
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('manodopera','materiale') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo riga Economia non valido';
  END IF;
  PERFORM public.economia_oggetto_analitico(p_d,ARRAY['version','sorgente','operativo','normalizzazione','warnings']);
  IF p_d->'version' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione dettagli non supportata'; END IF;
  src:=p_d->'sorgente'; op:=p_d->'operativo'; norm:=p_d->'normalizzazione';
  PERFORM public.economia_oggetto_analitico(p_d->'warnings',ARRAY['sorgente','operativo']);
  IF jsonb_typeof(p_d->'warnings'->'sorgente')<>'array' OR jsonb_typeof(p_d->'warnings'->'operativo')<>'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Struttura warnings non valida';
  END IF;
  IF p_tipo='manodopera' THEN
    foglio:='Manodopera economia';
    campi:=ARRAY['cantiere','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','ore_dichiarate','tariffa_dichiarata','totale_dichiarato','riferimento','note'];
    colonne:=ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M'];
    opkeys:=ARRAY['cantiere_dichiarato','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','riferimento'];
  ELSE
    foglio:='Materiali economia';
    campi:=ARRAY['cantiere','codice_variante','data','materiale','um','quantita_dichiarata','prezzo_dichiarato','totale_dichiarato','fornitore','documento','riferimento_rapportino','note'];
    colonne:=ARRAY['A','B','C','D','E','F','G','H','I','J','K','L'];
    opkeys:=ARRAY['cantiere_dichiarato','codice_variante','data','fornitore','documento','riferimento_rapportino'];
  END IF;
  PERFORM public.economia_oggetto_analitico(src,ARRAY['foglio_sorgente','riga_sorgente']||campi);
  IF src->>'foglio_sorgente' IS DISTINCT FROM foglio OR jsonb_typeof(src->'riga_sorgente')<>'number'
     OR src->>'riga_sorgente' !~ '^[0-9]+$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Foglio/riga sorgente non validi'; END IF;
  riga:=(src->>'riga_sorgente')::integer;
  IF riga<(CASE WHEN p_tipo='manodopera' THEN 6 ELSE 5 END) OR riga>1048576
    OR p_indice IS DISTINCT FROM 2*(riga-1)+(CASE WHEN p_tipo='materiale' THEN 1 ELSE 0 END) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Indice sorgente analitico incoerente';
  END IF;
  IF p_snapshot_version IS DISTINCT FROM 2 OR p_snapshot->'version' IS DISTINCT FROM '2'::jsonb
    OR p_snapshot->>'template' IS DISTINCT FROM 'ARTECNA_Template_Import_Varianti_Extra_v2'
    OR jsonb_typeof(p_snapshot->'date1904') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_snapshot->'fogli'->'Manodopera economia') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_snapshot->'fogli'->'Materiali economia') IS DISTINCT FROM 'object'
    OR (p_snapshot->'fogli'->'Manodopera economia'->>'riga_intestazioni') IS DISTINCT FROM '5'
    OR (p_snapshot->'fogli'->'Materiali economia'->>'riga_intestazioni') IS DISTINCT FROM '4' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Snapshot analitico v2 non valido';
  END IF;
  voce:=p_snapshot->'fogli'->foglio->'righe'->riga::text;
  PERFORM public.economia_oggetto_analitico(voce,ARRAY['celle','warnings']);
  IF jsonb_typeof(voce->'warnings')<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Warnings sorgente non validi'; END IF;
  celle:=voce->'celle';
  IF jsonb_typeof(celle) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(celle))<>array_length(campi,1) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Celle sorgente incomplete';
  END IF;
  FOR i IN 1..array_length(campi,1) LOOP
    c:=colonne[i]||riga::text;
    IF src->>campi[i] IS DISTINCT FROM c THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Coordinate sorgente alterate'; END IF;
    cella:=celle->c;
    PERFORM public.economia_oggetto_analitico(cella,ARRAY['tipo','valore','formula','formato','visualizzato']);
    IF cella->>'tipo' NOT IN ('n','s','b','e','z') OR cella->>'tipo' IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo cella originale non valido';
    END IF;
    FOREACH k IN ARRAY ARRAY['valore','formula','formato','visualizzato'] LOOP
      IF jsonb_typeof(cella->k) NOT IN ('string','null') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contenuto cella originale non valido'; END IF;
    END LOOP;
    IF cella->>'tipo'='e' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Errore Excel nella riga'; END IF;
  END LOOP;
  PERFORM public.economia_oggetto_analitico(op,opkeys);
  FOREACH k IN ARRAY opkeys LOOP
    IF k='pausa_min' THEN
      IF op->k<>'null'::jsonb AND (jsonb_typeof(op->k)<>'number' OR op->>k !~ '^[0-9]+$') THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Pausa operativa non valida';
      END IF;
    ELSIF jsonb_typeof(op->k) NOT IN ('string','null') OR (jsonb_typeof(op->k)='string' AND btrim(op->>k)='') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo analitico operativo non valido';
    END IF;
  END LOOP;
  IF op->>'data' IS NOT NULL AND ((op->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR to_char((op->>'data')::date,'YYYY-MM-DD')<>op->>'data') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Data operativa non valida';
  END IF;
  IF p_tipo='manodopera' THEN
    FOREACH k IN ARRAY ARRAY['ora_inizio','ora_fine'] LOOP
      IF op->>k IS NOT NULL AND op->>k !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Orario operativo non valido';
      END IF;
    END LOOP;
    IF p_um IS DISTINCT FROM 'h' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UM manodopera deve essere h'; END IF;
  END IF;
  IF p_q IS NULL OR p_q<=0 OR p_q::text IN ('NaN','Infinity','-Infinity') OR p_q<>round(p_q,2)
     OR (p_p IS NOT NULL AND (p_p<0 OR p_p::text IN ('NaN','Infinity','-Infinity') OR p_p<>round(p_p,2))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione analitica: richiesti due decimali';
  END IF;
  PERFORM public.economia_oggetto_analitico(norm,ARRAY['regola','quantita','prezzo_unitario']);
  IF norm->>'regola' IS DISTINCT FROM 'artecna_template_extra_v2_precisione_v1' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Regola normalizzazione non valida'; END IF;
  q0:=public.economia_numero_sorgente(celle->((CASE WHEN p_tipo='manodopera' THEN 'I' ELSE 'F' END)||riga));
  p0:=public.economia_numero_sorgente(celle->((CASE WHEN p_tipo='manodopera' THEN 'J' ELSE 'G' END)||riga));
  t0:=public.economia_numero_sorgente(celle->((CASE WHEN p_tipo='manodopera' THEN 'K' ELSE 'H' END)||riga));
  FOREACH k IN ARRAY ARRAY['quantita','prezzo_unitario'] LOOP
    PERFORM public.economia_oggetto_analitico(norm->k,ARRAY['decimali','origine','motivazione']);
    IF norm->k->'decimali' IS DISTINCT FROM '2'::jsonb OR norm->k->>'origine' IS NULL
       OR norm->k->>'origine' NOT IN ('sorgente','rettifica') OR jsonb_typeof(norm->k->'motivazione') NOT IN ('string','null') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Traccia normalizzazione non valida';
    END IF;
    grezzo:=CASE WHEN k='quantita' THEN q0 ELSE p0 END;
    valore:=CASE WHEN k='quantita' THEN p_q ELSE p_p END;
    IF norm->k->>'origine'='sorgente' THEN
      IF valore IS DISTINCT FROM round(grezzo,2) OR norm->k->>'motivazione' IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Normalizzazione divergente dalla sorgente';
      END IF;
    ELSIF coalesce(btrim(norm->k->>'motivazione'),'')='' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rettifica richiede motivazione';
    END IF;
  END LOOP;
  -- Warnings autorevoli ricalcolati: il client non può cancellare le anomalie originali.
  IF p_tipo='manodopera' THEN
    IF coalesce(btrim(celle->('E'||riga)->>'valore'),'')='' THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','qualifica_mancante','campi',jsonb_build_array('qualifica'))); END IF;
    IF op->>'qualifica' IS NULL THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','qualifica_mancante','campi',jsonb_build_array('qualifica'))); END IF;
    inizio:=public.economia_numero_sorgente(celle->('F'||riga)); fine:=public.economia_numero_sorgente(celle->('G'||riga)); pausa:=public.economia_numero_sorgente(celle->('H'||riga));
    IF inizio IS NOT NULL AND fine IS NOT NULL AND pausa IS NOT NULL THEN
      inizio:=mod(round(mod(inizio,1)*1440,0),1440); fine:=mod(round(mod(fine,1)*1440,0),1440); pausa:=round(pausa,0);
      ore:=greatest(0,(mod(fine-inizio+1440,1440)-pausa)/60);
      IF round(q0,2) IS DISTINCT FROM round(ore,2) THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','ore_discordanti','campi',jsonb_build_array('ore_dichiarate'))); END IF;
      IF fine<inizio THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','passaggio_mezzanotte','campi',jsonb_build_array('ora_fine'))); END IF;
      IF pausa>mod(fine-inizio+1440,1440) OR ore<=0 THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','durata_non_valida','campi',jsonb_build_array('pausa_min'))); END IF;
    END IF;
    ref_src:=celle->('L'||riga)->>'valore';
  ELSE
    IF coalesce(btrim(celle->('D'||riga)->>'valore'),'')='' THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','materiale_mancante','campi',jsonb_build_array('materiale'))); END IF;
    ref_src:=celle->('K'||riga)->>'valore';
  END IF;
  IF q0 IS NOT NULL AND p0 IS NOT NULL AND t0 IS NOT NULL AND round(round(q0,2)*round(p0,2),2)<>round(t0,2) THEN
    ws:=ws||jsonb_build_array(jsonb_build_object('codice','totale_discordante','campi',jsonb_build_array('totale_dichiarato')));
  END IF;
  IF t0 IS NULL AND celle->((CASE WHEN p_tipo='manodopera' THEN 'K' ELSE 'H' END)||riga)->>'formula' IS NOT NULL THEN
    ws:=ws||jsonb_build_array(jsonb_build_object('codice','risultato_formula_mancante','campi',jsonb_build_array('totale_dichiarato')));
  END IF;
  grezzo:=public.economia_numero_sorgente(celle->('C'||riga));
  IF grezzo IS NOT NULL THEN
    data_src:=(CASE WHEN (p_snapshot->>'date1904')::boolean THEN date '1904-01-01'
      WHEN trunc(grezzo)<60 THEN date '1899-12-31' ELSE date '1899-12-30' END)+trunc(grezzo)::integer;
    parts:=regexp_match(ref_src,'([0-9]{2})/([0-9]{2})/([0-9]{4})');
    IF parts IS NOT NULL AND parts[3]||'-'||parts[2]||'-'||parts[1]<>to_char(data_src,'YYYY-MM-DD') THEN
      ws:=ws||jsonb_build_array(jsonb_build_object('codice','riferimento_data_discordante','campi',jsonb_build_array('data','riferimento')));
    END IF;
  END IF;
  -- Conserva anche warning originali non economici (parser/formati), con schema chiuso.
  FOR warning IN SELECT value FROM jsonb_array_elements(voce->'warnings') LOOP
    PERFORM public.economia_oggetto_analitico(warning,ARRAY['codice','campi']);
    IF jsonb_typeof(warning->'codice')<>'string' OR btrim(warning->>'codice')='' OR jsonb_typeof(warning->'campi')<>'array'
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(warning->'campi') a WHERE jsonb_typeof(a)<>'string') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Warning originale non valido';
    END IF;
    IF NOT ws @> jsonb_build_array(warning) THEN ws:=ws||jsonb_build_array(warning); END IF;
  END LOOP;
  IF p_p IS NULL THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','prezzo_non_valorizzato','campi',jsonb_build_array('prezzo_unitario'))); END IF;
  FOREACH k IN ARRAY ARRAY['quantita','prezzo_unitario'] LOOP
    IF norm->k->>'origine'='rettifica' THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','rettifica_operativa','campi',jsonb_build_array(k))); END IF;
  END LOOP;
  IF p_tipo='manodopera' AND op->>'ora_inizio' IS NOT NULL AND op->>'ora_fine' IS NOT NULL AND op->>'pausa_min' IS NOT NULL THEN
    inizio:=split_part(op->>'ora_inizio',':',1)::integer*60+split_part(op->>'ora_inizio',':',2)::integer;
    fine:=split_part(op->>'ora_fine',':',1)::integer*60+split_part(op->>'ora_fine',':',2)::integer;
    pausa:=(op->>'pausa_min')::numeric;
    ore:=greatest(0,(mod(fine-inizio+1440,1440)-pausa)/60);
    IF p_q<>round(ore,2) THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','ore_discordanti','campi',jsonb_build_array('quantita'))); END IF;
    IF pausa>mod(fine-inizio+1440,1440) OR ore<=0 THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','durata_non_valida','campi',jsonb_build_array('pausa_min'))); END IF;
  END IF;
  IF p_chiusura AND (op->>'data' IS NULL OR (p_tipo='manodopera' AND
       (op->>'operaio' IS NULL OR op->>'ora_inizio' IS NULL OR op->>'ora_fine' IS NULL OR op->>'pausa_min' IS NULL))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga analitica incompleta per chiusura';
  END IF;
  IF coalesce(btrim(p_descrizione),'')='' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Descrizione operativa obbligatoria'; END IF;
  RETURN jsonb_set(p_d,'{warnings}',jsonb_build_object('sorgente',ws,'operativo',wo));
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range OR invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valore analitico non valido';
END;
$validator$;

REVOKE ALL ON FUNCTION public.economia_oggetto_analitico(jsonb,text[]),public.economia_numero_sorgente(jsonb),
  public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) FROM PUBLIC;
-- Neutralizza anche eventuali default ACL Supabase sui nuovi helpers, senza cambiare default globali.
DO $helper_acl$
DECLARE f record; a record;
BEGIN
  FOR f IN SELECT p.oid,p.proowner FROM pg_catalog.pg_proc p WHERE p.oid IN (
    'public.economia_oggetto_analitico(jsonb,text[])'::regprocedure,
    'public.economia_numero_sorgente(jsonb)'::regprocedure,
    'public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean)'::regprocedure
  ) LOOP
    FOR a IN SELECT DISTINCT ac.grantee FROM pg_catalog.pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) ac
      WHERE p.oid=f.oid AND ac.grantee<>0 AND ac.grantee<>f.proowner LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(a.grantee));
    END LOOP;
  END LOOP;
END;
$helper_acl$;
GRANT EXECUTE ON FUNCTION public.economia_oggetto_analitico(jsonb,text[]),public.economia_numero_sorgente(jsonb),
  public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) TO artecna_economia_rpc;

-- La patch RPC e il COMMIT seguono: preflight del corpo PT409, owner/ACL e post-check.
DO $patch$
DECLARE
  v_baseline jsonb := $baseline$[
  {
    "acl": [
      "artecna_economia_rpc=X/artecna_economia_rpc",
      "authenticated=X/artecna_economia_rpc"
    ],
    "firma": "chiudi_raccolta_economia(uuid,bigint)",
    "owner": "artecna_economia_rpc",
    "proconfig": [
      "search_path=pg_catalog, pg_temp"
    ],
    "volatility": "v",
    "definizione": "CREATE OR REPLACE FUNCTION public.chiudi_raccolta_economia(p_raccolta_id uuid, p_revisione_attesa bigint)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nDECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;\r\n v_user := artecna_guardie.utente_jwt_corrente();\r\n IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;\r\n PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\n PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;\r\n SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;\r\n IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;\r\n IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;\r\n IF NOT EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id) OR EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richieste righe valorizzate'; END IF;\r\n UPDATE public.economia_raccolte e SET stato='chiusa',revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;\r\n RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),\r\n 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;\r\n$function$\n",
    "security_definer": true,
    "nuovo_corpo": "\nDECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; row_analitica public.economia_righe%rowtype; s public.economia_sorgenti%rowtype; BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;\n v_user := artecna_guardie.utente_jwt_corrente();\n IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;\n PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;\n PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;\n SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;\n IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;\n IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;\n IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;\n IF NOT EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id) OR EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richieste righe valorizzate'; END IF;\n FOR row_analitica IN SELECT r.* FROM public.economia_righe r WHERE r.raccolta_id=v_r.id LOOP\n   s:=NULL;\n   IF row_analitica.tipo_riga<>'generica' THEN\n     SELECT es.* INTO s FROM public.economia_sorgenti es WHERE es.id=row_analitica.sorgente_id AND es.raccolta_id=v_r.id;\n     IF NOT FOUND OR s.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica assente'; END IF;\n   END IF;\n   PERFORM public.economia_valida_dettagli(row_analitica.tipo_riga,row_analitica.dettagli_analitici,s.snapshot,s.snapshot_version,row_analitica.indice_voce_sorgente,row_analitica.quantita,row_analitica.prezzo_unitario,row_analitica.unita_misura,row_analitica.descrizione,true);\n END LOOP;\n UPDATE public.economia_raccolte e SET stato='chiusa',revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;\n RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),\n 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;\n"
  },
  {
    "acl": [
      "artecna_economia_rpc=X/artecna_economia_rpc",
      "authenticated=X/artecna_economia_rpc"
    ],
    "firma": "salva_bozza_economia(uuid,bigint,jsonb)",
    "owner": "artecna_economia_rpc",
    "proconfig": [
      "search_path=pg_catalog, pg_temp"
    ],
    "volatility": "v",
    "definizione": "CREATE OR REPLACE FUNCTION public.salva_bozza_economia(p_raccolta_id uuid, p_revisione_attesa bigint, p_payload jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nDECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; a jsonb; k text; x jsonb; rid uuid; n integer; q numeric; pr numeric; seen uuid[]:=ARRAY[]::uuid[]; changed uuid[]:=ARRAY[]::uuid[];\r\nBEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;\r\n v_user := artecna_guardie.utente_jwt_corrente();\r\n IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;\r\n PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\n PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;\r\n SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;\r\n IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;\r\n IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;\r\n IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(key) WHERE z.key NOT IN ('righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload Economia non valido'; END IF;\r\n FOREACH k IN ARRAY ARRAY['righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino'] LOOP\r\n  IF p_payload ? k AND jsonb_typeof(p_payload->k)<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni richiedono array'; END IF;\r\n END LOOP;\r\n SET CONSTRAINTS public.economia_righe_ordine_unique DEFERRED;\r\n -- Sorgenti nuove: ID esplicito consente riferimenti nel medesimo payload.\r\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'sorgenti_da_aggiungere','[]'::jsonb)) LOOP\r\n  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','nome_file','formato','file_sha256','snapshot_version','snapshot')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente non valida'; END IF;\r\n  rid:=(x->>'id')::uuid; IF rid IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID sorgente obbligatorio'; END IF;\r\n  INSERT INTO public.economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)\r\n    VALUES(rid,v_r.id,x->>'nome_file',x->>'formato',x->>'file_sha256',coalesce((x->>'snapshot_version')::integer,1),x->'snapshot',v_user);\r\n END LOOP;\r\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'righe_da_eliminare','[]'::jsonb)) LOOP\r\n  IF jsonb_typeof(x)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID riga richiesto'; END IF;\r\n  rid:=(x #>> '{}')::uuid;\r\n  IF rid=ANY(changed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione riga ripetuta'; END IF;\r\n  DELETE FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id;\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\r\n  changed:=array_append(changed,rid);\r\n END LOOP;\r\n -- Modifiche esplicite: contenuto completo della sola riga indicata, provenienza immutabile.\r\n FOREACH k IN ARRAY ARRAY['righe_da_modificare','righe_da_creare'] LOOP\r\n  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) LOOP\r\n   IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non valida'; END IF;\r\n   q:=(x->>'quantita')::numeric; pr:=(x->>'prezzo_unitario')::numeric;\r\n   IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') OR q<>round(q,6)\r\n     OR (pr IS NOT NULL AND (pr<0 OR pr::text IN ('NaN','Infinity','-Infinity') OR pr<>round(pr,6))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione o valore numerico non valido'; END IF;\r\n   rid:=(x->>'id')::uuid;\r\n   IF k='righe_da_modificare' THEN\r\n    IF rid IS NULL OR rid=ANY(changed) OR x ? 'origine' OR x ? 'sorgente_id' OR x ? 'indice_voce_sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica riga/provenienza non valida'; END IF;\r\n    UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,prezzo_unitario=pr,note=x->>'note',updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;\r\n    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\r\n   ELSE\r\n    IF rid IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID nuova riga assegnato dal server'; END IF;\r\n    INSERT INTO public.economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,sorgente_id,indice_voce_sorgente,created_by)\r\n      VALUES(v_r.id,(x->>'ordine')::integer,x->>'descrizione',x->>'unita_misura',q,pr,x->>'note',x->>'origine',(x->>'sorgente_id')::uuid,(x->>'indice_voce_sorgente')::integer,v_user) RETURNING id INTO rid;\r\n   END IF;\r\n   changed:=array_append(changed,rid);\r\n  END LOOP;\r\n END LOOP;\r\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'riordino','[]'::jsonb)) LOOP\r\n  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino non valido'; END IF;\r\n  rid:=(x->>'id')::uuid; IF rid IS NULL OR rid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino ripetuto'; END IF;\r\n  UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF; seen:=array_append(seen,rid);\r\n END LOOP;\r\n SET CONSTRAINTS public.economia_righe_ordine_unique IMMEDIATE;\r\n UPDATE public.economia_raccolte e SET revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;\r\n RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),\r\n 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;\r\n$function$\n",
    "security_definer": true,
    "nuovo_corpo": "\nDECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; a jsonb; k text; x jsonb; rid uuid; n integer; q numeric; pr numeric; seen uuid[]:=ARRAY[]::uuid[]; changed uuid[]:=ARRAY[]::uuid[]; oldrow public.economia_righe%rowtype; srcrow public.economia_sorgenti%rowtype; typ text; det jsonb;\nBEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;\n v_user := artecna_guardie.utente_jwt_corrente();\n IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;\n PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;\n PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;\n SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;\n IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;\n IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;\n IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;\n IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(key) WHERE z.key NOT IN ('righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload Economia non valido'; END IF;\n FOREACH k IN ARRAY ARRAY['righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino'] LOOP\n  IF p_payload ? k AND jsonb_typeof(p_payload->k)<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni richiedono array'; END IF;\n END LOOP;\n SET CONSTRAINTS public.economia_righe_ordine_unique DEFERRED;\n -- Sorgenti nuove: ID esplicito consente riferimenti nel medesimo payload.\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'sorgenti_da_aggiungere','[]'::jsonb)) LOOP\n  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','nome_file','formato','file_sha256','snapshot_version','snapshot')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente non valida'; END IF;\n  rid:=(x->>'id')::uuid; IF rid IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID sorgente obbligatorio'; END IF;\n  INSERT INTO public.economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)\n    VALUES(rid,v_r.id,x->>'nome_file',x->>'formato',x->>'file_sha256',coalesce((x->>'snapshot_version')::integer,1),x->'snapshot',v_user);\n END LOOP;\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'righe_da_eliminare','[]'::jsonb)) LOOP\n  IF jsonb_typeof(x)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID riga richiesto'; END IF;\n  rid:=(x #>> '{}')::uuid;\n  IF rid=ANY(changed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione riga ripetuta'; END IF;\n  DELETE FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id;\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\n  changed:=array_append(changed,rid);\n END LOOP;\n -- Modifiche esplicite: contenuto completo della sola riga indicata, provenienza immutabile.\n FOREACH k IN ARRAY ARRAY['righe_da_modificare','righe_da_creare'] LOOP\n  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) LOOP\n   IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente','tipo_riga','dettagli_analitici')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non valida'; END IF;\n   q:=(x->>'quantita')::numeric; pr:=(x->>'prezzo_unitario')::numeric;\n   IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') OR q<>round(q,6)\n     OR (pr IS NOT NULL AND (pr<0 OR pr::text IN ('NaN','Infinity','-Infinity') OR pr<>round(pr,6))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione o valore numerico non valido'; END IF;\n   rid:=(x->>'id')::uuid;\n   IF k='righe_da_modificare' THEN\n    IF rid IS NULL OR rid=ANY(changed) OR x ? 'origine' OR x ? 'sorgente_id' OR x ? 'indice_voce_sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica riga/provenienza non valida'; END IF;\n    SELECT l.* INTO oldrow FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id FOR UPDATE;\n    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\n    typ:=CASE WHEN x ? 'tipo_riga' THEN x->>'tipo_riga' ELSE oldrow.tipo_riga END;\n    IF typ IS DISTINCT FROM oldrow.tipo_riga THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo riga immutabile'; END IF;\n    det:=CASE WHEN x ? 'dettagli_analitici' THEN nullif(x->'dettagli_analitici','null'::jsonb) ELSE oldrow.dettagli_analitici END;\n    IF typ<>'generica' AND det->'sorgente' IS DISTINCT FROM oldrow.dettagli_analitici->'sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza analitica immutabile'; END IF;\n    IF typ<>'generica' AND NOT (x ? 'dettagli_analitici') AND (q IS DISTINCT FROM oldrow.quantita OR pr IS DISTINCT FROM oldrow.prezzo_unitario) THEN\n      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica economica analitica richiede dettagli aggiornati'; END IF;\n    srcrow:=NULL;\n    IF typ<>'generica' THEN\n      SELECT s.* INTO srcrow FROM public.economia_sorgenti s WHERE s.id=oldrow.sorgente_id AND s.raccolta_id=v_r.id;\n      IF NOT FOUND OR srcrow.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica assente'; END IF;\n    END IF;\n    det:=public.economia_valida_dettagli(typ,det,srcrow.snapshot,srcrow.snapshot_version,oldrow.indice_voce_sorgente,q,pr,x->>'unita_misura',x->>'descrizione',false);\n    UPDATE public.economia_righe l SET tipo_riga=typ,dettagli_analitici=det,ordine=(x->>'ordine')::integer,descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,prezzo_unitario=pr,note=x->>'note',updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;\n    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\n   ELSE\n    IF rid IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID nuova riga assegnato dal server'; END IF;\n    typ:=CASE WHEN x ? 'tipo_riga' THEN x->>'tipo_riga' ELSE 'generica' END;\n    det:=nullif(x->'dettagli_analitici','null'::jsonb);\n    srcrow:=NULL;\n    IF typ<>'generica' THEN\n      IF x->>'origine' IS DISTINCT FROM 'file' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Origine analitica deve essere file'; END IF;\n      SELECT s.* INTO srcrow FROM public.economia_sorgenti s WHERE s.id=(x->>'sorgente_id')::uuid AND s.raccolta_id=v_r.id;\n      IF NOT FOUND OR srcrow.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica assente'; END IF;\n    END IF;\n    det:=public.economia_valida_dettagli(typ,det,srcrow.snapshot,srcrow.snapshot_version,(x->>'indice_voce_sorgente')::integer,q,pr,x->>'unita_misura',x->>'descrizione',false);\n    INSERT INTO public.economia_righe(tipo_riga,dettagli_analitici,raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,sorgente_id,indice_voce_sorgente,created_by)\n      VALUES(typ,det,v_r.id,(x->>'ordine')::integer,x->>'descrizione',x->>'unita_misura',q,pr,x->>'note',x->>'origine',(x->>'sorgente_id')::uuid,(x->>'indice_voce_sorgente')::integer,v_user) RETURNING id INTO rid;\n   END IF;\n   changed:=array_append(changed,rid);\n  END LOOP;\n END LOOP;\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'riordino','[]'::jsonb)) LOOP\n  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino non valido'; END IF;\n  rid:=(x->>'id')::uuid; IF rid IS NULL OR rid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino ripetuto'; END IF;\n  UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF; seen:=array_append(seen,rid);\n END LOOP;\n SET CONSTRAINTS public.economia_righe_ordine_unique IMMEDIATE;\n UPDATE public.economia_raccolte e SET revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;\n RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),\n 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;\n"
  }
]$baseline$::jsonb;
  v_item jsonb;
  v_prima pg_catalog.pg_proc%ROWTYPE;
  v_dopo pg_catalog.pg_proc%ROWTYPE;
  v_snapshot jsonb := '{}'::jsonb;
  v_members_before jsonb;
  v_members_after jsonb;
  v_self_before pg_catalog.pg_auth_members%ROWTYPE;
  v_has_self boolean;
  v_temp_set boolean := false;
  v_temp_create boolean := false;
  v_role oid;
  v_admin oid;
  v_schema_acl aclitem[];
  v_corpo text;
  v_nuovo text;
  v_ddl text;
  v_delimiter text;
  v_pos integer;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  v_role := pg_catalog.to_regrole('artecna_economia_rpc');
  v_admin := pg_catalog.to_regrole('postgres');
  IF v_role IS NULL OR jsonb_array_length(v_baseline) <> 2 THEN
    RAISE EXCEPTION 'Ruolo/baseline Economia assente';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(am) ORDER BY am.roleid,am.member,am.grantor),'[]'::jsonb)
    INTO v_members_before FROM pg_catalog.pg_auth_members am;
  SELECT am.* INTO v_self_before FROM pg_catalog.pg_auth_members am
    WHERE am.roleid=v_role AND am.member=v_admin AND am.grantor=v_admin;
  v_has_self := FOUND;
  SELECT ns.nspacl INTO STRICT v_schema_acl FROM pg_catalog.pg_namespace ns WHERE ns.nspname='public';

  -- Preflight completo di entrambe le funzioni PRIMA di qualsiasi patch.
  FOR v_item IN SELECT jf.value FROM jsonb_array_elements(v_baseline) jf LOOP
    IF v_item->>'firma' NOT IN ('chiudi_raccolta_economia(uuid,bigint)',
                             'salva_bozza_economia(uuid,bigint,jsonb)')
       OR v_snapshot ? (v_item->>'firma') THEN
      RAISE EXCEPTION 'Firma baseline inattesa/duplicata';
    END IF;
    SELECT pf.* INTO v_prima FROM pg_catalog.pg_proc pf
      WHERE pf.oid=pg_catalog.to_regprocedure('public.'||(v_item->>'firma'));
    IF NOT FOUND THEN RAISE EXCEPTION 'RPC assente: %',v_item->>'firma'; END IF;
    IF v_prima.proowner IS DISTINCT FROM v_role OR v_item->>'owner' <> 'artecna_economia_rpc'
       OR v_prima.prokind <> 'f' OR v_prima.prorettype <> 'jsonb'::regtype
       OR v_prima.prolang <> (SELECT pl.oid FROM pg_catalog.pg_language pl WHERE pl.lanname='plpgsql')
       OR v_prima.prosecdef IS DISTINCT FROM (v_item->>'security_definer')::boolean
       OR NOT v_prima.prosecdef OR v_prima.provolatile <> 'v'
       OR v_prima.provolatile::text IS DISTINCT FROM v_item->>'volatility'
       OR to_jsonb(v_prima.proconfig) IS DISTINCT FROM v_item->'proconfig'
       OR v_prima.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
       OR (SELECT jsonb_agg(ac.value ORDER BY ac.value::text) FROM unnest(v_prima.proacl) ac(value))
          IS DISTINCT FROM (SELECT jsonb_agg(ba.value ORDER BY ba.value) FROM jsonb_array_elements_text(v_item->'acl') ba(value))
       OR NOT pg_catalog.has_function_privilege(v_role,v_prima.oid,'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('authenticated',v_prima.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Attributi/owner/ACL divergenti: %',v_item->>'firma';
    END IF;
    IF replace(pg_catalog.pg_get_functiondef(v_prima.oid),chr(13)||chr(10),chr(10))
         IS DISTINCT FROM replace(v_item->>'definizione',chr(13)||chr(10),chr(10)) THEN
      RAISE EXCEPTION 'Definizione installata divergente: %',v_item->>'firma';
    END IF;
    v_corpo := split_part(v_item->>'definizione','$function$',2);
    IF replace(v_prima.prosrc,chr(13)||chr(10),chr(10))
         IS DISTINCT FROM replace(v_corpo,chr(13)||chr(10),chr(10))
 THEN
      RAISE EXCEPTION 'Corpo/RAISE applicativo divergente: %',v_item->>'firma';
    END IF;
    v_snapshot := v_snapshot || jsonb_build_object(v_item->>'firma',to_jsonb(v_prima));
  END LOOP;

  -- Non si concede ADMIN. Si preserva anche un eventuale grant preesistente del medesimo grantor.
  IF NOT pg_catalog.pg_has_role(v_admin,v_role,'SET') THEN
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members am
                  WHERE am.roleid=v_role AND am.member=v_admin AND am.admin_option) THEN
      RAISE EXCEPTION 'ADMIN preesistente necessario al grant temporaneo assente';
    END IF;
    IF v_has_self THEN
      GRANT artecna_economia_rpc TO postgres WITH INHERIT FALSE, SET TRUE;
    ELSE
      GRANT artecna_economia_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
    END IF;
    v_temp_set := true;
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members am
                  WHERE am.roleid=v_role AND am.member=v_admin AND am.grantor=v_admin AND am.set_option) THEN
      RAISE EXCEPTION 'Grantor/SET temporaneo inatteso';
    END IF;
  END IF;
  IF NOT pg_catalog.has_schema_privilege(v_role,'public','CREATE') THEN
    -- Un ACL esplicito consente un ripristino esatto senza scrivere nei cataloghi.
    IF v_schema_acl IS NULL THEN RAISE EXCEPTION 'ACL public implicito inatteso'; END IF;
    GRANT CREATE ON SCHEMA public TO artecna_economia_rpc;
    v_temp_create := true;
  END IF;

  FOR v_item IN SELECT jf.value FROM jsonb_array_elements(v_baseline) jf LOOP
    SELECT pf.* INTO STRICT v_prima FROM pg_catalog.pg_proc pf
      WHERE pf.oid=(v_snapshot->(v_item->>'firma')->>'oid')::oid;
    IF to_jsonb(v_prima) IS DISTINCT FROM v_snapshot->(v_item->>'firma') THEN
      RAISE EXCEPTION 'Funzione cambiata dopo il preflight';
    END IF;
    v_nuovo := v_item->>'nuovo_corpo';
    -- Il wrapper proviene dal DB; si sostituisce esclusivamente il corpo delimitato AS.
    v_ddl := pg_catalog.pg_get_functiondef(v_prima.oid);
    v_delimiter := substring(v_ddl FROM 'AS (\$[A-Za-z_0-9]*\$)');
    IF v_delimiter IS NULL OR strpos(v_nuovo,v_delimiter) <> 0 THEN
      RAISE EXCEPTION 'Delimitatore AS assente/incompatibile';
    END IF;
    v_pos := strpos(v_ddl,'AS '||v_delimiter)+length('AS '||v_delimiter);
    IF substring(v_ddl FROM v_pos FOR length(v_prima.prosrc)) IS DISTINCT FROM v_prima.prosrc
       OR substring(v_ddl FROM v_pos+length(v_prima.prosrc) FOR length(v_delimiter)) <> v_delimiter THEN
      RAISE EXCEPTION 'Wrapper AS non corrispondente al prosrc';
    END IF;
    v_ddl := overlay(v_ddl PLACING v_nuovo FROM v_pos FOR length(v_prima.prosrc));
    EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
    EXECUTE v_ddl;
    EXECUTE 'RESET ROLE';
    SELECT pf.* INTO STRICT v_dopo FROM pg_catalog.pg_proc pf WHERE pf.oid=v_prima.oid;
    IF v_dopo.prosrc IS DISTINCT FROM v_nuovo
       OR (to_jsonb(v_dopo)-'prosrc') IS DISTINCT FROM (to_jsonb(v_prima)-'prosrc')
       OR pg_catalog.to_regprocedure('public.'||(v_item->>'firma'))::oid IS DISTINCT FROM v_prima.oid THEN
      RAISE EXCEPTION 'Post-check corpo/OID/attributi/ACL fallito';
    END IF;
  END LOOP;

  IF v_temp_create THEN REVOKE CREATE ON SCHEMA public FROM artecna_economia_rpc; END IF;
  IF v_temp_set THEN
    IF v_has_self THEN
      EXECUTE format('GRANT artecna_economia_rpc TO postgres WITH INHERIT %s, SET %s',
                     upper(v_self_before.inherit_option::text),upper(v_self_before.set_option::text));
    ELSE
      REVOKE artecna_economia_rpc FROM postgres GRANTED BY postgres;
    END IF;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(am) ORDER BY am.roleid,am.member,am.grantor),'[]'::jsonb)
    INTO v_members_after FROM pg_catalog.pg_auth_members am;
  IF current_user <> 'postgres' OR v_members_after IS DISTINCT FROM v_members_before
     OR (SELECT array_agg(ac.value ORDER BY ac.value::text)
         FROM pg_catalog.pg_namespace ns CROSS JOIN LATERAL unnest(ns.nspacl) ac(value) WHERE ns.nspname='public')
        IS DISTINCT FROM (SELECT array_agg(ac.value ORDER BY ac.value::text) FROM unnest(v_schema_acl) ac(value)) THEN
    RAISE EXCEPTION 'Ripristino membership/ACL schema fallito';
  END IF;
END;
$patch$;
COMMIT;
