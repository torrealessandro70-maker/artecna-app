# Foto Rapportini F3C3 protezione delle proiezioni

F3C3 è preparato esclusivamente in locale. F3C1 Production applicato e F3C2
GREEN restano il checkpoint dichiarato e documentato dall'audit acquisito.
`rapportini-v1` resta assente. Applicazione Production: NO-GO operativo finché
non sono risolti o esplicitamente accettati i conflitti legacy descritti sotto.

## Migration e baseline

`supabase/migrations/20261007_f3c3_foto_v1_proiezione.sql` è nuova e autonoma.
Le migration storiche, F2 e U2.0B restano intatte. La fixture
`f3c3Production.fixture.json` conserva i cataloghi e i corpi Production acquisiti.

La transazione imposta lock timeout di 3 secondi e statement/idle timeout di
30 secondi. Blocca prima cantieri e Rapportini in SHARE, poi registro e foto in
ACCESS EXCLUSIVE. Nessun retry silenzioso: divergenza o timeout richiedono rollback
e una nuova valutazione. Si richiede LOGIN e ruolo corrente `postgres`.

Il preflight confronta esattamente owner, RLS/force RLS, 16 colonne foto, default,
ACL tabella/colonna, vincoli, indici e trigger della baseline; confronta anche il
registro Allegati e metadata/ACL/hash delle tre funzioni coinvolte. Normalizza
soltanto CRLF in LF e rifiuta CR isolati. I nomi/OID dei trigger RI generati da
PostgreSQL variano fra database: si confrontano vincolo, funzione, enabled e
deferrability. Nessuna equivalenza semantica arbitraria dei predicati.

## Marker backfill e reciprocità

`allegato_v1_id uuid NULL` non ha default. UNIQUE ammette molte V0 con NULL;
FK verso `artecna_rapportini.allegati(id)` usa DELETE RESTRICT e UPDATE NO ACTION.
Solo il riferimento `allegati.foto_cantiere_id` determina il backfill. Si cambia
esclusivamente il marker; una singola incoerenza annulla l'intera transazione.
Il caso zero proiezioni non modifica dati.

Due constraint trigger AFTER INSERT/UPDATE/DELETE, DEFERRABLE INITIALLY DEFERRED,
verificano reciprocità, contesto e campi canonici. Prenotato, scaduto e cancellato
non hanno proiezione; finalizzato la richiede; pending conserva la presenza
abbinata di foto e finalized_at, oppure conserva la loro assenza se cancellato
prima della finalizzazione. Le CHECK storiche restano attive. Pending non concede
alcuna cancellazione fisica. Un futuro cleanup necessita di un protocollo
separato, perché la guardia nega anche la DELETE amministrativa ordinaria V1.

## Writer e guardie

`crea_proiezione_foto_v1(uuid,uuid)` è SECURITY DEFINER, owner
`artecna_foto_v1_writer` NOLOGIN/NOINHERIT. Riceve soltanto ID Allegato e lease;
deriva ogni campo dal registro e dal contesto. Non accetta URL, bucket o path.
Il ruolo non ha DML su foto o registro. Solo il definer finale `postgres` può
invocare l'ingresso; il LOGIN backend non ha EXECUTE diretto.

L'inseritore privato owner postgres crea una capability monouso nella tabella
privata `f3c3_capability`, legata a LOGIN backend, xid8, PID, ID foto e ID Allegato.
La guardia INSERT la consuma e il writer verifica il consumo. GUC, flag e nome
della funzione chiamante non autorizzano. Le nuove funzioni hanno search_path
`pg_catalog, pg_temp`; default grants vengono neutralizzati per ogni grantee.

Le guardie negano INSERT marker senza capability, qualsiasi UPDATE/DELETE di
una riga marcata o referenziata e assegnazione/rimozione/sostituzione marker.
V0 resta modificabile. TRUNCATE è negato quando esistono proiezioni V1; i vincoli
FK possono richiedere il comando con entrambe le tabelle anche senza V1.

Nessuna membership browser. PostgreSQL 17 può creare il grant ADMIN del provider
al creatore postgres: viene ammesso soltanto se privo di SET e INHERIT. I grant
SET temporanei dell'installer vengono revocati. Un amministratore postgres con
ADMIN può attribuirsi nuovi permessi; è un'identità amministrativa fidata.

