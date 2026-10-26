// Real upload handler from app/page.tsx; Supabase/Storage transport is controlled, never Production.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const root=path.resolve(__dirname,'../../..')
const source=ts.createSourceFile('page.tsx',fs.readFileSync(path.join(root,'app/page.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let handler
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='salvaFotoCantiere')handler=n.initializer.getText(source);ts.forEachChild(n,visit)}visit(source)
if(!handler)throw Error('Upload handler not found')
const contextModule={exports:{}}
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'cantiere-context.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(contextModule.exports)
function uploadHarness(cantiere,options={}){
 const uploads=[],rows=[],removed=[],alerts=[],clears=[]
 const supabase={auth:{getUser:async()=>{options.duringAuth?.();return{data:{user:{id:'00000001-1111-4111-8111-111111111111'}},error:null}}},storage:{from:bucket=>({upload:async(p,b)=>{uploads.push({bucket,path:p,bytes:await b.text()});return{error:null}},getPublicUrl:p=>({data:{publicUrl:'https://storage.invalid/'+p}}),remove:async p=>{removed.push(...p);return{error:null}}})},from:table=>({insert:async values=>{if(table!=='foto_cantiere')throw Error('Unexpected write');if(options.insertError)return{error:{message:'fixture failure'}};rows.push(...values);return{error:null}}})}
 const env={contestoUploadFotoCantiere:contextModule.exports.contestoUploadFotoCantiere,cantiereSelezionatoDaId:cantiere,
 fotoDaCaricare:['synthetic'],creaBlobFotoCantiere:()=>new Blob(['synthetic-image'],{type:'image/png'}),estensioneFotoCantiere:()=> 'png',supabase,alert:x=>alerts.push(x),
 pulisciSegmentoStorage:s=>s.replaceAll(' ','_'),FOTO_CANTIERE_BUCKET:'preventivi',notaFotoCantiere:'SMOKE synthetic',categoriaFotoDaSalvare:'durante',categoriaFoto:'prima',geolocalizzazioneFoto:'',
 setFotoDaCaricare:x=>clears.push(x),setNotaFotoCantiere:()=>{},setGeolocalizzazioneFoto:()=>{},setCategoriaFoto:()=>{},setPopupCategoriaFotoCantiere:()=>{},caricaFotoCantiere:async()=>{}}
 const js=ts.transpileModule('return '+handler,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 return{run:new Function(...Object.keys(env),js)(...Object.values(env)),uploads,rows,removed,alerts,clears}
}
module.exports={uploadHarness,...contextModule.exports}
