# ChargeGuard — Kịch bản quay video demo cho Ban Giám Khảo

> **Bản 07/11/2026** — dùng giao diện mới (Overview có thanh trạng thái, Incident Drill dạng stepper, đăng nhập Operator bằng email/mật khẩu).
> Thay thế [FINAL_DEMO_VIDEO_SCRIPT.md](FINAL_DEMO_VIDEO_SCRIPT.md) (bản 23/10 dựa trên GitHub OAuth + production read-only).
> **Độ dài mục tiêu: ~6 phút.** Thể lệ không quy định độ dài; nếu cần cắt, bỏ Cảnh 4 và Cảnh 10 trước.

**Thông điệp xuyên suốt:** mỗi thao tác trên web đều để lại dấu vết kiểm chứng được ở **hai nơi độc lập**:
**MongoDB Atlas** (dữ liệu & audit trail — "chuyện gì đã xảy ra") và **Datadog US1** (metric, log, monitor — "hệ thống phát hiện ra sao").

```
Web (Next.js :3000) ──BFF──► NestJS API (:3001) ──► MongoDB Atlas (telemetry time-series, incidents, incident_actions)
                                     │
                                     └─ DogStatsD UDP + JSON log ─► Datadog Agent (máy local) ─► Datadog US1 (env:dev)
```

---

## PHẦN A — BẮT BUỘC làm trước khi quay (≈15 phút)

### A1. ⚠️ Kết nối Atlas thật (hiện đang KHÔNG kết nối)

Kiểm tra ngày 07/11 lúc 17:30 cho thấy API đang chạy **MongoDB in-memory dự phòng**, không ghi gì lên Atlas. Kết nối Atlas trả lỗi `tlsv1 alert internal error` — dấu hiệu điển hình là **IP hiện tại chưa có trong Network Access**.

1. Atlas → Project → **Security → Network Access → + Add IP Address → Add Current IP Address** → Confirm. Chờ trạng thái **Active** (~1 phút).
   *Chỉ thêm IP hiện tại; không mở `0.0.0.0/0`.*
2. Dừng API đang chạy (Ctrl+C ở terminal API) rồi chạy lại:
   ```bash
   export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
   npm --prefix apps/api run dev:local
   ```
3. **Đọc log terminal — đây là cách kiểm tra duy nhất đáng tin cậy:**
   - ✅ Đúng: `Connected successfully to MongoDB Atlas.` và `Synthetic telemetry ticker: every 8 s → MongoDB Atlas.`
   - ❌ Sai: khung `!!!! RUNNING ON IN-MEMORY MONGODB — NOTHING IS WRITTEN TO ATLAS` → quay lại bước 1.
   > Không dùng `/api/v1/health/ready` để kiểm tra: ở chế độ in-memory endpoint này luôn trả `connected`.
4. Web (nếu chưa chạy): `npm --prefix apps/web run dev` → mở `http://127.0.0.1:3000`.

### A2. Kiểm tra Datadog còn dùng được

1. Đăng nhập **https://app.datadoghq.com** (US1). Ngày 19/10 trial còn 14 ngày → **có thể đã hết hạn**. Nếu bị chặn/yêu cầu nâng cấp: dừng lại, xử lý tài khoản trước (không có Datadog thì mất nửa bằng chứng).
2. Agent đang gửi được: `sudo datadog-agent status` → mục **DogStatsD** có *Metric Packets* > 0, mục **Logs Agent** thấy file `/usr/local/var/log/chargeguard/api.jsonl`.
3. Các đối tượng cần có sẵn (đã tạo từ 19/10):
   - Dashboard **ChargeGuard Operations Dashboard** (file gốc: `config/datadog/chargeguard-operations.dashboard.json`).
   - Monitor **334137944** — *ChargeGuard — Explicit synthetic fault events* (`sum(last_1m):sum:chargeguard.fault.simulated{service:chargeguard-api,env:dev}.as_count() >= 1`).
   - Monitor **334137536** — *ChargeGuard — Demo ingestion errors* (phải luôn **OK** trong video).

### A3. Đưa hệ thống về trạng thái sạch

1. Mở `http://127.0.0.1:3000/login` → đăng nhập `operator@chargeguard.com` / `admin`.
2. Vào **Incident Drill** → bấm **Reset to baseline** (đóng mọi incident đang mở).
3. **Đăng xuất** (sidebar → *Sign out*) để video bắt đầu ở chế độ **Guest**.
4. Chờ ~2 phút để monitor 334137944 về **OK**.

