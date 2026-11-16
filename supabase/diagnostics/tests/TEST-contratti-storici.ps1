[CmdletBinding()]
param([Parameter(Mandatory)][string]$PgBin)
$ErrorActionPreference='Stop'
$diagnostics=Split-Path $PSScriptRoot
$sql=Join-Path $diagnostics 'contratti_storici_readonly.sql'
$testRoot=Join-Path ([IO.Directory]::CreateDirectory((Join-Path $diagnostics '../../.run')).FullName) ('artecna-contratti-' + [guid]::NewGuid().ToString('N'))
$init=Join-Path $PgBin 'initdb.exe'
$ctl=Join-Path $PgBin 'pg_ctl.exe'
$psql=Join-Path $PgBin 'psql.exe'
$port=(Get-Random -Minimum 49152 -Maximum 65535)
$started=$false
$fixtureDb='postgres'
function Invoke-LocalSql([string[]]$Arguments) {
    $output=& $psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U fixture -d $fixtureDb @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'psql fixture non riuscito' }
    $output
}
function Assert-Result([string[]]$Expected, [string]$Actor='10000000-0000-0000-0000-000000000001') {
    $out=Join-Path $testRoot 'psql.stdout.log'
    Invoke-LocalSql @('-v',"utente_id=$Actor",'-o',$out,'-f',$sql) | Out-Null
    $result=Get-Content -LiteralPath $out
    foreach ($line in $Expected) {
        if ($result -notcontains $line) { throw "Risultato atteso assente: $line" }
    }
    if (@($result | Where-Object { $_ -eq 'ROLLBACK' }).Count -ne 1 -or $result -contains 'COMMIT') {
        throw 'Confini transazione divergenti'
    }
    if ($result -match '[0-9a-f]{8}-[0-9a-f-]{27}' -or $result -match 'TESTA|BELLUOMO|PERNICONE|ALESSANDRO') {
        throw 'Log con identificativi'
    }
}
try {
    & $init -D $testRoot -A trust -U fixture --no-locale -E UTF8 --no-sync | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'initdb non riuscito' }
    $startArgs=@('-D', ('"' + $testRoot + '"'), '-l', ('"' + (Join-Path $testRoot 'server.log') + '"'),
        '-o', ('"-h 127.0.0.1 -p ' + $port + '"'), '-w', '-t', '20', 'start')
    $server=Start-Process -FilePath $ctl -ArgumentList $startArgs -WindowStyle Hidden -PassThru
    $server.WaitForExit()
    if ($server.ExitCode -ne 0) { throw 'postgres fixture non avviato' }
    $started=$true
    Invoke-LocalSql @('-f',(Join-Path $PSScriptRoot 'contratti_storici_fixture.sql')) | Out-Null
    $marker='ARTECNA_CONTRATTI_STORICI_DIAGNOSI_TERMINATA'
    Assert-Result @(
        'caso=H1 causa=nessuna_base_associata cantiere_visibile=true documento_visibile=false',
        'caso=H2 causa=documento_del_cantiere_non_designato cantiere_visibile=true documento_visibile=false',
        'caso=H3 causa=documento_assente cantiere_visibile=true documento_visibile=false',
        'caso=H4 causa=documento_senza_cantiere cantiere_visibile=true documento_visibile=true',
        'catena_v7=verificata',$marker
    )
    $changes=@"
UPDATE preventivi_cantiere SET cantiere_id='30000000-0000-0000-0000-000000000001' WHERE id='20000000-0000-0000-0000-000000000004';
INSERT INTO preventivi_cantiere VALUES
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','integrativo',60),
 ('20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',null,null),
 ('20000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000002',null,30);
UPDATE cantieri SET preventivo_contrattuale_id='20000000-0000-0000-0000-000000000001' WHERE nome='TESTA GIANNI';
UPDATE cantieri SET preventivo_contrattuale_id='20000000-0000-0000-0000-000000000008' WHERE nome='TORRE Alessandro';
"@
    Invoke-LocalSql @('-c',$changes) | Out-Null
    Assert-Result @(
        'caso=H1 causa=documento_integrativo cantiere_visibile=true documento_visibile=true',
        'caso=H2 causa=documento_non_visibile cantiere_visibile=true documento_visibile=false',
        'caso=H3 causa=importo_non_valido cantiere_visibile=true documento_visibile=true',
        'caso=H4 causa=documento_di_altro_cantiere cantiere_visibile=true documento_visibile=true',
        'catena_v7=verificata',$marker
    )
    Assert-Result @('STOP=contesto_non_verificato') '10000000-0000-0000-0000-000000000099'
    Invoke-LocalSql @('-c',"INSERT INTO cantieri VALUES ('30000000-0000-0000-0000-000000000009','TESTA GIANNI',null)") | Out-Null
    Invoke-LocalSql @('-c',"UPDATE cantieri SET nome='Denominazione differente' WHERE nome='Avv. PERNICONE sub 13'") | Out-Null
    Assert-Result @(
        'caso=H1 causa=nome_esatto_ambiguo cantiere_visibile=false documento_visibile=false',
        'caso=H2 causa=documento_non_visibile cantiere_visibile=true documento_visibile=false',
        'caso=H3 causa=importo_non_valido cantiere_visibile=true documento_visibile=true',
        'caso=H4 causa=nome_esatto_non_trovato cantiere_visibile=false documento_visibile=false',
        'catena_v7=verificata',$marker
    )
    Invoke-LocalSql @('-c',"UPDATE cantieri SET nome='Denominazione differente' WHERE nome='TESTA ANTONINO'") | Out-Null
    Assert-Result @(
        'caso=H2 causa=documento_non_visibile cantiere_visibile=true documento_visibile=false',
        'caso=H3 causa=importo_non_valido cantiere_visibile=true documento_visibile=true',
        'catena_v7=cantiere_non_trovato',$marker
    )
    Invoke-LocalSql @('-c','CREATE DATABASE diagnostica_mirata') | Out-Null
    $fixtureDb='diagnostica_mirata'
    Invoke-LocalSql @('-f',(Join-Path $PSScriptRoot 'contratti_storici_fixture.sql')) | Out-Null
    $focused=@"
