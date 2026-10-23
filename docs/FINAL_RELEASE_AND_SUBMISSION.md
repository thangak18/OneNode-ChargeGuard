# ChargeGuard — hồ sơ chốt phát hành và nộp MUGVN 2026

**Ngày khóa nội dung:** 23/10/2026 · **Production release được ghi nhận:** `f19f69faac42f4bddaa34d2497adfac823acf15a` · **Trạng thái:** READ-ONLY. Tài liệu này là bản trạng thái chuẩn dùng cho hồ sơ nộp. Các ghi chép “pending OAuth”, “local only” hoặc “chưa rehearsal” trong tài liệu cũ được giữ như **nhật ký lịch sử**, không phải trạng thái hiện tại.

## 1. Tình trạng thực tế, giới hạn xác minh

| Nội dung | Bằng chứng và trạng thái |
| --- | --- |
| Frontend | https://chargeguard-web.vercel.app — GET `/` và `/judge` đều HTTP 200 trong phép kiểm tra 23/10. |
| Backend | https://chargeguard-api-m9ji.onrender.com — GET `/healthz` HTTP 200; một lần khởi động/phản hồi mất **22,42 giây** (không đại diện cho phân vị cold-start). |
| Đọc không xác thực | GET `/api/judge/runs` tại frontend HTTP **401**; GET `/api/v1/judge/runs` trực tiếp Render HTTP **401** (23/10). |
| OAuth Judge Console | **Xác minh lại trực tiếp trên Chrome 23/10** với session sẵn có: nhãn “GitHub operator verified / Authorized identity”, run duy nhất `judge-4afc45f4427ab21f48d61c89`, BASELINE/revision 5, cycle 2, không có observation mới; cả **5 nút lifecycle/re-arm đều disabled**. Không thực hiện POST hay đăng nhập lại. |
| Judge Run | `judge-4afc45f4427ab21f48d61c89`, owner `github:138879141`, charger `demo-charger-01`. Một lifecycle 4 bước + một re-arm thành công; **cycle 2, BASELINE, revision 5**; 5 audit actions, hai observations SYNTHETIC trong cycle 1, **0** trong cycle 2. |
| Ghi production | Ba gate `JUDGE_PROD_WRITES_ENABLED`, `JUDGE_ROUTES_ENABLED`, `JUDGE_REARM_ENABLED` **false** trên Vercel và Render sau rehearsal; tại 07:55 UTC **22/22** request POST Judge/legacy HTTP 403 (bằng chứng rehearsal). Đợt tài liệu mới **không phát POST**. |
| Bảo toàn | Sáu bộ sưu tập cũ giữ fingerprint; incident Phase D `demo-58a1983cae09` vẫn RESOLVED/không đổi; `judge_policy` chỉ còn các index đã duyệt, 0 tài liệu nonce/quota sau TTL (kiểm chứng tại kết thúc rehearsal). |
| Datadog | Dashboard/logs/monitors `env:dev` đã xác minh từ **local Agent**. `DD_CLOUD_ENABLED=false`; không có kết quả intake `env:prod` hoặc alert production. |
| ACN | 5 phiên, 20.228 dòng nguồn, 1.246 điểm sau chọn mẫu, 5 checksum trùng; **một prefix EVSE chưa chứng minh số charger vật lý**. Chỉ local; quyền hiển thị công khai/chạy cloud chưa được xác nhận. |

Chứng cứ: [production Judge rehearsal](PRODUCTION_JUDGE_REHEARSAL.md), [Phase D monitoring](PHASE_D_VERIFICATION.md), [render live checks](evidence/render-readonly-live-checks.json), [historical local](HISTORICAL_LOCAL_MODE.md). Trong browser không đăng nhập, Judge Console hiển thị “Sign-in required”, mutation policy “HTTP 403”; nhánh đã đăng nhập hiển thị 5 nút disabled. Chưa đo lại viewport mobile trong phiên tài liệu này. Không đọc/báo cáo secret hay dữ liệu ACN gốc.

### Kiểm thử Node 24.22.1 — chạy lại ngày 23/10

