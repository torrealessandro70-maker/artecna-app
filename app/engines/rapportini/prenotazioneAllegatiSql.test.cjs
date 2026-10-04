// Solo DB locali isolati. Non usa ENV di progetto, Storage o rete remota.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const net=require('node:net')
const {spawnSync}=require('node:child_process')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {Client}=require('pg')
const {fixture,A,B,RAP,OP,TOKEN}=require('./fixtureStep3.cjs')
const migrations=path.resolve(__dirname,'../../../supabase/migrations')
const name='20261004_rapportino_allegati_prenotazione.sql'
const sql=fs.readFileSync(path.join(migrations,name),'utf8')
const signature='public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'
const callSql='SELECT public.prenota_allegato_rapportino_portale($1,$2,$3,$4,$5,$6,$7,$8) v'
const HASH='ab'.repeat(32)
const input=(extra={})=>({sessione:TOKEN,rapportino_id:RAP,cantiere_id:A,data:'2026-09-21',
  chiave:randomUUID(),sha:HASH,mime:'image/jpeg',size:100,...extra})
const params=x=>[x.sessione,x.rapportino_id,x.cantiere_id,x.data,x.chiave,x.sha,x.mime,x.size]
async function setup(db) {
  await db.exec(fixture)
  await db.exec('CREATE TABLE public.foto_cantiere(id uuid PRIMARY KEY,cantiere_id uuid,rapportino_id text,file_path text);')
  for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
    '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql','20261004_rapportino_allegati_registro.sql'])
    await db.exec(fs.readFileSync(path.join(migrations,n),'utf8'))
  await db.query("INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,'UTF8')),$2,statement_timestamp()+interval '8 hours')",[TOKEN,OP])
  await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}';`)
}
const historical=async db=>(await db.query(`SELECT oid,pg_get_functiondef(oid) def,proowner,proacl::text FROM pg_proc
  WHERE pronamespace='artecna_rapportini'::regnamespace OR oid IN
  ('public.crea_sessione_rapportino(text,text)'::regprocedure,'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
  'public.varianti_rapportino_portale(text,uuid)'::regprocedure,'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
  'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure) ORDER BY oid`)).rows
