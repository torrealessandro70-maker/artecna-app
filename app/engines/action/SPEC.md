# Action Engine

## Ruolo

L'Action Engine definisce la fondazione dell'Action Executor di ARTECNA OS.

Il suo compito futuro sara' eseguire azioni richieste dal sistema dopo conferma esplicita dell'utente.

In questa fase non esegue alcuna azione reale.

## Responsabilita'

Il flusso concettuale e':

```text
Decision Engine -> propone
UI -> richiede
Action Executor -> esegue
```

Il Decision Engine genera proposte.

La UI potra' richiedere l'esecuzione di una proposta confermata.

L'Action Executor sara' l'unico punto autorizzato a modificare il sistema.

## Principio Fondamentale

L'Action Executor e' l'unico punto autorizzato a modificare il sistema.

Nessun altro Engine deve eseguire direttamente azioni che modificano dati, file, stati o workflow.

## V1

La V1 introduce:

- `ActionRequest`
- `ActionResult`
- `ActionHandler`
- `executeAction`
- registry attivo con handler stub

`executeAction` cerca un handler registrato per `action.type`.

Se non esiste un handler, restituisce:

```ts
{
  success: false,
  executed: false,
  reason: 'Nessun handler registrato per questa azione'
}
```

Se esiste un handler, delega a `handler.handle(action)`.

## Registry V1

Il registry V1 e' attivo e tipizzato.

Serve a definire il punto unico in cui vengono registrati gli handler disponibili.

Nessuna azione reale puo' essere eseguita senza un handler registrato.

Gli handler futuri dovranno essere espliciti, tipizzati e verificabili.

## Handler Stub V1

La V1 registra tre handler stub:

- `open_daily_report`
- `open_document_upload`
- `open_activity_note`

Ogni handler restituisce:

```ts
{
  success: false,
  executed: false,
  reason: 'Handler non ancora operativo'
}
```

Gli handler stub non:

- modificano dati
- aprono UI
- chiamano Supabase
- creano documenti
- creano rapportini
- creano attivita'
- eseguono workflow

Gli handler reali saranno collegati solo dopo conferma esplicita dell'utente e con specifiche dedicate.

## Smoke Test V1

L'Action Engine espone `runActionEngineSmokeTest` come verifica interna del comportamento base.

Lo smoke test controlla:

- `open_daily_report`: handler stub trovato, `success: false`, `executed: false`
- `unknown_action`: nessun handler, `success: false`, `executed: false`

Lo smoke test non lancia errori se un controllo fallisce.

Lo smoke test non esegue azioni reali.

Lo smoke test restituisce:

```ts
{
  success: boolean,
  checks: Array<{
    name: string,
    passed: boolean,
    reason?: string
  }>
}
```

## Limiti V1

La V1 non:

- crea query
- modifica dati
- chiama Supabase
- crea documenti
- crea rapportini
- crea attivita'
- esegue workflow
- invia notifiche
- apre UI

## Roadmap

### V1

Fondazione.

### V2

Registry.

### V3

Handler reali.

### V4

Workflow transazionali.
