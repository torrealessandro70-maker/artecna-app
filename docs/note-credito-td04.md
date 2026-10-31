# Note di credito fornitori TD04

Implementazione locale dal commit `f0397979de7e3a7deb6d16d8870cd93746ed36ca`.
Richiede la migrazione additiva `20261031_note_credito_fornitori.sql`, da sottoporre
a precheck/autorizzazione prima di qualsiasi installazione applicativa.
Nessun backfill automatico dei documenti già importati.

## Importazione e utilizzo

XML singolo e ZIP condividono il parser fiscale: `TipoDocumento`, riferimenti
`DatiFattureCollegate`, numero/data e indicazioni di linea. Il codice fiscale viene
scritto in `fatture_fornitori.tipo_documento`; l'XML è conservato integralmente.
I riferimenti restano nell'XML e vengono riestratti, senza colonne ridondanti.
Un XML nuovo senza tipo fiscale valido viene rifiutato. Per i record storici con
tipo legacy, il riconoscimento legge l'XML originale: nessuna inferenza da segno,
descrizione, nome del file o fornitore.

Una TD04 viene importata senza assegnazioni/classificazioni ordinarie. In
«Righe fattura aperta» si apre esclusivamente il pannello Nota di credito:
«Da riconciliare» oppure «Rettifica applicata». Lo stato è derivato dal registro
rettifiche; il vecchio `stato` dell'importazione non viene usato come stato della nota.
«Storni esclusi» rimane una classificazione legacy distinta e non registra rettifiche.

Il titolare attivo deve selezionare esplicitamente riga della nota, riga/quotazione
originaria realmente assegnata e quantità. La conferma attesta la corrispondenza:
il sistema non identifica prodotti uguali dalla descrizione o dalla posizione.
Il server verifica XML, identità fiscale, inventario univoco delle righe, quote,
contesto aziendale e ownership del Cantiere. La sola conferma non supera questi controlli.
Le indicazioni di linea del riferimento XML non diventano automaticamente UUID originari.

## Origine e rettifica

L'origine candidata deve essere unica per partita IVA, numero e data richiamati
dall'XML; la testata persistita deve coincidere con l'XML. Una fattura omonima non
è un'identità verificata; si verifica anche il Paese dell'identificativo IVA nell'XML.
Le quote derivano da `economia_righe`/`economia_raccolte`,
`materiali_cantiere`, `materiali_impresa` e `spese_impresa`, tramite FK di riga.
Un nome Cantiere senza UUID non viene trasformato in associazione.

Origine mancante, ambigua, senza XML verificabile, non assegnata, righe incoerenti
o collegamenti incompleti rimangono da riconciliare. Nessun effetto economico automatico.
Sono supportate più righe e la rettifica di una parte dell'origine, anche distribuendo
una riga di nota fra più quote. La riga della nota viene registrata integralmente
in una transazione; altre righe possono restare pendenti.

`fornitori_rettifiche` conserva nota/riga, origine/riga, destinazione verificata,
Cantiere/categoria, quantità, importi negativi, attore, richiesta e fotografie.
Owner previsto: principal di installazione `postgres`. RLS attiva e nessun accesso
diretto per client; tre RPC con `SECURITY DEFINER`, search_path ristretto e controllo
del titolare attivo. Le letture del Cantiere richiedono anche la sua ownership.

Il payload non contiene importi da accettare dal browser: vengono calcolati dal server.
La chiave di richiesta è idempotente; la nota e l'origine sono bloccate durante
l'operazione, con serializzazione delle note concorrenti e limiti cumulativi su
quantità/netto/costo. Una riga già rettificata non può essere applicata con un nuovo ID.
Registro immutabile, FK `RESTRICT`, dati economici/provenienza originari protetti.
I guard storici non vengono sostituiti; si aggiungono protezioni circoscritte.
Nessuna cancellazione, riapertura di disponibilità ordinarie o movimentazione fisica
del magazzino. La conservazione dello storico può impedire l'eliminazione definitiva
del Cantiere e delle sorgenti collegate. Non è introdotto un percorso di annullamento.
Le scritture protette usano `READ COMMITTED`, come il percorso HTTP ordinario:
isolamenti con snapshot persistente vengono rifiutati. I lock sui documenti e sulle
quote precedono la rivalidazione, anche rispetto a UPDATE legacy concorrenti.

## Importi e KPI

I valori XML non sono riscritti. Il registro contiene la rettifica economica negativa.
Sono gestite TD04 con convenzione XML interamente negativa o positiva; quantità XML
negative sono conservate, mentre la quantità rettificata nel registro è una grandezza.
La base costo resta quella della quota: imponibile in Economia, totale registrato
nei materiali/spese. Il costo si calcola dai decimali XML prima dell'arrotondamento,
evitando di applicare l'IVA a un netto già arrotondato al centesimo.
Per le spese, prive di prezzo unitario proprio, il netto è quello XML dopo gli
sconti. Quote materiali/Economia con valorizzazione incoerente rispetto all'XML
restano da riconciliare: non si rettifica implicitamente un errore precedente.

