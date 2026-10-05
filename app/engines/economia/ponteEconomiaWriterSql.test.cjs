// Tutti i dati sono sintetici. PostgreSQL locale isolato, mai Supabase.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net')
const {randomUUID}=require('node:crypto'),{spawnSync}=require('node:child_process')
const {PGlite}=require('@electric-sql/pglite'),{Client}=require('pg')
const production=require('./ponteEconomiaProduction.fixture.json')
const root=path.resolve(__dirname,'../../..'),read=n=>fs.readFileSync(path.join(root,'supabase/migrations',n),'utf8')
const schema=read('20261005_ponte_economia_schema.sql'),sql=read('20261005_ponte_economia_writer.sql')
// Riusa senza modificarlo il setup certificato del micro-step 3.
const prefix=fs.readFileSync(path.join(__dirname,'ponteEconomiaSchemaSql.test.cjs'),'utf8').split("test('Ponte Economia 3:")[0]
const base=new Function('require','__dirname',prefix+'\nreturn {fixture,seed,q};')(require,__dirname)
const user='11111111-1111-4111-8111-111111111111',q=base.q
async function setup(db,writer=sql,restricted=false){
 await base.fixture(db)
 await db.exec(`CREATE ROLE artecna_economia_rpc NOLOGIN NOINHERIT BYPASSRLS;
 CREATE TABLE public.utenti_cantiere(cantiere_id uuid,user_id uuid,ruolo text);
 GRANT USAGE ON SCHEMA public,artecna_guardie TO artecna_economia_rpc;
 GRANT SELECT,UPDATE ON public.cantieri,public.utenti_cantiere,public.economia_raccolte TO artecna_economia_rpc;
 GRANT SELECT ON public.economia_sorgenti,public.economia_righe TO artecna_economia_rpc;
 ALTER FUNCTION public.chiudi_raccolta_economia(uuid,bigint) OWNER TO artecna_economia_rpc;
 GRANT EXECUTE ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) TO authenticated;
 CREATE OR REPLACE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(u uuid,c uuid) RETURNS boolean LANGUAGE sql AS
 $$SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere WHERE user_id=u AND cantiere_id=c AND ruolo='owner')$$;`)
 const analytical=read('20261002_economia_v1_dettagli_analitici.sql')
 await db.exec(analytical.slice(analytical.indexOf('CREATE FUNCTION public.economia_oggetto_analitico'),analytical.indexOf('-- La patch RPC')))
 const mutate=JSON.parse(analytical.split('$baseline$')[1]).find(x=>x.firma==='salva_bozza_economia(uuid,bigint,jsonb)')
 await db.exec(`CREATE FUNCTION public.salva_bozza_economia(p_raccolta_id uuid,p_revisione_attesa bigint,p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $body$${mutate.nuovo_corpo}$body$;
 ALTER FUNCTION public.salva_bozza_economia(uuid,bigint,jsonb) OWNER TO artecna_economia_rpc;
 GRANT EXECUTE ON FUNCTION public.salva_bozza_economia(uuid,bigint,jsonb) TO authenticated;`)
 const testata=read('20261001_elimina_cantiere_definitivamente.sql').split("('proteggi_variante_testata',false,$guard3$")[1].split('$guard3$),')[0]
 await db.exec(`CREATE FUNCTION artecna_guardie.proteggi_variante_testata() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path TO pg_catalog,pg_temp AS $body$${testata.replace("'artecna_cantieri_rpc'","'artecna_cantieri_delete_rpc'")}$body$;
 CREATE TRIGGER guardia_variante_testata BEFORE INSERT OR UPDATE OR DELETE ON public.varianti_cantiere FOR EACH ROW
 EXECUTE FUNCTION artecna_guardie.proteggi_variante_testata();`)
 await db.exec(`GRANT SELECT ON public.utenti_cantiere TO artecna_varianti_rpc;
 GRANT UPDATE ON public.cantieri,public.varianti_cantiere TO artecna_varianti_rpc;
 ALTER FUNCTION public.proponi_variante(uuid) OWNER TO artecna_varianti_rpc;
 ALTER FUNCTION public.approva_variante(uuid,text) OWNER TO artecna_varianti_rpc;
 CREATE FUNCTION artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid) RETURNS void LANGUAGE sql AS $$SELECT NULL::void$$;
 CREATE TABLE public.preventivo_lavorazioni(id bigint,preventivo_id uuid,cantiere_id uuid);`)
 await db.exec(`REVOKE ALL ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) FROM PUBLIC,anon,service_role;
 REVOKE ALL ON FUNCTION artecna_guardie.utente_jwt_corrente(),artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente(),artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO artecna_economia_rpc,artecna_varianti_rpc;`)
 await db.exec(schema)
 if(restricted)await db.exec(`-- Il bootstrap PostgreSQL deve restare SUPERUSER: usa un postgres applicativo distinto.
 CREATE ROLE fixture_installer LOGIN SUPERUSER;
 SET SESSION AUTHORIZATION fixture_installer;
 ALTER ROLE postgres RENAME TO fixture_bootstrap;
 CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS;
 -- Trasferisce soltanto gli oggetti applicativi sintetici, mai i cataloghi di sistema.
 ALTER SCHEMA public OWNER TO postgres;
 ALTER SCHEMA artecna_guardie OWNER TO postgres;
 ALTER SCHEMA artecna_distruzione OWNER TO postgres;
 ALTER SCHEMA artecna_rapportini OWNER TO postgres;
 DO $fixture_owners$ DECLARE x record;BEGIN
 FOR x IN SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relowner='fixture_bootstrap'::regrole LOOP
   EXECUTE format('ALTER TABLE %s OWNER TO postgres',x.oid::regclass);END LOOP;
 FOR x IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('public','artecna_guardie','artecna_distruzione','artecna_rapportini')
   AND p.proowner='fixture_bootstrap'::regrole LOOP
   EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',x.oid::regprocedure);END LOOP;
 END;$fixture_owners$;
 GRANT artecna_economia_rpc TO postgres WITH ADMIN TRUE,INHERIT FALSE,SET FALSE;
 SET SESSION AUTHORIZATION postgres;
 GRANT artecna_economia_rpc TO postgres WITH ADMIN FALSE,INHERIT FALSE,SET FALSE;`)
 await db.exec(writer)
}
async function seed(db,rows=[{q:2,p:10,note:null},{q:3,p:4.125,note:' Nota originale '}]){
 const s=await base.seed(db)
 await q(db,'UPDATE cantieri SET preventivo_contrattuale_id=$1 WHERE id=$2',[s.p,s.c])
 await q(db,"INSERT INTO utenti_cantiere VALUES($1,$2,'owner')",[s.c,user])
 for(let i=0;i<rows.length;i++){
  const r=rows[i]
  await q(db,`INSERT INTO economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,created_by)
   VALUES($1,$2,$3,'h',$4,$5,$6,'manuale',$7)`,[s.r,i+1,r.descr??' Lavoro '+i+' ',r.q,r.p,r.note??null,user])
 }
 return s
}
const call=async(db,s,rev=0)=>(await q(db,'SELECT public.usa_raccolta_economia_in_variante($1,$2) result',[s.r,rev]))[0].result
async function counts(db,s){return (await q(db,`SELECT (SELECT to_jsonb(e) FROM economia_raccolte e WHERE id=$1) raccolta,
 (SELECT count(*)::int FROM varianti_cantiere WHERE cantiere_id=$2) varianti,
 (SELECT count(*)::int FROM variante_sorgenti WHERE economia_raccolta_id=$1) sorgenti,
 (SELECT count(*)::int FROM variante_lavorazioni l JOIN varianti_cantiere v ON v.id=l.variante_id WHERE v.cantiere_id=$2) righe`,[s.r,s.c]))[0]}
