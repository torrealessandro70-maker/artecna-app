const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{execFileSync}=require('node:child_process'),{randomUUID}=require('node:crypto'),{Client}=require('pg')
const root=path.resolve(__dirname,'../../..'),bin=path.join(root,'.run/cantiere-prereq-runtime/minimal/pgsql/bin')
exports.withNative=async function(run){
 const version=execFileSync(path.join(bin,'postgres.exe'),['--version'],{encoding:'utf8',windowsHide:true});if(!version.includes('17.6'))throw Error('PostgreSQL 17.6 required')
 const directory=path.join(root,'.run','prereq-native-'+randomUUID()),data=path.join(directory,'data');fs.mkdirSync(directory,{recursive:true})
 const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});const port=server.address().port;await new Promise(r=>server.close(r))
 const clients=[];let started=false
 const execute=(name,args)=>execFileSync(path.join(bin,name+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout:60000,stdio:name==='pg_ctl'?'ignore':'pipe'})
 const connect=async()=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user:'postgres',connectionTimeoutMillis:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c}
 try{
  execute('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8'])
  execute('pg_ctl',['-D',data,'-l',path.join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c fsync=off -c max_connections=20`,'-w','start']);started=true
  const db=await connect();await db.query(fs.readFileSync(path.join(__dirname,'baseline.sql'),'utf8'))
  for(const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>/^20261107\d{6}_/.test(n)).sort())await db.query(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'))
  await run(db,connect,{host:'127.0.0.1',port,database:'postgres',user:'artecna_storage_worker_login',connectionTimeoutMillis:5000,query_timeout:5000})
 }finally{if(started)execute('pg_ctl',['-D',data,'-m','immediate','-w','stop']);await Promise.allSettled(clients.map(c=>c.end()))}
}
