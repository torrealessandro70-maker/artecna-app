// Schema separato dalla query. Nessun recupero permissivo di JSON dal testo libero.
const strings = ['titolo','url','unita_misura','origine_listino','descrizione','evidenza']
const nullable = ['citta','provincia','regione','data_prezzo']
export const schemaOutputWeb = {
  type:'object',additionalProperties:false,required:['riferimenti'],properties:{riferimenti:{type:'array',items:{
    type:'object',additionalProperties:false,
    required:[...strings,...nullable,'prezzo','ambito','area','iva'],
    properties:{...Object.fromEntries(strings.map(k=>[k,{type:'string'}])),
      ...Object.fromEntries(nullable.map(k=>[k,{type:['string','null']}])),
      prezzo:{type:'number'},ambito:{type:'string',enum:['materiale','posa','fornitura e posa']},
      area:{type:'string',enum:['Catania','Sicilia','Sud Italia','Italia nazionale']},
      iva:{type:'string',enum:['inclusa','esclusa','non dichiarata']}}
  }}}}
export function leggiOutputWeb(text:string):{riferimenti:unknown[]} {
  try {
    const v:unknown=JSON.parse(text)
    if(!v||typeof v!=='object'||Object.keys(v).join(',')!=='riferimenti'||!('riferimenti' in v)||!Array.isArray(v.riferimenti)||v.riferimenti.length>20)throw Error()
    const keys=[...strings,...nullable,'prezzo','ambito','area','iva']
    for(const r of v.riferimenti){
      if(!r||typeof r!=='object'||Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||
        strings.some(k=>typeof r[k]!=='string')||nullable.some(k=>r[k]!==null&&typeof r[k]!=='string')||
        typeof r.prezzo!=='number'||!Number.isFinite(r.prezzo)||
        !['materiale','posa','fornitura e posa'].includes(r.ambito)||
        !['Catania','Sicilia','Sud Italia','Italia nazionale'].includes(r.area)||
        !['inclusa','esclusa','non dichiarata'].includes(r.iva))throw Error()
    }
    return {riferimenti:v.riferimenti}
  } catch {throw Error('OUTPUT_NON_VALIDO')}
}
export function verificaQueryWeb(actual:string,expected:string){
  const normalizza=(text:string)=>text.replace(/\\u([0-9a-fA-F]{4})/g,(_escape,hex:string)=>String.fromCharCode(parseInt(hex,16)))
    .normalize('NFC').replace(/\r\n?/g,'\n')
  if(normalizza(actual)!==normalizza(expected))throw Error('QUERY_WEB_NON_VALIDA')
}
