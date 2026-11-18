/* eslint-disable @typescript-eslint/no-require-imports -- Fixture sintetiche separate per origine. */
module.exports=async function({q,value,as,titolare,esterno,client2,randomUUID,assert,admin}) {
 const createSql='SELECT public.crea_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) v'
 const previewSql='SELECT public.anteprima_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8) v'
 async function caso(nome) {
  const cid=await value('INSERT INTO public.cantieri(nome,lavori_conclusi) VALUES($1,true) RETURNING id v',[nome])
  await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[cid,titolare])
  const pid=await value("INSERT INTO public.preventivi_cantiere(cantiere,cantiere_id,importo_totale,file_path) VALUES($1,$2,1600,$3) RETURNING id v",[nome,cid,'fixture/'+randomUUID()+'.pdf'])
  const voci=JSON.stringify([{descrizione:'Lavori principali',quantita:1,unita_misura:'corpo',prezzo_unitario:850,importo_previsto:850},{descrizione:'Doccia',quantita:1,unita_misura:'corpo',prezzo_unitario:750,importo_previsto:750}])
  const args=[cid,pid,voci,1300,'a_corpo','Concordato1300','Accordo fixture','Originale conservato']
  const p=(await as(titolare,'SELECT public.anteprima_accordo_contrattuale($1,$2,$3::jsonb,$4,$5,$6,$7,$8) v',args))[0].v
  await as(titolare,'SELECT public.conferma_accordo_contrattuale($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)',[randomUUID(),...args,p.token,'CONFERMA CONTRATTO'])
  const fid=await value("INSERT INTO public.fatture_fornitori(fornitore,numero_fattura) VALUES('Fixture',$1) RETURNING id v",[nome])
  return {cid,pid,fid}
 }
 async function riga(fid,quantita=2,prezzo=31) {return value("INSERT INTO public.fatture_fornitori_righe(fattura_id,descrizione,quantita,prezzo_unitario,totale_riga,unita_misura,categoria_economica) VALUES($1,'Materiale fixture',$2,$3,round($2::numeric*$3,2),'PZ','materiale_cantiere') RETURNING id v",[fid,quantita,prezzo])}
 async function raccolta(cid,titolo='Raccolta fixture') {return (await as(titolare,'SELECT public.crea_raccolta_economia($1,$2,$3,$4) v',[cid,titolo,'2026-11-18','Materiali da fattura gia assegnati']))[0].v}
 async function assegna(rac,rid,quantita) {
  const rev=await value('SELECT revisione::int v FROM public.economia_raccolte WHERE id=$1',[rac.id])
  return as(titolare,'SELECT public.salva_bozza_economia($1,$2,$3::jsonb) v',[rac.id,rev,JSON.stringify({righe_da_creare:[{origine:'fattura_fornitore',fattura_riga_id:rid,quantita_da_inviare:String(quantita),unita_misura_economia:'PZ'}]})])
 }
 const eco=await caso('PERNICONE origine Economia'),rid=await riga(eco.fid),rac=await raccolta(eco.cid)
 await assegna(rac,rid,2)
 const eid=await value('SELECT id v FROM public.economia_righe WHERE fattura_riga_id=$1',[rid])
 const costo=()=>value('SELECT round(quantita*prezzo_unitario,2) v FROM public.economia_righe WHERE id=$1',[eid])
 assert.equal(await costo(),'62.00')
 const sorgente=await value('SELECT to_jsonb(r) v FROM public.fatture_fornitori_righe r WHERE id=$1',[rid])
 const materialiCount=await value('SELECT count(*)::int v FROM public.materiali_cantiere WHERE cantiere_id=$1',[eco.cid]);assert.equal(materialiCount,0)
 const finanziari=await value("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.fatture_emesse f),(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti i)) v")
 const salStorici=await q('SELECT id,to_jsonb(s) dato FROM public.sal_lavorazioni s ORDER BY id')
 const revision=()=>value('SELECT revisione::int v FROM public.economia_raccolte WHERE id=$1',[rac.id])
 const price='SELECT public.valorizza_materiale_economia($1,$2,$3,$4) v'
 await assert.rejects(as(esterno,price,[rac.id,eid,31,await revision()]),{code:'42501'})
 // Prezzo cliente diverso dal costo, senza riscrivere la quota acquistata.
 await as(titolare,price,[rac.id,eid,40,await revision()]);assert.equal(await costo(),'62.00')
 const rev=await revision();await as(titolare,price,[rac.id,eid,31,rev])
 await assert.rejects(as(titolare,price,[rac.id,eid,31,rev]),{code:'PT409'})
 const current=await revision(),ponte='SELECT public.usa_raccolta_economia_cliente_in_variante($1,$2) v'
 const outcomes=await Promise.all([as(titolare,ponte,[rac.id,current]),as(titolare,ponte,[rac.id,current],client2)])
 const v=outcomes[0][0].v;assert.equal(v.variante_id,outcomes[1][0].v.variante_id);assert.equal(v.totale,62)
 assert.equal(await value('SELECT stato v FROM public.varianti_cantiere WHERE id=$1',[v.variante_id]),'bozza')
 assert.equal(await value('SELECT count(*)::int v FROM public.sal_lavorazioni WHERE cantiere_id=$1',[eco.cid]),0)
 assert.equal(await value("SELECT (p.accordo_contrattuale->>'importo_concordato')::numeric+coalesce((SELECT sum(importo_delta_approvato) FROM public.varianti_cantiere WHERE cantiere_id=$1 AND stato='approvata'),0) v FROM public.preventivi_cantiere p WHERE id=$2",[eco.cid,eco.pid]),'1300')
 await assert.rejects(as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,$3,$4)',[rid,eco.cid,2,'PZ']))
 const dirette=(await as(titolare,'SELECT public.leggi_quote_addebito_cliente($1) v',[eco.fid]))[0].v;assert.deepEqual(dirette,[])
 await as(titolare,'SELECT public.proponi_variante($1)',[v.variante_id]);await as(titolare,'SELECT public.approva_variante($1,$2)',[v.variante_id,'Extra62 approvato'])
 assert.equal(await value('SELECT importo_delta_approvato v FROM public.varianti_cantiere WHERE id=$1',[v.variante_id]),'62.00')
 assert.equal(await value('SELECT 1300+sum(importo_delta_approvato) v FROM public.varianti_cantiere WHERE cantiere_id=$1 AND stato=\'approvata\'',[eco.cid]),'1362.00')
 assert.equal(await costo(),'62.00');assert.equal(await value('SELECT count(*)::int v FROM public.economia_righe WHERE fattura_riga_id=$1',[rid]),1)
 assert.equal(await value('SELECT count(*)::int v FROM public.materiali_cantiere WHERE cantiere_id=$1',[eco.cid]),0)
 assert.deepEqual(await value('SELECT to_jsonb(r) v FROM public.fatture_fornitori_righe r WHERE id=$1',[rid]),sorgente)
 assert.deepEqual(await value("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.fatture_emesse f),(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti i)) v"),finanziari)
 for(const s of salStorici)assert.deepEqual(await value('SELECT to_jsonb(s) v FROM public.sal_lavorazioni s WHERE id=$1',[s.id]),s.dato)
 console.log('ORIGINE_ECONOMIA_GREEN costo62 bozza1300 approvato1362 no_ribasso_18_75 no_secondo_costo')
 // Destinazioni distinte della stessa fattura: la quota diretta puo essere addebitata
 // anche se il residuo di assegnazione non coincide con il residuo contrattuale.
 const par=await caso('PERNICONE quote parziali'),prid=await riga(par.fid,4,31),prac=await raccolta(par.cid)
 await as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,$3,$4)',[prid,par.cid,2,'PZ'])
 await assegna(prac,prid,1)
 const mid=await value('SELECT id v FROM public.materiali_cantiere WHERE fattura_riga_id=$1',[prid])
 const a=[mid,1,31,false,22,'Quota parziale extra','Accordo esplicito','Fixture parziale']
 const pre=(await as(titolare,previewSql,a))[0].v;assert.equal(pre.costo_originale_quota,31)
 await as(titolare,createSql,[randomUUID(),...a,pre.token])
 const quotes=(await as(titolare,'SELECT public.leggi_quote_addebito_cliente($1) v',[par.fid]))[0].v;assert.equal(quotes[0].disponibile,1)
 await assert.rejects(as(titolare,previewSql,[mid,2,62,false,22,...a.slice(5)]),{code:'23505'})
 const pre2=(await as(titolare,previewSql,a))[0].v;await as(titolare,createSql,[randomUUID(),...a,pre2.token])
 assert.equal(await value('SELECT artecna_guardie.materiali_fattura_totale($1) v',[prid]),'3.000000')
 assert.equal(await value('SELECT count(*)::int v FROM public.materiali_cantiere WHERE fattura_riga_id=$1',[prid]),1)
 console.log('ORIGINE_CANTIERE_PARZIALE_GREEN fattura4 assegnata_cantiere2 economia1 residuo1 addebitata2')
 const storico=await riga(par.fid,1,62)
 await q('UPDATE public.fatture_fornitori_righe SET cantiere_id=$1,cantiere=$2 WHERE id=$3',[par.cid,'PERNICONE quote parziali',storico])
 await q("INSERT INTO public.materiali_cantiere(cantiere,cantiere_id,descrizione,quantita,prezzo_unitario,totale) VALUES('PERNICONE quote parziali',$1,'Storico senza riga UUID',1,62,62)",[par.cid])
 const after=(await as(titolare,'SELECT public.leggi_quote_addebito_cliente($1) v',[par.fid]))[0].v
 assert.equal(after.some(x=>x.fattura_riga_id===storico),false)
 await assert.rejects(as(titolare,previewSql,[randomUUID(),1,62,false,22,...a.slice(5)]),{code:'42501'})
 console.log('STORICO_SENZA_IDENTITA_GREEN nessuna_associazione_per_nome_o_importo')
 await require('./addebitiOriginiDiagnosticaFixture.cjs')({q,admin,titolare,cantiere:par.cid,fattura:par.fid,assert})
 const chrome=await caso('PERNICONE Economia Chrome'),crid=await riga(chrome.fid),crac=await raccolta(chrome.cid,'Quota gia assegnata Chrome')
 await assegna(crac,crid,2)
 const ceid=await value('SELECT id v FROM public.economia_righe WHERE fattura_riga_id=$1',[crid])
 await as(titolare,price,[crac.id,ceid,31,await value('SELECT revisione::int v FROM public.economia_raccolte WHERE id=$1',[crac.id])])
 let queue=Promise.resolve();const actor=(sql,params)=>{const task=queue.then(async()=>(await as(titolare,sql,params))[0].v);queue=task.catch(()=>{});return task}
 await require('./browser/attesi-page-browser.cjs')(actor,crac.id,{owner:titolare,entry:'addebiti-economia-entry.mjs',modes:['economia'],commands:{
  leggi_raccolta_economia_cliente:['SELECT public.leggi_raccolta_economia_cliente($1) v','p_raccolta_id'],
  usa_raccolta_economia_cliente_in_variante:[ponte,'p_raccolta_id','p_revisione_attesa'],
 }})
 assert.equal(await value('SELECT count(*)::int v FROM public.varianti_cantiere WHERE cantiere_id=$1 AND stato=\'bozza\'',[chrome.cid]),1)
 assert.equal(await value('SELECT count(*)::int v FROM public.varianti_cantiere WHERE cantiere_id=$1 AND stato=\'approvata\'',[chrome.cid]),0)
 assert.equal(await value('SELECT round(quantita*prezzo_unitario,2) v FROM public.economia_righe WHERE id=$1',[ceid]),'62.00')
}
