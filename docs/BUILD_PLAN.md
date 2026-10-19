# Solo build plan — OneNode

> Preparation preceded 17 October; Phase A implementation began within the judged 17–31 October build window. Dates ICT. Completion below reflects **19 October 2026**.

## Preparation (14–16 Oct)
- [ ] Verify dataset reuse/redistribution rights (five local samples inspected; permission outstanding)
- [x] Finalize architecture, technology scope, acceptance tests
- [ ] Prepare dev accounts; request trial activation support if needed
- [ ] Break implementation into GitHub Issues

## Phase A — Ingest & model (17–20 Oct)
- [x] Initialize NestJS/TypeScript backend, validated environment and authenticated ingestion
- [x] Implement MongoDB time-series ingestion, indexes, idempotency and bounded aggregation
- [x] Create deterministic local ACN replay adapter/CLI with provenance and dry-run validation
- [x] Seed five virtual connectors and verify Atlas persistence and synthetic HTTP smoke tests

**Phase A test evidence (18 Oct):** 9 unit + 8 integration tests PASS; build and typecheck PASS; real Atlas init/seed and authenticated synthetic HTTP smoke PASS. Replay of 15 downsampled real-source readings validated locally in dry-run mode; uploading ACN source data awaits source-use permission. Datadog and Next.js have not been implemented.

## Phase B — Observability (21–24 Oct)
- [x] Emit structured application JSON logs and DogStatsD metrics; verify actual US1 receipt using synthetic HTTP tests (19 Oct)
- [x] Configure one functioning Datadog dashboard + monitor (Operations Dashboard with 11 widgets + 2 monitors verified in US1)
- [x] Record alert delay, false alarms and detection conditions (Run c8d1586804b5: Alert in 145s, Recovery in 197s, verified in Atlas + Datadog)

**Phase B verification status (19 Oct):** Operations Dashboard JSON artifact (`config/datadog/chargeguard-operations.dashboard.json`) and 2 monitor configs (`config/datadog/monitors/`) verified. Authenticated Atlas TLS is fully operational (`PASS_CERT_VERIFIED` on all 3 nodes). End-to-end incident run `c8d1586804b5` verified in Atlas (`incidents`, `incident_actions`, `telemetry`) and Datadog US1 (monitors 334137536 and 334137944 transitioned OK -> ALERT -> OK). 17 unit tests and 9 integration tests PASS. Ready for Phase C.


## Phase C — Product & response (25–28 Oct)
- [x] Build Next.js operations dashboard + incident view (existing Phase C UI preserved)
- [x] Implement synthetic faults, guarded acknowledgment/recovery/resolution and correlated logs
- [ ] Complete two end-to-end scenario tests

## Phase D — Evidence & submission (29–31 Oct)
- [x] Resume the original incident safely and verify Atlas/US1 end-to-end evidence; isolated integration fixtures remain reproducible
- [x] Prepare README, setup, architecture, evidence-based runbook, storyboard/slide outline and disclosures
- [ ] Record video, screenshots, slide deck and demo link
- [ ] Submit before **31 Oct 23:59 ICT**; grant access per organizer guidance

## Prioritization
**Must have:** historical replay, MongoDB time-series + Aggregation Pipeline, Datadog dashboard + alert + logs, incident narrative, runnable demo.
**Stretch only if time:** Change Streams on supported standard collections, APM/tracing, geospatial, anomaly detection, automated load distribution suggestion.

## Phase D resumption checkpoint — 19 October 2026

Original incident `demo-58a1983cae09` completed its protected API lifecycle and current Datadog fault-monitor ALERT → OK verification. Atlas confirms four actions, one affected-charger-only SYNTHETIC recovery and no writes to the other four chargers during resumption. Current checks: 24 backend unit, 11 backend integration and 2 web BFF tests; API/web typecheck/build plus web lint PASS. See [Phase D verification](PHASE_D_VERIFICATION.md) for observed timing limitations.

The second distinct fault-scenario rehearsal, actual video recording/final presentation export, organizer form/judge-access steps and any authorized deployment remain separate completion items. No new simulation was created merely to replace the existing incident. Preserve raw ACN exclusions; the completed demonstration is synthetic-only.
