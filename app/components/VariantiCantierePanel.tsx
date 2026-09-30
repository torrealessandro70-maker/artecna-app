'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { elencaPreventiviSorgenteVariante, caricaLavorazioniPreventivoSorgente, type PreventivoSorgenteCandidato } from '../engines/varianti/repositoryPreventiviSorgente'
import { adattaPreventivoAVariante } from '../engines/varianti/adattaPreventivoAVariante'
import type { PropostaVarianteDaPreventivo, PropostaVarianteDaFile, NaturaVariante, AcquisizioneVariante, AnomaliaPropostaVarianteDaFile, SorgenteVariante } from '../engines/varianti/types'
import type { AnomaliaMappingLavorazionePreventivo } from '../engines/varianti/mappaLavorazioniPreventivo'
import { estraiVociVarianteDaFile } from '../engines/varianti/estraiVociVarianteDaFile'
import { adattaFileAVariante } from '../engines/varianti/adattaFileAVariante'
import { confermaPreventivoIntegrativo } from '../engines/varianti/confermaPreventivoIntegrativo'

const etichetteAnomalieFile: Record<AnomaliaPropostaVarianteDaFile['codice'], string> = {
  cantiere_id_non_valido: 'Cantiere non valido',
  nome_file_mancante: 'Nome file mancante',
  formato_non_supportato: 'Formato non supportato',
  descrizione_mancante: 'Descrizione mancante',
  quantita_non_valida: 'Quantità non valida',
  unita_misura_mancante: 'UM mancante',
  prezzo_non_valido: 'Prezzo non valido',
  totale_non_valido: 'Totale non valido',
  totale_incoerente: 'Totale incoerente',
}

type RigaRevisioneVariante = {
  indiceSorgente: number
  inclusa: boolean
  descrizione: string
  unitaMisura: string
  quantita: string
  prezzoUnitario: string
  sorgente: SorgenteVariante
  avevaAnomalieSorgente: boolean
}

function creaRevisioneVariante(
  proposta: PropostaVarianteDaPreventivo | PropostaVarianteDaFile,
  anomalieMapper: readonly AnomaliaMappingLavorazionePreventivo[] = [],
): RigaRevisioneVariante[] {
  const testoNumero = (valore: number | undefined) =>
    typeof valore === 'number' && Number.isFinite(valore) ? String(valore) : ''
  return proposta.lavorazioni.map((voce, indiceSorgente) => ({
    indiceSorgente,
    inclusa: true,
    descrizione: voce.descrizione ?? '',
    unitaMisura: voce.unitaMisura ?? '',
    quantita: testoNumero(voce.quantita),
    prezzoUnitario: testoNumero(voce.prezzoSorgente),
    sorgente: { ...voce.sorgente },
    avevaAnomalieSorgente: proposta.anomalie.some(a =>
      a.indiceVoce === undefined || a.indiceVoce === indiceSorgente) ||
      anomalieMapper.some(a => a.indiceRiga === indiceSorgente),
  }))
}

function numeroRevisioneVariante(valore: string): number | undefined {
  const testo = valore.trim()
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(testo)) return undefined
  const numero = Number(testo.replace(',', '.'))
  return Number.isFinite(numero) ? numero : undefined
}

function valutaRigaRevisione(riga: RigaRevisioneVariante) {
  const quantita = numeroRevisioneVariante(riga.quantita)
  const prezzo = numeroRevisioneVariante(riga.prezzoUnitario)
  const prodotto = quantita !== undefined && quantita > 0 && prezzo !== undefined && prezzo >= 0
    ? quantita * prezzo : undefined
  const totale = prodotto !== undefined && Number.isFinite(prodotto) ? prodotto : undefined
  return { totale, valida: !!riga.descrizione.trim() && !!riga.unitaMisura.trim() && totale !== undefined }
}

