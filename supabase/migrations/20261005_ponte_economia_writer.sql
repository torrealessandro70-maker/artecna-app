-- Ponte Economia 4. Solo dopo 20261005_ponte_economia_schema.sql.
-- Nessun intervento sul cleanup: la FK RESTRICT richiede CLEANUP CANTIERE V2.
BEGIN;

DO $preflight$
BEGIN
  IF current_user<>'postgres'
    OR to_regprocedure('artecna_guardie.proteggi_ponte_economia()') IS NULL
    OR to_regprocedure('public.chiudi_raccolta_economia(uuid,bigint)') IS NULL
    OR to_regprocedure('public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean)') IS NULL
    OR to_regprocedure('public.usa_raccolta_economia_in_variante(uuid,bigint)') IS NOT NULL
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_ponte_economia_rpc') THEN
    RAISE EXCEPTION 'Prerequisiti writer Ponte Economia inattesi';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure
    AND proowner='postgres'::regrole AND prosecdef AND provolatile='v'
    AND prorettype='trigger'::regtype AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']
    AND position(chr(13) IN replace(prosrc,chr(13)||chr(10),chr(10)))=0
    AND encode(sha256(convert_to(replace(prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')=
      'ced175e7ecd641d67f9acf89bec46dfed6b590dfaab95a3e030d81694d415f71') THEN
    RAISE EXCEPTION 'Guardia schema approvata inattesa'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.variante_sorgenti'::regclass
    AND conname='variante_sorgenti_economia_raccolta_fk' AND confdeltype='r' AND convalidated AND NOT condeferrable)
    OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid='public.variante_sorgenti_economia_raccolta_unique'::regclass
      AND indisunique AND indisvalid) THEN RAISE EXCEPTION 'Schema ponte non certificato'; END IF;
END;
$preflight$;

-- Fotografia dei corpi/metadata storici, schema, trigger e ACL prima del writer.
CREATE TEMP TABLE ponte_writer_funzioni ON COMMIT DROP AS
SELECT oid,prosrc,proowner,prosecdef,provolatile,proconfig,proacl FROM pg_proc
WHERE pronamespace IN ('public'::regnamespace,'artecna_guardie'::regnamespace,
  'artecna_distruzione'::regnamespace,'artecna_rapportini'::regnamespace);
CREATE TEMP TABLE ponte_writer_vincoli ON COMMIT DROP AS
SELECT oid,conrelid,pg_get_constraintdef(oid) definizione FROM pg_constraint
WHERE conrelid IN ('public.variante_sorgenti'::regclass,'public.variante_lavorazioni'::regclass,
 'public.varianti_cantiere'::regclass,'public.economia_raccolte'::regclass,
 'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass,
 'public.cantieri'::regclass,'public.utenti_cantiere'::regclass,'public.preventivi_cantiere'::regclass);
CREATE TEMP TABLE ponte_writer_tabelle ON COMMIT DROP AS
SELECT oid,relowner,relrowsecurity,relforcerowsecurity FROM pg_class
WHERE oid IN (SELECT DISTINCT conrelid FROM ponte_writer_vincoli)
 OR oid IN ('public.cantieri'::regclass,'public.utenti_cantiere'::regclass,'public.preventivi_cantiere'::regclass);
CREATE TEMP TABLE ponte_writer_acl ON COMMIT DROP AS
SELECT c.oid,a.grantee,a.privilege_type,a.is_grantable FROM pg_class c,
 LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
WHERE c.oid IN (SELECT oid FROM ponte_writer_tabelle);
CREATE TEMP TABLE ponte_writer_colonne ON COMMIT DROP AS
SELECT a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,
 pg_get_expr(d.adbin,d.adrelid) valore_default
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid IN (SELECT oid FROM ponte_writer_tabelle) AND a.attnum>0 AND NOT a.attisdropped;
CREATE TEMP TABLE ponte_writer_acl_colonne ON COMMIT DROP AS
SELECT a.attrelid,a.attnum,x.grantee,x.privilege_type,x.is_grantable
FROM pg_attribute a,LATERAL aclexplode(a.attacl) x
WHERE a.attrelid IN (SELECT oid FROM ponte_writer_tabelle) AND a.attnum>0 AND NOT a.attisdropped;
CREATE TEMP TABLE ponte_writer_indici ON COMMIT DROP AS
SELECT i.indexrelid,i.indrelid,pg_get_indexdef(i.indexrelid) definizione,i.indisvalid,i.indisready
FROM pg_index i WHERE i.indrelid IN (SELECT oid FROM ponte_writer_tabelle);
CREATE TEMP TABLE ponte_writer_trigger ON COMMIT DROP AS
SELECT oid,tgrelid,tgfoid,tgtype,tgenabled,tgargs FROM pg_trigger
WHERE tgrelid IN (SELECT oid FROM ponte_writer_tabelle);
CREATE TEMP TABLE ponte_writer_policy ON COMMIT DROP AS
SELECT oid,to_jsonb(p) definizione FROM pg_policy p WHERE polrelid IN (SELECT oid FROM ponte_writer_tabelle);
CREATE TEMP TABLE ponte_writer_membership ON COMMIT DROP AS
SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members
WHERE roleid='artecna_economia_rpc'::regrole AND member='postgres'::regrole;

CREATE ROLE artecna_ponte_economia_rpc NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
-- SET temporaneo solo per trasferire gli oggetti; nessuna membership client.
GRANT artecna_ponte_economia_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public,artecna_guardie TO artecna_ponte_economia_rpc;
GRANT CREATE ON SCHEMA public,artecna_guardie TO artecna_ponte_economia_rpc;
GRANT SELECT ON public.cantieri,public.utenti_cantiere,public.preventivi_cantiere,
 public.varianti_cantiere,public.variante_sorgenti,public.variante_lavorazioni,
 public.economia_raccolte,public.economia_sorgenti,public.economia_righe TO artecna_ponte_economia_rpc;
GRANT UPDATE(id) ON public.cantieri,public.varianti_cantiere,public.economia_raccolte,
 public.economia_sorgenti,public.economia_righe TO artecna_ponte_economia_rpc;
GRANT UPDATE(user_id) ON public.utenti_cantiere TO artecna_ponte_economia_rpc;
GRANT INSERT ON public.varianti_cantiere,public.variante_sorgenti,public.variante_lavorazioni TO artecna_ponte_economia_rpc;
GRANT USAGE ON SEQUENCE public.variante_lavorazioni_id_seq TO artecna_ponte_economia_rpc;
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente(),
 artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid),
 public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean),
 public.economia_oggetto_analitico(jsonb,text[]),public.economia_numero_sorgente(jsonb) TO artecna_ponte_economia_rpc;
