\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
\encoding UTF8
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, pg_temp;
SET LOCAL row_security = off;

SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls))
       AND EXISTS (SELECT FROM auth.users WHERE id = :'utente_id'::uuid) AS ok
\gset audit_
\if :audit_ok
\else
\qecho STOP=contesto_non_verificato
ROLLBACK;
\quit
\endif

-- Names select the five site records only. Documents are joined exclusively by IDs.
WITH wanted(code, name) AS (VALUES
 ('H1','TESTA GIANNI'), ('H2','TORRE ALESSANDRO'), ('H3','BELLUOMO MARIO'),
 ('H4','AVV. PERNICONE SUB 13'), ('V7','TESTA ANTONINO')
), matches AS (
 SELECT w.code, count(c.id) AS n,
        CASE WHEN count(c.id) = 1 THEN min(c.id::text) END AS id
 FROM wanted w LEFT JOIN public.cantieri c ON upper(btrim(c.nome)) = w.name
 GROUP BY w.code
)
SELECT jsonb_object_agg(code, jsonb_build_object('n', n, 'id', id))::text AS targets
FROM matches
\gset audit_

SELECT set_config('artecna.audit_targets', :'audit_targets', true) AS targets,
       set_config('request.jwt.claim.sub', :'utente_id'::uuid::text, true) AS sub,
       set_config('request.jwt.claims', jsonb_build_object('sub', :'utente_id'::uuid,'role','authenticated')::text, true) AS claims
\gset audit_
SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;
SELECT current_user = 'authenticated' AND auth.uid() = :'utente_id'::uuid
       AND current_setting('transaction_read_only') = 'on'
       AND current_setting('transaction_isolation') = 'repeatable read' AS ok
\gset audit_
\if :audit_ok
\else
\qecho STOP=identita_applicativa_non_verificata
ROLLBACK;
\quit
\endif

SELECT coalesce(jsonb_object_agg(t.key, jsonb_build_object('cantiere',c.id IS NOT NULL,'documento',p.id IS NOT NULL)), '{}')::text AS visibilita
FROM jsonb_each(current_setting('artecna.audit_targets')::jsonb) t
LEFT JOIN public.cantieri c ON c.id = (t.value->>'id')::uuid
LEFT JOIN public.preventivi_cantiere p ON p.id = c.preventivo_contrattuale_id
\gset audit_

