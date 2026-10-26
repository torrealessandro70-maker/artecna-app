# Preventivo manuale — mappa prima delle modifiche

Base: `10fa04e24cff4d82ba1b3bb04c92b907760ecd06` (origin/main acquisito il 26/10/2026).

| Percorso | Esistente / riuso | Gap |
|---|---|---|
| Registro | RegistroPanel → RegistroPreventiviPanel, riapertura json_voci_ai | ingresso nuovo documento e riconoscimento manuale |
| AI iniziale | page.tsx: generaPreventivoAiDaSopralluogo / generaPreventivoDaDocumentoAnalizzato | resta invariato; il selettore AI rimanda a questo percorso con contesto |
| Revisione | RevisionePreventivoAiPanel: descrizione, quantità, prezzi, riordino, rimozione, cronologia, totali | modalità manuale senza azioni AI/Web, ricerca prezzi e voce libera |
| Prezzi | prezzi_lavorazioni, memoria_prezzi, leggiStoricoPrezzi, risolviPrezzoPrioritario | ricerca lessicale dei riferimenti, senza nuove priorità o provider |
| Persistenza contrattuale | preventivi_cantiere, json_voci_ai, origine_ai=false, approvato=false; revisione aggiorna lo stesso documento | primo salvataggio manuale senza generazione e metadati iniziali |
| Integrativo | VariantePreventivoIntegrativoPanel → leggi_contesto_preventivo_integrativo → validaRevisione → salva_preventivo_integrativo_generato | ingresso vuoto; writer esistente fissa origine_ai=true: wrapper additivo indispensabile per origine manuale |
| Excel | page.tsx: generaExcelDaPreventivoAi, template comune, genealogia integrativo | evitare il pulsante AI che salva anche prezzi in memoria |
| PDF | non presente nello stesso percorso Preventivi (PDF presenti per altri domini) | fuori scope |

Il manuale usa lo stesso modello di righe, non un secondo editor. Il contratto Integrativo resta contesto strutturato, con operazioni e residui verificati dagli stessi controlli Step 5. Nessuna scrittura automatica nella memoria prezzi. Nessuna modifica a prompt, modello, ENV o migrazioni pubblicate.

Le guide richieste in node_modules/next/dist/docs non sono distribuite nell'installazione locale; consultato il README installato. Non vengono introdotte nuove API Next.

## Implementazione

- Registro: `+ Nuovo preventivo` → `Genera con AI` (percorso Sopralluoghi esistente) oppure `Compila manualmente`.
- Cantiere: ingresso manuale con ID precompilato. Cliente precompilato se disponibile nel DTO; resta obbligatorio prima del salvataggio.
- Contrattuale: intestazione cliente/cantiere/titolo/data, editor comune vuoto, ricerca lessicale, voce libera, salvataggio esplicito e riapertura dal Registro con origine manuale. Nessuna creazione automatica di Cantiere o approvazione.
- Integrativo: ingresso dalla Variante oppure selezione di una Variante bozza nel Cantiere scelto. Context reader, firma, residui e `validaRevisione` Step 5 invariati. Il contesto contrattuale resta separato. La conferma crea le lavorazioni con lo stesso writer autorevole.
- `RevisionePreventivoAiPanel` ha props opzionali `manuale` e `storicoRiferimento`: default preserva AI. Il manuale non rende i componenti AI prezzo/Web; Migliora testo è disabilitato. Excel non scrive prezzi in memoria.
- `manuale.ts`: `cercaRiferimenti`, `voceDaRiferimento`, `voceLibera`, `totaleManuale`, `validaManuale`. Non è un nuovo Price Engine: il riferimento scelto viene passato a `risolviPrezzoPrioritario` invariato, con le sue priorità effettive (storico affidabile, listino aziendale, SIC24, memoria compatibile) e le maggiorazioni esistenti. Ricerca lessicale, non AI.
- Il riferimento originale resta in `riferimento_scelto`; un override conserva quel riferimento e mostra la modifica manuale. Le voci libere hanno origine `Inserito manualmente`.

## Unico delta SQL locale necessario

`20261026_preventivo_integrativo_manuale.sql` crea soltanto la RPC additiva
`public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb)` (ultimo argomento metadati opzionale).
Non sostituisce funzioni Step 5 e non aggiunge tabelle, colonne, FK o trigger.
Il wrapper SECURITY DEFINER appartiene allo stesso writer NOLOGIN, delega autorizzazione/lock/idempotenza/residui/righe al writer esistente e registra `origine_ai=false`, `provenienza_generazione.origine=manuale`, cliente/titolo/data nella stessa transazione. Un retry con metadati differenti è rifiutato.
Richiede grant colonnari SELECT/UPDATE sui soli metadati del documento al ruolo writer; EXECUTE soltanto ad authenticated. Il pattern di membership/CREATE temporanei segue la migrazione Step 5, con revoca prima del COMMIT. Nessuna applicazione remota in questo step; necessario precheck del catalogo e approvazione prima di un'eventuale installazione.

SHA-256 sui byte effettivi del nuovo SQL (calcolato tramite .NET): `fbf3f06d431b1f2ba4da66a3a0e2ce774ab873a158ef9a123d5be28a25cf8a47`.

## Verifiche e limiti

- 48/48 test pertinenti PASS: 11 manuale (asserzioni multiple), 3 interfaccia precedente, 20 generazione/contratto AI, 2 ExcelJS, 12 persistenza SQL embedded (incluso contenitore).
- Copertura dei 18 casi richiesti: apertura Registro; ricerca SIC24 e memoria; aggiunta singola/multipla/libera; modifiche quantità e prezzo; totali; provenienza originale dopo override; salvataggio e riapertura; Registro; Excel; contrattuale; Integrativo con quattro operazioni; parità AI. PDF non applicabile: assente nello stesso percorso.
- Componenti reali eseguiti con hooks e servizi simulati; NON è uno smoke browser/Auth/PostgREST reale.
- SQL effettivo eseguito con PGlite (PostgreSQL embedded isolato), writer Step 5 reale della fixture esistente: quattro operazioni, genealogia, rollback batch invalido, retry, origine manuale, metadati, grants e writer invariato. NON è PostgreSQL nativo concorrente né Production.
- ExcelJS reale, template reale, controllo celle/formule/totali e parità dell'export precedente.
- TypeScript completo PASS; lint nuovi moduli runtime PASS; file preesistenti: 142 errori e 250 warning sia baseline sia candidato, nessuna nuova segnalazione.
- Build non ripetuta: nessuna API Next/export di route modificata; import e tipi verificati da TypeScript, componenti e generatore precedente dai test.
- Integrativo confermato rimane protetto/immutabile come nel flusso Step 5. Non aggiunta modifica di lavorazioni economiche dopo conferma.
- Il manuale Integrativo conserva anche i guard Step 5 su fonti/analisi non allineate. Nessun bypass dei guard o dei residui.
- Nessuna nuova ricerca semantica, fonte prezzi o scrittura automatica memoria. Nessun nuovo PDF. Nessun test HTTP/browser reale in questo step.
- ENV, configurazione/modello/prompt OpenAI e migrazioni precedenti invariati. Nessun SQL remoto, push, deploy o AI reale.
