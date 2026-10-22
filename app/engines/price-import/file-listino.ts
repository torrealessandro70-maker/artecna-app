import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePriceDescription, normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import { calculateDescriptionSimilarity } from '../price-resolution/similarity'
import { risolviPrezzoRevisioneAi } from '../price-resolution/revisione-ai'
import { leggiListinoManuale, salvaVoceListino, type VoceListino } from './listino-manuale'

export type RigaFileArtecna = {
  id: string; foglio: string; riga: number; codice: string; descrizione: string; unita: string
  prezzo: number | null; zona: string; regione: string; categoria: string; note: string; errori: string[]
  campiEditati?: CampoFileArtecna[]
}
export type CampoFileArtecna = 'codice' | 'descrizione' | 'unita' | 'prezzo' | 'categoria' | 'zona' | 'regione' | 'note'
export type ModificaFileArtecna = Partial<Record<CampoFileArtecna, string>>
export type PropostaFileArtecna = {
  riga: RigaFileArtecna; stato: 'NUOVA' | 'AGGIORNAMENTO' | 'INVARIATA' | 'POSSIBILE DUPLICATO' | 'BLOCCATA' | 'NUOVA CONFERMATA' | 'AGGIORNAMENTO MANUALE'
  matches: VoceListino[]; attuale?: VoceListino; confidence: number; motivi: string[]
  decisione?: { tipo: 'nuova' } | { tipo: 'esistente'; id: string }
}
const aliases = {
  codice: ['codice', 'code', 'id voce'], descrizione: ['descrizione', 'voce', 'lavorazione'],
  unita: ['um', 'u.m.', 'unità', 'unita_misura', 'misura', 'unità di misura'],
  prezzo: ['prezzo', 'prezzo_unitario', 'prezzo unitario', '€/unità'],
  zona: ['zona', 'provincia'], regione: ['regione'], categoria: ['categoria'], note: ['note'],
}
const testo = (value: unknown) => String(value ?? '').trim()
const header = (value: unknown) => normalizePriceDescription(testo(value).replace(/€/g, 'euro')).replace(/[_\/]/g, ' ').replace(/\s+/g, ' ').trim()
function prezzoCerto(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
  const s = testo(value).replace(/^(?:€|EUR)\s*|\s*(?:€|EUR)$/gi, '').trim()
  // Formato italiano o decimale con punto; nessuna eliminazione aggressiva di caratteri.
  if (!/^(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2})$/.test(s)) return null
  const number = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function leggiFileArtecna(fileName: string, buffer: ArrayBuffer): RigaFileArtecna[] {
  if (!/\.(xlsx|xls|csv)$/i.test(fileName)) throw Error('Caricare un file XLSX, XLS o CSV.')
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, cellDates: false, codepage: 65001 })
  const risultato: RigaFileArtecna[] = []
  workbook.SheetNames.forEach((foglio, sheetIndex) => {
    const sheet = workbook.Sheets[foglio]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
    const indicesFor = (row: unknown[], key: keyof typeof aliases) => row.flatMap((value, i) => aliases[key].some(alias => header(alias) === header(value)) ? [i] : [])
    const headerIndex = rows.slice(0, 80).findIndex(row => indicesFor(row, 'descrizione').length > 0 && indicesFor(row, 'unita').length > 0)
    if (headerIndex < 0) {
      if (rows.some(row => row.some(value => testo(value)))) risultato.push({ id: `${sheetIndex}:header`, foglio, riga: 0, codice: '', descrizione: '', unita: '', prezzo: null, zona: 'Catania', regione: '', categoria: '', note: '', errori: ['Intestazioni non riconosciute: descrizione e U.M. obbligatorie.'] })
      return
    }
    const columns = Object.fromEntries((Object.keys(aliases) as (keyof typeof aliases)[]).map(key => [key, indicesFor(rows[headerIndex], key)])) as Record<keyof typeof aliases, number[]>
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (!row.some(value => testo(value))) return
      const errori: string[] = []
      for (const key of ['descrizione', 'unita', 'prezzo'] as const) if (columns[key].length !== 1) errori.push(`Colonna ${key} mancante o ambigua.`)
      const value = (key: keyof typeof aliases) => columns[key].length === 1 ? row[columns[key][0]] : ''
      const descrizione = testo(value('descrizione')), unita = normalizeUnitOfMeasure(testo(value('unita')))
      const prezzo = prezzoCerto(value('prezzo'))
      if (!descrizione) errori.push('Descrizione mancante.')
      if (!unita) errori.push('U.M. mancante.')
      if (prezzo === null) errori.push('Prezzo mancante, non positivo o ambiguo.')
      const absoluteRow = headerIndex + offset + 1
      for (const key of ['descrizione', 'unita', 'prezzo'] as const) if (columns[key].length === 1 && sheet[XLSX.utils.encode_cell({ r: absoluteRow, c: columns[key][0] })]?.f) errori.push('Formula in un campo obbligatorio: valore da verificare.')
      risultato.push({ id: `${sheetIndex}:${absoluteRow + 1}`, foglio, riga: absoluteRow + 1, codice: testo(value('codice')), descrizione, unita, prezzo,
        zona: testo(value('zona')) || 'Catania', regione: testo(value('regione')), categoria: testo(value('categoria')), note: testo(value('note')), errori })
    })
  })
  if (!risultato.length) throw Error('Il file non contiene righe da analizzare.')
  return risultato
}

