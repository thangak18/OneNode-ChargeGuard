# 07 — Kiểm thử, độ tin cậy và giới hạn

> Đối chiếu tại commit `334afdb`, ngày 19/10/2026. Đây là tài liệu học, không phải lần chạy cloud mới. Quy ước mức bằng chứng xem [hướng dẫn](README.md).

## 1. Cần phân biệt bằng chứng nào chứng minh điều gì

- **Unit test:** kiểm hàm/service trên fixture/mocks; nhanh, không kiểm mạng Atlas.
- **Integration test:** ghép nhiều lớp, HTTP NestJS+driver+mongod local thực; không là Atlas cloud hoặc Datadog intake.
- **End-to-end:** chuỗi từ UI/API đến persistence/observability/operator; Phase D là bằng chứng quan sát thủ công có timestamp, không suitebrowserE2E tự động bao phủ mọi case.
- **Smoke:** vài thao tác xác nhận hệ thống khởi động/đường chính; các script có thể ghi dữ liệu/phát metrics thật nên không tự chạy khi học.
- **Mock:** vật thay dependency để kiểm lời gọi/kết quả điều khiển; không mô phỏng đủ failure modes của service ngoài.
- **Typecheck/build/lint:** kiểm kiểu/biên dịch/quy tắc mã; không chứng minh authorization production, đúng dữ liệu thực hay performance.

## 2. Kết quả chạy lại trong task học — 19/10/2026

**VERIFIED BY TESTS / EVIDENCE:** Node **v24.22.0**, **29 API unit**, **11 API integration**, **4 web policy** PASS; API typecheck/build, web lint/TypeScript PASS. Không chạy mutation Atlas, Datadog smoke/fault/reset, init/seed hoặc phase: d helper. Integration dùng disposablemongod 8.0.16 do mongodb-memory-server khởi động local; observability provider bị override không gửi cloud.

Production web build+actual historical 403 dù flag true,12 tracing manifest không raw đã kiểm chứng ở task finalization ngay trước đó. Trong task học này **DOCUMENTED BUT NOT RE-VERIFIED** cho production build/runtime guard thực tế; policy unit test được chạy lại. Không dựng lại `.next` giữa dev server đang chạy chỉ để lặp evidence.

Test log thô nằm trong `/tmp/chargeguard-learning-checks.out`, không commit; chỉ report counts/result, không source values. Các số Phase D 24/11/2 là checkpoint cũ; sau historical tăng 29/11/4, không phải test cũ sai.

## 3. Inventory test và giới hạn chứng minh

| File / nhóm | Count và nội dung | Không chứng minh |
| --- | --- | --- |
| config.test.ts |8: config Atlas SRV/TLS, schema, provenance, missing sensors | Không thực sự xác thực DB hoặc cert live |
| replay.test.ts |1: fixture gzip, chọn point, deterministicID/clock/reset flags | Không grant dataset hoặc meter accuracy |
| local-history.test.ts |5: hash/alias/bounds, clock/contentID, scope gate, malformed/corrupt gzip, reader không fetch | Không toàn bộ OS sandbox; networkspy chỉ theo `fetch` + review dependency |
| observability.test.ts |6: receiver UDP thực, tags, JSON allowlist, unknown asset, syntheticfault, shutdown/correlation | Packet received local không là US1 intake |
| operations.test.ts |3: generated scenario, dashboard names/tags, monitor config | Không cloud query validation/live status hoặc notification delivery |
| phase-c-endpoints.test.ts |6: service mocks assets/lifecycle/reset/input/activeincident dedup | Không race đa process hoặc distributed transaction |
| api.integration.ts |11: init repeatable, HTTP health/auth/schema, insert/duplicates/conflict, batch, PENDING reconcile, aggregation, lifecycle/fail recovery, error sanitization/metrics calls | Localmongod/overrides, không TLS Atlas, live Agent hoặc browser |
| bff-policy.test.mts |2: route allowlist, local operator policy | Không route body proxy HTTPE2E hay humanidentity |
| historical-policy.test.mts |2: opt-in/dev/loopback/origin/port/normalization | Không kiểm mọi browser/cross-origin vector hoặc full UI render |

