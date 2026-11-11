-- Preparata per revisione. Non applicare insieme alla pubblicazione della UI.
BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'Migrazione riservata al ruolo amministrativo previsto';
  END IF;
END $preflight$;

CREATE TABLE artecna_contabilita.documenti_fiscali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('F24', 'Altro')),
  nome_file text NOT NULL CHECK (length(btrim(nome_file)) BETWEEN 1 AND 255),
  data_documento date CHECK (isfinite(data_documento)),
  storage_path text GENERATED ALWAYS AS ('documenti/' || id::text || '.pdf') STORED UNIQUE,
  mime_type text NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  revisione integer NOT NULL DEFAULT 0 CHECK (revisione >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL,
  caricato_at timestamptz,
  archiviata_at timestamptz,
  archiviata_by uuid
);
ALTER TABLE artecna_contabilita.documenti_fiscali ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.documenti_fiscali FORCE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.documenti_fiscali FROM PUBLIC, anon, authenticated, service_role;
DO $acl$
DECLARE destinatario record;
BEGIN
  FOR destinatario IN
    SELECT DISTINCT a.grantee
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid = 'artecna_contabilita.documenti_fiscali'::regclass
      AND a.grantee <> 0 AND a.grantee <> c.relowner
  LOOP
    EXECUTE format('REVOKE ALL ON artecna_contabilita.documenti_fiscali FROM %I', pg_get_userbyid(destinatario.grantee));
  END LOOP;
END $acl$;

ALTER TABLE artecna_contabilita.scadenze_fiscali
  ADD COLUMN documento_id uuid REFERENCES artecna_contabilita.documenti_fiscali(id) ON DELETE RESTRICT;
CREATE INDEX scadenze_fiscali_documento_idx
  ON artecna_contabilita.scadenze_fiscali(documento_id) WHERE documento_id IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documenti-fiscali-privati', 'documenti-fiscali-privati', false, 10485760, ARRAY['application/pdf']);

-- Il predicato non espone metadati. Serve anche alle policy restrittive
-- per impedire che altre policy permissive allarghino questo bucket.
CREATE FUNCTION public.documento_fiscale_storage_consentito(p_path text, p_upload boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()), false)
    AND EXISTS (
      SELECT 1 FROM artecna_contabilita.documenti_fiscali d
      WHERE d.storage_path = p_path
        AND CASE WHEN p_upload THEN
          d.caricato_at IS NULL AND d.archiviata_at IS NULL
          AND d.created_by = artecna_guardie.utente_jwt_corrente()
          AND d.created_at > statement_timestamp() - interval '2 hours'
        ELSE d.caricato_at IS NOT NULL
          OR (d.archiviata_at IS NULL AND d.created_by = auth.uid()
              AND d.created_at > statement_timestamp() - interval '2 hours') END
    );
$f$;
CREATE POLICY fiscali_leggi ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documenti-fiscali-privati' AND public.documento_fiscale_storage_consentito(name, false));
CREATE POLICY fiscali_confine_lettura ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (bucket_id <> 'documenti-fiscali-privati' OR public.documento_fiscale_storage_consentito(name, false));
CREATE POLICY fiscali_prenota_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documenti-fiscali-privati' AND public.documento_fiscale_storage_consentito(name, true));
CREATE POLICY fiscali_confine_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (bucket_id <> 'documenti-fiscali-privati' OR public.documento_fiscale_storage_consentito(name, true));
CREATE POLICY fiscali_immutabili ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (bucket_id <> 'documenti-fiscali-privati') WITH CHECK (bucket_id <> 'documenti-fiscali-privati');
CREATE POLICY fiscali_nessuna_rimozione ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING (bucket_id <> 'documenti-fiscali-privati');

CREATE FUNCTION public.elenca_documenti_fiscali()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
DECLARE risultato jsonb;
BEGIN
  PERFORM artecna_contabilita.scadenza_autorizza();
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC, d.id), '[]'::jsonb)
    INTO risultato FROM artecna_contabilita.documenti_fiscali d;
  RETURN risultato;
END $f$;

