const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const load=name=>{const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e,n=>n.includes('rapportinoOperai')?{calcolaOreNetteTimbratura:()=>4}:load(n.replace('./','')));return e}
const model=load('salvataggioBozzaV1')
const S='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',O='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',V='cccccccc-cccc-4ccc-8ccc-cccccccccccc',R='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const cache={cantiere_id:S,stato:'pronte',varianti:[{id:V,numero:1,etichetta:'Variante',selezionabile:true}]}
const row=(key,economy=false)=>({prestazione_id:null,chiave_client:key,operaio_id:O,ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:30,lavoro_in_economia:economy,variante_id:economy?V:null})
const draft=()=>({versione_contratto:1,rapportino_id:null,revisione_attesa:null,cantiere_id:S,data:'2026-09-30',documento:{note:'Lavori',materiali:'Cemento',quantita_materiali:'5'},prestazioni:{nuove:[row('one'),row('two',true)],aggiornate:[],rimosse:[]}})
test('builder creazione: contratto esatto, nessun campo autorevole, stesso operaio e modalità diverse',()=>{
  const b=draft();b.prestazioni.nuove[0].ore=100;b.prestazioni.nuove[0].foto=['non inviare'];b.documento.costo=99
  const attempt=model.creaTentativoSalvataggioV1(b,cache,()=>R)
  assert.deepEqual(JSON.parse(attempt.corpo),{versione_contratto:1,richiesta_id:R,rapportino_id:null,revisione_attesa:null,cantiere_id:S,data:'2026-09-30',documento:{note:'Lavori',materiali:'Cemento',quantita_materiali:'5'},prestazioni:{nuove:[row('one'),row('two',true)],aggiornate:[],rimosse:[]}})
})
test('tentativo immutabile: genera UUID una volta e conserva payload/chiavi dopo modifiche alla bozza',()=>{
  let generated=0;const b=draft(),attempt=model.creaTentativoSalvataggioV1(b,cache,()=>{generated++;return R}),body=attempt.corpo
  b.documento.note='Diverso';b.prestazioni.nuove[0].chiave_client='altro'
  assert.equal(generated,1);assert.equal(attempt.corpo,body);assert.equal(attempt.payload.prestazioni.nuove[0].chiave_client,'one')
  assert(Object.isFrozen(attempt));assert(Object.isFrozen(attempt.payload));assert(Object.isFrozen(attempt.payload.documento));assert(Object.isFrozen(attempt.payload.prestazioni.nuove[0]))
})
test('validazione completa: almeno una riga, UUID, contesto Variante, nessuna modifica persistente',()=>{
  assert(model.bozzaV1Salvabile(draft(),cache))
  for(const change of [b=>b.prestazioni.nuove=[],b=>b.prestazioni.nuove[1].variante_id=null,b=>b.prestazioni.nuove[0].variante_id=V,b=>b.prestazioni.nuove[0].operaio_id='bad',b=>b.data='2026-02-30',b=>b.prestazioni.nuove[1].chiave_client='one',b=>b.prestazioni.rimosse=[R],b=>b.prestazioni.aggiornate=[row('old')],b=>b.prestazioni.nuove[0].ora_fine='07:00']){const b=draft();change(b);assert.equal(model.bozzaV1Salvabile(b,cache),false);assert.throws(()=>model.creaTentativoSalvataggioV1(b,cache,()=>R))}
  for(const c of [{...cache,stato:'caricamento'},{...cache,stato:'errore'},{...cache,cantiere_id:O},{...cache,varianti:[{...cache.varianti[0],selezionabile:false}]}])assert.equal(model.bozzaV1Salvabile(draft(),c),false)
  const b=draft();b.prestazioni.nuove=[row('ordinary')];assert(model.bozzaV1Salvabile(b,{cantiere_id:'',stato:'errore',varianti:[]}))
})
test('risultato autorevole: validazione contesto/UUID/revisione e rifiuto costi aggiuntivi',()=>{
  const result={versione_contratto:1,rapportino_id:R,revisione:7,cantiere_id:S,data:'2026-09-30',documento:draft().documento,prestazioni:[{...row('one'),prestazione_id:V,operaio_nome:'Mario',ore:3.5,revisione:1,rimossa_at:null}]}
  assert(model.esitoCreazioneV1Valido(result,draft()))
  for(const change of [{rapportino_id:'bad'},{revisione:-1},{data:'2026-10-01'},{cantiere_id:O},{costo:12}])assert.equal(model.esitoCreazioneV1Valido({...result,...change},draft()),false)
})

