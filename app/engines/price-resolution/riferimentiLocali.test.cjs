/* eslint-disable @typescript-eslint/no-require-imports -- Local node:test harness for TypeScript and React SSR. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  const localRequire = id => {
    if (!id.startsWith('.')) return require(id)
    if (['./RicercaPrezziPreventivo', './PrezzoWebVoce', './AnalisiPrezzoVoce'].includes(id)) {
      return { default: () => null, chiaveAnalisiVoce: (_v, i) => String(i) }
    }
    if (id.endsWith('/ai-price-analyst') || id.endsWith('/web-fallback')) {
      return new Proxy({}, { get: () => () => { throw new Error('AI/Web forbidden in local render test') } })
    }
    const base = path.resolve(path.dirname(file), id)
    return load([base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(fs.existsSync))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: loaded, exports: loaded.exports, require: localRequire, console, Date, Number, Math, Set, Map })
  cache.set(file, loaded.exports)
  return loaded.exports
}
const { creaIndiceRiferimentiLocali, riferimentiLocaliDaVerificare } = load(path.join(__dirname, 'riferimenti-locali.ts'))
const { resolvePrice } = load(path.join(__dirname, 'resolver.ts'))
const { esitoDiagnosticaVoce, modificaVoceDiagnostica } = load(path.join(__dirname, 'diagnostica-voce.ts'))
const app = path.resolve(__dirname, '../..')
const Riferimenti = load(path.join(app, 'components/RiferimentiLocaliPrezzo.tsx')).default
const ref = (codice, descrizione, unita_misura, prezzo_unitario, fonte = 'Regione Sicilia') => Object.freeze({ codice, descrizione, unita_misura, prezzo_unitario, fonte })
const kb = Object.freeze([
  ref('SIC24_21.1.5.1', 'Demolizione di muratura di qualsiasi tipo, compresi gli eventuali rivestimenti e intonaci, escluso il trasporto a rifiuto', 'm3', 306.75),
  ref('SIC24_21.1.16', 'Rimozione di infissi interni od esterni di ogni specie, inclusi mostre, succieli, telai, compresi il carico del materiale, escluso il trasporto', 'm2', 16.75),
  ref('SIC24_3.7.9', 'Fornitura e posa in opera di malta cementizia bicomponente a basso modulo elastico per impermeabilizzazione di solai, balconi e strutture. Applicata in due mani con rete in fibra di vetro alcali resistente, previa preparazione del supporto, compresi sfridi, adesivi, bandelle e pezzi speciali.', 'm2', 31.5),
  ref('SIC24_26.1.1.1', 'Approntamento di ponteggio in elementi portanti metallici sistema a telaio, nolo manutenzione controllo per i primi 30 giorni', 'm2', 8.68),
  ref('ART_47d526f0-a96c-460b-93df-22e9baa9a5a6', 'Montaggio e smontaggio ponteggio metallico completo in sicurezza, compresi oneri di posa, certificazioni e manutenzione durante i lavori', 'm2', 22.2, 'ARTECNA'),
  ref('SIC24_5.1.12.2', 'Fornitura e collocazione di pavimento in cotto siciliano, posa in opera con collanti e malta di cemento, compreso livellamento sottofondo e stuccatura', 'm2', 89.95),
  ref('ART_RASATURA', 'Ciclo di rasatura armata con rete in fibra di vetro, rasante cementizio in due mani e finitura', 'm2', 27.76, 'ARTECNA'),
  ref('SIC24_8.1.5.2', 'Fornitura e posa in opera di serramenti esterni con profili estrusi alluminio a taglio termico, vetri camera e controtelai', 'm2', 577.2),
  ref('VETRO', 'Fornitura e posa in opera con stuccatura e quanto occorre per dare opera finita a regola arte: lastre di vetro', 'm2', 30.87),
])
const indice = creaIndiceRiferimentiLocali(kb)
const voce = (descrizione, unita_misura = 'mq') => ({ descrizione, unita_misura, quantita: 10, prezzo_unitario: 0, priceResolution: { strategy: 'no_match', matched: false, confidence: 0 } })
const casi = {
  demolizione: voce("Demolizione delle tramezzature esistenti, compreso carico sul cassone e trasporto in pubblica discarica"),
  infissi: voce('Rimozione infissi esterni esistenti, telai e vetri, carico trasporto conferimento in discarica', 'c.u.'),
  impermeabilizzazione: voce('Fornitura e posa in opera di impermeabilizzazione con malta tipo Mapei o similari con due strati e rete'),
  ponteggio: voce('Approntamento di ponteggio in elementi portanti metallici sistema a telaio, compreso il nolo manutenzione e controllo per tutto il tempo necessario ai lavori'),
  pavimento: voce('Posa in opera di pavimento, collante e stuccatura di fuga in conformità ai disegni di progetto'),
  facciata: voce('Ripristino facciata esterna con rimozione intonaco, trattamento ferri, nuovo intonaco, rasatura armata con rete e finitura al silicato'),
  serramenti: voce('Fornitura e posa serramenti esterni alluminio color legno a taglio termico spessore 64 mm con vetri camera 4/20/4 argon', 'corpo'),
}
const trova = v => riferimentiLocaliDaVerificare(v, indice)
test('demolizione: riferimenti di rimozione pertinenti, non tramezzi nuovi o vetri', () => {
  const r = trova(casi.demolizione)
  assert(r.some(c => c.codice === 'SIC24_21.1.5.1'))
  assert(r.every(c => c.codice !== 'VETRO'))
})
test('oneri accessori/esclusi non trasformano rinforzi o solai in demolizioni tramezzi o ponteggi', () => {
  const prezzi = [
    ref('SOLAIO', 'Demolizione di solai misti di laterizio e cemento armato, compresi taglio ferri', 'm2', 54.75),
    ref('RINFORZO', 'Sistema di rinforzo strutturale di muratura con fibre. Sono esclusi trattamenti di demolizione delle parti ammalorate', 'm2', 282.65),
    ref('FRCM', 'Fornitura e posa di connessione per rinforzo strutturale di muratura. Sono compresi i ponteggi e attrezzature', 'm2', 136),
    ...kb,
  ]
  const idx = creaIndiceRiferimentiLocali(prezzi)
  for (const v of [casi.demolizione, casi.ponteggio]) {
    assert(!riferimentiLocaliDaVerificare(v, idx).some(c => ['SOLAIO', 'RINFORZO', 'FRCM'].includes(c.codice)))
  }
})
test('infissi: c.u. e m² restano incompatibili', () => {
  const r = trova(casi.infissi).find(c => c.codice === 'SIC24_21.1.16')
  assert.equal(r.compatibilitaUm, 'incompatibile')
  assert(r.avvisi.includes('U.M. incompatibile'))
})
test('impermeabilizzazione: S3.7.9 emerge con similarity bassa senza soglia automatica', () => {
  const r = trova(casi.impermeabilizzazione).find(c => c.codice === 'SIC24_3.7.9')
  assert(r)
  assert(r.somiglianza < .6)
  assert.equal(r.prezzo, 31.5)
})
test('ponteggio: fonte ARTECNA e Sicilia entrambe presenti, 22,20 €/m² solo informativo', () => {
  const r = trova(casi.ponteggio)
  assert(r.some(c => c.fonte === 'ARTECNA' && c.prezzo === 22.2))
  assert(r.some(c => c.codice === 'SIC24_26.1.1.1'))
})
test('sola posa: avviso esplicito sulla fornitura e nessun candidato vetro', () => {
  const r = trova(casi.pavimento)
  assert(r.some(c => c.avvisi.some(a => a.includes('non equivale alla sola posa'))))
  assert(!r.some(c => c.codice === 'VETRO'))
})
test('facciata: componenti distinti da una prestazione completa', () => {
  assert(trova(casi.facciata).some(c => c.avvisi.some(a => a.startsWith('Prestazione composita'))))
})
test('serramenti: riferimento Sicilia presente, corpo vs m² evidenziato', () => {
  const r = trova(casi.serramenti).find(c => c.codice === 'SIC24_8.1.5.2')
  assert(r)
  assert.equal(r.compatibilitaUm, 'incompatibile')
})
test('nessuna mutazione, applicazione prezzo o cambiamento di esito/subtotale', () => {
  for (const v of Object.values(casi)) {
    const prima = JSON.stringify(v), esito = esitoDiagnosticaVoce(v)
    const r = trova(Object.freeze(v))
    assert(r.length > 0 && r.length <= 5)
    assert.equal(JSON.stringify(v), prima)
    assert.equal(esitoDiagnosticaVoce(v), esito)
    assert.equal(esito, 'unresolved')
    assert.equal(v.quantita * v.prezzo_unitario, 0)
  }
})
test('no_match solamente: nessuna lista per resolved/review/AI/diagnostica assente o invalidata', () => {
  for (const extra of [
    { priceResolution: { strategy: 'similarity', matched: true } },
    { priceResolution: { strategy: 'ai_fallback', matched: false } },
    { priceResolution: { strategy: 'no_match', matched: true } },
    { priceResolution: undefined }, { priceResolutionInvalidated: true },
  ]) assert.equal(trova({ ...casi.ponteggio, ...extra }).length, 0)
})
test('modifica manuale invalida la diagnostica e nasconde riferimenti precedenti', () => {
  const cambiata = modificaVoceDiagnostica(casi.ponteggio, 'descrizione', 'Altra prestazione')
  assert.equal(trova(cambiata).length, 0)
  assert.equal(esitoDiagnosticaVoce(cambiata), 'modified')
})
test('niente riferimenti se mancano pertinenza tecnica o dati validi', () => {
  assert.equal(trova(voce('Fornitura e posa in opera a regola arte')).length, 0)
  assert.equal(trova(voce('')).length, 0)
  assert.equal(riferimentiLocaliDaVerificare(casi.ponteggio, creaIndiceRiferimentiLocali([ref('X', 'ponteggio', 'm2', NaN)])).length, 0)
})
test('massimo cinque e deduplicazione della stessa fonte/riferimento', () => {
  const extra = Array.from({ length: 12 }, (_, i) => ref('P' + i, 'Ponteggio a telaio con montaggio', 'm2', i + 1))
  const r = riferimentiLocaliDaVerificare(casi.ponteggio, creaIndiceRiferimentiLocali([...kb, ...kb, ...extra]))
  assert.equal(r.length, 5)
  assert.equal(new Set(r.map(c => c.fonte + c.codice)).size, 5)
})
test('fonte non forza il primo posto: Sicilia più pertinente precede ARTECNA', () => {
  const prezzi = [ref('ART_X', 'Ponteggio metallico', 'm3', 1, 'ARTECNA'), ref('SIC24_X', casi.ponteggio.descrizione, 'mq', 2)]
  const r = riferimentiLocaliDaVerificare(casi.ponteggio, creaIndiceRiferimentiLocali(prezzi))
  assert.equal(r[0].fonte, 'Regione Sicilia')
})
test('U.M. assente non viene rappresentata come compatibilità certa', () => {
  const r = riferimentiLocaliDaVerificare(casi.ponteggio, creaIndiceRiferimentiLocali([ref('X', 'Ponteggio a telaio', null, 1)]))
  assert.equal(r[0].compatibilitaUm, 'non verificabile')
})
test('render: fonti, prezzi, somiglianza e avvisi, nessun controllo che applica o salva', () => {
  const html = renderToStaticMarkup(React.createElement(Riferimenti, { riferimenti: trova(casi.ponteggio) }))
  for (const testo of ['Riferimenti locali da verificare', 'ARTECNA', 'Regione Sicilia', '22,20', 'Somiglianza testuale', 'nessun prezzo applicato']) assert(html.includes(testo))
  assert(!/<button|<input|<form/.test(html))
  const mismatch = renderToStaticMarkup(React.createElement(Riferimenti, { riferimenti: trova(casi.infissi) }))
  assert(mismatch.includes('U.M. incompatibile'))
  assert.equal(renderToStaticMarkup(React.createElement(Riferimenti, { riferimenti: [] })), '')
})
test('regressione resolver: riferimenti non alterano le cinque strategie o gli esiti', () => {
  const input = { descrizione: casi.impermeabilizzazione.descrizione, unitaMisura: 'mq', codice: '38.19' }
  const prima = resolvePrice(input, kb)
  trova(casi.impermeabilizzazione)
  assert.deepEqual(resolvePrice(input, kb), prima)
  assert.equal(prima.evaluatedStrategies, 5)
  assert.equal(prima.strategy, 'no_match')
})
test('revisione reale: lista collegata alla stessa KB, contatori e subtotale invariati', () => {
  const Panel = load(path.join(app, 'components/RevisionePreventivoAiPanel.tsx')).default
  const risolta = { descrizione: 'Voce già risolta', unita_misura: 'mq', quantita: 2, prezzo_unitario: 30.3,
    priceResolution: { strategy: 'similarity', matched: true, confidence: .971, prezzoUnitarioRisolto: 30.3 } }
  const voci = [risolta, casi.ponteggio, casi.infissi], prima = JSON.stringify(voci)
  const vietato = () => { throw new Error('Nessuna modifica o persistenza ammessa durante il render') }
  const props = {
    messaggioAi: '', descrizionePreventivoAi: '', setDescrizionePreventivoAi: vietato,
    vociPreventivoAi: voci, setVociPreventivoAi: vietato, vociPreventivoAiOriginali: voci,
    prezziRiferimento: kb, memoriaRiferimento: [], calcolaMediaPrezziSimili: () => null, verificaPrezzoAnomalo: () => '',
    formatMoney: n => Number(n).toFixed(2), miglioraVocePreventivoAi: vietato, salvaInMemoriaPrezzi: vietato,
    generaExcelDefinitivoPreventivoAi: vietato, salvaRevisionePreventivoAi: vietato,
    preventivoRegistroCantiere: '', setMostraRevisionePreventivoAi: vietato,
    excelTable: {}, excelTh: {}, excelTd: {}, buttonPrimary: {}, buttonSecondary: {},
  }
  const render = prezzi => renderToStaticMarkup(React.createElement(Panel, { ...props, prezziRiferimento: prezzi }))
  const before = render([]), after = render(kb)
  for (const html of [before, after]) {
    assert.match(html, /Risolte automaticamente<\/dt><dd[^>]*>1<\/dd>/)
    assert.match(html, /Da verificare<\/dt><dd[^>]*>0<\/dd>/)
    assert.match(html, /Non risolte<\/dt><dd[^>]*>2<\/dd>/)
    assert.match(html, /Sub totale preventivo<\/span><span>60.60<\/span>/)
  }
  assert(!before.includes('Riferimenti locali da verificare'))
  assert.equal((after.match(/Riferimenti locali da verificare/g) || []).length, 2)
  assert(after.includes('Riferimenti disponibili da verificare: 2 lavorazioni'))
  assert(after.includes('U.M. incompatibile'))
  assert.equal(JSON.stringify(voci), prima)
})

// Optional, read-only regression against the historical files supplied by the user.
test('snapshot storico reale: 39 input, 3 risolte/36 no_match invariati e sette casi coperti', { skip: !process.env.ARTECNA_LOCAL_PRICE_SNAPSHOT }, () => {
  const crypto = require('node:crypto'), XLSX = require('xlsx')
  const bytes = fs.readFileSync(process.env.ARTECNA_LOCAL_PRICE_SNAPSHOT)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '55d8aec1e6255bbb0fe7f2a6d450d9f2730d7b1201971280be026e38f36a8d97')
  const book = XLSX.read(bytes.toString('utf8'), { type: 'string', raw: true })
  const prezzi = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null }).map(r => ({ ...r, unita_misura: r.unita_misura === '\\N' ? null : r.unita_misura, prezzo_unitario: Number(r.prezzo_unitario) }))
  assert.equal(prezzi.length, 12706)
  assert.equal(prezzi.find(p => p.codice === 'SIC24_21.9.7').unita_misura, 'm²')
  const file = XLSX.read(fs.readFileSync(process.env.ARTECNA_LOCAL_COMPUTO), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(file.Sheets[file.SheetNames[0]], { header: 1 }).slice(1)
  assert.equal(rows.length, 39)
  const idx = creaIndiceRiferimentiLocali(prezzi)
  const risultati = rows.map(r => {
    const input = { codice: String(r[1]), descrizione: r[2], unitaMisura: r[4], quantita: r[5] }
    const resolution = resolvePrice(input, prezzi)
    const voce = { descrizione: input.descrizione, unita_misura: input.unitaMisura, quantita: input.quantita, prezzo_unitario: resolution.prezzoUnitario || 0, priceResolution: resolution }
    const before = JSON.stringify(voce), refs = riferimentiLocaliDaVerificare(voce, idx)
    assert.equal(JSON.stringify(voce), before)
    return { voce, refs }
  })
  assert.equal(risultati.filter(r => r.voce.priceResolution.matched).length, 3)
  assert.equal(risultati.filter(r => esitoDiagnosticaVoce(r.voce) === 'unresolved').length, 36)
  assert.equal(risultati[0].refs.some(c => /demolizion/i.test(c.descrizione)), true)
  assert(risultati[1].refs.some(c => /infissi/i.test(c.descrizione) && c.compatibilitaUm === 'incompatibile'))
  assert(risultati[17].refs.some(c => c.codice === 'SIC24_3.7.9'))
  assert(risultati[32].refs.some(c => c.fonte === 'ARTECNA' && c.prezzo === 22.2))
  assert(risultati[32].refs.some(c => c.codice.startsWith('SIC24_26.1.1.')))
  assert(risultati[19].refs.every(c => !/lastre di vetro/i.test(c.descrizione)))
  assert(risultati[31].refs.some(c => c.avvisi.some(a => a.startsWith('Prestazione composita'))))
  assert(risultati[36].refs.some(c => /serramenti/i.test(c.descrizione) && c.compatibilitaUm === 'incompatibile'))
  console.log('Snapshot storico: 39 input, 3 risolte, 36 no_match. Prezzi e totale invariati.')
  for (const n of [1,18,33]) console.log(JSON.stringify({ voce: n, riferimenti: risultati[n - 1].refs.map(c => ({ codice: c.codice, fonte: c.fonte, prezzo: c.prezzo, um: c.unitaMisura, somiglianza: c.somiglianza })) }))
})
