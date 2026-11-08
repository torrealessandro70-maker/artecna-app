# Runtime V3: diagnostica 009 e candidato locale 010

Parent: `8c110197d61528661d3d2f9de438b6cd4e617729`. Migration 009 immutabile. Nessun nuovo accesso Production dopo il diagnostico autorizzato; nessun hard delete, Storage worker, aumento timeout, push/deploy.

## Evidenza Production READ ONLY

Run: `20261108-173013-b7bec60546984c78add1ce5bf31ae2b7`; exit 0, read_only on, ROLLBACK e GREEN_READONLY_DIAGNOSTIC_009. Sessione amministrativa: timeout 2min invariato, distinto dal budget PostgREST 8s. JIT off e pg_jit_available=false: ipotesi JIT esclusa.

Tempi ms. Run1 significa primo uso nel backend diagnostico, non cache globale forzatamente svuotata. Il rapporto usa run1/min(run2,run3).
| Helper | Run1 | Run2 | Run3 | Rapporto |
| --- | --- | --- | --- | --- |
| catalog | 179.012 | 15.991 | 15.746 | 11.369 |
| targets | 285.529 | 26.503 | 25.568 | 11.167 |
| blockers | 142.301 | 95.870 | 98.982 | 1.484 |
| preserved | 1804.762 | 316.567 | 213.327 | 8.460 |

ATTENZIONE: i tre tempi blockers nei log sono dell’overload `blockers(uuid)`, che ricostruisce targets. I log non contengono tre misure isolate dell’overload `(uuid,jsonb)`; non sono stati rietichettati né sono state eseguite ulteriori query Production. I test V3 usano sempre l’overload pianificato per la RPC.

## Causa: primo uso e difetto strutturale distinto

Il forte calo catalog/targets/preserved al secondo e terzo ingresso supporta un costo di preparazione cold dei helper e dei piani SPI. Non è disponibile un profiler che separi esattamente compilazione SPI, relcache e cache iniziale: PLPGSQL_SPI_COLD_PLAN_COMPILE è la spiegazione della componente cold, non una misura diretta né l’unica causa. Non è corretto certificare che tutti i componenti siano sub-ms.

Il ramo foto_cantiere resta strutturalmente costoso: 342.841 ms nella misura equivalente, 267.908 ms in EXPLAIN. jsonb_to_recordset stima 100 chiavi per 1 effettiva. Il planner esegue prima un anti-join delle foto globali rispetto alle 2 foto owned, poi costruisce un hash con 103 righe intere prima del join positivo con il witness. Risultato finale: 0 righe. Hash Batches 128, Peak Memory 8374 KiB, 4118 shared hit, 0 shared read, 8256 blocchi temp letti e scritti (64.5 MiB per direzione).

La PK foto_cantiere_pkey esiste ma non è scelta da questo piano. Non è dimostrato che to_jsonb sia eseguito per le foto estranee: è dimostrato il loro caricamento/materializzazione whole-row nel ramo hash prima della selezione positiva. Il costo non deriva dai 173 byte delle foto target. L’assenza di shared read non esclude il temp I/O effettivamente osservato. track_io_timing off impedisce di attribuire un tempo preciso al solo I/O. Nessun blocker lock pertinente osservato.

La fixture precedente usava foto estranee repeat(F,500000), altamente comprimibili, ed ANALYZE esplicito. Dimensione fisica, larghezza stimata, memoria e piani non erano equivalenti alla Production. I test V3 aggiungono immagini estranee incompressibili EXTERNAL e work_mem 2184 KiB.

## Catalogo

| Componente | Righe | ms completi | ms scan-only |
| --- | --- | --- | --- |
| columns | 727 | 3.964 | 1.496 |
| constraints | 324 | 6.742 | 1.391 |
| triggers | 106 | 4.973 | 1.634 |
| functions | 250 | 9.940 | 2.131 |

