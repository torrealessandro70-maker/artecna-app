-- Locale, non installata. Capability private per la futura RPC atomica.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
CREATE TABLE artecna_distruzione.contesto_prerequisiti (
 tx xid8 NOT NULL,backend integer NOT NULL,user_id uuid NOT NULL,cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,
 PRIMARY KEY(tx,backend)
);
CREATE TABLE artecna_contabilita.archivio_quote (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tipo text NOT NULL CHECK(tipo IN ('economia','materiale')),
 fattura_riga_id uuid NOT NULL REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT,
 quantita numeric NOT NULL CHECK(quantita>0),netto numeric NOT NULL,costo numeric NOT NULL,
 descrizione text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Solo collegamento operativo transitorio, mai parte dell'archivio conservato.
CREATE TABLE artecna_distruzione.quote_da_eliminare (
 source_table text NOT NULL,source_id uuid NOT NULL,
 cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,
 archivio_id uuid NOT NULL UNIQUE REFERENCES artecna_contabilita.archivio_quote(id),
 PRIMARY KEY(source_table,source_id)
);
CREATE TABLE artecna_contabilita.archivio_attribuzioni (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fattura_id uuid NOT NULL REFERENCES public.fatture_emesse(id) ON DELETE RESTRICT,
 cliente text NOT NULL,importo numeric NOT NULL,verificato boolean NOT NULL,
 creato_at timestamptz NOT NULL,scollegato boolean NOT NULL
);
ALTER TABLE public.fornitori_rettifiche ADD COLUMN archivio_quota_id uuid REFERENCES artecna_contabilita.archivio_quote(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche DROP CONSTRAINT fornitori_rettifiche_check1,
 ADD CONSTRAINT fornitori_rettifiche_check1 CHECK(num_nonnulls(economia_riga_id,materiale_cantiere_id,materiale_impresa_id,spesa_impresa_id,archivio_quota_id)=1);

CREATE FUNCTION artecna_distruzione.apri_contesto_prerequisiti(cid uuid,conferma text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); BEGIN
 IF conferma IS DISTINCT FROM 'ELIMINA' OR u IS NULL THEN RAISE EXCEPTION 'Conferma/identità obbligatorie' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=u AND ruolo='owner' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 DELETE FROM artecna_distruzione.contesto_prerequisiti WHERE backend=pg_backend_pid() AND tx<>pg_current_xact_id();
 INSERT INTO artecna_distruzione.contesto_prerequisiti VALUES(pg_current_xact_id(),pg_backend_pid(),u,cid);
END $$;
CREATE FUNCTION artecna_distruzione.target_prerequisiti() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT c.cantiere_id FROM artecna_distruzione.contesto_prerequisiti c
 WHERE c.tx=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()
 AND c.user_id=artecna_guardie.utente_jwt_corrente()
 AND EXISTS(SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=c.cantiere_id AND u.user_id=c.user_id AND u.ruolo='owner')
$$;
CREATE FUNCTION artecna_distruzione.chiudi_contesto_prerequisiti() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF artecna_distruzione.target_prerequisiti() IS NULL THEN RAISE EXCEPTION 'Contesto assente' USING ERRCODE='42501'; END IF;
 DELETE FROM artecna_distruzione.contesto_prerequisiti WHERE tx=pg_current_xact_id_if_assigned() AND backend=pg_backend_pid();
END $$;
CREATE FUNCTION artecna_distruzione.sanifica_archivio(j jsonb,ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE outj jsonb;k text;v jsonb;u uuid;t text;
BEGIN
 IF jsonb_typeof(j)='object' THEN
  outj:='{}';FOR k,v IN SELECT * FROM jsonb_each(j) LOOP
   IF k IN ('cantiere_id','cantiere','economia_riga_id','materiale_cantiere_id','acconto_id') THEN CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM unnest(ids) id WHERE position(id::text IN lower(k))>0) THEN CONTINUE; END IF;
   outj:=outj||jsonb_build_object(k,artecna_distruzione.sanifica_archivio(v,ids));
  END LOOP;RETURN outj;
 ELSIF jsonb_typeof(j)='array' THEN
  SELECT coalesce(jsonb_agg(artecna_distruzione.sanifica_archivio(value,ids)),'[]') INTO outj FROM jsonb_array_elements(j);RETURN outj;
 ELSIF jsonb_typeof(j)='string' THEN
  t:=j#>>'{}';FOREACH u IN ARRAY ids LOOP t:=regexp_replace(t,u::text,'[riferimento operativo rimosso]','gi'); END LOOP;RETURN to_jsonb(t);
 END IF;RETURN j;
END $$;
CREATE FUNCTION artecna_distruzione.ids_operativi(cid uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT array_agg(id) FROM (
  SELECT cid id UNION SELECT e.id FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=cid
  UNION SELECT id FROM public.materiali_cantiere WHERE cantiere_id=cid
  UNION SELECT id FROM public.acconti_cantiere WHERE cantiere_id=cid
 ) q
$$;
CREATE FUNCTION artecna_distruzione.td04_detach_consentito(prima jsonb,dopo jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid:=artecna_distruzione.target_prerequisiti();allowed text[]:=ARRAY['cantiere_id','economia_riga_id','materiale_cantiere_id','archivio_quota_id','fotografia','richiesta'];aid uuid;
BEGIN
 IF cid IS NULL OR (prima->>'cantiere_id' IS NOT NULL AND prima->>'cantiere_id'<>cid::text)
 OR (prima-allowed) IS DISTINCT FROM (dopo-allowed) OR dopo->>'cantiere_id' IS NOT NULL
 OR dopo->>'economia_riga_id' IS NOT NULL OR dopo->>'materiale_cantiere_id' IS NOT NULL THEN RETURN false; END IF;
 IF dopo->'fotografia' IS DISTINCT FROM artecna_distruzione.sanifica_archivio(prima->'fotografia',artecna_distruzione.ids_operativi(cid))
 OR dopo->'richiesta' IS DISTINCT FROM artecna_distruzione.sanifica_archivio(prima->'richiesta',artecna_distruzione.ids_operativi(cid)) THEN RETURN false; END IF;
 IF prima->>'economia_riga_id' IS NOT NULL OR prima->>'materiale_cantiere_id' IS NOT NULL THEN
  aid:=(dopo->>'archivio_quota_id')::uuid;
  RETURN EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare b WHERE b.cantiere_id=cid AND b.archivio_id=aid
   AND b.source_id=coalesce(prima->>'economia_riga_id',prima->>'materiale_cantiere_id')::uuid);
 END IF;
 RETURN dopo->'archivio_quota_id' IS NOT DISTINCT FROM prima->'archivio_quota_id' AND
  (prima->>'cantiere_id'=cid::text OR EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.id IN ((prima->>'nota_riga_id')::uuid,(prima->>'origine_riga_id')::uuid) AND r.cantiere_id=cid));
END $$;
CREATE FUNCTION artecna_distruzione.documento_detach_consentito(prima jsonb,dopo jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT artecna_distruzione.target_prerequisiti() IS NOT NULL
 AND prima->>'cantiere_id'=artecna_distruzione.target_prerequisiti()::text
 AND dopo->>'cantiere_id' IS NULL AND dopo->>'cantiere' IS NULL
 AND (prima-ARRAY['cantiere_id','cantiere'])=(dopo-ARRAY['cantiere_id','cantiere'])
$$;
CREATE FUNCTION artecna_distruzione.archivio_quota_eliminata() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 DELETE FROM artecna_distruzione.quote_da_eliminare WHERE source_table=TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME AND source_id=OLD.id
 AND cantiere_id=artecna_distruzione.target_prerequisiti();
 RETURN NULL;
END $$;
CREATE TRIGGER a_archivio_quota_eliminata AFTER DELETE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_distruzione.archivio_quota_eliminata();
CREATE TRIGGER a_archivio_quota_eliminata AFTER DELETE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_distruzione.archivio_quota_eliminata();

CREATE FUNCTION artecna_distruzione.detach_contabile_cantiere() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid:=artecna_distruzione.target_prerequisiti();r record;q record;aid uuid;ids uuid[];
BEGIN
 IF cid IS NULL THEN RAISE EXCEPTION 'Detach fuori contesto hard-delete' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(714028,1);
 ids:=artecna_distruzione.ids_operativi(cid);
 -- Conservare le quote di fattura anche se non hanno rettifiche: i totali
 -- aziendali non devono liberare disponibilità già contabilizzate.
 FOR q IN SELECT 'public.economia_righe'::text tab,e.id,e.fattura_riga_id,e.quantita,e.quantita*e.prezzo_unitario netto,e.quantita*e.prezzo_unitario costo,e.descrizione
  FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id WHERE c.cantiere_id=cid AND e.fattura_riga_id IS NOT NULL
  UNION ALL SELECT 'public.materiali_cantiere',m.id,m.fattura_riga_id,m.quantita,m.quantita*m.prezzo_unitario,m.totale,m.descrizione
  FROM public.materiali_cantiere m WHERE m.cantiere_id=cid AND m.fattura_riga_id IS NOT NULL LOOP
  IF EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare WHERE source_table=q.tab AND source_id=q.id) THEN CONTINUE; END IF;
  PERFORM 1 FROM public.fatture_fornitori WHERE id=(SELECT fattura_id FROM public.fatture_fornitori_righe WHERE id=q.fattura_riga_id) FOR UPDATE;
  INSERT INTO artecna_contabilita.archivio_quote(tipo,fattura_riga_id,quantita,netto,costo,descrizione)
   VALUES(CASE WHEN q.tab='public.economia_righe' THEN 'economia' ELSE 'materiale' END,q.fattura_riga_id,q.quantita,q.netto,q.costo,
    artecna_distruzione.sanifica_archivio(to_jsonb(q.descrizione),ids)#>>'{}') RETURNING id INTO aid;
  INSERT INTO artecna_distruzione.quote_da_eliminare VALUES(q.tab,q.id,cid,aid);
 END LOOP;
 FOR r IN SELECT x.* FROM public.fornitori_rettifiche x
  LEFT JOIN public.economia_righe e ON e.id=x.economia_riga_id LEFT JOIN public.economia_raccolte c ON c.id=e.raccolta_id
  LEFT JOIN public.materiali_cantiere m ON m.id=x.materiale_cantiere_id
  WHERE x.cantiere_id=cid OR c.cantiere_id=cid OR m.cantiere_id=cid
  ORDER BY x.id FOR UPDATE OF x LOOP
  IF r.cantiere_id IS NOT NULL AND r.cantiere_id<>cid THEN RAISE EXCEPTION 'Rettifica di altro cantiere: riconciliare ownership'; END IF;
  SELECT archivio_id INTO aid FROM artecna_distruzione.quote_da_eliminare WHERE cantiere_id=cid AND source_id=coalesce(r.economia_riga_id,r.materiale_cantiere_id);
  IF (r.economia_riga_id IS NOT NULL OR r.materiale_cantiere_id IS NOT NULL) AND aid IS NULL THEN RAISE EXCEPTION 'Quota TD04 di altro dominio non separabile'; END IF;
  UPDATE public.fornitori_rettifiche SET cantiere_id=NULL,economia_riga_id=NULL,materiale_cantiere_id=NULL,archivio_quota_id=coalesce(aid,archivio_quota_id),
   fotografia=artecna_distruzione.sanifica_archivio(fotografia,ids),richiesta=artecna_distruzione.sanifica_archivio(richiesta,ids) WHERE id=r.id;
 END LOOP;
 FOR r IN SELECT * FROM artecna_contabilita.attribuzioni_clienti WHERE cantiere_id=cid ORDER BY id FOR UPDATE LOOP
  IF NOT EXISTS(SELECT 1 FROM public.fatture_emesse f JOIN public.acconti_cantiere a ON a.id=r.acconto_id WHERE f.id=r.fattura_id AND f.cantiere_id=cid AND a.cantiere_id=cid) THEN RAISE EXCEPTION 'Attribuzione con ownership discordante'; END IF;
  INSERT INTO artecna_contabilita.archivio_attribuzioni(fattura_id,cliente,importo,verificato,creato_at,scollegato)
   VALUES(r.fattura_id,artecna_distruzione.sanifica_archivio(to_jsonb(r.cliente_confermato),ids)#>>'{}',r.importo,r.verificato,r.creato_at,r.scollegato_at IS NOT NULL);
  DELETE FROM artecna_contabilita.attribuzioni_clienti WHERE id=r.id;
 END LOOP;
 UPDATE public.fatture_emesse SET cantiere_id=NULL,cantiere=NULL WHERE cantiere_id=cid;
 UPDATE public.fatture_fornitori_righe SET cantiere_id=NULL,cantiere=NULL WHERE cantiere_id=cid;
 -- Le ricevute di classificazione restano nel dominio globale documento,
 -- ma nessun UUID operativo sopravvive nei loro payload/snapshot.
 UPDATE artecna_guardie.fatture_classificazione_richieste SET
  payload=artecna_distruzione.sanifica_archivio(payload,ids),risultato=artecna_distruzione.sanifica_archivio(risultato,ids)
  WHERE payload::text ~* cid::text OR risultato::text ~* cid::text;
END $$;
CREATE FUNCTION public.leggi_archivio_contabile_cantiere(p_documento uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Archivio contabile non autorizzato' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('quote',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM artecna_contabilita.archivio_quote a
  JOIN public.fatture_fornitori_righe r ON r.id=a.fattura_riga_id WHERE r.fattura_id=p_documento
  AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare b WHERE b.archivio_id=a.id)),'[]'::jsonb),
  'attribuzioni',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM artecna_contabilita.archivio_attribuzioni a WHERE a.fattura_id=p_documento),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.leggi_archivio_contabile_cantiere(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_archivio_contabile_cantiere(uuid) TO authenticated;

-- Patch guardie con fingerprint e corpo precedente conservato: generata in
-- 20261107000500_contabilita_guardie.sql, da applicare prima di usare la capability.
REVOKE ALL ON TABLE artecna_distruzione.contesto_prerequisiti,artecna_distruzione.quote_da_eliminare,
 artecna_contabilita.archivio_quote,artecna_contabilita.archivio_attribuzioni FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='artecna_distruzione'::regnamespace
 AND proname IN ('apri_contesto_prerequisiti','target_prerequisiti','chiudi_contesto_prerequisiti','sanifica_archivio','ids_operativi','td04_detach_consentito','documento_detach_consentito','archivio_quota_eliminata','detach_contabile_cantiere') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION artecna_distruzione.apri_contesto_prerequisiti(uuid,text),artecna_distruzione.chiudi_contesto_prerequisiti(),artecna_distruzione.detach_contabile_cantiere() TO artecna_cantieri_delete_rpc;
COMMIT;
