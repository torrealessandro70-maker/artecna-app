# Addebiti di gruppo — gate locale, nessuna autorizzazione ai dati reali

Migrazione separata `20261119000100_addebiti_materiali_gruppo.sql`, successiva alla 20261118000100.
La RPC singola e le migrazioni precedenti non vengono riscritte. Nessun backfill.
Il reader del nuovo gruppo sottrae entrambe le famiglie di riserve. L'anteprima singola
storica mantiene la propria semantica: un'eventuale quantità già riservata da un gruppo
viene comunque respinta dal nuovo trigger condiviso al momento dell'inserimento,
con rollback integrale. Non usare l'anteprima singola come disponibilità di gruppo.

Il gruppo usa un audit privato separato. Le riserve di gruppo e singole sono controllate
insieme da trigger, comprese le transizioni di stato. Ogni richiesta crea una sola Variante
in bozza e una macro-voce a corpo per ciascuna quota, con quantità fisica e UM conservate
nello snapshot. Nessun costo o assegnazione viene creato. Il prezzo cliente non eredita
il ribasso del contratto. L'IVA deve essere indicata e confermata anche quando è 0%.

La UI ripartisce il totale inserito proporzionalmente ai costi delle quantità selezionate,
usando centesimi interi e metodo dei maggiori resti; i pareggi seguono l'ordine delle righe.
Un risultato nullo su una riga viene respinto. Con IVA mista l'importo ripartito è quello
inserito, mentre il netto risultante viene mostrato separatamente nell'anteprima server.
Le richieste con esito incerto non vengono ritentate automaticamente; la chiave rimane
in sessionStorage per la successiva verifica delle Varianti.

## Precheck (passo futuro, manuale)

1. Verificare commit, hash di migrazione, precheck e postcheck con il manifesto SHA-256.
2. Eseguire esclusivamente il precheck READ ONLY con password nel prompt nativo psql.
3. Richiedere ExitCode 0, zero COMMIT, un ROLLBACK e il marker
   `ARTECNA_ADDEBITI_GRUPPO_PRECHECK_READONLY_GREEN`.
4. Registro migrazioni non leggibile/assente non significa registro vuoto: certificare
   l'assenza mediante tutti gli oggetti, le firme RPC, i trigger e il catalogo verificati.
   Una presenza parziale, una divergenza o un errore richiede STOP.

Comando da completare con lo SHA locale certificato, soltanto dopo autorizzazione
del precheck Production (non eseguito durante lo sviluppo):

```powershell
Set-Location 'C:\Users\torre\artecna-app\.worktrees\sdi-integrato'
powershell.exe -NoProfile -File '.\supabase\diagnostics\RUN-addebiti-gruppo-readonly.ps1' -PrecheckOnly -Candidate '<SHA_CERTIFICATO>' -Psql 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
```

## Apply (procedura separata, da autorizzare dopo il gate)

Nessun comando automatico di apply fa parte del precheck. Prima dell'applicazione occorre
certificare il nuovo SHA e preparare un runner sigillato sul candidato definitivo.
Il runner deve acquisire `once.lock` con CreateNew, rieseguire il preflight immediato,
confrontare impronte prima/dopo di fatture, debiti, costi, quote, contratti, SAL, Varianti,
RPC singole, sei producer e Cron. Deve usare ON_ERROR_STOP e il prompt nativo psql,
eseguire esattamente il file migrazione certificato (BEGIN/COMMIT già inclusi), quindi
il postcheck READ ONLY nello stesso processo psql. Attesi un COMMIT e due ROLLBACK.
Nessun retry automatico; esito incerto richiede verifica READ ONLY prima di procedere.
Il sigillo tecnico Hard Delete viene aggiornato esclusivamente per i nuovi oggetti/trigger.

Questa procedura non autorizza alcun addebito PERNICONE né il prezzo di 62 euro.
Economia conserva il proprio flusso di raccolta e Variante; il gruppo accetta solo quote
di `materiali_cantiere` appartenenti al medesimo UUID cantiere.
