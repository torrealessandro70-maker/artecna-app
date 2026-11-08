# Hard-delete runtime V2 — verifica locale

Parent: `7c533be13a70e7e878773ab156274a7f12a215fe`. Migration candidata: `20261108000900_cantiere_hard_delete_runtime_v2.sql`. Nessuna applicazione Production, push o deploy.

## Causa e perimetro

Il benchmark Production READ ONLY certificato misura catalog 251.447 ms, targets 35.982 ms, blockers 3015.181 ms e preserved 17971.898 ms (quest'ultimo include la costruzione targets nell'argomento). Il budget PostgREST del ruolo authenticated è 8 s. Il log PostgreSQL `c63f8fdc-034e-4ea4-bdef-a4c4b05461d6` identifica la serializzazione globale di foto_sopralluogo dentro hard_delete_preserved. I payload target sono piccoli. Il rollback del tentativo precedente è certificato dai confronti READ ONLY già acquisiti; nessuna nuova interrogazione Production è stata necessaria.

## Algoritmo

Il piano TARGET viene costruito una sola volta. I fingerprint leggono esclusivamente chiavi positive congelate di KEEP_LEGAL, witness condivisi e vicini esterni pertinenti. Nessun fingerprint globale WHERE true o complementare NOT target. I vicini includono la famiglia contabile collegata e il progetto Quaderno realmente referenziato. Le trasformazioni contabili autorizzate sono normalizzate e verificate anche come multiset di valori legali prima/dopo; una corruzione dei valori archiviati provoca rollback.

Un indice privato delle UUID nei payload/risultati delle richieste di classificazione evita la serializzazione globale ripetuta; trigger e backfill mantengono le relazioni indicizzate. Payload e risultato sono analizzati separatamente senza perdere chiavi JSON omonime. Il catalogo protegge helper, FK, classificazione degli edge e nuove tabelle Cantiere. Residui verificati sulle chiavi TARGET congelate. RPC, JWT, ACL, owner, Storage outbox e fail-closed restano coperti dai test. hard_delete_lock è invariata. Nessun aumento di statement_timeout.

L'installer usa una singola transazione, baseline 008 esatta, grant SET temporaneo separato e CREATE temporaneo su public; ripristina membership, schema ACL e metadati RPC originali. I test iniettano errori dopo ogni passaggio rilevante e verificano rollback completo. Seconda esecuzione fail-closed.

## Fixture e benchmark PostgreSQL 17.6

Target sintetico con conteggi Production: 2 foto, base64 totale/max 173 byte; 1 fonte visiva foto_cantiere; 1 witness Quaderno, 924 byte JSON e 84 testo; nessuna foto_sopralluogo condivisa. Il 10x aumenta esclusivamente dati globali estranei, comprese immagini globali da circa 126.8 MB a 1.268 GB. FK e check attivi; i trigger disabilitati durante il solo caricamento sintetico vengono ripristinati prima della RPC misurata.

Tempi in ms dell'ultima esecuzione, dati completi in runtimeBenchmark.json:

| Fase | Production attuale | Locale 1x | Locale 10x |
|---|---:|---:|---:|
| catalog | 251.447 | 16.772 | 15.014 |
| targets | 35.982 | 61.244 | 26.431 |
| blockers | 3015.181 | 78.076 | 222.683 |
| preserved BEFORE | 17971.898 | 4.608 | 11.406 |
| delete completo, RPC | non misurato: timeout | 538.805 | 526.107 |
| verifica finale, profilo | non disponibile | 23.606 | 24.872 |
| totale, RPC | timeout 8 s | 538.805 | 526.107 |

Totale = massimo tra RPC fredda/calda non strumentata; delete completo include tutte le fasi. Le misure isolate e il profilo sono esecuzioni distinte e non vanno sommati. Preserved AFTER: 2.690/8.217 ms. Somma DML delete nel profilo: 189.748/138.573 ms. L'originale preserved riprodotto localmente a 1x costa 5063.466 ms: il confronto locale conferma la rimozione del collo di bottiglia senza equiparare hardware locale e Production. Preserved cresce solo di 6.8 ms a 10x; il totale non cresce linearmente e rispetta ampiamente i budget 4/6 s.

## Contratto permanente

`npm run test:hard-delete-contract`: 115 test GREEN, inclusi fixture 0/1/10x, budget freddo/caldo con timeout locale 8 s, fingerprint circoscritti, drift FK/logical edge/tabella/helper, corruzione witness/contabilità, installer 008/009 e UI Elimina definitivamente → ELIMINA. Migration 008 invariata, SHA256 LF `31badc610d022416c0a6066197bbd544c44f97424e7e3b927a5ff2058a4a3c80`; la normalizzazione CRLF avviene soltanto nei loader dei test.

Workflow CI permanente Windows/PostgreSQL 17.6 con archivio verificato SHA256 e azioni fissate a commit. Non eseguito remotamente: nessun push autorizzato. I benchmark restano misure sintetiche locali; non costituiscono esecuzione distruttiva Production.