CREATE FUNCTION public.crea_documento_fiscale(p_id uuid, p_tipo text, p_nome text, p_data date, p_byte_size integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
DECLARE attore uuid := artecna_contabilita.scadenza_autorizza();
  documento artecna_contabilita.documenti_fiscali;
BEGIN
  IF p_id IS NULL THEN RAISE EXCEPTION 'Identità richiesta mancante' USING ERRCODE = '22023'; END IF;
  INSERT INTO artecna_contabilita.documenti_fiscali
    (id, tipo_documento, nome_file, data_documento, byte_size, created_by, updated_by)
  VALUES (p_id, p_tipo, btrim(p_nome), p_data, p_byte_size, attore, attore)
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO documento;
  IF NOT FOUND THEN
    SELECT * INTO documento FROM artecna_contabilita.documenti_fiscali WHERE id = p_id;
    IF documento.id IS NULL OR documento.created_by <> attore OR documento.archiviata_at IS NOT NULL
      OR ROW(documento.tipo_documento, documento.nome_file, documento.data_documento, documento.byte_size)
         IS DISTINCT FROM ROW(p_tipo, btrim(p_nome), p_data, p_byte_size) THEN
      RAISE EXCEPTION 'Identità già usata. Rileggere il registro' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN to_jsonb(documento);
END $f$;

CREATE FUNCTION public.aggiorna_documento_fiscale(p_id uuid, p_revisione_attesa integer, p_tipo text, p_nome text, p_data date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
DECLARE attore uuid := artecna_contabilita.scadenza_autorizza();
  documento artecna_contabilita.documenti_fiscali;
BEGIN
  UPDATE artecna_contabilita.documenti_fiscali
  SET tipo_documento = p_tipo, nome_file = btrim(p_nome), data_documento = p_data,
      revisione = revisione + 1, updated_at = clock_timestamp(), updated_by = attore
  WHERE id = p_id AND archiviata_at IS NULL AND revisione = p_revisione_attesa RETURNING * INTO documento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conflitto di revisione: rileggere il documento' USING ERRCODE = '40001'; END IF;
  RETURN to_jsonb(documento);
END $f$;

CREATE FUNCTION public.conferma_upload_documento_fiscale(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
DECLARE attore uuid := artecna_contabilita.scadenza_autorizza();
  documento artecna_contabilita.documenti_fiscali;
BEGIN
  SELECT * INTO documento FROM artecna_contabilita.documenti_fiscali
  WHERE id = p_id AND created_by = attore AND archiviata_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prenotazione non disponibile' USING ERRCODE = '42501'; END IF;
  IF documento.caricato_at IS NOT NULL THEN RETURN to_jsonb(documento); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'documenti-fiscali-privati' AND o.name = documento.storage_path
      AND o.metadata->>'mimetype' = documento.mime_type
      AND o.metadata->>'size' = documento.byte_size::text
  ) THEN RAISE EXCEPTION 'PDF non presente o metadati non coerenti' USING ERRCODE = '22023'; END IF;
  UPDATE artecna_contabilita.documenti_fiscali
  SET caricato_at = clock_timestamp(), revisione = revisione + 1, updated_at = clock_timestamp(), updated_by = attore
  WHERE id = p_id RETURNING * INTO documento;
  RETURN to_jsonb(documento);
END $f$;

CREATE FUNCTION public.archivia_documento_fiscale(p_id uuid, p_revisione_attesa integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
DECLARE attore uuid := artecna_contabilita.scadenza_autorizza();
  documento artecna_contabilita.documenti_fiscali;
BEGIN
  UPDATE artecna_contabilita.documenti_fiscali
  SET archiviata_at = clock_timestamp(), archiviata_by = attore,
      revisione = revisione + 1, updated_at = clock_timestamp(), updated_by = attore
  WHERE id = p_id AND archiviata_at IS NULL AND revisione = p_revisione_attesa RETURNING * INTO documento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conflitto di revisione: rileggere il documento' USING ERRCODE = '40001'; END IF;
  RETURN to_jsonb(documento);
END $f$;

CREATE FUNCTION artecna_contabilita.imposta_documento_scadenza(p_id uuid, p_documento_id uuid, p_revisione_attesa bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
DECLARE attore uuid := artecna_contabilita.scadenza_autorizza();
  scadenza artecna_contabilita.scadenze_fiscali;
BEGIN
  IF p_documento_id IS NOT NULL THEN
    PERFORM 1 FROM artecna_contabilita.documenti_fiscali
    WHERE id = p_documento_id AND caricato_at IS NOT NULL AND archiviata_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Documento non collegabile' USING ERRCODE = '22023'; END IF;
  END IF;
  UPDATE artecna_contabilita.scadenze_fiscali
  SET documento_id = p_documento_id, revisione = revisione + 1, updated_at = clock_timestamp(), updated_by = attore
  WHERE id = p_id AND archiviata_at IS NULL AND revisione = p_revisione_attesa
  RETURNING * INTO scadenza;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conflitto di revisione: rileggere la scadenza' USING ERRCODE = '40001'; END IF;
  RETURN artecna_contabilita.scadenza_json(scadenza);
END $f$;

CREATE FUNCTION public.collega_documento_scadenza(p_id uuid, p_documento_id uuid, p_revisione_attesa bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
BEGIN
  PERFORM artecna_contabilita.scadenza_autorizza();
  IF p_documento_id IS NULL THEN RAISE EXCEPTION 'Selezionare il documento' USING ERRCODE = '22023'; END IF;
  RETURN artecna_contabilita.imposta_documento_scadenza(p_id, p_documento_id, p_revisione_attesa);
END $f$;

CREATE FUNCTION public.scollega_documento_scadenza(p_id uuid, p_revisione_attesa bigint)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $f$
  SELECT artecna_contabilita.imposta_documento_scadenza(p_id, NULL, p_revisione_attesa);
$f$;

REVOKE ALL ON FUNCTION artecna_contabilita.imposta_documento_scadenza(uuid, uuid, bigint)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.documento_fiscale_storage_consentito(text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
-- Anon deve poter valutare il confine restrittivo degli altri bucket.
-- Il predicato restituisce false senza identità aziendale.
GRANT EXECUTE ON FUNCTION public.documento_fiscale_storage_consentito(text, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.elenca_documenti_fiscali(),
  public.crea_documento_fiscale(uuid, text, text, date, integer),
  public.aggiorna_documento_fiscale(uuid, integer, text, text, date),
  public.conferma_upload_documento_fiscale(uuid), public.archivia_documento_fiscale(uuid, integer),
  public.collega_documento_scadenza(uuid, uuid, bigint), public.scollega_documento_scadenza(uuid, bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.elenca_documenti_fiscali(),
  public.crea_documento_fiscale(uuid, text, text, date, integer),
  public.aggiorna_documento_fiscale(uuid, integer, text, text, date),
  public.conferma_upload_documento_fiscale(uuid), public.archivia_documento_fiscale(uuid, integer),
  public.collega_documento_scadenza(uuid, uuid, bigint), public.scollega_documento_scadenza(uuid, bigint)
  TO authenticated;

COMMIT;
