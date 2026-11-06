import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseExcelDocument } from '../document-parser/excel'
import { detectDocumentHeader } from '../document-parser/header-detector'
import { normalizePriceDescription, normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import { leggiListinoManuale, preparaVoceListino, salvaVoceListino, type FormListino, type VoceListino } from './listino-manuale'
import { classificaRighePreventivo, rigaCandidataPreventivo, type ClasseRigaPreventivo, type ContestoFoglioListino } from './classificazione-preventivo-listino'
export { rigaCandidataPreventivo, classeCampiVoce } from './classificazione-preventivo-listino'

export type RigaPreventivoListino = {
  id: string; foglio: string; riga: number; form: FormListino
  codiceOriginale: string; prezzoDocumentale?: number; quantita?: number
  testoOriginale: string; avvisi: string[]
  classificazione?: ClasseRigaPreventivo; motivoClassificazione?: string
  supportoDi?: { id: string; foglio: string; riga: number }
  datiSupporto?: { descrizione: string; unita: string; prezzo?: number; formula?: string }
  nascosta?: boolean; nascostaAbilitata?: boolean
}
export type ConfrontoPreventivoListino = {
  riga: RigaPreventivoListino; errori: string[]; matches: VoceListino[]; duplicatiFile: string[]
}
export type SceltaPreventivoListino = { id: string; conflitto: 'salta' | 'nuova' }
const testo = (value: unknown) => String(value ?? '').trim()
const normalizzaHeader = (value: unknown) => normalizePriceDescription(testo(value)).replace(/[^\p{L}\p{N}%]+/gu, ' ').replace(/\s+/g, ' ').trim()
const adattaIntestazione = (value: unknown) => {
  const h = normalizzaHeader(value)
  return h === 'descrizione lavoro' || h.replace(/\s/g, '') === 'descrizione' ? 'Descrizione' : value
}

// Adapter only: the established document parser still owns core row/header
// recognition. Each sheet is handed to that parser independently, without
// changing its first-sheet behaviour in Preventivo da Documento.
export async function leggiPreventivoListino(file: File): Promise<{ righe: RigaPreventivoListino[]; avvisi: string[] }> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw Error('Caricare un preventivo XLSX o XLS.')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true })
  const righe: RigaPreventivoListino[] = [], avvisi: string[] = []
  const contesti: ContestoFoglioListino[] = []
  for (const [indice, foglio] of workbook.SheetNames.entries()) {
    const sheet = workbook.Sheets[foglio]
    if (!sheet?.['!ref']) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true })
    const header = detectDocumentHeader(rows.slice(0, 40).map(row => row.map(adattaIntestazione)))
    const intestazioni = header ? rows[header.headerRowIndex] : []
    const prezziAmbigui = intestazioni.filter(h => detectDocumentHeader([['Descrizione', h]])?.columns.prezzoUnitario === 1).length > 1
    const origine = XLSX.utils.decode_range(sheet['!ref']).s
    const offset = origine.r
    contesti.push({ nome: foglio, rows, header, offset, colonna: origine.c })
    const single = XLSX.utils.book_new()
    const adattato = { ...sheet }
    if (header) intestazioni.forEach((value, col) => {
      const address = XLSX.utils.encode_cell({ r: offset + header.headerRowIndex, c: origine.c + col })
      if (adattaIntestazione(value) !== value) adattato[address] = { t: 's', v: adattaIntestazione(value) }
    })
    XLSX.utils.book_append_sheet(single, adattato, foglio)
    const bytes = XLSX.write(single, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const parsed = await parseExcelDocument(new File([bytes], file.name, { type: file.type }))
    avvisi.push(...parsed.warnings.map(w => `${foglio}: ${w}`))
    const extraIndex = (aliases: string[]) => intestazioni.findIndex(h => aliases.includes(normalizzaHeader(h)))
    for (const row of parsed.rows) {
      const raw = rows[row.rowIndex] || []
      const extra = (aliases: string[]) => {
        const col = extraIndex(aliases)
        return col < 0 ? '' : testo(raw[col])
      }
      const prezzoCol = header?.columns.prezzoUnitario
      const rawPrezzo = prezzoCol === undefined ? undefined : raw[prezzoCol]
      // Keep the actual numeric cell, including precision hidden by Excel's
      // display format. Text conversion is delegated to the existing parser.
      const prezzo = typeof rawPrezzo === 'number' ? rawPrezzo : row.prezzoUnitario
      const prezzoLeggibile = typeof rawPrezzo === 'number' ||
        (typeof rawPrezzo === 'string' && /^[\s€\d.,+\-]+$/.test(rawPrezzo) && /\d/.test(rawPrezzo))
      const prezzoSicuro = !prezziAmbigui && prezzoLeggibile && Number.isFinite(prezzo) ? prezzo : undefined
      const codiceCol = header?.columns.codice
      const codice = codiceCol === undefined || normalizzaHeader(intestazioni[codiceCol]) === 'n' ? '' : row.codice || ''
      const descrizione = header && (header.columns.descrizione === undefined || !testo(raw[header.columns.descrizione])) ? '' : row.descrizione
      const percentualeCol = extraIndex(['incidenza manodopera', 'incidenza manodopera %', '% manodopera', 'percentuale manodopera'])
      const percentuale = percentualeCol < 0 ? '' : testo(XLSX.utils.format_cell(sheet[XLSX.utils.encode_cell({ r: offset + row.rowIndex, c: origine.c + percentualeCol })] || {})).replace(/%$/, '').trim()
      const formula = prezzoCol === undefined ? undefined : sheet[XLSX.utils.encode_cell({ r: offset + row.rowIndex, c: origine.c + prezzoCol })]?.f
      righe.push({ id: `${indice}:${offset + row.rowIndex + 1}`, foglio, riga: offset + row.rowIndex + 1,
        codiceOriginale: codice, prezzoDocumentale: prezzoSicuro !== undefined && prezzoSicuro > 0 ? prezzoSicuro : undefined,
        quantita: header?.columns.quantita !== undefined && typeof raw[header.columns.quantita] === 'number' ? raw[header.columns.quantita] as number : row.quantita, testoOriginale: row.rawText,
        avvisi: [...(!header ? ['Intestazioni non riconosciute: completare manualmente i campi.'] : []),
          ...(prezziAmbigui ? ['Più colonne prezzo unitario: scegliere il prezzo manualmente, consultando la riga originale.'] : []),
          ...(formula ? ['Prezzo da valore memorizzato della formula Excel; nessun ricalcolo.'] : []),
          ...(prezzoSicuro === undefined ? ['Prezzo unitario mancante o non verificabile: nessun uso del totale.'] : [])],
        form: { codice, descrizione, unita_misura: row.unitaMisura || '', prezzo_unitario: prezzoSicuro === undefined ? '' : String(prezzoSicuro),
          categoria: extra(['categoria', 'categoria costo']), zona: extra(['zona', 'provincia']), regione: extra(['regione']),
          note: extra(['note', 'annotazioni']), incidenza_manodopera: percentuale,
          prezzo_manodopera: extra(['prezzo manodopera', 'quota manodopera', 'manodopera u m']) },
      })
    }
  }
  if (!righe.length) throw Error('Il file non contiene righe da analizzare.')
  return { righe: classificaRighePreventivo(righe, contesti, workbook), avvisi }
}

