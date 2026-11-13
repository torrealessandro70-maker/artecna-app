'use client'

import { useEffect, useRef, useState } from 'react'

type Client = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> }
type Config = { revisione: number; sospeso: boolean; sospeso_fino_al: string | null; rilevanza_giorni: number | null }
type Giorno = { giorno: string; ora: string }
type Obbligo = { id: string; giorno_lavoro: string; termine_at: string; rilevante_fino_at: string | null; revisione: number; esito: string }
type Dati = { configurazione: Config; avvisi_attivi: boolean; giornate: Obbligo[] }
const iso = (date: Date) => date.toISOString().slice(0, 10)
const roma = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const durate = [3, 7, 15, 30]
const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const esiti: Record<string, string> = { soddisfatto: 'Soddisfatto', mancante: 'Mancante', da_chiudere: 'Da chiudere', da_classificare: 'Da classificare' }
const rilevanza = (value: string) => value === '' ? null : Number(value)

export default function ControlloRapportini({ client, cantiere, chiuso }: { client: Client; cantiere: string; chiuso: boolean }) {
  const oggi = roma.format(new Date()).slice(0, 10)
  const [da, setDa] = useState(oggi)
  const [a, setA] = useState(oggi)
  const [ora, setOra] = useState('17:00')
  const [settimana, setSettimana] = useState([1, 2, 3, 4, 5])
  const [anteprima, setAnteprima] = useState<Giorno[]>([])
  const [dati, setDati] = useState<Dati>()
  const [modo, setModo] = useState('attivi')
  const [fine, setFine] = useState('')
  const [durata, setDurata] = useState('7')
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const inCorso = useRef(false)

  useEffect(() => {
    let attivo = true
    void Promise.resolve(client.rpc('leggi_rapportini_attesi', { p_cantiere: cantiere, p_da: oggi, p_a: oggi }))
      .then(({ data, error }) => {
        if (!attivo) return
        if (error) { setErrore('Controllo rapportini non disponibile.'); return }
        const risultato = data as Dati
        setDati(risultato)
        const cfg = risultato.configurazione
        setModo(cfg.sospeso ? cfg.sospeso_fino_al ? 'data' : 'manuale' : 'attivi')
        setFine(cfg.sospeso_fino_al ?? '')
        setDurata(cfg.rilevanza_giorni?.toString() ?? '')
      }, () => { if (attivo) setErrore('Controllo rapportini non disponibile.') })
    return () => { attivo = false }
  }, [client, cantiere, oggi])

  function prepara() {
    const inizio = Date.parse(da)
    const fine = Date.parse(a)
    if (!ora || !Number.isFinite(inizio) || !Number.isFinite(fine) || fine < inizio || fine - inizio > 365 * 86400000) {
      setErrore('Seleziona un intervallo valido di massimo 366 giorni e un orario.')
      return
    }
    const prossimi: Giorno[] = []
    for (let giorno = inizio; giorno <= fine; giorno += 86400000) {
      const data = new Date(giorno)
      if (settimana.includes(data.getUTCDay())) prossimi.push({ giorno: iso(data), ora })
    }
    setErrore(prossimi.length ? '' : 'Nessuna giornata corrisponde ai giorni selezionati.')
    setAnteprima(prossimi)
  }

  async function esegui(nome: string, args: Record<string, unknown>, dopo?: () => void) {
    if (inCorso.current) return
    inCorso.current = true
    setOccupato(true)
    setErrore('')
    try {
      if (nome !== 'leggi_rapportini_attesi') {
        const { error } = await client.rpc(nome, { p_cantiere: cantiere, ...args })
        if (error) {
          setErrore(error.code === 'PR409' ? 'Almeno una giornata è già pianificata. Nessuna giornata è stata salvata.'
            : error.code === 'PR412' ? 'Dati aggiornati da un’altra sessione. Rileggi prima di salvare.'
              : error.code === '22023' ? 'Intervallo o orario non valido in Europe/Rome.' : 'Salvataggio non confermato. Rileggi prima di riprovare.')
          return
        }
        dopo?.()
        window.dispatchEvent(new Event('artecna:notifiche-rileggi'))
      }
      const { data, error } = await client.rpc('leggi_rapportini_attesi', { p_cantiere: cantiere, p_da: da, p_a: a })
      if (error) setErrore('Lettura non disponibile. Riprova con Rileggi.')
      else setDati(data as Dati)
    } catch {
      setErrore('Operazione non confermata. Rileggi prima di riprovare.')
    } finally {
      inCorso.current = false
      setOccupato(false)
    }
  }

  const cfg = dati?.configurazione
  const stato = chiuso ? 'Disattivati perché il cantiere è chiuso' : !dati ? 'Stato non disponibile'
    : dati.avvisi_attivi ? 'Attivi' : cfg?.sospeso_fino_al ? 'Sospesi fino al ' + cfg.sospeso_fino_al : 'Sospesi manualmente'

  return <section aria-label="Controllo rapportini">
    <h3>Controllo rapportini</h3>
    <p role="status">Avvisi {stato.toLocaleLowerCase('it-IT')}</p>
    {errore && <p role="alert">{errore}</p>}
    <details>
      <summary>Pianifica rapportini</summary>
      <fieldset disabled={occupato}>
        <label>Dal <input type="date" value={da} onChange={e => setDa(e.target.value)} /></label>{' '}
        <label>Al <input type="date" value={a} onChange={e => setA(e.target.value)} /></label>{' '}
        <label>Ora limite <input type="time" value={ora} onChange={e => setOra(e.target.value)} /></label>
        <div>{giorni.map((giorno, index) => <label key={giorno}>
          <input type="checkbox" checked={settimana.includes(index)} onChange={e => setSettimana(e.target.checked
            ? [...settimana, index] : settimana.filter(n => n !== index))} />{giorno}{' '}
        </label>)}</div>
        <p>Orari di Roma. Le ore inesistenti al cambio d’ora vengono rifiutate. Per le ore ripetute vale il secondo istante.</p>
        <button type="button" onClick={prepara}>Genera anteprima</button>{' '}
        <button type="button" onClick={() => void esegui('leggi_rapportini_attesi', {})}>Rileggi</button>
        {anteprima.length > 0 && <>
          <table><caption>Giornate da pianificare</caption><thead><tr><th>Data</th><th>Ora limite</th><th>Escludi</th></tr></thead>
            <tbody>{anteprima.map((giorno, index) => <tr key={index}>
              <td><input aria-label={'Data giornata ' + (index + 1)} type="date" value={giorno.giorno}
                onChange={e => setAnteprima(anteprima.map((g, i) => i === index ? { ...g, giorno: e.target.value } : g))} /></td>
              <td><input aria-label={'Ora giornata ' + (index + 1)} type="time" value={giorno.ora}
                onChange={e => setAnteprima(anteprima.map((g, i) => i === index ? { ...g, ora: e.target.value } : g))} /></td>
              <td><button type="button" onClick={() => setAnteprima(anteprima.filter((_, i) => i !== index))}>Escludi {giorno.giorno}</button></td>
            </tr>)}</tbody>
          </table>
          <button type="button" disabled={!cfg || anteprima.some(g => !g.giorno || !g.ora)}
            onClick={() => void esegui('pianifica_rapportini_attesi', { p_revisione_config: cfg?.revisione, p_giornate: anteprima }, () => setAnteprima([]))}>
            Salva giornate confermate
          </button>
        </>}
        {dati?.giornate.map(g => <ModificaObbligo key={g.id + ':' + g.revisione} obbligo={g}
          salva={(ora, durata) => void esegui('modifica_rapportino_atteso', { p_id: g.id, p_revisione: g.revisione, p_ora: ora, p_rilevanza: durata })} />)}
      </fieldset>
    </details>
    <details>
      <summary>Gestisci avvisi</summary>
      <p>Queste impostazioni riguardano solo gli avvisi Rapportini del cantiere.</p>
      <fieldset disabled={occupato || !cfg}>
        <label>Avvisi <select value={modo} onChange={e => setModo(e.target.value)}>
          <option value="attivi">Attivi / Riattiva</option><option value="manuale">Sospesi manualmente</option><option value="data">Sospesi fino a una data</option>
        </select></label>{' '}
        {modo === 'data' && <label>Fino al <input type="date" value={fine} onChange={e => setFine(e.target.value)} /></label>}{' '}
        <label>Rilevanza per i nuovi obblighi <Durata value={durata} cambia={setDurata} /></label>{' '}
        <button type="button" disabled={modo === 'data' && !fine} onClick={() => void esegui('configura_rapportini_attesi', {
          p_revisione: cfg?.revisione, p_sospeso: modo !== 'attivi', p_fino_al: modo === 'data' ? fine : null, p_rilevanza: rilevanza(durata)
        })}>Salva avvisi</button>
      </fieldset>
    </details>
  </section>
}

function Durata({ value, cambia }: { value: string; cambia: (value: string) => void }) {
  return <select value={value} onChange={e => cambia(e.target.value)}>
    {durate.map(n => <option key={n} value={n}>{n} giorni</option>)}
    <option value="">Senza scadenza automatica</option>
  </select>
}

function ModificaObbligo({ obbligo, salva }: { obbligo: Obbligo; salva: (ora: string, durata: number | null) => void }) {
  const [ora, setOra] = useState(() => roma.format(new Date(obbligo.termine_at)).slice(-5))
  const [durata, setDurata] = useState(() => obbligo.rilevante_fino_at
    ? String(Math.round((Date.parse(obbligo.rilevante_fino_at) - Date.parse(obbligo.termine_at)) / 86400000)) : '')
  return <div>
    <strong>{obbligo.giorno_lavoro} · {esiti[obbligo.esito]}</strong>{' '}
    <label>Ora limite <input type="time" value={ora} onChange={e => setOra(e.target.value)} /></label>{' '}
    <label>Rilevanza <Durata value={durata} cambia={setDurata} /></label>{' '}
    <button type="button" disabled={!ora} onClick={() => salva(ora, rilevanza(durata))}>Salva modifica</button>
  </div>
}
