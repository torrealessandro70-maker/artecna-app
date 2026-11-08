/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),baseline=require('./contabilitaUsageBaseline.json');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
exports.alignAccountingAcl=async db=>{const q=async(s,p=[])=>(await db.query(s,p)).rows;
await q('ALTER ROLE artecna_cantieri_delete_rpc NOINHERIT');
const roles=(await q("SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='artecna_contabilita' AND a.grantee<>n.nspowner")).map(x=>x.grantee);
for(const r of roles)await q('REVOKE ALL ON SCHEMA artecna_contabilita FROM '+(r==='PUBLIC'?'PUBLIC':quote(r)));
for(const t of baseline.relations){
 const existing=await q("SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=$1::regclass AND a.grantee<>c.relowner",[t.name]);for(const r of existing)await q('REVOKE ALL ON TABLE '+t.name+' FROM '+(r.grantee==='PUBLIC'?'PUBLIC':quote(r.grantee)));
 if(t.name==='artecna_contabilita.attribuzioni_clienti')await q('GRANT SELECT ON TABLE '+t.name+' TO artecna_cantieri_delete_rpc');
}
for(const fn of baseline.functions){const existing=await q("SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee<>p.proowner",[fn.signature]);for(const r of existing)await q('REVOKE ALL ON FUNCTION '+fn.signature+' FROM '+(r.grantee==='PUBLIC'?'PUBLIC':quote(r.grantee)));}

assert.equal((await q("SELECT nspacl::text acl FROM pg_namespace WHERE nspname='artecna_contabilita'"))[0].acl,baseline.schema.acl);
for(const t of baseline.relations)assert.equal((await q('SELECT relacl::text acl FROM pg_class WHERE oid=$1::regclass',[t.name]))[0].acl,t.acl);
for(const f of baseline.functions){const r=(await q('SELECT proacl::text acl,md5(prosrc) source_md5,pg_get_userbyid(proowner) owner,prosecdef security_definer,proconfig config FROM pg_proc WHERE oid=$1::regprocedure',[f.signature]))[0];assert.deepEqual(r,{acl:f.acl,source_md5:f.source_md5,owner:f.owner,security_definer:f.security_definer,config:f.config});}
// Initial fixture baseline after importing observed Production ACLs, before testing 011.
await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');
};
