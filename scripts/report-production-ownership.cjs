// Offline reporting only. Consumes validated exports; never executes SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'audit-production'),docs=path.join(root,'docs')
const s=require('../audit-production/normalized-production.json'),e=require('../audit-production/normalized-e2.json'),a=require('../audit-production/analysis.json')
const full=r=>r.schema+'.'+r.table,rel=new Map(s.relations.map(r=>[String(r.oid),r])),fk=s.constraints.filter(c=>c.type==='f'),closure=new Set(a.closureTables.map(r=>r.oid))
const byName=new Map(s.relations.map(r=>[full(r),r])),byPath=new Map(a.closureTables.map(r=>[r.name,r.path]))
const csvValue=x=>'"'+String(x??'').replaceAll('"','""')+'"'
function saveCsv(name,rows){const cols=Object.keys(rows[0]);fs.writeFileSync(path.join(docs,name),[cols.join(','),...rows.map(r=>cols.map(c=>csvValue(r[c])).join(','))].join('\n')+'\n')}
const legal=new Set(['fatture_emesse','fatture_fornitori','fatture_fornitori_righe','fornitori_rettifiche','attribuzioni_clienti','fatture_classificazione_richieste'])
const direct=new Set(['cantieri','utenti_cantiere','preventivi_cantiere','preventivo_lavorazioni','sal_lavorazioni','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','acconti_cantiere','pagamenti_fornitori','incassi_non_fatturati','varianti_cantiere','economia_raccolte','allegati','contesto','cleanup_storage'])
const derived=new Set(['variante_lavorazioni','variante_sorgenti','variante_documenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi','economia_sorgenti','economia_righe','rapportino_prestazioni','rapportino_materiali','richieste','f3c3_capability'])
function classification(r){if(legal.has(r.table))return ['contabile_da_detach',['fatture_fornitori','fornitori_rettifiche','fatture_emesse'].includes(r.table)?'KEEP_LEGAL':'DETACH'];if(r.table==='memoria_prezzi')return ['legacy_da_normalizzare','NORMALIZE_FIRST'];if(direct.has(r.table))return ['owned_uuid',r.table==='cleanup_storage'?'DETACH':'DELETE'];if(derived.has(r.table))return ['owned_derivabile',/fonti_memory|fonti_visive/.test(r.table)?'DETACH':'DELETE'];return ['shared','DETACH']}
const notes={
 materiali_impresa:'Patrimonio impresa: preservare il record e la fonte fattura globale. Non seguire la FK come prova di ownership.',
 fatture_fornitori_righe:'Preservare riga del documento; separare destinazione/quote operative dal documento globale.',
 fornitori_rettifiche:'KEEP_LEGAL dello storico + DETACH operativo tramite nuova identità archivistica; CHECK XOR e trigger immutabile vietano il semplice SET NULL.',
 attribuzioni_clienti:'KEEP_LEGAL evidenza; archiviare e rimuovere/scollegare link operativi senza perdita documentale.',
 fatture_classificazione_richieste:'Ricevuta idempotenza documento globale; preservare storico, separare riferimenti UUID operativi in payload/risultato.',
 cleanup_storage:'Job tecnico durevole senza FK root; deve sopravvivere al delete fino al cleanup. Non è un record applicativo residuo.',
 contesto:'Contesto transazionale privato: termina_contesto prima di eliminare membership/root.',
 f3c3_capability:'Capability temporanea mono-operazione legata a tx/pid/foto/allegato, non sessione globale.',
 sessioni_portale:'Sessione operaio globale: preservare; revocare solo eventuali associazioni target, non la sessione per il solo delete cantiere.',
 memoria_prezzi:'Solo nome: assegnazione esplicita autorizzata a UUID, mai DELETE per nome.',
 agenda_attivita:'collegamento JSON: eliminare/scollegare solo il target canonico, preservare attività e altri collegamenti se condivisi.'
}
const tableRows=s.relations.map(r=>{const [ownership,azione]=classification(r);return {tabella:full(r),ownership,azione,percorso:byPath.get(full(r))||({attribuzioni_clienti:'cantiere_id logico; fattura/acconto devono concordare',fatture_classificazione_richieste:'fattura_id logico → documento; payload/risultato → quote target',cleanup_storage:'cantiere_id logico tecnico',contesto:'cantiere_id logico transazionale',f3c3_capability:'allegato_id/foto_id logici → allegati/foto → cantieri.id',memoria_prezzi:'cantiere testuale → NORMALIZE_FIRST',agenda_attivita:'collegamento {tipo:cantiere,id:UUID} → cantieri.id'}[r.table]||'Sorgente/globale: nessuna ownership derivata del padre; preservare il record e scollegare solo riferimenti target'),nota:notes[r.table]||(closure.has(String(r.oid))?'Tutti i percorsi valorizzati devono concordare con il target; riferimenti esterni non autorizzano DELETE di dati terzi.':'Contesto globale/sorgente esterna; DETACH riguarda soltanto eventuale collegamento target, mai la riga globale.')}})
const tableMap=new Map(tableRows.map(r=>[r.tabella,r]))
const edgeRows=fk.map(k=>{const r=tableMap.get(k.child);assert(r,'External child metadata missing '+k.child);const boundary=a.boundary.some(b=>b.oid===k.oid);return {fk:k.name,figlio:k.child,colonne_figlie:k.child_columns.join(','),padre:k.parent,colonne_padre:k.parent_columns.join(','),on_delete:k.on_delete,on_update:k.on_update,validated:k.validated,deferrable:k.deferrable,scope:a.incoming.some(b=>b.oid===k.oid)?'entrante_cantiere':boundary?'confine_globale':'contesto_esterno',ownership:boundary?'shared':r.ownership,azione:boundary||r.ownership==='contabile_da_detach'?'DETACH':r.azione,percorso:r.percorso,definizione:k.definition}})
saveCsv('cantiere-ownership-production.csv',tableRows);saveCsv('cantiere-fk-production.csv',edgeRows)
fs.writeFileSync(path.join(docs,'cantiere-fk-certificati.md'),['# FK dal catalogo Production esportato','',`Fonte esclusiva: production-schema-snapshot.csv, SHA256 ${a.validation[1].sha256}.`, '',`84 FK nell'ambito esportato (public + artecna_* e FK ai loro confini), non inventario di tutti gli schemi interni Supabase. 57 entranti nel grafo Cantiere (18 dirette + 39 indirette), 9 di confine: 66 FK nel perimetro hard-delete; 18 di contesto esterno preservato.`, '', '| Scope | Figlio | FK | Padre | ON DELETE | Ownership | Azione |','|---|---|---|---|---|---|---|',...edgeRows.map(r=>`| ${r.scope} | ${r.figlio} (${r.colonne_figlie}) | ${r.fk} | ${r.padre} (${r.colonne_padre}) | ${{a:'NO ACTION',r:'RESTRICT',c:'CASCADE',n:'SET NULL',d:'SET DEFAULT'}[r.on_delete]} | ${r.ownership} | ${r.azione} |`),'','Estremi, ON UPDATE, validazione, differibilità e definizioni integrali nel CSV cantiere-fk-production.csv. Nessuna ownership è dedotta dal solo fatto di raggiungibilità.'].join('\n')+'\n')
const logical=[]
function add(table,field,target,kind,ownership,azione,rule){const r=byName.get(table);assert(r,table);for(const col of field.split(','))assert(s.columns.some(c=>c.relation===r.oid&&c.name===col),table+'.'+col);logical.push({tabella:table,campi:field,destinazione:target,tipo:kind,ownership,azione,regola:rule})}
for(const l of a.legacy)add(l.table,'cantiere','cantieri.nome','legacy_nome','legacy_da_normalizzare','NORMALIZE_FIRST','UUID già presente prevale; in assenza usare solo FK canoniche concordi o assegnazione esplicita autorizzata. Mai inferire da nome, anche se unico.')
for(const c of s.columns.filter(c=>['json','jsonb'].includes(c.type))){const r=rel.get(c.relation),cl=tableMap.get(full(r));add(full(r),c.name,'UUID/file/snapshot incorporati; non ownership dei referenti','json_snapshot',cl.ownership,cl.azione,'Il contenitore segue la propria ownership; preservare sorgenti globali; snapshot storico non è FK attiva. Separare archivio contabile dai link operativi.')}
const extras=[
 ['public.cantieri','origine_preventivo_id','public.preventivi_cantiere.id'],
 ['public.rapportini','compilato_da_operaio_id','public.operai.id'],
 ['public.foto_cantiere','sopralluogo_id','public.sopralluoghi.id'],
 ['public.timbrature','operaio_id','public.operai.id'],
 ['public.timbrature','rapportino_id','public.rapportini.id'],
 ['public.preventivi_cantiere','sopralluogo_id','public.sopralluoghi.id'],
 ['public.spese_impresa','fattura_id','public.fatture_fornitori.id'],
 ['public.spese_impresa','riga_fattura_id','public.fatture_fornitori_righe.id'],
 ['public.note_sopralluogo','sopralluogo_id','public.sopralluoghi.id'],
 ['public.variante_fonti_visive','source_id','alias generated foto_cantiere_id/foto_sopralluogo_id'],
 ['public.variante_osservatore_analisi','user_id','auth.users.id'],
 ['artecna_rapportini.richieste','utente_id','identità chiamante portale; non proprietà utente da DELETE'],
 ['artecna_distruzione.contesto','user_id','auth.users.id'],
 ['public.foto_cantiere','rapportino_id','public.rapportini.id (testo)'],
 ['artecna_contabilita.attribuzioni_clienti','cantiere_id','public.cantieri.id'],
 ['artecna_contabilita.attribuzioni_clienti','fattura_id','public.fatture_emesse.id'],
 ['artecna_contabilita.attribuzioni_clienti','acconto_id','public.acconti_cantiere.id'],
 ['artecna_guardie.fatture_classificazione_richieste','fattura_id','public.fatture_fornitori.id'],
 ['artecna_distruzione.contesto','cantiere_id','public.cantieri.id'],
 ['artecna_distruzione.cleanup_storage','cantiere_id','public.cantieri.id'],
 ['artecna_rapportini.f3c3_capability','allegato_id','artecna_rapportini.allegati.id'],
 ['artecna_rapportini.f3c3_capability','foto_id','public.foto_cantiere.id'],
 ['public.quaderno_richiami_sopralluogo','sorgente_id','public.quaderno_progetti.id'],
 ['public.quaderno_richiami_sopralluogo','sopralluogo_id','public.sopralluoghi.id'],
 ['public.quaderno_richiami_sopralluogo','gestione_id','public.quaderno_gestioni.id'],
 ['public.quaderno_progetti','gestione_id','public.quaderno_gestioni.id'],
 ['public.note_sopralluogo','gestione_id','public.quaderno_gestioni.id'],
 ['public.quaderno_gestioni','progetto_id','public.quaderno_progetti.id'],
 ['public.quaderno_gestioni','destinazione_id','public.quaderno_progetti.id'],
 ['public.quaderno_gestioni','richiamo_id','public.quaderno_richiami_sopralluogo.id'],
 ['public.quaderno_gestioni','sopralluogo_id','public.sopralluoghi.id']
]
for(const [table,col,target]of extras){const r=tableMap.get(table);assert(!fk.some(k=>k.child===table&&k.child_columns.includes(col)),'Actually FK '+table+'.'+col);add(table,col,target,'relazione_logica_non_fk',r.ownership,r.azione,'Seguire solo ID canonico e guardie; riferimento a un padre globale non autorizza DELETE del padre.')}
saveCsv('cantiere-relazioni-logiche.csv',logical)
// Storage rows enumerate concrete fields, not guessed objects from file names.
const storage=[]
function file(table,fields,bucket,exclusive,note){const r=byName.get(table),cl=tableMap.get(table);assert(r);for(const col of fields.split(','))assert(s.columns.some(c=>c.relation===r.oid&&c.name===col),table+'.'+col);storage.push({tabella:table,campi:fields,bucket,ownership:cl.ownership,percorso:cl.percorso,condivisione:exclusive,nota:note})}
for(const n of ['preventivi_cantiere','foto_cantiere','materiali_cantiere','attrezzi_cantiere'])file('public.'+n,'file_path,file_url','preventivi nel producer legacy; URL da canonizzare','potenzialmente condiviso','prepara_cleanup_storage raccoglie solo file_path; file_url non è prova di esclusività')
file('public.variante_documenti','storage_path','preventivi nel producer legacy','potenzialmente condiviso','Ownership via variante; nessuna proprietà globale dei byte dedotta dal path')
file('artecna_rapportini.allegati','bucket,file_path,chiave_client_allegato','bucket; contratto rapportini-v1','identità canonica dedicata, riferimenti residui da verificare','rapportini/<cantiere>/<rapportino>/<chiave>.<ext>; includere prenotati/pending/lease, non solo finalizzati')
file('public.foto_cantiere','thumbnail_url,immagine_base64','URL o contenuto inline','potenzialmente condiviso','data: base64 non è oggetto Storage; URL cloud è riferimento candidato')
file('public.foto_sopralluogo','immagine_base64','URL/data URI; nessun bucket inferito','shared','Preservare fonte sopralluogo; il reader può interpretare URL: inventariare senza scaricare contenuto')
file('public.note_allegati','storage_path,url','preventivi (persistenza.ts)','shared','nota→sopralluogo; non proprietà del Cantiere')
file('public.quaderno_allegati','storage_bucket,storage_path,url','storage_bucket; quaderno-privato','shared','File di archivio personale, non cancellare tramite link Memory')
file('public.quaderno_copie_allegati','storage_bucket,storage_path','storage_bucket; quaderno-sopralluoghi','shared','Copia autonoma legata a nota/richiamo')
file('public.quaderno_progetti','disegni,checklist,analisi_ai','URI quaderno-storage:/quaderno-sopralluogo:','shared','Reader risolviSorgentiPrivate ricorre nell’intero JSON; URL e URI annidati non limitati al campo disegno')
file('public.note_sopralluogo','disegni,checklist,analisi_ai','preventivi o URI privato codificato','shared','Inventariare contenitori completi, senza ricavare ownership del file da un UUID testuale')
file('public.quaderno_richiami_sopralluogo','assets,documento,input_documento','quaderno-sopralluoghi / URI privato','shared','Manifest di copie e operazioni pendenti: riferimenti anche prima del completamento')
file('public.quaderno_gestioni','assets,documento','quaderno-privato o quaderno-sopralluoghi','shared','Il tipo operazione determina bucket; manifest e file pendenti impediscono cleanup prematuro')
file('public.fatture_emesse','pdf_url,xml_url','URL canonizzabile; nessun bucket fisso deducibile','contabile condiviso','Preservare documenti contabili; separare destinazione operativa')
file('public.variante_sorgenti','snapshot','eventuali riferimenti incorporati fonte','potenzialmente condiviso','Snapshot non prova proprietà della fonte; file_sha256/nome_file non sono object key')
file('public.economia_sorgenti','snapshot','eventuali riferimenti incorporati fonte','potenzialmente condiviso','Conservare la fonte esterna; registro futuro deve coprire riferimenti canonici nel JSON')
file('public.variante_osservatore_analisi','fonti,risultato','eventuali URL/snapshot incorporati','potenzialmente condiviso','Non confondere snapshot fonte con proprietà della foto')
file('public.preventivi_cantiere','json_voci_ai,provenienza_generazione','eventuali URL/snapshot incorporati','potenzialmente condiviso','Contenitori JSON da analizzare dal registry; nessun path inferito da nome_file')
file('artecna_distruzione.cleanup_storage','bucket,path','bucket','job candidato','Non fonte viva: candidato cleanup, da tenere distinto da reference count attivo')
for(const c of s.columns.filter(c=>['json','jsonb'].includes(c.type))){const r=rel.get(c.relation),table=full(r);if(!storage.some(x=>x.tabella===table&&x.campi.split(',').includes(c.name)))file(table,c.name,'eventuali URI/URL incorporati; nessun bucket inferito','potenzialmente condiviso','Contenitore JSON aggiuntivo censito conservativamente; non afferma presenza di file. Lo snapshot di una sorgente non conferisce proprietà dei byte.')}
saveCsv('cantiere-storage-production.csv',storage)
const custom=s.triggers.filter(t=>!t.internal),coreTriggers=custom.filter(t=>closure.has(t.relation))
const fnMap=new Map(s.functions.map(f=>[f.oid,f])),selected=new Set(coreTriggers.map(t=>t.function_oid))
for(const f of s.functions.filter(f=>/elimina_cantiere_definitivamente|inizia_contesto|contesto_valido|termina_contesto|manifest_cantiere|prepara_cleanup_storage|impronta_cleanup_storage|numero_fk_economia_rapportino|compat_foto|fk_rettifiche|preflight_dipendenze|preflight_eliminazione_cantiere|proteggi_origine|proteggi_truncate|nc_|materiali_fattura|verifica_riga_economia_rapportino/.test(f.name)))selected.add(f.oid)
let changed=true;while(changed){changed=false;for(const id of [...selected]){const source=fnMap.get(id)?.definition||'';for(const f of s.functions)if(!selected.has(f.oid)&&source.includes(f.schema+'.'+f.name+'(')){selected.add(f.oid);changed=true}}}
assert(coreTriggers.every(t=>fnMap.has(t.function_oid)),'Missing trigger source')
saveCsv('cantiere-protezioni-production.csv',[...selected].sort().map(id=>{const f=fnMap.get(id);return {firma:f.signature,owner:f.owner,security_definer:f.security_definer,config:JSON.stringify(f.config),acl:JSON.stringify(f.acl),source_md5:f.source_md5,file:'audit-production/functions/'+f.schema+'.'+f.name+'.'+f.oid+'.sql'}}))
const e2id=byName.get('public.economia_righe').oid,e2keys=['rapportino_prestazione_id','prestazione_revisione_acquisita','prestazione_snapshot']
for(const [name,type]of e2keys.map((n,i)=>[n,['uuid','bigint','jsonb'][i]])){const c=s.columns.find(c=>c.relation===e2id&&c.name===name);assert(c&&c.type===type&&!c.not_null&&c.default===null)}
for(const section of ['columns','constraints','indexes','relations'])for(const x of e[section]){const key=v=>v.oid||v.relation+':'+(v.name||v.table);assert.deepEqual(x,s[section].find(y=>key(x)===key(y)),'E2 snapshot drift '+section)}
const k=s.constraints.find(k=>k.name==='economia_righe_prestazione_fk'),u=s.constraints.find(k=>k.name==='economia_righe_prestazione_unique');assert(k&&u&&k.on_delete==='r'&&k.on_update==='a'&&k.validated&&!k.deferrable&&!k.deferred)
const differences=s.constraints.filter(k=>k.child_oid===e2id&&['economia_righe_origine_valore_check','economia_righe_origine_coerenza_check','economia_righe_analitiche_origine_check','economia_righe_prestazione_provenienza_check'].includes(k.name));assert(differences.length===4&&differences.every(k=>k.definition.includes('fattura_fornitore')))
const original=fs.readFileSync(path.resolve(root,'../../supabase/migrations/20261009_e2_economia_prestazioni_schema.sql'));assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'4152005d418653c8550dde379d56f018515ca8dfb16fe9c2718a806fbc59aed1')
const summary={input:a.validation,e2:'E2_PRESENTE_DIVERSA',reason:'Core E2 coincidente; quattro CHECK estesi semanticamente con fattura_fornitore',e2differences:differences,totalFK:fk.length,incomingFK:a.incomingFK,directFK:a.directFK,indirectFK:a.incomingFK-a.directFK,boundaryFK:a.boundaryFK,pertinentFK:a.incomingFK+a.boundaryFK,coreTables:closure.size,legacyNameRelations:a.legacy.length,logicalRelations:logical.length,logicalDefinition:`14 lookup nome + 26 contenitori JSON/snapshot + ${extras.length} archi ID senza FK; voci di inventario, non vincoli DB. Storage in inventario separato`,storageSources:storage.length,storageDefinition:'righe inventario di riferimenti diretti e contenitori potenziali; una riga può contenere più campi equivalenti/alternativi; non è un conteggio di file',coreProtectionTriggers:coreTriggers.length,coreTriggerFunctions:new Set(coreTriggers.map(t=>t.function_oid)).size,reviewHelpers:selected.size,allCustomTriggers:custom.length,allTriggerFunctions:new Set(custom.map(t=>t.function_oid)).size,consumer_storage_canonico:'NO',cycles:a.cycles,selfFK:fk.filter(k=>k.child_oid===k.parent_oid)}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({...summary,input:undefined,e2differences:undefined,selfFK:summary.selfFK.map(k=>k.name)},null,2))
