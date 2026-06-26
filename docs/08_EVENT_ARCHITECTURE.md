# 08 — Event Architecture

## Principio

ARTECNA OS è un Construction Operating System event-driven.

Ogni fatto rilevante del cantiere diventa un evento.

Il sistema non deve limitarsi a conservare informazioni in sezioni separate.
Deve riconoscere ciò che accade, trasformarlo in un evento comprensibile e
renderlo disponibile al Fascicolo, alla Timeline, al Context Engine e agli altri
moduli del prodotto.

## Definizione di Evento

Un evento rappresenta qualcosa che è accaduto, osservato, caricato, registrato o
proposto.

Esempi:

- foto scattata
- rapportino creato
- documento caricato
- SAL aggiornato
- pagamento registrato
- operaio presente
- firma cliente
- nota vocale
- suggerimento AI

Ogni evento descrive un fatto operativo. Non è solo un dato tecnico: è una parte
della storia del cantiere.

## Regola Fondamentale

Gli eventi non sono solo log.

Sono la memoria operativa del cantiere.

Un log registra che qualcosa è successo. Un evento, in ARTECNA OS, conserva il
significato operativo di ciò che è successo: a quale cantiere appartiene, da
dove arriva, quale elemento riguarda e perché può essere rilevante.

## Eventi e Fascicolo

Il Fascicolo non deve leggere direttamente moduli separati.

Deve ricevere eventi normalizzati.

Schema concettuale:

```text
Foto
Rapportini
Documenti
SAL
Economia
Operai
AI

→ Event Adapter

→ TimelineEvent[]

→ Fascicolo
```

In questo modello ogni area del sistema continua a svolgere il proprio compito,
ma espone ciò che accade sotto forma di eventi coerenti.

Il Fascicolo diventa così il punto di lettura unificato della storia del
cantiere, senza dipendere dalla struttura interna dei singoli moduli.

## Forma Concettuale Evento

```ts
type ConstructionEvent = {
  id: string
  source:
    | 'photo'
    | 'daily_report'
    | 'document'
    | 'sal'
    | 'economy'
    | 'worker'
    | 'ai'
    | 'system'
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

Questa forma è concettuale. Definisce il linguaggio comune degli eventi, non una
richiesta di implementazione immediata.

## Source

Il campo `source` indica l'origine dell'evento.

Esempi:

- `photo`: evento generato da una foto.
- `daily_report`: evento generato da un rapportino.
- `document`: evento generato da un documento.
- `sal`: evento generato da uno stato avanzamento lavori.
- `economy`: evento generato da un movimento economico.
- `worker`: evento generato da presenza, operaio o manodopera.
- `ai`: evento generato da una proposta o osservazione dell'AI.
- `system`: evento generato dal sistema.

La sorgente permette al Fascicolo di capire da dove arriva l'informazione senza
conoscere i dettagli interni del modulo che l'ha prodotta.

## Type

Il campo `type` descrive la natura specifica dell'evento.

Esempi:

- `photo.added`
- `daily_report.created`
- `document.uploaded`
- `sal.updated`
- `payment.registered`
- `worker.present`
- `client.signature.added`
- `voice_note.created`
- `ai.suggestion.created`

Il tipo deve essere chiaro, stabile e riutilizzabile nella Timeline, nel
Context Engine e nel Decision Engine.

## Event Adapter

L'Event Adapter è il livello concettuale che trasforma dati eterogenei in eventi
normalizzati.

Non decide.

Non interpreta in modo autonomo.

Non sostituisce i moduli esistenti.

Il suo compito è prendere un fatto proveniente da foto, rapportini, documenti,
SAL, economia, operai o AI e restituirlo in una forma leggibile dal Fascicolo.

## TimelineEvent

La Timeline del Fascicolo non deve essere costruita leggendo direttamente ogni
tabella o sezione.

Deve ricevere una lista ordinata di eventi.

Ogni `TimelineEvent` rappresenta un evento pronto per essere mostrato
all'utente:

- icona;
- titolo;
- descrizione;
- data o ora;
- origine;
- collegamento all'elemento originale.

In questo modo la Timeline diventa una memoria cronologica coerente e non una
somma di viste separate.

## Relazione con il Context Engine

Il Context Engine usa gli eventi per costruire consapevolezza.

Ogni evento modifica il contesto del Fascicolo:

- una foto può segnalare avanzamento o criticità;
- un rapportino può confermare lavorazioni eseguite;
- un documento può introdurre nuove informazioni economiche;
- un SAL può cambiare lo stato del cantiere;
- un pagamento può aggiornare la lettura finanziaria;
- un suggerimento AI può aprire una decisione da confermare.

Il contesto nasce dalla sequenza degli eventi, non da un singolo dato isolato.

## Relazione con il Decision Engine

Il Decision Engine osserva gli eventi e propone decisioni.

Esempi:

- dopo una foto di avanzamento, può proporre un aggiornamento SAL;
- dopo un documento caricato, può proporre una revisione economica;
- dopo più rapportini consecutivi, può proporre un riepilogo operativo;
- dopo un pagamento registrato, può aggiornare la situazione economica del
  cantiere;
- dopo una criticità, può proporre un'attività o una variante.

La decisione resta sempre all'utente.

## Principi

1. Ogni fatto rilevante diventa un evento.
2. Ogni evento appartiene a un Fascicolo.
3. Gli eventi non duplicano i dati originali.
4. Gli eventi collegano moduli diversi.
5. La Timeline nasce dagli eventi.
6. Il Context Engine legge eventi normalizzati.
7. Il Decision Engine propone a partire dagli eventi.
8. L'utente mantiene sempre il controllo.

## Visione

L'architettura event-driven permette ad ARTECNA OS di crescere senza creare
nuovi silos.

Ogni nuova funzionalità dovrà produrre eventi comprensibili dal Fascicolo.

Così il cantiere non sarà una raccolta di schermate, ma una memoria viva:
cronologica, collegata e pronta a supportare decisioni migliori.
