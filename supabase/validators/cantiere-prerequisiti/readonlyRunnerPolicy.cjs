// A read-only runner must point psql directly at the single read-only SQL file.
// Manifest entries may name application artifacts; --file may never select them.
const assert=require('node:assert/strict')
exports.assertReadOnlyPsqlTarget=function(script){
 const targets=[...script.matchAll(/'--file'\s*,\s*\(Join-Path \$bundle '([^']+)'\)/g)].map(m=>m[1])
 assert.deepEqual(targets,['01_recovery_precheck_readonly.sql'],'Read-only psql --file must select only the recovery precheck')
 assert(!script.includes('[IO.FileMode]::CreateNew'),'Read-only precheck must not consume application attempt')
 assert(script.includes('default_transaction_read_only=on'),'Connection starts read-only')
}
