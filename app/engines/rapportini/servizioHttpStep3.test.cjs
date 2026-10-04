// Contratto HTTP/server verificato con Supabase finto: nessun ENV/rete reale.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname,'../../..')
const caSource=fs.readFileSync(path.join(__dirname,'caSupabase.server.ts'),'utf8')
const caExports={}
vm.runInNewContext(ts.transpileModule(caSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
  {exports:caExports,require:name=>{assert.equal(name,'server-only');return {}}})
const caSupabase=caExports.CA_SUPABASE

function harness({rpcTransport,pgTransport,legacyTransport,logSink=console}={}) {
  const calls=[]
  const env={ NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY:'test_anon',
    RAPPORTINI_DATABASE_URL:'postgresql://artecna_rapportini_backend.testref:test_password@example.pooler.supabase.com:6543/postgres', NODE_ENV:'production' }
  const accesso={operaio:{id:'session-worker',nome:'Mario'},operai:[],cantieri:[]}
  const client={rpc:async(name,args)=>{
    calls.push({name,args,transport:'postgrest'})
    if(rpcTransport) return rpcTransport(name,args)
    return {error:null,data:name==='crea_sessione_rapportino' ? accesso : name==='verifica_sessione_rapportino'
      ? accesso.operaio : name==='varianti_rapportino_portale' ? [] : {rapportino_id:'report'}}
  }}
  const signatures={crea_sessione_rapportino:['p_pin','p_token'],verifica_sessione_rapportino:['p_sessione','p_cantiere_id'],
    varianti_rapportino_portale:['p_sessione','p_cantiere_id'],salva_rapportino_con_prestazioni:['p_payload','p_sessione'],
    leggi_rapportino_portale:['p_sessione','p_cantiere_id','p_data','p_rapportino_id']}
  const adapter=load('app/engines/rapportini/adapterPortalePostgres.server.ts',name=>{
    if(name==='server-only') return {}
    if(name==='./caSupabase.server') return caExports
    if(name==='pg') return {DatabaseError:require('pg').DatabaseError,Pool:class {
      constructor(options){calls.push({poolOptions:options})}
      on(event,handler){calls.push({poolEvent:event,handler});return this}
      async query(query){
        const name=query.text.match(/SELECT public\.([a-z_]+)\(/)[1]
        assert(signatures[name]); assert.equal(query.name,undefined)
        const args=Object.fromEntries(signatures[name].map((key,i)=>[key,key==='p_payload' ? JSON.parse(query.values[i]) : query.values[i]]))
        calls.push({name,args,transport:'pg',query})
        if(pgTransport) return pgTransport(query)
        if(rpcTransport) {const result=await rpcTransport(name,args);if(result.error) {
          const error=new (require('pg').DatabaseError)(result.error.message,0,'error');error.code=result.error.code;throw error
        } return {rows:[{result:result.data}]}}
        return {rows:[{result:name==='crea_sessione_rapportino' ? accesso : name==='verifica_sessione_rapportino'
          ? accesso.operaio : name==='varianti_rapportino_portale' ? [] : {rapportino_id:'report'}}]}
      }
    }}
    if(name==='@vercel/functions') return {attachDatabasePool:()=>{calls.push({attached:true})}}
    return require(name)
  })
  function load(relative,requireImpl) {
    const source=fs.readFileSync(path.join(root,relative),'utf8')
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
    const exports={}
    vm.runInNewContext(code,{exports,require:requireImpl,process:{env},URL,Request,Response,console:logSink})
    return exports
  }
  const service=load('app/engines/rapportini/servizioRapportini.server.ts',name=>{
    if(name==='server-only') return {}
    if(name.includes('adapterPortalePostgres.server')) return adapter
    if(name==='@supabase/supabase-js') return {createClient:(url,key,options)=>{ calls.push({url,key,options}); return client }}
    return require(name)
  })
  const route=relative=>load(relative,name=>{
    if(name.includes('servizioLetturaPortale.server')) return letturaService
    if(name.includes('servizioRapportini.server')) return service
    if(name.includes('photo-storage/photo-manager')) return {buildPhotoRecordsWithStorage:()=>{throw Error('Foto non previste dal test')}}
    if(name==='@supabase/supabase-js') return {createClient:()=>{
      if(legacyTransport) return legacyTransport
      throw Error('Nessun client legacy senza sessione')
    }}
    return require(name)
  })
  const validator=load('app/engines/rapportini/validaLetturaPortale.ts',()=>{throw Error('Nessun import runtime nel validatore')})
  const reader=load('app/engines/rapportini/letturaRapportinoPortale.server.ts',name=>{
    if(name==='server-only') return {}
    if(name==='./adapterPortalePostgres.server') return adapter
    if(name==='./servizioRapportini.server') return service
    if(name==='./validaLetturaPortale') return validator
    throw Error('Import lettura inatteso')
  })
  const letturaService=load('app/engines/rapportini/servizioLetturaPortale.server.ts',name=>{
    if(name==='server-only') return {}
    if(name==='./letturaRapportinoPortale.server') return reader
    if(name==='./servizioRapportini.server') return service
    if(name==='./validaLetturaPortale') return validator
    throw Error('Import servizio lettura inatteso')
  })
  return {service,adapter,reader,validator,route,calls,env,accesso}
}
const token='ab'.repeat(32)
const contestoLettura={cantiere_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',data:'2026-10-04'}
const idLettura='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
function rispostaLettura(versione=null) {
  const envelope={versione_lettura:1,...contestoLettura,presente:versione!==null,
    versione_prestazioni:versione,rapportino_id:versione===null ? null : idLettura,dettaglio:null}
  if(versione===1) envelope.dettaglio={versione_contratto:1,rapportino_id:idLettura,revisione:2,
    ...contestoLettura,documento:{note:'Lavoro',materiali:'',quantita_materiali:''},prestazioni:[
      {prestazione_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',chiave_client:'p1',
        operaio_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',operaio_nome:'Mario',
        ora_inizio:'08:00',ora_fine:'13:00',pausa_minuti:30,lavoro_in_economia:true,
        variante_id:null,ore:4.5,revisione:1,rimossa_at:null},
      {prestazione_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',chiave_client:'p2',
        operaio_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',operaio_nome:'Mario',
        ora_inizio:'14:00',ora_fine:'16:00',pausa_minuti:0,lavoro_in_economia:false,
        variante_id:null,ore:2,revisione:1,rimossa_at:'2026-10-04T15:00:00+02:00'}]}
  return envelope
}
const request=(headers={},body={})=>new Request('https://app.example/api/rapportino/strutturato',{
  method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)
})

for(const versione of [null,0,1]) test(`lettura server: JSON ${versione===null ? 'assente' : `V${versione}`} e quinta RPC parametrizzata`,async()=>{
  const data=rispostaLettura(versione)
  const h=harness({rpcTransport:async()=>({data,error:null})})
  const req=request({cookie:`artecna_rapportino_sessione=${token}`})
  const result=await h.reader.leggiRapportinoPortale(req,contestoLettura)
  assert.deepEqual(result,data)
  const invocation=h.calls.find(x=>x.name==='leggi_rapportino_portale')
  assert.deepEqual(JSON.parse(JSON.stringify(invocation.args)),{p_sessione:token,
    p_cantiere_id:contestoLettura.cantiere_id,p_data:contestoLettura.data,p_rapportino_id:null})
  assert.equal(invocation.transport,'pg')
  assert.match(invocation.query.text,/public\.leggi_rapportino_portale\(\$1::text,\$2::uuid,\$3::date,\$4::uuid\)/)
  assert.match(invocation.query.text,/session_user = 'artecna_rapportini_backend' AND current_user = 'artecna_rapportini_backend'/)
  assert.equal(invocation.query.name,undefined)
})

test('lettura adapter: nomi arbitrari e proprietà del prototipo negati prima del pool',async()=>{
  const h=harness({logSink:{error:()=>{}}})
  for(const name of ['rpc_non_permessa','constructor','toString','__proto__']) {
    await assert.rejects(()=>h.adapter.rpcPortalePostgres(name,{}),/Connessione servizio Rapportini non disponibile/)
  }
  assert.equal(h.calls.length,0)
})

for(const [code,status] of [['PR401',401],['42501',403],['PR409',409],['22023',400]]) {
  test(`lettura server: ${code} → ${status}, diagnostica senza segreti`,async()=>{
    const logs=[]
    const secret=`${token} https://secret.invalid password payload SQL SELECT`
    const h=harness({logSink:{error:(...x)=>logs.push(x)},pgTransport:async()=>{
      const error=new (require('pg').DatabaseError)(secret,0,'error')
      Object.assign(error,{code,detail:secret,hint:secret,query:secret})
      throw error
    }})
    await assert.rejects(()=>h.reader.leggiRapportinoPortale(request({cookie:`artecna_rapportino_sessione=${token}`}),contestoLettura),
      e=>e.status===status && e.code===code && !e.message.includes(secret))
    assert.deepEqual(logs,[['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=postgres']])
  })
}

test('lettura server: trasporto/identità/configurazione → 503 sanitizzato',async()=>{
  for(const failure of ['transport','identity','config']) {
    const logs=[]
    const secret=`${token} password https://secret.invalid payload SQL`
    const h=harness({logSink:{error:(...x)=>logs.push(x)},pgTransport:async()=>{
      if(failure==='identity') return {rows:[]}
      throw new Error(secret)
    }})
    if(failure==='config') delete h.env.RAPPORTINI_DATABASE_URL
    await assert.rejects(()=>h.reader.leggiRapportinoPortale(request({cookie:`artecna_rapportino_sessione=${token}`}),contestoLettura),
      e=>e.status===503 && e.code==='TRANSPORT' && !e.message.includes(secret))
    assert(!JSON.stringify(logs).includes(token)); assert(!JSON.stringify(logs).includes('secret.invalid'))
    assert(!JSON.stringify(logs).includes('password'))
    assert.equal(logs.length,1)
    assert(!h.calls.some(x=>x.transport==='postgrest'))
  }
})

test('lettura server: sessione/input/origine invalidi non contattano DB',async()=>{
  const h=harness()
  const authenticated=request({cookie:`artecna_rapportino_sessione=${token}`})
  await assert.rejects(()=>h.reader.leggiRapportinoPortale(request(),contestoLettura),e=>e.status===401 && e.code==='PR401')
  for(const patch of [{cantiere_id:'invalid'},{data:'2026-02-30'},{data:'infinity'},{rapportino_id:'invalid'}]) {
    await assert.rejects(()=>h.reader.leggiRapportinoPortale(authenticated,{...contestoLettura,...patch}),e=>e.status===400)
  }
  await assert.rejects(()=>h.reader.leggiRapportinoPortale(request({origin:'https://external.invalid',
    cookie:`artecna_rapportino_sessione=${token}`}),contestoLettura),e=>e.status===403)
  assert.equal(h.calls.length,0)
})

test('lettura server: UUID atteso validato e inoltrato',async()=>{
  const h=harness({rpcTransport:async()=>({data:rispostaLettura(1),error:null})})
  const req=request({cookie:`artecna_rapportino_sessione=${token}`})
  await h.reader.leggiRapportinoPortale(req,{...contestoLettura,rapportino_id:idLettura.toUpperCase()})
  assert.equal(h.calls.find(x=>x.name==='leggi_rapportino_portale').args.p_rapportino_id,idLettura.toUpperCase())
  await assert.rejects(()=>h.reader.leggiRapportinoPortale(req,{...contestoLettura,rapportino_id:contestoLettura.cantiere_id}),
    e=>e.status===503 && e.code==='RISPOSTA')
})

test('lettura server: discriminanti, contesto, righe e campi extra incoerenti rifiutati',async()=>{
  const mutations=[
    x=>{x.versione_lettura=2},x=>{x.presente=false},x=>{x.versione_prestazioni=2},
    x=>{x.versione_prestazioni=0},x=>{x.rapportino_id=null},x=>{x.data='2026-10-03'},
    x=>{x.cantiere_id=idLettura},x=>{x.dettaglio.rapportino_id=contestoLettura.cantiere_id},
    x=>{x.dettaglio.cantiere_id=idLettura},x=>{x.dettaglio.data='2026-10-03'},
    x=>{x.dettaglio.revisione=-1},x=>{x.dettaglio.documento.note=null},
    x=>{x.dettaglio.prestazioni[0].prestazione_id=null},x=>{x.dettaglio.prestazioni[0].ore='4.5'},
    x=>{x.dettaglio.prestazioni[0].ora_fine='07:00'},x=>{x.dettaglio.prestazioni[0].pausa_minuti=0.5},
    x=>{x.dettaglio.prestazioni[1].chiave_client='p1'},
    x=>{x.dettaglio.prestazioni[1].prestazione_id=x.dettaglio.prestazioni[0].prestazione_id},
    x=>{x.dettaglio.prestazioni[1].variante_id=idLettura},
    x=>{x.dettaglio.prestazioni[1].rimossa_at='invalid'},
    x=>{x.costo_manodopera=100},x=>{x.dettaglio.created_at='secret'},
    x=>{x.dettaglio.prestazioni[0].costo_orario_interno_storico=20},
    x=>{x.dettaglio.prestazioni[0].stato_economia='economia_gia_inserita'},
    x=>{x.dettaglio.prestazioni[0].tariffa_cliente=30},
  ]
  for(const mutate of mutations) {
    const data=rispostaLettura(1); mutate(data)
    const h=harness({rpcTransport:async()=>({data,error:null})})
    await assert.rejects(()=>h.reader.leggiRapportinoPortale(request({cookie:`artecna_rapportino_sessione=${token}`}),contestoLettura),
      e=>e.status===503 && e.code==='RISPOSTA')
  }
  for(const data of [null,[],{...rispostaLettura(),presente:true},{...rispostaLettura(0),dettaglio:{}},
    {...rispostaLettura(),token:'secret'}]) {
    assert.equal(harness().validator.letturaPortaleValida(data,contestoLettura),false)
  }
})

test('server: sessione assente blocca prima di contattare Supabase',async()=>{
  const h=harness()
  await assert.rejects(()=>h.service.salvaRapportinoConPrestazioni(request(),{}),e=>e.status===401)
  assert.equal(h.calls.length,0)
})
test('server: desktop e mobile invocano lo stesso writer, identità fuori dal payload',async()=>{
  const h=harness(),p={richiesta_id:'retry-stabile'}
  await h.service.salvaRapportinoConPrestazioni(request({cookie:`artecna_rapportino_sessione=${token}`}),p)
  await h.service.salvaRapportinoConPrestazioni(request({authorization:'Bearer desktop-token'}),p)
  const rpc=h.calls.filter(x=>x.name)
  assert.equal(rpc.length,2); assert(rpc.every(x=>x.name==='salva_rapportino_con_prestazioni'))
  assert.equal(rpc[0].args.p_sessione,token); assert.equal(rpc[1].args.p_sessione,null)
  assert.equal(rpc[0].transport,'pg'); assert.equal(rpc[1].transport,'postgrest')
  const desktop=h.calls.find(x=>x.key)
  assert.equal(desktop.key,'test_anon')
  assert.equal(desktop.options.global.headers.Authorization,'Bearer desktop-token')
})
test('server: cookie alterato e origine diversa rifiutati',async()=>{
  const h=harness()
  assert.equal(h.service.tokenSessioneRapportino('artecna_rapportino_sessione=worker-id'),null)
  await assert.rejects(()=>h.service.salvaRapportinoConPrestazioni(request({origin:'https://attacker.example',cookie:`artecna_rapportino_sessione=${token}`}),{}),e=>e.status===403)
  assert.equal(h.calls.length,0)
})
test('accesso HTTP: risposta legacy compatibile e token solo nel cookie HttpOnly/Secure/Strict',async()=>{
  const h=harness(),route=h.route('app/api/rapportino/accesso/route.ts')
  const response=await route.POST(request({origin:'https://app.example'},{pin:'1234'}))
  assert.equal(response.status,200); assert.deepEqual(await response.json(),h.accesso)
  const cookie=response.headers.get('set-cookie')
  assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=strict/i)
  assert.match(cookie,/Max-Age=28800/); assert.match(cookie,/Path=\/api\/rapportino/)
  const login=h.calls.find(x=>x.name==='crea_sessione_rapportino')
  assert.match(login.args.p_token,/^[0-9a-f]{64}$/)
  assert(!JSON.stringify(h.accesso).includes(login.args.p_token))
  assert.equal(response.headers.get('cache-control'),'no-store')
})
test('/stato: assente e V1 non interrogano tabelle legacy; no-store',async()=>{
  for(const versione of [null,1]) {
    const data=rispostaLettura(versione)
    if(versione===1) data.dettaglio.prestazioni.push({...data.dettaglio.prestazioni[0],
      prestazione_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',chiave_client:'p3',variante_id:idLettura})
    const h=harness({rpcTransport:async(name)=>{assert.equal(name,'leggi_rapportino_portale');return{data,error:null}}})
    const response=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie:`artecna_rapportino_sessione=${token}`},
      {cantiereId:contestoLettura.cantiere_id,data:contestoLettura.data}))
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
    const body=await response.json()
    assert.equal(body.versione_prestazioni,versione);assert.deepEqual(body.timbrature,[])
    assert.equal(h.calls.filter(x=>x.name==='leggi_rapportino_portale').length,1)
    assert(!h.calls.some(x=>x.transport==='postgrest'))
    if(versione===1) {
      assert.deepEqual(body.strutturato,data.dettaglio)
      assert.deepEqual(body.rapportino,{id:idLettura,data:contestoLettura.data})
    } else assert.equal(body.rapportino,null)
  }
})

