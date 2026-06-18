export const TIPI_ATTIVITA = [
  'Sopralluogo',
  'Cantiere',
  'Preventivo',
  'Telefonata',
  'Materiali',
  'Pagamento',
  'Altro',
] as const

export type TipoAttivita = (typeof TIPI_ATTIVITA)[number]
export type StatoAttivita = 'da_fare' | 'completata'
export type TipoCollegamento =
  | 'sopralluogo'
  | 'cantiere'
  | 'cliente'
  | 'preventivo'

export type CollegamentoAgenda = {
  tipo: TipoCollegamento
  id?: string
  etichetta: string
}

export type VoceChecklistAttivita = {
  id: string
  testo: string
  completata: boolean
}

export type AttivitaAgenda = {
  id: string
  titolo: string
  descrizione: string
  data: string
  ora: string
  oraFine?: string
  tipo: TipoAttivita
  stato: StatoAttivita
  checklist?: VoceChecklistAttivita[]
  collegamento?: CollegamentoAgenda
  createdAt: string
}

export type OpzioneCollegamento = CollegamentoAgenda & {
  valore: string
}

export const AGENDA_STORAGE_KEY = 'artecna_agenda_attivita_v1'

export function dataLocale(date = new Date()) {
  const anno = date.getFullYear()
  const mese = String(date.getMonth() + 1).padStart(2, '0')
  const giorno = String(date.getDate()).padStart(2, '0')
  return `${anno}-${mese}-${giorno}`
}

export function aggiungiGiorni(data: string, giorni: number) {
  const date = new Date(`${data}T12:00:00`)
  date.setDate(date.getDate() + giorni)
  return dataLocale(date)
}

export function formattaData(data: string) {
  const date = new Date(`${data}T12:00:00`)
  if (Number.isNaN(date.getTime())) return data
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function escapeIcs(testo: string) {
  return testo
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function dataOraIcs(data: string, ora: string) {
  return `${data.replace(/-/g, '')}T${(ora || '09:00').replace(':', '')}00`
}

export function aggiungiUnOra(ora: string) {
  const [ore, minuti] = (ora || '09:00').split(':').map(Number)
  const totaleMinuti = ore * 60 + minuti + 60

  if (totaleMinuti >= 24 * 60) return '23:59'

  return `${String(Math.floor(totaleMinuti / 60)).padStart(2, '0')}:${String(
    totaleMinuti % 60
  ).padStart(2, '0')}`
}

export function esportaAttivitaIcs(attivita: AttivitaAgenda) {
  const oraInizio = attivita.ora || '09:00'
  const oraFine = attivita.oraFine || aggiungiUnOra(oraInizio)
  const descrizione = [
    attivita.descrizione,
    attivita.checklist?.length
      ? `Checklist:\n${attivita.checklist
          .map((voce) => `${voce.completata ? '[x]' : '[ ]'} ${voce.testo}`)
          .join('\n')}`
      : '',
    attivita.collegamento
      ? `Fascicolo collegato: ${attivita.collegamento.etichetta}`
      : '',
    `Tipo: ${attivita.tipo}`,
  ]
    .filter(Boolean)
    .join('\n')

  const contenuto = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ARTECNA OS//Agenda//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${attivita.id}@artecna-os`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${dataOraIcs(attivita.data, oraInizio)}`,
    `DTEND:${dataOraIcs(attivita.data, oraFine)}`,
    `SUMMARY:${escapeIcs(attivita.titolo)}`,
    `DESCRIPTION:${escapeIcs(descrizione)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([contenuto], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${attivita.titolo.replace(/[^a-zA-Z0-9_-]/g, '_') || 'attivita'}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
