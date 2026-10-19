# Phase D verification — 19 October 2026

## Preserved handoff and scope

The starting branch was `main` at `eee1471a6ec57e42a82abdccc64915fdb8f14fae`, matching `origin/main`. The tree contained 17 modified tracked files and eight untracked paths (including the pre-existing `.agents/` directory). All Copilot backend validation, four-screen UI/freshness/accessibility work, runbook, status/checklist and screenshots were preserved. A pre-edit tracked diff was saved locally outside the repository. `.agents/` remains user-owned and untracked; it is not part of the Phase D commits.

This continuation resumed **the existing** `demo-58a1983cae09` incident. It did not create a replacement incident, invoke the global demo reset, change Atlas network/security settings or Datadog notification recipients, activate paid services, deploy publicly or submit the entry.

## Actual lifecycle, Atlas and Datadog

Initial Atlas audit confirmed `OPEN`, station `demo-station-01`, charger `demo-charger-01`, scenario `SIM_OVERHEAT`, five original readings at `2026-10-19T05:22:54.966Z`, and exactly one `fault_injected` action. The fault has 0 A, `FAULT`, `SIMULATED_DEMO_FAULT`, and 72 °C; all supplied fields have **SYNTHETIC** provenance. Temperature is an illustrative stimulus, not a measurement or an EVSE safety threshold.

The existing US1 fault monitor is **334137944** with query:

```text
sum(last_1m):sum:chargeguard.fault.simulated{service:chargeguard-api,env:dev}.as_count() >= 1
```

Its authenticated configuration showed a one-minute sum, critical threshold 1, evaluation delay 0 seconds, no full-window requirement, missing data evaluated as zero, and no notification recipients/matching rules. Monitor **334137536** remains the separate ingestion-error monitor; this scenario intentionally did not manufacture ingestion errors or require it to alert.

The original fault already had a Datadog history entry `ALERT` at **12:23:44 ICT**, approximately 49 seconds after its source event. Its automatic `OK` at **12:24:44** happened while the incident remained OPEN: an expired count window does **not** prove operator remediation. To verify a current live lifecycle, 12 new labeled fault observations were accepted for the same run and charger, at ten-second intervals, without creating a second incident. No re-emission or recovery wrote another charger's telemetry.

| Event | Verified UTC timestamp | ICT |
| --- | --- | --- |
| Original source fault | 05:22:54.966Z | 12:22:54.966 |
| Original monitor ALERT, history | 05:23:44Z | 12:23:44 |
| First accepted re-emitted fault | 06:47:46.684Z | 13:47:46.684 |
| Re-emission monitor ALERT, history | 06:47:44Z | 13:47:44 |
| Recorded authenticated ALERT confirmation | 06:50:33.013711Z | 13:50:33.013711 |
| Investigation/acknowledgment persisted through API | 06:50:34.941Z | 13:50:34.941 |
| Recovery telemetry persisted through API | 06:50:35.474Z | 13:50:35.474 |
| Incident RESOLVED through API | 06:50:36.213Z | 13:50:36.213 |
| Monitor OK, history | 06:50:44Z | 13:50:44 |

**Latency interpretation:** recorded observer detection was **166.33 seconds**, an upper bound that includes polling/note-taking. The monitor's re-emission ALERT timestamp precedes the client event timestamp by 2.684 seconds; interval alignment or clock skew is possible, so exact internal detection latency is **not established**. Recovery-to-OK is **approximately 8.53 seconds** using the seconds-precision Datadog history timestamp; it is also about 64 seconds after the last re-emitted fault. This monitor measures event-count-window expiry, not physical recovery or a heartbeat. The original approximately 49-second history-based detection figure and older Phase B measurements are separate observations.

Final direct Atlas audit confirmed:

- The original incident is **RESOLVED**, still synthetic, with its original ID, station, charger and evidence retained.
- Four actions: `fault_injected`, `acknowledged`, `recovery_requested`, `resolved`.
- Exactly one recovery event `b2-58a1983cae09-2-1`, 8.25 A, `CHARGING`, with SYNTHETIC current/state; the absent temperature field remains absent.
- **Zero new telemetry readings for chargers 02–05 during this resumption.** All five original records remain present.

## Real metrics and logs

The existing macOS Agent process and its UDP listener at `127.0.0.1:8125` were observed. No protected Agent auth token was read. Actual US1 ingestion, rather than local socket sends alone, was confirmed by monitor ALERT/OK history and Logs Explorer.

Search:

```text
service:chargeguard-api env:dev @demo_id:58a1983cae09
```