function legacyStatoMock({row,clocks=[],error=null,clockError=null,fail=null}) {
  const queries=[]
  return {queries,from(table){
    const query={table,filters:[]};queries.push(query)
    const execute=async()=>{
      if(fail) throw new Error(fail)
      return table==='rapportini'?{data:row,error}:{data:clocks,error:clockError}
    }
    const builder={select(columns){query.columns=columns;return builder},eq(key,value){query.filters.push([key,value]);return builder},
      maybeSingle:execute,then(resolve,reject){return execute().then(resolve,reject)}}
    return builder
  }}
}

test('/stato: V0 usa esattamente UUID RPC, cantiere, data; campi e timbrature legacy conservati',async()=>{
  const data=rispostaLettura(0)
  const row={id:idLettura,cantiere_id:contestoLettura.cantiere_id,data:contestoLettura.data,versione_prestazioni:0,
    created_at:'2026-10-04T10:00:00Z',note:'Legacy',operai:'Mario',ore:'5',materiali:'Cemento',quantita_materiali:'3'}
  const clocks=[{operaio_id:'worker',operaio_nome:'Mario',ora_entrata:'08:00',ora_uscita:'13:00'}]
  const legacy=legacyStatoMock({row,clocks})
  const h=harness({rpcTransport:async()=>({data,error:null}),legacyTransport:legacy})
  const response=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie:`artecna_rapportino_sessione=${token}`},
    {cantiereId:contestoLettura.cantiere_id,data:contestoLettura.data,rapportinoId:idLettura}))
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
  const body=await response.json()
  const {cantiere_id,versione_prestazioni,...expected}=row
  assert.deepEqual(body,{data:contestoLettura.data,presente:true,versione_prestazioni:0,rapportino:expected,timbrature:clocks})
  assert.deepEqual(legacy.queries[0].filters,[['id',idLettura],['cantiere_id',contestoLettura.cantiere_id],
    ['data',contestoLettura.data],['versione_prestazioni',0]])
  assert.deepEqual(legacy.queries[1].filters,[['rapportino_id',idLettura],['stato','da rapportino']])
})

