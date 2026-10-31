-- Esclusione esplicita non economica: nessuna cancellazione/backfill/cambio del costo.
BEGIN;
DO $pre$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint)') IS NOT NULL THEN RAISE EXCEPTION 'Principal o collisione esclusione'; END IF;
 IF EXISTS(SELECT 1 FROM public.economia_righe WHERE dettagli_analitici ? 'proposta_non_economica') THEN RAISE EXCEPTION 'Chiave esclusione già presente'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='0c064e16872e5a2f31d73cffac17f20d' FROM pg_proc WHERE oid='public.valorizza_materiale_economia(uuid, uuid, numeric, bigint)'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner public.valorizza_materiale_economia'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='172115b175a2eb9b0901fcb1094494d1' FROM pg_proc WHERE oid='public.leggi_raccolta_economia_cliente(uuid)'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner public.leggi_raccolta_economia_cliente'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='82c23e29b11154286a88d25234a5000e' FROM pg_proc WHERE oid='public.leggi_raccolte_economia_cliente(uuid)'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner public.leggi_raccolte_economia_cliente'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='bc94e52575bc436bf7223450ce60e879' FROM pg_proc WHERE oid='public.usa_raccolta_economia_cliente_in_variante(uuid, bigint)'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner public.usa_raccolta_economia_cliente_in_variante'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='a13a7627253142072bae9ecedf0e3f71' FROM pg_proc WHERE oid='artecna_guardie.certifica_snapshot_cliente(jsonb)'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner artecna_guardie.certifica_snapshot_cliente'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='fb2973a0323e3962334e679aece0106a' FROM pg_proc WHERE oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner artecna_guardie.proteggi_ponte_economia'; END IF;
 IF (SELECT proowner=current_user::regrole AND md5(pg_get_functiondef(oid))='5901857536602bddecbf561c6420f155' FROM pg_proc WHERE oid='artecna_guardie.materiali_economia_stato()'::regprocedure) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Baseline/owner artecna_guardie.materiali_economia_stato'; END IF;
END $pre$;
CREATE FUNCTION artecna_guardie.riga_esclusa_proposta(e public.economia_righe) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $f$
DECLARE j jsonb; BEGIN
 j:=e.dettagli_analitici->'proposta_non_economica'; IF j IS NULL THEN RETURN false; END IF;
 IF e.tipo_riga<>'materiale' OR jsonb_typeof(j)<>'object' OR j->>'versione' IS DISTINCT FROM '1' OR jsonb_typeof(j->'esclusa') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(j->'motivo') IS DISTINCT FROM 'string' OR length(trim(j->>'motivo')) NOT BETWEEN 10 AND 1000 OR jsonb_typeof(j->'storico') IS DISTINCT FROM 'array' OR jsonb_array_length(j->'storico')=0
 OR j->'storico'->-1->'esclusa' IS DISTINCT FROM j->'esclusa' OR j->'storico'->-1->>'motivo' IS DISTINCT FROM j->>'motivo' THEN RAISE EXCEPTION 'Esclusione non verificabile' USING ERRCODE='22023'; END IF;
 IF (j->>'esclusa')::boolean AND (e.quantita IS NULL OR e.quantita<=0 OR e.quantita::text IN ('NaN','Infinity','-Infinity') OR artecna_guardie.prezzo_materiale_cliente(e) IS DISTINCT FROM 0::numeric) THEN RAISE EXCEPTION 'Solo riga a valore zero escludibile' USING ERRCODE='22023'; END IF;
 RETURN (j->>'esclusa')::boolean;
