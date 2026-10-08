# F4D: adapter Storage Foto V1 locale

Adapter `StorageFotoV1` server-only, collegato a upload Mobile e download Desktop.
POST create-only con `x-upsert:false`; GET privato con lettura streaming limitata
a 4.000.000 byte, MIME coerente con estensione, timeout 20 secondi e redirect negati.
Create verifica JPEG/PNG/WebP reali e limite 24 MP. Non offre overwrite/delete/move,
URL pubblici, signed upload, creazione bucket o policy.

I servizi autorizzano prima ogni operazione e ricavano il path dal registro Allegati:
l'adapter aggiunge controlli bucket/path canonico ma non sostituisce membership,
lease o reciprocita. SHA-256 e peso sono verificati dai servizi F4A/F4C.2 dopo GET;
`exists` non certifica i byte. Risposte perse sono riconciliate dal servizio tramite
rilettura, senza overwrite, cleanup o retry automatico dell'adapter.

Requisito non soddisfatto localmente: `SUPABASE_SERVICE_ROLE_KEY`, chiave JWT
legacy service_role esclusivamente server-side; URL da `NEXT_PUBLIC_SUPABASE_URL`
gia esistente. Nessuna ENV aggiunta o modificata. Assente/invalida -> adapter assente,
route 503 dopo autorizzazione. Nessun fallback anon o credenziale inventata.
Le nuove chiavi `sb_secret_` non sono supportate da questa configurazione.
La lettura del claim role e un controllo di configurazione, non verifica della firma:
la chiave deve essere provisionata da un amministratore e autenticata da Storage.

Service-role bypassa RLS: la sicurezza di questa capability dipende dagli endpoint
autorizzati e dal confinement dell'adapter. Richiede un gate separato in manutenzione.
Nessuna credential/path viene restituita nei DTO o nei messaggi d'errore.

Test con fetch Storage simulato e decoder sharp reale; non certificano la Storage
API end-to-end. Nessuna richiesta remota, migration o operazione Production.
Prima dell'uso operativo servono autorizzazioni distinte per configurazione server,
bucket privato, migration/capability e test Storage API isolati.

Riferimenti: documentazione Supabase standard uploads e Storage error codes.
