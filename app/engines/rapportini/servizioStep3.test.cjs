// PostgreSQL reale in memoria: nessun ENV, rete o database remoto.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { PGlite } = require('@electric-sql/pglite')
const root = path.resolve(__dirname, '../../..')
const step2 = fs.readFileSync(path.join(root, 'supabase/migrations/20261003_rapportino_prestazioni_step2.sql'), 'utf8')
const step3 = fs.readFileSync(path.join(root, 'supabase/migrations/20261003_rapportino_servizio_step3.sql'), 'utf8')
const {fixture,A,B,OP,OP2,RAP,V,USER,TOKEN}=require('./fixtureStep3.cjs')
const row=(changes={})=>({prestazione_id:null,chiave_client:'riga-a',operaio_id:OP,ora_inizio:'07:30',ora_fine:'12:30',pausa_minuti:0,lavoro_in_economia:false,variante_id:null,...changes})
const payload=(changes={})=>({versione_contratto:1,richiesta_id:randomUUID(),rapportino_id:null,revisione_attesa:null,cantiere_id:A,data:'2026-10-03',prestazioni:{nuove:[row()],aggiornate:[],rimosse:[]},...changes})
const edit=(r,ops,changes={})=>payload({rapportino_id:r.rapportino_id,revisione_attesa:r.revisione,prestazioni:{nuove:[],aggiornate:[],rimosse:[],...ops},...changes})
const updated=(r,changes={})=>{const {ore,revisione,rimossa_at,operaio_nome,...x}=r.prestazioni[0]; return {...x,...changes}}