type Confrontabile = { descrizione: string; unita: string }
// Allinea un solo contesto di posa esplicito; oggetti, materiali e tecnologie
// continuano a essere valutati esclusivamente dal matching V3.3.
const testoConfronto = (value: string) => {
  const text = normalizePriceDescription(value)
  return /^(?:posa(?: in opera)?|fornitura e posa(?: in opera)?) (?:di )?(?:pavimento|pavimentazione)\b/.test(text)
    ? text.replace(/\bsu supporto esistente\b/g, 'su sottofondo preesistente') : text
}
const confidence = (a: Confrontabile, b: Confrontabile) => risolviPrezzoRevisioneAi(
  { descrizione: testoConfronto(a.descrizione), unitaMisura: a.unita },
  [{ descrizione: testoConfronto(b.descrizione), unita_misura: b.unita, prezzo_unitario: 1 }], [],
).priceResolution.confidence
const stessaUm = (a: Confrontabile, b: Confrontabile) => !!a.unita && a.unita === b.unita
const scoreEquivalenza = (a: Confrontabile, b: Confrontabile) => !stessaUm(a, b) ? 0 :
  normalizePriceDescription(a.descrizione) === normalizePriceDescription(b.descrizione) ? 1 : Math.min(confidence(a, b), confidence(b, a))
// Solo per il margine: V3.3 separa queste stesse clausole accessorie dal nucleo.
// La qualificazione del candidato continua a usare il testo completo.
const nucleoMargine = (a: Confrontabile): Confrontabile => ({ ...a,
  descrizione: normalizePriceDescription(a.descrizione).split(/\b(?:compres[oaie]|inclus[oaie]|esclus[oaie])\b/)[0].trim() })
const equivalente = (a: Confrontabile, b: Confrontabile) => stessaUm(a, b) &&
  scoreEquivalenza(a, b) >= 0.8
const simile = (a: Confrontabile, b: Confrontabile) => normalizePriceDescription(a.descrizione) === normalizePriceDescription(b.descrizione) ||
  calculateDescriptionSimilarity(a.descrizione, b.descrizione) >= 0.6 || confidence(a, b) > 0 || confidence(b, a) > 0
const confrontabile = (r: VoceListino): Confrontabile => ({ descrizione: r.descrizione || '', unita: normalizeUnitOfMeasure(r.unita_misura) })
export const fileApplicabile = (p: PropostaFileArtecna) => p.stato === 'NUOVA' || p.stato === 'AGGIORNAMENTO' ||
  (p.stato === 'NUOVA CONFERMATA' && p.decisione?.tipo === 'nuova') ||
  (p.stato === 'AGGIORNAMENTO MANUALE' && p.decisione?.tipo === 'esistente' && p.attuale?.id === p.decisione.id)
const codiceValido = (codice: string) => /^[\p{L}\p{N}_.-]{1,100}$/u.test(codice) && !/^SIC24/i.test(codice)

export function decidiDuplicatoFile(p: PropostaFileArtecna, decisione?: PropostaFileArtecna['decisione']): PropostaFileArtecna {
  if (p.stato !== 'POSSIBILE DUPLICATO' && !p.decisione) throw Error('La riga non è un possibile duplicato.')
  if (p.riga.errori.length || p.riga.prezzo === null || !Number.isFinite(p.riga.prezzo) || p.riga.prezzo <= 0) throw Error('Riga file non valida.')
  const base = { ...p, stato: 'POSSIBILE DUPLICATO' as const, attuale: undefined, decisione: undefined }
  if (!decisione) return base
  if (decisione.tipo === 'nuova') return { ...base, stato: 'NUOVA CONFERMATA', decisione }
  const attuale = p.matches.find(r => r.id === decisione.id && r.tipo_prezzo === 'artecna' && !/^SIC24/i.test(r.codice || ''))
  if (!attuale) throw Error('Voce Listino scelta non disponibile o non modificabile.')
  return { ...base, stato: 'AGGIORNAMENTO MANUALE', decisione, attuale }
}

