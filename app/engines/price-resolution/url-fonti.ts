const tracking=new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content'])
export function canonicalizzaUrl(value:string):string|null {
  try {
    if(typeof value!=='string'||/[\u0000-\u0020\u007f\\]/.test(value))return null
    // Rifiutare percorsi che URL riscriverebbe risolvendo segmenti . o .. .
    const pathname=value.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1]||'/'
    if(/(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(pathname))return null
    const url=new URL(value)
    if(url.protocol!=='https:'||url.username||url.password)return null
    url.hostname=url.hostname.toLowerCase()
    url.hash=''
    // Conservare ordine, valori e codifica dei parametri funzionali.
    const params=url.search.slice(1).split('&').filter(param=>{
      const name=decodeURIComponent(param.split('=')[0].replace(/\+/g,' '))
      return !tracking.has(name)
    })
    url.search=params.join('&')
    if(url.pathname.length>1&&url.pathname.endsWith('/'))url.pathname=url.pathname.slice(0,-1)
    return url.href
  }catch{return null}
}
export type AuditFonteUrl = {
  stato:'ASSOCIATA'|'FONTE_NON_ASSOCIATA'|'FONTE_AMBIGUA';
  url_riferimento_originale:string;url_fonte_originale:string|null;
  url_fonti_originali:string[];url_canonica:string|null;
}
export function associaFonteUrl<T extends {url:string}>(riferimento:string,fonti:readonly T[]):
  {stato:'ASSOCIATA';fonte:T;audit:AuditFonteUrl}|{stato:'FONTE_NON_ASSOCIATA'|'FONTE_AMBIGUA';audit:AuditFonteUrl} {
  const canonical=canonicalizzaUrl(riferimento)
  const matches=canonical?fonti.filter(f=>canonicalizzaUrl(f.url)===canonical):[]
  const stato=matches.length===1?'ASSOCIATA':matches.length>1?'FONTE_AMBIGUA':'FONTE_NON_ASSOCIATA'
  const audit:AuditFonteUrl={stato,url_riferimento_originale:riferimento,url_canonica:canonical,
    url_fonte_originale:matches.length===1?matches[0].url:null,url_fonti_originali:matches.map(f=>f.url)}
  return stato==='ASSOCIATA'?{stato,fonte:matches[0],audit}:{stato,audit}
}
export async function leggiFontiAssociate<T extends {url:string}>(riferimenti:readonly string[],fonti:readonly T[],leggi:(fonte:T)=>Promise<T>){
  const matches=riferimenti.map(url=>associaFonteUrl(url,fonti))
  const lette:T[]=[],visitate=new Set<string>()
  // Stesso limite preesistente: tre URL di riferimento distinti, nessun retry.
  for(const url of [...new Set(riferimenti)].slice(0,3)){
    const match=matches.find(m=>m.audit.url_riferimento_originale===url)
    if(!match||match.stato!=='ASSOCIATA'||!match.audit.url_canonica||visitate.has(match.audit.url_canonica))continue
    visitate.add(match.audit.url_canonica)
    lette.push(await leggi(match.fonte))
  }
  return {fonti:lette,associazioni:matches.map(m=>m.audit)}
}
