// Dati sintetici, mai Production.
module.exports=async function({q,value,as,load,admin,titolare,esterno,client2,randomUUID,assert}) {
 await q(load('20261116000100_classificazione_cantieri.sql'))
 await admin.query('GRANT artecna_sal_rpc TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE')
 await q(load('20261117000100_accordi_contrattuali.sql'))
 await q(load('20261118000100_addebiti_materiali_cliente.sql'))
 const single=await value("SELECT pg_get_functiondef('public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text)'::regprocedure) v")
 const migration=load('20261119000100_addebiti_materiali_gruppo.sql')
 // eslint-disable-next-line @typescript-eslint/no-require-imports -- Questa fixture è caricata dal runner CommonJS nativo.
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
 const readonly=(file,marker)=>{
  const psql='C:/Program Files/PostgreSQL/18/bin/psql.exe'
  const result=cp.spawnSync(psql,['-X','-w','--dbname',`host=127.0.0.1 port=${admin.connectionParameters.port} dbname=postgres user=postgres`,'-v','ON_ERROR_STOP=1','-f',path.resolve('supabase/diagnostics',file)],{encoding:'utf8',windowsHide:true})
  fs.mkdirSync(path.resolve('.run/addebiti-gruppo'),{recursive:true});fs.writeFileSync(path.resolve('.run/addebiti-gruppo',file+'.log'),result.stdout+result.stderr)
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,new RegExp(marker));assert.equal((result.stdout.match(/^COMMIT\r?$/gm)||[]).length,0);assert.equal((result.stdout.match(/^ROLLBACK\r?$/gm)||[]).length,1)
 }
 readonly('addebiti_gruppo_precheck_readonly.sql','ARTECNA_ADDEBITI_GRUPPO_PRECHECK_READONLY_GREEN')
 await assert.rejects(q(migration.replace(/^COMMIT;$/m,'SELECT 1/0;\nCOMMIT;')),{code:'22012'})
 await q('ROLLBACK')
 assert.equal(await value("SELECT to_regclass('artecna_addebiti.gruppi') IS NULL v"),true)
 await q(migration)
 readonly('addebiti_gruppo_postcheck_readonly.sql','ARTECNA_ADDEBITI_GRUPPO_POSTCHECK_READONLY_GREEN')
 // Provare il sigillo del runner: un payload alterato deve essere rifiutato prima di psql.
 const temp=path.resolve('.run/addebiti-gruppo/verify-tampered');fs.mkdirSync(temp,{recursive:true})
 const script=fs.readFileSync(path.resolve('supabase/diagnostics/RUN-addebiti-gruppo-readonly.ps1'),'utf8')
 fs.writeFileSync(path.join(temp,'RUN.ps1'),script.replace("$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))",`$root='${process.cwd().replaceAll("'","''")}'`))
 fs.copyFileSync('supabase/diagnostics/addebiti_gruppo_hashes.json',path.join(temp,'addebiti_gruppo_hashes.json'))
 // Il manifesto alterato non coincide con i byte SQL esistenti.
 const bad=JSON.parse(fs.readFileSync(path.join(temp,'addebiti_gruppo_hashes.json'),'utf8').replace(/^\uFEFF/,''));bad['supabase/migrations/20261119000100_addebiti_materiali_gruppo.sql']='0'.repeat(64)
 fs.writeFileSync(path.join(temp,'addebiti_gruppo_hashes.json'),JSON.stringify(bad))
 const tampered=cp.spawnSync('powershell.exe',['-NoProfile','-File',path.join(temp,'RUN.ps1'),'-VerifyOnly'],{encoding:'utf8',windowsHide:true})
 assert.notEqual(tampered.status,0);assert.match(tampered.stdout+tampered.stderr,/SHA-256 divergente/)
 assert.equal(await value("SELECT pg_get_functiondef('public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text)'::regprocedure) v"),single)
 assert.equal(await value('SELECT signature=artecna_distruzione.hard_delete_catalog() v FROM artecna_distruzione.hard_delete_catalog_expected'),true)
 // Dopo il confronto del catalogo, dimostrare le guardie anche senza policy.
 await admin.query('ALTER TABLE public.materiali_cantiere DISABLE ROW LEVEL SECURITY; ALTER TABLE public.variante_lavorazioni DISABLE ROW LEVEL SECURITY; ALTER TABLE public.varianti_cantiere DISABLE ROW LEVEL SECURITY')
 const cid=await value("INSERT INTO public.cantieri(nome,lavori_conclusi) VALUES('Gruppo sintetico',true) RETURNING id v")
 await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[cid,titolare])
 const pid=await value("INSERT INTO public.preventivi_cantiere(cantiere,cantiere_id,importo_totale,nome_file,file_path) VALUES('Gruppo sintetico',$1,1300,'Sintetico.pdf','fixture/gruppo.pdf') RETURNING id v",[cid])
 await q('UPDATE public.cantieri SET preventivo_contrattuale_id=$1 WHERE id=$2',[pid,cid])
 const fid=await value("INSERT INTO public.fatture_fornitori(fornitore,numero_fattura) VALUES('Sintetico','GRUPPO') RETURNING id v")
 const creaQuota=async(costo=10)=>{
  const rid=await value("INSERT INTO public.fatture_fornitori_righe(fattura_id,descrizione,quantita,prezzo_unitario,totale_riga,unita_misura,categoria_economica) VALUES($1,'Materiale sintetico',1,$2,$2,'CAD','materiale_cantiere') RETURNING id v",[fid,costo])
  await as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,1,\'CAD\')',[rid,cid])
  return value('SELECT id v FROM public.materiali_cantiere WHERE fattura_riga_id=$1',[rid])
 }
 const riga=(id,importo=10,quantita=1)=>({materiale_id:id,quantita,importo,iva_inclusa:false,aliquota:22,iva_confermata:true,descrizione:'Extra sintetico',motivo:'Concordato',riferimento:'Accordo fixture'})
 const prevSql='SELECT public.anteprima_addebiti_gruppo($1,$2::jsonb) v',createSql='SELECT public.crea_addebiti_gruppo($1,$2,$3::jsonb,$4) v'
 const preview=async(rows,user=titolare)=>(await as(user,prevSql,[cid,JSON.stringify(rows)]))[0].v
 const create=async(rows,p,key=randomUUID(),conn)=> (await as(titolare,createSql,[key,cid,JSON.stringify(rows),p.token],conn))[0].v
 const partialId=await creaQuota(),partial=[riga(partialId,7,0.5)],p=await preview(partial)
 await assert.rejects(preview(partial,esterno),{code:'42501'})
 await assert.rejects(as(esterno,createSql,[randomUUID(),cid,JSON.stringify(partial),p.token]),{code:'42501'})
 for(const bad of [[partial[0],partial[0]],[{...partial[0],iva_confermata:false}],[{...partial[0],aliquota:null}],[{...partial[0],importo:1.001}]])await assert.rejects(preview(bad))
 const gross=await preview([{...partial[0],importo:12.2,iva_inclusa:true}]);assert.equal(gross.netto,10)
 const key=randomUUID(),out=await create(partial,p,key)
 assert.equal((await create(partial,p,key)).variante_id,out.variante_id)
 await assert.rejects(create([{...partial[0],importo:8}],p,key),{code:'23505'})
 assert.equal((await as(titolare,'SELECT public.leggi_quote_addebito_gruppo($1) v',[fid]))[0].v.find(r=>r.materiale_id===partialId).disponibile,0.5)
 const singleArgs=[partialId,0.6,8,false,22,'Extra','Motivo','Accordo']
 const oldPreview=(await as(titolare,'SELECT public.anteprima_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8) v',singleArgs))[0].v
 await assert.rejects(as(titolare,'SELECT public.crea_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),...singleArgs,oldPreview.token]),{code:'23505'})
 const mids=[];for(const cost of [2.62,1.48,5,2.95,.08,3.43,2.3,4.31,.75])mids.push(await creaQuota(cost))
 const rows=mids.map((m,i)=>riga(m,i===8?6.88:6.89))
 const dataDigest=()=>value(`SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.materiali_cantiere m),
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.fatture_fornitori_righe r),
 (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.fatture_fornitori f),
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.pagamenti_fornitori p),
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.preventivi_cantiere p),
 (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.sal_lavorazioni s),
 (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti i)) v`)
 const before=await dataDigest(),nine=await preview(rows);assert.equal(nine.netto,62);assert.equal(nine.contratto_attuale,1300);assert.equal(nine.contratto_dopo_approvazione,1362)
 assert.equal(nine.righe.reduce((n,r)=>n+Math.round(r.costo_originale_quota*100),0),2292)
 const group=await create(rows,nine)
 assert.equal(await value('SELECT count(*)::int v FROM public.variante_lavorazioni WHERE variante_id=$1',[group.variante_id]),9)
 assert.equal(await value('SELECT stato v FROM public.varianti_cantiere WHERE id=$1',[group.variante_id]),'bozza')
 assert.deepEqual(await dataDigest(),before)
 await assert.rejects(create(rows,nine),{code:'23505'})
 await assert.rejects(as(titolare,'UPDATE artecna_addebiti.gruppi SET netto=1'),{code:'42501'})
 await assert.rejects(as(titolare,'UPDATE public.variante_lavorazioni SET prezzo_unitario=1 WHERE variante_id=$1',[group.variante_id]),{code:'55000'})
 await assert.rejects(as(titolare,'UPDATE public.materiali_cantiere SET totale=0 WHERE id=$1',[mids[0]]),{code:'55000'})
 // Errore sul secondo inserimento: neppure la prima lavorazione o la testata devono sopravvivere.
 const faultRows=[riga(await creaQuota()),riga(await creaQuota())].sort((a,b)=>a.materiale_id.localeCompare(b.materiale_id))
 faultRows[1].descrizione='FAULT'
 const faultP=await preview(faultRows)
 await q("CREATE FUNCTION public.fixture_fault_gruppo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.descrizione='FAULT' THEN RAISE EXCEPTION 'fixture fault'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_fault BEFORE INSERT ON public.variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION public.fixture_fault_gruppo()")
 const count=()=>value('SELECT jsonb_build_array((SELECT count(*) FROM public.varianti_cantiere),(SELECT count(*) FROM public.variante_lavorazioni),(SELECT count(*) FROM artecna_addebiti.gruppi),(SELECT count(*) FROM artecna_addebiti.righe_gruppo)) v')
 const counts=await count();await assert.rejects(create(faultRows,faultP),{code:'P0001'});assert.deepEqual(await count(),counts)
 await q('DROP TRIGGER fixture_fault ON public.variante_lavorazioni; DROP FUNCTION public.fixture_fault_gruppo()')
 const raceRows=[riga(await creaQuota())],raceP=await preview(raceRows)
 const race=await Promise.allSettled([create(raceRows,raceP),create(raceRows,raceP,randomUUID(),client2)])
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1)
 const replayRows=[riga(await creaQuota())],replayP=await preview(replayRows),replayKey=randomUUID()
 const replay=await Promise.all([create(replayRows,replayP,replayKey),create(replayRows,replayP,replayKey,client2)])
 assert.equal(replay[0].variante_id,replay[1].variante_id);assert.equal(replay.filter(r=>r.riutilizzata).length,1)
 const mixedId=await creaQuota(),mixedRows=[riga(mixedId)],mixedP=await preview(mixedRows),args=[mixedId,1,10,false,22,'Extra','Motivo','Accordo']
 const sp=(await as(titolare,'SELECT public.anteprima_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8) v',args))[0].v
 const mixed=await Promise.allSettled([create(mixedRows,mixedP),as(titolare,'SELECT public.crea_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),...args,sp.token],client2)])
 assert.equal(mixed.filter(r=>r.status==='fulfilled').length,1)
 // Le transizioni di stato non possono riattivare prenotazioni ormai occupate.
 const lifeId=await creaQuota(),oldArgs=[lifeId,1,10,false,22,'Extra','Motivo','Accordo']
 const oldP=(await as(titolare,'SELECT public.anteprima_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8) v',oldArgs))[0].v
 const oldV=(await as(titolare,'SELECT public.crea_addebito_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) v',[randomUUID(),...oldArgs,oldP.token]))[0].v.variante_id
 async function statoAutorizzato(vid,stato) {
  await admin.query('BEGIN')
  try { await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[titolare]);await admin.query('SET LOCAL ROLE artecna_varianti_rpc');await admin.query('UPDATE public.varianti_cantiere SET stato=$1 WHERE id=$2',[stato,vid]);await admin.query('COMMIT') }
  catch(e){await admin.query('ROLLBACK');throw e}
 }
 await statoAutorizzato(oldV,'annullata')
 const lifeRows=[riga(lifeId)],lifeP=await preview(lifeRows);await create(lifeRows,lifeP)
 await assert.rejects(statoAutorizzato(oldV,'bozza'),{code:'23505'})
 // Nessun collegamento ad altri cantieri, anche per un utente proprietario di entrambi.
 const otherCid=await value("INSERT INTO public.cantieri(nome) VALUES('Altro sintetico') RETURNING id v")
 await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[otherCid,titolare])
 const otherPid=await value("INSERT INTO public.preventivi_cantiere(cantiere,cantiere_id,importo_totale,nome_file,file_path) VALUES('Altro sintetico',$1,100,'Altro.pdf','fixture/altro.pdf') RETURNING id v",[otherCid])
 await q('UPDATE public.cantieri SET preventivo_contrattuale_id=$1 WHERE id=$2',[otherPid,otherCid])
 const otherRid=await value("INSERT INTO public.fatture_fornitori_righe(fattura_id,descrizione,quantita,prezzo_unitario,totale_riga,unita_misura,categoria_economica) VALUES($1,'Altro',1,1,1,'CAD','materiale_cantiere') RETURNING id v",[fid])
 await as(titolare,'SELECT public.assegna_materiale_fattura_cantiere($1,$2,1,\'CAD\')',[otherRid,otherCid])
 const otherMid=await value('SELECT id v FROM public.materiali_cantiere WHERE fattura_riga_id=$1',[otherRid])
 await assert.rejects(preview([riga(otherMid)]),{code:'42501'})
 await as(titolare,'SELECT public.proponi_variante($1)',[group.variante_id])
 await as(titolare,'SELECT public.approva_variante($1,$2)',[group.variante_id,'Accordo sintetico'])
 assert.equal(await value('SELECT importo_delta_approvato v FROM public.varianti_cantiere WHERE id=$1',[group.variante_id]),'62.00')
 assert.equal(await value('SELECT sum(importo_previsto) v FROM public.sal_lavorazioni WHERE cantiere_id=$1',[cid]),'62.00')
 console.log('ADDEBITI_GRUPPO_POSTGRES_GREEN nove_quote=9 costo_fixture=22.92 netto_fixture=62 bozza_base=1300 approvato=1362 rollback=true concorrenza_mista=true')
}
