/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const baseline=require('./production-rpc-baseline.json'),fidelity=require('./baseline-catalog-fidelity.json');
const source=baseline.definition.split(baseline.definition.match(/AS (\$\w*\$)/)[1])[1];
assert.equal(crypto.createHash('md5').update(source).digest('hex'),baseline.source_md5);
const expected={signature:baseline.signature,result:'TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)',owner:baseline.owner,security_definer:baseline.security_definer,config:baseline.config,volatility:baseline.volatility,strict:baseline.strict,parallel:baseline.parallel,language:baseline.language,source,source_md5:baseline.source_md5,acl:baseline.acl};
const identityQuery=`SELECT jsonb_build_object('signature',p.oid::regprocedure::text,'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,'strict',p.proisstrict,'parallel',p.proparallel,'language',l.lanname,'source',p.prosrc,'source_md5',md5(p.prosrc),'acl',(SELECT jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END COLLATE "C",pg_get_userbyid(a.grantor) COLLATE "C",a.privilege_type COLLATE "C") FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) AS identity FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)')`;
const membershipQuery=`SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.member,m.grantor),'[]') memberships FROM pg_auth_members m WHERE m.roleid='artecna_cantieri_delete_rpc'::regrole`;
exports.baseline=baseline;exports.expected=expected;exports.identityQuery=identityQuery;exports.membershipQuery=membershipQuery;
exports.certifiedInstallerFixture=async(db,connect)=>{
 const admin=await connect('fixture_admin');
 await db.query('SET search_path=pg_catalog,pg_temp');assert.deepEqual((await db.query(identityQuery)).rows[0].identity,expected,'historical fixture RPC already equals the observed Production RPC');
 await admin.query('ALTER EXTENSION plpgsql ADD FUNCTION public.uuid_generate_v4()');
 for(const r of fidelity.relations){const table='"'+r.schema+'"."'+r.table+'"';if(r.rls)await admin.query('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY');if(r.forced_rls)await admin.query('ALTER TABLE '+table+' FORCE ROW LEVEL SECURITY');for(const grantee of r.maintain)await admin.query('GRANT MAINTAIN ON TABLE '+table+' TO '+(grantee==='PUBLIC'?'PUBLIC':'"'+grantee+'"'));}
 // Restore from the actual certified Production definition, not a rewritten body.
 await admin.query(baseline.definition);await db.query('SET search_path=pg_catalog,pg_temp');assert.deepEqual((await db.query(identityQuery)).rows[0].identity,expected);
 await admin.query('CREATE ROLE supabase_admin NOLOGIN');
 await admin.query('GRANT artecna_cantieri_delete_rpc TO supabase_admin WITH ADMIN TRUE, INHERIT FALSE, SET FALSE');
 await admin.query('GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE GRANTED BY supabase_admin');
 const rows=(await db.query("SELECT pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres'::regrole")).rows;
 assert.deepEqual(rows,[{grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false}]);assert.equal((await db.query("SELECT has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') ok")).rows[0].ok,false);
};