### A4. Chuẩn bị sẵn các tab (theo đúng thứ tự)

| Tab | Mở sẵn | Thiết lập |
|---|---|---|
| **T1 – Web** | `http://127.0.0.1:3000/` | Zoom trình duyệt 110–125% cho dễ đọc. |
| **T2 – DD Dashboard** | `https://app.datadoghq.com/dashboard/875-kis-zg2` (*ChargeGuard Operations Dashboard*) | Time range **Past 15 Minutes**, bật **Live**. |
| **T3 – DD Monitor** | `https://app.datadoghq.com/monitors/334137944` | Để thấy ô **Status** và biểu đồ *Status history*. |
| **T4 – DD Logs** | `https://app.datadoghq.com/logs` | Query: `service:chargeguard-api env:dev` · Live Tail tắt · Past 15 Minutes. |
| **T5 – Atlas `incidents`** | Atlas → Cluster → **Browse Collections** → `chargeguard` → `incidents` | Sort `{ detectedAt: -1 }`. |
| **T6 – Atlas `incident_actions`** | cùng DB → `incident_actions` | Sort `{ at: -1 }`. |
| **T7 – Atlas `telemetry`** | cùng DB → `telemetry` *(nhãn TIME SERIES)* | Filter `{ "meta.chargerId": "demo-charger-03" }` · Sort `{ ts: -1 }`. |

**Riêng tư (bắt buộc):** không quay trang Network Access, Database Access, Connection string, API keys; che/crop email, tên org, hostname trên Datadog & Atlas; không mở file `.env`. Toàn bộ dữ liệu trong video là **SYNTHETIC** (không có dữ liệu cá nhân, không có ACN raw).

### A5. Diễn tập 1 lần không quay

Chạy nhanh Cảnh 6 → 9, ghi nhận thời gian monitor chuyển ALERT trên máy bạn, rồi **Reset to baseline** + đăng xuất + chờ monitor OK lại trước khi quay thật.

---

## PHẦN B — Kịch bản từng cảnh

Quy ước: **🖱 Thao tác** · **👀 Phải thấy** · **🎙 Lời dẫn** (đọc gần nguyên văn) · **🧾 Minh chứng**.
`<ID>` = mã incident dạng `demo-xxxxxxxxxxxx`; `<RUN>` = 12 ký tự sau `demo-`.

---

### Cảnh 1 — Mở đầu (0:00 – 0:25) · T1

🖱 Đứng ở trang Overview (đang là Guest).
🎙 *"Xin chào Ban Giám khảo, em là [tên], đội OneNode. Khi vận hành nhiều trụ sạc xe điện, người vận hành cần ba thứ: phát hiện sự cố nhanh, điều tra được nguyên nhân, và có bằng chứng rằng sự cố đã được xử lý. ChargeGuard giải bài toán Detect → Investigate → Resolve bằng MongoDB Atlas và Datadog. Trong video, mỗi thao tác trên web em sẽ đối chiếu ngay với dữ liệu trong Atlas và tín hiệu trong Datadog. Lưu ý: toàn bộ trạm sạc và sự cố là mô phỏng, chưa kết nối phần cứng thật."*

---

### Cảnh 2 — Tổng quan vận hành ở chế độ Guest (0:25 – 1:05) · T1

🖱 Chỉ chuột lần lượt: thanh xanh **All systems nominal** → 4 thẻ KPI → biểu đồ cột → 5 thẻ connector → chip **GUEST · READ-ONLY** ở sidebar. Bấm pill **SYNTHETIC TELEMETRY** để mở popover nguồn dữ liệu, rồi đóng.
👀 *All systems nominal · 5/5 connectors reporting · 5 charging*; Data Freshness **FRESH**; Total Current ≈ **41.3 A** (≈ 9.90 kW); mỗi connector **8.3 A ≈ 2.0 kW**, badge **CHARGING**, "x s ago".
🎙 *"Đây là màn hình tổng quan cho 5 cổng sạc ảo, tự làm mới mỗi 6 giây. Dòng trên cùng trả lời ngay câu hỏi 'hệ thống có ổn không'. Bốn chỉ số: độ tươi dữ liệu, tổng dòng điện, số cổng đang sạc và số mẫu đã lưu trong MongoDB. Công suất kW là giá trị ước tính ở 240 V và được ghi rõ là DERIVED. Mọi dữ liệu được dán nhãn nguồn gốc: SYNTHETIC, DERIVED hay ACN replay. Hiện em đang ở chế độ khách — chỉ xem, không thao tác được."*

