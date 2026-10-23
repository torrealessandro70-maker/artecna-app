'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AllegatoNota } from './note/types'
import { BUCKET_QUADERNO } from '../engines/quaderno/storagePrivato'
import { erroreQuaderno } from '../engines/quaderno/persistenza'

export default function AllegatoQuadernoPrivato({ allegato, supabase }: { allegato: AllegatoNota; supabase: SupabaseClient }) {
  const bucket = allegato.storage_bucket || BUCKET_QUADERNO
  const [url, setUrl] = useState('')
  const [errore, setErrore] = useState('')
  useEffect(() => {
    let attivo = true
    async function aggiorna() {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(allegato.storage_path, 300)
        if (error) throw error
        if (attivo) { setUrl(data.signedUrl); setErrore('') }
      } catch (error) { if (attivo) { setUrl(''); setErrore(erroreQuaderno(error as Error)) } }
    }
    void aggiorna()
    const timer = window.setInterval(() => void aggiorna(), 240_000)
    return () => { attivo = false; window.clearInterval(timer) }
  }, [supabase, allegato.storage_path, bucket])

  async function apri() {
    // Nuova autorizzazione ad ogni apertura, mai il vecchio URL del record.
    const finestra = window.open('about:blank', '_blank')
    if (finestra) finestra.opener = null
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(allegato.storage_path, 300)
      if (error) throw error
      if (!finestra) throw new Error('Consenti l’apertura della finestra per leggere l’allegato')
      finestra.location.replace(data.signedUrl)
      setErrore('')
    } catch (error) { finestra?.close(); setErrore(erroreQuaderno(error as Error)) }
  }
  return <div>
    {url && allegato.mime_type?.startsWith('image/') && <img src={url} alt={allegato.nome_file} style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
    {url && allegato.tipo === 'audio' && <audio controls src={url} style={{ width: '100%' }} />}
    <button type="button" onClick={() => void apri()}>Apri {allegato.nome_file}</button>
    {errore && <p role="alert">{errore}</p>}
  </div>
}
