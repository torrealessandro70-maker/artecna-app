import {lookup} from 'node:dns/promises'
import type {LookupAddress} from 'node:dns'
import {BlockList,isIP,type LookupFunction} from 'node:net'
import {request} from 'node:https'
import type {FonteWeb} from '../../../engines/price-resolution/web-fallback'

const privateAddresses=new BlockList()
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['192.0.0.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)privateAddresses.addSubnet(address,prefix,'ipv4')
// IPv6 accettato solo nello spazio global unicast; esclude mapped/loopback/link-local.
export const indirizzoPubblico=(address:string)=>isIP(address)===4?!privateAddresses.check(address,'ipv4'):
  isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:db8:/i.test(address)
export function creaLookupDns(addresses:readonly LookupAddress[]):LookupFunction {
  // Stessa guardia preesistente: anche un solo indirizzo non sicuro blocca la fonte.
  if(!addresses.length||addresses.some(a=>!indirizzoPubblico(a.address)))throw Error('DNS_NON_VALIDO')
  const validati=addresses.map(a=>({address:a.address,family:a.family}))
  return (_host,options,callback)=>{
    if(options.all===true)callback(null,validati.map(a=>({...a})))
    else callback(null,validati[0].address,validati[0].family)
  }
}
export function testoPagina(html:string){
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&euro;|&#8364;/gi,'€')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()
}
// Solo URL citati dal tool. DNS verificato e indirizzo fissato alla connessione:
// niente redirect, credenziali, porte arbitrarie o retry. Lettura limitata, nessun JS.
export async function leggiFonte(fonte:FonteWeb):Promise<FonteWeb>{
  let status_http:number|undefined
  try {
    const url=new URL(fonte.url)
    if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))return {...fonte,errore_lettura:'URL_NON_AMMESSA'}
    const addresses=await new Promise<LookupAddress[]>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('dns_timeout')),3000)
      lookup(url.hostname,{all:true}).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)})
    })
    const lookupValidato=creaLookupDns(addresses)
    const html=await new Promise<string>((resolve,reject)=>{
      const call=request(url,{lookup:lookupValidato,headers:{Accept:'text/html,text/plain'}},response=>{
        status_http=response.statusCode
        if(response.statusCode!==200){response.resume();reject(Error('HTTP_NON_ACCESSIBILE'));return}
        if(!/^text\/(html|plain)/i.test(String(response.headers['content-type']))){response.resume();reject(Error('CONTENUTO_NON_LEGGIBILE'));return}
        let size=0;const chunks:Buffer[]=[]
        response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>256000){call.destroy(Error('fonte_troppo_grande'));return}chunks.push(chunk)})
        response.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')))
        response.on('error',reject)
      })
      const timer=setTimeout(()=>call.destroy(Error('fonte_timeout')),3000)
      call.on('close',()=>clearTimeout(timer));call.on('error',reject);call.end()
    })
    const testo=testoPagina(html)
    return testo?{...fonte,testo,status_http}:{...fonte,status_http,errore_lettura:'CONTENUTO_NON_LEGGIBILE'}
  }catch(error){
    const message=error instanceof Error?error.message:''
    const errore_lettura=message==='DNS_NON_VALIDO'?'DNS_NON_VALIDO':message==='dns_timeout'||message==='fonte_timeout'?'TIMEOUT':
      message==='HTTP_NON_ACCESSIBILE'?'HTTP_NON_ACCESSIBILE':message==='CONTENUTO_NON_LEGGIBILE'||message==='fonte_troppo_grande'?'CONTENUTO_NON_LEGGIBILE':'FONTE_NON_ACCESSIBILE'
    return {...fonte,status_http,errore_lettura} // Nessun contenuto inventato o retry.
  }
}
