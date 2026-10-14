# ChargeGuard
**Real-time EV Charging Station Monitoring & Incident Response**

**Team:** OneNode (solo) · **Event:** MUGVN Hackathon 2026 — IoT Monitoring System: Real-time Operations

> Status: **Planning only (14–16 October 2026).** The judged core implementation is scheduled for **17–31 October 2026** in accordance with organizer guidance. This repository does not yet contain an implemented MVP.

## Problem
EV charging operators need to detect overload, device faults, and charging interruptions; investigate what happened; and respond with evidence that service has recovered.

## Proposed solution
ChargeGuard is a monitoring and incident-response prototype for EV charging stations:
1. Ingest and replay charging-session telemetry from a cited public dataset.
2. Label and inject synthetic sensor signals and controlled failure scenarios.
3. Store and aggregate time-series data with **MongoDB**.
4. Visualize operational health and configure monitors with **Datadog**.
5. Demonstrate **Detect → Investigate → Resolve**, including an auditable incident timeline.

## Planned MVP (solo-developer scope)
- 5–10 *virtual* charging connectors (not physical chargers)
- Charging power/current and session timeline; temperature and fault codes clearly marked **synthetic**
- Station/connector dashboard with near-real-time updates
- Over-temperature (simulated) and unexpected power-loss scenarios
- A Datadog dashboard, at least one working monitor, and log-based investigation
- Recovery verification and a reproducible demo

**Non-goals for MVP:** real charger control, production integrations, a trained failure-prediction model, deployment to safety-critical equipment.

## Proposed architecture
`Historical dataset → replay/fault simulator → TypeScript ingestion API → MongoDB time-series + incidents → Next.js dashboard`

The ingestion service also emits observability signals to **Datadog** (logs, metrics, optional APM). The Datadog monitor is a separate part of the incident demonstration.

See [Architecture](docs/ARCHITECTURE.md), [Data Plan](docs/DATA_PLAN.md), [Build Plan](docs/BUILD_PLAN.md), [Demo Scenarios](docs/DEMO_SCENARIOS.md), and [Compliance](docs/COMPLIANCE.md).

## Dataset candidates (not yet ingested)
- [ACN-Data (Caltech)](https://ev.caltech.edu/dataset)
- [ACN-Data Static](https://github.com/tongxin-li/ACN-Data-Static)

The final dataset subset, schema and usage permissions must be verified. Historic readings replayed live are **not** live measurements from real chargers. Synthetic values will carry provenance fields and be disclosed in the submission.

## Competition milestones (ICT / UTC+7)
| Date | Milestone |
|---|---|
| 14–16 Oct 2026 | Planning, architecture, dataset review, repository / issue setup |
| 17–31 Oct 2026 | Judged core implementation & Datadog trial |
| 31 Oct 2026, 23:59 | Submission deadline |
| 1–4 Nov 2026 | Preliminary evaluation (tentative) |
| 5 Nov 2026 | Top 8 announcement (tentative) |
| 8 Nov 2026 | Online final (tentative) |

## Submission checklist
- [ ] Problem statement and team details
- [ ] Architecture, MongoDB data model and Datadog observability design
- [ ] Source repo and reproducible README instructions
- [ ] Working / accessible MVP, video and presentation slides
- [ ] Detect → Investigate → Resolve incident walkthrough
- [ ] Disclosure of external datasets, reused code and AI assistance
- [ ] Judge access for private repository as instructed by organizers

## Security and transparency
Never commit credentials, connection strings, customer/production data, personal information or secrets. Keep `.env` local; use placeholders and secret management in the build phase. Distinguish measured source data, derived fields and synthetic faults in code and demo.

**Official rules:** https://mini-hackathon-sep-2026.mugvn.com/terms
