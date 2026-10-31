import type { RigaPrezzoMateriale } from './prezzoMaterialeCliente'
export type StatoEsclusione = { tipo?: string; esclusa_proposta?: unknown; motivo_esclusione?: unknown; prezzo: unknown; quantita: unknown; totale?: unknown }
export function esclusioneValida(r: StatoEsclusione): boolean {
 return r.esclusa_proposta === true && r.tipo === 'materiale' && typeof r.motivo_esclusione === 'string' && r.motivo_esclusione.trim().length >= 10 && r.motivo_esclusione.length <= 1000 && typeof r.prezzo === 'number' && r.prezzo === 0 && typeof r.totale === 'number' && r.totale === 0 && Number.isFinite(Number(r.quantita)) && Number(r.quantita)>0
}
export function conteggiProposta(righe: readonly StatoEsclusione[]) { const escluse=righe.filter(esclusioneValida).length; return { totali:righe.length,incluse:righe.length-escluse,escluse } }
type Client = { rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{data:unknown;error:{code?:string}|null}> }
const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v)
export async function salvaEsclusione(client:Client,raccolta:{id:string;revisione:number;stato:string},riga:RigaPrezzoMateriale,esclusa:boolean,motivo:string):Promise<void>{
 if(raccolta.stato!=='bozza'||!Number.isSafeInteger(raccolta.revisione)||raccolta.revisione<0||motivo.trim().length<10||motivo.trim().length>1000|| (esclusa && riga.prezzo!==0))throw Error('Raccolta aperta, riga a valore zero e motivo esplicito richiesti.')
 const {data,error}=await client.rpc('classifica_riga_non_economica',{p_raccolta_id:raccolta.id,p_riga_id:riga.id,p_esclusa:esclusa,p_motivo:motivo.trim(),p_revisione_attesa:raccolta.revisione})
 if(error)throw Error(['PT409','40001'].includes(error.code||'')?'La Raccolta è cambiata: rileggi prima di riprovare.':error.code==='55000'?'Raccolta congelata o storico protetto.':'Classificazione non confermata: rileggi prima di riprovare.')
 const c=record(data)?data.raccolta:null,e=record(data)?data.riga:null,d=record(e)?e.dettagli_analitici:null,j=record(d)?d.proposta_non_economica:null
 if(!record(c)||!record(e)||!record(j)||c.id!==raccolta.id||c.stato!=='bozza'||c.revisione!==raccolta.revisione+1||e.id!==riga.id||e.raccolta_id!==raccolta.id||Number(e.quantita)!==riga.quantita||Number(e.prezzo_unitario)!==riga.prezzoOrigine||e.origine!==riga.origine||j.esclusa!==esclusa||j.motivo!==motivo.trim())throw Error('Risposta non verificabile: rileggi e non reinviare automaticamente.')
}
