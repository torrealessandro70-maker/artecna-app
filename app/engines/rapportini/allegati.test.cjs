const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const filename = path.join(__dirname, 'contrattoAllegati.ts')
const source = fs.readFileSync(filename, 'utf8')
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const modulePure = {exports:{}}
new Function('exports','module',js)(modulePure.exports,modulePure)
const a = modulePure.exports
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const raw = {rapportino_id:uuid(1),cantiere_id:uuid(2),data:'2026-09-30',
  chiave_client_allegato:uuid(3),sha256:'a'.repeat(64),mime_type:'image/jpeg',byte_size:123}
const input = a.validaRichiestaPrenotazioneAllegato(raw)
const start = 1_000_000
const base = {...input,id:uuid(4),bucket:'rapportini-v1',file_path:a.costruisciPathAllegato(input),
  stato:'prenotato',created_at_ms:start,expires_at_ms:a.scadenzaPrenotazioneAllegato(start),
  tentativo:{lease:a.creaLeaseAllegato(uuid(5),start),errore:null},foto_cantiere_id:null,finalized_at:null,removed_at:null,lease:a.creaLeaseAllegato(uuid(5),start)}
const final = {...base,stato:'finalizzato',foto_cantiere_id:uuid(6),finalized_at:'2026-10-04T00:00:00Z',lease:null,tentativo:null}

for (const [mime,ext] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]) {
  test(`Allegati: MIME ${mime} e path ${ext}`,()=>{
    const x = a.validaRichiestaPrenotazioneAllegato({...raw,mime_type:mime})
    assert.equal(a.costruisciPathAllegato(x),`rapportini/${uuid(2)}/${uuid(1)}/${uuid(3)}.${ext}`)
    assert.equal(a.costruisciPathAllegato(x),a.costruisciPathAllegato(x))
  })
}
test('Allegati: rifiuta MIME vietati, alias e Data URL',()=>{
  for(const mime of ['image/heic','image/heif','image/svg+xml','image/gif','image/jpg','IMAGE/JPEG','image/jpeg; charset=utf8','data:image/jpeg;base64,abc',null])
    assert.throws(()=>a.validaMimeAllegato(mime))
})
test('Allegati: peso intero 1..4.000.000 e limiti di dominio',()=>{
  assert.equal(a.validaByteSizeAllegato(1),1)
  assert.equal(a.validaByteSizeAllegato(4_000_000),4_000_000)
  for(const n of [0,-1,4_000_001,NaN,Infinity,1.5,'123',null]) assert.throws(()=>a.validaByteSizeAllegato(n))
  assert.equal(a.LIMITI_ALLEGATI.numero,20)
  assert.equal(a.LIMITI_ALLEGATI.pixel,24_000_000)
})
test('Allegati: SHA canonico lowercase, nessuna normalizzazione silenziosa',()=>{
  for(const h of ['a'.repeat(63),'a'.repeat(65),'A'.repeat(64),'g'.repeat(64),' '+raw.sha256,raw.sha256+'\n',null])
    assert.throws(()=>a.validaSHA256Allegato(h))
  assert.equal(a.validaSHA256Allegato(raw.sha256),raw.sha256)
})
test('Allegati: UUID canonici e path traversal impossibile anche con cast impropri',()=>{
  for(const id of ['../x','00000000/../../x','',uuid(2)+'/',uuid(2)+'\n', 'ABCDEF00-0000-0000-0000-000000000001',null]) {
    assert.throws(()=>a.validaUUIDAllegato(id))
    for(const field of ['rapportino_id','cantiere_id','chiave_client_allegato'])
      assert.throws(()=>a.costruisciPathAllegato({...input,[field]:id}))
  }
  assert.throws(()=>a.costruisciPathAllegato({...input,mime_type:'../../jpg'}))
})
test('Allegati: richiesta esatta, data reale, nessun controllo Storage dal browser',()=>{
  assert.deepEqual(input,raw)
  for(const field of Object.keys(raw)) {const x={...raw};delete x[field];assert.throws(()=>a.validaRichiestaPrenotazioneAllegato(x))}
  for(const field of ['bucket','file_path','estensione','stato','allegato_id','lease_id','token'])
    assert.throws(()=>a.validaRichiestaPrenotazioneAllegato({...raw,[field]:'iniettato'}))
  for(const data of ['2026-02-30','2026-13-01','2026-9-30','today',null])
    assert.throws(()=>a.validaRichiestaPrenotazioneAllegato({...raw,data}))
  for(const x of [null,[],42,'data:image/jpeg']) assert.throws(()=>a.validaRichiestaPrenotazioneAllegato(x))
})
test('Allegati: retry identico, finalizzazione idempotente, nuova identità',()=>{
  assert.equal(a.valutaIdempotenzaAllegato(base,input,start),'retry_compatibile')
  assert.equal(a.valutaIdempotenzaAllegato(final,input,base.expires_at_ms+1),'restituisci_finalizzato')
  for(const field of ['rapportino_id','chiave_client_allegato'])
    assert.equal(a.valutaIdempotenzaAllegato(base,{...input,[field]:uuid(9)},start),'nuova_identita')
})
test('Allegati: hash/MIME/peso e contesto divergenti producono conflitto',()=>{
  for(const [field,value] of [['sha256','b'.repeat(64)],['mime_type','image/png'],['byte_size',124],['cantiere_id',uuid(9)],['data','2026-10-01']])
    for(const row of [base,final,{...base,stato:'cancellato'}])
      assert.equal(a.valutaIdempotenzaAllegato(row,{...input,[field]:value},start),'conflitto')
})
test('Allegati: tombstone/scaduto/pending non vengono ricreati',()=>{
  for(const [stato,esito] of [['cancellato','tombstone'],['scaduto','prenotazione_scaduta'],['cancellazione_pending','cancellazione_in_corso']])
    assert.equal(a.valutaIdempotenzaAllegato({...base,stato},input,start),esito)
})
const stati = ['prenotato','finalizzato','cancellazione_pending','cancellato','scaduto']
const consentite = new Set(['prenotato:finalizzato','prenotato:scaduto','prenotato:cancellazione_pending',
  'finalizzato:cancellazione_pending','scaduto:cancellazione_pending','cancellazione_pending:cancellato'])
