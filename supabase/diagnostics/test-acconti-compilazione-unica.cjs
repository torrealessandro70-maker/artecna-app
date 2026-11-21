/* eslint-disable @typescript-eslint/no-require-imports -- Local PostgreSQL fixture. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'supabase/validators/cantiere-prerequisiti/contratto-acconti-sdi.test.cjs');
async function verifica({q,value,as,load,titolare,esterno,client2,randomUUID}){
 const migration=load('20261121000100_acconti_compilazione_unica.sql');await q(migration);
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
 assert.equal(await value("SELECT has_function_privilege('authenticated','public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') AND NOT has_function_privilege('anon','public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') AND NOT has_function_privilege('service_role','public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') v"),true);
 await q('BEGIN ISOLATION LEVEL REPEATABLE READ');await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[titolare]);
 await assert.rejects(q('SELECT public.salva_acconto_compilazione($1,$2,$3,NULL,$4,NULL)',[randomUUID(),randomUUID(),cid,JSON.stringify(patch)]),{code:'22023'});await q('ROLLBACK');
 console.log('ACCONTI_COMPILAZIONE_ATOMIC_LOCAL_GREEN');
}
const source=fs.readFileSync(file,'utf8'),anchor="  const browser=require('./browser/attesi-page-browser.cjs')";assert.equal(source.split(anchor).length,2);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));const req=Module.createRequire(file);m.require=n=>n==='./compilazione-local'?verifica:req(n);
m._compile(source.replace(anchor,"  await require('./compilazione-local')({q,value,as,load,admin,titolare,esterno,client2,randomUUID,assert})\n  return\n"+anchor),file);