Functions è la componente warm più costosa (9.940 ms), seguita dalle constraints (6.742 ms). Le differenze includono rendering/hashing/aggregazione, non isolano il solo md5 o pg_get_constraintdef. Il totale catalog warm osservato è 15.746 ms. La ricostruzione completa dell’app è sostituita nella 010 da un grafo certificato, senza confrontare una firma persistita con sé stessa.

## Targets: tutte le selezioni misurate

| Selezione | ms | Righe restituite | Access path | Righe scansioni, circa |
| --- | --- | --- | --- | --- |
| ids_operativi | 0.914 | 54 | economia_righe: Seq Scan; economia_raccolte: Seq Scan; materiali_cantiere: Seq Scan; acconti_cantiere: Seq Scan | economia_righe: 202; economia_raccolte: 9; materiali_cantiere: 297; acconti_cantiere: 18 |
| public.cantieri | 0.248 | 1 | cantieri: Seq Scan | cantieri: 20 |
| public.rapportini | 0.283 | 4 | rapportini: Seq Scan | rapportini: 52 |
| public.foto_cantiere | 0.301 | 2 | foto_cantiere: Seq Scan | foto_cantiere: 105 |
| public.timbrature | 0.293 | 3 | timbrature: Seq Scan | timbrature: 222 |
| public.materiali_cantiere | 0.293 | 0 | materiali_cantiere: Seq Scan | materiali_cantiere: 297 |
| public.attrezzi_cantiere | 0.239 | 0 | attrezzi_cantiere: Seq Scan | attrezzi_cantiere: 0 |
| public.pagamenti_fornitori | 0.292 | 0 | pagamenti_fornitori: Seq Scan | pagamenti_fornitori: 0 |
| public.acconti_cantiere | 0.228 | 0 | acconti_cantiere: Seq Scan | acconti_cantiere: 18 |
| public.incassi_non_fatturati | 0.276 | 0 | incassi_non_fatturati: Seq Scan | incassi_non_fatturati: 0 |
| public.sal_lavorazioni | 0.312 | 0 | sal_lavorazioni: Seq Scan | sal_lavorazioni: 230 |
| public.preventivo_lavorazioni | 0.371 | 19 | preventivo_lavorazioni: Seq Scan | preventivo_lavorazioni: 147 |
| public.preventivi_cantiere | 0.289 | 1 | preventivi_cantiere: Seq Scan | preventivi_cantiere: 41 |
| public.varianti_cantiere | 0.287 | 4 | varianti_cantiere: Seq Scan | varianti_cantiere: 20 |
| public.utenti_cantiere | 0.355 | 1 | utenti_cantiere: Seq Scan | utenti_cantiere: 20 |
| public.economia_raccolte | 0.311 | 3 | economia_raccolte: Seq Scan | economia_raccolte: 9 |
| public.memoria_prezzi | 0.263 | 0 | memoria_prezzi: Index Scan memoria_prezzi_cantiere_uuid | memoria_prezzi: 0 |
| public.variante_lavorazioni | 0.496 | 0 | variante_lavorazioni: Seq Scan; varianti_cantiere: Seq Scan | variante_lavorazioni: 160; varianti_cantiere: 20 |
| public.variante_documenti | 0.412 | 0 | varianti_cantiere: Seq Scan; variante_documenti: Bitmap Heap Scan | varianti_cantiere: 20; variante_documenti: 0 |
| public.variante_sorgenti | 0.467 | 1 | varianti_cantiere: Seq Scan; variante_sorgenti: Index Only Scan variante_sorgenti_lettura_idx | varianti_cantiere: 20; variante_sorgenti: 0 |
| public.variante_fonti_memory | 0.424 | 1 | varianti_cantiere: Seq Scan; variante_fonti_memory: Bitmap Heap Scan | varianti_cantiere: 20; variante_fonti_memory: 0 |
| public.variante_fonti_visive | 0.398 | 1 | varianti_cantiere: Seq Scan; variante_fonti_visive: Index Only Scan variante_fonti_visive_pkey | varianti_cantiere: 20; variante_fonti_visive: 0 |
| public.variante_osservatore_analisi | 0.410 | 0 | varianti_cantiere: Seq Scan; variante_osservatore_analisi: Bitmap Heap Scan | varianti_cantiere: 20; variante_osservatore_analisi: 0 |
| public.economia_righe | 0.766 | 53 | economia_righe: Seq Scan; economia_raccolte: Seq Scan | economia_righe: 202; economia_raccolte: 9 |
| public.economia_sorgenti | 0.592 | 1 | economia_sorgenti: Seq Scan; economia_raccolte: Seq Scan | economia_sorgenti: 73; economia_raccolte: 9 |
| public.rapportino_prestazioni | 0.494 | 3 | rapportino_prestazioni: Seq Scan; rapportini: Seq Scan | rapportino_prestazioni: 80; rapportini: 52 |
| public.rapportino_materiali | 0.394 | 0 | rapportini: Seq Scan; rapportino_materiali: Index Scan rapportino_materiali_identita | rapportini: 52; rapportino_materiali: 0 |
| artecna_rapportini.richieste | 0.486 | 3 | richieste: Seq Scan; rapportini: Seq Scan | richieste: 46; rapportini: 52 |
| artecna_rapportini.allegati | 0.311 | 1 | allegati: Index Scan allegati_cantiere | allegati: 1 |
| artecna_rapportini.f3c3_capability | 0.434 | 0 | f3c3_capability: Seq Scan; foto_cantiere: Seq Scan; allegati: Index Scan allegati_cantiere | f3c3_capability: 0; foto_cantiere: 0; allegati: 0 |
| keep:public.fatture_emesse | 0.302 | 0 | fatture_emesse: Seq Scan | fatture_emesse: 23 |
| keep:public.fatture_fornitori_righe | 0.490 | 0 | fatture_fornitori_righe: Seq Scan | fatture_fornitori_righe: 1079 |
| keep:public.fornitori_rettifiche | 0.734 | 0 | fornitori_rettifiche: Seq Scan; economia_righe: Seq Scan; economia_raccolte: Seq Scan; materiali_cantiere: Seq Scan | fornitori_rettifiche: 0; economia_righe: 0; economia_raccolte: 0; materiali_cantiere: 0 |
| keep:artecna_contabilita.attribuzioni_clienti | 0.263 | 0 | attribuzioni_clienti: Seq Scan | attribuzioni_clienti: 0 |
| keep:public.agenda_attivita | 0.294 | 0 | agenda_attivita: Seq Scan | agenda_attivita: 7 |
| keep:artecna_contabilita.archivio_quote | 0.679 | 0 | archivio_quote: Seq Scan; economia_righe: Seq Scan; economia_raccolte: Seq Scan; materiali_cantiere: Seq Scan; fatture_fornitori_righe: Seq Scan | archivio_quote: 0; economia_righe: 0; economia_raccolte: 0; materiali_cantiere: 0; fatture_fornitori_righe: 0 |
| keep:artecna_contabilita.archivio_attribuzioni | 0.452 | 0 | fatture_emesse: Index Scan fatture_emesse_pkey; attribuzioni_clienti: Seq Scan; archivio_attribuzioni: Index Scan archivio_attribuzioni_runtime_fattura_id | fatture_emesse: 23; attribuzioni_clienti: 0; archivio_attribuzioni: 0 |
| keep:artecna_guardie.fatture_classificazione_richieste | 0.589 | 0 | fatture_classificazione_richieste: Seq Scan; runtime_ownership_edges: Index Scan runtime_ownership_edges_uuid | fatture_classificazione_richieste: 1; runtime_ownership_edges: 0 |

