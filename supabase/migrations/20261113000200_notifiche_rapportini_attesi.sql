BEGIN;

CREATE UNIQUE INDEX evento_rapportino_atteso_termine
  ON artecna_notifiche.evento_notificabile (record_id, data_evento)
  WHERE modulo = 'rapportini' AND tipo_record = 'rapportino_atteso';

ALTER TABLE artecna_notifiche.preferenze_notifiche
  ADD COLUMN rapportini boolean NOT NULL DEFAULT true;

CREATE FUNCTION artecna_notifiche.genera_rapportini_attesi(p_ora timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_cantiere uuid;
  v_atteso record;
  v_evento uuid;
  v_titolo text;
  v_righe integer;
  v_inserite integer := 0;
BEGIN
  FOR v_cantiere IN
    SELECT c.id FROM public.cantieri c
    WHERE EXISTS (SELECT FROM artecna_rapportini.attesi a WHERE a.cantiere_id = c.id)
    ORDER BY c.id FOR UPDATE OF c SKIP LOCKED
  LOOP
    FOR v_atteso IN
      SELECT a.*, artecna_rapportini.esito_atteso(a.cantiere_id,a.giorno_lavoro) AS esito
      FROM artecna_rapportini.attesi a
      WHERE a.cantiere_id = v_cantiere ORDER BY a.id
    LOOP
      UPDATE artecna_notifiche.evento_notificabile e SET resolved_at=p_ora,updated_at=p_ora
      WHERE e.modulo='rapportini' AND e.tipo_record='rapportino_atteso'
        AND e.record_id=v_atteso.id AND e.resolved_at IS NULL
        AND (e.data_evento<>v_atteso.termine_at OR v_atteso.esito='soddisfatto'
          OR NOT artecna_rapportini.avvisi_attesi_attivi(v_cantiere,p_ora)
          OR p_ora<v_atteso.termine_at
          OR (v_atteso.rilevante_fino_at IS NOT NULL AND p_ora>=v_atteso.rilevante_fino_at));

      UPDATE artecna_notifiche.notifica n SET resolved_at=p_ora,updated_at=p_ora
      FROM artecna_notifiche.evento_notificabile e
      WHERE n.evento_id=e.id AND e.modulo='rapportini' AND e.tipo_record='rapportino_atteso'
        AND e.record_id=v_atteso.id AND n.resolved_at IS NULL
        AND (e.resolved_at IS NOT NULL
          OR NOT artecna_guardie.utente_puo_modificare_cantiere(n.recipient_user_id,v_cantiere)
          OR EXISTS (SELECT FROM artecna_notifiche.preferenze_notifiche p
            WHERE p.user_id=n.recipient_user_id AND NOT (p.generali AND p.in_app AND p.rapportini)));

      IF v_atteso.esito='soddisfatto'
        OR NOT artecna_rapportini.avvisi_attesi_attivi(v_cantiere,p_ora)
        OR p_ora<v_atteso.termine_at
        OR (v_atteso.rilevante_fino_at IS NOT NULL AND p_ora>=v_atteso.rilevante_fino_at) THEN
        CONTINUE;
      END IF;

      v_titolo := CASE v_atteso.esito WHEN 'mancante' THEN 'Rapportino mancante'
        WHEN 'da_chiudere' THEN 'Rapportino da chiudere' ELSE 'Rapportino da classificare' END;
      INSERT INTO artecna_notifiche.evento_notificabile
        (modulo,tipo_record,record_id,tipo_evento,data_evento,revisione_sorgente,ambito)
      VALUES ('rapportini','rapportino_atteso',v_atteso.id,'obbligo_rapportino',
        v_atteso.termine_at,v_atteso.revisione,'impresa')
      ON CONFLICT (record_id,data_evento) WHERE modulo='rapportini' AND tipo_record='rapportino_atteso'
      DO UPDATE SET resolved_at=NULL, revisione_sorgente=excluded.revisione_sorgente,updated_at=p_ora
      RETURNING id INTO v_evento;

      UPDATE artecna_notifiche.notifica n SET titolo=v_titolo,resolved_at=NULL,updated_at=p_ora
      WHERE n.evento_id=v_evento
        AND artecna_guardie.utente_puo_modificare_cantiere(n.recipient_user_id,v_cantiere)
        AND NOT EXISTS (SELECT FROM artecna_notifiche.preferenze_notifiche p
          WHERE p.user_id=n.recipient_user_id AND NOT (p.generali AND p.in_app AND p.rapportini))
        AND (n.resolved_at IS NOT NULL OR n.titolo IS DISTINCT FROM v_titolo);

      INSERT INTO artecna_notifiche.notifica
        (evento_id,recipient_user_id,titolo,messaggio,priorita,tipo_avviso,scheduled_at,published_at,azione)
      SELECT v_evento,u.user_id,v_titolo,'Verifica il rapportino previsto per la giornata.',
        'alta','scaduta',v_atteso.termine_at,p_ora,'apri_rapportino_atteso'
      FROM public.utenti_cantiere u
      LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id=u.user_id
      WHERE u.cantiere_id=v_cantiere AND u.ruolo='owner'
        AND artecna_guardie.utente_puo_modificare_cantiere(u.user_id,v_cantiere)
        AND coalesce(p.generali AND p.in_app AND p.rapportini,true)
      ON CONFLICT (evento_id,recipient_user_id,tipo_avviso,scheduled_at) DO NOTHING;
      GET DIAGNOSTICS v_righe = ROW_COUNT;
      v_inserite := v_inserite + v_righe;
    END LOOP;
  END LOOP;
  RETURN v_inserite;
END;
$$;

ALTER TABLE artecna_notifiche.notifica DROP CONSTRAINT notifica_azione_check,
  ADD CONSTRAINT notifica_azione_check CHECK (azione IN (
    'apri_scadenza_fiscale','apri_attivita_agenda','apri_sopralluogo','apri_rapportino_atteso'));

REVOKE ALL ON FUNCTION artecna_notifiche.genera_rapportini_attesi(timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION artecna_notifiche.esegui_generatore_runtime()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  ora_batch timestamptz := pg_catalog.now();
  inserite integer;
BEGIN
  inserite := artecna_notifiche.genera_scadenze(ora_batch);
  inserite := inserite + artecna_notifiche.genera_agenda(ora_batch);
  inserite := inserite + artecna_notifiche.genera_sopralluoghi(ora_batch);
  RETURN inserite + artecna_notifiche.genera_rapportini_attesi(ora_batch);
END;
$$;

CREATE OR REPLACE FUNCTION artecna_notifiche.visibili(p_user uuid)
RETURNS TABLE (id uuid, titolo text, messaggio text, priorita text, modulo text, published_at timestamptz,
  read_at timestamptz, resolved_at timestamptz, record_id uuid, azione text, attiva boolean)
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT n.id, n.titolo, n.messaggio, n.priorita, e.modulo, n.published_at,
    n.read_at, n.resolved_at, e.record_id, n.azione,
    n.resolved_at IS NULL AND e.resolved_at IS NULL AND
    CASE e.modulo
      WHEN 'rapportini' THEN r.termine_at = e.data_evento
        AND now() >= r.termine_at
        AND (r.rilevante_fino_at IS NULL OR now() < r.rilevante_fino_at)
        AND artecna_rapportini.avvisi_attesi_attivi(r.cantiere_id,now())
        AND artecna_rapportini.esito_atteso(r.cantiere_id,r.giorno_lavoro) <> 'soddisfatto'
        AND coalesce(p.generali AND p.in_app AND p.rapportini,true)
      WHEN 'agenda' THEN a.stato = 'da_fare'
        AND e.agenda_origine = artecna_notifiche.agenda_origine(a.data, a.ora_inizio, a.ora_fine, a.user_id)
        AND coalesce(p.generali AND p.in_app AND p.agenda, true)
        AND (n.tipo_avviso = 'scaduta' OR CASE n.tipo_avviso WHEN 'oggi' THEN 0 ELSE 1 END = ANY(coalesce(p.anticipi_agenda, ARRAY[1,0])))
      WHEN 'sopralluoghi' THEN q.stato = 'da_preventivare'
        AND e.sopralluogo_origine = artecna_notifiche.sopralluogo_orario(q.data_sopralluogo, q.ora_appuntamento)
        AND now() < e.data_evento
        AND coalesce(p.generali AND p.in_app AND p.sopralluoghi, true)
        AND (CASE n.tipo_avviso WHEN 'oggi' THEN 0 ELSE 1 END) = ANY(coalesce(p.anticipi_sopralluoghi, ARRAY[1,0]))
      ELSE s.stato <> 'pagato' AND s.archiviata_at IS NULL AND coalesce(p.generali AND p.in_app AND p.scadenziario, true)
    END
    AND NOT EXISTS (
      SELECT 1 FROM artecna_notifiche.notifica successiva
      WHERE successiva.evento_id = n.evento_id AND successiva.recipient_user_id = n.recipient_user_id
        AND (successiva.scheduled_at > n.scheduled_at OR
          (successiva.scheduled_at = n.scheduled_at AND successiva.tipo_avviso = 'scaduta' AND n.tipo_avviso <> 'scaduta'))
    )
  FROM artecna_notifiche.notifica n
  JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON e.modulo = 'scadenziario' AND s.id = e.record_id
  LEFT JOIN public.agenda_attivita a ON e.modulo = 'agenda' AND a.id = e.record_id AND a.user_id = p_user
  LEFT JOIN public.sopralluoghi q ON e.modulo = 'sopralluoghi' AND q.id = e.record_id
    AND artecna_notifiche.puo_ricevere_sopralluoghi(p_user)
  LEFT JOIN artecna_rapportini.attesi r ON e.modulo='rapportini'
    AND e.tipo_record='rapportino_atteso' AND r.id=e.record_id
    AND artecna_guardie.utente_puo_modificare_cantiere(p_user,r.cantiere_id)
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = p_user
  WHERE n.recipient_user_id = p_user AND n.archived_at IS NULL
    AND (r.id IS NOT NULL OR a.id IS NOT NULL OR q.id IS NOT NULL OR (s.id IS NOT NULL AND artecna_guardie.utente_puo_operare_impresa(p_user)));
$$;

CREATE OR REPLACE FUNCTION public.risolvi_destinazione_notifica(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('azione', v.azione, 'record_id', v.record_id) ||
    CASE WHEN r.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
      'cantiere_id',r.cantiere_id,'giorno_lavoro',r.giorno_lavoro,
      'bozza_id',(SELECT CASE WHEN count(*)=1 AND bool_and(x.stato_operativo='bozza')
                         THEN min(x.id::text)::uuid END
                  FROM public.rapportini x WHERE x.cantiere_id=r.cantiere_id AND x.data=r.giorno_lavoro)
    ) END
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) v
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON v.modulo = 'scadenziario' AND s.id = v.record_id
  LEFT JOIN artecna_rapportini.attesi r ON v.modulo='rapportini' AND r.id=v.record_id
  WHERE v.id = p_id AND (v.modulo IN ('agenda', 'sopralluoghi','rapportini') OR (s.id IS NOT NULL AND s.archiviata_at IS NULL));
$$;


CREATE OR REPLACE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT vis.*, (SELECT e.data_evento FROM artecna_notifiche.notifica n
      JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id WHERE n.id = vis.id AND vis.modulo IN ('agenda', 'sopralluoghi','rapportini')) AS data_evento
    FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) vis
    WHERE p_filtro = 'tutte'
      OR (p_filtro = 'da_leggere' AND attiva AND read_at IS NULL)
      OR (p_filtro = 'urgenti' AND attiva AND priorita IN ('alta', 'urgente'))
    ORDER BY published_at DESC, id LIMIT 50 OFFSET greatest(p_offset, 0)
  ) v;
