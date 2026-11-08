-- Final canonical hard delete. Prepared locally; no Production execution.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
CREATE FUNCTION artecna_distruzione.hard_delete_catalog() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $catalog$ SELECT md5(coalesce(string_agg(x,'' ORDER BY x COLLATE "C"),'')) FROM (
 SELECT 'c:'||n.nspname||'.'||c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull x FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE c.relkind='r' AND (n.nspname='public' OR n.nspname LIKE 'artecna_%') AND c.relname NOT LIKE 'hard_delete_%'
 UNION ALL SELECT 'f:'||k.conrelid::regclass::text||':'||k.conname||':'||pg_get_constraintdef(k.oid)||':'||k.convalidated FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype IN ('f','p','u','c') AND (n.nspname='public' OR n.nspname LIKE 'artecna_%') AND c.relname NOT LIKE 'hard_delete_%'
 UNION ALL SELECT 't:'||t.tgrelid::regclass::text||':'||pg_get_triggerdef(t.oid)||':'||t.tgenabled::text||':'||md5(p.prosrc) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR n.nspname LIKE 'artecna_%')
 UNION ALL SELECT 'p:'||n.nspname||'.'||p.proname||':'||pg_get_function_identity_arguments(p.oid)||':'||md5(p.prosrc)||':'||p.prosecdef||':'||coalesce(p.proconfig::text,'') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' OR n.nspname LIKE 'artecna_%') AND p.proname NOT LIKE 'hard_delete_%'
) s $catalog$;
DO $$ BEGIN IF artecna_distruzione.hard_delete_catalog() IS DISTINCT FROM '12b28fb77ee583a0ea1d7f75b0fdaf43' THEN RAISE EXCEPTION 'Catalogo certificato 001-007 divergente' USING ERRCODE='P2113'; END IF; END $$;
CREATE TABLE artecna_distruzione.hard_delete_catalog_expected (signature text NOT NULL);
-- Transient identity-only plan: serialized PKs, never a file/JSON source domain.
CREATE TABLE artecna_distruzione.hard_delete_plan (tx xid8 NOT NULL,backend integer NOT NULL,cantiere uuid NOT NULL,targets text NOT NULL CHECK(jsonb_typeof(targets::jsonb)='object'),PRIMARY KEY(tx,backend));
ALTER TABLE artecna_distruzione.hard_delete_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_distruzione.hard_delete_catalog_expected ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION artecna_distruzione.hard_delete_owned(tab text,j jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM artecna_distruzione.hard_delete_plan p CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.targets::jsonb->tab,'[]')) k
 WHERE p.tx=pg_current_xact_id_if_assigned() AND p.backend=pg_backend_pid() AND p.cantiere=artecna_distruzione.target_prerequisiti()
 AND artecna_distruzione.contesto_valido(p.cantiere) AND j @> k.value)
