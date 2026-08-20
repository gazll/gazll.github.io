# Plan — Topic 27: API Gateway & Identity Edge (+ Blueprint 19)

Trạng thái: **nội dung chưa viết; việc phụ thuộc đã xong.** Cross-ref bấm được
đã ship ngày 2026-08-12 (§8), nên luật "một chủ sở hữu, nhiều con trỏ" ở §4 đã
đứng vững và có thể bắt đầu P1 bất cứ lúc nào. File này là bản thiết kế để điều
tra và thi công; đọc [content-playbook.md](content-playbook.md) cho thao tác
chuẩn và `CLAUDE.md` cho ràng buộc kiến trúc.

---

## 0. Ba quyết định đã chốt

| # | Quyết định | Hệ quả |
|---|---|---|
| 1 | **Một** blueprint. Nội dung nằm ở **topic 27 mới, đặt hẳn trên surface System Design** (`surface: "system-design"`), không vào Study Track | Toàn bộ item của topic 27 là off-track và **phải** được Blueprint 19 claim hết; vòng progress giữ nguyên 365, không người đọc nào bị đổi mẫu số |
| 2 | Chuẩn tải dùng **4 mốc** — 10k · 100k · 1M · 100M req/ngày — chạy xuyên suốt `capacity`, viết dạng **`rps trước, req/ngày trong ngoặc`**, và trở thành **quy chuẩn chung của cả site** | Ghi vào `CLAUDE.md`; mọi topic sau này phán xét công nghệ theo 4 mốc này |
| 3 | Nguồn tham khảo **mở rộng thoải mái**, ưu tiên bản mới nhất + best practice hiện hành | Phải nới allowlist origin trong `tests/system-design.test.mjs`; mọi claim gắn version phải có entry trong `data/content-reviews.json` |

### Đặt trên surface System Design nghĩa là gì

`surface: "system-design"` đưa **cả topic** ra khỏi Study Track — đúng cách
topic 10 và 11 đang chạy. Item vẫn giữ nguyên `item_id`, vẫn nằm trong
`data/topics/`, chỉ khác chỗ hiển thị.

**Được:** vòng progress không đổi (365 giữ nguyên, tổng trên đĩa 406 → 424);
nội dung đọc như một bài thiết kế liền mạch; sửa file topic là blueprint cập
nhật theo; cross-ref từ topic khác trỏ sang vẫn hợp lệ và route
`#/system-design/api-gateway-identity-edge/<id>` vẫn copy link được.

**Mất — cần biết trước:** không có checkbox reviewed, không có notes, không có
badge ESSENTIAL/ADVANCED/EXTRA, không lên thanh filter/stepper, không có nút
EN/VI riêng từng card (bài đổi ngôn ngữ theo switch chung ở header). Phần
`difficulty` vẫn bắt buộc trong schema nhưng **không hiện ra ở đâu cả**.

**Hệ quả trực tiếp: phải viết ít mục hơn.** Mọi item đổ vào một accordion
"Migrated notes" duy nhất trong bài blueprint, không có section header ngăn
cách (`renderSourceNotes` in phẳng theo đúng thứ tự `source_items`). 37 mục như
bản plan trước sẽ thành một danh sách dài vô tận — hiện blueprint nhiều notes
nhất mới có 7. Chốt lại **18 mục**, và đẩy các bảng "tier nào cần config nào"
vào chính `capacity`/`stack`/`tradeoffs` của blueprint, nơi chúng hiển thị
thành decision row đẹp hơn là câu hỏi.

> Nếu sau này đọc thấy dài, tách làm hai blueprint là thao tác rẻ: chỉ chuyển
> id giữa hai mảng `source_items`, không đổi id, không đụng vòng progress.

---

## 1. Chuẩn 4 mốc tải (dùng cho toàn site)

Quy đổi: `avg rps = req/ngày ÷ 86.400`, `peak ≈ 20× avg` rồi làm tròn lên số
kế hoạch. Hệ số 20× không phải mình đặt ra: nó tái hiện đúng con số đã có trong
`11-system-design-cases.the-big-prompts.q13/q15/q16` (1M/ngày ↔ 250 rps peak,
10M/ngày ↔ 2.500 rps peak, 100M/ngày ↔ ~25.000 rps peak) — **giữ nguyên anchor
này**, đừng đặt hệ số khác ở chỗ khác.

