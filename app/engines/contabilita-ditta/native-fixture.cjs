/* eslint-disable @typescript-eslint/no-require-imports -- Isolated native PostgreSQL test utility */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),cp=require('node:child_process'),assert=require('node:assert/strict'),{Client}=require('pg');
const ids={user:'00000000-0000-4000-8000-000000000001',other:'00000000-0000-4000-8000-000000000002',c:'00000000-0000-4000-8000-000000000003',c2:'00000000-0000-4000-8000-000000000004',f:'00000000-0000-4000-8000-000000000005',f2:'00000000-0000-4000-8000-000000000006',a:'00000000-0000-4000-8000-000000000007',a2:'00000000-0000-4000-8000-000000000008',a3:'00000000-0000-4000-8000-000000000009'};
function binPath(){if(process.env.ARTECNA_PG_BIN)return process.env.ARTECNA_PG_BIN;let d=__dirname;while(true){const p=path.join(d,'audit-locali/INTEGRATIVO-CLEANUP-20261025/native-runtime/artecna-postgres-test-runtime/pgsql/bin');if(fs.existsSync(path.join(p,'initdb.exe')))return p;const up=path.dirname(d);if(up===d)return null;d=up;}}
async function start(){const bin=binPath();if(!bin)throw Error('Native PostgreSQL runtime unavailable; set ARTECNA_PG_BIN for this test process only');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-clienti-'));
const run=(name,args)=>{const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(r.status,0,r.stderr||r.error?.message);};
const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
run('initdb',['-D',dir,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C']);run('pg_ctl',['-D',dir,'-l',path.join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);
const connections=[];async function connect(role='postgres',uid=ids.user){const c=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await c.connect();connections.push(c);if(role!=='postgres'){await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);await c.query('SET ROLE '+(role==='anon'?'anon':'authenticated'));}return c;}
const admin=await connect();
try{await admin.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE SCHEMA artecna_guardie;
CREATE TABLE public.cantieri(id uuid PRIMARY KEY,nome text);
CREATE TABLE public.utenti_impresa(user_id uuid,attivo boolean,ruolo text);
CREATE TABLE public.utenti_cantiere(user_id uuid,cantiere_id uuid,ruolo text);
CREATE TABLE public.fatture_emesse(id uuid PRIMARY KEY,numero_fattura text,data_fattura date,cliente text,cantiere text,imponibile numeric,iva numeric,totale numeric,importo_incassato numeric,stato text,note text,created_at timestamptz DEFAULT now(),xml_url text,pdf_url text,cantiere_id uuid REFERENCES public.cantieri);
CREATE TABLE public.acconti_cantiere(id uuid PRIMARY KEY,created_at timestamptz DEFAULT now(),cantiere text,descrizione text,importo numeric,data_incasso date,metodo text,nota text,cantiere_id uuid REFERENCES public.cantieri);
CREATE TABLE public.incassi_non_fatturati(id uuid PRIMARY KEY,data_incasso date,cliente text,cantiere text,descrizione text,importo numeric,metodo text,stato text,note text,created_at timestamptz,cantiere_id uuid REFERENCES public.cantieri);
CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION artecna_guardie.utente_puo_operare_impresa(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.utenti_impresa u WHERE p_user_id IS NOT NULL AND u.user_id=p_user_id AND u.attivo=true AND u.ruolo='titolare') $$;
CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(p_user_id uuid,p_cantiere_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere u WHERE p_user_id IS NOT NULL AND p_cantiere_id IS NOT NULL AND u.user_id=p_user_id AND u.cantiere_id=p_cantiere_id AND u.ruolo='owner') $$;
GRANT ALL ON public.fatture_emesse,public.acconti_cantiere TO authenticated;
INSERT INTO public.cantieri VALUES('${ids.c}','CANTIERE SINTETICO'),('${ids.c2}','CANTIERE SINTETICO');
INSERT INTO public.utenti_impresa VALUES('${ids.user}',true,'titolare');INSERT INTO public.utenti_cantiere VALUES('${ids.user}','${ids.c}','owner');
INSERT INTO public.fatture_emesse(id,numero_fattura,data_fattura,cliente,cantiere,totale,importo_incassato,stato,cantiere_id) VALUES('${ids.f}','SYN-1','2026-01-01','CLIENTE SINTETICO','CANTIERE SINTETICO',3000,0,'emessa','${ids.c}'),('${ids.f2}','SYN-2','2026-01-02','CLIENTE SINTETICO','CANTIERE SINTETICO',3000,0,'emessa','${ids.c}');
INSERT INTO public.acconti_cantiere(id,descrizione,importo,data_incasso,cantiere_id) VALUES('${ids.a}','INCASSO SINTETICO',1000,'2026-02-01','${ids.c}'),('${ids.a2}','INCASSO SINTETICO 2',2500,'2026-03-01','${ids.c}'),('${ids.a3}','INCASSO SINTETICO 3',2500,'2026-03-01','${ids.c}');
`);
await admin.query(fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations/20261028_clienti_incassi_attribuzioni.sql'),'utf8'));
}catch(e){await Promise.allSettled(connections.map(c=>c.end()));run('pg_ctl',['-D',dir,'-m','immediate','-w','stop']);throw e;}
return {admin,connect,dir,port,async reset(){await admin.query('TRUNCATE artecna_contabilita.attribuzioni_clienti');await admin.query(`UPDATE public.fatture_emesse SET totale=3000,importo_incassato=0,stato='emessa',cliente='CLIENTE SINTETICO',cantiere_id='${ids.c}';UPDATE public.acconti_cantiere SET importo=CASE WHEN id='${ids.a}' THEN 1000 ELSE 2500 END,data_incasso='2026-02-01',cantiere_id='${ids.c}'`);},async close(){await Promise.allSettled(connections.map(c=>c.end()));run('pg_ctl',['-D',dir,'-m','immediate','-w','stop']);}};
}
module.exports={start,ids,binPath};
