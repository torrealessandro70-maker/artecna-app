# Importazione integrata Bluenext — candidato locale

Base: `a0fcc66d0aee1e3d164327bb4bb1a5315083d679`. Nessuna applicazione remota autorizzata da questo documento.

## Procedura

In Fatture emesse, Analizza archivio Bluenext apre una VistaOperativa. La stessa area accetta selezione multipla, trascinamento e aggiunte successive di XML, ZIP, XLS e XLSX. Si possono rimuovere file prima dell'analisi; aggiunte e rimozioni invalidano anteprima e proposte. Il caricamento resta in memoria e non registra operazioni. Limiti: 30 file, 30 MiB complessivi, 10 MiB per originale; sono presenti controlli sulle dimensioni espanse degli archivi. File non supportati, formule nei dati documentali, identità incoerenti e versioni XML discordanti vengono segnalati.

L'analisi incrocia numero completo, data, identificativo fiscale e totale. Partita IVA può contenere un codice fiscale: non viene convertito in una partita IVA inventata. Non vengono rimossi gli zeri iniziali. Cliente e tipo documento costituiscono ulteriori verifiche. Un Excel senza XML non crea fatture; XML senza Excel rimane importabile. Le righe di totale non sono documenti. La valuta deve essere EUR: non vengono eseguite conversioni.

Le intestazioni riconosciute sono: Num. documento, Data doc., Tipo, Cliente, Partita IVA, Importo, Esito invio, Data Importazione, Non Registrata, Id SDI. Id SDI rimane una stringa. Data Importazione viene conservata come tale, mai come trasmissione. Esito e identificativo del report sono evidenze dell'intermediario, non una ricevuta originale. L'Excel è facoltativo.

Prima della conferma l'utente confronta gli originali e attesta esplicitamente la verifica documentale. L'interfaccia mostra separatamente imponibile, IVA, lordo, stato SdI, incasso esistente e situazione degli acconti. La quadratura matematica non certifica il documento o il pagamento. Una ricevuta originale deve essere associata univocamente per nome file e identificativo, con date esplicite coerenti. Il controllo strutturale non verifica automaticamente la firma digitale: la provenienza resta oggetto dell'attestazione dell'utente. Ricevute incomplete, stati incompatibili e casi fiscali non supportati restano da verificare.

Una proposta automatica di riconciliazione richiede un unico incasso lordo già registrato, collegato all'acconto e al cantiere autorizzati, importi e disponibilità coerenti e assenza di collegamenti concorrenti. Non si deduce l'avvenuto pagamento dall'emissione della fattura. Negli altri casi si prepara una proposta con lo stesso componente RiconciliazioneUnificata. In questa modalità il componente legge e prepara soltanto: non chiama i writer. Le proposte vengono applicate con il lotto finale. Se un conflitto fra proposte non è risolvibile, l'intero lotto viene rifiutato.

La conferma complessiva usa una sola RPC e una sola transazione: rilegge le versioni, acquisisce lock, conserva le fonti e richiama gli importatori e i writer finanziari esistenti. Aggiornare una fattura già importata conserva UUID, numero, importi e stato incassata. Un pagamento esistente viene riutilizzato. Nessun secondo pagamento è creato automaticamente. Un eventuale nuovo incasso richiede la documentazione e i controlli già previsti dal motore unificato.

Una richiesta UUID è idempotente e legata all'autore e al contenuto. Lo stesso UUID con input diverso viene respinto. In caso di risposta incerta si verifica la stessa richiesta; non si crea automaticamente un nuovo lotto. Il browser conserva soltanto l'UUID pendente in sessione: non salva file o credenziali. Dopo un ricaricamento con risultato ancora incerto occorre recuperare lo stato, senza una nuova conferma alla cieca.

## Numerazione e fixture

Il progressivo degli acconti registrati e quello degli acconti fatturati sono indipendenti. Non vengono riscritti descrizioni o importi storici. L'identità deriva da cliente, cantiere, riferimenti, importi, date e incasso; il solo progressivo non blocca né prova l'abbinamento.

