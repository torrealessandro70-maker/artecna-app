'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import VistaOperativa from './VistaOperativa'
import styles from './CentroNotifiche.module.css'

type Client = { rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> }
type Riga = { id: string; titolo: string; messaggio: string; priorita: string; modulo: string; published_at: string; data_evento?: string; read_at: string | null; attiva: boolean }
type Preferenze = { generali: boolean; in_app: boolean; scadenziario: boolean; anticipi: number[]; agenda?: boolean; anticipi_agenda?: number[]; sopralluoghi?: boolean; rapportini?: boolean; anticipi_sopralluoghi?: number[]; revisione: number }
export type DestinazioneRapportino = { cantiere_id: string; giorno_lavoro: string; bozza_id?: string | null }
type Destinazione = { azione: string; record_id: string } & Partial<DestinazioneRapportino>
type Contatori = { totale: number; scadenziario: number; agenda?: number; sopralluoghi?: number; rapportini?: number }
const vuoti: Contatori = { totale: 0, scadenziario: 0 }
const filtri = { tutte: 'Tutte', da_leggere: 'Da leggere', urgenti: 'Scadute / urgenti' }
const moduli: Record<string, string> = { scadenziario: 'Scadenziario', agenda: 'Agenda', sopralluoghi: 'Sopralluoghi', rapportini: 'Rapportini' }
const canali = { generali: 'Notifiche generali', in_app: 'Notifiche in-app', scadenziario: 'Scadenziario' } as const
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const dataRoma = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' })
const nonDisponibile = 'Destinazione non disponibile.'

async function rpc<T>(client: Client, nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(nome, args)
  if (error) throw new Error(error.code === '40001'
    ? 'Preferenze modificate in un’altra sessione. Rileggi prima di salvare.'
    : 'Operazione non confermata. Rileggi prima di riprovare.')
  return data as T
}

export function BadgeNotifiche({ count }: { count: number }) {
  return count > 0 ? <span className={styles.badge} aria-label={count + ' elementi con avvisi da leggere'}>{count}</span> : null
}

