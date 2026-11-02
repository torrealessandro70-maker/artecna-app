import { normalizePriceDescription, normalizeUnitOfMeasure } from './normalizer'

export type ClasseRiferimento = 'trasferibile' | 'comparabile' | 'solo_informativo' | 'incompatibile'
export type StatoTecnico = 'accettata' | 'sospesa_da_verificare' | 'scartata'
export type RiferimentoTecnico = {
  id: string; codice: string | null; descrizione: string; unita: string; prezzo: number; fonte: string
  similarity?: number; compatibilita_um?: 'compatibile' | 'incompatibile' | 'non verificabile'; avvisi?: string[]
  comprende_fornitura?: boolean; sola_posa_non_equivalente?: boolean; classificazione?: ClasseRiferimento
  utilizzabile_come_ancoraggio?: boolean; solo_informativo_non_trasferibile?: boolean
}
export type PerimetroLavorazione = { id: string; descrizione: string; unita: string; quantita: number; testo_stima?: string }
export type RigaTecnica = PerimetroLavorazione & { contesto_riga: string; composita: boolean; ambito: string; riferimenti: RiferimentoTecnico[] }
export type ComponenteEconomica = {
  categoria: 'demolizione_rimozione' | 'materiale' | 'posa' | 'opere_accessorie' | 'smaltimento' | 'sicurezza_noli'
  descrizione: string; importo_unitario: number; riferimento_id: string | null
}
export type BaseEconomicaStima = {
  quantita_strutturata?: number; totale_riga_previsto?: number | null
  unita_economica?: { descrizione: string; base_documentale: string } | null
  riferimenti_ancoraggio?: string[]
  componenti_economiche?: ComponenteEconomica[]
  scorporo_fornitura?: { riferimento_completo_id: string; riferimento_materiale_id: string; costo_posa_unitario: number } | null
  esclusioni_componenti?: { componente: 'ponteggio' | 'ringhiera' | 'verniciatura'; voce_copertura_id: string; motivazione: string }[]
}
export type StimaTecnica = BaseEconomicaStima & {
  prezzo_unitario_proposto: number | null; unita_interpretata: string; quantita_coperta_dal_prezzo: number | null
  totale_riga_proposto: number | null; motivazione: string; riferimenti_utilizzati: string[]; lavorazione_composita: boolean
}
export type ValidazioneTecnica = { stato: StatoTecnico; codici: string[]; motivi: string[]; avvisi: string[]; riferimenti_ancoraggio: string[] }

const n = (s: string) => normalizePriceDescription(s)
const um = (s: string) => normalizeUnitOfMeasure(s)
const soggetto = (s: string) => n(s).split(/\b(?:compres[oaie]|esclus[oaie]|sono compres[ie]|sono esclus[ie])\b/)[0].slice(0, 450)