test('STEP 3: servizio unico, sessioni, atomicità e costo storico', async t=>{
  const db=new PGlite()
  try {
    await db.exec(fixture)
    await db.exec(step2)
    const before=(await db.query('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP])).rows[0].v
    await db.exec(step3)
    assert.deepEqual((await db.query('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP])).rows[0].v,before)
    await db.query('SELECT public.crea_sessione_rapportino($1,$2)',['1234',TOKEN])
    const q=async(sql,params=[]) => (await db.query(sql,params)).rows
    const call=async(p,token=null)=>(await q('SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) result',[JSON.stringify(p),token]))[0].result
    const saved=async(r)=>(await q('SELECT * FROM public.rapportini WHERE id=$1',[r.rapportino_id]))[0]
    const rates=async()=>(await q('SELECT costo_orario_interno_storico::text rate FROM public.rapportino_prestazioni ORDER BY created_at,id')).map(x=>Number(x.rate))
    const reject=async(fn,code,pattern)=>{
      await db.exec('SAVEPOINT expected_error')
      await assert.rejects(fn,e=>e.code===code && (!pattern || pattern.test(e.message)))
      await db.exec('ROLLBACK TO SAVEPOINT expected_error; RELEASE SAVEPOINT expected_error')
    }
    const run=async(name,fn)=>t.test(name,async()=>{
      await db.exec('BEGIN')
      await db.query("SELECT set_config('test.user',$1,true)",[USER])
      try { await fn() } finally { await db.exec('ROLLBACK') }
    })
    await run('creazione atomica: testata, due prestazioni, due timbrature',async()=>{
      const r=await call(payload({prestazioni:{nuove:[row(),row({chiave_client:'riga-b',operaio_id:OP2})],aggiornate:[],rimosse:[]}}))
      assert.equal(r.prestazioni.length,2)
      assert.equal((await q('SELECT count(*)::int n FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id]))[0].n,2)
      const h=await saved(r); assert.equal(h.costo_manodopera,250); assert.equal(Number(h.ore),10); assert.equal(h.numero_presenti,'2'); assert.equal(Number(h.ore_per_operaio),5)
    })
    await run('errore seconda prestazione: rollback testata, righe, timbrature e richiesta',async()=>{
      await reject(()=>call(payload({prestazioni:{nuove:[row(),row({chiave_client:'b',ora_fine:'06:00'})],aggiornate:[],rimosse:[]}})),'22023')
      assert.equal((await q('SELECT count(*)::int n FROM public.rapportini'))[0].n,1)
      assert.deepEqual(await rates(),[])
      assert.equal((await q('SELECT count(*)::int n FROM artecna_rapportini.richieste'))[0].n,0)
      assert.equal((await q('SELECT count(*)::int n FROM public.timbrature'))[0].n,1)
    })
    await run('modifica conserva UUID, chiave client e sincronizza proiezione',async()=>{
      const r=await call(payload()),r2=await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}))
      assert.equal(r2.prestazioni[0].prestazione_id,r.prestazioni[0].prestazione_id)
      assert.equal(r2.prestazioni[0].chiave_client,'riga-a')
      const timers=await q('SELECT * FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id])
      assert.equal(timers.length,1); assert.equal(timers[0].prestazione_rapportino_id,r.prestazioni[0].prestazione_id)
      assert.equal(timers[0].ora_uscita,'13:30'); assert.equal(timers[0].stato,'da rapportino')
    })
    await run('due intervalli stesso operaio: UUID distinti, due proiezioni, un presente',async()=>{
      const r=await call(payload({prestazioni:{nuove:[row(),row({chiave_client:'pomeriggio',ora_inizio:'14:00',ora_fine:'16:00'})],aggiornate:[],rimosse:[]}}))
      assert.notEqual(r.prestazioni[0].prestazione_id,r.prestazioni[1].prestazione_id)
      assert.equal((await saved(r)).numero_presenti,'1')
      assert.equal((await q('SELECT count(*)::int n FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id]))[0].n,2)
    })
    await run('costo Anagrafica 20: fotografia 20 e totale server 100',async()=>{
      const r=await call(payload()); assert.deepEqual(await rates(),[20]); assert.equal((await saved(r)).costo_manodopera,100)
      assert(!JSON.stringify(r).includes('costo')); assert(!JSON.stringify(r).includes('tariffa'))
    })
    await run('costo Anagrafica NULL: errore esplicito e nessuna testata',async()=>{
      await db.exec(`UPDATE public.operai SET costo_orario=NULL WHERE id='${OP}'`)
      await reject(()=>call(payload()),'22023',/Costo orario operaio non valorizzato/)
      assert.deepEqual(await rates(),[]); assert.equal((await q('SELECT count(*)::int n FROM public.rapportini'))[0].n,1)
    })
    await run('costo Anagrafica zero intenzionale consentito',async()=>{
      await db.exec(`UPDATE public.operai SET costo_orario=0 WHERE id='${OP}'`)
      const r=await call(payload()); assert.deepEqual(await rates(),[0]); assert.equal((await saved(r)).costo_manodopera,0)
    })
    await run('INSERT SQL omette costo: BEFORE INSERT lo assegna prima del NOT NULL',async()=>{
      const r=await call(payload({prestazioni:{nuove:[],aggiornate:[],rimosse:[]}}))
      assert.equal((await q("SELECT attnotnull FROM pg_attribute WHERE attrelid='public.rapportino_prestazioni'::regclass AND attname='costo_orario_interno_storico'"))[0].attnotnull,true)
      const insert=key=>q(`INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,pausa_minuti)
        VALUES($1,$2,$3,'07:30','12:30',0) RETURNING costo_orario_interno_storico::text costo`,[r.rapportino_id,OP,key])
      assert.equal(Number((await insert('omesso-positivo'))[0].costo),20)
      await db.exec(`UPDATE public.operai SET costo_orario=0 WHERE id='${OP}'`)
      assert.equal(Number((await insert('omesso-zero'))[0].costo),0)
      await db.exec(`UPDATE public.operai SET costo_orario=NULL WHERE id='${OP}'`)
      await reject(()=>insert('omesso-null'),'22023',/Costo orario operaio non valorizzato/)
      assert.equal((await q('SELECT count(*)::int n FROM public.rapportino_prestazioni WHERE rapportino_id=$1',[r.rapportino_id]))[0].n,2)
      await reject(()=>q(`INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,costo_orario_interno_storico)
        VALUES($1,$2,'costo-fornito','07:30','12:30',20)`,[r.rapportino_id,OP]),'22023',/assegnato esclusivamente dal server/)
    })
    await run('client non decide ore, costo, fotografia, tariffa o compilatore',async()=>{
      for(const field of ['ore','costo_orario','costo_orario_interno_storico','tariffa_cliente','stato_economia']) {
        await reject(()=>call(payload({prestazioni:{nuove:[row({[field]:999})],aggiornate:[],rimosse:[]}})),'22023')
      }
      for(const field of ['costo_manodopera','compilato_da_operaio_id']) await reject(()=>call(payload({[field]:OP2})),'22023')
      await reject(()=>call(payload({documento:{costo_manodopera:999}})),'22023')
    })
    await run('Anagrafica 20 poi 25: esistente resta 20, nuova usa 25',async()=>{
      const r=await call(payload())
      await db.exec(`UPDATE public.operai SET costo_orario=25 WHERE id='${OP}'`)
      await call(edit(r,{nuove:[row({chiave_client:'nuova',ora_inizio:'14:00',ora_fine:'16:00'})]}))
      assert.deepEqual((await rates()).sort((a,b)=>a-b),[20,25])
    })
    await run('modifica 5→6 ore conserva storico 20 e produce costo 120',async()=>{
      const r=await call(payload())
      await db.exec(`UPDATE public.operai SET costo_orario=25 WHERE id='${OP}'`)
      const r2=await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}))
      assert.deepEqual(await rates(),[20]); assert.equal((await saved(r2)).costo_manodopera,120)
    })
    await run('Anagrafica diventata NULL non impedisce correzione orari con fotografia esistente',async()=>{
      const r=await call(payload())
      await db.exec(`UPDATE public.operai SET costo_orario=NULL WHERE id='${OP}'`)
      const r2=await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}))
      assert.deepEqual(await rates(),[20]); assert.equal((await saved(r2)).costo_manodopera,120)
    })
    await run('stessa chiave client con nuova richiesta conserva UUID e fotografia dopo cambio Anagrafica',async()=>{
      const r=await call(payload())
      await db.exec(`UPDATE public.operai SET costo_orario=25 WHERE id='${OP}'`)
      const r2=await call(edit(r,{nuove:[row()]}))
      assert.equal(r2.prestazioni.length,1); assert.equal(r2.prestazioni[0].prestazione_id,r.prestazioni[0].prestazione_id)
      assert.deepEqual(await rates(),[20])
    })
    await run('rimozione conserva storico, azzera costo e rimuove soltanto proiezione',async()=>{
      const r=await call(payload()),r2=await call(edit(r,{rimosse:[r.prestazioni[0].prestazione_id]}))
      assert.deepEqual(await rates(),[20]); assert(r2.prestazioni[0].rimossa_at)
      const h=await saved(r2); assert.equal(h.costo_manodopera,0); assert.equal(h.numero_presenti,'0')
      assert.equal((await q('SELECT count(*)::int n FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id]))[0].n,0)
    })
    await run('retry dopo risposta persa: stessa testata, UUID, tariffa ed esito senza seconda timbratura',async()=>{
      const p=payload(),r=await call(p)
      const timers=await q('SELECT id FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id])
      await db.exec(`UPDATE public.operai SET costo_orario=25 WHERE id='${OP}'`)
      assert.deepEqual(await call(p),r); assert.deepEqual(await rates(),[20])
      assert.deepEqual(await q('SELECT id FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id]),timers)
      assert.equal(p.rapportino_id,null)
      assert.equal((await q('SELECT count(*)::int n FROM public.rapportini WHERE cantiere_id=$1 AND data=$2',[A,p.data]))[0].n,1)
      assert.equal((await q('SELECT count(*)::int n FROM public.rapportino_prestazioni WHERE rapportino_id=$1',[r.rapportino_id]))[0].n,1)
    })
    await run('stesso richiesta_id con payload differente: conflitto',async()=>{
      const p=payload(); await call(p); await reject(()=>call({...p,documento:{note:'diverso'}}),'PR409')
    })
    await run('revisione aggregata obsoleta: nessuna scrittura parziale',async()=>{
      const r=await call(payload()); await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}))
      await reject(()=>call(edit(r,{aggiornate:[updated(r,{ora_fine:'14:30'})]})),'PR412')
      assert.equal((await saved(r)).costo_manodopera,120)
    })
    await run('desktop e mobile condividono revisione: modifica mobile invalida lettura desktop',async()=>{
      const r=await call(payload())
      await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}),TOKEN)
      await reject(()=>call(edit(r,{aggiornate:[updated(r,{ora_fine:'14:30'})]})),'PR412')
      assert.equal((await saved(r)).costo_manodopera,120)
    })
    await run('batch con secondo costo NULL: rollback completo inclusa prima fotografia',async()=>{
      await db.exec(`UPDATE public.operai SET costo_orario=NULL WHERE id='${OP2}'`)
      await reject(()=>call(payload({prestazioni:{nuove:[row(),row({chiave_client:'b',operaio_id:OP2})],aggiornate:[],rimosse:[]}})),'22023')
      assert.deepEqual(await rates(),[]); assert.equal((await q('SELECT count(*)::int n FROM public.rapportini'))[0].n,1)
    })
    await run('fotografia immutabile anche sotto accesso amministrativo diretto',async()=>{
      await call(payload()); await reject(()=>db.exec('UPDATE public.rapportino_prestazioni SET costo_orario_interno_storico=25'),'PR403')
      assert.deepEqual(await rates(),[20])
    })
    await run('pausa determina ore e costo server, passaggio mezzanotte rifiutato',async()=>{
      const r=await call(payload({prestazioni:{nuove:[row({pausa_minuti:30})],aggiornate:[],rimosse:[]}}))
      assert.equal(Number(r.prestazioni[0].ore),4.5); assert.equal((await saved(r)).costo_manodopera,90)
      await reject(()=>call(edit(r,{nuove:[row({chiave_client:'notte',ora_inizio:'23:00',ora_fine:'02:00'})]})),'22023')
    })
    await run('sessione assente e falsa: rifiuto',async()=>{
      await db.query("SELECT set_config('test.user','',true)")
      await reject(()=>call(payload()),'42501'); await reject(()=>call(payload(),'ff'.repeat(32)),'42501')
    })
    await run('sessione scaduta e revocata: rifiuto',async()=>{
      await db.exec("UPDATE artecna_rapportini.sessioni_portale SET created_at=now()-interval '2 days',scade_at=now()-interval '1 day'")
      await reject(()=>call(payload(),TOKEN),'42501')
      await db.exec("UPDATE artecna_rapportini.sessioni_portale SET scade_at=now()+interval '1 day',revocata_at=now()")
      await reject(()=>call(payload(),TOKEN),'42501')
    })
    await run('operaio compilatore sospeso o non abilitato: sessione invalidata',async()=>{
      await db.exec(`UPDATE public.operai SET stato='sospeso' WHERE id='${OP}'`)
      await reject(()=>call(payload(),TOKEN),'42501')
      await db.exec(`UPDATE public.operai SET stato='attivo',accesso_portale=false WHERE id='${OP}'`)
      await reject(()=>call(payload(),TOKEN),'42501')
    })
    await run('portale: soltanto cantieri aperti; desktop: owner obbligatorio',async()=>{
      await reject(()=>call(payload({cantiere_id:B}),TOKEN),'42501')
      await reject(()=>call(payload({cantiere_id:B})),'42501')
      await db.exec(`UPDATE public.cantieri SET lavori_conclusi=NULL WHERE id='${A}'`)
      const r=await call(payload(),TOKEN); assert.equal((await saved(r)).compilato_da_operaio_id,OP)
    })
    await run('lettura Varianti: DTO minimo, selezionabile bozza, niente economia amministrativa',async()=>{
      const list=(await q('SELECT public.varianti_rapportino_portale($1,$2) v',[TOKEN,A]))[0].v
      assert.deepEqual(list,[{id:V,numero:1,etichetta:'Variante A',selezionabile:true}])
      assert.deepEqual(Object.keys(list[0]).sort(),['etichetta','id','numero','selezionabile'])
      await reject(()=>q('SELECT public.varianti_rapportino_portale($1,$2)',[TOKEN,B]),'42501')
    })
    await run('cinque stati Variante: DTO selezionabile solo bozza o proposta',async()=>{
      for(const stato of ['bozza','proposta','approvata','rifiutata','annullata']) {
        await db.query('UPDATE public.varianti_cantiere SET stato=$1 WHERE id=$2',[stato,V])
        const list=(await q('SELECT public.varianti_rapportino_portale($1,$2) v',[TOKEN,A]))[0].v
        assert.equal(list[0].selezionabile,['bozza','proposta'].includes(stato))
        assert.deepEqual(Object.keys(list[0]).sort(),['etichetta','id','numero','selezionabile'])
      }
    })
    for(const stato of ['bozza','proposta','approvata','rifiutata','annullata']) {
      await run(`nuovo collegamento Variante ${stato}: regola server`,async()=>{
        await q('UPDATE public.varianti_cantiere SET stato=$1 WHERE id=$2',[stato,V])
        const p=payload({prestazioni:{nuove:[row({lavoro_in_economia:true,variante_id:V})],aggiornate:[],rimosse:[]}})
        if(['bozza','proposta'].includes(stato)) {
          const r=await call(p,TOKEN); assert.equal(r.prestazioni[0].variante_id,V)
        } else {
          await reject(()=>call(p,TOKEN),'22023',/bozza o proposta/)
          assert.equal((await q('SELECT count(*)::int n FROM public.rapportini'))[0].n,1)
          assert.deepEqual(await rates(),[])
          assert.equal((await q('SELECT count(*)::int n FROM public.timbrature'))[0].n,1)
        }
      })
      await run(`cambio destinazione Variante ${stato}: regola server`,async()=>{
        const r=await call(payload({prestazioni:{nuove:[row({lavoro_in_economia:true,variante_id:V})],aggiornate:[],rimosse:[]}}))
        const destination=randomUUID()
        await q("INSERT INTO public.varianti_cantiere(id,cantiere_id,titolo,stato) VALUES($1,$2,'Destinazione',$3)",[destination,A,stato])
        const p=edit(r,{aggiornate:[updated(r,{variante_id:destination})]})
        if(['bozza','proposta'].includes(stato)) {
          const next=await call(p); assert.equal(next.prestazioni[0].variante_id,destination)
          assert.equal(next.prestazioni[0].prestazione_id,r.prestazioni[0].prestazione_id)
        } else {
          await reject(()=>call(p),'22023',/bozza o proposta/)
          assert.equal((await q('SELECT variante_id FROM public.rapportino_prestazioni'))[0].variante_id,V)
          assert.equal((await saved(r)).revisione_prestazioni,r.revisione)
        }
      })
    }
    for(const stato of ['approvata','rifiutata','annullata']) {
      await run(`collegamento esistente Variante ${stato}: conservazione, visibilità, modifica e retry`,async()=>{
        const p=payload({prestazioni:{nuove:[row({lavoro_in_economia:true,variante_id:V})],aggiornate:[],rimosse:[]}})
        const r=await call(p)
        const original=(await q('SELECT to_jsonb(p) v FROM public.rapportino_prestazioni p'))[0].v
        await q('UPDATE public.varianti_cantiere SET stato=$1 WHERE id=$2',[stato,V])
        assert.deepEqual((await q('SELECT to_jsonb(p) v FROM public.rapportino_prestazioni p'))[0].v,original)
        assert.deepEqual(await call(p),r)
        const list=(await q('SELECT public.varianti_rapportino_portale($1,$2) v',[TOKEN,A]))[0].v
        assert.equal(list.find(x=>x.id===V).selezionabile,false)
        const next=await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}))
        assert.equal(next.prestazioni[0].prestazione_id,r.prestazioni[0].prestazione_id)
        assert.equal(next.prestazioni[0].variante_id,V)
        assert.deepEqual(await rates(),[20])
        const same=await call(edit(next,{nuove:[row({lavoro_in_economia:true,variante_id:V,ora_fine:'13:30'})]}))
        assert.equal(same.prestazioni.length,1)
        await reject(()=>call(edit(same,{nuove:[row({chiave_client:'nuova',lavoro_in_economia:true,variante_id:V})]})),'22023')
      })
    }
    await run('legacy invariato: nessuna conversione automatica o ricostruzione',async()=>{
      await reject(()=>call(payload({rapportino_id:RAP,revisione_attesa:0,data:'2026-09-21'})),'PR409')
      assert.deepEqual((await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP]))[0].v,before)
    })
    await run('Economia resta invariata e tariffa cliente indipendente dal costo interno',async()=>{
      const r=await call(payload({prestazioni:{nuove:[row({lavoro_in_economia:true,variante_id:V})],aggiornate:[],rimosse:[]}}))
      assert.equal((await saved(r)).costo_manodopera,100)
      assert.equal(Number((await q('SELECT importo_delta_approvato v FROM public.varianti_cantiere'))[0].v),175)
      assert.equal(Number((await q('SELECT quantita*prezzo_unitario v FROM public.economia_righe'))[0].v),175)
      assert.equal(Number((await q('SELECT revisione v FROM public.economia_raccolte'))[0].v),3)
    })
    await run('sessione contiene solo digest e non PIN; risposta accesso compatibile',async()=>{
      const data=(await q('SELECT public.crea_sessione_rapportino($1,$2) v',['5678','cd'.repeat(32)]))[0].v
      assert.equal(data.operaio.id,OP2); assert.deepEqual(Object.keys(data).sort(),['cantieri','operai','operaio'])
      const cols=(await q("SELECT attname FROM pg_attribute WHERE attrelid='artecna_rapportini.sessioni_portale'::regclass AND attnum>0 AND NOT attisdropped")).map(x=>x.attname)
      assert(!cols.includes('pin')); assert(!cols.includes('token')); assert(cols.includes('token_sha256'))
      await reject(()=>q('SELECT public.crea_sessione_rapportino($1,$2)',['errato','ef'.repeat(32)]),'42501')
    })
    await run('ACL: niente DML client, niente helper interni o membership/BYPASSRLS',async()=>{
      for(const role of ['anon','authenticated']) {
        for(const table of ['public.rapportino_prestazioni','artecna_rapportini.richieste','artecna_rapportini.sessioni_portale']) {
          assert.equal((await q('SELECT has_table_privilege($1,$2,$3) v',[role,table,'SELECT,INSERT,UPDATE,DELETE']))[0].v,false)
        }
        assert.equal((await q("SELECT pg_has_role($1,'artecna_rapportini_rpc','MEMBER') v",[role]))[0].v,false)
        assert.equal((await q("SELECT has_function_privilege($1,'artecna_rapportini.applica_prestazioni_rapportino(jsonb)','EXECUTE') v",[role]))[0].v,false)
      }
      assert.equal((await q("SELECT rolbypassrls v FROM pg_roles WHERE rolname='artecna_rapportini_rpc'"))[0].v,false)
    })
    await run('API SQL: authenticated può usare solo writer completo; anon rifiutato',async()=>{
      await db.exec('SET LOCAL ROLE authenticated'); const r=await call(payload()); assert.equal(r.prestazioni.length,1)
      await db.exec('RESET ROLE; SET LOCAL ROLE anon')
      await reject(()=>call(payload()),'42501'); await db.exec('RESET ROLE')
    })
    await run('legacy diretto non può alterare testata/proiezioni strutturate',async()=>{
      const r=await call(payload())
      await db.exec('SET LOCAL ROLE authenticated')
      await reject(()=>db.query('UPDATE public.rapportini SET costo_manodopera=999 WHERE id=$1',[r.rapportino_id]),'PR403')
      await reject(()=>db.query('DELETE FROM public.rapportini WHERE id=$1',[r.rapportino_id]),'PR403')
      await reject(()=>db.query('DELETE FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id]),'PR403')
      await db.exec(`UPDATE public.rapportini SET ore='6' WHERE id='${RAP}'`)
      await db.exec('RESET ROLE')
    })
    await run('proiezione unica per UUID; stato obbligatorio; inserimento legacy nel strutturato vietato',async()=>{
      const r=await call(payload())
      await reject(()=>db.query("UPDATE public.timbrature SET stato=NULL WHERE rapportino_id=$1",[r.rapportino_id]),'23514')
      await reject(()=>db.query(`INSERT INTO public.timbrature(prestazione_rapportino_id,rapportino_id,operaio_id,cantiere_id,data,ora_entrata,ora_uscita,pausa_minuti,stato)
        VALUES($1,$2,$3,$4,'2026-10-03','07:30','12:30',0,'da rapportino')`,[r.prestazioni[0].prestazione_id,r.rapportino_id,OP,A]),'23505')
      await db.exec('SET LOCAL ROLE authenticated')
      await reject(()=>db.query("INSERT INTO public.timbrature(rapportino_id,data,stato) VALUES($1,'2026-10-03','da rapportino')",[r.rapportino_id]),'PR403')
      await db.exec('RESET ROLE')
    })
    await run('omissione non cancella; sole note incrementano revisione e retry la conserva',async()=>{
      const r=await call(payload()),p=edit(r,{}, {documento:{note:'aggiornata'}}),r2=await call(p)
      assert.equal(r2.prestazioni.length,1); assert.equal(r2.prestazioni[0].rimossa_at,null)
      assert.equal(r2.revisione,r.revisione+1); assert.deepEqual(await call(p),r2)
    })
    for(const documento of [{note:'Nuova nota'},{materiali:'Malta'},{quantita_materiali:'3 sacchi'},
      {note:'Nota',materiali:'Malta',quantita_materiali:'3 sacchi'}]) {
      await run(`documento ${Object.keys(documento).join('+')}: una revisione e retry stabile`,async()=>{
        const r=await call(payload()),p=edit(r,{}, {documento}),r2=await call(p)
        assert.equal(r2.revisione,r.revisione+1)
        assert.equal(Number((await saved(r2)).revisione_prestazioni),r2.revisione)
        for(const [key,value] of Object.entries(documento)) assert.equal(r2.documento[key],value)
        assert.deepEqual(await call(p),r2)
        assert.equal(Number((await saved(r2)).revisione_prestazioni),r2.revisione)
      })
    }
    await run('modifica documento e prestazione insieme: revisione incrementata una sola volta',async()=>{
      const r=await call(payload()),r2=await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]},
        {documento:{note:'Nota',materiali:'Malta',quantita_materiali:'3 sacchi'}}))
      assert.equal(r2.revisione,r.revisione+1)
      assert.equal(Number((await saved(r2)).revisione_prestazioni),r2.revisione)
    })
    await run('creazione/modifica/rimozione strutturata non cambia testata e timbratura storiche',async()=>{
      const storico=(await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP]))[0].v
      const timbratura=(await q('SELECT to_jsonb(t) v FROM public.timbrature t WHERE id=$1',[OP]))[0].v
      const r=await call(payload()),r2=await call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]}))
      await call(edit(r2,{rimosse:[r.prestazioni[0].prestazione_id]}))
      assert.deepEqual((await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE id=$1',[RAP]))[0].v,storico)
      assert.deepEqual((await q('SELECT to_jsonb(t) v FROM public.timbrature t WHERE id=$1',[OP]))[0].v,timbratura)
    })
    await run('errore proiezione timbrature causa rollback di aggiornamento e idempotenza',async()=>{
      const r=await call(payload())
      await db.exec(`CREATE FUNCTION public.test_fail_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'projection fail'; END $$;
        CREATE TRIGGER test_fail_projection BEFORE INSERT ON public.timbrature FOR EACH ROW EXECUTE FUNCTION public.test_fail_projection()`)
      await reject(()=>call(edit(r,{aggiornate:[updated(r,{ora_fine:'13:30'})]})),'P0001')
      assert.equal((await saved(r)).costo_manodopera,100)
      assert.equal((await q('SELECT ora_uscita FROM public.timbrature WHERE rapportino_id=$1',[r.rapportino_id]))[0].ora_uscita,'12:30')
    })
  } finally { await db.close() }
})

