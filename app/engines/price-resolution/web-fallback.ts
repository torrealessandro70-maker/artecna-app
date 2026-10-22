import { normalizeUnitOfMeasure, normalizePriceDescription } from './normalizer'
import { esclusioneTecnicaWeb, classificaLavorazioneWeb } from './tecnica-web'
import {associaFonteUrl,canonicalizzaUrl,type AuditFonteUrl} from './url-fonti'

export const AREE_WEB = ['Catania', 'Sicilia', 'Sud Italia', 'Italia nazionale'] as const
export type AreaWeb = typeof AREE_WEB[number]
export type AmbitoPrezzo = 'materiale' | 'posa' | 'fornitura e posa'
export type RichiestaPrezzoWeb = { descrizione: string; unita_misura: string; ambito: AmbitoPrezzo; area: 'Catania'; qualificatori: string }
export type ErroreLetturaFonte = 'DNS_NON_VALIDO'|'TIMEOUT'|'HTTP_NON_ACCESSIBILE'|'CONTENUTO_NON_LEGGIBILE'|'FONTE_NON_ACCESSIBILE'|'URL_NON_AMMESSA'
export type FonteWeb = { url: string; titolo?: string; testo?: string; status_http?:number; errore_lettura?:ErroreLetturaFonte }
export type PrecisioneData = 'anno'|'mese'|'giorno'
export type LetturaFonte = {area:AreaWeb;url:string;status_http:number|null;errore_lettura:ErroreLetturaFonte|null;pagine_lette:number}
export type EsclusioneWeb = {area:AreaWeb;url:string|null;titolo:string|null;motivo:string;data_prezzo:string|null;precisione_data:PrecisioneData|null}
export type GeografiaDocumentata = { valore: string; evidenza: string; origine: 'URL' | 'TITOLO_FONTE' | 'TESTO_FONTE'; fonte: string }
export type RiferimentoWeb = {
  titolo: string; url: string; prezzo: number; unita_misura: string; ambito: AmbitoPrezzo;
  area: AreaWeb; citta: string | null; provincia: string | null; regione: string | null;
  data_prezzo: string | null; precisione_data:PrecisioneData|null; iva: 'inclusa' | 'esclusa' | 'non dichiarata';
  origine_listino: string; descrizione: string; evidenza: string;
  geografia_documentata?: GeografiaDocumentata;
  evidenza_verificata?: {fonte:string;testo:string};
  associazione_url?: AuditFonteUrl;
}
export type EsitoWeb = {
  stato: 'OK' | 'NESSUN_RIFERIMENTO_VALIDO' | 'NESSUN_RIFERIMENTO_VALIDO_CON_FONTI_INACCESSIBILI' | 'RICERCA_WEB_FALLITA' | 'RIFERIMENTI_INSUFFICIENTI' | 'RIFERIMENTI_AMBIGUI';
  origine: 'web'; prezzo_proposto: number | null; minimo: number | null; massimo: number | null;
  unita_misura: string; ambito: AmbitoPrezzo; area: AreaWeb | null; numero_riferimenti: number;
  fonti: RiferimentoWeb[]; data_ricerca: string; confidence: 'media' | 'bassa'; ricerche: number;
  percorso: {area:AreaWeb;stato:EsitoWeb['stato'];riferimenti_trovati:number;riferimenti_validi:number;pagine_lette:number;fonti_inaccessibili:number}[];
  errore?: 'OUTPUT_NON_VALIDO' | 'RICERCA_WEB_FALLITA';
  associazioni_fonti?: (AuditFonteUrl&{area:AreaWeb})[];
  pagine_lette:number;letture_fonti:LetturaFonte[];fonti_inaccessibili:LetturaFonte[];esclusioni:EsclusioneWeb[];
}
export function validaDataPrezzo(value:unknown,oggi:string):{valida:true;precisione_data:PrecisioneData|null}|{valida:false} {
  if(value===null)return {valida:true,precisione_data:null}
  if(typeof value!=='string')return {valida:false}
  const parts=value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/)
  if(!parts)return {valida:false}
  const year=Number(parts[1]),month=parts[2]===undefined?null:Number(parts[2]),day=parts[3]===undefined?null:Number(parts[3])
  if(year<1||value>oggi.slice(0,value.length)||month!==null&&(month<1||month>12))return {valida:false}
  if(day!==null&&month!==null){
    const leap=year%4===0&&(year%100!==0||year%400===0)
    const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31]
    if(day<1||day>days[month-1])return {valida:false}
  }
  return {valida:true,precisione_data:day!==null?'giorno':month!==null?'mese':'anno'}
}
const testoEvidenza=(v:string)=>v.replace(/\s+/g,' ').trim().toLowerCase()
export function evidenzaPrezzoFonte(r:RiferimentoWeb,fonte:FonteWeb):boolean {
  if(!fonte.testo||!testoEvidenza(fonte.testo).includes(testoEvidenza(r.evidenza)))return false
  const text=normalizePriceDescription(r.evidenza)
  // Una citazione verificata deve documentare anche lavorazione e ambito.
  const words=normalizePriceDescription(r.descrizione).split(' ').filter(t=>t.length>3)
  if(!words.length||words.some(t=>!text.includes(t)))return false
  const supply=/\bfornitur[ae]\b|\bmaterial[ei] inclus[oi]\b/.test(text),installation=/\bposa\b/.test(text)
  if(r.ambito==='fornitura e posa'&&(!supply||!installation||/\bsol[oa] (?:posa|manodopera|materiale)\b|\bmaterial[ei] esclus[oi]\b|\bsenza fornitura\b/.test(text)))return false
  if(r.ambito==='materiale'&&(!supply||installation))return false
  if(r.ambito==='posa'&&(!installation||supply))return false
  // Il numero e l'U.M. devono formare un prezzo unitario nella stessa citazione.
  const matches=r.evidenza.matchAll(/(\d+(?:[.,]\d+)*)\s*(?:€|euro|EUR)\s*(?:\/|per\s+)\s*(m²|m2|mq|m³|m3|mc|ml|m|cad|pz|kg|corpo)(?=\s|[.,;:]|$)/gi)
  for(const match of matches){
    const n=match[1].includes(',')?Number(match[1].replace(/\./g,'').replace(',','.')):Number(match[1])
    if(n===r.prezzo&&normalizeUnitOfMeasure(match[2])===normalizeUnitOfMeasure(r.unita_misura))return true
  }
  return false
}
export function validaRichiestaWeb(v: unknown): RichiestaPrezzoWeb {
  if (!v || typeof v !== 'object') throw new Error('richiesta_non_valida')
  const r = v as Partial<RichiestaPrezzoWeb>
  const keys = Object.keys(v)
  if (keys.some(k => !['descrizione','unita_misura','ambito','area','qualificatori'].includes(k)) ||
    typeof r.descrizione !== 'string' || !r.descrizione.trim() || r.descrizione.length > 1000 ||
    typeof r.unita_misura !== 'string' || !normalizeUnitOfMeasure(r.unita_misura) || r.unita_misura.length > 30 ||
    !['materiale','posa','fornitura e posa'].includes(r.ambito || '') || r.area !== 'Catania' ||
    typeof r.qualificatori !== 'string' || r.qualificatori.length > 500) throw new Error('richiesta_non_valida')
  return { descrizione:r.descrizione.trim(),unita_misura:normalizeUnitOfMeasure(r.unita_misura),
    ambito:r.ambito as AmbitoPrezzo,area:'Catania',qualificatori:r.qualificatori.trim() }
}
export function urlFonte(v: string): string | null {
  try { const u=new URL(v); if(u.protocol!=='https:'||u.username||u.password) return null;u.hash='';u.search='';return u.href } catch {return null}
}
export function geografiaFonte(fonte:FonteWeb,area:AreaWeb):GeografiaDocumentata|null {
  const url=urlFonte(fonte.url);if(!url)return null
  let pathname:string;try{pathname=decodeURIComponent(new URL(url).pathname)}catch{return null}
  // Mai hostname/query né campi geografici dichiarati dal modello.
  const campi:[GeografiaDocumentata['origine'],string][]=[['URL',pathname],['TITOLO_FONTE',fonte.titolo||''],['TESTO_FONTE',fonte.testo||'']]
  const patterns:Record<AreaWeb,RegExp>={
    Catania:/\bcatania\b/,
    Sicilia:/\bsicilia\b/,
    'Sud Italia':/\bsud italia\b|\bmezzogiorno\b|\b(calabria|puglia|basilicata|campania|molise|abruzzo)\b/,
    'Italia nazionale':/\bitalia\b|\bnazionale\b/,
  }
  for(const [origine,evidenza] of campi){
    const testo=normalizePriceDescription(evidenza.replace(/[-_/]/g,' '))
    const match=testo.match(patterns[area]);if(match)return {valore:match[0],evidenza:evidenza.slice(0,2000),origine,fonte:url}
  }
  return null
}
export function aggregaWeb(req: RichiestaPrezzoWeb, area: AreaWeb, valori: unknown, urls: readonly (string|FonteWeb)[], data: string): EsitoWeb {
  const sources:FonteWeb[]=urls.map(f=>typeof f==='string'?{url:f}:f);const publishers=new Set<string>(),listini=new Set<string>();
  const letture_fonti:LetturaFonte[]=sources.map(f=>({area,url:f.url,status_http:f.status_http??null,
    errore_lettura:f.errore_lettura||(!f.testo?'FONTE_NON_ACCESSIBILE':null),pagine_lette:f.testo&&!f.errore_lettura?1:0}))
  const fonti_inaccessibili=letture_fonti.filter(f=>f.pagine_lette===0)
  const pagine_lette=letture_fonti.reduce((n,f)=>n+f.pagine_lette,0)
  const refs: RiferimentoWeb[]=[],esclusioni:EsclusioneWeb[]=[]
  for(const value of Array.isArray(valori)?valori.slice(0,20):[]){
    if(!value||typeof value!=='object'){esclusioni.push({area,url:null,titolo:null,motivo:'METADATI_NON_VALIDI',data_prezzo:null,precisione_data:null});continue}
    const original=value as RiferimentoWeb
    const r={...original,data_prezzo:original.data_prezzo===undefined||original.data_prezzo==='non dichiarata'?null:original.data_prezzo,
      iva:original.iva===undefined?'non dichiarata':original.iva}
    const dataPrezzo=validaDataPrezzo(r.data_prezzo,data)
    const scarta=(motivo:string)=>esclusioni.push({area,url:typeof r.url==='string'?r.url:null,titolo:typeof r.titolo==='string'?r.titolo:null,
      motivo,data_prezzo:typeof r.data_prezzo==='string'?r.data_prezzo:null,precisione_data:dataPrezzo.valida?dataPrezzo.precisione_data:null})
    if(typeof r.url!=='string'||typeof r.titolo!=='string'||!r.titolo.trim()||r.titolo.length>300||
      typeof r.prezzo!=='number'||!Number.isFinite(r.prezzo)||r.prezzo<=0||
      typeof r.unita_misura!=='string'||!['inclusa','esclusa','non dichiarata'].includes(r.iva)||
      typeof r.origine_listino!=='string'||!r.origine_listino.trim()||r.origine_listino.length>300||
      typeof r.descrizione!=='string'||r.descrizione.length>1500||typeof r.evidenza!=='string'||!r.evidenza.trim()||r.evidenza.length>1500){scarta('METADATI_NON_VALIDI');continue}
    if(normalizeUnitOfMeasure(r.unita_misura)!==req.unita_misura){scarta('UM_INCOMPATIBILE');continue}
    if(r.ambito!==req.ambito){scarta('AMBITO_INCOMPATIBILE');continue}
    if(!dataPrezzo.valida){scarta('DATA_NON_VALIDA');continue}
    const url=canonicalizzaUrl(r.url);if(!url){scarta('FONTE_NON_ASSOCIATA');continue}
    const associazione=associaFonteUrl(r.url,sources)
    if(associazione.stato!=='ASSOCIATA'){scarta(associazione.stato);continue}
    if(associazione.fonte.errore_lettura||!associazione.fonte.testo){scarta(associazione.fonte.errore_lettura||'FONTE_NON_ACCESSIBILE');continue}
    const geografia=geografiaFonte(associazione.fonte,area)
    if(!geografia){scarta('GEOGRAFIA_NON_DOCUMENTATA');continue}
    if(!evidenzaPrezzoFonte(r,associazione.fonte)){scarta('EVIDENZA_NON_VERIFICATA');continue}
    const motivoTecnico=esclusioneTecnicaWeb(req,r.descrizione,r.evidenza)
    if(motivoTecnico){scarta(motivoTecnico);continue}
    // Il modello deve documentare lavorazione/prezzo, non proporre una stima.
    const tokens=normalizePriceDescription(req.descrizione+' '+req.qualificatori).split(' ').filter(t=>t.length>3)
    const desc=normalizePriceDescription(r.descrizione)
    if(!tokens.length||tokens.filter(t=>desc.includes(t)).length/tokens.length<0.8){scarta('PERTINENZA_NON_DOCUMENTATA');continue}
    const publisher=new URL(url).hostname.replace(/^www\./,'').split('.').slice(-2).join('.');const origine=normalizePriceDescription(r.origine_listino)
    if(publishers.has(publisher)||listini.has(origine)){scarta('FONTE_NON_INDIPENDENTE');continue}
    publishers.add(publisher);listini.add(origine)
    refs.push({...r,url,unita_misura:req.unita_misura,area,citta:typeof r.citta==='string'?r.citta:null,
      provincia:typeof r.provincia==='string'?r.provincia:null,regione:typeof r.regione==='string'?r.regione:null,geografia_documentata:geografia,
      evidenza_verificata:{fonte:url,testo:r.evidenza},associazione_url:associazione.audit,precisione_data:dataPrezzo.precisione_data})
  }
  const iva=new Set(refs.map(r=>r.iva))
  const tecnologie=new Set(refs.map(r=>classificaLavorazioneWeb({...req,descrizione:r.descrizione+' '+r.evidenza}).materiale))
  const ambiguous=iva.size>1||tecnologie.size>1
  const prices=refs.map(r=>r.prezzo).sort((a,b)=>a-b);const middle=Math.floor(prices.length/2)
  const median=prices.length?(prices.length%2?prices[middle]:(prices[middle-1]+prices[middle])/2):null
  return {stato:ambiguous?'RIFERIMENTI_AMBIGUI':refs.length>=2?'OK':refs.length?'RIFERIMENTI_INSUFFICIENTI':fonti_inaccessibili.length?'NESSUN_RIFERIMENTO_VALIDO_CON_FONTI_INACCESSIBILI':'NESSUN_RIFERIMENTO_VALIDO',
    origine:'web',prezzo_proposto:refs.length>=2&&!ambiguous&&median!==null?Math.round(median*100)/100:null,
    minimo:!ambiguous&&prices.length?prices[0]:null,massimo:!ambiguous&&prices.length?prices[prices.length-1]:null,
    unita_misura:req.unita_misura,ambito:req.ambito,area,numero_riferimenti:refs.length,fonti:refs,data_ricerca:data,
    confidence:refs.length>=2&&!ambiguous&&area!=='Italia nazionale'&&refs.every(r=>r.precisione_data==='giorno'&&r.data_prezzo!==null&&Date.parse(data)-Date.parse(r.data_prezzo)<548*86400000&&r.iva!=='non dichiarata')?'media':'bassa',ricerche:0,percorso:[],
    pagine_lette,letture_fonti,fonti_inaccessibili,esclusioni}
}
export async function cercaWebProgressivo(req: RichiestaPrezzoWeb,
  cerca:(area:AreaWeb)=>Promise<{riferimenti:unknown;urls:(string|FonteWeb)[];associazioni?:AuditFonteUrl[]}>,now=()=>new Date().toISOString()):Promise<EsitoWeb>{
  const data=now();let migliore=aggregaWeb(req,'Catania',[],[],data);let ricerche=0;const percorso:EsitoWeb['percorso']=[]
  const associazioni_fonti:(AuditFonteUrl&{area:AreaWeb})[]=[]
  const letture_fonti:LetturaFonte[]=[],fonti_inaccessibili:LetturaFonte[]=[],esclusioni:EsclusioneWeb[]=[]
  const diagnostica=()=>({letture_fonti,fonti_inaccessibili,esclusioni,pagine_lette:letture_fonti.reduce((n,f)=>n+f.pagine_lette,0)})
  for(const area of AREE_WEB){
    ricerche++
    try{const raw=await cerca(area);associazioni_fonti.push(...(raw.associazioni||[]).map(a=>({...a,area})));const esito=aggregaWeb(req,area,raw.riferimenti,raw.urls,data);esito.ricerche=ricerche
      letture_fonti.push(...esito.letture_fonti);fonti_inaccessibili.push(...esito.fonti_inaccessibili);esclusioni.push(...esito.esclusioni)
      percorso.push({area,stato:esito.stato,riferimenti_trovati:Array.isArray(raw.riferimenti)?raw.riferimenti.length:0,riferimenti_validi:esito.numero_riferimenti,pagine_lette:esito.pagine_lette,fonti_inaccessibili:esito.fonti_inaccessibili.length})
      if(esito.stato==='OK')return {...esito,percorso,associazioni_fonti,...diagnostica()}
      if(esito.numero_riferimenti>migliore.numero_riferimenti)migliore=esito
    }catch(error){percorso.push({area,stato:'RICERCA_WEB_FALLITA',riferimenti_trovati:0,riferimenti_validi:0,pagine_lette:0,fonti_inaccessibili:0});return {...migliore,stato:'RICERCA_WEB_FALLITA',errore:typeof error==='object'&&error!==null&&'message' in error&&error.message==='OUTPUT_NON_VALIDO'?'OUTPUT_NON_VALIDO':'RICERCA_WEB_FALLITA',prezzo_proposto:null,ricerche,percorso,associazioni_fonti,...diagnostica()}}
  }
  const stato=migliore.numero_riferimenti===0&&fonti_inaccessibili.length?'NESSUN_RIFERIMENTO_VALIDO_CON_FONTI_INACCESSIBILI':migliore.stato
  return {...migliore,stato,ricerche,percorso,associazioni_fonti,...diagnostica()}
}
export function applicaPrezzoWeb<T extends {prezzo_unitario?:number}>(voce:T,risultato:EsitoWeb){
  if(risultato.stato!=='OK'||risultato.prezzo_proposto===null||!Number.isFinite(risultato.prezzo_proposto))throw Error('prezzo_web_non_applicabile')
  // Nessuna maggiorazione automatica: proposta Web documentata, scelta esplicita.
  return {...voce,prezzo_unitario:risultato.prezzo_proposto,fonte_prezzo:'Web — Prezzo da verificare',webPrice:risultato,webPriceApplied:true,webMemoryConfirmed:false}
}
export const puoSalvarePrezzoInMemoria=(voce:{webPriceApplied?:boolean;webMemoryConfirmed?:boolean;prezzo_unitario?:number;webPrice?:EsitoWeb})=>
  !voce.webPriceApplied||(voce.webMemoryConfirmed===true&&voce.webPrice?.stato==='OK'&&voce.prezzo_unitario===voce.webPrice.prezzo_proposto)
