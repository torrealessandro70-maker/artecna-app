'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { provenienzaFatturaEconomia } from '../engines/economia/fattureMateriali'
import { elencaPreventiviSorgenteVariante, caricaLavorazioniPreventivoSorgente, type PreventivoSorgenteCandidato } from '../engines/varianti/repositoryPreventiviSorgente'
import { adattaPreventivoAVariante } from '../engines/varianti/adattaPreventivoAVariante'
import type { PropostaVarianteDaPreventivo, PropostaVarianteDaFile, NaturaVariante, AcquisizioneVariante, AnomaliaPropostaVarianteDaFile, SorgenteVariante } from '../engines/varianti/types'
import type { AnomaliaMappingLavorazionePreventivo } from '../engines/varianti/mappaLavorazioniPreventivo'
import { estraiVociVarianteDaFile } from '../engines/varianti/estraiVociVarianteDaFile'
import { adattaFileAVariante } from '../engines/varianti/adattaFileAVariante'
import { confermaPreventivoIntegrativo } from '../engines/varianti/confermaPreventivoIntegrativo'
import { preparaCorrezioneContrattuale } from '../engines/varianti/preparaCorrezioneContrattuale'
import UsaRaccoltaEconomiaInVariante from './UsaRaccoltaEconomiaInVariante'
import { numeroRigaProposta } from '../engines/economia/precheckProposta'
import PrestazioniRapportiniEconomia from './PrestazioniRapportiniEconomia'
import PrezziRapportiniEconomia from './PrezziRapportiniEconomia'
import PrezziMaterialiEconomia from './PrezziMaterialiEconomia'
import { documentoVariantiCliente, vociCliente, type ContestoStampaVarianti, type VarianteCliente } from '../engines/economia/stampaVariantiCliente'
import { operativoPrestazioneAcquisita } from '../engines/economia/prestazioniRapportiniDesktop'
import RaccoltaSorgenteVariante from './RaccoltaSorgenteVariante'
import VarianteFontiMemoryPanel from './VarianteFontiMemoryPanel'
import VariantePreventivoIntegrativoPanel from './VariantePreventivoIntegrativoPanel'

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

function portaAlControllo(elemento: HTMLElement | null) {
  if (!elemento) return
  elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const controllo = elemento.matches('button, input, select, textarea') ? elemento :
    elemento.querySelector<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled])') ?? elemento
  controllo.focus({ preventScroll: true })
}

function GuidaPassoSuccessivo({ stato, conteggio = null, modificabile = false, onCrea, onAcquisisci,
  onContratto, onLavorazioni, onProposta, onApprova }: {
  stato: string | null
  conteggio?: number | null
  modificabile?: boolean
  onCrea?: () => void
  onAcquisisci?: () => void
  onContratto?: () => void
  onLavorazioni?: () => void
  onProposta?: () => void
  onApprova?: () => void
}) {
  const terminale = stato === 'rifiutata' || stato === 'annullata'
  const fase = stato === null ? 1 : stato === 'approvata' ? 6 : stato === 'proposta' ? 5 :
    stato === 'bozza' && conteggio !== null ? conteggio > 0 ? 3 : 2 : null
  const azioni: { testo: string; esegui: (() => void) | undefined }[] = []
  let testo = 'Attendi il caricamento delle lavorazioni per conoscere il passo successivo.'
  if (stato === null) {
    testo = 'Crea una nuova Variante per iniziare.'
    azioni.push({ testo: 'Nuova variante', esegui: onCrea }, { testo: 'Nuova variante da preventivo', esegui: onAcquisisci })
  } else if (stato === 'bozza' && !modificabile) {
    testo = 'Questa Variante non consente modifiche. Verifica lo stato con i controlli esistenti.'
  } else if (stato === 'bozza' && conteggio === 0) {
    testo = 'Scegli cosa vuoi fare con questa Variante.'
    azioni.push({ testo: 'Aggiungi nuovi lavori', esegui: onAcquisisci }, { testo: 'Modifica contratto', esegui: onContratto })
  } else if (stato === 'bozza' && conteggio !== null) {
    testo = 'Controlla lavorazioni, quantità, prezzi e totale prima di proporre la Variante.'
    azioni.push({ testo: 'Vai alle lavorazioni', esegui: onLavorazioni }, { testo: 'Proponi variante', esegui: onProposta })
  } else if (stato === 'proposta') {
    testo = 'La Variante è stata proposta e non è più modificabile.'
    azioni.push({ testo: "Vai all'approvazione", esegui: onApprova })
  } else if (stato === 'approvata') {
    testo = 'Variante approvata.'
    azioni.push({ testo: 'Visualizza lavorazioni', esegui: onLavorazioni })
  } else if (terminale) {
    testo = stato === 'rifiutata' ? 'Variante rifiutata. Il percorso è concluso.' : 'Variante annullata. Il percorso è concluso.'
  } else if (stato !== 'bozza') {
    testo = 'Verifica lo stato della Variante nei controlli esistenti.'
  }
  return <aside aria-label="Passo successivo" style={{ marginTop: 12, marginBottom: 16, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
    <ol aria-label="Percorso Variante" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, listStyle: 'none', padding: 0, margin: '0 0 8px', fontSize: 12 }}>
      {['Crea', 'Acquisisci', 'Verifica', 'Proponi', 'Approva'].map((nome, indice) => {
        const passo = indice + 1
        const statoPasso = fase !== null ? passo < fase ? 'Completato' : passo === fase ? 'Corrente' : 'Da fare' :
          passo === 1 ? 'Completato' : terminale ? 'Interrotto' : 'Da verificare'
        return <li key={nome} aria-current={statoPasso === 'Corrente' ? 'step' : undefined}>
          {passo} {nome} <span>({statoPasso})</span>
        </li>
      })}
    </ol>
    <h5 style={{ margin: '0 0 6px' }}>Passo successivo</h5>
    <p style={{ margin: '0 0 8px' }}>{testo}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {azioni.filter(azione => azione.esegui).map((azione, indice) =>
        <button type="button" key={azione.testo} aria-label={azione.testo} onClick={azione.esegui}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, lineHeight: 1.4,
            background: indice === 0 ? '#334155' : '#fff', color: indice === 0 ? '#fff' : '#334155' }}>
          {azione.testo}
        </button>)}
    </div>
  </aside>
}

type WarningEconomia = { codice: string; campi: string[] }
type CellaEconomiaExcel = { tipo: string; valore: string | null; formula: string | null; formato: string | null; visualizzato: string | null }
type SnapshotEconomiaExcel = { version: 2; template: string; date1904: boolean; fogli: Record<string, { riga_intestazioni: number; intestazioni: Record<string, CellaEconomiaExcel>; righe: Record<string, { celle: Record<string, CellaEconomiaExcel>; warnings: WarningEconomia[] }> }> }
type DettagliEconomiaLocale = {
  version: 1; sorgente: Record<string, string | number>; operativo: Record<string, string | number | null>;
  normalizzazione: { regola: string; quantita: { decimali: 2; origine: 'sorgente' | 'rettifica'; motivazione: string | null }; prezzo_unitario: { decimali: 2; origine: 'sorgente' | 'rettifica'; motivazione: string | null } };
  warnings: { sorgente: WarningEconomia[]; operativo: WarningEconomia[] }
}
type RigaEconomiaLocale = { indice: number; rigaFile: number; tipo: 'manodopera' | 'materiale'; inclusa: boolean; descrizione: string; unitaMisura: string; quantita: string; prezzo: string; note: string; totaleSorgente?: number; dettagli: DettagliEconomiaLocale }
type PropostaEconomiaLocale = { natura: 'lavori_in_economia'; formato: 'excel'; righe: RigaEconomiaLocale[]; warnings: string[]; snapshot: SnapshotEconomiaExcel }
const numeroEconomiaLocale = (s: string): number | undefined => {
  if (!/^[+-]?\d+(?:[.,]\d{1,6})?$/.test(s.trim())) return undefined
  const n = Number(s.trim().replace(',', '.'))
  const canonico = (v: string) => {
    const [intero, decimali = ''] = v.replace(/^[+]/, '').replace(',', '.').split('.')
    const parteIntera = intero.replace(/^(-?)0+(?=\d)/, '$1')
    const frazione = decimali.replace(/0+$/, '')
    return (parteIntera === '-0' && !frazione ? '0' : parteIntera) + (frazione ? '.' + frazione : '')
  }
  return Number.isFinite(n) && Math.abs(n) < 1e12 && canonico(s.trim()) === canonico(String(n)) ? n : undefined
}


// Arrotondamento decimale esplicito (metà lontano da zero), senza toFixed su float.
function normalizzaDecimaleEconomia(testo: string | null, decimali = 2): string | undefined {
  if (testo === null || testo === '') return undefined
  const m = testo.trim().replace(',', '.').match(/^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/)
  if (!m) return undefined
  const potenza = decimali + Number(m[4] ?? 0) - (m[3]?.length ?? 0)
  if (!Number.isSafeInteger(potenza) || Math.abs(potenza) > 400) return undefined
  let n = BigInt(m[2] + (m[3] ?? ''))
  if (potenza >= 0) n *= BigInt(10) ** BigInt(potenza)
  else {
    const divisore = BigInt(10) ** BigInt(-potenza)
    n = n / divisore + (n % divisore * BigInt(2) >= divisore ? BigInt(1) : BigInt(0))
  }
  const cifre = n.toString().padStart(decimali + 1, '0')
  return (m[1] === '-' && n !== BigInt(0) ? '-' : '') + (decimali ? cifre.slice(0, -decimali) + '.' + cifre.slice(-decimali) : cifre)
}
function prodottoEconomia(q: string | undefined, p: string | undefined): string | undefined {
  if (q === undefined || p === undefined) return undefined
  const a = normalizzaDecimaleEconomia(q), b = normalizzaDecimaleEconomia(p)
  if (!a || !b) return undefined
  const n = BigInt(a.replace('.', '')) * BigInt(b.replace('.', ''))
  return normalizzaDecimaleEconomia(n.toString() + 'e-4')
}
const mappaManodoperaEconomia = ['cantiere','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','ore_dichiarate','tariffa_dichiarata','totale_dichiarato','riferimento','note']
const mappaMaterialiEconomia = ['cantiere','codice_variante','data','materiale','um','quantita_dichiarata','prezzo_dichiarato','totale_dichiarato','fornitore','documento','riferimento_rapportino','note']
function warningsOperativiEconomia(r: RigaEconomiaLocale): string[] {
  const op = r.dettagli.operativo, warnings: string[] = []
  if (r.tipo === 'manodopera') {
    if (!op.qualifica) warnings.push('qualifica_mancante')
    if (!op.operaio) warnings.push('operaio_mancante')
    if (op.ora_inizio && op.ora_fine && op.pausa_min !== null) {
      const minuti = (v: string) => Number(v.slice(0,2))*60+Number(v.slice(3))
      const inizio = minuti(String(op.ora_inizio)), fine = minuti(String(op.ora_fine))
      const durata = (fine-inizio+1440)%1440
      const ore = normalizzaDecimaleEconomia(String(Math.max(0,(durata-Number(op.pausa_min))/60)))
      if (normalizzaDecimaleEconomia(r.quantita) !== ore) warnings.push('ore_discordanti')
      if (fine < inizio) warnings.push('passaggio_mezzanotte')
      if (Number(op.pausa_min)>durata || Number(ore)<=0) warnings.push('durata_non_valida')
    } else warnings.push('orari_o_pausa_mancanti')
  }
  if (!op.data) warnings.push('data_mancante')
  const ref = String(op[r.tipo === 'manodopera' ? 'riferimento' : 'riferimento_rapportino'] ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (ref && op.data && ref[3]+'-'+ref[2]+'-'+ref[1] !== op.data) warnings.push('riferimento_data_discordante')
  if (r.totaleSorgente !== undefined && r.prezzo.trim() !== '' && prodottoEconomia(r.quantita,r.prezzo) !== normalizzaDecimaleEconomia(String(r.totaleSorgente))) warnings.push('totale_operativo_diverso_dal_dichiarato')
  return warnings
}
async function leggiTemplateEconomia(file: File): Promise<PropostaEconomiaLocale> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellNF: true })
  const date1904 = !!workbook.Workbook?.WBProps?.date1904
  const snapshot: SnapshotEconomiaExcel = { version: 2, template: 'ARTECNA_Template_Import_Varianti_Extra_v2', date1904, fogli: {} }
  const righe: RigaEconomiaLocale[] = []
  const definizioni = [
    { nome: 'Manodopera economia', tipo: 'manodopera' as const, header: 5, campi: mappaManodoperaEconomia, titoli: ['Cantiere','Codice variante','Data','Operaio','Qualifica','Ora inizio','Ora fine','Pausa min','Ore','Tariffa €/h','Totale €','Riferimento','Note'] },
    { nome: 'Materiali economia', tipo: 'materiale' as const, header: 4, campi: mappaMaterialiEconomia, titoli: ['Cantiere','Codice variante','Data','Materiale','UM','Quantità','Prezzo unitario €','Totale €','Fornitore','Documento','Riferimento rapportino','Note'] },
  ]
  const copiaCella = (c: import('xlsx').CellObject | undefined): CellaEconomiaExcel => ({ tipo: c?.t ?? 'z', valore: c?.v === undefined || c.v === null ? null : String(c.v), formula: c?.f ?? null, formato: c?.z === undefined ? null : String(c.z), visualizzato: c?.w ?? (c?.v === undefined ? null : XLSX.utils.format_cell(c)) })
  for (const d of definizioni) {
    const sheet = workbook.Sheets[d.nome]
    if (!sheet?.['!ref']) throw new Error('Foglio ufficiale mancante: ' + d.nome)
    const colonne = d.campi.map((_, c) => XLSX.utils.encode_col(c))
    const intestazioni: Record<string, CellaEconomiaExcel> = {}
    d.titoli.forEach((titolo, c) => {
      const address = colonne[c] + d.header
      if (String(sheet[address]?.v ?? '').trim() !== titolo) throw new Error('Intestazione non conforme al template: ' + d.nome + '!' + address)
      intestazioni[address] = copiaCella(sheet[address])
    })
    const foglio = { riga_intestazioni: d.header, intestazioni, righe: {} as SnapshotEconomiaExcel['fogli'][string]['righe'] }
    snapshot.fogli[d.nome] = foglio
    const ultima = XLSX.utils.decode_range(sheet['!ref']).e.r + 1
    for (let r = d.header + 1; r <= ultima; r++) {
      const celle = Object.fromEntries(colonne.map(c => [c + r, copiaCella(sheet[c + r])]))
      const warnings: WarningEconomia[] = []
      foglio.righe[String(r)] = { celle, warnings }
      const compilata = colonne.some(c => { const cell = sheet[c + r]; return cell && !cell.f && cell.v !== undefined && cell.v !== null && cell.v !== '' })
      if (!compilata) continue
      const get = (campo: string) => celle[colonne[d.campi.indexOf(campo)] + r]
      const valore = (campo: string) => get(campo)?.valore ?? null
      const testo = (campo: string) => valore(campo)?.trim() || null
      const numero = (campo: string) => get(campo)?.tipo === 'n' ? normalizzaDecimaleEconomia(valore(campo)) : undefined
      const warn = (codice: string, ...campi: string[]) => warnings.push({ codice, campi })
      const dataRaw = valore('data')
      const dataExcel = dataRaw !== null && get('data').tipo === 'n' ? XLSX.SSF.parse_date_code(Number(dataRaw), { date1904 }) : null
      const data = dataExcel ? String(dataExcel.y).padStart(4,'0') + '-' + String(dataExcel.m).padStart(2,'0') + '-' + String(dataExcel.d).padStart(2,'0') : null
      if (!data) warn('data_mancante_o_non_valida','data')
      const orario = (campo: string) => {
        const raw = valore(campo)
        if (raw === null || get(campo).tipo !== 'n' || !Number.isFinite(Number(raw))) return null
        const minuti = Number(normalizzaDecimaleEconomia(String(((Number(raw) % 1 + 1) % 1) * 1440), 0)) % 1440
        return String(Math.floor(minuti / 60)).padStart(2,'0') + ':' + String(minuti % 60).padStart(2,'0')
      }
      const q = numero(d.tipo === 'manodopera' ? 'ore_dichiarate' : 'quantita_dichiarata') ?? ''
      const p = numero(d.tipo === 'manodopera' ? 'tariffa_dichiarata' : 'prezzo_dichiarato') ?? ''
      const totale = numero('totale_dichiarato')
      const operativo: Record<string, string | number | null> = { cantiere_dichiarato: testo('cantiere'), codice_variante: testo('codice_variante'), data }
      if (d.tipo === 'manodopera') {
        Object.assign(operativo, { operaio: testo('operaio'), qualifica: testo('qualifica'), ora_inizio: orario('ora_inizio'), ora_fine: orario('ora_fine'), pausa_min: valore('pausa_min') === null ? null : Number(normalizzaDecimaleEconomia(valore('pausa_min'),0)), riferimento: testo('riferimento') })
        if (!operativo.qualifica) warn('qualifica_mancante','qualifica')
        if (!operativo.operaio) warn('operaio_mancante','operaio')
        if (operativo.ora_inizio && operativo.ora_fine && operativo.pausa_min !== null) {
          const min = (v: string) => Number(v.slice(0,2))*60 + Number(v.slice(3))
          const inizio = min(String(operativo.ora_inizio)), fine = min(String(operativo.ora_fine))
          const durata = (fine-inizio+1440)%1440
          const ore = normalizzaDecimaleEconomia(String(Math.max(0,(durata-Number(operativo.pausa_min))/60)))
          if (q !== ore) warn('ore_discordanti','ore_dichiarate')
          if (fine < inizio) warn('passaggio_mezzanotte','ora_fine')
          if (Number(operativo.pausa_min)>durata || Number(ore)<=0) warn('durata_non_valida','pausa_min')
        } else warn('orari_o_pausa_mancanti','ora_inizio','ora_fine','pausa_min')
      } else {
        Object.assign(operativo, { fornitore: testo('fornitore'), documento: testo('documento'), riferimento_rapportino: testo('riferimento_rapportino') })
        if (!testo('materiale')) warn('materiale_mancante','materiale')
      }
      const ref = testo(d.tipo === 'manodopera' ? 'riferimento' : 'riferimento_rapportino')?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (ref && data && ref[3]+'-'+ref[2]+'-'+ref[1] !== data) warn('riferimento_data_discordante','data','riferimento')
      if (totale !== undefined && q && p && prodottoEconomia(q,p) !== totale) warn('totale_discordante','totale_dichiarato')
      if (totale === undefined && get('totale_dichiarato').formula) warn('risultato_formula_mancante','totale_dichiarato')
      for (const campo of d.campi) if (get(campo).tipo === 'e') warn('errore_excel',campo)
      if (!q || Number(q)<=0) warn('quantita_non_valida',d.tipo === 'manodopera' ? 'ore_dichiarate' : 'quantita_dichiarata')
      if (p && Number(p)<0) warn('prezzo_non_valido',d.tipo === 'manodopera' ? 'tariffa_dichiarata' : 'prezzo_dichiarato')
      const dettagli: DettagliEconomiaLocale = {
        version: 1,
        sorgente: { foglio_sorgente: d.nome, riga_sorgente: r, ...Object.fromEntries(d.campi.map((campo,c) => [campo,colonne[c]+r])) },
        operativo,
        normalizzazione: { regola: 'artecna_template_extra_v2_precisione_v1', quantita: { decimali: 2, origine: 'sorgente', motivazione: null }, prezzo_unitario: { decimali: 2, origine: 'sorgente', motivazione: null } },
        warnings: { sorgente: structuredClone(warnings), operativo: [] },
      }
      righe.push({ indice: 2*(r-1)+(d.tipo === 'materiale' ? 1 : 0), rigaFile: r, tipo: d.tipo, inclusa: true,
        descrizione: d.tipo === 'manodopera' ? (testo('operaio') ? 'Manodopera — '+testo('operaio') : '') : testo('materiale') ?? '',
        unitaMisura: d.tipo === 'manodopera' ? 'h' : testo('um') ?? '', quantita: q, prezzo: p, note: valore('note') ?? '',
        totaleSorgente: totale === undefined ? undefined : Number(totale), dettagli })
    }
  }
  return { natura: 'lavori_in_economia', formato: 'excel', righe, warnings: [], snapshot }
}

