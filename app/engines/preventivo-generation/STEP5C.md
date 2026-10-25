# Step 5C — baseline effettiva Production

Questo documento sostituisce le assunzioni di catalogo di STEP5A.md. Base del lavoro: commit `5ddaed5e8ae7b3fba3c7679b26b3ace29c6fe296`; nessuna applicazione remota o procedura di applicazione viene preparata.

## Acquisizione

Snapshot READ ONLY del 25 ottobre 2026, progetto `axuiaiglbahygsmeoypy`: 163 funzioni, 62 relazioni e 73 FK, con definizioni, owner, configurazione, ACL, trigger, policy e conteggi aggregati. La fixture JSON contiene codice e metadati, non righe clienti. La fixture PostgreSQL ricostruisce i corpi acquisiti, non quelli ipotizzati nelle precedenti prove. I conteggi descrivono lo snapshot e non sono vincoli futuri.

psql ExitCode 0; sessione postgres; transaction_read_only=on; ROLLBACK confermato. Il primo validatore locale ha restituito 90 interpretando erroneamente pg_stat_ssl sul collegamento interno pooler→database come TLS del client. Il client usa verify-full e CA verificata. Quel risultato è conservato; la verifica offline corretta, senza nuova interrogazione, ha ExitCode 0.

## Conflitto dimostrato prima della correzione

Il corpo Production di inizia_contesto contiene un inventario FK obsoleto: la baseline nativa rifiuta con P2113 anche un Cantiere senza Step 5 e senza riferimenti fattura. Il contatore/whitelist Economia omette inoltre la FK fattura. Le tre FK materiali_impresa/economia_righe/materiali_cantiere→fatture_fornitori_righe restano RESTRICT; nessuna FK è rimossa o convertita in CASCADE.

materiali_impresa è globale: un suo riferimento alla fattura target impedisce la distruzione atomica. Il trigger Production materiali_fattura_guardia restituisce NULL sul DELETE dei materiali assegnati da fattura, anche nel contesto amministrativo. Il candidato conserva questa protezione e anticipa il rifiuto P2113 prima dell'outbox. Non introduce una deroga al trigger. Economia da fattura mantiene invece il cleanup e gli aggiornamenti derivati già previsti dai suoi trigger.

## Delta minimo

- Certificazione dell'inventario reale e delle tre FK fattura, con controlli puntuali e rifiuto di FK sconosciute.
- Manifest/classificazione per le relazioni Step 3/4 installate, senza eliminare Quaderni o foto autonome.
- Documenti Integrativi eliminati prima di Variante e contratto; lavorazioni Integrative seguono l'ordine topologico esistente.
- Nessuna modifica ai corpi dei trigger/writer Economia, Materiali, Fatture, SAL, Rapportini o Storage. Il ruolo amministrativo riceve soltanto i privilegi aggiuntivi espliciti necessari.
- Fingerprint prima/dopo delle tre funzioni sostituite; le impostazioni originali, incluso row_security=off degli helper, sono preservate.

Le sezioni SQL sono marcate STEP5/CATALOG ALIGNMENT. I diff semantici integrali, l'inventario FK e i fingerprint sono negli artefatti audit Step 5C.

## Verifiche e limiti

18 scenari PostgreSQL nativo passati (19 test contando il contenitore), senza disabilitare FK o trigger. Comprendono baseline prima della correzione, riferimenti fattura singoli/combinati, Integrativi, genealogia, protezioni amministrative, Quaderno/foto autonome, isolamento altro Cantiere e outbox unica. I casi Materiali protetti attestano il rifiuto atomico, non una cancellazione riuscita.

TypeScript ed ESLint dei nuovi moduli passati. I sei errori require-import storici del test CJS non sono modificati.

La prima suite estesa termina con 294/297 PASS: i tre arresti riguardano l'avvio initdb oltre 30 secondi, il cleanup della directory nativa e una connessione loopback EACCES del runner. La matrice Step 5C eseguita separatamente è 19/19 PASS. Le ripetizioni mirate dei due test nativi Economia sono registrate separatamente; non si dichiara GREEN l'intera suite sulla base della sola matrice.

La nuova verifica HTTP/Auth/PostgREST/Storage/Chromium non è ancora certificata: il trasferimento del bundle alla sandbox privata è sospeso in attesa di autorizzazione esplicita. La sandbox vuota creata è stata arrestata; nessun sorgente vi è stato trasferito. Le prove native non sostituiscono questa verifica end-to-end. Nessuna AI reale, modifica ENV/OpenAI, scrittura Production, push o deploy.
