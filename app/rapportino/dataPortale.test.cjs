const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const SITEV1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OTHERV1='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',WORKERV1='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',REPORTV1='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const absent=data=>({data,presente:false,versione_prestazioni:null,rapportino:null,timbrature:[]})
const present=data=>({data,presente:true,versione_prestazioni:0,rapportino:{id:'report-'+data,data,note:'Lavori'},timbrature:[{operaio_id:'worker',ora_entrata:'07:30',ora_uscita:'12:30'}]})
const structured=data=>({data,presente:true,versione_prestazioni:1,rapportino:{id:REPORTV1,data},timbrature:[],
  strutturato:{versione_contratto:1,rapportino_id:REPORTV1,revisione:7,cantiere_id:SITEV1,data,documento:{note:'Lavori',materiali:'',quantita_materiali:''},prestazioni:[]}})
function harness(transport,timers={setTimeout,clearTimeout}) {
  const hooks=[],calls=[];let index=0,uuidCount=0
  const uuidCalls=()=>uuidCount
  const react={useState(initial){const i=index++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value}]},
    useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i]}}
  const jsx=(type,props)=>({type,props})
  const exports={}
  const source=fs.readFileSync(__dirname+'/page.tsx','utf8')
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,console,AbortController,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,crypto:{randomUUID:()=> '99999999-9999-4999-8999-'+String(++uuidCount).padStart(12,'0')},fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body,corpo:options.body});return transport(url,body,options)},require:name=>{
      if(name==='react')return react
      if(name==='react/jsx-runtime')return{jsx,jsxs:jsx}
      if(name.includes('RapportinoPrestazioniEditorV1'))return{default:'RapportinoPrestazioniEditorV1'}
      if(name.includes('salvataggioBozzaV1')) { const e={};const load=(file,r)=>{const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(__dirname+'/../engines/rapportini/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out,r);return out};return load('salvataggioBozzaV1',n=>n.includes('validaLetturaPortale')?load('validaLetturaPortale',()=>({})):load('bozzaRapportinoV1',()=>({calcolaOreNetteTimbratura:()=>5}))) }
      if(name.includes('variantiBozzaV1')) { const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(__dirname+'/../engines/rapportini/variantiBozzaV1.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e,()=>({}));return e }
      if(name.includes('bozzaRapportinoV1')) { const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(__dirname+'/../engines/rapportini/bozzaRapportinoV1.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e,()=>({calcolaOreNetteTimbratura:()=>5}));return e }
      if(name.includes('RapportinoForm'))return{default:'RapportinoForm'}
      if(name.includes('RapportinoOperaiEditor'))return{default:'RapportinoOperaiEditor'}
      if(name.includes('rapportinoOperai'))return{preparaOperaiRapportino:x=>x.map(row=>({...row,ore:5}))}
      return{}
    }})
  function nodes(node,result=[]) {
    if(Array.isArray(node))node.forEach(x=>nodes(x,result))
    else if(node&&typeof node==='object'&&node.props){result.push(node);nodes(node.props.children,result)}
    return result
  }
  const all=()=>{index=0;return nodes(exports.default())}
  const find=predicate=>{const n=all().find(predicate);assert(n,'Elemento UI mancante');return n}
  const text=()=>all().flatMap(x=>typeof x.props.children==='string'?[x.props.children]:[]).join('\n')
  const click=label=>find(x=>x.type==='button'&&x.props.children===label).props.onClick()
  const date=value=>find(x=>x.type==='input'&&x.props.type==='date').props.onChange({target:{value}})
  const site=value=>find(x=>x.type==='select').props.onChange({target:{value}})
  const form=()=>find(x=>x.type==='RapportinoForm').props
  async function login(){find(x=>x.type==='input'&&x.props.type==='password').props.onChange({target:{value:'1234'}});click('Accedi');await flush();site(SITEV1)}
  return{calls,uuidCalls,stato:()=>hooks.find(v=>v&&v.versionePrestazioni!==undefined),all,find,text,click,date,site,form,login}
}
const loginReply=()=>reply({operaio:{id:'worker',nome:'Mario'},operai:[{id:'worker',nome:'Mario'}],cantieri:[{id:SITEV1,nome:'TESTA ANTONINO'},{id:OTHERV1,nome:'ALTRO'}]})

test('V1 riconosciuto: nessun form o apertura legacy; V0 torna modificabile al cambio data',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():reply(
    body.data==='2026-09-30'?structured(body.data):body.data==='2026-10-01'?present(body.data):absent(body.data)))
  await h.login();h.date('2026-09-30');await flush()
  assert(h.text().includes('Rapportino del 30/09/2026 strutturato presente'))
  assert(!h.all().some(x=>x.type==='RapportinoForm' || x.type==='RapportinoOperaiEditor'))
  assert(!h.text().includes('Apri / Modifica rapportino'));assert(!h.text().includes('Compila rapportino'))
  assert(!h.calls.some(x=>x.url.endsWith('/salva')))
  h.date('2026-10-01');await flush();h.click('Apri / Modifica rapportino')
  assert.equal(h.form().rapportinoInModifica,'report-2026-10-01')
  assert.equal(h.form().note,'Lavori')
  h.date('2026-10-04');await flush()
  assert(h.text().includes('Rapportino del 04/10/2026 non ancora inviato'))
})

test('V1 blocca callback legacy precedente e apertura precedente',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():reply(
    body.data==='2026-09-30'?present(body.data):structured(body.data)))
  await h.login();h.date('2026-09-30');await flush()
  const oldOpen=h.find(x=>x.type==='button'&&x.props.children==='Apri / Modifica rapportino').props.onClick
  h.click('Apri / Modifica rapportino');const save=h.form().onSalvaPortale
  h.date('2026-10-01');await flush();oldOpen();await save()
  assert(!h.all().some(x=>x.type==='RapportinoForm'))
  assert(!h.calls.some(x=>x.url.endsWith('/salva')))
})