test('/stato: incoerenza V0 dopo RPC → 409 senza selezionare un altro UUID',async()=>{
  for(const row of [null,{id:idLettura,cantiere_id:contestoLettura.cantiere_id,data:'2026-09-30',versione_prestazioni:0},
    {id:contestoLettura.cantiere_id,cantiere_id:contestoLettura.cantiere_id,data:contestoLettura.data,versione_prestazioni:0},
    {id:idLettura,cantiere_id:contestoLettura.cantiere_id,data:contestoLettura.data,versione_prestazioni:1}]) {
    const legacy=legacyStatoMock({row})
    const h=harness({rpcTransport:async()=>({data:rispostaLettura(0),error:null}),legacyTransport:legacy})
    const response=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie:`artecna_rapportino_sessione=${token}`},
      {cantiereId:contestoLettura.cantiere_id,data:contestoLettura.data}))
    assert.equal(response.status,409);assert.equal(response.headers.get('cache-control'),'no-store')
    assert.equal(legacy.queries.length,1)
  }
})

for(const [code,status] of [['PR401',401],['42501',403],['PR409',409],['22023',400]]) {
  test(`/stato: ${code} → ${status}, no-store e messaggio sanitizzato`,async()=>{
    const logs=[],secret=`${token} https://secret.invalid password payload SQL SELECT`
    const h=harness({rpcTransport:async()=>({data:null,error:{code,message:secret}}),logSink:{error:(...x)=>logs.push(x)}})
    const response=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie:`artecna_rapportino_sessione=${token}`},
      {cantiereId:contestoLettura.cantiere_id,data:contestoLettura.data,rapportinoId:idLettura}))
    assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store')
    assert(!JSON.stringify(await response.json()).includes(secret));assert(!JSON.stringify(logs).includes(token))
  })
}

