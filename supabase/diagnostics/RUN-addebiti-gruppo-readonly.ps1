[CmdletBinding(DefaultParameterSetName='Verify')]
param(
 [Parameter(ParameterSetName='Verify')][switch]$VerifyOnly,
 [Parameter(Mandatory,ParameterSetName='Precheck')][switch]$PrecheckOnly,
 [Parameter(Mandatory,ParameterSetName='Postcheck')][switch]$PostcheckOnly,
 [Parameter(Mandatory,ParameterSetName='Precheck')]
 [Parameter(Mandatory,ParameterSetName='Postcheck')][string]$Candidate,
 [Parameter(Mandatory,ParameterSetName='Precheck')]
 [Parameter(Mandatory,ParameterSetName='Postcheck')][string]$Psql
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'addebiti_gruppo_hashes.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.PSObject.Properties) {
 $file=Join-Path $root $entry.Name
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$hash=[BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($file))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 if($hash -cne $entry.Value) {throw 'SHA-256 divergente: STOP'}
}
$selected=if($PostcheckOnly){'addebiti_gruppo_postcheck_readonly.sql'}else{'addebiti_gruppo_precheck_readonly.sql'}
$payload=[IO.File]::ReadAllText((Join-Path $PSScriptRoot $selected))
if([regex]::Matches($payload,'(?m)^ROLLBACK;\r?$').Count -ne 1 -or $payload -match '(?im)^\s*(COMMIT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|COPY)\b' -or $payload -notmatch 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;' -or $payload -notmatch '\\set ON_ERROR_STOP on') {throw 'Payload non READ ONLY'}
if(!$PrecheckOnly -and !$PostcheckOnly){Write-Output 'ARTECNA_ADDEBITI_GRUPPO_VERIFY_ONLY_GREEN';return}
if($Candidate -cnotmatch '^[0-9a-f]{40}$' -or (git -C $root rev-parse HEAD) -cne $Candidate){throw 'HEAD divergente'}
git -C $root diff --quiet HEAD
if($LASTEXITCODE -ne 0){throw 'Sorgenti tracciati modificati'}
$client=(Resolve-Path -LiteralPath $Psql).Path
if((Split-Path $client -Leaf) -ine 'psql.exe'){throw 'psql.exe richiesto'}
$directory=Join-Path $root ('.run/addebiti-gruppo/readonly-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($directory) | Out-Null
$sql=Join-Path $directory 'payload.sql';$out=Join-Path $directory 'psql.stdout.log'
[IO.File]::WriteAllText($sql,$payload,(New-Object Text.UTF8Encoding($false)))
$conn="host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres sslmode=require gssencmode=disable connect_timeout=20 options='-c default_transaction_read_only=on -c check_function_bodies=on'"
$start=New-Object Diagnostics.ProcessStartInfo
$start.FileName=$client
$start.Arguments=@('-X','-W','-U','postgres.axuiaiglbahygsmeoypy','--dbname',('"'+$conn+'"'),'-P','pager=off','-v','ON_ERROR_STOP=1','-o',('"'+$out+'"'),'-f',('"'+$sql+'"')) -join ' '
$start.UseShellExecute=$false;$start.CreateNoWindow=$false
foreach($name in @('PGHOSTADDR','PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGOPTIONS')){$start.EnvironmentVariables.Remove($name)}
Write-Host 'Password esclusivamente nel prompt nativo psql. Nessun retry automatico.'
$process=[Diagnostics.Process]::Start($start)
try{$process.WaitForExit();$code=$process.ExitCode}finally{$process.Dispose()}
$log=if(Test-Path -LiteralPath $out){[IO.File]::ReadAllText($out)}else{''}
$commits=[regex]::Matches($log,'(?m)^COMMIT\r?$').Count
$rollbacks=[regex]::Matches($log,'(?m)^ROLLBACK\r?$').Count
$marker=if($PostcheckOnly){'ARTECNA_ADDEBITI_GRUPPO_POSTCHECK_READONLY_GREEN'}else{'ARTECNA_ADDEBITI_GRUPPO_PRECHECK_READONLY_GREEN'}
$green=$code -eq 0 -and $commits -eq 0 -and $rollbacks -eq 1 -and [regex]::Matches($log,"(?m)^$marker\r?$").Count -eq 1
$result=@("PSQL_EXITCODE=$code","COMMIT_COUNT=$commits","ROLLBACK_COUNT=$rollbacks")
if($green){$result+=$marker}else{$result+='STOP=esito_non_certificato'}
$result | Tee-Object -FilePath (Join-Path $directory 'result.txt')
if(!$green){throw 'STOP: verificare gli artefatti, nessun rilancio automatico'}