Owner della tabella e superuser possono disabilitare/drop trigger o alterare
funzioni e vincoli. Superuser e identità autorizzate a cambiare
`session_replication_role` possono disabilitare l'esecuzione dei trigger normali.
Le guardie non garantiscono integrità contro queste azioni amministrative.
`anon`, `authenticated` e `service_role` non ricevono tali capacità da F3C3;
BYPASSRLS da solo non bypassa i trigger.

## Finalizzazione resolver e ACL

La nuova migration sostituisce solamente l'INSERT diretto della finalizzazione
Mobile con la chiamata al writer e aggiunge la verifica marker al retry.
Sessione, autorizzazione, cantiere aperto, ordine lock, lease/scadenze, errori,
JSON e metadata/ACL restano invariati. Il resolver aggiunge solo la verifica
marker; non amplia il DTO. Cancellazione e altre RPC vengono confrontate prima
e dopo e restano identiche.

ACL foto e delle 16 colonne preesistenti, incluso UPDATE(cantiere_id) del ruolo
di cancellazione cantiere, restano esattamente uguali; RLS resta false.
Nessun grant esplicito sul marker. I grant tabella legacy si estendono anche alla
nuova colonna: non è corretto dichiarare che il browser non abbia UPDATE a
livello ACL. La manipolazione viene impedita dalla guardia DB, verificata con
anon/authenticated/service_role. Non si revocano globalmente le ACL legacy.

Il post-check verifica vincoli/trigger, dati preesistenti, reciprocità, metadata
e hash RPC, corpi dei sei helper, EXECUTE effettivo, ACL schema e tabelle,
privilegi/membership writer e capability privata/vuota. Schema, RLS, ACL,
policy e bucket Storage vengono confrontati con lo snapshot iniziale.

## Fingerprint intenzionali

SHA-256 del prosrc UTF8 con sola normalizzazione CRLF in LF:

| Funzione | Prima | Dopo |
| --- | --- | --- |
| finalizza_allegato_rapportino_portale | `d74ede6c91552f15ff3c5f0d2fbc4c1cd7ff953a19c44dce4b45a52e2b84fdd8` | `fbd491fe3adb0d7ac680ed8364fba041dafdf4b96bade7760b827fafb46c58c1` |
| accesso_allegato_finalizzato | `5b18982a90d493080fed1b496330b80b48f7ff3853f51e93928f12b2b3ed0d02` | `627df2345e6e7e3c5e11bf8eb4f908cfdaaecdcc1c36b98869cab653b3c94b1b` |
| cancella_allegato_rapportino_portale | `e42cf72a822d8e066b08db13ade38107d1d06ae3e9d8cad4547e60c596a7f68a` | identico |

## Conflitti legacy e gate Production

Un singolo UPDATE/DELETE V0+V1 fallisce integralmente. Non vengono filtrate V0
silenziosamente. Il test PostgreSQL riproduce questi statement reali:

| Percorso | Riferimento | Effetto con V1 |
| --- | --- | --- |
| Rinomina cantiere | app/page.tsx:7154 | UPDATE per nome bloccato; precedenti scritture applicative su altre tabelle non appartengono alla stessa transazione |
| Elimina Rapportino | app/page.tsx:8339 | scollegamento per rapportino_id bloccato prima della DELETE Rapportino |
| Categoria multipla | app/page.tsx:8400 | UPDATE per lista ID bloccato integralmente se comprende V1 |
| Categoria galleria | app/components/FotoCantiereGallery.tsx:268 | UPDATE della singola V1 bloccato; UI aggiorna stato locale prima della risposta |
| Cancella cantiere | supabase/migrations/20261001_elimina_cantiere_definitivamente.sql:1093 | DELETE foto per cantiere bloccata; la RPC completa non viene modificata |
| Cancella foto | app/page.tsx:8257 e 8311 | DELETE V1 bloccata |
| Elimina selezionate galleria | app/components/FotoCantiereGallery.tsx:45 | loop di DELETE singole: V0 possono già essere eliminate prima dell'errore V1; non è un unico batch SQL atomico |

