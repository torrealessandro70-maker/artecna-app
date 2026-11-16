\set ON_ERROR_STOP on
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('10000000-0000-0000-0000-000000000001');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT current_setting('request.jwt.claim.sub', true)::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE cantieri (id uuid PRIMARY KEY, nome text, preventivo_contrattuale_id uuid);
CREATE TABLE preventivi_cantiere (id uuid PRIMARY KEY, cantiere_id uuid, natura text, importo_totale numeric);
GRANT SELECT ON cantieri, preventivi_cantiere TO authenticated;
ALTER TABLE cantieri ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventivi_cantiere ENABLE ROW LEVEL SECURITY;
CREATE POLICY sites ON cantieri FOR SELECT TO authenticated USING (true);
CREATE POLICY docs ON preventivi_cantiere FOR SELECT TO authenticated
  USING (id <> '20000000-0000-0000-0000-000000000008');
INSERT INTO cantieri VALUES
 ('30000000-0000-0000-0000-000000000001','TESTA GIANNI',null),
 ('30000000-0000-0000-0000-000000000002','TORRE Alessandro',null),
 ('30000000-0000-0000-0000-000000000003','BELLUOMO MARIO','20000000-0000-0000-0000-000000000003'),
 ('30000000-0000-0000-0000-000000000004','Avv. PERNICONE sub 13','20000000-0000-0000-0000-000000000004'),
 ('30000000-0000-0000-0000-000000000007','TESTA ANTONINO','20000000-0000-0000-0000-000000000007');
INSERT INTO preventivi_cantiere VALUES
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',null,40),
 ('20000000-0000-0000-0000-000000000004',null,null,50),
 ('20000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000007',null,60);
CREATE FUNCTION leggi_varianti_cantiere(uuid) RETURNS TABLE (id uuid, numero int, stato text, cantiere_id uuid, preventivo_contrattuale_id uuid)
LANGUAGE sql STABLE AS $$ SELECT '40000000-0000-0000-0000-000000000007'::uuid, 7, 'approvata', $1, c.preventivo_contrattuale_id FROM public.cantieri c WHERE c.id = $1 $$;
CREATE FUNCTION leggi_sorgenti_variante(uuid) RETURNS TABLE (id uuid, tipo text)
LANGUAGE sql STABLE AS $$ SELECT '50000000-0000-0000-0000-000000000007'::uuid, 'raccolta_economia' $$;
CREATE FUNCTION leggi_sorgente_variante(uuid)
RETURNS TABLE (id uuid, variante_id uuid, economia_raccolta_id uuid, economia_revisione_congelata int, snapshot jsonb)
LANGUAGE sql STABLE AS $$
 SELECT $1, '40000000-0000-0000-0000-000000000007'::uuid, '60000000-0000-0000-0000-000000000007'::uuid, 9,
 '{"raccolta_id":"60000000-0000-0000-0000-000000000007","cantiere_id":"30000000-0000-0000-0000-000000000007","revisione_congelata":9}'::jsonb
$$;
CREATE FUNCTION leggi_raccolte_economia(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object('numero',7,'id','60000000-0000-0000-0000-000000000007','cantiere_id',$1,'revisione',9))
$$;
ALTER TABLE preventivi_cantiere ADD COLUMN cantiere text, ADD COLUMN approvato boolean;
CREATE TABLE sal_lavorazioni (cantiere_id uuid, source_lavorazione_id bigint, source_variante_lavorazione_id bigint);
CREATE TABLE preventivo_lavorazioni (id bigint PRIMARY KEY, cantiere_id uuid, preventivo_id uuid);
CREATE TABLE variante_lavorazioni (id bigint PRIMARY KEY, variante_id uuid);
CREATE TABLE varianti_cantiere (id uuid PRIMARY KEY, cantiere_id uuid, stato text, preventivo_contrattuale_id uuid);