export function confrontaFileListino(righe: readonly RigaFileArtecna[], listino: readonly VoceListino[]): PropostaFileArtecna[] {
  const manuali = listino.filter(r => r.tipo_prezzo === 'artecna')
  const proposte = righe.map<PropostaFileArtecna>(riga => {
    const ordinati = manuali.map(row => ({ row, score: scoreEquivalenza(riga, confrontabile(row)),
      scoreMargine: scoreEquivalenza(nucleoMargine(riga), nucleoMargine(confrontabile(row))) }))
      .filter(c => c.score > 0).sort((a, b) => b.scoreMargine - a.scoreMargine)
    const migliore = ordinati[0]
    const univoco = migliore && migliore.score >= 0.8 && (!ordinati[1] || migliore.scoreMargine - ordinati[1].scoreMargine >= 0.15)
    const matches = univoco ? [migliore.row] : ordinati.map(c => c.row)
    const sospette = manuali.filter(row => simile(riga, confrontabile(row)))
    if (riga.errori.length) return { riga, stato: 'BLOCCATA', matches: sospette, confidence: 0, motivi: riga.errori }
    if (matches.length && !univoco) return { riga, stato: 'POSSIBILE DUPLICATO', matches, confidence: migliore.score, motivi: ['Equivalenza o margine tra candidati insufficienti: scelta manuale necessaria.'] }
    if (univoco) {
      const attuale = matches[0]
      if (/^SIC24/i.test(attuale.codice || '')) return { riga, stato: 'BLOCCATA', matches, confidence: 0, motivi: ['Codice SIC24 riservato.'] }
      return { riga, stato: Math.abs(Number(attuale.prezzo_unitario) - riga.prezzo!) < 0.005 ? 'INVARIATA' : 'AGGIORNAMENTO', attuale, matches,
        confidence: migliore.score, motivi: [] }
    }
    if (sospette.length) return { riga, stato: 'POSSIBILE DUPLICATO', matches: sospette, confidence: 0, motivi: ['Somiglianza o U.M. discordante: verificare le voci esistenti. Nessuna nuova voce automatica.'] }
    const conflitto = manuali.some(row => riga.codice && row.codice === riga.codice)
    return { riga, stato: 'NUOVA', matches: [], confidence: 0, motivi: riga.codice && (!codiceValido(riga.codice) || conflitto) ? ['Codice non utilizzabile o già presente: verrà generato un codice ART_.'] : [] }
  })
  for (let i = 0; i < proposte.length; i++) for (let j = i + 1; j < proposte.length; j++) {
    const a = proposte[i], b = proposte[j]
    if (!a.riga.descrizione || !b.riga.descrizione || !a.riga.unita || !b.riga.unita) continue
    if (equivalente(a.riga, b.riga) || simile(a.riga, b.riga)) {
      const identiche = equivalente(a.riga, b.riga) && a.riga.prezzo !== null && a.riga.prezzo === b.riga.prezzo
      for (const [current, other] of [[a, b], [b, a]]) {
        if (current.stato !== 'BLOCCATA') current.stato = 'POSSIBILE DUPLICATO'
        current.motivi = [...current.motivi, `${identiche ? 'DUPLICATO IDENTICO FILE' : 'POSSIBILE DUPLICATO FILE'}: ${other.riga.foglio}, riga ${other.riga.riga}.`]
      }
    }
  }
  // Nemmeno codici uguali nel file possono causare inserimenti concorrenti sul vincolo univoco.
  for (const p of proposte) if (p.stato === 'NUOVA' && p.riga.codice && righe.filter(r => r.codice === p.riga.codice).length > 1) p.motivi.push('Codice ripetuto nel file: verrà generato un codice ART_.')
  return proposte
}

export async function analizzaFileListino(db: SupabaseClient, righe: readonly RigaFileArtecna[]) {
  return confrontaFileListino(righe, await leggiListinoManuale(db))
}

