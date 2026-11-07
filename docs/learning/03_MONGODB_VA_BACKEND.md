# 03 — MongoDB và backend từ document đến incident

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

## 1. Cơ sở trước khi đọc service

MongoDB lưu **document**: một đối tượng có field lồng nhau. **Collection** chứa các document cùng mục đích. Không nên hiểu “schema linh hoạt” thành không có schema: ChargeGuard kiểm tra input bằng Zod trước khi ghi.

JSON dùng trên HTTP biểu diễn object/array/string/number/boolean/null. BSON là định dạng nhị phân của MongoDB, có kiểu Date và các kiểu số/ID riêng. `ts` trên request là chuỗi ISO có timezone; trước insert code đổi thành `Date`. JSON response qua HTTP lại biểu diễn Date thành chuỗi. Vì vậy MongoDB có thể lọc/sort ngày bằng kiểu ngày, thay vì dựa chuỗi tùy định dạng.

Atlas là nơi chạy MongoDB managed; official Node.js driver là thư viện để API nói chuyện với DB. Không dùng Mongoose trong backend này. `DatabaseService` mở một MongoClient lúc module init, connect và ping, dùng lại connection, đóng khi shutdown. Startup không tự initialize schema hoặc seed: hai việc đó nằm trong script riêng.

**VERIFIED IN SOURCE CODE:** [apps/api/src/database/database.service.ts:12](../../apps/api/src/database/database.service.ts#L12), [apps/api/src/telemetry/telemetry.service.ts:62](../../apps/api/src/telemetry/telemetry.service.ts#L62), [apps/api/scripts/init-db.ts:1](../../apps/api/scripts/init-db.ts#L1). Cơ sở Time Series xem [MongoDB 8.0](https://www.mongodb.com/docs/v8.0/core/timeseries-collections/); tài liệu ngoài không phải bằng chứng version Atlas hiện tại.

## 2. NestJS đọc từ ngoài vào trong

Controller khai báo method/path và nhận JSON; guard kiểm tra quyền gọi; service giữ luật nghiệp vụ; DatabaseService cung cấp collection; filter chuẩn hóa lỗi. Dependency injection nghĩa là Nest cấp các dependency cho constructor, giúp test thay DB/observability bằng fixture mà không đổi service.

`main()` đọc root env kín, validate config rồi bind `127.0.0.1`. `configureApplication()` đặt prefix `api` + URI version `v1`, middleware đo ingestion, filter lỗi và Swagger `/docs` (`/docs-json`). CORS hiện `origin:true, credentials:true`: khá rộng, không được coi là production access control. Không có global Validation Pipe; schema telemetry/query được parse trong service, demo/body khác được kiểm tra thủ công. Đừng gọi mọi input là “đều có DTO Zod strict”.

Nguồn: [apps/api/src/main.ts:4](../../apps/api/src/main.ts#L4), [apps/api/src/bootstrap.ts:13](../../apps/api/src/bootstrap.ts#L13), [apps/api/src/telemetry/ingest.guard.ts:9](../../apps/api/src/telemetry/ingest.guard.ts#L9), [apps/api/src/common/http-exception.filter.ts:5](../../apps/api/src/common/http-exception.filter.ts#L5).

## 3. Sáu collection thực sự được initializer quản lý

Bảng này là **VERIFIED IN SOURCE CODE** và được test bằng MongoDB local; không liệt kê lại Atlas trực tiếp trong task dạy học. `initializeCollections()` tạo khi thiếu, kiểm tra timeField/metaField nếu telemetry đã có, rồi tạo các index được chỉ định. Nó không là migration engine đầy đủ và không xác nhận lại mọi TTL option của collection đã tồn tại.

| Collection | Mục đích / quan hệ | Read và write thực tế | Index do code yêu cầu |
| --- | --- | --- | --- |
| stations | Asset cấp trạm, `_id` string, name, capacityKW, location, dates | seed upsert `$setOnInsert`; find stations/asset lookup/summary | `_id` mặc định của collection thường |
| chargers | Asset ảo, stationId tham chiếu station, connectorId, ratedPowerKW, configured status | seed upsert; list/detail/lookup/activity | unique `stationId+connectorId`; `stationId+status` |
| telemetry | Measurements theo thời gian; meta tham chiếu asset bằng string | append insert; find history và aggregate | `meta.chargerId+ts desc`; `meta.stationId+ts desc`, không unique |
| ingestion_receipts | Chống ghi lại cùng event trong cửa sổ lưu | insert PENDING; lookup conflict; update COMMITTED | `_id` unique; TTL `createdAt` 604800 s |
| incidents | Trạng thái nghiệp vụ, references station/charger | create OPEN; conditional update ack/recover/resolve; reset demo riêng | `status+detectedAt desc`; `chargerId+detectedAt desc` |
| incident_actions | Timeline thao tác, incidentId tham chiếu incident | append insert, timeline find sort at | `incidentId+at asc`; `_id` unique cho action ID thường |

Không có foreign-key constraint DB tự kiểm tra quan hệ. TelemetryService kiểm tra station tồn tại và charger thuộc station trước ghi. Seed không tạo telemetry; charger status ban đầu AVAILABLE là cấu hình. Ingest/recover không update `chargers.status`, nên không được coi field đó là trạng thái sensor hiện tại.

Nguồn: [apps/api/src/database/initialize.ts:6](../../apps/api/src/database/initialize.ts#L6), [apps/api/scripts/seed-virtual.ts:4](../../apps/api/scripts/seed-virtual.ts#L4), [apps/api/src/chargers/chargers.service.ts:1](../../apps/api/src/chargers/chargers.service.ts#L1), [apps/api/src/incidents/incident-audit.ts:5](../../apps/api/src/incidents/incident-audit.ts#L5).

### Ví dụ document hoàn toàn tự tạo để học

Các literal dưới là **SYNTHETIC / minh họa cấu trúc**, không copy source ACN, không phải dump Atlas. `ISODate` là ký pháp giải thích BSON trong mongosh, không phải JSON request. Hash minh họa được viết bằng chú thích để tránh giả vờ là hash đã tính.

```javascript
// stations
const stationExample = {_id:"demo-station-01", name:"OneNode virtual station", capacityKW:55,
  location:{city:"Virtual demo"}, createdAt:ISODate("2026-10-19T08:00:00Z"), updatedAt:ISODate("2026-10-19T08:00:00Z")}
// chargers
const chargerExample = {_id:"demo-charger-01", stationId:"demo-station-01", connectorId:"virtual-1",
  ratedPowerKW:11, status:"AVAILABLE", statusUpdatedAt:ISODate("2026-10-19T08:00:00Z"),
  createdAt:ISODate("2026-10-19T08:00:00Z"), updatedAt:ISODate("2026-10-19T08:00:00Z")}
// telemetry — MongoDB sẽ thêm _id cho insert
const telemetryExample = {eventId:"lesson-event-1", ts:ISODate("2026-10-19T08:00:01Z"),
  meta:{stationId:"demo-station-01",chargerId:"demo-charger-01"},
  currentA:8.25, chargingState:"CHARGING", ingestedAt:ISODate("2026-10-19T08:00:02Z"),
  eventKey:"digest-minh-hoa-khong-phai-hash-thuc",
  provenance:{sourceType:"SYNTHETIC", fields:{currentA:"SYNTHETIC",chargingState:"SYNTHETIC"}}}
// ingestion_receipts
const receiptExample = {_id:"digest-minh-hoa-khong-phai-hash-thuc", eventId:"lesson-event-1",
  stationId:"demo-station-01",chargerId:"demo-charger-01", status:"COMMITTED",
  fingerprint:"fingerprint-minh-hoa",createdAt:ISODate("2026-10-19T08:00:02Z"),committedAt:ISODate("2026-10-19T08:00:02Z")}
// incidents — trạng thái cuối minh họa
const incidentExample = {_id:"demo-012345abcdef",stationId:"demo-station-01",chargerId:"demo-charger-01",
  scenario:"SIM_OVERHEAT",severity:"CRITICAL",status:"RESOLVED",synthetic:true,
  detectedAt:ISODate("2026-10-19T08:00:00Z"),acknowledgedAt:ISODate("2026-10-19T08:01:00Z"),
  recoveryEventAt:ISODate("2026-10-19T08:02:00Z"),recoveryTelemetryAt:ISODate("2026-10-19T08:02:00Z"),
  recoveryRequestedAt:ISODate("2026-10-19T08:02:00Z"),resolvedAt:ISODate("2026-10-19T08:03:00Z"),
  createdAt:ISODate("2026-10-19T08:00:00Z"),updatedAt:ISODate("2026-10-19T08:03:00Z"),
  evidence:[{type:"TELEMETRY_ANOMALY",detail:"Synthetic example",faultCode:"SIMULATED_DEMO_FAULT"}]}
// incident_actions
const actionExample = {_id:"demo-012345abcdef:acknowledged",incidentId:"demo-012345abcdef",
  actor:"local-demo-operator",action:"acknowledged",at:ISODate("2026-10-19T08:01:00Z"),synthetic:true}
```

Action đầu `fault_injected` và `baseline_reset` dùng insert không truyền stable `_id`; MongoDB cấp ID. Stable string ID trong `recordIncidentAction` áp dụng acknowledge/recovery_requested/resolved. Không được nói mọi action đều dùng cùng dedup scheme.

## 4. Time Series, index và TTL

Time series là chuỗi quan sát có thời gian. `timeField:'ts'` chỉ trường Date để DB tổ chức theo thời gian; `metaField:'meta'` chứa định danh tương đối ổn định. Đặt field biến động như current vào meta làm thay đổi nhóm không cần thiết. `granularity:'seconds'` là gợi ý tổ chức dữ liệu, **không** ép ứng dụng gửi mỗi giây hoặc làm tròn thời gian.

Index giống mục lục: `charger_time` hỗ trợ tìm một charger theo khoảng ngày và sort, `incident_queue` hỗ trợ status/queue, index timeline giúp đọc theo incident/at. Index có chi phí dung lượng và write. Có index không đồng nghĩa mọi query tối ưu; chưa có benchmark/explain phân tích ở task này.

TTL là thời hạn dữ liệu: telemetry đặt 604800 giây theo `ts`, receipt dùng index trên `createdAt`. Dữ liệu cũ có thể biến mất khiến demo trống, còn receipt có giới hạn horizon chống trùng. Cleanup là nền, không chính xác từng giây. Incident/action/asset không có TTL do initializer này tạo. Cần giữ evidence riêng khi telemetry hết retention. Xem [TTL MongoDB 8.0](https://www.mongodb.com/docs/v8.0/core/index-ttl/).

Giám khảo: “Em dùng Time Series cho append telemetry và collection thường cho trạng thái thay đổi/receipt. Unique receipt tách khỏi measurement nên không cần giả định Time Series có unique event index.”

## 5. Validation và idempotency đi từng bước

`telemetrySchema` strict: eventId/asset ID hợp regex; timestamp có timezone; ít nhất một telemetry field; số hữu hạn trong giới hạn schema; field nào có giá trị phải có provenance và ngược lại. DERIVED cần assumptions. Ts hơn hiện tại 5 phút bị từ chối; không có lower-bound thời gian cũ. Batch 1–100 events và validate cả payload trước persist. Giới hạn numeric là schema/demo, không phải tiêu chuẩn an toàn sạc.

**Idempotency** nghĩa là gửi lại cùng yêu cầu hợp lệ không tạo thêm kết quả nghiệp vụ. Ở đây:

1. `validate()` parse JSON rồi kiểm tra station/charger.
2. Tính `eventKey = SHA256(stationId + NUL + chargerId + NUL + eventId)`.
3. Canonicalize object bằng `stableJson` sort key đệ quy, hash payload thành fingerprint.
4. Insert receipt `_id=eventKey`, PENDING. Unique `_id` chọn request được quyền bắt đầu ghi.
5. Insert telemetry với BSON Date, eventKey, ingestedAt; update receipt COMMITTED.
6. Retry cùng key + fingerprint COMMITTED → `duplicate:true`; payload khác → 409.
7. Receipt PENDING: tìm measurement đã ghi theo eventKey/charger/ts. Nếu có, reconcile COMMITTED; nếu không, trả 409 chưa rõ/in progress, không insert mù lần nữa.
8. `obs.accepted()` chạy sau persistence; duplicate tăng counter riêng và không phát lại gauge/fault.

Ví dụ: retry `lesson-event-1` với current 8,25 và cùng timestamp là duplicate. Đổi current thành 9 hoặc đổi replay timestamp mà giữ ID là conflict, không phải update measurement.

**Giới hạn quan trọng:** receipt + telemetry không transaction; nếu crash trước measurement insert có thể để PENDING cần reconcile thủ công. Batch persist tuần tự, lỗi ở event sau không rollback event trước. Hai request đồng thời có thể nhận 409 rồi retry. Receipt hết TTL không bảo đảm chống trùng mãi mãi. Đừng dùng từ exactly-once vô điều kiện. Metrics UDP cũng không là accounting ledger.

Nguồn: [apps/api/src/telemetry/telemetry.service.ts:8](../../apps/api/src/telemetry/telemetry.service.ts#L8), [apps/api/src/telemetry/telemetry.service.ts:32](../../apps/api/src/telemetry/telemetry.service.ts#L32), [apps/api/test/api.integration.ts:67](../../apps/api/test/api.integration.ts#L67), [apps/api/test/api.integration.ts:88](../../apps/api/test/api.integration.ts#L88).

## 6. Aggregation Pipeline thực tế

Pipeline là danh sách bước DB thực hiện. `$match` lọc, `$group` gom, `$sort` sắp, `$project` chọn/đổi shape, `$limit` giới hạn output. Không phải mọi query đều dùng pipeline: history dùng `find`, incident detail dùng hai find riêng, không `$lookup` như bản schema đề xuất.

Nguồn mọi pipeline: [apps/api/src/analytics/analytics.service.ts:16](../../apps/api/src/analytics/analytics.service.ts#L16). Range mặc định từ 24 h trước `to`, `to` mặc định now+60 s; range dương tối đa 31 ngày. Limit mặc định 200 tối đa 500; bucket 1–60 phút, default 5; activity window 1–1440 phút default 15. Bound thời gian/output không tự bảo đảm bound số document bị scan.

### latest

`$match` range/asset → `$sort ts:-1` → `$group _id=meta.chargerId, reading=$first:$$ROOT` → `$replaceRoot reading` → `$project` bỏ `_id,eventKey` → `$limit`.

Nó lấy theo event-time, khác gauge Datadog cập nhật theo thứ tự xử lý. Hai event cùng ts chưa có secondary sort quyết định winner; limit sau group cũng không là pagination toàn bộ asset.

### currentAverages

Match thêm `currentA` có type number → group theo `$dateTrunc(ts, minute, binSize=bucketMinutes)` → `$avg currentA` và `$sum:1` → sort bucket tăng → limit → project `bucket,averageCurrentA,samples`.

Ví dụ tổng hợp tự tạo: ba điểm 6, 12, 0 A cùng bucket tạo average 6 A, samples 3; điểm thiếu current bị loại. Đây là trung bình **theo số mẫu**, không time-weighted average khi khoảng cách không đều. Endpoint này tồn tại ở API nhưng BFF hiện không allowlist nó, và Overview không gọi nó.

### states

Match field chargingState tồn tại → group theo state và đếm mẫu → sort count giảm → project state/count. Mười mẫu CHARGING và một FAULT không có nghĩa 10/11 thời gian đang sạc; chỉ là tỷ lệ event.

### activity

Tìm danh sách charger (tối đa 500) → match telemetry trong giao của range và window → group charger, `$max ts` → ghép Map trong Node. `telemetryActive` là có tín hiệu gần đây, không bảo đảm phần cứng online. Query chargerId không lọc danh sách inventory tương ứng, nên đừng trình bày như filter asset hoàn chỉ n h.

### stationSummary → Overview

Tìm station → match telemetry trong range → group charger với sampleCount/avgCurrentA/maxTs → sort ID → limit 500 → tìm inventory station → ghép Map. Không có `$lookup`. Ví dụ tự tạo: charger 01 có 6 và 12 A, charger 02 có 0 A. Response lần lượt mean 9, mean 0, total sampleCount 3. Overview kiểm tra maxTs mới <=60 s và cộng **các mean của cửa sổ**, không cộng tức thời các measurement mới nhất. Nếu fresh, bar 01=9/bar 02=0; derived power minh họa 240×9/1000=2,16 kW. Không được gọi đây là power đo được hoặc current tức thời chuẩn.

Nguồn UI: [apps/web/src/app/page.tsx:94](../../apps/web/src/app/page.tsx#L94). Tiêu đề “Live Current” không thay đổi semantics mean mặc định 24 h. Đây là hạn chế cần nói thật, không sửa code trong task này.

## 7. Bản đồ API đang có

Tất cả route Nest dưới `/api/v1`; GET thường 200, POST mặc định Nest 201, kể cả duplicate. GET không có IngestGuard. POST có key; thiếu/sai 401. BFF không mở ingestion hoặc mọi analytics cho browser. Request sau là shape minh họa, không lệnh mutation để chạy lúc học.

| Method / route suffix | Input | Output và tương tác | Kiểm tra / lỗi chính |
| --- | --- | --- | --- |
| GET health/live | không | `status:ok` | Chỉ process handler, không ping DB |
| GET health/ready | không | `status:ready,database:connected` | ping DB, lỗi 503; không audit quyền |
| POST telemetry | event schema bên trên | `eventId,duplicate`; receipt/measurement, metric/log | Zod 400, asset 404, conflict 409, DB 503 |
| POST telemetry/batch | `events:[event]` 1–100 | `items:[eventId,duplicate]`; tuần tự | Schema 400 trước write, runtime có partial success |
| GET telemetry/history | chargerId + from/to bắt buộc, optional stationId/limit | array measurements ts tăng, bỏ `_id,eventKey` | Query 400; DB 503; trả **đầu** range, không tail latest |
| GET analytics/latest | optional range/asset/limit | latest từng charger | Query 400, DB 503 |
| GET analytics/current-averages | chargerId bắt buộc, range/bucketMinutes/limit | bucket/averageCurrentA/samples | Không qua BFF hiện tại |
| GET analytics/states | range/asset | state/count event | Không đo thời gian trong state |
| GET analytics/activity | range/station/windowMinutes | active/inactive/items, lastSeenAt | Không có monitor heartbeat |
| GET analytics/stations/: stationId/summary | stationId, optional range | station/window/chargers/sampleCount | station 404; summary mean |
| GET stations | không | array asset station | Read không auth |
| GET chargers | không | projections ID/station/connector/status/ratedPowerKW | Không pagination/cap ở service này |
| GET chargers/: id | ID string | document asset hoặc 404 | Không đồng nghĩa telemetry latest |
| GET incidents | status?/chargerId?/limit? | array sort detectedAt desc | Runtime query limit chưa coerce/validate chặt; có thể lỗi 500 |
| GET incidents/: id | ID | incident + actions sort at | 404 nếu không tồn tại |
| POST incidents/: id/acknowledge | actor optional | incident ACKNOWLEDGED + stable action | validate label/id 400; missing 404; state 409 |
| POST demo/recover | incidentId dạng demo +12 hex | incidentId/status/recoveredAt/message/incident; 1 recovery reading | scope 404, state 409, ingestion failure 503 hoặc filter 500 |
| POST incidents/: id/resolve | actor optional | incident RESOLVED + stable action | cần marker recovery; không hỏi Datadog;409 nếu chưa đủ |
| POST demo/trigger-fault | chargerIndex 1–5, scenario trong 3 lựa chọn | incident metadata; tạo incident/action +5 readings | input 400; active trả duplicate incident cũ |
| POST demo/reset | không cần body | success/message/run | scope synthetic 5 charger, đóng active +5 baseline; không xóa data |

Controller nguồn: [apps/api/src/telemetry/telemetry.controller.ts:1](../../apps/api/src/telemetry/telemetry.controller.ts#L1), [apps/api/src/analytics/analytics.controller.ts:1](../../apps/api/src/analytics/analytics.controller.ts#L1), [apps/api/src/chargers/chargers.controller.ts:1](../../apps/api/src/chargers/chargers.controller.ts#L1), [apps/api/src/incidents/incidents.controller.ts:1](../../apps/api/src/incidents/incidents.controller.ts#L1), [apps/api/src/demo/demo.controller.ts:1](../../apps/api/src/demo/demo.controller.ts#L1).

Error filter trả `statusCode,error,message,fields?path,timestamp`; lỗi không phải HttpException trở thành 500 với message generic. Không phải mọi DB error đều được đổi 503 ở từng service. Read incident query có TypeScript annotation không tự validate HTTP string — một ví dụ vì sao compile types không thay runtime schema.

## 8. Theo một lần click Inject Synthetic Fault

`DemoPage.handleTriggerFault` → `api.triggerFault` JSON → BFF `proxy`/`validateMutationBody` → `IngestGuard` → `DemoController.triggerFault` → `DemoService.triggerFault` → Mongo `incidents.insertOne`/`incident_actions.insertOne` → `demoReading` ×5 → `TelemetryService.ingestBatch` → validate/persist từng event → `ObservabilityService.accepted` → gauge current, sáu state gauge, fault counter/log cho fault → flush local socket →201 response.

**Điểm dễ nhầm:** vì đây là HTTP `/demo/trigger-fault`, không phải `/telemetry/batch`, middleware request ingestion **không** đếm một ingestion.success cho call đó; service nội bộ vẫn phát accepted/current/fault. Một request POST trực tiếp telemetry sẽ có cả request metric và accepted metric.

Nguồn bắt đầu: [apps/web/src/app/demo/page.tsx:52](../../apps/web/src/app/demo/page.tsx#L52); điểm DB/metric: [apps/api/src/demo/demo.service.ts:21](../../apps/api/src/demo/demo.service.ts#L21), [apps/api/src/observability/ingestion.middleware.ts:8](../../apps/api/src/observability/ingestion.middleware.ts#L8).

`triggerFault` tìm active trên cả nhóm 5, nên chọn charger 02 khi charger 01 có active sẽ trả incident charger 01. Check-before-insert không unique active-lock: tránh double-click tuần tự nhưng **không chứng minh chống race hai trigger đồng thời**. Incident/action/telemetry có thể partial failure. Đây là giới hạn MVP, không bug đã sửa trong task tài liệu.

## 9. Quyền và khả năng mở rộng

`verify-atlas.ts` kiểm tra identity/role mong đợi, privileges chỉ DB chargeguard, collection/index tồn tại. Evidence trước ghi scoped user; task này không connect Atlas/re-audit quyền. Role intention là readWrite trên một DB, không atlasAdmin/readWriteAnyDatabase; env không in ra. Ingest key dùng hash + timingSafeEqual để so sánh, nhưng chỉ là machine shared secret, không user authorization.

Bottleneck có thể gồm write tuần tự, asset lookup mỗi event, receipt write thêm, group/sort range lớn, polling mọi client, file log sync và M 0/network. Đây là **ENGINEERING INFERENCE**, chưa có đo tải/RPS/P95 end-to-end. Production cần benchmark, giới hạn inbound, identity/RBAC, queue/outbox/reconciliation và migration có kiểm chứng. Không hứa một con số throughput.
