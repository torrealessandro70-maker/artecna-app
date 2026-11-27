-- READ ONLY object evidence. Absence of migration history never proves installation.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
WITH functions AS (
 SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_function_result(p.oid) AS result,p.prokind,p.provolatile,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,
 encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') AS source_sha256_lf,
 (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type)
 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x) AS acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','artecna_contabilita') AND p.proname IN('fotografia_fonte_iva','risolvi_iva_persistita','proteggi_fonte_iva','documento_riconciliazione','leggi_riconciliazione_unificata','riconcilia_acconto_fattura','verifica_coppia_riconciliazione','revoca_riconciliazione_unificata')
), columns AS (
 SELECT n.nspname AS schema,c.relname AS relation,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE NOT a.attisdropped AND (n.nspname,c.relname,a.attname) IN(('public','fatture_emesse','fonte_iva_verificata'),('artecna_contabilita','attribuzioni_clienti','riconciliazione'),('artecna_contabilita','quote_lorde_clienti','attribuzione_id'))
), triggers AS (
 SELECT n.nspname AS schema,c.relname AS relation,t.tgname AS name,t.tgenabled,pg_get_triggerdef(t.oid,true) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE t.tgname IN('fonte_iva_riservata','coppia_riconciliazione_netto','coppia_riconciliazione_lordo') AND n.nspname IN('public','artecna_contabilita')
), constraints AS (
 SELECT conname,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint
 WHERE conrelid=to_regclass('artecna_contabilita.quote_lorde_clienti') AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=to_regclass('artecna_contabilita.quote_lorde_clienti') AND attname='attribuzione_id')]::smallint[]
)
SELECT jsonb_build_object('marker','ARTECNA_RICONCILIAZIONE_OBJECT_EVIDENCE','readonly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),
 'registry_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
 'functions',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY schema,name,arguments) FROM functions f),'[]'),
 'columns',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY schema,relation,name) FROM columns c),'[]'),
 'triggers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY schema,relation,name) FROM triggers t),'[]'),
 'constraints',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY conname) FROM constraints c),'[]'),
 'index',pg_get_indexdef(to_regclass('artecna_contabilita.quota_lorda_attribuzione_univoca')),
 'apply_authorized',false) AS evidence;
ROLLBACK;
