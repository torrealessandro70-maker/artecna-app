// PostgreSQL/PGlite isolato. Nessuna connessione Supabase o dato della Raccolta n.1.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const production=require('./ponteEconomiaProduction.fixture.json')
const migrations=path.resolve(__dirname,'../../../supabase/migrations')
const read=n=>fs.readFileSync(path.join(migrations,n),'utf8')
const sql=read('20261005_ponte_economia_schema.sql')
const guardSource='ponte_economia_sorgenti'
const guardRows='ponte_economia_lavorazioni'
const historicalSource=read('20260930_variante_sorgenti.sql')
const roles=['anon','authenticated','service_role','artecna_varianti_rpc','artecna_cantieri_delete_rpc']
async function fixture(db){
  await db.exec(roles.map(r=>`CREATE ROLE ${r};`).join('\n'))
  await db.exec('CREATE SCHEMA artecna_guardie; CREATE SCHEMA artecna_distruzione; CREATE SCHEMA artecna_rapportini;')
  await db.exec('CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$SELECT gen_random_uuid()$$;')
  for(const ddl of Object.values(production.tabelle))await db.exec(ddl)
  await db.exec(historicalSource)
  await db.exec(`ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT variante_lavorazioni_sorgente_fk
    FOREIGN KEY(variante_sorgente_id) REFERENCES public.variante_sorgenti(id) ON DELETE RESTRICT;
    CREATE UNIQUE INDEX variante_lavorazioni_sorgente_voce_unique ON public.variante_lavorazioni(variante_sorgente_id,indice_voce_sorgente)
      WHERE variante_sorgente_id IS NOT NULL AND indice_voce_sorgente IS NOT NULL;
    GRANT ALL ON public.variante_sorgenti,public.variante_lavorazioni TO anon,authenticated,service_role;
    GRANT SELECT,INSERT,DELETE ON public.variante_sorgenti TO artecna_varianti_rpc;
    GRANT SELECT,INSERT ON public.variante_lavorazioni TO artecna_varianti_rpc;
    GRANT SELECT,DELETE ON public.variante_sorgenti TO artecna_cantieri_delete_rpc;
    GRANT UPDATE(variante_id) ON public.variante_sorgenti TO artecna_cantieri_delete_rpc;
    ALTER TABLE public.variante_lavorazioni ENABLE ROW LEVEL SECURITY;
    ALTER DEFAULT PRIVILEGES IN SCHEMA artecna_guardie GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`)
  // Corpi Production delle dieci funzioni: certificazione di non modifica.
  // Non si invocano cleanup, chiusura o transizioni su dati aziendali.
  for(const ddl of production.funzioni)await db.exec(ddl)
  await db.exec(`CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-4111-8111-111111111111'::uuid$$;
    CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
    CREATE FUNCTION artecna_distruzione.contesto_variante_valido(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
    CREATE TRIGGER guardia_variante_lavorazioni BEFORE INSERT OR UPDATE OR DELETE ON public.variante_lavorazioni
      FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_variante_figlio();`)
  await db.exec(`ALTER ROLE artecna_varianti_rpc BYPASSRLS;
    GRANT USAGE ON SCHEMA public,artecna_guardie TO artecna_varianti_rpc;
    GRANT SELECT ON public.cantieri,public.varianti_cantiere,public.preventivi_cantiere TO artecna_varianti_rpc;
    GRANT UPDATE(id) ON public.varianti_cantiere TO artecna_varianti_rpc;
    GRANT USAGE ON SEQUENCE public.variante_lavorazioni_id_seq TO artecna_varianti_rpc;
    ALTER FUNCTION public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric) OWNER TO artecna_varianti_rpc;
    ALTER FUNCTION public.aggiungi_sorgente_variante(uuid,text,uuid,text,text,text,text,integer,jsonb) OWNER TO artecna_varianti_rpc;
    ALTER FUNCTION public.rimuovi_sorgente_variante(uuid) OWNER TO artecna_varianti_rpc;`)
}
const q=(db,s,p=[])=>db.query(s,p).then(r=>r.rows)
async function seed(db){
  const c=randomUUID(),p=randomUUID(),v=randomUUID(),r=randomUUID()
  await q(db,'INSERT INTO cantieri(id) VALUES($1)',[c])
  await q(db,'INSERT INTO preventivi_cantiere(id,cantiere,cantiere_id) VALUES($1,$2,$3)',[p,'Fixture',c])
  await q(db,"INSERT INTO varianti_cantiere(id,cantiere_id,preventivo_contrattuale_id,titolo) VALUES($1,$2,$3,'Fixture')",[v,c,p])
  await q(db,"INSERT INTO economia_raccolte(id,cantiere_id,numero,titolo,data,created_by) VALUES($1,$2,$3,'Fixture','2026-10-05',$4)",[r,c,1,randomUUID()])
  return {c,p,v,r}
}
const file=(v,extra={})=>({id:randomUUID(),variante_id:v,tipo:'file',titolo:'File',nome_file:'fixture.xlsx',formato:'excel',snapshot:{},...extra})
const economy=(s,extra={})=>({id:randomUUID(),variante_id:s.v,tipo:'raccolta_economia',titolo:'Economia',snapshot:{},
  economia_raccolta_id:s.r,economia_revisione_sorgente:'1',economia_revisione_congelata:'2',...extra})
