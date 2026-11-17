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
$migration=Read-Sql (Join-Path $root 'supabase/migrations/20261117000100_accordi_contrattuali.sql') '0628081e6af03b10b91c8a0dbf38e83b21fcd4378d53653402c137f667f41746'
$pre=Read-Sql (Join-Path $PSScriptRoot 'accordi_contrattuali_precheck_readonly.sql') 'd1de21c29691117234fafcc954c4f1b9ad0ee6f958645e4066e9ff2696403a18'
$post=Read-Sql (Join-Path $PSScriptRoot 'accordi_contrattuali_postcheck_readonly.sql') '4bc700d965ca5729096c6877ae2b31e86fe69cd425b260356920986ceb0d5ba1'
$impronta=Read-Sql (Join-Path $PSScriptRoot 'accordi_contrattuali_impronta_readonly.sql') 'c1b8d617e99ec966d2e91c4aa47a3415124189d976844a9dfd94147c1c6c077c'
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
 Write-Output 'ARTECNA_ACCORDI_VERIFY_ONLY_GREEN'
 return
}
if ($Candidate -cnotmatch '^[0-9a-f]{40}$' -or (git -C $root rev-parse HEAD) -cne $Candidate -or $LASTEXITCODE -ne 0) { throw 'HEAD divergente' }
if ((git -C $root rev-parse 'HEAD^') -cne 'a8a0f478b17e5a79f0c86e6c86ddc40a62866eb3' -or $LASTEXITCODE -ne 0) { throw 'Parent divergente' }
if ((git -C $root status --porcelain --untracked-files=all) -or $LASTEXITCODE -ne 0) { throw 'Worktree non pulito' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'psql.exe richiesto' }
$payload=if ($ApplyOnce) { $applyPayload } elseif ($PostcheckOnly) { $post } else { $pre }
$work=Join-Path $root '.run/ribasso-contrattuale/production'
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
$expectedMarker=if ($PostcheckOnly -or $ApplyOnce) { 'ARTECNA_ACCORDI_POSTCHECK_READONLY_GREEN' } else { 'ARTECNA_ACCORDI_PRECHECK_READONLY_GREEN' }
$green=$code -eq 0 -and $commits -eq [int]$ApplyOnce.IsPresent -and $rollbacks -eq (1+[int]$ApplyOnce.IsPresent) -and
 [regex]::Matches($log,"(?m)^$expectedMarker\r?$").Count -eq 1 -and $log -notmatch '(?m)^STOP='
if ($ApplyOnce -and ([regex]::Matches($log,'(?m)^DATI_INVARIATI=true\r?$').Count -ne 1)) { $green=$false }
$result=@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks")
if ($green) { $result+=if ($ApplyOnce) { 'ARTECNA_ACCORDI_APPLY_POSTCHECK_GREEN' } else { $expectedMarker } }
else { $result+='STOP=esito_non_certificato' }
$result | Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Esito locale: $attempt"
if (!$green) { throw 'STOP: stato da verificare in sola lettura prima di qualsiasi rilancio' }