$$;
CREATE FUNCTION artecna_distruzione.hard_delete_targets(cid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb:='{}'; BEGIN
result:=result||jsonb_build_object('public.cantieri',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.cantieri t WHERE t.id=cid));
result:=result||jsonb_build_object('public.rapportini',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.rapportini t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.foto_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.foto_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.timbrature',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.timbrature t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.materiali_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.materiali_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.attrezzi_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.attrezzi_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.pagamenti_fornitori',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.pagamenti_fornitori t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.acconti_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.acconti_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.incassi_non_fatturati',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.incassi_non_fatturati t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.sal_lavorazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.sal_lavorazioni t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.preventivo_lavorazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.preventivi_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.preventivi_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.varianti_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.varianti_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.utenti_cantiere',(SELECT coalesce(jsonb_agg(jsonb_build_object('cantiere_id',t."cantiere_id",'user_id',t."user_id") ORDER BY jsonb_build_object('cantiere_id',t."cantiere_id",'user_id',t."user_id")::text),'[]') FROM public.utenti_cantiere t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.economia_raccolte',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.economia_raccolte t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.memoria_prezzi',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.memoria_prezzi t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('public.variante_lavorazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.variante_lavorazioni t WHERE t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.variante_documenti',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.variante_documenti t WHERE t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.variante_sorgenti',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.variante_sorgenti t WHERE t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.variante_fonti_memory',(SELECT coalesce(jsonb_agg(jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id") ORDER BY jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id")::text),'[]') FROM public.variante_fonti_memory t WHERE t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.variante_fonti_visive',(SELECT coalesce(jsonb_agg(jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id") ORDER BY jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id")::text),'[]') FROM public.variante_fonti_visive t WHERE t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.variante_osservatore_analisi',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.variante_osservatore_analisi t WHERE t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.economia_righe',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.economia_righe t WHERE t.raccolta_id IN (SELECT id FROM public.economia_raccolte WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.economia_sorgenti',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.economia_sorgenti t WHERE t.raccolta_id IN (SELECT id FROM public.economia_raccolte WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.rapportino_prestazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.rapportino_prestazioni t WHERE t.rapportino_id IN (SELECT id FROM public.rapportini WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('public.rapportino_materiali',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.rapportino_materiali t WHERE t.rapportino_id IN (SELECT id FROM public.rapportini WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('artecna_rapportini.richieste',(SELECT coalesce(jsonb_agg(jsonb_build_object('canale',t."canale",'utente_id',t."utente_id",'richiesta_id',t."richiesta_id") ORDER BY jsonb_build_object('canale',t."canale",'utente_id',t."utente_id",'richiesta_id',t."richiesta_id")::text),'[]') FROM artecna_rapportini.richieste t WHERE t.rapportino_id IN (SELECT id FROM public.rapportini WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('artecna_rapportini.allegati',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM artecna_rapportini.allegati t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('artecna_rapportini.f3c3_capability',(SELECT coalesce(jsonb_agg(jsonb_build_object('foto_id',t."foto_id") ORDER BY jsonb_build_object('foto_id',t."foto_id")::text),'[]') FROM artecna_rapportini.f3c3_capability t WHERE t.foto_id IN (SELECT id FROM public.foto_cantiere WHERE cantiere_id=cid) OR t.allegato_id IN (SELECT id FROM artecna_rapportini.allegati WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('keep:public.fatture_emesse',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.fatture_emesse t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('keep:public.fatture_fornitori_righe',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('keep:public.fornitori_rettifiche',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.fornitori_rettifiche t WHERE t.cantiere_id=cid OR t.economia_riga_id IN (SELECT e.id FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=cid) OR t.materiale_cantiere_id IN (SELECT id FROM public.materiali_cantiere WHERE cantiere_id=cid)));
result:=result||jsonb_build_object('keep:artecna_contabilita.attribuzioni_clienti',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM artecna_contabilita.attribuzioni_clienti t WHERE t.cantiere_id=cid));
result:=result||jsonb_build_object('keep:artecna_guardie.fatture_classificazione_richieste',(SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',t."user_id",'richiesta_id',t."richiesta_id") ORDER BY jsonb_build_object('user_id',t."user_id",'richiesta_id',t."richiesta_id")::text),'[]') FROM artecna_guardie.fatture_classificazione_richieste t WHERE t.payload::text ~* cid::text OR t.risultato::text ~* cid::text));
result:=result||jsonb_build_object('keep:public.agenda_attivita',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM public.agenda_attivita t WHERE t.collegamento->>'tipo'='cantiere' AND t.collegamento->>'id'=cid::text));
result:=result||jsonb_build_object('keep:artecna_contabilita.archivio_quote',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM artecna_contabilita.archivio_quote t WHERE true));
result:=result||jsonb_build_object('keep:artecna_contabilita.archivio_attribuzioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t."id") ORDER BY jsonb_build_object('id',t."id")::text),'[]') FROM artecna_contabilita.archivio_attribuzioni t WHERE true));
RETURN result; END $$;
CREATE FUNCTION artecna_distruzione.hard_delete_lock(cid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF artecna_distruzione.target_prerequisiti() IS DISTINCT FROM cid THEN RAISE EXCEPTION 'Contesto autorizzato assente' USING ERRCODE='42501'; END IF;
 LOCK TABLE artecna_contabilita.archivio_attribuzioni,artecna_contabilita.archivio_quote,artecna_contabilita.attribuzioni_clienti,artecna_guardie.fatture_classificazione_richieste,artecna_rapportini.allegati,artecna_rapportini.f3c3_capability,artecna_rapportini.richieste,artecna_rapportini.sessioni_portale,public.acconti_cantiere,public.agenda_attivita,public.attrezzi_cantiere,public.cantieri,public.economia_raccolte,public.economia_righe,public.economia_sorgenti,public.fatture_emesse,public.fatture_fornitori,public.fatture_fornitori_righe,public.fornitori_rettifiche,public.foto_cantiere,public.foto_sopralluogo,public.impostazioni_app,public.incassi_non_fatturati,public.materiali_cantiere,public.materiali_impresa,public.memoria_prezzi,public.note_allegati,public.note_sopralluogo,public.operai,public.pagamenti_fornitori,public.pagamenti_operai,public.preventivi_cantiere,public.preventivo_lavorazioni,public.prezzi_lavorazioni,public.prezziario_sicilia,public.quaderno_allegati,public.quaderno_copie_allegati,public.quaderno_gestioni,public.quaderno_progetti,public.quaderno_richiami_sopralluogo,public.rapportini,public.rapportino_materiali,public.rapportino_prestazioni,public.sal_lavorazioni,public.sopralluoghi,public.spese_impresa,public.timbrature,public.utenti_cantiere,public.utenti_impresa,public.utilizzo_ai,public.variante_documenti,public.variante_fonti_memory,public.variante_fonti_visive,public.variante_lavorazioni,public.variante_osservatore_analisi,public.variante_sorgenti,public.varianti_cantiere IN SHARE ROW EXCLUSIVE MODE;
END $$;
CREATE OR REPLACE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid) RETURNS TABLE(entita text,quantita bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off AS $$ BEGIN
 IF artecna_distruzione.contesto_valido(p_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Contesto assente' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT key,jsonb_array_length(value)::bigint FROM jsonb_each(artecna_distruzione.hard_delete_targets(p_cantiere)) WHERE key NOT LIKE 'keep:%' ORDER BY key;
END $$;
CREATE FUNCTION artecna_distruzione.hard_delete_blockers(cid uuid) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE blockers text[]:='{}';legacy_source record;legacy_row record;ids uuid[];target_name text;targets jsonb;fk record;joins text;bad boolean; BEGIN
 IF artecna_distruzione.hard_delete_catalog() IS DISTINCT FROM (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) THEN RETURN ARRAY['catalogo']; END IF;
 SELECT nome INTO target_name FROM public.cantieri WHERE id=cid;
 FOR legacy_source IN SELECT * FROM artecna_distruzione.legacy_sorgenti ORDER BY tabella LOOP
  FOR legacy_row IN EXECUTE format('SELECT to_jsonb(t) j FROM %s t WHERE cantiere_id IS NULL',legacy_source.relation) LOOP
   ids:=artecna_distruzione.legacy_derivazione(legacy_source.tabella,legacy_row.j);
   IF cid=ANY(ids) OR (cardinality(ids)=0 AND legacy_row.j->>'cantiere'=target_name) THEN blockers:=array_append(blockers,'legacy_ambiguo');EXIT; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM artecna_distruzione.legacy_da_risolvere WHERE approved_cantiere=cid) THEN blockers:=array_append(blockers,'legacy_ambiguo'); END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE cantiere_id=cid AND lease_until>clock_timestamp()) THEN blockers:=array_append(blockers,'upload_in_corso'); END IF;
 -- Concordance of every populated ownership path, including logical non-FK edges.
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a JOIN public.rapportini r ON r.id=a.rapportino_id WHERE (a.cantiere_id=cid OR r.cantiere_id=cid) AND a.cantiere_id IS DISTINCT FROM r.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.foto_cantiere f JOIN public.rapportini r ON r.id::text=f.rapportino_id WHERE (f.cantiere_id=cid OR r.cantiere_id=cid) AND f.cantiere_id IS DISTINCT FROM r.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.timbrature t JOIN public.rapportini r ON r.id=t.rapportino_id WHERE (t.cantiere_id=cid OR r.cantiere_id=cid) AND t.cantiere_id IS DISTINCT FROM r.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id JOIN public.varianti_cantiere v ON v.id=p.variante_id WHERE (r.cantiere_id=cid OR v.cantiere_id=cid) AND r.cantiere_id IS DISTINCT FROM v.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.variante_sorgenti s JOIN public.varianti_cantiere v ON v.id=s.variante_id JOIN public.economia_raccolte e ON e.id=s.economia_raccolta_id WHERE (v.cantiere_id=cid OR e.cantiere_id=cid) AND v.cantiere_id IS DISTINCT FROM e.cantiere_id)
 THEN blockers:=array_append(blockers,'ownership_discordante'); END IF;
 targets:=artecna_distruzione.hard_delete_targets(cid);
 FOR fk IN SELECT k.*,k.conrelid::regclass::text child,k.confrelid::regclass::text parent FROM pg_constraint k WHERE k.contype='f' AND targets ? k.confrelid::regclass::text LOOP
  SELECT string_agg(format('f.%I=p.%I',a.attname,b.attname),' AND ' ORDER BY u.o) INTO joins FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY u(a,b,o) JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=u.a JOIN pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=u.b;
  IF targets ? fk.child THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s f JOIN %s p ON %s WHERE EXISTS(SELECT 1 FROM jsonb_array_elements($1->$2) k WHERE to_jsonb(p) @> k.value) IS DISTINCT FROM EXISTS(SELECT 1 FROM jsonb_array_elements($1->$3) k WHERE to_jsonb(f) @> k.value))',fk.conrelid::regclass,fk.confrelid::regclass,joins) INTO bad USING targets,fk.parent,fk.child;
  ELSIF fk.child IN ('public.fornitori_rettifiche','public.fatture_emesse','public.fatture_fornitori_righe','artecna_contabilita.attribuzioni_clienti','artecna_distruzione.contesto','artecna_distruzione.contesto_prerequisiti','artecna_distruzione.quote_da_eliminare') THEN CONTINUE;
  ELSE
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s f JOIN %s p ON %s WHERE EXISTS(SELECT 1 FROM jsonb_array_elements($1->$2) k WHERE to_jsonb(p) @> k.value))',fk.conrelid::regclass,fk.confrelid::regclass,joins) INTO bad USING targets,fk.parent;
  END IF;
  IF bad THEN blockers:=array_append(blockers,'relazione_esterna');EXIT;END IF;
 END LOOP;
 RETURN blockers; END $$;
CREATE OR REPLACE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off AS $$
BEGIN
 IF artecna_distruzione.target_prerequisiti() IS DISTINCT FROM p_cantiere THEN RAISE EXCEPTION 'Contesto autorizzato assente' USING ERRCODE='42501'; END IF;
 INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo) VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,artecna_guardie.utente_jwt_corrente(),'artecna_cantieri_delete_rpc');
END $$;
CREATE OR REPLACE FUNCTION public.proteggi_provenienza_economia_rapportino()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;

 IF OLD.origine='rapportino' AND TG_OP='UPDATE'
  AND (SELECT stato FROM public.economia_raccolte WHERE id=OLD.raccolta_id) IS DISTINCT FROM 'bozza' THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF OLD.origine<>'rapportino' THEN
  IF TG_OP='UPDATE' AND NEW.origine='rapportino' THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Conversione provenienza vietata'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Provenienza Rapportino persistente'; END IF;
 IF ROW(NEW.id,NEW.raccolta_id,NEW.origine,NEW.sorgente_id,NEW.indice_voce_sorgente,
   NEW.rapportino_prestazione_id,NEW.prestazione_revisione_acquisita,NEW.prestazione_snapshot,
   NEW.tipo_riga,NEW.dettagli_analitici,NEW.quantita,NEW.unita_misura,NEW.created_by,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.raccolta_id,OLD.origine,OLD.sorgente_id,OLD.indice_voce_sorgente,
   OLD.rapportino_prestazione_id,OLD.prestazione_revisione_acquisita,OLD.prestazione_snapshot,
   OLD.tipo_riga,OLD.dettagli_analitici,OLD.quantita,OLD.unita_misura,OLD.created_by,OLD.created_at) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Provenienza Rapportino immutabile'; END IF;
 RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_prestazione()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE c uuid;
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;

  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Richiesta rimozione logica'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.rapportino_id IS DISTINCT FROM OLD.rapportino_id
    OR NEW.operaio_id IS DISTINCT FROM OLD.operaio_id OR NEW.chiave_client IS DISTINCT FROM OLD.chiave_client
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.rimossa_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità immutabile o prestazione rimossa';
  END IF;
  SELECT cantiere_id INTO c FROM public.rapportini WHERE id=NEW.rapportino_id FOR SHARE;
  IF c IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino senza cantiere valido'; END IF;
  IF NEW.variante_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||NEW.variante_id::text,0));
    IF NOT artecna_rapportini.variante_del_cantiere(NEW.variante_id,c) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Variante fuori cantiere o inesistente';
    END IF;
  END IF;
  IF TG_OP='UPDATE' THEN NEW.revisione:=OLD.revisione+1; NEW.updated_at:=clock_timestamp(); END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_strutturato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE protetto boolean;
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;

  IF current_user IN ('postgres','artecna_rapportini_rpc') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME='rapportini' THEN
    protetto:=OLD.versione_prestazioni=1;
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.rapportini WHERE versione_prestazioni=1 AND
      ((TG_OP<>'INSERT' AND id=OLD.rapportino_id) OR (TG_OP<>'DELETE' AND id=NEW.rapportino_id))) INTO protetto;
  END IF;
  IF protetto THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Rapportino strutturato: usare il servizio unico'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_materiale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r record;
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;

  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Richiesta rimozione logica'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.rapportino_id IS DISTINCT FROM OLD.rapportino_id
    OR NEW.chiave_client IS DISTINCT FROM OLD.chiave_client OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR OLD.rimossa_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità immutabile o materiale rimosso';
  END IF;
  SELECT versione_prestazioni,versione_materiali INTO r FROM public.rapportini WHERE id=NEW.rapportino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Rapportino padre assente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 OR r.versione_materiali IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Materiali strutturati non adottati';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.revisione:=0; NEW.created_at:=statement_timestamp();
  ELSE NEW.revisione:=OLD.revisione+1;
  END IF;
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION artecna_rapportini.materiali_fail_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;

 IF current_user<>'artecna_rapportini_rpc' OR TG_OP='DELETE' THEN
 RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Materiali riservati al writer Rapportino'; END IF;
 RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_ponte_economia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE ids uuid[]; sorgenti uuid[]; v uuid; coinvolge boolean:=false;
 s public.variante_sorgenti%rowtype; r public.economia_raccolte%rowtype; voce jsonb;
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;

 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN ('variante_sorgenti','variante_lavorazioni')
   OR TG_OP NOT IN ('INSERT','UPDATE','DELETE') THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto ponte non consentito'; END IF;
 IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.variante_id];
 ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.variante_id];
 ELSE ids:=ARRAY[OLD.variante_id,NEW.variante_id]; END IF;
 IF TG_TABLE_NAME='variante_sorgenti' THEN
   IF TG_OP<>'INSERT' THEN coinvolge:=coalesce(OLD.tipo='raccolta_economia',false); END IF;
   IF TG_OP<>'DELETE' THEN coinvolge:=coinvolge OR coalesce(NEW.tipo='raccolta_economia',false); END IF;
 ELSE
   IF TG_OP='INSERT' THEN sorgenti:=ARRAY[NEW.variante_sorgente_id];
   ELSIF TG_OP='DELETE' THEN sorgenti:=ARRAY[OLD.variante_sorgente_id];
   ELSE sorgenti:=ARRAY[OLD.variante_sorgente_id,NEW.variante_sorgente_id]; END IF;
   coinvolge:=EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE id=ANY(sorgenti) AND tipo='raccolta_economia');
 END IF;
 coinvolge:=coinvolge OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE variante_id=ANY(ids) AND tipo='raccolta_economia');
 IF NOT coinvolge THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 FOR v IN SELECT DISTINCT x FROM unnest(ids) x WHERE x IS NOT NULL ORDER BY x LOOP
   PERFORM 1 FROM public.varianti_cantiere WHERE id=v FOR UPDATE;
 END LOOP;
 IF TG_OP<>'INSERT' OR current_user NOT IN ('artecna_ponte_economia_rpc','postgres') THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante Economia dedicata immutabile'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.varianti_cantiere WHERE id=NEW.variante_id AND stato='bozza' AND numero IS NULL) THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Contesto acquisizione incoerente'; END IF;
 IF TG_TABLE_NAME='variante_sorgenti' THEN
   IF NEW.tipo<>'raccolta_economia' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE variante_id=NEW.variante_id)
     OR EXISTS(SELECT 1 FROM public.variante_lavorazioni WHERE variante_id=NEW.variante_id) THEN
     RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sorgente aggiuntiva non consentita'; END IF;
   SELECT * INTO r FROM public.economia_raccolte WHERE id=NEW.economia_raccolta_id;
   IF NOT FOUND OR r.stato<>'chiusa' OR r.revisione IS DISTINCT FROM NEW.economia_revisione_congelata
     OR NOT EXISTS(SELECT 1 FROM public.varianti_cantiere WHERE id=NEW.variante_id AND cantiere_id=r.cantiere_id)
     OR NEW.snapshot_version<>1 OR NEW.snapshot->>'raccolta_id' IS DISTINCT FROM r.id::text THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Sorgente acquisizione incoerente'; END IF;
 ELSE
   SELECT * INTO s FROM public.variante_sorgenti WHERE id=NEW.variante_sorgente_id
     AND variante_id=NEW.variante_id AND tipo='raccolta_economia';
   IF NOT FOUND OR NEW.indice_voce_sorgente IS NULL OR NEW.indice_voce_sorgente<0 THEN
     RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Lavorazione aggiuntiva non consentita'; END IF;
   voce:=s.snapshot->'registrazioni'->NEW.indice_voce_sorgente;
   IF voce IS NULL OR NEW.numero_riga IS DISTINCT FROM (SELECT count(*) FROM jsonb_array_elements(s.snapshot->'registrazioni') WITH ORDINALITY t(v,ord) WHERE t.ord<=NEW.indice_voce_sorgente+1 AND coalesce(t.v->>'esclusa_proposta','false')='false') OR NEW.operazione<>'nuova'
     OR NEW.descrizione IS DISTINCT FROM voce->>'descrizione'
     OR NEW.unita_misura IS DISTINCT FROM voce->>'unita_misura'
     OR NEW.quantita_delta IS DISTINCT FROM (voce->>'quantita')::numeric
     OR NEW.prezzo_unitario IS DISTINCT FROM (voce->>'prezzo_unitario')::numeric
     OR NEW.delta_contratto IS DISTINCT FROM (voce->>'importo')::numeric
     OR voce->>'esclusa_proposta'='true' OR NEW.note IS DISTINCT FROM coalesce(voce->>'note','')
     OR NEW.riferimento_preventivo_lavorazione_id IS NOT NULL OR NEW.riferimento_variante_lavorazione_id IS NOT NULL THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Lavorazione acquisizione incoerente'; END IF;
 END IF;
 IF current_user='artecna_ponte_economia_rpc' AND TG_TABLE_NAME='variante_sorgenti' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'registrazioni') x WHERE (x->'dettagli_analitici' ? 'cliente_materiale' OR x->'dettagli_analitici' ? 'proposta_non_economica')) THEN RAISE EXCEPTION 'Prezzo cliente presente: usare il ponte commerciale aggiornato' USING ERRCODE='22023'; END IF;
 END IF;
 IF current_user='postgres' THEN
  IF TG_TABLE_NAME='variante_sorgenti' THEN PERFORM artecna_guardie.certifica_snapshot_cliente(NEW.snapshot); ELSE PERFORM artecna_guardie.certifica_snapshot_cliente(s.snapshot); END IF;
 END IF;
 RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_guardia_foto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE protetta boolean; consumed uuid;