const reject=(f,code)=>assert.rejects(f,e=>e.code===code)
function analytic(kind){
 const labor=kind==='manodopera',row=labor?6:5,sheet=labor?'Manodopera economia':'Materiali economia'
 const keys=labor?['cantiere','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','ore_dichiarate','tariffa_dichiarata','totale_dichiarato','riferimento','note']:
  ['cantiere','codice_variante','data','materiale','um','quantita_dichiarata','prezzo_dichiarato','totale_dichiarato','fornitore','documento','riferimento_rapportino','note']
 const cells={},src={foglio_sorgente:sheet,riga_sorgente:row}
 keys.forEach((k,i)=>{const c=String.fromCharCode(65+i)+row;src[k]=c;cells[c]={tipo:'z',valore:null,formula:null,formato:null,visualizzato:null}})
 for(const [column,value] of (labor?[['I',1],['J',65],['K',65]]:[['F',1],['G',65],['H',65]]))cells[column+row]={tipo:'n',valore:String(value),formula:null,formato:null,visualizzato:String(value)}
 const op=labor?{cantiere_dichiarato:null,codice_variante:null,data:'2026-10-05',operaio:'Sintetico',qualifica:null,ora_inizio:'08:00',ora_fine:'09:00',pausa_min:0,riferimento:null}:
  {cantiere_dichiarato:null,codice_variante:null,data:'2026-10-05',fornitore:null,documento:null,riferimento_rapportino:null}
 const detail={version:1,sorgente:src,operativo:op,normalizzazione:{regola:'artecna_template_extra_v2_precisione_v1',
  quantita:{decimali:2,origine:'sorgente',motivazione:null},prezzo_unitario:{decimali:2,origine:'sorgente',motivazione:null}},warnings:{sorgente:[],operativo:[]}}
 const snapshot={version:2,template:'ARTECNA_Template_Import_Varianti_Extra_v2',date1904:false,fogli:{
  'Manodopera economia':{riga_intestazioni:5,righe:{}},'Materiali economia':{riga_intestazioni:4,righe:{}}}}
 snapshot.fogli[sheet].righe[row]={celle:cells,warnings:[]}
 return {detail,snapshot,index:2*(row-1)+(labor?0:1)}
}
test('Ponte Economia 4: atomicita, snapshot, retry, guardia e workflow',async t=>{
 const db=new PGlite()
 try{
  await setup(db)
  const s=await seed(db),a=await call(db,s)
  await t.test('bozza valida, chiusura R+1, numero NULL e contratto ridotto',async()=>{
   assert.deepEqual(Object.keys(a).sort(),['versione_contratto','riutilizzata','raccolta_id','revisione_sorgente','revisione_congelata','variante_id','numero_variante','stato_variante','variante_sorgente_id','numero_lavorazioni','totale'].sort())
   assert.equal(a.numero_variante,null);assert.equal(a.stato_variante,'bozza');assert.equal(a.riutilizzata,false)
   assert.equal(a.revisione_sorgente,0);assert.equal(a.revisione_congelata,1);assert.equal(a.numero_lavorazioni,2);assert.equal(a.totale,32.38)
   assert.equal((await counts(db,s)).raccolta.stato,'chiusa')
  })
  await t.test('mapping 1:1, numero e indice, provenienza e note NULL preservate',async()=>{
   const rows=await q(db,'SELECT * FROM variante_lavorazioni WHERE variante_id=$1 ORDER BY numero_riga',[a.variante_id])
   const [src]=await q(db,'SELECT * FROM variante_sorgenti WHERE id=$1',[a.variante_sorgente_id])
   assert.equal(src.snapshot_version,1);assert.equal(src.snapshot.registrazioni[0].note,null)
   for(let i=0;i<rows.length;i++){
    const l=rows[i],e=src.snapshot.registrazioni[i]
    assert.equal(l.numero_riga,i+1);assert.equal(l.indice_voce_sorgente,i);assert.equal(l.operazione,'nuova')
    assert.equal(l.descrizione,e.descrizione);assert.equal(l.unita_misura,e.unita_misura)
    assert.equal(Number(l.quantita_delta),e.quantita);assert.equal(Number(l.prezzo_unitario),e.prezzo_unitario)
    assert.equal(Number(l.delta_contratto),e.importo);assert.equal(l.note,e.note??'')
    assert.equal(l.riferimento_preventivo_lavorazione_id,null);assert.equal(l.riferimento_variante_lavorazione_id,null)
    assert.match(e.id,/^[a-f0-9-]{36}$/)
   }
   const [v]=await q(db,'SELECT * FROM varianti_cantiere WHERE id=$1',[a.variante_id])
   assert.equal(v.cantiere_id,s.c);assert.equal(v.preventivo_contrattuale_id,s.p);assert.equal(v.titolo,'Fixture');assert.equal(v.data_variante.toISOString().slice(0,10),'2026-10-05')
  })
  await t.test('risposta persa: retry senza DML anche con revisione precedente alla chiusura',async()=>{
   const before=await counts(db,s);const again=await call(db,s)
   assert.deepEqual(again,{...a,riutilizzata:true});assert.deepEqual(await counts(db,s),before)
   await db.exec(`CREATE FUNCTION public.test_no_variant_update() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'UPDATE inatteso'; END$$;
    CREATE TRIGGER test_no_variant_update BEFORE UPDATE ON varianti_cantiere FOR EACH ROW EXECUTE FUNCTION test_no_variant_update();`)
   assert.equal((await call(db,s)).variante_id,a.variante_id)
   await db.exec('DROP TRIGGER test_no_variant_update ON varianti_cantiere;')
  })
  await t.test('raccolta gia chiusa non viene richiusa, R=R',async()=>{
   const x=await seed(db);await q(db,"UPDATE economia_raccolte SET stato='chiusa',revisione=4 WHERE id=$1",[x.r])
   const result=await call(db,x,4);assert.equal(result.revisione_sorgente,4);assert.equal(result.revisione_congelata,4)
  })
  await t.test('dopo congelamento il mutatore Economia storico rifiuta ogni modifica',async()=>{
   await reject(()=>q(db,"SELECT salva_bozza_economia($1,1,'{}'::jsonb)",[s.r]),'55000')
  })
  await t.test('Economia manuale: mutatore storico bozza ancora operativo',async()=>{
   const x=await seed(db);const result=(await q(db,"SELECT salva_bozza_economia($1,0,'{}'::jsonb) r",[x.r]))[0].r
   assert.equal(result.raccolta.stato,'bozza');assert.equal(result.raccolta.revisione,1)
  })
  await t.test('50 righe sintetiche: riconciliazione esatta 3268.20 senza aggregazione',async()=>{
   const x=await seed(db,Array.from({length:50},(_,i)=>({q:1,p:i===49?83.2:65})))
   const r=await call(db,x);assert.equal(r.numero_lavorazioni,50);assert.equal(r.totale,3268.2)
  })
  await t.test('una sola riga zero tra righe valide rifiuta tutta la raccolta',async()=>{
   const x=await seed(db,[{q:1,p:12},{q:1,p:0},{q:1,p:15}]),before=await counts(db,x)
   await reject(()=>call(db,x),'22023');assert.deepEqual(await counts(db,x),before)
  })
  await t.test('descrizione/UM/note testuali lunghe preservate senza trim o troncamento',async()=>{
   const note=' '.repeat(2)+'Note '.repeat(2000),x=await seed(db,[{q:1,p:1,descr:' Testo lungo '.repeat(2000),note}])
   await q(db,"UPDATE economia_righe SET unita_misura=' UM personalizzata ' WHERE raccolta_id=$1",[x.r])
   const r=await call(db,x),[l]=await q(db,'SELECT note,unita_misura,descrizione FROM variante_lavorazioni WHERE variante_id=$1',[r.variante_id])
   assert.equal(l.note,note);assert.equal(l.unita_misura,' UM personalizzata ');assert.equal(l.descrizione,' Testo lungo '.repeat(2000))
  })
  for(const [name,rows] of [
   ['prezzo zero',[{q:1,p:0}]],['prezzo NULL',[{q:1,p:null}]],['importo arrotondato zero',[{q:.000001,p:.000001}]],
   ['overflow delta',[{q:999999999999,p:999999999999}]],['descrizione whitespace',[{q:1,p:1,descr:'\t\n'}]],['raccolta vuota',[]]
   ,['overflow totale Variante',[{q:10000,p:999999999999},{q:10000,p:999999999999}]]
  ])await t.test(`${name}: rollback completo`,async()=>{
   const x=await seed(db,rows),before=await counts(db,x);await reject(()=>call(db,x),'22023');assert.deepEqual(await counts(db,x),before)
  })
  await t.test('dettagli analitici incoerenti rifiutati prima della chiusura',async()=>{
   const x=await seed(db),src=randomUUID()
   await q(db,"INSERT INTO economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot,created_by) VALUES($1,$2,'test.xlsx','excel',$3,'{}',$4)",[src,x.r,'a'.repeat(64),user])
   await q(db,`UPDATE economia_righe SET origine='file',sorgente_id=$1,indice_voce_sorgente=0,tipo_riga='manodopera',dettagli_analitici='{"version":1}' WHERE raccolta_id=$2 AND ordine=1`,[src,x.r])
   const before=await counts(db,x);await reject(()=>call(db,x),'22023');assert.deepEqual(await counts(db,x),before)
  })
  for(const kind of ['manodopera','materiale'])await t.test(`analitica ${kind}: snapshot originale e mapping conservati`,async()=>{
   const x=await seed(db,[{q:1,p:65}]),src=randomUUID(),fixture=analytic(kind)
   await q(db,"INSERT INTO economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by) VALUES($1,$2,'sintetico.xlsx','excel',$3,2,$4,$5)",[src,x.r,'b'.repeat(64),fixture.snapshot,user])
   await q(db,`UPDATE economia_righe SET origine='file',sorgente_id=$1,indice_voce_sorgente=$2,tipo_riga=$3,dettagli_analitici=$4 WHERE raccolta_id=$5`,[src,fixture.index,kind,fixture.detail,x.r])
   const result=await call(db,x),[sorgente]=await q(db,'SELECT snapshot FROM variante_sorgenti WHERE id=$1',[result.variante_sorgente_id])
   assert.equal(result.totale,65);assert.deepEqual(sorgente.snapshot.registrazioni[0].dettagli_analitici,fixture.detail)
   assert.equal(sorgente.snapshot.registrazioni[0].sorgente_id,src);assert.equal(sorgente.snapshot.registrazioni[0].tipo_riga,kind)
  })
  await t.test('revisione divergente PT409',async()=>{const x=await seed(db);await reject(()=>call(db,x,7),'PT409')})
  await t.test('input invalido 22023',async()=>{await reject(()=>call(db,{r:null}),'22023');await reject(()=>call(db,s,-1),'22023')})
  await t.test('JWT assente 42501',async()=>{
   await db.exec('CREATE OR REPLACE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;')
   await reject(()=>call(db,s),'42501')
   await db.exec(`CREATE OR REPLACE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$SELECT '${user}'::uuid$$;`)
  })
  await t.test('membership mancante e raccolta inesistente 42501',async()=>{
   const x=await seed(db);await q(db,'DELETE FROM utenti_cantiere WHERE cantiere_id=$1',[x.c]);await reject(()=>call(db,x),'42501')
   await reject(()=>call(db,{r:randomUUID()}),'42501')
  })
  await t.test('preventivo di altro cantiere rifiutato',async()=>{
   const x=await seed(db);await q(db,'UPDATE preventivi_cantiere SET cantiere_id=$1 WHERE id=$2',[s.c,x.p]);await reject(()=>call(db,x),'22023')
  })
  await t.test('errore successivo alla chiusura: rollback anche R+1',async()=>{
   const x=await seed(db),before=await counts(db,x)
   await db.exec("CREATE FUNCTION public.test_creation_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fault'; END$$; CREATE TRIGGER test_creation_failure BEFORE INSERT ON varianti_cantiere FOR EACH ROW EXECUTE FUNCTION test_creation_failure();")
   await reject(()=>call(db,x),'P0001');assert.deepEqual(await counts(db,x),before)
   await db.exec('DROP TRIGGER test_creation_failure ON varianti_cantiere;')
  })
  await t.test('divergenza dopo INSERT rilevata dalla riconciliazione: rollback chiusura e righe',async()=>{
   const x=await seed(db),before=await counts(db,x)
   await db.exec(`CREATE FUNCTION public.test_reconciliation_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.delta_contratto:=NEW.delta_contratto+1;RETURN NEW;END$$;
    CREATE TRIGGER zz_test_reconciliation_failure BEFORE INSERT ON variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION test_reconciliation_failure();`)
   await reject(()=>call(db,x),'XX001');assert.deepEqual(await counts(db,x),before)
   await db.exec('DROP TRIGGER zz_test_reconciliation_failure ON variante_lavorazioni;')
  })
  await t.test('riconciliazione rileva anche modifica anomala Economia dopo la chiusura',async()=>{
   const x=await seed(db),before=await counts(db,x)
   await db.exec(`CREATE FUNCTION public.test_source_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN
    UPDATE public.economia_righe SET quantita=quantita+1 WHERE raccolta_id IN
    (SELECT id FROM public.economia_raccolte WHERE cantiere_id=NEW.cantiere_id);RETURN NEW;END$$;
    CREATE TRIGGER zz_test_source_changed BEFORE INSERT ON varianti_cantiere FOR EACH ROW EXECUTE FUNCTION test_source_changed();`)
   await reject(()=>call(db,x),'XX001');assert.deepEqual(await counts(db,x),before)
   assert.equal(Number((await q(db,'SELECT quantita FROM economia_righe WHERE raccolta_id=$1 AND ordine=1',[x.r]))[0].quantita),2)
   await db.exec('DROP TRIGGER zz_test_source_changed ON varianti_cantiere;')
  })
  for(const [name,stmt,p] of [
   ['sorgente UPDATE',"UPDATE variante_sorgenti SET titolo='X' WHERE id=$1",a.variante_sorgente_id],
   ['sorgente DELETE','DELETE FROM variante_sorgenti WHERE id=$1',a.variante_sorgente_id],
   ['lavorazione UPDATE',"UPDATE variante_lavorazioni SET descrizione='X' WHERE variante_id=$1",a.variante_id],
   ['lavorazione DELETE','DELETE FROM variante_lavorazioni WHERE variante_id=$1',a.variante_id],
   ['aggiunta manuale',"INSERT INTO variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,quantita_delta,prezzo_unitario,delta_contratto) VALUES($1,3,'nuova','Extra',1,1,1)",a.variante_id],
   ['altra sorgente',"INSERT INTO variante_sorgenti(variante_id,tipo,titolo,nome_file,formato,snapshot) VALUES($1,'file','X','x','excel','{}')",a.variante_id]
  ])await t.test(`${name} negata anche a postgres`,()=>reject(()=>q(db,stmt,[p]),'42501'))
  await t.test('insert Economia diretto negato',()=>reject(()=>q(db,`INSERT INTO variante_sorgenti(variante_id,tipo,titolo,snapshot,economia_raccolta_id,economia_revisione_sorgente,economia_revisione_congelata)
   VALUES($1,'raccolta_economia','X','{}',$2,0,1)`,[s.v,s.r]),'42501'))
  await t.test('spostamento lavorazione normale dentro/fuori Economia negato',async()=>{
   const x=await seed(db),[l]=await q(db,"SELECT * FROM aggiungi_lavorazione_variante($1,'Manuale','h',1,10)",[x.v])
   await reject(()=>q(db,'UPDATE variante_lavorazioni SET variante_id=$1,numero_riga=3 WHERE id=$2',[a.variante_id,l.id]),'42501')
   await reject(()=>q(db,'UPDATE variante_lavorazioni SET variante_id=$1,variante_sorgente_id=NULL,indice_voce_sorgente=NULL WHERE variante_id=$2',[x.v,a.variante_id]),'42501')
  })
  await t.test('spostamento sorgente file dentro Economia negato',async()=>{
   const x=await seed(db),[src]=await q(db,"SELECT * FROM aggiungi_sorgente_variante($1,'file',NULL,'File','sintetico.xlsx','excel',NULL,1,'{}')",[x.v])
   await reject(()=>q(db,'UPDATE variante_sorgenti SET variante_id=$1 WHERE id=$2',[a.variante_id,src.id]),'42501')
  })
  await t.test('collegamento parziale rilevato XX001, nessuna riparazione',async()=>{
   const x=await seed(db),r=await call(db,x)
   await db.exec('ALTER TABLE variante_lavorazioni DISABLE TRIGGER ponte_economia_lavorazioni;')
   await q(db,'DELETE FROM variante_lavorazioni WHERE variante_id=$1',[r.variante_id])
   await db.exec('ALTER TABLE variante_lavorazioni ENABLE TRIGGER ponte_economia_lavorazioni;')
   await reject(()=>call(db,x,99),'XX001')
  })
  await t.test('proponi assegna numero; retry preserva proposta e numero',async()=>{
   await q(db,'SELECT * FROM proponi_variante($1)',[a.variante_id])
   const r=await call(db,s);assert.equal(r.variante_id,a.variante_id);assert.equal(r.stato_variante,'proposta');assert.equal(r.numero_variante,1)
  })
  await t.test('approva normale; retry preserva approvata e numero',async()=>{
   await q(db,"SELECT * FROM approva_variante($1,'Approvazione sintetica')",[a.variante_id])
   const r=await call(db,s);assert.equal(r.variante_id,a.variante_id);assert.equal(r.stato_variante,'approvata');assert.equal(r.numero_variante,1)
   await db.exec('CREATE TRIGGER test_no_variant_update BEFORE UPDATE ON varianti_cantiere FOR EACH ROW EXECUTE FUNCTION test_no_variant_update();')
   assert.equal((await call(db,s)).stato_variante,'approvata')
   await db.exec('DROP TRIGGER test_no_variant_update ON varianti_cantiere;')
  })
  await t.test('ACL RPC desktop, helper privati, nessuna membership client',async()=>{
   for(const role of ['anon','service_role'])assert.equal((await q(db,"SELECT has_function_privilege($1,'public.usa_raccolta_economia_in_variante(uuid,bigint)','EXECUTE') v",[role]))[0].v,false)
   assert.equal((await q(db,"SELECT has_function_privilege('authenticated','public.usa_raccolta_economia_in_variante(uuid,bigint)','EXECUTE') v"))[0].v,true)
   for(const role of ['anon','authenticated','service_role'])assert.equal((await q(db,"SELECT has_function_privilege($1,'artecna_guardie.verifica_acquisizione_economia(uuid,jsonb)','EXECUTE') v",[role]))[0].v,false)
  })
  await t.test('retry con revisione congelata o arbitraria riusa snapshot e stato corrente senza UPDATE',async()=>{
   const before=await counts(db,s)
   const source=await q(db,'SELECT * FROM variante_sorgenti WHERE id=$1',[a.variante_sorgente_id])
   await db.exec('CREATE TRIGGER test_no_variant_update BEFORE UPDATE ON varianti_cantiere FOR EACH ROW EXECUTE FUNCTION test_no_variant_update();')
   try{
    for(const revision of [1,99,12345]){
     assert.deepEqual(await call(db,s,revision),{...a,riutilizzata:true,stato_variante:'approvata',numero_variante:1})
    }
    assert.deepEqual(await counts(db,s),before)
    assert.deepEqual(await q(db,'SELECT * FROM variante_sorgenti WHERE id=$1',[a.variante_sorgente_id]),source)
   }finally{await db.exec('DROP TRIGGER test_no_variant_update ON varianti_cantiere;')}
  })
  await t.test('workflow Variante normale invariato e numerazione indipendente',async()=>{
   const x=await seed(db)
   await q(db,"SELECT * FROM aggiungi_lavorazione_variante($1,'Manuale','h',1,12)",[x.v])
   await q(db,'SELECT * FROM proponi_variante($1)',[x.v]);await q(db,"SELECT * FROM approva_variante($1,'Sintetico')",[x.v])
   assert.equal((await q(db,'SELECT stato,numero FROM varianti_cantiere WHERE id=$1',[x.v]))[0].stato,'approvata')
  })
  await t.test('RPC storiche sorgente file: aggiunta/rimozione normale restano operative',async()=>{
   const x=await seed(db)
   const [f]=await q(db,"SELECT * FROM aggiungi_sorgente_variante($1,'file',NULL,'File','sintetico.xlsx','excel',NULL,1,'{}')",[x.v])
   await q(db,'SELECT rimuovi_sorgente_variante($1)',[f.id]);assert.equal((await q(db,'SELECT count(*)::int n FROM variante_sorgenti WHERE id=$1',[f.id]))[0].n,0)
  })
  await t.test('authenticated puo invocare la RPC ma non SET ROLE writer',async()=>{
   const x=await seed(db)
   await db.exec('SET SESSION AUTHORIZATION authenticated;')
   try{assert.equal((await call(db,x)).stato_variante,'bozza');await reject(()=>db.exec('SET ROLE artecna_ponte_economia_rpc;'),'42501')}
   finally{await db.exec('RESET SESSION AUTHORIZATION;')}
  })
 }finally{await db.close()}
})