test('/stato: 503 trasporto/JSON invalido/legacy, nessun log grezzo',async()=>{
  const secret=`${token} https://secret.invalid password payload SQL SELECT`
  const row={id:idLettura,cantiere_id:contestoLettura.cantiere_id,data:contestoLettura.data,versione_prestazioni:0}
  for(const options of [
    {rpcTransport:async()=>{throw new Error(secret)}},
    {rpcTransport:async()=>({data:{...rispostaLettura(1),presente:false},error:null})},
    {rpcTransport:async()=>({data:rispostaLettura(0),error:null}),legacyTransport:legacyStatoMock({row,error:{message:secret}})},
    {rpcTransport:async()=>({data:rispostaLettura(0),error:null}),legacyTransport:legacyStatoMock({row,clockError:{message:secret}})},
    {rpcTransport:async()=>({data:rispostaLettura(0),error:null}),legacyTransport:legacyStatoMock({row,fail:secret})},
  ]) {
    const logs=[],h=harness({...options,logSink:{error:(...x)=>logs.push(x)}})
    const response=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie:`artecna_rapportino_sessione=${token}`},
      {cantiereId:contestoLettura.cantiere_id,data:contestoLettura.data}))
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store')
    assert(!JSON.stringify(await response.json()).includes(secret));assert(!JSON.stringify(logs).includes('secret.invalid'))
  }
})

test('/stato: input/sessione/body invalidi no-store; fallback data esistente e data esplicita preservati',async()=>{
  const h=harness({rpcTransport:async(name,args)=>({data:{...rispostaLettura(),data:args.p_data},error:null})})
  const route=h.route('app/api/rapportino/stato/route.ts')
  const cookie=`artecna_rapportino_sessione=${token}`
  const missing=await route.POST(request({}, {cantiereId:contestoLettura.cantiere_id,data:contestoLettura.data}))
  assert.equal(missing.status,401);assert.equal(missing.headers.get('cache-control'),'no-store')
  for(const body of [null,[],{cantiereId:'invalid',data:'2026-09-30'},
    {cantiereId:contestoLettura.cantiere_id,data:'2026-02-30'}]) {
    const res=await route.POST(request({cookie},body));assert.equal(res.status,400);assert.equal(res.headers.get('cache-control'),'no-store')
  }
  const malformed=await route.POST(new Request('https://app.example/api/rapportino/stato',{method:'POST',body:'{',headers:{cookie}}))
  assert.equal(malformed.status,400);assert.equal(malformed.headers.get('cache-control'),'no-store')
  for(const data of [undefined,'',' 2026-09-30 ']) {
    const before=new Date().toISOString().slice(0,10)
    const res=await route.POST(request({cookie},{cantiereId:contestoLettura.cantiere_id,data}))
    assert.equal(res.status,200)
    const actual=(await res.json()).data
    if(data?.trim()) assert.equal(actual,'2026-09-30')
    else assert([before,new Date().toISOString().slice(0,10)].includes(actual))
  }
})

test('legacy stato/salva richiedono sessione e non usano ID compilatore browser',async()=>{
  const h=harness()
  for(const routeName of ['stato','salva']) {
    const response=await h.route(`app/api/rapportino/${routeName}/route.ts`).POST(request({}, {cantiereId:contestoLettura.cantiere_id,data:'2026-10-03',compilatoDaOperaioId:'forged'}))
    assert.equal(response.status,401)
  }
  assert.equal(h.calls.length,0)
  const compiler=await h.service.verificaSessioneRapportino(request({cookie:`artecna_rapportino_sessione=${token}`}), 'site')
  assert.equal(compiler.id,'session-worker')
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.find(x=>x.name==='verifica_sessione_rapportino').args)),{p_sessione:token,p_cantiere_id:'site'})
})
test('endpoint strutturato e Varianti non accettano letture/scritture senza sessione',async()=>{
  const h=harness()
  for(const name of ['strutturato','varianti']) {
    const response=await h.route(`app/api/rapportino/${name}/route.ts`).POST(request({},{}))
    assert.equal(response.status,401)
    assert.equal(response.headers.get('cache-control'),'no-store')
  }
})
test('URL pooler mancante: errore esplicito, nessun fallback service-role o anon',async()=>{
  const h=harness(); delete h.env.RAPPORTINI_DATABASE_URL
  await assert.rejects(()=>h.service.creaSessioneRapportino('1234'),e=>e.status===503)
  assert.equal(h.calls.length,0)
})

