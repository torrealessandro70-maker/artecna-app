const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{withNative}=require('./native.cjs')
test('prerequisiti: PostgreSQL 17.6 isolato, nessuna connessione esterna',{timeout:180000},async t=>withNative(async(db,connect)=>{
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows
 const u=randomUUID(),other=randomUUID(),a=randomUUID(),b=randomUUID(),unique=randomUUID()
 await q('INSERT INTO auth.users(id) VALUES($1),($2)',[u,other])
 await q("INSERT INTO public.cantieri(id,nome) VALUES($1,'Omonimo'),($2,'Omonimo'),($3,'Unico')",[a,b,unique])
 await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner'),($3,$4,'owner'),($5,$2,'owner')",[a,u,b,other,unique])
 await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])
 const ref=async(cid,key,bucket='preventivi')=>{const id=randomUUID();await q('INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,file_path) VALUES($1,$2,$3,$4)',[id,'Omonimo',cid,bucket==='preventivi'?key:`https://axuiaiglbahygsmeoypy.supabase.co/storage/v1/object/public/${bucket}/${key}`]);await q("SELECT artecna_distruzione.storage_autorizza_cleanup($1,$2,'synthetic fixture creator evidence')",[bucket,key]);return id}
 const remove=id=>q('DELETE FROM public.preventivi_cantiere WHERE id=$1',[id])
 const count=async(bucket,key)=>Number((await q('SELECT artecna_distruzione.numero_riferimenti_vivi($1,$2) n',[bucket,key]))[0].n)
 const claim=async()=> (await q('SELECT artecna_distruzione.storage_claim() job'))[0].job
 const finish=async(j,ok=true,permanent=false)=>{await q('SELECT artecna_distruzione.storage_finish($1,$2,$3,$4,$5)',[j.id,j.token,ok,permanent,'TEST']);await q('SELECT pg_advisory_unlock($1::bigint)',[j.lock_key])}
 await t.test('copertura sorgenti, URI canonici; base64 e URL generici esclusi',async()=>{
  assert.equal((await q('SELECT artecna_distruzione.storage_copertura_valida() ok'))[0].ok,true)
  assert.deepEqual(await q("SELECT * FROM artecna_distruzione.storage_uri('https://example.org/a')"),[])
  assert.deepEqual(await q("SELECT * FROM artecna_distruzione.storage_uri('data:image/png;base64,abc')"),[])
  assert.equal((await q("SELECT * FROM artecna_distruzione.storage_uri('quaderno-sopralluogo:utenti%2Fx%2F%C3%A8')"))[0].path,'utenti/x/è')
 })
 await t.test('due riferimenti stessa entità/due cantieri; residuo conserva; ultimo riferimento abilita job',async()=>{
  const x=await ref(a,'shared'),y=await ref(b,'shared');assert.equal(await count('preventivi','shared'),2)
  await remove(x);assert.equal(await count('preventivi','shared'),1);assert.equal(await claim(),null)
  await remove(y);assert.equal(await count('preventivi','shared'),0);const j=await claim();assert.equal(j.path,'shared');await finish(j)
  assert.equal((await q("SELECT stato FROM artecna_distruzione.cleanup_storage WHERE bucket='preventivi' AND path='shared' LIMIT 1"))[0].stato,'completed')
 })
 await t.test('due campi nello stesso record proteggono l’oggetto finché uno è vivo',async()=>{
  const id=await ref(a,'two-fields');await q("UPDATE public.preventivi_cantiere SET file_url='https://axuiaiglbahygsmeoypy.supabase.co/storage/v1/object/public/preventivi/two-fields' WHERE id=$1",[id])
  await q('UPDATE public.preventivi_cantiere SET file_path=NULL WHERE id=$1',[id]);assert.equal(await count('preventivi','two-fields'),1)
  await remove(id);await finish(await claim())
 })
 await t.test('due tipi di entità condividono lo stesso oggetto; aggiornamento rimuove solo il proprio riferimento',async()=>{
  const x=await ref(a,'cross-entity'),y=randomUUID()
  await q("INSERT INTO public.attrezzi_cantiere(id,cantiere,cantiere_id,file_path) VALUES($1,'Omonimo',$2,'cross-entity')",[y,a])
  assert.equal(await count('preventivi','cross-entity'),2);await remove(x);assert.equal(await claim(),null)
  await q('UPDATE public.attrezzi_cantiere SET file_path=NULL WHERE id=$1',[y]);assert.equal(await count('preventivi','cross-entity'),0);await finish(await claim())
 })
 await t.test('job duplicati fra cantieri, stesso path bucket distinti, bucket uguale path distinti',async()=>{
  const ids=[await ref(a,'same-path'),await ref(a,'same-path','rapportini-v1'),await ref(a,'different-path')]
  for(const id of ids)await remove(id)
  await q("INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path) VALUES($1,'preventivi','same-path') ON CONFLICT DO NOTHING",[b])
  const seen=[];for(let i=0;i<3;i++){const j=await claim();assert(j);seen.push(j.bucket+'/'+j.path);await finish(j)}
  assert.equal(new Set(seen).size,3);assert(seen.includes('rapportini-v1/same-path'));assert.equal(await claim(),null)
 })
 await t.test('nuovo riferimento concorrente durante lease attende, poi fallisce; secondo worker non processa',async()=>{
  const id=await ref(a,'race');await remove(id);const j=await claim();assert.equal(j.path,'race')
  const c=await connect(),c2=await connect();let settled=false
  const insert=c.query("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,file_path) VALUES($1,'Omonimo',$2,'race')",[randomUUID(),a]).then(()=>{settled=true;return null},e=>{settled=true;return e})
  // pg_locks proves the writer actually reached the conflicting lock, not a
  // sleep-based assumption about scheduling.
  let waiting=false;for(let i=0;i<40;i++){const r=await c2.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) ok");if(r.rows[0].ok){waiting=true;break}await new Promise(r=>setTimeout(r,10))}
  assert(waiting);assert.equal(settled,false)
  assert.equal((await c2.query('SELECT artecna_distruzione.storage_claim() job')).rows[0].job,null)
  await finish(j);const error=await insert;assert.equal(error.code,'55000');assert.equal(await count('preventivi','race'),0)
 })
 await t.test('errore transitorio, retry, lease scaduto/crash dopo DELETE prima ack; token obsoleto negato',async()=>{
  const id=await ref(a,'retry');await remove(id);let j=await claim();await finish(j,false)
  await q("UPDATE artecna_distruzione.cleanup_storage SET retry_at=clock_timestamp()-interval '1 second' WHERE id=$1",[j.id]);j=await claim();assert.equal(j.attempt,2)
  // Simulates external DELETE success and process/connection loss before ack.
  const stale=j;await q("UPDATE artecna_distruzione.cleanup_storage SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[j.id]);await q('SELECT pg_advisory_unlock($1::bigint)',[j.lock_key]);j=await claim();assert.notEqual(j.token,stale.token)
  await assert.rejects(q('SELECT artecna_distruzione.storage_finish($1,$2,true,false,NULL)',[stale.id,stale.token]));await finish(j)
 })
 await t.test('job sconosciuto/estraneo non raggiunge mai il consumer',async()=>{
  await q("INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path) VALUES($1,'preventivi','foreign-unregistered')",[a]);assert.equal(await claim(),null)
  const r=(await q("SELECT permanente,ultimo_errore FROM artecna_distruzione.cleanup_storage WHERE path='foreign-unregistered'"))[0];assert.equal(r.permanente,true);assert.equal(r.ultimo_errore,'UNREGISTERED_OBJECT')
 })
 await t.test('un URL arbitrario registrato protegge il file ma non autorizza a cancellarlo',async()=>{
  const id=randomUUID();await q("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,file_url) VALUES($1,'Omonimo',$2,'https://axuiaiglbahygsmeoypy.supabase.co/storage/v1/object/public/preventivi/foreign-registered')",[id,a]);await remove(id)
  assert.equal(await claim(),null);assert.equal((await q("SELECT ultimo_errore FROM artecna_distruzione.cleanup_storage WHERE path='foreign-registered'"))[0].ultimo_errore,'NO_CLEANUP_AUTHORITY')
 })
 await t.test('JSON senza bucket e deriva schema bloccano il consumer; rollback lascia registro coerente',async()=>{
  const id=await ref(a,'ambiguous-json')
  await q('BEGIN');await q('UPDATE public.preventivi_cantiere SET json_voci_ai=$1 WHERE id=$2',[JSON.stringify({file_path:'unknown'}),id])
  await q('SAVEPOINT before_claim');await assert.rejects(claim(),e=>e.message==='Copertura Storage non certificata');await q('ROLLBACK TO before_claim');await q('ROLLBACK')
  assert.equal(await count('preventivi','ambiguous-json'),1)
  await q('BEGIN');await q('ALTER TABLE public.cantieri ADD COLUMN unknown_payload jsonb');assert.equal((await q('SELECT artecna_distruzione.storage_copertura_valida() ok'))[0].ok,false);await q('ROLLBACK')
  await remove(id);await finish(await claim())
 })
 await t.test('ACL: browser non può chiamare worker o helper privati',async()=>{
  const denied=await q("SELECT has_function_privilege('authenticated','artecna_distruzione.storage_claim()','EXECUTE') claim,has_function_privilege('authenticated','artecna_distruzione.detach_contabile_cantiere()','EXECUTE') detach");assert.deepEqual(denied[0],{claim:false,detach:false})
 })
 await t.test('worker con login scoped può claim/finish ma non leggere o alterare il registro',async()=>{
  const id=await ref(a,'scoped-login');await remove(id)
  await q('CREATE ROLE fixture_worker LOGIN IN ROLE artecna_storage_worker');const c=await connect();await c.query('SET SESSION AUTHORIZATION fixture_worker')
  await assert.rejects(c.query('SELECT * FROM artecna_distruzione.storage_oggetti'),e=>e.code==='42501')
  const j=(await c.query('SELECT artecna_distruzione.storage_claim() job')).rows[0].job;assert.equal(j.path,'scoped-login')
  await c.query('SELECT artecna_distruzione.storage_finish($1,$2,true,false,NULL)',[j.id,j.token]);await c.query('SELECT pg_advisory_unlock($1::bigint)',[j.lock_key])
 })
 await t.test('legacy: nome unico backfill; omonimi irrisolti; approvazione, owner e retry',async()=>{
  const ids=(await q("INSERT INTO public.memoria_prezzi(descrizione,cantiere) VALUES('Univoco','Unico'),('Ambiguo','Omonimo') RETURNING id,descrizione"));const x=ids.find(r=>r.descrizione==='Univoco').id,y=ids.find(r=>r.descrizione==='Ambiguo').id
  await q('SELECT artecna_distruzione.normalizza_legacy_cantiere()');assert.equal((await q('SELECT cantiere_id FROM public.memoria_prezzi WHERE id=$1',[x]))[0].cantiere_id,unique);assert.equal((await q('SELECT cantiere_id FROM public.memoria_prezzi WHERE id=$1',[y]))[0].cantiere_id,null)
  const fp=(await q("SELECT impronta FROM artecna_distruzione.legacy_da_risolvere WHERE tabella='public.memoria_prezzi' AND source_id=$1",[String(y)]))[0].impronta
  await assert.rejects(q("SELECT public.assegna_legacy_cantiere('public.memoria_prezzi',$1,$2,$3)",[String(y),a,fp]),e=>e.code==='42501')
  await q("SELECT artecna_distruzione.approva_risoluzione_legacy('public.memoria_prezzi',$1,$2,$3,$4)",[String(y),a,u,fp]);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[other])
  await assert.rejects(q("SELECT public.assegna_legacy_cantiere('public.memoria_prezzi',$1,$2,$3)",[String(y),a,fp]),e=>e.code==='42501')
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[u]);await q("SELECT public.assegna_legacy_cantiere('public.memoria_prezzi',$1,$2,$3)",[String(y),a,fp]);assert.equal((await q('SELECT cantiere_id FROM public.memoria_prezzi WHERE id=$1',[y]))[0].cantiere_id,a)
  await q("SELECT public.assegna_legacy_cantiere('public.memoria_prezzi',$1,$2,$3)",[String(y),a,fp])
  await assert.rejects(q("SELECT public.assegna_legacy_cantiere('public.memoria_prezzi',$1,$2,$3)",[String(x),a,fp]),e=>e.code==='42501')
  await q('BEGIN');await q("SELECT artecna_distruzione.apri_contesto_prerequisiti($1,'ELIMINA')",[a]);assert.equal(Number((await q("SELECT quantita FROM artecna_distruzione.manifest_cantiere($1) WHERE entita='memoria_prezzi'",[a]))[0].quantita),1);await q('ROLLBACK')
 })
 await t.test('legacy: una guardia 55000 impedisce la normalizzazione e lascia da_risolvere',async()=>{
  await q('BEGIN');const id=(await q("INSERT INTO public.memoria_prezzi(descrizione,cantiere) VALUES('Protetto','Unico') RETURNING id"))[0].id
  await q("CREATE FUNCTION pg_temp.fixture_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutabile' USING ERRCODE='55000'; END $$")
  await q('CREATE TRIGGER fixture_guard BEFORE UPDATE ON public.memoria_prezzi FOR EACH ROW EXECUTE FUNCTION pg_temp.fixture_guard()')
  await q('SELECT artecna_distruzione.normalizza_legacy_cantiere()')
  assert.equal((await q('SELECT cantiere_id FROM public.memoria_prezzi WHERE id=$1',[id]))[0].cantiere_id,null)
  assert.equal((await q("SELECT count(*)::int n FROM artecna_distruzione.legacy_da_risolvere WHERE tabella='public.memoria_prezzi' AND source_id=$1",[String(id)]))[0].n,1)
  await q('ROLLBACK')
 })
}))
