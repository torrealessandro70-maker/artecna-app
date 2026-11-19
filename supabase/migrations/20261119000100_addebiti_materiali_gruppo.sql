BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR to_regclass('artecna_addebiti.richieste') IS NULL
 OR to_regclass('artecna_addebiti.gruppi') IS NOT NULL THEN
 RAISE EXCEPTION 'Prerequisiti gruppo addebiti incompatibili'; END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR r.rolname IN ('postgres','artecna_varianti_rpc'))
 AND (pg_has_role('authenticated',r.oid,'USAGE') OR pg_has_role('authenticated',r.oid,'SET')))
 OR EXISTS(SELECT FROM pg_auth_members WHERE admin_option AND pg_has_role('authenticated',member,'MEMBER'))
 OR has_parameter_privilege('authenticated','session_replication_role','SET') THEN
 RAISE EXCEPTION 'Ruolo API privilegiato'; END IF;
END $$;
-- Audit separato: nessuna modifica alla RPC, alla tabella o ai record degli addebiti singoli.
CREATE TABLE artecna_addebiti.gruppi (
 richiesta uuid PRIMARY KEY, autore uuid NOT NULL, cantiere_id uuid NOT NULL,
 variante_id uuid NOT NULL UNIQUE, input jsonb NOT NULL, anteprima jsonb NOT NULL,
 netto numeric(18,2) NOT NULL CHECK(netto>0), creata_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE artecna_addebiti.righe_gruppo (
 richiesta uuid NOT NULL REFERENCES artecna_addebiti.gruppi(richiesta), materiale_id uuid NOT NULL,
 fattura_riga_id uuid NOT NULL, cantiere_id uuid NOT NULL, variante_id uuid NOT NULL,
 lavorazione_id bigint NOT NULL UNIQUE, quantita numeric NOT NULL CHECK(quantita>0),
 netto numeric(18,2) NOT NULL CHECK(netto>0), snapshot jsonb NOT NULL,
 PRIMARY KEY(richiesta,materiale_id)
);
ALTER TABLE artecna_addebiti.gruppi ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_addebiti.righe_gruppo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_addebiti.gruppi,artecna_addebiti.righe_gruppo FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX ON artecna_addebiti.righe_gruppo(materiale_id);
CREATE INDEX ON artecna_addebiti.righe_gruppo(fattura_riga_id);
CREATE INDEX ON artecna_addebiti.righe_gruppo(variante_id);

CREATE FUNCTION artecna_guardie.quantita_addebiti_gruppo(p_materiale uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce(sum(a.quantita),0) FROM artecna_addebiti.righe_gruppo a
 JOIN public.varianti_cantiere v ON v.id=a.variante_id WHERE a.materiale_id=p_materiale
 AND v.stato IN ('bozza','proposta','approvata')
$$;
CREATE FUNCTION artecna_guardie.gruppo_addebito_presente(p_tipo text,p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT CASE WHEN p_tipo='qualsiasi' THEN EXISTS(SELECT FROM artecna_addebiti.gruppi)
 ELSE EXISTS(SELECT FROM artecna_addebiti.righe_gruppo a WHERE CASE p_tipo
 WHEN 'variante' THEN a.variante_id=p_id WHEN 'materiale' THEN a.materiale_id=p_id
 WHEN 'riga' THEN a.fattura_riga_id=p_id WHEN 'cantiere' THEN a.cantiere_id=p_id ELSE false END) END
$$;
CREATE FUNCTION public.leggi_quote_addebito_gruppo(p_fattura uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE d jsonb; BEGIN
 d:=public.leggi_quote_addebito_cliente(p_fattura);
 RETURN coalesce((SELECT jsonb_agg(x||jsonb_build_object('disponibile',
 (x->>'disponibile')::numeric-artecna_guardie.quantita_addebiti_gruppo((x->>'materiale_id')::uuid)))
 FROM jsonb_array_elements(d) x),'[]'::jsonb);
END $$;

CREATE FUNCTION public.anteprima_addebiti_gruppo(p_cantiere uuid,p_righe jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE x jsonb; a jsonb; righe jsonb:='[]'; totale numeric:=0; contratto numeric; pid uuid; riservata numeric;
BEGIN
 IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),p_cantiere) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Gruppo non autorizzato' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_righe) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Elenco richiesto' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_righe) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT FROM jsonb_array_elements(p_righe) r
 GROUP BY r->>'materiale_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Numero quote o duplicati non validi' USING ERRCODE='22023'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_righe) ORDER BY value->>'materiale_id' LOOP
  IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR EXISTS(SELECT FROM jsonb_object_keys(x) k WHERE k NOT IN
  ('materiale_id','quantita','importo','iva_inclusa','aliquota','iva_confermata','descrizione','motivo','riferimento'))
  OR jsonb_typeof(x->'materiale_id') IS DISTINCT FROM 'string'
  OR jsonb_typeof(x->'quantita') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'importo') IS DISTINCT FROM 'number'
  OR jsonb_typeof(x->'aliquota') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'iva_inclusa') IS DISTINCT FROM 'boolean'
  OR x->'iva_confermata' IS DISTINCT FROM 'true'::jsonb
  OR jsonb_typeof(x->'descrizione') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'motivo') IS DISTINCT FROM 'string'
  OR jsonb_typeof(x->'riferimento') IS DISTINCT FROM 'string' THEN
  RAISE EXCEPTION 'Completa quote, prezzi e conferma IVA' USING ERRCODE='22023'; END IF;
  a:=public.anteprima_addebito_cliente((x->>'materiale_id')::uuid,(x->>'quantita')::numeric,(x->>'importo')::numeric,
   (x->>'iva_inclusa')::boolean,(x->>'aliquota')::numeric,x->>'descrizione',x->>'motivo',x->>'riferimento');
  IF a->>'cantiere_id' IS DISTINCT FROM p_cantiere::text THEN RAISE EXCEPTION 'Quote di cantieri diversi' USING ERRCODE='42501'; END IF;
  riservata:=artecna_guardie.quantita_addebiti_gruppo((x->>'materiale_id')::uuid);
  IF (x->>'quantita')::numeric+riservata > (a->'snapshot'->'materiale'->>'quantita')::numeric-(a->'snapshot'->>'riservata')::numeric THEN
  RAISE EXCEPTION 'Quota riservata o insufficiente' USING ERRCODE='23505'; END IF;
  IF pid IS NOT NULL AND (pid::text IS DISTINCT FROM a->>'contratto_id' OR contratto IS DISTINCT FROM (a->>'contratto_attuale')::numeric) THEN
  RAISE EXCEPTION 'Base contrattuale discordante' USING ERRCODE='22000'; END IF;
  pid:=(a->>'contratto_id')::uuid; contratto:=(a->>'contratto_attuale')::numeric;
  totale:=totale+(a->>'netto')::numeric;
  righe:=righe||jsonb_build_array(a||jsonb_build_object('riservata_gruppi',riservata));
 END LOOP;
 IF totale>=1e10 THEN RAISE EXCEPTION 'Totale fuori limite' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('versione',1,'cantiere_id',p_cantiere,'contratto_id',pid,'righe',righe,'netto',totale,
 'contratto_attuale',contratto,'contratto_dopo_approvazione',contratto+totale,
 'token',encode(sha256(convert_to(jsonb_build_array(p_cantiere,p_righe,righe)::text,'UTF8')),'hex'));