for(const da of stati) for(const aStato of stati) {
  test(`Allegati: transizione ${da} → ${aStato}`,()=>{
    const ok=consentite.has(`${da}:${aStato}`)
    assert.equal(a.transizioneAllegatoConsentita(da,aStato),ok)
    if(ok) assert.equal(a.transizionaAllegato(da,aStato),aStato)
    else assert.throws(()=>a.transizionaAllegato(da,aStato))
  })
}
test('Allegati: scadenza 24h deterministica e confine incluso',()=>{
  assert.equal(base.expires_at_ms,start+24*60*60*1000)
  assert.equal(a.prenotazioneAllegatoScaduta(base.expires_at_ms,base.expires_at_ms-1),false)
  assert.equal(a.prenotazioneAllegatoScaduta(base.expires_at_ms,base.expires_at_ms),true)
  assert.equal(a.valutaIdempotenzaAllegato(base,input,base.expires_at_ms),'prenotazione_scaduta')
  for(const n of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER]) assert.throws(()=>a.scadenzaPrenotazioneAllegato(n))
  assert.throws(()=>a.valutaIdempotenzaAllegato(base,input,NaN))
})
test('Allegati: lease 2 minuti, identità e intervallo semiaperto',()=>{
  const lease=a.creaLeaseAllegato(uuid(5),start)
  assert.equal(lease.scade_at_ms,start+120_000)
  assert.equal(a.leaseAllegatoValida(lease,uuid(5),start),true)
  assert.equal(a.leaseAllegatoValida(lease,uuid(5),lease.scade_at_ms-1),true)
  assert.equal(a.leaseAllegatoValida(lease,uuid(5),lease.scade_at_ms),false)
  assert.equal(a.leaseAllegatoValida(lease,uuid(5),start-1),false)
  assert.equal(a.leaseAllegatoValida(lease,uuid(9),start),false)
  assert.equal(a.leaseAllegatoValida({...lease,scade_at_ms:start+120001},uuid(5),start),false)
  assert.throws(()=>a.creaLeaseAllegato(uuid(5),NaN))
})
test('Allegati: proiezioni pubbliche esatte e nessun campo interno/errore grezzo',()=>{
  const keys=['allegato_id','byte_size','chiave_client_allegato','mime_type','stato'].sort()
  const dirty={...final,token:'SECRET',jwt:'SECRET',credenziale:'SECRET',sessione:'SECRET'}
  assert.deepEqual(Object.keys(a.allegatoFinalizzatoPubblico(dirty)).sort(),keys)
  assert.deepEqual(Object.keys(a.esitoPrenotazioneAllegatoPubblico(base).allegato).sort(),keys)
  assert.deepEqual(a.esitoPrenotazioneAllegatoPubblico(dirty).allegato,a.allegatoFinalizzatoPubblico(final))
  const elenco=a.elencoAllegatiPubblico(uuid(1),[base,dirty,{...base,stato:'scaduto'}])
  assert.equal(elenco.allegati.length,1)
  assert.deepEqual(Object.keys(elenco).sort(),['allegati','rapportino_id','versione_contratto'])
  const cancelled=a.esitoCancellazioneAllegatoPubblico({...dirty,stato:'cancellato'})
  assert.deepEqual(Object.keys(cancelled).sort(),['allegato_id','stato','versione_contratto'])
  assert.doesNotMatch(JSON.stringify([elenco,cancelled,a.esitoPrenotazioneAllegatoPubblico(base)]),/SECRET|sha256|bucket|file_path|lease_id|created_at|tentativo/)
  assert.throws(()=>a.allegatoFinalizzatoPubblico(base))
  assert.throws(()=>a.esitoPrenotazioneAllegatoPubblico({...base,stato:'cancellato'}))
  assert.throws(()=>a.esitoCancellazioneAllegatoPubblico(final))
  assert.throws(()=>a.elencoAllegatiPubblico(uuid(9),[base]))
  assert.equal(Object.isFrozen(elenco.allegati),true)
})
test('Allegati: nessuna dipendenza o side effect nella logica pura',()=>{
  assert.doesNotMatch(source,/Date\.now|setTimeout|setInterval|fetch\(|process\.env|console\.|^import\s/m)
})
