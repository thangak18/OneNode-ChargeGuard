# Kịch bản video ChargeGuard — hai luồng dữ liệu tách biệt

Bản chuẩn bị ngày 19/10/2026. Gợi ý thời lượng 4–5 phút của đội, không phải yêu cầu BTC. Chưa ghi video. Xác nhận định dạng/thời lượng trong form chính thức trước khi quay.

## Ranh giới nội dung được dùng

Video nộp bài chỉ dùng dữ liệu vận hành SYNTHETIC, sơ đồ và số liệu kiểm thử tổng hợp. Phần lịch sử trình bày phương pháp, số lượng và giới hạn; **không quay biểu đồ, dòng nguồn, timestamp nguồn, tên file gốc hay màn hình /history** khi chưa có quyền hiển thị. Việc trình chiếu cho giám khảo hoặc tải bản quay lên dịch vụ cũng cần xét quyền hiển thị tương ứng.

Ảnh Datadog gốc trong `docs/evidence/` có thông tin tài khoản/host: giữ làm evidence riêng, chưa được duyệt để đưa thẳng vào video. Chỉ dùng bản crop/che thông tin đã kiểm tra lại; giữ nguyên metric, timestamp và trạng thái, không sửa chứng cứ. Không có bản ảnh đã che mới được tạo trong lần chuẩn bị này. Ảnh UI tổng hợp `phase-d-ui-incident-resolved.png` có thể dùng sau kiểm tra riêng tư; bỏ `ui-demo-desktop.png` do bản chụp không đầy đủ. Không dùng ảnh ACN. Trước xuất video, kiểm tra từng khung hình, URL, thanh tài khoản, terminal và thông báo hệ điều hành.

| Mốc gợi ý | Hình ảnh/thao tác | Lời dẫn tiếng Việt |
| --- | --- | --- |
| 0:00–0:30 | Tiêu đề, sơ đồ vận hành; không ảnh tài khoản | “ChargeGuard giúp theo dõi tín hiệu, điều tra và ghi lại quá trình xử lý sự cố của trạm sạc ảo. Đây là prototype, chưa điều khiển thiết bị thật.” |
| 0:30–1:10 | Sơ đồ hai nhánh không có mũi tên dữ liệu ACN sang cloud; bảng tổng hợp 5 / 20.228 / 1.246 / 1 prefix | “Nhánh lịch sử đọc dữ liệu dòng sạc đã quan sát trong quá khứ, chỉ trên máy cá nhân. Năm phiên dùng chung một tiền tố định danh, không chứng minh năm bộ sạc vật lý. Nhánh còn lại mô phỏng năm bộ sạc ảo để kiểm chứng vận hành trên Atlas và Datadog.” |
| 1:10–1:40 | Sơ đồ time-series, receipt/idempotency, incident/actions, Agent/metrics/logs | “MongoDB lưu telemetry tổng hợp và lịch sử hành động. Datadog nhận metric và log có nhãn SYNTHETIC. Đồng hồ phát lại khác thời điểm ghi gốc; không có dữ liệu ACN nào được đưa vào luồng này.” |
| 1:40–2:25 | Timeline bằng chữ từ evidence Phase D; nếu dùng ảnh monitor phải che và duyệt trước | “Trong lần kiểm chứng ngày 19/10, fault monitor đã chuyển ALERT. Đây là sự kiện giả lập, không phải lỗi phần cứng thật. Ingestion-error monitor là monitor khác và không được tuyên bố đã cảnh báo trong kịch bản này.” |
| 2:25–3:15 | UI incident RESOLVED và bảng bốn hành động; log chỉ sau che thông tin | “Cùng incident được liên kết bằng ID trong log và hành động điều tra. Operator xác nhận, gửi telemetry phục hồi cho đúng một bộ sạc, rồi resolve. Bốn bộ sạc còn lại không bị ghi lại trong bước phục hồi.” |
| 3:15–3:50 | Timeline phục hồi từ evidence, ghi rõ ‘Bản ghi kiểm chứng 19/10/2026’ | “Monitor trở về OK. Quan sát phát hiện có cận trên 166,33 giây gồm thời gian polling; mốc OK khoảng 8,53 giây sau telemetry phục hồi theo lịch sử monitor. Cửa sổ đếm tự hết hạn cũng có thể về OK, nên OK riêng lẻ không chứng minh sửa xong thiết bị.” |
| 3:50–4:30 | Bảng test và giới hạn/việc còn lại | “29 unit test API, 11 integration test và 4 web policy test đã pass trên Node 24. Historical endpoint bị chặn ở production. Quyền ACN cho cloud và công khai còn chờ xác nhận; bước tiếp theo là hoàn thiện quyền truy cập giám khảo và bộ hồ sơ nộp.” |

## Quay và kiểm tra

- Giữ nguyên incident đã RESOLVED và evidence Phase D. Kịch bản trên kể lại lần chạy có ngày giờ; không bấm Reset Baseline, pulse, recover hoặc resolve chỉ để quay lại.
- Nếu cần rehearsal live mới, yêu cầu owner duyệt riêng, tạo run mới bằng luồng đã có và ghi ID/ngày riêng. Không gán footage mới cho incident cũ. Không cần bước này để hoàn thiện video dựa trên evidence.
- Phần thời gian chờ có thể cắt dựng nhưng phải ghi rõ đoạn rút gọn và thời gian thực; không dựng trạng thái ALERT/OK giả. Mọi ảnh cũ phải có nhãn ngày ghi.
- Khi thiếu ảnh Datadog đã duyệt, dùng timeline chữ và dẫn đường evidence trong repo private; không giả vờ timeline là screenshot hoặc kiểm chứng mới.
- Owner xem toàn bộ bản xuất để loại credentials, IP, host, email/account, dữ liệu ACN và thông tin cá nhân. Kiểm tra tiếng Việt/phụ đề, link chỉ đọc và quyền truy cập theo hướng dẫn BTC. Chưa upload hay gửi video trong task này.

Lời dẫn kiểm tra ACN **riêng tư**, chỉ sau xác nhận quyền áp dụng: “Đường này là dòng điện lịch sử được nguồn mô tả là đo được; trạng thái và bộ đếm năng lượng do nguồn báo cáo. Bộ đếm có reset; thiếu voltage, power và temperature nên chúng tôi không tự tạo. Đường nối điểm lấy mẫu không khôi phục các phép đo bị thiếu.” Xem [walkthrough](HISTORICAL_LOCAL_MODE.md#private-walkthrough-checklist).
