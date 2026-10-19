# Hackathon compliance and source disclosure

## Organizer timeline
Per 13 October 2026 organizer email to team OneNode, the judged core solution must be built **17–31 October 2026**. Pre-period commits here document only preparation, not operational implementation. Confirm ambiguity with organizers if necessary.

## Required disclosures
Maintain a list of (1) reused code/libraries; (2) external datasets and usage terms; (3) AI-assisted work and extent of assistance. Initial planning content in this repository was drafted with ChatGPT assistance on 14 October 2026.

## Data & security
Do not commit real customer data, personal data, credentials, Datadog keys or database URIs. Use synthetic faults and labeled replay. Keep private repo access limited, and add judges using the eventual official instructions.

The web BFF keeps the ingestion key server-side, exposes only an explicit API
route/method allowlist, validates and bounds mutation payloads, and accepts
mutations only from a same-origin loopback development interface. Mutations
fail closed when `NODE_ENV=production`; this local-demo restriction is not
operator authentication and does not authorize public deployment. Remote
operator access remains blocked until authentication, authorization, and
deployment-appropriate CSRF and rate limiting are implemented.

## Official sources
- Competition rules: https://mini-hackathon-sep-2026.mugvn.com/terms
- Organizer support: mugvnleaders@gmail.com

AI-assisted preparation follow-up completed on 18 October 2026: local sample acquisition, offline inspection-script corrections, schema naming alignment and factual documentation/GitHub progress updates. No backend, replay, simulator, frontend, incident logic or observability integration was implemented in this task. Original preparation dates are historical; this follow-up is dated after the official 17 October start and does not backdate work.

AI-assisted implementation work dated 19 October 2026 includes Phase C dashboard and BFF changes, related backend incident/demo integration, tests, security review/remediation, and documentation. Existing project code, dependencies, and the cited ACN-Data source remain subject to their respective licenses and terms; AI assistance does not change those obligations.
