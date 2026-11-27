/* eslint-disable @typescript-eslint/no-require-imports -- Native isolated fixtures, never remote. */
const fs=require('node:fs'),path=require('node:path');
const {start,ids}=require('./runtime.cjs');
const migration=n=>fs.readFileSync(path.resolve(__dirname,'../../migrations',n),'utf8');
const fn=(sql,name)=>{const from=sql.indexOf('CREATE FUNCTION '+name+'('),replaced=sql.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');const at=from<0?replaced:from;if(at<0)throw Error('Missing fixture dependency '+name);const end=sql.indexOf('END $$;',at);return sql.slice(at,end+7)};
async function fixture(){
 const db=await start(),c=db.admin;
 try{
 await c.query(`ALTER TABLE public.fatture_emesse ADD COLUMN bluenext_tipo text,ADD COLUMN xml_testo text,ADD COLUMN tipo_documento text;
 CREATE SCHEMA artecna_distruzione;CREATE SCHEMA artecna_rapportini;CREATE SCHEMA artecna_notifiche;
 CREATE TABLE public.economia_righe(id uuid,cantiere_id uuid);
 CREATE TABLE public.preventivi_cantiere(id uuid PRIMARY KEY,cantiere_id uuid,totale numeric);
 CREATE TABLE public.sal_lavorazioni(id uuid PRIMARY KEY,cantiere_id uuid,importo_maturato numeric);
 INSERT INTO public.preventivi_cantiere VALUES('${ids.c}','${ids.c}',12000);
 INSERT INTO public.sal_lavorazioni VALUES('${ids.c}','${ids.c}',6000);
 CREATE TABLE artecna_distruzione.hard_delete_catalog_expected(signature text);
 CREATE TABLE artecna_distruzione.hard_delete_runtime_queries(kind text,seq integer);
 CREATE TABLE artecna_notifiche.preferenze_notifiche(user_id uuid PRIMARY KEY,generali boolean,in_app boolean,fatture_da_emettere boolean,anticipi_fatture_da_emettere integer[]);
 CREATE TABLE artecna_notifiche.evento_notificabile(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),modulo text,tipo_record text,record_id uuid,tipo_evento text,data_evento timestamptz,revisione_sorgente bigint,ambito text,resolved_at timestamptz,updated_at timestamptz);
 CREATE UNIQUE INDEX evento_attivo ON artecna_notifiche.evento_notificabile(modulo,tipo_record,record_id,tipo_evento) WHERE resolved_at IS NULL;
 CREATE TABLE artecna_notifiche.notifica(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),evento_id uuid,recipient_user_id uuid,titolo text,messaggio text,priorita text,tipo_avviso text,scheduled_at timestamptz,published_at timestamptz,azione text,resolved_at timestamptz,updated_at timestamptz,read_at timestamptz,UNIQUE(evento_id,recipient_user_id,tipo_avviso,scheduled_at));`);
 const catalog=migration('20261108001000_cantiere_hard_delete_runtime_v3.sql');const cat=catalog.slice(catalog.indexOf('CREATE OR REPLACE FUNCTION artecna_distruzione.hard_delete_catalog()'));await c.query(cat.slice(0,cat.indexOf('$v3$;')+6));
 await c.query('INSERT INTO artecna_distruzione.hard_delete_catalog_expected SELECT artecna_distruzione.hard_delete_catalog()');
 await c.query(migration('20261114000200_contratto_acconti_fatture_sdi.sql'));
 const finance=migration('20261115000400_incassi_lordi_clienti.sql');await c.query(finance.slice(finance.indexOf('CREATE TABLE artecna_contabilita.incassi_lordi_clienti'),finance.indexOf('CREATE TEMP TABLE incassi_catalogo_dopo')));
 const fiscal=migration('20261114000300_notifiche_fatture_da_emettere.sql');
 for(const name of ['artecna_contabilita.valuta_acconto_fiscale','public.leggi_acconto_fiscale','artecna_notifiche.riconcilia_acconto_fiscale','artecna_notifiche.dopo_revisione_acconto_fiscale'])await c.query(fn(fiscal,name));
 await c.query('CREATE TRIGGER notifica_revisione_acconto_fiscale AFTER INSERT ON artecna_contabilita.acconti_fiscali FOR EACH ROW EXECUTE FUNCTION artecna_notifiche.dopo_revisione_acconto_fiscale();UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');
 await c.query(migration('20261121000100_acconti_compilazione_unica.sql'));
 await c.query('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');
 await c.query(`INSERT INTO artecna_contabilita.attribuzioni_clienti(id,fattura_id,acconto_id,cantiere_id,cliente_confermato,importo,verificato,creato_da) VALUES('00000000-0000-4000-8000-000000000050','${ids.f}','${ids.a}','${ids.c}','CLIENTE SINTETICO',500,true,'${ids.user}');
 INSERT INTO artecna_contabilita.incassi_lordi_clienti(id,acconto_id,cantiere_id,importo,ricevuto_il,metodo,riferimento,fonte,autore) VALUES('00000000-0000-4000-8000-000000000051','${ids.a}','${ids.c}',1000,'2026-02-01','bonifico','SYN-HISTORY','Fonte sintetica','${ids.user}');
 INSERT INTO artecna_contabilita.quote_lorde_clienti(id,incasso_id,fattura_id,importo,autore) VALUES('00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000051','${ids.f}',500,'${ids.user}');`);
 const evidence=results=>results.flatMap(r=>r.rows).find(r=>r.evidence)?.evidence;
 const pre=evidence(await c.query(fs.readFileSync(path.resolve(__dirname,'../../diagnostics/riconciliazione-unificata/precheck.sql'),'utf8')));
 const before=(await c.query('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) AS x FROM public.acconti_cantiere a')).rows[0].x;
 await c.query(migration('20261127000100_riconciliazione_unificata.sql'));
 const after=(await c.query('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) AS x FROM public.acconti_cantiere a')).rows[0].x;
 require('node:assert/strict').deepEqual(after,before);
 const post=evidence(await c.query(fs.readFileSync(path.resolve(__dirname,'../../diagnostics/riconciliazione-unificata/postcheck.sql'),'utf8')));
 require('node:assert/strict').deepEqual(post.fingerprints,pre.fingerprints);
 db.preservationRelations=Object.keys(pre.fingerprints).length;
 db.reset=async()=>{
 await c.query(`TRUNCATE artecna_contabilita.quote_lorde_clienti,artecna_contabilita.incassi_lordi_clienti,artecna_contabilita.attribuzioni_clienti,artecna_contabilita.acconti_fiscali,artecna_contabilita.storni_acconti,artecna_contabilita.fatture_sdi,artecna_notifiche.notifica,artecna_notifiche.evento_notificabile;
 UPDATE public.acconti_cantiere SET importo=4545.45,data_incasso='2026-11-20',compilazione_unica=NULL,cantiere_id='${ids.c}';
 UPDATE public.fatture_emesse SET numero_fattura=CASE WHEN id='${ids.f}' THEN '17' ELSE '18' END,data_fattura='2026-11-27',cliente='CLIENTE FIXTURE',cantiere=NULL,imponibile=4545.45,iva=10,totale=5000,importo_incassato=0,stato='emessa',bluenext_tipo=NULL,tipo_documento=NULL,xml_testo=NULL,xml_url=NULL,pdf_url=NULL,cantiere_id='${ids.c}';`);
 };
 await db.reset();return db;
 }catch(e){await db.close();throw e}
}
module.exports={fixture,ids};
