'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ScadenziarioFiscalePanel from './ScadenziarioFiscalePanel'
import { creaArchivioScadenziario, type ArchivioScadenziario, type ClientScadenziario, type ScadenzaPersistita } from '../engines/contabilita-ditta/scadenziarioPersistenza'
import { preparaPagamentoScadenza } from '../engines/contabilita-ditta/scadenziarioOperativo'
import { creaArchivioDocumentiFiscali, type ClientDocumentiFiscali, type DocumentoFiscale } from '../engines/contabilita-ditta/documentiFiscali'

/** Adapter iniettabile per fixture offline; nessun reader/writer viene eseguito durante SSR. */
export default function ScadenziarioPersistentePanel({ client, archivioTest, aperto, onChiudi, scadenzaDaNotifica, onDestinazioneNotificaAssente, badgeScadenziario }: { client?: ClientScadenziario & Partial<Pick<ClientDocumentiFiscali, 'storage'>>; archivioTest?: ArchivioScadenziario; aperto?: boolean; onChiudi?: () => void; scadenzaDaNotifica?: string; onDestinazioneNotificaAssente?: () => void; badgeScadenziario?: number }) {
  const archivio = useMemo(() => archivioTest || (client ? creaArchivioScadenziario(client) : null), [client, archivioTest])
  const documenti = useMemo(() => client?.storage ? creaArchivioDocumentiFiscali({ rpc: client.rpc.bind(client), storage: client.storage }) : null, [client])
  const [catalogo, setCatalogo] = useState<{ archivio: typeof documenti; righe: DocumentoFiscale[]; errore: string } | null>(null)
  const turnoDocumenti = useRef(0)
  const rileggiDocumenti = useCallback(async (attiva: () => boolean = () => true) => {
    if (!documenti) return
    const turno = ++turnoDocumenti.current
    try {
      const righe = await documenti.elenco()
      if (attiva() && turno === turnoDocumenti.current) setCatalogo({ archivio: documenti, righe, errore: '' })
    } catch (e) {
      if (attiva() && turno === turnoDocumenti.current) setCatalogo({ archivio: documenti, righe: [], errore: e instanceof Error ? e.message : 'Registro non disponibile.' })
    }
  }, [documenti])
  useEffect(() => {
    let attiva = true
    void Promise.resolve().then(() => {
      if (attiva) return rileggiDocumenti(() => attiva)
    })
    return () => { attiva = false }
  }, [rileggiDocumenti])
  const [risultato, setRisultato] = useState<{ archivio: ArchivioScadenziario; righe: ScadenzaPersistita[]; pronta: boolean; errore: string; destinazione?: string } | null>(null)
  const [occupata, setOccupata] = useState(false)
  const contestoRef = useRef<ArchivioScadenziario | null>(archivio)
  const operazioneRef = useRef(false)
  const letturaRef = useRef(0)
  const carica = useCallback(async (turno: number) => {
    if (!archivio) return
    try {
      const righe = await archivio.elenco(true)
      if (contestoRef.current === archivio && turno === letturaRef.current) setRisultato({ archivio, righe, pronta: true, errore: '', destinazione: scadenzaDaNotifica })
    } catch (error) {
      if (contestoRef.current === archivio && turno === letturaRef.current) setRisultato({ archivio, righe: [], pronta: false, errore: error instanceof Error ? error.message : 'Errore di lettura: nessun archivio vuoto sostitutivo.', destinazione: scadenzaDaNotifica })
    }
  }, [archivio, scadenzaDaNotifica])
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
  const valido = risultato?.archivio === archivio && risultato.destinazione === scadenzaDaNotifica && risultato.pronta
  const righe = valido ? risultato.righe : []
  const destinazionePresente = righe.some(r => r.id === scadenzaDaNotifica && !r.archiviataAt)
  useEffect(() => {
    if (scadenzaDaNotifica && valido && !destinazionePresente) onDestinazioneNotificaAssente?.()
  }, [scadenzaDaNotifica, valido, destinazionePresente, onDestinazioneNotificaAssente])
  async function muta(azione: () => Promise<ScadenzaPersistita>) {
    if (!archivio || !valido || operazioneRef.current) throw Error('Archivio non pronto. Rileggere prima di scrivere.')
    const contesto = archivio
    operazioneRef.current = true; setOccupata(true)
    try {
      const aggiornata = await azione()
      if (contestoRef.current !== contesto) throw Error('Sessione/contesto cambiato: esito da rileggere.')
      setRisultato({ archivio: contesto, pronta: true, errore: '', righe: [...righe.filter(r => r.id !== aggiornata.id), aggiornata], destinazione: scadenzaDaNotifica })
    } catch (error) {
      if (contestoRef.current === contesto) setRisultato({ archivio: contesto, pronta: false, righe: [], errore: error instanceof Error ? error.message : 'Scrittura non confermata. Nessun retry automatico.' })
      throw error
    } finally { operazioneRef.current = false; setOccupata(false) }
  }
  return <ScadenziarioFiscalePanel scadenzaDaNotifica={scadenzaDaNotifica} badgeScadenziario={badgeScadenziario} apertoEsterno={aperto} onChiudiEsterno={onChiudi} persistenza={{
    documenti: documenti ? {
      archivio: documenti,
      righe: catalogo?.archivio === documenti ? catalogo.righe : [],
      errore: catalogo?.archivio === documenti ? catalogo.errore : '',
      rileggi: rileggiDocumenti,
      collega: async (riga, documentoId) => {
        if (riga.revisione === undefined || !archivio) throw Error('Revisione non disponibile. Rileggere la scadenza.')
        const attesa = riga.revisione
        await muta(() => archivio.impostaDocumento(riga.id, attesa, documentoId))
      },
    } : undefined,
    righe: righe.filter(r => !r.archiviataAt), archiviate: righe.filter(r => r.archiviataAt), pronta: Boolean(valido), occupata, errore: risultato?.archivio === archivio ? risultato.errore : archivio ? '' : 'Adapter non configurato: nessuna modalità memoria sostitutiva.',
    onRileggi: () => { void rileggi() },
    onSalva: async (scadenza, modificaId, opzioni) => {
      const precedente = righe.find(r => r.id === modificaId)
      if (modificaId && !precedente) throw Error('Revisione non disponibile: rileggere.')
      if (scadenza.stato === 'Pagato' && !opzioni?.chiusuraConfermata) throw Error('Confermare esplicitamente la chiusura dell’obbligo.')
      await muta(() => precedente ? archivio!.aggiorna({ scadenza, importoPagato: precedente.importoPagato, dataPagamento: precedente.dataPagamento }, opzioni?.revisioneAttesa ?? precedente.revisione) : archivio!.crea({ scadenza, importoPagato: null, dataPagamento: null }))
    },
    onPagamento: async (id, bozza, revisioneAttesa) => {
      const precedente = righe.find(r => r.id === id && !r.archiviataAt)
      if (!precedente) throw Error('Voce non disponibile: rileggere.')
      const dati = preparaPagamentoScadenza(precedente, bozza)
      await muta(() => archivio!.aggiorna(dati, revisioneAttesa ?? precedente.revisione))
    },
    onArchivia: async (id, motivo, revisioneAttesa) => {
      const precedente = righe.find(r => r.id === id)
      if (!precedente) throw Error('Voce da archiviare non disponibile: rileggere.')
      await muta(() => archivio!.archivia(id, revisioneAttesa ?? precedente.revisione, motivo))
    },
  }} />
}
