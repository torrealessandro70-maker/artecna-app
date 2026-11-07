# Storage cleanup: runtime locale pronto alla configurazione

Parent: `de10f2035c9e1d8fd43bfd1bde02de006518130b`.
Stato: `consumer_storage_canonico = READY_FOR_CONFIGURATION`.
Nessun accesso Production, migration remota, ENV reale modificata, push o deploy.
RPC finale hard-delete e UI ELIMINA restano invariate. Questo documento aggiorna
il boundary operativo descritto nel precedente rapporto prerequisiti.

## Capability e login

La settima migration `20261107000700_storage_worker_login.sql` mantiene
`artecna_storage_worker` NOLOGIN e crea il distinto
`artecna_storage_worker_login`: LOGIN, INHERIT, NOSUPERUSER, NOCREATEDB,
NOCREATEROLE, NOREPLICATION, NOBYPASSRLS. L'unica membership concessa è quella
del ruolo tecnico, con INHERIT TRUE, SET FALSE e nessuna admin option.
Nessuna password nella migration; su una nuova installazione il login non può
autenticarsi via password finché un amministratore non ne imposta una.
Un'esecuzione successiva preserva la password già configurata.

La migration è idempotente. Membership inattese, admin option, ownership o
privilegi diretti già assegnati al login provocano rollback e revisione manuale.
Non revoca né amplia le ACL delle capability preesistenti. Il login eredita
soltanto USAGE dello schema privato ed EXECUTE delle capability worker;
nessun accesso applicativo diretto viene concesso. Rimangono applicabili i
privilegi PUBLIC generali del database, come per qualsiasi login.

La nuova `storage_verifica_job(bigint,uuid)` è SECURITY DEFINER, con search_path
fisso, EXECUTE solo al ruolo tecnico. Verifica membership, token, backend,
lease non scaduto, zero riferimenti vivi, autorizzazione cleanup, stato
cancellazione e possesso del lock canonico. Non espone il registro al login.

## Connessione dedicata

Il solo nome DSN accettato è `STORAGE_CLEANUP_DATABASE_URL`; nessun fallback
su RAPPORTINI_DATABASE_URL o variabili PG globali. Driver `pg.Client`, uno
per invocazione, mantenuto per tutto il batch e chiuso in finally. Nessun
pool condiviso, query REST o cambio di ruolo fra le fasi.

In configurazione distribuita il parser richiede host Session Pooler Supabase
fornito dal Dashboard, porta 5432, database postgres, username
`artecna_storage_worker_login.axuiaiglbahygsmeoypy`, password non vuota e TLS
con verifica CA/hostname. Non contiene host o password hardcoded. La CA
pubblica viene riusata dall'adapter Rapportini esistente. I parametri URL non
possono sostituire le opzioni TLS del driver. Porta 6543 e DSN di altro tipo
vengono rifiutate prima di aprire la connessione.

L'handshake verifica identità effettiva, ereditarietà della capability e relativi
permessi EXECUTE. In BEGIN prende un advisory lock casuale di sessione e legge
pg_backend_pid(); dopo COMMIT verifica stesso PID e lock ancora posseduto,
poi rilascia il lock di prova. Se una verifica fallisce chiude la connessione
senza claim o HTTP Storage. Non si deduce la modalità SESSION dalla sola porta:
serve anche che l'endpoint configurato sia realmente quello Session del
Dashboard. Il probe conferma la continuità osservata, non può certificare
l'intera configurazione futura di un proxy esterno.

Il claim canonico mantiene l'advisory lock dell'oggetto dopo COMMIT. Prima
di HTTP e prima dell'ack si verifica sulla stessa connessione PID più
`storage_verifica_job`. I riferimenti concorrenti prendono il medesimo lock;
dopo la decisione di cleanup trovano il tombstone e vengono rifiutati.
Il tombstone è permanente anche in caso di perdita sessione o lease scaduto.
Un crash dopo DELETE può richiedere una successiva DELETE idempotente della
stessa identità: nessuna promessa exactly-once attraverso un crash di rete.

## Entrypoint e invocazione

Route `POST /api/internal/storage-cleanup`, runtime Node.js, maxDuration 60s.
Tutti e quattro i moduli engine e la route importano server-only. Nessuna
configurazione cron/Vercel aggiunta. È pronta per invocazione amministrativa
server-to-server; un eventuale scheduler futuro deve invocare questa stessa
route con le medesime protezioni, senza creare un worker parallelo.

Autenticazione: header Authorization Bearer corrispondente alla
`SUPABASE_SERVICE_ROLE_KEY` già prevista dal server, confrontato tramite hash
e timingSafeEqual. Nessuna autenticazione anonima o tramite cookie/browser.
Chi invoca deve custodire questa credenziale server-side: non è un contratto
per il frontend. Non è stata introdotta un'ulteriore ENV di autenticazione.
Le risposte sono no-store, senza credenziali, DSN, dettagli driver o identità
degli oggetti. Nessun log di errori grezzi o configurazioni.

Parametri esclusivamente nella query string; body non letto:

