-- Economia V1: baseline DB fornita dall'utente, nessun file Storage.
-- Unica transazione: tabelle/RPC e ampliamento atomico del perimetro distruttivo.
BEGIN;
DO $migration$
DECLARE
  baseline constant jsonb := $baseline${"default":[{"schema":"public","colonne":[{"nome":"id","tipo":"bigint","default":null,"identity":"a","not_null":true,"generated":"","posizione":1,"numeric_scale":0,"numeric_precision":64},{"nome":"numero_riga","tipo":"integer","default":null,"identity":"","not_null":true,"generated":"","posizione":3,"numeric_scale":0,"numeric_precision":32},{"nome":"quantita_delta","tipo":"numeric(18,6)","default":null,"identity":"","not_null":true,"generated":"","posizione":7,"numeric_scale":6,"numeric_precision":18},{"nome":"prezzo_unitario","tipo":"numeric(18,6)","default":null,"identity":"","not_null":true,"generated":"","posizione":8,"numeric_scale":6,"numeric_precision":18},{"nome":"delta_contratto","tipo":"numeric(18,2)","default":null,"identity":"","not_null":true,"generated":"","posizione":9,"numeric_scale":2,"numeric_precision":18},{"nome":"created_at","tipo":"timestamp with time zone","default":"now()","identity":"","not_null":true,"generated":"","posizione":13,"numeric_scale":null,"numeric_precision":null}],"tabella":"variante_lavorazioni","presente":true},{"schema":"public","colonne":[{"nome":"id","tipo":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":"","posizione":1,"numeric_scale":null,"numeric_precision":null},{"nome":"created_at","tipo":"timestamp with time zone","default":"now()","identity":"","not_null":true,"generated":"","posizione":11,"numeric_scale":null,"numeric_precision":null}],"tabella":"variante_sorgenti","presente":true},{"schema":"public","colonne":[{"nome":"id","tipo":"uuid","default":"gen_random_uuid()","identity":"","not_null":true,"generated":"","posizione":1,"numeric_scale":null,"numeric_precision":null},{"nome":"numero","tipo":"integer","default":null,"identity":"","not_null":false,"generated":"","posizione":4,"numeric_scale":0,"numeric_precision":32},{"nome":"importo_delta_approvato","tipo":"numeric(18,2)","default":null,"identity":"","not_null":false,"generated":"","posizione":9,"numeric_scale":2,"numeric_precision":18},{"nome":"created_at","tipo":"timestamp with time zone","default":"now()","identity":"","not_null":true,"generated":"","posizione":12,"numeric_scale":null,"numeric_precision":null},{"nome":"updated_at","tipo":"timestamp with time zone","default":"now()","identity":"","not_null":true,"generated":"","posizione":13,"numeric_scale":null,"numeric_precision":null}],"tabella":"varianti_cantiere","presente":true}],"distruzione":{"tabelle":[{"rls":false,"nome":"cleanup_storage","owner":"postgres","indici":[{"nome":"cleanup_storage_identita","valid":true,"unique":true,"primary":false,"definition":"CREATE UNIQUE INDEX cleanup_storage_identita ON artecna_distruzione.cleanup_storage USING btree (cantiere_id, bucket, path)"},{"nome":"cleanup_storage_pkey","valid":true,"unique":true,"primary":true,"definition":"CREATE UNIQUE INDEX cleanup_storage_pkey ON artecna_distruzione.cleanup_storage USING btree (id)"}],"schema":"artecna_distruzione","acl_raw":["postgres=arwdDxtm/postgres"],"colonne":[{"nome":"id","tipo":"bigint","acl_raw":null,"default":null,"identity":"a","not_null":true,"generated":"","posizione":1},{"nome":"cantiere_id","tipo":"uuid","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":2},{"nome":"bucket","tipo":"text","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":3},{"nome":"path","tipo":"text","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":4},{"nome":"stato","tipo":"text","acl_raw":null,"default":"'pending'::text","identity":"","not_null":true,"generated":"","posizione":5},{"nome":"tentativi","tipo":"integer","acl_raw":null,"default":"0","identity":"","not_null":true,"generated":"","posizione":6},{"nome":"ultimo_errore","tipo":"text","acl_raw":null,"default":"''::text","identity":"","not_null":true,"generated":"","posizione":7},{"nome":"created_at","tipo":"timestamp with time zone","acl_raw":null,"default":"clock_timestamp()","identity":"","not_null":true,"generated":"","posizione":8},{"nome":"updated_at","tipo":"timestamp with time zone","acl_raw":null,"default":"clock_timestamp()","identity":"","not_null":true,"generated":"","posizione":9},{"nome":"completed_at","tipo":"timestamp with time zone","acl_raw":null,"default":null,"identity":"","not_null":false,"generated":"","posizione":10}],"relkind":"r","presente":true,"force_rls":false,"constraints":[{"nome":"cleanup_storage_bucket_check","tipo":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((btrim(bucket) <> ''::text))"},{"nome":"cleanup_storage_completamento","tipo":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (((stato = 'completed'::text) = (completed_at IS NOT NULL)))"},{"nome":"cleanup_storage_identita","tipo":"u","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (cantiere_id, bucket, path)"},{"nome":"cleanup_storage_path_check","tipo":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((btrim(path) <> ''::text))"},{"nome":"cleanup_storage_pkey","tipo":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"nome":"cleanup_storage_stato_check","tipo":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((stato = ANY (ARRAY['pending'::text, 'failed'::text, 'completed'::text])))"},{"nome":"cleanup_storage_tentativi_check","tipo":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((tentativi >= 0))"}],"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"UPDATE"}]},{"rls":false,"nome":"contesto","owner":"postgres","indici":[{"nome":"contesto_pkey","valid":true,"unique":true,"primary":true,"definition":"CREATE UNIQUE INDEX contesto_pkey ON artecna_distruzione.contesto USING btree (transazione, backend)"}],"schema":"artecna_distruzione","acl_raw":["postgres=arwdDxtm/postgres"],"colonne":[{"nome":"transazione","tipo":"xid8","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":1},{"nome":"backend","tipo":"integer","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":2},{"nome":"cantiere_id","tipo":"uuid","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":3},{"nome":"user_id","tipo":"uuid","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":4},{"nome":"ruolo","tipo":"name","acl_raw":null,"default":null,"identity":"","not_null":true,"generated":"","posizione":5},{"nome":"created_at","tipo":"timestamp with time zone","acl_raw":null,"default":"clock_timestamp()","identity":"","not_null":true,"generated":"","posizione":6}],"relkind":"r","presente":true,"force_rls":false,"constraints":[{"nome":"contesto_pkey","tipo":"p","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (transazione, backend)"},{"nome":"contesto_ruolo_check","tipo":"c","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK ((ruolo = 'artecna_cantieri_delete_rpc'::name))"}],"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"DELETE"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"INSERT"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"MAINTAIN"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"REFERENCES"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"SELECT"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRIGGER"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"TRUNCATE"},{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"UPDATE"}]}],"funzioni":[{"firma":"artecna_distruzione.manifest_cantiere(uuid)","owner":"postgres","prosrc":"\r\n  BEGIN\r\n    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;\r\n    RETURN QUERY\r\n    SELECT q.entita,q.quantita FROM (\r\nSELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL\r\nUNION ALL\r\nSELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL\r\nUNION ALL\r\nSELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL\r\n    ) AS q(entita,quantita) ORDER BY q.entita;\r\n  END;\r\n  ","acl_raw":["postgres=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"TABLE(entita text, quantita bigint)","language":"plpgsql","presente":true,"arguments":"p_cantiere uuid","proconfig":["search_path=pg_catalog, pg_temp","row_security=off"],"definition":"CREATE OR REPLACE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid)\n RETURNS TABLE(entita text, quantita bigint)\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\n SET row_security TO 'off'\nAS $function$\r\n  BEGIN\r\n    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;\r\n    RETURN QUERY\r\n    SELECT q.entita,q.quantita FROM (\r\nSELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere\r\nUNION ALL\r\nSELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL\r\nUNION ALL\r\nSELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL\r\nUNION ALL\r\nSELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL\r\n    ) AS q(entita,quantita) ORDER BY q.entita;\r\n  END;\r\n  $function$\n","volatility":"s","return_type":"record","returns_set":true,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_distruzione.manifest_cantiere(uuid)","security_definer":true},{"firma":"elimina_cantiere_definitivamente(uuid,text)","owner":"artecna_cantieri_delete_rpc","prosrc":"\r\nDECLARE\r\n  v_user uuid;\r\n  v_id uuid;\r\n  v_varianti uuid[];\r\n  v_preventivi text[];\r\n  v_base_lavorazioni bigint[];\r\n  v_var_lavorazioni bigint[];\r\n  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];\r\n  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];\r\n  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere']::text[];\r\n  v_eliminate jsonb := '{}'::jsonb;\r\n  v_n bigint;\r\n  v_totale_lavorazioni bigint;\r\n  v_residuo boolean;\r\n  v_esterna boolean;\r\n  v_on text;\r\n  v_padre text;\r\n  v_figlio text;\r\n  v_sql text;\r\n  v_jobs_prima record;\r\n  v_jobs_vecchi record;\r\n  v_jobs_preparati record;\r\n  v_jobs_dopo record;\r\n  t text;\r\n  fk record;\r\n  m record;\r\nBEGIN\r\n  IF current_user <> 'artecna_cantieri_delete_rpc' THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';\r\n  END IF;\r\n  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';\r\n  END IF;\r\n  v_user := artecna_guardie.utente_jwt_corrente();\r\n  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;\r\n  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';\r\n  END IF;\r\n  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\n  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';\r\n  END IF;\r\n  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\n  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';\r\n  END IF;\r\n  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);\r\n  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';\r\n  END IF;\r\n  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.\r\n  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;\r\n  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\n    IF t='cantieri' THEN CONTINUE; END IF;\r\n    IF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);\r\n    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;\r\n    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti LOOP NULL; END LOOP;\r\n  END LOOP;\r\n  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;\r\n  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;\r\n  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);\r\n  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.\r\n  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.\r\n  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio\r\n    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid\r\n      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace\r\n      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace\r\n    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)\r\n    ORDER BY k.oid\r\n  LOOP\r\n    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN\r\n      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);\r\n    END IF;\r\n    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on\r\n      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)\r\n      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum\r\n      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;\r\n    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';\r\n    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';\r\n    ELSE v_padre:='t.cantiere_id=$1'; END IF;\r\n    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';\r\n    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';\r\n    ELSE v_figlio:='f.cantiere_id=$1'; END IF;\r\n    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);\r\n    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti;\r\n    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;\r\n  END LOOP;\r\n  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;\r\n  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;\r\n  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\n  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);\r\n  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);\r\n  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\n  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta\r\n     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';\r\n  END IF;\r\n  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);\r\n  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);\r\n  v_totale_lavorazioni := 0;\r\n  LOOP\r\n    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)\r\n      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);\r\n    GET DIAGNOSTICS v_n = ROW_COUNT;\r\n    v_totale_lavorazioni := v_totale_lavorazioni + v_n;\r\n    IF v_n=0 THEN\r\n      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN\r\n        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';\r\n      END IF;\r\n      EXIT;\r\n    END IF;\r\n  END LOOP;\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);\r\n  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);\r\n  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);\r\n  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL\r\n    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;\r\n  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);\r\n  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n);\r\n  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);\r\n  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);\r\n  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);\r\n  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);\r\n  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);\r\n  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);\r\n  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);\r\n  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);\r\n  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);\r\n  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);\r\n  -- Post-check dei dati protetti PRIMA di terminare il contesto.\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\n    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;\r\n    IF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);\r\n    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;\r\n    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti;\r\n    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN\r\n      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);\r\n    END IF;\r\n  END LOOP;\r\n  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))\r\n     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))\r\n     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';\r\n  END IF;\r\n  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\n  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';\r\n  END IF;\r\n  PERFORM artecna_distruzione.termina_contesto();\r\n  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;\r\n  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';\r\n  END IF;\r\n  -- Ultima cancellazione applicativa.\r\n  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';\r\n  END IF;\r\n  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\n    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';\r\n    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);\r\n    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;\r\n    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti;\r\n    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;\r\n  END LOOP;\r\n  cantiere_id := p_cantiere_id;\r\n  eliminato := true;\r\n  RETURN NEXT;\r\nEXCEPTION WHEN foreign_key_violation THEN\r\n  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.\r\n  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;\r\nEND;\r\n\r\n  ","acl_raw":["artecna_cantieri_delete_rpc=X/artecna_cantieri_delete_rpc","authenticated=X/artecna_cantieri_delete_rpc"],"prokind":"f","returns":"TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)","language":"plpgsql","presente":true,"arguments":"p_cantiere_id uuid, p_conferma text","proconfig":["search_path=pg_catalog, pg_temp"],"definition":"CREATE OR REPLACE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid, p_conferma text)\n RETURNS TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nDECLARE\r\n  v_user uuid;\r\n  v_id uuid;\r\n  v_varianti uuid[];\r\n  v_preventivi text[];\r\n  v_base_lavorazioni bigint[];\r\n  v_var_lavorazioni bigint[];\r\n  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];\r\n  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];\r\n  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere']::text[];\r\n  v_eliminate jsonb := '{}'::jsonb;\r\n  v_n bigint;\r\n  v_totale_lavorazioni bigint;\r\n  v_residuo boolean;\r\n  v_esterna boolean;\r\n  v_on text;\r\n  v_padre text;\r\n  v_figlio text;\r\n  v_sql text;\r\n  v_jobs_prima record;\r\n  v_jobs_vecchi record;\r\n  v_jobs_preparati record;\r\n  v_jobs_dopo record;\r\n  t text;\r\n  fk record;\r\n  m record;\r\nBEGIN\r\n  IF current_user <> 'artecna_cantieri_delete_rpc' THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';\r\n  END IF;\r\n  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';\r\n  END IF;\r\n  v_user := artecna_guardie.utente_jwt_corrente();\r\n  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;\r\n  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';\r\n  END IF;\r\n  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\n  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';\r\n  END IF;\r\n  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\n  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';\r\n  END IF;\r\n  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);\r\n  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';\r\n  END IF;\r\n  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.\r\n  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;\r\n  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\n    IF t='cantieri' THEN CONTINUE; END IF;\r\n    IF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);\r\n    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;\r\n    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti LOOP NULL; END LOOP;\r\n  END LOOP;\r\n  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;\r\n  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;\r\n  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);\r\n  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.\r\n  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.\r\n  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio\r\n    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid\r\n      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace\r\n      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace\r\n    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)\r\n    ORDER BY k.oid\r\n  LOOP\r\n    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN\r\n      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);\r\n    END IF;\r\n    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on\r\n      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)\r\n      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum\r\n      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;\r\n    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';\r\n    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';\r\n    ELSE v_padre:='t.cantiere_id=$1'; END IF;\r\n    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';\r\n    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';\r\n    ELSE v_figlio:='f.cantiere_id=$1'; END IF;\r\n    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);\r\n    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti;\r\n    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;\r\n  END LOOP;\r\n  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;\r\n  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;\r\n  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\n  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);\r\n  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);\r\n  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\n  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta\r\n     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';\r\n  END IF;\r\n  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);\r\n  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);\r\n  v_totale_lavorazioni := 0;\r\n  LOOP\r\n    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)\r\n      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);\r\n    GET DIAGNOSTICS v_n = ROW_COUNT;\r\n    v_totale_lavorazioni := v_totale_lavorazioni + v_n;\r\n    IF v_n=0 THEN\r\n      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN\r\n        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';\r\n      END IF;\r\n      EXIT;\r\n    END IF;\r\n  END LOOP;\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);\r\n  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);\r\n  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);\r\n  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL\r\n    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;\r\n  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);\r\n  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n);\r\n  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);\r\n  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);\r\n  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);\r\n  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);\r\n  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);\r\n  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);\r\n  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);\r\n  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);\r\n  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);\r\n  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);\r\n  -- Post-check dei dati protetti PRIMA di terminare il contesto.\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\n    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;\r\n    IF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);\r\n    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;\r\n    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti;\r\n    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN\r\n      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);\r\n    END IF;\r\n  END LOOP;\r\n  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))\r\n     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))\r\n     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';\r\n  END IF;\r\n  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\n  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';\r\n  END IF;\r\n  PERFORM artecna_distruzione.termina_contesto();\r\n  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;\r\n  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';\r\n  END IF;\r\n  -- Ultima cancellazione applicativa.\r\n  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\n  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';\r\n  END IF;\r\n  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\n    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';\r\n    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);\r\n    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;\r\n    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti;\r\n    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;\r\n  END LOOP;\r\n  cantiere_id := p_cantiere_id;\r\n  eliminato := true;\r\n  RETURN NEXT;\r\nEXCEPTION WHEN foreign_key_violation THEN\r\n  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.\r\n  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;\r\nEND;\r\n\r\n  $function$\n","volatility":"v","return_type":"record","returns_set":true,"acl_effettiva":[{"grantee":"authenticated","grantor":"artecna_cantieri_delete_rpc","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"artecna_cantieri_delete_rpc","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"public.elimina_cantiere_definitivamente(uuid,text)","security_definer":true}]},"autorizzazione":{"ruoli":[{"nome":"artecna_cantieri_delete_rpc","login":false,"config":null,"inherit":false,"createdb":false,"presente":true,"bypassrls":true,"superuser":false,"createrole":false,"membership":[{"role":"artecna_cantieri_delete_rpc","member":"postgres","grantor":"supabase_admin","set_option":false,"admin_option":true,"inherit_option":false}],"replication":false,"valid_until":null,"connection_limit":-1},{"nome":"artecna_cantieri_rpc","login":false,"config":null,"inherit":false,"createdb":false,"presente":true,"bypassrls":true,"superuser":false,"createrole":false,"membership":[{"role":"artecna_cantieri_rpc","member":"postgres","grantor":"supabase_admin","set_option":false,"admin_option":true,"inherit_option":false}],"replication":false,"valid_until":null,"connection_limit":-1},{"nome":"artecna_varianti_rpc","login":false,"config":null,"inherit":false,"createdb":false,"presente":true,"bypassrls":true,"superuser":false,"createrole":false,"membership":[{"role":"artecna_varianti_rpc","member":"postgres","grantor":"supabase_admin","set_option":false,"admin_option":true,"inherit_option":false}],"replication":false,"valid_until":null,"connection_limit":-1}],"funzioni":[{"firma":"artecna_distruzione.contesto_valido(uuid)","owner":"postgres","prosrc":"\r\n    SELECT EXISTS (SELECT 1 FROM artecna_distruzione.contesto c\r\n      WHERE c.transazione=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()\r\n        AND c.cantiere_id=p_cantiere AND c.ruolo='artecna_cantieri_delete_rpc'\r\n        AND c.user_id=artecna_guardie.utente_jwt_corrente()\r\n        AND EXISTS (SELECT 1 FROM public.utenti_cantiere u\r\n          WHERE u.cantiere_id=c.cantiere_id AND u.user_id=c.user_id AND u.ruolo='owner'));\r\n  ","acl_raw":["postgres=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"boolean","language":"sql","presente":true,"arguments":"p_cantiere uuid","proconfig":["search_path=pg_catalog, pg_temp","row_security=off"],"definition":"CREATE OR REPLACE FUNCTION artecna_distruzione.contesto_valido(p_cantiere uuid)\n RETURNS boolean\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\n SET row_security TO 'off'\nAS $function$\r\n    SELECT EXISTS (SELECT 1 FROM artecna_distruzione.contesto c\r\n      WHERE c.transazione=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()\r\n        AND c.cantiere_id=p_cantiere AND c.ruolo='artecna_cantieri_delete_rpc'\r\n        AND c.user_id=artecna_guardie.utente_jwt_corrente()\r\n        AND EXISTS (SELECT 1 FROM public.utenti_cantiere u\r\n          WHERE u.cantiere_id=c.cantiere_id AND u.user_id=c.user_id AND u.ruolo='owner'));\r\n  $function$\n","volatility":"v","return_type":"boolean","returns_set":false,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_distruzione.contesto_valido(uuid)","security_definer":true},{"firma":"artecna_distruzione.contesto_variante_valido(uuid)","owner":"postgres","prosrc":"\r\n  DECLARE c uuid;\r\n  BEGIN\r\n    SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;\r\n    IF NOT FOUND THEN RETURN false; END IF;\r\n    RETURN artecna_distruzione.contesto_valido(c);\r\n  END;\r\n  ","acl_raw":["postgres=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"boolean","language":"plpgsql","presente":true,"arguments":"p_variante uuid","proconfig":["search_path=pg_catalog, pg_temp","row_security=off"],"definition":"CREATE OR REPLACE FUNCTION artecna_distruzione.contesto_variante_valido(p_variante uuid)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\n SET row_security TO 'off'\nAS $function$\r\n  DECLARE c uuid;\r\n  BEGIN\r\n    SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;\r\n    IF NOT FOUND THEN RETURN false; END IF;\r\n    RETURN artecna_distruzione.contesto_valido(c);\r\n  END;\r\n  $function$\n","volatility":"v","return_type":"boolean","returns_set":false,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_distruzione.contesto_variante_valido(uuid)","security_definer":true},{"firma":"artecna_distruzione.inizia_contesto(uuid)","owner":"postgres","prosrc":"\r\n  DECLARE u uuid := artecna_guardie.utente_jwt_corrente();\r\n  BEGIN\r\n    IF u IS NULL OR p_cantiere IS NULL THEN RAISE EXCEPTION 'Identita owner obbligatoria'; END IF;\r\n    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;\r\n    IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;\r\n    PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;\r\n    IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato'; END IF;\r\n    -- Cleanup di residui ormai inutilizzabili dello stesso backend. Nessun dato applicativo.\r\n    DELETE FROM artecna_distruzione.contesto WHERE backend=pg_backend_pid() AND transazione<>pg_current_xact_id();\r\n    INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo)\r\n      VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,u,'artecna_cantieri_delete_rpc');\r\n    -- La PK vieta un secondo target nella stessa transazione/backend.\r\n  END;\r\n  ","acl_raw":["postgres=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"void","language":"plpgsql","presente":true,"arguments":"p_cantiere uuid","proconfig":["search_path=pg_catalog, pg_temp","row_security=off"],"definition":"CREATE OR REPLACE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\n SET row_security TO 'off'\nAS $function$\r\n  DECLARE u uuid := artecna_guardie.utente_jwt_corrente();\r\n  BEGIN\r\n    IF u IS NULL OR p_cantiere IS NULL THEN RAISE EXCEPTION 'Identita owner obbligatoria'; END IF;\r\n    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;\r\n    IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;\r\n    PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;\r\n    IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato'; END IF;\r\n    -- Cleanup di residui ormai inutilizzabili dello stesso backend. Nessun dato applicativo.\r\n    DELETE FROM artecna_distruzione.contesto WHERE backend=pg_backend_pid() AND transazione<>pg_current_xact_id();\r\n    INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo)\r\n      VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,u,'artecna_cantieri_delete_rpc');\r\n    -- La PK vieta un secondo target nella stessa transazione/backend.\r\n  END;\r\n  $function$\n","volatility":"v","return_type":"void","returns_set":false,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_distruzione.inizia_contesto(uuid)","security_definer":true},{"firma":"artecna_distruzione.termina_contesto()","owner":"postgres","prosrc":"\r\n    DELETE FROM artecna_distruzione.contesto\r\n      WHERE transazione=pg_current_xact_id_if_assigned() AND backend=pg_backend_pid()\r\n        AND user_id=artecna_guardie.utente_jwt_corrente();\r\n  ","acl_raw":["postgres=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"void","language":"sql","presente":true,"arguments":"","proconfig":["search_path=pg_catalog, pg_temp","row_security=off"],"definition":"CREATE OR REPLACE FUNCTION artecna_distruzione.termina_contesto()\n RETURNS void\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\n SET row_security TO 'off'\nAS $function$\r\n    DELETE FROM artecna_distruzione.contesto\r\n      WHERE transazione=pg_current_xact_id_if_assigned() AND backend=pg_backend_pid()\r\n        AND user_id=artecna_guardie.utente_jwt_corrente();\r\n  $function$\n","volatility":"v","return_type":"void","returns_set":false,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_distruzione.termina_contesto()","security_definer":true},{"firma":"artecna_guardie.utente_jwt_corrente()","owner":"postgres","prosrc":"\n  select \n  coalesce(\n    nullif(current_setting('request.jwt.claim.sub', true), ''),\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')\n  )::uuid\n","acl_raw":["postgres=X/postgres","artecna_sal_rpc=X/postgres","artecna_varianti_rpc=X/postgres","artecna_preventivi_rpc=X/postgres","artecna_cantieri_rpc=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"uuid","language":"sql","presente":true,"arguments":"","proconfig":["search_path=pg_catalog, pg_temp"],"definition":"CREATE OR REPLACE FUNCTION artecna_guardie.utente_jwt_corrente()\n RETURNS uuid\n LANGUAGE sql\n STABLE\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\n  select \n  coalesce(\n    nullif(current_setting('request.jwt.claim.sub', true), ''),\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')\n  )::uuid\n$function$\n","volatility":"s","return_type":"uuid","returns_set":false,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_varianti_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_sal_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_preventivi_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_guardie.utente_jwt_corrente()","security_definer":false},{"firma":"artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)","owner":"postgres","prosrc":"\r\n            SELECT EXISTS (\r\n                SELECT 1\r\n                FROM public.utenti_cantiere AS u\r\n                WHERE p_user_id IS NOT NULL\r\n                  AND p_cantiere_id IS NOT NULL\r\n                  AND u.user_id = p_user_id\r\n                  AND u.cantiere_id = p_cantiere_id\r\n                  AND u.ruolo = 'owner'\r\n            )\r\n        ","acl_raw":["postgres=X/postgres","artecna_sal_rpc=X/postgres","artecna_varianti_rpc=X/postgres","artecna_preventivi_rpc=X/postgres","artecna_cantieri_delete_rpc=X/postgres"],"prokind":"f","returns":"boolean","language":"sql","presente":true,"arguments":"p_user_id uuid, p_cantiere_id uuid","proconfig":["search_path=pg_catalog, pg_temp"],"definition":"CREATE OR REPLACE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(p_user_id uuid, p_cantiere_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\n            SELECT EXISTS (\r\n                SELECT 1\r\n                FROM public.utenti_cantiere AS u\r\n                WHERE p_user_id IS NOT NULL\r\n                  AND p_cantiere_id IS NOT NULL\r\n                  AND u.user_id = p_user_id\r\n                  AND u.cantiere_id = p_cantiere_id\r\n                  AND u.ruolo = 'owner'\r\n            )\r\n        $function$\n","volatility":"s","return_type":"boolean","returns_set":false,"acl_effettiva":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_varianti_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_sal_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_preventivi_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilege":"EXECUTE"}],"firma_richiesta":"artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)","security_definer":false}]}}$baseline$::jsonb;
  r record; p record; q record; j jsonb; attuale jsonb; expected jsonb;
  src text; nuovo text; ddl text; ruolo text; funzione text;
  v_procs jsonb; v_triggers jsonb; v_private jsonb; v_members jsonb;
  v_oldroles jsonb; v_expected_sources jsonb := '{}'::jsonb;
  v_rpcdefs jsonb := '{}'::jsonb;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Installazione prevista come postgres su PostgreSQL 17';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='artecna_economia_rpc') THEN
    RAISE EXCEPTION 'Ruolo Economia gia presente';
  END IF;
  FOR r IN SELECT unnest(ARRAY['economia_raccolte','economia_sorgenti','economia_righe']) AS nome LOOP
    IF to_regclass('public.'||r.nome) IS NOT NULL OR to_regtype('public.'||r.nome) IS NOT NULL THEN RAISE EXCEPTION 'Collisione relazione %',r.nome; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc pf JOIN pg_catalog.pg_namespace ns ON ns.oid=pf.pronamespace
    WHERE ns.nspname='public' AND pf.proname IN ('crea_raccolta_economia','leggi_raccolte_economia','leggi_raccolta_economia','salva_bozza_economia','chiudi_raccolta_economia')) THEN
    RAISE EXCEPTION 'Collisione RPC Economia';
  END IF;
  FOR j IN SELECT value FROM jsonb_array_elements((baseline->'distruzione'->'funzioni') || (baseline->'autorizzazione'->'funzioni')) LOOP
    SELECT pf.* INTO p FROM pg_catalog.pg_proc pf WHERE pf.oid=to_regprocedure(j->>'firma_richiesta');
    IF NOT FOUND THEN RAISE EXCEPTION 'Funzione baseline assente %',j->>'firma_richiesta'; END IF;
    FOREACH src IN ARRAY ARRAY[p.prosrc,j->>'prosrc'] LOOP
      IF strpos(replace(src,chr(13)||chr(10),''),chr(13))>0
        OR (strpos(src,chr(13)||chr(10))>0 AND strpos(replace(src,chr(13)||chr(10),''),chr(10))>0) THEN
        RAISE EXCEPTION 'Newline baseline misti o CR isolati: %',j->>'firma_richiesta';
      END IF;
    END LOOP;
    IF pg_get_userbyid(p.proowner) IS DISTINCT FROM j->>'owner'
      OR p.prokind::text IS DISTINCT FROM j->>'prokind'
      OR p.prosecdef IS DISTINCT FROM (j->>'security_definer')::boolean
      OR p.provolatile::text IS DISTINCT FROM j->>'volatility'
      OR p.proretset IS DISTINCT FROM (j->>'returns_set')::boolean
      OR pg_get_function_result(p.oid) IS DISTINCT FROM j->>'returns'
      OR pg_get_function_arguments(p.oid) IS DISTINCT FROM j->>'arguments'
      OR (SELECT lanname FROM pg_catalog.pg_language WHERE oid=p.prolang) IS DISTINCT FROM j->>'language'
      OR to_jsonb(p.proconfig) IS DISTINCT FROM j->'proconfig'
      OR replace(p.prosrc,chr(13)||chr(10),chr(10)) IS DISTINCT FROM replace(j->>'prosrc',chr(13)||chr(10),chr(10)) THEN
      RAISE EXCEPTION 'Baseline funzione divergente %',j->>'firma_richiesta';
    END IF;
    SELECT coalesce(jsonb_agg(a::text ORDER BY a::text),'[]'::jsonb) INTO attuale
      FROM unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a;
    SELECT jsonb_agg(v ORDER BY v #>> '{}') INTO expected FROM jsonb_array_elements(j->'acl_raw') v;
    IF attuale IS DISTINCT FROM expected THEN RAISE EXCEPTION 'ACL divergente %',j->>'firma_richiesta'; END IF;
  END LOOP;
  FOR j IN SELECT value FROM jsonb_array_elements(baseline->'autorizzazione'->'ruoli') LOOP
    SELECT pr.* INTO p FROM pg_catalog.pg_roles pr WHERE pr.rolname=j->>'nome';
    IF NOT FOUND OR p.rolsuper IS DISTINCT FROM (j->>'superuser')::boolean
      OR p.rolcanlogin IS DISTINCT FROM (j->>'login')::boolean
      OR p.rolinherit IS DISTINCT FROM (j->>'inherit')::boolean
      OR p.rolcreaterole IS DISTINCT FROM (j->>'createrole')::boolean
      OR p.rolcreatedb IS DISTINCT FROM (j->>'createdb')::boolean
      OR p.rolreplication IS DISTINCT FROM (j->>'replication')::boolean
      OR p.rolbypassrls IS DISTINCT FROM (j->>'bypassrls')::boolean
      OR p.rolconnlimit IS DISTINCT FROM (j->>'connection_limit')::integer
      OR p.rolvaliduntil::text IS DISTINCT FROM j->>'valid_until'
      OR coalesce(to_jsonb(p.rolconfig),'null'::jsonb) IS DISTINCT FROM j->'config' THEN RAISE EXCEPTION 'Ruolo baseline divergente %',j->>'nome'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),
      'grantor',pg_get_userbyid(m.grantor),'admin_option',m.admin_option,'inherit_option',m.inherit_option,'set_option',m.set_option)
      ORDER BY m.roleid,m.member,m.grantor),'[]'::jsonb) INTO attuale
      FROM pg_catalog.pg_auth_members m WHERE m.roleid=p.oid OR m.member=p.oid;
    -- Ordine indipendente dagli OID: confronto come insieme di oggetti certificati.
    IF jsonb_array_length(attuale)<>jsonb_array_length(j->'membership')
      OR NOT attuale @> (j->'membership') OR NOT (j->'membership') @> attuale THEN RAISE EXCEPTION 'Membership divergente'; END IF;
  END LOOP;
  FOR j IN SELECT value FROM jsonb_array_elements(baseline->'distruzione'->'tabelle') LOOP
    SELECT pc.* INTO p FROM pg_catalog.pg_class pc WHERE pc.oid=to_regclass('artecna_distruzione.'||(j->>'nome'));
    IF NOT FOUND OR pg_get_userbyid(p.relowner) IS DISTINCT FROM j->>'owner'
      OR p.relkind::text IS DISTINCT FROM j->>'relkind' OR p.relrowsecurity IS DISTINCT FROM (j->>'rls')::boolean
      OR p.relforcerowsecurity IS DISTINCT FROM (j->>'force_rls')::boolean THEN RAISE EXCEPTION 'Tabella privata divergente'; END IF;
    SELECT coalesce(jsonb_agg(a::text ORDER BY a::text),'[]'::jsonb) INTO attuale FROM unnest(coalesce(p.relacl,acldefault('r',p.relowner))) a;
    SELECT jsonb_agg(v ORDER BY v #>> '{}') INTO expected FROM jsonb_array_elements(j->'acl_raw') v;
    IF attuale IS DISTINCT FROM expected THEN RAISE EXCEPTION 'ACL privata divergente'; END IF;
    SELECT jsonb_agg(jsonb_build_object('nome',a.attname,'tipo',format_type(a.atttypid,a.atttypmod),'acl_raw',a.attacl::text[],
      'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'not_null',a.attnotnull,'generated',a.attgenerated,'posizione',a.attnum)
      ORDER BY a.attnum) INTO attuale FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=p.oid AND a.attnum>0 AND NOT a.attisdropped;
    IF attuale IS DISTINCT FROM j->'colonne' THEN RAISE EXCEPTION 'Colonne private divergenti'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('nome',k.conname,'tipo',k.contype,'definition',pg_get_constraintdef(k.oid,false),
      'deferrable',k.condeferrable,'deferred',k.condeferred,'validated',k.convalidated) ORDER BY k.conname),'[]'::jsonb) INTO attuale
      FROM pg_catalog.pg_constraint k WHERE k.conrelid=p.oid;
    IF attuale IS DISTINCT FROM j->'constraints' THEN RAISE EXCEPTION 'Constraint privati divergenti'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('nome',ic.relname,'valid',ix.indisvalid,
      'unique',ix.indisunique,'primary',ix.indisprimary,'definition',pg_get_indexdef(ix.indexrelid)) ORDER BY ic.relname),'[]'::jsonb)
      INTO attuale FROM pg_catalog.pg_index ix JOIN pg_catalog.pg_class ic ON ic.oid=ix.indexrelid WHERE ix.indrelid=p.oid;
    IF attuale IS DISTINCT FROM j->'indici' THEN RAISE EXCEPTION 'Indici privati divergenti'; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.cantieri') AND attname='id' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Root cantiere UUID assente'; END IF;
  SELECT jsonb_agg(to_jsonb(pf) ORDER BY pf.oid) INTO v_procs FROM pg_catalog.pg_proc pf JOIN pg_catalog.pg_namespace ns ON ns.oid=pf.pronamespace
    WHERE ns.nspname IN ('public','artecna_guardie','artecna_distruzione');
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) INTO v_triggers FROM pg_catalog.pg_trigger t;
  SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.oid) INTO v_oldroles FROM pg_catalog.pg_roles pr;
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) INTO v_members FROM pg_catalog.pg_auth_members m;
  SELECT jsonb_build_object('class',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='artecna_distruzione'),
    'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='artecna_distruzione'),
    'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_namespace ns ON ns.oid=k.connamespace WHERE ns.nspname='artecna_distruzione')) INTO v_private;
  FOR j IN SELECT value FROM jsonb_array_elements(baseline->'default') LOOP
    FOR expected IN SELECT value FROM jsonb_array_elements(j->'colonne') LOOP
      SELECT jsonb_build_object('nome',a.attname,'tipo',format_type(a.atttypid,a.atttypmod),'default',pg_get_expr(d.adbin,d.adrelid),
        'identity',a.attidentity,'not_null',a.attnotnull,'generated',a.attgenerated,'posizione',a.attnum)
      INTO attuale FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=to_regclass('public.'||(j->>'tabella')) AND a.attname=expected->>'nome' AND NOT a.attisdropped;
      IF attuale IS DISTINCT FROM (expected-'numeric_scale'-'numeric_precision') THEN RAISE EXCEPTION 'Default/tipo moderno divergente'; END IF;
    END LOOP;
  END LOOP;
  -- Ruolo creato da postgres: nessuna membership client. Il grant SET temporaneo
  -- viene revocato; la membership automatica del creatore resta senza SET/INHERIT.
  CREATE ROLE artecna_economia_rpc NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
  GRANT artecna_economia_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
  GRANT USAGE ON SCHEMA public,artecna_guardie TO artecna_economia_rpc;
  GRANT SELECT (id), UPDATE (id) ON public.cantieri TO artecna_economia_rpc;
  GRANT SELECT (cantiere_id,user_id,ruolo), UPDATE (user_id) ON public.utenti_cantiere TO artecna_economia_rpc;
  GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente(),artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO artecna_economia_rpc;

  CREATE TABLE public.economia_raccolte (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cantiere_id uuid NOT NULL,
    numero integer NOT NULL CHECK(numero>0), titolo text NOT NULL CHECK(btrim(titolo)<>''), data date NOT NULL,
    stato text NOT NULL DEFAULT 'bozza' CHECK(stato IN ('bozza','chiusa')), note text,
    revisione bigint NOT NULL DEFAULT 0 CHECK(revisione>=0), created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT economia_raccolte_cantiere_fk FOREIGN KEY(cantiere_id) REFERENCES public.cantieri(id) ON DELETE RESTRICT,
    CONSTRAINT economia_raccolte_numero_unique UNIQUE(cantiere_id,numero));
  CREATE TABLE public.economia_sorgenti (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raccolta_id uuid NOT NULL,
    tipo text NOT NULL DEFAULT 'file' CHECK(tipo='file'), nome_file text NOT NULL CHECK(btrim(nome_file)<>''),
    formato text NOT NULL CHECK(formato IN ('pdf','excel','immagine')),
    file_sha256 text NOT NULL CHECK(length(file_sha256)=64 AND file_sha256 ~ '^[0-9a-f]{64}$'),
    snapshot_version integer NOT NULL DEFAULT 1 CHECK(snapshot_version>0),
    snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'), created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT economia_sorgenti_raccolta_fk FOREIGN KEY(raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT,
    CONSTRAINT economia_sorgenti_file_unique UNIQUE(raccolta_id,file_sha256),
    CONSTRAINT economia_sorgenti_identita_raccolta_unique UNIQUE(id,raccolta_id));
  CREATE TABLE public.economia_righe (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raccolta_id uuid NOT NULL,
    ordine integer NOT NULL CHECK(ordine>0), descrizione text NOT NULL CHECK(btrim(descrizione)<>''),
    unita_misura text NOT NULL CHECK(btrim(unita_misura)<>''),
    quantita numeric(18,6) NOT NULL CHECK(quantita>0 AND quantita<>'NaN'::numeric),
    prezzo_unitario numeric(18,6) CHECK(prezzo_unitario IS NULL OR (prezzo_unitario>=0 AND prezzo_unitario<>'NaN'::numeric)),
    note text, origine text NOT NULL CONSTRAINT economia_righe_origine_valore_check CHECK(origine IN ('manuale','file')), sorgente_id uuid, indice_voce_sorgente integer,
    created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT economia_righe_raccolta_fk FOREIGN KEY(raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT,
    CONSTRAINT economia_righe_sorgente_fk FOREIGN KEY(sorgente_id,raccolta_id) REFERENCES public.economia_sorgenti(id,raccolta_id) ON DELETE RESTRICT,
    CONSTRAINT economia_righe_ordine_unique UNIQUE(raccolta_id,ordine) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT economia_righe_origine_coerenza_check CHECK((origine='manuale' AND sorgente_id IS NULL AND indice_voce_sorgente IS NULL)
      OR (origine='file' AND sorgente_id IS NOT NULL AND indice_voce_sorgente IS NOT NULL AND indice_voce_sorgente>=0)),
    CONSTRAINT economia_righe_voce_sorgente_unique UNIQUE(sorgente_id,indice_voce_sorgente));
  ALTER TABLE public.economia_raccolte ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.economia_sorgenti ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.economia_righe ENABLE ROW LEVEL SECURITY;
  -- Neutralizza anche default ACL del progetto: nessun accesso client/service_role.
  FOR r IN SELECT c.oid,c.relname,c.relowner FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('economia_raccolte','economia_sorgenti','economia_righe') LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',r.relname);
    FOR q IN SELECT DISTINCT a.grantee FROM aclexplode(coalesce((SELECT c.relacl FROM pg_catalog.pg_class c WHERE c.oid=r.oid),acldefault('r',r.relowner))) a WHERE a.grantee<>0 AND a.grantee<>r.relowner LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',r.relname,pg_get_userbyid(q.grantee));
    END LOOP;
  END LOOP;
  GRANT SELECT,INSERT ON public.economia_raccolte,public.economia_sorgenti,public.economia_righe TO artecna_economia_rpc;
  GRANT UPDATE(titolo,data,note,revisione,stato,updated_at) ON public.economia_raccolte TO artecna_economia_rpc;
  GRANT UPDATE(ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,updated_at),DELETE ON public.economia_righe TO artecna_economia_rpc;
  GRANT SELECT,DELETE ON public.economia_raccolte,public.economia_sorgenti,public.economia_righe TO artecna_cantieri_delete_rpc;
  GRANT SELECT ON public.economia_raccolte,public.economia_sorgenti,public.economia_righe TO postgres;
  GRANT CREATE ON SCHEMA public TO artecna_economia_rpc;

  EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
  EXECUTE $newrpc$CREATE FUNCTION public.crea_raccolta_economia(p_cantiere_id uuid,p_titolo text,p_data date,p_note text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_cantiere uuid:=p_cantiere_id; v_num bigint; v_r public.economia_raccolte%rowtype;
BEGIN v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 IF p_titolo IS NULL OR btrim(p_titolo)='' OR p_data IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Titolo e data obbligatori'; END IF;
 SELECT coalesce(max(e.numero)::bigint,0)+1 INTO v_num FROM public.economia_raccolte e WHERE e.cantiere_id=v_cantiere;
 IF v_num>2147483647 THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='Numerazione esaurita'; END IF;
 INSERT INTO public.economia_raccolte(cantiere_id,numero,titolo,data,note,created_by) VALUES(v_cantiere,v_num,p_titolo,p_data,p_note,v_user) RETURNING * INTO v_r;
 RETURN to_jsonb(v_r); END;
$body$$newrpc$;
  EXECUTE 'RESET ROLE';
  v_rpcdefs:=v_rpcdefs||jsonb_build_object('crea_raccolta_economia(uuid,text,date,text)',$newrpc$CREATE FUNCTION public.crea_raccolta_economia(p_cantiere_id uuid,p_titolo text,p_data date,p_note text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_cantiere uuid:=p_cantiere_id; v_num bigint; v_r public.economia_raccolte%rowtype;
BEGIN v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 IF p_titolo IS NULL OR btrim(p_titolo)='' OR p_data IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Titolo e data obbligatori'; END IF;
 SELECT coalesce(max(e.numero)::bigint,0)+1 INTO v_num FROM public.economia_raccolte e WHERE e.cantiere_id=v_cantiere;
 IF v_num>2147483647 THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='Numerazione esaurita'; END IF;
 INSERT INTO public.economia_raccolte(cantiere_id,numero,titolo,data,note,created_by) VALUES(v_cantiere,v_num,p_titolo,p_data,p_note,v_user) RETURNING * INTO v_r;
 RETURN to_jsonb(v_r); END;
$body$$newrpc$);

  EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
  EXECUTE $newrpc$CREATE FUNCTION public.leggi_raccolte_economia(p_cantiere_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('totale', (SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=e.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=e.id AND l.prezzo_unitario IS NULL)) ORDER BY e.numero)
 FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id),'[]'::jsonb); END;
$body$$newrpc$;
  EXECUTE 'RESET ROLE';
  v_rpcdefs:=v_rpcdefs||jsonb_build_object('leggi_raccolte_economia(uuid)',$newrpc$CREATE FUNCTION public.leggi_raccolte_economia(p_cantiere_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('totale', (SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=e.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=e.id AND l.prezzo_unitario IS NULL)) ORDER BY e.numero)
 FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id),'[]'::jsonb); END;
