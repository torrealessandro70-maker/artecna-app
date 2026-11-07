const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{withNative}=require('./native.cjs')
test('detach contabile: guardie reali e dati sintetici PostgreSQL 17.6',{timeout:180000},async t=>withNative(async(db)=>{
 const q=async(s,p=[]) => (await db.query(s,p)).rows
 const u=randomUUID(),v=randomUUID(),a=randomUUID(),b=randomUUID(),original=randomUUID(),note=randomUUID(),line=randomUUID(),noteLine=randomUUID()
 await q('INSERT INTO auth.users VALUES($1),($2)',[u,v]);await q("INSERT INTO public.cantieri(id,nome) VALUES($1,'A'),($2,'B')",[a,b]);await q("INSERT INTO public.utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner'),($3,$4,'owner')",[a,u,b,v]);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])
 await q("INSERT INTO public.fatture_fornitori(id,tipo_documento) VALUES($1,'TD01'),($2,'TD04')",[original,note])
 await q("INSERT INTO public.fatture_fornitori_righe(id,fattura_id,cantiere_id,quantita,prezzo_unitario,descrizione) VALUES($1,$2,$3,100,10,'Originale'),($4,$5,NULL,-10,10,'Nota')",[line,original,a,noteLine,note])
 const mat=randomUUID(),matB=randomUUID(),stock=randomUUID(),collection=randomUUID(),source=randomUUID(),econ=randomUUID()
 await q('SET ROLE artecna_materiali_fattura_rpc')
 await q("INSERT INTO public.materiali_cantiere(id,cantiere,cantiere_id,fattura_riga_id,descrizione,quantita,prezzo_unitario,totale,unita_misura) VALUES($1,'A',$2,$3,'Materiale A',2,10,20,'pz'),($4,'B',$5,$3,'Materiale B',1,10,10,'pz')",[mat,a,line,matB,b]);await q('RESET ROLE')
 await q("INSERT INTO public.materiali_impresa(id,fattura_riga_id,categoria,quantita,prezzo_unitario,totale,unita_misura,created_by,richiesta_id) VALUES($1,$2,'magazzino',1,10,10,'pz',$3,$4)",[stock,line,u,randomUUID()])
 await q("INSERT INTO public.economia_raccolte(id,cantiere_id,numero,titolo,data,created_by) VALUES($1,$2,1,'Economia','2026-11-07',$3)",[collection,a,u])
 const snapshot={version:1,fattura_riga_id:line,quantita:2,prezzo_unitario:10,descrizione:'Economia A',unita_misura:'pz',totale:20}
 await q("INSERT INTO public.economia_sorgenti(id,raccolta_id,tipo,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by) VALUES($1,$2,'fattura_fornitore','fattura.xml','fattura',encode(sha256(convert_to('fattura_snapshot_v1:'||$3::jsonb::text,'UTF8')),'hex'),1,$3,$4)",[source,collection,JSON.stringify(snapshot),u])
 await q("INSERT INTO public.economia_righe(id,raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,origine,sorgente_id,created_by,tipo_riga,dettagli_analitici,fattura_riga_id) VALUES($1,$2,1,'Economia A','pz',2,10,'fattura_fornitore',$3,$4,'materiale',$5,$6)",[econ,collection,source,u,JSON.stringify({version:1,fattura:snapshot}),line])
 const rects=[]
 for(const [col,id,cid]of [['materiale_cantiere_id',mat,a],['economia_riga_id',econ,a],['materiale_impresa_id',stock,a],['materiale_impresa_id',stock,null],['materiale_cantiere_id',matB,b]]){
  const rid=randomUUID();rects.push(rid);await q(`INSERT INTO public.fornitori_rettifiche(id,nota_id,nota_riga_id,origine_id,origine_riga_id,${col},cantiere_id,categoria,quantita,importo_netto,importo_costo,data_nota,richiesta_id,richiesta,fotografia,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,'materiali',0.1,-1,-1,'2026-11-07',$8,$9,$10,$11)`,[rid,note,noteLine,original,line,id,cid,randomUUID(),JSON.stringify({cantiere_id:cid}),JSON.stringify({cantiere_id:cid,quota:id}),u])
 }
 const emission=randomUUID(),advance=randomUUID(),link=randomUUID()
 await q("INSERT INTO public.fatture_emesse(id,cantiere_id,cantiere,cliente,totale,data_fattura,stato) VALUES($1,$2,'A','Cliente globale',100,'2026-11-07','emessa')",[emission,a])
 await q("INSERT INTO public.acconti_cantiere(id,cantiere_id,cantiere,importo,data_incasso) VALUES($1,$2,'A',20,'2026-11-07')",[advance,a])
 await q("INSERT INTO artecna_contabilita.attribuzioni_clienti(id,fattura_id,acconto_id,cantiere_id,cliente_confermato,importo,verificato,creato_da) VALUES($1,$2,$3,$4,'Cliente globale',20,true,$5)",[link,emission,advance,a,u])
 const before=(await q('SELECT artecna_guardie.materiali_fattura_totale($1) n',[line]))[0].n
 await t.test('writer materiali preesistente conserva DELETE di righe senza fattura fuori contesto',async()=>{
  const id=randomUUID();await q("INSERT INTO public.materiali_cantiere(id,cantiere,cantiere_id,descrizione) VALUES($1,'A',$2,'Operativo')",[id,a])
  await q('SET ROLE authenticated');try{await q('DELETE FROM public.materiali_cantiere WHERE id=$1',[id])}finally{await q('RESET ROLE')}
  assert.equal((await q('SELECT count(*)::int n FROM public.materiali_cantiere WHERE id=$1',[id]))[0].n,0)
 })
 await t.test('detach e mutazione TD04 negati fuori contesto',async()=>{
  await assert.rejects(q('SELECT artecna_distruzione.detach_contabile_cantiere()'),e=>e.code==='42501')
  await assert.rejects(q('UPDATE public.fornitori_rettifiche SET cantiere_id=NULL WHERE id=$1',[rects[0]]),e=>e.code==='55000')
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[v]);await assert.rejects(q("SELECT artecna_distruzione.apri_contesto_prerequisiti($1,'ELIMINA')",[a]),e=>e.code==='42501');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])
 })
 await t.test('errore dopo detach causa rollback completo di archivi, collegamenti e documenti',async()=>{
  await q('BEGIN');await q("SELECT artecna_distruzione.apri_contesto_prerequisiti($1,'ELIMINA')",[a]);await q('SELECT artecna_distruzione.detach_contabile_cantiere()')
  await assert.rejects(q("DO $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$"));await q('ROLLBACK')
  assert.equal((await q('SELECT count(*)::int n FROM artecna_contabilita.archivio_quote'))[0].n,0)
  assert.equal((await q('SELECT cantiere_id FROM public.fornitori_rettifiche WHERE id=$1',[rects[0]]))[0].cantiere_id,a)
  assert.equal((await q('SELECT count(*)::int n FROM artecna_contabilita.attribuzioni_clienti WHERE id=$1',[link]))[0].n,1)
  assert.equal((await q('SELECT cantiere_id FROM public.fatture_emesse WHERE id=$1',[emission]))[0].cantiere_id,a)
 })
 await t.test('detach autorizzato: documenti/stock/altro cantiere preservati, nessun UUID target archivio',async()=>{
  await q('BEGIN');await q('SET LOCAL ROLE artecna_cantieri_delete_rpc');await q("SELECT artecna_distruzione.apri_contesto_prerequisiti($1,'ELIMINA')",[a]);await q('SELECT artecna_distruzione.detach_contabile_cantiere()');await q('RESET ROLE')
  assert.equal((await q('SELECT count(*)::int n FROM artecna_contabilita.attribuzioni_clienti WHERE id=$1',[link]))[0].n,0)
  assert.equal((await q('SELECT cliente,cantiere_id FROM public.fatture_emesse WHERE id=$1',[emission]))[0].cliente,'Cliente globale')
  assert.equal((await q('SELECT cantiere_id FROM public.fatture_emesse WHERE id=$1',[emission]))[0].cantiere_id,null)
  assert.equal((await q('SELECT count(*)::int n FROM public.fatture_fornitori WHERE id IN ($1,$2)',[original,note]))[0].n,2)
  assert.equal((await q('SELECT count(*)::int n FROM public.materiali_impresa WHERE id=$1',[stock]))[0].n,1)
  assert.equal((await q('SELECT cantiere_id FROM public.fornitori_rettifiche WHERE id=$1',[rects[4]]))[0].cantiere_id,b)
  const preserved=(await q('SELECT row_to_json(x)::text j FROM public.fornitori_rettifiche x WHERE id=ANY($1::uuid[])',[rects.slice(0,4)])).map(r=>r.j).join('');assert(!preserved.includes(a));assert(!preserved.includes(mat));assert(!preserved.includes(econ))
  assert.equal((await q('SELECT artecna_guardie.materiali_fattura_totale($1) n',[line]))[0].n,before)
  await q('SET LOCAL ROLE artecna_cantieri_delete_rpc');await q('DELETE FROM public.materiali_cantiere WHERE id=$1',[mat]);await q('DELETE FROM public.economia_righe WHERE id=$1',[econ]);await q('RESET ROLE')
  assert.equal((await q('SELECT artecna_guardie.materiali_fattura_totale($1) n',[line]))[0].n,before)
  assert.equal((await q('SELECT count(*)::int n FROM artecna_distruzione.quote_da_eliminare WHERE cantiere_id=$1',[a]))[0].n,0)
  const archive=(await q("SELECT coalesce(json_agg(x)::text,'[]') j FROM artecna_contabilita.archivio_quote x"))[0].j+(await q("SELECT coalesce(json_agg(x)::text,'[]') j FROM artecna_contabilita.archivio_attribuzioni x"))[0].j
  assert(!archive.includes(a));assert(!archive.includes(mat));assert(!archive.includes(econ));assert(!archive.includes(advance))
  await q('SELECT artecna_distruzione.detach_contabile_cantiere()') // idempotent
  await q('SELECT artecna_distruzione.chiudi_contesto_prerequisiti()');await q('COMMIT')
 })
 await t.test('immutabilità resta operativa dopo detach; cliente globale resta testo documento',async()=>{
  await assert.rejects(q('UPDATE public.fornitori_rettifiche SET importo_netto=-2 WHERE id=$1',[rects[0]]),e=>e.code==='55000')
  assert.equal((await q('SELECT cliente FROM public.fatture_emesse WHERE id=$1',[emission]))[0].cliente,'Cliente globale')
 })
 await t.test('archivio leggibile dal titolare impresa senza ownership cantiere; utente estraneo negato',async()=>{
  await assert.rejects(q('SELECT public.leggi_archivio_contabile_cantiere($1)',[original]),e=>e.code==='42501')
  await q("INSERT INTO public.utenti_impresa(user_id,ruolo) VALUES($1,'titolare')",[v]);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[v])
  const archive=(await q('SELECT public.leggi_archivio_contabile_cantiere($1) a',[original]))[0].a;assert.equal(archive.quote.length,2)
  assert.equal((await q('SELECT public.leggi_archivio_contabile_cantiere($1) a',[emission]))[0].a.attribuzioni.length,1)
 })
}))