Il test registra il conflitto senza correggere applicazione o migration legacy.
Serve una decisione separata sui flussi di rinomina/cancellazione e sulla UI V1
prima del GO operativo. Nessun GO per bucket o upload deriva da questi test.

## Verifiche e limiti

La suite F3C3 usa cluster nativi PostgreSQL 17.6 temporanei localhost con installer
postgres non-superuser. Copre baseline e mismatch, zero/backfill/pending,
ambiguity impedita dalla UNIQUE storica, contesto/campi incoerenti, rollback
anche post-check, default grants ostili, marker falsificato, batch atomici,
TRUNCATE/FK, reciprocità deferred, Mobile/retry/concorrenza, lease/sessione,
EXECUTE/ruoli/capability, GUC e funzione indiretta.

Risultati verificati: suite nativa F3C3 finale 34/34, inclusa installazione
della migration interamente CRLF; callback legacy 3/3. git diff --check e
controllo whitespace dei cinque file nuovi tramite diff no-index sono passati.

Le 1.315 regressioni esistenti in app sono passate, comprese Allegati,
Rapportini V0/V1/V2, Mobile, U2.0B, F2 e F3C1; photo-storage/documenti/PDF
generale sono inclusi. Tre test mirati eseguono le callback reali di galleria
V0 e sopralluoghi con trasporto finto e generano un PDF fotografico con jsPDF
reale e PNG valido. La fase DELETE foto della cancellazione cantiere è provata
con il ruolo reale previsto; non si certifica la RPC completa installata insieme
a F3C3 su tutte le tabelle Production.

TypeScript noEmit e npm run build sono passati. Il primo build sandbox era
bloccato da EPERM nella directory generata .next; il build locale autorizzato
fuori sandbox è riuscito. Nessuna prova Storage API/PostgREST/browser end-to-end.
Production attuale e quantità/backfill delle sue righe non vengono interrogati.
Il preflight sarà il gate definitivo contro eventuale drift dalla baseline.

Rollback prima di COMMIT annulla schema, marker/backfill, ruolo, ACL e funzioni.
Dopo COMMIT non esiste rollback automatico: un eventuale downgrade va progettato
separatamente, fermando i writer e verificando nuove proiezioni/dati e fingerprint.

Nessun bucket, ENV, upload/download, cleanup F3D, commit, push, deploy o remoto.

## Aggiornamento locale F3C3.2 — compatibilità legacy

La migration core F3C3 resta invariata. Prima delle modifiche erano presenti
esattamente i cinque file F3C3 inventariati; `.tmp-f3c3-generate.cjs` era assente
e resta assente. La fixture del test galleria V0 ora esplicita il marker NULL.
Le migration storiche, F2, U2.0B e F3C1 non sono modificate.

La migration dedicata `20261007_f3c32_compatibilita_legacy_foto.sql` richiede
il marker, il fingerprint della finalizzazione e la guardia F3C3 già installati.
Lavora in transazione con lock timeout 3s e statement/idle timeout 30s.
Blocca cantieri, Rapportini, foto e Allegati in SHARE ROW EXCLUSIVE; verifica
owner/RLS non forzata di foto e registro, fingerprint e metadata/ACL della RPC
distruzione e l'inventario esatto delle
tre FK Allegati. Qualunque divergenza interrompe e annulla la transazione.
La baseline di foto_cantiere e del registro Allegati ha owner postgres,
RLS=false e FORCE RLS=false; il registro resta privato tramite ACL.

La UI legge id, cantiere_id e allegato_v1_id nella query foto esistente, senza
ampliare le RPC Mobile. NULL identifica V0; non NULL identifica V1. Un marker
non acquisito è uno stato non verificato: i comandi distruttivi sono disabilitati.
Categoria e cancellazione V1 sono disabilitate in galleria e nel popup Rapportino;
le selezioni miste sono rifiutate integralmente prima di Storage/DELETE/update.
La categoria V1 resta strutturalmente rapportino. Filtri, conteggi e PDF non
escludono silenziosamente le foto V1. Le guardie DB restano l'autorità finale.