test('risposta V1 obsoleta ignorata dopo risposta V0 più recente',async()=>{
  const pending=[]
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():new Promise(resolve=>pending.push({body,resolve})))
  await h.login();h.date('2026-09-30');h.date('2026-10-01')
  pending[1].resolve(reply(present('2026-10-01')));await flush()
  pending[0].resolve(reply(structured('2026-09-30')));await flush()
  assert(h.text().includes('Rapportino del 01/10/2026 già inviato'))
  h.click('Apri / Modifica rapportino');assert.equal(h.form().rapportinoInModifica,'report-2026-10-01')
})

test('versione non supportata e data incoerente non abilitano form legacy',async()=>{
  for(const response of [{...present('2026-09-30'),versione_prestazioni:2},
    {...present('2026-09-30'),rapportino:{id:'wrong',data:'2026-10-01'}}]) {
    const h=harness(url=>url.endsWith('/accesso')?loginReply():reply(response))
    await h.login();h.date('2026-09-30');await flush()
    assert(!h.text().includes('Apri / Modifica rapportino'))
    assert(!h.all().some(x=>x.type==='RapportinoForm'))
  }
})

test('A–E/B/C/J: data retroattiva, save e rilettura UUID; date indipendenti e messaggi',async()=>{
  const documents=new Map([['2026-10-01',present('2026-10-01')],['2026-09-30',present('2026-09-30')]])
  const before=JSON.stringify(documents.get('2026-10-01'))
  const h=harness((url,body)=>{
    if(url.endsWith('/accesso'))return loginReply()
    if(url.endsWith('/stato'))return reply(documents.get(body.data)||absent(body.data))
    documents.set(body.data,present(body.data));return reply({success:true,rapportino:{id:'report-'+body.data,data:body.data}})
  })
  await h.login();h.date('2026-09-30');await flush()
  assert(h.text().includes('Rapportino del 30/09/2026 già inviato'))
  h.click('Apri / Modifica rapportino')
  h.find(x=>x.type==='RapportinoOperaiEditor').props.onChange([{id:'worker',nome:'Mario',ora_inizio:'07:30',ora_fine:'12:30'}])
  await h.form().onSalvaPortale()
  assert.equal(h.calls.find(x=>x.url.endsWith('/salva')).body.data,'2026-09-30')
  assert.equal(h.calls.at(-1).url,'/api/rapportino/stato');assert.equal(h.calls.at(-1).body.data,'2026-09-30')
  assert(h.text().includes('Rapportino del 30/09/2026 salvato'))
  assert(h.text().includes('Rapportino del 30/09/2026 già inviato'))
  h.click('Apri / Modifica rapportino');assert.equal(h.form().rapportinoInModifica,'report-2026-09-30')
  assert.equal(h.form().note,'Lavori')
  assert.equal(h.find(x=>x.type==='RapportinoOperaiEditor').props.value[0].id,'worker')
  h.date('2026-10-01');assert(!h.text().includes('già inviato'));await flush()
  assert(h.text().includes('Rapportino del 01/10/2026 già inviato'))
  h.date('2026-10-04');await flush()
  assert(h.text().includes('Rapportino del 04/10/2026 non ancora inviato'))
  assert.equal(JSON.stringify(documents.get('2026-10-01')),before)
})

