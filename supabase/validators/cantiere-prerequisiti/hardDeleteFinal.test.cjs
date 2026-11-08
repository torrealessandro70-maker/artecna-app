/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {withNative}=require('./native.cjs');
const {certifiedInstallerFixture}=require('./installerBaseline.cjs');
const migration=fs.readFileSync(path.join(__dirname,'../../migrations/20261108000800_cantiere_hard_delete_finale.sql'),'utf8').replace(/\r\n/g,'\n');
const runtime=fs.readFileSync(path.join(__dirname,'../../migrations/20261108000900_cantiere_hard_delete_runtime_v2.sql'),'utf8').replace(/\r\n/g,'\n');
const coldRuntime=fs.readFileSync(path.join(__dirname,'../../migrations/20261108001000_cantiere_hard_delete_runtime_v3.sql'),'utf8').replace(/\r\n/g,'\n');
test('RPC finale sul catalogo certificato PostgreSQL 17.6', {timeout:240000},()=>withNative(async(db,connect)=>{
 const q=async(s,p=[]) => (await db.query(s,p)).rows;
 // Domain seeding uses the local administrator. The dedicated installer suite
 // runs the complete migration as NOSUPERUSER with the real grantor profile.
 const admin=await connect('fixture_admin');await admin.query('ALTER ROLE postgres SUPERUSER');
 await q(migration);await q(runtime);await q(coldRuntime);
 async function fixture(){const u=randomUUID(),a=randomUUID(),b=randomUUID();await q('INSERT INTO auth.users VALUES($1)',[u]);await q("INSERT INTO public.cantieri(id,nome) VALUES($1,'Omonimo'),($2,'Omonimo')",[a,b]);await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$3,'owner'),($2,$3,'owner')",[a,b,u]);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[u]);return {a,b,u};}
 async function rpc(a,confirmation='ELIMINA'){await q('SET ROLE authenticated');try{return (await q('SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[a,confirmation]))[0];}finally{await q('RESET ROLE').catch(()=>{});}}
 async function preflight(a){await q('SELECT artecna_distruzione.hard_delete_blockers($1)',[a]);return (await q('SELECT public.preflight_eliminazione_cantiere($1) r',[a]))[0].r;}
 async function scenario(name,run){await test(name,async()=>{await q('BEGIN');try{await run(await fixture());await q('SET CONSTRAINTS ALL IMMEDIATE');}finally{await q('RESET SESSION AUTHORIZATION').catch(()=>{});await q('ROLLBACK');}});}
 await scenario('A/S: vuoto, omonimo preservato, seconda chiamata esplicitamente negata',async({a,b})=>{
  const p=await preflight(a);assert.equal(p.stato,'eliminabile');
  const r=await rpc(a);assert.equal(r.eliminato,true);assert.equal(r.cantiere_id,a);assert.equal(r.storage_nuovi,'0');assert.equal((await q('SELECT count(*)::int n FROM public.cantieri WHERE id=$1',[b]))[0].n,1);await q('SAVEPOINT repeated');await assert.rejects(rpc(a));await q('ROLLBACK TO repeated');
 });
 // Each scenario owns its transaction; savepoints permit expected errors without
 // hiding the function's atomic rollback. Catalog/trigger guards remain enabled.
 await scenario('P/Q: conferma esatta e non-owner',async({a})=>{
  for(const confirmation of ['elimina',' ELIMINA','ELIMINA ','']){await q('SAVEPOINT denied');await assert.rejects(rpc(a,confirmation));await q('ROLLBACK TO denied');}
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[randomUUID()]);await q('SAVEPOINT denied');await assert.rejects(rpc(a));await q('ROLLBACK TO denied');assert.equal((await q('SELECT count(*)::int n FROM public.cantieri WHERE id=$1',[a]))[0].n,1);
 });
 await scenario('B/J/K/L: preventivi, SAL, lavorazioni, outbox esclusivo/shared e due omonimi',async({a,b})=>{
  const p=randomUUID();await q("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,file_path) VALUES($1,'Omonimo',$2,'exclusive.pdf')",[p,a]);
  const work=(await q("INSERT INTO public.preventivo_lavorazioni(cantiere,cantiere_id,preventivo_id,descrizione) VALUES('Omonimo',$1,$2,'Lavoro') RETURNING id",[a,p]))[0].id;
  await q("INSERT INTO public.sal_lavorazioni(cantiere,cantiere_id,descrizione,source_lavorazione_id) VALUES('Omonimo',$1,'SAL',$2)",[a,work]);
  await q("INSERT INTO public.materiali_cantiere(cantiere,cantiere_id,descrizione,file_path) VALUES('Omonimo',$1,'Target','shared.pdf'),('Omonimo',$2,'Other','shared.pdf')",[a,b]);
  assert.equal((await preflight(a)).stato,'eliminabile');const r=await rpc(a);assert.equal(r.conteggi.storage_objects_preserved_shared,1);
  assert.equal((await q("SELECT count(*)::int n FROM artecna_distruzione.cleanup_storage WHERE path='exclusive.pdf'"))[0].n,1);
  assert.equal((await q("SELECT count(*)::int n FROM artecna_distruzione.cleanup_storage WHERE path='shared.pdf'"))[0].n,0);
  assert.equal((await q('SELECT count(*)::int n FROM public.materiali_cantiere WHERE cantiere_id=$1',[b]))[0].n,1);
 });
 await scenario('M/N/O: legacy UUID target/altro e ambiguo pertinente',async({a,b})=>{
  await q("INSERT INTO public.memoria_prezzi(cantiere,cantiere_id,descrizione) VALUES('Omonimo',$1,'A'),('Omonimo',$2,'B')",[a,b]);const r=await rpc(a);assert.equal(r.conteggi['public.memoria_prezzi'],1);assert.equal((await q('SELECT count(*)::int n FROM public.memoria_prezzi WHERE cantiere_id=$1',[b]))[0].n,1);
 });
 await scenario('O: legacy ambiguo blocca preflight e RPC senza mutazioni',async({a})=>{
  await q("INSERT INTO public.memoria_prezzi(cantiere,descrizione) VALUES('Omonimo','Ambiguo')");assert.equal((await preflight(a)).stato,'bloccato');await q('SAVEPOINT denied');await assert.rejects(rpc(a),/legacy_ambiguo/);await q('ROLLBACK TO denied');
 });
 await scenario('D/E: rapportino strutturato, materiali, richieste, timbrature e allegato prenotato',async({a,u})=>{
  const r=randomUUID(),al=randomUUID();await q('GRANT SELECT,INSERT ON public.rapportini,public.rapportino_materiali TO artecna_rapportini_rpc');await q('SET ROLE artecna_rapportini_rpc');await q("INSERT INTO public.rapportini(id,cantiere_id,cantiere,data,versione_prestazioni,versione_materiali) VALUES($1,$2,'Omonimo','2026-11-08',1,1)",[r,a]);await q('RESET ROLE');
  await q('SET ROLE artecna_rapportini_rpc');await q("INSERT INTO public.rapportino_materiali(rapportino_id,chiave_client,descrizione,quantita,unita_misura) VALUES($1,$2,'Materiale',1,'pz')",[r,randomUUID()]);await q('RESET ROLE');
  await q("INSERT INTO artecna_rapportini.richieste(canale,utente_id,richiesta_id,rapportino_id,payload_sha256,risultato) VALUES('desktop',$1,$2,$3,decode(repeat('ab',32),'hex'),'{}')",[u,randomUUID(),r]);
  const key=randomUUID();await q("INSERT INTO artecna_rapportini.allegati(id,rapportino_id,cantiere_id,chiave_client_allegato,sha256,bucket,file_path,mime_type,byte_size,stato,expires_at) VALUES($1,$2,$3,$4,decode(repeat('ab',32),'hex'),'rapportini-v1',$5,'image/jpeg',100,'prenotato',now()+interval '1 hour')",[al,r,a,key,`rapportini/${a}/${r}/${key}.jpg`]);
  const lease=randomUUID();await q("UPDATE artecna_rapportini.allegati SET lease_id=$2,lease_until=now()+interval '1 minute' WHERE id=$1",[al,lease]);
  await q('SET SESSION AUTHORIZATION artecna_rapportini_backend');await q('SELECT public.finalizza_allegato_rapportino_desktop($1,$2,$3)',[u,al,lease]);await q('RESET SESSION AUTHORIZATION');
  // The fixture explicitly extends writer ACLs above; certify only that local
  // fixture setup before testing the delete, whose runtime guard now pins ACLs.
  await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');
  const result=await rpc(a);assert.equal(result.conteggi['artecna_rapportini.allegati'],1);assert.equal(result.conteggi['public.foto_cantiere'],1);assert.equal(result.conteggi['public.rapportino_materiali'],1);
 });
 await scenario('C: variante completa con documenti, sorgenti, lavorazioni e integrativo',async({a})=>{
  const base=randomUUID(),v=randomUUID(),s=randomUUID();await q("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,natura) VALUES($1,'Omonimo',$2,'contrattuale')",[base,a]);await q('UPDATE public.cantieri SET preventivo_contrattuale_id=$2 WHERE id=$1',[a,base]);
  await q("INSERT INTO public.varianti_cantiere(id,cantiere_id,preventivo_contrattuale_id,titolo) VALUES($1,$2,$3,'Variante')",[v,a,base]);
  await q("INSERT INTO public.variante_sorgenti(id,variante_id,tipo,titolo,nome_file,formato,snapshot) VALUES($1,$2,'file','Fonte','fixture.pdf','pdf','{}')",[s,v]);
  await q("INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,quantita_delta,prezzo_unitario,delta_contratto,variante_sorgente_id,indice_voce_sorgente) VALUES($1,1,'nuova','Lavoro',1,10,10,$2,0)",[v,s]);
  await q("INSERT INTO public.variante_documenti(variante_id,nome_file,storage_path) VALUES($1,'Documento','variante.pdf')",[v]);
  await q('GRANT INSERT,SELECT ON public.preventivi_cantiere TO artecna_varianti_rpc');await q('SET ROLE artecna_varianti_rpc');await q("INSERT INTO public.preventivi_cantiere(cantiere,cantiere_id,natura,variante_id,preventivo_contrattuale_id,provenienza_generazione) VALUES('Omonimo',$1,'integrativo',$2,$3,jsonb_build_object('firma',repeat('a',64)))",[a,v,base]);await q('RESET ROLE');
  await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');
  const result=await rpc(a);assert.equal(result.conteggi['public.varianti_cantiere'],1);assert.equal(result.conteggi['public.preventivi_cantiere'],2);assert.equal(result.conteggi['public.variante_sorgenti'],1);
 });
 await scenario('F: prestazione, timbratura, Economia Rapportino e ponte Variante tramite writer canonici',async({a,u})=>{
  const r=randomUUID(),p=randomUUID(),o=randomUUID(),e=randomUUID(),base=randomUUID();
  await q("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,natura) VALUES($1,'Omonimo',$2,'contrattuale')",[base,a]);await q('UPDATE public.cantieri SET preventivo_contrattuale_id=$2 WHERE id=$1',[a,base]);
  await q("INSERT INTO public.rapportini(id,cantiere_id,cantiere,data,versione_prestazioni) VALUES($1,$2,'Omonimo','2026-11-08',1)",[r,a]);await q("INSERT INTO public.operai(id,nome,costo_orario) VALUES($1,'Operaio globale',20)",[o]);
  await q("INSERT INTO public.rapportino_prestazioni(id,rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,lavoro_in_economia) VALUES($1,$2,$3,'fixture','08:00','10:00',true)",[p,r,o]);
  await q("INSERT INTO public.timbrature(operaio_nome,cantiere,data,cantiere_id,rapportino_id,operaio_id,prestazione_rapportino_id,ora_entrata,ora_uscita,stato) VALUES('Operaio globale','Omonimo','2026-11-08',$1,$2,$3,$4,'08:00','10:00','da rapportino')",[a,r,o,p]);
  await q("INSERT INTO public.economia_raccolte(id,cantiere_id,numero,titolo,data,created_by) VALUES($1,$2,1,'Economia','2026-11-08',$3)",[e,a,u]);
  await q('SET ROLE authenticated');const acquired=(await q('SELECT public.acquisisci_prestazioni_economia_rapportini($1,0,$2) r',[e,JSON.stringify([{prestazione_id:p,revisione_attesa:0}])]))[0].r;
  await q('SELECT public.valorizza_manodopera_economia($1,40,$2)',[acquired.righe[0].riga_id,acquired.revisione]);await q('RESET ROLE');
  let revision=(await q('SELECT revisione FROM public.economia_raccolte WHERE id=$1',[e]))[0].revisione;
  await q('SET ROLE authenticated');await q('SELECT public.chiudi_raccolta_economia($1,$2)',[e,revision]);await q('RESET ROLE');revision=(await q('SELECT revisione FROM public.economia_raccolte WHERE id=$1',[e]))[0].revisione;
  await q('SET ROLE authenticated');await q('SELECT public.usa_raccolta_economia_cliente_in_variante($1,$2)',[e,revision]);await q('RESET ROLE');
  const result=await rpc(a);for(const tab of ['public.rapportino_prestazioni','public.timbrature','public.economia_righe','public.economia_raccolte','public.variante_sorgenti'])assert.equal(result.conteggi[tab],1,tab);assert.equal((await q('SELECT count(*)::int n FROM public.operai WHERE id=$1',[o]))[0].n,1);
 });
 await scenario('G/H/I: TD04, attribuzione e stock condiviso preservati',async({a,b,u})=>{
  const original=randomUUID(),note=randomUUID(),line=randomUUID(),noteLine=randomUUID(),mat=randomUUID(),stock=randomUUID(),rect=randomUUID();
  await q("INSERT INTO public.fatture_fornitori(id,tipo_documento) VALUES($1,'TD01'),($2,'TD04')",[original,note]);
  await q("INSERT INTO public.fatture_fornitori_righe(id,fattura_id,cantiere_id,quantita,prezzo_unitario,descrizione) VALUES($1,$2,$3,100,10,'Originale'),($4,$5,NULL,-10,10,'Nota')",[line,original,a,noteLine,note]);
  await q('SET ROLE artecna_materiali_fattura_rpc');await q("INSERT INTO public.materiali_cantiere(id,cantiere,cantiere_id,fattura_riga_id,descrizione,quantita,prezzo_unitario,totale,unita_misura) VALUES($1,'Omonimo',$2,$3,'Target',2,10,20,'pz')",[mat,a,line]);await q('RESET ROLE');
  await q("INSERT INTO public.materiali_impresa(id,fattura_riga_id,categoria,quantita,prezzo_unitario,totale,unita_misura,created_by,richiesta_id) VALUES($1,$2,'magazzino',1,10,10,'pz',$3,$4)",[stock,line,u,randomUUID()]);
  await q("INSERT INTO public.fornitori_rettifiche(id,nota_id,nota_riga_id,origine_id,origine_riga_id,materiale_cantiere_id,cantiere_id,categoria,quantita,importo_netto,importo_costo,data_nota,richiesta_id,richiesta,fotografia,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'materiali',0.1,-1,-1,'2026-11-08',$8,'{}','{}',$9)",[rect,note,noteLine,original,line,mat,a,randomUUID(),u]);
  const emission=randomUUID(),advance=randomUUID();await q("INSERT INTO public.fatture_emesse(id,cantiere_id,cantiere,cliente,totale,data_fattura,stato) VALUES($1,$2,'Omonimo','Cliente globale',100,'2026-11-08','emessa')",[emission,a]);await q("INSERT INTO public.acconti_cantiere(id,cantiere_id,cantiere,importo,data_incasso) VALUES($1,$2,'Omonimo',20,'2026-11-08')",[advance,a]);
  await q("INSERT INTO artecna_contabilita.attribuzioni_clienti(id,fattura_id,acconto_id,cantiere_id,cliente_confermato,importo,verificato,creato_da) VALUES($1,$2,$3,$4,'Cliente globale',20,true,$5)",[randomUUID(),emission,advance,a,u]);
  const result=await rpc(a);assert(result.conteggi.legal_records_preserved>=3);assert.equal((await q('SELECT count(*)::int n FROM public.materiali_impresa WHERE id=$1',[stock]))[0].n,1);assert.equal((await q('SELECT cantiere_id FROM public.fornitori_rettifiche WHERE id=$1',[rect]))[0].cantiere_id,null);assert.equal((await q('SELECT cliente,cantiere_id FROM public.fatture_emesse WHERE id=$1',[emission]))[0].cliente,'Cliente globale');assert.equal((await q('SELECT count(*)::int n FROM artecna_contabilita.archivio_attribuzioni'))[0].n,1);assert.equal((await q('SELECT count(*)::int n FROM public.cantieri WHERE id=$1',[b]))[0].n,1);
 });
 await scenario('R: residuo artificiale provoca rollback completo, incluse outbox e contesti',async({a})=>{
  await q("INSERT INTO public.materiali_cantiere(cantiere,cantiere_id,descrizione,file_path) VALUES('Omonimo',$1,'Residuo','rollback.pdf')",[a]);
  await q("CREATE FUNCTION public.test_skip_delete() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL;END$$; CREATE TRIGGER test_skip BEFORE DELETE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION public.test_skip_delete(); UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()");
  const before=(await q('SELECT count(*)::int n FROM artecna_distruzione.cleanup_storage'))[0].n;await q('SAVEPOINT injected');await assert.rejects(rpc(a),/manifest divergente/);await q('ROLLBACK TO injected');assert.equal((await q('SELECT count(*)::int n FROM artecna_distruzione.cleanup_storage'))[0].n,before);assert.equal((await q('SELECT count(*)::int n FROM artecna_distruzione.contesto_prerequisiti'))[0].n,0);assert.equal((await q('SELECT count(*)::int n FROM public.cantieri WHERE id=$1',[a]))[0].n,1);
 });
 await scenario('fail-closed: deriva catalogo e capability private',async({a})=>{
  await q('SAVEPOINT denied');await q('SET ROLE authenticated');await assert.rejects(q('SELECT artecna_distruzione.hard_delete_targets($1)',[a]),e=>e.code==='42501');await q('ROLLBACK TO denied');
  await q('ALTER TABLE public.memoria_prezzi ADD COLUMN deriva uuid');assert.equal((await preflight(a)).stato,'bloccato');await q('SAVEPOINT drift');await assert.rejects(rpc(a),/catalogo/);await q('ROLLBACK TO drift');
 });
 await scenario('altri domini operativi, agenda detach e sopralluogo/Quaderno shared preservati',async({a,u})=>{
  const inspection=randomUUID(),note=randomUUID(),agenda=randomUUID();
  await q('INSERT INTO public.sopralluoghi(id) VALUES($1)',[inspection]);await q("INSERT INTO public.note_sopralluogo(id,sopralluogo_id,user_id,testo) VALUES($1,$2,$3,'Fonte condivisa')",[note,inspection,u]);
  await q("INSERT INTO public.foto_cantiere(cantiere_id,cantiere,sopralluogo_id,immagine_base64) VALUES($1,'Omonimo',$2,'data:image/png;base64,AA==')",[a,inspection]);
  for(const tab of ['attrezzi_cantiere','pagamenti_fornitori','incassi_non_fatturati','acconti_cantiere'])await q(`INSERT INTO public.${tab}(cantiere,cantiere_id) VALUES('Omonimo',$1)`,[a]);
  await q("INSERT INTO public.agenda_attivita(id,user_id,titolo,data,ora_inizio,ora_fine,tipo,collegamento) VALUES($1,$2,'Attivita','2026-11-08','08:00','09:00','cantiere',$3)",[agenda,u,JSON.stringify({tipo:'cantiere',id:a})]);
  const result=await rpc(a);for(const tab of ['attrezzi_cantiere','pagamenti_fornitori','incassi_non_fatturati','acconti_cantiere'])assert.equal(result.conteggi['public.'+tab],1);
  assert.equal((await q('SELECT count(*)::int n FROM public.sopralluoghi WHERE id=$1',[inspection]))[0].n,1);assert.equal((await q('SELECT testo FROM public.note_sopralluogo WHERE id=$1',[note]))[0].testo,'Fonte condivisa');assert.equal((await q('SELECT collegamento FROM public.agenda_attivita WHERE id=$1',[agenda]))[0].collegamento,null);
 });
 await test('preflight autenticato realmente READ ONLY e guardie fuori contesto',async()=>{
  const {a}=await fixture();await q('BEGIN READ ONLY');await q('SET LOCAL ROLE authenticated');const p=(await q('SELECT public.preflight_eliminazione_cantiere($1) r',[a]))[0].r;assert.equal(p.stato,'eliminabile');assert.equal((await q("SHOW transaction_read_only"))[0].transaction_read_only,'on');await q('ROLLBACK');
  const r=randomUUID(),o=randomUUID(),pId=randomUUID();await q("INSERT INTO public.rapportini(id,cantiere_id,cantiere,data,versione_prestazioni) VALUES($1,$2,'Omonimo','2026-11-08',1)",[r,a]);await q("INSERT INTO public.operai(id,nome,costo_orario) VALUES($1,'Guardia',20)",[o]);await q("INSERT INTO public.rapportino_prestazioni(id,rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine) VALUES($1,$2,$3,'guardia','08:00','09:00')",[pId,r,o]);await assert.rejects(q('DELETE FROM public.rapportino_prestazioni WHERE id=$1',[pId]),e=>e.code==='PR403');
  // Keep this committed fixture out of the following worker case.
  await rpc(a);
 });
 await test('Storage fake dopo COMMIT DB: esclusivo processato, shared conservato, crash/ack retry idempotente',async()=>{
  const {load}=require('./load-ts.cjs'),{consumeStorageJob}=load(path.join(__dirname,'../../../app/engines/cantiere-delete/storageWorker.server.ts'));
  const {a,b}=await fixture(),exclusive='committed-exclusive.jpg',shared='committed-shared.jpg';
  await q("INSERT INTO public.materiali_cantiere(cantiere,cantiere_id,descrizione,file_path) VALUES('Omonimo',$1,'Esclusivo',$3),('Omonimo',$1,'Shared',$4),('Omonimo',$2,'Altro',$4)",[a,b,exclusive,shared]);
  await q("SELECT artecna_distruzione.storage_autorizza_cleanup('preventivi',$1,'fixture locale autorizzata')",[exclusive]);
  const result=await rpc(a);assert.equal(result.eliminato,true);assert.equal(result.conteggi.storage_objects_preserved_shared,1);assert.equal((await q('SELECT count(*)::int n FROM public.cantieri WHERE id=$1',[a]))[0].n,0);
  const files=new Set([exclusive,shared]),calls=[],closed=[];let crash=true;
  const pool={async connect(){const client=await connect('artecna_storage_worker_login');return {async query(sql,args){if(sql.includes('storage_finish')&&crash){crash=false;throw Error('Simulated crash before ack');}return client.query(sql,args);},release(error){if(error)closed.push(client.end());}};}};
  const remover={async remove(bucket,key){calls.push(key);files.delete(key);return {ok:true};}};
  await assert.rejects(consumeStorageJob(pool,remover),/Simulated crash/);await Promise.all(closed);
  await q("UPDATE artecna_distruzione.cleanup_storage SET lease_until=clock_timestamp()-interval '1 second',retry_at=clock_timestamp()-interval '1 second' WHERE path=$1",[exclusive]);
  assert.equal(await consumeStorageJob(pool,remover),'completed');assert.deepEqual(calls,[exclusive,exclusive]);assert(!files.has(exclusive));assert(files.has(shared));assert.equal((await q("SELECT count(*)::int n FROM artecna_distruzione.cleanup_storage WHERE path=$1 AND stato='completed'",[exclusive]))[0].n,1);assert.equal((await q('SELECT count(*)::int n FROM artecna_distruzione.cleanup_storage WHERE path=$1',[shared]))[0].n,0);
 });
},{productionActor:true,beforeMigrations:certifiedInstallerFixture}));