-- Il proprietario della chiusura concede il solo EXECUTE necessario.
-- SET ROLE esclusivamente durante installazione; membership storiche ripristinate.
GRANT artecna_economia_rpc TO postgres WITH SET TRUE;
SET LOCAL ROLE artecna_economia_rpc;
GRANT EXECUTE ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) TO artecna_ponte_economia_rpc;
RESET ROLE;
DO $ripristina_membership$
DECLARE originale record;
BEGIN
 SELECT * INTO originale FROM ponte_writer_membership WHERE grantor='postgres'::regrole;
 IF FOUND THEN
   EXECUTE format('GRANT artecna_economia_rpc TO postgres WITH SET %s',CASE WHEN originale.set_option THEN 'TRUE' ELSE 'FALSE' END);
 ELSE
   REVOKE artecna_economia_rpc FROM postgres GRANTED BY postgres;
 END IF;
END;
$ripristina_membership$;

-- INVOKER distingue il proprietario della RPC dagli altri writer SECURITY DEFINER.
-- Nessun GUC, flag o bypass postgres. Le tabelle conservano ACL/RLS browser.
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_ponte_economia() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $guardia$
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
 IF TG_OP<>'INSERT' OR current_user<>'artecna_ponte_economia_rpc' THEN
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
   IF voce IS NULL OR NEW.numero_riga<>NEW.indice_voce_sorgente+1 OR NEW.operazione<>'nuova'
     OR NEW.descrizione IS DISTINCT FROM voce->>'descrizione'
     OR NEW.unita_misura IS DISTINCT FROM voce->>'unita_misura'
     OR NEW.quantita_delta IS DISTINCT FROM (voce->>'quantita')::numeric
     OR NEW.prezzo_unitario IS DISTINCT FROM (voce->>'prezzo_unitario')::numeric
     OR NEW.delta_contratto IS DISTINCT FROM (voce->>'importo')::numeric
     OR NEW.note IS DISTINCT FROM coalesce(voce->>'note','')
     OR NEW.riferimento_preventivo_lavorazione_id IS NOT NULL OR NEW.riferimento_variante_lavorazione_id IS NOT NULL THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Lavorazione acquisizione incoerente'; END IF;
 END IF;
 RETURN NEW;
