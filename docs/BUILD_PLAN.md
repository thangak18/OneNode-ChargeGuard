# Solo build plan — OneNode

> Before 17 October: design and research only. Judged core features begin 17 October, with commits and disclosures. Dates ICT.

## Preparation (14–16 Oct)
- [ ] Verify dataset license and inspect a small sample
- [ ] Finalize architecture, technology scope, acceptance tests
- [ ] Prepare dev accounts; request trial activation support if needed
- [ ] Break implementation into GitHub Issues

## Phase A — Ingest & model (17–20 Oct)
- [ ] Initialize TypeScript backend and configuration templates
- [ ] Implement MongoDB time-series ingestion and aggregation
- [ ] Create deterministic dataset replay with provenance tags
- [ ] Seed 5–10 virtual connectors and test persistence

## Phase B — Observability (21–24 Oct)
- [ ] Emit structured logs/metrics to Datadog
- [ ] Configure one functioning Datadog dashboard + monitor
- [ ] Record alert delay, false alarms and detection conditions

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