test('F: risposte fuori ordine ignorate, inclusi errori/finally precedenti',async()=>{
  const pending=[]
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():new Promise(resolve=>pending.push({body,resolve})))
  await h.login();h.date('2026-09-30');h.date('2026-10-01')
  pending[1].resolve(reply(absent('2026-10-01')));await flush()
  pending[0].resolve(reply(present('2026-09-30')));await flush()
  assert(h.text().includes('Rapportino del 01/10/2026 non ancora inviato'))
  assert.equal(h.find(x=>x.type==='input'&&x.props.type==='date').props.value,'2026-10-01')
  assert(!h.text().includes('Apri / Modifica rapportino'))
})

test('G/H: UUID invalidato e salvataggio bloccato subito, anche con callback precedente',async()=>{
  let resolve
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():body.data==='2026-09-30'
    ?reply(present(body.data)):new Promise(r=>{resolve=r}))
  await h.login();h.date('2026-09-30');await flush();h.click('Apri / Modifica rapportino')
  const save=h.form().onSalvaPortale
  h.date('2026-10-01');await save()
  assert(!h.calls.some(x=>x.url.endsWith('/salva')))
  assert(!h.text().includes('Apri / Modifica rapportino'))
  resolve(reply({error:'Controllo fallito'},500));await flush();await save()
  assert(!h.calls.some(x=>x.url.endsWith('/salva')))
  assert(!h.text().includes('già inviato'))
  h.date('');await save();assert(!h.calls.some(x=>x.url.endsWith('/salva')))
})

test('cambio cantiere invalida UUID, risposte e callback vecchie',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():reply(present(body.data)))
  await h.login();h.date('2026-09-30');await flush();h.click('Apri / Modifica rapportino')
  const save=h.form().onSalvaPortale;h.site(OTHERV1);await save()
  assert(!h.calls.some(x=>x.url.endsWith('/salva')))
  assert(!h.text().includes('già inviato'))
})

test('rilettura fallita dopo commit: data e successo conservati, vecchio UUID non utilizzabile',async()=>{
  let committed=false
  const h=harness((url,body)=>{
    if(url.endsWith('/accesso'))return loginReply()
    if(url.endsWith('/stato'))return committed?reply({error:'Rilettura fallita'},500):reply(present(body.data))
    committed=true;return reply({success:true,rapportino:{id:'report',data:body.data}})
  })
  await h.login();h.date('2026-09-30');await flush();h.click('Apri / Modifica rapportino')
  h.find(x=>x.type==='RapportinoOperaiEditor').props.onChange([{id:'worker',nome:'Mario'}])
  await h.form().onSalvaPortale()
  assert(h.text().includes('Rapportino del 30/09/2026 salvato'))
  assert(!h.text().includes('Apri / Modifica rapportino'))
  assert.equal(h.find(x=>x.type==='input'&&x.props.type==='date').props.value,'2026-09-30')
})

test('assente apre solo editor V1, senza foto o writer; bozza invalidata al cambio data/cantiere',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():reply(absent(body.data)))
  await h.login();h.date('2026-09-30');await flush();h.click('Compila rapportino')
  const editor=h.find(x=>x.type==='RapportinoPrestazioniEditorV1').props
  assert.equal(editor.bozza.cantiere_id,SITEV1);assert.equal(editor.bozza.data,'2026-09-30')
  assert(!h.all().some(x=>x.type==='RapportinoForm'||x.type==='RapportinoOperaiEditor'||(x.type==='input'&&x.props.type==='file')))
  editor.onChange({...editor.bozza,documento:{note:'Lavori',materiali:'Cemento',quantita_materiali:'5'}})
  assert.equal(h.find(x=>x.type==='RapportinoPrestazioniEditorV1').props.bozza.documento.note,'Lavori')
  h.date('2026-10-01');editor.onChange(editor.bozza);await flush();h.click('Compila rapportino')
  assert.equal(h.find(x=>x.type==='RapportinoPrestazioniEditorV1').props.bozza.documento.note,'')
  h.site(OTHERV1);assert(!h.all().some(x=>x.type==='RapportinoPrestazioniEditorV1'))
  assert(!h.calls.some(x=>/\/(salva|strutturato|varianti)$/.test(x.url)))
})

