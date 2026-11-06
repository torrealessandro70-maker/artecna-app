import * as XLSX from 'xlsx'
import type { DocumentHeaderDetection } from '../document-parser/header-detector'
import { normalizePriceDescription, normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import type { RigaPreventivoListino } from './preventivo-listino'

export type ClasseRigaPreventivo = 'voce_listino' | 'supporto_voce' | 'strutturale' | 'incompleta_reale' | 'da_verificare'
export type ContestoFoglioListino = {
  nome: string; rows: unknown[][]; header: DocumentHeaderDetection | null; offset: number; colonna: number
}
const testo = (v: unknown) => String(v ?? '').trim()
const normalizza = (v: unknown) => normalizePriceDescription(testo(v)).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
const unitaFinale = (v: unknown) => testo(v).match(/\[([^\]]{1,20})\]\s*$/)?.[1]
const struttura = (v: unknown) => /^(?:titolo|intestazione|subtotale|totale|riepilogo|note|nota|condizioni|condizione|cronoprogramma|schema pagamenti|garanzia e accettazione|criteri di misura|fonti generali)(?:\s|$)/.test(normalizza(v))
const indirizzo = (foglio: string, colonna: number, riga: number) => `${foglio.toLocaleLowerCase('it-IT')}!${XLSX.utils.encode_col(colonna)}${riga}`
function riferimento(formula: string) {
  const match = formula.match(/^(?:'((?:[^']|'')+)'|([^'!\[\]]+))!\$?([A-Za-z]+)\$?([1-9]\d*)$/)
  return match ? `${(match[1]?.replace(/''/g, "'") || match[2]).toLocaleLowerCase('it-IT')}!${match[3].toUpperCase()}${match[4]}` : null
}
export const rigaCandidataPreventivo = (r: RigaPreventivoListino) => !r.classificazione || r.classificazione === 'voce_listino' || r.classificazione === 'incompleta_reale'
export function classeCampiVoce(r: RigaPreventivoListino): ClasseRigaPreventivo {
  const prezzo = Number(r.form.prezzo_unitario.trim().replace(',', '.'))
  return r.form.descrizione.trim() && normalizeUnitOfMeasure(r.form.unita_misura) && Number.isFinite(prezzo) && prezzo > 0 ? 'voce_listino' : 'incompleta_reale'
}