| Tier | Peak rps (kế hoạch) | Request/ngày | Avg rps | Hình dạng hệ thống điển hình |
|---|---|---|---|---|
| **T1** | ~2,5 rps | 10k | 0,12 | 1–2 service, 1 DB, 1–2 instance; gateway chỉ là routing |
| **T2** | ~25 rps | 100k | 1,2 | vài service, có cache, 1 DB primary |
| **T3** | ~250 rps | 1M | 11,6 | nhiều service, replica, MQ, multi-AZ |
| **T4** | ~25.000 rps | 100M | 1.157 | shard/cells, regional isolation, blast-radius design |
| *(waypoint)* | ~2.500 rps | 10M | 116 | mốc trung gian đã có trong `q15` — gọi tên khi câu trả lời đổi ở đây |

T1→T3 mỗi bậc ×10; **T3→T4 nhảy ×100 là cố ý** — đó là chỗ hệ thống thôi lớn
lên mà đổi hình dạng (shard/cells, multi-region, thiết kế theo blast radius).
10M/ngày là waypoint nằm trong bậc đó, và là mốc phần lớn người đọc đang tiến
tới, nên cứ nhắc khi câu trả lời đổi ở đó, nhưng **đừng biến nó thành cột thứ
năm** — bốn mốc mới là thứ phải nhớ được.

**Vì sao không có mốc 50M:** 50M và 100M là *cùng một chế độ vận hành* — cells,
regional isolation, blast radius. Khác nhau giữa chúng là số lượng, không phải
kiến trúc, nên thêm cột chỉ tốn thêm một anchor phải giữ nhất quán ở mọi topic
về sau mà không đổi câu trả lời nào. Cách trung thực để mô tả T4 là đọc nó
thành **N bản copy của T3 cộng phần định tuyến**: ~25.000 rps peak ≈ mười cell,
mỗi cell gánh tải cỡ T3–waypoint. Con số per-cell mới là thứ suy luận được; con
số toàn tier chỉ để sizing đội hình. Đó cũng là cách học một quy mô chưa từng
vận hành: nó không phải cỗ máy lạ, nó là hệ mình đã hiểu, nhân lên, cộng luật
cô lập sự cố.

**Cách viết trong `capacity`: rps trước, req/ngày trong ngoặc** —
`250 rps peak (1M req/day)`. Sizing luôn theo peak, còn con số/ngày là thứ
người đọc biết về hệ của mình. Đã thử với `emphasize()`: dạng này ra 2–4 span
`sd-num` mỗi dòng, tỉ lệ toàn site đi từ 0,32 lên ~0,51 — vẫn dưới ngưỡng fail
là 1,0, nhưng đừng để mọi dòng đều có 4 số.

**Bốn phán quyết cho mỗi công nghệ/config**, dùng đúng bốn từ này để bảng nào
cũng đọc được như nhau:

| Phán quyết | Nghĩa |
|---|---|
| `không cần` | chi phí vận hành > lợi ích ở mốc này; thêm vào là nợ |
| `nên có` | rẻ, phòng ngừa tốt, chưa bắt buộc |
| `bắt buộc` | thiếu là sự cố sớm muộn |
| `cần scale riêng` | một dòng config không đủ; phải có thành phần/kiến trúc riêng và người vận hành |

> Peak factor 20× là **heuristic**, không phải hằng số: consumer/campaign
> traffic dồn 10–20×, hệ nội bộ/B2B thường 3–5×. Mỗi mục dùng con số phải nói
> rõ giả định và cách đo, theo §1.4 của playbook.

---

## 2. Topic 27 — cấu trúc

- File: `public/data/topics/27-api-gateway-identity-edge.json` + `.vi.json`
- `key` / topic-key: `27-api-gateway-identity-edge`
- Manifest row: `{ "n": 27, "file": "topics/27-api-gateway-identity-edge.json",
  "topic_type": "design", "surface": "system-design" }`
