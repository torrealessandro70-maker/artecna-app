const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm'),crypto=require('crypto')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const {voceLibera,voceDaRiferimento,cercaRiferimenti,totaleManuale,validaManuale}=require('./manuale.ts')
const sic={id:'sic',codice:'SIC24_1.1',descrizione:'Fornitura e posa piastrelle ceramiche',unita_misura:'m²',prezzo_unitario:20,fonte:'SIC24'}
const memoria={...sic,id:'mem',codice:null,prezzo_unitario:30,fonte:'Memoria ARTECNA'}
test('ricerca SIC24 per codice e testo, deterministica, nessun risultato implicito',()=>{
 a.deepEqual(cercaRiferimenti('sic24_1.1',[sic,memoria]),[sic]);a.equal(cercaRiferimenti('piastrelle ceramiche',[sic]).length,1);a.deepEqual(cercaRiferimenti('',[sic]),[])
 a.deepEqual(cercaRiferimenti('piastrelle',[memoria,sic]),cercaRiferimenti('piastrelle',[sic,memoria]))
})
test('ricerca memoria prezzi e fonti escluse senza query pertinente',()=>{a.equal(cercaRiferimenti('piastrelle',[memoria])[0].fonte,'Memoria ARTECNA');a.equal(cercaRiferimenti('impermeabilizzazione',[memoria]).length,0)})
test('aggiunta riferimento riusa prezzo/priorità esistenti e conserva provenienza',()=>{
 const r=voceDaRiferimento(sic,[sic],[],[]);a.equal(r.quantita,1);a.equal(r.prezzo_unitario,25);a.equal(r.origine_documento,'manuale');a.deepEqual(r.riferimento_scelto,sic)
 const storico={...memoria,prezzo_unitario:17,fonte:'Storico ARTECNA — preventivo approvato'};a.equal(voceDaRiferimento(sic,[sic],[memoria],[storico]).prezzo_unitario,17)
})
test('voce libera indipendente, nessun prezzo inventato o scrittura memoria',()=>{const a1=voceLibera(),b=voceLibera();a.equal(a1.fonte_prezzo,'Inserito manualmente');a.equal(a1.prezzo_unitario,0);a1.descrizione='A';a.equal(b.descrizione,'')})
test('più voci, quantità/prezzo e totali, righe originali non modificate',()=>{
 const r=voceDaRiferimento(sic,[sic],[],[]),edited={...r,quantita:3,prezzo_unitario:12};a.equal(totaleManuale([edited]),36);a.equal(totaleManuale([edited,r]),61);a.equal(r.prezzo_unitario,25)
 a.doesNotThrow(()=>validaManuale([edited,r]));for(const v of [{...r,quantita:0},{...r,quantita:-1},{...r,prezzo_unitario:NaN},voceLibera()])a.throws(()=>validaManuale([v]));a.throws(()=>validaManuale([]))
})
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'}
const nodes=x=>x==null?[]:Array.isArray(x)?x.flatMap(nodes):typeof x==='object'?[x,...nodes(x.props?.children)]:[]
const text=x=>x==null?'':Array.isArray(x)?x.map(text).join(''):typeof x==='object'?text(x.props?.children):String(x)
function hooks(){let slots=[],cursor=0,effects=[],seen=[];return{api:{useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;return slots[i]??(slots[i]={current:init})},useEffect:(f,deps)=>{const i=cursor++;if(!seen[i]||!deps||deps.some((v,j)=>v!==seen[i][j])){effects.push(f);seen[i]=deps}},useMemo:(f)=>f()},begin(){cursor=0},end(){for(const f of effects.splice(0))f()}}}
function load(name,h,extra={}){const folder=path.resolve(__dirname,'../../components'),file=path.join(folder,name),code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,ex={};vm.runInNewContext(code,{exports:ex,require:n=>n==='react/jsx-runtime'?jsx:n==='react'?h.api:n.endsWith('/supabaseClient')?{supabase:{}}:n.startsWith('./')?{__esModule:true,default:n,chiaveAnalisiVoce:()=>''}:require(path.resolve(folder,n)),Error,crypto:crypto.webcrypto,console,window:{addEventListener(){},removeEventListener(){},confirm:()=>true},alert:()=>{},...extra});return ex.default}
const tick=()=>new Promise(r=>setImmediate(r))
const btn=(t,name)=>{const b=nodes(t).find(n=>n.type==='button'&&text(n)===name);a(b,'button '+name);return b}
function editorProps(){return{manuale:true,messaggioAi:'',descrizionePreventivoAi:'Test',setDescrizionePreventivoAi(){},vociPreventivoAiOriginali:[],prezziRiferimento:[],memoriaRiferimento:[],calcolaMediaPrezziSimili:()=>null,verificaPrezzoAnomalo:()=>'',formatMoney:String,miglioraVocePreventivoAi(){throw Error('AI vietata')},salvaInMemoriaPrezzi(){throw Error('memoria vietata')},generaExcelDefinitivoPreventivoAi(){},salvaRevisionePreventivoAi(){},preventivoRegistroCantiere:'Test',setMostraRevisionePreventivoAi(){},excelTable:{},excelTh:{},excelTd:{},buttonPrimary:{},buttonSecondary:{}}}
test('editor reale vuoto, aggiunta libera/ricerca, nessuna azione AI/Web; Excel senza memoria',async()=>{
 const h=hooks(),C=load('RevisionePreventivoAiPanel.tsx',h);let rows=[],excel=0;const props={...editorProps(),generaExcelDefinitivoPreventivoAi:()=>excel++}
 const render=()=>{h.begin();const t=C({...props,vociPreventivoAi:rows,setVociPreventivoAi:v=>rows=v});h.end();return t}
 let t=render();a(text(t).includes('Preventivo manuale'));a(nodes(t).some(n=>n.type==='./RicercaPrezziPreventivo'));btn(t,'+ Voce libera').props.onClick();a.equal(rows.length,1);a.equal(rows[0].origine_documento,'manuale');t=render();a.equal(btn(t,'Migliora testo').props.disabled,true);a(!nodes(t).some(n=>['./AnalisiPrezzoVoce','./PrezzoWebVoce'].includes(n.type)));await btn(t,'Genera Excel definitivo').props.onClick();a.equal(excel,1)
})
test('editor manuale conserva riferimento dopo override prezzo, riordina e rimuove con logica comune',()=>{
 const h=hooks(),C=load('RevisionePreventivoAiPanel.tsx',h);let rows=[voceDaRiferimento(sic,[sic],[],[]),{...voceLibera(),descrizione:'Libera',prezzo_unitario:7}]
 const render=()=>{h.begin();const t=C({...editorProps(),vociPreventivoAi:rows,setVociPreventivoAi:v=>rows=v});h.end();return t};let t=render()
 const price=nodes(t).find(n=>n.type==='input'&&n.props.value===25);a(price);price.props.onChange({target:{value:'22'}});a.equal(rows[0].prezzo_unitario,22);a.equal(rows[0].riferimento_scelto.prezzo_unitario,20);a.equal(rows[0].fonte_prezzo,'Prezzo manuale')
 t=render();btn(t,'↓').props.onClick();a.equal(rows[0].descrizione,'Libera')
})
test('pannello contrattuale reale: metadati, salvataggio, rilettura, Excel, nessuna chiamata AI',async()=>{
 const h=hooks(),calls=[],stored=new Map();let refresh=0,exports=[]
 const db={from:table=>{const q={op:'read',value:null,filters:{}};for(const op of ['order','range','in','gt'])q[op]=()=>q;q.select=()=>q;q.eq=(k,v)=>{q.filters[k]=v;return q};q.insert=v=>{q.op='insert';q.value=v;return q};q.update=v=>{q.op='update';q.value=v;return q};q.single=async()=>{calls.push(q.op);stored.set(q.value.id,structuredClone(q.value));return{data:{id:q.value.id},error:null}};q.then=f=>Promise.resolve({data:[],error:null}).then(f);return q}}
 const C=load('PreventivoManualePanel.tsx',h,{fetch:()=>{throw Error('AI vietata')}}),props={db,cantieri:[{id:'c',nome:'Cantiere sintetico',cliente:'Cliente test'}],cantiereId:'c',chiudi(){},salvato:()=>refresh++,excel:d=>exports.push(d)}
 const render=()=>{h.begin();const t=C(props);h.end();return t};let t=render();await tick();t=render();let ed=nodes(t).find(n=>n.type==='./RevisionePreventivoAiPanel');a(ed);a.equal(ed.props.vociPreventivoAi.length,0);ed.props.setVociPreventivoAi([{...voceLibera(),descrizione:'Voce test',prezzo_unitario:12,quantita:2}]);t=render();ed=nodes(t).find(n=>n.type==='./RevisionePreventivoAiPanel');await ed.props.salvaRevisionePreventivoAi();a.equal(refresh,1);a.deepEqual(calls,['insert']);const doc=[...stored.values()][0];a.equal(doc.importo_totale,24);a.equal(doc.cantiere_id,'c');a.equal(doc.cliente_ai,'Cliente test');a.equal(doc.origine_ai,false);a.equal(doc.approvato,false)
 t=render();ed=nodes(t).find(n=>n.type==='./RevisionePreventivoAiPanel');await ed.props.generaExcelDefinitivoPreventivoAi();a.equal(exports.length,1);a.equal(exports[0].json_voci_ai[0].quantita,2);await ed.props.salvaRevisionePreventivoAi();a.deepEqual(calls,['insert','update'])
 const h2=hooks(),C2=load('PreventivoManualePanel.tsx',h2);h2.begin();C2({...props,iniziale:doc});h2.end();await tick();h2.begin();const reopened=C2({...props,iniziale:doc});h2.end();const ed2=nodes(reopened).find(n=>n.type==='./RevisionePreventivoAiPanel');a.equal(ed2.props.vociPreventivoAi.length,1);a.equal(ed2.props.vociPreventivoAi[0].prezzo_unitario,12)
})
test('integrativo manuale usa contesto e writer Step5 senza route AI',async()=>{
 const {id,packet,digest}=require('../variante-fonti/fixture.cjs'),p=packet([]),h=hooks(),calls=[];let saved=0
 const snap={lettura:{fonti:p,analisi:null},contratto:{id:id(14),voci:[{id:'1',descrizione:'Contratto',quantita:10,prezzo_unitario:20,unita_misura:'m²',quantita_riducibile:8}]},firma:digest('s'),genealogia:{cantiere_id:p.cantiere_id,variante_id:p.variante.id,preventivo_contrattuale_id:id(14),sopralluogo_origine_id:null}}
 const db={rpc:async(name,args)=>{calls.push(name);return{data:name==='leggi_contesto_preventivo_integrativo'?snap:{preventivo_id:args.p_richiesta_id,variante_id:args.p_variante_id},error:null}},from:()=>{const q={};for(const op of ['select','eq','order','range','in','gt'])q[op]=()=>q;q.then=f=>Promise.resolve({data:[],error:null}).then(f);return q}}
 const C=load('VariantePreventivoIntegrativoPanel.tsx',h,{fetch:()=>{throw Error('AI vietata')}}),render=()=>{h.begin();const t=C({supabase:db,metadatiManuali:{cliente:'Sintetico',titolo:'Integrativo test',data:'2026-10-26'},varianteId:p.variante.id,onSalvato:()=>saved++});h.end();return t};let t=render();btn(t,'Compila manualmente').props.onClick();await tick();t=render();let ed=nodes(t).find(n=>n.type==='./RevisionePreventivoAiPanel');a(ed);a.equal(ed.props.manuale,true);a.equal(ed.props.vociPreventivoAi.length,0);a.equal(ed.props.integrativo.id,id(14))
 ed.props.setVociPreventivoAi([{...voceLibera(),descrizione:'Voce umana',prezzo_unitario:15,revisione_confermata:true,da_verificare:false}]);t=render();ed=nodes(t).find(n=>n.type==='./RevisionePreventivoAiPanel');await ed.props.salvaRevisionePreventivoAi();a.equal(saved,1);a.deepEqual(calls,['leggi_contesto_preventivo_integrativo','salva_preventivo_integrativo_manuale'])
})

