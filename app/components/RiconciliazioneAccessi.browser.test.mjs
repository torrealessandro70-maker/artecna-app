import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const load = createRequire(import.meta.url)
const root = process.cwd()
const dir = fs.mkdtempSync(path.join(root, '.run', 'cantiere-browser-'))
const fixture = String.raw`import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import FattureEmessePanel from '../../app/components/FattureEmessePanel';
import AccontiTable from '../../app/components/AccontiTable';
import VistaOperativa from '../../app/components/VistaOperativa';
import AccontoCompilazioneVista from '../../app/components/AccontoCompilazioneVista';
import CentroNotifiche from '../../app/components/CentroNotifiche';
import CollegaIncassoPanel from '../../app/components/CollegaIncassoPanel';
const a = '00000000-0000-4000-8000-000000000007', f = '00000000-0000-4000-8000-000000000005', i = '00000000-0000-4000-8000-000000000011';
const data = { versione: 1, autore: '00000000-0000-4000-8000-000000000001', cantiere_id: '00000000-0000-4000-8000-000000000003', cantiere: 'TESTA ANTONINO — fixture', acconti: [{ id: a, descrizione: '4° Acconto lavori contrattuali', importo: 4545.45, attribuito: 0, data: '2026-11-20', fiscale: { stato: 'Fattura da emettere' } }], fatture: [{ id: f, numero: '17', data: '2026-11-27', cliente: 'CLIENTE SINTETICO', totale: 5000, attribuito_netto: 0, collegamenti_netto: [], documento: { valida: true, fonte: 'Fixture documentata', impronta: 'fixture', gruppi: [{ indice: 0, imponibile: 4545.45, iva: 454.55, aliquota: 10, natura: null }] }, sdi: { tipo: 'TD01', esito: 'consegnata' }, quote: [] }], incassi: [{ id: i, acconto_id: a, importo: 5000, disponibile: 5000, ricevuto_il: '2026-11-20', riferimento: 'SYNTHETIC-PAY', metodo: 'bonifico' }] };
const reads: unknown[] = [];
const writes: unknown[] = [];
const client = { from: () => ({ select: async () => ({ data: [{ id: data.cantiere_id, nome: data.cantiere }], error: null }) }), rpc: async (name: string, args: Record<string, unknown>) => {
        reads.push({ name, args });
        if (name === 'leggi_acconto_compilazione') {
            await new Promise(r => setTimeout(r, 30));
            return { data: { documentato: true, acconto: { id: a, cantiere_id: data.cantiere_id, descrizione: '4° Acconto lavori contrattuali', importo: 4545.45, data_incasso: '2026-11-20', metodo: 'bonifico', nota: 'Nota sintetica' } }, error: null };
        }
        if (name === 'contatori_notifiche')
            return { data: { totale: 1, fatture_da_emettere: 1 }, error: null };
        if (name === 'lista_notifiche')
            return { data: [{ id: '00000000-0000-4000-8000-000000000090', titolo: 'Pendenza sintetica', messaggio: 'Fixture', priorita: 'alta', modulo: 'fatture_da_emettere', published_at: '2026-11-27T00:00:00Z', read_at: null, attiva: true }], error: null };
        if (name === 'risolvi_destinazione_notifica')
            return { data: { azione: 'apri_acconto_fiscale', record_id: a }, error: null };
        if (name === 'leggi_riconciliazione_unificata') {
            await new Promise(r => setTimeout(r, 30));
            return { data: structuredClone(data), error: null };
        }
        if (name === 'leggi_attribuzioni_cliente')
            return { data: { fattura: { id: f, numero_fattura: '17', cliente: 'CLIENTE SINTETICO', data_fattura: '2026-11-27', totale: 5000, importo_incassato: 0 }, attribuito: 0, acconti: [{ id: a, descrizione: '4° Acconto lavori contrattuali', importo: 4545.45, attribuito: 0, data_incasso: '2026-11-20', provenienza: 'acconti_cantiere' }], collegamenti: [], situazione: 'Da riconciliare', residuo_verificato: null, incassi_non_fatturati_ambigui: 0 }, error: null };
        writes.push(name);
        throw Error('Unexpected writer in navigation test: ' + name);
    } };
Object.assign(window, { fixtureClient: client, fixtureReads: () => reads, fixtureWrites: () => writes });
const noop = () => { };
function Harness() { const [filter, setFilter] = useState(''), [old, setOld] = useState(false), [edit, setEdit] = useState(false), [site, setSite] = useState(false); return <div id="area-lavoro-principale" style={{ height: '95vh', overflow: 'auto', padding: 12 }}><main><FattureEmessePanel fattureEmesseOrdinate={[{ id: f, numero_fattura: '17', data_fattura: '2026-11-27', cliente: 'CLIENTE SINTETICO', cantiere_id: data.cantiere_id, imponibile: 4545.45, iva: 454.55, totale: 5000, stato: 'emessa' }]} filtroFattureEmesse="" setFiltroFattureEmesse={noop} setNuovaFatturaEmessa={noop} setPopupNuovaFatturaEmessa={noop} setFatturaEmessaAperta={noop} caricaFatturaEmessaPdf={noop} caricaFattureEmesse={noop} ordinaFattureEmesse={noop} formatMoney={(x: unknown) => String(x)} cardStyle={{}} inputStyle={{}} excelTable={{}} excelTh={{}} excelTd={{}} buttonPrimary={{}} buttonSecondary={{}}/><button onClick={() => setSite(true)}>Economia cantiere fixture</button><CentroNotifiche client={client} stile={{}} menuImpostazioni={false} onApriScadenza={noop} onContatori={noop}/><label>Filtro origine <input value={filter} onChange={e => setFilter(e.target.value)}/></label><p>Pagina 2 · contesto da preservare</p><button onClick={() => setOld(true)}>Vecchio selettore</button><div style={{ height: 1800 }}>Solo fixture sintetiche; nessuna connessione esterna.</div></main>{site && <VistaOperativa titolo="Acconti del cantiere" onChiudi={() => setSite(false)}><AccontiTable acconti={[{ id: a, cantiere_id: data.cantiere_id, cantiere: data.cantiere, descrizione: '4° Acconto lavori contrattuali', importo: 4545.45, data_incasso: '2026-11-20', metodo: 'bonifico', nota: 'Nota sintetica' }]} cantiereScheda={data.cantiere} cantiereId={data.cantiere_id} economiaDataDa="" economiaDataA="" excelTable={{}} excelTh={{}} excelTd={{}} buttonSecondary={{}} formatMoney={(v: number) => String(v)} onModifica={() => setEdit(true)} onElimina={() => { throw Error('No delete'); }}/></VistaOperativa>}{edit && <AccontoCompilazioneVista id={a} cantiereId={data.cantiere_id} cantiere={data.cantiere} utenteId={data.autore} onChiudi={() => setEdit(false)} onPersistito={async () => { }}/>}{old && <CollegaIncassoPanel client={client as never} fatturaId={f} cantiereId={data.cantiere_id} onChiudi={() => setOld(false)}/>}</div>; }
createRoot(document.getElementById('root')!).render(<Harness />);
;

`

