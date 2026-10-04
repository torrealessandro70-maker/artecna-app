// Solo PostgreSQL isolati locali; nessuna credenziale di progetto o Storage.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const os=require('node:os'),net=require('node:net')
const {spawnSync}=require('node:child_process')
const {Client}=require('pg')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {fixture,A,B,RAP,OP,TOKEN}=require('./fixtureStep3.cjs')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const sql=fs.readFileSync(path.join(dir,'20261004_rapportino_allegati_tombstone.sql'),'utf8')
const signature='public.cancella_allegato_rapportino_portale(text,uuid)'
const listSignature='public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'
const helperSignature='artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'
const callSql='SELECT public.cancella_allegato_rapportino_portale($1,$2) v'
const listSql='SELECT public.elenca_allegati_rapportino_portale($1,$2,$3,$4) v'
const reserveSql='SELECT public.prenota_allegato_rapportino_portale($1,$2,$3,$4,$5,$6,$7,$8) v'
const photoSchema=`CREATE TABLE public.foto_cantiere(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cantiere_id uuid REFERENCES public.cantieri(id),cantiere text,rapportino_id text,sopralluogo_id text,
  categoria text,data_foto text,nota text,file_url text,file_path text,immagine_base64 text,
  thumbnail_url text,storage_provider text,sync_status text,created_at timestamptz DEFAULT now());`
const whitelist=[
  'crea_sessione_rapportino(text,text)','verifica_sessione_rapportino(text,uuid)',
  'varianti_rapportino_portale(text,uuid)','salva_rapportino_con_prestazioni(jsonb,text)',
  'leggi_rapportino_portale(text,uuid,date,uuid)',
  'prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)',
  'finalizza_allegato_rapportino_portale(text,uuid,uuid)',
  'elenca_allegati_rapportino_portale(text,uuid,uuid,date)','autorizza_accesso_allegato_portale(text,uuid)','cancella_allegato_rapportino_portale(text,uuid)']
async function setup(db){
  await db.exec(fixture);await db.exec(photoSchema)
  for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
    '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql',
    '20261004_rapportino_allegati_registro.sql','20261004_rapportino_allegati_prenotazione.sql',
    '20261004_rapportino_allegati_finalizzazione.sql','20261004_rapportino_allegati_lettura.sql','20261004_rapportino_allegati_cancellazione.sql'])
    await db.exec(fs.readFileSync(path.join(dir,name),'utf8'))
  await db.query("INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,'UTF8')),$2,statement_timestamp()+interval '8 hours')",[TOKEN,OP])
  await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`)
}
async function historical(db){return (await db.query(`SELECT oid,pg_get_functiondef(oid) def,proowner,proacl::text FROM pg_proc
  WHERE pronamespace='artecna_rapportini'::regnamespace OR oid IN (${whitelist.slice(0,9).map(s=>`'public.${s}'::regprocedure`).join(',')}) ORDER BY oid`)).rows}
async function domain(db){
  const r={}
  for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','public.foto_cantiere','artecna_rapportini.allegati','artecna_rapportini.sessioni_portale','artecna_rapportini.richieste'])
    r[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') v FROM ${table} t`)).rows[0].v
  return r
}


