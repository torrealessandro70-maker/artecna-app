// Esegue callback legacy reali estratte con AST; trasporto finto, nessuna rete.
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm')
const root=path.resolve(__dirname,'../..')
function callback(file,name,scope){
 const source=fs.readFileSync(path.join(root,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 let declaration
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)declaration=n;ts.forEachChild(n,visit)}visit(ast)
 assert(declaration,'callback reale '+name)
 const js=ts.transpileModule('const '+declaration.getText(ast)+'; globalThis.result='+name,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
 const context={...scope};vm.runInNewContext(js,context);return context.result
}
test('PDF fotografico V0: funzione reale, immagine e documento jsPDF reale',()=>{
 const {jsPDF}=require('jspdf');let bytes,images=0
 const png=require('fast-png').encode({width:1,height:1,channels:4,depth:8,data:new Uint8Array([255,0,0,255])})
 const photo={id:'foto',rapportino_id:'rapportino',immagine_base64:'data:image/png;base64,'+Buffer.from(png).toString('base64'),nota:'Nota legacy'}
 const linked=callback('page.tsx','fotoCollegataAlRapportino',{})
 function Pdf(...args){const d=new jsPDF(...args),add=d.addImage;d.addImage=(...a)=>{const v=add.apply(d,a);images++;return v};d.save=()=>{bytes=Buffer.from(d.output('arraybuffer'))};return d}
 callback('page.tsx','generaPdfRapportinoFotografico',{jsPDF:Pdf,fotoCantiere:[photo],fotoCollegataAlRapportino:linked})({id:'rapportino',cantiere:'Cantiere',data:'2026-10-07',note:'Lavori',ore:8})
 assert.equal(images,1);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.length>1000)
})
test('galleria V0: callback reale rimuove Storage legacy e record, poi rilegge',async()=>{
 const events=[],photo={id:'v0',file_path:'legacy.jpg',allegato_v1_id:null}
 const supabase={storage:{from:b=>({remove:async ids=>{events.push(['storage',b,...ids]);return {error:null}}})},from:t=>({delete:()=>({eq:async(k,v)=>{events.push(['delete',t,k,v]);return {error:null}}})})}
 await callback('components/FotoCantiereGallery.tsx','eliminaFotoSelezionate',{fotoCantiere:[photo],fotoCantiereSelezionate:['v0'],supabase,fotoStorageBucket:'preventivi',confirm:()=>true,alert:()=>assert.fail('Errore legacy'),setFotoCantiereSelezionate:()=>{},caricaFotoCantiere:async()=>events.push(['reload'])})()
 assert.deepEqual(events,[['storage','preventivi','legacy.jpg'],['delete','foto_cantiere','id','v0'],['reload']])
})
test('sopralluoghi: callback reali mantengono foto_sopralluogo separata e rilettura',async()=>{
 const events=[],supabase={from:t=>({update:payload=>({eq:async(k,v)=>{events.push(['update',t,k,v,payload.tag]);return {error:null}}}),delete:()=>({in:async(k,v)=>{events.push(['delete',t,k,...v]);return {error:null}}})})}
 const scope={supabase,setFotoSopralluoghi:()=>{},caricaFotoSopralluoghi:async()=>events.push(['reload']),alert:()=>assert.fail('Errore sopralluogo'),confirm:()=>true,fotoSelezionate:['s0'],setFotoSelezionate:()=>{}}
 await callback('components/SopralluogoFotoGallery.tsx','aggiornaFoto',scope)({id:'s0'},{tag:'tecnico:bagno'})
 await callback('components/SopralluogoFotoGallery.tsx','eliminaSelezionate',scope)()
 assert.deepEqual(events,[['update','foto_sopralluogo','id','s0','tecnico:bagno'],['delete','foto_sopralluogo','id','s0'],['reload']])
})
