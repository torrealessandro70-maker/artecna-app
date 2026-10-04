// Unit test del servizio applicativo: nessuna rete, DB, ENV o sessione reale.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', R='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OP='cccccccc-cccc-4ccc-8ccc-cccccccccccc', V='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const input={cantiere_id:A,data:'2026-09-30'}
const req=new Request('https://example.invalid/api/rapportino/stato',{
  method:'POST',headers:{cookie:'artecna_rapportino_sessione='+ 'ab'.repeat(32)}})
class ErroreServizioRapportini extends Error {
  constructor(message,status,code){super(message);this.status=status;this.code=code}
}
function harness(read) {
  const calls=[],logs=[]
  function load(file,requireImpl) {
    const source=fs.readFileSync(path.join(__dirname,file),'utf8')
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
    const exports={}
    vm.runInNewContext(code,{exports,require:requireImpl,console:{error:(...x)=>logs.push(x),log:(...x)=>logs.push(x)}})
    return exports
  }
  const validator=load('validaLetturaPortale.ts',()=>{throw Error('Import validatore inatteso')})
  const service=load('servizioLetturaPortale.server.ts',name=>{
    if(name==='server-only') return {}
    if(name==='./letturaRapportinoPortale.server') return {leggiRapportinoPortale:async(request,context)=>{
      calls.push({request,context}); return await read(request,context)
    }}
    if(name==='./servizioRapportini.server') return {ErroreServizioRapportini}
    if(name==='./validaLetturaPortale') return validator
    // Vietati anche in futuro import Supabase, pg, credenziali o altri lettori.
    throw Error('Dipendenza del servizio non autorizzata')
  })
  return {service,calls,logs}
}
function dto(versione) {
  const value={versione_lettura:1,...input,presente:versione!==null,
    versione_prestazioni:versione,rapportino_id:versione===null ? null:R,dettaglio:null}
  if(versione===1) {
    const row={prestazione_id:'11111111-1111-4111-8111-111111111111',chiave_client:'p1',operaio_id:OP,
      operaio_nome:'Mario',ora_inizio:'08:00',ora_fine:'13:00',pausa_minuti:30,
      lavoro_in_economia:true,variante_id:V,ore:4.5,revisione:1,rimossa_at:null}
    value.dettaglio={versione_contratto:1,rapportino_id:R,revisione:3,...input,
      documento:{note:'Lavoro',materiali:'Cemento',quantita_materiali:'3'},prestazioni:[row,
        {...row,prestazione_id:'22222222-2222-4222-8222-222222222222',chiave_client:'p2',variante_id:null},
        {...row,prestazione_id:'33333333-3333-4333-8333-333333333333',chiave_client:'p3',
          lavoro_in_economia:false,variante_id:null,rimossa_at:'2026-10-04T08:00:00Z'}]}
  }
  return value
}
for(const version of [null,0,1]) test(`servizio lettura: ${version===null?'assente':`V${version}`} preservato, una sola chiamata`,async()=>{
  const expected=dto(version)
  const h=harness(async()=>expected)
  const result=await h.service.leggiStatoRapportinoPortale(req,input)
  assert.strictEqual(result,expected)
  assert.equal(h.calls.length,1)
  assert.strictEqual(h.calls[0].request,req)
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].context)),{...input,rapportino_id:null})
  assert.deepEqual(h.logs,[])
})
test('servizio lettura: V1 conserva più prestazioni, rimosse, Economia con e senza Variante',async()=>{
  const expected=dto(1),h=harness(async()=>expected)
  const result=await h.service.leggiStatoRapportinoPortale(req,input)
  assert.strictEqual(result.dettaglio,expected.dettaglio)
  assert.equal(result.dettaglio.prestazioni.length,3)
  assert(result.dettaglio.prestazioni.every(p=>p.operaio_id===OP))
  assert(result.dettaglio.prestazioni.some(p=>p.lavoro_in_economia && p.variante_id===V))
  assert(result.dettaglio.prestazioni.some(p=>p.lavoro_in_economia && p.variante_id===null))
  assert(result.dettaglio.prestazioni.some(p=>p.rimossa_at!==null))
})
test('servizio lettura: trim, UUID canonici, UUID opzionale e data retroattiva invariata',async()=>{
  const raw={cantiere_id:` ${A.toUpperCase()} `,data:' 2026-09-30 ',rapportino_id:` ${R.toUpperCase()} `}
  const before=JSON.stringify(raw),expected=dto(1),h=harness(async()=>expected)
  await h.service.leggiStatoRapportinoPortale(req,raw)
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].context)),{...input,rapportino_id:R})
  assert.equal(JSON.stringify(raw),before)
})
test('servizio lettura: input invalidi e data assente rifiutati senza letture',async()=>{
  const h=harness(async()=>{throw Error('Non deve essere chiamato')})
  for(const value of [null,[],{},'invalid',{...input,cantiere_id:42},{...input,cantiere_id:''},
    {...input,data:''},{...input,data:'2026-02-30'},{...input,data:'infinity'},
    {...input,rapportino_id:42},{...input,rapportino_id:''}]) {
    await assert.rejects(()=>h.service.leggiStatoRapportinoPortale(req,value),e=>e.status===400 && e.code==='22023')
  }
  assert.equal(h.calls.length,0); assert.deepEqual(h.logs,[])
})
for(const [code,status] of [['PR401',401],['42501',403],['PR409',409],['22023',400],['TRANSPORT',503],['RISPOSTA',503]]) {
  test(`servizio lettura: errore sanitizzato ${code}/${status} propagato senza retry`,async()=>{
    const error=new ErroreServizioRapportini('Messaggio sanitizzato',status,code)
    const h=harness(async()=>{throw error})
    await assert.rejects(()=>h.service.leggiStatoRapportinoPortale(req,input),e=>e===error)
    assert.equal(h.calls.length,1);assert.deepEqual(h.logs,[])
  })
}
test('servizio lettura: errore inatteso sanitizzato, nessun segreto loggato',async()=>{
  const secret='cookie token payload https://secret.invalid password SQL SELECT'
  const h=harness(async()=>{throw new Error(secret)})
  await assert.rejects(()=>h.service.leggiStatoRapportinoPortale(req,input),e=>e.status===503 && e.code==='TRANSPORT' && !e.message.includes(secret))
  assert.equal(h.calls.length,1);assert.deepEqual(h.logs,[])
})
test('servizio lettura: dati sessione nel body ignorati, Request resta autorevole',async()=>{
  const h=harness(async()=>dto(0))
  await h.service.leggiStatoRapportinoPortale(req,{...input,token:'non-autorevole',sessione:'non-autorevole',timbrature:[{}]})
  assert.strictEqual(h.calls[0].request,req)
  assert.deepEqual(Object.keys(h.calls[0].context).sort(),['cantiere_id','data','rapportino_id'])
  assert.deepEqual(h.logs,[])
})
