const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const ts = require('typescript')

test('Allegati: compilazione reale del contratto e separazione pubblico/interno',()=>{
  const filename=path.join(__dirname,'__allegati_contract_test__.ts').replaceAll('\\','/')
  const source=`
import type { RichiestaPrenotazioneAllegato, EsitoPrenotazioneAllegato, AllegatoFinalizzato,
  ElencoAllegati, AutorizzazioneAccessoAllegato, RichiestaCancellazioneAllegato,
  EsitoCancellazioneAllegato, UUIDAllegato, MimeAllegato, AllegatoInterno } from './contrattoAllegati'
import { validaRichiestaPrenotazioneAllegato } from './contrattoAllegati'
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false
type Check<T extends true> = T
type Request = Check<Equal<keyof RichiestaPrenotazioneAllegato,
  'rapportino_id'|'cantiere_id'|'data'|'chiave_client_allegato'|'sha256'|'mime_type'|'byte_size'>>
type Forbidden = 'bucket'|'file_path'|'token'|'jwt'|'credenziale'|'sessione'|'sha256'|'lease_id'|'tentativo'|'created_at_ms'
type PublicKeys = keyof EsitoPrenotazioneAllegato | keyof EsitoPrenotazioneAllegato['allegato'] |
  keyof AllegatoFinalizzato | keyof ElencoAllegati | keyof AutorizzazioneAccessoAllegato |
  keyof RichiestaCancellazioneAllegato | keyof EsitoCancellazioneAllegato
type NoSecrets = Check<Equal<Extract<PublicKeys,Forbidden>,never>>
type Access = Check<Equal<keyof AutorizzazioneAccessoAllegato,'versione_contratto'|'allegato_id'|'url'|'expires_at'>>
type Row = Check<Equal<keyof AllegatoFinalizzato,'allegato_id'|'chiave_client_allegato'|'mime_type'|'byte_size'|'stato'>>
const input=validaRichiestaPrenotazioneAllegato({})
// @ts-expect-error Un UUID grezzo non è ancora validato.
const id:UUIDAllegato='arbitrario'
// @ts-expect-error HEIC non è un MIME di upload ammesso.
const mime:MimeAllegato='image/heic'
// @ts-expect-error Il browser non sceglie il bucket.
const extra:RichiestaPrenotazioneAllegato={...input,bucket:'preventivi'}
declare const internal:AllegatoInterno
if(internal.stato==='finalizzato') {
  const foto:UUIDAllegato=internal.foto_cantiere_id
  const finalized:string=internal.finalized_at
}
type Tombstone = Extract<AllegatoInterno,{stato:'cancellato'}>
type FotoNull = Check<Equal<Tombstone['foto_cantiere_id'],null>>
type Storia = Check<Equal<Tombstone['finalized_at'],string|null>>
type Rimozione = Check<Equal<Tombstone['removed_at'],string>>
type NoLease = Check<Equal<Tombstone['lease'],null>>
declare const tomb:Tombstone
const valid:Tombstone={...tomb,finalized_at:'2026-10-04T00:00:00Z'}
// @ts-expect-error Un tombstone non conserva la proiezione.
const invalidFoto:Tombstone={...tomb,foto_cantiere_id:internal.id}
// @ts-expect-error removed_at obbligatorio.
const invalidRemoved:Tombstone={...tomb,removed_at:null}
// @ts-expect-error Nessuna lease sul tombstone.
const invalidLease:Tombstone={...tomb,lease:{lease_id:internal.id,iniziata_at_ms:0,scade_at_ms:1}}
declare const pending:Extract<AllegatoInterno,{stato:'cancellazione_pending'}>
// @ts-expect-error Pending con coppia mista vietato.
const invalidPending:typeof pending={...pending,finalized_at:null,foto_cantiere_id:internal.id}
declare const result:EsitoPrenotazioneAllegato
if(result.allegato.stato==='finalizzato') {
  const row:AllegatoFinalizzato=result.allegato
}
// @ts-expect-error Un finalizzato non contiene l'hash interno.
const hash=result.allegato.sha256
`
  const options={strict:true,noEmit:true,skipLibCheck:true,types:[],target:ts.ScriptTarget.ES2020,
    module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10}
  const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host)
  host.getSourceFile=(file,language,...rest)=>file===filename
    ?ts.createSourceFile(file,source,language,true):original(file,language,...rest)
  const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host))
  assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{
    getCanonicalFileName:x=>x,getCurrentDirectory:()=>__dirname,getNewLine:()=> '\n'}))
})
