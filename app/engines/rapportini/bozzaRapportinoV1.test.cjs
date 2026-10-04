const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm')
const load=(file,require)=>{const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports:e,require,crypto:{randomUUID:()=> '00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0')}});return e}
let sequence=0
const util=load(path.resolve(__dirname,'../../utils/rapportinoOperai.ts'),()=>({}))
const model=load(path.join(__dirname,'bozzaRapportinoV1.ts'),()=>util)
const variantiModel=load(path.join(__dirname,'variantiBozzaV1.ts'),()=>({}))
const V1='11111111-1111-4111-8111-111111111111',V2='22222222-2222-4222-8222-222222222222',V3='33333333-3333-4333-8333-333333333333'
const list=[{id:V1,numero:1,etichetta:'Prima',selezionabile:true},{id:V2,numero:2,etichetta:'Seconda',selezionabile:true},{id:V3,numero:null,etichetta:'Storica',selezionabile:false}]
const jsx=(type,props)=>({type,props})
const Editor=load(path.resolve(__dirname,'../../components/RapportinoPrestazioniEditorV1.tsx'),name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name.includes('variantiBozzaV1')?variantiModel:model).default
const nodes=(n,r=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,r));else if(n&&n.props){r.push(n);nodes(n.props.children,r)}return r}
function harness(varianti={cantiere_id:'cantiere',stato:'pronte',varianti:list},onRiprovaVarianti=()=>{},actions={},initial){let bozza=initial || model.creaBozzaRapportinoV1('cantiere','2026-09-30');const operai=[{id:'a',nome:'Mario'},{id:'b',nome:'Gianni'}];return{
  get value(){return bozza},all:()=>nodes(Editor({bozza,operai,varianti,onRiprovaVarianti,onChange:b=>{bozza=b},onClose:()=>{},...actions})),
  set:(key,change)=>{bozza=model.modificaPrestazioneBozza(bozza,key,change)}
}}
test('editor: aggiunta/rimozione, tre righe stesso operaio, identità stabili e modalità',()=>{
  const h=harness(),add=()=>h.all().find(n=>n.type==='button'&&n.props.children==='+ Aggiungi prestazione').props.onClick()
  add();add();add();const keys=h.value.prestazioni.nuove.map(p=>p.chiave_client)
  assert.equal(new Set(keys).size,3)
  for(const key of keys)h.set(key,{operaio_id:'a',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30})
  assert.equal(h.value.prestazioni.nuove.filter(p=>p.operaio_id==='a').length,3)
  assert(h.value.prestazioni.nuove.every(p=>!p.lavoro_in_economia&&p.variante_id===null&&p.prestazione_id===null))
  h.all().find(n=>n.type==='input'&&n.props.type==='radio'&&n.props.checked===false).props.onChange()
  assert.equal(h.value.prestazioni.nuove[0].lavoro_in_economia,true)
  h.set(keys[0],{operaio_id:'b',ora_fine:'13:00',lavoro_in_economia:false})
  assert.equal(h.value.prestazioni.nuove[0].variante_id,null)
  assert.deepEqual(Array.from(h.value.prestazioni.nuove,p=>p.chiave_client),Array.from(keys))
  h.all().find(n=>n.type==='button'&&n.props.children==='Rimuovi').props.onClick()
  assert.equal(h.value.prestazioni.nuove.length,2);assert.equal(h.value.prestazioni.rimosse.length,0)
  assert.throws(()=>model.aggiungiPrestazioneBozza(h.value,keys[1]))
})
test('validazione: operaio, HH:mm, ordine orari, pausa intera e anteprima',()=>{
  const p={prestazione_id:null,chiave_client:'key',operaio_id:'a',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30,lavoro_in_economia:false,variante_id:null}
  assert.equal(model.validaPrestazioneBozza(p).length,0);assert.equal(model.oreAnteprimaPrestazione(p),3.5)
  for(const change of [{operaio_id:''},{ora_inizio:'8:00'},{ora_fine:'25:00'},{ora_fine:'08:00'},{ora_fine:'07:00'},{pausa_minuti:-1},{pausa_minuti:240},{pausa_minuti:241},{pausa_minuti:0.5},{pausa_minuti:NaN}]){
    const row={...p,...change};assert(model.validaPrestazioneBozza(row).length>0);assert.equal(model.oreAnteprimaPrestazione(row),0)
  }
  const key=p.chiave_client;model.validaPrestazioneBozza(p);assert.equal(p.chiave_client,key)
})
test('editor: controlli operativi, documento e nessuna foto/Variante/salvataggio HTTP',()=>{
  const h=harness();h.all().find(n=>n.type==='button'&&n.props.children==='+ Aggiungi prestazione').props.onClick()
  h.all().find(n=>n.type==='select').props.onChange({target:{value:'a'}})
  const times=h.all().filter(n=>n.type==='input'&&n.props.type==='time');times[0].props.onChange({target:{value:'08:00'}})
  h.all().filter(n=>n.type==='input'&&n.props.type==='time')[1].props.onChange({target:{value:'12:00'}})
  h.all().find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'30'}})
  assert.equal(h.value.prestazioni.nuove[0].operaio_id,'a');assert.equal(model.oreAnteprimaPrestazione(h.value.prestazioni.nuove[0]),3.5)
  h.all().filter(n=>n.type==='textarea')[0].props.onChange({target:{value:'Lavori'}})
  h.all().filter(n=>n.type==='textarea')[1].props.onChange({target:{value:'Cemento'}})
  h.all().find(n=>n.type==='input'&&!n.props.type).props.onChange({target:{value:'5 sacchi'}})
  assert.equal(h.value.documento.note,'Lavori');assert.equal(h.value.documento.materiali,'Cemento');assert.equal(h.value.documento.quantita_materiali,'5 sacchi')
  assert(!h.all().some(n=>n.type==='input'&&n.props.type==='file'))
  const save=h.all().find(n=>n.type==='button'&&n.props.children==='Salva rapportino');assert.equal(save.props.disabled,true);assert.equal(typeof save.props.onClick,'function')
  assert(!h.all().some(n=>n.type==='select'&&n.props.value===null))
  assert(!fs.readFileSync(path.resolve(__dirname,'../../components/RapportinoPrestazioniEditorV1.tsx'),'utf8').includes('fetch('))
})

