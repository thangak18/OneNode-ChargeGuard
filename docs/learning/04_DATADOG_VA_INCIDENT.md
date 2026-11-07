# 04 — Datadog và case study incident đã kiểm chứng

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

## 1. Học từ tín hiệu đến quyết định

Metric là số theo thời gian, ví dụ số request lỗi hoặc current. Log là một event có timestamp và context: “recovery_requested” của incident nào. Trace là chuỗi span thể hiện request đi qua các bước/service với thời gian từng đoạn; ChargeGuard **chưa implement tracing/APM**. Có log correlation ID không tự thành distributed trace.

Agent là process trên máy nhận dữ liệu ứng dụng rồi chuyển về dịch vụ Datadog. DogStatsD là giao thức StatsD có tags: `c` cho count, `g` cho gauge, `ms` cho timing. **Count** tăng theo sự kiện; **gauge** là giá trị quan sát cập nhật; **timer** là mẫu thời gian, Agent tạo histogram summary. Metric family là nhóm tên cùng ý nghĩa, ví dụ một timer sinh `.avg`, `.95percentile` và các tên khác.

Tag là nhãn để lọc/gom: service, env, charger. Cardinality là số tổ hợp nhãn khác nhau tạo series. Cho eventId vào tag sẽ tạo rất nhiều series, nên ChargeGuard giữ ID tương quan trong log và chỉ tag 5 virtual charger cố định. Đây là kiểm soát phạm vi, không bảo đảm account miễn phí.

