# ChargeGuard project status

**Updated:** 19 October 2026. This is a local development/demo application, not a production charger-control or safety system. **The critical Phase D incident lifecycle is verified; submission packaging remains.**

## Implemented

- **Phase A:** NestJS telemetry ingestion, bounded MongoDB aggregation, MongoDB time-series storage, provenance, and replay tooling.
- **Phase B:** opt-in DogStatsD metrics, sanitized JSON logs, a dashboard, and two monitors. Historic US1 observations and current Phase D checks are distinguished in [Datadog preparation](DATADOG_PREPARATION.md).
- **Phase C:** Next.js operations overview, charger detail, incident queue/timeline, and demo control center; charger, station, incident, and synthetic demo endpoints.
- **Local BFF boundary:** explicit route/method allowlist, same-origin loopback-only development mutations, 8 KB body limit and schema validation, server-side API key, and mutation denial in production. This is not operator authentication; public or remote deployment is blocked.

## Copilot baseline verification — before this resumption

Node **v24.22.0** was acquired from the official macOS ARM64 distribution and checksum-verified. Tests/builds below used that runtime.

| Area | Result |
| --- | --- |
| API unit tests | 23 passed |
| API integration tests | 10 passed |
| API typecheck and build | Passed |
| Web lint | Passed |
| Web BFF policy tests | 2 passed |
| Web TypeScript check | Passed |
| Web production build | Passed |

API tests use isolated fixtures. The production build was run after stopping the dev server to avoid `.next` output races.

## Copilot UI quality checks — reported baseline, preserved screenshots

- `/`, `/chargers?id=demo-charger-01`, `/incidents`, and `/demo` returned HTTP 200 at 1440, 1024, 768 and 390 px. No document-level horizontal overflow was found.
- H1 headings and button names were present across the routes. The mobile navigation expanded from keyboard focus with Space; the narrow charger provenance table is a labeled, focusable region with touch and Left/Right Arrow scrolling. Status/error copy uses live-region roles.
- The overview showed **STALE** when the five latest reads were older than 60 seconds and `N/A` for aggregate active current. Zero-current is no longer treated alone as proof of a fault.
- Missing temperature remains `N/A (Unmeasured)`; only `SIM_OVERHEAT` now writes a labeled illustrative 72 °C synthetic value. The Datadog monitor counts fault events, not a temperature threshold.
- UI captures from this local state are in [evidence](evidence/). These screenshots are not Datadog transition evidence.

## Historical Copilot capture — partial at 05:28:37Z (superseded below)

Run started from the loopback Next.js `/demo` UI on 19 October; the API was connected to the configured Atlas database. See timestamped machine-readable evidence in [phase-d-e2e.json](evidence/phase-d-e2e.json).

| Stage | Observed result |
| --- | --- |
| Precondition | `GET /api/v1/incidents` returned no active incident. |
| UI trigger | `SIM_OVERHEAT` for `demo-charger-01`; UI displayed the success status. |
| Atlas readiness | `{"status":"ready","database":"connected"}` at 05:28:37Z. |
| Incident | `demo-58a1983cae09`, `OPEN`, detected 05:22:54.894Z, synthetic. |
| Telemetry | Five new synthetic readings persisted at 05:22:54.966Z; fault event has 0 A, `FAULT`, `SIMULATED_DEMO_FAULT`, and illustrative 72 °C with field-level `SYNTHETIC` provenance. Four other connectors received 8.25 A baseline readings. |
| Application log | `demo.action` at 05:22:54.965Z plus five `telemetry.accepted` JSON events at 05:22:55.133–05:22:55.685Z. |
| Investigation/recovery/resolution | Paused while attempting current Datadog verification; incident remains `OPEN`. |
| Datadog metrics/logs and monitor ALERT → OK | **Not verified.** No transition is claimed. |

The local Datadog Agent processes are present, but UDP 8125 had no listener at the check. The unprivileged Agent status command could not read its protected token; the browser remained at Datadog login. Ask the user to authenticate directly in the browser and start/verify the existing Agent. Never request or commit keys. Once access is restored, inspect current metric/log ingestion and the real monitor before acknowledging, recover, and resolve the still-open incident.

The configured station's latest telemetry before this scenario was **synthetic baseline**, not active ACN replay. The UI and README now avoid describing this snapshot as ACN data. Dataset reuse/redistribution permission remains unresolved; do not add raw sessions to Git, Atlas or Datadog without permission.

## Security and release decision

- Keep API and web on loopback. Do not use a tunnel, LAN binding or public deployment.
- The read API is unauthenticated. Production mutation blocking alone is not sufficient protection for public access. Remote deployment requires real operator authentication, authorization, CSRF protections and rate limiting.
- API readiness proves the running service's database connection at that time; it is not an independent Atlas roles/certificates/security audit.
- Do not activate paid services, change repository visibility or deploy publicly without owner approval.
- The official checklist requires read access for judge accounts before the submission deadline and through 22 November 2026; keep the repository private unless the owner decides otherwise.

## Handoff gates — historical, before the verified resumption

