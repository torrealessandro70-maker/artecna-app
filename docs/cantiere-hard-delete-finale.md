# Hard delete Cantiere finale: verifica locale

Aggiornamento: l'installer R1 del commit 3440bc9 è stato fermato dal precheck
Production prima della DDL. La revisione corrente è descritta in
[cantiere-hard-delete-installer-r2.md](cantiere-hard-delete-installer-r2.md):
baseline reale, replacement senza DROP/ALTER OWNER, quattro OUT originali e
capability SET/CREATE solo transazionali. Il rapporto sotto conserva la storia R1.

Data: 8 novembre 2026. Parent richiesto:
`e295e29141eabba581dfaaf3346b1158cd56d824`.

Verdetto del perimetro modificato: **HARD_DELETE_CANTIERE_READY_FOR_PRODUCTION_GATE**.
La migration non è installata in Production. Nessun hard delete, `mode=run`,
claim o accesso Storage Production è stato eseguito. Nessun push/deploy,
modifica Login, file ENV o infrastruttura del worker certificato.

## Fonti e migration

Fonti: `cantiere-audit-production-finale.md`, `cantiere-ownership-production.csv`,
`cantiere-fk-production.csv`, `cantiere-relazioni-logiche.csv`,
`cantiere-storage-production.csv` e migration 001–007. Lo stato operativo
certificato comunicato dall'utente aggiorna le precedenti indicazioni storiche
`consumer_storage_canonico = NO` contenute nell'audit.

Nuova migration: `20261108000800_cantiere_hard_delete_finale.sql`.
Il generatore offline `scripts/generate-cantiere-final.cjs` usa la baseline
schema-only già certificata e le migration 001–007 sul PostgreSQL locale 17.6.
Non interroga Production e non ricostruisce un inventario da nuove sorgenti.
Deriva da questa baseline PK e fingerprint strutturale; ownership e azioni
restano esplicite e coerenti con le matrici dell'audit.

## Contratto canonico e sicurezza

Unico ingresso applicativo: `public.elimina_cantiere_definitivamente(uuid,text)`.
SECURITY DEFINER, owner `artecna_cantieri_delete_rpc`, search_path
`pg_catalog,pg_temp`, JWT obbligatorio, owner membership verificata sotto lock,
conferma esatta `ELIMINA`, nessun retry automatico. DELETE diretto della root
revocato ai ruoli applicativi; rimosso l'helper client inutilizzato che conteneva
la vecchia cancellazione semplice.

La firma degli input è invariata. Gli OUT originari `cantiere_id`, `eliminato`,
`storage_nuovi`, `conteggi` restano disponibili; si aggiungono i campi top-level
`storage_jobs_created`, `storage_objects_preserved_shared`,
`legal_records_preserved`, `legacy_resolved_deleted`, `manifest_fingerprint`.
L'estensione del tipo di ritorno richiede DROP/CREATE nella stessa transazione;
DROP è RESTRICT, quindi dipendenze DB inattese fermano la migration.

La migration controlla il fingerprint della baseline prima delle modifiche.
La RPC e il preflight verificano poi il fingerprint post-migration di colonne,
vincoli, trigger e corpi/configurazioni delle routine dei domini certificati.
Una deriva blocca l'operazione. Le capability nuove sono private, con RLS sul
piano e nessun EXECUTE per i client sui relativi helper.

Le eccezioni alle guardie autorizzano soltanto DELETE di identità presenti nel
piano privato legato a transazione/backend/JWT owner. L'unico UPDATE aggiuntivo
è lo scollegamento esatto del puntatore `foto_cantiere.allegato_v1_id` del
target. Le altre colonne devono restare identiche. Le guardie originali restano
operative fuori da questo contesto. Non si disabilitano trigger nella RPC.

## Target set, ordine e residui

Prima delle mutation di dominio vengono salvate le PK, incluse le composite,
di 29 insiemi operativi e le identità dei record interessati dal detach.
Il piano conserva solo identità, serializzate in una colonna tecnica text,
non payload o path Storage. Viene eliminato prima della root e non introduce
un nuovo contenitore JSON/file da registrare nel consumer.

L'ordine implementato è:

