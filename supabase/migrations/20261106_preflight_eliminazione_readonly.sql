-- Installazione SOLO locale in questo step. Nessuna modifica ai percorsi distruttivi.
BEGIN;
DO $pre$
BEGIN
  IF current_user <> 'postgres'
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('public.quaderno_target_accessibile(text)') IS NULL
    OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
    OR to_regprocedure('public.preflight_eliminazione_sopralluogo(text)') IS NOT NULL
    OR to_regprocedure('public.preflight_eliminazione_cantiere(uuid)') IS NOT NULL
    OR to_regprocedure('artecna_guardie.preflight_dipendenze(text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Prerequisiti preflight non verificati';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid IN (
    'public.quaderno_target_accessibile(text)'::regprocedure,
    'artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)'::regprocedure)
    AND (pg_catalog.pg_get_userbyid(p.proowner)<>'postgres' OR p.prosecdef
      OR p.provolatile<>'s' OR NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp'],false))) THEN
    RAISE EXCEPTION 'Metadata autorizzazioni divergenti';
  END IF;
END $pre$;

-- Helper privato: nessun EXECUTE applicativo. Solo SELECT dinamiche costruite
-- da identificatori di catalogo quotati; valori passati mediante USING.
CREATE FUNCTION artecna_guardie.preflight_dipendenze(p_entita text,p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $body$
DECLARE
  required record; path record; found_dependency boolean;
  categories text[] := ARRAY[]::text[]; category text;
  root_oid oid; root_name text; site_name text; expected text[];
  result jsonb := jsonb_build_object('versione',1,'entita',p_entita,'id',p_id,
    'stato','non_verificabile','verifica_completa',false,'categorie','[]'::jsonb,
    'azione_consigliata','nessuna','verificato_at',statement_timestamp());
BEGIN
  IF p_entita NOT IN ('sopralluogo','cantiere') OR p_id IS NULL THEN RETURN result; END IF;
  root_name := CASE p_entita WHEN 'cantiere' THEN 'cantieri' ELSE 'sopralluoghi' END;
  root_oid := to_regclass(format('public.%I',root_name));
  -- Inventario minimo obbligatorio: mancanza di una relazione attesa NON vale
  -- come assenza di dati. Le FK e i riferimenti aggiuntivi sono censiti sotto.
  expected := CASE p_entita WHEN 'sopralluogo' THEN ARRAY[
    'sopralluoghi.id','foto_sopralluogo.sopralluogo_id','note_sopralluogo.sopralluogo_id',
    'note_allegati.nota_id','quaderno_richiami_sopralluogo.sopralluogo_id',
    'quaderno_copie_allegati.nota_id','quaderno_gestioni.sopralluogo_id',
    'preventivi_cantiere.sopralluogo_id','variante_fonti_visive.foto_sopralluogo_id']
  ELSE ARRAY['cantieri.id','cantieri.nome','cantieri.preventivo','cantieri.origine_preventivo_id',
    'cantieri.preventivo_contrattuale_id','utenti_cantiere.cantiere_id',
    'sal_lavorazioni.cantiere_id','acconti_cantiere.cantiere_id',
    'preventivi_cantiere.cantiere_id','preventivo_lavorazioni.cantiere_id',
    'economia_raccolte.cantiere_id','economia_righe.raccolta_id',
    'varianti_cantiere.cantiere_id','variante_lavorazioni.variante_id',
    'variante_sorgenti.variante_id','variante_documenti.variante_id',
    'fatture_emesse.cantiere_id','incassi_non_fatturati.cantiere_id',
    'fatture_fornitori_righe.cantiere_id','pagamenti_fornitori.cantiere_id',
    'fornitori_rettifiche.cantiere_id','rapportini.cantiere_id',
    'rapportino_prestazioni.rapportino_id','rapportino_materiali.rapportino_id',
    'timbrature.cantiere_id','materiali_cantiere.cantiere_id',
    'attrezzi_cantiere.cantiere_id','foto_cantiere.cantiere_id'] END;
  FOR required IN SELECT split_part(x,'.',1) AS tab,split_part(x,'.',2) AS col
    FROM unnest(expected) x LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname='public' AND c.relname=required.tab AND c.relkind IN ('r','p')
        AND a.attname=required.col AND a.attnum>0 AND NOT a.attisdropped) THEN RETURN result; END IF;
  END LOOP;
  -- Rami indiretti obbligatori: una FK rimossa o non validata non puo
  -- trasformare un figlio non piu raggiungibile in prova di eliminabilita.
  FOR required IN SELECT * FROM (VALUES
    ('sopralluogo','note_allegati','nota_id','note_sopralluogo'),
    ('sopralluogo','quaderno_copie_allegati','nota_id','note_sopralluogo'),
    ('sopralluogo','quaderno_copie_allegati','richiamo_id','quaderno_richiami_sopralluogo'),
    ('sopralluogo','variante_fonti_visive','foto_sopralluogo_id','foto_sopralluogo'),
    ('cantiere','economia_righe','raccolta_id','economia_raccolte'),
    ('cantiere','economia_sorgenti','raccolta_id','economia_raccolte'),
    ('cantiere','variante_lavorazioni','variante_id','varianti_cantiere'),
    ('cantiere','variante_sorgenti','variante_id','varianti_cantiere'),
    ('cantiere','variante_documenti','variante_id','varianti_cantiere'),
    ('cantiere','rapportino_prestazioni','rapportino_id','rapportini'),
    ('cantiere','rapportino_materiali','rapportino_id','rapportini')
  ) m(entita,tab,col,padre) WHERE entita=p_entita LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint k
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey)
      JOIN pg_attribute pa ON pa.attrelid=k.confrelid
        AND pa.attnum=k.confkey[array_position(k.conkey,a.attnum)]
      WHERE k.contype='f' AND k.convalidated
        AND k.conrelid=to_regclass(format('public.%I',required.tab))
        AND k.confrelid=to_regclass(format('public.%I',required.padre))
        AND a.attname=required.col AND pa.attname='id') THEN RETURN result; END IF;
  END LOOP;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id::text=$1)',root_name)
    INTO found_dependency USING p_id;
  IF NOT found_dependency THEN RETURN result; END IF;
  IF p_entita='cantiere' THEN
    SELECT c.nome INTO site_name FROM public.cantieri c WHERE c.id::text=p_id;
    IF EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id::text=p_id AND coalesce(c.preventivo,0)<>0) THEN
      categories := array_append(categories,'economia');
    END IF;
    IF EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id::text=p_id
      AND (c.origine_preventivo_id IS NOT NULL OR c.preventivo_contrattuale_id IS NOT NULL)) THEN
      categories := array_append(categories,'preventivi');
    END IF;
  END IF;

  -- Semi: record radice, riferimenti logici *_id anche senza FK e nomi legacy
  -- (questi ultimi possono solo bloccare, mai provare ownership/eliminabilita).
  -- Poi si percorrono le FK entranti, incluse quelle composite e cross-schema.
  -- Una riga intermedia e gia un blocco: nessuna scrittura/manifest distruttivo.
  FOR path IN
    WITH RECURSIVE seeds AS (
      SELECT root_oid AS rel,format('public.%I t0',root_name) AS joins,
        't0.id::text=$1'::text AS predicate,ARRAY[root_oid] AS visited,0 AS depth,true AS root
      UNION ALL
      SELECT c.oid,format('%I.%I t0',n.nspname,c.relname),
        format('t0.%I::text=%s',a.attname,CASE WHEN a.attname='cantiere' THEN '$2' ELSE '$1' END),
        ARRAY[c.oid],0,false
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.oid<>root_oid
        AND c.relname<>'utenti_cantiere'
        AND a.attname=ANY(CASE p_entita WHEN 'cantiere' THEN ARRAY['cantiere_id','cantiere']
          ELSE ARRAY['sopralluogo_id'] END)
    ), walk AS (
      SELECT * FROM seeds
      UNION ALL
      SELECT k.conrelid,w.joins||format(' JOIN %I.%I t%s ON ',n.nspname,c.relname,w.depth+1)||
        (SELECT string_agg(format('t%s.%I=t%s.%I',w.depth+1,ca.attname,w.depth,pa.attname),' AND ' ORDER BY u.ord)
          FROM unnest(k.conkey,k.confkey) WITH ORDINALITY u(child,parent,ord)
          JOIN pg_attribute ca ON ca.attrelid=k.conrelid AND ca.attnum=u.child
          JOIN pg_attribute pa ON pa.attrelid=k.confrelid AND pa.attnum=u.parent),
        w.predicate,w.visited||k.conrelid,w.depth+1,false
      FROM walk w JOIN pg_constraint k ON k.confrelid=w.rel AND k.contype='f'
        JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE NOT k.conrelid=ANY(w.visited) AND w.depth<12
        AND NOT (n.nspname='public' AND c.relname='utenti_cantiere')
    ) SELECT w.*,c.relname,n.nspname FROM walk w
      JOIN pg_class c ON c.oid=w.rel JOIN pg_namespace n ON n.oid=c.relnamespace
      ORDER BY w.depth,c.oid
  LOOP
    IF path.depth=12 THEN RETURN result; END IF;
    IF path.root THEN CONTINUE; END IF;
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM '||path.joins||' WHERE '||path.predicate||')'
      INTO found_dependency USING p_id,site_name;
    IF NOT found_dependency THEN CONTINUE; END IF;
    category := CASE
      WHEN path.relname LIKE '%sal%' AND path.relname NOT LIKE '%sopralluog%' THEN 'sal'
      WHEN path.relname LIKE '%accont%' THEN 'acconti'
      WHEN path.relname LIKE '%rettif%' THEN 'rettifiche'
      WHEN path.relname LIKE '%incass%' THEN 'incassi'
      WHEN path.relname LIKE '%fattur%' THEN 'fatture'
      WHEN path.relname LIKE '%pagament%' THEN 'pagamenti'
      WHEN path.relname LIKE '%economia%' THEN 'economia'
      WHEN path.relname LIKE '%variante%' OR path.relname LIKE '%varianti%' THEN 'varianti'
      WHEN path.relname LIKE '%preventiv%' THEN 'preventivi'
      WHEN path.relname LIKE '%rapportin%' THEN 'rapportini'
      WHEN path.relname LIKE '%timbratur%' OR path.relname LIKE '%presenz%' THEN 'presenze'
      WHEN path.relname LIKE '%material%' THEN 'materiali'
      WHEN path.relname LIKE '%attrezz%' OR path.relname LIKE '%attrezzi%' THEN 'attrezzature'
      WHEN path.relname LIKE '%foto%' THEN 'foto'
      WHEN path.relname IN ('note_allegati','quaderno_copie_allegati','quaderno_allegati') THEN 'allegati_quaderno'
      WHEN path.relname LIKE '%quaderno%' OR path.relname='note_sopralluogo' THEN 'quaderno'
      WHEN path.relname='cantieri' THEN 'cantieri'
      ELSE 'altri_collegamenti' END;
    IF NOT category=ANY(categories) THEN categories := array_append(categories,category); END IF;
  END LOOP;
  -- Riferimento JSON dimostrato dal reader legacy, fuori dal grafo delle FK.
  IF to_regclass('public.agenda_attivita') IS NULL THEN RETURN result; END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_attivita a
    WHERE a.collegamento @> jsonb_build_object('tipo',p_entita,'id',p_id)) THEN
    categories := array_append(categories,'agenda');
  END IF;
  RETURN result || jsonb_build_object('stato',CASE WHEN cardinality(categories)=0 THEN 'eliminabile' ELSE 'bloccato' END,
    'verifica_completa',true,'categorie',to_jsonb(categories),
    'azione_consigliata',CASE WHEN cardinality(categories)=0 THEN 'conferma_eliminazione'
      WHEN p_entita='cantiere' THEN 'segna_concluso' ELSE 'nessuna' END);
