# ChargeGuard | Mô tả dự án dành cho hồ sơ nộp thi

**Team:** OneNode (solo)
**Event:** MongoDB User Group Vietnam Hackathon 2026 — Real-time Operations
**Evidence cut-off:** 23/10/2026; production application release `f19f69faac42f4bddaa34d2497adfac823acf15a`.

## Tiếng Việt — Bản mô tả dùng trong form

**ChargeGuard** là nền tảng mẫu giám sát vận hành và quản lý sự cố cho **năm bộ sạc xe điện ảo**. Hệ thống minh họa quy trình **Phát hiện → Điều tra → Phản ứng → Xác minh**: NestJS ghi nhận telemetry và vòng đời incident trên MongoDB Atlas; MongoDB Time Series và Aggregation Pipeline hỗ trợ truy vấn tín hiệu theo thời gian; Next.js hiển thị trạng thái thiết bị, dữ liệu sự cố và nhật ký thao tác. Trong một kịch bản local riêng, Datadog Agent gửi metric/log đã lọc đến Datadog US1 để kích hoạt monitor cảnh báo và đối chiếu log điều tra.

MVP được triển khai **Next.js trên Vercel Hobby, NestJS trên Render Free và MongoDB Atlas Free**, đang mở các màn hình xem công khai và Judge Console có GitHub OAuth ở chế độ **chỉ đọc**. Một vòng diễn tập tương tác production đã được xác minh với các trạng thái `OPEN → ACKNOWLEDGED → RESOLVING → RESOLVED`, sau đó thực hiện đúng một thao tác re-arm được phê duyệt. Hiện Judge Run ở **cycle 2 / BASELINE / revision 5**, toàn bộ production write gates đã tắt.

**Ranh giới bằng chứng:** sự cố, dòng điện `0 A` khi lỗi và `8.25 A` khi phục hồi của Judge Run đều **SYNTHETIC**, không phải tín hiệu phần cứng. Bằng chứng Datadog `ALERT → OK` đến từ **local `env:dev` (19/10/2026)**, độc lập với vòng Judge trên cloud (23/10/2026). Datadog `env:prod` chưa được kích hoạt vì chưa có xác nhận quyền lợi Logs và Custom Metrics ở mức $0. Năm phiên ACN lịch sử đã được kiểm tra và xử lý **chỉ trên máy local**; chúng không chứng minh năm EVSE vật lý khác nhau và chưa được phép xuất dữ liệu nguồn lên cloud/công khai.

**Giá trị vận hành:** bảo toàn chuỗi bằng chứng gồm telemetry, trạng thái, người thao tác xác thực, hành động và thời điểm; khoanh vùng được kết nối ảo có sự cố; phân biệt dữ liệu quan sát, dữ liệu suy ra và mô phỏng. Đây là prototype giáo dục/hackathon, **không điều khiển bộ sạc thật, không phải hệ thống an toàn hoặc vận hành thương mại**. Không công bố cải thiện định lượng về MTTR, chi phí hay chất lượng hoạt động thực tế.

## English — Submission-ready description

**ChargeGuard** is a prototype operations-monitoring and incident-response platform for **five virtual EV charging connectors**. It demonstrates a traceable **Detect → Investigate → Respond → Verify** workflow. A NestJS backend records telemetry and incident state in MongoDB Atlas. MongoDB Time Series storage and real Aggregation Pipelines support time-bounded analytics. A Next.js interface displays virtual charger status, incident evidence, and an authenticated operator audit trail. Separately, a local Datadog Agent forwards sanitized application metrics and logs to Datadog US1 for alerting and investigation.

The accessible MVP uses **Next.js on Vercel Hobby, NestJS on Render Free, and MongoDB Atlas Free**. Public operational views and the GitHub OAuth Judge Console are now **read-only**. An authorized production rehearsal verified a four-step synthetic incident lifecycle, followed by one separately approved re-arm. The existing run remains at **cycle 2, BASELINE, revision 5**, with production mutations disabled.

**Evidence boundaries matter:** Judge Run fault and recovery current values (`0 A` and `8.25 A`) are explicitly **SYNTHETIC**; no physical EV charging equipment is connected. The observed Datadog `ALERT → OK` transition belongs to a **separate local `env:dev` test on October 19, 2026**. Cloud `env:prod` Datadog ingestion remains off pending account-specific confirmation that the trial covers Logs and Custom Metrics at no cost. Five ACN historical sessions have been inspected locally only; they do not establish five different physical chargers, and source redistribution/cloud-use permission is unconfirmed.

ChargeGuard's practical contribution is a verifiable timeline of observations, authorized actions and incident states, with transparent provenance and isolated replay/demo boundaries. This is a hackathon prototype, **not a safety-certified charger controller or a proven commercial operations service**. No unmeasured claims are made about real-world reliability, recovery time improvements or cost savings.

## References and claims policy

- Production rehearsal: `docs/PRODUCTION_JUDGE_REHEARSAL.md`.
- Local Datadog incident: `docs/PHASE_D_VERIFICATION.md`.
- Dataset status: `docs/HISTORICAL_LOCAL_MODE.md` and `docs/DATA_PROVENANCE.md`.
- Git SHA in this document identifies the **application source**; subsequent documentation-only commits have different SHA without code changes.
- Competition terms: https://mini-hackathon-sep-2026.mugvn.com/terms
