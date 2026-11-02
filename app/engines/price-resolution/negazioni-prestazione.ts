import type { StimaTecnica } from './validazione-tecnica-stime'

// Polarità locale di un oggetto del prezzo. Non si elimina il resto della
// frase: può contenere un secondo addebito, anche per lo stesso oggetto.
const concetti = /\b(?:fornitura(?:\s+e\s+posa)?|(?:rifacimento|ricostruzione)\s+(?:complet[oa]|integrale|totale)|ponteggio?)\b/gi
const negazionePrima = /\b(?:non(?:\s+(?:[èe]|sono|viene|vengono))?(?:\s+(?:previst[oaie]|inclus[oaie]|compres[oaie]|comprende|include|prevede))?|nessun(?:a| costo di)?|senza|esclud[eo]|esclus[oaie])\s+(?:(?:il|la|i|un|una)\s+)?$/i
const prezzoNonUsato = /\b(?:nessun prezzo|non (?:sono |vengono )?(?:utilizzati|usati|impiegati|trasferiti) prezzi|esclude il ricorso (?:a|ai) prezzi)(?: complet[oi])? (?:di|per) $/i
const negazioneDopo = /^\s+(?:(?:metallic[oi]|generale|(?:del|della|di) [\p{L}-]+)\s+)?(?:(?:(?:[èe]|sono|viene|vengono)\s+)?esclus[oaie]|non\s+(?:(?:[èe]|sono|viene|vengono)\s+)?(?:compres[oaie]|inclus[oaie]|previst[oaie]))\b/iu

export function senzaConcettiNegati(testo: string): string {
  return testo.replace(concetti, (concetto: string, indice: number) => {
    const prima = testo.slice(0, indice), dopo = testo.slice(indice + concetto.length)
    const prefisso = negazionePrima.exec(prima) || prezzoNonUsato.exec(prima)
    const suffisso = negazioneDopo.exec(dopo)
    // «Non esclude» e «nessun ponteggio è escluso» non provano l'esclusione.
    if (prefisso && (suffisso || /\bnon (?:[èe] |viene )?$/i.test(prima.slice(0, prefisso.index)))) return concetto
    const seguito = suffisso && dopo.slice(suffisso[0].length).trimStart()
    // «Escluso dal solo trasporto» non esclude il bene dal prezzo corrente.
    const esclusoDopo = suffisso && (!seguito || /^[.,;!\n]|^(?:dal prezzo|dalla (?:presente )?stima|perché (?:già )?contabilizzat[oi])\b/i.test(seguito))
    return prefisso || esclusoDopo ? ' ' : concetto
  })
}

// È un'esclusione dell'intero ponteggio. «Solo smontaggio del ponteggio»
// o l'esclusione di un altro bene usato sul ponteggio non sono equivalenti.
function nomeInteroPonteggio(nome: string): boolean {
  return /^(?:(?:il|i) )?ponteggio?(?: metallic[oi]| general[ei])?(?: di (?:facciata|accesso(?: e servizio)?|servizio))?$/i.test(nome.trim())
}

export function addebitaPonteggio(s: StimaTecnica): boolean {
  return (s.componenti_economiche || []).some(c => {
    if (c.importo_unitario <= 0) return false
    // Una cifra intestata al ponteggio o al suo nolo è ambigua anche se
    // qualificata come «esclusa». Diverso il costo di una dotazione senza ponteggio.
    if (/^(?:il )?(?:(?:nolo|noleggio|approntamento|montaggio|smontaggio) (?:del |di |dei )?)?ponteggio?\b/i.test(c.descrizione.trim())) return true
    return [c.descrizione, c.origine_costo?.descrizione || ''].some(t => /\bponteggio?\b/i.test(senzaConcettiNegati(t)))
  })
}

export function rinviiPonteggio(stima: StimaTecnica): Set<string> {
  const voci = new Set((stima.esclusioni_componenti || [])
    .filter(e => nomeInteroPonteggio(e.componente) && e.motivazione.trim().length >= 10)
    .map(e => e.voce_copertura_id))
  // In assenza del campo strutturato serve una dichiarazione completa:
  // oggetto escluso, attribuzione separata e numero esatto della voce.
  const rinvio = /^\s*(?:il )?ponteggio(?: metallico| generale)? (?:[èe] )?escluso(?: dalla (?:presente )?stima)?(?:,\s*|\s+(?:e |perché |in quanto )?)(?:già )?(?:contabilizzato|valorizzato|quotato|previsto)(?: separatamente)? (?:alla|nella|in) (?:voce|riga)[ -]+(\d+)\s*$/i
  for (const testo of [stima.motivazione, stima.unita_economica?.descrizione || '', ...(stima.avvisi || [])]) {
    for (const frase of testo.split(/[.;!\n]/)) {
      const id = rinvio.exec(frase)?.[1]
      if (id) voci.add('riga-' + id)
    }
  }
  return voci
}
