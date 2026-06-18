'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react'
import { flushSync } from 'react-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import NotaDisegno from './note/NotaDisegno'
import type {
  AllegatoNota,
  AnalisiNota,
  SegnoNota,
  VoceChecklistNota,
} from './note/types'

type SopralluogoNota = {
  id?: string
  cliente?: string
  indirizzo?: string
  data_sopralluogo?: string
  ora_appuntamento?: string
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

type FotoInCoda = {
  id: string
  file: File
  anteprima: string
}

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
  const [fotoInCoda, setFotoInCoda] = useState<FotoInCoda[]>([])
  const [salvataggioFotoAttivo, setSalvataggioFotoAttivo] = useState(false)
  const [analisiAi, setAnalisiAi] = useState<AnalisiNota | null>(null)
  const [stato, setStato] = useState('')
  const [pronto, setPronto] = useState(false)
  const [registrazioneAttiva, setRegistrazioneAttiva] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const testoNotaRef = useRef<HTMLTextAreaElement>(null)
  const inputChecklistRefs = useRef(new Map<string, HTMLInputElement>())
  const checklistDaFocalizzareRef = useRef<string | null>(null)
  const fotoInCodaRef = useRef<FotoInCoda[]>([])

  useEffect(() => {
    fotoInCodaRef.current = fotoInCoda
  }, [fotoInCoda])

  useEffect(
    () => () => {
      fotoInCodaRef.current.forEach((foto) => URL.revokeObjectURL(foto.anteprima))
    },
    []
  )

  useLayoutEffect(() => {
    const textarea = testoNotaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`
  }, [testo])

  useEffect(() => {
    if (!mostraAppuntiSopralluogo || !sopralluogoAperto.id) return

    let attivo = true

    const caricaNota = async () => {
      fotoInCodaRef.current.forEach((foto) => URL.revokeObjectURL(foto.anteprima))
      setFotoInCoda([])
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
    if (files.length === 0) return []

    const id = notaId || (await salvaNota(false))
    if (!id || !sopralluogoAperto.id) return []

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return []

    setStato('Caricamento allegati…')

    const fileSalvati: File[] = []

    for (const file of files) {
      const nomePulito = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `utenti/${userData.user.id}/sopralluoghi/${sopralluogoAperto.id}/note/${Date.now()}_${crypto.randomUUID()}_${nomePulito}`

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
        fileSalvati.push(file)
      } else {
        await supabase.storage.from('preventivi').remove([path])
        setStato(`Errore salvataggio allegato: ${error?.message || 'operazione non riuscita'}`)
      }
    }

    if (fileSalvati.length === files.length) {
      setStato(files.length === 1 ? 'Allegato caricato' : 'Allegati caricati')
    }
    return fileSalvati
  }

  const caricaFile = (
    event: ChangeEvent<HTMLInputElement>,
    tipo: AllegatoNota['tipo']
  ) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    void salvaFile(files, tipo)
  }

  const aggiungiFotoInCoda = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith('image/')
    )
    event.target.value = ''
    if (files.length === 0) return

    const nuoveFoto = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      anteprima: URL.createObjectURL(file),
    }))
    setFotoInCoda((correnti) => [
      ...correnti,
      ...nuoveFoto,
    ])
    setStato(
      files.length === 1
        ? 'Foto aggiunta, pronta da salvare'
        : `${files.length} foto aggiunte, pronte da salvare`
    )
  }

  const rimuoviFotoInCoda = (id: string) => {
    const fotoDaRimuovere = fotoInCoda.find((foto) => foto.id === id)
    if (fotoDaRimuovere) URL.revokeObjectURL(fotoDaRimuovere.anteprima)
    setFotoInCoda((correnti) => correnti.filter((foto) => foto.id !== id))
  }

  const salvaFotoInCoda = async () => {
    if (fotoInCoda.length === 0 || salvataggioFotoAttivo) return

    setSalvataggioFotoAttivo(true)
    const codaDaSalvare = fotoInCoda
    try {
      const fileSalvati = await salvaFile(
        codaDaSalvare.map((foto) => foto.file),
        'foto'
      )
      const salvati = new Set(fileSalvati)

      codaDaSalvare
        .filter((foto) => salvati.has(foto.file))
        .forEach((foto) => URL.revokeObjectURL(foto.anteprima))
      setFotoInCoda((correnti) =>
        correnti.filter((foto) => !salvati.has(foto.file))
      )

      if (fileSalvati.length === codaDaSalvare.length) {
        setStato(
          fileSalvati.length === 1
            ? 'Foto salvata'
            : `${fileSalvati.length} foto salvate`
        )
      } else {
        setStato(
          `${codaDaSalvare.length - fileSalvati.length} foto non salvate: riprova`
        )
      }
    } catch {
      setStato('Upload non riuscito: le foto sono ancora pronte da salvare')
    } finally {
      setSalvataggioFotoAttivo(false)
    }
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
    const id = crypto.randomUUID()
    checklistDaFocalizzareRef.current = id

    flushSync(() => {
      setChecklist((corrente) => [
        ...corrente,
        { id, testo: '', completata: false },
      ])
    })

    const input = inputChecklistRefs.current.get(id)
    input?.focus()
    checklistDaFocalizzareRef.current = null
  }

  const stampaNota = () => window.print()

  const dataSopralluogo = sopralluogoAperto.data_sopralluogo
    ? new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(`${sopralluogoAperto.data_sopralluogo}T00:00:00`))
    : ''
  const dataOraSopralluogo = [
    dataSopralluogo,
    sopralluogoAperto.ora_appuntamento
      ? `ore ${sopralluogoAperto.ora_appuntamento.slice(0, 5)}`
      : '',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <section style={{ marginTop: 16 }}>
      <style>{`
        .smart-note-print {
          display: none;
        }

        @media print {
          @page {
            margin: 16mm;
          }

          body * {
            visibility: hidden !important;
          }

          .smart-note-print,
          .smart-note-print * {
            visibility: visible !important;
          }

          .smart-note-print {
            display: block !important;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            color: #111 !important;
            background: #fff !important;
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.45;
          }

          .smart-note-print [role='toolbar'] {
            display: none !important;
          }

          .smart-note-print section,
          .smart-note-print article,
          .smart-note-print figure,
          .smart-note-print li {
            break-inside: avoid;
          }

          .smart-note-print svg,
          .smart-note-print img {
            max-width: 100% !important;
          }
        }
      `}</style>
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
            <button type="button" onClick={stampaNota} style={buttonSecondary}>
              🖨️ Stampa nota
            </button>
            <span style={{ fontSize: 13, color: '#64748b' }}>{stato}</span>
          </div>

          <textarea
            ref={testoNotaRef}
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
              resize: 'none',
              overflow: 'hidden',
              fontSize: 16,
              lineHeight: 1.6,
            }}
          />

          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 14,
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <strong style={{ fontSize: 17, color: '#0f172a' }}>Checklist</strong>
              <button
                type="button"
                onClick={aggiungiChecklist}
                style={{
                  ...buttonSecondary,
                  minHeight: 48,
                  padding: '10px 16px',
                  fontWeight: 800,
                }}
              >
                + Aggiungi controllo
              </button>
            </div>

            {checklist.length === 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: 14,
                }}
              >
                Aggiungi un controllo e scrivi ciò che deve essere verificato.
              </div>
            )}

            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {checklist.map((voce) => (
                <div
                  key={voce.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    minHeight: 62,
                    padding: 8,
                    border: voce.completata
                      ? '1px solid #86efac'
                      : '1px solid #cbd5e1',
                    borderRadius: 12,
                    background: voce.completata ? '#f0fdf4' : '#fff',
                    transition: 'background 160ms ease, border-color 160ms ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={voce.completata}
                    aria-label={
                      voce.completata
                        ? `Segna come da completare: ${voce.testo || 'controllo'}`
                        : `Segna come completato: ${voce.testo || 'controllo'}`
                    }
                    onChange={(event) =>
                      setChecklist((corrente) =>
                        corrente.map((item) =>
                          item.id === voce.id
                            ? { ...item, completata: event.target.checked }
                            : item
                        )
                      )
                    }
                    style={{
                      width: 28,
                      height: 28,
                      flex: '0 0 28px',
                      margin: 0,
                      accentColor: '#16a34a',
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    ref={(element) => {
                      if (element) {
                        inputChecklistRefs.current.set(voce.id, element)
                        if (checklistDaFocalizzareRef.current === voce.id) {
                          element.focus()
                        }
                      } else {
                        inputChecklistRefs.current.delete(voce.id)
                      }
                    }}
                    value={voce.testo}
                    onChange={(event) =>
                      setChecklist((corrente) =>
                        corrente.map((item) =>
                          item.id === voce.id ? { ...item, testo: event.target.value } : item
                        )
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        aggiungiChecklist()
                      }
                    }}
                    placeholder="Nuovo controllo..."
                    aria-label="Testo del controllo"
                    style={{
                      flex: '1 1 auto',
                      width: '100%',
                      minWidth: 0,
                      minHeight: 46,
                      padding: '10px 12px',
                      border: '1px solid #94a3b8',
                      borderRadius: 9,
                      background: '#fff',
                      color: voce.completata ? '#64748b' : '#0f172a',
                      fontSize: 16,
                      lineHeight: 1.35,
                      textDecoration: voce.completata ? 'line-through' : 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChecklist((corrente) => corrente.filter((item) => item.id !== voce.id))
                    }
                    style={{
                      ...buttonSecondary,
                      width: 48,
                      height: 48,
                      flex: '0 0 48px',
                      padding: 0,
                      borderColor: '#fecaca',
                      color: '#991b1b',
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                    aria-label={`Elimina controllo: ${voce.testo || 'senza testo'}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <strong>Disegno</strong>
            <div style={{ marginTop: 10 }}>
              <NotaDisegno
                segni={disegni}
                onChange={setDisegni}
                strumento="penna"
                colore="#111827"
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
                multiple
                onChange={aggiungiFotoInCoda}
                style={{ display: 'none' }}
              />
            </label>
            <label style={{ ...buttonSecondary, cursor: 'pointer' }}>
              Galleria foto
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={aggiungiFotoInCoda}
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

          {fotoInCoda.length > 0 && (
            <section
              style={{
                marginTop: 14,
                padding: 14,
                border: '2px solid #93c5fd',
                borderRadius: 14,
                background: '#eff6ff',
              }}
              aria-label="Foto pronte da salvare"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ color: '#1e3a8a', fontSize: 16 }}>
                  {fotoInCoda.length}{' '}
                  {fotoInCoda.length === 1
                    ? 'foto pronta da salvare'
                    : 'foto pronte da salvare'}
                </strong>
                <button
                  type="button"
                  onClick={() => void salvaFotoInCoda()}
                  disabled={salvataggioFotoAttivo}
                  style={{
                    ...buttonPrimary,
                    minHeight: 52,
                    padding: '12px 20px',
                    fontSize: 16,
                    fontWeight: 800,
                    opacity: salvataggioFotoAttivo ? 0.65 : 1,
                  }}
                >
                  {salvataggioFotoAttivo ? 'Salvataggio...' : 'Salva tutte'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: 10,
                  marginTop: 12,
                }}
              >
                {fotoInCoda.map((foto, indice) => (
                  <figure
                    key={foto.id}
                    style={{
                      position: 'relative',
                      margin: 0,
                      overflow: 'hidden',
                      borderRadius: 12,
                      border: '1px solid #bfdbfe',
                      background: '#fff',
                      aspectRatio: '1 / 1',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.anteprima}
                      alt={`Foto in attesa ${indice + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => rimuoviFotoInCoda(foto.id)}
                      disabled={salvataggioFotoAttivo}
                      aria-label={`Rimuovi foto ${indice + 1}`}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 44,
                        height: 44,
                        border: '2px solid #fff',
                        borderRadius: '50%',
                        background: 'rgba(15, 23, 42, 0.82)',
                        color: '#fff',
                        fontSize: 24,
                        lineHeight: 1,
                        cursor: salvataggioFotoAttivo ? 'default' : 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </figure>
                ))}
              </div>
            </section>
          )}

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

      {mostraAppuntiSopralluogo && (
        <article className="smart-note-print" aria-hidden="true">
          <header style={{ borderBottom: '1px solid #94a3b8', paddingBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>{titolo || 'Nota sopralluogo'}</h1>
            {(sopralluogoAperto.cliente || sopralluogoAperto.indirizzo) && (
              <p style={{ margin: '8px 0 0' }}>
                {sopralluogoAperto.cliente && <strong>{sopralluogoAperto.cliente}</strong>}
                {sopralluogoAperto.cliente && sopralluogoAperto.indirizzo && ' - '}
                {sopralluogoAperto.indirizzo}
              </p>
            )}
            {dataOraSopralluogo && (
              <p style={{ margin: '4px 0 0' }}>Sopralluogo: {dataOraSopralluogo}</p>
            )}
          </header>

          {testo && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Nota</h2>
              <div style={{ whiteSpace: 'pre-wrap' }}>{testo}</div>
            </section>
          )}

          {checklist.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Checklist</h2>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {checklist.map((voce) => (
                  <li key={voce.id} style={{ marginBottom: 5 }}>
                    <span aria-hidden="true">{voce.completata ? '☑' : '☐'}</span>{' '}
                    {voce.testo || 'Controllo senza descrizione'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {disegni.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Disegno</h2>
              <NotaDisegno
                segni={disegni}
                onChange={setDisegni}
                strumento="penna"
                colore="#111827"
              />
            </section>
          )}

          {allegati.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Allegati</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {allegati.map((allegato) => (
                  <figure key={allegato.id} style={{ margin: 0 }}>
                    {allegato.tipo === 'foto' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={allegato.url}
                        alt={allegato.nome_file}
                        style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'contain' }}
                      />
                    )}
                    <figcaption style={{ marginTop: 4 }}>{allegato.nome_file}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {analisiAi && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Analisi AI</h2>
              <strong>Sintesi</strong>
              <div>{analisiAi.sintesi}</div>
              {analisiAi.ipotesi.length > 0 && (
                <>
                  <strong>Possibili cause</strong>
                  <ul>{analisiAi.ipotesi.map((item) => <li key={item}>{item}</li>)}</ul>
                </>
              )}
              {analisiAi.verifiche.length > 0 && (
                <>
                  <strong>Da verificare</strong>
                  <ul>{analisiAi.verifiche.map((item) => <li key={item}>{item}</li>)}</ul>
                </>
              )}
              {analisiAi.domande.length > 0 && (
                <>
                  <strong>Informazioni mancanti</strong>
                  <ul>{analisiAi.domande.map((item) => <li key={item}>{item}</li>)}</ul>
                </>
              )}
              <small>{analisiAi.avvertenza}</small>
            </section>
          )}
        </article>
      )}
    </section>
  )
}
