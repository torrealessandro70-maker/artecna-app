# Calendar Engine Foundation

## Missione

Definire i contratti con cui ARTECNA OS potra creare eventi di calendario in
modo esplicito, tipizzato e indipendente dai singoli provider.

## Contratti

### CalendarEventDraft

Descrive i dati ancora non persistiti di un evento: titolo, data, orari e
informazioni opzionali.

### CalendarProvider

Identifica il provider futuro tra `google`, `outlook`, `apple_ics` e
`internal`.

### CalendarCreateResult

Descrive il risultato che una futura integrazione restituira dopo un tentativo
di creazione.

## Confini di questa fase

Il Calendar Engine non:

- crea eventi;
- apre link di calendario;
- genera file `.ics`;
- effettua chiamate Google o Outlook;
- configura OAuth;
- accede al database;
- salva dati localmente;
- dipende dalla UI.

## Evoluzioni future

Ogni provider reale dovra avere un adapter dedicato, configurazione esplicita,
gestione delle autorizzazioni e comportamento di errore documentato. Nessun
adapter fa parte di questa foundation.
