# Judge security and cloud observability preparation

Date: 2026-10-23. Baseline e398622. **Not ready to enable public mutations.** No production database writes or cloud incident test were performed. Existing production 403 middleware and BFF denial remain unchanged.

## Implemented supporting code

- Server-only NextAuth JWT verification helper derives numeric GitHub identity from the signed session cookie and rechecks current allowlist. It rejects cross-origin/non-same-origin fetches and non-JSON POSTs. No browser-supplied actor or operator ID is accepted. Assertions expire after 30 seconds and bind issuer, audience, operation, route, run, asset and body hash.
- Nest-side verification independently checks signature/algorithm, scope and identity. JudgeRunService additionally requires a separate write credential, validates stored run ownership and asset scope, consumes a Mongo nonce and durable three-per-minute per-action budget, then uses revision/status compare-and-swap for transitions. Different runs cannot modify each other. Audit actor is the verified subject.
- Isolated judge_runs state machine: BASELINE → OPEN → ACKNOWLEDGED → RESOLVING → RESOLVED; reset is permitted only from BASELINE/RESOLVED and changes only that run. It never updates existing incidents/chargers/telemetry. Original Phase D evidence is untouched. Provisioning is owner-controlled, not an exposed endpoint.
- Integration tests use disposable MongoDB only: lifecycle, other-run and original-incident preservation, wrong owner, read credential rejection, invalid transition, replay, concurrent faults, shared quota and fail-closed behavior.

## Remaining security gates

These are prerequisites, not an enabled interactive route. The assertion helper is not called by the BFF; JudgeRunService is not registered as a public controller. There are no production signing/write secrets or judge collections initialized by this change. Existing production denial is unconditional.

Before enabling: wire and test the actual BFF/session-to-backend guard route end to end (including logout/expired session/CSRF abuse); provision distinct read/write/signing keys; ensure backend write key differs from read/ingestion keys; implement isolated telemetry/outbox delivery and recovery proof before resolution; provision run ownership and policy cleanup explicitly; test crash/partial delivery semantics and audit retention; then request owner authorization. The current isolated state machine alone is not evidence of Atlas telemetry or Datadog recovery. Rate limits use fixed minute windows (boundary bursts possible); nonces are consumed on failed quota attempts; application state update and nonce consumption are not one transaction. Durable policy cleanup must not remove live nonce/quota records. Do not reuse the old station-wide reset.

## App-scoped Datadog HTTPS

CloudTransport integrates with the existing sanitized logger/metrics, disabled by default. DD_CLOUD_ENABLED=true with DD_ENV=prod and DD_API_KEY enables ChargeGuard-only US1 HTTPS intake. No workspace log stream is configured. Owner must first verify active trial/free quotas and store the key privately in Render. Never copy local .env or use NEXT_PUBLIC variables.

Fixed destinations: https://api.datadoghq.com/api/v2/series and https://http-intake.logs.datadoghq.com/api/v2/logs. Metric names and asset tags are allowlisted. Run IDs are log correlation fields, never metric tags. Counters use type count and one-second intervals; latency uses chargeguard.ingestion.processing_ms.sample as a per-event gauge, not local Agent histogram percentiles. Queue bound 100 per signal, five-second flush, three-second HTTP deadline, at most two attempts on 429/transient HTTP errors; auth failures are not retried. Dropped/failed counters are process-local diagnostics. Delivery is best effort: ephemeral process loss drops queued records, ambiguous retries may duplicate counts/logs, and flush can wait for the bounded transport budget. No production intake or fault alert is claimed.

Local monitors 334137536 and 334137944 are historical env:dev proof, not verified env:prod coverage. Before any cloud test, inspect their actual queries; use proposed prod-specific queries below rather than silently changing existing monitors:

- Fault: sum(last_1m):sum:chargeguard.fault.simulated{service:chargeguard-api,env:prod}.as_count() >= 1, no-data disabled, recovery at zero after window expires.
- Ingestion errors: sum(last_5m):sum:chargeguard.ingestion.failure{service:chargeguard-api,env:prod}.as_count() >= 3; demo abuse threshold, not charger safety.
- Missing heartbeat: not proposed until reliable cloud heartbeat instrumentation exists.

