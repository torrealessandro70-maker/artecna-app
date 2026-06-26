# Event Engine

## Scopo

L'Event Engine definisce la fondazione event-driven di ARTECNA OS.

Il suo compito e' trasformare i fatti rilevanti del cantiere in eventi normalizzati, leggibili e riutilizzabili dagli altri sistemi del prodotto.

Un evento rappresenta qualcosa che e' accaduto, osservato, caricato, registrato o proposto: una foto aggiunta, un rapportino creato, un documento caricato, un SAL aggiornato, un movimento economico, una presenza operaio o un'osservazione AI.

## Regola Fondamentale

Gli eventi non sono semplici log tecnici.

Sono la memoria operativa del cantiere.

Ogni evento deve poter alimentare il Fascicolo, la Timeline, il Context Engine e i futuri sistemi decisionali senza duplicare informazioni.

## Responsabilita'

Event Engine V1 introduce:

1. Un tipo comune `ConstructionEvent`.
2. Un tipo visuale `TimelineEvent`.
3. Un builder puro per convertire eventi di costruzione in eventi di Timeline.
4. Una mappatura base tra sorgenti e icone.
5. Ordinamento cronologico decrescente.
6. Un Event Registry per orchestrare gli adapter disponibili.

## Event Registry V1

L'Event Registry e' il punto centrale in cui vengono registrati gli adapter dell'Event Engine.

Il suo scopo e' separare il builder dalle singole sorgenti: `builder.ts` non deve conoscere foto, rapportini, documenti, SAL, economia, operai o AI. Deve conoscere solo il registry.

Ogni adapter e' trattato come un plugin: riceve un input gia' disponibile, interpreta una specifica sorgente e produce `ConstructionEvent[]` normalizzati.

Flusso concettuale:

```text
input
  -> registry
  -> adapters
  -> ConstructionEvent[]
  -> TimelineEvent[]
```

Adapter attivi in V1:

- `photo`
- `daily_report`
- `document`

Adapter futuri:

- `sal`
- `economy`
- `worker`
- `ai`

## Adapter Plugin Pattern

Ogni nuova categoria evento deve passare da un adapter dedicato.

Un adapter deve:

1. Dichiarare la propria sorgente.
2. Ricevere solo dati gia' disponibili.
3. Non creare query.
4. Non modificare dati.
5. Restituire solo `ConstructionEvent[]`.
6. Lasciare al builder la conversione in `TimelineEvent[]`.

Nessuna UI deve costruire eventi direttamente.

La UI puo' passare dati gia' caricati all'Event Engine, ma non deve conoscere le regole di normalizzazione degli eventi.

Gli Engine futuri devono consumare `ConstructionEvent[]` come formato comune di memoria operativa.

## Regole

1. L'Event Engine non legge direttamente da database.
2. L'Event Engine non crea query.
3. L'Event Engine non modifica dati.
4. L'Event Engine non dipende dalla UI.
5. L'Event Engine riceve eventi gia' disponibili e restituisce strutture normalizzate.
6. Ogni sorgente deve produrre eventi coerenti con `ConstructionEvent`.
7. Il Fascicolo deve consumare eventi normalizzati, non moduli separati.
8. Ogni nuova categoria evento deve avere un adapter dedicato.
9. Nessuna UI deve costruire eventi direttamente.
10. Gli Engine futuri devono consumare `ConstructionEvent[]`.

## Forma Concettuale

```ts
type ConstructionEvent = {
  id: string
  source: 'photo' | 'daily_report' | 'document' | 'sal' | 'economy' | 'worker' | 'ai' | 'system'
  type: string
  title: string
  description?: string
  occurredAt: string
  createdAt?: string
  entityId?: string
  entityType?: string
  cantiereId?: string
  metadata?: Record<string, unknown>
}
```

## Roadmap

### V1

- Tipi base.
- Builder Timeline.
- Event Registry.
- Adapter plugin pattern.
- Adapter attivi: `photo`, `daily_report`, `document`.
- Mappatura sorgenti e icone.
- Ordinamento eventi.

### V2

- Adapter per SAL, economia, operai e AI.
- Normalizzazione progressiva degli eventi del Fascicolo.
- Integrazione con Timeline del Cantiere.

### V3

- Collegamento con Context Engine.
- Eventi AI osservati e proposti.
- Eventi multi-Fascicolo.
- Regole di deduplicazione.

### V4

- Event stream unificato.
- Event replay per ricostruire la memoria del cantiere.
- Action Bar guidata dagli eventi.
- Timeline intelligente.
