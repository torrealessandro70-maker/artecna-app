# Rapportini: backend dedicato dopo STEP 3

STEP 2 e STEP 3 sono già applicati e immutabili. Non riapplicarli. L'adattamento
usa soltanto `20261003_rapportino_backend_pooler.sql`, senza backfill o UI/DTO.

## Architettura e guardia

Portale: browser → API Next.js Node.js → pg → Supavisor Transaction Pooler →
quattro funzioni pubbliche STEP 3 → dominio privato. Desktop: JWT utente →
PostgREST → lo stesso writer `salva_rapportino_con_prestazioni(jsonb,text)`.

La guardia del writer usa session_user, il LOGIN originale conservato dentro
SECURITY DEFINER (current_user sarebbe postgres). Per il backend p_sessione
NULL/formato errato è rifiutato prima di envelope/idempotenza. Il validatore
STEP 3 verifica poi token, digest, scadenza, revoca, operaio e cantiere.
Claim JWT/GUC owner non possono sostituire la sessione obbligatoria.

L'adapter invoca le funzioni solo se session_user/current_user sono entrambi
artecna_rapportini_backend. Se Supavisor non conserva questa identità, fallisce
senza invocare la funzione. Non aggirare con SET ROLE o login amministrativo.
Questa condizione deve essere provata sulla connessione reale prima del deploy.

La migration dichiara il corpo completo e deterministico con CREATE OR REPLACE,
aggiungendo soltanto la guardia. Preflight su firma/default/RETURNS/linguaggio,
owner, SECURITY DEFINER, search_path, PUBLIC e SHA256 del corpo STEP 3 atteso
(normalizzati soltanto CRLF → LF):
`d82761225d035ef22ba09050098823d463c86437b448aa431dbd56f0049f44a8`.
Il catalogo è letto soltanto per verificare la versione, mai per costruire o
patchare il writer. CREATE OR REPLACE mantiene ACL/default. Il test confronta
il corpo prima/dopo tolta la guardia; versione ignota → errore e rollback.
Nessun trasferimento ownership e nessun requisito SET ROLE verso il nuovo ruolo.

## Privilegi e transizione

LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE,
NOREPLICATION. Nessuna membership del backend; postgres può ricevere la
membership amministrativa automatica del ruolo creato. Ruolo interno invariato.

Grant applicativi nuovi: CONNECT postgres, USAGE public, EXECUTE soltanto su:

- crea_sessione_rapportino(text,text);
- verifica_sessione_rapportino(text,uuid);
- varianti_rapportino_portale(text,uuid);
- salva_rapportino_con_prestazioni(jsonb,text).

Nessun grant CREATE, tabelle/colonne, sequenze, schema privato o helper.
Post-check: attributi/membership, ACL effettive, sequenze/colonne, grant diretti
funzioni, DEFINER ulteriori, owner/search_path/RLS e writer authenticated/anon.

"Solo quattro RPC" riguarda i grant applicativi introdotti, non ogni capacità
PostgreSQL. Eccezioni PUBLIC certificate che rimangono:

- CONNECT/TEMP database e USAGE public, senza CREATE;
- EXECUTE public.rls_auto_enable(), funzione event-trigger preesistente;
- SELECT extensions.pg_stat_statements/pg_stat_statements_info se lo schema è
  accessibile, oltre alle normali capacità PostgreSQL di sistema/PUBLIC.

Non esiste DENY per ruolo: REVOKE TEMP al solo backend non neutralizza PUBLIC.
Non modifichiamo ACL PUBLIC globali né rls_auto_enable(). Nessuna membership
nei ruoli legacy: i loro grant CRUD non vengono ricevuti dal nuovo ruolo.

I quattro grant service_role restano temporaneamente per il deploy precedente.
Nel repository il loro unico chiamante applicativo era servizioRapportini.server.ts;
ciò non dimostra assenza di consumer esterni/vecchie istanze. Revoca separata
dopo provisioning, prova pooler, deploy e controllo utilizzi. Nessuna modifica
globale di service_role o delle ACL legacy.

## Adapter e dipendenze

