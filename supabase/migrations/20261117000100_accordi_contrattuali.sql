BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;
DO $$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' OR
 NOT EXISTS (SELECT FROM pg_auth_members WHERE roleid='artecna_sal_rpc'::regrole AND member='postgres'::regrole AND admin_option)
 OR pg_has_role('postgres','artecna_sal_rpc','SET')
 OR has_schema_privilege('artecna_sal_rpc','public','CREATE')
 OR has_schema_privilege('artecna_sal_rpc','artecna_guardie','CREATE') OR
 (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN
 RAISE EXCEPTION 'Identita o catalogo Hard Delete divergente'; END IF;
END $$;

ALTER TABLE public.preventivi_cantiere ADD COLUMN accordo_contrattuale jsonb;
ALTER TABLE public.sal_lavorazioni ADD COLUMN accordo_riga jsonb;
CREATE SCHEMA artecna_contratti;
REVOKE ALL ON SCHEMA artecna_contratti FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE artecna_contratti.accordi (
 richiesta uuid PRIMARY KEY, cantiere_id uuid NOT NULL, preventivo_id uuid NOT NULL,
 autore uuid NOT NULL, registrato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 input jsonb NOT NULL, documento_originale jsonb NOT NULL, snapshot jsonb NOT NULL
);
REVOKE ALL ON artecna_contratti.accordi FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE artecna_contratti.accordi ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION artecna_contratti.verifica_accesso(cid uuid, pid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); p public.preventivi_cantiere;
BEGIN
 IF artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.preventivi_cantiere WHERE id=pid;
 IF NOT FOUND OR (p.cantiere_id IS NOT NULL AND p.cantiere_id<>cid) OR p.natura='integrativo'
 OR p.variante_id IS NOT NULL OR p.preventivo_contrattuale_id IS NOT NULL THEN
 RAISE EXCEPTION 'Documento estraneo o integrativo' USING ERRCODE='22023'; END IF;
 -- Un documento storico privo di proprietario per UUID richiede un titolare.
 IF p.cantiere_id IS NULL AND NOT EXISTS (
 SELECT FROM public.utenti_impresa WHERE user_id=u AND attivo AND ruolo='titolare') THEN
 RAISE EXCEPTION 'Recupero storico non autorizzato o provenienza da verificare' USING ERRCODE='42501'; END IF;
 IF coalesce(nullif(btrim(p.file_path),''),nullif(btrim(p.file_url),'')) IS NULL THEN
 RAISE EXCEPTION 'PDF originale non disponibile' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT FROM public.preventivi_cantiere d WHERE d.id<>pid AND
 ((nullif(btrim(p.file_path),'') IS NOT NULL AND d.file_path=p.file_path) OR (nullif(btrim(p.file_url),'') IS NOT NULL AND d.file_url=p.file_url)))
 OR EXISTS (SELECT FROM public.cantieri WHERE id<>cid AND (preventivo_contrattuale_id=pid OR origine_preventivo_id=pid)) THEN
 RAISE EXCEPTION 'Documento duplicato o gia designato altrove' USING ERRCODE='22023'; END IF;
END $$;

CREATE FUNCTION public.candidati_accordo_contrattuale(p_cantiere uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c public.cantieri; titolare boolean;
BEGIN
 IF artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),p_cantiere) IS DISTINCT FROM true THEN
 RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT c FROM public.cantieri WHERE id=p_cantiere;
 SELECT EXISTS (SELECT FROM public.utenti_impresa WHERE user_id=artecna_guardie.utente_jwt_corrente() AND attivo AND ruolo='titolare') INTO titolare;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'nome_file',p.nome_file,'file_url',p.file_url,
 'file_path',p.file_path,'cantiere_id',p.cantiere_id,'provenienza_testuale',p.cantiere,'sopralluogo_id',p.sopralluogo_id,
 'accordo',p.accordo_contrattuale,'lavorazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'descrizione',l.descrizione,
 'quantita',l.quantita,'prezzo_unitario',l.prezzo_unitario,'unita_misura',l.unita_misura,'importo_previsto',l.importo_previsto) ORDER BY l.id),'[]')
 FROM public.preventivo_lavorazioni l WHERE l.preventivo_id=p.id)) ORDER BY p.id)
 FROM public.preventivi_cantiere p WHERE p.cantiere_id=c.id OR (titolare AND p.cantiere_id IS NULL AND p.cantiere=c.nome)), '[]');
