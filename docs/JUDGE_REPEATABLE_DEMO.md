# Repeatable Judge Demo — preparation and rehearsal runbook

This release is a security/UI preparation. Production write flags and Datadog cloud remain OFF. No production rehearsal or re-arm is authorized. The only existing production scope is run `judge-4afc45f4427ab21f48d61c89`, owner `github:138879141`, virtual charger `demo-charger-01`. Never use the legacy demo reset or mutate pinned Phase D incident `demo-58a1983cae09`.

## Feature and architecture checklist

- GitHub OAuth / encrypted NextAuth cookie → Next.js BFF → short-lived action assertion → NestJS → MongoDB Atlas.
- Both independent production gates require `JUDGE_PROD_WRITES_ENABLED=true` and `JUDGE_ROUTES_ENABLED=true`, the pinned owner/run, canonical origin and separate server-only write key. Every legacy mutation remains denied.
- Browser posts exactly `{expectedRevision, expectedCycle}`. BFF compares a fresh owned-run GET; the signed assertion binds the body, revision, cycle, audience, method, path and resource. Nest independently verifies it; MongoDB compare-and-swap ensures only one concurrent state transition commits. A delayed action from an older revision/cycle is rejected.
- `judge_runs` embeds cycle-tagged audit entries and synthetic observations. Legacy documents with no cycle field mean cycle 1; reads do not migrate production records.
- `judge_policy` stores nonce markers and per-operator/action/minute quotas. Approved indexes are `_id_` and `expiresAt_ttl {expiresAt:1}, expireAfterSeconds:0`. TTL is cleanup, not authorization. Three attempts per action/minute, 100 lifetime run revisions, at most 20 cycles.
- Re-arm uses the existing `reset` route but requires **separate** `JUDGE_REARM_ENABLED=true` on both services, owner approval and RESOLVED status. It increments cycle, records a re-arm audit event on the new cycle and retains all prior observations/audit. It never deletes evidence. Fault is allowed only from BASELINE.
- Console selects active or archived cycles. Archived cycles are read-only; current chart/timeline never combine cycles. SYNTHETIC labels remain visible. Confirmation and a synchronous request lock prevent accidental double submissions. Stale/uncertain data disables actions until successful readback.

## First future production rehearsal (approval required)

1. Obtain explicit approval for ONE four-action lifecycle; no Reset/re-arm included. Do not request screen recording for this engineering rehearsal.
2. Confirm both deployed SHAs and authenticated GET. Snapshot/hash all six original collections plus `judge_runs`; verify the pinned incident, exact owner, BASELINE, revision 0, empty actions and policy records. Store private evidence outside Git. No raw ACN files or credentials in evidence.
3. Confirm server-only `OPERATOR_ASSERTION_SECRET`, `JUDGE_WRITE_API_KEY`, read credential, operator allowlist and canonical origin. Never export secret values. Vercel additionally uses `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEST_API_BASE_URL`, `NEST_READ_API_KEY`; Render uses `OPERATOR_ORIGIN`, `OPERATOR_GITHUB_IDS`, `BFF_READ_API_KEY`. Key equality metadata cannot prove matching key values: authentication in the authorized rehearsal is the operational verification.
4. Only after approval, temporarily set both production write flags true on Vercel and Render and redeploy the reviewed SHA. Keep `JUDGE_REARM_ENABLED` absent/false. Keep `DD_CLOUD_ENABLED=false`; do not enable Agent or HTTPS Datadog submission. Check live reads before any action.
5. Select active cycle 1 in `/judge`. Execute sequentially; wait for successful GET verification after each action:

| Action | Status | Revision | Atomic run update |
| --- | --- | --- | --- |
| Fault | OPEN | 1 | one actor-derived audit entry, cycle 1 observation: 0 A / FAULT / SYNTHETIC |
| Acknowledge | ACKNOWLEDGED | 2 | one actor-derived audit entry |
| Recover | RESOLVING | 3 | one audit entry, cycle 1 observation: 8.25 A / CHARGING / SYNTHETIC |
| Resolve | RESOLVED | 4 | one audit entry |

The successful four-action path adds four nonce markers and four per-action quota counters (expiration cleanup may remove earlier markers). Rejections can consume policy records. No operational/time-series telemetry, charger, incident or ingestion receipt writes. Values are software scenario observations, never measured hardware current.

6. Verify run status, revision, timestamps, signed-in actor audit and observation count after every step. Compare protected collection hashes. Do not infer Datadog ALERT/OK from MongoDB state.
7. Disable both write flags on both services and redeploy. Confirm all five Judge actions and legacy mutation endpoints return 403 again. Retain the resolved cycle as evidence; no automatic cleanup/reset.

## Failure / emergency handling

Never automatically retry a POST. A timeout can occur after commit. Read the run and compare expected revision/cycle/audit. If unchanged, inspect the failure and obtain a new assertion through a deliberate UI action; the old nonce may already be spent. If changed, continue only from the verified new state. If readback fails or data differ unexpectedly, stop, disable writes, and investigate. Failed quota reservations can consume a nonce without a run mutation. Fixed windows permit up to six attempts around a minute boundary. These are bounded, fail-closed semantics, not exactly-once processing.

