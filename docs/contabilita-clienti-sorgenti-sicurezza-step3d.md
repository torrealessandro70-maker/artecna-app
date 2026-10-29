# Sorgenti clienti: scritture autorizzate sul server

Migrazione separata: `supabase/migrations/20261029_clienti_sorgenti_sicurezza.sql`. Non modifica la migrazione delle attribuzioni (`be0678bbd3f6cb386b9e7cd3c6283aa8c596547431a318fd653ce1c9babf92ee`), le sue funzioni/trigger, calcoli, storico, scollegamento o avviso UI.

## Regola aziendale

INSERT, UPDATE e DELETE ordinari di `fatture_emesse` e `acconti_cantiere` richiedono un UID autenticato e `artecna_guardie.utente_puo_operare_impresa(uid)` vero: titolare attivo nel registro aziendale. Se `cantiere_id` è presente, serve anche `utente_puo_modificare_cantiere(uid,cantiere_id)`: membership owner del Cantiere effettivo, non un confronto per nome. Si riusano i guard reali acquisiti; nessun campo owner della riga viene inventato.

Le origini senza `cantiere_id` sono documenti non assegnati dell'impresa: resta obbligatorio essere titolare attivo. Non vengono dedotti UUID dal nome. Questo consente la gestione delle fatture storiche/importate non assegnate; non le rende attribuibili, perché la RPC di attribuzione continua a richiedere un Cantiere verificato. Più titolari attivi possono gestire questi documenti d'impresa: non sono documenti personali del loro creatore.

La policy UPDATE verifica sia la riga esistente (`USING`) sia il contesto nuovo (`WITH CHECK`). Non si può spostare una sorgente su un Cantiere non autorizzato. La regola non dipende dalla presenza di quote, quindi opera anche senza collegamenti e dopo lo scollegamento.

## Delta dei permessi

| Oggetto/ruolo | Prima | Dopo |
|---|---|---|
| fatture: policy INSERT/UPDATE/DELETE | permissive true per anon/authenticated | authenticated, predicate aziendale/context; UPDATE con controllo vecchio e nuovo |
| acconti: RLS | disabilitata | abilitata; policy INSERT/UPDATE/DELETE con lo stesso predicate |
| anon/PUBLIC, grant di scrittura sulle due sorgenti | anon aveva tutti i privilegi | revocati; ad anon rimane SELECT |
| authenticated, grant sorgenti | tutti i privilegi | SELECT/INSERT/UPDATE/DELETE; nessun TRUNCATE/REFERENCES/TRIGGER/MAINTAIN |
| letture sorgenti | permissive legacy | preservate, non certificate come isolamento cross-user |
| service_role, owner, cleanup amministrativo | privilegi storici | invariati |

Nuovo schema `artecna_clienti_sicurezza`, owner postgres, USAGE soltanto ad authenticated oltre al proprietario. Unico helper `puo_scrivere_sorgente(uuid) → boolean`, STABLE SECURITY DEFINER, `search_path=pg_catalog,pg_temp`, EXECUTE solo authenticated oltre al proprietario. Non è una nuova RPC pubblica; lo schema di test/API resta `public`. L'helper permette alle policy di riusare guard privati senza concederne direttamente EXECUTE o aprire i loro schemi.

La migrazione rifiuta namespace già presente, prerequisiti mancanti, policy non corrispondenti all'inventario atteso e grant di colonna applicativi inattesi; non nasconde policy aggiuntive che potrebbero eludere il filtro. Non concede membership o privilegi temporanei, non cambia owner e non aggiunge FK.

## Comportamento finanziario preservato

- A autorizzato, nessuna quota: normali creazioni/modifiche/eliminazioni consentite.
- A con quote attive: metadati non finanziari consentiti; modifiche finanziarie rifiutate dal guard esistente 23514; DELETE rifiutato 23503.
- A con sole quote scollegate: importi nuovamente modificabili; DELETE e cambio identità restano impediti dallo storico. Nessuna eliminazione del registro quote.
- B fuori contesto: UPDATE/DELETE possono rispondere HTTP 200 con zero righe perché RLS nasconde le righe scrivibili. Non è un successo di modifica: si verifica sempre lo stato finale.
- Anonimo: nessun privilegio di mutazione. Il fatto che possa ancora leggere le sorgenti è un limite legacy esplicito, fuori da questa correzione delle scritture.

Il ruolo storico `artecna_cantieri_delete_rpc` acquisito ha BYPASSRLS e conserva i propri grant: il cleanup amministrativo può ancora arrivare ai guard finanziari. Senza storico il caso legittimo continua; con storico attivo o scollegato resta il rifiuto atomico P2113 già documentato. Non si introduce una policy permissiva generale per simulare quel ruolo e non si cambiano i suoi attributi.

## Verifiche

`sorgentiSicurezza.native.test.cjs` esegue PostgreSQL nativo isolato, contesti JWT/SET ROLE di test: baseline delle quattro scritture, tre stati, A/B/anonimo, INSERT, cambio contesto, titolare inattivo, origini non assegnate, preservazione delle funzioni attribuzioni. Non viene presentato come Auth reale.

`sorgentiSicurezza.http.cjs` è un driver esplicito per la sandbox isolata con GoTrue/Auth/PostgREST/PostgreSQL reali e fixture strutturali acquisite. Non carica ENV, accetta solo endpoint loopback dello stack nativo e usa account sintetici; nessuna service-role per dimostrare permessi applicativi. Il principal DB serve esclusivamente a installare fixture/migrazioni e osservare snapshot. Riproduce prima le quattro scritture; poi verifica 48 tentativi B/anonimo nei tre stati, inclusi i payload UPDATE legacy, e le operazioni legittime di A.

Risultati e prove del cleanup sul clone completo del catalogo sono conservati nell'audit Step 3D, fuori dal candidato. TypeScript/build/UI precedenti sono riutilizzati per le parti invariate. Nessuna applicazione Production, push, deploy o modifica ENV/login è implicita nella preparazione di questa migrazione.

Esito della verifica locale Step 3D: 55 scenari PostgreSQL nativi PASS (56 test contando il contenitore), 75 controlli HTTP reali PASS, inclusi quattro difetti riprodotti prima e 48 tentativi non autorizzati senza delta dopo; 6/6 regressioni cleanup sul clone reale PASS. Lint dei due driver GREEN. Nessuna connessione Production; sandbox arrestata. SHA-256 del nuovo SQL: `99d5abac28b9fb49d1e8f31fef1822ba0ed9bc8b49194f3176baa770e0c64f16`.
