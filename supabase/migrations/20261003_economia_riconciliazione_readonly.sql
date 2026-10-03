-- Anteprima di riconciliazione V1. Nessuna modifica a tabelle o RPC Economia.
-- Identificativi UUID verificati sul DB; i riferimenti timbrature NON hanno FK.
BEGIN;
DO $preflight$
DECLARE r record; t oid;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artecna_economia_riconcilia_rpc')
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.proname IN ('riconcilia_proposte_economia','economia_testo_confronto')) THEN
    RAISE EXCEPTION 'Contratto riconciliazione già presente: nessuna sostituzione automatica';
  END IF;
  IF to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
     OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Guardie Economia mancanti';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('rapportini','id'),('rapportini','cantiere_id'),('timbrature','rapportino_id'),
    ('timbrature','operaio_id'),('timbrature','cantiere_id'),('operai','id'),
    ('materiali_cantiere','id'),('materiali_cantiere','cantiere_id'),
    ('economia_righe','id'),('economia_righe','raccolta_id'),
    ('economia_raccolte','id'),('economia_raccolte','cantiere_id')
  ) x(tabella,colonna) LOOP
    SELECT a.atttypid INTO t FROM pg_attribute a
    WHERE a.attrelid=to_regclass('public.'||r.tabella) AND a.attname=r.colonna AND a.attnum>0 AND NOT a.attisdropped;
    IF t IS DISTINCT FROM 'uuid'::regtype::oid THEN RAISE EXCEPTION 'Tipo UUID atteso per %.%',r.tabella,r.colonna; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('rapportini','data'),('rapportini','materiali'),('rapportini','quantita_materiali'),
    ('timbrature','id'),('timbrature','data'),('timbrature','operaio_nome'),('timbrature','ora_entrata'),
    ('timbrature','ora_uscita'),('timbrature','pausa_minuti'),('timbrature','stato'),
    ('operai','nome'),('materiali_cantiere','descrizione'),('materiali_cantiere','quantita'),
    ('materiali_cantiere','prezzo_unitario'),('materiali_cantiere','data_documento'),
    ('economia_righe','tipo_riga'),('economia_righe','dettagli_analitici'),('economia_righe','descrizione'),
    ('economia_righe','unita_misura'),('economia_righe','quantita'),('economia_righe','prezzo_unitario'),
    ('economia_raccolte','numero'),('economia_raccolte','stato'),('economia_raccolte','data')
  ) x(tabella,colonna) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.'||r.tabella)
      AND attname=r.colonna AND attnum>0 AND NOT attisdropped) THEN RAISE EXCEPTION 'Colonna mancante %.%',r.tabella,r.colonna; END IF;
  END LOOP;
END;
$preflight$;

-- Owner dedicato: solo SELECT, nessun privilegio di scrittura o sequenze.
CREATE ROLE artecna_economia_riconcilia_rpc NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA public,artecna_guardie TO artecna_economia_riconcilia_rpc;
GRANT SELECT ON public.rapportini,public.timbrature,public.operai,public.materiali_cantiere,
  public.economia_righe,public.economia_raccolte TO artecna_economia_riconcilia_rpc;
GRANT SELECT(id) ON public.cantieri TO artecna_economia_riconcilia_rpc;
GRANT SELECT(cantiere_id,user_id,ruolo) ON public.utenti_cantiere TO artecna_economia_riconcilia_rpc;
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente(),
  artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO artecna_economia_riconcilia_rpc;

