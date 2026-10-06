const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',R='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',M='cccccccc-cccc-4ccc-8ccc-cccccccccccc',TOKEN='ab'.repeat(32),context={cantiere_id:A,data:'2026-10-06'};
function load(file,requires=()=>{throw Error('Import inatteso')},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:requires,Request,Response,URL,console:{error:()=>{throw Error('Log vietato')},log:()=>{throw Error('Log vietato')}},...extra});return exports;}
const v1=load('validaLetturaPortale.ts'),v2=load('validaLetturaMateriali.ts',()=>v1);
test('M2.4 type-contract: Materiale/Riepilogo condivisi tra writer e lettura, decimali stringa',()=>{
 const filename=path.join(__dirname,'__m24_contract_test__.ts').replaceAll('\\','/'),source=`
 import type {MaterialeRapportinoV1,RiepilogoMaterialiRapportinoV1,EsitoRapportinoContrattoDue,DettaglioRapportinoV2,StatoRapportinoV2} from './contrattoMaterialiRapportino';
 type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
 type Check<T extends true>=T;
 type WriterRow=Check<Equal<EsitoRapportinoContrattoDue['materiali'][number],MaterialeRapportinoV1>>;
 type ReadRow=Check<Equal<DettaglioRapportinoV2['materiali'][number],MaterialeRapportinoV1>>;
 type Summary=Check<Equal<EsitoRapportinoContrattoDue['riepilogo_materiali'],RiepilogoMaterialiRapportinoV1>>;
 type SummaryRead=Check<Equal<DettaglioRapportinoV2['riepilogo_materiali'],RiepilogoMaterialiRapportinoV1>>;
 type Decimal=Check<Equal<MaterialeRapportinoV1['quantita'],string>>;
 type Adoption=Check<Equal<DettaglioRapportinoV2['versione_materiali'],0|1>>;
 type Document=Check<Equal<keyof DettaglioRapportinoV2['documento'],'note'>>;
 type Legacy=Check<Equal<keyof DettaglioRapportinoV2['documento_legacy_materiali'],'materiali'|'quantita_materiali'>>;
 function read(s:StatoRapportinoV2){if(s.versione_prestazioni===1)return s.dettaglio.materiali;if(s.versione_prestazioni===0)return s.rapportino_id;return s.rapportino_id;}
 `;
 const options={strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,lib:['lib.esnext.d.ts','lib.dom.d.ts']},host=ts.createCompilerHost(options),oldRead=host.readFile.bind(host),oldExists=host.fileExists.bind(host),oldSource=host.getSourceFile.bind(host);
 host.fileExists=f=>f.replaceAll('\\','/')===filename||oldExists(f);host.readFile=f=>f.replaceAll('\\','/')===filename?source:oldRead(f);host.getSourceFile=(f,lang,...rest)=>f.replaceAll('\\','/')===filename?ts.createSourceFile(f,source,lang,true):oldSource(f,lang,...rest);
 const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host));assert.deepEqual(diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
});