BEGIN
 IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;
 IF TG_OP='UPDATE' AND NEW.allegato_v1_id IS NULL AND (to_jsonb(NEW)-'allegato_v1_id') IS NOT DISTINCT FROM (to_jsonb(OLD)-'allegato_v1_id') AND artecna_distruzione.hard_delete_owned('public.foto_cantiere',to_jsonb(OLD)) THEN RETURN NEW; END IF;

 IF TG_OP='INSERT' THEN
  protetta:=NEW.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=NEW.id);
  IF protetta THEN
   IF session_user<>'artecna_rapportini_backend' OR NEW.allegato_v1_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
   DELETE FROM artecna_rapportini.f3c3_capability WHERE foto_id=NEW.id AND allegato_id=NEW.allegato_v1_id
    AND tx=pg_current_xact_id() AND backend_pid=pg_backend_pid() RETURNING foto_id INTO consumed;
   IF consumed IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 protetta:=OLD.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=OLD.id);
 IF TG_OP='UPDATE' THEN
  protetta:=protetta OR NEW.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=NEW.id);
 END IF;
 IF protetta THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$function$
;
CREATE FUNCTION artecna_distruzione.hard_delete_preserved(cid uuid,targets jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb:='{}'; BEGIN
result:=result||jsonb_build_object('artecna_contabilita.archivio_attribuzioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_contabilita.archivio_attribuzioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:artecna_contabilita.archivio_attribuzioni','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_contabilita.archivio_quote',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_contabilita.archivio_quote t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:artecna_contabilita.archivio_quote','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_contabilita.attribuzioni_clienti',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_contabilita.attribuzioni_clienti t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:artecna_contabilita.attribuzioni_clienti','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_guardie.fatture_classificazione_richieste',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_guardie.fatture_classificazione_richieste t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:artecna_guardie.fatture_classificazione_richieste','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_rapportini.allegati',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_rapportini.allegati t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'artecna_rapportini.allegati','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_rapportini.f3c3_capability',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_rapportini.f3c3_capability t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'artecna_rapportini.f3c3_capability','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_rapportini.richieste',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_rapportini.richieste t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'artecna_rapportini.richieste','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('artecna_rapportini.sessioni_portale',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM artecna_rapportini.sessioni_portale t WHERE true));
result:=result||jsonb_build_object('public.acconti_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.acconti_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.acconti_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.agenda_attivita',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.agenda_attivita t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:public.agenda_attivita','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.attrezzi_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.attrezzi_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.attrezzi_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.cantieri',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.cantieri t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.cantieri','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.economia_raccolte',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.economia_raccolte t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.economia_raccolte','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.economia_righe',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.economia_righe t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.economia_righe','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.economia_sorgenti',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.economia_sorgenti t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.economia_sorgenti','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.fatture_emesse',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.fatture_emesse t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:public.fatture_emesse','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.fatture_fornitori',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.fatture_fornitori t WHERE true));
result:=result||jsonb_build_object('public.fatture_fornitori_righe',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.fatture_fornitori_righe t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:public.fatture_fornitori_righe','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.fornitori_rettifiche',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.fornitori_rettifiche t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'keep:public.fornitori_rettifiche','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.foto_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.foto_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.foto_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.foto_sopralluogo',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.foto_sopralluogo t WHERE true));
result:=result||jsonb_build_object('public.impostazioni_app',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.impostazioni_app t WHERE true));
result:=result||jsonb_build_object('public.incassi_non_fatturati',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.incassi_non_fatturati t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.incassi_non_fatturati','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.materiali_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.materiali_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.materiali_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.materiali_impresa',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.materiali_impresa t WHERE true));
result:=result||jsonb_build_object('public.memoria_prezzi',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.memoria_prezzi t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.memoria_prezzi','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.note_allegati',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.note_allegati t WHERE true));
result:=result||jsonb_build_object('public.note_sopralluogo',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.note_sopralluogo t WHERE true));
result:=result||jsonb_build_object('public.operai',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.operai t WHERE true));
result:=result||jsonb_build_object('public.pagamenti_fornitori',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.pagamenti_fornitori t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.pagamenti_fornitori','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.pagamenti_operai',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.pagamenti_operai t WHERE true));
result:=result||jsonb_build_object('public.preventivi_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.preventivi_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.preventivi_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.preventivo_lavorazioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.preventivo_lavorazioni t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.preventivo_lavorazioni','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.prezzi_lavorazioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.prezzi_lavorazioni t WHERE true));
result:=result||jsonb_build_object('public.prezziario_sicilia',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.prezziario_sicilia t WHERE true));
result:=result||jsonb_build_object('public.quaderno_allegati',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.quaderno_allegati t WHERE true));
result:=result||jsonb_build_object('public.quaderno_copie_allegati',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.quaderno_copie_allegati t WHERE true));
result:=result||jsonb_build_object('public.quaderno_gestioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.quaderno_gestioni t WHERE true));
result:=result||jsonb_build_object('public.quaderno_progetti',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.quaderno_progetti t WHERE true));
result:=result||jsonb_build_object('public.quaderno_richiami_sopralluogo',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.quaderno_richiami_sopralluogo t WHERE true));
result:=result||jsonb_build_object('public.rapportini',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.rapportini t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.rapportini','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.rapportino_materiali',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.rapportino_materiali t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.rapportino_materiali','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.rapportino_prestazioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.rapportino_prestazioni t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.rapportino_prestazioni','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.sal_lavorazioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.sal_lavorazioni t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.sal_lavorazioni','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.sopralluoghi',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.sopralluoghi t WHERE true));
result:=result||jsonb_build_object('public.spese_impresa',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.spese_impresa t WHERE true));
result:=result||jsonb_build_object('public.timbrature',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.timbrature t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.timbrature','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.utenti_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.utenti_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.utenti_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.utenti_impresa',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.utenti_impresa t WHERE true));
result:=result||jsonb_build_object('public.utilizzo_ai',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.utilizzo_ai t WHERE true));
result:=result||jsonb_build_object('public.variante_documenti',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.variante_documenti t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.variante_documenti','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.variante_fonti_memory',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.variante_fonti_memory t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.variante_fonti_memory','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.variante_fonti_visive',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.variante_fonti_visive t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.variante_fonti_visive','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.variante_lavorazioni',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.variante_lavorazioni t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.variante_lavorazioni','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.variante_osservatore_analisi',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.variante_osservatore_analisi t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.variante_osservatore_analisi','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.variante_sorgenti',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.variante_sorgenti t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.variante_sorgenti','[]')) k WHERE to_jsonb(t) @> k.value)));
result:=result||jsonb_build_object('public.varianti_cantiere',(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.varianti_cantiere t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->'public.varianti_cantiere','[]')) k WHERE to_jsonb(t) @> k.value)));
RETURN result;END $$;
DROP FUNCTION public.elimina_cantiere_definitivamente(uuid,text);
CREATE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid,p_conferma text)
RETURNS TABLE(cantiere_id uuid,eliminato boolean,storage_nuovi bigint,conteggi jsonb,storage_jobs_created bigint,storage_objects_preserved_shared bigint,legal_records_preserved bigint,legacy_resolved_deleted bigint,manifest_fingerprint text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid:=p_cantiere_id;targets jsonb;preserved jsonb;after_keep jsonb;blockers text[];tab text;n bigint;expected bigint;total bigint;oldmax bigint;objects jsonb;shared bigint;legal_count bigint;legacy_count bigint;
BEGIN
 IF current_user<>'artecna_cantieri_delete_rpc' OR cid IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN RAISE EXCEPTION 'UUID e conferma esatta ELIMINA obbligatori' USING ERRCODE='P2111'; END IF;
 PERFORM artecna_distruzione.apri_contesto_prerequisiti(cid,p_conferma);
 -- Coarse, deterministic locks protect logical links without FK as well as FK
 -- links. Do not replace with root locks alone. No network I/O under these locks.
 PERFORM artecna_distruzione.hard_delete_lock(cid);
 blockers:=artecna_distruzione.hard_delete_blockers(cid);
 IF cardinality(blockers)>0 THEN RAISE EXCEPTION 'Hard delete bloccato: %',array_to_string(blockers,', ') USING ERRCODE='P2113'; END IF;
 PERFORM artecna_distruzione.inizia_contesto(cid);
 targets:=artecna_distruzione.hard_delete_targets(cid);
 INSERT INTO artecna_distruzione.hard_delete_plan VALUES(pg_current_xact_id(),pg_backend_pid(),cid,targets::text);
 preserved:=artecna_distruzione.hard_delete_preserved(cid,targets);
 SELECT coalesce(max(id),0) INTO oldmax FROM artecna_distruzione.cleanup_storage;
 SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('bucket',r.bucket,'path',r.path)),'[]') INTO objects FROM artecna_distruzione.storage_riferimenti r
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->r.source_table,'[]')) k WHERE r.source_id=k.value);
 -- Prepare exclusive keys BEFORE source DELETE. A live reference outside the
 -- frozen target set preserves the object. Existing jobs are never overwritten.
 INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path)
 SELECT cid,o->>'bucket',o->>'path' FROM jsonb_array_elements(objects) o WHERE NOT EXISTS(
 SELECT 1 FROM artecna_distruzione.storage_riferimenti r WHERE r.bucket=o->>'bucket' AND r.path=o->>'path'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->r.source_table,'[]')) k WHERE r.source_id=k.value)) ON CONFLICT DO NOTHING;
 SELECT coalesce(sum(jsonb_array_length(value)),0) INTO legal_count FROM jsonb_each(targets) WHERE key IN ('keep:public.fornitori_rettifiche','keep:public.fatture_emesse','keep:public.fatture_fornitori_righe','keep:artecna_contabilita.attribuzioni_clienti');
 SELECT coalesce(sum(jsonb_array_length(targets->tabella)),0) INTO legacy_count FROM artecna_distruzione.legacy_sorgenti;
 PERFORM artecna_distruzione.detach_contabile_cantiere();
 UPDATE public.agenda_attivita SET collegamento=NULL WHERE collegamento->>'tipo'='cantiere' AND collegamento->>'id'=cid::text;
 UPDATE public.cantieri SET preventivo_contrattuale_id=NULL WHERE id=cid AND preventivo_contrattuale_id IS NOT NULL;
 UPDATE public.foto_cantiere f SET allegato_v1_id=NULL WHERE f.cantiere_id=cid AND f.allegato_v1_id IS NOT NULL;
 conteggi:='{}';