// Technical object and scope, never prices/codes/row numbers from a particular bill.
export function famigliaTecnica(descrizione: string): string {
  const d = soggetto(descrizione)
  const regole: [string, RegExp][] = [
    ['accessori_porta', /chiudiporta|maggior prezzo alla porta/],
    ['accessori', /^accessori\b|^maggior prezzo\b/],
    ['telaio_scomparsa', /telaio a scomparsa|controtelaio.*scomparsa/],
    ['controtelaio', /telaio esterno|controtelaio/],
    ['assistenza_muraria', /assistenza muraria/],
    ['apertura_portante', /apertura.*muratura portante|allargamento.*apertura/],
    ['fotovoltaico', /fotovoltaic/], ['vespaio', /vespaio|\bigloo\b/], ['paramassi', /paramassi/],
    ['geostuoia', /geostuoia|geocomposito|scarpata/], ['wellpoint', /wellpoint|falda freatica/],
    ['perforazioni', /spingitubo|presso trivella|perforazioni|sondaggi/], ['imhoff', /imhoff|fossa biologica/],
    ['cabina_elettrica', /cabina prefabbricata/], ['citofono', /citofonic|videocitofonic/],
    ['condizionamento', /impianto condizionamento|ventilconvettor/], ['antifurto', /antifurto|antintrusione/],
    ['videosorveglianza', /videosorveglianza/], ['impianto_elettrico', /impianto elettrico/],
    ['impianto_idrico', /impianto idrico|punto acqua/], ['muro_confine', /muro di confine|pilastri cancello/],
    ['scala', /ripristino scala/], ['tetto', /tetto|copertura.*tegole|revisione.*copertura/],
    ['pavimento_stradale', /pavimentazione stradale|basole|conglomerato bituminoso/],
    ['verniciatura', /verniciatura|pittura della ringhiera/], ['ferro', /ringhier|opere in ferro|cancellat/],
    ['pietra_lavica', /pietra lavica/], ['zoccolo', /zoccolett|battiscopa|zoccolatura/],
    ['rivestimento', /maiolica|rivestiment.*ceramic/], ['pavimento', /paviment|piastrell/],
    ['facciata', /facciata/], ['rasatura', /rasatura|rasante/], ['intonaco', /intonaco/],
    ['sanitari', /sanitari|apparecchi igienico/], ['infissi', /infiss|serrament|porte interne|porta interna/],
    ['muratura', /muratura|tramezz/], ['tubazioni', /tubazion|pluvial|grondaie/],
  ]
  return regole.find(([, re]) => re.test(d))?.[0] || 'non_identificata'
}
const rimozione = (d: string) => /^(?:demolizion|eliminazion|rimozion|svelliment|dismission)/.test(soggetto(d))
export const solaPosa = (d: string) => /^posa\b/.test(n(d)) && !/fornitur/.test(soggetto(d))
const fornitura = (d: string) => (/fornitur|fornit[oaie]/.test(soggetto(d)) || /inclusi (?:i )?materiali|materiali inclusi/.test(n(d))) && !/esclus[oa] (?:la )?fornitura/.test(n(d))
const fornituraSenzaPosa = (d: string) => fornitura(d) && !/posa|collocazion|montaggio/.test(soggetto(d))
const parziali: Record<string, string[]> = {
  facciata: ['rasatura', 'intonaco'], scala: ['muratura', 'intonaco', 'rasatura'],
  muro_confine: ['muratura', 'ferro'], muratura: ['muratura'],
  apertura_portante: ['muratura', 'ferro'],
  ferro: ['verniciatura', 'accessori'],
}
function oggettiCompatibili(q: string, r: string) {
  return q === r || (q === 'rivestimento' && r === 'pavimento')
}
const materialiEspliciti = (d: string) => ['ceramic', 'cotto', 'legno', 'pvc', 'alluminio', 'acciaio', 'pietra lavica', 'laminato']
  .filter(m => soggetto(d).includes(m))