Nguồn đại diện: [apps/api/test/api.integration.ts:25](../../apps/api/test/api.integration.ts#L25), [apps/api/test/api.integration.ts:214](../../apps/api/test/api.integration.ts#L214), [apps/api/test/local-history.test.ts:62](../../apps/api/test/local-history.test.ts#L62), [apps/web/test/bff-policy.test.mts:1](../../apps/web/test/bff-policy.test.mts#L1), [apps/web/test/historical-policy.test.mts:1](../../apps/web/test/historical-policy.test.mts#L1).

Count trên là testcases top-level, không tổng assertions. Node integration test chạy realmongod process local, không phải mọi DB call đều mock; DatabaseService wrapper được override để trả db fixture, health ping điều khiển và failAssetLookup dùng giả lỗi. Đừng gọi chúng là “in-memory fake MongoDB không có database engine”.

## 4. Lệnh học và kiểm thử an toàn

Chọn Node 24 trước; từ root. Các lệnh này không load root env để connect Atlas, không gửi telemetry Datadog:

```bash
node --version
npm --prefix apps/api run typecheck
npm --prefix apps/api test
npm --prefix apps/api run test:integration
npm --prefix apps/api run build
npm --prefix apps/web test
npm --prefix apps/web run lint
cd apps/web
npx tsc --noEmit
```

Nếu máy chưa chọn Node 24, wrapper đã dùng: `npm exec --yes --package=node@24 -- sh -c 'node --version && npm --prefix apps/api test'`. npm có thể tải runtime/dependency binary nếu chưa cache. `test:integration` tải mongodb in ary nếu thiếu, nhưng không lên Atlas.

Web production build là `npm --prefix apps/web run build`; chỉ chạy sau dừng dev server dùng cùng output directory để tránh `.next`race. `historical:check` và replay dry-run chỉ dùng file ignored, không cloud; xem câu lệnh 5 file ở[localmode](../HISTORICAL_LOCAL_MODE.md), không inraw.

**Không đưa vào bài tập chạy tự động:** `db:init`, `db:seed`, `smoke:atlas --execute`, `smoke:observability --execute` (kể cả local DB vẫn có thể gửi Datadog), `demo:incident`, phase: d pulse/recover/resolve/reset. `phase:d audit` không ghi Atlas nhưng **ghi evidence file**; `demo:incident` helper cũ ghi đè evidencePhase B và trực tiếp thay DB, khác guardedAPIPhase D. Học bằng đọc code, không chạy lại để “xác nhận” capture.

## 5. Ma trận giới hạn theo mức độ và hành động production

Mức độ là đánh giá **ENGINEERING INFERENCE** cho phạm vi MVP, không CVSS/hardware certification.

| Giới hạn / mức | Ảnh hưởng và vì sao tồn tại | Chấp nhận cho MVP? / nói với judge | Production cần |
| --- | --- | --- | --- |
| Không phần cứng/actuation — Cao cho triển khai thật | Chỉ generate event, không gateway/OCPP | Được nếu gọi đúng prototype | Device auth, protocol gateway, lab/safety, commandack |
| Không operator auth/RBAC — Cao | Shared key + loopback policy; readsnoauth, C OR S rộng | Chỉ local; không public | Identity/session, role/permission, CSRF/rate/audit identity |
| Dataset rights — Cao | Chưa có scope cloud/public/redistribution | Local inspection có điều kiện; synthetic demo độc lập | Grant/applicable terms/retention/privacy |
| 1 prefix/5 session — Vừa | Convenience sample, noofficialstationmapping | Không claim fleet coverage | Authorized distinct station metadata/representative sampling |
| Không heartbeat monitor — Cao cho availability | Count silence không biết agent/service/char charger fail | Nói rõ không offline alert | Expected cadence + lastseen + no-data policy/tolerance |
| Không APM/tracing — Vừa | Có metric/log thôi | Không trace claim | Trace propagation, spans, sampling/redaction |
| Không transaction xuyên write — Cao | Receipt/measurement/incident/action tách | Demo hoạt động/test partial; không exactly-once | Reconciliation/outbox/consistency design |
| PENDING có thể kẹt — Vừa/Cao | Không re insert ambiguous outcome | Chấp nhận fail closed đã giải thích | Retry/reconcile workflow, ownership lease/quarantine |
| Concurrent trigger race — Vừa/Cao | Active find trước insert, nouniquelock | Sequential demo đủ; chưa chứng minh race | Atomic active constraint/lock/requestid |
| Overview mean không instant — Vừa | Summary average bounded window | Nói đúng mean; tránh label instant | Semantics/UIendpointalignment |
| History 100 đầu không latest — Vừa | sortasc+limit rồi UI lấy cuối | Không dùng làm absolute latest proof | Tail query/latest endpoint và pagination |
| Freshness/asyncUI — Vừa | Overview clock theo last success, polling overlap | Hiển thị errors; không production SLA | Clock độc lập, cancel/order guard, retry backoff |
| UDP/gauge stale — Vừa | Không có acknowledgment từ sink; arrival order | Monitoring best-effort | Durable event/outbox, ingest health, cost plan |
| Log sync/rotation 1 backup — Vừa | Dễ forward local nhưng block IO/mất log cũ | Demo nhỏ, allowlist | Async bounded logger, retention, owner access controls |
| TTL 7 ngày — Vừa | Demo small capacity; có thể expired | Evidence và dated fallback; không reset pinned | Policy retention, archive, provisioning verified |
| Trial expiry/judge access — Cao cho hồsơ | Exact expiry chưa biết; personal repo không Read-only col lab | Owner/BTC phải xử lý | Account scope/budget/access planning |
| Chưa load test — Vừa/Cao | Tests functional,5 virtual asset | Không hứa RPS/latency/scalability | Load profile, explain, measurement cost/concurrency |
| Reset bypass lifecycle — Vừa | Tool demo đóng active và baseline | Không dùng làm repair evidence | Administrative permission và riêng audit policy |

Không gọi audit “tamper-proof”: ordinary DB user có write vẫn có thể sửa action; actor labels không xác minh người. Provenance là khai báo kiểm schema, chưa hardware attestation. Agent logs file mode 0644 và directory access cần đánh giá owner ở production; allowlist giúp giảm secrets không thay OS permission review.

## 6. Mất mạng rồi sao?

StartupDBfail→không ready; runtime asset/receipt/query có lỗi sanitized. Không có durable offline queue trong API, không store-and-forward gateway. Client có thể retry cùng ID/fingerprint sau kết nối, nhưng PENDING không measurement cần reconcile. Không hứa mọi mẫu trong outage được phục hồi. Agent/Datadog outage không rollback Atlas; UI và monitor có thể khác nhau.

Những điều này đủ để bảo vệ MVP trung thực: “Em kiểm chức năng và failure paths có kiểm soát; production reliability cần storage/delivery design và đo thêm, không suyra từ 44 testcases.”