async function insert(db,row){
  const e=Object.entries(row)
  return (await q(db,`INSERT INTO public.variante_sorgenti(${e.map(([k])=>k)}) VALUES(${e.map((_,i)=>'$'+(i+1))}) RETURNING *`,e.map(([,v])=>v)))[0]
}
// Solo il proprietario della fixture puo predisporre il futuro dominio.
// Non e' un bypass implementato dalla migration: le guardie sono poi riabilitate.
async function ownerFixture(db,fn){
  await db.exec(`BEGIN; ALTER TABLE public.variante_sorgenti DISABLE TRIGGER ${guardSource};
    ALTER TABLE public.variante_lavorazioni DISABLE TRIGGER ${guardRows};`)
  try{const result=await fn();await db.exec(`ALTER TABLE public.variante_sorgenti ENABLE TRIGGER ${guardSource};
    ALTER TABLE public.variante_lavorazioni ENABLE TRIGGER ${guardRows}; COMMIT;`);return result}
  catch(e){await db.exec('ROLLBACK');throw e}
}
async function state(db){
  return {
    funcs:await q(db,"SELECT oid,prosrc,proowner,proacl::text,proconfig,prosecdef,provolatile FROM pg_proc WHERE pronamespace IN ('public'::regnamespace,'artecna_guardie'::regnamespace,'artecna_distruzione'::regnamespace,'artecna_rapportini'::regnamespace) AND proname<>'proteggi_ponte_economia' ORDER BY oid"),
    acl:await q(db,"SELECT oid,relowner,relacl::text,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.variante_sorgenti'::regclass,'public.variante_lavorazioni'::regclass,'public.varianti_cantiere'::regclass,'public.economia_raccolte'::regclass) ORDER BY oid"),
    source:await q(db,'SELECT id,variante_id,tipo,titolo,nome_file,formato,file_sha256,snapshot_version,snapshot FROM public.variante_sorgenti ORDER BY id')
  }
}
test('Ponte Economia 3: schema Production, CHECK, fail-closed e compatibilita',async t=>{
  const db=new PGlite()
  const run=(n,f)=>t.test(n,f)
  try{
    await fixture(db);const s=await seed(db)
    await insert(db,file(s.v,{file_sha256:'hash storico libero'}))
    await insert(db,{id:randomUUID(),variante_id:s.v,tipo:'preventivo_artecna',titolo:'Preventivo',preventivo_sorgente_id:s.p,snapshot:{}})
    const before=await state(db)
    await db.exec(sql)
    await run('ACL/RLS, RPC storiche, cleanup e dati invariati',async()=>assert.deepEqual(await state(db),before))
    await run('helper postgres privato senza grant da default permissivi',async()=>{
      const [f]=await q(db,"SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure")
      assert.deepEqual(f,{owner:'postgres',prosecdef:true,provolatile:'v',proconfig:['search_path=pg_catalog, pg_temp']})
      for(const r of roles)assert.equal((await q(db,"SELECT has_function_privilege($1,'artecna_guardie.proteggi_ponte_economia()','EXECUTE') v",[r]))[0].v,false)
    })
    await run('file storico valido con hash arbitrario o NULL resta modificabile',async()=>{
      const r=await insert(db,file(s.v));await q(db,"UPDATE variante_sorgenti SET titolo='Modificato' WHERE id=$1",[r.id]);await q(db,'DELETE FROM variante_sorgenti WHERE id=$1',[r.id])
    })
    await run('preventivo storico valido resta modificabile',async()=>{
      const x=await seed(db)
      const r=await insert(db,{id:randomUUID(),variante_id:x.v,tipo:'preventivo_artecna',titolo:'P',preventivo_sorgente_id:x.p,snapshot:{}})
      await q(db,"UPDATE variante_sorgenti SET titolo='Modificato' WHERE id=$1",[r.id])
      await q(db,'DELETE FROM variante_sorgenti WHERE id=$1',[r.id])
    })
    const reject=async(extra,code='23514')=>assert.rejects(()=>ownerFixture(db,()=>insert(db,economy(s,extra))),e=>e.code===code)
    for(const [name,extra] of [
      ['raccolta NULL',{economia_raccolta_id:null}],['revisione sorgente NULL',{economia_revisione_sorgente:null}],
      ['revisione congelata NULL',{economia_revisione_congelata:null}],['sorgente negativa',{economia_revisione_sorgente:-1}],
      ['congelata negativa',{economia_revisione_congelata:-1}],['congelata R+2',{economia_revisione_congelata:3}],
      ['congelata inferiore a R',{economia_revisione_congelata:0}],['preventivo presente',{preventivo_sorgente_id:s.p}],
      ['nome file presente',{nome_file:'x'}],['formato presente',{formato:'excel'}],['hash presente',{file_sha256:'x'}],
      ['snapshot array',{snapshot:[]}],['snapshot scalare',{snapshot:1}],['titolo vuoto',{titolo:'   '}],['versione snapshot zero',{snapshot_version:0}]
    ])await run(`CHECK: ${name} rifiutato`,()=>reject(extra))
    await run('FK raccolta inesistente rifiutata',()=>reject({economia_raccolta_id:randomUUID()},'23503'))
    for(const type of ['file','preventivo_artecna'])for(const col of ['economia_raccolta_id','economia_revisione_sorgente','economia_revisione_congelata'])
      await run(`${type}: ${col} vietata`,()=>assert.rejects(()=>insert(db,type==='file'?file(s.v,{[col]:col==='economia_raccolta_id'?s.r:1}):
        {id:randomUUID(),variante_id:s.v,tipo:type,titolo:'P',preventivo_sorgente_id:s.p,snapshot:{},[col]:col==='economia_raccolta_id'?s.r:1}),e=>e.code==='23514'))
    for(const [name,extra] of [['R invariata',{economia_revisione_congelata:1}],['R+1',{}],['bigint massimo senza overflow',{economia_revisione_sorgente:'9223372036854775807',economia_revisione_congelata:'9223372036854775807'}]])
      await run(`Economia strutturale valida: ${name}`,async()=>{const x=await seed(db);assert.equal((await ownerFixture(db,()=>insert(db,economy(x,extra)))).tipo,'raccolta_economia')})
    await run('nessun writer temporaneo: INSERT Economia normale negato anche a postgres',()=>assert.rejects(()=>insert(db,economy(s)),e=>e.code==='42501'))
    const dedicated=await seed(db);const ec=await ownerFixture(db,()=>insert(db,economy(dedicated)))
    await run('stessa Raccolta in altra Variante rifiutata',async()=>{const x=await seed(db);await assert.rejects(()=>ownerFixture(db,()=>insert(db,economy(x,{economia_raccolta_id:dedicated.r}))),e=>e.code==='23505')})
    await run('seconda sorgente Economia stessa Variante rifiutata',async()=>{const x=await seed(db);await assert.rejects(()=>ownerFixture(db,()=>insert(db,economy(x,{variante_id:dedicated.v}))),e=>e.code==='23505')})
    await run('FK RESTRICT validata/non deferrable e DELETE Raccolta negato',async()=>{
      const [fk]=await q(db,"SELECT confdeltype,convalidated,condeferrable,condeferred FROM pg_constraint WHERE conname='variante_sorgenti_economia_raccolta_fk' AND conrelid='public.variante_sorgenti'::regclass")
      assert.deepEqual(fk,{confdeltype:'r',convalidated:true,condeferrable:false,condeferred:false})
      await assert.rejects(()=>q(db,'DELETE FROM economia_raccolte WHERE id=$1',[dedicated.r]),e=>['23503','23001'].includes(e.code))
    })
    for(const [name,statement] of [
      ['UPDATE sorgente','UPDATE variante_sorgenti SET titolo=\'X\' WHERE id=$1'],
      ['DELETE sorgente','DELETE FROM variante_sorgenti WHERE id=$1'],
      ['conversione sorgente in file',"UPDATE variante_sorgenti SET tipo='file',nome_file='x',formato='excel',economia_raccolta_id=NULL,economia_revisione_sorgente=NULL,economia_revisione_congelata=NULL WHERE id=$1"]
    ])await run(`${name} negato`,()=>assert.rejects(()=>q(db,statement,[ec.id]),e=>e.code==='42501'))
    await run('sorgente file ulteriore nella dedicata negata',()=>assert.rejects(()=>insert(db,file(dedicated.v)),e=>e.code==='42501'))
    const work=(v,source=null)=>q(db,"INSERT INTO variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,variante_sorgente_id,indice_voce_sorgente) VALUES($1,1,'nuova','Fixture','h',1,10,10,$2,$3) RETURNING id",[v,source,source?0:null])
    const [row]=await ownerFixture(db,()=>work(dedicated.v,ec.id))
    await run('INSERT manuale aggiuntivo nella dedicata negato',()=>assert.rejects(()=>work(dedicated.v),e=>e.code==='42501'))
    await run('INSERT collegato Economia negato',()=>assert.rejects(()=>work(s.v,ec.id),e=>e.code==='42501'))
    await run('UPDATE lavorazione Economia negato',()=>assert.rejects(()=>q(db,"UPDATE variante_lavorazioni SET descrizione='X' WHERE id=$1",[row.id]),e=>e.code==='42501'))
    await run('spostamento lavorazione Economia negato',()=>assert.rejects(()=>q(db,'UPDATE variante_lavorazioni SET variante_id=$1,variante_sorgente_id=NULL,indice_voce_sorgente=NULL WHERE id=$2',[s.v,row.id]),e=>e.code==='42501'))
    await run('spostamento lavorazione normale dentro Variante Economia negato',async()=>{
      const x=await seed(db);const [r]=await work(x.v)
      await assert.rejects(()=>q(db,'UPDATE variante_lavorazioni SET variante_id=$1,numero_riga=2 WHERE id=$2',[dedicated.v,r.id]),e=>e.code==='42501')
      assert.equal((await q(db,'SELECT variante_id FROM variante_lavorazioni WHERE id=$1',[r.id]))[0].variante_id,x.v)
    })
    await run('spostamento sorgente file dentro Variante Economia negato',async()=>{
      const x=await seed(db);const r=await insert(db,file(x.v))
      await assert.rejects(()=>q(db,'UPDATE variante_sorgenti SET variante_id=$1 WHERE id=$2',[dedicated.v,r.id]),e=>e.code==='42501')
    })
    await run('spostamento manuale senza sorgente fuori Variante Economia negato',async()=>{
      const x=await seed(db),target=await seed(db)
      const [r]=await ownerFixture(db,async()=>{await insert(db,economy(x));return work(x.v)})
      await assert.rejects(()=>q(db,'UPDATE variante_lavorazioni SET variante_id=$1 WHERE id=$2',[target.v,r.id]),e=>e.code==='42501')
    })
    await run('sorgente file nella dedicata: spostamento e rimozione negati',async()=>{
      const x=await seed(db),target=await seed(db)
      const r=await ownerFixture(db,async()=>{await insert(db,economy(x));return insert(db,file(x.v))})
      await assert.rejects(()=>q(db,'UPDATE variante_sorgenti SET variante_id=$1 WHERE id=$2',[target.v,r.id]),e=>e.code==='42501')
      await assert.rejects(()=>q(db,'DELETE FROM variante_sorgenti WHERE id=$1',[r.id]),e=>e.code==='42501')
    })
    await run('DELETE lavorazione Economia negato',()=>assert.rejects(()=>q(db,'DELETE FROM variante_lavorazioni WHERE id=$1',[row.id]),e=>e.code==='42501'))
    await run('nessun flag sessione apre il writer',async()=>{await db.exec("SET ponte_economia.writer='true'");await assert.rejects(()=>insert(db,economy(s)),e=>e.code==='42501')})
    await run('manuale invariato: INSERT UPDATE DELETE lavorazione',async()=>{const x=await seed(db);const [r]=await work(x.v);await q(db,"UPDATE variante_lavorazioni SET descrizione='Modificata' WHERE id=$1",[r.id]);await q(db,'DELETE FROM variante_lavorazioni WHERE id=$1',[r.id])})
    await run('RPC storica aggiungi_lavorazione_variante funziona con guardia privata',async()=>{
      const x=await seed(db)
      const [r]=await q(db,"SELECT * FROM public.aggiungi_lavorazione_variante($1,'Manuale','h',1,10)",[x.v])
      assert.equal(r.operazione,'nuova');assert.equal(r.delta_contratto,'10.00')
    })
    await run('RPC storiche aggiungi/rimuovi sorgente file invariate',async()=>{
      const x=await seed(db)
      const [r]=await q(db,"SELECT * FROM public.aggiungi_sorgente_variante($1,'file',NULL,'Fixture','fixture.xlsx','excel',NULL,1,'{}')",[x.v])
      assert.equal(r.tipo,'file');assert.equal(r.economia_raccolta_id,null)
      await q(db,'SELECT public.rimuovi_sorgente_variante($1)',[r.id])
      assert.equal((await q(db,'SELECT count(*)::int n FROM variante_sorgenti WHERE id=$1',[r.id]))[0].n,0)
    })
    await run('transizioni testata proposta/approvazione non bloccate dalla nuova guardia',async()=>{
      await q(db,"UPDATE varianti_cantiere SET stato='proposta',numero=1 WHERE id=$1",[dedicated.v])
      await q(db,"UPDATE varianti_cantiere SET stato='approvata',importo_delta_approvato=10,approvata_at=now(),riferimento_approvazione='Fixture' WHERE id=$1",[dedicated.v])
    })
    await run('migration riapplicata rifiutata atomicamente',async()=>{const before=(await q(db,"SELECT count(*)::int n FROM variante_sorgenti WHERE tipo='raccolta_economia'"))[0].n;await assert.rejects(()=>db.exec(sql),e=>e.code==='P0001');await db.exec('ROLLBACK');assert.equal((await q(db,"SELECT count(*)::int n FROM variante_sorgenti WHERE tipo='raccolta_economia'"))[0].n,before)})
  }finally{await db.close()}
})

