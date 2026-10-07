// Callback e JSX reali, trasporto controllato e nessuna rete.
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm')
const root=path.resolve(__dirname,'../..')
function callback(file,name,scope){
 const src=fs.readFileSync(path.join(root,file),'utf8'),ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let declaration
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)declaration=n;ts.forEachChild(n,visit)}visit(ast);assert(declaration)
 const context={...scope};vm.runInNewContext(ts.transpileModule('const '+declaration.getText(ast)+';globalThis.result='+name,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);return context.result
}
function gallery(props,scope={},file='components/FotoCantiereGallery.tsx'){
 const source=fs.readFileSync(path.join(root,file),'utf8'),module={exports:{}}
 const jsx=(type,props)=>({type,props})
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(js,{module,exports:module.exports,require:()=>({jsx,jsxs:jsx,Fragment:'fragment'}),...scope})
 return module.exports.default({fotoCantiere:[],fotoCantiereSelezionate:[],setFotoCantiere:()=>{},setFotoCantiereSelezionate:()=>{},setFotoFullscreen:()=>{},cantiereScheda:'A',filtroFotoCantiere:'',buttonSecondary:{},...props})
}
function find(tree,predicate){if(!tree)return;if(Array.isArray(tree)){for(const node of tree){const f=find(node,predicate);if(f)return f}}else if(typeof tree==='object'){if(predicate(tree))return tree;return find(tree.props?.children,predicate)}}
const v0={id:'v0',cantiere:'A',categoria:'prima',allegato_v1_id:null,file_path:'legacy.jpg'}
const v1={id:'v1',cantiere:'A',categoria:'rapportino',allegato_v1_id:'allegato'}
for(const [name,photos] of [['V0',[v0]],['V0 multipla',[v0,{...v0,id:'v02'}]],['V1',[v1]],['mista',[v0,v1]],['marker non acquisito',[{id:'unknown'}]]]){
 test('categoria multipla '+name+': rifiuto prima delle mutazioni',async()=>{
  let writes=0,local=0,reloads=0
  const f=callback('page.tsx','aggiornaCategoriaFotoSelezionate',{fotoCantiere:photos,fotoCantiereSelezionate:photos.map(f=>f.id),categoriaFotoMultipla:'dopo',supabase:{from:()=>({update:()=>({in:async()=>{writes++;return {error:null}}})})},setFotoCantiere:()=>local++,setFotoCantiereSelezionate:()=>{},caricaFotoCantiere:async()=>reloads++,alert:()=>{}})
  await f();const allowed=photos.every(p=>p.allegato_v1_id===null);assert.equal(writes,allowed?1:0);assert.equal(local,allowed?1:0);assert.equal(reloads,allowed?1:0)
 })
 test('delete multipla '+name+': nessuna V0 eliminata se il batch contiene V1',async()=>{
  let writes=0,storage=0,confirmation=0
  await callback('components/FotoCantiereGallery.tsx','eliminaFotoSelezionate',{fotoCantiere:photos,fotoCantiereSelezionate:photos.map(f=>f.id),supabase:{from:()=>({delete:()=>({eq:async()=>{writes++;return {error:null}}})}),storage:{from:()=>({remove:async()=>{storage++;return {error:null}}})}},fotoStorageBucket:'preventivi',confirm:()=>{confirmation++;return true},alert:()=>{},setFotoCantiereSelezionate:()=>{},caricaFotoCantiere:async()=>{}})()
  const allowed=photos.every(p=>p.allegato_v1_id===null);assert.equal(writes,allowed?photos.length:0);assert.equal(storage,allowed?photos.filter(p=>p.file_path).length:0);assert.equal(confirmation,allowed?1:0)
 })
}
for(const photo of [v0,v1])test('categoria singola '+photo.id+': controllo UI e handler reale',async()=>{
 let writes=0,local=[photo];const tree=gallery({fotoCantiere:[photo],supabase:{from:()=>({update:()=>({eq:async()=>{writes++;return {error:null}}})})},setFotoCantiere:f=>{local=f(local)},caricaFotoCantiere:()=>{}},{alert:()=>{}})
 const select=find(tree,n=>n.type==='select');assert(select);assert.equal(select.props.disabled,photo===v1);await select.props.onChange({target:{value:'dopo'}});assert.equal(writes,photo===v0?1:0);assert.equal(local[0].categoria,photo===v0?'dopo':'rapportino')
})
test('categoria singola errore: rollback locale anche quando la rilettura non riceve dati',async()=>{
 let local=[v0],reloads=0;const tree=gallery({fotoCantiere:[v0],supabase:{from:()=>({update:()=>({eq:async()=>({error:{message:'guardia'}})})})},setFotoCantiere:f=>{local=f(local)},caricaFotoCantiere:async()=>{reloads++}},{alert:()=>{}})
 await find(tree,n=>n.type==='select').props.onChange({target:{value:'dopo'}});assert.equal(reloads,1);assert.equal(local[0].categoria,'prima')
})
test('categoria multipla errore: nessuna modifica dello stato locale',async()=>{
 let changed=0;await callback('page.tsx','aggiornaCategoriaFotoSelezionate',{fotoCantiere:[v0],fotoCantiereSelezionate:['v0'],categoriaFotoMultipla:'dopo',supabase:{from:()=>({update:()=>({in:async()=>({error:{message:'guardia'}})})})},setFotoCantiere:()=>changed++,setFotoCantiereSelezionate:()=>changed++,caricaFotoCantiere:()=>changed++,alert:()=>{}})();assert.equal(changed,0)
})
for(const photo of [v0,v1])test('delete singola '+photo.id+': rifiuto prima di confirm e DELETE',async()=>{
 let writes=0,confirms=0;await callback('page.tsx','eliminaFotoCantiere',{fotoCantiere:[photo],fotoFullscreen:null,supabase:{from:()=>({delete:()=>({eq:async()=>{writes++;return {error:null}}})})},confirm:()=>{confirms++;return true},alert:()=>{},caricaFotoCantiere:async()=>{},setFotoFullscreen:()=>{}})(photo.id);assert.equal(writes,photo===v0?1:0);assert.equal(confirms,photo===v0?1:0)
})
test('delete dal Rapportino V1: nessuna chiamata Storage o DELETE',async()=>{
 await callback('page.tsx','eliminaFotoRapportino',{alert:()=>{},supabase:new Proxy({},{get:()=>assert.fail('trasporto V1')}),confirm:()=>assert.fail('confirm V1')})(v1)
})
test('UI galleria V1: categoria, delete singola e batch misto disabilitati',()=>{
 const tree=gallery({fotoCantiere:[v0,v1],fotoCantiereSelezionate:['v0','v1']});const batch=find(tree,n=>n.type==='button'&&n.props.title?.includes('selezioni miste'));assert.equal(batch.props.disabled,true)
 const single=find(tree,n=>n.type==='button'&&n.props.children==='Gestita dal protocollo Allegati');assert.equal(single.props.disabled,true)
})
for(const [name,mode] of [['salvaModificaCantiere','legacy'],['modificaNomeCantiereScheda','scheda'],['salvaModificaRegistroCantiere','registro']])test('rinomina '+mode+': solo RPC con UUID, errore non modifica lo stato',async()=>{
 const calls=[];let changed=0;const scope={cantieri:[{id:'uuid',nome:'A'}],cantiereDaModificare:'A',nuovoNomeCantiere:'B',cantiereSelezionatoDaId:{id:'uuid',nome:'A'},cantiereRegistroNome:'B',cantiereRegistroPreventivo:'10',cantiereRegistroInizio:'',cantiereRegistroFine:'',cantiereRegistroConcluso:false,parseImporto:Number,prompt:()=> 'B',supabase:{rpc:async(n,p)=>{calls.push([n,p]);return {error:{message:'gate V1'}}},from:()=>assert.fail('scrittura browser')},alert:()=>{},setCantiereScheda:()=>changed++,caricaCantieri:()=>changed++,annullaModificaRegistroCantiere:()=>changed++}
 await callback('page.tsx',name,scope)('uuid');assert.equal(calls.length,1);assert.equal(calls[0][0],'rinomina_cantiere_legacy_senza_allegati');assert.equal(calls[0][1].p_cantiere_id,'uuid');assert.equal(calls[0][1].p_modalita,mode);assert.equal(changed,0)
})
test('DELETE Rapportino: RPC autorevole unica, errore non scollega foto e non ricarica',async()=>{
 let calls=0;await callback('page.tsx','eliminaRapportino',{confirm:()=>true,alert:()=>{},supabase:{rpc:async(n,p)=>{calls++;assert.equal(n,'elimina_rapportino_legacy_senza_allegati');assert.equal(p.p_rapportino_id,'rap');return {error:{message:'Allegato presente'}}},from:()=>assert.fail('unlink browser')},caricaRapportini:()=>assert.fail('reload'),caricaFotoCantiere:()=>assert.fail('reload')})('rap');assert.equal(calls,1)
})
test('popup Rapportino: V1 esplicita e DELETE disabilitata; V0 resta disponibile',()=>{
 for(const photo of [v0,v1]){
  const tree=gallery({fotoRapportinoAperte:[photo],setFotoRapportinoAperte:()=>{},onEliminaFotoRapportino:()=>{}},{},'components/PopupFotoRapportinoAperte.tsx')
  const button=find(tree,n=>n.type==='button'&&n.props.title?.includes('foto')||n.type==='button'&&n.props.title?.includes('Foto'))
  assert(button);assert.equal(button.props.disabled,photo===v1);if(photo===v1)assert.equal(button.props.children,'Gestita dal protocollo Allegati')
 }
})
