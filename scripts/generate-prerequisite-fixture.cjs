const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..'),s=require('../audit-production/normalized-production.json'),q=x=>'"'+x.replaceAll('"','""')+'"'
const roles=new Set(['anon','authenticated','service_role','artecna_cantieri_delete_rpc'])
for(const r of [...s.relations,...s.functions])if(r.owner!=='postgres')roles.add(r.owner)
for(const x of [...s.relations,...s.functions,...s.columns])for(const acl of x.acl||[]){const m=acl.match(/^([^=]+)=.*\/([^/]+)$/);if(m){roles.add(m[1]);roles.add(m[2])}}
roles.delete('postgres')
const ddl=[`-- Schema-only synthetic test fixture derived from the supplied export.
-- No Production rows, credentials or connection configuration.
SET check_function_bodies=off;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`]
for(const role of roles)ddl.push(`CREATE ROLE ${q(role)} NOLOGIN ${role.startsWith('artecna_')?'BYPASSRLS':'NOBYPASSRLS'};`)
for(const schema of new Set([...s.relations,...s.functions].map(r=>r.schema).filter(n=>n!=='public')))ddl.push(`CREATE SCHEMA ${q(schema)};`)
const sequences=new Set(s.columns.flatMap(c=>[...(c.default||'').matchAll(/nextval\('([^']+)'::regclass\)/g)].map(m=>m[1])))
for(const seq of sequences)ddl.push(`CREATE SEQUENCE public.${q(seq.replace(/^public\./,''))};`)
for(const r of s.relations){const cols=s.columns.filter(c=>c.relation===r.oid).sort((a,b)=>a.position-b.position).map(c=>`${q(c.name)} ${c.type}${c.generated?' GENERATED ALWAYS AS ('+c.default+') STORED':c.identity?' GENERATED '+(c.identity==='a'?'ALWAYS':'BY DEFAULT')+' AS IDENTITY':c.default?' DEFAULT '+c.default:''}${c.not_null?' NOT NULL':''}`);ddl.push(`CREATE TABLE ${q(r.schema)}.${q(r.table)}(${cols.join(',\n')});`)}
for(const f of s.functions){ddl.push(f.definition+';');ddl.push(`ALTER FUNCTION ${f.signature} OWNER TO ${q(f.owner)};`)}
for(const type of ['p','u','c','f'])for(const k of s.constraints.filter(k=>k.type===type))ddl.push(`ALTER TABLE ${k.child} ADD CONSTRAINT ${q(k.name)} ${k.definition};`)
const constraintIndexes=new Set(s.constraints.map(k=>k.index_oid))
for(const i of s.indexes.filter(i=>!constraintIndexes.has(i.oid)))ddl.push(i.definition+';')
for(const t of s.triggers.filter(t=>!t.internal))ddl.push(t.definition+';')
for(const schema of new Set(s.relations.map(r=>r.schema)))for(const role of roles)ddl.push(`GRANT USAGE ON SCHEMA ${q(schema)} TO ${q(role)};`)
// Production policy role OIDs are intentionally not guessed. Authorization tests
// exercise the actual JWT/owner helpers and new capability ACL, not visibility policies.
const map={r:'SELECT',a:'INSERT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',X:'EXECUTE'}
function acl(type,target,entries){if(!entries)return;ddl.push(`REVOKE ALL ON ${type} ${target} FROM PUBLIC;`);for(const entry of entries){const m=entry.match(/^([^=]*)=([^/]+)\//);if(!m)continue;const rights=[...m[2]].filter(c=>map[c]).map(c=>map[c]);if(rights.length)ddl.push(`GRANT ${[...new Set(rights)].join(',')} ON ${type} ${target} TO ${m[1]?q(m[1]):'PUBLIC'};`)}}
for(const r of s.relations)acl('TABLE',q(r.schema)+'.'+q(r.table),r.acl)
for(const c of s.columns)for(const entry of c.acl||[]){const r=s.relations.find(r=>r.oid===c.relation),m=entry.match(/^([^=]*)=([^/]+)\//);if(!m)continue;const rights=[...m[2]].filter(x=>map[x]).map(x=>map[x]+' ('+q(c.name)+')');if(rights.length)ddl.push(`GRANT ${rights.join(',')} ON TABLE ${q(r.schema)}.${q(r.table)} TO ${m[1]?q(m[1]):'PUBLIC'};`)}
for(const f of s.functions)acl('FUNCTION',f.signature,f.acl)
ddl.push('SET check_function_bodies=on;')
const output=path.join(root,'supabase/validators/cantiere-prerequisiti');fs.mkdirSync(output,{recursive:true})
fs.writeFileSync(path.join(output,'baseline.sql'),ddl.join('\n')+'\n')
console.log('Generated schema fixture: '+s.relations.length+' relations, '+s.functions.length+' routines; no Production rows')
