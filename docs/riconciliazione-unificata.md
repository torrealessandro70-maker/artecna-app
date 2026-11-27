# Riconciliazione unificata acconti, pagamenti e fatture

Candidato locale dalla base `6c79154fa0e3712f804f208abdb8cb0d4ca31522`.
Nessuna connessione Production, migrazione remota, modifica ENV/Login, push o deploy.

## Procedura operativa

Gli accessi Regolarizza da Fatture da emettere e Notifiche, Riconcilia acconto da
Fatture emesse e Associa fattura dalla compilazione dell'acconto aprono la stessa
VistaOperativa. Le viste precedenti rimangono montate: il ritorno conserva il
contesto. Le proposte di abbinamento sono limitate al cantiere UUID autorizzato e
alla corrispondenza univoca delle disponibilità imponibili. Nessuna proposta è
una conferma automatica.

1. Selezionare acconto e fattura esatti. La denominazione cantiere proviene dal
   suo UUID; una discordanza con il nome storico è segnalata, senza correggere dati.
2. Controllare i riepiloghi fiscali persistiti: imponibili, aliquote, imposte,
   lordo, stato fiscale e SdI. Inserire la quota imponibile per ciascun riepilogo.
3. Riutilizzare il pagamento lordo verificato dell'acconto. Registrare un nuovo
   pagamento solo dopo riscontro effettivo con data, metodo, riferimento e fonte.
   Se esistono pagamenti precedenti occorre confermare espressamente che il nuovo
   movimento sia distinto. La fattura non dimostra l'avvenuto pagamento.
4. Indicare la fonte che documenta la base imponibile dell'acconto storico.
   Nessuna conversione automatica di un importo storico ambiguo.
5. Facoltativamente confermare anche la classificazione fiscale ordinaria, solo
   per copertura completa e date coerenti. Il server conserva una classificazione
   già confermata e coerente; non inventa evidenze SdI.
6. Confermare una sola volta. Un esito di rete incerto conserva UUID e payload
   nel journal di sessione dell'utente: Verifica stessa richiesta riusa entrambi,
   anche dopo apertura da un altro ingresso. Nessun retry automatico.

L'esito fiscale è quello del valutatore esistente: senza SdI valido rimane la
pendenza. La riconciliazione richiama il ciclo esistente delle notifiche nella
stessa transazione; non chiude avvisi per la sola presenza della fattura.

## Archivi e atomicità

Nessun registro parallelo. Restano le fonti esistenti: `acconti_cantiere` per
l'imponibile contrattuale, `incassi_lordi_clienti` per i pagamenti effettivi,
`attribuzioni_clienti` per i collegamenti netti e `quote_lorde_clienti` per quelli
lordi. La migrazione aggiunge soltanto provenienza JSON sulla attribuzione netta
e un FK tipizzato dalla quota lorda all'attribuzione. Un collegamento storico
esatto e univoco è adottato senza duplicarne importo o pagamento; storici ambigui
restano bloccati.

Una chiamata RPC effettua l'intera operazione. Autorizzazioni esistenti di impresa
e cantiere, search_path ristretto, ACL authenticated, lock advisory condiviso con
i writer finanziari, lock sulle righe, verifica dell'impronta della fattura,
capienza netta e lorda, idempotenza legata all'autore e al payload. Qualunque
errore annulla anche il nuovo pagamento eventualmente inserito.

La ripartizione IVA usa l'aliquota documentata per ogni riepilogo e arrotondamento
cumulativo al centesimo: le quote 2.272,73 + 227,27 e 2.272,72 + 227,28 producono
due quote lorde da 2.500,00, per complessivi 4.545,45 + 454,55.

La revoca unificata scollega entrambe le quote e conserva il pagamento e gli
audit. Due constraint trigger differiti impediscono alle vecchie azioni di
scollegare soltanto una metà della coppia. La ripetizione dell'UUID di una
conferma revocata non riattiva i collegamenti.

Non vengono aggiornati importo, data o UUID dell'acconto, contratto, SAL,
compilazione_unica, importi/stato della fattura o evidenze SdI. La classificazione
fiscale viene aggiornata solo se espressamente richiesta e verificabile.

## Migrazione e conservazione

`supabase/migrations/20261127000100_riconciliazione_unificata.sql` è esclusivamente
locale. Nuove RPC:

- `leggi_riconciliazione_unificata(uuid,uuid)`;
- `riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean)`;
- `revoca_riconciliazione_unificata(uuid,uuid)`.

