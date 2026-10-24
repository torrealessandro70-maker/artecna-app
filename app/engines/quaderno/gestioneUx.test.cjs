const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),p=require('path'),ts=require('typescript'),vm=require('vm');
function handler(file,name,ctx){
 const text=fs.readFileSync(p.join(__dirname,'../../components',file),'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;
 function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n;ts.forEachChild(n,walk)}walk(ast);a(found);
 return vm.runInNewContext(ts.transpileModule('('+found.getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);
}
function archive(options={}){
 const calls=[],ref={current:false};let release;
 const wait=new Promise(r=>release=r),ctx={gestioneBusyRef:ref,caricamento:false,pendentiRef:{current:false},puoCambiare:()=>true,
 window:{prompt:()=>options.cancel?null:'Nuovo titolo',confirm:()=>!options.cancel},supabase:{},
 setGestioneBusy:v=>calls.push(['busy',v]),setErrore:v=>calls.push(['errore',v]),setAperto:v=>calls.push(['aperto',v]),aggiornaStato:()=>{},
 rpcQuaderno:async(...args)=>{calls.push(['rpc',args]);if(options.fail)throw Error('Versione cambiata');if(options.wait)await wait},
 duplicaProgetto:async()=>calls.push(['duplica']),eliminaProgetto:async()=>calls.push(['elimina']),erroreQuaderno:e=>e.message,
 setRevisioneGestione:()=>{},carica:async()=>calls.push(['reload'])};
 return{ctx,calls,release};
}
test('UX reale archivio: annulla rinomina/elimina non invoca writer e conserva lo stato',async()=>{
 for(const action of ['rinomina','elimina']){const h=archive({cancel:true});await handler('QuadernoProgettiPanel.tsx','gestisci',h.ctx)({id:'p',titolo:'Prima',updated_at:'v'},action);a.deepEqual(h.calls,[])}
});
test('UX reale archivio: doppio click genera una sola RPC; errore non dichiara successo',async()=>{
 const h=archive({wait:true}),run=handler('QuadernoProgettiPanel.tsx','gestisci',h.ctx),project={id:'p',titolo:'Prima',updated_at:'v'};
 const pending=run(project,'rinomina');await run(project,'rinomina');a.equal(h.calls.filter(c=>c[0]==='rpc').length,1);h.release();await pending;a.equal(h.ctx.gestioneBusyRef.current,false);
 const fail=archive({fail:true});await handler('QuadernoProgettiPanel.tsx','gestisci',fail.ctx)(project,'rinomina');a(fail.calls.some(c=>c[0]==='errore'&&c[1].includes('Versione cambiata')));
 const dirty=archive();dirty.ctx.pendentiRef.current=true;await handler('QuadernoProgettiPanel.tsx','gestisci',dirty.ctx)(project,'elimina');a(!dirty.calls.some(c=>c[0]==='elimina'));a(!dirty.calls.some(c=>c[0]==='aperto'));
});
test('UX reale rimozione: annulla conferma o bozza dirty non rimuovono file né salvano',async()=>{
 for(const disabled of [false,true]){
  const calls=[],ctx={elenco:[{id:'r',sorgente_titolo:'Sorgente',richiamato_at:'2026-10-24T10:00:00Z'}],scelta:'r',disabled,busyRef:{current:false},window:{confirm:()=>false},onBusy:()=>calls.push('busy'),setErrore:()=>calls.push('error'),rimuoviRichiamo:()=>calls.push('remove'),setRevision:()=>{},onConclusa:()=>{}};
  await handler('RimozioneRichiamoPanel.tsx','rimuovi',ctx)();a.deepEqual(calls,[]);
 }
});
