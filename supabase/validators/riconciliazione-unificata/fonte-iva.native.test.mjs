import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import fixtureModule from './fixture.cjs'
const loadDependency = createRequire(import.meta.url)
const ts = loadDependency('typescript')
loadDependency.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file)
const { risolviFonteIvaPersistita } = loadDependency('../../../app/engines/contabilita-ditta/fonteIva.ts')
const proof = semantica => ({ semantica, documento_verificato: true, riferimento: 'Originale sintetico verificato' })
const row = (imponibile, iva, totale) => ({ id: 'sintetico', numero_fattura: '17', data_fattura: '2026-11-27', cliente: 'CLIENTE SINTETICO', imponibile, iva, totale })
test('Contratto canonico IVA: parità TypeScript / PostgreSQL 17.6', async t => {
  const db = await fixtureModule.fixture()
  try {
    await t.test('Manifesto oggetti indipendente dal registro migrazioni', async () => {
      const query = fs.readFileSync(new URL('../../diagnostics/riconciliazione-unificata/installed-objects.sql', import.meta.url), 'utf8')
      const results = await db.admin.query(query)
      const evidence = results.flatMap(r=>r.rows).find(r=>r.evidence)?.evidence
      assert.equal(evidence.readonly,'on');assert.equal(evidence.registry_present,false)
      assert.equal(evidence.functions.length,8);assert.equal(evidence.columns.length,3);assert.equal(evidence.triggers.length,3)
      assert.ok(evidence.functions.every(f=>/^[a-f0-9]{64}$/.test(f.source_sha256_lf)))
      fs.writeFileSync(new URL('../../../.run/iva-installed-objects-local.json',import.meta.url),JSON.stringify(evidence,null,2))
    })
    const cases = [
      ['importo inferiore a 100', row(100, 22, 122), proof('importo'), true],
      ['importo superiore a 100', row(4545.45, 454.55, 5000), proof('importo'), true],
      ...[4, 5, 10, 22].map(rate => [`aliquota ${rate}`, row(100, rate, 100 + rate), proof('aliquota'), true]),
      ['numero ambiguo senza prova', row(100, 22, 122), null, false],
      ['IVA zero aggregata non equivale a esenzione', row(100, 0, 100), proof('importo'), true],
      ['aliquota zero senza natura', row(100, 0, 100), proof('aliquota'), false],
      ['natura documentata', row(100, 0, 100), { ...proof('importo'), gruppi: [{ imponibile: 100, iva: 0, aliquota: 0, natura: 'N4' }] }, true],
      ['aliquote miste documentate', row(100, 16, 116), { ...proof('importo'), gruppi: [{ imponibile: 50, iva: 5, aliquota: 10, natura: null }, { imponibile: 50, iva: 11, aliquota: 22, natura: null }] }, true],
      ['arrotondamento al centesimo', row(1.15, 22, 1.40), proof('aliquota'), true],
      ['totale incompatibile', row(100, 22, 123), proof('importo'), false],
      ['sorgente XML storica non è percentuale', { ...row(100, 22, 122), xml_url: 'https://example.invalid/originale' }, proof('aliquota'), false],
      ['firma Bluenext non consente aliquota', { ...row(100, 22, 122), bluenext_identita: 'a'.repeat(64), bluenext_impronta: 'b'.repeat(64), bluenext_tipo: 'TD01' }, proof('aliquota'), false],
    ]
    for (const [name, data, verification, valid] of cases) await t.test(name, async () => {
      const js = risolviFonteIvaPersistita(data, verification)
      const sql = (await db.admin.query('SELECT artecna_contabilita.risolvi_iva_persistita($1::jsonb,$2::jsonb) AS result', [JSON.stringify(data), verification && JSON.stringify(verification)])).rows[0].result
      assert.equal(js.valida, valid)
      assert.deepEqual(sql, js)
    })
    await t.test('Verifica IVA e finanziaria condividono rollback; quote aggregate parziali bloccate', async () => {
      const {ids}=fixtureModule,c=await db.connect('authenticated')
      await db.admin.query('UPDATE public.fatture_emesse SET iva=454.55,fonte_iva_verificata=NULL WHERE id=$1',[ids.f])
      const verification=proof('importo'),d=(await c.query('SELECT public.leggi_riconciliazione_unificata($1,$2,$3) x',[ids.f,ids.a,verification])).rows[0].x
      const doc=d.fatture.find(f=>f.id===ids.f).documento
      const args=[randomUUID(),ids.f,ids.a,null,{importo:1,data:'2026-11-20',metodo:'bonifico',riferimento:'SYN-ROLLBACK',fonte:'Fonte sintetica verificata',verificato:true},JSON.stringify([{indice:0,imponibile:4545.45}]),doc.impronta,'Contratto sintetico verificato',false,verification]
      const send=()=>c.query('SELECT public.riconcilia_acconto_fattura($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',args)
      await assert.rejects(send(),{code:'23514'})
      assert.equal((await db.admin.query('SELECT fonte_iva_verificata FROM public.fatture_emesse WHERE id=$1',[ids.f])).rows[0].fonte_iva_verificata,null)
      assert.equal((await db.admin.query('SELECT count(*)::int n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,0)
      args[0]=randomUUID();args[5]=JSON.stringify([{indice:0,imponibile:100}]);await assert.rejects(send(),{code:'23514'})
      await db.reset()
    })
    await t.test('Fixture storica: importo IVA, incasso preesistente, SdI successivo', async () => {
      const { ids } = fixtureModule
      const c = await db.connect('authenticated')
      await db.admin.query('UPDATE public.fatture_emesse SET iva=454.55,fonte_iva_verificata=NULL WHERE id=$1', [ids.f])
      const read = verification => c.query('SELECT public.leggi_riconciliazione_unificata($1,$2,$3) x', [ids.f, ids.a, verification || null]).then(r => r.rows[0].x)
      assert.equal((await read()).fatture.find(f => f.id === ids.f).documento.valida, false)
      await c.query("SELECT public.registra_acconto_fiscale($1,0,'incassato','ordinario','2026-11-20','Fonte sintetica')", [ids.a])
      const payment = randomUUID()
      await c.query("SELECT public.conferma_incasso_lordo_cliente($1,$2,5000,'2026-11-20','bonifico','SYN-ORIGINAL','Fonte sintetica verificata')", [payment, ids.a])
      const verification = proof('importo'), d = await read(verification), doc = d.fatture.find(f => f.id === ids.f).documento
      assert.equal(doc.valida, true); assert.equal(doc.gruppi[0].aliquota, null); assert.equal(doc.gruppi[0].iva, 454.55)
      const request = randomUUID(), args = [request, ids.f, ids.a, payment, null, JSON.stringify([{ indice: 0, imponibile: 4545.45 }]), doc.impronta, 'Contratto sintetico: base imponibile verificata', true, verification]
      const send = () => c.query('SELECT public.riconcilia_acconto_fattura($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) x', args).then(r => r.rows[0].x)
      assert.equal((await send()).fiscale.stato, 'Da verificare')
      await send()
      assert.equal((await read()).incassi.find(i => i.id === payment).disponibile, 0)
      assert.equal((await db.admin.query('SELECT count(*)::int n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n, 1)
      assert.equal(Number((await db.admin.query('SELECT importo FROM public.acconti_cantiere WHERE id=$1', [ids.a])).rows[0].importo), 4545.45)
      assert.ok((await db.admin.query('SELECT count(*)::int n FROM artecna_notifiche.evento_notificabile WHERE resolved_at IS NULL')).rows[0].n > 0)
      await db.admin.query("INSERT INTO artecna_contabilita.fatture_sdi(fattura_id,revisione,tipo,esito,trasmessa_at,esito_at,protocollo,ricevuta,fonte,autore) SELECT id,1,'TD01','consegnata',now(),now(),'SYN','SYN',artecna_contabilita.fonte_fattura(f),$2 FROM public.fatture_emesse f WHERE id=$1", [ids.f, ids.user])
      await db.admin.query('SELECT artecna_notifiche.riconcilia_acconto_fiscale($1,now())', [ids.a])
      assert.equal((await db.admin.query('SELECT count(*)::int n FROM artecna_notifiche.evento_notificabile WHERE resolved_at IS NULL')).rows[0].n, 0)
      await assert.rejects(c.query("UPDATE public.fatture_emesse SET fonte_iva_verificata='{}' WHERE id=$1", [ids.f]), { code: '42501' })
    })
  } finally { await db.close() }
})