const codiceConfronto = (s: string) => s.trim().toLocaleLowerCase('it-IT')
const chiaveTesto = (f: FormListino) => `${normalizePriceDescription(f.descrizione)}|${normalizeUnitOfMeasure(f.unita_misura)}`
const stessaVoce = (a: RigaPreventivoListino, b: RigaPreventivoListino) =>
  (!!a.form.codice.trim() && codiceConfronto(a.form.codice) === codiceConfronto(b.form.codice)) ||
  (!!a.form.descrizione.trim() && !!a.form.unita_misura.trim() && chiaveTesto(a.form) === chiaveTesto(b.form))
const formPersistibile = (r: RigaPreventivoListino, manodopera: boolean): FormListino => ({ ...r.form,
  ...(!manodopera ? { incidenza_manodopera: '', prezzo_manodopera: '' } : {}) })

export function confrontaPreventivoListino(righe: readonly RigaPreventivoListino[], listino: readonly VoceListino[], manodopera: boolean): ConfrontoPreventivoListino[] {
  const manuali = listino.filter(v => v.tipo_prezzo === 'artecna')
  return righe.map(riga => {
    const errori: string[] = []
    try {
      const campi = preparaVoceListino(formPersistibile(riga, manodopera))
      if (riga.prezzoDocumentale !== undefined && campi.prezzo_unitario !== riga.prezzoDocumentale) errori.push('Il prezzo documentale non può essere sostituito nell’anteprima.')
    } catch (e) { errori.push(e instanceof Error ? e.message : 'Campi da completare.') }
    const perCodice = riga.form.codice.trim() ? manuali.filter(v => codiceConfronto(v.codice || '') === codiceConfronto(riga.form.codice)) : []
    const matches = perCodice.length ? perCodice : manuali.filter(v =>
      !!riga.form.descrizione.trim() && !!riga.form.unita_misura.trim() &&
      normalizePriceDescription(v.descrizione || '') === normalizePriceDescription(riga.form.descrizione) &&
      normalizeUnitOfMeasure(v.unita_misura) === normalizeUnitOfMeasure(riga.form.unita_misura))
    return { riga, errori, matches, duplicatiFile: righe.filter(r => r.id !== riga.id && stessaVoce(riga, r)).map(r => r.id) }
  })
}
export const haConflittoPreventivo = (p: ConfrontoPreventivoListino) => p.matches.length > 0 || p.duplicatiFile.length > 0
const impronta = (p: ConfrontoPreventivoListino) => JSON.stringify(p.matches.map(v => [v.id, v.codice, v.descrizione, v.unita_misura, v.prezzo_unitario]).sort())

