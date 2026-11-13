BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;

CREATE TEMP TABLE debiti_catalogo_prima (voce text NOT NULL) ON COMMIT DROP;
DO $baseline$
DECLARE
  corpo text;
  finale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
  SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc
  WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure
    AND md5(prosrc)='e653969ab1719f575d07038a3cbdd143';
  IF right(corpo,length(finale)) <> finale
     OR (SELECT count(*) FROM artecna_distruzione.hard_delete_catalog_expected) <> 1
     OR (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected)
        IS DISTINCT FROM artecna_distruzione.hard_delete_catalog() THEN
    RAISE EXCEPTION 'Catalogo Hard Delete V3 precedente divergente';
  END IF;
  EXECUTE 'INSERT INTO pg_temp.debiti_catalogo_prima ' ||
    left(corpo,length(corpo)-length(finale)) || 'SELECT x FROM objects';
END;
$baseline$;

ALTER TABLE public.pagamenti_fornitori
  ADD COLUMN fattura_id uuid,
  ADD COLUMN origine_debito text,
  ADD COLUMN revisione_debito bigint NOT NULL DEFAULT 0,
  ADD COLUMN verificato_da uuid,
  ADD COLUMN verificato_at timestamptz,
  ADD COLUMN annullato_da uuid,
  ADD COLUMN annullato_at timestamptz,
  ALTER COLUMN importo_totale DROP DEFAULT,
  ALTER COLUMN importo_pagato DROP DEFAULT,
  ADD CONSTRAINT pagamenti_fornitori_documento_fk FOREIGN KEY (fattura_id)
    REFERENCES public.fatture_fornitori(id) ON DELETE RESTRICT,
  ADD CONSTRAINT pagamenti_fornitori_documento_unico UNIQUE (fattura_id),
  ADD CONSTRAINT pagamenti_fornitori_origine_check CHECK (
    (origine_debito IS NULL AND fattura_id IS NULL) OR
    (origine_debito IS NOT NULL AND ((origine_debito='manuale' AND fattura_id IS NULL) OR
      (origine_debito='fattura' AND fattura_id IS NOT NULL)))),
  ADD CONSTRAINT pagamenti_fornitori_verifica_check CHECK (
    revisione_debito >= 0 AND
    ((verificato_da IS NULL AND verificato_at IS NULL) OR
     (verificato_da IS NOT NULL AND verificato_at IS NOT NULL AND origine_debito IS NOT NULL AND
      data_scadenza IS NOT NULL AND isfinite(data_scadenza) AND
      importo_totale IS NOT NULL AND importo_totale > 0 AND importo_totale < 'Infinity'::numeric AND
      importo_pagato IS NOT NULL AND importo_pagato >= 0 AND importo_pagato <= importo_totale AND trunc(importo_totale,2)=importo_totale AND trunc(importo_pagato,2)=importo_pagato)) AND
    ((annullato_da IS NULL AND annullato_at IS NULL) OR
     (annullato_da IS NOT NULL AND annullato_at IS NOT NULL)));

-- Le sole scritture applicative passano dalle RPC. SELECT resta soggetto a RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON public.pagamenti_fornitori
  FROM PUBLIC, anon, authenticated, service_role;