US1 returned the original `demo.action` at **05:22:54.965Z**, new `fault.simulated` and `telemetry.accepted` records, investigation at **06:50:35.007Z**, recovery at **06:50:35.773Z**, and `action:resolved` at **06:50:36.305Z**. The inspected fault at **06:48:17.687Z** contained parsed `incident_id`, `demo_id`, `charger_id`, `station_id`, `service`, `env`, `source:synthetic` and warning status. The inspected resolved log retained the same incident and run IDs. These identifiers are log fields, not high-cardinality metric tags.

Actual metric families remain those implemented in `ObservabilityService`: ingestion success/failure, processing latency summaries, current, operational status, simulated faults, accepted and duplicate counts. Successful re-emissions drove the fault monitor; recovery set the reported charger state/current through accepted telemetry. An absence of new ingestion-error points is not a claim that an error signal was generated during this scenario. No heartbeat monitor was created.

Live artifacts:

- [Operations dashboard](https://app.datadoghq.com/dashboard/875-kis-zg2)
- [Synthetic fault monitor](https://app.datadoghq.com/monitors/334137944)
- [Ingestion error monitor](https://app.datadoghq.com/monitors/334137536)
- [Machine-readable evidence](evidence/phase-d-e2e.json)
- [Phase D alert](evidence/phase-d-fault-alert.png), [recovery](evidence/phase-d-fault-recovered.png), [correlated fault log](evidence/phase-d-correlated-fault-log.png), [resolved UI](evidence/phase-d-ui-incident-resolved.png)

The JSON retains the initial Copilot snapshot unchanged and appends `liveVerification`; initial UNVERIFIED/OPEN statements describe that historical capture only. Screenshots from Phase B are not relabeled as this run.

## Implementation safeguards added during resumption

- Recovery is restricted to the affected named virtual charger and requires prior acknowledgment. An immutable reserved event timestamp supports exact-payload retries; a recovery-completion marker is set only after successful telemetry ingestion.
- Resolution requires RESOLVING plus successful recovery telemetry. Acknowledgment cannot reopen a resolved/resolving incident. Retried acknowledgment, recovery and resolution do not duplicate their logical audit/telemetry records.
- Stable regular-collection audit IDs prevent duplicate actions on ordinary retries; this is application-level append-only behavior, not cryptographic or database-enforced immutability.
- Only generated demo/incident IDs and bounded virtual asset IDs are added to sanitized logs. Raw errors, payloads, headers and credentials remain excluded.
- UI action availability follows the validated lifecycle. Existing local BFF allowlisting, same-origin/loopback checks, 8 KB body limit and production mutation denial remain intact.
- `phase:d` is an explicit opt-in helper pinned to this existing incident. Its audit operations are read-only in Atlas and preserve prior audit snapshots in the evidence file. Pulse/recovery/resolution use supported protected HTTP endpoints; it never updates an incident directly in MongoDB.

## Regression results

Node.js **24 LTS** was used. The final command results and submission gates are summarized in [Project Status](PROJECT_STATUS.md). Backend checks: **24 unit tests, 11 integration tests, typecheck and build PASS**. Real Atlas diagnostic, role/schema/index audit and authenticated HTTP smoke PASS. Web checks: lint, **2 BFF policy tests**, typecheck and production build PASS. Browser review confirms the existing incident's four-action resolved timeline. Build was isolated from the dev server; local services remain loopback-only.

The Atlas smoke retries the previously labeled Phase A fixture; it does not inject another fault scenario. No original project records or raw ACN source files were deleted, reset or uploaded.

## Submission preparation, not submission

The critical same-incident lifecycle is verified. Recording the final video, exporting/rehearsing the final presentation, completing team/contact/form details, and granting read access to organizer-provided judge accounts remain owner release tasks. The storyboard, outline, architecture and security/data disclosures are prepared in the existing submission checklist. No official duration, codec or slide count is assumed.

The authenticated Datadog banner showed 14 trial days remaining; it did not establish an exact expiry date or guarantee coverage through the tentative 8 November final. Preserve dated evidence and a truthful local/recorded-demo fallback; obtain any extension confirmation through the owner/organizer without changing billing. Raw ACN reuse/redistribution remains unresolved; this completed demo uses synthetic fixtures only.

## Source preservation checkpoint

Implementation commit: `2ea9345` (`feat: harden Phase D incident lifecycle and preserve operator UI improvements`). Documentation and evidence are committed separately after security review. The pre-existing `.agents/` skill directory remains preserved and excluded from publication.
