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
$atteso='72387ab96d89814fcb374835f842c7696731b0ed'
$head=git -C $root rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -cne $atteso) { throw 'Base Git inattesa' }
$scriptName='varianti_approvate_readonly.sql'
$payload=[IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $scriptName))
$sha=[Security.Cryptography.SHA256]::Create()
try { $effettivo=[BitConverter]::ToString($sha.ComputeHash($payload)).Replace('-','').ToLowerInvariant() }
finally { $sha.Dispose() }
if ($effettivo -cne '7e4beaad9d3af9ca477b161249a334471480e50dc9c277166ac8d7ffa30c4830') { throw 'SHA-256 dello script diagnostico divergente' }
Write-Host "SHA256_SQL=$effettivo"
if (-not $DiagnosiOnly) { Write-Host 'ARTECNA_VARIANTI_VERIFY_ONLY_GREEN'; return }

if ($UtenteId -eq [guid]::Empty) { throw 'UUID operatore non valido' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'Eseguibile psql.exe richiesto' }
$logs=Join-Path $root '.run/riconciliazione-fatture-varianti/diagnosi-production'
$attempt=Join-Path $logs ([guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($attempt) | Out-Null
$sqlPath=Join-Path $attempt $scriptName
[IO.File]::WriteAllBytes($sqlPath,$payload)
$out=Join-Path $attempt 'psql.stdout.log'
$conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=require connect_timeout=20 options='-c default_transaction_read_only=on -c statement_timeout=35000 -c lock_timeout=3000'"
$arguments=@('-X','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',('"' + $conn + '"'),
    '-P','pager=off','-v','ON_ERROR_STOP=1','-v',('utente_id=' + $UtenteId.ToString('D')),
    '-o',('"' + $out + '"'),'-f',('"' + $sqlPath + '"'))
Write-Host 'Inserire la password esclusivamente nella nuova finestra nativa di psql.'
$process=Start-Process -FilePath $client -ArgumentList $arguments -WindowStyle Normal -Wait -PassThru
$code=$process.ExitCode
$log=''
if (Test-Path -LiteralPath $out -PathType Leaf) { $log=[string](Get-Content -LiteralPath $out -Raw) }
$commits=[regex]::Matches($log,'(?m)^COMMIT\r?$').Count
$rollbacks=[regex]::Matches($log,'(?m)^ROLLBACK\r?$').Count
$marker=[regex]::Matches($log,'(?m)^ARTECNA_VARIANTI_SQL_READONLY_GREEN\r?$').Count
$esito=[regex]::Match($log,'(?m)^esito=[A-Z_]+ fase=[a-z_]+(?: [a-z_]+=[a-zA-Z0-9_]+)*\r?$').Value.Trim()
$risultato=@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks",$esito)
$risultato | Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Log $attempt"
if ($code -ne 0 -or $commits -ne 0 -or $rollbacks -ne 1 -or $marker -ne 1 -or
    $esito -notmatch '^esito=COERENTE fase=completata ') {
    throw 'STOP diagnostica. Conservare solo il log locale e riportare esito, fase e SQLSTATE.'
}
Write-Host 'ARTECNA_VARIANTI_SQL_READONLY_GREEN'