---

### Cảnh 3 — Dữ liệu là thật: Atlas + Datadog đang nhận telemetry (1:05 – 1:50) · T7 → T2

🖱 **T7 (Atlas telemetry)** → bấm **Apply/Refresh** → mở 1 document mới nhất.
👀 Nhãn **TIME SERIES** cạnh tên collection; document mới nhất có `ts` vài giây trước, `meta: { stationId: "demo-station-01", chargerId: "demo-charger-03" }`, `currentA: 8.25`, `chargingState: "CHARGING"`, `provenance.sourceType: "SYNTHETIC"`.
🎙 *"Telemetry được lưu trong collection Time Series của MongoDB Atlas: trường thời gian `ts`, metadata là trạm và trụ sạc, TTL 7 ngày để tự dọn dữ liệu cũ. Bản ghi mới nhất vừa được ghi cách đây vài giây."*

🖱 **T2 (Datadog dashboard)** → chỉ widget *Charging current (A) by virtual charger* và *Ingestion requests*.
👀 5 đường ngang ≈ 8.25 A; cột *success* đều, *failure* = 0.
🎙 *"Cùng lúc, API đẩy metric qua Datadog Agent lên Datadog US1: dòng điện từng trụ, số request ingest thành công/thất bại và độ trễ xử lý. Tag chỉ gồm service, env và 5 mã trụ đã cho phép — không đưa ID tùy ý vào metric."*

🧾 Atlas: document `telemetry` mới nhất · Datadog: `chargeguard.charger.current_a`, `chargeguard.ingestion.success`.

---

### Cảnh 4 — Chi tiết trụ sạc (1:50 – 2:15) · T1 *(có thể cắt nếu thiếu thời gian)*

🖱 Bấm thẻ **demo-charger-03** trên Overview.
👀 Tiêu đề `demo-charger-03` + **CHARGING** + **SYNTHETIC**; ô **Current 8.25 A** (Measured) và **Power ≈1.98 kW** (Estimated at 240 V); biểu đồ 100 mẫu mới nhất; bảng *Sensor channels & data origin* (Voltage/Temperature = **Not measured**).
🎙 *"Trang chi tiết tách bạch giá trị đo, giá trị mô phỏng và giá trị tính toán. Điện áp và nhiệt độ không có cảm biến nên hiển thị 'Not measured' — hệ thống không tự bịa số."*

---

### Cảnh 5 — Đăng nhập Operator (2:15 – 2:35) · T1

🖱 Sidebar → **Sign in as Operator** → trang login (chỉ vào bảng *Guest · read-only* vs *Operator · adds*) → bấm chip `operator@chargeguard.com / admin` → **Sign in as Operator**.
👀 Quay lại đúng trang trước; sidebar đổi sang **Operator · FULL ACCESS**.
🎙 *"Khách xem được toàn bộ dữ liệu; chỉ Operator mới được báo sự cố, xác nhận, xử lý và chạy diễn tập. Sau khi đăng nhập, hệ thống đưa em quay lại đúng trang đang xem."*

---

### Cảnh 6 — DETECT: tạo sự cố (2:35 – 3:40) · T1 → T3 → T2 → T5/T7

🖱 **T1** → menu **Incident Drill** → Target connector **demo-charger-03** → Failure scenario **Connector overheat** → **Inject fault**.
👀 Thông báo xanh; stepper sáng bước **2 · Fault**; khung "Step 2 of 4 — Fault detected"; thẻ **Drill incident** hiện `<ID>` + **OPEN**. **Ghi lại `<ID>`.**
🎙 *"Em giả lập sự cố quá nhiệt ở trụ số 3. Dòng điện của trụ này rơi về 0 A, trạng thái FAULT, và hệ thống mở một incident mới."*

