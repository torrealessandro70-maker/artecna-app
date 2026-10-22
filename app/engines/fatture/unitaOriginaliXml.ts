export function unitaOriginaliXml(testo: string): Record<number,string> {
  if(!testo.trim())return {}
  const doc=new DOMParser().parseFromString(testo,'application/xml')
  if(doc.getElementsByTagName('parsererror').length)return {}
  const result:Record<number,string>={},seen=new Set<number>()
  for(const line of Array.from(doc.getElementsByTagNameNS('*','DettaglioLinee'))){
    const n=Number(line.getElementsByTagNameNS('*','NumeroLinea')[0]?.textContent?.trim()),um=line.getElementsByTagNameNS('*','UnitaMisura')[0]?.textContent?.trim()
    if(!Number.isSafeInteger(n)||n<=0)continue
    if(seen.has(n)){delete result[n];continue}seen.add(n)
    if(um)result[n]=um
  }
  return result
}