La singola selezione più costosa è ids_operativi 0.914 ms; economia_righe 0.766 ms è la prima tabella. EXPLAIN economia_righe 0.420 ms. Nessuna SELECT targets riproduce autonomamente i 1153 ms iniziali. Le medie per-loop di EXPLAIN sono arrotondate: scansioni e righe per singolo nodo non sostituiscono il conteggio aggregato esatto della selezione.

## Witness preserved: 11 tabelle fisiche e 2 transition bag

| Witness | Righe mantenute | ms | EXPLAIN ms | Scansionate | Hit | Read | Temp write |
| --- | --- | --- | --- | --- | --- | --- | --- |
| artecna_rapportini.allegati | 0 | 0.528 | 0.086 | allegati: 7 | 1 | 0 | 0 |
| public.cantieri | 0 | 0.448 | 0.095 | cantieri: 20 | 1 | 0 | 0 |
| public.economia_raccolte | 0 | 0.421 | 0.094 | economia_raccolte: 9 | 1 | 0 | 0 |
| public.economia_sorgenti | 0 | 0.561 | 0.210 | economia_sorgenti: 73 | 32 | 0 | 0 |
| public.foto_cantiere | 0 | 342.841 | 267.908 | foto_cantiere: 105 | 4118 | 0 | 8256 |
| public.operai | 1 | 1.581 | 0.195 | operai: 6 | 1 | 0 | 0 |
| public.preventivi_cantiere | 0 | 1.798 | 0.385 | preventivi_cantiere: 41 | 81 | 0 | 0 |
| public.quaderno_progetti | 1 | 0.610 | 0.113 | quaderno_progetti: 4 | 1 | 0 | 0 |
| public.rapportini | 0 | 0.811 | 0.182 | rapportini: 52 | 3 | 0 | 0 |
| public.rapportino_prestazioni | 0 | 0.746 | 0.239 | rapportino_prestazioni: 80 | 2 | 0 | 0 |
| public.varianti_cantiere | 0 | 0.649 | 0.124 | varianti_cantiere: 20 | 1 | 0 | 0 |
| transition:quote | 0 | 1.668 | 0.252 | economia_righe: 71; materiali_cantiere: 0; archivio_quote: 0 | 24 | 0 | 0 |
| transition:attribuzioni | 0 | 0.905 | 0.073 | attribuzioni_clienti: 0; archivio_attribuzioni: 0 | 0 | 0 | 0 |