🖱 **Ngay lập tức** chuyển **T3 (Monitor 334137944)**, refresh mỗi ~15 giây.
👀 Trong khoảng **30–90 giây**: Status chuyển **ALERT** (đỏ).
🎙 *"Trên Datadog, monitor đếm sự kiện lỗi trong cửa sổ 1 phút đã chuyển sang ALERT — đây là bước phát hiện tự động."*
> ⏱ **Quan trọng:** monitor đếm theo cửa sổ 1 phút nên sẽ **tự về OK sau khoảng 1–2 phút** dù incident chưa xử lý. Phải quay cảnh ALERT **ngay** sau khi inject. Nếu lỡ, vẫn còn vạch đỏ trong *Status history* để chỉ vào.

🖱 **T2 (Dashboard)** → widget dòng điện + widget *Explicit synthetic fault events*.
👀 Đường `demo-charger-03` rơi xuống **0**; cột fault events xuất hiện.

🖱 **T1** → **Overview** (để thấy toàn cảnh).
👀 Thanh **đỏ** "1 active incident needs attention · Affected: demo-charger-03" + nút **Triage**; thẻ charger-03 **FAULT**; ô *Active incidents* = 1.

🖱 **T5 (Atlas incidents)** → Filter `{ _id: "<ID>" }` → Apply.
👀 `status: "OPEN"`, `severity: "CRITICAL"`, `scenario: "SIM_OVERHEAT"`, `chargerId: "demo-charger-03"`, `detectedAt`, `evidence[0].faultCode: "SIMULATED_DEMO_FAULT"`, `synthetic: true`.
🖱 **T7 (Atlas telemetry)** → Refresh.
👀 Document fault: `currentA: 0`, `chargingState: "FAULT"`, `faultCode: "SIMULATED_DEMO_FAULT"`, `temperatureC: 72` (nhãn SYNTHETIC).
🎙 *"Trong Atlas: incident được lưu ở collection incidents với trạng thái OPEN và bằng chứng; bản ghi telemetry 0 ampe, FAULT nằm trong collection time series. Nhiệt độ 72 độ chỉ là kích thích mô phỏng, được dán nhãn SYNTHETIC."*

🧾 Web: Overview đỏ + Drill bước 2 · Atlas: `incidents` OPEN + `telemetry` FAULT · Datadog: monitor ALERT + current = 0.

---

### Cảnh 7 — INVESTIGATE: xác nhận & điều tra (3:40 – 4:30) · T1 → T4 → T6

🖱 **T1** → bấm **Triage** (hoặc menu **Incidents**) → chọn incident *Connector overheat*.
👀 Stepper ở **Open**; dòng **Next step:** "Acknowledge this incident to take ownership…"; audit trail có 1 dòng *Fault detected*.
🖱 Bấm **Acknowledge**.
👀 Thông báo xanh; badge **ACKNOWLEDGED**; stepper qua bước 2; audit trail thêm *Acknowledged · by local-demo-operator*.
🎙 *"Operator xác nhận nhận xử lý sự cố. Mỗi bước trong vòng đời được ghi vào audit trail chỉ-thêm, có thời điểm và người thực hiện."*

🖱 **T4 (Datadog Logs)** → đổi query thành `service:chargeguard-api env:dev @demo_id:<RUN>` → Enter → mở 1 log.
👀 Các log cùng `demo_id`: `demo.action` (action `fault_injected`, `investigate`), `fault.simulated`, `telemetry.accepted` của charger-03, có `incident_id: <ID>`.
🎙 *"Để điều tra, em lọc log trên Datadog theo đúng mã sự cố. Toàn bộ chuỗi sự kiện — dữ liệu lỗi đi vào, cảnh báo, thao tác của operator — được nối với nhau bằng một ID chung, và đối chiếu được 1–1 với incident trong MongoDB."*

🖱 **T6 (Atlas incident_actions)** → Filter `{ incidentId: "<ID>" }` · Sort `{ at: 1 }`.
👀 2 document: `fault_injected` (actor `demo-operator-ui`), `acknowledged` (actor `local-demo-operator`, `_id: "<ID>:acknowledged"`).
🎙 *"Audit trail trong Atlas dùng `_id` ổn định theo từng hành động, nên bấm lại hay retry cũng không sinh bản ghi trùng."*

🧾 Web: ACKNOWLEDGED · Atlas: `incident_actions` 2 bản ghi · Datadog: log theo `@demo_id`.

---

