import {randomUUID} from 'node:crypto'
export async function seedOwner(db,mode='none'){
 const u=randomUUID(),c=randomUUID(),h=randomUUID(),r=randomUUID(),rc=randomUUID(),src=randomUUID()
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[u]);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])
 await db.query("INSERT INTO cantieri(id,nome) VALUES($1,'Cantiere sintetico')",[c]);await db.query("INSERT INTO utenti_cantiere(cantiere_id,user_id,ruolo) VALUES($1,$2,'owner')",[c,u])
 if(mode!=='none'){
  await db.query("INSERT INTO fatture_fornitori(id,nome_file) VALUES($1,'fattura-sintetica')",[h]);await db.query("INSERT INTO fatture_fornitori_righe(id,fattura_id,cantiere_id,descrizione,quantita,prezzo_unitario,totale_riga) VALUES($1,$2,$3,'Riga sintetica',100,10,1000)",[r,h,c])
  if(['stock','all'].includes(mode))await db.query("INSERT INTO materiali_impresa(fattura_riga_id,categoria,quantita,unita_misura,prezzo_unitario,totale,created_by,richiesta_id) VALUES($1,'magazzino',1,'pz',10,10,$2,$3)",[r,u,randomUUID()])
  if(['material','all'].includes(mode))await db.query('SELECT * FROM public.assegna_materiale_fattura_cantiere($1,$2,1,$3)',[r,c,'pz'])
  if(['economia','all'].includes(mode)){
   await db.query("INSERT INTO economia_raccolte(id,cantiere_id,numero,titolo,data,created_by) VALUES($1,$2,1,'Economia sintetica',current_date,$3)",[rc,c,u])
   await db.query("INSERT INTO economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot,created_by,tipo) VALUES($1,$2,'Fattura sintetica','fattura',$3,'{}',$4,'fattura_fornitore')",[src,rc,'a'.repeat(64),u])
   await db.query("INSERT INTO economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,origine,sorgente_id,created_by,tipo_riga,dettagli_analitici,fattura_riga_id) VALUES($1,1,'Materiale sintetico','pz',1,10,'fattura_fornitore',$2,$3,'materiale','{\"version\":1}',$4)",[rc,src,u,r])
  }
 }
 return {u,c,h,r,rc,src}
}
export async function seedContract(db,z,{variants=1,links=false,documents=false,operations=false}={}){
 const p=randomUUID(),s=randomUUID(),q=randomUUID(),photo=randomUUID(),vs=[]
 await db.query('INSERT INTO sopralluoghi(id) VALUES($1)',[s]);await db.query("INSERT INTO preventivi_cantiere(id,cantiere,cantiere_id,sopralluogo_id,file_path) VALUES($1,'Sintetico',$2,$3,'sintetico/shared.pdf')",[p,z.c,s]);await db.query('UPDATE cantieri SET preventivo_contrattuale_id=$1 WHERE id=$2',[p,z.c])
 const lines=[];for(let n=0;n<3;n++){const row=(await db.query("INSERT INTO preventivo_lavorazioni(cantiere,cantiere_id,preventivo_id,descrizione,unita_misura,quantita,prezzo_unitario,importo_previsto) VALUES('Sintetico',$1,$2,$3,'m²',10,20,200) RETURNING id",[z.c,p,'Contratto sintetico '+n])).rows[0];lines.push(String(row.id));await db.query("INSERT INTO sal_lavorazioni(cantiere,descrizione,cantiere_id,source_lavorazione_id,importo_previsto,percentuale,importo_maturato) VALUES('Sintetico','SAL sintetico',$1,$2,200,20,40)",[z.c,row.id])}
 if(links){await db.query("INSERT INTO quaderno_progetti(id,user_id,titolo,testo) VALUES($1,$2,'Quaderno autonomo','Testo sintetico')",[q,z.u]);await db.query("INSERT INTO foto_sopralluogo(id,sopralluogo_id,nota,immagine_base64) VALUES($1,$2,'Foto autonoma','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=')",[photo,s]);await db.query("INSERT INTO foto_cantiere(cantiere_id,file_path) VALUES($1,'sintetico/shared.pdf')",[z.c])}
 for(let n=0;n<variants;n++){const v=randomUUID();vs.push(v);await db.query("INSERT INTO varianti_cantiere(id,cantiere_id,preventivo_contrattuale_id,titolo,descrizione) VALUES($1,$2,$3,'Variante sintetica','Descrizione sintetica')",[v,z.c,p]);if(links){await db.query("SELECT public.modifica_fonte_memory_variante($1,$2,'collega',(SELECT updated_at FROM quaderno_progetti WHERE id=$2))",[v,q]);await db.query("INSERT INTO variante_fonti_visive(variante_id,source_type,source_id) VALUES($1,'foto_sopralluogo',$2)",[v,photo])}
 if(documents){const ctx=(await db.query('SELECT public.leggi_contesto_preventivo_integrativo($1) d',[v])).rows[0].d;const line=(op,qty,ref=null,price=20)=>({operazione:op,descrizione:'Revisione sintetica',unita_misura:'m²',quantita:qty,prezzo_unitario:price,riferimento_preventivo_lavorazione_id:ref,da_verificare:false,revisione_confermata:true});const rows=operations?[line('nuova',2,null,31),line('aumento',1,lines[0]),line('riduzione',-2,lines[1]),line('eliminazione',-8,lines[2])]:[line('nuova',2,null,31)];await db.query('SELECT public.salva_preventivo_integrativo_generato($1,$2,$3,$4,$5::jsonb)',[v,randomUUID(),ctx.firma,'Documento sintetico',JSON.stringify(rows)])}
 }
 return {p,s,q,photo,vs,lines}
}