END $f$;
CREATE FUNCTION artecna_guardie.proteggi_esclusione_proposta() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $f$
DECLARE a jsonb; b jsonb; r public.economia_raccolte%rowtype; BEGIN
 IF TG_OP='DELETE' THEN IF OLD.dettagli_analitici ? 'proposta_non_economica' THEN RAISE EXCEPTION 'Storico esclusione persistente' USING ERRCODE='55000'; END IF; RETURN OLD; END IF;
 a:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.dettagli_analitici->'proposta_non_economica' END; b:=NEW.dettagli_analitici->'proposta_non_economica';
 IF a IS NOT DISTINCT FROM b THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR current_user<>'postgres' OR b IS NULL THEN RAISE EXCEPTION 'Classificazione non autorizzata' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=OLD.raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF (to_jsonb(NEW)-ARRAY['dettagli_analitici','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['dettagli_analitici','updated_at']) OR (NEW.dettagli_analitici-'proposta_non_economica') IS DISTINCT FROM (OLD.dettagli_analitici-'proposta_non_economica')
 OR b->'storico' IS DISTINCT FROM coalesce(a->'storico','[]'::jsonb)||jsonb_build_array(b->'storico'->-1)
 OR (b->'storico'->-1->>'utente')::uuid IS DISTINCT FROM artecna_guardie.utente_jwt_corrente() OR (b->'storico'->-1->>'revisione_precedente')::bigint IS DISTINCT FROM r.revisione THEN RAISE EXCEPTION 'Storico o provenienza modificati' USING ERRCODE='22023'; END IF;
 PERFORM artecna_guardie.riga_esclusa_proposta(NEW); RETURN NEW;
END $f$;
CREATE TRIGGER e32_esclusione_proposta BEFORE INSERT OR UPDATE OR DELETE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_esclusione_proposta();
CREATE FUNCTION public.classifica_riga_non_economica(p_raccolta_id uuid,p_riga_id uuid,p_esclusa boolean,p_motivo text,p_revisione_attesa bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$

DECLARE uid uuid; cid uuid; r public.economia_raccolte%rowtype; e public.economia_righe%rowtype; j jsonb;
BEGIN
 uid:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF uid IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'Raccolta non autorizzata' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=uid AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF p_revisione_attesa IS NULL OR r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION 'Revisione Economia divergente' USING ERRCODE='PT409'; END IF;
 SELECT * INTO e FROM public.economia_righe WHERE id=p_riga_id AND raccolta_id=r.id FOR UPDATE;
 IF NOT FOUND OR e.tipo_riga<>'materiale' THEN RAISE EXCEPTION 'Registrazione materiale non valida' USING ERRCODE='22023'; END IF;

 IF p_esclusa IS NULL OR p_motivo IS NULL OR length(trim(p_motivo)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Motivo esplicito richiesto (10-1000 caratteri)' USING ERRCODE='22023'; END IF;
 IF p_esclusa=artecna_guardie.riga_esclusa_proposta(e) THEN RAISE EXCEPTION 'Classificazione già presente' USING ERRCODE='22023'; END IF;
 IF p_esclusa AND artecna_guardie.prezzo_materiale_cliente(e) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Solo riga a valore zero escludibile' USING ERRCODE='22023'; END IF;
 IF e.fattura_riga_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.fatture_fornitori_righe f WHERE f.id=e.fattura_riga_id AND artecna_guardie.nc_tipo(f.fattura_id)='TD04') THEN RAISE EXCEPTION 'TD04 esclusa dal percorso' USING ERRCODE='22023'; END IF;
 IF e.origine='fattura_fornitore' THEN PERFORM artecna_guardie.verifica_materiale_fattura_economia(e); END IF;
 j:=jsonb_build_object('versione',1,'esclusa',p_esclusa,'motivo',trim(p_motivo),'storico',coalesce(e.dettagli_analitici->'proposta_non_economica'->'storico','[]'::jsonb)||jsonb_build_array(jsonb_build_object('esclusa',p_esclusa,'motivo',trim(p_motivo),'utente',uid,'at',clock_timestamp(),'revisione_precedente',r.revisione)));
 UPDATE public.economia_righe SET dettagli_analitici=coalesce(dettagli_analitici,'{}'::jsonb)||jsonb_build_object('proposta_non_economica',j),updated_at=now() WHERE id=e.id RETURNING * INTO e;
 UPDATE public.economia_raccolte SET revisione=revisione+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_build_object('raccolta',to_jsonb(r),'riga',to_jsonb(e),'esclusa',p_esclusa);
END $f$;
CREATE FUNCTION artecna_guardie.certifica_snapshot_esclusioni(snap jsonb) RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $f$

DECLARE rid uuid; registrazioni jsonb; totale numeric; incluse integer; r public.economia_raccolte%rowtype;
BEGIN
 rid:=(snap->>'raccolta_id')::uuid;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=rid;
 IF NOT FOUND OR r.stato<>'chiusa' OR snap->>'versione_prezzi_cliente' IS DISTINCT FROM '1' OR snap->>'cantiere_id' IS DISTINCT FROM r.cantiere_id::text
 OR snap->>'titolo' IS DISTINCT FROM r.titolo OR snap->>'data' IS DISTINCT FROM r.data::text OR (snap->>'numero')::integer IS DISTINCT FROM r.numero OR snap->>'note' IS DISTINCT FROM r.note OR (snap->>'revisione_sorgente') IS NULL OR (snap->>'revisione_sorgente')::bigint NOT IN (r.revisione,r.revisione-1) OR (snap->>'revisione_congelata')::bigint IS DISTINCT FROM r.revisione THEN RAISE EXCEPTION 'Snapshot cliente non certificato' USING ERRCODE='XX001'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',e.id,'ordine',e.ordine,'descrizione',e.descrizione,'unita_misura',e.unita_misura,'quantita',e.quantita,
 'prezzo_unitario',artecna_guardie.prezzo_materiale_cliente(e),'importo',round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2),
 'note',e.note,'origine',e.origine,'sorgente_id',e.sorgente_id,'indice_voce_sorgente',e.indice_voce_sorgente,'tipo_riga',e.tipo_riga,'dettagli_analitici',e.dettagli_analitici,'esclusa_proposta',artecna_guardie.riga_esclusa_proposta(e)) ORDER BY ordine,id),sum(round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)) FILTER(WHERE NOT artecna_guardie.riga_esclusa_proposta(e))
 INTO registrazioni,totale FROM public.economia_righe e WHERE raccolta_id=rid;
 SELECT count(*) INTO incluse FROM public.economia_righe e WHERE raccolta_id=rid AND NOT artecna_guardie.riga_esclusa_proposta(e);
 IF snap->>'versione_esclusioni' IS DISTINCT FROM '1' OR incluse=0 OR (snap->>'numero_incluse')::integer IS DISTINCT FROM incluse OR (snap->>'numero_escluse')::integer IS DISTINCT FROM jsonb_array_length(registrazioni)-incluse THEN RAISE EXCEPTION 'Conteggi esclusione incoerenti' USING ERRCODE='XX001'; END IF;
 IF registrazioni IS NULL OR snap->'registrazioni' IS DISTINCT FROM registrazioni OR (snap->>'totale')::numeric IS DISTINCT FROM totale
 OR (snap->>'numero_registrazioni')::integer IS DISTINCT FROM jsonb_array_length(registrazioni) OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE raccolta_id=rid AND NOT artecna_guardie.riga_esclusa_proposta(e) AND (e.quantita<=0 OR artecna_guardie.prezzo_materiale_cliente(e) IS NULL OR artecna_guardie.prezzo_materiale_cliente(e)<=0 OR round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)<=0)) THEN RAISE EXCEPTION 'Riconciliazione snapshot cliente divergente' USING ERRCODE='XX001'; END IF;
