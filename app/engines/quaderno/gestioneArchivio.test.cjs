const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),p=require('path');
const {banco,doc,u,other,source,s1,ops}=require('./gestione.test.fixture.cjs');
const gestione=require('./gestione.ts');
const signatures={quaderno_archivia_non_avviata:['p_id','p_tipo'],quaderno_rinomina:['p_id','p_titolo','p_versione'],quaderno_gestione_esito:['p_id'],quaderno_prepara_eliminazione:['p_id','p_progetto','p_versione'],quaderno_prepara_duplicazione:['p_id','p_sorgente','p_versione','p_destinazione','p_documento','p_assets'],quaderno_prepara_rimozione:['p_id','p_richiamo','p_versione'],quaderno_annulla_duplicazione:['p_id'],quaderno_concludi_gestione:['p_id']};
async function setup(t){
 const h=await banco();t.after(()=>h.db.close());
 await h.db.exec(fs.readFileSync(p.join(__dirname,'../../../supabase/migrations/20261024_quaderno_gestione_archivio.sql'),'utf8'));
 await h.db.exec('create unique index storage_name_fixture on storage.objects(bucket_id,name)');
 const oldRpc=h.rpc;h.rpc=async(name,args,uid=u)=>signatures[name]?h.user(tx=>tx.query('select public.'+name+'('+signatures[name].map((_,i)=>'$'+(i+1)).join(',')+') r',signatures[name].map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]??null)),uid).then(r=>r.rows[0].r):oldRpc(name,args,uid);
 h.client.rpc=async(name,args)=>{try{const data=await h.rpc(name,args);if(h.flags.completeLost&&name==='quaderno_concludi_gestione'){h.flags.completeLost=false;throw Error('Risposta finale persa')}return{data,error:null}}catch(error){return{data:null,error}}};
 const originalRemove=h.client.storage.from;
 h.client.storage.from=bucket=>{const b=originalRemove(bucket);return{...b,remove:async paths=>{if(h.flags.storageError)return{error:Error('Storage offline')};const r=await b.remove(paths);if(h.flags.removeLost){h.flags.removeLost=false;return{error:Error('Risposta pulizia persa')}}return r}}};
 const local=new Map();h.diario={salva:async v=>local.set(v.user+':'+v.id,structuredClone(v)),leggi:async(uid,id)=>structuredClone(local.get(uid+':'+id)),elenco:async uid=>[...local.values()].filter(v=>v.user===uid).map(v=>structuredClone(v)),elimina:async(uid,id)=>local.delete(uid+':'+id)};h.local=local;
 h.prefix=`utenti/${u}/quaderni/${source}/`;const image=h.prefix+'immagine',file=h.prefix+'allegato';
 h.bytes.set('quaderno-privato:'+image,h.bytes.get('quaderno-privato:source/image'));h.bytes.set('quaderno-privato:'+file,h.bytes.get('quaderno-privato:source/file'));
 const src=(await h.db.query('select * from quaderno_progetti')).rows[0];src.disegni[0].oggettiGrafici[0].sorgente='quaderno-storage:'+encodeURIComponent(image);src.disegni.push({...structuredClone(doc.disegni[0]),id:'pagina-due',titolo:'Seconda pagina'});
 await h.user(tx=>tx.query('update quaderno_progetti set disegni=$1,checklist=$2 where id=$3',[JSON.stringify(src.disegni),JSON.stringify([{id:'check-source',testo:'Controllo sorgente',completata:false}]),source]));
 await h.user(tx=>tx.query('update quaderno_allegati set storage_path=$1 where nota_id=$2',[file,source]));
 await h.user(tx=>tx.query("insert into storage.objects(bucket_id,name,owner_id) values('quaderno-privato',$1,$3),('quaderno-privato',$2,$3)",[image,file,u]));
 h.project=async id=>(await h.db.query('select * from quaderno_progetti where id=$1',[id||source])).rows[0];
 h.confirm=async result=>{await h.rpc('conferma_richiamo_quaderno',{p_id:result.richiamo.id,p_pulizia:false});await h.archivio.elimina(ops.chiaveOperazione(u,s1));return result};
 return h;
}
test('rinomina: cambia solo titolo/versione, reload, annullamento UI neutro e ownership/CAS',async t=>{
 const h=await setup(t),before=await h.project();const recalled=await h.confirm(await h.start());
 const after=await h.rpc('quaderno_rinomina',{p_id:source,p_titolo:' Nuovo titolo ',p_versione:before.updated_at});
 a.equal(after.titolo,'Nuovo titolo');a.notEqual(after.updated_at,before.updated_at);
 const {titolo:x,updated_at:y,...expected}=before,{titolo:z,updated_at:w,...actual}=after;const norm=v=>JSON.parse(JSON.stringify(v,(_k,x)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)?new Date(x).toISOString():x));a.deepEqual(norm(actual),norm(expected));a.deepEqual(norm(await h.project()),norm(after));
 a.equal((await h.db.query('select sorgente_titolo from quaderno_richiami_sopralluogo where id=$1',[recalled.richiamo.id])).rows[0].sorgente_titolo,before.titolo);
 await a.rejects(h.rpc('quaderno_rinomina',{p_id:source,p_titolo:'ALTRO',p_versione:after.updated_at},other),e=>e.code==='42501');
 await a.rejects(h.rpc('quaderno_rinomina',{p_id:source,p_titolo:'VECCHIO',p_versione:before.updated_at}),e=>e.code==='40001');a.deepEqual(norm(await h.project()),norm(after));
 // Annulla il prompt non invoca una RPC: verificato separatamente nel controllo UX.
});
test('duplica indipendente: due pagine, checklist, immagine e allegato; sorgente eliminabile senza toccare copia o richiamo',async t=>{
 const h=await setup(t),before=await h.project(),recalled=await h.confirm(await h.start());
 const copy=await gestione.duplicaProgetto(h.client,source,h.diario),newProject=await h.project(copy.destinazione_id);
 a.equal(copy.stato,'completato');a.notEqual(newProject.id,source);a.equal(newProject.titolo,before.titolo+' - copia');a.equal(newProject.testo,before.testo);a.equal(newProject.disegni.length,2);a.notEqual(newProject.disegni[0].id,before.disegni[0].id);a.notEqual(newProject.checklist[0].id,before.checklist[0].id);
 a.equal(newProject.gestione_copia,false);a.equal(newProject.gestione_id,null);
 await gestione.riprendiGestione(h.client,copy.id,true,h.diario);a.deepEqual(await h.project(copy.destinazione_id),newProject);
 const metadata=(await h.db.query('select * from quaderno_allegati where nota_id=$1',[newProject.id])).rows;a.equal(metadata.length,1);a.notEqual(metadata[0].id,(await h.db.query('select id from quaderno_allegati where nota_id=$1',[source])).rows[0].id);
 for(const asset of copy.assets){a(asset.storage_path.startsWith(`utenti/${u}/quaderni/${newProject.id}/`));a(h.bytes.has('quaderno-privato:'+asset.storage_path))}
 a(!JSON.stringify(newProject.disegni).includes(encodeURIComponent(h.prefix)));a.deepEqual(await h.project(),before);
 const noteBefore=(await h.db.query('select * from note_sopralluogo')).rows;
 const removed=await gestione.eliminaProgetto(h.client,await h.project(),h.diario);a.equal(removed.stato,'completato');a.equal(await h.project(),undefined);a.deepEqual(await h.project(newProject.id),newProject);a.deepEqual((await h.db.query('select * from note_sopralluogo')).rows,noteBefore);
 for(const asset of recalled.richiamo.assets)a(h.bytes.has('quaderno-sopralluoghi:'+asset.storage_path));
 a.equal((await h.db.query('select * from storage.objects where bucket_id=$1 and name like $2',['quaderno-privato',h.prefix+'%'])).rows.length,0);
 a.equal((await h.db.query('select * from quaderno_allegati where nota_id=$1',[source])).rows.length,0);
 a.equal((await h.rpc('quaderno_concludi_gestione',{p_id:removed.id})).stato,'completato');
 await a.rejects(h.user(tx=>tx.query('insert into quaderno_progetti(id,user_id,titolo) values($1,$2,$3)',[source,u,'salvataggio tardivo'])),e=>e.code==='55000');
 await a.rejects(h.user(tx=>tx.query('delete from quaderno_progetti where id=$1',[newProject.id])),e=>e.code==='42501');
});
test('eliminazione recuperabile: Storage offline, lock contro salvataggio/upload, risposta persa e doppia conferma',async t=>{
 const h=await setup(t);h.flags.storageError=true;
 await a.rejects(gestione.eliminaProgetto(h.client,await h.project(),h.diario),/Storage offline/);
 const pending=(await gestione.gestioniPendenti(h.client,h.diario))[0];a.equal(pending.tipo,'elimina');a((await h.project()).gestione_id);a.equal(h.local.size,1);
 await a.rejects(gestione.eliminaProgetto(h.client,await h.project(),h.diario),/precedente da riprendere/);
 await a.rejects(h.rpc('quaderno_archivia_non_avviata',{p_id:pending.id,p_tipo:'elimina'}),e=>e.code==='55000');
 await a.rejects(h.user(tx=>tx.query("update quaderno_progetti set titolo='salvataggio concorrente' where id=$1",[source])),e=>e.code==='55000');
 await a.rejects(h.user(tx=>tx.query("insert into storage.objects(bucket_id,name,owner_id) values('quaderno-privato',$1,$2)",[h.prefix+'tardivo',u]),'','storage_admin'),e=>e.code==='55000');
 await a.rejects(h.rpc('quaderno_prepara_eliminazione',{p_id:crypto.randomUUID(),p_progetto:source,p_versione:(await h.project()).updated_at}),e=>e.code==='55000');
 a.equal((await h.db.query('select count(*)::int n from storage.objects')).rows[0].n,2);
 h.flags.storageError=false;h.flags.removeLost=true;await a.rejects(gestione.riprendiGestione(h.client,pending.id,false,h.diario),/Risposta pulizia persa/);a(await h.project());
 h.flags.completeLost=true;await a.rejects(gestione.riprendiGestione(h.client,pending.id,false,h.diario),/Risposta finale persa/);a.equal(await h.project(),undefined);a.equal(h.local.size,1);
 const done=await gestione.riprendiGestione(h.client,pending.id,false,h.diario);a.equal(done.stato,'completato');a.equal(h.local.size,0);a.deepEqual(await gestione.riprendiGestione(h.client,pending.id,false,h.diario),done);
});
test('copia incompleta non visibile, byte durevoli e annullamento senza UID riutilizzabile',async t=>{
 const h=await setup(t);h.flags.uploadLost=true;
 // Upload riuscito/risposta persa viene verificato scaricando gli stessi byte.
 h.flags.completeLost=true;await a.rejects(gestione.duplicaProgetto(h.client,source,h.diario),/Risposta finale persa/);
 await a.rejects(gestione.duplicaProgetto(h.client,source,h.diario),/precedente da riprendere/);
 const lost=(await gestione.gestioniPendenti(h.client,h.diario))[0];
 const done=await gestione.riprendiGestione(h.client,lost.id,false,h.diario);a.equal(done.stato,'completato');a.equal((await h.db.query('select * from quaderno_progetti')).rows.length,2);h.flags.uploadLost=false;
 const originalFrom=h.client.storage.from;h.client.storage.from=b=>({...originalFrom(b),upload:async()=>({error:Error('Upload offline')})});
 await a.rejects(gestione.duplicaProgetto(h.client,source,h.diario),/Upload offline/);
 const pending=(await gestione.gestioniPendenti(h.client,h.diario))[0];a.equal(pending.tipo,'duplica');
 a.equal((await h.user(tx=>tx.query('select * from quaderno_progetti where id=$1',[pending.destinazione_id]))).rows.length,0);
 await a.rejects(h.rpc('quaderno_concludi_gestione',{p_id:pending.id}),e=>e.code==='55000');
 h.local.clear();await a.rejects(gestione.riprendiGestione(h.client,pending.id,false,h.diario),/Byte locali/);
 const cancelled=await gestione.riprendiGestione(h.client,pending.id,true,h.diario);a.equal(cancelled.stato,'completato');a.equal(await h.project(pending.destinazione_id),undefined);a.equal((await h.project()).gestione_id,null);
 const id=crypto.randomUUID();await h.rpc('quaderno_annulla_duplicazione',{p_id:id});
 await a.rejects(h.rpc('quaderno_prepara_duplicazione',{p_id:id,p_sorgente:source,p_versione:(await h.project()).updated_at,p_destinazione:crypto.randomUUID(),p_documento:doc,p_assets:[]}),e=>e.code==='22023');
});
test('due richiami: rimuovere A conserva B e contenuti manuali, inclusi aggiunti su pagina A; file A non accessibili',async t=>{
 const h=await setup(t),first=await h.confirm(await h.start()),second=await h.confirm(await h.start(s1,first.nota,first.nota.updated_at));
 const current=structuredClone(second.nota),manual={id:'nuovo-manuale',strumento:'penna',punti:[{x:1,y:2}],colore:'#000',spessore:1};
 current.disegni.find(p=>p.provenienzaQuaderno?.richiamoId===first.richiamo.id).disegni.push(manual);
 const manualWorkspace={id:'workspace-manuale',type:'line',start:{x:1,y:1},end:{x:3,y:3},stroke:{color:'#000',width:1},metadata:{workspacePageId:current.disegni.find(p=>p.provenienzaQuaderno?.richiamoId===first.richiamo.id).id}};
 current.disegni[0].workspaceCadEntities=[...(current.disegni[0].workspaceCadEntities||[]),manualWorkspace];
 current.checklist.push({id:'check-manuale',testo:'Conservare integralmente',completata:true});current.testo+='\nTesto manuale successivo';
 const saved=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:current,p_versione:second.nota.updated_at});
 const secondPages=structuredClone(saved.disegni.filter(p=>p.provenienzaQuaderno?.richiamoId===second.richiamo.id));
 const result=await gestione.rimuoviRichiamo(h.client,{id:first.richiamo.id,titolo:'A',sopralluogo:s1,versione:saved.updated_at},h.diario);a.equal(result.stato,'completato');
 const after=(await h.db.query('select * from note_sopralluogo')).rows[0];a.equal(after.testo,saved.testo);a.deepEqual(after.checklist.find(c=>c.id==='check-manuale'),current.checklist.at(-1));a(!after.checklist.some(c=>c.provenienzaQuaderno?.richiamoId===first.richiamo.id));
 a.deepEqual(after.disegni.filter(p=>p.provenienzaQuaderno?.richiamoId===second.richiamo.id),secondPages);a(after.disegni.some(p=>p.disegni.some(d=>d.id===manual.id)));a(after.disegni.some(p=>p.id==='pagina-esistente'));a.deepEqual(after.disegni[0].workspaceCadEntities.find(e=>e.id===manualWorkspace.id),manualWorkspace);a(!after.disegni.some(p=>p.provenienzaQuaderno?.richiamoId===first.richiamo.id));
 for(const asset of first.richiamo.assets){a(!h.bytes.has('quaderno-sopralluoghi:'+asset.storage_path));a.equal((await h.user(tx=>tx.query('select quaderno_copia_file_autorizzato($1) allowed',[asset.storage_path]))).rows[0].allowed,false)}
 for(const asset of second.richiamo.assets)a(h.bytes.has('quaderno-sopralluoghi:'+asset.storage_path));
 a.equal((await h.db.query('select * from quaderno_copie_allegati where richiamo_id=$1',[first.richiamo.id])).rows.length,0);
 a.equal((await h.db.query('select stato from quaderno_richiami_sopralluogo where id=$1',[first.richiamo.id])).rows[0].stato,'annullato');
 await a.rejects(h.rpc('completa_richiamo_quaderno',{p_richiamo:first.richiamo.id}),e=>e.code==='55000');a.deepEqual(await h.rpc('quaderno_concludi_gestione',{p_id:result.id}),result);
 await a.rejects(h.user(tx=>tx.query('update note_sopralluogo set disegni=$1 where id=$2',[JSON.stringify(saved.disegni),after.id])),e=>e.code==='55000');
});
test('rimozione blocca salvataggio e preparazione tardiva; ACL e nota obsoleta restano fail closed',async t=>{
 const h=await setup(t),first=await h.confirm(await h.start());
 await a.rejects(h.user(tx=>tx.query('update note_sopralluogo set gestione_id=$1 where id=$2',[crypto.randomUUID(),first.nota.id])),e=>e.code==='42501');
 await a.rejects(h.rpc('quaderno_prepara_rimozione',{p_id:crypto.randomUUID(),p_richiamo:first.richiamo.id,p_versione:null}),e=>e.code==='40001');
 await a.rejects(h.rpc('quaderno_prepara_rimozione',{p_id:crypto.randomUUID(),p_richiamo:first.richiamo.id,p_versione:first.nota.updated_at},other),e=>e.code==='42501');
 const g=await h.rpc('quaderno_prepara_rimozione',{p_id:crypto.randomUUID(),p_richiamo:first.richiamo.id,p_versione:first.nota.updated_at});
 await a.rejects(h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:first.nota,p_versione:first.nota.updated_at}),e=>e.code==='55000');
 await a.rejects(h.rpc('quaderno_concludi_gestione',{p_id:g.id}),e=>e.code==='55000');
 await a.rejects(h.start(s1,first.nota,first.nota.updated_at));
 await a.rejects(h.rpc('quaderno_gestione_esito',{p_id:g.id},other),e=>e.code==='42501');a.equal((await h.user(tx=>tx.query('select * from quaderno_gestioni'),other)).rows.length,0);
 await a.rejects(h.user(tx=>tx.query('select quaderno_concludi_gestione($1)',[g.id]),'','anon'),e=>e.code==='42501');
});

