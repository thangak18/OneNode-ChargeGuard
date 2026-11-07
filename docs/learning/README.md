# Học và bảo vệ ChargeGuard — OneNode

Bộ tài liệu tiếng Việt để developer hiểu implementation hiện có trước hackathon. Audit tại **`334afdb56297d8d5d1492e636a37bf49dafd88e7`**, ngày **19/10/2026**, đọc code/test/config và evidence theo ngày. Không sửa application source, MongoDB data, monitor hoặc incident. Không push bộ tài liệu này trước khi owner review.

## 1. Đọc theo thứ tự và chọn độ sâu

| Thứ tự | Tài liệu | Cần trả lời được sau khi đọc |
| --- | --- | --- |
|1|[Tổng quan](01_CHARGEGUARD_TONG_QUAN.md)|Giá trị MVP, real-time nào, synthetic/historical khác gì; pitch 30 s/1 phút/3 phút|
|2|[Kiến trúc](02_KIEN_TRUC_HE_THONG.md)|Sáu sơ đồ A–F, network/secret boundaries, tech và trade-off|
|3|[MongoDB và backend](03_MONGODB_VA_BACKEND.md)|6 collection, endpoints, pipeline, receipt/call stack/failure|
|4|[Datadog và incident](04_DATADOG_VA_INCIDENT.md)|8 metric families, log/query, 2 monitor, case Phase D/timing|
|5|[Dữ liệu thực và giả lập](05_DU_LIEU_THUC_VA_GIA_LAP.md)|Sampling, nguồn field,2 clocks, quality và permission|
|6|[Frontend và UX](06_FRONTEND_UI_UX.md)|5 page, polling/BFF, semantics và limit display|
|7|[Kiểm thử và giới hạn](07_KIEM_THU_VA_GIOI_HAN.md)|Test thực tế so với bằng chứng cloud, lệnh safe, severity/production gates|
|8|[Kịch bản thuyết trình](08_KICH_BAN_THUYET_TRINH.md)|60 s/5 phút/10 phút, slide content, readonly/future live walkthrough|
|9|[Q&A ban giám khảo](09_BO_CAU_HOI_BAN_GIAM_KHAO.md)|40 câu khó với giải thích/spoken/source/follow-up/limitations|
|10|[Lộ trình tự học](10_LO_TRINH_TU_HOC.md)|5 ngày đọc code, bài tập/đáp án và mock defense|

**Beginner:**01→02→06. **Intermediate:**03→04→05. **Advanced:**07 và failure branches/source. **Hackathon Defense:**08→09→10, sau đó quay lại code để chỉ hàm thực. Không dùng slide thay đọc code.

## 2. Quy ước mức bằng chứng

- **VERIFIED IN SOURCE CODE:** thấy trực tiếp trong implementation, kèm path/hàm/line. Không có nghĩa mọi branch đã chạy trên cloud.
- **VERIFIED BY TESTS / EVIDENCE:** assertions vừa chạy hoặc artifact quan sát có timestamp. Phân biệt test local và evidence Atlas/US1 cũ.
- **DOCUMENTED BUT NOT RE-VERIFIED:** thông tin trong doc/dated capture chưa kiểm live trong task này, ví dụ role/trial/current intake.
- **ENGINEERING INFERENCE:** giải thích trade-off/rủi ro hợp code, không gán thành động cơ lịch sử hay benchmark.
- **NOT IMPLEMENTED / LIMITATION:** capability chưa có hoặc guarantee không đủ; không biến thành tính năng tương lai đã hoàn thành.

Ví dụ SRE = thực hành vận hành hệ thống tin cậy; trong bộ học chỉ dùng khi nói giới hạn measurement/delivery/incident. Không claim ChargeGuard đã có SLO/SLA. “Nguồn” trong doc là repo link có anchor `#L...`; line fix tại commit audit. Ví dụ tự tạo được gắn SYNTHETIC, không trích record nguồn ACN.

## 3. Phạm vi audit

Đã đối chiếu các nhóm mã/config/test (72 file văn bản theo inventory) dưới `apps/api/src`, `apps/api/scripts`, `apps/api/test`, `apps/web/src`, `apps/web/test`, `config/datadog`; package scripts, Nextconfig và Git history các commit Phase D/historical. Các ảnh trong evidence chỉ tham chiếu trạng thái quyền đã review ở tài liệu hiện có; **không mở/chụp/xuất lại raw ACN trace hoặc account screen** trong task này. Không hiển thị environment values; bước kiểm tra secret chỉ so khớp trong bộ nhớ. Không gọi cloud API để gây kiểm chứng mới.

Tài liệu nền đã đọc/đối chiếu: root README; ARCHITECTURE, BUILD_PLAN, MONGODB_SCHEMA_DESIGN, DATA_PLAN, DATA_DICTIONARY, DATA_PROVENANCE, HISTORICAL_LOCAL_MODE, DATADOG_PREPARATION, PHASE_D_VERIFICATION, DEMO_RUNBOOK, PROJECT_STATUS, SUBMISSION_CHECKLIST, DEMO_VIDEO_STORYBOARD, PRESENTATION_OUTLINE. Bằng chứng định lượng: `docs/evidence/historical-local-audit.json`, `phase-d-e2e.json`, `phase-b2-incident.json` và evidence README. File evidence được giữ nguyên.

