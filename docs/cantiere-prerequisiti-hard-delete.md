# Prerequisiti locali per hard delete Cantiere

Baseline applicativa: `fdd57e2d79e99153fe2ea9d8c7dbf645953fcf36`.
Le sei migration sono preparate e verificate esclusivamente su PostgreSQL
isolato con dati sintetici. Nessuna installazione Production, chiamata RPC
Production, modifica UI, sostituzione della RPC finale, push o deploy.
Gli export originali restano locali e ignorati da Git. L'audit certificato
precedente è conservato separatamente in `cantiere-audit-production-finale.md`.

## Ordine e confine di attivazione

| Migration | Contenuto |
|---|---|
| 20261107000100_storage_registry_outbox.sql | Registro, estrazione, guardia delle key, claim/finish sul vecchio outbox |
| 20261107000200_storage_sources_backfill.sql | 23 configurazioni di sorgente, trigger e backfill del registro |
| 20261107000300_contabilita_detach_prerequisiti.sql | Archivi indipendenti, contesto privato e detach contabile |
| 20261107000400_legacy_ownership_prerequisiti.sql | 14 sorgenti legacy, normalizzazione, risoluzione owner |
| 20261107000500_contabilita_guardie.sql | Eccezioni ristrette nelle guardie esistenti e manifest memoria prezzi |
| 20261107000600_prerequisiti_acl.sql | ACL esplicite e RLS sulle nuove tabelle private |

Non distribuire questo insieme autonomamente: le nuove FK e il fingerprint
del catalogo rendono intenzionalmente fail-closed la vecchia RPC finale.
Quella RPC conserva i blocchi P2131, le limitazioni Rapportini/E2/Economia–Variante
e il precedente inventario. Il prossimo step deve integrare atomicamente
contesto, detach, eliminazioni, nuovo manifest e cleanup, senza anticiparne
l'attivazione in questo step. La chiusura del contesto privato deve precedere
la cancellazione della radice; le quote ponte devono sparire con le righe
operative. Le FK RESTRICT impediscono che questi ponti siano dimenticati.

## Registro e sorgenti Storage

Nuove tabelle private in `artecna_distruzione`: `storage_oggetti`,
`storage_riferimenti`, `storage_sorgenti`, `storage_anomalie`, `storage_copertura`.
Identità oggetto: `(bucket,path)`; identità riferimento: oggetto + tabella + PK
JSON (incluse PK composite). `cantiere_id` è solo una correlazione facoltativa,
mai una prova di esclusività. Per sorgenti derivate il riferimento resta
identificabile attraverso la PK anche senza questa correlazione.

| Sorgente | Campi / estrazione |
|---|---|
| preventivi_cantiere | file_path: preventivi; file_url: URI canonico; json_voci_ai, provenienza_generazione |
| foto_cantiere | file_path: preventivi solo provider cloud; file_url, thumbnail_url, immagine_base64 solo URI |
| materiali_cantiere, attrezzi_cantiere | file_path: preventivi; file_url: URI canonico |
| foto_sopralluogo | immagine_base64 solo quando è realmente URI Storage |
| variante_documenti | storage_path: preventivi |
| artecna_rapportini.allegati | bucket + file_path |
| note_allegati | storage_path: preventivi; url canonico |
| quaderno_allegati | storage_bucket + storage_path; url canonico |
| quaderno_copie_allegati | storage_bucket + storage_path |
| fatture_emesse | pdf_url, xml_url canonici; riferimenti contabili preservati proteggono i byte |
| economia_righe | dettagli_analitici, prestazione_snapshot |
| quaderno_progetti, note_sopralluogo | analisi_ai, checklist, disegni |
| quaderno_gestioni | assets, documento; bucket del producer secondo tipo gestione |
| quaderno_richiami_sopralluogo | assets, documento, input_documento; quaderno-sopralluoghi |
| agenda_attivita | checklist, collegamento |
| variante_osservatore_analisi | fonti, risultato |
| fornitori_rettifiche | fotografia, richiesta |
| artecna_guardie.fatture_classificazione_richieste | payload, risultato |
| artecna_rapportini.richieste | risultato |
| variante_sorgenti, economia_sorgenti | snapshot |

Le 30 voci dell'inventario di audit confluiscono in 23 tabelle con 26 contenitori
JSON sorvegliati. I JSON non diventano indiscriminatamente oggetti: estrazione
ricorsiva solo per URI del progetto, schemi Quaderno canonici o descrittori
espliciti bucket/path. URL esterni e base64 rimangono esclusi. Un path JSON
senza bucket dimostrato produce un'anomalia, non una key inventata. Le anomalie
e una nuova colonna JSON/file non coperta bloccano globalmente il consumer.

Trigger AFTER INSERT/UPDATE/DELETE aggiornano registro e outbox nella stessa
transazione dei writer. Nessuna duplicazione nei client; TRUNCATE delle
sorgenti è rifiutato. Il backfill blocca le sorgenti, legge i record e scrive
solo il registro. Non cambia i record funzionali. Le guardie preesistenti
restano attive. Un errore fa rollback dell'intera migration.

