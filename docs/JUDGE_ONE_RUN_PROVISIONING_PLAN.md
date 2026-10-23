# ChargeGuard — Single judge run provisioning (RUN INSERTED; READ ACCESS PENDING)

## Verified Phase 1 outcome — 2026-10-23

The owner explicitly authorized a **single read-only synthetic run**. Atlas ping succeeded and an audit confirmed zero existing judge runs before creation. On 2026-10-23, the locally authenticated scoped MongoDB client inserted exactly one run:

- Run ID: `judge-4afc45f4427ab21f48d61c89`.
- Owner: `github:138879141`, the GitHub CLI-authenticated `thangak18` account; the existing Vercel `OPERATOR_GITHUB_IDS` is a protected Secret and its value could not be independently inspected.
- Virtual asset: `demo-station-01` / `demo-charger-01`; `synthetic:true`, `status:BASELINE`, `revision:0`, `actions:[]`.
- Created: **only** `chargeguard.judge_runs` and its built-in unique `_id_` index. The `judge_policy` collection, quota/nonce records, TTL indexes and write credentials were **not** created.
- Verified six original collection fingerprints unchanged at insertion: `chargers`, `stations`, `incidents`, `incident_actions`, `telemetry`, `ingestion_receipts`. The pinned Phase D incident `demo-58a1983cae09` was present and preserved.
- Rerunning the provisioning command found the one existing run and refused insertion. The audit command is read-only.

The automated server-side environment configuration attempt was **blocked by the tool's safety checks before execution**. No matching signing secret was written to either cloud provider and judge-run cloud GET access is **not yet enabled**. Live anonymous requests still receive 401, and production writes remain 403. Do not claim browser authentication or read access succeeded yet.

To complete the already owner-authorized read-only setup after the blocker is resolved, generate **one** random secret with at least 32 bytes of entropy, enter the **same** value directly as `OPERATOR_ASSERTION_SECRET` in Vercel Production and Render, never display or commit it. Set only `JUDGE_READS_ENABLED=true` on both; on Render set `OPERATOR_ORIGIN=https://chargeguard-web.vercel.app` and `OPERATOR_GITHUB_IDS=138879141`. Preserve the existing Vercel operator allowlist and verify privately that it includes `138879141`; do not overwrite unknown allowlisted IDs. Redeploy the current reviewed source on both providers. Verify the signed-in NextAuth → BFF → NestJS → MongoDB owned-run GET and detail, anonymous 401, unowned/unknown-run 404, all POST 403, and the desktop/mobile `/judge` views. Do not enable `JUDGE_ROUTES_ENABLED`, create a write key, send faults, or enable Datadog cloud intake. No Atlas IP or privilege changes are required.

Provision/audit script: `node apps/api/scripts/provision-judge-run.cjs --audit`. The `--provision --owner-id=...` option **must not be rerun** against this database: it is guarded against duplication and exits without inserting when any judge run exists.

Date: 2026-10-23. Production **remains strictly read-only**: Next.js and NestJS deny all state-changing requests with HTTP 403. The owner has authorized and completed the single isolated run insertion above; further cloud write/demo activity still requires separate approval. Existing GitHub OAuth, Atlas network access/roles, Phase D and private ACN history are preserved.

## Prepared identity and isolation

`/judge` verifies an actual NextAuth signed, encrypted Secure cookie, extracts its allowlisted numeric GitHub operator ID and never trusts a browser-provided actor. The BFF signs a 30-second JWT with `judge:read`, method `GET`, exact route, issuer and audience `chargeguard-api`. NestJS independently verifies the JWT, signature/expiry/allowlist/Origin and requires the existing service read key. MongoDB `judge_runs` queries require `{owner,synthetic:true}` and omit owner fields. Without read-only provisioning the console displays an explicit error or no-run state.

Write preparation includes independent short-lived assertions bound to run/route/asset/body; JSON `{}` and Origin/`sec-fetch-site` checks; a distinct backend write key; owner/resource verification; MongoDB nonce and durable three-per-minute per-operator/action quota; atomic revision/status CAS and server-derived audit actor. **Both production BFF and Nest global middleware still hard-deny all POST writes**, regardless of configuration flags.

## Environment variables (names only)

