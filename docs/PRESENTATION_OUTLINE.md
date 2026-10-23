# Dàn ý thuyết trình ChargeGuard

> **BẢN 23/10/2026 (áp dụng cho slide cuối):** Source `f19f69f`; cloud read-only Vercel/Render/Atlas; GitHub OAuth Judge Run đã diễn tập thực tế 4 bước và một re-arm, **cycle 2 BASELINE revision 5**; production writes OFF, Datadog cloud OFF. Các dòng bên dưới là outline giai đoạn 19/10, gồm một số nhận định deployment đã cũ. Bộ 10 slide cuối phải theo [FINAL_RELEASE_AND_SUBMISSION.md](FINAL_RELEASE_AND_SUBMISSION.md) và [FINAL_DEMO_VIDEO_SCRIPT.md](FINAL_DEMO_VIDEO_SCRIPT.md). Slide 8 thể hiện **2 nguồn bằng chứng tách biệt**: (A) Phase D local Datadog `env:dev` ALERT → OK, (B) production Judge lifecycle 23/10 với audit và re-arm; tuyệt đối không khẳng định Datadog production monitor đã alert. Slide 9 ghi kiểm thử mới 55 API unit / 24 integration / 29 web / 6 HTTPS E2E. Slide 10 dành cho privacy, $0 gate và quyền dataset chưa được cấp.


Bản chuẩn bị tiếng Việt, 19/10/2026. Mười slide là đề xuất của đội; chưa tạo/export slide cuối. Không dùng hình ACN khi quyền công khai chưa xác nhận. Dùng sơ đồ và số liệu tổng hợp; ảnh Datadog phải che thông tin và duyệt lại theo [storyboard](DEMO_VIDEO_STORYBOARD.md).

| Slide | Nội dung trên slide | Lời dẫn / điều cần tránh |
| --- | --- | --- |
| 1. ChargeGuard / OneNode | Theo dõi và xử lý sự cố trạm sạc ảo | Prototype vận hành; không tuyên bố điều khiển hoặc chứng nhận an toàn phần cứng. |
| 2. Bài toán vận hành | Tín hiệu → phát hiện → điều tra → hành động → bằng chứng | Sự khác biệt giữa monitor OK và incident được xử lý có audit. Không có heartbeat monitor đáng tin cậy ở phiên bản này. |
| 3. Hai nhánh độc lập | ACN local → adapter → /history; SYNTHETIC → NestJS → Atlas + Agent → Datadog → UI | Không vẽ ACN đi vào Atlas/Datadog; dữ liệu lịch sử không live. |
| 4. Dữ liệu lịch sử thật | 5 phiên, 20.228 dòng gốc, 1.246 điểm chọn, 5 hash khớp, 1 prefix | Không có biểu đồ nguồn trong deck hiện tại. Một prefix chưa xác minh độc lập danh tính thiết bị; không phải 5 bộ sạc thật. |
| 5. Chất lượng và provenance | ACN_REPLAY / SOURCE_REPORTED / DERIVED / SYNTHETIC; hai đồng hồ | Current lịch sử; state/energy do nguồn báo cáo. 6 lần giảm counter, 132 khoảng trống >10 giây. Không suy ra power/voltage/temp/fault vật lý. |
| 6. MongoDB | Time-series telemetry, TTL, aggregation có giới hạn, idempotency receipt, incident/action | Nhánh cloud dùng đầu vào SYNTHETIC. Minh họa schema bằng dữ liệu tự tạo, không copy record ACN/secret từ shell. |
| 7. Datadog | chargeguard.* metric, log JSON, monitor fault và ingestion-error | Bounded tags cho 5 charger ảo. Monitor fault đã có ALERT → OK; không gán lifecycle đó cho monitor ingestion-error. Ngưỡng demo không phải giới hạn an toàn EV. |
| 8. Một incident xuyên suốt | demo-58a1983cae09; fault → acknowledged → recovery_requested → resolved | Dùng timeline Phase D đã kiểm chứng, không chạy lại. 166,33 giây là cận trên quan sát; 8,53 giây dựa timestamp history. OK có thể do cửa sổ đếm hết hạn. |
| 9. Kiểm thử và giới hạn | Node 24: 29 API unit / 11 integration / 4 web policy; production historical 403 | Test fixture không phải kiểm chứng mới Atlas/Datadog. Local-only, chưa auth đầy đủ cho deployment public, chưa tracing/physical hardware validation. |
| 10. Kế hoạch hoàn tất | Quyền dataset, video/slides, judge access, trial, form; disclosure AI/dependencies | Chưa có grant cloud/public/redistribution ACN. GitHub personal private repo không có collaborator chỉ đọc; owner/BTC cần giải quyết access trước deadline. |

Đọc [architecture](ARCHITECTURE.md), [Phase D evidence](PHASE_D_VERIFICATION.md), [permission inquiry chưa gửi](DATASET_PERMISSION_INQUIRY.md) và [checklist nộp bài](SUBMISSION_CHECKLIST.md). Bản cuối phải ghi nguồn ACN, các thư viện/công cụ AI thực tế đã dùng và người kiểm chứng. Không suy diễn rằng repo private cho phép phân phối dataset. Nội dung nộp có thể được BTC công khai showcase, nên kiểm tra quyền cả video và slide.
