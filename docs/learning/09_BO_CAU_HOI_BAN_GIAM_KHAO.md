# 09 — Bộ 40 câu hỏi bảo vệ kỹ thuật

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

Mỗi câu có giải thích kỹ thuật, bản nói mục tiêu 20–40 giây, nguồn, câu hỏi đào sâu và cách trả lời khi chưa implement. Bấm giờ để chỉ n h độ dài; không học thuộc những từ chưa hiểu.

## Bài toán và sản phẩm

### 1. ChargeGuard giải quyết điều gì ngoài việc vẽ biểu đồ?

**Giải thích:** Kết nối tín hiệu, record nghiệp vụ và hành động operator có timeline. MongoDB giữ incident/action; Datadog cung cấp metric/log/monitor độc lập. Đây là prototype, chưa có chứng cứ giảm downtime hoặc ROI từ khách hàng.

**Bản nói 20–40 giây:** “Em muốn operator biết không chỉ có cảnh báo mà đã điều tra gì, gửi tín hiệu phục hồi nào và vì sao đóng incident. Dashboard cho tín hiệu, còn ChargeGuard giữ quy trình và audit. Hiệu quả kinh doanh thực tế chưa được đo.”

**Nguồn:** [apps/api/src/incidents/incidents.service.ts:25](../../apps/api/src/incidents/incidents.service.ts#L25)

**Hỏi tiếp:** Đã có người vận hành thật dùng chưa?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa có user study hay triển khai khách hàng; đề xuất pilot có phép và tiêu chí đo trước/sau.

### 2. Phần nào thực sự real-time?

**Giải thích:** API xử lý request mới, Atlas persist, Agent chuyển bất đồng bộ và UI polling. Không có hard real-time deadline hay EVSE live stream; ACN là lịch sử.

**Bản nói 20–40 giây:** “Nhánh synthetic xử lý sự kiện mới tại lúc chạy, UI cập nhật sau polling và Datadog sau intake/evaluation. Em gọi đó là gần thời gian thực cho prototype. Dữ liệu ACN không live và em chưa có SLA latency.”

**Nguồn:** [apps/web/src/app/page.tsx:61](../../apps/web/src/app/page.tsx#L61)

**Hỏi tiếp:** Bao lâu người dùng nhìn thấy event?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa benchmark browser-to-DB-to-UI; không dùng chu kỳ polling làm cam kết end-to-end.

### 3. Có EV charger vật lý nào đang kết nối không?

**Giải thích:** Không. Seed tạo asset ảo; demoReading sinh telemetry. Dữ liệu lịch sử từng có nguồn sạc thực không đồng nghĩa hardware integration.

**Bản nói 20–40 giây:** “Không có sạc vật lý đang nối với ChargeGuard. Em có năm asset ảo để kiểm chứng pipeline và một tập ACN lịch sử để phân tích local. Em chưa gửi command, đọc gateway hoặc chứng nhận an toàn thiết bị.”

**Nguồn:** [apps/api/scripts/seed-virtual.ts:1](../../apps/api/scripts/seed-virtual.ts#L1)

**Hỏi tiếp:** Cần gì để nối hardware?

**Nếu bị hỏi phần chưa có / giới hạn:** Cần gateway/protocol, device identity, timestamp/units, offline delivery, lab và kiểm chứng an toàn; OCPP chưa có.

## Kiến trúc

### 4. Tại sao dùng NestJS thay Express thuần?

**Giải thích:** Source dùng DI, module, controller, guard và service, giúp tách HTTP/business và override dependency trong test. Đây là engineering rationale, không chứng cứ lịch sử tác giả benchmark Express.

**Bản nói 20–40 giây:** “NestJS giúp em tổ chức service, guard và test integration nhất quán. Đổi lại có thêm abstraction. Express có thể phù hợp một API nhỏ hơn; em không có số đo nói NestJS nhanh hơn.”

**Nguồn:** [apps/api/src/app.module.ts:18](../../apps/api/src/app.module.ts#L18)

**Hỏi tiếp:** Có quá phức tạp cho solo không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chi phí học/framework là thật; không mở thêm micro service để biện minh stack.

### 5. Vì sao BFF thay browser gọi NestJS trực tiếp?

**Giải thích:** BFF giữ shared ingest key ở server, allowlist path/method và validate mutation local trước forward. Browser không nhận key. Direct client có auth token theo người dùng là phương án khác chưa implement.

**Bản nói 20–40 giây:** “BFF tạo boundary dành cho UI và giữ secret khỏi JavaScript browser. Nó giới hạn đúng các thao tác demo. Nhưng chưa có login nên em không coi BFF là operator authorization production.”

**Nguồn:** [apps/web/src/app/api/v1/[...path]/route.ts:160](../../apps/web/src/app/api/v1/[...path]/route.ts#L160)

**Hỏi tiếp:** Process local có thể giả Origin không?

**Nếu bị hỏi phần chưa có / giới hạn:** Có; Origin là browser protection trong phạm vi local, không identity cho hostile client.

### 6. Vì sao polling thay WebSocket/SSE?

**Giải thích:** Implementation dùng intervals 6/7/4 giây cho các trang khác nhau. Dễ kiểm chứng demo nhỏ nhưng request overlap, tải nhân theo client và update trễ; chưa có push infrastructure.

**Bản nói 20–40 giây:** “Với năm asset, polling giúp MVP đơn giản. Em chấp nhận độ trễ và chi phí lặp query, chưa hứa scale. SSE hoặc WebSocket phù hợp khi cần cập nhật nhanh/nhiều client, nhưng cần reconnect và backpressure đúng.”

**Nguồn:** [apps/web/src/lib/utils.ts:20](../../apps/web/src/lib/utils.ts#L20)

**Hỏi tiếp:** Có khóa để không overlap fetch không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa có ở các trang vận hành; đề xuất cancel/order guard sau task tài liệu.

## MongoDB

### 7. Vì sao MongoDB thay PostgreSQL/TimescaleDB?

**Giải thích:** Document có field sensor optional/provenance, Time Series và pipeline khớp bài toán/đề thi. PostgreSQL/TimescaleDB có lợi về SQL, relational constraints, hệ sinh thái hiện có. Không có comparative benchmark.

**Bản nói 20–40 giây:** “MongoDB cho em mô hình telemetry và incident trong một stack cùng Time Series, aggregation. Đây là lựa chọn phù hợp MVP, không phải kết luận SQL kém hơn. Nếu nghiệp vụ nhiều quan hệ/giao dịch hoặc team đã dùng SQL, em sẽ cân nhắc PostgreSQL.”

**Nguồn:** [apps/api/src/database/initialize.ts:1](../../apps/api/src/database/initialize.ts#L1)

**Hỏi tiếp:** Có bằng chứng MongoDB nhanh hơn không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không benchmark so sánh; không đưa latency/RPS giả làm lý do.

### 8. Time Series khác collection thường thế nào trong dự án?

**Giải thích:** Telemetry có timeField ts, metaField meta và granularity seconds, TTL. Incident/action/receipt dùng regular collection cho mutation/unique identity; telemetry indexes không unique.

**Bản nói 20–40 giây:** “Em tách measurement theo thời gian khỏi trạng thái nghiệp vụ. Time Series chứa ts Date và meta asset; receipt thường có unique ID để dedup. Granularity seconds không có nghĩa thiết bị gửi mỗi giây.”

**Nguồn:** [apps/api/src/database/initialize.ts:4](../../apps/api/src/database/initialize.ts#L4)

**Hỏi tiếp:** Có thể dùng regular telemetry không?

**Nếu bị hỏi phần chưa có / giới hạn:** Có, nhưng phải đánh giá storage/query/index; chưa có benchmark để khẳng định chênh lệch.

### 9. Idempotency thực hiện chính xác ra sao?

**Giải thích:** Key hash từ station/charger/eventId; receipt unique _id và fingerprint canonical payload. COMMITTED cùng payload là duplicate; khác payload 409; PENDING có measurement thì reconcile, không thì conflict.

**Bản nói 20–40 giây:** “Em không dựa vào unique index trên telemetry. Receipt chọn quyền ghi và fingerprint ngăn reuse key đổi nội dung. Cùng event retry đã commit trả duplicate; kết quả chưa rõ giữ PENDING thay vì insert mù.”

**Nguồn:** [apps/api/src/telemetry/telemetry.service.ts:32](../../apps/api/src/telemetry/telemetry.service.ts#L32)

**Hỏi tiếp:** Exactly-once vĩnh viễn?

**Nếu bị hỏi phần chưa có / giới hạn:** Không: write tách, receipt TTL 7 ngày và pending reconciliation giới hạn guarantee.

### 10. Hai request đồng thời hoặc crash giữa các write thì sao?

**Giải thích:** Unique receipt chặn writer thứ hai; loser có thể thấy PENDING và 409. Crash sau telemetry trước receipt có thể reconcile; crash trước telemetry có thể để pending chưa tự phục hồi. Batch không transaction.

**Bản nói 20–40 giây:** “Em ưu tiên fail closed để không nhân đôi measurement khi write outcome chưa rõ. Retry có thể reconcile nếu measurement đã tồn tại, hoặc cần xử lý pending. Em chưa có distributed transaction hay queue bền vững cho mọi failure mode.”

**Nguồn:** [apps/api/test/api.integration.ts:88](../../apps/api/test/api.integration.ts#L88)

**Hỏi tiếp:** Có concurrency stress test không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa; test retry/reconcile không chứng minh mọi race đa process.

### 11. Hãy giải thích một Aggregation Pipeline thực tế.

**Giải thích:** currentAverages match range/charger/current number, group dateTrunc bucket, avg current và sum sample, sort tăng, limit rồi project. Cửa sổ/bucket/limit được parseQuery bound.

**Bản nói 20–40 giây:** “Pipeline đẩy lọc và gom vào DB: chọn mẫu có current, chia bucket thời gian rồi lấy trung bình và đếm mẫu. Đây là trung bình theo mẫu, không theo thời lượng. Em không dùng nó để suy power đo được.”

**Nguồn:** [apps/api/src/analytics/analytics.service.ts:52](../../apps/api/src/analytics/analytics.service.ts#L52)

**Hỏi tiếp:** Overview có gọi pipeline đó không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không: Overview gọi stationSummary; endpoint current-averages chưa được BFF allowlist.

### 12. TTL và các index bảo vệ điều gì?

**Giải thích:** Telemetry expireAfterSeconds 604800 theo ts; receipt TTL createdAt 604800. Index charger/time và station/time hỗ trợ bounded query; queue/timeline có index. Không mọi existing options đều được initializer reconcile.

**Bản nói 20–40 giây:** “TTL giúp giới hạn dữ liệu demo, không xóa đúng từng giây và không phải backup. Receipt chỉ giữ dedup trong horizon tương ứng. Index giúp access pattern nhưng em vẫn cần explain/load test trước khi nói hiệu năng.”

**Nguồn:** [apps/api/src/database/initialize.ts:24](../../apps/api/src/database/initialize.ts#L24)

**Hỏi tiếp:** Video cuối tháng còn dữ liệu ngày 19 không?

**Nếu bị hỏi phần chưa có / giới hạn:** Có thể telemetry đã hết TTL; giữ dated evidence, không reset pinned incident để làm mới giả.

### 13. Overview hiển thị current tức thời phải không?

**Giải thích:** Không chính xác. stationSummary avg theo range mặc định 24 h, maxTs cho freshness; UI cộng mean của charger fresh. Asset configuredStatus không đồng bộ telemetry.

**Bản nói 20–40 giây:** “Biểu đồ hiện dùng current trung bình cửa sổ và kiểm tra tuổi mẫu gần nhất. Em không gọi nó là dòng tức thời. Tên hiển thị còn có chỗ dễ hiểu nhầm, nên tài liệu học nêu rõ semantics và hướng chỉ n h sau.”

**Nguồn:** [apps/web/src/app/page.tsx:94](../../apps/web/src/app/page.tsx#L94)

**Hỏi tiếp:** Charger Detail có newest không?

**Nếu bị hỏi phần chưa có / giới hạn:** History sort tăng limit 100 nên last trong danh sách có thể không là newest toàn window; giới hạn chưa sửa.

## Datadog

### 14. Vì sao Datadog thay Prometheus/Grafana?

**Giải thích:** Managed metrics/logs/dashboard/monitor và phù hợp yêu cầu hackathon; giảm phần tự vận hành. Self-hosted có trade-off về cost/control/maintenance. Không có TCO benchmark.

**Bản nói 20–40 giây:** “Datadog giúp em kiểm chứng metrics, log và monitor cùng bối cảnh trong phạm vi đề thi. Prometheus/Grafana là lựa chọn hợp lý nếu ưu tiên tự quản. Em chưa chứng minh giải pháp này rẻ hơn; trial và custom metric cost còn phải kiểm tra.”

**Nguồn:** [docs/DATADOG_PREPARATION.md:29](../../docs/DATADOG_PREPARATION.md#L29)

**Hỏi tiếp:** Sau trial còn dùng được không?

**Nếu bị hỏi phần chưa có / giới hạn:** Exact expiry/plan chưa xác nhận; owner hỏi BTC, không tự bật paid plan.

### 15. DogStatsD khác gọi Datadog API trực tiếp thế nào?

**Giải thích:** Ứng dụng gửi datagram UDP 127.0.0.1:8125 theo protocol; Agent giữ credential và chuyển intake. UDP best effort; flush local không phải cloud acknowledgment.

**Bản nói 20–40 giây:** “Em giữ intake key ngoài app bằng Agent và protocol đơn giản. Đổi lại có thể mất UDP và không biết server đã nhận từ callback send. Muốn biết US1 nhận phải kiểm metric/log/monitor thực tế.”

**Nguồn:** [apps/api/src/observability/observability.service.ts:40](../../apps/api/src/observability/observability.service.ts#L40)

**Hỏi tiếp:** Có retry/durable delivery cho metric không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không; nếu cần accounting dùng DB/durable event, không lấy count monitoring làm ledger.

### 16. Monitor phát hiện fault chính xác bằng cách nào?

**Giải thích:** Query sum(last_1 m) space sum fault.simulated service/env as_count >=1. Metric phát cho accepted event có synthetic fault state hoặc faultCode; không temperature comparison.

**Bản nói 20–40 giây:** “Monitor hỏi một phút gần nhất có ít nhất một sự kiện fault giả lập không. Nó đếm event hợp lệ do app phát, không đọc cảm biến nhiệt và không đặt ngưỡng 72 độ. Ingestion failure là câu hỏi khác.”

**Nguồn:** [config/datadog/monitors/synthetic-faults.json:1](../../config/datadog/monitors/synthetic-faults.json#L1)

**Hỏi tiếp:** Nhiều pulse cùng incident đếm thế nào?

**Nếu bị hỏi phần chưa có / giới hạn:** Mỗi new event có thể tăng; không phải unique incident count, không group incident tag.

### 17. Monitor OK nhưng incident chưa xử lý có thể xảy ra không?

**Giải thích:** Có, count window expiry và missing-count behavior có thể đưa OK. Incident status lưu riêng, không webhook đồng bộ; original Phase D automaticOK lúc OPEN là evidence trực tiếp.

**Bản nói 20–40 giây:** “Có, và em đã có evidence điều đó. OK ở rule này chỉ nghĩa cửa sổ không còn fault count đủ ngưỡng. Vì vậy em kiểm timeline operator và recovery telemetry riêng, không gọi OK là sửa xong phần cứng.”

**Nguồn:** [docs/PHASE_D_VERIFICATION.md:21](../../docs/PHASE_D_VERIFICATION.md#L21)

**Hỏi tiếp:** Nếu Agent chết thì monitor sao?

**Nếu bị hỏi phần chưa có / giới hạn:** Silence có thể không alert; chưa có heartbeat/observability-health monitor đáng tin cậy.

### 18. 166,33 giây có phải measured end-to-end detection latency?

**Giải thích:** Là thời gian từ first reemitted source timestamp đến authenticated UI confirmation, includes polling/note-taking. Reported alert history trước event 2.684 s nên internal latency chưa established.

**Bản nói 20–40 giây:** “Đó là cận trên quan sát 166,33 giây, không phải latency nội tại chính xác của Datadog. Em giữ source time và observer time riêng. History lệch về trước nên em không dùng nó suy detection latency âm hoặc cam kết SLA.”

**Nguồn:** [docs/evidence/phase-d-e2e.json:255](../../docs/evidence/phase-d-e2e.json#L255)

**Hỏi tiếp:** 8,53 giây recovery là gì?

**Nếu bị hỏi phần chưa có / giới hạn:** HistoryOK minus persisted recovery time, precision giây và count expiry; không MTTR hardware.

### 19. Vì sao ingestion-error monitor không alert ở case mới nhất?

**Giải thích:** Demo fault là telemetry hợp schema; không chủ động 401/400. Request metrics chỉ hai telemetry HTTP routes; demo internal service không tạo HTTP failure.

**Bản nói 20–40 giây:** “Fault trạng thái vận hành khác lỗi ingestion. Input giả lập được validate và lưu thành công nên không cần request lỗi. Em không claim monitor ingestion-error đã alert ở Phase D; Phase B cũ có kịch bản validation failure riêng.”

**Nguồn:** [apps/api/src/observability/ingestion.middleware.ts:10](../../apps/api/src/observability/ingestion.middleware.ts#L10)

**Hỏi tiếp:** Các test trước từng alert cả hai?

**Nếu bị hỏi phần chưa có / giới hạn:** Có datedPhase B khác run, không dùng nó thay bằng chứng Phase D.

### 20. Correlate log với MongoDB mà không làm metric cardinality nổ thế nào?

**Giải thích:** Generated run/incident IDs được allowlist trong JSON log; metric giữ service/env/source/origin/bounded 5 asset. Ngoài allowlist collapse other, có collision gauges.

**Bản nói 20–40 giây:** “Em tìm log bằng demo_id hoặc incident_id rồi đối chiếu incident/actions trong DB. ID chi tiết không làm tag mỗi metric. Cách này giữ phạm vi series nhỏ nhưng chưa phải distributed trace và nhóm other không dùng để phân biệt mọi device.”

**Nguồn:** [apps/api/src/observability/observability.service.ts:61](../../apps/api/src/observability/observability.service.ts#L61)

**Hỏi tiếp:** Có trace ID/span duration không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không implement APM; correlation log không thay span chain.

## Dữ liệu thật và ACN

### 21. Làm sao phân biệt observed, source-reported, derived và synthetic?

**Giải thích:** Event-level sourceType và field-level provenance riêng. ACN current MEASURED theo nguồn; exported state/energy SOURCE_REPORTED; heuristic state DERIVED; demo fields SYNTHETIC.

**Bản nói 20–40 giây:** “Em đọc nhãn từng field, không chỉ badge event. Một event ACN_REPLAY vẫn có state do app suy ra. Current nguồn lịch sử không được trộn thành bằng chứng lỗi thật khi fault và temperature do phần mềm tạo.”

**Nguồn:** [apps/api/src/telemetry/telemetry.schema.ts:8](../../apps/api/src/telemetry/telemetry.schema.ts#L8)

**Hỏi tiếp:** Client có thể nói dối nhãn không?

**Nếu bị hỏi phần chưa có / giới hạn:** Có, schema kiểm khai báo chứ không ký/xác thực sensor; hardware attestation chưa có.

### 22. Vì sao chỉ năm phiên, có đại diện thị trường không?

**Giải thích:** Acquisition record chọn convenience subset đầu danh sách pinned export. Đủ kiểm parser/quality/local viewer; không random, không fleet benchmark, không distinct EVSE sampling.

**Bản nói 20–40 giây:** “Năm phiên là tập kỹ thuật nhỏ đã có local để kiểm transform và provenance. Em không coi đó là mẫu đại diện hoặc cơ sở kết luận độ tin cậy hệ thống sạc. Muốn coverage thật cần quyền và thiết kế lấy mẫu theo stationID khác nhau.”

**Nguồn:** [docs/DATA_PROVENANCE.md:12](../../docs/DATA_PROVENANCE.md#L12)

**Hỏi tiếp:** Đã tải thêm device khác chưa?

**Nếu bị hỏi phần chưa có / giới hạn:** Chỉ metadata candidate prefixes, chưa thêm sessions hoặc xác minh physical devices.

### 23. Một EVSE filename prefix nghĩa là gì?

**Giải thích:** Năm tên export có chung prefix; reader tạo alias local từ prefix metadata. Không độc lập validate official stationID/physical identity. Không được gọi 5 session là 5 charger.

**Bản nói 20–40 giây:** “Đó là dấu hiệu chung định danh trong tên export, không là chứng nhận số thiết bị vật lý. Với dữ liệu hiện có em chỉ báo một prefix quan sát. Năm bộ sạc trong nhánh vận hành là năm asset ảo riêng.”

**Nguồn:** [apps/api/src/adapters/local-history.ts:21](../../apps/api/src/adapters/local-history.ts#L21)

**Hỏi tiếp:** Vì sao không dùng sourceID làm tag?

**Nếu bị hỏi phần chưa có / giới hạn:** Privacy/cardinality; mapping giữ ignored, cần xác minh quyền/identity trước mở phạm vi.

### 24. Có quyền public hoặc redistribute ACN không?

**Giải thích:** Chưa established grant cho static subset cloud/public/redistribution. Education/research terms và citation không tự grant mọi use; private GitHub cũng là bên thứ ba/redistribution.

**Bản nói 20–40 giây:** “Em chưa có quyền được xác nhận cho công khai trace hoặc đưa record lên Atlas/Datadog. Vì vậy historical ở local và sourcefile ignored. Em đã có inquiry draft hỏi từng scope; chưa gửi, chưa giả định public download là tự do dùng.”

**Nguồn:** [docs/HISTORICAL_LOCAL_MODE.md:55](../../docs/HISTORICAL_LOCAL_MODE.md#L55)

**Hỏi tiếp:** Private judge video có được xem trace không?

**Nếu bị hỏi phần chưa có / giới hạn:** Cần xét display/broadcast/recording scope, không tự coi private là exempt.

### 25. Vì sao 20.228 row thành 1.246, có mất thông tin không?

**Giải thích:** Giữ first rồi row cách last emitted>=60 source seconds, không averaging. Không cadence đồng đều; skip terminal và transient giữa điểm là possible.

**Bản nói 20–40 giây:** “Đó là downsampling chọn điểm để xem một demo nhỏ, không tổng hợp tất cả thành mean. Em mất độ phân giải và có thể không thấy transient/reset cuối. Chart nối selected points không khôi phục phép đo đã bỏ.”

**Nguồn:** [apps/api/src/adapters/acn.adapter.ts:118](../../apps/api/src/adapters/acn.adapter.ts#L118)

**Hỏi tiếp:** Có anti-alias ing/peak preservation không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa; muốn phân tích fault physic cần sampling/aggregation policy khác được kiểm chứng.

### 26. Replay time, source time và energy reset xử lý thế nào?

**Giải thích:** Original sourceinstant giữ sourceEventAt; mappedts=anchor+floor(elapsed/speed). Energy counter giữ nguồn/flag decrease, không dùng last/max là validated session total.

**Bản nói 20–40 giây:** “Em giữ hai đồng hồ để không gọi lịch sử là live. Đổi speed làm clock demo đổi, không đổi sourceinstant. Counter energy có reset nên em giữ nguyên và gắn caveat, không cộng lại thành tổng năng lượng chưa có cơ sở.”

**Nguồn:** [apps/api/src/adapters/acn.adapter.ts:123](../../apps/api/src/adapters/acn.adapter.ts#L123)

**Hỏi tiếp:** Có thể khôi phục total hoặc sửa timezone không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa đủ source evidence; không tự đoán offsets hoặc total.

## Incident lifecycle

### 27. Ai tạo incident: Datadog hay application?

**Giải thích:** DemoService triggerFault insert incident/action trước telemetry. Datadog independent observability, không webhook mở incident. Repeated active check return old across group.

**Bản nói 20–40 giây:** “Application tạo incident khi operator chạy simulation. Datadog phát cảnh báo trên tín hiệu nhận được sau đó. Em chưa implement alert webhook tự mở incident, nên không trình bày đó là tính năng đã có.”

**Nguồn:** [apps/api/src/demo/demo.service.ts:60](../../apps/api/src/demo/demo.service.ts#L60)

**Hỏi tiếp:** Có thể phát fault mà incident chưa persist không?

**Nếu bị hỏi phần chưa có / giới hạn:** Writes không transaction; cần xử lý partial failure/reconcile, chưa autonomous detection engine.

### 28. Recovery và resolve có đảm bảo đúng trình tự không?

**Giải thích:** Acknowledge trước; recover reserve timestamp trong conditional update, ingest one affected charger rồi marker; resolve đòi RESOLVING+marker. Stable action IDs/recovery event payload hỗ trợ retry.

**Bản nói 20–40 giây:** “Backend chặn resolve khi chưa có telemetry recovery lưu thành công. Recovery chỉ ghi charger của incident và giữ timestamp cố định để retry không đổi fingerprint. Nhưng đây vẫn là workflow mô phỏng, không proof physical repair.”

**Nguồn:** [apps/api/src/demo/demo.service.ts:115](../../apps/api/src/demo/demo.service.ts#L115)

**Hỏi tiếp:** Reset có đi qua cùng luật không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không: reset admin-demo đóng active và ghi baseline_reset, không dùng làm bằng chứng lifecycle chuẩn.

### 29. Trigger có idempotent tuyệt đối khi hai người bấm cùng lúc không?

**Giải thích:** Không. Tìm active trước insert giúp tuần tự/double click thông thường; không atomic unique lock cho activeincident. Hai concurrent requests có thể thấy không có active rồi tạo hai case.

**Bản nói 20–40 giây:** “Em có safeguard trả lại incident đang active, kể cả bấm charger khác. Nhưng check trước insert chưa chứng minh concurrency-safe. Production cần atomic constraint hoặc lock/request identity, không chỉ disable nút.”

**Nguồn:** [apps/api/src/demo/demo.service.ts:34](../../apps/api/src/demo/demo.service.ts#L34)

**Hỏi tiếp:** Test đã bao phủ race chưa?

**Nếu bị hỏi phần chưa có / giới hạn:** Test active existing và retry, chưa concurrent stress; không sửa feature trong task này.

## Bảo mật

### 30. Attacker có thể trigger fault qua frontend không?

**Giải thích:** Current BFF dev loopback/sameorigin và server key hạn chế request trong phạm vi demo. Không human login; hostile local client/process có thể spoof headers; direct Nest chỉ shared key.

**Bản nói 20–40 giây:** “Em không tuyên bố an toàn public. Trên local interface operator có thể thao tác demo; policy chủ yếu bảo vệ key và hạn chế browser cross-origin. Nếu expose ra ngoài cần login, authorization và rate/CSRF controls đầy đủ.”

**Nguồn:** [apps/web/src/lib/bff-policy.mts:65](../../apps/web/src/lib/bff-policy.mts#L65)

**Hỏi tiếp:** HTTPS trong production đủ không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không: encryption không thay identity/permission, reads vẫn cần access design.

### 31. Secret và DB role được bảo vệ thế nào?

**Giải thích:** RootDBURI/ingest key local ignored, web Nest key server env, Agent intake key riêng. Config reject TLS disable; previous role script checks scope 1 DB; nofreshrolesaudit trong task.

**Bản nói 20–40 giây:** “Browser không giữ credentialDB hoặc shared key backend. Log allowlist tránh ghi secret, env không commit. Evidence trước kiểm scopedDBrole; em không dùng một ping hôm nay để khẳng định toàn bộ privilege vẫn đúng.”

**Nguồn:** [apps/api/scripts/verify-atlas.ts:26](../../apps/api/scripts/verify-atlas.ts#L26)

**Hỏi tiếp:** Có secret manager/rotation production chưa?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa; .env local không thay managed secrets, lifecycle/audit rotation.

## Kiểm thử

### 32. 29/11/4 tests có chạy against Atlas thật không?

**Giải thích:** 29 unit có mocks/local UDP/fixtures,11 integration có mongo d 8.0.16 local và override s,4 web pure policy. AtlasUS1 evidence là manual run riêng có ngày, không fresh cloud test.

**Bản nói 20–40 giây:** “Không. Em chạy test regression local và nói rõ fixture nào thật/mocked. Chúng chứng minh logic HTTP/DBlocal và policy. Atlas/Datadog end-to-end được hỗ trợ bởi evidence Phase D ngày 19/10, không do test counts tự suyra.”

**Nguồn:** [apps/api/test/api.integration.ts:26](../../apps/api/test/api.integration.ts#L26)

**Hỏi tiếp:** Test nào bảo đảm UI không leak key?

**Nếu bị hỏi phần chưa có / giới hạn:** Có source/policy review nhưng chưa fullbrowsersecurityE2E; không coi typecheck là penetration test.

## Hiệu năng và mở rộng

### 33. Thông lượng tối đa vàP 95 là bao nhiêu?

**Giải thích:** Chưa có load benchmark. Middleware latency là telemetry HTTP processing, histogram Agent-local không phải global P 95. Batch sequential 100 bound, extra asset/receipt writes, polling/read sort có thể là bottleneck.

**Bản nói 20–40 giây:** “Em chưa đo được throughput maximum hoặc P 95 toàn bộ pipeline, nên không nêu số. Hiện có instrumentation và functional tests cho quy mô demo. Bước tiếp là workload rõ, explain query, load test và cost measurement.”

**Nguồn:** [apps/api/src/telemetry/telemetry.service.ts:77](../../apps/api/src/telemetry/telemetry.service.ts#L77)

**Hỏi tiếp:** Vậy scale 10.000 charger được không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không thể kết luận từ 5 virtual charger; cần gateway/buffer ing/partition/query/cardinality design và benchmark.

## Độ tin cậy

### 34. Sau network outage có tựbù dữ liệu không?

**Giải thích:** Không durable offline queue. API readiness fail/error, client retry cùng key/fingerprint có thể dedup; uncertain PENDING cần reconcile. UDP metrics không durable.

**Bản nói 20–40 giây:** “Em có safe try/retry logic cho event đã gửi nhưng không có store-and-forward toàn diện. Khi mất mạng, mẫu chưa được giữ ở nguồn có thể mất. Production cần buffer bền, backoff, ordering và reconciliation được test.”

**Nguồn:** [apps/api/src/telemetry/telemetry.service.ts:68](../../apps/api/src/telemetry/telemetry.service.ts#L68)

**Hỏi tiếp:** Có tự reconnect MongoDB không?

**Nếu bị hỏi phần chưa có / giới hạn:** Driver có hành vi kết nối của nó, nhưng code không là durable pipeline; không hứa mọi request/mẫu tự khôi phục.

### 35. Không dữ liệu có nghĩa current 0 hoặc charger OFFLINE không?

**Giải thích:** Không. Fields optional và UI có N/A/stale; count monitor không reliable heartbeat; activity only recent presence. Source 0 là giá trị khác absence.

**Bản nói 20–40 giây:** “Em giữ zero khác missing:0 A là một giá trị được gửi, còn không sample là không biết. UI có freshness và N/A nhưng chưa có heartbeat monitor để kết luận offline tự động. Đây là giới hạn quan trọng.”

**Nguồn:** [apps/api/src/analytics/analytics.service.ts:69](../../apps/api/src/analytics/analytics.service.ts#L69)

**Hỏi tiếp:** Có thể dùng gauge OFFLINE hiện có không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chỉ khi input đó thực được gửi; hệ thống không tự suy OFFLINE từ silence.

## Giá trị, đổi mới và đóng góp AI

### 36. ChargeGuard khác dashboard Datadog đơn lẻ ra sao?

**Giải thích:** Product-specific asset/provenance/receipt/incident workflow và local history boundary gắn metrics/logs evidence với action. Không claim new detection algorithm hoặc commercial uniqueness.

**Bản nói 20–40 giây:** “Phần đóng góp sản phẩm là quy trình và ranh giới dữ liệu: operator xem nguồn, điều tra cùng ID, gửi phục hồi đúng asset rồi đóng incident có audit. Datadog dashboard không tự thay collection nghiệp vụ đó. Em chưa có algorithm AI phát hiện fault mới.”

**Nguồn:** [apps/api/src/incidents/incidents.service.ts:60](../../apps/api/src/incidents/incidents.service.ts#L60)

**Hỏi tiếp:** Có business value đã đo không?

**Nếu bị hỏi phần chưa có / giới hạn:** Chưa ROI/customer pilot; trình bày giả thuyết về traceability/coordination, không nêu%giả.

### 37. Em đã đóng góp gì so với AI-generated code?

**Giải thích:** Owner báo AI hỗ trợ đáng kể; không tự sáng tác tỷ lệ/tác giả của code. Có thể bảo vệ bằng tracing request, giải thích schema/monitor/provenance/tests và nêu limitations. Human review claim phải đúng việc owner đã thực làm.

**Bản nói 20–40 giây:** “Em dùng AI hỗ trợ đáng kể và sẽ disclose đúng. Em không nhận đã tự viết mọi dòng. Trách nhiệm của em là hiểu luồng, kiểm chứng bằng tests/evidence và giải thích trade-off. Phần nào chưa hiểu em cần đọc/luyện thêm, không che bằng slide.”

**Nguồn:** [docs/SUBMISSION_CHECKLIST.md:102](../../docs/SUBMISSION_CHECKLIST.md#L102)

**Hỏi tiếp:** Có thể giải thích một nhánh code khó không?

**Nếu bị hỏi phần chưa có / giới hạn:** Mở persist PENDING hoặc recover reserved timestamp; nếu chưa hiểu, thừa nhận và đọc code, không dùng AI claim thay kiến thức.

## Giới hạn và triển khai

### 38. Có thể deploy bán cho doanh nghiệp ngay không?

**Giải thích:** Không. Chưa hardware auth/actuation, human RBAC, durable offline path, reliable heartbeat, tracing/load/security verification; public deployment blocked. Demo/technical learning là phạm vi.

**Bản nói 20–40 giây:** “Em chưa coi đây là sản phẩm production. Prototype đã kiểm chứng pipeline và workflow, nhưng deploy business cần identity, thiết bị thật, reliability, permission và pilot. Em không dùng hackathon E2E để thay nghiệm thu triển khai.”

**Nguồn:** [docs/PROJECT_STATUS.md:55](../../docs/PROJECT_STATUS.md#L55)

**Hỏi tiếp:** Ưu tiên tiếp theo là gì?

**Nếu bị hỏi phần chưa có / giới hạn:** Chốt quyền/access và security boundary trước; hardware/heartbeat/durable pipeline sau, dựa trên pilot có quyền.

### 39. Repo private thì mời giám khảo Read-only được không?

**Giải thích:** Owner Type User; personal private collaborator có read+write, không role Read-only. Terms yêu cầu official judge accounts access; owner/BTC cần chọn phương án, không invite unknown.

**Bản nói 20–40 giây:** “Repo hiện private và thuộc tài khoản cá nhân. GitHub không có Read-only collaborator ở ownership này, nên em cần thống nhất với BTC và owner thay vì tự grant quyền rộng. Không đổi visibility hoặc mời tài khoản đoán.”

**Nguồn:** [docs/JUDGE_ACCESS_PLAN.md:1](../../docs/JUDGE_ACCESS_PLAN.md#L1)

**Hỏi tiếp:** Có chuyển organization tự động không?

**Nếu bị hỏi phần chưa có / giới hạn:** Không; transfer/access change cần quyết định owner, không là tác vụ học/code hiện tại.

### 40. Phần nào trong evidence chưa được verify lại hôm nay?

**Giải thích:** Cloud TLS/auth/roles/US1 hiện tại states/trial expiry và physical source identity không fresh verify lại. Local tests vừa chạy; Phase D file đã đọc/đối chiếu nhưng đó là dated proof.

**Bản nói 20–40 giây:** “Em nói rõ thời điểm của bằng chứng. Trong task này em chạy regression local và audit code; không gây lỗi mới hoặc thay DB/monitor. Những kết quả cloud được quan sát ngày 19/10 nằm trong evidence, không phải cam kết state hiện tại.”

**Nguồn:** [docs/PHASE_D_VERIFICATION.md:35](../../docs/PHASE_D_VERIFICATION.md#L35)

**Hỏi tiếp:** Không live Datadog thì demo sao?

**Nếu bị hỏi phần chưa có / giới hạn:** Dùng dated evidence và giải thích fallback, không gọi nó là live hoặc bịa cảnh báo.
