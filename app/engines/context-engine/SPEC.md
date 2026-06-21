\# ARTECNA OS — Context Engine



\## Missione



Il Context Engine è il motore che ricostruisce il contesto operativo corrente dell'impresa.



Non prende decisioni.

Non modifica il database.

Non esegue azioni.



Il suo compito è capire \*\*di cosa sta parlando l'utente\*\* e raccogliere tutte le informazioni utili prima che intervenga il Decision Engine.



\---



\# Filosofia



L'utente non deve compilare moduli.



L'utente racconta il lavoro.



ARTECNA comprende il contesto.



\---



\# Responsabilità



Il Context Engine deve:



\- individuare il cantiere corretto;

\- individuare la zona del cantiere;

\- individuare la fase dei lavori;

\- recuperare attività aperte;

\- recuperare materiali rilevanti;

\- recuperare documenti collegati;

\- recuperare foto collegate;

\- recuperare rapportini recenti;

\- recuperare eventuali problemi aperti;

\- costruire un contesto unico.



\---



\# Non deve



Il Context Engine NON deve:



\- salvare dati;

\- modificare dati;

\- prendere decisioni finali;

\- aggiornare il database;

\- chiamare direttamente Supabase per scrivere informazioni.



\---



\# Input



Può ricevere dati da:



\- Smart Report Assistant

\- Report Parser

\- Document Intelligence Engine

\- Fascicle Engine

\- Timeline Engine

\- Memory Engine

\- UI corrente



\---



\# Output



Restituisce un oggetto Context.



Esempio:



```ts

CurrentContext {



&#x20; cantiere



&#x20; cliente



&#x20; fascicolo



&#x20; zona



&#x20; faseLavoro



&#x20; attivitaAperte



&#x20; materiali



&#x20; operai



&#x20; documenti



&#x20; foto



&#x20; problemi



&#x20; confidence



&#x20; needsConfirmation



}

```



\---



\# Livelli di affidabilità



Ogni informazione deve avere uno stato.



CONFIRMED



Informazione confermata.



PROPOSED



Proposta dal sistema.



INFERRED



Dedotta dal contesto.



UNKNOWN



Informazione non disponibile.



\---



\# Pipeline



Utente



↓



Context Engine



↓



Report Parser



↓



Decision Engine



↓



Review Panel



↓



Conferma Utente



↓



Database



\---



\# Obiettivo della Versione 1



La V1 dovrà solamente:



\- ricevere un testo;

\- recuperare il cantiere più probabile;

\- recuperare il fascicolo corretto;

\- recuperare attività aperte;

\- recuperare materiali;

\- recuperare operai;

\- restituire il Context.



Nessuna modifica al database.



\---



\# Visione futura



In futuro il Context Engine dovrà essere in grado di comprendere automaticamente frasi come:



"Domani finiamo il bagno."



"Ordina altre piastrelle."



"Il cliente vuole il gres."



"Manca il silicone."



senza chiedere continuamente informazioni già presenti nel Fascicolo.



Il Context Engine diventerà il cervello operativo di ARTECNA OS.

