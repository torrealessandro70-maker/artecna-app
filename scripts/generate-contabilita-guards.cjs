const fs=require('node:fs'),path=require('node:path'),s=require('../audit-production/normalized-production.json')
const out=['-- Patch locali con fingerprint delle guardie Production. Non installata.','BEGIN;','SET LOCAL search_path=pg_catalog,pg_temp;',"DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;"]
function patch(name,edit){const f=s.functions.find(f=>f.name===name);if(!f)throw Error(name);out.push(`DO $$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='${f.signature}'::regprocedure) IS DISTINCT FROM '${f.source_md5}' THEN RAISE EXCEPTION 'Baseline ${name} divergente'; END IF; END $$;`);const first=f.definition.indexOf('$function$')+10,last=f.definition.lastIndexOf('$function$'),body=f.definition.slice(first,last),next=edit(body);if(next===body)throw Error('Missing patch anchor '+name);out.push(f.definition.slice(0,first)+next+f.definition.slice(last)+';')}
patch('nc_immutabile',b=>b.replace('BEGIN',`BEGIN
 IF TG_OP='UPDATE' AND current_user='postgres' THEN
  IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='fornitori_rettifiche' AND artecna_distruzione.td04_detach_consentito(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 END IF;`))
patch('nc_proteggi_documenti',b=>b.replace('BEGIN',`BEGIN
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='fatture_fornitori_righe' AND artecna_distruzione.documento_detach_consentito(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 END IF;`))
patch('materiali_fattura_guardia',b=>b.replace('BEGIN',`BEGIN
 IF TG_OP='DELETE' AND current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN
  IF OLD.cantiere_id=artecna_distruzione.target_prerequisiti() AND EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare WHERE source_table='public.materiali_cantiere' AND source_id=OLD.id AND cantiere_id=OLD.cantiere_id) THEN RETURN OLD; END IF;
 END IF;`))
patch('materiali_fattura_totale',b=>b.trimEnd()+`
 + coalesce((SELECT sum(a.quantita) FROM artecna_contabilita.archivio_quote a WHERE a.fattura_riga_id=p_riga
  AND NOT EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare b WHERE b.archivio_id=a.id)),0)
`)
patch('manifest_cantiere',b=>b.replace("IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN", "IF NOT artecna_distruzione.contesto_valido(p_cantiere) AND artecna_distruzione.target_prerequisiti() IS DISTINCT FROM p_cantiere THEN")
 .replace(/END;\s*$/, "RETURN QUERY SELECT 'memoria_prezzi'::text,count(*)::bigint FROM public.memoria_prezzi WHERE cantiere_id=p_cantiere;\n END;\n"))
out.push(`GRANT SELECT ON artecna_distruzione.quote_da_eliminare TO artecna_cantieri_delete_rpc;
GRANT EXECUTE ON FUNCTION artecna_distruzione.target_prerequisiti() TO artecna_cantieri_delete_rpc;
COMMIT;`)
fs.writeFileSync(path.resolve(__dirname,'../supabase/migrations/20261107000500_contabilita_guardie.sql'),out.join('\n')+'\n')
