const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const absent=data=>({data,presente:false,rapportino:null,timbrature:[]})
const present=data=>({data,presente:true,rapportino:{id:'report-'+data,data,note:'Lavori'},timbrature:[{operaio_id:'worker',ora_entrata:'07:30',ora_uscita:'12:30'}]})
function harness(transport) {
  const hooks=[],calls=[];let index=0
  const react={useState(initial){const i=index++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value}]},
    useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i]}}
  const jsx=(type,props)=>({type,props})
  const exports={}
  const source=fs.readFileSync(__dirname+'/page.tsx','utf8')
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,console,fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return transport(url,body)},require:name=>{
      if(name==='react')return react
      if(name==='react/jsx-runtime')return{jsx,jsxs:jsx}
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
  async function login(){find(x=>x.type==='input'&&x.props.type==='password').props.onChange({target:{value:'1234'}});click('Accedi');await flush();site('site')}
  return{calls,all,find,text,click,date,site,form,login}
}
const loginReply=()=>reply({operaio:{id:'worker',nome:'Mario'},operai:[{id:'worker',nome:'Mario'}],cantieri:[{id:'site',nome:'TESTA ANTONINO'},{id:'other',nome:'ALTRO'}]})

test('A–E/B/C/J: data retroattiva, save e rilettura UUID; date indipendenti e messaggi',async()=>{
  const documents=new Map([['2026-10-01',present('2026-10-01')]])
  const before=JSON.stringify(documents.get('2026-10-01'))
  const h=harness((url,body)=>{
    if(url.endsWith('/accesso'))return loginReply()
    if(url.endsWith('/stato'))return reply(documents.get(body.data)||absent(body.data))
    documents.set(body.data,present(body.data));return reply({success:true,rapportino:{id:'report-'+body.data,data:body.data}})
  })
  await h.login();h.date('2026-09-30');await flush()
  assert(h.text().includes('Rapportino del 30/09/2026 non ancora inviato'))
  h.click('Compila rapportino')
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
  const save=h.form().onSalvaPortale;h.site('other');await save()
  assert(!h.calls.some(x=>x.url.endsWith('/salva')))
  assert(!h.text().includes('già inviato'))
})

test('rilettura fallita dopo commit: data e successo conservati, vecchio UUID non utilizzabile',async()=>{
  let committed=false
  const h=harness((url,body)=>{
    if(url.endsWith('/accesso'))return loginReply()
    if(url.endsWith('/stato'))return committed?reply({error:'Rilettura fallita'},500):reply(absent(body.data))
    committed=true;return reply({success:true,rapportino:{id:'report',data:body.data}})
  })
  await h.login();h.date('2026-09-30');await flush();h.click('Compila rapportino')
  h.find(x=>x.type==='RapportinoOperaiEditor').props.onChange([{id:'worker',nome:'Mario'}])
  await h.form().onSalvaPortale()
  assert(h.text().includes('Rapportino del 30/09/2026 salvato'))
  assert(!h.text().includes('Apri / Modifica rapportino'))
  assert.equal(h.find(x=>x.type==='input'&&x.props.type==='date').props.value,'2026-09-30')
})
