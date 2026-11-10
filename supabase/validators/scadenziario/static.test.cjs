/* eslint-disable @typescript-eslint/no-require-imports -- Static SQL audit only; no SQL applied. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const root = path.resolve(__dirname, '../../..'), sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261110000100_scadenziario_fiscale_persistenza.sql'), 'utf8')
test('migration transaction and dollar-quoted bodies are lexically complete (not a PG compilation)', () => {
  assert.equal((sql.match(/^BEGIN;/gm) || []).length, 1); assert.equal((sql.match(/^COMMIT;/gm) || []).length, 1)
  const counts = {}; for (const m of sql.matchAll(/\$[a-z_]*\$/g)) counts[m[0]] = (counts[m[0]] || 0) + 1
  for (const n of Object.values(counts)) assert.equal(n % 2, 0)
})
test('one private table with nullable monetary fields, four states and logical archive', () => {
  assert.equal((sql.match(/CREATE TABLE /g) || []).length, 1)
  for (const name of ['id uuid PRIMARY KEY', 'importo_previsto numeric(14,2) CHECK', 'importo_pagato numeric(14,2) CHECK', 'data_pagamento date', 'archiviata_at timestamptz', 'archiviata_by uuid', 'motivo_archiviazione text', 'revisione bigint']) assert(sql.includes(name))
  assert(sql.includes("stato IN('previsto','da_verificare','da_pagare','pagato')"))
  assert(!/\bcantiere_id\b|\bimpresa_id\b|DELETE FROM/i.test(sql))
})
test('RLS deny by default, no browser table writer and no existing guard modifications', () => {
  assert(sql.includes('ENABLE ROW LEVEL SECURITY')); assert(sql.includes('FORCE ROW LEVEL SECURITY')); assert(!/CREATE POLICY/i.test(sql))
  assert(sql.includes('REVOKE ALL ON artecna_contabilita.scadenze_fiscali FROM PUBLIC,anon,authenticated,service_role'))
  assert(!/GRANT (?:ALL|INSERT|UPDATE|DELETE|SELECT)/i.test(sql))
  assert(!/CREATE OR REPLACE|ALTER (?:FUNCTION|ROLE)|hard_delete_catalog_expected|SET ROLE/i.test(sql))
})
test('each public RPC has fixed search_path, security definer and explicit existing guard before access', () => {
  const functions = [...sql.matchAll(/CREATE FUNCTION public\.(\w+)\([^]*?AS \$f\$([^]*?)END \$f\$;/g)]
  assert.equal(functions.length, 4)
  for (const [, , body] of functions) assert(/(?:PERFORM|u:=) artecna_contabilita\.scadenza_autorizza\(\)|u:=artecna_contabilita\.scadenza_autorizza\(\)/.test(body))
  assert.equal((sql.match(/SECURITY DEFINER SET search_path=pg_catalog,pg_temp/g) || []).length, 5)
  assert(sql.includes('artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true'))
  assert(sql.includes('TO authenticated;')); assert(sql.includes('FROM PUBLIC,anon,authenticated,service_role;'))
})
test('updates/archives use atomic revision predicates and SQLSTATE 40001; actors from JWT', () => {
  assert.equal((sql.match(/WHERE id=p_id AND revisione=p_revisione_attesa AND archiviata_at IS NULL RETURNING/g) || []).length, 2)
  assert.equal((sql.match(/ERRCODE='40001'/g) || []).length, 2)
  assert.equal((sql.match(/updated_by=u/g) || []).length, 2)
  assert(sql.includes('ON CONFLICT(id) DO NOTHING')); assert(sql.includes("'importo_previsto',($1).importo_previsto::text"))
})
test('prepared runtime validators cover contract/privileges and rollback; are not invoked here', () => {
  const structure = fs.readFileSync(path.join(__dirname, 'struttura-readonly.sql'), 'utf8'), contract = fs.readFileSync(path.join(__dirname, 'contratto-locale.sql'), 'utf8')
  assert(structure.includes('relrowsecurity AND relforcerowsecurity')); assert(structure.includes('has_column_privilege'))
  for (const check of ['DIRECT_WRITER_ALLOWED', 'NON_OWNER_ALLOWED', 'ANON_WRITER_ALLOWED', 'STALE_REVISION_ALLOWED', 'ARCHIVE_CONTRACT', 'SILENT_ROUNDING', 'CLIENT_ACTOR_ALLOWED']) assert(contract.includes(check))
  assert(contract.trimEnd().endsWith('ROLLBACK;'))
})