END $$;

CREATE FUNCTION public.anteprima_accordo_contrattuale(p_cantiere uuid,p_preventivo uuid,p_voci jsonb,
 p_importo numeric,p_modalita text,p_motivo text,p_riferimento text,p_nota_documentale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE p public.preventivi_cantiere; c public.cantieri; righe jsonb; esistenti jsonb;
 totale numeric; target numeric; ripartite jsonb; token text;
BEGIN
 PERFORM artecna_contratti.verifica_accesso(p_cantiere,p_preventivo);
 SELECT * INTO p FROM public.preventivi_cantiere WHERE id=p_preventivo;
 SELECT * INTO c FROM public.cantieri WHERE id=p_cantiere;
 IF c.preventivo_contrattuale_id IS NOT NULL AND c.preventivo_contrattuale_id<>p_preventivo THEN
 RAISE EXCEPTION 'Il cantiere ha gia un altro contratto' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere)
 OR EXISTS (SELECT FROM public.sal_lavorazioni s JOIN public.preventivo_lavorazioni l ON l.id=s.source_lavorazione_id WHERE l.preventivo_id=p_preventivo)
 OR EXISTS (SELECT FROM public.variante_sorgenti WHERE preventivo_sorgente_id=p_preventivo)
 OR EXISTS (SELECT FROM public.variante_lavorazioni v JOIN public.preventivo_lavorazioni l ON l.id=v.riferimento_preventivo_lavorazione_id WHERE l.preventivo_id=p_preventivo)
 OR EXISTS (SELECT FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere AND stato='approvata') THEN
 RAISE EXCEPTION 'SAL o varianti esistenti: riconciliazione controllata necessaria' USING ERRCODE='55000'; END IF;
 IF p_importo IS NULL OR p_importo::text IN ('NaN','Infinity','-Infinity') OR p_importo<=0
 OR p_importo<>round(p_importo,2) OR p_importo>9000000000 OR p_modalita IS NULL
 OR p_modalita NOT IN ('a_corpo','a_misura') OR coalesce(length(btrim(p_motivo)),0) NOT BETWEEN 1 AND 500
 OR coalesce(length(btrim(p_riferimento)),0) NOT BETWEEN 1 AND 500
 OR coalesce(length(btrim(p_nota_documentale)),0)>2000 THEN
 RAISE EXCEPTION 'Accordo o riferimento non valido' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id),'[]') INTO esistenti
 FROM public.preventivo_lavorazioni l WHERE preventivo_id=p_preventivo;
 IF jsonb_array_length(esistenti)>0 THEN
 IF EXISTS (SELECT FROM jsonb_array_elements(esistenti) x WHERE x->>'cantiere_id' IS NOT NULL
 AND (x->>'cantiere_id')::uuid IS DISTINCT FROM p_cantiere) THEN
 RAISE EXCEPTION 'Lavorazioni con identita incompatibile' USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',x->'id','descrizione',x->'descrizione','quantita',x->'quantita',
 'unita_misura',x->'unita_misura','prezzo_unitario',x->'prezzo_unitario','importo_previsto',x->'importo_previsto') ORDER BY (x->>'id')::bigint)
 INTO righe FROM jsonb_array_elements(esistenti) x;
 IF p_voci IS DISTINCT FROM '[]'::jsonb AND p_voci IS DISTINCT FROM righe THEN
 RAISE EXCEPTION 'Le lavorazioni esistenti devono essere riutilizzate integralmente' USING ERRCODE='40001'; END IF;
 ELSE righe:=p_voci; END IF;
 IF righe IS NULL OR jsonb_typeof(righe)<>'array' OR jsonb_array_length(righe) NOT BETWEEN 1 AND 500 THEN
 RAISE EXCEPTION 'Verificare o inserire le lavorazioni originali' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT FROM jsonb_array_elements(righe) x WHERE
 coalesce(jsonb_typeof(x),'')<>'object' OR coalesce(jsonb_typeof(x->'quantita'),'')<>'number'
 OR coalesce(jsonb_typeof(x->'prezzo_unitario'),'')<>'number' OR coalesce(jsonb_typeof(x->'importo_previsto'),'')<>'number'
 OR coalesce(length(btrim(x->>'descrizione')),0) NOT BETWEEN 1 AND 2000
 OR coalesce(length(btrim(x->>'unita_misura')),0) NOT BETWEEN 1 AND 40) THEN
 RAISE EXCEPTION 'Campi lavorazione originali non validi' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT FROM jsonb_array_elements(righe) x WHERE
 (x->>'quantita')::numeric<=0 OR (x->>'prezzo_unitario')::numeric<0 OR (x->>'importo_previsto')::numeric<0
 OR (x->>'quantita')::numeric>1000000000 OR (x->>'prezzo_unitario')::numeric>9000000000
 OR (x->>'quantita')::numeric<>round((x->>'quantita')::numeric,6)
 OR (x->>'prezzo_unitario')::numeric<>round((x->>'prezzo_unitario')::numeric,6)
 OR (x->>'importo_previsto')::numeric<>round((x->>'importo_previsto')::numeric,2)
 OR round((x->>'quantita')::numeric*(x->>'prezzo_unitario')::numeric,2)<>(x->>'importo_previsto')::numeric) THEN
 RAISE EXCEPTION 'Quantita, prezzo o quadratura originali non validi' USING ERRCODE='22023'; END IF;
 SELECT sum((x->>'importo_previsto')::numeric) INTO totale FROM jsonb_array_elements(righe) x;
 IF totale<=0 OR totale>9000000000 OR p_importo>totale THEN
 RAISE EXCEPTION 'Importo concordato superiore alla base o base non valida' USING ERRCODE='22023'; END IF;
 target:=p_importo*100;
 -- Resti maggiori: allocazione intera dei centesimi, parita risolta per ordine originale.
 WITH raw AS (SELECT x,ord,(x->>'importo_previsto')::numeric*100 AS centesimi FROM jsonb_array_elements(righe) WITH ORDINALITY r(x,ord)),
 quote AS (SELECT *,floor(centesimi*target/(totale*100)) AS quota,
 mod(centesimi*target,totale*100) AS resto FROM raw),
 rank AS (SELECT *,row_number() OVER (ORDER BY resto DESC,ord) AS posto,sum(quota) OVER () AS somma FROM quote),
 finali AS (SELECT *, (quota+CASE WHEN posto<=target-somma THEN 1 ELSE 0 END)/100 AS importo FROM rank)
 SELECT jsonb_agg(x||jsonb_build_object('ordine',ord,'importo_contrattuale',importo,
 'prezzo_unitario_contrattuale',round((x->>'prezzo_unitario')::numeric*p_importo/totale,12),
 'conguaglio',importo-round((x->>'quantita')::numeric*(x->>'prezzo_unitario')::numeric*p_importo/totale,2)) ORDER BY ord) INTO ripartite FROM finali;
 token:=encode(sha256(convert_to(to_jsonb(p)::text||esistenti::text||to_jsonb(c)::text,'UTF8')),'hex');
 RETURN jsonb_build_object('versione',1,'token',token,'cantiere_id',p_cantiere,'preventivo_id',p_preventivo,
 'revisione',coalesce((p.accordo_contrattuale->>'revisione')::integer,0)+1,'importo_documento',p.importo_totale,
 'totale_originale',totale,'importo_concordato',p_importo,'ribasso_percentuale',round((totale-p_importo)*100/totale,12),
 'modalita',p_modalita,'motivo',btrim(p_motivo),'riferimento',btrim(p_riferimento),'nota_documentale',p_nota_documentale,
 'file_path',p.file_path,'file_url',p.file_url,'nome_file',p.nome_file,'provenienza_testuale',p.cantiere,
 'proprietario_documento','non_registrato','righe',ripartite);
