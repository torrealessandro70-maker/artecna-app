-- Step 5: same document registry; additive genealogy and atomic human confirmation.
-- No AI calls, Storage operations, changes to installed economic/SAL functions.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Installer postgres richiesto'; END IF;
 IF to_regprocedure('public.leggi_osservatore_variante(uuid)') IS NULL
 OR to_regprocedure('public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric)') IS NULL
 OR to_regprocedure('public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text)') IS NULL
 OR to_regprocedure('artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)') IS NULL THEN
 RAISE EXCEPTION 'Prerequisiti Variante/Osservatore/residuo assenti'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_varianti_rpc' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolinherit AND rolbypassrls)
 OR has_schema_privilege('artecna_varianti_rpc','public','CREATE')
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_varianti_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN
  RAISE EXCEPTION 'Attributi o privilegi temporanei preesistenti diversi dal contratto'; END IF;
END $$;

ALTER TABLE public.preventivi_cantiere
 ADD COLUMN natura text CHECK(natura IN ('contrattuale','integrativo')),
 ADD COLUMN variante_id uuid REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT,
 ADD COLUMN preventivo_contrattuale_id uuid REFERENCES public.preventivi_cantiere(id) ON DELETE RESTRICT,
 ADD COLUMN provenienza_generazione jsonb,
 ADD CONSTRAINT preventivo_integrativo_genealogia CHECK(
  (natura IS DISTINCT FROM 'integrativo' AND variante_id IS NULL AND preventivo_contrattuale_id IS NULL AND provenienza_generazione IS NULL) OR
  (natura IS NOT DISTINCT FROM 'integrativo' AND variante_id IS NOT NULL AND cantiere_id IS NOT NULL AND preventivo_contrattuale_id IS NOT NULL
   AND preventivo_contrattuale_id<>id AND jsonb_typeof(provenienza_generazione)='object'
   AND coalesce(provenienza_generazione->>'firma','') ~ '^[0-9a-f]{64}$'));
CREATE UNIQUE INDEX preventivo_integrativo_variante_unique ON public.preventivi_cantiere
 (variante_id) WHERE natura='integrativo';

-- Registry edits/approval must not change a document whose economic authority is the Variante.
CREATE FUNCTION public.proteggi_preventivo_integrativo_generato() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='artecna_cantieri_delete_rpc' THEN
  IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN RETURN OLD; END IF;
 END IF;
 IF ((TG_OP<>'DELETE' AND NEW.natura='integrativo') OR (TG_OP<>'INSERT' AND OLD.natura='integrativo'))
 AND current_user<>'artecna_varianti_rpc' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Documento integrativo gestito dalla Variante';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.proteggi_preventivo_integrativo_generato() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER preventivo_integrativo_generato_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.preventivi_cantiere FOR EACH ROW EXECUTE FUNCTION public.proteggi_preventivo_integrativo_generato();

-- The existing NOLOGIN economic writer owns the new orchestration too.
-- Preserve memberships granted by supabase_admin; remove only this temporary grantor.
GRANT artecna_varianti_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
GRANT CREATE ON SCHEMA public TO artecna_varianti_rpc;
GRANT SELECT(nome) ON public.cantieri TO artecna_varianti_rpc;
GRANT SELECT(id,cantiere_id,preventivo_id,descrizione,unita_misura,quantita,prezzo_unitario,importo_previsto)
 ON public.preventivo_lavorazioni TO artecna_varianti_rpc;
GRANT SELECT(id,cantiere_id,sopralluogo_id,natura,variante_id,preventivo_contrattuale_id,provenienza_generazione,json_voci_ai,importo_totale)
 ON public.preventivi_cantiere TO artecna_varianti_rpc;
GRANT INSERT(id,cantiere,cantiere_id,sopralluogo_id,natura,variante_id,preventivo_contrattuale_id,provenienza_generazione,
 nome_file,descrizione_ai,note,json_voci_ai,importo_totale,origine_ai,stato_preventivo,approvato,data_preventivo)
 ON public.preventivi_cantiere TO artecna_varianti_rpc;
GRANT EXECUTE ON FUNCTION public.leggi_osservatore_variante(uuid) TO artecna_varianti_rpc;
SET LOCAL ROLE artecna_varianti_rpc;