END;
$guardia$;

SET LOCAL ROLE artecna_ponte_economia_rpc;
CREATE FUNCTION artecna_guardie.verifica_acquisizione_economia(p_sorgente uuid,p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $verifica$
DECLARE s public.variante_sorgenti%rowtype; n bigint; totale numeric; voce jsonb; l public.variante_lavorazioni%rowtype; i integer:=0;
 er public.economia_righe%rowtype; n_economia bigint; totale_economia numeric;
BEGIN
 SELECT * INTO s FROM public.variante_sorgenti WHERE id=p_sorgente;
 IF NOT FOUND OR s.tipo<>'raccolta_economia' OR s.snapshot_version<>1 OR s.snapshot IS DISTINCT FROM p_snapshot THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Collegamento Economia incoerente'; END IF;
 IF s.titolo IS DISTINCT FROM p_snapshot->>'titolo'
   OR s.economia_raccolta_id::text IS DISTINCT FROM p_snapshot->>'raccolta_id'
   OR s.economia_revisione_sorgente IS DISTINCT FROM (p_snapshot->>'revisione_sorgente')::bigint
   OR s.economia_revisione_congelata IS DISTINCT FROM (p_snapshot->>'revisione_congelata')::bigint THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Metadata sorgente Economia incoerenti'; END IF;
 SELECT count(*),sum(delta_contratto) INTO n,totale FROM public.variante_lavorazioni WHERE variante_id=s.variante_id;
 SELECT count(*),sum(round(quantita*prezzo_unitario,2)) INTO n_economia,totale_economia
   FROM public.economia_righe WHERE raccolta_id=s.economia_raccolta_id;
 IF n IS DISTINCT FROM (p_snapshot->>'numero_registrazioni')::bigint
   OR n=0 OR n<>n_economia OR totale IS DISTINCT FROM totale_economia
   OR totale IS DISTINCT FROM (p_snapshot->>'totale')::numeric
   OR (SELECT count(*) FROM public.variante_sorgenti WHERE variante_id=s.variante_id)<>1 THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Riconciliazione Economia incoerente'; END IF;
 FOR voce IN SELECT value FROM jsonb_array_elements(p_snapshot->'registrazioni') LOOP
   SELECT * INTO er FROM public.economia_righe WHERE id=(voce->>'id')::uuid AND raccolta_id=s.economia_raccolta_id;
   IF NOT FOUND OR voce IS DISTINCT FROM jsonb_build_object('id',er.id,'ordine',er.ordine,
     'descrizione',er.descrizione,'unita_misura',er.unita_misura,'quantita',er.quantita,'prezzo_unitario',er.prezzo_unitario,
     'importo',round(er.quantita*er.prezzo_unitario,2),'note',er.note,'origine',er.origine,
     'sorgente_id',er.sorgente_id,'indice_voce_sorgente',er.indice_voce_sorgente,
     'tipo_riga',er.tipo_riga,'dettagli_analitici',er.dettagli_analitici) THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Snapshot registrazione Economia incoerente'; END IF;
   SELECT * INTO l FROM public.variante_lavorazioni WHERE variante_id=s.variante_id
     AND variante_sorgente_id=s.id AND indice_voce_sorgente=i;
   IF NOT FOUND OR l.numero_riga<>i+1 OR l.operazione<>'nuova'
     OR l.descrizione IS DISTINCT FROM voce->>'descrizione' OR l.unita_misura IS DISTINCT FROM voce->>'unita_misura'
     OR l.quantita_delta IS DISTINCT FROM (voce->>'quantita')::numeric
     OR l.prezzo_unitario IS DISTINCT FROM (voce->>'prezzo_unitario')::numeric
     OR l.delta_contratto IS DISTINCT FROM (voce->>'importo')::numeric
     OR l.note IS DISTINCT FROM coalesce(voce->>'note','')
     OR l.riferimento_preventivo_lavorazione_id IS NOT NULL OR l.riferimento_variante_lavorazione_id IS NOT NULL THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Riconciliazione riga Economia incoerente'; END IF;
   i:=i+1;
 END LOOP;
 IF i<>n THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Numero registrazioni incoerente'; END IF;
END;
$verifica$;
ALTER FUNCTION artecna_guardie.verifica_acquisizione_economia(uuid,jsonb) OWNER TO artecna_ponte_economia_rpc;

CREATE FUNCTION public.usa_raccolta_economia_in_variante(p_raccolta_id uuid,p_revisione_attesa bigint) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $writer$
DECLARE utente uuid; cid uuid; c public.cantieri%rowtype; r public.economia_raccolte%rowtype;
 v public.varianti_cantiere%rowtype; s public.variante_sorgenti%rowtype; es public.economia_sorgenti%rowtype;
 er public.economia_righe%rowtype; revision_s bigint; revision_f bigint; registrazioni jsonb:='[]'; snap jsonb;
 importo numeric(18,2); totale numeric(18,2):=0; n integer:=0; collegata uuid; riuso boolean:=false; voce jsonb;
BEGIN
 IF current_user<>'artecna_ponte_economia_rpc' THEN
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
 -- Le sorgenti precedono le righe, entrambe ordinate, dopo la testata Raccolta.
 PERFORM id FROM public.economia_sorgenti WHERE raccolta_id=r.id ORDER BY id FOR SHARE;
 FOR er IN SELECT * FROM public.economia_righe WHERE raccolta_id=r.id ORDER BY ordine,id FOR SHARE LOOP
   IF er.quantita<=0 OR er.prezzo_unitario IS NULL OR er.prezzo_unitario<=0
     OR er.quantita::text IN ('NaN','Infinity','-Infinity') OR er.prezzo_unitario::text IN ('NaN','Infinity','-Infinity')
     OR er.descrizione !~ '[^[:space:]]' THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile'; END IF;
   importo:=round(er.quantita*er.prezzo_unitario,2);
   IF importo<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importo Economia non rappresentabile'; END IF;
   es:=NULL;
   IF er.tipo_riga<>'generica' THEN
     SELECT * INTO es FROM public.economia_sorgenti WHERE id=er.sorgente_id AND raccolta_id=r.id;
     IF NOT FOUND OR es.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica non valida'; END IF;
   END IF;
   PERFORM public.economia_valida_dettagli(er.tipo_riga,er.dettagli_analitici,es.snapshot,es.snapshot_version,
     er.indice_voce_sorgente,er.quantita,er.prezzo_unitario,er.unita_misura,er.descrizione,true);
   n:=n+1; totale:=totale+importo;
   registrazioni:=registrazioni||jsonb_build_array(jsonb_build_object('id',er.id,'ordine',er.ordine,
     'descrizione',er.descrizione,'unita_misura',er.unita_misura,'quantita',er.quantita,'prezzo_unitario',er.prezzo_unitario,
     'importo',importo,'note',er.note,'origine',er.origine,'sorgente_id',er.sorgente_id,
     'indice_voce_sorgente',er.indice_voce_sorgente,'tipo_riga',er.tipo_riga,'dettagli_analitici',er.dettagli_analitici));
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Raccolta Economia vuota'; END IF;
 snap:=jsonb_build_object('raccolta_id',r.id,'cantiere_id',cid,'numero',r.numero,'titolo',r.titolo,'data',r.data,'note',r.note,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'totale',totale,'numero_registrazioni',n,'registrazioni',registrazioni);
 IF NOT riuso THEN
   IF r.stato='bozza' THEN
     PERFORM public.chiudi_raccolta_economia(r.id,p_revisione_attesa);
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
     INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,
       quantita_delta,prezzo_unitario,delta_contratto,note,variante_sorgente_id,indice_voce_sorgente,
       riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id)
     VALUES(v.id,n+1,'nuova',voce->>'descrizione',voce->>'unita_misura',(voce->>'quantita')::numeric,
       (voce->>'prezzo_unitario')::numeric,(voce->>'importo')::numeric,coalesce(voce->>'note',''),s.id,n,NULL,NULL);
     n:=n+1;
   END LOOP;
 END IF;
 PERFORM artecna_guardie.verifica_acquisizione_economia(s.id,snap);
 RETURN jsonb_build_object('versione_contratto',1,'riutilizzata',riuso,'raccolta_id',r.id,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'variante_id',v.id,'numero_variante',v.numero,
   'stato_variante',v.stato,'variante_sorgente_id',s.id,'numero_lavorazioni',n,'totale',totale);
