// Solo PostgreSQL PGlite isolato: nessuna connessione remota.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {fixture,A,RAP}=require('./fixtureStep3.cjs')
const migrations=path.resolve(__dirname,'../../../supabase/migrations')
const sql=fs.readFileSync(path.join(migrations,'20261004_rapportino_allegati_registro.sql'),'utf8')
test('Registro allegati: schema, vincoli e isolamento SQL',async t=>{
  const db=new PGlite()
  const q=async(s,p=[]) => (await db.query(s,p)).rows
  const run=(n,f)=>t.test(n,f)
  const foto=randomUUID()
  const row=(extra={})=>({rapportino_id:RAP,cantiere_id:A,chiave_client_allegato:randomUUID(),
    sha256:Buffer.alloc(32,1),bucket:'rapportini-v1',file_path:`rapportini/${randomUUID()}.jpg`,
    mime_type:'image/jpeg',byte_size:1,stato:'prenotato',expires_at:'2026-10-05T00:00:00Z',...extra})
  const insert=async r=>{
    const entries=Object.entries(r)
    return (await q(`INSERT INTO artecna_rapportini.allegati (${entries.map(([k])=>k).join(',')})
      VALUES (${entries.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,entries.map(([,v])=>v)))[0]
  }
  const reject=(extra,code='23514')=>assert.rejects(()=>insert(row(extra)),e=>e.code===code)
  const snapshot=async()=>({
    tables:await q(`SELECT c.oid,c.relname,c.relowner,c.relacl::text,c.relrowsecurity,
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND attnum>0) columns
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','artecna_rapportini') AND c.relkind='r' ORDER BY c.oid`),
    funcs:await q(`SELECT oid,prosrc,proacl::text,proconfig,proowner FROM pg_proc
      WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace) ORDER BY oid`),
    schemas:await q(`SELECT oid,nspacl::text FROM pg_namespace WHERE nspname IN ('public','artecna_rapportini') ORDER BY oid`)
  })
  try {
    await db.exec(fixture)
    await db.exec('CREATE TABLE public.foto_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),rapportino_id text,file_path text);')
    await q('INSERT INTO public.foto_cantiere(id,cantiere_id,rapportino_id) VALUES($1,$2,$3)',[foto,A,RAP])
    for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
      '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql'])
      await db.exec(fs.readFileSync(path.join(migrations,n),'utf8'))
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA artecna_rapportini GRANT ALL ON TABLES TO PUBLIC,anon,authenticated,service_role,artecna_rapportini_backend;')
    const before=await snapshot()
    await db.exec(sql)
    await run('schema privato, owner e RLS',async()=>{
      const [c]=await q("SELECT relowner::regrole::text owner,relrowsecurity FROM pg_class WHERE oid='artecna_rapportini.allegati'::regclass")
      assert.deepEqual(c,{owner:'postgres',relrowsecurity:false})
    })
    await run('colonne e tipi esatti',async()=>{
      const cols=await q("SELECT attname,format_type(atttypid,atttypmod) tipo,attnotnull FROM pg_attribute WHERE attrelid='artecna_rapportini.allegati'::regclass AND attnum>0 ORDER BY attnum")
      assert.equal(cols.length,17)
      assert.deepEqual(cols.map(c=>c.attname),'id rapportino_id cantiere_id chiave_client_allegato sha256 bucket file_path mime_type byte_size stato foto_cantiere_id created_at finalized_at expires_at removed_at lease_id lease_until'.split(' '))
      assert.deepEqual(cols.map(c=>c.tipo),['uuid','uuid','uuid','uuid','bytea','text','text','text','bigint','text','uuid','timestamp with time zone','timestamp with time zone','timestamp with time zone','timestamp with time zone','uuid','timestamp with time zone'])
      assert.deepEqual(cols.filter(c=>!c.attnotnull).map(c=>c.attname),['foto_cantiere_id','finalized_at','removed_at','lease_id','lease_until'])
    })
    await run('default UUID e timestamp server',async()=>{
      const r=await insert(row());assert.match(r.id,/^[a-f0-9-]{36}$/);assert.ok(r.created_at)
      const defs=await q("SELECT a.attname,pg_get_expr(d.adbin,d.adrelid) def FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='artecna_rapportini.allegati'::regclass ORDER BY a.attnum")
      assert.deepEqual(defs,[{attname:'id',def:'gen_random_uuid()'},{attname:'created_at',def:'statement_timestamp()'}])
      await assert.rejects(()=>insert(row({id:r.id})),e=>e.code==='23505')
    })
    await run('FK tutte RESTRICT senza CASCADE',async()=>{
      const c=await q("SELECT confrelid::regclass::text target,confdeltype FROM pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass AND contype='f' ORDER BY target")
      assert.deepEqual(c,[{target:'cantieri',confdeltype:'r'},{target:'foto_cantiere',confdeltype:'r'},{target:'rapportini',confdeltype:'r'}])
      await reject({rapportino_id:randomUUID()},'23503');await reject({cantiere_id:randomUUID()},'23503');await reject({stato:'finalizzato',finalized_at:'2026-10-04',foto_cantiere_id:randomUUID()},'23503')
      await assert.rejects(()=>q('DELETE FROM public.rapportini WHERE id=$1',[RAP]),e=>['23503','23001'].includes(e.code))
      await assert.rejects(()=>q('DELETE FROM public.cantieri WHERE id=$1',[A]),e=>['23503','23001'].includes(e.code))
    })
    await run('unique identità include tombstone scaduto',async()=>{const r=row({stato:'scaduto'});await insert(r);await assert.rejects(()=>insert({...r,file_path:`rapportini/${randomUUID()}`}),e=>e.code==='23505')})
    await run('unique bucket/path',async()=>{const r=row();await insert(r);await assert.rejects(()=>insert({...r,chiave_client_allegato:randomUUID()}),e=>e.code==='23505')})
    await run('unique foto nullable e RESTRICT',async()=>{await insert(row());await insert(row());const projection={stato:'finalizzato',finalized_at:'2026-10-04',foto_cantiere_id:foto};await insert(row(projection));await reject(projection,'23505');await assert.rejects(()=>q('DELETE FROM public.foto_cantiere WHERE id=$1',[foto]),e=>['23503','23001'].includes(e.code))})
    for(const n of [0,31,33]) await run(`SHA ${n} byte rifiutato`,()=>reject({sha256:Buffer.alloc(n)}))
    await run('SHA 32 byte valido',()=>insert(row()))
    await run('bucket diverso rifiutato',()=>reject({bucket:'preventivi'}))
    for(const mime of ['image/jpeg','image/png','image/webp']) await run(`MIME ${mime}`,()=>insert(row({mime_type:mime})))
    await run('MIME HEIC rifiutato',()=>reject({mime_type:'image/heic'}))
    for(const n of [0,4000001]) await run(`dimensione ${n} rifiutata`,()=>reject({byte_size:n}))
    await run('dimensione massima valida',()=>insert(row({byte_size:4000000})))
    await run('stato sconosciuto rifiutato',()=>reject({stato:'uploading'}))
    for(const p of ['', '/rapportini/x','rapportini/../x','preventivi/x','rapportini/']) await run(`path ${JSON.stringify(p)} rifiutato`,()=>reject({file_path:p}))
    await run('prenotato valido',()=>insert(row()))
    await run('prenotato finalized_at rifiutato',()=>reject({finalized_at:'2026-10-04'}))
    await run('prenotato removed_at rifiutato',()=>reject({removed_at:'2026-10-04'}))
    await run('prenotato con foto rifiutato',()=>reject({foto_cantiere_id:foto}))
    await run('finalizzato valido',async()=>{const id=randomUUID();await q('INSERT INTO public.foto_cantiere(id) VALUES($1)',[id]);await insert(row({stato:'finalizzato',finalized_at:'2026-10-04',foto_cantiere_id:id}))})
    await run('finalizzato senza foto rifiutato',()=>reject({stato:'finalizzato',finalized_at:'2026-10-04'}))
    await run('finalizzato senza timestamp rifiutato',()=>reject({stato:'finalizzato'}))
    await run('finalizzato con removed_at rifiutato',()=>reject({stato:'finalizzato',finalized_at:'2026-10-04',foto_cantiere_id:foto,removed_at:'2026-10-04'}))
    for(const stato of ['cancellazione_pending','cancellato']) {
      await run(`${stato} valido`,()=>insert(row({stato,removed_at:'2026-10-04'})))
      await run(`${stato} senza removed_at rifiutato`,()=>reject({stato}))
    }
    await run('scaduto valido anche dopo expires_at',()=>insert(row({stato:'scaduto',expires_at:'2000-01-01'})))
    await run('scaduto finalizzato rifiutato',()=>reject({stato:'scaduto',finalized_at:'2026-10-04'}))
    await run('scaduto con foto rifiutato',()=>reject({stato:'scaduto',foto_cantiere_id:foto}))
    await run('scaduto con removed_at rifiutato',()=>reject({stato:'scaduto',removed_at:'2026-10-04'}))
    for(const stato of ['cancellazione_pending','cancellato']) await run(`${stato} conserva riferimento storico`,async()=>{
      const id=randomUUID();await q('INSERT INTO public.foto_cantiere(id) VALUES($1)',[id])
      const r=await insert(row({stato,removed_at:'2026-10-04',finalized_at:'2026-10-03',foto_cantiere_id:id}))
      assert.equal(r.foto_cantiere_id,id);assert.ok(r.finalized_at)
    })
    await run('lease completa valida',()=>insert(row({lease_id:randomUUID(),lease_until:'2026-10-04'})))
    await run('lease cleanup pending valida',()=>insert(row({stato:'cancellazione_pending',removed_at:'2026-10-04',lease_id:randomUUID(),lease_until:'2026-10-04'})))
    await run('mezza lease ID rifiutata',()=>reject({lease_id:randomUUID()}))
    await run('mezza lease tempo rifiutata',()=>reject({lease_until:'2026-10-04'}))
    for(const stato of ['finalizzato','cancellato','scaduto']) await run(`lease ${stato} rifiutata`,async()=>{
      const id=randomUUID();await q('INSERT INTO public.foto_cantiere(id) VALUES($1)',[id])
      await reject({stato,removed_at:stato==='cancellato'?'2026-10-04':null,
        finalized_at:stato==='finalizzato'?'2026-10-04':null,
        foto_cantiere_id:stato==='finalizzato'?id:null,lease_id:randomUUID(),lease_until:'2026-10-04'})
    })
    await run('CHECK senza tempo corrente',async()=>{const c=await q("SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass AND contype='c'");for(const r of c) assert.doesNotMatch(r.def,/now\(|clock_timestamp|statement_timestamp|CURRENT_TIMESTAMP/i)})
    await run('indici minimi',async()=>{const c=await q("SELECT indexdef FROM pg_indexes WHERE schemaname='artecna_rapportini' AND tablename='allegati'");assert.equal(c.length,6);assert.ok(c.some(r=>/expires_at.*WHERE.*prenotato/.test(r.indexdef)))})
    await run('nessun grant anche con default privileges permissivi',async()=>{
      assert.deepEqual(await q("SELECT a.* FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='artecna_rapportini.allegati'::regclass AND a.grantee<>c.relowner"),[])
      for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend','artecna_rapportini_rpc']) {
        for(const priv of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) assert.equal((await q("SELECT has_table_privilege($1,'artecna_rapportini.allegati',$2) v",[role,priv]))[0].v,false)
        assert.equal((await q("SELECT has_any_column_privilege($1,'artecna_rapportini.allegati','SELECT,INSERT,UPDATE,REFERENCES') v",[role]))[0].v,false)
      }
    })
    await run('foto e STEP 2/3 e funzioni e USAGE invariati',async()=>{const after=await snapshot();after.tables=after.tables.filter(c=>c.relname!=='allegati');assert.deepEqual(after,before)})
    await run('nessun oggetto Storage/RPC/trigger creato',()=>{assert.doesNotMatch(sql,/CREATE\s+(?:ROLE|FUNCTION|TRIGGER|POLICY)|storage\.(?:objects|buckets)|ALTER\s+TABLE\s+public\./i)})
    const postStart=sql.indexOf('DO $postcheck$')
    assert.ok(postStart>0)
    const install=sql.slice(0,postStart).replace(/^BEGIN;$/m,'')
    const postcheck=sql.slice(postStart).replace(/^COMMIT;$/m,'')
    const faults=[
      ['owner errato','ALTER TABLE artecna_rapportini.allegati OWNER TO anon','tabella, owner o RLS'],
      ['RLS inattesa','ALTER TABLE artecna_rapportini.allegati ENABLE ROW LEVEL SECURITY','tabella, owner o RLS'],
      ['FK CASCADE inattesa',`ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT fault_cascade FOREIGN KEY(cantiere_id) REFERENCES public.cantieri(id) ON DELETE CASCADE`,'FK CASCADE'],
      ['grant backend inatteso','GRANT SELECT ON artecna_rapportini.allegati TO artecna_rapportini_backend','grant diretto'],
      ['ACL colonna inattesa','GRANT SELECT(id) ON artecna_rapportini.allegati TO anon','ACL colonna'],
      ['USAGE backend inatteso','GRANT USAGE ON SCHEMA artecna_rapportini TO artecna_rapportini_backend','privilegi backend'],
      ['FK attesa assente','ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_rapportino_id_fkey','FK RESTRICT assente'],
      ['UNIQUE atteso assente','ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_identita','UNIQUE incompatibile'],
      ['tabella assente','DROP TABLE artecna_rapportini.allegati','tabella, owner o RLS']
    ]
    for(const [name,fault,message] of faults) await run(`post-check ${name}: errore e rollback`,async()=>{
      const original=(await q("SELECT 'artecna_rapportini.allegati'::regclass::oid oid"))[0].oid
      const originalRows=(await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n
      await db.exec('BEGIN; DROP TABLE artecna_rapportini.allegati;')
      try {
        await db.exec(install)
        await db.exec(fault)
        await assert.rejects(()=>db.exec(postcheck),e=>e.code==='P0001' && e.message.includes(message))
        await assert.rejects(()=>q('SELECT 1'),e=>e.code==='25P02')
      } finally {await db.exec('ROLLBACK')}
      assert.equal((await q("SELECT 'artecna_rapportini.allegati'::regclass::oid oid"))[0].oid,original)
      assert.equal((await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,originalRows)
      assert.deepEqual((await snapshot()).schemas,before.schemas)
    })
  } finally {await db.close()}
})