CREATE FUNCTION public.leggi_contesto_preventivo_integrativo(p_variante_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v record; p record; u uuid; lettura jsonb; contratto jsonb; righe jsonb:='[]'; r record; h record; residuo numeric; firma text;
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT id,cantiere_id,preventivo_contrattuale_id,stato INTO v FROM public.varianti_cantiere WHERE id=p_variante_id;
 IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile'; END IF;
 IF v.stato<>'bozza' OR NOT EXISTS(SELECT 1 FROM public.cantieri c WHERE c.id=v.cantiere_id AND c.preventivo_contrattuale_id=v.preventivo_contrattuale_id) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Bozza o contratto corrente non coerente'; END IF;
 SELECT id,sopralluogo_id INTO p FROM public.preventivi_cantiere WHERE id=v.preventivo_contrattuale_id AND cantiere_id=v.cantiere_id AND natura IS DISTINCT FROM 'integrativo';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contratto non disponibile'; END IF;
 lettura:=public.leggi_osservatore_variante(v.id);
 FOR r IN SELECT id,descrizione,unita_misura,quantita,prezzo_unitario FROM public.preventivo_lavorazioni
  WHERE preventivo_id=p.id AND cantiere_id=v.cantiere_id ORDER BY id LOOP
  residuo:=NULL;
  BEGIN
   SELECT * INTO STRICT h FROM artecna_guardie.calcola_residuo_componente('preventivo',r.id,v.cantiere_id,p.id);
   IF h.sal_presente AND h.maturato_verificabile THEN residuo:=h.quantita_riducibile; END IF;
  EXCEPTION WHEN SQLSTATE 'P2031' OR SQLSTATE 'P2033' OR SQLSTATE 'P2034' OR SQLSTATE 'P2035' OR SQLSTATE 'P2036' OR SQLSTATE 'P2037' OR SQLSTATE 'P2038' OR no_data_found OR too_many_rows THEN residuo:=NULL;
  END;
  righe:=righe||jsonb_build_array(jsonb_build_object('id',r.id::text,'descrizione',r.descrizione,'unita_misura',r.unita_misura,
   'quantita',r.quantita,'prezzo_unitario',r.prezzo_unitario,'quantita_riducibile',residuo));
 END LOOP;
 IF jsonb_array_length(righe)>1000 THEN RAISE EXCEPTION 'Contratto troppo grande'; END IF;
 contratto:=jsonb_build_object('id',p.id,'voci',righe);
 firma:=encode(sha256(convert_to(jsonb_build_object('manifesto',lettura#>'{fonti,manifesto}','analisi_id',lettura#>'{analisi,id}','contratto',contratto)::text,'UTF8')),'hex');
 RETURN jsonb_build_object('lettura',lettura,'contratto',contratto,'firma',firma,
  'documento_confermato',(SELECT id FROM public.preventivi_cantiere WHERE variante_id=v.id AND natura='integrativo'),
  'lavorazioni_presenti',(SELECT count(*) FROM public.variante_lavorazioni WHERE variante_id=v.id),
  'genealogia',jsonb_build_object(
  'cantiere_id',v.cantiere_id,'variante_id',v.id,'preventivo_contrattuale_id',p.id,'sopralluogo_origine_id',p.sopralluogo_id));
END $$;

CREATE FUNCTION public.salva_preventivo_integrativo_generato(p_variante_id uuid,p_richiesta_id uuid,p_firma text,p_descrizione text,p_voci jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; v record; c uuid; ctx jsonb; h text; old_doc record; x jsonb; ref_id bigint; ref record;
 q numeric; prezzo numeric; delta numeric; totale numeric:=0; numero integer; op text; refs bigint[]:='{}'; salvata record; ids jsonb:='[]';
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante_id;
 IF u IS NULL OR c IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,c) IS NOT TRUE THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile'; END IF;
 PERFORM 1 FROM public.cantieri WHERE id=c FOR UPDATE;
 SELECT id,cantiere_id,preventivo_contrattuale_id,stato INTO STRICT v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE;
 h:=encode(sha256(convert_to(jsonb_build_array(p_variante_id,p_firma,p_descrizione,p_voci)::text,'UTF8')),'hex');
 SELECT natura,variante_id,provenienza_generazione,importo_totale INTO old_doc FROM public.preventivi_cantiere WHERE id=p_richiesta_id;
 IF FOUND THEN
  IF old_doc.natura IS DISTINCT FROM 'integrativo' OR old_doc.variante_id IS DISTINCT FROM p_variante_id OR old_doc.provenienza_generazione->>'richiesta_hash' IS DISTINCT FROM h THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Identita richiesta gia usata per dati differenti'; END IF;
  RETURN jsonb_build_object('preventivo_id',p_richiesta_id,'variante_id',p_variante_id,'delta_totale',old_doc.importo_totale,'gia_salvato',true);
 END IF;
 IF p_richiesta_id IS NULL OR p_descrizione IS NULL OR btrim(p_descrizione)='' OR length(p_descrizione)>100000 OR
 jsonb_typeof(p_voci) IS DISTINCT FROM 'array' OR jsonb_array_length(p_voci) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Documento non valido'; END IF;
 ctx:=public.leggi_contesto_preventivo_integrativo(v.id);
 IF ctx->>'firma' IS DISTINCT FROM p_firma OR (ctx#>'{lettura,analisi}'<>'null'::jsonb AND ctx#>>'{lettura,analisi,allineata}' IS DISTINCT FROM 'true') THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Fonti, analisi o contratto cambiati: rivedere la generazione'; END IF;
 IF EXISTS(SELECT 1 FROM public.preventivi_cantiere WHERE variante_id=v.id AND natura='integrativo') THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Preventivo Integrativo gia confermato nella Variante'; END IF;
 IF EXISTS(SELECT 1 FROM public.variante_lavorazioni WHERE variante_id=v.id) THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='La bozza contiene gia lavorazioni: nessuna duplicazione automatica consentita'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_voci) LOOP
  IF jsonb_typeof(x)<>'object' OR jsonb_typeof(x->'quantita') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'prezzo_unitario') IS DISTINCT FROM 'number'
   OR x->'revisione_confermata' IS DISTINCT FROM 'true'::jsonb OR x->'da_verificare' IS DISTINCT FROM 'false'::jsonb
   OR coalesce(btrim(x->>'descrizione'),'')='' OR coalesce(btrim(x->>'unita_misura'),'')='' THEN RAISE EXCEPTION 'Revisione umana incompleta'; END IF;
  op:=x->>'operazione'; q:=(x->>'quantita')::numeric; prezzo:=(x->>'prezzo_unitario')::numeric;
  ref_id:=(x->>'riferimento_preventivo_lavorazione_id')::bigint;
  IF op IS NULL OR op NOT IN('nuova','aumento','riduzione','eliminazione') OR q=0 OR prezzo<=0 OR
   q::text IN('NaN','Infinity','-Infinity') OR prezzo::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Operazione o numeri non validi'; END IF;
  IF q::numeric(18,6)<>q OR prezzo::numeric(18,6)<>prezzo THEN RAISE EXCEPTION 'Valori non rappresentabili senza arrotondamento'; END IF;
  IF op='nuova' THEN
   IF ref_id IS NOT NULL OR q<0 THEN RAISE EXCEPTION 'Nuova lavorazione non coerente'; END IF;
   SELECT * INTO STRICT salvata FROM public.aggiungi_lavorazione_variante(v.id,x->>'descrizione',x->>'unita_misura',q,prezzo);
  ELSE
   IF ref_id IS NULL OR ref_id=ANY(refs) THEN RAISE EXCEPTION 'Riferimento contrattuale mancante o duplicato'; END IF;
   refs:=array_append(refs,ref_id);
   SELECT id,descrizione,unita_misura,prezzo_unitario INTO ref FROM public.preventivo_lavorazioni WHERE id=ref_id AND preventivo_id=v.preventivo_contrattuale_id AND cantiere_id=c;
   IF NOT FOUND OR ref.prezzo_unitario IS DISTINCT FROM prezzo OR ref.unita_misura IS DISTINCT FROM x->>'unita_misura' THEN RAISE EXCEPTION 'Riferimento o prezzo non coerente'; END IF;
   IF op IN('riduzione','eliminazione') THEN
    IF q>=0 THEN RAISE EXCEPTION 'Detrazione deve essere negativa'; END IF;
    SELECT * INTO STRICT salvata FROM public.aggiungi_correzione_variante(v.id,'preventivo',ref_id,
     CASE WHEN op='riduzione' THEN 'riduzione_residua' ELSE 'eliminazione_residua' END,
     CASE WHEN op='riduzione' THEN -q ELSE NULL END,x->>'descrizione');
    IF salvata.quantita_delta IS DISTINCT FROM q OR salvata.prezzo_unitario IS DISTINCT FROM prezzo THEN RAISE EXCEPTION 'Residuo cambiato: rivedere la voce'; END IF;
   ELSE
    IF q<=0 THEN RAISE EXCEPTION 'Aumento deve essere positivo'; END IF;
    SELECT coalesce(max(numero_riga),0)+1 INTO numero FROM public.variante_lavorazioni WHERE variante_id=v.id;
    INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,riferimento_preventivo_lavorazione_id)
     VALUES(v.id,numero,'aumento',x->>'descrizione',ref.unita_misura,q,prezzo,round(q*prezzo,2),ref_id) RETURNING * INTO salvata;
   END IF;
  END IF;
  delta:=salvata.delta_contratto; totale:=totale+delta;
  ids:=ids||jsonb_build_array(salvata.id::text);
 END LOOP;
 INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,sopralluogo_id,natura,variante_id,preventivo_contrattuale_id,provenienza_generazione,
  nome_file,descrizione_ai,note,json_voci_ai,importo_totale,origine_ai,stato_preventivo,approvato,data_preventivo)
 VALUES(p_richiesta_id,(SELECT nome FROM public.cantieri WHERE id=c),c,(ctx#>>'{genealogia,sopralluogo_origine_id}')::uuid,'integrativo',v.id,v.preventivo_contrattuale_id,
  jsonb_build_object('firma',p_firma,'richiesta_hash',h,'manifesto',ctx#>'{lettura,fonti,manifesto}','analisi_id',ctx#>'{lettura,analisi,id}','lavorazioni_variante_id',ids),
  'Preventivo_Integrativo_'||v.id::text,p_descrizione,'Documento della Variante; non e un nuovo contratto',p_voci,round(totale,2),true,'integrativo_confermato',false,current_date);
 RETURN jsonb_build_object('preventivo_id',p_richiesta_id,'variante_id',v.id,'delta_totale',round(totale,2),'gia_salvato',false);
END $$;
REVOKE ALL ON FUNCTION public.leggi_contesto_preventivo_integrativo(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_contesto_preventivo_integrativo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb) TO authenticated;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM artecna_varianti_rpc;
REVOKE artecna_varianti_rpc FROM postgres GRANTED BY postgres RESTRICT;
-- Existing sopralluogo_id stores the contract's origin, not the Variante identity.

-- Step 5A: extend the existing certified cleanup, preserving its guards/outbox.
DO $cleanup_pre$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_cantieri_delete_rpc' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND rolbypassrls)
 OR has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') OR has_schema_privilege('artecna_cantieri_delete_rpc','artecna_distruzione','CREATE')
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'Baseline ruolo cleanup divergente'; END IF;
 IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)')) IS DISTINCT FROM '29c4eafe08d4e3d5b854929478992090e8f8b28f2f504f777ea0cd33e58e6a90' THEN RAISE EXCEPTION 'Baseline cleanup divergente: public.elimina_cantiere_definitivamente(uuid,text)'; END IF;
 IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('artecna_distruzione.inizia_contesto(uuid)')) IS DISTINCT FROM 'ff2937da8a89d9767c402cb1d467f88bad81481f47c833fbf894f17ff181e32a' THEN RAISE EXCEPTION 'Baseline cleanup divergente: artecna_distruzione.inizia_contesto(uuid)'; END IF;
 IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('artecna_distruzione.manifest_cantiere(uuid)')) IS DISTINCT FROM '1f6258fe5bc698586c1cae33bb4776d5695f024812a95d4183fa2e2c6169fbd4' THEN RAISE EXCEPTION 'Baseline cleanup divergente: artecna_distruzione.manifest_cantiere(uuid)'; END IF;
END $cleanup_pre$;
GRANT SELECT,DELETE ON public.variante_fonti_memory,public.variante_fonti_visive,public.variante_osservatore_analisi TO artecna_cantieri_delete_rpc;
-- PostgreSQL requires an UPDATE column privilege for the existing FOR UPDATE locks.
GRANT UPDATE(variante_id) ON public.variante_fonti_memory,public.variante_fonti_visive,public.variante_osservatore_analisi TO artecna_cantieri_delete_rpc;
GRANT SELECT(natura,variante_id,preventivo_contrattuale_id) ON public.preventivi_cantiere TO artecna_cantieri_delete_rpc;
GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc;
SET LOCAL ROLE artecna_cantieri_delete_rpc;
DO $cleanup_patch$ DECLARE d text; b text; BEGIN
 SELECT prosrc INTO b FROM pg_proc WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure;
 d:=replace(pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure),b,$cleanup_body$
DECLARE
  v_user uuid;
  v_id uuid;
  v_varianti uuid[];
  v_raccolte uuid[];
  v_economia_sorgenti uuid[];
  v_economia_righe uuid[];
  v_economia_figli constant text[]:=ARRAY['economia_sorgenti','economia_righe']::text[];
  v_preventivi text[];
  v_base_lavorazioni bigint[];
  v_var_lavorazioni bigint[];
  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi','economia_raccolte','economia_sorgenti','economia_righe']::text[];
  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi']::text[];
  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','economia_raccolte']::text[];
  v_eliminate jsonb := '{}'::jsonb;
  v_n bigint;
  v_integrativi bigint := 0;
  v_totale_lavorazioni bigint;
  v_residuo boolean;
  v_esterna boolean;
  v_on text;
  v_padre text;
  v_figlio text;
  v_sql text;
  v_jobs_prima record;
  v_jobs_vecchi record;
  v_jobs_preparati record;
  v_jobs_dopo record;
  t text;
  fk record;
  m record;
BEGIN
  IF current_user <> 'artecna_cantieri_delete_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';
  END IF;
  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN
    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';
  END IF;
  v_user := artecna_guardie.utente_jwt_corrente();
  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';
  END IF;
  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;
  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';
  END IF;
  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';
  END IF;
  PERFORM artecna_rapportini.compat_foto_verifica_cantiere(p_cantiere_id);
  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);
  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';
  END IF;
  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.
  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;
  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;
  PERFORM e.id FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id ORDER BY e.id FOR UPDATE;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_raccolte FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;
    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti,v_raccolte LOOP NULL; END LOOP;
  END LOOP;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_sorgenti FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_righe FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);
  IF (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass))<>4 THEN
    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Economia divergente'; END IF;
  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.
  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.
  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace
    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)
    ORDER BY k.oid
  LOOP
    -- Inventario intero già verificato prima del contesto; nessuna DELETE dei figli protetti.
    IF (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_cantiere_id_fkey') OR (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_foto_cantiere_id_fkey') OR (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_rapportino_id_fkey') OR (fk.conrelid='artecna_rapportini.richieste'::regclass AND fk.conname='richieste_rapportino_id_fkey') OR (fk.conrelid='public.rapportino_materiali'::regclass AND fk.conname='rapportino_materiali_rapportino_fk') OR (fk.conrelid='public.rapportino_prestazioni'::regclass AND fk.conname='rapportino_prestazioni_rapportino_id_fkey') OR (fk.conrelid='public.rapportino_prestazioni'::regclass AND fk.conname='rapportino_prestazioni_variante_id_fkey') OR (fk.conrelid='public.variante_sorgenti'::regclass AND fk.conname='variante_sorgenti_economia_raccolta_fk') THEN CONTINUE; END IF;
    IF artecna_rapportini.compat_foto_fk_allegati(fk.oid) THEN CONTINUE; END IF;
    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);
    END IF;
    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on
      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum
      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;
    -- Le FK che coinvolgono Economia devono appartenere all'esatto grafo V1.
    IF fk.padre IN ('economia_raccolte','economia_sorgenti','economia_righe') OR fk.figlio IN ('economia_raccolte','economia_sorgenti','economia_righe') THEN
      IF fk.ns_padre<>'public' OR fk.ns_figlio<>'public' OR fk.confdeltype<>'r' OR fk.condeferrable OR fk.condeferred
        OR NOT (
          (fk.conname='economia_raccolte_cantiere_fk' AND fk.figlio='economia_raccolte' AND fk.padre='cantieri'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='cantiere_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (((fk.figlio='economia_sorgenti' AND fk.conname='economia_sorgenti_raccolta_fk') OR (fk.figlio='economia_righe' AND fk.conname='economia_righe_raccolta_fk'))
            AND fk.figlio=ANY(v_economia_figli) AND fk.padre='economia_raccolte'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (fk.conname='economia_righe_sorgente_fk' AND fk.figlio='economia_righe' AND fk.padre='economia_sorgenti'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='sorgente_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='raccolta_id')]::smallint[])
        ) THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Economia non certificata'; END IF;
    END IF;
    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';
    ELSIF fk.padre=ANY(v_economia_figli) THEN v_padre:='t.raccolta_id=ANY($3)';
    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';
    ELSE v_padre:='t.cantiere_id=$1'; END IF;
    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';
    ELSIF fk.figlio=ANY(v_economia_figli) THEN v_figlio:='f.raccolta_id=ANY($3)';
    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';
    ELSE v_figlio:='f.cantiere_id=$1'; END IF;
    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);
    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;
  END LOOP;
  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;
  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;
  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);
  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);
  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta
     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';
  END IF;
  DELETE FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_righe',v_n);
  DELETE FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_sorgenti',v_n);
  DELETE FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_raccolte',v_n);
  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);
  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);
  v_totale_lavorazioni := 0;
  LOOP
    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)
      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_totale_lavorazioni := v_totale_lavorazioni + v_n;
    IF v_n=0 THEN
      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';
      END IF;
      EXIT;
    END IF;
  END LOOP;
  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);
  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);
  DELETE FROM public.variante_fonti_memory t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_fonti_memory',v_n);
  DELETE FROM public.variante_fonti_visive t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_fonti_visive',v_n);
  DELETE FROM public.variante_osservatore_analisi t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_osservatore_analisi',v_n);
  -- Documents must precede Variante and contract: both FKs remain RESTRICT.
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id AND t.natura='integrativo';
  GET DIAGNOSTICS v_integrativi = ROW_COUNT;
  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);
  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL
    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;
  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n+v_integrativi);
  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);
  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);
  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);
  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);
  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);
  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);
  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);
  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);
  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);
  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);
  -- Post-check dei dati protetti PRIMA di terminare il contesto.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN
      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))
     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))
     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';
  END IF;
  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';
  END IF;
  PERFORM artecna_distruzione.termina_contesto();
  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;
  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';
  END IF;
  -- Ultima cancellazione applicativa.
  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';
  END IF;
  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';
    ELSIF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.economia_raccolte e WHERE e.id=ANY(v_raccolte))
    OR EXISTS(SELECT 1 FROM public.economia_sorgenti e WHERE e.id=ANY(v_economia_sorgenti))
    OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.id=ANY(v_economia_righe)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita Economia residue'; END IF;
  cantiere_id := p_cantiere_id;
  eliminato := true;
  RETURN NEXT;
