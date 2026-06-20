# Core Engine

## Missione

Il Core Engine definisce il protocollo comune con cui le capacita di ARTECNA OS
possono essere coordinate. Offre contratti tipizzati per richieste, risposte,
contesto ed eventi senza incorporare la logica di dominio dei singoli Engine.

Il suo obiettivo e rendere espliciti flusso, provenienza e risultato di ogni
orchestrazione, mantenendo indipendenti i moduli specializzati.

## Ruolo di orchestratore

Il Core Engine e il punto di coordinamento delle pipeline che coinvolgono uno
o piu Engine. In futuro potra inoltrare richieste agli entrypoint pubblici,
trasmettere il contesto necessario e raccogliere risposte ed eventi.

L'orchestrazione non trasferisce al Core la responsabilita delle decisioni di
dominio. Ogni Engine resta proprietario delle proprie regole, validazioni e
output.

## Engine coordinati

Il Core Engine puo coordinare:

- Document Intelligence Engine;
- Fascicle Engine;
- Knowledge Engine;
- Workflow Engine;
- Blueprint Engine;
- AI Assistant Engine;
- Decision Engine;
- Communication Engine;
- Time Engine;
- Analytics Engine;
- Identity Engine.

L'inclusione nell'elenco descrive un confine architetturale futuro e non
implica che l'integrazione sia gia implementata.

## Regole di comunicazione

1. Ogni comunicazione usa richieste e risposte tipizzate.
2. Gli Engine vengono raggiunti esclusivamente tramite il loro entrypoint
   pubblico.
3. Il contesto contiene solo i dati necessari alla richiesta e non introduce
   stato globale nascosto.
4. Gli eventi descrivono fatti gia avvenuti e non sostituiscono i comandi.
5. Ogni richiesta conserva un identificativo che permette di correlare
   risposta ed eventi.
6. Errori e risultati restano espliciti; il Core non nasconde fallimenti e non
   inventa fallback di dominio.
7. Nessun Engine importa dettagli interni di un altro Engine.
8. Nessuna pipeline puo scrivere dati senza la conferma utente richiesta dal
   motore responsabile.

## Responsabilita

Il Core Engine deve:

- definire i contratti comuni di orchestrazione;
- identificare l'Engine destinatario di una richiesta;
- propagare contesto e correlazione senza modificarne il significato;
- raccogliere risposte ed eventi in una forma uniforme;
- mantenere l'ordine dichiarato di una pipeline futura;
- restare indipendente da UI, database e provider infrastrutturali.

## Limiti

Il Core Engine non deve:

- contenere logica di business appartenente agli Engine specializzati;
- accedere direttamente a database, storage o Supabase;
- importare componenti React o dipendere dalla UI;
- eseguire autonomamente AI, OCR o analisi documentali;
- decidere autorizzazioni al posto dell'Identity Engine;
- modificare dati, avviare workflow o inviare comunicazioni senza delegare al
  relativo Engine;
- trasformarsi in un contenitore generico di funzioni prive di proprietario.
