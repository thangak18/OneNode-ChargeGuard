# Datadog trial: one-shot cloud intake approval gate

Checked 23 October 2026. No production telemetry enabled, no paid plan selected, no cloud test executed.

## Account observations versus entitlement

Authenticated US1 UI: global banner says 10 trial days remain; Pro subscription form estimates $20.55/month based on past trial usage, with unselected automatic-renewal checkbox. Usage Product List shows Indexed Logs (15 Day Retention), 1.21K log events, and a Custom Metrics row whose total is a dash (not proof of zero usage/quota). Trial Management says no product trials available; this does not establish that the global trial has expired. No upgrade, new trial or subscription was clicked.

Owner reports no invoice/payment card/Pro subscription, and DD_API_KEY saved or being saved in Render. Key presence was not independently verified; no value was read or copied. The global trial banner and projected bill do not establish exact remaining free allowances or overage treatment for Logs and Custom Metrics. **Account-specific $0 entitlement remains unconfirmed.** Obtain explicit product trial/end-date and billing treatment from existing account details or Datadog Support before sending. No support message has been sent on the owner's behalf.

Official references: [free trial includes metrics/log exploration](https://www.datadoghq.com/free-datadog-trial/), [usage details](https://docs.datadoghq.com/account_management/plan_and_usage/usage_details/), [product allotments](https://docs.datadoghq.com/account_management/billing/product_allotments/), [custom metrics billing](https://docs.datadoghq.com/account_management/billing/custom_metrics/). Public marketing and general billing rules do not prove this organization's exact entitlement. Do not treat absence of invoices as a spending cap. Recheck expiry before running; do not infer an exact November expiry timestamp from the rounded 10-day banner.

## Prepared bounded test (not activated)

`apps/api/scripts/cloud-intake-check.ts` defaults to dry-run, does not import application/bootstrap/database/config dotenv code, has no timer, and exits. Execute once in the Render runtime only after approval; do not enable DD_CLOUD_ENABLED.

Maximum payload: one static synthetic setup log and one gauge datapoint for one series `chargeguard.cloud_intake_check`, tags service:chargeguard-api, env:prod, purpose:intake_check. Random check_id is a log field only. No station/charger records, ACN data, OAuth identity, host names, secrets or old Phase D payloads are transmitted. Two fixed US1 HTTPS POSTs maximum, three-second timeout each, no retry, stop on first non-2xx. No fault metric or existing monitor trigger is intended. Metrics cardinality is one fixed tag combination (subject to Datadog processing), not zero billable custom metrics.

Gates: explicit --send, DD_TRIAL_SCOPE_CONFIRMED=true, DD_INTAKE_APPROVED_UNTIL in the next ten minutes, DD_API_KEY present, and DD_CLOUD_ENABLED not true. These technical flags record an already obtained approval; setting them is not a substitute for owner authorization or billing verification. Environment reads stay server-side.

Stop: terminate the one-shot process. Creating `/tmp/chargeguard-stop-intake` on the same Render instance prevents subsequent sends; an already sent HTTP request cannot be recalled. Approval expires within ten minutes. No autonomous redeploy/retry/restart job is configured. Re-running is a new test requiring approval. Do not place this command in Render build/start hooks or a public HTTP route. The local stop file is not a cross-instance durable kill switch; the process has no persistent background loop in the first place.

Observe with US1 Log Explorer `service:chargeguard-api env:prod @message:chargeguard.cloud_intake_check` (or plain message-text search) and Metrics Explorer `chargeguard.cloud_intake_check{service:chargeguard-api,env:prod,purpose:intake_check}`. Confirm check_id/timestamp and numeric point. A 202 only proves intake acceptance, not searchable arrival. This validates a dedicated setup check, not continuous application instrumentation or a fault ALERT → OK lifecycle.

## Required owner decisions, sequential

1. Confirm from account entitlement/support that Logs ingestion/indexing and Custom Metrics submission during the current trial have no charge for this tiny test; record exact expiry/limits/overage behavior. Do not upgrade or add a card.
2. Confirm DD_API_KEY is saved in the intended Render service, never in chat. Do not enable continuous DD_CLOUD_ENABLED.
3. After (1), explicitly approve deploying reviewed code (if needed) and **one execution only**, with the payload/request budget above. The backend/global production mutation denial stays unchanged.
4. Review actual arrival. Any continuous transport, new prod monitor, or synthetic fault lifecycle is a separate scope and approval. Current env:dev incident evidence is preserved and is not env:prod proof.

No Atlas writes or cleanup are needed for this setup test. Datadog retention controls govern submitted data; do not promise immediate deletion/retraction.
