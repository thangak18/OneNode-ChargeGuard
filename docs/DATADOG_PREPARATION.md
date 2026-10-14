# Datadog monitoring preparation — 2026-10-14

**Status: PLANNED; no authenticated Datadog session, verified trial or integration.** All below is design only. Activation timing remains an owner task to keep any time-limited trial available during 17–31 Oct. Datadog links and supported plan features should be verified in the account once provisioned: https://www.datadoghq.com/ and https://docs.datadoghq.com/ .

## Proposed minimum demo dashboard

Display 5–10 virtual chargers with simulated state and historical/replayed `currentA` (source data after field verification). Panels to add during the build window: current by charger, source-data gap count, synthetic over-temperature, active incidents by severity/status, ingestion delay, and last recovery timestamp. Display labels `ACN historical replay`, `derived` and `synthetic` prominently. Power in kW only after voltage assumptions and formula are disclosed.

## Proposed monitor and evidence

**Primary monitor:** a deliberately synthetic `chargeguard.simulated_temperature_c` metric for one virtual charger exceeds an **illustrative demo threshold** (e.g., 65°C) for a defined window. The value and threshold are not hardware-safety data. Trigger a test alert during 17–31 Oct, record event time, monitor notification time and measured delay. A secondary simulated power-loss/absence alert is optional: distinguish **zero current** from **missing samples**, not conflating them.

Recommended future metric/log names: `chargeguard.charger.current_a`, `chargeguard.simulated_temperature_c`, `chargeguard.telemetry.replay_lag_seconds`, `chargeguard.incident.open`, `chargeguard.ingestion.error`; structured log keys `service`, `environment`, `station_id`, `charger_id`, `scenario`, `incident_id`, `timestamp`, `provenance_source_type`. Avoid high-cardinality user/session identifiers in metric tags; keep only sanitized trace links in logs.

## Security and timing

Never check in Datadog API/application keys. Keep secrets in local `.env` and later in secret storage on the server. Do not submit raw ACN data or user IDs in metric/log payloads. The actual monitoring account, free-trial activation, site/region, pricing and available monitors remain **UNVERIFIED**.

Owner action by 16 Oct: check the event/organizer email and Datadog account status, ask organizer if trial activation is missing, and activate a trial only when its duration safely covers the implementation/demo window. Obtain confirmation on trial start/end and free/charged features in the Datadog UI; do not authorize paid conversion without approval.

No Datadog library installation, key deployment, metric emission or monitor configuration is included in pre-hackathon preparation.
