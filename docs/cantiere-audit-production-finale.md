# Grafo Cantiere dal catalogo Production esportato

Audit offline del 7 novembre 2026. Nessun accesso DB, SQL eseguito, RPC,
migration, modifica dati, push o deploy in questo step.

Questo rapporto sostituisce le conclusioni preliminari basate sui 53 vincoli
storici. Non certifica un'implementazione distruttiva: certifica il grafo e
le strategie necessarie alla sua implementazione.

## Integrità e completezza degli input

Fonte autorevole esclusiva dello schema: i due CSV forniti in audit-production.
Progetto dichiarato nella consegna: axuiaiglbahygsmeoypy. I metadata SQL non
contengono il project ref: la provenienza è quella attestata dalla consegna,
non ricavata dal nome database postgres.

| Input | Byte | Record dopo header | SHA256 |
|---|---:|---:|---|
| e2-production-catalog.csv | 60297 | 122 | e4a09e7773dc5780916b320ca3bd4ba336d802c6c67d81c01b6822b1193cca71 |
| production-schema-snapshot.csv | 1219777 | 1806 | 4e5bdd0d6befabbbc90cad17617419af96f9f92437f5915941827f4ff22b11c1 |

Parsing CSV con gestione di quote, doppi apici e newline incorporati. Header
esatto section,metadata; tutti i metadata JSON validi. Nessuna cella finale
troncata, quote non chiuse o riga con numero colonne diverso da due.
I conteggi coincidono integralmente con quelli attesi: nessuna evidenza di
troncamento negli export ricevuti.

E2: 36 colonne, 35 vincoli, 9 funzioni, 8 indici, 2 relazioni, 30 trigger,
1 policy, 1 meta. Snapshot: 664 colonne, 295 vincoli, 212 funzioni, 125 indici,
57 relazioni, 370 trigger (inclusi RI interni), 82 policy, 1 meta.
Entrambi: postgres, PostgreSQL 17.6, read_only=on.
Timestamp UTC: E2 05:54:12.445507; ampio 06:25:16.625885, 2026-11-07.
Tutti i 121 metadata E2 escluso meta coincidono con il secondo snapshot.

## Riconciliazione E2 definitiva

**E2_PRESENTE_DIVERSA** rispetto al contratto complessivo del file locale.
La capability centrale è presente e equivalente; Production è un superset
semantico, non una semplice differenza di rendering SQL.

Il file locale originale ha SHA256
4152005d418653c8550dde379d56f018515ca8dfb16fe9c2718a806fbc59aed1,
verificato senza modificarlo.

| Elemento | Production |
|---|---|
| public.economia_righe | presente, OID 166429 |
| rapportino_prestazione_id | uuid, nullable, nessun default |
| prestazione_revisione_acquisita | bigint, nullable, nessun default |
| prestazione_snapshot | jsonb, nullable, nessun default |
| UNIQUE | economia_righe_prestazione_unique (rapportino_prestazione_id), non differibile |
| FK | economia_righe_prestazione_fk |
| Definizione | FOREIGN KEY (rapportino_prestazione_id) REFERENCES public.rapportino_prestazioni(id) ON DELETE RESTRICT |
| ON UPDATE | NO ACTION |
| Validazione | validated=true, non differibile, non deferred |
| Indice UNIQUE | public.economia_righe_prestazione_unique, btree, unique/valid/ready=true |

Quattro CHECK sono semanticamente più ampi del file E2 locale:

- economia_righe_origine_valore_check ammette anche fattura_fornitore;
- economia_righe_origine_coerenza_check ammette fattura_fornitore con sorgente
  presente e indice voce nullo;
- economia_righe_analitiche_origine_check ammette materiale da fattura;
- economia_righe_prestazione_provenienza_check ammette la fattura senza i tre
  campi prestazione, continuando a richiederli per origine rapportino.

Definizioni complete in audit-production/summary.json e normalized-production.json.
La differenza è riconciliata: non richiede reinstallare E2 e non impedisce
di certificare il grafo. La precedente provenienza Git B resta un fatto distinto
dalla presenza attuale nel DB. Non applicare il vecchio file su questo schema.

