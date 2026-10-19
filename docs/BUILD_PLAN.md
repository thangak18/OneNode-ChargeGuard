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
- [ ] Build Next.js operations dashboard + incident view
- [ ] Implement synthetic faults, acknowledgment and resolution logs
- [ ] Complete two end-to-end scenario tests

## Phase D — Evidence & submission (29–31 Oct)
- [ ] Re-run demo from clean setup; sanitize repository
- [ ] Prepare README, setup, architecture and disclosure
- [ ] Record video, screenshots, slide deck and demo link
- [ ] Submit before **31 Oct 23:59 ICT**; grant access per organizer guidance

## Prioritization
**Must have:** historical replay, MongoDB time-series + Aggregation Pipeline, Datadog dashboard + alert + logs, incident narrative, runnable demo.
**Stretch only if time:** Change Streams on supported standard collections, APM/tracing, geospatial, anomaly detection, automated load distribution suggestion.
