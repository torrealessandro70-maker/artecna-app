exports.supabase={
 auth:{getSession:async()=>({data:{session:{user:{id: new URLSearchParams(location.search).get('owner'),email:'fixture@example.invalid'},access_token:'fixture'}}}),getUser:async()=>({data:{user:{id:new URLSearchParams(location.search).get('owner')}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 rpc:(name,args)=>{if(name==='leggi_rapportino_desktop')window.fixtureEditorRead=args;const request=fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})}).then(r=>r.json());return Object.assign(request,{abortSignal:()=>request,order:()=>request,range:()=>request})},
 from(name){
   const query=new Proxy({}, {get(_,key){
     if(key==='then')return (resolve,reject)=>fetch('/read?table='+encodeURIComponent(name)).then(r=>r.json()).then(resolve,reject)
     if(['insert','update','delete','upsert'].includes(key))return ()=>{throw Error('Scrittura non prevista: '+name)}
     return ()=>query
   }})
   return query
 }
}
