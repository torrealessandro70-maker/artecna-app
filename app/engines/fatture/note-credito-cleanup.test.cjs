/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner, like note-credito.test.cjs. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const sql = fs.readFileSync(path.resolve(__dirname, '../../..', 'supabase/migrations/20261031_note_credito_fornitori.sql'), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const bodies = [...sql.matchAll(/CREATE OR REPLACE FUNCTION ([\w.]+)\([^]*?AS \$function\$([^]*?)\$function\$/g)];
const init = bodies.find(m => m[1] === 'artecna_distruzione.inizia_contesto')[2];
const rpc = bodies.find(m => m[1] === 'public.elimina_cantiere_definitivamente')[2];
const inventoryText = init.match(/\$inventory\$([^]*?)\$inventory\$/)[1];
const inventory = JSON.parse(inventoryText);
const added = inventory.filter(f => f.child === 'public.fornitori_rettifiche');
const expected = {
  cantiere_id: 'cantieri', economia_riga_id: 'economia_righe',
  materiale_cantiere_id: 'materiali_cantiere',
  nota_riga_id: 'fatture_fornitori_righe', origine_riga_id: 'fatture_fornitori_righe',
};

test('certifica tutte le cinque FK per nome, rapporto, azioni e deferrability', () => {
  assert.equal(inventory.length, 53);
  assert.equal(added.length, 5);
  for (const [column, parent] of Object.entries(expected)) {
    assert.deepEqual(added.find(f => f.name === `fornitori_rettifiche_${column}_fkey`), {
      child: 'public.fornitori_rettifiche', name: `fornitori_rettifiche_${column}_fkey`,
      columns: [column], parent: `public.${parent}`, keys: ['id'], del: 'RESTRICT',
      upd: 'NO ACTION', match: 's', valid: true, defer: false, deferred: false,
    });
  }
});

test('confronto inventario fail-closed completo, non count >= N', () => {
  assert.match(init, /IS DISTINCT FROM \$inventory\$/);
  for (const key of ['conkey', 'confkey', 'confdeltype', 'confupdtype', 'confmatchtype', 'convalidated', 'condeferrable', 'condeferred']) {
    assert.ok(init.includes(key));
  }
  assert.ok(!/count\([^]*?>=\s*53/.test(init));
});

test('conservazione prima della prima mutazione del contesto', () => {
  const guard = init.indexOf('Storico rettifiche TD04 presente');
  assert.ok(guard > init.indexOf('Inventario FK distruzione'));
  assert.ok(guard < init.indexOf('DELETE FROM artecna_distruzione.contesto'));
  for (const clause of ['x.cantiere_id=p_cantiere', 'r.cantiere_id=p_cantiere', 'm.cantiere_id=p_cantiere', 'n.cantiere_id=p_cantiere', 'o.cantiere_id=p_cantiere']) {
    assert.ok(init.includes(clause));
  }
});

test('whitelist esterna limitata alle cinque FK certificate, nessuna eliminazione del registro', () => {
  const branch = rpc.match(/    -- TD04: solo queste cinque FK[^]*?    END IF;\n/)[0];
  for (const f of added) assert.ok(branch.includes(`'${f.name}'`));
  assert.ok(branch.includes("fk.conrelid='public.fornitori_rettifiche'::regclass"));
  assert.ok(!/DELETE FROM public\.fornitori_rettifiche/.test(sql));
  for (const declaration of rpc.matchAll(/v_(?:tabelle|dirette|figli) constant[^;]+;/g)) {
    assert.ok(!declaration[0].includes('fornitori_rettifiche'));
  }
});

test('inizia_contesto storico identico fuori dai due inserimenti autorizzati', () => {
  const restored = init.replace(/    -- TD04: rettifiche immutabili[^]*?    END IF;\n/, '')
    .replace(inventoryText, JSON.stringify(inventory.filter(f => f.child !== 'public.fornitori_rettifiche')));
  assert.equal(hash(restored), 'e3601123992e6540f5e07f4ff02baace659840652d978962b230b8e6e76d63da');
});

test('ordine cleanup e protezioni legacy identici fuori dalla whitelist puntuale', () => {
  const restored = rpc.replace(/    -- TD04: solo queste cinque FK[^]*?    END IF;\n/, '');
  assert.equal(hash(restored), '48a43f63f062809db3ba6b21cbdef347527128db93880e445baea48d03cfd744');
});

test('unica transazione, nessun ruolo/privilegio temporaneo aggiunto dal SQL', () => {
  assert.equal(sql.match(/^BEGIN;/gm).length, 1);
  assert.equal(sql.match(/^COMMIT;/gm).length, 1);
  assert.equal(bodies.length, 2);
  assert.match(sql, /pg_has_role\(current_user,'artecna_cantieri_delete_rpc','SET'\)/);
  assert.match(sql, /has_schema_privilege\('artecna_cantieri_delete_rpc','public','CREATE'\)/);
  assert.match(sql, /SET LOCAL ROLE artecna_cantieri_delete_rpc;/);
  assert.match(sql, /RESET ROLE;/);
  assert.ok(!/GRANT (?:CREATE|artecna_)|ALTER ROLE|ALTER FUNCTION[^;]+OWNER TO/i.test(sql));
});
