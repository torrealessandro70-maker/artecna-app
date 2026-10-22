// Unico nucleo strutturale SIC24: usato dal browser e dall'audit Python.
// Port delle regole certificate: colonne, varianti e tolleranze restano identiche.
export type PdfWord = { text: string; x0: number; x1: number; top: number; bottom: number }
export type PdfGeometry = { page: number; words: PdfWord[] }
export type PdfTariff = {
  code: string; parent: string; variant: number | null; description: string
  base_description: string; variant_description: string; unit: string
  price: number | null; percent: number | null; labour: number | null
  page?: number; price_y?: number; geometry_ambiguous?: boolean
  validation: string; reason: string
}
const MONEY = '(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})'
const amountsPattern = new RegExp(`^(${MONEY})(?:\\(€(${MONEY})\\))?$`)
const percentPattern = /^(\d+(?:,\d+)?)%$/
const number = (text: string) => Number(text.replaceAll('.', '').replace(',', '.'))
export function validatePdfTariff(price: number | null, percent: number | null, labour: number | null): [string, string] {
  if (price === null || price <= 0 || percent === null || labour === null)
    return ['SENZA_MANODOPERA', 'Quaterna prezzo/incidenza/importo incompleta']
  if (![price, percent, labour].every(Number.isFinite) || !(percent > 0 && percent <= 100) || labour < 0 || labour > price)
    return ['INVALIDO', 'Valori fuori intervallo']
  if (Math.abs(price * percent / 100 - labour) > 0.02 + 1e-10)
    return ['INCOERENTE', 'Scostamento matematico superiore a 0,02 euro']
  return ['VALIDO', 'Colonne PDF associate alla stessa tariffa; controllo entro 0,02 euro']
}
type Tariff = Omit<PdfTariff, 'code'|'parent'|'variant'|'description'|'base_description'|'variant_description'|'validation'|'reason'>
type Variant = { variant: number | null; text: string[]; tariffs: Tariff[] }
type Group = { code: string; prefix: string[]; variants: Variant[]; current: Variant | null }
export function parseSic24Geometry(pages: readonly PdfGeometry[], prefisso: string | null = 'SIC24_'): PdfTariff[] {
  if (prefisso !== null && !/^SIC\d{2}_$/.test(prefisso)) throw Error('Prefisso prezzario PDF non valido.')
  const CODE = prefisso === null ? /^(?:SIC\d{2}_)?\d+(?:\.\d+){2,}$/ : new RegExp(`^${prefisso}\\d+(?:\\.\\d+){2,}$`)
  const groups: Group[] = []
  let group: Group | null = null
  for (const page of pages) {
    if (page.page <= 4) continue
    const words = page.words.filter(w => w.top > 85 && w.top < 782)
    const lines: PdfWord[][] = []
    for (const w of [...words].sort((a,b) => a.top-b.top || a.x0-b.x0)) {
      if (!lines.length || Math.abs(w.top-lines[lines.length-1][0].top)>1.8) lines.push([w])
      else lines[lines.length-1].push(w)
    }
    for (const line of lines) {
      line.sort((a,b)=>a.x0-b.x0)
      let codes: PdfWord[] = []
      if (line[0].x0<60) for (const w of line) {
        if(w.x0>115 || !/^[SIC0-9_.]+$/.test(w.text) || (codes.length && w.x0-codes[codes.length-1].x1>10)) break
        codes.push(w)
      }
      const code = codes.map(w=>w.text).join('')
      if(!CODE.test(code)) codes=[]
      if(codes.length) {
        if(group) groups.push(group)
        group={code,prefix:[],variants:[],current:null}
      }
      if(!group) continue
      const label=line.find(w=>w.x0<165 && /^\d+\)$/.test(w.text))
      if(label && !line.some(w=>w.x0<label.x0-1 && !codes.includes(w))) {
        const v: Variant={variant:Number(label.text.slice(0,-1)),text:[],tariffs:[]}
        group.variants.push(v);group.current=v
      }
      const currency=line.filter(w=>w.text==='€' && w.x0>425 && w.x0<480)
      let tariffWords=new Set<PdfWord>()
      if(currency.length===1) {
        const euro=currency[0], financialWords=line.filter(w=>w.x0>euro.x1)
        const amounts=amountsPattern.exec(financialWords.map(w=>w.text).join(''))
        const units=line.filter(w=>w.x0>euro.x0-60 && w.x1<euro.x0-3 && Math.abs(w.top-euro.top)<0.8)
        if(!group.current) {group.current={variant:null,text:[],tariffs:[]};group.variants.push(group.current)}
        if(amounts && units.length) {
          const rightEdge=amounts[2]?financialWords[financialWords.length-1].x1:null
          const incidence=words.filter(w=>rightEdge!==null && percentPattern.test(w.text) && Math.abs(w.x1-rightEdge)<1.5 && Math.abs(euro.top-w.top-13.25)<1.5)
          group.current.tariffs.push({page:page.page,price:number(amounts[1]),unit:units.map(w=>w.text).join(' '),
            percent:incidence.length===1?number(incidence[0].text.slice(0,-1)):null,labour:amounts[2]?number(amounts[2]):null,
            geometry_ambiguous:incidence.length>1,price_y:Math.round(euro.top*1000)/1000})
        } else group.current.tariffs.push({page:page.page,price:null,unit:units.map(w=>w.text).join(' '),percent:null,labour:null,geometry_ambiguous:true,price_y:Math.round(euro.top*1000)/1000})
        tariffWords=new Set([euro,...units,...financialWords])
      }
      const text=line.filter(w=>!tariffWords.has(w) && !codes.includes(w) && !(w.x0>510 && percentPattern.test(w.text))).map(w=>w.text).join(' ')
      if(text) (group.current?group.current.text:group.prefix).push(text)
    }
  }
  if(group) groups.push(group)
  const records: PdfTariff[]=[]
  for(const g of groups) {
    for(const v of g.variants) for(const tariff of v.tariffs) {
      let [validation,reason]=validatePdfTariff(tariff.price,tariff.percent,tariff.labour)
      if(v.tariffs.length!==1 || tariff.geometry_ambiguous) {validation='AMBIGUO';reason='Più tariffe o incidenze per la stessa variante'}
      records.push({...tariff,code:g.code+(v.variant!==null?'.'+v.variant:''),parent:g.code,variant:v.variant,
        base_description:g.prefix.join(' '),variant_description:v.text.join(' '),description:[...g.prefix,...v.text].join(' '),validation,reason})
    }
    if(!g.variants.length) records.push({code:g.code,parent:g.code,variant:null,description:g.prefix.join(' '),base_description:g.prefix.join(' '),variant_description:'',unit:'',price:null,percent:null,labour:null,validation:'SENZA_MANODOPERA',reason:'Nessuna riga tariffaria strutturale individuata'})
  }
  const counts=new Map<string,number>();for(const r of records) counts.set(r.code,(counts.get(r.code)||0)+1)
  for(const r of records) if(counts.get(r.code)!>1) {r.validation='AMBIGUO';r.reason='Codice PDF duplicato'}
  return records
}
