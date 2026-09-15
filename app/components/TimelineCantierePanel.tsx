'use client'

import { useState } from 'react'
import { buildTimelineEvents, type TimelineEvent } from '../engines/event'

type Riga = { id?: string | number; cantiere?: string; cantiere_id?: string; created_at?: string }
export type TimelinePanelProps = {
  foto: (Riga & { data_foto?: string })[]
  rapportini: (Riga & { data?: string; data_rapportino?: string })[]
  preventivi: (Riga & { file_url?: string | null; file_path?: string | null })[]
  acconti: (Riga & { data_incasso?: string | null; importo?: number })[]
  presenze: (Riga & { data?: string })[]
  materiali: Riga[]
  attrezzature: Riga[]
  formatMoney: (value: number) => string
}
type Cantiere = { id: string; nome: string }
type Categoria = 'photo' | 'daily_report' | 'document' | 'acconto' | 'presenza' | 'materiale' | 'attrezzatura'
type Evento = TimelineEvent & { categoria: Categoria }
const categorie: { id: Categoria; label: string }[] = [
  { id: 'daily_report', label: 'Rapportini' }, { id: 'photo', label: 'Foto' },
  { id: 'document', label: 'Documenti' }, { id: 'acconto', label: 'Acconti' },
  { id: 'presenza', label: 'Presenze' }, { id: 'materiale', label: 'Materiali' },
  { id: 'attrezzatura', label: 'Attrezzature' },
]

// Non permettere agli adapter legacy di sostituire una data assente con "adesso".
function dataValida(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false
  const giorno = value.slice(0, 10)
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(giorno).toISOString().slice(0, 10) === giorno
}
function giornoEvento(date: string) {
  return date.length === 10 ? date : new Date(date).toISOString().slice(0, 10)
}
export function costruisciTimelineCantiere(cantiere: Cantiere, p: TimelinePanelProps): Evento[] {
  const appartiene = (r: Riga) => r.id != null && String(r.id).trim() !== '' &&
    (r.cantiere_id ? r.cantiere_id === cantiere.id : r.cantiere === cantiere.nome)
  const base = buildTimelineEvents({
    photos: p.foto.filter(r => appartiene(r) && dataValida(r.data_foto || r.created_at)),
    dailyReports: p.rapportini.filter(r => appartiene(r) && dataValida(r.data || r.data_rapportino || r.created_at)),
    documents: p.preventivi.filter(r => appartiene(r) && (r.file_url || r.file_path) && dataValida(r.created_at))
      .map(r => ({ id: r.id, cantiere: r.cantiere, created_at: r.created_at })),
  }).map(evento => ({ ...evento, categoria: evento.source as Categoria }))
  const aggiungi = <T extends Riga,>(righe: T[], categoria: Categoria, source: TimelineEvent['source'], titolo: string,
    data: (r: T) => string | null | undefined, descrizione: (r: T) => string) => {
    for (const riga of righe) {
      const date = data(riga)
      if (!appartiene(riga) || !dataValida(date)) continue
      base.push({ id: `${categoria}-${riga.id}`, source, categoria, icon: '', title: titolo, description: descrizione(riga), date })
    }
  }
  aggiungi(p.acconti, 'acconto', 'economy', 'Acconto incassato', r => r.data_incasso,
    r => Number.isFinite(r.importo) ? `Importo: ${p.formatMoney(Number(r.importo))}` : 'Incasso registrato')
  aggiungi(p.presenze, 'presenza', 'worker', 'Presenza registrata', r => r.data, () => 'Presenza riferita alla giornata indicata')
  aggiungi(p.materiali, 'materiale', 'economy', 'Voce materiale registrata', r => r.created_at, () => 'Voce aggiunta ai materiali del cantiere')
  aggiungi(p.attrezzature, 'attrezzatura', 'economy', 'Voce attrezzatura registrata', r => r.created_at, () => 'Voce aggiunta alle attrezzature del cantiere')
  // Sort stabile: a parità di data mantiene l'ordine delle sorgenti e dei record ricevuti.
  return base.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export default function TimelineCantierePanel({ cantiere, panelProps: p }: { cantiere: Cantiere; panelProps: TimelinePanelProps }) {
  const [filtro, setFiltro] = useState<Categoria | 'tutti'>('tutti')
  const eventi = costruisciTimelineCantiere(cantiere, p)
  const visibili = eventi.filter(e => filtro === 'tutti' || e.categoria === filtro)
  const gruppi = new Map<string, Evento[]>()
  for (const evento of visibili) {
    const giorno = giornoEvento(evento.date)
    const gruppo = gruppi.get(giorno) || []
    gruppo.push(evento)
    gruppi.set(giorno, gruppo)
  }
  const oggi = new Date().toISOString().slice(0, 10)
  return (
    <section aria-label="Timeline del cantiere" style={{ padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, minWidth: 0 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>Timeline cantiere</h3>
      <p style={{ color: '#64748b', overflowWrap: 'anywhere' }}>{cantiere.nome} · Attività registrate, dalla più recente. Orari in UTC quando disponibili.</p>
      <nav aria-label="Filtri timeline" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
        {[{ id: 'tutti' as const, label: 'Tutti' }, ...categorie].map(c => <button key={c.id} type="button" aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}
          style={{ minHeight: 44, padding: '10px 16px', whiteSpace: 'nowrap', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', background: filtro === c.id ? '#0f172a' : '#fff', color: filtro === c.id ? '#fff' : '#334155' }}>{c.label}</button>)}
      </nav>
      {visibili.length === 0 && <p style={{ color: '#64748b' }}>{eventi.length === 0 ? 'Nessuna attività registrata per questo cantiere.' : 'Nessuna attività per il filtro selezionato.'}</p>}
      {[...gruppi].map(([giorno, eventiGiorno]) => <section key={giorno} style={{ marginBottom: 24 }}>
        <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>{giorno === oggi ? 'Oggi' : new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(giorno))}</h4>
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
          {eventiGiorno.map(e => <li key={e.id} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, minWidth: 0, overflowWrap: 'anywhere' }}>
            <time dateTime={e.date} style={{ color: '#64748b', fontSize: 13 }}>{e.date.length === 10 ? 'Ora non disponibile' : new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(e.date))}</time>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{e.title}</div>
            <p style={{ margin: '6px 0 0', color: '#475569' }}>{e.description}</p>
          </li>)}
        </ol>
      </section>)}
    </section>
  )
}
