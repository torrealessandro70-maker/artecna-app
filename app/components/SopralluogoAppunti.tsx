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
import { STRUMENTI_DISEGNO } from './note/drawing-tools'
import { DecisionBuilder, type DecisionPlan } from '../engines/decision'

import type {
  AllegatoNota,
  AnalisiNota,
  PaginaQuadernoNota,
  SegnoNota,
  StrumentoDisegno,
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

type FotoGalleriaNota = {
  id?: string
  sopralluogo_id?: string
  immagine_base64: string
  nota?: string
  tag?: string
}

type Props = {
  mostraAppuntiSopralluogo: boolean
  setMostraAppuntiSopralluogo: (v: boolean) => void
  sopralluogoAperto: SopralluogoNota
  supabase: SupabaseClient
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  integrato?: boolean
  fotoGalleria?: FotoGalleriaNota[]
  onApriGalleria?: () => void
}

export default function SopralluogoAppunti({
  mostraAppuntiSopralluogo,
  setMostraAppuntiSopralluogo,
  sopralluogoAperto,
  supabase,
  buttonPrimary,
  buttonSecondary,
  integrato = false,
  fotoGalleria = [],
  onApriGalleria,
}: Props) {
  const [notaId, setNotaId] = useState<string | null>(null)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
const [checklist, setChecklist] = useState<VoceChecklistNota[]>([])
const [disegni, setDisegni] = useState<SegnoNota[]>([])

const [pinSelezionatoId, setPinSelezionatoId] = useState<string | null>(null)
const [sfondoDisegno, setSfondoDisegno] = useState<string | null>(null)
const [undoStack, setUndoStack] = useState<SegnoNota[][]>([])
const [redoStack, setRedoStack] = useState<SegnoNota[][]>([])

const [pagineQuaderno, setPagineQuaderno] = useState<PaginaQuadernoNota[]>([
  {
    id: crypto.randomUUID(),
    titolo: 'Pagina 1',
    disegni: [],
    sfondoDisegno: null,
  },
])

const [paginaCorrenteIndex, setPaginaCorrenteIndex] = useState(0)

const pinSelezionato = disegni.find(
  (segno) => segno.id === pinSelezionatoId
)

const aggiornaMetadatiPin = (
  campo: 'titolo' | 'descrizione' | 'stato',
  valore: string
) => {

  if (!pinSelezionatoId) return

  aggiornaDisegni(
    disegni.map((segno) =>
      segno.id === pinSelezionatoId
        ? {
            ...segno,
            metadati: {
              ...segno.metadati,
              [campo]: valore,
            },
          }
        : segno
    )
  )
}


const [strumentoDisegno, setStrumentoDisegno] =
  useState<StrumentoDisegno>('penna')

const [coloreDisegno, setColoreDisegno] = useState('#111827')

const [spessoreDisegno, setSpessoreDisegno] = useState(4)

useEffect(() => {
  const preferenze = window.localStorage.getItem('artecna-quaderno-preferenze')
  if (!preferenze) return

  try {
    const dati = JSON.parse(preferenze)
    if (dati.strumentoDisegno) setStrumentoDisegno(dati.strumentoDisegno)
    if (dati.coloreDisegno) setColoreDisegno(dati.coloreDisegno)
    if (dati.spessoreDisegno) setSpessoreDisegno(dati.spessoreDisegno)
  } catch {
    window.localStorage.removeItem('artecna-quaderno-preferenze')
  }
}, [])

useEffect(() => {
  window.localStorage.setItem(
    'artecna-quaderno-preferenze',
    JSON.stringify({
      strumentoDisegno,
      coloreDisegno,
      spessoreDisegno,
    })
  )
}, [strumentoDisegno, coloreDisegno, spessoreDisegno])

const aggiornaDisegni = (
  nuoviDisegni: SegnoNota[],
  registraCronologia = true
) => {
  if (registraCronologia) {
    setUndoStack((precedenti) => [...precedenti, disegni])
    setRedoStack([])
  }

  setDisegni(nuoviDisegni)
aggiornaPaginaCorrente(nuoviDisegni)
}

const annullaDisegno = () => {
  setUndoStack((precedenti) => {
    const statoPrecedente = precedenti[precedenti.length - 1]
    if (!statoPrecedente) return precedenti

    setRedoStack((redoPrecedenti) => [disegni, ...redoPrecedenti])
    setDisegni(statoPrecedente)

    return precedenti.slice(0, -1)
  })
}

const ripristinaDisegno = () => {
  setRedoStack((precedenti) => {
    const statoSuccessivo = precedenti[0]
    if (!statoSuccessivo) return precedenti

    setUndoStack((undoPrecedenti) => [...undoPrecedenti, disegni])
    setDisegni(statoSuccessivo)

    return precedenti.slice(1)
  })
}

const aggiornaPaginaCorrente = (
  nuoviDisegni: SegnoNota[],
  nuovoSfondoDisegno = sfondoDisegno
) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            disegni: nuoviDisegni,
            sfondoDisegno: nuovoSfondoDisegno,
          }
        : pagina
    )
  )
}