const variantRows=[{id:'11111111-1111-4111-8111-111111111111',numero:2,etichetta:'Opere aggiuntive',selezionabile:true}]
const editorV1=h=>h.find(x=>x.type==='RapportinoPrestazioniEditorV1').props
function economy(h){const e=editorV1(h);e.onChange({...e.bozza,prestazioni:{...e.bozza.prestazioni,nuove:[{prestazione_id:null,chiave_client:'row',operaio_id:'worker',ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:0,lavoro_in_economia:true,variante_id:null}]}})}
async function openDraft(h,date='2026-09-30'){h.date(date);await flush();h.click('Compila rapportino')}
test('Varianti: lazy, payload cantiere, nessun duplicato durante richiesta/cache, riuso al cambio data e nessun writer',async()=>{
  let resolve
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():url.endsWith('/varianti')?new Promise(r=>{resolve=r}):reply(absent(body.data)))
  await h.login();await openDraft(h)
  assert(!h.calls.some(c=>c.url.endsWith('/varianti')))
  economy(h);economy(h);assert.equal(h.calls.filter(c=>c.url.endsWith('/varianti')).length,1)
  assert.deepEqual(h.calls.at(-1).body,{cantiere_id:SITEV1})
  assert.equal(editorV1(h).varianti.stato,'caricamento')
  resolve(reply({varianti:variantRows}));await flush()
  assert.equal(editorV1(h).varianti.stato,'pronte');assert.equal(editorV1(h).varianti.varianti[0].id,variantRows[0].id)
  economy(h);await openDraft(h,'2026-10-01');economy(h)
  assert.equal(h.calls.filter(c=>c.url.endsWith('/varianti')).length,1)
  assert(!h.calls.some(c=>/\/(salva|strutturato)$/.test(c.url)))
})
test('Varianti: fallimento HTTP/trasporto/JSON sanitizzato e retry esplicito',async()=>{
  for(const failure of [()=>reply({error:'TOKEN SQL PASSWORD'},503),()=>Promise.reject(new Error('TOKEN SQL PASSWORD')),()=>reply({varianti:[{id:'invalid'}]})]){
    let attempt=0
    const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():url.endsWith('/varianti')?(++attempt===1?failure():reply({varianti:variantRows})):reply(absent(body.data)))
    await h.login();await openDraft(h);economy(h);await flush()
    assert.equal(editorV1(h).varianti.stato,'errore');assert.equal(editorV1(h).varianti.varianti.length,0)
    assert(!JSON.stringify(editorV1(h).varianti).includes('TOKEN'));assert(!h.text().includes('PASSWORD'))
    economy(h);assert.equal(attempt,1)
    editorV1(h).onRiprovaVarianti();await flush();assert.equal(attempt,2);assert.equal(editorV1(h).varianti.stato,'pronte')
  }
})
test('Varianti: cambio cantiere invalida lista e risposta vecchia, inclusi errori e retry obsoleti',async()=>{
  for(const oldReply of [()=>reply({varianti:variantRows}),()=>reply({error:'vecchio'},503)]){
    const pending=[]
    const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():url.endsWith('/varianti')?new Promise(resolve=>pending.push({body,resolve})):reply(absent(body.data)))
    await h.login();await openDraft(h);economy(h);const old=editorV1(h)
    h.site(OTHERV1);await openDraft(h);assert.equal(editorV1(h).varianti.stato,'non_caricate')
    old.onRiprovaVarianti();assert.equal(pending.length,1)
    economy(h);assert.deepEqual(pending[1].body,{cantiere_id:OTHERV1})
    pending[1].resolve(reply({varianti:[]}));await flush()
    pending[0].resolve(oldReply());await flush()
    assert.equal(editorV1(h).varianti.cantiere_id,OTHERV1);assert.equal(editorV1(h).varianti.stato,'pronte');assert.equal(editorV1(h).varianti.varianti.length,0)
  }
})
test('Varianti: lista pronta eliminata al cambio cantiere; uscita invalida richieste',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginReply():url.endsWith('/varianti')?reply({varianti:variantRows}):reply(absent(body.data)))
  await h.login();await openDraft(h);economy(h);await flush()
  h.site(OTHERV1);await openDraft(h);assert.equal(editorV1(h).varianti.varianti.length,0)
  economy(h);await flush();assert.equal(h.calls.filter(c=>c.url.endsWith('/varianti')).length,2)
  h.click('Cambia operaio');assert(!h.all().some(x=>x.type==='RapportinoPrestazioniEditorV1'))
})


