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

SELECT set_config('request.jwt.claim.sub', :'utente_id'::uuid::text, true) AS sub,
       set_config('request.jwt.claims', jsonb_build_object('sub', :'utente_id'::uuid, 'role','authenticated')::text, true) AS claims
\gset audit_

WITH wanted(code, nome) AS (VALUES ('H3','BELLUOMO MARIO'), ('H4','AVV. PERNICONE SUB 13')),
matches AS (
 SELECT w.code, count(c.id) AS n, CASE WHEN count(c.id) = 1 THEN min(c.id::text) END AS id
 FROM wanted w LEFT JOIN public.cantieri c ON upper(btrim(c.nome)) = w.nome GROUP BY w.code
)
SELECT jsonb_object_agg(code, jsonb_build_object('n', n, 'id', id))::text AS targets FROM matches
\gset audit_

-- Candidate identifiers remain inside psql variables. Codes D1..Dn are scoped to one run.
WITH sites AS (
 SELECT t.key AS code, c.* FROM jsonb_each(:'audit_targets'::jsonb) t
 JOIN public.cantieri c ON c.id = (t.value->>'id')::uuid
), docs AS (
 SELECT c.code, p.id, 'D' || row_number() OVER (PARTITION BY c.code ORDER BY p.id) AS label,
        p.natura, p.importo_totale, p.approvato, c.preventivo_contrattuale_id = p.id AS designato,
        EXISTS (
          SELECT FROM public.sal_lavorazioni s
          LEFT JOIN public.preventivo_lavorazioni b ON b.id = s.source_lavorazione_id
          LEFT JOIN public.variante_lavorazioni r ON r.id = s.source_variante_lavorazione_id
          LEFT JOIN public.varianti_cantiere v ON v.id = r.variante_id
          WHERE s.cantiere_id = c.id
           AND (s.source_lavorazione_id IS NOT NULL OR s.source_variante_lavorazione_id IS NOT NULL)
           AND (CASE
             WHEN s.source_lavorazione_id IS NOT NULL AND s.source_variante_lavorazione_id IS NULL
               THEN b.cantiere_id = c.id AND b.preventivo_id = p.id
             WHEN s.source_lavorazione_id IS NULL AND s.source_variante_lavorazione_id IS NOT NULL
               THEN v.cantiere_id = c.id AND v.preventivo_contrattuale_id = p.id AND v.stato = 'approvata'
             ELSE false END) IS NOT TRUE
        ) AS sal_incompatibile,
        EXISTS (SELECT FROM public.varianti_cantiere v
                WHERE v.cantiere_id = c.id AND v.stato = 'approvata'
                  AND v.preventivo_contrattuale_id IS DISTINCT FROM p.id) AS varianti_incompatibili,
        EXISTS (SELECT FROM public.sal_lavorazioni s WHERE s.cantiere_id = c.id
                AND s.source_lavorazione_id IS NULL AND s.source_variante_lavorazione_id IS NULL) AS sal_senza_sorgente
 FROM sites c JOIN public.preventivi_cantiere p ON p.cantiere_id = c.id
)
SELECT coalesce(jsonb_agg(jsonb_build_object('caso',code, 'id',id, 'doc',label,
 'natura',CASE WHEN natura = 'integrativo' THEN 'integrativo' WHEN natura IS NULL THEN 'non_registrata' ELSE 'non_integrativo' END,
 'importo',CASE WHEN importo_totale IS NULL THEN 'assente' WHEN importo_totale::text IN ('NaN','Infinity','-Infinity')
    OR abs(importo_totale * 100) >= 9007199254740991.5 THEN 'non_valido'
    WHEN importo_totale <= 0 THEN 'non_positivo' WHEN importo_totale <> round(importo_totale,2) THEN 'precisione_da_verificare'
    ELSE 'positivo_al_centesimo' END,
 'approvato',coalesce(approvato,false),'designato',coalesce(designato,false),
 'sal_incompatibile',sal_incompatibile,'varianti_incompatibili',varianti_incompatibili,
 'sal_senza_sorgente',sal_senza_sorgente)), '[]')::text AS docs FROM docs