total:=0; LOOP
 DELETE FROM artecna_rapportini.richieste t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'artecna_rapportini.richieste') k WHERE jsonb_build_object('canale',t."canale",'utente_id',t."utente_id",'richiesta_id',t."richiesta_id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'artecna_rapportini.richieste');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: artecna_rapportini.richieste' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('artecna_rapportini.richieste',total);
total:=0; LOOP
 DELETE FROM public.sal_lavorazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.sal_lavorazioni') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.sal_lavorazioni');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.sal_lavorazioni' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.sal_lavorazioni',total);
total:=0; LOOP
 DELETE FROM public.variante_fonti_memory t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_fonti_memory') k WHERE jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.variante_fonti_memory');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.variante_fonti_memory' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.variante_fonti_memory',total);
total:=0; LOOP
 DELETE FROM public.variante_fonti_visive t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_fonti_visive') k WHERE jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.variante_fonti_visive');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.variante_fonti_visive' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.variante_fonti_visive',total);
total:=0; LOOP
 DELETE FROM public.variante_osservatore_analisi t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_osservatore_analisi') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.variante_osservatore_analisi');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.variante_osservatore_analisi' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.variante_osservatore_analisi',total);
total:=0; LOOP
 DELETE FROM public.variante_documenti t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_documenti') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.variante_documenti');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.variante_documenti' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.variante_documenti',total);
