-- PREREQUISITO LOCALE. Non installata; nessuna modifica alla RPC hard-delete/UI.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('artecna_distruzione.cleanup_storage') IS NULL THEN
  RAISE EXCEPTION 'Baseline/installer Storage inatteso'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_storage_worker') THEN CREATE ROLE artecna_storage_worker NOLOGIN; END IF;
END $$;
CREATE TABLE artecna_distruzione.storage_oggetti (
 bucket text NOT NULL CHECK(bucket<>''), path text NOT NULL CHECK(path<>''),
 stato text NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','cancellazione','cancellato')),
 cleanup_autorizzato boolean NOT NULL DEFAULT false,prova_cleanup text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(bucket,path)
);
CREATE TABLE artecna_distruzione.storage_riferimenti (
 bucket text NOT NULL,path text NOT NULL,source_table text NOT NULL,source_id jsonb NOT NULL,
 cantiere_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(bucket,path,source_table,source_id),
 FOREIGN KEY(bucket,path) REFERENCES artecna_distruzione.storage_oggetti(bucket,path) ON DELETE RESTRICT
);
CREATE INDEX storage_riferimenti_source ON artecna_distruzione.storage_riferimenti(source_table,source_id);
CREATE TABLE artecna_distruzione.storage_sorgenti (
 relation regclass PRIMARY KEY,pk text[] NOT NULL,fields jsonb NOT NULL,
 json_fields text[] NOT NULL DEFAULT '{}',json_bucket text
);
CREATE TABLE artecna_distruzione.storage_anomalie (
 source_table text NOT NULL,source_id jsonb NOT NULL,motivo text NOT NULL,
 PRIMARY KEY(source_table,source_id,motivo)
);
CREATE TABLE artecna_distruzione.storage_copertura (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),completa boolean NOT NULL DEFAULT false
);
INSERT INTO artecna_distruzione.storage_copertura VALUES(true,false);
ALTER TABLE artecna_distruzione.cleanup_storage
 ALTER COLUMN cantiere_id DROP NOT NULL,
 ADD COLUMN lease_id uuid, ADD COLUMN lease_backend integer, ADD COLUMN lease_until timestamptz,
 ADD COLUMN retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ADD COLUMN permanente boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX cleanup_storage_global_object ON artecna_distruzione.cleanup_storage(bucket,path) WHERE cantiere_id IS NULL;
CREATE INDEX cleanup_storage_claim ON artecna_distruzione.cleanup_storage(retry_at,id) WHERE stato<>'completed' AND NOT permanente;

