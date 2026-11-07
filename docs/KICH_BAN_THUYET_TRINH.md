# ChargeGuard — Kịch bản thuyết trình (vòng chung kết online)

> **Bản 07/11/2026.** Dùng cùng deck [ChargeGuard_MUGVN_2026.pptx](submission/ChargeGuard_MUGVN_2026.pptx) (13 slide, bản 23/10) và [kịch bản demo](KICH_BAN_QUAY_DEMO.md).
> **Thời lượng mục tiêu: 10 phút** (≈ 6 phút nói + 4 phút demo). BTC chưa công bố format chính thức — nếu chỉ có 5 phút, dùng **bản rút gọn ở Phần E**.
> Lời dẫn viết để **nói**, không phải đọc. Câu in nghiêng là lời nói; phần `[…]` là chỉ dẫn hành động.

---

## PHẦN A — Sửa deck trước khi trình bày (≈20 phút)

Deck được chốt ngày 23/10, một số slide đã lỗi thời so với bản demo hiện tại:

| Slide | Vấn đề | Đề xuất |
|---|---|---|
| **1** | Ghi "CLOUD: READ-ONLY" | Giữ — vẫn đúng với bản cloud. |
| **3** | "UI công khai + OAuth / BFF" | Thêm dòng nhỏ: *"Demo hôm nay: chạy local, kết nối Atlas + Datadog thật."* |
| **9** | Chỉ nói GitHub OAuth | Giữ nội dung (đúng cho bản production 23/10), nhưng **khi nói phải phân biệt** bản local dùng tài khoản demo — xem Q&A câu 4. |
| **12** | Lịch nộp bài 23–31/10 — **đã qua** | **Ẩn slide** (Hide Slide). |
| **13** | Cột "CẦN CHỐT TRƯỚC KHI NỘP" đã lỗi thời | Đổi tiêu đề cột thành **"HƯỚNG PHÁT TRIỂN"**: Datadog env:prod · cảnh báo stale/offline tự động · kết nối OCPP thiết bị thật · quyền dữ liệu ACN. |
| *(mới)* | Chưa có slide chuyển sang demo | Chèn 1 slide sau slide 3: **"DEMO TRỰC TIẾP — Detect → Investigate → Resolve"** + 3 logo Web / Atlas / Datadog. |

**Thứ tự trình bày đề xuất** (demo sớm để giám khảo thấy sản phẩm chạy trước khi nghe chi tiết kỹ thuật):

`1 → 2 → 3 → [DEMO] → 4 → 5 → 6 → 7+8 → 9 → 10 → 11 → 13`

---

## PHẦN B — Kịch bản nói theo slide

### Slide 1 — Mở đầu (0:00 – 0:30)

*"Xin chào Ban Giám khảo. Em là [tên], đội OneNode, thi một mình. Dự án của em là **ChargeGuard** — hệ thống theo dõi vận hành và phản ứng sự cố cho trạm sạc xe điện.*
*Em xin nói trước phạm vi để Ban Giám khảo dễ đánh giá: ChargeGuard chạy trên **5 cổng sạc ảo**, sự cố là **mô phỏng có dán nhãn**, chưa kết nối phần cứng thật. Thứ em muốn chứng minh là một **quy trình phản ứng sự cố có bằng chứng kiểm chứng được**, xây trên MongoDB Atlas và Datadog."*

---

### Slide 2 — Bài toán (0:30 – 1:15)

*"Khi một trạm sạc có vài chục cổng, sự cố xảy ra liên tục: mất điện đột ngột, quá nhiệt, lỗi phần cứng. Người vận hành gặp ba khó khăn:*
*Một — **phát hiện muộn**: tài xế báo trước khi hệ thống báo.*
*Hai — **điều tra rời rạc**: metric một nơi, log một nơi, ghi chú xử lý lại ở chỗ khác.*
*Ba — **thiếu bằng chứng**: khi đóng sự cố, không chứng minh được ai đã làm gì, lúc nào.*
*[chỉ vào 4 ô] ChargeGuard đi theo đúng bốn bước: **Phát hiện → Điều tra → Phản ứng → Xác minh**. Mục tiêu không phải là con số kinh doanh, mà là mỗi bước đều để lại dấu vết kiểm chứng được."*