// Workbook-local evidence only. A supporting sheet never becomes a new price
// list entry, even when no reliable link can be established.
export function classificaRighePreventivo(righe: RigaPreventivoListino[], fogli: ContestoFoglioListino[], workbook: XLSX.WorkBook): RigaPreventivoListino[] {
  const contesti = new Map<string, { foglio: ContestoFoglioListino; supporto?: { row: number; descrizione: number; prezzo: number } }>()
  for (const foglio of fogli) {
    const contesto: typeof contesti extends Map<string, infer V> ? V : never = { foglio }
    if (/\b(?:criteri|fonti|supporto)\b/.test(normalizza(foglio.nome))) {
      for (let i = 0; i < Math.min(40, foglio.rows.length); i++) {
        const headers = foglio.rows[i].map(normalizza), descrizione = headers.indexOf('lavorazione u m'), prezzo = headers.indexOf('prezzo proposto')
        const ancore = ['criterio di misura', 'ipotesi esclusioni', 'confronto e provenienza', 'fonte consultata url'].filter(h => headers.includes(h))
        if (descrizione >= 0 && prezzo >= 0 && ancore.length >= 2 && foglio.rows.slice(i + 1).some(r => unitaFinale(r[descrizione]) && typeof r[prezzo] === 'number' && Number(r[prezzo]) > 0)) {
          contesto.supporto = { row: i, descrizione, prezzo }; break
        }
      }
    }
    contesti.set(foglio.nome, contesto)
  }
  const sezioni = new Set<string>()
  const prime = righe.map(r => {
    const { foglio, supporto } = contesti.get(r.foglio)!
    const index = r.riga - 1 - foglio.offset, raw = foglio.rows[index] || []
    const nascosta = workbook.Sheets[r.foglio]['!rows']?.[r.riga - 1]?.hidden === true || !!workbook.Workbook?.Sheets?.find(s => s.name === r.foglio)?.Hidden
    const base = { ...r, nascosta }
    if (supporto && (!foglio.header || index >= supporto.row)) {
      const descrizione = testo(raw[supporto.descrizione]), unita = unitaFinale(descrizione)
      const cell = workbook.Sheets[r.foglio][XLSX.utils.encode_cell({ r: r.riga - 1, c: foglio.colonna + supporto.prezzo })]
      if (index > supporto.row && descrizione) {
        return { ...base, classificazione: 'da_verificare' as const, motivoClassificazione: 'Scheda di supporto: corrispondenza da verificare, nessuna nuova voce automatica.',
          datiSupporto: { descrizione: descrizione.replace(/\s*\[[^\]]+\]\s*$/, ''), unita: unita ? normalizeUnitOfMeasure(unita) : '',
            prezzo: typeof cell?.v === 'number' && Number.isFinite(cell.v) && cell.v > 0 ? cell.v : undefined, formula: cell?.f } }
      }
      return { ...base, classificazione: 'strutturale' as const, motivoClassificazione: index === supporto.row ? 'Intestazione della tabella di supporto.' : 'Titolo, nota o fonte della tabella di supporto.' }
    }
    const primaCella = raw.find(v => testo(v))
    const haDatiVoce = !!r.form.unita_misura || r.quantita !== undefined || !!r.form.codice
    if (!haDatiVoce && struttura(primaCella)) {
      sezioni.add(r.foglio)
      return { ...base, classificazione: 'strutturale' as const, motivoClassificazione: 'Titolo, riepilogo, totale o condizione; non è un prezzo unitario di lavorazione.' }
    }
    if (!haDatiVoce && !r.form.descrizione && !r.form.prezzo_unitario && sezioni.has(r.foglio)) {
      return { ...base, classificazione: 'strutturale' as const, motivoClassificazione: 'Testo della sezione di note, condizioni o cronoprogramma fuori dalla tabella prezzi.' }
    }
    if (!foglio.header) return { ...base, classificazione: 'da_verificare' as const, motivoClassificazione: 'Intestazione non riconosciuta: natura della riga da verificare.' }
    return { ...base, classificazione: classeCampiVoce(base), motivoClassificazione: 'Lavorazione nella tabella prezzi del documento.' }
  })
  const candidate = prime.filter(r => r.classificazione === 'voce_listino')
  const prezzi = new Map<string, RigaPreventivoListino[]>()
  for (const r of candidate) {
    const f = contesti.get(r.foglio)!.foglio, col = f.header?.columns.prezzoUnitario
    if (col === undefined) continue
    const key = indirizzo(r.foglio, f.colonna + col, r.riga)
    prezzi.set(key, [...(prezzi.get(key) || []), r])
  }
  return prime.map(r => {
    if (!('datiSupporto' in r) || !r.datiSupporto) return r
    const s = r.datiSupporto
    if (!s.unita || s.prezzo === undefined) return r
    const ref = s.formula ? riferimento(s.formula) : null
    const matches = (s.formula ? ref ? prezzi.get(ref) || [] : [] : candidate.filter(c => normalizePriceDescription(c.form.descrizione) === normalizePriceDescription(s.descrizione)))
      .filter(c => normalizeUnitOfMeasure(c.form.unita_misura) === s.unita && c.prezzoDocumentale === s.prezzo)
    if (matches.length !== 1) return r
    const target = matches[0]
    return { ...r, classificazione: 'supporto_voce' as const, supportoDi: { id: target.id, foglio: target.foglio, riga: target.riga },
      motivoClassificazione: s.formula ? `Riferimento Excel ${s.formula}; U.M. e prezzo documentale coincidono.` : 'Descrizione normalizzata, U.M. e prezzo coincidono esattamente con una sola lavorazione.' }
  })
}
