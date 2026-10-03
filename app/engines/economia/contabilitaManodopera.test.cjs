// Eseguire: node --test app/engines/economia/contabilitaManodopera.test.cjs
// Usa il TypeScript già installato: nessuna dipendenza o modifica a package.json.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const exportsHelper = {}
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, 'contabilitaManodopera.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS } }
).outputText, { exports: exportsHelper })
const { contabilizzaManodopera, classificaTimbraturaContabile } = exportsHelper
const calcola = (rapportini, timbrature, callback = t => t.costoOperativo) =>
  contabilizzaManodopera({ rapportini, timbrature, calcolaCostoOperativoTimbratura: callback })

test('Rapportino Mario 100 + timbratura collegata 100 = 100', () => {
  const r = calcola([{ costo_manodopera: 5 * 20 }], [{ rapportino_id: 'rap-1', costoOperativo: 5 * 20 }])
  assert.equal(r.costoRapportini, 100)
  assert.equal(r.costoTimbratureIndipendenti, 0)
  assert.equal(r.costoTotaleManodoperaContabile, 100)
})
test('Rapportino 100 + timbratura indipendente 60 = 160', () => {
  const r = calcola([{ costo_manodopera: 100 }], [{ costoOperativo: 60 }])
  assert.equal(r.costoTimbratureIndipendenti, 60)
  assert.equal(r.costoTotaleManodoperaContabile, 160)
})
test('Nessun Rapportino + timbratura indipendente 100 = 100', () => {
  assert.equal(calcola([], [{ costoOperativo: 100 }]).costoTotaleManodoperaContabile, 100)
})
test('rapportino_id prevale sullo stato: zero anche senza Rapportino caricato', () => {
  const t = { rapportino_id: 42, stato: 'indipendente', costoOperativo: 100 }
  assert.equal(classificaTimbraturaContabile(t), 'rapportino')
  assert.equal(calcola([], [t], () => { throw Error('Callback non deve essere chiamato') }).costoTotaleManodoperaContabile, 0)
})
test('legacy da rapportino senza ID: zero e anomalia identificabile', () => {
  const t = { id: 'tim-1', rapportino_id: null, stato: 'da rapportino', costoOperativo: 100 }
  const r = calcola([], [t])
  assert.equal(classificaTimbraturaContabile(t), 'rapportino_legacy')
  assert.equal(r.costoTotaleManodoperaContabile, 0)
  assert.equal(r.anomalie.length, 1)
  assert.equal(r.anomalie[0].codice, 'timbratura_da_rapportino_senza_id')
  assert.equal(r.anomalie[0].indiceTimbratura, 0)
  assert.equal(r.anomalie[0].timbraturaId, 'tim-1')
})
test('timbrature indipendenti multiple: tutte contabilizzate', () => {
  assert.equal(calcola([], [20, 30, 50].map(costoOperativo => ({ costoOperativo }))).costoTotaleManodoperaContabile, 100)
})
test('stato legacy normalizzato e ID vuoto: ancora zero', () => {
  assert.equal(classificaTimbraturaContabile({ rapportino_id: ' ', stato: ' DA   RAPPORTINO ' }), 'rapportino_legacy')
})
test('stesso nome e stessi orari non attribuiscono provenienza', () => {
  const timbrature = [{ operaio_nome: 'Mario', ora_entrata: '08:00', costoOperativo: 60 }]
  assert.equal(calcola([{ costo_manodopera: 100 }], timbrature).costoTotaleManodoperaContabile, 160)
})
test('input immutati, costo operativo indipendente da contributo contabile', () => {
  const t = Object.freeze({ rapportino_id: 'rap-1', costoOperativo: 100 })
  const r = Object.freeze({ costo_manodopera: 100 })
  assert.equal(calcola(Object.freeze([r]), Object.freeze([t])).costoTotaleManodoperaContabile, 100)
  assert.equal(t.costoOperativo, 100)
})
test('array vuoti e costi Rapportino mancanti/null: zero', () => {
  assert.equal(calcola([], []).costoTotaleManodoperaContabile, 0)
  assert.equal(calcola([{}, { costo_manodopera: null }], []).costoTotaleManodoperaContabile, 0)
})
test('costo salvato numerico stringa preservato; dati invalidi rifiutati', () => {
  assert.equal(calcola([{ costo_manodopera: '100.25' }], []).costoRapportini, 100.25)
  for (const costo of ['errato', '', -1, Infinity, NaN]) {
    assert.throws(() => calcola([{ costo_manodopera: costo }], []), /Costo manodopera non valido/)
  }
  assert.throws(() => calcola([], [{ costoOperativo: NaN }]), /Costo manodopera non valido/)
})

