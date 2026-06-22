# ARTECNA OS — Photo Storage Architecture

## 1. Missione

Il Photo Storage Adapter gestisce dove vengono salvate le foto e come ARTECNA
OS le recupera. Offre agli altri moduli un contratto unico, indipendente dal
provider fisico, per caricare originali, ottenere anteprime e risolvere il file
solo quando serve.

L'adapter separa in modo esplicito file, metadati e stato di sincronizzazione.
Non assegna significato operativo alle foto: collegamenti a cantieri,
fascicoli e documenti restano espressi nei metadati.

## 2. Problema attuale

Nel sistema attuale convivono modelli incompatibili:

- immagini Base64 salvate direttamente nel database;
- URL di Storage salvati nel campo ambiguo `immagine_base64`;
- query pesanti che trasferiscono immagini originali insieme ai metadati;
- timeout durante il caricamento di gallerie numerose;
- foto dei rapportini non sempre risolte in modo coerente;
- assenza di un modello unico per cloud, locale e storage aziendale;
- crescita non sostenibile delle dimensioni del database.

Questa convivenza impedisce di distinguere con certezza un file, un URL, un
path e una rappresentazione Base64.

## 3. Principio fondamentale

```text
Database = metadati
Storage = file
Thumbnail = anteprime leggere
```

Le foto originali non devono essere archiviate nel database. Il database
conserva riferimenti, relazioni, descrizioni e stato. Le gallerie usano
thumbnail ottimizzate; il file originale viene risolto e scaricato soltanto su
richiesta dell'utente o di un processo autorizzato.

## 4. Modalità supportate future

Il campo `storage_provider` identifica la strategia attiva:

- `cloud`
- `hybrid`
- `local_sync`
- `nas`

Tutte le modalità devono rispettare lo stesso contratto `PhotoRecord` e non
devono costringere la UI a conoscere il provider sottostante.

## 5. Modalità cloud

Modalità predefinita per gli utenti normali. Foto originali e thumbnail sono
salvate su Supabase Storage o su uno storage cloud compatibile.

Deve funzionare subito senza configurazioni infrastrutturali aggiuntive per
l'utente. Il database conserva esclusivamente metadati, path e URL risolvibili
secondo le policy di accesso.

## 6. Modalità hybrid

Le thumbnail sono disponibili sul cloud per garantire gallerie rapide anche
da mobile. Gli originali risiedono su NAS, PC o server aziendale, mentre i
metadati rimangono su Supabase.

Questa modalità è adatta alle aziende con archivi fotografici estesi e riduce
spazio e traffico cloud senza perdere consultazione e ricerca centralizzate.

## 7. Modalità local_sync

Un futuro ARTECNA Sync Agent viene installato sul PC dell'ufficio. L'agent:

- riceve o sincronizza le foto autorizzate;
- salva gli originali in cartelle locali configurate;
- mantiene la relazione con il relativo `PhotoRecord`;
- aggiorna lo stato di sincronizzazione;
- gestisce retry e conflitti senza inserire file nel database.

La disponibilità locale non deve essere confusa con l'avvenuto backup.

## 8. Modalità NAS

Gli originali sono conservati nello storage aziendale. La configurazione deve
essere guidata e verificare raggiungibilità, autorizzazioni e path prima di
abilitare il provider.

Sono previsti in futuro adapter WebDAV, SFTP o API proprietarie. Credenziali e
token non appartengono al Photo Storage Adapter e dovranno essere ottenuti
tramite il Credentials Engine.

## 9. Modello dati futuro

```ts
type PhotoRecord = {
  id: string
  cantiere_id: string
  rapportino_id?: string
  sopralluogo_id?: string
  categoria: string
  nota?: string
  data_foto: string
  thumbnail_url: string
  file_url?: string
  file_path?: string
  original_path?: string
  storage_provider: 'cloud' | 'hybrid' | 'local_sync' | 'nas'
  sync_status: string
  created_at: string
}
```

Il modello rappresenta un contratto architetturale, non una richiesta di
creazione o modifica dello schema attuale. Identificatori aggiuntivi potranno
collegare in futuro la foto a SAL o documenti senza duplicare il file.

## 10. Regole

- Mai salvare Base64 nel database.
- Mai caricare 80 foto originali in una singola query.
- Usare thumbnail per gallerie, elenchi e anteprime.
- Caricare gli originali solo su richiesta.
- Ogni foto deve appartenere a un fascicolo o a un cantiere.
- Ogni foto deve poter essere collegata a rapportino, sopralluogo, SAL o
  documento.
- Non usare un campo ambiguo per contenere alternativamente Base64, URL e path.
- La UI deve consumare il contratto dell'adapter e non costruire direttamente
  URL specifici del provider.
- Upload completato, metadati registrati e sincronizzazione sono stati
  distinti e osservabili.
- L'accesso a thumbnail e originali deve rispettare autorizzazioni e policy del
  relativo fascicolo/cantiere.

## 11. Roadmap

### V1

- Continuare con Supabase Storage come provider predefinito.
- Salvare URL e path in campi corretti e non ambigui.
- Eliminare gradualmente l'uso di `immagine_base64` come contenitore misto.
- Introdurre il contratto del Photo Storage Adapter davanti agli upload nuovi.

### V2

- Generare thumbnail ottimizzate.
- Introdurre lazy loading e paginazione.
- Rendere la galleria veloce senza scaricare gli originali.

### V3

- Realizzare ARTECNA Sync Agent.
- Aggiungere adapter per NAS e storage locale.
- Gestire stato sync, retry, disponibilità e conflitti.

### V4

- Migrare progressivamente le vecchie foto Base64 verso Storage.
- Verificare integrità e collegamenti prima di rimuovere i payload legacy.
- Monitorare completamento, errori e possibilità di rollback della migrazione.