1. Richieste Rapportino e SAL; legami Memory/visivi e analisi Variante.
2. Documenti Variante; lavorazioni leaf-first della self-FK; sorgenti Variante,
   comprese quelle collegate alle raccolte Economia.
3. Righe Economia, sorgenti Economia, raccolte Economia.
4. Timbrature, materiali Rapportino, prestazioni Rapportino.
5. Capability foto/allegati; allegati e foto, dopo lo scollegamento circoscritto
   del ciclo reciproco; testate Rapportino.
6. Lavorazioni preventivo; documenti integrativi leaf-first; testate Variante;
   preventivi contrattuali/residui leaf-first.
7. Materiali e attrezzi Cantiere, pagamenti fornitori, acconti, incassi non
   fatturati, memoria prezzi normalizzata.
8. Chiusura dei contesti, membership, Cantiere ultimo.

Detach contabile e preparazione outbox precedono questo ordine. Il puntatore
contrattuale della sola root viene sciolto nel contesto autorizzato.
Un ciclo effettivo non separabile produce rollback, senza DELETE trasversali.

Per tutti gli archi FK del target si controlla la concordanza delle identità
figlio/padre; vengono verificati anche gli archi logici Rapportino/foto,
timbrature, prestazione/Variante e ponte Economia/Variante.
Il controllo finale usa le PK salvate, dopo ogni DELETE inclusa la root:
non dipende da join verso padri ormai scomparsi. Conteggi discordanti, residui
o modifica di dati estranei provocano l'annullamento dell'intera chiamata.

La prova di conservazione confronta fingerprint delle righe fuori target,
compresi altri Cantieri e dati globali/shared. Per i record contabili oggetto
di detach sono congelate le relative identità prima della mutation. I record
già esistenti negli archivi devono restare identici; sono consentite le nuove
evidenze prodotte dal contratto contabile installato.

I lock sono conservativi, SHARE ROW EXCLUSIVE sulle tabelle della baseline,
anche per proteggere relazioni logiche senza FK. Possono sospendere writer
concorrenti; il futuro gate Production deve valutare volumi, durata e autorità
DDL dell'installer. Le fixture locali non costituiscono una misura dei tempi
Production né un'autorizzazione a distribuire o cancellare dati reali.

## Contabilità, legacy e sorgenti condivise

TD04 e attribuzioni usano `apri_contesto_prerequisiti`,
`detach_contabile_cantiere` e `chiudi_contesto_prerequisiti` installati.
Documenti, clienti e storico necessario vengono conservati; le quote e le
attribuzioni operative vengono archiviate/scollegate prima dei DELETE.
`materiali_impresa`, stock e righe fattura globali restano integri.

Le 14 sorgenti legacy sono lette dalla whitelist installata. Si cancella solo
per UUID normalizzato e PK salvata. Il nome viene usato esclusivamente per
rilevare candidati legacy ancora ambigui; non assegna ownership e non appare
come predicato di DELETE. I record assegnati a un altro UUID restano intatti.
Un ambiguo pertinente richiede risoluzione esplicita prima di continuare.

Sopralluoghi, foto Sopralluogo, note, allegati e Quaderno sono shared secondo
l'audit: il collegamento da un Cantiere non ne autorizza la distruzione.
I legami target Memory/visivi vengono rimossi; le fonti restano. Il collegamento
canonico Agenda `{tipo:cantiere,id:UUID}` viene azzerato conservando l'attività.
I contenitori storici non vengono interpretati come nuove FK operative.

## Storage

Nessuna chiamata HTTP Storage nella RPC. Prima dei DELETE si leggono le key
canonicali dal registry e si preparano nell'outbox esistente gli oggetti senza
riferimenti esterni al target set. I trigger del registry restano identici.

Se un trigger prepara un candidato ancora condiviso durante la rimozione di
una sorgente, la RPC rimuove soltanto quel job NUOVO prima del commit. Nessun
job nuovo per oggetti con riferimenti vivi sopravvive al commit. I job
preesistenti non sono cancellati da questa riconciliazione.

Il commit DB è indipendente dall'esecuzione successiva del worker. Registry,
tombstone, authority, claim/finish, lease e consumer certificati sono riusati
senza modifiche. La prova locale fa COMMIT dell'hard delete prima di avviare
il consumer canonico contro Storage fake; simula poi un crash dopo la
rimozione fisica fake e prima dell'ack, verificando il retry sulla stessa key.

