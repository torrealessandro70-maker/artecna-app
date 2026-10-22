import { normalizePriceDescription, normalizeUnitOfMeasure } from './normalizer'

type InputTecnico = {descrizione:string;unita_misura:string;ambito:string;qualificatori:string}
const materiali = [
  ['gres porcellanato',/\bgres porcellanato\b/],['gres',/\bgres\b/],
  ['SPC',/\bspc\b/],['laminato',/\blaminat[oi]\b/],['resina',/\bresin[ae]\b/],
  ['parquet',/\bparquet\b/],['PVC',/\bpvc\b/],['marmo',/\bmarmo\b/],
] as const
function classificaBaseWeb(input:InputTecnico){
  const text=normalizePriceDescription(input.descrizione)
  const trovati=materiali.filter(([,regex])=>regex.test(text)).map(([name])=>name)
  const material=trovati.filter(name=>name!=='gres'||!trovati.includes('gres porcellanato'))
  const definizioni:[string,RegExp][]=[
    ['pavimento esistente',/\bpaviment(?:o|i|azione|azioni) esistent[ei]\b/],
    ['sovrapposizione',/\bsovrapposizion[ei]\b|\bsovrappost[oaie]\b/],
    ['collante',/\bcollant[ei]\b/],['preparazione supporto',/\bpreparazione (?:del )?supporto\b/],
    ['interno',/\bintern[oi]\b/],['esterno',/\bestern[oi]\b/],['antiscivolo',/\bantiscivolo\b/],
    ['demolizione esclusa',/\bdemolizion[ei] esclus[ae]\b/],['demolizione inclusa',/\bdemolizion[ei] inclus[ae]\b/],
    ['materiale escluso',/\bmaterial[ei] esclus[oi]\b/],['materiale incluso',/\bmaterial[ei] inclus[oi]\b/],
  ]
  const qualifiers=definizioni.filter(([,pattern])=>pattern.test(text)).map(([name])=>name)
  return {descrizione_completa:input.descrizione,categoria:/\bpaviment|\bpiastrel|\bgres|\bparquet|\bspc|\blaminat/.test(text)?'pavimentazione':'non specificato',
    materiale:material.length?material.join(' / '):'non specificato',materiali_documentati:material,
    intervento:qualifiers.includes('sovrapposizione')?(qualifiers.includes('pavimento esistente')?'posa sovrapposta su pavimento esistente':'sovrapposizione'):'non specificato',
    ambito:input.ambito,unita_misura:normalizeUnitOfMeasure(input.unita_misura),qualificatori_documentati:[...material,...qualifiers],
    qualificatori_utente:input.qualificatori}
}