total:=0; LOOP
 DELETE FROM public.variante_lavorazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_lavorazioni') k WHERE jsonb_build_object('id',t."id")=k.value) AND NOT EXISTS(SELECT 1 FROM public.variante_lavorazioni r WHERE r.riferimento_variante_lavorazione_id=t.id) ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.variante_lavorazioni');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.variante_lavorazioni' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.variante_lavorazioni',total);
total:=0; LOOP
 DELETE FROM public.variante_sorgenti t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_sorgenti') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.variante_sorgenti');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.variante_sorgenti' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.variante_sorgenti',total);
total:=0; LOOP
 DELETE FROM public.economia_righe t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.economia_righe') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.economia_righe');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.economia_righe' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.economia_righe',total);
total:=0; LOOP
 DELETE FROM public.economia_sorgenti t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.economia_sorgenti') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.economia_sorgenti');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.economia_sorgenti' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.economia_sorgenti',total);
total:=0; LOOP
 DELETE FROM public.economia_raccolte t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.economia_raccolte') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.economia_raccolte');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.economia_raccolte' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.economia_raccolte',total);
total:=0; LOOP
 DELETE FROM public.timbrature t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.timbrature') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.timbrature');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.timbrature' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.timbrature',total);
total:=0; LOOP
 DELETE FROM public.rapportino_materiali t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.rapportino_materiali') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.rapportino_materiali');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.rapportino_materiali' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.rapportino_materiali',total);