END $$;

-- Vincolo concorrente condiviso con il writer singolo, senza modificarne la definizione.
CREATE FUNCTION artecna_guardie.verifica_riserva_addebiti() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE q numeric; massimo numeric; BEGIN
 PERFORM 1 FROM public.cantieri WHERE id=NEW.cantiere_id FOR UPDATE;
 SELECT quantita INTO STRICT massimo FROM public.materiali_cantiere WHERE id=NEW.materiale_id FOR UPDATE;
 IF TG_TABLE_NAME='richieste' AND EXISTS(SELECT FROM artecna_addebiti.gruppi WHERE richiesta=NEW.richiesta)
 OR TG_TABLE_NAME='righe_gruppo' AND EXISTS(SELECT FROM artecna_addebiti.richieste WHERE richiesta=NEW.richiesta) THEN
 RAISE EXCEPTION 'Chiave gia utilizzata' USING ERRCODE='23505'; END IF;
 SELECT coalesce(sum(a.quantita),0) INTO q FROM artecna_addebiti.richieste a JOIN public.varianti_cantiere v ON v.id=a.variante_id
 WHERE a.materiale_id=NEW.materiale_id AND v.stato IN ('bozza','proposta','approvata');
 IF q+artecna_guardie.quantita_addebiti_gruppo(NEW.materiale_id)>massimo THEN
 RAISE EXCEPTION 'Quantita gia riservata' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER addebiti_riserva_singola AFTER INSERT ON artecna_addebiti.richieste FOR EACH ROW EXECUTE FUNCTION artecna_guardie.verifica_riserva_addebiti();
