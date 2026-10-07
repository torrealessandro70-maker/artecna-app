# Foto Rapportini F2 — contratto locale e progetto Desktop

Stato: dominio e repository locali, senza UI, rete, upload o nuove RPC SQL.
Le migration Allegati storiche e i tre file U2.0B non sono modificati.

## Contratto e coda

`fotoRapportinoV1.ts` espone FotoLocaleInCoda, FotoPersistita, StatoUploadFoto,
ErroreFoto e TrasportoFotoRapportinoV1. I due futuri trasporti implementano
caricaFoto, ritentaFoto, elencaFoto, apriFoto, cancellaFoto. Il componente non
conosce autenticazione, RPC, path, bucket o lease. RitentaFoto conserva la chiave
e non richiama il writer Rapportino.

FotoPersistita discrimina LEGACY/V1 esplicitamente. L'identità V1 e il riferimento
alla proiezione devono essere forniti dal registro autorizzato, mai dedotti da
URL mancanti. Un tombstone cancellato ha foto_cantiere_id NULL. Il futuro resolver
deve acquisire tale mapping con una lettura controllata additiva: l'elenco SQL
Mobile corrente non restituisce foto_cantiere_id. Nessuna modifica foto_cantiere.

La selezione valida crea una chiave canonica una sola volta; SHA-256 è calcolato
con Web Crypto sui byte del Blob. Nessuna trasformazione, nessun Base64, nessun
URL remoto persistito. Si accettano MIME dichiarati JPEG/PNG/WebP, 1..4.000.000 byte;
HEIC/HEIF e MIME vuoto sono rifiutati. Il MIME dichiarato NON certifica il contenuto.
F3 dovrà decodificare i byte, certificare formato reale e <=24 MP prima della
prenotazione, e verificare oggetto/hash prima della finalizzazione.

IndexedDB memorizza Blob, chiave, MIME, peso, hash, contesto, stato e creata_at_ms.
L'aggiunta usa add (non overwrite). Le associazioni/stati sono transazioni
readwrite; il successo viene restituito solo dopo oncomplete. Il repository in
memoria permette test senza dipendenze. Non è un fallback automatico: indisponibilità
e quota generano errori sanitizzati; la futura UI deve avvisare che la foto NON è
in coda persistente e consentire nuova selezione/riprova, senza fingere recupero.
Non cancellare automaticamente le altre foto per liberare quota locale.
IndexedDB può essere cancellato dal browser/incognito: nessuna garanzia assoluta
di durabilità. Non richiediamo Storage persistente in F2.

Macchina locale: selezione/hash -> in_coda (UUID mancante) oppure pronta (esistente).
Writer riuscito associa il suo UUID e porta in_coda a pronta, solo per cantiere/data
originali; writer fallito non invoca alcuna operazione sulla coda. Cambio contesto
non sposta foto. Caricamento -> finalizzazione -> completata; errore -> pronta
con stessa chiave. Dopo reload recuperaInterrotte porta caricamento/finalizzazione
a errore, senza dedurre rollback remoto. Il futuro retry verifica/prenota con
identità originale e riconosce la finalizzazione già avvenuta.
Scaduta non può tornare pronta; un nuovo caricamento è una nuova selezione.

Rimozione locale consentita solo in_coda/pronta, prima dell'avvio remoto.
Richiesta cancellazione -> cancellazione_pending -> cancellato richiede esiti
autorevoli del futuro trasporto; nessun worker simulato. Pending non libera quota
server, non equivale a file eliminato. Cleanup locale esplicito elimina solo
completate/cancellate dopo riconciliazione; niente scadenza automatica dei Blob.
La futura capability dovrà impedire operazioni simultanee sulla stessa chiave e
separare/chiudere le code alla disconnessione/cambio identità (senza salvarvi token).
Non collegare una coda di un'altra identità automaticamente, anche a pari contesto.

## Scadenza persistita