test('Allegati 3D.1: CHECK e compatibilità tombstone post-cleanup',async t=>{
  const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows
  const backend=async(fn)=>{await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend');try{return await fn()}finally{await db.exec('SET SESSION AUTHORIZATION postgres')}}
  const call=id=>backend(async()=>(await q(callSql,[TOKEN,id]))[0].v)
  const rejected=(fn,code)=>assert.rejects(fn,e=>e.code===code)
  const record=async id=>(await q('SELECT to_jsonb(a) v FROM artecna_rapportini.allegati a WHERE id=$1',[id]))[0].v
  const seed=async(state='prenotato')=>{
    const r=await backend(async()=>(await q(reserveSql,[TOKEN,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100]))[0].v)
    if(state==='finalizzato')await backend(()=>q('SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3)',[TOKEN,r.allegato_id,r.lease_id]))
    if(state==='scaduto')await q("UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL WHERE id=$1",[r.allegato_id])
    return r.allegato_id
  }
  const fault=async(change,id,code='XX001')=>{
    await db.exec('BEGIN')
    try{await db.exec(change);const before=await domain(db);await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation');await rejected(()=>q(callSql,[TOKEN,id]),code);await db.exec('ROLLBACK TO invocation; SET SESSION AUTHORIZATION postgres');assert.deepEqual(await domain(db),before)}finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
  }
  try{
    await setup(db);const baseline=await historical(db),initial=await domain(db)
    const old=(await q('SELECT prosrc,proacl::text acl,oid FROM pg_proc WHERE oid=$1::regprocedure',[signature]))[0]
    const oldChecks=await q("SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass ORDER BY conname")
    await db.exec(sql)
    await t.test('installazione senza mutazioni dati, CHECK storici/9 RPC/helper/ACL invariati',async()=>{
      assert.deepEqual(await domain(db),initial);assert.deepEqual(await historical(db),baseline)
      const now=(await q('SELECT prosrc,proacl::text acl,oid FROM pg_proc WHERE oid=$1::regprocedure',[signature]))[0];assert.equal(now.acl,old.acl);assert.equal(now.oid,old.oid)
      const extract=s=>s.slice(s.indexOf("  ELSIF a.stato='cancellato' THEN"),s.indexOf('\n  ELSE',s.indexOf("  ELSIF a.stato='cancellato' THEN")))
      assert.equal(now.prosrc.replace(extract(now.prosrc),''),old.prosrc.replace(extract(old.prosrc),''))
      const c=await q("SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass AND conname<>'allegati_cancellato_post_cleanup' ORDER BY conname");assert.deepEqual(c,oldChecks)
      assert.equal((await q("SELECT convalidated FROM pg_constraint WHERE conname='allegati_cancellato_post_cleanup'"))[0].convalidated,true)
    })
    const tombstones=[]
    for(const state of ['prenotato','scaduto','finalizzato'])await t.test(`tombstone da ${state}: valido, storia preservata, retry senza UPDATE/foto`,async()=>{
      const id=await seed(state);await call(id);const pending=await record(id)
      // Solo fixture owner: simula l'esito DB del futuro cleanup, non una nuova RPC.
      await q("UPDATE artecna_rapportini.allegati SET stato='cancellato',foto_cantiere_id=NULL WHERE id=$1",[id])
      if(pending.foto_cantiere_id)await q('DELETE FROM public.foto_cantiere WHERE id=$1',[pending.foto_cantiere_id])
      const before=await domain(db),stored=await record(id)
      assert.equal(stored.finalized_at,pending.finalized_at);assert.equal(stored.removed_at,pending.removed_at)
      for(const key of Object.keys(pending).filter(k=>!['stato','foto_cantiere_id'].includes(k)))assert.deepEqual(stored[key],pending[key])
      await db.exec(`CREATE FUNCTION public.test_deny_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Retry non deve scrivere'; END $$; CREATE TRIGGER test_deny BEFORE UPDATE ON artecna_rapportini.allegati FOR EACH ROW EXECUTE FUNCTION public.test_deny_update()`)
      try{const r=await call(id);assert.deepEqual(r,{versione_contratto:1,esito:'successo',allegato_id:id,stato:'cancellato',foto_cantiere_id:null,removed_at:stored.removed_at});assert.deepEqual(await call(id),r)}finally{await db.exec('DROP TRIGGER test_deny ON artecna_rapportini.allegati; DROP FUNCTION public.test_deny_update()')}
      assert.deepEqual(await domain(db),before);tombstones.push(id)
      await rejected(()=>backend(()=>q(reserveSql,[TOKEN,RAP,A,'2026-09-21',stored.chiave_client_allegato,'ab'.repeat(32),'image/jpeg',100])),'PR409')
      await rejected(()=>backend(()=>q('SELECT public.autorizza_accesso_allegato_portale($1,$2)',[TOKEN,id])),'PR409')
      assert.deepEqual((await backend(()=>q(listSql,[TOKEN,RAP,A,'2026-09-21'])))[0].v.allegati,[])
    })
    const final=await seed('finalizzato'),photo=(await record(final)).foto_cantiere_id
    for(const [label,change]of [['foto',`foto_cantiere_id='${photo}'`],['removed','removed_at=NULL'],['lease','lease_id=gen_random_uuid(),lease_until=statement_timestamp()']])await t.test(`CHECK cancellato ${label}: rifiutato`,()=>rejected(()=>q(`UPDATE artecna_rapportini.allegati SET ${change} WHERE id=$1`,[tombstones[2]]),'23514'))
    for(const state of ['prenotato','scaduto','finalizzato'])await t.test(`3D ${state} -> pending e retry invariati`,async()=>{
      const id=await seed(state),oldRow=await record(id),r=await call(id),stored=await record(id)
      assert.equal(r.stato,'cancellazione_pending');assert.equal(stored.finalized_at,oldRow.finalized_at);assert.equal(stored.foto_cantiere_id,oldRow.foto_cantiere_id);assert.equal(stored.lease_id,null);assert.deepEqual(await call(id),r)
    })
    await call(final)
    for(const [label,change]of [['finalized senza foto','foto_cantiere_id=NULL'],['foto senza finalized','finalized_at=NULL'],['lease','lease_id=gen_random_uuid(),lease_until=statement_timestamp()']])await t.test(`pending ${label}: XX001 invariato`,()=>fault(`UPDATE artecna_rapportini.allegati SET ${change} WHERE id='${final}'`,final))
    await t.test('pending proiezione incoerente XX001',()=>fault(`UPDATE public.foto_cantiere SET categoria='altro' WHERE id='${photo}'`,final))
    await t.test('pending proiezione mancante XX001',()=>fault(`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_foto_cantiere_id_fkey; DELETE FROM public.foto_cantiere WHERE id='${photo}'`,final))
    await t.test('ACL e whitelist esattamente 10: metadati/nessun helper o grant diretto',async()=>{
      const [m]=await q('SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature]);assert.deepEqual(m,{owner:'postgres',prosecdef:true,provolatile:'v',proconfig:['search_path=pg_catalog, pg_temp']})
      const grants=await q("SELECT p.oid::regprocedure::text signature,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole");assert.deepEqual(grants.map(g=>g.signature).sort(),whitelist.slice().sort());for(const g of grants){assert.equal(g.privilege_type,'EXECUTE');assert.equal(g.is_grantable,false)}
      for(const role of ['anon','authenticated','service_role'])assert.equal((await q("SELECT has_function_privilege($1,$2,'EXECUTE') v",[role,signature]))[0].v,false)
      assert.deepEqual(await q("SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND has_function_privilege('artecna_rapportini_backend',oid,'EXECUTE')"),[])
      for(const table of Object.keys(await domain(db)))assert.equal((await q("SELECT has_table_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,REFERENCES') v",[table]))[0].v,false)
    })
    await t.test('nessuna transizione cancellato, Storage/Auth o modifica foto',()=>{
      const body=sql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?AS \$fn\$([\s\S]*?)\$fn\$;/)[1];assert.doesNotMatch(body,/SET stato='cancellato'|\bDELETE\b|\bINSERT\s+INTO\b|UPDATE\s+public\./i);assert.doesNotMatch(sql,/storage\.(objects|buckets)|auth\.|ALTER TABLE public\.foto_cantiere/i)
    })
    const start=sql.indexOf('DO $postcheck$'),install=sql.slice(0,start).replace(/^BEGIN;$/m,''),post=sql.slice(start).replace(/^COMMIT;$/m,'')
    for(const [label,change]of [['CHECK assente','ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_cancellato_post_cleanup'],['CHECK diverso',"ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_cancellato_post_cleanup; ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT allegati_cancellato_post_cleanup CHECK(true)"],['ACL',`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`],['9 RPC divergenti',`ALTER FUNCTION ${listSignature} VOLATILE`],['3D divergente',`ALTER FUNCTION ${signature} STABLE`],['sorgente 3D divergente',sql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$fn\$;/)[0].replace("MESSAGE='Oggetto allegato non valido'","MESSAGE='Definizione diversa'")],['CHECK non validato',"ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_cancellato_post_cleanup; ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT allegati_cancellato_post_cleanup CHECK(stato <> 'cancellato' OR (removed_at IS NOT NULL AND foto_cantiere_id IS NULL AND lease_id IS NULL AND lease_until IS NULL)) NOT VALID"],['grant backend','GRANT SELECT ON public.foto_cantiere TO artecna_rapportini_backend']])await t.test(`post-check ${label} rollback`,async()=>{
      const snapshot=await domain(db);await db.exec('BEGIN')
      try{await db.exec('ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_cancellato_post_cleanup');await db.exec(fs.readFileSync(path.join(dir,'20261004_rapportino_allegati_cancellazione.sql'),'utf8').match(/CREATE FUNCTION[\s\S]*?\$fn\$;/)[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));await db.exec(install);await db.exec(change);await rejected(()=>db.exec(post),'P0001')}finally{await db.exec('ROLLBACK')}
      assert.deepEqual(await domain(db),snapshot);assert.deepEqual(await historical(db),baseline)
    })
    await t.test('preflight dati incompatibili: stop senza normalizzazione',async()=>{
      const before=await domain(db);await db.exec('BEGIN')
      try{await db.exec('ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_cancellato_post_cleanup');await q("UPDATE artecna_rapportini.allegati SET stato='cancellato',removed_at=statement_timestamp() WHERE id=$1",[final]);await rejected(()=>db.exec(sql.replace(/^BEGIN;$/m,'')),'P0001')}finally{await db.exec('ROLLBACK')}
      assert.deepEqual(await domain(db),before)
    })
  }finally{await db.close()}
})

test('Hardening 3D.1: solo equivalenza CRLF/LF, fingerprint e metadati rigorosi',async t=>{
  const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows
  const historicalSql=fs.readFileSync(path.join(dir,'20261004_rapportino_allegati_cancellazione.sql'),'utf8')
  const definition=historicalSql.match(/CREATE FUNCTION[\s\S]*?\$fn\$;/)[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION')
  const original=definition.match(/AS \$fn\$([\s\S]*?)\$fn\$;/)[1]
  const install=sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')
  try{
    await setup(db)
    const cases=[
      ['LF',original,null,true],
      ['CRLF remoto baseline LF',original.replace(/\n/g,'\r\n'),null,true],
      ['intera migration SQL Editor CRLF',original.replace(/\n/g,'\r\n'),null,true,true],
      ['CR isolato',original.replace('DECLARE','DECLARE\r '),null,false],
      ['un carattere',original.replace('v_now','v_nox'),null,false],
      ['whitespace reale',original.replace('DECLARE','DECLARE '),null,false],
      ['commento',original.replace('Ordine globale','Ordine modificato'),null,false],
      ['stringa',original.replace('Accesso Rapportini non consentito','Accesso Rapportini diverso'),null,false],
      ['owner',original,`ALTER FUNCTION ${signature} OWNER TO anon`,false],
      ['security',original,`ALTER FUNCTION ${signature} SECURITY INVOKER`,false],
      ['volatility',original,`ALTER FUNCTION ${signature} STABLE`,false],
      ['search_path',original,`ALTER FUNCTION ${signature} SET search_path TO public`,false],
      ['linguaggio/risultato',null,`DROP FUNCTION ${signature}; CREATE FUNCTION ${signature} RETURNS text LANGUAGE sql AS 'SELECT NULL::text'`,false],
      ['firma',null,`DROP FUNCTION ${signature}`,false],
      ['ACL PUBLIC',original,`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`,false],
      ['ACL grantable',original,`GRANT EXECUTE ON FUNCTION ${signature} TO artecna_rapportini_backend WITH GRANT OPTION`,false],
      ['ACL backend assente',original,`REVOKE EXECUTE ON FUNCTION ${signature} FROM artecna_rapportini_backend`,false]
    ]
    for(const [label,source,change,success,editorCRLF]of cases)await t.test(label,async()=>{
      await db.exec('BEGIN')
      try{
        if(source!==null)await db.exec(definition.replace(original,()=>source))
        if(change)await db.exec(change)
        const before=await domain(db),catalog=await q('SELECT oid,prosrc,proacl::text,proowner,proconfig,provolatile,prosecdef FROM pg_proc WHERE oid=to_regprocedure($1)',[signature])
        await db.exec('SAVEPOINT attempt')
        const migration=editorCRLF?install.replace(/\n/g,'\r\n'):install
        if(success){await db.exec(migration);assert.equal((await q("SELECT count(*)::integer n FROM pg_constraint WHERE conname='allegati_cancellato_post_cleanup' AND convalidated"))[0].n,1)}
        else{
          await assert.rejects(()=>db.exec(migration),e=>e.code==='P0001')
          await db.exec('ROLLBACK TO attempt')
          assert.deepEqual(await q('SELECT oid,prosrc,proacl::text,proowner,proconfig,provolatile,prosecdef FROM pg_proc WHERE oid=to_regprocedure($1)',[signature]),catalog)
          assert.equal((await q("SELECT count(*)::integer n FROM pg_constraint WHERE conname='allegati_cancellato_post_cleanup'"))[0].n,0)
        }
        assert.deepEqual(await domain(db),before)
      }finally{await db.exec('ROLLBACK')}
    })
  }finally{await db.close()}
})
