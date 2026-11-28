import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import {openFixture} from './fixture.mjs'
const load=createRequire(import.meta.url),{fixture}=load('../riconciliazione-unificata/fixture.cjs')
const sql=fs.readFileSync('supabase/migrations/20261128000100_bluenext_integrato.sql','utf8')
const lf=s=>s.replaceAll('\r\n','\n'),crlf=s=>lf(s).replaceAll('\n','\r\n'),mixed=s=>lf(s).split('\n').map((line,i)=>line+(i%2?'\r':'')).join('\n')
const gate=sql.slice(sql.indexOf('DO $gate$'),sql.indexOf('END $gate$;')+11)
test('strict CRLF/LF gate: matching whole bodies only, no whitespace or content weakening',async t=>{
 const db=await fixture()
 try{
  const definition=(await db.admin.query("SELECT pg_get_functiondef('artecna_contabilita.documento_riconciliazione(uuid,jsonb)'::regprocedure) AS x")).rows[0].x
  for(const [sourceName,source]of [['LF',lf],['CRLF',crlf],['MIXED',mixed]]){
   await db.admin.query(source(definition))
   for(const [transportName,transport]of [['LF',lf],['CRLF',crlf],['MIXED',mixed]])await t.test(sourceName+' stored / '+transportName+' submitted',()=>db.admin.query(transport(gate)))
  }
  for(const changed of [definition.replace('STOP_DOCUMENTO_RETTIFICATO','STOP_DOCUMENTO_REALMENTE_DIVERSO'),definition.replace('DECLARE f','DECLARE  f')]){
   await db.admin.query(changed)
   for(const transport of [lf,crlf,mixed])await assert.rejects(db.admin.query(transport(gate)),e=>e.code==='P0001'&&e.message==='STOP_VALIDATORE_FISCALE_DIVERGENTE')
  }
 }finally{await db.close()}
})
for(const [name,transport]of [['LF',lf],['CRLF',crlf],['MIXED',mixed]])test('full migration '+name+': 18 histories unchanged and canonical installed definitions',async()=>{
 const db=await openFixture(transport)
 try{const source=(await db.admin.query("SELECT prosrc FROM pg_proc WHERE oid='artecna_contabilita.documento_riconciliazione(uuid,jsonb)'::regprocedure")).rows[0].prosrc;assert.equal(crypto.createHash('sha256').update(lf(source)).digest('hex'),'95114bc3058f2a7a6255a324322591d43756d50579ce12ae52b9174ecb48197a');assert.equal(Object.keys(db.integratedPreservation).length,18)}finally{await db.close()}
})
