# MUGVN Hackathon 2026 — submission readiness

**Deadline:** 23:59 ICT, 31 October 2026.  
**Last checked against official pages:** 19 October 2026.  
**Official sources:** [Terms](https://mini-hackathon-sep-2026.mugvn.com/terms), [Hackathon overview and minimum technical requirements](https://mini-hackathon-sep-2026.mugvn.com/#requirements).

The official terms list the required submission items below. They do **not** specify video duration, resolution, file format, slide count/file type, or an upload/hosting platform in the text reviewed. The suggested storyboard and deck below are team recommendations, not organizer requirements. Confirm any later submission-form instructions before recording/finalizing.

## Official submission items (terms §7.2)

| Requirement | ChargeGuard preparation | Status / final action |
| --- | --- | --- |
| Project name and problem description | ChargeGuard EV charging operations and incident response prototype; use README summary. | Prepared; verify final wording and avoid claiming physical charger support. |
| Team and contact information | Team name: OneNode, solo. | Fill in the requested leader/contact details privately in the organizer form; do not add personal details to public docs. |
| Solution/application architecture | Mermaid system boundary and notes in [Architecture](ARCHITECTURE.md). | Prepared; update the diagram only if deployment/runtime topology changes. |
| MongoDB data architecture and model | Time-series `telemetry`, bounded aggregation, regular assets/incidents/actions/receipts, TTL and idempotency are documented in [Architecture](ARCHITECTURE.md) and [schema design](MONGODB_SCHEMA_DESIGN.md). | Prepared; capture final Atlas schema/architecture evidence without credentials, addresses, or personal data. |
| Datadog observability architecture | Metrics/log flow and dated dashboard/monitor records in [Datadog preparation](DATADOG_PREPARATION.md). | Current same-incident US1 metrics/logs and monitor ALERT → OK are verified; see [Phase D report](PHASE_D_VERIFICATION.md). |
| Source repository link and installation guide | Private GitHub repository and root [README](../README.md), plus [local demo runbook](DEMO_RUNBOOK.md). | Prepared. Grant read access to judge accounts supplied by organizers before the deadline; maintain access through 22 November 2026. |
| README: environment, deployment/configuration, tests | Node 24, private env files, loopback services and test commands documented. | Prepared for local run. No public deployment is prepared or authorized; keep the demo loopback-only unless real operator authentication, authorization, CSRF and rate limits are implemented and reviewed. |
| Running MVP or accessible demo | Runnable local app with four UI routes and synthetic controls. | Local run path prepared. Public demo is blocked by missing operator authentication and unauthenticated read APIs; ask organizers whether a live local/screen-shared demo meets their judging process if needed. |
| Demo video | Storyboard below; use only synthetic incident input and scrub identifying account/environment details. | To record and link in the official form. No official duration, resolution, codec or host specified in the checked terms. |
| Final-round presentation slides | Suggested slide outline below. | To create/export according to any later organizer instructions. The checked terms do not specify slide count or file format. |
| Demonstrated operational scenario | Detect → investigate → recover → resolve with MongoDB evidence and Datadog confirmation. | Verified for original incident demo-58a1983cae09, including persisted investigation/recovery/resolution and Datadog ALERT → OK. |
| Reused code, external datasets, AI tools | Disclosures below and in [Compliance](COMPLIANCE.md). | Prepared; final form/video must disclose all relevant dependencies/data/AI assistance. |

The terms also prohibit uploading personal, confidential, production or regulated data to Atlas, Datadog, the repository or video; prohibit credentials in the repository/video; require rights for data used; and state that a private repository must be shared with judges and remain accessible through 22 November. The terms say the repository should not be changed after the submission deadline and judging uses the final pre-deadline commit. Capture the submission commit SHA and avoid post-deadline changes.

## Official minimum technical requirements (overview `#requirements`)

| Area | Official minimum | Evidence in project | Readiness |
| --- | --- | --- | --- |
| MongoDB primary data platform | MongoDB is the primary operational datastore. | NestJS persistence and MongoDB Atlas schemas/queries documented in [Architecture](ARCHITECTURE.md). Current API `/health/ready` returned connected during the Phase D session. | Implementation present; include a dated live read/write evidence run in final package. |
| MongoDB data design/access | Sound model and efficient access patterns; the use must be tied to the problem. | Telemetry time-series metadata, bounded indexed ranges, receipt fingerprinting and regular incident collections. | Documented; recheck final explain/query evidence if a submission-form rubric requires it. |
| MongoDB analytics | Use an Aggregation Pipeline for use-case analytics. | Analytics services aggregate current averages, state counts/activity and station summaries; see API source and [Architecture](ARCHITECTURE.md). | Implementation present; capture one reproducible query/result before submission. |
| Datadog dashboard | At least one dashboard for operational signals/system health. | Dashboard definition and dated US1 evidence in [Datadog preparation](DATADOG_PREPARATION.md). | Existing dashboard retained; current authenticated US1 access and exact-run telemetry verified in Phase D. |
| Datadog monitor/alert | At least one monitor tied to meaningful failure/degradation/risk. | Two monitor definitions and historical run evidence documented. | Current Phase D fault monitor ALERT → OK verified; separate ingestion-error monitor was not artificially triggered. |
| Additional Datadog capability | At least one of Log Management, APM, Distributed Tracing, RUM, Anomaly Detection, Agent Observability. | Sanitized application logs and historical US1 parsed-log evidence recorded; Agent forwarding configuration exists. | Current US1 logs verified by exact demo/incident context, including the resolved action. |
| Operational correlation | Connect metrics, logs, traces and operational context to support detect/investigate/resolve. | Bounded metric tags, incident IDs/actions and Datadog query context are implemented/documented; traces are not implemented. | Current same-incident metric/log/Atlas action correlation verified; tracing remains unimplemented. |

Recommended MongoDB Time Series Collections, window functions, TTL and other advanced MongoDB features are recommendations in the official page, not all mandatory gates. ChargeGuard uses a time-series collection and seven-day TTL.

## Suggested video storyboard (team recommendation, not an official format)

Target **4–5 minutes** only as a production suggestion; the official terms reviewed specify a demo video but no duration or technical format. Record one continuous truthful run if feasible; otherwise label edited/archived evidence with its original timestamps.

| Approx. time | Screen / action | Narration and proof |
| --- | --- | --- |
| 0:00–0:20 | Title, product and problem | State OneNode, ChargeGuard, and the virtual-charger scope. Explicitly say this is not connected to physical hardware. |
| 0:20–0:45 | Architecture diagram | Trace UI/BFF → NestJS → Atlas, plus Agent → Datadog. Explain local-only mutations and protected API writes. |
| 0:45–1:15 | Overview and charger detail | Show freshness, timestamps, current provenance and N/A unmeasured sensors. Identify ACN as historical only if authorized; otherwise use synthetic baseline. |
| 1:15–1:40 | Trigger a synthetic scenario | Show the named synthetic run, exact timestamp, returned incident ID and status. No secrets in terminal, URL, or screen. |
| 1:40–2:25 | Detect in Datadog | Show current monitor ID, ALERT state and timestamp; separately show matching metric/log and event context. If unavailable, say so rather than narrating an unverified alert. |
| 2:25–3:05 | Investigate | Show incident and telemetry in the UI/Atlas evidence, acknowledge action and the append-only timeline. Explain exactly which values are synthetic. |
| 3:05–3:40 | Recover | Submit recovery telemetry, show fresh positive reading and Datadog transition to OK with its timestamp. |
| 3:40–4:10 | Resolve and verify | Resolve through the UI, show updated incident state and action timeline. Correlate the incident with the same Datadog monitor/query. |
| 4:10–4:40 | Data, limits and disclosures | Identify source/reuse status, seven-day retention, no physical actuation, no production auth/deployment, dependencies and AI use. |

If a live system is unavailable, use clearly dated screenshots/recorded logs and state that they are historical; do not splice old monitor states into a new run as if current.

## Suggested slide outline (team recommendation)

1. **Title / team / one-sentence value:** ChargeGuard; virtual EV charging operations and incident response.
2. **Problem and scenario:** why current, faults, missing telemetry, and operator evidence matter.
3. **System architecture:** use the Mermaid diagram from [Architecture](ARCHITECTURE.md); label loopback/BFF boundaries and data flows.
4. **MongoDB design:** time-series shape, metadata, bounded aggregation, receipts/idempotency, TTL; show one actual aggregation result.
5. **Datadog observability:** dashboard, monitor query/threshold, log event fields, metric/log correlation; distinguish historical and live evidence.
6. **UI and provenance:** four screens, freshness state, measured/derived/synthetic distinctions, unavailable sensor values.
7. **Detect → Investigate → Resolve:** one incident ID; timestamped monitor ALERT, action timeline, recovery and monitor OK.
8. **Validation and operations:** Node 24 checks, runbook, reset/TTL recovery, local/offline fallback.
9. **Limitations / security / cost:** virtual chargers, no actuation, no remote authentication, no public deployment, bounded demo/trial usage.
10. **Disclosures / next steps:** ACN source and unresolved permission, third-party libraries, AI assistance, production-readiness gates.

## UI screenshots captured locally

The following screenshots were captured from the loopback UI on 19 October 2026 at desktop (1440 px) and mobile (390 px) viewports. They contain application UI only, no account credentials. They show the dataset's historical state at capture time; they are not evidence of a current Datadog monitor state.

| Screenshot | Page/state |
| --- | --- |
| [ui-overview-desktop.png](evidence/ui-overview-desktop.png) | Overview with stale telemetry explicitly marked and current shown as `N/A` rather than a fabricated zero. |
| [ui-chargers-desktop.png](evidence/ui-chargers-desktop.png) | Charger detail, historical telemetry, stale warning and sensor provenance. |
| [ui-charger-mobile.png](evidence/ui-charger-mobile.png) | Charger detail at 390 px with N/A for unmeasured sensors. |
| [ui-incidents-desktop.png](evidence/ui-incidents-desktop.png) | Synthetic incident queue/detail and persisted action evidence. |
| [ui-demo-desktop.png](evidence/ui-demo-desktop.png) | Demo controls with synthetic-data disclaimer; no credentials. |

The existing historical Datadog images [operations-dashboard.png](evidence/operations-dashboard.png), [ingestion-alert.png](evidence/ingestion-alert.png), [synthetic-fault-alert.png](evidence/synthetic-fault-alert.png), [ingestion-recovered.png](evidence/ingestion-recovered.png), and [synthetic-fault-recovered.png](evidence/synthetic-fault-recovered.png) document prior runs only. Do not label them as Phase D captures.

Additional Phase D evidence now captured (separate from the earlier UI/Phase B images):

| Suggested filename | Page/state |
| --- | --- |
| [phase-d-correlated-fault-log.png](evidence/phase-d-correlated-fault-log.png) | Exact incident/run/charger context in a real US1 synthetic fault log. |
| [phase-d-fault-alert.png](evidence/phase-d-fault-alert.png), [phase-d-fault-recovered.png](evidence/phase-d-fault-recovered.png) | Actual monitor 334137944 ALERT/OK for the same resumed incident. |
| [phase-d-ui-incident-resolved.png](evidence/phase-d-ui-incident-resolved.png) | Existing incident RESOLVED with its four-action audit timeline. |

Do not replace timestamps or present an inaccessible state as a current screenshot.

## Data, licensing, reuse and AI disclosures

- **ACN-Data:** Caltech ACN-Data and the separate ACN-Data-Static GitHub export were cited and five local `.csv.gz` samples were inspected. The public source repository does not establish an explicit redistribution grant in the evidence reviewed. Keep raw samples in ignored `data/raw/`; do not commit, upload to Atlas/Datadog, include in slides/video, or package traces until permission is documented. Cite source and authors as permitted; disclose that sample current is historical and the convenience sample does not represent five physical stations.
- **Synthetic content:** demo telemetry, fault codes, temperatures/scenarios where generated, incident actions and operator responses are synthetic. The Phase C incident API currently writes explicitly synthetic current/state/fault records. Never describe synthetic monitor signals as actual EVSE failures.
- **Libraries/reused code:** disclose the lockfile dependencies (Next.js/React/Tailwind/Recharts/Lucide, NestJS, MongoDB Node.js driver, Zod, test tooling) and any other upstream/template code actually reused. Follow each license; this checklist does not make a legal determination.
- **AI-assisted development:** disclose OpenAI Codex/ChatGPT, GitHub Copilot, Google Antigravity and Kiro assistance (the latter tools are owner-reported in the handoff) for preparation, backend/frontend implementation, security-boundary changes, tests, UI review and documentation; identify human review/verification. The owner must be able to explain the design and own the submitted work.
- **Credentials/privacy:** keep Atlas/Datadog keys, `.env` files, local datasets, personal data, private account pages and tokens out of repository history and screen captures.

## Final actions

- [ ] Recheck the organizer form/instructions for video, slides, link and access details; ask organizers about any format absent from the terms.
- [x] Complete the existing incident on Atlas, verify its resolved UI/actions and actual US1 metric/log plus ALERT → OK evidence; see Phase D verification.
- [x] Verify current US1 access and trial banner (14 days left); exact expiry/final-round coverage remains unconfirmed. No paid activation.
- [x] Re-run required Node 24 checks and review exact changed/staged files for credentials/raw/restricted data; private fast-forward sync is verified at release.
- [ ] Capture approved screenshots and finish video/slides with truthful live-vs-historical labeling.
- [ ] Confirm repository is private, add organizer-provided judge accounts before deadline, and preserve access through 22 November.
- [ ] Submit all §7.2 items by 23:59 ICT 31 October; record the final commit SHA and do not alter the repository after the deadline.
- [ ] Obtain written/source-published data reuse permission before replay or redistribution of raw ACN traces.

Current Phase D blockers and evidence are tracked in [Project Status](PROJECT_STATUS.md). This checklist is preparation, not a submitted hackathon entry.

## Current technical readiness

The critical Phase D lifecycle is verified for the original incident, with **24 API unit tests, 11 API integration tests, 2 web BFF tests**, typecheck/build and lint passing on Node 24. [Phase D verification](PHASE_D_VERIFICATION.md) distinguishes source/monitor/observer timestamps and preserves the initial incomplete snapshot. The private GitHub synchronization is performed only after exact-file secret review and fast-forward checks.

Remaining submission deliverables are the actual video recording/link, final presentation export/rehearsal, team/contact/form completion, and organizer-provided judge access. The storyboard and ten-slide outline above are ready to use; their suggested duration/count are not official requirements. ACN rights do not block the synthetic-only demonstration, but raw-source replay/redistribution remains prohibited until permission is documented. No public deployment or submission is authorized here.