function AreaAcquisizioneFile({ bloccata, onFile }: { bloccata: boolean; onFile: (file: File) => void }) {
  const [drag, setDrag] = useState(false)
  const [zonaFocalizzata, setZonaFocalizzata] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const riceviFile = (file: File) => { if (!bloccata) onFile(file) }
  return <>
    <div tabIndex={0} aria-label="Area importazione file" aria-busy={bloccata}
      onClick={e => e.currentTarget.focus()}
      onFocus={() => setZonaFocalizzata(true)}
      onBlur={() => setZonaFocalizzata(false)}
      onDragEnter={e => { e.preventDefault(); if (!bloccata) setDrag(true) }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = bloccata ? 'none' : 'copy'; if (!bloccata) setDrag(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false) }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) riceviFile(f) }}
      onPaste={e => {
        if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return
        const f = e.clipboardData.files[0] ?? Array.from(e.clipboardData.items)
          .filter(i => i.kind === 'file').map(i => i.getAsFile()).find((f): f is File => f !== null)
        if (!f) return
        e.preventDefault(); e.stopPropagation(); riceviFile(f)
      }}
      style={{ marginTop: 16, padding: 16, border: drag || zonaFocalizzata ? '2px solid #2563eb' : '2px dashed #94a3b8', borderRadius: 12, background: drag || zonaFocalizzata ? '#eff6ff' : '#f8fafc' }}>
      <p>Trascina qui un file</p>
      <p>oppure copia un file e premi Ctrl+V in quest'area</p>
    </div>

      <button type="button" disabled={bloccata} onClick={() => input.current?.click()}>Seleziona file</button>
      <input ref={input} type="file" hidden disabled={bloccata} accept=".xls,.xlsx,.pdf,.jpg,.jpeg,.png,.webp"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) riceviFile(f) }} />
  </>
}

type RaccoltaImportazioneEconomia = { id: string; cantiere_id: string; numero: number; revisione: number; stato: 'bozza' | 'chiusa' }
function leggiIdentitaImportazioneEconomia(v: unknown, cantiereId: string, id?: string): RaccoltaImportazioneEconomia {
  if (!recordSorgente(v) || !idSorgenteValido(v.id) || (id !== undefined && v.id !== id) ||
      v.cantiere_id !== cantiereId || !Number.isSafeInteger(v.numero) || Number(v.numero) <= 0 ||
      !Number.isSafeInteger(v.revisione) || Number(v.revisione) < 0 || (v.stato !== 'bozza' && v.stato !== 'chiusa'))
    throw new Error('Risposta Economia non verificabile.')
  return { id: v.id, cantiere_id: cantiereId, numero: Number(v.numero), revisione: Number(v.revisione), stato: v.stato }
}

type RaccoltaConsultazioneEconomia = RaccoltaImportazioneEconomia & { titolo: string; data: string; totale: number | null; nonValorizzate: number }

// Consultazione autenticata Desktop: il testo attuale non sostituisce lo snapshot acquisito.
async function arricchisciOriginiRapportino(sorgenti: Record<string, unknown>[], cantiereId: string) {
  for (const sorgente of sorgenti) {
    // L'elenco RPC contiene solo metadati: leggere il dettaglio autorizzato
    // prima di cercare i riferimenti Rapportino nello snapshot Economia.
    if (sorgente.tipo === 'raccolta_economia' && !recordSorgente(sorgente.snapshot)) {
      const { data, error } = await supabase.rpc('leggi_sorgente_variante', { p_sorgente_id: sorgente.id })
      const completa = singolaRigaSorgente(data)
      if (error || !recordSorgente(completa) || completa.id !== sorgente.id ||
          completa.variante_id !== sorgente.variante_id || completa.tipo !== 'raccolta_economia' ||
          !recordSorgente(completa.snapshot) || completa.snapshot.cantiere_id !== cantiereId ||
          !Array.isArray(completa.snapshot.registrazioni)) throw new Error('Dettaglio sorgente Economia non verificabile.')
      Object.assign(sorgente, completa)
    }
    if (!recordSorgente(sorgente.snapshot) || !Array.isArray(sorgente.snapshot.registrazioni)) continue
    for (const r of sorgente.snapshot.registrazioni) {
      if (!recordSorgente(r) || r.origine !== 'rapportino' || !recordSorgente(r.dettagli_analitici) || !recordSorgente(r.dettagli_analitici.rapportino)) continue
      const origine = r.dettagli_analitici.rapportino
      if (origine.cantiere_id !== cantiereId || typeof origine.rapportino_id !== 'string' || typeof origine.operaio_id !== 'string') continue
      const { data: rapportino, error } = await supabase.from('rapportini').select('id,cantiere_id,data,note').eq('id', origine.rapportino_id).eq('cantiere_id', cantiereId).maybeSingle()
      const { data: operaio, error: erroreNome } = await supabase.from('operai').select('nome').eq('id', origine.operaio_id).maybeSingle()
      r.consultazione_rapportino = { descrizione: !error && rapportino && rapportino.data === origine.data && typeof rapportino.note === 'string' ? rapportino.note : undefined,
        operaio: !erroreNome && typeof operaio?.nome === 'string' ? operaio.nome : 'Operaio non disponibile' }
    }
  }
}

type RigaConsultazioneEconomia = { id: string; ordine: number; tipo: 'generica' | 'manodopera' | 'materiale'; descrizione: string; um: string; quantita: number; prezzo: number | null; prezzoOrigine: number | null; totale: number | null; note: string | null; origine: string; operativo: Record<string, unknown>; provenienzaFattura: string | null }
type DettaglioConsultazioneEconomia = { raccolta: RaccoltaConsultazioneEconomia; righe: RigaConsultazioneEconomia[] }

function numeroConsultazioneEconomia(v: unknown, nullable = false): number | null {
  if (nullable && v === null) return null
  if ((typeof v !== 'number' && typeof v !== 'string') || (typeof v === 'string' && !v.trim()) || !Number.isFinite(Number(v)) || Number(v) < 0)
    throw new Error('Valore numerico Economia non verificabile.')
  return Number(v)
}
function raccoltaConsultazioneEconomia(v: unknown, cantiereId: string, riepilogo?: Record<string, unknown>): RaccoltaConsultazioneEconomia {
  const identita = leggiIdentitaImportazioneEconomia(v, cantiereId)
  if (!recordSorgente(v) || typeof v.titolo !== 'string' || !v.titolo.trim() || typeof v.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.data))
    throw new Error('Raccolta Economia non verificabile.')
  const r = riepilogo ?? v
  const nonValorizzate = numeroConsultazioneEconomia(r.righe_non_valorizzate)
  if (nonValorizzate === null || !Number.isSafeInteger(nonValorizzate)) throw new Error('Conteggio Economia non verificabile.')
  return { ...identita, titolo: v.titolo, data: v.data, totale: numeroConsultazioneEconomia(r.totale, true), nonValorizzate }
}
function dettaglioConsultazioneEconomia(v: unknown, cantiereId: string, raccoltaId: string): DettaglioConsultazioneEconomia {
  if (!recordSorgente(v) || !Array.isArray(v.righe)) throw new Error('Dettaglio Economia non verificabile.')
  const raccolta = raccoltaConsultazioneEconomia(v.raccolta, cantiereId, v)
  if (raccolta.id !== raccoltaId) throw new Error('Raccolta Economia diversa da quella richiesta.')
  const ids = new Set<string>(), ordini = new Set<number>()
  const righe = v.righe.map((r): RigaConsultazioneEconomia => {
    if (!recordSorgente(r) || !idSorgenteValido(r.id) || r.raccolta_id !== raccoltaId || !Number.isSafeInteger(r.ordine) || Number(r.ordine) <= 0 ||
        !['generica','manodopera','materiale'].includes(String(r.tipo_riga)) || typeof r.descrizione !== 'string' || !r.descrizione.trim() ||
        typeof r.unita_misura !== 'string' || !r.unita_misura.trim() || (r.note !== null && typeof r.note !== 'string')) throw new Error('Riga Economia non verificabile.')
    if (ids.has(r.id) || ordini.has(Number(r.ordine))) throw new Error('Righe Economia duplicate.')
    ids.add(r.id); ordini.add(Number(r.ordine))
    let operativo: Record<string, unknown> = {}
    if (r.origine === 'rapportino') {
      operativo = operativoPrestazioneAcquisita(r, cantiereId)
    } else if (r.tipo_riga !== 'generica') {
      if (!recordSorgente(r.dettagli_analitici) || r.dettagli_analitici.version !== 1 || !recordSorgente(r.dettagli_analitici.operativo)) throw new Error('Dettagli analitici Economia non verificabili.')
      operativo = r.dettagli_analitici.operativo
      const campi = r.tipo_riga === 'manodopera' ? ['data','operaio','qualifica','ora_inizio','ora_fine','riferimento'] : ['data','fornitore','documento','riferimento_rapportino']
      if (campi.some(c => operativo[c] !== null && typeof operativo[c] !== 'string') || (r.tipo_riga === 'manodopera' && operativo.pausa_min !== null && (typeof operativo.pausa_min !== 'number' || !Number.isSafeInteger(operativo.pausa_min) || operativo.pausa_min < 0))) throw new Error('Dati operativi Economia non verificabili.')
    }
    const quantita = numeroRigaProposta(r.quantita) ?? NaN
    const prezzo = numeroRigaProposta(r.prezzo_unitario), totale = numeroRigaProposta(r.totale)
    return { id: r.id, ordine: Number(r.ordine), tipo: r.tipo_riga as RigaConsultazioneEconomia['tipo'], descrizione: r.descrizione, um: r.unita_misura, quantita, prezzo, prezzoOrigine: numeroRigaProposta(r.prezzo_unitario_origine), totale, note: r.note as string | null, origine: String(r.origine), operativo, provenienzaFattura: r.origine === 'fattura_fornitore' ? provenienzaFatturaEconomia(r) : null }
  }).sort((a,b) => a.ordine-b.ordine)
  if (raccolta.nonValorizzate !== righe.filter(r => r.prezzo === null).length) throw new Error('Riepilogo Economia non coerente.')
  return { raccolta, righe }
}
const testoConsultazioneEconomia = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? 'Non indicato' : v === null || v === undefined || v === '' ? 'Non indicato' : String(v)
const dataConsultazioneEconomia = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : testoConsultazioneEconomia(v)
const importoConsultazioneEconomia = (v: number | null) => v === null ? 'Non valorizzato' : !Number.isFinite(v) ? 'Non valido' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