total:=0; LOOP
 DELETE FROM public.rapportino_prestazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.rapportino_prestazioni') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.rapportino_prestazioni');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.rapportino_prestazioni' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.rapportino_prestazioni',total);
total:=0; LOOP
 DELETE FROM artecna_rapportini.f3c3_capability t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'artecna_rapportini.f3c3_capability') k WHERE jsonb_build_object('foto_id',t."foto_id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'artecna_rapportini.f3c3_capability');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: artecna_rapportini.f3c3_capability' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('artecna_rapportini.f3c3_capability',total);
total:=0; LOOP
 DELETE FROM artecna_rapportini.allegati t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'artecna_rapportini.allegati') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'artecna_rapportini.allegati');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: artecna_rapportini.allegati' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('artecna_rapportini.allegati',total);
total:=0; LOOP
 DELETE FROM public.foto_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.foto_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.foto_cantiere');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.foto_cantiere' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.foto_cantiere',total);
total:=0; LOOP
 DELETE FROM public.rapportini t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.rapportini') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.rapportini');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.rapportini' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.rapportini',total);
total:=0; LOOP
 DELETE FROM public.preventivo_lavorazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.preventivo_lavorazioni') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.preventivo_lavorazioni');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.preventivo_lavorazioni' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.preventivo_lavorazioni',total);