## UI e preflight

Il preflight è STABLE e verificato in transazione READ ONLY. I normali domini
gestiti dalla RPC non sono blocker. Restano catalogo incoerente, legacy ambiguo
pertinente, ownership discordante, relazione esterna inseparabile e upload
con lease attiva. Gli errori di contratto bloccano il client fail-closed.

Dal Cantiere: `Elimina definitivamente`, verifica informativa, Continua,
digitazione esatta `ELIMINA`, singola RPC. Su successo il flusso esistente
chiude la finestra/pagina, rimuove il solo UUID dall'elenco e ricarica i dati.
Su errore mantiene la finestra e mostra l'esito, senza retry automatico.
I blocker reali hanno messaggi dedicati; non sono più descritti genericamente
come presenza di dati economici o storici.

## Verifica eseguita

78 test GREEN: 15 della suite finale e 63 di regressione (inclusi test UI,
Storage fake, sessione, gate, legacy e contabilità). La suite finale copre A–S:
vuoto; preventivi/lavorazioni/SAL; Variante con integrativo; Rapportino con
prestazione/materiale/richiesta/timbratura; foto V1 finalizzata; ponte Economia;
TD04; attribuzione; stock shared; file esclusivo/shared; omonimi; legacy target,
altro e ambiguo; conferma errata; non-owner; residuo con rollback; seconda
chiamata esplicitamente negata. Sono verificate anche le constraint deferred.

UI: handler effettivo eseguito con client RPC simulato e render effettivo della
finestra di conferma. Testati input inesatto/esatto, invio concorrente singolo,
errore senza retry, chiusura, conservazione dell'altro UUID e refresh elenco.
Non è una sessione browser con Auth/Storage reali.

Quality gate:

- PostgreSQL nativo 17.6 isolato, solo loopback e dati sintetici: GREEN.
- TypeScript `--noEmit --incremental false`: GREEN.
- ESLint dei file nuovi/modificati fuori dalla pagina storica: GREEN.
- Lint delta `app/page.tsx` rispetto al parent: GREEN, nessun nuovo finding.
  La pagina ha già 111 errori e 239 warning nel parent, invariati nel risultato.
  Non è dichiarato GREEN il lint integrale preesistente del repository.
- Build completa offline: GREEN, 26 pagine. Runner già esistente, font in cache,
  fetch esterni bloccati e segnaposto non credenziale solo nel processo build;
  nessun file ENV o configurazione distribuita modificato.
- Scan client bundle: GREEN, 51 chunk; moduli Storage restano server-only.
- `git diff --check`: GREEN.

Comandi riproducibili dal worktree:

```text
node --test supabase/validators/cantiere-prerequisiti/hardDeleteFinal.test.cjs
node --test supabase/validators/cantiere-prerequisiti/prerequisiti.test.cjs supabase/validators/cantiere-prerequisiti/contabilita.test.cjs supabase/validators/cantiere-prerequisiti/worker.test.cjs supabase/validators/cantiere-prerequisiti/session.test.cjs supabase/validators/cantiere-prerequisiti/gate.test.cjs app/utils/preflightEliminazione.test.cjs app/utils/hardDeleteFinalUi.test.cjs
node ../../node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node ../../node_modules/eslint/bin/eslint.js app/utils/preflightEliminazione.ts app/components/PreflightEliminazioneDialog.tsx app/utils/hardDeleteFinalUi.test.cjs scripts/generate-cantiere-final.cjs supabase/validators/cantiere-prerequisiti/hardDeleteFinal.test.cjs
node scripts/check-cantiere-prerequisites.cjs
node scripts/check-storage-client-boundary.cjs
```

Log locali conservati in `.run/hard-delete-tests.log`,
`.run/hard-delete-regression.log`, `.run/hard-delete-build.log`,
`.run/hard-delete-lint.log`, `.run/hard-delete-lint-delta.json`.
La baseline non simula l'intero servizio Auth/Storage e tutte le policy RLS
Supabase; i test verificano i controlli JWT/owner canonici e le capability,
con autenticazione e Storage sostituiti da fixture locali.
