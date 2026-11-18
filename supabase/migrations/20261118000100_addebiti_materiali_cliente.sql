BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR to_regprocedure('public.importa_sal_accordato(uuid,uuid,bigint[])') IS NULL
 OR to_regnamespace('artecna_addebiti') IS NOT NULL THEN
 RAISE EXCEPTION 'Prerequisiti addebiti incompatibili'; END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR r.rolname IN ('postgres','artecna_varianti_rpc'))
 AND (pg_has_role('authenticated',r.oid,'USAGE') OR pg_has_role('authenticated',r.oid,'SET')))
 OR EXISTS(SELECT FROM pg_auth_members WHERE admin_option AND pg_has_role('authenticated',member,'MEMBER'))
 OR has_parameter_privilege('authenticated','session_replication_role','SET') THEN
 RAISE EXCEPTION 'Ruolo API privilegiato'; END IF;
 IF EXISTS(SELECT FROM pg_class WHERE oid IN ('public.materiali_cantiere'::regclass,'public.fatture_fornitori_righe'::regclass,'public.varianti_cantiere'::regclass,'public.variante_lavorazioni'::regclass,'public.variante_sorgenti'::regclass)
 AND (pg_has_role('authenticated',relowner,'USAGE') OR pg_has_role('authenticated',relowner,'SET'))) THEN
 RAISE EXCEPTION 'Ruolo API proprietario delle tabelle'; END IF;
END $$;
-- Audit privato immutabile, come gli accordi contrattuali. Nessun backfill.
-- Gli UUID sono verificati atomicamente; nessuna FK/cascata aggiunta al cleanup V3.
CREATE SCHEMA artecna_addebiti;
REVOKE ALL ON SCHEMA artecna_addebiti FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE artecna_addebiti.richieste (
 richiesta uuid PRIMARY KEY, autore uuid NOT NULL, materiale_id uuid NOT NULL,
 fattura_riga_id uuid NOT NULL, cantiere_id uuid NOT NULL, variante_id uuid NOT NULL UNIQUE,
 lavorazione_id bigint NOT NULL UNIQUE, quantita numeric NOT NULL CHECK(quantita>0),
 netto numeric(18,2) NOT NULL CHECK(netto>0), input jsonb NOT NULL,
 snapshot jsonb NOT NULL, creata_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE artecna_addebiti.richieste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_addebiti.richieste FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION artecna_guardie.addebito_presente(p_tipo text,p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT FROM artecna_addebiti.richieste a WHERE
 CASE p_tipo WHEN 'qualsiasi' THEN true WHEN 'variante' THEN a.variante_id=p_id WHEN 'materiale' THEN a.materiale_id=p_id
 WHEN 'riga' THEN a.fattura_riga_id=p_id WHEN 'cantiere' THEN a.cantiere_id=p_id ELSE false END)
$$;

CREATE FUNCTION public.leggi_quote_addebito_cliente(p_fattura uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); risultato jsonb;
BEGIN
 IF artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Lettura fattura non autorizzata' USING ERRCODE='42501'; END IF;
 IF artecna_guardie.nc_tipo(p_fattura)='TD04' THEN
 RAISE EXCEPTION 'Nota credito non addebitabile' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('materiale_id',m.id,'fattura_riga_id',r.id,
 'cantiere_id',c.id,'cantiere',c.nome,'descrizione',m.descrizione,'quantita',m.quantita,
 'unita_misura',m.unita_misura,'costo',m.totale,'disponibile',m.quantita-coalesce((
 SELECT sum(a.quantita) FROM artecna_addebiti.richieste a JOIN public.varianti_cantiere v ON v.id=a.variante_id
 WHERE a.materiale_id=m.id AND v.stato IN ('bozza','proposta','approvata')),0)) ORDER BY r.numero_riga,m.id),'[]'::jsonb)
 INTO risultato FROM public.materiali_cantiere m JOIN public.fatture_fornitori_righe r ON r.id=m.fattura_riga_id
 JOIN public.cantieri c ON c.id=m.cantiere_id WHERE r.fattura_id=p_fattura
 AND artecna_guardie.utente_puo_modificare_cantiere(u,c.id);
 RETURN risultato;
