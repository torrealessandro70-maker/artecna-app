# Contabilità ditta Step 3 — attribuzioni clienti

Baseline `origin/main`: `6f5b38c9b8c30557e130f266e8ffe08f9c5a56a8`, verificata il 28/10/2026. Branch isolato `codex/contabilita-clienti-incassi-20261028`. Nessuna operazione Production autorizzata/eseguita.

## Sorgenti riutilizzate e attendibilità

Letti il rapporto completo Step 1, il Riepilogo pubblicato, i writer e il catalogo strutturale acquisito localmente nello Step 5C (25 ottobre). Quel catalogo è una fotografia, non una verifica attuale Production.

- `fatture_emesse`: UUID, numero/data, cliente testuale, totale dichiarato, cumulativo `importo_incassato`, stato, Cantiere per nome e `cantiere_id` opzionale. Nessun cliente/impresa identificato con FK nel modello esaminato. Manuale/XML scrivono IVA con semantiche diverse: mai usata per ricostruire il totale.
- `acconti_cantiere`: UUID, `importo numeric`, `data_incasso date`, descrizione, metodo/nota, Cantiere per nome/ID. Il writer recente salva l'ID; nessun riferimento fattura o identità del pagatore.
- `incassi_non_fatturati`: archivio distinto, senza identità comune con acconti/cumulativi. Non disponibile per attribuzioni in questo step: potrebbe essere la stessa entrata. Il pannello segnala il limite, non somma le due fonti né suggerisce associazioni per nome/importo/data.
- `fatture_emesse.importo_incassato`: cumulativo storico, non movimento. Conservato, non sommato alle quote né riscritto. Nessuna conversione in incassi inventati.

## Modello e RPC

Migrazione additiva locale `supabase/migrations/20261028_clienti_incassi_attribuzioni.sql`, bloccata se lo schema nuovo esiste o i guard richiesti mancano. `.gitattributes` vincola soltanto questo nuovo SQL a LF per stabilità dei byte.

Schema privato `artecna_contabilita`, tabella `attribuzioni_clienti`:

- `id` UUID della richiesta di collegamento (PK), `fattura_id`, `acconto_id`, quota numeric(14,2) positiva;
- `cantiere_id` e cliente confermato come contesto dell'attribuzione;
- attestazione esplicita, autore e timestamp server;
- scollegamento logico con autore/timestamp e UUID richiesta UNIQUE. Nessun movimento copiato o eliminato. Nessun file/documento duplicato.

Firme pubbliche, tutte RETURNS jsonb:

```sql
public.leggi_attribuzioni_cliente(p_fattura_id uuid)
public.collega_incasso_cliente(p_richiesta_id uuid, p_fattura_id uuid,
  p_acconto_id uuid, p_importo numeric, p_verificato boolean)
public.scollega_incasso_cliente(p_richiesta_id uuid, p_collegamento_id uuid)
```

Private: `artecna_contabilita.autorizza(uuid)`, `proteggi_origine()` e `proteggi_truncate()`. Owner previsto **postgres**, verificato dalla migrazione come principal applicatore; nessun ruolo nuovo, SET ROLE, cambio owner o grant temporaneo. Le 3 RPC sono SECURITY DEFINER con search_path bloccato; EXECUTE solo authenticated, revocato a PUBLIC/anon/service_role. Schema/tabella/helper privati non accessibili direttamente; RLS abilitata sulla nuova tabella senza policy dirette.

Accesso server richiede insieme UID autorevole da `utente_jwt_corrente()`, `utente_puo_operare_impresa(uid)` (titolare attivo) e `utente_puo_modificare_cantiere(uid,cantiere_id)` (owner). Nessun affidamento sulle ACL permissive delle vecchie tabelle. Il Cantiere deve esistere; invoice/movimento devono avere lo stesso ID non nullo. Nessun matching per nomi, neppure per Cantieri omonimi. Un incasso ripartito fra documenti deve conservare il medesimo cliente confermato (uguaglianza testuale esatta con trim, non identificazione fiscale/fuzzy).

Poiché l'acconto non identifica il pagatore e la fattura storica non conserva il tipo fiscale, l'operatore autorizzato deve attestare esplicitamente: documento ordinario valido, totale verificato, cliente/Cantiere corretto e assenza di duplicazione dell'entrata. L'attestazione è auditata; non equivale a una verifica fiscale automatica. I tipi/stati strutturati non supportati, quando disponibili, vengono rifiutati server-side. Nessuna attribuzione senza conferma. Non si può certificare automaticamente un TD04 importato storicamente come semplice “emessa” senza metadati: va verificato sul documento prima di confermare. Il flusso non offre rettifiche automatiche per note di credito, acconti/saldi o annullamenti.

## Importi e storico

Il server ricalcola sum quote attive <= totale dichiarato e sum quote attive <= importo del movimento. Precisione due decimali, nessun arrotondamento silenzioso di richieste/valori origine; importi non finiti/negativi/nulli/date mancanti rifiutati. Eccedenza disponibile resta non attribuita.