- [ ] Authenticate to Datadog and verify current dashboard, metrics, logs and the same-run monitor `ALERT` then `OK` with timestamps.
- [ ] Complete the investigation action, recovery telemetry and resolution on the existing open synthetic incident; verify audit records and final UI state.
- [ ] Re-capture final UI screenshots after the lifecycle and keep Datadog screenshots separate from historical evidence.
- [ ] Re-scan the exact staged file set for credentials, local datasets and restricted content; confirm fast-forward before any commit/push.
- [ ] Fill the official submission form and team-contact fields; confirm any video/slide format the organizer specifies.
- [ ] Keep the repository private, grant organizer-specified judges access by deadline, and do not change it after 23:59 ICT 31 October.

See the [local demo runbook](DEMO_RUNBOOK.md) and [submission checklist](SUBMISSION_CHECKLIST.md). Phase D is **not complete** while live Datadog proof and the incident lifecycle remain pending.

## Verified same-incident resumption — 19 October 2026

**PASS:** `demo-58a1983cae09` was audited OPEN, retained its five original synthetic readings and was completed through protected HTTP APIs. Acknowledgment, one-charger recovery and resolution persisted four total actions. Direct Atlas readback confirms RESOLVED, 8.25 A SYNTHETIC CHARGING recovery telemetry and zero writes to the other four chargers during resumption. No global reset or replacement incident was used.

US1 monitor `334137944` confirmed the resumed ALERT → OK cycle; exact-run Logs Explorer records include the original injection, fault, telemetry, investigation, recovery and resolved action. The timeline shows ALERT 13:47:44 and OK 13:50:44 ICT. Recorded observer detection was 166.33 s (polling-inclusive upper bound); reported-history recovery was approximately 8.53 s after accepted recovery telemetry. Timeline/clock precision prevents claiming exact internal detection latency. See [the full verification report](PHASE_D_VERIFICATION.md) and appended `liveVerification` in [phase-d-e2e.json](evidence/phase-d-e2e.json).

| Current check | Verified result |
| --- | --- |
| API unit / integration | **24 / 11 passed** |
| API typecheck / build | **PASS** |
| Real Atlas TLS, scoped authentication/ping, schema/index audit, HTTP smoke | **PASS** |
| Web lint / typecheck / production build | **PASS** |
| Web BFF policy tests | **2 passed** |
| Incident + action + recovery readback | **PASS, original incident RESOLVED** |
| Current Datadog exact-run logs and fault monitor ALERT → OK | **PASS** |

The source changes preserve the Copilot improvements and add guarded/idempotent lifecycle transitions, affected-charger-only recovery and sanitized incident log correlation. The existing BFF restrictions remain unchanged. The older pending gates above are retained as history; live authentication, Agent listener and current E2E evidence are now verified. Video recording, final slides, organizer form/contact details and judge access remain final release tasks. The repository stays private; no public deployment, paid upgrade or submission was performed.

## Optional local historical mode — 19 October 2026

The verified synthetic lifecycle remains unchanged. A separate, development-only `/history` viewer now uses the existing ACN adapter directly on checksum-verified ignored files, without historical uploads to Atlas/Datadog. Recheck: 20,228 source rows, 1,246 selected readings, five matching hashes and one exported filename prefix (physical identity unverified). Current local-mode/regression checks pass: 29 API unit, 11 API integration and 4 web policy tests, typecheck/build/lint. Production rejects historical data access even with the opt-in flag enabled; raw files are excluded from output tracing. Permission for cloud/public use remains unconfirmed and the replay CLI requires a private scope/content-specific attestation before execution. See [Historical Local Mode](HISTORICAL_LOCAL_MODE.md).

## Historical finalization and submission preparation — 19 October 2026

Current implementation is unchanged from the verified local historical mode: five matching hashes, 20,228 source rows, 1,246 selected points, one source filename prefix, no independent physical-EVSE identity validation. Cloud/public/redistribution permissions remain unconfirmed. Historical source rows were not uploaded to Atlas, Datadog or GitHub. The completed Phase D evidence is retained unchanged, without a fresh incident cycle.

The package now has a reproducible private walkthrough, an unsent dataset-owner permission inquiry, Vietnamese hybrid video storyboard and presentation outline, and a concrete judge-access plan. Actual video recording, final slide export, dataset permission, organizer-provided judge accounts, accessible-demo approval, exact Datadog trial expiry and official form remain owner tasks. The repository is private and personal; GitHub offers no read-only collaborator role in this ownership model. No invitations, visibility changes, public deployment or submission were made.

See [submission checklist](SUBMISSION_CHECKLIST.md) for the final gates. Node 24 regression and release verification results are recorded in the finalization section of [Historical Local Mode](HISTORICAL_LOCAL_MODE.md).


## Vercel deployment update — 2026-10-21

- DEPLOYED / HTTP REACHABLE: separate `chargeguard-web` and `chargeguard-api`, confirmed Hobby account and Node 24.
- DATABASE CONNECTED / READ-ONLY FUNCTIONAL: blocked; Atlas readiness and charger reads return 503.
- INTERACTIVE DEMO VERIFIED: no; all production mutations remain denied. GitHub login is prepared but OAuth owner configuration and complete backend operator authorization/rate limits remain outstanding.
- DATADOG VERIFIED in production: no; JSON stdout observed, Agent stays local and paid drains are not enabled.
- Local regression: 33 unit API, 12 integration, 5 web policy tests, typechecks, lint and builds pass. Historical and existing Phase D records were not uploaded/reset.

See [deployment report](VERCEL_DEPLOYMENT.md). Earlier local Phase D verification remains historical evidence and must not be represented as a newly verified cloud lifecycle.
