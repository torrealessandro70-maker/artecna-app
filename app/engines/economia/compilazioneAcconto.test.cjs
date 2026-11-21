/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain tests. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsEngine={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/engines/economia/compilazioneAcconto.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsEngine});
const e=exportsEngine;
test('scorporo esatto 10%, 22% e centesimi senza aritmetica binaria intermedia',()=>{
 assert.deepEqual({...e.scorporoAcconto('5000,00','10')},{lordo:5000,aliquota:10,imponibile:4545.45,iva:454.55});
 assert.deepEqual({...e.scorporoAcconto('122','22')},{lordo:122,aliquota:22,imponibile:100,iva:22});
 assert.equal(e.scorporoAcconto('0.01','22').iva,0);
});
test('aliquota non esplicita, importi parziali e valori non finiti non diventano conferme',()=>{
 for(const value of ['', '1.001','NaN','Infinity','-1','12 euro'])assert.throws(()=>e.centesimi(value));
 assert.throws(()=>e.scorporoAcconto('5000',''));assert.throws(()=>e.scorporoAcconto('','10'));
});
const record={id:'synthetic',descrizione:'Prima',importo:100,data_incasso:'2026-01-01',metodo:'bonifico',nota:'Nota'};
test('modifica singola invia solo il campo cambiato e conserva UUID originale',()=>{
 for(const [key,value] of Object.entries({descrizione:'Dopo',nota:'Nuova nota',metodo:'contanti',data_incasso:'2026-01-02',importo:'101.00'})){
  const patch=e.modificheAcconto({...e.campiAcconto(record),[key]:value},record);
  assert.deepEqual(Object.keys(patch),[key]);assert.equal(record.id,'synthetic');
 }
 assert.deepEqual(Object.keys(e.modificheAcconto(e.campiAcconto(record),record)),[]);
});
test('storici senza proposta: nessuna IVA presunta; proposte obsolete ignorate',()=>{
 assert.equal(e.propostaAcconto(record),null);
 assert.deepEqual(Object.keys(e.modificheAcconto({...e.campiAcconto({...record,importo:null}),nota:'Solo testo'},{...record,importo:null})),['nota']);
 const a={...record,compilazione_unica:{richiesta:'request',proposta:{lordo:122,aliquota:22},fonte:[100,'2026-01-01','bonifico']}};
 assert.equal(e.propostaAcconto(a).lordo,122);assert.equal(e.propostaAcconto({...a,importo:101}),null);
 assert.equal(e.metodoAcconto('Bonifico'),'bonifico');assert.equal(e.metodoAcconto('ignoto'),'');
});
