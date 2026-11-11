/* eslint-disable @typescript-eslint/no-require-imports -- Explicit local-only browser fixture for an already isolated native PostgreSQL gate. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
exports.startBrowserFixture = async function ({ root, artifact, rpc, documenti }) {
  const w = require('next/dist/compiled/webpack/webpack'); w.init()
  fs.writeFileSync(path.join(artifact, 'entry.cjs'), `const React=require('react'),{createRoot}=require('react-dom/client');const Panel=require(${JSON.stringify(path.join(root, 'app/components/ScadenziarioPersistentePanel.tsx'))}).default;const {creaArchivioScadenziario}=require(${JSON.stringify(path.join(root, 'app/engines/contabilita-ditta/scadenziarioPersistenza.ts'))});const client={async rpc(name,args){return (await fetch('/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})})).json()}};createRoot(document.getElementById('preview-root')).render(React.createElement(Panel,{archivioTest:creaArchivioScadenziario(client)}));`)
  if (documenti) {
    const entry = path.join(artifact, 'entry.cjs')
    fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace("createRoot(document.getElementById('preview-root'))", documenti.clientSource + ";createRoot(document.getElementById('preview-root'))").replace('{archivioTest:creaArchivioScadenziario(client)}', '{client}'))
  }
  fs.writeFileSync(path.join(artifact, 'ts-loader.cjs'), `module.exports=s=>require('typescript').transpileModule(s,{compilerOptions:{module:require('typescript').ModuleKind.CommonJS,jsx:require('typescript').JsxEmit.ReactJSX,target:require('typescript').ScriptTarget.ES2020}}).outputText`)
  fs.writeFileSync(path.join(artifact, 'css-loader.cjs'), `module.exports=s=>'module.exports={default:'+JSON.stringify(Object.fromEntries([...s.matchAll(/\\.([a-zA-Z][\\w-]*)/g)].map(m=>[m[1],m[1]])))+'}'`)
  await new Promise((resolve, reject) => w.webpack({ mode: 'development', context: root, entry: path.join(artifact, 'entry.cjs'), devtool: false, target: 'web', output: { path: path.join(artifact, 'browser-build'), filename: 'bundle.js' }, resolve: { extensions: ['.tsx', '.ts', '.js', '.json'], modules: [path.join(root, 'node_modules'), 'node_modules'] }, module: { rules: [{ test: /\.tsx?$/, use: path.join(artifact, 'ts-loader.cjs') }, { test: /\.css$/, use: path.join(artifact, 'css-loader.cjs') }] }, performance: { hints: false } }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()))
  const css = fs.readFileSync(path.join(root, 'app/components/ScadenziarioFiscalePanel.module.css'), 'utf8')
  const page = '<!doctype html><html lang="it"><meta charset="utf-8"><title>Scadenziario — DB locale 17.6</title><style>body{font:15px system-ui;background:#f1f5f9;margin:20px;color:#172033}main{max-width:1120px;margin:auto;background:white;padding:24px;border-radius:12px}button,input,select,textarea{border:1px solid #94a3b8;border-radius:4px}' + css + '</style><h1>Scadenziario — PostgreSQL locale 17.6</h1><p>Solo fixture sintetiche su loopback. Nessuna connessione Production.</p><main id="area-lavoro-principale"><div id="preview-root"></div></main><script src="/bundle.js"></script></html>'
  const allowed = new Set(['leggi_scadenze_fiscali', 'crea_scadenza_fiscale', 'aggiorna_scadenza_fiscale', 'archivia_scadenza_fiscale'])
  for (const name of documenti?.rpcNames || []) allowed.add(name)
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'")
    if (documenti && req.url.startsWith('/storage-fixture/')) return documenti.handle(req, res)
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fs.readFileSync(path.join(artifact, 'browser-build/bundle.js'))) }
    if (req.method === 'POST' && req.url.startsWith('/rpc/') && allowed.has(req.url.slice(5))) {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 131072) { res.statusCode = 413; return res.end() } }
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store')
      try { return res.end(JSON.stringify({ data: await rpc(req.url.slice(5), JSON.parse(body || '{}')), error: null })) } catch (e) { return res.end(JSON.stringify({ data: null, error: { code: e.code || 'LOCAL_FIXTURE_ERROR', message: e.message } })) }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: 'http://127.0.0.1:' + server.address().port, close: () => new Promise(resolve => server.close(resolve)) }
}