END
$f$;
CREATE OR REPLACE FUNCTION public.valorizza_materiale_economia(p_raccolta_id uuid, p_riga_id uuid, p_prezzo_cliente numeric, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE uid uuid; cid uuid; r public.economia_raccolte%rowtype; e public.economia_righe%rowtype; j jsonb;
BEGIN
 uid:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF uid IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'Raccolta non autorizzata' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=uid AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF p_revisione_attesa IS NULL OR r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION 'Revisione Economia divergente' USING ERRCODE='PT409'; END IF;
 SELECT * INTO e FROM public.economia_righe WHERE id=p_riga_id AND raccolta_id=r.id FOR UPDATE;
 IF NOT FOUND OR e.tipo_riga<>'materiale' THEN RAISE EXCEPTION 'Registrazione materiale non valida' USING ERRCODE='22023'; END IF;
 IF artecna_guardie.riga_esclusa_proposta(e) THEN RAISE EXCEPTION 'Ripristinare inclusione prima di valorizzare' USING ERRCODE='22023'; END IF;
 IF e.quantita IS NULL OR e.quantita<=0 OR e.quantita::text IN ('NaN','Infinity','-Infinity') OR p_prezzo_cliente IS NULL OR p_prezzo_cliente::text IN ('NaN','Infinity','-Infinity') OR p_prezzo_cliente<=0 OR p_prezzo_cliente>=1000000000000 OR p_prezzo_cliente<>round(p_prezzo_cliente,6)
 OR round(e.quantita*p_prezzo_cliente,2)<=0 OR round(e.quantita*p_prezzo_cliente,2)>=10000000000000000 THEN RAISE EXCEPTION 'Prezzo cliente non valido' USING ERRCODE='22023'; END IF;
 IF e.fattura_riga_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.fatture_fornitori_righe f WHERE f.id=e.fattura_riga_id AND artecna_guardie.nc_tipo(f.fattura_id)='TD04') THEN RAISE EXCEPTION 'TD04 escluso dal prezzo cliente materiali ordinario' USING ERRCODE='22023'; END IF;
 IF e.origine='fattura_fornitore' THEN PERFORM artecna_guardie.verifica_materiale_fattura_economia(e); END IF;
 j:=jsonb_build_object('versione',1,'prezzo',p_prezzo_cliente,'storico',coalesce(e.dettagli_analitici->'cliente_materiale'->'storico','[]'::jsonb)||jsonb_build_array(jsonb_build_object('prezzo',p_prezzo_cliente,'precedente',artecna_guardie.prezzo_materiale_cliente(e),'utente',uid,'at',clock_timestamp(),'revisione_precedente',r.revisione)));
 UPDATE public.economia_righe SET dettagli_analitici=coalesce(dettagli_analitici,'{}'::jsonb)||jsonb_build_object('cliente_materiale',j),updated_at=now() WHERE id=e.id RETURNING * INTO e;
 UPDATE public.economia_raccolte SET revisione=revisione+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_build_object('raccolta',to_jsonb(r),'riga',to_jsonb(e),'prezzo_cliente',p_prezzo_cliente,'totale_riga',round(e.quantita*p_prezzo_cliente,2));
