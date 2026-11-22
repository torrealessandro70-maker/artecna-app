/* eslint-disable @typescript-eslint/no-require-imports -- Real isolated PostgreSQL fixture, loopback only. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'supabase/validators/cantiere-prerequisiti/contratto-acconti-sdi.test.cjs');
async function verifica({q,value,as,load,titolare,esterno,client2,randomUUID}){
 await q(load('20261121000100_acconti_compilazione_unica.sql'));
 const migration=load('20261122000100_incassi_fatturazione_lettura.sql');await q(migration);
 const call=async(user=titolare,da='2026-01-01',a='2026-12-31')=>(await as(user,'SELECT public.leggi_incassi_fatturazione_impresa($1,$2) v',[da,a]))[0].v;
 // Explicitly create a site outside this actor's existing perimeter.
 await q("INSERT INTO public.cantieri(nome) VALUES('ALTRO PERIMETRO SINTETICO')");
 await assert.rejects(call(),{code:'42501'});
 const sites=await q('SELECT id FROM public.cantieri');for(const c of sites)await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) SELECT $1,$2,'owner' WHERE NOT EXISTS(SELECT FROM public.utenti_cantiere WHERE cantiere_id=$1 AND user_id=$2)",[c.id,titolare]);
 const site=await value("INSERT INTO public.cantieri(nome) VALUES('PERNICONE sub 13 - SOLO FIXTURE') RETURNING id v");await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[site,titolare]);
 const a=randomUUID(),r=randomUUID();
 await q("INSERT INTO public.acconti_cantiere(id,cantiere_id,cantiere,importo,data_incasso,metodo,descrizione) VALUES($1,$2,'SINTETICO',500,'2026-11-01','contanti','SINTETICO, base netta non attestata')",[a,site]);
 await as(titolare,"SELECT public.conferma_incasso_lordo_cliente($1,$2,500,'2026-11-01','contanti','fixture-500','Dichiarazione sintetica')",[r,a]);
 const before=await value("SELECT to_jsonb(a) v FROM public.acconti_cantiere a WHERE id=$1",[a]);
 const fiscalBefore=(await as(titolare,'SELECT public.leggi_acconto_fiscale($1) v',[a]))[0].v;
 const read=await call();const row=read.movimenti.find(x=>x.id===r);assert(row);assert.equal(row.importo,'500.00');assert.equal(row.quote.length,0);assert.equal(row.assenza_collegamenti_verificata,true);assert.equal(read.completa,true);assert.deepEqual(row.fiscale,fiscalBefore);
 await assert.rejects(call(esterno),{code:'42501'});await assert.rejects(call(randomUUID()),{code:'42501'});await assert.rejects(call(titolare,'2026-12-31','2026-01-01'),{code:'22023'});
 assert.equal((await call(titolare,'2026-12-01','2026-12-31')).movimenti.some(x=>x.id===r),false);
 const invoice=await value("INSERT INTO public.fatture_emesse(numero_fattura,cliente,cantiere_id,totale,imponibile,iva,importo_incassato) VALUES('SINTETICA','Cliente sintetico',$1,500,454.55,45.45,0) RETURNING id v",[site]);
 const quota=randomUUID();await as(titolare,'SELECT public.attribuisci_incasso_lordo_cliente($1,$2,$3,200)',[quota,r,invoice]);
 const pending=(await call()).movimenti.find(x=>x.id===r);assert.equal(pending.quote[0].valida,false);assert.equal(pending.assenza_collegamenti_verificata,false);
 await as(titolare,"SELECT public.registra_evidenza_sdi($1,0,'TD02','consegnata',now(),now(),'Protocollo sintetico','Ricevuta sintetica',NULL,'[]')",[invoice]);
 const valid=(await call()).movimenti.find(x=>x.id===r);assert.equal(valid.quote[0].valida,true);assert.equal(valid.quote[0].importo,'200.00');
 const note=await value("INSERT INTO public.fatture_emesse(numero_fattura,cliente,cantiere_id,totale,imponibile,iva,importo_incassato) VALUES('NC SINTETICA','Cliente sintetico',$1,-50,-45.45,-4.55,0) RETURNING id v",[site]);
 await as(titolare,"SELECT public.registra_evidenza_sdi($1,0,'TD04','consegnata',now(),now(),'Protocollo NC sintetico','Ricevuta NC sintetica',$2,'[]')",[note,invoice]);
 assert.equal((await call()).movimenti.find(x=>x.id===r).quote[0].valida,false,'A rettified invoice cannot remain billed as if unchanged');
 await as(titolare,'SELECT public.revoca_quota_lorda_cliente($1,$2)',[randomUUID(),quota]);assert.equal((await call()).movimenti.find(x=>x.id===r).quote[0].revocata,true);
 assert.deepEqual(await value('SELECT to_jsonb(a) v FROM public.acconti_cantiere a WHERE id=$1',[a]),before);
 const original=[before.descrizione,before.importo,before.data_incasso,before.metodo,before.nota,before.compilazione_unica?.richiesta??null];
 const fiscalNoteBefore=(await as(titolare,'SELECT public.leggi_acconto_fiscale($1) v',[a]))[0].v;
 await as(titolare,'SELECT public.salva_acconto_compilazione($1,$2,$3,$4,$5,NULL)',[randomUUID(),a,site,JSON.stringify(original),JSON.stringify({nota:'Scelta gestionale sintetica: fattura non prevista. Nessuna regolarizzazione fiscale.'})]);
 const afterNote=await value('SELECT to_jsonb(a) v FROM public.acconti_cantiere a WHERE id=$1',[a]);
 for(const key of ['id','importo','data_incasso','metodo','descrizione'])assert.deepEqual(afterNote[key],before[key]);
 assert.deepEqual((await as(titolare,'SELECT public.leggi_acconto_fiscale($1) v',[a]))[0].v,fiscalNoteBefore);
 assert.equal(await value('SELECT count(*)::int v FROM artecna_contabilita.incassi_lordi_clienti WHERE id=$1',[r]),1);
 // The actual read path must work inside a PostgreSQL READ ONLY transaction.
 await client2.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{await client2.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[titolare]);await client2.query('SET LOCAL ROLE authenticated');await client2.query("SELECT public.leggi_incassi_fatturazione_impresa('2026-01-01','2026-12-31')");}finally{await client2.query('ROLLBACK');}
 assert.equal(await value("SELECT has_function_privilege('authenticated','public.leggi_incassi_fatturazione_impresa(date,date)','EXECUTE') AND NOT has_function_privilege('anon','public.leggi_incassi_fatturazione_impresa(date,date)','EXECUTE') AND NOT has_function_privilege('service_role','public.leggi_incassi_fatturazione_impresa(date,date)','EXECUTE') v"),true);
 assert.equal(await value("SELECT has_table_privilege('authenticated','artecna_contabilita.incassi_lordi_clienti','SELECT') v"),false);
 assert.equal(await value("SELECT relrowsecurity v FROM pg_class WHERE oid='artecna_contabilita.incassi_lordi_clienti'::regclass"),true);
 assert.equal(await value('SELECT signature=artecna_distruzione.hard_delete_catalog() v FROM artecna_distruzione.hard_delete_catalog_expected'),true);
 assert.equal(await value("SELECT to_regclass('artecna_addebiti.voci_manuali') IS NULL v"),true);
 console.log('INCASSI_FATTURAZIONE_POSTGRESQL_READONLY_ACL_RLS_GREEN');
}
const source=fs.readFileSync(file,'utf8'),anchor="  const browser=require('./browser/attesi-page-browser.cjs')";assert.equal(source.split(anchor).length,2);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));const req=Module.createRequire(file);m.require=n=>n==='./incassi-local'?verifica:req(n);
m._compile(source.replace(anchor,"  await require('./incassi-local')({q,value,as,load,titolare,esterno,client2,randomUUID})\n  return\n"+anchor),file);