- `topic_type`: **`design`** — cùng loại với topic 10 và 11, hai topic
  system-design hiện có. Ở surface này `topic_type` không lên thanh filter nên
  nó chỉ còn ý nghĩa phân loại; giữ đồng bộ với 10/11 là hợp lý nhất.
- **Section slug là bất biến** (sinh từ tiêu đề EN, thành một phần `item_id`) →
  chốt tiêu đề trước khi viết dòng nội dung đầu tiên. Trên surface này section
  **không hiện ra** (notes in phẳng theo thứ tự `source_items`), nhưng vẫn nên
  chia đúng chủ đề: đó là thứ giữ file đọc được và cho phép sau này tách
  blueprint mà không đổi id.

| § | Section (EN title → slug) | Items |
|---|---|---|
| 1 | The edge in four sizes → `the-edge-in-four-sizes` | 3 |
| 2 | Gateway configuration that matters → `gateway-configuration-that-matters` | 4 |
| 3 | Identity at the edge → `identity-at-the-edge` | 4 |
| 4 | Authorization without a bottleneck → `authorization-without-a-bottleneck` | 2 |
| 5 | Introducing a gateway into a running system → `introducing-a-gateway-into-a-running-system` | 3 |
| 6 | Internal calls: sync, async, or neither → `internal-calls-sync-async-or-neither` | 2 |

Tổng **18 mục, tất cả off-track**. Study Track giữ nguyên **365**; off-track
41 → **59**; tổng trên đĩa 406 → **424**. Mẫu số vòng progress **không đổi** —
nhưng vẫn cần release note vì đây là một bài mới trên surface System Design.

`meta.json` vẫn bắt buộc đủ `en`/`vi` (label/title/intro/tags) dù surface này
không render chúng ở đâu — validator kiểm, và nếu sau này đưa topic về track
thì đã có sẵn.

### 2.1 Danh sách 18 mục đề xuất

Thứ tự đọc trong bài blueprint = thứ tự khai trong `source_items`, nên viết
theo đúng thứ tự dưới đây.

**§1 The edge in four sizes**
1. `core` — Four traffic tiers: how do you turn 10k/100k/1M/100M requests a day into the peak rate the edge is sized for, and what does one extra hop cost at each tier?
2. `advanced` — At each tier, which edge capability is not needed, worth having, mandatory, or needs its own scaling story?
3. `advanced` — Which signals say a tier boundary has been crossed, before the incident does?

**§2 Gateway configuration that matters** (Spring Cloud Gateway)
1. `core` — The routing model: route · predicate · filter order — what a request really passes through, and where auth sits in that chain.
2. `core` — Timeouts and retries at the edge: how the gateway timeout must relate to downstream timeout and client retry, what a retry budget buys, and why the edge is the fastest place to build a retry storm.
3. `core` — CircuitBreaker and RequestRateLimiter as filters: which parameters actually change behaviour, per-route vs shared instance, Redis token-bucket sizing, the 429 + `Retry-After` contract — with a per-tier verdict.
4. `advanced` — Connection pools and request hygiene: Netty pool sizing, keep-alive, idle eviction, body-size limit, buffering, header allow/deny list, CORS — what breaks on defaults, and what the edge must strip and never trust.

**§3 Identity at the edge**
1. `core` — Who verifies the token: gateway only, service only, or both? What each choice costs and what it leaves open.
2. `core` — JWT verification at the edge: JWKS fetch/cache/rotation, `kid`, clock skew, `iss`/`aud`/`exp` — which of these fails silently, and what verification costs per request.
3. `advanced` — Opaque token + introspection, and passing identity inward: token relay vs a signed internal claim, and why a forwarded identity header must be a trust boundary rather than a convention.
4. `advanced` — Revocation, logout and IdP failure: short TTL vs deny-list vs edge session (BFF), what still serves when the IdP or JWKS is unreachable, key rotation without downtime — per-tier verdict.

**§4 Authorization without a bottleneck**
1. `core` — Coarse at the edge, fine-grained in the service: what the gateway may decide without learning the domain, and where tenant resolution belongs.
2. `advanced` — Where the rules live: roles in the token vs a PDP call (OPA/Cedar), decision caching and the staleness it accepts, and what an authorization audit trail may record.

