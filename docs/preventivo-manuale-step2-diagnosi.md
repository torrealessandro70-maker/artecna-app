# Manuale Step 2 — blocco reale Memoria prezzi e fix locale

## Evidenza reale, candidato b6efc969

Prova con PostgreSQL nativo, Auth/PostgREST reali e Chromium reale, soltanto dati/account sintetici. I componenti RegistroPanel, PreventivoManualePanel e VariantePreventivoIntegrativoPanel sono montati in harness React; non è la shell Next completa. La funzione e il template Excel sono quelli del candidato.

6 controlli PASS: apertura Registro, ingresso Cantiere e ID precompilato, contrattuale vuoto, ricerca codice SIC24, aggiunta con origine/UM/prezzo, match descrizione. La settima verifica (Memoria ARTECNA/media) si ferma: zero risultati in UI nonostante le due righe sintetiche inserite nella fixture. GET /rest/v1/memoria_prezzi ha status 200; nessun errore JavaScript o console, nessuna AI o richiesta esterna.

Il catalogo Production acquisito esclusivamente READ ONLY conferma `memoria_prezzi.relrowsecurity=true` e zero policy. Sono presenti grant SELECT, ma non superano RLS: per authenticated la lettura diretta è default-deny. Nessuna funzione del catalogo catturato legge memoria_prezzi; il caller storico in page.tsx usa anch'esso la lettura diretta. È una restrizione preesistente, incompatibile con il nuovo percorso manuale che aveva riusato quel caricamento. Non è un problema di matching o Price Engine.

La suite è stata fermata sul difetto. Salvataggio, riapertura, Integrativo, Registro ed Excel non sono stati certificati con browser reale. Le precedenti prove simulate non vengono riclassificate come HTTP reale. Browser chiuso e stack fermato (ExitCode 0); sandbox temporanea arrestata. Scaricati solo log tecnici e screenshot sintetici, nessun file account/token/sessione.

## Correzione locale circoscritta

Nuova migrazione additiva `20261026_preventivo_memoria_prezzi_lettura.sql`, separata dall'Integrativo manuale e non applicata in Production.

`public.leggi_memoria_prezzi_preventivo(p_da integer DEFAULT 0,p_limite integer DEFAULT 500)` restituisce TABLE(id uuid,descrizione text,unita_misura text,prezzo_unitario numeric,fonte text,creato_il timestamptz).

Owner postgres (il principal creatore è verificato); STABLE SECURITY DEFINER con search_path pg_catalog,pg_temp. EXECUTE solo authenticated, revocato a PUBLIC/anon/service_role. Nessuna nuova tabella/colonna/policy, nessun grant diretto sulla Memoria, nessun cambio owner o privilegio temporaneo per questo reader.

Autorizzazione: riusa esattamente `artecna_guardie.utente_jwt_corrente()` e `utente_puo_operare_impresa(uuid)`. Quest'ultimo richiede utenti_impresa.attivo=true e ruolo=titolare. Non estende la lettura a tutti gli autenticati né la ricava da nomi Cantiere. Espone soltanto campi prezzo necessari; esclude note e riferimenti Cantiere/cliente. Paginazione stabile, massimo 500 righe per chiamata; prezzi positivi come richiesto dai riferimenti utilizzabili.

Un repository comune legge la RPC, valida la forma e pagina senza normalizzare o ricalcolare prezzi. I soli caller Manuale contrattuale e Manuale Integrativo lo usano. Un diniego 42501 produce avviso e lista Memoria vuota: prezzario e voce libera restano disponibili. Il percorso AI continua con il caricamento precedente; writer Step 5, conferma Integrativo, schema economico e Price Engine invariati.

## Verifiche locali

51/51 PASS: suite precedente più repository/SQL reader. PostgreSQL embedded riproduce la baseline default-deny, autorizza il titolare attivo, nega altro ruolo/anonimo/titolare disattivato, controlla limiti pagina, proiezione senza note/Cantiere e policy invariate. TypeScript GREEN e lint nuovi moduli GREEN. Non è una nuova certificazione browser/HTTP.

## Stato e prossima verifica

Il precheck strutturale acquisito per b6efc969 ha 63/63 controlli PASS, psql/validator/finale 0 e ROLLBACK confermato; l'esito funzionale complessivo rimane NON GREEN per il blocco Memoria. È conservata la fotografia di 166 funzioni, 11 relazioni e 22 policy.

La correzione introduce un secondo SQL e richiede un nuovo precheck e una nuova prova HTTP/browser. Non è stata preparata alcuna procedura applicativa. Nessun SQL modificativo Production, push, deploy, chiamata AI reale o modifica ENV/OpenAI.
