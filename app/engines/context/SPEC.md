# Context Engine V2

## Scopo

Il Context Engine V2 definisce la fondazione del `ConstructionContext`.

Il suo compito e' rappresentare lo stato operativo corrente di un cantiere in una struttura unica, leggibile dagli Engine futuri e dal Fascicolo.

Il Context non e' un database, non e' una tabella e non e' una Timeline. E' una vista unificata del contesto operativo.

## V1

La prima versione introduce:

1. Tipo `ConstructionContext`.
2. Tipo `ContextStatistics`.
3. Tipo `ContextAlert`.
4. Tipo `ContextSuggestion`.
5. Builder puro `buildConstructionContext`.

Il builder V1 riceve:

- `cantiereId`
- `timeline`

E restituisce:

- timeline originale
- ultima attivita'
- statistiche base
- alerts V1 calcolati dal contesto disponibile
- suggestions V1 deterministiche
- data di ultimo aggiornamento

## Statistiche V1

Le statistiche vengono calcolate contando gli eventi della Timeline per sorgente:

- `photo` alimenta `photos`
- `daily_report` alimenta `reports`
- `document` alimenta `documents`
- `sal` resta a `0`
- `workers` resta a `0`

## Alerts V1

Gli alert V1 sono generati solo dai dati gia' presenti nel `ConstructionContext`.

Non leggono dal database, non creano query e non modificano dati.

Regole attive:

- se la Timeline e' vuota, viene generato `no_recent_activity`
- se oggi non esiste un evento `daily_report`, viene generato `no_daily_report_today`
- se non esistono documenti, viene generato `no_documents`
- se non esistono foto, viene generato `no_photos`

Gli alert sono suggerimenti operativi, non decisioni automatiche.

## Suggestions V1

Le suggestions V1 sono proposte operative deterministiche.

Non usano AI.

Non prendono decisioni automatiche.

Non modificano dati.

Regole attive:

- se non esistono rapportini, viene proposta `create_report`
- se non esistono documenti, viene proposta `upload_document`
- se la Timeline e' vuota, viene proposta `start_activity`

Le suggestions aiutano l'utente a capire quale azione puo' essere utile, ma la decisione finale resta sempre all'utente.

## Limiti

Context Engine V2 non deve ancora:

1. Leggere dal database.
2. Creare query.
3. Collegarsi alla UI.
4. Modificare dati.
5. Generare alert basati su dati non presenti nel Context.
6. Generare suggestion AI.
7. Collegarsi a Supabase.

## Regole

1. Nessuna UI costruisce il Context.
2. Il Context e' read-only.
3. Gli Engine futuri devono leggere il Context.
4. Il Context deve derivare da eventi normalizzati.
5. Ogni Fascicolo avra' un solo `ConstructionContext`.
6. L'utente prende sempre la decisione finale.

## Roadmap

### V1

- Timeline.
- Statistiche.
- Ultima attivita'.
- Alerts V1.
- Suggestions V1.

### V2

- Regole di priorita'.
- Suggestions contestuali avanzate.

### V3

- Context Snapshot.
- AI Observer.
- Decision Suggestions.

### V4

- Digital Twin.
- Time Machine.
- Ricostruzione storica dello stato del cantiere.
