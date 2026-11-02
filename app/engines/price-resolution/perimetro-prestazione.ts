import { normalizePriceDescription } from './normalizer'
import { analizzaAmbitoPrezzoSic24 } from './descrizione-semantica'
import type { RigaTecnica, StimaTecnica } from './validazione-tecnica-stime'

// Azione sul bene principale e ampiezza del bene sono due vincoli distinti:
// si può fornire e posare sia un controtelaio sia un serramento completo.
const azioni = {
  predisposizione: /\bpredisposizion[ei]\b/,
  assistenza: /\bassistenza(?: muraria)?\b/,
  sola_posa: /\b(?:sol[oa]|esclusivamente) (?:la )?(?:posa|manodopera)\b/,
  sola_fornitura: /\b(?:sol[oa]|esclusivamente) (?:la )?fornitura\b/,
  fornitura_e_posa: /\b(?:fornitura\s+(?:(?:e|con|piu)\s+)?(?:posa|montaggio|installazione|collocazione)|posa (?:in opera )?(?:e|con) fornitura)\b/,
  posa: /\b(?:posa|montaggio|collocazione)\b/,
  fornitura: /\bfornitur[ae]\b/,
  rimozione: /\b(?:rimozione|eliminazione|smontaggio|svellimento|dismissione|rimoss[oaie])\b/,
  demolizione: /\b(?:demolizion[ei]|demoli(?:re|t[oaie]))\b/,
  manutenzione: /\b(?:manutenzione|revisione)\b/,
  ripristino: /\b(?:ripristin[oa]|riparazione|ripristinat[oaie])\b/,
  rifacimento_completo: /\b(?:(?:rifacimento|ricostruzione) (?:complet[oa]|totale|integrale|a nuovo)|(?:complet[oa]|totale|integrale) (?:rifacimento|ricostruzione))\b/,
  sostituzione_completa: /\b(?:sostituzione (?:completa|totale|integrale)|(?:completa|totale|integrale) sostituzione)\b/,
  sostituzione: /\bsostituzione\b/,
  finitura: /\b(?:verniciatura|pittura|tinteggiatura|finitura)\b/,
  installazione: /\b(?:installazione|realizzazione)\b/,
}
type Azione = keyof typeof azioni
type Tipo = Azione | 'componente' | 'impianto_completo' | 'insieme_completo'

export type ConfrontoPerimetro = {
  perimetro_prestazione_input: Tipo[]
  perimetro_prestazione_stimato: Tipo[]
  coerenza_perimetro: 'incompatibile' | 'compatibile' | 'non_determinabile'
  differenze_perimetro: string[]
}

const accessorio = /\b(?:controtelai[oi]|telai[oi] a scomparsa|component[ei]|accessori[oi]|ricambi[oi]|modul[oi]|sched[ae])\b/
const insieme = /\b(?:impiant[oi]|sistem[ai]|pacchett[oi]|kit|serrament[oi]|infiss[oi]|apparecchiatur[ae]|macchinar(?:io|i))\b/
const intero = /\b(?:complet[oaie]|inter[oaie]|integral[ei]|chiavi in mano)\b/
const materialiAccessori = /\bfornitura\s+(?:(?:di|del|della|dei|degli|delle)\s+)?(?:material[ei] (?:ausiliar[io]+|di consumo)|consumabil[ei]|minuteria|collant[ei]|stucc[oi]|vernic[ei]|sigillant[ei])\b/
const operazioniParziali: readonly (Azione | undefined)[] = ['predisposizione', 'assistenza', 'manutenzione', 'ripristino', 'finitura', 'rimozione', 'demolizione']
const azioneAggiunta = /\bed? (?:anche |successiv[oa] )?(?=(?:fornitura|installazione|realizzazione|sostituzione|rifacimento|predisposizione)\b)/i
const limitazioneEsplicita = /\b(?:sol[oa]|soltanto|esclusivamente|limitatamente|si stima|si quota|prezzo (?:riferito|relativo) a)\b/i