test('M2.4 adapter: firma fissa a cinque argomenti, identità e sanitizzazione invariati',async t=>{
 const calls=[],logs=[],state={mode:'ok'};
 class DatabaseError extends Error{}
 const adapter=load('adapterPortalePostgres.server.ts',name=>{
 if(name==='server-only')return {};if(name==='./caSupabase.server')return {CA_SUPABASE:'CA fixture'};
 if(name==='@vercel/functions')return {attachDatabasePool:()=>{}};
 if(name==='pg')return {DatabaseError,Pool:class{on(){return this;}async query(query){calls.push(query);if(state.mode==='identity')return {rows:[]};if(state.mode==='PR401'){const e=new DatabaseError('Driver token '+TOKEN);e.code='PR401';throw e;}return {rows:[{result:dto()}]};}}};throw Error('Import inatteso');
 },{process:{env:{RAPPORTINI_DATABASE_URL:'postgresql://artecna_rapportini_backend.testref:fixture_password@example.pooler.supabase.com:6543/postgres'}},console:{error:(...args)=>logs.push(args.join(' '))}});
 const args={p_sessione:TOKEN,p_cantiere_id:A,p_data:context.data,p_rapportino_id:R,p_versione_lettura:2};
 await t.test('SQL whitelistata esatta, fifth smallint, valori separati',async()=>{await adapter.rpcPortalePostgres('leggi_rapportino_portale_v2',args);assert(calls[0].text.includes('public.leggi_rapportino_portale($1::text,$2::uuid,$3::date,$4::uuid,$5::smallint)'));assert(calls[0].text.includes("session_user = 'artecna_rapportini_backend' AND current_user = 'artecna_rapportini_backend'"));assert.deepEqual(JSON.parse(JSON.stringify(calls[0].values)),[TOKEN,A,context.data,R,2]);});
 await t.test('firma V1 resta a quattro parametri',async()=>{await adapter.rpcPortalePostgres('leggi_rapportino_portale',args);assert.equal(calls.at(-1).values.length,4);assert(!calls.at(-1).text.includes('$5'));});
 await t.test('PR401 distinguibile anche sull’overload',async()=>{state.mode='PR401';const r=await adapter.rpcPortalePostgres('leggi_rapportino_portale_v2',args);assert.equal(r.error.code,'PR401');assert(!r.error.message.includes(TOKEN));});
 await t.test('identità errata/SQL arbitraria negate e nessun segreto nei log',async()=>{state.mode='identity';await assert.rejects(()=>adapter.rpcPortalePostgres('leggi_rapportino_portale_v2',args));await assert.rejects(()=>adapter.rpcPortalePostgres('query_arbitraria',args));assert(logs.length>0);assert(!logs.join(' ').includes(TOKEN));assert(!logs.join(' ').includes('fixture_password'));assert(!logs.join(' ').includes('SELECT'));});
});
function dto(){return {versione_lettura:2,...context,presente:true,versione_prestazioni:1,rapportino_id:R,dettaglio:{versione_contratto:2,rapportino_id:R,revisione:3,...context,documento:{note:'Note'},prestazioni:[],versione_materiali:1,documento_legacy_materiali:{materiali:'Testo storico',quantita_materiali:'Due sacchi'},materiali:[{materiale_id:M,chiave_client:M,descrizione:'Collante',unita_misura:'sacco',quantita:'2.500000',costo_unitario:'1.234567',costo_totale:'3.09',note:'',revisione:0,rimossa_at:null}],riepilogo_materiali:{totale_materiali_valorizzati:'3.09',numero_materiali_da_valorizzare:0,valorizzazione_completa:true}}};}
test('M2.4 validatore: chiavi esatte, decimali, identità e riepilogo autorevole',async t=>{
 await t.test('DTO valido condiviso, validatore V1 non accetta V2',()=>{assert(v2.letturaMaterialiValida(dto(),context));assert.equal(v1.letturaPortaleValida(dto(),context),false);});
 const mutations={
 'extra envelope':r=>r.token='secret','extra dettaglio':r=>r.dettaglio.costo_materiali='5',
 'extra documento':r=>r.dettaglio.documento.materiali='Testo','extra legacy':r=>r.dettaglio.documento_legacy_materiali.costo_materiali='5',
 'extra materiale':r=>r.dettaglio.materiali[0].created_at='x','extra riepilogo':r=>r.dettaglio.riepilogo_materiali.extra=true,
 'quantità number':r=>r.dettaglio.materiali[0].quantita=2.5,'costo number':r=>r.dettaglio.materiali[0].costo_unitario=1.23,
 'totale number':r=>r.dettaglio.materiali[0].costo_totale=3.09,'riepilogo number':r=>r.dettaglio.riepilogo_materiali.totale_materiali_valorizzati=3.09,
 'scala errata':r=>r.dettaglio.materiali[0].quantita='2.5','esponente':r=>r.dettaglio.materiali[0].quantita='2.5e1',
 'NaN':r=>r.dettaglio.materiali[0].costo_unitario='NaN','range':r=>r.dettaglio.materiali[0].quantita='1000000000000.000000',
 'quantità zero':r=>r.dettaglio.materiali[0].quantita='0.000000','costo negativo':r=>r.dettaglio.materiali[0].costo_unitario='-1.000000',
 'UUID errato':r=>r.dettaglio.materiali[0].materiale_id='bad','chiave non canonica':r=>r.dettaglio.materiali[0].chiave_client=M.toUpperCase(),
 'duplicato id':r=>r.dettaglio.materiali.push({...r.dettaglio.materiali[0]}),'revisione negativa':r=>r.dettaglio.materiali[0].revisione=-1,
 'revisione frazione':r=>r.dettaglio.revisione=1.2,'tombstone invalido':r=>r.dettaglio.materiali[0].rimossa_at='bad',
 'versione materiali invalida':r=>r.dettaglio.versione_materiali=2,'versione 0 con righe':r=>r.dettaglio.versione_materiali=0,
 'formula divergente':r=>r.dettaglio.materiali[0].costo_totale='3.08','riepilogo divergente':r=>r.dettaglio.riepilogo_materiali.totale_materiali_valorizzati='8.00',
 'conteggio divergente':r=>r.dettaglio.riepilogo_materiali.numero_materiali_da_valorizzare=1,'completezza divergente':r=>r.dettaglio.riepilogo_materiali.valorizzazione_completa=false,
 'cantiere divergente':r=>r.dettaglio.cantiere_id=R,'data divergente':r=>r.data='2026-10-07',
 'prestazione extra':r=>r.dettaglio.prestazioni=[{costo_orario:100}],
 };
 for(const [name,change] of Object.entries(mutations))await t.test('rifiuta '+name,()=>{const r=dto();change(r);assert.equal(v2.letturaMaterialiValida(r,context),false);});
 await t.test('NULL coerente e tutte non valorizzate',()=>{const r=dto();Object.assign(r.dettaglio.materiali[0],{costo_unitario:null,costo_totale:null});r.dettaglio.riepilogo_materiali={totale_materiali_valorizzati:'0.00',numero_materiali_da_valorizzare:1,valorizzazione_completa:false};assert(v2.letturaMaterialiValida(r,context));});
 await t.test('tombstone coerente non conta nel riepilogo',()=>{const r=dto();r.dettaglio.materiali[0].rimossa_at='2026-10-06T08:00:00Z';r.dettaglio.riepilogo_materiali.totale_materiali_valorizzati='0.00';assert(v2.letturaMaterialiValida(r,context));});
 await t.test('aritmetica oltre Number.MAX_SAFE_INTEGER rimane esatta',()=>{const r=dto(),m=r.dettaglio.materiali[0];m.quantita='999999999999.000000';m.costo_unitario='999999999999.000000';m.costo_totale='999999999998000000000001.00';r.dettaglio.riepilogo_materiali.totale_materiali_valorizzati=m.costo_totale;assert(v2.letturaMaterialiValida(r,context));});
});
class ErroreServizioRapportini extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
function readerHarness(result){const calls=[];const reader=load('letturaMaterialiPortale.server.ts',name=>{
 if(name==='server-only')return {};
 if(name==='./validaLetturaPortale')return v1;if(name==='./validaLetturaMateriali')return v2;
 if(name==='./adapterPortalePostgres.server')return {rpcPortalePostgres:async(name,args)=>{calls.push({name,args});return typeof result==='function'?result():result;}};
 if(name==='./servizioRapportini.server')return {ErroreServizioRapportini,verificaOrigineRapportino:()=>{},tokenSessioneRapportino:cookie=>cookie?.includes(TOKEN)?TOKEN:null};throw Error('Dipendenza inattesa');});return {reader,calls};}
