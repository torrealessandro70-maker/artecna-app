const {test}=require('node:test'),assert=require('node:assert/strict'),{assertReadOnlyPsqlTarget}=require('./readonlyRunnerPolicy.cjs')
test('read-only runner: rejects R3 aggregate target, missing/duplicate target and attempt marker',()=>{
 const good="$arguments=@('--file',(Join-Path $bundle '01_recovery_precheck_readonly.sql')); # default_transaction_read_only=on"
 assertReadOnlyPsqlTarget(good)
 assert.throws(()=>assertReadOnlyPsqlTarget(good.replace('01_recovery_precheck_readonly.sql','ApplyRecovery.sql')))
 assert.throws(()=>assertReadOnlyPsqlTarget(good+good))
 assert.throws(()=>assertReadOnlyPsqlTarget(good+' [IO.FileMode]::CreateNew'))
 assert.throws(()=>assertReadOnlyPsqlTarget('default_transaction_read_only=on'))
})