EXCEPTION WHEN foreign_key_violation THEN
  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;
END;

  $cleanup_body$);
 IF d=pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) THEN RAISE EXCEPTION 'Cleanup patch non applicata'; END IF; EXECUTE d;
END $cleanup_patch$;
RESET ROLE;
DO $cleanup_patch$ DECLARE d text; b text; BEGIN
 SELECT prosrc INTO b FROM pg_proc WHERE oid='artecna_distruzione.inizia_contesto(uuid)'::regprocedure;
 d:=replace(pg_get_functiondef('artecna_distruzione.inizia_contesto(uuid)'::regprocedure),b,$cleanup_body$
  DECLARE u uuid := artecna_guardie.utente_jwt_corrente();
  BEGIN
    IF u IS NULL OR p_cantiere IS NULL THEN RAISE EXCEPTION 'Identita owner obbligatoria'; END IF;
    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;
    PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato'; END IF;
    -- Solo lock e SELECT prima della prima mutazione del contesto.
    LOCK TABLE public.variante_fonti_memory,public.variante_fonti_visive,public.variante_osservatore_analisi,artecna_rapportini.allegati,artecna_rapportini.richieste,public.acconti_cantiere,public.attrezzi_cantiere,public.cantieri,public.economia_raccolte,public.economia_righe,public.economia_sorgenti,public.fatture_emesse,public.fatture_fornitori_righe,public.foto_cantiere,public.incassi_non_fatturati,public.materiali_cantiere,public.pagamenti_fornitori,public.preventivi_cantiere,public.preventivo_lavorazioni,public.rapportini,public.rapportino_materiali,public.rapportino_prestazioni,public.sal_lavorazioni,public.timbrature,public.utenti_cantiere,public.variante_documenti,public.variante_lavorazioni,public.variante_sorgenti,public.varianti_cantiere IN ROW EXCLUSIVE MODE;
    PERFORM id FROM public.rapportini WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    PERFORM id FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    PERFORM id FROM public.economia_raccolte WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    IF (SELECT coalesce(jsonb_agg(jsonb_build_object('child',cn.nspname||'.'||c.relname,'name',k.conname,
'columns',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num),
'parent',pn.nspname||'.'||p.relname,'keys',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.confkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num),
'del',CASE k.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
'upd',CASE k.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
'match',k.confmatchtype,'valid',k.convalidated,'defer',k.condeferrable,'deferred',k.condeferred)
ORDER BY (cn.nspname||'.'||c.relname||'.'||k.conname) COLLATE "C"),'[]'::jsonb)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
WHERE k.contype='f' AND pn.nspname='public' AND p.relname=ANY(ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','economia_raccolte','economia_sorgenti','economia_righe'])) IS DISTINCT FROM $inventory$[{"child":"artecna_rapportini.allegati","name":"allegati_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.allegati","name":"allegati_foto_cantiere_id_fkey","columns":["foto_cantiere_id"],"parent":"public.foto_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.allegati","name":"allegati_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.richieste","name":"richieste_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.acconti_cantiere","name":"acconti_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.attrezzi_cantiere","name":"attrezzi_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.cantieri","name":"cantieri_preventivo_contrattuale_id_fkey","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_raccolte","name":"economia_raccolte_cantiere_fk","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_raccolta_fk","columns":["raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_sorgente_fk","columns":["sorgente_id","raccolta_id"],"parent":"public.economia_sorgenti","keys":["id","raccolta_id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_sorgenti","name":"economia_sorgenti_raccolta_fk","columns":["raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fatture_emesse","name":"fatture_emesse_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fatture_fornitori_righe","name":"fatture_fornitori_righe_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.foto_cantiere","name":"foto_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.incassi_non_fatturati","name":"incassi_non_fatturati_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_cantiere","name":"materiali_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.pagamenti_fornitori","name":"pagamenti_fornitori_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_preventivo_contrattuale_id_fkey","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivo_lavorazioni","name":"preventivo_lavorazioni_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivo_lavorazioni","name":"preventivo_lavorazioni_preventivo_id_fkey","columns":["preventivo_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportini","name":"rapportini_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_materiali","name":"rapportino_materiali_rapportino_fk","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_prestazioni","name":"rapportino_prestazioni_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_prestazioni","name":"rapportino_prestazioni_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_source_lavorazione_id_fkey","columns":["source_lavorazione_id"],"parent":"public.preventivo_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_variante_source_fk","columns":["source_variante_lavorazione_id"],"parent":"public.variante_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.timbrature","name":"timbrature_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.utenti_cantiere","name":"utenti_cantiere_cantiere_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_documenti","name":"variante_documenti_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_memory","name":"variante_fonti_memory_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_visive","name":"variante_fonti_visive_foto_cantiere_id_fkey","columns":["foto_cantiere_id"],"parent":"public.foto_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_visive","name":"variante_fonti_visive_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_precedente_fk","columns":["riferimento_variante_lavorazione_id"],"parent":"public.variante_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_preventivo_fk","columns":["riferimento_preventivo_lavorazione_id"],"parent":"public.preventivo_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_sorgente_fk","columns":["variante_sorgente_id"],"parent":"public.variante_sorgenti","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_osservatore_analisi","name":"variante_osservatore_analisi_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_economia_raccolta_fk","columns":["economia_raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_preventivo_fk","columns":["preventivo_sorgente_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.varianti_cantiere","name":"varianti_cantiere_cantiere_fk","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.varianti_cantiere","name":"varianti_cantiere_contratto_fk","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false}]$inventory$::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK distruzione F3C3.3 divergente'; END IF;
    IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a LEFT JOIN public.rapportini r ON r.id=a.rapportino_id LEFT JOIN public.foto_cantiere f ON f.id=a.foto_cantiere_id WHERE a.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere OR f.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.foto_cantiere f LEFT JOIN public.rapportini r ON r.id::text=f.rapportino_id WHERE f.allegato_v1_id IS NOT NULL AND (f.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere))
      OR EXISTS(SELECT 1 FROM public.rapportini WHERE cantiere_id=p_cantiere AND (versione_prestazioni<>0 OR versione_materiali<>0))
      OR EXISTS(SELECT 1 FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id LEFT JOIN public.varianti_cantiere v ON v.id=p.variante_id WHERE r.cantiere_id=p_cantiere OR v.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.rapportino_materiali m JOIN public.rapportini r ON r.id=m.rapportino_id WHERE r.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM artecna_rapportini.richieste q JOIN public.rapportini r ON r.id=q.rapportino_id WHERE r.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.variante_sorgenti s LEFT JOIN public.varianti_cantiere v ON v.id=s.variante_id LEFT JOIN public.economia_raccolte e ON e.id=s.economia_raccolta_id WHERE s.economia_raccolta_id IS NOT NULL AND (v.cantiere_id=p_cantiere OR e.cantiere_id=p_cantiere)) THEN
      RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Cantiere con dipendenze strutturate protette: eliminazione non disponibile'; END IF;
    -- Cleanup di residui ormai inutilizzabili dello stesso backend. Nessun dato applicativo.
    DELETE FROM artecna_distruzione.contesto WHERE backend=pg_backend_pid() AND transazione<>pg_current_xact_id();
    INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo)
      VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,u,'artecna_cantieri_delete_rpc');
    -- La PK vieta un secondo target nella stessa transazione/backend.
  END;
  $cleanup_body$);
 IF d=pg_get_functiondef('artecna_distruzione.inizia_contesto(uuid)'::regprocedure) THEN RAISE EXCEPTION 'Cleanup patch non applicata'; END IF; EXECUTE d;
