import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
// Il solo import runtime dell'engine e il validatore UUID.
const src=ts.transpileModule(fs.readFileSync(new URL('./addebitiCliente.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const e={};new Function('require','exports',src)(()=>({uuidFattura:v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v)}),e)
const id='10000000-0000-4000-8000-000000000001'
const d={materiale:id,quantita:'2',importo:'62',ivaInclusa:false,aliquota:'22',descrizione:'Extra',motivo:'Concordato',riferimento:'Accordo'}
test('Input esplicito IVA, precisione e nessuno zero sconosciuto',()=>{assert.equal(e.parametriAddebito(d).p_importo,62);for(const v of ['', 'NaN','1.001','-1'])assert.throws(()=>e.parametriAddebito({...d,importo:v}));assert.throws(()=>e.parametriAddebito({...d,aliquota:'101'}));assert.equal(e.numeroAddebito('0',2,true),0)})
test('Quote gia completamente attribuite utilizzabili senza nuova assegnazione',async()=>{const q={materiale_id:id,fattura_riga_id:id,cantiere_id:id,cantiere:'Fixture',descrizione:'Materiale',quantita:2,disponibile:2,unita_misura:'PZ',costo:50};assert.deepEqual(await e.quoteAddebito({rpc:async()=>({data:[q],error:null})},id),[q]);await assert.rejects(e.quoteAddebito({rpc:async()=>({data:[q,q],error:null})},id));await assert.rejects(e.quoteAddebito({rpc:async()=>({data:[{...q,costo:null}],error:null})},id))})
test('Anteprima1300+62 e risposta RPC non affidabile bloccata',async()=>{const p={versione:1,materiale_id:id,fattura_id:id,fattura_riga_id:id,cantiere_id:id,token:'a'.repeat(64),netto:62,costo_originale_quota:50,contratto_attuale:1300,contratto_dopo_approvazione:1362};assert.equal((await e.anteprimaAddebito({rpc:async()=>({data:p,error:null})},d)).netto,62);await assert.rejects(e.anteprimaAddebito({rpc:async()=>({data:{...p,contratto_dopo_approvazione:1300},error:null})},d));await assert.rejects(e.anteprimaAddebito({rpc:async()=>({data:null,error:{code:'42501'}})},d))})