CREATE FUNCTION public.economia_testo_confronto(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp
AS $$ SELECT btrim(regexp_replace(lower(btrim(coalesce(p_text,''))), '[[:space:][:punct:]]+', ' ', 'g')) $$;

CREATE FUNCTION public.riconcilia_proposte_economia(p_cantiere_id uuid,p_proposte jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp
AS $rpc$
DECLARE
  u uuid; p jsonb; other jsonb; result jsonb:='[]'; reasons jsonb; candidates jsonb;
  allowed jsonb; status text; unavailable boolean; typ text; dt date; op uuid; rap uuid; mat uuid;
  name text; descr text; start_time text; end_time text; q numeric; k text; r record;
  count_candidates integer; diff jsonb; same_identity boolean; declared_ok boolean; found_prestazione boolean;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  IF u IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato';
  END IF;
  IF p_proposte IS NULL OR jsonb_typeof(p_proposte)<>'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Atteso array di massimo 100 proposte';
  END IF;
  IF jsonb_array_length(p_proposte)>100 OR octet_length(p_proposte::text)>1048576 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload riconciliazione oltre i limiti';
  END IF;
  -- Validazione dell'intero contratto prima del confronto; nessun cast UUID presunto.
  FOR p IN SELECT value FROM jsonb_array_elements(p_proposte) LOOP
    IF jsonb_typeof(p)<>'object' OR jsonb_typeof(p->'proposta_id') IS DISTINCT FROM 'string'
       OR coalesce(btrim(p->>'proposta_id'),'')='' OR length(p->>'proposta_id')>100
       OR NOT (p ?& ARRAY['tipo_riga','acquisizione'])
       OR coalesce(p->>'tipo_riga','') NOT IN ('manodopera','materiale')
       OR coalesce(p->>'acquisizione','') NOT IN ('file','manuale') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità proposta non valida';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) x WHERE x NOT IN
      ('proposta_id','tipo_riga','acquisizione','data','operaio_id','operaio_nome','ora_inizio','ora_fine',
       'pausa_min','ore','tariffa','rapportino_id','descrizione','unita_misura','quantita','prezzo',
       'materiale_cantiere_id','riferimento_rapportino','riferimenti_sorgente')) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo proposta non ammesso';
    END IF;
    FOREACH k IN ARRAY ARRAY['data','operaio_nome','ora_inizio','ora_fine','descrizione','unita_misura','riferimento_rapportino'] LOOP
      IF p ? k AND p->k <> 'null'::jsonb AND jsonb_typeof(p->k)<>'string' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo testuale proposta non valido';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['operaio_id','rapportino_id','materiale_cantiere_id'] LOOP
      IF p ? k AND p->k <> 'null'::jsonb THEN
        IF jsonb_typeof(p->k)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identificativo proposta non valido'; END IF;
        BEGIN PERFORM (p->>k)::uuid;
        EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID proposta non valido'; END;
      END IF;
    END LOOP;
    IF p->>'data' IS NOT NULL THEN
      BEGIN
        IF p->>'data' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR ((p->>'data')::date)::text <> p->>'data' THEN RAISE EXCEPTION 'Data non valida'; END IF;
      EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Data proposta non valida'; END;
    END IF;
    FOREACH k IN ARRAY ARRAY['ora_inizio','ora_fine'] LOOP
      IF p->>k IS NOT NULL AND p->>k !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Orario proposta non valido';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['pausa_min','ore','tariffa','quantita','prezzo'] LOOP
      IF p ? k AND p->k <> 'null'::jsonb THEN
        IF jsonb_typeof(p->k)<>'number' OR (p->>k)::numeric<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Numero proposta non valido'; END IF;
        IF k='pausa_min' AND trunc((p->>k)::numeric)<>(p->>k)::numeric THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Pausa proposta non intera'; END IF;
      END IF;
    END LOOP;
    IF p ? 'riferimenti_sorgente' AND p->'riferimenti_sorgente'<>'null'::jsonb AND jsonb_typeof(p->'riferimenti_sorgente')<>'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riferimenti sorgente non validi';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_proposte) x GROUP BY x->>'proposta_id' HAVING count(*)>1) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='proposta_id duplicato';
  END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(p_proposte) LOOP
    reasons:='[]'; candidates:='[]'; unavailable:=false; count_candidates:=0;
    typ:=p->>'tipo_riga'; dt:=(p->>'data')::date; op:=(p->>'operaio_id')::uuid;
    rap:=(p->>'rapportino_id')::uuid; mat:=(p->>'materiale_cantiere_id')::uuid;
    name:=public.economia_testo_confronto(p->>'operaio_nome'); descr:=public.economia_testo_confronto(p->>'descrizione');
    start_time:=p->>'ora_inizio'; end_time:=p->>'ora_fine'; q:=(p->>CASE WHEN typ='manodopera' THEN 'ore' ELSE 'quantita' END)::numeric;
    BEGIN
      IF dt IS NULL OR q IS NULL OR q<=0 OR
         (typ='manodopera' AND (op IS NULL AND name='' OR start_time IS NULL OR end_time IS NULL OR p->>'pausa_min' IS NULL)) OR
         (typ='materiale' AND (descr='' OR coalesce(btrim(p->>'unita_misura'),'')='')) THEN
        unavailable:=true; reasons:=reasons||jsonb_build_array('dati_proposta_insufficienti');
      END IF;
      IF typ='manodopera' AND start_time IS NOT NULL AND end_time IS NOT NULL THEN
        IF end_time<=start_time OR (p->>'pausa_min')::numeric >= extract(epoch FROM(end_time::time-start_time::time))/60 THEN
          unavailable:=true; reasons:=reasons||jsonb_build_array('intervallo_proposta_non_valido');
        ELSIF q IS NOT NULL AND abs(q-(extract(epoch FROM(end_time::time-start_time::time))/60-(p->>'pausa_min')::numeric)/60)>0.005 THEN
          reasons:=reasons||jsonb_build_array('ore_proposta_discordanti');
        END IF;
      END IF;
      IF op IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.operai WHERE id=op) THEN
        unavailable:=true; reasons:=reasons||jsonb_build_array('operaio_id_non_esistente');
      ELSIF op IS NOT NULL THEN
        SELECT public.economia_testo_confronto(nome) INTO k FROM public.operai WHERE id=op;
        IF name<>'' AND name<>k THEN reasons:=reasons||jsonb_build_array('operaio_nome_id_discordanti'); END IF;
        name:=k;
      ELSIF typ='manodopera' AND op IS NULL AND name<>'' THEN
        reasons:=reasons||jsonb_build_array('operaio_identita_non_strutturata');
        IF (SELECT count(*) FROM public.operai WHERE public.economia_testo_confronto(nome)=name)<>1 THEN
          reasons:=reasons||jsonb_build_array('operaio_identita_ambigua');
        END IF;
      END IF;
      declared_ok:=rap IS NULL OR EXISTS(SELECT 1 FROM public.rapportini WHERE id=rap AND cantiere_id=p_cantiere_id);
      IF NOT declared_ok THEN unavailable:=true; reasons:=reasons||jsonb_build_array('rapportino_assente_o_fuori_cantiere'); END IF;
      IF mat IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.materiali_cantiere WHERE id=mat AND cantiere_id=p_cantiere_id) THEN
        unavailable:=true; reasons:=reasons||jsonb_build_array('materiale_assente_o_fuori_cantiere');
      END IF;
      IF typ='manodopera' THEN
        found_prestazione:=false;
        FOR r IN
          SELECT t.id,t.rapportino_id,t.operaio_id,t.operaio_nome,t.data,t.ora_entrata,t.ora_uscita,t.pausa_minuti,t.stato,
            EXISTS(SELECT 1 FROM public.rapportini rr WHERE rr.id=t.rapportino_id AND rr.cantiere_id=p_cantiere_id AND rr.data::text=t.data::text) AS rapportino_coerente,
            EXISTS(SELECT 1 FROM public.operai oo WHERE oo.id=t.operaio_id) AS operaio_esistente
          FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id
            AND (t.data::text=dt::text OR (rap IS NOT NULL AND declared_ok AND t.rapportino_id=rap))
            AND ((op IS NOT NULL AND t.operaio_id=op) OR
                 (name<>'' AND public.economia_testo_confronto(t.operaio_nome)=name AND (op IS NULL OR t.operaio_id IS NULL)))
          ORDER BY t.data,t.id
        LOOP
          diff:='[]'; count_candidates:=count_candidates+1;
          IF r.rapportino_id IS NOT NULL AND NOT r.rapportino_coerente OR r.operaio_id IS NOT NULL AND NOT r.operaio_esistente THEN
            unavailable:=true; reasons:=reasons||jsonb_build_array('riferimenti_timbratura_incoerenti');
          END IF;
          IF r.rapportino_id IS NOT NULL AND r.rapportino_coerente THEN
            found_prestazione:=true; reasons:=reasons||jsonb_build_array('prestazione_presente_rapportino_non_riconciliata');
          ELSE reasons:=reasons||jsonb_build_array('prestazione_simile_timbratura'); END IF;
          IF op IS NULL OR r.operaio_id IS NULL THEN reasons:=reasons||jsonb_build_array('operaio_identita_ambigua'); END IF;
          IF r.ora_entrata::text IS DISTINCT FROM start_time THEN diff:=diff||jsonb_build_array('ora_inizio'); END IF;
          IF r.ora_uscita::text IS DISTINCT FROM end_time THEN diff:=diff||jsonb_build_array('ora_fine'); END IF;
          IF r.pausa_minuti::text IS DISTINCT FROM p->>'pausa_min' THEN diff:=diff||jsonb_build_array('pausa_min'); END IF;
          IF r.data::text IS DISTINCT FROM dt::text THEN diff:=diff||jsonb_build_array('data'); END IF;
          IF r.ora_entrata::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND r.ora_uscita::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             AND start_time IS NOT NULL AND end_time IS NOT NULL AND r.ora_entrata::text<end_time AND r.ora_uscita::text>start_time THEN
            reasons:=reasons||jsonb_build_array('intervallo_sovrapposto');
          END IF;
          IF diff<>'[]'::jsonb THEN reasons:=reasons||jsonb_build_array('dati_prestazione_discordanti'); END IF;
          IF count_candidates<=50 THEN candidates:=candidates||jsonb_build_array(jsonb_build_object(
            'tipo_sorgente','timbratura','id',r.id,'data',r.data,'campi',jsonb_build_object('rapportino_id',r.rapportino_id,
              'operaio_id',r.operaio_id,'operaio_nome',r.operaio_nome,'ora_inizio',r.ora_entrata,'ora_fine',r.ora_uscita,
              'pausa_min',r.pausa_minuti,'stato',r.stato),'differenze',diff)); END IF;
        END LOOP;
        IF rap IS NOT NULL AND declared_ok AND NOT found_prestazione THEN
          unavailable:=true; reasons:=reasons||jsonb_build_array('prestazione_rapportino_non_verificabile');
        END IF;
        -- Anche il solo Rapportino aggregato può segnalare un rischio: mai prova di identità.
        FOR r IN SELECT id,data,operai,ore FROM public.rapportini WHERE cantiere_id=p_cantiere_id
          AND (data::text=dt::text OR (declared_ok AND id=rap))
          AND (id=rap OR (name<>'' AND position(name IN public.economia_testo_confronto(operai))>0)) ORDER BY data,id LOOP
          reasons:=reasons||jsonb_build_array('operaio_identita_ambigua'); count_candidates:=count_candidates+1;
          IF count_candidates<=50 THEN candidates:=candidates||jsonb_build_array(jsonb_build_object('tipo_sorgente','rapportino','id',r.id,
            'data',r.data,'campi',jsonb_build_object('operai',r.operai,'ore_aggregate',r.ore),'differenze',jsonb_build_array('identita_non_strutturata'))); END IF;
        END LOOP;
      ELSE
        FOR r IN SELECT id,data,materiali,quantita_materiali FROM public.rapportini WHERE cantiere_id=p_cantiere_id
          AND (data::text=dt::text OR (declared_ok AND id=rap))
          AND (id=rap OR (descr<>'' AND (position(descr IN public.economia_testo_confronto(materiali))>0 OR
            (public.economia_testo_confronto(materiali)<>'' AND position(public.economia_testo_confronto(materiali) IN descr)>0)))) ORDER BY data,id LOOP
          reasons:=reasons||jsonb_build_array('materiale_simile_rapportino'); count_candidates:=count_candidates+1;
          IF count_candidates<=50 THEN candidates:=candidates||jsonb_build_array(jsonb_build_object('tipo_sorgente','rapportino','id',r.id,'data',r.data,
            'campi',jsonb_build_object('materiali',r.materiali,'quantita_materiali',r.quantita_materiali),'differenze',jsonb_build_array('materiali_non_strutturati'))); END IF;
        END LOOP;
        FOR r IN SELECT id,data_documento,descrizione,quantita,prezzo_unitario FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere_id
          AND (id=mat OR (data_documento::text=dt::text AND descr<>'' AND
            (position(descr IN public.economia_testo_confronto(descrizione))>0 OR
            (public.economia_testo_confronto(descrizione)<>'' AND position(public.economia_testo_confronto(descrizione) IN descr)>0)))) ORDER BY data_documento,id LOOP
          diff:='[]'; IF r.quantita::numeric IS DISTINCT FROM q THEN diff:=diff||jsonb_build_array('quantita'); END IF;
          reasons:=reasons||jsonb_build_array('materiale_simile_cantiere'); count_candidates:=count_candidates+1;
          IF count_candidates<=50 THEN candidates:=candidates||jsonb_build_array(jsonb_build_object('tipo_sorgente','materiale_cantiere','id',r.id,'data',r.data_documento,
            'campi',jsonb_build_object('descrizione',r.descrizione,'quantita',r.quantita,'prezzo_unitario',r.prezzo_unitario),'differenze',diff)); END IF;
        END LOOP;
      END IF;
      FOR r IN SELECT e.id,e.raccolta_id,e.tipo_riga,e.descrizione,e.unita_misura,e.quantita,e.prezzo_unitario,
        e.dettagli_analitici->'operativo' AS operativo,c.numero,c.stato,
        coalesce(e.dettagli_analitici->'operativo'->>'data',c.data::text) AS data_riga
        FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id WHERE c.cantiere_id=p_cantiere_id
          AND coalesce(e.dettagli_analitici->'operativo'->>'data',c.data::text)=dt::text
          AND (e.tipo_riga=typ OR e.tipo_riga='generica')
          AND ((typ='manodopera' AND ((name<>'' AND public.economia_testo_confronto(e.dettagli_analitici->'operativo'->>'operaio')=name)
            OR (name<>'' AND position(name IN public.economia_testo_confronto(e.descrizione))>0)))
            OR (typ='materiale' AND descr<>'' AND (position(descr IN public.economia_testo_confronto(e.descrizione))>0 OR
              (public.economia_testo_confronto(e.descrizione)<>'' AND position(public.economia_testo_confronto(e.descrizione) IN descr)>0)))) ORDER BY c.numero,e.ordine LOOP
        diff:='[]'; IF r.quantita IS DISTINCT FROM q THEN diff:=diff||jsonb_build_array(CASE WHEN typ='manodopera' THEN 'ore' ELSE 'quantita' END); END IF;
        reasons:=reasons||jsonb_build_array(CASE WHEN typ='manodopera' THEN 'prestazione_simile_economia' ELSE 'materiale_simile_economia' END);
        count_candidates:=count_candidates+1;
        IF count_candidates<=50 THEN candidates:=candidates||jsonb_build_array(jsonb_build_object('tipo_sorgente','economia_riga','id',r.id,'data',r.data_riga,
          'campi',jsonb_build_object('raccolta_id',r.raccolta_id,'numero',r.numero,'stato',r.stato,'descrizione',r.descrizione,
            'unita_misura',r.unita_misura,'quantita',r.quantita,'prezzo_unitario',r.prezzo_unitario,'operativo',r.operativo),'differenze',diff)); END IF;
      END LOOP;
      FOR other IN SELECT value FROM jsonb_array_elements(p_proposte) WHERE value->>'proposta_id'<>p->>'proposta_id'
        AND value->>'tipo_riga'=typ AND (value->>'data'=p->>'data'
          OR (rap IS NOT NULL AND (value->>'rapportino_id')::uuid=rap)) LOOP
        same_identity:=false;
        IF typ='manodopera' THEN
          same_identity:=CASE WHEN op IS NOT NULL AND other->>'operaio_id' IS NOT NULL THEN op=(other->>'operaio_id')::uuid
            ELSE name<>'' AND public.economia_testo_confronto(other->>'operaio_nome')=name END;
        ELSE same_identity:=descr<>'' AND public.economia_testo_confronto(other->>'descrizione')=descr; END IF;
        IF same_identity THEN
          reasons:=reasons||jsonb_build_array('proposta_duplicata_nel_payload'); count_candidates:=count_candidates+1;
          IF count_candidates<=50 THEN candidates:=candidates||jsonb_build_array(jsonb_build_object('tipo_sorgente','proposta','id',other->>'proposta_id','data',other->>'data',
            'campi',other-'riferimenti_sorgente','differenze',jsonb_build_array('verificare_registrazione_distinta'))); END IF;
        END IF;
      END LOOP;
    EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column OR invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN
      unavailable:=true; reasons:=reasons||jsonb_build_array('lettura_o_dati_sorgente_non_disponibili');
    END;
    IF count_candidates>50 THEN reasons:=reasons||jsonb_build_array('candidati_troncati'); END IF;
    reasons:=coalesce((SELECT jsonb_agg(v ORDER BY v::text) FROM (SELECT DISTINCT value v FROM jsonb_array_elements(reasons)) x),'[]'::jsonb);
    -- Non esiste ancora identità persistente della prestazione in Economia.
    -- gia_registrato è riservato al contratto futuro: mai dedotto dal testo.
    status:=CASE WHEN unavailable THEN 'verifica_non_disponibile' WHEN reasons<>'[]'::jsonb THEN 'possibile_duplicato' ELSE 'nuovo' END;
    allowed:=CASE status WHEN 'nuovo' THEN jsonb_build_array('registrazione_indipendente')
      WHEN 'possibile_duplicato' THEN jsonb_build_array('verifica_esplicita') ELSE '[]'::jsonb END;
    result:=result||jsonb_build_array(jsonb_build_object('proposta_id',p->>'proposta_id','esito',status,'motivi',reasons,
      'candidati',candidates,'provenienza_verificata',NULL,'decisioni_consentite',allowed));
  END LOOP;
  RETURN jsonb_build_object('version',1,'cantiere_id',p_cantiere_id,'risultati',result);