I 13 result keys non sono 13 tabelle fisiche: includono transition:quote e transition:attribuzioni. Byte serializzati dei witness effettivi: operai 270, quaderno_progetti 1356; gli altri rami fisici risultano vuoti dopo esclusione owned. Il JSON Quaderno qui è l’intera riga, diverso dai 924 byte dei soli payload JSON certificati prima. Tutte le query e i piani completi restano nei log locali; il JSON allegato contiene i dettagli numerici per ramo.

## runtime_ownership_edges

571 righe, 308 UUID distinti, 47 sorgenti. Sorgente unica fatture_classificazione_richieste. Match per PK: richieste 47, fatture_fornitori 47 edge /34 UUID, fatture_fornitori_righe 459/216, spese_impresa 18/11. I match possono sovrapporsi tra tabelle: non vanno assunti come una partizione senza verificare le UUID. Zero edge per target UUID e per le identità witness del piano.

Indice runtime_ownership_edges_uuid usato: Index Scan, 0 righe, 6 hit, 0 read, 0.053 ms. n_live_tup=571, n_dead_tup=0, last_analyze null, last_autoanalyze 2026-11-08T17:16:57.381616Z, n_mod_since_analyze=0. Statistiche referenced_uuid presenti. Nessuna evidenza di statistiche mancanti per questo indice. Counters cumulativi: UUID idx_scan=3; PK idx_scan=0.

foto_cantiere presenta counters non coerenti con il conteggio reale (n_live_tup=0, last_analyze/autoanalyze null, 105 righe reali), pur avendo pg_stats e stima 125 righe: non basta per concludere che ANALYZE risolva il difetto. Lo scarto decisivo è SRF 100 chiavi stimate contro 1 e la larghezza whole-row/TOAST sottostimata dal piano hash. Nessun nuovo indice o ANALYZE eseguito Production.

pg_stat_statements disponibile: 35 query pertinenti acquisite, prevalentemente comandi top-level/migration. Nessuna misura annidata completa dei singoli helper né reset delle statistiche; questi counters non sostituiscono i tempi PERF009.

## 010 locale