\gset audit_

SELECT CASE
 WHEN :'h1_uuid' = '' THEN 'uuid_non_fornito'
 WHEN NOT EXISTS (SELECT FROM public.cantieri WHERE id = nullif(:'h1_uuid','')::uuid) THEN 'uuid_non_presente'
 WHEN EXISTS (SELECT FROM public.cantieri WHERE id = nullif(:'h1_uuid','')::uuid AND upper(btrim(nome)) = 'TESTA GIANNI')
   THEN 'uuid_nome_esatto'
 ELSE 'uuid_nome_registrato_diverso'
 END AS h1,
 (SELECT count(*) FROM public.cantieri WHERE upper(btrim(nome)) = 'TESTA GIANNI') AS nome_esatto,
 (SELECT count(*) FROM public.preventivi_cantiere WHERE upper(btrim(cantiere)) = 'TESTA GIANNI') AS riferimenti_testuali
\gset audit_

SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;
SELECT current_user = 'authenticated' AND auth.uid() = :'utente_id'::uuid
       AND current_setting('transaction_read_only') = 'on'
       AND current_setting('transaction_isolation') = 'repeatable read' AS ok,
       has_table_privilege(current_user,'public.preventivi_cantiere','SELECT') AS doc_read,
       has_table_privilege(current_user,'public.cantieri','SELECT') AS site_read
\gset audit_
\if :audit_ok
\else
\qecho STOP=identita_applicativa_non_verificata
ROLLBACK;
\quit
\endif

\pset tuples_only on
\pset format unaligned
SELECT 'caso=H1 esito=' || :'audit_h1' || ' nomi_esatti=' || :'audit_nome_esatto'
       || ' riferimenti_testuali=' || :'audit_riferimenti_testuali';
\if :audit_site_read
SELECT 'h1_visibilita=' || CASE WHEN :'h1_uuid' = '' THEN 'non_testata'
 WHEN EXISTS (SELECT FROM public.cantieri WHERE id = nullif(:'h1_uuid','')::uuid) THEN 'visibile'
 ELSE 'non_visibile' END;
\else
\qecho h1_visibilita=select_negata
\endif
SELECT 'caso=' || t.key || ' cantieri=' || (t.value->>'n')
       || ' candidati=' || count(d.value)
       || ' integrativi=' || count(d.value) FILTER (WHERE d.value->>'natura' = 'integrativo')
FROM jsonb_each(:'audit_targets'::jsonb) t
LEFT JOIN LATERAL jsonb_array_elements(:'audit_docs'::jsonb) d ON d.value->>'caso' = t.key
GROUP BY t.key, t.value ORDER BY t.key;

\if :audit_doc_read
SELECT coalesce(jsonb_object_agg((d.value->>'caso') || '/' || (d.value->>'doc'), p.id IS NOT NULL),'{}')::text AS visibili
FROM jsonb_array_elements(:'audit_docs'::jsonb) d LEFT JOIN public.preventivi_cantiere p ON p.id = (d.value->>'id')::uuid
\gset audit_
\else
\set audit_visibili '{}'
\endif
SELECT concat('candidato=',d->>'caso','/',d->>'doc',' natura=',d->>'natura',' importo=',d->>'importo',
 ' approvato=',d->>'approvato',' designato=',d->>'designato',
 ' lettura=',CASE WHEN NOT :'audit_doc_read'::boolean THEN 'select_negata'
 WHEN (:'audit_visibili'::jsonb->>(d->>'caso' || '/' || (d->>'doc')))::boolean THEN 'visibile' ELSE 'non_visibile' END,
 ' sal_incompatibile=',d->>'sal_incompatibile',' sal_senza_sorgente=',d->>'sal_senza_sorgente',
 ' varianti_incompatibili=',d->>'varianti_incompatibili')
FROM jsonb_array_elements(:'audit_docs'::jsonb) d ORDER BY d->>'caso', d->>'doc';
ROLLBACK;
\qecho ARTECNA_STORICI_MIRATA_TERMINATA
