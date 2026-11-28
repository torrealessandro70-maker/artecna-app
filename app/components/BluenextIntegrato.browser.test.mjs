import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { openFixture, syntheticXml, syntheticReceipt } from '../../supabase/validators/bluenext-integrato/fixture.mjs'
const load = createRequire(import.meta.url), XLSX = load('xlsx')
const { ids } = load('../../supabase/validators/riconciliazione-unificata/fixture.cjs')
const { chromium } = load(process.env.ARTECNA_PLAYWRIGHT_MODULE || 'playwright')
const root = process.cwd(), dir = fs.mkdtempSync(path.join(root, '.run', 'bluenext-browser-'))
const headers = ['Num. documento','Data doc.','Tipo','Cliente','Partita IVA','Importo','Esito invio','Data Importazione','Non Registrata','Id SDI']
const report = (id='18746061890',status='Impossibilità di recapito') => [headers,['17','27/11/2026','Fattura','CLIENTE FIXTURE','RSSMRA80A01H501U',5000,status,'28/11/2026',true,id],[],['Totale','','','','',5000]]
function workbook(rows, kind='xlsx') { const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet(rows),'Foglio');return XLSX.write(b,{type:'buffer',bookType:kind}) }
const xml = Buffer.from(syntheticXml()), excel = workbook(report()), xls=workbook(report(),'biff8')
const JSZip=load('jszip'),archive=new JSZip();archive.file('fattura.xml',xml);archive.file('copia.xml',xml)
const zip=await archive.generateAsync({type:'nodebuffer'})
fs.writeFileSync(path.join(dir,'harness.tsx'), `import React from 'react';import{createRoot}from'react-dom/client';import BluenextIntegrato from '../../app/components/BluenextIntegrato';import{analizzaFonti,preparaFile,leggiReport}from'../../app/engines/fatture/bluenextIntegrato';const client={rpc:async(name:string,args:unknown)=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return await r.json()}};Object.assign(window,{testParser:{analizzaFonti,preparaFile,leggiReport}});createRoot(document.getElementById('root')!).render(<div id="area-lavoro-principale" style={{height:'95vh',overflow:'auto',padding:12}}><BluenextIntegrato client={client} cantieri={{'${ids.c}':'Cantiere TESTA — sintetico'}} onAggiorna={async()=>{}}/></div>);`)
fs.writeFileSync(path.join(dir,'tsx-loader.cjs'),"const ts=require('typescript');module.exports=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText")
const webpack=load('next/dist/compiled/webpack/webpack');webpack.init()
await new Promise((resolve,reject)=>webpack.webpack({mode:'development',target:'web',devtool:false,entry:path.join(dir,'harness.tsx'),output:{path:path.join(dir,'public'),filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js']},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(dir,'tsx-loader.cjs')}]}},(err,stats)=>err||stats.hasErrors()?reject(err||Error(stats.toString({all:false,errors:true}))):resolve()))
const db=await openFixture();let server,browser
const checks=[], calls=[]
try {
  server=http.createServer(async(req,res)=>{
    try {
      if(req.url==='/rpc' && req.method==='POST') {
        let raw='';for await(const part of req){raw+=part;if(raw.length>65000000)throw Error('SIZE')}
        const {name,args}=JSON.parse(raw);calls.push(name);let r
        if(name==='anteprima_bluenext_integrata')r=await db.user.query('SELECT public.anteprima_bluenext_integrata($1) AS data',[JSON.stringify(args.p_documenti)])
        else if(name==='conferma_bluenext_integrato')r=await db.user.query('SELECT public.conferma_bluenext_integrato($1,$2,$3,$4,$5,$6) AS data',[args.p_richiesta,JSON.stringify(args.p_documenti),JSON.stringify(args.p_fonti),args.p_versione,args.p_riconcilia,args.p_attestazione])
        else if(name==='leggi_esito_bluenext_integrato')r=await db.user.query('SELECT public.leggi_esito_bluenext_integrato($1) AS data',[args.p_richiesta])
        else if(name==='leggi_riconciliazione_unificata')r=await db.user.query('SELECT public.leggi_riconciliazione_unificata($1,$2,$3) AS data',[args.p_fattura,args.p_acconto,args.p_verifica])
        else throw Error('RPC_NOT_ALLOWED')
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:r.rows[0].data,error:null}));return
      }
      const file=path.join(dir,'public',path.basename(req.url.split('?')[0]));
      if(req.url.endsWith('.js')&&fs.existsSync(file)){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(file));return}
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/bundle.js"></script>')
    } catch(error) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{code:error.code||'LOCAL_FAILURE'}}))}
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking','--disable-component-update']})
  for(const width of [1440,390]) {
    await db.resetIntegrated();calls.length=0
    const context=await browser.newContext({viewport:{width,height:width===390?844:1000},locale:'it-IT',serviceWorkers:'block'})
    await context.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&u.port===String(port)?r.continue():r.abort()})
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`http://127.0.0.1:${port}`)
    await page.getByRole('button',{name:'Analizza archivio Bluenext',exact:true}).click()
    const input=page.locator('input[type=file]')
    await input.setInputFiles({name:'fattura.xml',mimeType:'text/xml',buffer:xml})
    await page.getByRole('button',{name:'Rimuovi fattura.xml',exact:true}).waitFor()
    assert.deepEqual(calls,[])
    // One drop adds report + an already loaded XML; no duplicate and no writer.
    await page.evaluate(({x,e})=>{const dt=new DataTransfer();for(const [name,value,type]of [['fattura.xml',x,'text/xml'],['Fatture Emesse.xlsx',e,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']])dt.items.add(new File([Uint8Array.from(atob(value),c=>c.charCodeAt(0))],name,{type}));document.querySelector('section[aria-label="Carica fonti Bluenext"]').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}))},{x:xml.toString('base64'),e:excel.toString('base64')})
    await page.getByRole('button',{name:'Rimuovi Fatture Emesse.xlsx',exact:true}).waitFor()
    await page.getByText(/1 file identici/).waitFor();assert.deepEqual(calls,[])
    await input.setInputFiles({name:'non-supportato.pdf',mimeType:'application/pdf',buffer:Buffer.from('synthetic')})
    await page.getByRole('alert').filter({hasText:'Formato non supportato'}).waitFor()
    await page.getByRole('button',{name:'Rimuovi Fatture Emesse.xlsx',exact:true}).click()
    assert.equal(await page.getByRole('button',{name:'Rimuovi Fatture Emesse.xlsx',exact:true}).count(),0)
    await page.getByRole('button',{name:'Analizza XML + Excel',exact:true}).click()
    await page.getByText('Report Excel non abbinato: l’importazione XML rimane possibile.',{exact:true}).waitFor()
    await input.setInputFiles({name:'Fatture Emesse.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:excel})
    await page.getByRole('button',{name:'Rimuovi Fatture Emesse.xlsx',exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{name:'Conferma complessiva'}).count(),0)
    await page.getByRole('button',{name:'Analizza XML + Excel',exact:true}).click()
    await page.getByRole('heading',{name:'Conferma complessiva'}).waitFor()
    await page.getByText(/Id SDI 18746061890/).waitFor()
    await page.getByText(/riuso incasso.*5[.]?000,00/).waitFor()
    assert.equal(calls.filter(x=>x==='conferma_bluenext_integrato').length,0)
    assert(await page.getByRole('button',{name:'Conferma operazioni certe'}).isDisabled())
    await page.getByText('Riferimenti e numerazione',{exact:true}).click();await page.getByText('3° acconto lavori contrattuali',{exact:true}).waitFor()
    if(width===390){
      await page.getByRole('button',{name:'Prepara riconciliazione 17',exact:true}).click()
      await page.getByRole('heading',{name:'Riconcilia acconto e fattura',exact:true}).waitFor()
      await page.getByLabel(/Quota imponibile — IVA/).fill('4545,45')
      await page.getByLabel('Pagamento lordo',{exact:true}).selectOption('00000000-0000-4000-8000-000000000081')
      await page.getByLabel('Fonte documentale della base contrattuale').fill('Contratto e pagamento sintetici confrontati')
      await page.getByLabel(/Ho verificato che la quota/).check()
      await page.getByRole('button',{name:'Aggiungi proposta al lotto',exact:true}).click()
      await page.getByRole('heading',{name:'Importazione Bluenext XML + Excel',exact:true}).waitFor()
      assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.quote_lorde_clienti')).rows[0].n,0)
      assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.bluenext_fonti')).rows[0].n,0)
      assert(!calls.some(name=>name==='riconcilia_acconto_fattura'))
      await page.getByRole('button',{name:'Analizza XML + Excel',exact:true}).click()
      await page.getByRole('heading',{name:'Conferma complessiva',exact:true}).waitFor()
      checks.push('390: existing unified wizard prepares a draft without any writer, financial effects only at final batch confirmation')
    }
    await page.getByLabel(/Ho confrontato gli originali/).check()
    assert(await page.getByRole('button',{name:'Conferma operazioni certe'}).isEnabled())
    await page.getByRole('button',{name:'Conferma operazioni certe'}).click()
    await page.getByRole('status').filter({hasText:'Importazione confermata dal server'}).waitFor()
    assert.equal(calls.filter(x=>x==='conferma_bluenext_integrato').length,1)
    assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.incassi_lordi_clienti')).rows[0].n,1)
    assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.quote_lorde_clienti')).rows[0].n,1)
    assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.fatture_sdi')).rows[0].n,0)
    assert.equal((await db.admin.query('SELECT xml_testo FROM public.fatture_emesse WHERE id=$1',[ids.f])).rows[0].xml_testo,null)
    assert.equal(Number((await db.admin.query('SELECT sum(importo) AS n FROM public.acconti_cantiere')).rows[0].n),24210.47)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
    await page.screenshot({path:path.join(dir,`smoke-${width}.png`),fullPage:true})
    await page.getByRole('button',{name:'← Torna alle fatture emesse',exact:true}).click()
    await page.getByRole('button',{name:'Analizza archivio Bluenext',exact:true}).waitFor()
    assert.deepEqual(errors,[])
    checks.push(`${width}: actual drag/drop + multiple selection, later addition, duplicates, unsupported file, exact CF/IdSDI match, single atomic SQL confirmation, private originals, one payment, no manufactured SdI, economy preserved, return and responsive layout`)
    // Additional parser cases execute the real browser parsers on original synthetic bytes.
    const parser=await page.evaluate(async({xls,excel})=>{
      const file=(name,b)=>new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],name)
      const p=window.testParser
      const a=await p.leggiReport(await p.preparaFile(file('export.xls',xls)))
      const b=await p.leggiReport(await p.preparaFile(file('export.xlsx',excel)))
      return {xls:a.length,xlsx:b.length,id:a[0].idSdi,cf:a[0].identificativo,totale:a[0].totale}
    },{xls:xls.toString('base64'),excel:excel.toString('base64')})
    assert.deepEqual(parser,{xls:1,xlsx:1,id:'18746061890',cf:'RSSMRA80A01H501U',totale:5000})
    checks.push(`${width}: actual XLS and XLSX parser, totals row excluded, string identifiers preserved`)
    if(width===1440){
      const conflictRows=report('18746061890','Scartata'),brokenRows=report();brokenRows[0]=brokenRows[0].slice(0,9)
      const formulaBook=XLSX.utils.book_new(),formulaSheet=XLSX.utils.aoa_to_sheet(report());formulaSheet.J2={t:'n',f:'1+1',v:2};XLSX.utils.book_append_sheet(formulaBook,formulaSheet,'Foglio')
      const serialRows=report('123456789012345678901234');serialRows[1][0]='0017';serialRows[1][1]=(Date.UTC(2026,10,27)-Date.UTC(1899,11,30))/864e5
      const data={zip:zip.toString('base64'),xml:xml.toString('base64'),excel:excel.toString('base64'),conflict:workbook(conflictRows).toString('base64'),broken:workbook(brokenRows).toString('base64'),formula:XLSX.write(formulaBook,{type:'buffer',bookType:'xlsx'}).toString('base64'),serial:workbook(serialRows).toString('base64'),receipt:Buffer.from(syntheticReceipt()).toString('base64'),badReceipt:Buffer.from('<NotificaMancataConsegna><NomeFile>fattura.xml</NomeFile></NotificaMancataConsegna>').toString('base64')}
      const cases=await page.evaluate(async data=>{
        const p=window.testParser,file=(name,b)=>new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],name),f=(name,b)=>p.preparaFile(file(name,b)),analyze=async(...items)=>p.analizzaFonti(await Promise.all(items.map(([n,b])=>f(n,b))))
        const results={}
        let a=await analyze(['archivio.zip',data.zip]);results.zipDeduplicated=a.documenti.length===1&&!a.documenti[0].problemi.length&&!!a.documenti[0].archivio
        a=await analyze(['fattura.xml',data.xml],['report.xlsx',data.excel],['successivo.xlsx',data.conflict]);results.conflictingReportsBlocked=a.documenti[0].problemi.length>0
        a=await analyze(['fattura.xml',data.xml],['report.xlsx',data.broken]);results.invalidHeadersExplicit=a.anomalie.length>0
        a=await analyze(['fattura.xml',data.xml],['report.xlsx',data.formula]);results.formulasNeverEvaluated=a.anomalie.some(x=>x.includes('formule'))
        const rows=await p.leggiReport(await f('seriale.xlsx',data.serial));results.serialDateAndIdentifiers=rows[0].numero==='0017'&&rows[0].data==='2026-11-27'&&rows[0].idSdi==='123456789012345678901234'&&rows[0].nonRegistrata==='true'
        a=await analyze(['fattura.xml',data.xml],['report.xlsx',data.excel],['ricevuta.xml',data.receipt]);results.receiptBoundByFilenameAndSdi=!!a.documenti[0].ricevuta&&!a.documenti[0].problemi.length
        a=await analyze(['fattura.xml',data.xml],['ricevuta.xml',data.badReceipt]);results.incompleteReceiptBlocked=a.documenti[0].problemi.length>0
        const text=atob(data.xml),other=btoa(text.replace('<ImportoTotaleDocumento>5000.00','<ImportoTotaleDocumento>5001.00'))
        a=await analyze(['fattura.xml',data.xml],['variante.xml',other]);results.xmlVersionsBlocked=a.documenti[0].problemi.length>0
        a=await analyze(['fattura.xml',btoa(text.replace('<Divisa>EUR','<Divisa>USD'))]);results.currencyNeverConverted=a.documenti[0].problemi.length>0
        a=await analyze(['fattura.xml',btoa('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///forbidden">]>'+text)]);results.externalEntitiesRejected=a.anomalie.length>0
        a=await analyze(['solo-excel.xlsx',data.excel]);results.excelAloneDoesNotCreateInvoice=a.documenti.length===0&&a.reportOrfani.length===1
        return results
      },data)
      for(const [name,green]of Object.entries(cases)){assert.equal(green,true,name);checks.push(`parser: ${name}`)}
    }
    await context.close()
  }
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({green:true,checks,productionRequests:0},null,2));console.log(JSON.stringify({green:true,checks,artifacts:dir}))
} finally {if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await db.close()}
