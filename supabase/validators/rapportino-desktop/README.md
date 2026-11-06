# Rapportino desktop backend capabilities

Local-only candidate. Do not apply automatically to a remote database.

`20261106_rapportino_desktop_capability.sql` is transactional and rejects source
drift before extracting the shared domain. It requires the reconciled F3C3 photo
core and the desktop V1 reader. The Production READ ONLY precheck supplied by
the user confirms those prerequisites and reports the private V2 enrichment
helper absent. This migration creates that helper before extending the reader.
An already existing helper is rejected without overwriting it. Missing or
divergent prerequisites abort the whole migration; historical migrations must
not be replayed to satisfy them.

The helper is copied verbatim from `20261007_rapportino_desktop_lettura.sql`.
SHA256 of its UTF-8 `prosrc`, normalizing only CRLF to LF:
`5ee5af07746556b6e18cc2a4cdf53792ccb11d9a561ed150161eba610aa01793`.

| Function | Mode / owner | EXECUTE |
| --- | --- | --- |
| `public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint)` | VOLATILE DEFINER / postgres | postgres, artecna_rapportini_backend |
| `public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid)` | VOLATILE DEFINER / postgres | postgres, artecna_rapportini_backend |
| `artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint)` | VOLATILE DEFINER / postgres | postgres |
| `artecna_rapportini.finalizza_allegato_core(text,uuid,uuid)` | VOLATILE DEFINER / postgres | postgres |
| `artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)` | STABLE INVOKER / postgres | postgres |

All five use `search_path=pg_catalog, pg_temp`. The four photo functions require
the backend session. The reader helper remains private and is invoked by the
authorized desktop reader, without any mobile session or PIN.
The core retains the original argument list for exact extraction; its session
argument is not an authorization channel. Only the public portal wrappers
validate mobile sessions; desktop wrappers validate server-attested membership.

The replaced portal reservation/finalization functions retain their signatures,
authentication prefixes, owner and ACL. The replaced desktop reader retains its
owner, STABLE/DEFINER mode, search path, JWT guard and authenticated-only ACL.
Its version 1 branch is unchanged; version 2 calls the newly installed private helper.
No projection core, trigger, Storage policy or writer definition is changed.

Run `node supabase/validators/rapportino-desktop/validator.cjs` and the two new
tests under `app/engines/rapportini`. SQL tests use isolated PGlite PostgreSQL
17.5 and existing versioned fixtures/migrations, including the real projection
guards. HTTP tests use real image decoding with in-memory Auth/RPC/Storage.
They do not attest live Storage availability or installed Production metadata.

The backend-only RPC is a trusted-server boundary, as for desktop downloads:
the restricted backend can execute it directly, while browser roles cannot.
Object/hash verification remains mandatory in the common HTTP service before
finalization; SQL does not independently inspect physical Storage bytes.
