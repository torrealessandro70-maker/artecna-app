import { normalizePriceDescription, tokenizePriceDescription } from './normalizer'

// Il perimetro commerciale è distinto dall'oggetto/materiale confrontato da V3.3.
// Sono ammesse espressioni esplicite, non la presenza isolata di "materiale".
export function analizzaAmbitoPrezzoSic24(descrizione: string) {
  // Protegge solo i separatori tra cifre dalla pulizia della punteggiatura.
  let separatore = 'decimalenumericosic'
  while (descrizione.toLowerCase().includes(separatore)) separatore += 'x'
  const testo = normalizePriceDescription(
    descrizione.replace(/(?<=\d)[.,](?=\d)/g, separatore),
  ).replaceAll(separatore, '.')
  const esclusione = /\b(?:fornitura(?:\s+(?:del|dello|della|di)\s+[a-z]+)?\s+esclus[ae]|esclus[ae]\s+(?:la\s+)?fornitura(?:\s+(?:del\s+)?material[ei])?|senza\s+fornitura)\b/g
  const committenza = /\b(?:material[ei]\s+)?fornit[oaie]\s+dalla\s+committenza\b/g
  const materialeFornito = /\bcon\s+material[ei]\s+fornit[oi]\b/g
  const sola = /\b(?:sol[oa]|soltanto|esclusivamente)\s+(?:posa|manodopera)\b/g
  const segnali = [esclusione, committenza, materialeFornito, sola]
  const solaPosa = segnali.some(re => new RegExp(re.source).test(testo))
  const senzaEsclusioni = testo.replace(esclusione, ' ').replace(committenza, ' ').replace(materialeFornito, ' ')
  const fornituraPositiva = /\bfornitura\b/.test(senzaEsclusioni)
  if (solaPosa && (fornituraPositiva || /\bnon\s+(?:e\s+)?(?:esclusa|escluso|fornito|fornita)\b/.test(testo))) {
    return { tipo: 'ambiguo' as const, descrizioneMatching: descrizione }
  }
  if (!solaPosa) return { tipo: /\bfornitura\b/.test(testo) && /\b(?:posa|collocazione)\b/.test(testo)
    ? 'completa' as const : 'non_specificata' as const, descrizioneMatching: descrizione }
  const pulita = senzaEsclusioni.replace(sola, 'posa').replace(/\bposa\s+per\b/g, 'posa di').replace(/\s+/g, ' ').trim()
  return { tipo: 'sola_posa' as const, descrizioneMatching: /\bposa\b/.test(pulita) ? pulita : `Posa di ${pulita}` }
}

// Vocabolario edilizio chiuso, esclusivamente per il confronto: non riscrive le voci.
const oggetti: [string, RegExp][] = [
  ['battiscopa', /\b(?:zoccolin[oi]|zoccolett[oi]|battiscopa)\b/],
  ['pavimento', /\b(?:pavimentazion[ei]|paviment[oi])\b/],
  ['tappeto_tecnico', /\btappet[oi] tecnic[oi]\b/],
  ['supporto', /\bsupport[oi]\b/],
  ['pannello', /\bpannell[oi]\b/],
  ['consolidamento', /\bconsolidamento\b/],
]

