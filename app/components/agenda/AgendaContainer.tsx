'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import AgendaTimeline from './AgendaTimeline'
import PopupNuovaAttivita from './PopupNuovaAttivita'
import {
  AGENDA_STORAGE_KEY,
  TIPI_ATTIVITA,
  aggiungiUnOra,
  type AttivitaAgenda,
  type CollegamentoAgenda,
  type OpzioneCollegamento,
  type StatoAttivita,
  type VoceChecklistAttivita,
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

type RigaAgenda = {
  id: string
  titolo: string
  descrizione: string | null
  data: string
  ora_inizio: string
  ora_fine: string
  tipo: string
  stato: StatoAttivita
  checklist: VoceChecklistAttivita[] | null
  collegamento: CollegamentoAgenda | null
  created_at: string
}

type OperazioneAgenda =
  | { tipo: 'upsert'; attivita: AttivitaAgenda }
  | { tipo: 'delete'; id: string }

const CAMPI_AGENDA =
  'id,titolo,descrizione,data,ora_inizio,ora_fine,tipo,stato,checklist,collegamento,created_at'

function chiaveOperazioni(userId: string) {
  return `${AGENDA_STORAGE_KEY}_pending_v1_${userId}`
}

function chiaveImportazione(userId: string) {
  return `${AGENDA_STORAGE_KEY}_imported_v1_${userId}`
}

function leggiOperazioni(userId: string): OperazioneAgenda[] {
  try {
    const dati = JSON.parse(localStorage.getItem(chiaveOperazioni(userId)) || '[]')
    return Array.isArray(dati) ? dati : []
  } catch {
    return []
  }
}

function salvaOperazioni(userId: string, operazioni: OperazioneAgenda[]) {
  localStorage.setItem(chiaveOperazioni(userId), JSON.stringify(operazioni))
}

function accodaOperazione(userId: string, operazione: OperazioneAgenda) {
  const operazioni = leggiOperazioni(userId).filter((elemento) => {
    const id = elemento.tipo === 'upsert' ? elemento.attivita.id : elemento.id
    const nuovoId =
      operazione.tipo === 'upsert' ? operazione.attivita.id : operazione.id
    return id !== nuovoId
  })
  salvaOperazioni(userId, [...operazioni, operazione])
}

function rimuoviOperazione(userId: string, id: string) {
  salvaOperazioni(
    userId,
    leggiOperazioni(userId).filter((elemento) =>
      elemento.tipo === 'upsert' ? elemento.attivita.id !== id : elemento.id !== id
    )
  )
}

function daRigaSupabase(riga: RigaAgenda): AttivitaAgenda {
  const tipo = TIPI_ATTIVITA.includes(riga.tipo as (typeof TIPI_ATTIVITA)[number])
    ? (riga.tipo as (typeof TIPI_ATTIVITA)[number])
    : 'Altro'

  return {
    id: riga.id,
    titolo: riga.titolo,
    descrizione: riga.descrizione || '',
    data: riga.data,
    ora: riga.ora_inizio.slice(0, 5),
    oraFine: riga.ora_fine.slice(0, 5),
    tipo,
    stato: riga.stato,
    checklist: Array.isArray(riga.checklist) ? riga.checklist : [],
    collegamento: riga.collegamento || undefined,
    createdAt: riga.created_at,
  }
}

function perSupabase(attivita: AttivitaAgenda, userId: string) {
  return {
    id: attivita.id,
    user_id: userId,
    titolo: attivita.titolo,
    descrizione: attivita.descrizione,
    data: attivita.data,
    ora_inizio: attivita.ora,
    ora_fine: attivita.oraFine || aggiungiUnOra(attivita.ora),
    tipo: attivita.tipo,
    stato: attivita.stato,
    checklist: attivita.checklist || [],
    collegamento: attivita.collegamento || null,
    created_at: attivita.createdAt,
    updated_at: new Date().toISOString(),
  }
}

function applicaOperazioniLocali(
  attivita: AttivitaAgenda[],
  operazioni: OperazioneAgenda[]
) {
  return operazioni.reduce<AttivitaAgenda[]>((correnti, operazione) => {
    if (operazione.tipo === 'delete') {
      return correnti.filter((item) => item.id !== operazione.id)
    }
    const esiste = correnti.some((item) => item.id === operazione.attivita.id)
    return esiste
      ? correnti.map((item) =>
          item.id === operazione.attivita.id ? operazione.attivita : item
        )
      : [...correnti, operazione.attivita]
  }, attivita)
}

async function eseguiOperazioneSupabase(
  operazione: OperazioneAgenda,
  userId: string
) {
  try {
    if (operazione.tipo === 'delete') {
      const { error } = await supabase
        .from('agenda_attivita')
        .delete()
        .eq('id', operazione.id)
        .eq('user_id', userId)
      return !error
    }

    const { error } = await supabase
      .from('agenda_attivita')
      .upsert(perSupabase(operazione.attivita, userId), { onConflict: 'id' })
    return !error
  } catch {
    return false
  }
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
  const [userId, setUserId] = useState<string | null>(null)
  const [statoSincronizzazione, setStatoSincronizzazione] = useState('')
  const [popupAperto, setPopupAperto] = useState(false)
  const [attivitaInModifica, setAttivitaInModifica] =
    useState<AttivitaAgenda | null>(null)

  useEffect(() => {
    let attivo = true

    const caricaAttivita = async () => {
      const locali = leggiAttivitaLocali()
      setAttivita(locali)

      try {
        const { data: userData, error: erroreUtente } = await supabase.auth.getUser()
        if (!attivo) return
        if (erroreUtente || !userData.user) {
          setStatoSincronizzazione('Agenda salvata su questo dispositivo')
          setCaricato(true)
          return
        }

        const idUtente = userData.user.id
        setUserId(idUtente)

        const chiaveImport = chiaveImportazione(idUtente)
        const importazioneCompletata = localStorage.getItem(chiaveImport) === '1'
        if (!importazioneCompletata) {
          locali.forEach((item) =>
            accodaOperazione(idUtente, { tipo: 'upsert', attivita: item })
          )
        }

        const operazioni = leggiOperazioni(idUtente)
        const operazioniFallite: OperazioneAgenda[] = []
        for (const operazione of operazioni) {
          const riuscita = await eseguiOperazioneSupabase(operazione, idUtente)
          if (!riuscita) operazioniFallite.push(operazione)
        }
        salvaOperazioni(idUtente, operazioniFallite)
        if (!importazioneCompletata && operazioniFallite.length === 0) {
          localStorage.setItem(chiaveImport, '1')
        }

        const { data, error } = await supabase
          .from('agenda_attivita')
          .select(CAMPI_AGENDA)
          .eq('user_id', idUtente)
          .order('data', { ascending: true })
          .order('ora_inizio', { ascending: true })

        if (!attivo) return
        if (error) {
          setAttivita(applicaOperazioniLocali(locali, operazioniFallite))
          setStatoSincronizzazione('Supabase non disponibile: fallback locale attivo')
          setCaricato(true)
          return
        }

        const remote = ((data || []) as RigaAgenda[]).map(daRigaSupabase)
        setAttivita(applicaOperazioniLocali(remote, operazioniFallite))
        setStatoSincronizzazione(
          operazioniFallite.length > 0
            ? 'Alcune modifiche attendono la sincronizzazione'
            : 'Agenda sincronizzata'
        )
        setCaricato(true)
      } catch {
        if (!attivo) return
        setStatoSincronizzazione('Supabase non disponibile: fallback locale attivo')
        setCaricato(true)
      }
    }

    void caricaAttivita()
    return () => {
      attivo = false
    }
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

  const sincronizza = async (operazione: OperazioneAgenda) => {
    if (!userId) return
    const id = operazione.tipo === 'upsert' ? operazione.attivita.id : operazione.id
    const riuscita = await eseguiOperazioneSupabase(operazione, userId)
    if (riuscita) {
      rimuoviOperazione(userId, id)
      setStatoSincronizzazione('Agenda sincronizzata')
    } else {
      accodaOperazione(userId, operazione)
      setStatoSincronizzazione('Modifica salvata localmente, sincronizzazione in attesa')
    }
  }

  const cambiaStato = (id: string) => {
    const corrente = attivita.find((item) => item.id === id)
    if (!corrente) return
    const aggiornata: AttivitaAgenda = {
      ...corrente,
      stato: corrente.stato === 'completata' ? 'da_fare' : 'completata',
    }
    setAttivita((elementi) =>
      elementi.map((item) => (item.id === id ? aggiornata : item))
    )
    void sincronizza({ tipo: 'upsert', attivita: aggiornata })
  }

  const elimina = (id: string) => {
    if (!confirm('Eliminare questa attività?')) return
    setAttivita((correnti) => correnti.filter((item) => item.id !== id))
    void sincronizza({ tipo: 'delete', id })
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
          {statoSincronizzazione && (
            <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
              {statoSincronizzazione}
            </div>
          )}
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
            void sincronizza({ tipo: 'upsert', attivita: attivitaSalvata })
            chiudiPopup()
          }}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />
      )}
    </section>
  )
}
