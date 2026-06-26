# Workflow Engine

## Scopo

Il Workflow Engine definisce come ARTECNA OS trasforma un fatto di cantiere in un percorso operativo leggibile, verificabile e controllato dall'utente.

Un workflow non esegue azioni direttamente.

Un workflow descrive:

1. Il fatto osservato.
2. L'evento generato.
3. Il contesto aggiornato.
4. La proposta operativa.
5. L'azione disponibile.
6. La conferma richiesta all'utente.

## Cos'e' un Workflow

Un workflow e' una sequenza descrittiva di step che collega gli Engine del sistema senza accoppiarli alla UI, al database o a query dirette.

La sua responsabilita' e' rappresentare il percorso:

```text
User Action
  -> Event Engine
  -> Context Engine
  -> Decision Engine
  -> Action Engine
  -> UI / Handler
```

In V1 il Workflow Engine produce solo strutture descrittive.

Non contiene AI.
Non crea query.
Non modifica dati.
Non esegue azioni.

## Regola Fondamentale

Nessun workflow esegue azioni senza conferma esplicita dell'utente.

Il sistema osserva.
Il sistema propone.
L'utente decide.
Solo dopo il sistema agisce.

## Relazione con Event Engine

L'Event Engine trasforma fatti di cantiere in eventi normalizzati.

Il Workflow Engine non genera eventi reali in V1: descrive quale evento dovrebbe nascere dal fatto osservato.

Per il Photo Workflow, il fatto `foto aggiunta` viene descritto come evento futuro `photo_added`.

## Relazione con Context Engine

Il Context Engine interpreta gli eventi e aggiorna il ConstructionContext.

Il Workflow Engine non aggiorna il contesto in V1: descrive quale parte del contesto dovrebbe essere aggiornata.

Per il Photo Workflow, lo step previsto e' l'aggiornamento di `context.statistics.photos`.

## Relazione con Decision Engine

Il Decision Engine genera proposte operative.

Il Workflow Engine non decide e non valuta condizioni reali in V1: descrive la proposta attesa quando il contesto segnala una necessita' operativa.

Per il Photo Workflow, la proposta prevista e' `Creare rapportino` se mancano rapportini collegati.

## Relazione con Action Engine

L'Action Engine esegue solo azioni confermate.

Il Workflow Engine non chiama handler in V1: descrive l'azione che potrebbe diventare disponibile dopo una decision proposal.

Per il Photo Workflow, l'azione prevista e' `open_daily_report`.

## Photo Workflow V1

Il primo workflow completo e' il Photo Workflow.

Step previsti:

1. Photo Added
2. Event Generated
3. Context Updated
4. Decision Proposed
5. Action Available
6. Waiting User Confirmation

Questo workflow e' solo una fondazione descrittiva.

## Risultato Workflow

Ogni workflow puo' esporre un `summary` opzionale.

Il `summary` e' una frase breve pensata per rendere leggibile lo stato del workflow senza dover interpretare tutti gli step. Nel Photo Workflow V1 puo' indicare il cantiere e il numero di foto gia' presenti nel contesto quando questi dati sono disponibili.

Ogni workflow puo' esporre anche `metadata` opzionali:

```ts
metadata?: {
  workflowType: string
  version: string
  generatedAt: string
}
```

`workflowType` identifica la famiglia del workflow, per esempio `photo`.

`version` identifica la versione descrittiva del workflow. Il Photo Workflow V1 usa `1.0`.

`generatedAt` indica quando la struttura descrittiva e' stata generata. In V1 serve solo come supporto al debug futuro e non implica esecuzione, salvataggio o query.

## Versionamento Workflow

Il versionamento permette di evolvere un workflow senza confondere la UI, gli smoke test e i futuri handler.

Una nuova versione puo' cambiare il contenuto descrittivo, arricchire i metadata o introdurre nuovi step futuri, ma non deve eseguire azioni senza conferma esplicita dell'utente.

## Smoke Test V1

Il Workflow Engine espone `runWorkflowEngineSmokeTest()` come verifica minima della fondazione V1.

Lo smoke test:

1. Chiama `buildPhotoWorkflow()` con input minimo.
2. Verifica che il risultato sia presente.
3. Verifica che il workflow contenga step.
4. Verifica la presenza dello step `Photo Added`.
5. Verifica la presenza dello step `Waiting User Confirmation`.

Lo smoke test non deve lanciare errori.

Restituisce sempre una struttura:

```ts
{
  success: boolean
  checks: Array<{ name: string; passed: boolean; reason?: string }>
}
```

In V1 lo smoke test non esegue azioni, non crea query, non usa AI e non modifica dati.

## Roadmap

### Photo Workflow

Descrive il percorso da foto aggiunta a proposta di creazione rapportino.

### Daily Report Workflow

Descrivera' il percorso da rapportino creato o modificato a eventi, contesto e proposte operative.

### Document Workflow

Descrivera' il percorso da documento caricato a classificazione, contesto e suggerimenti.

### SAL Workflow

Descrivera' il percorso da avanzamento lavori a stato economico, verifiche e proposte.

### Construction Workflow

Descrivera' workflow trasversali che combinano foto, rapportini, documenti, SAL e osservazioni AI.