const loginV1=()=>reply({operaio:{id:WORKERV1,nome:'Mario'},operai:[{id:WORKERV1,nome:'Mario'}],cantieri:[{id:SITEV1,nome:'Cantiere'}]})
const rowV1=(key,economy=false)=>({prestazione_id:null,chiave_client:key,operaio_id:WORKERV1,ora_inizio:economy?'13:00':'08:00',ora_fine:economy?'17:00':'12:00',pausa_minuti:30,lavoro_in_economia:economy,variante_id:economy?variantRows[0].id:null})
const resultV1=body=>({versione_contratto:1,rapportino_id:REPORTV1,revisione:7,cantiere_id:body.cantiere_id,data:body.data,documento:body.documento,prestazioni:body.prestazioni.nuove.map((p,i)=>({...p,prestazione_id:i?'22222222-2222-4222-8222-222222222222':'33333333-3333-4333-8333-333333333333',operaio_nome:'Mario',ore:3.5,revisione:1,rimossa_at:null}))})
const stateV1=result=>({data:result.data,presente:true,versione_prestazioni:1,rapportino:{id:result.rapportino_id,data:result.data},strutturato:result,timbrature:[]})
async function draftV1(h,rows=[rowV1('one')]){
  await h.login();h.site(SITEV1);await openDraft(h)
  const e=editorV1(h);e.onChange({...e.bozza,documento:{note:'Lavori',materiali:'Cemento',quantita_materiali:'5'},prestazioni:{nuove:rows,aggiornate:[],rimosse:[]}});await flush()
}
const writesV1=h=>h.calls.filter(c=>c.url.endsWith('/strutturato'))
test('V1 crea con payload esatto, stesso operaio/modi diversi, risultato autorevole e rilettura stesso contesto',async()=>{
  let saved
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows}):url.endsWith('/strutturato')?reply(saved=resultV1(body)):reply(saved?stateV1(saved):absent(body.data)))
  await draftV1(h,[rowV1('one'),rowV1('two',true)])
  assert(editorV1(h).salvabile);const oldEditor=editorV1(h);const loads=h.calls.filter(c=>c.url.endsWith('/varianti')).length
  editorV1(h).onSalva();await flush()
  assert.equal(writesV1(h).length,1);assert.equal(h.uuidCalls(),1)
  const body=writesV1(h)[0].body
  assert.deepEqual(body,{versione_contratto:1,richiesta_id:body.richiesta_id,rapportino_id:null,revisione_attesa:null,cantiere_id:SITEV1,data:'2026-09-30',documento:{note:'Lavori',materiali:'Cemento',quantita_materiali:'5'},prestazioni:{nuove:[rowV1('one'),rowV1('two',true)],aggiornate:[],rimosse:[]}})
  assert.equal(h.calls.filter(c=>c.url.endsWith('/varianti')).length,loads)
  assert.deepEqual(h.calls.at(-1).body,{cantiereId:SITEV1,data:'2026-09-30',rapportinoId:REPORTV1})
  assert(h.text().includes('Rapportino del 30/09/2026 salvato'));assert(h.text().includes('strutturato presente'))
  assert(!h.all().some(x=>x.type==='RapportinoForm'||x.type==='RapportinoPrestazioniEditorV1'))
  assert(!h.calls.some(c=>c.url.endsWith('/salva')))
  assert.equal(h.stato().rapportinoId,REPORTV1);assert.equal(h.stato().revisione,7)
  oldEditor.onSalva();oldEditor.onChange(oldEditor.bozza);assert.equal(writesV1(h).length,1)
})
test('V1 validazione: zero righe, Economia null/non selezionabile e operaio fuori elenco non inviano POST',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows}):reply(absent(body.data)))
  await draftV1(h,[]);assert.equal(editorV1(h).salvabile,false);editorV1(h).onSalva()
  for(const row of [{...rowV1('one',true),variante_id:null},{...rowV1('one',true),variante_id:'22222222-2222-4222-8222-222222222222'},{...rowV1('one'),operaio_id:REPORTV1}]){
    const e=editorV1(h);e.onChange({...e.bozza,prestazioni:{nuove:[row],aggiornate:[],rimosse:[]}});await flush();assert.equal(editorV1(h).salvabile,false);editorV1(h).onSalva()
  }
  assert.equal(writesV1(h).length,0);assert.equal(h.uuidCalls(),0)
})
test('V1 submit blocca editor/data/cantiere/callback vecchie e doppio intento',async()=>{
  let resolve
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?new Promise(r=>{resolve=r}):reply(absent(body.data)))
  await draftV1(h);const old=editorV1(h);old.onSalva();old.onSalva()
  assert.equal(writesV1(h).length,1);assert.equal(editorV1(h).disabled,true);assert.equal(editorV1(h).salvataggioInCorso,true)
  assert(h.find(x=>x.type==='input'&&x.props.type==='date').props.disabled)
  assert(h.find(x=>x.type==='select').props.disabled)
  old.onChange({...old.bozza,documento:{...old.bozza.documento,note:'Mutazione vietata'}})
  h.date('2026-10-01');h.site(OTHERV1);h.click('Cambia operaio');old.onClose()
  assert.equal(editorV1(h).bozza.documento.note,'Lavori');assert.equal(editorV1(h).bozza.data,'2026-09-30')
  resolve(reply({error:'SQL TOKEN'},503));await flush();assert.equal(editorV1(h).retryDisponibile,true)
})
test('V1 trasporto ambiguo: retry identico byte per byte e unica richiesta_id',async()=>{
  let count=0,saved
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?(++count===1?Promise.reject(new Error('PASSWORD SQL')):reply(saved=resultV1(body))):reply(saved?stateV1(saved):absent(body.data)))
  await draftV1(h);editorV1(h).onSalva();await flush();assert(editorV1(h).retryDisponibile)
  assert(!h.text().includes('PASSWORD'));editorV1(h).onSalva();assert.equal(writesV1(h).length,1)
  editorV1(h).onRetry();await flush()
  assert.equal(writesV1(h).length,2);assert.equal(writesV1(h)[0].corpo,writesV1(h)[1].corpo);assert.equal(h.uuidCalls(),1)
  assert(h.text().includes('salvato'))
})
test('V1 modifica dopo errore: nuovo intento/UUID, vecchie chiavi preservate',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?reply({},503):reply(absent(body.data)))
  await draftV1(h);editorV1(h).onSalva();await flush()
  const e=editorV1(h);e.onChange({...e.bozza,documento:{...e.bozza.documento,note:'Nuovo contenuto'}})
  assert.equal(editorV1(h).retryDisponibile,false);editorV1(h).onSalva();await flush()
  assert.notEqual(writesV1(h)[0].body.richiesta_id,writesV1(h)[1].body.richiesta_id);assert.equal(h.uuidCalls(),2)
  assert.equal(writesV1(h)[1].body.prestazioni.nuove[0].chiave_client,'one');assert.equal(writesV1(h)[1].body.documento.note,'Nuovo contenuto')
})
test('V1 errori 400/401/403/409/503 sanitizzati; 409 senza retry cieco e con nuovo controllo obbligatorio',async()=>{
  for(const status of [400,401,403,409,503]){
    const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?reply({error:'PASSWORD SQL DRIVER'},status):reply(absent(body.data)))
    await draftV1(h);editorV1(h).onSalva();await flush()
    assert(!h.text().includes('PASSWORD'));assert.equal(editorV1(h).retryDisponibile,status===503)
    if(status===409){assert.equal(editorV1(h).salvabile,false);editorV1(h).onRetry();editorV1(h).onSalva();assert.equal(writesV1(h).length,1);h.click('Aggiorna stato e varianti');await flush();assert.equal(h.calls.at(-1).url,'/api/rapportino/stato');assert(!h.text().includes('Aggiorna stato e varianti'))}
  }
})
test('V1 successo seguito da rilettura fallita: successo/UUID conservati, nuovo controllo senza writer',async()=>{
  let saved,fail=true
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?reply(saved=resultV1(body)):saved?(fail?reply({error:'SQL PASSWORD'},503):reply(stateV1(saved))):reply(absent(body.data)))
  await draftV1(h);editorV1(h).onSalva();await flush()
  assert(h.text().includes('Rapportino del 30/09/2026 salvato'));assert(h.text().includes('Impossibile aggiornare la visualizzazione'))
  assert(h.text().includes('strutturato presente'));assert(!h.all().some(x=>x.type==='RapportinoPrestazioniEditorV1'||x.type==='RapportinoForm'))
  fail=false;h.click('Ripeti controllo Rapportino');await flush()
  assert.equal(h.calls.at(-1).body.rapportinoId,REPORTV1);assert.equal(writesV1(h).length,1);assert(!h.text().includes('Impossibile aggiornare'))
})
test('V1 risposta writer invalida conserva tentativo; vecchia callback non salva altro contesto',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?reply({success:true}):reply(absent(body.data)))
  await draftV1(h);const old=editorV1(h);old.onSalva();await flush()
  assert(editorV1(h).retryDisponibile);assert(!h.text().includes('Rapportino del 30/09/2026 salvato'))
  h.date('2026-10-01');await flush();old.onRetry();old.onSalva();assert.equal(writesV1(h).length,1)
})