END $function$
;

CREATE OR REPLACE FUNCTION artecna_guardie.materiali_economia_stato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE fid uuid; BEGIN
 IF TG_OP='UPDATE' AND (NEW.dettagli_analitici-ARRAY['cliente_materiale','proposta_non_economica']) IS NOT DISTINCT FROM (OLD.dettagli_analitici-ARRAY['cliente_materiale','proposta_non_economica'])
 AND (to_jsonb(NEW)-ARRAY['dettagli_analitici','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['dettagli_analitici','updated_at']) THEN RETURN NULL; END IF;
 SELECT fattura_id INTO fid FROM public.fatture_fornitori_righe WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.fattura_riga_id ELSE NEW.fattura_riga_id END;
 IF fid IS NOT NULL THEN PERFORM artecna_guardie.materiali_fattura_stato(fid); END IF;
 RETURN NULL;
END $function$
;

CREATE OR REPLACE FUNCTION public.leggi_raccolta_economia_cliente(p_raccolta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE d jsonb; c public.economia_raccolte%rowtype; uid uuid; BEGIN
 uid:=artecna_guardie.utente_jwt_corrente(); SELECT * INTO c FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF NOT FOUND OR uid IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(uid,c.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Raccolta non autorizzata' USING ERRCODE='42501'; END IF;
 d:=jsonb_build_object('raccolta',to_jsonb(c),'sorgenti',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY created_at,id) FROM public.economia_sorgenti s WHERE raccolta_id=c.id),'[]'::jsonb));
 RETURN d||jsonb_build_object('numero_registrazioni',(SELECT count(*) FROM public.economia_righe WHERE raccolta_id=c.id),'numero_escluse',(SELECT count(*) FROM public.economia_righe e WHERE raccolta_id=c.id AND artecna_guardie.riga_esclusa_proposta(e)), 'totale',(SELECT sum(round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)) FILTER(WHERE NOT artecna_guardie.riga_esclusa_proposta(e)) FROM public.economia_righe e WHERE raccolta_id=p_raccolta_id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe e WHERE raccolta_id=p_raccolta_id AND NOT artecna_guardie.riga_esclusa_proposta(e) AND artecna_guardie.prezzo_materiale_cliente(e) IS NULL),
 'righe',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('prezzo_unitario_origine',e.prezzo_unitario,'prezzo_unitario',artecna_guardie.prezzo_materiale_cliente(e),'totale',round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2),'esclusa_proposta',artecna_guardie.riga_esclusa_proposta(e),'motivo_esclusione',e.dettagli_analitici->'proposta_non_economica'->>'motivo') ORDER BY ordine,id) FROM public.economia_righe e WHERE raccolta_id=p_raccolta_id),'[]'::jsonb));