// Offline browser regression: real components, asynchronous authorized readers,
// no database, and every non-local network request rejected.
fs.writeFileSync(path.join(dir, 'harness.tsx'), fixture)
fs.writeFileSync(path.join(dir, 'supabase-stub.ts'), 'export const supabase={rpc:(...args:unknown[]) => (window as any).fixtureClient.rpc(...args),from:(...args:unknown[]) => (window as any).fixtureClient.from(...args)}')
fs.writeFileSync(path.join(dir, 'tsx-loader.cjs'), "const ts=require('typescript');module.exports=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText")
fs.writeFileSync(path.join(dir, 'css-loader.cjs'), "module.exports=()=> 'module.exports=new Proxy({}, {get:(_,key)=>String(key)})'")
const webpack = load('next/dist/compiled/webpack/webpack')
webpack.init()
const { chromium } = load(process.env.ARTECNA_PLAYWRIGHT_MODULE || 'playwright')
let browser, server, diagnosticPage
const checks = []
try {
  await new Promise((resolve, reject) => webpack.webpack({
    mode: 'development', target: 'web', devtool: false, entry: path.join(dir, 'harness.tsx'),
    output: { path: path.join(dir, 'public'), filename: 'bundle.js' },
    resolve: { alias: { [path.join(root, 'lib/supabaseClient.ts')]: path.join(dir, 'supabase-stub.ts') }, extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
      { test: /\.css$/, use: path.join(dir, 'css-loader.cjs') },
      { test: /\.tsx?$/, exclude: /node_modules/, use: path.join(dir, 'tsx-loader.cjs') },
    ] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()))
  server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(fs.readFileSync(path.join(dir, 'public/bundle.js'))) }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/bundle.js"></script>') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update'] })
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'it-IT', serviceWorkers: 'block' })
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return url.hostname === '127.0.0.1' && url.port === String(port) ? route.continue() : route.abort()
    })
    const page = await context.newPage(), errors = []
    diagnosticPage = page
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${port}`)
    await page.getByLabel('Filtro origine').fill('TESTA')
    const heading = page.getByRole('heading', { name: 'Riconcilia acconto e fattura' })
    const back = page.getByRole('button', { name: '← Torna al riepilogo', exact: true })
    const assertWizard = async () => {
      await heading.waitFor({ state: 'visible' })
      await page.getByText('Fonte: Fixture documentata', { exact: true }).waitFor()
      const visible = await page.locator('#area-lavoro-principale > [data-attivita-operativa]').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none' && !node.hidden).length)
      assert.equal(visible, 1, 'Exactly one operational view must be visible')
      assert.equal(await page.getByLabel(/^Acconto/).inputValue(), '00000000-0000-4000-8000-000000000007')
      assert.equal(await page.getByLabel(/^Fattura emessa/).inputValue(), '00000000-0000-4000-8000-000000000005')
      const amounts = await page.getByText(/Imponibile contrattuale:/).textContent()
      assert.match(amounts, /4[.]?545,45/, amounts)
      await page.getByLabel(/Quota imponibile — IVA/).fill('4545,45')
      await page.getByText(/IVA documentale.*454,55.*Lordo.*5[.]?000,00/).waitFor()
      await page.getByLabel('Pagamento lordo', { exact: true }).selectOption('00000000-0000-4000-8000-000000000011')
      await page.getByText(/Incasso verificato.*5[.]?000,00/).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    }
    // Actual invoice row entry, not a duplicate test-only action button.
    await page.getByRole('button', { name: 'Riconcilia acconto', exact: true }).click()
    await assertWizard()
    await back.click()
    assert.equal(await page.getByLabel('Filtro origine').inputValue(), 'TESTA')
    checks.push(`${viewport.width}: Fatture emesse, exact UUIDs, TESTA amounts and return`)
    // Actual notification components for both navigation origins.
    for (const entry of [/Centro notifiche/, /Fatture da emettere/]) {
      await page.getByRole('button', { name: entry }).click()
      const centro = page.getByRole('region', { name: 'Centro notifiche', exact: true })
      await centro.getByRole('button', { name: 'Da leggere', exact: true }).click()
      await centro.getByRole('button', { name: 'Regolarizza', exact: true }).click()
      await assertWizard()
      await back.click()
      assert.equal(await centro.getByRole('button', { name: 'Da leggere', exact: true }).getAttribute('aria-pressed'), 'true')
      await centro.getByRole('button', { name: '← Chiudi', exact: true }).click()
      checks.push(`${viewport.width}: ${entry}, loading and retained filter`)
    }
    // Reproduce the real nesting: site workspace -> table -> editor -> wizard.
    await page.getByRole('button', { name: 'Economia cantiere fixture', exact: true }).click()
    await page.getByRole('button', { name: '✏️', exact: true }).click()
    const editor = page.getByRole('region', { name: 'Modifica acconto', exact: true })
    await editor.getByLabel('Descrizione', { exact: true }).fill('Descrizione locale non salvata')
    await editor.getByRole('button', { name: 'Associa fattura', exact: true }).click()
    await assertWizard()
    await page.screenshot({ path: path.join(dir, `cantiere-${viewport.width}.png`) })
    const reads = await page.evaluate(() => window.fixtureReads())
    assert(reads.some(read => read.name === 'leggi_acconto_compilazione' && read.args.p_id === '00000000-0000-4000-8000-000000000007'))
    assert(reads.some(read => read.name === 'leggi_riconciliazione_unificata' && read.args.p_acconto === '00000000-0000-4000-8000-000000000007'))
    await back.click()
    assert.equal(await editor.getByLabel('Descrizione', { exact: true }).inputValue(), 'Descrizione locale non salvata')
    assert.equal(await editor.getByRole('button', { name: 'Associa fattura', exact: true }).evaluate(node => node === document.activeElement), true)
    // A second open must not retain a hidden or stale operational layer.
    await editor.getByRole('button', { name: 'Associa fattura', exact: true }).click()
    await assertWizard()
    await back.click()
    await editor.getByRole('button', { name: '← Torna agli acconti', exact: true }).click()
    await page.getByRole('region', { name: 'Acconti del cantiere', exact: true }).getByRole('button', { name: '← Torna al cantiere', exact: true }).click()
    assert.equal(await page.getByLabel('Filtro origine').inputValue(), 'TESTA')
    checks.push(`${viewport.width}: nested cantiere/acconto, async reads, reopen, draft and focus preserved`)
    await page.getByRole('button', { name: 'Vecchio selettore', exact: true }).click()
    const old = page.getByRole('dialog', { name: 'Collega incasso' })
    await old.getByRole('radio').check()
    await old.getByLabel('Quota da attribuire').fill('5000')
    await old.getByRole('checkbox').check()
    assert(await old.getByRole('button', { name: 'Conferma collegamento' }).isDisabled())
    await old.getByRole('alert').filter({ hasText: 'Quota superiore' }).waitFor()
    await old.getByRole('button', { name: 'Chiudi collegamenti' }).click()
    assert.deepEqual(await page.evaluate(() => window.fixtureWrites()), [])
    assert.deepEqual(errors, [])
    checks.push(`${viewport.width}: over-allocation blocked; no writers or JavaScript errors`)
    await context.close()
  }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ green: true, checks, productionRequests: 0 }, null, 2))
  console.log(JSON.stringify({ green: true, checks, artifacts: dir }))
} catch (error) {
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    const views = await diagnosticPage.locator('#area-lavoro-principale > [data-attivita-operativa]').evaluateAll(nodes => nodes.map(node => ({ title: node.getAttribute('aria-label'), display: getComputedStyle(node).display, text: node.textContent })))
    fs.writeFileSync(path.join(dir, 'failure.json'), JSON.stringify({ message: error.message, views }, null, 2))
  }
  throw error
} finally {
  if (browser) await browser.close()
  if (server) await new Promise(resolve => server.close(resolve))
}
