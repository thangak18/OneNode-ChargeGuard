# Data dictionary — proposed mapping (2026-10-14)

**Legend:** `SOURCE-DOC` = field reported in published ACN documentation, **not locally inspected**; `DERIVED` = computed with declared assumptions; `SYNTHETIC` = future simulator output. Empty/missing means unknown, not zero. Types below are **documented or proposed types**, not observed parser results.

## ACN official API — session objects

Reference: https://ev.caltech.edu/dataset.html , Fields and Time Series documentation.

| Source field | Documented type | Semantics | Proposed treatment |
| --- | --- | --- | --- |
| `_id` | string | Internal record identifier | Exclude from presentation. |
| `sessionID` | string | Session key | May retain pseudonymized trace reference. |
| `siteID` | string | Site identifier | Map to virtual station in demo. |
| `stationID` | string | EVSE identifier | Map to virtual charger identifier. |
| `spaceID` | string | Parking space identifier | Omit from public demo. |
| `clusterID` | string | Site-specific charger group | Optional, do not treat as physical network topology. |
| `connectionTime` | datetime string (RFC 1123, UTC) | Plug-in time | Source session boundary. |
| `disconnectTime` | datetime string (RFC 1123, UTC) | Unplug time | Source session boundary. |
| `doneChargingTime` | datetime string (RFC 1123, UTC), possibly absent | End of non-zero current | Validate missingness. |
| `kWhDelivered` | float | **Session total** energy kWh | SOURCE-DOC, never per-sample power. |
| `chargingCurrent` | timeseries object | Measured current trace in A | SOURCE-DOC; actual nesting and values unverified. |
| `pilotSignal` | timeseries object | Pilot current limit trace in A | SOURCE-DOC; distinct from actual draw. |
| `timezone` | string (pytz name) | Site timezone | Record as provided; timestamps are UTC per documentation. |
| `userID` | optional string | User identifier | Discard/redact from demo. |
| `userInputs` | list<object> | User-provided requests/estimates | Omit; potential personal data. |

Official `userInputs` fields documented: `WhPerMile` (float), `kWhRequested` (float), `milesRequested` (float), `minutesAvailable` (float), `modifiedAt` (datetime string), `paymentRequired` (boolean), `requestedDeparture` (datetime string), `userID` (string). They are **not required** for ChargeGuard and should not flow into application logs.

The official time-series docs name `timestamps` (list of datetime values) and the corresponding current/pilot list of floats. Validate actual nesting against authorized API JSON; this table must not be treated as a validated JSON schema.

## Static CSV export — README claims only

Reference: https://github.com/tongxin-li/ACN-Data-Static/blob/main/README.md . Each session is described as `.csv.gz` with a timestamp first column. The README names `Charging Current (A)` (float-like) and `Actual Pilot (A)` (float-like). **Exact first-column header, all additional columns, null representation and timezone offset are UNVERIFIED** until downloaded files are inspected. Do not rename columns in data or add inferred metrics without marking the transform.

## ChargeGuard planned telemetry fields — not implemented

| Target field | Proposed MongoDB type | Meaning / provenance |
| --- | --- | --- |
| `ts` | `Date` | Timestamp used for demonstration events (future replay may map historic time to simulated clock). |
| `sourceEventAt` | `Date` | Original recording timestamp if source provides one. |
| `ingestedAt` | `Date` | Future app insert time, distinct from source event time. |
| `meta.stationId`, `meta.chargerId` | string, string | Stable virtual device metadata for time-series bucketing. |
| `sessionId` | string | Pseudonymous source session reference; optional. |
| `currentA` | double/null | `ACN_REPLAY`: measured in source, if present. |
| `pilotA` | double/null | `ACN_REPLAY`: source pilot limit, if present. |
| `voltageV` | double/null | Absent from verified source docs; only present if `DERIVED` assumption or `SYNTHETIC`, explicitly labeled. |
| `powerKW` | double/null | `DERIVED`: formula must name volts, phase count, power factor; not a measurement. |
| `temperatureC` | double/null | `SYNTHETIC` for overheat scenario. |
| `chargingState` | string/null | `SYNTHETIC` or clearly tagged `DERIVED` heuristic; no measured source state confirmed. |
| `faultCode` | string/null | `SYNTHETIC`; never misrepresented as real ACN faults. |
| `provenance.sourceType` | enum/string | `ACN_REPLAY`, `DERIVED`, or `SYNTHETIC`. |
| `provenance.syntheticFields` | array<string> | Explicit list of generated field names. |
| `provenance.derivedFields` | array<object> | Name, formula, constants/assumptions, units. |
| `provenance.sourceUrl` | string | Direct link to source record or repository root as permitted. |
| `provenance.transformVersion` | string | Future script/version used to map source to telemetry. |

**Sampling interval:** unknown until direct inspection. **Type inference:** no actual numeric or timestamp type assertions have been made from raw samples. **Power note:** `P(kW) = V × I / 1000` is only valid for a suitable single-phase DC/AC case with appropriate power factor; AC three-phase needs a different formula. Source ACN current alone cannot establish delivered power accurately.
