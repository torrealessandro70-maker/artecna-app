exports.supabase={
 auth:{getSession:async()=>({data:{session:{user:{id: new URLSearchParams(location.search).get('owner'),email:'fixture@example.invalid'},access_token:'fixture'}}}),getUser:async()=>({data:{user:{id:new URLSearchParams(location.search).get('owner')}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 rpc:(name,args)=>{if(name==='leggi_rapportino_desktop')window.fixtureEditorRead=args;const request=fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})}).then(r=>r.json());return Object.assign(request,{abortSignal:()=>request,order:()=>request,range:()=>request})},
 from(name){
   const filters=[]
   const query=new Proxy({}, {get(_,key){
     if(key==='eq')return (column,value)=>{filters.push([column,value]);return query}
     if(key==='then')return (resolve,reject)=>fetch('/read?table='+encodeURIComponent(name)).then(r=>r.json()).then(result=>name==='fatture_fornitori' && Array.isArray(result.data)?{...result,data:result.data.filter(row=>filters.every(([column,value])=>String(row[column])===String(value)))}:result).then(resolve,reject)
     if(key==='insert' && new URLSearchParams(location.search).get('mode')==='parziale' && ['fatture_fornitori','fatture_fornitori_righe','materiali_cantiere'].includes(name))return data=>{const request=exports.supabase.rpc('fixture_insert_'+name,{data});const chain={then:request.then.bind(request),select:()=>chain,single:()=>request};return chain}
     if(['insert','update','delete','upsert'].includes(key))return ()=>{throw Error('Scrittura non prevista: '+name)}
     return ()=>query
   }})
   return query
 }
}