$body$$newrpc$);

  EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
  EXECUTE $newrpc$CREATE FUNCTION public.leggi_raccolta_economia(p_raccolta_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_r public.economia_raccolte%rowtype; BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente(); SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 IF NOT FOUND OR v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente o non autorizzata'; END IF;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)) || jsonb_build_object('righe',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('totale',round(l.quantita*l.prezzo_unitario,2)) ORDER BY l.ordine) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),'[]'::jsonb),
 'sorgenti',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at,s.id) FROM public.economia_sorgenti s WHERE s.raccolta_id=v_r.id),'[]'::jsonb)); END;
$body$$newrpc$;
  EXECUTE 'RESET ROLE';
  v_rpcdefs:=v_rpcdefs||jsonb_build_object('leggi_raccolta_economia(uuid)',$newrpc$CREATE FUNCTION public.leggi_raccolta_economia(p_raccolta_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_r public.economia_raccolte%rowtype; BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente(); SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 IF NOT FOUND OR v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente o non autorizzata'; END IF;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)) || jsonb_build_object('righe',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('totale',round(l.quantita*l.prezzo_unitario,2)) ORDER BY l.ordine) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),'[]'::jsonb),
 'sorgenti',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at,s.id) FROM public.economia_sorgenti s WHERE s.raccolta_id=v_r.id),'[]'::jsonb)); END;
