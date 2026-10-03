// PostgreSQL isolato in memoria. Non accede a Supabase, ENV o dati reali.
// Dipendenza test: @electric-sql/pglite disponibile tramite NODE_PATH.
// node --test app/engines/economia/riconciliaProposteEconomia.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const root = path.resolve(__dirname, '../../..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261003_economia_riconciliazione_readonly.sql'), 'utf8')
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OP2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccd'
const RAP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const MAT = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const COL = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const USER = '11111111-1111-4111-8111-111111111111'
const labor = (changes = {}) => ({ proposta_id:'lavoro', tipo_riga:'manodopera', acquisizione:'manuale', data:'2026-09-21', operaio_id:OP, operaio_nome:'Mario', ora_inizio:'08:00', ora_fine:'13:00', pausa_min:0, ore:5, tariffa:null, ...changes })
const material = (changes = {}) => ({ proposta_id:'materiale', tipo_riga:'materiale', acquisizione:'file', data:'2026-09-21', descrizione:'Cemento', unita_misura:'kg', quantita:5, prezzo:0, ...changes })

test('Riconciliazione SQL read-only: contratto, classificazioni, ACL e immutabilità', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN;
      CREATE SCHEMA artecna_guardie;
      CREATE TABLE public.cantieri(id uuid PRIMARY KEY);
      CREATE TABLE public.utenti_cantiere(cantiere_id uuid,user_id uuid,ruolo text);
      CREATE TABLE public.operai(id uuid PRIMARY KEY,nome text);
      CREATE TABLE public.rapportini(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id),data date,operai text,ore text,materiali text,quantita_materiali text,costo_manodopera numeric);
      -- Nessuna FK: rispecchia il contratto storico verificato.
      CREATE TABLE public.timbrature(id uuid PRIMARY KEY,cantiere_id uuid,rapportino_id uuid,operaio_id uuid,operaio_nome text,data date,ora_entrata text,ora_uscita text,pausa_minuti integer,stato text);
      CREATE TABLE public.materiali_cantiere(id uuid PRIMARY KEY,cantiere_id uuid,data_documento date,descrizione text,quantita numeric,prezzo_unitario numeric);
      CREATE TABLE public.economia_raccolte(id uuid PRIMARY KEY,cantiere_id uuid,numero integer,stato text,data date,revisione bigint);
      CREATE TABLE public.economia_righe(id uuid PRIMARY KEY,raccolta_id uuid,ordine integer,tipo_riga text,descrizione text,unita_misura text,quantita numeric,prezzo_unitario numeric,dettagli_analitici jsonb);
      CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere WHERE user_id=$1 AND cantiere_id=$2 AND ruolo='owner') $$;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated,anon;
      INSERT INTO public.cantieri VALUES('${A}'),('${B}');
      INSERT INTO public.utenti_cantiere VALUES('${A}','${USER}','owner');
      INSERT INTO public.operai VALUES('${OP}','Mario'),('${OP2}','Mario');
      INSERT INTO public.rapportini VALUES('${RAP}','${A}','2026-09-21','Mario', '5','Cemento Portland','5 kg',100);
      INSERT INTO public.rapportini VALUES('${B}','${B}','2026-09-21','Mario', '5','Cemento','5 kg',100);
      INSERT INTO public.timbrature VALUES('${MAT}','${A}','${RAP}','${OP}','Mario','2026-09-21','08:00','13:00',0,'da rapportino');
      INSERT INTO public.materiali_cantiere VALUES('${MAT}','${A}','2026-09-21','Sabbia fine',10,2);
      INSERT INTO public.economia_raccolte VALUES('${COL}','${A}',3,'bozza','2026-09-21',1);
      INSERT INTO public.economia_righe VALUES('${B}','${COL}',1,'materiale','Calce','kg',5,NULL,'{"version":1,"operativo":{"data":"2026-09-21"}}');
      INSERT INTO public.economia_righe VALUES('${OP2}','${COL}',2,'manodopera','Manodopera — Mario','h',5,20,'{"version":1,"operativo":{"data":"2026-09-21","operaio":"Mario","ora_inizio":"08:00","ora_fine":"13:00","pausa_min":0}}');
    `)
    const tables = ['rapportini','timbrature','economia_righe','economia_raccolte','materiali_cantiere']
    const snapshot = async () => {
      const s = {}
      for (const table of tables) s[table] = (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]'::jsonb) AS v FROM public.${table} x`)).rows[0].v
      return s
    }
    const preMigration = await snapshot()
    await db.exec(migration)
    assert.deepEqual(await snapshot(), preMigration, 'Migration modifica dati esistenti')
    await db.query("SELECT set_config('test.user',$1,false)",[USER])
    const call = async (proposte, cantiere=A) => {
      const before = await snapshot()
      let response
      try {
        await db.exec('SET ROLE authenticated')
        response = (await db.query('SELECT public.riconcilia_proposte_economia($1::uuid,$2::jsonb) AS v',[cantiere,JSON.stringify(proposte)])).rows[0].v
      } finally {
        await db.exec('RESET ROLE')
        assert.deepEqual(await snapshot(),before,'La RPC ha modificato dati/revisioni')
      }
      assert.equal(response.version,1)
      assert.equal(response.cantiere_id,cantiere)
      for (const r of response.risultati) {
        assert.notEqual(r.esito,'gia_registrato')
        assert.equal(r.provenienza_verificata,null)
        assert(!JSON.stringify(r).includes('snapshot'))
      }
      return response.risultati
    }
    await t.test('manodopera senza candidati → nuovo',async()=>assert.equal((await call([labor({data:'2026-09-22'})]))[0].esito,'nuovo'))
    await t.test('prestazione Rapportino non riconciliata → possibile',async()=>{
      const r=(await call([labor({rapportino_id:RAP})]))[0]
      assert.equal(r.esito,'possibile_duplicato')
      assert(r.motivi.includes('prestazione_presente_rapportino_non_riconciliata'))
    })
    await t.test('stesso operaio/data, orari discordanti → possibile',async()=>{
      const r=(await call([labor({ora_inizio:'09:00',ora_fine:'14:00'})]))[0]
      assert.equal(r.esito,'possibile_duplicato')
      assert(r.candidati.some(c=>c.tipo_sorgente==='timbratura'&&c.differenze.includes('ora_inizio')))
    })
    await t.test('nome omonimo senza ID → mai certezza',async()=>{
      const r=(await call([labor({operaio_id:null})]))[0]
      assert.equal(r.esito,'possibile_duplicato'); assert(r.motivi.includes('operaio_identita_ambigua'))
    })
    await t.test('proposte duplicate nello stesso payload → entrambe segnalate',async()=>{
      const r=await call([labor({data:'2026-09-22',proposta_id:'a'}),labor({data:'2026-09-22',proposta_id:'b'})])
      assert(r.every(x=>x.esito==='possibile_duplicato'&&x.motivi.includes('proposta_duplicata_nel_payload')))
    })
    await t.test('materiale simile Rapportino → possibile',async()=>{
      const r=(await call([material()]))[0]; assert.equal(r.esito,'possibile_duplicato'); assert(r.motivi.includes('materiale_simile_rapportino'))
    })
    await t.test('materiale simile materiali_cantiere → possibile',async()=>{
      const r=(await call([material({descrizione:'Sabbia',materiale_cantiere_id:MAT})]))[0]
      assert.equal(r.esito,'possibile_duplicato'); assert(r.motivi.includes('materiale_simile_cantiere'))
    })
    await t.test('materiale senza candidati → nuovo',async()=>assert.equal((await call([material({descrizione:'Tubo rame'})]))[0].esito,'nuovo'))
    await t.test('materiale Economia in bozza con prezzo NULL → possibile',async()=>{
      const r=(await call([material({descrizione:'Calce'})]))[0]; assert.equal(r.esito,'possibile_duplicato'); assert(r.motivi.includes('materiale_simile_economia'))
    })
    await t.test('dati insufficienti → verifica non disponibile',async()=>assert.equal((await call([labor({data:null,ore:null,operaio_id:null,operaio_nome:null})]))[0].esito,'verifica_non_disponibile'))
    await t.test('più prestazioni stesso operaio/Rapportino → mai certezza',async()=>{
      await db.query("INSERT INTO public.timbrature VALUES($1,$2,$3,$4,'Mario','2026-09-21','14:00','16:00',0,'da rapportino')",[B,A,RAP,OP])
      try {
        const r=(await call([labor({rapportino_id:RAP})]))[0]
        assert.equal(r.esito,'possibile_duplicato')
        assert.equal(r.candidati.filter(c=>c.tipo_sorgente==='timbratura').length,2)
      } finally { await db.query('DELETE FROM public.timbrature WHERE id=$1',[B]) }
    })
    await t.test('rapportino inesistente/fuori cantiere → verifica non disponibile',async()=>{
      const r=(await call([labor({rapportino_id:B})]))[0]; assert.equal(r.esito,'verifica_non_disponibile'); assert(r.motivi.includes('rapportino_assente_o_fuori_cantiere'))
    })
    await t.test('operaio inesistente → verifica non disponibile',async()=>assert.equal((await call([labor({operaio_id:B})]))[0].esito,'verifica_non_disponibile'))
    await t.test('ID operaio prioritario rispetto al nome',async()=>{
      const r=(await call([labor({data:'2026-09-22',operaio_nome:'Altro nome'})]))[0]
      assert.equal(r.esito,'possibile_duplicato'); assert(r.motivi.includes('operaio_nome_id_discordanti'))
    })
    await t.test('ACL: cantiere non autorizzato e JWT assente rifiutati',async()=>{
      await assert.rejects(()=>call([material()],B),e=>e.code==='42501')
      await db.query("SELECT set_config('test.user','',false)")
      await assert.rejects(()=>call([material()]),e=>e.code==='42501')
      await db.query("SELECT set_config('test.user',$1,false)",[USER])
    })
    await t.test('contratto invalido rifiutato, non degradato a nuovo',async()=>{
      for(const p of [{},[labor({proposta_id:''})],[labor({operaio_id:'non-uuid'})],[labor({data:'2026-02-30'})],[material({quantita:-1})],[labor(),labor()]])
        await assert.rejects(()=>call(p),e=>e.code==='22023')
    })
    await t.test('anon/helper privato e owner senza scrittura',async()=>{
      const a=(await db.query("SELECT has_function_privilege('anon','public.riconcilia_proposte_economia(uuid,jsonb)','EXECUTE') a,has_function_privilege('authenticated','public.economia_testo_confronto(text)','EXECUTE') h")).rows[0]
      assert.equal(a.a,false);assert.equal(a.h,false)
      await db.exec('SET ROLE artecna_economia_riconcilia_rpc')
      await assert.rejects(()=>db.exec('UPDATE public.economia_raccolte SET revisione=99'),e=>e.code==='42501')
      await db.exec('RESET ROLE')
    })
    await t.test('riferimento timbratura orfano senza FK → non nuovo',async()=>{
      await db.query('UPDATE public.timbrature SET rapportino_id=$1 WHERE id=$2',[B,MAT])
      const r=(await call([labor()]))[0]
      assert.equal(r.esito,'verifica_non_disponibile'); assert(r.motivi.includes('riferimenti_timbratura_incoerenti'))
      await db.query('UPDATE public.timbrature SET rapportino_id=$1 WHERE id=$2',[RAP,MAT])
    })
    await t.test('operaio timbratura orfano senza FK → non nuovo',async()=>{
      await db.query('UPDATE public.timbrature SET operaio_id=$1 WHERE id=$2',[B,MAT])
      try {
        const r=(await call([labor({operaio_id:null})]))[0]
        assert.equal(r.esito,'verifica_non_disponibile')
        assert(r.motivi.includes('riferimenti_timbratura_incoerenti'))
      } finally { await db.query('UPDATE public.timbrature SET operaio_id=$1 WHERE id=$2',[OP,MAT]) }
    })
    await t.test('lettura senza privilegio → non nuovo',async()=>{
      await db.exec('REVOKE SELECT ON public.timbrature FROM artecna_economia_riconcilia_rpc')
      assert.equal((await call([labor()]))[0].esito,'verifica_non_disponibile')
      await db.exec('GRANT SELECT ON public.timbrature TO artecna_economia_riconcilia_rpc')
    })
    assert.deepEqual(await snapshot(),preMigration,'Stato persistente complessivo modificato')
  } finally { await db.close() }
})