test('V1 rilettura post-save obsoleta ignorata dopo cambio data; callback controllo precedente invalidata',async()=>{
  let saved,readResolve,readCount=0
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?reply(saved=resultV1(body)):body.rapportinoId?(++readCount===1?reply({},503):new Promise(resolve=>{readResolve=resolve})):reply(absent(body.data)))
  await draftV1(h);editorV1(h).onSalva();await flush()
  const oldCheck=h.find(x=>x.props.children==='Ripeti controllo Rapportino').props.onClick
  const oldContinue=h.find(x=>x.props.children==='Continua').props.onClick
  h.click('Ripeti controllo Rapportino');h.date('2026-10-01');await flush()
  readResolve(reply(stateV1(saved)));await flush();oldCheck();oldContinue();await flush()
  assert(h.text().includes('Rapportino del 01/10/2026 non ancora inviato'));assert.equal(readCount,2)
  assert.equal(h.stato().data,'2026-10-01');assert.equal(h.stato().versionePrestazioni,null)
})
test('V1 timeout: tentativo conservato e retry usa identico corpo',async()=>{
  let timeoutCallback,saved,count=0
  const h=harness((url,body,options)=>url.endsWith('/accesso')?loginV1():url.endsWith('/strutturato')?(++count===1?new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new Error('Timeout')))}):reply(saved=resultV1(body))):reply(saved?stateV1(saved):absent(body.data)),{setTimeout:fn=>{timeoutCallback=fn;return 1},clearTimeout:()=>{}})
  await draftV1(h);editorV1(h).onSalva();timeoutCallback();await flush()
  assert(editorV1(h).retryDisponibile);editorV1(h).onRetry();await flush()
  assert.equal(writesV1(h)[0].corpo,writesV1(h)[1].corpo);assert.equal(h.uuidCalls(),1)
})