END;
$rpc$;

-- Trasferimento owner senza lasciare membership o CREATE permanenti.
GRANT artecna_economia_riconcilia_rpc TO postgres;
GRANT CREATE ON SCHEMA public TO artecna_economia_riconcilia_rpc;
ALTER FUNCTION public.economia_testo_confronto(text) OWNER TO artecna_economia_riconcilia_rpc;
ALTER FUNCTION public.riconcilia_proposte_economia(uuid,jsonb) OWNER TO artecna_economia_riconcilia_rpc;
REVOKE CREATE ON SCHEMA public FROM artecna_economia_riconcilia_rpc;
REVOKE artecna_economia_riconcilia_rpc FROM postgres;
DO $acl$
DECLARE f record; g record;
BEGIN
  FOR f IN SELECT p.oid,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    AND p.proname IN ('riconcilia_proposte_economia','economia_testo_confronto') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.oid::regprocedure);
    FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=f.oid),acldefault('f',f.proowner)))
      WHERE grantee<>0 AND grantee<>f.proowner LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(g.grantee));
    END LOOP;
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.riconcilia_proposte_economia(uuid,jsonb) TO authenticated;
DO $postcheck$
DECLARE f record; t text;
BEGIN
  SELECT * INTO f FROM pg_proc WHERE oid='public.riconcilia_proposte_economia(uuid,jsonb)'::regprocedure;
  IF f.proowner<>'artecna_economia_riconcilia_rpc'::regrole::oid OR NOT f.prosecdef OR f.provolatile<>'s'
    OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN RAISE EXCEPTION 'Contratto RPC divergente'; END IF;
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',f.oid,'EXECUTE')
     OR has_function_privilege('authenticated','public.economia_testo_confronto(text)','EXECUTE') THEN RAISE EXCEPTION 'ACL RPC divergenti'; END IF;
  FOREACH t IN ARRAY ARRAY['rapportini','timbrature','operai','materiali_cantiere','economia_righe','economia_raccolte'] LOOP
    IF has_table_privilege('artecna_economia_riconcilia_rpc','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'Owner riconciliazione possiede scrittura su %',t;
    END IF;
  END LOOP;
END;
$postcheck$;
COMMIT;