test('STEP 3 installabile come postgres NOSUPERUSER senza ownership/SET ROLE aggiuntivi',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`CREATE ROLE test_supervisor SUPERUSER NOLOGIN; SET SESSION AUTHORIZATION test_supervisor;
      ALTER ROLE postgres RENAME TO test_bootstrap;
      CREATE ROLE postgres NOSUPERUSER CREATEROLE NOLOGIN NOBYPASSRLS NOINHERIT;
      ALTER SCHEMA public OWNER TO postgres`)
    const database=(await db.query('SELECT current_database() d')).rows[0].d.replaceAll('"','""')
    await db.exec(`GRANT CREATE ON DATABASE "${database}" TO postgres; SET SESSION AUTHORIZATION postgres`)
    await db.exec(fixture); await db.exec(step2); await db.exec(step3)
    assert.equal((await db.query("SELECT pg_has_role('postgres','artecna_rapportini_rpc','SET') v")).rows[0].v,false)
    assert(!/ALTER\s+FUNCTION[\s\S]*?OWNER\s+TO/i.test(step3))
    assert(!/^\s*(?:SET\s+(?:LOCAL\s+)?ROLE|GRANT\s+artecna_rapportini_rpc\s+TO)\b/im.test(step3))
  } finally { await db.close() }
})
