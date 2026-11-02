import type { PerimetroLavorazione, RigaTecnica, StimaTecnica } from './validazione-tecnica-stime'

export type RilievoSemantico = { codice: string; motivo: string; soloAvviso?: true }

const piano = (testo: string) => testo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

// Keep qualifiers: "materiale di consumo" and "materiale principale" are distinct scopes.
function etichetta(testo: string) {
  return piano(testo).replace(/^(?:(?:la|il|lo|i|gli|le|componente|costo|del|della|dei|degli|delle)\s+|l['’])+/, '').trim()
}

function nomeComponente(testo: string) {
  return etichetta(testo)
    .replace(/[:_]/g, ' ').replace(/([cg])io\b/g, '$1i').replace(/([a-z]{2})[aeio]\b/g, '$1').trim()
}

function perimetroDichiarato(stima: StimaTecnica) {
  const incluse = new Set<string>()
  const escluse = new Map<string, string>()
  const escludi = (nome: string) => escluse.set(nomeComponente(nome), etichetta(nome))
  for (const e of stima.esclusioni_componenti || []) escludi(e.componente)
  for (const c of stima.componenti_economiche || []) {
    if (c.importo_unitario > 0) {
      incluse.add(nomeComponente(c.descrizione))
      incluse.add(nomeComponente(c.categoria))
    }
  }
  const dichiarazioni = [stima.motivazione, ...(stima.avvisi || []), stima.unita_economica?.descrizione || '',
    ...(stima.esclusioni_componenti || []).map(e => e.motivazione)]
  for (const dichiarazione of dichiarazioni) {
    for (const frase of dichiarazione.toLowerCase().split(/[.;!?\n]|\b(?:mentre|invece|tuttavia|ma)\b/)) {
      // Only declarative scope of this estimate. References and conditional scenarios are context.
      if (/\b(?:se|qualora|potrebbe|eventualmente)\b/.test(frase) ||
          /\b(?:riferiment[oi]|listino|computo|documento|capitolato|contratto)\b[^,]{0,70}\b(?:comprend|includ|esclud|comprensiv)/.test(frase)) continue
      const proposizione = piano(frase.replace(/(?:^|\s)(?:è|sono|viene|vengono)\s+(?=(?:non )?(?:inclus|esclus|compres))/g, ' '))
      let registra: ((nome: string) => void) | undefined
      let soggetti: string[] = []
      for (const pezzo of proposizione.split(/\s*(?:,|\b(?:e|ed|ma)\b)\s*/)) {
        const segmento = pezzo.trim()
        const suffisso = /^(.*?)\s+(non\s+)?(inclus[oaie]|compres[oaie]|esclus[oaie])(?:\s+(?:dal|nel|dalla|nella) (?:prezzo|totale|pacchetto|stima|bozza))?$/.exec(segmento)
        const prefisso = /\b(non\s+)?(comprende|include|comprensiv[oaie] di|compres[oaie]|inclus[oaie]|esclude|esclus[oaie]|senza)\s+(.+)$/.exec(segmento)
        if (suffisso || prefisso) {
          const parola = suffisso?.[3] ?? prefisso![2]
          const negata = Boolean(suffisso ? suffisso[2] : prefisso![1])
          registra = (/^(?:escl|senza)/.test(parola) !== negata) ? escludi : nome => incluse.add(nomeComponente(nome))
          if (suffisso) {
            for (const soggetto of [...soggetti, suffisso[1]]) registra(soggetto)
            registra = undefined
          } else registra(prefisso![3])
          soggetti = []
        } else if (registra) registra(segmento)
        else if (segmento) soggetti.push(segmento)
      }
    }
  }
  return { incluse, escluse }
}

type Spiegazione = Pick<StimaTecnica, 'motivazione' | 'avvisi' | 'unita_economica'>

export function contraddizioniDocumento(r: RigaTecnica, s: Spiegazione): RilievoSemantico[] {
  const doc = piano([r.descrizione, r.contesto_riga, r.contesto_tecnico?.ubicazioneDimensioni,
    r.contesto_tecnico?.annotazioni].filter(Boolean).join('\n'))
  const campi: [string, boolean, string][] = [
    ['quantità', Number.isFinite(r.quantita), 'quantita(?: strutturata| contabile)?'],
    ['U.M.', Boolean(r.unita.trim()), '(?:unita di misura|u\\.?\\s*m\\.?)'],
    ['potenza', /\b\d+(?:[.,]\d+)?\s*(?:w|kwp?|mw)\b/.test(doc), 'potenza'],
    ['numero punti', /\b\d+\s+punt[oi]\b|\bpunti\s*[:=]\s*\d+/.test(doc), '(?:numero (?:di |dei )?punti|conteggio (?:dei )?punti)'],
    ['dimensioni', /\d\s*[×x]\s*\d|\d\s*(?:mm|cm|metri|m)\b/.test(doc), '(?:dimensioni|misure)'],
    ['annotazioni', Boolean(r.contesto_tecnico?.annotazioni?.trim()), '(?:note|annotazioni)'],
    ['ubicazione', /\b(?:piano|zona|locale|muro|facciata|vano|interno|esterno)\b/.test(piano(r.contesto_tecnico?.ubicazioneDimensioni || '')), 'ubicazione'],
  ]
  const frasi = [s.motivazione, ...(s.avvisi || []), s.unita_economica?.descrizione || '']
    .flatMap(t => piano(t).replace(/\bu\.\s*m\./g, 'um').split(/[.;!?]/))
    .filter(t => !/\b(?:se|qualora|non manca|non mancano|non e vero che)\b/.test(t))
  return campi.filter(([, presente, campo]) => {
    if (!presente) return false
    const termine = '(?:' + campo + ')'
    const attributo = '(?:assent[ei]|mancant[ei]|non (?:e |sono |viene |vengono )?(?:indicat[aoie]|specificat[aoie]|disponibil[ei]|present[ei]))'
    const manca = '(?:mancano|manca|assenza (?:di|della|del|delle)|nessun dato sulla|non (?:e |sono )?indicat[aoie])'
    const assenza = new RegExp('\\b(?:' + termine + '\\s+(?:e |sono )?' + attributo + '|' + manca
      + '\\s+(?:(?:il|la|le) )?' + termine + ')(?: nel (?:documento|computo)| nella (?:voce|descrizione)| in input)?(?=\\s*(?:[,:]|$))')
    return frasi.some(f => assenza.test(f))
  }).map(([nome]) => ({ codice: 'contraddizione_input_output', motivo: 'La risposta dichiara assente un dato presente nella voce originale (' + nome + ').' }))
}

// An independently named technical gap must not be rejected just because the quantity is zero.
const lessicoRifiutoZero = new Set([
  'quantita strutturata contabile originale indicata riportata pari nulla nullo zero corpo voce riga computo documento',
  'e a di il lo la l un una al del nel nella per con in quanto essendo poiche perche quindi pertanto dato che',
  'non nessun nessuna posso si puo riesco possibile impossibile impedisce consente permette rende',
  'stimare stima stimabile formulare calcolare determinare proporre prezzo costo unitario totale affidabile attendibile astensione astengo astiene',
].join(' ').split(' '))

export function verificaAstensione(r: RigaTecnica, s: Spiegazione): RilievoSemantico[] {
  const rilievi = contraddizioniDocumento(r, s)
  const frase = piano(s.motivazione)
  // Reject a zero-only justification. A separately stated technical gap remains admissible.
  const citaZero = /\bquantita\b.{0,45}?\b(?:zero|nulla|0)\b|\b(?:zero|0)\s+(?:unita|pezzi|corpi)\b/.test(frase)
  const parole = frase.match(/[a-z]+/g) || []
  const soloZero = parole.every(p => lessicoRifiutoZero.has(p))
  if (r.quantita === 0 && citaZero && soloZero) rilievi.push({
    codice: 'astensione_solo_quantita_zero', motivo: 'La quantità zero giustifica il totale zero. Per astenersi dal prezzo unitario occorre una carenza tecnica distinta.',
  })
  return rilievi
}

export function verificaSemanticaProposta(r: RigaTecnica, s: StimaTecnica, catalogo: readonly PerimetroLavorazione[]): RilievoSemantico[] {
  const { incluse, escluse } = perimetroDichiarato(s)
  const conflitti = [...escluse].filter(([x]) => x.length > 2 && [...incluse].some(i => i === x || i.startsWith(x + ' ')))
  // Exact component name only; general mentions elsewhere in the catalogue are insufficient.
  const doppie = catalogo.filter(altra => altra.id !== r.id && altra.quantita > 0 && incluse.has(nomeComponente(altra.descrizione)))
    .map(altra => ({ codice: 'sovrapposizione_componente', soloAvviso: true as const, motivo: 'Verificare possibile doppio conteggio con la voce autonoma ' + altra.id + ': ' + altra.descrizione }))
  return [...contraddizioniDocumento(r, s), ...doppie, ...conflitti.map(([, componente]) => ({
    codice: 'contraddizione_inclusione_esclusione', motivo: 'La risposta include ed esclude la stessa componente (' + componente + ').',
  }))]
}

const cardinali: Record<string, number> = { due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 }
const conNumeri = (s: string) => piano(s).replace(/\b(due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/g, parola => String(cardinali[parola]))

export function coperturaPacchetto(r: RigaTecnica, s: StimaTecnica) {
  if (r.quantita <= 1) return 'singola'
  const output = conNumeri([s.motivazione, s.unita_economica?.descrizione,
    ...(s.componenti_economiche || []).map(c => c.descrizione)].join('. '))
  const coperture = [...output.matchAll(/\b(?:per|da|con|su|(?:pacchetto|forfait)(?: completo)? di)\s+(?:(?:le|i|tutte le|tutti i)\s+)?(\d+)\s+(unita|corpi|punti|pezzi|aperture|impianti)\b/g)]
    .filter(m => Number(m[1]) > 1)
  if (!coperture.length) return 'singola'
  const documento = conNumeri([r.descrizione, r.contesto_riga, r.contesto_tecnico?.ubicazioneDimensioni, r.contesto_tecnico?.annotazioni].join('\n'))
  const documentate = coperture.every(([, numero, elemento]) => new RegExp(
    '\\b' + r.quantita + '\\s+(?:pacchetti|impianti|gruppi|lotti)(?: distinti| separati)?[, ]+'
    + '(?:ciascuno |ognuno )?(?:compost[oi] )?(?:da|di|con)\\s+' + numero + '\\s+' + elemento + '\\b',
  ).test(documento))
  return documentate ? 'distinti_documentati' : 'copertura_ambigua'
}