function classifica(frase: string): Tipo[] {
  const testo = normalizePriceDescription(frase)
  // È l'azione reggente che si quota. "Predisposizione per installazione" e
  // "ripristino comprendente rifacimento dell'intonaco" non cambiano oggetto.
  const principale = testo.split(/\b(?:comprendente|comprensiv[oaie]|mediante|previa|come descritt[oaie]|con predisposizione)\b/)[0]
  let azione = (Object.keys(azioni) as Azione[]).map(tipo => ({ tipo, indice: principale.search(azioni[tipo]) }))
    .filter(m => m.indice >= 0).sort((a, b) => a.indice - b.indice)[0]?.tipo
  if (azione === 'posa' || azione === 'fornitura') {
    const ambito = analizzaAmbitoPrezzoSic24(frase).tipo
    if (ambito === 'sola_posa') azione = 'sola_posa'
    if (azione === 'posa' && ambito === 'completa' && /\b(?:compres[ao]|inclus[ao]|con) (?:la )?fornitura\b/.test(testo)
        && !materialiAccessori.test(testo)) azione = 'fornitura_e_posa'
  }
  const tipi: Tipo[] = azione ? [azione] : []
  // Il bene di destinazione ("tubazioni per l'impianto") non è quello prezzato.
  const bene = principale.replace(/\b(?:stima|prezzo|costo)(?: unitari[oa])? per\b/g, '').split(/\bper\b/)[0].trim()
  const oggetto = insieme.exec(bene)
  const parte = accessorio.exec(bene)
  if (parte && (!oggetto || parte.index < oggetto.index)) tipi.push('componente')
  else if (oggetto && !operazioniParziali.includes(azione)) {
    const impianto = /^(?:impiant|sistem)/.test(oggetto[0])
    const diretto = /(?:^|\b(?:fornitura(?: e posa(?: in opera)?)?|installazione|realizzazione|corrisponde a|equivale a) )(?:(?:di|del|dello|dell|dei|degli|un|uno|il|l) )*$/.test(bene.slice(0, oggetto.index))
    if (intero.test(bene.split(/\bcon\b/)[0]) || (diretto && (impianto || /^(?:serrament|infiss)/.test(oggetto[0])))) {
      tipi.push(impianto ? 'impianto_completo' : 'insieme_completo')
    }
  } else if (!oggetto && /\binstallazione (?:completa|integrale|chiavi in mano)\b/.test(bene)) tipi.push('insieme_completo')
  return tipi
}

// Contrasti bidirezionali fra prestazioni esplicite. La presenza di una singola
// componente nel dettaglio costi non prova una riduzione dell'intero pacchetto.
const contrasti: [Tipo[], Tipo[]][] = [
  [['predisposizione', 'assistenza'], ['impianto_completo', 'insieme_completo']],
  [['sola_posa', 'posa'], ['fornitura_e_posa', 'fornitura', 'sola_fornitura']],
  [['sola_fornitura'], ['fornitura_e_posa']],
  [['rimozione', 'demolizione'], ['fornitura', 'sola_fornitura', 'fornitura_e_posa', 'sostituzione', 'sostituzione_completa']],
  [['ripristino', 'manutenzione'], ['rifacimento_completo', 'sostituzione_completa']],
  [['finitura'], ['fornitura', 'sola_fornitura', 'fornitura_e_posa']],
  [['componente'], ['insieme_completo', 'impianto_completo']],
]