Emergency shutdown: set `JUDGE_PROD_WRITES_ENABLED=false` and `JUDGE_ROUTES_ENABLED=false` on both services; keep `JUDGE_REARM_ENABLED=false`, redeploy/restart and confirm 403. Revoke the dedicated write credential if compromise is suspected, without printing it. Never delete policy or evidence to bypass a limit.

## Preparing a subsequent recording cycle (separate approval)

Only after an owner approves re-arm, verify current cycle RESOLVED, hashes unchanged and lifetime bounds not reached. Temporarily enable the two write flags plus `JUDGE_REARM_ENABLED=true` on both services. Owner confirms **Re-arm next cycle** once. It writes one nonce, one quota record, one atomic update of the existing run: revision +1, cycle +1, BASELINE, appended actor/timestamp re-arm entry. All old evidence remains. Verify active cycle has no new fault/recovery samples, select the archived cycle to inspect prior evidence, then disable all write/re-arm flags and confirm 403. No production re-arm is authorized by the preparation request.

## MongoDB technical defense / aggregation

Shared synthetic operations retain `chargers`, `stations`, `incidents`, `incident_actions`, `telemetry` time-series and `ingestion_receipts`. Judge software observations intentionally live inside the single isolated `judge_runs` document; they are not inserted into time-series telemetry. This prevents rehearsals from rewriting the verified Phase D lifecycle.

Read-only aggregation for cycle-specific investigation (owner-authorized scope; execute through an authenticated read tool, never expose credentials):

```javascript
db.judge_runs.aggregate([
  {$match: {_id: 'judge-4afc45f4427ab21f48d61c89', owner: 'github:138879141', synthetic: true}},
  {$unwind: '$actions'},
  {$group: {_id: {$ifNull: ['$actions.cycle', 1]},
    actionCount: {$sum: 1}, firstAction: {$min: '$actions.at'}, lastAction: {$max: '$actions.at'}}},
  {$sort: {_id: 1}}
])
```

No actions means an empty result, not manufactured timestamps. Counts and elapsed time are DERIVED from stored SYNTHETIC events; they do not measure real charger safety or alert detection delay.

## Live walkthrough / recording sequence after rehearsal passes

1. Overview: five virtual chargers; explain scope and SYNTHETIC provenance.
2. Judge Console: verified operator, run, cycle, current status, read-only/activation indicator.
3. After separate rehearsal approval: fault → inspect observation and audit → acknowledge → recover → resolve, checking each recorded state.
4. Show prior cycle history after separately approved re-arm; explain that audit persists and charts filter by cycle.
5. Present MongoDB separation and cycle aggregation above. Do not imply observed ACN data are live/cloud telemetry.
6. Present existing verified local `env:dev` Datadog Phase D evidence; state explicitly cloud `env:prod` ingestion is OFF and there is no verified production monitor lifecycle. Judge action counters, MongoDB status, recovery observations and Datadog monitor state are different evidence streams.
7. Record only once engineering rehearsal and the separately authorized recording-cycle preparation pass. Exclude dashboard secret screens, tokens, private source records and ACN visualizations without permission. No final slides are required to prove the product works.

## Honest limitations and gates

- Nonce/quota and run CAS are not one transaction; ambiguous failures may spend quota without changing state. No durable Datadog outbox or guaranteed metric delivery.
- An operator cookie fixture tests BFF session verification; it does not simulate GitHub's external login/2FA. Production OAuth reads must be separately verified using the real signed-in session.
- Free Render can cold-start. GET reads may take longer; POST is never retried automatically. A failed readiness check blocks a rehearsal.
- Production interactive behavior and repeatability remain unverified until separately authorized tests. Passing local tests or deployment alone does not establish recording readiness.

## Verified preparation tests (Node 24.22.1)

- API: 55 unit tests and 24 disposable-Mongo integration tests passed.
- Web: 29 policy/presentation/page-interaction tests passed, including synchronous double-click lock, archived-cycle rendering, stale/uncertain state, explicit refresh, confirmation cancellation and terminal bounds.
- `npm --prefix apps/api run test:judge:bff`: six tests (one parent and five subtests) passed over actual HTTPS Next route handlers → HTTPS Nest controller → disposable MongoDB. Concurrent duplicate action rejection and independent BFF/API re-arm flags were also verified. Two lifecycles plus re-arm persisted nine actions and four observations; old evidence and all six sentinel collections were unchanged. The fixture rejects an untrusted CA and uses a process-scoped trusted CA with certificate verification enabled. It copies only required code to a temporary Next project, inherits no cloud credentials, does not load production `.env`, prevents non-loopback worker networking and requires an already cached MongoDB binary. Fixture auth code exists outside application routes and is excluded from API production compilation.
- API typecheck/build and web lint/build passed. Web build includes TypeScript validation.
- Independent review found no security blocker; the reported terminal re-arm UI defect was fixed and retested. Limit-exceeded assertion errors may return 401 before a service-level 403; all fail closed.

These tests do not prove a production write or a production Datadog monitor cycle. The dev-mode BFF fixture verifies encrypted session cookies against the focused Nest controller module, not the GitHub external OAuth exchange or a full production bootstrap. Chart/presentation unit tests do not substitute for a live browser rehearsal. Production authenticated reads and baseline layout must be rechecked after deployment, and recording readiness remains gated on the separately authorized rehearsal.