function oggettoPrincipale(testo: string): string | undefined {
  const riconosciInizio = (frase: string) => {
    const nome = frase.replace(/^(?:(?:di|del|della|dello|dei|degli|delle)\s+)?(?:(?:un|una|uno|il|la|lo|i|gli|le)\s+)?/, '')
    return oggetti.find(([,re]) => nome.search(re) === 0)?.[0]
  }
  const azione = /\b(?:fornitura(?:\s+e\s+(?:posa|collocazione)(?:\s+in\s+opera)?)?|posa(?:\s+in\s+opera)?|rimozione|dismissione|smontaggio|realizzazione|applicazione|preparazione)\b/.exec(testo)
  if (!azione) return riconosciInizio(testo)
  const complemento = testo.slice(azione.index + azione[0].length).trim()
  const diretto = riconosciInizio(complemento)
  if (diretto) return diretto
  // Anche gli oggetti non nel dizionario impediscono di cercare nomi nel contesto.
  if (!/^(?:in\s+incasso\b|trasporto\b|e\b|di\b|del\b|della\b|dello\b)/.test(complemento)) return undefined
  // Es.: "posa in opera, in incasso nel pavimento ..., di tappeto tecnico".
  // Fermarsi al primo complemento oggetto esplicito, senza saltarne uno ignoto.
  const esplicito = /\b(?:di|del|della|dello|dei|degli|delle)\s+/.exec(complemento)
  return esplicito ? riconosciInizio(complemento.slice(esplicito.index)) : undefined
}
const materiali: [string, RegExp][] = [
  ['marmo', /\bmarmo\b/], ['gres', /\bgres\b/], ['granito', /\bgranito\b/],
  ['pvc', /\b(?:pvc|vinilic[oaie])\b/], ['legno', /\b(?:legno|parquet)\b/],
  ['ceramica', /\bceramic[oaie]\b/], ['spc', /\bspc\b/],
]
const tecnologie: [string, RegExp][] = [
  ['bitume', /\b(?:bituminos[oaie]|bitume|asfalto)\b/],
  ['spc', /\bspc\b/], ['laminato', /\blaminat[oi]\b/],
  ['resina', /\b(?:resin[ae]|epossidic[oaie])\b/], ['frcm', /\bfrcm\b/],
]
const aliasSemplice = /^(?:zoccolin[oi]|zoccolett[oi]|battiscopa)$/
const terminiCanonici = new Set('zoccolino zoccolini zoccoletto zoccoletti battiscopa pavimento pavimenti pavimentazione pavimentazioni sovrapposta sovrapposto sovrapposte sovrapposti sovrapposizione esistente esistenti preesistente preesistenti sottofondo rimozione dismissione smontaggio fornitura posa collocazione marmo gres granito pvc vinilico vinilica vinilici viniliche legno parquet bituminoso bituminosa bituminosi bituminose bitume asfalto spc laminato laminati resina resine epossidico epossidica epossidici epossidiche frcm interno interna interni interne esterno esterna esterni esterne antiscivolo liscio liscia lisci lisce naturale naturali artificiale artificiali'.split(' '))

function analizza(value: string) {
  const testo = normalizePriceDescription(value)
  // Le clausole accessorie non cambiano l'oggetto o l'azione principale.
  const principale = testo.split(/\b(?:compres[oaie]|inclus[oaie]|esclus[oaie])\b/)[0]
  const oggetto = oggettoPrincipale(principale)
  const esistente = /\b(?:sovrappost[oaie]|sovrapposizione)\b|\bsu (?:paviment[oi]|sottofondo) (?:pre)?esistent[ei]\b/.test(principale)
  let azione: string | undefined
  if (/\b(?:consolidamento|consolidare|rinforzo|strutturale)\b/.test(principale)) azione = 'consolidamento'
  else if (/\b(?:rimozione|dismissione|smontaggio)\b/.test(principale)) azione = 'rimozione'
  else if (/\bfornitura\b/.test(principale) && /\b(?:posa|collocazione)\b/.test(principale)) azione = 'fornitura_posa'
  else if (/\bfornitura\b/.test(principale)) azione = 'fornitura'
  else if (/\b(?:posa|collocazione)\b/.test(principale) || esistente) azione = 'posa'
  // Il materiale del supporto/della destinazione non è materiale dell'oggetto.
  const nucleo = principale.split(/\b(?:su|sul|sulla|nel|nello|per|mediante|in corrispondenza|da fissare|da incassare)\b/)[0]
  const materiale = materiali.filter(([,re]) => re.test(nucleo)).map(([nome]) => nome)
  const tecnologia = tecnologie.filter(([,re]) => re.test(nucleo)).map(([nome]) => nome)
  const ambiente = /\b(?:stradale|stradali)\b/.test(principale) ? 'stradale'
    : /\b(?:esterno|esterna|esterni|esterne)\b/.test(principale) ? 'esterno'
    : /\b(?:interno|interna|interni|interne)\b/.test(principale) ? 'interno' : undefined
  const superficie = /\bantiscivolo\b/.test(principale) ? 'antiscivolo'
    : /\b(?:liscio|liscia|lisci|lisce)\b/.test(principale) ? 'liscia' : undefined
  const natura = /\bnatural[ei]\b/.test(principale) ? 'naturale'
    : /\bartificial[ei]\b/.test(principale) ? 'artificiale' : undefined
  return { testo, oggetto, esistente, azione, materiale, tecnologia, ambiente, superficie, natura }
}