DO $privilegi$
DECLARE
  colonne text;
  ruolo text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO colonne
  FROM pg_attribute WHERE attrelid='public.pagamenti_fornitori'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%1$s), UPDATE (%1$s) ON public.pagamenti_fornitori FROM PUBLIC, anon, authenticated, service_role', colonne);
  FOREACH ruolo IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(ruolo,'public.pagamenti_fornitori','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      OR has_any_column_privilege(ruolo,'public.pagamenti_fornitori','INSERT,UPDATE') THEN
      RAISE EXCEPTION 'Privilegi diretti o ereditati inattesi per %', ruolo;
    END IF;
  END LOOP;
END;
$privilegi$;


CREATE FUNCTION public.puo_leggere_debiti_fornitori()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS TRUE
$$;
REVOKE ALL ON FUNCTION public.puo_leggere_debiti_fornitori() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.puo_leggere_debiti_fornitori() TO authenticated;

ALTER TABLE public.pagamenti_fornitori ENABLE ROW LEVEL SECURITY;
CREATE POLICY debiti_fornitori_lettura ON public.pagamenti_fornitori FOR SELECT TO authenticated
  USING ((SELECT public.puo_leggere_debiti_fornitori()));
CREATE POLICY debiti_fornitori_hard_delete ON public.pagamenti_fornitori TO artecna_cantieri_delete_rpc
  USING (true) WITH CHECK (true);

CREATE FUNCTION artecna_guardie.proteggi_debiti_fornitori()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='TRUNCATE' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='TRUNCATE debiti vietato';
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.origine_debito IS NOT NULL OR OLD.verificato_at IS NOT NULL OR OLD.annullato_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Debito gestito da conservare: cancellazione bloccata';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER debiti_fornitori_conserva BEFORE DELETE ON public.pagamenti_fornitori
  FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_debiti_fornitori();
CREATE TRIGGER debiti_fornitori_no_truncate BEFORE TRUNCATE ON public.pagamenti_fornitori
  FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_debiti_fornitori();

CREATE FUNCTION public.leggi_debiti_fornitori(p_id uuid DEFAULT NULL,p_fattura uuid DEFAULT NULL)
RETURNS SETOF public.pagamenti_fornitori LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Debiti riservati al titolare attivo';
  END IF;
  RETURN QUERY SELECT d.* FROM public.pagamenti_fornitori d
    WHERE (p_id IS NULL OR d.id=p_id) AND (p_fattura IS NULL OR d.fattura_id=p_fattura)
    ORDER BY d.data_scadenza NULLS LAST,d.id;
END;
$$;

CREATE FUNCTION public.registra_debito_fornitore(p_fattura uuid,p_fornitore text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  documento public.fatture_fornitori;
  debito uuid;
BEGIN
  IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Debiti riservati al titolare attivo';
  END IF;
  IF p_fattura IS NULL THEN
    IF nullif(btrim(p_fornitore),'') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Fornitore obbligatorio';
    END IF;
    INSERT INTO public.pagamenti_fornitori(fornitore_nome,origine_debito)
      VALUES (btrim(p_fornitore),'manuale') RETURNING id INTO debito;
  ELSE
    SELECT * INTO documento FROM public.fatture_fornitori WHERE id=p_fattura FOR UPDATE;
    IF NOT FOUND OR upper(coalesce(documento.tipo_documento,'')) IN ('TD04','NOTA_CREDITO')
      OR coalesce(documento.importo_totale,0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Documento assente o non idoneo al debito';
    END IF;
    SELECT id INTO debito FROM public.pagamenti_fornitori WHERE fattura_id=p_fattura;
    IF debito IS NULL THEN
      INSERT INTO public.pagamenti_fornitori(fattura_id,origine_debito,fornitore_nome,data_documento,importo_totale)
        VALUES(p_fattura,'fattura',documento.fornitore,documento.data_fattura,documento.importo_totale)
        RETURNING id INTO debito;
    END IF;
  END IF;
  RETURN debito;
END;
$$;

CREATE FUNCTION public.verifica_debito_fornitore(p_id uuid,p_revisione bigint,p_scadenza date,
  p_dovuto numeric,p_pagato numeric,p_annulla boolean DEFAULT false)
RETURNS public.pagamenti_fornitori LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  attore uuid := artecna_guardie.utente_jwt_corrente();
  debito public.pagamenti_fornitori;
BEGIN
  IF artecna_guardie.utente_puo_operare_impresa(attore) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Debiti riservati al titolare attivo';
  END IF;
  SELECT * INTO STRICT debito FROM public.pagamenti_fornitori WHERE id=p_id FOR UPDATE;
  IF debito.revisione_debito IS DISTINCT FROM p_revisione THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Revisione obsoleta: rileggere il debito';
  END IF;
  IF debito.origine_debito IS NULL OR debito.annullato_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Origine da verificare o debito già annullato';
  END IF;
  IF p_annulla IS TRUE THEN
    UPDATE public.pagamenti_fornitori SET annullato_da=attore,annullato_at=statement_timestamp(),
      revisione_debito=revisione_debito+1 WHERE id=p_id RETURNING * INTO debito;
  ELSE
    IF p_scadenza IS NULL OR NOT isfinite(p_scadenza) OR p_dovuto IS NULL
      OR p_dovuto <= 0 OR p_dovuto >= 'Infinity'::numeric OR p_pagato IS NULL
      OR p_pagato < 0 OR p_pagato > p_dovuto OR trunc(p_dovuto,2) <> p_dovuto OR trunc(p_pagato,2) <> p_pagato THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Scadenza o importi non validi';
    END IF;
    UPDATE public.pagamenti_fornitori SET data_scadenza=p_scadenza,importo_totale=p_dovuto,
      importo_pagato=p_pagato,verificato_da=attore,verificato_at=statement_timestamp(),
      revisione_debito=revisione_debito+1 WHERE id=p_id RETURNING * INTO debito;
  END IF;
  RETURN debito;
END;
$$;

REVOKE ALL ON FUNCTION public.leggi_debiti_fornitori(uuid,uuid),public.registra_debito_fornitore(uuid,text),
  public.verifica_debito_fornitore(uuid,bigint,date,numeric,numeric,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_debiti_fornitori(uuid,uuid),public.registra_debito_fornitore(uuid,text),
  public.verifica_debito_fornitore(uuid,bigint,date,numeric,numeric,boolean) TO authenticated;
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_debiti_fornitori() FROM PUBLIC,anon,authenticated,service_role;

CREATE TEMP TABLE debiti_catalogo_dopo (voce text NOT NULL) ON COMMIT DROP;
DO $verifica$
DECLARE
  corpo text;
  finale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
  SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc
    WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
  EXECUTE 'INSERT INTO pg_temp.debiti_catalogo_dopo ' ||
    left(corpo,length(corpo)-length(finale)) || 'SELECT x FROM objects';

  UPDATE pg_temp.debiti_catalogo_prima SET voce=regexp_replace(
    regexp_replace(voce,'(anon|authenticated|service_role)=arwdDxt(m?)/postgres','\1=rx\2/postgres','g'),
    ':false:false$',':true:false')
    WHERE voce LIKE 'r:public.pagamenti_fornitori:%';
  INSERT INTO pg_temp.debiti_catalogo_prima VALUES
    ('c:public.pagamenti_fornitori:fattura_id:uuid:false'),
    ('c:public.pagamenti_fornitori:origine_debito:text:false'),
    ('c:public.pagamenti_fornitori:revisione_debito:bigint:true'),
    ('c:public.pagamenti_fornitori:verificato_da:uuid:false'),
    ('c:public.pagamenti_fornitori:verificato_at:timestamp with time zone:false'),
    ('c:public.pagamenti_fornitori:annullato_da:uuid:false'),
    ('c:public.pagamenti_fornitori:annullato_at:timestamp with time zone:false'),
    ('f:public.pagamenti_fornitori:pagamenti_fornitori_documento_fk:FOREIGN KEY (fattura_id) REFERENCES public.fatture_fornitori(id) ON DELETE RESTRICT:true'),
    ('f:public.pagamenti_fornitori:pagamenti_fornitori_documento_unico:UNIQUE (fattura_id):true'),
    ('p:artecna_guardie.proteggi_debiti_fornitori():21ef9ce177961274a4e46dbd7927263d:false:{"search_path=pg_catalog, pg_temp"}:postgres:{postgres=X/postgres}'),
    ('t:public.pagamenti_fornitori:CREATE TRIGGER debiti_fornitori_conserva BEFORE DELETE ON public.pagamenti_fornitori FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_debiti_fornitori():O'),
    ('t:public.pagamenti_fornitori:CREATE TRIGGER debiti_fornitori_no_truncate BEFORE TRUNCATE ON public.pagamenti_fornitori FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_debiti_fornitori():O');
  -- Check expressions are authored above, scoped to this relation and named explicitly.
  INSERT INTO pg_temp.debiti_catalogo_prima
    SELECT 'f:public.pagamenti_fornitori:'||conname||':'||pg_get_constraintdef(oid,true)||':true'
    FROM pg_constraint WHERE conrelid='public.pagamenti_fornitori'::regclass
      AND contype='c' AND conname IN ('pagamenti_fornitori_origine_check','pagamenti_fornitori_verifica_check');
  IF EXISTS (
    (SELECT voce FROM pg_temp.debiti_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.debiti_catalogo_dopo)
    UNION ALL
    (SELECT voce FROM pg_temp.debiti_catalogo_dopo EXCEPT ALL SELECT voce FROM pg_temp.debiti_catalogo_prima)
  ) THEN
    RAISE EXCEPTION 'Delta catalogo Debiti fornitori inatteso'
      USING DETAIL = (SELECT jsonb_build_object(
        'mancanti', ARRAY(SELECT voce FROM pg_temp.debiti_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.debiti_catalogo_dopo),
        'aggiunte', ARRAY(SELECT voce FROM pg_temp.debiti_catalogo_dopo EXCEPT ALL SELECT voce FROM pg_temp.debiti_catalogo_prima)
      )::text);
  END IF;
  UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
END;
$verifica$;
COMMIT;
