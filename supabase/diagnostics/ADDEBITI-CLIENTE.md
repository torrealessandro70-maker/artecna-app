# Addebiti cliente da fatture fornitori

Solo sviluppo locale. Nessun collegamento o dato PERNICONE applicato automaticamente.

## Perimetro

Nel Registro fatture, aprire le righe di una fattura ordinaria. La sezione
“Addebiti aggiuntivi al cliente” elenca le quote già registrate in materiali_cantiere
con UUID della riga fattura e del cantiere. Anche una fattura completamente assegnata
è utilizzabile: la disponibilità per addebito è distinta dal residuo da assegnare.

Le quote già in Economia conservano il ponte raccolta → Variante esistente;
questo percorso non le ricopia come costi o come nuove sorgenti contrattuali.
Un costo storico privo di fattura_riga_id verificabile richiede riconciliazione
esplicita: nome cliente, importo e riferimento testuale non provano l'identità.
Gli archivi personali non sono addebitabili come contratti commerciali.

## Operazione

Scegliere la quota e la quantità fisica, indicare il prezzo totale da addebitare,
IVA inclusa/esclusa e aliquota dell'addebito, descrizione, motivo e riferimento.
Il costo originario è consultabile ma non viene modificato. L'anteprima SQL
calcola l'imponibile e il contratto risultante dopo l'approvazione. Non usa il
totale lordo della fattura come imponibile e non applica il ribasso originale.

Confermare crea una sola Variante in bozza e una macro-voce “a corpo”. La quantità
fisica e la sua U.M. rimangono nello snapshot di provenienza e nelle note.
Questa rappresentazione evita scarti monetari dei prezzi unitari frazionari.
Proposta e approvazione utilizzano le RPC ordinarie. La procedura esistente di
approvazione importa le nuove voci nel SAL atomicamente; le vecchie righe SAL
non vengono riscritte. La bozza non modifica il valore contrattuale.

La quantità resta riservata durante bozza/proposta/approvazione. Il modello
libera la disponibilità negli stati rifiutata/annullata, esclusivamente dopo una
transizione autorizzata. Non è aggiunta una nuova azione di annullamento.
La voce originata dall'addebito è congelata: una sostituzione successiva richiede
una procedura tracciata, senza riscrivere provenienza e audit. Le dipendenze restano conservate anche
dopo annullamento: Hard Delete del cantiere interessato viene bloccato dai trigger,
senza cancellazioni a cascata. I cantieri ordinari conservano il percorso V3.

## Sicurezza

RPC con ricerca qualificata e search_path pg_catalog,pg_temp; JWT canonico e
autorizzazione impresa/cantiere per UUID, anche nelle transizioni di Variante.
Audit privato senza grant alle API, trigger contro modifiche dirette ai dati
collegati e controllo dei ruoli proprietari/amministrativi nel gate.
Token SHA-256 dell'anteprima e lock di cantiere/quota/riga; richiesta UUID
idempotente, contenuto diverso rifiutato. La sessione browser conserva la richiesta
incerta e permette solo una verifica manuale dello stesso invio, senza retry automatici.
Nessun secondo costo, fattura emessa o incasso viene creato.

## Installazione manuale, da autorizzare separatamente

Runner: supabase/diagnostics/RUN-addebiti-cliente.ps1, Windows PowerShell 5.1.
La modalità predefinita o -VerifyOnly verifica sigilli e confini transazionali,
senza connessioni. Le altre modalità richiedono -Candidate (SHA completo del
commit locale certificato) e -Psql (percorso di psql.exe).

- -PrecheckOnly: PSQL_EXITCODE=0, COMMIT_COUNT=0, ROLLBACK_COUNT=1,
  ARTECNA_ADDEBITI_PRECHECK_READONLY_GREEN.
- -ApplyOnce: precheck, singolo COMMIT atomico e postcheck READ ONLY;
  PSQL_EXITCODE=0, COMMIT_COUNT=1, ROLLBACK_COUNT=2,
  DATI_INVARIATI=true nel log originale e ARTECNA_ADDEBITI_APPLY_POSTCHECK_GREEN.
- -PostcheckOnly: PSQL_EXITCODE=0, COMMIT_COUNT=0, ROLLBACK_COUNT=1,
  ARTECNA_ADDEBITI_POSTCHECK_READONLY_GREEN. Gate di installazione, prima di
  qualsiasi nuovo addebito: richiede audit ancora vuoto.

Il runner controlla HEAD, parent f84d687f61a7e3a4e5592aaa6d9d6a31e333e1bc,
worktree CLEAN e gli SHA-256 SQL. La password viene richiesta solo dal prompt
nativo psql (-X -W). Le letture usano default_transaction_read_only=on nella
sola connessione, REPEATABLE READ READ ONLY, ON_ERROR_STOP e ROLLBACK.
L'apply crea once.lock con CreateNew prima della connessione. In caso di errore
o risultato incerto conservare log e lock, fermarsi e verificare lo stato in
sola lettura. Mai cancellare il lock per ritentare automaticamente.

L'impronta pre/post confronta cantieri/classificazione, accordi, lavorazioni,
SAL, fatture clienti e fornitori, acconti/incassi, materiali, Economia, varianti,
RPC Varianti/SAL/Hard Delete, notifiche e Cron. Non stampa UUID o payload.
La migrazione aggiunge il ledger e i trigger: nessun backfill o classificazione.

## Fixture e limiti

Contratto originale1600, accordo confermato1300, quota già assegnata2PZ/costo50,
addebito62 netto (anche75,64 lordo al22%): bozza1300, approvato1362, costo50
una sola volta; storico SAL e dati finanziari preservati. Prove di permessi,
UPDATE diretti con RLS disabilitata solo localmente, token obsoleto, richieste
identiche/diverse concorrenti e rollback prima del COMMIT. Chrome usa i componenti
reali e un ponte esclusivamente loopback alle RPC PostgreSQL17.6 sintetiche.

Regressioni ribasso/Hard Delete ordinario eseguite con la nuova migrazione;
gli importi TESTA39517,85 e PIDATELLA22750,05 sono verificati in fixture.
Le prove non certificano il contenuto o l'associazione di una fattura Production.
Restano separati i limiti storici della baseline e la scala10 Hard Delete non
rieseguita per evitare la saturazione del disco. Nessuna build Linux locale.
