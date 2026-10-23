# Datadog US1 — thư hỏi trial entitlement (CHƯA GỬI)

**Kênh:** ticket chính thức trong Datadog Support / billing support theo account owner. **Mục tiêu:** có xác nhận bằng văn bản về account-specific $0 trước khi phát 1 log và 1 custom metric. Không gửi key, token hoặc mật khẩu trong ticket.

## English draft to Datadog Support

**Subject:** Written confirmation requested: $0 trial coverage for one bounded Logs + Custom Metrics intake test

Hello Datadog Support,

I am participating in the MongoDB User Group Vietnam Hackathon 2026. My existing Datadog US1 organization currently displays a trial countdown (approximately ten days remaining on October 23, 2026). I have not purchased a paid plan or enabled automatic paid conversion.

Before sending any cloud production telemetry, please confirm **for my specific organization**:

1. The exact end timestamp and timezone of the active trial, and whether the trial covers **Logs intake and indexing** and **Custom Metrics ingestion/indexing** at **$0** today.
2. Whether there are product-specific eligibility limits, a usage cap, billing prerequisites, post-trial charges, or automatic conversion behaviors that could affect this test.
3. Whether one sanitized JSON log and one custom gauge datapoint, transmitted in two HTTPS requests with no retries and no further sends, can be performed at **$0**, and how to verify this in Usage & Cost.
4. Whether dashboard and monitor evidence collected during the trial remains available for the tentative November 8 final presentation after trial expiry, and whether there is an official hackathon trial extension.

We will keep continuous cloud intake disabled until we have your written guidance. Existing local Agent monitoring is separate, and no customer data, credentials, or EV charger hardware signals will be transmitted.

Thank you.

OneNode — ChargeGuard (MUGVN Hackathon 2026)

## Nội dung owner cần đính kèm trước khi gửi

- Organization ID hoặc account reference **qua giao diện Support riêng**, không đưa vào repo/chat hoặc tài liệu công khai.
- Ảnh đã che metadata nhạy cảm của trang Plan & Usage, active trial/end date, product usage. Không gửi screenshot chứa API key.
- Ghi lại ticket ID, support reply và ngày cuối trial chính xác vào **tài liệu riêng tư**; chỉ đưa kết luận entitlement tối giản vào báo cáo công khai.

**Khóa chi phí hiện thời:** `DD_CLOUD_ENABLED=false`; không chạy `--send`, không bật monitor mới, không bật paid, không giả định miễn phí từ việc chưa có hóa đơn.