const bozzaModel=load('bozzaRapportinoV1')
const P1='11111111-1111-4111-8111-111111111111',P2='22222222-2222-4222-8222-222222222222',P3='33333333-3333-4333-8333-333333333333',P4='44444444-4444-4444-8444-444444444444'
const persisted=(key,id,economy=false,variante_id=economy?V:null,removed=null)=>({...row(key,economy),prestazione_id:id,variante_id,operaio_nome:'Mario',ore:3.5,revisione:2,rimossa_at:removed})
const baseline=()=>({versione_contratto:1,rapportino_id:R,revisione:7,cantiere_id:S,data:'2026-09-30',documento:draft().documento,prestazioni:[persisted('one',P1),persisted('two',P2,true),persisted('three',P3,true,null),persisted('removed',P4,false,null,'2026-09-29T08:00:00Z')]})
const historicalCache={...cache,varianti:[{...cache.varianti[0],selezionabile:false}]}
test('rilettura: documento, identità, revisioni e righe rimosse conservati; nessuna deduplicazione per operaio',()=>{
  const original=baseline(),b=bozzaModel.ricostruisciBozzaRapportinoV1(original),active=bozzaModel.prestazioniAttiveBozza(b)
  assert.deepEqual(b.documento,original.documento);assert.equal(b.rapportino_id,R);assert.equal(b.revisione_attesa,7)
  assert.equal(active.length,3);assert(active.every(p=>p.operaio_id===O));assert.equal(b.baseline.prestazioni.length,4)
  assert.equal(active[0].prestazione_id,P1);assert.equal(active[0].chiave_client,'one');assert.equal(active[0].revisione,2)
  assert.deepEqual(b.prestazioni,{nuove:[],aggiornate:[],rimosse:[]})
  original.prestazioni[0].chiave_client='manomessa';assert.equal(b.baseline.prestazioni[0].chiave_client,'one');assert(Object.isFrozen(b.baseline.prestazioni[0]))
})
test('tracking: solo modifiche effettive, revert, rimozione persistente e rimozione nuova',()=>{
  let b=bozzaModel.ricostruisciBozzaRapportinoV1(baseline())
  b=bozzaModel.modificaPrestazioneBozza(b,'one',{ora_fine:'13:00'});assert.equal(b.prestazioni.aggiornate.length,1);assert.equal(b.prestazioni.aggiornate[0].prestazione_id,P1)
  b=bozzaModel.modificaPrestazioneBozza(b,'one',{ora_fine:'12:00'});assert.equal(b.prestazioni.aggiornate.length,0)
  b=bozzaModel.modificaPrestazioneBozza(b,'one',{pausa_minuti:20});b=bozzaModel.rimuoviPrestazioneBozza(b,'one')
  assert.deepEqual(b.prestazioni.rimosse,[P1]);assert.equal(b.prestazioni.aggiornate.length,0);assert.equal(b.baseline.prestazioni[0].rimossa_at,null)
  b=bozzaModel.rimuoviPrestazioneBozza(b,'one');assert.deepEqual(b.prestazioni.rimosse,[P1])
  b=bozzaModel.aggiungiPrestazioneBozza(b,'new');b=bozzaModel.rimuoviPrestazioneBozza(b,'new');assert.equal(b.prestazioni.nuove.length,0);assert.deepEqual(b.prestazioni.rimosse,[P1])
  assert.throws(()=>bozzaModel.aggiungiPrestazioneBozza(b,'removed'))
})
test('cambio operaio persistente: rimozione + nuova identità, nessuna aggiornata con operaio diverso',()=>{
  let b=bozzaModel.ricostruisciBozzaRapportinoV1(baseline());let calls=0
  b=bozzaModel.modificaPrestazioneBozza(b,'one',{operaio_id:S},()=>{calls++;return 'replacement'})
  assert.equal(calls,1);assert.deepEqual(b.prestazioni.rimosse,[P1]);assert.equal(b.prestazioni.aggiornate.length,0)
  assert.equal(b.prestazioni.nuove[0].prestazione_id,null);assert.equal(b.prestazioni.nuove[0].chiave_client,'replacement');assert.equal(b.prestazioni.nuove[0].operaio_id,S)
  assert.equal(b.prestazioni.nuove[0].ora_inizio,'08:00');assert.equal(b.baseline.prestazioni[0].operaio_id,O)
})
test('payload modifica esatto: UUID/revisione autorevoli, nuove/aggiornate/rimosse e nessuna reinserzione storica',()=>{
  let b=bozzaModel.ricostruisciBozzaRapportinoV1(baseline())
  b=bozzaModel.modificaPrestazioneBozza(b,'one',{ora_fine:'13:00'});b=bozzaModel.rimuoviPrestazioneBozza(b,'two')
  b=bozzaModel.aggiungiPrestazioneBozza(b,'new');b=bozzaModel.modificaPrestazioneBozza(b,'new',{operaio_id:O,ora_inizio:'13:00',ora_fine:'17:00'})
  const a=model.creaTentativoSalvataggioV1(b,historicalCache,()=>V),p=JSON.parse(a.corpo)
  assert.equal(p.rapportino_id,R);assert.equal(p.revisione_attesa,7);assert.equal(p.richiesta_id,V)
  assert.deepEqual(p.prestazioni,{nuove:[{prestazione_id:null,chiave_client:'new',operaio_id:O,ora_inizio:'13:00',ora_fine:'17:00',pausa_minuti:0,lavoro_in_economia:false,variante_id:null}],aggiornate:[{...row('one'),prestazione_id:P1,ora_fine:'13:00'}],rimosse:[P2]})
  assert.equal(p.data,'2026-09-30');assert(!a.corpo.includes('operaio_nome'));assert(!a.corpo.includes('rimossa_at'));assert(!a.corpo.includes('removed'))
  b.documento.note='Nuovo intento';assert.equal(a.payload.documento.note,'Lavori')
})
test('Variante storica: invariata e orari modificati preservano collegamento non selezionabile; nuovi collegamenti vietati',()=>{
  let b=bozzaModel.ricostruisciBozzaRapportinoV1(baseline())
  assert(model.bozzaV1Salvabile(b,historicalCache));b=bozzaModel.modificaPrestazioneBozza(b,'two',{ora_fine:'13:00'})
  assert(model.bozzaV1Salvabile(b,{cantiere_id:S,stato:'errore',varianti:[]}));assert.equal(b.prestazioni.aggiornate[0].variante_id,V)
  const a=model.creaTentativoSalvataggioV1(b,historicalCache,()=>R);assert.equal(a.payload.prestazioni.aggiornate[0].variante_id,V)
  b=bozzaModel.aggiungiPrestazioneBozza(b,'new-economy');b=bozzaModel.modificaPrestazioneBozza(b,'new-economy',{operaio_id:O,ora_inizio:'13:00',ora_fine:'17:00',lavoro_in_economia:true});b=bozzaModel.modificaPrestazioneBozza(b,'new-economy',{variante_id:V})
  assert.equal(model.bozzaV1Salvabile(b,historicalCache),false)
})
test('Economia storica NULL: invariata/documento preservati; modifica richiede Variante; nessuna conversione automatica',()=>{
  let b=bozzaModel.ricostruisciBozzaRapportinoV1(baseline());b={...b,documento:{...b.documento,note:'Solo documento'}}
  assert(model.bozzaV1Salvabile(b,historicalCache));assert.equal(model.creaTentativoSalvataggioV1(b,historicalCache,()=>R).payload.prestazioni.aggiornate.length,0)
  b=bozzaModel.modificaPrestazioneBozza(b,'three',{ora_fine:'13:00'});assert.equal(model.bozzaV1Salvabile(b,cache),false);assert.equal(b.prestazioni.aggiornate[0].variante_id,null)
  b=bozzaModel.modificaPrestazioneBozza(b,'three',{variante_id:V});assert(model.bozzaV1Salvabile(b,cache));assert.equal(b.baseline.prestazioni[2].variante_id,null)
})
test('aggiornate non possono alterare identità, risuscitare righe, duplicare UUID o sovrapporsi a rimosse',()=>{
  for(const alter of [b=>b.prestazioni.aggiornate=[{...persisted('one',P1),operaio_id:S}],b=>b.prestazioni.aggiornate=[{...persisted('one',P1),chiave_client:'changed'}],b=>b.prestazioni.aggiornate=[persisted('removed',P4)],b=>b.prestazioni.rimosse=[P4],b=>b.prestazioni.rimosse=[P1,P1],b=>b.prestazioni.aggiornate=[persisted('one',P1),persisted('one',P1)],b=>{b.prestazioni.aggiornate=[persisted('one',P1)];b.prestazioni.rimosse=[P1]},b=>b.revisione_attesa=6]){
    const b=bozzaModel.ricostruisciBozzaRapportinoV1(baseline());alter(b);assert.equal(model.bozzaV1Salvabile(b,cache),false)
  }
})