END $function$
;

CREATE OR REPLACE FUNCTION public.leggi_raccolte_economia_cliente(p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE originali jsonb; v jsonb; d jsonb; risultato jsonb:='[]'; BEGIN
 IF artecna_guardie.utente_jwt_corrente() IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY numero),'[]'::jsonb) INTO originali FROM public.economia_raccolte r WHERE cantiere_id=p_cantiere_id;
 FOR v IN SELECT value FROM jsonb_array_elements(originali) LOOP
 d:=public.leggi_raccolta_economia_cliente((v->>'id')::uuid);
 risultato:=risultato||jsonb_build_array(v||jsonb_build_object('totale',d->'totale','righe_non_valorizzate',d->'righe_non_valorizzate','numero_registrazioni',d->'numero_registrazioni','numero_escluse',d->'numero_escluse'));
 END LOOP; RETURN risultato; END $function$
;

CREATE OR REPLACE FUNCTION public.usa_raccolta_economia_cliente_in_variante(p_raccolta_id uuid, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE utente uuid; cid uuid; c public.cantieri%rowtype; r public.economia_raccolte%rowtype;
 v public.varianti_cantiere%rowtype; s public.variante_sorgenti%rowtype; es public.economia_sorgenti%rowtype;
 er public.economia_righe%rowtype; revision_s bigint; revision_f bigint; registrazioni jsonb:='[]'; snap jsonb;
 prezzo_cliente numeric; importo numeric(18,2); totale numeric(18,2):=0; n integer:=0; collegata uuid; riuso boolean:=false; voce jsonb; esclusa boolean; indice integer:=0; con_esclusioni boolean:=true;
BEGIN
 IF current_user<>'postgres' THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto RPC non consentito'; END IF;
 IF p_raccolta_id IS NULL OR p_revisione_attesa IS NULL OR p_revisione_attesa<0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Input acquisizione non valido'; END IF;
 utente:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF utente IS NULL OR cid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acquisizione non autorizzata'; END IF;
 SELECT * INTO c FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(utente,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=utente AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(utente,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 -- Nessun lock Preventivo prima della Variante; il cantiere ne serializza il riferimento.
 IF c.preventivo_contrattuale_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere
   WHERE id=c.preventivo_contrattuale_id AND cantiere_id=cid) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto contrattuale non valido'; END IF;
 SELECT variante_id INTO collegata FROM public.variante_sorgenti
   WHERE economia_raccolta_id=p_raccolta_id AND tipo='raccolta_economia';
 IF collegata IS NOT NULL THEN
   SELECT * INTO v FROM public.varianti_cantiere WHERE id=collegata FOR UPDATE;
   IF NOT FOUND OR v.cantiere_id<>cid OR v.preventivo_contrattuale_id<>c.preventivo_contrattuale_id THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Variante collegata incoerente'; END IF;
   riuso:=true;
 END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id AND cantiere_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta non autorizzata'; END IF;
 IF riuso THEN
   SELECT * INTO s FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia';
   IF NOT FOUND OR s.variante_id<>v.id OR r.stato<>'chiusa' OR r.revisione<>s.economia_revisione_congelata THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Collegamento Economia incoerente'; END IF;
   revision_s:=s.economia_revisione_sorgente; revision_f:=s.economia_revisione_congelata;
 ELSE
   IF r.revisione<>p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;
   IF r.stato NOT IN ('bozza','chiusa') THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato Economia incoerente'; END IF;
   revision_s:=r.revisione;
   IF r.stato='bozza' AND r.revisione=9223372036854775807 THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione non rappresentabile'; END IF;
   revision_f:=r.revisione+CASE WHEN r.stato='bozza' THEN 1 ELSE 0 END;
 END IF;
 IF riuso THEN con_esclusioni:=s.snapshot->>'versione_esclusioni'='1'; END IF;
 -- Le sorgenti precedono le righe, entrambe ordinate, dopo la testata Raccolta.
 PERFORM id FROM public.economia_sorgenti WHERE raccolta_id=r.id ORDER BY id FOR SHARE;
 FOR er IN SELECT * FROM public.economia_righe WHERE raccolta_id=r.id ORDER BY ordine,id FOR SHARE LOOP
   prezzo_cliente:=artecna_guardie.prezzo_materiale_cliente(er);
   esclusa:=artecna_guardie.riga_esclusa_proposta(er);
   IF NOT esclusa AND (er.quantita<=0 OR prezzo_cliente IS NULL OR prezzo_cliente<=0
     OR er.quantita::text IN ('NaN','Infinity','-Infinity') OR prezzo_cliente::text IN ('NaN','Infinity','-Infinity')
     OR er.descrizione !~ '[^[:space:]]') THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile'; END IF;
   importo:=round(er.quantita*prezzo_cliente,2);
   IF NOT esclusa AND importo<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importo Economia non rappresentabile'; END IF;
   IF er.origine='fattura_fornitore' THEN
     PERFORM artecna_guardie.verifica_materiale_fattura_economia(er);
   ELSIF er.origine='rapportino' THEN
     PERFORM artecna_guardie.verifica_riga_economia_rapportino(er,NOT riuso);
   ELSE
   es:=NULL;
   IF er.tipo_riga<>'generica' THEN
     SELECT * INTO es FROM public.economia_sorgenti WHERE id=er.sorgente_id AND raccolta_id=r.id;
     IF NOT FOUND OR es.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica non valida'; END IF;
   END IF;
   PERFORM public.economia_valida_dettagli(er.tipo_riga,er.dettagli_analitici-ARRAY['cliente_materiale','proposta_non_economica'],es.snapshot,es.snapshot_version,
     er.indice_voce_sorgente,er.quantita,er.prezzo_unitario,er.unita_misura,er.descrizione,true);
   END IF;
   IF NOT esclusa THEN n:=n+1; totale:=totale+importo; END IF;
   registrazioni:=registrazioni||jsonb_build_array(jsonb_build_object('id',er.id,'ordine',er.ordine,
     'descrizione',er.descrizione,'unita_misura',er.unita_misura,'quantita',er.quantita,'prezzo_unitario',prezzo_cliente,
     'importo',importo,'note',er.note,'origine',er.origine,'sorgente_id',er.sorgente_id,
     'indice_voce_sorgente',er.indice_voce_sorgente,'tipo_riga',er.tipo_riga,'dettagli_analitici',er.dettagli_analitici)||CASE WHEN con_esclusioni THEN jsonb_build_object('esclusa_proposta',esclusa) ELSE '{}'::jsonb END);
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Raccolta Economia vuota'; END IF;
 snap:=jsonb_build_object('raccolta_id',r.id,'cantiere_id',cid,'numero',r.numero,'titolo',r.titolo,'data',r.data,'note',r.note,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'totale',totale,'numero_registrazioni',jsonb_array_length(registrazioni),'registrazioni',registrazioni,'versione_prezzi_cliente',1);
 IF con_esclusioni THEN snap:=snap||jsonb_build_object('versione_esclusioni',1,'numero_incluse',n,'numero_escluse',jsonb_array_length(registrazioni)-n); END IF;
 IF NOT riuso THEN
   IF r.stato='bozza' THEN
     UPDATE public.economia_raccolte SET stato='chiusa',chiusa_at=current_timestamp,revisione=revisione+1,updated_at=now() WHERE id=r.id;
     SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id;
     IF r.stato<>'chiusa' OR r.revisione<>revision_f THEN
       RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Chiusura Economia incoerente'; END IF;
   END IF;
   INSERT INTO public.varianti_cantiere(cantiere_id,preventivo_contrattuale_id,numero,titolo,descrizione,stato,data_variante)
     VALUES(cid,c.preventivo_contrattuale_id,NULL,r.titolo,coalesce(r.note,''),'bozza',r.data) RETURNING * INTO v;
   INSERT INTO public.variante_sorgenti(variante_id,tipo,titolo,snapshot_version,snapshot,economia_raccolta_id,
     economia_revisione_sorgente,economia_revisione_congelata)
     VALUES(v.id,'raccolta_economia',r.titolo,1,snap,r.id,revision_s,revision_f) RETURNING * INTO s;
   n:=0;
   FOR voce IN SELECT value FROM jsonb_array_elements(registrazioni) LOOP
     IF voce->>'esclusa_proposta'='true' THEN indice:=indice+1; CONTINUE; END IF;
     INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,
       quantita_delta,prezzo_unitario,delta_contratto,note,variante_sorgente_id,indice_voce_sorgente,
       riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id)
     VALUES(v.id,n+1,'nuova',voce->>'descrizione',voce->>'unita_misura',(voce->>'quantita')::numeric,
       (voce->>'prezzo_unitario')::numeric,(voce->>'importo')::numeric,coalesce(voce->>'note',''),s.id,indice,NULL,NULL);
     n:=n+1; indice:=indice+1;
   END LOOP;
 END IF;
 IF s.snapshot IS DISTINCT FROM (CASE WHEN s.snapshot ? 'versione_prezzi_cliente' THEN snap ELSE snap-'versione_prezzi_cliente' END) THEN RAISE EXCEPTION 'Snapshot acquisito divergente' USING ERRCODE='XX001'; END IF;
 PERFORM artecna_guardie.certifica_snapshot_cliente(snap);
 IF EXISTS(SELECT 1 FROM (SELECT z.voce,z.idx,row_number() OVER(ORDER BY z.idx) nr FROM jsonb_array_elements(registrazioni) WITH ORDINALITY z(voce,idx) WHERE coalesce(z.voce->>'esclusa_proposta','false')='false') x
 LEFT JOIN public.variante_lavorazioni l ON l.variante_id=v.id AND l.variante_sorgente_id=s.id AND l.indice_voce_sorgente=x.idx-1
 WHERE l.id IS NULL OR ROW(l.numero_riga,l.operazione,l.descrizione,l.unita_misura,l.quantita_delta,l.prezzo_unitario,l.delta_contratto,l.note)
 IS DISTINCT FROM ROW(x.nr::integer,'nuova'::text,x.voce->>'descrizione',x.voce->>'unita_misura',(x.voce->>'quantita')::numeric,(x.voce->>'prezzo_unitario')::numeric,(x.voce->>'importo')::numeric,coalesce(x.voce->>'note',''))
 OR l.riferimento_preventivo_lavorazione_id IS NOT NULL OR l.riferimento_variante_lavorazione_id IS NOT NULL) THEN RAISE EXCEPTION 'Lavorazioni cliente divergenti dallo snapshot' USING ERRCODE='XX001'; END IF;
 IF (SELECT count(*) FROM public.variante_lavorazioni WHERE variante_id=v.id)<>n OR (SELECT sum(delta_contratto) FROM public.variante_lavorazioni WHERE variante_id=v.id) IS DISTINCT FROM totale THEN RAISE EXCEPTION 'Riconciliazione cliente incoerente' USING ERRCODE='XX001'; END IF;
 RETURN jsonb_build_object('versione_contratto',1,'riutilizzata',riuso,'raccolta_id',r.id,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'variante_id',v.id,'numero_variante',v.numero,
   'stato_variante',v.stato,'variante_sorgente_id',s.id,'numero_lavorazioni',n,'totale',totale)||CASE WHEN con_esclusioni THEN jsonb_build_object('versione_esclusioni',1,'numero_registrazioni',jsonb_array_length(registrazioni),'numero_incluse',n,'numero_escluse',jsonb_array_length(registrazioni)-n) ELSE '{}'::jsonb END;
EXCEPTION
 WHEN numeric_value_out_of_range OR invalid_text_representation THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile';
 WHEN serialization_failure OR deadlock_detected THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Conflitto concorrente Economia';
 WHEN SQLSTATE '22023' OR SQLSTATE '42501' OR SQLSTATE 'PT409' OR SQLSTATE 'XX001' THEN RAISE;
 WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Acquisizione Economia non completata';
END;
$function$
;

CREATE OR REPLACE FUNCTION artecna_guardie.certifica_snapshot_cliente(snap jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE rid uuid; registrazioni jsonb; totale numeric; r public.economia_raccolte%rowtype;
BEGIN
 IF snap->>'versione_esclusioni'='1' THEN PERFORM artecna_guardie.certifica_snapshot_esclusioni(snap); RETURN; END IF;
 rid:=(snap->>'raccolta_id')::uuid;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=rid;
 IF NOT FOUND OR r.stato<>'chiusa' OR snap->>'versione_prezzi_cliente' IS DISTINCT FROM '1' OR snap->>'cantiere_id' IS DISTINCT FROM r.cantiere_id::text
 OR snap->>'titolo' IS DISTINCT FROM r.titolo OR snap->>'data' IS DISTINCT FROM r.data::text OR (snap->>'numero')::integer IS DISTINCT FROM r.numero OR snap->>'note' IS DISTINCT FROM r.note OR (snap->>'revisione_sorgente') IS NULL OR (snap->>'revisione_sorgente')::bigint NOT IN (r.revisione,r.revisione-1) OR (snap->>'revisione_congelata')::bigint IS DISTINCT FROM r.revisione THEN RAISE EXCEPTION 'Snapshot cliente non certificato' USING ERRCODE='XX001'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',e.id,'ordine',e.ordine,'descrizione',e.descrizione,'unita_misura',e.unita_misura,'quantita',e.quantita,
 'prezzo_unitario',artecna_guardie.prezzo_materiale_cliente(e),'importo',round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2),
 'note',e.note,'origine',e.origine,'sorgente_id',e.sorgente_id,'indice_voce_sorgente',e.indice_voce_sorgente,'tipo_riga',e.tipo_riga,'dettagli_analitici',e.dettagli_analitici) ORDER BY ordine,id),sum(round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2))
 INTO registrazioni,totale FROM public.economia_righe e WHERE raccolta_id=rid;
 IF registrazioni IS NULL OR snap->'registrazioni' IS DISTINCT FROM registrazioni OR (snap->>'totale')::numeric IS DISTINCT FROM totale
 OR (snap->>'numero_registrazioni')::integer IS DISTINCT FROM jsonb_array_length(registrazioni) OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE raccolta_id=rid AND (e.quantita<=0 OR artecna_guardie.prezzo_materiale_cliente(e) IS NULL OR artecna_guardie.prezzo_materiale_cliente(e)<=0 OR round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)<=0)) THEN RAISE EXCEPTION 'Riconciliazione snapshot cliente divergente' USING ERRCODE='XX001'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_ponte_economia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE ids uuid[]; sorgenti uuid[]; v uuid; coinvolge boolean:=false;
 s public.variante_sorgenti%rowtype; r public.economia_raccolte%rowtype; voce jsonb;
BEGIN
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
REVOKE ALL ON FUNCTION artecna_guardie.riga_esclusa_proposta(public.economia_righe) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_esclusione_proposta() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION artecna_guardie.certifica_snapshot_esclusioni(jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) TO authenticated;
COMMIT;