---

### Slide 3 — Kiến trúc (1:15 – 2:00)

*"Kiến trúc gồm ba lớp. Frontend **Next.js**, backend **NestJS**, và **MongoDB Atlas** làm nơi lưu trữ vận hành chính.*
*Telemetry từ cổng sạc đi vào NestJS, được kiểm tra schema, chống trùng, rồi ghi vào Atlas. Song song, NestJS đẩy **metric qua DogStatsD và log dạng JSON** sang Datadog Agent, Agent gửi lên **Datadog US1**.*
*Như vậy em có hai nguồn sự thật độc lập: **MongoDB trả lời 'chuyện gì đã xảy ra'**, **Datadog trả lời 'hệ thống phát hiện ra sao'**. Phần demo tiếp theo em sẽ cho thấy hai nguồn này khớp nhau."*

**[Chuyển tiếp]** *"Thay vì nói tiếp, em xin demo luôn."*

---

### DEMO TRỰC TIẾP (2:00 – 6:00)

> Thực hiện theo **Cảnh 2 → 9** của [KICH_BAN_QUAY_DEMO.md](KICH_BAN_QUAY_DEMO.md). Chuẩn bị đủ **Phần A** của file đó trước giờ thi (kết nối Atlas, kiểm tra Datadog, mở sẵn 7 tab, Reset to baseline, đăng xuất).
> **Phương án dự phòng:** mở sẵn file video đã quay. Nếu demo live lỗi quá 30 giây → *"Để tiết kiệm thời gian, em xin chiếu bản ghi đã quay sáng nay"* → phát video.

Bản rút gọn 4 phút để nói khi demo live:

| Phút | Màn hình | Nói |
|---|---|---|
| 0:00 | Overview (Guest) | *"Đây là màn hình tổng quan. Thanh trên cùng cho biết ngay: 5 trên 5 cổng đang báo dữ liệu, không có sự cố. Mọi số liệu đều dán nhãn nguồn gốc — SYNTHETIC là mô phỏng, DERIVED là giá trị tính toán."* |
| 0:30 | Atlas `telemetry` | *"Dữ liệu này nằm thật trong Atlas, collection Time Series — bản ghi mới nhất cách đây vài giây."* |
| 0:50 | Đăng nhập Operator | *"Khách chỉ xem được. Em đăng nhập Operator để thao tác."* |
| 1:00 | Drill → Inject fault (charger-03, Overheat) → **tab Monitor** | *"Em giả lập quá nhiệt ở trụ 3. [chờ] Monitor Datadog chuyển ALERT — đây là bước **Detect**."* |
| 1:50 | Overview đỏ → Atlas `incidents` | *"Dashboard báo đỏ, chỉ đúng trụ bị lỗi. Trong Atlas, incident đã được tạo với trạng thái OPEN và bằng chứng 0 ampe."* |
| 2:20 | Incidents → **Acknowledge** → DD Logs `@demo_id` | *"Operator xác nhận — bước **Investigate**. Trên Datadog em lọc log theo đúng mã sự cố: toàn bộ chuỗi sự kiện nối với nhau bằng một ID."* |
| 3:00 | Drill → Send recovery → **Resolve** | *"Trụ gửi lại dòng 8,25 ampe, monitor về OK. Em đóng sự cố — bước **Resolve**."* |
| 3:30 | Atlas `incident_actions` | *"Atlas giữ đủ 4 bản ghi audit theo thứ tự thời gian: phát hiện, xác nhận, phục hồi, đóng. Mỗi bước trên web đều có dấu vết ở cả MongoDB và Datadog."* |

**[Quay lại slide 4]** *"Giờ em xin giải thích phần thiết kế phía sau những gì vừa thấy."*

---

### Slide 4 — Thiết kế MongoDB (6:00 – 6:45)