Git history làm rõ các checkpoint: `2ea9345`hardening lifecycle; `202478e`local history/gate; `b1ce7b4`quality/permissions; `334afdb`walkthrough/submission plan. Đó không tự chứng minh ai đã viết mọi dòng hoặc nguyên nhân quyết định stack.

## 4. Sai khác/điểm dễ hiểu nhầm đã phát hiện

Không sửa âm thầm tài liệu gốc trong task này; bảng sau giúp người học biết tài liệu nào là proposal vs code current.

| Điều đọc thấy | Implementation/evidence hiện tại | Cách giải thích / nguồn |
| --- | --- | --- |
| Schema doc ghi “proposal/not created”, action enum cũ và$lookup minh họa | Initializer có 6 collection, detail dùng 2 find, action có stable ID và RESOLVING có marker | Chương 03; [apps/api/src/database/initialize.ts:1](../../apps/api/src/database/initialize.ts#L1) |
| Architecture domain summary dùng syntheticFields/derivedFields, sessionId top-level trong proposal | Schema dùng provenance.fields, assumptions, sessionId trong provenance | [apps/api/src/telemetry/telemetry.schema.ts:8](../../apps/api/src/telemetry/telemetry.schema.ts#L8) |
| Sơ đồ cũ có replay→API có điều kiện | Current historical viewer độc lập; cloud CLI bị gate do permission chưa đạt | [apps/api/src/adapters/acn-permission.ts:1](../../apps/api/src/adapters/acn-permission.ts#L1) và chương 05 |
| Metadata charger status được gọi operational state | Ingest không update chargers.status; gauge/telemetry state riêng | [apps/api/scripts/seed-virtual.ts:1](../../apps/api/scripts/seed-virtual.ts#L1) /TelemetryService |
| Overview label“Live Current” dễ nghĩ instant | Dùng summary average window default 24 h + maxTsfreshness | [apps/web/src/app/page.tsx:94](../../apps/web/src/app/page.tsx#L94) |
| Charger Detail gọi phần tử cuối là latest | APIhistorysortasc+limit 100→có thể bỏ newest | [apps/web/src/app/chargers/page.tsx:73](../../apps/web/src/app/chargers/page.tsx#L73) |
| Trang detail mô tả state“derived” chung và power estimate | Synthetic state không do heuristic; operational UI có tính 240 V estimate, historical local không tạo power | Chương 06 và table provenance |
| “Idempotent trigger” | Có active check tuần tự, chưa atomic lock concurrent | [apps/api/src/demo/demo.service.ts:34](../../apps/api/src/demo/demo.service.ts#L34) |
| “Observability không block” | Không chờ cloud nhưng log appendFileSync vẫn block event loop | [apps/api/src/observability/observability.service.ts:3](../../apps/api/src/observability/observability.service.ts#L3) |
| Phase D snapshot đầu OPEN/UNVERIFIED | liveVerification.finalAudit RESOLVED, cùng ID; không xóa snapshot | [docs/evidence/phase-d-e2e.json:85](../../docs/evidence/phase-d-e2e.json#L85) |
| Phase Dtest 24/11/2 | Sau historical 29/11/4; cả hai là dated checkpoint | Chương 07 |
| MonitorcountOK=resolved/safe | Window expiry đã OK khi incident OPEN; chưa heartbeat | Chương 04 case/timeline |
| “CLI gate chặn ACN mọi nơi” | Gate ở CLI; generic ingestion có key vẫn chấp nhận nhãn ACN_REPLAY | Chương 05; schema/permission |
| phase: d audit là readonly | Readonly Atlas nhưng ghi JSON evidence; helper Phase B cũ cũng có side effects | Không chạy để học; chương 07 |
| Grant judge“Read”trên repo cá nhân | Personal private collaborator chỉ read+write; chưa giải quyết access model | [Accessplan](../JUDGE_ACCESS_PLAN.md) |

Những giới hạn/source behavior chưa được thể hiện bằng test dedicated vẫn chỉ là **VERIFIED IN SOURCE CODE / ENGINEERING INFERENCE**, không giả vờ vừa tái hiện runtime bug.

## 5. Kiểm chứng trong task học

Node v24.22.0:29 API unit/11 integration/4 web policy PASS; API typecheck/build, web typecheck/lint PASS. Không run test cloud mới. Production web build/route 403/tracing exclusion đã verify ở task finalization trước tại cùng source commit, được ghi DOCUMENTED BUT NOT RE-VERIFIED ở task học. Không reset incident, emit fault, modifyDB/monitor hoặc chạy phase: d audit. Source/test/config/evidence giữ nguyên; chỉ thêm bộ học.

## 6. Còn phải xác nhận

- Role/certificates/intake/monitor state/trial expiry **hiện tại** chưa re-audit live; datedPhase D không là current status.
- Identity physical EVSE, meter accuracy/source clock lineage, representative coverage và cloud/public/redistribution ACN grant chưa established.
- Chưa có hardware integration, actuation, operator auth production, reliable heartbeat, tracing, load benchmark/durable offline queue.
- Video/deck export/form/judge access vẫn owner action; repo personal private không Read-only collaborator. Không gửi inquiry hoặc invite user trong task này.

## 7. Tài liệu chính thức tham khảo thêm

Các link này giúp học khái niệm, không thay bằng chứng implementation: [MongoDB8.0TimeSeries](https://www.mongodb.com/docs/v8.0/core/timeseries-collections/), [MongoDB8.0TTL](https://www.mongodb.com/docs/v8.0/core/index-ttl/), [Datadogmetrictypes](https://docs.datadoghq.com/metrics/types/), [DogStatsDaggregation](https://docs.datadoghq.com/extend/dogstatsd/data_aggregation/?lang_pref=en), [ACNportal](https://ev.caltech.edu/dataset.html), [ACNregistration](https://ev.caltech.edu/register). Xem terminology và source version với thái độ kiểm chứng, không áp dụng mọi feature mới của manual vào Atlas đang chạy. 

## 8. Bảng thuật ngữ để đọc từ cơ bản lên nâng cao

| Thuật ngữ | Giải thích và chỗ gặp trong ChargeGuard |
| --- | --- |
| API / endpoint | Giao diện giao tiếp HTTP; một method + route như GET health/ready. |
| Schema / Zod | Schema mô tả dữ liệu hợp lệ; Zod kiểm JSON thật ở runtime. Interface TypeScript chỉ kiểm lúc biên dịch. |
| Guard / filter / middleware | Guard quyết định cho gọi handler; filter chuyển lỗi thành response; middleware bọc quá trình HTTP để đo request. |
| DI | Dependency injection: framework cấp dependency cho service; test có thể thay provider bằng fixture. |
| BSON Date / ISO UTC | Date lưu trong MongoDB; chuỗi ISO có timezone đi trên HTTP. UTC là mốc chuẩn, ICT=UTC+7. |
| Receipt / fingerprint / canonical | Receipt ghi trạng thái một event; fingerprint là hash của payload đã chuẩn hóa thứ tự key. NUL trong key là ký tự phân cách mã 0. |
| Atomic / transaction | Atomic: một thao tác thay đổi không bị xen nửa chừng ở đơn vị được DB bảo đảm. Transaction gom nhiều thay đổi thành một đơn vị; code này không dùng transaction xuyên receipt/telemetry/incident. |
| Count / gauge / histogram | Count đếm event; gauge giữ quan sát số; histogram tóm tắt phân bố mẫu như latency. P95 là percentile95, không phải giá trị lớn nhất. |
| Cardinality | Số tổ hợp tag tạo series; ID từng event có thể làm tăng mạnh số series và chi phí. |
| Polling / SSE / WebSocket | Polling hỏi lại định kỳ; SSE server đẩy sự kiện một chiều; WebSocket là kênh hai chiều. Hai loại push chưa implement. |
| Backpressure / queue / buffer | Điều tiết tốc độ khi bên nhận chậm; queue/buffer giữ dữ liệu chờ xử lý. Chưa có durable offline queue trong API. |
| Outbox / reconciliation | Outbox là thiết kế ghi sự kiện cần gửi bền vững; reconciliation đối chiếu và xử lý trạng thái chưa rõ. Có branch reconcile receipt, chưa có outbox hoặc hệ thống xử lý pending toàn diện. |
| Heartbeat / stale | Heartbeat là tín hiệu sống có cadence mong đợi; stale là dữ liệu quá cũ. Có UI stale/activity, chưa có reliable heartbeat monitor. |
| SRE / SLO / SLA | SRE là thực hành vận hành tin cậy; SLO là mục tiêu chất lượng đo được; SLA là cam kết dịch vụ. Dự án chưa có SLO/SLA đã đo và cam kết. |
| RBAC / CSRF | RBAC phân quyền theo vai trò; CSRF là ép browser người dùng thực hiện thao tác ngoài ý muốn. Local origin policy hiện tại không thay operator identity/RBAC production. |
| OCPP / MQTT | OCPP là giao thức vận hành điểm sạc; MQTT là giao thức publish/subscribe phổ biến cho IoT. Không giao thức nào đang kết nối phần cứng trong ChargeGuard. |
| Provenance / lineage | Nguồn gốc và lịch sử biến đổi của field. Nhãn được kiểm schema nhưng chưa có attestation từ thiết bị. |

Nếu một từ chưa hiểu, quay lại định nghĩa rồi chỉ ra nó nằm ở hàm nào; không dùng thuật ngữ chỉ để làm câu trả lời có vẻ chuyên sâu.

## 9. Rà soát bộ tài liệu trước khi giao

Đã kiểm tra đủ 11 file theo yêu cầu,40 câu Q&A đều có đủ 5 phần,6 sơ đồ Mermaid và lộ trình5 ngày;193 local file link có đích tồn tại và line anchor trong giới hạn file. Secret/private-source-mapping scan PASS. Mã ứng dụng, test, config và evidence không đổi so với HEAD. Bộ học còn local/uncommitted để owner review; không push.
