[CmdletBinding(DefaultParameterSetName='Verify')]
param(
 [Parameter(ParameterSetName='Verify')][switch]$VerifyOnly,
 [Parameter(Mandatory,ParameterSetName='Diagnosi')][switch]$DiagnosiOnly,
 [Parameter(Mandatory,ParameterSetName='Diagnosi')][guid]$CantiereId,
 [Parameter(Mandatory,ParameterSetName='Diagnosi')][guid]$UtenteId,
 [Parameter(Mandatory,ParameterSetName='Diagnosi')][string]$Psql
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
if ((git -C $root rev-parse HEAD) -cne 'a8a0f478b17e5a79f0c86e6c86ddc40a62866eb3' -or $LASTEXITCODE -ne 0) {
 throw 'Base Git divergente'
}
$source=Join-Path $PSScriptRoot 'ribasso_contrattuale_readonly.sql'
$expected='6e3e2325e2aa62fac798684137b0c30c3a5d4d8b085951f126c146fc38efe1b5'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant() -cne $expected) {
 throw 'Hash SQL divergente'
}
if (!$DiagnosiOnly) { Write-Output 'ARTECNA_RIBASSO_DIAGNOSI_VERIFY_ONLY_GREEN'; return }
if ($CantiereId -eq [guid]::Empty -or $UtenteId -eq [guid]::Empty) { throw 'UUID mancanti' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'psql.exe richiesto' }
$attempt=Join-Path $root ('.run/ribasso-contrattuale/diagnosi-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($attempt) | Out-Null
$payload=[IO.File]::ReadAllText($source)
# Gli UUID restano nel solo payload privato locale, mai nel riepilogo.
$payload="\set cantiere_id '$($CantiereId.ToString())'"+[char]10+
 "\set utente_id '$($UtenteId.ToString())'"+[char]10+$payload
$sql=Join-Path $attempt 'payload.sql'
[IO.File]::WriteAllText($sql,$payload,[Text.UTF8Encoding]::new($false))
$out=Join-Path $attempt 'psql.stdout.log'
$conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=require gssencmode=disable connect_timeout=20 options='-c default_transaction_read_only=on -c check_function_bodies=on'"
$argsPsql=@('-X','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',('"' + $conn + '"'),
 '-P','pager=off','-v','ON_ERROR_STOP=1','-o',('"' + $out + '"'),'-f',('"' + $sql + '"'))
$startInfo=New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName=$client
$startInfo.Arguments=$argsPsql -join ' '
$startInfo.UseShellExecute=$false
$startInfo.CreateNoWindow=$false
foreach($name in @('PGHOSTADDR','PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGOPTIONS')){
 $startInfo.EnvironmentVariables.Remove($name)
}
Write-Host 'Inserire la password esclusivamente nel prompt nativo di psql.'
$process=[Diagnostics.Process]::Start($startInfo)
try { $process.WaitForExit(); $code=$process.ExitCode } finally { $process.Dispose() }
$log=''
if (Test-Path -LiteralPath $out) { $log=[IO.File]::ReadAllText($out) }
$commits=[regex]::Matches($log,'(?m)^COMMIT\r?$').Count
$rollbacks=[regex]::Matches($log,'(?m)^ROLLBACK\r?$').Count
$marker='ARTECNA_RIBASSO_DIAGNOSI_READONLY_COMPLETATA'
$complete=$code -eq 0 -and $commits -eq 0 -and $rollbacks -eq 1 -and
 [regex]::Matches($log,"(?m)^$marker\r?$").Count -eq 1 -and $log -notmatch '(?m)^STOP='
$result=@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks")
if ($complete) { $result+=$marker } else { $result+='STOP=diagnosi_incompleta' }
$result | Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Esito locale: $attempt"
if (!$complete) { throw 'STOP: diagnosi incompleta' }