*"Dữ liệu chia theo mục đích sử dụng.*
*[chỉ ô TIME SERIES] **Telemetry** dùng **Time Series collection**: trường thời gian `ts`, metadata là trạm và trụ. MongoDB tự gom dữ liệu theo bucket nên ghi và truy vấn theo thời gian hiệu quả; **TTL 7 ngày** tự dọn dữ liệu cũ — hợp với gói Atlas Free.*
*[ô INCIDENT] **Incidents** và **incident_actions** là collection thường, vì trạng thái sự cố cần cập nhật, còn audit thì chỉ thêm. Mỗi hành động có `_id` ổn định nên bấm lại hay retry cũng không sinh bản ghi trùng.*
*[ô IDEMPOTENCY] **ingestion_receipts** lưu dấu vân tay từng sự kiện, chống ghi trùng telemetry khi thiết bị gửi lại."*

---

### Slide 5 — Aggregation Pipeline (6:45 – 7:20)

*"Đây là pipeline thật trong mã nguồn, phục vụ biểu đồ dòng điện theo thời gian.*
*`$match` lọc theo trụ và khoảng thời gian, `$dateTrunc` cắt thời gian theo bucket phút, `$group` tính dòng trung bình và số mẫu, rồi sort và giới hạn.*
*Em giới hạn khoảng truy vấn tối đa 31 ngày và 500 dòng để bảo vệ cluster Free. Và em hiển thị kèm **số mẫu thực** trong mỗi bucket, để người xem biết trung bình đó dựa trên bao nhiêu quan sát."*

---

### Slide 6 — Datadog (7:20 – 8:00)

*"Phía Datadog có ba thành phần.*
***Dashboard** vận hành: ingest thành công/thất bại, độ trễ, dòng điện từng trụ, trạng thái và sự kiện lỗi.*
***Hai monitor**: một bắt lỗi ingest, một bắt sự kiện lỗi mô phỏng — như Ban Giám khảo vừa thấy chuyển ALERT trong demo.*
***Log Management**: log JSON đã lọc trường nhạy cảm, có `demo_id` và `incident_id` để nối log với incident trong MongoDB.*
*Em lưu ý một điểm trung thực: monitor về OK nghĩa là **không còn sự kiện lỗi mới trong cửa sổ 1 phút**, không có nghĩa thiết bị vật lý đã được sửa. Vì vậy hệ thống vẫn bắt buộc có dữ liệu phục hồi và xác nhận của operator mới cho đóng sự cố."*

---

### Slide 7 + 8 — Bằng chứng đã kiểm chứng (8:00 – 8:40)

*"Ngoài demo hôm nay, em đã kiểm chứng hai lần độc lập, có ghi ngày rõ ràng.*
*Ngày **19/10**, môi trường local: Datadog phát hiện lỗi, ALERT rồi về OK, log tương quan đúng incident.*
*Ngày **23/10**, trên bản cloud Vercel – Render – Atlas: một vòng đời đầy đủ OPEN → ACKNOWLEDGED → RESOLVING → RESOLVED, mỗi bước có revision để chống ghi đè. Sau buổi diễn tập, em **tắt toàn bộ quyền ghi** trên production — 22 trên 22 request ghi thử đều bị chặn 403.*
*Em cố ý không ghép hai lần thử này thành một câu chuyện, vì chúng diễn ra ở hai môi trường khác nhau."*

---

### Slide 9 — Bảo mật (8:40 – 9:10)

*"Về bảo mật trên bản cloud: định danh operator qua GitHub OAuth và được backend xác minh lại; quyền ghi gắn với từng run, có chống CSRF, nonce chống replay, quota và kiểm tra revision. Mặc định mọi cờ ghi đều tắt.*
*Bản demo local hôm nay dùng **tài khoản demo** để Ban Giám khảo thao tác nhanh — đây là chế độ trình diễn, không phải cơ chế đăng nhập cho production."*

---

### Slide 10 + 11 — Dữ liệu & kiểm thử (9:10 – 9:40)

