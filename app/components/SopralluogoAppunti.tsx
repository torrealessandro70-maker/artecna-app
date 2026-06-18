'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import NotaDisegno from './note/NotaDisegno'
import type {
  AllegatoNota,
  AnalisiNota,
  SegnoNota,
  StrumentoDisegno,
  VoceChecklistNota,
} from './note/types'

type SopralluogoNota = {
  id?: string
  cliente?: string
  indirizzo?: string
  tipo_lavoro?: string
}

type Props = {
  mostraAppuntiSopralluogo: boolean
  setMostraAppuntiSopralluogo: (v: boolean) => void
  sopralluogoAperto: SopralluogoNota
  supabase: SupabaseClient
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

const colori = ['#111827', '#2563eb', '#dc2626', '#16a34a', '#f59e0b']

export default function SopralluogoAppunti({
  mostraAppuntiSopralluogo,
  setMostraAppuntiSopralluogo,
  sopralluogoAperto,
  supabase,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [notaId, setNotaId] = useState<string | null>(null)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [checklist, setChecklist] = useState<VoceChecklistNota[]>([])
  const [disegni, setDisegni] = useState<SegnoNota[]>([])
  const [allegati, setAllegati] = useState<AllegatoNota[]>([])
  const [strumento, setStrumento] = useState<StrumentoDisegno>('penna')
  const [colore, setColore] = useState(colori[0])
  const [analisiAi, setAnalisiAi] = useState<AnalisiNota | null>(null)
  const [stato, setStato] = useState('')
  const [pronto, setPronto] = useState(false)
  const [registrazioneAttiva, setRegistrazioneAttiva] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (!mostraAppuntiSopralluogo || !sopralluogoAperto.id) return

    let attivo = true

    const caricaNota = async () => {
      setPronto(false)
      setNotaId(null)
      setStato('Caricamento nota…')

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setStato('Accedi per utilizzare le note')
        return
      }

      const { data, error } = await supabase
        .from('note_sopralluogo')
        .select('*')
        .eq('sopralluogo_id', sopralluogoAperto.id)
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (!attivo) return
      if (error) {
        setStato('Sistema Note non configurato: applicare la migrazione Supabase')
        return
      }

      if (data) {
        setNotaId(data.id)
        setTitolo(data.titolo || '')
        setTesto(data.testo || '')
        setChecklist(data.checklist || [])
        setDisegni(data.disegni || [])
        setAnalisiAi(data.analisi_ai || null)

        const { data: file } = await supabase
          .from('note_allegati')
          .select('*')
          .eq('nota_id', data.id)
          .order('created_at', { ascending: true })

        setAllegati(file || [])
      } else {
        setTitolo(
          sopralluogoAperto.tipo_lavoro ||
            `Nota ${sopralluogoAperto.cliente || 'sopralluogo'}`
        )
        setTesto('')
        setChecklist([])
        setDisegni([])
        setAllegati([])
        setAnalisiAi(null)
      }

      setPronto(true)
      setStato('Nota pronta')
    }

    void caricaNota()
    return () => {
      attivo = false
    }
  }, [
    mostraAppuntiSopralluogo,
    sopralluogoAperto.id,
    sopralluogoAperto.cliente,
    sopralluogoAperto.tipo_lavoro,
    supabase,
  ])

  const salvaNota = async (mostraConferma = true) => {
    if (!sopralluogoAperto.id) return null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setStato('Accedi per salvare la nota')
      return null
    }

    setStato('Salvataggio…')
    const { data, error } = await supabase
      .from('note_sopralluogo')
      .upsert(
        {
          sopralluogo_id: sopralluogoAperto.id,
          user_id: userData.user.id,
          titolo: titolo.trim(),
          testo,
          checklist,
          disegni,
          analisi_ai: analisiAi,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sopralluogo_id' }
      )
      .select('id')
      .single()

    if (error) {
      setStato(`Errore salvataggio: ${error.message}`)
      return null
    }

    setNotaId(data.id)
    setStato(mostraConferma ? 'Nota salvata' : 'Salvata automaticamente')
    return data.id as string
  }

  useEffect(() => {
    if (!pronto) return
    const timer = window.setTimeout(() => void salvaNota(false), 900)
    return () => window.clearTimeout(timer)
    // Il debounce deve reagire soltanto al contenuto modificabile della nota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titolo, testo, checklist, disegni, analisiAi, pronto])

  const salvaFile = async (
    files: File[],
    tipo: AllegatoNota['tipo']
  ) => {
    if (files.length === 0) return

    const id = notaId || (await salvaNota(false))
    if (!id || !sopralluogoAperto.id) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    setStato('Caricamento allegati…')

    for (const file of files) {
      const nomePulito = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `utenti/${userData.user.id}/sopralluoghi/${sopralluogoAperto.id}/note/${Date.now()}_${nomePulito}`

      const { error: uploadError } = await supabase.storage
        .from('preventivi')
        .upload(path, file)

      if (uploadError) {
        setStato(`Errore caricamento: ${uploadError.message}`)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('preventivi')
        .getPublicUrl(path)

      const { data: allegato, error } = await supabase
        .from('note_allegati')
        .insert({
          nota_id: id,
          user_id: userData.user.id,
          nome_file: file.name,
          tipo,
          mime_type: file.type || null,
          storage_path: path,
          url: urlData.publicUrl,
        })
        .select('*')
        .single()

      if (!error && allegato) {
        setAllegati((correnti) => [...correnti, allegato])
      }
    }

    setStato('Allegati caricati')
  }

  const caricaFile = (
    event: ChangeEvent<HTMLInputElement>,
    tipo: AllegatoNota['tipo']
  ) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    void salvaFile(files, tipo)
  }

  const eliminaAllegato = async (allegato: AllegatoNota) => {
    await supabase.storage.from('preventivi').remove([allegato.storage_path])
    const { error } = await supabase
      .from('note_allegati')
      .delete()
      .eq('id', allegato.id)

    if (!error) {
      setAllegati((correnti) => correnti.filter((item) => item.id !== allegato.id))
    }
  }

  const avviaRegistrazione = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStato('Registrazione audio non supportata su questo dispositivo')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const tipoAudio = recorder.mimeType || 'audio/webm'
        const estensione = tipoAudio.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(audioChunksRef.current, { type: tipoAudio })
        const file = new File(
          [blob],
          `Nota_vocale_${Date.now()}.${estensione}`,
          { type: tipoAudio }
        )
        void salvaFile([file], 'audio')
      }
      recorder.start()
      recorderRef.current = recorder
      setRegistrazioneAttiva(true)
      setStato('Registrazione in corso…')
    } catch {
      setStato('Permesso microfono non concesso')
    }
  }

  const fermaRegistrazione = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRegistrazioneAttiva(false)
  }

  const analizzaNota = async () => {
    setStato('L’AI osserva la nota…')
    const immagini = allegati
      .filter((allegato) => allegato.tipo === 'foto')
      .map((allegato) => allegato.url)
    const audio = allegati
      .filter((allegato) => allegato.tipo === 'audio')
      .map((allegato) => ({
        url: allegato.url,
        nome: allegato.nome_file,
      }))

    const response = await fetch('/api/analizza-nota-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo,
        testo,
        checklist,
        immagini,
        audio,
        disegni,
        contesto: sopralluogoAperto,
      }),
    })
    const risultato = await response.json()

    if (!response.ok) {
      setStato(`Errore AI: ${risultato.error || 'analisi non disponibile'}`)
      return
    }

    setAnalisiAi(risultato)
    setStato('Analisi AI aggiornata')
  }

  const aggiungiChecklist = () => {
    setChecklist((corrente) => [
      ...corrente,
      { id: crypto.randomUUID(), testo: '', completata: false },
    ])
  }

  return (
    <section style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setMostraAppuntiSopralluogo(!mostraAppuntiSopralluogo)}
        style={{ ...buttonPrimary, marginTop: 0 }}
      >
        📝 {mostraAppuntiSopralluogo ? 'Chiudi Note' : 'Apri Note'}
      </button>

      {mostraAppuntiSopralluogo && (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            border: '1px solid #cbd5e1',
            borderRadius: 16,
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={titolo}
              onChange={(event) => setTitolo(event.target.value)}
              placeholder="Titolo della nota"
              style={{
                flex: '1 1 280px',
                padding: 12,
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 700,
              }}
            />
            <button type="button" onClick={() => void salvaNota()} style={buttonPrimary}>
              Salva ora
            </button>
            <span style={{ fontSize: 13, color: '#64748b' }}>{stato}</span>
          </div>

          <textarea
            value={testo}
            onChange={(event) => setTesto(event.target.value)}
            placeholder="Scrivi ciò che osservi: muro umido, distacco intonaco, misure…"
            style={{
              width: '100%',
              minHeight: 180,
              marginTop: 14,
              padding: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              resize: 'vertical',
              fontSize: 16,
              lineHeight: 1.6,
            }}
          />

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong>Checklist</strong>
              <button type="button" onClick={aggiungiChecklist} style={buttonSecondary}>
                + Aggiungi controllo
              </button>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {checklist.map((voce) => (
                <div key={voce.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={voce.completata}
                    onChange={(event) =>
                      setChecklist((corrente) =>
                        corrente.map((item) =>
                          item.id === voce.id
                            ? { ...item, completata: event.target.checked }
                            : item
                        )
                      )
                    }
                  />
                  <input
                    value={voce.testo}
                    onChange={(event) =>
                      setChecklist((corrente) =>
                        corrente.map((item) =>
                          item.id === voce.id ? { ...item, testo: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Verifica da eseguire"
                    style={{ flex: 1, padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChecklist((corrente) => corrente.filter((item) => item.id !== voce.id))
                    }
                    style={buttonSecondary}
                    aria-label="Elimina voce"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <strong>Disegno</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
              {(['penna', 'evidenziatore', 'freccia', 'cerchio'] as StrumentoDisegno[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStrumento(item)}
                    style={strumento === item ? buttonPrimary : buttonSecondary}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                )
              )}
              {colori.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColore(item)}
                  aria-label={`Colore ${item}`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: item,
                    border: colore === item ? '3px solid #fff' : '1px solid #94a3b8',
                    boxShadow: colore === item ? '0 0 0 2px #0f172a' : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => setDisegni((correnti) => correnti.slice(0, -1))}
                style={buttonSecondary}
              >
                Annulla
              </button>
              <button type="button" onClick={() => setDisegni([])} style={buttonSecondary}>
                Pulisci
              </button>
            </div>
       <div
  style={{
    touchAction: 'none',
    overscrollBehavior: 'contain',
  }}
>
  <NotaDisegno
    segni={disegni}
    onChange={setDisegni}
    strumento={strumento}
    colore={colore}
  />
</div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <label style={{ ...buttonPrimary, cursor: 'pointer' }}>
              📷 Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void caricaFile(event, 'foto')}
                style={{ display: 'none' }}
              />
            </label>
            <label style={{ ...buttonSecondary, cursor: 'pointer' }}>
              📎 Allegati
              <input
                type="file"
                multiple
                onChange={(event) => void caricaFile(event, 'allegato')}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="button"
              onClick={registrazioneAttiva ? fermaRegistrazione : () => void avviaRegistrazione()}
              style={{
                ...buttonSecondary,
                background: registrazioneAttiva ? '#fee2e2' : buttonSecondary.background,
              }}
            >
              {registrazioneAttiva ? '■ Ferma registrazione' : '🎤 Registra audio'}
            </button>
          </div>

          {allegati.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
                marginTop: 14,
              }}
            >
              {allegati.map((allegato) => (
                <article
                  key={allegato.id}
                  style={{ padding: 10, border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff' }}
                >
                  {allegato.tipo === 'foto' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={allegato.url} alt={allegato.nome_file} style={{ width: '100%', borderRadius: 8 }} />
                  )}
                  {allegato.tipo === 'audio' && <audio controls src={allegato.url} style={{ width: '100%' }} />}
                  <a href={allegato.url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8 }}>
                    {allegato.nome_file}
                  </a>
                  <button
                    type="button"
                    onClick={() => void eliminaAllegato(allegato)}
                    style={{ ...buttonSecondary, marginTop: 8 }}
                  >
                    Elimina
                  </button>
                </article>
              ))}
            </div>
          )}

         <aside
  style={{
    marginTop: 18,
    padding: 16,
    border: '1px solid #c4b5fd',
    borderRadius: 14,
    background: '#faf5ff',
    color: '#111827',
WebkitTextFillColor: '#111827',
  }}
>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong>AI osservatore</strong>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                  Non modifica ciò che scrivi. Propone ipotesi e controlli.
                </div>
              </div>
              <button type="button" onClick={() => void analizzaNota()} style={buttonPrimary}>
                ✨ Analizza nota
              </button>
            </div>

          {analisiAi && (
  <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
    <div style={{ padding: 10, borderRadius: 10, background: '#ffffff', color: '#111827' }}>
      <strong style={{ color: '#111827' }}>Sintesi</strong>
      <div style={{ color: '#111827' }}>{analisiAi.sintesi}</div>
    </div>

    <div style={{ padding: 10, borderRadius: 10, background: '#ffffff', color: '#111827' }}>
      <strong style={{ color: '#111827' }}>Possibili cause</strong>
      <ul style={{ color: '#111827' }}>
        {analisiAi.ipotesi.map((item) => (
          <li key={item} style={{ color: '#111827' }}>{item}</li>
        ))}
      </ul>
    </div>

    <div style={{ padding: 10, borderRadius: 10, background: '#ffffff', color: '#111827' }}>
      <strong style={{ color: '#111827' }}>Da verificare</strong>
      <ul style={{ color: '#111827' }}>
        {analisiAi.verifiche.map((item) => (
          <li key={item} style={{ color: '#111827' }}>{item}</li>
        ))}
      </ul>
    </div>

    {analisiAi.domande.length > 0 && (
      <div style={{ padding: 10, borderRadius: 10, background: '#ffffff', color: '#111827' }}>
        <strong style={{ color: '#111827' }}>Informazioni mancanti</strong>
        <ul style={{ color: '#111827' }}>
          {analisiAi.domande.map((item) => (
            <li key={item} style={{ color: '#111827' }}>{item}</li>
          ))}
        </ul>
      </div>
    )}

    <small style={{ color: '#334155' }}>{analisiAi.avvertenza}</small>
  </div>
)}
          </aside>
        </div>
      )}
    </section>
  )
}
