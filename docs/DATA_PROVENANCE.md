# Dataset provenance, permitted use and privacy — 2026-10-14

## Source inventory

| Source | Publisher | Format described | Acquisition status | License / redistribution evidence |
| --- | --- | --- | --- | --- |
| https://ev.caltech.edu/dataset.html | ACN-Data, Caltech with PowerFlex | JSON via web UI or authenticated REST/Python API | Website documented; **no locally downloaded sessions** | **Specific reuse/license grant not verified.** Registration requested for API. |
| https://github.com/tongxin-li/ACN-Data-Static | Tongxin Li, static ACN export | Per-session `.csv.gz`, plus session-level export | README documented; **no locally downloaded sessions** | **No explicit redistribution grant verified.** Public repository visibility alone does not grant unrestricted redistribution. |

The ACN-Data site explains that data is collected for researchers and says API usage requires registration/token. Respect requests to avoid heavy `/ts` calls. The site reports a historic pre-2019-10-10 web-interface timestamp-offset bug; original timestamps should be inspected, preserved and corrected only with demonstrable source evidence. Do not claim an explicit Creative Commons or MIT license without seeing it in the relevant dataset terms.

## Future record-level traceability

For each authorized local session file, separately record: immutable source URL, repository commit SHA or API retrieval date, relative source path, local SHA-256 hash, original session ID (private local mapping only), sample count, original timestamp format/timezone, conversion/transform version, and data selection criteria. The local inventory containing identifying raw references belongs under `data/raw/acn/` and must remain untracked.

Suggested field-level audit categories:

- `ACN_REPLAY`: actual historical measurements and source session totals (never call them currently live).
- `DERIVED`: numerical results from source readings with explicit formula, assumptions and units.
- `SYNTHETIC`: generated temperatures, simulated charging states, fault codes, interruptions and operator responses.

Exclude source `userID`, `userInputs`, user-requested departure times and any directly identifying personal data from public demo/logs. ChargeGuard will replay offline sample data to **virtual** connectors after 2026-10-17; no live charger control is planned.

## Redistribution decision

**Pending written or explicitly published permission:** only store unmodified source samples locally in ignored `data/raw/acn/`. Do not commit, publish in Releases, put in demo fixtures or upload raw traces to third-party services. The README and source links may be cited. Store aggregated non-identifying results in project documentation after they are actually computed.

## AI assistance

Dataset research notes, dictionary proposal, safety conditions and offline inspection script were drafted with AI assistance on 2026-10-14; no generated sensor measurement is represented as observed ACN data. Later application work must separately disclose AI assistance and differentiate development-window commits.
