-- Riservatezza delle sorgenti clienti: stesso contesto aziendale dei writer.
-- Ordine: attribuzioni -> sicurezza scritture -> questa migrazione.
-- Nessuna modifica a dati, funzioni, writer, storico o calcoli.
BEGIN;
DO $$
DECLARE t regclass; n integer;
BEGIN
 IF current_user <> 'postgres'
 OR to_regprocedure('artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid)') IS NULL
 OR to_regprocedure('artecna_contabilita.proteggi_origine()') IS NULL
 THEN RAISE EXCEPTION 'Prerequisiti lettura sorgenti clienti non verificati'; END IF;
 FOREACH t IN ARRAY ARRAY['public.fatture_emesse'::regclass,'public.acconti_cantiere'::regclass] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t AND relrowsecurity AND relowner=current_user::regrole)
  THEN RAISE EXCEPTION 'Owner/RLS sorgenti diversi dal catalogo certificato'; END IF;
  SELECT count(*) INTO n FROM pg_policy WHERE polrelid=t;
  IF n<>4 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t AND NOT coalesce((
   polpermissive AND (
    (polcmd='r' AND polname=CASE WHEN t='public.fatture_emesse'::regclass THEN 'Consenti lettura fatture emesse' ELSE 'clienti_sorgenti_lettura' END
     AND cardinality(polroles)=2 AND polroles @> ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid]
     AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL)
    OR (polcmd=ANY(ARRAY['a','w','d']::"char"[]) AND cardinality(polroles)=1 AND polroles=ARRAY['authenticated'::regrole::oid]
     AND polname=CASE polcmd
      WHEN 'a' THEN CASE WHEN t='public.fatture_emesse'::regclass THEN 'Consenti inserimento fatture emesse' ELSE 'clienti_sorgenti_inserimento' END
      WHEN 'w' THEN CASE WHEN t='public.fatture_emesse'::regclass THEN 'Consenti modifica fatture emesse' ELSE 'clienti_sorgenti_modifica' END
      WHEN 'd' THEN CASE WHEN t='public.fatture_emesse'::regclass THEN 'Consenti eliminazione fatture emesse' ELSE 'clienti_sorgenti_eliminazione' END END
     AND (CASE WHEN polcmd='a' THEN polqual IS NULL ELSE pg_get_expr(polqual,polrelid)='artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id)' END)
     AND (CASE WHEN polcmd='d' THEN polwithcheck IS NULL ELSE pg_get_expr(polwithcheck,polrelid)='artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id)' END))
   )),false))
  THEN RAISE EXCEPTION 'Policy sorgenti diverse dalla sicurezza scritture certificata'; END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
   WHERE a.attrelid=t AND x.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid))
  THEN RAISE EXCEPTION 'Grant di colonna sorgenti inatteso'; END IF;
  IF EXISTS(SELECT 1 FROM pg_depend d JOIN pg_rewrite w ON w.oid=d.objid
   JOIN pg_class v ON v.oid=w.ev_class
   WHERE d.classid='pg_rewrite'::regclass AND d.refclassid='pg_class'::regclass
    AND d.refobjid=t AND v.relkind IN ('v','m'))
  THEN RAISE EXCEPTION 'Vista dipendente dalle sorgenti non certificata'; END IF;
 END LOOP;
END $$;

REVOKE SELECT ON public.fatture_emesse,public.acconti_cantiere FROM PUBLIC,anon;
-- Il helper richiede JWT, titolare attivo e, se presente, owner del Cantiere.
-- NULL resta un documento d'impresa accessibile al titolare attivo, come nei writer;
-- il nome storico non viene usato per dedurre o assegnare un proprietario.
ALTER POLICY "Consenti lettura fatture emesse" ON public.fatture_emesse
 TO authenticated USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));
ALTER POLICY clienti_sorgenti_lettura ON public.acconti_cantiere
 TO authenticated USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));

DO $$
DECLARE t regclass;
BEGIN
 FOREACH t IN ARRAY ARRAY['public.fatture_emesse'::regclass,'public.acconti_cantiere'::regclass] LOOP
  IF has_table_privilege('anon',t,'SELECT') OR NOT has_table_privilege('authenticated',t,'SELECT')
   OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t AND polcmd='*')
  THEN RAISE EXCEPTION 'Permessi residui lettura sorgenti non previsti'; END IF;
 END LOOP;
END $$;
COMMIT;
