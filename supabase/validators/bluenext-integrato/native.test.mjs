import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openFixture,hash,syntheticXml,syntheticReceipt,uuid } from './fixture.mjs'
import { createRequire } from 'node:module'
const load=createRequire(import.meta.url)
const {ids}=load('../riconciliazione-unificata/fixture.cjs')
test('PostgreSQL 17.6: integrated import, preservation, authorization, idempotency and rollback', async t => {
  const db = await openFixture(), {admin,user,other,anon,resetIntegrated:reset}=db
  try {
    assert.match((await admin.query('select version() as v')).rows[0].v, /PostgreSQL 17\.6/)
    const xml = syntheticXml(), source = { sha256: hash(xml), tipo: 'xml', nome: 'fattura.xml', base64: Buffer.from(xml).toString('base64') }
    const docs = [{ xml, nome: 'fattura.xml', xml_sha: hash(xml), problemi: [] }]
    const preview = async (d = docs, client = user) => (await client.query('SELECT public.anteprima_bluenext_integrata($1) AS x',[JSON.stringify(d)])).rows[0].x
    const confirm = async (id, p, d = docs, sources = [source], recon = true, client = user) => (await client.query('SELECT public.conferma_bluenext_integrato($1,$2,$3,$4,$5,true) AS x',[id,JSON.stringify(d),JSON.stringify(sources),p.versione,recon])).rows[0].x
    await reset()
    await t.test('migration leaves 18 original preservation sets intact; RLS/ACL remain closed', async () => {
      assert.equal(db.preservationRelations,18)
      const r=await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid IN('artecna_contabilita.bluenext_fonti'::regclass,'artecna_contabilita.bluenext_evidenze'::regclass,'artecna_contabilita.bluenext_lotti'::regclass)")
      assert(r.rows.every(r=>r.relrowsecurity))
      await assert.rejects(user.query('SELECT * FROM artecna_contabilita.bluenext_fonti'),e=>e.code==='42501')
      await assert.rejects(anon.query('SELECT public.anteprima_bluenext_integrata($1)',[JSON.stringify(docs)]),e=>e.code==='42501')
      await assert.rejects(preview(docs,other),e=>e.code==='42501')
      await assert.rejects(user.query('UPDATE artecna_contabilita.bluenext_fonti SET nome=$1',['forbidden']),e=>e.code==='42501')
    })
    await t.test('TESTA fixture: independent ordinal numbers, 24210.47 total, one existing gross receipt, economy untouched', async () => {
      assert.equal(Number((await admin.query('SELECT sum(importo) AS n FROM public.acconti_cantiere')).rows[0].n),24210.47)
      const before=(await admin.query(`SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.acconti_cantiere x),(SELECT jsonb_agg(to_jsonb(x)) FROM public.preventivi_cantiere x),(SELECT jsonb_agg(to_jsonb(x)) FROM public.sal_lavorazioni x),(SELECT public.leggi_acconto_fiscale('${uuid(80)}'))) AS x`)).rows[0].x
      const p=await preview();assert(p.righe[0].certa);assert.equal(p.righe[0].proposta.acconto,ids.a)
      const id=uuid(82), result=await confirm(id,p);assert(result.confermato)
      const retry=await confirm(id,p);assert.deepEqual(retry,result)
      const after=(await admin.query(`SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.acconti_cantiere x),(SELECT jsonb_agg(to_jsonb(x)) FROM public.preventivi_cantiere x),(SELECT jsonb_agg(to_jsonb(x)) FROM public.sal_lavorazioni x),(SELECT public.leggi_acconto_fiscale('${uuid(80)}'))) AS x`)).rows[0].x
      assert.deepEqual(after,before)
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,1)
      assert.equal(Number((await admin.query('SELECT sum(importo) AS n FROM artecna_contabilita.quote_lorde_clienti')).rows[0].n),5000)
      assert.notEqual(result.righe[0].riconciliazione.fiscale.stato,'Regolarizzato')
      const p2=await preview();assert.equal(p2.righe[0].proposta,null);await confirm(uuid(83),p2)
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.quote_lorde_clienti')).rows[0].n,1)
    })
    await t.test('original source retrieval limited to uploader and authorized invoice',async()=>{
      const own=(await user.query('SELECT public.leggi_fonte_bluenext($1,$2) AS x',[ids.f,source.sha256])).rows[0].x
      assert.equal(own.base64.replaceAll('\n',''),source.base64)
      await assert.rejects(other.query('SELECT public.leggi_fonte_bluenext($1,$2)',[ids.f,source.sha256]),e=>e.code==='42501')
    })
    await t.test('changed input under same request UUID is rejected',async()=>{
      await assert.rejects(confirm(uuid(82),await preview(),docs,[{...source,nome:'other.xml'}]),e=>e.code==='23505')
    })
    await reset()
    await t.test('stale baseline and tampered source never write',async()=>{
      const p=await preview();await admin.query("UPDATE public.acconti_cantiere SET nota='Concurrent synthetic change' WHERE id=$1",[ids.a])
      await assert.rejects(confirm(uuid(84),p),e=>e.code==='40001')
      await assert.rejects(confirm(uuid(85),await preview(),docs,[{...source,sha256:'0'.repeat(64)}]),e=>e.code==='22023')
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_fonti')).rows[0].n,0)
    })
    await t.test('mid-transaction failure rolls back XML, sources, associations and journal',async()=>{
      const bad=[{...docs[0],ricevuta:{xml:syntheticReceipt(),fonte:hash(syntheticReceipt())}}]
      await assert.rejects(confirm(uuid(86),await preview(bad),bad))
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_fonti')).rows[0].n,0)
      assert.equal((await admin.query('SELECT xml_testo FROM public.fatture_emesse WHERE id=$1',[ids.f])).rows[0].xml_testo,null)
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_lotti')).rows[0].n,0)
    })
    await t.test('no available receipt means source import only; no presumed new payment',async()=>{
      await admin.query('DELETE FROM artecna_contabilita.incassi_lordi_clienti')
      const p=await preview();assert.equal(p.righe[0].proposta,null);await confirm(uuid(87),p)
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,0)
    })
    await t.test('new invoice uses canonical importer and original UUID is never replaced',async()=>{
      const xml=syntheticXml('19'),d=[{xml,nome:'new.xml',xml_sha:hash(xml),problemi:[],cantiere:ids.c}],s=[{...source,sha256:hash(xml),base64:Buffer.from(xml).toString('base64'),nome:'new.xml'}]
      const r=await confirm(uuid(88),await preview(d),d,s,false);assert(r.righe[0].fattura);assert.notEqual(r.righe[0].fattura,ids.f)
      await confirm(uuid(89),await preview(d),d,s,false)
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM public.fatture_emesse WHERE numero_fattura='19'")).rows[0].n,1)
    })
    await t.test('dedicated reader request result is actor isolated',async()=>{
      assert.equal((await other.query('SELECT public.leggi_esito_bluenext_integrato($1) AS x',[uuid(88)])).rows[0].x,null)
    })
  } finally { await db.close() }
})
