# 10 — Lộ trình tự học năm ngày

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

Mục tiêu không phải nhớ tên framework. Đến cuối mỗi ngày, hãy đóng tài liệu và tự giải thích một đường code, một failure mode và giới hạn bằng chứng. Gợi ý 2–3 giờ/ngày, có thể chia nhỏ. Không cần viết lại chức năng hoặc chạy fault/reset để học.

## Ngày 1 — Sản phẩm, kiến trúc và frontend

**Đọc theo thứ tự:** chương 01 → sơ đồA/B/E/F chương 02 → chương 06. Sau đó đọc [apps/web/src/app/layout.tsx:1](../../apps/web/src/app/layout.tsx#L1), [apps/web/src/components/Navbar.tsx:1](../../apps/web/src/components/Navbar.tsx#L1), [apps/web/src/app/page.tsx:42](../../apps/web/src/app/page.tsx#L42), [apps/web/src/lib/api.ts:77](../../apps/web/src/lib/api.ts#L77), [apps/web/src/lib/utils.ts:20](../../apps/web/src/lib/utils.ts#L20), [apps/web/src/app/api/v1/[...path]/route.ts:160](../../apps/web/src/app/api/v1/[...path]/route.ts#L160).

**Tên cần nhớ:** OverviewPage/loadData, api.getStationSummary, request, proxy, isAllowedApiRoute/isLocalOperatorRequest. Học App Router, React state/effect, same-origin và key server-side trước khi nói đến SRE.

**Bài tập không mutation:**

1. Vẽ lại browser→BFF→Nest→Atlas trên giấy và đánh dấu hai nơi có shared key, nơi có DB URI. **Đáp án:** web server NEST_API_KEY; API INGEST_API_KEY; DB URI chỉ backend. Agentkey ở Agent, không browser.
2. Từ title Current Chart, truy ngược dataKey currentA về chartData, summary mean và API call. **Đáp án:** stationSummary mean theo range, không instantaneous measurement.
3. Tìm 6 s/7 s/4 s polling và giải thích tại sao không là SLA. **Đáp án:** chỉ lịch client, còn request/network/evaluation; có overlap.
4. Tự nói pitch 30 s và 1 phút, ghi âm giọng không quay rawdata; nghe lại xem có gọi ACN live hoặc five physical charger không.

**Câu hỏi tự kiểm:** BFF có login không? **Không.** Navbar Atlas/US1 có health probe không? **Chỉ label config.** Missing current có phải 0 không? **Không.**

**Hiểu nhầm thường gặp:** coi TypeScript interface là runtime validation; coi browser client component là nơi giữ key; coi current bar mean là instantaneous. **Sản phẩm cuối ngày:** một sơ đồ và lời giải thích 2 phút, chưa cần đọc mọi CSS class.

## Ngày 2 — NestJS, ingestion và MongoDB

**Đọc:** chương 03 rồi [apps/api/src/main.ts:1](../../apps/api/src/main.ts#L1), [apps/api/src/bootstrap.ts:13](../../apps/api/src/bootstrap.ts#L13), [apps/api/src/app.module.ts:1](../../apps/api/src/app.module.ts#L1), [apps/api/src/telemetry/ingest.guard.ts:1](../../apps/api/src/telemetry/ingest.guard.ts#L1), [apps/api/src/telemetry/telemetry.controller.ts:1](../../apps/api/src/telemetry/telemetry.controller.ts#L1), [apps/api/src/telemetry/telemetry.schema.ts:1](../../apps/api/src/telemetry/telemetry.schema.ts#L1), [apps/api/src/telemetry/telemetry.service.ts:1](../../apps/api/src/telemetry/telemetry.service.ts#L1), [apps/api/src/database/initialize.ts:1](../../apps/api/src/database/initialize.ts#L1), [apps/api/src/analytics/analytics.service.ts:1](../../apps/api/src/analytics/analytics.service.ts#L1).

**Tên cần nhớ:** validate/persist/ingestBatch, stableJson, parseQuery, latest/currentAverages/stationSummary, initializeCollections. Ghi riêng document/BSON Date/timeField/metaField/unique index/TTL/receipt.

**Bài tập:**

1. Dùng JSON SYNTHETIC minh họa trong chương 03, chỉ trên giấy/tài liệu cá nhân, đánh dấu validation path. **Đáp án:** guard trước service; schema field provenance; asset pair lookup; receipt.
2. Đóng file persist, tự viết pseudocode các nhánh COMMITTED/PENDING/fingerprint mismatch. **Đáp án:** duplicate / tìm measurement để reconcile hoặc 409 /409. Không tự retry insert mù.
3. Chạy `npm --prefix apps/api test` và `npm --prefix apps/api run test:integration` trên Node 24. Chỉ file fixture local; không chạy db: init/seed/smoke Atlas. Đọc test “reconcile a previously inserted…” và “failed recovery…”.
4. Tính pipeline bằng tay:6/12/0 cùng bucket→mean 6/samples 3; thêm row missing current có được tính không? **Không ở currentAverages, vì match number.**

**Câu hỏi:** Batch schema hợp lệ thì all or nothing DB không? **Không, sequential writes có partial success.** Granularity seconds=one event/sec? **Không.** TTL là backup? **Không.**

**Sai lầm:** nói unique event telemetry hoặc exactly-once vĩnh viễn; đọc `$lookup` đề xuất cũ thành implementation. **Sản phẩm:** giải thích receipt branch 2 phút và 1 pipeline 2 phút, có file/line.

## Ngày 3 — Observability và incident

**Đọc:** chương 04, [apps/api/src/observability/observability.service.ts:1](../../apps/api/src/observability/observability.service.ts#L1), [apps/api/src/observability/ingestion.middleware.ts:1](../../apps/api/src/observability/ingestion.middleware.ts#L1), [config/datadog/monitors/synthetic-faults.json:1](../../config/datadog/monitors/synthetic-faults.json#L1), [config/datadog/monitors/ingestion-errors.json:1](../../config/datadog/monitors/ingestion-errors.json#L1), [apps/api/src/demo/demo.service.ts:1](../../apps/api/src/demo/demo.service.ts#L1), [apps/api/src/incidents/incidents.service.ts:1](../../apps/api/src/incidents/incidents.service.ts#L1), [apps/api/src/incidents/incident-audit.ts:1](../../apps/api/src/incidents/incident-audit.ts#L1), [docs/evidence/phase-d-e2e.json:85](../../docs/evidence/phase-d-e2e.json#L85).

**Tên cần nhớ:** ingestionRequest/accepted/metric/record/flush; demoReading; triggerFault/recover/acknowledge/resolve; recordIncidentAction. Định nghĩa count/gauge/timer/tag/evaluation window trước dùng.

**Bài tập:**

1. Từ event FAULT hợp lệ, tìm điều kiện tăng metric fault. **Đáp án:** accepted không duplicate và synthetic state FAULT hoặc syntheticfault Code; không temperature threshold.
2. Vẽ hai timeline trên giấy: incident states và monitor count window. Đặt mốc OK khi incident OPEN. **Đáp án:** hợp semantics; bằng chứng original 05:24:44 Z.
3. Tính 166,329711 s và 8,526 s từ mốc evidence; ghi dưới mỗi sốđo nó không chứng minh điều gì. **Đáp án:** internal Datadog latency/hardware repair không established.
4. Mở Datadog nếu owner đã login, chỉ read metric/log/history đã có. Không required cloud access để học: dùng artifact/evidence giữ ngày nếu hết trial. Không chạy observer helper hoặc phase: d audit vì có thể ghi JSON.

**Câu hỏi:** send callback=US1 received? **Không.** actor của acknowledgment là user đã login? **Không.** Bốn charger phải phục hồi cùng không? **Không, recovery chỉ affected charger.**

**Sai lầm:** “72 C làm monitor alert”, “Datadog tạo incident”, “monitor OK tự resolve DB”. **Sản phẩm:** chỉ vào 4 actions và 1 recovery event, thuật lại case không đổi ID/run.

## Ngày 4 — ACN, provenance, quality và tests

**Đọc:** chương 05/07, [apps/api/src/adapters/acn.adapter.ts:1](../../apps/api/src/adapters/acn.adapter.ts#L1), [apps/api/src/adapters/local-history.ts:1](../../apps/api/src/adapters/local-history.ts#L1), [apps/api/src/adapters/acn-permission.ts:1](../../apps/api/src/adapters/acn-permission.ts#L1), [apps/api/scripts/replay-acn.ts:1](../../apps/api/scripts/replay-acn.ts#L1), [apps/web/src/app/api/historical/route.ts:1](../../apps/web/src/app/api/historical/route.ts#L1), [apps/web/src/lib/historical-policy.mts:1](../../apps/web/src/lib/historical-policy.mts#L1), [apps/api/test/replay.test.ts:1](../../apps/api/test/replay.test.ts#L1), [apps/api/test/local-history.test.ts:1](../../apps/api/test/local-history.test.ts#L1), [docs/HISTORICAL_LOCAL_MODE.md:1](../../docs/HISTORICAL_LOCAL_MODE.md#L1).

**Bài tập:**

1. Dùng fixture test, không raw source:0/10/70/130 s với interval 60 phát điểm nào? **Đáp án:**0/70/130, không 10; dựa last emitted.
2. Với elapsed 70000 ms/speed 60, mapped time cách anchor bao lâu? **1166 ms, floor.** Sourceinstant đổi không? **Không.**
3. Viết một bảng fields cho ACN event: current MEASURED, app state DERIVED, sourcestate/energy SOURCE_REPORTED; power/temp absent. Nói rõ fixture tổng hợp không là observation thật.
4. Tìm test hash mismatch/path traversal/permission gate; tự nói là test gì và không phải grant dữ liệu.
5. Owner đọc matrix và inquiry draft; không tự gửi thư, tạo approval JSON hoặc download thêm session. Local history chỉ kiểm tra trên máy riêng và không quay/chia sẻ trace khi chưa quyền.

**Câu hỏi:** hash match=lawful use? **Không.** Five file=five charger? **Không.** Last energy=session total? **Không.** `--execute`gate áp dụng mọi API client không? **Không, chỉ CLI gate.**

**Sai lầm:** tự thêm 240 V và gọi observed power; xem replay clock như ngày ghi; coi education/research terms là toàn quyền hackathon. **Sản phẩm:** so sánh 2 mode trong 1 phút và 1 record fixture transform trong 2 phút.

## Ngày 5 — Luyện phản biện và tổng duyệt

**Đọc:** chương 08/09, [checklist](../SUBMISSION_CHECKLIST.md), [judgeaccess](../JUDGE_ACCESS_PLAN.md), bảng sai khác ở README bộ học. Không chạy lại incident cũ.

1. Luyện pitch 60 s không nhìn notes. Tiếp đó 5 phút với 10 slide outline, cuối 10 phút technical defense. Tự bấm giờ, bỏ câu không giải thích được thay vì đọc rất nhanh.
2. Chọn 10 câu hỏi khó từ chương 09 ngẫu nhiên. Mỗi câu: trả lời 20–40 s, mở file hợp lý, nêu một giới hạn. Nếu quên thì ghi “chưa chắc/cần kiểm tra”, không bị a.
3. Trace request fault từ button đến metric bằng source; không click button. Trở lại persist PENDING và resolve guard nếu judge đào sâu.
4. Rehearsal readonly: show architecture/aggregates, incident dated evidence, monitor e d history có day. Nếu cloud không available, nói fallback rõ. Không lấy screenshot ACN/chưa sanitized vào quay.
5. Rà hồ sơ và các việc owner cần làm: data permission, video/slides, official judge accounts/access model, expiry trial, form/deadline. Không mời user hay gửi form từ bài tập.

**Rubric tự chấm 0–2 mỗi mục:** mô hình 2 mode; data source/provenance; request trace; receipt failure; aggregate/UIsemantics; metric/query; incident/monitor separation; timing honesty; security limits; AIdisclosure.0=không giải thích được,1=nhớ khái niệm,2=chỉ code và nêu giới hạn. Dưới 16/20 nên đọc lại chương yếu; đây là thang luyện của đội, không rubric BTC.

**Kiểm tra cuối:** “Nếu judge chỉ cho em 60 giây và hỏi điều chưa implement, em có thể trả lời chân thật mà vẫn nêu giá trị MVP không?” Đáp án mong đợi: phân biệt kết quả đã có và bước tiếp, nêu evidence thay quảng cáo.