test('archiviazione richiesta mai iniziata: tombstone impedisce invii tardivi, non tocca i dati',async t=>{
 const h=await setup(t),id=crypto.randomUUID(),before=await h.project();
 await h.rpc('quaderno_archivia_non_avviata',{p_id:id,p_tipo:'elimina'});
 await a.rejects(h.rpc('quaderno_prepara_eliminazione',{p_id:id,p_progetto:source,p_versione:before.updated_at}),e=>e.code==='22023');
 a.deepEqual(await h.project(),before);a.equal((await h.db.query('select * from storage.objects')).rows.length,2);
});
test('snapshot legacy: workspace importato rimosso, nuovo workspace manuale sulla stessa pagina conservato',async t=>{
 const h=await setup(t),first=await h.confirm(await h.start());
 const rid=first.richiamo.id,imported=first.nota.disegni.find(p=>p.provenienzaQuaderno?.richiamoId===rid);
 const importedWorkspace={id:'legacy-importato',type:'line',start:{x:0,y:0},end:{x:10,y:10},stroke:{color:'#000',width:1},metadata:{workspacePageId:imported.id}};
 const manualWorkspace={...structuredClone(importedWorkspace),id:'manuale-successivo'};
 const snapshot=structuredClone(first.nota);snapshot.disegni[0].workspaceCadEntities=[importedWorkspace];
 await h.db.query('update quaderno_richiami_sopralluogo set documento=$1 where id=$2',[JSON.stringify(snapshot),rid]);
 const current=structuredClone(snapshot);current.disegni[0].workspaceCadEntities.push(manualWorkspace);
 const saved=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:current,p_versione:first.nota.updated_at});
 await gestione.rimuoviRichiamo(h.client,{id:rid,titolo:'Legacy',sopralluogo:s1,versione:saved.updated_at},h.diario);
 const after=(await h.db.query('select * from note_sopralluogo')).rows[0];a(!after.disegni[0].workspaceCadEntities.some(e=>e.id===importedWorkspace.id));a.deepEqual(after.disegni[0].workspaceCadEntities.find(e=>e.id===manualWorkspace.id),manualWorkspace);
 const host=after.disegni.find(p=>p.id===imported.id);a(host);a.equal(host.provenienzaQuaderno,undefined);a.equal(host.sfondoDisegno,null);a.deepEqual(host.oggettiGrafici,[]);
});
test('file del richiamo riutilizzato da un contenuto manuale: nessuna pulizia distruttiva e nessun falso successo',async t=>{
 const h=await setup(t),first=await h.confirm(await h.start()),current=structuredClone(first.nota),image=current.disegni.find(p=>p.provenienzaQuaderno)?.oggettiGrafici[0];
 current.disegni[0].oggettiGrafici=[{...structuredClone(image),id:'immagine-manuale-condivisa',provenienzaQuaderno:undefined}];
 const saved=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:current,p_versione:first.nota.updated_at});
 await a.rejects(gestione.rimuoviRichiamo(h.client,{id:first.richiamo.id,titolo:'A',sopralluogo:s1,versione:saved.updated_at},h.diario),e=>e.code==='55000');
 for(const asset of first.richiamo.assets)a(h.bytes.has('quaderno-sopralluoghi:'+asset.storage_path));
 a.equal((await h.db.query('select gestione_id from note_sopralluogo')).rows[0].gestione_id,null);
 const pending=(await gestione.gestioniPendenti(h.client,h.diario))[0];await gestione.archiviaNonAvviata(h.client,pending,h.diario);a.equal(h.local.size,0);
});
test('duplicazione interrotta dopo il primo file: copia nascosta, ripresa sullo stesso UUID senza doppioni',async t=>{
 const h=await setup(t),from=h.client.storage.from;let uploads=0;
 h.client.storage.from=bucket=>{const b=from(bucket);return{...b,upload:async(...args)=>++uploads===2?{error:Error('Secondo upload interrotto')}:b.upload(...args)}};
 await a.rejects(gestione.duplicaProgetto(h.client,source,h.diario),/Secondo upload interrotto/);
 const g=(await gestione.gestioniPendenti(h.client,h.diario))[0];
 a.equal((await h.user(tx=>tx.query('select * from quaderno_progetti where id=$1',[g.destinazione_id]))).rows.length,0);
 a.equal((await h.db.query('select * from storage.objects where name like $1',[`utenti/${u}/quaderni/${g.destinazione_id}/%`])).rows.length,1);
 h.client.storage.from=from;const done=await gestione.riprendiGestione(h.client,g.id,false,h.diario);a.equal(done.stato,'completato');
 a.equal((await h.db.query('select * from storage.objects where name like $1',[`utenti/${u}/quaderni/${g.destinazione_id}/%`])).rows.length,2);a.equal(h.local.size,0);
});
