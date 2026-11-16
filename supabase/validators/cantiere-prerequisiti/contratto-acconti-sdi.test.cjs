/* eslint-disable @typescript-eslint/no-require-imports -- Native PostgreSQL fixture, loopback only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { withNative } = require('./native.cjs')
const { certifiedInstallerFixture } = require('./installerBaseline.cjs')
const { seedRuntime } = require('./runtimeFixture.cjs')
const { alignAccountingAcl } = require('./contabilitaUsageFixture.cjs')

const load = name => fs.readFileSync(path.join(__dirname, '../../migrations', name), 'utf8').replace(/\r\n/g, '\n')

test('Contratto fiscale su PostgreSQL 17.6', { timeout: 180000 }, () => withNative(async (db, connect) => {
  const q = async (sql, args) => (await db.query(sql, args)).rows
  const value = async (sql, args) => (await q(sql, args))[0].v
  const admin = await connect('fixture_admin')
  for (const name of ['20261108000800_cantiere_hard_delete_finale.sql', '20261108000900_cantiere_hard_delete_runtime_v2.sql']) {
    await q(load(name))
  }
  await admin.query('ALTER ROLE postgres SUPERUSER')
  const fixture = await seedRuntime(db, 0)
  await q(load('20261108001000_cantiere_hard_delete_runtime_v3.sql'))
  await alignAccountingAcl(db)
  await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
  await q(load('20261109001100_cantiere_delete_contabilita_schema_usage.sql'))
  await value("INSERT INTO public.pagamenti_fornitori(fornitore_nome,data_scadenza) VALUES('Legacy','2026-01-01') RETURNING id v")
  await q(load('20261112000500_rapportini_stato_operativo.sql'))
  await q(fs.readFileSync(path.join(__dirname,'../scadenziario/documenti-storage-fixture.sql'),'utf8'))
  for(const migration of ['20261110000100_scadenziario_fiscale_persistenza.sql','20261111000100_documenti_fiscali_privati.sql','20261112000100_notifiche_in_app_scadenziario.sql']){
    await q(load(migration))
  }
  await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
  await q(load('20261113000100_rapportini_attesi_hard_delete.sql'))
  const scheduler = load('20261112000200_notifiche_scheduler.sql')
  const wrapper = scheduler.match(/CREATE OR REPLACE FUNCTION artecna_notifiche\.esegui_generatore_runtime\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/)?.[0]
  assert.ok(wrapper)
  await q(wrapper)
  for (const migration of ['20261112000300_notifiche_agenda.sql','20261112000400_notifiche_sopralluoghi.sql',
    '20261113000200_notifiche_rapportini_attesi.sql','20261113000300_debiti_fornitori.sql']) await q(load(migration))
  const signature = () => value('SELECT artecna_distruzione.hard_delete_catalog() v')
  const prima = await signature()
  await q(fs.readFileSync(path.join(__dirname, '../../migrations/20261114000100_notifiche_pagamenti_fornitori.sql'), 'utf8'))
  assert.equal(await signature(),prima)
  const titolare=fixture.u, esterno=randomUUID()
  await q('INSERT INTO auth.users(id) VALUES($1)',[esterno])
  await q("INSERT INTO public.utenti_impresa(user_id,ruolo,attivo) VALUES($1,'titolare',true) ON CONFLICT(user_id) DO UPDATE SET attivo=true",[titolare])
  const client=await connect('fixture_admin')
  const as = async (user,sql,args=[],connection=client) => {
    await connection.query('BEGIN')
    try {
      await connection.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user])
      await connection.query('SET LOCAL ROLE authenticated')
      const result=(await connection.query(sql,args)).rows
      await connection.query('COMMIT')
      return result
    } catch (error) { await connection.query('ROLLBACK'); throw error }
  }

  await q(load('20261114000200_contratto_acconti_fatture_sdi.sql'))
  await q(fs.readFileSync(path.join(__dirname, '../../migrations/20261114000300_notifiche_fatture_da_emettere.sql'), 'utf8'))
  await q(load('20261115000100_rinvio_notifiche.sql'))
  assert.equal(await signature(),prima)
  await q(load('20261115000200_importazione_bluenext.sql'))
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
  const hardDeleteBluenext = await signature()
  await q(load('20261115000300_associazione_bluenext_storico.sql'))
  assert.notEqual(await signature(),hardDeleteBluenext)
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
  const hardDeleteStorico=await signature()
  await q(load('20261115000400_incassi_lordi_clienti.sql'))
  assert.notEqual(await signature(),hardDeleteStorico)
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
  const firmaPrimaCro=await signature()
  await q(load('20261115000500_rettifica_riferimento_incasso.sql'))
  assert.notEqual(await signature(),firmaPrimaCro)
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
  const producer = () => q(`SELECT proname, pg_get_functiondef(oid) AS definizione, proacl::text AS acl
    FROM pg_proc WHERE pronamespace='artecna_notifiche'::regnamespace AND oid IN (
      SELECT to_regprocedure('artecna_notifiche.'||nome||'(timestamptz)')
      FROM unnest(ARRAY['genera_scadenze','genera_agenda','genera_sopralluoghi',
        'genera_rapportini_attesi','genera_pagamenti_fornitori','genera_fatture_da_emettere']) AS nomi(nome)
    ) ORDER BY proname`)
  const producerPrimaEliminazione=await producer()
  assert.equal(producerPrimaEliminazione.length,6)
  const firmaPrimaEliminazione=await signature()
  await q(load('20261115000600_elimina_incasso_lordo_cliente.sql'))
  assert.equal(await signature(),firmaPrimaEliminazione)
  assert.deepEqual(await producer(),producerPrimaEliminazione)
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
  const netto=await value("INSERT INTO public.acconti_cantiere(cantiere_id,cantiere,importo,data_incasso) VALUES ($1,'Fixture',9090.91,CURRENT_DATE) RETURNING id v",[fixture.a])
  const lordoDoc=await value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,totale,importo_incassato,data_fattura) VALUES ($1,'Fixture',10000,0,CURRENT_DATE) RETURNING id v",[fixture.a])
  const pagamento=randomUUID()
  const conferma='SELECT public.conferma_incasso_lordo_cliente($1,$2,$3,current_date,$4,$5,$6) v'
  const params=[pagamento,netto,10000,'bonifico','cro-generico','Estratto sintetico']
  await assert.rejects(as(esterno,conferma,params),{code:'42501'})
  await as(titolare,conferma,params)
  await as(titolare,conferma,params)
  await assert.rejects(as(titolare,conferma,[randomUUID(),...params.slice(1)]),{code:'23505'})
  const attribuisci='SELECT public.attribuisci_incasso_lordo_cliente($1,$2,$3,$4) v'
  const leggi='SELECT public.leggi_incassi_lordi_cliente($1,$2) v'
  const quota1=randomUUID(), quota2=randomUUID()
  await as(titolare,attribuisci,[quota1,pagamento,lordoDoc,4000])
  assert.equal((await as(titolare,leggi,[lordoDoc,'fattura']))[0].v.residuo,6000)
  await as(titolare,attribuisci,[quota2,pagamento,lordoDoc,6000])
  await as(titolare,attribuisci,[quota2,pagamento,lordoDoc,6000])
  await assert.rejects(as(titolare,attribuisci,[randomUUID(),pagamento,lordoDoc,1]),{code:'23514'})
  assert.equal((await as(titolare,leggi,[lordoDoc,'fattura']))[0].v.residuo,0)
  assert.equal(await value('SELECT (31438.40-importo)::text v FROM public.acconti_cantiere WHERE id=$1',[netto]),'22347.49')
  assert.equal(await value('SELECT count(*)::int v FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=$1',[netto]),0)
  assert.equal(await value('SELECT count(*)::int v FROM artecna_contabilita.fatture_sdi WHERE fattura_id=$1',[lordoDoc]),0)
  await assert.rejects(q('DELETE FROM public.acconti_cantiere WHERE id=$1',[netto]),{code:'23503'})
  const storicoNetto=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,nota) VALUES ($1,8574.11,'Totale 9431,52') RETURNING id v",[fixture.a])
  assert.deepEqual((await as(titolare,leggi,[storicoNetto,'acconto']))[0].v.incassi,[])
  const parziale=randomUUID()
  await as(titolare,conferma,[parziale,netto,200,'contanti','ricevuta-2','Ricevuta sintetica'])
  const senzaCantiere=await value("INSERT INTO public.fatture_emesse(cliente,totale) VALUES ('Fixture',100) RETURNING id v")
  await assert.rejects(as(titolare,attribuisci,[randomUUID(),parziale,senzaCantiere,10]),{code:'42501'})
  const due=await Promise.all([50,150].map(totale=>value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,totale,importo_incassato) VALUES ($1,'Fixture',$2,0) RETURNING id v",[fixture.a,totale])))
  const primaQuota=randomUUID()
  await as(titolare,attribuisci,[primaQuota,parziale,due[0],50])
  await as(titolare,attribuisci,[randomUUID(),parziale,due[1],100])
  const revoca='SELECT public.revoca_quota_lorda_cliente($1,$2) v', richiestaRevoca=randomUUID()
  await as(titolare,revoca,[richiestaRevoca,primaQuota])
  await as(titolare,revoca,[richiestaRevoca,primaQuota])
  assert.equal((await as(titolare,leggi,[due[0],'fattura']))[0].v.residuo,null)
  const client2=await connect('fixture_admin')
  const corse=await Promise.allSettled([
    as(titolare,attribuisci,[randomUUID(),parziale,due[0],50]),
    as(titolare,attribuisci,[randomUUID(),parziale,due[0],50],client2),
  ])
  assert.equal(corse.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(corse.find(r=>r.status==='rejected').reason.code,'23514')
  const economia=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo) VALUES ($1,2000) RETURNING id v",[fixture.a])
  const imputa='SELECT public.imputa_acconto_cliente($1,$2,$3,$4,$5) v', riepilogo='SELECT public.riepilogo_incassi_lordi_cantiere($1) v'
  const scelta=[randomUUID(),netto,0,'contratto','Verifica sintetica']
  await assert.rejects(as(esterno,imputa,scelta),{code:'42501'})
  await as(titolare,imputa,scelta)
  await as(titolare,imputa,scelta)
  await as(titolare,imputa,[randomUUID(),economia,0,'economia','Nessuna imputazione al contratto'])
  const quadro=(await as(titolare,riepilogo,[fixture.a]))[0].v
  assert.equal(quadro.acconti_netto,9090.91)
  assert.equal(quadro.acconti_economia,1)
  assert.equal(quadro.pagamenti,10200)
  assert.equal(quadro.non_attribuiti,50)
  await as(titolare,imputa,[randomUUID(),economia,1,'da_verificare','Riesame'])
  await assert.rejects(as(titolare,imputa,[randomUUID(),economia,1,'economia','Obsoleta']),{code:'40001'})
  await q("UPDATE public.acconti_cantiere SET importo=2001 WHERE id=$1",[economia])
  const storicoEconomia=(await as(titolare,leggi,[economia,'acconto']))[0].v
  assert.equal(storicoEconomia.imputazione_effettiva,'da_verificare')
  assert.equal(storicoEconomia.imputazioni.length,2)
  assert.equal(storicoEconomia.incassi.length,0)
  console.log('INCASSI_LORDI_FIXTURE_GREEN netto_residuo=22347.49 lordo_residuo=0')
  const rettifica='SELECT public.rettifica_riferimento_incasso_lordo_cliente($1,$2,$3,$4,$5,$6) v'
  const storicoCro='SELECT public.leggi_rettifiche_incasso_lordo_cliente($1) v'
  const movimento=()=>value("SELECT to_jsonb(i)-'riferimento' v FROM artecna_contabilita.incassi_lordi_clienti i WHERE id=$1",[pagamento])
  const quoteLorde=()=>value("SELECT jsonb_agg(to_jsonb(q) ORDER BY id) v FROM artecna_contabilita.quote_lorde_clienti q WHERE incasso_id=$1",[pagamento])
  const primaCro=await movimento(), quotePrimaCro=await quoteLorde()
  const richiestaCro=[randomUUID(),pagamento,0,'SYNTHETIC-CRO-01','Estratto sintetico','Riferimento bancario completo']
  await assert.rejects(as(esterno,rettifica,richiestaCro),{code:'42501'})
  const coppiaCro=await Promise.all([
    as(titolare,rettifica,richiestaCro),
    as(titolare,rettifica,richiestaCro,client2),
  ])
  assert.deepEqual(coppiaCro.map(r=>r[0].v.richiesta_duplicata).sort(),[false,true])
  for(const risposta of coppiaCro) {
    assert.equal(risposta[0].v.incasso_id,pagamento)
    assert.equal(risposta[0].v.riferimento_precedente,'cro-generico')
    assert.equal(risposta[0].v.riferimento_nuovo,'synthetic-cro-01')
  }
  await assert.rejects(as(titolare,rettifica,[...richiestaCro.slice(0,3),'discordante',...richiestaCro.slice(4)]),{code:'23505'})
  await assert.rejects(as(titolare,rettifica,[randomUUID(),pagamento,0,'synthetic-cro-02','Fixture','Concorrenza']),{code:'40001'})
  assert.equal((await as(titolare,conferma,params))[0].v.id,pagamento)
  assert.equal((await as(titolare,conferma,params))[0].v.richiesta_duplicata,true)
  await assert.rejects(as(titolare,conferma,[randomUUID(),...params.slice(1)]),{code:'23505'})
  const occupato=[randomUUID(),netto,1,'bonifico','synthetic-occupato','Estratto sintetico']
  await as(titolare,conferma,occupato)
  await assert.rejects(as(titolare,rettifica,[randomUUID(),pagamento,1,'SYNTHETIC-OCCUPATO','Fixture','Duplicato']),{code:'23505'})
  assert.deepEqual(await movimento(),primaCro)
  assert.deepEqual(await quoteLorde(),quotePrimaCro)
  const dopoLordi=(await as(titolare,leggi,[lordoDoc,'fattura']))[0].v
  assert.equal(dopoLordi.residuo,0)
  assert.equal(dopoLordi.incassi.find(i=>i.id===pagamento).disponibile,0)
  assert.equal((await as(titolare,storicoCro,[netto]))[0].v.length,1)
  const a=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES ($1,100,CURRENT_DATE) RETURNING id v",[fixture.a])
  const b=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES ($1,50,CURRENT_DATE) RETURNING id v",[fixture.a])
  const doc=async(totale)=>value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,totale,data_fattura) VALUES ($1,'Fixture', $2,CURRENT_DATE) RETURNING id v",[fixture.a,totale])
  const fattura=await doc(150), nota=await doc(-30)
  const today=await value("SELECT (now() AT TIME ZONE 'Europe/Rome')::date::text v")
  const stato=async id=>(await as(titolare,'SELECT public.leggi_acconto_fiscale($1) v',[id]))[0].v
  const incasso='SELECT public.registra_acconto_fiscale($1,$2,$3,$4,$5,$6)'
  assert.equal((await stato(a)).stato,'Da verificare')
  await as(titolare,incasso,[a,0,'previsto','da_verificare',null,'Fixture'])
  assert.equal((await stato(a)).stato,'Non ancora incassato')
  await assert.rejects(as(titolare,incasso,[a,1,'incassato','ordinario',null,'Fixture']),{code:'22023'})
  const notices = id => value("SELECT count(*)::int v FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.modulo='fatture_da_emettere' AND e.record_id=$1 AND n.resolved_at IS NULL",[id])
  assert.equal(await notices(a),0)
  await client.query('BEGIN')
  try {
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[titolare])
    await client.query('SET LOCAL ROLE authenticated')
    await client.query(incasso,[a,1,'incassato','ordinario',today,'Fixture rollback'])
    assert.equal((await client.query("SELECT public.contatori_notifiche()->>'fatture_da_emettere' v")).rows[0].v,'1')
    await assert.rejects(client.query('SELECT 1/0'),{code:'22012'})
  } finally { await client.query('ROLLBACK') }
  assert.equal(await notices(a),0)
  assert.equal((await stato(a)).revisione,1)
  await as(titolare,incasso,[a,1,'incassato','ordinario',today,'Fixture'])
  const avvisoIncasso=async id => (await q(
    "SELECT n.id,n.titolo,n.messaggio,e.id AS evento FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.modulo='fatture_da_emettere' AND e.record_id=$1",[id]))
  await as(titolare,incasso,[b,0,'incassato','da_verificare',today,'Lavori in economia'])
  const verifica=await stato(b)
  assert.equal(verifica.stato,'Da verificare')
  assert.equal(verifica.data_fiscale,today)
  assert.equal(verifica.termine,null)
  const [avviso]=await avvisoIncasso(b)
  assert.equal(avviso.titolo,'Verificare obbligo fattura')
  assert.match(avviso.messaggio,/anticipo sul prezzo.*tempestivamente/)
  await as(titolare,incasso,[b,1,'incassato','ordinario',today,'Classificazione confermata'])
  const ordinario=await stato(b)
  assert.equal(ordinario.data_fiscale,today)
  assert.equal(ordinario.giorni_residui,12)
  const avvisi=await avvisoIncasso(b)
  assert.equal(avvisi.length,1)
  assert.equal(avvisi[0].id,avviso.id)
  assert.equal(avvisi[0].evento,avviso.evento)
  assert.equal(avvisi[0].titolo,'Fattura da emettere')
  assert.equal((await stato(a)).giorni_residui,12)
  assert.equal(await value("SELECT count(*)::int v FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.modulo='fatture_da_emettere' AND e.record_id=$1 AND n.resolved_at IS NULL",[a]),1)
  const notificaAttiva=()=>value("SELECT n.id v FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.modulo='fatture_da_emettere' AND e.record_id=$1 AND n.resolved_at IS NULL",[a])
  let idNotifica=await notificaAttiva()
  const domani=await value("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date+1)::text v")
  const rinvia=(utente,giorno)=>as(utente,'SELECT public.rinvia_notifica($1,$2) v',[idNotifica,giorno])
  const elenco=async ()=>(await as(titolare,"SELECT public.lista_notifiche('fatture_da_emettere',0) v"))[0].v
  const proposta=async id=>(await as(titolare,'SELECT public.proponi_riconciliazione_acconto($1) v',[id]))[0].v
  const alternativa=await value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,imponibile,iva,totale,data_fattura) VALUES($1,'Fixture',100,10,110,$2) RETURNING id v",[fixture.a,today])
  assert.deepEqual((await proposta(a)).fatture.filter(f=>f.id===alternativa).map(f=>[f.id,f.esito,Number(f.imponibile),Number(f.totale)]),[[alternativa,'da_verificare',100,110]])
  assert.equal((await rinvia(esterno,domani))[0].v,false)
  assert.equal((await rinvia(titolare,domani))[0].v,true)
  assert.equal((await rinvia(titolare,domani))[0].v,true)
  assert.ok(!(await elenco()).some(n=>n.id===idNotifica))
  await assert.rejects(rinvia(titolare,'2099-01-01'),{code:'22023'})
  await q("UPDATE artecna_notifiche.notifica SET rinviata_fino_a=now()-interval '1 second' WHERE id=$1",[idNotifica])
  assert.ok((await elenco()).some(n=>n.id===idNotifica))
  const xmlBluenext=(numero,data,tipo='TD02',netto='100.00',totale='110.00')=>`
<FatturaElettronica><FatturaElettronicaHeader>
 <CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdFiscaleIVA></DatiAnagrafici></CedentePrestatore>
 <CessionarioCommittente><DatiAnagrafici><CodiceFiscale>CLIENTEFIXTURE</CodiceFiscale><Anagrafica><Denominazione>Fixture</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente>
</FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento>
 <TipoDocumento>${tipo}</TipoDocumento><Numero>${numero}</Numero><Data>${data}</Data><ImportoTotaleDocumento>${totale}</ImportoTotaleDocumento>
</DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DatiRiepilogo><ImponibileImporto>${netto}</ImponibileImporto><Imposta>10.00</Imposta></DatiRiepilogo></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>`
  const importaSql='SELECT public.importa_fatture_bluenext($1,$2) v'
  const importa=async (user,documenti,conn=client)=>(await as(user,importaSql,[documenti,fixture.a],conn))[0].v
  const aUrgenza=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES($1,20,$2) RETURNING id v",[fixture.a,today])
  await as(titolare,incasso,[aUrgenza,0,'incassato','ordinario',today,'Fixture urgenza'])
  const notificaUrgente=await value("SELECT n.id v FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.record_id=$1",[aUrgenza])
  const archivia=()=>as(titolare,"SELECT public.aggiorna_stato_notifica($1,'archivia') v",[notificaUrgente])
  await archivia()
  await q("SELECT artecna_notifiche.riconcilia_acconto_fiscale($1,now()+interval '13 days')",[aUrgenza])
  assert.equal(await value("SELECT archived_at IS NULL AND priorita='urgente' AND cardinality(archiviazioni_fiscali)=1 v FROM artecna_notifiche.notifica WHERE id=$1",[notificaUrgente]),true)
  await assert.rejects(as(titolare,'SELECT public.rinvia_notifica($1,$2)',[notificaUrgente,domani]),{code:'22023'})
  await archivia()
  await q("SELECT artecna_notifiche.riconcilia_acconto_fiscale($1,now()+interval '14 days')",[aUrgenza])
  assert.equal(await value('SELECT archived_at IS NOT NULL v FROM artecna_notifiche.notifica WHERE id=$1',[notificaUrgente]),true)
  assert.equal((await stato(aUrgenza)).giorni_residui,12)
  await as(titolare,incasso,[aUrgenza,1,'stornato','ordinario',null,'Fine prova'])
  const discordanti=await importa(titolare,[xmlBluenext('BL-X','2024-01-15'),xmlBluenext('BL-X','2024-01-15','TD02','120.00','130.00')])
  assert.deepEqual(discordanti.map(f=>f.stato),['Ambigua','Ambigua'])
  assert.equal(await value("SELECT count(*)::int v FROM public.fatture_emesse WHERE numero_fattura='BL-X'"),0)
  const incompleto=xmlBluenext('BL-INCOMPLETO','2024-01-15').replace(/<CessionarioCommittente>[\s\S]*?<\/CessionarioCommittente>/,'')
  const respinti=await importa(titolare,[incompleto,'<malformato>'])
  assert.deepEqual(respinti.map(f=>f.stato),['Ambigua','Errore'])
  const x=xmlBluenext('BL-1','2024-01-15')
  await assert.rejects(importa(esterno,[x]),{code:'42501'})
  const second=await connect('fixture_admin')
  const storicoXml=xmlBluenext('BL-STORICO','2024-01-15')
  const storico=await value(`INSERT INTO public.fatture_emesse
    (cantiere_id,numero_fattura,data_fattura,cliente,imponibile,iva,totale,importo_incassato,stato)
    VALUES ($1,'BL-STORICO','2024-01-15','Fixture',100,10,110,25,'parziale') RETURNING id v`,[fixture.a])
  const crypto = require('node:crypto')
  const improntaXml = xml => crypto.createHash('sha256').update(xml).digest('hex')
  const impronte=[improntaXml(storicoXml)]
  const confrontoSql='SELECT public.confronta_fattura_bluenext($1,$2,$3) v'
  const associaSql='SELECT public.associa_fattura_bluenext($1,$2,$3,$4) v'
  const confronta = async (xml=storicoXml, impronteFile=[improntaXml(xml)]) =>
    (await as(titolare,confrontoSql,[storico,xml,impronteFile]))[0].v
  const associa = async (versione,conn=client,xml=storicoXml,impronteFile=[improntaXml(xml)]) =>
    (await as(titolare,associaSql,[storico,xml,impronteFile,versione],conn))[0].v
  const fotografia = () => value(`SELECT jsonb_build_array(
    (SELECT to_jsonb(f)-ARRAY['bluenext_identita','bluenext_impronta','bluenext_tipo','bluenext_associazione'] FROM public.fatture_emesse f WHERE id=$1),
    (SELECT count(*) FROM public.fatture_emesse),
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.acconti_cantiere a),
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM artecna_contabilita.attribuzioni_clienti a),
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.fattura_id,s.revisione) FROM artecna_contabilita.fatture_sdi s),
    (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM artecna_notifiche.notifica n),
    (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM artecna_notifiche.evento_notificabile e)) v`,[storico])
  await assert.rejects(as(esterno,confrontoSql,[storico,storicoXml,impronte]),{code:'42501'})
  await assert.rejects(as(esterno,associaSql,[storico,storicoXml,impronte,'']),{code:'42501'})
  try {
    assert.deepEqual(await as(titolare,"UPDATE public.fatture_emesse SET bluenext_associazione='{}' WHERE id=$1 RETURNING id",[storico]),[])
  } catch (err) {
    assert.equal(err.code,'42501')
  }
  assert.equal(await value('SELECT bluenext_associazione v FROM public.fatture_emesse WHERE id=$1',[storico]),null)
  assert.equal(await value("SELECT has_function_privilege('anon','public.associa_fattura_bluenext(uuid,text,text[],text,boolean)','EXECUTE') v"),false)
  assert.equal(await value("SELECT has_function_privilege('service_role','public.associa_fattura_bluenext(uuid,text,text[],text,boolean)','EXECUTE') v"),false)
  const privaDiTipo=await confronta()
  assert.equal(privaDiTipo.esito,'Conferma assistita')
  assert.equal(privaDiTipo.storico.tipo,null)
  assert.equal(await associa(privaDiTipo.versione),'Conferma esplicita del tipo XML necessaria')
  await as(titolare,'SELECT public.registra_evidenza_sdi($1,0,$2,$3,NULL,NULL,NULL,NULL,NULL,$4)',
    [storico,'TD02','da_verificare','[]'])
  const verificata=await confronta()
  assert.equal(verificata.esito,'Verificabile')
  assert.equal(verificata.storico.tipo,'TD02')
  assert.equal(verificata.xml.codice_fiscale,'CLIENTEFIXTURE')
  const secondaCandidata=await value(`INSERT INTO public.fatture_emesse
    (cantiere_id,numero_fattura,data_fattura,cliente,imponibile,iva,totale)
    VALUES ($1,'BL-STORICO','2024-01-16','Fixture',100,10,110) RETURNING id v`,[fixture.a])
  assert.equal((await confronta()).esito,'Candidata storica non univoca')
  assert.equal(await associa(verificata.versione),'Candidata storica non univoca')
  await q('DELETE FROM public.fatture_emesse WHERE id=$1',[secondaCandidata])
  assert.equal((await confronta(xmlBluenext('BL-STORICO','2024-01-15','TD01'))).esito,'Differenze effettive')
  const altraVersione=xmlBluenext('BL-STORICO','2024-01-15','TD02','120.00','130.00')
  assert.equal((await confronta(storicoXml,[...impronte,improntaXml(altraVersione)])).esito,'XML discordanti')
  assert.equal(await associa(verificata.versione,client,storicoXml,[...impronte,improntaXml(altraVersione)]),'XML discordanti')
  assert.equal((await confronta(altraVersione)).esito,'Differenze effettive')
  assert.equal(await associa(verificata.versione,client,altraVersione),'Differenze effettive')
  await q('UPDATE public.fatture_emesse SET imponibile=NULL WHERE id=$1',[storico])
  assert.equal((await confronta()).esito,'Metadati insufficienti')
  await q('UPDATE public.fatture_emesse SET imponibile=100 WHERE id=$1',[storico])
  assert.equal(await associa('versione-obsoleta'),'Candidata modificata')
  assert.equal(await associa(verificata.versione,client,storicoXml+'\n'),'Candidata modificata')
  const fontiPrima=await fotografia()
  const associate=await Promise.all([associa(verificata.versione),associa(verificata.versione,second)])
  assert.deepEqual(associate.sort(),['Associata','Gia associata'])
  const metadati=await value('SELECT bluenext_associazione v FROM public.fatture_emesse WHERE id=$1',[storico])
  assert.equal(metadati.autore,titolare)
  assert.equal(metadati.origine,'bluenext_storico')
  assert.equal(await associa(verificata.versione),'Gia associata')
  assert.deepEqual(await value('SELECT bluenext_associazione v FROM public.fatture_emesse WHERE id=$1',[storico]),metadati)
  assert.equal(await value('SELECT bluenext_impronta v FROM public.fatture_emesse WHERE id=$1',[storico]),impronte[0])
  assert.equal((await importa(titolare,[storicoXml]))[0].stato,'Già presente')
  assert.equal((await confronta(altraVersione)).esito,'XML discordanti')
  assert.deepEqual(await fotografia(),fontiPrima)
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
  assert.ok(!(await value('SELECT artecna_distruzione.hard_delete_blockers($1) v',[fixture.a]))
    .some(blocco=>JSON.stringify(blocco).includes('"catalogo"')))
  console.log('Bluenext storico: confronto, autorizzazioni, concorrenza, idempotenza e fonti invariate')
  const associaConTipoSql='SELECT public.associa_fattura_bluenext($1,$2,$3,$4,$5) v'
  const campione = []
  for (let i=0;i<23;i++) {
    const numero='BL-CAMPIONE-'+(i+1), giorno=i<12?'2025-11-15':'2026-02-16'
    const xml=xmlBluenext(numero,giorno)
    const id=await value(`INSERT INTO public.fatture_emesse
      (cantiere_id,numero_fattura,data_fattura,cliente,imponibile,iva,totale,importo_incassato,stato)
      VALUES ($1,$2,$3,'Fixture',$4,10,$5,25,'parziale') RETURNING id v`,[fixture.a,numero,giorno,i===20?null:100,i===19?111:110])
    if (i===21) await q(`INSERT INTO public.fatture_emesse
      (cantiere_id,numero_fattura,data_fattura,cliente,imponibile,iva,totale) VALUES ($1,$2,$3,'Fixture',100,10,110)`,[fixture.a,numero,giorno])
    if ((i>=15 && i<18) || i===18) await as(titolare,'SELECT public.registra_evidenza_sdi($1,0,$2,$3,NULL,NULL,NULL,NULL,NULL,$4)',
      [id,i===18?'TD01':'TD02','da_verificare','[]'])
    const versioni=[improntaXml(xml)]
    if (i===22) versioni.push(improntaXml(xml+'\n'))
    const [confronto]=await as(titolare,confrontoSql,[id,xml,versioni])
    campione.push({id,xml,versioni,confronto:confronto.v})
  }
  const conteggi=Object.fromEntries(['Conferma assistita','Verificabile','Differenze effettive','Metadati insufficienti',
    'Candidata storica non univoca','XML discordanti'].map(esito=>[esito,campione.filter(f=>f.confronto.esito===esito).length]))
  assert.deepEqual(conteggi,{'Conferma assistita':15,Verificabile:3,'Differenze effettive':2,'Metadati insufficienti':1,
    'Candidata storica non univoca':1,'XML discordanti':1})
  const associaCampione=async (f,conferma=true,conn=client)=>
    (await as(titolare,associaConTipoSql,[f.id,f.xml,f.versioni,f.confronto.versione,conferma],conn))[0].v
  const idsCampione=campione.map(f=>f.id)
  const contabilitaCampione=()=>value(`SELECT jsonb_build_array(
    (SELECT jsonb_agg(to_jsonb(f)-ARRAY['bluenext_identita','bluenext_impronta','bluenext_tipo','bluenext_associazione'] ORDER BY id)
      FROM public.fatture_emesse f WHERE numero_fattura LIKE 'BL-CAMPIONE-%'),
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY fattura_id,revisione)
      FROM artecna_contabilita.fatture_sdi s WHERE fattura_id=ANY($1))) v`,[idsCampione])
  const contabilitaPrima=await contabilitaCampione()
  const legacy=campione[0]
  assert.equal(await associaCampione(legacy,false),'Conferma esplicita del tipo XML necessaria')
  assert.deepEqual((await Promise.all([associaCampione(legacy),associaCampione(legacy,true,second)])).sort(),['Associata','Gia associata'])
  for (const f of campione.slice(1,18)) assert.equal(await associaCampione(f), 'Associata')
  for (const f of campione.slice(18)) assert.equal(await associaCampione(f), f.confronto.esito)
  const provenienza=await value('SELECT bluenext_associazione v FROM public.fatture_emesse WHERE id=$1',[legacy.id])
  assert.equal(provenienza.tipo_storico,null)
  assert.equal(provenienza.tipo_xml,'TD02')
  assert.equal(provenienza.fonte_tipo,'xml_bluenext')
  assert.equal(provenienza.conferma_tipo_legacy,true)
  assert.equal(provenienza.autore,titolare)
  assert.ok(provenienza.associata_at)
  assert.equal(await value('SELECT count(*)::int v FROM public.fatture_emesse WHERE id=ANY($1) AND bluenext_associazione IS NOT NULL',[idsCampione]),18)
  assert.deepEqual(await contabilitaCampione(),contabilitaPrima)
  assert.equal((await importa(titolare,[legacy.xml]))[0].stato,'Già presente')
  console.log('Bluenext campione sintetico:',JSON.stringify(conteggi))
  const contemporanee=(await Promise.all([importa(titolare,[x]),importa(titolare,[x],second)])).flat()
  assert.deepEqual(contemporanee.map(f=>f.stato).sort(),['Già presente','Nuova'])
  const importata=contemporanee.find(f=>f.stato==='Nuova').id
  assert.equal((await importa(titolare,[x]))[0].stato,'Già presente')
  assert.equal((await importa(titolare,[xmlBluenext('BL-1','2024-01-15','TD02','120.00','130.00')]))[0].stato,'Ambigua')
  assert.equal(await value("SELECT count(*)::int v FROM public.fatture_emesse WHERE numero_fattura='BL-1'"),1)
  assert.equal(await value("SELECT importo_incassato::int v FROM public.fatture_emesse WHERE id=$1",[importata]),0)
  assert.equal(await value("SELECT count(*)::int v FROM artecna_contabilita.sdi_corrente WHERE fattura_id=$1",[importata]),0)
  const accontoTardivo=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES($1,40,$2) RETURNING id v",[fixture.a,today])
  await as(titolare,incasso,[accontoTardivo,0,'incassato','ordinario',today,'Fixture'])
  assert.ok((await proposta(accontoTardivo)).fatture.some(f=>f.id===importata))
  const [accontoPrima]=await importa(titolare,[xmlBluenext('BL-2',today)])
  assert.equal(accontoPrima.stato,'Nuova')
  assert.ok((await proposta(a)).fatture.some(f=>f.id===accontoPrima.id))
  const linkBluenext=(f,a,q)=>as(titolare,'SELECT public.collega_incasso_cliente($1,$2,$3,$4,true)',[randomUUID(),f,a,q])
  await linkBluenext(importata,accontoTardivo,40)
  await linkBluenext(accontoPrima.id,a,10)
  assert.equal((await proposta(accontoTardivo)).fatture.find(f=>f.id===importata).disponibile,70)
  assert.equal((await stato(accontoTardivo)).copertura,0)
  // Non alterare le quote usate dal caso SdI a valle.
  const [quotaProvvisoria]=await q('SELECT id FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=$1 AND acconto_id=$2',[accontoPrima.id,a])
  await as(titolare,'SELECT public.scollega_incasso_cliente($1,$2)',[randomUUID(),quotaProvvisoria.id])
  const resolve = user => as(user,'SELECT public.risolvi_destinazione_notifica($1) v',[idNotifica])
  assert.equal((await resolve(titolare))[0].v.record_id,a)
  await assert.rejects(as(esterno,'SELECT public.leggi_destinazione_acconto_fiscale($1)',[a]),{code:'42501'})
  await as(titolare,incasso,[a,2,'incassato','ordinario',today,'Fixture ripetuta'])
  await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
  await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
  assert.equal(await notices(a),1)
  assert.equal((await resolve(titolare))[0].v.record_id,a)
  const sql='SELECT public.registra_evidenza_sdi($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)'
  const time=new Date(Date.now()-60000).toISOString()
  const sdi=(id,rev,tipo,esito,orig=null,quote=[])=>as(titolare,sql,[id,rev,tipo,esito,time,esito==='inviata'?null:time,null,'Fixture ricevuta',orig,JSON.stringify(quote)])
  await sdi(fattura,0,'TD02','inviata')
  const la=randomUUID(),lb=randomUUID()
  const link=(id,f,a,quota)=>as(titolare,'SELECT public.collega_incasso_cliente($1,$2,$3,$4,true)',[id,f,a,quota])
  await link(la,fattura,a,100)
  await link(lb,fattura,b,50)
  assert.match((await stato(a)).stato,/In attesa/)
  const futuro=await value("SELECT artecna_contabilita.valuta_acconto_fiscale($1,now()+interval '20 days') v",[a])
  assert.equal(futuro.stato,'In attesa dell’esito SdI')
  const destinazione=(await as(titolare,'SELECT public.leggi_destinazione_acconto_fiscale($1) v',[a]))[0].v
  assert.equal(destinazione.fatture[0].id,fattura)
  await as(titolare,incasso,[a,3,'incassato','ordinario','2020-01-01','Fixture tardiva'])
  assert.equal((await stato(a)).stato,'Trasmissione oltre il termine da verificare')
  await as(titolare,incasso,[a,4,'incassato','ordinario',today,'Fixture rettifica'])
  await sdi(fattura,1,'TD02','consegnata')
  assert.equal((await stato(a)).stato,'Regolarizzato')
  await sdi(nota,0,'TD04','mancata_consegna',fattura)
  assert.equal((await stato(b)).stato,'Da verificare')
  const quote=[{attribuzione_id:la,quota:20},{attribuzione_id:lb,quota:10}]
  await sdi(nota,1,'TD04','mancata_consegna',fattura,quote)
  assert.equal((await stato(a)).copertura,80)
  assert.equal((await stato(b)).copertura,40)
  await assert.rejects(sdi(nota,2,'TD04','consegnata',fattura,[{attribuzione_id:la,quota:40}]),{code:'23514'})
  await assert.rejects(link(randomUUID(),nota,b,1),{code:'22023'})
  const browser=require('./browser/attesi-page-browser.cjs')
  // Requests on reload share the fixture session, so serialize role and claim changes.
  let browserQueue=Promise.resolve()
  const actor=(query,args)=>{
    const request=browserQueue.then(async ()=>(await as(titolare,query,args))[0].v)
    browserQueue=request.catch(()=>{})
    return request
  }
  await q("UPDATE public.fatture_emesse SET importo_incassato=10, stato='parziale' WHERE id=$1",[lordoDoc])
  const fatturaStorica=()=>value("SELECT jsonb_build_array(importo_incassato,stato) v FROM public.fatture_emesse WHERE id=$1",[lordoDoc])
  assert.deepEqual(await fatturaStorica(),[10,'parziale'])
  const quadroFattura=(await as(titolare,leggi,[lordoDoc,'fattura']))[0].v
  assert.deepEqual([quadroFattura.totale,quadroFattura.attribuito,quadroFattura.residuo],[10000,10000,0])
  const browserContext={owner:titolare,entry:'contratto-sdi-entry.mjs',commands:{
    leggi_acconto_fiscale:['SELECT public.leggi_acconto_fiscale($1) v','p_id'],
    leggi_fattura_sdi:['SELECT public.leggi_fattura_sdi($1) v','p_id'],
  }}
  await browser(actor,fixture.a,{...browserContext,draft:lordoDoc,modes:['incassi-lordi'],commands:{
    leggi_incassi_lordi_cliente:['SELECT public.leggi_incassi_lordi_cliente($1,$2) v','p_id','p_contesto'],
  }})
  assert.deepEqual(await fatturaStorica(),[10,'parziale'])
  const accontoChrome=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo) VALUES($1,90) RETURNING id v",[fixture.a])
  const fatturaChrome=await value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,totale,importo_incassato) VALUES($1,'Fixture',100,0) RETURNING id v",[fixture.a])
  const rpcLordi={
    leggi_rettifiche_incasso_lordo_cliente:['SELECT public.leggi_rettifiche_incasso_lordo_cliente($1) v','p_acconto'],
    rettifica_riferimento_incasso_lordo_cliente:['SELECT public.rettifica_riferimento_incasso_lordo_cliente($1,$2,$3,$4,$5,$6) v','p_richiesta','p_incasso','p_revisione','p_riferimento','p_fonte','p_motivo'],
    leggi_incassi_lordi_cliente:['SELECT public.leggi_incassi_lordi_cliente($1,$2) v','p_id','p_contesto'],
    conferma_incasso_lordo_cliente:['SELECT public.conferma_incasso_lordo_cliente($1,$2,$3,$4,$5,$6,$7) v','p_id','p_acconto','p_importo','p_data','p_metodo','p_riferimento','p_fonte'],
    attribuisci_incasso_lordo_cliente:['SELECT public.attribuisci_incasso_lordo_cliente($1,$2,$3,$4) v','p_id','p_incasso','p_fattura','p_importo'],
    revoca_quota_lorda_cliente:['SELECT public.revoca_quota_lorda_cliente($1,$2) v','p_id','p_quota'],
  }
  const elimina='SELECT public.elimina_incasso_lordo_cliente($1,$2,$3,$4,$5,$6) v'
  rpcLordi.elimina_incasso_lordo_cliente=[elimina,'p_richiesta','p_acconto','p_incasso','p_riferimento','p_conferma','p_motivo']
  const contoDuplicato=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo) VALUES($1,9090.91) RETURNING id v",[fixture.a])
  const duplicato=randomUUID(), bonifico=randomUUID(), dataDuplicato='2026-10-05', cro='82182298105'
  const registraDuplicato=rpcLordi.conferma_incasso_lordo_cliente[0]
  const datiDuplicato=[duplicato,contoDuplicato,10000,dataDuplicato,'bonifico','cro','Estratto sintetico']
  await as(titolare,registraDuplicato,datiDuplicato)
  await as(titolare,registraDuplicato,[bonifico,...datiDuplicato.slice(1,5),cro,'Estratto sintetico'])
  const statoDuplicato=async ()=>(await as(titolare,leggi,[contoDuplicato,'acconto']))[0].v.incassi
  const totaleDuplicato=async ()=>(await statoDuplicato()).reduce((s,i)=>s+i.importo,0)
  const situazioneCantiere=async ()=>(await as(titolare,riepilogo,[fixture.a]))[0].v
  const primaEliminazione=await situazioneCantiere()
  assert.equal(await totaleDuplicato(),20000)
  const richiestaElimina=[randomUUID(),contoDuplicato,duplicato,'cro','ELIMINA','Duplicato verificato']
  await assert.rejects(as(esterno,elimina,richiestaElimina),{code:'42501'})
  await assert.rejects(as(titolare,elimina,[...richiestaElimina.slice(0,4),'',richiestaElimina[5]]),{code:'22023'})
  await assert.rejects(as(titolare,elimina,[richiestaElimina[0],netto,...richiestaElimina.slice(2)]),{code:'42501'})
  await assert.rejects(as(titolare,elimina,[...richiestaElimina.slice(0,3),cro,...richiestaElimina.slice(4)]),{code:'40001'})
  await assert.rejects(as(titolare,elimina,[randomUUID(),contoDuplicato,bonifico,cro,'ELIMINA','Fixture']),{code:'23514'})
  await assert.rejects(as(titolare,elimina,[randomUUID(),netto,pagamento,'synthetic-cro-01','ELIMINA','Fixture']),{code:'23514',message:/quote o rettifiche/})
  await assert.rejects(as(titolare,'DELETE FROM artecna_contabilita.incassi_lordi_clienti WHERE id=$1',[duplicato]),{code:'42501'})
  assert.equal(await value("SELECT has_function_privilege('anon','public.elimina_incasso_lordo_cliente(uuid,uuid,uuid,text,text,text)','EXECUTE') v"),false)
  await q('CREATE TABLE public.fixture_dipendenza_incasso (id uuid REFERENCES artecna_contabilita.incassi_lordi_clienti(id) ON DELETE CASCADE)')
  try {
    await assert.rejects(as(titolare,elimina,richiestaElimina),{code:'23514',message:/Dipendenze/})
  } finally { await q('DROP TABLE public.fixture_dipendenza_incasso') }

  const scrittureProtette=()=>value(`SELECT jsonb_build_object(
    'acconti',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.acconti_cantiere t),
    'fatture',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.fatture_emesse t),
    'quote',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.quote_lorde_clienti t),
    'attribuzioni',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.attribuzioni_clienti t),
    'sdi',(SELECT jsonb_agg(to_jsonb(t) ORDER BY fattura_id,revisione) FROM artecna_contabilita.fatture_sdi t),
    'incassi',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti t WHERE id<>$1)
  ) v`,[duplicato])
  const scritturePrima=await scrittureProtette()
  const tentativi=await Promise.all([
    as(titolare,elimina,richiestaElimina),
    as(titolare,elimina,richiestaElimina,client2),
  ])
  assert.deepEqual(tentativi.map(r=>r[0].v.richiesta_duplicata).sort(),[false,true])
  assert.equal(await totaleDuplicato(),10000)
  assert.deepEqual((await statoDuplicato()).map(i=>i.id),[bonifico])
  assert.deepEqual(await scrittureProtette(),scritturePrima)
  const dopoEliminazione=await situazioneCantiere()
  assert.equal(dopoEliminazione.pagamenti,primaEliminazione.pagamenti-10000)
  assert.equal(dopoEliminazione.acconti_netto,primaEliminazione.acconti_netto)
  assert.equal(await value('SELECT importo::text v FROM public.acconti_cantiere WHERE id=$1',[contoDuplicato]),'9090.91')
  assert.deepEqual(await value('SELECT jsonb_build_array(operatore,motivo,movimento->>\'id\') v FROM artecna_contabilita.eliminazioni_incassi_lordi WHERE incasso_id=$1',[duplicato]),[titolare,'Duplicato verificato',duplicato])
  await assert.rejects(as(titolare,registraDuplicato,datiDuplicato),{code:'23505'})
  await assert.rejects(as(titolare,elimina,[...richiestaElimina.slice(0,5),'Altro motivo']),{code:'23505'})

  const primaClassificazione = await scrittureProtette()
  const identitaHardDelete = await value("SELECT pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) v")
  await q(load('20261116000100_classificazione_cantieri.sql'))
  assert.equal(await value('SELECT signature=artecna_distruzione.hard_delete_catalog() v FROM artecna_distruzione.hard_delete_catalog_expected'), true)
  assert.equal(await value("SELECT pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) v"), identitaHardDelete)
  const classifica = 'SELECT public.salva_classificazione_cantiere($1,$2,$3,$4,$5,$6,$7) v'
  const concluso = await value('SELECT lavori_conclusi v FROM public.cantieri WHERE id=$1',[fixture.a])
  const sceltaClassificazione = [fixture.a,null,null,concluso,'cantiere_lavori','in_corso',true]
  await assert.rejects(as(esterno,classifica,sceltaClassificazione),{code:'42501'})
  const tentativiClassificazione=await Promise.allSettled([
    as(titolare,classifica,sceltaClassificazione),
    as(titolare,classifica,sceltaClassificazione,client2),
  ])
  const salvataggi=tentativiClassificazione.filter(r=>r.status==='fulfilled')
  const conflitti=tentativiClassificazione.filter(r=>r.status==='rejected')
  assert.equal(salvataggi.length,1)
  assert.equal(salvataggi[0].value[0].v.fase_lavori,'in_corso')
  assert.deepEqual(conflitti.map(r=>r.reason.code),['40001'])
  await assert.rejects(as(titolare,classifica,sceltaClassificazione),{code:'40001'})
  assert.deepEqual(await scrittureProtette(),primaClassificazione)
  assert.deepEqual((await statoDuplicato()).map(i=>i.id),[bonifico])
  console.log('CLASSIFICAZIONE_CATALOGO_V3_INCASSI_GREEN')

  const duplicatoChrome=randomUUID()
  await as(titolare,registraDuplicato,[duplicatoChrome,...datiDuplicato.slice(1)])
  await browser(actor,fixture.a,{...browserContext,draft:contoDuplicato,modes:['incassi-elimina'],commands:rpcLordi})
  assert.equal(await totaleDuplicato(),10000)
  assert.deepEqual((await statoDuplicato()).map(i=>i.id),[bonifico])

  await browser(actor,fixture.a,{...browserContext,draft:netto,modes:['incassi-rettifica'],commands:rpcLordi})
  assert.deepEqual(await movimento(),primaCro)
  assert.deepEqual(await quoteLorde(),quotePrimaCro)
  assert.equal((await as(titolare,storicoCro,[netto]))[0].v.length,2)
  assert.equal((await as(titolare,leggi,[lordoDoc,'fattura']))[0].v.residuo,0)
  await browser(actor,fixture.a,{...browserContext,draft:accontoChrome,modes:['incassi-conferma'],commands:rpcLordi})
  await browser(actor,fixture.a,{...browserContext,draft:fatturaChrome,modes:['incassi-attribuzione'],commands:rpcLordi})
  assert.equal(await value('SELECT importo::text v FROM public.acconti_cantiere WHERE id=$1',[accontoChrome]),'90')
  assert.equal(await value("SELECT count(*)::int v FROM artecna_contabilita.incassi_lordi_clienti WHERE acconto_id=$1",[accontoChrome]),1)
  assert.equal(await value("SELECT count(*)::int v FROM artecna_contabilita.quote_lorde_clienti WHERE fattura_id=$1 AND revocato_at IS NULL",[fatturaChrome]),1)
  await q("UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1",[titolare])
  try {
    await assert.rejects(as(titolare,leggi,[fatturaChrome,'fattura']),{code:'42501'})
    await assert.rejects(as(titolare,rettifica,richiestaCro),{code:'42501'})
    await browser(actor,fixture.a,{...browserContext,draft:fatturaChrome,modes:['incassi-negato'],commands:rpcLordi})
    await assert.rejects(as(titolare,conferma,[randomUUID(),accontoChrome,1,'bonifico','revocato','Fixture']),{code:'42501'})
  } finally {
    await q("UPDATE public.utenti_impresa SET attivo=true WHERE user_id=$1",[titolare])
  }
  const notaChrome=await value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,totale) VALUES($1,'Fixture',-10) RETURNING id v",[fixture.a])
  const movimentiPrimaNota=await value('SELECT count(*)::int v FROM artecna_contabilita.incassi_lordi_clienti')
  await sdi(fatturaChrome,0,'TD01','consegnata')
  await sdi(notaChrome,0,'TD04','consegnata',fatturaChrome)
  assert.equal(await value('SELECT count(*)::int v FROM artecna_contabilita.incassi_lordi_clienti'),movimentiPrimaNota)
  const rettificata=(await as(titolare,leggi,[fatturaChrome,'fattura']))[0].v
  assert.equal(rettificata.attribuito,100)
  assert.equal(rettificata.residuo,null)
  await browser(actor,fattura,{...browserContext,draft:nota,modes:['nota']})
  await sdi(nota,2,'TD04','scartata',fattura,quote)
  await browser(actor,fattura,{...browserContext,draft:a,modes:['acconto']})
  await sdi(fattura,2,'TD02','scartata')
  assert.equal((await stato(a)).copertura,0)
  assert.equal((await stato(a)).stato,'Da correggere e ritrasmettere')
  await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
  idNotifica=await notificaAttiva()
  await q("UPDATE artecna_notifiche.notifica SET read_at=now() WHERE id<>$1",[idNotifica])
  await browser(actor,idNotifica,{...browserContext,draft:a,modes:['notifica'],commands:{
    contatori_notifiche:['SELECT public.contatori_notifiche() v'],
    lista_notifiche:['SELECT public.lista_notifiche($1,$2) v','p_filtro','p_offset'],
    risolvi_destinazione_notifica:['SELECT public.risolvi_destinazione_notifica($1) v','p_id'],
    leggi_destinazione_acconto_fiscale:['SELECT public.leggi_destinazione_acconto_fiscale($1) v','p_id'],
  }})
  const incassoPrimaBrowser=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES($1,25,$2) RETURNING id v",[fixture.a,today])
  await as(titolare,incasso,[incassoPrimaBrowser,0,'incassato','ordinario',today,'Fixture Chrome incasso prima'])
  await browser(actor,fixture.a,{...browserContext,draft:a,modes:['importa'],cantieri:[{id:fixture.a,nome:'Cantiere sintetico'}],commands:{
    importa_fatture_bluenext:['SELECT public.importa_fatture_bluenext(ARRAY(SELECT jsonb_array_elements_text($1)),$2) v','p_documenti','p_cantiere'],
  }})
  assert.equal(await value("SELECT count(*)::int v FROM public.fatture_emesse WHERE numero_fattura='BL-BROWSER' AND cantiere_id=$1",[fixture.a]),1)
  const storicoBrowser=await value(`INSERT INTO public.fatture_emesse
    (cantiere_id,numero_fattura,data_fattura,cliente,imponibile,iva,totale)
    VALUES ($1,'BL-STORICO-BROWSER','2024-06-01','Fixture',100,10,110) RETURNING id v`,[fixture.a])
  await browser(actor,fixture.a,{...browserContext,draft:storicoBrowser,modes:['associa-storico'],
    cantieri:[{id:fixture.a,nome:'Cantiere sintetico'}],commands:{
      confronta_fattura_bluenext:['SELECT public.confronta_fattura_bluenext($1,$2,ARRAY(SELECT jsonb_array_elements_text($3))) v','p_fattura','p_xml','p_impronte'],
      associa_fattura_bluenext:['SELECT public.associa_fattura_bluenext($1,$2,ARRAY(SELECT jsonb_array_elements_text($3)),$4,$5) v','p_fattura','p_xml','p_impronte','p_versione','p_conferma_tipo_xml'],
    }})
  assert.equal(await value('SELECT bluenext_associazione->>\'autore\' v FROM public.fatture_emesse WHERE id=$1',[storicoBrowser]),titolare)
  assert.equal(await value("SELECT bluenext_associazione->>'conferma_tipo_legacy' v FROM public.fatture_emesse WHERE id=$1",[storicoBrowser]),'true')
  assert.equal(await value("SELECT count(*)::int v FROM public.fatture_emesse WHERE numero_fattura='BL-STORICO-BROWSER'"),1)
  const accontoBrowser=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES($1,25,$2) RETURNING id v",[fixture.a,today])
  await as(titolare,incasso,[accontoBrowser,0,'incassato','ordinario',today,'Fixture Chrome'])
  const comandiGestione={
    ...browserContext.commands,
    leggi_destinazione_acconto_fiscale:['SELECT public.leggi_destinazione_acconto_fiscale($1) v','p_id'],
    proponi_riconciliazione_acconto:['SELECT public.proponi_riconciliazione_acconto($1) v','p_id'],
    leggi_attribuzioni_cliente:['SELECT public.leggi_attribuzioni_cliente($1) v','p_fattura_id'],
    collega_incasso_cliente:['SELECT public.collega_incasso_cliente($1,$2,$3,$4,$5) v','p_richiesta_id','p_fattura_id','p_acconto_id','p_importo','p_verificato'],
    rinvia_notifica:['SELECT public.rinvia_notifica($1,$2) v','p_id','p_giorno'],
  }
  for (const [acconto,mode] of [[incassoPrimaBrowser,'gestione-incasso-prima'],[accontoBrowser,'gestione']]) {
    await q("UPDATE artecna_notifiche.notifica n SET read_at=CASE WHEN e.record_id=$1 THEN NULL ELSE now() END FROM artecna_notifiche.evento_notificabile e WHERE n.evento_id=e.id",[acconto])
    await browser(actor,fixture.a,{...browserContext,draft:acconto,modes:[mode],commands:comandiGestione})
    assert.equal(await value("SELECT count(*)::int v FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=$1 AND importo=15 AND scollegato_at IS NULL",[acconto]),1)
  }
  assert.ok(await value("SELECT bool_or(n.rinviata_fino_a>now()) v FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.record_id=$1",[accontoBrowser]))
  await assert.rejects(as(esterno,'SELECT public.leggi_fattura_sdi($1)',[fattura]),{code:'42501'})
  await assert.rejects(as(titolare,'UPDATE artecna_contabilita.fatture_sdi SET esito=\'consegnata\''),{code:'42501'})
  await q('UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1',[titolare])
  await assert.rejects(stato(a),{code:'42501'})
  await assert.rejects(proposta(a),{code:'42501'})
  assert.equal((await resolve(titolare))[0].v,null)
}, { productionActor: true, noSync: true, beforeMigrations: certifiedInstallerFixture }))