*"Về dữ liệu: em có phân tích 5 phiên sạc thật từ bộ ACN của Caltech — hơn 20 nghìn dòng — nhưng chỉ xử lý trên máy cá nhân vì chưa xác nhận quyền công bố. Mọi thứ đưa lên cloud đều là mô phỏng, có nhãn.*
*Về chất lượng: hệ thống có 55 unit test API, 24 integration test, 29 test web và 6 test end-to-end qua HTTPS.*
*[chỉ dòng CHƯA TUYÊN BỐ] Và em nói rõ những gì **chưa** chứng minh: chưa đo lỗi phần cứng thật, chưa có SLA, chưa đo mức giảm thời gian xử lý sự cố."*

---

### Slide 13 — Kết luận (9:40 – 10:00)

*"Tóm lại, ChargeGuard đã có một quy trình **Detect → Investigate → Resolve** chạy được, mà mỗi bước đều kiểm chứng được ở cả **MongoDB Atlas** và **Datadog**.*
*Hướng tiếp theo: bật Datadog cho môi trường production, thêm cảnh báo tự động khi trụ mất tín hiệu, và kết nối thiết bị thật qua chuẩn OCPP.*
*Em cảm ơn Ban Giám khảo đã lắng nghe, em sẵn sàng nhận câu hỏi."*

---

## PHẦN C — Chuẩn bị hỏi đáp (Q&A)

Nguyên tắc: **trả lời ngắn (≤30 giây), thừa nhận giới hạn trước, rồi nói hướng xử lý.** Không hứa điều chưa làm.

**1. Dữ liệu đều là mô phỏng thì hệ thống có giá trị gì?**
*"Bài toán em giải là quy trình phản ứng sự cố và bằng chứng, không phải cảm biến. Pipeline nhận telemetry qua API chuẩn có schema và chống trùng — thay nguồn mô phỏng bằng thiết bị thật thì phần lưu trữ, phát hiện và audit giữ nguyên. Em có phân tích dữ liệu ACN thật nhưng chưa được phép công bố nên không đưa lên cloud."*

**2. Tại sao dùng Time Series collection mà không phải collection thường?**
*"Telemetry là dữ liệu chỉ thêm, truy vấn theo thời gian và theo thiết bị. Time Series tự gom bucket theo metadata nên tiết kiệm dung lượng và truy vấn khoảng thời gian nhanh hơn, cộng thêm TTL tự dọn. Còn incident cần cập nhật trạng thái nên em để ở collection thường."*

**3. Phát hiện sự cố mất bao lâu?**
*"Monitor đánh giá cửa sổ 1 phút. Lần đo ngày 19/10, thời gian từ lỗi đến ALERT quan sát được tối đa khoảng 166 giây — gồm độ trễ Agent gửi metric và chu kỳ đánh giá monitor. Em chưa tối ưu con số này và không tuyên bố đó là SLA."*

**4. Đăng nhập bằng admin/admin thì có an toàn không?**
*"Không — và em không dùng nó cho production. Đó là tài khoản demo ở bản local để thao tác nhanh. Bản cloud ngày 23/10 dùng GitHub OAuth, backend xác minh lại danh tính theo allowlist, và mọi quyền ghi production hiện đang tắt."*
> ⚠️ Chỉ trả lời như trên **nếu** bản deploy production không chứa CredentialsProvider (xem ghi chú cuối file).

**5. Monitor tự về OK sau 1 phút thì có sai không?**
*"Đúng, đó là giới hạn của monitor đếm theo cửa sổ. Vì vậy em không coi OK là bằng chứng đã phục hồi: incident chỉ được đóng khi có telemetry phục hồi lưu trong MongoDB và operator xác nhận. Hướng cải tiến là thêm monitor theo trạng thái trụ thay vì đếm sự kiện."*

