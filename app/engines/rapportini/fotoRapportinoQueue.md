# Coda foto condivisa Desktop / portale

`FotoRapportinoQueueV1` gestisce selezione, preparazione immagine, anteprima,
persistenza, invio esplicito, retry e stato. Riceve identità, contesto e trasporto;
non legge autenticazione, PIN, cookie o Supabase. Non chiama il writer Rapportini.
`FotoRapportinoQueue` è l'unica macchina di invio, con lo stesso core
`CodaFotoRapportinoV1` e repository IndexedDB già usati dal Mobile.

## Identità e compatibilità

| Canale | Soggetto | Database IndexedDB v1 | Web Lock |
| --- | --- | --- | --- |
| Portale | UUID operaio | `artecna-rapportino-foto-v1-operaio-<uuid>` | `artecna-foto-mobile-<uuid>` |
| Desktop | UUID utente autenticato | `artecna-rapportino-foto-v1-desktop-<uuid>` | `artecna-foto-desktop-<uuid>/<cantiere>/<data>` |

I nomi Mobile, versione, object store e formato dei record restano invariati.
Non occorre una migrazione IndexedDB e non si importa la vecchia coda globale
non attribuita. Il database separa canale/soggetto; ogni record conserva
cantiere/data/Rapportino, verificati dal core durante elenco e associazione.
Il lock Desktop resta stabile quando la bozza viene associata all'UUID salvato.
Il lock Mobile rimane globale per operaio, anche per coordinarsi con vecchie schede.
Nessun token viene scritto nel database, nei record o nel nome del lock.

## Trasporti e autorizzazione

Il wrapper Mobile conserva il trasporto portale e l'identità operaio.
Il wrapper Desktop segue la sessione ARTECNA e passa il provider Bearer esistente
a `creaTrasportoHttpFotoV1`. Ogni richiesta rilegge il token e rifiuta un subject
diverso da quello proprietario della coda. Desktop usa `credentials: omit`;
il percorso portale non riceve un provider JWT.

Upload: `/api/rapportino/foto`, registro Desktop esistente,
`prenota_allegato_rapportino_desktop` e `finalizza_allegato_rapportino_desktop`.
Elenco/accesso privato: `/api/desktop/foto`, relativo download e
`elenca_foto_rapportino_desktop`, con il resolver e la verifica byte/hash esistenti.
Il server seleziona esplicitamente il canale dalla presenza del Bearer valido;
un Bearer malformato/invalido non provoca fallback al portale.
Nessuna modifica DB o nuova migration è richiesta.

## Recupero e chiusura

La selezione non invia automaticamente file. Una bozza senza UUID conserva le
foto in attesa; solo l'UUID autorevole restituito dal writer consente l'associazione.
Il retry conserva chiave, hash e byte, senza risalvare il Rapportino.
Gli esiti ambigui restano in coda e il reload recupera gli stati interrotti come
errore da ritentare esplicitamente. Una risposta HTTP non finalizzata non può
segnare la foto completata; il cleanup locale del core ammette soltanto completate
o cancellate. Le foto completate restano visibili/persistite come nel Mobile.

Il Desktop impedisce la chiusura dal pulsante mentre si prepara/invia una foto.
Il componente avvisa prima dell'uscita dal browser; se viene comunque smontato,
disattiva nuovi invii, attende le operazioni già iniziate prima di chiudere il DB
e non aggiorna più la UI smontata. Un'interruzione del processo/browser viene
gestita dal recupero idempotente al successivo caricamento.

I test locali usano browser/IndexedDB/HTTP controllati e fixture PostgreSQL.
Non costituiscono una prova di upload su Storage Production.
