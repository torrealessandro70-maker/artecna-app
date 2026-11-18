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

Il runner controlla HEAD, parent 8a3c7d9ac372f3ec9ee02ce27c2711ec3c72c876
e il suo parent Production f84d687f61a7e3a4e5592aaa6d9d6a31e333e1bc,
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

Contratto originale1600, accordo confermato1300, quota già assegnata2PZ/costo62,
addebito62 netto (anche75,64 lordo al22%): bozza1300, approvato1362, costo62
una sola volta; storico SAL e dati finanziari preservati. Prove di permessi,
UPDATE diretti con RLS disabilitata solo localmente, token obsoleto, richieste
identiche/diverse concorrenti e rollback prima del COMMIT. Chrome usa i componenti
reali e un ponte esclusivamente loopback alle RPC PostgreSQL17.6 sintetiche.

Regressioni ribasso/Hard Delete ordinario eseguite con la nuova migrazione;
gli importi TESTA39517,85 e PIDATELLA22750,05 sono verificati in fixture.
Le prove non certificano il contenuto o l'associazione di una fattura Production.
Restano separati i limiti storici della baseline e la scala10 Hard Delete non
rieseguita per evitare la saturazione del disco. Nessuna build Linux locale.

## Verifica separata delle destinazioni

FATTURA_ASSEGNATA_CANTIERE=SUPPORTATA. L'azione del Registro legge le quote
materiali_cantiere tramite fattura_riga_id e cantiere_id: non usa una raccolta
Economia e non dipende dal residuo ancora da assegnare della fattura. Una quota
già completamente attribuita può creare la Variante in bozza senza un secondo costo.

FATTURA_ASSEGNATA_ECONOMIA=SUPPORTATA attraverso il flusso già esistente:
fatture_fornitori_righe → economia_righe → valorizza_materiale_economia →
usa_raccolta_economia_cliente_in_variante → proposta/approvazione ordinarie.
Il nuovo pulsante del Registro non ricopia una quota Economia come costo diretto:
per tale origine si usa il prezzo cliente netto nella raccolta e “Crea proposta”.
L'acquisizione riguarda tutte le righe incluse della raccolta, non una selezione
arbitraria della singola riga già congelata. Le raccolte già acquisite non creano
una seconda Variante e non sono rivalorizzate automaticamente.

Le prove PostgreSQL includono: origine diretta, origine Economia con costo62 e
prezzo cliente diverso poi concordato62, contratto ribassato18,75% che resta1300
in bozza e diventa1362 soltanto dopo approvazione, richieste duplicate/concurrenti,
revisioni obsolete, quote miste4 unità (2 dirette +1 Economia +1 residua), addebito
parziale e storico senza UUID. Chrome esegue entrambi i componenti reali su loopback.
Il codice applicativo e la migrazione 20261118000100 restano invariati rispetto
al commit 8a3c7d9ac372f3ec9ee02ce27c2711ec3c72c876.

## Diagnostica della quota reale, soltanto manuale

RUN-addebiti-origini-readonly.ps1 -VerifyOnly non connette alcun database.
Per la lettura manuale usare Windows PowerShell5.1 e psql18 con:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
 -File 'C:\Users\torre\artecna-app\.worktrees\sdi-integrato\supabase\diagnostics\RUN-addebiti-origini-readonly.ps1' `
 -DiagnosiOnly -Candidate '<SHA_COMPLETO_DEL_CANDIDATO>' `
 -CantiereId '<UUID_CANTIERE_VERIFICATO>' -FatturaId '<UUID_FATTURA_VERIFICATO>' `
 -UtenteId '<UUID_UTENTE_APP_VERIFICATO>' `
 -Psql 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
```

Gli UUID devono essere forniti esplicitamente: non selezionare per nome, importo
o somiglianza. La diagnostica funziona anche prima della migrazione addebiti.
Classifica ogni riga come cantiere, Economia, mista, riferimento senza quota o
non pertinente; stampa soltanto R1/R2, conteggi ed esiti, senza importi o payload.
I costi storici del cantiere privi di riga UUID non sono associati alla fattura.
L'identità applicativa specificata viene verificata come esistente/autorizzata.
L'amministratore simula il contesto: non è una certificazione della sessione browser.
Il reader API è invocato come authenticated soltanto se i privilegi già esistenti
consentono SET ROLE; altrimenti è segnalato come non certificato, senza grant o bypass.

Esito completo: PSQL_EXITCODE=0, COMMIT_COUNT=0, ROLLBACK_COUNT=1,
ARTECNA_ADDEBITI_ORIGINI_READONLY_COMPLETATA. Il marker certifica il completamento
della lettura, non la disponibilità di una quota valida. In caso di STOP conservare
il tentativo e non ripetere automaticamente. Nessuna connessione Production è
stata eseguita nello sviluppo di questa diagnostica.
