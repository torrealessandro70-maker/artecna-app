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
DO $diagnostica$
DECLARE
  v_cantiere uuid := current_setting('artecna.diagnostica_cantiere')::uuid;
  v_contratto uuid := current_setting('artecna.diagnostica_contratto')::uuid;
  variante record;
  fonte record;
  dettaglio jsonb;
  snapshot jsonb;
  riga jsonb;
  fase text := 'leggi_varianti_cantiere';
  esito text := 'COERENTE';
  stato_sql text := '00000';
  verifica text := 'lettura_rpc';
  approvate int := 0;
  altre_basi int := 0;
  ordinarie int := 0;
  economie int := 0;
  fonti_economia int;
  somma_righe numeric;
  valore numeric;
  cumulato numeric := 0;
  ids_varianti uuid[] := '{}';
  ids_fonti uuid[] := '{}';
  ids_raccolte text[] := '{}';
  ids_righe text[];
BEGIN
  BEGIN
    IF current_user<>'authenticated' OR current_setting('transaction_read_only')<>'on'
      OR current_setting('transaction_isolation')<>'repeatable read' THEN
      RAISE EXCEPTION USING ERRCODE='P0001';
    END IF;
    FOR variante IN SELECT * FROM public.leggi_varianti_cantiere(v_cantiere) LOOP
      fase := 'leggi_varianti_cantiere';
      verifica := 'identita_variante';
      IF variante.id IS NULL OR variante.id=ANY(ids_varianti)
        OR variante.cantiere_id IS DISTINCT FROM v_cantiere THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
      ids_varianti := array_append(ids_varianti,variante.id);
      IF variante.stato IS DISTINCT FROM 'approvata' THEN CONTINUE; END IF;
      approvate := approvate + 1;
      IF variante.preventivo_contrattuale_id IS DISTINCT FROM v_contratto THEN
        altre_basi := altre_basi + 1;
        CONTINUE;
      END IF;

      fase := 'importo_approvato';
      verifica := 'delta_non_valido';
      IF variante.importo_delta_approvato IS NULL
        OR variante.importo_delta_approvato::text IN ('Infinity','-Infinity','NaN')
        OR abs(variante.importo_delta_approvato)*100 > 9007199254740991
        OR round(variante.importo_delta_approvato,2) <> variante.importo_delta_approvato
      THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
      cumulato := cumulato + variante.importo_delta_approvato;
      IF abs(cumulato)*100 > 9007199254740991 THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;

      fase := 'leggi_sorgenti_variante';
      verifica := 'lettura_rpc';
      fonti_economia := 0;
      FOR fonte IN SELECT * FROM public.leggi_sorgenti_variante(variante.id) LOOP
        verifica := 'identita_sorgente';
        IF fonte.id IS NULL OR fonte.id=ANY(ids_fonti) OR fonte.variante_id IS DISTINCT FROM variante.id
        THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
        ids_fonti := array_append(ids_fonti,fonte.id);
        IF fonte.tipo IS DISTINCT FROM 'raccolta_economia' THEN CONTINUE; END IF;
        fonti_economia := fonti_economia + 1;
        IF fonti_economia>1 THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;

        fase := 'leggi_sorgente_variante';
        verifica := 'lettura_rpc';
        SELECT to_jsonb(s) INTO STRICT dettaglio FROM public.leggi_sorgente_variante(fonte.id) s;
        fase := 'struttura_snapshot';
        verifica := 'identita_revisione_o_registrazioni';
        snapshot := dettaglio->'snapshot';
        IF dettaglio->>'id' IS DISTINCT FROM fonte.id::text
          OR dettaglio->>'variante_id' IS DISTINCT FROM variante.id::text
          OR dettaglio->>'tipo' IS DISTINCT FROM fonte.tipo
          OR dettaglio->>'snapshot_version' IS DISTINCT FROM '1'
          OR jsonb_typeof(snapshot) IS DISTINCT FROM 'object'
          OR snapshot->>'cantiere_id' IS DISTINCT FROM v_cantiere::text
          OR nullif(dettaglio->>'economia_raccolta_id','') IS NULL
          OR dettaglio->>'economia_raccolta_id'=ANY(ids_raccolte)
          OR snapshot->>'raccolta_id' IS DISTINCT FROM dettaglio->>'economia_raccolta_id'
          OR coalesce(snapshot->>'revisione_sorgente','') !~ '^[0-9]+$'
          OR coalesce(snapshot->>'revisione_congelata','') !~ '^[0-9]+$'
          OR snapshot->>'revisione_sorgente' IS DISTINCT FROM dettaglio->>'economia_revisione_sorgente'
          OR snapshot->>'revisione_congelata' IS DISTINCT FROM dettaglio->>'economia_revisione_congelata'
          OR (CASE WHEN jsonb_typeof(snapshot->'registrazioni')='array'
               THEN jsonb_array_length(snapshot->'registrazioni')=0
                 OR snapshot->>'numero_registrazioni' IS DISTINCT FROM jsonb_array_length(snapshot->'registrazioni')::text
               ELSE true END)
        THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
        ids_raccolte := array_append(ids_raccolte,dettaglio->>'economia_raccolta_id');

        fase := 'importi_snapshot';
        verifica := 'riga_non_valida';
        somma_righe := 0;
        ids_righe := '{}';
        FOR riga IN SELECT value FROM jsonb_array_elements(snapshot->'registrazioni') LOOP
          IF jsonb_typeof(riga) IS DISTINCT FROM 'object' OR nullif(riga->>'id','') IS NULL
             OR riga->>'id'=ANY(ids_righe) OR coalesce(riga->>'tipo_riga','') NOT IN ('manodopera','materiale')
             OR coalesce(riga->>'importo','') !~ '^[+]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
          THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
          valore := (riga->>'importo')::numeric;
          IF valore<=0 OR valore*100>9007199254740991 OR round(valore,2)<>valore
          THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
          ids_righe := array_append(ids_righe,riga->>'id');
          somma_righe := somma_righe + valore;
        END LOOP;
        verifica := 'totale_snapshot_vs_delta';
        IF coalesce(snapshot->>'totale','') !~ '^[+]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
          OR somma_righe IS DISTINCT FROM variante.importo_delta_approvato
          OR somma_righe IS DISTINCT FROM (snapshot->>'totale')::numeric
        THEN RAISE EXCEPTION USING ERRCODE='22000'; END IF;
        fase := 'leggi_sorgenti_variante';
        verifica := 'lettura_rpc';
      END LOOP;
      IF fonti_economia=0 THEN ordinarie := ordinarie+1; ELSE economie := economie+1; END IF;
    END LOOP;
    fase := 'completata';
    verifica := 'completata';
    IF approvate=0 THEN esito := 'ASSENZA_APPROVATE';
    ELSIF approvate=altre_basi THEN esito := 'ASSENZA_APPROVATE_SU_CONTRATTO'; END IF;
  EXCEPTION WHEN OTHERS THEN
    stato_sql := SQLSTATE;
    esito := CASE
      WHEN SQLSTATE IN ('42501','P2020','P2021') THEN 'AUTORIZZAZIONE'
      WHEN SQLSTATE='42883' THEN 'RPC_ASSENTE'
      WHEN left(SQLSTATE,2)='22' OR SQLSTATE IN ('P0002','P0003') THEN 'INCOERENZA'
      WHEN SQLSTATE='25006' THEN 'RPC_INCOMPATIBILE_READ_ONLY'
      ELSE 'ERRORE_SQL' END;
  END;
  PERFORM set_config('artecna.diagnostica_esito',
    concat('esito=',esito,' fase=',fase,' verifica=',verifica,' sqlstate=',stato_sql,
      ' approvate=',approvate,' altre_basi=',altre_basi,' ordinarie=',ordinarie,' economia=',economie),true);
  PERFORM set_config('artecna.diagnostica_green',(esito='COERENTE')::text,true);
END
$diagnostica$;
SELECT current_setting('artecna.diagnostica_esito') AS esito,
       current_setting('artecna.diagnostica_green') AS green
\gset diagnosi_
\qecho :diagnosi_esito
\else
\set diagnosi_green false
\qecho esito=ATTORE_NON_IDENTIFICATO fase=contesto
\endif
\else
\set diagnosi_green false
\qecho esito=TARGET_AMBIGUO_O_CONTRATTO_NON_VALIDO fase=contesto
\endif
ROLLBACK;
\if :diagnosi_green
\qecho ARTECNA_VARIANTI_SQL_READONLY_GREEN
\endif
