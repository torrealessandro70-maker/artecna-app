# Privilegio minimo contabile per la RPC hard-delete

La UI Production ha restituito `permission denied for schema artecna_contabilita`.
Il tentativo è stato rollbackato; non viene ripetuto da questo lavoro. La 011 è
un candidato locale e non autorizza applicazioni Production, push o deploy.

## Causa verificata

Il catalogo Production è stato acquisito in READ ONLY con timeout locale 8s.
La RPC `public.elimina_cantiere_definitivamente(uuid,text)` appartiene a
`artecna_cantieri_delete_rpc`, è SECURITY DEFINER e usa
`search_path=pg_catalog, pg_temp`. Il suo ACL ammette soltanto il proprietario
e `authenticated`. Il ruolo dedicato è NOINHERIT, NOSUPERUSER e non ha
membership in altri ruoli; la membership di `postgres` nel ruolo dedicato
ha INHERIT FALSE e SET FALSE e non conferisce privilegi in direzione inversa.

| Firma | Owner / ruolo effettivo | SECURITY DEFINER | search_path |
| --- | --- | --- | --- |
| public.elimina_cantiere_definitivamente(uuid,text) | artecna_cantieri_delete_rpc | true | pg_catalog, pg_temp |
| artecna_distruzione.hard_delete_lock(uuid) | postgres | true | pg_catalog, pg_temp |
| artecna_distruzione.detach_contabile_cantiere() | postgres | true | pg_catalog, pg_temp |
| artecna_contabilita.proteggi_origine() | postgres | true | pg_catalog, pg_temp |
| artecna_contabilita.proteggi_truncate() | postgres | true | pg_catalog, pg_temp |
| artecna_contabilita.autorizza(uuid) | postgres | true | pg_catalog, pg_temp |

`proteggi_origine` è il trigger contabile sui documenti; `proteggi_truncate`
non viene invocato dal percorso DELETE. `autorizza` non è chiamata dalla catena
DELETE. Le stringhe di firma lette dal catalogo non sono invocazioni di funzioni.
Non occorre concedere EXECUTE su nessuna di queste tre funzioni al ruolo RPC.

Il primo errore è stato riprodotto con stack completo su PostgreSQL 17.6:
`public.elimina_cantiere_definitivamente(uuid,text) line 178 at IF`.
È il controllo finale `Detach residuo`, che legge direttamente
`artecna_contabilita.attribuzioni_clienti` come ruolo dedicato. Il SELECT sulla
tabella era già presente; mancava USAGE sullo schema. Lock, detach e witness
eseguono invece nei rispettivi contesti SECURITY DEFINER di `postgres`.

## ACL e delta

Baseline schema: `{postgres=UC/postgres}`. Dopo:
`{postgres=UC/postgres,artecna_cantieri_delete_rpc=U/postgres}`.

Sulle tabelle `archivio_quote` e `archivio_attribuzioni` il ruolo dedicato non
ha ACL di lettura o scrittura. Su `attribuzioni_clienti` ha soltanto SELECT.
Gli ACL contabili non contengono grant a PUBLIC. I tipi compositi hanno i
privilegi impliciti di tipo già esistenti; non vengono cambiati. Non esistono
sequence nello schema contabile rilevato. Le operazioni di scrittura degli
archivi sono interne al detach SECURITY DEFINER; non richiedono nuovi grant.

Unica nuova capability: `USAGE ON SCHEMA artecna_contabilita` per il ruolo
dedicato. Nessun CREATE, ALL, EXECUTE, grant su tabella, cambio owner,
membership o grant ad authenticated/PUBLIC. Le ACL osservate sono congelate
in `contabilitaUsageBaseline.json` e importate esclusivamente nella fixture.
La vecchia fixture concedeva più accessi dello schema Production; il nuovo
setup li rimuove e allinea NOINHERIT prima di stabilire la baseline iniziale.

## Atomicità e firma

La firma di `hard_delete_catalog()` cambia con l'ACL di questo schema. La 011
verifica la baseline e aggiorna quindi `hard_delete_catalog_expected` nella
stessa transazione del GRANT, calcolando la firma dal catalogo corrente.
Nessun hash di firma della fixture viene inserito nella migration.
Le precondizioni confrontano anche sorgenti/owner/ACL delle tre funzioni
contabili, i sei tipi compositi/array senza ACL espliciti, le tre relazioni
contabili e l'assenza di membership del ruolo dedicato in altri ruoli.
Oggetti o privilegi supplementari impediscono l'applicazione.

Il controllo post confronta ACL, owner, sorgenti/configurazioni delle funzioni,
ACL di colonne/default, tipi, altri schemi, ruoli e membership con lo snapshot
interno precedente. Solo lo schema contabile e il valore della firma possono
cambiare. Non sono presenti DML su dati applicativi. Una seconda applicazione
o una baseline divergente causano errore e rollback.

## Verifica locale

Il test causale riproduce il 42501, applica il solo USAGE, ricalcola la firma
necessaria e completa la cancellazione sintetica, con ROLLBACK intenzionale.
I test aggiuntivi coprono fixture 1x/10x, diniego CREATE e letture/scritture
estranee, owner/membership invariati, errore tra GRANT e firma, applicazione
ripetuta negata, residuo root artificiale, contabilità e TD04 preservati e job
Storage soltanto pending. Nessun worker o file Storage reale è coinvolto.

Eseguire `npm run test:hard-delete-contabilita-usage` per i nuovi test e
`npm run test:hard-delete-contract` per i 155 test originali. La build offline
e lo scan client usano gli script di quality gate esistenti.

Quality gate finale: 155/155 test originali e 16/16 nuovi test, nessuno skip;
PostgreSQL 17.6; TypeScript noEmit, lint, build offline e scan 51 chunk GREEN.
Le migration 008/009/010 sono invariate. Nessuna modifica Production,
nessun push/deploy e nessun ulteriore tentativo UI.
