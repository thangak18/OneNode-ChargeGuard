# 01 — Hiểu ChargeGuard từ đầu

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

## 1. Bài toán trước công nghệ

Hãy hình dung người vận hành có một bãi sạc: họ muốn biết điểm sạc nào còn gửi tín hiệu, dòng điện được báo là bao nhiêu, có sự kiện bất thường nào cần xem, ai đã kiểm tra và kết quả xử lý là gì. Chỉ có biểu đồ đẹp chưa đủ: sau khi một cảnh báo biến mất, họ vẫn cần lịch sử hành động để tránh quên một sự cố chưa xử lý.

**ChargeGuard là prototype quan sát vận hành và quản lý incident cho năm bộ sạc ảo.** Hệ thống lưu telemetry trong MongoDB, gửi metric/log cho Datadog và cung cấp UI để theo dõi, xác nhận, mô phỏng phục hồi rồi đóng incident. Một nhánh độc lập đọc dữ liệu sạc lịch sử ACN trên máy cá nhân. Chưa có thiết bị thật kết nối hoặc lệnh điều khiển điện.

Rủi ro ngoài đời có thể gồm mất kết nối, gián đoạn sạc, đo sai, cáp hoặc thiết bị lỗi. Đây là **bối cảnh kỹ thuật**, không phải các lỗi đã được ChargeGuard kiểm chứng trên phần cứng. Người vận hành cần phân biệt dòng bằng 0, không có mẫu mới, và lỗi được báo: ba điều đó không tương đương.

## 2. Những khái niệm đầu tiên

| Khái niệm | Nghĩa dễ hiểu | ChargeGuard thực hiện ra sao | Ví dụ và giới hạn |
| --- | --- | --- | --- |
| IoT | Thiết bị vật lý trao đổi dữ liệu với phần mềm | Mô hình dữ liệu và pipeline giống hệ thống nhận tín hiệu thiết bị, nhưng đầu vào cloud là mô phỏng | `chargerId` đại diện bộ sạc ảo; chưa có OCPP/MQTT hay gateway phần cứng |
| Telemetry | Dữ liệu một đối tượng gửi về để quan sát từ xa | Một event có thời gian, định danh và trường đo/trạng thái có provenance | 8,25 A cùng `CHARGING`, nguồn SYNTHETIC |
| Monitoring | Theo dõi các tín hiệu đã chọn | Current, request success/failure, status trên dashboard | Một gauge cũ chưa chứng minh thiết bị còn online |
| Alerting | Luật tự đánh dấu tín hiệu cần chú ý | Datadog đếm synthetic fault trong một phút | Ít nhất một fault trong cửa sổ làm monitor ALERT |
| Incident management | Ghi nhận và theo dõi quá trình xử lý | Incident có trạng thái và timeline hành động trong MongoDB | OPEN → ACKNOWLEDGED → RESOLVING → RESOLVED |
| Observability | Dùng tín hiệu để hiểu bên trong hệ thống đang xảy ra gì | Metric cho xu hướng; log có ID để đối chiếu incident | Chưa có distributed trace để nối mọi span request |
| Provenance | Nhãn nguồn gốc và cách hình thành giá trị | Nhãn cả event và từng field | Event ACN_REPLAY vẫn có `chargingState` DERIVED |

