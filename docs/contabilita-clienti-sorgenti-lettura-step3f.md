# Step 3F — letture delle sorgenti finanziarie

Partenza: `5826888e5cdf0f55a23be5c238d41902811ec94d`. Solo sviluppo locale; nessuna connessione Production. Catalogo riusato dallo Step 3E (243/243): 167 funzioni, 55 relazioni, 75 FK.

## Sorgenti e causa

`public.fatture_emesse` aveva SELECT ad anon/authenticated e policy `Consenti lettura fatture emesse` sempre vera. `public.acconti_cantiere` aveva SELECT agli stessi ruoli e, dopo il SQL sicurezza scritture, policy `clienti_sorgenti_lettura` sempre vera. I filtri UI non proteggevano la lettura per ID, ricerca o conteggio.

## Regola riusata

La nuova migrazione usa senza modificarlo `artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid)`: JWT presente, `utente_puo_operare_impresa` (titolare attivo), più `utente_puo_modificare_cantiere` (owner) se l'UUID Cantiere è presente. Non basta essere autenticati o proprietari di una riga.

I record senza UUID Cantiere sono documenti d'impresa: restano accessibili ai titolari attivi secondo la stessa regola già certificata per i writer. Non viene ricavato un owner dal nome storico. Due titolari attivi della stessa impresa possono quindi leggere entrambi tali record; B è non autorizzato al Cantiere di A, non necessariamente all'archivio aziendale senza Cantiere. Un utente inattivo/non titolare e anonimo non li leggono. Un UUID con contesto owner incompleto non viene aperto per somiglianza del nome.

## Delta dei permessi

- Revoca SELECT a PUBLIC e anon sulle due tabelle; resta SELECT ad authenticated, sottoposto a RLS.
- Le due policy SELECT esistenti diventano `TO authenticated USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id))`.
- Nessuna policy permissiva aggiuntiva, nessuna modifica INSERT/UPDATE/DELETE, funzione, owner, guard finanziario, importo, data, cumulativo, FK o storico.
- Preambolo fail-closed: owner/RLS corretti, esattamente le quattro policy certificate per sorgente, espressioni/ruoli/comandi verificati con NULL trattato come mancata corrispondenza. Anche una policy FOR ALL inattesa arresta tutto. Grant di colonna applicativi inattesi e viste/materialized view dipendenti richiedono revisione, non vengono ignorati.
- Privilegi del cleanup amministrativo e service_role invariati. Non sono credenziali applicative e non vengono introdotti nel browser.

## Percorsi realmente collegati

- `app/page.tsx`, `caricaFattureEmesse`: SELECT diretto `fatture_emesse`, ordinamento data; Registro, ricerca/filtro e dettaglio lavorano sulle righe restituite. `FattureEmessePanel.tsx` espone il link `pdf_url` soltanto dalle righe caricate.
- `caricaAcconti`: SELECT diretto `acconti_cantiere`, ordinamento created_at; Economia Cantiere e riepiloghi usano questo stato. `salvaAcconto`, `modificaAcconto`, `eliminaAcconto` restano writer diretti.
- `app/engines/contabilita-ditta/lettura.ts`, `leggiFonte`: SELECT *, count exact, order id, range 500. `RiepilogoDittaPanel` usa le stesse sorgenti; dettagli e totali sono elaborati nel client. Errori restano errori, non zeri.
- `attribuzioni.ts` / `CollegaIncassoPanel`: `public.leggi_attribuzioni_cliente(uuid)` SECURITY DEFINER chiama obbligatoriamente `artecna_contabilita.autorizza`; verifica UID, titolare attivo, owner e Cantiere esistente prima di restituire fattura, movimenti, quote e storico. Non è necessario sostituire la RPC.
- Le altre funzioni catturate che nominano direttamente le sorgenti sono `artecna_distruzione.inizia_contesto`, `manifest_cantiere` e `public.elimina_cantiere_definitivamente`. I primi due helper non sono eseguibili da authenticated/anon; il manifest richiede un contesto distruzione valido. La RPC pubblica verifica UID e owner prima del manifest. Non è un endpoint di consultazione/esportazione e non viene modificata né usata per cancellazioni in questo step.
- Nessuna vista è usata dai percorsi applicativi individuati. Le 55 relazioni catturate hanno PK e il clone non contiene viste; il preflight del nuovo SQL controlla inoltre le dipendenze di viste/materialized view direttamente dal catalogo al momento di una futura installazione.
- Nessuna route server/API intermedia legge queste due tabelle nel codice corrente. Nessuna esportazione SQL alternativa individuata. La prova HTTP include CSV PostgREST ed embedding dal Cantiere per verificare che non aggirino le policy, oltre ai percorsi ordinari.

