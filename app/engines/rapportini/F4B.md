# F4B locale — Foto Mobile

Il pannello dei Rapportini strutturati usa Blob, anteprima object URL e coda F2 IndexedDB. V0 conserva il form e il percorso foto esistenti. L'UUID viene dal contesto Rapportino confermato dal coordinatore esistente, anche per materiali V2; nessun writer viene richiamato dall'upload.

La coda è separata per ID operaio tramite factory IndexedDB scoped, senza modificare F2 né importare il database globale precedente. Nessun token è persistito. Al reload occorre accedere con il protocollo Mobile esistente e selezionare lo stesso contesto: le foto vengono rilette; upload interrotti diventano errore e richiedono retry manuale con la stessa chiave. Il logout disattiva il pannello; richieste HTTP già partite possono comunque terminare, quindi non equivale a rollback remoto.

Web Locks serializza le operazioni tra schede dello stesso operaio. Se indisponibile, il pannello fallisce chiuso. IndexedDB negato/quota non usa fallback in memoria. Incognito, cancellazione dati e perdita storage browser possono eliminare la coda: non promettere durabilità assoluta.

POST `/api/rapportino/foto` usa servizio F4A e autorizzazione Mobile reale. Nessun adapter Storage/credenziale viene inventato: la route restituisce 503 prima di prenotare/uploadare. Desktop non configurato resta chiuso. Nessun oggetto Production o bucket è creato. Il messaggio UI conserva la foto per retry manuale. Non dichiarare operativa la persistenza server finché un adapter Storage autorizzato e test Storage API reali non sono disponibili.

I test Node della nuova coda usano IndexedDB emulato e trasporto controllato; F2 verifica anche commit/abort. Anteprima/capture e wiring sono verificati staticamente, non mediante camera/browser reale. Prima di rilascio servono browser Mobile reale: scatto e selezione, quota/permessi IndexedDB, reload, multi-tab, cambio operaio e risposta HTTP persa. Nessun test SQL/Storage API end-to-end viene simulato come reale.
