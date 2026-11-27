/* eslint-disable @typescript-eslint/no-require-imports -- Additional isolated native scenarios. */
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture,ids}=require('./fixture.cjs');
test('Ripartizioni, storici e rettifiche PostgreSQL',async t=>{
 const db=await fixture(),c=await db.connect('authenticated'),admin=db.admin;
 const read=()=>c.query('SELECT public.leggi_riconciliazione_unificata($1,$2) AS x',[ids.f,ids.a]).then(r=>r.rows[0].x);
 const send=async({ac=ids.a,f=ids.f,n=50,alloc=null,payment=null,total=55,request=randomUUID(),day='2026-11-20',fiscal=false,distinct=false}={})=>{
  const d=await read(),doc=d.fatture.find(x=>x.id===f).documento;
  return c.query('SELECT public.riconcilia_acconto_fattura($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x',[request,f,ac,payment,payment?null:{importo:total,data:day,metodo:'bonifico',riferimento:request,fonte:'Fonte sintetica bancaria',verificato:true,distinto:distinct},JSON.stringify(alloc??[{indice:0,imponibile:n}]),doc.impronta,'Contratto verificato sintetico',fiscal]).then(r=>r.rows[0].x);
 };
 const scenario=async(name,run)=>t.test(name,async()=>{await db.reset();await run()});
 const xml=groups=>`<FatturaElettronica><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Data>2026-11-27</Data><Numero>17</Numero></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>${groups.map(g=>`<DatiRiepilogo><AliquotaIVA>${g.rate}</AliquotaIVA>${g.natura?`<Natura>${g.natura}</Natura>`:''}<ImponibileImporto>${g.net}</ImponibileImporto><Imposta>${g.tax}</Imposta></DatiRiepilogo>`).join('')}</DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>`;
 try{
 await scenario('Migrazione conserva integralmente diciotto relazioni storiche',async()=>{assert.equal(db.preservationRelations,18)});
 await scenario('Autorizzazione impresa non sostituisce l’accesso al singolo cantiere',async()=>{
  await admin.query('UPDATE public.acconti_cantiere SET cantiere_id=$1 WHERE id=$2',[ids.c2,ids.a2]);
  await assert.rejects(c.query('SELECT public.leggi_riconciliazione_unificata(NULL,$1)',[ids.a2]),{code:'42501'});
  const d=await read();assert.equal(d.acconti.some(x=>x.id===ids.a2),false);await assert.rejects(send({ac:ids.a2}),{code:'42501'});assert.equal((await read()).incassi.length,0);
 });
 await scenario('Pagamenti distinti: nessuna nuova registrazione senza verifica esplicita',async()=>{
  await admin.query('UPDATE public.acconti_cantiere SET importo=100 WHERE id=$1',[ids.a]);await admin.query('UPDATE public.fatture_emesse SET imponibile=100,iva=10,totale=110 WHERE id=$1',[ids.f]);await db.verificaManuale();
  await send();await assert.rejects(send(),{code:'23514'});assert.equal((await read()).incassi.length,1);await send({distinct:true});const d=await read();assert.equal(d.incassi.length,2);assert.equal(d.incassi.reduce((n,i)=>n+i.disponibile,0),0);
 });
 await scenario('Quota parziale non può confermare tutto l’acconto come incassato',async()=>{
  await assert.rejects(send({fiscal:true}),{code:'23514'});assert.equal((await read()).incassi.length,0);
 });
 await scenario('Identità documentale duplicata e regime speciale restano bloccati',async()=>{
  await admin.query('UPDATE public.fatture_emesse SET numero_fattura=17 WHERE id=$1',[ids.f2]);assert.equal((await read()).fatture.find(x=>x.id===ids.f).documento.valida,false);
  await admin.query('UPDATE public.fatture_emesse SET numero_fattura=18 WHERE id=$1',[ids.f2]);await admin.query('UPDATE public.fatture_emesse SET xml_testo=$1,totale=110 WHERE id=$2',[xml([{net:100,tax:10,rate:10}]).replace('</Imposta>','</Imposta><EsigibilitaIVA>S</EsigibilitaIVA>'),ids.f]);assert.equal((await read()).fatture.find(x=>x.id===ids.f).documento.valida,false);await assert.rejects(send(),{code:'40001'});assert.equal((await read()).incassi.length,0);
 });
 await scenario('Senza IVA: solo Natura documentata, nessuna esenzione presunta',async()=>{
  await admin.query('UPDATE public.fatture_emesse SET xml_testo=$1,imponibile=100,iva=0,totale=100 WHERE id=$2',[xml([{net:100,tax:0,rate:0,natura:'N4'}]),ids.f]);
  await admin.query('UPDATE public.acconti_cantiere SET importo=100 WHERE id=$1',[ids.a]);
  assert.equal((await read()).fatture.find(x=>x.id===ids.f).documento.valida,true);await send({n:100,total:100});assert.equal((await read()).incassi[0].disponibile,0);
 });
 await scenario('Valuta estera XML non trattata automaticamente come euro',async()=>{
  await admin.query('UPDATE public.fatture_emesse SET xml_testo=$1,totale=110 WHERE id=$2',[xml([{net:100,tax:10,rate:10}]).replace('<TipoDocumento>','<Divisa>USD</Divisa><TipoDocumento>'),ids.f]);assert.equal((await read()).fatture.find(x=>x.id===ids.f).documento.valida,false);await assert.rejects(send(),{code:'40001'});assert.equal((await read()).incassi.length,0);
 });
 await scenario('Aliquote miste 10/22: conserva tutti i riepiloghi',async()=>{
  await admin.query('UPDATE public.fatture_emesse SET xml_testo=$1,imponibile=100,iva=16,totale=116 WHERE id=$2',[xml([{net:50,tax:5,rate:10},{net:50,tax:11,rate:22}]),ids.f]);
  await admin.query('UPDATE public.acconti_cantiere SET importo=100 WHERE id=$1',[ids.a]);
  await send({alloc:[{indice:0,imponibile:50},{indice:1,imponibile:50}],total:116});const d=await read();assert.equal(d.incassi[0].disponibile,0);assert.equal(d.fatture.find(x=>x.id===ids.f).quote[0].importo,116);
 });
 await scenario('Due acconti su una fattura senza doppia IVA',async()=>{
  await admin.query('UPDATE public.acconti_cantiere SET importo=50 WHERE id IN($1,$2)',[ids.a,ids.a2]);await admin.query('UPDATE public.fatture_emesse SET imponibile=100,iva=10,totale=110 WHERE id=$1',[ids.f]);await db.verificaManuale();
  await send();await send({ac:ids.a2});const d=await read();assert.equal(d.fatture.find(x=>x.id===ids.f).attribuito_netto,100);assert.equal(d.incassi.reduce((n,i)=>n+i.importo,0),110);
 });
 await scenario('Un acconto su due fatture riusa lo stesso pagamento',async()=>{
  await admin.query('UPDATE public.acconti_cantiere SET importo=100 WHERE id=$1',[ids.a]);await admin.query('UPDATE public.fatture_emesse SET imponibile=50,iva=10,totale=55 WHERE id IN($1,$2)',[ids.f,ids.f2]);await db.verificaManuale();
  const pay=randomUUID();await c.query("SELECT public.conferma_incasso_lordo_cliente($1,$2,110,'2026-11-20','bonifico','SYN-ONE-PAY','Fonte sintetica')",[pay,ids.a]);await send({payment:pay});await send({payment:pay,f:ids.f2});assert.equal((await read()).incassi.length,1);assert.equal((await read()).incassi[0].disponibile,0);
 });
 await scenario('Attribuzione netta preesistente esatta adottata, senza duplicarla',async()=>{
  await c.query('SELECT public.collega_incasso_cliente($1,$2,$3,4545.45,true)',[randomUUID(),ids.f,ids.a]);await send({n:4545.45,total:5000});assert.equal((await admin.query('SELECT count(*)::int AS n FROM artecna_contabilita.attribuzioni_clienti')).rows[0].n,1);
 });
 await scenario('Nota di credito e rettifica: STOP senza riclassificazione',async()=>{
  await admin.query("UPDATE public.fatture_emesse SET bluenext_tipo='TD04' WHERE id=$1",[ids.f]);await assert.rejects(send({n:4545.45,total:5000}),{code:'23514'});assert.equal((await read()).incassi.length,0);
 });
 await scenario('Errore fiscale dopo entrambe le quote: rollback totale',async()=>{
  await assert.rejects(send({n:4545.45,total:5000,day:'2026-11-21',fiscal:true}),{code:'23514'});
  assert.equal((await read()).incassi.length,0);assert.equal((await read()).fatture.find(x=>x.id===ids.f).quote.length,0);
 });
 await scenario('Stessa richiesta simultanea: una sola operazione',async()=>{
  const d=await read(),request=randomUUID(),args=[request,ids.f,ids.a,null,{importo:5000,data:'2026-11-20',metodo:'bonifico',riferimento:'SYN-SAME',fonte:'Fonte sintetica',verificato:true},JSON.stringify([{indice:0,imponibile:4545.45}]),d.fatture.find(x=>x.id===ids.f).documento.impronta,'Contratto sintetico documentato',false];
  const second=await db.connect('authenticated');const query='SELECT public.riconcilia_acconto_fattura($1,$2,$3,$4,$5,$6,$7,$8,$9)';await Promise.all([c.query(query,args),second.query(query,args)]);assert.equal((await read()).incassi.length,1);
 });
 await scenario('Scollegamento legacy di metà coppia rifiutato',async()=>{
  await send({n:4545.45,total:5000});const q=(await read()).fatture.find(x=>x.id===ids.f).quote[0];await assert.rejects(c.query('SELECT public.scollega_incasso_cliente($1,$2)',[randomUUID(),q.attribuzione_id]),{code:'23514'});assert.equal((await read()).incassi[0].disponibile,0);
 });
 await scenario('Quota lorda storica esatta adottata senza aggiungere quote',async()=>{
  const pay=randomUUID(),old=randomUUID();await c.query("SELECT public.conferma_incasso_lordo_cliente($1,$2,5000,'2026-11-20','bonifico','SYN-ALREADY-LINKED','Fonte sintetica')",[pay,ids.a]);await c.query('SELECT public.attribuisci_incasso_lordo_cliente($1,$2,$3,5000)',[old,pay,ids.f]);
  const request=randomUUID();await send({n:4545.45,total:5000,payment:pay,request});await send({n:4545.45,total:5000,payment:pay,request});const d=await read();assert.equal(d.fatture.find(x=>x.id===ids.f).quote.length,1);assert.equal(d.fatture.find(x=>x.id===ids.f).quote[0].id,old);assert.equal(d.incassi[0].disponibile,0);
 });
 await scenario('Due quote lorde da 2500: IVA al centesimo senza perdita o duplicazione',async()=>{
  const pay=randomUUID();await c.query("SELECT public.conferma_incasso_lordo_cliente($1,$2,5000,'2026-11-20','bonifico','SYN-CENTS','Fonte sintetica')",[pay,ids.a]);await send({n:2272.73,payment:pay});assert.equal((await read()).incassi[0].disponibile,2500);await send({n:2272.72,payment:pay});const d=await read();assert.equal(d.incassi[0].disponibile,0);assert.equal(d.fatture.find(x=>x.id===ids.f).quote.reduce((n,q)=>n+q.importo,0),5000);
 });
 }finally{await db.close()}
});