I link a documenti e i dati già scaricati/cachati prima del fix non possono essere ritirati mediante RLS delle tabelle. Non vengono certificati o modificati i permessi dei bucket, URL prefirmati o download di byte già conosciuti. Le altre quattro sorgenti del Riepilogo sono fuori dal perimetro di questa migrazione.

## Installazione futura: ordine e stato parziale

1. `20261028_clienti_incassi_attribuzioni.sql` — SHA `be0678bbd3f6cb386b9e7cd3c6283aa8c596547431a318fd653ce1c9babf92ee`.
2. `20261029_clienti_sorgenti_sicurezza.sql` — SHA `99d5abac28b9fb49d1e8f31fef1822ba0ed9bc8b49194f3176baa770e0c64f16`.
3. `20261029_clienti_sorgenti_lettura.sql` — SHA `a50b26ea6eca9fec4544cba7d98966b387671d9c64fe7f12d2a70c9f6612c59c`.
4. Solo dopo tutti i postcheck: eventuale pubblicazione applicativa separatamente autorizzata.

I primi due file sono immutati. Il terzo richiede il helper del secondo, che richiede il guard del primo. Ogni file contiene BEGIN/COMMIT: tre COMMIT distinti; tra il secondo e il terzo le scritture sono protette ma le letture restano aperte. Non pubblicare o attivare il collegamento nello stato parziale. STOP al primo errore; nessun retry né rollback logico dei COMMIT già avvenuti.

La procedura Step 3E resta non eseguita e non comprende questo SQL: deve essere ripreparata/approvata con tre hash, preflight aggiornato, postcheck READ ONLY di policy/ACL/fingerprint e gestione dei due stati parziali. Questo documento non autorizza alcuna applicazione.

## Prove e riproduzione

`sorgentiLettura.native.test.cjs`: PostgreSQL nativo, ruoli SQL/JWT sintetici; non certifica Auth. Riproduce esposizione precedente nei tre stati; verifica rifiuti, invarianza A, guard writer RETURNING, FOR ALL/vista inattesa e Scollega. `sorgentiLettura.http.cjs`: driver per stack isolato reale Auth/PostgREST/PostgreSQL; non legge ENV/file di credenziali Production e accetta soltanto endpoint loopback dello stack sintetico. Registra percorsi/metodi/status, mai header, password o token.

I conteggi esatti e i log finali sono nel rapporto di audit Step 3F. La prima prova HTTP è conservata: il driver iniziale pretendeva un error.code anche sul HEAD negato senza body (30 controlli completati); è stata corretta solo l'asserzione del test. La risposta HEAD anonima effettiva era 401, senza dati né conteggio. Nessun SQL è stato modificato per questo errore del test. Per gli errori JSON il driver richiede ancora 42501; per un errore senza body richiede 401/403 e data/count null. Risposte 200 con dati non autorizzati falliscono.

Riutilizzati per parti invariate: 75 controlli HTTP Step 3D, 55 scenari PostgreSQL e 6 regressioni cleanup. Le nuove prove ripetono i writer influenzati da SELECT/RETURNING; non sono una nuova prova browser UI completa, né una prova RLS Production.

Esito finale Step 3F: **126/126 controlli HTTP PASS** su 226 richieste registrate, **45/45 test PostgreSQL nativi PASS** (44 sottocasi più suite), **9/9 controlli della sequenza sul clone del catalogo reale PASS**. ExitCode finali 0; lint dei due nuovi driver 0. Rilettura A identica per documenti/movimenti, importi, quote/disponibilità/storico; INSERT/UPDATE/DELETE RETURNING coperti insieme ai rifiuti finanziari attesi. Gli altri test GREEN sono riutilizzati, non sommati come nuove esecuzioni.

Entrambe le sandbox temporanee sono confermate `stopped`; stack Auth/PostgREST/PostgreSQL finale arrestato con ExitCode 0. Nessuna chiamata AI, accesso Storage, connessione Production o modifica ENV/login. I file trasferiti sono soltanto i nove autorizzati, con manifest; la revisione del driver HEAD ha ricevuto consenso specifico prima del nuovo trasferimento.
