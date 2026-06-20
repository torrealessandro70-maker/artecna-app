# Document Intelligence Engine

## 1. Missione

Il Document Intelligence Engine trasforma un documento caricato in una
rappresentazione strutturata, verificabile e riutilizzabile dai moduli di
ARTECNA OS. Il motore deve riconoscere il tipo di documento, estrarne le
informazioni utili, dichiarare il livello di affidabilita e proporre le
destinazioni compatibili senza modificare autonomamente i dati operativi.

L'obiettivo di prodotto e ridurre inserimenti ripetuti, errori manuali e
analisi duplicate, mantenendo sempre visibili origine, motivazioni e limiti
del risultato.

## 2. Un documento si analizza una volta sola

Ogni documento deve attraversare la pipeline una sola volta per una specifica
versione del file. Il risultato dell'analisi diventa una risorsa riutilizzabile
da tutte le destinazioni autorizzate.

Una nuova analisi e ammessa quando cambia il contenuto del file, cambia una
versione rilevante della pipeline oppure l'utente richiede esplicitamente una
rielaborazione. In ogni caso il risultato deve conservare il riferimento al
documento e alla versione degli strumenti che lo hanno prodotto.

## 3. Pipeline

1. **Upload**: acquisisce il file, valida formato e metadati di base e assegna
   un'identita tecnica al documento.
2. **Classifier**: stima il tipo del documento e restituisce confidenza e
   motivazioni. La prima versione usa solo nome file e MIME type.
3. **OCR**: ricava testo da PDF rasterizzati e immagini, conservando quando
   possibile pagina, posizione e confidenza.
4. **Parser**: normalizza il contenuto testuale e riconosce la struttura del
   documento, come sezioni, tabelle, righe e totali.
5. **Entity Extractor**: identifica entita di dominio, per esempio soggetti,
   date, importi, codici, lavorazioni, materiali e riferimenti di cantiere.
6. **Knowledge Lookup**: confronta entita e valori con la conoscenza disponibile
   senza alterare il risultato originale.
7. **Destination Engine**: propone le destinazioni compatibili e spiega perche
   ciascuna destinazione e applicabile o esclusa.
8. **Apply Engine**: prepara e, solo dopo conferma utente, applica le modifiche
   richieste alla destinazione selezionata.
9. **Learning Engine**: raccoglie correzioni e feedback espliciti per migliorare
   regole e modelli futuri, senza apprendere implicitamente dati non autorizzati.

## 4. Responsabilita dei moduli

### Upload

- Accettare esclusivamente i formati supportati.
- Rilevare nome, MIME type, dimensione e impronta del file.
- Rifiutare file non validi senza avviare elaborazioni successive.

### Classifier

- Produrre un `DocumentType` supportato.
- Restituire sempre confidenza e motivazioni leggibili.
- Preferire `altro` quando i segnali non sono sufficienti.

### OCR

- Estrarre testo senza interpretare il significato di business.
- Conservare confidenza e provenienza del testo estratto.
- Segnalare contenuti illeggibili o incompleti.

### Parser

- Convertire testo e layout in una struttura coerente.
- Preservare il collegamento tra dati strutturati e contenuto sorgente.
- Non correggere silenziosamente valori ambigui.

### Entity Extractor

- Estrarre entita tipizzate e normalizzate.
- Associare a ogni entita confidenza, evidenza e posizione nel documento.
- Distinguere valori osservati da valori dedotti.

### Knowledge Lookup

- Arricchire il risultato con riferimenti interni pertinenti.
- Indicare fonte e qualita di ogni corrispondenza.
- Non sovrascrivere le evidenze estratte dal documento.

### Destination Engine

- Valutare quali moduli possono ricevere il risultato.
- Descrivere dati disponibili, dati mancanti e rischi della destinazione.
- Non eseguire importazioni o scritture.

### Apply Engine