END $$;

CREATE FUNCTION public.anteprima_addebito_cliente(p_materiale uuid,p_quantita numeric,p_importo numeric,
 p_iva_inclusa boolean,p_aliquota numeric,p_descrizione text,p_motivo text,p_riferimento text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE m public.materiali_cantiere; r public.fatture_fornitori_righe; c public.cantieri;
 p public.preventivi_cantiere; usata numeric; netto numeric; base numeric; delta numeric; snap jsonb;
BEGIN
 SELECT * INTO m FROM public.materiali_cantiere WHERE id=p_materiale;
 IF NOT FOUND OR artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),m.cantiere_id) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Quota non autorizzata' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT r FROM public.fatture_fornitori_righe WHERE id=m.fattura_riga_id;
 SELECT * INTO STRICT c FROM public.cantieri WHERE id=m.cantiere_id;
 SELECT * INTO p FROM public.preventivi_cantiere WHERE id=c.preventivo_contrattuale_id AND cantiere_id=c.id;
 IF NOT FOUND OR c.destinazione_amministrativa='archivio_acquisti_personali' OR p.natura='integrativo' OR artecna_guardie.nc_tipo(r.fattura_id)='TD04' THEN
 RAISE EXCEPTION 'Contratto o documento non verificabile' USING ERRCODE='22023'; END IF;
 IF p_quantita IS NULL OR NOT(p_quantita>0 AND p_quantita<1e12 AND p_quantita=round(p_quantita,6))
 OR p_importo IS NULL OR NOT(p_importo>0 AND p_importo<1e10 AND p_importo=round(p_importo,2))
 OR p_iva_inclusa IS NULL OR p_aliquota IS NULL OR NOT(p_aliquota>=0 AND p_aliquota<=100 AND p_aliquota=round(p_aliquota,2))
 OR nullif(btrim(p_descrizione),'') IS NULL OR length(p_descrizione)>2000
 OR nullif(btrim(p_motivo),'') IS NULL OR length(p_motivo)>2000
 OR nullif(btrim(p_riferimento),'') IS NULL OR length(p_riferimento)>500 THEN
 RAISE EXCEPTION 'Dati addebito non validi' USING ERRCODE='22023'; END IF;
 IF m.quantita IS NULL OR NOT(m.quantita>0 AND m.quantita<1e12 AND m.quantita=round(m.quantita,6))
 OR m.prezzo_unitario IS NULL OR NOT(m.prezzo_unitario>=0 AND m.prezzo_unitario<1e12)
 OR m.totale IS DISTINCT FROM round(m.quantita*m.prezzo_unitario,2)
 OR nullif(btrim(m.unita_misura),'') IS NULL OR r.quantita IS NULL OR NOT(r.quantita>0 AND r.quantita<1e12)
 OR artecna_guardie.materiali_fattura_totale(r.id)>r.quantita THEN
 RAISE EXCEPTION 'Costo o quantita sorgente incoerenti' USING ERRCODE='22000'; END IF;
 -- Le quote Economia rimangono nel ponte esistente; non sono riassegnate qui.
 SELECT coalesce(sum(a.quantita),0) INTO usata FROM artecna_addebiti.richieste a
 JOIN public.varianti_cantiere v ON v.id=a.variante_id WHERE a.materiale_id=m.id AND v.stato IN ('bozza','proposta','approvata');
 IF p_quantita>m.quantita-usata THEN RAISE EXCEPTION 'Quota gia riservata o oltre disponibilita' USING ERRCODE='23505'; END IF;
 netto:=CASE WHEN p_iva_inclusa THEN round(p_importo/(1+p_aliquota/100),2) ELSE p_importo END;
 IF netto<=0 THEN RAISE EXCEPTION 'Imponibile nullo' USING ERRCODE='22023'; END IF;
 base:=CASE WHEN p.accordo_contrattuale IS NULL THEN p.importo_totale ELSE (p.accordo_contrattuale->>'importo_concordato')::numeric END;
 IF p.accordo_contrattuale IS NOT NULL AND (p.accordo_contrattuale->>'versione' IS DISTINCT FROM '1'
 OR p.accordo_contrattuale->>'cantiere_id' IS DISTINCT FROM c.id::text
 OR p.accordo_contrattuale->>'preventivo_id' IS DISTINCT FROM p.id::text) THEN
 RAISE EXCEPTION 'Identita accordo non verificabile' USING ERRCODE='22000'; END IF;
 IF base IS NULL OR NOT(base>0 AND base<1e12 AND base=round(base,2)) THEN
 RAISE EXCEPTION 'Base contrattuale non verificabile' USING ERRCODE='22000'; END IF;
 IF EXISTS(SELECT FROM public.varianti_cantiere v WHERE v.cantiere_id=c.id AND v.stato='approvata'
 AND (v.preventivo_contrattuale_id<>p.id OR v.importo_delta_approvato IS NULL)) THEN
 RAISE EXCEPTION 'Varianti approvate non coerenti' USING ERRCODE='22000'; END IF;
 SELECT coalesce(sum(v.importo_delta_approvato),0) INTO delta FROM public.varianti_cantiere v WHERE v.cantiere_id=c.id AND v.stato='approvata';
 snap:=jsonb_build_object('materiale',to_jsonb(m),'riga',to_jsonb(r),'contratto',to_jsonb(p),
 'cantiere',to_jsonb(c),'delta',delta,'riservata',usata);
 RETURN jsonb_build_object('versione',1,'materiale_id',m.id,'fattura_id',r.fattura_id,'fattura_riga_id',r.id,
 'cantiere_id',c.id,'cantiere',c.nome,'contratto_id',p.id,'quantita',p_quantita,'unita_misura',m.unita_misura,
 'costo_originale_quota',round(m.prezzo_unitario*p_quantita,2),'netto',netto,'importo_inserito',p_importo,
 'iva_inclusa',p_iva_inclusa,'aliquota',p_aliquota,'contratto_attuale',base+delta,'contratto_dopo_approvazione',base+delta+netto,
 'descrizione',btrim(p_descrizione),'motivo',btrim(p_motivo),'riferimento',btrim(p_riferimento),
 'token',encode(sha256(convert_to(snap::text,'UTF8')),'hex'),'snapshot',snap);
