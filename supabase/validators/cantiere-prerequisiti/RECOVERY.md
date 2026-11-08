Recovery 002: Production remains stopped

The recorded R2 invocation acknowledged COMMIT/END for 001 only. Migration 002
acknowledged BEGIN and INSERT 0 23, then lost its connection during its final DO
block (original lines 31-46). No COMMIT/END for 002 was received. Prefix 1 is an
expected state, not a certified current Production state. Run the supplied READ
ONLY recovery precheck manually; only GREEN_RESUME_FROM_002 allows a future
one-shot recovery driver to execute 002-007. Never rerun 001 or R2.

The recovery precheck reuses the complete certified catalog classifier and
compares observed objects against expected prefix 1, including owners, ACL,
roles, membership, definitions and triggers. It additionally requires empty
storage_sorgenti/oggetti/riferimenti/anomalie, coverage exactly false, and zero
002 source triggers. It verifies installer CREATEROLE/admin authority. Any
residue fails closed and streams an exact row/catalog inventory under READ ONLY.
The 002 introduces no persistent helper: storage_sync/indicizza belong to 001.

The correction does not change 001, the Storage schema, extraction functions,
cleanup authority, locks, writers, or final catalog state. All 23 sources and
their original configurations remain included. It holds all original source
locks until the single COMMIT, but uses separate source statements with an
explicit FETCH of one row and a narrow Storage projection. Unsupported URI/data
strings are discarded before constructing JSON, exactly as storage_uri already
does. JSON envelopes, provider/bucket columns, PK, cantiere_id and audited creator
namespace fields remain available to the unchanged canonical storage_indicizza.
Retries/residual states are rejected before writing. Failure rolls back the
whole 002, including trigger creation; no partial COMMIT is introduced.

Local PostgreSQL 17.6 tests compare original/new results across every source,
including composite keys, URI/provider edge cases, JSON, shared objects and
creator authority. Domain CHECK constraints remain active during synthetic
seeding; only fixture_admin bypasses application/FK triggers while inserting
isolated fixtures. Every trigger is active for both measured backfills. A large
fixture uses 5,175 rows with 146 additional 4 MB photos and 5,000 preventivi.
Original/new final registry contents are identical. Sampled private-memory peaks
were 249,835,520 / 36,450,304 bytes; measured durations 12,569 / 6,261 ms. Both
completed without timeout/disconnection. Memory sampling is Windows process
telemetry, not a complete server-memory accounting or a Production measurement.

These results prove an avoidable resource cost, not Production OOM. The client
message alone cannot distinguish a killed backend, server restart, pooler/network
failure or another abnormal termination. An ordinary statement_timeout or
lock_timeout should produce a SQL ERROR; neither was recorded. The canonical
backfill does not modify its source rows, so it does not invoke the source
Storage triggers recursively. Server/platform logs for the recorded crash time
are needed for an actual root cause. None were fetched by the agent. Optional
diagnostics SQL reports safe settings, backend/restart metadata and per-column
payload sizes without reading password/ENV/token values or returning file data.

Offline commands (local PostgreSQL runtime required):

    node scripts/generate-cantiere-recovery-precheck.cjs
    node --test supabase/validators/cantiere-prerequisiti/*.test.cjs
    node supabase/validators/cantiere-prerequisiti/storageBackfill.volume.cjs

No Production SQL/RPC, Storage API, password configuration, push or deployment
is part of this preparation. consumer_storage_canonico remains
READY_FOR_CONFIGURATION.

R4: membership grantors are evidence, not semantic identity. The collector keys
memberships by granted role/member and preserves every distinct ADMIN/INHERIT/SET
tuple. Identical tuples from different grantors are equivalent; any conflicting
tuple, unexpected member/role, attribute, owner or ACL still causes drift. Actual
grantors and all options are returned in worker_membership_evidence. The separate
DIRECT_ADMIN_CONFIRMED and CREATEROLE/language authority gates remain mandatory.

Logical catalog STOP is a valid READ ONLY SQL result: print the JSON/inventory,
ROLLBACK and return without an artificial division-by-zero error. The read-only
runner evaluates the verdict and exits nonzero on STOP. The application driver
must quit before read-write if the verdict is not GREEN; its runner independently
rejects missing commits or a STOP report even when psql exited successfully.

R4 also fixes the external R3 read-only runner's --file routing: it erroneously
selected ApplyRecovery.sql instead of 01_recovery_precheck_readonly.sql. The
recorded R3 STOP prevented any new migration, but the runner target itself was
incorrect. readonlyRunnerPolicy explicitly rejects an application SQL target,
duplicate/missing targets or application attempt markers in a read-only runner.
