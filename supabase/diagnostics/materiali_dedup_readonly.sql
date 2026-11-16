-- PowerShell runner supplies the authenticated actor UUID; this file does not read credentials.
\set ON_ERROR_STOP on
\set ECHO none
\set VERBOSITY terse
\encoding UTF8
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;

-- Resolve the exact same contract reference as Economia, before simulating RLS.
SELECT count(*)=1 AS univoco,
       coalesce(min(c.id::text),'') AS cantiere,
       coalesce(min(c.preventivo_contrattuale_id::text),'') AS contratto
FROM public.cantieri c WHERE upper(btrim(c.nome))='TESTA ANTONINO'
\gset target_
SELECT (:'target_univoco'::boolean AND EXISTS (
         SELECT FROM public.preventivi_cantiere p
         WHERE p.id=nullif(:'target_contratto','')::uuid AND p.cantiere_id=nullif(:'target_cantiere','')::uuid
           AND p.importo_totale IS NOT NULL AND p.importo_totale::text NOT IN ('Infinity','-Infinity','NaN')
       )) AS ok,
       exists(SELECT FROM auth.users u WHERE u.id=:'utente_id'::uuid) AS attore
\gset target_
\if :target_ok
\if :target_attore
SELECT set_config('artecna.diagnostica_cantiere', :'target_cantiere', true) AS c,
       set_config('artecna.diagnostica_contratto', :'target_contratto', true) AS p,
       set_config('request.jwt.claim.sub', :'utente_id'::uuid::text, true) AS u,
       set_config('request.jwt.claims', jsonb_build_object('sub', :'utente_id'::uuid, 'role','authenticated')::text, true) AS claims
\gset contesto_
SET LOCAL ROLE authenticated;
SELECT current_user AS ruolo, current_setting('transaction_read_only') AS sola_lettura,
       current_setting('transaction_isolation') AS isolamento,
       'simulazione SQL; PostgREST e sessione web da verificare separatamente' AS metodo;
DO $diagnosi$
DECLARE
 c uuid := current_setting('artecna.diagnostica_cantiere')::uuid;
 v record; s record; item record; rr record;
 snap jsonb; elenco jsonb; r jsonb; d jsonb; f jsonb; fonte jsonb; identita jsonb;
 congelate jsonb := '{}'::jsonb;
 raccolte text[] := '{}'; righe text[] := '{}'; fonti text[]; fatture text[];
 eventi text[] := '{}';
 fase text := 'storico'; stato text := '00000'; motivo text;
 pos_c int := 0; pos_r int := 0; pos_v int := 0;
 quantita numeric; prezzo numeric; netto numeric; totale numeric; atteso numeric;
 esclusa boolean; approvate int := 0; operative int := 0;
