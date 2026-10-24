# Giornata mista Ordinario / Economia nel Mobile V1

Base: origin/main `62b633a69df5973a171e7c33df14b23afd4b7101`.

## Causa e percorso

`app/rapportino/page.tsx` legge lo stato tramite `trasportoMobileRapportinoV1.ts` e `/api/rapportino/stato`; il coordinatore ricostruisce la bozza dalle prestazioni V1 senza deduplicare gli operai. L'editor precedente offriva solo l'aggiunta globale di una riga vuota, con nuova selezione dell'operaio e senza riepilogo per persona. Non esisteva un divieto SQL sulle due righe dello stesso operaio: la chiave univoca è `(rapportino_id, chiave_client)`, non `(rapportino_id, operaio_id)`. La regressione isolata prova che la RPC precedente salva già due fasce per lo stesso operaio.

Il limite è quindi di compilazione/leggibilità del percorso V1; dal solo codice non si può attribuire il singolo episodio reale a un errore remoto. I rapportini storici V0 continuano ad avere il loro percorso precedente: questo intervento non li converte e non li usa come soluzione alternativa.

`salvataggioBozzaV1.ts` conserva delta distinti nuove/aggiornate/rimosse e gli UUID; `/strutturato` inoltra il payload a `salva_rapportino_con_prestazioni` tramite il servizio esistente. La RPC serializza il rapportino per cantiere/data, aggiorna prestazioni e costo storico, genera una timbratura proiettata per prestazione e restituisce il dettaglio. Il coordinatore rilegge il risultato autorevole prima di ricostruire la bozza. Nessun secondo modello o writer aggiunto.

## Modifica

L'editor raggruppa visivamente per operaio mantenendo identità e controlli di ogni riga. Sotto ogni operaio compare «+ Aggiungi prestazione», con operaio già valorizzato, inizio proposto alla fine dell'ultima fascia valida, fine da completare, pausa zero e tipo Ordinario senza variante. Le righe esistenti restano inalterate. Restano possibili aggiunta globale e squadra.

Il riepilogo usa minuti interi: `Totale 8:00 h — Ordinario 4:00 h — Economia 4:00 h`. Non viene memorizzato un secondo totale autorevole. La variante rimane visibile solo in Economia e conserva la semantica opzionale già presente. Il modello non ha note per singola prestazione: le note/lavorazioni del documento restano nel campo esistente.

Le fasce consecutive sono lecite; quelle sovrapposte dello stesso operaio bloccano Salva e mostrano errore sulle righe interessate. La pausa riduce soltanto la propria fascia; non essendo un intervallo temporale localizzato non può giustificare sovrapposizioni. Restano i controlli HH:mm, fine > inizio, pausa intera >=0 e inferiore alla durata. Nessun limite artificiale di otto ore: la somma non supera l'inviluppo delle fasce registrate senza sovrapposizioni nella medesima giornata. Non viene confrontata con presenze indipendenti perché non esiste tale dato nel contratto della bozza.

## Database

Nuova migrazione locale `20261025_rapportino_prestazioni_intervalli.sql`: una funzione privata e un constraint trigger differito sullo stato finale di rapportino_prestazioni. Usa il lock del rapportino e rifiuta overlap con 23514, già tradotto dal servizio in HTTP 400. Il differimento permette allo stesso delta di accorciare una fascia e aggiungerne una consecutiva senza errori sull'ordine intermedio. Un rifiuto annulla anche testata, costi, timbrature e registro richieste.

La RPC esistente e le migrazioni precedenti non sono modificate. La nuova migrazione è stata applicata solo ai database di test isolati; nessun SQL remoto. L'installazione non corregge dati storici: eventuali sovrapposizioni storiche devono essere analizzate prima di una futura attivazione. Il nuovo vincolo si applica agli aggregati toccati da futuri INSERT/UPDATE.

## Economia, Diario e costi

Il writer calcola costo e ore sommando le prestazioni attive, mentre numero_presenti è `count(distinct operaio_id)`. Il contabilizzatore esistente aggiunge al costo del rapportino solo timbrature indipendenti, escludendo le proiezioni delle prestazioni. La prova con due operai misti dà 16 ore, due presenze e costo 400, non 800.

La logica Economia preesistente filtra lavoro_in_economia, conserva lo snapshot e impedisce l'acquisizione duplicata per prestazione. Suite E3.2 preesistente rieseguita su PostgreSQL 17.6 localhost: 27/27, compresi rifiuto Ordinario, retry, acquisizione atomica, concorrenza e unicità tra raccolte. I relativi sorgenti SQL e test già disponibili nel checkout originale vengono solo letti/eseguiti in database sintetico, non copiati o modificati da questo branch.

Il dettaglio salvato e riletto conserva la distinzione; il Diario Desktop attuale mostra il totale, ma non rende le fasce. Una proposta di sola lettura tramite la RPC Desktop esistente è stata fermata dalla revisione automatica per il limite esplicito sul Desktop. Approvazione specifica richiesta; nel candidato il Desktop resta invariato. Questa parte visiva non è dichiarata completata.

## Verifiche

- `giornataMistaV1.test.cjs`: runtime JSX e bozza reali, payload, baseline precedente, RPC PostgreSQL PGlite isolata, reload, due operai, modifica di una sola fascia, pausa locale, >2 fasce, overlap e rollback integrale. Non è un test HTTP Supabase reale o browser mobile.
- Suite HTTP/lettura esistenti: trasporti simulati, nessun server remoto.
- `contabilitaManodopera.test.cjs`: costo senza doppie proiezioni.
- Economia E3.2: PostgreSQL 17.6 nativo con connessioni concorrenti effettive, dati sintetici; nessuna connessione Production.
- TypeScript senza emissione e build Next locale; log ed esiti definitivi nella cartella audit RAPPORTINO-MISTO-20261025.

Le tre suite storiche bozza/salvataggio/squadra hanno già sulla baseline sette test rossi relativi a vecchie aspettative di Variante obbligatoria/UI. Il confronto finale conserva gli stessi sette fallimenti, senza nuovi fallimenti dopo l'adeguamento delle sole fasce delle fixture di salvataggio (prima sovrapposte). Non viene presentata l'intera suite storica come verde.

Nessun push, deploy, SQL remoto, modifica ENV/login o modifica al lavoro originale.
