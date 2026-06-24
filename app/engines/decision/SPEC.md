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

## Evoluzioni future

Alternative, criteri, rischi, motivazioni, conferme ed esecuzione richiederanno
specifiche e contratti dedicati. Non fanno parte di questa foundation.