CREATE TRIGGER addebiti_riserva_gruppo AFTER INSERT ON artecna_addebiti.righe_gruppo FOR EACH ROW EXECUTE FUNCTION artecna_guardie.verifica_riserva_addebiti();

CREATE FUNCTION public.crea_addebiti_gruppo(p_richiesta uuid,p_cantiere uuid,p_righe jsonb,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); g artecna_addebiti.gruppi; a jsonb; r jsonb;
 vid uuid; lid bigint; n integer:=0; lavori bigint[]:='{}'; input jsonb:=jsonb_build_array(p_cantiere,p_righe,p_token);
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Richiesto READ COMMITTED' USING ERRCODE='40001'; END IF;
 IF p_richiesta IS NULL OR u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Gruppo non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_richiesta::text,0));
 SELECT * INTO g FROM artecna_addebiti.gruppi WHERE richiesta=p_richiesta;
 IF FOUND THEN
  IF g.autore<>u OR g.input IS DISTINCT FROM input THEN RAISE EXCEPTION 'Chiave riutilizzata con altri dati' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('variante_id',g.variante_id,'netto',g.netto,'riutilizzata',true);
 END IF;
 IF EXISTS(SELECT FROM artecna_addebiti.richieste WHERE richiesta=p_richiesta) THEN RAISE EXCEPTION 'Chiave gia utilizzata' USING ERRCODE='23505'; END IF;
 PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
 -- Validazione preliminare prima di costruire i lock dai parametri del client.
 a:=public.anteprima_addebiti_gruppo(p_cantiere,p_righe);
 PERFORM 1 FROM public.materiali_cantiere WHERE id IN(SELECT (value->>'materiale_id')::uuid FROM jsonb_array_elements(p_righe)) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.fatture_fornitori_righe WHERE id IN(SELECT (value->>'fattura_riga_id')::uuid FROM jsonb_array_elements(a->'righe')) ORDER BY id FOR UPDATE;
 a:=public.anteprima_addebiti_gruppo(p_cantiere,p_righe);
 IF a->>'token' IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Anteprima cambiata' USING ERRCODE='40001'; END IF;
 INSERT INTO public.varianti_cantiere(cantiere_id,preventivo_contrattuale_id,titolo,descrizione,stato)
 VALUES(p_cantiere,(a->>'contratto_id')::uuid,'Addebiti materiali al cliente','Gruppo materiali con provenienza UUID verificata','bozza') RETURNING id INTO vid;
 FOR r IN SELECT value FROM jsonb_array_elements(a->'righe') LOOP
  n:=n+1;
  INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,note)
  VALUES(vid,n,'nuova',r->>'descrizione','corpo',1,(r->>'netto')::numeric,(r->>'netto')::numeric,
   'Quota UUID '||(r->>'materiale_id')||'; motivo: '||(r->>'motivo')||'; accordo: '||(r->>'riferimento')) RETURNING id INTO lid;
  lavori:=array_append(lavori,lid);
 END LOOP;
 INSERT INTO artecna_addebiti.gruppi(richiesta,autore,cantiere_id,variante_id,input,anteprima,netto)
 VALUES(p_richiesta,u,p_cantiere,vid,input,a,(a->>'netto')::numeric);
 n:=0;
 FOR r IN SELECT value FROM jsonb_array_elements(a->'righe') LOOP
  n:=n+1;
  INSERT INTO artecna_addebiti.righe_gruppo(richiesta,materiale_id,fattura_riga_id,cantiere_id,variante_id,lavorazione_id,quantita,netto,snapshot)
  VALUES(p_richiesta,(r->>'materiale_id')::uuid,(r->>'fattura_riga_id')::uuid,p_cantiere,vid,lavori[n],(r->>'quantita')::numeric,(r->>'netto')::numeric,r);
 END LOOP;
 RETURN jsonb_build_object('variante_id',vid,'netto',(a->>'netto')::numeric,'riutilizzata',false);
END $$;