CREATE FUNCTION artecna_distruzione.storage_lock_key(b text,p text) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$ SELECT hashtextextended(b||chr(31)||p,7112026) $$;
CREATE FUNCTION artecna_distruzione.storage_decode(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE v bytea:=''::bytea;i integer:=1;c text;
BEGIN
 WHILE i<=length(p) LOOP c:=substr(p,i,1);
  IF c='%' THEN
   IF substr(p,i+1,2)!~'^[0-9a-fA-F]{2}$' THEN RAISE EXCEPTION 'Encoding Storage non valido'; END IF;
   v:=v||decode(substr(p,i+1,2),'hex');i:=i+3;
  ELSE v:=v||convert_to(c,'UTF8');i:=i+1; END IF;
 END LOOP; RETURN convert_from(v,'UTF8');
END $$;
CREATE FUNCTION artecna_distruzione.storage_uri(uri text) RETURNS TABLE(bucket text,path text)
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE rest text;
BEGIN
 IF uri LIKE 'quaderno-storage:%' THEN bucket:='quaderno-privato';path:=artecna_distruzione.storage_decode(substr(uri,length('quaderno-storage:')+1));
 ELSIF uri LIKE 'quaderno-sopralluogo:%' THEN bucket:='quaderno-sopralluoghi';path:=artecna_distruzione.storage_decode(substr(uri,length('quaderno-sopralluogo:')+1));
 ELSIF uri ~ '^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/' THEN
  rest:=regexp_replace(split_part(split_part(uri,'?',1),'#',1),'^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/','');
  bucket:=artecna_distruzione.storage_decode(split_part(rest,'/',1));
  path:=artecna_distruzione.storage_decode(substr(rest,length(split_part(rest,'/',1))+2));
 ELSE RETURN; END IF;
 IF bucket='' OR path='' OR bucket LIKE '%/%' THEN RAISE EXCEPTION 'Identità Storage non valida'; END IF;
 RETURN NEXT;
END $$;
CREATE FUNCTION artecna_distruzione.storage_json_ambiguo(j jsonb,b text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb;bk text;
BEGIN
 IF jsonb_typeof(j)='array' THEN
  FOR v IN SELECT value FROM jsonb_array_elements(j) LOOP IF artecna_distruzione.storage_json_ambiguo(v,b) THEN RETURN true; END IF; END LOOP;
 ELSIF jsonb_typeof(j)='object' THEN
  bk:=coalesce(j->>'storage_bucket',j->>'bucket',b);
  IF coalesce(j->>'storage_path',j->>'file_path') IS NOT NULL AND bk IS NULL THEN RETURN true; END IF;
  FOR v IN SELECT value FROM jsonb_each(j) LOOP IF artecna_distruzione.storage_json_ambiguo(v,bk) THEN RETURN true; END IF; END LOOP;
 END IF;RETURN false;
END $$;
CREATE FUNCTION artecna_distruzione.storage_json(j jsonb,b text DEFAULT NULL)
RETURNS TABLE(bucket text,path text) LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE x jsonb;k text;v jsonb;bk text;pk text;
BEGIN
 IF jsonb_typeof(j)='string' THEN RETURN QUERY SELECT * FROM artecna_distruzione.storage_uri(j#>>'{}');
 ELSIF jsonb_typeof(j)='array' THEN FOR x IN SELECT value FROM jsonb_array_elements(j) LOOP
  RETURN QUERY SELECT * FROM artecna_distruzione.storage_json(x,b); END LOOP;
 ELSIF jsonb_typeof(j)='object' THEN
  bk:=coalesce(j->>'storage_bucket',j->>'bucket',b);
  pk:=coalesce(j->>'storage_path',j->>'file_path');
  IF pk IS NOT NULL AND bk IS NOT NULL AND pk<>'' THEN
   IF pk ~ '^[A-Za-z][A-Za-z0-9+.-]*:' THEN RETURN QUERY SELECT * FROM artecna_distruzione.storage_uri(pk);
   ELSE bucket:=bk;path:=pk;RETURN NEXT; END IF;
  END IF;
  FOR k,v IN SELECT * FROM jsonb_each(j) LOOP RETURN QUERY SELECT * FROM artecna_distruzione.storage_json(v,bk); END LOOP;
 END IF;
END $$;
CREATE FUNCTION artecna_distruzione.storage_extract(j jsonb,fields jsonb,js text[],jb text)
RETURNS TABLE(bucket text,path text) LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE f record;v text;b text;k text;
BEGIN
 FOR f IN SELECT * FROM jsonb_each(fields) LOOP
  v:=j->>f.key; IF v IS NULL OR v='' THEN CONTINUE; END IF;
  IF f.value->>'provider_column' IS NOT NULL AND j->>(f.value->>'provider_column') IS DISTINCT FROM 'cloud' THEN CONTINUE; END IF;
  IF f.value->>'kind'='path' THEN
   b:=coalesce(j->>(f.value->>'bucket_column'),f.value->>'bucket');
   IF v ~ '^[A-Za-z][A-Za-z0-9+.-]*:' THEN RETURN QUERY SELECT * FROM artecna_distruzione.storage_uri(v);
   ELSIF b IS NOT NULL THEN bucket:=b;path:=v;RETURN NEXT; END IF;
  ELSE RETURN QUERY SELECT * FROM artecna_distruzione.storage_uri(v); END IF;
 END LOOP;
 FOREACH k IN ARRAY js LOOP RETURN QUERY SELECT * FROM artecna_distruzione.storage_json(j->k,jb); END LOOP;
END $$;
CREATE FUNCTION artecna_distruzione.storage_pk(j jsonb,keys text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$ SELECT jsonb_object_agg(k,j->k) FROM unnest(keys) k $$;
CREATE FUNCTION artecna_distruzione.storage_indicizza(tab regclass,oldj jsonb,newj jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cfg artecna_distruzione.storage_sorgenti;identity jsonb;t text;r record;cid uuid;k text;jb text;previous jsonb;
BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation=tab;
 SELECT n.nspname||'.'||c.relname INTO t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=tab;
 identity:=artecna_distruzione.storage_pk(coalesce(newj,oldj),cfg.pk);
 IF oldj IS NOT NULL AND newj IS NOT NULL AND artecna_distruzione.storage_pk(oldj,cfg.pk)<>identity THEN
  RAISE EXCEPTION 'Identità sorgente Storage immutabile'; END IF;
 cid:=nullif(coalesce(newj,oldj)->>'cantiere_id','')::uuid;
 jb:=cfg.json_bucket;
 IF jb=':gestione' THEN jb:=CASE WHEN coalesce(newj,oldj)->>'tipo'='rimuovi' THEN 'quaderno-sopralluoghi' ELSE 'quaderno-privato' END; END IF;
 DELETE FROM artecna_distruzione.storage_anomalie WHERE source_table=t AND source_id=identity;
 FOR r IN SELECT * FROM jsonb_each(cfg.fields) LOOP
  IF r.value->>'provider_column' IS NOT NULL AND newj->>r.key IS NOT NULL
   AND newj->>(r.value->>'provider_column') IS NULL THEN
   INSERT INTO artecna_distruzione.storage_anomalie VALUES(t,identity,'Provider non dimostrato in '||r.key) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 FOREACH k IN ARRAY cfg.json_fields LOOP
  IF artecna_distruzione.storage_json_ambiguo(newj->k,jb) THEN
   INSERT INTO artecna_distruzione.storage_anomalie VALUES(t,identity,'Bucket non dimostrato in '||k) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 -- Ordine deterministico; il worker tiene lo stesso advisory lock di sessione
 -- durante la richiesta HTTP. Il gate resta chiuso anche dopo crash/lease scaduto.
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'path',path)),'[]'::jsonb) INTO previous
  FROM artecna_distruzione.storage_riferimenti WHERE source_table=t AND source_id=identity;
 FOR r IN SELECT value->>'bucket' bucket,value->>'path' path FROM jsonb_array_elements(previous)
  UNION SELECT bucket,path FROM artecna_distruzione.storage_extract(newj,cfg.fields,cfg.json_fields,jb) ORDER BY 1,2 LOOP
  PERFORM pg_advisory_xact_lock(artecna_distruzione.storage_lock_key(r.bucket,r.path));
  INSERT INTO artecna_distruzione.storage_oggetti(bucket,path) VALUES(r.bucket,r.path) ON CONFLICT DO NOTHING;
 END LOOP;
 DELETE FROM artecna_distruzione.storage_riferimenti WHERE source_table=t AND source_id=identity;
 FOR r IN SELECT DISTINCT bucket,path FROM artecna_distruzione.storage_extract(newj,cfg.fields,cfg.json_fields,jb) LOOP
  IF (SELECT stato FROM artecna_distruzione.storage_oggetti WHERE bucket=r.bucket AND path=r.path)<>'attivo' THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Oggetto Storage in cancellazione o tombstone: usare una nuova key'; END IF;
  INSERT INTO artecna_distruzione.storage_riferimenti(bucket,path,source_table,source_id,cantiere_id) VALUES(r.bucket,r.path,t,identity,cid);
  -- Only audited creator namespaces grant cleanup authority. Arbitrary URL/JSON
  -- references protect an object but cannot confer service-role DELETE power.
  IF (t='artecna_rapportini.allegati' AND r.bucket='rapportini-v1'
    AND r.path='rapportini/'||(newj->>'cantiere_id')||'/'||(newj->>'rapportino_id')||'/'||(newj->>'chiave_client_allegato')||
      CASE newj->>'mime_type' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' END)
   OR (t='public.quaderno_allegati' AND r.bucket='quaderno-privato' AND starts_with(r.path,'utenti/'||(newj->>'user_id')||'/quaderni/'||(newj->>'nota_id')||'/'))
   OR (t='public.quaderno_copie_allegati' AND r.bucket='quaderno-sopralluoghi' AND starts_with(r.path,'utenti/'||(newj->>'user_id')||'/richiami/'||(newj->>'richiamo_id')||'/')) THEN
   UPDATE artecna_distruzione.storage_oggetti SET cleanup_autorizzato=true,prova_cleanup='namespace_creatore_verificato' WHERE bucket=r.bucket AND path=r.path;
  END IF;
 END LOOP;
 FOR r IN SELECT value->>'bucket' bucket,value->>'path' path FROM jsonb_array_elements(previous)
 EXCEPT SELECT bucket,path FROM artecna_distruzione.storage_extract(newj,cfg.fields,cfg.json_fields,jb) LOOP
  INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path) VALUES(cid,r.bucket,r.path) ON CONFLICT DO NOTHING;
  UPDATE artecna_distruzione.cleanup_storage SET retry_at=clock_timestamp()
   WHERE bucket=r.bucket AND path=r.path AND stato<>'completed' AND NOT permanente AND lease_until IS NULL;
 END LOOP;
END $$;
CREATE FUNCTION artecna_distruzione.storage_autorizza_cleanup(b text,p text,prova text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF nullif(btrim(prova),'') IS NULL THEN RAISE EXCEPTION 'Prova indipendente di ownership richiesta'; END IF;
 PERFORM pg_advisory_xact_lock(artecna_distruzione.storage_lock_key(b,p));
 UPDATE artecna_distruzione.storage_oggetti SET cleanup_autorizzato=true,prova_cleanup=prova WHERE bucket=b AND path=p AND stato='attivo';
 IF NOT FOUND THEN RAISE EXCEPTION 'Oggetto non registrato o non riutilizzabile'; END IF;
 UPDATE artecna_distruzione.cleanup_storage SET permanente=false,retry_at=clock_timestamp()
  WHERE bucket=b AND path=p AND stato<>'completed' AND lease_until IS NULL AND ultimo_errore='NO_CLEANUP_AUTHORITY';
END $$;
CREATE FUNCTION artecna_distruzione.storage_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'Storage: usare rimozione per riga'; END IF;
 PERFORM artecna_distruzione.storage_indicizza(TG_RELID,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 RETURN NULL;
END $$;
CREATE FUNCTION artecna_distruzione.numero_riferimenti_vivi(b text,p text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT count(*) FROM artecna_distruzione.storage_riferimenti WHERE bucket=b AND path=p
$$;
CREATE FUNCTION artecna_distruzione.storage_copertura_valida() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT (SELECT completa FROM artecna_distruzione.storage_copertura WHERE singleton)
 AND NOT EXISTS(
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
  AND (n.nspname='public' OR n.nspname LIKE 'artecna\_%' ESCAPE '\')
  AND c.oid NOT IN ('artecna_distruzione.storage_oggetti'::regclass,'artecna_distruzione.storage_sorgenti'::regclass,'artecna_distruzione.storage_riferimenti'::regclass,'artecna_distruzione.storage_anomalie'::regclass,'artecna_distruzione.cleanup_storage'::regclass)
  AND (a.atttypid IN ('json'::regtype,'jsonb'::regtype) OR a.attname IN ('file_path','storage_path','file_url','thumbnail_url','pdf_url','xml_url','immagine_base64','storage_bucket','bucket'))
  AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.storage_sorgenti s WHERE s.relation=c.oid
   AND (s.fields ? a.attname OR a.attname=ANY(s.json_fields) OR EXISTS(SELECT 1 FROM jsonb_each(s.fields) f WHERE f.value->>'bucket_column'=a.attname)))
 ) AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.storage_sorgenti s WHERE NOT EXISTS(
  SELECT 1 FROM pg_trigger t WHERE t.tgrelid=s.relation AND t.tgname='storage_registry_reference' AND t.tgenabled IN ('O','A')))
$$;
CREATE FUNCTION artecna_distruzione.storage_claim() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE j artecna_distruzione.cleanup_storage;k bigint;token uuid;
BEGIN
 IF NOT pg_has_role(session_user,'artecna_storage_worker','MEMBER') THEN RAISE EXCEPTION 'Worker non autorizzato' USING ERRCODE='42501'; END IF;
 IF NOT artecna_distruzione.storage_copertura_valida() OR EXISTS(SELECT 1 FROM artecna_distruzione.storage_anomalie) THEN
  RAISE EXCEPTION 'Copertura Storage non certificata'; END IF;
 FOR j IN SELECT * FROM artecna_distruzione.cleanup_storage WHERE stato<>'completed' AND NOT permanente AND retry_at<=clock_timestamp()
  AND (lease_until IS NULL OR lease_until<clock_timestamp()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
  k:=artecna_distruzione.storage_lock_key(j.bucket,j.path);
  IF NOT pg_try_advisory_lock(k) THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM artecna_distruzione.storage_oggetti WHERE bucket=j.bucket AND path=j.path) THEN
   UPDATE artecna_distruzione.cleanup_storage SET stato='failed',permanente=true,ultimo_errore='UNREGISTERED_OBJECT' WHERE id=j.id;
   PERFORM pg_advisory_unlock(k);CONTINUE;
  END IF;
  IF NOT (SELECT cleanup_autorizzato FROM artecna_distruzione.storage_oggetti WHERE bucket=j.bucket AND path=j.path) THEN
   UPDATE artecna_distruzione.cleanup_storage SET stato='failed',permanente=true,ultimo_errore='NO_CLEANUP_AUTHORITY' WHERE id=j.id;
   PERFORM pg_advisory_unlock(k);CONTINUE;
  END IF;
  IF artecna_distruzione.numero_riferimenti_vivi(j.bucket,j.path)>0 THEN
   UPDATE artecna_distruzione.cleanup_storage SET retry_at=clock_timestamp()+interval '5 minutes',ultimo_errore='REFERENCED' WHERE id=j.id;
   PERFORM pg_advisory_unlock(k);CONTINUE;
  END IF;
  UPDATE artecna_distruzione.storage_oggetti SET stato='cancellazione' WHERE bucket=j.bucket AND path=j.path;
  token:=gen_random_uuid();
  UPDATE artecna_distruzione.cleanup_storage SET lease_id=token,lease_backend=pg_backend_pid(),lease_until=clock_timestamp()+interval '2 minutes',tentativi=tentativi+1 WHERE id=j.id;
  RETURN jsonb_build_object('id',j.id::text,'bucket',j.bucket,'path',j.path,'token',token,'lock_key',k::text,'attempt',j.tentativi+1);
 END LOOP;RETURN NULL;
END $$;
CREATE FUNCTION artecna_distruzione.storage_finish(job bigint,token uuid,ok boolean,permanent boolean,reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE j artecna_distruzione.cleanup_storage;
BEGIN
 IF NOT pg_has_role(session_user,'artecna_storage_worker','MEMBER') THEN RAISE EXCEPTION 'Worker non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT j FROM artecna_distruzione.cleanup_storage WHERE id=job AND lease_id=token AND lease_backend=pg_backend_pid() FOR UPDATE;
 IF ok THEN
  IF artecna_distruzione.numero_riferimenti_vivi(j.bucket,j.path)<>0 THEN RAISE EXCEPTION 'Riferimenti inattesi'; END IF;
  UPDATE artecna_distruzione.storage_oggetti SET stato='cancellato' WHERE bucket=j.bucket AND path=j.path;
  UPDATE artecna_distruzione.cleanup_storage SET stato='completed',completed_at=clock_timestamp(),lease_id=NULL,lease_backend=NULL,lease_until=NULL,ultimo_errore='' WHERE bucket=j.bucket AND path=j.path;
 ELSE
  UPDATE artecna_distruzione.cleanup_storage SET stato='failed',ultimo_errore=left(coalesce(reason,'UNKNOWN'),200),permanente=permanent,
   retry_at=clock_timestamp()+least(interval '1 hour',interval '5 seconds'*power(2,least(tentativi,10))),lease_id=NULL,lease_backend=NULL,lease_until=NULL WHERE id=job;
 END IF;
 -- L'advisory lock di sessione viene rilasciato dal finally del worker, anche
 -- se questa transazione fallisce. Il tombstone non viene mai riaperto.
END $$;
REVOKE ALL ON TABLE artecna_distruzione.storage_oggetti,artecna_distruzione.storage_riferimenti,
 artecna_distruzione.storage_sorgenti,artecna_distruzione.storage_anomalie,artecna_distruzione.storage_copertura
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION artecna_distruzione.storage_claim(),artecna_distruzione.storage_finish(bigint,uuid,boolean,boolean,text),artecna_distruzione.numero_riferimenti_vivi(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA artecna_distruzione TO artecna_storage_worker;
GRANT EXECUTE ON FUNCTION artecna_distruzione.storage_claim(),artecna_distruzione.storage_finish(bigint,uuid,boolean,boolean,text) TO artecna_storage_worker;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='artecna_distruzione'::regnamespace AND (proname LIKE 'storage_%' OR proname='numero_riferimenti_vivi') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);
 END LOOP;
END $$;
-- Sorgenti/backfill e revoca default EXECUTE completati dalla migration seguente.
COMMIT;