$body$$newrpc$);

  EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
  EXECUTE $newrpc$CREATE FUNCTION public.chiudi_raccolta_economia(p_raccolta_id uuid,p_revisione_attesa bigint) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;
 IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revisione Economia divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id) OR EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richieste righe valorizzate'; END IF;
 UPDATE public.economia_raccolte e SET stato='chiusa',revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;
$body$$newrpc$;
  EXECUTE 'RESET ROLE';
  v_rpcdefs:=v_rpcdefs||jsonb_build_object('chiudi_raccolta_economia(uuid,bigint)',$newrpc$CREATE FUNCTION public.chiudi_raccolta_economia(p_raccolta_id uuid,p_revisione_attesa bigint) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;
 IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revisione Economia divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id) OR EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richieste righe valorizzate'; END IF;
 UPDATE public.economia_raccolte e SET stato='chiusa',revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;
$body$$newrpc$);

  EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
  EXECUTE $newrpc$CREATE FUNCTION public.salva_bozza_economia(p_raccolta_id uuid,p_revisione_attesa bigint,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; a jsonb; k text; x jsonb; rid uuid; n integer; q numeric; pr numeric; seen uuid[]:=ARRAY[]::uuid[]; changed uuid[]:=ARRAY[]::uuid[];
BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;
 IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revisione Economia divergente'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(key) WHERE z.key NOT IN ('righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload Economia non valido'; END IF;
 FOREACH k IN ARRAY ARRAY['righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino'] LOOP
  IF p_payload ? k AND jsonb_typeof(p_payload->k)<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni richiedono array'; END IF;
 END LOOP;
 SET CONSTRAINTS public.economia_righe_ordine_unique DEFERRED;
 -- Sorgenti nuove: ID esplicito consente riferimenti nel medesimo payload.
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'sorgenti_da_aggiungere','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','nome_file','formato','file_sha256','snapshot_version','snapshot')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente non valida'; END IF;
  rid:=(x->>'id')::uuid; IF rid IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID sorgente obbligatorio'; END IF;
  INSERT INTO public.economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)
    VALUES(rid,v_r.id,x->>'nome_file',x->>'formato',x->>'file_sha256',coalesce((x->>'snapshot_version')::integer,1),x->'snapshot',v_user);
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'righe_da_eliminare','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID riga richiesto'; END IF;
  rid:=(x #>> '{}')::uuid;
  IF rid=ANY(changed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione riga ripetuta'; END IF;
  DELETE FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
  changed:=array_append(changed,rid);
 END LOOP;
 -- Modifiche esplicite: contenuto completo della sola riga indicata, provenienza immutabile.
 FOREACH k IN ARRAY ARRAY['righe_da_modificare','righe_da_creare'] LOOP
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) LOOP
   IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non valida'; END IF;
   q:=(x->>'quantita')::numeric; pr:=(x->>'prezzo_unitario')::numeric;
   IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') OR q<>round(q,6)
     OR (pr IS NOT NULL AND (pr<0 OR pr::text IN ('NaN','Infinity','-Infinity') OR pr<>round(pr,6))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione o valore numerico non valido'; END IF;
   rid:=(x->>'id')::uuid;
   IF k='righe_da_modificare' THEN
    IF rid IS NULL OR rid=ANY(changed) OR x ? 'origine' OR x ? 'sorgente_id' OR x ? 'indice_voce_sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica riga/provenienza non valida'; END IF;
    UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,prezzo_unitario=pr,note=x->>'note',updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
   ELSE
    IF rid IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID nuova riga assegnato dal server'; END IF;
    INSERT INTO public.economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,sorgente_id,indice_voce_sorgente,created_by)
      VALUES(v_r.id,(x->>'ordine')::integer,x->>'descrizione',x->>'unita_misura',q,pr,x->>'note',x->>'origine',(x->>'sorgente_id')::uuid,(x->>'indice_voce_sorgente')::integer,v_user) RETURNING id INTO rid;
   END IF;
   changed:=array_append(changed,rid);
  END LOOP;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'riordino','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino non valido'; END IF;
  rid:=(x->>'id')::uuid; IF rid IS NULL OR rid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino ripetuto'; END IF;
  UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF; seen:=array_append(seen,rid);
 END LOOP;
 SET CONSTRAINTS public.economia_righe_ordine_unique IMMEDIATE;
 UPDATE public.economia_raccolte e SET revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;
$body$$newrpc$;
  EXECUTE 'RESET ROLE';
  v_rpcdefs:=v_rpcdefs||jsonb_build_object('salva_bozza_economia(uuid,bigint,jsonb)',$newrpc$CREATE FUNCTION public.salva_bozza_economia(p_raccolta_id uuid,p_revisione_attesa bigint,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$
DECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; a jsonb; k text; x jsonb; rid uuid; n integer; q numeric; pr numeric; seen uuid[]:=ARRAY[]::uuid[]; changed uuid[]:=ARRAY[]::uuid[];
BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;
 IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revisione Economia divergente'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(key) WHERE z.key NOT IN ('righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload Economia non valido'; END IF;
 FOREACH k IN ARRAY ARRAY['righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino'] LOOP
  IF p_payload ? k AND jsonb_typeof(p_payload->k)<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni richiedono array'; END IF;
 END LOOP;
 SET CONSTRAINTS public.economia_righe_ordine_unique DEFERRED;
 -- Sorgenti nuove: ID esplicito consente riferimenti nel medesimo payload.
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'sorgenti_da_aggiungere','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','nome_file','formato','file_sha256','snapshot_version','snapshot')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente non valida'; END IF;
  rid:=(x->>'id')::uuid; IF rid IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID sorgente obbligatorio'; END IF;
  INSERT INTO public.economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)
    VALUES(rid,v_r.id,x->>'nome_file',x->>'formato',x->>'file_sha256',coalesce((x->>'snapshot_version')::integer,1),x->'snapshot',v_user);
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'righe_da_eliminare','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID riga richiesto'; END IF;
  rid:=(x #>> '{}')::uuid;
  IF rid=ANY(changed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione riga ripetuta'; END IF;
  DELETE FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
  changed:=array_append(changed,rid);
 END LOOP;
 -- Modifiche esplicite: contenuto completo della sola riga indicata, provenienza immutabile.
 FOREACH k IN ARRAY ARRAY['righe_da_modificare','righe_da_creare'] LOOP
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) LOOP
   IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non valida'; END IF;
   q:=(x->>'quantita')::numeric; pr:=(x->>'prezzo_unitario')::numeric;
   IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') OR q<>round(q,6)
     OR (pr IS NOT NULL AND (pr<0 OR pr::text IN ('NaN','Infinity','-Infinity') OR pr<>round(pr,6))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione o valore numerico non valido'; END IF;
   rid:=(x->>'id')::uuid;
   IF k='righe_da_modificare' THEN
    IF rid IS NULL OR rid=ANY(changed) OR x ? 'origine' OR x ? 'sorgente_id' OR x ? 'indice_voce_sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica riga/provenienza non valida'; END IF;
    UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,prezzo_unitario=pr,note=x->>'note',updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
   ELSE
    IF rid IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID nuova riga assegnato dal server'; END IF;
    INSERT INTO public.economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,sorgente_id,indice_voce_sorgente,created_by)
      VALUES(v_r.id,(x->>'ordine')::integer,x->>'descrizione',x->>'unita_misura',q,pr,x->>'note',x->>'origine',(x->>'sorgente_id')::uuid,(x->>'indice_voce_sorgente')::integer,v_user) RETURNING id INTO rid;
   END IF;
   changed:=array_append(changed,rid);
  END LOOP;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'riordino','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino non valido'; END IF;
  rid:=(x->>'id')::uuid; IF rid IS NULL OR rid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino ripetuto'; END IF;
  UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF; seen:=array_append(seen,rid);
 END LOOP;
 SET CONSTRAINTS public.economia_righe_ordine_unique IMMEDIATE;
 UPDATE public.economia_raccolte e SET revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;
$body$$newrpc$);

  -- Chiude ACL delle sole cinque RPC, incluse eventuali default ACL preesistenti.
  EXECUTE 'SET LOCAL ROLE artecna_economia_rpc';
  FOR r IN SELECT pf.oid,pf.proowner,pf.proacl FROM pg_catalog.pg_proc pf JOIN pg_catalog.pg_namespace ns ON ns.oid=pf.pronamespace
    WHERE ns.nspname='public' AND pf.proname IN ('crea_raccolta_economia','leggi_raccolte_economia','leggi_raccolta_economia','salva_bozza_economia','chiudi_raccolta_economia') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.oid::regprocedure);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon',r.oid::regprocedure);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated',r.oid::regprocedure);
    FOR q IN SELECT DISTINCT a.grantee FROM aclexplode(coalesce(r.proacl,acldefault('f',r.proowner))) a
      WHERE a.grantee<>0 AND a.grantee NOT IN (r.proowner,'anon'::regrole,'authenticated'::regrole) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',r.oid::regprocedure,pg_get_userbyid(q.grantee));
    END LOOP;
  END LOOP;
  FOR r IN SELECT key AS firma FROM jsonb_each(v_rpcdefs) LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated',r.firma);
  END LOOP;
  EXECUTE 'RESET ROLE';
  REVOKE CREATE ON SCHEMA public FROM artecna_economia_rpc;
  REVOKE artecna_economia_rpc FROM postgres;

  GRANT UPDATE(id) ON public.economia_raccolte,public.economia_sorgenti,public.economia_righe TO artecna_cantieri_delete_rpc;
  -- Snapshot prosrc atteso costruito dai corpi REALI, con sole estensioni Economia.
  v_expected_sources:=jsonb_build_object('artecna_distruzione.manifest_cantiere(uuid)',$newmanifest$
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    RETURN QUERY
    SELECT q.entita,q.quantita FROM (
SELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_raccolte'::text,count(*)::bigint FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_sorgenti'::text,count(*)::bigint FROM public.economia_sorgenti e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_righe'::text,count(*)::bigint FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL
    ) AS q(entita,quantita) ORDER BY q.entita;
  END;
  $newmanifest$,
    'public.elimina_cantiere_definitivamente(uuid,text)',$newdelete$
DECLARE
  v_user uuid;
  v_id uuid;
  v_varianti uuid[];
  v_raccolte uuid[];
  v_economia_sorgenti uuid[];
  v_economia_righe uuid[];
  v_economia_figli constant text[]:=ARRAY['economia_sorgenti','economia_righe']::text[];
  v_preventivi text[];
  v_base_lavorazioni bigint[];
  v_var_lavorazioni bigint[];
  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','economia_raccolte','economia_sorgenti','economia_righe']::text[];
  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];
  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','economia_raccolte']::text[];
  v_eliminate jsonb := '{}'::jsonb;
  v_n bigint;
  v_totale_lavorazioni bigint;
  v_residuo boolean;
  v_esterna boolean;
  v_on text;
  v_padre text;
  v_figlio text;
  v_sql text;
  v_jobs_prima record;
  v_jobs_vecchi record;
  v_jobs_preparati record;
  v_jobs_dopo record;
  t text;
  fk record;
  m record;
