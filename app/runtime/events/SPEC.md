# Runtime Event Factory

## Scopo

La Runtime Event Factory trasforma le Runtime Sources in Runtime Feed Items.

Serve a evitare duplicazione nei singoli bridge.

## Flusso

Runtime Source

↓

Runtime Event Factory

↓

Runtime Feed

↓

Cockpit Intelligence

↓

Cockpit

## Responsabilità

La factory:

- riceve RuntimeSourceRecord
- assegna la categoria corretta del feed
- mantiene metadata e sourceKind
- produce RuntimeFeedItem ordinati

## Regole

I bridge non devono più costruire manualmente RuntimeFeedItem.

Ogni bridge deve:

1. creare la propria Runtime Source
2. passarla alla Runtime Event Factory
3. restituire il Runtime Feed

## Stato

Foundation V1 completata.
