const {test}=require('node:test'),a=require('node:assert/strict')
const {uploadHarness,contestoUploadFotoCantiere,fotoNelCantiere}=require('./galleria.fixture.cjs')
const A={id:'00000003-1111-4111-8111-111111111111',nome:'SMOKE comune'},B={id:'00000004-1111-4111-8111-111111111111',nome:'SMOKE comune'}

test('upload Galleria reale: ID selezionato, nome legacy, un solo upload e stessi byte/path',async()=>{
 const h=uploadHarness({...A});a.equal(await h.run(),true);a.equal(h.uploads.length,1);a.equal(h.rows.length,1)
 const f=h.rows[0];a.equal(f.cantiere_id,A.id);a.equal(f.cantiere,A.nome);a.equal(f.file_path,h.uploads[0].path);a.equal(f.file_url,f.immagine_base64);a.equal(h.uploads[0].bytes,'synthetic-image');a.deepEqual(h.removed,[])
 a.equal(fotoNelCantiere(f,A,[A,B]),true);a.equal(fotoNelCantiere(f,B,[A,B]),false)
})
test('upload rifiutato prima di Storage se manca ID stabile, anche con nome uguale valido',async()=>{
 for(const c of [null,{nome:A.nome},{id:'invalid',nome:A.nome}]){const h=uploadHarness(c);a.equal(await h.run(),false);a.equal(h.uploads.length,0);a.equal(h.rows.length,0)}
})
test('cambio scheda durante upload: identità iniziale conservata, nessun lookup per nome',async()=>{
 const selected={...A};const h=uploadHarness(selected,{duringAuth:()=>Object.assign(selected,B)});a.equal(await h.run(),true);a.equal(h.rows[0].cantiere_id,A.id);a.equal(h.rows[0].cantiere,A.nome)
})
test('errore metadati: rollback solo del nuovo file caricato',async()=>{
 const h=uploadHarness(A,{insertError:true});a.equal(await h.run(),false);a.equal(h.rows.length,0);a.deepEqual(h.removed,[h.uploads[0].path])
})
test('legacy: visibile con nome univoco, esclusa su omonimia; nessuna associazione persistita',()=>{
 const old={cantiere:A.nome,cantiere_id:null};a.equal(fotoNelCantiere(old,A,[A]),true);a.equal(fotoNelCantiere(old,A,[A,B]),false);a.equal(fotoNelCantiere(old,B,[A,B]),false);a.equal(old.cantiere_id,null)
})
test('ID autorevole dopo rinomina e nome omonimo su ID estraneo',()=>{
 const f={cantiere:'Nome precedente',cantiere_id:A.id};a.equal(fotoNelCantiere(f,A,[A,B]),true);a.equal(fotoNelCantiere({...f,cantiere:A.nome},B,[A,B]),false)
 const snap=contestoUploadFotoCantiere(A);a.deepEqual(snap,{cantiere_id:A.id,cantiere:A.nome})
})