BEGIN
  IF current_user <> 'artecna_cantieri_delete_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';
  END IF;
  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN
    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';
  END IF;
  v_user := artecna_guardie.utente_jwt_corrente();
  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';
  END IF;
  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;
  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';
  END IF;
  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';
  END IF;
  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);
  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';
  END IF;
  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.
  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;
  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;
  PERFORM e.id FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id ORDER BY e.id FOR UPDATE;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_raccolte FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;
    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti,v_raccolte LOOP NULL; END LOOP;
  END LOOP;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_sorgenti FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_righe FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);
  IF (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass))<>4 THEN
    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Economia divergente'; END IF;
  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.
  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.
  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace
    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)
    ORDER BY k.oid
  LOOP
    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);
    END IF;
    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on
      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum
      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;
    -- Le FK che coinvolgono Economia devono appartenere all'esatto grafo V1.
    IF fk.padre IN ('economia_raccolte','economia_sorgenti','economia_righe') OR fk.figlio IN ('economia_raccolte','economia_sorgenti','economia_righe') THEN
      IF fk.ns_padre<>'public' OR fk.ns_figlio<>'public' OR fk.confdeltype<>'r' OR fk.condeferrable OR fk.condeferred
        OR NOT (
          (fk.conname='economia_raccolte_cantiere_fk' AND fk.figlio='economia_raccolte' AND fk.padre='cantieri'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='cantiere_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (((fk.figlio='economia_sorgenti' AND fk.conname='economia_sorgenti_raccolta_fk') OR (fk.figlio='economia_righe' AND fk.conname='economia_righe_raccolta_fk'))
            AND fk.figlio=ANY(v_economia_figli) AND fk.padre='economia_raccolte'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (fk.conname='economia_righe_sorgente_fk' AND fk.figlio='economia_righe' AND fk.padre='economia_sorgenti'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='sorgente_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='raccolta_id')]::smallint[])
        ) THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Economia non certificata'; END IF;
    END IF;
    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';
    ELSIF fk.padre=ANY(v_economia_figli) THEN v_padre:='t.raccolta_id=ANY($3)';
    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';
    ELSE v_padre:='t.cantiere_id=$1'; END IF;
    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';
    ELSIF fk.figlio=ANY(v_economia_figli) THEN v_figlio:='f.raccolta_id=ANY($3)';
    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';
    ELSE v_figlio:='f.cantiere_id=$1'; END IF;
    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);
    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;
  END LOOP;
  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;
  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;
  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);
  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);
  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta
     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';
  END IF;
  DELETE FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_righe',v_n);
  DELETE FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_sorgenti',v_n);
  DELETE FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_raccolte',v_n);
  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);
  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);
  v_totale_lavorazioni := 0;
  LOOP
    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)
      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_totale_lavorazioni := v_totale_lavorazioni + v_n;
    IF v_n=0 THEN
      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';
      END IF;
      EXIT;
    END IF;
  END LOOP;
  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);
  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);
  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);
  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL
    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;
  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n);
  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);
  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);
  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);
  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);
  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);
  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);
  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);
  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);
  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);
  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);
  -- Post-check dei dati protetti PRIMA di terminare il contesto.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN
      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))
     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))
     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';
  END IF;
  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';
  END IF;
  PERFORM artecna_distruzione.termina_contesto();
  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;
  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';
  END IF;
  -- Ultima cancellazione applicativa.
  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';
  END IF;
  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';
    ELSIF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.economia_raccolte e WHERE e.id=ANY(v_raccolte))
    OR EXISTS(SELECT 1 FROM public.economia_sorgenti e WHERE e.id=ANY(v_economia_sorgenti))
    OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.id=ANY(v_economia_righe)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita Economia residue'; END IF;
  cantiere_id := p_cantiere_id;
  eliminato := true;
  RETURN NEXT;
