// Offline transformation of the already certified, read-only catalog classifier.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'supabase/validators/cantiere-prerequisiti'),original=fs.readFileSync(path.join(dir,'production-precheck-readonly.sql'),'utf8')
assert.equal(original.split('SELECT result FROM summary;').length,2)
const diff=`coalesce((SELECT jsonb_agg(jsonb_build_object('object',coalesce(a.key,b.key),'expected_fingerprint',a.value,'observed_fingerprint',b.value,'observed_catalog',(SELECT v FROM raw_objects WHERE k=coalesce(a.key,b.key))) ORDER BY coalesce(a.key,b.key)) FROM jsonb_each_text((SELECT objects FROM expected WHERE n=1)) a FULL JOIN jsonb_each_text((SELECT objects FROM observed)) b USING(key) WHERE a.value IS DISTINCT FROM b.value),'[]'::jsonb)`
let sql=original.replace('BEGIN READ ONLY;','BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;').replace('SELECT result FROM summary;',`SELECT result || jsonb_build_object('differences_from_expected_prefix1',${diff}) AS recovery_catalog FROM summary\n\\gset`).replace('ROLLBACK;','')
sql+=`SELECT (to_regclass('artecna_distruzione.storage_sorgenti') IS NOT NULL AND to_regclass('artecna_distruzione.storage_oggetti') IS NOT NULL AND to_regclass('artecna_distruzione.storage_riferimenti') IS NOT NULL AND to_regclass('artecna_distruzione.storage_anomalie') IS NOT NULL AND to_regclass('artecna_distruzione.storage_copertura') IS NOT NULL) AS recovery_tables_present
\\gset
\\if :recovery_tables_present
SELECT jsonb_build_object('sources',(SELECT count(*) FROM artecna_distruzione.storage_sorgenti),'objects',(SELECT count(*) FROM artecna_distruzione.storage_oggetti),'references',(SELECT count(*) FROM artecna_distruzione.storage_riferimenti),'anomalies',(SELECT count(*) FROM artecna_distruzione.storage_anomalie),'coverage',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM artecna_distruzione.storage_copertura t),'source_triggers',(SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN('storage_registry_reference','storage_registry_no_truncate'))) AS recovery_data
\\gset
\\else
\\set recovery_data '{"tables_missing":true}'
\\endif
WITH facts AS (SELECT :'recovery_catalog'::jsonb c,:'recovery_data'::jsonb d),checks AS (SELECT *,c->>'matched_prefix'='1' AND c->>'drift_status'='NO_CATALOG_DRIFT' AND c->>'read_only'='on' AND c->>'verdict'='STOP_ALREADY_APPLIED_PREFIX_1' AND ((c->>'installer_createrole')::boolean OR (c->>'installer_superuser')::boolean) AND c->>'worker_admin_authority'='DIRECT_ADMIN_CONFIRMED' AND NOT EXISTS(SELECT 1 FROM pg_language l WHERE l.lanname IN('sql','plpgsql') AND NOT has_language_privilege(current_user,l.oid,'USAGE')) AND c->>'migration_001_status'='ALREADY_EQUIVALENT' AND (SELECT bool_and(c->>('migration_'||lpad(i::text,3,'0')||'_status')='NOT_APPLIED') FROM generate_series(2,7) i) catalog_ok,d->>'sources'='0' AND d->>'objects'='0' AND d->>'references'='0' AND d->>'anomalies'='0' AND d->>'source_triggers'='0' AND d->'coverage'='[{"singleton":true,"completa":false}]'::jsonb data_ok FROM facts)
SELECT jsonb_build_object('report','CANTIERE_DELETE_RECOVERY_PRECHECK','database',c->'database','server_version',c->'server_version','principal',c->'principal','read_only',current_setting('transaction_read_only'),'matched_prefix',c->'matched_prefix','drift_status',c->'drift_status','installer_superuser',c->'installer_superuser','installer_createrole',c->'installer_createrole','worker_admin_authority',c->'worker_admin_authority','role_worker_status',c->'role_worker_status','role_login_status',c->'role_login_status','catalog_differences_from_prefix1',c->'differences_from_expected_prefix1','registry',d,'helpers_created_by_002',0,'verdict',CASE WHEN data_ok IS DISTINCT FROM true THEN 'STOP_RECOVERY_PARTIAL_002_OR_MISSING_001' WHEN catalog_ok IS DISTINCT FROM true THEN 'STOP_RECOVERY_CATALOG_OR_INSTALLER' ELSE 'GREEN_RESUME_FROM_002' END)||(SELECT jsonb_object_agg('migration_'||lpad(i::text,3,'0')||'_status',c->('migration_'||lpad(i::text,3,'0')||'_status')) FROM generate_series(1,7) i) AS recovery_precheck FROM checks
\\gset
\\echo :recovery_precheck
SELECT (:'recovery_precheck'::jsonb->>'verdict'='GREEN_RESUME_FROM_002') AS recovery_pass
\\gset
\\if :recovery_pass
ROLLBACK;
\\else
-- Stream each partial registry row separately; no giant JSON aggregation.
\\if :recovery_tables_present
SELECT jsonb_build_object('partial_table','storage_sorgenti','row',to_jsonb(t)) FROM artecna_distruzione.storage_sorgenti t;
SELECT jsonb_build_object('partial_table','storage_oggetti','row',to_jsonb(t)) FROM artecna_distruzione.storage_oggetti t;
SELECT jsonb_build_object('partial_table','storage_riferimenti','row',to_jsonb(t)) FROM artecna_distruzione.storage_riferimenti t;
SELECT jsonb_build_object('partial_table','storage_anomalie','row',to_jsonb(t)) FROM artecna_distruzione.storage_anomalie t;
SELECT jsonb_build_object('partial_trigger',tgname,'table',tgrelid::regclass::text,'definition',pg_get_triggerdef(oid)) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN('storage_registry_reference','storage_registry_no_truncate');
\\endif
ROLLBACK;
SELECT 1/0 AS stop_recovery_requires_review;
\\endif
`
fs.writeFileSync(path.join(dir,'production-recovery-precheck-readonly.sql'),sql)
console.log('Generated recovery precheck; no database connection')
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261107000200_storage_sources_backfill.sql'),'utf8')
const configs=migration.split(/\r?\n/).filter(l=>l.startsWith("('")).map(l=>{const m=l.match(/^\('([^']+)'::regclass,ARRAY\[([^\]]*)\]::text\[\],'([^']*)'::jsonb,ARRAY\[([^\]]*)\]::text\[\]/);return {table:m[1],fields:Object.keys(JSON.parse(m[3])),json:[...m[4].matchAll(/'([^']+)'/g)].map(x=>x[1])}})
const quote=s=>"'"+s.replaceAll("'","''")+"'"
let diagnostics="\\set ON_ERROR_STOP on\nBEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL search_path=pg_catalog,pg_temp;\nSET LOCAL statement_timeout='60s';\nSET LOCAL lock_timeout='5s';\nSET LOCAL idle_in_transaction_session_timeout='60s';\n"
diagnostics+=`SELECT jsonb_build_object('report','CANTIERE_DELETE_RECOVERY_DIAGNOSTICS','read_only',current_setting('transaction_read_only'),'database',current_database(),'server_version',current_setting('server_version'),'postmaster_start',pg_postmaster_start_time(),'backend_pid',pg_backend_pid(),'settings',(SELECT jsonb_object_agg(name,setting) FROM pg_settings WHERE name IN('work_mem','shared_buffers','max_connections','max_locks_per_transaction','statement_timeout','lock_timeout','idle_in_transaction_session_timeout','idle_session_timeout','temp_file_limit')));
SELECT datname,numbackends,temp_files,temp_bytes,deadlocks,stats_reset FROM pg_stat_database WHERE datname=current_database();
SELECT pid,backend_type,state,wait_event_type,wait_event,backend_start,xact_start FROM pg_stat_activity WHERE datname=current_database();
`
for(const c of configs){const cols=[...new Set([...c.fields,...c.json])];diagnostics+=`SELECT jsonb_build_object('source',${quote(c.table)},'rows',count(*),'column_sizes',jsonb_build_object(${cols.flatMap(k=>[quote(k),`jsonb_build_object('max_stored_bytes',max(pg_column_size(t."${k}")),'max_logical_text_bytes',max(octet_length(t."${k}"::text)))`]).join(',')})) FROM ${c.table} t;\n`}
diagnostics+='ROLLBACK;\n'
fs.writeFileSync(path.join(dir,'production-recovery-diagnostics-readonly.sql'),diagnostics)