Nguồn implementation: [apps/api/src/observability/observability.service.ts:40](../../apps/api/src/observability/observability.service.ts#L40); khái niệm giao thức [Datadog metric types](https://docs.datadoghq.com/metrics/types/) và [DogStatsD submission](https://docs.datadoghq.com/metrics/custom_metrics/dogstatsd_metrics_submission/). Timer qua Agent được hiểu như histogram; đừng nhầm Agent P95 với percentile toàn cục của nhiều host.

## 2. Tám family metric thực tế

Mọi packet có `service:chargeguard-api`, bounded env. Prefix dưới đều là `chargeguard.`; tên trong bảng là tên đầy đủ. `DD_METRICS_ENABLED` opt-in; không bật thì metric socket không được tạo.

| Metric | Type / unit | Lúc phát / tags bổ sung | Điều không chứng minh |
| --- | --- | --- | --- |
| chargeguard.ingestion.success | c / request | response 2 xx của POST telemetry hoặc batch; mode single/batch, status_class | Không là số measurement; batch 1 request; retry thành công vẫn tính |
| chargeguard.ingestion.failure | c / request | response không 2 xx của đúng hai path; có guard/schema/DB failure | Fault hợp lệ không phải ingestion failure |
| chargeguard.ingestion.processing_ms | ms / milliseconds | middleware trước JSON parser → response finish; mode/status_class/outcome | Không gồm browser→BFF toàn bộ, Agent intake hay alert delay |
| chargeguard.telemetry.accepted | c / event | persist mới thành công; source acn_replay/derived/synthetic | Không có guarantee accounting khi crash hoặc UDP loss |
| chargeguard.telemetry.duplicate | c / retry event | nhận duplicate đã xác minh; source | Không phát lại current/status/fault; không có telemetry.accepted log ở nhánh return này |
| chargeguard.charger.current_a | g / A | new event có current; source, origin, bounded station/charger hoặc other | Last processed observation, có thể cũ/out-of-order |
| chargeguard.charger.operational_status | g / 0 hoặc 1 | new event có chargingState; cập nhật cả 6 state, source + asset + status | Không heartbeat/availability vật lý; stale không tự OFFLINE |
| chargeguard.fault.simulated | c / synthetic fault event | new event có FAULT state gắn SYNTHETIC **hoặc** faultCode gắn SYNTHETIC; asset tags | Không so temperature; không chỉ đếm một incident, pulse mới có thể tăng nhiều lần |

`accepted()` gọi metric accepted trước check duplicate? Code dùng tên động `telemetry.duplicate` **hoặc** `telemetry.accepted`, rồi return nếu duplicate. Không tăng cả hai cho cùng retry. Source/origin khác nhau: source là nhãn event, origin là nhãn field current.

Sáu state: AVAILABLE, CHARGING, NOT_CHARGING, IDLE, FAULT, OFFLINE. Nếu nhận CHARGING, gauge đó=1 và 5 gauge khác=0 cho cùng group source/asset. Nếu đổi source thì là series khác, không “xóa sạch” tất cả group cũ. Ngoài allowlist mọi asset gom vào `asset_scope:other`, có thể đè gauge nhau.

**VERIFIED BY TESTS / EVIDENCE:** [apps/api/test/observability.test.ts:14](../../apps/api/test/observability.test.ts#L14), [docs/DATADOG_PREPARATION.md:62](../../docs/DATADOG_PREPARATION.md#L62). Agent summaries từng quan sát: processing_ms.avg/.count/.max/.median/.95 percentile. Đó là evidence có ngày, không tra Metrics Summary live trong task này.

## 3. Log JSON: hữu ích nhưng cố ý hạn chế

`record()` chỉ cho event trong danh sách cố định; numeric status/duration hữu hạn; mode/outcome/source/action hợp allowlist; generated demo_id 12 hex, incidentId demo-12 hex và 5 asset. Bỏ payload, raw error, headers và URL. Framework logger không serialize Nest message/stack tùy ý. Nhờ vậy giảm rủi ro secret nhưng mất stack trace để debug.

Ví dụ JSON **SYNTHETIC tự tạo**, không log mới:

```json
{"timestamp":"2026-10-19T08:00:00.000Z","status":"warning","service":"chargeguard-api","env":"dev","message":"fault.simulated","demo_id":"012345abcdef","incident_id":"demo-012345abcdef","station_id":"demo-station-01","charger_id":"demo-charger-01","source":"synthetic","asset_scope":"demo"}
```

Log chứa ID để query incident cùng `_id` trong MongoDB; ID không là metric tag. `accepted()` nhận eventId dạng `b2-<run>-...` suy ra run/incident context. `demo.action` injection ban đầu có run, recovery/action sau có thể có incident. Actor là nhãn demo, không danh tính đã đăng nhập. Thêm pattern ID không làm provenance tự đáng tin từ phần cứng.

File host `/usr/local/var/log/chargeguard/api.jsonl`, stdout JSON; rotate khi >=5 MiB, giữ 1 backup. Config [config/datadog/chargeguard.conf.yaml:1](../../config/datadog/chargeguard.conf.yaml#L1) cho Agent tail source nodejs/service/env. Installer đã có cần owner sudo; không chạy trong task học. Đường dẫn cũ trên removable volume bị macOS chặn; vị trí host chuẩn giải quyết ở lần kiểm chứng trước. API không giữ Datadog key; Agent giữ key riêng ngoài repo.

`appendFileSync` là ghi đồng bộ có thể block event loop: instrumentation không chờ cloud nhưng không được khẳng định “không ảnh hưởng latency”. `flush()` chỉ chờ callback local socket, không chờ server Datadog nhận. Agent unavailable có thể làm metric mất; app chỉ warning once.

## 4. Dashboard: đọc đúng 11 widget

Artifact [config/datadog/chargeguard-operations.dashboard.json:1](../../config/datadog/chargeguard-operations.dashboard.json#L1), [dashboard US1](https://app.datadoghq.com/dashboard/875-kis-zg2). Dashboard hiển thị dữ liệu theo query, không phát lệnh xử lý incident.

| Widget | Query / cách đọc |
| --- | --- |
| Note | Virtual-only, nguồn và giới hạn heartbeat |
| Ingestion success/failure | `sum:chargeguard.ingestion.success{service:chargeguard-api,env:dev}.as_count()` và failure |
| Failure rate | `100 * failure / (success + failure)`; không traffic thì không xác định, không tự coi 0% |
| Latency | `avg:...processing_ms.avg` và `max:...processing_ms.95percentile` theo cùng service/env |
| Current | `avg:chargeguard.charger.current_a{service:chargeguard-api,env:dev} by {charger_id,source,origin}` |
| Năm status panel | `max:...operational_status{...,charger_id:demo-charger-01} by {status,source}`, đổi ID 01–05 |
| Fault count | `sum:chargeguard.fault.simulated{service:chargeguard-api,env:dev} by {charger_id}.as_count()` |

Avg của avg/P95 summary không thay một phân phối latency toàn cục. Gauge Datadog theo arrival không thay truy vấn latest theo event-time. Blank không là 0 hoặc all online.

## 5. Hai monitor, cùng cấu trúc nhưng khác câu hỏi

Fault monitor 334137944:

```text
sum(last_1m):sum:chargeguard.fault.simulated{service:chargeguard-api,env:dev}.as_count() >= 1
```

- `chargeguard.fault.simulated`: family count được emitter tạo.
- `{service:...,env:dev}`: chọn đúng service/env, tổng hợp mọi asset phù hợp.
- `sum:` ngay trước metric: gom series được chọn, không group riêng mỗi incident.
- `.as_count()`: đọc dữ liệu count theo tổng thay vì nhầm rate/giây.
- `sum(last_1m)`: cộng trên cửa sổ một phút gần nhất lúc đánh giá.
- `>= 1`: critical khi có ít nhất một synthetic fault trong cửa sổ.

Ví dụ **minh họa**, không benchmark: một cửa sổ có counts 0,0,1,0 thì tổng 1 → ALERT. Khi điểm 1 hết cửa sổ và không có fault mới, tổng 0 → OK theo behavior đã quan sát. Không có nghĩa incident đã resolve. Evaluation delay 0 không làm intake/Agent/UI delay bằng 0. Require full window false cho phép đánh giá mà không đợi cửa sổ đầy theo config. Artifact dùng `on_missing_data:default`; evidence UI Phase D xác nhận missing count được evaluate as 0. Không được generalize hành vi đó cho mọi metric type/monitor.

Ingestion-error 334137536 dùng metric `chargeguard.ingestion.failure`, còn lại query shape tương tự. Latest Phase D gửi fault **hợp schema**, không tạo 401/400, nên không có lý do buộc ingestion-error alert. Phase B cũ cố ý gửi current âm, đã quan sát cả hai monitor. Không trộn hai run.

Nguồn: [config/datadog/monitors/synthetic-faults.json:1](../../config/datadog/monitors/synthetic-faults.json#L1), [config/datadog/monitors/ingestion-errors.json:1](../../config/datadog/monitors/ingestion-errors.json#L1), [docs/PHASE_D_VERIFICATION.md:19](../../docs/PHASE_D_VERIFICATION.md#L19). Không có recipients/renotify; alert state không chứng minh email/Slack đã gửi. Không bật paid feature.

## 6. Vì sao alert có thể chậm, vì sao timestamp nhìn nghịch?

Runtime có network/Agent flush/intake/evaluation/UI polling và đồng hồ khác nhau. [DogStatsD aggregation](https://docs.datadoghq.com/extend/dogstatsd/data_aggregation/?lang_pref=en) mô tả gom interval và gán timestamp đầu interval; đó là một giải thích **có thể**, không kết luận nguyên nhân chính xác của chênh clock trong run này. Trình duyệt thấy ALERT muộn không đồng nghĩa rule chỉ đánh giá đúng lúc đó.

Không instrument end-to-end trace thì không tách được chi phí từng hop. Không heartbeat metric/monitor thì khoảng lặng không báo mất kết nối. Counter-window OK có thể là hết fault **hoặc** mất tín hiệu; không được chứng nhận physical repair.

## 7. Case study demo-58 a 1983 cae 09

**VERIFIED BY TESTS / EVIDENCE:** đọc [docs/evidence/phase-d-e2e.json:85](../../docs/evidence/phase-d-e2e.json#L85) cùng [docs/PHASE_D_VERIFICATION.md:1](../../docs/PHASE_D_VERIFICATION.md#L1). Snapshot đầu giữ OPEN/UNVERIFIED; kết quả hoàn tất nằm trong `liveVerification.finalAudit`, không ghi đè lịch sử.

| Mốc ngày 19/10/2026 | UTC | Ý nghĩa |
| --- | --- | --- |
| Incident detectedAt | 05:22:54.894 | Application tạo incident synthetic, chưa phải monitor alert |
| Original telemetry | 05:22:54.966 | 5 event, charger 01 FAULT 0 A/72°C; bốn charger 8,25 A |
| Original monitor ALERT / OK | 05:23:44 / 05:24:44 | OK tự động khi incident còn OPEN |
| First re-emitted fault | 06:47:46.684 | Bắt đầu 12 pulse cùng run/charger, không incident mới |
| Resumed ALERT history | 06:47:44 | Sớm hơn source 2,684 s; không suy ra latency âm |
| Observer authenticated confirmation | 06:50:33.013711 | Người quan sát ghi lại ALERT |
| ACK persisted | 06:50:34.941 | OPEN → ACKNOWLEDGED |
| Recovery persisted | 06:50:35.474 | 8,25 A CHARGING SYNTHETIC, đúng charger 01 |
| RESOLVED persisted | 06:50:36.213 | Điều kiện marker đạt, action ghi |
| Monitor OK history | 06:50:44 | Window fault count trở về 0 |

ICT=UTC+7. Bốn audit actions cuối: fault_injected, acknowledged, recovery_requested, resolved. Event recovery `b2-58a1983cae09-2-1` không có temperature. Direct Atlas audit trong evidence xác nhận 0 write mới cho charger 02–05 trong lần resumption.

Phép tính kiểm chứng: `06:50:33.013711 - 06:47:46.684 = 166.329711s` → **166,33 s cận trên quan sát**, gồm polling và ghi chú; không phải Datadog internal latency. `06:50:44 - 06:50:35.474 = 8.526s` → **xấp xỉ 8,53 s** dựa history precision giây. OK còn cách last pulse~64 s, phù hợp count expiry; không chứng minh recovery action trực tiếp sửa monitor hay hardware.

Log đối chiếu dùng `service:chargeguard-api env:dev @demo_id:58a1983cae09`; fault log 06:48:17.687 Z có incident/charger, resolved log 06:50:36.305 Z cùng ID. Incident giữ trạng thái riêng với monitor, operator phải kiểm tra cả hai.

**Chứng minh:** application pipeline thật, persistence/audit và US1 signals tương quan cho synthetic scenario; state guards/idempotent recovery có test. **Không chứng minh:** EVSE vật lý, hardware repair, notification delivery cho bên thứ ba, lossless monitoring, scalability hoặc SLA detection.

## 8. Tự mở Datadog mà không bịa trạng thái

1. Owner tự đăng nhập [US1](https://app.datadoghq.com/), không đưa key/mật khẩu vào chat hay slide.
2. Mở [Metrics Summary](https://app.datadoghq.com/metric/summary), tìm `chargeguard.*`. Đặt khoảng thời gian đúng; chưa có traffic mới thì không gọi series cũ là live.
3. Mở dashboard, kiểm tra filter service/env và nhãn synthetic. Dòng current/gauge không đủ kết luận online.
4. Mở monitor 334137944, xem status **và history**, đối chiếu timezone;334137536 là rule khác.
5. Mở [Logs Explorer](https://app.datadoghq.com/logs), dùng query ID trên với ngày 19/10 tương ứng; kiểm tra parsed fields và timeline action. Retention có thể hết: không thấy log hôm nay không phủ định capture cũ cũng không xác nhận account hiện còn hoạt động.
6. Đối chiếu UI incident/evidence; không click fault/reset để học. Nếu mất quyền/trial, dùng dated evidence và nói rõ không verify live.

Ảnh Datadog gốc có account/host labels; chưa tự động được phép public. Không chụp historical ACN trace khi chưa grant. Câu ngắn cho giám khảo: “Monitor đếm sự kiện, còn incident lưu quy trình; em kiểm chứng hai lớp riêng và không đồng nhất OK với an toàn vật lý.”
