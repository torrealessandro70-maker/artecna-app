// Exact catalog metadata omitted by the generic data-test fixture. Local only.
const metadata=require('./baseline-catalog-fidelity.json'),ident=s=>'"'+s.replaceAll('"','""')+'"'
exports.catalogFidelity=async(db,connect)=>{
 const admin=await connect('fixture_admin')
 await admin.query('ALTER EXTENSION plpgsql ADD FUNCTION public.uuid_generate_v4()')
 for(const r of metadata.relations){const table=ident(r.schema)+'.'+ident(r.table)
  if(r.rls)await db.query('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY')
  if(r.forced_rls)await db.query('ALTER TABLE '+table+' FORCE ROW LEVEL SECURITY')
  for(const grantee of r.maintain)await db.query('GRANT MAINTAIN ON TABLE '+table+' TO '+(grantee==='PUBLIC'?'PUBLIC':ident(grantee)))
 }
}