adapterPortalePostgres.server.ts è server-only; pool lazy a livello modulo.
Una sola ENV privata RAPPORTINI_DATABASE_URL. Nessun fallback service-role/anon
nel portale; desktop continua con supabase-js e JWT utente.

pg: max 3 connessioni per istanza, idle 5 s, connect 10 s, risposta 25 s;
TLS con verifica certificato/hostname. URL viene separata in parametri per
evitare override sslmode. Ruolo/host/porta/database/TLS errati sono rifiutati.
La CA pubblica `prod-ca-2021.crt` verificata dal Dashboard è esportata come PEM
da `caSupabase.server.ts` (server-only), importato staticamente dall'adapter.
Il Pool riceve `ssl: { ca: CA_SUPABASE, rejectUnauthorized: true }`; nessun
override di checkServerIdentity, nessuna lettura filesystem runtime, nessuna
nuova ENV. Il modulo è incluso nei chunk server da Next.js; non dipende da
percorsi Windows/Dropbox o file presenti nella macchina Vercel.
Subject e issuer: C=US, ST=Delware, L=New Castle, O=Supabase Inc,
CN=Supabase Root 2021 CA. CA X.509 autofirmata; nessuna private key.
Validità UTC: 2021-04-28 10:56:53 / 2031-04-26 10:56:53.
Fingerprint SHA-256 del certificato DER:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
Prima della scadenza o di una rotazione Supabase, aggiornare solo dopo verifica
del nuovo certificato Dashboard e dei test TLS; non disabilitare la verifica.
RAPPORTINI_DATABASE_URL non richiede sslmode; usare la forma senza query string:
`postgresql://artecna_rapportini_backend.axuiaiglbahygsmeoypy:<PASSWORD_PERCENT_ENCODED>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`.
Il placeholder non è una password reale. Percent-encodare solo la password.
Query parametrizzate da elenco statico, senza prepared statement nominati.
Timeout ruolo: statement 20 s, lock 5 s, idle transaction 10 s. Verificarli
sulla connessione reale. Non si usa stato sessione per l'identità applicativa.
In caso di risposta persa dopo commit, ritentare con stesso richiesta_id/payload.

@vercel/functions attachDatabasePool gestisce il ciclo delle connessioni prima
della sospensione Fluid Compute; compatibile con pg/Node.js. @types/pg è solo
di sviluppo. Pool per istanza, non globale al deploy: dimensionare concorrenza
e limiti Supavisor prima di aumentare traffico. Nessuna nuova variante Edge.

URL/password/token/query/errori driver non vengono loggati o restituiti.
503 per trasporto; messaggi SQL statici, conservando errore costo orario NULL
e codici conflitto. Cookie HttpOnly/Secure/Strict e digest SHA256 invariati.

## Procedura futura manuale

Stato certificato dall'utente: migration backend già applicata, password SCRAM
già provisionata, prova reale Supavisor GREEN con entrambe le identità backend,
timeout 20s/5s/10s e ACL negative verificate. I punti 1–3 sotto documentano
l'installazione storica: NON ripeterli su questo remoto.
Prossimo passo separato: configurare la sola URL come Secret/Sensitive in Vercel
Settings → Environment Variables, solo Preview sul ramo autorizzato; lasciare
Production/Development e le altre ENV invariati. Nuovo deployment con codice
aggiornato, poi PIN/cookie/sessione/stato/Varianti prima del writer di prova.
Il login crea una sessione; Preview usa comunque il database reale. Writer e
retry identico soltanto su dati controllati, poi verifica read-only dei conteggi
e prova desktop. Nessun deploy o ENV reale modificati nel micro-step TLS.

1. Applicare integralmente soltanto la nuova migration come postgres nel SQL
   Editor. CREATE ROLE LOGIN senza password è valido: nessuna autenticazione
   password del ruolo può riuscire prima del provisioning. Errore → rollback;
   non applicare frammenti né riapplicare le migration storiche.
