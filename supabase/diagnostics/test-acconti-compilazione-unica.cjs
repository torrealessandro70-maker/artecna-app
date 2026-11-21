/* eslint-disable @typescript-eslint/no-require-imports -- Local PostgreSQL fixture. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'supabase/validators/cantiere-prerequisiti/contratto-acconti-sdi.test.cjs');
async function verifica({q,value,as,load,admin,titolare,esterno,client2,randomUUID}){
 // Complete the accounting baseline through Production main e4ee9bbd,
 // including grouped material charges, but deliberately never install mixed charges.
 await q(load('20261116000100_classificazione_cantieri.sql'));
 await admin.query('GRANT artecna_sal_rpc TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE');
 for(const name of ['20261117000100_accordi_contrattuali.sql','20261118000100_addebiti_materiali_cliente.sql','20261119000100_addebiti_materiali_gruppo.sql'])await q(load(name));
 assert.equal(await value("SELECT to_regprocedure('public.crea_addebiti_gruppo(uuid,uuid,jsonb,text)') IS NOT NULL v"),true);
 const mixedAbsent=()=>value("SELECT to_regclass('artecna_addebiti.voci_manuali') IS NULL AND to_regprocedure('public.anteprima_addebiti_misti(uuid,jsonb,jsonb,boolean)') IS NULL AND to_regprocedure('public.crea_addebiti_misti(uuid,uuid,jsonb,jsonb,boolean,text)') IS NULL v");
 assert.equal(await mixedAbsent(),true);
 // Reproduce the known Cron privilege boundary in this local cluster only.
 assert.equal(await value("SELECT to_regclass('cron.job') IS NULL v"),true);
 await admin.query("CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint PRIMARY KEY,command text); INSERT INTO cron.job VALUES(1,'SELECT 1'); GRANT USAGE ON SCHEMA cron TO postgres; GRANT SELECT ON cron.job TO postgres");
 assert.equal(await value("SELECT has_table_privilege(current_user,'cron.job','MAINTAIN,UPDATE,DELETE,TRUNCATE') v"),false);
 const cronBefore=await value('SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY jobid)::text) v FROM cron.job t');
 const precheck=path.join(root,'supabase/diagnostics/acconti_compilazione_precheck_readonly.sql');
 const runPrecheck=()=>cp.spawnSync(path.join(root,'.run/cantiere-prereq-runtime/minimal/pgsql/bin/psql.exe'),['-X','-w','-h','127.0.0.1','-p',String(admin.connectionParameters.port),'-U','postgres','-d','postgres','-f',precheck],{encoding:'utf8',windowsHide:true});
 const pre=runPrecheck();assert.equal(pre.status,0,pre.stdout+pre.stderr);assert.match(pre.stdout,/ARTECNA_ACCONTI_COMPILAZIONE_PRECHECK_READONLY_GREEN/);assert(!/^COMMIT\r?$/m.test(pre.stdout));assert.equal((pre.stdout.match(/^ROLLBACK\r?$/gm)||[]).length,1);
 fs.mkdirSync(path.join(root,'.run/acconti-rilascio-indipendente'),{recursive:true});fs.writeFileSync(path.join(root,'.run/acconti-rilascio-indipendente/precheck-local.log'),pre.stdout+pre.stderr);
 const migration=load('20261121000100_acconti_compilazione_unica.sql');await q(migration);assert.equal(await mixedAbsent(),true);
 assert.equal(runPrecheck().status,3,'Installed/partial states must stop');
 const cid=await value("INSERT INTO public.cantieri(nome) VALUES('ACCONTI SINTETICI') RETURNING id v");
 await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[cid,titolare]);
 const call=(request,id,original,patch,proposal=null,user=titolare)=>as(user,'SELECT public.salva_acconto_compilazione($1,$2,$3,$4,$5,$6) v',[request,id,cid,JSON.stringify(original),JSON.stringify(patch),proposal===null?null:JSON.stringify(proposal)]);
 // SQL NULL, not JSON null, identifies creation.
 const create=async(request,id,patch,proposal)=>as(titolare,'SELECT public.salva_acconto_compilazione($1,$2,$3,NULL,$4,$5) v',[request,id,cid,JSON.stringify(patch),proposal?JSON.stringify(proposal):null]);
 const read=id=>value('SELECT to_jsonb(a) v FROM public.acconti_cantiere a WHERE id=$1',[id]);
 const original=a=>[a.descrizione,a.importo,a.data_incasso,a.metodo,a.nota,a.compilazione_unica?.richiesta??null];
 const patch={descrizione:'Acconto sintetico',importo:4545.45,data_incasso:'2026-01-01',metodo:'bonifico',nota:'Fonte da verificare'};
 const id=randomUUID(),request=randomUUID();const first=(await create(request,id,patch,{lordo:5000,aliquota:10}))[0].v;
 assert.equal(first.id,id);assert.equal(first.compilazione_unica.proposta.lordo,5000);
 await create(request,id,patch,{lordo:5000,aliquota:10});
 assert.equal(await value('SELECT count(*)::int v FROM public.acconti_cantiere WHERE id=$1',[id]),1);
 await assert.rejects(create(request,id,{...patch,importo:1},null),{code:'23505'});
 await assert.rejects(call(randomUUID(),id,original(first),{nota:'non autorizzato'},null,esterno),{code:'42501'});
 for(const changes of [{descrizione:'Descrizione aggiornata'},{nota:'Nota aggiornata'},{data_incasso:'2026-01-02'},{metodo:'contanti'},{importo:100}]){
  const before=await read(id);const after=(await call(randomUUID(),id,original(before),changes))[0].v;
  for(const k of ['descrizione','importo','data_incasso','metodo','nota'])assert.equal(after[k],k in changes?changes[k]:before[k]);assert.equal(after.id,id);
 }
 await assert.rejects(call(randomUUID(),id,original(first),{nota:'conflitto'}),{code:'40001'});
 const document=id;
 await as(titolare,"SELECT public.registra_acconto_fiscale($1,0,'incassato','ordinario','2026-01-02','Conferma sintetica')",[document]);
 await as(titolare,"SELECT public.conferma_incasso_lordo_cliente($1,$2,122,'2026-01-02','bonifico',$3,'Estratto sintetico')",[randomUUID(),document,randomUUID()]);
 const fingerprint=()=>value("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t)) FROM artecna_contabilita.acconti_fiscali t WHERE acconto_id=$1),(SELECT jsonb_agg(to_jsonb(t)) FROM artecna_contabilita.incassi_lordi_clienti t WHERE acconto_id=$1)) v",[document]);
 const before=await fingerprint();
 const linked=await value("SELECT to_jsonb(a) v FROM public.acconti_cantiere a WHERE EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti x WHERE x.acconto_id=a.id AND x.scollegato_at IS NULL) AND artecna_guardie.utente_puo_modificare_cantiere($1,a.cantiere_id) ORDER BY a.id LIMIT 1",[titolare]);
 assert(linked,'Fixture must contain an existing invoice-linked advance');
 const protectedState=()=>value("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.attribuzioni_clienti t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.quote_lorde_clienti t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_notifiche.notifica t)) v");
 const protectedBefore=await protectedState();
 await as(titolare,'SELECT public.salva_acconto_compilazione($1,$2,$3,$4,$5,NULL)',[randomUUID(),linked.id,linked.cantiere_id,JSON.stringify(original(linked)),JSON.stringify({nota:'Nota descrittiva sintetica, collegamenti invariati'})]);
 assert.deepEqual(await protectedState(),protectedBefore);
 const fourSite=await value("INSERT INTO public.cantieri(nome) VALUES('QUATTRO ACCONTI SOLO FIXTURE') RETURNING id v");
 await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[fourSite,titolare]);
 const fourth=randomUUID();
 for(let n=1;n<=4;n++)await q('INSERT INTO public.acconti_cantiere(id,cantiere_id,importo,metodo,data_incasso,descrizione) VALUES($1,$2,$3,\'bonifico\',\'2026-01-01\',$4)',[n===4?fourth:randomUUID(),fourSite,n===4?4545.45:100*n,'Acconto sintetico '+n]);
 await as(titolare,"SELECT public.conferma_incasso_lordo_cliente($1,$2,5000,'2026-01-01','bonifico',$3,'Fonte sintetica quarto acconto')",[randomUUID(),fourth,randomUUID()]);
 const fourthBefore=await read(fourth);
 const returned=await as(titolare,'SELECT public.salva_acconto_compilazione($1,$2,$3,$4,$5,NULL) v',[randomUUID(),fourth,fourSite,JSON.stringify(original(fourthBefore)),JSON.stringify({nota:'Sola modifica descrittiva del quarto acconto'})]);
 assert.equal(returned[0].v.id,fourth);assert.equal(returned[0].v.importo,4545.45);
 assert.equal(await value('SELECT count(*)::int v FROM public.acconti_cantiere WHERE cantiere_id=$1',[fourSite]),4);
 assert.equal(await value('SELECT sum(importo) v FROM artecna_contabilita.incassi_lordi_clienti WHERE acconto_id=$1',[fourth]),'5000.00');
 for(const changes of [{importo:101},{data_incasso:'2026-01-03'},{metodo:'bonifico'}])await assert.rejects(call(randomUUID(),id,original(await read(id)),changes),{code:'23514'});
 await assert.rejects(q('UPDATE public.acconti_cantiere SET importo=101 WHERE id=$1',[id]),{code:'23514'});
 await assert.rejects(call(randomUUID(),id,original(await read(id)),{},{lordo:110,aliquota:10}),{code:'23514'});
 await call(randomUUID(),id,original(await read(id)),{descrizione:'Solo testo',nota:'Nessuna rettifica economica'});
 assert.deepEqual(await fingerprint(),before);
 const historical=randomUUID();await q("INSERT INTO public.acconti_cantiere(id,cantiere_id,importo,nota) VALUES($1,$2,NULL,'Storico')",[historical,cid]);
 const historic=await read(historical);await call(randomUUID(),historical,original(historic),{nota:'Nota storica aggiornata'});
 assert.equal((await read(historical)).compilazione_unica.proposta,null);
 await as(titolare,"SELECT public.registra_acconto_fiscale($1,0,'previsto','da_verificare',NULL,'Non ancora accreditato')",[historical]);
 assert.equal((await as(titolare,'SELECT public.leggi_acconto_compilazione($1) v',[historical]))[0].v.documentato,false);
 await call(randomUUID(),historical,original(await read(historical)),{importo:50});
 assert.equal((await as(titolare,'SELECT public.leggi_acconto_compilazione($1) v',[historical]))[0].v.coerente,false);
 assert.equal((await as(titolare,'SELECT public.leggi_acconto_compilazione($1) v',[id]))[0].v.documentato,true);
 await assert.rejects(as(esterno,'SELECT public.leggi_acconto_compilazione($1)',[id]),{code:'42501'});
 const race=randomUUID(),raceRequest=randomUUID();
 const sql='SELECT public.salva_acconto_compilazione($1,$2,$3,NULL,$4,NULL) v';
 const args=[raceRequest,race,cid,JSON.stringify(patch)];
 const pair=await Promise.all([as(titolare,sql,args),as(titolare,sql,args,client2)]);
 assert.equal(pair[0][0].v.id,pair[1][0].v.id);
 assert.equal(await value('SELECT count(*)::int v FROM public.acconti_cantiere WHERE id=$1',[race]),1);
 const observed=await read(race);
 const competing=await Promise.allSettled([
  call(randomUUID(),race,original(observed),{importo:200}),
  as(titolare,"SELECT public.registra_acconto_fiscale($1,0,'incassato','ordinario','2026-01-01','Conferma concorrente sintetica')",[race],client2),
 ]);
 assert(competing[1].status==='fulfilled');
 if(competing[0].status==='rejected')assert.equal(competing[0].reason.code,'23514');
 assert.equal(await value('SELECT f.fonte=artecna_contabilita.fonte_acconto(a) v FROM artecna_contabilita.acconti_fiscali f JOIN public.acconti_cantiere a ON a.id=f.acconto_id WHERE a.id=$1',[race]),true);
 // Atomic rollback, no leaked id or fiscal record.
 const rollback=randomUUID();await q('BEGIN');await q('SELECT set_config(\'request.jwt.claim.sub\',$1,true)',[titolare]);await q('SELECT public.salva_acconto_compilazione($1,$2,$3,NULL,$4,NULL)',[randomUUID(),rollback,cid,JSON.stringify(patch)]);await q('ROLLBACK');
 assert.equal(await value('SELECT count(*)::int v FROM public.acconti_cantiere WHERE id=$1',[rollback]),0);
 assert.equal(await value('SELECT signature=artecna_distruzione.hard_delete_catalog() v FROM artecna_distruzione.hard_delete_catalog_expected'),true);
 assert.equal(await value('SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY jobid)::text) v FROM cron.job t'),cronBefore);
 assert.equal(await value("SELECT has_table_privilege(current_user,'cron.job','MAINTAIN,UPDATE,DELETE,TRUNCATE') v"),false);
 fs.writeFileSync(path.join(root,'.run/acconti-rilascio-indipendente/postgresql-result.json'),JSON.stringify({mixed_objects_absent:true,cron_share_privileges:false,cron_fingerprint_unchanged:true,fourth_advance_uuid_preserved:true,four_advance_count:4,fourth_advance_gross:5000,linked_invoices_gross_allocations_notifications_unchanged:true,hard_delete_seal:true}));
 assert.equal(await value("SELECT has_function_privilege('authenticated','public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') AND NOT has_function_privilege('anon','public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') AND NOT has_function_privilege('service_role','public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') v"),true);
 await q('BEGIN ISOLATION LEVEL REPEATABLE READ');await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[titolare]);
 await assert.rejects(q('SELECT public.salva_acconto_compilazione($1,$2,$3,NULL,$4,NULL)',[randomUUID(),randomUUID(),cid,JSON.stringify(patch)]),{code:'22023'});await q('ROLLBACK');
 console.log('ACCONTI_COMPILAZIONE_ATOMIC_LOCAL_GREEN');
}
const source=fs.readFileSync(file,'utf8'),anchor="  const browser=require('./browser/attesi-page-browser.cjs')";assert.equal(source.split(anchor).length,2);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));const req=Module.createRequire(file);m.require=n=>n==='./compilazione-local'?verifica:req(n);
m._compile(source.replace(anchor,"  await require('./compilazione-local')({q,value,as,load,admin,titolare,esterno,client2,randomUUID,assert})\n  return\n"+anchor),file);
