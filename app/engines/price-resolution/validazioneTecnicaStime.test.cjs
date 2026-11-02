/* eslint-disable @typescript-eslint/no-require-imports -- Offline deterministic validation; provider/DB imports forbidden. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { execFileSync } = require('node:child_process')
const cache = new Map(), app = path.resolve(__dirname, '../..')
const quiet = { log() {}, table() {}, group() {}, groupEnd() {}, warn() {} }
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file)
  const m = { exports: {} }; cache.set(file, m.exports)
  const localRequire = id => {
    if (/openai|supabase/.test(id)) throw Error('Provider/DB forbidden in technical validation')
    if (/web-fallback|ai-price-analyst/.test(id)) return new Proxy({}, {get:()=>()=>{throw Error('AI/Web actions forbidden during render')}})
    if (!id.startsWith('.')) return require(id)
    if (['./RicercaPrezziPreventivo', './PrezzoWebVoce', './AnalisiPrezzoVoce'].includes(id)) return { default: () => null, chiaveAnalisiVoce: (_v,i) => String(i) }
    const p = path.resolve(path.dirname(file), id)
    return load([p + '.ts', p + '.tsx', path.join(p, 'index.ts')].find(fs.existsSync))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module: m, exports: m.exports, require: localRequire, console: quiet, Set, Map, Number, Math, Date })
  return m.exports
}
const tech = load(path.join(__dirname, 'validazione-tecnica-stime.ts'))
const api = load(path.join(__dirname, 'stima-documento-ai.ts'))
const voce = (descrizione = 'Eliminazione pavimento interno', quantita = 9, unita_misura = 'mq') => ({ descrizione, quantita, unita_misura,
  prezzo_unitario: 0, bozzaDocumento: true, priceResolution: { strategy: 'no_match', matched: false } })
const ref = (descrizione, unita = 'mq', prezzo = 20) => ({ id: 'ref-test', codice: 'TEST', fonte: 'Test locale', descrizione, unita, prezzo })
const riga = (v, refs = []) => ({ id: 'x', descrizione: v.descrizione, quantita: v.quantita, unita: v.unita_misura,
  contesto_riga: v.descrizione, composita: false, ambito: 'prestazione integrale descritta', riferimenti: refs })
const stima = (r, changes = {}) => ({ prezzo_unitario_proposto: 30, unita_interpretata: r.unita, quantita_coperta_dal_prezzo: 1,
  totale_riga_proposto: 30*r.quantita, motivazione: 'Prezzo per singolo pezzo nella U.M. originale', riferimenti_utilizzati: r.riferimenti.map(r=>r.id),
  lavorazione_composita: r.composita, ...changes })
const analisi = s => ({...s,metodo_calcolo:'analisi_unitaria',totale_componenti:s.prezzo_unitario_proposto,prezzo_unitario_derivato:s.prezzo_unitario_proposto,
  componenti_economiche:(s.componenti_economiche||[{categoria:'demolizione_rimozione',descrizione:'Smontaggio eseguito da operaio',importo_unitario:s.prezzo_unitario_proposto,riferimento_id:null}]).map(c=>({...c,
    quantita_tecnica:0.5,unita_tecnica:c.categoria==='materiale'?'kg':c.categoria==='sicurezza_noli'?'giorni':c.categoria==='smaltimento'?'kg':'h',
    costo_unitario:c.importo_unitario/0.5,subtotale:c.importo_unitario,metodo_calcolo:c.categoria==='materiale'||c.categoria==='smaltimento'?'materiale':c.categoria==='sicurezza_noli'?'nolo':'ore_uomo',
    origine_costo:{tipo:'ipotesi_tecnica_esplicita',descrizione:'Fixture: ipotesi tecnica quantitativa di costo locale da verificare',base_documentale:null}}))})
const giudica = (r, s, tutte = []) => tech.validaTecnicamenteStima(r, s, tutte)
const prova = (r, s, codice) => {
  const result = giudica(r,s)
  assert.notEqual(result.stato, 'accettata'); assert(result.codici.includes(codice), JSON.stringify(result))
  return result
}

for (const [q,d] of [
  ['Realizzazione vespaio aerato con igloo', 'Fornitura e posa barriera paramassi'],
  ['Fornitura e posa controtelaio esterno', 'Fornitura e posa serramento completo PVC'],
  ['Fornitura posa fossa Imhoff', 'Fornitura noleggio impianto Wellpoint'],
  ['Revisione copertura tetto con tegole', 'Smontaggio pavimentazione stradale in basole'],
  ['Posa maiolica rivestimento', 'Fornitura e posa geostuoia antierosiva'],
  ['Fornitura telaio a scomparsa', 'Maggior prezzo alla porta REI per chiudiporta'],
]) test(`riferimento tecnicamente estraneo: ${q}`, () => {
  const r = riga(voce(q), [ref(d)]), classified = tech.classificaRiferimento(r, r.riferimenti[0])
  assert.equal(classified.classificazione, 'incompatibile'); assert.equal(classified.utilizzabile_come_ancoraggio, false)
  assert.equal(prova(r,stima(r),'oggetto_incompatibile').stato, 'scartata')
})
test('metadati preservati e classificazioni ricalcolate, non fidate dal client', () => {
  const kb = [{ codice: 'TEST', descrizione: 'Fornitura e posa pavimento con collante', unita_misura: 'mq', prezzo_unitario: 100, fonte: 'Test locale' }]
  const input = api.preparaInputStimeDocumento([voce('Posa pavimento con collante')], kb)
  const r = input.righe[0].riferimenti[0]
  assert.equal(r.comprende_fornitura, true); assert.equal(r.sola_posa_non_equivalente, true)
  assert.equal(r.classificazione, 'solo_informativo'); assert.equal(typeof r.similarity, 'number'); assert(r.avvisi.length)
  r.classificazione = 'trasferibile'; r.utilizzabile_come_ancoraggio = true
  const parsed = api.validaInputStimeDocumento(input)
  assert.equal(parsed.righe[0].riferimenti[0].classificazione, 'solo_informativo')
  assert.equal(parsed.righe[0].riferimenti[0].utilizzabile_come_ancoraggio, false)
})
test('trasferibile, comparabile, informativo e incompatibile sono stati distinti', () => {
  const r = riga(voce())
  assert.equal(tech.classificaRiferimento(r,ref(r.descrizione)).classificazione, 'trasferibile')
  assert.equal(tech.classificaRiferimento(r,ref('Demolizione pavimento in piastrelle')).classificazione, 'comparabile')
  assert.equal(tech.classificaRiferimento(r,ref('Demolizione pavimento in piastrelle','m3')).classificazione, 'solo_informativo')
  assert.equal(tech.classificaRiferimento(r,ref('Rimozione di apparecchi sanitari')).classificazione, 'incompatibile')
})
for (const [unit, refUnit] of [['mq','m3'],['cad','mq'],['c.u.','mq'],['corpo','kg'],['a corpo','ml']]) {
  test(`nessuna conversione implicita ${refUnit} → ${unit}`, () => {
    const r = riga(voce('Rimozione infissi esterni',3,unit),[ref('Rimozione infissi esterni',refUnit)])
    prova(r,stima(r),'ancoraggio_non_trasferibile')
  })
}
test('corpo intero ambiguo: forfait per molte unità non diventa unitario', () => {
  const r = riga(voce('Adeguamento muro di confine', 8, 'a corpo'))
  prova(r,stima(r,{motivazione:'Prezzo stimato a corpo per 8 unità; pro capite'}),'forfait_quantita_multipla')
})
test('sanitari: contenitori contati nel documento non sono apparecchi', () => {
  const r = riga(voce('Eliminazione sanitari bagno',3,'a corpo'),[ref('Rimozione apparecchi sanitari','cad')])
  r.contesto_riga = 'PIANO TERRA BAGNO: 1. PIANO PRIMO BAGNO: 1. ALTRO BAGNO: 1.'
  assert.equal(prova(r,stima(r,{motivazione:'Prezzo per apparecchio, 3 sanitari distinti'}),'oggetto_unita_diverso').stato,'scartata')
})
test('cad frazionaria/geometrica non viene reinterpretata come superficie', () => {
  const r = riga(voce('Posa pietra lavica', 14.25, 'c.u.'),[ref('Fornitura e collocazione pietra lavica','m2')])
  prova(r,stima(r),'quantita_dimensionale_ambigua')
})
test('singolo infisso autonomo coerente: riferimento diverso di U.M. rimane solo contesto', () => {
  const r = riga(voce('Rimozione infissi esterni',5,'c.u.'),[ref('Rimozione infissi esterni','mq')])
  r.contesto_riga = 'PORTE: 2. FINESTRE: 3.'
  const s = analisi(stima(r,{motivazione:'Prezzo complessivo per singolo pezzo, senza riferimento metrico diretto.'}))
  const result = giudica(r,s)
  assert.equal(result.stato,'accettata'); assert.equal(result.riferimenti_ancoraggio.length,0)
})
test('AI alta non sostituisce la validazione tecnica', () => {
  const r = riga(voce('Realizzazione vespaio aerato'),[ref('Fornitura e posa barriera paramassi')])
  for(const affidabilita of ['alta','media','bassa']) assert.equal(giudica(r,{...stima(r),affidabilita}).stato,'scartata')
})
test('un riferimento già incompatibile non diventa un ancoraggio forte', () => {
  const r=riga(voce(),[{...ref('Demolizione pavimento interno'),compatibilita_um:'incompatibile'}])
  assert.equal(tech.classificaRiferimento(r,r.riferimenti[0]).utilizzabile_come_ancoraggio,false)
  prova(r,stima(r),'ancoraggio_non_trasferibile')
})
test('un avviso locale di fornitura o non trasferibilità resta vincolante', () => {
  const r=riga(voce('Posa pavimento con collante'))
  const riferimento={...ref('Posa pavimento con collante'),avvisi:['Il riferimento comprende fornitura: non equivale alla sola posa']}
  const classified=tech.classificaRiferimento(r,riferimento)
  assert.equal(classified.comprende_fornitura,true);assert.equal(classified.sola_posa_non_equivalente,true)
  assert.equal(classified.utilizzabile_come_ancoraggio,false)
  assert.equal(tech.classificaRiferimento(r,{...ref(r.descrizione),solo_informativo_non_trasferibile:true}).utilizzabile_come_ancoraggio,false)
})
test('ruolo di ancoraggio esplicito non viene reso valido dalla sola frase stima autonoma', () => {
  const r=riga(voce('Rimozione infissi esterni',4,'cad'),[ref('Rimozione infissi esterni','mq')])
  const s=stima(r,{motivazione:'Stima autonoma per singolo pezzo',riferimenti_ancoraggio:['ref-test']})
  prova(r,s,'ancoraggio_non_trasferibile')
})
test('forfait con più punti non può essere reinterpretato come prezzo per punto', () => {
  const r=riga(voce('Impianto condizionamento',7,'a corpo'))
  prova(r,stima(r,{motivazione:'Forfait per impianto standard con 7 punti'}),'forfait_quantita_multipla')
})
test('corpo intero con quantità multipla senza conteggio degli oggetti resta ambiguo', () => {
  const r=riga(voce('Adeguamento muro di confine',5,'a corpo'))
  r.contesto_riga='MURO ESTERNO: 5,00.'
  prova(r,stima(r,{motivazione:'Prezzo per singolo corpo'}),'conteggio_unita_non_documentato')
})
for(const oggetto of ['pavimento','maiolica rivestimento','zoccoletto','pietra lavica']) test(`sola posa ${oggetto}: frase materiale escluso non basta`, () => {
  const r = riga(voce('Posa '+oggetto),[ref('Fornitura e posa '+oggetto)])
  prova(r,stima(r,{motivazione:'Materiale escluso, prezzo per la posa'}),'scorporo_non_dimostrato')
})
test('scorporo verificabile: due riferimenti pertinenti, stessa U.M., residuo esatto', () => {
  const r = riga(voce('Posa pavimento ceramico'),[
    {...ref('Fornitura e posa pavimento ceramico','mq',100),id:'completo'},
    {...ref('Fornitura pavimento ceramico','mq',70),id:'materiale'},
  ])
  const s = stima(r,{riferimenti_ancoraggio:[],scorporo_fornitura:{riferimento_completo_id:'completo',riferimento_materiale_id:'materiale',costo_posa_unitario:30}})
  assert.equal(giudica(r,s).stato,'accettata')
  s.scorporo_fornitura.costo_posa_unitario=29
  prova(r,s,'scorporo_non_dimostrato')
})
test('scorporo aritmeticamente esatto con materiale diverso non è una prova', () => {
  const r=riga(voce('Posa pavimento ceramico'),[
    {...ref('Fornitura e posa pavimento ceramico','mq',100),id:'completo'},
    {...ref('Fornitura pavimento in legno','mq',70),id:'materiale'},
  ])
  const s=stima(r,{riferimenti_ancoraggio:[],scorporo_fornitura:{riferimento_completo_id:'completo',riferimento_materiale_id:'materiale',costo_posa_unitario:30}})
  prova(r,s,'scorporo_non_dimostrato')
})
test('composito senza componenti è sempre sospeso, inclusa una apertura unitaria coerente', () => {
  const r = {...riga(voce('Apertura muratura portante',2,'corpo')),composita:true}
  r.contesto_riga = 'Due aperture singole come da documento'
  const s = stima(r,{motivazione:'Prezzo per singola apertura, quantità due aperture'})
  prova(r,s,'scomposizione_assente')
})
test('composito con componenti coerenti e base documentale è accettabile, anche a quantità zero', () => {
  const r = {...riga(voce('Impianto elettrico completo',0,'a corpo')),composita:true}
  const s = stima(r,{unita_economica:{descrizione:'Un pacchetto completo',base_documentale:r.descrizione},riferimenti_ancoraggio:[],
    componenti_economiche:[{categoria:'posa',descrizione:'Manodopera impiantistica',importo_unitario:20,riferimento_id:null},
      {categoria:'opere_accessorie',descrizione:'Prove funzionali',importo_unitario:10,riferimento_id:null}]})
  Object.assign(s,analisi(s)); assert.equal(giudica(r,s).stato,'accettata'); assert.equal(s.prezzo_unitario_proposto*r.quantita,0)
  s.componenti_economiche[0].importo_unitario=21
  assert.equal(prova(r,s,'somma_componenti_incoerente').stato,'scartata')
})
test('apertura portante con scomposizione completa può essere accettata senza eccezioni di dominio', () => {
  const r={...riga(voce('Allargamento apertura su muratura portante con demolizione, puntellazione, fornitura acciaio, posa e smaltimento',3,'corpo')),composita:true}
  r.contesto_riga='APERTURE: 3.'
  const s=stima(r,{prezzo_unitario_proposto:100,totale_riga_proposto:300,riferimenti_ancoraggio:[],
    unita_economica:{descrizione:'Una singola apertura',base_documentale:'APERTURE: 3.'},
    componenti_economiche:[['demolizione_rimozione','Demolizione controllata',10],['materiale','Profilo acciaio',20],['posa','Posa architrave',30],
      ['opere_accessorie','Fissaggi e ripristini',15],['smaltimento','Smaltimento risulta',5],['sicurezza_noli','Puntellazioni',20]]
      .map(([categoria,descrizione,importo_unitario])=>({categoria,descrizione,importo_unitario,riferimento_id:null}))})
  Object.assign(s,analisi(s)); assert.equal(giudica(r,s).stato,'accettata')
  s.componenti_economiche.pop();s.prezzo_unitario_proposto=80;s.totale_riga_proposto=240
  prova(r,s,'componente_necessaria_assente')
})
test('duplicati di componenti/riferimenti non passano come pacchetto completo', () => {
  const r = {...riga(voce('Facciata completa')),composita:true}
  const s = stima(r,{componenti_economiche:[
    {categoria:'posa',descrizione:'Rasatura armata',importo_unitario:10,riferimento_id:'uguale'},
    {categoria:'posa',descrizione:'Rasatura armata completa',importo_unitario:20,riferimento_id:'uguale'},
  ]})
  prova(r,s,'componente_duplicata'); prova(r,s,'perimetro_componente_duplicato')
})
for(const [q,other,code] of [
  ['Ripristino facciata compreso ponteggio','Approntamento ponteggio metallico','ponteggio'],
  ['Revisione tetto compreso ponteggio','Approntamento ponteggio metallico','ponteggio'],
  ['Adeguamento muro di confine con ringhiera','Fornitura posa ringhiera in ferro','ringhiera'],
  ['Fornitura posa ringhiera compresa verniciatura','Pittura della ringhiera','verniciatura'],
]) test(`sovrapposizione ${code}: serve esclusione esplicita e coerente`, () => {
  const r = riga(voce(q)), s = stima(r,{riferimenti_ancoraggio:[],componenti_economiche:[
    {categoria:'posa',descrizione:'Lavori ordinari',importo_unitario:20,riferimento_id:null},
    {categoria:'opere_accessorie',descrizione:'Verifiche finali',importo_unitario:10,riferimento_id:null}]})
  const ctx=[{id:'altra',descrizione:other,unita:'mq',quantita:2}]
  assert(giudica(r,s,ctx).codici.includes('sovrapposizione_'+code))
  s.esclusioni_componenti=[{componente:code,voce_copertura_id:'altra',motivazione:'Componente interamente quotata nella voce autonoma e qui esclusa'}]
  assert(!giudica(r,s,ctx).codici.includes('sovrapposizione_'+code))
  s.componenti_economiche[0].descrizione=code
  assert(giudica(r,s,ctx).codici.includes('sovrapposizione_'+code))
})

test('perimetro protetto: parser, resolver, modello, writer e route invariati',()=>{
  const root=path.dirname(app),base='ca7c71cca5d4abadd9e9953f9d66e6110548f756'
  for(const file of ['app/api/prezzi/analisi-ai/route.ts','app/engines/price-resolution/resolver.ts','app/engines/price-resolution/normalizer.ts',
    'app/engines/price-resolution/riferimenti-locali.ts','app/engines/document-parser/header-detector.ts',
    'app/engines/document-intelligence/pdf-ocr.ts','app/api/prezzi/web/route.ts']){
    assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',`${base}:${file}`],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),file)
  }
  assert.equal(api.modelloStimeDocumento,'gpt-4.1-mini')
})