CREATE FUNCTION artecna_guardie.verifica_addebito_gruppo(p_variante uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE g artecna_addebiti.gruppi; a artecna_addebiti.righe_gruppo; m public.materiali_cantiere; r public.fatture_fornitori_righe; q numeric;
BEGIN
 SELECT * INTO g FROM artecna_addebiti.gruppi WHERE variante_id=p_variante;
 IF NOT FOUND THEN RETURN; END IF;
 IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),g.cantiere_id) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Transizione gruppo non autorizzata' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.variante_lavorazioni WHERE variante_id=p_variante)<>jsonb_array_length(g.anteprima->'righe')
 OR (SELECT count(*) FROM artecna_addebiti.righe_gruppo WHERE variante_id=p_variante)<>jsonb_array_length(g.anteprima->'righe')
 OR (SELECT sum(netto) FROM artecna_addebiti.righe_gruppo WHERE variante_id=p_variante) IS DISTINCT FROM g.netto THEN
 RAISE EXCEPTION 'Gruppo incompleto' USING ERRCODE='22000'; END IF;
 FOR a IN SELECT * FROM artecna_addebiti.righe_gruppo WHERE variante_id=p_variante ORDER BY materiale_id LOOP
  SELECT * INTO STRICT m FROM public.materiali_cantiere WHERE id=a.materiale_id FOR UPDATE;
  SELECT * INTO STRICT r FROM public.fatture_fornitori_righe WHERE id=a.fattura_riga_id;
  SELECT coalesce(sum(x.quantita),0) INTO q FROM artecna_addebiti.richieste x JOIN public.varianti_cantiere v ON v.id=x.variante_id
  WHERE x.materiale_id=m.id AND v.stato IN ('bozza','proposta','approvata');
  IF to_jsonb(m) IS DISTINCT FROM a.snapshot->'snapshot'->'materiale'
  OR (to_jsonb(r)-'stato') IS DISTINCT FROM ((a.snapshot->'snapshot'->'riga')-'stato')
  OR q+artecna_guardie.quantita_addebiti_gruppo(m.id)>m.quantita
  OR artecna_guardie.nc_tipo(r.fattura_id)='TD04'
  OR NOT EXISTS(SELECT FROM public.variante_lavorazioni l WHERE l.id=a.lavorazione_id AND l.variante_id=p_variante
   AND l.operazione='nuova' AND l.quantita_delta=1 AND l.prezzo_unitario=a.netto AND l.delta_contratto=a.netto
   AND l.descrizione=a.snapshot->>'descrizione' AND l.unita_misura='corpo') THEN
  RAISE EXCEPTION 'Provenienza gruppo incoerente' USING ERRCODE='22000'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION artecna_guardie.verifica_riserve_variante(p_variante uuid,p_stato text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a record; q numeric; massimo numeric; cid uuid; BEGIN
 IF p_stato NOT IN ('bozza','proposta','approvata') THEN RETURN; END IF;
 IF NOT EXISTS(SELECT FROM artecna_addebiti.richieste WHERE variante_id=p_variante)
 AND NOT EXISTS(SELECT FROM artecna_addebiti.gruppi WHERE variante_id=p_variante) THEN RETURN; END IF;
 SELECT cantiere_id INTO cid FROM public.varianti_cantiere WHERE id=p_variante;
 IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),cid) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Riserve non autorizzate' USING ERRCODE='42501'; END IF;
 FOR a IN SELECT materiale_id,sum(quantita) quantita FROM (
  SELECT materiale_id,quantita FROM artecna_addebiti.richieste WHERE variante_id=p_variante
  UNION ALL SELECT materiale_id,quantita FROM artecna_addebiti.righe_gruppo WHERE variante_id=p_variante
 ) x GROUP BY materiale_id ORDER BY materiale_id LOOP
  SELECT quantita INTO STRICT massimo FROM public.materiali_cantiere WHERE id=a.materiale_id FOR UPDATE;
  SELECT coalesce(sum(x.quantita),0) INTO q FROM (
   SELECT materiale_id,quantita,variante_id FROM artecna_addebiti.richieste
   UNION ALL SELECT materiale_id,quantita,variante_id FROM artecna_addebiti.righe_gruppo
  ) x JOIN public.varianti_cantiere v ON v.id=x.variante_id
  WHERE x.materiale_id=a.materiale_id AND v.id<>p_variante AND v.stato IN ('bozza','proposta','approvata');
  IF q+a.quantita>massimo THEN RAISE EXCEPTION 'Quantita riservata da altra Variante' USING ERRCODE='23505'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION artecna_guardie.proteggi_addebiti_gruppo() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE coinvolge boolean; BEGIN
 IF TG_TABLE_SCHEMA='artecna_addebiti' THEN RAISE EXCEPTION 'Audit gruppo immutabile' USING ERRCODE='55000'; END IF;
 IF TG_OP='TRUNCATE' THEN
  IF artecna_guardie.gruppo_addebito_presente('qualsiasi',NULL) THEN RAISE EXCEPTION 'Gruppi tracciati presenti' USING ERRCODE='55000'; END IF;
  RETURN NULL;
 END IF;
 IF TG_TABLE_NAME='varianti_cantiere' THEN
  IF TG_OP='UPDATE' THEN PERFORM artecna_guardie.verifica_riserve_variante(OLD.id,NEW.stato); END IF;
  IF artecna_guardie.gruppo_addebito_presente('variante',OLD.id) THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Annullare la bozza, conservare il gruppo' USING ERRCODE='55000'; END IF;
   IF current_user<>'artecna_varianti_rpc' OR NEW.cantiere_id IS DISTINCT FROM OLD.cantiere_id
   OR NEW.preventivo_contrattuale_id IS DISTINCT FROM OLD.preventivo_contrattuale_id THEN
   RAISE EXCEPTION 'Usare il flusso Variante autorizzato' USING ERRCODE='42501'; END IF;
   PERFORM artecna_guardie.verifica_addebito_gruppo(OLD.id);
  END IF;
 ELSIF TG_TABLE_NAME IN ('variante_lavorazioni','variante_sorgenti') THEN
  coinvolge:=CASE WHEN TG_OP='INSERT' THEN false ELSE artecna_guardie.gruppo_addebito_presente('variante',OLD.variante_id) END;
  IF TG_OP<>'DELETE' THEN coinvolge:=coinvolge OR artecna_guardie.gruppo_addebito_presente('variante',NEW.variante_id); END IF;
  IF coinvolge THEN RAISE EXCEPTION 'Righe gruppo congelate' USING ERRCODE='55000'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)=to_jsonb(OLD) OR TG_TABLE_NAME='fatture_fornitori_righe' AND to_jsonb(NEW)-'stato'=to_jsonb(OLD)-'stato') THEN RETURN NEW; END IF;
  IF artecna_guardie.gruppo_addebito_presente(CASE TG_TABLE_NAME WHEN 'materiali_cantiere' THEN 'materiale' ELSE 'riga' END,OLD.id) THEN
   RAISE EXCEPTION 'Sorgente gruppo tracciata' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER gruppo_variante_guard BEFORE UPDATE OR DELETE ON public.varianti_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo();