END $$;

CREATE FUNCTION public.crea_addebito_cliente(p_richiesta uuid,p_materiale uuid,p_quantita numeric,p_importo numeric,
 p_iva_inclusa boolean,p_aliquota numeric,p_descrizione text,p_motivo text,p_riferimento text,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a artecna_addebiti.richieste; input jsonb; preview jsonb; cid uuid; vid uuid; lid bigint; u uuid:=artecna_guardie.utente_jwt_corrente();
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Richiesto READ COMMITTED' USING ERRCODE='40001'; END IF;
 IF p_richiesta IS NULL OR u IS NULL THEN RAISE EXCEPTION 'Richiesta non valida' USING ERRCODE='42501'; END IF;
 SELECT cantiere_id INTO cid FROM public.materiali_cantiere WHERE id=p_materiale;
 IF artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Addebito non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_richiesta::text,0));
 input:=jsonb_build_array(p_materiale,p_quantita,p_importo,p_iva_inclusa,p_aliquota,p_descrizione,p_motivo,p_riferimento,p_token);
 SELECT * INTO a FROM artecna_addebiti.richieste WHERE richiesta=p_richiesta;
 IF FOUND THEN
 IF a.autore<>u OR a.input IS DISTINCT FROM input THEN RAISE EXCEPTION 'Richiesta riutilizzata con altri dati' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('variante_id',a.variante_id,'netto',a.netto,'riutilizzata',true); END IF;
 PERFORM 1 FROM public.cantieri WHERE id=cid FOR UPDATE;
 PERFORM 1 FROM public.materiali_cantiere WHERE id=p_materiale FOR UPDATE;
 PERFORM 1 FROM public.fatture_fornitori_righe WHERE id=(SELECT fattura_riga_id FROM public.materiali_cantiere WHERE id=p_materiale) FOR UPDATE;
 preview:=public.anteprima_addebito_cliente(p_materiale,p_quantita,p_importo,p_iva_inclusa,p_aliquota,p_descrizione,p_motivo,p_riferimento);
 IF preview->>'token' IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Dati cambiati: rileggere anteprima' USING ERRCODE='40001'; END IF;
 INSERT INTO public.varianti_cantiere(cantiere_id,preventivo_contrattuale_id,titolo,descrizione,stato)
 VALUES(cid,(preview->>'contratto_id')::uuid,'Addebito materiale al cliente',p_descrizione||E'\nMotivo: '||p_motivo||E'\nAccordo: '||p_riferimento,'bozza') RETURNING id INTO vid;
 -- Una macro-voce a corpo mantiene la quadratura anche per quantita frazionarie.
 -- La quantita fisica e la U.M. restano nello snapshot di provenienza verificato.
 INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,note)
 VALUES(vid,1,'nuova',p_descrizione,'corpo',1,(preview->>'netto')::numeric,(preview->>'netto')::numeric,
 'Addebito fattura fornitore; riga UUID '||(preview->>'fattura_riga_id')||'; quota UUID '||p_materiale||'; quantita '||p_quantita||' '||(preview->>'unita_misura')||'; accordo '||p_riferimento) RETURNING id INTO lid;
 INSERT INTO artecna_addebiti.richieste(richiesta,autore,materiale_id,fattura_riga_id,cantiere_id,variante_id,lavorazione_id,quantita,netto,input,snapshot)
 VALUES(p_richiesta,u,p_materiale,(preview->>'fattura_riga_id')::uuid,cid,vid,lid,p_quantita,(preview->>'netto')::numeric,input,preview);
 RETURN jsonb_build_object('variante_id',vid,'netto',(preview->>'netto')::numeric,'riutilizzata',false);