**VERIFIED IN SOURCE CODE:** [apps/api/src/telemetry/telemetry.schema.ts:17](../../apps/api/src/telemetry/telemetry.schema.ts#L17), [apps/api/src/observability/observability.service.ts:57](../../apps/api/src/observability/observability.service.ts#L57), [apps/api/src/incidents/incidents.service.ts:47](../../apps/api/src/incidents/incidents.service.ts#L47).

## 3. Hai nhánh phải nói đúng ngay từ đầu

**Synthetic Operations:** nút UI phát dữ liệu mới tại thời điểm chạy. NestJS xác thực/kiểm tra/lưu Atlas và phát metric/log. Datadog xử lý tín hiệu thật của ứng dụng nhưng tín hiệu mô tả bộ sạc **ảo**. UI polling định kỳ. Đây là xử lý vận hành gần thời gian thực, không phải hệ thống hard real-time có deadline bảo đảm.

**Historical Local:** năm phiên sạc có thật trong quá khứ, 20.228 dòng; adapter chọn 1.246 điểm. Chúng đọc từ file ignored qua endpoint riêng, không vào NestJS/Atlas/Datadog. Đồng hồ replay chỉ giúp xem nhanh, không biến dữ liệu cũ thành live. Một prefix tên nguồn không xác minh năm thiết bị vật lý.

**VERIFIED BY TESTS / EVIDENCE:** số liệu tổng hợp [docs/evidence/historical-local-audit.json:1](../../docs/evidence/historical-local-audit.json#L1); incident [docs/PHASE_D_VERIFICATION.md:37](../../docs/PHASE_D_VERIFICATION.md#L37). Những quan sát cloud có ngày 19/10, không khẳng định trạng thái tài khoản hiện tại.

## 4. Ví dụ runtime từ góc nhìn người dùng

Operator chọn `SIM_OVERHEAT`. DemoService tạo incident OPEN, rồi gửi năm event: charger được chọn có 0 A/FAULT và 72 °C giả lập; bốn charger khác 8,25 A/CHARGING. Dữ liệu được ghi vào Atlas, còn Agent chuyển metric/log đến Datadog. Operator nhìn monitor trực tiếp, kiểm tra cùng ID trong log và UI, acknowledge rồi gửi một event recovery cho đúng charger bị lỗi. Cuối cùng resolve khi backend đã có dấu xác nhận telemetry recovery lưu thành công.

Nút fault **tạo incident trước** khi Datadog alert. Không có webhook tự tạo incident từ Datadog. Nhiệt độ 72 °C không được đọc từ cảm biến, và monitor không so nhiệt độ với ngưỡng. [apps/api/src/demo/demo.service.ts:21](../../apps/api/src/demo/demo.service.ts#L21), [apps/api/src/observability/demo-scenario.ts:2](../../apps/api/src/observability/demo-scenario.ts#L2).

## 5. Vai trò MongoDB và Datadog

MongoDB là nơi giữ bản ghi nghiệp vụ: asset, telemetry, receipt chống ghi lặp, incident và hành động. Datadog giúp nhìn xu hướng và đánh giá điều kiện cảnh báo, không thay thế trạng thái nghiệp vụ. Nếu chỉ có Datadog dashboard, operator vẫn thiếu luồng acknowledge/recover/resolve có audit trong sản phẩm. Nếu bỏ Datadog, API/UI vẫn có thể chạy với Atlas nhưng mất chứng cứ alert và log tập trung.

Lựa chọn có thể khác: SQL lưu cùng mô hình bằng bảng; Prometheus/Grafana phục vụ monitoring tự quản. **ENGINEERING INFERENCE:** stack hiện tại hợp với đề hackathon và mô hình document/time-series; không có benchmark chứng minh nó nhanh hoặc rẻ hơn các lựa chọn kia. Xem chương 02.

## 6. MVP làm được gì, chưa làm gì?

MVP gồm ingestion có key, schema validation, dedup trong cửa sổ receipt, truy vấn bounded, năm trang UI, hai monitor cấu hình và một lifecycle Phase D đã có bằng chứng. Nó không kết nối sạc thật, không tự sửa thiết bị, không có operator identity production, không có heartbeat alert hay distributed tracing. Historical chỉ local và quyền public/cloud còn chờ.

Câu trả lời cho giám khảo: “Em kiểm chứng pipeline quan sát và quy trình vận hành bằng sự kiện tổng hợp; dữ liệu ACN giúp nghiên cứu lịch sử riêng trên máy. Em không coi hai nhánh đó là bằng chứng phần cứng thật đang chạy.”

## 7. Ba cách giải thích thành lời

### Khoảng 30 giây

“ChargeGuard là prototype theo dõi và xử lý sự cố cho năm bộ sạc ảo. MongoDB lưu telemetry và lịch sử hành động, Datadog theo dõi metric, log và cảnh báo. Em đã có một incident giả lập đi từ phát hiện đến điều tra, phục hồi và đóng với evidence. Dữ liệu sạc lịch sử ACN được xem riêng trên máy, chưa đưa vào cloud hay coi là dữ liệu live.”

### Khoảng một phút

“Bài toán em chọn là giúp operator hiểu có gì xảy ra ở điểm sạc và lưu được quá trình xử lý. ChargeGuard có UI Next.js, API NestJS, MongoDB Atlas cho telemetry và incident, Datadog cho metric, log và monitor. Khi tạo synthetic fault, backend lưu dữ liệu có nhãn nguồn, Datadog phát cảnh báo theo số sự kiện, rồi operator acknowledge, gửi telemetry phục hồi và resolve. Em giữ riêng trạng thái monitor và trạng thái incident vì cửa sổ đếm có thể tự về OK dù chưa xử lý. Nhánh ACN đọc năm phiên lịch sử chỉ local; nó có một prefix nguồn, không phải năm sạc vật lý. Hệ thống chưa điều khiển phần cứng và chưa đủ bảo mật để public deployment.”

### Khoảng ba phút

“ChargeGuard bắt đầu từ nhu cầu đơn giản: operator cần biết tín hiệu nào đáng tin, sự kiện nào cần điều tra và ai đã xử lý. Dòng bằng 0 không đồng nghĩa mất kết nối, còn biểu đồ không có dữ liệu cũng không chứng minh bộ sạc bình thường.

Em xây hai nhánh độc lập. Nhánh vận hành dùng năm bộ sạc ảo. Browser gửi request qua BFF của Next.js; API key được giữ ở server. NestJS kiểm tra dữ liệu, tìm đúng station/charger, tạo receipt chống ghi lặp và ghi telemetry vào MongoDB Time Series. Incident và hành động dùng collection thường để cập nhật trạng thái và truy vấn timeline.

Ứng dụng gửi DogStatsD qua Agent local, đồng thời ghi JSON log đã allowlist. Datadog cho em dashboard và hai monitor: ingestion failure và synthetic fault. Fault monitor chỉ hỏi trong một phút có ít nhất một sự kiện fault giả lập hay không. Nó không kiểm tra nhiệt độ an toàn và không điều khiển thiết bị.

Case study ngày 19/10 dùng một incident xuyên suốt. Có bằng chứng monitor ALERT, log cùng ID, acknowledge, recovery cho một charger và RESOLVED với bốn hành động. Cận trên quan sát phát hiện là 166,33 giây gồm polling; em chưa đo được latency nội tại chính xác. Monitor về OK có thể do cửa sổ hết sự kiện nên em kiểm tra độc lập telemetry và incident.

Nhánh thứ hai đọc dữ liệu ACN lịch sử thật trên máy cá nhân: năm file, hơn hai mươi nghìn dòng, chọn còn 1.246 điểm. Em giữ thời gian gốc và đồng hồ phát lại riêng, đánh dấu trạng thái suy ra và không tạo sensor còn thiếu. Năm phiên có một prefix nên không được giới thiệu là năm sạc thật. Quyền cloud và public còn chờ.

Giá trị của MVP là nối tín hiệu, bằng chứng và hành động có audit trong một quy trình có thể giải thích. Bước production cần xác thực operator, gateway phần cứng, cơ chế bền vững khi mất mạng, đo tải và xác nhận quyền dữ liệu.”

Thời lượng là mục tiêu luyện nói, không được bảo đảm bằng số chữ. Hãy bấm giờ và rút câu sau khi đã hiểu nội dung.

## Tự kiểm tra

1. Monitor OK nhưng incident OPEN có vô lý không? **Không:** hai state machine độc lập.
2. ACN_REPLAY có nghĩa mọi field đều đo được? **Không:** xem `provenance.fields`.
3. Real-time ở đây là gì? **Request mới, persistence và quan sát bất đồng bộ/polling; không phải phần cứng live hay SLA tức thời.**
