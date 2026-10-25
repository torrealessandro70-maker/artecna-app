const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),{PGlite}=require('@electric-sql/pglite')
const ts=require('typescript')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f)
const {leggiOsservatore,payloadOsservatoreVariante}=require('./contratto.ts')
const root=path.resolve(__dirname,'../../..')
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261025_variante_foto_osservatore.sql'),'utf8')
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`
const u=id(1),other=id(2),c=id(3),co=id(4),v=id(5),q=id(6),f1=id(7),f2=id(8),fo=id(9),s=id(10),so=id(11),sp=id(12),spo=id(13),contract=id(14)
const data='data:image/png;base64,iVBORw0KGgo='
test('Foto/analisi Variante: SQL effettivo su PostgreSQL embedded, nessuna rete/AI',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE ROLE artecna_rapportini_backend;
 CREATE SCHEMA artecna_guardie;
 CREATE TABLE cantieri(id uuid PRIMARY KEY,nome text,origine_preventivo_id uuid,preventivo_contrattuale_id uuid);
 CREATE TABLE utenti_cantiere(user_id uuid,cantiere_id uuid,ruolo text);
 CREATE TABLE varianti_cantiere(id uuid PRIMARY KEY,cantiere_id uuid NOT NULL,stato text NOT NULL,titolo text,descrizione text);
 CREATE TABLE preventivi_cantiere(id uuid PRIMARY KEY,cantiere_id uuid,sopralluogo_id text);
 CREATE TABLE sopralluoghi(id uuid PRIMARY KEY);
 CREATE TABLE foto_sopralluogo(id uuid PRIMARY KEY,sopralluogo_id uuid REFERENCES sopralluoghi,nota text,immagine_base64 text,tag text,created_at timestamptz);
 CREATE TABLE foto_cantiere(id uuid PRIMARY KEY,cantiere_id uuid,cantiere text,nota text,immagine_base64 text,file_url text,file_path text,allegato_v1_id uuid,created_at timestamp);
 CREATE TABLE quaderno_progetti(id uuid PRIMARY KEY,user_id uuid NOT NULL,titolo text NOT NULL,testo text NOT NULL,updated_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),gestione_id uuid,gestione_copia boolean NOT NULL DEFAULT false,checklist jsonb NOT NULL DEFAULT '[]',disegni jsonb NOT NULL DEFAULT '[]',analisi_ai jsonb);
 CREATE FUNCTION economia_fixture() RETURNS text LANGUAGE sql AS $$SELECT 'invariata'::text$$;
 INSERT INTO cantieri VALUES('${c}','Cantiere test',NULL,'${contract}'),('${co}','Altro',NULL,NULL);
 INSERT INTO utenti_cantiere VALUES('${u}','${c}','owner'),('${other}','${co}','owner');
 INSERT INTO varianti_cantiere VALUES('${v}','${c}','bozza','Variante test','Descrizione test');
 INSERT INTO sopralluoghi VALUES('${s}'),('${so}');
 INSERT INTO preventivi_cantiere VALUES('${contract}','${c}','${s}');
 INSERT INTO foto_sopralluogo VALUES('${sp}','${s}','Sopralluogo test','${data}','tecnico:umidita',now()),('${spo}','${so}','Privato','${data}',NULL,now());
 INSERT INTO foto_cantiere VALUES('${f1}','${c}','Cantiere test','Una','${data}',NULL,NULL,NULL,now()),('${f2}','${c}','Cantiere test','Due','${data}',NULL,NULL,NULL,now()),('${fo}','${co}','Altro','Privato','${data}',NULL,NULL,NULL,now());
 INSERT INTO quaderno_progetti(id,user_id,titolo,testo,updated_at) VALUES('${q}','${u}','Quaderno test','Testo Q','2026-10-25T10:00:00Z');`)
 const guards=JSON.parse(fs.readFileSync(path.join(root,'app/engines/rapportini/desktopLetturaProduction.fixture.json'))).filter(x=>x.schema==='artecna_guardie')
 for(const g of guards)await db.exec(g.definizione)
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261025_variante_fonti_memory.sql'),'utf8'))
 const protectedBefore=(await db.query("select pg_get_functiondef('public.economia_fixture()'::regprocedure) def")).rows[0].def
 await db.exec(sql)
 const user=(fn,uid=u,role='authenticated')=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return fn(tx)})
 const read=async(uid=u,role='authenticated')=>{const r=(await user(tx=>tx.query('select public.leggi_osservatore_variante($1) r',[v]),uid,role)).rows[0].r;leggiOsservatore(r,v);return r}
 const all=async(uid=u)=>(await user(tx=>tx.query('select public.leggi_foto_fonti_variante($1,false) r',[v]),uid)).rows[0].r
 const change=(ids,action='collega',uid=u,role='authenticated')=>user(tx=>tx.query('select public.modifica_foto_fonti_variante($1,$2,$3)',[v,JSON.stringify(ids.map(([type,id])=>({source_type:type,source_id:id}))),action]),uid,role)
 const fc=id=>['foto_cantiere',id],sf=id=>['foto_sopralluogo',id]
 let firstAnalysis
 const save=async(snapshot,request=id(20))=>{
  await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend')
  try{await db.query('select artecna_guardie.salva_osservatore_variante($1,$2,$3,$4,$5)',[u,v,request,JSON.stringify({manifesto:snapshot.fonti.manifesto,foto_bytes:snapshot.fonti.manifesto.foto.map(f=>({source_id:f.source_id,source_type:f.source_type,sha256:'a'.repeat(64)}))}),JSON.stringify({sintesi:'Fixture',ipotesi:[],verifiche:[],domande:[],avvertenza:'Fixture'})])}finally{await db.exec('SET SESSION AUTHORIZATION postgres')}
 }
 await t.test('elenco contestuale: cantiere e sopralluogo contrattuale; foto estranee escluse',async()=>{
  const photos=await all();a.equal(photos.length,3);a(!photos.some(x=>[fo,spo].includes(x.source_id)));a(photos.every(x=>x.source_version===null));a(photos.every(x=>/^[a-f0-9]{64}$/.test(x.impronta)))
 })
 await t.test('una foto e piu foto: riferimenti distinti, ordine stabile, nessuna copia',async()=>{
  await change([fc(f1)]);a.equal((await read()).fonti.foto.length,1);await change([sf(sp),fc(f2)]);a.equal((await read()).fonti.foto.length,3)
  a.deepEqual((await read()).fonti.foto.map(x=>x.source_type),['foto_cantiere','foto_cantiere','foto_sopralluogo'])
  const columns=(await db.query("select column_name from information_schema.columns where table_name='variante_fonti_visive'")).rows.map(x=>x.column_name);a(!columns.some(x=>/url|nota|blob|analisi|immagine/.test(x)));a.equal((await db.query('select count(*)::int n from foto_cantiere')).rows[0].n,3)
 })
 await t.test('duplicato 23505 esplicito e batch atomico: relazione originale invariata',async()=>{
  const before=(await db.query('select to_jsonb(f) r from variante_fonti_visive f order by source_type,source_id')).rows
  await a.rejects(change([fc(f1)]),e=>e.code==='23505'&&e.message==='Questa foto è già collegata alla Variante')
  await db.query('insert into foto_cantiere(id,cantiere_id,cantiere,nota,immagine_base64) values($1,$2,$3,$4,$5)',[id(0),c,'Test','Nuova',data])
  await a.rejects(change([fc(id(0)),fc(f1)]),e=>e.code==='23505')
  a.deepEqual((await db.query('select to_jsonb(f) r from variante_fonti_visive f order by source_type,source_id')).rows,before)
 })
 await t.test('altro utente/anonimo/ID arbitrario e accesso diretto negati server-side',async()=>{
  for(const ids of [[fc(fo)],[sf(spo)]])await a.rejects(change(ids),e=>e.code==='42501')
  await a.rejects(change([fc(f1)],'collega',other),e=>e.code==='42501');await a.rejects(read(other),e=>e.code==='42501');await a.rejects(read('','anon'),e=>e.code==='42501')
  await a.rejects(user(tx=>tx.exec('select * from variante_fonti_visive')),e=>e.code==='42501')
  await a.rejects(user(tx=>tx.exec('insert into variante_osservatore_analisi default values')),e=>e.code==='42501')
  await a.rejects(user(tx=>tx.query('select artecna_guardie.salva_osservatore_variante($1,$2,$3,$4,$5)',[u,v,id(99),'{}','{}'])),e=>e.code==='42501')
 })
 await t.test('Quaderno e descrizione tracciati senza contenuto copiato nella relazione',async()=>{
  await user(tx=>tx.query('select public.modifica_fonte_memory_variante($1,$2,$3,$4)',[v,q,'collega','2026-10-25T10:00:00Z']))
  const packet=await read();a.equal(packet.fonti.quaderni.length,1);a.equal(packet.fonti.manifesto.quaderni[0].source_id,q);a.equal(packet.fonti.manifesto.variante.source_id,v)
  await save(packet);firstAnalysis=(await read()).analisi;a(firstAnalysis.allineata);a.equal(firstAnalysis.fonti.manifesto.foto.length,3);a(!JSON.stringify(firstAnalysis.fonti).includes(data));a(!JSON.stringify(firstAnalysis.fonti).includes('Testo Q'))
 })
 await t.test('risposta SQL effettiva -> decoder DTO -> composer condiviso -> payload Osservatore',async()=>{
  const current=leggiOsservatore(await read(),v),payload=payloadOsservatoreVariante(current.fonti,current.fonti.foto.map(()=>data));a.equal(payload.immagini.length,3);a(payload.testo.includes('Descrizione test'));a(payload.testo.includes('Testo Q'));a(!payload.testo.includes(data));a.deepEqual(payload.checklist,[])
 })
 await t.test('impronta fonti indipendente dal timezone della sessione',async()=>{
  const before=(await read()).fonti.manifesto.firma;await db.exec("SET timezone TO 'Europe/Rome'");a.equal((await read()).fonti.manifesto.firma,before);await db.exec("SET timezone TO 'UTC'")
 })
 await t.test('modifica Quaderno dopo analisi: non allineata, nessuna analisi automatica',async()=>{
  await db.query("update quaderno_progetti set testo='Quaderno modificato' where id=$1",[q]);const after=await read();a.equal(after.analisi.allineata,false);a.equal(after.analisi.id,firstAnalysis.id);a.equal((await db.query('select count(*)::int n from variante_osservatore_analisi')).rows[0].n,1)
 })
 await t.test('Rianalizza: nuovo risultato/versione separato, storico conservato',async()=>{
  await save(await read(),id(21));const after=await read();a(after.analisi.allineata);a.notEqual(after.analisi.id,firstAnalysis.id);a.equal((await db.query('select count(*)::int n from variante_osservatore_analisi')).rows[0].n,2)
 })
 await t.test('modifica foto inline/metadati invalida; scollega conserva la foto',async()=>{
  await db.query("update foto_cantiere set nota='Descrizione cambiata' where id=$1",[f1]);a.equal((await read()).analisi.allineata,false)
  const before=(await db.query('select to_jsonb(f) r from foto_cantiere f where id=$1',[f1])).rows
  await change([fc(f1)],'scollega');a.deepEqual((await db.query('select to_jsonb(f) r from foto_cantiere f where id=$1',[f1])).rows,before)
  a.equal((await read()).fonti.foto.length,2);a.equal((await read()).analisi.allineata,false)
 })
 await t.test('eliminazione originale cascata solo sulla relazione; analisi storica rimane non allineata',async()=>{
  await save(await read(),id(22));a((await read()).analisi.allineata);await db.query('delete from foto_sopralluogo where id=$1',[sp]);a.equal((await read()).fonti.foto.length,1);a.equal((await read()).analisi.allineata,false);a.equal((await db.query('select count(*)::int n from quaderno_progetti')).rows[0].n,1)
 })
 await t.test('modifica descrizione e revoca accesso Quaderno non vengono ignorate',async()=>{
  await save(await read(),id(23));await db.query("update varianti_cantiere set descrizione='Nuova descrizione' where id=$1",[v]);a.equal((await read()).analisi.allineata,false)
  await db.query('update quaderno_progetti set user_id=$1 where id=$2',[other,q]);await a.rejects(read(),e=>e.code==='42501');await db.query('update quaderno_progetti set user_id=$1 where id=$2',[u,q])
 })
 await t.test('FK reali, RLS senza policy dirette e funzioni economiche invariate',async()=>{
  const fks=(await db.query("select confrelid::regclass::text parent,confdeltype from pg_constraint where conrelid='variante_fonti_visive'::regclass and contype='f'")).rows;a.equal(fks.length,3);a(fks.every(k=>k.confdeltype==='c'))
  a.equal((await db.query("select pg_get_functiondef('public.economia_fixture()'::regprocedure) def")).rows[0].def,protectedBefore)
  a.equal((await db.query("select count(*)::int n from pg_policy where polrelid in ('variante_fonti_visive'::regclass,'variante_osservatore_analisi'::regclass)")).rows[0].n,0)
  a(!sql.includes('storage.objects'));a(!sql.includes('note_sopralluogo'));a(!sql.includes('preventivo_lavorazioni'))
 })
 await t.test('foto spostata fuori contesto: nessun contenuto esposto, analisi non allineata, riferimento scollegabile',async()=>{
  await save(await read(),id(24));await db.query('update foto_cantiere set cantiere_id=$1 where id=$2',[co,f2]);const current=await read(),f=current.fonti.foto.find(f=>f.source_id===f2);a.equal(f.disponibile,false);a.equal(f.foto.immagine_base64,'');a.equal(f.foto.nota,'');a.equal(current.analisi.allineata,false)
  await change([fc(f2)],'scollega');a.equal((await read()).fonti.foto.length,0);a.equal((await db.query('select count(*)::int n from foto_cantiere where id=$1',[f2])).rows[0].n,1)
 })
 await t.test('massimo otto foto, batch e bozza: nessun inserimento parziale',async()=>{
  await change([fc(id(0))]);
  const ids=Array.from({length:8},(_,i)=>id(i+30));for(const n of ids)await db.query('insert into foto_cantiere(id,cantiere_id,cantiere,nota,immagine_base64) values($1,$2,$3,$4,$5)',[n,c,'Test','Nuova',data])
  const before=(await db.query('select to_jsonb(f) r from variante_fonti_visive f')).rows
  await a.rejects(change(ids.map(fc)),e=>e.code==='22023');a.deepEqual((await db.query('select to_jsonb(f) r from variante_fonti_visive f')).rows,before)
  await db.query("update varianti_cantiere set stato='approvata' where id=$1",[v]);await a.rejects(change([fc(ids[0])]),e=>e.code==='22023');await a.rejects(read(),e=>e.code==='22023')
 })
})