// Editing locale: il parser e il matching rimangono le uniche fonti delle rispettive regole.
export function modificaAnteprimaFile(proposte: readonly PropostaFileArtecna[], id: string, modifica: ModificaFileArtecna,
  listino: readonly VoceListino[], originale?: RigaFileArtecna): PropostaFileArtecna[] {
  const prima = proposte.find(p => p.riga.id === id)
  if (!prima) throw Error('Riga anteprima non trovata.')
  const campi = Object.keys(modifica) as CampoFileArtecna[]
  const editati = [...new Set([...(prima.riga.campiEditati || []), ...campi])]
  const riga: RigaFileArtecna = originale ? { ...originale } : { ...prima.riga, campiEditati: editati }
  if (!originale) {
    for (const campo of campi) {
      const value = modifica[campo]!
      if (campo === 'prezzo') {
        const numero = value.trim() && /^[+-]?\d*(?:[.,]\d*)?(?:e[+-]?\d+)?$/i.test(value.trim()) ? Number(value.trim().replace(',', '.')) : NaN
        riga.prezzo = Number.isFinite(numero) && numero > 0 ? numero : null
      }
      else if (campo === 'unita') riga.unita = normalizeUnitOfMeasure(value)
      else riga[campo] = value.trim()
    }
    const obbligatori = ['descrizione', 'unita', 'prezzo'] as const
    riga.errori = prima.riga.errori.filter(errore => {
      if (/^(Descrizione mancante\.|U\.M\. mancante\.|Prezzo mancante, non positivo o ambiguo\.)$/.test(errore)) return false
      if (obbligatori.some(c => editati.includes(c) && errore === `Colonna ${c} mancante o ambigua.`)) return false
      if (obbligatori.every(c => editati.includes(c)) && /^(Formula in un campo obbligatorio:|Intestazioni non riconosciute:)/.test(errore)) return false
      return true
    })
    if (!riga.descrizione) riga.errori.push('Descrizione mancante.')
    if (!riga.unita) riga.errori.push('U.M. mancante.')
    if (riga.prezzo === null) riga.errori.push('Prezzo mancante, non positivo o ambiguo.')
  }
  const semantica = !!originale || campi.some(c => ['descrizione', 'unita', 'prezzo', 'codice'].includes(c))
  if (!semantica) return proposte.map(p => p.riga.id === id ? { ...p, riga } : p)
  const fresh = confrontaFileListino(proposte.map(p => p.riga.id === id ? riga : p.riga), listino)
  return fresh.map(p => {
    const precedente = proposte.find(q => q.riga.id === p.riga.id)!
    if (p.riga.id !== id && precedente.decisione && p.stato === 'POSSIBILE DUPLICATO' &&
      JSON.stringify(p.matches) === JSON.stringify(precedente.matches) && JSON.stringify(p.motivi) === JSON.stringify(precedente.motivi)) {
      return decidiDuplicatoFile(p, precedente.decisione)
    }
    return JSON.stringify(p) === JSON.stringify(precedente) ? precedente : p
  })
}
export async function applicaFileListino(db: SupabaseClient, proposte: readonly PropostaFileArtecna[], ids: readonly string[], confermata: boolean) {
  if (!confermata) return 0
  const scelte = proposte.filter(p => ids.includes(p.riga.id))
  if (!scelte.length) return 0
  if (scelte.some(p => !fileApplicabile(p))) throw Error('Selezione non applicabile.')
  const current = await leggiListinoManuale(db), fresh = confrontaFileListino(proposte.map(p => p.riga), current)
  for (const p of scelte) {
    let f = fresh.find(q => q.riga.id === p.riga.id)
    if (p.decisione) {
      if (!f || f.stato !== 'POSSIBILE DUPLICATO' || JSON.stringify(f.matches) !== JSON.stringify(p.matches)) throw Error('Listino cambiato: ripetere l’analisi e confermare nuovamente.')
      f = decidiDuplicatoFile(f, p.decisione)
    }
    if (!f || f.stato !== p.stato || f.attuale?.id !== p.attuale?.id || f.attuale?.prezzo_unitario !== p.attuale?.prezzo_unitario) throw Error('Listino cambiato: ripetere l’analisi e confermare nuovamente.')
  }
  const destinazioni = scelte.flatMap(p => p.attuale ? [p.attuale.id] : [])
  if (new Set(destinazioni).size !== destinazioni.length) throw Error('Più righe selezionate aggiornano la stessa voce Listino: scegliere una sola riga.')
  let salvate = 0
  try {
    for (const p of scelte) {
      if (p.attuale) {
        const update = db.from('prezzi_lavorazioni').update({ prezzo_unitario: p.riga.prezzo!, updated_at: new Date().toISOString() })
          .eq('id', p.attuale.id).eq('tipo_prezzo', 'artecna').eq('prezzo_unitario', p.attuale.prezzo_unitario)
        const guarded = p.attuale.codice == null ? update.is('codice', null) : update.eq('codice', p.attuale.codice)
        const { error } = await guarded.select('id').single()
        if (error) throw Error(error.message)
      } else {
        const useCode = codiceValido(p.riga.codice) && !current.some(r => r.codice === p.riga.codice) && proposte.filter(q => q.riga.codice === p.riga.codice).length === 1
        await salvaVoceListino(db, { codice: useCode ? p.riga.codice : '', descrizione: p.riga.descrizione, unita_misura: p.riga.unita,
          prezzo_unitario: String(p.riga.prezzo), categoria: p.riga.categoria, zona: p.riga.zona, regione: p.riga.regione, note: p.riga.note })
      }
      salvate++
    }
  } catch (e) { throw Error(`${salvate} righe applicate prima dell’interruzione. ${e instanceof Error ? e.message : 'Errore salvataggio.'} Rileggere il Listino prima di riprovare.`) }
  return salvate
}
