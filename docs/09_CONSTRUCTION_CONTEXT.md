# 09 - Construction Context

## Visione

Il Construction Context rappresenta lo stato corrente del cantiere.

Non e' un database.

Non e' una tabella.

Non e' una Timeline.

E' una rappresentazione unificata del contesto operativo.

---

## Principio

Ogni Engine deve leggere il Context.

Non deve leggere direttamente il database.

---

## Alimentazione

```text
Database

↓

Event Engine

↓

ConstructionEvent[]

↓

Context Engine

↓

ConstructionContext
```

---

## Struttura concettuale

```ts
type ConstructionContext = {
  cantiereId: string
  timeline: TimelineEvent[]
  lastActivity?: TimelineEvent
  statistics: {
    photos: number
    reports: number
    documents: number
    sal: number
    workers: number
  }
  alerts: ContextAlert[]
  suggestions: ContextSuggestion[]
  lastUpdated: Date
}
```

---

## Timeline

Contiene gli eventi gia' normalizzati.

---

## Statistics

Valori aggregati.

Mai calcolati dalla UI.

---

## Alerts

Situazioni che richiedono attenzione.

Esempi:

- nessun rapportino oggi
- documentazione incompleta
- SAL non aggiornato
- documenti mancanti

---

## Suggestions

Proposte generate dal Context Engine.

Non decisioni automatiche.

---

## Ruolo del Fascicolo

Il Fascicolo deve leggere un ConstructionContext.

Non deve conoscere:

- foto
- rapportini
- documenti
- SAL
- economia
- operai

---

## Ruolo della Dashboard

La Dashboard deve usare il Context.

---

## Ruolo dell'AI

L'AI Observer osserva il Context.

Non il database.

---

## Roadmap

### V1

- Timeline
- Statistiche
- Ultima attivita'

### V2

- Alerts
- Suggestions

### V3

- Context Snapshot
- AI Observer
- Decision Suggestions

### V4

- Digital Twin
- Time Machine

---

## Regole architetturali

- Un solo ConstructionContext per Fascicolo.
- Nessuna UI costruisce il Context.
- Solo Context Engine.
- Gli Engine comunicano tramite Context.
- Il Context e' read-only.
- L'utente prende sempre la decisione finale.