- API unit: **55/55 PASS**; API integration (disposable fixtures): **24/24 PASS**.
- HTTPS end-to-end qua **Next BFF → Nest → MongoDB disposable**: **6/6 PASS** (CSRF, session, ownership, replay, concurrency/re-arm, bảo toàn dữ liệu).
- Web policy/rendering tests: **29/29 PASS**.
- API typecheck/build; web typecheck/lint/build: **PASS**.
- Tổng **114 assertions/tests được báo cáo** theo ba nhóm + HTTPS harness (55+24+29+6); không diễn giải đây là 114 test production.

Không chạy test thay đổi MongoDB Atlas sản xuất. Các bài kiểm thử chỉ lập bản ghi trong cơ sở dữ liệu tạm, độc lập.

### Vận hành cold-start / độ tin cậy khi giám khảo xem

Render Free có thể ngủ và phản hồi chậm; một `/healthz` mất 22,42 giây. Chỉ có một mẫu, **không suy ra SLA/p95**. GET Judge qua BFF có timeout giới hạn **95 giây**; cần trạng thái loading/retry hợp lý, chờ cold start theo UI rồi mới mở run. Không chạy keep-alive hoặc nâng cấp dịch vụ. Kiểm tra read-only bằng hai mạng/desktop/mobile trước thời điểm ghi hình; sau 95 giây lỗi nên hiển thị trạng thái và thử lại thủ công, **không retry POST**.

## 2. Mô tả dự án sẵn dùng cho form

**ChargeGuard — EV Charging Operations & Incident Response** là nền tảng nguyên mẫu quan sát trạng thái bộ sạc điện **ảo**, phát hiện tình huống lỗi mô phỏng và giúp operator điều tra, ghi nhận hành động và chứng minh một tiến trình phục hồi có thể truy vết. MongoDB Atlas lưu telemetry time-series, incident/audit và trạng thái của Judge Run; NestJS chuẩn hóa dữ liệu, kiểm soát quyền và cung cấp aggregation; Next.js thể hiện trạng thái và lịch sử; Datadog US1 hiển thị dashboard, logs và monitor cho **luồng synthetic local đã được kiểm chứng**. Bản Vercel + Render đang **đọc được**, có bảo vệ OAuth; một vòng production rehearsal xác nhận fault → acknowledge → recover → resolve rồi re-arm có kiểm soát. Việc này **không** chứng minh điều khiển bộ sạc vật lý, fault đo từ cảm biến thật hoặc Datadog monitor chạy trên production.

### Kiến trúc dùng trong thuyết trình

```text
                    Browser / Judge Console
                             |
                  Vercel Next.js + BFF
                    | OAuth GitHub
                    | server-only read key /
                    | bounded signed assertions
                             v
                Render Free NestJS (HTTPS)
                | secured reads, Judge policy
                | mutations disabled after demo
                v
                    MongoDB Atlas Free
   telemetry (time-series) | chargers/stations | incidents/audit
   ingestion_receipts       | judge_runs       | judge_policy TTL

   SEPARATE: local Node.js + macOS Datadog Agent
          -- metrics & sanitized logs [env:dev] --> Datadog US1
   Render app-scoped HTTPS cloud transport [env:prod]: DISABLED
   ACN five-session historical replay: LOCAL ONLY, no cloud transfer
```

### MongoDB data model và aggregation có thể kiểm chứng

Sáu collection legacy là `stations`, `chargers`, `telemetry`, `ingestion_receipts`, `incidents`, `incident_actions`. `telemetry` dùng Time Series với `timeField:ts`, `metaField:meta`, `granularity:seconds` và TTL **604800 giây**. Receipt idempotency dùng chỉ mục/TTL riêng. Hai collection Judge: `judge_runs` lưu run/owner/cycle/revision/audit/observation **SYNTHETIC**; `judge_policy` chỉ có `_id_` và `expiresAt_ttl` trên `expiresAt:1` với `expireAfterSeconds:0`. Source: [initialize.ts](../apps/api/src/database/initialize.ts), [Judge service](../apps/api/src/judge/judge-run.service.ts), [schema](MONGODB_SCHEMA_DESIGN.md).

