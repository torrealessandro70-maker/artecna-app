/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {withNative}=require('../supabase/validators/cantiere-prerequisiti/native.cjs'),{certifiedInstallerFixture,identityQuery,expected}=require('../supabase/validators/cantiere-prerequisiti/installerBaseline.cjs');
const root=path.resolve(__dirname,'..'),input=process.argv[2];assert(input,'Pass the read-only diagnostic stdout file; no network fallback');
const records=fs.readFileSync(input,'utf8').split(/\r?\n/).filter(s=>s.startsWith('{')).map(s=>JSON.parse(s)),observed=records.find(r=>r.components),r2=records.find(r=>r.report==='R2_CANONICAL');assert(observed&&observed.read_only==='on');
const original=execFileSync('git',['show','3440bc9fc2c3237bfac9661c376910c63e7d16d4:supabase/migrations/20261108000800_cantiere_hard_delete_finale.sql'],{cwd:root,encoding:'utf8',maxBuffer:2e6}),oldQuery=original.match(/AS \$catalog\$ ([\s\S]*?) \$catalog\$;/)[1],current=fs.readFileSync(path.join(root,'supabase/migrations/20261108000800_cantiere_hard_delete_finale.sql'),'utf8'),newQuery=current.match(/AS \$catalog\$ ([\s\S]*?) \$catalog\$;/)[1];
function key(s){const parts=s.split(':');if(parts[0]==='t')return parts.slice(0,2).join(':')+':'+(s.match(/TRIGGER\s+(\S+)/)||[])[1];return parts.slice(0,3).join(':');}
const composite=rows=>crypto.createHash('md5').update(rows.map(s=>Buffer.from(s,'utf8')).sort(Buffer.compare).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))).digest('hex');
assert.equal(composite(observed.components),observed.composite,'Recompute the old Production digest from its recorded component bytes');
const diagnosticSql=fs.readFileSync(path.resolve(path.dirname(input),'../../diagnostic-readonly.sql'),'utf8');
const canonicalRecorded=diagnosticSql.slice(diagnosticSql.indexOf("'fingerprint',(")+15,diagnosticSql.lastIndexOf('));'));
assert.equal(canonicalRecorded.trim(),newQuery.trim(),'Recorded Production R2 SQL must be exactly the current canonical expression');
withNative(async(db)=>{
 await db.query('SET search_path=pg_catalog,pg_temp');const tail=oldQuery.substring(oldQuery.indexOf(' FROM ('));const local=(await db.query('SELECT x'+tail)).rows.map(r=>r.x),a=Object.fromEntries(local.map(s=>[key(s),s])),b=Object.fromEntries(observed.components.map(s=>[key(s),s]));
 const differences=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]!==b[k]).sort().map(component=>({component,local:a[component]??null,production:b[component]??null}));
 assert.deepEqual((await db.query(identityQuery)).rows[0].identity,expected);assert.equal(observed.rpc.source_md5,expected.source_md5);assert.equal(observed.rpc.source,expected.source);
 for(const field of ['signature','owner','security_definer','config','volatility','strict','parallel','language','acl'])assert.deepEqual(observed.rpc[field],expected[field],field);
 assert.equal(composite(local),'12b28fb77ee583a0ea1d7f75b0fdaf43');assert.equal(Object.keys(a).length,local.length);assert.equal(Object.keys(b).length,observed.components.length);
 const before=(await db.query(newQuery)).rows[0].md5;assert(r2);assert.equal(before,r2.fingerprint,'Canonical R2 hash must match Production read-only evidence');
 const oldLocal=(await db.query(oldQuery)).rows[0].md5;assert.equal(oldLocal,'12b28fb77ee583a0ea1d7f75b0fdaf43');assert(differences.length>0);assert(!differences.some(d=>d.component.startsWith('p:public.elimina_cantiere_definitivamente:')));
 const proof={production_writes:0,diagnostic_sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),rpc_identical:true,rpc_source_md5:expected.source_md5,old_composite_local:oldLocal,old_composite_production:observed.composite,new_canonical_local:before,new_canonical_production:r2?.fingerprint??null,differences,fix:'Exclude extension-owned functions and use the same pretty catalog deparsers and literal schema prefix as the certified export/classifier; independently pin the complete real RPC identity.'};
 fs.writeFileSync(path.join(root,'supabase/validators/cantiere-prerequisiti/baseline-fingerprint-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
},{productionActor:true,beforeMigrations:certifiedInstallerFixture}).catch(e=>{console.error(e);process.exitCode=1;});