// Solo affermazioni sulla stima. Esclusioni, ipotesi condizionali e tariffe
// citate a confronto non costituiscono lavorazioni incluse nel prezzo.
export function clausoleAffermative(testo: string): string[] {
  return testo.split(/[.;!?\n]|(?=\b(?:il prezzo|(?:la|questa) stima) (?:comprende|include|copre|riguarda)|\bqui si (?:stima|quota))/i)
    .filter(frase => !/\b(?:riferiment[oi]|listin[oi]|tariffari[oi]|qualora|ipotetic[oa]|se|sarebbe|potrebbe)\b/i.test(frase))
    .flatMap(frase => frase.split(/\b(?:mentre|invece|tuttavia|ma)\b/i))
    .flatMap(frase => frase.replace(/\b(non\s+)?(escludendo|includendo|comprendendo)\b/gi,
      (_, negato, verbo: string) => (verbo.toLowerCase() === 'escludendo') !== Boolean(negato) ? ' senza ' : ';include ').split(';'))
    .map(frase => frase.split(/\b(?:senza|non (?:si )?(?:include|comprende|copre|prevede|stima|quota|tratta di)|esclus[oaie] (?:(?:la|il|lo|le|gli|i) |l['’]|fornitura\b|posa\b))\b/i)[0])
}

function affermazioni(testo: string): string[] {
  return clausoleAffermative(testo)
    .flatMap(frase => frase.split(/,|\b(?:include|comprende|copre) (?:anche )?/i))
    .filter(frase => !/\b(?:esclus[oaie]|non (?:[èe] |sono )?(?:un|una|inclus[oaie]|compres[oaie]|previst[oaie]|present[ei])|manca(?:no)?|insufficient[ei])\b/i.test(frase))
    .map(frase => frase.trim()).filter(Boolean)
}

export function confrontaPerimetroPrestazione(r: Pick<RigaTecnica, 'descrizione' | 'contesto_tecnico'>,
  s: Pick<StimaTecnica, 'unita_economica' | 'motivazione' | 'componenti_economiche' | 'avvisi'>): ConfrontoPerimetro {
  // Una nota esplicitamente limitativa può precisare un'intestazione generica.
  // Un dubbio, un'ubicazione o una citazione di listino non la sostituiscono.
  const nota = r.contesto_tecnico?.annotazioni?.trim() || ''
  const oggetto = /^(?:sol[oa]|esclusivamente|limitatamente a)\s/i.test(nota) && !nota.includes('?') && classifica(nota).length
    ? nota : r.descrizione
  const input = classifica(oggetto)
  const aggiunte = (testo: string) => testo.split(azioneAggiunta).slice(1).flatMap(classifica)
  const richiesti = new Set([...input, ...aggiunte(oggetto.split(/[.;]|\b(?:comprendente|compres[oaie])\b/i)[0])])
  const inclusioniDocumento = affermazioni(oggetto).map(f => ' ' + normalizePriceDescription(f) + ' ')
  const stimato = new Set<Tipo>()
  const differenze = new Set<string>()
  function confronta(frase: string, campo: 'unita' | 'spiegazione' | 'componente') {
    const testo = normalizePriceDescription(frase)
    // Una sottoprestazione espressamente richiesta può essere valorizzata
    // come componente. Non può per questo sostituire l'intera unità economica.
    if (campo === 'componente' && inclusioniDocumento.some(f => f.includes(' ' + testo + ' '))) return
    const oggettoDelPrezzo = campo === 'unita' || (campo === 'spiegazione' && limitazioneEsplicita.test(frase))
    for (const tipo of [...classifica(frase), ...aggiunte(frase)]) {
      if (campo !== 'componente') stimato.add(tipo)
      // Un materiale di consumo è compatibile con posa, finitura o ripristino.
      if (tipo === 'fornitura' && materialiAccessori.test(testo)) continue
      if (richiesti.has(tipo)) continue
      for (const [limitati, estesi] of contrasti) {
        const contrari = estesi.includes(tipo) ? limitati : limitati.includes(tipo) && oggettoDelPrezzo ? estesi : []
        const richiesto = input.find(t => contrari.includes(t))
        // La posa è una parte naturale della fornitura con posa. Una riduzione
        // è dimostrata solo quando l'offerta si limita espressamente alla posa.
        if (!richiesto || (richiesto === 'fornitura_e_posa' && tipo === 'posa')) continue
        stimato.add(tipo)
        differenze.add('Documento: ' + richiesto + '. Stima: ' + tipo + ' («' + frase + '»).')
      }
    }
  }
  for (const frase of affermazioni(s.unita_economica?.descrizione || '')) confronta(frase, 'unita')
  for (const testo of [s.motivazione, ...(s.avvisi || [])]) {
    for (const frase of affermazioni(testo)) confronta(frase, 'spiegazione')
  }
  for (const c of s.componenti_economiche || []) {
    if (c.importo_unitario > 0) for (const frase of affermazioni(c.descrizione)) confronta(frase, 'componente')
  }
  return {
    perimetro_prestazione_input: [...richiesti], perimetro_prestazione_stimato: [...stimato],
    coerenza_perimetro: differenze.size ? 'incompatibile' : [...richiesti].some(t => stimato.has(t)) ? 'compatibile' : 'non_determinabile',
    differenze_perimetro: [...differenze],
  }
}