Targets è SQL set-based. Shared raggruppa le espansioni FK indipendenti in un’unica SELECT dinamica tratta soltanto dalla whitelist privata; le espansioni successive restano ordinate. Preserved sottrae chiavi owned prima del fetch e usa positive_keys MATERIALIZED + lookup LATERAL con barriera OFFSET 0. Nessuna riga intera globale viene caricata quando il witness effettivo è vuoto. Metadata interni installati dalla migration, revocati a PUBLIC/anon/authenticated/service_role e inclusi integralmente nella firma. Valori utente soltanto come parametri, mai identificatori SQL.

Catalogo limitato a relazioni e ownership pertinenti, FK in ingresso/uscita, trigger, helper transitivamente referenziati, RPC, owner/ACL/search_path e integrità metadata. Nuove ownership columns, FK/edge e nomi riservati causano drift. Funzioni estranee non invalidano il grafo. L’atteso è aggiornato solo dalla migration. Nessuna cache persistita autoreferenziale, nessun prewarm richiesto.

La RPC rimane byte-identica alla 009: usa targets una sola volta e blockers(uuid,jsonb), senza duplicare il catalog scan. L’overload uuid resta compatibilità per il preflight esistente, fuori dal percorso RPC. Nessun nuovo SET/CREATE temporaneo necessario: nessun oggetto public è sostituito. Guard 009 prima dei cambiamenti, transazione unica, rollback iniettato dopo ogni fase, seconda esecuzione fail-closed.

Dimensioni sorgente:
| Helper | 009 byte | 010 byte | 009 righe | 010 righe |
| --- | --- | --- | --- | --- |
| targets | 11906 | 9506 | 42 | 74 |
| shared | 56027 | 2348 | 79 | 14 |
| preserved | 37178 | 924 | 59 | 7 |
| catalog | 1816 | 9484 | 6 | 13 |

Più righe SQL non significano più statement PL/pgSQL: targets prepara un body SQL; shared/preserved non contengono più 76/57 statement statici separati. Le query restano versionate come metadata, non sono eliminate dai controlli di integrità.

## Cold-backend regression contract

| Scala | Catalog cold max | Targets cold max | Blockers cold max | Preserved cold max | RPC cold max | RPC warm max |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 64.868 | 197.385 | 258.695 | 76.930 | 695.010 | 272.062 |
| 10 | 68.466 | 200.276 | 383.810 | 73.400 | 829.090 | 509.414 |

Ogni misura cold apre e chiude una nuova connessione; due backend nuovi per helper e scala. I tempi helper usano clock_timestamp dentro un chiamante PL/pgSQL, come il benchmark Production, senza invocare prima alcun helper. Il client_wall_ms viene conservato per ogni misura. I budget della RPC completa cold/warm usano sempre il wall time dal client, inclusa inizializzazione del chiamante e preparazione. La RPC locale viene sempre rollbackata; nessuna RPC Production è invocata. Budget helper 1x 250/250/500/500 ms, RPC cold 1x <3s, cold 10x <4s, warm <1s. Il test plan verifica zero fetch foto e zero temp spill per il witness vuoto; confronto hash 009/010 esatto e casi di drift/corruzione permanenti.

Costo minimo osservato Production dei quattro helper warm separati: circa 350.511 ms (somma dei minimi, wrapper blockers con targets duplicato). Non è un benchmark della RPC completa né una garanzia post-010. Tempi reali della futura 010 Production richiederanno un successivo gate READ ONLY esplicitamente autorizzato.

## Quality gate finale

155/155 test GREEN, inclusi i 115 preesistenti; PostgreSQL 17.6; Regression Contract V1 e cold-backend; TypeScript noEmit; lint perimetro; build completa offline; client boundary scan 51 chunk. Log autorevole: .run/runtime-v3-contract-release.log. Nessuno skip. Migration 008 e 009 invariate in Git; normalizzazione CRLF soltanto nei loader dei test. Nessun accesso Production aggiuntivo, nessun hard delete reale, nessun aumento timeout, push o deploy.
