/* eslint-disable @typescript-eslint/no-require-imports -- Node runner, stesso transpiler delle suite locali. */
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,p);
const {statoCantiereAttribuzioni:stato,cantiereDocumento:contesto,MESSAGGIO_INCASSI_SENZA_CANTIERE:messaggio,leggiAttribuzioni}=require('./attribuzioni.ts');
const id='00000000-0000-4000-8000-000000000001',c='00000000-0000-4000-8000-000000000002';
test('Solo NULL esplicito attesta Cantiere assente',()=>a.equal(stato(null),'assente'));
test('Undefined o proprietà non caricata restano ignoti',()=>{a.equal(stato(undefined),'ignoto');a.equal(stato({}.cantiere_id),'ignoto')});
test('UUID presente conserva il percorso autorizzato',()=>a.equal(stato(c),'presente'));
test('Valori invalidi non vengono trasformati in NULL',()=>{for(const v of ['',false,0,{},'nome Cantiere'])a.equal(stato(v),'ignoto')});
test('La sorgente univoca conserva il NULL reale',()=>a.equal(contesto([{id,cantiere_id:null}],id),null));
test('Proprietà mancante o undefined non certificano NULL',()=>{a.equal(contesto([{id}],id),undefined);a.equal(contesto([{id,cantiere_id:undefined}],id),undefined)});
test('Sorgente non caricata o identità diversa restano ignote',()=>{a.equal(contesto([],id),undefined);a.equal(contesto([{id:c,cantiere_id:null}],id),undefined)});
test('Identità duplicata non permette di scegliere un NULL arbitrario',()=>a.equal(contesto([{id,cantiere_id:null},{id,cantiere_id:c}],id),undefined));
test('Il nome storico non determina il contesto',()=>a.equal(contesto([{id,cantiere:'Qualunque nome'}],id),undefined));
test('L’UUID sorgente è propagato senza cambiare dati',()=>{const r=Object.freeze({id,cantiere_id:c});a.equal(contesto([r],id),c);a.equal(r.cantiere_id,c)});
test('Un 42501 generico rimane un errore di lettura, non il messaggio NULL',async()=>{
 const client={rpc:async()=>({data:null,error:{code:'42501',message:'Qualsiasi altro guard'}})};
 await a.rejects(leggiAttribuzioni(client,id),e=>e.message.includes('(42501)')&&!e.message.includes(messaggio));
});