CREATE TRIGGER gruppo_voce_guard BEFORE INSERT OR UPDATE OR DELETE ON public.variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo();
CREATE TRIGGER gruppo_sorgente_guard BEFORE INSERT OR UPDATE OR DELETE ON public.variante_sorgenti FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo();
CREATE TRIGGER gruppo_materiale_guard BEFORE UPDATE OR DELETE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo();
CREATE TRIGGER gruppo_fattura_guard BEFORE UPDATE OR DELETE ON public.fatture_fornitori_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['varianti_cantiere','variante_lavorazioni','variante_sorgenti','materiali_cantiere','fatture_fornitori_righe'] LOOP
  EXECUTE format('CREATE TRIGGER gruppi_truncate_guard BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['gruppi','righe_gruppo'] LOOP
  EXECUTE format('CREATE TRIGGER audit_immutabile BEFORE UPDATE OR DELETE ON artecna_addebiti.%I FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo()',t);
  EXECUTE format('CREATE TRIGGER audit_truncate BEFORE TRUNCATE ON artecna_addebiti.%I FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebiti_gruppo()',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION artecna_guardie.quantita_addebiti_gruppo(uuid),artecna_guardie.gruppo_addebito_presente(text,uuid),artecna_guardie.verifica_addebito_gruppo(uuid),artecna_guardie.verifica_riserva_addebiti(),artecna_guardie.verifica_riserve_variante(uuid,text),artecna_guardie.proteggi_addebiti_gruppo() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_guardie.gruppo_addebito_presente(text,uuid),artecna_guardie.verifica_addebito_gruppo(uuid),artecna_guardie.verifica_riserve_variante(uuid,text)
 TO authenticated,service_role,artecna_varianti_rpc,artecna_sal_rpc,artecna_economia_rpc,artecna_ponte_economia_rpc,artecna_cantieri_delete_rpc;
REVOKE ALL ON FUNCTION public.leggi_quote_addebito_gruppo(uuid),public.anteprima_addebiti_gruppo(uuid,jsonb),public.crea_addebiti_gruppo(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_quote_addebito_gruppo(uuid),public.anteprima_addebiti_gruppo(uuid,jsonb),public.crea_addebiti_gruppo(uuid,uuid,jsonb,text) TO authenticated;
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
