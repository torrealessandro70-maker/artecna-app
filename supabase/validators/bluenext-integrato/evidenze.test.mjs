import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { openFixture,hash,syntheticXml,syntheticReceipt,uuid } from './fixture.mjs'
import { createRequire } from 'node:module'
const load=createRequire(import.meta.url),XLSX=load('xlsx')
const {ids}=load('../riconciliazione-unificata/fixture.cjs')
test('PostgreSQL 17.6: intermediary report, genuine receipt, concurrent batches and revocation',async t=>{
 const db=await openFixture(),{admin,user,resetIntegrated:reset}=db
 try {
  const xml=syntheticXml(),receipt=syntheticReceipt(),xls=XLSX.utils.book_new();XLSX.utils.book_append_sheet(xls,XLSX.utils.aoa_to_sheet([['Num. documento','Id SDI'],['17','18746061890']]),'Foglio');const bytes=XLSX.write(xls,{type:'buffer',bookType:'xlsx'})
  const sources=[{nome:'fattura.xml',tipo:'xml',sha256:hash(xml),base64:Buffer.from(xml).toString('base64')},{nome:'report.xlsx',tipo:'xlsx',sha256:hash(bytes),base64:bytes.toString('base64')}]
  const report={fonte:hash(bytes),foglio:'Foglio',riga:2,numero:'17',data:'2026-11-27',tipo:'Fattura',cliente:'CLIENTE FIXTURE',identificativo:'RSSMRA80A01H501U',totale:5000,esito:'Impossibilità di recapito',idSdi:'18746061890',importata:'28/11/2026',nonRegistrata:'true'}
  const docs=[{xml,nome:'fattura.xml',xml_sha:hash(xml),report,problemi:[]}]
  const preview=async(ds=docs,c=user)=>(await c.query('SELECT public.anteprima_bluenext_integrata($1) AS x',[JSON.stringify(ds)])).rows[0].x
  const confirm=async(id,p,ds=docs,ss=sources,c=user,recon=true)=>(await c.query('SELECT public.conferma_bluenext_integrato($1,$2,$3,$4,$5,true) AS x',[id,JSON.stringify(ds),JSON.stringify(ss),p.versione,recon])).rows[0].x
  await reset()
  await t.test('report preserves original Id SDI and import date without manufacturing a receipt',async()=>{
   const r=await confirm(uuid(100),await preview());assert(r.confermato)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.fatture_sdi')).rows[0].n,0)
   assert.equal(r.righe[0].report_intermediario.idSdi,'18746061890')
   assert.notEqual(r.righe[0].riconciliazione.fiscale.stato,'Regolarizzato')
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_notifiche.evento_notificabile WHERE record_id=$1 AND resolved_at IS NULL',[ids.a])).rows[0].n,1)
   const meta=(await user.query('SELECT public.elenca_fonti_bluenext($1) AS x',[ids.f])).rows[0].x
   assert.equal(meta.length,2);assert(meta.every(x=>!x.evidenza.ricevuta_originale))
   const raw=(await user.query('SELECT public.leggi_fonte_bluenext($1,$2) AS x',[ids.f,hash(bytes)])).rows[0].x
   assert.equal(hash(Buffer.from(raw.base64,'base64')),hash(bytes))
  })
  await t.test('later original receipt completes fiscal coverage, closes only associated notice, no new receipt/payment row on reimport',async()=>{
   const ds=[{...docs[0],ricevuta:{xml:receipt,fonte:hash(receipt),nome:'ricevuta.xml'}}],ss=[...sources,{nome:'ricevuta.xml',tipo:'xml',sha256:hash(receipt),base64:Buffer.from(receipt).toString('base64')}]
   const economyBefore=(await user.query('SELECT public.leggi_acconto_fiscale($1) AS x',[uuid(80)])).rows[0].x
   const notices=async()=>(await admin.query('SELECT to_jsonb(e) AS x FROM artecna_notifiche.evento_notificabile e WHERE record_id=$1 ORDER BY id',[uuid(80)])).rows
   const economyNotices=await notices()
   await confirm(uuid(101),await preview(ds),ds,ss)
   assert.equal((await user.query('SELECT public.leggi_acconto_fiscale($1) AS x',[ids.a])).rows[0].x.stato,'Regolarizzato')
   assert.deepEqual((await user.query('SELECT public.leggi_acconto_fiscale($1) AS x',[uuid(80)])).rows[0].x,economyBefore)
   assert.deepEqual(await notices(),economyNotices)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_notifiche.evento_notificabile WHERE record_id=$1 AND resolved_at IS NULL',[ids.a])).rows[0].n,0)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.record_id=$1 AND n.resolved_at IS NULL',[ids.a])).rows[0].n,0)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,1)
   await confirm(uuid(102),await preview(ds),ds,ss)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.fatture_sdi')).rows[0].n,1)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.quote_lorde_clienti')).rows[0].n,1)
  })
  await t.test('discordant report or original receipt is not certain',async()=>{
   let p=await preview([{...docs[0],report:{...report,totale:4999}}]);assert.equal(p.righe[0].certa,false)
   p=await preview([{...docs[0],ricevuta:{xml:syntheticReceipt('99999999999'),fonte:hash(receipt)}}]);assert.equal(p.righe[0].certa,false)
   p=await preview([{...docs[0],ricevuta:{xml:receipt.replace('<DataOraMessaADisposizione>2026-11-27T10:01:00Z</DataOraMessaADisposizione>',''),fonte:hash(receipt)}}]);assert.equal(p.righe[0].certa,false)
  })
  await reset()
  await t.test('two concurrent confirmations of same UUID produce one operation',async()=>{
   const other=await db.connect('authenticated'),p=await preview(),id=uuid(103)
   const r=await Promise.all([confirm(id,p),confirm(id,p,docs,sources,other)])
   assert.deepEqual(r[0],r[1]);assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.quote_lorde_clienti')).rows[0].n,1)
  })
  await reset()
  await t.test('lock conflict stops without retry or partial writes',async()=>{
   const p=await preview();await admin.query('BEGIN');await admin.query('UPDATE public.acconti_cantiere SET nota=$1 WHERE id=$2',['held synthetic update',ids.a])
   try {await assert.rejects(confirm(uuid(104),p),e=>e.code==='55P03')}finally{await admin.query('ROLLBACK')}
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_lotti')).rows[0].n,0)
  })
  await t.test('same receipt proposed for two documents is not assigned by batch order',async()=>{
   const second=syntheticXml('18'),ds=[...docs,{xml:second,nome:'second.xml',xml_sha:hash(second),problemi:[]}],p=await preview(ds)
   assert(p.righe.every(r=>r.proposta===null));assert(p.righe.every(r=>r.avviso))
  })
  await t.test('manual reconciliation revocation retains payment and reopens coverage',async()=>{
   await confirm(uuid(105),await preview())
   const q=(await admin.query('SELECT id FROM artecna_contabilita.quote_lorde_clienti')).rows[0].id
   await user.query('SELECT public.revoca_riconciliazione_unificata($1,$2)',[uuid(106),q])
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,1)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.attribuzioni_clienti WHERE scollegato_at IS NULL')).rows[0].n,0)
  })
  await t.test('new credit note preserves type, does not produce a positive payment or allocation',async()=>{
   const xml=syntheticXml('NC-1','Nota di credito sintetica','TD04'),ds=[{xml,nome:'nota.xml',xml_sha:hash(xml),cantiere:ids.c,problemi:[]}],ss=[{nome:'nota.xml',tipo:'xml',sha256:hash(xml),base64:Buffer.from(xml).toString('base64')}]
   const r=await confirm(uuid(107),await preview(ds),ds,ss);assert.equal(r.righe[0].riconciliazione,null)
   assert.equal((await admin.query("SELECT bluenext_tipo FROM public.fatture_emesse WHERE numero_fattura='NC-1'")).rows[0].bluenext_tipo,'TD04')
  })
  await reset()
  await t.test('manual partial drafts are applied together by the canonical writer with cents exactness',async()=>{
   const op=(n,quota)=>({rpc:'riconcilia_acconto_fattura',args:{p_richiesta:uuid(n),p_fattura:ids.f,p_acconto:ids.a,p_incasso:uuid(81),p_nuovo:null,p_impronta:hash(xml),p_allocazioni:[{indice:0,imponibile:quota}],p_fonte_base:'Contratto e pagamento sintetici verificati',p_conferma_fiscale:n===201}})
   const ds=[{...docs[0],operazioni:[op(200,'2272.73'),op(201,'2272.72')]}],p=await preview(ds)
   assert.equal(p.righe[0].proposta,null);assert.equal(p.righe[0].manuali,2)
   await confirm(uuid(202),p,ds)
   const q=(await admin.query('SELECT sum(importo) AS n,count(*)::int AS rows FROM artecna_contabilita.quote_lorde_clienti')).rows[0]
   assert.equal(Number(q.n),5000);assert.equal(q.rows,2)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,1)
  })
  await reset()
  await t.test('failed second manual draft rolls back the entire batch',async()=>{
   const make=(n,quota)=>({rpc:'riconcilia_acconto_fattura',args:{p_richiesta:uuid(n),p_fattura:ids.f,p_acconto:ids.a,p_incasso:uuid(81),p_impronta:hash(xml),p_allocazioni:[{indice:0,imponibile:quota}],p_fonte_base:'Fonte sintetica verificata',p_conferma_fiscale:false}})
   const ds=[{...docs[0],operazioni:[make(210,'3000'),make(211,'3000')]}]
   await assert.rejects(confirm(uuid(212),await preview(ds),ds),e=>e.code==='23514')
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.attribuzioni_clienti')).rows[0].n,0)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_fonti')).rows[0].n,0)
  })
  await t.test('IVA 22%, zero documented nature and mixed rates reuse the unchanged fiscal validator',async()=>{
   for(const [num,groups,total,net,vat]of [
    ['RATE22','<AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta><EsigibilitaIVA>I</EsigibilitaIVA>',122,100,22],
    ['RATE0','<AliquotaIVA>0.00</AliquotaIVA><ImponibileImporto>100.00</ImponibileImporto><Imposta>0.00</Imposta><Natura>N4</Natura><EsigibilitaIVA>I</EsigibilitaIVA>',100,100,0],
    ['MIXED','<AliquotaIVA>10.00</AliquotaIVA><ImponibileImporto>50.00</ImponibileImporto><Imposta>5.00</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo><DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>50.00</ImponibileImporto><Imposta>11.00</Imposta><EsigibilitaIVA>I</EsigibilitaIVA>',116,100,16],
   ]){
    const raw=syntheticXml(num).replace(/<DatiRiepilogo>[\s\S]*?<\/DatiRiepilogo>/,()=>'<DatiRiepilogo>'+groups+'</DatiRiepilogo>').replace('<ImportoTotaleDocumento>5000.00','<ImportoTotaleDocumento>'+total.toFixed(2))
    const ds=[{xml:raw,nome:num+'.xml',xml_sha:hash(raw),cantiere:ids.c,problemi:[]}],ss=[{nome:num+'.xml',tipo:'xml',sha256:hash(raw),base64:Buffer.from(raw).toString('base64')}]
    const r=await confirm(crypto.randomUUID(),await preview(ds),ds,ss,user,false),f=r.righe[0].fattura
    const d=(await admin.query('SELECT artecna_contabilita.documento_riconciliazione($1) AS x',[f])).rows[0].x
    assert(d.valida);assert.equal(d.gruppi.reduce((n,g)=>n+g.imponibile,0),net);assert.equal(d.gruppi.reduce((n,g)=>n+g.iva,0),vat)
   }
  })
  await t.test('deletion cascades evidence and removes exclusively referenced private originals',async()=>{
   const raw=syntheticXml('GC'),ds=[{xml:raw,nome:'gc.xml',xml_sha:hash(raw),cantiere:ids.c,problemi:[]}],ss=[{nome:'gc.xml',tipo:'xml',sha256:hash(raw),base64:Buffer.from(raw).toString('base64')}]
   const r=await confirm(uuid(220),await preview(ds),ds,ss,user,false),f=r.righe[0].fattura
   await admin.query('DELETE FROM public.fatture_emesse WHERE id=$1',[f])
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_evidenze WHERE fattura_id=$1',[f])).rows[0].n,0)
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_fonti WHERE sha256=$1',[hash(raw)])).rows[0].n,0)
  })
  assert(!fs.readFileSync(db.dir+'/server.log','utf8').includes('<FatturaElettronica>'),'Original XML must not appear in local PostgreSQL logs')
 }finally{await db.close()}
})