La fixture anonimizzata usa quattro acconti di 8.574,11, 9.090,91, 2.000,00 e 4.545,45 euro: totale 24.210,47. L'XML della fattura 17 indica 3° acconto, netto 4.545,45, IVA 454,55 e lordo 5.000,00; viene riutilizzato un unico incasso lordo di 5.000,00. Il residuo raggiunge zero. Senza ricevuta valida la posizione fiscale resta aperta. L'acquisizione successiva della ricevuta regolarizza soltanto l'acconto collegato; i 2.000,00 in economia restano separati. Il dato di tre acconti fatturati proviene dal contesto comunicato dall'utente: non vengono inventati documenti fiscali per gli altri due.

## Dati, autorizzazioni e preservazione

Migrazione locale: `20261128000100_bluenext_integrato.sql`. Tre tabelle private, con RLS e senza accesso diretto ai ruoli applicativi: bluenext_fonti, bluenext_evidenze e bluenext_lotti. Gli originali vengono verificati tramite SHA256; ZIP e report completi sono conservati, insieme ai derivati XML necessari. Le RPC autorizzano impresa/cantiere e fattura. Lo scaricamento dell'originale è ulteriormente limitato al caricatore e riautorizza tutti i documenti collegati allo stesso originale.

Non viene aggiunta una colonna alla tabella pubblica fatture_emesse. Il validatore fiscale esistente riceve unicamente un fallback alla fonte XML privata; calcoli e regole di riconciliazione rimangono quelli esistenti. La migrazione verifica prima l'impronta della definizione attesa. Una fonte storica incompatibile resta bloccata, senza riclassificazione automatica.

La cancellazione autorizzata di una fattura elimina le sue evidenze e gli originali non più referenziati. Un archivio o report condiviso con altre fatture rimane integro finché esistono collegamenti: la cancellazione di una sola fattura non redige il file multiplo. Il journal del lotto resta un audit; la sua lettura riautorizza le fatture e nega i risultati con documenti non più accessibili. Questa conservazione va considerata nelle procedure di cancellazione e backup. Un futuro backup completo deve includere anche le tre nuove tabelle private.

Nessun cambiamento a ENV, Login, privilegi PUBLIC globali, scheduler, progetto XML sospeso o configurazioni Production. Contratti, SAL e acconti storici vengono confrontati tramite 18 impronte prima/dopo l'installazione locale.

## Gate remoto separato e recupero

I file precheck.sql e postcheck.sql in supabase/diagnostics/bluenext-integrato sono proposte READ ONLY con ROLLBACK esplicito. Il marker restituito non prova da solo l'esecuzione del ROLLBACK. Una futura applicazione richiede autorizzazione separata, verifica del progetto, delle definizioni e ACL effettive, dei sigilli e della baseline aggiornata. Non è previsto alcun registro migrazioni remoto creato o alterato da questa proposta.

Un errore prima del COMMIT richiede rollback integrale. Timeout o esito incerto richiedono STOP e diagnosi READ ONLY, senza retry dell'apply. Non eseguire compensazioni automatiche dopo COMMIT: dopo possibili importazioni non è sicuro eliminare fonti o funzioni. Il recupero deve preservare le fonti e verificare la compatibilità del frontend precedentemente pubblicato.

## Collaudo e limiti

Fixture e browser locali usano dati sintetici, PostgreSQL 17.6 e parser effettivi SheetJS/JSZip. Sono coperti conservazione, ACL/RLS, idempotenza, concorrenza, rollback a metà lotto, fonti alterate, versioni discordanti, note di credito, aliquote miste, revoca, proposte parziali e successiva ricevuta. Lo smoke locale copre desktop e telefono, DnD, selezione, rimozione, analisi, proposte e conferma complessiva; le regressioni coprono anche i quattro accessi esistenti alla riconciliazione.

Non sono stati caricati né consultati originali reali TESTA in questo step. Il collaudo sintetico non certifica la provenienza di file reali, ricevute o documenti bancari. Nessuna connessione Production, migrazione remota, riconciliazione reale, pubblicazione o deploy è stata eseguita.
