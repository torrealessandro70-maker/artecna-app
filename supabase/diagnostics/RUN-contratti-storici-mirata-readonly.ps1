[CmdletBinding(DefaultParameterSetName='Verify')]
param(
    [Parameter(ParameterSetName='Verify')][switch]$VerifyOnly,
    [Parameter(Mandatory,ParameterSetName='Diagnosi')][switch]$DiagnosiOnly,
    [Parameter(Mandatory,ParameterSetName='Diagnosi')][guid]$UtenteId,
    [Parameter(Mandatory,ParameterSetName='Diagnosi')][string]$Psql,
    [Parameter(ParameterSetName='Diagnosi')][guid]$H1Uuid
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest

$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$head=git -C $root rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -cne 'aa31f7068fe0753286efc0a2d57b7e5de6151fe2') { throw 'Base Git inattesa' }
$scriptName='contratti_storici_mirata_readonly.sql'
$payload=[IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $scriptName))
$sha=[Security.Cryptography.SHA256]::Create()
try { $hash=[BitConverter]::ToString($sha.ComputeHash($payload)).Replace('-','').ToLowerInvariant() }
finally { $sha.Dispose() }
if ($hash -cne '0c0c07f5461bdf816a9d6f665186ae192fe802859d274d9105e5a7e2a3cf2ba8') { throw 'SHA-256 SQL divergente' }
Write-Host "SHA256_SQL=$hash"
if (-not $DiagnosiOnly) { Write-Host 'ARTECNA_STORICI_MIRATA_VERIFY_ONLY_GREEN'; return }

if ($UtenteId -eq [guid]::Empty) { throw 'UUID operatore non valido' }
$client=(Resolve-Path -LiteralPath $Psql).Path
if ((Split-Path $client -Leaf) -ine 'psql.exe') { throw 'Eseguibile psql.exe richiesto' }
$attempt=Join-Path (Join-Path $root '.run/contratti-storici-mirata') ([guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($attempt) | Out-Null
$sqlPath=Join-Path $attempt $scriptName
[IO.File]::WriteAllBytes($sqlPath,$payload)
$out=Join-Path $attempt 'psql.stdout.log'
$conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=require connect_timeout=20 options='-c default_transaction_read_only=on -c statement_timeout=35000 -c lock_timeout=3000'"
$h1=''
if ($H1Uuid -ne [guid]::Empty) { $h1=$H1Uuid.ToString('D') }
$argsPsql=@('-X','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',('"' + $conn + '"'),
    '-P','pager=off','-v','ON_ERROR_STOP=1','-v',('utente_id=' + $UtenteId.ToString('D')), '-v',('h1_uuid=' + $h1),
    '-o',('"' + $out + '"'),'-f',('"' + $sqlPath + '"'))
Write-Host 'Inserire la password esclusivamente nella finestra nativa di psql.'
$process=Start-Process -FilePath $client -ArgumentList $argsPsql -Wait -PassThru
$code=$process.ExitCode
$log=''
if (Test-Path -LiteralPath $out -PathType Leaf) { $log=[string](Get-Content -LiteralPath $out -Raw) }
$commits=[regex]::Matches($log,'(?m)^COMMIT\r?$').Count
$rollbacks=[regex]::Matches($log,'(?m)^ROLLBACK\r?$').Count
$markers=[regex]::Matches($log,'(?m)^ARTECNA_STORICI_MIRATA_TERMINATA\r?$').Count
$cases=@([regex]::Matches($log,'(?m)^caso=(?:H1 esito=[a-z_]+ nomi_esatti=\d+ riferimenti_testuali=\d+|H[34] cantieri=\d+ candidati=\d+ integrativi=\d+)\r?$') | ForEach-Object { $_.Value.TrimEnd() })
$visibility=@([regex]::Matches($log,'(?m)^h1_visibilita=[a-z_]+\r?$') | ForEach-Object { $_.Value.TrimEnd() })
$documents=@([regex]::Matches($log,'(?m)^candidato=H[34]/D\d+ natura=[a-z_]+ importo=[a-z_]+ approvato=(?:true|false) designato=(?:true|false) lettura=[a-z_]+ sal_incompatibile=(?:true|false) sal_senza_sorgente=(?:true|false) varianti_incompatibili=(?:true|false)\r?$') | ForEach-Object { $_.Value.TrimEnd() })
$stops=@([regex]::Matches($log,'(?m)^STOP=[a-z_]+\r?$') | ForEach-Object { $_.Value.TrimEnd() })
@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks") + $cases + $visibility + $documents + $stops |
    Tee-Object -FilePath (Join-Path $attempt 'result.txt')
Write-Host "Log $attempt"
$unique=@($cases | ForEach-Object { $_.Substring(5,2) } | Select-Object -Unique)
$expected=0
foreach ($line in $cases) {
    if ($line -match ' candidati=(\d+) ') { $expected += [int]$Matches[1] }
}
if ($code -ne 0 -or $commits -ne 0 -or $rollbacks -ne 1 -or $markers -ne 1 -or
    $cases.Count -ne 3 -or $unique.Count -ne 3 -or $visibility.Count -ne 1 -or
    $documents.Count -ne $expected -or $stops.Count -ne 0) {
    throw 'STOP: diagnostica incompleta'
}
Write-Host 'ARTECNA_STORICI_MIRATA_TERMINATA'
