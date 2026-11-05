'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import SopralluogoAppunti from './SopralluogoAppunti'
import VistaOperativa from './VistaOperativa'
import { componiContestoPdf, type PaginePdfSopralluogo } from '../lib/quadernoPdf'
export type FotoPdfSopralluogo = { id?: string; sopralluogo_id?: string; immagine_base64: string; nota?: string }
export type RecordPdfSopralluogo = { id: string; cliente?: string; firma_cliente?: string | null }
export type ContestoPdfSopralluogo = { sopralluogoId: string; firma: string; foto: readonly FotoPdfSopralluogo[]; pagine: readonly string[] }
export default function PdfSopralluogoFocus({ sopralluogo, db, generaPdf, onChiudi }: {
  sopralluogo: RecordPdfSopralluogo; db: SupabaseClient
  generaPdf: (s: RecordPdfSopralluogo, contesto: ContestoPdfSopralluogo) => Promise<void>; onChiudi: () => void
}) {
  const [fase, setFase] = useState('Caricamento appunti del sopralluogo…')
  const [errore, setErrore] = useState(false)
  const [esportate, setEsportate] = useState<{ presente: boolean; pagine: number } | null>(null)
  const attivo = useRef(true)
  const completato = useRef(false)
  const generaRef = useRef(generaPdf)
  useEffect(() => { generaRef.current = generaPdf }, [generaPdf])
  useEffect(() => { attivo.current = true; return () => { attivo.current = false } }, [])
  const fallisci = useCallback((e: unknown) => { if (!attivo.current) return; console.error('Preparazione PDF sopralluogo:', e); setErrore(true); setFase('Impossibile preparare il PDF del sopralluogo selezionato. Riprova.') }, [])
  const pronto = useCallback(async (appunti: PaginePdfSopralluogo) => {
    if (!attivo.current || completato.current) return
    completato.current = true
    try {
      if (appunti.sopralluogoId !== sopralluogo.id) throw Error('UUID export non corrispondente')
      setEsportate({ presente: appunti.quadernoPresente, pagine: appunti.pagine.length })
      setFase('Preparazione PDF: caricamento firma e foto…')
      const [record, foto] = await Promise.all([
        db.from('sopralluoghi').select('*').eq('id', sopralluogo.id).single(),
        db.from('foto_sopralluogo').select('id,sopralluogo_id,nota,immagine_base64,tag,includi_preventivo,created_at').eq('sopralluogo_id', sopralluogo.id).order('created_at', { ascending: false }),
      ])
      if (!attivo.current) return
      if (record.error || foto.error || !record.data) throw record.error || foto.error || Error('Sopralluogo non disponibile')
      const contesto = componiContestoPdf(sopralluogo.id, record.data as RecordPdfSopralluogo, (foto.data || []) as FotoPdfSopralluogo[], appunti)
      await generaRef.current(contesto.sopralluogo, contesto)
      if (attivo.current) setFase('PDF pronto: download avviato.')
    } catch (e) { fallisci(e) }
  }, [db, sopralluogo.id, fallisci])
  const richiesta = useMemo(() => ({ sopralluogoId: sopralluogo.id, onReady: pronto, onErrore: fallisci }), [sopralluogo.id, pronto, fallisci])
  return <VistaOperativa titolo="PDF sopralluogo" contesto={sopralluogo.cliente} etichettaRitorno="← Torna a Sopralluoghi" onChiudi={onChiudi}>
    <p data-pdf-sopralluogo-id={sopralluogo.id} data-pdf-pagine={esportate?.pagine} data-pdf-quaderno-presente={esportate?.presente} role={errore ? 'alert' : 'status'} style={{ color: errore ? '#b91c1c' : '#334155' }}>{fase}</p>
    <div aria-hidden="true" inert style={{ position: 'fixed', left: -100000, top: 0, width: 1400, visibility: 'hidden', pointerEvents: 'none' }}>
      <SopralluogoAppunti key={sopralluogo.id} richiestaExportPdf={richiesta} sopralluogoAperto={sopralluogo} supabase={db} integrato mostraAppuntiSopralluogo={false} setMostraAppuntiSopralluogo={() => {}} buttonPrimary={{}} buttonSecondary={{}} />
    </div>
  </VistaOperativa>
}
