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
    varianti_rapportino_portale:['p_sessione','p_cantiere_id'],salva_rapportino_con_prestazioni:['p_payload','p_sessione']}
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
    if(name.includes('servizioRapportini.server')) return service
    if(name.includes('photo-storage/photo-manager')) return {buildPhotoRecordsWithStorage:()=>{throw Error('Foto non previste dal test')}}
    if(name==='@supabase/supabase-js') return {createClient:()=>{
      if(legacyTransport) return legacyTransport
      throw Error('Nessun client legacy senza sessione')
    }}
    return require(name)
  })
  return {service,adapter,route,calls,env,accesso}
}
const token='ab'.repeat(32)
const request=(headers={},body={})=>new Request('https://app.example/api/rapportino/strutturato',{
  method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)
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
test('legacy stato/salva richiedono sessione e non usano ID compilatore browser',async()=>{
  const h=harness()
  for(const routeName of ['stato','salva']) {
    const response=await h.route(`app/api/rapportino/${routeName}/route.ts`).POST(request({}, {cantiereId:'site',data:'2026-10-03',compilatoDaOperaioId:'forged'}))
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
    {cookie:`artecna_rapportino_sessione=${token}`},{cantiereId:'site'}))
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
    assert.deepEqual(logs,[[`[RAPPORTINI_DB_DIAG] fase=${c.fase||'connessione_avviata'} categoria=${c.categoria}`]])
    assert(!/secret|test_password|postgresql|example\.pooler|CERTIFICATE/.test(JSON.stringify(logs)))
  }
  const logs=[]
  const h=harness({logSink:{error:(...args)=>logs.push(args)},pgTransport:async()=>{throw new Error('payload-secret')}})
  await assert.rejects(()=>h.service.salvaRapportinoConPrestazioni(request({cookie:`artecna_rapportino_sessione=${token}`}),{note:'payload-secret'}),e=>e.status===503)
  assert.deepEqual(logs,[['[RAPPORTINI_DB_DIAG] fase=connessione_avviata categoria=sconosciuto']])
})

// Il cambio ruolo riproduce le ACL; non simula la crittografia JWT di PostgREST.
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
    const legacyBody={cantiereId:A,data:'2026-10-04',note:'Legacy',compilatoDaOperaioId:OP2,
      operai:[{id:OP,nome:'Mario',ora_inizio:'07:30',ora_fine:'12:30',ore:5,pausa_minuti:0}],foto:[]}
    const legacySave=h.route('app/api/rapportino/salva/route.ts')
    const created=await legacySave.POST(request({cookie},legacyBody)); assert.equal(created.status,200,JSON.stringify(logs))
    const legacyId=(await created.json()).rapportino.id
    assert.equal((await q('SELECT versione_prestazioni,compilato_da_operaio_id FROM public.rapportini WHERE id=$1',[legacyId]))[0].versione_prestazioni,0)
    assert.equal((await q('SELECT compilato_da_operaio_id FROM public.rapportini WHERE id=$1',[legacyId]))[0].compilato_da_operaio_id,OP)
    const edited=await legacySave.POST(request({cookie},{...legacyBody,rapportinoId:legacyId,note:'Legacy modificato'}))
    assert.equal(edited.status,200)
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