La cancellazione Rapportino usa una nuova RPC authenticated: autorizza owner,
blocca la testata, verifica qualsiasi Allegato, compresi cancellato e scaduto,
prima di scollegare foto V0. Un errore nella DELETE ripristina anche l'unlink.
La rinomina usa una seconda RPC authenticated per tutti e tre gli ingressi,
identifica il target con UUID e verifica il nome atteso. Blocca i Rapportini
in ordine UUID, poi il cantiere, e rifiuta qualsiasi Allegato/proiezione del
target prima della prima UPDATE. Il ramo legacy conserva le sei UPDATE per
nome, ma in un'unica transazione; scheda e registro conservano i propri campi.
Nomi legacy duplicati falliscono esplicitamente. Finalizzazione e prenotazione
concorrenti sono serializzate dai lock; non viene usata la lista locale di 80 foto
come prova di assenza. Un deadlock con altri writer viene propagato e annulla
interamente il comando; nessun retry silenzioso.

La RPC distruzione cambia soltanto in due punti: gate target prima del contesto,
outbox e delete; riconoscimento catalogo delle tre FK Allegati prima del controllo
FK sconosciute. Nessun Allegato viene eliminato, nessuna tombstone modificata,
nessun oggetto rapportini-v1 inventariato. Allegati di altri cantieri non causano
il nuovo blocco. Restano identici gli altri gate, l'ordine DELETE e il cleanup
legacy preventivi. OID, owner, firma, search_path, ACL e metadata della RPC
storica devono restare identici; cambia soltanto il corpo certificato.

Le quattro funzioni additive sono definer postgres con search_path fisso
pg_catalog/pg_temp. Default grants di ogni grantee sono neutralizzati; soltanto
le due RPC pubbliche ottengono EXECUTE authenticated. I due helper privati sono
accessibili soltanto a postgres e al ruolo dedicato della distruzione, che riceve
USAGE sullo schema privato e nessun SELECT sul registro. Membership e CREATE
temporanei dell'installer vengono ripristinati e verificati; nessuna ACL legacy
di foto viene revocata. Post-check confronta funzioni Allegati/F3C3, trigger,
ACL/RLS delle tabelle e metadata della RPC storica; errore tardivo implica rollback.

Le prove native eseguono la RPC distruzione completa ricostruita dal corpo
storico Economia e gli helper di contesto/outbox certificati, con fixture delle
tabelle collegate. Per provare il successo V0 senza interferenze, due test
circostanziati rimuovono soltanto nel database temporaneo le FK delle prestazioni
esterne al manifest. Un test separato conserva quelle FK e dimostra P2113 con
dati e outbox immutati. Questo non certifica la compatibilità dello schema completo
Production: public.rapportino_prestazioni e le dipendenze private Rapportini
restano un gate distinto; anche il Ponte Economia va incluso nel futuro inventario.
Nessun vincolo reale o migration storica viene eliminato o ampliato.

NO-GO Production resta esplicito. Servono riconciliazione completa del manifest
distruzione e conferma read-only del fingerprint effettivo della RPC installata.
Inoltre va definita una finestra con i writer legacy sospesi: F3C3 core, migration
di compatibilità e nuova UI devono diventare disponibili in sequenza coordinata.
Applicare soltanto core mentre la vecchia UI può ancora rinominare i padri
ricreerebbe il conflitto di operazioni parziali. Non usare deploy automatico della
sola UI: la sua query richiede il marker e i nuovi comandi richiedono le RPC.
I test sono SQL/RLS e UI/domain con trasporto controllato, non Storage API o
PostgREST/browser end-to-end. Nessuna verifica remota viene eseguita in questo step.

Verifiche F3C3.2: suite completa 1.405/1.405 GREEN, inclusi i nuovi 30 test SQL
e 23 test UI/domain, i 34 test nativi F3C3 e le regressioni galleria, photo-storage,
Rapportini, sopralluoghi, PDF/documenti, Economia/Ponte, F2, U2.0B e F3C1.
TypeScript noEmit e build finale sono GREEN. Dopo la suite completa è stato
ampliato soltanto il preflight SQL con i gate owner/RLS e due ulteriori test
negativi; il set nativo finale su PostgreSQL 17.6 è verificato separatamente:
32/32 GREEN, inclusi i due nuovi abort e tutti i percorsi/rollback precedenti.
git diff --check e il controllo whitespace diff no-index dei file nuovi sono GREEN.