const req=()=>new Request('https://example.invalid/api/rapportino/stato',{method:'POST',headers:{cookie:'artecna_rapportino_sessione='+TOKEN}});
test('M2.4 lettore server e servizio: RPC opt-in, validazione e errori sanitizzati',async t=>{
 await t.test('parametri esatti: quinta versione 2, stesso cookie/contesto',async()=>{const h=readerHarness({data:dto(),error:null});assert.deepEqual(await h.reader.leggiMaterialiPortale(req(),context),dto());assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'leggi_rapportino_portale_v2');assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)),{p_sessione:TOKEN,p_cantiere_id:A,p_data:context.data,p_rapportino_id:null,p_versione_lettura:2});});
 for(const [code,status] of [['PR401',401],['42501',403],['PR409',409],['22023',400],['other',503]])await t.test('mapping '+code,async()=>{const h=readerHarness({data:null,error:{code,message:'SQL secret '+TOKEN}});await assert.rejects(()=>h.reader.leggiMaterialiPortale(req(),context),e=>e.status===status&&!e.message.includes(TOKEN)&&!e.message.includes('SQL'));});
 await t.test('trasporto e risposta invalida diventano 503 sanitizzato',async()=>{for(const result of [()=>{throw Error('Driver '+TOKEN);},{data:{...dto(),extra:'secret'},error:null}]){const h=readerHarness(result);await assert.rejects(()=>h.reader.leggiMaterialiPortale(req(),context),e=>e.status===503&&!e.message.includes(TOKEN));}});
 await t.test('sessione assente: nessuna RPC',async()=>{const h=readerHarness({data:dto(),error:null});await assert.rejects(()=>h.reader.leggiMaterialiPortale(new Request('https://example.invalid'),context),e=>e.status===401);assert.equal(h.calls.length,0);});
 await t.test('servizio V2 normalizza e invoca una volta, senza dipendenze V1 cambiate',async()=>{const h=readerHarness({data:dto(),error:null}),s=load('servizioLetturaPortale.server.ts',name=>{if(name==='server-only')return {};if(name==='./validaLetturaPortale')return v1;if(name==='./servizioRapportini.server')return {ErroreServizioRapportini};if(name==='./letturaRapportinoPortale.server')return {};if(name==='./letturaMaterialiPortale.server')return h.reader;throw Error('Dipendenza inattesa');});await s.leggiStatoRapportinoPortaleV2(req(),{cantiere_id:' '+A.toUpperCase()+' ',data:' '+context.data+' '});assert.equal(h.calls.length,1);});
});
test('M2.4 route /stato e trasporto: opt-in senza cambiare Mobile operativo',async t=>{
 const calls=[],old={data:context.data,presente:false,versione_prestazioni:null,rapportino:null,timbrature:[]};
 const file=path.join(__dirname,'../../api/rapportino/stato/route.ts'),exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Response,require:name=>{if(name==='next/server')return {NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),{...options,headers:{...options.headers,'Content-Type':'application/json'}})}};if(name.includes('servizioLetturaPortale.server'))return {leggiStatoRapportinoPortale:async(_,input)=>{calls.push({version:1,input});return {versione_lettura:1,...context,presente:false,versione_prestazioni:null,rapportino_id:null,dettaglio:null};},leggiStatoRapportinoPortaleV2:async(_,input)=>{calls.push({version:2,input});return dto();}};if(name.includes('servizioRapportini.server'))return {ErroreServizioRapportini,verificaOrigineRapportino:()=>{}};if(name==='@supabase/supabase-js')return {createClient:()=>{throw Error('Nessun legacy nella lettura V2');}};throw Error('Import inatteso');}});
 const request=body=>new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)});
 await t.test('senza versione: vecchia risposta identica e no-store',async()=>{const r=await exports.POST(request({cantiereId:A,data:context.data}));assert.deepEqual(await r.json(),old);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(calls.at(-1).version,1);});
 await t.test('versione 2: DTO esplicito e no-store, nessuna lettura legacy',async()=>{const r=await exports.POST(request({cantiereId:A,data:context.data,rapportinoId:R,versione_lettura:2}));assert.deepEqual(await r.json(),dto());assert.equal(calls.at(-1).version,2);assert.equal(calls.at(-1).input.rapportino_id,R);assert.equal(r.headers.get('cache-control'),'no-store');});
 for(const version of [null,1,3,'2'])await t.test('versione route non supportata '+version,async()=>{const n=calls.length,r=await exports.POST(request({versione_lettura:version}));assert.equal(r.status,400);assert.equal(calls.length,n);});
 await t.test('trasporto V1 omette versione; opt-in separato invia solo 2',async()=>{const captured=[],transport=load('../../rapportino/trasportoMobileRapportinoV1.ts',()=>{throw Error('Import runtime inatteso');},{fetch:async(url,options)=>{captured.push({url,...options});return new Response('{}');}});await transport.trasportoMobileRapportinoV1.leggiStato(context);await transport.leggiStatoMobileV2(context);assert.equal(JSON.parse(captured[0].body).versione_lettura,undefined);assert.equal(JSON.parse(captured[1].body).versione_lettura,2);assert.equal(captured[0].url,captured[1].url);});
});
