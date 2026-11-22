/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic records only; no DB/network. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f)
const {costruisciContiDaVerificare:build,filtraConti,urlOriginaleSicuro,chiaveConto}=require('./contiDaVerificare.ts')
const {FONTI}=require('./riepilogo.ts')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const periodo={da:'2026-01-01',a:'2026-03-31'}
const fonti=()=>Object.fromEntries(FONTI.map(f=>[f,{stato:'pronta',righe:[]}]))
const emessa=(n,extra={})=>({id:id(n),numero_fattura:'STESSO NUMERO',cliente:'Cliente sintetico',data_fattura:'2026-01-10',totale:'122.00',importo_incassato:'0',...extra})
const incasso=(extra={})=>({id:id(90),acconto_id:id(91),cantiere_id:id(92),cantiere:'Cantiere sintetico',cliente:'Da verificare',data:'2026-02-01',metodo:'contanti',fonte:'Fixture',importo:'500',netto_acconto:'454.55',imputazione:'contratto',identita_valida:true,assenza_collegamenti_verificata:false,fiscale:{stato:'Da verificare'},quote:[],totale:50000,fatturato:0,senzaFattura:0,riconciliare:50000,...extra})
const lettura=r=>({da:periodo.da,a:periodo.a,autore:id(99),errore:'',dati:{totale:r.totale,fatturato:r.fatturato,senzaFattura:r.senzaFattura,riconciliare:r.riconciliare,righe:[r]}})