**Quota ancora da attribuire** = totale meno quote attive. **Residuo da incassare verificato** resta NULL / Da riconciliare, anche con cumulativo zero o nessuna quota. Non si assume che la storia sia completa. Un cumulativo storico positivo non viene aggiunto alle quote: possono descrivere i medesimi incassi. I collegamenti descrivono attribuzioni esplicite, non un ulteriore totale di denaro.

Data documento, data movimento e timestamp attribuzione restano distinti. Il Riepilogo continua a filtrare sulle date originali; collegare oggi non sposta un incasso precedente e non rende ricostruibile un saldo storico. Non vengono sbloccati incassi consolidati, scaduti o residui contabili.

## Concorrenza, writer e integrità

Un advisory lock transazionale comune serializza le operazioni e i guard dei writer. Le somme sono lette dopo l'attesa, in READ COMMITTED; livelli con snapshot persistente sono rifiutati per evitare letture vecchie dopo il lock. Il lock globale privilegia la correttezza in questa prima implementazione; è un limite di throughput, non una deduplicazione client.

Stesso UUID + stesso payload/autore → stesso esito. UUID con payload diverso → rifiuto. Un retry di una richiesta successivamente scollegata non la riapre. Scollega conserva il risultato e le identità; un retry non sottrae di nuovo denaro. Il client conserva in sessionStorage solo la richiesta esplicitamente confermata, recuperabile nella stessa scheda anche dopo reload; nessun autosave DB. Blocco immediato del doppio clic con ref, conferme esplicite e messaggi distinti per rifiuto/esito incerto. Nessun successo dichiarato senza risposta valida.

Non sono aggiunte FK alle tabelle legacy con inventari storici fail-closed. L'integrità referenziale è imposta dai writer privati e da **4 trigger** sulle origini: fatture/acconti BEFORE UPDATE OR DELETE e BEFORE TRUNCATE. I riferimenti devono esistere alla creazione; ogni DELETE è vietato se esiste una relazione anche scollegata, per conservare lo storico. Identità sempre immutabile se referenziata. Con quote attive sono bloccati importi, date, cliente/Cantiere, stato e cumulativo della fattura e importo/data/Cantiere dell'acconto. Nessuna modifica a writer, importatori, guard Materiali/Fatture o cleanup amministrativo. Un'eliminazione Cantiere che raggiunga origini attribuite deve fallire atomicamente; non è previsto un bypass o cleanup automatico dello storico finanziario.

Dopo scollegamento le quote tornano disponibili. Le origini rimangono consultabili; la loro cancellazione resta vietata dallo storico. Modifiche finanziarie senza quote attive sono nuovamente ammesse, ma non si pretende che quel record corrente ricostruisca il passato. Non esiste in questo step una procedura di cancellazione dello storico.

## UI e aggiornamenti

`RegistroPanel → FattureEmessePanel` è il percorso reale. Nuovo comando Collega incasso per riga; un solo `CollegaIncassoPanel` è riusato nel dettaglio del Riepilogo ditta. Mostra fattura, cumulativo separato, quote, disponibilità, fonti e storico audit. Nessuna apertura scrive.

Dopo esito confermato: rilettura RPC, refresh del Registro e notifica in memoria al Riepilogo, senza F5. Quest'ultimo rilegge gli stessi documenti/movimenti: i totali monetari restano invariati. Un errore di refresh dopo conferma è distinto da un esito di scrittura incerto.

## Verifiche e limiti

Risultati finali, hash SQL, commit e riferimenti alle evidenze sono nel rapporto di consegna `audit-locali/CONTABILITA-DITTA-STEP3/REPORT.md` esterno al checkout.

- Unit test: motore puro, contratto RPC e recupero esiti, più regressioni del Riepilogo.
- PostgreSQL nativo isolato: guard/permissi, idempotenza, writer e concorrenza fra connessioni con attese osservate.
- Shell Next completa: fixture Auth e adapter HTTP locale verso il PostgreSQL isolato. NON Auth/PostgREST/RLS Production reali e NON un semplice harness del pannello.
- Build con configurazione sintetica process-only e guard rete già autorizzati. Artefatti solo test, vietato usarli per deploy --prebuilt.
- Guide Next richieste da AGENTS assenti nel runtime installato (`next/dist/docs`); README installato consultato. Nessuna nuova API Next introdotta.

**Prima di un'eventuale applicazione futura:** serve un nuovo precheck READ ONLY autorizzato del catalogo corrente, guard/grants, writer/trigger e cleanup, con confronto fingerprint e verifica dei dati incompatibili. Non viene preparata né eseguita una procedura applicativa Production in questo step. Nessun SQL remoto, push, deploy, AI reale, modifica ENV/login o trasferimento esterno di sorgenti/dati.