INSERT INTO preventivi_cantiere (id,cantiere_id,natura,importo_totale,cantiere,approvato) VALUES
 ('20000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000003',null,950,'TESTA GIANNI',true),
 ('20000000-0000-0000-0000-000000000009','30000000-0000-0000-0000-000000000003','integrativo',15,null,false),
 ('20000000-0000-0000-0000-000000000010','30000000-0000-0000-0000-000000000004',null,1200,null,true);
UPDATE cantieri SET nome='Denominazione aggiornata' WHERE nome='TESTA GIANNI';
INSERT INTO preventivo_lavorazioni VALUES (4,'30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000010');
INSERT INTO sal_lavorazioni VALUES ('30000000-0000-0000-0000-000000000004',4,null),('30000000-0000-0000-0000-000000000003',null,null);
INSERT INTO varianti_cantiere VALUES ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','approvata','20000000-0000-0000-0000-000000000008');
"@
    Invoke-LocalSql @('-c',$focused) | Out-Null
    $out=Join-Path $testRoot 'focus.stdout.log'
    $focusSql=Join-Path $diagnostics 'contratti_storici_mirata_readonly.sql'
    $focusArgs=@('-v','utente_id=10000000-0000-0000-0000-000000000001','-v','h1_uuid=30000000-0000-0000-0000-000000000001','-o',$out,'-f',$focusSql)
    Invoke-LocalSql $focusArgs | Out-Null
    $result=Get-Content -LiteralPath $out
    $expected=@(
        'caso=H1 esito=uuid_nome_registrato_diverso nomi_esatti=0 riferimenti_testuali=1',
        'h1_visibilita=visibile',
        'caso=H3 cantieri=1 candidati=2 integrativi=1',
        'caso=H4 cantieri=1 candidati=1 integrativi=0',
        'candidato=H3/D1 natura=non_registrata importo=positivo_al_centesimo approvato=true designato=false lettura=non_visibile sal_incompatibile=false sal_senza_sorgente=true varianti_incompatibili=false',
        'candidato=H3/D2 natura=integrativo importo=positivo_al_centesimo approvato=false designato=false lettura=visibile sal_incompatibile=false sal_senza_sorgente=true varianti_incompatibili=true',
        'candidato=H4/D1 natura=non_registrata importo=positivo_al_centesimo approvato=true designato=false lettura=visibile sal_incompatibile=false sal_senza_sorgente=false varianti_incompatibili=false',
        'ARTECNA_STORICI_MIRATA_TERMINATA'
    )
    foreach ($line in $expected) {
        if ($result -notcontains $line) { throw "Risultato mirato atteso assente: $line" }
    }
    if (@($result | Where-Object { $_ -eq 'ROLLBACK' }).Count -ne 1 -or $result -contains 'COMMIT' -or
        $result -match '[0-9a-f]{8}-[0-9a-f-]{27}|TESTA|BELLUOMO|PERNICONE') {
        throw 'Log o transazione della diagnostica mirata divergenti'
    }
    Invoke-LocalSql @('-c','REVOKE SELECT ON preventivi_cantiere FROM authenticated') | Out-Null
    Invoke-LocalSql $focusArgs | Out-Null
    if (@(Get-Content -LiteralPath $out | Where-Object { $_ -match '^candidato=.* lettura=select_negata ' }).Count -ne 3) {
        throw 'Revoca SELECT non rilevata'
    }
    Invoke-LocalSql @('-f',(Join-Path $PSScriptRoot 'destinazione_amministrativa_fixture.sql')) | Out-Null
    Invoke-LocalSql @('-f',(Join-Path $PSScriptRoot 'classificazione_cantieri_setup.sql')) | Out-Null
    Invoke-LocalSql @('-f',(Join-Path $diagnostics 'classificazione_cantieri_precheck_readonly.sql')) | Out-Null
    Invoke-LocalSql @('-f',(Join-Path (Split-Path $diagnostics) 'migrations/20261116000100_classificazione_cantieri.sql')) | Out-Null
    Invoke-LocalSql @('-f',(Join-Path $PSScriptRoot 'classificazione_cantieri_checks.sql')) | Out-Null
    & (Join-Path $PgBin 'postgres.exe') --version
    Write-Output 'CONTRATTI_STORICI_FIXTURE_GREEN'
} finally {
    if ($started) {
        & $ctl -D $testRoot -m fast -w stop | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Arresto cluster fixture non riuscito' }
    }
    if (Test-Path -LiteralPath $testRoot) {
        $resolved=(Resolve-Path -LiteralPath $testRoot).Path
        if ($resolved -ceq $testRoot -and (Split-Path $resolved -Leaf) -match '^artecna-contratti-[a-f0-9]{32}$') {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
}
