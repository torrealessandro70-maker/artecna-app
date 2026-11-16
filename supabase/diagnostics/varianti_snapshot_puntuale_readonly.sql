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
DO $mirata$
DECLARE
  c uuid := current_setting('artecna.diagnostica_cantiere')::uuid;
  p uuid := current_setting('artecna.diagnostica_contratto')::uuid;
  v record;
  s record;
  d jsonb;
  snap jsonb;
  rr record;
  r jsonb;
  eventi text[] := '{}';
  pv int := 0;
  ps int := 0;
  pr int := 0;
  ordinarie int := 0;
  economie int := 0;
  altre_basi int := 0;
  fonti_economia int;
  n_escluse int;
  n_incluse int;
  versione_esclusioni boolean;
  esclusa boolean;
  id_righe text[];
  id_raccolte text[] := '{}';
  id_varianti uuid[] := '{}';
  id_fonti uuid[] := '{}';
  prefisso text;
  motivo text;
  cifra text;
  valore numeric;
  approvato numeric;
  totale_snapshot numeric;
  somma_tutte numeric;
  somma_incluse numeric;
  fase text := 'contesto';
  esito text := 'DIAGNOSI_COMPLETATA';
  stato_sql text := '00000';
BEGIN
 BEGIN
  IF current_user<>'authenticated' OR current_setting('transaction_read_only')<>'on'
    OR current_setting('transaction_isolation')<>'repeatable read'
  THEN RAISE EXCEPTION USING ERRCODE='P0001'; END IF;

  fase := 'leggi_varianti_cantiere';
  FOR v IN SELECT x.* FROM public.leggi_varianti_cantiere(c) x
    ORDER BY x.numero ASC NULLS LAST,x.created_at,x.id LOOP
   IF v.id IS NULL OR v.id=ANY(id_varianti) OR v.cantiere_id IS DISTINCT FROM c
   THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
   id_varianti := array_append(id_varianti,v.id);
   IF v.stato IS DISTINCT FROM 'approvata' THEN CONTINUE; END IF;
   pv := pv + 1;
   IF v.preventivo_contrattuale_id IS DISTINCT FROM p THEN altre_basi := altre_basi+1; CONTINUE; END IF;
   ps := 0;
   pr := 0;
   fonti_economia := 0;
   approvato := v.importo_delta_approvato;
   IF approvato IS NULL OR approvato::text IN ('NaN','Infinity','-Infinity')
      OR abs(approvato)*100>9007199254740991 OR round(approvato,2)<>approvato THEN
     eventi := array_append(eventi,format('variante=V%s sorgente=S0 riga=R0 campo=importo_delta_approvato motivo=importo_approvato_non_valido',pv));
     approvato := NULL;
   END IF;

   fase := 'leggi_sorgenti_variante';
   FOR s IN SELECT x.* FROM public.leggi_sorgenti_variante(v.id) x ORDER BY x.created_at,x.id LOOP
    ps := ps+1;
    pr := 0;
    prefisso := format('variante=V%s sorgente=S%s ',pv,ps);
    IF s.id IS NULL OR s.id=ANY(id_fonti) OR s.variante_id IS DISTINCT FROM v.id THEN
      eventi := array_append(eventi,prefisso||'riga=R0 campo=identita_sorgente motivo=identita_mancante_duplicata_o_variante_diversa');
      CONTINUE;
    END IF;
    id_fonti := array_append(id_fonti,s.id);
    IF s.tipo IS DISTINCT FROM 'raccolta_economia' THEN CONTINUE; END IF;
    fonti_economia := fonti_economia+1;
    fase := 'leggi_sorgente_variante';
    SELECT to_jsonb(x) INTO STRICT d FROM public.leggi_sorgente_variante(s.id) x;
    fase := 'struttura_snapshot';
    snap := d->'snapshot';
    IF d->>'id' IS DISTINCT FROM s.id::text OR d->>'variante_id' IS DISTINCT FROM v.id::text
       OR d->>'tipo' IS DISTINCT FROM s.tipo OR d->>'snapshot_version' IS DISTINCT FROM '1'
       OR jsonb_typeof(snap) IS DISTINCT FROM 'object' OR snap->>'cantiere_id' IS DISTINCT FROM c::text
       OR nullif(d->>'economia_raccolta_id','') IS NULL OR d->>'economia_raccolta_id'=ANY(id_raccolte)
       OR snap->>'raccolta_id' IS DISTINCT FROM d->>'economia_raccolta_id'
       OR coalesce(snap->>'revisione_sorgente','') !~ '^[0-9]+$'
       OR coalesce(snap->>'revisione_congelata','') !~ '^[0-9]+$'
       OR snap->>'revisione_sorgente' IS DISTINCT FROM d->>'economia_revisione_sorgente'
       OR snap->>'revisione_congelata' IS DISTINCT FROM d->>'economia_revisione_congelata'
    THEN eventi := array_append(eventi,prefisso||'riga=R0 campo=snapshot motivo=identita_versione_o_revisione_incoerente'); END IF;
    IF nullif(d->>'economia_raccolta_id','') IS NOT NULL THEN
      id_raccolte := array_append(id_raccolte,d->>'economia_raccolta_id');
    END IF;
    IF jsonb_typeof(snap->'registrazioni') IS DISTINCT FROM 'array' THEN
      eventi := array_append(eventi,prefisso||'riga=R0 campo=registrazioni motivo=array_mancante_o_non_valido');
      CONTINUE;
    END IF;
    IF jsonb_array_length(snap->'registrazioni')=0
       OR snap->>'numero_registrazioni' IS DISTINCT FROM jsonb_array_length(snap->'registrazioni')::text THEN
      eventi := array_append(eventi,prefisso||'riga=R0 campo=numero_registrazioni motivo=conteggio_discordante_o_vuoto');
    END IF;

    fase := 'importi_snapshot';
    id_righe := '{}';
    versione_esclusioni := coalesce(snap->>'versione_esclusioni'='1',false);
    somma_tutte := 0;
    somma_incluse := 0;
    n_escluse := 0;
    n_incluse := 0;
    FOR rr IN SELECT value, ordinality FROM jsonb_array_elements(snap->'registrazioni') WITH ORDINALITY LOOP
      pr := rr.ordinality;
      r := rr.value;
      prefisso := format('variante=V%s sorgente=S%s riga=R%s ',pv,ps,pr);
      IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN
        eventi := array_append(eventi,prefisso||'campo=registrazione motivo=tipo_non_oggetto');
        somma_tutte := NULL;
        somma_incluse := NULL;
        CONTINUE;
      END IF;
      IF jsonb_typeof(r->'id') IS DISTINCT FROM 'string' OR nullif(r->>'id','') IS NULL
         OR r->>'id'=ANY(id_righe) THEN
        eventi := array_append(eventi,prefisso||'campo=id motivo=identita_mancante_non_testuale_o_duplicata');
      ELSE id_righe := array_append(id_righe,r->>'id'); END IF;
      IF r->>'tipo_riga'='generica' THEN
        motivo := CASE WHEN versione_esclusioni AND r->'esclusa_proposta'='true'::jsonb
                  THEN 'generica_esclusa_non_ammessa_dal_congelamento'
                  ELSE 'generica_inclusa_ammessa_dal_congelamento' END;
        eventi := array_append(eventi,prefisso||'campo=tipo_riga motivo='||motivo);
      ELSIF coalesce(r->>'tipo_riga','') NOT IN ('manodopera','materiale') THEN
        eventi := array_append(eventi,prefisso||'campo=tipo_riga motivo=tipo_mancante_o_non_ammesso');
      END IF;
      IF versione_esclusioni OR r ? 'origine' THEN
        IF NOT coalesce(CASE r->>'origine'
          WHEN 'manuale' THEN r->>'tipo_riga'='generica' AND r->'sorgente_id'='null'::jsonb AND r->'indice_voce_sorgente'='null'::jsonb
          WHEN 'rapportino' THEN r->>'tipo_riga'='manodopera' AND r->'sorgente_id'='null'::jsonb AND r->'indice_voce_sorgente'='null'::jsonb
          WHEN 'file' THEN jsonb_typeof(r->'sorgente_id')='string' AND btrim(r->>'sorgente_id')<>''
            AND jsonb_typeof(r->'indice_voce_sorgente')='number' AND r->>'indice_voce_sorgente' ~ '^[0-9]+$'
          WHEN 'fattura_fornitore' THEN r->>'tipo_riga'='materiale' AND jsonb_typeof(r->'sorgente_id')='string'
            AND btrim(r->>'sorgente_id')<>'' AND r->'indice_voce_sorgente'='null'::jsonb
          ELSE false END,false) THEN
          eventi := array_append(eventi,prefisso||'campo=origine motivo=provenienza_incoerente');
        END IF;
      END IF;
      IF (versione_esclusioni AND jsonb_typeof(r->'esclusa_proposta') IS DISTINCT FROM 'boolean')
         OR (NOT versione_esclusioni AND r ? 'esclusa_proposta') THEN
        eventi := array_append(eventi,prefisso||'campo=esclusa_proposta motivo=metadati_esclusione_incoerenti');
      END IF;
      esclusa := versione_esclusioni AND coalesce(r->'esclusa_proposta'='true'::jsonb,false);
      IF esclusa THEN n_escluse := n_escluse+1; ELSE n_incluse := n_incluse+1; END IF;

      cifra := btrim(r->>'importo');
      valore := NULL;
      motivo := NULL;
      IF NOT (r ? 'importo') THEN motivo := 'mancante';
      ELSIF r->'importo'='null'::jsonb THEN
        motivo := CASE WHEN esclusa THEN 'nullo_su_esclusa' ELSE 'nullo' END;
      ELSIF jsonb_typeof(r->'importo') NOT IN ('string','number') THEN motivo := 'tipo_numerico_non_valido';
      ELSIF coalesce(cifra,'') !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' THEN
        motivo := CASE WHEN cifra ~ '^0[xXbBoO]' THEN 'formato_non_decimale_da_verificare_in_javascript'
          ELSE 'valore_non_numerico' END;
      ELSE
        BEGIN valore := cifra::numeric;
        EXCEPTION WHEN data_exception THEN motivo := 'fuori_intervallo'; END;
        IF valore < 0 THEN motivo := 'negativo';
        ELSIF valore = 0 THEN motivo := CASE WHEN esclusa THEN 'zero_su_esclusa' ELSE 'zero_non_ammesso' END;
        ELSIF abs(valore)>90071992547409.91 THEN motivo := 'fuori_intervallo';
        ELSIF abs(valore*100-round(valore*100))>0.000001 THEN motivo := 'precisione_monetaria_non_valida';
        ELSIF jsonb_typeof(r->'importo')='string' AND r->>'importo' !~ '^[+]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' THEN
          motivo := 'formato_rifiutato_dal_primo_sql';
        END IF;
      END IF;
      IF motivo IS NOT NULL THEN eventi := array_append(eventi,prefisso||'campo=importo motivo='||motivo); END IF;
      IF valore IS NULL OR motivo IN ('negativo','fuori_intervallo','precisione_monetaria_non_valida') THEN
        somma_tutte := NULL;
        IF NOT esclusa THEN somma_incluse := NULL; END IF;
      ELSE
        somma_tutte := somma_tutte + round(valore,2);
        IF NOT esclusa THEN somma_incluse := somma_incluse + round(valore,2);
        ELSIF valore>0 THEN
          eventi := array_append(eventi,prefisso||'campo=importo motivo=esclusa_positiva_da_non_sommare_nel_contratto');
        END IF;
      END IF;
    END LOOP;

    prefisso := format('variante=V%s sorgente=S%s riga=R0 ',pv,ps);
    IF versione_esclusioni AND (snap->>'numero_incluse' IS DISTINCT FROM n_incluse::text
        OR snap->>'numero_escluse' IS DISTINCT FROM n_escluse::text OR n_incluse=0) THEN
      eventi := array_append(eventi,prefisso||'campo=numero_incluse_escluse motivo=conteggi_esclusioni_discordanti');
    END IF;
    cifra := btrim(snap->>'totale');
    totale_snapshot := NULL;
    IF coalesce(cifra,'') ~ '^[+]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' THEN
      BEGIN totale_snapshot := cifra::numeric;
      EXCEPTION WHEN data_exception THEN totale_snapshot := NULL; END;
    END IF;
    IF totale_snapshot IS NULL OR totale_snapshot>90071992547409.91 OR round(totale_snapshot,2)<>totale_snapshot THEN
      eventi := array_append(eventi,prefisso||'campo=totale_snapshot motivo=totale_mancante_non_numerico_o_non_valido');
    ELSE
      IF somma_tutte IS NULL THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=somma_tutte_non_verificabile');
      ELSIF somma_tutte<>totale_snapshot THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=somma_tutte_diversa_da_snapshot');
      END IF;
      IF somma_incluse IS NULL THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=somma_incluse_non_verificabile');
      ELSIF somma_incluse<>totale_snapshot THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=somma_incluse_diversa_da_snapshot');
      ELSIF versione_esclusioni AND n_escluse>0 THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=somma_incluse_coincide_con_snapshot');
      END IF;
      IF approvato IS NOT NULL AND totale_snapshot<>approvato THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=totale_snapshot_diverso_da_approvato');
      END IF;
      IF approvato IS NOT NULL AND somma_incluse IS NOT NULL AND somma_incluse<>approvato THEN
        eventi := array_append(eventi,prefisso||'campo=quadratura motivo=somma_incluse_diversa_da_approvato');
      END IF;
    END IF;
    fase := 'leggi_sorgenti_variante';
   END LOOP;
   IF fonti_economia=0 THEN ordinarie := ordinarie+1;
   ELSE
     economie := economie+1;
     IF fonti_economia>1 THEN
       eventi := array_append(eventi,format('variante=V%s sorgente=S0 riga=R0 campo=sorgenti motivo=piu_fonti_economia',pv));
     END IF;
   END IF;
   fase := 'leggi_varianti_cantiere';
  END LOOP;
  fase := 'completata';
  IF pv=0 OR pv=altre_basi THEN esito := 'ASSENZA_APPROVATE_SU_CONTRATTO'; END IF;
 EXCEPTION WHEN OTHERS THEN
   stato_sql := SQLSTATE;
   esito := 'STOP_SQL';
   eventi := array_append(eventi,format('variante=V%s sorgente=S%s riga=R%s campo=rpc_o_validazione motivo=esecuzione_interrotta',pv,ps,pr));
 END;
 PERFORM set_config('artecna.diagnostica_puntuale_righe',to_jsonb(eventi)::text,true);
 PERFORM set_config('artecna.diagnostica_puntuale_stato',format(
   'esito=%s fase=%s sqlstate=%s approvate=%s altre_basi=%s ordinarie=%s economia=%s',
   esito,fase,stato_sql,pv,altre_basi,ordinarie,economie),true);
END
$mirata$;
\pset format unaligned
\pset tuples_only on
SELECT value FROM jsonb_array_elements_text(current_setting('artecna.diagnostica_puntuale_righe')::jsonb);
SELECT current_setting('artecna.diagnostica_puntuale_stato');
SELECT current_setting('artecna.diagnostica_puntuale_stato') LIKE 'esito=DIAGNOSI_COMPLETATA %' AS ok
\gset puntuale_
\else
\set puntuale_ok false
\qecho esito=ATTORE_NON_IDENTIFICATO fase=contesto
\endif
\else
\set puntuale_ok false
\qecho esito=TARGET_AMBIGUO_O_CONTRATTO_NON_VALIDO fase=contesto
\endif
ROLLBACK;
\if :puntuale_ok
\qecho ARTECNA_VARIANTI_DIAGNOSI_PUNTUALE_COMPLETATA
\endif