END $cleanup_patch$;
DO $cleanup_patch$ DECLARE d text; b text; BEGIN
 SELECT prosrc INTO b FROM pg_proc WHERE oid='artecna_distruzione.manifest_cantiere(uuid)'::regprocedure;
 d:=replace(pg_get_functiondef('artecna_distruzione.manifest_cantiere(uuid)'::regprocedure),b,$cleanup_body$
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    RETURN QUERY
    SELECT q.entita,q.quantita FROM (
SELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_raccolte'::text,count(*)::bigint FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_sorgenti'::text,count(*)::bigint FROM public.economia_sorgenti e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_righe'::text,count(*)::bigint FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'variante_fonti_memory'::text,count(*)::bigint FROM public.variante_fonti_memory f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_fonti_visive'::text,count(*)::bigint FROM public.variante_fonti_visive f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_osservatore_analisi'::text,count(*)::bigint FROM public.variante_osservatore_analisi f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
    ) AS q(entita,quantita) ORDER BY q.entita;
  END;
  $cleanup_body$);
 IF d=pg_get_functiondef('artecna_distruzione.manifest_cantiere(uuid)'::regprocedure) THEN RAISE EXCEPTION 'Cleanup patch non applicata'; END IF; EXECUTE d;
END $cleanup_patch$;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc;
REVOKE artecna_cantieri_delete_rpc FROM postgres GRANTED BY postgres RESTRICT;
COMMIT;