Il riepilogo fornitori in Economia generale espone originali, rettifiche e netto,
con gli ID delle fonti. Economia Cantiere aggiunge una sola volta il delta delle note
ai costi già calcolati e alle quote Economia esistenti. Date: documento originario
per le quote, data della nota per la rettifica. Un periodo con sole rettifiche può
avere costi negativi: non si forza lo zero e non si usa il grafico di ripartizione positivo.
La scheda Home conserva il perimetro legacy dei cantieri, quindi applica solo le
rettifiche dei materiali già compresi in quella base, non quelle di altre destinazioni.
Se la fonte non è inclusa univocamente nella base legacy, il totale è indisponibile,
con rinvio al riepilogo documentale autorevole. Una lettura fallita non diventa zero.

Il riepilogo documentale Ditta continua a escludere TD04 dai documenti ordinari:
la nota non è sottratta nuovamente dai costi e non si modifica la contabilità IVA,
il cumulativo pagato, gli acconti clienti, il SAL o l'utile fiscale.

## Limiti espliciti

- La corrispondenza commerciale riga/allocazione viene attestata dal titolare:
  non è certificata automaticamente da testi simili o da numeri di linea.
- Più origini fiscali nella stessa nota, segni misti, riepiloghi/arrotondamenti XML
  non riconciliabili o IVA/natura differente richiedono un percorso specifico futuro.
- Il nuovo registro opera in EUR: una divisa diversa o mancante nell'XML resta
  da riconciliare, senza conversioni monetarie. Una nota di credito non è un'origine
  positiva valida per un'altra rettifica.
- Assegnazioni ordinarie TD04 pregresse non vengono cancellate né compensate
  automaticamente; sono segnalate e impediscono un totale presentato come completo.
- Spese legacy senza FK di riga e documenti senza XML verificabile non vengono
  riconciliati per supposizione. Altri tipi fiscali non sono certificati da questo step.
- I test del registro sono su PostgreSQL locale sintetico. Il browser usa componenti
  reali con risposte sintetiche localhost: non certifica Auth/PostgREST/RLS Production.
- Non è una revisione delle policy delle sorgenti legacy: non vengono dichiarati
  nuovi permessi o un isolamento globale di quelle tabelle. Prima dell'installazione
  occorre il precheck del catalogo/privilegi reale e dei writer attualmente online.

## Compatibilità distruzione F3C3.3

Le rettifiche sono storico finanziario: non entrano nel manifest distruttivo del
Cantiere e non vengono cancellate insieme alle quote o alle fonti. Le nove FK del
registro restano RESTRICT e non deferrable. Cinque rientrano nell'inventario chiuso
di `artecna_distruzione.inizia_contesto(uuid)`:

| Colonna del registro | Padre (chiave id) | Ruolo |
| --- | --- | --- |
| cantiere_id | cantieri | Contesto economico della rettifica |
| economia_riga_id | economia_righe | Quota Economia originaria |
| materiale_cantiere_id | materiali_cantiere | Assegnazione materiale originaria |
| nota_riga_id | fatture_fornitori_righe | Riga della nota |
| origine_riga_id | fatture_fornitori_righe | Riga fiscale rettificata |

Il precedente inventario JSON di 48 FK viene esteso esattamente a queste cinque:
nomi, schemi, colonne figlie/padri, DELETE/UPDATE, MATCH, validazione e deferrability.
Non viene sostituito da un conteggio. Una FK mancante, estranea o modificata continua
a produrre P2113. La RPC di distruzione riconosce solo le stesse cinque FK già
certificate, senza aggiungere il registro alle liste di DELETE.

Dopo la verifica strutturale, prima della creazione del contesto e prima di outbox
o DELETE applicative, il guard rifiuta un Cantiere collegato allo storico TD04.
Controlla gli UUID del registro, delle quote e delle righe fiscali: anche una quota
Impresa con cantiere_id NULL può conservare una fonte assegnata a quel Cantiere.
Il rifiuto è atomico e non cancella né modifica nota, origine, quote o rettifiche.
Uno storico estraneo non impedisce il cleanup di un altro Cantiere. Una nota
pendente senza legame al Cantiere non viene collegata per nome o riferimento XML;
la testata e le righe non associate restano disponibili.

Con registro vuoto, il cleanup segue l'ordine precedente. Restano invariati i
blocchi storici su Materiali/Fatture, attribuzioni clienti, risorse condivise,
Quaderni e dipendenze strutturate. Non sono introdotti cascade o bypass.

La correzione è nella medesima migrazione TD04, mai installata: una sola transazione
crea il delta e sostituisce due corpi esistenti, preservando firma, owner e ACL.
Il SQL verifica prima le definizioni baseline e i permessi dell'installatore.
Per la RPC posseduta da `artecna_cantieri_delete_rpc` richiede SET sul ruolo owner e
CREATE di quel ruolo sullo schema public; non li concede. Usa SET LOCAL ROLE e
RESET ROLE solo per la sostituzione. Un prerequisito mancante interrompe prima del
DDL. Questo è un requisito del futuro precheck, non un'autorizzazione a modificare
privilegi o installare la migrazione.
