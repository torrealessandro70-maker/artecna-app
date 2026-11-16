[CmdletBinding(DefaultParameterSetName='Verify')]
param(
    [Parameter(ParameterSetName='Verify')][switch]$VerifyOnly,
    [Parameter(Mandatory,ParameterSetName='Diagnosi')][switch]$DiagnosiOnly,
    [Parameter(Mandatory,ParameterSetName='Diagnosi')][guid]$UtenteId,
    [Parameter(Mandatory,ParameterSetName='Diagnosi')][string]$Psql
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest

$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$head=git -C $root rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -cne 'aa31f7068fe0753286efc0a2d57b7e5de6151fe2') { throw 'Base Git inattesa' }
$scriptName='contratti_storici_readonly.sql'
$payload=[IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $scriptName))
$sha=[Security.Cryptography.SHA256]::Create()
try { $hash=[BitConverter]::ToString($sha.ComputeHash($payload)).Replace('-','').ToLowerInvariant() }
finally { $sha.Dispose() }
if ($hash -cne '51754f049152eab1d67e989270550f4d22b401fef4e7df5e4167f379f0420c9a') { throw 'SHA-256 SQL divergente' }
Write-Host "SHA256_SQL=$hash"
if (-not $DiagnosiOnly) { Write-Host 'ARTECNA_CONTRATTI_STORICI_VERIFY_ONLY_GREEN'; return }

if ($UtenteId -eq [guid]::Empty) { throw 'UUID operatore non valido' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'Eseguibile psql.exe richiesto' }
$attempt=Join-Path (Join-Path $root '.run/contratti-storici') ([guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($attempt) | Out-Null
$sqlPath=Join-Path $attempt $scriptName
[IO.File]::WriteAllBytes($sqlPath,$payload)
$out=Join-Path $attempt 'psql.stdout.log'
$conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=require connect_timeout=20 options='-c default_transaction_read_only=on -c statement_timeout=35000 -c lock_timeout=3000'"
$argsPsql=@('-X','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',('"' + $conn + '"'),
    '-P','pager=off','-v','ON_ERROR_STOP=1','-v',('utente_id=' + $UtenteId.ToString('D')),
    '-o',('"' + $out + '"'),'-f',('"' + $sqlPath + '"'))
Write-Host 'Inserire la password esclusivamente nella finestra nativa di psql.'
$process=Start-Process -FilePath $client -ArgumentList $argsPsql -Wait -PassThru
$code=$process.ExitCode
$log=''
if (Test-Path -LiteralPath $out -PathType Leaf) { $log=[string](Get-Content -LiteralPath $out -Raw) }
$commits=[regex]::Matches($log,'(?m)^COMMIT\r?$').Count
$rollbacks=[regex]::Matches($log,'(?m)^ROLLBACK\r?$').Count
$markers=[regex]::Matches($log,'(?m)^ARTECNA_CONTRATTI_STORICI_DIAGNOSI_TERMINATA\r?$').Count
$cases=@([regex]::Matches($log,'(?m)^caso=H[1-4] causa=[a-z_]+ cantiere_visibile=(?:true|false) documento_visibile=(?:true|false)\r?$') | ForEach-Object { $_.Value.TrimEnd() })
$chains=@([regex]::Matches($log,'(?m)^catena_v7=[a-z_]+\r?$') | ForEach-Object { $_.Value.TrimEnd() })
$stops=@([regex]::Matches($log,'(?m)^STOP=[a-z_]+\r?$') | ForEach-Object { $_.Value.TrimEnd() })
@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks") + $cases + $chains + $stops |
    Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Log $attempt"
$unique=@($cases | ForEach-Object { $_.Substring(5,2) } | Select-Object -Unique)
if ($code -ne 0 -or $commits -ne 0 -or $rollbacks -ne 1 -or $markers -ne 1 -or
    $cases.Count -ne 4 -or $unique.Count -ne 4 -or $chains.Count -ne 1 -or $stops.Count -ne 0) {
    throw 'STOP: diagnostica incompleta'
}
Write-Host 'ARTECNA_CONTRATTI_STORICI_DIAGNOSI_TERMINATA'
