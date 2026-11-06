-- Solo database locale effimero dei test; nessun collegamento Production.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE ROLE outsider;
CREATE SCHEMA auth;
CREATE SCHEMA artecna_guardie;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.sopralluoghi(id text PRIMARY KEY);
CREATE TABLE public.cantieri(id uuid PRIMARY KEY,nome text,preventivo double precision DEFAULT 0,
 origine_preventivo_id uuid,preventivo_contrattuale_id uuid);
CREATE TABLE public.utenti_cantiere(cantiere_id uuid REFERENCES public.cantieri(id),user_id uuid,ruolo text);
CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(p_user_id uuid,p_cantiere_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere u WHERE p_user_id IS NOT NULL
  AND p_cantiere_id IS NOT NULL AND u.user_id=p_user_id AND u.cantiere_id=p_cantiere_id AND u.ruolo='owner')
$$;
GRANT SELECT ON public.sopralluoghi TO authenticated;
CREATE FUNCTION public.quaderno_target_accessibile(p_sopralluogo text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND has_table_privilege('authenticated','public.sopralluoghi','SELECT')
 AND NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.sopralluoghi'::regclass)
 AND EXISTS(SELECT 1 FROM public.sopralluoghi WHERE id::text=p_sopralluogo)
$$;
CREATE TABLE public.foto_sopralluogo(id uuid PRIMARY KEY,sopralluogo_id text REFERENCES public.sopralluoghi(id));
CREATE TABLE public.note_sopralluogo(id uuid PRIMARY KEY,sopralluogo_id text,user_id uuid);
CREATE TABLE public.note_allegati(id uuid PRIMARY KEY,nota_id uuid REFERENCES public.note_sopralluogo(id));
CREATE TABLE public.quaderno_richiami_sopralluogo(id uuid PRIMARY KEY,sopralluogo_id text,nota_id uuid REFERENCES public.note_sopralluogo(id));
CREATE TABLE public.quaderno_copie_allegati(id uuid PRIMARY KEY,nota_id uuid REFERENCES public.note_sopralluogo(id),richiamo_id uuid REFERENCES public.quaderno_richiami_sopralluogo(id));
CREATE TABLE public.quaderno_gestioni(id uuid PRIMARY KEY,sopralluogo_id text);
CREATE TABLE public.preventivi_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),sopralluogo_id text,cantiere text);
ALTER TABLE public.cantieri ADD FOREIGN KEY(origine_preventivo_id) REFERENCES public.preventivi_cantiere(id);
ALTER TABLE public.cantieri ADD FOREIGN KEY(preventivo_contrattuale_id) REFERENCES public.preventivi_cantiere(id);
CREATE TABLE public.sal_lavorazioni(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),preventivo_id uuid REFERENCES public.preventivi_cantiere(id),cantiere text);
CREATE TABLE public.preventivo_lavorazioni(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),preventivo_id uuid REFERENCES public.preventivi_cantiere(id),cantiere text);
CREATE TABLE public.acconti_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.economia_raccolte(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.economia_righe(id uuid PRIMARY KEY,raccolta_id uuid REFERENCES public.economia_raccolte(id));
CREATE TABLE public.economia_sorgenti(id uuid PRIMARY KEY,raccolta_id uuid REFERENCES public.economia_raccolte(id));
CREATE TABLE public.varianti_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),stato text);
CREATE TABLE public.variante_lavorazioni(id uuid PRIMARY KEY,variante_id uuid REFERENCES public.varianti_cantiere(id));
CREATE TABLE public.variante_sorgenti(id uuid PRIMARY KEY,variante_id uuid REFERENCES public.varianti_cantiere(id));
CREATE TABLE public.variante_documenti(id uuid PRIMARY KEY,variante_id uuid REFERENCES public.varianti_cantiere(id));
CREATE TABLE public.variante_fonti_visive(id uuid PRIMARY KEY,variante_id uuid REFERENCES public.varianti_cantiere(id),foto_sopralluogo_id uuid REFERENCES public.foto_sopralluogo(id));
CREATE TABLE public.fatture_emesse(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.incassi_non_fatturati(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.fatture_fornitori(id uuid PRIMARY KEY,cantiere text);
CREATE TABLE public.fatture_fornitori_righe(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),fattura_id uuid REFERENCES public.fatture_fornitori(id));
CREATE TABLE public.pagamenti_fornitori(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.fornitori_rettifiche(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),origine_riga_id uuid REFERENCES public.fatture_fornitori_righe(id));
CREATE TABLE public.rapportini(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.rapportino_prestazioni(id uuid PRIMARY KEY,rapportino_id uuid REFERENCES public.rapportini(id));
CREATE TABLE public.rapportino_materiali(id uuid PRIMARY KEY,rapportino_id uuid REFERENCES public.rapportini(id));
CREATE TABLE public.timbrature(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.materiali_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.attrezzi_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.foto_cantiere(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id));
CREATE TABLE public.agenda_attivita(id uuid PRIMARY KEY,collegamento jsonb);
CREATE SCHEMA artecna_rapportini;
CREATE TABLE artecna_rapportini.allegati(id uuid PRIMARY KEY,rapportino_id uuid REFERENCES public.rapportini(id),cantiere_id uuid REFERENCES public.cantieri(id));
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.note_sopralluogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_proprie ON public.note_sopralluogo FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER TABLE public.acconti_cantiere ENABLE ROW LEVEL SECURITY;
CREATE POLICY acconti_nascosti ON public.acconti_cantiere FOR SELECT TO authenticated USING(false);
-- Simula i default ACL Supabase: la migration deve rimuoverli dalle nuove RPC.
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