BEGIN
 BEGIN
  IF current_user <> 'authenticated' OR current_setting('transaction_read_only') <> 'on'
     OR current_setting('transaction_isolation') <> 'repeatable read' THEN RAISE EXCEPTION USING ERRCODE='P0001'; END IF;
  FOR v IN SELECT x.* FROM public.leggi_varianti_cantiere(c) x
    WHERE x.stato='approvata' ORDER BY x.numero,x.id LOOP
   pos_v := pos_v+1;
   IF v.cantiere_id IS DISTINCT FROM c OR v.preventivo_contrattuale_id IS NULL
   THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
   FOR s IN SELECT x.* FROM public.leggi_sorgenti_variante(v.id) x WHERE x.tipo='raccolta_economia' ORDER BY x.id LOOP
    SELECT to_jsonb(x) INTO STRICT d FROM public.leggi_sorgente_variante(s.id) x;
    snap := d->'snapshot';
    IF d->>'id' IS DISTINCT FROM s.id::text OR d->>'variante_id' IS DISTINCT FROM v.id::text OR d->>'snapshot_version' IS DISTINCT FROM '1'
       OR snap->>'cantiere_id' IS DISTINCT FROM c::text OR nullif(snap->>'raccolta_id','') IS NULL
       OR snap->>'raccolta_id' IS DISTINCT FROM d->>'economia_raccolta_id'
       OR snap->>'revisione_sorgente' IS DISTINCT FROM d->>'economia_revisione_sorgente'
       OR snap->>'revisione_congelata' IS DISTINCT FROM d->>'economia_revisione_congelata'
       OR jsonb_typeof(snap->'registrazioni') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(snap->'registrazioni') LOOP
     IF r->>'tipo_riga' IS DISTINCT FROM 'materiale' THEN CONTINUE; END IF;
     IF nullif(r->>'id','') IS NULL OR congelate ? (r->>'id') THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
     congelate := congelate || jsonb_build_object(r->>'id',jsonb_build_object(
       'raccolta',snap->>'raccolta_id','fonte',r->>'sorgente_id','fattura',r#>>'{dettagli_analitici,fattura,fattura_riga_id}',
       'esclusa',coalesce(snap->>'versione_esclusioni'='1' AND r->'esclusa_proposta'='true'::jsonb,false)));
    END LOOP;
   END LOOP;
  END LOOP;
  fase := 'elenco_raccolte';
  elenco := public.leggi_raccolte_economia(c);
  IF jsonb_typeof(elenco) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(elenco) ORDER BY value->>'id' LOOP
   pos_c := pos_c+1; pos_r := 0; fase := 'raccolta';
   IF item.value->>'cantiere_id' IS DISTINCT FROM c::text OR nullif(item.value->>'id','') IS NULL
      OR item.value->>'id'=ANY(raccolte) THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
   raccolte := array_append(raccolte,item.value->>'id');
   d := public.leggi_raccolta_economia((item.value->>'id')::uuid);
   IF d#>>'{raccolta,id}' IS DISTINCT FROM item.value->>'id' OR d#>>'{raccolta,revisione}' IS DISTINCT FROM item.value->>'revisione'
      OR d#>>'{raccolta,cantiere_id}' IS DISTINCT FROM c::text OR coalesce(d#>>'{raccolta,stato}','') NOT IN ('bozza','chiusa')
      OR jsonb_typeof(d->'righe') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'sorgenti') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
   fonti := '{}'; fatture := '{}'; fase := 'identita';
   FOR fonte IN SELECT value FROM jsonb_array_elements(d->'sorgenti') LOOP
    IF nullif(fonte->>'id','') IS NULL OR fonte->>'id'=ANY(fonti) OR fonte->>'raccolta_id' IS DISTINCT FROM item.value->>'id'
    THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    fonti := array_append(fonti,fonte->>'id');
   END LOOP;
   FOR rr IN SELECT value,ordinality FROM jsonb_array_elements(d->'righe') WITH ORDINALITY LOOP
    pos_r := rr.ordinality; r := rr.value; fase := 'identita';
    IF nullif(r->>'id','') IS NULL OR r->>'id'=ANY(righe) OR r->>'raccolta_id' IS DISTINCT FROM item.value->>'id'
    THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    righe := array_append(righe,r->>'id');
    IF r->>'fattura_riga_id' IS NULL AND r->>'origine' IS DISTINCT FROM 'fattura_fornitore' THEN CONTINUE; END IF;
    fase := 'snapshot_fattura';
    SELECT value INTO fonte FROM jsonb_array_elements(d->'sorgenti') WHERE value->>'id'=r->>'sorgente_id';
    f := r#>'{dettagli_analitici,fattura}';
    IF r->>'origine' IS DISTINCT FROM 'fattura_fornitore' OR nullif(r->>'fattura_riga_id','') IS NULL
       OR fonte->>'tipo' IS DISTINCT FROM 'fattura_fornitore' OR fonte->>'formato' IS DISTINCT FROM 'fattura'
       OR fonte->>'snapshot_version' IS DISTINCT FROM '1' OR f->'version' IS DISTINCT FROM '1'::jsonb
       OR fonte->'snapshot' IS DISTINCT FROM f OR f->>'fattura_riga_id' IS DISTINCT FROM r->>'fattura_riga_id'
       OR coalesce(f->>'data_fattura','') !~ '^\d{4}-\d{2}-\d{2}$'
    THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    fase := 'valori_documentali';
    quantita := (r->>'quantita')::numeric;
    netto := coalesce(f->>'prezzo_unitario_originale',f->>'prezzo_unitario')::numeric;
    IF quantita IS NULL OR quantita<=0 OR quantita::text IN ('NaN','Infinity','-Infinity') OR
       netto IS NULL OR netto<0 OR netto::text IN ('NaN','Infinity','-Infinity') OR round(quantita*netto,2)*100>9007199254740991
    THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    IF (f->>'quantita')::numeric IS DISTINCT FROM quantita THEN fase := 'snapshot_fattura'; RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    fase := 'identita';
    IF r->>'fattura_riga_id'=ANY(fatture) THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    fatture := array_append(fatture,r->>'fattura_riga_id');
    identita := congelate->(r->>'id');
    esclusa := coalesce(identita->'esclusa'='true'::jsonb,false);
    IF identita IS NOT NULL AND NOT esclusa THEN
     IF identita->>'raccolta' IS DISTINCT FROM item.value->>'id' OR identita->>'fonte' IS DISTINCT FROM r->>'sorgente_id'
        OR identita->>'fattura' IS DISTINCT FROM r->>'fattura_riga_id' THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
     approvate := approvate+1; CONTINUE;
    END IF;
    IF EXISTS(SELECT FROM jsonb_each(congelate) x WHERE x.value->'esclusa'='false'::jsonb
      AND x.value->>'raccolta'=item.value->>'id'
      AND (x.value->>'fattura'=r->>'fattura_riga_id' OR x.value->>'fonte'=r->>'sorgente_id'))
    THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
    fase := 'valori_operativi'; motivo := NULL;
    prezzo := (r->>'prezzo_unitario')::numeric;
    totale := round(quantita*prezzo,2);
    atteso := (f->>'totale_economia')::numeric;
    IF r->>'tipo_riga' IS DISTINCT FROM 'materiale' OR prezzo IS NULL OR prezzo::text IN ('NaN','Infinity','-Infinity')
       OR totale<=0 OR totale*100>9007199254740991 OR nullif(btrim(r->>'descrizione'),'') IS NULL
       OR nullif(btrim(r->>'unita_misura'),'') IS NULL OR atteso IS DISTINCT FROM totale
       OR (f->>'prezzo_unitario_economia')::numeric IS DISTINCT FROM prezzo
       OR f->>'unita_misura_economia' IS DISTINCT FROM r->>'unita_misura' THEN
      motivo := CASE WHEN esclusa AND totale=0 THEN 'zero_fattura_su_esclusa_congelata'
                     WHEN esclusa THEN 'valori_divergenti_su_esclusa_congelata' ELSE 'prezzo_quantita_o_arrotondamento' END;
    ELSIF esclusa THEN
      motivo := 'esclusa_congelata_candidata_operativa';
    END IF;
    IF motivo IS NOT NULL THEN
     eventi := array_append(eventi,format('raccolta=C%s riga=R%s fase=%s motivo=%s',pos_c,pos_r,fase,motivo));
    ELSE operative := operative+1; END IF;
   END LOOP;
  END LOOP;
  fase := 'completata';
 EXCEPTION WHEN OTHERS THEN
  stato := SQLSTATE;
  eventi := array_append(eventi,format('raccolta=C%s riga=R%s fase=%s motivo=lettura_o_controllo_interrotto',pos_c,pos_r,fase));
 END;
 PERFORM set_config('artecna.materiali_eventi',to_jsonb(eventi)::text,true);
 PERFORM set_config('artecna.materiali_esito',format(
   'esito=%s fase=%s sqlstate=%s varianti=%s gia_approvate=%s operative=%s anomalie=%s',
   CASE WHEN stato='00000' THEN 'DIAGNOSI_COMPLETATA' ELSE 'STOP_SQL' END,
   fase,stato,pos_v,approvate,operative,cardinality(eventi)),true);
END
$diagnosi$;
\pset format unaligned
\pset tuples_only on
SELECT value FROM jsonb_array_elements_text(current_setting('artecna.materiali_eventi')::jsonb);
SELECT current_setting('artecna.materiali_esito');
SELECT true AS ok
\gset verifica_
\else
\set verifica_ok false
\qecho esito=ATTORE_NON_IDENTIFICATO fase=contesto
\endif
\else
\set verifica_ok false
\qecho esito=TARGET_AMBIGUO_O_CONTRATTO_NON_VALIDO fase=contesto
\endif
ROLLBACK;
\if :verifica_ok
\qecho ARTECNA_MATERIALI_DIAGNOSI_TERMINATA
\endif
