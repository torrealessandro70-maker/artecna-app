\set ON_ERROR_STOP on
DO $$
BEGIN
 IF EXISTS (SELECT FROM public.cantieri WHERE destinazione_amministrativa IS NOT NULL OR fase_lavori IS NOT NULL)
 OR (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM artecna_distruzione.hard_delete_catalog()
 THEN RAISE EXCEPTION 'Migrazione storica o firma divergente'; END IF;
END
$$;
SET request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$
DECLARE
 a uuid := '30000000-0000-0000-0000-000000000002';
 b uuid := '30000000-0000-0000-0000-000000000007';
BEGIN
 BEGIN
   PERFORM public.salva_classificazione_cantiere(a,null,null,null,'archivio_acquisti_personali','mantieni',false);
   RAISE EXCEPTION 'Conferma mancante accettata';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.salva_classificazione_cantiere(a,null,null,null,'archivio_acquisti_personali','mantieni',true);
 BEGIN
   PERFORM public.salva_classificazione_cantiere(a,null,null,null,'archivio_acquisti_personali','mantieni',true);
   RAISE EXCEPTION 'Salvataggio obsoleto accettato';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
   PERFORM public.salva_classificazione_cantiere('30000000-0000-0000-0000-000000000001',null,null,null,'cantiere_lavori','in_corso',true);
   RAISE EXCEPTION 'Aggiornamento senza permessi';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE cantieri SET fase_lavori='in_corso' WHERE id=a;
   RAISE EXCEPTION 'Aggiornamento diretto senza permessi';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.salva_classificazione_cantiere('30000000-0000-0000-0000-000000000004',null,null,null,'cantiere_lavori','concluso',true);
 PERFORM public.salva_classificazione_cantiere(b,null,null,null,'cantiere_lavori','in_corso',true);
 UPDATE cantieri SET lavori_conclusi=true WHERE id=b;
 IF NOT EXISTS (SELECT FROM cantieri WHERE id=b AND lavori_conclusi AND fase_lavori='in_corso') THEN
   RAISE EXCEPTION 'Chiusura legacy perde la fase';
 END IF;
 UPDATE cantieri SET lavori_conclusi=false WHERE id=b;
 IF NOT EXISTS (SELECT FROM cantieri WHERE id=b AND NOT lavori_conclusi AND fase_lavori='in_corso') THEN
   RAISE EXCEPTION 'Riapertura legacy perde la fase';
 END IF;
END
$$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT array_agg(ricevuto ORDER BY id) FROM public.fatture_classificazione_fixture) <> ARRAY[0,10000,0]::numeric[]
 OR (SELECT array_agg(iva ORDER BY id) FROM public.fatture_classificazione_fixture) <> ARRAY[22,909.09,10]::numeric[]
 OR NOT EXISTS (SELECT FROM public.cantieri c JOIN public.fatture_classificazione_fixture f ON f.cantiere=c.id
                WHERE c.lavori_conclusi AND f.credito_documentato=110 AND f.ricevuto=0)
 OR NOT EXISTS (SELECT FROM cantieri WHERE nome='TORRE Alessandro' AND destinazione_amministrativa='archivio_acquisti_personali' AND preventivo_contrattuale_id IS NULL)
 THEN RAISE EXCEPTION 'Archivio o dati fiscali divergenti'; END IF;
END
$$;