function RinominaVarianteBozza({ id, stato, titoloAttuale, onRinominata }: {
  id: string; stato: string; titoloAttuale: string; onRinominata: (titolo: string) => void
}) {
  const [aperto, setAperto] = useState(false)
  const [titolo, setTitolo] = useState(titoloAttuale)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const inCorso = useRef(false)
  const contesto = useRef({ id, stato })
  contesto.current = { id, stato }
  if (stato !== 'bozza') return null
  async function salva() {
    if (inCorso.current || contesto.current.stato !== 'bozza') return
    const nuovo = titolo.trim()
    if (!nuovo) { setErrore('Il titolo non può essere vuoto.'); return }
    const target = id
    inCorso.current = true; setInvio(true); setErrore('')
    try {
      const { data, error } = await supabase.rpc('rinomina_variante_bozza', { p_variante_id: target, p_titolo: nuovo })
      if (error) throw new Error('Rinomina arrestata. Nessun retry automatico.')
      if (!data || data.id !== target || data.stato !== 'bozza' || data.titolo !== nuovo) throw new Error('Esito della rinomina non confermato.')
      if (contesto.current.id === target && contesto.current.stato === 'bozza') { setAperto(false); onRinominata(data.titolo) }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Rinomina arrestata. Nessun retry automatico.')
      // Dopo un errore non consentire un secondo invio da questo dialogo.
      return
    } finally { setInvio(false) }
  }
  return <div>
    {!aperto ? <button type="button" onClick={() => { setTitolo(titoloAttuale); setErrore(''); inCorso.current = false; setAperto(true) }}>Rinomina</button> : <div role="dialog" aria-label="Rinomina variante">
      <label>Titolo variante <input value={titolo} disabled={invio || !!errore && inCorso.current} onChange={e => setTitolo(e.target.value)} /></label>
      <button type="button" disabled={invio || inCorso.current} onClick={salva}>Salva</button>
      <button type="button" disabled={invio} onClick={() => setAperto(false)}>Annulla</button>
    </div>}
    {errore && <p role="alert">{errore}</p>}
  </div>
}

