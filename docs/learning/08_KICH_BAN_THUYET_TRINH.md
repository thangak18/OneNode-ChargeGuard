# 08 — Kịch bản nói và trình diễn để bảo vệ đúng hệ thống

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

Các mốc 60 giây, 5 phút, 10 phút là **định dạng luyện tập của đội**, không phải thời lượng chính thức BTC. Đây là speaker notes/slide content Markdown; chưa tạo deck/video, chưa chạy demo mutation. Tự bấm giờ vì tốc độ nói khác nhau.

## A. Elevator pitch khoảng 60 giây

“ChargeGuard là prototype giúp operator theo dõi và xử lý sự cố của năm bộ sạc ảo. Điểm em muốn giải quyết là không chỉ thấy cảnh báo, mà biết tín hiệu từ đâu, đã điều tra gì và vì sao có thể đóng incident.

Next.js phục vụ UI và BFF, NestJS thực hiện luật nghiệp vụ, MongoDB Atlas lưu telemetry time-series cùng incident và audit actions. Datadog nhận metric/log từ Agent và đánh giá monitor. Em đã có một case study synthetic với ALERT, log cùng ID, phục hồi đúng một charger và incident RESOLVED.

Nhánh dữ liệu thật là ACN lịch sử chỉ đọc local, giữ thời gian gốc và provenance; không phải live telemetry và chưa đưa vào cloud. Em không có phần cứng kết nối, không claim tự sửa sạc hay ngưỡng an toàn. Giá trị MVP là nối dữ liệu, quan sát và hành động có bằng chứng; production còn cần operator authentication, gateway và kiểm chứng tải.”

## B. Bài nói 5 phút — lời đọc và chuyển màn hình

Không chiếu raw ACN hay ảnh Datadog chưa che thông tin. Bảng sau có lời đọc chính xác để tập; trình chiếu sơ đồ/aggregate và synthetic evidence đã privacy-review. Dùng [outline gốc](../PRESENTATION_OUTLINE.md) làm nền, mở rộng thành nội dung dưới.