test('V1 Economia rifiutata con 400 sanitizzato: refresh stato/Varianti obbligatorio, nessun retry cieco',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows}):url.endsWith('/strutturato')?reply({error:'Dati Rapportino non validi'},400):reply(absent(body.data)))
  await draftV1(h,[rowV1('economy',true)]);editorV1(h).onSalva();await flush()
  assert.equal(editorV1(h).salvabile,false);assert.equal(editorV1(h).retryDisponibile,false)
  assert(h.text().includes('Per Economia aggiorna stato e varianti'))
  assert.equal(editorV1(h).varianti.stato,'non_caricate');editorV1(h).onSalva();assert.equal(writesV1(h).length,1)
  h.click('Aggiorna stato e varianti');await flush();assert.equal(h.calls.at(-1).url,'/api/rapportino/stato')
})

const baselinePortaleV1=()=>({...resultV1({cantiere_id:SITEV1,data:'2026-09-30',documento:{note:'Lavori persistenti',materiali:'Mattoni',quantita_materiali:'10'},prestazioni:{nuove:[rowV1('saved-one'),rowV1('saved-two',true)]}}),prestazioni:[
  {...rowV1('saved-one'),prestazione_id:'33333333-3333-4333-8333-333333333333',operaio_nome:'Mario',ore:3.5,revisione:2,rimossa_at:null},
  {...rowV1('saved-two',true),prestazione_id:'22222222-2222-4222-8222-222222222222',operaio_nome:'Mario',ore:3.5,revisione:2,rimossa_at:null},
  {...rowV1('removed'),prestazione_id:'44444444-4444-4444-8444-444444444444',operaio_nome:'Mario',ore:3.5,revisione:1,rimossa_at:'2026-09-29T08:00:00Z'}]})
