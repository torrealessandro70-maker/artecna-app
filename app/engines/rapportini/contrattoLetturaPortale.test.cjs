const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const ts = require('typescript')

// Compilazione reale, in memoria: nessun transpile-only o file generato.
test('Lettura portale: discriminazione, riuso STEP 3 e superficie del DTO', () => {
  const filename = path.join(__dirname, '__lettura_contract_test__.ts').replaceAll('\\', '/')
  const source = `
import type {
  LetturaRapportinoPortale, StatoRapportinoPortale,
  LetturaRapportinoPortaleV1, DettaglioRapportinoPortaleV1,
  RapportinoStatoLegacy
} from './contrattoLetturaPortale'
import type { EsitoSalvataggioRapportino } from './contrattoServizio'
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Check<T extends true> = T
type Reuse = Check<Equal<DettaglioRapportinoPortaleV1, EsitoSalvataggioRapportino>>
type EnvelopeKeys = Check<Equal<keyof LetturaRapportinoPortaleV1,
  'versione_lettura' | 'presente' | 'versione_prestazioni' | 'rapportino_id' | 'cantiere_id' | 'data' | 'dettaglio'>>
type DetailKeys = Check<Equal<keyof DettaglioRapportinoPortaleV1,
  'versione_contratto' | 'rapportino_id' | 'revisione' | 'cantiere_id' | 'data' | 'documento' | 'prestazioni'>>
type DocumentKeys = Check<Equal<keyof DettaglioRapportinoPortaleV1['documento'],
  'note' | 'materiali' | 'quantita_materiali'>>
type Row = DettaglioRapportinoPortaleV1['prestazioni'][number]
type RowKeys = Check<Equal<keyof Row,
  'prestazione_id' | 'chiave_client' | 'operaio_id' | 'operaio_nome' | 'ora_inizio' | 'ora_fine' |
  'pausa_minuti' | 'lavoro_in_economia' | 'variante_id' | 'ore' | 'revisione' | 'rimossa_at'>>
const row: Row = {prestazione_id:'p1', chiave_client:'k1', operaio_id:'operaio',
  operaio_nome:'Mario', ora_inizio:'08:00', ora_fine:'13:00', pausa_minuti:0,
  lavoro_in_economia:true, variante_id:null, ore:5, revisione:1, rimossa_at:null}
const detail: DettaglioRapportinoPortaleV1 = {versione_contratto:1, rapportino_id:'r',
  revisione:3, cantiere_id:'c', data:'2026-09-30',
  documento:{note:'', materiali:'', quantita_materiali:''},
  prestazioni:[row, {...row, prestazione_id:'p2', chiave_client:'k2',
    rimossa_at:'2026-10-04T10:00:00Z'}]}
const v1: LetturaRapportinoPortale = {versione_lettura:1, presente:true,
  versione_prestazioni:1, rapportino_id:'r', cantiere_id:'c', data:'2026-09-30', dettaglio:detail}
const v0: LetturaRapportinoPortale = {versione_lettura:1, presente:true,
  versione_prestazioni:0, rapportino_id:'r', cantiere_id:'c', data:'2026-09-30', dettaglio:null}
const absent: LetturaRapportinoPortale = {versione_lettura:1, presente:false,
  versione_prestazioni:null, rapportino_id:null, cantiere_id:'c', data:'2026-09-30', dettaglio:null}
function read(value: LetturaRapportinoPortale): string {
  switch(value.versione_prestazioni) {
    case null: {const id:null = value.rapportino_id; const present:false = value.presente; return ''}
    case 0: {const detail:null = value.dettaglio; const id:string = value.rapportino_id; return id}
    case 1: return value.dettaglio.prestazioni[0].prestazione_id
    default: {const exhaustive:never = value; return exhaustive}
  }
}
const legacy: RapportinoStatoLegacy = {id:'r', data:'2026-09-30', created_at:null,
  note:'', operai:'Mario', ore:'5', materiali:'', quantita_materiali:''}
const http0: StatoRapportinoPortale = {data:legacy.data, presente:true,
  versione_prestazioni:0, rapportino:legacy, timbrature:[{operaio_nome:'Mario'}]}
const http1: StatoRapportinoPortale = {data:detail.data, presente:true,
  versione_prestazioni:1, rapportino:{id:'r',data:detail.data}, timbrature:[], strutturato:detail}
const httpAbsent: StatoRapportinoPortale = {data:detail.data, presente:false,
  versione_prestazioni:null, rapportino:null, timbrature:[]}
function readHttp(value: StatoRapportinoPortale): string {
  switch(value.versione_prestazioni) {
    case null: {const r:null = value.rapportino; return ''}
    case 0: return value.rapportino.operai
    case 1: return value.strutturato.rapportino_id
    default: {const exhaustive:never = value; return exhaustive}
  }
}
// @ts-expect-error V0 non può contenere un dettaglio strutturato.
const mixed: LetturaRapportinoPortale = {...v0, dettaglio:detail}
// @ts-expect-error V1 presente non può avere UUID null.
const invalidId: LetturaRapportinoPortale = {...v1, rapportino_id:null}
// @ts-expect-error V1 richiede dettaglio.
const missing: LetturaRapportinoPortale = {...v1, dettaglio:null}
// @ts-expect-error Ordinario non può avere Variante.
const ordinary: Row = {...row, lavoro_in_economia:false, variante_id:'v'}
// @ts-expect-error Nessun costo nel contratto.
const cost: Row = {...row, costo_orario_interno_storico:20}
// @ts-expect-error Nessuno stato acquisizione nel contratto.
const economyState: Row = {...row, stato_economia:'economia_gia_inserita'}
// @ts-expect-error Nessun timestamp di creazione nel dettaglio V1.
const timestamp: DettaglioRapportinoPortaleV1 = {...detail, created_at:'today'}
`
  const options = {strict:true, noEmit:true, skipLibCheck:true, types:[],
    target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS,
    moduleResolution:ts.ModuleResolutionKind.Node10}
  const host = ts.createCompilerHost(options)
  const original = host.getSourceFile.bind(host)
  host.getSourceFile = (file, language, ...rest) => file === filename
    ? ts.createSourceFile(file, source, language, true) : original(file, language, ...rest)
  const program = ts.createProgram([filename], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName:x=>x, getCurrentDirectory:()=>__dirname, getNewLine:()=> '\n'
  }))
})
