\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
\pset tuples_only on
\pset format unaligned
SET SESSION default_transaction_read_only = on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';

SELECT current_database()='postgres' AND current_user='postgres' AND session_user='postgres'
 AND current_setting('server_version_num')='170006'
 AND current_setting('transaction_read_only')='on'
 AND current_setting('transaction_isolation')='repeatable read'
 AND EXISTS (SELECT FROM public.cantieri WHERE id=:'cantiere_id'::uuid)
 AND EXISTS (SELECT FROM auth.users WHERE id=:'utente_id'::uuid) AS ok
\gset contesto_
\if :contesto_ok
\else
\qecho STOP=contesto_non_verificato
ROLLBACK;
\quit
\endif

SELECT set_config('request.jwt.claim.sub',:'utente_id'::uuid::text,true) AS sub,
 set_config('request.jwt.claims',jsonb_build_object('sub',:'utente_id'::uuid,'role','authenticated')::text,true) AS claims
\gset identita_

SELECT jsonb_build_object(
 'fase','schema',
 'rpc_sal_presente',p.oid IS NOT NULL,
 'rpc_sal_owner_atteso',pg_get_userbyid(p.proowner)='artecna_sal_rpc',
 'rpc_sal_security_definer',p.prosecdef,
 'rpc_sal_search_path_atteso',p.proconfig=ARRAY['search_path=pg_catalog, pg_temp'],
 'rpc_sal_md5',md5(p.prosrc),
 'rpc_sal_execute_auth',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'rpc_sal_execute_anon',has_function_privilege('anon',p.oid,'EXECUTE'),
 'rls_cantieri',(SELECT relrowsecurity FROM pg_class WHERE oid='public.cantieri'::regclass),
 'update_cantieri_auth',has_table_privilege('authenticated','public.cantieri','UPDATE'),
 'update_voci_auth',has_table_privilege('authenticated','public.preventivo_lavorazioni','UPDATE'),
 'update_sal_auth',has_table_privilege('authenticated','public.sal_lavorazioni','UPDATE'),
 'rpc_residuo_md5',(SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure(
  'artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)')),
 'hard_delete_coerente',(SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
  IS NOT DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
) FROM (SELECT to_regprocedure('public.aggiorna_avanzamento_sal(bigint,numeric,boolean)') AS id) f
LEFT JOIN pg_proc p ON p.oid=f.id;

SELECT jsonb_build_object('fase','cantiere',
 'contratto_associato',c.preventivo_contrattuale_id IS NOT NULL,
 'documento_base_presente',p.id IS NOT NULL,
 'documento_base_stesso_cantiere',p.cantiere_id=c.id,
 'documento_base_integrativo',p.natura='integrativo',
 'lavori_conclusi',c.lavori_conclusi,
 'documenti_uuid',(SELECT count(*) FROM public.preventivi_cantiere d WHERE d.cantiere_id=c.id),
 'sal_totali',(SELECT count(*) FROM public.sal_lavorazioni s WHERE s.cantiere_id=c.id),
 'sal_maturati_o_completati',(SELECT count(*) FROM public.sal_lavorazioni s WHERE s.cantiere_id=c.id
   AND (s.importo_maturato IS DISTINCT FROM 0 OR s.percentuale IS DISTINCT FROM 0 OR s.completata IS TRUE)),
 'sal_da_base',(SELECT count(*) FROM public.sal_lavorazioni s WHERE s.cantiere_id=c.id
   AND s.source_lavorazione_id IS NOT NULL AND s.source_variante_lavorazione_id IS NULL),
 'sal_da_variante',(SELECT count(*) FROM public.sal_lavorazioni s WHERE s.cantiere_id=c.id
   AND s.source_lavorazione_id IS NULL AND s.source_variante_lavorazione_id IS NOT NULL),
 'sal_doppia_sorgente',(SELECT count(*) FROM public.sal_lavorazioni s WHERE s.cantiere_id=c.id
   AND s.source_lavorazione_id IS NOT NULL AND s.source_variante_lavorazione_id IS NOT NULL),
 'sal_base_collegamento_incoerente',(SELECT count(*) FROM public.sal_lavorazioni s
   LEFT JOIN public.preventivo_lavorazioni l ON l.id=s.source_lavorazione_id
   LEFT JOIN public.preventivi_cantiere d ON d.id=l.preventivo_id
   WHERE s.cantiere_id=c.id AND s.source_lavorazione_id IS NOT NULL
    AND (l.id IS NULL OR l.cantiere_id IS DISTINCT FROM c.id OR d.id IS NULL
      OR d.cantiere_id IS DISTINCT FROM c.id OR l.preventivo_id IS DISTINCT FROM c.preventivo_contrattuale_id)),
 'sal_variante_collegamento_incoerente',(SELECT count(*) FROM public.sal_lavorazioni s
   LEFT JOIN public.variante_lavorazioni l ON l.id=s.source_variante_lavorazione_id
   LEFT JOIN public.varianti_cantiere v ON v.id=l.variante_id
   WHERE s.cantiere_id=c.id AND s.source_variante_lavorazione_id IS NOT NULL
    AND (l.id IS NULL OR v.id IS NULL OR v.cantiere_id IS DISTINCT FROM c.id
      OR v.preventivo_contrattuale_id IS DISTINCT FROM c.preventivo_contrattuale_id
      OR v.stato IS DISTINCT FROM 'approvata')),
 'voci_collegate_a_documento_estraneo_o_assente',(SELECT count(*) FROM public.preventivo_lavorazioni l
   LEFT JOIN public.preventivi_cantiere d ON d.id=l.preventivo_id
   WHERE l.cantiere_id=c.id AND (d.id IS NULL OR d.cantiere_id IS DISTINCT FROM c.id)),
 'documenti_storici_solo_testo_da_verificare',(SELECT count(*) FROM public.preventivi_cantiere d
   WHERE d.cantiere_id IS NULL AND d.cantiere=c.nome),
 'sal_senza_sorgente',(SELECT count(*) FROM public.sal_lavorazioni s WHERE s.cantiere_id=c.id
   AND s.source_lavorazione_id IS NULL AND s.source_variante_lavorazione_id IS NULL),
 'varianti_approvate',(SELECT count(*) FROM public.varianti_cantiere v WHERE v.cantiere_id=c.id AND v.stato='approvata')
)
FROM public.cantieri c LEFT JOIN public.preventivi_cantiere p ON p.id=c.preventivo_contrattuale_id
WHERE c.id=:'cantiere_id'::uuid;

WITH docs AS (
 SELECT p.*,row_number() OVER (ORDER BY p.id) AS posizione
 FROM public.preventivi_cantiere p WHERE p.cantiere_id=:'cantiere_id'::uuid
 OR p.id=(SELECT preventivo_contrattuale_id FROM public.cantieri WHERE id=:'cantiere_id'::uuid)
)
SELECT jsonb_build_object('fase','documento','posizione',d.posizione,
 'designato',d.id=c.preventivo_contrattuale_id,
 'documento_stesso_cantiere',d.cantiere_id=c.id,
 'integrativo',d.natura='integrativo',
 'pdf_archiviato',nullif(btrim(d.file_path),'') IS NOT NULL,
 'voci_strutturate',(SELECT count(*) FROM public.preventivo_lavorazioni l WHERE l.preventivo_id=d.id AND l.cantiere_id=c.id),
 'voci_contesto_incoerente',(SELECT count(*) FROM public.preventivo_lavorazioni l WHERE l.preventivo_id=d.id AND l.cantiere_id IS DISTINCT FROM c.id),
 'voci_valori_non_verificabili',(SELECT count(*) FROM public.preventivo_lavorazioni l WHERE l.preventivo_id=d.id
   AND (l.quantita IS NULL OR l.prezzo_unitario IS NULL OR l.importo_previsto IS NULL
    OR l.quantita::text IN ('NaN','Infinity','-Infinity')
    OR l.prezzo_unitario::text IN ('NaN','Infinity','-Infinity')
    OR l.importo_previsto::text IN ('NaN','Infinity','-Infinity')
    OR l.quantita<=0 OR l.prezzo_unitario<0 OR l.importo_previsto<0
    OR l.importo_previsto<>round(l.importo_previsto,2)
    OR round(l.quantita*l.prezzo_unitario,2)<>l.importo_previsto)),
 'totale_documento_valido',d.importo_totale IS NOT NULL
  AND d.importo_totale::text NOT IN ('NaN','Infinity','-Infinity')
  AND d.importo_totale>0 AND d.importo_totale=round(d.importo_totale,2),
 'somma_voci_coincide_documento',(SELECT sum(l.importo_previsto) FROM public.preventivo_lavorazioni l
   WHERE l.preventivo_id=d.id AND l.cantiere_id=c.id)=d.importo_totale,
 'sal_da_documento',(SELECT count(*) FROM public.sal_lavorazioni s
   JOIN public.preventivo_lavorazioni l ON l.id=s.source_lavorazione_id
   WHERE l.preventivo_id=d.id AND s.cantiere_id=c.id)
)
FROM docs d JOIN public.cantieri c ON c.id=:'cantiere_id'::uuid ORDER BY d.posizione;

SELECT pg_has_role(current_user,'authenticated','SET') AS puo_assumere
\gset ruolo_
\if :ruolo_puo_assumere
SET LOCAL ROLE authenticated;
SELECT current_user='authenticated' AND auth.uid()=:'utente_id'::uuid
 AND current_setting('transaction_read_only')='on' AS ok
\gset app_
\if :app_ok
\else
\qecho STOP=identita_app_non_verificata
ROLLBACK;
\quit
\endif
SELECT jsonb_build_object('fase','visibilita_app',
 'cantiere_visibile',(SELECT count(*) FROM public.cantieri WHERE id=:'cantiere_id'::uuid),
 'documenti_visibili',(SELECT count(*) FROM public.preventivi_cantiere WHERE cantiere_id=:'cantiere_id'::uuid),
 'voci_visibili',(SELECT count(*) FROM public.preventivo_lavorazioni WHERE cantiere_id=:'cantiere_id'::uuid),
 'sal_visibili',(SELECT count(*) FROM public.sal_lavorazioni WHERE cantiere_id=:'cantiere_id'::uuid)
);
RESET ROLE;
\else
SELECT jsonb_build_object('fase','visibilita_app','esito','non_verificabile_ruolo_non_assumibile');
\endif
ROLLBACK;
\qecho ARTECNA_RIBASSO_DIAGNOSI_READONLY_COMPLETATA
