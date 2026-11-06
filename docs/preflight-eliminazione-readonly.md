# Preflight informativo di eliminazione

Base: `4f147d38aef416e36c8bfe86c51f7a2239aee766`. Dal baseline diagnostico
`8f6933be9eb99f3a7e7912516256f0a68765d146` sono cambiati solo i cinque file
dell'import Excel: schema, eliminazioni e autorizzazioni versionati sono invariati.
Il modello autorizzativo Production è stato confermato dall'utente tramite
catalogo amministrativo. In questo step non si accede al DB Production.

## Contratto

- `public.preflight_eliminazione_sopralluogo(p_sopralluogo_id text) returns jsonb`
- `public.preflight_eliminazione_cantiere(p_cantiere_id uuid) returns jsonb`

Output: `versione: 1`, `entita`, `id`, `stato`, `verifica_completa`, `categorie`,
`azione_consigliata`, `verificato_at` (timestamp della singola istruzione).

| Esito | Completa | Azione |
|---|---|---|
| eliminabile | true | conferma_eliminazione |
| bloccato, Sopralluogo | true | nessuna |
| bloccato, Cantiere | true | segna_concluso |
| non_verificabile | false | nessuna |

Gli errori di autorizzazione restituiscono esclusivamente SQLSTATE `42501`,
`Accesso negato`, senza categorie. Identità assente e record non accessibile non
espongono dettagli. Gli errori nelle dipendenze restituiscono non_verificabile,
senza errori SQL e senza categorie parziali.

## Autorizzazione e visibilità

Le RPC sono STABLE, SECURITY DEFINER, owner postgres, search_path pg_catalog,
pg_temp e row_security off. EXECUTE è revocato a PUBLIC/anon e concesso soltanto
ad authenticated (oltre ai privilegi intrinseci del proprietario). L'helper
artecna_guardie.preflight_dipendenze è SECURITY INVOKER, privato al proprietario.

Prima di leggere dipendenze:

- Sopralluogo: auth.uid() non nullo e quaderno_target_accessibile. Questo riusa
  il modello condiviso corrente (SELECT authenticated, RLS disattivata), NON
  ownership per record. Cambiare quel modello richiede una nuova certificazione.
- Cantiere: utente_puo_modificare_cantiere(auth.uid(), id), senza duplicare la
  regola owner di utenti_cantiere.

Il proprietario postgres può leggere anche dipendenze invisibili al client. Non
vengono restituiti contenuti, identificativi di terzi, percorsi o conteggi di righe.

## Copertura e conservatività

L'inventario minimo verifica l'esistenza delle tabelle/colonne previste e delle
FK indirette obbligatorie. Legge tutti i riferimenti public.sopralluogo_id oppure
cantiere_id, più i nomi cantiere legacy (questi possono soltanto bloccare).
Percorre le FK entranti, comprese le composite e quelle verso schemi privati.
È un numero di letture per relazione/percorso di catalogo, non per record UI.
Non usa reader applicativi limitati dalle RLS né manifest distruttivi.

I figli di una dipendenza sono conservati anche se la FK è CASCADE. Sono coperti
foto → fonti Variante, note → allegati/copie, preventivi → Cantieri, Economia →
righe/sorgenti, Varianti → figli/fonti, Rapportini → prestazioni/materiali/allegati,
SAL → riferimenti FK, fatture → righe/rettifiche, oltre ai riferimenti diretti.
Le membership utenti_cantiere sono metadati autorizzativi e non rendono da sole
storico un Cantiere vuoto. I puntatori contrattuali del Cantiere bloccano già
come preventivi. Agenda è verificata mediante il collegamento JSON esplicito.

Categorie: sal, acconti, fatture, incassi, pagamenti, rettifiche, economia,
varianti, preventivi, rapportini, presenze, materiali, attrezzature, foto,
quaderno, allegati_quaderno, cantieri, agenda, altri_collegamenti.
Relazioni nuove raggiungibili sono bloccanti anche se non hanno una categoria
dedicata. Anche un importo preventivo non nullo/non zero sul Cantiere blocca
come Economia; un valore zero non sostituisce mai l'inventario delle dipendenze.
Tabella/colonna/FK attesa mancante, errore, accesso impossibile o
profondità di catalogo pari a 12 restituiscono non_verificabile.

Limite esplicito: nessuna introspezione può identificare nuove relazioni logiche
non dichiarate (per esempio nuovi ID dentro JSON senza FK). L'aggiunta di simili
modelli richiede aggiornare inventario e test; non si effettua fuzzy matching.
Non si ispezionano file Storage o dati solo browser.

## UI e concorrenza

Click Elimina → singola RPC di preflight → soltanto eliminabile apre la conferma
esistente. Doppio click concorrente ignorato. Gli altri esiti mostrano un dialogo
con categorie leggibili oppure un messaggio generico di verifica impossibile.
Segna come concluso apre la modifica Registro esistente con checkbox predisposta:
nessun salvataggio automatico. Nessuna falsa forzatura e nessuna archiviazione
server nuova per Sopralluoghi.

DELETE Sopralluogo e RPC distruttiva Cantiere restano invariati. Il preflight NON
è un'autorizzazione persistente e NON elimina la finestra di concorrenza prima
del DELETE: il ricontrollo atomico resta uno step futuro. Non genera token,
audit, sessioni, flag o scritture applicative.

## Verifica esclusivamente locale

`node supabase/validators/preflight-eliminazione/validator.cjs`

`node --test supabase/validators/preflight-eliminazione/preflight.test.cjs app/utils/preflightEliminazione.test.cjs`

I test SQL eseguono la migration su PostgreSQL PGlite effimero con fixture di
schema ridotte e guardie canoniche. Le chiamate avvengono con ruolo authenticated
in transazione BEGIN READ ONLY/ROLLBACK, confrontando tutti i dati prima/dopo.
La preparazione delle fixture è l'unica scrittura dei test; nessun dato reale.
Lo schema ridotto non sostituisce il precheck dell'intero catalogo Production
prima di un'eventuale futura applicazione della migration.

La migration non va applicata in Production in questo step. Prima di quella
pubblicazione sono necessari pre/post-check del catalogo effettivo e smoke
autorizzato. Se la UI viene usata senza RPC installate, blocca con non_verificabile.
