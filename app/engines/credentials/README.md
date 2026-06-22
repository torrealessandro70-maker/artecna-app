# Credentials Engine

Foundation architetturale del Credentials Engine di ARTECNA OS.

Il modulo definisce il punto di accesso centralizzato alle credenziali dei
servizi esterni. In questa fase espone soltanto contratti tipizzati e funzioni
placeholder: non salva, non legge e non revoca credenziali reali.

## Principi

- nessun token viene salvato in chiaro;
- access token e refresh token non devono mai comparire nei log;
- ogni refresh token dovra essere protetto a riposo;
- gli altri Engine non leggono token direttamente da database, ENV o storage;
- ogni accesso futuro passa dal Credentials Engine;
- nessuna credenziale viene esposta alla UI.

## Provider iniziali

- `google`
- `microsoft`
- `dropbox`
- `pec`
- `internal`

## Stato attuale

`saveCredential`, `readCredential` e `revokeCredential` restituiscono sempre
un errore controllato per indicare che la persistenza sicura non e collegata.

## Evoluzioni future

Sono previsti supporto Supabase con Row Level Security (RLS) e cifratura
server-side. Queste capacita richiederanno una specifica dedicata, una gestione
sicura delle chiavi e verifiche esplicite di autorizzazione.
