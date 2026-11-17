/* eslint-disable @typescript-eslint/no-require-imports -- Fixture PostgreSQL sintetica. */
module.exports = async function verificaAccordo({ q, value, as, load, admin, titolare, esterno, client2, randomUUID, assert, lordoDoc, leggi }) {

  {
    await q(load('20261116000100_classificazione_cantieri.sql'))
    await admin.query('GRANT artecna_sal_rpc TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE')
    const hardDeleteBefore=await value("SELECT pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) v")
    await q("UPDATE public.fatture_emesse SET importo_incassato=10,stato='parziale' WHERE id=$1",[lordoDoc])
    const financialBefore=await value("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.fatture_emesse f),(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti i)) v")
    const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
    const runtime=path.resolve('.run/ribasso-contrattuale')
    fs.mkdirSync(runtime,{recursive:true})
    const generator=path.join(runtime,'generate-installer.ps1')
    fs.writeFileSync(generator,[
      "$ErrorActionPreference='Stop'",
      ". './supabase/diagnostics/RUN-accordi-contrattuali.ps1' -VerifyOnly",
      "if ($PSVersionTable.PSVersion.Major -ne 5) { throw 'PowerShell 5.1 richiesto' }",
      "[IO.File]::WriteAllText((Join-Path $root '.run/ribasso-contrattuale/apply-fixture.sql'),$applyPayload,[Text.UTF8Encoding]::new($false))",
    ].join('\n'))
    const generated=cp.spawnSync('powershell.exe',['-NoProfile','-File',generator],{encoding:'utf8',windowsHide:true})
    assert.equal(generated.status,0,generated.stdout+generated.stderr)
    await q('CREATE SCHEMA IF NOT EXISTS cron')
    await q('CREATE TABLE IF NOT EXISTS cron.job(jobid bigint,command text)')
    const psql=path.resolve('.run/cantiere-prereq-runtime/minimal/pgsql/bin/psql.exe')
    const pgArgs=[
      '-X','-w','--dbname','host=127.0.0.1 port='+admin.connectionParameters.port+' dbname=postgres user=postgres',
      '-v','ON_ERROR_STOP=1','-f']
    const invokeSql=file=>cp.spawnSync(psql,[...pgArgs,file],{encoding:'utf8',windowsHide:true})
    const payload=fs.readFileSync(path.join(runtime,'apply-fixture.sql'),'utf8')
    fs.writeFileSync(path.join(runtime,'failed-apply-fixture.sql'),payload.replace(/^COMMIT;\r?$/m,'SELECT 1/0;\nCOMMIT;'))
    const failed=invokeSql(path.join(runtime,'failed-apply-fixture.sql'))
    assert.equal(failed.status,3)
    assert.match(failed.stderr,/22012/)
    assert.doesNotMatch(failed.stdout,/^COMMIT\r?$/m)
    assert.equal(await value("SELECT to_regnamespace('artecna_contratti') IS NULL v"),true)
    const installed=invokeSql(path.join(runtime,'apply-fixture.sql'))
    assert.equal(installed.status,0,installed.stdout+installed.stderr)
    assert.equal((installed.stdout.match(/^COMMIT\r?$/gm)||[]).length,1)
    assert.equal((installed.stdout.match(/^ROLLBACK\r?$/gm)||[]).length,2)
    assert.match(installed.stdout,/DATI_INVARIATI=true/)
    const repeated=invokeSql(path.join(runtime,'apply-fixture.sql'))
    assert.equal(repeated.status,3)
    assert.doesNotMatch(repeated.stdout,/^COMMIT\r?$/m)
    console.log('INSTALLER_PS51_POSTGRES_GREEN COMMIT_COUNT=1 ROLLBACK_COUNT=2 DATI_INVARIATI=true')
    // Verificare le guardie anche quando le policy non proteggono le righe.
    await q('ALTER TABLE public.preventivo_lavorazioni DISABLE ROW LEVEL SECURITY')
    await q('ALTER TABLE public.sal_lavorazioni DISABLE ROW LEVEL SECURITY')
    await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
    assert.equal(await value("SELECT pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) v"),hardDeleteBefore)
    const cid=await value("INSERT INTO public.cantieri(nome,lavori_conclusi) VALUES('Pernicone sintetico',true) RETURNING id v")
    await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[cid,titolare])
    const pid=await value("INSERT INTO public.preventivi_cantiere(cantiere,nome_file,file_path,file_url,importo_totale) VALUES('Pernicone sintetico','Originale sintetico.pdf','fixture/pernicone.pdf','https://example.invalid/pernicone.pdf',1200) RETURNING id v")
    const docBefore=await value("SELECT to_jsonb(p) v FROM public.preventivi_cantiere p WHERE id=$1",[pid])
    const rows=[
      {descrizione:'Lavori principali, sette gruppi',quantita:1,unita_misura:'corpo',prezzo_unitario:850,importo_previsto:850},
      {descrizione:'Impermeabilizzazione doccia, opzione inclusa per accordo',quantita:1,unita_misura:'corpo',prezzo_unitario:750,importo_previsto:750},
    ]
    const previewSql='SELECT public.anteprima_accordo_contrattuale($1,$2,$3::jsonb,$4,$5,$6,$7,$8) v'
    const confirmSql='SELECT public.conferma_accordo_contrattuale($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11) v'
    const args=[cid,pid,JSON.stringify(rows),1200,'a_corpo','Accordo verificato','Conferma sintetica','Refuso subtotale 800 anziche 850. Opzione doccia inclusa.']
    const preview=async(user=titolare,a=args)=>(await as(user,previewSql,a))[0].v
    await assert.rejects(preview(esterno),{code:'42501'})
    const p=await preview()
    assert.equal(p.totale_originale,1600)
    assert.equal(p.importo_concordato,1200)
    assert.equal(p.ribasso_percentuale,25)
    assert.deepEqual(p.righe.map(r=>r.importo_contrattuale),[637.5,562.5])
    assert.deepEqual(await value("SELECT to_jsonb(p) v FROM public.preventivi_cantiere p WHERE id=$1",[pid]),docBefore)
    const id=randomUUID()
    const request=[id,...args,p.token,'CONFERMA CONTRATTO']
    await assert.rejects(as(esterno,confirmSql,request),{code:'42501'})
    await assert.rejects(as(titolare,confirmSql,[...request.slice(0,-1),'NO']),{code:'22023'})
    await assert.rejects(as(titolare,"UPDATE public.preventivi_cantiere SET accordo_contrattuale='{}' WHERE id=$1",[pid]),{code:'42501'})
    const results=await Promise.all([as(titolare,confirmSql,request),as(titolare,confirmSql,request,client2)])
    assert.deepEqual(results[0][0].v,results[1][0].v)
    const agreement=results[0][0].v
    assert.equal(await value('SELECT count(*)::int v FROM public.preventivo_lavorazioni WHERE preventivo_id=$1',[pid]),2)
    assert.equal(await value('SELECT count(*)::int v FROM artecna_contratti.accordi WHERE preventivo_id=$1',[pid]),1)
    await assert.rejects(as(titolare,confirmSql,[randomUUID(),...request.slice(1)]),{code:'40001'})
    const docAfter=await value('SELECT to_jsonb(p) v FROM public.preventivi_cantiere p WHERE id=$1',[pid])
    assert.equal(docAfter.file_path,docBefore.file_path)
    assert.equal(docAfter.file_url,docBefore.file_url)
    assert.equal(docAfter.importo_totale,1200)
    assert.equal(docAfter.cantiere_id,cid)
    assert.equal(await value('SELECT lavori_conclusi v FROM public.cantieri WHERE id=$1',[cid]),true)
    await assert.rejects(as(titolare,"UPDATE public.preventivo_lavorazioni SET importo_previsto=1 WHERE preventivo_id=$1",[pid]),{code:'55000'})
    await assert.rejects(as(titolare,"UPDATE public.cantieri SET preventivo_contrattuale_id=null WHERE id=$1",[cid]),{code:'55000'})
    const ids=agreement.righe.map(r=>r.id)
    const importSql='SELECT public.importa_sal_accordato($1,$2,$3::bigint[]) v'
    await assert.rejects(as(esterno,importSql,[cid,pid,ids]),{code:'42501'})
    await assert.rejects(as(titolare,importSql,[cid,pid,[ids[0],ids[0]]]),{code:'22023'})
    await assert.rejects(as(titolare,importSql,[cid,pid,[9223372036854]]),{code:'22023'})
    assert.equal((await as(titolare,importSql,[cid,pid,ids]))[0].v,2)
    assert.equal((await as(titolare,importSql,[cid,pid,ids]))[0].v,0)
    const sal=await q('SELECT * FROM public.sal_lavorazioni WHERE cantiere_id=$1 ORDER BY source_lavorazione_id',[cid])
    assert.deepEqual(sal.map(s=>Number(s.importo_previsto)),[637.5,562.5])
    for(const s of sal) await as(titolare,'SELECT * FROM public.aggiorna_avanzamento_sal($1,50,null)',[s.id])
    assert.equal(await value('SELECT sum(importo_maturato)::float v FROM public.sal_lavorazioni WHERE cantiere_id=$1',[cid]),600)
    for(const s of sal) await as(titolare,'SELECT * FROM public.aggiorna_avanzamento_sal($1,100,null)',[s.id])
    assert.equal(await value('SELECT sum(importo_maturato)::float v FROM public.sal_lavorazioni WHERE cantiere_id=$1',[cid]),1200)
    await assert.rejects(as(titolare,'UPDATE public.sal_lavorazioni SET importo_previsto=850 WHERE id=$1',[sal[0].id]),{code:'55000'})
    await assert.rejects(preview(),{code:'55000'})
    assert.deepEqual(await value("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.fatture_emesse f),(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti i)) v"),financialBefore)
    const invoice=(await as(titolare,leggi,[lordoDoc,'fattura']))[0].v
    assert.deepEqual([invoice.totale,invoice.attribuito,invoice.residuo],[10000,10000,0])
    assert.deepEqual(await value('SELECT jsonb_build_array(importo_incassato,stato) v FROM public.fatture_emesse WHERE id=$1',[lordoDoc]),[10,'parziale'])
    assert.equal(await value('SELECT signature=artecna_distruzione.hard_delete_catalog() v FROM artecna_distruzione.hard_delete_catalog_expected'),true)
    async function creaCaso(nome) {
      const c=await value('INSERT INTO public.cantieri(nome) VALUES($1) RETURNING id v',[nome])
      await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[c,titolare])
      const p=await value("INSERT INTO public.preventivi_cantiere(cantiere,nome_file,file_url,file_path,importo_totale) VALUES($1,'Originale.pdf',$2,$3,800) RETURNING id v",
        [nome,'https://example.invalid/'+c+'.pdf','fixture/'+c+'.pdf'])
      return [c,p]
    }
    const rounded=await creaCaso('Quantita decimali sintetiche')
    const ordinary=await creaCaso('Contratto ordinario sintetico')
    await q('UPDATE public.preventivi_cantiere SET cantiere_id=$1,file_path=null,file_url=null WHERE id=$2',ordinary)
    await q('UPDATE public.cantieri SET preventivo_contrattuale_id=$2 WHERE id=$1',ordinary)
    await q("INSERT INTO public.preventivo_lavorazioni(cantiere,cantiere_id,preventivo_id,descrizione,quantita,unita_misura,prezzo_unitario,importo_previsto) VALUES('Contratto ordinario sintetico',$1,$2,'Voce ordinaria',1,'corpo',800,800)",ordinary)
    await as(titolare,"SELECT * FROM public.elimina_cantiere_definitivamente($1,'ELIMINA')",[ordinary[0]])
    assert.equal(await value('SELECT count(*)::int v FROM public.cantieri WHERE id=$1',[ordinary[0]]),0)
    console.log('HARD_DELETE_V3_CONTRATTO_ORDINARIO_GREEN')
    const decimals=[{descrizione:'Quantita decimale',quantita:2.5,unita_misura:'m',prezzo_unitario:3.333333,importo_previsto:8.33},
      {descrizione:'Altra voce',quantita:1,unita_misura:'pz',prezzo_unitario:1.67,importo_previsto:1.67}]
    const decimalPreview=await preview(titolare,[...rounded,JSON.stringify(decimals),3.33,...args.slice(4)])
    assert.equal(decimalPreview.righe.reduce((n,r)=>n+Math.round(r.importo_contrattuale*100),0),333)
    assert.equal(decimalPreview.righe[0].prezzo_unitario_contrattuale,1.109999889)
    const same=await preview(titolare,[...rounded,JSON.stringify(decimals),3.33,...args.slice(4)])
    assert.deepEqual(same,decimalPreview)
    await assert.rejects(preview(titolare,[...rounded,'[]',1200,...args.slice(4)]),{code:'22023'})
    await assert.rejects(preview(titolare,[...rounded,JSON.stringify([{...decimals[0],importo_previsto:9}]),3,...args.slice(4)]),{code:'22023'})
    // Due conferme diverse sullo stesso token: una sola revisione puo essere applicata.
    const raceArgs=[...rounded,JSON.stringify(decimals),3.33,...args.slice(4)]
    const raced=await Promise.allSettled([as(titolare,confirmSql,[randomUUID(),...raceArgs,decimalPreview.token,'CONFERMA CONTRATTO']),
      as(titolare,confirmSql,[randomUUID(),...raceArgs,decimalPreview.token,'CONFERMA CONTRATTO'],client2)])
    assert.equal(raced.filter(r=>r.status==='fulfilled').length,1)
    assert.equal(raced.find(r=>r.status==='rejected').reason.code,'40001')
    const existing=await creaCaso('Storico gia strutturato')
    for(const r of rows) await q("INSERT INTO public.preventivo_lavorazioni(cantiere,preventivo_id,descrizione,quantita,unita_misura,prezzo_unitario,importo_previsto) VALUES('Storico gia strutturato',$1,$2,$3,$4,$5,$6)",
      [existing[1],r.descrizione,r.quantita,r.unita_misura,r.prezzo_unitario,r.importo_previsto])
    const existingIds=(await q('SELECT id FROM public.preventivo_lavorazioni WHERE preventivo_id=$1 ORDER BY id',[existing[1]])).map(r=>r.id)
    const reuseArgs=[...existing,'[]',1200,...args.slice(4)]
    const reuse=await preview(titolare,reuseArgs)
    await as(titolare,confirmSql,[randomUUID(),...reuseArgs,reuse.token,'CONFERMA CONTRATTO'])
    assert.deepEqual((await q('SELECT id FROM public.preventivo_lavorazioni WHERE preventivo_id=$1 AND cantiere_id=$2 ORDER BY id',[existing[1],existing[0]])).map(r=>r.id),existingIds)
    const ties=await creaCaso('Resti monetari uguali')
    const centRows=[0,1,2].map(i=>({descrizione:'Voce '+i,quantita:1,unita_misura:'pz',prezzo_unitario:0.01,importo_previsto:0.01}))
    const tie=await preview(titolare,[...ties,JSON.stringify(centRows),0.02,...args.slice(4)])
    assert.deepEqual(tie.righe.map(r=>r.importo_contrattuale),[0.01,0.01,0])
    assert.deepEqual(tie.righe.map(r=>r.conguaglio),[0,0,-0.01])
    const duplicate=await creaCaso('Documento duplicato sintetico')
    await q("INSERT INTO public.preventivi_cantiere(cantiere,file_path) SELECT 'Altro storico',file_path FROM public.preventivi_cantiere WHERE id=$1",[duplicate[1]])
    await assert.rejects(preview(titolare,[...duplicate,JSON.stringify(rows),1200,...args.slice(4)]),{code:'22023'})
    const browserSite=await creaCaso('Pernicone Chrome sintetico')
    const browser=require('./browser/attesi-page-browser.cjs')
    let queue=Promise.resolve()
    const actor=(sql,params)=>{
      const request=queue.then(async()=>(await as(titolare,sql,params))[0].v)
      queue=request.catch(error=>{ console.log('SYNTHETIC_RPC_FAILURE',error.code,error.message) })
      return request
    }
    await browser(actor,browserSite[0],{owner:titolare,entry:'ribasso-contrattuale-entry.mjs',modes:['ribasso'],commands:{
      candidati_accordo_contrattuale:['SELECT public.candidati_accordo_contrattuale($1) v','p_cantiere'],
      anteprima_accordo_contrattuale:[previewSql,'p_cantiere','p_preventivo','p_voci','p_importo','p_modalita','p_motivo','p_riferimento','p_nota_documentale'],
      conferma_accordo_contrattuale:[confirmSql,'p_richiesta','p_cantiere','p_preventivo','p_voci','p_importo','p_modalita','p_motivo','p_riferimento','p_nota_documentale','p_token','p_conferma'],
      importa_sal_accordato:['SELECT public.importa_sal_accordato($1,$2,ARRAY(SELECT jsonb_array_elements_text($3::jsonb)::bigint)) v','p_cantiere','p_preventivo','p_ids'],
      aggiorna_avanzamento_sal:['SELECT to_jsonb(r) v FROM public.aggiorna_avanzamento_sal($1,$2,$3) r','p_sal_id','p_percentuale','p_completata'],
      fixture_sal_accordo:["SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY source_lavorazione_id),'[]') v FROM public.sal_lavorazioni s WHERE cantiere_id=$1",'p_cantiere'],
      fixture_documento_accordo:['SELECT to_jsonb(p) v FROM public.preventivi_cantiere p JOIN public.cantieri c ON c.preventivo_contrattuale_id=p.id WHERE c.id=$1','p_cantiere'],
    }})
    console.log('PERNICONE_FIXTURE_GREEN originale=1600 concordato=1200 ribasso=25 sal50=600 sal100=1200')
    return
  }

}
