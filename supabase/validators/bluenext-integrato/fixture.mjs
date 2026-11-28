import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const load = createRequire(import.meta.url)
const { fixture, ids } = load('../riconciliazione-unificata/fixture.cjs')
const migration = fs.readFileSync('supabase/migrations/20261128000100_bluenext_integrato.sql', 'utf8')
export const hash = s => crypto.createHash('sha256').update(s).digest('hex')
export const syntheticXml = (numero = '17', descrizione = '3° acconto lavori contrattuali', tipo = 'TD01') => `<FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>12345678901</IdCodice></IdFiscaleIVA></DatiAnagrafici></CedentePrestatore><CessionarioCommittente><DatiAnagrafici><CodiceFiscale>RSSMRA80A01H501U</CodiceFiscale><Anagrafica><Denominazione>CLIENTE FIXTURE</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${tipo}</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-27</Data><Numero>${numero}</Numero><ImportoTotaleDocumento>5000.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DettaglioLinee><Descrizione>${descrizione}</Descrizione></DettaglioLinee><DatiRiepilogo><AliquotaIVA>10.00</AliquotaIVA><ImponibileImporto>4545.45</ImponibileImporto><Imposta>454.55</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>`
function body(sql, name) { const a = sql.indexOf('CREATE FUNCTION ' + name + '('), b = sql.indexOf('END $$;', a); assert(a >= 0 && b > a); return sql.slice(a, b + 7) }
export const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const syntheticReceipt = (id='18746061890',file='fattura.xml') => `<NotificaMancataConsegna><IdentificativoSdI>${id}</IdentificativoSdI><NomeFile>${file}</NomeFile><DataOraRicezione>2026-11-27T10:00:00Z</DataOraRicezione><DataOraMessaADisposizione>2026-11-27T10:01:00Z</DataOraMessaADisposizione></NotificaMancataConsegna>`
export async function openFixture() {
 const db=await fixture(),admin=db.admin;try{
    // Reuse the installed dependency definitions, not alternative financial writers.
    await admin.query(`ALTER TABLE public.fatture_emesse ADD COLUMN bluenext_identita text,ADD COLUMN bluenext_impronta text,ADD COLUMN bluenext_associazione jsonb;ALTER TABLE public.fatture_emesse ALTER COLUMN id SET DEFAULT gen_random_uuid();CREATE SCHEMA IF NOT EXISTS auth;CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT artecna_guardie.utente_jwt_corrente() $$`)
    const old = fs.readFileSync('supabase/migrations/20261115000300_associazione_bluenext_storico.sql', 'utf8')
    const security=fs.readFileSync('supabase/migrations/20261029_clienti_sorgenti_sicurezza.sql','utf8')
    const from=security.indexOf('CREATE FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente('),to=security.indexOf('$$;',from)
    await admin.query('CREATE SCHEMA artecna_clienti_sicurezza;'+security.slice(from,to+3))
    await admin.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids.user])
    for (const name of ['artecna_contabilita.leggi_identita_xml_bluenext','public.confronta_fattura_bluenext','public.associa_fattura_bluenext']) await admin.query(body(old, name))
    await admin.query(body(fs.readFileSync('supabase/migrations/20261115000200_importazione_bluenext.sql','utf8'), 'public.importa_fatture_bluenext'))
    await admin.query('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
    const relations=['public.cantieri','public.preventivi_cantiere','public.sal_lavorazioni','public.acconti_cantiere','public.fatture_emesse','public.fatture_fornitori','public.fatture_fornitori_righe','public.utenti_impresa','public.utenti_cantiere','artecna_contabilita.attribuzioni_clienti','artecna_contabilita.incassi_lordi_clienti','artecna_contabilita.quote_lorde_clienti','artecna_contabilita.imputazioni_acconti','artecna_contabilita.acconti_fiscali','artecna_contabilita.fatture_sdi','artecna_contabilita.storni_acconti','artecna_notifiche.evento_notificabile','artecna_notifiche.notifica']
    async function fingerprints(){const result={};for(const name of relations)result[name]=(await admin.query(`SELECT count(*)::int AS rows,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C")::text,'[]'),'UTF8')),'hex') AS sha256 FROM ${name} t`)).rows[0];return result}
    const evidence=results=>(Array.isArray(results)?results:[results]).flatMap(r=>r.rows).find(r=>r.evidence)?.evidence
    const precheck=evidence(await admin.query(fs.readFileSync('supabase/diagnostics/bluenext-integrato/precheck.sql','utf8')))
    const beforeMigration=await fingerprints(),validatorBefore=(await admin.query("SELECT prosrc,proacl::text AS acl,proconfig,prosecdef,provolatile,proowner FROM pg_proc WHERE oid='artecna_contabilita.documento_riconciliazione(uuid,jsonb)'::regprocedure")).rows[0]
    await admin.query(migration)
    const afterMigration=await fingerprints(),validatorAfter=(await admin.query("SELECT prosrc,proacl::text AS acl,proconfig,prosecdef,provolatile,proowner FROM pg_proc WHERE oid='artecna_contabilita.documento_riconciliazione(uuid,jsonb)'::regprocedure")).rows[0]
    assert.deepEqual(afterMigration,beforeMigration)
    const src=validatorBefore.prosrc.replace("raw:=to_jsonb(f)->>'xml_testo';","raw:=coalesce(nullif(to_jsonb(f)->>'xml_testo',''),artecna_contabilita.xml_originale_bluenext(f.id));")
    assert.equal(validatorAfter.prosrc,src)
    assert.deepEqual({...validatorAfter,prosrc:null},{...validatorBefore,prosrc:null})
    const postcheck=evidence(await admin.query(fs.readFileSync('supabase/diagnostics/bluenext-integrato/postcheck.sql','utf8')))
    assert.equal(precheck.readonly,'on');assert.equal(postcheck.readonly,'on');assert.deepEqual(postcheck.fingerprints,precheck.fingerprints)
    const user = await db.connect('authenticated'), other = await db.connect('authenticated', ids.other), anon = await db.connect('anon')
    async function reset() {
      await admin.query('TRUNCATE artecna_contabilita.bluenext_evidenze,artecna_contabilita.bluenext_fonti,artecna_contabilita.bluenext_lotti')
      await db.reset()
      await admin.query(`DELETE FROM public.fatture_emesse WHERE id NOT IN('${ids.f}','${ids.f2}');DELETE FROM public.acconti_cantiere WHERE id NOT IN('${ids.a}','${ids.a2}','${ids.a3}','${uuid(80)}')`)
      await admin.query(`UPDATE public.fatture_emesse SET iva=454.55,fonte_iva_verificata=NULL,bluenext_identita=NULL,bluenext_impronta=NULL,bluenext_tipo=NULL,bluenext_associazione=NULL;UPDATE public.acconti_cantiere SET descrizione='4° Acconto lavori contrattuali' WHERE id='${ids.a}';UPDATE public.acconti_cantiere SET importo=8574.11 WHERE id='${ids.a2}';UPDATE public.acconti_cantiere SET importo=9090.91 WHERE id='${ids.a3}';INSERT INTO public.acconti_cantiere(id,descrizione,importo,data_incasso,cantiere_id) VALUES('${uuid(80)}','Lavori in economia',2000,'2026-11-10','${ids.c}') ON CONFLICT(id) DO NOTHING;INSERT INTO artecna_contabilita.incassi_lordi_clienti(id,acconto_id,cantiere_id,importo,ricevuto_il,metodo,riferimento,fonte,autore) VALUES('${uuid(81)}','${ids.a}','${ids.c}',5000,'2026-11-20','bonifico','SYNTHETIC-BANK-REFERENCE','Incasso sintetico documentato','${ids.user}')`)
      await admin.query(`UPDATE public.acconti_cantiere SET importo=2000,data_incasso='2026-11-10',descrizione='Lavori in economia' WHERE id='${uuid(80)}'`)
      await user.query("SELECT public.registra_acconto_fiscale($1,0,'incassato','ordinario','2026-11-10','Fonte sintetica economia')",[uuid(80)])
    }
return {...db,admin,user,other,anon,resetIntegrated:reset,integratedPreservation:afterMigration};
}catch(e){await db.close();throw e}
}