| Mốc mục tiêu | Slide/chuyển màn hình | Lời nói |
| --- | --- | --- |
| 0:00–0:20 | Slide 1: ChargeGuard / OneNode | “Em là developer của OneNode. ChargeGuard là prototype theo dõi và quản lý sự cố cho năm bộ sạc ảo. Em tập trung vào quy trình có thể kiểm chứng: tín hiệu đi vào hệ thống, được quan sát, operator điều tra và lưu bằng chứng xử lý.” |
| 0:20–0:45 | Slide 2: vấn đề | “Người vận hành không thể kết luận một điểm sạc bình thường chỉ vì không còn cảnh báo. Dòng bằng không có thể là không sạc; thiếu mẫu có thể là mất kết nối. Em tách dữ liệu quan sát, cảnh báo và trạng thái incident để không đánh đồng ba thứ đó.” |
| 0:45–1:20 | Slide 3: Mermaid hai nhánh | “Browser gọi BFF Next.js cùng origin; API key ở server. NestJS kiểm tra input rồi lưu vào MongoDB. Agent nhận metric và log để chuyển Datadog. Ở nhánh riêng, local reader đọc ACN và trả cho trang history. Nhánh đó không gọi ingestion, Atlas hoặc Datadog. Đây là ranh giới được giữ trong code, không chỉ là hai màu trên biểu đồ.” |
| 1:20–1:45 | Slide 4: số liệu lịch sử tổng hợp | “Năm file lịch sử có 20.228 dòng, năm hash khớp inventory. Chọn điểm cách nhau ít nhất 60 giây còn 1.246 điểm, không phải lấy trung bình. Năm phiên có chung một prefix nguồn, nên em không nói chúng là năm bộ sạc thật. Các định danh nguồn và trace chưa được đưa vào tài liệu public.” |
| 1:45–2:15 | Slide 5: provenance/hai đồng hồ | “Current là lịch sử được nguồn mô tả là đo được; state và energy là nguồn báo cáo. State ứng dụng được suy từ current lớn hơn 0,5 A và gắn DERIVED. Counter có reset; voltage, power và temperature không có trong mẫu. Đồng hồ replay là ánh xạ để xem nhanh, khác thời gian ghi gốc. Quyền public và cloud còn chờ xác nhận.” |
| 2:15–2:50 | Slide 6: data model + receipt | “Telemetry dùng Time Series theo ts và meta asset. Incident và action là collection thường. Trước khi insert telemetry, service tạo receipt unique theo station, charger và eventId, đồng thời lưu fingerprint payload. Retry giống nhau trả duplicate; cùng key nhưng nội dung khác trả conflict. Vì không có transaction xuyên các write, trạng thái chưa rõ có thể giữ PENDING để tránh ghi lặp mù.” |
| 2:50–3:25 | Slide 7: metric/query | “Metric cho biết xu hướng, log giúp tìm cùng ID. Fault monitor cộng synthetic fault event trong một phút, ít nhất một sự kiện là ALERT. Nó không kiểm tra nhiệt độ an toàn. Ngược lại ingestion-error monitor đếm request bị lỗi; một fault hợp schema vẫn ingest thành công, nên không buộc monitor lỗi ingestion cùng alert.” |
| 3:25–4:10 | Slide 8 / UI incident đã resolved, timeline có ngày | “Case study ngày 19/10 giữ cùng incident demo-58 a 1983 cae 09. Evidence có ALERT và log tương quan; operator acknowledge, gửi telemetry phục hồi 8,25 A cho đúng charger bị lỗi, rồi resolve. Có bốn audit actions. Monitor về OK được kiểm riêng. Cận trên phát hiện quan sát là 166,33 giây gồm polling; mốc OK khoảng 8,53 giây sau recovery theo history. Hết cửa sổ count cũng có thể làm OK khi incident còn mở, nên OK không chứng minh sửa phần cứng.” |
| 4:10–4:35 | Slide 9: tests/giới hạn | “29 unit API,11 integration và 4 web policy pass trên Node 24. Integration chạy MongoDB local, không phải lần đo cloud mới. Historical data route bị chặn ở production theo kiểm chứng finalization. UI có polling và giới hạn truy vấn; em chưa benchmark throughput, chưa có heartbeat monitor, tracing hoặc authentication production.” |
| 4:35–5:00 | Slide 10: kết luận phạm vi/việc cần làm | “Điểm em đã kiểm chứng là pipeline và lifecycle vận hành có provenance, audit và bằng chứng Datadog cho mô phỏng. Dữ liệu lịch sử được tách khỏi cloud vì quyền và tính trung thực nguồn. Bước tiếp theo là giải quyết dataset permission, judge access, hoàn thiện video/deck và các điều kiện production. AI hỗ trợ đáng kể; em chịu trách nhiệm hiểu và kiểm chứng code, không nhận là đã tự viết mọi dòng.” |

## C. Technical defense 10 phút — script mở rộng

Mỗi đoạn là khoảng một phút mục tiêu; chuyển code ở tên hàm ghi kèm, không mở env. Nếu cần đúng thời gian, luyện trước và giảm ví dụ; không nói nhanh để che phần chưa hiểu.

### 0:00–1:00 — Phạm vi sản phẩm

“Em phân biệt hệ thống kiểm chứng được và hệ thống ngoài đời. Backend thật nhận request và persistence thật; Datadog thật đánh giá tín hiệu. Nhưng đối tượng vận hành là sạc ảo và fault do phần mềm tạo. Dữ liệu ACN có nguồn quan sát quá khứ, chạy một đường local riêng. Với MVP, em muốn chứng minh rằng một sự kiện có thể đi từ input có kiểm tra đến record, tín hiệu quan sát, hành động operator và kết quả có audit. Em chưa chứng minh giao tiếp, safety hoặc actuation EVSE. Nếu giám khảo hỏi real-time, em trả lời là xử lý event mới và cập nhật bằng polling/asynchronous intake, không hard real-time hoặc dữ liệu phần cứng live.”

### 1:00–2:00 — Ranh giới HTTP và key

“Ở DemoPage, handleTriggerFault gọi api.triggerFault. Browser chỉ gọi BFF cùng origin, không giữ key. Route proxy kiểm allowlist, development/loopback/origin, body JSON không quá 8 KiB và các field/scenario hợp lệ; sau đó inject shared key ở server. Nest guard so hash bằng timingSafeEqual. Nhưng đây không phải login operator, actor cũng chỉ là nhãn. GET chưa có auth, CORS backend rộng và direct Nest không có cùng production mutation policy như BFF. Do đó em giữ loopback, không public deploy. Production cần user identity, authorization theo role, session/CSRF policy và rate limits.”

