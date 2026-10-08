'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { ErroreLetturaFotoDesktop, leggiBlobFotoDesktop } from '../engines/rapportini/letturaFotoDesktop'

export default function FotoPrivataDesktopV1({ allegato, rapportino, foto, style, onClick }: {
  allegato: string; rapportino?: string; foto?: string; style?: CSSProperties; onClick?: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ url?: string; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    setResult({})
    const { data: subscription } = supabase.auth.onAuthStateChange(event => {
      if (event === 'INITIAL_SESSION') return
      controller.abort()
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined }
      setResult({}); setAttempt(n => n + 1)
    })
    void (async () => {
      try {
        if (!rapportino || !foto) throw new ErroreLetturaFotoDesktop(409)
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) throw new ErroreLetturaFotoDesktop(401)
        const blob = await leggiBlobFotoDesktop({ allegato, rapportino, foto }, data.session.access_token, controller.signal)
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setResult({ url: objectUrl })
      } catch (e) {
        if (!controller.signal.aborted) setResult({ error: e instanceof ErroreLetturaFotoDesktop ? e.message : 'Foto non disponibile. Riprova la lettura.' })
      }
    })()
    return () => { controller.abort(); subscription.subscription.unsubscribe(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [allegato, rapportino, foto, attempt])
  if (result.url) return <img src={result.url} alt="Foto Rapportino privata" style={style} onClick={onClick} />
  return <div role={result.error ? 'alert' : 'status'}>
    <p>{result.error || 'Caricamento foto…'}</p>
    {result.error && <button type="button" onClick={e => { e.stopPropagation(); setAttempt(n => n + 1) }}>Riprova lettura</button>}
  </div>
}