function bozzaModule(){const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(__dirname+'/../engines/rapportini/bozzaRapportinoV1.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e,()=>({calcolaOreNetteTimbratura:()=>5}));return e}
const editingModel=bozzaModule()
async function openExistingV1(h){await h.login();h.site(SITEV1);h.date('2026-09-30');await flush();h.click('Apri / Modifica');await flush()}
test('V1 rilettura e riapertura: baseline completa, documento, righe duplicate per operaio, storia rimossa e cache Varianti',async()=>{
  const initial=baselinePortaleV1()
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows.map(v=>({...v,selezionabile:false}))}):reply(stateV1(initial)))
  await openExistingV1(h);const e=editorV1(h)
  assert.equal(e.bozza.rapportino_id,REPORTV1);assert.equal(e.bozza.revisione_attesa,7);assert.equal(e.bozza.baseline.prestazioni.length,3)
  assert.equal(e.bozza.documento.note,'Lavori persistenti');assert.equal(e.bozza.documento.materiali,'Mattoni');assert.equal(e.bozza.documento.quantita_materiali,'10')
  assert.equal(editingModel.prestazioniAttiveBozza(e.bozza).length,2);assert.equal(e.bozza.prestazioni.aggiornate.length,0);assert.equal(e.bozza.prestazioni.rimosse.length,0)
  assert.equal(e.varianti.varianti[0].selezionabile,false);assert(e.salvabile)
  assert(!h.all().some(n=>n.type==='RapportinoForm'||(n.type==='input'&&n.props.type==='file')))
  e.onClose();h.click('Apri / Modifica');await flush();assert.equal(h.calls.filter(c=>c.url.endsWith('/varianti')).length,1)
})
test('V1 modifica e salvataggio: UUID/revisione, delta e baseline aggiornata da rilettura; nessun legacy',async()=>{
  let current=baselinePortaleV1(),payload,reads=0
  const h=harness((url,body)=>{
    if(url.endsWith('/accesso'))return loginV1()
    if(url.endsWith('/varianti'))return reply({varianti:variantRows})
    if(url.endsWith('/strutturato')){payload=body;current={...current,revisione:8,documento:body.documento,prestazioni:current.prestazioni.map(p=>body.prestazioni.rimosse.includes(p.prestazione_id)?{...p,rimossa_at:'2026-09-30T12:00:00Z'}:{...p,...body.prestazioni.aggiornate.find(a=>a.prestazione_id===p.prestazione_id)})};return reply(current)}
    reads++;return reply(stateV1(current))
  })
  await openExistingV1(h);let e=editorV1(h)
  let b=editingModel.modificaPrestazioneBozza(e.bozza,'saved-one',{ora_fine:'12:30'});b=editingModel.rimuoviPrestazioneBozza(b,'saved-two');b={...b,documento:{...b.documento,note:'Aggiornamento'}}
  e.onChange(b);editorV1(h).onSalva();await flush()
  assert.equal(payload.rapportino_id,REPORTV1);assert.equal(payload.revisione_attesa,7);assert.equal(payload.prestazioni.nuove.length,0)
  assert.equal(payload.prestazioni.aggiornate.length,1);assert.equal(payload.prestazioni.aggiornate[0].chiave_client,'saved-one');assert.equal(payload.prestazioni.aggiornate[0].operaio_id,WORKERV1)
  assert.deepEqual(payload.prestazioni.rimosse,['22222222-2222-4222-8222-222222222222']);assert.equal(payload.data,'2026-09-30');assert.equal(reads,2)
  assert.equal(h.stato().revisione,8);assert(h.text().includes('Rapportino del 30/09/2026 salvato'))
  h.click('Apri / Modifica');e=editorV1(h);assert.equal(e.bozza.revisione_attesa,8);assert.equal(e.bozza.documento.note,'Aggiornamento')
  assert.equal(editingModel.prestazioniAttiveBozza(e.bozza).length,1);assert.equal(e.bozza.prestazioni.nuove.length,0);assert.equal(e.bozza.prestazioni.aggiornate.length,0);assert.equal(e.bozza.prestazioni.rimosse.length,0)
  assert(!h.calls.some(c=>c.url.endsWith('/salva')))
})
test('V1 modifica retry: stesso intento congelato e UUID; nuovo intento dopo nuova modifica',async()=>{
  let current=baselinePortaleV1(),attempt=0
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows}):url.endsWith('/strutturato')?(++attempt<3?reply({},503):reply(current={...current,revisione:8,documento:body.documento})):reply(stateV1(current)))
  await openExistingV1(h);let e=editorV1(h);e.onChange({...e.bozza,documento:{...e.bozza.documento,note:'Modifica 1'}})
  editorV1(h).onSalva();await flush();editorV1(h).onRetry();await flush()
  assert.equal(writesV1(h)[0].corpo,writesV1(h)[1].corpo);assert.equal(h.uuidCalls(),1)
  e=editorV1(h);e.onChange({...e.bozza,documento:{...e.bozza.documento,note:'Modifica 2'}});editorV1(h).onSalva();await flush()
  assert.notEqual(writesV1(h)[1].body.richiesta_id,writesV1(h)[2].body.richiesta_id);assert.equal(h.uuidCalls(),2)
  assert.equal(writesV1(h)[2].body.revisione_attesa,7)
})
test('V1 conflitto: nessuna sovrascrittura, rilettura aggiorna baseline prima del nuovo intento',async()=>{
  let current=baselinePortaleV1()
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows}):url.endsWith('/strutturato')?(current={...current,revisione:9,documento:{...current.documento,note:'Aggiornato da altro client'}},reply({},409)):reply(stateV1(current)))
  await openExistingV1(h);let e=editorV1(h);e.onChange({...e.bozza,documento:{...e.bozza.documento,note:'Mio contenuto'}});editorV1(h).onSalva();await flush()
  assert.equal(editorV1(h).salvabile,false);editorV1(h).onSalva();assert.equal(writesV1(h).length,1)
  h.click('Aggiorna stato e varianti');await flush();h.click('Apri / Modifica');await flush()
  assert.equal(editorV1(h).bozza.revisione_attesa,9);assert.equal(editorV1(h).bozza.documento.note,'Aggiornato da altro client');assert.equal(editorV1(h).bozza.prestazioni.aggiornate.length,0)
})
test('V1 callback precedente invalidata al cambio data/cantiere; nessuna ricostruzione da timbrature',async()=>{
  const h=harness((url,body)=>url.endsWith('/accesso')?loginV1():url.endsWith('/varianti')?reply({varianti:variantRows}):body.data==='2026-09-30'?reply({...stateV1(baselinePortaleV1()),timbrature:[{operaio_id:'IGNORARE'}]}):reply(absent(body.data)))
  await openExistingV1(h);const old=editorV1(h);assert.equal(editingModel.prestazioniAttiveBozza(old.bozza).length,2)
  h.date('2026-10-01');await flush();old.onChange(old.bozza);old.onSalva();assert.equal(writesV1(h).length,0)
  h.site(OTHERV1);old.onSalva();assert(!h.all().some(n=>n.type==='RapportinoPrestazioniEditorV1'))
})