test('DTO Varianti: formato reale, proiezione minima e storiche conservate; risposta invalida rifiutata',()=>{
  const result=variantiModel.validaRispostaVariantiBozza({varianti:list.map(v=>({...v,commerciale:'non necessario'}))})
  assert.equal(result.length,3);assert.equal(result[2].selezionabile,false)
  assert.deepEqual(Object.keys(result[0]),['id','numero','etichetta','selezionabile'])
  assert.equal(variantiModel.etichettaVarianteBozza(result[1]),'Variante n. 2 — Seconda')
  assert.equal(variantiModel.etichettaVarianteBozza(result[2]),'Variante — Storica')
  for(const value of [null,{}, {varianti:{}}, {varianti:[{...list[0],id:'bad'}]}, {varianti:[{...list[0],numero:'1'}]}, {varianti:[{...list[0],selezionabile:1}]},{varianti:[list[0],list[0]]}])assert.throws(()=>variantiModel.validaRispostaVariantiBozza(value))
})
test('Economia obbliga Variante UUID selezionabile; Ordinario funziona senza elenco',()=>{
  const p={prestazione_id:null,chiave_client:'key',operaio_id:'a',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30,lavoro_in_economia:false,variante_id:null}
  assert.equal(model.validaPrestazioneBozza(p,[]).length,0)
  for(const variante_id of [null,'non-uuid',V3,V2])assert(model.validaPrestazioneBozza({...p,lavoro_in_economia:true,variante_id},[list[0],list[2]]).length)
  assert.equal(model.validaPrestazioneBozza({...p,lavoro_in_economia:true,variante_id:V1},list).length,0)
  assert.equal(model.oreAnteprimaPrestazione({...p,lavoro_in_economia:true}),3.5)
})
test('UI Economia: selezione indipendente, identità/orari preservati e cambi modalità azzerano Variante',()=>{
  const h=harness(),add=()=>h.all().find(n=>n.props.children==='+ Aggiungi prestazione').props.onClick()
  add();add();add();const keys=h.value.prestazioni.nuove.map(p=>p.chiave_client)
  for(const key of keys)h.set(key,{operaio_id:'a',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30})
  assert(!h.all().some(n=>n.props['aria-label']?.startsWith('Variante prestazione')))
  h.set(keys[1],{lavoro_in_economia:true});h.set(keys[2],{lavoro_in_economia:true})
  const select=i=>h.all().find(n=>n.props['aria-label']==='Variante prestazione '+i)
  assert(select(2));assert(select(3))
  select(2).props.onChange({target:{value:V3}});assert.equal(h.value.prestazioni.nuove[1].variante_id,null)
  assert(h.all().some(n=>n.type==='option'&&n.props.value===V3&&n.props.disabled))
  select(2).props.onChange({target:{value:V1}});select(3).props.onChange({target:{value:V2}})
  assert.deepEqual(Array.from(h.value.prestazioni.nuove,p=>p.variante_id),[null,V1,V2])
  assert(h.value.prestazioni.nuove.every(p=>model.validaPrestazioneBozza(p,list).length===0))
  const before={...h.value.prestazioni.nuove[1]};select(2).props.onChange({target:{value:V2}})
  assert.deepEqual({...h.value.prestazioni.nuove[1],variante_id:before.variante_id},before)
  h.set(keys[1],{ora_fine:'13:00'});assert.equal(h.value.prestazioni.nuove[1].variante_id,V2)
  h.set(keys[1],{lavoro_in_economia:false});assert.equal(h.value.prestazioni.nuove[1].variante_id,null);assert(!select(2))
  h.set(keys[1],{variante_id:V1});assert.equal(h.value.prestazioni.nuove[1].variante_id,null)
  h.set(keys[1],{lavoro_in_economia:true});assert.equal(h.value.prestazioni.nuove[1].variante_id,null)
  assert.deepEqual(Array.from(h.value.prestazioni.nuove,p=>p.chiave_client),Array.from(keys))
})
test('UI elenco vuoto/non selezionabile, caricamento e errore con retry',()=>{
  for(const stato of ['pronte','caricamento','errore']){
    let retries=0;const h=harness({cantiere_id:'cantiere',stato,varianti:[list[2]]},()=>retries++)
    h.all().find(n=>n.props.children==='+ Aggiungi prestazione').props.onClick()
    h.set(h.value.prestazioni.nuove[0].chiave_client,{lavoro_in_economia:true})
    const select=h.all().find(n=>n.props['aria-label']==='Variante prestazione 1')
    assert.equal(select.props.disabled,stato!=='pronte')
    if(stato==='pronte')assert(h.all().some(n=>n.props.children==='Nessuna variante disponibile'))
    if(stato==='caricamento')assert(h.all().some(n=>n.props.role==='status'))
    if(stato==='errore'){h.all().find(n=>n.props.children==='Riprova caricamento varianti').props.onClick();assert.equal(retries,1)}
  }
})

