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
COMMIT;