EXCEPTION
 WHEN numeric_value_out_of_range OR invalid_text_representation THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile';
 WHEN serialization_failure OR deadlock_detected THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Conflitto concorrente Economia';
 WHEN SQLSTATE '22023' OR SQLSTATE '42501' OR SQLSTATE 'PT409' OR SQLSTATE 'XX001' THEN RAISE;
 WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Acquisizione Economia non completata';
END;
$writer$;
ALTER FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) OWNER TO artecna_ponte_economia_rpc;
RESET ROLE;
REVOKE CREATE ON SCHEMA public,artecna_guardie FROM artecna_ponte_economia_rpc;
CREATE TEMP TABLE ponte_writer_nuove ON COMMIT DROP AS
SELECT oid,prosrc,proowner,prosecdef,provolatile,proconfig,prorettype,prolang FROM pg_proc
WHERE oid IN ('public.usa_raccolta_economia_in_variante(uuid,bigint)'::regprocedure,
 'artecna_guardie.verifica_acquisizione_economia(uuid,jsonb)'::regprocedure,
 'artecna_guardie.proteggi_ponte_economia()'::regprocedure);

-- Elimina anche grant derivati da default ACL, senza allargare ACL generiche.
SET LOCAL ROLE artecna_ponte_economia_rpc;
DO $acl$
DECLARE f oid; a record;
BEGIN
 FOREACH f IN ARRAY ARRAY['public.usa_raccolta_economia_in_variante(uuid,bigint)'::regprocedure::oid,
   'artecna_guardie.verifica_acquisizione_economia(uuid,jsonb)'::regprocedure::oid] LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f::regprocedure);
   FOR a IN SELECT DISTINCT x.grantee FROM pg_proc p,LATERAL aclexplode(p.proacl) x
     WHERE p.oid=f AND x.grantee<>p.proowner AND x.grantee<>0 LOOP
     EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f::regprocedure,pg_get_userbyid(a.grantee));
   END LOOP;
 END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) TO authenticated;
