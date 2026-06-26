# 10 — Workflow Architecture

## Visione

Un workflow è il percorso che trasforma un fatto di cantiere in una proposta operativa.

Esempio:

foto caricata → evento → contesto → proposta → conferma utente → azione.

## Pipeline

User Action
↓
Event Engine
↓
Context Engine
↓
Decision Engine
↓
Action Engine
↓
UI / Handler

## Regola fondamentale

Nessun workflow esegue azioni senza conferma esplicita dell’utente.

## Ruolo Event Engine

Trasforma fatti in eventi.

## Ruolo Context Engine

Interpreta gli eventi e aggiorna il ConstructionContext.

## Ruolo Decision Engine

Genera proposte operative.

## Ruolo Action Engine

Esegue solo azioni confermate.

## Ruolo UI

Visualizza stato, proposte e richieste di conferma.

## Primo workflow previsto

Photo Workflow V1:

- foto aggiunta
- evento photo_added
- aggiornamento context.statistics.photos
- suggestion se mancano rapportini
- decision proposal “Creare rapportino”
- action metadata open_daily_report
- futura conferma utente

## Roadmap

V1:

- documentazione workflow
- workflow foto teorico

V2:

- workflow foto UI sicuro

V3:

- conferma proposta

V4:

- handler reale

V5:

- AI Observer

## Principio ARTECNA OS

Il sistema osserva.
Il sistema propone.
L’utente decide.
Solo dopo il sistema agisce.