**§5 Introducing a gateway into a running system**
1. `core` — What belongs at the CDN, the L4 LB, the gateway, the mesh and the service — and what happens when the same control is configured in two of them.
2. `advanced` — The gateway as a single point of failure: HA and N+1 sizing, config as code, route-by-route migration, canary and rollback.
3. `advanced` — Operating the edge: trace propagation, correlation id, RED metrics per route, what a 504 at the gateway actually means, warm-up and connection storms after scale-out (cross-ref `25-microservice.08-operational-concerns.q3`).

**§6 Internal calls: sync, async, or neither**
1. `core` — One decision rule per hop: does the caller need the answer to produce its own response? And REST vs gRPC internally — what actually changes, and when the change is not worth it.
2. `advanced` — Moving a hop onto a queue: what you gain and what you now owe (ordering, dedup, DLQ, backpressure); the latency arithmetic of a three-hop sync chain; why east-west traffic must not pass through the edge gateway.

Năm câu "failure review" của bản plan trước **không còn là item** — chúng thành
`failure_review` của blueprint (§3), nơi chúng vốn thuộc về.

## 3. Blueprint 19 — spec

Thêm vào `public/data/system-design/catalog.json`:

```
n: 19
slug: "api-gateway-identity-edge"
category: "foundations"        # mô tả category đã đúng: "traffic path + controls under load"
effort: "60 min"
source_items: [đủ 18 id của topic 27, theo thứ tự đọc ở §2.1]
```

Ràng buộc nội dung (test + validator khoá cứng):

- Đủ **EN và VI** cho: `title`, `excerpt`, `scope`, `diagram_title` + 7 list
  `functional`, `quality`, `capacity`, `data_model`, `stack`, `tradeoffs`, `tags`.
- `data_model` / `stack` / `tradeoffs`: **≥ 3 dòng mỗi cái**, tổng độ dài 3 nhóm
  **≥ 700 ký tự mỗi ngôn ngữ**.
- Dòng trong 3 nhóm đó viết dạng `Tên — mô tả` hoặc `Nhãn: mô tả`;
  `splitDecision()` tách tại `:`/`—` thành nhãn + thân. Không có dấu tách là
  dính chữ.
- Ngân sách tô màu `emphasize()` hiện 0,32 span/dòng, test fail khi ≥ 1. Thêm
  design 19 với `capacity` dày số đưa tỉ lệ lên ~0,5 — vẫn an toàn, nhưng đó là
  ngân sách đã tiêu, đừng để mọi dòng đều 4 số.
- `diagram` là Mermaid, bắt đầu đúng `flowchart TB\n`, cấm `<svg`/`<script`.
- `failure_review`: 5 cặp `question`/`answer` cho **cả hai ngôn ngữ** (theo mẫu
  blueprint 18 — bài này là bài "chọn config" nên rất hợp).

Ánh xạ nội dung:

| Field | Nội dung |
|---|---|
| `scope` | Bài toán: mọi request đều phải authN/authZ trước khi vào hệ; gateway vừa là chỗ gom control vừa là SPOF mới. Câu chốt (thesis) đóng đoạn. |
| `functional` | Route/predicate, authN tại biên, authZ thô, rate limit, circuit breaking, quan sát được, truyền identity vào trong |
| `quality` | Latency budget thêm vào ≤ X ms p99, edge không được là SPOF, IdP down vẫn phục vụ được gì, một route hỏng không kéo route khác, không tin header client |
| `capacity` | **Chạy đủ 4 tier** — instance, connection pool, JWKS/token cache hit, chi phí verify JWT/request, Redis ops cho rate limit, ngưỡng chuyển tier |
| `data_model` | Route/config table · rate-limit counter (Redis) · JWKS + token cache · policy/rule store · audit log |
| `stack` | Spring Cloud Gateway vs LB/CDN vs mesh · Resilience4j · Redis rate limiter · IdP (Keycloak/managed) · PDP (OPA/Cedar) · REST/gRPC/MQ nội bộ |
| `tradeoffs` | Verify ở biên vs ở service · JWT vs opaque+introspection · rule trong token vs PDP · sync vs async cho từng hop · gateway "thông minh" (biết domain) là nợ |