### Cảnh 8 — RECOVER: gửi telemetry phục hồi (4:30 – 5:05) · T1 → T7 → T2/T3

🖱 **T1** → **Incident Drill** → **Send recovery telemetry**.
👀 Stepper sang bước **3 · Recovery**; badge **RESOLVING**; nút đổi thành **Resolve & close incident**.
🖱 **T7 (Atlas telemetry)** → Refresh.
👀 Document mới nhất của charger-03: `currentA: 8.25`, `chargingState: "CHARGING"`.
🖱 **T2** → đường charger-03 trở lại ≈ 8.25 A. **T3** → monitor đã/đang về **OK**.
🎙 *"Trụ số 3 gửi lại dòng 8,25 ampe. Datadog thấy dòng điện phục hồi và monitor trở về OK. Em nói rõ: monitor OK nghĩa là không còn sự kiện lỗi mới trong cửa sổ đếm — không phải bằng chứng thiết bị vật lý đã được sửa. Vì vậy hệ thống vẫn yêu cầu operator xác nhận đóng sự cố, và đối chiếu với dữ liệu phục hồi trong MongoDB."*

---

### Cảnh 9 — RESOLVE: đóng sự cố (5:05 – 5:40) · T1 → T5/T6 → T4

🖱 **T1** → **Incidents** → chọn incident → **Resolve incident** (hoặc ở Drill: **Resolve & close incident**).
👀 Badge **RESOLVED**; stepper **4 dấu ✓ xanh**; Next step: "Incident closed…"; audit trail đủ **4 dòng**: *Fault detected → Acknowledged → Recovery telemetry received → Resolved*.
🖱 **Overview** → thanh trở lại **All systems nominal**.

🖱 **T5** → Refresh filter `{ _id: "<ID>" }`.
👀 `status: "RESOLVED"` với đủ mốc `detectedAt`, `acknowledgedAt`, `recoveryTelemetryAt`, `resolvedAt`.
🖱 **T6** → Refresh.
👀 Đủ 4 bản ghi theo đúng thứ tự thời gian: `fault_injected`, `acknowledged`, `recovery_requested`, `resolved`.
🖱 **T4** → Refresh query `@demo_id:<RUN>` → thấy thêm `recovery_requested`, `resolved`.
🎙 *"Sự cố đã đóng. Trong MongoDB có đủ bốn mốc thời gian và bốn bản ghi audit; trên Datadog có chuỗi log tương ứng cùng mã sự cố. Từ phát hiện đến đóng sự cố, mọi bước đều truy vết được ở cả hai hệ thống."*

🧾 Web: RESOLVED + 4 bước ✓ · Atlas: 4 mốc + 4 actions · Datadog: monitor OK + log `resolved`.

---

### Cảnh 10 — Điểm nhấn thiết kế MongoDB (5:40 – 6:10) · T7 *(tùy chọn, rất nên có)*

🖱 T7 → tab **Aggregations** → dán pipeline → **Run**:
```json
[
  { "$match": { "meta.chargerId": "demo-charger-03" } },
  { "$sort": { "ts": -1 } },
  { "$limit": 120 },
  { "$group": {
      "_id": { "$dateTrunc": { "date": "$ts", "unit": "minute" } },
      "avgCurrentA": { "$avg": "$currentA" },
      "samples": { "$sum": 1 },
      "faultSamples": { "$sum": { "$cond": [{ "$eq": ["$chargingState", "FAULT"] }, 1, 0] } }
  } },
  { "$sort": { "_id": -1 } }
]
```
👀 Các bucket theo phút; phút xảy ra lỗi có `faultSamples: 1` và `avgCurrentA` thấp hơn 8.25.
🖱 (tùy chọn) tab **Indexes** của `incidents`.
🎙 *"Dashboard dùng aggregation pipeline của MongoDB — match, dateTrunc, group — để tính dòng điện trung bình theo phút. Ở đây thấy rõ phút xảy ra sự cố. Collection incidents có index theo trạng thái và thời gian để hàng đợi sự cố truy vấn nhanh."*

---

### Cảnh 11 — Kết (6:10 – 6:35) · T1 Overview