$$;

CREATE OR REPLACE FUNCTION public.contatori_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('totale', count(DISTINCT (modulo, record_id)),
    'scadenziario', count(DISTINCT record_id) FILTER (WHERE modulo = 'scadenziario'), 'agenda', count(DISTINCT record_id) FILTER (WHERE modulo = 'agenda'),
    'sopralluoghi', count(DISTINCT record_id) FILTER (WHERE modulo = 'sopralluoghi'),
    'rapportini', count(DISTINCT record_id) FILTER (WHERE modulo = 'rapportini'))
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche())
  WHERE attiva AND read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.leggi_preferenze_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(
    (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM artecna_notifiche.preferenze_notifiche p
      WHERE p.user_id = artecna_notifiche.utente_notifiche()),
    '{"generali":true,"in_app":true,"scadenziario":true,"anticipi":[30,7,3,0],"agenda":true,"anticipi_agenda":[1,0],"sopralluoghi":true,"anticipi_sopralluoghi":[1,0],"rapportini":true,"revisione":0}'::jsonb
  )
  FROM (SELECT artecna_notifiche.utente_notifiche() AS id) u
  WHERE u.id IS NOT NULL;
$$;

CREATE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[], p_agenda boolean, p_anticipi_agenda integer[],
  p_sopralluoghi boolean, p_anticipi_sopralluoghi integer[], p_rapportini boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
  risultato artecna_notifiche.preferenze_notifiche;
BEGIN
  PERFORM public.salva_preferenze_notifiche(p_revisione, p_generali, p_in_app, p_scadenziario, p_anticipi, p_agenda, p_anticipi_agenda, p_sopralluoghi, p_anticipi_sopralluoghi);
  UPDATE artecna_notifiche.preferenze_notifiche
  SET rapportini = p_rapportini
  WHERE user_id = u RETURNING * INTO STRICT risultato;
  RETURN to_jsonb(risultato) - 'user_id' - 'updated_at';
END;
$$;

REVOKE ALL ON FUNCTION public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[],boolean)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[],boolean)
  TO authenticated;

COMMIT;