test('Guardia Economia selettiva: prova reale dei lock su PostgreSQL locale',async t=>{
  const os=require('node:os'),net=require('node:net'),{spawnSync}=require('node:child_process')
  const {Client}=require('pg')
  const bin=path.join(os.tmpdir(),'artecna-postgres-test-runtime/pgsql/bin')
  if(!fs.existsSync(path.join(bin,'initdb.exe')))throw new Error('Runtime PostgreSQL locale richiesto')
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-ponte-lock-'))
  const port=await new Promise((resolve,reject)=>{
    const server=net.createServer();server.on('error',reject)
    server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p))})
  })
  const clients=[];let started=false
  const ctl=(exe,args)=>{
    const r=spawnSync(path.join(bin,exe),args,{encoding:'utf8',windowsHide:true,timeout:30000})
    if(r.status!==0)throw new Error(`Runtime locale ${exe} non avviabile: ${r.error?.message||r.stderr}`)
  }
  const connect=async()=>{const c=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',connectionTimeoutMillis:5000});await c.connect();clients.push(c);return c}
  try{
    ctl('initdb.exe',['-D',scratch,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'])
    ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true
    const admin=await connect(),locker=await connect(),worker=await connect()
    const db={exec:s=>admin.query(s),query:(s,p)=>admin.query(s,p)}
    await fixture(db);const s=await seed(db);await db.exec(sql)
    // Solo nella fixture: isola la guardia nuova. Quella storica esegue gia
    // FOR UPDATE sulle lavorazioni e viene verificata attiva dagli altri test.
    await db.exec('ALTER TABLE variante_lavorazioni DISABLE TRIGGER guardia_variante_lavorazioni')
    await worker.query("SET lock_timeout='150ms'; SET statement_timeout='5s'")
    await locker.query('BEGIN')
    await locker.query('SELECT id FROM varianti_cantiere WHERE id=$1 FOR NO KEY UPDATE',[s.v])
    await t.test('controllo positivo: FOR UPDATE bloccato; FK KEY SHARE compatibile',async()=>{
      await assert.rejects(()=>worker.query('SELECT id FROM varianti_cantiere WHERE id=$1 FOR UPDATE',[s.v]),e=>e.code==='55P03')
      assert.equal((await worker.query('SELECT id FROM varianti_cantiere WHERE id=$1 FOR KEY SHARE',[s.v])).rows.length,1)
    })
    let workId,fileId
    await t.test('INSERT manuale normale: nessun nuovo lock Economia',async()=>{
      workId=(await worker.query("INSERT INTO variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,quantita_delta,prezzo_unitario,delta_contratto) VALUES($1,1,'nuova','Fixture',1,10,10) RETURNING id",[s.v])).rows[0].id
    })
    await t.test('UPDATE manuale normale: nessun nuovo lock Economia',()=>worker.query("UPDATE variante_lavorazioni SET descrizione='Modificata' WHERE id=$1",[workId]))
    await t.test('DELETE manuale normale: nessun nuovo lock Economia',()=>worker.query('DELETE FROM variante_lavorazioni WHERE id=$1',[workId]))
    const workerDb={query:(query,params)=>worker.query(query,params)}
    await t.test('INSERT file normale: nessun nuovo lock Economia',async()=>{fileId=(await insert(workerDb,file(s.v))).id})
    await t.test('UPDATE file normale: nessun nuovo lock Economia',()=>worker.query("UPDATE variante_sorgenti SET titolo='Modificato' WHERE id=$1",[fileId]))
    await t.test('DELETE file normale: nessun nuovo lock Economia',()=>worker.query('DELETE FROM variante_sorgenti WHERE id=$1',[fileId]))
    await t.test('tipo NULL non Economia: errore storico NOT NULL, nessun nuovo lock',()=>
      assert.rejects(()=>insert(workerDb,file(s.v,{tipo:null})),e=>e.code==='23502'))
    await t.test('INSERT/DELETE preventivo storico: nessun nuovo lock Economia',async()=>{
      const row=await insert(workerDb,{id:randomUUID(),variante_id:s.v,tipo:'preventivo_artecna',titolo:'Fixture',preventivo_sorgente_id:s.p,snapshot:{}})
      await worker.query('DELETE FROM variante_sorgenti WHERE id=$1',[row.id])
    })
    await t.test('dominio Economia coinvolto: il nuovo lock viene acquisito',async()=>{
      // Inserimento fixture del proprietario, non un bypass della migration.
      await ownerFixture(db,()=>insert(db,economy(s)))
      await assert.rejects(()=>worker.query("INSERT INTO variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,quantita_delta,prezzo_unitario,delta_contratto) VALUES($1,1,'nuova','Fixture',1,10,10)",[s.v]),e=>e.code==='55P03')
    })
    await locker.query('ROLLBACK')
    await db.exec('ALTER TABLE variante_lavorazioni ENABLE TRIGGER guardia_variante_lavorazioni')
  }finally{
    await Promise.allSettled(clients.map(c=>c.end()))
    if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop'])
    const resolved=path.resolve(scratch),root=path.resolve(os.tmpdir())+path.sep
    if(!resolved.startsWith(root)||!path.basename(resolved).startsWith('artecna-ponte-lock-'))throw new Error('Percorso cleanup test inatteso')
    fs.rmSync(resolved,{recursive:true,force:true})
  }
})

test('Ponte Economia 3: preflight e postcheck annullano DDL parziali',async t=>{
  const db=new PGlite()
  try{
    await fixture(db);await seed(db)
    await t.test('baseline divergente: nessuna colonna/helper parziale',async()=>{
      await db.exec('ALTER TABLE variante_sorgenti ADD COLUMN inattesa text')
      await assert.rejects(()=>db.exec(sql),e=>e.code==='P0001');await db.exec('ROLLBACK')
      assert.equal((await q(db,"SELECT to_regprocedure('artecna_guardie.proteggi_ponte_economia()')::text f"))[0].f,null)
      assert.equal((await q(db,"SELECT count(*)::int n FROM pg_attribute WHERE attrelid='variante_sorgenti'::regclass AND attname='economia_raccolta_id' AND NOT attisdropped"))[0].n,0)
      // Ripristino fixture tramite transazione separata non altera la baseline dei test successivi.
      await db.exec('ALTER TABLE variante_sorgenti DROP COLUMN inattesa')
    })
    // Nuova fixture per evitare attributi dropped, intenzionalmente rifiutati dal preflight.
  }finally{await db.close()}
  for(const [name,fault,message] of [
    ['grant browser','GRANT UPDATE(economia_raccolta_id) ON variante_sorgenti TO authenticated;','colonne Economia'],
    ['RLS','ALTER TABLE variante_sorgenti DISABLE ROW LEVEL SECURITY;','ACL o RLS'],
    ['FK CASCADE','ALTER TABLE variante_sorgenti DROP CONSTRAINT variante_sorgenti_economia_raccolta_fk; ALTER TABLE variante_sorgenti ADD CONSTRAINT variante_sorgenti_economia_raccolta_fk FOREIGN KEY(economia_raccolta_id) REFERENCES economia_raccolte(id) ON DELETE CASCADE;','FK Economia'],
    ['CHECK nuovo assente','ALTER TABLE variante_sorgenti DROP CONSTRAINT variante_sorgenti_coerenza_tipo_check;','Vincoli finali'],
    ['indice nuovo assente','DROP INDEX variante_sorgenti_economia_raccolta_unique;','Indici finali'],
    ['cleanup modificato',"CREATE OR REPLACE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid,p_conferma text) RETURNS TABLE(cantiere_id uuid,eliminato boolean,storage_nuovi bigint,conteggi jsonb) LANGUAGE plpgsql AS $$BEGIN RETURN; END$$;",'cleanup modificati'],
    ['helper PUBLIC','GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_ponte_economia() TO PUBLIC;','Helper privato'],
    ['guardia disabilitata','ALTER TABLE variante_sorgenti DISABLE TRIGGER ponte_economia_sorgenti;','Guardie ponte']
  ])await t.test(`postcheck ${name}: rollback completo`,async()=>{
    const d=new PGlite()
    try{
      await fixture(d);await seed(d);const before=await state(d)
      const changed=sql.replace('DO $postcheck$',()=>fault+'\nDO $postcheck$')
      await assert.rejects(()=>d.exec(changed),e=>e.code==='P0001' && e.message.includes(message));await d.exec('ROLLBACK')
      assert.deepEqual(await state(d),before)
      assert.equal((await q(d,"SELECT to_regprocedure('artecna_guardie.proteggi_ponte_economia()')::text f"))[0].f,null)
      assert.equal((await q(d,"SELECT count(*)::int n FROM pg_attribute WHERE attrelid='variante_sorgenti'::regclass AND attname='economia_raccolta_id' AND NOT attisdropped"))[0].n,0)
    }finally{await d.close()}
  })
  for(const [name,fault,message] of [
    ['CHECK storico','ALTER TABLE variante_sorgenti DROP CONSTRAINT variante_sorgenti_titolo_check','Baseline vincoli'],
    ['indice storico','DROP INDEX variante_sorgenti_file_sha256_unique','Baseline indici'],
    ['owner','ALTER TABLE variante_sorgenti OWNER TO authenticated','owner/RLS'],
    ['RLS','ALTER TABLE variante_sorgenti DISABLE ROW LEVEL SECURITY','owner/RLS'],
    ['colonna Economia preesistente','ALTER TABLE variante_sorgenti ADD COLUMN economia_raccolta_id uuid','Baseline colonne']
  ])await t.test(`preflight ${name}: nessuna installazione parziale`,async()=>{
    const d=new PGlite()
    try{
      await fixture(d);const before=await state(d)
      // Fault e migration nella stessa transazione, poi rollback anche del fault.
      const changed=sql.replace('DO $preflight$',()=>fault+';\nDO $preflight$')
      await assert.rejects(()=>d.exec(changed),e=>e.code==='P0001' && e.message.includes(message))
      await d.exec('ROLLBACK');assert.deepEqual(await state(d),before)
      assert.equal((await q(d,"SELECT to_regprocedure('artecna_guardie.proteggi_ponte_economia()')::text f"))[0].f,null)
    }finally{await d.close()}
  })
})
