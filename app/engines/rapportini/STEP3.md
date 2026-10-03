# Rapportini: servizio STEP 3

STEP 2 e STEP 3 sono applicati al remoto: migration storiche immutabili.
Questo documento descrive STEP 3 originale. Il successivo adattamento locale B,
con backend dedicato e nuova migration additiva, è descritto in [BACKEND_POOLER.md](BACKEND_POOLER.md).
DTO STEP 1 invariati; non riapplicare le migration storiche.

## Contratto e percorso comune

`POST /api/rapportino/strutturato` accetta `RichiestaSalvataggioRapportino`
da `contrattoServizio.ts`: envelope STEP 1 e, facoltativamente, `documento`
con `note`, `materiali`, `quantita_materiali`. Omissione di questi campi conserva
il valore esistente. Campi extra, costi, ore client, compilatore e stati Economia
sono rifiutati, anche dentro le prestazioni.

La sola RPC pubblica di scrittura strutturata è
`public.salva_rapportino_con_prestazioni(jsonb,text)`. L'endpoint comune chiama
questa stessa RPC per entrambi i client; non esiste un writer parziale client.
Il dominio STEP 2 resta interno e INVOKER. La nuova migration lo ridefinisce
per risolvere anche le sessioni portale e distinguere i namespace idempotenza;
non modifica il file STEP 2 installato.

Desktop: Bearer Supabase, inoltrato al gateway PostgREST con anon key; il gateway
verifica il JWT e la guardia esistente verifica l'owner del cantiere.
Mobile: cookie `artecna_rapportino_sessione`, non ID compilatore nel body.
Il backend chiama la RPC con service key e token; il database verifica sessione,
scadenza, revoca, abilitazione operaio e cantiere aperto.

## Sessione e letture

Il login PIN mantiene la risposta operativa precedente. Genera 32 byte casuali
Node, cookie HttpOnly/Secure in produzione/SameSite Strict, durata 8 ore,
path `/api/rapportino`. In DB sono conservati digest SHA-256, operaio, scadenza
e revoca: nessun PIN/token in chiaro. L'ID compilatore deriva dalla sessione.
Abilitazione e sospensione sono ricontrollate a ogni richiesta. La regola
attuale, confermata dal codice, è accesso dei compilatori abilitati a tutti i
cantieri aperti (`lavori_conclusi` false o NULL), senza inventare assegnazioni.

`POST /api/rapportino/varianti` accetta `cantiere_id` e richiede sessione;
restituisce soltanto id, numero, etichetta e selezionabile (stato bozza o proposta).
Non implementa acquisizione Economia né nuove regole commerciali.

### Revisione mirata prima dell'applicazione

Il test E2E in `servizioHttpStep3.test.cjs` esegue gli handler reali contro
PostgreSQL PGlite, con trasporto Supabase simulato e ruoli SQL effettivi. Non
verifica il gateway remoto o la firma dei JWT, e non usa ENV/credenziali reali.

Formato sessione provato end-to-end:

- Node: `randomBytes(32).toString('hex')`, stringa originale di 64 caratteri hex.
- `p_token` del login e valore del cookie: la stessa stringa originale.
- `p_sessione` in verifica/Varianti/writer: ancora la stessa stringa, non digest.
- Tabella: bytea di 32 byte, SHA-256 dei 64 caratteri UTF-8 del token originale.
- Passare il digest hex come cookie fallisce: verrebbe calcolato il digest del digest.

Prove SQL aggiuntive: INSERT con colonna costo omessa passa il NOT NULL perché
il BEFORE INSERT assegna la fotografia; NULL Anagrafica viene rifiutato, zero
accettato, costo esplicito rifiutato. Nessuna modifica al trigger o al vincolo.
La creazione committata viene ritentata con il payload originale (id null):
stessa testata/prestazione/timbratura. Modifiche soltanto a note/materiali/quantità,
singole o insieme, incrementano la revisione una sola volta e il retry non la
incrementa. Sono provate anche lettura/creazione/modifica legacy, rifiuto della
vecchia API su versione 1 e conservazione dei record storici.

**Stati Variante: regola definitiva.** DTO e dominio consentono nuovi collegamenti
e cambi di destinazione soltanto verso Varianti dello stesso cantiere in bozza
o proposta. Approvata, rifiutata e annullata restano visibili nel DTO, con
selezionabile=false. I collegamenti esistenti si conservano quando cambia lo
stato: nessuna modifica automatica della prestazione e modifica orari consentita
senza cambiare destinazione. Anche i retry conservano il collegamento esistente.
Il helper interno SECURITY DEFINER verifica esistenza, cantiere e stato; il lock
FOR SHARE impedisce cambi di stato concorrenti durante un nuovo collegamento.
Il helper non è eseguibile dal browser e non richiede BYPASSRLS al ruolo interno.