test('Ponte 4: post-check negativo annulla guardia, ruolo e RPC',async t=>{
 for(const [name,fault] of [
  ['CHECK storico', 'ALTER TABLE varianti_cantiere DROP CONSTRAINT varianti_cantiere_numero_ck;'],
  ['RLS storico','ALTER TABLE variante_sorgenti DISABLE ROW LEVEL SECURITY;'],
  ['grant browser','GRANT UPDATE ON economia_raccolte TO authenticated;'],
  ['ACL colonna browser','GRANT UPDATE(titolo) ON economia_raccolte TO authenticated;'],
  ['ACL RPC PUBLIC','GRANT EXECUTE ON FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) TO PUBLIC;'],
  ['helper authenticated','GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_acquisizione_economia(uuid,jsonb) TO authenticated;'],
  ['ruolo LOGIN','ALTER ROLE artecna_ponte_economia_rpc LOGIN;'],
  ['privilegio writer eccedente','GRANT DELETE ON economia_righe TO artecna_ponte_economia_rpc;'],
  ['guardia disabilitata','ALTER TABLE variante_sorgenti DISABLE TRIGGER ponte_economia_sorgenti;'],
  ['nuova definizione alterata',"CREATE OR REPLACE FUNCTION artecna_guardie.verifica_acquisizione_economia(p_sorgente uuid,p_snapshot jsonb) RETURNS void LANGUAGE sql AS $$SELECT NULL::void$$;"]
 ])await t.test(name,async()=>{
  const db=new PGlite()
  try{
   await reject(()=>setup(db,sql.replace('DO $postcheck$',()=>fault+'\nDO $postcheck$')),'P0001');await db.exec('ROLLBACK')
   assert.equal((await q(db,"SELECT to_regprocedure('public.usa_raccolta_economia_in_variante(uuid,bigint)')::text f"))[0].f,null)
   assert.equal((await q(db,"SELECT count(*)::int n FROM pg_roles WHERE rolname='artecna_ponte_economia_rpc'"))[0].n,0)
   assert.equal((await q(db,"SELECT prosecdef FROM pg_proc WHERE oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure"))[0].prosecdef,true)
   assert.equal((await q(db,"SELECT convalidated FROM pg_constraint WHERE conname='varianti_cantiere_numero_ck'"))[0].convalidated,true)
  }finally{await db.close()}
 })
})

