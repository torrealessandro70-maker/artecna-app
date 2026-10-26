const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const {leggiMemoriaPrezziPreventivo}=require('./memoria-prezzi.ts')
const sql=fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations/20261026_preventivo_memoria_prezzi_lettura.sql'),'utf8')
test('client: reader autorevole paginato; nessuna query tabella, normalizzazione o prezzo modificato',async()=>{
 const calls=[],row={id:'a',descrizione:'Rasatura',unita_misura:'m²',prezzo_unitario:40,fonte:'Memoria ARTECNA'}
 const db={rpc:async(name,args)=>{calls.push({name,args});return{data:args.p_da===0?Array.from({length:500},(_,i)=>({...row,id:String(i)})):[{...row,id:'500'}],error:null}}}
 const r=await leggiMemoriaPrezziPreventivo(db);a.equal(r.autorizzata,true);a.equal(r.righe.length,501);a.equal(r.righe[0].prezzo_unitario,40);a.deepEqual(calls.map(x=>x.args.p_da),[0,500]);a(calls.every(x=>x.name==='leggi_memoria_prezzi_preventivo'&&x.args.p_limite===500))
})
test('client: diniego esplicito non inventa prezzi e permette al caller SIC24/voce libera',async()=>{
 a.deepEqual(await leggiMemoriaPrezziPreventivo({rpc:async()=>({data:null,error:{code:'42501'}})}),{righe:[],autorizzata:false})
 for(const data of [null,{},[{id:'a',descrizione:'R',prezzo_unitario:0,unita_misura:'m²',fonte:'M'}]])await a.rejects(leggiMemoriaPrezziPreventivo({rpc:async()=>({data,error:null})}))
 await a.rejects(leggiMemoriaPrezziPreventivo({rpc:async()=>({data:null,error:{code:'PGRST202'}})}))
})
test('SQL PostgreSQL embedded: baseline RLS default deny, titolare autorizzato, altri negati e nessuna modifica policy',async t=>{
 const db=new PGlite();t.after(()=>db.close());const owner='00000001-1111-4111-8111-111111111111',other='00000002-1111-4111-8111-111111111111'
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA artecna_guardie;
 CREATE TABLE public.utenti_impresa(user_id uuid,ruolo text,attivo boolean);
 CREATE TABLE public.memoria_prezzi(id uuid DEFAULT gen_random_uuid(),descrizione text,unita_misura text,prezzo_unitario numeric,fonte text,creato_il timestamptz DEFAULT now(),cantiere text,note text);
 ALTER TABLE public.memoria_prezzi ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.memoria_prezzi TO authenticated;
 CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION artecna_guardie.utente_puo_operare_impresa(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$SELECT EXISTS(SELECT 1 FROM public.utenti_impresa u WHERE p_user_id IS NOT NULL AND u.user_id=p_user_id AND u.attivo=true AND u.ruolo='titolare')$$;
 INSERT INTO public.utenti_impresa VALUES('${owner}','titolare',true),('${other}','operatore',true);
 INSERT INTO public.memoria_prezzi(descrizione,unita_misura,prezzo_unitario,fonte,cantiere,note) VALUES('Rasatura','m²',40,'Memoria ARTECNA','Dato da non esporre','Nota da non esporre'),('Rasatura','m²',60,'Memoria ARTECNA','Altro','Privata');`)
 await db.exec(`SET request.jwt.claim.sub='${owner}';SET ROLE authenticated`)
 a.equal((await db.query('SELECT count(*)::int n FROM public.memoria_prezzi')).rows[0].n,0)
 await db.exec('RESET ROLE');await db.exec(sql)
 await db.exec('SET ROLE authenticated');const rows=(await db.query('SELECT * FROM public.leggi_memoria_prezzi_preventivo(0,500)')).rows;a.equal(rows.length,2);a.deepEqual(rows.map(r=>Number(r.prezzo_unitario)).sort((a,b)=>a-b),[40,60]);a(!('cantiere' in rows[0]));a(!('note' in rows[0]));a.equal((await db.query('SELECT count(*)::int n FROM public.memoria_prezzi')).rows[0].n,0)
 await a.rejects(db.query('SELECT * FROM public.leggi_memoria_prezzi_preventivo(-1,500)'),e=>e.code==='22023')
 await a.rejects(db.query('SELECT * FROM public.leggi_memoria_prezzi_preventivo(0,501)'),e=>e.code==='22023')
 await db.exec(`SET request.jwt.claim.sub='${other}'`);await a.rejects(db.query('SELECT * FROM public.leggi_memoria_prezzi_preventivo()'),e=>e.code==='42501')
 await db.exec('RESET ROLE;SET ROLE anon');await a.rejects(db.query('SELECT * FROM public.leggi_memoria_prezzi_preventivo()'),e=>e.code==='42501')
 await db.exec('RESET ROLE');await db.query('UPDATE utenti_impresa SET attivo=false WHERE user_id=$1',[owner]);await db.exec(`SET request.jwt.claim.sub='${owner}';SET ROLE authenticated`);await a.rejects(db.query('SELECT * FROM public.leggi_memoria_prezzi_preventivo()'),e=>e.code==='42501')
 await db.exec('RESET ROLE');a.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE tablename='memoria_prezzi'")).rows[0].n,0);a.equal((await db.query("SELECT pg_get_userbyid(proowner) owner FROM pg_proc WHERE oid='public.leggi_memoria_prezzi_preventivo(integer,integer)'::regprocedure")).rows[0].owner,'postgres');a.equal((await db.query('SELECT count(*)::int n FROM public.memoria_prezzi')).rows[0].n,2)
})