test('pg: senza service-role, pool riusato/TLS verificato/timeout/query parametrizzate',async()=>{
  const h=harness()
  assert.equal(h.env.SUPABASE_SERVICE_ROLE_KEY,undefined)
  await h.service.creaSessioneRapportino("1234'; DROP TABLE operai; --")
  await h.service.verificaSessioneRapportino(request({cookie:`artecna_rapportino_sessione=${token}`}), 'site')
  await h.service.leggiVariantiRapportinoPortale(request({cookie:`artecna_rapportino_sessione=${token}`}), 'site')
  await h.service.salvaRapportinoConPrestazioni(request({cookie:`artecna_rapportino_sessione=${token}`}),{})
  const pools=h.calls.filter(x=>x.poolOptions)
  assert.equal(pools.length,1); assert.equal(h.calls.filter(x=>x.attached).length,1)
  const options=pools[0].poolOptions
  assert.equal(options.ssl.rejectUnauthorized,true)
  assert.equal(options.ssl.ca,caSupabase)
  assert.equal(options.ssl.checkServerIdentity,undefined)
  assert.equal(options.host,'example.pooler.supabase.com'); assert.equal(options.port,6543)
  assert.equal(options.user,'artecna_rapportini_backend.testref'); assert.equal(options.database,'postgres')
  assert.equal(options.max,3); assert.equal(options.idleTimeoutMillis,5000)
  assert.equal(options.connectionTimeoutMillis,10000); assert.equal(options.query_timeout,25000)
  assert.equal(options.connectionString,undefined)
  assert.equal(h.calls.filter(x=>x.key).length,0)
  for(const x of h.calls.filter(x=>x.query)) {
    assert.equal(x.query.name,undefined)
    assert.match(x.query.text,/WHERE session_user = 'artecna_rapportini_backend' AND current_user = 'artecna_rapportini_backend'/)
    assert(!x.query.text.includes(token)); assert(!x.query.text.includes('DROP TABLE'))
  }
})

test('TLS: CA pubblica PEM X.509 attesa, valida e senza chiavi private',()=>{
  const {X509Certificate}=require('node:crypto')
  assert.match(caSource,/import 'server-only'/)
  assert.match(caSupabase,/^-----BEGIN CERTIFICATE-----\n/)
  assert.equal((caSupabase.match(/BEGIN CERTIFICATE/g)||[]).length,1)
  assert(!/PRIVATE KEY/.test(caSupabase))
  const cert=new X509Certificate(caSupabase)
  assert.equal(cert.ca,true); assert.equal(cert.verify(cert.publicKey),true)
  assert.equal(cert.fingerprint256,'80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA')
  assert.equal(cert.subject,cert.issuer); assert.match(cert.subject,/CN=Supabase Root 2021 CA/)
  assert(Date.now()>Date.parse(cert.validFrom) && Date.now()<Date.parse(cert.validTo))
  require('node:tls').createSecureContext({ca:caSupabase})
})

test('pg: pooler errato/TLS disattivato/URL malformata → 503 senza segreti',async()=>{
  for(const value of ['not-a-url-secret',
    'postgresql://postgres.ref:test_password@example.pooler.supabase.com:6543/postgres',
    'postgresql://artecna_rapportini_backend.ref:test_password@example.pooler.supabase.com:5432/postgres',
    'postgresql://artecna_rapportini_backend.ref:test_password@example.pooler.supabase.com:6543/postgres?sslmode=disable']) {
    const h=harness();h.env.RAPPORTINI_DATABASE_URL=value
    await assert.rejects(()=>h.service.creaSessioneRapportino('1234'),e=>e.status===503 && !e.message.includes('test_password') && !e.message.includes(value))
    assert.equal(h.calls.length,0)
  }
})

test('pg: identità pooler inattesa → 503, nessun fallback',async()=>{
  const h=harness({pgTransport:async()=>({rows:[]})})
  await assert.rejects(()=>h.service.creaSessioneRapportino('1234'),e=>e.status===503)
  assert.equal(h.calls.filter(x=>x.key).length,0)
})

test('pg: errori SQL e idle/trasporto non divulgano URL/password/token nei log',async()=>{
  const logs=[]
  const h=harness({pgTransport:async()=>{
    const e=new (require('pg').DatabaseError)('test_password postgresql://secret token-secret',0,'error')
    e.code='22023';throw e
  },logSink:{error:(...x)=>logs.push(x),log:(...x)=>logs.push(x)}})
  const result=await h.route('app/api/rapportino/accesso/route.ts').POST(request({}, {pin:'1234'}))
  assert.equal(result.status,400)
  const message=JSON.stringify(await result.json())
  assert(!/test_password|postgresql|token-secret/.test(message))
  h.calls.find(x=>x.poolEvent==='error').handler(new Error('test_password'))
  assert.deepEqual(logs, [['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=postgres']])
})

test('errore trasporto con dettagli sensibili non raggiunge risposta o log legacy',async()=>{
  const logs=[]
  const h=harness({rpcTransport:async()=>{throw {message:'transport failed',headers:{Authorization:'Bearer test_server'}}},
    logSink:{error:(...args)=>logs.push(args)}})
  const response=await h.route('app/api/rapportino/stato/route.ts').POST(request(
    {cookie:`artecna_rapportino_sessione=${token}`},{cantiereId:contestoLettura.cantiere_id}))
  assert.deepEqual(logs, [['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=sconosciuto']])
  assert.equal(response.status,503)
  assert(!JSON.stringify(await response.json()).includes('test_server'))
})

