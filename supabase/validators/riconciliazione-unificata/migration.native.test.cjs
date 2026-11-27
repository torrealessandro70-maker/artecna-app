/* eslint-disable @typescript-eslint/no-require-imports -- Native local integration tests. */
const {test}=require('node:test'),a=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture,ids}=require('./fixture.cjs');
test('Riconciliazione atomica PostgreSQL reale',async t=>{
 const db=await fixture(),admin=db.admin,c=await db.connect('authenticated'),other=await db.connect('authenticated',ids.other),anon=await db.connect('anon');
 const read=()=>c.query('SELECT public.leggi_riconciliazione_unificata($1,$2) AS x',[ids.f,ids.a]).then(r=>r.rows[0].x);
 const state=()=>admin.query(`SELECT (SELECT count(*)::int FROM artecna_contabilita.incassi_lordi_clienti) payments,(SELECT count(*)::int FROM artecna_contabilita.quote_lorde_clienti) quotes,(SELECT count(*)::int FROM artecna_contabilita.attribuzioni_clienti) net,(SELECT importo::text FROM public.acconti_cantiere WHERE id=$1) amount`,[ids.a]).then(r=>r.rows[0]);
 const args=async(over={})=>{const d=await read();return [over.request??randomUUID(),over.f??ids.f,over.ac??ids.a,over.inc??null,over.inc?null:{importo:5000,data:'2026-11-20',metodo:'bonifico',riferimento:randomUUID(),fonte:'Estratto sintetico verificato',verificato:true},over.alloc??[{indice:0,imponibile:4545.45}],d.fatture.find(x=>x.id===(over.f??ids.f)).documento.impronta,over.base??'Contratto sintetico: base imponibile documentata',over.fiscal??true]};
 const send=(v,client=c)=>client.query('SELECT public.riconcilia_acconto_fattura($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x',v.map((x,i)=>i===5?JSON.stringify(x):x)).then(r=>r.rows[0].x);
 const seed=async(esito='consegnata')=>admin.query(`INSERT INTO artecna_contabilita.fatture_sdi(fattura_id,revisione,tipo,esito,trasmessa_at,esito_at,protocollo,ricevuta,fonte,autore) SELECT id,1,'TD01',$2,now(),now(),'SYNTHETIC','SYNTHETIC',artecna_contabilita.fonte_fattura(f),$3 FROM public.fatture_emesse f WHERE id=$1`,[ids.f,esito,ids.user]);
 async function scenario(name,run){await t.test(name,async()=>{await db.reset();await run()})}
 try{
 await scenario('TESTA fixture: 4545.45 + 454.55, un solo pagamento, pendenza e notifica chiuse',async()=>{
  await seed();await c.query("SELECT public.registra_acconto_fiscale($1,0,'incassato','ordinario','2026-11-20','Fonte sintetica')",[ids.a]);
  a.ok((await admin.query('SELECT count(*)::int AS n FROM artecna_notifiche.evento_notificabile WHERE resolved_at IS NULL')).rows[0].n>0);
  const request=await args();const r=await send(request);a.equal(r.fiscale.stato,'Regolarizzato');a.deepEqual(await state(),{payments:1,quotes:1,net:1,amount:'4545.45'});
  a.equal((await read()).incassi[0].disponibile,0);
  a.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_notifiche.evento_notificabile WHERE resolved_at IS NULL')).rows[0].n,0);
  await send(request);a.equal((await state()).payments,1);
 });
 await scenario('Assenza SdI: non inventa regolarizzazione',async()=>{const r=await send(await args());a.equal(r.fiscale.stato,'Da verificare')});
 await scenario('Incasso già presente riutilizzato',async()=>{const id=randomUUID();await c.query("SELECT public.conferma_incasso_lordo_cliente($1,$2,5000,'2026-11-20','bonifico','SYN-EXISTING','Fonte sintetica')",[id,ids.a]);await send(await args({inc:id}));a.equal((await state()).payments,1)});
 await scenario('Nessuna prova pagamento: rollback anche finanziario',async()=>{const v=await args();v[4].verificato=false;await a.rejects(send(v),{code:'23514'});a.equal((await state()).payments,0)});
 await scenario('Base storica ambigua: STOP',async()=>{await a.rejects(send(await args({base:''})),{code:'23514'});a.equal((await state()).net,0)});
 await scenario('Errore dopo creazione pagamento: rollback completo',async()=>{const v=await args();v[4].importo=1;await a.rejects(send(v),{code:'23514'});a.deepEqual(await state(),{payments:0,quotes:0,net:0,amount:'4545.45'})});
 await scenario('Fonte cambiata e idempotenza discordante rifiutate',async()=>{const v=await args();v[6]='wrong';await a.rejects(send(v),{code:'40001'});const good=await args();await send(good);good[7]='Altra fonte discordante';await a.rejects(send(good),{code:'23505'})});
 await scenario('Autorizzazioni: anon, altra impresa e scritture dirette negate',async()=>{const v=await args();await a.rejects(send(v,other),{code:'42501'});await a.rejects(send(v,anon),{code:'42501'});await a.rejects(c.query('SELECT * FROM artecna_contabilita.quote_lorde_clienti'),{code:'42501'});a.equal((await state()).payments,0)});
 await scenario('Vecchio selettore: 5000 su 4545.45 rifiutati dal server',async()=>{await a.rejects(c.query('SELECT public.collega_incasso_cliente($1,$2,$3,5000,true)',[randomUUID(),ids.f,ids.a]),{code:'23514'})});
 await scenario('Revoca unica e vecchia revoca parziale bloccata',async()=>{const v=await args();await send(v);await a.rejects(c.query('SELECT public.revoca_quota_lorda_cliente($1,$2)',[randomUUID(),v[0]]),{code:'23514'});await c.query('SELECT public.revoca_riconciliazione_unificata($1,$2)',[randomUUID(),v[0]]);a.equal((await read()).incassi[0].disponibile,5000);const r=await send(v);a.equal(r.revocata,true);a.equal((await state()).payments,1)});
 await scenario('Concorrenza: due conferme non duplicano il pagamento',async()=>{const v=await args(),v2=await args();const second=await db.connect('authenticated');const r=await Promise.allSettled([send(v),send(v2,second)]);a.equal(r.filter(x=>x.status==='fulfilled').length,1);a.equal((await state()).payments,1)});
 await scenario('IVA 22%, metà pagamento e completamento senza duplicazioni',async()=>{await admin.query(`UPDATE public.acconti_cantiere SET importo=100 WHERE id='${ids.a}';UPDATE public.fatture_emesse SET imponibile=100,iva=22,totale=122 WHERE id='${ids.f}'`);const v=await args({alloc:[{indice:0,imponibile:50}],fiscal:false});v[4].importo=122;await send(v);const pay=(await read()).incassi[0];a.equal(pay.disponibile,61);await send(await args({inc:pay.id,alloc:[{indice:0,imponibile:50}]}));a.equal((await read()).incassi[0].disponibile,0);a.equal((await state()).payments,1)});
 }finally{await db.close()}
});
