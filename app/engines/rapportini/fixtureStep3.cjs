// Fixture condivisa STEP 3: esclusivamente database PostgreSQL isolato.
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OP='cccccccc-cccc-4ccc-8ccc-cccccccccccc', OP2='99999999-9999-4999-8999-999999999999'
const RAP='dddddddd-dddd-4ddd-8ddd-dddddddddddd', V='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const USER='11111111-1111-4111-8111-111111111111', TOKEN='ab'.repeat(32)
const fixture=`
CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA artecna_guardie;
CREATE TABLE public.cantieri(id uuid PRIMARY KEY,nome text,lavori_conclusi boolean);
CREATE TABLE public.utenti_cantiere(cantiere_id uuid,user_id uuid,ruolo text);
CREATE TABLE public.operai(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nome text,pin text,stato text,accesso_portale boolean,costo_orario numeric(10,2) DEFAULT 0);
CREATE TABLE public.rapportini(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cantiere_id uuid REFERENCES public.cantieri(id),data date,costo_manodopera double precision DEFAULT 0,
 cantiere text,ore text,operai text,numero_presenti text,ore_per_operaio text,note text,materiali text,quantita_materiali text,compilato_da_operaio_id uuid,compilato_da_nome text,created_at timestamptz DEFAULT now());
CREATE TABLE public.varianti_cantiere(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,numero integer,titolo text NOT NULL,stato text NOT NULL,importo_delta_approvato numeric);
ALTER TABLE public.varianti_cantiere ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.timbrature(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cantiere_id uuid REFERENCES public.cantieri(id),rapportino_id uuid,operaio_id uuid,ora_entrata text,ora_uscita text,data text NOT NULL,pausa_minuti integer NOT NULL DEFAULT 0,operaio_nome text,cantiere text,stato text);
CREATE TABLE public.economia_raccolte(id uuid PRIMARY KEY,revisione bigint);
CREATE TABLE public.economia_righe(id uuid PRIMARY KEY,quantita numeric,prezzo_unitario numeric);
CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere WHERE user_id=$1 AND cantiere_id=$2 AND ruolo='owner') $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
GRANT ALL ON public.rapportini,public.timbrature,public.operai TO anon,authenticated;
GRANT SELECT ON public.cantieri TO anon,authenticated;
INSERT INTO public.cantieri VALUES('${A}','Cantiere A',false),('${B}','Cantiere B',true);
INSERT INTO public.utenti_cantiere VALUES('${A}','${USER}','owner');
INSERT INTO public.operai VALUES('${OP}','Mario','1234','attivo',true,20),('${OP2}','Luigi','5678','attivo',true,30);
INSERT INTO public.rapportini(id,cantiere_id,data,costo_manodopera,ore,operai) VALUES('${RAP}','${A}','2026-09-21',100,'5','Storico');
INSERT INTO public.timbrature(id,cantiere_id,rapportino_id,operaio_id,ora_entrata,ora_uscita,data,pausa_minuti,stato)
 VALUES('${OP}','${A}','${RAP}','${OP}','07:30','12:30','2026-09-21',0,'da rapportino');
INSERT INTO public.varianti_cantiere VALUES('${V}','${A}',1,'Variante A','bozza',175);
INSERT INTO public.economia_raccolte VALUES('${A}',3);
INSERT INTO public.economia_righe VALUES('${B}',5,35);
`
module.exports={fixture,A,B,OP,OP2,RAP,V,USER,TOKEN}