- Generare un piano di modifiche revisionabile.
- Richiedere conferma esplicita prima di ogni scrittura.
- Applicare solo le operazioni confermate e restituirne l'esito.

### Learning Engine

- Registrare feedback espliciti in forma tracciabile.
- Separare correzioni locali da miglioramenti generalizzabili.
- Rispettare autorizzazioni, isolamento dei dati e versionamento.

## 5. Cosa l'Engine non deve fare

Il Document Intelligence Engine non deve:

- decidere autonomamente quale dato operativo modificare;
- scrivere direttamente su database o storage durante l'analisi;
- nascondere ambiguita, errori o bassa confidenza;
- inventare dati mancanti o presentare deduzioni come fatti;
- duplicare regole proprie di Fascicle, Knowledge o Workflow Engine;
- incorporare credenziali, configurazioni di ambiente o logica di accesso;
- vincolare la pipeline a uno specifico componente React.

## 6. Conferma utente e scritture

**Nessuna scrittura su database e consentita senza conferma esplicita
dell'utente.**

Analisi e applicazione sono due fasi distinte. Il risultato dell'analisi deve
essere consultabile prima dell'applicazione. La conferma deve indicare almeno
destinazione, operazioni previste e dati coinvolti. Un'autorizzazione generica
o implicita non e sufficiente.

## 7. Output standard futuro: `DocumentAnalysisResult`

Il contratto futuro dovra rappresentare almeno:

- identificativo e metadati del documento sorgente;
- versione della pipeline e data dell'analisi;
- classificazione, confidenza e motivazioni;
- testo estratto con riferimenti a pagina o area;
- struttura riconosciuta e tabelle normalizzate;
- entita estratte con evidenze e confidenza;
- corrispondenze ottenute dal Knowledge Engine;
- avvisi, ambiguita ed errori non bloccanti;
- destinazioni proposte con requisiti e motivazioni;
- stato dell'analisi, senza includere scritture gia autorizzate.

`DocumentAnalysisResult` deve essere serializzabile, versionato e indipendente
dalla UI. Ogni dato derivato deve poter essere ricondotto alla sua evidenza nel
documento originale.

## 8. Relazione con gli altri Engine

### Fascicle Engine

Il Fascicle Engine governa documenti, versioni e relazioni nel fascicolo. Il
Document Intelligence Engine riceve il documento e restituisce l'analisi; non
decide autonomamente archiviazione, visibilita o ciclo di vita del fascicolo.

### Knowledge Engine

Il Knowledge Engine offre fonti e conoscenza di dominio per confronti e
arricchimenti. Document Intelligence conserva separati i dati osservati nel
file dalle corrispondenze o deduzioni ottenute dalla conoscenza.

### Workflow Engine

Il Workflow Engine orchestra attivita, approvazioni e stati operativi. Document
Intelligence puo proporre azioni e fornire dati strutturati, ma non avvia flussi
o approvazioni senza una richiesta esplicita.

## 9. Roadmap tecnica EPIC-01

1. Consolidare la UI comune di upload, risultato e destinazioni.
2. Definire classifier e contratti TypeScript versionati.
3. Introdurre test deterministici per classificazione e casi limite.
4. Definire `DocumentAnalysisResult` e la tracciabilita delle evidenze.
5. Separare adapter OCR dalla pipeline e supportare confidenza per pagina.
6. Implementare parser specifici per tipo documento con fallback generico.
7. Introdurre Entity Extractor e normalizzazione delle entita di dominio.
8. Integrare Knowledge Lookup tramite un contratto di sola lettura.
9. Implementare Destination Engine come sistema di proposte senza scritture.
10. Implementare Apply Engine con anteprima, conferma e audit delle operazioni.
11. Collegare Fascicle e Workflow Engine attraverso interfacce esplicite.
12. Aggiungere Learning Engine solo dopo la definizione di consenso, privacy e
    versionamento del feedback.
