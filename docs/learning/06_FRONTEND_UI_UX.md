# 06 — Frontend, BFF và UI/UX theo trang

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

## 1. React và Next.js đang chia việc thế nào?

App Router ánh xạ thư mục `src/app`: `page.tsx` là trang, `layout.tsx` là khung chung, `route.ts` là handler HTTP chạy server. RootLayout giữ font, global CSS và metadata. Năm page tương tác có `'use client'`: React giữ state, effect tải dữ liệu, nhận click và render chart. “Client component” không có nghĩa giữ được secret hay không bao giờ có pre render lúc build; việc bảo vệ key nằm ở route server.

`useState` giữ dữ liệu/loading/error/selection; `useEffect` khởi động/cleanup polling; `useCallback` ổn định hàm load; `useRef` ở Incidents giữ selection cho polling mà không làm callback đổi liên tục. Không Redux/Zustand hay React Query. TypeScript interface trong `api.ts` chỉ là compile contract, không validate JSON response runtime.

Nguồn: [apps/web/src/app/layout.tsx:1](../../apps/web/src/app/layout.tsx#L1), [apps/web/src/lib/api.ts:77](../../apps/web/src/lib/api.ts#L77), [apps/web/src/lib/utils.ts:20](../../apps/web/src/lib/utils.ts#L20). `startPolling` defer load đầu bằng setTimeout 0 và dùng setInterval; không khóa request overlap/không abort request cũ trong các trang vận hành. API chậm có thể trả out-of-order; đây là giới hạn chưa test race UI.

## 2. Vì sao có BFF?

BFF = Backend For Frontend, server nhỏ dành cho UI. Browser gọi `/api/v1/...` cùng origin. Next route chọn allowlist, kiểm tra mutation, giữ `NEST_API_KEY` ở server và thêm `x-api-key` khi gọi Nest. Browser không cầm root DB URI hay ingest secret.

Nguồn: [apps/web/src/lib/bff-policy.mts:16](../../apps/web/src/lib/bff-policy.mts#L16), [apps/web/src/app/api/v1/[...path]/route.ts:160](../../apps/web/src/app/api/v1/[...path]/route.ts#L160).

- GET allowlist: health, stations/chargers, latest/states/summary, telemetry history, incidents/detail. Không có arbitrary proxy, ingestion POST hoặc current-averages/activity qua BFF.
- POST chỉ demo trigger/recover/reset và incident acknowledge/resolve. Cần development + loopback Host + Origin cùng Host/protocol + sec-fetch-site phù hợp; production luôn deny.
- Body stream tối đa 8 KiB; chỉ JSONobject/keys cho phép. Trigger index/scenario; recovery cần demoID 12 hex; reset không nhận field. Actor upstream bị thay bằng `local-demo-operator`, không nhận danh tính browser khai báo.
- Key server inject cho mutation, không chuyển cookie/authorization tùy ý. Upstream timeout 10 s, no-store, chặn redirect; lỗi network 502 generic. Strip một số response header kể cả set-cookie.
- `getNestBase` yêu cầu origin HTTP(S) không userinfo; production cần configured HTTPS. GET không có key và không có operator auth.

**Giới hạn:** BFF giảm lộ key và cross-origin browser mutation cho local demo, không là login/RBAC. Bất kỳ người/process có quyền điều khiển local interface trong môi trường này vẫn có thể gọi chức năng demo. Direct Nest POST chỉ check shared key, không cùng production gating của BFF. Backend CORS rộng. Vì vậy không deploy public/tunnel.

### Khác endpoint historical

`/api/historical` là Next route độc lập, không forward BFF. Dev+flag+loopback URL/Host+port+same-origin; alias/speed bounds; pure local reader; output private/no-store; production 403. Raw excluded trace. BFF có logic GET/HEAD allowlist nhưng route file chỉ export GET/POST; không tuyên bố tự implement mọi HEAD method trong proxy. Historical route chỉ export GET, unsupported POST được framework trả 405.

## 3. Trang Overview `/`

[apps/web/src/app/page.tsx:42](../../apps/web/src/app/page.tsx#L42)

Mỗi 6 giây hoặc nút Refresh gọi stationSummary và incidents bằng Promise.all. Loading hiển thị skeleton; lỗi có role alert/Retry, dữ liệu thành công trước có thể vẫn còn trên trang. `lastUpdated` đổi khi fetch thành công, không phải timestamp sensor.

Các tile: freshness (fresh/stale/no signal), cộng average current của charger fresh, activecount dựa average>0,5 A, samplecount cửa sổ. Recharts BarChart dùng summary mean mỗi charger; current null khi không fresh. Freshness dựa `lastSeenAt` và `lastUpdated`, giới hạn 60 s, reject future age<0. UI hiện “Live Current” nhưng nguồn mean mặc định 24 h; một event mới có thể khiến mean cũ được đánh dấu fresh. Không nói đây là instantaneous total current.

Power phụ `240 * totalCurrentA /1000` là DERIVED với giả định, không voltage/power measurement. Capacity/nameplate rating không chứng minh công suất thật. Chart color tham chiếu configuredStatus, còn incident highlight từ activeincident; các tín hiệu có thể khác nhau vì ingest không update asset status.

Giám khảo nên thấy: thiếu/stale hiển thị N/A thay giả 0; nhãn synthetic; activeincident liên kết trang detail. Không nên coi icon Atlas/Datadog trên navbar là health check: đó là nhãn dịch vụ cấu hình.

## 4. Trang Charger Detail `/chargers`

[apps/web/src/app/chargers/page.tsx:40](../../apps/web/src/app/chargers/page.tsx#L40)

Có selector asset; query `?id=` chọn initial charger. Mỗi 7 giây lấy list charger, asset detail/incidents rồi history 24 h limit 100. Local clock làm mới 15 giây để cảnh báo >60 s. Khi đổi charger, xóa data/selection cũ và loading lại; Suspense bọc useSearchParams. Chart Area dùng current, null khi thiếu; table cho provenance/kênh thiếu, trạng thái, nguồn energy.

**Hạn chế chính xác:** API history sort ts tăng, limit 100. UI lấy `history[history.length-1]` là “latestReading”: nếu >100 mẫu thì đó chỉ là cuối **100 mẫu đầu** trong window, không toàn window latest. Nó có thể báo stale dù ở DB có mẫu mới. Ngưỡng stale ở đây dùng clock riêng; Overview dùng lastUpdated. Các async load còn có thể race khi đổi selection; chưa có guarantee cancellation.

Current lấy field gốc đang trả, state badge ưu tiên fieldorigin SYNTHETIC/DERIVED. Nhưng dòng mô tả “Derived by application logic” luôn xuất hiện dù synthetic state — một inconsistencycopy chưa sửa. Power ước lượng 240 V hiện ở operational detail dù historical local chủ ý không tạo power; không được nói “toàn app không hề tính power”. Voltage N/A, temperature chỉ có nếu reading gửi; label kiểm provenance quan trọng hơn màu.

Đây là **VERIFIED IN SOURCE CODE / LIMITATION**, không phải lỗi được testUI phát hiện hay đã sửa. Câu nói đúng: “Bản hiện tại có hạn chế latest/history và display copy; em không dùng chart detail làm bằng chứng latest tuyệt đối khi dữ liệu vượt limit.”

## 5. Trang Incidents `/incidents`

[apps/web/src/app/incidents/page.tsx:42](../../apps/web/src/app/incidents/page.tsx#L42)

Polling 7 giây lấy queue và detail selection; `?selected=demo-58a1983cae09` mở run đã có nếu nó nằm trong queue fetched. Statusfilter ở UI; detail hiển thị scenario/severity/status/evidence/actions. List API default 50: incident cũ ngoài cửa sổ queue có thể không auto select bằng URL, cần fallback evidence/direct read đúng route. Đừng cam kết mọi incident quá khứ luôn thấy bằng selector.

Click row load detail; OPEN có Acknowledge. RESOLVING+có recoveryTelemetryAt mới hiện ResolveIncident. Trang này không có Send Recovery; dùng Demo Control cho thao tác đó trong run mới. Sau action refresh data; error role alert/success role phù hợp. Không browser gọi Datadog API để fetch live monitor; correlation text/lịch sử không là state đang poll.

## 6. Trang Demo `/demo`

[apps/web/src/app/demo/page.tsx:52](../../apps/web/src/app/demo/page.tsx#L52)

Có chọn charger 1–5/scenario, Inject SyntheticFault, Acknowledge Alert, Send Recovery Telemetry, Confirm&Close Incident và ResetBaseline. Request helper ở api.ts gửi JSON; response chỉ nói đã submit telemetry, yêu cầu xem Datadog trực tiếp. Disable loading/điều kiện state giúp tránh click sai, còn backend guard mới thực thi luật.

Activeincident được polling 4 giây **chỉ sau khi state local có ID**. Reload trang xóa activeIncidentId, không tự resume pinned incident từ DB. Không bấm Inject để “load lại” incident đã resolved vì sẽ tạo run mới. Dùng Incidents/evidence cho nghiên cứu run cũ.

Acknowledge→recovery→resolve bắt buộc theo marker. Nếu fail recovery, UI cho retry RESOLVING khi marker chưa có; không gán success copy cho alert delivery. ResetBaseline có side effects đóng activeincident synthetic +5 eventbaseline; task tài liệu không click.

## 7. Trang Historical Local `/history`

[apps/web/src/app/history/page.tsx:1](../../apps/web/src/app/history/page.tsx#L1)

Fetch dedicated route với AbortController/no-store, không gọi `api.ts` BFF. Dropdown 5 session cùng prefix; speeds 60/600/3600. FullselectedLineChartX=sourceEventAt, cursor purple; Play/Pause/scrubber chỉ local state. Source current/state/energy, derived state, hai clocks và counter/gap caveat tách rõ. Session/speed change reset playback. Một label SYNTHETIC ở đây là link sang mode khác, không chứng minh row ACN chứa fault.

Lỗi hash/file/policy có sanitized message, không dump path hay record. Loading ở vùng local; server không cần Atlas. Test policy không là toàn bộ browser E2E; Boolean-onlyQA trước đã kiểm chart/clock/playback/selection, không export screenshot ACN.

## 8. UX và accessibility có trong code

Navbar mobile menu, desktop nav, `aria-current`, focus ring; StatusBadge có text/icon cạnh màu; ProvenanceBadge màu+nhãn; skeleton cho loading; error `role=alert`; table channel có region/tabIndex và arrow scroll; chart ResponsiveContainer. Đây là **source observations**, không chứng nhận WCAG hoặc screen reader usability đầy đủ. Chưa test browser automation rộng/mobile matrix trong task này.

Thay Recharts bằng chart khác vẫn cần giữ semantics missing/null và provenance. Thay polling bằng SSE/WebSocket phải giải quyết reconnect/order/backpressure/auth. Giám khảo: “UI giúp thấy nguồn và tuổi dữ liệu, BFF giấu key nhưng em chưa coi đó là production operator auth.”
