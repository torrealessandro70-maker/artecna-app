# Cockpit Intelligence Engine

## Scopo

Il Cockpit Intelligence Engine interpreta il Runtime Feed e produce un riepilogo leggibile per il Cockpit.

Non usa AI.
Non prende decisioni.
Non esegue azioni.

Trasforma eventi Runtime in una situazione comprensibile.

## Flusso

Runtime Feed

↓

Cockpit Intelligence

↓

Cockpit Summary

↓

Cockpit ViewModel

↓

Cockpit

## Input

CockpitSummaryInput

- feedItems

## Output

CockpitSummary

- level
- title
- situation
- recentFacts
- attention
- suggestions
- nextAction
- generatedAt
- sourceEventCount

## Regole

La UI non deve leggere direttamente il Runtime Feed.

Il Cockpit deve ricevere solo un ViewModel già pronto.

Ogni evoluzione futura dovrà mantenere separati:

- Runtime
- Intelligence
- ViewModel
- UI

## Stato

Foundation V1 completata.
