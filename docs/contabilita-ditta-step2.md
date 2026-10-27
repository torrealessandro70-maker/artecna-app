# Riepilogo ditta — Step 2

Baseline: origin/main `090b015bf8ebdf908344a7abbb3ac0c2b8d3e350`. Branch `codex/contabilita-ditta-riepilogo-20261027`. Consultazione per contabilità ordinaria e IVA trimestrale, senza calcoli fiscali.

## Integrazione

`app/page.tsx` passa il client Supabase già autenticato a `EconomiaGeneralePanel`, che monta `RiepilogoDittaPanel`. I vecchi KPI denominati cash flow reale e utile netto non vengono più montati qui: le loro formule mescolavano documenti, cumulativi e costi gestionali. I componenti originari restano invariati; le classificazioni delle spese restano separate.

Il lettore usa esclusivamente SELECT sulle sei tabelle già lette dai loader Desktop, nella stessa sessione e con gli stessi permessi. Paginazione 500 righe, ordinamento per ID, conteggio esatto e controllo identità/completezza. Nessun fallback di autorizzazione. Le sei letture non sono uno snapshot transazionale: mutazioni concorrenti a conteggio invariato possono non essere rilevate. La fotografia indica la fine del caricamento, non una chiusura contabile.

Periodo e dettagli operano in memoria; solo apertura e aggiornamento esplicito rileggono le fonti. Nessun INSERT/UPDATE/DELETE, RPC, autosave o timestamp scritto. Nessuna nuova tabella, migrazione, copia persistente, modifica a writer/importatori, Price Engine, manodopera, AI o configurazioni.

## Contratti degli indicatori

Le definizioni complete sono esportate da `CONTRATTI` nel calcolatore puro `app/engines/contabilita-ditta/riepilogo.ts` e consultabili nell'interfaccia. Le somme usano centesimi interi verificati.

| Indicatore | Fonte/importo | Data e formula | Stato e limiti |
|---|---|---|---|
| Documenti emessi registrati | fatture_emesse.totale | data_fattura; somma nel periodo | Limitato: totali documentali, non fatturato netto certificato |
| Documenti ricevuti registrati | fatture_fornitori.importo_totale | data_fattura; somma nel periodo | Limitato: non pagamento né costo di competenza |
| Acconti registrati | acconti_cantiere.importo | data_incasso; somma nel periodo | Disponibile sulla sola fonte completa; Limitato per anomalie/parzialità |
| Incassi non fatturati registrati | incassi_non_fatturati.importo | data_incasso; somma nel periodo | Stesso criterio; non consolidato con acconti |
| Pagamenti operai registrati | pagamenti_operai.importo | data_pagamento; somma nel periodo | Stesso criterio; non costo del lavoro maturato |
| Incassato cumulativo dichiarato | fatture_emesse.importo_incassato | fotografia corrente di tutte le fatture caricate | Limitato; indipendente dal mese fattura e dal filtro, non storico |
| Incassi consolidati | collegamenti non disponibili | nessuna somma | Non calcolabile: possibili sovrapposizioni fra archivi |
| Pagamenti fornitori | pagamenti_fornitori, record consultabili | nessuna attribuzione al periodo | Non calcolabile: cumulativi/contratto campi incoerente, eventi datati non certificati |
| Residui | storico allocazioni non disponibile | nessun saldo corrente sostitutivo | Non calcolabile alla data richiesta |
| Scaduti | scadenzario riconciliato non disponibile | nessuna data inventata | Non calcolabile |

Disponibile non certifica importazione completa di documenti esterni. Una fonte in errore/caricamento non vale zero. Un sottoinsieme valido può essere Limitato, con righe escluse visibili; un insieme interamente invalido resta non determinabile. Intervallo invalido blocca i valori.

Note di credito esplicite e importi negativi non riconciliati sono esclusi, segnalati e conservati nel dettaglio: non si inventa una rettifica fiscale. IVA grezza conservata e marcata da verificare, senza soglie o inferenze percentuale/importo. Imponibili/IVA monetaria non vengono stimati. Scadenze assenti sono mancanti; quelle presenti ma non certificate non generano scaduti.

ID ripetuti vengono esclusi e segnalati senza scegliere una versione. Documenti con ID distinti ma riferimenti simili restano distinti, con sospetto da verificare. Materiali, assegnazioni, SAL e costi presenze non sono fonti di questi totali: non si duplicano i costi documentali né si altera il motore manodopera anti-duplicazione.

`residuoRiconciliato` verifica esclusivamente il contratto puro di un DTO con allocazioni complete, identificate e datate: totale meno allocazioni entro riferimento. Nessun adapter corrente attesta tale completezza dai cumulativi legacy; il pannello reale lascia i residui bloccati.

## Verifiche ed evidenze

- Test Node: 27/27 PASS, compresi i 12 scenari richiesti, paginazione, ID numerici, errori/parzialità e riconciliazione del dettaglio.
- TypeScript: PASS, ExitCode 0.
- ESLint nuovi moduli e pannello modificato: PASS, ExitCode 0. `app/page.tsx`: 112 errori e 249 warning sia baseline sia candidato, zero differenze normalizzando regola/severità/prima riga diagnostica; cambiano percorsi/frame di codice. ExitCode 1 storico.
- Build finale eseguita: FAIL, ExitCode 1, download Geist/Geist Mono da fonts.googleapis.com non risolvibile (`ENOTFOUND`). Layout, font ed ENV invariati. Non certificata una build completa riuscita.
- Browser Edge/Chromium reale locale: 14/14 PASS, componenti reali montati in harness con risposte sintetiche GET su 127.0.0.1. Filtri, IVA originale, dati mancanti, errore fonte simulato, dettagli, layout stretto, assenza scritture/errori verificati. Zero richieste esterne, scritture ed errori console/JavaScript; browser chiuso.
- Il browser non usa shell autenticata completa, Auth/PostgREST reali o Production: i permessi effettivi delle sei letture restano da verificare separatamente. Nessuna query remota eseguita.
- Guide Next richieste da AGENTS non presenti in `node_modules/next/dist/docs` della versione installata; letto README installato, nessuna nuova API Next introdotta.

Evidenze locali: `audit-locali/CONTABILITA-DITTA-STEP2/` (log test/TypeScript/lint/build, confronto lint, browser/RESULT.json e screenshot). Harness e fixture fuori dal candidato applicativo, nessun segreto o ENV copiato.

## Dati mancanti e fuori scope

Servono movimenti datati e allocazioni fattura verificabili, relazione fra le tre rappresentazioni incassi, storico completo, scadenze/rate affidabili e origine semantica IVA. Finché mancano, nessun consolidamento finanziario, residuo storico, utile, IVA da versare o saldo banca certificabile.

Il doppio tentativo INSERT materiali legacy è descritto nel rapporto Step 1: `salvaFattura` in `app/page.tsx`, chiamato da RegistroFattureFornitoriPanel, tenta due inserimenti per righe assegnate (baseline circa 10858–10875 e 10938–10955). È evidenza di codice, non prova di doppia scrittura Production. Writer e dati non vengono corretti o ripuliti qui.

Nessun SQL remoto, push, deploy, chiamata AI, trasferimento esterno o modifica ENV/login.
