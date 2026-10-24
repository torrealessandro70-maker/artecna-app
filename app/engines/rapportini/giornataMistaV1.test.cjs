// Dati sintetici: runtime V1 reale, JSX in memoria e PostgreSQL PGlite isolato. Nessuna rete.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),{randomUUID:uuid}=require('crypto'),{PGlite}=require('@electric-sql/pglite');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const M=require('./bozzaRapportinoV1.ts'),S=require('./salvataggioBozzaV1.ts'),C=require('../economia/contabilitaManodopera.ts');
const {fixture,A,OP,OP2,V,USER,TOKEN}=require('./fixtureStep3.cjs'),root=path.resolve(__dirname,'../../..');
const read=n=>fs.readFileSync(path.join(root,'supabase/migrations',n),'utf8');
const cache={stato:'pronte',cantiere_id:A,varianti:[{id:V,selezionabile:true,numero:1,etichetta:'Variante'}]};
const row=(op,start,end,econ=false,pause=0)=>({prestazione_id:null,chiave_client:uuid(),operaio_id:op,ora_inizio:start,ora_fine:end,pausa_minuti:pause,lavoro_in_economia:econ,variante_id:econ?V:null});
const draft=(rows=[row(OP,'07:00','11:00'),row(OP,'11:00','15:00',true)])=>({...M.creaBozzaRapportinoV1(A,'2026-10-25'),prestazioni:{nuove:rows,aggiornate:[],rimosse:[]}});
test('giornata mista: 4+4, pause locali, >due fasce e rifiuto sovrapposte/null/negative',()=>{
 let b=draft();a.equal(M.riepilogoOreOperaio(M.prestazioniAttiveBozza(b)),'Totale 8:00 h — Ordinario 4:00 h — Economia 4:00 h');a(S.bozzaV1Salvabile(b,cache));
 b=M.modificaPrestazioneBozza(b,b.prestazioni.nuove[0].chiave_client,{pausa_minuti:30});a.equal(M.riepilogoOreOperaio(M.prestazioniAttiveBozza(b)),'Totale 7:30 h — Ordinario 3:30 h — Economia 4:00 h');
 const original=structuredClone(b),key=uuid();b=M.aggiungiPrestazioneOperaioBozza(b,OP,key);const third=b.prestazioni.nuove.at(-1);a.equal(third.operaio_id,OP);a.equal(third.ora_inizio,'15:00');a.equal(third.pausa_minuti,0);a.equal(third.variante_id,null);a.deepEqual(b.prestazioni.nuove.slice(0,2),original.prestazioni.nuove);b=M.modificaPrestazioneBozza(b,key,{ora_fine:'16:00'});a(S.bozzaV1Salvabile(b,cache));
 for(const change of [{ora_inizio:'10:59'},{ora_fine:'11:00'},{ora_fine:'10:00'},{pausa_minuti:240},{ora_fine:'24:00'}]){const x=draft();a(!S.bozzaV1Salvabile(M.modificaPrestazioneBozza(x,x.prestazioni.nuove[1].chiave_client,change),cache));}
 const overlapping=draft([row(OP,'07:00','12:00',false,60),row(OP,'11:00','15:00',true)]);a.equal(M.chiaviPrestazioniSovrapposte(overlapping).size,2);a.throws(()=>S.creaTentativoSalvataggioV1(overlapping,cache,uuid));
});
test('editor reale: aggiunta sotto operaio, righe indipendenti, riepilogo e Salva bloccato su overlap',()=>{
 const Editor=require('../../components/RapportinoPrestazioniEditorV1.tsx').default;let b=draft(),saves=0;
 const walk=(n,out=[])=>{if(Array.isArray(n))n.forEach(x=>walk(x,out));else if(n?.props){out.push(n);walk(n.props.children,out)}return out};
 const render=(disabled=false)=>walk(Editor({bozza:b,operai:[{id:OP,nome:'Torre Alessandro'}],varianti:cache,onChange:v=>b=v,onClose:()=>{},onRiprovaVarianti:()=>{},salvabile:true,onSalva:()=>saves++,disabled}));
 const before=structuredClone(b.prestazioni.nuove);render().find(n=>n.props['aria-label']==='Aggiungi prestazione per Torre Alessandro').props.onClick();a.equal(b.prestazioni.nuove.length,3);a.deepEqual(b.prestazioni.nuove.slice(0,2),before);a.equal(b.prestazioni.nuove[2].operaio_id,OP);
 render(true).find(n=>n.props['aria-label']==='Aggiungi prestazione per Torre Alessandro').props.onClick();a.equal(b.prestazioni.nuove.length,3);
 b=draft([row(OP,'07:00','12:00'),row(OP,'11:00','15:00',true)]);const save=render().find(n=>n.props.children==='Salva rapportino');a(save.props.disabled);save.props.onClick();a.equal(saves,0);a(render().some(n=>n.props['aria-label']==='Errori prestazione 1'));
});
async function banco(withGuard=true){const db=new PGlite();await db.exec(fixture);await db.exec(read('20261003_rapportino_prestazioni_step2.sql'));await db.exec(read('20261003_rapportino_servizio_step3.sql'));if(withGuard)await db.exec(read('20261025_rapportino_prestazioni_intervalli.sql'));await db.query('select public.crea_sessione_rapportino($1,$2)',['1234',TOKEN]);return db;}
async function salva(db,b){const p=S.creaTentativoSalvataggioV1(b,cache,uuid).payload;return raw(db,p);}
async function raw(db,p){await db.exec('BEGIN');try{const r=(await db.query('select public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',[JSON.stringify(p),TOKEN])).rows[0].v;await db.exec('COMMIT');return r}catch(e){await db.exec('ROLLBACK');throw e}}
test('baseline RPC: già consentite due fasce dello stesso operaio; overlap non ancora protetto',async()=>{
 const db=await banco(false);try{
 const r=await salva(db,draft());a.equal(r.prestazioni.length,2);a.equal(r.prestazioni[0].operaio_id,r.prestazioni[1].operaio_id);
 const bypass=JSON.parse(S.creaTentativoSalvataggioV1(draft(),cache,uuid).corpo);bypass.rapportino_id=r.rapportino_id;bypass.revisione_attesa=r.revisione;bypass.prestazioni={nuove:[row(OP,'10:00','12:00')],aggiornate:[],rimosse:[]};const old=await raw(db,bypass);a.equal(old.prestazioni.filter(p=>!p.rimossa_at).length,3);
 }finally{await db.close()}
});
async function stato(db){const out={};for(const tab of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','artecna_rapportini.richieste'])out[tab]=(await db.query(`select to_jsonb(p) v from ${tab} p order by to_jsonb(p)::text`)).rows;return JSON.stringify(out)}
test('RPC: due operai misti, unico rapportino, reload completo, timbrature e costo senza duplicazioni',async()=>{
 const db=await banco();try{
 const b=draft([row(OP,'07:00','11:00'),row(OP,'11:00','15:00',true),row(OP2,'07:00','11:00'),row(OP2,'11:00','15:00',true)]);const r=await salva(db,b);a.equal(r.prestazioni.length,4);const reloaded=(await db.query('select p.id,p.operaio_id,to_char(p.ora_inizio,\'HH24:MI\') ora_inizio,to_char(p.ora_fine,\'HH24:MI\') ora_fine,p.pausa_minuti,p.lavoro_in_economia,p.variante_id,p.ore::float ore from public.rapportino_prestazioni p where rapportino_id=$1 order by created_at,id',[r.rapportino_id])).rows;
 a.equal(reloaded.length,4);for(const p of r.prestazioni){const q=reloaded.find(q=>q.id===p.prestazione_id);for(const k of ['operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id','ore'])a.equal(q[k],p[k]);}
 let loaded=M.ricostruisciBozzaRapportinoV1(r);a.equal(M.gruppiPrestazioniBozza(loaded).length,2);for(const g of M.gruppiPrestazioniBozza(loaded))a.equal(M.riepilogoOreOperaio(g.prestazioni),'Totale 8:00 h — Ordinario 4:00 h — Economia 4:00 h');
 const header=(await db.query('select * from public.rapportini where id=$1',[r.rapportino_id])).rows[0],t=(await db.query('select * from public.timbrature where rapportino_id=$1',[r.rapportino_id])).rows;a.equal(header.numero_presenti,'2');a.equal(Number(header.ore),16);a.equal(Number(header.ore_per_operaio),8);a.equal(header.costo_manodopera,400);a.equal(t.length,4);a.equal(new Set(t.map(x=>x.prestazione_rapportino_id)).size,4);
 const costs=C.contabilizzaManodopera({rapportini:[header],timbrature:t,calcolaCostoOperativoTimbratura:()=>{throw Error('Proiezione non deve essere contata')}});a.equal(costs.costoTotaleManodoperaContabile,400);
 const original=r.prestazioni.find(p=>p.operaio_id===OP&&!p.lavoro_in_economia),other=r.prestazioni.find(p=>p.operaio_id===OP&&p.lavoro_in_economia);loaded=M.modificaPrestazioneBozza(loaded,original.chiave_client,{pausa_minuti:30});const r2=await salva(db,loaded);a.deepEqual(r2.prestazioni.find(p=>p.prestazione_id===other.prestazione_id),other);a.equal(r2.prestazioni.find(p=>p.prestazione_id===original.prestazione_id).ore,3.5);a.equal(r2.rapportino_id,r.rapportino_id);a.equal((await db.query('select count(*)::int n from public.rapportini where cantiere_id=$1 and data=$2',[A,b.data])).rows[0].n,1);
 }finally{await db.close()}
});
test('guardia SQL: bypass del client respinto con rollback; split finale consecutivo e rimozione validi',async()=>{
 const db=await banco();try{
 const r=await salva(db,draft([row(OP,'07:00','15:00')])),old=r.prestazioni[0],snapshot=await stato(db);
 const invalid=JSON.parse(S.creaTentativoSalvataggioV1(draft(),cache,uuid).corpo);invalid.rapportino_id=r.rapportino_id;invalid.revisione_attesa=r.revisione;invalid.prestazioni={nuove:[row(OP,'11:00','15:00',true)],aggiornate:[],rimosse:[]};await a.rejects(()=>raw(db,invalid),e=>e.code==='23514');a.equal(await stato(db),snapshot);
 let b=M.ricostruisciBozzaRapportinoV1(r);b=M.modificaPrestazioneBozza(b,old.chiave_client,{ora_fine:'11:00'});b=M.aggiungiPrestazioneOperaioBozza(b,OP,uuid());const key=b.prestazioni.nuove[0].chiave_client;b=M.modificaPrestazioneBozza(b,key,{ora_fine:'15:00',lavoro_in_economia:true});b=M.modificaPrestazioneBozza(b,key,{variante_id:V});const split=await salva(db,b);a.equal(split.prestazioni.filter(p=>!p.rimossa_at).length,2);
 const remove=M.rimuoviPrestazioneBozza(M.ricostruisciBozzaRapportinoV1(split),key),removed=await salva(db,remove);a.equal(removed.prestazioni.filter(p=>!p.rimossa_at).length,1);a.equal((await db.query('select count(*)::int n from public.timbrature where rapportino_id=$1',[r.rapportino_id])).rows[0].n,1);
 }finally{await db.close()}
});