I pre/postcheck in `supabase/diagnostics/riconciliazione-unificata/` sono READ ONLY,
REPEATABLE READ, con ROLLBACK. Confrontano conteggi e SHA256 di tutte le vecchie
colonne su 13 relazioni: cantieri, preventivi, SAL, acconti, fatture, attribuzioni,
pagamenti lordi, quote lorde, imputazioni, stati fiscali, SdI, eventi e notifiche.
Escludono solo le due nuove colonne di collegamento. I test eseguono gli script
effettivi e confrontano le impronte, anche con collegamenti storici preesistenti.
Nessuna scansione di fotografie o archivi estranei.

La migrazione verifica la firma Hard Delete corrente e aggiorna il catalogo atteso
per i nuovi oggetti senza modificare la logica Hard Delete, RLS, ACL preesistenti,
privilegi PUBLIC, cron o migrazioni precedenti. Il postcheck verifica ACL delle RPC,
SECURITY DEFINER, proprietario, search_path, FK e trigger differiti.

Prima di qualsiasi installazione occorre un gate Production separato: identità
progetto, dipendenze reali, stato migrazioni, confronto delle impronte e piano
atomico autorizzato. Questi SQL non costituiscono un'autorizzazione all'apply.

## Verifiche riproducibili

```powershell
node --test --test-concurrency=1 supabase/validators/riconciliazione-unificata/migration.native.test.cjs supabase/validators/riconciliazione-unificata/extra.native.test.cjs
node --test app/engines/contabilita-ditta/riconciliazioneUnificata.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

Il runtime nativo dei test richiede i binari PostgreSQL 17.6 già disponibili nel
worktree Acconti; crea solo nuovi cluster temporanei su 127.0.0.1. I test caricano
le reali funzioni finanziarie, fiscali, SdI, di notifica e catalogo Hard Delete su
schemi e guardie sintetiche. Non replicano integralmente il database Production.

Copertura: caso TESTA sintetico, IVA 10/22/zero documentato, aliquote miste,
parziali, molti-a-molti, due pagamenti distinti, riuso di pagamenti e quote legacy,
concorrenza, doppia conferma, risposta persa, storici ambigui, crediti, revoche,
assenza SdI, rollback tardivo, fonte cambiata, anonimato e altro utente negati,
regimi speciali e valuta estera bloccati, conservazione delle 13 relazioni.

Regressioni pertinenti: attribuzioni, Incassi/Fatturazione e relativo pannello,
prospetto IVA e compilazione unica. Lint sui file interessati separato dalla build.

Smoke Edge locale desktop 1440 e telefono 390: componente reale, RPC simulate,
ingressi reali Centro notifiche/Fatture da emettere, selettore legacy, ritorno e
filtri, disponibilità, conferma e risposta persa. Blocco delle richieste esterne;
nessun dato TESTA reale e nessuna sessione autenticata Production.

Per consentire la build senza aggiungere chiavi, tre route AI preesistenti
inizializzano ora OpenAI durante POST anziché all'importazione. Nessuna modifica
a modelli, richieste AI o configurazioni; test di importazione senza credenziali.

## Limiti espliciti

- XML mancante/discordante, storici non documentati, rate speciali, reverse charge,
  split payment, IVA differita, note di credito o documenti rettificati non sono
  regolarizzati automaticamente. Occorre il percorso documentale/fiscale dedicato.
- L'XML è letto solo se già persistito: questa modifica non installa il progetto
  XML fiscale sospeso né associa nuove fonti alla fattura reale.
- La fonte della base storica e l'effettivo pagamento richiedono verifica umana.
- I rifiuti di vecchie revoche su coppie unificate richiedono Revoca riconciliazione.
- IVA documentale non equivale a liquidazione fiscale definitiva.
- Pubblicazione, installazione SQL e smoke autenticato reale restano separati e
  non eseguiti in questo step.

## Esito del gate locale

29 scenari PostgreSQL 17.6 GREEN (31 voci nel runner includendo i due contenitori),
9 test di dominio/importazione GREEN e 88 regressioni pertinenti GREEN.
TypeScript, lint dei file modificati, build Next.js 15.5.29 26/26 e 9 verifiche
browser locali GREEN. Impronte dei 25 once.lock e 7 diagnostici censiti invariate.

Il blocco del lint globale preesistente è stato superato con autorizzazione
esplicita dell'utente, subordinata al confronto dei singoli diagnostici.
La base originale è stata estratta da Git in una cartella diagnostica isolata,
con lo stesso Node 24.15.0, ESLint 9.39.4, configurazione, lockfile e albero di
dipendenze del candidato. Entrambi i lint globali escludono soltanto gli artefatti
locali `.run` e usano le normali esclusioni della configurazione originale.

| Esito | Base originale | Candidato |
| --- | ---: | ---: |
| Errori | 1.523 | 1.518 |
| Avvisi | 1.996 | 1.996 |
| Nuovi diagnostici rispetto alla base | — | **0** |
| Diagnostici eliminati | — | 5 errori |

Il confronto è un multinsieme di diagnostici, comprensivo di percorso relativo,
regola, severità, messaggio completo, posizione iniziale/finale, nodeType,
messageId e fatal. Sono normalizzati soltanto i percorsi delle due copie e i
terminatori CRLF nel messaggio. Non vengono confrontati soltanto i conteggi.
I 15 file di codice/test del candidato hanno zero errori e zero avvisi.
Nessuna modifica a configurazione ESLint, regole o soppressioni in questo gate;
anche i file di test sono identici a quelli del manifesto precedentemente sigillato.
Non è stata avviata una bonifica del debito tecnico preesistente.

È stata rieseguita la sola riconferma TESTA su PostgreSQL 17.6 sintetico: fattura
17 completamente allocata, imponibile 4.545,45, IVA 454,55, un solo pagamento
lordo 5.000,00, residuo zero anche dopo doppia conferma. Senza SdI rimangono un
evento e una notifica; con SdI valido entrambi risultano chiusi. Coincidono le
impronte prima/dopo di cantieri, contratti, SAL, tutti gli acconti storici e
fatture. Nessun dato reale utilizzato.

Codice applicativo, SQL e test coincidono byte per byte con il manifesto precedente:
le verifiche TypeScript, build, regressioni e browser restano valide e non sono
state ripetute. È aggiornata soltanto questa documentazione del gate.

## Perimetro nominale del commit locale

20 file fisici: 9 modificati e 11 nuovi. Il numero 14 riferito nell'interfaccia
non è accompagnato da un elenco nominale verificabile: non viene usato per
dedurre esclusioni o file mancanti. Il perimetro autorevole è il seguente,
riconciliato con Git e con i 20 SHA256 del manifesto precedente.

| Categoria | Percorso |
| --- | --- |
| Codice | `app/api/analizza-nota-ai/route.ts` |
| Codice | `app/api/analizza-rapportino/route.ts` |
| Codice | `app/api/genera-preventivo-ai/route.ts` |
| Codice | `app/components/AccontoCompilazioneVista.tsx` |
| Codice | `app/components/CentroNotifiche.tsx` |
| Codice | `app/components/CollegaIncassoPanel.tsx` |
| Codice | `app/components/FattureEmessePanel.tsx` |
| Codice | `app/components/VistaOperativa.tsx` |
| Codice | `app/components/RiconciliazioneUnificata.tsx` |
| Codice | `app/engines/contabilita-ditta/riconciliazioneUnificata.ts` |
| Test | `app/engines/contabilita-ditta/riconciliazioneUnificata.test.cjs` |
| Test | `supabase/validators/riconciliazione-unificata/extra.native.test.cjs` |
| Test | `supabase/validators/riconciliazione-unificata/fixture.cjs` |
| Test | `supabase/validators/riconciliazione-unificata/migration.native.test.cjs` |
| Test | `supabase/validators/riconciliazione-unificata/runtime.cjs` |
| Migrazione locale | `supabase/migrations/20261127000100_riconciliazione_unificata.sql` |
| Diagnostico READ ONLY | `supabase/diagnostics/riconciliazione-unificata/precheck.sql` |
| Diagnostico READ ONLY | `supabase/diagnostics/riconciliazione-unificata/postcheck.sql` |
| Documentazione | `docs/riconciliazione-unificata.md` |
| Sigilli LF SQL | `.gitattributes` |

I rapporti del confronto lint e della riconferma TESTA rimangono esclusivamente
negli artefatti `.run`, esclusi dal commit. I 25 lock e i 7 diagnostici censiti
conservano i loro SHA256. Il gate consente un unico commit locale; installazione
SQL e pubblicazione rimangono escluse e richiedono autorizzazione separata.

## Revisione IVA: fonti e convenzioni storiche

Il candidato b54 e il relativo bundle Production restano bloccati: non installarli.
La nuova revisione non aggiorna importi o classificazioni delle fatture storiche.

| Percorso esistente | Significato del campo `iva` | Fonte disponibile |
| --- | --- | --- |
| Inserimento manuale in `app/page.tsx` | Percentuale al momento del salvataggio | La convenzione non è attestata nella singola riga storica |
| Import XML singolo legacy | Importo del primo riepilogo | URL XML e nota di import; possibili riepiloghi multipli omessi |
| Archivio Bluenext strutturato | Somma degli importi IVA dei riepiloghi | Identità, impronta e tipo protetti; non conserva il dettaglio delle aliquote |
| Associazione Bluenext a fattura storica | Non modifica i valori numerici | Metadati di associazione, non una nuova fonte monetaria |
| Associazione PDF | Non modifica i valori numerici | Solo collegamento al file; nessuna inferenza OCR |
| Modifica fattura autorizzata | Non modifica IVA/imponibile/totale | Whitelist di cantiere e stato/incasso |
| Altri storici | Non determinabile dalla sola riga | Necessario confronto documentale |

`fonteIva.ts` e il risolutore SQL privato implementano il contratto canonico versione 1,
con parità verificata su fixture. Frontend e writer usano l'anteprima SQL autorizzata;
il prospetto IVA usa lo stesso contratto TypeScript. Non esistono soglie di 100 euro
per scegliere tra importo e percentuale. Il limite 100 riguarda esclusivamente una
percentuale già dichiarata e documentata.

L'XML persistito ha priorità e deve concordare con identità e importi. In sua assenza
la procedura richiede confronto con il documento originale, dichiarazione esplicita
della semantica e riferimento della verifica. Non inserire dati personali nel riferimento.
Il risultato è un'attestazione documentale dell'operatore autorizzato, non una prova
automatica dell'autenticità del documento o della trasmissione SdI.

La nuova colonna nullable `fatture_emesse.fonte_iva_verificata` conserva la verifica,
la fotografia dei dati originari e autore/data server. Nessun backfill. Il trigger
impedisce modifiche dirette dai ruoli API; il writer la registra nella medesima
transazione della riconciliazione. Fonte cambiata, concorrenza o errore causano STOP
o rollback; la richiesta idempotente include la verifica documentale.

Un importo IVA aggregato non determina un'aliquota unica. Senza i riepiloghi originali
è ammessa soltanto l'intera disponibilità imponibile residua, usando l'imposta esatta
residua. Quote parziali richiedono riepiloghi distinti documentati. IVA zero senza
aliquota/natura non viene etichettata come esenzione. Rettifiche e note di credito
rimangono nel percorso dedicato; bollo, altre componenti o arrotondamenti che impediscono
la quadratura netta/imposta/lorda richiedono verifica, senza correzioni automatiche.

Nella fixture storica anonimizzata: 4545,45 netti, campo IVA 454,55, totale 5000,
nessun XML, un incasso lordo preesistente. La verifica esplicita dell'importo consente
il riuso del pagamento e residuo zero. Senza evidenza SdI pendenza e notifica restano
aperte; l'evidenza valida successiva permette il normale ciclo di chiusura.

## Gate senza registro standard migrazioni

L'assenza di `supabase_migrations.schema_migrations` non prova né esclude installazioni.
Non viene creato o alterato alcun registro. `installed-objects.sql` restituisce in
READ ONLY firme, corpi SHA256 LF, owner, volatilità, SECURITY DEFINER, search_path,
ACL, colonne, trigger, indice e vincolo dei soli oggetti candidati.

Procedura per un futuro gate separatamente autorizzato:
1. Verificare i sigilli del nuovo bundle; non usare quello b54 bloccato.
2. Precheck: nessun oggetto candidato già presente; una presenza parziale è STOP.
3. Confrontare le dipendenze effettive e le 18 impronte storiche prima/dopo.
4. In una futura applicazione, confrontare il manifesto degli oggetti con quello
   generato dal cluster locale certificato, prima del COMMIT controllato.
5. Postcheck indipendente e stesso confronto esatto; divergenze o COMMIT incerto:
   STOP senza retry. Non dedurre la cronologia completa delle migrazioni dal manifesto.

Il manifesto locale è evidenza di riferimento, non attestazione dello stato remoto.
I file di verifica e i rapporti stanno negli artefatti locali esclusi da Git. Prima
di un eventuale apply è necessario un nuovo precheck Production autorizzato e un
bundle atomico sigillato aggiornato; nessuna vecchia autorizzazione viene riutilizzata.
