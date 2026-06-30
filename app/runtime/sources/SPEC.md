# Runtime Sources

## Scopo

Le Runtime Sources trasformano i dati reali del Fascicolo in record standard leggibili dal Runtime.

Non leggono direttamente Supabase.
Non conoscono React.
Non aggiornano la UI.
Non eseguono azioni.

## Flusso

Fascicolo reale

↓

Runtime Source

↓

Runtime Feed

↓

Cockpit Intelligence

↓

Cockpit

## Regola

Ogni nuova integrazione reale deve prima passare da una Runtime Source.

Esempi:

- foto → photo-source
- rapportini → report-source
- documenti → document-source
- economia → economy-source
- operai → worker-source

## Stato

Foundation V1 completata con photo-source.