const resettaFoglio = () => {
  if (!window.confirm('Vuoi resettare il foglio tecnico? Disegni, nodi e base di lavoro verranno rimossi.')) {
    return
  }

  aggiornaDisegni([])
  setSfondoDisegno(null)
  setPinSelezionatoId(null)
}

const aggiungiPagina = () => {
  const nuovaPagina: PaginaQuadernoNota = {
    id: crypto.randomUUID(),
    titolo: `Pagina ${pagineQuaderno.length + 1}`,
    disegni: [],
    sfondoDisegno: null,
  }

  setPagineQuaderno((pagineCorrenti) => [...pagineCorrenti, nuovaPagina])
  setPaginaCorrenteIndex(pagineQuaderno.length)
  setDisegni([])
  setSfondoDisegno(null)
  setPinSelezionatoId(null)
  setUndoStack([])
  setRedoStack([])
}
 
const vaiAllaPagina = (nuovoIndex: number) => {
  const pagina = pagineQuaderno[nuovoIndex]
  if (!pagina) return

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((paginaCorrente, index) =>
      index === paginaCorrenteIndex
        ? {
            ...paginaCorrente,
            disegni,
            sfondoDisegno,
          }
        : paginaCorrente
    )
  )

  setPaginaCorrenteIndex(nuovoIndex)
  setDisegni(pagina.disegni)
  setSfondoDisegno(pagina.sfondoDisegno)
  setPinSelezionatoId(null)
  setUndoStack([])
  setRedoStack([])
}
 
const [allegati, setAllegati] = useState<AllegatoNota[]>([])
  const [analisiAi, setAnalisiAi] = useState<AnalisiNota | null>(null)
