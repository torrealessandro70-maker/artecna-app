// Synthetic Storage fixtures only. Domain CHECK constraints stay enabled.
// The isolated fixture_admin bypasses application/FK triggers while seeding;
// all backfills run normally as NOSUPERUSER postgres with every trigger enabled.
const {randomUUID}=require('node:crypto')
exports.seedStorage=async function(db,admin,configs,options={}){
 const cid=randomUUID(),uid=randomUUID();await db.query("INSERT INTO public.cantieri(id,nome) VALUES($1,'Storage fixture')",[cid])
 await admin.query('SET session_replication_role=replica')
 try{for(const cfg of configs){
  const [schema,table]=cfg.relation.split('.'),columns=(await db.query(`SELECT a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull nn,pg_get_expr(d.adbin,d.adrelid) def FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped`,[cfg.relation])).rows
  const row={},put=(k,v)=>{if(columns.some(c=>c.name===k))row[k]=v}
  for(const c of columns.filter(c=>c.nn&&!c.def))row[c.name]=c.type==='uuid'?randomUUID():c.type==='jsonb'?{}:c.type==='bytea'?Buffer.alloc(32):c.type.includes('timestamp')?'2026-11-08T00:00:00Z':c.type==='date'?'2026-11-08':c.type.startsWith('time')?'09:00':c.type==='text'?'fixture':c.type==='boolean'?true:1
  put('id',randomUUID());put('cantiere','Storage fixture');put('cantiere_id',cid);put('user_id',uid)
  for(const [k,f]of Object.entries(cfg.fields)){put(k,f.kind==='uri'?'https://axuiaiglbahygsmeoypy.supabase.co/storage/v1/object/public/preventivi/shared':'fixture/shared');if(f.bucket_column)put(f.bucket_column,table==='allegati'?'rapportini-v1':table==='quaderno_copie_allegati'?'quaderno-sopralluoghi':'quaderno-privato')}
  for(const k of cfg.json_fields)put(k,['assets','checklist','disegni'].includes(k)?[{storage_bucket:'preventivi',storage_path:'fixture/json'}]:{version:1,storage_bucket:'preventivi',storage_path:'fixture/json'})
  if(table==='preventivi_cantiere')put('provenienza_generazione',null)
  if(table==='foto_cantiere')put('storage_provider',null)
  if(table==='allegati'){put('mime_type','image/jpeg');put('stato','scaduto');put('bucket','rapportini-v1');put('file_path',`rapportini/${cid}/${row.rapportino_id}/${row.chiave_client_allegato}.jpg`)}
  if(['note_allegati','quaderno_allegati','quaderno_copie_allegati'].includes(table))put('tipo','foto')
  if(table==='quaderno_allegati'){put('url',null);put('storage_path',`utenti/${uid}/quaderni/${row.nota_id}/photo.jpg`)}
  if(table==='quaderno_copie_allegati')put('storage_path',`utenti/${uid}/richiami/${row.richiamo_id}/photo.jpg`)
  if(table==='economia_righe'){put('origine','file');put('tipo_riga','materiale');put('sorgente_id',randomUUID());put('indice_voce_sorgente',0);put('prestazione_snapshot',null)}
  if(table==='quaderno_gestioni')put('tipo','rimuovi')
  if(table==='variante_osservatore_analisi')put('modello','gpt-4.1-mini')
  if(table==='fornitori_rettifiche'){put('importo_netto',-1);put('importo_costo',-1);put('spesa_impresa_id',randomUUID())}
  if(table==='variante_sorgenti'){put('tipo','file');put('nome_file','fixture.pdf');put('formato','pdf')}
  if(table==='economia_sorgenti'){put('tipo','file');put('formato','pdf');put('file_sha256','a'.repeat(64))}
  const keys=Object.keys(row),values=keys.map(k=>columns.find(c=>c.name===k).type==='jsonb'&&row[k]!==null?JSON.stringify(row[k]):row[k]);await admin.query(`INSERT INTO "${schema}"."${table}"(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,values)
 }
 // URI and provider edge cases; foreign/data URLs must remain non-authoritative.
 for(const uri of ['quaderno-storage:utenti%2Ffixture%2Fa','quaderno-sopralluogo:utenti%2Ffixture%2Fb','https://axuiaiglbahygsmeoypy.supabase.co/storage/v1/object/sign/preventivi/a%20b?token=synthetic','https://example.invalid/a','data:image/png;base64,AAAA',''])await admin.query("INSERT INTO public.foto_cantiere(cantiere_id,storage_provider,file_path,immagine_base64) VALUES($1,'cloud',NULL,$2)",[cid,uri])
 if(options.large){
  await admin.query("INSERT INTO public.foto_cantiere(cantiere_id,immagine_base64) SELECT $1,'data:image/jpeg;base64,'||repeat('A',4000000) FROM generate_series(1,105)",[cid])
  await admin.query("INSERT INTO public.foto_sopralluogo(immagine_base64) SELECT 'data:image/jpeg;base64,'||repeat('B',4000000) FROM generate_series(1,41)")
  await admin.query("INSERT INTO public.preventivi_cantiere(cantiere,cantiere_id,anteprima_testo,json_voci_ai,file_path) SELECT 'Storage fixture',$1,repeat(md5(g::text),1024),jsonb_build_object('bucket','preventivi','file_path','fixture/shared-'||(g%64)), 'fixture/shared-'||(g%64) FROM generate_series(1,5000) g",[cid])
 }
 }finally{await admin.query('RESET session_replication_role')}
 return {cid,sourceTables:configs.length,large:!!options.large}
}
