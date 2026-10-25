const { test } = require('node:test')
const a = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText,f)
const {previewVariante,leggiFontiCollegate} = require('./previewVariante.ts')
const root=path.resolve(__dirname,'../../..')
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261025_variante_fonti_memory.sql'),'utf8')
const u='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', v='33333333-3333-4333-8333-333333333333', q1='44444444-4444-4444-8444-444444444444', q2='55555555-5555-4555-8555-555555555555', qOther='66666666-6666-4666-8666-666666666666', c='77777777-7777-4777-8777-777777777777'
const bozza={id:v,stato:'bozza',titolo:'Titolo Variante',descrizione:'Descrizione Variante'}
const date='2026-10-25T10:00:00.123456Z'
test('collegamenti e autorizzazioni: SQL effettivo su PostgreSQL embedded PGlite',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema artecna_guardie;
 create table cantieri(id uuid primary key,user_id uuid);
 create table varianti_cantiere(id uuid primary key,cantiere_id uuid references cantieri,stato text);
 create table quaderno_progetti(id uuid primary key,user_id uuid,titolo text not null,testo text not null,updated_at timestamptz not null,gestione_id uuid,gestione_copia boolean not null default false,created_at timestamptz not null default now(),checklist jsonb not null default '[]',disegni jsonb not null default '[]',analisi_ai jsonb);
 create table quaderno_allegati(id int primary key,progetto uuid references quaderno_progetti,payload text);
 create function artecna_guardie.utente_jwt_corrente() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function artecna_guardie.utente_puo_modificare_cantiere(u uuid,c uuid) returns boolean language sql stable as $$select exists(select 1 from public.cantieri where id=c and user_id=u)$$;
 insert into cantieri values('${c}','${u}');insert into varianti_cantiere values('${v}','${c}','bozza');
 insert into quaderno_progetti(id,user_id,titolo,testo,updated_at) values('${q1}','${u}','Quaderno Uno','Testo Uno','${date}'),('${q2}','${u}','Quaderno Due','Testo Due','${date}'),('${qOther}','${other}','Privato','Non leggibile','${date}');
 insert into quaderno_allegati values(1,'${q1}','BYTES SINTETICI');`)
 await db.exec(migration)
 const user=(fn,uid=u,role='authenticated')=>db.transaction(async tx=>{
  await tx.exec('set local role '+role);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return fn(tx)
 })
 const change=(id,action='collega',version=date,uid=u,role='authenticated')=>user(tx=>tx.query('select public.modifica_fonte_memory_variante($1,$2,$3,$4)',[v,id,action,version]),uid,role)
 const read=async(uid=u,role='authenticated')=>leggiFontiCollegate((await user(tx=>tx.query('select public.leggi_fonti_memory_variante($1) as data',[v]),uid,role)).rows[0].data)
 const count=async table=>(await db.query('select count(*)::int as n from '+table)).rows[0].n
 await t.test('sola descrizione, contratto assente dalla narrativa',async()=>{
  const preview=previewVariante(bozza,c,'CONTRATTO-SEGRETO',await read())
  a.equal(preview.testoUnificato,'Titolo Variante\nDescrizione Variante');a(!preview.testoUnificato.includes('CONTRATTO'))
 })
 await t.test('uno e due Quaderni, doppio collegamento rifiutato',async()=>{
  await change(q1);a.equal((await read()).length,1);await change(q2);const before=(await db.query('select to_jsonb(f) as doc from variante_fonti_memory f order by source_id')).rows;await a.rejects(change(q1),e=>e.code==='23505'&&e.message==='Questo Quaderno è già collegato alla Variante');a.deepEqual((await db.query('select to_jsonb(f) as doc from variante_fonti_memory f order by source_id')).rows,before)
  a.equal((await read()).length,2);a.equal(await count('variante_fonti_memory'),2)
 })
 await t.test('stato aggiornato e preview deterministica senza contenuti duplicati',async()=>{
  const sources=await read();a(sources.every(f=>f.aggiornato));const p=previewVariante(bozza,c,null,sources)
  a.equal(p.fonti.length,3);a.deepEqual(p,previewVariante(bozza,c,null,[...sources].reverse()))
  a.equal(p.testoUnificato,'Quaderno Uno\nTesto Uno\n\nQuaderno Due\nTesto Due\n\nTitolo Variante\nDescrizione Variante')
 })
 await t.test('divergenza a precisione microsecondo; lettura e ricollegamento non aggiornano il riferimento',async()=>{
  await db.query("update quaderno_progetti set testo='Testo aggiornato',updated_at=updated_at+interval '1 microsecond' where id=$1",[q1])
  const source=(await read()).find(f=>f.id===q1);a.equal(source.aggiornato,false)
  await a.rejects(change(q1,'aggiorna',date),e=>e.code==='40001')
  await a.rejects(change(q1,'collega',source.updated_at),e=>e.code==='23505')
  a.equal((await read()).find(f=>f.id===q1).source_version,source.source_version)
  const preview=previewVariante(bozza,c,null,await read());a(preview.testoUnificato.includes('Testo aggiornato'))
  a.equal(preview.fonti.find(f=>f.source_id===q1).source_version,source.updated_at)
 })
 await t.test('aggiorna riferimento solo esplicito',async()=>{
  const source=(await read()).find(f=>f.id===q1);await change(q1,'aggiorna',source.updated_at)
  a.equal((await read()).find(f=>f.id===q1).aggiornato,true)
 })
 await t.test('altro utente, Quaderno altrui, anonimo e scrittura diretta rifiutati',async()=>{
  for(const action of ['collega','scollega','aggiorna']){
   await a.rejects(change(q1,action,date,other),e=>e.code==='42501')
   await a.rejects(change(qOther,action),e=>e.code==='42501')
   await a.rejects(change(q1,action,date,u,'anon'),e=>e.code==='42501')
  }
  await a.rejects(read(other),e=>e.code==='42501');await a.rejects(read(u,'anon'),e=>e.code==='42501')
  await a.rejects(user(tx=>tx.exec('delete from public.variante_fonti_memory')),e=>e.code==='42501')
 })
 await t.test('fonte nascosta o in gestione esclusa/bloccata, mai inclusa come versione storica',async()=>{
  await db.query('update quaderno_progetti set gestione_id=$1 where id=$2',[v,q2]);const sources=await read()
  a.equal(sources.find(f=>f.id===q2).disponibile,false)
  a(!previewVariante(bozza,c,null,sources).testoUnificato.includes('Testo Due'))
  await a.rejects(change(q2),e=>e.code==='40001')
  await db.query('update quaderno_progetti set gestione_id=null,gestione_copia=true where id=$1',[q2])
  await a.rejects(change(q2,'scollega'),e=>e.code==='42501')
  a.equal((await read()).length,1)
  await db.query('update quaderno_progetti set gestione_copia=false where id=$1',[q2])
 })
 await t.test('scollega ripetibile elimina solo relazione; progetto, testo e allegati invariati',async()=>{
  const before=(await db.query('select * from quaderno_progetti order by id')).rows
  const files=(await db.query('select * from quaderno_allegati')).rows
  await change(q1,'scollega');await change(q1,'scollega');a.equal((await read()).length,1)
  a.deepEqual((await db.query('select * from quaderno_progetti order by id')).rows,before)
  a.deepEqual((await db.query('select * from quaderno_allegati')).rows,files)
 })
 await t.test('riferimenti senza copie e grant chiusi',async()=>{
  const cols=(await db.query("select column_name from information_schema.columns where table_name='variante_fonti_memory' order by ordinal_position")).rows.map(r=>r.column_name)
  a.deepEqual(cols,['variante_id','source_type','source_id','source_version','created_at'])
  a(!migration.includes('storage.objects'));a(!migration.includes('quaderno_allegati'))
 })
 await t.test('timestamp autorevole, no-op e metadati tecnici',async()=>{
  const snapshot=async()=>(await db.query('select to_jsonb(p) as doc from quaderno_progetti p where id=$1',[q1])).rows[0].doc
  let old=await snapshot();await db.query("update quaderno_progetti set updated_at='2099-01-01',created_at='2001-01-01' where id=$1",[q1]);a.deepEqual(await snapshot(),old)
  for(const [field,value]of [['titolo','Altro titolo'],['testo','Altro testo'],['checklist','[{"testo":"controllo"}]'],['disegni','[{"id":"pagina"}]'],['analisi_ai','{"nota":"persistita"}']]){
   old=await snapshot();await db.query('update quaderno_progetti set '+field+'=$1,updated_at=$2 where id=$3',[value,old.updated_at,q1]);const now=await snapshot();a.notEqual(now.updated_at,old.updated_at);a.equal(now.created_at,old.created_at);await db.query('update quaderno_progetti set '+field+'=$1,updated_at=clock_timestamp() where id=$2',[value,q1]);a.equal((await snapshot()).updated_at,now.updated_at)
  }
  old=await snapshot();await db.query('update quaderno_progetti set gestione_id=$1,gestione_copia=true where id=$2',[v,q1]);a.equal((await snapshot()).updated_at,old.updated_at);await db.query('update quaderno_progetti set gestione_id=null,gestione_copia=false where id=$1',[q1]);a.equal((await snapshot()).updated_at,old.updated_at)
 })
 await t.test('fuori bozza: letture e modifiche rifiutate',async()=>{
  await db.exec("update varianti_cantiere set stato='proposta'")
  await a.rejects(read(),e=>e.code==='22023');await a.rejects(change(q2,'scollega'),e=>e.code==='22023')
 })
})

test('contratto UI effettivo, archivio riusato e nessun percorso AI/Storage nel nuovo pannello',()=>{
 const panel=fs.readFileSync(path.join(root,'app/components/VarianteFontiMemoryPanel.tsx'),'utf8')
 const actual=fs.readFileSync(path.join(root,'app/components/VariantiCantierePanel.tsx'),'utf8')
 a(actual.includes("!economiaRapportini && variante.stato === 'bozza' && cantiereId && <VarianteFontiMemoryPanel"))
 for(const label of ['Fonti del preventivo integrativo','+ Collega Quaderno','Aggiorna riferimento','Anteprima fonti AI','Nessuna fonte narrativa disponibile.','Contesto contrattuale'])a(panel.includes(label))
 a(panel.includes('QuadernoProgettiPanel'));a(!panel.includes('fetch('));a(!panel.includes('.storage'));a(!panel.includes('/api/ai'))
 a.throws(()=>leggiFontiCollegate(null));a.throws(()=>leggiFontiCollegate([{id:q1}]))
})

test('pannello reale: selezione multipla, preview, divergenza, apertura e scollegamento (React hooks/trasporto simulati)',async()=>{
 const vm=require('node:vm')
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'app/components/VarianteFontiMemoryPanel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 const slots=[], effects=[];let cursor=0,mounted=false
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
  useCallback(fn){return fn},useEffect(fn){if(!mounted)effects.push(fn)},
 }
 const projects=new Map([[q1,{id:q1,titolo:'Quaderno Uno',testo:'Testo Uno',updated_at:date}],[q2,{id:q2,titolo:'Quaderno Due',testo:'Testo Due',updated_at:date}]])
 let links=[];const calls=[]
 const client={rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==='leggi_fonti_memory_variante')return{data:structuredClone(links),error:null}
  a.equal(name,'modifica_fonte_memory_variante')
  const id=args.p_source_id; if(args.p_azione==='collega'&&links.some(f=>f.id===id))return {data:null,error:{code:'23505',message:'Questo Quaderno è già collegato alla Variante'}}
  if(args.p_azione==='collega'&&!links.some(f=>f.id===id))links.push({...projects.get(id),source_version:date,aggiornato:true,disponibile:true})
  if(args.p_azione==='scollega')links=links.filter(f=>f.id!==id)
  if(args.p_azione==='aggiorna')links=links.map(f=>f.id===id?{...f,source_version:f.updated_at,aggiornato:true}:f)
  return{data:null,error:null}
 }}
 const exports={}
 vm.runInNewContext(code,{exports,require:n=>n==='react'?hooks:n==='./QuadernoProgettiPanel'?{default:'Archive'}:n==='./VarianteFontiVisivePanel'?{default:'VisualSources'}:n.includes('previewVariante')?{previewVariante,leggiFontiCollegate}:require(n)})
 const props={supabase:client,cantiereId:c,variante:{...bozza,preventivo_contrattuale_id:'CONTRATTO-STRUTTURATO'}}
 const render=()=>{cursor=0;return exports.default(props)}
 const nodes=tree=>!tree?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[]
 const text=tree=>!tree?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree)
 const button=(tree,label)=>{const found=nodes(tree).find(n=>n.type==='button'&&text(n)===label);a(found,'Pulsante '+label);return found}
 const archive=tree=>nodes(tree).find(n=>n.type==='Archive'&&n.props.selezione)
 const tick=()=>new Promise(setImmediate)
 let tree=render();mounted=true;const cleanup=effects[0]();await tick();tree=render()
 a.equal(calls.length,1);a.equal(calls[0].name,'leggi_fonti_memory_variante')
 a(text(tree).includes('Descrizione Variante'))
 a.equal(nodes(tree).find(n=>n.type==='pre').props.children,'Titolo Variante\nDescrizione Variante')
 button(tree,'+ Collega Quaderno').props.onClick();tree=render()
 archive(tree).props.selezione.onSeleziona(projects.get(q1));await tick();tree=render()
 archive(tree).props.selezione.onSeleziona(projects.get(q2));await tick();tree=render()
 a.equal(links.length,2);a(text(tree).includes('Testo Uno'));a(text(tree).includes('Testo Due'))
 const duplicateSnapshot=JSON.stringify(links);archive(tree).props.selezione.onSeleziona(projects.get(q1));await tick();tree=render();a(text(tree).includes('Questo Quaderno è già collegato alla Variante'));a.equal(JSON.stringify(links),duplicateSnapshot);a(text(tree).includes('Testo Due'))
 a(!nodes(tree).find(n=>n.type==='pre').props.children.includes('CONTRATTO'))
 const beforeOpen=calls.filter(x=>x.name==='modifica_fonte_memory_variante').length
 button(tree,'Apri').props.onClick();tree=render()
 a(nodes(tree).some(n=>n.type==='Archive'&&n.props.progettoInizialeId===q1))
 nodes(tree).find(n=>n.type==='Archive'&&n.props.progettoInizialeId===q1).props.onChiudi();await tick();tree=render()
 a.equal(calls.filter(x=>x.name==='modifica_fonte_memory_variante').length,beforeOpen)
 links[0]={...links[0],updated_at:'2026-10-26T10:00:00Z',testo:'Testo nuovo',aggiornato:false}
 button(tree,'Aggiorna fonti').props.onClick();await tick();tree=render()
 a(text(tree).includes('Quaderno modificato dopo il collegamento'));a(text(tree).includes('Testo nuovo'))
 button(tree,'Aggiorna riferimento').props.onClick();await tick();tree=render();a.equal(links[0].aggiornato,true)
 button(tree,'Scollega').props.onClick();await tick();tree=render();a.equal(links.length,1);a(projects.has(q1))
 a(calls.every(x=>['leggi_fonti_memory_variante','modifica_fonte_memory_variante'].includes(x.name)))
 cleanup()
})


test('chiusura Quaderno riusa la guardia esistente su modifiche/upload senza perdere lavoro',()=>{
 const vm=require('node:vm'),file=path.join(root,'app/components/QuadernoProgettiPanel.tsx'),source=fs.readFileSync(file,'utf8')
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 let guard
 function walk(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='puoCambiare')guard=node.getText(ast);ts.forEachChild(node,walk)}
 walk(ast);a(guard)
 const refs={gestioneBusyRef:{current:false},salvataggioRef:{current:false},fileOccupatoRef:{current:false},pendentiRef:{current:false}}
 let accepted=false
 const fn=vm.runInNewContext(ts.transpileModule('('+guard+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{...refs,window:{confirm:()=>accepted}})
 a.equal(fn(),true)
 for(const key of ['gestioneBusyRef','salvataggioRef','fileOccupatoRef']){refs[key].current=true;a.equal(fn(),false);refs[key].current=false}
 refs.pendentiRef.current=true;a.equal(fn(),false);accepted=true;a.equal(fn(),true)
 a(source.includes('if (puoCambiare()) onChiudi()'))
})