total:=0; LOOP
 DELETE FROM public.preventivi_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.preventivi_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value) AND NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere r WHERE r.preventivo_contrattuale_id=t.id) AND t.natura='integrativo';
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.preventivi_cantiere');
 conteggi:=conteggi||jsonb_build_object('public.preventivi_cantiere',total);
total:=0; LOOP
 DELETE FROM public.varianti_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.varianti_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.varianti_cantiere');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.varianti_cantiere' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.varianti_cantiere',total);
total:=coalesce((conteggi->>'public.preventivi_cantiere')::bigint,0); LOOP
 DELETE FROM public.preventivi_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.preventivi_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value) AND NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere r WHERE r.preventivo_contrattuale_id=t.id) ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.preventivi_cantiere');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.preventivi_cantiere' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.preventivi_cantiere',total);
total:=0; LOOP
 DELETE FROM public.materiali_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.materiali_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.materiali_cantiere');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.materiali_cantiere' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.materiali_cantiere',total);
total:=0; LOOP
 DELETE FROM public.attrezzi_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.attrezzi_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.attrezzi_cantiere');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.attrezzi_cantiere' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.attrezzi_cantiere',total);
total:=0; LOOP
 DELETE FROM public.pagamenti_fornitori t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.pagamenti_fornitori') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.pagamenti_fornitori');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.pagamenti_fornitori' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.pagamenti_fornitori',total);
total:=0; LOOP
 DELETE FROM public.acconti_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.acconti_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.acconti_cantiere');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.acconti_cantiere' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.acconti_cantiere',total);
total:=0; LOOP
 DELETE FROM public.incassi_non_fatturati t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.incassi_non_fatturati') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.incassi_non_fatturati');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.incassi_non_fatturati' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.incassi_non_fatturati',total);
total:=0; LOOP
 DELETE FROM public.memoria_prezzi t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.memoria_prezzi') k WHERE jsonb_build_object('id',t."id")=k.value)  ;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->'public.memoria_prezzi');IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: public.memoria_prezzi' USING ERRCODE='P2114'; END IF;
 conteggi:=conteggi||jsonb_build_object('public.memoria_prezzi',total);
 -- Source triggers may enqueue candidates with remaining global references.
 -- Remove only NEW jobs created in this transaction for those shared objects;
 -- preserve every pre-existing job. No destructive shared job is committed.
 SELECT count(*) INTO shared FROM jsonb_array_elements(objects) o WHERE EXISTS(SELECT 1 FROM artecna_distruzione.storage_riferimenti r WHERE r.bucket=o->>'bucket' AND r.path=o->>'path');
 DELETE FROM artecna_distruzione.cleanup_storage j WHERE j.id>oldmax AND EXISTS(SELECT 1 FROM artecna_distruzione.storage_riferimenti r WHERE r.bucket=j.bucket AND r.path=j.path);
 SELECT count(*) INTO storage_nuovi FROM artecna_distruzione.cleanup_storage WHERE id>oldmax;
 IF EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare x WHERE x.cantiere_id=cid) OR EXISTS(SELECT 1 FROM public.fornitori_rettifiche x WHERE x.cantiere_id=cid) OR EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti x WHERE x.cantiere_id=cid) THEN RAISE EXCEPTION 'Detach residuo' USING ERRCODE='P2114'; END IF;
 PERFORM artecna_distruzione.termina_contesto();
 PERFORM artecna_distruzione.chiudi_contesto_prerequisiti();
 DELETE FROM artecna_distruzione.hard_delete_plan WHERE tx=pg_current_xact_id() AND backend=pg_backend_pid();
 DELETE FROM public.utenti_cantiere WHERE utenti_cantiere.cantiere_id=cid;
 DELETE FROM public.cantieri WHERE id=cid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Root residuo' USING ERRCODE='P2114'; END IF;
 -- Verify AFTER every mutation, by SAVED keys, independently of vanished parents.
