# Construction Knowledge Layer V1

## Missione

Il Construction Knowledge Layer fornisce ad ARTECNA OS un vocabolario
condiviso per riconoscere concetti e termini propri del lavoro edile.

## Parser e semantica

Un parser struttura il contenuto di un input. Il livello semantico attribuisce
invece un significato di dominio ai termini riconosciuti, classificandoli come
zone, materiali, lavorazioni, attivita o date.

## Cosa fa

- analizza testo senza servizi esterni;
- riconosce termini presenti nel dizionario edilizio;
- restituisce entita normalizzate, classificate e prive di duplicati.

## Cosa non fa

Non usa AI, non modifica la UI, non prende decisioni operative, non chiama
Supabase e non salva i risultati.

## Regola fondamentale

Il Construction Knowledge Layer non scrive nel database.

## Evoluzione

In futuro potra fornire informazioni semantiche al Report Engine, al Context
Engine e al Decision Engine mantenendo separati riconoscimento, contesto e
decisione.
