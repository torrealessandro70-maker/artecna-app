# ARTECNA OS - Runtime Event Catalog V1

## Principio

Ogni funzionalita importante deve produrre un evento Runtime.

La UI non aggiorna direttamente il Cockpit.
La UI pubblica eventi.
Il Runtime osserva gli eventi.
Il Cockpit racconta cosa sta succedendo.

Flusso:

Evento
↓
Event Bus
↓
Runtime Feed
↓
Cockpit

---

## Eventi iniziali

| Evento | Chi lo pubblica | Chi lo ascolta | Effetto nel Cockpit |
|---|---|---|---|
| photo_added | Fotocamera / Fascicolo | Feed, Context, AI | Mostra foto acquisita |
| document_uploaded | Document Intelligence | Feed, Workflow | Mostra documento ricevuto |
| workflow_started | Workflow Runtime | Feed, Cockpit | Mostra workflow avviato |
| decision_suggested | Decision Engine | Feed, Review | Mostra proposta ARTECNA |
| decision_confirmed | Utente / Decision Engine | Feed, Action | Mostra decisione confermata |
| action_executed | Action Engine | Feed, Runtime Store | Mostra azione eseguita |
| review_required | Review Engine | Feed, Attention | Mostra verifica richiesta |
| mission_started | Mission Runtime | Feed, Cockpit | Mostra missione avviata |
| mission_step_completed | Mission Runtime | Feed, Cockpit | Mostra avanzamento missione |

---

## Regola di sviluppo

Prima di creare una nuova funzione chiedersi:

Quale evento Runtime produce?

Ogni nuovo componente Runtime deve produrre un miglioramento percepibile nel Cockpit.

---

## Stato

V1 iniziale.
Da collegare progressivamente a:

- Event Bus
- Runtime Feed Bridge
- Runtime Store
- Cockpit ViewModel
