// Generate a reviewable schema migration from the validated schema-only export.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),s=require('../audit-production/normalized-production.json')
const sources=new Map(),quote=v=>"'"+v.replaceAll("'","''")+"'"
function cfg(name){if(!sources.has(name))sources.set(name,{fields:{},json:[],bucket:null});return sources.get(name)}
for(const name of ['preventivi_cantiere','foto_cantiere','materiali_cantiere','attrezzi_cantiere']){
 cfg('public.'+name).fields={file_path:{kind:'path',bucket:'preventivi'},file_url:{kind:'uri'}}
}
cfg('public.foto_cantiere').fields.thumbnail_url={kind:'uri'}
cfg('public.foto_cantiere').fields.file_path.provider_column='storage_provider'
cfg('public.foto_cantiere').fields.immagine_base64={kind:'uri'}
cfg('public.foto_sopralluogo').fields.immagine_base64={kind:'uri'}
cfg('public.variante_documenti').fields.storage_path={kind:'path',bucket:'preventivi'}
cfg('artecna_rapportini.allegati').fields.file_path={kind:'path',bucket_column:'bucket'}
cfg('public.note_allegati').fields={storage_path:{kind:'path',bucket:'preventivi'},url:{kind:'uri'}}
for(const name of ['quaderno_allegati','quaderno_copie_allegati'])cfg('public.'+name).fields={storage_path:{kind:'path',bucket_column:'storage_bucket'}}
cfg('public.quaderno_allegati').fields.url={kind:'uri'}
cfg('public.fatture_emesse').fields={pdf_url:{kind:'uri'},xml_url:{kind:'uri'}}
for(const c of s.columns.filter(c=>['json','jsonb'].includes(c.type))){const r=s.relations.find(r=>r.oid===c.relation);cfg(r.schema+'.'+r.table).json.push(c.name)}
cfg('public.quaderno_richiami_sopralluogo').bucket='quaderno-sopralluoghi'
cfg('public.quaderno_gestioni').bucket=':gestione'
const rows=[]
for(const [name,c]of sources){const rel=s.relations.find(r=>r.schema+'.'+r.table===name),pk=s.constraints.find(k=>k.child_oid===rel.oid&&k.type==='p');assert(pk,name);rows.push(`(${quote(name)}::regclass,ARRAY[${pk.child_columns.map(quote).join(',')}]::text[],${quote(JSON.stringify(c.fields))}::jsonb,ARRAY[${c.json.map(quote).join(',')}]::text[],${c.bucket?quote(c.bucket):'NULL'})`)}
let sql=`-- Generata da schema Production SHA256 4e5bdd0d6befabbbc90cad17617419af96f9f92437f5915941827f4ff22b11c1.
-- Non installata. Nessuna UPDATE sui record sorgenti: backfill solo del registro.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
INSERT INTO artecna_distruzione.storage_sorgenti(relation,pk,fields,json_fields,json_bucket) VALUES\n${rows.join(',\n')};
DO $$ DECLARE s record;r record;c text; BEGIN
 FOR s IN SELECT * FROM artecna_distruzione.storage_sorgenti ORDER BY relation::text LOOP
  EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',s.relation);
 END LOOP;
 FOR s IN SELECT * FROM artecna_distruzione.storage_sorgenti ORDER BY relation::text LOOP
  FOR c IN SELECT jsonb_object_keys(s.fields) UNION SELECT unnest(s.json_fields) UNION SELECT unnest(s.pk) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=s.relation AND attname=c AND NOT attisdropped) THEN RAISE EXCEPTION 'Colonna sorgente Storage mancante'; END IF;
  END LOOP;
  EXECUTE format('CREATE TRIGGER storage_registry_reference AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION artecna_distruzione.storage_sync()',s.relation);
  EXECUTE format('CREATE TRIGGER storage_registry_no_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION artecna_distruzione.storage_sync()',s.relation);
  FOR r IN EXECUTE format('SELECT to_jsonb(t) j FROM %s t',s.relation) LOOP
   PERFORM artecna_distruzione.storage_indicizza(s.relation,NULL,r.j);
  END LOOP;
 END LOOP;
 UPDATE artecna_distruzione.storage_copertura SET completa=true WHERE singleton;
END $$;
-- Anomalie JSON senza bucket certo non diventano oggetti inventati: impediscono
-- il worker finché il riferimento non è normalizzato attraverso il writer.
COMMIT;
`
fs.writeFileSync(path.join(root,'supabase/migrations/20261107000200_storage_sources_backfill.sql'),sql)
console.log('Generated source configurations: '+sources.size)
