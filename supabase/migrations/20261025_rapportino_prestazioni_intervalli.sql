BEGIN;

-- Il writer V1 serializza già l'aggregato rapportino. Controllare lo stato finale
-- permette di accorciare una fascia e aggiungere quella consecutiva nello stesso delta.
CREATE FUNCTION artecna_rapportini.verifica_intervalli_prestazioni()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.rapportini WHERE id=NEW.rapportino_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.rapportino_prestazioni a
    JOIN public.rapportino_prestazioni b
      ON b.rapportino_id=a.rapportino_id AND b.operaio_id=a.operaio_id AND a.id<b.id
    WHERE a.rapportino_id=NEW.rapportino_id AND a.rimossa_at IS NULL AND b.rimossa_at IS NULL
      AND a.ora_inizio<b.ora_fine AND b.ora_inizio<a.ora_fine
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='Fasce orarie sovrapposte per lo stesso operaio: correggere le prestazioni';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION artecna_rapportini.verifica_intervalli_prestazioni() FROM PUBLIC,anon,authenticated,service_role;

CREATE CONSTRAINT TRIGGER rapportino_prestazioni_intervalli
AFTER INSERT OR UPDATE ON public.rapportino_prestazioni
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION artecna_rapportini.verifica_intervalli_prestazioni();

COMMIT;