Trigger non interni su economia_righe:
e31_prezzo_materiale_cliente, e32_esclusione_proposta, e32_provenienza,
materiali_economia_globale_guardia, materiali_economia_stato, nc_quote_economia.
Le definizioni reali, owner, SECURITY DEFINER, config/search_path, ACL e hash
dei relativi helper sono conservati negli export e nel CSV protezioni.
verifica_riga_economia_rapportino valida anche concordanza raccolta, rapportino,
prestazione, cantiere e snapshot; la FK da sola non basta a garantirla.

## Perimetro del grafo e conteggi

| Misura | Totale |
|---|---:|
| FK reali nel catalogo esportato | 84 |
| FK entranti nella chiusura del Cantiere | 57 |
| Di cui dirette verso cantieri | 18 |
| Di cui indirette | 39 |
| FK di confine verso padri globali/sorgenti | 9 |
| Perimetro pertinente hard-delete, senza duplicati | 66 |
| FK di contesto esterno preservato | 18 |
| Tabelle nella chiusura entrante | 31 |
| Trigger applicativi nella chiusura | 45 |
| Distinte funzioni trigger della chiusura | 36 |
| Helper/guardie selezionati e dipendenze statiche | 77 |
| Trigger applicativi nell'intero snapshot | 57, su 43 funzioni distinte |
| Lookup legacy per nome | 14 |
| Voci inventario non-FK | 71 |
| Voci inventario Storage e contenitori potenziali | 30 |

Ambito dell'export: relazioni public/artecna_* e FK ai loro confini. Gli 84
non sono presentati come inventario di tutti gli schemi interni auth/storage
di Supabase. Tutti gli estremi figli delle FK esportate hanno metadata tabella;
auth.users è un padre esterno esplicitamente preservato.

La chiusura si calcola seguendo le FK entranti da cantieri fino a punto fisso;
poi si aggiungono i nove archi uscenti verso padri globali, senza trasformare
quei padri in oggetti da eliminare. Tutte le 84 FK, incluse le 18 esterne al
perimetro, sono elencate in cantiere-fk-production.csv.

Le 71 voci non-FK sono un inventario dichiarato: 14 lookup per nome, 31 archi
ID/logici privi di FK e 26 contenitori JSON/snapshot. Non sono 71 vincoli DB,
né 71 collegamenti attivi provati su righe: non sono state lette righe.
I contenitori JSON sono censiti conservativamente; il contenitore segue la
propria ownership e non conferisce proprietà sui suoi referenti.

## Matrice ownership e azione

La matrice integrale, una riga per ciascuna delle 57 relazioni esportate, è
cantiere-ownership-production.csv. Le singole FK hanno classificazione,
azione, estremi e percorso nel CSV cantiere-fk-production.csv. Le 71 voci
logiche, con regola operativa, sono in cantiere-relazioni-logiche.csv.

Il percorso nel CSV descrive un collegamento al root; per un oggetto shared
NON è un percorso che ne dimostra la proprietà. La classificazione è per
dominio/riga coerente: non certifica l'assenza di dati corrotti o discordanti.
Questi dovranno essere rilevati sotto lock, senza cancellazioni trasversali.

