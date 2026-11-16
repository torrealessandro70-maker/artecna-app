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
$atteso='50247305125982663185c2806811b448d4ea54cb'
$head=git -C $root rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -cne $atteso) { throw 'Base Git inattesa' }
$scriptName='materiali_dedup_readonly.sql'
$payload=[IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $scriptName))
$sha=[Security.Cryptography.SHA256]::Create()
try { $effettivo=[BitConverter]::ToString($sha.ComputeHash($payload)).Replace('-','').ToLowerInvariant() }
finally { $sha.Dispose() }
if ($effettivo -cne 'c94406966121f3e74294ea6ed533eb3bace500f9335224abd6fdad36a5896a33') { throw 'SHA-256 dello script diagnostico divergente' }
Write-Host "SHA256_SQL=$effettivo"
if (-not $DiagnosiOnly) { Write-Host 'ARTECNA_MATERIALI_VERIFY_ONLY_GREEN'; return }

if ($UtenteId -eq [guid]::Empty) { throw 'UUID operatore non valido' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'Eseguibile psql.exe richiesto' }
$logs=Join-Path $root '.run/materiali-dedup/production'
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
$marker=[regex]::Matches($log,'(?m)^ARTECNA_MATERIALI_DIAGNOSI_TERMINATA\r?$').Count
$esito=[regex]::Match($log,'(?m)^esito=[A-Z_]+ fase=[a-z_]+(?: [a-z_]+=[a-zA-Z0-9_]+)*\r?$').Value.Trim()
$righe=[regex]::Matches($log,'(?m)^raccolta=C[0-9]+ riga=R[0-9]+ fase=[a-z_]+ motivo=[a-z_]+\r?$') |
    ForEach-Object { $_.Value.TrimEnd() }
$risultato=@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks",$esito)+@($righe)
$risultato | Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Log $attempt"
if ($code -ne 0 -or $commits -ne 0 -or $rollbacks -ne 1 -or $marker -ne 1 -or
    $esito -notmatch '^esito=DIAGNOSI_COMPLETATA fase=completata ') {
    throw 'STOP diagnostica. Conservare solo il log locale e riportare esito, fase e SQLSTATE.'
}
Write-Host 'ARTECNA_MATERIALI_DIAGNOSI_TERMINATA'