const [decisionPlan, setDecisionPlan] = useState<DecisionPlan | null>(null)
  const [stato, setStato] = useState('')
  const [pronto, setPronto] = useState(false)
  const [registrazioneAttiva, setRegistrazioneAttiva] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const testoNotaRef = useRef<HTMLTextAreaElement>(null)
  const inputChecklistRefs = useRef(new Map<string, HTMLInputElement>())
  const checklistDaFocalizzareRef = useRef<string | null>(null)
  const notaVisibile = integrato || mostraAppuntiSopralluogo
  const fotoCollegate = fotoGalleria.filter(
    (foto) =>
      foto.sopralluogo_id === sopralluogoAperto.id &&
      (foto.tag || '').split(',').map((tag) => tag.trim()).includes('smart-note')
  )

  useLayoutEffect(() => {
    const textarea = testoNotaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`
  }, [testo])

  useEffect(() => {
    if (!notaVisibile || !sopralluogoAperto.id) return

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

const disegniSalvati = data.disegni || []
const sonoPagineQuaderno =
  Array.isArray(disegniSalvati) &&
  disegniSalvati.length > 0 &&
  'disegni' in disegniSalvati[0]

if (sonoPagineQuaderno) {
  const pagineSalvate = disegniSalvati as PaginaQuadernoNota[]

  setPagineQuaderno(pagineSalvate)
  setPaginaCorrenteIndex(0)
  setDisegni(pagineSalvate[0]?.disegni || [])
  setSfondoDisegno(pagineSalvate[0]?.sfondoDisegno || null)
} else {
  const paginaIniziale: PaginaQuadernoNota = {
    id: crypto.randomUUID(),
    titolo: 'Pagina 1',
    disegni: disegniSalvati,
    sfondoDisegno: null,
  }

  setPagineQuaderno([paginaIniziale])
  setPaginaCorrenteIndex(0)
  setDisegni(paginaIniziale.disegni)
  setSfondoDisegno(paginaIniziale.sfondoDisegno)
}

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
setSfondoDisegno(null)
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
    notaVisibile,
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
const pagineAggiornate = pagineQuaderno.map((pagina, index) =>
  index === paginaCorrenteIndex
    ? {
        ...pagina,
        disegni,
        sfondoDisegno,
      }
    : pagina
)

setPagineQuaderno(pagineAggiornate)


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
          disegni: pagineAggiornate,
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
  }, [titolo, testo, checklist, disegni, sfondoDisegno, analisiAi, pronto])

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

const osservaNotaConDecisionEngine = () => {
  const testoCompleto = [
    titolo,
    testo,
    ...checklist.map((voce) => voce.testo),
  ]
    .filter(Boolean)
    .join('\n')

  const builder = new DecisionBuilder()

  const piano = builder.build({
    text: testoCompleto,
    source: 'note',
    metadata: {
      sopralluogoId: sopralluogoAperto.id,
      cliente: sopralluogoAperto.cliente,
      tipoLavoro: sopralluogoAperto.tipo_lavoro,
    },
  })

  setDecisionPlan(piano)
}

  const analizzaNota = async () => {
    setStato('L’AI osserva la nota…')
osservaNotaConDecisionEngine()
    const immagini = allegati
      .filter((allegato) => allegato.tipo === 'foto')
      .map((allegato) => allegato.url)
      .concat(fotoCollegate.map((foto) => foto.immagine_base64))
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
      {!integrato && (
        <button
          type="button"
          onClick={() => setMostraAppuntiSopralluogo(!mostraAppuntiSopralluogo)}
          style={{ ...buttonPrimary, marginTop: 0 }}
        >
          📝 {mostraAppuntiSopralluogo ? 'Chiudi Note' : 'Apri Note'}
        </button>
      )}

      {notaVisibile && (
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
<div
  style={{
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  }}
>
  <button
    type="button"
   onClick={() => vaiAllaPagina(paginaCorrenteIndex - 1)}
    disabled={paginaCorrenteIndex === 0}
    style={buttonSecondary}
  >
    ◀
  </button>

  <strong>
    Pagina {paginaCorrenteIndex + 1} di {pagineQuaderno.length}
  </strong>

  <button
    type="button"
  onClick={() => vaiAllaPagina(paginaCorrenteIndex + 1)}
    disabled={paginaCorrenteIndex === pagineQuaderno.length - 1}
    style={buttonSecondary}
  >
    ▶
  </button>

  <button
    type="button"
    onClick={aggiungiPagina}
    style={buttonPrimary}
  >
    ➕ Pagina
  </button>
</div>
          </div>

          <div style={{ marginTop: 18 }}>
           <strong>Disegno</strong>
<div
  style={{
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 10,
  }}
>
  <label
    style={{
      ...buttonSecondary,
      cursor: 'pointer',
    }}
  >
    🗂 Base di lavoro
    <input
      type="file"
      accept="image/*"
      hidden
      onChange={async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()

       reader.onload = () => {
  const nuovoSfondo = reader.result as string
  setSfondoDisegno(nuovoSfondo)
  aggiornaPaginaCorrente(disegni, nuovoSfondo)
}

        reader.readAsDataURL(file)
      }}
    />
  </label>
<button
  type="button"
  onClick={() => void salvaNota()}
  style={buttonPrimary}
>
  💾 Salva 
</button>

<button
  type="button"
  onClick={resettaFoglio}
  style={buttonSecondary}
>
  🧹 Reset
</button>

  {sfondoDisegno && (
    <span style={{ fontSize: 13, color: '#16a34a' }}>
      ✅ Base caricata
    </span>
  )}
</div>
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
 {STRUMENTI_DISEGNO.map((strumento) => (
    <button
      key={strumento.id}
      type="button"
      onClick={() => setStrumentoDisegno(strumento.id)}
      style={{
        ...buttonSecondary,
        background: strumentoDisegno === strumento.id ? '#dbeafe' : buttonSecondary.background,
      transform: strumentoDisegno === strumento.id ? 'scale(1.05)' : 'scale(1)',
boxShadow: strumentoDisegno === strumento.id ? '0 0 0 2px #2563eb' : 'none',
        transition: 'all .15s ease',
      }}
    >
    {strumento.label}
    </button>
  ))}

  {[
    '#111827',
    '#dc2626',
    '#ea580c',
    '#ca8a04',
    '#16a34a',
    '#0891b2',
    '#2563eb',
    '#7c3aed',
    '#db2777',
    '#ffffff',
  ].map((colore) => (
    <button
      key={colore}
      type="button"
      onClick={() => setColoreDisegno(colore)}
      style={{
        ...buttonSecondary,
        width: 42,
        height: 42,
        padding: 0,
        background: colore,
        border: coloreDisegno === colore ? '3px solid #0f172a' : '1px solid #cbd5e1',
        boxShadow: colore === '#ffffff' ? 'inset 0 0 0 1px #94a3b8' : 'none',
      }}
      aria-label={`Colore ${colore}`}
    />
  ))}

  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: '#334155',
    }}
  >
    Spessore
    <input
      type="range"
      min={2}
      max={24}
      value={spessoreDisegno}
      onChange={(event) => setSpessoreDisegno(Number(event.target.value))}
    />
    <span>{spessoreDisegno}px</span>
  </label>

  <button
    type="button"
    onClick={annullaDisegno}
    disabled={undoStack.length === 0}
    style={{
      ...buttonSecondary,
      opacity: undoStack.length === 0 ? 0.45 : 1,
    }}
  >
    ↶ Annulla
  </button>

  <button
    type="button"
    onClick={ripristinaDisegno}
    disabled={redoStack.length === 0}
    style={{
      ...buttonSecondary,
      opacity: redoStack.length === 0 ? 0.45 : 1,
    }}
  >
    ↷ Ripristina
  </button>
</div>

<div style={{ marginTop: 10 }}>
 <NotaDisegno
  segni={disegni}
  onChange={aggiornaDisegni}
  strumento={strumentoDisegno}
  colore={coloreDisegno}
  spessore={spessoreDisegno}
  sfondo={sfondoDisegno}
  pinSelezionatoId={pinSelezionatoId}
  onSelezionaPin={setPinSelezionatoId}
/>
</div>

          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginTop: 14,
              padding: 12,
              border: '1px solid #dbeafe',
              borderRadius: 10,
              background: '#eff6ff',
              color: '#1e3a8a',
            }}
          >
            <span>
              {fotoCollegate.length === 0
                ? 'Nessuna foto collegata al Quaderno'
                : `${fotoCollegate.length} foto collegate dalla Galleria`}
            </span>
            {onApriGalleria && (
              <button type="button" onClick={onApriGalleria} style={buttonSecondary}>
                Apri Galleria
              </button>
            )}
          </div>

          {allegati.some((allegato) => allegato.tipo !== 'foto') && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
                marginTop: 14,
              }}
            >
              {allegati.filter((allegato) => allegato.tipo !== 'foto').map((allegato) => (
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

{decisionPlan && decisionPlan.proposals.length > 0 && (
  <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: '#ffffff',
        color: '#111827',
      }}
    >
      <strong style={{ color: '#111827' }}>Proposte ARTECNA</strong>

      <ul style={{ marginTop: 8, color: '#111827' }}>
        {decisionPlan.proposals.map((proposal) => (
          <li key={proposal.id} style={{ marginBottom: 8 }}>
            <strong>{proposal.title}</strong>
            {proposal.description && (
              <div style={{ fontSize: 13, color: '#475569' }}>
                {proposal.description}
              </div>
            )}
          </li>
        ))}
      </ul>

      <small style={{ color: '#64748b' }}>
        Queste sono proposte. Nessun dato viene salvato senza conferma.
      </small>
    </div>
  </div>
)}

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

      {notaVisibile && (
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
  spessore={4}
  sfondo={sfondoDisegno}
pinSelezionatoId={null}
/>
 
{pinSelezionato && (
  <section
    style={{
      marginTop: 16,
      padding: 16,
      border: '1px solid #cbd5e1',
      borderRadius: 12,
      background: '#f8fafc',
      display: 'grid',
      gap: 10,
    }}
  >
    <h3 style={{ margin: 0 }}>
      📍 Pin {pinSelezionato.metadati?.numero}
    </h3>

    <input
      value={pinSelezionato.metadati?.titolo || ''}
      onChange={(event) => aggiornaMetadatiPin('titolo', event.target.value)}
      placeholder="Titolo del punto rilevato"
      style={{
        padding: 10,
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 15,
      }}
    />

    <textarea
      value={pinSelezionato.metadati?.descrizione || ''}
      onChange={(event) => aggiornaMetadatiPin('descrizione', event.target.value)}
      placeholder="Descrizione tecnica del punto"
      rows={3}
      style={{
        padding: 10,
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 15,
        resize: 'vertical',
      }}
    />
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  {[
    ['nuovo', '🔴 Nuovo'],
    ['in_lavorazione', '🟡 In lavorazione'],
    ['risolto', '🟢 Risolto'],
  ].map(([stato, label]) => (
    <button
      key={stato}
      type="button"
      onClick={() =>
        aggiornaMetadatiPin(
          'stato',
          stato as 'nuovo' | 'in_lavorazione' | 'risolto'
        )
      }
      style={{
        ...buttonSecondary,
        background:
          pinSelezionato.metadati?.stato === stato
            ? '#dbeafe'
            : buttonSecondary.background,
      }}
    >
      {label}
    </button>
  ))}
</div>
    <small style={{ color: '#64748b' }}>
      Le informazioni vengono salvate automaticamente nel Quaderno.
    </small>
  </section>
)}
           </section>
          )}

          {fotoCollegate.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Foto collegate</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {fotoCollegate.map((foto, indice) => (
                  <figure key={foto.id || indice} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.immagine_base64}
                      alt={foto.nota || `Foto collegata ${indice + 1}`}
                      style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'contain' }}
                    />
                    {foto.nota && <figcaption style={{ marginTop: 4 }}>{foto.nota}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {allegati.some((allegato) => allegato.tipo !== 'foto') && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Allegati</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {allegati.filter((allegato) => allegato.tipo !== 'foto').map((allegato) => (
                  <figure key={allegato.id} style={{ margin: 0 }}>
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
