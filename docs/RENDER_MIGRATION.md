# Render Free migration — preparation and Atlas approval gate

> **Update 7 November 2026 — synthetic live feed on Render.** The hosted Render API now writes labelled `SYNTHETIC` baseline telemetry for the five virtual chargers every 8 seconds while the free instance is awake (`apps/api/src/demo/synthetic-ticker.ts`), so the public read-only dashboard shows fresh data instead of "waiting for telemetry" once the 7-day TTL has expired older readings. It runs only on Render (`RENDER=true`), never on Vercel, and can be turned off with `CHARGEGUARD_SYNTHETIC_TICKER=false`. It writes telemetry and idempotency receipts only (7-day TTL); it never creates, changes or closes incidents, and HTTP mutations remain 403. Render's `autoDeployTrigger` is off, so a manual Render deploy is required to pick up this change.

## Current cloud status — 23 October 2026

The owner approved Option A, superseding the earlier rejection preserved below. The approved architecture is browser → Vercel Next.js/BFF → Render Free Singapore → existing Atlas Free. [Frontend](https://chargeguard-web.vercel.app) · [Backend liveness](https://chargeguard-api-m9ji.onrender.com/healthz).

On 21 October the authenticated Render API independently reconfirmed exactly `74.220.52.0/24` and `74.220.60.0/24`. Both were added to Atlas with comment `ChargeGuard Render Free SG (shared)` and verified Active. The original three /32 entries were preserved. These are **512 shared IPv4 addresses**, not dedicated application IPs. Other tenants in those ranges pass the network filter but still need valid database authentication and TLS. No all-address rule, paid feature, privilege expansion or credential reset was used.

**Expiry:** neither entry expires automatically. Atlas temporary entries are limited to seven days, insufficient for the 31 October deadline and November judging. Owner must review access after submission, keep it only for the agreed judging period, and remove only these two Render entries when cloud access is no longer needed. No renewal or cleanup automation has been installed.

### Verified deployment evidence

The 21 October native Render diagnostic (Node 24.22.0) passed SRV/TXT, IPv4, TCP 27017, TLS 1.3 and TLS 1.2 with normal certificate validation on all three nodes. The official MongoDB driver authenticated the expected application account, pinged successfully and read a charger. Effective-role checks confirmed only the expected custom role, absence of broad administrative roles, and privileges scoped to chargeguard. The temporary diagnostic flags were removed, redeployed, and its endpoint returned 404.

Authenticated readiness returned 200/database connected; charger reads returned five assets, incidents returned five persisted records, and aggregation returned 200. A bounded seven-day read returned five latest SYNTHETIC readings and 397 samples, latest timestamp `2026-10-19T06:50:35.474Z`. Default 24-hour data was empty: NO DATA/N/A is correct, not a fabricated live stream. Counts can later change under the existing retention policy.

Vercel project Environment Variables now point NEST_API_BASE_URL to the Render HTTPS origin (Production and Preview). OAuth and read-key settings were preserved; the legacy Vercel API was not deleted. Web and Render deployed reviewed source `6d439bc`. Browser checks on 21 October passed Overview, database-backed charger details, five persisted incidents including the existing Phase D timeline, synthetic-only disabled demo controls, desktop and iPhone-emulated 393×852 layouts/menu. GitHub login → logout → re-login passed, verified by session-presence booleans without logging profiles/tokens.

Production writes remain independently denied with 403, backend reads without the service key return 401, /history returns 404, and /api/historical returns 403. No accepted mutation, schema initialization, raw ACN upload or Phase D reset occurred.

23 October recheck: BFF readiness 200/database connected in **24.241 seconds**, then five chargers in 178 ms and five incidents in 160 ms. Reset POST 403; /history 404; /api/historical 403. Provider suspension was not independently established, so the first latency is not a confirmed cold-start measurement. [Sanitized current receipt](evidence/render-readonly-live-checks.json). Node 24: **45 API unit + 15 integration + 9 web policy tests**, API typecheck/build and web lint/typecheck/build all passed. Phase D evidence is byte-identical to starting commit 3e031ef. Supporting security code remains local/tested until a later deployment; production runtime source is 6d439bc.

### Cold starts and interactive-security boundary

Read-only BFF budget is 85 seconds for Render, route maxDuration 120 seconds; browser read budget 95 seconds. The actual Vercel project has Fluid enabled; its documented Hobby maximum is 300 seconds. Reads deduplicate, cancel on hidden/unmounted pages and poll serially with bounded Retry-After backoff. Render HTML wake pages become sanitized 503 responses. A delayed local fixture tests deadlines/cancellation, **not** an actual Render cold start. Real idle/suspension provenance is not established; no guaranteed wake-up time is claimed. No keep-alive cron or background warming was added.

`operator-preflight.ts` is dormant supporting code, not registered in AppModule or wired to a route. It verifies short-lived HS256 operator assertions bound to issuer, audience, allowlisted GitHub identity, operation, method, path, body hash and synthetic resources; protects the pinned Phase D incident; and supplies Mongo-backed nonce/quota primitives tested against disposable local MongoDB. It creates nothing in Atlas. The configurable 1–10/minute ceiling is an abuse-control demo policy, not an EV safety threshold. Fixed windows allow boundary bursts; nonce consumption fails closed and is not an exactly-once business transaction.

Before public mutations: implement trusted BFF assertion minting and separate server-only write credentials, backend guard wiring, same-origin/CSRF enforcement, durable policy collection lifecycle/indexes, server-side ownership checks for isolated new judge runs, atomic action/idempotency semantics, audit actors derived from verified identity, and independent end-to-end abuse tests. Current reset touches shared demo scope and must be redesigned to isolate new runs. Then request separate final owner authorization. OAuth alone does not unlock actions.

### Datadog and release status

DEPLOYED: yes. DATABASE CONNECTED: verified. READ-ONLY ONLINE FUNCTIONAL: verified. INTERACTIVE DEMO READY: no. DATADOG CLOUD VERIFIED: no.

Local env:dev Phase D ALERT → OK evidence remains intact and is not cloud proof. Render emits sanitized stdout with env:prod and cloud metrics disabled. Render Hobby log streams default to the whole workspace and cannot omit the two unrelated services; workspace forwarding was not enabled. Prefer ChargeGuard-only application HTTPS transport to US1 after verifying authorized API-key use and free/trial quotas. Metrics require correct count intervals/distribution semantics, bounded buffering/retries and sanitized fields. Verify real env:prod ingestion and alert/recovery before claiming success; do not duplicate local monitors blindly or enable paid features.

Sources checked: [Render Free](https://render.com/docs/free), [Vercel limits](https://vercel.com/docs/functions/limitations), [Render log-stream scope](https://render.com/docs/log-streams), [Atlas access-list expiry](https://www.mongodb.com/docs/atlas/security/ip-access-list/), [Datadog logs](https://docs.datadoghq.com/api/latest/logs/send-logs/), [Datadog metrics](https://docs.datadoghq.com/api/latest/metrics/submit-metrics/).


Date: 2026-10-21 (Asia/Ho_Chi_Minh). Starting code: `12f2e84`.

Owner-selected target: existing Next.js/GitHub OAuth on Vercel Hobby, NestJS on a Render Free Node web service in Singapore, existing Atlas Free cluster, total new paid services $0. No Atlas network entry may change before a separate approval of the actual service CIDRs.

## Prepared runtime

`config/runtime.ts` recognizes only the official `VERCEL=1` or `RENDER=true` provider flags. Hosted processes bind once on `0.0.0.0` and provider `PORT`; local development retains `127.0.0.1`. Hosted startup does not wait for an unavailable database: authenticated reads/readiness perform the existing coalesced connection checks. The database URI and least-privilege account, schemas, collections, indexes, seed behavior, URLs and original Phase D evidence are unchanged. No init/seed/fault/recovery/reset command is in a build or start hook.

Production middleware remains independently read-only, including when the Render flag is present but NODE_ENV is misconfigured. Hosted configuration requires NODE_ENV=production. All mutations return 403 before controllers. Existing API reads, readiness and diagnostics require the server-only read key; Swagger stays hidden and credentialed wildcard CORS stays disabled. The sole Render-only public GET/HEAD exception is `/healthz`, which returns only `{"status":"ok"}` without database access. POST `/healthz` is denied. Platform health does not prove database readiness.

Hosted runtimes do not read the repository `.env`, use local DogStatsD, or write macOS log paths. Sanitized JSON stdout is retained; `DD_ENV=prod` is separate from local `env:dev`. No Datadog key has been copied or cloud forwarding enabled.

## Reproducible service settings

`render.yaml` is an explicit Free-only Blueprint, validated by the official Render CLI/API before deployment. It creates no database, disk, worker, cron, paid networking or seed hook.

| Setting | Value |
| --- | --- |
| Name | chargeguard-api |
| Source | Existing private thangak18/OneNode-ChargeGuard, main |
| Root | apps/api |
| Runtime | Node 24.x; NODE_VERSION 24.22.0 |
| Plan / region | Free / Singapore |
| Build | npm ci --include=dev && npm run build && npm prune --omit=dev |
| Start | npm start |
| Platform health | /healthz |
| Automatic deployments | Off during migration and approval gate |

Server-only variables: MONGODB_URI, MONGODB_DATABASE, INGEST_API_KEY, BFF_READ_API_KEY. Nonsecret runtime configuration: NODE_ENV=production, NODE_VERSION, MONGOMS_DISABLE_POSTINSTALL=true, DD_ENV=prod, DD_METRICS_ENABLED=false. Render supplies RENDER=true and PORT. Do not copy the whole local .env: it may contain local-only settings. No CHARGEGUARD_LOG_FILE, Datadog API key, historical source file, local manifest or local ACN permission file is part of the deployment. Secrets must be sent only to the authorized Render account over its official HTTPS API and never placed in CLI arguments, Git, logs or browser code.

The existing Vercel NEST_API_BASE_URL and read credential remain unchanged until Atlas approval and successful Render readiness/reads. GitHub OAuth configuration and cookie/session code are untouched.

## Budget and platform limits

Official sources checked on 2026-10-21:

- [Render Free](https://render.com/docs/free): sleeps after 15 idle minutes, approximately one minute to wake; ephemeral files; 750 free instance hours shared per workspace each month. Build/bandwidth limits also apply. Without a payment method, exhaustion suspends service/builds rather than charging supplementary usage. No card or paid feature is added for this task.
- [Region availability](https://render.com/docs/regions): Singapore is supported; service region cannot later be changed in place.
- [Outbound networking](https://render.com/docs/outbound-ip-addresses): service may use any address in its assigned regional ranges, shared with other services. Do not substitute one transient reflected IP for the documented ranges.
- [Dedicated IPs](https://render.com/docs/dedicated-ips): paid workspace/add-on, outside this budget. Free does not provide an exclusive egress guarantee.
- [Render health checks](https://render.com/docs/health-checks): platform liveness is deliberately separate from service-key-protected MongoDB readiness.

Actual service URL, plan, source SHA, assigned outbound CIDRs and mathematical address counts must be recorded after creation. Proposed Atlas changes are additive only unless the owner explicitly chooses otherwise: retain existing entries, add only the individually approved Render ranges, never an all-address range. Sharing a range with unrelated tenants increases network trust compared with a private application's /32; TLS and database credentials are still mandatory. The approval gate must include these actual facts rather than guessed regional addresses.

## Cold-start plan — not yet a live verification

The current BFF remains at a 20-second timeout before the Atlas decision. The actual Vercel web project has Fluid Compute enabled. [Vercel documents a 300-second Hobby Fluid maximum](https://vercel.com/docs/functions/limitations), so a future 120-second route limit and an approximately 85-second read timeout can fit a normal Render wake-up plus database connection time. Confirm the effective setting during Phase 3 deployment.

Implement only after the network decision: longer budget for idempotent reads, request cancellation, sanitized warming/unavailable response with Retry-After, no HTML loading-page response misclassified as JSON data, no automatic retry for writes, and no overlapping client polls while a long read is in progress. Poll only for an actively viewed application; do not create a cron, monitor ping or hidden-tab loop to defeat idle suspension. Test with a controlled delayed fixture and an actual idle Render instance. Synthetic fixtures do not prove the real wake-up duration. No cold-start timing success is claimed at the approval gate.

Existing synthetic telemetry may be older than the UI's 24-hour default window. Do not rewrite timestamps or seed new records to make it appear live. After permission, use explicitly bounded reads and honest stale/no-data labels; keep historical ACN local and the pinned Phase D incident unchanged.

## Remaining interactive authorization work

Cloud writes stay denied until all of these are implemented/tested: backend verification of an authenticated operator identity independent of browser UI; explicit operation/resource scope; short-lived, audience-bound identity propagation; origin/CSRF checks; durable/distributed rate limits; rejection of unauthenticated telemetry and duplicate fault/reset abuse; isolation of new synthetic runs from Phase D; and no write credentials in browser JavaScript. GitHub login alone does not satisfy those requirements.

## Render-to-Datadog research — nothing enabled

[Render supports Datadog HTTPS log streaming](https://render.com/docs/log-streams). Its default is workspace-wide; Hobby cannot omit individual services. The inspected workspace already contains other Free services, so enabling a default stream could forward unrelated project logs and requires additional owner review. Do not activate it automatically.

An application-scoped HTTPS transport is an alternative for ChargeGuard-only sanitized logs and custom metrics, subject to an authorized server-side key and verified Datadog trial/ingestion limits. Preserve fixed chargeguard.* names, bounded tags, correlation fields, and env:prod separation. Direct metrics require intentional counter/timer/distribution semantics; they must not be declared equivalent to the existing Agent histogram summaries without tests. No new monitor/dashboard, log pipeline, paid add-on or API key is created here. Local macOS Agent evidence remains env:dev evidence.

## Verification and gate status

Preparation checks: 42 API unit, 13 integration and 5 web policy tests; API typecheck/build, web lint/typecheck/build passed with Node 24. Focused tests cover hosted binding, deferred database startup, Render public liveness without private data, private API service authentication, unconditional write denial, and rejection of local observability sinks on Render. Blueprint validation returned valid=true for one Free web service.

The actual service/URL, Free Singapore plan, Live deployment and shared CIDRs are recorded below. Atlas TLS/auth/ping/readiness, BFF switch, UI data, OAuth regression after the switch, real cold-start measurements and production Datadog intake remain pending. A Render Live label or /healthz=200 does not complete these checks.

Stop at the Atlas approval gate. Do not add, remove or replace any network entry without the owner's explicit approval of the displayed actual ranges and risk.


## Actual service and explicit Atlas decision — 2026-10-21

- Service: [chargeguard-api-m9ji.onrender.com](https://chargeguard-api-m9ji.onrender.com).
- [Render Dashboard](https://dashboard.render.com/web/srv-dbcc2rd9fdbs73chm9e0), service `srv-dbcc2rd9fdbs73chm9e0`.
- Actual plan/region: **Free / Singapore**. Initial deployment is **Live**, source `693de56854da84ec96259b56ebaaceabdaf1ad48`, auto-deploy **off**. The first deploy took 56.2 seconds in the UI; that is deployment time, not an idle cold-start measurement.
- Workspace Hobby, no payment method and $0 service charges were observed before creation. Two other existing Free services were left untouched. No card, paid instance, disk, dedicated IP or other paid feature was added.
- `/healthz` GET: 200 with only the status field. POST: 403.
- Private `/api/v1/health/live`: 401 without service key, 200 with it.
- Unauthenticated charger read: 401. Telemetry POST: 403. Fault POST even with read key: 403. Swagger: 404.
- No authorized database-dependent request was made: Atlas TLS/auth/ping/readiness/data reads wait for approval. The BFF origin remains the previous Vercel backend. The online application is **not declared functional through Render**.

Actual assigned shared outbound ranges, read from the authenticated Render API and cross-checked in Connect:

| Proposed addition | Full IPv4 addresses |
| --- | ---: |
| 74.220.52.0/24 | 256 |
| 74.220.60.0/24 | 256 |
| **Distinct total** | **512** |

Counts include every address in each CIDR, not just conventional usable host counts, and do not count machines or customers. The ranges do not overlap.

Rejected proposal (retained as historical context): **add only these two entries to the existing Atlas project's IP Access List, retain every existing entry, and use the comment `ChargeGuard Render Free SG (shared)`. No automatic expiry is proposed; later removal remains an owner decision. Do not remove/replace entries, use an all-address range, change TLS, credentials or privileges.** No Atlas entry has been changed.

These ranges are shared with other Render services in the region and are not exclusive to this service or workspace. Any workload using an address in the approved ranges passes the IP-filter layer; valid MongoDB authentication and TLS are still required. Free does not guarantee an exclusive narrower egress address. Using one currently reflected /32 instead of the assigned ranges is not a reliable replacement. Dedicated IPs require a paid workspace/add-on and were not enabled.

512 shared addresses materially expand the network trust boundary relative to exact private-application /32 rules. If the owner requires exclusive /32 egress, this Free option does not meet that requirement; stop the Atlas change and prefer an already-approved fixed-egress private VM or separately reviewed hosting alternative. No paid migration is authorized automatically.

**The owner explicitly rejected these shared CIDRs on 2026-10-21. Atlas remains unchanged and migration stops at this gate.** [Sanitized machine-readable evidence](evidence/render-atlas-approval-gate.json) contains the service, assigned CIDRs, test results and unperformed checks. The pinned Phase D JSON remains byte-identical to the starting commit. OAuth source/configuration is unchanged, but a new full live OAuth regression after the future BFF switch has not been claimed.


Pre-gate Vercel preservation checks: `/history` 404, `/api/historical` 403, GitHub provider endpoint 200 and fresh anonymous session endpoint 200. These establish production route protection/provider availability, not a new authenticated login/logout regression. The full OAuth lifecycle will be retested after the future BFF switch if approved.


## Owner decision — 2026-10-21

The owner rejected both proposed shared CIDRs and instructed that Atlas remain unchanged. No access-list entry was added, replaced or removed. The Vercel BFF was not switched to Render, and no further Render-to-Atlas connection or end-to-end migration work is authorized under this proposal. No other provider, paid egress or broader range is substituted automatically. The already-created Free Render service was left unchanged; no suspension or deletion was requested. Cloud data functionality remains unverified and blocked. Any alternative network/hosting proposal requires a new explicit owner decision. Phase D evidence, database privileges, credentials, TLS verification and local historical-data isolation remain unchanged.
