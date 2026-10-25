const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),{PGlite}=require('@electric-sql/pglite')
const {id,packet}=require('../variante-fonti/fixture.cjs'),root=path.resolve(__dirname,'../../..'),sql=fs.readFileSync(path.join(root,'supabase/migrations/20261025_variante_preventivo_integrativo.sql'),'utf8')
function installed(file,name){const s=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'),start=s.toLowerCase().indexOf('create function '+name.toLowerCase()+'('),body=s.indexOf('as $function$',start),end=s.indexOf('$function$;',body+14);a(start>=0&&body>=0&&end>=0);return s.slice(start,end+11)}
test('SQL effettivo embedded: documento/genealogia/lavorazioni atomici, correzioni canoniche e retry',async t=>{
 const db=new PGlite();t.after(()=>db.close());const u=id(1),c=id(3),p=id(14),rid=id(40);let v=id(5)
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE ROLE artecna_varianti_rpc NOLOGIN NOINHERIT BYPASSRLS;CREATE ROLE artecna_sal_rpc NOLOGIN NOINHERIT BYPASSRLS;
 CREATE SCHEMA artecna_guardie;GRANT USAGE ON SCHEMA artecna_guardie TO artecna_varianti_rpc,artecna_sal_rpc;
 CREATE TABLE cantieri(id uuid PRIMARY KEY,nome text,preventivo_contrattuale_id uuid);
 CREATE TABLE utenti_cantiere(user_id uuid,cantiere_id uuid,ruolo text);
 CREATE TABLE varianti_cantiere(id uuid PRIMARY KEY,cantiere_id uuid,preventivo_contrattuale_id uuid,stato text,titolo text,descrizione text);
 CREATE TABLE preventivi_cantiere(id uuid PRIMARY KEY,cantiere text,cantiere_id uuid,sopralluogo_id uuid,nome_file text,descrizione_ai text,note text,json_voci_ai jsonb,importo_totale numeric,origine_ai boolean,stato_preventivo text,approvato boolean,data_preventivo date);
 CREATE TABLE preventivo_lavorazioni(id bigint PRIMARY KEY,cantiere_id uuid,preventivo_id uuid,descrizione text,unita_misura text,quantita numeric,prezzo_unitario numeric,importo_previsto numeric);
 CREATE TABLE variante_lavorazioni(id bigserial PRIMARY KEY,variante_id uuid,numero_riga integer,operazione text CHECK(operazione IN('nuova','aumento','riduzione_residua','eliminazione_residua')),descrizione text,unita_misura text,quantita_delta numeric(18,6),prezzo_unitario numeric(18,6),delta_contratto numeric(18,2),riferimento_preventivo_lavorazione_id bigint,riferimento_variante_lavorazione_id bigint,note text,variante_sorgente_id uuid,indice_voce_sorgente integer,created_at timestamptz DEFAULT now(),UNIQUE(variante_id,numero_riga));
 CREATE TABLE sal_lavorazioni(id bigserial,cantiere_id uuid,source_lavorazione_id bigint,source_variante_lavorazione_id bigint,importo_previsto numeric,percentuale numeric);
 CREATE TABLE fixture_lettura(doc jsonb);
 GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO artecna_varianti_rpc;
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO artecna_sal_rpc;
 GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO artecna_varianti_rpc;
 CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere WHERE user_id=$1 AND cantiere_id=$2 AND ruolo='owner') $$;
 CREATE FUNCTION public.leggi_osservatore_variante(uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT doc FROM public.fixture_lettura$$;
 REVOKE ALL ON FUNCTION public.leggi_osservatore_variante(uuid) FROM PUBLIC;
 -- Original legacy new-line writer is not versioned in this repo: minimal fixture seam.
 CREATE FUNCTION public.aggiungi_lavorazione_variante(p_variante_id uuid,p_descrizione text,p_unita_misura text,p_quantita numeric,p_prezzo_unitario numeric) RETURNS SETOF public.variante_lavorazioni LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 RETURN QUERY INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto)
 VALUES(p_variante_id,(SELECT coalesce(max(numero_riga),0)+1 FROM public.variante_lavorazioni WHERE variante_id=p_variante_id),'nuova',p_descrizione,p_unita_misura,p_quantita,p_prezzo_unitario,round(p_quantita*p_prezzo_unitario,2)) RETURNING *;END $$;
 ALTER FUNCTION public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric) OWNER TO artecna_varianti_rpc;`)
 await db.exec(installed('20261001_residuo_componente_helper.sql','artecna_guardie.calcola_residuo_componente'))
 await db.exec('ALTER FUNCTION artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid) OWNER TO artecna_sal_rpc;')
 await db.exec(installed('20261001_aggiungi_correzione_variante.sql','public.aggiungi_correzione_variante'))
 await db.exec('ALTER FUNCTION public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text) OWNER TO artecna_varianti_rpc;')
 await db.query('insert into cantieri values($1,$2,$3)',[c,'Sintetico',p]);await db.query('insert into utenti_cantiere values($1,$2,$3)',[u,c,'owner'])
 await db.query('insert into preventivi_cantiere(id,cantiere,cantiere_id,sopralluogo_id) values($1,$2,$3,$4)',[p,'Sintetico',c,id(10)])
 await db.query("insert into varianti_cantiere values($1,$2,$3,'bozza','Variante sintetica','Descrizione')",[v,c,p])
 for(let i=1;i<=3;i++){await db.query("insert into preventivo_lavorazioni values($1,$2,$3,'Voce contratto','m²',10,20,200)",[i,c,p]);await db.query('insert into sal_lavorazioni(cantiere_id,source_lavorazione_id,importo_previsto,percentuale) values($1,$2,200,20)',[c,i])}
 const pac=packet([]);pac.variante.id=v;pac.cantiere_id=c;pac.quaderni=[];pac.manifesto.quaderni=[];await db.query('insert into fixture_lettura values($1)',[{fonti:pac,analisi:null}])
 const before=(await db.query("select md5(pg_get_functiondef('public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text)'::regprocedure)) h")).rows[0].h
 await db.exec(sql)
 await db.exec(`SET request.jwt.claim.sub='${u}';SET ROLE authenticated;`)
 let ctx=(await db.query('select public.leggi_contesto_preventivo_integrativo($1) d',[v])).rows[0].d
 a.equal(ctx.contratto.voci.length,3);a.equal(ctx.contratto.voci[0].quantita_riducibile,8)
 const line=(op,q,ref=null,price=20)=>({operazione:op,descrizione:'Revisione umana sintetica',unita_misura:'m²',quantita:q,prezzo_unitario:price,riferimento_preventivo_lavorazione_id:ref,da_verificare:false,revisione_confermata:true})
 const righe=[line('nuova',2,null,31),line('aumento',1,'1'),line('riduzione',-2,'2'),line('eliminazione',-8,'3')]
 const save=(request=rid,rows=righe,firma=ctx.firma)=>db.query('select public.salva_preventivo_integrativo_generato($1,$2,$3,$4,$5) d',[v,request,firma,'Documento integrativo sintetico',rows])
 await t.test('tutte le operazioni confermate in una transazione, nessuna approvazione automatica',async()=>{const d=(await save()).rows[0].d;a.equal(d.delta_totale,-118);a.equal(d.preventivo_id,rid);a.equal(d.gia_salvato,false)})
 await t.test('genealogia Registro e delta firmati, nessuna duplicazione contratto/SAL',async()=>{
 await db.exec('RESET ROLE');const doc=(await db.query('select * from preventivi_cantiere where id=$1',[rid])).rows[0];a.equal(doc.natura,'integrativo');a.equal(doc.variante_id,v);a.equal(doc.preventivo_contrattuale_id,p);a.equal(doc.sopralluogo_id,id(10));a.equal(doc.approvato,false);a.equal(doc.provenienza_generazione.lavorazioni_variante_id.length,4)
 const rows=(await db.query('select operazione,quantita_delta,delta_contratto from variante_lavorazioni order by numero_riga')).rows;a.deepEqual(rows.map(x=>x.operazione),['nuova','aumento','riduzione_residua','eliminazione_residua']);a(Number(rows[2].delta_contratto)<0);a(Number(rows[3].delta_contratto)<0)
 a.equal((await db.query('select stato from varianti_cantiere')).rows[0].stato,'bozza');a.equal((await db.query('select count(*)::int n from sal_lavorazioni')).rows[0].n,3);a.equal((await db.query('select count(*)::int n from preventivo_lavorazioni')).rows[0].n,3);await db.exec('SET ROLE authenticated')
 })
 await t.test('risposta persa: stesso UUID riconosce esito; nessuna seconda lavorazione',async()=>{a.equal((await save()).rows[0].d.gia_salvato,true);await a.rejects(save(rid,[line('nuova',1,null,31)]),e=>e.code==='23505');await a.rejects(save(id(41)),e=>e.code==='23505');await db.exec('RESET ROLE');a.equal((await db.query('select count(*)::int n from variante_lavorazioni')).rows[0].n,4);await db.exec('SET ROLE authenticated')})
 await t.test('anche nuove fonti non duplicano un documento gia confermato nella stessa Variante',async()=>{await db.exec('RESET ROLE');pac.manifesto.firma='a'.repeat(64);await db.query('update fixture_lettura set doc=$1',[{fonti:pac,analisi:null}]);await db.exec('SET ROLE authenticated');ctx=(await db.query('select public.leggi_contesto_preventivo_integrativo($1) d',[v])).rows[0].d;a.equal(ctx.documento_confermato,rid);await a.rejects(save(id(45)),e=>e.code==='23505')})
 // A separate draft permits another document; invalid batches must roll back.
 await db.exec('RESET ROLE');v=id(50);await db.query("insert into varianti_cantiere values($1,$2,$3,'bozza','Seconda bozza','Descrizione')",[v,c,p]);pac.variante.id=v;pac.manifesto.variante.source_id=v;await db.query('update fixture_lettura set doc=$1',[{fonti:pac,analisi:null}]);await db.exec('SET ROLE authenticated');ctx=(await db.query('select public.leggi_contesto_preventivo_integrativo($1) d',[v])).rows[0].d
 await t.test('ultima riga invalida: rollback anche della prima lavorazione valida',async()=>{await a.rejects(save(id(42),[line('nuova',1,null,31),line('aumento',1,'999')]));await db.exec('RESET ROLE');a.equal((await db.query('select count(*)::int n from variante_lavorazioni')).rows[0].n,4);a.equal((await db.query('select count(*)::int n from preventivi_cantiere')).rows[0].n,2);await db.exec('SET ROLE authenticated')})
 await t.test('fonti obsolete, segni errati, prezzo diverso, revisione incompleta e precisione eccessiva rifiutati',async()=>{
 for(const rows of [[line('riduzione',2,'1')],[line('aumento',1,'1',21)],[{...line('nuova',1),revisione_confermata:false}],[line('nuova',0.1234567)]])await a.rejects(save(id(43),rows));await a.rejects(save(id(43),[line('nuova',1)],'b'.repeat(64)),e=>e.code==='40001')
 })
 await t.test('lavorazione manuale intervenuta nella bozza: conferma bloccata senza fusione implicita',async()=>{
 await db.exec('RESET ROLE');await db.query("insert into variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto) values($1,1,'nuova','Manuale','m²',1,20,20)",[v]);await db.exec('SET ROLE authenticated');const letto=(await db.query('select public.leggi_contesto_preventivo_integrativo($1) d',[v])).rows[0].d;a.equal(letto.lavorazioni_presenti,1);await a.rejects(save(id(46)),e=>e.code==='40001');await db.exec('RESET ROLE');await db.query('delete from variante_lavorazioni where variante_id=$1',[v]);await db.exec('SET ROLE authenticated')
 })
 await t.test('altro utente e anonimo negati; edit diretto documento integrativo bloccato',async()=>{
 await db.exec(`SET request.jwt.claim.sub='${id(2)}'`);await a.rejects(db.query('select public.leggi_contesto_preventivo_integrativo($1)',[v]),e=>e.code==='42501');await a.rejects(save(id(44)),e=>e.code==='42501');await db.exec('RESET ROLE;SET ROLE anon');await a.rejects(db.query('select public.leggi_contesto_preventivo_integrativo($1)',[v]),e=>e.code==='42501');await db.exec('RESET ROLE;GRANT UPDATE ON preventivi_cantiere TO authenticated;SET ROLE authenticated');await a.rejects(db.query("update preventivi_cantiere set natura=null where id=$1",[rid]),e=>e.code==='42501');await db.exec('RESET ROLE')
 })
 a.equal((await db.query("select md5(pg_get_functiondef('public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text)'::regprocedure)) h")).rows[0].h,before)
})
