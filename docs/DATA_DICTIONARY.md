# Data dictionary — updated 2026-10-18

**Legend:** `SOURCE-OBSERVED` = present in the five inspected static files; `SOURCE-DOC` = official API documentation only, **not locally inspected**; `DERIVED` = computed with declared assumptions; `SYNTHETIC` = future simulator output. Empty/missing means unknown, not zero. Types are labeled separately as official API documentation, observed static-file types, or proposed application types.

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

## Static CSV export — observed in 5 files / 20,228 rows

Pinned source: [static README](https://github.com/tongxin-li/ACN-Data-Static/blob/abb7cf15cc7108913e965d4375cc7270d532b65f/README.md). All CSV cells are text on disk; numeric values below parse as finite Python floats / proposed BSON doubles.

| Exact header | Observed type | Missing / 20,228 | Meaning and evidence |
| --- | --- | ---: | --- |
| `""` (unnamed first column) | ISO 8601 datetime string, `+00:00` | 0 | Original source time; parse explicitly as UTC. |
| `Charging Current (A)` | Numeric string → double | 0 | Source-described measured current, range 0–30.8 A. |
| `Actual Pilot (A)` | Empty string only | 20,228 | No observed numeric type/limit in this subset. |
| `Voltage (V)` | Empty string only | 20,228 | No usable source voltage. |
| `Charging State` | String | 0 | Exported READY / ADAPTIVE / NOT CHARGING / IDLE / UNPLUGGED; physical/derived origin unverified. |
| `Energy Delivered (kWh)` | Numeric string → double | 0 | Exported counter, 0–11.5212047222 kWh; decreases/resets, final row 0 in all 5. Not validated session total. |
| `Power (kW)` | Empty string only | 20,228 | No usable source power. |

No sample JSON was downloaded. Official API objects above remain documentation-derived. No temperature, fault or incident columns observed.

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
| `voltageV` | double/null | Static header exists but sample values are all empty; only supply an explicitly declared assumption or synthetic value. |
| `powerKW` | double/null | `DERIVED`: formula must name volts, phase count, power factor; not a measurement. |
| `temperatureC` | double/null | `SYNTHETIC` for overheat scenario. |
| `chargingState` | string/null | Simulated app status or labeled heuristic; separate from exported state. |
| `sourceChargingState` | string/null | `SOURCE-OBSERVED` exported state label; semantics unverified. |
| `sourceEnergyKWh` | double/null | `SOURCE-OBSERVED` exported counter, preserve resets; no assertion of independent meter accuracy. |
| `faultCode` | string/null | `SYNTHETIC`; never misrepresented as real ACN faults. |
| `provenance.sourceType` | enum/string | `ACN_REPLAY`, `DERIVED`, or `SYNTHETIC`. |
| `provenance.syntheticFields` | array<string> | Explicit list of generated field names. |
| `provenance.derivedFields` | array<object> | Name, formula, constants/assumptions, units. |
| `provenance.sourceUrl` | string | Direct link to source record or repository root as permitted. |
| `provenance.transformVersion` | string | Future script/version used to map source to telemetry. |

**Observed spacing:** median 4 seconds in each sample, range 1–69 seconds; no uniform cadence guaranteed. **Types:** static observations above; API types remain documentation only. **Power note:** `P(kW) = V × I / 1000` is only valid for a suitable single-phase DC/AC case with appropriate power factor; AC three-phase needs a different formula. Source ACN current alone cannot establish delivered power accurately.