function RevisioneVarianteLocale({ righe, onChange, onAnnulla, onRipristina }: {
  righe: readonly RigaRevisioneVariante[]
  onChange: (righe: RigaRevisioneVariante[]) => void
  onAnnulla: () => void
  onRipristina: () => void
}) {
  const valutate = righe.map(riga => ({ riga, ...valutaRigaRevisione(riga) }))
  const incluse = valutate.filter(v => v.riga.inclusa)
  const totale = incluse.reduce((somma, v) => somma + (v.totale ?? 0), 0)
  const daVerificare = incluse.some(v => !v.valida) || !Number.isFinite(totale)
  const importo = (valore: number) => valore.toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  const cella = { padding: '8px 10px', border: '1px solid #dbe3ee', verticalAlign: 'top' as const }
  const input = { width: '100%', boxSizing: 'border-box' as const, padding: 6 }
  const cambia = (indice: number, campi: Partial<Pick<RigaRevisioneVariante,
    'inclusa' | 'descrizione' | 'unitaMisura' | 'quantita' | 'prezzoUnitario'>>) =>
    onChange(righe.map((riga, i) => i === indice ? { ...riga, ...campi } : riga))

  return <section aria-label="Revisione locale variante" style={{ marginTop: 16 }}>
    <h4>Revisione locale del Preventivo integrativo</h4>
    <p>Le modifiche restano locali. La sorgente salvata non viene modificata e la revisione non viene salvata.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" onClick={onAnnulla}>Annulla revisione</button>
      <button type="button" onClick={onRipristina}>Ripristina da sorgente</button>
    </div>
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 14 }}>
        <caption style={{ textAlign: 'left', padding: 8 }}>Lavorazioni revisionabili — solo in questa sessione</caption>
        <thead><tr>{['Includi', 'Descrizione', 'UM', 'Quantità', 'Prezzo unitario', 'Totale', 'Stato'].map(t =>
          <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
        <tbody>{valutate.map(({ riga, totale: totaleRiga, valida }, indice) => <tr
          key={riga.indiceSorgente} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
          <td style={cella}><input type="checkbox" aria-label={'Includi voce ' + (indice + 1)}
            checked={riga.inclusa} onChange={e => cambia(indice, { inclusa: e.target.checked })} /></td>
          <td style={{ ...cella, minWidth: 260 }}><input type="text" aria-label={'Descrizione voce ' + (indice + 1)}
            style={input} value={riga.descrizione} onChange={e => cambia(indice, { descrizione: e.target.value })} /></td>
          <td style={cella}><input type="text" aria-label={'UM voce ' + (indice + 1)}
            style={input} value={riga.unitaMisura} onChange={e => cambia(indice, { unitaMisura: e.target.value })} /></td>
          <td style={cella}><input type="text" inputMode="decimal" aria-label={'Quantità voce ' + (indice + 1)}
            style={input} value={riga.quantita} onChange={e => cambia(indice, { quantita: e.target.value })} /></td>
          <td style={cella}><input type="text" inputMode="decimal" aria-label={'Prezzo unitario voce ' + (indice + 1)}
            style={input} value={riga.prezzoUnitario} onChange={e => cambia(indice, { prezzoUnitario: e.target.value })} /></td>
          <td style={{ ...cella, whiteSpace: 'nowrap' }}>{totaleRiga === undefined ? 'Non disponibile' : '€ ' + importo(totaleRiga)}</td>
          <td style={cella}>
            <div>{riga.inclusa ? (valida ? 'OK' : 'Da verificare') : (valida ? 'Esclusa' : 'Esclusa — Da verificare')}</div>
            {riga.avevaAnomalieSorgente && <small>Anomalie presenti nella sorgente</small>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    <p>Voci incluse: {incluse.length}</p>
    <p>Totale proposta revisionata: {Number.isFinite(totale) ? '€ ' + importo(totale) : 'Non disponibile'}
      {incluse.length > 0 && daVerificare && ' (parziale, non definitivo)'}</p>
    <p role="status">{incluse.length === 0 ? 'Nessuna voce inclusa'
      : daVerificare ? 'Ci sono voci incluse da verificare' : 'Revisione pronta'}</p>
  </section>
}

type RigaRevisioneCumulativa = RigaRevisioneVariante & {
  sorgenteId: string
  indiceVoce: number
  titoloSorgente: string
}

type RevisioneCumulativa = {
  originali: readonly RigaRevisioneCumulativa[]
  righe: RigaRevisioneCumulativa[]
}

function RevisioneCumulativaLocale({ valore, onChange, onAnnulla, pronta, indiciNonValidi, bloccata, confermaInCorso, confermata, onConferma }: {
  valore: RevisioneCumulativa
  onChange: (valore: RevisioneCumulativa) => void
  onAnnulla: () => void
  pronta: boolean
  indiciNonValidi: readonly number[]
  bloccata: boolean
  confermaInCorso: boolean
  confermata: boolean
  onConferma: () => void
}) {
  const valutate = valore.righe.map((riga, indice) => ({
    riga, totale: valutaRigaRevisione(riga).totale, valida: !indiciNonValidi.includes(indice),
  }))
  const incluse = valutate.filter(v => v.riga.inclusa)
  const totale = incluse.reduce((somma, v) => somma + (v.totale ?? 0), 0)
  const cella = { padding: '8px 10px', border: '1px solid #dbe3ee', verticalAlign: 'top' as const }
  const input = { width: '100%', boxSizing: 'border-box' as const, padding: 6 }
  const numero = (v: number) => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
  const cambia = (indice: number, campi: Partial<Pick<RigaRevisioneCumulativa,
    'descrizione' | 'unitaMisura' | 'quantita' | 'prezzoUnitario' | 'inclusa'>>) =>
    onChange({ ...valore, righe: valore.righe.map((r, i) => i === indice ? { ...r, ...campi } : r) })
  const ripristina = (riga: RigaRevisioneCumulativa) => {
    const originale = valore.originali.find(r => r.sorgenteId === riga.sorgenteId && r.indiceVoce === riga.indiceVoce)
    if (!originale) return
    onChange({ ...valore, righe: valore.righe.map(r =>
      r.sorgenteId === riga.sorgenteId && r.indiceVoce === riga.indiceVoce
        ? structuredClone(originale) : r) })
  }
  return <section aria-label="Revisione cumulativa multi-sorgente" style={{ marginTop: 16 }}>
    <h4>Revisione cumulativa del Preventivo integrativo</h4>
    <p>La conferma salva le lavorazioni nella bozza senza proporre o approvare la Variante. Gli snapshot restano invariati.</p>
    <fieldset disabled={bloccata || confermata} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" onClick={() => onChange({ ...valore, righe: valore.originali.map(r => structuredClone(r)) })}>Ripristina tutte</button>
      <button type="button" onClick={onAnnulla}>Annulla revisione cumulativa</button>
    </div>
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1050, fontSize: 14 }}>
        <thead><tr>{['Includi', 'Sorgente', 'Descrizione', 'UM', 'Quantità', 'Prezzo unitario', 'Totale riga', 'Verifica', 'Azioni'].map(t =>
          <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
        <tbody>{valutate.map(({ riga, totale: totaleRiga, valida }, indice) => <tr
          key={riga.sorgenteId + ':' + riga.indiceVoce} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
          <td style={cella}><input type="checkbox" aria-label={'Includi riga cumulativa ' + (indice + 1)} checked={riga.inclusa}
            onChange={e => cambia(indice, { inclusa: e.target.checked })} /></td>
          <td style={{ ...cella, overflowWrap: 'anywhere' }}>{riga.titoloSorgente}<br /><small>Voce {riga.indiceVoce + 1}</small></td>
          <td style={cella}><input style={input} aria-label={'Descrizione cumulativa ' + (indice + 1)} value={riga.descrizione}
            onChange={e => cambia(indice, { descrizione: e.target.value })} /></td>
          <td style={cella}><input style={input} aria-label={'UM cumulativa ' + (indice + 1)} value={riga.unitaMisura}
            onChange={e => cambia(indice, { unitaMisura: e.target.value })} /></td>
          <td style={cella}><input style={input} inputMode="decimal" aria-label={'Quantità cumulativa ' + (indice + 1)} value={riga.quantita}
            onChange={e => cambia(indice, { quantita: e.target.value })} /></td>
          <td style={cella}><input style={input} inputMode="decimal" aria-label={'Prezzo cumulativo ' + (indice + 1)} value={riga.prezzoUnitario}
            onChange={e => cambia(indice, { prezzoUnitario: e.target.value })} /></td>
          <td style={cella}>{totaleRiga === undefined ? 'Non disponibile' : numero(totaleRiga) + ' €'}</td>
          <td style={cella}>{riga.inclusa ? valida ? 'OK' : 'Da verificare' : 'Esclusa'}
            {riga.avevaAnomalieSorgente && <div><small>Anomalie nella sorgente</small></div>}</td>
          <td style={cella}><button type="button" onClick={() => ripristina(riga)}>Ripristina singola riga</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    </fieldset>
    <p>Voci incluse: {incluse.length} / {valore.righe.length}</p>
    <p>Totale cumulativo: {Number.isFinite(totale) ? numero(totale) + ' €' : 'Non disponibile'}
      {!pronta && ' (parziale, non definitivo)'}</p>
    <p role="status">{confermata ? 'Lavorazioni salvate nella bozza' : pronta ? 'Revisione pronta' : 'Revisione da verificare'}</p>
    <button type="button" disabled={!pronta || bloccata || confermata} onClick={onConferma}>
      {confermaInCorso ? 'Conferma in corso...' : 'Conferma lavorazioni'}
    </button>
  </section>
}

type SnapshotSorgenteVariante =
  | {
      chiave: string
      tipo: 'preventivo_artecna'
      preventivoId: string
      titolo: string
      proposta: PropostaVarianteDaPreventivo
      anomalieMapper: AnomaliaMappingLavorazionePreventivo[]
    }
  | {
      chiave: string
      tipo: 'file'
      titolo: string
      proposta: PropostaVarianteDaFile
      warnings: string[]
    }

const titoloBozzaSorgenti = 'Preventivo integrativo - bozza'

type SorgenteVarianteAggiunta = {
  id: string
  varianteId: string
  tipo: 'preventivo_artecna' | 'file'
  preventivoId: string | null
  titolo: string
  nomeFile: string | null
  formato: 'pdf' | 'excel' | 'immagine' | null
  snapshotVersion: number
  snapshot?: SnapshotSorgenteVariante
}

const recordSorgente = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const idSorgenteValido = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const formatoSorgenteValido = (v: unknown): v is 'pdf' | 'excel' | 'immagine' =>
  v === 'pdf' || v === 'excel' || v === 'immagine'
const singolaRigaSorgente = (v: unknown): unknown =>
  Array.isArray(v) ? v.length === 1 ? v[0] : null : v

function leggiMetadataSorgente(v: unknown, varianteId: string): SorgenteVarianteAggiunta {
  if (!recordSorgente(v) || !idSorgenteValido(v.id) || v.variante_id !== varianteId ||
      typeof v.titolo !== 'string' || !v.titolo.trim() ||
      typeof v.snapshot_version !== 'number' || !Number.isInteger(v.snapshot_version) ||
      (v.tipo !== 'preventivo_artecna' && v.tipo !== 'file')) throw new Error('Metadata sorgente non validi.')
  if (v.tipo === 'preventivo_artecna') {
    if (!idSorgenteValido(v.preventivo_sorgente_id) || v.nome_file !== null || v.formato !== null)
      throw new Error('Metadata sorgente ARTECNA non validi.')
    return { id: v.id, varianteId, tipo: v.tipo, preventivoId: v.preventivo_sorgente_id,
      titolo: v.titolo, nomeFile: null, formato: null, snapshotVersion: v.snapshot_version }
  }
  if (v.preventivo_sorgente_id !== null || typeof v.nome_file !== 'string' ||
      !v.nome_file.trim() || !formatoSorgenteValido(v.formato)) throw new Error('Metadata file non validi.')
  return { id: v.id, varianteId, tipo: v.tipo, preventivoId: null,
    titolo: v.titolo, nomeFile: v.nome_file, formato: v.formato, snapshotVersion: v.snapshot_version }
}

// Valida la struttura consumata dall'anteprima senza correggere valori o ricalcolare importi.
function snapshotSorgenteValido(v: unknown, meta: SorgenteVarianteAggiunta,
  cantiereId: string): v is SnapshotSorgenteVariante {
  if (!recordSorgente(v) || v.tipo !== meta.tipo || typeof v.chiave !== 'string' ||
      v.titolo !== meta.titolo || !recordSorgente(v.proposta)) return false
  const p = v.proposta
  if (p.natura !== 'preventivo_integrativo' || p.cantiereId !== cantiereId ||
      !Array.isArray(p.lavorazioni) || !Array.isArray(p.anomalie)) return false
  const codici = meta.tipo === 'file' ? Object.keys(etichetteAnomalieFile) : [
    'cantiere_id_non_valido', 'preventivo_sorgente_id_non_valido', 'lavorazione_sorgente_id_non_valido',
    'descrizione_mancante', 'quantita_non_valida', 'unita_misura_mancante',
    'prezzo_non_valido', 'totale_non_valido', 'totale_incoerente',
  ]
  if (!p.anomalie.every(a => recordSorgente(a) && typeof a.codice === 'string' &&
      codici.includes(a.codice) && (a.indiceVoce === undefined ||
        (Number.isInteger(a.indiceVoce) && Number(a.indiceVoce) >= 0)))) return false
  if (!p.lavorazioni.every(voce => {
    if (!recordSorgente(voce) || !recordSorgente(voce.sorgente)) return false
    if (!['descrizione', 'unitaMisura', 'codice', 'categoria', 'note'].every(k =>
      voce[k] === undefined || typeof voce[k] === 'string')) return false
    if (!['quantita', 'prezzoSorgente', 'totale'].every(k =>
      voce[k] === undefined || (typeof voce[k] === 'number' && Number.isFinite(voce[k])))) return false
    const origine = voce.sorgente
    if (origine.cantiereId !== cantiereId) return false
    return meta.tipo === 'preventivo_artecna'
      ? origine.tipo === 'preventivo_strutturato' && origine.preventivoSorgenteId === meta.preventivoId &&
        (origine.lavorazioneSorgenteId === undefined || typeof origine.lavorazioneSorgenteId === 'string')
      : origine.tipo === 'file' && origine.nomeFile === meta.nomeFile && origine.formato === meta.formato &&
        Number.isInteger(origine.indiceVoce) && Number(origine.indiceVoce) >= 0
  })) return false
  if (meta.tipo === 'preventivo_artecna') return p.acquisizione === 'dati_artecna' &&
    v.preventivoId === meta.preventivoId && p.preventivoSorgenteId === meta.preventivoId &&
    Array.isArray(v.anomalieMapper) && v.anomalieMapper.every(a => recordSorgente(a) &&
      typeof a.codice === 'string' && ['id_riga_non_valido', 'descrizione_mancante', 'quantita_non_valida',
        'unita_misura_mancante', 'prezzo_non_valido', 'totale_non_valido'].includes(a.codice) &&
      Number.isInteger(a.indiceRiga) && Number(a.indiceRiga) >= 0)
  return p.acquisizione === 'file' && recordSorgente(p.file) && p.file.nome === meta.nomeFile &&
    p.file.formato === meta.formato && Array.isArray(v.warnings) && v.warnings.every(w => typeof w === 'string')
}

function messaggioRpcSorgenti(errore: { code?: string }): string {
  if (errore.code === '23505') return 'Sorgente già presente nella Variante.'
  if (errore.code === '42501') return 'Sessione non valida o cantiere non autorizzato.'
  if (errore.code === '22023') return 'Operazione non consentita: verifica i dati e che la Variante sia ancora in bozza.'
  if (errore.code === 'P0002') return 'Sorgente o Variante non più disponibile.'
  return 'Operazione non confermata. Ricarica le sorgenti prima di riprovare.'
}

type VarianteSorgenti = Pick<Variante, 'id' | 'titolo' | 'stato' | 'numero' | 'data_variante' | 'created_at'>

function AnteprimaPreventivoVariante({ cantiereId, elencoVarianti, variantiCorrenti }: {
  cantiereId: string
  elencoVarianti: Stato
  variantiCorrenti: readonly VarianteSorgenti[]
}) {
  const [aperto, setAperto] = useState(false)
  const [natura, setNatura] = useState<NaturaVariante>('preventivo_integrativo')
  const [acquisizione, setAcquisizione] = useState<AcquisizioneVariante>('dati_artecna')
  const percorsoPreventivo = natura === 'preventivo_integrativo' && acquisizione === 'dati_artecna'
  const percorsoFile = natura === 'preventivo_integrativo' && acquisizione === 'file'
  const [fileSelezionato, setFileSelezionato] = useState<File | null>(null)
  const [analisiFile, setAnalisiFile] = useState(false)
  const [erroreFile, setErroreFile] = useState('')
  const [warningsFileLettura, setWarningsFile] = useState<string[]>([])
  const [propostaFileCaricata, setPropostaFile] = useState<PropostaVarianteDaFile | null>(null)
  const [preventivi, setPreventivi] = useState<PreventivoSorgenteCandidato[]>([])
  const [preventivoId, setPreventivoId] = useState('')
  const [caricamentoElenco, setCaricamentoElenco] = useState(false)
  const [caricamentoAnteprima, setCaricamentoAnteprima] = useState(false)
  const [messaggio, setMessaggio] = useState('')
  const [anteprimaCaricata, setAnteprima] = useState<{
    proposta: PropostaVarianteDaPreventivo
    anomalieMapper: AnomaliaMappingLavorazionePreventivo[]
  } | null>(null)
  const [revisione, setRevisione] = useState<RigaRevisioneVariante[] | null>(null)
  const [revisioneCumulativa, setRevisioneCumulativa] = useState<RevisioneCumulativa | null>(null)
  const [caricamentoCumulativa, setCaricamentoCumulativa] = useState(false)
  const [erroreCumulativa, setErroreCumulativa] = useState('')
  const [confermaInCorso, setConfermaInCorso] = useState(false)
  const [erroreConferma, setErroreConferma] = useState('')
  const [esitiConferma, setEsitiConferma] = useState<Record<string, { numero: number; totale: number }>>({})
  const invioConferma = useRef(false)
  const richiestaCumulativa = useRef(0)
  const invioCumulativa = useRef(false)
  const [sorgenti, setSorgenti] = useState<SorgenteVarianteAggiunta[]>([])
  const [chiaveSorgenteAperta, setChiaveSorgenteAperta] = useState<string | null>(null)
  const [messaggioSorgenti, setMessaggioSorgenti] = useState('')
  const [bozzaSorgentiVarianteId, setBozzaSorgentiVarianteId] = useState<string | null>(null)
  const bozzaIdRef = useRef<string | null>(null)
  const [salvataggioSorgente, setSalvataggioSorgente] = useState(false)
  const [caricamentoSorgenti, setCaricamentoSorgenti] = useState(false)
  const [sorgentiPronte, setSorgentiPronte] = useState(false)
  const invioSorgente = useRef(false)
  const sessioneSorgenti = useRef<object | null>(null)
  const letturaSorgenti = useRef(0)
  const [selezioneSorgenti, setSelezioneSorgenti] = useState<VarianteSorgenti | null>(null)
  const bozzaCreataId = useRef<string | null>(null)
  const elencoPronto = elencoVarianti.tipo === 'elenco' && elencoVarianti.cantiereId === cantiereId
  const candidate = variantiCorrenti.filter(v => v.titolo === titoloBozzaSorgenti &&
    ['bozza', 'proposta', 'approvata', 'rifiutata', 'annullata'].includes(v.stato))
  const varianteCorrente = candidate.find(v => v.id === bozzaSorgentiVarianteId)
  const varianteSelezionata = varianteCorrente ??
    ((!elencoPronto || bozzaCreataId.current === bozzaSorgentiVarianteId) ? selezioneSorgenti : null)
  const varianteSorgentiModificabile = varianteSelezionata?.stato === 'bozza'
  // Prima della prima sorgente resta disponibile la creazione della bozza già esistente.
  const nuovaRaccolta = elencoPronto && candidate.length === 0 && !bozzaSorgentiVarianteId
  const acquisizioneConsentita = varianteSorgentiModificabile || nuovaRaccolta
  const contestoScrittura = useRef({ id: bozzaSorgentiVarianteId, consentita: acquisizioneConsentita })
  contestoScrittura.current = { id: bozzaSorgentiVarianteId, consentita: acquisizioneConsentita }

  function verificaModifica(nuova = false) {
    if (contestoScrittura.current.consentita && contestoScrittura.current.id === bozzaSorgentiVarianteId &&
        (varianteSorgentiModificabile || (nuova && nuovaRaccolta))) return true
    setMessaggioSorgenti('La Variante non è modificabile. Seleziona una bozza per modificare le sorgenti.')
    return false
  }
  const operazioneSorgenti = salvataggioSorgente || caricamentoSorgenti || caricamentoCumulativa || confermaInCorso
  const verificaConferma = revisioneCumulativa && bozzaSorgentiVarianteId
    ? confermaPreventivoIntegrativo({ varianteId: bozzaSorgentiVarianteId, righe: revisioneCumulativa.righe }) : null
  const esitoConferma = bozzaSorgentiVarianteId ? esitiConferma[bozzaSorgentiVarianteId] : undefined

  useEffect(() => {
    sessioneSorgenti.current = {}
    return () => { sessioneSorgenti.current = null; letturaSorgenti.current += 1 }
  }, [])

  async function caricaSorgentiSalvate(id: string) {
    if (invioSorgente.current || invioCumulativa.current) return
    const candidata = candidate.find(v => v.id === id) ?? selezioneSorgenti
    if (!candidata || candidata.id !== id) return
    setSelezioneSorgenti({ id: candidata.id, titolo: candidata.titolo, stato: candidata.stato,
      numero: candidata.numero, data_variante: candidata.data_variante, created_at: candidata.created_at })
    const sessione = sessioneSorgenti.current
    const lettura = ++letturaSorgenti.current
    bozzaIdRef.current = id
    setBozzaSorgentiVarianteId(id)
    richiesta.current += 1
    resetFile()
    setAnteprima(null)
    setPreventivoId('')
    setCaricamentoAnteprima(false)
    setSorgenti([])
    setSorgentiPronte(false)
    setCaricamentoSorgenti(true)
    try {
      const righe: SorgenteVarianteAggiunta[] = []
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await supabase.rpc('leggi_sorgenti_variante', { p_variante_id: id })
          .order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199)
        if (sessioneSorgenti.current !== sessione || lettura !== letturaSorgenti.current) return
        if (error) { setMessaggioSorgenti(messaggioRpcSorgenti(error)); return }
        if (!Array.isArray(data)) throw new Error('Elenco non valido')
        righe.push(...data.map(v => leggiMetadataSorgente(v, id)))
        if (data.length < 200) break
      }
      setSorgenti(righe)
      setSorgentiPronte(true)
    } catch {
      if (sessioneSorgenti.current === sessione && lettura === letturaSorgenti.current)
        setMessaggioSorgenti('Impossibile caricare le sorgenti. Riprova la lettura.')
    } finally {
      if (sessioneSorgenti.current === sessione && lettura === letturaSorgenti.current) setCaricamentoSorgenti(false)
    }
  }

  useEffect(() => {
    if (!elencoPronto || bozzaIdRef.current) return
    if (candidate.length === 1) void caricaSorgentiSalvate(candidate[0].id)
    else setSorgentiPronte(candidate.length === 0)
  }, [elencoVarianti, cantiereId, variantiCorrenti])
  const richiesta = useRef(0)

  useEffect(() => {
    if (!varianteCorrente) return
    setSelezioneSorgenti({ id: varianteCorrente.id, titolo: varianteCorrente.titolo,
      stato: varianteCorrente.stato, numero: varianteCorrente.numero,
      data_variante: varianteCorrente.data_variante, created_at: varianteCorrente.created_at })
    if (bozzaCreataId.current === varianteCorrente.id) bozzaCreataId.current = null
  }, [varianteCorrente?.id, varianteCorrente?.stato, varianteCorrente?.numero,
    varianteCorrente?.data_variante, varianteCorrente?.created_at])

  useEffect(() => {
    if (varianteSorgentiModificabile || nuovaRaccolta) return
    // Invalida solo operazioni locali: sorgenti e snapshot persistiti restano consultabili.
    richiesta.current += 1
    annullaRevisioneCumulativa()
    invioSorgente.current = false
    setSalvataggioSorgente(false)
    setRevisione(null)
    setFileSelezionato(null)
    setAnalisiFile(false)
    setErroreFile('')
    setWarningsFile([])
    setPropostaFile(null)
    setAnteprima(null)
    setPreventivoId('')
    setCaricamentoAnteprima(false)
  }, [bozzaSorgentiVarianteId, varianteSelezionata?.stato, nuovaRaccolta])
  const sorgenteMemorizzata = sorgenti.find(s => s.id === chiaveSorgenteAperta)?.snapshot
  const anteprima = sorgenteMemorizzata
    ? sorgenteMemorizzata.tipo === 'preventivo_artecna' ? sorgenteMemorizzata : null
    : anteprimaCaricata
  const propostaFile = sorgenteMemorizzata
    ? sorgenteMemorizzata.tipo === 'file' ? sorgenteMemorizzata.proposta : null
    : propostaFileCaricata
  const warningsFile = sorgenteMemorizzata
    ? sorgenteMemorizzata.tipo === 'file' ? sorgenteMemorizzata.warnings : []
    : warningsFileLettura
  const sorgenteCorrente: SnapshotSorgenteVariante | null = sorgenteMemorizzata ?? (
    percorsoPreventivo && anteprimaCaricata ? {
      chiave: 'artecna:' + anteprimaCaricata.proposta.preventivoSorgenteId,
      tipo: 'preventivo_artecna',
      preventivoId: anteprimaCaricata.proposta.preventivoSorgenteId,
      titolo: preventivi.find(p => p.id === preventivoId)?.nomeFile || 'Preventivo ARTECNA',
      proposta: anteprimaCaricata.proposta,
      anomalieMapper: anteprimaCaricata.anomalieMapper,
    } : percorsoFile && propostaFileCaricata && fileSelezionato ? {
      // Chiave della sola sessione: non viene aggiunta alla provenienza delle voci.
      chiave: 'file:' + JSON.stringify([fileSelezionato.name, fileSelezionato.size, fileSelezionato.lastModified]),
      tipo: 'file',
      titolo: propostaFileCaricata.file.nome,
      proposta: propostaFileCaricata,
      warnings: warningsFileLettura,
    } : null
  )

  function annullaRevisioneCumulativa() {
    setErroreConferma('')
    setConfermaInCorso(false)
    invioConferma.current = false
    richiestaCumulativa.current += 1
    invioCumulativa.current = false
    setCaricamentoCumulativa(false)
    setRevisioneCumulativa(null)
    setErroreCumulativa('')
  }

  async function confermaLavorazioni() {
    if (!verificaModifica()) return
    if (invioConferma.current || operazioneSorgenti || esitoConferma ||
        !bozzaSorgentiVarianteId || !revisioneCumulativa) return
    const risultato = confermaPreventivoIntegrativo({
      varianteId: bozzaSorgentiVarianteId,
      righe: revisioneCumulativa.righe.map(r => ({
        sorgenteId: r.sorgenteId, indiceVoce: r.indiceVoce, inclusa: r.inclusa,
        descrizione: r.descrizione, unitaMisura: r.unitaMisura,
        quantita: r.quantita, prezzoUnitario: r.prezzoUnitario,
      })),
    })
    if (risultato.stato === 'errore') {
      setErroreConferma('La revisione contiene dati non validi. Anomalie: ' + risultato.anomalie.length)
      return
    }
    const sessione = sessioneSorgenti.current
    if (!sessione) return
    const corrente = richiestaCumulativa.current
    const id = risultato.richiesta.varianteId
    const attuale = () => sessioneSorgenti.current === sessione &&
      richiestaCumulativa.current === corrente && bozzaIdRef.current === id &&
      contestoScrittura.current.consentita && contestoScrittura.current.id === id
    invioConferma.current = true
    setConfermaInCorso(true)
    setErroreConferma('')
    try {
      const { data, error } = await supabase.rpc('conferma_preventivo_integrativo', {
        p_variante_id: id,
        p_lavorazioni: risultato.richiesta.lavorazioni.map(l => ({
          sorgenteId: l.sorgenteId, indiceVoce: l.indiceVoce,
          descrizione: l.descrizione, unitaMisura: l.unitaMisura,
          quantita: l.quantita, prezzoUnitario: l.prezzoUnitario,
        })),
      })
      if (!attuale()) return
      if (error) {
        if (error.code === '23505' && /voce sorgente gi[aà] confermata/i.test(error.message))
          setErroreConferma('Queste lavorazioni risultano già confermate nella bozza.')
        else if (error.code === '42501') setErroreConferma('Sessione non valida o cantiere non autorizzato.')
        else if (error.code === 'P0002') setErroreConferma('Variante non disponibile.')
        else if (error.code === '22023' && /non in bozza/i.test(error.message))
          setErroreConferma('La Variante non è più in bozza.')
        else if (error.code === '22023' && /sorgente non appartenente/i.test(error.message))
          setErroreConferma('Una sorgente non appartiene alla Variante. Ricarica le sorgenti.')
        else if (error.code === '22023') setErroreConferma('Dati non validi: verifica le lavorazioni della revisione.')
        else if (['23505', '40001', '40P01'].includes(error.code))
          setErroreConferma('Conflitto concorrente: ricarica le lavorazioni prima di riprovare.')
        else setErroreConferma('Conferma non verificata. Riapri la bozza per controllare le lavorazioni prima di riprovare.')
        return
      }
      const r = Array.isArray(data) && data.length === 1 ? data[0] : null
      const totale = r && (typeof r.delta_totale === 'number' ||
        (typeof r.delta_totale === 'string' && r.delta_totale.trim() !== '')) ? Number(r.delta_totale) : NaN
      if (!r || r.variante_id !== id || !Number.isInteger(r.numero_lavorazioni) ||
          r.numero_lavorazioni !== risultato.richiesta.lavorazioni.length || !Number.isFinite(totale) || totale <= 0)
        throw new Error('Risposta non verificabile')
      setEsitiConferma(precedenti => ({ ...precedenti, [id]: { numero: r.numero_lavorazioni, totale } }))
    } catch {
      if (attuale()) setErroreConferma('Conferma non verificata. Riapri la bozza per controllare le lavorazioni prima di riprovare.')
    } finally {
      if (attuale()) { invioConferma.current = false; setConfermaInCorso(false) }
    }
  }

  async function revisionaTutteLeSorgenti() {
    if (!verificaModifica()) return
    if (invioCumulativa.current || invioSorgente.current || caricamentoSorgenti ||
        !sorgentiPronte || !bozzaSorgentiVarianteId || sorgenti.length === 0) return
    const sessione = sessioneSorgenti.current
    if (!sessione) return
    resetFile()
    setAnteprima(null)
    richiesta.current += 1
    setCaricamentoAnteprima(false)
    const corrente = ++richiestaCumulativa.current
    invioCumulativa.current = true
    setCaricamentoCumulativa(true)
    try {
      const righe: RigaRevisioneCumulativa[] = []
      // Ordine sorgenti e ordine voci preservati; nessuna fusione tra sorgenti.
      for (const sorgente of sorgenti) {
        const { data, error } = await supabase.rpc('leggi_sorgente_variante', { p_sorgente_id: sorgente.id })
        if (sessioneSorgenti.current !== sessione || richiestaCumulativa.current !== corrente || !contestoScrittura.current.consentita) return
        if (error) { setErroreCumulativa(messaggioRpcSorgenti(error)); return }
        const riga = singolaRigaSorgente(data)
        const meta = leggiMetadataSorgente(riga, bozzaSorgentiVarianteId)
        if (meta.id !== sorgente.id) throw new Error('Identità sorgente incoerente')
        if (meta.snapshotVersion !== 1) { setErroreCumulativa('Versione snapshot non supportata: ' + sorgente.titolo); return }
        if (!recordSorgente(riga) || !snapshotSorgenteValido(riga.snapshot, meta, cantiereId))
          throw new Error('Snapshot non valido')
        const snapshot = riga.snapshot
        righe.push(...creaRevisioneVariante(snapshot.proposta,
          snapshot.tipo === 'preventivo_artecna' ? snapshot.anomalieMapper : []).map((voce, indiceVoce) => ({
            ...voce, sorgenteId: meta.id, indiceVoce, titoloSorgente: meta.titolo,
          })))
      }
      setRevisioneCumulativa({ originali: structuredClone(righe), righe: structuredClone(righe) })
    } catch {
      if (sessioneSorgenti.current === sessione && richiestaCumulativa.current === corrente && contestoScrittura.current.consentita)
        setErroreCumulativa('Impossibile leggere tutti gli snapshot. Nessuna revisione parziale è stata creata.')
    } finally {
      if (sessioneSorgenti.current === sessione && richiestaCumulativa.current === corrente && contestoScrittura.current.consentita) {
        invioCumulativa.current = false
        setCaricamentoCumulativa(false)
      }
    }
  }

  function resetFile() {
    annullaRevisioneCumulativa()
    setChiaveSorgenteAperta(null)
    setMessaggioSorgenti('')
    setRevisione(null)
    setFileSelezionato(null)
    setAnalisiFile(false)
    setErroreFile('')
    setWarningsFile([])
    setPropostaFile(null)
  }

  function resetPercorso() {
    richiesta.current += 1
    resetFile()
    setPreventivi([])
    setPreventivoId('')
    setAnteprima(null)
    setMessaggio('')
    setCaricamentoAnteprima(false)
    setCaricamentoElenco(false)
  }

  useEffect(() => {
    let attivo = true
    richiesta.current += 1
    if (acquisizioneConsentita) resetFile()
    setPreventivi([])
    setPreventivoId('')
    setAnteprima(null)
    setMessaggio('')
    setCaricamentoAnteprima(false)
    setCaricamentoElenco(aperto && percorsoPreventivo && acquisizioneConsentita)
    if (aperto && percorsoPreventivo && acquisizioneConsentita) {
      void elencaPreventiviSorgenteVariante(supabase, cantiereId).then(esito => {
        if (!attivo || !contestoScrittura.current.consentita) return
        if (esito.stato === 'errore') setMessaggio(esito.messaggio)
        else setPreventivi(esito.preventivi)
      }).catch(() => {
        if (attivo && contestoScrittura.current.consentita) setMessaggio('Impossibile caricare i preventivi sorgente.')
      }).finally(() => {
        if (attivo) setCaricamentoElenco(false)
      })
    }
    return () => { attivo = false; richiesta.current += 1 }
  }, [aperto, cantiereId, natura, acquisizione, percorsoPreventivo, acquisizioneConsentita])

  async function caricaAnteprima() {
    if (!verificaModifica(true)) return
    if (!aperto || !percorsoPreventivo || !preventivi.some(p => p.id === preventivoId)) return
    const corrente = ++richiesta.current
    setChiaveSorgenteAperta(null)
    setMessaggioSorgenti('')
    setRevisione(null)
    setAnteprima(null)
    setMessaggio('')
    setCaricamentoAnteprima(true)
    try {
      const esito = await caricaLavorazioniPreventivoSorgente(supabase, cantiereId, preventivoId)
      if (corrente !== richiesta.current || !contestoScrittura.current.consentita) return
      if (esito.stato === 'errore') { setMessaggio(esito.messaggio); return }
      if (esito.stato === 'nessuna_lavorazione') {
        setMessaggio('Il preventivo selezionato non contiene lavorazioni disponibili.')
        return
      }
      setAnteprima({
        proposta: adattaPreventivoAVariante(cantiereId, preventivoId, esito.voci),
        anomalieMapper: esito.anomalie,
      })
    } catch {
      if (corrente === richiesta.current && contestoScrittura.current.consentita) setMessaggio('Impossibile caricare l’anteprima.')
    } finally {
      if (corrente === richiesta.current && contestoScrittura.current.consentita) setCaricamentoAnteprima(false)
    }
  }

  async function analizzaFile() {
    if (!verificaModifica(true)) return
    if (!aperto || !percorsoFile || !fileSelezionato || analisiFile) return
    const corrente = ++richiesta.current
    setChiaveSorgenteAperta(null)
    setMessaggioSorgenti('')
    setRevisione(null)
    setAnalisiFile(true)
    setErroreFile('')
    setWarningsFile([])
    setPropostaFile(null)
    try {
      const esito = await estraiVociVarianteDaFile(fileSelezionato)
      if (corrente !== richiesta.current || !contestoScrittura.current.consentita) return
      setWarningsFile(esito.warnings)
      if (esito.stato === 'errore') { setErroreFile(esito.messaggio); return }
      if (esito.voci.length === 0) { setErroreFile('Nessuna voce riconosciuta nel file.'); return }
      const risultato = adattaFileAVariante({
        cantiereId, nomeFile: esito.nomeFile, formato: esito.formato, voci: esito.voci,
      })
      if (risultato.stato === 'errore') {
        setErroreFile(risultato.anomalie.map(a => etichetteAnomalieFile[a.codice]).join('; '))
        return
      }
      setPropostaFile(risultato.proposta)
    } catch {
      if (corrente === richiesta.current && contestoScrittura.current.consentita) setErroreFile('Impossibile analizzare il file.')
    } finally {
      if (corrente === richiesta.current && contestoScrittura.current.consentita) setAnalisiFile(false)
    }
  }

  async function aggiungiSorgente() {
    if (!verificaModifica(true)) return
    if (invioSorgente.current || invioCumulativa.current || caricamentoSorgenti || !elencoPronto || !sorgentiPronte ||
        (!bozzaIdRef.current && candidate.length > 0) ||
        !sorgenteCorrente || sorgenteCorrente.proposta.lavorazioni.length === 0) return
    if (sorgenti.some(s => s.id === chiaveSorgenteAperta || s.snapshot?.chiave === sorgenteCorrente.chiave ||
        (sorgenteCorrente.tipo === 'preventivo_artecna' && s.preventivoId === sorgenteCorrente.preventivoId))) {
      setMessaggioSorgenti('Sorgente già aggiunta')
      return
    }
    const sessione = sessioneSorgenti.current
    let idScrittura = bozzaIdRef.current
    const attuale = () => sessioneSorgenti.current === sessione &&
      contestoScrittura.current.consentita && contestoScrittura.current.id === idScrittura
    if (!sessione) return
    const copia = structuredClone(sorgenteCorrente)
    invioSorgente.current = true
    setSalvataggioSorgente(true)
    setMessaggioSorgenti('')
    try {
      let id = bozzaIdRef.current
      if (!id) {
        const { data, error } = await supabase.rpc('crea_bozza_variante', {
          p_cantiere_id: cantiereId, p_titolo: titoloBozzaSorgenti,
          p_descrizione: 'Raccolta sorgenti del Preventivo integrativo.', p_data_variante: null,
        })
        if (!attuale()) return
        if (error) { setSorgentiPronte(false); setMessaggioSorgenti('Creazione non confermata. Riapri la tab per verificare le bozze prima di riprovare.'); return }
        const riga = singolaRigaSorgente(data)
        id = idSorgenteValido(riga) ? riga : recordSorgente(riga) && idSorgenteValido(riga.id) ? riga.id : null
        if (!id) { setSorgentiPronte(false); setMessaggioSorgenti('Identità della bozza non verificabile. Riapri la tab prima di riprovare.'); return }
        // Conservato anche se la seconda RPC fallisce: nessuna nuova bozza al retry.
        bozzaCreataId.current = id
        idScrittura = id
        contestoScrittura.current = { id, consentita: true }
        setSelezioneSorgenti({ id, titolo: titoloBozzaSorgenti, stato: 'bozza', numero: null, data_variante: null })
        bozzaIdRef.current = id
        setBozzaSorgentiVarianteId(id)
      }
      const { data, error } = await supabase.rpc('aggiungi_sorgente_variante', {
        p_variante_id: id, p_tipo: copia.tipo,
        p_preventivo_sorgente_id: copia.tipo === 'preventivo_artecna' ? copia.preventivoId : null,
        p_titolo: copia.titolo, p_nome_file: copia.tipo === 'file' ? copia.proposta.file.nome : null,
        p_formato: copia.tipo === 'file' ? copia.proposta.file.formato : null,
        p_file_sha256: null, p_snapshot_version: 1, p_snapshot: copia,
      })
      if (!attuale()) return
      if (error) { setMessaggioSorgenti(messaggioRpcSorgenti(error)); return }
      const riga = singolaRigaSorgente(data)
      const salvata = leggiMetadataSorgente(riga, id)
      if (!recordSorgente(riga) || salvata.snapshotVersion !== 1 ||
          !snapshotSorgenteValido(riga.snapshot, salvata, cantiereId)) throw new Error('Snapshot non valido')
      const snapshot = riga.snapshot
      annullaRevisioneCumulativa()
      setSorgenti(precedenti => [...precedenti.filter(s => s.id !== salvata.id), { ...salvata, snapshot }])
      setMessaggioSorgenti('Sorgente salvata nella bozza.')
    } catch {
      if (attuale()) {
        setSorgentiPronte(false)
        setMessaggioSorgenti('Salvataggio non confermato. Ricarica le sorgenti o riapri la tab prima di riprovare.')
      }
    } finally {
      if (attuale()) { invioSorgente.current = false; setSalvataggioSorgente(false) }
    }
  }

  async function apriSorgente(id: string) {
    const sorgente = sorgenti.find(s => s.id === id)
    if (!sorgente || invioSorgente.current || invioCumulativa.current || caricamentoSorgenti) return
    const sessione = sessioneSorgenti.current
    const corrente = ++richiesta.current
    resetFile()
    setAnteprima(null)
    setCaricamentoAnteprima(true)
    try {
      const { data, error } = await supabase.rpc('leggi_sorgente_variante', { p_sorgente_id: id })
      if (sessioneSorgenti.current !== sessione || corrente !== richiesta.current) return
      if (error) { setMessaggioSorgenti(messaggioRpcSorgenti(error)); return }
      const riga = singolaRigaSorgente(data)
      const meta = leggiMetadataSorgente(riga, sorgente.varianteId)
      if (meta.id !== id) throw new Error('Identità sorgente incoerente')
      if (meta.snapshotVersion !== 1) { setMessaggioSorgenti('Versione snapshot non supportata'); return }
      if (!recordSorgente(riga) || !snapshotSorgenteValido(riga.snapshot, meta, cantiereId)) throw new Error('Snapshot non valido')
      const snapshot = riga.snapshot
      setSorgenti(precedenti => precedenti.map(s => s.id === id ? { ...meta, snapshot } : s))
      setRevisione(null)
      setChiaveSorgenteAperta(id)
    } catch {
      if (sessioneSorgenti.current === sessione && corrente === richiesta.current)
        setMessaggioSorgenti('Snapshot non valido o non disponibile. Nessuna conversione applicata.')
    } finally {
      if (sessioneSorgenti.current === sessione && corrente === richiesta.current) setCaricamentoAnteprima(false)
    }
  }

  async function rimuoviSorgente(id: string) {
    if (!verificaModifica()) return
    const sorgente = sorgenti.find(s => s.id === id)
    if (!sorgente || invioSorgente.current || invioCumulativa.current || caricamentoSorgenti) return
    const sessione = sessioneSorgenti.current
    const idScrittura = bozzaIdRef.current
    const attuale = () => sessioneSorgenti.current === sessione &&
      contestoScrittura.current.consentita && contestoScrittura.current.id === idScrittura
    invioSorgente.current = true
    setSalvataggioSorgente(true)
    setMessaggioSorgenti('')
    richiesta.current += 1
    setCaricamentoAnteprima(false)
    try {
      const { data, error } = await supabase.rpc('rimuovi_sorgente_variante', { p_sorgente_id: id })
      if (!attuale()) return
      if (error) { setMessaggioSorgenti(messaggioRpcSorgenti(error)); return }
      const rimossa = singolaRigaSorgente(data)
      if (!recordSorgente(rimossa) || rimossa.id !== id || rimossa.variante_id !== sorgente.varianteId)
        throw new Error('Rimozione non verificabile')
      if (chiaveSorgenteAperta === id || (sorgente.snapshot && sorgenteCorrente?.chiave === sorgente.snapshot.chiave)) {
        resetFile()
        setAnteprima(null)
        setPreventivoId('')
        setMessaggio('')
      }
      annullaRevisioneCumulativa()
      setSorgenti(precedenti => precedenti.filter(s => s.id !== id))
      setMessaggioSorgenti('Sorgente rimossa.')
    } catch {
      if (attuale()) setMessaggioSorgenti('Rimozione non confermata. Ricarica le sorgenti prima di riprovare.')
    } finally {
      if (attuale()) { invioSorgente.current = false; setSalvataggioSorgente(false) }
    }
  }

  function revisionaSorgente() {
    if (!verificaModifica()) return
    if (anteprima && anteprima.proposta.lavorazioni.length > 0) {
      setRevisione(creaRevisioneVariante(anteprima.proposta, anteprima.anomalieMapper))
    } else if (propostaFile && propostaFile.lavorazioni.length > 0) {
      setRevisione(creaRevisioneVariante(propostaFile))
    }
  }

  const numero = (valore: number | undefined) => typeof valore === 'number' && Number.isFinite(valore)
    ? valore.toLocaleString('it-IT', { maximumFractionDigits: 20 }) : 'Non disponibile'
  const totale = anteprima?.proposta.lavorazioni.reduce((somma, voce) =>
    somma + (typeof voce.totale === 'number' && Number.isFinite(voce.totale) && voce.totale >= 0 ? voce.totale : 0), 0)
  const cella = { padding: '8px 10px', border: '1px solid #dbe3ee', verticalAlign: 'top' as const }
  const totaleFile = propostaFile?.lavorazioni.reduce((somma, voce) =>
    somma + (typeof voce.totale === 'number' && Number.isFinite(voce.totale) && voce.totale >= 0 ? voce.totale : 0), 0)

  return <div style={{ margin: '12px 0' }}>
    <button type="button" disabled={confermaInCorso} onClick={() => {
      richiesta.current += 1
      resetFile()
      setAperto(!aperto)
    }}>{aperto ? 'Chiudi anteprima da preventivo' : '+ Nuova variante da preventivo'}</button>
    {aperto && <section aria-label="Origine e acquisizione variante"
      style={{ marginTop: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label>Origine variante<select disabled={operazioneSorgenti || !acquisizioneConsentita} value={natura} style={{ display: 'block', padding: 8 }}
          onChange={e => {
            if (!verificaModifica(true)) return
            if (sorgenti.length > 0) {
              setMessaggioSorgenti('Questa bozza contiene sorgenti salvate. Rimuovile prima di cambiare origine.')
              return
            }
            if (!sorgentiPronte) {
              setMessaggioSorgenti('Verifica le sorgenti della bozza prima di cambiare origine.')
              return
            }
            resetPercorso()
            setNatura(e.target.value as NaturaVariante)
          }}>
          <option value="preventivo_integrativo">Preventivo integrativo</option>
          <option value="lavori_in_economia">Lavori in economia</option>
        </select></label>
        <label>Acquisizione<select disabled={operazioneSorgenti || !acquisizioneConsentita} value={acquisizione} style={{ display: 'block', padding: 8 }}
          onChange={e => { if (!verificaModifica(true)) return; resetPercorso(); setAcquisizione(e.target.value as AcquisizioneVariante) }}>
          <option value="manuale">Manuale</option>
          <option value="dati_artecna">Da dati ARTECNA</option>
          <option value="file">Importa file</option>
        </select></label>
      </div>
      {!elencoPronto && <p role="status">Attendi il caricamento delle varianti prima di salvare sorgenti.</p>}
      {candidate.length > 1 && <label>
        Esistono più Varianti di Preventivo integrativo. Seleziona quella da consultare.
        <select value={bozzaSorgentiVarianteId ?? ''} disabled={operazioneSorgenti}
          onChange={e => { if (e.target.value) void caricaSorgentiSalvate(e.target.value) }}>
          <option value="" disabled>Seleziona una Variante</option>
          {candidate.map(b => <option key={b.id} value={b.id}>
            {b.stato}{b.numero !== null ? ' — N. ' + b.numero : ''} — {b.data_variante || b.created_at || 'Data non disponibile'} — {b.id.slice(0, 8)}
          </option>)}
        </select>
      </label>}
      {varianteSelezionata && <p>Variante {varianteSelezionata.numero !== null ? 'N. ' + varianteSelezionata.numero : varianteSelezionata.id.slice(0, 8)}
        {' — '}{varianteSelezionata.stato}</p>}
      {varianteSelezionata && !varianteSorgentiModificabile && <p role="status">
        Variante in stato {varianteSelezionata.stato}: sorgenti e lavorazioni sono in sola lettura.
      </p>}
      {bozzaSorgentiVarianteId && <button type="button" disabled={operazioneSorgenti}
        onClick={() => void caricaSorgentiSalvate(bozzaSorgentiVarianteId)}>Ricarica sorgenti</button>}
      {caricamentoSorgenti && <p role="status">Caricamento sorgenti...</p>}
      {sorgenti.length > 0 && <section aria-label="Sorgenti della variante" style={{ marginTop: 16 }}>
        <h4>Sorgenti della variante</h4>
        <button type="button" disabled={operazioneSorgenti || !sorgentiPronte || !varianteSorgentiModificabile}
          onClick={() => void revisionaTutteLeSorgenti()}>Revisiona tutte le sorgenti</button>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 650, fontSize: 14 }}>
            <thead><tr>{['Tipo', 'Sorgente', 'Voci', 'Totale sorgente', 'Azioni'].map(t =>
              <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
            <tbody>{sorgenti.map(sorgente => {
              const totaleSorgente = sorgente.snapshot?.proposta.lavorazioni.reduce((somma, voce) =>
                somma + (typeof voce.totale === 'number' && Number.isFinite(voce.totale) && voce.totale >= 0
                  ? voce.totale : 0), 0)
              return <tr key={sorgente.id}>
                <td style={cella}>{sorgente.tipo === 'preventivo_artecna' ? 'ARTECNA' : 'FILE'}</td>
                <td style={{ ...cella, overflowWrap: 'anywhere' }}>{sorgente.titolo}</td>
                <td style={cella}>{sorgente.snapshot?.proposta.lavorazioni.length ?? '—'}</td>
                <td style={cella}>{totaleSorgente === undefined ? '—' : numero(totaleSorgente) + ' €'}</td>
                <td style={cella}>
                  <button type="button" disabled={operazioneSorgenti} onClick={() => void apriSorgente(sorgente.id)}
                    aria-label={'Apri sorgente ' + sorgente.titolo}>Apri</button>{' '}
                  <button type="button" disabled={operazioneSorgenti || !varianteSorgentiModificabile} onClick={() => void rimuoviSorgente(sorgente.id)}
                    aria-label={'Rimuovi sorgente ' + sorgente.titolo}>Rimuovi</button>
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </section>}
      {caricamentoCumulativa && <p role="status">Caricamento di tutti gli snapshot...</p>}
      {erroreCumulativa && <p role="alert">{erroreCumulativa}</p>}
      {revisioneCumulativa && <RevisioneCumulativaLocale valore={revisioneCumulativa}
        onChange={valore => { if (verificaModifica()) setRevisioneCumulativa(valore) }} onAnnulla={annullaRevisioneCumulativa}
        pronta={verificaConferma?.stato === 'ok'}
        indiciNonValidi={verificaConferma?.stato === 'errore'
          ? verificaConferma.anomalie.flatMap(a => a.indiceRigaInput === undefined ? [] : [a.indiceRigaInput]) : []}
        bloccata={operazioneSorgenti || !varianteSorgentiModificabile}
        confermaInCorso={confermaInCorso} confermata={!!esitoConferma}
        onConferma={() => void confermaLavorazioni()} />}
      {erroreConferma && <p role="alert">{erroreConferma}</p>}
      {esitoConferma && <p role="status">Lavorazioni salvate nella bozza. Lavorazioni confermate: {esitoConferma.numero}
        {' — Totale: '}{esitoConferma.totale.toLocaleString('it-IT', {
          style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true,
        })}</p>}
      {sorgenteMemorizzata && <p>Sorgente aperta: {sorgenteMemorizzata.titolo}</p>}
      {!percorsoPreventivo && !percorsoFile && <p role="status">Questo percorso non è ancora configurato.</p>}
      {percorsoFile && <>
        <p>Il file resta locale. Aggiungi alle sorgenti salva lo snapshot nella bozza, senza lavorazioni economiche.</p>
        <label>File preventivo<input type="file" disabled={operazioneSorgenti || !acquisizioneConsentita} accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
          style={{ display: 'block', margin: '8px 0', maxWidth: '100%' }}
          onChange={e => {
            if (!verificaModifica(true)) return
            richiesta.current += 1
            resetFile()
            setFileSelezionato(e.target.files?.[0] ?? null)
            e.target.value = ''
          }} /></label>
        {fileSelezionato && <p style={{ overflowWrap: 'anywhere' }}>{fileSelezionato.name}</p>}
        <button type="button" disabled={operazioneSorgenti || !acquisizioneConsentita || !fileSelezionato || analisiFile}
          onClick={() => void analizzaFile()}>{analisiFile ? 'Analisi in corso...' : 'Analizza file'}</button>
        {erroreFile && <p role="status">{erroreFile}</p>}
      </>}
        {warningsFile.length > 0 && <div><p>Avvisi lettura file:</p>
          <ul>{warningsFile.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        </div>}
        {propostaFile && revisione === null && <>
          <p>Totale sorgente leggibile: {numero(totaleFile)} € (solo totali validi e finiti).</p>
          {propostaFile.anomalie.filter(a => a.indiceVoce === undefined).map((a, i) =>
            <p key={i}>{etichetteAnomalieFile[a.codice]}</p>)}
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780, fontSize: 14 }}>
              <caption style={{ textAlign: 'left', padding: 8 }}>Lavorazioni del file — sola lettura</caption>
              <thead><tr>{['Descrizione', 'UM', 'Quantità', 'Prezzo sorgente', 'Totale sorgente', 'Verifica'].map(t =>
                <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
              <tbody>{propostaFile.lavorazioni.map((voce, indice) => {
                const anomalie = propostaFile.anomalie.filter(a => a.indiceVoce === indice)
                return <tr key={indice} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
                  <td style={{ ...cella, whiteSpace: 'pre-wrap' }}>{voce.descrizione ?? 'Non disponibile'}</td>
                  <td style={cella}>{voce.unitaMisura ?? 'Non disponibile'}</td>
                  <td style={cella}>{numero(voce.quantita)}</td>
                  <td style={cella}>{numero(voce.prezzoSorgente)}</td>
                  <td style={cella}>{numero(voce.totale)}</td>
                  <td style={cella}>{anomalie.length ? anomalie.map((a, i) =>
                    <div key={i}>{etichetteAnomalieFile[a.codice]}</div>) : 'Nessuna anomalia rilevata'}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
          {propostaFile.lavorazioni.length > 0 && <button type="button" disabled={!varianteSorgentiModificabile} onClick={revisionaSorgente}>
            Revisiona variante
          </button>}
        </>}
      {percorsoPreventivo && <>
      <p>L’anteprima non salva dati. Aggiungi alle sorgenti salva lo snapshot nella bozza senza correggere voci o importi.</p>
      <label>Preventivo sorgente<select value={preventivoId} disabled={operazioneSorgenti || !acquisizioneConsentita || caricamentoElenco}
        style={{ display: 'block', width: '100%', padding: 8, margin: '8px 0' }}
        onChange={e => {
          if (!verificaModifica(true)) return
          richiesta.current += 1
          resetFile()
          setPreventivoId(e.target.value)
          setAnteprima(null)
          setMessaggio('')
          setCaricamentoAnteprima(false)
        }}>
        <option value="">Seleziona un preventivo</option>
        {preventivi.map(p => <option key={p.id} value={p.id}>
          {p.nomeFile || 'Preventivo'} — {p.dataPreventivo || p.createdAt || 'Data non disponibile'}
          {' — '}{p.importoTotale !== undefined ? `${p.importoTotale} €` : 'Importo non disponibile'}
          {' — '}{p.numeroLavorazioni} voci
        </option>)}
      </select></label>
      {caricamentoElenco && <p role="status">Caricamento preventivi...</p>}
      {!caricamentoElenco && !messaggio && preventivi.length === 0 && <p>Nessun preventivo strutturato disponibile per questo cantiere.</p>}
      <button type="button" disabled={operazioneSorgenti || !acquisizioneConsentita || !preventivoId || caricamentoElenco || caricamentoAnteprima}
        onClick={() => void caricaAnteprima()}>{caricamentoAnteprima ? 'Caricamento anteprima...' : 'Carica anteprima'}</button>
      {messaggio && <p role="status">{messaggio}</p>}
      </>}
      {anteprima && revisione === null && <>
        <p>Totale sorgente leggibile: {numero(totale)} € (solo totali validi e finiti).</p>
        {anteprima.proposta.anomalie.filter(a => a.indiceVoce === undefined).map((a, i) =>
          <p key={i}>Adapter: {a.codice.replaceAll('_', ' ')}</p>)}
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780, fontSize: 14 }}>
            <caption style={{ textAlign: 'left', padding: 8 }}>Lavorazioni sorgente — sola lettura</caption>
            <thead><tr>{['Descrizione', 'UM', 'Quantità', 'Prezzo sorgente', 'Totale sorgente', 'Verifica'].map(t =>
              <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
            <tbody>{anteprima.proposta.lavorazioni.map((voce, indice) => {
              const anomalie = [
                ...anteprima.anomalieMapper.filter(a => a.indiceRiga === indice).map(a => `Mapper: ${a.codice.replaceAll('_', ' ')}`),
                ...anteprima.proposta.anomalie.filter(a => a.indiceVoce === indice).map(a => `Adapter: ${a.codice.replaceAll('_', ' ')}`),
              ]
              return <tr key={indice} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
                <td style={{ ...cella, whiteSpace: 'pre-wrap' }}>{voce.descrizione ?? 'Non disponibile'}</td>
                <td style={cella}>{voce.unitaMisura ?? 'Non disponibile'}</td>
                <td style={cella}>{numero(voce.quantita)}</td>
                <td style={cella}>{numero(voce.prezzoSorgente)}</td>
                <td style={cella}>{numero(voce.totale)}</td>
                <td style={cella}>{anomalie.length ? anomalie.map((a, i) => <div key={i}>{a}</div>) : 'Nessuna anomalia rilevata'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
        {anteprima.proposta.lavorazioni.length > 0 && <button type="button" disabled={!varianteSorgentiModificabile} onClick={revisionaSorgente}>
          Revisiona variante
        </button>}
      </>}
      {revisione === null && sorgenteCorrente && sorgenteCorrente.proposta.lavorazioni.length > 0 &&
        <button type="button" disabled={operazioneSorgenti || !acquisizioneConsentita || !elencoPronto || !sorgentiPronte || caricamentoAnteprima}
          onClick={() => void aggiungiSorgente()}>{salvataggioSorgente ? 'Salvataggio...' : 'Aggiungi alle sorgenti'}</button>}
      {messaggioSorgenti && <p role="status">{messaggioSorgenti}</p>}
      {varianteSorgentiModificabile && revisione !== null && <RevisioneVarianteLocale righe={revisione} onChange={setRevisione}
        onAnnulla={() => setRevisione(null)} onRipristina={revisionaSorgente} />}
    </section>}
  </div>
}

type Variante = {
  id: string
  numero: number | null
  titolo: string | null
  descrizione: string
  stato: string
  data_variante: string | null
  created_at?: string | null
  importo_delta_approvato: number | string | null
  approvata_at?: string | null
  riferimento_approvazione?: string | null
  preventivo_contrattuale_id: string | null
}

type Stato =
  | { tipo: 'loading' }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'elenco'; righe: Variante[]; cantiereId: string }

const erroriLetturaRpc: Record<string, string> = {
  P2020: 'Sessione utente non valida.',
  P2021: 'Non sei autorizzato a visualizzare le varianti di questo cantiere.',
}

const erroriRpc: Record<string, string> = {
  P2020: 'Identità o dati non validi. Controlla il titolo e la sessione.',
  P2021: 'Non sei autorizzato a creare varianti per questo cantiere.',
  P2022: 'Cantiere o preventivo contrattuale non disponibile o incoerente.',
  P2023: 'Creazione della bozza non completata.',
  '40001': 'Conflitto concorrente: salvataggio annullato. Puoi riprovare manualmente.',
  '40P01': 'Conflitto concorrente: salvataggio annullato. Puoi riprovare manualmente.',
}

export default function VariantiCantierePanel({ cantiereId }: { cantiereId?: string | null }) {
  const [stato, setStato] = useState<Stato>({ tipo: 'loading' })
  const [formAperto, setFormAperto] = useState(false)
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [dataVariante, setDataVariante] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreSalvataggio, setErroreSalvataggio] = useState('')
  const [successo, setSuccesso] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [bozzeCreate, setBozzeCreate] = useState<Variante[]>([])
  const [proposteConfermate, setProposteConfermate] = useState<Variante[]>([])
  const [approvazioniConfermate, setApprovazioniConfermate] = useState<Variante[]>([])
  const invioInCorso = useRef(false)
  const contesto = useRef<object | null>(null)

  useEffect(() => {
    const corrente = {}
    contesto.current = corrente
    invioInCorso.current = false
    setFormAperto(false)
    setTitolo('')
    setDescrizione('')
    setDataVariante('')
    setErroreSalvataggio('')
    setSuccesso('')
    setSalvataggio(false)
    setBozzeCreate([])
    setProposteConfermate([])
    setApprovazioniConfermate([])
    return () => { contesto.current = null }
  }, [cantiereId])

  useEffect(() => {
    let attivo = true
    if (!cantiereId) {
      setStato({ tipo: 'errore', messaggio: 'Cantiere non identificato. Seleziona un cantiere valido.' })
      return
    }
    setStato({ tipo: 'loading' })
    async function carica() {
      try {
        const righe: Variante[] = []
        const pagina = 200
        for (let offset = 0; ; offset += pagina) {
          const { data, error } = await supabase
            .rpc('leggi_varianti_cantiere', { p_cantiere_id: cantiereId! })
            .order('numero', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(offset, offset + pagina - 1)
          if (!attivo) return
          if (error) {
            const messaggio = erroriLetturaRpc[error.code]
            if (!messaggio) throw error
            setStato({ tipo: 'errore', messaggio })
            return
          }
          if (!data) throw new Error('Risposta non disponibile.')
          righe.push(...data)
          if (data.length < pagina) break
        }
        if (attivo) setStato({ tipo: 'elenco', righe, cantiereId: cantiereId! })
      } catch {
        if (attivo) setStato({ tipo: 'errore', messaggio: 'Errore di aggiornamento elenco. Le bozze già confermate restano salvate. Riapri la tab per riprovare la lettura.' })
      }
    }
    void carica()
    return () => { attivo = false }
  }, [cantiereId, refresh])

  function resetForm() {
    setFormAperto(false)
    setTitolo('')
    setDescrizione('')
    setDataVariante('')
    setErroreSalvataggio('')
  }

  async function salvaBozza(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invioInCorso.current) return
    if (!cantiereId || !titolo.trim()) {
      setErroreSalvataggio('Seleziona un cantiere e inserisci un titolo non vuoto.')
      return
    }
    const corrente = contesto.current
    if (!corrente) return
    invioInCorso.current = true
    setSalvataggio(true)
    setErroreSalvataggio('')
    setSuccesso('')
    try {
      const { data, error } = await supabase.rpc('crea_bozza_variante', {
        p_cantiere_id: cantiereId,
        p_titolo: titolo.trim(),
        p_descrizione: descrizione.trim() || null,
        p_data_variante: dataVariante || null,
      })
      if (contesto.current !== corrente) return
      if (error) {
        setErroreSalvataggio(erroriRpc[error.code] ||
          'Salvataggio non confermato. Verifica se la bozza esiste prima di riprovare.')
        return
      }
      const nuova = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!nuova || typeof nuova.id !== 'string' || !nuova.id.trim() ||
          nuova.cantiere_id !== cantiereId || nuova.stato !== 'bozza' ||
          nuova.numero !== null || typeof nuova.titolo !== 'string' ||
          typeof nuova.descrizione !== 'string' || typeof nuova.data_variante !== 'string' ||
          typeof nuova.preventivo_contrattuale_id !== 'string') {
        setErroreSalvataggio('Risposta di creazione non verificabile. Controlla se la bozza è stata creata prima di riprovare.')
        return
      }
      const confermata: Variante = {
        id: nuova.id,
        numero: nuova.numero,
        titolo: nuova.titolo,
        descrizione: nuova.descrizione,
        stato: nuova.stato,
        data_variante: nuova.data_variante,
        preventivo_contrattuale_id: nuova.preventivo_contrattuale_id,
        importo_delta_approvato: null,
      }
      setBozzeCreate(precedenti => [...precedenti.filter(v => v.id !== confermata.id), confermata])
      resetForm()
      setSuccesso('Bozza salvata.')
      setRefresh(valore => valore + 1)
    } catch {
      if (contesto.current === corrente) {
        setErroreSalvataggio('Salvataggio non confermato per un errore di comunicazione. Verifica se la bozza esiste prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invioInCorso.current = false
        setSalvataggio(false)
      }
    }
  }

  function confermaProposta(variante: Variante, numero: number) {
    const proposta = { ...variante, stato: 'proposta', numero }
    setProposteConfermate(precedenti => [...precedenti.filter(v => v.id !== variante.id), proposta])
    setSuccesso(`Variante proposta come n. ${numero}.`)
    setRefresh(valore => valore + 1)
  }

  function confermaApprovazione(variante: Variante, esito: EsitoApprovazione) {
    const approvata = { ...variante, ...esito }
    setApprovazioniConfermate(precedenti => [...precedenti.filter(v => v.id !== variante.id), approvata])
    setSuccesso(`Variante n. ${esito.numero} approvata.`)
    setRefresh(valore => valore + 1)
  }

  const righeLette = stato.tipo === 'elenco' ? stato.righe : []
  const righe = [
    ...righeLette,
    ...bozzeCreate.filter(bozza => !righeLette.some(riga => riga.id === bozza.id)),
    ...proposteConfermate.filter(proposta => !righeLette.some(r => r.id === proposta.id) && !bozzeCreate.some(r => r.id === proposta.id)),
    ...approvazioniConfermate.filter(approvata => ![...righeLette, ...bozzeCreate, ...proposteConfermate].some(v => v.id === approvata.id)),
  ].map(variante => variante.stato === 'bozza'
    ? proposteConfermate.find(p => p.id === variante.id) || variante
    : variante).map(variante => approvazioniConfermate.find(v => v.id === variante.id) || variante).sort((a, b) => {
    if (a.numero === null && b.numero !== null) return 1
    if (a.numero !== null && b.numero === null) return -1
    return (a.numero ?? 0) - (b.numero ?? 0) || a.id.localeCompare(b.id)
  })
  const bozzeNonRilette = stato.tipo === 'elenco' &&
    bozzeCreate.some(bozza => !righeLette.some(riga => riga.id === bozza.id))

  return (
    <section aria-label="Varianti" style={{ marginTop: 16 }}>
      <h3>Varianti</h3>
      {cantiereId && <AnteprimaPreventivoVariante key={cantiereId} cantiereId={cantiereId} elencoVarianti={stato} variantiCorrenti={righe} />}
      {!formAperto && (
        <button type="button" disabled={!cantiereId || salvataggio}
          onClick={() => { setErroreSalvataggio(''); setFormAperto(true) }}>
          Nuova variante
        </button>
      )}
      {formAperto && (
        <form onSubmit={salvaBozza} style={{ marginTop: 16 }}>
          <fieldset disabled={salvataggio} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <legend>Nuova variante</legend>
            <label>Titolo *<input required value={titolo} onChange={e => setTitolo(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} /></label>
            <label>Descrizione<textarea value={descrizione} onChange={e => setDescrizione(e.target.value)}
              rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} /></label>
            <label>Data variante<input type="date" value={dataVariante} onChange={e => setDataVariante(e.target.value)}
              style={{ display: 'block', padding: 8 }} /></label>
            <p style={{ margin: 0 }}>Se lasci la data vuota verrà usata la data corrente del database.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" onClick={resetForm}>Annulla</button>
              <button type="submit" disabled={salvataggio || !cantiereId || !titolo.trim()}>
                {salvataggio ? 'Salvataggio...' : 'Salva bozza'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {salvataggio && <p role="status">Salvataggio...</p>}
      {erroreSalvataggio && <p role="alert">{erroreSalvataggio}</p>}
      {successo && <p role="status">{successo}</p>}
      {stato.tipo === 'loading' && <p role="status">Caricamento varianti...</p>}
      {stato.tipo === 'errore' && <p role="alert">{stato.messaggio}</p>}
      {bozzeNonRilette && <p role="status">L'elenco aggiornato non restituisce tutte le bozze appena salvate. Sono mostrate le conferme di questa apertura del pannello; la rilettura non è confermata.</p>}
      {stato.tipo === 'elenco' && righe.length === 0 && <p>Nessuna variante presente per questo cantiere.</p>}
      {righe.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {righe.map(variante => (
            <article key={variante.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
              <h4 style={{ marginTop: 0 }}>
                {variante.stato === 'approvata' ? 'Approvata' : variante.stato === 'proposta' ? 'Proposta' : variante.numero === null ? 'Bozza' : `Variante n. ${variante.numero}`}
                {' — '}{variante.titolo || 'Senza titolo'}
              </h4>
              <p>Stato: {variante.stato}</p>
              {variante.numero !== null && <p>Numero: {variante.numero}</p>}
              <p style={{ whiteSpace: 'pre-wrap' }}>{variante.descrizione || 'Nessuna descrizione.'}</p>
              <p>Data variante: {variante.data_variante
                ? variante.data_variante.slice(0, 10).split('-').reverse().join('/')
                : 'Non indicata'}</p>
              <p>Importo delta approvato: {variante.importo_delta_approvato === null
                ? 'Non disponibile'
                : Number(variante.importo_delta_approvato).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>
              {variante.stato === 'approvata' && <>
                <p>Riferimento approvazione: {variante.riferimento_approvazione || 'Non disponibile'}</p>
                <p>Data approvazione: {variante.approvata_at && Number.isFinite(Date.parse(variante.approvata_at))
                  ? new Date(variante.approvata_at).toLocaleString('it-IT') : 'Non disponibile'}</p>
              </>}
              <details>
                <summary>Preventivo contrattuale collegato</summary>
                <p style={{ overflowWrap: 'anywhere' }}>{variante.preventivo_contrattuale_id || 'Non disponibile'}</p>
              </details>
              <LavorazioniVariantePanel key={`${cantiereId}:${variante.id}`} varianteId={variante.id}
                cantiereId={cantiereId} statoVariante={variante.stato}
                onProposta={numero => confermaProposta(variante, numero)}
                renderApprovazione={lavorazioniLette => variante.stato === 'proposta' &&
                  <ApprovazioneVarianteForm key={'approva:' + cantiereId + ':' + variante.id}
                    variante={variante} cantiereId={cantiereId} lavorazioniLette={lavorazioniLette}
                    onApprovata={esito => confermaApprovazione(variante, esito)} />} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}


type LavorazioneVariante = {
  numero_riga: number
  descrizione: string
  unita_misura: string | null
  quantita_delta: number | string
  prezzo_unitario: number | string
  delta_contratto: number | string
}

const erroriLavorazioniRpc: Record<string, string> = {
  P2022: 'Sessione utente non valida.',
  P2023: 'Dati della lavorazione non validi.',
  P2024: 'Variante non disponibile o non autorizzata.',
  P2025: 'La variante non è più modificabile.',
  P2026: "Conflitto durante l'aggiunta. Riprova.",
}

const numeroLavorazione = (value: unknown): number => {
  if (typeof value !== 'string' && typeof value !== 'number') return NaN
  if (typeof value === 'string' && !value.trim()) return NaN
  return Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
}

const lavorazioneValida = (value: unknown): value is LavorazioneVariante => {
  if (!value || typeof value !== 'object') return false
  const riga = value as Record<string, unknown>
  return Number.isInteger(riga.numero_riga) && Number(riga.numero_riga) > 0 &&
    typeof riga.descrizione === 'string' && !!riga.descrizione.trim() &&
    (riga.unita_misura === null || typeof riga.unita_misura === 'string') &&
    ['quantita_delta', 'prezzo_unitario', 'delta_contratto'].every(campo =>
      Number.isFinite(numeroLavorazione(riga[campo])))
}

const erroriPropostaRpc: Record<string, string> = {
  P2010: 'Variante non disponibile.',
  P2011: 'La variante non è più in bozza.',
  P2012: 'Il contratto di riferimento è cambiato o non è valido.',
  P2013: 'La variante deve contenere almeno una lavorazione.',
  P2014: 'Una o più lavorazioni della variante non sono valide.',
  P2015: 'Una lavorazione contiene un riferimento non valido.',
  P2016: 'Una lavorazione contiene un riferimento non valido.',
  P2017: 'Conflitto durante la proposta. Riprova.',
}

function LavorazioniVariantePanel({ varianteId, cantiereId, statoVariante, onProposta, renderApprovazione }: {
  varianteId: string
  cantiereId?: string | null
  statoVariante: string
  onProposta: (numero: number) => void
  renderApprovazione?: (lavorazioniLette: readonly LavorazioneVariante[] | null) => ReactNode
}) {
  const [righe, setRighe] = useState<LavorazioneVariante[]>([])
  const [confermate, setConfermate] = useState<LavorazioneVariante[]>([])
  const [lettura, setLettura] = useState<'loading' | 'elenco' | 'errore'>('loading')
  const [erroreLettura, setErroreLettura] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [aperto, setAperto] = useState(false)
  const [descrizione, setDescrizione] = useState('')
  const [unita, setUnita] = useState('')
  const [quantita, setQuantita] = useState('')
  const [prezzo, setPrezzo] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreSalvataggio, setErroreSalvataggio] = useState('')
  const [successo, setSuccesso] = useState('')
  const [bloccata, setBloccata] = useState(false)
  const [propostaInCorso, setPropostaInCorso] = useState(false)
  const [erroreProposta, setErroreProposta] = useState('')
  const invio = useRef(false)
  const contesto = useRef<object | null>(null)
  const modificabile = statoVariante === 'bozza' && !bloccata

  useEffect(() => {
    contesto.current = {}
    return () => { contesto.current = null }
  }, [])

  useEffect(() => {
    let attivo = true
    setLettura('loading')
    setErroreLettura('')
    async function caricaLavorazioni() {
      try {
        const elenco: LavorazioneVariante[] = []
        const pagina = 200
        for (let offset = 0; ; offset += pagina) {
          const { data, error } = await supabase
            .rpc('leggi_lavorazioni_variante', { p_variante_id: varianteId })
            .order('numero_riga', { ascending: true })
            .range(offset, offset + pagina - 1)
          if (!attivo) return
          if (error) {
            if (error.code === 'P2025') setBloccata(true)
            setErroreLettura(erroriLavorazioniRpc[error.code] || 'Impossibile caricare le lavorazioni della variante.')
            setLettura('errore')
            return
          }
          if (!Array.isArray(data) || !data.every(lavorazioneValida)) throw new Error('Risposta non valida')
          elenco.push(...data)
          if (data.length < pagina) break
        }
        if (attivo) {
          setRighe(elenco)
          setLettura('elenco')
        }
      } catch {
        if (attivo) {
          setErroreLettura('Impossibile caricare le lavorazioni della variante.')
          setLettura('errore')
        }
      }
    }
    void caricaLavorazioni()
    return () => { attivo = false }
  }, [varianteId, refresh])

  function resetForm() {
    setAperto(false)
    setDescrizione('')
    setUnita('')
    setQuantita('')
    setPrezzo('')
    setErroreSalvataggio('')
  }

  async function salvaLavorazione(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invio.current) return
    if (!modificabile) {
      setErroreSalvataggio(erroriLavorazioniRpc.P2025)
      return
    }
    const q = numeroLavorazione(quantita)
    const p = numeroLavorazione(prezzo)
    if (!descrizione.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) {
      setErroreSalvataggio(erroriLavorazioniRpc.P2023)
      return
    }
    const corrente = contesto.current
    if (!corrente) return
    invio.current = true
    setSalvataggio(true)
    setErroreSalvataggio('')
    setSuccesso('')
    try {
      const { data, error } = await supabase.rpc('aggiungi_lavorazione_variante', {
        p_variante_id: varianteId,
        p_descrizione: descrizione.trim(),
        p_unita_misura: unita.trim() || null,
        p_quantita: q,
        p_prezzo_unitario: p,
      })
      if (contesto.current !== corrente) return
      if (error) {
        if (error.code === 'P2025') setBloccata(true)
        setErroreSalvataggio(erroriLavorazioniRpc[error.code] ||
          'Salvataggio non confermato. Ricarica le lavorazioni prima di riprovare.')
        return
      }
      const nuova = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data
      if (!lavorazioneValida(nuova)) {
        setErroreSalvataggio('Risposta di salvataggio non verificabile. Ricarica le lavorazioni prima di riprovare.')
        return
      }
      setConfermate(precedenti => [...precedenti.filter(r => r.numero_riga !== nuova.numero_riga), nuova])
      resetForm()
      setSuccesso('Lavorazione salvata.')
      setRefresh(valore => valore + 1)
    } catch {
      if (contesto.current === corrente) {
        setErroreSalvataggio('Salvataggio non confermato. Ricarica le lavorazioni prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invio.current = false
        setSalvataggio(false)
      }
    }
  }

  async function proponiVariante() {
    if (invio.current || !modificabile || lettura !== 'elenco' || righe.length === 0 || !cantiereId) return
    if (!confirm('Proporre la Variante bloccherà la modifica delle sorgenti e delle lavorazioni. Continuare?')) return
    const corrente = contesto.current
    if (!corrente) return
    invio.current = true
    setPropostaInCorso(true)
    setErroreProposta('')
    try {
      const { data, error } = await supabase.rpc('proponi_variante', { p_variante_id: varianteId })
      if (contesto.current !== corrente) return
      if (error) {
        if (error.code === 'P2011') setBloccata(true)
        setErroreProposta(erroriPropostaRpc[error.code] ||
          'Proposta non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      const proposta = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!proposta || proposta.id !== varianteId || proposta.cantiere_id !== cantiereId ||
          proposta.stato !== 'proposta' || !Number.isInteger(proposta.numero) || proposta.numero <= 0) {
        setErroreProposta('Risposta di proposta non verificabile. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      setBloccata(true)
      resetForm()
      setSuccesso('')
      setRefresh(valore => valore + 1)
      onProposta(proposta.numero)
    } catch {
      if (contesto.current === corrente) {
        setErroreProposta('Proposta non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invio.current = false
        setPropostaInCorso(false)
      }
    }
  }

  const visibili = [...righe, ...confermate.filter(c => !righe.some(r => r.numero_riga === c.numero_riga))]
    .sort((a, b) => a.numero_riga - b.numero_riga)
  const nonRilette = confermate.some(c => !righe.some(r => r.numero_riga === c.numero_riga))
  const totale = visibili.reduce((somma, riga) => somma + numeroLavorazione(riga.delta_contratto), 0)
  const euro = (valore: number | string) => numeroLavorazione(valore).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, padding: 8 }

  return (
    <section aria-label="Lavorazioni della variante" style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
      <h5>Lavorazioni della variante</h5>
      {renderApprovazione?.(lettura === 'elenco' && !nonRilette ? righe : null)}
      {modificabile && lettura === 'elenco' && righe.length > 0 && (
        <button type="button" disabled={propostaInCorso || salvataggio || !cantiereId} onClick={() => void proponiVariante()}>
          {propostaInCorso ? 'Proposta in corso...' : 'Proponi variante'}
        </button>
      )}
      {erroreProposta && <p role="alert">{erroreProposta}</p>}
      {modificabile && !aperto && <button type="button" disabled={propostaInCorso} onClick={() => { setAperto(true); setErroreSalvataggio(''); setSuccesso('') }}>+ Nuova lavorazione</button>}
      {modificabile && aperto && (
        <form onSubmit={salvaLavorazione} style={{ marginTop: 12 }}>
          <fieldset disabled={salvataggio || propostaInCorso} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0' }}>
            <legend>Nuova lavorazione</legend>
            <label>Descrizione *<textarea required value={descrizione} onChange={e => setDescrizione(e.target.value)} rows={3} style={inputStyle} /></label>
            <label>UM<input value={unita} onChange={e => setUnita(e.target.value)} style={inputStyle} /></label>
            <label>Quantità *<input required inputMode="decimal" value={quantita} onChange={e => setQuantita(e.target.value)} style={inputStyle} /></label>
            <label>Prezzo unitario *<input required inputMode="decimal" value={prezzo} onChange={e => setPrezzo(e.target.value)} style={inputStyle} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={resetForm}>Annulla</button>
              <button type="submit" disabled={salvataggio}>{salvataggio ? 'Salvataggio...' : 'Salva lavorazione'}</button>
            </div>
          </fieldset>
        </form>
      )}
      {erroreSalvataggio && <p role="alert">{erroreSalvataggio}</p>}
      {successo && <p role="status">{successo}</p>}
      {lettura === 'loading' && <p role="status">Caricamento lavorazioni...</p>}
      {erroreLettura && <p role="alert">{erroreLettura}</p>}
      <button type="button" disabled={lettura === 'loading' || salvataggio || propostaInCorso} onClick={() => setRefresh(v => v + 1)}>Ricarica lavorazioni</button>
      {lettura === 'elenco' && visibili.length === 0 && <p>Nessuna lavorazione presente.</p>}
      {visibili.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead><tr><th scope="col">N.</th><th scope="col">Descrizione</th><th scope="col">UM</th><th scope="col">Quantità</th><th scope="col">Prezzo unitario</th><th scope="col">Delta contratto</th></tr></thead>
            <tbody>{visibili.map(riga => <tr key={riga.numero_riga}>
              <td>{riga.numero_riga}</td><td style={{ whiteSpace: 'pre-wrap' }}>{riga.descrizione}</td><td>{riga.unita_misura || '—'}</td>
              <td>{numeroLavorazione(riga.quantita_delta).toLocaleString('it-IT', { maximumFractionDigits: 20 })}</td>
              <td>{euro(riga.prezzo_unitario)}</td><td>{euro(riga.delta_contratto)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {lettura === 'elenco' && !nonRilette
        ? <p><strong>Totale variante: {euro(totale)}</strong></p>
        : <p>Totale variante da aggiornare.{visibili.length > 0 && <> Somma delle righe visualizzate: {euro(totale)}.</>}</p>}
      {lettura === 'elenco' && nonRilette && <p role="status">La rilettura non include tutte le lavorazioni appena confermate. Sono mantenute visibili le righe restituite dal salvataggio.</p>}
    </section>
  )
}


type EsitoApprovazione = {
  stato: 'approvata'
  numero: number
  importo_delta_approvato: number | string
  approvata_at: string
  riferimento_approvazione: string
}

const erroriApprovazioneRpc: Record<string, string> = {
  P2027: 'Sessione utente non valida.',
  P2028: 'Riferimento approvazione obbligatorio.',
  P2029: 'Variante non disponibile o non autorizzata.',
  P2030: 'La variante non è approvabile.',
  P2031: 'Il contratto di riferimento è cambiato o non è valido.',
  P2032: 'Le lavorazioni della variante non producono un delta valido.',
  P2033: "Conflitto durante l'approvazione. Riprova.",
}

function ApprovazioneVarianteForm({ variante, cantiereId, lavorazioniLette, onApprovata }: {
  variante: Variante
  cantiereId?: string | null
  lavorazioniLette: readonly LavorazioneVariante[] | null
  onApprovata: (esito: EsitoApprovazione) => void
}) {
  const [aperto, setAperto] = useState(false)
  const [riferimento, setRiferimento] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState('')
  const totale = lavorazioniLette?.reduce((somma, riga) => somma + numeroLavorazione(riga.delta_contratto), 0)
  const lavorazioniPronte = !!lavorazioniLette?.length && totale !== undefined && Number.isFinite(totale)
  const totaleFormattato = lavorazioniPronte ? totale!.toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + ' €' : 'Non disponibile'
  const invio = useRef(false)
  const contesto = useRef<object | null>(null)

  useEffect(() => {
    contesto.current = {}
    return () => { contesto.current = null }
  }, [])

  function annulla() {
    setAperto(false)
    setRiferimento('')
    setErrore('')
  }

  async function approva(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invio.current) return
    if (variante.stato !== 'proposta' || !cantiereId || !Number.isInteger(variante.numero) || Number(variante.numero) <= 0) {
      setErrore(erroriApprovazioneRpc.P2030)
      return
    }
    if (!lavorazioniPronte) {
      setErrore('Ricarica le lavorazioni prima di approvare.')
      return
    }
    const riferimentoInviato = riferimento.trim()
    if (!riferimentoInviato) {
      setErrore(erroriApprovazioneRpc.P2028)
      return
    }
    if (!confirm(`Approvare definitivamente la Variante n. ${variante.numero} per ${totaleFormattato}? Lavorazioni: ${lavorazioniLette!.length}. L'approvazione renderà la Variante storica e aggiornerà il valore contrattuale. Continuare?`)) return
    const corrente = contesto.current
    if (!corrente) return
    invio.current = true
    setInCorso(true)
    setErrore('')
    try {
      const { data, error } = await supabase.rpc('approva_variante', {
        p_variante_id: variante.id,
        p_riferimento_approvazione: riferimentoInviato,
      })
      if (contesto.current !== corrente) return
      if (error) {
        setErrore(erroriApprovazioneRpc[error.code] ||
          'Approvazione non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      const esito = Array.isArray(data) && data.length === 1 ? data[0] : null
      const delta = numeroLavorazione(esito?.importo_delta_approvato)
      if (!esito || esito.id !== variante.id || esito.cantiere_id !== cantiereId ||
          esito.numero !== variante.numero || !Number.isInteger(esito.numero) || esito.stato !== 'approvata' ||
          !Number.isFinite(delta) || delta === 0 ||
          typeof esito.approvata_at !== 'string' || !Number.isFinite(Date.parse(esito.approvata_at)) ||
          typeof esito.riferimento_approvazione !== 'string' || !esito.riferimento_approvazione.trim()) {
        setErrore('Risposta di approvazione non verificabile. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      annulla()
      onApprovata({
        stato: 'approvata', numero: esito.numero,
        importo_delta_approvato: esito.importo_delta_approvato,
        approvata_at: esito.approvata_at,
        riferimento_approvazione: esito.riferimento_approvazione,
      })
    } catch {
      if (contesto.current === corrente) {
        setErrore('Approvazione non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invio.current = false
        setInCorso(false)
      }
    }
  }

  if (variante.stato !== 'proposta') return null
  return (
    <div style={{ marginTop: 12 }}>
      {!aperto && <button type="button" onClick={() => { setAperto(true); setErrore('') }}>Approva variante</button>}
      {aperto && <form onSubmit={approva}>
        <fieldset disabled={inCorso} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0' }}>
          <legend>Approva variante</legend>
          <div>
            <p>Variante n. {variante.numero}</p>
            <p>Lavorazioni: {lavorazioniLette?.length ?? 'Non disponibili'}</p>
            <p>Totale variante: {totaleFormattato}</p>
            <p>Riepilogo delle lavorazioni rilette. L’importo approvato sarà ricalcolato dal server.</p>
            {!lavorazioniPronte && <p role="status">Ricarica le lavorazioni prima di approvare.</p>}
          </div>
          <label>Riferimento approvazione *
            <input required value={riferimento} onChange={e => setRiferimento(e.target.value)}
              placeholder="Approvazione cliente del 18/09/2026"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={annulla}>Annulla</button>
            <button type="submit" disabled={inCorso || !lavorazioniPronte || !riferimento.trim()}>{inCorso ? 'Approvazione in corso...' : 'Conferma approvazione'}</button>
          </div>
        </fieldset>
      </form>}
      {errore && <p role="alert">{errore}</p>}
    </div>
  )
}