No monitors, recipients, paid resources or production fault events were created. API key acceptance (202) alone would not prove searchable intake or alert behavior. Owner must confirm trial/quotas, then observe real env:prod metric/log arrival and separately approve a fault test.

Official references: [metric submission](https://docs.datadoghq.com/api/latest/metrics/submit-metrics/), [logs](https://docs.datadoghq.com/api/latest/logs/send-logs/), [Render stream scope](https://render.com/docs/log-streams).

## Proposed future cloud-test approval scope — not executed

After all remaining security gates pass, ask approval for exactly one owner-scoped run and one virtual charger: create one judge_runs document; consume up to five nonce and five quota records; append five lifecycle actions (fault/acknowledge/recover/resolve/reset if separately requested); write only explicitly isolated synthetic fault/recovery observations via a reviewed outbox. Exact telemetry/receipt/outbox counts must be enumerated after that implementation, before approval. No existing charger document or Phase D incident may be changed. Cleanup may remove only new run-tagged documents after preserving sanitized evidence; Datadog intake cannot be assumed retractable. Do not request approval to execute this incomplete plan yet.

## Follow-up implementation — 23 October 2026

JudgeController is now registered and independently verifies the separate write credential and signed operator assertion before loading run scope. It validates the exact original JSON body bytes, restricts payload to {}, derives assets from the stored run, and rechecks ownership in JudgeRunService. The dedicated Next.js judge route calls the server-only assertion helper; both the new BFF route and existing global Nest production policy still hard-deny production writes. JUDGE_ROUTES_ENABLED alone cannot unlock production. No flag or environment setting was changed in the cloud.

The cookie verifier is tested with actual NextAuth-encrypted secure cookies: missing/forged/expired cookie, revoked/nonallowlisted ID, bearer-token substitution, cross-origin request, wrong fetch-site and content type are denied. NextAuth's getToken can otherwise accept Bearer headers; this boundary explicitly rejects them. No OAuth login/profile secret is logged.

Disposable Mongo + actual Nest HTTP tests cover anonymous writes, wrong key, owner mismatch, origin mismatch, payload/actor tampering and the isolated four-action lifecycle. Production policy denies even otherwise valid judge writes. Run updates append currentA 0/FAULT and 8.25/CHARGING observations with SYNTHETIC provenance inside the judge_runs document, atomically with transition/audit. These are illustrative software events, not physical readings. Investigate by inspecting the run document and append-only actions in a trusted local test; there is not yet an authenticated browser investigation view for these isolated runs. Each run caps at 100 successful actions; reset retains its audit and observations rather than deleting them. No domain collection or old incident is modified.

**Still blocked before an online interactive demo:** deployment review; owner-approved secret provisioning (distinct signing, write, read/ingestion keys); explicit run provisioning and cleanup scope; authenticated run investigation UI/read endpoint; telemetry/outbox integration if main telemetry charts/Datadog alerts are to represent the run; full deployed-session regression and final owner write authorization. Local state-machine resolution proves only the recorded synthetic transition, not physical recovery or a Datadog monitor recovery. Signing-key revocation/rotation and cookie logout do not instantly revoke an already-issued assertion (30-second lifetime). Rate limits are durable fixed windows; ambiguous business failures are fail-closed, not exactly-once retries. Do not bypass 403 to test a live incident.

Render metadata verification: service srv-dbcc2rd9fdbs73chm9e0 Environment UI contains the DD_API_KEY variable name with secret masked; no Show/Copy/export action used and no value read. The expanded list has no DD_CLOUD_ENABLED variable, so cloud transport defaults disabled. No intake activation occurred. One-shot Datadog check remains dry-run and product-specific $0 entitlement remains unconfirmed.

Final local checks (Node 24): 51 API unit, 19 integration and 11 web policy tests passed; API typecheck/build and web lint/typecheck/build passed. New session tests use NextRequest and actual NextAuth cookie encryption, not a mocked identity. No deployment/push or production request was necessary for these security tests. Datadog one-shot dry-run confirms zero requests and zero database writes. Secrets scan passed; original Phase D evidence and production denial code unchanged.