-- Test the chain through the same read RPCs and role as the app.
WITH target AS (
 SELECT c.id, c.preventivo_contrattuale_id FROM public.cantieri c
 WHERE c.id = (current_setting('artecna.audit_targets')::jsonb#>>'{V7,id}')::uuid
), variant AS (
 SELECT v.*, t.preventivo_contrattuale_id AS contratto_atteso
 FROM target t CROSS JOIN LATERAL public.leggi_varianti_cantiere(t.id) v
 WHERE v.numero = 7
), source AS (
 SELECT v.id AS variante, v.cantiere_id, s.id AS sorgente, to_jsonb(d) AS dato
 FROM variant v CROSS JOIN LATERAL public.leggi_sorgenti_variante(v.id) s
 LEFT JOIN LATERAL public.leggi_sorgente_variante(s.id) d ON true
 WHERE s.tipo = 'raccolta_economia'
), collection AS (
 SELECT r.value AS dato
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(public.leggi_raccolte_economia(t.id)) r
 WHERE r.value->>'numero' = '7'
)
SELECT CASE
 WHEN (current_setting('artecna.audit_targets')::jsonb#>>'{V7,n}')::int = 0 THEN 'cantiere_non_trovato'
 WHEN (current_setting('artecna.audit_targets')::jsonb#>>'{V7,n}')::int > 1 THEN 'cantiere_ambiguo'
 WHEN NOT EXISTS (SELECT FROM target) THEN 'cantiere_non_visibile'
 WHEN (SELECT count(*) FROM variant) <> 1 THEN 'variante_assente_o_ambigua'
 WHEN NOT EXISTS (SELECT FROM variant v JOIN target t ON t.id = v.cantiere_id
                  JOIN public.preventivi_cantiere p ON p.id = v.contratto_atteso AND p.cantiere_id = t.id
                  WHERE v.stato = 'approvata' AND v.preventivo_contrattuale_id = v.contratto_atteso
                    AND p.natura IS DISTINCT FROM 'integrativo') THEN 'variante_o_contratto_incoerente'
 WHEN (SELECT count(*) FROM source) <> 1 THEN 'sorgente_assente_o_ambigua'
 WHEN (SELECT count(*) FROM collection) <> 1 THEN 'raccolta_assente_o_ambigua'
 WHEN NOT EXISTS (
   SELECT FROM source s CROSS JOIN collection r
   WHERE s.dato->>'id' = s.sorgente::text AND s.dato->>'variante_id' = s.variante::text
     AND s.dato->>'economia_raccolta_id' = r.dato->>'id'
     AND s.dato#>>'{snapshot,raccolta_id}' = r.dato->>'id'
     AND s.dato#>>'{snapshot,cantiere_id}' = s.cantiere_id::text
     AND r.dato->>'cantiere_id' = s.cantiere_id::text
     AND s.dato#>>'{snapshot,revisione_congelata}' = s.dato->>'economia_revisione_congelata'
     AND r.dato->>'revisione' = s.dato->>'economia_revisione_congelata'
 ) THEN 'identita_o_revisione_incoerente'
 ELSE 'verificata' END AS catena
\gset audit_

RESET ROLE;
SET LOCAL row_security = off;
\pset tuples_only on
\pset format unaligned
WITH records AS (
 SELECT t.key AS code, (t.value->>'n')::int AS candidati, c.id, c.preventivo_contrattuale_id AS riferimento,
        p.id AS documento, p.cantiere_id AS proprietario, p.natura, p.importo_totale,
        EXISTS (SELECT FROM public.preventivi_cantiere d
                WHERE d.cantiere_id = c.id AND d.natura IS DISTINCT FROM 'integrativo') AS altri
 FROM jsonb_each(current_setting('artecna.audit_targets')::jsonb) t
 LEFT JOIN public.cantieri c ON c.id = (t.value->>'id')::uuid
 LEFT JOIN public.preventivi_cantiere p ON p.id = c.preventivo_contrattuale_id
 WHERE t.key <> 'V7'
)
SELECT 'caso=' || code || ' causa=' || CASE
 WHEN candidati = 0 THEN 'nome_esatto_non_trovato'
 WHEN candidati > 1 THEN 'nome_esatto_ambiguo'
 WHEN riferimento IS NULL AND altri THEN 'documento_del_cantiere_non_designato'
 WHEN riferimento IS NULL THEN 'nessuna_base_associata'
 WHEN documento IS NULL THEN 'documento_assente'
 WHEN proprietario IS NULL THEN 'documento_senza_cantiere'
 WHEN proprietario <> id THEN 'documento_di_altro_cantiere'
 WHEN natura = 'integrativo' THEN 'documento_integrativo'
 WHEN importo_totale IS NULL OR importo_totale::text IN ('NaN','Infinity','-Infinity')
      OR abs(importo_totale * 100) >= 9007199254740991.5 THEN 'importo_non_valido'
 WHEN importo_totale <= 0 THEN 'importo_non_positivo_da_verificare'
 WHEN NOT ((:'audit_visibilita'::jsonb->code->>'documento')::boolean) THEN 'documento_non_visibile'
 ELSE 'base_valida_verificare_caricamento_app'
 END || ' cantiere_visibile=' || (:'audit_visibilita'::jsonb->code->>'cantiere')
     || ' documento_visibile=' || (:'audit_visibilita'::jsonb->code->>'documento')
FROM records ORDER BY code;
\qecho catena_v7=:audit_catena
ROLLBACK;
\qecho ARTECNA_CONTRATTI_STORICI_DIAGNOSI_TERMINATA