// Metadati descrittivi: non estendono le regole di esclusione/prezzo Web.
const materialiCartongesso:readonly [string,RegExp][] = [
  ['lana_vetro', /\blana (?:di )?vetro\b/],
  ['materassino_isolante', /\bmaterassin[oi] isolant[ei]\b/],
  ['cartongesso', /\bcartongesso\b|\br\/bc\b|\bba\s*(?:13|12[., ]5)\b/],
  ['lastra_cartongesso', /\blast(?:ra|re)\s+(?:di\s+|in\s+)?cartongesso\b|\br\/bc\b|\bba\s*(?:13|12[., ]5)\b/],
  ['struttura_metallica_zincata', /\b(?:struttur[ae]|intelaiatur[ae])\s+(?:metallic(?:a|he)\s+)?zincat[ae]\b/],
  ['profilo_metallico', /\bprofil[oi]\s+(?:metallic[oi]|guida)\b/],
  ['guida_metallica', /\bguid[ae]\s+(?:metallic[ae]|zincat[ae])\b|\bguide e montanti\b/],
  ['montante_metallico', /\bmontant[ei]\s+(?:metallic[oi]|zincat[oi])\b|\bguide e montanti\b/],
  ['rete_fibra_vetro', /\brete\s+(?:(?:armata|di|in)\s+)*fibra (?:di )?vetro\b|\b(?:nastro in fibra di vetro e rete|rete.{0,60}fibra di vetro)\b/],
  ['rasante', /\brasant[ei]\b/],
  ['stucco', /\bstucco\b/],
  ['stucco_cartongesso', /\bstucc[oa]\s+(?:per |da |di )?cartongesso\b/],
  ['canalina_led', /\bcanalin[ae]\s+(?:per\s+)?(?:strip\s+)?led\b/],
  ['strip_led', /\bstrip\s+led\b/],
]
// Questi segmenti descrivono destinazione, esclusioni o origine: non l'opera eseguita.
function testoPrincipale(descrizione:string){
  const testo=normalizePriceDescription(descrizione)
  const contesto=/\b(?:pront[oaie]\s+(?:per|a|all|alla|alle|al)\b|destinat[oaie]\s+(?:a|ai|al|alla|alle|per)\b|provenient[ei]\s+da\b|derivant[ei]\s+da\b|material[ei] di risulta\s+da\b|esclus[oaie]\b|predispost[oaie]\s+per\b)/.exec(testo)
  return {principale:contesto?testo.slice(0,contesto.index):testo,completo:testo}
}
// L'oggetto diretto precede supporti, destinazioni e materiali citati più avanti.
function oggettoPrincipale(text:string){
  const oggetti:readonly [string,RegExp][]=[
    ['struttura_metallica',/\b(?:struttur[ae]|intelaiatur[ae]) (?:metallic(?:a|he)|zincat[ae])\b|\bguide e montanti\b|\bprofil[oi] (?:metallic[oi]|guida)\b|\b(?:guid[ae]|montant[ei]) metallic[aoie]\b/],
    ['cartongesso',/\b(?:last(?:ra|re) (?:di |in )?cartongesso|cartongesso|doppio rivestimento|r\/bc|ba\s*(?:13|12[., ]5))\b/],
    ['finitura_superfici',/\b(?:stuccatura|rasatura|stucco|rasant[ei])\b/],
    ['isolamento',/\b(?:materassin[oi] isolant[ei]|lana (?:di )?vetro|isolamento)\b/],
    ['illuminazione_indiretta',/\b(?:allogg(?:io|i)|canalin[ae]|strip led|gola luminosa|led)\b/],
  ]
  return oggetti.map(([categoria,re])=>({categoria,index:re.exec(text)?.index??Infinity}))
    .filter(x=>Number.isFinite(x.index)).sort((a,b)=>a.index-b.index)[0]?.categoria
}
export function classificaLavorazioneWeb(input:InputTecnico){
  const base=classificaBaseWeb(input),segmenti=testoPrincipale(input.descrizione),text=segmenti.principale
  const materialiContestuali=materialiCartongesso.filter(([,re])=>re.test(segmenti.completo)&&!re.test(text)).map(([name])=>name)
  const primaAzione=/\b(fornitura|posa|montaggio|applicazione|stuccatura|rasatura|predisposizione|rivestimento|formazione|smaltimento|trasporto|carico|conferimento)\b/.exec(text)?.[1]
  const rifiuti=!!primaAzione&&['smaltimento','trasporto','carico','conferimento'].includes(primaAzione)&&/\bsmaltimento|\bconferimento|\brisulta|\brifiut[oi]|\bscart[oi]|\bdiscaric/.test(segmenti.completo)
  if(rifiuti){
    const azioni=['smaltimento','trasporto','carico','conferimento'].filter(azione=>new RegExp('\\b'+azione+'\\b').test(text))
    return {...base,categoria:'smaltimento_rifiuti',materiale:'non specificato',materiali_documentati:[] as string[],
      materiali_contestuali:[...new Set([...materialiContestuali,...materialiCartongesso.filter(([,re])=>re.test(segmenti.completo)).map(([name])=>name)])],
      intervento:azioni.join(' / '),qualificatori_documentati:[] as string[]}
  }
  // Le misure si leggono dal testo originale: il normalizzatore rimuove ² e virgole.
  const raw=input.descrizione.toLowerCase().replace(/\s+/g,' ')
  const material=materialiCartongesso.filter(([,re])=>re.test(text)).map(([name])=>name)
  const struttura=material.some(m=>['guida_metallica','montante_metallico','profilo_metallico'].includes(m))||/\bstruttur[ae] (?:metallic[ae] |zincat[ae])|\bguide e montanti\b|\bprofil[oi] metallic[oi]\b/.test(text)
  const led=/\bled\b|\bgola luminosa\b/.test(text)
  const finitura=/\bstucco\b|\bstuccatura\b|\brasatura\b|\brasant[ei]\b/.test(text)
  const cartongesso=material.includes('cartongesso')||/\bvelett[ae]\b/.test(text)
  const categoriaOggetto=oggettoPrincipale(text)
  const dominio=struttura||led||finitura||cartongesso||categoriaOggetto==='isolamento'
  const basePrincipale=classificaBaseWeb({...input,descrizione:text})
  if(basePrincipale.categoria==='pavimentazione')return base
  if(!dominio)return segmenti.principale===segmenti.completo?base:{...basePrincipale,descrizione_completa:input.descrizione,materiali_contestuali:materialiContestuali}
  const interventi:[string,RegExp][]=[
    ['fornitura_e_applicazione',/\bfornitura e applicazione\b/],
    ['fornitura_e_posa',/\bfornitura e posa\b/],['fornitura',/\bfornitura\b/],
    ['applicazione',/\bapplicazione\b/],['smaltimento',/\bsmaltimento\b/],
    ['trasporto',/\btrasporto\b/],['carico',/\bcarico\b/],['conferimento',/\bconferimento\b/],
    ['posa',/\bposa\b/],['montaggio',/\bmontaggio\b/],
    ['doppio_rivestimento',/\bdoppio rivestimento\b|\bdoppia lastra\b/],
    ['rivestimento',/\brivestimento\b/],['stuccatura',/\bstuccatura\b/],
    ['rasatura',/\brasatura\b/],['predisposizione',/\bpredisposizione\b/],
    ['formazione_gola_luminosa',/\bformazione (?:di |della |di una )?gola luminosa\b/],
  ]
  const azioni=interventi.filter(([,re])=>re.test(text))
    .sort((a,b)=>(a[1].exec(text)?.index??0)-(b[1].exec(text)?.index??0)).map(([name])=>name)
    .filter(name=>!(name==='fornitura'||name==='posa')||! /\bfornitura e posa\b/.test(text))
    .filter(name=>!(name==='fornitura'||name==='applicazione')||! /\bfornitura e applicazione\b/.test(text))
    .filter(name=>name!=='rivestimento'||! /\bdoppio rivestimento\b/.test(text))
  const qualificatori:[string,RegExp][]=[
    ['stuccatura armata',/\bstuccatura armata\b/],
    ['doppia lastra',/\bdoppia lastra\b|\bdoppio rivestimento in lastre\b/],
    ['spessore 13 mm',/\bspessore\s+13\s*mm\b/],
    ['spessore 10 mm',/\bspessore\s+(?:13\s*mm\s+e\s+)?10\s*mm\b/],
    ['rete 160 g/m²',/\brete\s+(?:da\s+)?160\s*g\s*\/\s*m(?:²|2)(?![\w²³])/u],
    ['fibra di vetro',/\bfibra (?:di )?vetro\b/],
    ['pronto per tinteggiatura',/\bpront[oaie]\s+(?:per |alla |a )tinteggiatura\b/],
    ['pronto per collegamento elettrico',/\bpront[oaie]\s+(?:per |al |a )collegamento elettrico\b/],
    ['gola luminosa',/\bgola luminosa\b/],['veletta',/\bvelett[ae]\b/],
  ]
  const qualifiers=qualificatori.filter(([,re])=>re.test(raw)).map(([name])=>name)
  const categoria=categoriaOggetto??'cartongesso'
  const stripIndex=/\bstrip led\b/.exec(text)?.index??Infinity
  const supportoIndex=/\b(?:allogg(?:io|i)|canalin[ae]|predisposizione|per inserimento)\b/.exec(text)?.index??Infinity
  const supportoLed=categoria==='illuminazione_indiretta'&&supportoIndex<stripIndex
  const gruppi:Record<string,readonly string[]>={
    struttura_metallica:['struttura_metallica_zincata','guida_metallica','montante_metallico','profilo_metallico'],
    cartongesso:['cartongesso','lastra_cartongesso'],
    finitura_superfici:['rete_fibra_vetro','rasante','stucco','stucco_cartongesso'],
    isolamento:['lana_vetro','materassino_isolante'],
    illuminazione_indiretta:['canalina_led','struttura_metallica_zincata','guida_metallica','montante_metallico','profilo_metallico',...(supportoLed?[]:['strip_led'])],
  }
  const materialiDocumentati=material.filter(m=>(gruppi[categoria]??[]).includes(m))
  const contestuali=[...new Set([...materialiContestuali,...material.filter(m=>!materialiDocumentati.includes(m)),
    ...(categoria!=='struttura_metallica'&&/\b(?:struttur[ae]|intelaiatur[ae]) metallic(?:a|he)\b/.test(text)&&!materialiDocumentati.includes('struttura_metallica_zincata')?['struttura_metallica']:[]),
    ...(categoria!=='illuminazione_indiretta'&&/\bled\b/.test(text)?['led']:[])])]
  const spessori=Array.from(raw.matchAll(/\bspessore\s+(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/g),m=>'spessore '+m[1]+' '+m[2])
  const isolamentoTermico=/\bisolamento termico\b|\bisolamento termoacustico\b/.test(text)
  const isolamentoAcustico=/\bisolamento (?:termico (?:e |ed |\/ )?)?acustico\b|\bisolamento termoacustico\b/.test(text)
  const qualificatoriContestuali=categoria==='illuminazione_indiretta'?[]:qualifiers.filter(q=>q==='veletta'||q==='gola luminosa')
  const principale=materialiDocumentati.includes('lana_vetro')?['lana_vetro']:materialiDocumentati
  return {...base,categoria,
    materiale:principale.length?principale.join(' / '):'non specificato',
    materiali_documentati:materialiDocumentati,materiali_contestuali:contestuali,qualificatori_contestuali:qualificatoriContestuali,
    intervento:azioni.length?azioni.join(' / '):base.intervento,
    qualificatori_documentati:[...new Set([...base.qualificatori_documentati,...materialiDocumentati,...qualifiers,...spessori,
      ...(isolamentoTermico?['isolamento termico']:[]),...(isolamentoAcustico?['isolamento acustico']:[])])]}
}

export function criteriRicercaWeb(input:InputTecnico,area:string){
  const tecnica=classificaLavorazioneWeb(input)
  return {query:[input.descrizione,input.qualificatori,input.ambito,`prezzo euro/${tecnica.unita_misura}`,area].filter(Boolean).join(' — '),
    area,tecnica,fonti_preferite:['listini/prezzari pubblicati','imprese/fornitori con prezzo e ambito espliciti','portali con prezzo collegato alla lavorazione specifica']}
}
export function esclusioneTecnicaWeb(input:InputTecnico,description:string,evidence:string):string|null{
  const req=classificaBaseWeb(input),text=normalizePriceDescription(description+' '+evidence)
  const present=materiali.filter(([,pattern])=>pattern.test(text)).map(([name])=>name)
  const isGres=req.materiali_documentati.some(m=>m==='gres'||m==='gres porcellanato')
  if(isGres&&present.some(m=>['SPC','laminato','resina','parquet','PVC'].includes(m)))return 'TECNOLOGIA_INCOMPATIBILE'
  if(req.materiali_documentati.length&&present.some(m=>!req.materiali_documentati.includes(m)&&!(m==='gres'&&req.materiali_documentati.includes('gres porcellanato'))))return 'MATERIALE_INCOMPATIBILE'
  if(req.materiali_documentati.length&&!req.materiali_documentati.some(m=>normalizePriceDescription(m).split(' ').every(t=>text.includes(t))))return 'MATERIALE_NON_DOCUMENTATO'
  if(req.intervento!=='non specificato'&&!/\bsovrapposizion[ei]\b|\bsovrappost[oaie]\b|\bsul (?:vecchio|precedente|esistente) pavimento\b|\bsu pavimento esistente\b/.test(text))return 'SOVRAPPOSIZIONE_NON_DOCUMENTATA'
  if(input.ambito==='fornitura e posa'&&/\bsol[oa] (?:posa|manodopera|materiale)\b|\bmaterial[ei] esclus[oi]\b|\bsenza fornitura\b/.test(text))return 'AMBITO_INCOMPATIBILE'
  return null
}
