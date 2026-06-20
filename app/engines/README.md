# ARTECNA OS Engines

Questo documento definisce le regole architetturali comuni per tutti gli
Engine di ARTECNA OS.

## 1. Cos'e un Engine in ARTECNA OS

Un Engine e un modulo applicativo che contiene una capacita di dominio
coerente, riutilizzabile e indipendente dalla presentazione. Espone contratti
tipizzati e un punto di ingresso pubblico, coordina i propri servizi e produce
risultati comprensibili dagli altri moduli del sistema.

Ogni Engine deve avere confini espliciti, una responsabilita riconoscibile e
una specifica che descriva cosa fa, cosa non fa e come collabora con gli altri
Engine.

## 2. Engine e componenti React

Un Engine contiene regole di dominio, tipi, orchestrazione e servizi. Non
renderizza interfacce, non gestisce eventi visuali e non assume l'esistenza di
una pagina o di uno specifico framework UI.

Un componente React presenta informazioni e raccoglie intenzioni dell'utente.
Puo invocare il punto di ingresso pubblico di un Engine e visualizzarne
l'output, ma non deve duplicarne la logica di dominio.

## 3. Direzione delle dipendenze

**Gli Engine non dipendono dalla UI. La UI dipende dagli Engine.**

La dipendenza deve essere unidirezionale:

```text
UI -> Engine pubblico -> servizi interni
```

Un Engine non importa componenti React, stili, pagine o stato visuale. La UI
non accede ai dettagli interni dell'Engine quando e disponibile un contratto
pubblico equivalente.

## 4. Ordine di nascita di un Engine

Ogni nuovo Engine viene costruito in questo ordine:

1. **SPEC**: definisce missione, confini, pipeline, regole e relazioni.
2. **types**: formalizza input, output ed entita condivise.
3. **index**: crea il punto di ingresso pubblico e l'orchestrazione minima.
4. **services**: implementa capacita interne specializzate dietro i contratti.
5. **UI**: collega i componenti agli entrypoint pubblici solo quando l'Engine e
   stabile e verificato.

Ogni fase deve poter essere revisionata e verificata prima di introdurre la
successiva.

## 5. Regole comuni

### Conferma prima delle scritture

Nessun Engine puo scrivere su database o modificare dati operativi senza una
conferma esplicita dell'utente. Analisi, proposta e applicazione devono restare
fasi distinguibili.

### Nessuna duplicazione

Una regola di dominio deve avere un solo proprietario. Gli altri moduli usano
il contratto dell'Engine responsabile e non mantengono copie divergenti della
stessa logica.

### Output tipizzato

Ogni entrypoint pubblico restituisce un output TypeScript esplicito,
serializzabile quando necessario e comprensivo di errori, avvisi o livelli di
confidenza pertinenti.

### Responsabilita singola

Ogni Engine e ogni suo servizio deve avere una responsabilita principale. Le
collaborazioni tra domini avvengono tramite contratti pubblici, non fondendo
responsabilita differenti nello stesso modulo.

### Build verde a ogni step

Ogni step architetturale termina con una build verde prima di essere
registrato. Un Engine cresce attraverso modifiche piccole, verificabili e senza
breaking change involontari.

## 6. Engine previsti

- **Document Intelligence Engine**: classifica e struttura documenti,
  proponendo destinazioni senza applicarle autonomamente.
- **Fascicle Engine**: governa fascicoli, documenti, versioni e relazioni.
- **Knowledge Engine**: rende disponibile conoscenza verificabile e fonti di
  dominio.
- **Workflow Engine**: orchestra processi, stati, approvazioni e attivita.
- **Blueprint Engine**: definisce e applica modelli strutturali riutilizzabili.
- **AI Assistant Engine**: coordina capacita assistive basate su AI entro
  confini e autorizzazioni espliciti.
- **Decision Engine**: prepara alternative, criteri, rischi e supporto alle
  decisioni.
- **Communication Engine**: governa messaggi, canali, destinatari e tracciamento
  delle comunicazioni.
- **Time Engine**: gestisce tempo, scadenze, calendari, durate e pianificazione.
- **Analytics Engine**: produce metriche, aggregazioni e letture analitiche.
- **Identity Engine**: governa identita, ruoli, permessi e contesto di accesso.

## 7. Appartenenza delle nuove funzioni

Ogni nuova funzione di dominio deve appartenere a un Engine chiaramente
identificato. Prima di implementarla occorre stabilire quale Engine ne possiede
la responsabilita e quale contratto pubblico la espone.

Se nessun Engine esistente e appropriato, la funzione richiede prima la
definizione o l'estensione della relativa SPEC. La UI puo contenere soltanto
comportamento di presentazione e interazione, non logica di dominio senza un
proprietario architetturale.
