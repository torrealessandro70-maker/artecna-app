-- Baseline autorevole: diagnosi_economia_timeout, funzioni_installate (CSV decodificato).
-- Solo classificazione del conflitto applicativo; nessuna esecuzione delle RPC.
BEGIN;
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
    "definizione": "CREATE OR REPLACE FUNCTION public.chiudi_raccolta_economia(p_raccolta_id uuid, p_revisione_attesa bigint)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nDECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;\r\n v_user := artecna_guardie.utente_jwt_corrente();\r\n IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;\r\n PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\n PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;\r\n SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;\r\n IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;\r\n IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revisione Economia divergente'; END IF;\r\n IF NOT EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id) OR EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richieste righe valorizzate'; END IF;\r\n UPDATE public.economia_raccolte e SET stato='chiusa',revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;\r\n RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),\r\n 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;\r\n$function$\n",
    "security_definer": true
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
    "definizione": "CREATE OR REPLACE FUNCTION public.salva_bozza_economia(p_raccolta_id uuid, p_revisione_attesa bigint, p_payload jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nDECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; a jsonb; k text; x jsonb; rid uuid; n integer; q numeric; pr numeric; seen uuid[]:=ARRAY[]::uuid[]; changed uuid[]:=ARRAY[]::uuid[];\r\nBEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;\r\n v_user := artecna_guardie.utente_jwt_corrente();\r\n IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;\r\n PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;\r\n PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;\r\n IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;\r\n SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;\r\n IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;\r\n IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;\r\n IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revisione Economia divergente'; END IF;\r\n IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(key) WHERE z.key NOT IN ('righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload Economia non valido'; END IF;\r\n FOREACH k IN ARRAY ARRAY['righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino'] LOOP\r\n  IF p_payload ? k AND jsonb_typeof(p_payload->k)<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni richiedono array'; END IF;\r\n END LOOP;\r\n SET CONSTRAINTS public.economia_righe_ordine_unique DEFERRED;\r\n -- Sorgenti nuove: ID esplicito consente riferimenti nel medesimo payload.\r\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'sorgenti_da_aggiungere','[]'::jsonb)) LOOP\r\n  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','nome_file','formato','file_sha256','snapshot_version','snapshot')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente non valida'; END IF;\r\n  rid:=(x->>'id')::uuid; IF rid IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID sorgente obbligatorio'; END IF;\r\n  INSERT INTO public.economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)\r\n    VALUES(rid,v_r.id,x->>'nome_file',x->>'formato',x->>'file_sha256',coalesce((x->>'snapshot_version')::integer,1),x->'snapshot',v_user);\r\n END LOOP;\r\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'righe_da_eliminare','[]'::jsonb)) LOOP\r\n  IF jsonb_typeof(x)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID riga richiesto'; END IF;\r\n  rid:=(x #>> '{}')::uuid;\r\n  IF rid=ANY(changed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione riga ripetuta'; END IF;\r\n  DELETE FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id;\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\r\n  changed:=array_append(changed,rid);\r\n END LOOP;\r\n -- Modifiche esplicite: contenuto completo della sola riga indicata, provenienza immutabile.\r\n FOREACH k IN ARRAY ARRAY['righe_da_modificare','righe_da_creare'] LOOP\r\n  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) LOOP\r\n   IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non valida'; END IF;\r\n   q:=(x->>'quantita')::numeric; pr:=(x->>'prezzo_unitario')::numeric;\r\n   IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') OR q<>round(q,6)\r\n     OR (pr IS NOT NULL AND (pr<0 OR pr::text IN ('NaN','Infinity','-Infinity') OR pr<>round(pr,6))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione o valore numerico non valido'; END IF;\r\n   rid:=(x->>'id')::uuid;\r\n   IF k='righe_da_modificare' THEN\r\n    IF rid IS NULL OR rid=ANY(changed) OR x ? 'origine' OR x ? 'sorgente_id' OR x ? 'indice_voce_sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica riga/provenienza non valida'; END IF;\r\n    UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,prezzo_unitario=pr,note=x->>'note',updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;\r\n    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;\r\n   ELSE\r\n    IF rid IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID nuova riga assegnato dal server'; END IF;\r\n    INSERT INTO public.economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,sorgente_id,indice_voce_sorgente,created_by)\r\n      VALUES(v_r.id,(x->>'ordine')::integer,x->>'descrizione',x->>'unita_misura',q,pr,x->>'note',x->>'origine',(x->>'sorgente_id')::uuid,(x->>'indice_voce_sorgente')::integer,v_user) RETURNING id INTO rid;\r\n   END IF;\r\n   changed:=array_append(changed,rid);\r\n  END LOOP;\r\n END LOOP;\r\n FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'riordino','[]'::jsonb)) LOOP\r\n  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino non valido'; END IF;\r\n  rid:=(x->>'id')::uuid; IF rid IS NULL OR rid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino ripetuto'; END IF;\r\n  UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;\r\n  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF; seen:=array_append(seen,rid);\r\n END LOOP;\r\n SET CONSTRAINTS public.economia_righe_ordine_unique IMMEDIATE;\r\n UPDATE public.economia_raccolte e SET revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;\r\n RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),\r\n 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;\r\n$function$\n",
    "security_definer": true
  }
]$baseline$::jsonb;
  v_old text := 'ERRCODE=''40001'',MESSAGE=''Revisione Economia divergente''';
  v_new text := 'ERRCODE=''PT409'',MESSAGE=''Revisione Economia divergente''';
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
       OR (length(v_prima.prosrc)-length(replace(v_prima.prosrc,v_old,''))) <> length(v_old)
       OR strpos(v_prima.prosrc,v_new) <> 0 THEN
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
    v_nuovo := replace(v_prima.prosrc,v_old,v_new);
    IF replace(v_nuovo,v_new,v_old) IS DISTINCT FROM v_prima.prosrc
       OR length(v_nuovo) <> length(v_prima.prosrc)
       OR strpos(v_nuovo,v_old) <> 0
       OR (length(v_nuovo)-length(replace(v_nuovo,v_new,''))) <> length(v_new) THEN
      RAISE EXCEPTION 'Sostituzione non unica/non reversibile';
    END IF;
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