| Dominio | Ownership | Azione / percorso |
|---|---|---|
| cantieri | owned_uuid | DELETE id target, ultimo |
| preventivi, lavorazioni base, SAL | owned_uuid; legacy_da_normalizzare se solo nome | DELETE cantiere_id; derivare dal preventivo solo se tutti i percorsi concordano; altrimenti NORMALIZE_FIRST |
| varianti | owned_uuid | DELETE cantiere_id dopo figli e documenti integrativi |
| lavorazioni/sorgenti/documenti Variante | owned_derivabile | DELETE tramite variante_id→varianti.cantiere_id |
| fonti Memory/visive | owned_derivabile per legame; shared per fonte | DETACH legame target, preservare Quaderno/foto esterna |
| analisi osservatore | owned_derivabile | DELETE snapshot tramite variante |
| raccolte Economia | owned_uuid | DELETE cantiere_id dopo fonte Variante, righe e sorgenti |
| righe/sorgenti Economia | owned_derivabile | DELETE raccolta_id→raccolta.cantiere_id; archivio contabile separato prima |
| ponte Economia–Variante | owned_derivabile | DELETE fonte dopo lavorazioni, prima raccolta; confrontare cantiere dei due lati |
| rapportini | owned_uuid | DELETE cantiere_id dopo tutti i figli |
| prestazioni/materiali/richieste | owned_derivabile | DELETE rapportino_id→rapportini.cantiere_id |
| timbrature | owned_uuid o derivazione da prestazione | DELETE prima della prestazione; normalizzare legacy senza UUID |
| foto/allegati V1 | owned_uuid e owned_derivabile concordi | DELETE dopo preparazione outbox, con protocollo reciproco foto/allegato |
| materiali/attrezzi/acconti/pagamenti/incassi operativi | owned_uuid | DELETE target dopo separazione evidenza contabile se presente |
| fatture emesse/fornitori | contabile_da_detach | KEEP_LEGAL documento, DETACH cantiere; non dedurre obbligo legale dal solo trigger, conservazione cautelativa del dominio |
| righe fattura | contabile_da_detach | DETACH destinazione operativa, preservare riga originale e documento |
| rettifiche TD04 | contabile_da_detach | KEEP_LEGAL evidenza + DETACH riferimenti operativi mediante nuova migration |
| attribuzioni/classificazione fatture | contabile_da_detach | preservare ricevute/storico; DETACH link operativi, archivio separato |
| materiali_impresa/spese_impresa | shared | preservare patrimonio aziendale; DETACH soltanto associazione target, non il record globale |
| utenti/operai/clienti globali | shared | preservare padre; DELETE membership o DETACH associazione specifica |
| memoria_prezzi | legacy_da_normalizzare | NORMALIZE_FIRST: non ha cantiere_id nello snapshot |
| agenda | shared o attività esplicitamente assegnata | DETACH collegamento JSON canonico, preservare altri contenuti condivisi |
| contesto/capability F3C3 | owned_uuid/owned_derivabile tecnico | chiudere/cancellare contesto temporaneo, mai sessioni globali |
| cleanup_storage | owned_uuid tecnico | mantenere job durevole indipendente dal root; DETACH tecnico già senza FK |
| Quaderno/note/sopralluoghi/sessioni/cataloghi prezzi | shared | preservare record globali e fonti; DETACH soltanto link target ove presente |

Non esiste nello snapshot una tabella clienti globale distinta: fatture_emesse
usa cliente text; attribuzioni usa cliente_confermato text. Non inventare
un DELETE clienti. L'eventuale anagrafica futura dovrà restare globale.
Presenze è il dominio timbrature: non è presente una tabella presenze separata.

## Cicli e ordine leaf → root

