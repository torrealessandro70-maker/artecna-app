/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const dir = __dirname
const migration = fs.readFileSync(path.join(dir, '../../migrations/20261106_preflight_eliminazione_readonly.sql'), 'utf8')
const site = '00000000-0000-4000-8000-000000000001', owner = '00000000-0000-4000-8000-000000000002'
const row = '00000000-0000-4000-8000-000000000003', other = '00000000-0000-4000-8000-000000000004'
async function setup() {
  const db = new PGlite()
  await db.exec(fs.readFileSync(path.join(dir,'fixture.sql'),'utf8'))
  await db.exec(migration)
  await db.exec(`INSERT INTO public.sopralluoghi VALUES ('s1');
    INSERT INTO public.cantieri(id,nome) VALUES ('${site}','Cantiere test');
    INSERT INTO public.utenti_cantiere VALUES ('${site}','${owner}','owner');
    SET request.jwt.claim.sub='${owner}';`)
  return db
}
async function snapshot(db) {
  const tables=(await db.query("SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','artecna_rapportini') AND c.relkind='r' ORDER BY 1,2")).rows
  const data={}
  for (const t of tables) data[t.nspname+'.'+t.relname]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS data FROM "${t.nspname}"."${t.relname}" t`)).rows[0].data
  return data
}
async function call(db, entity) {
  const before=await snapshot(db)
  await db.exec('BEGIN READ ONLY; SET LOCAL ROLE authenticated;')
  try {
    const result=(await db.query(`SELECT public.preflight_eliminazione_${entity}($1) AS result`,[entity==='cantiere'?site:'s1'])).rows[0].result
    assert.equal((await db.query("SELECT current_setting('transaction_read_only') AS ro")).rows[0].ro,'on')
    return result
  } finally { await db.exec('ROLLBACK'); assert.deepEqual(await snapshot(db),before,'zero mutazioni durante preflight') }
}
test('migration, ACL, owner, STABLE, search_path; helper privato', async () => {
  const db=await setup()
  try {
    const rows=(await db.query("SELECT proname,prosecdef,provolatile,proconfig,pg_get_userbyid(proowner) AS owner,has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS auth FROM pg_proc WHERE proname IN ('preflight_eliminazione_cantiere','preflight_eliminazione_sopralluogo','preflight_dipendenze')")).rows
    assert.equal(rows.length,3)
    for(const r of rows){ assert.equal(r.owner,'postgres');assert.equal(r.provolatile,'s');assert(r.proconfig.includes('search_path=pg_catalog, pg_temp'));assert.equal(r.anon,false);assert.equal(r.auth,r.proname!=='preflight_dipendenze');assert.equal(r.prosecdef,r.proname!=='preflight_dipendenze') }
    for(const fn of migration.matchAll(/AS \$body\$([\s\S]*?)\$body\$/g)) assert(!/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(fn[1].replace(/--[^\n]*/g,'')))
    assert(!migration.includes('artecna_distruzione'))
  } finally {await db.close()}
})
test('Sopralluogo vuoto e Cantiere realmente vuoto: eliminabili, zero scritture',async()=>{
 const db=await setup();try {for(const e of ['sopralluogo','cantiere']){const r=await call(db,e);assert.equal(r.stato,'eliminabile');assert.equal(r.verifica_completa,true);assert.deepEqual(r.categorie,[]);assert.equal(r.azione_consigliata,'conferma_eliminazione')}}finally{await db.close()}
})
const siteCases=[['acconti_cantiere','acconti'],['sal_lavorazioni','sal'],['preventivi_cantiere','preventivi'],['economia_raccolte','economia'],['varianti_cantiere','varianti'],['fatture_emesse','fatture'],['incassi_non_fatturati','incassi'],['pagamenti_fornitori','pagamenti'],['fornitori_rettifiche','rettifiche'],['rapportini','rapportini'],['timbrature','presenze'],['materiali_cantiere','materiali'],['attrezzi_cantiere','attrezzature'],['foto_cantiere','foto']]
test('Cantiere: ogni dominio economico/storico blocca anche se valore zero o nome test',async(t)=>{
 const db=await setup();try {for(const [table,category]of siteCases)await t.test(table,async()=>{
  await db.exec(`INSERT INTO public.${table}(id,cantiere_id) VALUES ('${row}','${site}')`)
  const r=await call(db,'cantiere');assert.equal(r.stato,'bloccato');assert(r.categorie.includes(category));assert.equal(r.azione_consigliata,'segna_concluso')
  await db.exec(`DELETE FROM public.${table}`)
 })}finally{await db.close()}
})
test('Sopralluogo: foto, note, allegati, richiami/copie, gestioni, preventivo e Variante indiretta',async(t)=>{
 const db=await setup();try {
  const cases=[
   ['foto',`INSERT INTO public.foto_sopralluogo VALUES('${row}','s1')`,'foto'],
   ['note nascoste RLS',`INSERT INTO public.note_sopralluogo VALUES('${row}','s1','${other}')`,'quaderno'],
   ['allegati',`INSERT INTO public.note_allegati VALUES('${other}','${row}')`,'allegati_quaderno'],
   ['richiami',`INSERT INTO public.quaderno_richiami_sopralluogo VALUES('${row}','s1','${row}')`,'quaderno'],
   ['copie',`INSERT INTO public.quaderno_copie_allegati VALUES('${row}','${row}','${row}')`,'allegati_quaderno'],
   ['gestioni',`INSERT INTO public.quaderno_gestioni VALUES('${row}','s1')`,'quaderno'],
   ['preventivo',`INSERT INTO public.preventivi_cantiere(id,sopralluogo_id) VALUES('${row}','s1')`,'preventivi'],
   ['fonte Variante',`INSERT INTO public.varianti_cantiere(id,cantiere_id,stato) VALUES('${row}','${site}','approvata');INSERT INTO public.variante_fonti_visive VALUES('${row}','${row}','${row}')`,'varianti']
  ]
  for(const [name,sql,category]of cases)await t.test(name,async()=>{await db.exec(sql);const r=await call(db,'sopralluogo');assert.equal(r.stato,'bloccato');assert(r.categorie.includes(category));assert.equal(r.azione_consigliata,'nessuna')})
  await db.exec('SET ROLE authenticated');assert.equal((await db.query('SELECT * FROM public.note_sopralluogo')).rows.length,0);await db.exec('RESET ROLE')
 }finally{await db.close()}
})
test('figli Rapportino, Economia, rettifiche e allegati cross-schema; RLS non nasconde blocchi',async()=>{
 const db=await setup();try{
  await db.exec(`INSERT INTO public.rapportini VALUES('${row}','${site}');INSERT INTO public.rapportino_prestazioni VALUES('${row}','${row}');INSERT INTO public.rapportino_materiali VALUES('${row}','${row}');INSERT INTO artecna_rapportini.allegati VALUES('${row}','${row}','${site}');INSERT INTO public.acconti_cantiere VALUES('${row}','${site}');SET ROLE authenticated`)
  assert.equal((await db.query('SELECT * FROM public.acconti_cantiere')).rows.length,0);await db.exec('RESET ROLE')
  const r=await call(db,'cantiere');assert(r.categorie.includes('acconti'));assert(r.categorie.includes('rapportini'));assert(r.categorie.includes('altri_collegamenti'))
 }finally{await db.close()}
})
test('accesso negato senza categorie: anonimo, utente senza membership, record assente; modello Sopralluoghi condiviso',async()=>{
 const db=await setup();try{
  await db.exec(`SET request.jwt.claim.sub='${other}'`)
  await assert.rejects(call(db,'cantiere'),e=>e.code==='42501'&&e.message==='Accesso negato')
  assert.equal((await call(db,'sopralluogo')).stato,'eliminabile','nessuna ownership inventata')
  await db.exec("SET request.jwt.claim.sub=''")
  for(const e of ['cantiere','sopralluogo'])await assert.rejects(call(db,e),e=>e.code==='42501'&&e.message==='Accesso negato')
  await db.exec(`SET request.jwt.claim.sub='${owner}';DELETE FROM public.sopralluoghi`)
  await assert.rejects(call(db,'sopralluogo'),e=>e.code==='42501')
 }finally{await db.close()}
})
test('schema incompleto, FK rimossa e accesso a ramo impossibile: sempre non_verificabile',async()=>{
 const db=await setup();try{
  await db.exec('ALTER TABLE public.note_allegati RENAME COLUMN nota_id TO persa')
  let r=await call(db,'sopralluogo');assert.equal(r.stato,'non_verificabile');assert.equal(r.verifica_completa,false);assert.deepEqual(r.categorie,[])
  await db.exec('ALTER TABLE public.note_allegati RENAME COLUMN persa TO nota_id;ALTER TABLE public.rapportino_materiali DROP CONSTRAINT rapportino_materiali_rapportino_id_fkey')
  r=await call(db,'cantiere');assert.equal(r.stato,'non_verificabile');assert.equal(r.azione_consigliata,'nessuna')
  await db.exec('ALTER TABLE public.rapportini ADD COLUMN altra_identita uuid UNIQUE;ALTER TABLE public.rapportino_materiali ADD FOREIGN KEY(rapportino_id) REFERENCES public.rapportini(altra_identita)')
  r=await call(db,'cantiere');assert.equal(r.stato,'non_verificabile','FK verso colonna diversa non certifica il ramo atteso')
  await db.exec('ALTER TABLE public.agenda_attivita RENAME COLUMN collegamento TO persa')
  r=await call(db,'sopralluogo');assert.equal(r.stato,'non_verificabile')
 }finally{await db.close()}
})
test('riferimenti legacy e agenda non richiedono FK; nuova FK scoperta automaticamente',async()=>{
 const db=await setup();try{
  await db.exec(`INSERT INTO public.preventivi_cantiere(id,cantiere) VALUES('${row}','Cantiere test')`)
  assert.equal((await call(db,'cantiere')).stato,'bloccato')
  await db.exec(`INSERT INTO public.agenda_attivita VALUES('${row}','{"tipo":"sopralluogo","id":"s1"}')`)
  assert((await call(db,'sopralluogo')).categorie.includes('agenda'))
  await db.exec(`CREATE TABLE public.nuovo_storico(id uuid,sorgente text REFERENCES public.sopralluoghi(id));INSERT INTO public.nuovo_storico VALUES('${row}','s1')`)
  assert((await call(db,'sopralluogo')).categorie.includes('altri_collegamenti'))
 }finally{await db.close()}
})
test('importo preventivo del Cantiere conservato anche senza figli; zero non sostituisce inventario',async()=>{
 const db=await setup();try{
  await db.exec(`UPDATE public.cantieri SET preventivo=100 WHERE id='${site}'`)
  const r=await call(db,'cantiere');assert.equal(r.stato,'bloccato');assert(r.categorie.includes('economia'))
 }finally{await db.close()}
})
test('precheck rifiuta metadata autorizzativi inattesi e rollback non installa funzioni',async()=>{
 const db=new PGlite();try{
  await db.exec(fs.readFileSync(path.join(dir,'fixture.sql'),'utf8'))
  await db.exec('ALTER FUNCTION public.quaderno_target_accessibile(text) SECURITY DEFINER')
  await assert.rejects(db.exec(migration),/Metadata autorizzazioni divergenti/)
  await db.exec('ROLLBACK')
  assert.equal((await db.query("SELECT to_regprocedure('public.preflight_eliminazione_cantiere(uuid)') AS fn")).rows[0].fn,null)
 }finally{await db.close()}
})
test('ACL estranea dai default: installazione fallisce e rollback completo',async()=>{
 const db=new PGlite();try{
  await db.exec(fs.readFileSync(path.join(dir,'fixture.sql'),'utf8'))
  await db.exec('ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO outsider')
  await assert.rejects(db.exec(migration),/ACL preflight inattese/)
  await db.exec('ROLLBACK')
  assert.equal((await db.query("SELECT to_regprocedure('artecna_guardie.preflight_dipendenze(text,text)') AS fn")).rows[0].fn,null)
 }finally{await db.close()}
})