Sơ đồ (phác):

```
flowchart TB
  C[Client] --> CDN[CDN / static]
  C --> LB[L4 load balancer]
  LB --> GW[API gateway: route, authN, limit, breaker]
  GW -. JWKS cache .-> IDP[Identity provider]
  GW -. decision cache .-> PDP[Policy decision point]
  GW --> RL[(Redis rate-limit counters)]
  GW --> S1[Service A] --> DB1[(DB A)]
  GW --> S2[Service B]
  S1 -->|sync gRPC| S2
  S1 -->|async event| MQ[[Message broker]] --> W[Worker]
```

### research.js

Blueprint mới **bắt buộc ≥ 2 research pack**. Đề xuất: dùng lại `reliability`
+ `rate-limiting`, và thêm pack mới **`identity-edge`** (3 section × ≥ 2 mục,
EN + VI, ≥ 2 primary source). Nguồn dự kiến — phần lớn nằm ngoài allowlist hiện
tại nên phải nới theo quyết định #3:

| Nguồn | Origin | Trong allowlist? |
|---|---|---|
| Microsoft — Gateway Offloading / Aggregation patterns | `learn.microsoft.com` | có |
| AWS — API Gateway throttling & usage plans | `docs.aws.amazon.com` | có |
| Google SRE — Handling overload | `sre.google` | có |
| RFC 9700 — OAuth 2.0 Security BCP | `www.rfc-editor.org` | **cần thêm** |
| RFC 8725 — JWT BCP | `www.rfc-editor.org` | **cần thêm** |
| Spring Cloud Gateway / Spring Security reference | `docs.spring.io` | **cần thêm** |
| OpenID Connect Core & Discovery | `openid.net` | **cần thêm** |
| Resilience4j docs | (chốt origin khi viết) | **cần thêm** |
| Open Policy Agent docs | `www.openpolicyagent.org` | **cần thêm** |

---

## 4. Chống trùng — luật "một chủ sở hữu, nhiều con trỏ"

Vấn đề thật: không muốn dư thừa, nhưng cũng không chấp nhận đọc một topic mà
thiếu mất thứ senior bắt buộc phải biết. Hai nỗi lo đó không loại trừ nhau —
chúng chỉ cần tách ra hai loại "trùng" khác nhau.

**Trùng có hại:** lặp lại *cơ chế* — cùng bảng tham số, cùng danh sách bẫy,
cùng ví dụ. Sửa một chỗ là chỗ kia sai, và người đọc không biết bản nào mới.

**Trùng có ích:** cùng một công nghệ, **câu hỏi khác nhau**. "Circuit breaker
có ba trạng thái nào, tham số Resilience4j nào quan trọng" (topic 25, phía
service) và "đặt breaker ở gateway thì per-route hay dùng chung, open thì trả
gì" (topic 27, phía biên) là hai câu phỏng vấn khác nhau, không phải một câu
viết hai lần. Với tài liệu ôn phỏng vấn, gặp lại một khái niệm ở ngữ cảnh khác
còn là cách nhớ tốt nhất.

### Ba mức xử lý

| Mức | Khi nào | Viết gì |
|---|---|---|
| **Chủ sở hữu** | Topic sở hữu cơ chế | Giải thích đầy đủ: cách hoạt động, tham số, bẫy, ví dụ. Đúng **một** nơi |
| **Nhắc lại đã áp dụng** | Topic khác *dùng* khái niệm đó để ra quyết định | ≤ 3 dòng, dạng **quyết định trong ngữ cảnh này** ("ở gateway: breaker theo route, không dùng chung instance; open → 503 + fallback tĩnh"), rồi `(id)` trỏ về chủ sở hữu. **Không** chép cơ chế |
| **Chỉ con trỏ** | Chỉ cần biết là có tồn tại | Một `(id)` trong câu |

Mức 2 chính là thứ trả lời nỗi lo "đọc mỗi topic này thì hụt": người đọc **vẫn
có câu trả lời tại chỗ** cho ngữ cảnh đang học, chỉ là không có bản giải thích
cơ chế lần thứ hai. Mà câu trả lời phỏng vấn vốn phải theo ngữ cảnh, không phải
đọc lại định nghĩa.

