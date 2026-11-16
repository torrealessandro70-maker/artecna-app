\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $precheck$
BEGIN
  IF (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
      IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN
    RAISE EXCEPTION 'Baseline Hard Delete V3 divergente';
  END IF;
  IF (SELECT atttypid FROM pg_attribute WHERE attrelid='public.cantieri'::regclass
      AND attname='lavori_conclusi' AND NOT attisdropped) IS DISTINCT FROM 'boolean'::regtype::oid
    OR EXISTS (SELECT FROM pg_attribute WHERE attrelid='public.cantieri'::regclass AND NOT attisdropped
        AND attname IN ('destinazione_amministrativa','fase_lavori'))
    OR to_regprocedure('public.salva_classificazione_cantiere(uuid,text,text,boolean,text,text,boolean)') IS NOT NULL
    OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
    OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
  THEN RAISE EXCEPTION 'Schema classificazione inatteso'; END IF;
END
$precheck$;
ROLLBACK;
\qecho ARTECNA_CLASSIFICAZIONE_PRECHECK_READONLY_GREEN
