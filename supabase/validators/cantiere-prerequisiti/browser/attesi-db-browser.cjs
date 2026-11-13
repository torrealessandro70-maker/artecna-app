const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const webpack = require('next/dist/compiled/webpack/webpack')
const root = path.resolve(__dirname, '../../../..')
const runtime = path.join(root, '.run', 'notifiche')
fs.mkdirSync(runtime, { recursive: true })
const output = path.join(runtime, 'attesi-db-browser-build')
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
module.exports=async function main(actor,cantiere) {
  webpack.init()
  await new Promise((resolve, reject) => webpack.webpack({
    mode: 'development', context: root, devtool: false, entry: path.join(__dirname, 'attesi-db-entry.cjs'),
    output: { path: output, filename: 'bundle.js' }, resolve: { alias: { '@': root }, extensions: ['.tsx','.ts','.js'] },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(__dirname, 'attesi-page-ts-loader.cjs') }, { test: /\.css$/, use: path.join(__dirname, 'smoke-css-loader.cjs') }] },
  }, (err, stats) => err || stats.hasErrors() ? reject(err || Error(stats.toString({ errors: true }))) : resolve()))
  let result
  const server=http.createServer((req,res)=>{
    console.log('HTTP',req.url)
    const u=new URL(req.url,'http://localhost')
    if(u.pathname==='/rpc'){
      const commands={
        leggi_rapportini_attesi:['SELECT public.leggi_rapportini_attesi($1,$2,$3) v','p_cantiere','p_da','p_a'],
        configura_rapportini_attesi:['SELECT public.configura_rapportini_attesi($1,$2,$3,$4,$5::smallint) v','p_cantiere','p_revisione','p_sospeso','p_fino_al','p_rilevanza'],
        pianifica_rapportini_attesi:['SELECT public.pianifica_rapportini_attesi($1,$2,$3) v','p_cantiere','p_revisione_config','p_giornate'],
        contatori_notifiche:['SELECT public.contatori_notifiche() v']
      }
      let raw=''
      req.on('data',chunk=>raw+=chunk)
      req.on('end',async()=>{
        res.setHeader('Content-Type','application/json')
        try{
          const {name,args}=JSON.parse(raw)
          if(!Object.hasOwn(commands,name))throw Error('RPC fuori fixture')
          const [sql,...keys]=commands[name]
          const data=await actor(sql,keys.map(k=>Array.isArray(args[k])?JSON.stringify(args[k]):args[k]),name!=='leggi_rapportini_attesi'&&name!=='contatori_notifiche')
          console.log('RPC PostgreSQL',name)
          res.end(JSON.stringify({data,error:null}))
        }catch(e){console.error(e);res.end(JSON.stringify({data:null,error:{code:e.code}}))}
      })
      return
    }
    if(u.pathname==='/phase'){
      const phase=u.searchParams.get('name')
      res.end()
      if(['pass','fail','js-error'].includes(phase)) result?.({phase,detail:u.searchParams.get('detail')})
      return
    }
    if(u.pathname==='/bundle.js'){
      res.setHeader('Content-Type','text/javascript')
      return res.end(fs.readFileSync(path.join(output,'bundle.js')))
    }
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'")
    res.end('<!doctype html><meta charset="utf-8"><div id="fixture"></div><main id="area-lavoro-principale"></main><pre id="result"></pre><script src="/bundle.js"></script>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin='http://127.0.0.1:'+server.address().port
  console.log('SERVER',origin,'HTTP_CHECK',(await fetch(origin)).status)
  try {
    for(const mode of ['write','fresh']){
      const query='?cantiere='+cantiere+'&mode='+mode
      const profile=fs.mkdtempSync(path.join(runtime,'chrome-attesi-'))
      const args=['--headless','--disable-background-networking','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--no-first-run','--user-data-dir='+profile,origin+'/'+query]
      console.log('COMMAND',chrome,JSON.stringify(args))
      const child=spawn(chrome,args,{windowsHide:true})
      child.on('spawn',()=>console.log('SPAWN',child.pid))
      child.stdout.on('data',x=>console.log('STDOUT',x.toString()))
      child.stderr.on('data',x=>console.log('STDERR',x.toString()))
      const outcome=await new Promise(resolve=>{
        const timer=setTimeout(()=>resolve({phase:'deadline'}),15000)
        result=value=>{clearTimeout(timer);resolve(value)}
        child.once('error',error=>result({phase:'spawn-error',detail:error.message}))
        child.once('exit',(code,signal)=>console.log('EXIT',code,signal))
      })
      result=null
      child.kill()
      console.log('RESULT',outcome)
      assert.equal(outcome.phase,'pass',outcome.detail)
    }
  } finally { server.closeAllConnections();server.close() }
}