ScadenzaAllegatoPersistita + validaScadenzaAllegatoPersistita modellano l'esito SQL
normale scaduto_persistito_con_conflitto: stato scaduto, upload false, lease NULL.
La proiezione scarta campi interni. EsitoPrenotazioneFoto distingue successo/scadenza.
conflittoScadenzaDopoCommit prepara un risultato 409 con scadenza_persistita=true.
È un mapper puro, NON esegue/garantisce un COMMIT: il futuro servizio lo chiama
solo dopo il ritorno normale della RPC autocommit, oppure dopo COMMIT esplicito.
Non sollevare PR409 dentro la transazione per questo caso. Gli altri conflitti SQL
rimangono eccezioni. Nessuna modifica al contratto legacy già consumato o SQL.

## RPC Desktop — progetto, non implementazione

Nuove funzioni additive (nomi proposti, da certificare prima della migration):

| RPC | Parametri | Effetto |
|---|---|---|
| prenota_allegato_rapportino_desktop | uuid rapportino, uuid cantiere, date data, uuid chiave, text SHA256, text MIME, bigint peso | Prenotazione/lease/quota/idempotenza |
| finalizza_allegato_rapportino_desktop | uuid allegato, uuid lease | Proiezione e finalizzazione atomiche |
| elenca_allegati_rapportino_desktop | uuid rapportino, uuid cantiere, date data | Elenco autorizzato e mapping proiezione |
| autorizza_accesso_allegato_desktop | uuid allegato | Identità Storage interna al server |
| cancella_allegato_rapportino_desktop | uuid allegato | Richiesta pending/tombstone idempotente |

JWT -> utente_jwt_corrente() -> utenti_cantiere (user_id, stesso cantiere, ruolo owner).
Per operazioni con solo allegato_id, derivare il cantiere dal registro e verificare
membership/context; conoscere UUID non autorizza. Nessun PIN/Desktop simulato.
Owner Desktop può leggere/aggiungere/richiedere cancellazione anche su cantiere
concluso, coerentemente con writer Desktop: conclusione non congela allegati.
Implica che galleria/PDF possano cambiare dopo conclusione; questa politica dovrà
essere esplicita nei test e nella futura autorizzazione. Mobile resta cantieri aperti.

Riutilizzare invarianti/builder privati comuni dopo autorizzazioni separate, senza
duplicare protocollo; lock Rapportino -> Allegato -> eventuale proiezione.
Session/worker Mobile e membership Desktop non devono essere intercambiabili.
Nuove RPC SECURITY DEFINER owner controllato, search_path fisso; grant authenticated
solo dove necessario e accesso server ai risultati interni; nessun SELECT/DML diretto,
nessun nuovo grant al backend Storage. Gli helper restano non eseguibili dal browser.
L'identità Storage non è scelta qui. auth JWT RPC e credenziale Storage sono separate.
Non implementare senza fingerprint/metadata/ACL Production Allegati certificate.

Errore futuro: PR401 401, 42501 403, 22023 400, PR409 409;
XX001 errore integrità sanitizzato non riparabile; trasporto/risposta invalida 503.
Il risultato scadenza persistita è 409 DOPO commit, ritentabile=false sulla stessa chiave.

## Prima di F3

- Certificare baseline Production Allegati e mapping autorizzato registro/proiezione.
- Certificare identità Storage privata minima, bucket rapportini-v1 e policy, separatamente.
- Implementare verifica file reale/24 MP e verifica oggetto prima finalizzazione.
- Definire risposte pubbliche, HTTP mapping e trasporti senza dati operativi interni.
- Provare IndexedDB su browser reale (durabilità, quota, transaction abort/reload).
- Definire isolamento locale per identità e UI consenso/errore persistenza.
- Worker resta autonomo: non promettere quota liberata o cancellazione fisica prima di esso.

F2 non modifica writer, bozza, intento, revisione, prestazioni, materiali o Mobile.
