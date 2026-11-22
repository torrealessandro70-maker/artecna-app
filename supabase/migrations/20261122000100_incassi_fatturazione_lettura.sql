-- SOLO CANDIDATA LOCALE. Applicazione Production separatamente autorizzata.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR to_regprocedure('public.leggi_acconto_compilazione(uuid)') IS NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'Prerequisiti Acconti/Hard Delete divergenti'; END IF;
END $$;
CREATE FUNCTION public.leggi_incassi_fatturazione_impresa(p_da date,p_a date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); risultato jsonb;
BEGIN
 IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 OR EXISTS(SELECT FROM public.cantieri c WHERE artecna_guardie.utente_puo_modificare_cantiere(u,c.id) IS NOT TRUE)
 THEN RAISE EXCEPTION 'Perimetro impresa non interamente autorizzato' USING ERRCODE='42501'; END IF;
 IF p_da IS NULL OR p_a IS NULL OR NOT isfinite(p_da) OR NOT isfinite(p_a) OR p_da>p_a
 THEN RAISE EXCEPTION 'Periodo non valido' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM artecna_contabilita.incassi_lordi_clienti WHERE ricevuto_il BETWEEN p_da AND p_a)>10000
 THEN RAISE EXCEPTION 'Periodo troppo ampio: nessun totale parziale' USING ERRCODE='54000'; END IF;
 -- STABLE: una sola snapshot anche per i lettori fiscali annidati. Nessun LOCK/writer.
 WITH movimenti AS (
  SELECT i.*,a.nota,a.descrizione,a.importo AS netto,a.data_incasso,c.nome AS cantiere,
   a.cantiere_id IS NOT DISTINCT FROM i.cantiere_id AS identita_valida,
   public.leggi_acconto_fiscale(a.id) AS fiscale,
   (SELECT CASE WHEN (x.importo_origine,x.data_origine) IS NOT DISTINCT FROM (a.importo,a.data_incasso)
    THEN x.destinazione ELSE 'da_verificare' END FROM artecna_contabilita.imputazioni_acconti x
    WHERE x.acconto_id=a.id ORDER BY x.revisione DESC LIMIT 1) AS imputazione,
   NOT EXISTS(SELECT FROM public.fatture_emesse f WHERE f.cantiere_id=i.cantiere_id)
   AND NOT EXISTS(SELECT FROM artecna_contabilita.quote_lorde_clienti q WHERE q.incasso_id=i.id)
   AND NOT EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti x WHERE x.acconto_id=a.id)
   AS assenza_collegamenti_verificata
  FROM artecna_contabilita.incassi_lordi_clienti i
  JOIN public.acconti_cantiere a ON a.id=i.acconto_id JOIN public.cantieri c ON c.id=i.cantiere_id
  WHERE i.ricevuto_il BETWEEN p_da AND p_a
 ), quote AS (
  SELECT q.*,f.numero_fattura,f.cliente,
   q.cantiere_valido AND q.documento_valido AND q.sdi_valido AND NOT q.rettificata AS valida
  FROM (
   SELECT q.*,f.cantiere_id=i.cantiere_id AS cantiere_valido,
    artecna_contabilita.totale_fattura_finanziario(f) IS NOT NULL
     AND (SELECT coalesce(sum(x.importo),0) FROM artecna_contabilita.quote_lorde_clienti x
       WHERE x.fattura_id=f.id AND x.revocato_at IS NULL)<=artecna_contabilita.totale_fattura_finanziario(f) AS documento_valido,
    s.esito IN('consegnata','mancata_consegna') AND s.tipo IN('TD01','TD02')
     AND s.fonte=artecna_contabilita.fonte_fattura(f) AS sdi_valido,
    EXISTS(SELECT FROM artecna_contabilita.sdi_corrente n WHERE n.rettifica_id=f.id) AS rettificata
   FROM artecna_contabilita.quote_lorde_clienti q JOIN movimenti i ON i.id=q.incasso_id
   JOIN public.fatture_emesse f ON f.id=q.fattura_id LEFT JOIN artecna_contabilita.sdi_corrente s ON s.fattura_id=f.id
  ) q JOIN public.fatture_emesse f ON f.id=q.fattura_id
 )
 SELECT jsonb_build_object('versione',1,'completa',true,'autore',u,'da',p_da,'a',p_a,
  'fotografia',statement_timestamp(),'ambito','Incassi lordi verificati registrati: copertura documentale corrente',
  'storici_da_riconciliare',(SELECT count(*) FROM public.incassi_non_fatturati),
  'movimenti',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',i.id,'acconto_id',i.acconto_id,'cantiere_id',i.cantiere_id,'cantiere',i.cantiere,
   'importo',i.importo::text,'data',i.ricevuto_il,'metodo',i.metodo,'fonte',i.fonte,
   'descrizione',i.descrizione,'nota',i.nota,'netto_acconto',i.netto::text,'imputazione',coalesce(i.imputazione,'da_verificare'),
   'identita_valida',i.identita_valida,'fiscale',i.fiscale,
   'assenza_collegamenti_verificata',i.assenza_collegamenti_verificata,
   'quote',coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'fattura_id',q.fattura_id,
    'numero',q.numero_fattura,'cliente',q.cliente,'importo',q.importo::text,'valida',coalesce(q.valida,false),
    'revocata',q.revocato_at IS NOT NULL) ORDER BY q.id) FROM quote q WHERE q.incasso_id=i.id),'[]'::jsonb)
  ) ORDER BY i.ricevuto_il DESC,i.id) FROM movimenti i),'[]'::jsonb)) INTO risultato;
 -- JOIN mancanti non possono trasformare movimenti in zero o ometterli silenziosamente.
 IF jsonb_array_length(risultato->'movimenti')<>(SELECT count(*) FROM artecna_contabilita.incassi_lordi_clienti WHERE ricevuto_il BETWEEN p_da AND p_a)
 THEN RAISE EXCEPTION 'Identita incassi incomplete' USING ERRCODE='23514'; END IF;
 RETURN risultato;
END $$;
REVOKE ALL ON FUNCTION public.leggi_incassi_fatturazione_impresa(date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_incassi_fatturazione_impresa(date,date) TO authenticated;
-- Nessuna nuova tabella/FK/trigger: conserva l'inventario Hard Delete esistente.
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