export function codiceNuovaVocePreventivo(r: RigaPreventivoListino, listino: readonly VoceListino[], scelte: readonly RigaPreventivoListino[]) {
  const codice = r.form.codice.trim()
  return !codice || /^SIC24/i.test(codice) || listino.some(v => codiceConfronto(v.codice || '') === codiceConfronto(codice)) ||
    scelte.filter(v => codiceConfronto(v.form.codice) === codiceConfronto(codice)).length > 1 ? '' : codice
}

// All validation and a fresh duplicate check happen before the first existing
// writer call. There is intentionally no update/upsert path in this workflow.
export async function importaPreventivoListino(db: SupabaseClient, proposte: readonly ConfrontoPreventivoListino[], selezione: readonly SceltaPreventivoListino[],
  fileName: string, manodopera: boolean, confermata: boolean) {
  if (!confermata) throw Error('Conferma obbligatoria prima dell’importazione.')
  const ids = new Set(selezione.map(s => s.id))
  if (ids.size !== selezione.length) throw Error('Selezione duplicata.')
  const scelte = proposte.filter(p => ids.has(p.riga.id))
  if (!scelte.length || scelte.length !== ids.size) throw Error('Seleziona almeno una voce valida.')
  if (scelte.some(p => !rigaCandidataPreventivo(p.riga) || (p.riga.nascosta && !p.riga.nascostaAbilitata))) throw Error('Riga esclusa o nascosta non abilitata esplicitamente: importazione bloccata.')
  if (scelte.some(p => p.errori.length || (haConflittoPreventivo(p) && selezione.find(s => s.id === p.riga.id)?.conflitto !== 'nuova'))) throw Error('Completa le righe e risolvi esplicitamente i conflitti.')
  const attuali = await leggiListinoManuale(db)
  const fresh = confrontaPreventivoListino(proposte.map(p => p.riga), attuali, manodopera)
  for (const p of scelte) {
    const f = fresh.find(v => v.riga.id === p.riga.id)!
    if (f.errori.length || impronta(f) !== impronta(p)) throw Error('Listino cambiato: rileggi e conferma nuovamente le voci.')
  }
  const dataImport = new Date().toISOString(), salvate: string[] = []
  try {
    for (const p of scelte) {
      const r = p.riga, form = formPersistibile(r, manodopera)
      const provenienza = [`Origine: preventivo_excel`, `File: ${fileName}`, `Foglio: ${r.foglio}; riga: ${r.riga}`, `Importato: ${dataImport}`,
        r.codiceOriginale ? `Codice originale: ${r.codiceOriginale}` : '',
        r.quantita === undefined ? '' : `Quantità documentale: ${r.quantita}`,
        !manodopera && r.form.incidenza_manodopera ? `% Manodopera documentale: ${r.form.incidenza_manodopera}` : '',
        !manodopera && r.form.prezzo_manodopera ? `Manodopera €/U.M. documentale: ${r.form.prezzo_manodopera}` : ''].filter(Boolean).join('\n')
      await salvaVoceListino(db, { ...form, codice: codiceNuovaVocePreventivo(r, attuali, scelte.map(v => v.riga)), note: [form.note, provenienza].filter(Boolean).join('\n\n') }, undefined, manodopera)
      salvate.push(r.id)
    }
    return { salvate }
  } catch (e) {
    return { salvate, errore: `${salvate.length} voci confermate prima dell’interruzione. ${e instanceof Error ? e.message : 'Errore salvataggio.'} Rileggi il Listino prima di riprovare: l’ultima scrittura potrebbe non essere confermata.` }
  }
}