**Pipeline thực trong code** [analytics.service.ts](../apps/api/src/analytics/analytics.service.ts): `$match` theo khoảng thời gian / charger; trung bình dòng mỗi bucket phút bằng `$dateTrunc` + `$group / $avg / $sum`; `$sort / $limit` giới hạn dữ liệu trả về. Các pipeline khác lấy phép đo mới nhất mỗi charger, nhóm trạng thái sạc, kiểm tra lastSeen và tổng hợp station. Khi ghi hình nên hiển thị **code query, metadata schema và kết quả sample đã được kiểm tra**, không cần xuất database dump. Không gọi giá trị current/power của ACN là live. Các phép tổng hợp có thể trống nếu cửa sổ gần đây không có telemetry; không bịa kết quả.

## 3. Datadog: gate chi phí và bằng chứng

**Đã kiểm chứng local (`env:dev`):** [Operations dashboard](https://app.datadoghq.com/dashboard/875-kis-zg2), [Synthetic Fault monitor 334137944](https://app.datadoghq.com/monitors/334137944), [Ingestion Errors monitor 334137536](https://app.datadoghq.com/monitors/334137536), Log Explorer và lịch sử Phase D ALERT → OK. Monitor fault dùng tổng `chargeguard.fault.simulated` theo cửa sổ một phút, ngưỡng demo ≥1; không đại diện giới hạn an toàn thiết bị. Kiểm tra dữ liệu bằng chứng trước khi công bố screenshot, vì ảnh cũ có thể chứa metadata tài khoản hoặc host.

**Chưa kiểm chứng cloud (`env:prod`):** không có Datadog monitor ALERT/OK từ Judge Run production. Bộ đếm sự kiện `chargeguard.judge.fault_event` không mang trạng thái sự cố theo thời gian; monitor về OK có thể chỉ do event rời khỏi rolling window. **Chỉ** MongoDB Judge status/audit và điểm SYNTHETIC recovery sau action `recover` chứng minh thay đổi phần mềm. Để tương quan, log JSON `message:judge.action` chứa `run_id`, `charger_id`, `cycle`, `revision`, `action`, `source:synthetic` và timestamp; metric `chargeguard.judge.action` dùng tag `action` giá trị hữu hạn; `chargeguard.judge.fault_event` đếm fault. Không gắn `run_id` vào metric tags (cardinality). Transport HTTPS sanitizes lần hai, giới hạn queue/timeout; chỉ bật khi được phép.

**Gate $0:** Ngày 23/10 owner thấy khoảng **10 ngày trial còn lại** và không có hóa đơn; trang upgrade hiển thị giá dự kiến, chưa mua Pro. **Không có xác nhận cụ thể tài khoản** rằng Logs intake/indexing và Custom Metrics là $0 cho giai đoạn/thời điểm này. Không suy ngày hết hạn chính xác bằng phép cộng “10 ngày” từ một banner làm tròn. [Gate đã duyệt để chuẩn bị](DATADOG_TRIAL_INTAKE_GATE.md) và [thư hỏi Support chưa gửi](DATADOG_SUPPORT_DRAFT.md). Datadog docs: [Plan & Usage](https://docs.datadoghq.com/account_management/plan_and_usage/), [Custom Metrics billing](https://docs.datadoghq.com/account_management/billing/custom_metrics/).

**One-shot plan CHƯA THỰC HIỆN:** giữ `DD_CLOUD_ENABLED=false`; chỉ sau xác nhận quyền lợi $0 **và phê duyệt riêng** mới chạy `apps/api/scripts/cloud-intake-check.ts` **một lần** với cờ `--send`: 1 sanitized log `chargeguard.cloud_intake_check`, 1 gauge `chargeguard.cloud_intake_check` (tags `service:chargeguard-api, env:prod, purpose:intake_check`), tối đa 2 HTTPS POST US1, tối đa 3 giây/POST, không retry, không loop, không dữ liệu Atlas/ACN/Judge Run, không trigger fault monitor. Yêu cầu thêm `DD_TRIAL_SCOPE_CONFIRMED=true`, hạn phê duyệt `DD_INTAKE_APPROVED_UNTIL` trong ≤10 phút và `DD_API_KEY` đã lưu server-side. Một HTTP 202 chỉ chứng minh tiếp nhận: sau đó kiểm tra Datadog Metrics Explorer/Log Explorer riêng. **Không chạy chỉ vì đã cấu hình key**.

**Hủy ngay và sau trial:** không bật cloud transport thường trực; không chạy test lần hai/monitor mới tự động; nếu có đợt thử riêng, dừng one-shot process, đặt stop-file theo runbook và để thời hạn phê duyệt hết hiệu lực. Nếu sau này được phép bật liên tục, trước hết phải có ngân sách, quota, expiry và kill switch riêng; **tắt DD_CLOUD_ENABLED trước khi trial kết thúc** và kiểm tra usage sau 72 giờ. Không dựa trên thông báo “no invoice” để suy luận giá $0; nếu vòng chung kết dự kiến 08/11 nằm sau trial, trình bày bằng chứng `env:dev` có ngày hoặc xin BTC/Datadog gia hạn, không tạo usage ngoài quyền lợi.

## 4. Hồ sơ bắt buộc, đối chiếu BTC

Nguồn chính thức đã kiểm tra **23/10/2026**: [trang chủ, yêu cầu MongoDB/Datadog](https://mini-hackathon-sep-2026.mugvn.com/) và [thể lệ](https://mini-hackathon-sep-2026.mugvn.com/terms). Deadline **31/10/2026 lúc 23:59 ICT**. Repository private phải cấp quyền đọc cho các tài khoản giám khảo **do BTC cung cấp** trước deadline và giữ tới **22/11/2026**; không sửa repo sau deadline. Bài thi cần tên/vấn đề, đội/liên hệ, kiến trúc hệ thống và data, Datadog observability, repo/hướng dẫn, README, MVP/demo, video, slide, mô tả incident và khai báo reused components/dataset/AI. Core feature chấm điểm phải thuộc giai đoạn **17–31/10**; kê khai code chuẩn bị trước đó.

| Hạng mục | Trạng thái / việc cần làm |
| --- | --- |
| Demo public + code | **Có** nguồn local release và app read-only. Chốt commit/documentation cuối trước hạn. |
| MongoDB | **Có** time-series, aggregation, retention, receipt, Judge run/audit; chọn một ảnh/code query và một kết quả mẫu có thật, che IDs nhạy cảm. |
| Datadog dashboard/monitor/log | **Có bằng chứng local `env:dev`**; cloud `env:prod` chưa chứng minh. Ảnh chỉ dùng sau lọc metadata nhạy cảm. |
| Incident scenario | **Có:** Phase D local Datadog ALERT → OK và Judge production cycle 1 bốn bước + re-arm, **khác nhau về nguồn/evidence**. |
| Video cuối và slide cuối | **Chưa quay/chưa xuất**; dùng [script](FINAL_DEMO_VIDEO_SCRIPT.md) và [outline](PRESENTATION_OUTLINE.md) bản cập nhật. |
| Repo private | **Cần owner** lấy chính xác tài khoản giám khảo do BTC gửi, cấp ít nhất quyền được yêu cầu; nếu GitHub cá nhân không hỗ trợ role read-only trực tiếp thì hỏi BTC hình thức khả thi trước deadline. Không tự mở public. |
| Dataset và AI disclosure | **Cần rà soát cuối** thư viện/OSS licenses, code trước 17/10, AI hỗ trợ (ChatGPT/Codex, công cụ khác nếu thực tế dùng), ACN-Data; không chiếu ACN hình/bản ghi nguyên mẫu ra công khai khi chưa có phép. |
| Submission form | **Cần owner** lấy link form chính thức BTC gửi, đối chiếu đủ mục và submit thủ công trước 23:59 31/10; chưa nộp trong đợt này. |
| Datadog trial / finals | **Cần owner** Support xác nhận product entitlement & ngày end chính xác; ưu tiên bằng chứng local có ngày để không lệ thuộc uptime trial tại chung kết. |

Kiểm tra form và video trước công bố: không lộ URI/keys, cookie, tên tài khoản, hóa đơn, đường dẫn riêng, dữ liệu khách hàng, ACN raw hoặc biểu đồ nguồn chưa được phép. Quyền BTC có thể dùng bài nộp để quảng bá: chỉ nộp media được phép chia sẻ.

## 5. Kế hoạch quay cycle 2 (CHƯA THỰC THI)

1. **Read-only preflight:** đối chiếu source SHA, Render `/healthz`, backend readiness khi đã warm, operator login/logout, GET owned run **cycle 2 BASELINE revision 5**, đủ 5 audit actions, archived cycle 1 RESOLVED, đúng 2 điểm SYNTHETIC, cycle 2 vẫn 0; xem sáu fingerprint và Phase D pin. Kiểm tra cả ba production gate false, Datadog cloud false. Không gửi POST.
2. **Phê duyệt mới bằng văn bản:** nêu đúng run `judge-4afc45f4427ab21f48d61c89` / owner `github:138879141` / charger `demo-charger-01` / expected initial cycle 2 revision 5. Đề nghị **tối đa bốn POST thành công** chỉ cho `fault → acknowledge → recover → resolve`, nonce/quota và tối đa hai observations SYNTHETIC có giới hạn. Tùy từng cổng phê duyệt, owner mới được bật tạm `JUDGE_PROD_WRITES_ENABLED=true` + `JUDGE_ROUTES_ENABLED=true` ở **cả Vercel & Render**; `JUDGE_REARM_ENABLED=false`, Datadog OFF. Không ủy quyền thêm reset.
3. **Ghi hình có giám sát:** trên session operator hiện hành, mỗi bước kiểm tra lại GET run sau POST, revision mong đợi **6 OPEN → 7 ACKNOWLEDGED → 8 RESOLVING → 9 RESOLVED** (đây là **dự kiến**, chưa phát sinh); tất cả ở **cycle 2**. Dừng nếu mất quyền, response mơ hồ, lệch revision/cycle hoặc thấy nút reset enabled. Không retry POST mù.
4. **Điều tra:** hiển thị audit `action` / timestamp / actor phía server, biểu đồ observation có nhãn **SYNTHETIC**, so sánh 0 A / FAULT tại fault với **8.25 A / CHARGING** tại recovery nếu code sinh đúng scenario. Dữ liệu đều là kịch bản mô phỏng. Có thể minh họa document Atlas sau khi che thông tin riêng; không chạy query export tràn dữ liệu.
5. **Datadog:** chỉ hiển thị dashboard/monitor/log `env:dev` với nhãn **bằng chứng ngày 19/10/2026**. Nếu cloud chưa được duyệt, **không** gán event của recording production vào monitor env:dev hoặc tuyên bố ALERT/OK đã xảy ra cho Judge Run. Phần Datadog quay riêng làm case study lịch sử.
6. **Shutdown ngay:** tắt cả 3 gate ở hai provider về false, redeploy/recheck; xác nhận mọi write route 403 và operator `canMutate:false` / `canRearm:false`. GET run dự kiến **cycle 2 RESOLVED revision 9**, đủ 4 actions mới; kiểm tra Phase D/legacy fingerprints không đổi, Datadog cloud OFF. Dừng xử lý nếu evidence bị sai.
7. **Re-arm về BASELINE** chỉ nếu owner cấp **một phê duyệt mới khác**, sau khi đã đóng lượt quay và xác minh shutdown; không nằm trong bốn hành động quay. Không tạo Judge Run thứ hai.

**Emergency shutdown:** đặt cả ba gate false trên Vercel/Render và xác nhận redeploy thực tế, sau đó kiểm tra GET session và các bảo vệ POST (với negative probe phi tác động đã duyệt). Nếu deployment/flag không xác nhận hoặc mất kết nối, ngừng quay và coi write-mode đang cần kiểm soát thủ công; không tự chạy re-arm, không sửa Atlas bằng tay.

## 6. Ưu tiên còn lại

**P0 trước 31/10:** kiểm tra quyền repo judge, hạn/biểu mẫu BTC, privacy-cleared video + slides, declaration code/dataset/AI. **P1:** Datadog account-specific $0 entitlement; nếu không có, giữ cloud OFF và dùng `env:dev` dated evidence, trình bày rõ phạm vi trong nộp bài. **P2:** xin phép riêng cho recording cycle 2 nếu thật sự cần quay trực tiếp; có thể dùng evidence lịch sử đã xác minh để hoàn thiện video mà không thay đổi production. Không bật trả phí, không sửa network permissions, không gửi ACN lên cloud.