Componenti cicliche tra tabelle: cantieri/preventivi_cantiere/varianti_cantiere
e foto_cantiere/artecna_rapportini.allegati. Self-FK:
variante_lavorazioni_precedente_fk, preventivi_cantiere_preventivo_contrattuale_id_fkey,
prezzi_lavorazioni_origine_prezzario_fkey (quest'ultima globale, preservata).
Questi sono cicli di schema: non attestano cicli effettivi tra righe.

Ordine richiesto, dopo lock, validazione concordanza, separazione contabile e
preparazione outbox nella medesima transazione:

1. SAL prima di lavorazioni; link Memory/visivi e snapshot analisi target.
2. Documenti Variante e lavorazioni Variante dal leaf della self-FK; poi fonti
   Variante incluse quelle Economia. Fonti esterne conservate.
3. Lavorazioni degli integrativi prima dei loro documenti; integrativi prima
   delle testate Variante. Sciogliere i puntatori contrattuali del solo target
   nel punto richiesto dal protocollo contrattuale, prima di rimuovere il padre.
4. Righe Economia prima di sorgenti/raccolte e prima delle prestazioni E2.
   La fonte Economia–Variante deve già essere stata eliminata prima della raccolta.
5. Timbrature prima delle prestazioni; richieste/materiali prima dei rapportini.
6. Ciclo foto/allegato: entrambi i puntatori sono nullable nello schema, ma
   le guardie non autorizzano un semplice UPDATE libero. Nuova capability
   transazionale circoscritta: spezzare il puntatore foto.allegato_v1_id del
   solo target, poi allegato→foto; mantenere reciprocità e lease sicure.
7. Rapportini, testate Variante, raccolte senza figli; lavorazioni/preventivi
   residui secondo self-FK/genealogia, quindi dati operativi diretti.
8. Terminare contesto; membership e root ultimi; zero residui con identità
   dei figli salvate prima dei DELETE, non solo join su padri già scomparsi.

L'ordine è un disegno per la futura migration, non SQL da eseguire. Archi
con dati discordanti o riferimenti condivisi inseparabili richiedono risoluzione
prima dell'operazione. Una fase fallita deve annullare anche detach/outbox.

## RPC installata: analisi completa del corpo

La definizione integrale estratta è
audit-production/functions/public.elimina_cantiere_definitivamente.166199.sql.
Owner artecna_cantieri_delete_rpc; SECURITY DEFINER; search_path pg_catalog,
pg_temp. EXECUTE soltanto al ruolo tecnico e authenticated. JWT, owner prima
e dopo lock membership, conferma esatta ELIMINA e lock root presenti.

| Dominio | Gestito oggi | Blocca oggi | Richiesto |
|---|---|---|---|
| root/membership | sì, UUID e root ultimo | owner/input/contesto incoerenti | conservare controlli e ampliarli ai nuovi figli |
| preventivi/SAL/Varianti classici | sì, conteggi e self-FK | FK esterne/cicli/guardie contrattuali | mantenere ordine, sciogliere cicli solo nel target |
| Memory/visivi/analisi | sì, DELETE solo legame/snapshot | fonte condivisa trasversale incoerente | preservare sempre fonte globale |
| Economia classica | sì, righe→sorgenti→raccolte | stato/materiali/provenienza/quote | estendere capability nelle guardie senza bypass generale |
| ponte Economia–Variante | non distrutto correttamente | inizia_contesto P2131 | fonte dopo lavorazioni e prima raccolta; oggi raccolta viene tentata troppo presto |
| Rapportini strutturati | figli non nel manifest distruttivo | inizia_contesto P2131 | aggiungere prestazioni/materiali/richieste e post-check |
| E2 | helper numero_fk_economia_rapportino presente; non hard delete prestazioni | P2131 per strutturati; e32_provenienza rifiuta DELETE origine rapportino | includere righe e prestazioni, estendere guardia solo al contesto owner certificato |
| foto/allegati V1 | non eliminati | compat_foto_verifica_cantiere P2131, poi guardia contesto | ciclo reciproco, lease e outbox V1; non rimuovere solo il messaggio |
| materiali fattura | quota operativa esclusa | P2113 se fattura_riga_id presente | separare conservazione e cancellare quota operativa |
| materiali_impresa | correttamente non cancellati | P2113 se riferiscono riga fattura target | preservare riga fattura globale e stock; detach della destinazione target |
| attribuzioni cliente | non nel manifest, guardie sorgenti attive | proteggi_origine rifiuta DELETE anche dopo scollegamento | archivio + detach dei riferimenti operativi |
| TD04 | mai nel manifest | inizia_contesto P2113, FK e nc_immutabile | KEEP_LEGAL + DETACH tramite nuova identità archivistica |
| legacy/agenda/ricevute logiche | non nel manifest UUID attuale | non risolti dalla RPC attuale | normalizzazione prima, poi includere link operativi nei residui |
| Storage | outbox legacy, cinque categorie bucket preventivi | nessun consumer canonico dimostrato | copertura completa riferimenti e worker successivo |

Il corpo mantiene impronte dell'outbox preesistente, confronta conteggi di
DELETE con manifest, verifica residui e identità, chiude il contesto e cancella
root ultimo. Le FK causano eccezione P2113 e rollback; gli altri errori propagano.
Non trasformare gli errori in successo parziale.

## TD04 / attribuzioni: migration necessaria

nc_immutabile impedisce ogni mutazione del registro; il CHECK
num_nonnulls(economia_riga_id,materiale_cantiere_id,materiale_impresa_id,spesa_impresa_id)=1
richiede oggi un referente operativo. Le FK RESTRICT e la conservazione di
origine/nota rendono invalido un semplice SET NULL o DELETE della quota.

Migration futura separata: identità archivistica di quota/documento, snapshot
verificabile di importi/quantità/provenienza e vincolo XOR tra riferimento
operativo e archivistico; mantenere numeri e originali; reader capaci di leggere
entrambi gli stati. Consentire solo una transizione controllata a contesto
owner, verificata dai trigger, senza disabilitare nc_immutabile o nc_proteggi_*.
Stessa separazione per attribuzioni fattura/acconto e ricevute idempotenti:
conservare evidenza, eliminare legame operativo e vecchio cantiere_id attivo.
Definire accesso archivio dopo rimozione della membership.

Gli UUID storici eventualmente conservati devono stare nel dominio archivistico
esplicito; zero riferimenti al target nelle tabelle operative gestite. Non
presentare uno snapshot storico come FK viva o ownership di altri cantieri.

## Legacy: 14 lookup per nome, senza cancellazione per nome

preventivi_cantiere, preventivo_lavorazioni, sal_lavorazioni, rapportini,
foto_cantiere, pagamenti_fornitori, acconti_cantiere, incassi_non_fatturati,
fatture_emesse, fatture_fornitori_righe, memoria_prezzi, materiali_cantiere,
attrezzi_cantiere, timbrature. Tredici hanno anche cantiere_id; memoria_prezzi no.

UUID presente e coerente prevale anche con nomi omonimi/obsoleti. UUID assente:
backfill soltanto da relazione strutturale canonica univoca e concorde, con
FK/guardia sostitutiva; altrimenti assegnazione esplicita owner autorizzata
della riga all'UUID, lock e versione, audit e retry. Aggiungere cantiere_id a
memoria_prezzi. I nuovi writer non devono creare nuove righe solo-nome.
Il nome unico attuale non basta. Dopo normalizzazione, DELETE normale per UUID.

## Storage: inventario e limite fisico

consumer_storage_canonico = NO.

Elenco completo delle sorgenti/candidati noti nel perimetro ricevuto:
cantiere-storage-production.csv, 30 voci. Include i riferimenti diretti e tutti
i 26 contenitori JSON dello snapshot, anche quando non è dimostrato che
contengano file. Il numero non è un conteggio di oggetti Storage né una prova
di riferimenti presenti nelle righe.

Riferimenti diretti: preventivi/file_path+file_url; foto/file_path+file_url+
thumbnail_url; materiali e attrezzi/file_path+file_url; documenti Variante/
storage_path; allegati Rapportino/bucket+file_path; note_allegati/storage_path+
url (preventivi); quaderno_allegati/storage_bucket+storage_path+url;
quaderno_copie_allegati/storage_bucket+storage_path; fatture_emesse/pdf_url+xml_url.

Ulteriori contenitori: JSON Quaderno/note, assets e documenti di richiami/gestioni,
snapshot Economia/Variante/analisi, payload e ricevute; candidati conservativi
nel CSV con ownership e regola. Base64/data URI inline non sono automaticamente
oggetti Storage; nome_file/file_sha256/data_documento non sono object key.
fatture_fornitori conserva xml_testo/pdf_testo inline: non contiene un path
Storage dimostrato. Non inferire bucket dal nome documento.

prepara_cleanup_storage raccoglie soltanto cinque sorgenti legacy e forza
bucket preventivi: preventivi, foto, materiali, attrezzi e documenti Variante.
Non copre rapportini-v1, URL alternativi/thumbnail, JSON, riferimenti globali
Quaderno/note, lease upload e documenti contabili. cleanup_storage ha stato,
tentativi, completed_at e UNIQUE(cantiere_id,bucket,path), ma nessuna lease
worker e nessuna garanzia di verifica ultimo riferimento nel consumer.
I protocolli di rimozione portale/Quaderno non sono il consumer universale.

Step successivo obbligatorio: registry dei riferimenti e writer coperti,
outbox estesa, lock/lease oggetto condivisi coi writer, retry idempotente,
ultimo riferimento, riconciliazione upload pendenti e completed solo dopo
successo fisico. Un SELECT count seguito da DELETE Storage non basta contro
nuovi riferimenti concorrenti. Nessuna cancellazione fisica sincrona in SQL.

## Verifiche offline e verdetto

Parser e report riproducibili: scripts/analyze-production-catalog.cjs e
scripts/report-production-ownership.cjs. Verificati dimensioni, conteggi,
metadata, cross-snapshot E2, copertura di tutte le FK, presenza delle colonne
di ogni relazione logica e sorgente candidata Storage, sorgenti delle funzioni
dei trigger pertinenti, hash del file E2 originale. Nessuna query eseguita.

Non restano evidenze schema mancanti nel perimetro esportato. Ownership
moderna classificata; gli archi globali sono preservati; il legacy ha percorso
esplicito di normalizzazione. Le migration contabili, le guardie distruttive,
il protocollo per i cicli e i test PostgreSQL sono lavoro di implementazione
successivo, non prove già superate. Non si dichiara ancora hard delete sicuro
eseguibile o cancellazione fisica completa.

**GRAFO CERTIFICATO — pronto per implementazione hard delete**