IF EXISTS(SELECT 1 FROM public.cantieri t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.cantieri') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.cantieri' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.rapportini t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.rapportini') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.rapportini' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.foto_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.foto_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.foto_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.timbrature t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.timbrature') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.timbrature' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.materiali_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.materiali_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.materiali_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.attrezzi_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.attrezzi_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.attrezzi_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.pagamenti_fornitori t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.pagamenti_fornitori') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.pagamenti_fornitori' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.acconti_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.acconti_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.acconti_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.incassi_non_fatturati t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.incassi_non_fatturati') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.incassi_non_fatturati' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.sal_lavorazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.sal_lavorazioni') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.sal_lavorazioni' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.preventivo_lavorazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.preventivo_lavorazioni') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.preventivo_lavorazioni' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.preventivi_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.preventivi_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.preventivi_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.varianti_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.varianti_cantiere') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.varianti_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.utenti_cantiere t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.utenti_cantiere') k WHERE jsonb_build_object('cantiere_id',t."cantiere_id",'user_id',t."user_id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.utenti_cantiere' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.economia_raccolte t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.economia_raccolte') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.economia_raccolte' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.memoria_prezzi t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.memoria_prezzi') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.memoria_prezzi' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.variante_lavorazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_lavorazioni') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.variante_lavorazioni' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.variante_documenti t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_documenti') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.variante_documenti' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.variante_sorgenti t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_sorgenti') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.variante_sorgenti' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.variante_fonti_memory t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_fonti_memory') k WHERE jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.variante_fonti_memory' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.variante_fonti_visive t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_fonti_visive') k WHERE jsonb_build_object('variante_id',t."variante_id",'source_type',t."source_type",'source_id',t."source_id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.variante_fonti_visive' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.variante_osservatore_analisi t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.variante_osservatore_analisi') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.variante_osservatore_analisi' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.economia_righe t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.economia_righe') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.economia_righe' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.economia_sorgenti t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.economia_sorgenti') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.economia_sorgenti' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.rapportino_prestazioni t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.rapportino_prestazioni') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.rapportino_prestazioni' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM public.rapportino_materiali t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'public.rapportino_materiali') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: public.rapportino_materiali' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM artecna_rapportini.richieste t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'artecna_rapportini.richieste') k WHERE jsonb_build_object('canale',t."canale",'utente_id',t."utente_id",'richiesta_id',t."richiesta_id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: artecna_rapportini.richieste' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'artecna_rapportini.allegati') k WHERE jsonb_build_object('id',t."id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: artecna_rapportini.allegati' USING ERRCODE='P2114'; END IF;
IF EXISTS(SELECT 1 FROM artecna_rapportini.f3c3_capability t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->'artecna_rapportini.f3c3_capability') k WHERE jsonb_build_object('foto_id',t."foto_id")=k.value)) THEN RAISE EXCEPTION 'Identita residua: artecna_rapportini.f3c3_capability' USING ERRCODE='P2114'; END IF;
 after_keep:=artecna_distruzione.hard_delete_preserved(cid,targets);
 IF preserved IS DISTINCT FROM after_keep THEN RAISE EXCEPTION 'Dati estranei/shared modificati' USING ERRCODE='P2114',DETAIL=(SELECT string_agg(key,', ' ORDER BY key) FROM jsonb_each(preserved) WHERE value IS DISTINCT FROM after_keep->key); END IF;
 conteggi:=conteggi||jsonb_build_object('storage_jobs_created',storage_nuovi,'storage_objects_preserved_shared',shared,'legal_records_preserved',legal_count,'legacy_resolved_deleted',legacy_count,'manifest_fingerprint',md5(targets::text),'public.cantieri',1,'public.utenti_cantiere',jsonb_array_length(targets->'public.utenti_cantiere'));
 storage_jobs_created:=storage_nuovi;storage_objects_preserved_shared:=shared;legal_records_preserved:=legal_count;legacy_resolved_deleted:=legacy_count;manifest_fingerprint:=md5(targets::text);
 cantiere_id:=cid;eliminato:=true;RETURN NEXT;
END $$;
ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO artecna_cantieri_delete_rpc;
REVOKE ALL ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) FROM PUBLIC,anon,service_role;
REVOKE DELETE ON public.cantieri FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.preflight_eliminazione_cantiere(p_cantiere_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE b text[];result jsonb; BEGIN
 IF artecna_guardie.utente_jwt_corrente() IS NULL OR NOT EXISTS(SELECT 1 FROM public.cantieri c JOIN public.utenti_cantiere u ON u.cantiere_id=c.id WHERE c.id=p_cantiere_id AND u.user_id=artecna_guardie.utente_jwt_corrente() AND u.ruolo='owner') THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE='42501'; END IF;
 b:=artecna_distruzione.hard_delete_blockers(p_cantiere_id);
 result:=jsonb_build_object('versione',1,'entita','cantiere','id',p_cantiere_id,'stato',CASE WHEN cardinality(b)=0 THEN 'eliminabile' ELSE 'bloccato' END,'verifica_completa',true,'categorie',CASE WHEN cardinality(b)=0 THEN '[]'::jsonb ELSE '["altri_collegamenti"]'::jsonb END,'azione_consigliata',CASE WHEN cardinality(b)=0 THEN 'conferma_eliminazione' ELSE 'segna_concluso' END,'blockers',to_jsonb(b),'verificato_at',statement_timestamp());
 RETURN result;
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function THEN RETURN jsonb_build_object('versione',1,'entita','cantiere','id',p_cantiere_id,'stato','non_verificabile','verifica_completa',false,'categorie','[]'::jsonb,'azione_consigliata','nessuna','verificato_at',statement_timestamp());END $$;
REVOKE ALL ON FUNCTION public.preflight_eliminazione_cantiere(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_cantiere(uuid) TO authenticated;
GRANT SELECT,INSERT,DELETE ON artecna_distruzione.hard_delete_plan TO artecna_cantieri_delete_rpc;
CREATE POLICY hard_delete_plan_rpc ON artecna_distruzione.hard_delete_plan TO artecna_cantieri_delete_rpc USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,DELETE ON artecna_distruzione.cleanup_storage TO artecna_cantieri_delete_rpc;
DO $$ BEGIN EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO artecna_cantieri_delete_rpc',pg_get_serial_sequence('artecna_distruzione.cleanup_storage','id')); END $$;
GRANT SELECT ON artecna_distruzione.storage_riferimenti,artecna_distruzione.legacy_sorgenti TO artecna_cantieri_delete_rpc;
GRANT SELECT,DELETE ON artecna_rapportini.allegati,artecna_rapportini.richieste,artecna_rapportini.f3c3_capability,public.rapportino_prestazioni,public.rapportino_materiali,public.memoria_prezzi TO artecna_cantieri_delete_rpc;
GRANT SELECT,UPDATE ON public.agenda_attivita TO artecna_cantieri_delete_rpc;
GRANT UPDATE(allegato_v1_id) ON public.foto_cantiere TO artecna_cantieri_delete_rpc;
GRANT SELECT ON public.fornitori_rettifiche,artecna_contabilita.attribuzioni_clienti TO artecna_cantieri_delete_rpc;
DO $acl$ DECLARE p record; BEGIN FOR p IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='artecna_distruzione'::regnamespace AND proname LIKE 'hard_delete_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO artecna_cantieri_delete_rpc',p.sig);
END LOOP;END $acl$;
REVOKE ALL ON artecna_distruzione.hard_delete_plan,artecna_distruzione.hard_delete_catalog_expected FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO artecna_distruzione.hard_delete_catalog_expected SELECT artecna_distruzione.hard_delete_catalog();
COMMIT;