export function confrontaDescrizioniEdilizie(queryText: string, candidateText: string, originalQuery: readonly string[]) {
  const q = analizza(queryText), c = analizza(candidateText)
  const escluso = { compatibile: false, score: 0 }
  if (q.oggetto && c.oggetto && q.oggetto !== c.oggetto) return escluso
  if (q.azione && c.azione && q.azione !== c.azione &&
    !(q.azione === 'posa' && c.azione === 'fornitura_posa')) return escluso
  if (q.esistente && !c.esistente) return escluso
  if (q.esistente && (c.ambiente === 'stradale' || c.tecnologia.includes('bitume'))) return escluso
  if (q.materiale.length && c.materiale.length && !q.materiale.every(m => c.materiale.includes(m))) return escluso
  if (q.tecnologia.length && c.tecnologia.length && !q.tecnologia.every(t => c.tecnologia.includes(t))) return escluso
  if (q.materiale.length && c.tecnologia.length && !c.materiale.length) return escluso
  if (q.tecnologia.length && !c.tecnologia.length && c.materiale.length) return escluso
  for (const campo of ['ambiente', 'superficie', 'natura'] as const) {
    if (q[campo] && c[campo] && q[campo] !== c[campo]) return escluso
  }
  if (!q.oggetto || q.oggetto !== c.oggetto) return { compatibile: true, score: 0 }
  // Non inferire una rimozione/fornitura quando il candidato non la documenta.
  if (q.azione && !c.azione) return escluso
  if (aliasSemplice.test(q.testo) && aliasSemplice.test(c.testo)) return { compatibile: true, score: 1 }
  const concetti = (a: ReturnType<typeof analizza>, azione: string | undefined) => {
    // Posa/fornitura-posa non specificata nella richiesta è informazione accessoria.
    // Rimozione e altre azioni essenziali restano nel confronto e nelle guardie.
    const azioneEssenziale = azione && (q.azione || !['posa', 'fornitura_posa'].includes(azione))
    const configurazioneEssenziale = a.oggetto === 'pavimento' && a.esistente
    return {
      principali: [
        `oggetto:${a.oggetto}`, ...(azioneEssenziale ? [`azione:${azione}`] : []),
        ...(configurazioneEssenziale ? ['configurazione:posa_esistente'] : []),
        ...a.materiale.map(m => `materiale:${m}`), ...a.tecnologia.map(t => `tecnologia:${t}`),
        ...(['superficie', 'natura'] as const).flatMap(k => a[k] ? [`${k}:${a[k]}`] : []),
      ],
      contestuali: [
        ...(azione && !azioneEssenziale ? [`azione:${azione}`] : []),
        ...(a.esistente && !configurazioneEssenziale ? ['supporto:esistente'] : []),
        ...(a.ambiente ? [`ambiente:${a.ambiente}`] : []),
      ],
    }
  }
  // Una richiesta di posa senza fornitura specificata è compatibile con entrambe.
  const azioneC = q.azione === 'posa' && c.azione === 'fornitura_posa' ? 'posa' : c.azione
  // I contestuali sono già verificati dalle guardie; non diluiscono la copertura.
  const query = concetti(q,q.azione).principali, candidate = concetti(c,azioneC).principali
  const candidateTokens = tokenizePriceDescription(candidateText)
  // I qualificatori della richiesta non presenti nel dizionario restano vincoli letterali.
  for (const token of originalQuery.filter(t => !terminiCanonici.has(t))) {
    query.push(`token:${token}`)
    if (candidateTokens.includes(token)) candidate.push(`token:${token}`)
  }
  const common = query.filter(t => candidate.includes(t)).length
  const score = common >= 2 && common/query.length >= 0.8 && common/candidate.length >= 0.6
    ? Math.min(common/query.length,common/candidate.length) : 0
  return { compatibile: true, score }
}

