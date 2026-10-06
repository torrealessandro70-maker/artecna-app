'use client'

import type { ComponentProps } from 'react'
import type RapportinoPrestazioniEditorV1 from '../components/RapportinoPrestazioniEditorV1'
import { decimaleMateriale, deltaMaterialiBozza, erroriMaterialeBozza } from '../engines/rapportini/materialiBozzaV1'
import { originalePrestazioneBozza, prestazioniAttiveBozza, validaPrestazioneBozza } from '../engines/rapportini/bozzaRapportinoV1'

type Props = Pick<ComponentProps<typeof RapportinoPrestazioniEditorV1>,
  'bozza' | 'operai' | 'varianti' | 'salvabile' | 'retryDisponibile' | 'salvataggioInCorso' | 'disabled'> & {
  conflitto: boolean; riletturaFallita: boolean
}

/** M2.6D temporanea, solo Mobile: nessuna scrittura o callback. */
export default function DiagnosticaMaterialiMobile({ bozza, operai, varianti, salvabile = false,
  retryDisponibile = false, salvataggioInCorso = false, disabled = false, conflitto, riletturaFallita }: Props) {
  const righe = bozza.materialiStrutturati?.righe || []
  if (!righe.length) return null
  let deltaOk = false
  try { deltaMaterialiBozza(bozza); deltaOk = true } catch { /* Mai renderizzare eccezioni grezze. */ }
  const materialiValidi = righe.every(r => erroriMaterialeBozza(r).length === 0) && deltaOk
  const operaiValidi = bozza.prestazioni.nuove.every(p => operai.some(o => o.id === p.operaio_id))
  const cacheValida = varianti.stato === 'pronte' && varianti.cantiere_id === bozza.cantiere_id
  const erroriPrestazioni = prestazioniAttiveBozza(bozza).some(p =>
    validaPrestazioneBozza(p, cacheValida ? varianti.varianti : [], originalePrestazioneBozza(bozza, p)).length > 0)
  const domini: string[] = []
  if (!salvabile) {
    if (!materialiValidi) domini.push('MATERIALI')
    if (!operaiValidi) domini.push('OPERAI')
    if (erroriPrestazioni) domini.push('PRESTAZIONI')
    if (!domini.length) domini.push('ALTRO')
  }
  const disabledFinale = disabled || !salvabile || retryDisponibile
  return <aside aria-label="Diagnostica temporanea materiali Mobile" style={{ padding: 12,
    border: '1px dashed #64748b', borderRadius: 8, fontSize: 13, overflowWrap: 'anywhere' }}>
    <strong>Diagnostica temporanea Materiali</strong>
    {righe.map((r, i) => {
      let quantita = 'INVALIDA'
      try { quantita = decimaleMateriale(r.quantita, true) } catch { /* Solo esito statico. */ }
      const errori = erroriMaterialeBozza(r)
      return <pre key={i} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{[
        `Riga ${i + 1}`,
        `descrizione_presente: ${!!r.descrizione.trim()}`,
        `quantita_raw: [${r.quantita}]`,
        `quantita_normalizzata: ${quantita}`,
        `um_raw: [${r.unita_misura}]`,
        `costo: ${r.costo_unitario === null || r.costo_unitario.trim() === '' ? 'VUOTO' : 'PRESENTE'}`,
        `errori_riga: ${errori.length ? errori.join(' | ') : 'NESSUNO'}`,
      ].join('\n')}</pre>
    })}
    <pre style={{ whiteSpace: 'pre-wrap' }}>{[
      `materiali_validi: ${materialiValidi}`,
      `delta_materiali: ${deltaOk ? 'OK' : 'ERRORE'}`,
      `bozza_salvabile: ${salvabile}`,
      `retry_disponibile: ${retryDisponibile}`,
      `conflitto: ${conflitto}`,
      `rilettura_fallita: ${riletturaFallita}`,
      `salvataggio_attivo: ${salvataggioInCorso}`,
      `disabled_finale: ${disabledFinale}`,
      ...(!salvabile ? [`dominio_bloccante: ${domini.join(', ')}`] : []),
      ...(disabledFinale ? [`motivo_disabled: ${[
        ...(disabled ? [salvataggioInCorso ? 'SALVATAGGIO' : 'CONTROLLO STATO'] : []),
        ...domini, ...(conflitto ? ['CONFLITTO'] : []),
        ...(riletturaFallita ? ['RILETTURA FALLITA'] : []), ...(retryDisponibile ? ['RETRY'] : []),
      ].join(', ')}`] : []),
    ].join('\n')}</pre>
  </aside>
}