// Socket pg simulato, ma adapter, handler, token Node e SQL PostgreSQL reali.
test('diagnostico temporaneo: categorie/fasi statiche, una riga, HTTP invariato e nessun segreto',async()=>{
  const {DatabaseError}=require('pg')
  const cases=[
    {env:null,fase:'inizio',categoria:'configurazione'},
    {env:'secret-invalid-url',fase:'env_presente',categoria:'configurazione'},
    {env:'postgresql://artecna_rapportini_backend.ref:bad%ZZ@example.pooler.supabase.com:6543/postgres',fase:'url_parsata',categoria:'configurazione'},
    {env:'postgresql://postgres.ref:test_password@example.pooler.supabase.com:6543/postgres',fase:'credenziali_decodificate',categoria:'configurazione'},
    {code:'ERR_TLS_CERT_ALTNAME_INVALID',categoria:'tls'},
    {code:'28P01',sql:true,categoria:'autenticazione'},
    {identity:true,categoria:'identita'},
    {code:'ETIMEDOUT',categoria:'timeout'},
    {code:'57014',sql:true,categoria:'timeout'},
    {code:'22023',sql:true,categoria:'postgres',status:400},
    {code:'UNKNOWN_SECRET_CODE',categoria:'sconosciuto'},
  ]
  for(const c of cases) {
    const logs=[]
    const secret='test_password URL-secret PIN-secret token-secret cookie-secret payload-secret'
    const h=harness({logSink:{error:(...args)=>logs.push(args)},pgTransport:async()=>{
      if(c.identity) return {rows:[]}
      const e=c.sql ? new DatabaseError(secret,0,'error') : new Error(secret)
      e.code=c.code;throw e
    }})
    if('env' in c) {if(c.env===null) delete h.env.RAPPORTINI_DATABASE_URL;else h.env.RAPPORTINI_DATABASE_URL=c.env}
    const response=await h.route('app/api/rapportino/accesso/route.ts').POST(request({}, {pin:'PIN-secret'}))
    assert.equal(response.status,c.status||503)
    assert.deepEqual(await response.json(),{error:c.status===400 ? 'Dati Rapportino non validi' : 'Servizio Rapportini non disponibile'})
    const flags=c.fase==='credenziali_decodificate'
      ? ' protocollo_ok=true host_ok=true porta_ok=true database_ok=true username_ok=false password_presente=true query_ok=true fragment_ok=true' : ''
    assert.deepEqual(logs,[[`[RAPPORTINI_DB_DIAG] fase=${c.fase||'connessione_avviata'} categoria=${c.categoria}${flags}`]])
    assert(!/secret|test_password|postgresql|example\.pooler|CERTIFICATE/.test(JSON.stringify(logs)))
  }
  const logs=[]
  const h=harness({logSink:{error:(...args)=>logs.push(args)},pgTransport:async()=>{throw new Error('payload-secret')}})
  await assert.rejects(()=>h.service.salvaRapportinoConPrestazioni(request({cookie:`artecna_rapportino_sessione=${token}`}),{note:'payload-secret'}),e=>e.status===503)
  assert.deepEqual(logs,[['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=sconosciuto']])
})

// Il cambio ruolo riproduce le ACL; non simula la crittografia JWT di PostgREST.
test('diagnostico URL: ogni predicato invariato, soli booleani statici e HTTP identico',async()=>{
  const base='postgresql://artecna_rapportini_backend.testref:test_password@example.pooler.supabase.com:6543/postgres'
  const keys=['protocollo_ok','host_ok','porta_ok','database_ok','username_ok','password_presente','query_ok','fragment_ok']
  const cases=[
    [base.replace('postgresql:','https:'),'protocollo_ok'],
    [base.replace('example.pooler.supabase.com','secret.invalid'),'host_ok'],
    [base.replace(':6543',':5432'),'porta_ok'],
    [base.replace('/postgres','/secret-db'),'database_ok'],
    [base.replace('artecna_rapportini_backend.testref','secret-user'),'username_ok'],
    [base.replace('test_password',''),'password_presente'],
    [base+'?secret-param=secret-value','query_ok'],
    [base+'?sslmode=disable','query_ok'],
    [base+'#secret-fragment','fragment_ok'],
  ]
  // Ogni predicato vero è verificato anche lasciando fallire un altro controllo.
  for(const [url,failed] of cases) {
    const logs=[]
    const h=harness({logSink:{error:(...args)=>logs.push(args)}})
    h.env.RAPPORTINI_DATABASE_URL=url
    const response=await h.route('app/api/rapportino/accesso/route.ts').POST(request({}, {pin:'secret-pin'}))
    assert.equal(response.status,503)
    assert.deepEqual(await response.json(),{error:'Servizio Rapportini non disponibile'})
    assert.equal(h.calls.length,0)
    const flags=keys.map(key=>`${key}=${key!==failed}`).join(' ')
    assert.deepEqual(logs,[[`[RAPPORTINI_DB_DIAG] fase=credenziali_decodificate categoria=configurazione ${flags}`]])
    assert(!/secret|test_password|postgresql|supabase\.com|6543|5432/.test(JSON.stringify(logs)))
  }
  for(const url of [base,base+'?sslmode=require',base+'?sslmode=verify-full']) {
    const logs=[]
    const h=harness({logSink:{error:(...args)=>logs.push(args)}})
    h.env.RAPPORTINI_DATABASE_URL=url
    const response=await h.route('app/api/rapportino/accesso/route.ts').POST(request({}, {pin:'secret-pin'}))
    assert.equal(response.status,200); assert.deepEqual(await response.json(),h.accesso)
    assert.equal(logs.length,0)
  }
})