test('editor: pulsante Salva, retry distinto e blocco controlli durante submit',()=>{
  let saves=0,retries=0
  const cache={cantiere_id:'cantiere',stato:'pronte',varianti:list}
  const h=harness(cache,()=>{},{salvabile:true,onSalva:()=>saves++,onRetry:()=>retries++})
  const save=h.all().find(n=>n.props.children==='Salva rapportino');assert.equal(save.props.disabled,false);save.props.onClick();assert.equal(saves,1)
  const retry=harness(cache,()=>{},{salvabile:true,retryDisponibile:true,onSalva:()=>saves++,onRetry:()=>retries++})
  assert.equal(retry.all().find(n=>n.props.children==='Salva rapportino').props.disabled,true)
  retry.all().find(n=>n.props.children==='Salva rapportino').props.onClick();assert.equal(saves,1)
  retry.all().find(n=>n.props.children==='Riprova stesso salvataggio').props.onClick();assert.equal(retries,1)
  const busy=harness(cache,()=>{},{salvabile:true,disabled:true,salvataggioInCorso:true,onSalva:()=>saves++})
  busy.all().find(n=>n.props.children==='+ Aggiungi prestazione').props.onClick();assert.equal(busy.value.prestazioni.nuove.length,0)
  busy.all().find(n=>n.props.children==='Salva rapportino').props.onClick();assert.equal(saves,1)
  assert(busy.all().some(n=>n.props.role==='status'&&n.props.children==='Salvataggio in corso...'))
  assert(busy.all().filter(n=>n.type==='textarea').every(n=>n.props.disabled))
})