END $$;

CREATE FUNCTION artecna_guardie.verifica_addebito(p_variante uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a artecna_addebiti.richieste; m public.materiali_cantiere; r public.fatture_fornitori_righe;
BEGIN
 SELECT * INTO a FROM artecna_addebiti.richieste WHERE variante_id=p_variante;
 IF NOT FOUND THEN RETURN; END IF;
 IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),a.cantiere_id) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Transizione addebito non autorizzata' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT m FROM public.materiali_cantiere WHERE id=a.materiale_id FOR UPDATE;
 SELECT * INTO STRICT r FROM public.fatture_fornitori_righe WHERE id=a.fattura_riga_id;
 IF artecna_guardie.nc_tipo(r.fattura_id)='TD04'
 OR to_jsonb(m) IS DISTINCT FROM a.snapshot->'snapshot'->'materiale'
 OR (to_jsonb(r)-'stato') IS DISTINCT FROM ((a.snapshot->'snapshot'->'riga')-'stato')
 OR (SELECT sum(x.quantita) FROM artecna_addebiti.richieste x JOIN public.varianti_cantiere v ON v.id=x.variante_id
 WHERE x.materiale_id=m.id AND v.stato IN ('bozza','proposta','approvata'))>m.quantita
 OR (SELECT count(*) FROM public.variante_lavorazioni WHERE variante_id=p_variante)<>1
 OR NOT EXISTS(SELECT FROM public.variante_lavorazioni l WHERE l.id=a.lavorazione_id AND l.variante_id=p_variante
 AND l.operazione='nuova' AND l.quantita_delta=1 AND l.prezzo_unitario=a.netto AND l.delta_contratto=a.netto
 AND l.descrizione=a.snapshot->>'descrizione' AND l.unita_misura='corpo') THEN
 RAISE EXCEPTION 'Provenienza addebito incoerente' USING ERRCODE='22000'; END IF;
END $$;

