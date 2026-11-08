# Installer 008 R2: baseline reale e capability transazionali

Parent locale: `3440bc9fc2c3237bfac9661c376910c63e7d16d4`.
La 008 non è applicata in Production. Questo step non autorizza installazione,
push, deploy, cambio owner/ACL Production o modifica permanente di ruoli.

## Baseline autorevole

`production-rpc-baseline.json` conserva la definizione della RPC estratta dal
catalogo Production e confermata dal precheck READ ONLY dell'8 novembre.
La fixture la reimporta senza riscriverne il corpo e confronta signature,
risultato, owner, SECURITY DEFINER, proconfig/search_path, ACL EXECUTE con
grantor, prosrc byte per byte e MD5, volatility, strict, parallel e language.
Il source MD5 è `dbde1dd45b9a9d65830e102993e6701e`.

Il diagnostico salvato ha SHA256
`dd7b7acd6fbb871afa43129be6f9b6b6d4de88eeba6a94fbffbed7cd95586ca5`.
Il confronto di tutte le righe del vecchio composite isola **esattamente quattro
differenze**, riportate integralmente in `baseline-fingerprint-proof.json`.
La RPC non è una delle quattro. I due MD5 originali sono ricalcolati anche dai
byte delle rispettive liste di componenti, ordinati con confronto UTF-8/C:
fixture `12b28fb77ee583a0ea1d7f75b0fdaf43`, Production
`b67736342261e82da2567d330d502eec`.

| Componente | Vecchia fixture | Production | Nuova canonicalizzazione | Effetto |
|---|---|---|---|---|
| RPC source | MD5 `dbde1dd45b9a9d65830e102993e6701e` | Stesso MD5 e stessi byte prosrc | MD5 nel composite; confronto separato dell'intero source e MD5 prima del composite | Nessuna causa del mismatch |
| RPC owner | `artecna_cantieri_delete_rpc` | Identico | Assert separato dell'identità, conservazione OID/owner | Owner non faceva parte del vecchio composite |
| SECURITY DEFINER | true | true | Assert separato, oltre al composite | Identico |
| RPC ACL | EXECUTE owner tecnico e authenticated, non grantable | Identica | `aclexplode`, nomi ordinati COLLATE C; grantor e grantable inclusi nell'assert separato | ACL non faceva parte del vecchio composite |
| RPC config/search_path | `search_path=pg_catalog, pg_temp` | Identico | proconfig esatto nell'assert separato e nel composite | Nessun delta |
| Columns | Tutte le righe `c:` | Tutte identiche | Nome, tipo/typmod e NOT NULL; prefisso schema letterale | Nessun delta |
| CHECK `rapportino_materiali_descrizione_ck` | `A AND B AND C` | `A AND (B AND C)` | `pg_get_constraintdef(oid,true)` rende la stessa forma pretty | Primo delta di serializzazione del vecchio composite |
| CHECK `rapportino_materiali_um_ck` | `A AND B AND C` | `A AND (B AND C)` | Stesso deparser pretty | Secondo delta di serializzazione |
| CHECK `rapportino_prestazioni_chiave_client_check` | `A AND B AND C` | `(A AND B) AND C` | Stesso deparser pretty | Terzo delta di serializzazione |
| Altri constraints | Tutte le restanti righe `f:` | Identiche | Tipo f/p/u/c, convalidated e deparser pretty | Nessun altro delta |
| Helper `public.uuid_generate_v4()` | Wrapper sintetico, prosrc MD5 `9afd3956f15577e0212d26d2902256bd`, secdef false, config vuota | Nessuna riga corrispondente nel catalogo osservato | Solo prokind=f e funzioni non membri di estensione; il wrapper di compatibilità locale è marcato membro di estensione | Quarto delta: riga solo locale esclusa dal perimetro canonico |
| Altre helper functions | Tutte le restanti righe `p:` | Identiche | Firma, MD5 source, secdef, config; esclusione dipendenze deptype=e | Nessun altro delta |
| Trigger | Tutte le righe `t:` | Identiche | `pg_get_triggerdef(oid,true)`, enabled e MD5 source | Nessun delta osservato; stesso formato del classifier |
| Membership installer | Generatore storico: postgres SUPERUSER; nessuna membership postgres/ruolo richiesta | postgres NOSUPERUSER; un grant originale ADMIN=true, SET=false, INHERIT=false | Fuori dal composite; assert separato e snapshot completo delle righe pg_auth_members, OID inclusi | Differenza di capacità installer, non causa degli hash |
| Grantor | RPC: ruolo tecnico; fixture storica non riproduceva il grant membership originale | RPC: ruolo tecnico; membership: supabase_admin | ACL RPC per nomi, membership originale preservata; grant SET separato GRANTED BY postgres | Nessun effetto sul vecchio composite; fondamentale per rimuovere solo la capability introdotta |
| Ordinamento/serializzazione | `string_agg(x,'' ORDER BY x COLLATE "C")` seguito da MD5 | Stessa formula | Stesso sort C e concatenazione senza separatore; prefisso `starts_with(nspname,'artecna_')` invece di LIKE con underscore wildcard | Ordine non causa del mismatch; cambiano solo le quattro stringhe indicate e il formato pretty canonico |