**6. Nếu thiết bị gửi trùng dữ liệu hoặc mạng chập chờn?**
*"Mỗi sự kiện có eventId; collection ingestion_receipts lưu dấu vân tay payload, gửi lại cùng sự kiện sẽ không tạo bản ghi thứ hai. Batch không atomic nên client cần gửi lại đúng ID — em đã ghi rõ giới hạn này trong tài liệu."*

**7. Hệ thống mở rộng lên hàng nghìn trụ thế nào?**
*"Hiện em mới chứng minh với 5 trụ ảo. Về thiết kế: Time Series bucket theo trụ, metric Datadog chỉ gắn tag trong danh sách cho phép để không bùng nổ custom metric, truy vấn luôn có giới hạn thời gian và số dòng. Khi mở rộng cần thêm hàng đợi ingest và tách tag theo nhóm trạm — em chưa đo tải ở quy mô đó."*

**8. Tại sao Datadog production đang tắt?**
*"Vì em dùng tài khoản trial, chưa xác nhận được quota và chi phí khi gửi từ cloud, nên em chỉ kiểm chứng qua Agent local ở môi trường dev — và ghi rõ nhãn env:dev trên mọi bằng chứng."*

**9. Nếu Atlas mất kết nối thì sao?**
*"Health check của API kiểm tra kết nối database; khi lỗi API trả 503 và không giả vờ có dữ liệu. Giao diện hiển thị trạng thái thiếu dữ liệu thay vì số 0."*
> Không demo tình huống này trên máy local (chế độ dev có cơ chế dự phòng in-memory).

**10. Phần nào dùng AI hỗ trợ?**
*"Em có dùng trợ lý AI để hỗ trợ viết mã, rà soát giao diện và tài liệu; toàn bộ đã được em kiểm tra và chạy test. Việc này đã được khai báo trong hồ sơ nộp bài."*

**11. Đóng góp riêng nổi bật nhất là gì?**
*"Ràng buộc bằng chứng giữa hai hệ thống: cùng một mã sự cố xuất hiện trong incident của MongoDB và trong log Datadog, và audit trail không thể ghi trùng. Người vận hành không chỉ biết có lỗi, mà chứng minh được quá trình xử lý."*

---

## PHẦN D — Checklist ngày thi

**T−1 giờ**
- [ ] Atlas Network Access có IP hiện tại; API log `Connected successfully to MongoDB Atlas`.
- [ ] Đăng nhập Datadog được; monitor 334137944 đang **OK**.
- [ ] Mở sẵn 7 tab theo [KICH_BAN_QUAY_DEMO.md – A4](KICH_BAN_QUAY_DEMO.md); Reset to baseline; đăng xuất.
- [ ] Mở sẵn **video demo dự phòng** (file local, không phụ thuộc mạng).
- [ ] Deck đã sửa theo Phần A; tắt thông báo hệ điều hành, đóng tab có thông tin cá nhân.

**Khi chia sẻ màn hình**
- [ ] Share **cửa sổ trình duyệt**, không share toàn màn hình (tránh lộ terminal/.env).
- [ ] Zoom trình duyệt 110–125%; có nước uống; đồng hồ đếm giờ.

**Sau khi thi**
- [ ] Reset to baseline.

---

## PHẦN E — Bản rút gọn 5 phút

`Slide 1 (20s) → Slide 2 (40s) → Slide 3 (40s) → DEMO 2 phút (chỉ: Inject → ALERT → Atlas OPEN → Acknowledge → Resolve → 4 actions) → Slide 4+5 gộp (40s) → Slide 13 (20s)`

Bỏ: slide 6–11 (để dành cho Q&A).

---

### Ghi chú cho người trình bày (không trình chiếu)

Bản code chưa commit hiện tại ở `apps/web/src/lib/auth-options.ts` bật đăng nhập email/mật khẩu **ở mọi môi trường** với mật khẩu yếu và gán định danh trùng owner (`138879141`). Trước khi deploy lại hoặc trả lời câu hỏi bảo mật, hãy giới hạn CredentialsProvider chỉ cho môi trường local — nếu không, câu trả lời Q&A số 4 sẽ không còn đúng.