test('UUID distinguishes otherwise identical documents; several reasons remain one position',()=>{
 const f=fonti();f.fatture_emesse.righe=[emessa(1),emessa(2)];const r=build(f,periodo,null)
 assert.equal(r.conti.length,2);assert.equal(r.schede.get(chiaveConto('fatture_emesse',id(2))).id,id(2))
 assert(r.conti.every(c=>c.gruppo==='emesse'&&c.problemi.some(p=>p.ambito==='IVA esclusa dal calcolo')))
 const found=filtraConti(r.conti,'',id(2),0);assert.equal(found.righe.length,1);assert.equal(found.righe[0].id,id(2))
})
test('missing IDs stay attached to source order, never matched by name/date/amount',()=>{
 const f=fonti();f.fatture_emesse.righe=[emessa(1,{id:undefined,totale:'111'}),emessa(2,{id:undefined,totale:'222'})]
 const r=build(f,periodo,null);assert.equal(r.conti.length,2);assert.deepEqual(r.conti.map(c=>[c.id,c.lordo]),[[null,11100],[null,22200]])
 assert.notEqual(r.conti[0].chiave,r.conti[1].chiave)
})
test('literal legacy ID cannot collide with an internal missing-ID position',()=>{
 const f=fonti();f.fatture_emesse.righe=[emessa(1,{id:undefined}),emessa(2,{id:'identita-mancante:0'}),emessa(3,{id:'senza-id-0'})]
 assert.equal(build(f,periodo,null).conti.length,3)
})
test('duplicate identity suppresses arbitrary metadata and original URL',()=>{
 const f=fonti();f.fatture_emesse.righe=[emessa(1,{pdf_url:'https://example.invalid/a'}),emessa(1,{cliente:'Altra copia',totale:'500'})]
 const c=build(f,periodo,null).conti[0];assert.equal(c.copie,2);assert.equal(c.id,id(1));assert.equal(c.lordo,null);assert.equal(c.controparte,'');assert.equal(c.url,null)
})
test('gross does not become VAT; ambiguous raw iva field is not used as money',()=>{
 const f=fonti();f.fatture_fornitori.righe=[{id:id(1),numero_fattura:'PDF',data_fattura:'2026-01-01',importo_totale:'122.00',iva:'22',fornitore:'Fornitore fixture'}]
 const c=build(f,periodo,null).conti[0];assert.equal(c.lordo,12200);assert.equal(c.iva,null);assert.match(c.problemi[0].motivo,/XML/)
})
test('same document excluded by several indicators is not duplicated in the list',()=>{
 const f=fonti();f.fatture_emesse.righe=[emessa(1,{totale:'bad',importo_incassato:'bad'})];const r=build(f,periodo,null)
 assert.equal(r.conti.length,1);assert(r.conti[0].problemi.length>=3)
})
test('missing dates remain explicit and are never assigned to an invented month',()=>{
 const f=fonti();f.acconti_cantiere.righe=[{id:id(1),importo:'50',data_incasso:''}]
 const c=build(f,periodo,null).conti[0];assert.equal(c.data,'');assert.equal(c.registrato,5000);assert.equal(c.lordo,null);assert.equal(c.gruppo,'altri')
})
test('incasso absent link, revoked link and unknown coverage retain distinct actual reasons',()=>{
 const cases=[[[],/Nessuna fattura/],[[{id:id(1),fattura_id:id(2),revocata:true,valida:false}],/revocati/],[[{id:id(1),fattura_id:id(2),revocata:false,valida:false}],/La fonte non dettaglia/]]
 for(const [quote,match]of cases){const r=incasso({quote}),c=build(fonti(),periodo,lettura(r)).conti[0];assert.equal(c.id,r.id);assert.equal(c.movimento.acconto_id,r.acconto_id);assert.equal(c.lordo,50000);assert.equal(c.imponibile,null);assert.equal(c.iva,null);assert.match(c.problemi[0].motivo,match)}
})
test('verified receipt without invoice is not treated as unreceived or zero VAT',()=>{
 const r=incasso({riconciliare:0,senzaFattura:50000,assenza_collegamenti_verificata:true}),c=build(fonti(),periodo,lettura(r)).conti[0]
 assert.equal(c.problemi[0].ambito,'Posizione fiscale non determinabile');assert.equal(c.iva,null);assert.equal(c.lordo,50000)
})
test('unavailable or truncated sources never certify an empty clean list',()=>{
 const f=fonti();f.fatture_emesse.stato='errore';const r=build(f,periodo,{dati:null,da:'',a:'',errore:'42501'})
 assert(r.avvisi.length>=2);assert.equal(r.incassiCompleti,false)
 const inc=lettura(incasso());inc.a='2026-02-15';assert.equal(build(fonti(),periodo,inc).incassiCompleti,false)
})
test('invalid periods fail closed and records are immutable',()=>{
 const f=fonti();f.fatture_emesse.righe=[emessa(1)];const before=JSON.stringify(f);assert.equal(build(f,{da:'',a:''},null).conti.length,0);build(f,periodo,null);assert.equal(JSON.stringify(f),before)
})
test('pagination and search retain exact record identities, including page clamp',()=>{
 const f=fonti();f.fatture_emesse.righe=Array.from({length:45},(_,i)=>emessa(i+1));const records=build(f,periodo,null).conti
 assert.equal(filtraConti(records,'','',0).righe.length,20);assert.equal(filtraConti(records,'','',1).righe[0].id,id(21));assert.equal(filtraConti(records,'','',99).righe.length,5)
 assert.equal(filtraConti(records,'',id(24),1).righe[0].id,id(24));assert.equal(filtraConti(records,'incassi','',0).totale,0)
})
test('original links require HTTPS and reject embedded credentials and unsafe schemes',()=>{
 for(const raw of ['http://example.invalid','javascript:alert(1)','/storage/a','https://user:pass@example.invalid/a',null])assert.equal(urlOriginaleSicuro(raw),null)
 assert.equal(urlOriginaleSicuro('https://example.invalid/a'),'https://example.invalid/a')
})
module.exports={fonti,emessa,periodo,incasso,lettura,id}

test('legacy incassi remain separate review records instead of another KPI sum',()=>{
 const f=fonti();f.incassi_non_fatturati.righe=[{id:id(1),data_incasso:'2026-01-01',importo:'500',cliente:'Fixture'}];const r=build(f,periodo,null)
 assert.equal(r.conti.length,1);assert.match(r.conti[0].problemi[0].ambito,/Registro storico/);assert.equal(r.conti[0].registrato,50000);assert.equal(r.conti[0].lordo,null)
})
test('duplicate movement identifiers never choose the last receipt or allow correction',()=>{
 const r=incasso(),input=lettura(r);input.dati.righe.push(incasso({totale:90000}));const c=build(fonti(),periodo,input).conti[0]
 assert.equal(c.copie,2);assert.equal(c.lordo,null);assert.equal(c.movimento,undefined);assert.equal(c.autore,undefined)
})

test('duplicate supplier identities outside the selected period do not leak into its review count',()=>{
 const f=fonti();f.fatture_fornitori.righe=[{id:id(1),numero_fattura:'OLD',data_fattura:'2025-01-01',importo_totale:'100'},{id:id(1),numero_fattura:'OLD',data_fattura:'2025-01-01',importo_totale:'100'}]
 assert.equal(build(f,periodo,null).conti.length,0)
})
