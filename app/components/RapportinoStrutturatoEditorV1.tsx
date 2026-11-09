'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import RapportinoPrestazioniEditorV1 from './RapportinoPrestazioniEditorV1'
import { useCoordinatoreRapportinoV1, type ContestoCoordinatoreRapportino } from '../engines/rapportini/useCoordinatoreRapportinoV1'
import type { TrasportoRapportinoV1 } from '../engines/rapportini/trasportoRapportinoV1'
import type { StatoRapportinoV2 } from '../engines/rapportini/contrattoMaterialiRapportino'

export type CoordinatoreEditorRapportino = ReturnType<typeof useCoordinatoreRapportinoV1>
type Props = {
  canale: 'desktop' | 'portale'
  cantiereId: string
  data: string
  rapportinoId?: string
  trasporto: TrasportoRapportinoV1
  contesto: ContestoCoordinatoreRapportino
  letturaIniziale?: StatoRapportinoV2
  onClose: () => void
  onSaved?: (rapportinoId: string) => void
  foto?: ReactNode
  children?: (value: { coordinatore: CoordinatoreEditorRapportino; editor: ReactNode }) => ReactNode
}

/** One coordinator/editor composition. Identity and compatibility V0 belong to wrappers. */
export default function RapportinoStrutturatoEditorV1({ canale, cantiereId, data, rapportinoId,
  trasporto, contesto, letturaIniziale, onClose, onSaved, foto, children }: Props) {
  const coordinatore = useCoordinatoreRapportinoV1(contesto, trasporto, { materiali: true, letturaIniziale })
  const notificata = useRef('')
  useEffect(() => {
    const s = coordinatore.salvatoV1
    if (!s || contesto.salvataggioAttivo || contesto.statoInCorso || coordinatore.riletturaV1Fallita
      || !letturaIniziale || s.revisione <= (letturaIniziale.dettaglio?.revisione ?? 0)) return
    const key = `${s.rapportino_id}/${s.revisione}`
    if (notificata.current !== key) { notificata.current = key; onSaved?.(s.rapportino_id) }
  }, [coordinatore.salvatoV1, coordinatore.riletturaV1Fallita, contesto.salvataggioAttivo, contesto.statoInCorso, letturaIniziale, onSaved])
  const editor = coordinatore.editorProps ? <>
    <RapportinoPrestazioniEditorV1 {...coordinatore.editorProps} onClose={() => {
      if (contesto.salvataggioInCorso.current) return
      coordinatore.editorProps?.onClose()
      onClose()
    }} />
    {foto}
  </> : null
  return <div data-rapportino-canale={canale} data-cantiere-id={cantiereId} data-data={data}
    data-rapportino-id={rapportinoId}>
    {children ? children({ coordinatore, editor }) : editor}
  </div>
}
