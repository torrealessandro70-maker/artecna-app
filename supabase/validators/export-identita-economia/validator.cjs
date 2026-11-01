// Validator attivo del candidato. Gli audit precedenti in .run restano reperti storici.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const dir = __dirname;
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected-rpc.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const key = r => `${r.schema}.${r.name}(${r.args})`;
const target = key(expected.routine);
const canonical = value => Array.isArray(value)
  ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const same = (a, b) => assert.deepEqual(canonical(a), canonical(b));

function migrationCheck() {
  const sql = fs.readFileSync(path.resolve(dir, '../../migrations/20261101_export_identita_economia.sql'), 'utf8');
  assert.equal(hash(sql), expected.migrationSHA256, 'Migrazione diversa dal fingerprint');
  assert.equal(hash(fs.readFileSync(path.join(dir, 'catalog-readonly.sql'))), expected.catalogSHA256);
  const clean = sql.replace(/--[^\n]*/g, '');
  assert(!/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|COPY|PERFORM|ALTER\s+(?:FUNCTION|TABLE|ROLE)|CREATE\s+(?:TABLE|POLICY|TRIGGER|INDEX|ROLE)|SET\s+ROLE|OWNER\s+TO)\b/i.test(clean));
  assert.equal((clean.match(/CREATE FUNCTION/gi) || []).length, 1);
  assert.equal((clean.match(/GRANT /g) || []).length, 1);
  assert(clean.includes('GRANT EXECUTE ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) TO authenticated;'));
  assert(!/\bEXECUTE\b/i.test(clean.split('AS $$')[1].split('END $$')[0]));
  return true;
}

function pre(s) {
  migrationCheck();
  assert.equal(s.meta.user, 'postgres');
  assert.equal(s.meta.read_only, 'on');
  const p = s.prerequisites;
  assert.equal(p.new_rpc_absent, true, 'RPC già presente');
  assert.equal(p.public_name_collisions, 0, 'Collisione di nome');
  assert.equal(p.function_owner_expected, 'postgres');
  for (const k of ['guard_jwt', 'guard_cantiere', 'installer_create_public', 'owner_create_public', 'owner_usage_public', 'owner_usage_guardie', 'owner_execute_jwt', 'owner_execute_guard', 'authenticated_usage_public']) {
    assert.equal(p[k], true, `Prerequisito ${k} assente`);
  }
  assert.equal(s.column_privileges.length, 6);
  assert(s.column_privileges.every(r => r.select === true), 'SELECT necessario assente');
  assert.equal(s.routines.filter(r => key(r) === target).length, 0);
  return { esito: 'GREEN', owner: 'postgres', nessunTrasferimentoOwner: true };
}

function post(before, after) {
  migrationCheck();
  assert.equal(after.meta.read_only, 'on');
  assert.equal(after.meta.user, 'postgres');
  assert.equal(after.prerequisites.public_name_collisions, 1);
  assert.equal(after.prerequisites.new_rpc_absent, false);
  assert.equal(after.new_rpc_definition, expected.definition);
  assert.equal(hash(after.new_rpc_definition), expected.rpcDefinitionSHA256);
  same(after.new_rpc_dependencies, expected.dependencies);
  const added = after.routines.filter(r => key(r) === target);
  assert.equal(added.length, 1);
  same(added[0], expected.routine);
  same(before.routines, after.routines.filter(r => key(r) !== target));
  for (const field of ['relations', 'columns', 'constraints', 'policies', 'indexes', 'triggers', 'schema_acl', 'default_acl', 'roles', 'memberships', 'protected_data']) {
    assert(field in before && field in after, `Fotografia ${field} assente`);
    same(before[field], after[field]);
  }
  same(before.column_privileges, after.column_privileges);
  for (const k of Object.keys(before.prerequisites)) {
    if (!['new_rpc_absent', 'public_name_collisions'].includes(k)) same(before.prerequisites[k], after.prerequisites[k]);
  }
  return { esito: 'GREEN', rpcDefinitionSHA256: expected.rpcDefinitionSHA256, nessunDeltaProtetto: true };
}

function readPsql(file) {
  const raw = fs.readFileSync(file, 'utf8');
  assert(/^ROLLBACK\s*$/m.test(raw), 'ROLLBACK assente');
  return JSON.parse(raw.split(/\r?\n/).find(s => s.trim().startsWith('{')));
}
module.exports = { pre, post, readPsql, migrationCheck };
if (require.main === module) {
  try {
    const [mode, file1, file2] = process.argv.slice(2);
    assert(['pre', 'post'].includes(mode));
    const result = mode === 'pre' ? pre(readPsql(file1)) : post(readPsql(file1), readPsql(file2));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e) {
    process.stderr.write('NON GREEN: ' + e.message + '\n');
    process.exitCode = 1;
  }
}
