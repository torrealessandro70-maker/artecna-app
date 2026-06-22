# Google Calendar OAuth Setup Plan

## Stato di questo documento

Questo file descrive una possibile integrazione futura con Google Calendar.
Non implementa OAuth, non crea route, non modifica variabili di ambiente, non
salva token e non crea eventi.

## Stack ARTECNA OS verificato

- Next.js `15.5.7` con App Router.
- React `19.1.0`.
- Route Handler server-side in `app/api/**/route.ts`.
- Risposte API costruite con `NextResponse` da `next/server`.
- Nessuna dipendenza Google OAuth o Google Calendar attualmente installata.
- Nessuna route `app/api/calendar` attualmente presente.

L'integrazione futura dovra seguire le convenzioni dei Route Handler esistenti
senza modificare il Login dell'applicazione.

## Configurazione Google Cloud futura

Prima dell'implementazione occorrera:

1. creare o selezionare un progetto Google Cloud;
2. abilitare Google Calendar API;
3. configurare la schermata di consenso OAuth;
4. creare credenziali OAuth di tipo Web application;
5. registrare gli URI di redirect autorizzati per sviluppo e produzione;
6. verificare i requisiti di pubblicazione e verifica richiesti da Google.

## Variabili di ambiente

Le variabili previste sono:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

Regole:

- devono essere disponibili soltanto sul server;
- non devono usare il prefisso `NEXT_PUBLIC_`;
- `GOOGLE_CLIENT_SECRET` non deve mai raggiungere bundle o log client;
- `GOOGLE_REDIRECT_URI` deve corrispondere esattamente a un URI autorizzato
  nella console Google;
- nessun valore viene aggiunto ai file ENV in questo step.

Esempio concettuale di redirect locale, da configurare solo in futuro:

```text
http://localhost:3000/api/calendar/google/callback
```

## Scope minimo

Lo scope previsto per creare e modificare gli eventi gestiti
dall'integrazione e:

```text
https://www.googleapis.com/auth/calendar.events
```

Non devono essere richiesti scope Calendar piu ampi senza una nuova esigenza
documentata.

## Route future previste

### Connect

```text
GET /api/calendar/google/connect
```

Responsabilita future:

- verificare che l'utente ARTECNA sia autenticato senza cambiare il Login;
- generare un valore `state` crittograficamente casuale;
- conservare `state` solo per la durata del flusso, in un cookie `HttpOnly`,
  `Secure` in produzione e `SameSite=Lax`, oppure in uno store server-side;
- costruire la URL di consenso con client ID, redirect URI e scope minimo;
- reindirizzare l'utente alla schermata di consenso Google.

### Callback

```text
GET /api/calendar/google/callback
```

Responsabilita future:

- gestire diniego ed errori restituiti da Google;
- validare `state` prima di elaborare il codice;
- scambiare il parametro `code` con i token esclusivamente server-side;
- associare l'autorizzazione all'utente ARTECNA gia autenticato;
- rimuovere lo stato temporaneo del flusso;
- non creare eventi durante il callback.

### Creazione evento

Una route separata, da specificare in uno step successivo, ricevera un
`CalendarEventDraft` validato e usera il token server-side per creare l'evento.
Questa route non viene creata in questo step.

## Flusso previsto

```text
connect
  -> consenso Google
  -> /api/calendar/google/callback
  -> validazione state
  -> scambio code/token server-side
  -> conservazione sicura del token
  -> futura richiesta esplicita di create event
```

Il passaggio `create event` appartiene a una fase successiva. Ottenere un token
non autorizza ARTECNA a creare automaticamente un evento.

## Sicurezza dei token

I token non devono essere:

- salvati in chiaro;
- inseriti in `localStorage` o `sessionStorage`;
- esposti in cookie leggibili da JavaScript;
- restituiti dalle API al browser;
- scritti nei log;
- inclusi in URL o messaggi di errore.

Prima dell'implementazione deve essere scelta una strategia server-side per la
protezione dei token, per esempio cifratura applicativa con chiave gestita da
un secret manager o KMS. Il refresh token, se rilasciato, deve essere cifrato a
riposo e associato in modo non ambiguo all'utente autorizzante. Questo step non
sceglie ne crea alcuna persistenza.

Devono inoltre essere pianificati revoca, disconnessione, rotazione delle
credenziali, scadenza dell'access token e gestione sicura del refresh.

## Gestione errori futura

Le route dovranno distinguere almeno:

- configurazione server mancante;
- `state` mancante o non valido;
- consenso negato;
- codice scaduto o gia usato;
- token revocato o scaduto;
- scope insufficiente;
- errore o indisponibilita delle API Google.

I messaggi client non dovranno contenere segreti o dettagli dei token.

## Riferimenti ufficiali da verificare prima dell'implementazione

- OAuth 2.0 per web server:
  https://developers.google.com/identity/protocols/oauth2/web-server
- Autorizzazione Google Calendar e scope:
  https://developers.google.com/workspace/calendar/api/auth
- Best practice OAuth 2.0:
  https://developers.google.com/identity/protocols/oauth2/resources/best-practices

Le pagine ufficiali devono essere ricontrollate nello step di implementazione,
perche requisiti di consenso, sicurezza e verifica possono cambiare.
