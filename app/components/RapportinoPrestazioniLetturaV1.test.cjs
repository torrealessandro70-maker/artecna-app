// JSX e hook in memoria; RPC osservata, nessun DB/ENV/rete reale.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const load=(f,req)=>{const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:e,require:req});return e};
const jsx=(type,props)=>({type,props}),R='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222',O='33333333-3333-4333-8333-333333333333',V='44444444-4444-4444-8444-444444444444';
const row=(i,start,end,econ)=>({prestazione_id:`aaaaaaaa-aaaa-4aaa-8aaa-00000000000${i}`,chiave_client:`riga-${i}`,operaio_id:O,operaio_nome:'Torre Alessandro',ora_inizio:start,ora_fine:end,pausa_minuti:0,lavoro_in_economia:econ,variante_id:econ?V:null,ore:4,revisione:0,rimossa_at:null});
const detail=()=>({versione_contratto:1,rapportino_id:R,revisione:1,cantiere_id:C,data:'2026-10-25',documento:{note:'Lavorazione',materiali:'',quantita_materiali:''},prestazioni:[row(1,'07:00','11:00',false),row(2,'11:00','15:00',true)]});
const response=()=>({versione_lettura:1,cantiere_id:C,data:'2026-10-25',presente:true,versione_prestazioni:1,rapportino_id:R,dettaglio:detail()});
const report=()=>({id:R,cantiere_id:C,versione_prestazioni:1,cantiere:'Cantiere sintetico',data:'2026-10-25',ore:'8',note:'Riepilogo storico'});
const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,out));else if(n?.props){out.push(n);nodes(typeof n.type==='function'?n.type(n.props):n.props.children,out)}return out};
const text=n=>Array.isArray(n)?n.map(text).join(''):n?.props?text(typeof n.type==='function'?n.type(n.props):n.props.children):n==null||typeof n==='boolean'?'':String(n);
function harness(value=response(),rpcError=null){const state=[],refs=[],calls=[];let cursor=0,rc=0;const react={useState:init=>{const i=cursor++;if(!(i in state))state[i]=init;return[state[i],v=>state[i]=v]},useRef:init=>refs[rc++]||(refs[rc-1]={current:init})};
 const validator=load('../engines/rapportini/validaLetturaPortale.ts',()=>({}));
 const client={rpc:async(n,p)=>{calls.push({n,p});return{data:value,error:rpcError}},from:()=>{throw Error('Richiesta tabellare non autorizzata')}};
 const panel=load('RapportinoPrestazioniLetturaV1.tsx',n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n.includes('supabaseClient')?{supabase:client}:validator);
 return{panel,calls,render:(r=report())=>{cursor=0;rc=0;return panel.default({rapportino:r})}};
}
const flush=()=>new Promise(setImmediate);
test('render: due fasce consecutive distinte, 4+4, subtotali e variante solo Economia',()=>{
 const h=harness(),tree=h.panel.DettaglioPrestazioniRapportinoV1({dettaglio:detail()}),lines=nodes(tree).filter(n=>n.type==='li');a.equal(lines.length,2);a.equal(text(lines[0]),'07:00–11:00 — Ordinario — 4:00 h');a.equal(text(lines[1]),`11:00–15:00 — Economia — 4:00 h · Variante ${V}`);a(text(tree).includes('Totale: 8:00 h — Ordinario: 4:00 h — Economia: 4:00 h'));a.equal(nodes(tree).filter(n=>['button','input','textarea','select','form'].includes(n.type)).length,0);
 const d=detail();d.prestazioni[1].ore=3.5;d.prestazioni[1].pausa_minuti=30;d.prestazioni.push({...row(3,'15:00','19:00',false),rimossa_at:'2026-10-25T18:00:00Z'});const t=h.panel.DettaglioPrestazioniRapportinoV1({dettaglio:d});a.equal(nodes(t).filter(n=>n.type==='li').length,2);a(text(t).includes('Totale: 7:30 h — Ordinario: 4:00 h — Economia: 3:30 h'));
});
test('apertura: zero richieste al mount; unicamente RPC di lettura al click, niente scritture',async()=>{
 const h=harness();h.render();a.equal(h.calls.length,0);let b=nodes(h.render()).find(n=>n.type==='button');b.props.onClick();b.props.onClick();await flush();a.equal(h.calls.length,1);a.equal(h.calls[0].n,'leggi_rapportino_desktop');a.equal(JSON.stringify(h.calls[0].p),JSON.stringify({p_cantiere_id:C,p_data:'2026-10-25',p_rapportino_id:R,p_versione_lettura:1}));const t=h.render();a(text(t).includes('Totale: 8:00 h'));a.equal(nodes(t).filter(n=>n.type==='button').length,1);a.equal(text(nodes(t).find(n=>n.type==='button')),'Nascondi prestazioni');nodes(t).find(n=>n.type==='button').props.onClick();a.equal(h.calls.length,1);a(!text(h.render()).includes('07:00'));
});
test('legacy: riepilogo Card preservato e nessuna lettura o prestazione inventata',()=>{
 const h=harness(),legacy={...report(),versione_prestazioni:0};a.equal(h.render(legacy),null);a.equal(h.calls.length,0);
 const Card=load('RapportinoCard.tsx',n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}:h.panel).default;
 const tree=Card({rapportino:legacy,index:0,fotoCantiere:[],buttonSecondary:{},setFotoRapportinoAperte:()=>{},preparaModificaRapportino:()=>{},eliminaRapportino:()=>{},generaPdfRapportinoFotografico:()=>{}});a(text(tree).includes('8 ore'));a(text(tree).includes('Riepilogo storico'));a(!text(tree).includes('Mostra prestazioni'));a(!text(tree).includes('Ordinario'));a.equal(h.calls.length,0);
});
test('dettaglio assente/errore/contesto errato: riepilogo conservato, nessuna riga fittizia',async()=>{
 for(const v of [{...response(),versione_prestazioni:0,dettaglio:null},{...response(),cantiere_id:O},null]){const h=harness(v);nodes(h.render()).find(n=>n.type==='button').props.onClick();await flush();const t=h.render();a(text(t).includes('riepilogo'));a.equal(nodes(t).filter(n=>n.type==='li').length,0);a.equal(h.calls.length,1);}
});