2. Provisionare privatamente con psql da terminale amministrativo fidato, usando
   parametri separati e `-W` per il prompt password amministrativa. Non usare
   URL con password, shell history, PGPASSWORD, SQL Editor, registrazioni del
   terminale, Git o chat. Comando senza segreti:

   ```text
   psql "host=aws-0-eu-west-1.pooler.supabase.com port=6543 dbname=postgres user=postgres.axuiaiglbahygsmeoypy sslmode=verify-full" -W
   ```

   Nel prompt psql:

   ```text
   SHOW password_encryption;
   \password artecna_rapportini_backend
   ```

   Deve essere SCRAM-SHA-256; se necessario impostarlo nella sola sessione
   amministrativa. `\password` chiede il segreto due volte senza eco, evitando
   password in chiaro in history/log SQL. Conservare nel password manager;
   usare lo stesso metodo per ruotarlo. Non inserire password nella migration.
3. Provare la connessione privata con TLS verify-full e password da prompt:

   ```text
   host: aws-0-eu-west-1.pooler.supabase.com
   port: 6543
   database: postgres
   modalità: Supavisor Transaction Pooler
   username candidato: artecna_rapportini_backend.axuiaiglbahygsmeoypy
   ```

   ```text
   psql "host=aws-0-eu-west-1.pooler.supabase.com port=6543 dbname=postgres user=artecna_rapportini_backend.axuiaiglbahygsmeoypy sslmode=verify-full" -W
   ```

   Formato custom role documentato, ma username e session_user non certificati
   finché la prova reale non riesce. Non condividere la connection string.

   ```sql
   SELECT session_user, current_user;
   SHOW statement_timeout;
   SHOW lock_timeout;
   SHOW idle_in_transaction_session_timeout;
   SELECT has_schema_privilege(current_user,'artecna_rapportini','USAGE');
   ```

   Attesi: entrambi backend, timeout configurati, USAGE privato false.
   Verificare EXECUTE delle quattro RPC con has_function_privilege e ACL
   negative. La prova connessione non deve creare Rapportini di produzione.
4. Configurare privatamente RAPPORTINI_DATABASE_URL nelle ENV Vercel autorizzate,
   password percent-encoded, parametri reali. Mai NEXT_PUBLIC_ o preview non
   autorizzati. Nessuna ENV reale è modificata da questo intervento locale.
5. Deploy autorizzato separatamente; verificare login/sessione/Varianti,
   writer/retry su dati di prova, desktop JWT e assenza segreti nei log.
6. Dopo passaggio completo e verifica consumer, revocare SOLO EXECUTE delle
   quattro RPC da service_role. Verificare has_function_privilege=false e
   ripetere test portale/desktop. Rimuovere la service-role ENV soltanto se
   nessun altro modulo ne dipende. Questa migration non esegue la revoca.

## Test e limiti

backendPooler.test.cjs applica le tre migration in PGlite PostgreSQL isolato:
ACL, SET ROLE negati, session_user backend, canale, costo, retry, rollback e
desktop/legacy. SET SESSION AUTHORIZATION simula il LOGIN; nessun handshake
password/TLS o Supavisor reale. Il runner iniziale è amministrativo: non è una
prova dell'autenticazione di rete o del cambio SESSION AUTHORIZATION di un login
iniziale non privilegiato. servizioHttpStep3.test.cjs esegue adapter/handler
reali con socket pg simulato e SQL reale: PIN → cookie → digest → verifica →
writer/retry → legacy, pool/parametri/TLS configurato e sanitizzazione.
Prova pooler e JWT PostgREST reali restano verifiche manuali prima del deploy.
TLS: servizioHttpStep3.test.cjs verifica PEM, CA, firma/fingerprint/scadenza,
assenza private key, ssl.ca/rejectUnauthorized e hostname standard invariato.
Dopo `npm run build`, `node --test app/engines/rapportini/tlsBundle.test.cjs`
verifica la CA effettivamente inclusa nelle cinque route server e assente dai
chunk browser. Non è una prova handshake Vercel: quella resta nel Preview.

Riferimenti ufficiali:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://vercel.com/kb/guide/connection-pooling-with-functions
- https://node-postgres.com/features/ssl
- https://node-postgres.com/features/queries
- https://www.postgresql.org/docs/current/app-psql.html
