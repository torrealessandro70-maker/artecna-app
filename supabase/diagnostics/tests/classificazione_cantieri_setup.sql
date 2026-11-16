\set ON_ERROR_STOP on
ALTER TABLE public.cantieri ADD COLUMN lavori_conclusi boolean;
CREATE SCHEMA artecna_distruzione;
CREATE SCHEMA artecna_guardie;
CREATE ROLE anon;
CREATE ROLE service_role;
CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT $1 = '10000000-0000-0000-0000-000000000001'::uuid
    AND $2 IN ('30000000-0000-0000-0000-000000000002'::uuid,'30000000-0000-0000-0000-000000000004'::uuid,'30000000-0000-0000-0000-000000000007'::uuid)
$$;
CREATE FUNCTION artecna_distruzione.hard_delete_catalog() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT md5(string_agg(attname,',' ORDER BY attnum)) FROM pg_attribute
 WHERE attrelid='public.cantieri'::regclass AND attnum>0 AND NOT attisdropped
$$;
CREATE TABLE artecna_distruzione.hard_delete_catalog_expected(signature text);
INSERT INTO artecna_distruzione.hard_delete_catalog_expected SELECT artecna_distruzione.hard_delete_catalog();

CREATE TABLE public.fatture_classificazione_fixture (id integer PRIMARY KEY, cantiere uuid, credito_documentato numeric, iva numeric, ricevuto numeric);
INSERT INTO public.fatture_classificazione_fixture VALUES
 (1,'30000000-0000-0000-0000-000000000002',100,22,0),
 (2,'30000000-0000-0000-0000-000000000007',10000,909.09,10000),
 (3,'30000000-0000-0000-0000-000000000004',110,10,0);
GRANT UPDATE ON public.cantieri TO authenticated;
CREATE POLICY sites_update ON public.cantieri FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
