# Calendar Engine

Foundation architetturale del Calendar Engine di ARTECNA OS.

Il modulo definisce i contratti condivisi per descrivere una richiesta di
creazione evento, il provider di destinazione e il risultato futuro della
creazione.

## Provider previsti

- `google`
- `outlook`
- `apple_ics`
- `internal`

## Stato attuale

Questa foundation esporta soltanto tipi TypeScript. Non contiene provider
eseguibili, non effettua chiamate esterne, non usa OAuth e non salva eventi.

Le integrazioni reali richiederanno una specifica successiva, configurazione
esplicita e gestione delle autorizzazioni del provider.