END $$;

CREATE FUNCTION public.conferma_accordo_contrattuale(p_richiesta uuid,p_cantiere uuid,p_preventivo uuid,
 p_voci jsonb,p_importo numeric,p_modalita text,p_motivo text,p_riferimento text,p_nota_documentale text,
 p_token text,p_conferma text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE input jsonb; precedente artecna_contratti.accordi; snapshot jsonb; originale jsonb; r jsonb; lid bigint; righe jsonb:='[]';
BEGIN
 PERFORM artecna_contratti.verifica_accesso(p_cantiere,p_preventivo);
 IF p_richiesta IS NULL OR p_conferma IS DISTINCT FROM 'CONFERMA CONTRATTO' THEN
 RAISE EXCEPTION 'Conferma esplicita obbligatoria' USING ERRCODE='22023'; END IF;
 input:=jsonb_build_array(p_cantiere,p_preventivo,p_voci,p_importo,p_modalita,p_motivo,p_riferimento,p_nota_documentale,p_token,p_conferma);
 -- Stesso ordine dei lock per richieste ripetute e concorrenti.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_richiesta::text,0));
 SELECT * INTO precedente FROM artecna_contratti.accordi WHERE richiesta=p_richiesta;
 IF FOUND THEN
 IF precedente.input IS DISTINCT FROM input OR precedente.autore IS DISTINCT FROM artecna_guardie.utente_jwt_corrente() THEN
 RAISE EXCEPTION 'Richiesta riutilizzata con dati diversi' USING ERRCODE='23505'; END IF;
 RETURN precedente.snapshot; END IF;
 LOCK TABLE public.sal_lavorazioni,public.preventivo_lavorazioni,public.varianti_cantiere IN SHARE ROW EXCLUSIVE MODE;
 PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
 SELECT to_jsonb(p) INTO originale FROM public.preventivi_cantiere p WHERE id=p_preventivo FOR UPDATE;
 snapshot:=public.anteprima_accordo_contrattuale(p_cantiere,p_preventivo,p_voci,p_importo,p_modalita,p_motivo,p_riferimento,p_nota_documentale);
 IF snapshot->>'token' IS DISTINCT FROM p_token THEN
 RAISE EXCEPTION 'Anteprima obsoleta: ripetere la verifica' USING ERRCODE='40001'; END IF;
 originale:=originale||jsonb_build_object('lavorazioni_originali',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY id),'[]') FROM public.preventivo_lavorazioni l WHERE preventivo_id=p_preventivo));
 IF NOT EXISTS (SELECT FROM public.preventivo_lavorazioni WHERE preventivo_id=p_preventivo) THEN
 FOR r IN SELECT value FROM jsonb_array_elements(snapshot->'righe') LOOP
 INSERT INTO public.preventivo_lavorazioni(cantiere,cantiere_id,preventivo_id,descrizione,quantita,unita_misura,prezzo_unitario,importo_previsto)
 SELECT nome,p_cantiere,p_preventivo,r->>'descrizione',(r->>'quantita')::numeric,r->>'unita_misura',
 (r->>'prezzo_unitario')::numeric,(r->>'importo_previsto')::numeric FROM public.cantieri WHERE id=p_cantiere RETURNING id INTO lid;
 righe:=righe||jsonb_build_array(r||jsonb_build_object('id',lid)); END LOOP;
 ELSE
 UPDATE public.preventivo_lavorazioni SET cantiere_id=p_cantiere WHERE preventivo_id=p_preventivo AND cantiere_id IS NULL;
 righe:=snapshot->'righe'; END IF;
 snapshot:=snapshot||jsonb_build_object('righe',righe,'richiesta',p_richiesta,'autore',artecna_guardie.utente_jwt_corrente(),'data',clock_timestamp());
 INSERT INTO artecna_contratti.accordi VALUES(p_richiesta,p_cantiere,p_preventivo,artecna_guardie.utente_jwt_corrente(),clock_timestamp(),input,originale,snapshot);
 UPDATE public.preventivi_cantiere SET cantiere_id=p_cantiere,accordo_contrattuale=snapshot WHERE id=p_preventivo;
 UPDATE public.cantieri SET preventivo_contrattuale_id=p_preventivo WHERE id=p_cantiere;
 RETURN snapshot;
