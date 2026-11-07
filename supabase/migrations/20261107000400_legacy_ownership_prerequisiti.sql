-- Normalizzazione locale preparata; nessuna DELETE per nome.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
ALTER TABLE public.memoria_prezzi ADD COLUMN cantiere_id uuid REFERENCES public.cantieri(id) ON DELETE RESTRICT;
CREATE INDEX memoria_prezzi_cantiere_uuid ON public.memoria_prezzi(cantiere_id);
CREATE TABLE artecna_distruzione.legacy_sorgenti(tabella text PRIMARY KEY,relation regclass NOT NULL UNIQUE);
INSERT INTO artecna_distruzione.legacy_sorgenti SELECT 'public.'||n,('public.'||n)::regclass FROM unnest(ARRAY[
 'preventivi_cantiere','preventivo_lavorazioni','sal_lavorazioni','rapportini','foto_cantiere','pagamenti_fornitori',
 'acconti_cantiere','incassi_non_fatturati','fatture_emesse','fatture_fornitori_righe','memoria_prezzi','materiali_cantiere','attrezzi_cantiere','timbrature']) n;
CREATE TABLE artecna_distruzione.legacy_da_risolvere (
 tabella text NOT NULL REFERENCES artecna_distruzione.legacy_sorgenti(tabella),source_id text NOT NULL,
 impronta text NOT NULL,stato text NOT NULL DEFAULT 'da_risolvere' CHECK(stato='da_risolvere'),
 approved_cantiere uuid REFERENCES public.cantieri(id) ON DELETE RESTRICT,approved_owner uuid,
 PRIMARY KEY(tabella,source_id),CHECK((approved_cantiere IS NULL)=(approved_owner IS NULL))
);
CREATE FUNCTION artecna_distruzione.legacy_derivazione(tab text,j jsonb) RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE ids uuid[]:='{}';v uuid; BEGIN
 IF tab='public.preventivo_lavorazioni' THEN
  SELECT cantiere_id INTO v FROM public.preventivi_cantiere WHERE id::text=j->>'preventivo_id';IF v IS NOT NULL THEN ids:=array_append(ids,v); END IF;
 ELSIF tab='public.sal_lavorazioni' THEN
  SELECT cantiere_id INTO v FROM public.preventivo_lavorazioni WHERE id::text=j->>'source_lavorazione_id';IF v IS NOT NULL THEN ids:=array_append(ids,v); END IF;
  SELECT c.cantiere_id INTO v FROM public.variante_lavorazioni l JOIN public.varianti_cantiere c ON c.id=l.variante_id WHERE l.id::text=j->>'source_variante_lavorazione_id';IF v IS NOT NULL THEN ids:=array_append(ids,v); END IF;
 ELSIF tab='public.timbrature' THEN
  SELECT r.cantiere_id INTO v FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id WHERE p.id::text=j->>'prestazione_rapportino_id';IF v IS NOT NULL THEN ids:=array_append(ids,v); END IF;
 ELSIF tab='public.foto_cantiere' THEN
  SELECT cantiere_id INTO v FROM artecna_rapportini.allegati WHERE id::text=j->>'allegato_v1_id';IF v IS NOT NULL THEN ids:=array_append(ids,v); END IF;
 END IF;
 RETURN ARRAY(SELECT DISTINCT u FROM unnest(ids) u);
END $$;
CREATE FUNCTION artecna_distruzione.normalizza_legacy_cantiere() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s record;r record;ids uuid[];cid uuid;n bigint:=0;
BEGIN
 -- Admin-only backfill. Unique-name inference is explicitly authorized by this
 -- normalization contract, never used as a DELETE predicate.
 LOCK TABLE public.cantieri IN SHARE ROW EXCLUSIVE MODE;
 FOR s IN SELECT * FROM artecna_distruzione.legacy_sorgenti ORDER BY tabella LOOP
  EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',s.relation);
  FOR r IN EXECUTE format('SELECT id::text id,to_jsonb(t) j FROM %s t WHERE cantiere_id IS NULL ORDER BY id FOR UPDATE',s.relation) LOOP
   ids:=artecna_distruzione.legacy_derivazione(s.tabella,r.j);cid:=NULL;
   IF cardinality(ids)=1 THEN cid:=ids[1];
   ELSIF cardinality(ids)=0 THEN
    SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] END INTO cid FROM public.cantieri WHERE nome=r.j->>'cantiere';
   END IF;
   IF cid IS NOT NULL THEN
    BEGIN
     EXECUTE format('UPDATE %s SET cantiere_id=$1 WHERE id::text=$2 AND cantiere_id IS NULL',s.relation) USING cid,r.id;
     DELETE FROM artecna_distruzione.legacy_da_risolvere WHERE tabella=s.tabella AND source_id=r.id;n:=n+1;
     CONTINUE;
    EXCEPTION WHEN check_violation OR foreign_key_violation OR insufficient_privilege OR object_not_in_prerequisite_state THEN
     -- Preserve the record; the original domain guard still decides whether
     -- the normalization is compatible. Never disable it to force a backfill.
    END;
   END IF;
   INSERT INTO artecna_distruzione.legacy_da_risolvere(tabella,source_id,impronta) VALUES(s.tabella,r.id,md5(r.j::text))
    ON CONFLICT(tabella,source_id) DO UPDATE SET impronta=EXCLUDED.impronta,
     approved_cantiere=CASE WHEN legacy_da_risolvere.impronta=EXCLUDED.impronta THEN legacy_da_risolvere.approved_cantiere END,
     approved_owner=CASE WHEN legacy_da_risolvere.impronta=EXCLUDED.impronta THEN legacy_da_risolvere.approved_owner END;
  END LOOP;
 END LOOP;RETURN n;
