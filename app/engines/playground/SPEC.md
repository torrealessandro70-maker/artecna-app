# Engine Playground V1

## Missione

Il Playground esegue scenari tecnici ripetibili per osservare il comportamento
degli Engine di ARTECNA OS senza dipendere dall'interfaccia utente.

## Cosa testa

Il Playground passa ogni input testuale al Kernel Orchestrator e al
Construction Knowledge Layer, quindi usa le entita riconosciute per produrre
anche un `ReviewResult`. Ogni scenario descrive l'input e i segnali attesi
utili alle verifiche presenti e future.

Questa pipeline permette di verificare che il racconto operativo venga
trasformato in entita edilizie prima delle successive elaborazioni degli
Engine.

Il `ReviewResult` e soltanto una proposta da sottoporre all'utente. Nessun dato
viene salvato senza la sua conferma.

## Cosa non fa

Il Playground non modifica la UI, non chiama Supabase, non applica modifiche ai
dati operativi e non sostituisce i test automatici.

## Regole

- il Playground non scrive nel database;
- ogni nuovo Engine dovrebbe avere almeno uno scenario dedicato.
