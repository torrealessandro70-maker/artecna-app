// Inspect build artifacts without printing bundle contents or configuration.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.next/static/chunks')
const modules=['storageWorker','storageRemoval','storageSession','storageEntrypoint']
for(const name of modules){const source=fs.readFileSync(path.join(root,'app/engines/cantiere-delete',name+'.server.ts'),'utf8');assert(source.startsWith("import 'server-only'"),name);assert(!/console\./.test(source),'Worker/remover must not log raw errors or configuration')}
let count=0
function inspect(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())inspect(file);else if(item.name.endsWith('.js')){count++;assert(!/STORAGE_CLEANUP_DATABASE_URL|storage_verifica_job|artecna-storage-cleanup|STORAGE_SESSION_UNAVAILABLE/.test(fs.readFileSync(file,'utf8')),'Storage server code leaked into client chunk')}}}
inspect(dir);assert(count>0);console.log('Client boundary GREEN: '+count+' chunks inspected; four server-only modules')
