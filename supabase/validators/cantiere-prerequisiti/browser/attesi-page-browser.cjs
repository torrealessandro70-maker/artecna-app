const { spawn, execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const webpack = require('next/dist/compiled/webpack/webpack')
const root = path.resolve(__dirname, '../../../..')
const runtime = path.join(root, '.run', 'notifiche')
fs.mkdirSync(runtime, { recursive: true })
const output = path.join(runtime, 'attesi-page-browser-build')
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const bundles = new Map()
module.exports=async function main(actor,cantiere,context) {
  const started = performance.now()
  const trace = (phase, detail = '') => console.log(new Date().toISOString(), Math.round(performance.now()-started)+'ms', phase, detail)
  trace('fixture browser: avvio bundle')
  webpack.init()
  const entry = context.entry ?? 'attesi-page-entry.cjs'
  if (!bundles.has(entry)) bundles.set(entry, new Promise((resolve, reject) => webpack.webpack({
    mode: 'development', context: root, devtool: false, entry: path.join(__dirname, entry),
    output: { path: output, filename: entry + '.js' }, resolve: { alias: { '@': root, [path.join(root,'lib','supabaseClient')]:path.join(__dirname,'attesi-page-client.cjs') }, extensions: ['.tsx','.ts','.js'] },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(__dirname, 'attesi-page-ts-loader.cjs') }, { test: /\.css$/, use: path.join(__dirname, 'smoke-css-loader.cjs') }] },
  }, (err, stats) => err || stats.hasErrors() ? reject(err || Error(stats.toString({ errors: true }))) : resolve())))
  await bundles.get(entry)
  trace('bundle pronto', entry)
  let result
  let last = 'server in avvio'
  let firstRpc = true
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost')
    if(u.pathname==='/'){ last = 'pagina locale richiesta'; trace(last) }
    if(u.pathname==='/read'){
      res.setHeader('Content-Type','application/json')
      const table=u.searchParams.get('table')
      if(context.read?.[table]){
        actor(context.read[table],[]).then(data=>res.end(JSON.stringify({data,error:null})),error=>res.end(JSON.stringify({data:null,error:{message:error.message}})))
        return
      }
      return res.end(JSON.stringify({data:context[table]??[],error:null}))
    }
    if(u.pathname==='/rpc'){
      const commands={
        ...context.commands,
        leggi_rapportini_attesi:['SELECT public.leggi_rapportini_attesi($1,$2,$3) v','p_cantiere','p_da','p_a'],
        configura_rapportini_attesi:['SELECT public.configura_rapportini_attesi($1,$2,$3,$4,$5::smallint) v','p_cantiere','p_revisione','p_sospeso','p_fino_al','p_rilevanza'],
        pianifica_rapportini_attesi:['SELECT public.pianifica_rapportini_attesi($1,$2,$3) v','p_cantiere','p_revisione_config','p_giornate'],
        contatori_notifiche:['SELECT public.contatori_notifiche() v'],
        lista_notifiche:['SELECT public.lista_notifiche($1,$2) v','p_filtro','p_offset'],
        risolvi_destinazione_notifica:['SELECT public.risolvi_destinazione_notifica($1) v','p_id'],
        leggi_rapportino_desktop:['SELECT public.leggi_rapportino_desktop($1,$2,$3,$4::smallint) v','p_cantiere_id','p_data','p_rapportino_id','p_versione_lettura']
      }
      let raw=''
      req.on('data',chunk=>raw+=chunk)
      req.on('end',async()=>{
        res.setHeader('Content-Type','application/json')
        try{
          const {name,args}=JSON.parse(raw)
          if(!Object.hasOwn(commands,name)){res.end(JSON.stringify({data:[],error:null}));return}
          const [sql,...keys]=commands[name]
          last = 'RPC '+name
          if(firstRpc){firstRpc=false;trace('prima RPC dopo autenticazione sintetica',name)}
          const data=await actor(sql,keys.map(k=>Array.isArray(args[k])?JSON.stringify(args[k]):args[k]),name==='configura_rapportini_attesi'||name==='pianifica_rapportini_attesi'||name==='registra_debito_fornitore'||name==='verifica_debito_fornitore')
          last = 'RPC completata '+name
          res.end(JSON.stringify({data,error:null}))
        }catch(e){trace('risposta RPC con errore', e.code ?? e.message);res.end(JSON.stringify({data:null,error:{code:e.code,message:e.message}}))}
      })
      return
    }
    if(u.pathname==='/phase'){
      const phase=u.searchParams.get('name')
      trace('fase browser '+phase,u.searchParams.get('detail'))
      res.end()
      if(['pass','fail','js-error'].includes(phase)) result?.({phase,detail:u.searchParams.get('detail')})
      return
    }
    if(u.pathname==='/bundle.js'){
      res.setHeader('Content-Type','text/javascript')
      return res.end(fs.readFileSync(path.join(output,entry+'.js')))
    }
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'")
    res.end('<!doctype html><meta charset="utf-8"><div id="fixture"></div><pre id="result"></pre><script src="/bundle.js"></script>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin='http://127.0.0.1:'+server.address().port
  console.log('SERVER',origin,'HTTP_CHECK',(await fetch(origin)).status)
  try {
    let retryStartup = false
    for(let index=0;index<context.modes.length;index++){
      const mode=context.modes[index]
      const query='?cantiere='+cantiere+'&mode='+mode+'&owner='+context.owner+'&draft='+context.draft+'&day='+context.day+(mode==='draft'||mode==='multiple'?'&notifica='+context.notification:'')
      const profile=fs.mkdtempSync(path.join(runtime,'chrome-attesi-'))
      const args=['--headless','--disable-gpu','--disable-background-networking','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--no-first-run','--user-data-dir='+profile,origin+'/'+query]
      last = 'spawn '+mode
      firstRpc = true
      trace('avvio Chrome',mode)
      const child=spawn(chrome,args,{windowsHide:true})
      child.on('spawn',()=>trace('Chrome avviato',child.pid))
      const closed = new Promise(resolve=>child.once('exit',(code,signal)=>{trace('processo Chrome terminato',JSON.stringify({code,signal}));resolve()}))
      child.stdout.on('data',x=>trace('Chrome stdout',x.toString().slice(0,500)))
      child.stderr.on('data',x=>trace('Chrome stderr',x.toString().slice(0,500)))
      const outcome=await new Promise(resolve=>{
        const timer=setTimeout(()=>resolve({phase:'deadline',detail:last}),15000)
        const finish=value=>{clearTimeout(timer);resolve(value)}
        result=finish
        child.once('error',error=>finish({phase:'spawn-error',detail:error.message}))
        child.once('exit',(code,signal)=>finish({phase:'exit',detail: JSON.stringify({code,signal,last})}))
      })
      result=null
      let treeTerminated = false
      if (process.platform === 'win32' && child.pid && child.exitCode === null && !child.signalCode) {
        await new Promise(resolve => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'],
          { windowsHide: true, timeout: 10000 }, error => {
            trace('cleanup albero Chrome', error?.code ?? 0)
            treeTerminated = !error
            if (error) child.kill()
            resolve()
          }))
      } else if (child.exitCode === null && !child.signalCode) child.kill()
      // Chromium helpers can retain the inherited pipe handles after the parent exits.
      child.stdout.destroy()
      child.stderr.destroy()
      let shutdownTimer
      try {
        if (treeTerminated) child.unref()
        else await Promise.race([closed,new Promise((_,reject)=>{shutdownTimer=setTimeout(()=>reject(Error('Chiusura Chrome: '+mode+'; ultima operazione '+last)),5000)})])
      } finally { clearTimeout(shutdownTimer) }
      trace('esito asserzioni '+mode,JSON.stringify(outcome))
      if (outcome.phase === 'exit' && JSON.parse(outcome.detail).last === 'spawn '+mode && !retryStartup) {
        retryStartup = true
        trace('Chrome uscito prima della pagina; nuovo profilo',mode)
        index--
        continue
      }
      retryStartup = false
      assert.equal(outcome.phase,'pass',outcome.detail)
      await context.onPass?.(mode,outcome.detail)
      trace('postcheck scenario completato',mode)
    }
  } finally {
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})
    trace('server fixture chiuso')
  }
}