test('E2E reale isolato: login → cookie → verifica → save/retry → legacy',async()=>{
  const {PGlite}=require('@electric-sql/pglite')
  const {createHash,randomUUID}=require('node:crypto')
  const {fixture,A,OP,OP2,RAP}=require('./fixtureStep3.cjs')
  const db=new PGlite()
  const logs=[]
  const q=async(sql,params=[]) => (await db.query(sql,params)).rows
  async function asRole(role,fn) {
    await db.exec(`SET ROLE ${role}`)
    try { return await fn() } finally { await db.exec('RESET ROLE') }
  }
  const pgTransport=async(query)=>{
    await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend')
    try {return {rows:await q(query.text,query.values)}}
    catch(error) {const pgError=new (require('pg').DatabaseError)(error.message,0,'error');pgError.code=error.code;throw pgError}
    finally {await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE')}
  }
  // Builder minimo per esercitare le API LEGACY reali sullo stesso database.
  const legacyTransport={from(table){
    assert(['cantieri','operai','rapportini','timbrature'].includes(table))
    let operation='select',columns='*',values,limit,order,single=false
    const filters=[]
    const ident=name=>{assert(/^[a-z_][a-z_0-9]*$/.test(name));return `"${name}"`}
    const selected=()=>columns==='*' ? '*' : columns.split(',').map(x=>ident(x.trim())).join(',')
    async function execute() {
      const params=[]
      const bind=value=>{params.push(value);return `$${params.length}`}
      let sql
      if(operation==='insert') {
        const items=Array.isArray(values)?values:[values],keys=Object.keys(items[0])
        sql=`INSERT INTO public.${ident(table)}(${keys.map(ident).join(',')}) VALUES ${items.map(item=>
          `(${keys.map(key=>bind(item[key])).join(',')})`).join(',')}`
      } else if(operation==='update') {
        sql=`UPDATE public.${ident(table)} SET ${Object.entries(values).map(([key,value])=>`${ident(key)}=${bind(value)}`).join(',')}`
      } else sql=operation==='delete' ? `DELETE FROM public.${ident(table)}` : `SELECT ${selected()} FROM public.${ident(table)}`
      if(filters.length) sql+=' WHERE '+filters.map(([kind,key,value])=>kind==='in'
        ? `${ident(key)} IN (${value.map(bind).join(',')})` : `${ident(key)}=${bind(value)}`).join(' AND ')
      if(operation==='select') {
        if(order) sql+=` ORDER BY ${ident(order[0])} ${order[1]?'ASC':'DESC'}`
        if(limit) sql+=` LIMIT ${limit}`
      } else sql+=` RETURNING ${selected()}`
      try {
        const rows=await asRole('anon',()=>q(sql,params))
        // PostgREST serializza PostgreSQL date come YYYY-MM-DD, non Date JS.
        if(table==='rapportini') for(const row of rows) {
          if(row.data instanceof Date) row.data=row.data.toISOString().slice(0,10)
        }
        return {error:null,data:single ? rows[0]||null : rows}
      } catch(error) { return {data:null,error:{code:error.code,message:error.message}} }
    }
    const builder={
      select(x){columns=x;return builder},insert(x){operation='insert';values=x;return builder},
      update(x){operation='update';values=x;return builder},delete(){operation='delete';return builder},
      eq(k,v){filters.push(['eq',k,v]);return builder},in(k,v){filters.push(['in',k,v]);return builder},
      limit(x){limit=x;return builder},order(k,{ascending=true}={}){order=[k,ascending];return builder},
      single(){single=true;return execute()},maybeSingle(){single=true;return execute()},
      then(resolve,reject){return execute().then(resolve,reject)},
    }
    return builder
  }}
  try {
    await db.exec(fixture)
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261003_rapportino_prestazioni_step2.sql'),'utf8'))
    const storico=(await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP]))[0].v
    const storica=(await q('SELECT to_jsonb(t) v FROM public.timbrature t WHERE id=$1',[OP]))[0].v
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261003_rapportino_servizio_step3.sql'),'utf8'))
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261003_rapportino_backend_pooler.sql'),'utf8'))
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261004_rapportino_lettura_portale.sql'),'utf8'))
    const h=harness({pgTransport,legacyTransport,logSink:{error:(...x)=>logs.push(x),log:(...x)=>logs.push(x)}})
    const accesso=await h.route('app/api/rapportino/accesso/route.ts').POST(request({origin:'https://app.example'},{pin:'1234'}))
    assert.equal(accesso.status,200)
    const loginBody=await accesso.json(),cookie=accesso.headers.get('set-cookie').split(';')[0]
    const tokenOriginale=cookie.slice(cookie.indexOf('=')+1)
    assert.match(tokenOriginale,/^[0-9a-f]{64}$/)
    assert.equal(Buffer.from(tokenOriginale,'hex').length,32)
    assert.equal(h.calls.find(x=>x.name==='crea_sessione_rapportino').args.p_token,tokenOriginale)
    assert.equal(h.service.tokenSessioneRapportino(cookie),tokenOriginale)
    const digest=createHash('sha256').update(tokenOriginale,'utf8').digest('hex')
    const stored=(await q("SELECT encode(token_sha256,'hex') digest,octet_length(token_sha256) bytes FROM artecna_rapportini.sessioni_portale"))[0]
    assert.equal(stored.digest,digest); assert.equal(stored.bytes,32)
    assert.notEqual(digest,tokenOriginale)
    const compiler=await h.service.verificaSessioneRapportino(request({cookie}),A)
    assert.equal(compiler.id,OP)
    assert.equal(h.calls.find(x=>x.name==='verifica_sessione_rapportino').args.p_sessione,tokenOriginale)
    const p={versione_contratto:1,richiesta_id:randomUUID(),rapportino_id:null,revisione_attesa:null,cantiere_id:A,data:'2026-10-03',
      prestazioni:{nuove:[{prestazione_id:null,chiave_client:'e2e',operaio_id:OP,ora_inizio:'07:30',ora_fine:'12:30',
        pausa_minuti:0,lavoro_in_economia:false,variante_id:null}],aggiornate:[],rimosse:[]}}
    const writer=h.route('app/api/rapportino/strutturato/route.ts')
    // Prima chiamata committata; il browser ritenta il body originale con id null.
    const first=await writer.POST(request({cookie},p)); assert.equal(first.status,200)
    const committed=await first.json()
    assert.equal(h.calls.find(x=>x.name==='salva_rapportino_con_prestazioni').args.p_sessione,tokenOriginale)
    const count=async()=> (await q(`SELECT
      (SELECT count(*)::int FROM public.rapportini WHERE cantiere_id=$1 AND data='2026-10-03') rapportini,
      (SELECT count(*)::int FROM public.rapportino_prestazioni WHERE rapportino_id=$2) prestazioni,
      (SELECT count(*)::int FROM public.timbrature WHERE rapportino_id=$2) timbrature`,[A,committed.rapportino_id]))[0]
    assert.deepEqual(await count(),{rapportini:1,prestazioni:1,timbrature:1})
    const retry=await writer.POST(request({cookie},p)); assert.equal(retry.status,200)
    assert.deepEqual(await retry.json(),committed); assert.equal(p.rapportino_id,null)
    assert.deepEqual(await count(),{rapportini:1,prestazioni:1,timbrature:1})
    const bad=await writer.POST(request({cookie:`artecna_rapportino_sessione=${digest}`},p))
    assert.equal(bad.status,403); assert.deepEqual(await count(),{rapportini:1,prestazioni:1,timbrature:1})
    const variante=await h.route('app/api/rapportino/varianti/route.ts').POST(request({cookie},{cantiere_id:A}))
    assert.equal(variante.status,200)
    assert.equal(h.calls.find(x=>x.name==='varianti_rapportino_portale').args.p_sessione,tokenOriginale)
    // La sanitizzazione del trasporto conserva gli errori funzionali espliciti.
    await db.query('UPDATE public.operai SET costo_orario=NULL WHERE id=$1',[OP])
    const costoNull=await writer.POST(request({cookie},{...p,richiesta_id:randomUUID(),data:'2026-10-05'}))
    assert.equal(costoNull.status,400)
    assert.equal((await costoNull.json()).error,'Costo orario operaio non valorizzato')
    assert.equal((await q("SELECT count(*)::int n FROM public.rapportini WHERE data='2026-10-05'"))[0].n,0)
    await db.query('UPDATE public.operai SET costo_orario=20 WHERE id=$1',[OP])
    const state=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie},{cantiereId:A,data:'2026-09-21'}))
    assert.equal(state.status,200); assert.equal((await state.json()).rapportino.id,RAP)
    // Duplicato storico V0: la RPC sceglie il più recente e /stato legge solo quell'UUID.
    const duplicateId=randomUUID()
    await q('INSERT INTO public.rapportini(id,cantiere_id,data,created_at,note) VALUES($1,$2,$3,$4,$5)',
      [duplicateId,A,'2026-09-21','2099-01-01','Duplicato V0 più recente'])
    const duplicateState=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie},{cantiereId:A,data:'2026-09-21'}))
    assert.equal(duplicateState.status,200)
    const selectedDuplicate=await duplicateState.json()
    assert.equal(selectedDuplicate.rapportino.id,duplicateId)
    assert.equal(selectedDuplicate.rapportino.note,'Duplicato V0 più recente')
    assert.deepEqual(selectedDuplicate.timbrature,[])
    await q('DELETE FROM public.rapportini WHERE id=$1',[duplicateId])
    const structuredState=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie},
      {cantiereId:A,data:p.data,rapportinoId:committed.rapportino_id}))
    assert.equal(structuredState.status,200)
    const structuredBody=await structuredState.json()
    assert.equal(structuredBody.versione_prestazioni,1)
    assert.deepEqual(structuredBody.strutturato,committed)
    assert.deepEqual(structuredBody.timbrature,[])
    const absentRetro=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie},{cantiereId:A,data:'2026-09-30'}))
    assert.equal(absentRetro.status,200);assert.equal((await absentRetro.json()).presente,false)
    const otherReports=await q("SELECT to_jsonb(r) v FROM public.rapportini r ORDER BY id")
    const otherClocks=await q("SELECT to_jsonb(t) v FROM public.timbrature t ORDER BY id")
    const legacyBody={cantiereId:A,data:'2026-09-30',note:'Legacy',compilatoDaOperaioId:OP2,
      operai:[{id:OP,nome:'Mario',ora_inizio:'07:30',ora_fine:'12:30',ore:5,pausa_minuti:0}],foto:[]}
    const legacySave=h.route('app/api/rapportino/salva/route.ts')
    const created=await legacySave.POST(request({cookie},legacyBody)); assert.equal(created.status,200,JSON.stringify(logs))
    const legacyId=(await created.json()).rapportino.id
    assert.equal((await q('SELECT data::text d FROM public.rapportini WHERE id=$1',[legacyId]))[0].d,'2026-09-30')
    assert.deepEqual(await q('SELECT data FROM public.timbrature WHERE rapportino_id=$1',[legacyId]),[{data:'2026-09-30'}])
    assert.deepEqual(await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id<>$1 ORDER BY id',[legacyId]),otherReports)
    assert.deepEqual(await q('SELECT to_jsonb(t) v FROM public.timbrature t WHERE rapportino_id IS DISTINCT FROM $1 ORDER BY id',[legacyId]),otherClocks)
    const readRetro=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie},{cantiereId:A,data:'2026-09-30'}))
    const readRetroBody=await readRetro.json()
    assert.equal(readRetroBody.presente,true);assert.equal(readRetroBody.rapportino.id,legacyId)
    for(const date of ['2026-10-01','2026-10-04']) {
      const independent=await h.route('app/api/rapportino/stato/route.ts').POST(request({cookie},{cantiereId:A,data:date}))
      assert.equal(independent.status,200)
      const result=await independent.json();assert.equal(result.data,date);assert.equal(result.presente,false)
    }
    assert.equal((await q('SELECT versione_prestazioni,compilato_da_operaio_id FROM public.rapportini WHERE id=$1',[legacyId]))[0].versione_prestazioni,0)
    assert.equal((await q('SELECT compilato_da_operaio_id FROM public.rapportini WHERE id=$1',[legacyId]))[0].compilato_da_operaio_id,OP)
    const edited=await legacySave.POST(request({cookie},{...legacyBody,rapportinoId:legacyId,note:'Legacy modificato'}))
    assert.equal(edited.status,200)
    const beforeWrongDate=await q('SELECT to_jsonb(r) v FROM public.rapportini r ORDER BY id')
    const clocksBeforeWrongDate=await q('SELECT to_jsonb(t) v FROM public.timbrature t ORDER BY id')
    const wrongDate=await legacySave.POST(request({cookie},{...legacyBody,rapportinoId:legacyId,data:'2026-10-01',note:'Non applicare'}))
    assert.equal(wrongDate.status,409)
    assert.equal((await wrongDate.json()).error,'Rapportino non appartenente alla data selezionata')
    assert.deepEqual(await q('SELECT to_jsonb(r) v FROM public.rapportini r ORDER BY id'),beforeWrongDate)
    assert.deepEqual(await q('SELECT to_jsonb(t) v FROM public.timbrature t ORDER BY id'),clocksBeforeWrongDate)
    const blocked=await legacySave.POST(request({cookie},{...legacyBody,data:p.data,rapportinoId:committed.rapportino_id}))
    assert.equal(blocked.status,409); assert.deepEqual(await count(),{rapportini:1,prestazioni:1,timbrature:1})
    assert.deepEqual((await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP]))[0].v,storico)
    assert.deepEqual((await q('SELECT to_jsonb(t) v FROM public.timbrature t WHERE id=$1',[OP]))[0].v,storica)
    assert(!JSON.stringify(loginBody).includes('test_server'))
    assert(!JSON.stringify(committed).includes('test_server'))
    assert(!JSON.stringify(logs).includes('test_server'))
    assert.deepEqual(logs,[
      ['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=postgres'],
      ['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=postgres'],
    ])
  } finally { await db.close() }
})
