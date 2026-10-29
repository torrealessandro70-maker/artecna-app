-- Sicurezza delle sole scritture sulle origini clienti, indipendente dalle quote.
-- Nessuna modifica a importi, storico, guard finanziari o cleanup amministrativo.
BEGIN;
DO $$
DECLARE t regclass; n integer;
BEGIN
 IF current_user <> 'postgres'
 OR to_regnamespace('artecna_clienti_sicurezza') IS NOT NULL
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_operare_impresa(uuid)') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
 OR to_regprocedure('artecna_contabilita.proteggi_origine()') IS NULL
 THEN RAISE EXCEPTION 'Prerequisiti sicurezza sorgenti clienti non verificati'; END IF;
 SELECT count(*) INTO n FROM pg_policy WHERE polrelid='public.fatture_emesse'::regclass;
 IF n<>4 OR EXISTS (
  SELECT 1 FROM pg_policy WHERE polrelid='public.fatture_emesse'::regclass AND NOT (
   polname=ANY(ARRAY['Consenti lettura fatture emesse','Consenti inserimento fatture emesse','Consenti modifica fatture emesse','Consenti eliminazione fatture emesse'])
   AND cardinality(polroles)=2 AND polroles @> ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid]
   AND polpermissive
   AND (polqual IS NULL OR pg_get_expr(polqual,polrelid)='true')
   AND (polwithcheck IS NULL OR pg_get_expr(polwithcheck,polrelid)='true')
  )) OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.acconti_cantiere'::regclass)
 THEN RAISE EXCEPTION 'Policy sorgenti diverse dal catalogo certificato'; END IF;
 FOREACH t IN ARRAY ARRAY['public.fatture_emesse'::regclass,'public.acconti_cantiere'::regclass] LOOP
  IF EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
    WHERE a.attrelid=t AND x.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid))
  THEN RAISE EXCEPTION 'Grant di colonna sorgenti inatteso'; END IF;
 END LOOP;
END $$;

CREATE SCHEMA artecna_clienti_sicurezza;
REVOKE ALL ON SCHEMA artecna_clienti_sicurezza FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA artecna_clienti_sicurezza TO authenticated;
CREATE FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(p_cantiere_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT u.id IS NOT NULL
  AND artecna_guardie.utente_puo_operare_impresa(u.id) IS TRUE
  AND (p_cantiere_id IS NULL
       OR artecna_guardie.utente_puo_modificare_cantiere(u.id,p_cantiere_id) IS TRUE)
 FROM (SELECT artecna_guardie.utente_jwt_corrente() AS id) u
$$;
-- Le origini non ancora assegnate a Cantiere sono documenti d'impresa:
-- titolare attivo, nessun proprietario di riga inventato e nessuna risoluzione per nome.
REVOKE ALL ON FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid) TO authenticated;

REVOKE ALL ON public.fatture_emesse,public.acconti_cantiere FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fatture_emesse,public.acconti_cantiere TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fatture_emesse,public.acconti_cantiere TO authenticated;
-- La lettura legacy non viene estesa o presentata come isolamento cross-user.
-- Owner, service_role e privilegi del cleanup restano quelli esistenti.
ALTER TABLE public.fatture_emesse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acconti_cantiere ENABLE ROW LEVEL SECURITY;

DROP POLICY "Consenti inserimento fatture emesse" ON public.fatture_emesse;
DROP POLICY "Consenti modifica fatture emesse" ON public.fatture_emesse;
DROP POLICY "Consenti eliminazione fatture emesse" ON public.fatture_emesse;
CREATE POLICY "Consenti inserimento fatture emesse" ON public.fatture_emesse FOR INSERT TO authenticated
 WITH CHECK (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));
CREATE POLICY "Consenti modifica fatture emesse" ON public.fatture_emesse FOR UPDATE TO authenticated
 USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id))
 WITH CHECK (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));
CREATE POLICY "Consenti eliminazione fatture emesse" ON public.fatture_emesse FOR DELETE TO authenticated
 USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));
CREATE POLICY clienti_sorgenti_lettura ON public.acconti_cantiere FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY clienti_sorgenti_inserimento ON public.acconti_cantiere FOR INSERT TO authenticated
 WITH CHECK (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));
CREATE POLICY clienti_sorgenti_modifica ON public.acconti_cantiere FOR UPDATE TO authenticated
 USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id))
 WITH CHECK (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));
CREATE POLICY clienti_sorgenti_eliminazione ON public.acconti_cantiere FOR DELETE TO authenticated
 USING (artecna_clienti_sicurezza.puo_scrivere_sorgente(cantiere_id));

DO $$
DECLARE t regclass;
BEGIN
 FOREACH t IN ARRAY ARRAY['public.fatture_emesse'::regclass,'public.acconti_cantiere'::regclass] LOOP
  IF has_table_privilege('anon',t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_table_privilege('authenticated',t,'TRUNCATE,REFERENCES,TRIGGER')
  THEN RAISE EXCEPTION 'Privilegi di scrittura residui non previsti'; END IF;
 END LOOP;
END $$;
COMMIT;
