# Fascicle Engine

## 1. Missione

Il Fascicle Engine definisce e governa la struttura comune dei fascicoli di
ARTECNA OS. Riunisce informazioni, contenuti e relazioni riferiti allo stesso
contesto di lavoro in un modello tipizzato, tracciabile e indipendente dalla
UI.

Il motore deve offrire un punto di accesso coerente ai contenuti del fascicolo
senza assumere la responsabilita delle elaborazioni specialistiche svolte
dagli altri Engine.

## 2. Il Fascicolo e il centro del sistema

Il Fascicolo e il centro organizzativo di ARTECNA OS. Documenti, eventi,
attivita e insight acquistano significato attraverso il fascicolo a cui sono
collegati.

Ogni informazione deve avere un contesto riconoscibile e ogni collegamento tra
fascicoli deve essere esplicito. Il Fascicle Engine non sostituisce i moduli di
dominio: ne organizza gli output e ne preserva le relazioni.

## 3. Tipi di fascicolo

- **cliente**: informazioni e relazioni riferite a un cliente.
- **sopralluogo**: evidenze, note e attivita raccolte durante un sopralluogo.
- **preventivo**: documenti, versioni e decisioni relative a un preventivo.
- **cantiere**: contesto operativo centrale di un lavoro in esecuzione.
- **sal**: avanzamenti, verifiche e documentazione di uno stato lavori.
- **fattura**: documento contabile e relativi collegamenti operativi.
- **archivio**: contenuti conservati senza un flusso operativo attivo.

## 4. Struttura comune

Ogni fascicolo espone le stesse aree fondamentali:

- **informazioni**: dati descrittivi e metadati del contesto;
- **documenti**: file e riferimenti documentali;
- **foto**: immagini e relativi metadati;
- **note**: annotazioni testuali o strutturate;
- **audio**: registrazioni e riferimenti audio;
- **disegni**: elaborati grafici e schizzi;
- **timeline**: eventi ordinati e tracciabili;
- **attivita**: azioni pertinenti al fascicolo;
- **AI insight**: suggerimenti o sintesi prodotti dall'AI e distinti dai fatti;
- **collegamenti**: relazioni tipizzate con altri fascicoli.

Le aree possono essere vuote, ma la loro presenza nel contratto garantisce una
struttura uniforme per tutti i tipi di fascicolo.

## 5. Responsabilita del motore

Il Fascicle Engine deve:

- creare strutture di fascicolo valide e tipizzate;
- mantenere identita, tipo, stato e informazioni del fascicolo;
- organizzare asset per categoria senza interpretarli;
- rappresentare eventi di timeline e collegamenti tra fascicoli;
- preservare la provenienza dei contenuti ricevuti da altri Engine;
- esporre contratti pubblici indipendenti dalla UI e dalla persistenza;
- preparare operazioni revisionabili prima di eventuali scritture future.

## 6. Cosa il motore non deve fare

Il Fascicle Engine non deve:

- analizzare documenti, eseguire OCR o classificare file;
- decidere o avanzare autonomamente workflow;
- inventare conoscenza, insight o informazioni mancanti;
- eseguire funzioni proprie dell'AI Assistant;
- scrivere su database senza conferma esplicita dell'utente;
- dipendere da componenti React, pagine o stato visuale;
- incorporare logica specifica di un singolo tipo di fascicolo nel contratto
  comune.

## 7. Relazione con gli altri Engine

### Document Intelligence Engine

Document Intelligence analizza un documento una volta e produce un risultato
strutturato. Fascicle conserva il riferimento al documento e puo organizzare
il risultato confermato, ma non replica classifier, OCR o parser.

### Workflow Engine

Workflow governa attivita, stati operativi e approvazioni. Fascicle espone il
contesto e la timeline, mentre ogni transizione resta responsabilita del
Workflow Engine.

### Knowledge Engine

Knowledge fornisce conoscenza verificabile e riferimenti di dominio. Fascicle
collega tali riferimenti al contesto senza trasformarli in informazioni
osservate direttamente.

### AI Assistant Engine

AI Assistant produce sintesi e suggerimenti entro autorizzazioni esplicite.
Fascicle li conserva come insight distinguibili dai fatti e non li applica
autonomamente.

## 8. Roadmap tecnica EPIC-02

1. Definire SPEC, tipi condivisi ed entrypoint minimo in memoria.
2. Aggiungere validazione deterministica degli input e test dei contratti.
3. Definire servizi per asset, timeline e collegamenti.
4. Introdurre versionamento e provenienza dei contenuti.
5. Definire piani di modifica con anteprima e conferma utente.
6. Integrare Document Intelligence tramite il suo output pubblico.
7. Integrare Workflow, Knowledge e AI Assistant tramite contratti dedicati.
8. Progettare un adapter di persistenza separato dal dominio.
9. Collegare la UI solo dopo la stabilizzazione degli entrypoint pubblici.