function EliminaBozzaVuota({ tipo, id, contestoId, aggiornamento, bloccato, onEliminata }: {
  tipo: 'raccolta' | 'variante'; id: string; contestoId: string; aggiornamento: string
  bloccato: boolean; onEliminata: () => void | Promise<void>
}) {
  const [impronta, setImpronta] = useState<string | null>(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const occupato = useRef(false), arrestato = useRef(false), contesto = useRef<object | null>(null)
  useEffect(() => {
    const corrente = {}
    contesto.current = corrente; occupato.current = false; arrestato.current = false
    setImpronta(null); setErrore(''); setInvio(false)
    return () => { contesto.current = null }
  }, [tipo, id, contestoId])
  useEffect(() => {
    let attivo = true
    setImpronta(null)
    if (bloccato || occupato.current || arrestato.current) return
    async function verifica() {
      try {
        const { data, error } = await supabase.rpc('verifica_bozza_vuota', { p_tipo: tipo, p_id: id })
        if (!attivo) return
        if (error || !recordSorgente(data) || data.versione_contratto !== 1 || data.tipo !== tipo || data.id !== id ||
            typeof data.eliminabile !== 'boolean' ||
            (data.eliminabile ? data.motivo !== 'bozza_vuota' || typeof data.impronta !== 'string' || !/^[0-9a-f]{64}$/.test(data.impronta)
              : data.motivo !== 'dati_da_preservare' || data.impronta !== null)) throw new Error('Verifica non confermata.')
        if (data.eliminabile) setImpronta(data.impronta as string)
      } catch {
        if (attivo) { arrestato.current = true; setErrore('Verifica eliminazione non confermata. Operazione arrestata; nessun retry automatico.') }
      }
    }
    void verifica()
    return () => { attivo = false }
  }, [tipo, id, contestoId, aggiornamento, bloccato])
  async function elimina() {
    if (!impronta || bloccato || occupato.current || arrestato.current) return
    occupato.current = true
    if (!window.confirm('Eliminare definitivamente questa bozza vuota?')) { occupato.current = false; return }
    const corrente = contesto.current
    if (!corrente) { occupato.current = false; return }
    setInvio(true)
    try {
      const { data, error } = await supabase.rpc('elimina_bozza_vuota', { p_tipo: tipo, p_id: id, p_impronta_attesa: impronta })
      if (contesto.current !== corrente) return
      if (error) {
        const code = error.code
        throw new Error(code === 'BD409' ? 'Bozza cambiata o conflitto: eliminazione arrestata.'
          : code === 'BD412' ? 'La bozza contiene dati da preservare: eliminazione arrestata.'
          : code === '42501' ? 'Eliminazione non autorizzata o bozza non disponibile.'
          : 'Eliminazione non confermata. Verifica lo stato prima di qualsiasi altra azione.')
      }
      if (!recordSorgente(data) || data.versione_contratto !== 1 || data.tipo !== tipo || data.id !== id || data.eliminata !== true) {
        throw new Error('Eliminazione non confermata. Verifica lo stato prima di qualsiasi altra azione.')
      }
      arrestato.current = true; setImpronta(null)
      await onEliminata()
    } catch (e) {
      if (contesto.current === corrente) {
        arrestato.current = true; setImpronta(null)
        setErrore((e instanceof Error && /^Bozza cambiata|^La bozza contiene|^Eliminazione non/.test(e.message)
          ? e.message : 'Eliminazione o rilettura non confermata. Operazione arrestata.') + ' Nessun retry automatico.')
      }
    } finally {
      if (contesto.current === corrente) { occupato.current = false; setInvio(false) }
    }
  }
  return <>
    {impronta && !bloccato && <button type="button" disabled={invio} onClick={() => void elimina()}>
      {tipo === 'raccolta' ? 'Elimina raccolta' : 'Elimina bozza'}
    </button>}
    {invio && <p role="status">Eliminazione in corso...</p>}
    {errore && <p role="alert">{errore}</p>}
  </>
}

function RaccolteEconomiaRegistrate({ cantiereId, aggiornamento, varianti, elencoPronto, onApriVariante, onCreata, onInvio, operazioneInCorso = false, operativo = false, titoloSuggerito, variantiInfo = [] }: {
  cantiereId: string; aggiornamento: number; varianti: readonly string[]; elencoPronto: boolean
  onApriVariante: (id: string) => void
  onCreata?: () => void; onInvio?: (busy: boolean) => void; operazioneInCorso?: boolean; operativo?: boolean; titoloSuggerito?: string | null
  variantiInfo?: readonly { id: string; titolo: string | null; stato: string }[]
}) {
  const [elenco, setElenco] = useState<RaccoltaConsultazioneEconomia[]>([])
  const [caricamentoElenco, setCaricamentoElenco] = useState(true)
  const [erroreElenco, setErroreElenco] = useState('')
  const [rilettura, setRilettura] = useState(0)
  const [apertaId, setApertaId] = useState<string | null>(null)
  const [dettaglio, setDettaglio] = useState<DettaglioConsultazioneEconomia | null>(null)
  const [caricamentoDettaglio, setCaricamentoDettaglio] = useState(false)
  const [erroreDettaglio, setErroreDettaglio] = useState('')
  const [letturaDettaglio, setLetturaDettaglio] = useState(0)
  const [esitoValorizzazione, setEsitoValorizzazione] = useState<{ raccoltaId: string; messaggio: string } | null>(null)
  const [valorizzazioneInCorso, setValorizzazioneInCorso] = useState(false)
  const [confermaCreazione, setConfermaCreazione] = useState(false)
  const [creazioneInCorso, setCreazioneInCorso] = useState(false)
  const [erroreCreazione, setErroreCreazione] = useState('')
  const [messaggioCreazione, setMessaggioCreazione] = useState('')
  const [titoloCreazione, setTitoloCreazione] = useState('Lavori in economia — Rapportini')
  const creazioneBloccata = useRef(false), creazioneAttiva = useRef(true)
  useEffect(() => {
    creazioneAttiva.current = true
    return () => { creazioneAttiva.current = false }
  }, [])
  async function creaBozzaRapportini() {
    if (!onCreata || !confermaCreazione || creazioneBloccata.current || operazioneInCorso
      || caricamentoElenco || erroreElenco || !titoloCreazione.trim()) return
    creazioneBloccata.current = true
    setConfermaCreazione(false); setCreazioneInCorso(true); setErroreCreazione('')
    onInvio?.(true)
    try {
      const d = new Date()
      const dataLocale = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const { data, error } = await supabase.rpc('crea_raccolta_economia', {
        p_cantiere_id: cantiereId, p_titolo: titoloCreazione.trim(), p_data: dataLocale, p_note: null,
      })
      if (!creazioneAttiva.current) return
      if (error) throw new Error('Creazione non confermata.')
      const raccolta = leggiIdentitaImportazioneEconomia(data, cantiereId)
      if (raccolta.stato !== 'bozza' || raccolta.revisione !== 0) throw new Error('Bozza non verificabile.')
      setMessaggioCreazione(`Raccolta n. ${raccolta.numero} creata in bozza. Rilettura delle prestazioni in corso.`)
      onCreata()
      creazioneBloccata.current = false
    } catch {
      if (creazioneAttiva.current) {
        setErroreCreazione('Creazione non confermata. Rileggi le raccolte e verifica prima di qualsiasi nuova creazione; nessun retry automatico.')
        setRilettura(v => v + 1)
      }
    } finally {
      if (creazioneAttiva.current) { setCreazioneInCorso(false); onInvio?.(false) }
    }
  }
  const tokenElenco = useRef(0), tokenDettaglio = useRef(0)
  const cantiereCorrente = useRef(cantiereId)
  cantiereCorrente.current = cantiereId
  useEffect(() => {
    setElenco([]); setApertaId(null); setDettaglio(null); setErroreDettaglio(''); setCaricamentoDettaglio(false)
    tokenDettaglio.current += 1
    return () => { tokenElenco.current += 1; tokenDettaglio.current += 1 }
  }, [cantiereId])
  useEffect(() => {
    const token = ++tokenElenco.current
    setCaricamentoElenco(true); setErroreElenco('')
    async function carica() {
      try {
        const { data, error } = await supabase.rpc('leggi_raccolte_economia_cliente', { p_cantiere_id: cantiereId })
        if (token !== tokenElenco.current || cantiereCorrente.current !== cantiereId) return
        if (error || !Array.isArray(data)) throw new Error('Lettura elenco non disponibile.')
        const raccolte = data.map(v => raccoltaConsultazioneEconomia(v, cantiereId))
        if (new Set(raccolte.map(r => r.id)).size !== raccolte.length) throw new Error('Elenco Economia non verificabile.')
        setElenco(raccolte)
      } catch {
        if (token === tokenElenco.current && cantiereCorrente.current === cantiereId) setErroreElenco('Impossibile leggere le raccolte Economia. Riprova la lettura.')
      } finally {
        if (token === tokenElenco.current && cantiereCorrente.current === cantiereId) setCaricamentoElenco(false)
      }
    }
    void carica()
    return () => { tokenElenco.current += 1 }
  }, [cantiereId, aggiornamento, rilettura])
  async function apri(id: string, conservaDettaglio = false) {
    const token = ++tokenDettaglio.current
    setApertaId(id); if (!conservaDettaglio) setDettaglio(null); setErroreDettaglio(''); setCaricamentoDettaglio(true)
    try {
      const { data, error } = await supabase.rpc('leggi_raccolta_economia_cliente', { p_raccolta_id: id })
      if (token !== tokenDettaglio.current || cantiereCorrente.current !== cantiereId) return
      if (error) throw new Error('Lettura dettaglio non disponibile.')
      const lettura = dettaglioConsultazioneEconomia(data, cantiereId, id)
      const operai = [...new Set(lettura.righe.filter(r => r.origine === 'rapportino').map(r => r.operativo.operaio).filter((v): v is string => typeof v === 'string'))]
      if (operai.length) {
        const { data: nomi, error: erroreNomi } = await supabase.from('operai').select('id,nome').in('id', operai)
        if (token !== tokenDettaglio.current || cantiereCorrente.current !== cantiereId) return
        lettura.righe.forEach(r => { if (r.origine === 'rapportino') r.operativo.operaio = !erroreNomi && Array.isArray(nomi) ? nomi.find(o => o.id === r.operativo.operaio)?.nome ?? 'Operaio non disponibile' : 'Operaio non disponibile' })
      }
      for (const r of lettura.righe.filter(r => r.origine === 'rapportino')) {
        const { data: originale, error: erroreOriginale } = await supabase.from('rapportini').select('note,data').eq('id', r.operativo.riferimento).eq('cantiere_id', cantiereId).maybeSingle()
        if (token !== tokenDettaglio.current || cantiereCorrente.current !== cantiereId) return
        if (!erroreOriginale && originale && originale.data === r.operativo.data && typeof originale.note === 'string' && originale.note.trim()) {
          r.descrizione = originale.note
          r.note = [r.note, 'Descrizione: testo attuale del Rapportino'].filter(Boolean).join(' — ')
        }
      }
      setDettaglio(lettura)
      setLetturaDettaglio(v => v + 1)
      setElenco(e => e.map(r => r.id === id ? lettura.raccolta : r))
    } catch {
      if (token === tokenDettaglio.current && cantiereCorrente.current === cantiereId) setErroreDettaglio('Impossibile leggere la raccolta Economia. Riprova la lettura.')
    } finally {
      if (token === tokenDettaglio.current && cantiereCorrente.current === cantiereId) setCaricamentoDettaglio(false)
    }
  }
  const aggiornamentoDettaglio = useRef(aggiornamento)
  useEffect(() => {
    if (aggiornamentoDettaglio.current === aggiornamento) return
    aggiornamentoDettaglio.current = aggiornamento
    if (apertaId) void apri(apertaId, true)
  }, [aggiornamento])
  const riepilogo = (r: RaccoltaConsultazioneEconomia) => <>
    <h5>Raccolta n. {r.numero} — {r.titolo}</h5>
    <p>{r.stato === 'bozza' ? 'Bozza' : 'Chiusa'} · {dataConsultazioneEconomia(r.data)} · Revisione {r.revisione}</p>
    <p>Totale{r.nonValorizzate > 0 ? ' parziale' : ''}: {r.totale === null ? 'Non valorizzato' : importoConsultazioneEconomia(r.totale)} · Righe non valorizzate: {r.nonValorizzate}</p>
  </>
  const tabella = (tipo: RigaConsultazioneEconomia['tipo'], titolo: string, colonne: string[], celle: (r: RigaConsultazioneEconomia) => ReactNode[]) => {
    const righe = dettaglio?.righe.filter(r => r.tipo === tipo) ?? []
    if (tipo === 'generica' && !righe.length) return null
    return <section aria-label={titolo}><h5>{titolo} — {righe.length} registrazioni</h5>
      {!righe.length ? <p>Nessuna registrazione.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr>{colonne.map(c => <th scope="col" key={c} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #cbd5e1' }}>{c}</th>)}{tipo === 'materiale' && <th scope="col">Prezzo cliente</th>}</tr></thead>
        <tbody>{righe.map(r => <tr key={r.id} id={`economia-${dettaglio?.raccolta.id}-${r.id}`} tabIndex={-1}>{celle(r).map((v,i) => <td key={i} style={{ padding: 8, verticalAlign: 'top', whiteSpace: 'pre-wrap', borderBottom: '1px solid #e2e8f0' }}>{v}</td>)}{tipo === 'materiale' && dettaglio && <td style={{ padding: 8, minWidth: 180 }}><PrezziMaterialiEconomia key={`${r.id}:${dettaglio.raccolta.revisione}:${letturaDettaglio}`} raccolta={dettaglio.raccolta} righe={[r]} bloccato={valorizzazioneInCorso || operazioneInCorso || creazioneInCorso || caricamentoDettaglio} onInvio={busy => { setValorizzazioneInCorso(busy); onInvio?.(busy) }} onRileggi={async () => { setRilettura(v => v + 1); await apri(dettaglio.raccolta.id, true) }} /></td>}</tr>)}</tbody>
      </table></div>}
    </section>
  }
  const numero = (v: number) => Number.isFinite(v) ? v.toLocaleString('it-IT', { maximumFractionDigits: 6 }) : 'Non valido'
  return <section aria-label="Lavori in economia registrati" style={{ marginTop: 16 }}>
    <h4>LAVORI IN ECONOMIA REGISTRATI</h4>
    {onCreata && <div>
      <button type="button" disabled={caricamentoElenco || Boolean(erroreElenco) || operazioneInCorso || creazioneInCorso || creazioneBloccata.current}
        onClick={() => setConfermaCreazione(true)}>Crea nuova raccolta</button>
      {confermaCreazione && <div>
        <p>Crea una raccolta vuota in bozza per questo cantiere. Nessuna prestazione viene acquisita in questa operazione.</p>
        <label>Titolo raccolta<input value={titoloCreazione} disabled={creazioneInCorso} onChange={e => setTitoloCreazione(e.target.value)} /></label>
        {titoloSuggerito && <p>Titolo suggerito: {titoloSuggerito} <button type="button" disabled={creazioneInCorso} onClick={() => setTitoloCreazione(titoloSuggerito)}>Usa titolo suggerito</button></p>}
        <button type="button" disabled={creazioneInCorso || operazioneInCorso || !titoloCreazione.trim()} onClick={() => void creaBozzaRapportini()}>Conferma creazione raccolta</button>
        <button type="button" disabled={creazioneInCorso} onClick={() => setConfermaCreazione(false)}>Annulla creazione</button>
      </div>}
      {creazioneInCorso && <p role="status">Creazione raccolta in corso...</p>}
      {erroreCreazione && <p role="alert">{erroreCreazione}</p>}
      {messaggioCreazione && <p role="status">{messaggioCreazione}</p>}
    </div>}
    {apertaId ? <>
      <button type="button" disabled={valorizzazioneInCorso} onClick={() => { tokenDettaglio.current += 1; setApertaId(null); setDettaglio(null); setErroreDettaglio(''); setCaricamentoDettaglio(false) }}>Torna all'elenco</button>
      {caricamentoDettaglio && <p role="status">Caricamento raccolta Economia...</p>}
      {erroreDettaglio && <div role="alert"><p>{erroreDettaglio}</p><button type="button" onClick={() => void apri(apertaId)}>Riprova</button></div>}
      {dettaglio && <>
        {riepilogo(dettaglio.raccolta)}
        <p><strong>{dettaglio.righe.filter(r => r.tipo === 'manodopera').reduce((s,r) => s+r.quantita,0).toLocaleString('it-IT')} ore · Totale da fatturare: {importoConsultazioneEconomia(dettaglio.raccolta.totale)}</strong></p>
        {esitoValorizzazione?.raccoltaId === apertaId && <p role="status">{esitoValorizzazione.messaggio}</p>}
        <PrezziRapportiniEconomia key={dettaglio.raccolta.id + ':' + dettaglio.raccolta.revisione + ':' + letturaDettaglio} raccolta={dettaglio.raccolta} righe={dettaglio.righe}
          solaLettura={!operativo}
          onEsito={messaggio => setEsitoValorizzazione({ raccoltaId: dettaglio.raccolta.id, messaggio })}
          onInvio={busy => { setValorizzazioneInCorso(busy); onInvio?.(busy) }}
          onRileggi={async () => { setRilettura(v => v + 1); await apri(dettaglio.raccolta.id, true) }} />
        <UsaRaccoltaEconomiaInVariante key={dettaglio.raccolta.id} raccolta={dettaglio.raccolta} righe={dettaglio.righe}
          varianti={varianti} elencoPronto={elencoPronto} onApri={onApriVariante} operativo={operativo} totale={dettaglio.raccolta.totale}
          statiVarianti={variantiInfo}
          bloccato={valorizzazioneInCorso || operazioneInCorso || creazioneInCorso || caricamentoDettaglio || dettaglio.righe.length === 0 || dettaglio.raccolta.nonValorizzate > 0 || dettaglio.raccolta.totale === null || dettaglio.raccolta.totale <= 0}
          onRileggi={async () => { setRilettura(v => v + 1); await apri(dettaglio.raccolta.id, true) }} />
        <p>{dettaglio.righe.length} registrazioni · {dettaglio.righe.filter(r => r.tipo === 'manodopera').length} manodopera · {dettaglio.righe.filter(r => r.tipo === 'materiale').length} materiali. {dettaglio.raccolta.stato === 'bozza' && dettaglio.righe.some(r => r.origine === 'rapportino') ? dettaglio.righe.some(r => r.origine === 'rapportino' && r.prezzo === null) ? 'Ore e provenienza da Rapportino non modificabili; prezzi da confermare.' : 'Ore immutabili; prezzi fatturabili valorizzati.' : 'Consultazione in sola lettura.'}</p>
        {tabella('manodopera','MANODOPERA',['Data','Descrizione','Operaio','Qualifica','Ora inizio','Ora fine','Pausa min','Ore','Tariffa €/h','Totale €','Riferimento','Note'],r => [dataConsultazioneEconomia(r.operativo.data),r.descrizione,testoConsultazioneEconomia(r.operativo.operaio),testoConsultazioneEconomia(r.operativo.qualifica),testoConsultazioneEconomia(r.operativo.ora_inizio),testoConsultazioneEconomia(r.operativo.ora_fine),testoConsultazioneEconomia(r.operativo.pausa_min),numero(r.quantita),importoConsultazioneEconomia(r.prezzo),importoConsultazioneEconomia(r.totale),testoConsultazioneEconomia(r.operativo.riferimento),testoConsultazioneEconomia(r.note)])}
        {tabella('materiale','MATERIALI',['Data','Materiale','UM','Quantità','Prezzo fatturabile €','Totale €','Fornitore','Documento','Riferimento rapportino','Note'],r => [dataConsultazioneEconomia(r.operativo.data),<span>{r.descrizione}{r.provenienzaFattura && <small style={{ display: 'block' }}>{r.provenienzaFattura}</small>}</span>,r.um,numero(r.quantita),importoConsultazioneEconomia(r.prezzo),importoConsultazioneEconomia(r.totale),testoConsultazioneEconomia(r.operativo.fornitore),testoConsultazioneEconomia(r.operativo.documento),testoConsultazioneEconomia(r.operativo.riferimento_rapportino),testoConsultazioneEconomia(r.note)])}
        {tabella('generica','REGISTRAZIONI GENERICHE',['Descrizione','UM','Quantità','Prezzo unitario €','Totale €','Note'],r => [r.descrizione,r.um,numero(r.quantita),importoConsultazioneEconomia(r.prezzo),importoConsultazioneEconomia(r.totale),testoConsultazioneEconomia(r.note)])}
      </>}
    </> : <>
      {caricamentoElenco && <p role="status">Caricamento raccolte Economia...</p>}
      {erroreElenco && <div role="alert"><p>{erroreElenco}</p><button type="button" onClick={() => setRilettura(v => v+1)}>Riprova</button></div>}
      {!caricamentoElenco && !erroreElenco && (elenco.length === 0 ? <p>Nessuna raccolta Economia registrata per questo cantiere.</p> : <div style={{ display: 'grid', gap: 12 }}>{elenco.map(r => <article key={r.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        {riepilogo(r)}<button type="button" onClick={() => void apri(r.id)}>Apri</button>
        <EliminaBozzaVuota tipo="raccolta" id={r.id} contestoId={cantiereId}
          aggiornamento={`${aggiornamento}:${rilettura}:${r.revisione}`}
          bloccato={r.stato !== 'bozza' || operazioneInCorso || creazioneInCorso}
          onEliminata={() => { setRilettura(v => v + 1); onCreata?.() }} />
      </article>)}</div>)}
    </>}
  </section>
}

function ImportazioneEconomiaLocale({ cantiereId, onInvio, onSalvata }: { cantiereId: string; onInvio: (inCorso: boolean) => void; onSalvata: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [proposta, setProposta] = useState<PropostaEconomiaLocale | null>(null)
  const originale = useRef<PropostaEconomiaLocale | null>(null)
  const contesto = useRef<{ raccolta?: RaccoltaImportazioneEconomia; sorgenteId?: string; hash?: string; bloccato: boolean; salvato: boolean }>({ bloccato: false, salvato: false })
  const [invio, setInvio] = useState(false)
  const [raccolta, setRaccolta] = useState<RaccoltaImportazioneEconomia | null>(null)
  const [salvato, setSalvato] = useState(false)
  const [bloccato, setBloccato] = useState(false)
  const [riepilogo, setRiepilogo] = useState<{ totale: number | null; nonValorizzate: number; righe: number } | null>(null)
  const [messaggio, setMessaggio] = useState('')
  const [stato, setStato] = useState<'In attesa' | 'Lettura in corso' | 'Anteprima pronta' | 'Errore'>('In attesa')
  const [errore, setErrore] = useState('')
  const occupato = useRef(false)
  const richiesta = useRef(0)
  useEffect(() => () => { richiesta.current += 1; onInvio(false) }, [onInvio])
  async function riceviFile(f: File) {
    if (occupato.current || contesto.current.bloccato || contesto.current.raccolta) return
    occupato.current = true
    contesto.current = { bloccato: false, salvato: false }
    originale.current = null
    const token = ++richiesta.current
    setFile(f); setProposta(null); setErrore(''); setStato('Lettura in corso')
    try {
      if (f.size === 0) throw new Error('Il file è vuoto. Seleziona un file con contenuto.')
      if (!/\.xlsx$/i.test(f.name)) throw new Error('Usa il template ufficiale ARTECNA Extra v2 in formato XLSX.')
      const estratta = await leggiTemplateEconomia(f)
      if (token !== richiesta.current) return
      if (!estratta.righe.length) throw new Error('Nessuna riga compilata nei fogli Manodopera economia e Materiali economia.')
      originale.current = structuredClone(estratta)
      setProposta(estratta)
      setStato('Anteprima pronta')
    } catch (e) {
      if (token !== richiesta.current) return
      setErrore(e instanceof Error ? e.message : 'Impossibile leggere il file.'); setStato('Errore')
    } finally { occupato.current = false }
  }
  async function confermaImportazione() {
    if (occupato.current || contesto.current.bloccato || contesto.current.salvato || !file || !proposta || !originale.current) return
    occupato.current = true
    onInvio(true); setInvio(true); setErrore(''); setMessaggio('')
    const token = richiesta.current
    const attivo = () => token === richiesta.current
    const f = file
    const confermata = structuredClone(proposta)
    const snapshot = structuredClone(originale.current.snapshot)
    const ctx = contesto.current
    let fase: 'preparazione' | 'creazione' | 'salvataggio' = 'preparazione'
    const blocca = () => { ctx.bloccato = true; if (attivo()) setBloccato(true) }
    try {
      if (!idSorgenteValido(cantiereId) || !confermata.righe.some(r => r.inclusa)) throw new Error('Serve almeno una riga e un cantiere valido.')
      const righe = confermata.righe.filter(r => r.inclusa).map((r, i) => {
        const q = numeroEconomiaLocale(r.quantita)
        const p = r.prezzo.trim() === '' ? null : numeroEconomiaLocale(r.prezzo)
        if (!r.descrizione.trim() || !r.unitaMisura.trim() || q === undefined || q <= 0 || p === undefined || (p !== null && p < 0) || !/^[+]?\d+(?:[.,]\d{1,2})?$/.test(r.quantita.trim()) || (r.prezzo.trim() !== '' && !/^[+]?\d+(?:[.,]\d{1,2})?$/.test(r.prezzo.trim())))
          throw new Error(`Voce ${r.indice + 1}: verifica descrizione, UM, quantità positiva e prezzo. Sono ammessi al massimo 2 decimali e valori inferiori a 1.000.000.000.000.`)
        for (const traccia of Object.values(r.dettagli.normalizzazione).filter((v): v is DettagliEconomiaLocale['normalizzazione']['quantita'] => typeof v === 'object')) {
          if (traccia.origine === 'rettifica' && !traccia.motivazione?.trim()) throw new Error(`Riga Excel ${r.rigaFile}: indica la motivazione della rettifica economica.`)
        }
        return { ordine: i + 1, descrizione: r.descrizione.trim(), unita_misura: r.unitaMisura.trim(), quantita: q,
          prezzo_unitario: p, note: r.note.trim() || null, origine: 'file', indice_voce_sorgente: r.indice, tipo_riga: r.tipo, dettagli_analitici: r.dettagli }
      })
      if (!ctx.hash) {
        const digest = await crypto.subtle.digest('SHA-256', await f.arrayBuffer())
        ctx.hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
      }
      if (!attivo()) return
      ctx.sorgenteId ??= crypto.randomUUID()
      if (!ctx.raccolta) {
        fase = 'creazione'
        const d = new Date()
        const dataLocale = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const { data, error } = await supabase.rpc('crea_raccolta_economia', {
          p_cantiere_id: cantiereId, p_titolo: `Lavori in economia — ${f.name}`, p_data: dataLocale, p_note: null,
        })
        if (error) { blocca(); throw new Error('Creazione non confermata. Verifica le raccolte prima di riprovare: nessuna nuova creazione automatica.') }
        ctx.raccolta = leggiIdentitaImportazioneEconomia(data, cantiereId)
        if (ctx.raccolta.stato !== 'bozza') throw new Error('La raccolta restituita non è una bozza.')
        if (attivo()) setRaccolta(ctx.raccolta)
      }
      if (!attivo()) return
      fase = 'salvataggio'
      const raccoltaAttesa = ctx.raccolta.revisione
      const { data, error } = await supabase.rpc('salva_bozza_economia', {
        p_raccolta_id: ctx.raccolta.id, p_revisione_attesa: ctx.raccolta.revisione,
        p_payload: {
          sorgenti_da_aggiungere: [{ id: ctx.sorgenteId, nome_file: f.name, formato: confermata.formato,
            file_sha256: ctx.hash, snapshot_version: 2, snapshot }],
          righe_da_creare: righe.map(r => ({ ...r, sorgente_id: ctx.sorgenteId })),
        },
      })
      if (!attivo()) return
      if (error) {
        blocca()
        setErrore(error.code === 'PT409' ? 'Conflitto: Revisione Economia divergente. Nessun reinvio automatico.' : 'Salvataggio non confermato. Verifica della raccolta necessaria; nessun reinvio automatico.')
        try {
          const lettura = await supabase.rpc('leggi_raccolta_economia_cliente', { p_raccolta_id: ctx.raccolta.id })
          if (lettura.error || !recordSorgente(lettura.data)) throw new Error('Lettura non disponibile')
          ctx.raccolta = leggiIdentitaImportazioneEconomia(lettura.data.raccolta, cantiereId, ctx.raccolta.id)
          if (attivo()) {
            setRaccolta(ctx.raccolta)
            const rifiutoCerto = ['22023', '23514', '22003', '22P02'].includes(error.code)
            if (rifiutoCerto && ctx.raccolta.stato === 'bozza' && ctx.raccolta.revisione === raccoltaAttesa &&
                Array.isArray(lettura.data.righe) && lettura.data.righe.length === 0 &&
                Array.isArray(lettura.data.sorgenti) && lettura.data.sorgenti.length === 0) {
              ctx.bloccato = false; setBloccato(false)
              setMessaggio('Salvataggio rifiutato senza modifiche. Correggi le righe e conferma nella stessa raccolta.')
            } else setMessaggio('Stato corrente riletto. Anteprima conservata; importazione bloccata per evitare duplicazioni o sovrascritture.')
          }
        } catch { if (attivo()) setMessaggio('Rilettura della raccolta non disponibile. Anteprima conservata.') }
        return
      }
      if (!recordSorgente(data)) throw new Error('Risposta di salvataggio non verificabile.')
      const precedente = ctx.raccolta.revisione
      ctx.raccolta = leggiIdentitaImportazioneEconomia(data.raccolta, cantiereId, ctx.raccolta.id)
      if (ctx.raccolta.stato !== 'bozza' || ctx.raccolta.revisione !== precedente + 1) throw new Error('Revisione di salvataggio non verificabile.')
      ctx.salvato = true
      blocca(); setSalvato(true); setRaccolta(ctx.raccolta)
      onSalvata()
      const riepiloga = (v: Record<string, unknown>) => {
        const totale = v.totale === null ? null : Number(v.totale)
        const nonValorizzate = Number(v.righe_non_valorizzate)
        if ((v.totale !== null && (v.totale === undefined || !Number.isFinite(totale))) || !Number.isSafeInteger(nonValorizzate) || nonValorizzate < 0)
          throw new Error('Riepilogo non verificabile')
        return { totale, nonValorizzate, righe: righe.length }
      }
      try {
        setRiepilogo(riepiloga(data))
        const lettura = await supabase.rpc('leggi_raccolta_economia_cliente', { p_raccolta_id: ctx.raccolta.id })
        if (lettura.error || !recordSorgente(lettura.data)) throw new Error('Rilettura non disponibile')
        const v = lettura.data
        const corrente = leggiIdentitaImportazioneEconomia(v.raccolta, cantiereId, ctx.raccolta.id)
        if (!Array.isArray(v.sorgenti) || !v.sorgenti.some(s => recordSorgente(s) && s.id === ctx.sorgenteId && s.file_sha256 === ctx.hash) || !Array.isArray(v.righe)) throw new Error('Sorgente non verificabile')
        const importate = v.righe.filter(r => recordSorgente(r) && r.sorgente_id === ctx.sorgenteId)
        if (importate.length !== righe.length || !righe.every(r => importate.some(v => recordSorgente(v) && v.origine === 'file' && v.indice_voce_sorgente === r.indice_voce_sorgente && v.ordine === r.ordine && v.descrizione === r.descrizione && v.unita_misura === r.unita_misura && Number(v.quantita) === r.quantita && (r.prezzo_unitario === null ? v.prezzo_unitario === null : Number(v.prezzo_unitario) === r.prezzo_unitario)))) throw new Error('Righe non verificabili')
        if (attivo()) { ctx.raccolta = corrente; setRaccolta(corrente); setRiepilogo(riepiloga(v)); setMessaggio('Importazione salvata e verificata nella bozza Economia.') }
      } catch { if (attivo()) setMessaggio('Salvataggio riuscito; verifica della rilettura non disponibile') }
    } catch (e) {
      if (fase !== 'preparazione') blocca()
      if (attivo()) setErrore(e instanceof Error ? e.message : 'Operazione non confermata. Nessun reinvio automatico.')
    } finally { occupato.current = false; onInvio(false); if (attivo()) setInvio(false) }
  }
  const modifica = (indice: number, campo: 'descrizione' | 'unitaMisura' | 'quantita' | 'prezzo' | 'note', valore: string) =>
    setProposta(p => p && ({ ...p, righe: p.righe.map(r => {
      if (r.indice !== indice) return r
      const aggiornata = { ...r, [campo]: valore, dettagli: structuredClone(r.dettagli) }
      if (campo === 'quantita' || campo === 'prezzo') {
        aggiornata.dettagli.normalizzazione[campo === 'quantita' ? 'quantita' : 'prezzo_unitario'] = { decimali: 2, origine: 'rettifica', motivazione: null }
      }
      return aggiornata
    }) }))
  const modificaOperativo = (indice: number, campo: string, valore: string) => setProposta(p => p && ({ ...p, righe: p.righe.map(r => r.indice !== indice ? r : ({ ...r, dettagli: { ...r.dettagli, operativo: { ...r.dettagli.operativo, [campo]: campo === 'pausa_min' ? (valore === '' ? null : Number(valore)) : valore || null } } })) }))
  const inCorso = stato === 'Lettura in corso'
  const solaLettura = invio || bloccato || salvato
  return <section aria-label="Importazione locale lavori in economia">
    <AreaAcquisizioneFile bloccata={inCorso || solaLettura || raccolta !== null} onFile={f => { void riceviFile(f) }} />
    <p role="status">{stato}</p>
    {file && <p style={{ overflowWrap: 'anywhere' }}>{file.name} — {proposta?.formato ?? file.name.split('.').pop()?.toLowerCase()} — {file.size.toLocaleString('it-IT')} byte</p>}
    {errore && <p role="alert">{errore}</p>}
    <p>{salvato ? 'Anteprima importata, in sola lettura.' : 'Le correzioni restano locali fino alla conferma importazione.'}</p>
    {raccolta && <p>Raccolta n. {raccolta.numero} — {raccolta.stato} — revisione {raccolta.revisione}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    {riepilogo && <p>Righe importate: {riepilogo.righe}. Totale{riepilogo.nonValorizzate > 0 ? ' parziale' : ''}: {riepilogo.totale === null ? 'Non disponibile' : riepilogo.totale.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}. Righe non valorizzate: {riepilogo.nonValorizzate}.</p>}
    {proposta && <>
      <p>Righe riconosciute: {proposta.righe.length}</p>
      {proposta.warnings.map((w, i) => <p key={i}>{w}</p>)}
      {(['manodopera','materiale'] as const).map(tipo => <section key={tipo} aria-label={tipo === 'manodopera' ? 'Anteprima Manodopera' : 'Anteprima Materiali'}>
        <h4>{tipo === 'manodopera' ? 'MANODOPERA' : 'MATERIALI'}</h4>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 1100 }}>
          <thead><tr>{['Includi','Descrizione / materiale','UM','Ore / quantità','Tariffa / prezzo','Totale','Dati analitici','Sorgente / verifiche'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead>
          <tbody>{proposta.righe.filter(r => r.tipo === tipo).map(r => {
            const q = numeroEconomiaLocale(r.quantita), p = numeroEconomiaLocale(r.prezzo)
            const totale = prodottoEconomia(r.quantita,r.prezzo)
            const sorgente = proposta.snapshot.fogli[String(r.dettagli.sorgente.foglio_sorgente)].righe[String(r.rigaFile)]
            const anomalie = [!r.descrizione.trim() && (tipo === 'materiale' ? 'materiale_mancante: completa il materiale oppure escludi la riga' : 'Descrizione mancante'), !r.unitaMisura.trim() && 'UM mancante', (q === undefined || q <= 0) && 'Quantità non valida', r.prezzo.trim() !== '' && (p === undefined || p < 0) && 'Prezzo non valido'].filter(Boolean)
            return <tr key={r.indice} style={{ opacity: r.inclusa ? 1 : 0.65 }}>
              <td><input type="checkbox" disabled={solaLettura} aria-label={'Includi '+tipo+' riga '+r.rigaFile} checked={r.inclusa} onChange={e => setProposta(p => p && ({ ...p, righe: p.righe.map(v => v.indice === r.indice ? { ...v, inclusa: e.target.checked } : v) }))} /></td>
              <td><textarea disabled={solaLettura} aria-label={'Descrizione '+tipo+' riga '+r.rigaFile} value={r.descrizione} onChange={e => modifica(r.indice,'descrizione',e.target.value)} /></td>
              {(['unitaMisura','quantita','prezzo'] as const).map(c => <td key={c}><input disabled={solaLettura || (tipo === 'manodopera' && c === 'unitaMisura')} aria-label={c+' '+tipo+' riga '+r.rigaFile} value={r[c]} onChange={e => modifica(r.indice,c,e.target.value)} /></td>)}
              <td>{totale === undefined || r.prezzo === '' ? 'Non valorizzato' : '€ '+totale}</td>
              <td>{Object.entries(r.dettagli.operativo).map(([campo,valore]) => <label key={campo} style={{ display: 'block' }}>{campo}<input disabled={solaLettura} type={campo === 'data' ? 'date' : campo.startsWith('ora_') ? 'time' : campo === 'pausa_min' ? 'number' : 'text'} min={campo === 'pausa_min' ? 0 : undefined} step={campo === 'pausa_min' ? 1 : undefined} value={valore ?? ''} onChange={e => modificaOperativo(r.indice,campo,e.target.value)} /></label>)}
                <label>Note<textarea disabled={solaLettura} value={r.note} onChange={e => modifica(r.indice,'note',e.target.value)} /></label>
                {(['quantita','prezzo_unitario'] as const).filter(c => r.dettagli.normalizzazione[c].origine === 'rettifica').map(c => <label key={c}>Motivazione rettifica {c}<input disabled={solaLettura} value={r.dettagli.normalizzazione[c].motivazione ?? ''} onChange={e => setProposta(p => p && ({ ...p, righe: p.righe.map(v => v.indice !== r.indice ? v : ({ ...v, dettagli: { ...v.dettagli, normalizzazione: { ...v.dettagli.normalizzazione, [c]: { ...v.dettagli.normalizzazione[c], motivazione: e.target.value || null } } } })) }))} /></label>)}
              </td>
              <td><div>{String(r.dettagli.sorgente.foglio_sorgente)} — riga {r.rigaFile} — indice {r.indice}</div>
                <div>Normalizzazione esplicita a 2 decimali. Valori grezzi e formule conservati nello snapshot.</div>
                {Object.entries(sorgente.celle).map(([c,v]) => <details key={c}><summary>{c}: {v.visualizzato ?? v.valore ?? 'Vuoto'} — grezzo: {v.valore ?? 'NULL'}</summary><div>Formato: {v.formato ?? 'Non disponibile'}</div>{v.formula && <div>Formula: {v.formula}; risultato memorizzato: {v.valore ?? 'Assente'}</div>}</details>)}
                {r.dettagli.warnings.sorgente.map((w,i) => <div key={i}>{w.codice}: {w.campi.join(', ')}</div>)}
                {warningsOperativiEconomia(r).map(w => <div key={w}>Operativo: {w}</div>)}
                {anomalie.map((a,i) => <div key={'a'+i}>{a}</div>)}
                {r.prezzo.trim() === '' && <div>prezzo_non_valorizzato: NULL, distinto da zero</div>}
              </td>
            </tr>
          })}</tbody>
        </table></div>
      </section>)}
      <p>Il prezzo può restare vuoto: la riga sarà salvata non valorizzata e la raccolta resterà in bozza.</p>
      <button type="button" disabled={inCorso || solaLettura || !proposta.righe.some(r => r.inclusa)} onClick={() => void confermaImportazione()}>
        {invio ? 'Importazione in corso...' : salvato ? 'Importazione salvata' : 'Conferma importazione'}
      </button>
    </>}
  </section>
}

function AnteprimaPreventivoVariante({ cantiereId, elencoVarianti, variantiCorrenti, onVarianteAggiornata, onApriVarianteEconomia, richiestaApertura = 0, economiaRapportini = false }: {
  cantiereId: string
  elencoVarianti: Stato
  variantiCorrenti: readonly VarianteSorgenti[]
  onVarianteAggiornata: (varianteId: string) => void
  onApriVarianteEconomia: (varianteId: string) => void
  richiestaApertura?: number
  economiaRapportini?: boolean
}) {
  const [aperto, setAperto] = useState(economiaRapportini)
  useEffect(() => { if (richiestaApertura > 0) setAperto(true) }, [richiestaApertura])
  const [natura, setNatura] = useState<NaturaVariante>(economiaRapportini ? 'lavori_in_economia' : 'preventivo_integrativo')
  const [invioEconomia, setInvioEconomia] = useState(false)
  const [confermaAcquisizioneEconomia, setConfermaAcquisizioneEconomia] = useState(false)
  const [titoloRaccoltaSuggerito, setTitoloRaccoltaSuggerito] = useState<string | null>(null)
  const [aggiornamentoEconomia, setAggiornamentoEconomia] = useState(0)
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
  const [nuovaRaccoltaIntenzionale, setNuovaRaccoltaIntenzionale] = useState(false)
  const elencoPronto = elencoVarianti.tipo === 'elenco' && elencoVarianti.cantiereId === cantiereId
  const candidate = variantiCorrenti.filter(v => v.titolo === titoloBozzaSorgenti &&
    ['bozza', 'proposta', 'approvata', 'rifiutata', 'annullata'].includes(v.stato))
  const varianteCorrente = candidate.find(v => v.id === bozzaSorgentiVarianteId)
  const varianteSelezionata = varianteCorrente ??
    ((!elencoPronto || bozzaCreataId.current === bozzaSorgentiVarianteId) ? selezioneSorgenti : null)
  const varianteSorgentiModificabile = varianteSelezionata?.stato === 'bozza'
  // Prima della prima sorgente resta disponibile la creazione della bozza già esistente.
  const nuovaRaccolta = elencoPronto && !bozzaSorgentiVarianteId &&
    (nuovaRaccoltaIntenzionale || candidate.length === 0)
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
    setNuovaRaccoltaIntenzionale(false)
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
    if (!elencoPronto || bozzaIdRef.current || nuovaRaccoltaIntenzionale) return
    if (candidate.length === 1) void caricaSorgentiSalvate(candidate[0].id)
    else setSorgentiPronte(candidate.length === 0)
  }, [elencoVarianti, cantiereId, variantiCorrenti, nuovaRaccoltaIntenzionale])
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
      onVarianteAggiornata(id)
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

  function avviaNuovaRaccolta() {
    if (!elencoPronto || operazioneSorgenti || acquisizioneConsentita || !varianteSelezionata) return
    // Invalida le risposte asincrone della raccolta precedente.
    sessioneSorgenti.current = {}
    letturaSorgenti.current += 1
    resetPercorso()
    bozzaIdRef.current = null
    bozzaCreataId.current = null
    contestoScrittura.current = { id: null, consentita: true }
    setBozzaSorgentiVarianteId(null)
    setSelezioneSorgenti(null)
    setNuovaRaccoltaIntenzionale(true)
    setSorgenti([])
    setSorgentiPronte(true)
    setCaricamentoSorgenti(false)
    invioSorgente.current = false
    setSalvataggioSorgente(false)
    setNatura('preventivo_integrativo')
    setAcquisizione('dati_artecna')
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
        (!bozzaIdRef.current && candidate.length > 0 && !nuovaRaccolta) ||
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
      onVarianteAggiornata(id)
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
    {!economiaRapportini && <button type="button" disabled={confermaInCorso || invioEconomia} onClick={() => {
      richiesta.current += 1
      resetFile()
      setAperto(!aperto)
    }}>{aperto ? 'Chiudi anteprima da preventivo' : '+ Nuova variante da preventivo'}</button>}
    {aperto && <section aria-label="Origine e acquisizione variante"
      style={{ marginTop: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
      {!economiaRapportini && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label>Origine variante<select disabled={operazioneSorgenti || !acquisizioneConsentita || invioEconomia} value={natura} style={{ display: 'block', padding: 8 }}
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
        <label>Acquisizione<select disabled={operazioneSorgenti || !acquisizioneConsentita || invioEconomia} value={acquisizione} style={{ display: 'block', padding: 8 }}
          onChange={e => { if (!verificaModifica(true)) return; resetPercorso(); setAcquisizione(e.target.value as AcquisizioneVariante) }}>
          <option value="manuale">Manuale</option>
          <option value="dati_artecna">Da dati ARTECNA</option>
          <option value="file">Importa file</option>
        </select></label>
      </div>}
      {natura === 'lavori_in_economia' ? <>
        <PrestazioniRapportiniEconomia key={'prestazioni:' + cantiereId} cantiereId={cantiereId} aggiornamento={aggiornamentoEconomia}
          onInvio={setInvioEconomia} onAcquisite={() => setAggiornamentoEconomia(v => v+1)}
          varianti={variantiCorrenti} onConferma={setConfermaAcquisizioneEconomia} onTitoloSuggerito={setTitoloRaccoltaSuggerito} />
        <RaccolteEconomiaRegistrate key={'raccolte:' + cantiereId} cantiereId={cantiereId} aggiornamento={aggiornamentoEconomia}
          varianti={variantiCorrenti.map(v => v.id)} variantiInfo={variantiCorrenti} elencoPronto={elencoPronto} onApriVariante={onApriVarianteEconomia}
          onCreata={economiaRapportini ? () => setAggiornamentoEconomia(v => v + 1) : undefined}
          onInvio={setInvioEconomia} operazioneInCorso={invioEconomia || confermaAcquisizioneEconomia} operativo={economiaRapportini} titoloSuggerito={titoloRaccoltaSuggerito} />
        {acquisizione === 'file' && <ImportazioneEconomiaLocale key={cantiereId} cantiereId={cantiereId} onInvio={setInvioEconomia} onSalvata={() => setAggiornamentoEconomia(v => v+1)} />}
      </> : <>
      {!elencoPronto && <p role="status">Attendi il caricamento delle varianti prima di salvare sorgenti.</p>}
      {varianteSelezionata && !acquisizioneConsentita && <button type="button"
        disabled={!elencoPronto || operazioneSorgenti} onClick={avviaNuovaRaccolta}>Nuova raccolta</button>}
      {candidate.length > 0 && (candidate.length > 1 || nuovaRaccoltaIntenzionale) && <label>
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
        <AreaAcquisizioneFile bloccata={operazioneSorgenti || !acquisizioneConsentita || analisiFile}
          onFile={file => {
            if (!verificaModifica(true)) return
            richiesta.current += 1
            resetFile()
            setFileSelezionato(file)
          }} />
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
      </>}
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

export default function VariantiCantierePanel({ cantiereId, economiaRapportini = false, onApprovazione, stampaContesto, onDocumentoConfermato }: { cantiereId?: string | null; economiaRapportini?: boolean; onApprovazione?: () => void; stampaContesto?: ContestoStampaVarianti; onDocumentoConfermato?: () => void }) {
  const [stampaInCorso, setStampaInCorso] = useState(false)
  const [erroreStampa, setErroreStampa] = useState('')
  const [includiProposte, setIncludiProposte] = useState(false)
  const [stato, setStato] = useState<Stato>({ tipo: 'loading' })
  const [formAperto, setFormAperto] = useState(false)
  const [varianteApertaId, setVarianteApertaId] = useState<string | null>(null)
  const aperturaEconomia = useRef<string | null>(null)
  const [richiestaAperturaAnteprima, setRichiestaAperturaAnteprima] = useState(0)
  const anteprimaRef = useRef<HTMLDivElement | null>(null)
  const creazioneRef = useRef<HTMLButtonElement | null>(null)
  const formCreazioneRef = useRef<HTMLFormElement | null>(null)
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [dataVariante, setDataVariante] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreSalvataggio, setErroreSalvataggio] = useState('')
  const [successo, setSuccesso] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [bozzeCreate, setBozzeCreate] = useState<Variante[]>([])
  const [refreshLavorazioni, setRefreshLavorazioni] = useState<Record<string, number>>({})
  const [proposteConfermate, setProposteConfermate] = useState<Variante[]>([])
  const [approvazioniConfermate, setApprovazioniConfermate] = useState<Variante[]>([])
  const invioInCorso = useRef(false)
  const contesto = useRef<object | null>(null)

  useEffect(() => {
    const corrente = {}
    contesto.current = corrente
    invioInCorso.current = false
    setRichiestaAperturaAnteprima(0)
    setVarianteApertaId(null)
    aperturaEconomia.current = null
    setFormAperto(false)
    setTitolo('')
    setDescrizione('')
    setDataVariante('')
    setErroreSalvataggio('')
    setSuccesso('')
    setSalvataggio(false)
    setBozzeCreate([])
    setRefreshLavorazioni({})
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
        if (attivo) {
          setStato({ tipo: 'elenco', righe, cantiereId: cantiereId! })
          if (aperturaEconomia.current && righe.some(v => v.id === aperturaEconomia.current)) {
            setVarianteApertaId(aperturaEconomia.current)
            aperturaEconomia.current = null
          }
        }
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
    setSuccesso(`Proposta n. ${esito.numero} approvata.`)
    onApprovazione?.()
    setRefresh(valore => valore + 1)
  }

  const righeLette = stato.tipo === 'elenco' ? stato.righe : []
  const righe = useMemo(() => {
    const righeLette = stato.tipo === 'elenco' ? stato.righe : []
    return [
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
  }, [stato, bozzeCreate, proposteConfermate, approvazioniConfermate])
  const elencoContrattuale = useMemo<Stato>(() => stato.tipo === 'elenco'
    ? { ...stato, righe } : stato, [stato, righe])

  useEffect(() => {
    if (stato.tipo === 'elenco' && stato.cantiereId === cantiereId && varianteApertaId &&
        !righe.some(variante => variante.id === varianteApertaId)) setVarianteApertaId(null)
  }, [stato, cantiereId, righe, varianteApertaId])

  function aggiornaVariante(varianteId: string) {
    setRefreshLavorazioni(precedenti => ({ ...precedenti, [varianteId]: (precedenti[varianteId] ?? 0) + 1 }))
    setRefresh(valore => valore + 1)
  }
  function apriVarianteEconomia(varianteId: string) {
    aperturaEconomia.current = varianteId
    aggiornaVariante(varianteId)
  }

  function vaiAnteprima() {
    setRichiestaAperturaAnteprima(valore => valore + 1)
    portaAlControllo(anteprimaRef.current)
  }

  async function stampaVarianti() {
    if (!stampaContesto || stampaInCorso || stato.tipo !== 'elenco') return
    const finestra = window.open('', '_blank')
    if (!finestra) { setErroreStampa('Consenti la finestra di stampa e riprova.'); return }
    finestra.opener = null
    setStampaInCorso(true); setErroreStampa('')
    try {
      const selezionate = righe.filter(v => v.preventivo_contrattuale_id === stampaContesto.preventivoId && (v.stato === 'approvata' || (includiProposte && ['proposta','bozza'].includes(v.stato))))
      if (!selezionate.length) throw new Error('Nessuna variante da stampare.')
      const documenti: VarianteCliente[] = []
      for (const v of selezionate) {
        const lavorazioni: Record<string, unknown>[] = [], sorgenti: Record<string, unknown>[] = []
        for (const [rpc, ordine, dest] of [['leggi_lavorazioni_variante','numero_riga',lavorazioni],['leggi_sorgenti_variante','id',sorgenti]] as const) {
          for (let offset = 0; ; offset += 200) {
            const { data, error } = await supabase.rpc(rpc, { p_variante_id: v.id }).order(ordine, { ascending: true }).range(offset, offset+199)
            if (error || !Array.isArray(data)) throw new Error('Lettura stampa non disponibile.')
            dest.push(...data)
            if (data.length < 200) break
          }
        }
        if (cantiereId) await arricchisciOriginiRapportino(sorgenti, cantiereId)
        for (const s of sorgenti) {
          if (s.tipo !== 'raccolta_economia' || typeof s.economia_raccolta_id !== 'string') continue
          const { data, error } = await supabase.rpc('leggi_raccolta_economia_cliente', { p_raccolta_id: s.economia_raccolta_id })
          if (error || !cantiereId) throw new Error('Provenienza stampa non disponibile.')
          const dettaglio = dettaglioConsultazioneEconomia(data, cantiereId, s.economia_raccolta_id)
          if (recordSorgente(s.snapshot) && Array.isArray(s.snapshot.registrazioni)) {
            s.snapshot = { ...s.snapshot, registrazioni: s.snapshot.registrazioni.map((r: unknown) => {
              if (!recordSorgente(r)) return r
              const voce = dettaglio.righe.find(v => v.id === r.id)
              return voce ? { ...r, prestazione_snapshot: recordSorgente(r.dettagli_analitici) ? r.dettagli_analitici.rapportino ?? { data: voce.operativo.data } : { data: voce.operativo.data } } : r
            }) }
          }
        }
        const voci = vociCliente(lavorazioni, sorgenti)
        const totale = v.stato === 'approvata' ? Number(v.importo_delta_approvato) : voci.some(r=>r.totale === null) ? null : voci.reduce((s,r)=>s+(r.totale??0),0)
        if (v.stato === 'approvata' && v.importo_delta_approvato === null) throw new Error('Importo approvato non disponibile.')
        documenti.push({ id: v.id, numero: v.numero, titolo: v.titolo ?? 'Lavori extra', data: v.data_variante || '', stato: v.stato, totale, voci })
      }
      finestra.document.open(); finestra.document.write(documentoVariantiCliente(stampaContesto, documenti, undefined, { includiProposteBozze: includiProposte })); finestra.document.close(); finestra.focus(); finestra.print()
    } catch { finestra.close(); setErroreStampa('Stampa non disponibile: verifica elenco, lavorazioni e contratto prima di riprovare.'); }
    finally { setStampaInCorso(false) }
  }
  const bozzeNonRilette = stato.tipo === 'elenco' &&
    bozzeCreate.some(bozza => !righeLette.some(riga => riga.id === bozza.id))

  return (
    <section aria-label="Varianti" style={{ marginTop: 16 }}>
      {economiaRapportini && <p>Prestazioni da acquisire → Prezzi fatturabili → Totale lavori → Crea proposta → Approva proposta → KPI aggiornati</p>}
      {stampaContesto && <div><button type="button" disabled={stampaInCorso || stato.tipo !== 'elenco'} onClick={() => void stampaVarianti()}>Stampa varianti</button>
        <label><input type="checkbox" checked={includiProposte} disabled={stampaInCorso} onChange={e => setIncludiProposte(e.target.checked)} /> Includi proposte e bozze, con stato indicato</label></div>}
      {erroreStampa && <p role="alert">{erroreStampa}</p>}
      <h3>{economiaRapportini ? 'Lavori in economia dai Rapportini' : 'Varianti'}</h3>
      {!economiaRapportini && stato.tipo === 'elenco' && !varianteApertaId && !righe.some(v => v.stato === 'bozza' || v.stato === 'proposta') &&
        <GuidaPassoSuccessivo stato={null} onCrea={() => portaAlControllo(formCreazioneRef.current ?? creazioneRef.current)}
          onAcquisisci={cantiereId ? vaiAnteprima : undefined} />}
      {cantiereId && <div ref={anteprimaRef} tabIndex={-1}>
        <AnteprimaPreventivoVariante key={cantiereId} cantiereId={cantiereId} elencoVarianti={stato} variantiCorrenti={righe}
          onVarianteAggiornata={aggiornaVariante} richiestaApertura={richiestaAperturaAnteprima} economiaRapportini={economiaRapportini}
          onApriVarianteEconomia={apriVarianteEconomia} />
      </div>}
      {!economiaRapportini && !formAperto && (
        <button ref={creazioneRef} type="button" disabled={!cantiereId || salvataggio}
          onClick={() => { setErroreSalvataggio(''); setFormAperto(true) }}>
          Nuova variante
        </button>
      )}
      {!economiaRapportini && formAperto && (
        <form ref={formCreazioneRef} tabIndex={-1} onSubmit={salvaBozza} style={{ marginTop: 16 }}>
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
      {!economiaRapportini && stato.tipo === 'elenco' && righe.length === 0 && <p>Nessuna variante tradizionale presente per questo cantiere.</p>}
      {righe.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {(economiaRapportini ? righe.filter(v => v.id === varianteApertaId) : righe).map(variante => (
            <article key={variante.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
              <h4 style={{ marginTop: 0 }}>
                {variante.stato === 'approvata' ? 'Approvata' : variante.stato === 'proposta' ? 'Proposta' : variante.numero === null ? 'Bozza' : `Variante n. ${variante.numero}`}
                {' — '}{variante.titolo || 'Senza titolo'}
              </h4>
              <p>Stato: {variante.stato}</p>
              {!economiaRapportini && variante.stato === 'bozza' && <RinominaVarianteBozza id={variante.id} stato={variante.stato} titoloAttuale={variante.titolo || ''}
                onRinominata={nuovo => {
                  setBozzeCreate(v => v.map(r => r.id === variante.id ? { ...r, titolo: nuovo } : r))
                  setRefresh(v => v + 1)
                }} />}
              {!economiaRapportini && <EliminaBozzaVuota tipo="variante" id={variante.id} contestoId={cantiereId || ''}
                aggiornamento={`${refresh}:${refreshLavorazioni[variante.id] ?? 0}`}
                bloccato={variante.stato !== 'bozza' || salvataggio || stato.tipo !== 'elenco'}
                onEliminata={() => {
                  setBozzeCreate(v => v.filter(r => r.id !== variante.id))
                  setProposteConfermate(v => v.filter(r => r.id !== variante.id))
                  setApprovazioniConfermate(v => v.filter(r => r.id !== variante.id))
                  setVarianteApertaId(v => v === variante.id ? null : v)
                  setRefresh(v => v + 1)
                }} />}
              {variante.numero !== null && <p>Numero: {variante.numero}</p>}
              <p>Data variante: {variante.data_variante
                ? variante.data_variante.slice(0, 10).split('-').reverse().join('/')
                : 'Non indicata'}</p>
              {(varianteApertaId === variante.id || variante.importo_delta_approvato !== null) && <p>Importo delta approvato: {variante.importo_delta_approvato === null
                ? 'Non disponibile'
                : Number(variante.importo_delta_approvato).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>}
              <button type="button" aria-expanded={varianteApertaId === variante.id}
                aria-controls={`variante-area-${variante.id}`}
                onClick={() => setVarianteApertaId(aperta => aperta === variante.id ? null : variante.id)}>
                {varianteApertaId === variante.id ? 'Chiudi variante' : 'Apri variante'}
              </button>
              {varianteApertaId === variante.id && <div id={`variante-area-${variante.id}`}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{variante.descrizione || 'Nessuna descrizione.'}</p>
              {variante.stato === 'approvata' && <>
                <p>Riferimento approvazione: {variante.riferimento_approvazione || 'Non disponibile'}</p>
                <p>Data approvazione: {variante.approvata_at && Number.isFinite(Date.parse(variante.approvata_at))
                  ? new Date(variante.approvata_at).toLocaleString('it-IT') : 'Non disponibile'}</p>
              </>}
              {!economiaRapportini && <details>
                <summary>Preventivo contrattuale collegato</summary>
                <p style={{ overflowWrap: 'anywhere' }}>{variante.preventivo_contrattuale_id || 'Non disponibile'}</p>
              </details>}
              {!economiaRapportini && variante.stato === 'bozza' && cantiereId && <VarianteFontiMemoryPanel
                key={'fonti:' + cantiereId + ':' + variante.id} supabase={supabase} cantiereId={cantiereId}
                variante={{ ...variante, stato: 'bozza' }} />}
              {!economiaRapportini && variante.stato === 'bozza' && cantiereId && <VariantePreventivoIntegrativoPanel
                key={'generazione:' + cantiereId + ':' + variante.id} supabase={supabase} varianteId={variante.id}
                onSalvato={() => { aggiornaVariante(variante.id); onDocumentoConfermato?.() }} />}
              <LavorazioniVariantePanel key={`${cantiereId}:${variante.id}`} varianteId={variante.id}
                cantiereId={cantiereId} statoVariante={variante.stato}
                sintetico={economiaRapportini}
                refreshEsterno={refreshLavorazioni[variante.id] ?? 0}
                onNuoviLavori={!economiaRapportini && cantiereId ? vaiAnteprima : undefined}
                selettoreContrattuale={!economiaRapportini && variante.stato === 'bozza' ? ({ occupato, onInCorso }) => <SelettoreComponentiContrattuali
                  key={`${cantiereId}:${variante.id}:${variante.preventivo_contrattuale_id}`}
                  variante={variante} cantiereId={cantiereId} elencoVarianti={elencoContrattuale}
                  occupato={occupato} onInCorso={onInCorso} onSalvata={() => aggiornaVariante(variante.id)} /> : undefined}
                onProposta={numero => confermaProposta(variante, numero)}
                renderApprovazione={lavorazioniLette => variante.stato === 'proposta' &&
                  <ApprovazioneVarianteForm key={'approva:' + cantiereId + ':' + variante.id}
                    variante={variante} cantiereId={cantiereId} lavorazioniLette={lavorazioniLette}
                    onApprovata={esito => confermaApprovazione(variante, esito)} />} />
              </div>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}


type ComponenteContrattualeSelezionabile = {
  tipo: 'preventivo' | 'variante'
  id: number
  descrizione: string
  unitaMisura: string
  quantitaOriginaria: number
  prezzoUnitario: number
  importoOriginario: number
  origineLabel: string
  numeroVariante?: number
}

function leggiComponenteContrattuale(riga: Record<string, unknown>,
  tipo: ComponenteContrattualeSelezionabile['tipo'], origineLabel: string,
  numeroVariante?: number): ComponenteContrattualeSelezionabile {
  const numero = (valore: unknown) => {
    if (typeof valore === 'number' && Number.isFinite(valore)) return valore
    if (typeof valore === 'string') {
      const risultato = numeroRevisioneVariante(valore)
      if (risultato !== undefined) return risultato
    }
    throw new Error('Dati contrattuali non verificabili.')
  }
  const id = numero(riga.id)
  const quantitaOriginaria = numero(tipo === 'preventivo' ? riga.quantita : riga.quantita_delta)
  const prezzoUnitario = numero(riga.prezzo_unitario)
  const importoOriginario = numero(tipo === 'preventivo' ? riga.importo_previsto : riga.delta_contratto)
  if (!Number.isSafeInteger(id) || id <= 0 || quantitaOriginaria <= 0 || prezzoUnitario < 0 || importoOriginario < 0 ||
      (tipo === 'variante' && (importoOriginario <= 0 || !Number.isSafeInteger(numeroVariante) || Number(numeroVariante) <= 0)) ||
      typeof riga.descrizione !== 'string' || !riga.descrizione.trim() ||
      typeof riga.unita_misura !== 'string' || !riga.unita_misura.trim()) {
    throw new Error('Dati contrattuali non verificabili.')
  }
  return { tipo, id, descrizione: riga.descrizione, unitaMisura: riga.unita_misura,
    quantitaOriginaria, prezzoUnitario, importoOriginario, origineLabel, numeroVariante }
}

const erroriCorrezioneVariante: Record<string, string> = {
  P2083: 'Riduzione superiore al residuo disponibile.',
  P2084: 'Eliminazione non coincidente con il residuo disponibile.',
  P2082: 'SAL o maturato non verificabile.',
  P2088: 'Stato contrattuale o SAL incoerente: correzione non confermata.',
  P2089: 'Nessun residuo disponibile.',
  P2091: 'Richiesta di correzione non valida.',
  P2092: 'Utente non autorizzato sul cantiere.',
  P2093: 'Variante non più in bozza o contratto cambiato.',
  P2094: 'Voce contrattuale non disponibile o incoerente.',
  P2095: 'SAL, maturato o residuo non verificabile.',
  P2096: 'Quantità o importo della riduzione superiore al residuo disponibile.',
  P2097: 'Eliminazione economicamente diversa dal residuo disponibile.',
  P2098: 'Conflitto durante il salvataggio. Rileggi la bozza prima di procedere.',
  '42501': 'Sessione o autorizzazione non valida.',
}

function SelettoreComponentiContrattuali({ variante, cantiereId, elencoVarianti, occupato = false, onInCorso, onSalvata }: {
  variante: Variante
  cantiereId?: string | null
  elencoVarianti: Stato
  occupato?: boolean
  onInCorso: (valore: boolean) => void
  onSalvata: () => void
}) {
  type LetturaComponenti =
    | { tipo: 'loading' }
    | { tipo: 'errore'; messaggio: string }
    | { tipo: 'elenco'; componenti: ComponenteContrattualeSelezionabile[]; contesto: Stato }
  const [lettura, setLettura] = useState<LetturaComponenti>({ tipo: 'loading' })
  const [componenteContrattualeSelezionata, setComponenteContrattualeSelezionata] = useState('')
  const [operazione, setOperazione] = useState<'eliminazione_residua' | 'riduzione_residua'>('eliminazione_residua')
  const [motivo, setMotivo] = useState('')
  const [quantita, setQuantita] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreCorrezione, setErroreCorrezione] = useState('')
  const [successoCorrezione, setSuccessoCorrezione] = useState('')
  const [arrestata, setArrestata] = useState(false)
  const invioCorrezione = useRef(false)
  const contestoCorrezione = useRef<object | null>(null)
  const preventivoId = variante.preventivo_contrattuale_id

  useEffect(() => {
    let attivo = true
    const sessione = {}
    contestoCorrezione.current = sessione
    setLettura({ tipo: 'loading' })
    setComponenteContrattualeSelezionata('')
    async function carica() {
      try {
        if (elencoVarianti.tipo === 'loading') return
        if (!cantiereId || !preventivoId || elencoVarianti.tipo !== 'elenco' ||
            elencoVarianti.cantiereId !== cantiereId) throw new Error('Elenco contrattuale non disponibile.')
        const { data: cantiere, error: erroreCantiere } = await supabase.from('cantieri')
          .select('id, preventivo_contrattuale_id').eq('id', cantiereId).maybeSingle()
        if (!attivo) return
        if (erroreCantiere || !cantiere || cantiere.id !== cantiereId ||
            cantiere.preventivo_contrattuale_id !== preventivoId) throw new Error('Contratto corrente non verificabile. Riapri il pannello.')
        const { data: preventivo, error: errorePreventivo } = await supabase.from('preventivi_cantiere')
          .select('id, cantiere_id').eq('id', preventivoId).eq('cantiere_id', cantiereId).maybeSingle()
        if (!attivo) return
        if (errorePreventivo || !preventivo || preventivo.id !== preventivoId || preventivo.cantiere_id !== cantiereId)
          throw new Error('Preventivo contrattuale non verificabile.')
        const base = await caricaLavorazioniPreventivoSorgente(supabase, cantiereId, preventivoId)
        if (!attivo) return
        if (base.stato === 'errore') throw new Error('Impossibile leggere le componenti del preventivo contrattuale.')
        const componenti = base.righe.map(riga => leggiComponenteContrattuale(riga, 'preventivo', 'Preventivo contrattuale'))
        const approvate = elencoVarianti.righe.filter(v =>
          v.stato === 'approvata' && v.preventivo_contrattuale_id === preventivoId)
        if (approvate.some(v => !idSorgenteValido(v.id) || !Number.isSafeInteger(v.numero) || Number(v.numero) <= 0))
          throw new Error('Dati contrattuali non verificabili.')
        approvate.sort((a, b) => Number(a.numero) - Number(b.numero) || a.id.localeCompare(b.id))
        for (const approvata of approvate) {
          let offset = 0
          for (;;) {
            const { data, error } = await supabase
              .rpc('leggi_lavorazioni_variante', { p_variante_id: approvata.id })
              .order('numero_riga', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199)
            if (!attivo) return
            if (error || !Array.isArray(data)) throw new Error('Impossibile leggere le componenti delle Varianti approvate.')
            if (data.length === 0) break
            for (const riga of data) {
              if (!recordSorgente(riga)) throw new Error('Dati contrattuali non verificabili.')
              if (!['nuova', 'aumento'].includes(String(riga.operazione)) ||
                  !(numeroLavorazione(riga.quantita_delta) > 0) || !(numeroLavorazione(riga.delta_contratto) > 0)) continue
              if (!recordSorgente(riga) || riga.variante_id !== approvata.id ||
                  !['nuova', 'aumento'].includes(String(riga.operazione)) ||
                  !Number.isSafeInteger(riga.numero_riga) || Number(riga.numero_riga) <= 0)
                throw new Error('Dati contrattuali non verificabili.')
              componenti.push(leggiComponenteContrattuale(riga, 'variante', `Variante n. ${approvata.numero} approvata`, Number(approvata.numero)))
            }
            offset += data.length
          }
        }
        const identita = componenti.map(c => `${c.tipo}:${c.id}`)
        if (new Set(identita).size !== identita.length) throw new Error('Dati contrattuali non verificabili.')
        if (attivo) setLettura({ tipo: 'elenco', componenti, contesto: elencoVarianti })
      } catch (errore) {
        if (attivo) setLettura({ tipo: 'errore', messaggio: errore instanceof Error
          ? errore.message : 'Impossibile leggere le componenti contrattuali.' })
      }
    }
    void carica()
    return () => { attivo = false; if (contestoCorrezione.current === sessione) contestoCorrezione.current = null }
  }, [cantiereId, preventivoId, variante.id, elencoVarianti])

  if (variante.stato !== 'bozza') return null
  const componenti = lettura.tipo === 'elenco' && lettura.contesto === elencoVarianti ? lettura.componenti : []
  const selezionata = componenti.find(c => `${c.tipo}:${c.id}` === componenteContrattualeSelezionata)
  const richiesta = selezionata ? preparaCorrezioneContrattuale({
    varianteId: variante.id, tipoComponente: selezionata.tipo, componenteId: selezionata.id,
    operazione, quantita: operazione === 'riduzione_residua' ? quantita : null, motivo,
  }) : null
  async function salvaCorrezione(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invioCorrezione.current || occupato || arrestata || variante.stato !== 'bozza' ||
        !selezionata || richiesta?.stato !== 'ok' || !contestoCorrezione.current) return
    const r = richiesta.richiesta, sessione = contestoCorrezione.current
    const riepilogo = `Voce contrattuale: ${selezionata.descrizione}\nOperazione: ${r.operazione === 'eliminazione_residua' ? 'Elimina residuo' : 'Riduci residuo'}${r.operazione === 'riduzione_residua' ? '\nQuantità: ' + r.quantitaRichiesta : ''}\nMotivazione: ${r.motivo}\n\nConfermare la correzione? Il server verifica il residuo e calcola il delta.`
    if (!confirm(riepilogo)) return
    invioCorrezione.current = true
    setSalvataggio(true); onInCorso(true)
    setErroreCorrezione(''); setSuccessoCorrezione('')
    try {
      const { data, error } = await supabase.rpc('aggiungi_correzione_variante', {
        p_variante_id: r.varianteId, p_tipo_componente: r.tipoComponente, p_componente_id: r.componenteId,
        p_operazione: r.operazione, p_quantita: r.operazione === 'riduzione_residua' ? r.quantitaRichiesta : null,
        p_motivo: r.motivo,
      })
      if (contestoCorrezione.current !== sessione) return
      if (error) {
        const codice = typeof error.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'non disponibile'
        setErroreCorrezione(`Correzione (${codice}): ${erroriCorrezioneVariante[codice] || 'Esito non confermato. Rileggi la bozza prima di procedere.'}`)
        setArrestata(true)
        return
      }
      const salvata = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!salvata || !lavorazioneValida(salvata) || salvata.variante_id !== r.varianteId || salvata.operazione !== r.operazione ||
          numeroLavorazione(salvata.quantita_delta) >= 0 || numeroLavorazione(salvata.delta_contratto) >= 0 ||
          String(r.tipoComponente === 'preventivo' ? salvata.riferimento_preventivo_lavorazione_id : salvata.riferimento_variante_lavorazione_id) !== String(r.componenteId) ||
          (r.tipoComponente === 'preventivo' ? salvata.riferimento_variante_lavorazione_id : salvata.riferimento_preventivo_lavorazione_id) != null) {
        setErroreCorrezione('Risposta di correzione non verificabile. Rileggi la bozza prima di procedere.')
        setArrestata(true)
        return
      }
      setSuccessoCorrezione('Correzione salvata. Rilettura delle lavorazioni e del totale richiesta.')
      setMotivo(''); setQuantita('')
      onSalvata()
    } catch {
      if (contestoCorrezione.current === sessione) {
        setErroreCorrezione('Esito della correzione non confermato. Rileggi la bozza prima di procedere.')
        setArrestata(true)
      }
    } finally {
      invioCorrezione.current = false; onInCorso(false)
      if (contestoCorrezione.current === sessione) setSalvataggio(false)
    }
  }
  const numero = (v: number) => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 20 })
  const euro = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  return <section aria-label="Modifica lavorazione contrattuale" style={{ marginTop: 16, padding: 12, border: '1px solid #e2e8f0' }}>
    <h5>Modifica lavorazione contrattuale</h5>
    <p>Seleziona una lavorazione del contratto da modificare.</p>
    <p><small>Le lavorazioni con descrizioni simili possono avere origini contrattuali diverse. Verifica l'origine prima di selezionare.</small></p>
    {(lettura.tipo === 'loading' || (lettura.tipo === 'elenco' && lettura.contesto !== elencoVarianti)) &&
      <p role="status">Caricamento componenti contrattuali...</p>}
    {lettura.tipo === 'errore' && <p role="alert">{lettura.messaggio}</p>}
    {lettura.tipo === 'elenco' && lettura.contesto === elencoVarianti && componenti.length === 0 &&
      <p>Nessuna componente contrattuale disponibile.</p>}
    {componenti.length > 0 && <label>Componente contrattuale
      <select value={selezionata ? componenteContrattualeSelezionata : ''}
        disabled={salvataggio || occupato || arrestata}
        onChange={e => setComponenteContrattualeSelezionata(e.target.value)}
        style={{ display: 'block', width: '100%', padding: 8 }}>
        <option value="">Seleziona una lavorazione</option>
        {componenti.map(c => <option key={`${c.tipo}:${c.id}`} value={`${c.tipo}:${c.id}`} title={c.descrizione}>
          {c.tipo === 'preventivo' ? '[BASE]' : `[VAR. ${c.numeroVariante}]`} {c.descrizione} — {numero(c.quantitaOriginaria)} {c.unitaMisura}
        </option>)}
      </select>
    </label>}
    {selezionata && <div>
      <dl>
        <dt>Origine</dt><dd>{selezionata.origineLabel}</dd>
        <dt>Identità</dt><dd>{selezionata.tipo === 'preventivo' ? 'Preventivo' : 'Variante'} #{selezionata.id}</dd>
        <dt>Descrizione completa</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selezionata.descrizione}</dd>
        <dt>UM</dt><dd>{selezionata.unitaMisura}</dd>
        <dt>Quantità originaria</dt><dd>{numero(selezionata.quantitaOriginaria)}</dd>
        <dt>Prezzo unitario</dt><dd>{euro(selezionata.prezzoUnitario)}</dd>
        <dt>Importo originario</dt><dd>{euro(selezionata.importoOriginario)}</dd>
      </dl>
      <p><small>Il residuo effettivamente modificabile sarà verificato dal server al momento della correzione.</small></p>
      <form onSubmit={salvaCorrezione}>
        <fieldset disabled={salvataggio || occupato || arrestata}>
          <legend>Correzione della lavorazione contrattuale</legend>
          <label>Operazione<select value={operazione} onChange={e => {
            setOperazione(e.target.value as typeof operazione); setQuantita('')
          }}>
            <option value="eliminazione_residua">Elimina residuo</option>
            <option value="riduzione_residua">Riduci residuo</option>
          </select></label>
          {operazione === 'riduzione_residua' && <label>Quantità da ridurre<input required inputMode="decimal"
            value={quantita} onChange={e => setQuantita(e.target.value)} /></label>}
          <label>Motivazione<textarea required value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
          <p>Il maturato e gli avanzamenti SAL restano invariati. Residuo e delta sono calcolati dal server.</p>
          <button type="submit" disabled={salvataggio || occupato || arrestata || richiesta?.stato !== 'ok'}>
            {salvataggio ? 'Salvataggio...' : 'Conferma correzione'}
          </button>
        </fieldset>
      </form>
    </div>}
    {erroreCorrezione && <p role="alert">{erroreCorrezione} Chiudi e riapri la bozza per verificarne lo stato; nessun retry automatico.</p>}
    {successoCorrezione && <p role="status">{successoCorrezione}</p>}
  </section>
}

type LavorazioneVariante = {
  variante_id: string
  numero_riga: number
  descrizione: string
  unita_misura: string | null
  quantita_delta: number | string
  prezzo_unitario: number | string
  delta_contratto: number | string
} & (
  // leggi_lavorazioni_variante / aggiungi_correzione_variante:
  // bigint serializzati numericamente o come testo; riferimenti DB nullable.
  {
    operazione: 'nuova' | 'aumento' | 'riduzione_residua' | 'eliminazione_residua'
    riferimento_preventivo_lavorazione_id: number | string | null
    riferimento_variante_lavorazione_id: number | string | null
  }
  // aggiungi_lavorazione_variante restituisce sempre nuova e omette i riferimenti.
  | {
    operazione: 'nuova'
    riferimento_preventivo_lavorazione_id?: never
    riferimento_variante_lavorazione_id?: never
  }
)

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

function LavorazioniVariantePanel({ varianteId, cantiereId, statoVariante, refreshEsterno = 0, onNuoviLavori, onProposta, renderApprovazione, selettoreContrattuale, sintetico = false }: {
  varianteId: string
  cantiereId?: string | null
  statoVariante: string
  refreshEsterno?: number
  onNuoviLavori?: () => void
  onProposta: (numero: number) => void
  renderApprovazione?: (lavorazioniLette: readonly LavorazioneVariante[] | null) => ReactNode
  selettoreContrattuale?: (controlli: { occupato: boolean; onInCorso: (valore: boolean) => void }) => ReactNode
  sintetico?: boolean
}) {
  const [righe, setRighe] = useState<LavorazioneVariante[]>([])
  const [confermate, setConfermate] = useState<LavorazioneVariante[]>([])
  const [origini, setOrigini] = useState<ReturnType<typeof vociCliente>>([])
  const [erroreOrigini, setErroreOrigini] = useState('')
  const [sorgentiEconomiaCollegate, setSorgentiEconomiaCollegate] = useState<Record<string, unknown>[] | null>(null)
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
  const [correzioneInCorso, setCorrezioneInCorso] = useState(false)
  const [erroreProposta, setErroreProposta] = useState('')
  const invio = useRef(false)
  const contesto = useRef<object | null>(null)
  const lavorazioniRef = useRef<HTMLHeadingElement | null>(null)
  const contrattoRef = useRef<HTMLDivElement | null>(null)
  const propostaRef = useRef<HTMLButtonElement | null>(null)
  const approvazioneRef = useRef<HTMLDivElement | null>(null)
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
      setOrigini([])
      setErroreOrigini('')
      setSorgentiEconomiaCollegate(null)
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
          if (cantiereId) {
            try {
              const sorgenti: Record<string, unknown>[] = []
              for (let offset = 0; ; offset += 200) {
                const { data, error } = await supabase.rpc('leggi_sorgenti_variante', { p_variante_id: varianteId }).order('id', { ascending: true }).range(offset, offset + 199)
                if (error || !Array.isArray(data)) throw new Error('Origini non disponibili')
                sorgenti.push(...data)
                if (data.length < 200) break
              }
              await arricchisciOriginiRapportino(sorgenti, cantiereId)
              if (!attivo) return
              setSorgentiEconomiaCollegate(sorgenti)
              setOrigini(vociCliente(elenco as unknown as Record<string, unknown>[], sorgenti))
            } catch {
              if (attivo) setErroreOrigini('Dettaglio origine non disponibile. Le lavorazioni restano consultabili.')
            }
          }
          if (!attivo) return
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
  }, [varianteId, cantiereId, refresh, refreshEsterno, statoVariante])

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
    if (invio.current || correzioneInCorso) return
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
    if (invio.current || correzioneInCorso || !modificabile || lettura !== 'elenco' || righe.length === 0 || !cantiereId) return
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
      {cantiereId && <RaccoltaSorgenteVariante client={supabase} varianteId={varianteId} cantiereId={cantiereId} sorgenti={sorgentiEconomiaCollegate} />}
      {!sintetico && <GuidaPassoSuccessivo stato={statoVariante} modificabile={modificabile}
        conteggio={lettura === 'elenco' && !nonRilette ? visibili.length : null}
        onAcquisisci={onNuoviLavori} onContratto={selettoreContrattuale ? () => portaAlControllo(contrattoRef.current) : undefined}
        onLavorazioni={() => portaAlControllo(lavorazioniRef.current)}
        onProposta={modificabile && lettura === 'elenco' && righe.length > 0 ? () => portaAlControllo(propostaRef.current) : undefined}
        onApprova={renderApprovazione ? () => portaAlControllo(approvazioneRef.current) : undefined} />}
      <h5 ref={lavorazioniRef} tabIndex={-1}>{sintetico ? 'Stato proposta / approvazione' : 'Lavorazioni della variante'}</h5>
      {modificabile && <div ref={contrattoRef} tabIndex={-1}>{selettoreContrattuale?.({ occupato: salvataggio || propostaInCorso, onInCorso: setCorrezioneInCorso })}</div>}
      {renderApprovazione && <div ref={approvazioneRef} tabIndex={-1}>
        {renderApprovazione(lettura === 'elenco' && !nonRilette ? righe : null)}
      </div>}
      {modificabile && lettura === 'elenco' && righe.length > 0 && (
        <button ref={propostaRef} type="button" disabled={propostaInCorso || salvataggio || correzioneInCorso || !cantiereId} onClick={() => void proponiVariante()}>
          {propostaInCorso ? 'Proposta in corso...' : 'Proponi variante'}
        </button>
      )}
      {erroreProposta && <p role="alert">{erroreProposta}</p>}
      {!sintetico && modificabile && !aperto && <button type="button" disabled={propostaInCorso || correzioneInCorso} onClick={() => { setAperto(true); setErroreSalvataggio(''); setSuccesso('') }}>+ Nuova lavorazione</button>}
      {!sintetico && modificabile && aperto && (
        <form onSubmit={salvaLavorazione} style={{ marginTop: 12 }}>
          <fieldset disabled={salvataggio || propostaInCorso || correzioneInCorso} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0' }}>
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
      {!sintetico && erroreOrigini && <p role="status">{erroreOrigini}</p>}
      {!sintetico && lettura === 'elenco' && origini.some(r => r.tipo === 'manodopera') && <details><summary>Vedi rapportino — Dettaglio lavori in economia</summary>
        <p>Data e ore acquisite; descrizione dal testo attuale del Rapportino, quando disponibile.</p>
        <table><thead><tr>{['Data','Descrizione','Operaio','Ore','€/h','Totale'].map(t => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{origini.filter(r => r.tipo === 'manodopera').map((r,i) => <tr key={i}><td>{r.data?.split('-').reverse().join('/') || 'Non disponibile'}</td><td>{r.descrizione}</td><td>{r.operaio}</td><td>{r.quantita}</td><td>{importoConsultazioneEconomia(r.prezzo)}</td><td>{importoConsultazioneEconomia(r.totale)}</td></tr>)}</tbody></table>
      </details>}
      {!sintetico && visibili.length > 0 && (
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
        ? <p><strong>{statoVariante === 'proposta' ? 'Proposta da approvare' : 'Totale variante'}: {euro(totale)}</strong></p>
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
      {!aperto && <button type="button" onClick={() => { setAperto(true); setErrore('') }}>Approva proposta</button>}
      {aperto && <form onSubmit={approva}>
        <fieldset disabled={inCorso} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0' }}>
          <legend>Approva proposta</legend>
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
