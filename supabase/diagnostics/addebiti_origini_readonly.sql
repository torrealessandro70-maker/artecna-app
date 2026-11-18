\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
\pset tuples_only on
\pset format unaligned
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
SELECT current_database()='postgres' AND current_user='postgres' AND session_user='postgres'
 AND current_setting('server_version_num')='170006'
 AND current_setting('default_transaction_read_only')='on'
 AND current_setting('transaction_read_only')='on'
 AND current_setting('transaction_isolation')='repeatable read'
 AND EXISTS(SELECT FROM public.cantieri WHERE id=:'cantiere_id'::uuid)
 AND EXISTS(SELECT FROM public.fatture_fornitori WHERE id=:'fattura_id'::uuid)
 AND EXISTS(SELECT FROM auth.users WHERE id=:'utente_id'::uuid) AS ok
\gset contesto_
\if :contesto_ok
\else
\qecho STOP=contesto_assente_o_incompatibile
ROLLBACK;
\quit
\endif
SELECT set_config('request.jwt.claim.sub',:'utente_id'::uuid::text,true) AS sub,
 set_config('request.jwt.claims',jsonb_build_object('sub',:'utente_id'::uuid,'role','authenticated')::text,true) AS claims
\gset identita_
SELECT artecna_guardie.utente_puo_operare_impresa(:'utente_id'::uuid)
 AND artecna_guardie.utente_puo_modificare_cantiere(:'utente_id'::uuid,:'cantiere_id'::uuid) AS ok
\gset permessi_
\if :permessi_ok
\else
\qecho STOP=identita_applicativa_non_autorizzata
ROLLBACK;
\quit
\endif
-- La scelta avviene esclusivamente per UUID espliciti. Nessuna ricerca per nome/importo.
SELECT jsonb_build_object('fase','contesto','identita_applicativa_autorizzata',true,
 'utente_simulato_da_amministratore',true,'sessione_browser_non_certificata',true,
 'fattura_TD04',artecna_guardie.nc_tipo(:'fattura_id'::uuid)='TD04',
 'rpc_nuovo_addebito_installata',to_regprocedure('public.leggi_quote_addebito_cliente(uuid)') IS NOT NULL,
 'costi_storici_del_cantiere_senza_riga_uuid',(SELECT count(*) FROM public.materiali_cantiere
 WHERE cantiere_id=:'cantiere_id'::uuid AND fattura_riga_id IS NULL),
 'storici_non_associabili_a_questa_fattura_senza_ulteriore_prova',true);
WITH righe AS (
 SELECT r.*,row_number() OVER(ORDER BY r.numero_riga NULLS LAST,r.id) posizione
 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=:'fattura_id'::uuid
), quote AS (
 SELECT r.*,
 (SELECT count(*) FROM public.materiali_cantiere m WHERE m.fattura_riga_id=r.id AND m.cantiere_id=:'cantiere_id'::uuid) dirette,
 (SELECT count(*) FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id
 WHERE e.fattura_riga_id=r.id AND c.cantiere_id=:'cantiere_id'::uuid) economia,
 (SELECT count(*) FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id
 WHERE e.fattura_riga_id=r.id AND c.cantiere_id=:'cantiere_id'::uuid AND EXISTS(
 SELECT FROM public.variante_sorgenti s WHERE s.economia_raccolta_id=c.id AND s.tipo='raccolta_economia')) raccolte_gia_collegate,
 artecna_guardie.materiali_fattura_totale(r.id) assegnata FROM righe r
)
SELECT jsonb_build_object('riga','R'||posizione,'origine',CASE
 WHEN dirette>0 AND economia>0 THEN 'mista_cantiere_economia'
 WHEN dirette>0 THEN 'cantiere' WHEN economia>0 THEN 'economia'
 WHEN cantiere_id=:'cantiere_id'::uuid THEN 'riferimento_cantiere_senza_quota_uuid'
 WHEN nullif(btrim(cantiere),'') IS NOT NULL THEN 'riferimento_testuale_non_usato_come_associazione'
 ELSE 'nessuna_quota_per_cantiere_selezionato' END,
 'quote_cantiere',dirette,'quote_economia',economia,'quote_economia_con_raccolta_gia_in_variante',raccolte_gia_collegate,
 'quantita_originale_valida',quantita IS NOT NULL AND quantita>0 AND quantita<1e12 AND quantita=round(quantita,6),
 'quantita_assegnata_coerente',assegnata IS NOT NULL AND assegnata>=0 AND assegnata<=quantita,
 'assegnazione_completa',assegnata=quantita,'assegnazione_parziale',assegnata>0 AND assegnata<quantita)
FROM quote ORDER BY posizione;
-- Verifica anche il reader usato dall'app con privilegi API, senza chiamare writer.
SELECT pg_has_role(current_user,'authenticated','SET')
 AND has_function_privilege('authenticated','public.leggi_assegnazioni_materiali_fattura(uuid,uuid)','EXECUTE') AS disponibile
\gset api_
\if :api_disponibile
SET LOCAL ROLE authenticated;
SELECT public.leggi_assegnazioni_materiali_fattura(:'fattura_id'::uuid,:'cantiere_id'::uuid) AS risposta
\gset lettura_
SELECT jsonb_build_object('fase','lettura_api','rpc_assegnazioni_completata',true,
 'righe_rpc',jsonb_array_length(:'lettura_risposta'::jsonb),
 'quote_cantiere_visibili',(SELECT count(*) FROM jsonb_array_elements(:'lettura_risposta'::jsonb) r
 CROSS JOIN LATERAL jsonb_array_elements(r->'assegnazioni') a
 WHERE a->>'cantiere_id'=:'cantiere_id' AND a->>'destinazione'='cantiere'),
 'quote_economia_visibili',(SELECT count(*) FROM jsonb_array_elements(:'lettura_risposta'::jsonb) r
 CROSS JOIN LATERAL jsonb_array_elements(r->'assegnazioni') a
 WHERE a->>'cantiere_id'=:'cantiere_id' AND a->>'destinazione'='economia'));
RESET ROLE;
\else
SELECT jsonb_build_object('fase','lettura_api','rpc_assegnazioni_completata',false,
 'motivo','contesto_authenticated_non_assumibile_o_rpc_non_autorizzata',
 'permessi_applicativi_non_certificati',true);
\endif
ROLLBACK;
\qecho ARTECNA_ADDEBITI_ORIGINI_READONLY_COMPLETATA