EXCEPTION WHEN foreign_key_violation THEN
  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;
END;

  $newdelete$);
  -- Protocollo amministrativo: la membership supabase_admin resta intatta.
  GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
  IF has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') THEN RAISE EXCEPTION 'CREATE temporaneo gia presente'; END IF;
  GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc;
  FOR r IN SELECT key AS firma,value #>> '{}' AS corpo FROM jsonb_each(v_expected_sources) LOOP
    SELECT pf.* INTO p FROM pg_catalog.pg_proc pf WHERE pf.oid=to_regprocedure(r.firma);
    src:=p.prosrc; nuovo:=r.corpo;
    -- Mantiene il newline installato se interamente CRLF; nessun cambiamento di spazi/commenti estranei.
    IF strpos(src,chr(13)||chr(10))>0 THEN nuovo:=replace(nuovo,chr(10),chr(13)||chr(10)); END IF;
    ddl:=pg_get_functiondef(p.oid);
    IF src='' OR length(ddl)-length(replace(ddl,src,''))<>length(src) THEN RAISE EXCEPTION 'Corpo wrapper non univoco'; END IF;
    IF strpos(ddl,'AS $')=0 THEN RAISE EXCEPTION 'AS dollar wrapper assente'; END IF;
    funzione:='$'||split_part(split_part(ddl,'AS $',2),'$',1)||'$';
    IF funzione IS NULL OR strpos(nuovo,funzione)>0 THEN RAISE EXCEPTION 'Delimitatore wrapper non sicuro'; END IF;
    ddl:=overlay(ddl placing nuovo from strpos(ddl,src) for length(src));
    IF r.firma='public.elimina_cantiere_definitivamente(uuid,text)' THEN EXECUTE 'SET LOCAL ROLE artecna_cantieri_delete_rpc'; END IF;
    EXECUTE ddl;
    EXECUTE 'RESET ROLE';
    SELECT pf.* INTO q FROM pg_catalog.pg_proc pf WHERE pf.oid=p.oid;
    IF q.prosrc IS DISTINCT FROM nuovo OR (to_jsonb(q)-'prosrc') IS DISTINCT FROM (to_jsonb(p)-'prosrc') THEN RAISE EXCEPTION 'Attributi wrapper/prosrc modificati'; END IF;
  END LOOP;
  REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc;
  REVOKE artecna_cantieri_delete_rpc FROM postgres GRANTED BY postgres;

  -- POST-CHECK: oggetti Economia e preservazione delle infrastrutture precedenti.
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname IN ('economia_raccolte','economia_sorgenti','economia_righe')
      AND c.relkind='r' AND c.relowner='postgres'::regrole AND c.relrowsecurity AND NOT c.relforcerowsecurity)<>3 THEN RAISE EXCEPTION 'Tabelle/RLS Economia incomplete'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('economia_raccolte',ARRAY['id','cantiere_id','numero','titolo','data','stato','note','revisione','created_by','created_at','updated_at']::text[]),
    ('economia_sorgenti',ARRAY['id','raccolta_id','tipo','nome_file','formato','file_sha256','snapshot_version','snapshot','created_by','created_at']::text[]),
    ('economia_righe',ARRAY['id','raccolta_id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente','created_by','created_at','updated_at']::text[])
    ) AS spec(tabella,colonne) LOOP
    SELECT to_jsonb(array_agg(a.attname::text ORDER BY a.attnum)) INTO attuale FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=to_regclass('public.'||r.tabella) AND a.attnum>0 AND NOT a.attisdropped;
    IF attuale IS DISTINCT FROM to_jsonb(r.colonne) THEN RAISE EXCEPTION 'Colonne Economia divergenti'; END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=to_regclass('public.'||r.tabella)) THEN RAISE EXCEPTION 'Policy client inattesa'; END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,LATERAL aclexplode(c.relacl) a
      WHERE c.oid=to_regclass('public.'||r.tabella) AND a.grantee NOT IN ('postgres'::regrole,'artecna_economia_rpc'::regrole,'artecna_cantieri_delete_rpc'::regrole)) THEN RAISE EXCEPTION 'ACL tabella non autorizzata'; END IF;
    FOREACH ruolo IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(ruolo,'public.'||r.tabella,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(ruolo,'public.'||r.tabella,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Accesso client Economia aperto'; END IF;
    END LOOP;
  END LOOP;

  IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass) AND contype='c' AND convalidated)<>17
    OR (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass) AND contype='u')<>5
    OR (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass) AND contype='p')<>3 THEN RAISE EXCEPTION 'CHECK/UNIQUE/PK Economia incompleti'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('economia_raccolte','economia_raccolte_cantiere_fk','cantieri',ARRAY['cantiere_id']::text[],ARRAY['id']::text[]),
    ('economia_sorgenti','economia_sorgenti_raccolta_fk','economia_raccolte',ARRAY['raccolta_id']::text[],ARRAY['id']::text[]),
    ('economia_righe','economia_righe_raccolta_fk','economia_raccolte',ARRAY['raccolta_id']::text[],ARRAY['id']::text[]),
    ('economia_righe','economia_righe_sorgente_fk','economia_sorgenti',ARRAY['sorgente_id','raccolta_id']::text[],ARRAY['id','raccolta_id']::text[])
    ) AS spec(figlia,nome,padre,colonne_figlia,colonne_padre) LOOP
    SELECT k.* INTO p FROM pg_catalog.pg_constraint k WHERE k.conrelid=to_regclass('public.'||r.figlia) AND k.conname=r.nome AND k.contype='f';
    IF NOT FOUND OR p.confrelid<>to_regclass('public.'||r.padre) OR p.confdeltype<>'r' OR NOT p.convalidated OR p.condeferrable OR p.condeferred THEN RAISE EXCEPTION 'FK Economia divergente'; END IF;
    SELECT to_jsonb(array_agg(a.attname::text ORDER BY x.ord)) INTO attuale FROM unnest(p.conkey) WITH ORDINALITY x(num,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=p.conrelid AND a.attnum=x.num;
    SELECT to_jsonb(array_agg(a.attname::text ORDER BY x.ord)) INTO expected FROM unnest(p.confkey) WITH ORDINALITY x(num,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=p.confrelid AND a.attnum=x.num;
    IF attuale IS DISTINCT FROM to_jsonb(r.colonne_figlia) OR expected IS DISTINCT FROM to_jsonb(r.colonne_padre) THEN RAISE EXCEPTION 'Colonne FK divergenti'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass) AND contype='f')<>4 THEN RAISE EXCEPTION 'FK Economia aggiuntive'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass)
    AND a.attname IN ('quantita','prezzo_unitario') AND format_type(a.atttypid,a.atttypmod)<>'numeric(18,6)')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.economia_righe'::regclass AND a.attname='prezzo_unitario' AND NOT a.attnotnull)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.economia_raccolte'::regclass AND a.attname='revisione' AND a.atttypid='int8'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='0') THEN RAISE EXCEPTION 'Precisione/revisione Economia divergente'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass)
      AND ((a.attname='id' AND pg_get_expr(d.adbin,d.adrelid)<>'gen_random_uuid()') OR (a.attname IN ('created_at','updated_at') AND pg_get_expr(d.adbin,d.adrelid)<>'now()'))) THEN RAISE EXCEPTION 'Default Economia divergenti'; END IF;
  IF has_table_privilege('artecna_economia_rpc','public.economia_sorgenti','UPDATE,DELETE') OR has_any_column_privilege('artecna_economia_rpc','public.economia_sorgenti','UPDATE')
    OR has_table_privilege('artecna_economia_rpc','public.economia_raccolte','DELETE') THEN RAISE EXCEPTION 'Privilegi Economia eccessivi'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid='artecna_economia_rpc'::regrole AND member<>'postgres'::regrole)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid='artecna_economia_rpc'::regrole AND (set_option OR inherit_option))
    OR pg_has_role('postgres','artecna_economia_rpc','SET')
    OR has_schema_privilege('artecna_economia_rpc','public','CREATE') THEN RAISE EXCEPTION 'Membership/CREATE Economia aperti'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='artecna_economia_rpc' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND rolbypassrls) THEN RAISE EXCEPTION 'Attributi ruolo Economia'; END IF;
  IF (SELECT count(*) FROM jsonb_each(v_rpcdefs))<>5 THEN RAISE EXCEPTION 'Inventario RPC incompleto'; END IF;
  FOR r IN SELECT key AS firma,value #>> '{}' AS definizione FROM jsonb_each(v_rpcdefs) LOOP
    SELECT pf.* INTO p FROM pg_catalog.pg_proc pf WHERE pf.oid=to_regprocedure('public.'||r.firma);
    IF NOT FOUND OR p.proowner<>'artecna_economia_rpc'::regrole OR NOT p.prosecdef OR p.prokind<>'f' OR p.prorettype<>'jsonb'::regtype
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
      OR p.prosrc IS DISTINCT FROM split_part(r.definizione,'$body$',2) THEN RAISE EXCEPTION 'RPC Economia divergente %',r.firma; END IF;
    IF (r.firma LIKE 'leggi_%' AND p.provolatile<>'s') OR (r.firma NOT LIKE 'leggi_%' AND p.provolatile<>'v') THEN RAISE EXCEPTION 'Volatility Economia divergente'; END IF;
    IF has_function_privilege('artecna_economia_rpc',p.oid,'EXECUTE') IS DISTINCT FROM true
      OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE')
      OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee NOT IN ('artecna_economia_rpc'::regrole,'authenticated'::regrole) OR a.is_grantable) THEN RAISE EXCEPTION 'ACL RPC Economia divergente'; END IF;
  END LOOP;

  FOR j IN SELECT value FROM jsonb_array_elements($columns$[{"table":"economia_raccolte","name":"id","type":"uuid","not_null":true,"default":"gen_random_uuid()"},{"table":"economia_raccolte","name":"cantiere_id","type":"uuid","not_null":true,"default":null},{"table":"economia_raccolte","name":"numero","type":"integer","not_null":true,"default":null},{"table":"economia_raccolte","name":"titolo","type":"text","not_null":true,"default":null},{"table":"economia_raccolte","name":"data","type":"date","not_null":true,"default":null},{"table":"economia_raccolte","name":"stato","type":"text","not_null":true,"default":"'bozza'::text"},{"table":"economia_raccolte","name":"note","type":"text","not_null":false,"default":null},{"table":"economia_raccolte","name":"revisione","type":"bigint","not_null":true,"default":"0"},{"table":"economia_raccolte","name":"created_by","type":"uuid","not_null":true,"default":null},{"table":"economia_raccolte","name":"created_at","type":"timestamp with time zone","not_null":true,"default":"now()"},{"table":"economia_raccolte","name":"updated_at","type":"timestamp with time zone","not_null":true,"default":"now()"},{"table":"economia_sorgenti","name":"id","type":"uuid","not_null":true,"default":"gen_random_uuid()"},{"table":"economia_sorgenti","name":"raccolta_id","type":"uuid","not_null":true,"default":null},{"table":"economia_sorgenti","name":"tipo","type":"text","not_null":true,"default":"'file'::text"},{"table":"economia_sorgenti","name":"nome_file","type":"text","not_null":true,"default":null},{"table":"economia_sorgenti","name":"formato","type":"text","not_null":true,"default":null},{"table":"economia_sorgenti","name":"file_sha256","type":"text","not_null":true,"default":null},{"table":"economia_sorgenti","name":"snapshot_version","type":"integer","not_null":true,"default":"1"},{"table":"economia_sorgenti","name":"snapshot","type":"jsonb","not_null":true,"default":null},{"table":"economia_sorgenti","name":"created_by","type":"uuid","not_null":true,"default":null},{"table":"economia_sorgenti","name":"created_at","type":"timestamp with time zone","not_null":true,"default":"now()"},{"table":"economia_righe","name":"id","type":"uuid","not_null":true,"default":"gen_random_uuid()"},{"table":"economia_righe","name":"raccolta_id","type":"uuid","not_null":true,"default":null},{"table":"economia_righe","name":"ordine","type":"integer","not_null":true,"default":null},{"table":"economia_righe","name":"descrizione","type":"text","not_null":true,"default":null},{"table":"economia_righe","name":"unita_misura","type":"text","not_null":true,"default":null},{"table":"economia_righe","name":"quantita","type":"numeric(18,6)","not_null":true,"default":null},{"table":"economia_righe","name":"prezzo_unitario","type":"numeric(18,6)","not_null":false,"default":null},{"table":"economia_righe","name":"note","type":"text","not_null":false,"default":null},{"table":"economia_righe","name":"origine","type":"text","not_null":true,"default":null},{"table":"economia_righe","name":"sorgente_id","type":"uuid","not_null":false,"default":null},{"table":"economia_righe","name":"indice_voce_sorgente","type":"integer","not_null":false,"default":null},{"table":"economia_righe","name":"created_by","type":"uuid","not_null":true,"default":null},{"table":"economia_righe","name":"created_at","type":"timestamp with time zone","not_null":true,"default":"now()"},{"table":"economia_righe","name":"updated_at","type":"timestamp with time zone","not_null":true,"default":"now()"}]$columns$::jsonb) LOOP
    SELECT jsonb_build_object('table',j->>'table','name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) INTO attuale
    FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass('public.'||(j->>'table')) AND a.attname=j->>'name' AND a.attnum>0 AND NOT a.attisdropped AND a.attidentity='' AND a.attgenerated='';
    IF attuale IS DISTINCT FROM j THEN RAISE EXCEPTION 'Tipo/default/nullable Economia divergente: %.%',j->>'table',j->>'name'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('economia_raccolte','economia_raccolte_numero_unique',ARRAY['cantiere_id','numero']::text[],false),
    ('economia_sorgenti','economia_sorgenti_file_unique',ARRAY['raccolta_id','file_sha256']::text[],false),
    ('economia_sorgenti','economia_sorgenti_identita_raccolta_unique',ARRAY['id','raccolta_id']::text[],false),
    ('economia_righe','economia_righe_ordine_unique',ARRAY['raccolta_id','ordine']::text[],true),
    ('economia_righe','economia_righe_voce_sorgente_unique',ARRAY['sorgente_id','indice_voce_sorgente']::text[],false)
  ) spec(tabella,nome,colonne,differibile) LOOP
    SELECT k.* INTO p FROM pg_catalog.pg_constraint k WHERE k.conrelid=to_regclass('public.'||r.tabella) AND k.conname=r.nome AND k.contype='u';
    IF NOT FOUND OR NOT p.convalidated OR p.condeferrable IS DISTINCT FROM r.differibile OR p.condeferred THEN RAISE EXCEPTION 'UNIQUE Economia divergente'; END IF;
    SELECT to_jsonb(array_agg(a.attname::text ORDER BY z.ord)) INTO attuale FROM unnest(p.conkey) WITH ORDINALITY z(num,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=p.conrelid AND a.attnum=z.num;
    IF attuale IS DISTINCT FROM to_jsonb(r.colonne) THEN RAISE EXCEPTION 'Colonne UNIQUE Economia divergenti'; END IF;
  END LOOP;
  -- Ogni pg_proc preesistente preservato integralmente, eccetto due corpi e due ACL autorizzate.
  FOR j IN SELECT value FROM jsonb_array_elements(v_procs) LOOP
    SELECT to_jsonb(pf) INTO attuale FROM pg_catalog.pg_proc pf WHERE pf.oid=(j->>'oid')::oid;
    funzione:=((j->>'oid')::oid)::regprocedure::text;
    IF (j->>'oid')::oid IN (to_regprocedure('artecna_distruzione.manifest_cantiere(uuid)'),to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)')) THEN
      IF (attuale-'prosrc') IS DISTINCT FROM (j-'prosrc') THEN RAISE EXCEPTION 'Attributi distruzione mutati'; END IF;
    ELSIF (j->>'oid')::oid IN (to_regprocedure('artecna_guardie.utente_jwt_corrente()'),to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)')) THEN
      IF (attuale-'proacl') IS DISTINCT FROM (j-'proacl') THEN RAISE EXCEPTION 'Helper autorizzativo mutato'; END IF;
      SELECT jsonb_agg(v ORDER BY v #>> '{}') INTO expected FROM (
        SELECT value AS v FROM jsonb_array_elements(j->'proacl')
        UNION ALL SELECT to_jsonb('artecna_economia_rpc=X/postgres'::text)
      ) acl_expected;
      SELECT jsonb_agg(v ORDER BY v #>> '{}') INTO src FROM jsonb_array_elements(attuale->'proacl') v;
      IF src::jsonb IS DISTINCT FROM expected THEN RAISE EXCEPTION 'ACL helper precedente non preservata'; END IF;
      -- ACL originarie controllate nel preflight; aggiunta concessa solo al ruolo Economia.
      IF NOT has_function_privilege('artecna_economia_rpc',(j->>'oid')::oid,'EXECUTE') THEN RAISE EXCEPTION 'Grant helper assente'; END IF;
    ELSIF attuale IS DISTINCT FROM j THEN RAISE EXCEPTION 'Funzione precedente modificata %',funzione; END IF;
  END LOOP;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) INTO attuale FROM pg_catalog.pg_trigger t
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(v_triggers) old_trigger WHERE (old_trigger->>'oid')::oid=t.oid);
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_triggers) old_trigger WHERE (old_trigger->>'oid')::oid=t.oid)
    AND NOT (
      (t.tgisinternal AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint fk
        WHERE fk.oid=t.tgconstraint AND fk.contype='f'
        AND fk.conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass)))
      OR (t.tgisinternal AND t.tgrelid='public.economia_righe'::regclass
        AND t.tgfoid='pg_catalog.unique_key_recheck()'::regprocedure
        AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint uc
          WHERE uc.oid=t.tgconstraint AND uc.contype='u'
            AND uc.conname='economia_righe_ordine_unique'
            AND uc.conrelid='public.economia_righe'::regclass
            AND uc.convalidated AND uc.condeferrable AND NOT uc.condeferred
            AND pg_get_constraintdef(uc.oid,false)='UNIQUE (raccolta_id, ordine) DEFERRABLE'))
    ))
  THEN RAISE EXCEPTION 'Trigger nuovo inatteso'; END IF;
  IF attuale IS DISTINCT FROM v_triggers THEN RAISE EXCEPTION 'Trigger precedenti modificati'; END IF;
  SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.oid) INTO attuale FROM pg_catalog.pg_roles pr WHERE pr.rolname<>'artecna_economia_rpc';
  IF attuale IS DISTINCT FROM v_oldroles THEN RAISE EXCEPTION 'Ruoli precedenti modificati'; END IF;
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) INTO attuale FROM pg_catalog.pg_auth_members m WHERE m.roleid<>'artecna_economia_rpc'::regrole AND m.member<>'artecna_economia_rpc'::regrole;
  IF attuale IS DISTINCT FROM v_members THEN RAISE EXCEPTION 'Membership precedente modificata'; END IF;
  SELECT jsonb_build_object('class',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='artecna_distruzione'),
    'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='artecna_distruzione'),
    'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_namespace ns ON ns.oid=k.connamespace WHERE ns.nspname='artecna_distruzione')) INTO attuale;
  IF attuale IS DISTINCT FROM v_private THEN RAISE EXCEPTION 'Contesto/outbox modificati'; END IF;
END;
$migration$;
COMMIT;