test('Registro reale: scelta manuale vuota e scelta AI rimanda al percorso precedente senza generare',()=>{
 const h=hooks(),C=load('RegistroPanel.tsx',h),props={sezioneAttiva:'registro',registroTab:'preventivi',cantieri:[],setSezioneAttiva:v=>dest=v};let dest=''
 const render=()=>{h.begin();const t=C(props);h.end();return t};let t=render();btn(t,'+ Nuovo preventivo').props.onClick();t=render();btn(t,'Compila manualmente').props.onClick();t=render();const m=nodes(t).find(n=>n.type==='./PreventivoManualePanel');a(m);a.equal(m.props.iniziale,undefined);m.props.chiudi();t=render();btn(t,'+ Nuovo preventivo').props.onClick();t=render();btn(t,'Genera con AI').props.onClick();a.equal(dest,'sopralluoghi')
})
test('ricerca UI reale: fonte, codice, UM, prezzo e + Aggiungi con stesso modello',()=>{
 const h=hooks(),C=load('RicercaPrezziPreventivo.tsx',h);let added
 const props={prezzi:[sic],memoria:[memoria],storico:[],aggiungi:v=>added=v},render=()=>{h.begin();const t=C(props);h.end();return t};let t=render();nodes(t).find(n=>n.type==='input').props.onChange({target:{value:'SIC24_1.1'}});t=render();a(text(t).includes('SIC24_1.1'));a(text(t).includes('m²'));a(text(t).includes('20,00'));btn(t,'+ Aggiungi').props.onClick();a.equal(added.origine_documento,'manuale');a.equal(added.prezzo_unitario,25)
})