const historicalEditor=()=>model.ricostruisciBozzaRapportinoV1({versione_contratto:1,rapportino_id:V1,revisione:7,cantiere_id:'cantiere',data:'2026-09-30',documento:{note:'Lavori salvati',materiali:'Mattoni',quantita_materiali:'10'},prestazioni:[
  {prestazione_id:V1,chiave_client:'saved-ordinary',operaio_id:'a',operaio_nome:'Mario',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30,lavoro_in_economia:false,variante_id:null,ore:3.5,revisione:2,rimossa_at:null},
  {prestazione_id:V2,chiave_client:'saved-economy',operaio_id:'a',operaio_nome:'Mario',ora_inizio:'13:00',ora_fine:'17:00',pausa_minuti:30,lavoro_in_economia:true,variante_id:V3,ore:3.5,revisione:2,rimossa_at:null},
  {prestazione_id:V3,chiave_client:'removed',operaio_id:'a',operaio_nome:'Mario',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30,lavoro_in_economia:false,variante_id:null,ore:3.5,revisione:2,rimossa_at:'2026-09-29T08:00:00Z'}]})
test('editor persistente popolato: storico non selezionabile visibile, righe rimosse escluse e cambio operaio con nuova identità',()=>{
  const h=harness(undefined,undefined,{},historicalEditor())
  assert.equal(h.all().filter(n=>n.type==='legend'&&Array.isArray(n.props.children)&&n.props.children[0]==='Prestazione ').length,2)
  assert.equal(h.all().filter(n=>n.type==='textarea')[0].props.value,'Lavori salvati')
  assert(h.all().some(n=>n.type==='option'&&n.props.value===V3&&n.props.disabled===false))
  h.all().find(n=>n.type==='select'&&n.props.value==='a').props.onChange({target:{value:'b'}})
  assert.equal(h.value.prestazioni.aggiornate.length,0);assert.equal(h.value.prestazioni.rimosse[0],V1)
  assert.equal(h.value.prestazioni.nuove[0].prestazione_id,null);assert.notEqual(h.value.prestazioni.nuove[0].chiave_client,'saved-ordinary')
  assert.equal(h.value.prestazioni.nuove[0].operaio_id,'b');assert.equal(h.value.baseline.prestazioni[0].operaio_id,'a')
  assert.equal(h.value.baseline.prestazioni[2].rimossa_at,'2026-09-29T08:00:00Z')
})
test('editor Economia storica NULL: leggibile senza errori finché invariata, modifica richiede Variante',()=>{
  const d=historicalEditor().baseline;const initial=model.ricostruisciBozzaRapportinoV1({...d,prestazioni:[{...d.prestazioni[1],variante_id:null}]})
  const h=harness(undefined,undefined,{},initial)
  assert(!h.all().some(n=>n.props['aria-label']==='Errori prestazione 1'))
  assert(h.all().some(n=>n.type==='p'&&typeof n.props.children==='string'&&n.props.children.includes('Economia storica senza Variante')))
  h.all().filter(n=>n.type==='input'&&n.props.type==='time')[1].props.onChange({target:{value:'18:00'}})
  assert(h.all().some(n=>n.props['aria-label']==='Errori prestazione 1'))
  h.all().find(n=>n.props['aria-label']==='Variante prestazione 1').props.onChange({target:{value:V1}})
  assert(!h.all().some(n=>n.props['aria-label']==='Errori prestazione 1'))
  assert.equal(h.value.prestazioni.aggiornate[0].variante_id,V1);assert.equal(h.value.baseline.prestazioni[0].variante_id,null)
})
