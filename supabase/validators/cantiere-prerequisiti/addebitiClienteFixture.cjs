/* eslint-disable @typescript-eslint/no-require-imports -- Fixture sintetica PostgreSQL 17.6. */
module.exports=async function({q,value,as,load,admin,titolare,esterno,client2,randomUUID,assert}) {
 await q(load('20261116000100_classificazione_cantieri.sql'))
 await admin.query('GRANT artecna_sal_rpc TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE')
 await q(load('20261117000100_accordi_contrattuali.sql'))
 const digest=()=>value(`SELECT jsonb_build_array(
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.fatture_emesse t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti t),
  pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure),
  pg_get_functiondef('public.approva_variante(uuid,text)'::regprocedure),
  pg_get_functiondef('public.importa_variante_approvata_nel_sal(uuid)'::regprocedure)) v`)
 const preserved=await digest()
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
 const runtime=path.resolve('.run/addebiti-cliente');fs.mkdirSync(runtime,{recursive:true})
 await q('CREATE SCHEMA IF NOT EXISTS cron; CREATE TABLE IF NOT EXISTS cron.job(jobid bigint,command text)')
 const generator=path.join(runtime,'generate-installer.ps1'),payloadFile=path.join(runtime,'apply-fixture.sql')
 fs.writeFileSync(generator,["$ErrorActionPreference='Stop'",". './supabase/diagnostics/RUN-addebiti-cliente.ps1' -VerifyOnly",
  "if ($PSVersionTable.PSVersion.Major -ne 5) { throw 'PS51 richiesto' }",
  "[IO.File]::WriteAllText((Join-Path $root '.run/addebiti-cliente/apply-fixture.sql'),$applyPayload,[Text.UTF8Encoding]::new($false))"].join('\n'))
 const generated=cp.spawnSync('powershell.exe',['-NoProfile','-File',generator],{encoding:'utf8',windowsHide:true});assert.equal(generated.status,0,generated.stdout+generated.stderr)
 const psql=path.resolve('.run/cantiere-prereq-runtime/minimal/pgsql/bin/psql.exe')
 const invoke=file=>cp.spawnSync(psql,['-X','-w','--dbname',`host=127.0.0.1 port=${admin.connectionParameters.port} dbname=postgres user=postgres`,'-v','ON_ERROR_STOP=1','-f',file],{encoding:'utf8',windowsHide:true})
 const payload=fs.readFileSync(payloadFile,'utf8'),failedFile=path.join(runtime,'failed-apply.sql')
 fs.writeFileSync(failedFile,payload.replace(/^COMMIT;\r?$/m,'SELECT 1/0;\nCOMMIT;'))
 const failure=invoke(failedFile);assert.equal(failure.status,3);assert.doesNotMatch(failure.stdout,/^COMMIT\r?$/m)
 assert.equal(await value("SELECT to_regnamespace('artecna_addebiti') IS NULL v"),true)
 const installed=invoke(payloadFile);assert.equal(installed.status,0,installed.stdout+installed.stderr)
 assert.equal((installed.stdout.match(/^COMMIT\r?$/gm)||[]).length,1);assert.equal((installed.stdout.match(/^ROLLBACK\r?$/gm)||[]).length,2);assert.match(installed.stdout,/DATI_INVARIATI=true/)
 const again=invoke(payloadFile);assert.equal(again.status,3);assert.doesNotMatch(again.stdout,/^COMMIT\r?$/m)
 console.log('ADDEBITI_INSTALLER_PS51_GREEN COMMIT=1 ROLLBACK=2 DATI_INVARIATI=true rollback_fault=true')
 // Prova le guardie anche con grant diretti e policy disabilitate, solo in fixture.
 await admin.query('ALTER TABLE public.fatture_fornitori_righe DISABLE ROW LEVEL SECURITY; ALTER TABLE public.variante_lavorazioni DISABLE ROW LEVEL SECURITY; ALTER TABLE public.varianti_cantiere DISABLE ROW LEVEL SECURITY')
 assert.deepEqual(await digest(),preserved)
 const cid=await value("INSERT INTO public.cantieri(nome,lavori_conclusi) VALUES('PERNICONE fixture addebito',true) RETURNING id v")
 await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[cid,titolare])
 const pid=await value("INSERT INTO public.preventivi_cantiere(cantiere,cantiere_id,importo_totale,nome_file,file_path) VALUES('PERNICONE fixture addebito',$1,1600,'Originale.pdf','fixture/addebito-originale.pdf') RETURNING id v",[cid])
 await q('UPDATE public.cantieri SET preventivo_contrattuale_id=$1 WHERE id=$2',[pid,cid])
 const originali=JSON.stringify([{descrizione:'Lavori principali',quantita:1,unita_misura:'corpo',prezzo_unitario:850,importo_previsto:850},{descrizione:'Doccia',quantita:1,unita_misura:'corpo',prezzo_unitario:750,importo_previsto:750}])
 const accordoArgs=[cid,pid,originali,1300,'a_corpo','Accordo sintetico1300','Riferimento fixture','PDF originale preservato']
 const accordo=(await as(titolare,'SELECT public.anteprima_accordo_contrattuale($1,$2,$3::jsonb,$4,$5,$6,$7,$8) v',accordoArgs))[0].v
 await as(titolare,'SELECT public.conferma_accordo_contrattuale($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)',[randomUUID(),...accordoArgs,accordo.token,'CONFERMA CONTRATTO'])
 const fid=await value("INSERT INTO public.fatture_fornitori(fornitore,numero_fattura) VALUES('Fornitore sintetico','EXTRA-62') RETURNING id v")
 const rid=await value("INSERT INTO public.fatture_fornitori_righe(fattura_id,descrizione,quantita,prezzo_unitario,totale_riga,unita_misura,categoria_economica) VALUES($1,'Materiale doccia',2,25,50,'PZ','materiale_cantiere') RETURNING id v",[fid])
 await as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,$3,$4)',[rid,cid,2,'PZ'])
 const mid=await value('SELECT id v FROM public.materiali_cantiere WHERE fattura_riga_id=$1',[rid])
 const costBefore=await value('SELECT to_jsonb(m) v FROM public.materiali_cantiere m WHERE id=$1',[mid])
 const salBefore=await q('SELECT id,to_jsonb(s) dato FROM public.sal_lavorazioni s ORDER BY id')
 const rowBefore=await value('SELECT to_jsonb(r) v FROM public.fatture_fornitori_righe r WHERE id=$1',[rid])
 const previewSql='SELECT public.anteprima_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8) v'
 const createSql='SELECT public.crea_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) v'
 const args=[mid,2,62,false,22,'Extra materiali doccia','Extra concordato','Accordo fixture']
 const preview=async(a=args,user=titolare)=>(await as(user,previewSql,a))[0].v
 await assert.rejects(preview(args,esterno),{code:'42501'})
 const p=await preview();assert.equal(p.netto,62);assert.equal(p.contratto_attuale,1300);assert.equal(p.contratto_dopo_approvazione,1362);assert.equal(p.costo_originale_quota,50)
 for(const bad of [[mid,0,62,false,22,...args.slice(5)],[mid,2,62.001,false,22,...args.slice(5)],[mid,3,62,false,22,...args.slice(5)]])await assert.rejects(preview(bad))
 await q("UPDATE public.fatture_fornitori_righe SET descrizione='Revisione sorgente' WHERE id=$1",[rid])
 await assert.rejects(as(titolare,createSql,[randomUUID(),...args,p.token]),{code:'40001'})
 await q("UPDATE public.fatture_fornitori_righe SET descrizione='Materiale doccia' WHERE id=$1",[rid])
 const gross=await preview([mid,2,75.64,true,22,...args.slice(5)]);assert.equal(gross.netto,62)
 const request=randomUUID(),command=[request,...args,p.token]
 const result=await as(titolare,createSql,command);const vid=result[0].v.variante_id
 assert.equal(await value('SELECT stato v FROM public.varianti_cantiere WHERE id=$1',[vid]),'bozza')
 assert.equal(await value("SELECT accordo_contrattuale->>'importo_concordato' v FROM public.preventivi_cantiere WHERE id=$1",[pid]),'1300')
 assert.equal(await value('SELECT importo_totale v FROM public.preventivi_cantiere WHERE id=$1',[pid]),'1600')
 const replay=(await as(titolare,createSql,command))[0].v;assert.equal(replay.variante_id,vid);assert.equal(replay.riutilizzata,true)
 await assert.rejects(as(titolare,createSql,[request,mid,2,63,...args.slice(3),p.token]),{code:'23505'})
 await assert.rejects(as(titolare,createSql,[randomUUID(),...args,p.token]),{code:'23505'})
 await assert.rejects(as(titolare,'UPDATE public.materiali_cantiere SET totale=100 WHERE id=$1',[mid]),{code:'55000'})
 await assert.rejects(as(titolare,'UPDATE public.fatture_fornitori_righe SET prezzo_unitario=100 WHERE id=$1',[rid]),{code:'55000'})
 await assert.rejects(as(titolare,'UPDATE public.variante_lavorazioni SET prezzo_unitario=99 WHERE variante_id=$1',[vid]),{code:'55000'})
 await assert.rejects(as(titolare,"UPDATE public.varianti_cantiere SET titolo='Alterata' WHERE id=$1",[vid]),{code:'42501'})
 await assert.rejects(as(esterno,'SELECT public.approva_variante($1,$2)',[vid,'Non autorizzata']))
 await assert.rejects(as(esterno,'SELECT public.proponi_variante($1)',[vid]),{code:'42501'})
 await assert.rejects(as(titolare,'UPDATE artecna_addebiti.richieste SET netto=1'),{code:'42501'})
 await assert.rejects(as(titolare,'TRUNCATE public.materiali_cantiere'),{code:'0A000'})
 await assert.rejects(as(titolare,'TRUNCATE public.materiali_cantiere CASCADE'),{code:'42501'})
 // Anche superando i grant sulle dipendenze, il trigger ferma la cascata.
 await assert.rejects(admin.query('TRUNCATE public.materiali_cantiere CASCADE'),{code:'55000'})
 assert.equal(await value('SELECT count(*)::int v FROM public.sal_lavorazioni WHERE cantiere_id=$1',[cid]),0)
 await as(titolare,'SELECT public.proponi_variante($1)',[vid])
 await as(titolare,'SELECT public.approva_variante($1,$2)',[vid,'Approvazione fixture'])
 assert.equal(await value('SELECT importo_delta_approvato v FROM public.varianti_cantiere WHERE id=$1',[vid]),'62.00')
 assert.equal(await value('SELECT 1300+sum(importo_delta_approvato) v FROM public.varianti_cantiere WHERE cantiere_id=$1 AND stato=\'approvata\'',[cid]),'1362.00')
 assert.equal(await value('SELECT sum(importo_previsto) v FROM public.sal_lavorazioni WHERE cantiere_id=$1',[cid]),'62.00')
 assert.deepEqual(await value('SELECT to_jsonb(m) v FROM public.materiali_cantiere m WHERE id=$1',[mid]),costBefore)
 assert.deepEqual(await value('SELECT to_jsonb(r) v FROM public.fatture_fornitori_righe r WHERE id=$1',[rid]),rowBefore)
 assert.deepEqual(await digest(),preserved)
 for(const row of salBefore)assert.deepEqual(await value('SELECT to_jsonb(s) v FROM public.sal_lavorazioni s WHERE id=$1',[row.id]),row.dato)
 // Due richieste concorrenti sulla stessa quota: una sola puo riservarla.
 const rid2=await value("INSERT INTO public.fatture_fornitori_righe(fattura_id,descrizione,quantita,prezzo_unitario,totale_riga,unita_misura,categoria_economica) VALUES($1,'Altra quota',1,20,20,'PZ','materiale_cantiere') RETURNING id v",[fid])
 await as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,$3,$4)',[rid2,cid,1,'PZ'])
 const mid2=await value('SELECT id v FROM public.materiali_cantiere WHERE fattura_riga_id=$1',[rid2])
 const a2=[mid2,1,10,false,0,...args.slice(5)],p2=await preview(a2)
 const raceArgs=[[randomUUID(),...a2,p2.token],[randomUUID(),...a2,p2.token]]
 const races=await Promise.allSettled([as(titolare,createSql,raceArgs[0]),as(titolare,createSql,raceArgs[1],client2)])
 assert.equal(races.filter(x=>x.status==='fulfilled').length,1)
 const winning=raceArgs[races.findIndex(x=>x.status==='fulfilled')]
 const replays=await Promise.all([as(titolare,createSql,winning),as(titolare,createSql,winning,client2)])
 assert.equal(replays[0][0].v.variante_id,replays[1][0].v.variante_id);assert.equal(replays[0][0].v.riutilizzata,true)
 const stale=await preview([mid2,0.1,1,false,0,...args.slice(5)]).catch(()=>null);assert.equal(stale,null)
 const browser=require('./browser/attesi-page-browser.cjs');let queue=Promise.resolve()
 const actor=(sql,params)=>{const task=queue.then(async()=>(await as(titolare,sql,params))[0].v);queue=task.catch(()=>{});return task}
 // Una nuova quota per la UI: nessuna quantita da riassegnare.
 const rid3=await value("INSERT INTO public.fatture_fornitori_righe(fattura_id,descrizione,quantita,prezzo_unitario,totale_riga,unita_misura,categoria_economica) VALUES($1,'Quota Chrome',1,12,12,'PZ','materiale_cantiere') RETURNING id v",[fid])
 await as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,$3,$4)',[rid3,cid,1,'PZ'])
 await browser(actor,fid,{owner:titolare,entry:'addebiti-cliente-entry.mjs',modes:['addebito'],commands:{
  leggi_quote_addebito_cliente:['SELECT public.leggi_quote_addebito_cliente($1) v','p_fattura'],
  anteprima_addebito_cliente:[previewSql,'p_materiale','p_quantita','p_importo','p_iva_inclusa','p_aliquota','p_descrizione','p_motivo','p_riferimento'],
  crea_addebito_cliente:[createSql,'p_richiesta','p_materiale','p_quantita','p_importo','p_iva_inclusa','p_aliquota','p_descrizione','p_motivo','p_riferimento','p_token'],
 }})
 console.log('ADDEBITO_FIXTURE_GREEN base=1300 bozza=1300 approvato=1362 costo=50 singolo nessun_incasso')
}
