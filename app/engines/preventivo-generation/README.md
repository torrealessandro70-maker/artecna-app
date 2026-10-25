# Step 5 — Preventivo Integrativo

Baseline cleanup e limiti di certificazione aggiornati: [STEP5C.md](./STEP5C.md). Il vecchio candidato `5ddaed5e` e il relativo hash SQL non sono più il riferimento per l'applicazione.

Implementazione locale dalla baseline `1f65385315059275f01f7d622b72ed4054a7565b`. Nessuna applicazione SQL, pubblicazione o chiamata AI reale durante la verifica.

```mermaid
flowchart TD
 V[Variante bozza] --> R[Lettura autorevole: fonti, foto, analisi, contratto]
 R --> A[Adapter comune]
 S[Sopralluogo: adapter compatibile] --> A
 A --> G[Stessa route genera-preventivo-ai / stesso modello]
 G --> P[Price Resolution Engine esistente]
 P --> E[RevisionePreventivoAiPanel esistente]
 E --> H[Conferma umana esplicita]
 H --> T[Transazione: documento e lavorazioni Variante]
 T --> D[Registro esistente / Excel esistente]
 T --> F[Approvazione Variante e SAL: flusso esistente]
```

## API e separazione dei contesti

`contestoSopralluogo(input)` mantiene il Memory legacy e il payload precedente. `contestoVariante(snapshot)` restituisce `PreventivoGenerationContext`: narrativa dal composer comune, foto separate, contratto strutturato, genealogia. `decodificaSnapshotIntegrativo` valida la risposta autorevole; `leggiRispostaIntegrativa` applica il Price Engine; `validaRevisione` valida la conferma umana.

Il browser invia alla stessa route soltanto `{ "tipo": "integrativo", "variante_id": "…" }`, con sessione autenticata. Il server rilegge il contesto, non accetta prezzi/contratto/fonti dal browser. Il ramo Sopralluogo conserva prompt, modello `gpt-4.1-mini` e `json_object`: due golden fixture verificano la richiesta precedente. Le istruzioni delta e il contratto sono input separati dalla narrativa. Esempi completi, JSON AI mock e risultato revisionato sono in `esempi.fixture.json`; la ricostruzione iniziale è in `MAPPA-STEP5.md`.

Le operazioni sono nuova/aumento/riduzione/eliminazione; una sostituzione si rappresenta con due righe revisionate. Un riferimento incerto rimane vuoto e da verificare. Le detrazioni sono negative. Il prezzo AI non sostituisce il Price Engine; quantità e prezzo delle correzioni devono coincidere con quelli autorevoli. Nessun salvataggio alla sola risposta AI. L'analisi obsoleta blocca la generazione senza rianalisi automatica. Se esiste un'analisi vengono confrontati attivamente anche gli hash byte foto già previsti dall'Osservatore; non viene introdotto un versioning passivo Storage.

## Persistenza locale proposta

SQL integrale: `supabase/migrations/20261025_variante_preventivo_integrativo.sql`.
SHA-256 finale dopo Step 5A: `45af46251f0bb226af2cc38893e61475dfcce14b603d027c3148b434e897ef36`. L'hash precedente `39466e…` è superato.

Estende il Registro esistente con natura, variante_id, preventivo_contrattuale_id, provenienza_generazione, FK RESTRICT, check e unique per Variante; sopralluogo_id conserva l'origine del contratto. Non modifica origine_preventivo_id né il riferimento contrattuale della Variante. Introduce guard del documento e RPC `leggi_contesto_preventivo_integrativo(uuid)` / `salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb)`, SECURITY DEFINER con ruolo tecnico esistente, EXECUTE solo authenticated. Un grant aggiuntivo consente al ruolo tecnico la lettura Osservatore. Non riscrive RPC economiche esistenti.

La conferma atomica crea documento e lavorazioni; riduzioni/eliminazioni delegano la correzione canonica e il relativo residuo SAL. Retry con stesso UUID e identico payload riconosce il commit; payload diverso viene rifiutato. Nessun retry automatico del client dopo esito incerto. Registro e somme contrattuali escludono il documento integrativo come contratto indipendente; il documento non approva Variante, contratto o SAL. Excel conserva segni e riferimenti senza aggiungere condizioni commerciali standard.

Scelta prudenziale esplicita: solo bozze prive di lavorazioni economiche; un documento generato confermato per Variante. Nessuna fusione implicita con righe manuali o nuova conferma dopo modifica delle fonti. Prima della conferma è possibile scartare e rigenerare.

## Verifiche e limiti

- Nuovi test: 33/33, provider/HTTP simulati, componenti reali eseguiti con hook fixture, SQL effettivo su PGlite e ExcelJS/template effettivi. Test di parità legacy inclusi.
- Step 5A recupera le due prove native Economia (16/16 controlli), esegue la persistenza su PostgreSQL nativo (9/9) e la regressione storica della cancellazione PostgreSQL 17.6 (10/10). La suite ampliata finale comprende anche la nuova matrice cleanup, senza esclusioni: risultati e log nel report di consegna. Nessun HTTP/browser reale Step 5.
- TypeScript: ExitCode 0. ESLint nuovi moduli/pannello/route: ExitCode 0. Sui sei file legacy toccati persistono gli stessi 171 errori e 256 warning della baseline, con stessi conteggi per file; ESLint globale non GREEN. Build non eseguita.
- SQL embedded e nativo usano i corpi reali di residuo/correzione. Step 5A ha recuperato anche il corpo legacy aggiungi_lavorazione_variante dalla fixture di catalogo versionata `ponteEconomiaProduction.fixture.json`; soltanto la lettura Osservatore resta una fixture sintetica nelle prove di persistenza.
- Prima di attivare: precheck Production READ ONLY su schema, firme, ACL, owner e shape reale della RPC legacy. Nessun precheck remoto eseguito qui.
- La compatibilità amministrativa è trattata in [STEP5A.md](STEP5A.md): estensione certificata dell'inventario/manifest, cleanup delle sole relazioni e cancellazione anticipata dei documenti Integrativi, con guard limitato al contesto amministrativo valido. Quaderni e fonti autonome non sono figli da cancellare. SQL precedente, UI e motori AI invariati; nessuna applicazione remota.
- Foto senza versione passiva: sostituzione agli stessi ID/path non osservabile dal solo SQL; possibile cambiamento byte fra generazione e conferma. Nessuno snapshot immutabile dei blob introdotto.

Configurazione, ENV e credenziali preservati. Nessun valore segreto letto, stampato o copiato. I mock non inizializzano il provider reale.