test('Ponte 4: nessuna numerazione, nessun flag runtime o modifica cleanup/schema approvato',()=>{
 const body=sql.split('AS $writer$')[1].split('$writer$;')[0]
 assert.doesNotMatch(body,/max\s*\(.*numero|UPDATE\s+public\.varianti_cantiere|PERFORM\s+public\.(proponi|approva)_variante/i)
 assert.doesNotMatch(body,/set_config|current_setting|SET (LOCAL )?ROLE/i)
 assert.doesNotMatch(sql,/ALTER TABLE|CREATE OR REPLACE FUNCTION public\.elimina_cantiere/i)
 assert.match(sql,/VALUES\(cid,c\.preventivo_contrattuale_id,NULL/)
})

test('Ponte 4: installazione postgres NOSUPERUSER e membership storiche preservate',async()=>{
 const db=new PGlite()
 try{
  await setup(db,sql,true)
  const [m]=await q(db,"SELECT admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='artecna_economia_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole")
  assert.deepEqual(m,{admin_option:false,inherit_option:false,set_option:false})
  const s=await seed(db)
  await db.exec('SET SESSION AUTHORIZATION authenticated;')
  try{assert.equal((await call(db,s)).stato_variante,'bozza')}
  finally{await db.exec('RESET SESSION AUTHORIZATION;')}
  assert.equal((await q(db,"SELECT has_function_privilege('artecna_ponte_economia_rpc','public.chiudi_raccolta_economia(uuid,bigint)','EXECUTE') v"))[0].v,true)
 }finally{await db.close()}
})

test('Ponte 4: PostgreSQL reale concorrenza e revisione concorrente',async t=>{
 const bin=path.join(os.tmpdir(),'artecna-postgres-test-runtime/pgsql/bin'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-ponte-writer-'))
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
 let started=false;const clients=[]
 const run=(exe,args)=>{const r=spawnSync(path.join(bin,exe+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(r.status,0,r.stderr||r.stdout)}
 const client=async()=>{const c=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',connectionTimeoutMillis:5000});clients.push(c);await c.connect();await c.query("SET statement_timeout='15s'");return c}
 try{
  run('initdb',['-D',dir,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'])
  run('pg_ctl',['-D',dir,'-l',path.join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true
  const admin=await client(),db={exec:s=>admin.query(s),query:(s,p)=>admin.query(s,p)}
  await setup(db);const s=await seed(db),c1=await client(),c2=await client()
  await t.test('due chiamate simultanee: unica acquisizione, converge senza deadlock',async()=>{
   const results=await Promise.all([call({query:(s,p)=>c1.query(s,p)},s),call({query:(s,p)=>c2.query(s,p)},s)])
   assert.equal(results[0].variante_id,results[1].variante_id);assert.equal(results[0].variante_sorgente_id,results[1].variante_sorgente_id)
   assert.deepEqual(results.map(x=>x.riutilizzata).sort(),[false,true])
   const persisted=await counts(db,s)
   assert.equal(persisted.varianti,2) // Una bozza fixture preesistente + una sola nuova Variante.
   assert.equal(persisted.sorgenti,1);assert.equal(persisted.righe,2)
  })
  await t.test('modifica prima del lock: PT409 senza acquisizione',async()=>{
   const x=await seed(db)
   await c1.query('BEGIN');await c1.query('SELECT id FROM cantieri WHERE id=$1 FOR UPDATE',[x.c])
   await c1.query('UPDATE economia_raccolte SET revisione=1 WHERE id=$1',[x.r])
   const pending=call({query:(s,p)=>c2.query(s,p)},x).then(()=>null,e=>e)
   await c1.query('COMMIT');assert.equal((await pending).code,'PT409');assert.equal((await counts(db,x)).sorgenti,0)
  })
  await t.test('risposta persa: stessa identita dopo COMMIT e nessun DML',async()=>{
   const before=await counts(db,s);const result=await call(db,s);assert.equal(result.riutilizzata,true);assert.deepEqual(await counts(db,s),before)
  })
  await t.test('guardia aggiornata: storico senza nuovi lock, Economia protetta',async()=>{
   const x=await seed(db)
   await admin.query('ALTER TABLE variante_lavorazioni DISABLE TRIGGER guardia_variante_lavorazioni')
   await c1.query('BEGIN');await c1.query('SELECT id FROM varianti_cantiere WHERE id=$1 FOR NO KEY UPDATE',[x.v])
   await c2.query("SET lock_timeout='150ms'; SET statement_timeout='5s'")
   await reject(()=>c2.query('SELECT id FROM varianti_cantiere WHERE id=$1 FOR UPDATE',[x.v]),'55P03')
   const [row]=(await c2.query("INSERT INTO variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,quantita_delta,prezzo_unitario,delta_contratto) VALUES($1,1,'nuova','Storica',1,1,1) RETURNING id",[x.v])).rows
   await c2.query("UPDATE variante_lavorazioni SET descrizione='Storica aggiornata' WHERE id=$1",[row.id]);await c2.query('DELETE FROM variante_lavorazioni WHERE id=$1',[row.id])
   const [file]=(await c2.query("INSERT INTO variante_sorgenti(variante_id,tipo,titolo,nome_file,formato,snapshot) VALUES($1,'file','File','x','excel','{}') RETURNING id",[x.v])).rows
   await c2.query('DELETE FROM variante_sorgenti WHERE id=$1',[file.id])
   await c1.query('ROLLBACK');await admin.query('ALTER TABLE variante_lavorazioni ENABLE TRIGGER guardia_variante_lavorazioni')
  })
 }finally{
  for(const c of clients)await c.end().catch(()=>{})
  if(started)run('pg_ctl',['-D',dir,'-m','immediate','-w','stop'])
  const target=path.resolve(dir),base=path.resolve(os.tmpdir())+path.sep
  assert.ok(target.startsWith(base)&&path.basename(target).startsWith('artecna-ponte-writer-'));fs.rmSync(target,{recursive:true,force:true})
 }
})