Nei due CHECK dei materiali: A è l'uguaglianza del campo con btrim(campo),
B/C sono i limiti length 1..2000 per descrizione e 1..50 per unita_misura.
Nel CHECK prestazioni: A/B sono length(btrim(chiave_client)) >=1 / <=200,
C è chiave_client=btrim(chiave_client). Non cambia alcun predicato, limite,
colonna o validazione: cambia il raggruppamento dell'albero AND deparsato.
Il report JSON conserva le stringhe CHECK complete, incluse le parentesi.

L'impronta canonica derivata dalla fixture ricostruita e dal perimetro
certificato è `86db00e737a2053366f2dd257f22fb17`. La baseline della RPC è
verificata anche separatamente, con tutti i metadati sopra, prima di ogni grant.
Il confronto per componente è riproducibile con
`scripts/check-cantiere-baseline.cjs <stdout-diagnostica-readonly>`; il relativo
report distingue il corpo RPC dai componenti estranei/non canonici.

Il checker verifica anche che la SELECT canonica eseguita dal diagnostico
Production sia testualmente la stessa della migration R2. Il suo risultato
osservato è `86db00e737a2053366f2dd257f22fb17`, identico al calcolo locale:
non è un valore sostituito alla query né un hash restituito come costante.

## Prova CREATE sullo schema

PostgreSQL nativo **17.6**, isolato. Actor `postgres_fixture`, NOSUPERUSER,
schema public, funzione esistente di proprietà `artecna_cantieri_delete_rpc`,
owner tecnico senza CREATE. Membership originale con grantor `supabase_admin`,
ADMIN=true, SET=false, INHERIT=false; secondo grant temporaneo emesso dall'actor
con ADMIN=false, SET=true, INHERIT=false.

Dopo SET ROLE, CREATE OR REPLACE sulla funzione già esistente fallisce con
SQLSTATE **42501**, `permission denied for schema public`. Il solo SET non
è sufficiente. Aggiungendo CREATE temporaneo il replacement riesce. Revocando
solo le capability introdotte, ACL schema e membership ritornano esattamente
ai valori precedenti. Il caso M, condizionato a CREATE non necessario, non è
applicabile; è verificato il ramo N con ripristino completo.

## Strategia atomica

Un'unica transazione, con advisory lock installer:

1. Verifica prima l'identità completa della RPC reale, poi il catalogo canonico.
2. Esige una sola membership actor/ruolo, grantor supabase_admin, ADMIN=true,
   SET=false, INHERIT=false. Un secondo grantor inatteso blocca prima del grant.
3. Salva le righe originali di pg_auth_members (anche OID), nspacl grezza,
   owner schema, OID e identità RPC in una tabella temporanea ON COMMIT DROP.
4. Prepara helper/guardie e ricontrolla baseline e membership.
5. Crea un secondo grant **GRANTED BY postgres** con ADMIN=false, INHERIT=false,
   SET=true. Verifica il delta esatto e la conservazione delle righe originali.
6. Se necessario concede CREATE sul solo public al ruolo tecnico, senza grant
   option. Richiede all'actor autorità di delega e ACL iniziale ripristinabile.
