# ARTECNA OS — Fascicle Architecture

L'architettura dei Fascicoli Digitali.

## Indice

1. [Introduzione](#introduzione)
2. [Gerarchia dei Fascicoli](#gerarchia-dei-fascicoli)
3. [Fascicolo Cliente](#fascicolo-cliente)
4. [Fascicolo Cantiere](#fascicolo-cantiere)
5. [Fascicolo Sopralluogo](#fascicolo-sopralluogo)
6. [Fascicolo Documento](#fascicolo-documento)
7. [Fascicolo Attività](#fascicolo-attivita)
8. [Relazioni](#relazioni)
9. [Timeline](#timeline)
10. [Contesto](#contesto)
11. [Principi](#principi)

## Introduzione

Il Fascicolo è l'unità fondamentale di ARTECNA OS.

Ogni informazione appartiene ad almeno un Fascicolo. Una foto, un documento,
un rapportino, una decisione, una nota o un'attività non vivono mai come
elementi isolati: esistono dentro un contesto riconoscibile.

In ARTECNA OS l'utente non naviga tra moduli.

Naviga tra Fascicoli.

Questo principio cambia il modo in cui il lavoro viene rappresentato. Il
sistema non chiede all'impresa di cercare il punto giusto in cui inserire un
dato; organizza il lavoro attorno agli elementi reali dell'impresa: cliente,
cantiere, sopralluogo, documento, rapportino, attività.

## Gerarchia dei Fascicoli

La struttura dei Fascicoli segue una gerarchia naturale del lavoro edile:

```text
Impresa
↓
Cliente
↓
Cantiere
↓
Sopralluogo
↓
Documento
↓
Rapportino
↓
Attività
↓
Elemento (foto, allegati, audio, note)
```

Ogni Fascicolo eredita il contesto di quello superiore.

Un documento collegato a un cantiere non è soltanto un file: porta con sé il
cliente, il luogo, la fase del lavoro, le persone coinvolte, la cronologia e le
decisioni già prese.

Questa ereditarietà permette ad ARTECNA OS di mantenere continuità tra le
informazioni e di ridurre la frammentazione tipica dei sistemi tradizionali.

## Fascicolo Cliente

Il Fascicolo Cliente rappresenta la memoria commerciale, amministrativa e
operativa del rapporto con un cliente.

Contiene:

- Anagrafica
- Contatti
- Storico
- Cantieri
- Documenti
- Preventivi
- Fatture
- Timeline

Il Fascicolo Cliente permette di ricostruire rapidamente la relazione nel
tempo: lavori eseguiti, richieste aperte, documenti prodotti, preventivi
inviati e attività ancora da completare.

## Fascicolo Cantiere

Il Fascicolo Cantiere è il centro operativo di ARTECNA OS.

È il luogo in cui convergono tutte le informazioni necessarie a capire lo
stato reale del lavoro, coordinare le attività e prendere decisioni.

Contiene:

- Scheda
- Timeline
- Foto
- Documenti
- Preventivi
- SAL
- Rapportini
- Operai
- Attività
- Economia
- AI
- Decisioni

Il Fascicolo Cantiere non è una semplice raccolta di dati. È la rappresentazione
viva del lavoro: cosa è stato fatto, cosa manca, quali costi stanno emergendo,
quali documenti sono rilevanti e quali decisioni richiedono attenzione.

## Fascicolo Sopralluogo

Il Fascicolo Sopralluogo raccoglie la memoria del primo contatto tecnico con
il lavoro.

Contiene:

- Note
- Foto
- Disegni
- Audio
- Firma
- Analisi AI
- Preventivo AI

Il Fascicolo Sopralluogo permette di trasformare osservazioni, immagini e
appunti in una base operativa utilizzabile per preventivi, decisioni e
organizzazione del cantiere.

## Fascicolo Documento

Ogni documento possiede un proprio Fascicolo.

Un documento non è soltanto un allegato: può contenere informazioni, versioni,
decisioni, commenti e collegamenti con altri elementi del lavoro.

Contiene:

- Versioni
- Analisi
- Estrazioni
- Commenti
- Collegamenti
- Decisioni AI

Il Fascicolo Documento consente di seguire la vita del documento nel tempo:
quando è arrivato, cosa contiene, a cosa si collega, quali informazioni sono
state estratte e quali decisioni ha generato.

## Fascicolo Attività

Ogni attività mantiene una propria memoria operativa.

Contiene:

- stato
- responsabile
- documenti
- foto
- timeline
- decisioni

Il Fascicolo Attività permette di non perdere il contesto delle azioni da
svolgere. Un'attività può nascere da un sopralluogo, da un rapportino, da una
foto, da una decisione AI o da una richiesta del cliente, e deve conservare
questa origine.

## Relazioni

Un'informazione può appartenere a più Fascicoli.

Esempio:

```text
una foto
→ Cantiere
→ Rapportino
→ Attività
→ Documento
```

Questo avviene senza duplicare dati.

La foto resta una sola. I collegamenti permettono di ritrovarla nei contesti in
cui è rilevante. Il valore non è nella copia dell'informazione, ma nella rete di
relazioni che la rende utile.

ARTECNA OS privilegia i collegamenti rispetto alla duplicazione. Ogni elemento
deve poter essere richiamato da più prospettive mantenendo una sola identità.

## Timeline

Ogni Fascicolo possiede una Timeline.

La Timeline è la memoria cronologica del Fascicolo. Racconta gli eventi
nell'ordine in cui accadono e permette di ricostruire il percorso del lavoro
senza cercare informazioni in sezioni separate.

Contiene:

- Foto
- Rapportini
- Documenti
- SAL
- Decisioni
- Pagamenti
- Attività
- Operai
- AI

La Timeline rende visibile la storia del Fascicolo: cosa è successo, quando, in
quale contesto e con quali conseguenze operative.

## Contesto

Il Context Engine ha il compito di mantenere vivo il significato delle
informazioni.

Ogni Fascicolo genera un contesto. I Fascicoli superiori arricchiscono quelli
inferiori, fornendo informazioni su cliente, cantiere, documenti, attività,
stato economico, decisioni e cronologia.

L'AI osserva sempre il contesto.

Mai un elemento isolato.

Una foto, una nota o un documento assumono valore perché appartengono a un
insieme di relazioni. Il contesto permette al sistema di comprendere non solo
che cosa è stato registrato, ma perché è rilevante.

## Principi

Ogni informazione nasce una sola volta.

Ogni Fascicolo rappresenta una memoria.

Le relazioni sono più importanti dei dati.

Il contesto vale più del singolo documento.
