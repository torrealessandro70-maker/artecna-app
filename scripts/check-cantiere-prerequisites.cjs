// Offline full build. Runtime credentials/.env files are never read or written.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.run/prereq-quality');fs.mkdirSync(dir,{recursive:true})
const main=path.resolve(root,'../..'),fontDir=path.join(main,'.next/static/media')
const fonts=fs.readdirSync(fontDir).filter(n=>n.endsWith('.woff2'));if(fonts.length<2)throw Error('Cached font assets required for fully offline build')
const assets=fonts.slice(0,2).map(n=>path.join(fontDir,n).replace(/\\/g,'/').replace(/^[A-Za-z]:/,''))
const mock=path.join(dir,'fonts.cjs'),guard=path.join(dir,'no-network.cjs')
fs.writeFileSync(mock,`module.exports=new Proxy({}, {get:(_,url)=>typeof url==='string'&&url.startsWith('https://fonts.googleapis.com/') ? '/* latin */\\n@font-face {font-family: '+(url.includes('Geist+Mono')?'Geist Mono':'Geist')+';font-style:normal;font-weight:100 900;src:url('+${JSON.stringify(assets)}[url.includes('Geist+Mono')?1:0]+') format(\"woff2\");}' : undefined});`)
fs.writeFileSync(guard,`const net=require('node:net');const original=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const o=args[0];const host=o&&typeof o==='object'?o.host:typeof args[1]==='string'?args[1]:undefined;if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('Offline quality gate blocked external network');return original.apply(this,args)};
global.fetch=async()=>{throw Error('Offline quality gate blocked fetch')};`)
// An unrelated pre-existing API route instantiates OpenAI at module load.
// Supply a NON-CREDENTIAL only in this offline child process so page collection
// can run; all fetches are blocked. No real key is reused/provisioned/written.
const next=require.resolve('next/dist/bin/next'),env={...process.env,OPENAI_API_KEY:'offline-build-only-not-a-credential',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:mock,NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:[process.env.NODE_OPTIONS||'',`--require=${guard}`].join(' ').trim()}
const r=spawnSync(process.execPath,[next,'build'],{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:16e6})
const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(dir,'build.log'),output);process.stdout.write(output);if(r.error)throw r.error;process.exitCode=r.status||0