Un riferimento arbitrario protegge un file, ma non concede potere DELETE
service-role. L'autorizzazione automatica al cleanup richiede il namespace
creatore verificato di allegati Rapportini V1 o Quaderno. I vecchi path
richiedono una prova indipendente di appartenenza approvata con il solo helper
amministrativo `storage_autorizza_cleanup(bucket,path,prova)`. Senza prova:
`failed / NO_CLEANUP_AUTHORITY`. Un job su oggetto non registrato:
`failed / UNREGISTERED_OBJECT`. Nessuna deduzione dal nome del Cantiere.

## Outbox, race e worker

È estesa la sola tabella esistente `cleanup_storage`: lease/token/backend,
scadenza, retry, errore permanente e job globali con cantiere NULL. Nessun
secondo outbox. La rimozione di un riferimento prepara il job nella medesima
transazione; duplicati fra cantieri convergono sul medesimo oggetto.

`storage_claim()` usa FOR UPDATE SKIP LOCKED e advisory lock di SESSIONE
per oggetto. Conta i riferimenti sotto lock e chiude il gate prima del commit.
Il worker mantiene la stessa connessione durante HTTP. I writer prendono lo
stesso advisory lock transazionale: un inserimento concorrente attende, poi
viene rifiutato dal tombstone. La key non viene mai riaperta, anche dopo errori,
crash o lease scaduto: occorre una nuova key per una nuova generazione.
Questo protegge anche da una vecchia richiesta HTTP ancora in volo.

`storage_finish()` richiede token e backend originari. `completed` arriva solo
dopo successo confermato, oppure assenza specifica della key. Errori temporanei
hanno backoff; errori permanenti restano failed con dettaglio. Bucket assente
o 404 ambiguo non valgono come successo. Un crash dopo DELETE e prima dell'ack
consente una successiva DELETE idempotente della stessa identità; non è una
promessa di esecuzione fisica exactly-once. Worker concorrenti non processano
contemporaneamente lo stesso oggetto finché il lock di sessione è valido.

`storageWorker.server.ts` riceve pool e remover in dependency injection.
La connessione dubbia viene distrutta, anche se si perde la risposta del claim.
`storageRemoval.server.ts` riusa il client Supabase e i nomi di configurazione
server già esistenti, senza fallback alla chiave anon. Timeout HTTP 20 secondi.
Nessuna route, scheduler, credenziale o ENV aggiunta/modificata.

Boundary di attivazione: un processo server con connessione PostgreSQL SESSION
dedicata (non il pooler transaction-mode 6543 esistente), login membro del nuovo
ruolo NOLOGIN `artecna_storage_worker`, e il segreto server già previsto
`SUPABASE_SERVICE_ROLE_KEY` insieme a `NEXT_PUBLIC_SUPABASE_URL`. Non è stata
verificata la disponibilità dei segreti nell'ambiente distribuito. La creazione
del ruolo/login operativo e il wiring del processo restano un passo esplicito;
nessuna nuova ENV è indispensabile per il codice preparato. Il ruolo worker
può solo claim/finish, senza accesso diretto alle tabelle del registro.

`consumer_storage_canonico = NO` come stato operativo: implementazione locale
testata, consumer non installato/attivato e nessuna prova su Storage reale.

## TD04 e attribuzioni

`apri_contesto_prerequisiti(uuid,text)` è privata al ruolo tecnico della futura
RPC. Richiede ELIMINA esatto, JWT, owner e lock sulla radice/membership; contesto
vincolato a transazione/backend/utente. Nessun client può aprirlo direttamente.

`detach_contabile_cantiere()` conserva le quote fatturate in
`artecna_contabilita.archivio_quote`, con FK alla riga fattura globale e nuovo
UUID indipendente. Nessun UUID Cantiere, quota operativa o acconto nell'archivio.
Le rettifiche passano alla quota archivio; le provenienze globali
materiali_impresa/spese_impresa rimangono globali. Richiesta/fotografia sono
sanificate ricorsivamente da chiavi e UUID operativi, comprese stringhe annidate.
Rettifiche di altri cantieri non sono selezionate per il solo fatto di condividere
la medesima riga fattura. Ownership discordanti provocano rollback.

I ponti temporanei `quote_da_eliminare` mantengono i totali senza doppio conteggio
prima della cancellazione operativa e vengono rimossi AFTER DELETE. La guardia
totali conta successivamente l'archivio: una quota storica non torna disponibile.
Le eccezioni a nc_immutabile/nc_proteggi_documenti consentono soltanto il delta
esatto di detach, con importi e altri dati invariati. Fingerprint del corpo
precedente obbligatori nelle patch; owner, ACL e configurazione sono conservati.

