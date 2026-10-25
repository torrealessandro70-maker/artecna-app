-- Solo lettura Desktop V1 mancante: nessuna modifica a writer o letture portale.
-- Non eseguire insieme alla migrazione storica 20261007_rapportino_desktop_lettura.sql.
BEGIN;
DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regnamespace('artecna_rapportini') IS NULL
    OR (SELECT nspowner FROM pg_namespace WHERE nspname='artecna_rapportini') IS DISTINCT FROM 'postgres'::regrole::oid
    OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
    OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
    OR to_regclass('public.rapportini') IS NULL OR to_regclass('public.rapportino_prestazioni') IS NULL
    OR to_regclass('public.operai') IS NULL OR to_regclass('public.cantieri') IS NULL THEN
    RAISE EXCEPTION 'Dipendenze lettura Desktop assenti o divergenti';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname='leggi_rapportino_desktop')
    OR (n.nspname='artecna_rapportini' AND p.proname='costruisci_lettura_rapportino_v1')) THEN
    RAISE EXCEPTION 'Lettura Desktop gia presente o conflitto di nome: arresto senza sostituzioni';
  END IF;
END;
$preflight$;

CREATE FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id uuid, p_data date, p_rapportino_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE n bigint; v1 boolean; non_supportata boolean; r record; dettaglio jsonb;
BEGIN
  IF p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data < DATE '0001-01-01' OR p_data > DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cantiere e data validi obbligatori';
  END IF;
  IF p_rapportino_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rapportini r0
    WHERE r0.id=p_rapportino_id AND r0.cantiere_id=p_cantiere_id AND r0.data=p_data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.bool_or(r0.versione_prestazioni=1),
    pg_catalog.bool_or(r0.versione_prestazioni IS NULL OR r0.versione_prestazioni NOT IN (0,1))
    INTO n,v1,non_supportata FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data;
  IF non_supportata THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  IF n>1 AND v1 THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino strutturato ambiguo';
  END IF;
  IF n=0 THEN
    RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',false,
      'versione_prestazioni',NULL,'rapportino_id',NULL,'dettaglio',NULL);
  END IF;
  -- V0 storico: ORDER BY created_at DESC (NULLS FIRST implicito) come /stato.
  -- Timestamp uguali: id DESC è lo spareggio deterministico prima non definito.
  -- L'UUID opzionale verifica la scelta; non forza la selezione di un V0 più vecchio.
  SELECT r0.id,r0.versione_prestazioni,r0.revisione_prestazioni,
    r0.note,r0.materiali,r0.quantita_materiali INTO r FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data
    ORDER BY r0.created_at DESC,r0.id DESC LIMIT 1;
  IF p_rapportino_id IS NOT NULL AND p_rapportino_id<>r.id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  dettaglio:=NULL;
  IF r.versione_prestazioni=1 THEN
    dettaglio:=pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',r.id,
      'revisione',r.revisione_prestazioni,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'documento',pg_catalog.jsonb_build_object(
        'note',coalesce(r.note,''),'materiali',coalesce(r.materiali,''),
        'quantita_materiali',coalesce(r.quantita_materiali,'')),
      'prestazioni',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'prestazione_id',p.id,'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,
        'operaio_nome',o.nome,'ora_inizio',pg_catalog.to_char(p.ora_inizio,'HH24:MI'),
        'ora_fine',pg_catalog.to_char(p.ora_fine,'HH24:MI'),'pausa_minuti',p.pausa_minuti,
        'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,
        'ore',p.ore,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
        ORDER BY p.created_at,p.id),'[]'::jsonb)
        FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
        WHERE p.rapportino_id=r.id));
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
    'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',true,
    'versione_prestazioni',r.versione_prestazioni,'rapportino_id',r.id,'dettaglio',dettaglio);
END;
$fn$;


CREATE FUNCTION public.leggi_rapportino_desktop(p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE identita uuid; base jsonb;
BEGIN
  identita:=artecna_guardie.utente_jwt_corrente();
  IF identita IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identità Desktop obbligatoria'; END IF;
  IF p_cantiere_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=p_cantiere_id)
    OR artecna_guardie.utente_puo_modificare_cantiere(identita,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  IF p_versione_lettura IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione lettura non supportata';
  END IF;
  base:=artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id,p_data,p_rapportino_id);
  RETURN base;
END;
$fn$;


-- Elimina anche eventuali grant ereditati dai default privileges, solo sui due oggetti nuovi.
DO $acl$
DECLARE f record; a record;
BEGIN
  FOR f IN SELECT p.oid,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname='leggi_rapportino_desktop')
    OR (n.nspname='artecna_rapportini' AND p.proname='costruisci_lettura_rapportino_v1') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.oid::regprocedure);
    FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=f.oid),acldefault('f',f.proowner)))
      WHERE grantee NOT IN(0,f.proowner) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(a.grantee));
    END LOOP;
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) TO authenticated;

DO $postcheck$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.leggi_rapportino_desktop(uuid,date,uuid,smallint)'::regprocedure
    AND provolatile='s' AND prosecdef AND proowner='postgres'::regrole)
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid)'::regprocedure
    AND provolatile='s' AND NOT prosecdef AND proowner='postgres'::regrole)
    OR NOT has_function_privilege('authenticated','public.leggi_rapportino_desktop(uuid,date,uuid,smallint)','EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE ((n.nspname='public' AND p.proname='leggi_rapportino_desktop'
          AND a.grantee NOT IN('postgres'::regrole,'authenticated'::regrole))
        OR (n.nspname='artecna_rapportini' AND p.proname='costruisci_lettura_rapportino_v1'
          AND a.grantee <> 'postgres'::regrole))) THEN
    RAISE EXCEPTION 'Postcheck struttura/ACL lettura Desktop fallito';
  END IF;
END;
$postcheck$;
COMMIT;