END $$;
CREATE FUNCTION artecna_distruzione.approva_risoluzione_legacy(tab text,rid text,cid uuid,owner_id uuid,expected text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s regclass;j jsonb; BEGIN
 SELECT relation INTO STRICT s FROM artecna_distruzione.legacy_sorgenti WHERE tabella=tab;
 EXECUTE format('LOCK TABLE %s IN ROW EXCLUSIVE MODE',s);
 PERFORM 1 FROM artecna_distruzione.legacy_da_risolvere WHERE tabella=tab AND source_id=rid FOR UPDATE;
 IF artecna_guardie.utente_puo_modificare_cantiere(owner_id,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner destinatario non valido' USING ERRCODE='42501'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM %s t WHERE id::text=$1 FOR UPDATE',s) INTO j USING rid;
 IF j IS NULL OR j->>'cantiere_id' IS NOT NULL OR md5(j::text)<>expected THEN RAISE EXCEPTION 'Record legacy cambiato' USING ERRCODE='40001'; END IF;
 INSERT INTO artecna_distruzione.legacy_da_risolvere(tabella,source_id,impronta,approved_cantiere,approved_owner)
 VALUES(tab,rid,expected,cid,owner_id) ON CONFLICT(tabella,source_id) DO UPDATE
 SET impronta=EXCLUDED.impronta,approved_cantiere=EXCLUDED.approved_cantiere,approved_owner=EXCLUDED.approved_owner;
END $$;
CREATE FUNCTION public.assegna_legacy_cantiere(p_tabella text,p_id text,p_cantiere uuid,p_impronta text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente();s regclass;j jsonb;approval artecna_distruzione.legacy_da_risolvere;ids uuid[];
BEGIN
 IF u IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT relation INTO STRICT s FROM artecna_distruzione.legacy_sorgenti WHERE tabella=p_tabella;
 EXECUTE format('LOCK TABLE %s IN ROW EXCLUSIVE MODE',s);
 PERFORM id FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
 PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO approval FROM artecna_distruzione.legacy_da_risolvere WHERE tabella=p_tabella AND source_id=p_id FOR UPDATE;
 EXECUTE format('SELECT to_jsonb(t) FROM %s t WHERE id::text=$1 FOR UPDATE',s) INTO j USING p_id;
 IF j->>'cantiere_id'=p_cantiere::text THEN RETURN true; END IF; -- authorized retry
 IF j IS NULL OR j->>'cantiere_id' IS NOT NULL THEN RAISE EXCEPTION 'Record già assegnato o assente' USING ERRCODE='42501'; END IF;
 -- A target owner alone cannot claim another owner's ambiguous data. A private
 -- reviewer must bind the row fingerprint and chosen owner/target first.
 IF approval.approved_owner IS DISTINCT FROM u OR approval.approved_cantiere IS DISTINCT FROM p_cantiere THEN
  IF NOT EXISTS(SELECT 1 FROM public.cantieri c WHERE c.nome=j->>'cantiere' AND c.id=p_cantiere)
   OR EXISTS(SELECT 1 FROM public.cantieri c WHERE c.nome=j->>'cantiere' AND artecna_guardie.utente_puo_modificare_cantiere(u,c.id) IS DISTINCT FROM true) THEN
   RAISE EXCEPTION 'Risoluzione ownership da autorizzare' USING ERRCODE='42501'; END IF;
 ELSE
  IF p_impronta IS DISTINCT FROM approval.impronta THEN RAISE EXCEPTION 'Record legacy cambiato' USING ERRCODE='40001'; END IF;
 END IF;
 IF md5(j::text) IS DISTINCT FROM p_impronta THEN RAISE EXCEPTION 'Record legacy cambiato' USING ERRCODE='40001'; END IF;
 ids:=artecna_distruzione.legacy_derivazione(p_tabella,j);
 IF cardinality(ids)>1 OR (cardinality(ids)=1 AND ids[1]<>p_cantiere) THEN RAISE EXCEPTION 'Derivazione canonica discordante' USING ERRCODE='23514'; END IF;
 EXECUTE format('UPDATE %s SET cantiere_id=$1 WHERE id::text=$2 AND cantiere_id IS NULL',s) USING p_cantiere,p_id;
 DELETE FROM artecna_distruzione.legacy_da_risolvere WHERE tabella=p_tabella AND source_id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON TABLE artecna_distruzione.legacy_sorgenti,artecna_distruzione.legacy_da_risolvere FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION artecna_distruzione.legacy_derivazione(text,jsonb),artecna_distruzione.normalizza_legacy_cantiere(),artecna_distruzione.approva_risoluzione_legacy(text,text,uuid,uuid,text),public.assegna_legacy_cantiere(text,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assegna_legacy_cantiere(text,text,uuid,text) TO authenticated;
SELECT artecna_distruzione.normalizza_legacy_cantiere();
COMMIT;