### Có xoá được mục trùng không

**Không xoá.** `item_id` là khoá đã lưu trong Sheet (`progress`, `notes`,
`study_log`) — xoá là mồ côi tiến độ và ghi chú của mọi người đọc, kể cả của
mình.

Thứ "xoá" thật sự làm được là **giữ id, viết lại mục thành dạng con trỏ**
(tóm tắt 2–3 dòng + `(id)`). Chỉ dùng cho trùng lặp *thật* — cùng câu hỏi, cùng
góc nhìn, không thêm gì. Và nhớ hai cái giá: người từng học mục đó mất phần
chiều sâu họ đã đọc, còn mẫu số vòng progress **không giảm** — mục vẫn là một
card phải tick. Một vòng progress đầy card cụt còn tệ hơn là chồng lấn một chút.

Trong đợt này, rà xong thì **không có mục nào đạt chuẩn "trùng thật"**. Gần
nhất là `13-security-oauth2.designing-the-auth-system.q1` (SSO + gateway) —
nhưng nó trả lời từ phía IdP/service, còn topic 27 trả lời từ phía biên. Giữ cả
hai, mỗi bên nói phần của mình, cross-ref hai chiều.

### Bảng phân chia cho topic 27

| Chủ sở hữu hiện tại | Topic 27 viết gì (mức 2 hoặc 3) |
|---|---|
| `13-security-oauth2.designing-the-auth-system.q1` (SSO + gateway) | Mức 2 — contract tại biên: ai verify, cache gì, truyền identity vào trong ra sao |
| `13-security-oauth2.designing-the-auth-system.q2` (mTLS), `q6` (RBAC/ABAC) | Mức 3 |
| `13-security-oauth2.jwt-tokens.q2/q3`, `keycloak-in-practice.q2/q4` | Mức 2 — chỉ phần xảy ra *ở gateway* (JWKS cache, kid, skew) |
| `25-microservice.01-cascading-failure-retry-storm.q2/q3/q5/q6` | Mức 2 — tham số cấu hình tại gateway + thứ tự filter; cơ chế vẫn ở topic 25 |
| `25-microservice.08-operational-concerns.q3` (autoscaling + gateway) | Mức 3, từ §5.3 |
| `25-microservice.10-...q2` (sync vs async boundary) | Mức 2 — quyết định theo từng hop + phán quyết theo tier |
| `10-system-design-rate-limit.rate-limiting-in-depth.q5` (limit ở tầng nào) | Mức 2 — tham số của filter tại gateway |
| `04-rest-grpc-webflux.protocols.q2` (REST vs gRPC) | Mức 2 — chọn protocol theo hop, không so sánh lại |
| `12-architecture-patterns.*` (Gateway pattern) | Mức 3 |

Trước khi viết mỗi mục, chạy:

```bash
grep -o "JWKS\|introspection\|token relay\|RequestRateLimiter" public/data/topics/*.json \
  | grep -v '\.vi\.json' | sort | uniq -c
```

---

## 5. Ràng buộc phải sửa đồng thời

| File | Sửa gì |
|---|---|
| `public/data/manifest.json` | Row `{ "n": 27, "file": …, "topic_type": "design", "surface": "system-design" }`. **Không** dùng `system_design_items` — validator cấm khai cả hai trên cùng một row |
| `public/data/meta.json` | Block `"27"` đủ `topic_type`, `key`, `en`, `vi` (label/title/intro/tags) |
| `tests/system-design.test.mjs:112` | `movedRows.map(row => row.n)` deepEqual `[10, 11]` → **`[10, 11, 27]`** |
| `tests/system-design.test.mjs:117` | `expected.length` 41 → **59** |
| `tests/system-design.test.mjs:236` | `sourceNotes … length` 41 → **59** |
| `tests/system-design.test.mjs` (allowlist origin) | Thêm các origin ở §3 |
| `public/data/system-design/research.js` | `assignments['api-gateway-identity-edge']` + pack `identity-edge` |
| `public/data/content-reviews.json` | Entry cho mọi mục có claim gắn version (Spring Cloud Gateway, Resilience4j, OAuth/JWT BCP) |
| `public/data/release-notes.json` | 1 row mới, newest-first, EN + VI; `kind: "feature"`, `target: "system-design"`. Nói rõ: **vòng progress không đổi (365)**, đây là bài blueprint thứ 19 |