EXCEPTION WHEN query_canceled THEN
  RETURN result;
WHEN OTHERS THEN
  -- Errori e SQL grezzo non escono dal server. Non si restituiscono categorie
  -- parziali: nessuna copertura incompleta puo diventare eliminabile.
  RETURN result;
END $body$;
ALTER FUNCTION artecna_guardie.preflight_dipendenze(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION artecna_guardie.preflight_dipendenze(text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.preflight_eliminazione_sopralluogo(p_sopralluogo_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $body$
DECLARE allowed boolean := false;
BEGIN
  BEGIN
    allowed := auth.uid() IS NOT NULL AND public.quaderno_target_accessibile(p_sopralluogo_id) IS TRUE;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE='42501'; END IF;
  RETURN artecna_guardie.preflight_dipendenze('sopralluogo',p_sopralluogo_id);
END $body$;
ALTER FUNCTION public.preflight_eliminazione_sopralluogo(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.preflight_eliminazione_sopralluogo(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_sopralluogo(text) TO authenticated;

CREATE FUNCTION public.preflight_eliminazione_cantiere(p_cantiere_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $body$
DECLARE allowed boolean := false;
BEGIN
  BEGIN
    allowed := auth.uid() IS NOT NULL AND
      artecna_guardie.utente_puo_modificare_cantiere(auth.uid(),p_cantiere_id) IS TRUE;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE='42501'; END IF;
  RETURN artecna_guardie.preflight_dipendenze('cantiere',p_cantiere_id::text);
END $body$;
ALTER FUNCTION public.preflight_eliminazione_cantiere(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.preflight_eliminazione_cantiere(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_cantiere(uuid) TO authenticated;
DO $acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid IN ('public.preflight_eliminazione_sopralluogo(text)'::regprocedure,
      'public.preflight_eliminazione_cantiere(uuid)'::regprocedure,
      'artecna_guardie.preflight_dipendenze(text,text)'::regprocedure)
      AND a.grantee<>p.proowner
      AND NOT (p.pronamespace='public'::regnamespace AND a.grantee='authenticated'::regrole)) THEN
    RAISE EXCEPTION 'ACL preflight inattese';
  END IF;
END $acl$;
COMMIT;