CREATE FUNCTION artecna_guardie.proteggi_addebito_cliente() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE coinvolge boolean;
BEGIN
 IF TG_OP='TRUNCATE' THEN
 IF artecna_guardie.addebito_presente('qualsiasi',NULL) THEN
 RAISE EXCEPTION 'Provenienza addebiti presente: TRUNCATE non consentito' USING ERRCODE='55000'; END IF;
 RETURN NULL; END IF;
 IF TG_TABLE_NAME='varianti_cantiere' THEN
 IF TG_OP='INSERT' THEN RETURN NEW; END IF;
 IF artecna_guardie.addebito_presente('variante',OLD.id) THEN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Conservare provenienza addebito: annullare la bozza' USING ERRCODE='55000'; END IF;
 IF current_user<>'artecna_varianti_rpc' OR NEW.cantiere_id<>OLD.cantiere_id OR NEW.preventivo_contrattuale_id<>OLD.preventivo_contrattuale_id THEN
 RAISE EXCEPTION 'Addebito tramite flusso Variante autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM artecna_guardie.verifica_addebito(OLD.id);
 END IF;
 ELSIF TG_TABLE_NAME IN ('variante_lavorazioni','variante_sorgenti') THEN
 coinvolge:=CASE WHEN TG_OP='INSERT' THEN false ELSE artecna_guardie.addebito_presente('variante',OLD.variante_id) END;
 IF TG_OP<>'DELETE' THEN coinvolge:=coinvolge OR artecna_guardie.addebito_presente('variante',NEW.variante_id); END IF;
 IF coinvolge THEN RAISE EXCEPTION 'Lavorazione addebito congelata: annullare la bozza per sostituirla' USING ERRCODE='55000'; END IF;
 ELSE
 IF TG_OP='INSERT' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)=to_jsonb(OLD) OR (TG_TABLE_NAME='fatture_fornitori_righe' AND to_jsonb(NEW)-'stato'=to_jsonb(OLD)-'stato')) THEN RETURN NEW; END IF;
 coinvolge:=artecna_guardie.addebito_presente(CASE TG_TABLE_NAME WHEN 'materiali_cantiere' THEN 'materiale' ELSE 'riga' END,OLD.id);
 IF coinvolge THEN RAISE EXCEPTION 'Sorgente addebito tracciata: riconciliazione necessaria' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER addebito_variante_guard BEFORE UPDATE OR DELETE ON public.varianti_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_voce_guard BEFORE INSERT OR UPDATE OR DELETE ON public.variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_sorgente_guard BEFORE INSERT OR UPDATE OR DELETE ON public.variante_sorgenti FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_materiale_guard BEFORE UPDATE OR DELETE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_fattura_riga_guard BEFORE UPDATE OR DELETE ON public.fatture_fornitori_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_variante_truncate_guard BEFORE TRUNCATE ON public.varianti_cantiere FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_voce_truncate_guard BEFORE TRUNCATE ON public.variante_lavorazioni FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_sorgente_truncate_guard BEFORE TRUNCATE ON public.variante_sorgenti FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_materiale_truncate_guard BEFORE TRUNCATE ON public.materiali_cantiere FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
CREATE TRIGGER addebito_fattura_riga_truncate_guard BEFORE TRUNCATE ON public.fatture_fornitori_righe FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.proteggi_addebito_cliente();
REVOKE ALL ON FUNCTION artecna_guardie.addebito_presente(text,uuid),artecna_guardie.verifica_addebito(uuid),artecna_guardie.proteggi_addebito_cliente() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_guardie.addebito_presente(text,uuid),artecna_guardie.verifica_addebito(uuid)
 TO authenticated,service_role,artecna_varianti_rpc,artecna_sal_rpc,artecna_economia_rpc,artecna_ponte_economia_rpc,artecna_cantieri_delete_rpc;
REVOKE ALL ON FUNCTION public.leggi_quote_addebito_cliente(uuid),public.anteprima_addebito_cliente(uuid,numeric,numeric,boolean,numeric,text,text,text),public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_quote_addebito_cliente(uuid),public.anteprima_addebito_cliente(uuid,numeric,numeric,boolean,numeric,text,text,text),public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text) TO authenticated;
-- Le RPC SAL/Varianti, i sei producer e Cron restano byte-per-byte invariati.
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