RESET ROLE;
GRANT artecna_ponte_economia_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET FALSE;

DO $postcheck$
DECLARE metadata record;
BEGIN
 IF EXISTS(SELECT * FROM ponte_writer_membership EXCEPT SELECT roleid,member,grantor,admin_option,inherit_option,set_option
   FROM pg_auth_members) OR EXISTS(SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members
   WHERE roleid='artecna_economia_rpc'::regrole AND member='postgres'::regrole EXCEPT SELECT * FROM ponte_writer_membership) THEN
   RAISE EXCEPTION 'Membership Economia storiche modificate'; END IF;
 IF EXISTS(SELECT 1 FROM ponte_writer_funzioni b JOIN pg_proc p ON p.oid=b.oid
   WHERE b.oid<>'artecna_guardie.proteggi_ponte_economia()'::regprocedure
     AND ROW(p.prosrc,p.proowner,p.prosecdef,p.provolatile,p.proconfig)
       IS DISTINCT FROM ROW(b.prosrc,b.proowner,b.prosecdef,b.provolatile,b.proconfig))
   OR EXISTS(SELECT 1 FROM ponte_writer_funzioni b WHERE NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=b.oid)) THEN
   RAISE EXCEPTION 'RPC storiche o cleanup modificati'; END IF;
 IF EXISTS(SELECT * FROM ponte_writer_vincoli EXCEPT SELECT oid,conrelid,pg_get_constraintdef(oid) FROM pg_constraint)
   OR EXISTS(SELECT oid,conrelid,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM ponte_writer_tabelle)
      EXCEPT SELECT * FROM ponte_writer_vincoli)
   OR EXISTS(SELECT * FROM ponte_writer_tabelle EXCEPT SELECT oid,relowner,relrowsecurity,relforcerowsecurity FROM pg_class)
   OR EXISTS(SELECT * FROM ponte_writer_colonne EXCEPT SELECT a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,
     a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)
     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum) THEN
   RAISE EXCEPTION 'Schema ponte modificato'; END IF;
 IF EXISTS(SELECT a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,
   pg_get_expr(d.adbin,d.adrelid) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid IN (SELECT oid FROM ponte_writer_tabelle) AND a.attnum>0 AND NOT a.attisdropped
   EXCEPT SELECT * FROM ponte_writer_colonne) THEN RAISE EXCEPTION 'Colonne aggiuntive inattese'; END IF;
 IF EXISTS(SELECT * FROM ponte_writer_acl_colonne EXCEPT SELECT a.attrelid,a.attnum,x.grantee,x.privilege_type,x.is_grantable
   FROM pg_attribute a,LATERAL aclexplode(a.attacl) x)
   OR EXISTS(SELECT a.attrelid,a.attnum,x.grantee,x.privilege_type,x.is_grantable
     FROM pg_attribute a,LATERAL aclexplode(a.attacl) x
     WHERE a.attrelid IN (SELECT oid FROM ponte_writer_tabelle) AND x.grantee<>'artecna_ponte_economia_rpc'::regrole
     EXCEPT SELECT * FROM ponte_writer_acl_colonne) THEN RAISE EXCEPTION 'ACL colonne storiche modificate'; END IF;
 IF EXISTS(SELECT * FROM ponte_writer_indici EXCEPT SELECT indexrelid,indrelid,pg_get_indexdef(indexrelid),indisvalid,indisready FROM pg_index)
   OR EXISTS(SELECT * FROM ponte_writer_trigger EXCEPT SELECT oid,tgrelid,tgfoid,tgtype,tgenabled,tgargs FROM pg_trigger)
   OR EXISTS(SELECT * FROM ponte_writer_policy EXCEPT SELECT oid,to_jsonb(p) FROM pg_policy p)
   OR EXISTS(SELECT * FROM ponte_writer_nuove EXCEPT SELECT oid,prosrc,proowner,prosecdef,provolatile,proconfig,prorettype,prolang FROM pg_proc) THEN
   RAISE EXCEPTION 'Indici, trigger, policy o definizioni writer inattesi'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(c.relacl) a
   WHERE a.grantee='artecna_ponte_economia_rpc'::regrole
     AND (a.is_grantable OR NOT (
       (a.privilege_type='SELECT' AND c.oid IN (SELECT oid FROM ponte_writer_tabelle)) OR
       (a.privilege_type='INSERT' AND c.oid IN ('public.varianti_cantiere'::regclass,
         'public.variante_sorgenti'::regclass,'public.variante_lavorazioni'::regclass)) OR
       (a.privilege_type='USAGE' AND c.oid='public.variante_lavorazioni_id_seq'::regclass))))
   OR EXISTS(SELECT 1 FROM pg_attribute a,LATERAL aclexplode(a.attacl) x
     WHERE x.grantee='artecna_ponte_economia_rpc'::regrole AND (x.is_grantable OR x.privilege_type<>'UPDATE' OR NOT (
       (a.attname='id' AND a.attrelid IN ('public.cantieri'::regclass,'public.varianti_cantiere'::regclass,
         'public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass)) OR
       (a.attname='user_id' AND a.attrelid='public.utenti_cantiere'::regclass)))) THEN
   RAISE EXCEPTION 'Privilegi writer eccedenti'; END IF;
 -- Gli unici nuovi grant sulle funzioni storiche sono EXECUTE non grantable al writer.
 IF EXISTS(SELECT b.oid,a.grantee,a.privilege_type,a.is_grantable FROM ponte_writer_funzioni b,
   LATERAL aclexplode(coalesce(b.proacl,acldefault('f',b.proowner))) a
   WHERE b.oid<>'artecna_guardie.proteggi_ponte_economia()'::regprocedure
   EXCEPT SELECT p.oid,a.grantee,a.privilege_type,a.is_grantable FROM pg_proc p,
   LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)
   OR EXISTS(SELECT p.oid,a.grantee,a.privilege_type,a.is_grantable FROM pg_proc p,
     LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
     WHERE p.oid IN (SELECT oid FROM ponte_writer_funzioni)
       AND p.oid<>'artecna_guardie.proteggi_ponte_economia()'::regprocedure
       AND a.grantee<>'artecna_ponte_economia_rpc'::regrole
     EXCEPT SELECT b.oid,a.grantee,a.privilege_type,a.is_grantable FROM ponte_writer_funzioni b,
       LATERAL aclexplode(coalesce(b.proacl,acldefault('f',b.proowner))) a) THEN
   RAISE EXCEPTION 'ACL funzioni storiche modificate'; END IF;
 IF EXISTS(SELECT * FROM ponte_writer_acl EXCEPT SELECT c.oid,a.grantee,a.privilege_type,a.is_grantable
   FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a)
   OR EXISTS(SELECT c.oid,a.grantee,a.privilege_type,a.is_grantable FROM pg_class c,
     LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
     WHERE c.oid IN (SELECT oid FROM ponte_writer_tabelle) AND a.grantee<>'artecna_ponte_economia_rpc'::regrole
     EXCEPT SELECT * FROM ponte_writer_acl) THEN RAISE EXCEPTION 'ACL storiche modificate'; END IF;
 SELECT * INTO metadata FROM pg_proc WHERE oid='public.usa_raccolta_economia_in_variante(uuid,bigint)'::regprocedure;
 IF metadata.proowner<>'artecna_ponte_economia_rpc'::regrole OR NOT metadata.prosecdef OR metadata.provolatile<>'v'
   OR metadata.prorettype<>'jsonb'::regtype OR metadata.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
   OR metadata.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') THEN RAISE EXCEPTION 'Metadata writer inattesi'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid='public.usa_raccolta_economia_in_variante(uuid,bigint)'::regprocedure
   AND (a.grantee NOT IN (p.proowner,'authenticated'::regrole) OR a.privilege_type<>'EXECUTE' OR a.is_grantable))
   OR NOT has_function_privilege('authenticated',metadata.oid,'EXECUTE')
   OR has_function_privilege('anon',metadata.oid,'EXECUTE') OR has_function_privilege('service_role',metadata.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'ACL writer inattese'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid IN ('artecna_guardie.verifica_acquisizione_economia(uuid,jsonb)'::regprocedure,
     'artecna_guardie.proteggi_ponte_economia()'::regprocedure)
     AND (a.grantee<>p.proowner OR a.privilege_type<>'EXECUTE' OR a.is_grantable))
   OR (SELECT prosecdef FROM pg_proc WHERE oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure) THEN
   RAISE EXCEPTION 'Helper privati inattesi'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_ponte_economia_rpc'
   AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
   AND NOT rolreplication AND rolbypassrls)
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_ponte_economia_rpc'::regrole
     AND (member<>'postgres'::regrole OR inherit_option OR set_option))
   OR has_schema_privilege('artecna_ponte_economia_rpc','public','CREATE')
   OR has_schema_privilege('artecna_ponte_economia_rpc','artecna_guardie','CREATE') THEN RAISE EXCEPTION 'Ruolo writer inatteso'; END IF;
END;
$postcheck$;
COMMIT;