> Test khoá **tập off-track == tập `source_items`**, khớp từng id. Nghĩa là
> mọi mục viết ra trong topic 27 phải được liệt kê trong `source_items` của
> blueprint 19 — quên một id là fail, thừa một id cũng fail.

---

## 6. Thứ tự thi công (3 pha)

Khác bản trước: vì topic 27 off-track hoàn toàn, **không thể ship nửa vời** —
mọi item tồn tại đều phải được blueprint claim, nên blueprint phải ra đời cùng
pha đầu.

**P1 — Khung + blueprint chạy được (§1–§2, 7 mục).**
Tạo `27-*.json` + `.vi.json` với 2 section đầu, row manifest (`surface`), block
meta, design 19 với `source_items` = 7 id đó + đủ 7 list EN/VI + diagram,
research assignment, nới allowlist, sửa 3 con số trong test (41 → 48,
`movedRows` → `[10, 11, 27]`). Sau pha này **bài đã đọc được thật** — đây là pha
chốt slug section, sau đó không đổi được nữa.

**P2 — §3–§4 (6 mục).** Append vào file topic + append id vào `source_items`
theo đúng thứ tự đọc; cập nhật 41 → 54. Bổ sung `failure_review` (5 cặp) khi đã
có phần identity.

**P3 — §5–§6 (5 mục) + hoàn thiện.** Cập nhật 41 → 59, rà `capacity` cho đủ 4
tier, viết release note, cập nhật `content-reviews.json`.

Mỗi pha kết thúc bằng:

```bash
node tools/check.mjs
node tools/audit-content.mjs --dense --refs
cd public && python -m http.server 8080     # xem thật, bấm EN/VI
```

---

## 7. Cần điều tra trước khi viết (phần bạn làm)

1. **Version hiện hành** — Spring Boot / Spring Cloud release train đang dùng,
   tên artifact gateway (bản mới đã tách `server-webflux` / `server-webmvc`),
   Resilience4j, Java LTS. Mọi con số version phải verify tại thời điểm viết
   rồi ghi vào `content-reviews.json`.
2. **Con số thật cho `capacity`** — chi phí verify một JWT (RS256 vs ES256, có
   cache vs không), throughput một instance gateway, số Redis ops cho một lần
   rate-limit check. Kèm workload + phần cứng, nếu không có thì viết thành
   *quy trình đo* chứ không phải hằng số.
3. **Peak factor cho từng loại sản phẩm** — xác nhận 20× dùng cho consumer, và
   ghi rõ khi nào dùng 3–5×.
4. **T4 trông như thế nào trong thực tế** — phần bạn nói chưa rõ. Blueprint bắt
   buộc phải trả lời được: một cell gồm những gì, gateway fleet mỗi cell bao
   nhiêu instance, IdP/JWKS đặt ở đâu khi có nhiều region, định tuyến người
   dùng vào cell bằng gì, và hỏng một cell thì bao nhiêu phần trăm người dùng
   thấy. Viết `capacity` theo **số per-cell**, kèm số toàn tier để sizing.
5. **Chốt phạm vi PDP** — có đưa OPA/Cedar vào không, hay chỉ dừng ở "roles
   trong token + service tự quyết". Ảnh hưởng 1 mục §4 và 1 dòng `stack`.

---

## 8. Cross-ref bấm được — **ĐÃ LÀM** (2026-08-12)

Luật ở §4 chỉ đứng vững nếu con trỏ dẫn được tới nơi cần đến. Trước hôm nay thì
không: `renderMarkdown` không xử lý `(topic-key.section.qN)`, người đọc thấy
chuỗi id thô 40–50 ký tự và phải tự đi tìm — trong khi site đã có **359
cross-ref mỗi ngôn ngữ** (718 cả EN+VI) ở dạng chữ chết.

Đã ship:

