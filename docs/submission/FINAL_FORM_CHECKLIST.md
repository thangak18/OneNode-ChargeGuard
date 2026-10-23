# MUGVN Hackathon 2026 — final form and deadline gates

**Nguồn:** https://mini-hackathon-sep-2026.mugvn.com/terms và https://mini-hackathon-sep-2026.mugvn.com/#requirements, tra cứu 23/10/2026. **Hạn: 23:59 ICT 31/10/2026.** Format/độ dài video và slide **chưa được website chính thức ấn định**. Link form nộp riêng cho đội cần xác nhận từ email/BTC, đừng lấy nhầm link đăng ký đội.

## Đối chiếu 12 mục BTC yêu cầu

- [x] Tên dự án + mô tả vấn đề: `PROJECT_DESCRIPTION_VI_EN.md`.
- [ ] Thông tin OneNode/leader và email liên hệ: nhập **trong form**, không đưa thông tin cá nhân vào repo.
- [x] Kiến trúc ứng dụng: `TECHNICAL_EVIDENCE.md` + `docs/ARCHITECTURE.md`.
- [x] Kiến trúc MongoDB: collections, Time Series, TTL, Aggregation Pipeline **source-verified**. [ ] Chụp 1 kết quả aggregation thực tế qua read-only query nếu còn dữ liệu trong cửa sổ TTL; che ID và thông tin private.
- [x] Kiến trúc Datadog: dashboard, fault monitor, Logs Explorer và `env:dev` dated evidence; cloud `env:prod` OFF.
- [x] Repository + hướng dẫn cài: private `thangak18/OneNode-ChargeGuard`, root `README.md`.
- [x] README environment/config/deploy/test: hiện có; secret tuyệt đối không đưa vào repo.
- [x] MVP/demo truy cập: Vercel public read-only, Judge Console authenticated GET, Render/Atlas reads; [ ] kiểm tra trước khi nộp và sau doc push.
- [ ] **Video demo 4:30 theo kế hoạch đội**: quay/dựng thực, cắt cảnh nhạy cảm, nộp URL/file theo hướng dẫn BTC; không giả mạo monitoring.
- [x] **Slide thuyết trình:** PowerPoint/PDF xuất từ nội dung đã rà soát; [ ] xác nhận định dạng cuối BTC chấp nhận và duyệt nội dung trước nộp.
- [x] Tình huống sự cố: production Judge cycle 1 là chuỗi trạng thái mô phỏng; Datadog local Phase D là kiểm chứng ALERT/OK **độc lập**.
- [ ] **Khai báo** OSS, nguồn ACN/giới hạn sử dụng, dữ liệu SYNTHETIC, reused pre-17-Oct source, danh sách AI tool thực tế; owner duyệt lần cuối.

## Ngày cần chốt

| Deadline/when | Việc cần làm | Người thực hiện |
| --- | --- | --- |
| **23–25/10** | Gửi thư hỏi BTC về username judge, cách cấp quyền chỉ đọc, link form, format video/slide, live vs recorded demo. | Owner, **chưa gửi** |
| **23–26/10** | Gửi Datadog Support draft; lấy **văn bản quyền lợi trial Logs/Custom Metrics $0 và giờ hết hạn**, quyết định có cần trial extension. | Owner, **chưa gửi** |
| **26–28/10** | Chuẩn bị cảnh quay read-only đã có, kiểm duyệt disclosure/đường dẫn/ID; quay video hoặc xin **phê duyệt mới** nếu muốn mở cycle 2; cloud logs vẫn OFF. | Owner |
| **29–30/10** | Duyệt PPTX/PDF, video, form, README; kiểm tra truy cập demo, thử link nộp, kiểm tra Git secret/raw-ACN và chốt SHA. | Owner |
| **31/10 trước 23:59 ICT** | Nộp **đủ 12 mục**, cấp quyền BTC bằng phương án đã được xác nhận; lưu timestamp/biên nhận và commit SHA. | Owner |
| **01–22/11** | Duy trì quyền judge đến hết **22/11**; **không thay đổi repo sau hạn nộp**. Nếu dự chung kết 08/11, xác nhận format & giới hạn trial trước. | Owner |

**STOP gates:** không gửi cloud Datadog `--send` nếu chưa được Support xác nhận và owner phê duyệt riêng; không bật Judge writes chỉ để quay; không công khai hoặc cloud-upload ACN raw; không chuyển quyền GitHub/repo tự động. BTC được phép showcase media nộp, vì vậy duyệt privacy trước khi submit.
