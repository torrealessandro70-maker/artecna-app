# Decision Engine Foundation

## Missione

Definire i contratti di base con cui ARTECNA OS potra preparare, in futuro,
piani decisionali tipizzati e verificabili.

## Ambito di questa fase

La foundation introduce esclusivamente:

- `DecisionContext`, che descrive il contesto disponibile;
- `DecisionOperation`, che rappresentera una possibile operazione;
- `DecisionPlan`, che raccoglie le operazioni proposte;
- `DecisionBuilder`, che espone il punto di costruzione del piano.

## Comportamento

Il builder accetta un contesto e restituisce sempre un piano vuoto:

```ts
{ operations: [] }
```

Non interpreta il contesto e non genera operazioni.

## Confini

Il Decision Engine non:

- modifica dati;
- accede al database;
- usa servizi esterni;
- dipende dalla UI;
- conferma o applica decisioni;
- esegue le operazioni descritte nei piani.

## Context Suggestions

Il Decision Engine puo' trasformare le `ContextSuggestion` in un `DecisionPlan` composto da sole proposte.

La funzione `buildDecisionsFromContextSuggestions` non esegue azioni automatiche, non crea query e non modifica dati.

Mappature V1:

- `create_report` genera la proposta "Creare rapportino";
- `upload_document` genera la proposta "Caricare documento";
- `start_activity` genera la proposta "Registrare prima attività".

Ogni proposta resta nello stato `proposed` e richiede conferma utente prima di qualunque azione futura.

## Action Metadata

Ogni `DecisionProposal` puo' contenere un campo opzionale `action`.

L'action e' solo metadato descrittivo.

Non genera click automatici, non esegue operazioni, non apre schermate e non modifica dati.

Mappature V1:

- `create_report` usa `open_daily_report` con label "Apri rapportino";
- `upload_document` usa `open_document_upload` con label "Carica documento";
- `start_activity` usa `open_activity_note` con label "Registra attivita".

Il campo `action` prepara integrazioni future, ma in questa fase non abilita alcuna esecuzione.

## Stato delle Proposte

Ogni `DecisionProposal` possiede uno stato.

Stati previsti:

- `proposed`: proposta generata dal Decision Engine e in attesa di valutazione;
- `accepted`: stato futuro per una proposta accettata dall'utente;
- `rejected`: stato futuro per una proposta rifiutata dall'utente;
- `executed`: stato futuro per una proposta eseguita dopo conferma.

In V1 il Decision Engine genera solo proposte con stato `proposed`.

Gli stati `accepted`, `rejected` ed `executed` sono riservati a flussi futuri.

Nessuna azione viene eseguita automaticamente.

L'utente decide sempre.

## Execution Guard

Il Decision Engine espone `canExecuteDecisionProposal` come guard di sicurezza per flussi futuri.

Regola V1:

- una proposta puo' essere eseguita solo se `status` e' `accepted`;
- `proposed` e' solo lettura e non consente esecuzione;
- `rejected` non consente esecuzione;
- `executed` non consente una nuova esecuzione.

Il guard non esegue nulla.

Il guard non cambia lo stato della proposta.

L'utente deve confermare esplicitamente prima che una proposta possa passare allo stato `accepted`.

Lo stato `executed` sara' usato solo in flussi futuri di esecuzione controllata.

## Accettazione Proposta

Il Decision Engine espone `acceptDecisionProposal` come funzione pura per accettare una proposta.

La funzione restituisce una nuova `DecisionProposal` con `status: 'accepted'`.

Non muta l'oggetto originale.

Non esegue l'action associata.

Non chiama il guard di esecuzione.

`accepted` significa che l'utente ha confermato la proposta.

`accepted` non significa che l'azione sia stata eseguita.

L'esecuzione e' una fase futura separata e controllata.

## Rifiuto Proposta

Il Decision Engine espone `rejectDecisionProposal` come funzione pura per rifiutare una proposta.

La funzione restituisce una nuova `DecisionProposal` con `status: 'rejected'`.

Non muta l'oggetto originale.

Non esegue l'action associata.

`rejected` significa che l'utente ha ignorato o rifiutato la proposta.

`rejected` non elimina dati.

`rejected` non esegue azioni.

## Marcatura Executed

Il Decision Engine espone `markDecisionProposalExecuted` come funzione pura per marcare una proposta come `executed`.

La funzione usa `canExecuteDecisionProposal`.

Se la proposta non puo' essere eseguita, restituisce la proposta invariata.

Se la proposta puo' essere eseguita, restituisce una nuova `DecisionProposal` con `status: 'executed'`.

Non esegue l'action associata.

Non chiama Supabase.

Non crea rapportini, documenti o attivita'.

`executed` e' solo uno stato finale.

`executed` non rappresenta ancora un'esecuzione reale.

L'esecuzione reale arrivera' in un futuro Action Executor separato.

## Decision Lifecycle

### proposed

`proposed` indica una proposta generata dal sistema.

E' uno stato di sola lettura.

Nessuna azione viene eseguita.

### accepted

`accepted` indica una conferma esplicita dell'utente.

Abilita una potenziale esecuzione futura.

Non esegue ancora nulla.

### rejected

`rejected` indica una proposta ignorata o rifiutata dall'utente.

Non elimina dati.

Non esegue nulla.

### executed

`executed` indica uno stato finale.

In V1 e' solo una marcatura logica.

L'esecuzione reale arrivera' con un futuro Action Executor.

### Regola Fondamentale

Nessuna proposta puo' passare a `executed` se non e' `accepted`.

### Principio ARTECNA OS

L'Engine propone.

L'utente conferma.

Solo dopo il sistema potra' agire.

## Evoluzioni future

Alternative, criteri, rischi, motivazioni, conferme ed esecuzione richiederanno
specifiche e contratti dedicati. Non fanno parte di questa foundation.