// Esegue le sette espressioni reali della pagina, senza montare React o usare DB.
// L'estrazione AST evita di copiare nei test le formule e i filtri implementati.
const pagina = ts.createSourceFile('page.tsx', fs.readFileSync(path.join(__dirname, '../../page.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const nomiKpi = ['calcoloEconomiaCantiere','storicoGiornaliero','controlloCostiPro','utileRealePerCantiere','calcolaTotaleManodoperaCantiere','dashboardCantieri','storicoUtileCantieri']
const nomiDerivati = ['totalePreventiviImpresa','totaleCostiImpresa','utileTotaleImpresa','margineMedioImpresa']
const dichiarazioni = new Map()
function raccogli(nodo) {
  if (ts.isVariableDeclaration(nodo) && ts.isIdentifier(nodo.name) && [...nomiKpi,...nomiDerivati].includes(nodo.name.text)) {
    assert(!dichiarazioni.has(nodo.name.text), 'Dichiarazione KPI ambigua')
    dichiarazioni.set(nodo.name.text, 'const ' + nodo.getText(pagina) + ';')
  }
  ts.forEachChild(nodo, raccogli)
}
raccogli(pagina)
for (const nome of [...nomiKpi,...nomiDerivati]) assert(dichiarazioni.has(nome), 'KPI assente: ' + nome)
const codiceKpi = ts.transpileModule([...nomiKpi,...nomiDerivati].map(n => dichiarazioni.get(n)).join('\n') +
  '\nglobalThis.kpi = {' + [...nomiKpi,...nomiDerivati].join(',') + '};',
  { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS } }).outputText
function eseguiKpi(rapportini, timbrature, opzioni = {}) {
  const contesto = {
    contabilizzaManodopera,
    cantieri: [{ nome: 'A', preventivo: 1000 }, { nome: 'B', preventivo: 1000 }],
    rapportini, timbrature, preventivi: [], materialiCantiere: [], attrezziCantiere: [],
    calcolaCostoTimbratura: t => t.costoOperativo,
    parseImporto: v => Number(v || 0),
    economiaDataDa: '', economiaDataA: '', dataDa: '', dataA: '',
    dataStoricoUtile: '2026-09-30', oggi: '2026-09-21',
    ...opzioni,
  }
  vm.runInNewContext(codiceKpi, contesto)
  return contesto.kpi
}
const rapporto = (cantiere = 'A', data = '2026-09-21', costo_manodopera = 100) => ({ cantiere, data, costo_manodopera })
const presenza = (costoOperativo = 100, extra = {}) => ({ cantiere: 'A', data: '2026-09-21', costoOperativo, ...extra })

for (const [nome, r, t, atteso] of [
  ['Rapportino e timbratura collegata', [rapporto()], [presenza(100,{ rapportino_id: 'rap-1' })], 100],
  ['Rapportino e timbratura indipendente', [rapporto()], [presenza(60)], 160],
  ['sola timbratura indipendente', [], [presenza()], 100],
]) test('KPI reali: '+nome, () => {
  const k = eseguiKpi(r,t)
  assert.equal(k.calcolaTotaleManodoperaCantiere('A'), atteso)
  assert.equal(k.calcoloEconomiaCantiere('A').costoTotale, atteso)
  assert.equal(k.controlloCostiPro()[0].costoTotale, atteso)
  assert.equal(k.dashboardCantieri[0].costi, atteso)
  assert.equal(k.storicoGiornaliero()[0].costo, -atteso)
  assert.equal(k.utileRealePerCantiere().A[0].utile, 1000-atteso)
  assert.equal(k.storicoUtileCantieri[0].manodoperaGiorno, atteso)
})
test('KPI reali: due cantieri separati e totale impresa sommato una volta', () => {
  const k = eseguiKpi([rapporto(),rapporto('B','2026-09-21',200)], [presenza(100,{rapportino_id:'rap-A'}),presenza(60,{cantiere:'B'})])
  assert.equal(k.calcolaTotaleManodoperaCantiere('A'),100)
  assert.equal(k.calcolaTotaleManodoperaCantiere('B'),260)
  assert.equal(k.dashboardCantieri[0].costi,100)
  assert.equal(k.dashboardCantieri[1].costi,260)
  assert.equal(k.totaleCostiImpresa,360)
  assert.equal(k.utileTotaleImpresa,1640)
})
test('KPI reali: storico separato per giorno e limite storico utile', () => {
  const k = eseguiKpi([rapporto()], [presenza(100,{rapportino_id:'rap-1'}),presenza(60,{data:'2026-09-22'})], {dataStoricoUtile:'2026-09-21'})
  assert.equal(k.storicoGiornaliero().length,2)
  assert.equal(k.storicoGiornaliero()[0].costo,-100)
  assert.equal(k.storicoGiornaliero()[1].costo,-60)
  assert.equal(k.utileRealePerCantiere().A[1].utile,840)
  assert.equal(k.storicoUtileCantieri[0].manodoperaGiorno,100)
})
test('KPI reali: filtri periodo inclusivi e indipendenti dai totali dashboard', () => {
  const r = [rapporto('A','2026-09-20',900),rapporto(),rapporto('A','2026-09-23',800)]
  const t = [presenza(500,{data:'2026-09-20'}),presenza(100,{rapportino_id:'rap-1'}),presenza(60,{data:'2026-09-22'}),presenza(400,{data:'2026-09-23'})]
  const k = eseguiKpi(r,t,{economiaDataDa:'2026-09-21',economiaDataA:'2026-09-22',dataDa:'2026-09-21',dataA:'2026-09-22'})
  assert.equal(k.calcolaTotaleManodoperaCantiere('A'),160)
  assert.equal(k.storicoGiornaliero().length,2)
  assert.equal(k.storicoGiornaliero()[0].costo,-100)
  assert.equal(k.storicoGiornaliero()[1].costo,-60)
  assert.equal(k.utileRealePerCantiere().A[1].utile,840)
  assert.equal(k.dashboardCantieri[0].costi,2760)
})
test('KPI reali: timbrature restano disponibili, legacy non sommata, Economia ignorata', () => {
  const r = Object.freeze([Object.freeze(rapporto())])
  const t = Object.freeze([Object.freeze(presenza(100,{rapportino_id:'rap-1'})),Object.freeze(presenza(100,{stato:'da rapportino'}))])
  const k = eseguiKpi(r,t,{economia_righe:[{totale:3268.20}],economia_raccolte:[{numero:3}]})
  assert.equal(t.length,2)
  assert.equal(t[0].costoOperativo,100)
  assert.equal(k.calcolaTotaleManodoperaCantiere('A'),100)
  assert.equal(k.dashboardCantieri[0].costi,100)
  assert.equal(k.totaleCostiImpresa,100)
})
