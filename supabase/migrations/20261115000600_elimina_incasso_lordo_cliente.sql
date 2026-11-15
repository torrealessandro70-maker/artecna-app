BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;

LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;

DO $pre$
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR (SELECT md5(prosrc) FROM pg_proc
        WHERE oid='public.conferma_incasso_lordo_cliente(uuid,uuid,numeric,date,text,text,text)'::regprocedure)
      IS DISTINCT FROM '02cda650ff491e9878cca6b90b7fa0fb'
    OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
      IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
  THEN RAISE EXCEPTION 'Baseline incassi o Hard Delete V3 divergente'; END IF;
END
$pre$;

-- Il registro sopravvive al pagamento e al suo contesto originario.
CREATE TABLE artecna_contabilita.eliminazioni_incassi_lordi (
  richiesta_id uuid PRIMARY KEY,
  incasso_id uuid NOT NULL UNIQUE,
  acconto_id uuid NOT NULL,
  operatore uuid NOT NULL,
  riferimento text NOT NULL,
  motivo text NOT NULL CHECK (length(motivo) BETWEEN 1 AND 500),
  eliminato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  movimento jsonb NOT NULL
);
ALTER TABLE artecna_contabilita.eliminazioni_incassi_lordi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.eliminazioni_incassi_lordi FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.elimina_incasso_lordo_cliente(
  p_richiesta uuid,p_acconto uuid,p_incasso uuid,p_riferimento text,p_conferma text,p_motivo text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  operatore_id uuid;
  cantiere uuid;
  incasso artecna_contabilita.incassi_lordi_clienti;
  audit artecna_contabilita.eliminazioni_incassi_lordi;
BEGIN
  p_motivo:=btrim(p_motivo);
  IF p_richiesta IS NULL OR p_acconto IS NULL OR p_incasso IS NULL
    OR p_conferma IS DISTINCT FROM 'ELIMINA' OR coalesce(length(p_riferimento),0) NOT BETWEEN 1 AND 200
    OR coalesce(length(p_motivo),0) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'Conferma e motivo sono obbligatori' USING ERRCODE='22023'; END IF;

  PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
  SELECT cantiere_id INTO cantiere FROM public.acconti_cantiere WHERE id=p_acconto FOR NO KEY UPDATE;
  operatore_id:=artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
  PERFORM pg_advisory_xact_lock(hashtextextended('incassi-riferimenti:'||cantiere::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('incasso-id:'||p_incasso::text,0));

  SELECT * INTO audit FROM artecna_contabilita.eliminazioni_incassi_lordi WHERE richiesta_id=p_richiesta;
  IF FOUND THEN
    IF (audit.incasso_id,audit.acconto_id,audit.operatore,audit.riferimento,audit.motivo)
      IS DISTINCT FROM (p_incasso,p_acconto,operatore_id,p_riferimento,p_motivo)
      OR audit.movimento->>'cantiere_id' IS DISTINCT FROM cantiere::text
    THEN RAISE EXCEPTION 'Richiesta duplicata con dati discordanti' USING ERRCODE='23505'; END IF;
    RETURN jsonb_build_object('richiesta_duplicata',true);
  END IF;

  -- Stabilizza il catalogo delle dipendenze fino al DELETE.
  LOCK TABLE artecna_contabilita.incassi_lordi_clienti IN ROW EXCLUSIVE MODE;
  SELECT * INTO incasso FROM artecna_contabilita.incassi_lordi_clienti
  WHERE id=p_incasso AND acconto_id=p_acconto AND cantiere_id=cantiere FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento assente o non accessibile. Aggiorna gli incassi.' USING ERRCODE='42501';
  END IF;
  IF incasso.riferimento IS DISTINCT FROM p_riferimento THEN
    RAISE EXCEPTION 'Riferimento aggiornato. Rileggi gli incassi prima di confermare.' USING ERRCODE='40001';
  END IF;

  IF EXISTS(SELECT FROM artecna_contabilita.quote_lorde_clienti WHERE incasso_id=p_incasso)
    OR EXISTS(SELECT FROM artecna_contabilita.rettifiche_riferimenti_incassi WHERE incasso_id=p_incasso)
  THEN
    RAISE EXCEPTION 'Pagamento da conservare: contiene quote o rettifiche. Verificare lo storno con la contabilità.'
      USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT FROM pg_constraint
    WHERE contype='f' AND confrelid='artecna_contabilita.incassi_lordi_clienti'::regclass
      AND (confdeltype<>'r' OR conrelid NOT IN (
        'artecna_contabilita.quote_lorde_clienti'::regclass,
        'artecna_contabilita.rettifiche_riferimenti_incassi'::regclass))
  ) OR EXISTS (
    SELECT FROM pg_trigger
    WHERE tgrelid='artecna_contabilita.incassi_lordi_clienti'::regclass AND NOT tgisinternal AND tgtype & 8 <> 0
  ) OR EXISTS (
    SELECT FROM pg_rewrite
    WHERE ev_class='artecna_contabilita.incassi_lordi_clienti'::regclass AND ev_type='4'
  ) THEN
    RAISE EXCEPTION 'Dipendenze di eliminazione da verificare con la contabilità' USING ERRCODE='23514';
  END IF;

  IF incasso.metodo<>'bonifico' OR incasso.riferimento<>'cro' OR NOT EXISTS (
    SELECT FROM artecna_contabilita.incassi_lordi_clienti AS altro
    WHERE altro.cantiere_id=cantiere AND altro.metodo='bonifico'
      AND altro.importo=incasso.importo AND altro.ricevuto_il=incasso.ricevuto_il
      AND altro.riferimento ~ '^[0-9]{11}$'
  ) THEN
    RAISE EXCEPTION 'Pagamento da conservare: eliminazione riservata al duplicato con riferimento generico cro e bonifico corrispondente. Verificare lo storno con la contabilità.'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO artecna_contabilita.eliminazioni_incassi_lordi
    (richiesta_id,incasso_id,acconto_id,operatore,riferimento,motivo,movimento)
  VALUES (p_richiesta,p_incasso,p_acconto,operatore_id,p_riferimento,p_motivo,to_jsonb(incasso));
  DELETE FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_incasso;
  RETURN jsonb_build_object('richiesta_duplicata',false);
END $$;

REVOKE ALL ON FUNCTION public.elimina_incasso_lordo_cliente(uuid,uuid,uuid,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elimina_incasso_lordo_cliente(uuid,uuid,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.conferma_incasso_lordo_cliente(p_id uuid,p_acconto uuid,p_importo numeric,
 p_data date,p_metodo text,p_riferimento text,p_fonte text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; c uuid; r artecna_contabilita.incassi_lordi_clienti; riferimento_iniziale text;
BEGIN
 SELECT cantiere_id INTO c FROM public.acconti_cantiere WHERE id=p_acconto FOR NO KEY UPDATE;
 u:=artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
 p_riferimento:=lower(btrim(p_riferimento));
 p_fonte:=btrim(p_fonte);
 IF p_id IS NULL OR p_importo IS NULL OR NOT (p_importo BETWEEN 0.01 AND 999999999999.99)
 OR p_importo<>round(p_importo,2) OR p_data IS NULL OR NOT isfinite(p_data)
 OR p_data>(now() AT TIME ZONE 'Europe/Rome')::date
 OR p_metodo IS NULL OR p_metodo NOT IN ('bonifico','contanti','altro')
 OR coalesce(length(p_riferimento),0) NOT BETWEEN 1 AND 200
 OR coalesce(length(p_fonte),0) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Dati del pagamento incompleti o non validi' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('incassi-riferimenti:'||c::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('incasso-id:'||p_id::text,0));
 IF EXISTS(SELECT FROM artecna_contabilita.eliminazioni_incassi_lordi WHERE incasso_id=p_id)
 THEN RAISE EXCEPTION 'Richiesta di registrazione relativa a un incasso eliminato' USING ERRCODE='23505'; END IF;
 SELECT * INTO r FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_id;
 IF FOUND THEN
  SELECT riferimento_precedente INTO riferimento_iniziale FROM artecna_contabilita.rettifiche_riferimenti_incassi
  WHERE incasso_id=r.id AND revisione=1;
  IF (r.acconto_id,r.cantiere_id,r.importo,r.ricevuto_il,r.metodo,coalesce(riferimento_iniziale,r.riferimento),r.fonte,r.autore)
   IS DISTINCT FROM (p_acconto,c,p_importo,p_data,p_metodo,p_riferimento,p_fonte,u)
  THEN RAISE EXCEPTION 'Richiesta duplicata con dati discordanti' USING ERRCODE='23505'; END IF;
  RETURN to_jsonb(r)||jsonb_build_object('richiesta_duplicata',true);
 END IF;
 IF EXISTS(SELECT FROM artecna_contabilita.rettifiche_riferimenti_incassi s
 JOIN artecna_contabilita.incassi_lordi_clienti x ON x.id=s.incasso_id
 WHERE x.cantiere_id=c AND x.metodo=p_metodo AND p_riferimento IN (s.riferimento_precedente,s.riferimento_nuovo))
 THEN RAISE EXCEPTION 'Pagamento gia presente. Verificare il riferimento nello storico.' USING ERRCODE='23505'; END IF;
 INSERT INTO artecna_contabilita.incassi_lordi_clienti(id,acconto_id,cantiere_id,importo,ricevuto_il,metodo,riferimento,fonte,autore)
 VALUES(p_id,p_acconto,c,p_importo,p_data,p_metodo,p_riferimento,p_fonte,u)
 ON CONFLICT DO NOTHING RETURNING * INTO r;
 IF NOT FOUND THEN
  IF EXISTS(SELECT FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_id)
  THEN RAISE EXCEPTION 'Richiesta duplicata con dati discordanti' USING ERRCODE='23505'; END IF;
  RAISE EXCEPTION 'Pagamento gia presente. Consultare il pagamento esistente.' USING ERRCODE='23505';
 END IF;
 RETURN to_jsonb(r)||jsonb_build_object('richiesta_duplicata',false);
END $$;

DO $catalogo$
BEGIN
  IF (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
    IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
  THEN RAISE EXCEPTION 'Catalogo Hard Delete V3 divergente'; END IF;
END
$catalogo$;
COMMIT;
