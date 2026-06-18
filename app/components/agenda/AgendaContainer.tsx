'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import AgendaTimeline from './AgendaTimeline'
import PopupNuovaAttivita from './PopupNuovaAttivita'
import {
  AGENDA_STORAGE_KEY,
  type AttivitaAgenda,
  type OpzioneCollegamento,
} from './utils'

type SopralluogoAgenda = {
  id?: string
  cliente?: string
  tipo_lavoro?: string
  data_sopralluogo?: string
}

type CantiereAgenda = {
  id?: string
  nome?: string
}

type PreventivoAgenda = {
  id?: string
  cantiere?: string
  nome_file?: string
}

type Props = {
  sopralluoghi: SopralluogoAgenda[]
  cantieri: CantiereAgenda[]
  preventivi: PreventivoAgenda[]
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

function leggiAttivitaLocali() {
  try {
    const dati = JSON.parse(localStorage.getItem(AGENDA_STORAGE_KEY) || '[]')
    if (!Array.isArray(dati)) return []
    return dati.filter(
      (item): item is AttivitaAgenda =>
        Boolean(item?.id && item?.titolo && item?.data && item?.tipo && item?.stato)
    )
  } catch {
    return []
  }
}

export default function AgendaContainer({
  sopralluoghi,
  cantieri,
  preventivi,
  cardStyle,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [attivita, setAttivita] = useState<AttivitaAgenda[]>([])
  const [caricato, setCaricato] = useState(false)
  const [popupAperto, setPopupAperto] = useState(false)
  const [attivitaInModifica, setAttivitaInModifica] =
    useState<AttivitaAgenda | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAttivita(leggiAttivitaLocali())
      setCaricato(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!caricato) return
    localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(attivita))
  }, [attivita, caricato])

  const opzioniCollegamento = useMemo<OpzioneCollegamento[]>(() => {
    const opzioni: OpzioneCollegamento[] = []

    sopralluoghi.forEach((sopralluogo, indice) => {
      const id = String(sopralluogo.id || indice)
      const cliente = sopralluogo.cliente || 'Cliente non indicato'
      opzioni.push({
        tipo: 'sopralluogo',
        id,
        valore: `sopralluogo:${id}`,
        etichetta: [cliente, sopralluogo.tipo_lavoro, sopralluogo.data_sopralluogo]
          .filter(Boolean)
          .join(' · '),
      })
    })

    cantieri.forEach((cantiere, indice) => {
      const id = String(cantiere.id || indice)
      opzioni.push({
        tipo: 'cantiere',
        id,
        valore: `cantiere:${id}`,
        etichetta: cantiere.nome || 'Cantiere senza nome',
      })
    })

    preventivi.forEach((preventivo, indice) => {
      const id = String(preventivo.id || indice)
      opzioni.push({
        tipo: 'preventivo',
        id,
        valore: `preventivo:${id}`,
        etichetta: preventivo.nome_file || preventivo.cantiere || 'Preventivo',
      })
    })

    const clienti = Array.from(
      new Set(sopralluoghi.map((sopralluogo) => sopralluogo.cliente).filter(Boolean))
    ) as string[]
    clienti.forEach((cliente) => {
      opzioni.push({
        tipo: 'cliente',
        valore: `cliente:${cliente}`,
        etichetta: cliente,
      })
    })

    return opzioni
  }, [cantieri, preventivi, sopralluoghi])

  const cambiaStato = (id: string) => {
    setAttivita((correnti) =>
      correnti.map((item) =>
        item.id === id
          ? {
              ...item,
              stato: item.stato === 'completata' ? 'da_fare' : 'completata',
            }
          : item
      )
    )
  }

  const elimina = (id: string) => {
    if (!confirm('Eliminare questa attività?')) return
    setAttivita((correnti) => correnti.filter((item) => item.id !== id))
  }

  const chiudiPopup = () => {
    setPopupAperto(false)
    setAttivitaInModifica(null)
  }

  return (
    <section style={{ ...cardStyle, maxWidth: 1050, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Agenda</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>
            Attività operative collegate ai Fascicoli ARTECNA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAttivitaInModifica(null)
            setPopupAperto(true)
          }}
          style={{
            ...buttonPrimary,
            minHeight: 52,
            padding: '12px 18px',
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          + Nuova attività
        </button>
      </div>

      {!caricato ? (
        <div style={{ padding: 20, color: '#64748b' }}>Caricamento agenda...</div>
      ) : (
        <AgendaTimeline
          attivita={attivita}
          onModifica={(item) => {
            setAttivitaInModifica(item)
            setPopupAperto(true)
          }}
          onCambiaStato={cambiaStato}
          onElimina={elimina}
          buttonSecondary={buttonSecondary}
        />
      )}

      {popupAperto && (
        <PopupNuovaAttivita
          aperto
          attivitaInModifica={attivitaInModifica}
          opzioniCollegamento={opzioniCollegamento}
          onChiudi={chiudiPopup}
          onSalva={(attivitaSalvata) => {
            setAttivita((correnti) =>
              attivitaInModifica
                ? correnti.map((item) =>
                    item.id === attivitaSalvata.id ? attivitaSalvata : item
                  )
                : [...correnti, attivitaSalvata]
            )
            chiudiPopup()
          }}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />
      )}
    </section>
  )
}