🎙 *"Tóm lại, ChargeGuard thể hiện trọn vòng Detect → Investigate → Resolve: Datadog phát hiện và giúp điều tra bằng metric, log, monitor; MongoDB Atlas lưu telemetry dạng time series và audit trail đầy đủ cho từng sự cố. Giới hạn hiện tại: trạm sạc và sự cố là mô phỏng, Datadog chạy qua Agent ở môi trường dev, chưa kết nối thiết bị vật lý. Cảm ơn Ban Giám khảo đã theo dõi."*

**Sau khi quay (ngoài video):** Incident Drill → **Reset to baseline**.

---

## PHẦN C — Bảng đối chiếu nhanh (dán lên màn hình phụ khi quay)

| Bước | Thao tác web | MongoDB Atlas | Datadog US1 |
|---|---|---|---|
| Baseline | Overview xanh, 5 × 8.3 A | `telemetry` mới mỗi 8 s, `CHARGING` | current 5 × 8.25; `ingestion.success` đều; 2 monitor OK |
| **Detect** | Drill → **Inject fault** | `incidents` **OPEN**; `incident_actions` `fault_injected`; `telemetry` `currentA:0`, `FAULT` | monitor 334137944 **ALERT**; current charger-03 = 0; `fault.simulated` |
| **Investigate** | Incidents → **Acknowledge** | `ACKNOWLEDGED` + `acknowledgedAt`; action `acknowledged` | Logs `@demo_id:<RUN>`: `fault_injected`, `investigate` |
| Recover | Drill → **Send recovery telemetry** | `RESOLVING` + `recoveryTelemetryAt`; action `recovery_requested`; `telemetry` 8.25 | current charger-03 về 8.25; monitor **OK** |
| **Resolve** | **Resolve incident** | `RESOLVED` + `resolvedAt`; 4 actions | Log `resolved` |

Actor trong audit: `demo-operator-ui` (inject, recovery — do API demo ghi) và `local-demo-operator` (acknowledge, resolve — nhãn cố định do BFF gắn). Nếu giám khảo hỏi: đây là nhãn tác nhân ở môi trường demo local, chưa phải danh tính người dùng thật.

---

## PHẦN D — Xử lý sự cố khi quay

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Atlas không thấy bản ghi mới | API chạy in-memory | Xem log terminal API; làm lại **A1**. |
| Overview vàng "Telemetry partially delayed" | Ticker 8 s không chạy / API vừa khởi động | Chờ 10–20 s; kiểm tra log `Synthetic telemetry ticker … MongoDB Atlas`. |
| Bấm Inject lại ra cùng một incident | Đã có incident đang mở (cơ chế chống trùng) | Hoàn tất hoặc **Reset to baseline** rồi làm lại. |
| Monitor không lên ALERT sau 2 phút | Agent không gửi / trial hết hạn / sai env | `sudo datadog-agent status`; Metrics Explorer: `sum:chargeguard.fault.simulated{env:dev}.as_count()`. |
| Monitor đã tự về OK trước khi kịp quay | Cửa sổ đếm 1 phút đã trôi | Chỉ vào vạch đỏ trong *Status history*; lần sau chuyển tab T3 ngay sau khi inject. |
| Log Explorer trống | Agent chưa đọc file log | `sudo datadog-agent status` → Logs Agent; kiểm tra file `/usr/local/var/log/chargeguard/api.jsonl` đang tăng. |
| Nút Acknowledge/Resolve bị mờ | Đang chạy bản production (`NODE_ENV=production`) | Quay trên `npm run dev` local. |
| Nút hiện "Sign in to …" | Phiên đăng nhập hết / chưa đăng nhập | Đăng nhập lại Operator. |

## PHẦN E — Checklist trước khi nộp video

- [ ] Log API ghi **Connected successfully to MongoDB Atlas** trong suốt buổi quay.
- [ ] Có đủ 3 cặp bằng chứng: **Detect** (ALERT + OPEN), **Investigate** (log `@demo_id` + `acknowledged`), **Resolve** (OK + RESOLVED + 4 actions).
- [ ] Không lộ email, tên org/host, IP, connection string, API key, `.env`.
- [ ] Lời dẫn nói rõ dữ liệu **mô phỏng**, Datadog **env:dev**, monitor OK ≠ thiết bị đã sửa.
- [ ] 1080p, chữ đọc được, con trỏ dễ thấy; phụ đề tiếng Việt nếu có thể.
- [ ] Sau khi quay: **Reset to baseline**.