**Service key:** il PIN non produce un JWT Supabase authenticated. Le RPC di
login/verifica/Varianti sono eseguibili soltanto dal backend service_role;
il writer mobile passa il token opaco allo stesso servizio completo. Il backend
usa la chiave soltanto per queste quattro RPC. Desktop usa anon key + Bearer JWT.
Il modulo è `server-only`, la variabile non ha prefisso NEXT_PUBLIC e non compare
in risposte o log del servizio. Il ruolo service_role è globalmente privilegiato
e dispone di BYPASSRLS: limitarne le chiamate nel codice non restringe la chiave
all'intero progetto. Il ruolo interno Rapportini resta distinto e NOBYPASSRLS.

La revisione ha riprodotto un'eccezione di trasporto contenente header sensibili
che raggiungeva il logger generico delle API legacy. Le quattro RPC ora passano
da `rpcRapportini`: eccezioni grezze diventano errore TRANSPORT/503 senza dettagli,
mentre gli errori di dominio restano espliciti. Il test verifica risposta e log
senza credenziali. Nessun cambiamento alla migration o alla gestione del token.

La chiave è necessaria per il trasporto PostgREST/ACL attualmente implementato,
non è un requisito intrinseco del dominio. Alternativa con privilegi inferiori:
connessione PostgreSQL soltanto server con un ruolo backend dedicato LOGIN,
NOINHERIT/NOBYPASSRLS e solo EXECUTE sulle quattro funzioni, senza DML sulle
tabelle. Non sarebbe il ruolo interno NOLOGIN. Richiede credenziale, connessione
e adapter server dedicati; desktop potrebbe continuare a usare JWT/PostgREST,
invocando la medesima funzione di dominio. Alternativa soltanto proposta:
nessuna modifica a ENV, ruoli, ACL o architettura in questa revisione.
Documentazione ufficiale: [API keys Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

## Costo e transazione

`costo_orario_interno_storico numeric(10,2) NOT NULL`, senza default, mantiene
esattamente la precisione della fonte certificata `operai.costo_orario`.
Vincolo: finito e non negativo. Trigger alla sola creazione legge e blocca
l'Anagrafica FOR SHARE, assegna la fotografia e rifiuta costi forniti esplicitamente.
NULL produce `Costo orario operaio non valorizzato`; zero intenzionale è valido.
Il trigger impedisce cambiamenti della fotografia anche negli UPDATE diretti.
La creazione non ricostruisce una tariffa passata per date retroattive.

Modifiche orari e rimozione logica conservano la fotografia. Nuove prestazioni
usano il costo corrente. Il totale è `round(sum(ore * storico), 2)` delle sole
prestazioni attive, poi convertito nel campo legacy double precision. Il costo
cliente/Variante è indipendente e non viene modificato.

La singola chiamata SQL comprende autorizzazione, lock richiesta, testata,
revisione aggregata, dominio prestazioni, costo, aggregati, proiezioni e risultato
idempotente. Qualsiasi errore abortisce tutte queste scritture, compreso un errore
nella seconda riga o nell'inserimento delle timbrature. Nessun salvataggio a tappe
nel server TypeScript e nessuna compensazione dopo un commit parziale.

Idempotenza: registro STEP 2 con chiave `(canale, utente_id, richiesta_id)`;
hash del payload originale completo, incluso documento. Un retry autorizzato
identico restituisce l'esito originario prima del controllo revisione, senza
ricreare proiezioni. Payload diverso: PR409. `chiave_client` resta stabile e
univoca nel Rapportino; non deduplica per operaio.

`revisione_attesa` protegge tutto il Rapportino sotto FOR UPDATE; anche modifiche
del solo documento incrementano la revisione. PR412 segnala un conflitto.
La revisione riga è una traccia, non un token di concorrenza indipendente.

Aggregati: ore = somma ore attive, numero_presenti = operai distinti,
ore_per_operaio = media delle ore totali per operaio distinto (zero senza presenti),
operai = riepilogo dei nomi/intervalli/ore calcolati sul server.

Timbrature `da rapportino`: ricreate nella stessa transazione e collegate
all'UUID prestazione; indice unico sul riferimento nullable, stato obbligatorio,
nessun backfill e nessuna nuova FK sui riferimenti legacy operaio/rapportino.
Il conteggio contabile esistente attribuisce zero costo aggiuntivo alle proiezioni.

## Privilegi e compatibilità

Owner funzioni postgres per creazione: nessun ALTER OWNER, SET ROLE o nuova
membership nell'installazione. search_path fisso pg_catalog,pg_temp, riferimenti
qualificati. Funzioni pubbliche complete/sessione e guardie necessarie DEFINER;
dominio e protezioni dei percorsi legacy INVOKER. Tutti gli helper privati non
sono eseguibili da anon/authenticated. Il ruolo interno resta NOLOGIN,
NOINHERIT, NOBYPASSRLS e senza membership client.

Sessioni private con RLS e nessuna policy client; nuove tabelle strutturate
senza SELECT/DML client. EXECUTE writer completo: authenticated/service_role;
RPC PIN/verifica sessione/Varianti: solo service_role. Niente writer anon.
Post-check verifica ACL, owner, modalità, search_path e flags del ruolo.

Le UI restano immutate. `/salva` e `/stato` restano temporaneamente LEGACY,
richiedono la nuova sessione e rifiutano documenti strutturati; non scrivono
prestazioni. Le guardie DB impediscono anche UPDATE/DELETE diretti legacy su
testate strutturate e INSERT/UPDATE/DELETE delle relative proiezioni.
Rapportini versione 0 non vengono convertiti dal servizio nuovo.

A regime le UI desktop/mobile verranno migrate sullo stesso endpoint e i
percorsi legacy di scrittura verranno dismessi. Le guardie acquisizione Economia
saranno aggiunte nel dominio e nei trigger nello STEP 6 (stesso lock testata),
non soltanto nell'HTTP: vietate rimozione/disattivazione/cambio Variante acquisita;
orari modificabili con UUID conservato e divergenza dalla revisione acquisita.

## Applicazione futura manuale

1. Confermare STEP 2 presente, zero prestazioni e registro richieste vuoto.
   Non riapplicare STEP 2; richieste già presenti richiedono verifica preventiva
   della compatibilità dei risultati, senza conversioni automatiche.
2. Controllare i tipi delle colonne elencate nel preflight STEP 3 sul remoto;
   schema diverso interrompe la transazione, non viene adattato automaticamente.
3. Predisporre `SUPABASE_SERVICE_ROLE_KEY` esclusivamente negli environment server,
   mai con prefisso NEXT_PUBLIC. Nell'ambiente locale verificato manca: accesso
   portale restituisce 503 finché non viene configurata. Non è stata aggiunta.
4. Nel SQL Editor come postgres eseguire **una sola volta, integralmente**
   `supabase/migrations/20261003_rapportino_servizio_step3.sql`, inclusi BEGIN,
   preflight, post-check e COMMIT. Non eseguire singoli blocchi. Se fallisce,
   conservare l'errore e verificare rollback prima di intervenire.
5. Verificare digest sessioni/RLS, costo NOT NULL, ruolo interno non assumibile,
   assenza DML client ed EXECUTE degli helper, presenza del solo writer completo.
   Verificare zero prestazioni e storico invariato prima di smoke test.
6. Pubblicare il server insieme alla configurazione dopo l'applicazione SQL.
   Gli accessi precedenti richiedono un nuovo login PIN; la sessione dura 8 ore.
   Non attivare le UI strutturate prima dei rispettivi step.

Verifica colonne senza leggere PIN o altri dati:

```sql
SELECT c.relname AS tabella, a.attname AS colonna,
       format_type(a.atttypid,a.atttypmod) AS tipo
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
  ('operai','cantieri','rapportini','timbrature')
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY c.relname,a.attnum;
```

Test SQL con runtime PGlite già disponibile in TEMP, senza dipendenze nuove:

```powershell
$env:NODE_PATH = Join-Path $env:TEMP 'artecna-economia-sql-check\node_modules'
node --test app/engines/rapportini/servizioStep3.test.cjs app/engines/rapportini/servizioHttpStep3.test.cjs app/engines/rapportini/prestazioniStep2.test.cjs app/engines/economia/contabilitaManodopera.test.cjs app/engines/economia/riconciliaProposteEconomia.test.cjs
node (Join-Path $env:TEMP 'artecna-economia-sql-check\local-test.cjs')
npm run build
git diff --check
git status --short
```