Le attribuzioni vengono archiviate in `archivio_attribuzioni` con cliente,
importo, verifica e documento globale, poi il collegamento con acconto/Cantiere
è rimosso. Documento originale e cliente sono preservati; classificazioni
Cantiere di fatture emesse/righe fornitori vengono scollegate. Le ricevute
JSON di classificazione vengono sanificate. Non si introduce un cliente
globale duplicato: lo schema esistente conserva il cliente nel documento.
La lettura dell'archivio per documento è disponibile tramite
`public.leggi_archivio_contabile_cantiere(uuid)`, solo al titolare d'impresa
autorizzato dal controllo canonico, indipendentemente dal Cantiere scomparso.

## Legacy

Le 14 sorgenti sono preventivi_cantiere, preventivo_lavorazioni, sal_lavorazioni,
rapportini, foto_cantiere, pagamenti_fornitori, acconti_cantiere,
incassi_non_fatturati, fatture_emesse, fatture_fornitori_righe, memoria_prezzi,
materiali_cantiere, attrezzi_cantiere, timbrature. Memoria prezzi ottiene
`cantiere_id` con FK RESTRICT e indice; il manifest include ora queste righe.

Normalizzazione prima attraverso legami UUID canonici; solo in loro assenza
il nome esatto univoco può assegnare UUID, come autorizzato da questo step.
Omonimi o guardie incompatibili restano `legacy_da_risolvere`; nessun DELETE
usa il nome. Non è dichiarato un numero di record Production normalizzati:
queste migration non sono state installate.

Contratto pubblico: `assegna_legacy_cantiere(tabella,id,cantiere,impronta)`.
Whitelist, fingerprint del record completo, lock, JWT owner e verifica dei
legami canonici. Una risoluzione tra cantieri di owner diversi richiede prima
`approva_risoluzione_legacy(...)`, privata amministrativa e legata a record,
impronta, owner e destinazione; l'owner riceve quei parametri dalla revisione.
Quando tutti i candidati omonimi appartengono allo stesso owner, questi può
risolvere direttamente con l'impronta attuale. Nessuna assegnazione già valida
ad altro Cantiere viene sovrascritta. Retry sulla stessa destinazione idempotente.

## Verifica locale

PostgreSQL nativo 17.6 avviato esclusivamente su loopback, cluster effimeri
separati e dati sintetici. Baseline schema-only derivata dall'export, con
vincoli, trigger e routine reali; auth.users/uid sostituiti da fixture locale.
Non simula l'intero servizio Auth/Storage. Gli OID numerici dei ruoli nelle
policy esportate non vengono inventati: i test verificano JWT/owner/helper,
nuove ACL e RLS, non certificano tutte le vecchie policy Supabase.

Comandi dal worktree:

```text
node --test supabase/validators/cantiere-prerequisiti/prerequisiti.test.cjs supabase/validators/cantiere-prerequisiti/contabilita.test.cjs supabase/validators/cantiere-prerequisiti/worker.test.cjs
node ../../node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node ../../node_modules/eslint/bin/eslint.js app/engines/cantiere-delete/*.ts scripts/*.cjs supabase/validators/cantiere-prerequisiti/*.cjs --rule "@typescript-eslint/no-require-imports: off"
node scripts/check-cantiere-prerequisites.cjs
```

35 test GREEN: guardia 55000 rispettata dalla normalizzazione legacy,
compatibilità DELETE materiali del writer esistente,
riferimenti singoli/multipli/multientità/multicantiere, ultimo
riferimento/residui, oggetti e bucket distinti, duplicati, concorrenza provata
con pg_locks e due connessioni, retry/token/lease/crash, file estranei, deriva
schema e JSON ambiguo, worker con login scoped, detach TD04/economia/materiali,
provenienza globale, rollback completo, immutabilità, archivio leggibile solo
al titolare, attribuzioni e legacy owner/non-owner/manifest. Storage è simulato.
Unit test del trasporto: assenza key, bucket assente, 403/429/503, errore rete,
ordine commit/DELETE/ack e connessione distrutta dopo esito dubbio.

TypeScript e lint delta GREEN; la sola regola require-imports è disabilitata
nel comando per gli script deliberatamente CommonJS. Build completa GREEN,
25 pagine generate. Build offline con font già in cache e segnaposto non
credenziale solo nel processo figlio per un vecchio modulo OpenAI inizializzato
in import; fetch esterni bloccati. Nessun file ENV modificato. Rimane il warning
preesistente Next sui lockfile multipli; lint della build è disabilitato dalla
configurazione esistente ed è stato eseguito separatamente sul delta.

Binari di test esclusi da Git: PostgreSQL 17.6 Windows ufficiale EDB in
`.run/cantiere-prereq-runtime/minimal/pgsql/bin`. Il runner richiede quel runtime;
non scarica nulla né cerca connessioni esterne. Gli script di rigenerazione
richiedono gli export locali ignorati, mentre baseline e migration generate
sono già versionate e bastano ai test. Gli attributi Git preservano i byte dei
corpi SQL estratti: convertirne i newline o rimuoverne gli spazi altererebbe
i fingerprint prosrc usati dalle guardie. La fixture conserva anche due spazi
finali originali del catalogo, esclusi dal solo controllo whitespace di Git.
