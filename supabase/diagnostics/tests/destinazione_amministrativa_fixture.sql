-- Prototipo di persistenza: eseguire solo sul database sintetico della fixture.
BEGIN;
ALTER TABLE public.cantieri ADD COLUMN destinazione_amministrativa text NOT NULL DEFAULT 'da_classificare'
 CHECK (destinazione_amministrativa IN ('lavori_contrattuali','archivio_acquisti_personali','da_classificare'));
CREATE TABLE public.fatture_fixture (
 id bigint PRIMARY KEY, cantiere_id uuid NOT NULL, costo numeric NOT NULL, iva numeric NOT NULL
);
INSERT INTO public.fatture_fixture VALUES
 (1,'30000000-0000-0000-0000-000000000002',100,22),
 (2,'30000000-0000-0000-0000-000000000007',200,44);

DO $test$
DECLARE
 prima jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(f) ORDER BY id) INTO prima FROM public.fatture_fixture f;
 UPDATE public.cantieri SET nome = 'Omonimo'
 WHERE id IN ('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000007');
 UPDATE public.cantieri SET destinazione_amministrativa = 'archivio_acquisti_personali'
 WHERE id = '30000000-0000-0000-0000-000000000002';
 UPDATE public.cantieri SET destinazione_amministrativa = 'lavori_contrattuali'
 WHERE id = '30000000-0000-0000-0000-000000000007';

 IF (SELECT count(*) FROM public.cantieri WHERE nome='Omonimo'
     AND destinazione_amministrativa='archivio_acquisti_personali' AND preventivo_contrattuale_id IS NULL) <> 1
 OR (SELECT count(*) FROM public.cantieri WHERE nome='Omonimo'
     AND destinazione_amministrativa='lavori_contrattuali' AND preventivo_contrattuale_id IS NOT NULL) <> 1
 OR (SELECT count(*) FROM public.cantieri WHERE destinazione_amministrativa='da_classificare') <> 3
 OR prima IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.fatture_fixture f)
 THEN RAISE EXCEPTION 'Classificazione UUID o conservazione fatture divergente'; END IF;

 BEGIN
   UPDATE public.cantieri SET destinazione_amministrativa = 'sconosciuta'
   WHERE id = '30000000-0000-0000-0000-000000000002';
   RAISE EXCEPTION 'Destinazione invalida accettata';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END
$test$;
ROLLBACK;
