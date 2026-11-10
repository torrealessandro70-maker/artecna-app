# Stato: preparato, nessun SQL eseguito

La migration e questi validator NON sono stati applicati neppure a un database locale.
I test Node verificano contratto applicativo e proprietà statiche del SQL: non certificano
compilazione PL/pgSQL, permessi runtime o concorrenza PostgreSQL.

Target da validare successivamente: PostgreSQL 17.6, Supabase con ruoli anon/authenticated/service_role,
schema artecna_contabilita, auth.users e guard aziendali esistenti. Nessuna nuova ENV o Login.
Solo una futura autorizzazione esplicita consente di applicare SQL a un DB LOCALE usa-e-getta.

- `struttura-readonly.sql`: catalogo, tipi, PK, indice attivo, RLS, owner/search_path e ACL.
- `contratto-locale.sql`: richiede due UUID fixture `test_titolare` e `test_esterno`;
  primo titolare attivo, secondo utente non autorizzato. Tutto termina con ROLLBACK.
  Copre create idempotente, NULL/zero, importi, JWT, update obsoleto, archiviazione,
  reader attivi/storico, rifiuto SQL diretto e rifiuto anonimo/non titolare.
- `concorrenza-A.sql` e `concorrenza-B.sql`, preparati e non eseguiti: richiedono una
  voce fixture locale già creata e parametri test_titolare, test_id, test_revisione.
  A conserva la modifica non committata fino alla conferma dell'operatore. Il solo
  avvio in sequenza non prova concorrenza: osservare B in attesa di lock prima del COMMIT A.
  La prova realmente concorrente richiede due backend: sulla stessa voce e revisione,
  A esegue update in una transazione non conclusa; B invia update con la revisione originale.
  Dopo COMMIT di A, B deve ricevere SQLSTATE 40001 senza cambiare dati e senza retry.
  Non è stata eseguita; la prova sequenziale della revisione non la sostituisce.

Sicurezza: tabella privata con RLS FORCE e nessuna policy/ACL browser. Le quattro RPC
seguono il pattern contabile esistente, postgres SECURITY DEFINER con search_path fisso;
il proprietario/superuser può bypassare RLS, perciò ogni RPC chiama il guard aziendale
prima di leggere/scrivere. Nessuna nuova membership o modifica ai guard esistenti.

Non vi sono FK verso Cantieri, writer di pagamenti o integrazioni automatiche con IVA/F24.
Gli attori sono UUID di audit valorizzati dal guard DB, come nelle attribuzioni contabili:
nessuna nuova FK ad auth.users (che allargherebbe il grafo di dipendenze del catalogo protetto).
Importo pagato/data sono annotazioni manuali, non movimenti di cassa né quietanze.
La futura applicazione richiede un gate separato di compatibilità con catalogo/ACL esistenti:
non aggiornare automaticamente firme, guardie o baseline e non modificare migration 008–011.