function materialiContraddittori(a: string, b: string) {
  const q = materialiEspliciti(a), r = materialiEspliciti(b)
  return q.length > 0 && r.length > 0 && !q.some(m => r.includes(m))
}
export function classificaRiferimento(riga: Pick<RigaTecnica, 'descrizione' | 'unita'>, ref: RiferimentoTecnico): RiferimentoTecnico {
  const q = famigliaTecnica(riga.descrizione), f = famigliaTecnica(ref.descrizione)
  const compatibilita = ref.compatibilita_um === 'incompatibile' ? 'incompatibile' :
    !um(riga.unita) || !um(ref.unita) ? 'non verificabile' : um(riga.unita) === um(ref.unita) ? 'compatibile' : 'incompatibile'
  const comprende = fornitura(ref.descrizione) || ref.comprende_fornitura === true ||
    (ref.avvisi || []).some(a => /comprende fornitura|non equivale alla sola posa/i.test(a))
  const nonEquivale = (solaPosa(riga.descrizione) && comprende) || ref.sola_posa_non_equivalente === true
  const oggettoOk = q !== 'non_identificata' && oggettiCompatibili(q, f)
  const parziale = !!parziali[q]?.includes(f)
  const avvisi = [...(ref.avvisi || [])]
  let classificazione: ClasseRiferimento
  if (ref.classificazione === 'incompatibile' || (q !== 'non_identificata' && f !== 'non_identificata' && !oggettoOk && !parziale) ||
      (!parziale && rimozione(riga.descrizione) !== rimozione(ref.descrizione)) ||
      (oggettoOk && materialiContraddittori(riga.descrizione, ref.descrizione)) ||
      (/taglio termico/.test(n(riga.descrizione)) && /non a taglio termico/.test(n(ref.descrizione)))) {
    classificazione = 'incompatibile'; avvisi.push('Oggetto, azione o tecnologia diversi dalla lavorazione.')
  } else if (!oggettoOk || parziale || compatibilita !== 'compatibile' || nonEquivale || ref.solo_informativo_non_trasferibile === true ||
      fornituraSenzaPosa(ref.descrizione) !== fornituraSenzaPosa(riga.descrizione)) {
    classificazione = 'solo_informativo'
  } else classificazione = n(riga.descrizione) === n(ref.descrizione) ? 'trasferibile' : 'comparabile'
  if (compatibilita !== 'compatibile') avvisi.push('U.M. non trasferibile: nessuna conversione dimensionale dimostrata.')
  if (nonEquivale) avvisi.push('Comprende fornitura: non equivale alla sola posa senza scorporo verificato.')
  if (parziale) avvisi.push('Riferimento di una componente, non del pacchetto completo.')
  return { ...ref, similarity: ref.similarity, compatibilita_um: compatibilita, avvisi: [...new Set(avvisi)],
    comprende_fornitura: comprende, sola_posa_non_equivalente: nonEquivale, classificazione,
    utilizzabile_come_ancoraggio: classificazione === 'trasferibile' || classificazione === 'comparabile',
    solo_informativo_non_trasferibile: classificazione === 'solo_informativo' || classificazione === 'incompatibile' }
}

function scorporoVerificato(r: RigaTecnica, s: StimaTecnica) {
  const b = s.scorporo_fornitura
  if (!b) return false
  const completo = r.riferimenti.find(x => x.id === b.riferimento_completo_id)
  const materiale = r.riferimenti.find(x => x.id === b.riferimento_materiale_id)
  return !!completo && !!materiale && completo.id !== materiale.id && fornitura(completo.descrizione) &&
    !fornituraSenzaPosa(completo.descrizione) && fornituraSenzaPosa(materiale.descrizione) &&
    famigliaTecnica(completo.descrizione) === famigliaTecnica(materiale.descrizione) &&
    materialiEspliciti(completo.descrizione).some(m => materialiEspliciti(materiale.descrizione).includes(m)) &&
    !materialiContraddittori(completo.descrizione, materiale.descrizione) &&
    oggettiCompatibili(famigliaTecnica(r.descrizione), famigliaTecnica(completo.descrizione)) &&
    um(completo.unita) === um(r.unita) && um(materiale.unita) === um(r.unita) &&
    completo.prezzo > materiale.prezzo && Math.abs(completo.prezzo - materiale.prezzo - b.costo_posa_unitario) < 0.005 &&
    Math.abs(b.costo_posa_unitario - Number(s.prezzo_unitario_proposto)) < 0.005
}

