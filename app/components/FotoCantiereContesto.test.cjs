// Real Gallery rendering with controlled JSX runtime, no browser/network or Storage API.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {fotoNelCantiere}=require('../engines/photo-storage/galleria.fixture.cjs')
const jsx=(type,props)=>({type,props}),m={exports:{}}
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'FotoCantiereGallery.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>id==='react/jsx-runtime'?{jsx,jsxs:jsx}:{default:()=>null},m,m.exports)
const A={id:'00000003-1111-4111-8111-111111111111',nome:'SMOKE omonimo'},B={id:'00000004-1111-4111-8111-111111111111',nome:'SMOKE omonimo'}
function nodes(x){return Array.isArray(x)?x.flatMap(nodes):x&&typeof x==='object'?[x,...nodes(x.props?.children)]:[]}
function render(photos,context,cantieri){let writes=0;const tree=m.exports.default({contestuale:true,selezioneFonti:true,
 fotoCantiere:photos.filter(f=>fotoNelCantiere(f,context,cantieri)),cantiereId:context.id,cantiereScheda:context.nome,filtroFotoCantiere:'tutte',fotoCantiereSelezionate:[],buttonSecondary:{},
 supabase:{from(){writes++;throw Error('Unexpected write')},storage:{from(){writes++;throw Error('Unexpected Storage call')}}}})
 return{nodes:nodes(tree),writes}
}
const photo=(id,cantiere_id,cantiere)=>({id,cantiere_id,cantiere,nota:id,immagine_base64:'https://storage.invalid/'+id,allegato_v1_id:null})
test('Galleria effettiva: ID corretto anche dopo rinomina; foto omonima di altro ID esclusa',()=>{
 const r=render([photo('a',A.id,'Nome precedente'),photo('b',B.id,B.nome)],A,[A,B]);a.deepEqual(r.nodes.filter(n=>n.type==='img').map(n=>n.props.src),['https://storage.invalid/a']);a.equal(r.writes,0)
})
test('Galleria effettiva: legacy univoca preservata, omonima non attribuita',()=>{
 const f=photo('legacy',null,A.nome);a.equal(render([f],A,[A]).nodes.filter(n=>n.type==='img').length,1);a.equal(render([f],A,[A,B]).nodes.filter(n=>n.type==='img').length,0)
})
test('selezione fonti: render read-only, nessun comando di cancellazione/aggiornamento',()=>{
 const r=render([photo('a',A.id,A.nome)],A,[A,B]);a.equal(r.writes,0);a.equal(r.nodes.filter(n=>n.type==='input'&&n.props.type==='checkbox').length,1)
 a(!r.nodes.some(n=>n.type==='button'&&String(n.props.children).match(/Elimina|Applica categoria/)))
})
