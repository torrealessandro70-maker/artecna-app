const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm'),crypto=require('crypto')
const {id,digest,photo,packet,result}=require('./fixture.cjs')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const contract=require('./contratto.ts'),root=path.resolve(__dirname,'../../..')
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'Fragment'}
const nodes=x=>x==null?[]:Array.isArray(x)?x.flatMap(nodes):typeof x==='object'?[x,...nodes(x.props?.children)]:[]
const text=x=>x==null?'':Array.isArray(x)?x.map(text).join(''):typeof x==='object'?text(x.props?.children):String(x)
const button=(tree,label)=>{const n=nodes(tree).find(n=>n.type==='button'&&text(n)===label);a(n,'button '+label);return n}
function component(file,hooks,extra={}){
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'app/components',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,exports={}
 vm.runInNewContext(code,{exports,require:n=>n==='react/jsx-runtime'?jsx:n==='react'?hooks:n.includes('/contratto')?contract:{__esModule:true,default:n},crypto:crypto.webcrypto,...extra})
 return exports.default
}
test('pannello reale con hooks/HTTP simulati: mount/link senza AI, richiesta esplicita, provenienza e nuova analisi',async()=>{
 let slots=[],cursor=0,effects=[],p=packet([]),analysis=null,calls=[],ai=0
 const candidates=[{...photo(),collegata:false}],fresh=()=>({fonti:p,analisi:analysis&&{...analysis,allineata:analysis.fonti.manifesto.firma===p.manifesto.firma}})
 const changePhotos=photos=>{p=packet(photos);p.manifesto.firma=digest('photos:'+photos.length)}
 const hooks={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef:initial=>{const i=cursor++;return slots[i]??(slots[i]={current:initial})},useCallback:f=>f,useEffect:f=>effects.push(f)}
 const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='leggi_osservatore_variante')return{data:fresh(),error:null};if(name==='leggi_foto_fonti_variante')return{data:candidates,error:null};if(name==='modifica_foto_fonti_variante'){if(args.p_azione==='collega')changePhotos([photo()]);else changePhotos([]);return{data:null,error:null}}throw Error(name)},auth:{getSession:async()=>({data:{session:{access_token:'fixture-not-real'}},error:null})}}
 const Panel=component('VarianteFontiVisivePanel.tsx',hooks,{fetch:async(url,opts)=>{a.equal(url,'/api/varianti/osservatore');a.equal(opts.method,'POST');const b=JSON.parse(opts.body);a.deepEqual(Object.keys(b).sort(),['richiesta_id','variante_id']);a.equal(b.variante_id,id(5));ai++;analysis={id:b.richiesta_id,data:'2026-10-25T12:00:00Z',modello:'gpt-4.1-mini',fonti:{manifesto:p.manifesto,foto_bytes:p.foto.map(f=>({source_id:f.source_id,source_type:f.source_type,sha256:digest('bytes')}))},risultato:result,allineata:true};return Response.json(fresh())}})
 const render=()=>{cursor=0;return Panel({supabase:client,varianteId:id(5),narrativaToken:'fixture'})},tick=()=>new Promise(setImmediate)
 let tree=render();const cleanup=effects[0]();await tick();tree=render();a.equal(ai,0);a.deepEqual(calls.map(x=>x.name),['leggi_osservatore_variante'])
 await button(tree,'+ Collega foto').props.onClick();await tick();tree=render();const gallery=nodes(tree).find(n=>n.type==='./FotoCantiereGallery');a(gallery);a.equal(gallery.props.selezioneFonti,true);gallery.props.setFotoCantiereSelezionate([id(7)]);tree=render();await button(tree,'Collega selezionate (1)').props.onClick();await tick();tree=render();a.equal(ai,0);a(text(tree).includes('1 foto collegate'));a.equal(p.foto.length,1)
 await button(tree,'Analizza fonti con AI Osservatore').props.onClick();await tick();tree=render();a.equal(ai,1);a(text(tree).includes('Osservazione fixture'));a(text(tree).includes('Analisi allineata alle fonti verificate'));const first=analysis.id
 p=structuredClone(p);p.manifesto.firma=digest('quaderno aggiornato');p.quaderni[0].testo='Nuovo testo';await button(tree,'Aggiorna fonti visive e analisi').props.onClick();await tick();tree=render();a(text(tree).includes('Analisi non più allineata alle fonti'));a.equal(ai,1)
 await button(tree,'Rianalizza').props.onClick();await tick();tree=render();a.equal(ai,2);a.notEqual(analysis.id,first);a(text(tree).includes('Analisi allineata alle fonti verificate'))
 await button(tree,'Scollega foto 1').props.onClick();await tick();tree=render();a.equal(ai,2);a.equal(p.foto.length,0);a.equal(candidates.length,1);a(text(tree).includes('Analisi non più allineata alle fonti'));a(calls.every(c=>['leggi_osservatore_variante','leggi_foto_fonti_variante','modifica_foto_fonti_variante'].includes(c.name)));cleanup()
})
test('gallerie esistenti: modalita selezione riusa checkbox/apertura e nasconde ogni comando di scrittura',()=>{
 const hooks={useState:()=>[[],()=>{}]},fc=component('FotoCantiereGallery.tsx',hooks),sp=component('SopralluogoFotoGallery.tsx',hooks)
 const f=photo().foto
 const props={fotoCantiere:[f],cantiereScheda:'Test',filtroFotoCantiere:'tutte',fotoCantiereSelezionate:[f.id],setFotoCantiereSelezionate:()=>{},setFotoCantiere:()=>{},setFotoFullscreen:()=>{},supabase:{},fotoStorageBucket:'preventivi',caricaFotoCantiere:()=>{},eliminaFotoCantiere:()=>{},buttonSecondary:{}}
 const legacy=fc(props),readonly=fc({...props,selezioneFonti:true});a(text(legacy).includes('Elimina'));a(!text(readonly).includes('Elimina'));a.equal(nodes(readonly).filter(n=>n.type==='select').length,0);a.equal(nodes(readonly).filter(n=>n.type==='input'&&n.props.type==='checkbox').length,1)
 const sprops={sopralluogoAperto:{id:id(10)},fotoSopralluoghi:[{...f,sopralluogo_id:id(10)}],fotoSelezionate:[f.id],setFotoSelezionate:()=>{},setFotoFullscreen:()=>{},setFotoSopralluoghi:()=>{},modalitaGestione:true,caricaFotoSopralluoghi:()=>{},supabase:{}}
 const old=sp(sprops),read=sp({...sprops,selezioneFonti:true});a(text(old).includes('Elimina selezionate'));a(text(old).includes('Collega al Quaderno'));a(!text(read).includes('Elimina selezionate'));a(!text(read).includes('Collega al Quaderno'));a(!text(read).includes('Usa nel preventivo'));a.equal(nodes(read).filter(n=>n.type==='input'&&n.props.type==='checkbox').length,1)
})