Mở [apps/web/src/app/api/v1/[...path]/route.ts:160](../../apps/web/src/app/api/v1/[...path]/route.ts#L160) và [apps/api/src/telemetry/ingest.guard.ts:9](../../apps/api/src/telemetry/ingest.guard.ts#L9).

### 2:00–3:00 — Data model

“Initializer quản lý sáu collection. Time Series telemetry dùng ts kiểu Date và meta gồm stationId/chargerId; metric biến động không đặt vào meta. Asset/incident/action/receipt ở regular collections để mutable state và unique identity phù hợp. Granularity seconds không ép cadence một giây. Telemetry retention bảy ngày theo ts, receipt bảy ngày theo createdAt; cleanup nền không đúng từng giây. Incident/action không có TTL do code này tạo. Seed chỉ upsert asset và giữ document đã có; không làm reading hiện tại. Một giới hạn là status trên charger là configured status, không được ingest cập nhật theo sensor.”

Mở [apps/api/src/database/initialize.ts:1](../../apps/api/src/database/initialize.ts#L1) và seed.

### 3:00–4:00 — Dedup và lỗi giữa các write

“Service xác thực schema, kiểm asset pairing, tính key từ station/charger/eventId và fingerprint payload canonical. Receipt PENDING insert trước measurement, sau đó commit receipt. Same key/same payload committed là duplicate; thay payload là 409. Nếu receipt còn pending, service tìm measurement đã ghi để reconcile; không thấy thì fail closed. Em không claim exactly-once hoặc batch transaction: có thể partial success, PENDING cần vận hành và receipt TTL giới hạn horizon. Hai request concurrent còn có thể conflict; cơ chế này ưu tiên không retry insert mù khi kết quả DB không chắc chắn.”

Mở [apps/api/src/telemetry/telemetry.service.ts:32](../../apps/api/src/telemetry/telemetry.service.ts#L32).

### 4:00–5:00 — Query và UI semantics

“AnalyticsService bound range tối đa 31 ngày và output limit. Latest sort theo ts rồi first mỗi charger; currentAverages group dateTrunc bucket và avg; states đếm event chứ không thời lượng. Overview lại gọi stationSummary mean theo default 24 h và đánh dấu fresh bằng maxTs. Vì vậy em không gọi current bar là dòng tức thời. ChargerDetail hiện lấy 100 mẫu đầu sort tăng và lấy cuối làm latest trong danh sách, có thể chưa là newest khi nhiều mẫu. Đây là giới hạn được ghi trong tài liệu học. Limit output cũng không bảo đảm query không scan nhiều; muốn scale phải explain và benchmark.”

Mở [apps/api/src/analytics/analytics.service.ts:52](../../apps/api/src/analytics/analytics.service.ts#L52), Overview và history call.

### 5:00–6:00 — Metrics, log và cardinality

“Observability có tám family. Request success/failure/latency chỉ ở POST telemetry/batch; internal demo service gọi ingestion không tự tạo request metric đó. Accepted-event metric phát sau persistence; retry duplicate không phát current/fault lần nữa. Current là gauge last processed; state là sáu gauge one-hot. App gửi UDP Agent nên callback không chứng minh US1 nhận. Log JSON allowlist bỏ payload/header/raw exception; incident/run ID có trong log, không làm metric tag. Ngoài năm asset demo, IDgom other để bounded cardinality nhưng gauge other có thể collide. Chưa có tracing và không có delivery guarantee.”

Mở [apps/api/src/observability/observability.service.ts:57](../../apps/api/src/observability/observability.service.ts#L57).

### 6:00–7:00 — Monitor syntax và recovery

“Monitor fault gồm space sum các series service/env, as_count và time sum last 1 m so với 1. Với một fault mới trong window thì alert; khi hết window không có fault nữa thì count 0 có thể OK. Rule không hỏi MongoDB incident status, không đọc 72°C và không actuation. Ingestion failure là metric request error khác, không phải fault state. CasePhase D gửi valid fault nên ingestion-error không bị intentionally triggered. Missing count evaluateas 0 cũng không dùng để phát hiện heartbeat mất. Với thiết bị thật cần cadence/lastseen và health signal để phân biệt hết fault với mất nguồn metrics.”

Mở [config/datadog/monitors/synthetic-faults.json:1](../../config/datadog/monitors/synthetic-faults.json#L1).

### 7:00–8:00 — Case study và độ chính xác đo

“Evidence có snapshot đầu OPEN/unverified và đoạn liveVerification hoàn tất, không xóa lịch sử. Resumption giữ incident cũ, thêm 12 fault pulse cùng charger, rồi ack/recover/resolve. DBfinal có 4 actions và recovery 8,25 A SYNTHETIC,0 write cho 4 charger còn lại. Observer confirm alert trừ first reemission là 166,329711 giây; đó là upperbound gồm thời gian nhìn UI. Datadog history alert còn sớm hơn client event 2,684 giây, có thể dointervalalignment/clock skew nên không suyra exact internal latency. Recovery→historyOK là 8,526 giây xấp xỉ, nhưng count window expiry mới là semantics monitor.”

Mở [docs/evidence/phase-d-e2e.json:85](../../docs/evidence/phase-d-e2e.json#L85) và timeline chương 04.

### 8:00–9:00 — Historical và compliance

“Adapter streamgunzip, parse CSV, kiểm timestamp/current/energy rồi chọn point cách last emitted>=60 s. Không averaging, không thêm voltage/power/temp. Source current nhãn MEASURED theo mô tả nguồn; exported state/energy SOURCE_REPORTED, app state DERIVED. SourceEventAt không đổi instant; replayAt bằng anchor cộng elapsed/speed. Local reader validate pinned revision/hash/size/rowcount, giữ mapping ignored và dùng content hash label. Generic CLI default dry run, execute cần quyền Atlas+Datadog theo ignored attestation. Gate không phải giấy phép hay server firewall. Five files one prefix không là five physical chargers; cloud/public/redistribution vẫn chờ grant.”

Mở adapter/test fixture, không mở raw sourcefile.

### 9:00–10:00 — Bằng chứng và bước production

“29 unit test API,11 integration và 4 web policy được chạy lại bằng Node 24. Integration dùng real mongo d local và observability override; không chứng minh Atlas TLS/Datadog live hôm nay. Unit UDP test kiểm packet local. EvidencePhase D mới là dated cloud E2E. Bảo vệ production cần operator auth, protocol gateway, reliable queue/outbox/reconciliation, heartbeat, observability health, load test và datarights. Repo private cá nhân không có Read-only collaborator nên owner/BTC cần thống nhất judge access. Em không nhận code AI là benchmark hoặc proof; em giải thích các flow, nêu giới hạn và chứng cứđã kiểm. Đây là nền prototype có thể phát triển tiếp, chưa phải hệ thống bán cho khách hàng ngay.”

## D. Nội dung từng slide và câu hỏi có thể gặp

| Slide / thời gian 5 phút | Key points / visual đề xuất | Nên nói / nguồn | Câu hỏi dễ gặp |
| --- | --- | --- | --- |
|1 /20 s|Title, OneNode,1 câu value; text-only|ScriptB 1; chương 01|Có charger thật không?|
|2 /25 s|Operator cần signal+action; sơ đồ 3 khái niệm|B 2; incident service|Monitor OK đủ chưa?|
|3 /35 s|Hai nhánh tách; MermaidA/E|B 3; chương 02|ACN có vào Atlas không?|
|4 /25 s|Aggregate 5/20228/1246/1 prefix; không trace|B 4; audit JSON|Vì sao 5 session?|
|5 /30 s|Source/fieldorigin và 2 clocks; fixture tự tạo|B 5; adapter/replay test|Energy reset xử lý ra sao?|
|6 /35 s|6 collection, receipt flow; synthetic schema|B 6; initialize/persist|Exactly-once?Transaction?|
|7 /35 s|8 metric families, query monitor; text|B 7; obs/config|Vì sao Datadog/Grafana?|
|8 /45 s|Timeline 19/10+resolvedUI riêng tư đã review|B 8; Phase Devidence|166,33 s làgì?|
|9 /25 s|Test matrix và limitations|B 9; chương 07|Test nào là Atlas thật?|
|10 /25 s|Owner actions/rights/disclosure|B 10; checklist|Đóng góp của em so với AI?|

ScriptB là speaker notes chính xác cho từng slide; scriptC mở rộng khi technical defense. Không dùng ảnh Datadog original có account/host labels hoặc ACN trace chưa grant. Không sửa metric state/timestamp trên ảnh; nếu chưa có bản sanitized đã duyệt thì dùng text timeline, ghi đó là diễn giải evidence, không screenshot.

## E. Live demo script — đọc trước, không thực thi trong task này

### Đường mặc định: không mutation, giữ evidence cũ

1. Owner khởi động dịch vụ đã cấu hình trên loopback nếu cần; không mở env ra màn chiếu. Kiểm tra readiness chỉ chứng minh DB reachable lúc kiểm, không Datadog.
2. Mở `/` → giải thích mean/freshness/N/A. Không reset nếu TTL làm telemetry trống; nói rõ retention và dùng evidence dated.
3. Mở `/incidents?selected=demo-58a1983cae09` và chọn incident nếu có trong queue; mong đợi RESOLVED/4 actions theo evidence đã lưu. Nếu DB/UI hiện khác hoặc incident ngoài 50 latest, không nói là live proof; mở Phase D report/JSON đã ghi ngày.
4. Mở `/chargers?id=demo-charger-01`, giải thích history 100 và provenance; không dùng bảng latest này khẳng định recovery event nếu đã outside window/TTL.
5. Owner tự mởUS1 dashboard/monitor history ngày 19/10. Logs query `service:chargeguard-api env:dev @demo_id:58a1983cae09`. Kiểm monitor 334137944 riêng 334137536. Nếu expired/không login, dùng dated report, screenshot đã review; không bị a point mới.
6. `/demo` chỉ chỉ rõ controls, **không**bấm Inject/Reset để tải incident đã đóng. State page không tự resume ID cũ.
7. Với ACN, chỉ nói aggregate/sơ đồ khi đang quay/chia sẻ. Chỉ mở `/history` riêng tư trên máy khi có basis sử dụng phù hợp và không record; quyền hiển thị public/judge broadcast phải xác nhận riêng.

### Nếu owner chủ động chọn một lần demo mới có ghi dữ liệu

Đây là hướng dẫn tương lai, không thay đổi incident đã resolved. Chỉ run mới khi owner định thực hiện, môi trường đã ready, không có activeincident khác, timing đủ và phạm vi được cho phép. Không cần thực hiện để học bộ tài liệu này.

| Bước | Nút/màn hình | Kỳ vọng / cách xác minh |
| --- | --- | --- |
|1|Demo Controls, chọn connector 1/SIM_OVERHEAT; không Reset|Nếu đã có active, giữ nó; đừng bypass bằng reset|
|2|Inject Synthetic Fault|201 incidentID mới OPEN;5 synthetic readings. Ghi ID và source UTC; response không là alert confirmation|
|3|US1 fault monitor 334137944/history|Chờ phút để intake/evaluate/poll; chỉ nói ALERT khi thấy state thực và timestamp. Single event có thể hết window trước khi observe|
|4|Logs theo demo ID mới; Incidents detail|Correlate fault/telemetry/actions. Không cố gây ingestion error chỉ để monitor 334137536 alert|
|5|Acknowledge Alert trên Demo khi OPEN|Backend ACKNOWLEDGED; action acknowledged. Không physical repair|
|6|Send Recovery Telemetry|RESOLVING+marker;8,25 A CHARGING SYNTHETIC đúng charger. Nếu fail, refresh/retry cùng incident; không resolve|
|7|Confirm & Close Incident (RESOLVED)|Chỉ khi marker có; action resolved. API không tự hỏi Datadog|
|8|MonitorhistoryOK và log/timeline|Xác minh riêng, count window có thể đã OK trước recovery. Lưu source/observer timestamps không sửa|

Không hứa thời gian ALERT/OK cố định:166,33 s/8,53 s là quan sát cũ, không SLA. Nếu one-shot ALERT không bắt kịp, không gán UI response thành alert; fallback đúng evidence dated. Không dùng `phase:d pulse` vì helper pinned incident cũ đã RESOLVED; không mở lại/run lại pinned case. Replay ACN `--execute` không thuộc demo này.

## F. Luyện nói có kiểm tra hiểu

Tập mở code và giải thích một dòng validation, một receipt branch, một pipeline, một metric condition. Nhờ người khác hỏi “Nếu Agent c hết thì OK có ý nghĩa gì?” và “Em biết timestamp nào là source?” Trả lời bằng source/evidence, không chỉ học thuộc script. Khi quên chi tiết: “Em chưa chắc giá trị đó; em sẽ chỉ vào implementation/evidence thay vì đoán.”
