# ChargeGuard — kịch bản quay ngày được chủ sở hữu phê duyệt (CHƯA THỰC HIỆN)

**Trạng thái gốc đã xác minh 23/10:** Judge Run duy nhất `judge-4afc45f4427ab21f48d61c89`, thuộc operator GitHub đã được xác thực và allowlist, charger `demo-charger-01`, **cycle 2 / BASELINE / revision 5**, năm audit actions lịch sử, zero cycle-2 observations. Pinned Phase D incident `demo-58a1983cae09` không được động chạm. Không đưa numeric GitHub user ID hoặc thông tin phiên đăng nhập lên màn hình quay.

## P0: trước buổi quay — chỉ đọc

1. Đối chiếu SHA deployed, nguồn ứng dụng `f19f69f` (hoặc docs-only SHA cùng code), Render health/readiness, Vercel Overview/Chargers/Judge và NextAuth operator. Tính cold-start có thể >20s; không dùng keep-alive.
2. Confirm metadata flags Vercel và Render **đều** `JUDGE_PROD_WRITES_ENABLED=false`, `JUDGE_ROUTES_ENABLED=false`, `JUDGE_REARM_ENABLED=false`; Render `DD_CLOUD_ENABLED=false`. **Không hiển thị secret value.**
3. Dùng GET xem Judge Run cycle 2 BASELINE revision 5, 5 old audit actions, cycle 1 archived `RESOLVED` với 2 SYNTHETIC points, cycle 2 không có observation mới. Đối chiếu 6 collection fingerprints và pinned Phase D với baseline **ở chế độ chỉ đọc**; lưu timestamp.
4. Kiểm tra route ghi đều 403 bằng kiểm tra phủ định đã duyệt/được thiết kế an toàn; không tạo fault, reset hoặc replay.

## P1: xin phê duyệt riêng, giới hạn cụ thể

Trình owner **bằng văn bản** đúng một rehearsal mới trên **run đang có**, cycle 2 rev 5, charger 01. Tối đa **4 POST thành công** `fault → acknowledge → recover → resolve`, với nonce/quota/audit và **tối đa 2 synthetic run-scoped observations**. Không Reset/Re-arm, không update telemetry thời gian thực shared, không đụng Phase D/ACN, không Datadog cloud. Chỉ sau phê duyệt mới điều chỉnh tạm thời **hai gate tương tác** trên **cả Vercel và Render**, xác minh build chạy đúng, đồng thời giữ `JUDGE_REARM_ENABLED=false` và `DD_CLOUD_ENABLED=false`.

## P2: quay một lượt có giám sát (chỉ sau phê duyệt)

| Hành động | Kỳ vọng sau **một** POST thành công | Bằng chứng GET cần ghi |
| --- | --- | --- |
| Fault | `OPEN`, cycle 2, revision **6** | synthetic `0 A / FAULT`, đúng run+charger, audit time/actor |
| Acknowledge | `ACKNOWLEDGED`, revision **7** | một audit action mới, không tạo observation ngoài scope |
| Recover | `RESOLVING`, revision **8** | synthetic `8.25 A / CHARGING` nếu kịch bản hiện hành trả như đã thiết kế, audit time |
| Resolve | `RESOLVED`, revision **9** | audit action cuối, đúng cycle và run |

**Tất cả trạng thái/revision trên là DỰ KIẾN, không phải dữ liệu đã xảy ra.** Sau từng POST: đọc lại từ backend/Atlas, kiểm tra revision, actor và tài nguyên. Nếu 5xx, response mơ hồ, timeouts, lệch cycle/revision hoặc unexpected control: **DỪNG**, tra GET/audit trước, tuyệt đối không POST lại mù.

## P3: Datadog evidence, tách thời gian

Chỉ quay dashboard, fault monitor và Logs Explorer của **`env:dev`, ngày 19/10/2026** sau khi kiểm duyệt account/host/IP/metadata. Không nói monitor này phát hiện Judge event ở cloud ngày quay. `ALERT` chứng minh monitor nhận synthetic fault metric; `OK` có thể chỉ là fault-count window hết dữ liệu, nên cần độc lập đối chiếu MongoDB incident state và recovery observation. `env:prod` tiếp tục không có verified intake.

## P4: shutdown bắt buộc ngay sau quay

1. Đặt **cả ba flags Judge** thành `false` ở **cả Vercel và Render**; giữ `DD_CLOUD_ENABLED=false`, redeploy và xác nhận revision nguồn.
2. Kiểm tra session `canMutate:false`, `canRearm:false` và các POST 403; GET cycle 2 dự kiến RESOLVED revision 9, đúng thêm 4 actions, không có run mới.
3. Kiểm tra Phase D và 6 original collection fingerprints không đổi; ghi nguồn/UTC/timezone; kiểm duyệt clip.
4. **Re-arm là việc khác** cần owner phê duyệt lần thứ hai và review riêng sau shutdown; không tự thực hiện.

**Emergency shutdown:** tắt các cổng ở cả hai provider, xác nhận deployments effective/read-only, ngừng quay, không retry POST, không can thiệp Atlas và không hạ TLS. Nếu không xác minh được shutdown, coi production ở trạng thái cần chủ sở hữu kiểm tra trực tiếp trước khi kết thúc.

## Phương án không cần write mới

Dùng footage read-only hiện tại + tài liệu kiểm chứng production ngày 23/10 và local Datadog ngày 19/10 với nhãn ngày/môi trường riêng. Cách này tránh tiêu thụ quyền rehearsal tiếp theo và đủ cho bản video giải thích, tùy BTC xác nhận.
