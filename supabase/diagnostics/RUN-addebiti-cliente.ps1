[CmdletBinding(DefaultParameterSetName='Verify')]
param(
 [Parameter(ParameterSetName='Verify')][switch]$VerifyOnly,
 [Parameter(Mandatory,ParameterSetName='Precheck')][switch]$PrecheckOnly,
 [Parameter(Mandatory,ParameterSetName='Apply')][switch]$ApplyOnce,
 [Parameter(Mandatory,ParameterSetName='Postcheck')][switch]$PostcheckOnly,
 [Parameter(Mandatory,ParameterSetName='Precheck')]
 [Parameter(Mandatory,ParameterSetName='Apply')]
 [Parameter(Mandatory,ParameterSetName='Postcheck')][string]$Candidate,
 [Parameter(Mandatory,ParameterSetName='Precheck')]
 [Parameter(Mandatory,ParameterSetName='Apply')]
 [Parameter(Mandatory,ParameterSetName='Postcheck')][string]$Psql
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
function Read-Sql([string]$Path,[string]$Hash) {
 $bytes=[IO.File]::ReadAllBytes($Path)
 $sha=[Security.Cryptography.SHA256]::Create()
 try { $actual=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant() }
 finally { $sha.Dispose() }
 if ($actual -cne $Hash) { throw 'SHA-256 SQL divergente' }
 return [Text.Encoding]::UTF8.GetString($bytes)
}
$migration=Read-Sql (Join-Path $root 'supabase/migrations/20261118000100_addebiti_materiali_cliente.sql') 'd9a97cc6106a68bae50c5dec9edadc8f9903501deb21189621e1a9e8e3253423'
$pre=Read-Sql (Join-Path $PSScriptRoot 'addebiti_cliente_precheck_readonly.sql') '0fc1674e83c11724436a82086704b4a7c9b0d36ca9fc4bfb8a4db937be6d3df0'
$post=Read-Sql (Join-Path $PSScriptRoot 'addebiti_cliente_postcheck_readonly.sql') 'c3a24bbb000fba51dadf316a7ceff649fd96047843de1e833b039e85cd5ac9ad'
$impronta=Read-Sql (Join-Path $PSScriptRoot 'addebiti_cliente_impronta_readonly.sql') '294873e612a5d8b7ce9e521440683223e41c95faff26e2fee1d4356db6d96919'
$nl=[string][char]10
$rollback=[regex]'(?m)^ROLLBACK;\r?$'
if ($rollback.Matches($pre).Count -ne 1 -or $rollback.Matches($post).Count -ne 1 -or
 [regex]::Matches($migration,'(?m)^COMMIT;\r?$').Count -ne 1 -or !$migration.StartsWith('BEGIN;')) {
 throw 'Confini transazionali divergenti'
}
$preApply=$rollback.Replace($pre,[Text.RegularExpressions.MatchEvaluator]{
 param($match)
 $impronta+$nl+'\set impronta_prima :impronta'+$nl+$match.Value
},1)
$compare=@(
 $impronta
 "SELECT :'impronta_prima' = :'impronta' AS dati_invariati"
 '\gset'
 '\if :dati_invariati'
 '\qecho DATI_INVARIATI=true'
 '\else'
 '\qecho STOP=impronta_dati_divergente'
 'ROLLBACK;'
 '\quit'
 '\endif'
) -join $nl
$postApply=$rollback.Replace($post,[Text.RegularExpressions.MatchEvaluator]{
 param($match)
 $compare+$nl+$match.Value
},1)
$applyPayload=@($preApply,'SET SESSION default_transaction_read_only=off;',$migration,$postApply) -join $nl
if (!$PrecheckOnly -and !$ApplyOnce -and !$PostcheckOnly) {
 Write-Output 'ARTECNA_ADDEBITI_VERIFY_ONLY_GREEN'
 return
}
if ($Candidate -cnotmatch '^[0-9a-f]{40}$' -or (git -C $root rev-parse HEAD) -cne $Candidate -or $LASTEXITCODE -ne 0) { throw 'HEAD divergente' }
if ((git -C $root rev-parse 'HEAD^') -cne 'f84d687f61a7e3a4e5592aaa6d9d6a31e333e1bc' -or $LASTEXITCODE -ne 0) { throw 'Parent divergente' }
if ((git -C $root status --porcelain --untracked-files=all) -or $LASTEXITCODE -ne 0) { throw 'Worktree non pulito' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'psql.exe richiesto' }
$payload=if ($ApplyOnce) { $applyPayload } elseif ($PostcheckOnly) { $post } else { $pre }
$work=Join-Path $root '.run/addebiti-cliente/production'
[IO.Directory]::CreateDirectory($work) | Out-Null
$attempt=Join-Path $work ('attempt-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($attempt) | Out-Null
$sql=Join-Path $attempt 'payload.sql'
$out=Join-Path $attempt 'psql.stdout.log'
[IO.File]::WriteAllText($sql,$payload,[Text.UTF8Encoding]::new($false))
if ($ApplyOnce) {
 $lock=[IO.File]::Open((Join-Path $work 'once.lock'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try {
  $bytes=[Text.Encoding]::ASCII.GetBytes($Candidate)
  $lock.Write($bytes,0,$bytes.Length)
 } finally { $lock.Dispose() }
}
$conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=require gssencmode=disable connect_timeout=20 options='-c default_transaction_read_only=on -c check_function_bodies=on'"
$argsPsql=@('-X','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',('"' + $conn + '"'),
 '-P','pager=off','-v','ON_ERROR_STOP=1','-o',('"' + $out + '"'),'-f',('"' + $sql + '"'))
$startInfo=New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName=$client
$startInfo.Arguments=$argsPsql -join ' '
$startInfo.UseShellExecute=$false
$startInfo.CreateNoWindow=$false
foreach($name in @('PGHOSTADDR','PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGOPTIONS')) { $startInfo.EnvironmentVariables.Remove($name) }
Write-Host 'Inserire la password esclusivamente nel prompt nativo di psql.'
$process=[Diagnostics.Process]::Start($startInfo)
try { $process.WaitForExit(); $code=$process.ExitCode } finally { $process.Dispose() }
$log=''
if (Test-Path -LiteralPath $out) { $log=[IO.File]::ReadAllText($out) }
$commits=[regex]::Matches($log,'(?m)^COMMIT\r?$').Count
$rollbacks=[regex]::Matches($log,'(?m)^ROLLBACK\r?$').Count
$expectedMarker=if ($PostcheckOnly -or $ApplyOnce) { 'ARTECNA_ADDEBITI_POSTCHECK_READONLY_GREEN' } else { 'ARTECNA_ADDEBITI_PRECHECK_READONLY_GREEN' }
$green=$code -eq 0 -and $commits -eq [int]$ApplyOnce.IsPresent -and $rollbacks -eq (1+[int]$ApplyOnce.IsPresent) -and
 [regex]::Matches($log,"(?m)^$expectedMarker\r?$").Count -eq 1 -and $log -notmatch '(?m)^STOP='
if ($ApplyOnce -and ([regex]::Matches($log,'(?m)^DATI_INVARIATI=true\r?$').Count -ne 1)) { $green=$false }
$result=@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks")
if ($green) { $result+=if ($ApplyOnce) { 'ARTECNA_ADDEBITI_APPLY_POSTCHECK_GREEN' } else { $expectedMarker } }
else { $result+='STOP=esito_non_certificato' }
$result | Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Esito locale: $attempt"
if (!$green) { throw 'STOP: stato da verificare in sola lettura prima di qualsiasi rilancio' }
