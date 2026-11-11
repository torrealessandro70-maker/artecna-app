/* eslint-disable @typescript-eslint/no-require-imports -- SQL is read as text and never applied. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const sql = fs.readFileSync(path.join(__dirname, '../../migrations/20261111000100_documenti_fiscali_privati.sql'), 'utf8')
const body = name => {
  const declaration = sql.indexOf('CREATE FUNCTION ' + name + '(')
  assert(declaration >= 0, name)
  const start = sql.indexOf('AS $f$', declaration)
  return sql.slice(start + 6, sql.indexOf('$f$;', start + 6))
}

test('FK is nullable, many schedules can share it, physical removal is restricted', () => {
  assert.match(sql, /ADD COLUMN documento_id uuid REFERENCES artecna_contabilita\.documenti_fiscali\(id\) ON DELETE RESTRICT/)
  assert.doesNotMatch(sql, /UNIQUE\s*\(documento_id\)|documento_id uuid NOT NULL/i)
  assert.match(sql, /CREATE INDEX scadenze_fiscali_documento_idx/)
  assert.doesNotMatch(sql, /DROP |DELETE FROM|TRUNCATE/i)
})

test('link writes only association and revision/audit; no economic or IVA writer', () => {
  const update = body('artecna_contabilita.imposta_documento_scadenza')
  const fields = update.match(/SET ([\s\S]*?)\s+WHERE id/)[1].split(',').map(s => s.split('=')[0].trim())
  assert.deepEqual(fields, ['documento_id', 'revisione', 'updated_at', 'updated_by'])
  assert.match(update, /revisione = p_revisione_attesa/)
  assert.match(update, /ERRCODE = '40001'/)
  assert.match(update, /caricato_at IS NOT NULL AND archiviata_at IS NULL FOR SHARE/)
  assert.match(body('public.scollega_documento_scadenza'), /\(p_id, NULL, p_revisione_attesa\)/)
  assert.doesNotMatch(sql, /importo_|includi_nei_totali|prospetto_iva|pagamenti_operai|pagamenti_fornitori/)
})

test('RLS and RPC ACLs protect the company archive and Storage signing', () => {
  assert.match(sql, /documenti_fiscali FORCE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON artecna_contabilita.documenti_fiscali FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(sql, /VALUES \('documenti-fiscali-privati', 'documenti-fiscali-privati', false, 10485760/)
  for (const name of ['elenca_documenti_fiscali', 'crea_documento_fiscale', 'aggiorna_documento_fiscale', 'archivia_documento_fiscale', 'conferma_upload_documento_fiscale']) {
    assert.match(body('public.' + name), /scadenza_autorizza\(\)/)
  }
  const guard = body('public.documento_fiscale_storage_consentito')
  assert.match(guard, /auth.uid\(\) IS NOT NULL/)
  assert.match(guard, /utente_puo_operare_impresa/)
  assert.match(guard, /d.storage_path = p_path/)
  assert.match(guard, /d.created_by = artecna_guardie.utente_jwt_corrente\(\)/)
  assert.match(sql, /AS RESTRICTIVE FOR UPDATE TO PUBLIC/)
  assert.match(sql, /AS RESTRICTIVE FOR DELETE TO PUBLIC/)
  assert.match(sql, /AS RESTRICTIVE FOR SELECT TO PUBLIC/)
  assert.match(sql, /AS RESTRICTIVE FOR INSERT TO PUBLIC/)
  assert.match(body('public.conferma_upload_documento_fiscale'), /FROM storage.objects/)
  assert.match(body('public.archivia_documento_fiscale'), /SET archiviata_at/)
  assert.match(sql, /public\.scollega_documento_scadenza\(uuid, bigint\)\s+FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(sql, /public\.scollega_documento_scadenza\(uuid, bigint\)\s+TO authenticated/)
})

test('prepared migration is one transaction with paired function bodies', () => {
  assert.equal((sql.match(/^BEGIN;/gm) || []).length, 1)
  assert.equal((sql.match(/^COMMIT;/gm) || []).length, 1)
  const tags = sql.match(/\$[A-Za-z_][A-Za-z_0-9]*\$/g)
  for (const tag of new Set(tags)) assert.equal(tags.filter(x => x === tag).length % 2, 0, tag)
  const functions = sql.match(/CREATE FUNCTION [\s\S]*?\$f\$;/g)
  assert.equal(functions.length, 9)
  assert(functions.every(f => f.includes('SECURITY DEFINER SET search_path = pg_catalog, pg_temp')))
  assert.doesNotMatch(sql, /CREATE OR REPLACE|hard_delete_catalog_expected/)
})

test('same creation identity returns existing metadata or a conflict, without a second row', () => {
  const create = body('public.crea_documento_fiscale')
  assert.match(create, /ON CONFLICT \(id\) DO NOTHING/)
  assert.match(create, /WHERE id = p_id/)
  assert.match(create, /ERRCODE = '23505'/)
})