| Provider | Existing or planned settings | Purpose |
| --- | --- | --- |
| Vercel | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPERATOR_GITHUB_IDS`, `NEST_API_BASE_URL`, `NEST_READ_API_KEY` | Keep current OAuth, identity list and service read credentials. |
| Both — owner-approved **read-only** run access, configuration pending | `OPERATOR_ASSERTION_SECRET`, `JUDGE_READS_ENABLED=true`; Render `OPERATOR_ORIGIN` equal to canonical `NEXTAUTH_URL` | Signed, path-bound GET assertions. The prior automated configuration attempt was blocked; these values are not yet configured. |
| Both — future **write** test | Distinct `JUDGE_WRITE_API_KEY`, `JUDGE_ROUTES_ENABLED=true` | Dormant until a new explicit approval and reviewed replacement for the production hard-403 gates. |
| Render | Existing `MONGODB_URI`, `MONGODB_DATABASE=chargeguard`, `BFF_READ_API_KEY`, `INGEST_API_KEY` | Preserve TLS, current scoped user and Atlas allowlist. Never reuse the ingestion/read key for judge writes. |
| Render observability | `DD_CLOUD_ENABLED=false`, `DD_ENV=prod`, `DD_API_KEY` metadata only | No cloud sends, paid features or production monitors before separate cost/owner approval; one-shot test remains dry-run. |

Generate the shared assertion secret from at least 32 bytes of secure randomness and enter it directly in the hosting provider's protected environment settings. Never output, commit or transmit secret values in chat. The signing secret must match between the two servers. The owner approved these **read-only** settings on 2026-10-23; production write settings and Datadog cloud ingestion remain excluded.

## Exact database writes if authorized later

**Exactly ONE run:** create a new `chargeguard.judge_runs` document with `_id: judge-<24 lowercase hex>`, `owner:github:<numeric-allowlisted-id>`, `stationId:demo-station-01`, one validated `chargerId:demo-charger-01`, `synthetic:true`, `status:BASELINE`, `revision:0`, `actions:[]`. Collection has MongoDB's built-in unique `_id`; an optional `(owner,synthetic,_id)` index supports scoped listing. Do not edit existing `chargers`, `incidents`, `telemetry`, `ingestion_receipts`, original Phase D incident `demo-58a1983cae09` or ACN records.

`chargeguard.judge_policy` stores unique `_id` nonce markers `nonce:<hash>` and conditional per-action/minute counters `quota:<hash>` with `expiresAt`. Default MongoDB `_id` index is the durable uniqueness constraint. Provision TTL on `expiresAt` (`expireAfterSeconds:0`) after confirming it cannot erase unexpired records; TTL is cleanup, not the authorization mechanism. One four-step lifecycle plus optional reset inserts at most five nonce markers and upserts at most five quota documents (assuming distinct action types/minute windows). Rejected actions may also consume records. Fixed-minute quotas permit limited boundary bursts and nonce writes are not in the same transaction as run CAS.

For **fault → acknowledge → recover → resolve → optional reset**, each successful action updates exactly the owned run's `status`/`revision` and appends one actor/time audit event. `fault` and `recover` append respectively `0 A/FAULT` and `8.25 A/CHARGING` *software-generated SYNTHETIC observations* inside the run; they do not assert measured EVSE current and do not write to Atlas time-series. Reset returns status to BASELINE, preserving observations and audit. A reliable outbox/remote recovery signal is not implemented; do not claim production Datadog monitor validation.

## Mandatory approval and verification gates

1. Review HTTP-boundary and abuse tests: session/CSRF/Origin/expired/wrong audience/path/body, unauthorized operator/run/asset, nonce replay, durable quota under concurrent requests, CAS conflicts, unauthorized reset, run isolation and pinned Phase D preservation.
2. Confirm private Git remote, deployed source SHA and actual Vercel→Render→Atlas GET readiness; confirm backend and BFF POST fault/reset/telemetry/judge routes return **403**. Ensure `/history` and raw ACN remain inaccessible online.
3. The owner authorized **one** precisely scoped run and it was created successfully, with only the `judge_runs` collection and built-in `_id_` index. Do not create a second run or pre-provision write-related collections/indexes. The approved read-only environment setup remains pending. Replacing production write-denial gates requires another reviewed authorization step.
4. If specifically authorized, create only that run, verify read ownership, then exercise isolated abuse cases. Compare original pinned Phase D and unrelated charger/incident collections before and after. Obtain **a further approval** before generating any production fault/telemetry.
5. If future fault test approved: perform one bounded synthetic cycle, inspect actual run/audit/observations; independently check Datadog US1 log/metric arrival/monitor states only after confirmed $0 eligibility and separate opt-in. Event-count monitor OK from a sliding window timing out **does not prove recovery**.
6. Rollback: disable writes, revoke new judge-only write key, preserve agreed evidence and delete only the explicitly identified judge run/policy records after separate cleanup approval. Never global-reset or delete the pinned Phase D records. Datadog submissions, if ever separately authorized, may not be retractable.

## Evidence and observability mapping (prepared; cloud OFF)

| Artifact | Proven state | Insufficient to prove |
| --- | --- | --- |
| `judge_runs.status`, `revision`, audit `actions` | Stored software incident lifecycle and verified actor | Physical charger failure or Datadog alert |
| `chargeguard.judge.fault_event` count | A synthetic fault action event occurred | Incident remains open or charger remains faulty |
| Datadog monitor `ALERT/OK` (production unverified) | Monitor evaluated its configured query | Physical recovery or durable incident closure |
| Run `observations` | Server-timestamped synthetic scenario samples | Real measured current or Atlas telemetry ingestion |

Sanitized planned local instrumentation: `judge.action` structured logs with bounded action/charger and run-ID correlation, `chargeguard.judge.action` counter with bounded action tag, and `chargeguard.judge.fault_event` counter. Run IDs must not become metric tags. Datadog US1 production ingestion is disabled and the one-shot validation is dry-run; no claim of actual production ALERT→OK.
