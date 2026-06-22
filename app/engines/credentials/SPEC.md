# Credentials Engine Foundation

## Missione

Centralizzare la gestione futura di credenziali e token usati da ARTECNA OS
per comunicare con servizi esterni.

## Contratti

- `CredentialProvider`: identifica il servizio proprietario della credenziale.
- `CredentialScope`: descrive le capacita autorizzate.
- `CredentialStatus`: rappresenta lo stato della connessione.
- `ExternalCredential`: contiene soltanto metadati della connessione.
- `CredentialTokenSet`: rappresenta il materiale sensibile da proteggere.
- `CredentialSaveRequest`: descrive una futura richiesta di salvataggio.
- `CredentialReadResult`: risultato controllato di una lettura futura.

## Confini di questa fase

Il Credentials Engine non:

- salva token;
- legge token da storage;
- cifra o decifra dati;
- accede a Supabase o ad altri database;
- modifica ENV;
- crea API;
- scrive log contenenti credenziali;
- implementa refresh o revoca presso provider esterni.

## Regole di sicurezza future

Nessun token potra essere salvato in chiaro o scritto nei log. Il refresh token
dovra essere protetto con cifratura server-side e chiavi non memorizzate accanto
ai dati cifrati.

L'accesso alle credenziali dovra essere autorizzato per utente e provider. Una
possibile persistenza futura su Supabase dovra usare RLS e policy restrittive,
oltre alla cifratura server-side del materiale sensibile.

Gli altri Engine non potranno leggere token direttamente: dovranno usare il
contratto pubblico del Credentials Engine. La UI non ricevera token.

## Placeholder

Le funzioni pubbliche restituiscono esclusivamente:

```text
Credentials Engine non ancora collegato a persistenza sicura
```

Nessuna operazione viene eseguita.
