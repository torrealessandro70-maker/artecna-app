/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const sql=fs.readFileSync(path.join(__dirname,'../../migrations/20261106_preflight_eliminazione_readonly.sql'),'utf8')
const definitions=[...sql.matchAll(/CREATE FUNCTION ([\w.]+)\([^]*?AS \$body\$([^]*?)\$body\$/g)]
assert.equal(definitions.length,3)
assert.deepEqual(definitions.map(m=>m[1]),['artecna_guardie.preflight_dipendenze','public.preflight_eliminazione_sopralluogo','public.preflight_eliminazione_cantiere'])
for(const [,name,body]of definitions){
 assert(!/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|COPY|CALL)\b/i.test(body.replace(/--[^\n]*/g,'')),name)
 assert(!/\b(?:set_config|nextval|pg_advisory|dblink)\b/i.test(body),name)
}
assert(!/artecna_distruzione|elimina_cantiere_definitivamente/i.test(sql))
assert.equal((sql.match(/GRANT EXECUTE/g)||[]).length,2)
assert(!/CREATE (?:TABLE|SCHEMA|ROLE|TRIGGER|POLICY)|ALTER (?:TABLE|ROLE)|GRANT .*TO anon/i.test(sql))
for(const name of ['preflight_eliminazione_sopralluogo','preflight_eliminazione_cantiere']){
 assert(new RegExp(`CREATE FUNCTION public.${name}[^]*?STABLE SECURITY DEFINER[^]*?SET search_path = pg_catalog, pg_temp`).test(sql))
 assert(new RegExp(`ALTER FUNCTION public.${name}\\([^]*?OWNER TO postgres;`).test(sql))
 assert(new RegExp(`REVOKE ALL ON FUNCTION public.${name}\\([^]*?FROM PUBLIC,anon,authenticated,service_role;`).test(sql))
}
console.log('VALIDATOR GREEN: 2 RPC pubbliche READ ONLY, helper privato; nessuna modifica ai distruttivi/tabelle/policy.')
