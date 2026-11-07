-- Patch locali con fingerprint delle guardie Production. Non installata.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='artecna_guardie.nc_immutabile()'::regprocedure) IS DISTINCT FROM '8db4dd0830754f586be0ef4488568c8d' THEN RAISE EXCEPTION 'Baseline nc_immutabile divergente'; END IF; END $$;
CREATE OR REPLACE FUNCTION artecna_guardie.nc_immutabile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND current_user='postgres' THEN
  IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='fornitori_rettifiche' AND artecna_distruzione.td04_detach_consentito(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 END IF; RAISE EXCEPTION 'Registro rettifiche immutabile' USING ERRCODE='55000'; END $function$
;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='artecna_guardie.nc_proteggi_documenti()'::regprocedure) IS DISTINCT FROM '83bce3fbfc682d6ffc09271297d8383a' THEN RAISE EXCEPTION 'Baseline nc_proteggi_documenti divergente'; END IF; END $$;
CREATE OR REPLACE FUNCTION artecna_guardie.nc_proteggi_documenti()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE j jsonb:=to_jsonb(NEW); prima jsonb:=to_jsonb(OLD);
BEGIN
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='fatture_fornitori_righe' AND artecna_distruzione.documento_detach_consentito(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 END IF;
  IF TG_TABLE_NAME='fatture_fornitori_righe' THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Righe fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.fatture_fornitori WHERE id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid) ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid)
      OR origine_id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid))
      AND (TG_OP<>'UPDATE' OR (j-'stato') IS DISTINCT FROM (prima-'stato')) THEN
      RAISE EXCEPTION 'Documento con rettifiche: inventario delle righe protetto' USING ERRCODE='55000';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF artecna_guardie.nc_tipo((j->>'fattura_id')::uuid)='TD04' AND
    (TG_OP='INSERT' OR (j->'categoria_economica',j->'cantiere',j->'cantiere_id') IS DISTINCT FROM (prima->'categoria_economica',prima->'cantiere',prima->'cantiere_id'))
    AND (nullif(j->>'categoria_economica','') IS NOT NULL OR nullif(j->>'cantiere','') IS NOT NULL OR j->>'cantiere_id' IS NOT NULL) THEN
    RAISE EXCEPTION 'TD04: classificazione e destinazione solo tramite rettifica' USING ERRCODE='22023';
  END IF;
  END IF;
  IF TG_OP='UPDATE' AND ((TG_TABLE_NAME='fatture_fornitori' AND EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_id=OLD.id OR origine_id=OLD.id)
    AND (j-'stato'-'note') IS DISTINCT FROM (prima-'stato'-'note')) OR
    (TG_TABLE_NAME='fatture_fornitori_righe' AND EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_riga_id=OLD.id OR origine_riga_id=OLD.id)
    AND (j-'stato') IS DISTINCT FROM (prima-'stato'))) THEN
    RAISE EXCEPTION 'Documento con rettifiche: dati originali protetti' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $function$
;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='artecna_guardie.materiali_fattura_guardia()'::regprocedure) IS DISTINCT FROM 'e6dedfd9ff97162af0d81c092e0d6ffc' THEN RAISE EXCEPTION 'Baseline materiali_fattura_guardia divergente'; END IF; END $$;
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_guardia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF TG_OP='DELETE' AND current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN
  IF OLD.cantiere_id=artecna_distruzione.target_prerequisiti() AND EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare WHERE source_table='public.materiali_cantiere' AND source_id=OLD.id AND cantiere_id=OLD.cantiere_id) THEN RETURN OLD; END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.fattura_riga_id IS NOT NULL THEN RETURN NULL; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.fattura_riga_id IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assegnazione fattura immutabile'; END IF;
 IF NEW.fattura_riga_id IS NOT NULL AND current_user<>'artecna_materiali_fattura_rpc' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Usare il writer materiali fattura'; END IF;
 RETURN NEW;
END $function$
;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='artecna_guardie.materiali_fattura_totale(uuid)'::regprocedure) IS DISTINCT FROM '039d438a92abd69533c5a97bd909baa2' THEN RAISE EXCEPTION 'Baseline materiali_fattura_totale divergente'; END IF; END $$;
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_totale(p_riga uuid)
 RETURNS numeric
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 SELECT coalesce((SELECT sum(e.quantita) FROM public.economia_righe e WHERE e.fattura_riga_id=p_riga),0)
      + coalesce((SELECT sum(m.quantita) FROM public.materiali_cantiere m WHERE m.fattura_riga_id=p_riga),0)
      + coalesce((SELECT sum(i.quantita) FROM public.materiali_impresa i WHERE i.fattura_riga_id=p_riga),0)
 + coalesce((SELECT sum(a.quantita) FROM artecna_contabilita.archivio_quote a WHERE a.fattura_riga_id=p_riga
  AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare b WHERE b.archivio_id=a.id)),0)
$function$
;
DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='artecna_distruzione.manifest_cantiere(uuid)'::regprocedure) IS DISTINCT FROM 'af0d75bb7643c4db6fcfe8c49de00985' THEN RAISE EXCEPTION 'Baseline manifest_cantiere divergente'; END IF; END $$;
CREATE OR REPLACE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid)
 RETURNS TABLE(entita text, quantita bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) AND artecna_distruzione.target_prerequisiti() IS DISTINCT FROM p_cantiere THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    RETURN QUERY
    SELECT q.entita,q.quantita FROM (
SELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_raccolte'::text,count(*)::bigint FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_sorgenti'::text,count(*)::bigint FROM public.economia_sorgenti e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_righe'::text,count(*)::bigint FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'variante_fonti_memory'::text,count(*)::bigint FROM public.variante_fonti_memory f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_fonti_visive'::text,count(*)::bigint FROM public.variante_fonti_visive f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_osservatore_analisi'::text,count(*)::bigint FROM public.variante_osservatore_analisi f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
    ) AS q(entita,quantita) ORDER BY q.entita;
  RETURN QUERY SELECT 'memoria_prezzi'::text,count(*)::bigint FROM public.memoria_prezzi WHERE cantiere_id=p_cantiere;
 END;
$function$
;
GRANT SELECT ON artecna_distruzione.quote_da_eliminare TO artecna_cantieri_delete_rpc;
GRANT EXECUTE ON FUNCTION artecna_distruzione.target_prerequisiti() TO artecna_cantieri_delete_rpc;
COMMIT;
