export type MenzioneOperaio = {
  testo: string
  inizio: number
  fine: number
  ora_inizio?: string
  ora_fine?: string
}

const normalizza = (testo: string): string =>
  testo.normalize('NFC').toLowerCase()
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')

const parola = /\p{L}[\p{L}\p{M}]*(?:['’ʼ\-‐‑‒–—][\p{L}\p{M}]+)*/gu
const contestoEscluso = /\b(?:non|nessuno|nessun|domani|dopodomani|forse|probabilmente|se|detto|dice|chiamato|lavorerà|lavoreranno|lavoreremo)\b/iu
const paroleNonNominali = /\b(?:abbiamo|riparato|lavorato|lavorando|lavorare|hanno|ha|sono|era|erano|oggi|ieri|dalle|alle|al|alla|allo|ai|agli|sul|sulla|nel|nella|per|con|che|poi|circa|verso|il|lo|la|i|gli|le|un|una|uno)\b/iu

/** Estrae menzioni supportate dal vocabolario, senza risolvere identità. */
export function estraiMenzioniOperai(
  racconto: string,
  operaiDisponibili: readonly string[]
): MenzioneOperaio[] {
  const vocabolario = new Set(operaiDisponibili.flatMap((nome) =>
    (nome.match(parola) || []).map(normalizza)
  ))
  const risultato: MenzioneOperaio[] = []

  const estraiGruppo = (testo: string, offset: number): MenzioneOperaio[] => {
    let gruppo = testo
    const prefisso = gruppo.match(/^\s*(?:e\s+)?(?:oggi\s+)?(?:(?:hanno|ha)\s+lavorato\s+|operai\s+presenti\s*:\s*)?/iu)
    if (prefisso) {
      gruppo = gruppo.slice(prefisso[0].length)
      offset += prefisso[0].length
    }
    gruppo = gruppo.replace(/\s+(?:ha|hanno)\s+lavorato\s*$/iu, '')
    if (!gruppo.trim() || paroleNonNominali.test(gruppo)) return []

    const menzioni: MenzioneOperaio[] = []
    const separatori = /\s+e\s+|,\s*(?:e\s+)?/giu
    let cursore = 0
    const parti: { testo: string; offset: number }[] = []
    for (const separatore of gruppo.matchAll(separatori)) {
      parti.push({ testo: gruppo.slice(cursore, separatore.index), offset: cursore })
      cursore = separatore.index + separatore[0].length
    }
    parti.push({ testo: gruppo.slice(cursore), offset: cursore })

    for (const parte of parti) {
      const nome = parte.testo.trim()
      const token = nome.match(parola) || []
      // L'intero gruppo deve essere nominale: non ritagliare solo parole note.
      if (!nome || token.length === 0 || nome.replace(parola, '').trim() !== '' ||
          !token.some((item) => vocabolario.has(normalizza(item)))) return []
      const inizio = offset + parte.offset + parte.testo.indexOf(nome)
      menzioni.push({ testo: nome, inizio, fine: inizio + nome.length })
    }
    return menzioni
  }

  // I due punti restano nella clausola: fanno parte degli orari e delle etichette.
  for (const clausola of racconto.matchAll(/[^.!?;\r\n]+/gu)) {
    const testo = clausola[0]
    if (contestoEscluso.test(testo) || /["“”«»]/u.test(testo)) continue
    const offset = clausola.index
    const intervalli = [...testo.matchAll(/\bdalle\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s+alle\s+([01]?\d|2[0-3])(?::([0-5]\d))?(?![\d:])\b/giu)]

    if (intervalli.length === 0) {
      if (/^\s*(?:oggi\s+)?(?:(?:hanno|ha)\s+lavorato\s+|operai\s+presenti\s*:)/iu.test(testo) ||
          /\s+(?:ha|hanno)\s+lavorato\s*$/iu.test(testo)) {
        risultato.push(...estraiGruppo(testo, offset))
      }
      continue
    }

    let cursore = 0
    for (const intervallo of intervalli) {
      const menzioni = estraiGruppo(testo.slice(cursore, intervallo.index), offset + cursore)
      const inizioMinuti = Number(intervallo[1]) * 60 + Number(intervallo[2] || 0)
      const fineMinuti = Number(intervallo[3]) * 60 + Number(intervallo[4] || 0)
      const orari = fineMinuti > inizioMinuti ? {
        ora_inizio: `${intervallo[1].padStart(2, '0')}:${intervallo[2] || '00'}`,
        ora_fine: `${intervallo[3].padStart(2, '0')}:${intervallo[4] || '00'}`,
      } : {}
      risultato.push(...menzioni.map((menzione) => ({ ...menzione, ...orari })))
      cursore = intervallo.index + intervallo[0].length
    }
  }
  return risultato
}