export function sovrapposizioniEconomiche(r: RigaTecnica, s: StimaTecnica, tutte: readonly PerimetroLavorazione[]) {
  const testo = n(r.descrizione + ' ' + s.motivazione)
  const altre = tutte.filter(x => x.id !== r.id && x.quantita > 0)
  const sovrapposizioni: { componente: 'ponteggio' | 'ringhiera' | 'verniciatura'; voce: string }[] = []
  if (/ponteggi/.test(testo)) {
    for (const a of altre.filter(a => /^(?:approntamento|montaggio|nolo).*ponteggi/.test(n(a.descrizione)))) sovrapposizioni.push({ componente: 'ponteggio', voce: a.id })
  }
  if (famigliaTecnica(r.descrizione) === 'muro_confine' && /ringhier/.test(testo)) {
    for (const a of altre.filter(a => famigliaTecnica(a.descrizione) === 'ferro')) sovrapposizioni.push({ componente: 'ringhiera', voce: a.id })
  }
  if (famigliaTecnica(r.descrizione) === 'ferro') {
    for (const a of altre.filter(a => famigliaTecnica(a.descrizione) === 'muro_confine' && /ringhier/.test(n(a.descrizione)))) sovrapposizioni.push({ componente: 'ringhiera', voce: a.id })
    if (/verniciatur|pittur/.test(testo)) for (const a of altre.filter(a => famigliaTecnica(a.descrizione) === 'verniciatura')) sovrapposizioni.push({ componente: 'verniciatura', voce: a.id })
  }
  if (famigliaTecnica(r.descrizione) === 'verniciatura') {
    for (const a of altre.filter(a => famigliaTecnica(a.descrizione) === 'ferro' && /verniciatur|pittur/.test(n(a.descrizione + ' ' + (a.testo_stima || ''))))) sovrapposizioni.push({ componente: 'verniciatura', voce: a.id })
  }
  return sovrapposizioni
}

