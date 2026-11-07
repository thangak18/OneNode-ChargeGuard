# 05 — Dữ liệu thật, dữ liệu suy ra và dữ liệu mô phỏng

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

## 1. Ai thu dữ liệu? Mình thực sự đang có gì?

[ACN-Data chính thức](https://ev.caltech.edu/dataset.html) phục vụ nghiên cứu dữ liệu phiên sạc EV, từ hệ thống Adaptive Charging Networks và hợp tác với PowerFlex. Nhóm Caltech/ACN công bố dataset; bài giới thiệu thường được trích là Lee, Li, Low, e-Energy 2019. Đây là nguồn nghiên cứu, không phải cảm biến do OneNode sở hữu.

ChargeGuard đang dùng **static export khác** trên [ACN-Data-Static](https://github.com/tongxin-li/ACN-Data-Static), pin revision `abb7cf15cc7108913e965d4375cc7270d532b65f`. Theo acquisition record, năm gzip CSV lấy từ danh sách đầu của thư mục Caltech California_Garage_01, là convenience sample; không random hay đại diện fleet. Exact immutable URLs, tên nguồn/hash từng file nằm trong manifest ignored, không sao chép vào tài liệu học. Chưa tải official session JSON để xác minh stationID mapping.

**VERIFIED BY TESTS / EVIDENCE:** [docs/evidence/historical-local-audit.json:1](../../docs/evidence/historical-local-audit.json#L1); nguồn acquisition [docs/DATA_PROVENANCE.md:12](../../docs/DATA_PROVENANCE.md#L12). Thống kê recheck ở task trước; task này đọc evidence và fixture, không redistribute source records.

| Alias local | Dòng gốc | Điểm được chọn >=60 s | SHA-256 |
| --- | ---: | ---: | --- |
| sample_01 | 2807 | 172 | Khớp inventory |
| sample_02 | 3493 | 215 | Khớp inventory |
| sample_03 | 1078 | 68 | Khớp inventory |
| sample_04 | 2782 | 172 | Khớp inventory |
| sample_05 | 10068 | 619 | Khớp inventory |
| Tổng | 20228 | 1246 | 5/5 khớp |

Hash khớp chứng minh byte không đổi so với inventory được ghi, không chứng nhận độ chính xác thiết bị, đại diện thống kê hoặc quyền sử dụng. Một exported filename prefix là một manh mối định danh, chưa độc lập xác minh physical EVSE. Năm phiên không bằng năm bộ sạc; local UI dùng một alias `local-evse-01`.

## 2. Bảy column thực tế và điều không được suy diễn

| Header CSV | Cách xử lý | Nhãn/caveat |
| --- | --- | --- |
| Cột đầu tên rỗng | Date.parse, cần timezone, thứ tự tăng | sourceEventAt gốc chuẩn hóa UTC; không tự sửa timezone |
| Charging Current (A) | finite non negative number nếu có | currentA MEASURED theo mô tả nguồn, không independently calibrated |
| Actual Pilot (A) | Tất cả 20.228 ô trống trong sample | Adapter hiện không map pilot dù header tồn tại |
| Voltage (V) | Tất cả trống | Không tạo voltage |
| Charging State | Chuỗi export | sourceChargingState SOURCE_REPORTED, không tự coi fault truth |
| Energy Delivered (kWh) | Bộ đếm numeric có thể 0/reset | sourceEnergyKWh SOURCE_REPORTED, không total phiên đã validate |
| Power (kW) | Tất cả trống | Không tạo power |

Temperature/fault/incident không có column. Source-state gồm READY/ADAPTIVE/NOT CHARGING/IDLE/UNPLUGGED, không trùng schema app. Adapter tạo app `chargingState=current>0.5 ? CHARGING : NOT_CHARGING`, nhãn DERIVED và assumptions. Không suy ra phần cứng FAULT từ current 0.

[Official portal](https://ev.caltech.edu/dataset.html) có cảnh báo export web cũ xử lý timezone sai trước 10/10/2019. Explicit offset giúp parse được instant, chưa chứng minh export gốc không từng bị offset lỗi. ChargeGuard giữ time như nguồn cung cấp, không tự cộng/trừ 7–8 h thiếu chứng cứ.

## 3. Parser gzip và sampling từng bước

Nguồn: [apps/api/src/adapters/acn.adapter.ts:61](../../apps/api/src/adapters/acn.adapter.ts#L61). `createReadStream` đọc bytes; `createGunzip` giải nén; `readline` đọc từng dòng; `csvFields` hỗ trợ dấu phẩy trong quoted field và escaped double quote trên một dòng. Đây không phải parser CSV đa dòng RFC đầy đủ.

Header được kiểm tra required columns/duplicate; row có đúng số cell, max 100.000; timestamp finite/có zone/tăng nghiêm ngặt; current/energy numeric không âm. Parser kiểm tra timestamp/current/energy cả ở row sau đó bị skip. State chỉ đọc ở emitted row; unused columns không parse. Corrupt gzip fail; finally đóng/destroy stream. Đừng nói mọi cell đều được đầy đủ domain validation.

Downsampling ở đây là **chọn điểm thưa**, không averaging: giữ điểm đầu, sau đó chỉ giữ row nếu cách **điểm đã phát trước đó** ít nhất minIntervalSeconds. Với source gaps không đều, không tạo lưới cố định 60 s, không nội suy và có thể bỏ terminal row. Selected counts 172+215+68+172+619=1246; không được tính giản lược 20228/15 vì spacing không hoàn toàn 4 s.

Min Interval 60; maxEvents 1000 mỗi file. Local reader kiểm tra rowsParsed bằng inventory sau khi iterator xong, nên nếu giới hạn cắt session và chưa parse đủ thì fail closed, không nhận preview giả là đầy đủ. File cap 2 MB compressed không là absolute bound RAM decompress; row limit và maxevents hạn chế phần nào, không thay parser hardened cho input không tin cậy.

## 4. Theo một record an toàn bằng fixture tổng hợp

Dùng record **được tạo trong test**, không record hạn chế của ACN: [apps/api/test/replay.test.ts:11](../../apps/api/test/replay.test.ts#L11). Source fixture có current 10 ở 00:00:00, current 11 ở 00:00:10, current 0 ở 00:01:10, current 4 ở 00:02:10 ngày 01/01/2026.

Options: anchor 18/10/2026 05:00:00 Z, speed 60, min Interval 60, maxEvents 3. Point 11 A ở 10 giây bị skip; output currents 10/0/4. Với điểm 0 A:

- sourceEventAt=`2026-01-01T00:01:10.000Z`.
- elapsed source=70.000 ms; mapped delta=floor(70000/60)=1166 ms.
- `ts=2026-10-18T05:00:01.166Z`; local-reader response đổi tên ts thành `replayAt`.
- currentA=0 MEASURED theo quy tắc adapter; sourceChargingState=UNPLUGGED SOURCE_REPORTED; sourceEnergyKWh=0 SOURCE_REPORTED.
- app state=NOT_CHARGING DERIVED với assumptions; energy decrease flag được giữ.
- Không voltage/power/temperature/faultCode. Fixture được tạo nhân tạo để kiểm thử transform; nhãn MEASURED ở output là hành vi adapter, không chứng minh fixture là quan sát thật.

ID: sessionId hash từ sessionLabel; eventId hash từ sessionId+normalized source instant. Local reader dùng revision+content SHA làm label ổn định. CLI nếu không truyền label dùng base name làm input hash: không được nói mọi đường replay đều content-addressed giống nhau. Thay speed giữ ID/source time nhưng đổi mapped time; nếu đã persist rồi retry khác mapped time với cùng ID sẽ conflict fingerprint.

## 5. Provenance có hai tầng

`provenance.sourceType`: nguồn tổng thể ACN_REPLAY, DERIVED hoặc SYNTHETIC. `provenance.fields`: mỗi field MEASURED/SOURCE_REPORTED/DERIVED/SYNTHETIC. `assumptions`: giải thích phép suy ra. `datasetVersion`, `transformVersion`, pseudonymous sessionId giúp trace phương pháp. Nhãn không tự xác thực chữ ký thiết bị hoặc pháp lý; client có key vẫn có thể gửi nhãn sai.

UI Historical hiển thị riêng nguồn current, exported state/energy và derived state. `sourceEventAt`/chartX dùng thời gian ghi gốc; anchor local cố định 19/10/2026 00:00 Z + elapsed/speed cho replay clock. Playback chỉ di chuyển cursor phía browser, không ingests. Timer background có thể chậm.

## 6. Energy và gap

Full source có 6 lần giảm counter (1/1/1/1/2), final counter 0 cả 5 file. Không thể lấy dòng cuối hoặc max tự nhận session total. Adapter phát `ENERGY_COUNTER_DECREASE` ở emitted point sau khi đã thấy decrease; nếu reset ở cuối bị skip và không còn point emit, flag không xuất hiện trong preview. Không phải mọi reset có một point biểu diễn.

132 gap>10 s, max 69 s, median 4 s; không duplicate/backward timestamps trong inventory audit. Chart nối selected points không tạo lại measurement thiếu. Không báo forecast, batterySoC, power 3 phase hay fault thật từ dữ liệu này.

## 7. Tách đường local khỏi quyền cloud

Nguồn: [apps/api/src/adapters/local-history.ts:10](../../apps/api/src/adapters/local-history.ts#L10), [apps/web/src/lib/historical-policy.mts:2](../../apps/web/src/lib/historical-policy.mts#L2), [apps/api/src/adapters/acn-permission.ts:6](../../apps/api/src/adapters/acn-permission.ts#L6).

Local route yêu cầu opt-in/development/loopback/same-origin; production 403; alias chỉ 5 file, speed bounded; real path phải trong rawdir, hash/size/revision/rows khớp. Không import Nest bootstrap, MongoDB hay logger. Responses private/no-store. Rawfile excluded khỏi deployment tracing. Đây là engineering boundary, không grant license.

Cloud CLI dry-run mặc định. `--execute` phải có fixed start time và ignored owner attestation covering revision/evidence/scopes Atlas+Datadog/hashes trước load env/send fetch. Attestation không có chữ ký dataset owner; không được tự tạo để bỏ qua permission. Gate chỉ nằm trong CLI, **không** là global legal firewall: generic ingestion schema vẫn chấp nhận ACN_REPLAY nếu client có key; operator phải giữ policy.

| Việc dùng | Trạng thái quyền | Cần làm |
| --- | --- | --- |
| Phân tích local riêng | Mục đích nghiên cứu phù hợp ý định, basis exact export/registration chưa độc lập xác nhận | Owner lưu applicable terms/access basis; không coi task authorization là grant dataset |
| Atlas storage/processing | Chưa xác nhận | Grant có provider/field/retention/copies |
| Datadog metrics/logs | Chưa xác nhận, kể cả số suy ra | Grant cho third-party processing và minimization |
| Public chart/video/slides/judge screen-share | Chưa xác nhận | Grant hiển thị/derivative/attribution/privacy; BTC có thể showcase |
| Redistribute raw/downsampled/file fixture | Chưa xác nhận | Grant redistribution rõ, không đưa lên Git dù private |

[Registration chính thức](https://ev.caltech.edu/register) giới hạn education/research; đó không tự bao phủ mọi use hackathon. Xem [matrix đầy đủ](../HISTORICAL_LOCAL_MODE.md), [inquiry chưa gửi](../DATASET_PERMISSION_INQUIRY.md). Additional filename metadata có 8 prefix trong 229 file ở LIGO_01 là pool ứng viên, chưa tải thêm hoặc xác minh 8 physicaldevices.

## 8. Synthetic Operations hoạt động ra sao?

Seed upsert 1 virtual station/5 charger, ratings 55 kWstation/11 kWcharger là cấu hình giả lập, không measurements. `demoReading()` tạo current 8,25 bình thường hoặc 0 khi fault; state CHARGING/FAULT và `SIMULATED_DEMO_FAULT`. `SIM_OVERHEAT` chỉ thêm temperature 72 C giả lập. SIM_POWER_LOSS/SIM_HARDWARE_FAULT không mô phỏng physics hay cơ chế lỗi riêng sâu; cùng stimulus 0 A/FAULT, khác scenario/evidence label.

Trigger tạo 5 event; recover tạo **1 event** cho charger incident với stable timestamp,8,25 A/CHARGING và không temperature. Không reset sensor đã thiếu thành 0. Telemetry được append; asset configuredstatus không được mutate theo reading. Runtime current state ở UI tùy nguồn/aggregation (xem chương 06), còn Datadog cập nhật gauge.

Nguồn: [apps/api/scripts/seed-virtual.ts:1](../../apps/api/scripts/seed-virtual.ts#L1), [apps/api/src/observability/demo-scenario.ts:1](../../apps/api/src/observability/demo-scenario.ts#L1), [apps/api/src/demo/demo.service.ts:115](../../apps/api/src/demo/demo.service.ts#L115).

## 9. Bảng tránh nhầm khi thuyết trình

| Thuộc tính | Historical Local | Synthetic Operations |
| --- | --- | --- |
| Nguồn | Export phiên sạc quá khứ | Hàm generated demoReading |
| Identity | 5 session/1 prefix; physical chưa validate | 5 virtual charger định nghĩa ứng dụng |
| Current | Source-described measured lịch sử | 8,25 A/0 A generated |
| State | Source-reported + derived heuristic riêng | SYNTHETIC CHARGING/FAULT |
| Temperature/fault | Không có |72 C minh họa / faultcode giả lập |
| Thời gian | source UTC + mapped clock | Eventtime lúc chạy / recovery reserved |
| Persistence/sink | File ignored → local reader → browser | Atlas + Agent → US1 |
| Incident | Không tạo/control | Manual simulation lifecycle với audit |
| Public display | Chờ grant | Có thể trình bày synthetic với privacy review |

Giám khảo: “Em dùng dữ liệu lịch sử để chứng minh đọc đúng nguồn và giới hạn, dùng synthetic để kiểm thử vận hành. Không dùng dữ liệu thật làm nhãn trang trí cho một kịch bản lỗi do phần mềm tạo.”