7. SET ROLE tecnico e **CREATE OR REPLACE** della RPC esistente; RESET ROLE.
8. Verifica source nuova, metadati completi, owner/ACL originali e OID invariato.
9. Revoca il CREATE introdotto e soltanto la membership **GRANTED BY postgres**,
   con RESTRICT. Il grant originale di supabase_admin non viene revocato,
   aggiornato o sovrascritto.
10. Prima del COMMIT verifica uguaglianza esatta di membership, ACL e owner
    dello schema e identità finale della RPC. Ogni errore annulla tutto.

Nessun UPDATE diretto dei cataloghi, ALTER OWNER, SUPERUSER richiesto, INHERIT
permanente o SET permanente. Le capability non sono osservabili come privilegi
permanenti da altre transazioni dopo il commit.

CREATE OR REPLACE impone di mantenere il tipo di ritorno esistente. Restano
quindi i quattro OUT originali (`cantiere_id`, `eliminato`, `storage_nuovi`,
`conteggi`); i contatori aggiuntivi e il fingerprint restano strutturati in
`conteggi`. UI e comportamento funzionale non cambiano. La regola sui tipi e
sulla conservazione di owner/permessi è documentata anche da
[PostgreSQL 17](https://www.postgresql.org/docs/17/sql-createfunction.html).

## Precheck e bundle R2

Il nuovo runner punta esclusivamente a `01_precheck_readonly.sql`: BEGIN READ
ONLY, ON_ERROR_STOP, timeout, ROLLBACK. Non include alcun percorso per eseguire
008, grant, worker o RPC distruttive; non consuma one-shot. Usa psql -W,
porta 5432, verify-full e CA consolidata con slash compatibili libpq.

GREEN_APPLY_008 richiede 001–007 equivalenti, identità RPC esatta, 008 non
applicata, membership ADMIN originale esatta e capacità di introdurre/rimuovere
le due capability temporanee. Non richiede SET/INHERIT già attivi, CREATE
permanente del ruolo tecnico o SUPERUSER. La prova nativa del precheck usa il
vero catalogo locale prefix7, senza proiettare uno stato positivo fittizio.
Prefix8 equivalente restituisce STOP_ALREADY_EQUIVALENT_008.

Il generatore congela la migration dal nuovo commit e preserva il bundle R1
con un confronto SHA256 di tutti i suoi file, incluse le evidenze dei run.

## Test e quality gate

- 15 test funzionali hard-delete: tutti i domini A–S, UI/RPC compatibili,
  outbox esclusivo/shared, retry worker fake dopo commit, rollback completo.
- 18 test installer (33 con i funzionali): profilo reale NOSUPERUSER; SET
  negato senza capability; replacement/CREATE dimostrato; before=after;
  rollback dopo grant SET, CREATE schema, SET ROLE, CREATE OR REPLACE,
  RESET ROLE, revoke CREATE, revoke SET e prima del COMMIT, oltre all'errore
  durante il replacement; drift source/ACL/owner/membership e grantor
  inatteso bloccati. Seconda esecuzione fail-closed P2113 senza modifiche.
- 63 regressioni contabilità, legacy, worker/session/gate fake e UI.
- Precheck SQL effettivo validato con psql locale in READ ONLY su prefix7 e 8;
  intero Apply008.sql, postcheck e snapshot di 49 tabelle validati solo sul
  cluster locale come postgres NOSUPERUSER. Confronto BEFORE/AFTER di dati,
  membership completa, ACL/owner schema e metadati RPC invariati.
- TypeScript, lint del perimetro, build completa offline (26 pagine), scan
  client (51 chunk) e diff whitespace verificati.

Le fixture funzionali usano un amministratore locale per costruire i dati di
dominio; la suite installer e il generatore del gate installano la 008 come
postgres NOSUPERUSER con grantor distinti e senza elevazione dell'actor.

Log locali: `.run/hard-delete-r2-final-tests.log`,
`.run/hard-delete-r2-regression.log`, `.run/hard-delete-r2-tsc.log`,
`.run/hard-delete-r2-lint.log`, `.run/hard-delete-r2-build.log`.
Nessuna 008, grant, mutation applicativa, push o deploy Production in questo step.
