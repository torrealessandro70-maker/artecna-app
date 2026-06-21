# Smart Daily Report Capability V1

## Missione

Smart Daily Report e la prima Capability completa di ARTECNA OS. Trasforma una
Review gia strutturata in un rapporto giornaliero tipizzato e pronto per essere
presentato all'utente.

## Input e output

La Capability riceve esclusivamente un `ReviewResult`. Produce un `DailyReport`
con operai, materiali, attivita, lavorazioni, problemi e foto suggerite,
mantenendo la Review originale come fonte verificabile.

## Conferma

La confidenza del rapporto deriva dalla Review. Ogni rapporto mantiene
`needsConfirmation` attivo: e una proposta e non un dato operativo confermato.

## Confini

La Capability non contiene UI, non chiama Supabase e non legge o scrive nel
database. Ogni eventuale salvataggio futuro dovra avvenire solo dopo la
conferma esplicita dell'utente.
