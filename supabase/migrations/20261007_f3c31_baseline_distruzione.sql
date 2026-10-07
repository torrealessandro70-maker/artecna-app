-- SOLO LOCALE. Ordine esplicito: core F3C3 -> questo prerequisito -> F3C3.2 -> F3C3.3.
-- Sostituzione di DUE corpi letterali certificati (prima/dopo); nessuna normalizzazione generica.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';
SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path TO pg_catalog,public;
LOCK TABLE public.cantieri,public.rapportini,public.foto_cantiere,artecna_rapportini.allegati IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE f3c31_before ON COMMIT DROP AS SELECT to_jsonb(p) metadata FROM pg_proc p WHERE oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)');
CREATE TEMP TABLE f3c31_members ON COMMIT DROP AS SELECT to_jsonb(m) metadata FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole;
DO $bridge$
DECLARE p record; ddl text; b jsonb:=$baseline${"acl":[{"grantee":"authenticated","grantor":"artecna_cantieri_delete_rpc","grantable":false,"privilege":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"artecna_cantieri_delete_rpc","grantable":false,"privilege":"EXECUTE"}],"oid":"166199","nome":"elimina_cantiere_definitivamente","firma":"public.elimina_cantiere_definitivamente(uuid, text)","owner":"artecna_cantieri_delete_rpc","prosrc":"\r\r\nDECLARE\r\r\n  v_user uuid;\r\r\n  v_id uuid;\r\r\n  v_varianti uuid[];\r\r\n  v_raccolte uuid[];\r\r\n  v_economia_sorgenti uuid[];\r\r\n  v_economia_righe uuid[];\r\r\n  v_economia_figli constant text[]:=ARRAY['economia_sorgenti','economia_righe']::text[];\r\r\n  v_preventivi text[];\r\r\n  v_base_lavorazioni bigint[];\r\r\n  v_var_lavorazioni bigint[];\r\r\n  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','economia_raccolte','economia_sorgenti','economia_righe']::text[];\r\r\n  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];\r\r\n  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','economia_raccolte']::text[];\r\r\n  v_eliminate jsonb := '{}'::jsonb;\r\r\n  v_n bigint;\r\r\n  v_totale_lavorazioni bigint;\r\r\n  v_residuo boolean;\r\r\n  v_esterna boolean;\r\r\n  v_on text;\r\r\n  v_padre text;\r\r\n  v_figlio text;\r\r\n  v_sql text;\r\r\n  v_jobs_prima record;\r\r\n  v_jobs_vecchi record;\r\r\n  v_jobs_preparati record;\r\r\n  v_jobs_dopo record;\r\r\n  t text;\r\r\n  fk record;\r\r\n  m record;\r\r\nBEGIN\r\r\n  IF current_user <> 'artecna_cantieri_delete_rpc' THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';\r\r\n  END IF;\r\r\n  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';\r\r\n  END IF;\r\r\n  v_user := artecna_guardie.utente_jwt_corrente();\r\r\n  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;\r\r\n  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';\r\r\n  END IF;\r\r\n  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;\r\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\r\n  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';\r\r\n  END IF;\r\r\n  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\r\n  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';\r\r\n  END IF;\r\r\n  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);\r\r\n  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';\r\r\n  END IF;\r\r\n  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.\r\r\n  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;\r\r\n  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;\r\r\n  PERFORM e.id FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id ORDER BY e.id FOR UPDATE;\r\r\n  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_raccolte FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;\r\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\r\n    IF t='cantieri' THEN CONTINUE; END IF;\r\r\n    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);\r\r\n    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);\r\r\n    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;\r\r\n    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti,v_raccolte LOOP NULL; END LOOP;\r\r\n  END LOOP;\r\r\n  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_sorgenti FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);\r\r\n  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_righe FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);\r\r\n  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;\r\r\n  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;\r\r\n  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);\r\r\n  IF (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass))<>4 THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Economia divergente'; END IF;\r\r\n  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.\r\r\n  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.\r\r\n  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio\r\r\n    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid\r\r\n      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace\r\r\n      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace\r\r\n    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)\r\r\n    ORDER BY k.oid\r\r\n  LOOP\r\r\n    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN\r\r\n      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);\r\r\n    END IF;\r\r\n    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on\r\r\n      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)\r\r\n      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum\r\r\n      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;\r\r\n    -- Le FK che coinvolgono Economia devono appartenere all'esatto grafo V1.\r\r\n    IF fk.padre IN ('economia_raccolte','economia_sorgenti','economia_righe') OR fk.figlio IN ('economia_raccolte','economia_sorgenti','economia_righe') THEN\r\r\n      IF fk.ns_padre<>'public' OR fk.ns_figlio<>'public' OR fk.confdeltype<>'r' OR fk.condeferrable OR fk.condeferred\r\r\n        OR NOT (\r\r\n          (fk.conname='economia_raccolte_cantiere_fk' AND fk.figlio='economia_raccolte' AND fk.padre='cantieri'\r\r\n            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='cantiere_id')]::smallint[]\r\r\n            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])\r\r\n          OR (((fk.figlio='economia_sorgenti' AND fk.conname='economia_sorgenti_raccolta_fk') OR (fk.figlio='economia_righe' AND fk.conname='economia_righe_raccolta_fk'))\r\r\n            AND fk.figlio=ANY(v_economia_figli) AND fk.padre='economia_raccolte'\r\r\n            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]\r\r\n            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])\r\r\n          OR (fk.conname='economia_righe_sorgente_fk' AND fk.figlio='economia_righe' AND fk.padre='economia_sorgenti'\r\r\n            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='sorgente_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]\r\r\n            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='raccolta_id')]::smallint[])\r\r\n        ) THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Economia non certificata'; END IF;\r\r\n    END IF;\r\r\n    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';\r\r\n    ELSIF fk.padre=ANY(v_economia_figli) THEN v_padre:='t.raccolta_id=ANY($3)';\r\r\n    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';\r\r\n    ELSE v_padre:='t.cantiere_id=$1'; END IF;\r\r\n    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';\r\r\n    ELSIF fk.figlio=ANY(v_economia_figli) THEN v_figlio:='f.raccolta_id=ANY($3)';\r\r\n    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';\r\r\n    ELSE v_figlio:='f.cantiere_id=$1'; END IF;\r\r\n    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);\r\r\n    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti,v_raccolte;\r\r\n    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;\r\r\n  END LOOP;\r\r\n  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;\r\r\n  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;\r\r\n  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\r\n  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);\r\r\n  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);\r\r\n  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\r\n  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta\r\r\n     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';\r\r\n  END IF;\r\r\n  DELETE FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);\r\r\n  GET DIAGNOSTICS v_n=ROW_COUNT;\r\r\n  v_eliminate:=v_eliminate||jsonb_build_object('economia_righe',v_n);\r\r\n  DELETE FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);\r\r\n  GET DIAGNOSTICS v_n=ROW_COUNT;\r\r\n  v_eliminate:=v_eliminate||jsonb_build_object('economia_sorgenti',v_n);\r\r\n  DELETE FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n=ROW_COUNT;\r\r\n  v_eliminate:=v_eliminate||jsonb_build_object('economia_raccolte',v_n);\r\r\n  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);\r\r\n  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);\r\r\n  v_totale_lavorazioni := 0;\r\r\n  LOOP\r\r\n    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)\r\r\n      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);\r\r\n    GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n    v_totale_lavorazioni := v_totale_lavorazioni + v_n;\r\r\n    IF v_n=0 THEN\r\r\n      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN\r\r\n        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';\r\r\n      END IF;\r\r\n      EXIT;\r\r\n    END IF;\r\r\n  END LOOP;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);\r\r\n  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);\r\r\n  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);\r\r\n  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL\r\r\n    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;\r\r\n  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);\r\r\n  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n);\r\r\n  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);\r\r\n  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);\r\r\n  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);\r\r\n  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);\r\r\n  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);\r\r\n  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);\r\r\n  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);\r\r\n  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);\r\r\n  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);\r\r\n  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);\r\r\n  -- Post-check dei dati protetti PRIMA di terminare il contesto.\r\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\r\n    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;\r\r\n    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);\r\r\n    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);\r\r\n    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;\r\r\n    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;\r\r\n    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN\r\r\n      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);\r\r\n    END IF;\r\r\n  END LOOP;\r\r\n  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))\r\r\n     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))\r\r\n     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';\r\r\n  END IF;\r\r\n  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);\r\r\n  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';\r\r\n  END IF;\r\r\n  PERFORM artecna_distruzione.termina_contesto();\r\r\n  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;\r\r\n  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';\r\r\n  END IF;\r\r\n  -- Ultima cancellazione applicativa.\r\r\n  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;\r\r\n  GET DIAGNOSTICS v_n = ROW_COUNT;\r\r\n  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';\r\r\n  END IF;\r\r\n  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.\r\r\n  FOREACH t IN ARRAY v_tabelle LOOP\r\r\n    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';\r\r\n    ELSIF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);\r\r\n    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);\r\r\n    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;\r\r\n    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;\r\r\n    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;\r\r\n  END LOOP;\r\r\n  IF EXISTS(SELECT 1 FROM public.economia_raccolte e WHERE e.id=ANY(v_raccolte))\r\r\n    OR EXISTS(SELECT 1 FROM public.economia_sorgenti e WHERE e.id=ANY(v_economia_sorgenti))\r\r\n    OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.id=ANY(v_economia_righe)) THEN\r\r\n    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita Economia residue'; END IF;\r\r\n  cantiere_id := p_cantiere_id;\r\r\n  eliminato := true;\r\r\n  RETURN NEXT;\r\r\nEXCEPTION WHEN foreign_key_violation THEN\r\r\n  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.\r\r\n  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;\r\r\nEND;\r\r\n\r\r\n  ","result":"TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)","schema":"public","acl_raw":"{artecna_cantieri_delete_rpc=X/artecna_cantieri_delete_rpc,authenticated=X/artecna_cantieri_delete_rpc}","prokind":"f","defaults":null,"language":"plpgsql","argomenti":"p_cantiere_id uuid, p_conferma text","proconfig":["search_path=pg_catalog, pg_temp"],"cr_isolati":true,"n_defaults":0,"volatility":"v","returns_set":true,"search_path":"search_path=pg_catalog, pg_temp","sha256_crlf_lf":"4bbfb93fdf41d913530668832dad35dc2a67b0fb4394c3b3d36d6f62fb7ebc4e","security_definer":true,"execute_effettivo":[{"ruolo":"anon","execute":false,"schema_usage":true},{"ruolo":"artecna_cantieri_delete_rpc","execute":true,"schema_usage":true},{"ruolo":"artecna_cantieri_rpc","execute":false,"schema_usage":true},{"ruolo":"artecna_economia_rpc","execute":false,"schema_usage":true},{"ruolo":"artecna_ponte_economia_rpc","execute":false,"schema_usage":true},{"ruolo":"artecna_preventivi_rpc","execute":false,"schema_usage":true},{"ruolo":"artecna_rapportini_backend","execute":false,"schema_usage":true},{"ruolo":"artecna_rapportini_rpc","execute":false,"schema_usage":true},{"ruolo":"artecna_sal_rpc","execute":false,"schema_usage":true},{"ruolo":"artecna_varianti_rpc","execute":false,"schema_usage":true},{"ruolo":"authenticated","execute":true,"schema_usage":true},{"ruolo":"authenticator","execute":false,"schema_usage":true},{"ruolo":"dashboard_user","execute":false,"schema_usage":true},{"ruolo":"pg_checkpoint","execute":false,"schema_usage":true},{"ruolo":"pg_create_subscription","execute":false,"schema_usage":true},{"ruolo":"pg_database_owner","execute":false,"schema_usage":true},{"ruolo":"pg_execute_server_program","execute":false,"schema_usage":true},{"ruolo":"pg_maintain","execute":false,"schema_usage":true},{"ruolo":"pg_monitor","execute":false,"schema_usage":true},{"ruolo":"pg_read_all_data","execute":false,"schema_usage":true},{"ruolo":"pg_read_all_settings","execute":false,"schema_usage":true},{"ruolo":"pg_read_all_stats","execute":false,"schema_usage":true},{"ruolo":"pg_read_server_files","execute":false,"schema_usage":true},{"ruolo":"pg_signal_backend","execute":false,"schema_usage":true},{"ruolo":"pg_stat_scan_tables","execute":false,"schema_usage":true},{"ruolo":"pg_use_reserved_connections","execute":false,"schema_usage":true},{"ruolo":"pg_write_all_data","execute":false,"schema_usage":true},{"ruolo":"pg_write_server_files","execute":false,"schema_usage":true},{"ruolo":"pgbouncer","execute":false,"schema_usage":true},{"ruolo":"postgres","execute":true,"schema_usage":true},{"ruolo":"service_role","execute":false,"schema_usage":true},{"ruolo":"supabase_admin","execute":true,"schema_usage":true},{"ruolo":"supabase_auth_admin","execute":false,"schema_usage":true},{"ruolo":"supabase_etl_admin","execute":false,"schema_usage":true},{"ruolo":"supabase_privileged_role","execute":false,"schema_usage":true},{"ruolo":"supabase_read_only_user","execute":false,"schema_usage":true},{"ruolo":"supabase_realtime_admin","execute":false,"schema_usage":true},{"ruolo":"supabase_replication_admin","execute":false,"schema_usage":true},{"ruolo":"supabase_storage_admin","execute":false,"schema_usage":true}]}$baseline$::jsonb;
canonical text:=$canonical$
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

  $canonical$;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'F3C3.1 prerequisite: installer postgres'; END IF;
 SELECT p0.*,l.lanname INTO p FROM pg_proc p0 JOIN pg_language l ON l.oid=p0.prolang WHERE p0.oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)');
 IF NOT FOUND OR p.prosrc IS DISTINCT FROM b->>'prosrc'
 OR encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') IS DISTINCT FROM b->>'sha256_crlf_lf'
 OR length(replace(p.prosrc,E'\r\n',''))-length(replace(replace(p.prosrc,E'\r\n',''),E'\r',''))<>256
 OR pg_get_userbyid(p.proowner) IS DISTINCT FROM b->>'owner'
 OR p.proacl::text IS DISTINCT FROM b->>'acl_raw'
 OR to_jsonb(p.proconfig) IS DISTINCT FROM b->'proconfig'
 OR p.lanname IS DISTINCT FROM b->>'language' OR p.prosecdef IS DISTINCT FROM (b->>'security_definer')::boolean
 OR p.provolatile::text IS DISTINCT FROM b->>'volatility' OR p.prokind::text IS DISTINCT FROM b->>'prokind'
 OR pg_get_function_arguments(p.oid) IS DISTINCT FROM b->>'argomenti'
 OR pg_get_function_result(p.oid) IS DISTINCT FROM b->>'result'
 OR p.pronargdefaults<>(b->>'n_defaults')::integer OR p.proisstrict OR NOT p.proretset
 THEN RAISE EXCEPTION 'F3C3.1 prerequisite: baseline Production divergente'; END IF;
 IF has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'F3C3.1 prerequisite: privilegi divergenti'; END IF;
 ddl:=replace(pg_get_functiondef(p.oid),p.prosrc,canonical);
 IF ddl=pg_get_functiondef(p.oid) THEN RAISE EXCEPTION 'F3C3.1 prerequisite: sostituzione assente'; END IF;
 GRANT artecna_cantieri_delete_rpc TO postgres WITH INHERIT FALSE GRANTED BY postgres;
GRANT artecna_cantieri_delete_rpc TO postgres WITH SET TRUE GRANTED BY postgres;
GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc;
SET LOCAL ROLE artecna_cantieri_delete_rpc;
EXECUTE ddl;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc;
REVOKE artecna_cantieri_delete_rpc FROM postgres GRANTED BY postgres RESTRICT;
END;
$bridge$;
-- F3C31_POSTCHECK
DO $post$
BEGIN
 IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) IS DISTINCT FROM (SELECT metadata-'prosrc' FROM f3c31_before)
 OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure)<>'3f547540c57fb860dad4a49c84639145303330bbd134cee440e3a1a9ec6058a3'
 OR has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE')
 OR EXISTS((SELECT metadata FROM f3c31_members EXCEPT SELECT to_jsonb(m) FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole) UNION ALL (SELECT to_jsonb(m) FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole EXCEPT SELECT metadata FROM f3c31_members))
 THEN RAISE EXCEPTION 'F3C3.1 prerequisite: post-check metadata/hash/membership'; END IF;
END;
$post$;
COMMIT;