export default function CentroNotifiche({ client, stile, menuImpostazioni, onApriScadenza, onApriAgenda, onApriSopralluogo, onApriRapportino, onContatori, destinazioneAssente }: {
  client: Client
  stile: CSSProperties
  menuImpostazioni: boolean
  destinazioneAssente?: number
  onApriScadenza: (id: string) => void
  onApriAgenda?: (id: string) => void
  onApriSopralluogo?: (id: string) => void
  onApriRapportino?: (dati: DestinazioneRapportino) => void
  onContatori: (value: Contatori) => void
}) {
  const [vistaScelta, setVista] = useState<'centro' | 'preferenze' | null>(null)
  const [destinazioneGestita, setDestinazioneGestita] = useState<number>()
  const respinta = destinazioneAssente !== undefined && destinazioneAssente !== destinazioneGestita
  const vista = respinta ? 'centro' : vistaScelta
  const [contatori, setContatori] = useState(vuoti)
  const [filtro, setFiltro] = useState<keyof typeof filtri>('tutte')
  const [pagina, setPagina] = useState(0)
  const [righe, setRighe] = useState<Riga[] | null>(null)
  const [preferenze, setPreferenze] = useState<Preferenze | null>(null)
  const [errore, setErrore] = useState('')
  const [avviso, setAvviso] = useState('')
  const [occupata, setOccupata] = useState(false)
  const [rilettura, setRilettura] = useState(0)
  const campanella = useRef<HTMLButtonElement>(null)
  const aggiornaContatori = useCallback(async (attivo: () => boolean) => {
    try {
      const prossimi = await rpc<Contatori>(client, 'contatori_notifiche')
      if (attivo()) { setContatori(prossimi); onContatori(prossimi) }
    } catch {
      if (attivo()) { setContatori(vuoti); onContatori(vuoti) }
    }
  }, [client, onContatori])

  useEffect(() => {
    let attivo = true
    const aggiorna = () => { if (!document.hidden) void aggiornaContatori(() => attivo) }
    aggiorna()
    window.addEventListener('focus', aggiorna)
    window.addEventListener('artecna:notifiche-rileggi', aggiorna)
    const timer = window.setInterval(aggiorna, 60_000)
    return () => { attivo = false; window.removeEventListener('focus', aggiorna); window.removeEventListener('artecna:notifiche-rileggi', aggiorna); window.clearInterval(timer) }
  }, [aggiornaContatori, rilettura])

  const apriDestinazione = useCallback(async (id: string) => {
    if (!uuid.test(id)) return null
    const destinazione = await rpc<Destinazione | null>(client, 'risolvi_destinazione_notifica', { p_id: id })
    return destinazione && uuid.test(destinazione.record_id) &&
      (destinazione.azione === 'apri_scadenza_fiscale' || destinazione.azione === 'apri_attivita_agenda' || destinazione.azione === 'apri_sopralluogo' ||
       (destinazione.azione === 'apri_rapportino_atteso' && uuid.test(destinazione.cantiere_id ?? '')
         && /^\d{4}-\d{2}-\d{2}$/.test(destinazione.giorno_lavoro ?? ''))) ? destinazione : null
  }, [client])

  const apriRecord = useCallback(({ azione, record_id, cantiere_id, giorno_lavoro, bozza_id }: Destinazione) => {
    if (azione === 'apri_attivita_agenda') onApriAgenda?.(record_id)
    else if (azione === 'apri_sopralluogo') onApriSopralluogo?.(record_id)
    else if (azione === 'apri_rapportino_atteso' && cantiere_id && giorno_lavoro) onApriRapportino?.({ cantiere_id, giorno_lavoro, bozza_id })
    else onApriScadenza(record_id)
  }, [onApriAgenda, onApriScadenza, onApriSopralluogo, onApriRapportino])

  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get('notifica')
    if (id === null) return
    let attivo = true
    void apriDestinazione(id).catch(() => null).then(record => {
      if (!attivo) return
      if (record) apriRecord(record)
      else { setAvviso(nonDisponibile); setVista('centro') }
    })
    return () => { attivo = false }
  }, [apriDestinazione, apriRecord])

  useEffect(() => {
    let attivo = true
    const fallita = () => { if (attivo) setErrore('Lettura non disponibile. Riprova con Rileggi.') }
    if (vista === 'centro') {
      void rpc<Riga[]>(client, 'lista_notifiche', { p_filtro: filtro, p_offset: pagina * 50 })
        .then(dati => { if (attivo) setRighe(dati) }, fallita)
    }
    if (vista === 'preferenze') {
      void rpc<Preferenze>(client, 'leggi_preferenze_notifiche')
        .then(dati => { if (attivo) setPreferenze(dati) }, fallita)
    }
    return () => { attivo = false }
  }, [client, filtro, pagina, rilettura, vista])

  function cambiaVista(prossima: typeof vistaScelta) {
    setDestinazioneGestita(destinazioneAssente)
    setVista(prossima)
  }

  function ricarica() {
    setErrore('')
    setRighe(null)
    setPreferenze(null)
    setRilettura(n => n + 1)
  }

  async function azione(riga: Riga, tipo: 'apri' | 'leggi' | 'archivia') {
    setErrore('')
    setOccupata(true)
    try {
      if (tipo === 'apri') {
        const id = await apriDestinazione(riga.id)
        if (!id) { setAvviso(nonDisponibile); return }
        const url = new URL(window.location.href)
        url.searchParams.set('notifica', riga.id)
        window.history.replaceState(null, '', url)
        cambiaVista(null)
        apriRecord(id)
        return
      }
      const modificata = await rpc<boolean>(client, 'aggiorna_stato_notifica', { p_id: riga.id, p_azione: tipo })
      if (!modificata) throw new Error('Notifica non disponibile. Rileggi il centro notifiche.')
      ricarica()
    } catch (error) {
      if (tipo === 'apri') setAvviso(nonDisponibile)
      else setErrore(error instanceof Error ? error.message : 'Operazione non confermata.')
    } finally { setOccupata(false) }
  }

  async function salva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preferenze || occupata) return
    setErrore('')
    setOccupata(true)
    try {
      await rpc(client, 'salva_preferenze_notifiche', {
        p_revisione: preferenze.revisione, p_generali: preferenze.generali,
        p_in_app: preferenze.in_app, p_scadenziario: preferenze.scadenziario, p_anticipi: preferenze.anticipi,
        ...(preferenze.agenda === undefined ? {} : { p_agenda: preferenze.agenda, p_anticipi_agenda: preferenze.anticipi_agenda }),
        ...(preferenze.rapportini === undefined ? {} : { p_rapportini: preferenze.rapportini }),
        ...(preferenze.sopralluoghi === undefined ? {} : { p_sopralluoghi: preferenze.sopralluoghi, p_anticipi_sopralluoghi: preferenze.anticipi_sopralluoghi }),
      })
      setAvviso('Preferenze salvate.')
      ricarica()
    } catch (error) {
      setPreferenze(null)
      setErrore(error instanceof Error ? error.message : 'Salvataggio non confermato.')
    } finally { setOccupata(false) }
  }

  return <>
    <button ref={campanella} type="button" style={stile} onClick={() => { cambiaVista('centro'); setAvviso(''); ricarica() }}>
      🔔 Centro notifiche <BadgeNotifiche count={contatori.totale} />
    </button>
    {menuImpostazioni && <button type="button" style={stile} onClick={() => { cambiaVista('preferenze'); setAvviso(''); ricarica() }}>Notifiche</button>}
    {vista && <VistaOperativa titolo={vista === 'centro' ? 'Centro notifiche' : 'Impostazioni · Notifiche'} etichettaRitorno="← Chiudi"
      occupata={occupata} ritornoFocusRef={campanella} onChiudi={() => cambiaVista(null)}>
      <div className={styles.pannello}>
        {errore && <p role="alert">{errore}</p>}
        {(respinta || avviso) && <p role="status">{respinta ? nonDisponibile : avviso}</p>}
        <button type="button" onClick={ricarica} disabled={occupata}>Rileggi</button>
        {vista === 'centro' ? <>
          <div className={styles.azioni} aria-label="Filtri notifiche">
            {Object.entries(filtri).map(([chiave, etichetta]) => <button type="button" key={chiave}
              aria-pressed={chiave === filtro} disabled={occupata}
              onClick={() => { if (chiave !== filtro) { setRighe(null); setErrore(''); setPagina(0); setFiltro(chiave as keyof typeof filtri) } }}>{etichetta}</button>)}
          </div>
          {righe === null && !errore && <p role="status">Caricamento…</p>}
          {righe?.length === 0 && <p>Nessuna notifica in questa vista.</p>}
          {righe && <ul className={styles.elenco}>{righe.map(riga => <li key={riga.id}>
            <strong>{riga.titolo}</strong> · {riga.priorita} · {riga.read_at ? 'Letta' : 'Non letta'}{!riga.attiva && ' · Storico'}
            <p>{riga.messaggio}</p>
            <p>{moduli[riga.modulo] ?? riga.modulo} · <time dateTime={riga.data_evento ?? riga.published_at}>{dataRoma.format(new Date(riga.data_evento ?? riga.published_at))}</time></p>
            <div className={styles.azioni}>
              <button type="button" disabled={occupata} onClick={() => void azione(riga, 'apri')}>Apri</button>
              {!riga.read_at && <button type="button" disabled={occupata} onClick={() => void azione(riga, 'leggi')}>Segna letta</button>}
              <button type="button" disabled={occupata} onClick={() => void azione(riga, 'archivia')}>Archivia</button>
            </div>
          </li>)}</ul>}
          <div className={styles.azioni}>
            {pagina > 0 && <button type="button" disabled={occupata} onClick={() => { setRighe(null); setPagina(pagina - 1) }}>Indietro</button>}
            {righe?.length === 50 && <button type="button" disabled={occupata} onClick={() => { setRighe(null); setPagina(pagina + 1) }}>Altre notifiche</button>}
          </div>
        </> : preferenze ? <form onSubmit={salva}>
          <fieldset disabled={occupata}>
            <legend>Canali e moduli</legend>
            {(Object.keys(canali) as (keyof typeof canali)[]).map(chiave => <label key={chiave}>
              <input type="checkbox" checked={preferenze[chiave]} onChange={event => setPreferenze({ ...preferenze, [chiave]: event.target.checked })} /> {canali[chiave]}
            </label>)}
          </fieldset>
          <fieldset disabled={occupata}>
            <legend>Avvisi Scadenziario</legend>
            {[30, 7, 3, 0].map(anticipo => <label key={anticipo}><input type="checkbox" checked={preferenze.anticipi.includes(anticipo)}
              onChange={event => setPreferenze({ ...preferenze, anticipi: event.target.checked ? [...preferenze.anticipi, anticipo] : preferenze.anticipi.filter(n => n !== anticipo) })} />
              {' '}{anticipo === 0 ? 'Giorno stesso' : anticipo + ' giorni prima'}
            </label>)}
            <p>Gli avvisi per le scadenze superate restano attivi se il modulo è abilitato.</p>
          </fieldset>
          {(['agenda', 'sopralluoghi'] as const).map(modulo => {
            const anticipi = modulo === 'agenda' ? 'anticipi_agenda' : 'anticipi_sopralluoghi'
            const attuali = preferenze[anticipi] ?? []
            return preferenze[modulo] === undefined ? null : <fieldset key={modulo} disabled={occupata}>
              <legend>Avvisi {moduli[modulo]}</legend>
              <label><input type="checkbox" checked={preferenze[modulo]}
                onChange={event => setPreferenze({ ...preferenze, [modulo]: event.target.checked })} /> {moduli[modulo]}</label>
              {[1, 0].map(anticipo => <label key={anticipo}>
                <input type="checkbox" checked={attuali.includes(anticipo)}
                  onChange={event => setPreferenze({ ...preferenze, [anticipi]: event.target.checked ? [...attuali, anticipo] : attuali.filter(n => n !== anticipo) })} />
                {' '}{anticipo === 0 ? 'Giorno stesso' : '1 giorno prima'}
              </label>)}
            </fieldset>
          })}
          {preferenze.rapportini !== undefined && <fieldset disabled={occupata}>
            <legend>Avvisi Rapportini</legend>
            <label><input type="checkbox" checked={preferenze.rapportini}
              onChange={event => setPreferenze({ ...preferenze, rapportini: event.target.checked })} /> Rapportini</label>
          </fieldset>}
          <button type="submit" disabled={occupata}>Salva preferenze</button>
        </form> : !errore && <p role="status">Caricamento…</p>}
      </div>
    </VistaOperativa>}
  </>
}