const domain=async db=>{
  const result={}
  for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','public.foto_cantiere','artecna_rapportini.sessioni_portale','artecna_rapportini.richieste'])
    result[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') v FROM ${table} r`)).rows[0].v
  return result
}
test('Prenotazione allegati: protocollo SQL e sicurezza',async t=>{
  const db=new PGlite()
  const q=async(s,p=[])=>(await db.query(s,p)).rows
  const run=(n,f)=>t.test(n,f)
  const call=async(x=input(),role='artecna_rapportini_backend')=>{
    const beforeCall=await domain(db)
    await db.exec(`SET SESSION AUTHORIZATION ${role}`)
    try{return (await q(callSql,params(x)))[0].v}finally{
      await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE')
      assert.deepEqual(await domain(db),beforeCall,'la singola RPC non modifica il dominio Rapportino, foto o sessioni')
    }
  }
  const reject=(x,code)=>assert.rejects(()=>call(x),e=>e.code===code)
  const record=async id=>(await q('SELECT * FROM artecna_rapportini.allegati WHERE id=$1',[id]))[0]
  const seed=async(stato='prenotato',expired=false)=>{
    const x=input(),r=await call(x)
    if(stato==='finalizzato') {
      const photo=randomUUID();await q('INSERT INTO public.foto_cantiere(id) VALUES($1)',[photo])
      await q("UPDATE artecna_rapportini.allegati SET stato=$1,finalized_at=statement_timestamp(),foto_cantiere_id=$2,lease_id=NULL,lease_until=NULL WHERE id=$3",[stato,photo,r.allegato_id])
    } else if(stato!=='prenotato') await q("UPDATE artecna_rapportini.allegati SET stato=$1,removed_at=CASE WHEN $1 IN ('cancellato','cancellazione_pending') THEN statement_timestamp() END,lease_id=NULL,lease_until=NULL WHERE id=$2",[stato,r.allegato_id])
    if(expired) await q("UPDATE artecna_rapportini.allegati SET expires_at=statement_timestamp()-interval '1 second' WHERE id=$1",[r.allegato_id])
    return {x,r}
  }
  try {
    await setup(db)
    const before=await domain(db),funcs=await historical(db)
    await db.exec(sql)
    await run('RPC precedenti e dominio invariati dalla migration',async()=>{assert.deepEqual(await historical(db),funcs);assert.deepEqual(await domain(db),before)})
    for(const [mime,ext] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]) await run(`nuova prenotazione e path ${ext}`,async()=>{
      const x=input({mime}),r=await call(x),a=await record(r.allegato_id)
      assert.equal(r.esito,'successo');assert.equal(r.stato,'prenotato');assert.equal(r.upload_necessario,true)
      assert.equal(r.file_path,`rapportini/${A}/${RAP}/${x.chiave}.${ext}`);assert.equal(r.bucket,'rapportini-v1')
      assert.equal(Buffer.from(a.sha256).toString('hex'),HASH)
      assert.equal(new Date(r.lease_until)-a.created_at,120000);assert.equal(new Date(r.expires_at)-a.created_at,86400000)
      assert.ok(r.lease_id)
      assert.deepEqual(Object.keys(r).sort(),'versione_contratto esito allegato_id stato upload_necessario bucket file_path mime_type byte_size lease_id lease_until expires_at'.split(' ').sort())
    })
    for(const [label,extra] of [['SHA corto',{sha:'aa'}],['SHA uppercase',{sha:HASH.toUpperCase()}],['MIME',{mime:'image/heic'}],['zero',{size:0}],['oltre limite',{size:4000001}],['UUID nullo',{rapportino_id:null}],['data infinita',{data:'infinity'}]])
      await run(`input ${label} rifiutato`,()=>reject(input(extra),'22023'))
    await run('V0 rifiutato',async()=>{await db.exec(`UPDATE public.rapportini SET versione_prestazioni=0 WHERE id='${RAP}'`);try{await reject(input(),'22023')}finally{await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`)}})
    await run('data incoerente',()=>reject(input({data:'2026-10-04'}),'PR409'))
    await run('UUID incoerente',()=>reject(input({rapportino_id:randomUUID()}),'PR409'))
    await run('cantiere incoerente',async()=>{await db.exec(`UPDATE public.cantieri SET lavori_conclusi=false WHERE id='${B}'`);try{await reject(input({cantiere_id:B}),'PR409')}finally{await db.exec(`UPDATE public.cantieri SET lavori_conclusi=true WHERE id='${B}'`)}})
    await run('sessione assente',()=>reject(input({sessione:null}),'PR401'))
    await run('sessione invalida',()=>reject(input({sessione:'invalid'}),'PR401'))
    await run('sessione sconosciuta',()=>reject(input({sessione:'cd'.repeat(32)}),'PR401'))
    for(const [label,update,restore] of [
      ['scaduta',"created_at=statement_timestamp()-interval '2 hours',scade_at=statement_timestamp()-interval '1 hour'","scade_at=statement_timestamp()+interval '8 hours'"],
      ['revocata','revocata_at=statement_timestamp()','revocata_at=NULL']]) await run(`sessione ${label}`,async()=>{
      await db.exec(`UPDATE artecna_rapportini.sessioni_portale SET ${update}`)
      try{await reject(input(),'PR401')}finally{await db.exec(`UPDATE artecna_rapportini.sessioni_portale SET ${restore}`)}
    })
    for(const [label,change,restore] of [['sospeso',"stato='sospeso'","stato='attivo'"],['disabilitato','accesso_portale=false','accesso_portale=true']]) await run(`compilatore ${label}`,async()=>{
      await db.exec(`UPDATE public.operai SET ${change} WHERE id='${OP}'`)
      try{await reject(input(),'42501')}finally{await db.exec(`UPDATE public.operai SET ${restore} WHERE id='${OP}'`)}
    })
    await run('cantiere chiuso',async()=>{await db.exec(`UPDATE public.cantieri SET lavori_conclusi=true WHERE id='${A}'`);try{await reject(input(),'42501')}finally{await db.exec(`UPDATE public.cantieri SET lavori_conclusi=false WHERE id='${A}'`)}})
    await run('retry identico lease valida non muta',async()=>{const {x,r}=await seed();const a=await record(r.allegato_id);await reject(x,'PR409');assert.deepEqual(await record(r.allegato_id),a)})
    for(const [label,extra] of [['hash',{sha:'cd'.repeat(32)}],['MIME',{mime:'image/png'}],['peso',{size:101}]]) await run(`input divergente ${label}`,async()=>{const {x,r}=await seed();await reject({...x,...extra},'PR409');assert.equal((await record(r.allegato_id)).lease_id,r.lease_id)})
    await run('path/bucket/context registro divergente',async()=>{const {x,r}=await seed();await q('UPDATE artecna_rapportini.allegati SET cantiere_id=$1 WHERE id=$2',[B,r.allegato_id]);await reject(x,'PR409')})
    await run('finalizzato idempotente no upload/lease',async()=>{const {x,r}=await seed('finalizzato');const a=await record(r.allegato_id);const retry=await call(x);assert.equal(retry.allegato_id,r.allegato_id);assert.equal(retry.esito,'successo');assert.equal(retry.stato,'finalizzato');assert.equal(retry.upload_necessario,false);assert.equal(retry.lease_id,null);assert.equal(retry.lease_until,null);assert.deepEqual(await record(r.allegato_id),a)})
    for(const stato of ['cancellato','cancellazione_pending']) await run(`${stato} conflitto tombstone`,async()=>{const {x,r}=await seed(stato);await reject(x,'PR409');assert.equal((await record(r.allegato_id)).stato,stato)})
    // Ripartizione quota senza dipendere dal numero di casi precedenti.
    await db.exec('DELETE FROM artecna_rapportini.allegati')
    await run('lease scaduta riacquisita senza cambiare identità/hash/path/expires',async()=>{
      const {x,r}=await seed();await q("UPDATE artecna_rapportini.allegati SET lease_until=statement_timestamp()-interval '1 second' WHERE id=$1",[r.allegato_id]);const a=await record(r.allegato_id)
      const retry=await call(x);const b=await record(r.allegato_id);assert.equal(retry.allegato_id,r.allegato_id);assert.notEqual(retry.lease_id,r.lease_id)
      delete a.lease_id;delete a.lease_until;delete b.lease_id;delete b.lease_until;assert.deepEqual(a,b)
    })
    await run('quota 20 atomica, finalizzato/pending contano',async()=>{
      await db.exec('DELETE FROM artecna_rapportini.allegati');await seed('finalizzato');await seed('cancellazione_pending');for(let i=0;i<18;i++)await seed();await reject(input(),'PR409');assert.equal((await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,20)
    })
    await run('scadenza conflitto persiste, libera quota, vecchia chiave tombstone e nuova valida',async()=>{
      const a=(await q("SELECT * FROM artecna_rapportini.allegati WHERE stato='prenotato' LIMIT 1"))[0]
      const x=input({chiave:a.chiave_client_allegato});await q("UPDATE artecna_rapportini.allegati SET expires_at=statement_timestamp()-interval '1 second' WHERE id=$1",[a.id])
      const r=await call(x),stored=await record(a.id)
      assert.equal(r.esito,'scaduto_persistito_con_conflitto');assert.equal(r.stato,'scaduto');assert.equal(r.upload_necessario,false);assert.equal(r.lease_id,null);assert.equal(r.lease_until,null)
      assert.equal(stored.stato,'scaduto');assert.equal(stored.lease_id,null);assert.equal(stored.lease_until,null)
      assert.deepEqual(await call(x),r);assert.deepEqual(await record(a.id),stored)
      assert.equal((await call(input())).esito,'successo');await reject(input(),'PR409')
    })
    await run('cancellati e scaduti esclusi quota',async()=>{
      await db.exec('DELETE FROM artecna_rapportini.allegati');await seed('cancellato');const {x}=await seed('scaduto');assert.equal((await call(x)).esito,'scaduto_persistito_con_conflitto');for(let i=0;i<20;i++)await seed();await reject(input(),'PR409')
    })
    await run('prenotazioni temporalmente scadute escluse quota',async()=>{await db.exec('DELETE FROM artecna_rapportini.allegati');for(let i=0;i<21;i++)await seed('prenotato',true);assert.equal((await call(input())).esito,'successo')})
    await run('errore non lascia scritture parziali',async()=>{const count=(await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n;await reject(input({sha:'bad'}),'22023');assert.equal((await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,count)})
    await run('rollback esplicito annulla prenotazione',async()=>{
      const count=(await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n
      await db.exec('BEGIN');try{await call(input())}finally{await db.exec('ROLLBACK')}
      assert.equal((await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,count)
    })
    await run('PR409 annulla tutta la transazione senza trasformare altri conflitti in esiti JSON',async()=>{
      const count=(await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,x=input()
      await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; BEGIN')
      try {
        await q(callSql,params(x))
        await assert.rejects(()=>q(callSql,params({...x,sha:'cd'.repeat(32)})),e=>e.code==='PR409')
        await assert.rejects(()=>q('SELECT 1'),e=>e.code==='25P02')
      } finally {await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
      assert.equal((await q('SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,count)
    })
    await run('hash divergente anche su prenotazione scaduta resta PR409 e non muta',async()=>{
      const {x,r}=await seed('prenotato',true),a=await record(r.allegato_id)
      await reject({...x,sha:'cd'.repeat(32)},'PR409');assert.deepEqual(await record(r.allegato_id),a)
    })
    await run('nessun cambiamento revisioni/prestazioni/timbrature/richieste',async()=>{
      const after=await domain(db)
      for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','artecna_rapportini.richieste'])assert.deepEqual(after[table],before[table])
      assert.deepEqual(await historical(db),funcs)
    })
    await run('ACL funzione solo backend; owner/definer/search_path',async()=>{
      const [r]=await q('SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature]);assert.deepEqual(r,{owner:'postgres',prosecdef:true,provolatile:'v',proconfig:['search_path=pg_catalog, pg_temp']})
      for(const role of ['postgres','anon','authenticated','service_role','artecna_rapportini_rpc']) await assert.rejects(()=>call(input(),role),e=>e.code==='42501')
      const a=await q('SELECT a.grantee::regrole::text role,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid=$1::regprocedure AND a.grantee<>p.proowner',[signature]);assert.deepEqual(a,[{role:'artecna_rapportini_backend',privilege_type:'EXECUTE',is_grantable:false}])
    })
    await run('whitelist semantica sei RPC e nessun helper/table/schema backend',async()=>{
      const granted=await q("SELECT p.oid::regprocedure::text signature,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole")
      assert.deepEqual(granted.map(r=>r.signature).sort(),['crea_sessione_rapportino(text,text)','verifica_sessione_rapportino(text,uuid)',
        'varianti_rapportino_portale(text,uuid)','salva_rapportino_con_prestazioni(jsonb,text)','leggi_rapportino_portale(text,uuid,date,uuid)',
        'prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'].sort())
      for(const r of granted){assert.equal(r.privilege_type,'EXECUTE');assert.equal(r.is_grantable,false)}
      assert.equal((await q("SELECT has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') v"))[0].v,false)
      assert.equal((await q("SELECT has_table_privilege('artecna_rapportini_backend','artecna_rapportini.allegati','SELECT,INSERT,UPDATE,DELETE') v"))[0].v,false)
      assert.deepEqual(await q("SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND has_function_privilege('artecna_rapportini_backend',oid,'EXECUTE')"),[])
    })
    await db.exec('DELETE FROM artecna_rapportini.allegati')
    await run('finalizzato esplicito: nessun UPDATE, lease NULL ed expires_at invariata',async()=>{
      const {x,r}=await seed('finalizzato'),before=await record(r.allegato_id)
      await db.exec(`CREATE FUNCTION pg_temp.vieta_update_allegato() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'UPDATE inatteso nel retry finalizzato'; END $$;
        CREATE TRIGGER test_no_update BEFORE UPDATE ON artecna_rapportini.allegati
        FOR EACH ROW EXECUTE FUNCTION pg_temp.vieta_update_allegato();`)
      try {
        const result=await call(x)
        assert.equal(result.esito,'successo');assert.equal(result.upload_necessario,false)
        assert.equal(result.allegato_id,r.allegato_id);assert.equal(result.lease_id,null);assert.equal(result.lease_until,null)
        assert.equal(result.expires_at,r.expires_at);assert.deepEqual(await record(r.allegato_id),before)
      } finally {await db.exec('DROP TRIGGER test_no_update ON artecna_rapportini.allegati; DROP FUNCTION pg_temp.vieta_update_allegato()')}
    })
    await run('scaduto persistito esplicito: no upload/lease, nessuna estensione expires_at',async()=>{
      const {x,r}=await seed('scaduto'),before=await record(r.allegato_id),result=await call(x)
      assert.equal(result.esito,'scaduto_persistito_con_conflitto');assert.equal(result.upload_necessario,false)
      assert.equal(result.lease_id,null);assert.equal(result.lease_until,null);assert.equal(result.expires_at,r.expires_at)
      assert.deepEqual(await record(r.allegato_id),before)
    })
    // Solo fixture locale transazionale: rimuove temporaneamente CHECK per
    // simulare dati impossibili; rollback ripristina vincoli e record originali.
    for(const [label,stato,change] of [
      ['finalizzato con lease completa','finalizzato',"lease_id=gen_random_uuid(),lease_until=statement_timestamp()"],
      ['finalizzato con mezza lease','finalizzato','lease_id=gen_random_uuid()'],
      ['finalizzato senza finalized_at','finalizzato','finalized_at=NULL'],
      ['finalizzato senza foto','finalizzato','foto_cantiere_id=NULL'],
      ['scaduto con lease','scaduto',"lease_id=gen_random_uuid(),lease_until=statement_timestamp()"],
      ['scaduto con finalized_at','scaduto','finalized_at=statement_timestamp()'],
      ['scaduto con foto','scaduto',`foto_cantiere_id='${randomUUID()}'`],
      ['scaduto con removed_at','scaduto','removed_at=statement_timestamp()'],
      ['prenotato incoerente','prenotato','finalized_at=statement_timestamp()'],
      ['prenotato mezza lease','prenotato','lease_until=NULL'],
      ['pending incoerente','cancellazione_pending','removed_at=NULL'],
      ['cancellato con lease','cancellato',"lease_id=gen_random_uuid(),lease_until=statement_timestamp()"],
      ['stato sconosciuto','prenotato',"stato='impossibile'"]
    ]) await run(`integrità ${label}: XX001 sanitizzato, nessuna riparazione`,async()=>{
      const {x,r}=await seed(stato)
      await db.exec('BEGIN')
      try {
        await db.exec(`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_coerenza,
          DROP CONSTRAINT allegati_lease,DROP CONSTRAINT allegati_stato,DROP CONSTRAINT allegati_foto_cantiere_id_fkey`)
        await q(`UPDATE artecna_rapportini.allegati SET ${change} WHERE id=$1`,[r.allegato_id])
        const corrupt=await record(r.allegato_id)
        await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation')
        await assert.rejects(()=>q(callSql,params(x)),e=>e.code==='XX001' && e.message==='Stato allegato non valido')
        await db.exec('ROLLBACK TO SAVEPOINT invocation; SET SESSION AUTHORIZATION postgres')
        assert.deepEqual(await record(r.allegato_id),corrupt)
      } finally {await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
    })
    await run('cinque rami espliciti e upload deciso nel protocollo',()=>{
      for(const stato of ['prenotato','finalizzato','scaduto','cancellazione_pending','cancellato'])
        assert.match(sql,new RegExp(`(?:IF|ELSIF) a\\.stato='${stato}' THEN`))
      assert.doesNotMatch(sql,/'upload_necessario',a\.stato=/)
      assert.match(sql,/'upload_necessario',v_upload_necessario/)
    })
    const postStart=sql.indexOf('DO $postcheck$'),postcheck=sql.slice(postStart).replace(/^COMMIT;$/m,'')
    const install=sql.slice(0,postStart).replace(/^BEGIN;$/m,'')
    for(const [label,fault] of [
      ['definer inatteso',`ALTER FUNCTION ${signature} SECURITY INVOKER`],
      ['PUBLIC inatteso',`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`],
      ['grant backend delegabile',`GRANT EXECUTE ON FUNCTION ${signature} TO artecna_rapportini_backend WITH GRANT OPTION`],
      ['helper accessibile',"GRANT EXECUTE ON FUNCTION artecna_rapportini.autorizza_lettura_portale(text,uuid) TO artecna_rapportini_backend"],
      ['registro accessibile','GRANT SELECT ON artecna_rapportini.allegati TO artecna_rapportini_backend'],
      ['RPC precedente alterata','ALTER FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid) VOLATILE']
    ]) await run(`post-check rifiuta ${label} con rollback`,async()=>{
      const old=(await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid
      await db.exec('BEGIN');await db.exec(`DROP FUNCTION ${signature}`)
      try{await db.exec(install);await db.exec(fault);await assert.rejects(()=>db.exec(postcheck),e=>e.code==='P0001');await assert.rejects(()=>q('SELECT 1'),e=>e.code==='25P02')}
      finally{await db.exec('ROLLBACK')}
      assert.equal((await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid,old)
      assert.deepEqual(await historical(db),funcs)
    })
  } finally {await db.close()}
})

// Concorrenza reale: cluster effimero, bind solo loopback, porte dinamiche.
test('Prenotazione allegati: concorrenza PostgreSQL su connessioni indipendenti',async t=>{
  const cached=path.join(os.tmpdir(),'artecna-postgres-test-runtime/pgsql/bin')
  const bin=process.platform==='win32'?(fs.existsSync(path.join(cached,'initdb.exe'))?cached:'C:/Program Files/PostgreSQL/18/bin'):null
  if(!bin || !fs.existsSync(path.join(bin,'initdb.exe'))) throw new Error('PostgreSQL 18 locale richiesto per certificare la concorrenza')
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-allegati-concorrenza-'))
  // Su Windows il daemon non deve ereditare pipe che tengano spawnSync in attesa.
  const ctl=(exe,args)=>{const r=spawnSync(path.join(bin,exe),args,{stdio:'ignore',windowsHide:true,timeout:30000});if(r.status!==0)throw new Error(`Runtime PostgreSQL locale: ${exe} fallito`)}
  const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
  const config={host:'127.0.0.1',port,database:'postgres',user:'postgres',connectionTimeoutMillis:5000}
  const connections=[];let started=false
  const connect=async(user='postgres')=>{const c=new Client({...config,user});await c.connect();connections.push(c);return c}
  try {
    ctl('initdb.exe',['-D',dir,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'])
    ctl('pg_ctl.exe',['-D',dir,'-l',path.join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true
    const admin=await connect();const db={exec:s=>admin.query(s),query:(s,p)=>admin.query(s,p)}
    await setup(db);await db.exec(sql)
    const before=await domain(db),funcs=await historical(db)
    const c1=await connect('artecna_rapportini_backend'),c2=await connect('artecna_rapportini_backend')
    const pid1=(await c1.query('SELECT pg_backend_pid() pid')).rows[0].pid,pid2=(await c2.query('SELECT pg_backend_pid() pid')).rows[0].pid
    const race=async(x,y)=>{
      await admin.query('BEGIN');await admin.query('SELECT id FROM public.rapportini WHERE id=$1 FOR UPDATE',[RAP])
      const pending=Promise.allSettled([c1.query(callSql,params(x)),c2.query(callSql,params(y))])
      let blocked=false
      try {
        for(let i=0;i<100;i++) {
          const r=await admin.query("SELECT count(*)::integer n FROM pg_stat_activity WHERE pid=ANY($1::integer[]) AND wait_event_type='Lock'",[[pid1,pid2]])
          if(r.rows[0].n===2){blocked=true;break}
          await new Promise(resolve=>setTimeout(resolve,20))
        }
      } finally {await admin.query('COMMIT')}
      const results=await pending
      assert.equal(blocked,true,'entrambe le richieste devono sovrapporsi e attendere il lock Rapportino')
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
      assert.equal(results.filter(r=>r.status==='rejected' && r.reason.code==='PR409').length,1)
      return results.find(r=>r.status==='fulfilled').value.rows[0].v
    }
    await t.test('stessa chiave simultanea: una sola identità, una sola lease',async()=>{
      const x=input(),r=await race(x,x)
      const rows=(await admin.query('SELECT id,lease_id FROM artecna_rapportini.allegati')).rows
      assert.deepEqual(rows,[{id:r.allegato_id,lease_id:r.lease_id}])
    })
    await t.test('chiavi diverse simultanee alla soglia: quota mai oltre 20',async()=>{
      await admin.query('DELETE FROM artecna_rapportini.allegati')
      for(let i=0;i<19;i++)await c1.query(callSql,params(input()))
      await race(input(),input())
      assert.equal((await admin.query('SELECT count(*)::integer n FROM artecna_rapportini.allegati')).rows[0].n,20)
    })
    await t.test('RPC/read/writer e revisioni invariati dopo concorrenza',async()=>{assert.deepEqual(await domain(db),before);assert.deepEqual(await historical(db),funcs)})
  } finally {
    await Promise.allSettled(connections.map(c=>c.end()))
    if(started)ctl('pg_ctl.exe',['-D',dir,'-m','immediate','-w','stop'])
    const resolved=path.resolve(dir),root=path.resolve(os.tmpdir())+path.sep
    if(!resolved.startsWith(root) || !path.basename(resolved).startsWith('artecna-allegati-concorrenza-'))throw new Error('Percorso cleanup locale inatteso')
    fs.rmSync(resolved,{recursive:true,force:true})
  }
})