export function validaTecnicamenteStima(riga: RigaTecnica, stima: StimaTecnica, tutte: readonly PerimetroLavorazione[]): ValidazioneTecnica {
  const result: ValidazioneTecnica = { stato: 'accettata', codici: [], motivi: [], avvisi: [], riferimenti_ancoraggio: [] }
  const blocca = (stato: Exclude<StatoTecnico, 'accettata'>, codice: string, motivo: string) => {
    if (result.stato !== 'scartata') result.stato = stato
    result.codici.push(codice); result.motivi.push(motivo)
  }
  const r = { ...riga, riferimenti: riga.riferimenti.map(ref => classificaRiferimento(riga, ref)) }
  const testo = n(stima.motivazione + ' ' + (stima.unita_economica?.descrizione || ''))
  const scorporo = scorporoVerificato(r, stima)
  if (stima.scorporo_fornitura && !scorporo) blocca('sospesa_da_verificare', 'scorporo_non_dimostrato', 'Lo scorporo dichiarato non è verificabile sui prezzi, sugli oggetti e sulle U.M. dei due riferimenti originali.')
  const ancoraggi = stima.riferimenti_ancoraggio ?? stima.riferimenti_utilizzati
  const autonomiaEsplicita = /senza (?:riferimento|trasferimento|conversione).*dirett|stima autonoma/.test(testo)
  const contestoAutonomoNonAncorato = stima.riferimenti_ancoraggio === undefined && autonomiaEsplicita
  for (const id of ancoraggi) {
    const ref = r.riferimenti.find(ref => ref.id === id)
    if (!ref) { blocca('scartata', 'riferimento_assente', 'Riferimento economico non presente nel contesto originale.'); continue }
    if (ref.classificazione === 'incompatibile') blocca('scartata', 'oggetto_incompatibile', `Riferimento ${ref.codice || ref.id}: oggetto/azione/tecnologia incompatibili.`)
    else if (!ref.utilizzabile_come_ancoraggio && !contestoAutonomoNonAncorato) blocca('sospesa_da_verificare', 'ancoraggio_non_trasferibile', `Riferimento ${ref.codice || ref.id} solo informativo: non utilizzabile come ancoraggio diretto.`)
    else if (ref.utilizzabile_come_ancoraggio) result.riferimenti_ancoraggio.push(id)
    result.avvisi.push(...(ref.avvisi || []))
  }
  if (!ancoraggi.length && !stima.componenti_economiche?.length && !scorporo) blocca('sospesa_da_verificare', 'base_economica_assente', 'Stima autonoma senza componenti economiche verificabili.')
  if (solaPosa(r.descrizione) && r.riferimenti.some(ref => stima.riferimenti_utilizzati.includes(ref.id) && ref.comprende_fornitura) && !scorporo) {
    blocca('sospesa_da_verificare', 'scorporo_non_dimostrato', 'Sola posa derivata da fornitura+posa senza scorporo quantitativo verificato sui riferimenti ricevuti.')
  }
  if (['a_corpo', 'cad', 'cu'].includes(um(r.unita))) {
    const base = stima.unita_economica
    const quote = n(base?.base_documentale || '')
    const baseNelDocumento = quote.length >= 8 && n(r.contesto_riga || r.descrizione).includes(quote)
    const singolaDichiarata = /(?:per|a) (?:un[ao]? |ogni |ciascun[oa]? )?(?:singol[oa] )?(?:pezzo|telaio|porta|infisso|apertura|corpo|impianto)|singol[oa] (?:corpo|pezzo|apertura)/.test(testo)
    if (!baseNelDocumento && !singolaDichiarata) blocca('sospesa_da_verificare', 'unita_economica_non_dimostrata', 'Non è definito documentalmente cosa rappresenta una singola unità economica.')
    const elementiContabili = ['infissi', 'controtelaio', 'telaio_scomparsa', 'apertura_portante', 'sanitari', 'fotovoltaico']
    const conteggioEsplicito = /\b(?:n\.|numero|pezzi|corpi|punti)\s*[:=]?\s*\d/i.test(r.contesto_riga) ||
      (elementiContabili.includes(famigliaTecnica(r.descrizione)) && /(?:porte|finestre|apertur[ae]|bagno|piano).{0,60}:\s*\d/i.test(r.contesto_riga))
    if (r.quantita > 1 && !conteggioEsplicito) blocca('sospesa_da_verificare', 'conteggio_unita_non_documentato', 'Quantità discreta multipla senza conteggio documentato dei singoli elementi/pacchetti: potrebbe essere una misura complessiva.')
    if (!Number.isInteger(r.quantita) || (/\d\s*[×x]\s*\d/.test(r.contesto_riga) && !/apertur/.test(n(r.descrizione)))) {
      blocca('sospesa_da_verificare', 'quantita_dimensionale_ambigua', 'Quantità geometrica o frazionaria con U.M. discreta: nessuna conversione automatica.')
    }
    if (/\bbagno\s*:\s*\d/i.test(r.contesto_riga) && /per apparecchio|sanitari distinti/.test(testo)) {
      blocca('scartata', 'oggetto_unita_diverso', 'La quantità documenta bagni/pacchetti, ma il prezzo è dichiarato per apparecchi sanitari.')
    }
    const pacchetto = [...testo.matchAll(/(?:per|da|con)\s+(?:(?:le|i|tutte le|tutti i)\s+)?(\d+(?:[.,]\d+)?)\s+(?:unita|corpi|punti|pezzi|aperture|impianti)/g)]
      .some(m => Number(m[1].replace(',', '.')) > 1)
    if (pacchetto) blocca('sospesa_da_verificare', 'forfait_quantita_multipla', 'La motivazione riferisce il forfait a più unità: non è provato che il prezzo copra una sola unità originale.')
  }
  if (stima.quantita_strutturata !== undefined && stima.quantita_strutturata !== r.quantita) blocca('scartata', 'quantita_modificata', 'La risposta non conserva la quantità strutturata.')
  if (stima.quantita_coperta_dal_prezzo !== 1) blocca('sospesa_da_verificare', 'base_multipla', 'Prezzo riferito a una quantità diversa da una singola unità originale.')
  const componenti = stima.componenti_economiche || []
  const composita = r.composita || stima.lavorazione_composita || ['facciata', 'apertura_portante', 'tetto', 'imhoff', 'muro_confine', 'impianto_elettrico', 'impianto_idrico', 'condizionamento', 'fotovoltaico', 'assistenza_muraria', 'antifurto', 'videosorveglianza', 'vespaio', 'scala'].includes(famigliaTecnica(r.descrizione))
  if (composita) {
    if (componenti.length < 2 || new Set(componenti.map(c => c.categoria)).size < 2) blocca('sospesa_da_verificare', 'scomposizione_assente', 'Lavorazione composita senza scomposizione economica verificabile.')
  }
  if (componenti.length) {
    if (componenti.some(c => !Number.isFinite(c.importo_unitario) || c.importo_unitario <= 0 || !c.descrizione.trim()) ||
        Math.abs(componenti.reduce((s, c) => s + c.importo_unitario, 0) - Number(stima.prezzo_unitario_proposto)) > 0.005) {
      blocca('scartata', 'somma_componenti_incoerente', 'La somma delle componenti non coincide con il prezzo unitario proposto.')
    }
    const refs = componenti.map(c => c.riferimento_id).filter((id): id is string => id !== null)
    if (new Set(refs).size !== refs.length) blocca('sospesa_da_verificare', 'componente_duplicata', 'Lo stesso riferimento è conteggiato in più componenti economiche.')
    const coperture = componenti.map(c => c.categoria + ':' + famigliaTecnica(c.descrizione)).filter(k => !k.endsWith(':non_identificata'))
    if (new Set(coperture).size !== coperture.length) blocca('sospesa_da_verificare', 'perimetro_componente_duplicato', 'Componenti della stessa categoria e prestazione: distinzione dei perimetri non dimostrata.')
    const richieste: [RegExp, ComponenteEconomica['categoria']][] = [
      [/fornitur/, 'materiale'], [/\bposa\b/, 'posa'], [/demolizion|rimozion/, 'demolizione_rimozione'],
      [/smaltimento|discarica/, 'smaltimento'], [/puntell/, 'sicurezza_noli'],
    ]
    if (composita) for (const [re, categoria] of richieste) {
      if (re.test(n(r.descrizione)) && !componenti.some(c => c.categoria === categoria)) blocca('sospesa_da_verificare', 'componente_necessaria_assente', `Pacchetto composito: manca la componente ${categoria} prevista dal documento.`)
    }
    for (const c of componenti) {
      const ref = r.riferimenti.find(ref => ref.id === c.riferimento_id)
      if (c.riferimento_id && (!ref || !classificaRiferimento({ descrizione: c.descrizione, unita: r.unita }, ref).utilizzabile_come_ancoraggio ||
          Math.abs(c.importo_unitario - ref.prezzo) > 0.005) && !scorporo) blocca('sospesa_da_verificare', 'componente_non_dimostrata', 'Una componente usa un riferimento assente, non equivalente o con importo non giustificato.')
      if (solaPosa(r.descrizione) && c.categoria === 'materiale' && !/collant|stucc|sigillant/.test(n(c.descrizione))) blocca('sospesa_da_verificare', 'materiale_principale_incluso', 'La stima di sola posa include una componente materiale non dimostrata come consumabile.')
    }
  }
  for (const sovrapposizione of sovrapposizioniEconomiche(r, stima, tutte)) {
    const esclusa = stima.esclusioni_componenti?.some(e => e.componente === sovrapposizione.componente && e.voce_copertura_id === sovrapposizione.voce && e.motivazione.trim().length >= 10)
    const ancoraConteggiata = componenti.some(c => new RegExp(sovrapposizione.componente).test(n(c.descrizione)))
    if (!esclusa || ancoraConteggiata) blocca('sospesa_da_verificare', 'sovrapposizione_' + sovrapposizione.componente, `Possibile duplicazione ${sovrapposizione.componente} con ${sovrapposizione.voce}: esclusione economica non dimostrata.`)
  }
  if (result.stato === 'accettata') result.motivi.push('Base unitaria e riferimenti tecnicamente coerenti; resta una stima provvisoria, non un prezzo certificato.')
  result.codici = [...new Set(result.codici)]
  result.motivi = [...new Set(result.motivi)]
  result.avvisi = [...new Set(result.avvisi)]
  return result
}
