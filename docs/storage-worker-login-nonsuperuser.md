# Migration 007 e precheck con installer PostgreSQL 17 non-superuser

Parent applicativo: 612db0f17df314bb4ae2b70ce4799119bb7c352e.
Nessun accesso Production, fetch remoto, migration remota, password/ENV,
push/deploy, modifica UI o RPC finale. Tutte le prove DB di questo step
sono su PostgreSQL 17.6 isolato in loopback con dati sintetici.

## Semantica della 007

Non esiste piu' alcun ALTER ROLE. Il ruolo tecnico viene creato, se assente,
con NOLOGIN INHERIT; il login dedicato con LOGIN INHERIT. Nessun altro
attributo elevato viene richiesto: vengono usati i default sicuri PostgreSQL.
Nessuna password viene impostata, azzerata o interrogata.

Immediatamente dopo ogni creazione, e su ogni ruolo preesistente, si verificano
LOGIN/NOLOGIN, INHERIT true, SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS
false. Differenze producono eccezione; nessuna riparazione o revoca automatica
di privilegi del ruolo. Worker con altri parent, ownership o grant diretti
estranei al contratto, login con grant diretti/ownership e configurazioni
per-ruolo inattese vengono rifiutati. Non si leggono i valori di tali setting.

La membership login -> worker deve essere ADMIN false, INHERIT true, SET false.
Se esiste corretta non viene riscritta; se differisce si ferma. Se assente,
prima del GRANT si richiede un ADMIN diretto effettivo dell'installer sul worker
(oppure autorita' superuser). CREATEROLE da solo non viene usato come diritto
di amministrare un ruolo esistente. Il creatore non-superuser ottiene questo
ADMIN automaticamente in PostgreSQL 17; il test ne verifica la riga reale.
Percorsi ADMIN indiretti non sono indovinati: in loro assenza il contratto
supportato e' fail-closed. Se la membership e' gia' esatta, non serve un nuovo
grant amministrativo e non vengono ampliati i privilegi.

Lo schema deve concedere USAGE e CREATE al postgres effettivo; il linguaggio
SQL deve essere utilizzabile. Un helper preesistente deve avere owner postgres,
corpo/configurazione/attributi e ACL canonici. In caso diverso STOP, senza
ALTER OWNER o normalizzazione di ACL gia' divergenti. La prima creazione
neutralizza i default grants come nella versione precedente; a conclusione
sono ammessi soltanto EXECUTE a postgres e al worker, senza grant option.
I grant applicativi di claim/finish previsti dalla 001 non sono duplicati.

L'intera migration rimane transazionale. Errori di attributi, membership,
authority, helper o ACL fanno rollback anche delle eventuali creazioni locali
del tentativo. Non vengono alterati i permessi degli altri oggetti applicativi.

## Precheck corretto

Il vecchio STOP basato solo su rolsuper e' rimosso dal precheck aggiornato.
installer_superuser rimane soltanto un campo diagnostico; non determina GREEN.
La baseline deve coincidere con il catalogo certificato, tutte le migration
devono risultare NOT_APPLIED e worker/login devono essere assenti.
Si verificano CREATEROLE (o autorita' superuser), USAGE/CREATE sugli schemi
coinvolti e USAGE dei linguaggi trusted richiesti. Ownership e ACL baseline
sono comprese nel confronto canonico; gli oggetti creati nei passi precedenti
saranno dell'installer postgres. Per il worker assente viene esplicitata la
precondizione PG17_CREATOR_ADMIN_EXPECTED_ON_CREATE e la 007 la ricontrolla
effettivamente prima del GRANT.

Il confronto registra gli stati dei prefissi 0..7 costruiti dal vero actor
non-superuser. Stati gia' applicati, parziali o diversi rimangono STOP; nessun
resume o riapplicazione automatica. Policy role OID non riconciliati restano
esclusi come documentato nel bundle precedente; nessuna policy viene modificata
da questa correzione. I dati applicativi/config/backfill non vengono letti dal
precheck: ALREADY_EQUIVALENT significa equivalenza di catalogo, non prova del
completamento del backfill.

SQL versionato: supabase/validators/cantiere-prerequisiti/production-precheck-readonly.sql.
Generatore: scripts/generate-cantiere-prereq-precheck.cjs. Consuma soltanto i
due CSV locali certificati con SHA256 pin, non una DSN. Ricostruisce i metadata
attesi in un cluster effimero e scrive il SQL READ ONLY autonomo. Nessun export
grezzo viene versionato. Il metadata supplementare baseline-catalog-fidelity.json
contiene soltanto flag RLS e grant MAINTAIN mancanti dalla generica fixture dati.

## Prova reale del profilo osservato

Il bootstrap del cluster e' fixture_admin, distinto dall'actor applicativo.
Serve solo ad allestire il catalogo di test. Prima di qualunque migration
candidata o verifica precheck, postgres e' davvero NOSUPERUSER, CREATEROLE,
CREATEDB, REPLICATION, BYPASSRLS. Il test usa una connessione diretta con
current_user = session_user = postgres, senza privilegio SUPERUSER in prestito.

Il test baseline parte da zero migration e zero worker/login. Non sostituisce
l'oggetto observed del precheck e non forza il suo verdetto: esegue lo SQL
consegnabile sul catalogo reale della fixture, in BEGIN READ ONLY/ROLLBACK.
Risultato: GREEN_APPLY_7, installer_superuser=false, installer_createrole=true,
matched_prefix=0, migration_001..007_status=NOT_APPLIED, ruoli ABSENT,
drift_status=NO_CATALOG_DRIFT. Revoca CREATEROLE e perdita del diritto CREATE
sullo schema producono i rispettivi STOP reali.

Una seconda prova esegue realmente tutte le 001..007 in sequenza come postgres
non-superuser e verifica il login dedicato e l'ereditarieta' di claim/finish.
Gli scenari negativi allestiti dall'admin locale provano worker SUPERUSER/LOGIN/
CREATEROLE/BYPASSRLS/NOINHERIT, login CREATEROLE/BYPASSRLS/NOINHERIT, parent e
membership errati, ADMIN assente, helper con owner o ACL divergenti. Seconda
esecuzione e membership gia' corretta sono idempotenti senza ampliamento ACL.

## Riproduzione e confine operativo

```text
node scripts/generate-cantiere-prereq-precheck.cjs
node --test supabase/validators/cantiere-prerequisiti/*.test.cjs
node scripts/check-cantiere-prerequisites.cjs
node ../../node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node scripts/check-storage-client-boundary.cjs
```

Build e TypeScript vanno eseguiti in sequenza per evitare gare sui .next/types
generati. Il lint delta viene eseguito separatamente; la sola regola require
imports e' disabilitata per gli script CommonJS. La build usa le condizioni
offline gia' documentate nel parent, senza cambiare ENV reali.

Il bundle locale Production precheck viene aggiornato mantenendo una copia
dei file precedenti; non viene eseguito in Production. Runner psql -W e
contratto READ ONLY restano invariati. Un nuovo precheck manuale sara' necessario
prima di qualsiasi rilascio: il vecchio risultato riguarda i byte precedenti.
consumer_storage_canonico resta READY_FOR_CONFIGURATION.

Quality gate locale: 73/73 test (49 esistenti + 24 nuovi), piu' 13 controlli
del generatore di catalogo. TypeScript GREEN, lint delta senza warning,
build completa offline GREEN (26 pagine) e 51 chunk client verificati.
Rimane il warning Next preesistente sui lockfile multipli. Il risultato
GREEN_APPLY_7 e' esclusivamente offline; nessun nuovo gate Production eseguito.
