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
  assert.notEqual(await signature(), hardDeleteBluenext)
  assert.equal(await signature(),await value('SELECT signature v FROM artecna_distruzione.hard_delete_catalog_expected'))
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
  const browserContext={owner:titolare,entry:'contratto-sdi-entry.mjs',commands:{
    leggi_acconto_fiscale:['SELECT public.leggi_acconto_fiscale($1) v','p_id'],
    leggi_fattura_sdi:['SELECT public.leggi_fattura_sdi($1) v','p_id'],
  }}
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