// Guardia per l'auto-selezione delle tariffe SIC24, non per lo storico già validato.
export function specializzazioniTecnicheNonRichieste(queryText: string, candidateText: string): string[] {
  const q = analizza(queryText), c = analizza(candidateText)
  const motivi: string[] = []
  if (c.materiale.some(m => !q.materiale.includes(m))) motivi.push('Materiale non specificato nella richiesta')
  if (c.tecnologia.some(t => !q.tecnologia.includes(t))) motivi.push('Tecnologia non specificata nella richiesta')
  const specifiche = (value: string) => {
    const testo = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/\b(?:compres[oaie]|inclus[oaie]|esclus[oaie])\b/)[0]
      .split(/\b(?:su|sul|sulla|nel|nello|per|mediante|in corrispondenza|da fissare|da incassare)\b/)[0]
      .split(/\b(?:con|in opera con)\s+(?:collant[ei]|malta|stuccatura)\b/)[0]
    const mm = (numero: string, unita?: string) => Number(numero.replace(',', '.')) * (unita === 'm' ? 1000 : unita === 'cm' ? 10 : 1)
    const formati = [...testo.matchAll(/\b(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m)?\b/g)]
      .map(m => `${[m[1],m[2],m[3]].filter(Boolean).map(n => mm(n,m[4])).join('x')}:${m[4] ? 'mm' : 'unita_non_indicata'}`)
    const spessori = [...testo.matchAll(/\b(?:spessore|sp\.)\s*(?:di\s*)?(\d+(?:[.,]\d+)?)(?:\s*(?:o|÷|-)\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m)\b/g)]
      .flatMap(m => [m[1],m[2]].filter(Boolean).map(n => String(mm(n,m[3]))))
    const classi = [...testo.matchAll(/\b(?:classe\s+(?:di\s+)?([a-z]+\s*\d+(?:\/\d+)?|\d+)|((?:rei|ei|r)\s*\d+))\b/g)]
      .map(m => (m[1] || m[2]).replace(/\s+/g,''))
    const tipologie = ['porcellanato','rettificato','antiscivolo','mosaico','autobloccante','sopraelevata','galleggiante']
      .filter(t => new RegExp(`\\b${t}\\b`).test(testo))
    return { formati, spessori, classi, tipologie }
  }
  const qs = specifiche(queryText), cs = specifiche(candidateText)
  // Profilo ordinario di battiscopa in materiale dichiarato: h/spessore sono varianti.
  // Restano soggette al pareggio sui prezzi; non si inventa una variante preferita.
  const profiloBattiscopa = q.oggetto === 'battiscopa' && q.materiale.length > 0 && c.oggetto === 'battiscopa'
  for (const campo of ['formati','spessori','classi','tipologie'] as const) {
    if (profiloBattiscopa && campo === 'spessori' && !qs[campo].length) continue
    if (cs[campo].some(v => !qs[campo].includes(v))) motivi.push(`${campo}: caratteristica non specificata nella richiesta`)
  }
  return motivi
}
