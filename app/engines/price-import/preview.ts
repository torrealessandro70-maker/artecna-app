import { validatePriceImportRows } from './validator'
import { normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import type { PriceImportPreview, PriceImportRow } from './types'
import { erroriRigaRegionale } from './regional-metadata'
export type ExistingPrice = {codice:string;descrizione:string;unita_misura:string;prezzo_unitario:number;fonte:string;versione:string|null;tipo_prezzo:string;anno?:number|null;incidenza_manodopera?:number|null;prezzo_manodopera?:number|null}
const key=(r: {codice:string;fonte:string;versione?:string|null})=>JSON.stringify([r.codice.trim(),r.fonte.trim(),r.versione||null])
export const applicablePriceRow=(r: PriceImportRow)=>r.status!=='error' && (r.classificazione==='NUOVA'||r.classificazione==='AGGIORNAMENTO')
export function classifyPricePreview(preview: PriceImportPreview, existing: readonly ExistingPrice[]): PriceImportPreview {
  const byKey=new Map<string,ExistingPrice[]>()
  for(const row of existing) {const k=key(row);byKey.set(k,[...(byKey.get(k)||[]),row])}
  const rows=preview.rows.map(row=>({...row,
    errors:[...row.errors.filter(e=>!['Codice mancante','Descrizione mancante','Prezzo mancante o non valido'].includes(e) && !/^(Identità anno\/versione|Prefisso codice incompatibile|Codice o versione non coerenti|Manodopera ufficiale incoerente)/.test(e)),...erroriRigaRegionale(row,preview.prezzario)],
    warnings:row.warnings.filter(w=>!['Voce duplicata nel file','Unità di misura mancante','Prezzo uguale a zero'].includes(w)),
  }))
  const validated=validatePriceImportRows(preview.fileName,rows)
  return {...preview,...validated,rows:validated.rows.map(r=>{
    const candidates=byKey.get(key(r))||[]
    const blocked=r.status==='error'||candidates.length>1||candidates.some(e=>e.tipo_prezzo!==r.tipoPrezzo || (r.anno!=null && e.anno!=null && r.anno!==e.anno))
    const duplicate=r.warnings.includes('Voce duplicata nel file')||candidates.some(e=>e.descrizione===r.descrizione && normalizeUnitOfMeasure(e.unita_misura)===normalizeUnitOfMeasure(r.unitaMisura) && Number(e.prezzo_unitario)===r.prezzo && (e.incidenza_manodopera??null)===(r.percentualeManodopera??null) && (e.prezzo_manodopera??null)===(r.prezzoManodopera??null))
    const classificazione: PriceImportRow['classificazione']=blocked?'BLOCCATA':duplicate?'DUPLICATO':candidates.length?'AGGIORNAMENTO':'NUOVA'
    return {...r,classificazione,selezionata:(classificazione==='NUOVA'||classificazione==='AGGIORNAMENTO')&&!!r.selezionata}
  })}
}
export function editPricePreview(preview: PriceImportPreview,index:number,patch: Partial<Pick<PriceImportRow,'codice'|'descrizione'|'unitaMisura'|'prezzo'>>,existing:readonly ExistingPrice[]) {
  const rows=preview.rows.map((r,i)=>({...r,...(i===index?patch:{}),selezionata:false,
    ...(i===index&&r.paginaPdf?{percentualeManodopera:null,prezzoManodopera:null}:{}),
  }))
  return classifyPricePreview({...preview,rows},existing)
}
export function selectPricePreview(preview: PriceImportPreview,selected:boolean,index?:number):PriceImportPreview {
  return {...preview,rows:preview.rows.map((r,i)=>({...r,selezionata:index===undefined||index===i?selected&&applicablePriceRow(r):r.selezionata}))}
}
export function selectedPricePreview(preview:PriceImportPreview):PriceImportPreview {
  const rows=preview.rows.filter(r=>r.selezionata&&applicablePriceRow(r))
  return {...preview,totalRows:rows.length,rows}
}
