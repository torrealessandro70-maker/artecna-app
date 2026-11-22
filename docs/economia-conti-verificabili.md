# Economia generale — conti da verificare

Base: b8cf9f2b219df97d06a3c3983673aa8f64a95187. Branch dedicato: codex/economia-conti-verificabili.

## Comportamento

La sezione "Da verificare e sistemare" segue il prospetto IVA e usa il medesimo periodo del Riepilogo ditta. Quattro gruppi di posizioni caricate, senza ripetere o consolidare i KPI finanziari: IVA emesse non determinabile, IVA ricevute non determinabile, incassi da riconciliare/verificare, altri record esclusi. Gli incassi storici non fatturati restano separati e consultabili: non sono sommati agli incassi lordi verificati.

Ogni riga apre una scheda in VistaOperativa, direttamente dal record identificato dalla fonte e dal suo UUID originale. Non viene aperto un registro generico e non si cerca per numero, nome, data o importo. La scheda mostra solo campi presenti e importi verificabili. Il campo iva ambiguo del registro non viene interpretato come importo monetario. L'importo di un movimento con base non confermata è distinto dal lordo.

Un record senza UUID è consultabile soltanto nella fotografia autorizzata già caricata, usando la posizione esatta nella fonte. Dopo una nuova lettura non viene riassociato alla stessa posizione: bisogna riaprirlo. Identificativi ripetuti sono una sola posizione problematica, senza scegliere una copia o mostrare metadati/importi arbitrari.

La lista conserva gruppo, ricerca e pagina, limita a 20 righe e ripristina lo scorrimento. Il pulsante "Torna ai conti da verificare" torna alla lista montata. Il chiamante salva scrollTop nel clic prima di nascondere la lista: il browser può azzerarlo durante la variazione del layout. VistaOperativa mantiene invariato il comportamento preesistente quando non riceve scrollRef.

## Fonti, accessi e aggiornamenti

- Riutilizzo delle sei letture leggiFontiDitta, con le stesse sessioni, paginazione, conteggi e RLS. Nessuna nuova query costruita dal modulo di revisione.
- Incassi condivisi dal calcolo già presente in IncassiFatturazionePanel: nessuna seconda RPC. La copertura del periodo viene verificata, non presunta dal numero di righe.
- Cambio client/sessione: invalidazione delle letture e chiusura dei percorsi operativi; nessun record della fotografia precedente mostrato in mancanza di una lettura corrente.
- Le fatture collegate si aprono soltanto per il fattura_id esatto già presente nelle letture autorizzate. Un collegamento a un documento non disponibile viene esplicitamente segnalato.
- Link originali utilizzati soltanto se HTTPS, già presenti nei dati e senza credenziali incorporate. Nessuna costruzione di URL da percorsi storage e nessun aggiramento di accessi o ACL.
- "Cosa fare" viene proposto soltanto per il percorso Acconti esistente, con acconto_id e autore verificabili. Apertura dell'UUID esistente, nessuna creazione o conferma automatica. Permessi, idempotenza, documentazione fiscale e rettifiche rimangono nei componenti/RPC originali, invariati.
- Salvataggio confermato o chiusura del percorso Acconti rileggono le fonti e gli incassi. La chiusura intercetta anche eventuali conferme fiscali fatte nei sottopannelli originali. La lettura corrente sostituisce il vecchio dettaglio; non si presume che il problema sia risolto.

## Cause e limiti

Le esclusioni mantengono la motivazione dei calcolatori originali. Totale documentale, IVA esclusa, cumulativo dichiarato e incasso da riconciliare sono distinti. Le esclusioni dai cumulativi mantengono il loro ambito complessivo, esplicitamente segnalato nella lista; non diventano movimenti del periodo.

La RPC Incassi non dettaglia tutte le ragioni di una quota documentale non valida: non si attribuisce automaticamente il problema allo SdI. L'interfaccia segnala ciò che la fonte non specifica. Le fonti non disponibili/parziali producono avvisi e conteggi delle sole posizioni caricate, non uno zero certo dei problemi.

Il saldo fiscale rimane Non determinabile. Nessuna detraibilità parziale, aliquota nuova, riclassificazione, generazione fiscale o liquidazione ufficiale. Nessuna somma fra fatture, acconti e incassi.

Per le fatture IVA escluse senza un percorso di correzione esatto già integrabile non viene inventato un pulsante di modifica: sono disponibili scheda, motivazione, verifica necessaria e originale se presente. Il percorso Acconti resta l'unica correzione collegata in questo STEP. La disponibilità fisica/scadenza dei file storage non è stata verificata in Production.

## Verifiche locali

136 test unitari e UI GREEN sul codice reale, con fixture sintetiche: UUID uguali/diversi, dati mancanti, copie conflittuali, permessi negati, invalidazione sessione, lettura Incassi unica, record scomparso, esclusioni IVA, collegamenti assenti/revocati, paginazione, ritorno, ricerca, scorrimento e chiusura senza writer. Regressioni dei KPI Incassi, prospetto IVA, riepilogo e VistaOperativa. Esiti finali, hash e commit nel rapporto locale .run/conti-verifica/rapporto-finale.json.

Browser su fixture esclusivamente locale, senza client Supabase Production e con CSP connect-src none/fetch disabilitato. Verificati seconda pagina e UUID 00000000-0000-4000-8000-000000000038. Con gli stili reali caricati, ritorno sullo stesso contesto da scrollTop 4396,44 a 4387,56 px (assestamento osservato di 8,89 px, nessun ritorno all’inizio). Il test precedente senza stili aveva misurato 4021,33 px prima/dopo coincidenti. Provati layout mobile con viewport CSS effettivo 356 px (nessun overflow orizzontale), incasso sospeso e filtro conservato. Il viewport originale è stato ripristinato. Screenshot desktop disponibile; la cattura CDP con override mobile ha superato il timeout, perciò non si attesta uno screenshot mobile. Nessun errore console applicativo rilevato.

Nessuna operazione Production, push, deploy o nuova connessione PostgreSQL. Nessuna modifica a ENV/login/privilegi/cron. Preservare i precedenti diagnostici e once.lock. Prima della pubblicazione occorre un gate separato sul commit esatto e un futuro smoke autorizzato con sessione reale; nessuna migrazione o nuova RPC necessaria.
