const crypto=require('crypto')
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`
const digest=s=>crypto.createHash('sha256').update(s).digest('hex')
const image='data:image/png;base64,iVBORw0KGgo='
function photo(n=7,type='foto_cantiere') {return {source_id:id(n),source_type:type,source_version:null,impronta:digest('foto'+n),origine:type==='foto_cantiere'?'cantiere':'sopralluogo',sopralluogo_id:type==='foto_cantiere'?null:id(10),collegata:true,disponibile:true,foto:{id:id(n),cantiere:'Test',nota:'Foto sintetica',immagine_base64:image,allegato_v1_id:null}}}
function packet(photos=[photo()]) {
 const q={id:id(6),titolo:'Quaderno test',testo:'Testo Quaderno',updated_at:'2026-10-25T10:00:00+00:00',source_version:'2026-10-25T10:00:00+00:00',aggiornato:true,disponibile:true}
 return {variante:{id:id(5),stato:'bozza',titolo:'Variante test',descrizione:'Descrizione Variante'},cantiere_id:id(3),quaderni:[q],foto:photos,
 manifesto:{versione:1,firma:digest('snapshot'),variante:{source_id:id(5),impronta:digest('descrizione')},quaderni:[{source_id:q.id,source_version:q.updated_at}],foto:photos.map(f=>({source_id:f.source_id,source_type:f.source_type,source_version:null,impronta:f.impronta}))}}
}
const result={sintesi:'Osservazione fixture',ipotesi:['Ipotesi prudente'],verifiche:['Verifica in sito'],domande:['Domanda'],avvertenza:'Valutazione preliminare'}
module.exports={id,digest,image,photo,packet,result}
