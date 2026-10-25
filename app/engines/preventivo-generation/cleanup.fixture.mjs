// Repository baseline bodies: used by isolated tests, never by the browser.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(__dirname,'../../..'),read=f=>fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8')
const old=read('20261007_f3c33_manifest_eliminazione_cantiere.sql')
const part=(tag)=>{const token='$'+tag+'$',start=old.indexOf(token);if(start<0)throw Error(tag);return old.slice(start+token.length,old.indexOf(token,start+token.length))}
const rpc=part('rpc_new'),init=part('init_new'),manifest=JSON.parse(part('manifest_before'))
const inventory=JSON.parse(part('inventory'))
function baselineDDL(){return `CREATE SCHEMA IF NOT EXISTS artecna_distruzione;CREATE SCHEMA IF NOT EXISTS artecna_rapportini;
GRANT USAGE ON SCHEMA public,artecna_distruzione TO artecna_cantieri_delete_rpc;
CREATE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid,p_conferma text) RETURNS TABLE(cantiere_id uuid,eliminato boolean,storage_nuovi bigint,conteggi jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $body$${rpc}$body$;
CREATE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $body$${init}$body$;
CREATE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid) RETURNS TABLE(entita text,quantita bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $body$${manifest}$body$;
ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO artecna_cantieri_delete_rpc;
REVOKE ALL ON FUNCTION artecna_distruzione.inizia_contesto(uuid),artecna_distruzione.manifest_cantiere(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.inizia_contesto(uuid),artecna_distruzione.manifest_cantiere(uuid) TO artecna_cantieri_delete_rpc;`}
function installed(file,name){const s=read(file),p=s.toLowerCase().indexOf('create function '+name.toLowerCase()+'('),b=s.indexOf('as $function$',p),e=s.indexOf('$function$;',b+14);if(p<0||e<0)throw Error(name);return s.slice(p,e+11)}
const economicDDL=()=>installed('20261001_residuo_componente_helper.sql','artecna_guardie.calcola_residuo_componente')+'\n'+installed('20261001_aggiungi_correzione_variante.sql','public.aggiungi_correzione_variante')+`\nALTER FUNCTION artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid) OWNER TO artecna_sal_rpc;ALTER FUNCTION public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text) OWNER TO artecna_varianti_rpc;`
const legacyWriterDDL=()=>JSON.parse(fs.readFileSync(new URL('../economia/ponteEconomiaProduction.fixture.json',import.meta.url),'utf8')).funzioni.find(s=>s.startsWith('CREATE OR REPLACE FUNCTION public.aggiungi_lavorazione_variante('))
export {root,read,rpc,init,manifest,inventory,baselineDDL,economicDDL,legacyWriterDDL}
