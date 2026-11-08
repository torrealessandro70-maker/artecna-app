/* eslint-disable @typescript-eslint/no-require-imports */
// Creates an audit bundle; all SQL validation connects only to isolated loopback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {withNative}=require('../supabase/validators/cantiere-prerequisiti/native.cjs');
const {certifiedInstallerFixture,expected,identityQuery,membershipQuery}=require('../supabase/validators/cantiere-prerequisiti/installerBaseline.cjs');
const root=path.resolve(__dirname,'..'),migration='20261108000800_cantiere_hard_delete_finale.sql',hash=b=>crypto.createHash('sha256').update(b).digest('hex'),quote=s=>"'"+s.replaceAll("'","''")+"'";
function inventory(dir){return Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?Object.entries(inventory(path.join(dir,e.name))).map(([n,h])=>[e.name+'/'+n,h]):[[e.name,hash(fs.readFileSync(path.join(dir,e.name)))]]));}
async function createGate(dest,{commit}={}){
 const previous=path.resolve(root,'../../audit-locali/CANTIERE-HARD-DELETE-FINAL-GATE-20261108-3440bc9f'),previousEvidence=inventory(previous);
 assert(!fs.existsSync(dest),'Never overwrite an audit bundle');fs.mkdirSync(dest,{recursive:true});const write=(n,b)=>fs.writeFileSync(path.join(dest,n),b);
 const frozen=commit?execFileSync('git',['show',commit+':supabase/migrations/'+migration],{cwd:root,maxBuffer:2e6}):fs.readFileSync(path.join(root,'supabase/migrations',migration));write(migration,frozen);
 for(const [target,source] of [['FINGERPRINT-PROOF.json','supabase/validators/cantiere-prerequisiti/baseline-fingerprint-proof.json'],['INSTALLER-R2.md','docs/cantiere-hard-delete-installer-r2.md']])write(target,commit?execFileSync('git',['show',commit+':'+source],{cwd:root,maxBuffer:2e6}):fs.readFileSync(path.join(root,source)));
 const old=fs.readFileSync(path.join(root,'supabase/validators/cantiere-prerequisiti/production-precheck-readonly.sql'),'utf8'),start=old.indexOf('WITH RECURSIVE '),end=old.indexOf('SELECT result FROM summary;',start)+'SELECT result FROM summary'.length;
 const classifier=old.slice(start,end),collector=old.slice(old.indexOf('rel AS MATERIALIZED',start),old.indexOf(', expected(n,objects) AS',start));
 const canonical=frozen.toString().match(/AS \$catalog\$ ([\s\S]*?) \$catalog\$;/)[1],ro="\\set ON_ERROR_STOP on\nBEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog,pg_temp;\nSET LOCAL standard_conforming_strings=on;\nSET LOCAL statement_timeout='60s';\nSET LOCAL lock_timeout='5s';\n";
 await withNative(async(db,connect,config)=>{
  const q=async(s,p)=>(await db.query(s,p)).rows,collect=async()=>(await q('WITH '+collector+' SELECT objects FROM observed'))[0].objects;
  await q('BEGIN READ ONLY');await q('SET LOCAL search_path=pg_catalog,pg_temp');assert.equal((await q(classifier))[0].result.matched_prefix,7);await q('ROLLBACK');await q('SET search_path=pg_catalog,pg_temp');
  const prefix7=await collect(),baselineHash=(await q(canonical))[0].md5,before=(await q(identityQuery))[0].identity,members=(await q(membershipQuery))[0].memberships,schema=(await q("SELECT nspacl::text acl,nspowner FROM pg_namespace WHERE nspname='public'"))[0];assert.deepEqual(before,expected);
  // Preview the full catalog delta locally, then roll back to the real prefix7
  // before testing the delivered precheck (no projected/mocked positive state).
  await q('BEGIN');await q(frozen.toString().replace(/^BEGIN;\r?$/m,'').replace(/COMMIT;\r?\n?$/,''));const prefix8=await collect(),after=(await q(identityQuery))[0].identity;await q('ROLLBACK');assert.deepEqual((await q(membershipQuery))[0].memberships,members);assert.deepEqual((await q("SELECT nspacl::text acl,nspowner FROM pg_namespace WHERE nspname='public'"))[0],schema);
  const query=`WITH rpc_check AS MATERIALIZED (SELECT (${identityQuery}) rpc),${collector},expected_state(stage,objects) AS (VALUES(7,${quote(JSON.stringify(prefix7))}::jsonb),(8,${quote(JSON.stringify(prefix8))}::jsonb)),matched AS (SELECT max(stage) stage FROM expected_state e CROSS JOIN observed o WHERE e.objects=o.objects),facts AS (
  SELECT stage,rpc,
  (SELECT count(*)=1 AND bool_and(grantor=to_regrole('supabase_admin') AND admin_option AND NOT set_option AND NOT inherit_option) FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member=to_regrole('postgres')) original_membership,
  (has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') OR (has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') AND (SELECT nspacl IS NOT NULL FROM pg_namespace WHERE nspname='public'))) schema_capability,
  has_schema_privilege(current_user,'public','CREATE') AND has_schema_privilege(current_user,'artecna_distruzione','CREATE') AND has_database_privilege(current_database(),'TEMP') AND has_language_privilege('artecna_cantieri_delete_rpc','plpgsql','USAGE') installer_ddl,
  artecna_distruzione.storage_copertura_valida() AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.storage_anomalie) storage_ok,
  NOT EXISTS(SELECT 1 FROM artecna_distruzione.contesto) AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.contesto_prerequisiti) contexts_empty,
  CASE WHEN rpc=${quote(JSON.stringify(expected))}::jsonb THEN (${canonical}) END canonical_hash FROM matched CROSS JOIN rpc_check),result AS (
  SELECT jsonb_build_object('report','CANTIERE_008_R2_PRECHECK','read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'installer',current_user,'matched_prefix',stage,
  'migration_008_status',CASE stage WHEN 7 THEN 'NOT_APPLIED' WHEN 8 THEN 'ALREADY_EQUIVALENT' ELSE 'DRIFT_CONFLICT' END,
  'prerequisites_001_007',CASE WHEN stage IN(7,8) THEN 'GREEN' ELSE 'STOP_DRIFT' END,'rpc_baseline_exact',rpc=${quote(JSON.stringify(expected))}::jsonb,'rpc',rpc-'source','original_membership_exact',original_membership,
  'temporary_set_applicable',original_membership,'schema_create_required_by_pg17_probe',true,'schema_capability_applicable',schema_capability,'storage_complete',storage_ok,'contexts_empty',contexts_empty,
  'canonical_baseline_expected',${quote(baselineHash)},'canonical_observed',canonical_hash,
  'verdict',CASE WHEN stage=8 THEN 'STOP_ALREADY_EQUIVALENT_008' WHEN rpc IS DISTINCT FROM ${quote(JSON.stringify(expected))}::jsonb THEN 'STOP_RPC_BASELINE' WHEN stage IS DISTINCT FROM 7 THEN 'STOP_DRIFT_CONFLICT' WHEN NOT coalesce(original_membership AND schema_capability AND installer_ddl,false) THEN 'STOP_INSTALLER_CAPABILITY' WHEN NOT coalesce(storage_ok AND contexts_empty,false) THEN 'STOP_STORAGE_OR_CONTEXT' WHEN canonical_hash<>${quote(baselineHash)} THEN 'STOP_CANONICAL_BASELINE' WHEN current_user<>'postgres' OR current_database()<>'postgres' OR current_setting('server_version_num')<>'170006' OR current_setting('transaction_read_only')<>'on' THEN 'STOP_INSTALLER_ENVIRONMENT' ELSE 'GREEN_APPLY_008' END) precheck FROM facts)
 SELECT precheck FROM result`;
  write('01_precheck_readonly.sql',ro+query+';\n'+`SELECT (precheck->>'verdict'='GREEN_APPLY_008') green_apply_008 FROM (${query}) r\n\\gset\nROLLBACK;\n`);
  const meta=`SELECT jsonb_build_object('memberships',(${membershipQuery}),'schema',(SELECT jsonb_build_object('acl',nspacl::text,'owner',nspowner) FROM pg_namespace WHERE nspname='public'),'rpc',(${identityQuery})-'source'-'source_md5')`;
  for(const [name,kind] of [['02_before_readonly.sql','before'],['04_after_readonly.sql','after']]){
   let snapshot=fs.readFileSync(path.join(previous,name),'utf8');
   snapshot=snapshot.replace('ROLLBACK;',`${meta} AS ${kind}_metadata\n\\gset\nSELECT jsonb_build_object('snapshot','${kind}_metadata','data',:'${kind}_metadata'::jsonb);\nROLLBACK;`);write(name,snapshot);
  }
  const post=`WITH ${collector} SELECT jsonb_build_object('report','POSTCHECK_008_R2','verdict',CASE WHEN objects=${quote(JSON.stringify(prefix8))}::jsonb AND (${identityQuery})=${quote(JSON.stringify(after))}::jsonb AND artecna_distruzione.hard_delete_catalog()=(SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.hard_delete_plan) THEN 'GREEN_POSTCHECK_008' ELSE 'STOP_POSTCHECK_008' END) postcheck FROM observed`;
  write('03_postcheck_readonly.sql',ro+post+';\n'+`SELECT (postcheck->>'verdict'='GREEN_POSTCHECK_008') green_postcheck FROM (${post}) r\n\\gset\nROLLBACK;\n\\if :green_postcheck\n\\else\nSELECT 1/0 AS stop_postcheck;\n\\endif\n`);
  write('Apply008.sql',`\\set ON_ERROR_STOP on\n\\ir 01_precheck_readonly.sql\n\\if :green_apply_008\n\\else\nSELECT 1/0 AS stop_gate_008;\n\\endif\n\\ir 02_before_readonly.sql\nSET default_transaction_read_only=off;\n\\echo BEGIN_MIGRATION_008\n\\ir ${migration}\n\\echo COMMIT_MIGRATION_008_ACKNOWLEDGED\nSET default_transaction_read_only=on;\n\\ir 03_postcheck_readonly.sql\n\\ir 04_after_readonly.sql\nBEGIN READ ONLY;\nSELECT (:'before_data'::jsonb=:'after_data'::jsonb AND :'before_metadata'::jsonb=:'after_metadata'::jsonb) unchanged_data\n\\gset\nROLLBACK;\n\\if :unchanged_data\n\\echo MIGRATION_008_NON_DESTRUCTIVE = YES\n\\echo HARD_DELETE_DB_PRODUCTION_READY\n\\else\nSELECT 1/0 AS stop_data_or_privileges_changed;\n\\endif\n`);
  write('EXPECTED-CATALOG.json',JSON.stringify({prefix7,prefix8},null,2)+'\n');write('RPC-BASELINE.json',JSON.stringify(expected,null,2)+'\n');write('RPC-AFTER-LOCAL.json',JSON.stringify(after,null,2)+'\n');
  // The actual prefix7 actor has ADMIN=true, SET=false, INHERIT=false.
  const read=async(sql)=>{await q('BEGIN READ ONLY');try{return (await q(sql))[0].precheck;}finally{await q('ROLLBACK');}};
  const positive=await read(query);assert.equal(positive.verdict,'GREEN_APPLY_008');
  const admin=await connect('fixture_admin');
  for(const tamper of [require('../supabase/validators/cantiere-prerequisiti/production-rpc-baseline.json').definition.replace('DECLARE','DECLARE\n-- source drift'), 'GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO anon','ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO postgres']){
   await admin.query('BEGIN');try{await admin.query(tamper);await admin.query('SET SESSION AUTHORIZATION postgres');const r=(await admin.query(query)).rows[0].precheck;assert.equal(r.verdict,'STOP_RPC_BASELINE');assert.equal(r.canonical_observed,null,'RPC assertion must prevent composite evaluation');}finally{await admin.query('ROLLBACK');await admin.query('RESET SESSION AUTHORIZATION');}
  }
  const actualPsql=path.join(root,'.run/cantiere-prereq-runtime/minimal/pgsql/bin/psql.exe'),psqlRead=()=>execFileSync(actualPsql,['--no-psqlrc','-w','-h','127.0.0.1','-p',String(config.port),'-U','postgres','-d','postgres','-A','-t','--file',path.join(dest,'01_precheck_readonly.sql')],{encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:4e6});assert(psqlRead().includes('GREEN_APPLY_008'));
  const applied=execFileSync(actualPsql,['--no-psqlrc','-w','-h','127.0.0.1','-p',String(config.port),'-U','postgres','-d','postgres','-A','-t','--file',path.join(dest,'Apply008.sql')],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:4e6});assert(applied.includes('HARD_DELETE_DB_PRODUCTION_READY'));assert(applied.includes('GREEN_POSTCHECK_008'));
  assert.deepEqual((await q(membershipQuery))[0].memberships,members);assert.deepEqual((await q("SELECT nspacl::text acl,nspowner FROM pg_namespace WHERE nspname='public'"))[0],schema);assert.deepEqual((await q(identityQuery))[0].identity,after);assert.equal((await read(query)).verdict,'STOP_ALREADY_EQUIVALENT_008');assert(psqlRead().includes('STOP_ALREADY_EQUIVALENT_008'));
  write('OFFLINE-VALIDATION.json',JSON.stringify({production_connections:0,postgres:'17.6',actor_superuser:false,initial_grantor:'supabase_admin',initial_admin:true,initial_set:false,initial_inherit:false,permanent_schema_create_required:false,temporary_schema_create_proven_necessary:true,membership_before_after_equal:true,schema_acl_before_after_equal:true,rpc_owner_acl_unchanged:true,baseline_source_md5:expected.source_md5,canonical_baseline:baselineHash,precheck_prefix7:positive.verdict,precheck_prefix8:'STOP_ALREADY_EQUIVALENT_008',delivered_psql_readonly_valid:true,migration_sha256:hash(frozen)},null,2)+'\n');
 },{productionActor:true,beforeMigrations:certifiedInstallerFixture});
 write('Run-Precheck.ps1',String.raw`$ErrorActionPreference='Stop'
$bundle=$PSScriptRoot
function SHA256([string]$file){(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
try{
 $m=Get-Content -LiteralPath (Join-Path $bundle 'MANIFEST.json') -Raw|ConvertFrom-Json
 foreach($f in $m.files){if([IO.Path]::GetFileName($f.name) -ne $f.name -or (SHA256 (Join-Path $bundle $f.name)) -ne $f.sha256){throw 'Bundle hash mismatch'}}
 $ca='C:/Users/torre/artecna-app/audit-locali/prod-ca-2021 (1).crt'
 $psql='C:/Program Files/PostgreSQL/18/bin/psql.exe'
 if((SHA256 $ca) -ne '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7' -or (SHA256 $psql) -ne 'fde952534f520909c02db04675588ecb1da8d618b6e5c93e106f42a752daf720'){throw 'CA/runtime mismatch'}
 if(@(Get-ChildItem Env:|Where-Object {$_.Name -like 'PG*'}).Count){throw 'Configurazione PG alternativa: STOP'}
 if(Test-Path -LiteralPath (Join-Path $env:APPDATA 'postgresql\pgpass.conf')){throw 'pgpass presente: STOP'}
 if(-not ('ArtecnaLoggedProcess' -as [type])){Add-Type -Path (Join-Path $bundle 'logged-process.cs')}
 $run=Join-Path $bundle ('runs/readonly-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $run|Out-Null
 $conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=verify-full sslrootcert='$ca' connect_timeout=20 options='-c default_transaction_read_only=on'"
 $argsPsql=@('--no-psqlrc','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',$conn,'-A','-t','--set=ON_ERROR_STOP=on','--file',(Join-Path $bundle '01_precheck_readonly.sql'))
 Write-Host 'SOLO precheck READ ONLY. Nessuna 008, nessun grant, nessun one-shot consumato. Password solo nel prompt psql.'
 $rc=[ArtecnaLoggedProcess]::Run($psql,[string[]]$argsPsql,(Join-Path $run 'stdout.log'),(Join-Path $run 'stderr.log'));[IO.File]::WriteAllText((Join-Path $run 'psql-exit-code.txt'),[string]$rc)
 if($rc -ne 0){throw 'Precheck SQL fallito'}
 $rows=@(Get-Content -LiteralPath (Join-Path $run 'stdout.log')|Where-Object {$_.Trim().StartsWith('{')})
 if($rows.Count -ne 1){throw 'Risposta non univoca'}
 $r=$rows[0]|ConvertFrom-Json;[IO.File]::WriteAllText((Join-Path $run 'RESULT.json'),($r|ConvertTo-Json -Depth 12));Write-Host $r.verdict
 if($r.verdict -ne 'GREEN_APPLY_008'){exit 4};exit 0
}catch{Write-Host 'STOP precheck READ ONLY; nessun retry automatico. Consultare i log locali.';exit 1}
`);
 const precheckRunner=fs.readFileSync(path.join(dest,'Run-Precheck.ps1'),'utf8');
 const applyRunner=precheckRunner.replace("$run=Join-Path $bundle ('runs/readonly-'","$marker=Join-Path $bundle 'ATTEMPT-STARTED-R2.json';$s=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$s.Dispose()\n $run=Join-Path $bundle ('runs/apply008-'")
  .replace("'01_precheck_readonly.sql'","'Apply008.sql'")
  .replace('SOLO precheck READ ONLY. Nessuna 008, nessun grant, nessun one-shot consumato. Password solo nel prompt psql.','UN SOLO tentativo 008 subordinato al precheck GREEN; password solo nel prompt psql.')
  .replace("$rows=@(Get-Content", "$all=Get-Content -LiteralPath (Join-Path $run 'stdout.log') -Raw;if(-not $all.Contains('HARD_DELETE_DB_PRODUCTION_READY') -or -not $all.Contains('COMMIT_MIGRATION_008_ACKNOWLEDGED')){throw 'ACK/postcheck assente'}\n $rows=@(Get-Content")
  .replace("if($rows.Count -ne 1)","$rows=@($rows|Where-Object {($_|ConvertFrom-Json).report -eq 'CANTIERE_008_R2_PRECHECK'});if($rows.Count -ne 1)");
 assert(applyRunner.includes('[IO.FileMode]::CreateNew'));write('Run-Apply008Once.ps1',applyRunner);
 const base=path.resolve(root,'../../audit-locali');fs.copyFileSync(path.join(base,'CANTIERE-HARD-DELETE-FINAL-GATE-20261108-3440bc9f/logged-process.cs'),path.join(dest,'logged-process.cs'));
 assert.deepEqual(inventory(previous),previousEvidence);
 write('PROVENANCE.json',JSON.stringify({candidate:commit||'OFFLINE_WORKING_COPY',parent:'3440bc9fc2c3237bfac9661c376910c63e7d16d4',migration_sha256:hash(frozen),entrypoint:'Run-Precheck.ps1',psql_target:'01_precheck_readonly.sql',production_writes_authorized_by_entrypoint:false,original_bundle_preserved:true,previous_bundle:previous,previous_bundle_inventory:previousEvidence},null,2)+'\n');
 write('README.txt','Primo comando futuro: Run-Precheck.ps1. SOLO READ ONLY; nessuna migration, capability o RPC distruttiva. Non consuma one-shot. GREEN_APPLY_008 richiede baseline RPC esatta prima del composite canonico, 001-007 GREEN e 008 NOT_APPLIED. Run-Apply008Once.ps1 e Apply008.sql sono inclusi per la fase successiva, NON autorizzata in questo step: nuovo marker esclusivo, precheck, snapshot BEFORE, migration atomica, postcheck e snapshot AFTER con confronto dati/membership/schema ACL/RPC owner-ACL. Nessuna chiamata worker o RPC distruttiva. Nessun retry automatico. Il marker del primo bundle e tutte le evidenze restano preservati.\n');
 const ca='C:/Users/torre/artecna-app/audit-locali/prod-ca-2021 (1).crt';assert(fs.existsSync(ca));assert.equal(hash(fs.readFileSync(ca)),'700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7');
 const files=fs.readdirSync(dest).sort().map(name=>{const b=fs.readFileSync(path.join(dest,name));return {name,size:b.length,sha256:hash(b)};});write('MANIFEST.json',JSON.stringify({candidate:commit||'OFFLINE_WORKING_COPY',parent:'3440bc9fc2c3237bfac9661c376910c63e7d16d4',files},null,2)+'\n');write('SHA256SUMS.txt',[...files,{name:'MANIFEST.json',sha256:hash(fs.readFileSync(path.join(dest,'MANIFEST.json')))}].map(f=>f.sha256+'  '+f.name).join('\n')+'\n');
 const runner=fs.readFileSync(path.join(dest,'Run-Precheck.ps1'),'utf8');assert(runner.includes("'--file',(Join-Path $bundle '01_precheck_readonly.sql')"));assert(!runner.includes('CreateNew'));assert(!runner.includes(migration));
 for(const script of [runner,applyRunner]){assert(script.includes('port=5432'));assert(script.includes('sslmode=verify-full'));assert(script.includes("sslrootcert='$ca'"));assert(!script.includes('C:Userstorre'));assert(!script.includes('mode=run'));}
 for(const name of ['Run-Precheck.ps1','Run-Apply008Once.ps1']){const parser=`$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('${path.join(dest,name).replaceAll("'","''")}',[ref]$t,[ref]$e);if($e.Count){exit 1}`;execFileSync('powershell.exe',['-NoProfile','-Command',parser],{windowsHide:true});}
 return {bundle:dest,migration_sha256:hash(frozen),runner_sha256:hash(Buffer.from(runner)),manifest_sha256:hash(fs.readFileSync(path.join(dest,'MANIFEST.json')))};
}
exports.createGate=createGate;
if(require.main===module){const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),parent=execFileSync('git',['rev-parse','HEAD^'],{cwd:root,encoding:'utf8'}).trim();assert.equal(parent,'3440bc9fc2c3237bfac9661c376910c63e7d16d4');assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'');createGate(path.resolve(root,'../../audit-locali/CANTIERE-HARD-DELETE-FINAL-GATE-20261108-'+commit+'-R2'),{commit}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});}
