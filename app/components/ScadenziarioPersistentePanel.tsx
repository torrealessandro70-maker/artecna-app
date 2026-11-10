'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ScadenziarioFiscalePanel from './ScadenziarioFiscalePanel'
import { creaArchivioScadenziario, type ArchivioScadenziario, type ClientScadenziario, type ScadenzaPersistita } from '../engines/contabilita-ditta/scadenziarioPersistenza'

/** Adapter iniettabile per fixture offline; nessun reader/writer viene eseguito durante SSR. */
export default function ScadenziarioPersistentePanel({ client, archivioTest }: { client?: ClientScadenziario; archivioTest?: ArchivioScadenziario }) {
  const archivio = useMemo(() => archivioTest || (client ? creaArchivioScadenziario(client) : null), [client, archivioTest])
  const [risultato, setRisultato] = useState<{ archivio: ArchivioScadenziario; righe: ScadenzaPersistita[]; pronta: boolean; errore: string } | null>(null)
  const [occupata, setOccupata] = useState(false)
  const contestoRef = useRef<ArchivioScadenziario | null>(archivio)
  const operazioneRef = useRef(false)
  const letturaRef = useRef(0)
  const carica = useCallback(async (turno: number) => {
    if (!archivio) return
    try {
      const righe = await archivio.elenco()
      if (contestoRef.current === archivio && turno === letturaRef.current) setRisultato({ archivio, righe, pronta: true, errore: '' })
    } catch (error) {
      if (contestoRef.current === archivio && turno === letturaRef.current) setRisultato({ archivio, righe: [], pronta: false, errore: error instanceof Error ? error.message : 'Errore di lettura: nessun archivio vuoto sostitutivo.' })
    }
  }, [archivio])
  const rileggi = useCallback(() => {
    if (!archivio || operazioneRef.current) return
    const turno = ++letturaRef.current
    setRisultato({ archivio, righe: [], pronta: false, errore: '' })
    void carica(turno)
  }, [archivio, carica])
  useEffect(() => {
    contestoRef.current = archivio
    const turno = ++letturaRef.current
    void carica(turno)
    return () => { contestoRef.current = null }
  }, [archivio, carica])
  const valido = risultato?.archivio === archivio && risultato.pronta
  const righe = valido ? risultato.righe : []
  async function muta(azione: () => Promise<ScadenzaPersistita>) {
    if (!archivio || !valido || operazioneRef.current) throw Error('Archivio non pronto. Rileggere prima di scrivere.')
    const contesto = archivio
    operazioneRef.current = true; setOccupata(true)
    try {
      const aggiornata = await azione()
      if (contestoRef.current !== contesto) throw Error('Sessione/contesto cambiato: esito da rileggere.')
      setRisultato({ archivio: contesto, pronta: true, errore: '', righe: aggiornata.archiviataAt ? righe.filter(r => r.id !== aggiornata.id) : [...righe.filter(r => r.id !== aggiornata.id), aggiornata] })
    } catch (error) {
      if (contestoRef.current === contesto) setRisultato({ archivio: contesto, pronta: false, righe: [], errore: error instanceof Error ? error.message : 'Scrittura non confermata. Nessun retry automatico.' })
      throw error
    } finally { operazioneRef.current = false; setOccupata(false) }
  }
  return <ScadenziarioFiscalePanel persistenza={{
    righe, pronta: Boolean(valido), occupata, errore: risultato?.archivio === archivio ? risultato.errore : archivio ? '' : 'Adapter non configurato: nessuna modalità memoria sostitutiva.',
    onRileggi: () => { void rileggi() },
    onSalva: async (scadenza, modificaId) => {
      const precedente = righe.find(r => r.id === modificaId)
      if (modificaId && !precedente) throw Error('Revisione non disponibile: rileggere.')
      await muta(() => precedente ? archivio!.aggiorna({ scadenza, importoPagato: precedente.importoPagato, dataPagamento: precedente.dataPagamento }, precedente.revisione) : archivio!.crea({ scadenza, importoPagato: null, dataPagamento: null }))
    },
    onArchivia: async (id, motivo) => {
      const precedente = righe.find(r => r.id === id)
      if (!precedente) throw Error('Voce da archiviare non disponibile: rileggere.')
      await muta(() => archivio!.archivia(id, precedente.revisione, motivo))
    },
  }} />
}
