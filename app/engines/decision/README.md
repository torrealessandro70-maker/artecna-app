# Decision Engine

Foundation architetturale del Decision Engine di ARTECNA OS.

Il modulo espone contratti tipizzati per descrivere il contesto di una
decisione, le possibili operazioni e il piano risultante. In questa fase non
analizza dati, non propone alternative e non esegue operazioni.

## Utilizzo

```ts
import { DecisionBuilder } from '@/app/engines/decision'

const builder = new DecisionBuilder()
const plan = builder.build({ objective: 'Valutare una decisione futura' })
```

`plan.operations` e sempre un array vuoto.

## Stato attuale

- nessuna logica decisionale;
- nessuna persistenza;
- nessun accesso a servizi esterni;
- nessuna dipendenza dalla UI;
- nessuna esecuzione di operazioni.

La specifica completa dei confini iniziali e disponibile in `SPEC.md`.