- `?mode=gate`: default, handshake e chiusura senza claim, Storage o scritture
  applicative; prende e rilascia soltanto il lock di prova.
- `?mode=run&limit=1`: batch di cleanup.
- limit default 1, massimo rigido 2; valori, modalità, parametri extra o
  duplicati non validi ricevono 400.

401 per bearer assente/errato; 503 per configurazione, sessione o esecuzione
non disponibile, con messaggio statico. 200 contiene SESSION_OK e gli esiti
aggregati idle/completed/retry/failed. Un errore dopo un job completato non
annulla quel job: la successiva invocazione riprende dall'outbox.

Le ENV usate sono soltanto STORAGE_CLEANUP_DATABASE_URL,
NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Per Storage si riusa
il remover server-side precedente e il client Supabase; nessun segreto entra
nel bundle client. Il gate non richiede né prova una DELETE Storage reale.

## Budget, lease e recupero

Un job alla volta sulla stessa sessione. Budget invocazione 45s; nessun nuovo
claim se restano meno di 32s. Un timer chiude comunque la sessione al budget;
le chiamate Storage hanno timeout/abort proprio a 20s, le query e la connessione
DB timeout a 5s. Il margine rispetto ai 60s runtime permette chiusura e risposta;
una terminazione forzata del processo resta recuperabile tramite lease.

Lease canonico invariato: 2 minuti. Alla scadenza, il successivo worker può
riprendere solo dopo aver ottenuto il lock. Se esistono riferimenti il file
rimane intatto. Errori temporanei hanno retry con backoff, permanenti restano
failed; oggetto già assente è successo solo secondo il contratto del remover.
Sessione persa prima di HTTP impedisce DELETE; persa dopo DELETE impedisce ack,
lascia lease recuperabile e key definitivamente non riutilizzabile.

## Verifiche locali

PostgreSQL nativo 17.6 diretto su loopback con login reale dedicato e Storage
fake controllato. L'iniezione del Client/config locale è disponibile nei test;
l'entrypoint distribuita usa esclusivamente il parser DSN rigoroso.

49 test GREEN, suite precedenti più suite sessione: membership/ereditarietà, revoca membership,
assenza privilegi applicativi, idempotenza migration, stesso PID e lock oltre
COMMIT e operazione HTTP, rilascio lock alla chiusura, due worker, writer
concorrente, tombstone, riferimenti multipli/residui, duplicati, retry,
permanent failure, file assente, crash dopo DELETE, lease scaduto, perdita
sessione, 6543 e ENV assente, timeout, deadline e assenza segreti nei log/risposte.

Comandi:

```text
node --test supabase/validators/cantiere-prerequisiti/*.test.cjs
node ../../node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node ../../node_modules/eslint/bin/eslint.js app/engines/cantiere-delete/*.ts app/api/internal/storage-cleanup/route.ts supabase/validators/cantiere-prerequisiti/*.cjs scripts/check-storage-client-boundary.cjs --rule "@typescript-eslint/no-require-imports: off" --max-warnings 0
node scripts/check-cantiere-prerequisites.cjs
node scripts/check-storage-client-boundary.cjs
```

Build completa offline con le stesse condizioni documentate nel parent:
font in cache, segnaposto SDK non credenziale solo nel processo figlio e rete
esterna bloccata. Nessun ENV reale toccato. Il controllo post-build ispeziona
tutti i chunk client e richiede assenza dei marker del nuovo codice server.
Le guide Next locali richieste da AGENTS non sono presenti in questa versione
installata; consultate le guide ufficiali Route Handlers e Route Segment Config:
https://nextjs.org/docs/app/api-reference/file-conventions/route
https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config

Quality gate finale GREEN: 49/49 test; TypeScript senza errori; lint delta
senza errori o warning; build completa con 26 pagine generate; 51 chunk client
ispezionati senza marker worker. Rimane il warning Next preesistente sui
lockfile multipli. Nessuna richiesta Storage reale è stata effettuata.

## Operazioni Production ancora necessarie, non eseguite

Prerequisito di ordine: le sei migration del parent devono essere installate
nel futuro rilascio coordinato autorizzato; questo step non le ha installate.
Esse non vanno distribuite autonomamente dalla futura integrazione hard-delete
descritta nel rapporto precedente. Nessuna dichiarazione di hard delete completo.

1. Applicare la migration del login dopo i prerequisiti.
2. Assegnare password forte a artecna_storage_worker_login tramite procedura
   amministrativa sicura; non salvarla nel repository o nella cronologia shell.
3. Ottenere dal Dashboard Supabase la stringa Session pooler, porta 5432.
4. Costruire/impostare STORAGE_CLEANUP_DATABASE_URL nell'ambiente server.
5. Verificare SUPABASE_SERVICE_ROLE_KEY nell'ambiente server.
6. Eseguire il gate di connessione NON distruttivo della route autorizzata
   distribuita nel successivo rilascio approvato.
7. Solo dopo il gate operativo e la verifica della configurazione Storage
   dichiarare consumer_storage_canonico = YES.

Fino ad allora: consumer_storage_canonico = READY_FOR_CONFIGURATION.