END $$;

CREATE FUNCTION artecna_guardie.valore_base_accordato(p_lavorazione bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE l public.preventivo_lavorazioni; a jsonb; r jsonb;
BEGIN
 SELECT * INTO l FROM public.preventivo_lavorazioni WHERE id=p_lavorazione;
 SELECT accordo_contrattuale INTO a FROM public.preventivi_cantiere WHERE id=l.preventivo_id;
 IF a IS NULL THEN RETURN jsonb_build_object('importo',l.importo_previsto,'prezzo',l.prezzo_unitario); END IF;
 SELECT value INTO STRICT r FROM jsonb_array_elements(a->'righe') WHERE (value->>'id')::bigint=l.id;
 IF a->>'cantiere_id' IS DISTINCT FROM l.cantiere_id::text OR a->>'preventivo_id' IS DISTINCT FROM l.preventivo_id::text
 OR (r->>'importo_previsto')::numeric IS DISTINCT FROM l.importo_previsto
 OR (r->>'quantita')::numeric IS DISTINCT FROM l.quantita OR (r->>'prezzo_unitario')::numeric IS DISTINCT FROM l.prezzo_unitario
 OR r->>'descrizione' IS DISTINCT FROM l.descrizione OR r->>'unita_misura' IS DISTINCT FROM l.unita_misura THEN
 RAISE EXCEPTION 'Snapshot accordo incoerente' USING ERRCODE='22000'; END IF;
 RETURN jsonb_build_object('importo',r->'importo_contrattuale','prezzo',r->'prezzo_unitario_contrattuale',
 'snapshot',r||jsonb_build_object('richiesta',a->'richiesta','ribasso_percentuale',a->'ribasso_percentuale'));
END $$;

CREATE FUNCTION artecna_guardie.accordo_documento_presente(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS (SELECT FROM public.preventivi_cantiere WHERE id=pid AND accordo_contrattuale IS NOT NULL)
$$;
CREATE FUNCTION artecna_guardie.accordo_lavorazione_presente(lid bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS (SELECT FROM public.preventivo_lavorazioni l JOIN public.preventivi_cantiere p ON p.id=l.preventivo_id
 WHERE l.id=lid AND p.accordo_contrattuale IS NOT NULL)
$$;

CREATE FUNCTION artecna_guardie.proteggi_accordo_contrattuale() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a boolean; val jsonb;
BEGIN
 IF TG_TABLE_NAME='preventivi_cantiere' THEN
 IF TG_OP='INSERT' THEN
 IF NEW.accordo_contrattuale IS NOT NULL THEN RAISE EXCEPTION 'Accordo tramite RPC' USING ERRCODE='42501'; END IF;
 RETURN NEW; END IF;
 IF OLD.accordo_contrattuale IS NOT NULL THEN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'accordo_contrattuale') IS DISTINCT FROM (to_jsonb(OLD)-'accordo_contrattuale') THEN
 RAISE EXCEPTION 'Documento contrattuale congelato: conservare originale e accordo' USING ERRCODE='55000'; END IF; END IF;
 IF TG_OP='UPDATE' AND NEW.accordo_contrattuale IS DISTINCT FROM OLD.accordo_contrattuale AND current_user<>'postgres' THEN
 RAISE EXCEPTION 'Accordo tramite RPC' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='preventivo_lavorazioni' THEN
 a:=artecna_guardie.accordo_documento_presente(CASE WHEN TG_OP='INSERT' THEN NEW.preventivo_id ELSE OLD.preventivo_id END);
 IF a THEN RAISE EXCEPTION 'Lavorazioni contrattuali congelate' USING ERRCODE='55000'; END IF;
 IF TG_OP='UPDATE' AND artecna_guardie.accordo_documento_presente(NEW.preventivo_id) THEN
 RAISE EXCEPTION 'Identita contrattuale congelata' USING ERRCODE='55000'; END IF;
 ELSIF TG_TABLE_NAME='cantieri' THEN
 IF OLD.preventivo_contrattuale_id IS DISTINCT FROM NEW.preventivo_contrattuale_id AND
 artecna_guardie.accordo_documento_presente(OLD.preventivo_contrattuale_id) THEN
 RAISE EXCEPTION 'Riconciliare accordo prima del cambio contratto' USING ERRCODE='55000'; END IF;
 ELSE
 IF TG_OP<>'INSERT' AND OLD.accordo_riga IS NOT NULL AND (TG_OP='DELETE' OR
 ROW(NEW.cantiere_id,NEW.source_lavorazione_id,NEW.source_variante_lavorazione_id,NEW.importo_previsto,NEW.accordo_riga)
 IS DISTINCT FROM ROW(OLD.cantiere_id,OLD.source_lavorazione_id,OLD.source_variante_lavorazione_id,OLD.importo_previsto,OLD.accordo_riga)) THEN
 RAISE EXCEPTION 'Base SAL concordata congelata' USING ERRCODE='55000'; END IF;
 IF TG_OP<>'DELETE' AND NEW.source_lavorazione_id IS NOT NULL AND
 artecna_guardie.accordo_lavorazione_presente(NEW.source_lavorazione_id) THEN
 IF current_user NOT IN ('postgres','artecna_sal_rpc') THEN RAISE EXCEPTION 'SAL accordato tramite RPC' USING ERRCODE='42501'; END IF;
 val:=artecna_guardie.valore_base_accordato(NEW.source_lavorazione_id);
 IF val->'snapshot' IS NOT NULL THEN
 IF NEW.accordo_riga IS DISTINCT FROM val->'snapshot' OR NEW.importo_previsto IS DISTINCT FROM (val->>'importo')::numeric
 OR NEW.source_variante_lavorazione_id IS NOT NULL OR NOT EXISTS (
 SELECT FROM public.preventivo_lavorazioni l JOIN public.cantieri c ON c.id=l.cantiere_id
 WHERE l.id=NEW.source_lavorazione_id AND l.cantiere_id=NEW.cantiere_id AND c.preventivo_contrattuale_id=l.preventivo_id) THEN
 RAISE EXCEPTION 'SAL e accordo non coerenti' USING ERRCODE='22000'; END IF;
 END IF;
 ELSIF TG_OP<>'DELETE' AND NEW.accordo_riga IS NOT NULL THEN RAISE EXCEPTION 'Snapshot SAL senza sorgente' USING ERRCODE='22000'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER accordo_documento_guard BEFORE INSERT OR UPDATE OR DELETE ON public.preventivi_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_accordo_contrattuale();
CREATE TRIGGER accordo_voci_guard BEFORE INSERT OR UPDATE OR DELETE ON public.preventivo_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_accordo_contrattuale();
CREATE TRIGGER accordo_cantiere_guard BEFORE UPDATE OF preventivo_contrattuale_id ON public.cantieri FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_accordo_contrattuale();
CREATE TRIGGER accordo_sal_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sal_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_accordo_contrattuale();

CREATE FUNCTION public.importa_sal_accordato(p_cantiere uuid,p_preventivo uuid,p_ids bigint[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c public.cantieri; l public.preventivo_lavorazioni; valore jsonb; n integer:=0;
BEGIN
 PERFORM artecna_contratti.verifica_accesso(p_cantiere,p_preventivo);
 LOCK TABLE public.sal_lavorazioni,public.preventivo_lavorazioni,public.varianti_cantiere IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO c FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
 PERFORM 1 FROM public.preventivi_cantiere WHERE id=p_preventivo FOR SHARE;
 IF c.preventivo_contrattuale_id IS DISTINCT FROM p_preventivo OR p_ids IS NULL OR cardinality(p_ids)=0
 OR cardinality(p_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_ids) id)
 OR EXISTS (SELECT FROM unnest(p_ids) AS selezione(lid) WHERE NOT EXISTS (SELECT FROM public.preventivo_lavorazioni WHERE preventivo_id=p_preventivo AND cantiere_id=p_cantiere AND preventivo_lavorazioni.id=selezione.lid)) THEN
 RAISE EXCEPTION 'Selezione SAL non valida' USING ERRCODE='22023'; END IF;
 FOR l IN SELECT * FROM public.preventivo_lavorazioni WHERE id=ANY(p_ids) ORDER BY id LOOP
 valore:=artecna_guardie.valore_base_accordato(l.id);
 IF valore->'snapshot' IS NULL THEN RAISE EXCEPTION 'Accordo non disponibile' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT FROM public.sal_lavorazioni WHERE source_lavorazione_id=l.id AND
 (cantiere_id IS DISTINCT FROM p_cantiere OR accordo_riga IS DISTINCT FROM valore->'snapshot')) THEN
 RAISE EXCEPTION 'Riga SAL esistente incompatibile' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS (SELECT FROM public.sal_lavorazioni WHERE source_lavorazione_id=l.id) THEN
 INSERT INTO public.sal_lavorazioni(cantiere,cantiere_id,source_lavorazione_id,descrizione,importo_previsto,percentuale,importo_maturato,completata,accordo_riga)
 VALUES(c.nome,c.id,l.id,l.descrizione,(valore->>'importo')::numeric,0,0,false,valore->'snapshot'); n:=n+1;
 END IF; END LOOP;
 RETURN n;
END $$;

-- Patch minima delle due basi economiche: firma, owner e guardie originali preservati.
DO $patch$
DECLARE f record; testo text; prima text; dopo text; atteso text;
BEGIN
 FOR f IN SELECT p.oid,p.prosrc,p.proowner,p.proacl,p.proconfig,p.prosecdef FROM pg_proc p WHERE p.oid IN (
 'public.aggiorna_avanzamento_sal(bigint,numeric,boolean)'::regprocedure,
 'artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)'::regprocedure) LOOP
 IF pg_get_userbyid(f.proowner)<>'artecna_sal_rpc' OR NOT f.prosecdef
 OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp'] THEN RAISE EXCEPTION 'RPC SAL divergente'; END IF;
 IF f.oid='public.aggiorna_avanzamento_sal(bigint,numeric,boolean)'::regprocedure THEN
 IF md5(f.prosrc)<>'133f3abc8fa415dd529110a00301bd7f' THEN RAISE EXCEPTION 'Corpo RPC SAL divergente'; END IF;
 prima:='        v_i_orig := v_s.importo_previsto;';
 dopo:='        v_i_orig := (artecna_guardie.valore_base_accordato(v_s.id)->>''importo'')::numeric;';
 ELSE
 IF md5(f.prosrc)<>'55760dbed88e0607124f14c48b33408b' THEN RAISE EXCEPTION 'Corpo residuo SAL divergente'; END IF;
 prima:='b.quantita as q, b.importo_previsto as i';
 dopo:='b.quantita as q, (artecna_guardie.valore_base_accordato(b.id)->>''importo'')::numeric as i'; END IF;
 IF (length(f.prosrc)-length(replace(f.prosrc,prima,'')))<>length(prima) THEN RAISE EXCEPTION 'Punto patch SAL non univoco'; END IF;
 atteso:=replace(f.prosrc,prima,dopo);
 testo:=replace(pg_get_functiondef(f.oid),prima,dopo);
 IF f.oid='public.aggiorna_avanzamento_sal(bigint,numeric,boolean)'::regprocedure THEN
 prima:=dopo||CASE WHEN strpos(f.prosrc,E'\r\n')>0 THEN E'\r\n' ELSE E'\n' END||'        v_prezzo := v_s.prezzo_unitario;';
 dopo:=dopo||CASE WHEN strpos(f.prosrc,E'\r\n')>0 THEN E'\r\n' ELSE E'\n' END||'        v_prezzo := (artecna_guardie.valore_base_accordato(v_s.id)->>''prezzo'')::numeric;';
 ELSE
 prima:='select b.descrizione, b.unita_misura, b.prezzo_unitario,';
 dopo:='select b.descrizione, b.unita_misura, (artecna_guardie.valore_base_accordato(b.id)->>''prezzo'')::numeric as prezzo_unitario,'; END IF;
 IF (length(testo)-length(replace(testo,prima,'')))<>length(prima) THEN RAISE EXCEPTION 'Punto patch prezzo non univoco'; END IF;
 testo:=replace(testo,prima,dopo);
 atteso:=replace(atteso,prima,dopo);
 -- CREATE OR REPLACE mantiene gli ACL. Membership temporanea come migrazioni SAL esistenti.
 EXECUTE 'GRANT artecna_sal_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres';
 EXECUTE 'GRANT CREATE ON SCHEMA public,artecna_guardie TO artecna_sal_rpc';
 SET LOCAL ROLE artecna_sal_rpc;
 EXECUTE testo;
 RESET ROLE;
 EXECUTE 'REVOKE CREATE ON SCHEMA public,artecna_guardie FROM artecna_sal_rpc';
 EXECUTE 'REVOKE artecna_sal_rpc FROM postgres GRANTED BY postgres RESTRICT';
 IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=f.oid AND prosrc=atteso
 AND proowner=f.proowner AND proacl IS NOT DISTINCT FROM f.proacl AND proconfig=f.proconfig AND prosecdef=f.prosecdef) THEN
 RAISE EXCEPTION 'Attributi RPC SAL alterati'; END IF;
 END LOOP;
END $patch$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA artecna_contratti FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_accordo_contrattuale(),artecna_guardie.valore_base_accordato(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_guardie.valore_base_accordato(bigint) TO artecna_sal_rpc;
REVOKE ALL ON FUNCTION artecna_guardie.accordo_documento_presente(uuid),artecna_guardie.accordo_lavorazione_presente(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_guardie.accordo_documento_presente(uuid),artecna_guardie.accordo_lavorazione_presente(bigint)
 TO authenticated,service_role,artecna_sal_rpc,artecna_preventivi_rpc,artecna_varianti_rpc,artecna_cantieri_rpc,artecna_cantieri_delete_rpc;
REVOKE ALL ON FUNCTION public.anteprima_accordo_contrattuale(uuid,uuid,jsonb,numeric,text,text,text,text),
public.candidati_accordo_contrattuale(uuid),
public.conferma_accordo_contrattuale(uuid,uuid,uuid,jsonb,numeric,text,text,text,text,text,text),
public.importa_sal_accordato(uuid,uuid,bigint[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.anteprima_accordo_contrattuale(uuid,uuid,jsonb,numeric,text,text,text,text),
public.candidati_accordo_contrattuale(uuid),
public.conferma_accordo_contrattuale(uuid,uuid,uuid,jsonb,numeric,text,text,text,text,text,text),
public.importa_sal_accordato(uuid,uuid,bigint[]) TO authenticated;
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