| File | Thay đổi |
|---|---|
| `public/lib/cross-ref.js` | **Mới.** `crossRefResolver({content, systemDesign})` → `(id) => {href, label}` hoặc `null`. On-track → `#/track/<id>`; off-track → `#/system-design/<slug>/<id>` qua `designForSourceItem`; không tra được → `null` |
| `public/lib/markdown.js` | `renderMarkdown(md, options)` — tham số **tuỳ chọn** `resolveRef`. Không truyền = hành vi cũ y nguyên. Linkify chạy *sau* khi tách code span, và forward qua đệ quy `:::deep` |
| `app/components/study/QuestionCard.vue` · `app/pages/system-design/[slug].vue` | Truyền resolver ở card câu hỏi, nút EN/VI từng card và notes trong bài blueprint |
| `public/styles.css` | `.xref` gạch chân **chấm** — con trỏ nội bộ nhìn khác link ra ngoài |
| `tests/cross-ref.test.mjs` | **Mới**, 9 test |
| `tools/validate-content.mjs` | Nay kiểm cross-ref **cả trong `.vi.json`** |
| `public/data/topics/05-db-core-index-lock.vi.json` | Sửa 1 ref hỏng do test mới bắt được |

Kết quả hiển thị:

```
(→ Safe retries: jitter and retry budgets)
```

thay cho `(25-microservice.01-cascading-failure-retry-storm.q5)`. Label lấy từ
câu hỏi đích theo ngôn ngữ đang đọc, cắt ở 60 ký tự tại ranh giới từ; id vẫn
nằm trong `title` để hover ra xem được.

Bốn quyết định đáng nhớ:

1. **Resolver là tham số, không phải import trong markdown.js.** Renderer giữ
   nguyên tính thuần: không có resolver thì không có link. Nhờ vậy 4 call site
   cũ và mọi test cũ không phải đổi một dòng nào.
2. **Không link trong `<pre>` và `<svg>`** — ở đó id là dữ liệu mẫu hoặc chữ
   trong diagram, chèn `<a>` vào là sai markup. Trong `<table>` thì có link (18
   ref đang nằm trong bảng).
3. **Không link trong `` `code` ``** — id trong backtick là đang *trưng ra*, không
   phải đang *trỏ đi*.
4. **System Design load lười.** Trước khi nó load, ref trỏ tới item off-track
   trả `null` → in ra như cũ. Thà không có link còn hơn link gãy. (26 ref đang
   trỏ tới item off-track.)

Bug phát hiện kèm: `05-db-core-index-lock.transactions-mvcc-locking.q6` bản VI
trỏ tới `...rewriting-the-query-reshaping-model.q2`, thiếu chữ `the`. Nó sống
sót lâu nay vì `validate-content.mjs` chỉ quét cross-ref trong file EN. Đã sửa
cả ref lẫn validator.

### Còn treo: 26 ref trỏ tới item off-track

Trên tổng 718 cross-ref, có **26 ref trỏ tới item đã off-track**. Route của
chúng nằm trong `catalog.json`, mà `SystemDesign` thì load lười — nên khi người
đọc đang ở Study Track và chưa mở System Design lần nào trong session, resolver
trả `null` và 26 ref đó hiện ra dạng chữ như trước. Không gãy, chỉ là chưa
thành link.

Cách sửa: gọi `SystemDesign.load()` chạy nền ngay sau khi `Content.load()` xong.
Giá phải trả là **một fetch `catalog.json` thêm lúc boot** cho mọi người đọc, kể
cả người không bao giờ mở System Design. Còn một điểm nữa cần lưu ý nếu làm:
card render một lần lúc dựng topic, nên nếu load nền về đích *sau* lần render
đó thì ref vẫn là chữ cho tới lần render kế — muốn chắc thì phải re-render, mà
re-render lại đụng `stopDsaPlayers`/`mountDsaPlayers`.

**Chưa làm, chờ quyết.** Con số 26 sẽ tăng khi topic 27 ra đời (topic 27 nằm
hẳn trên surface System Design), nhưng ref *trỏ vào* topic 27 chỉ xuất hiện khi
mình chủ động viết chúng từ topic khác — nên cân nhắc lại lúc kết thúc P3 là
hợp lý.
