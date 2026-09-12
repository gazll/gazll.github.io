# TODO — follow-up biên tập còn mở trong `docs/research/`

Rà ngày 2026-09-12. Toàn bộ 46 unit trong `docs/research/units/` đã
`INTEGRATED` (nghiên cứu xong, nguồn đã thẩm định), nhưng mỗi record còn mục
*Proposed follow-up changes* với các ô `[ ]` — đây là **những đề xuất sửa nội
dung chưa được áp dụng vào `public/data/`**. File này gom tất cả lại một chỗ,
nguyên văn (408 mục trong 37 unit), để rà một lượt trước khi quyết định số phận thư mục research.

Cách rà: với mỗi dòng, chọn một trong ba —
- **làm** → sửa nội dung theo `docs/content-playbook.md`, tick `[x]` ở đây
  *và* ở record gốc;
- **bỏ** → gạch (`~~…~~`) kèm một cụm lý do (lỗi thời / đã có ở topic khác /
  không đáng);
- **để sau** → giữ nguyên.

Khi file này hết ô trống thì `docs/research/` chỉ còn giá trị tra cứu nguồn
(605 dòng source ledger) — lúc đó mới bàn xoá hay giữ. Xoá file này khi xong.

Đã biết trước một mục đã làm hôm 2026-09-12: topic 27 *"Replace the local
Spring Cloud Gateway 5.0.2 wording…"* — kiểm bằng Maven Central, đã pin 5.0.3
/ 2025.1.3 (`11ae645`).

## Doc này làm gì, và nên rà gì trước

File này **không thêm việc mới** — nó chỉ là 408 dòng `[ ]` đang nằm rải trong
37 record research, gom lại theo unit để bạn đọc một lượt thay vì mở 37 file.
Mỗi dòng là một đề xuất mà người nghiên cứu unit đó thấy nội dung live còn
thiếu hoặc nói quá; nguồn cho từng đề xuất nằm ở bảng *Sources* của record
gốc (đường dẫn ghi dưới tên unit).

Không rà tuần tự từ trên xuống. Chia theo **loại việc**, vì chi phí và rủi ro
khác nhau hẳn:

| Loại | Nhận ra bằng | Bao nhiêu | Rà thế nào |
|---|---|---|---|
| **Sửa cho đúng** — câu live đang khẳng định quá tay hoặc lỗi thời | bắt đầu bằng *Replace / Remove / Mark / Qualify / State that / Separate* | ~67 | **Rà trước.** Đây là nơi có claim sai đang hiển thị. Mở câu hỏi live, đối chiếu với nguồn trong record; đa số là sửa một câu, giữ nguyên `id`. |
| **Liên kết** — trỏ sang topic đang là chủ sở hữu | bắt đầu bằng *Link / Cross-ref / Move … to* | ~4 | Rẻ: thêm `(item-id)` theo rule "one owner per mechanism". Làm gộp theo từng cặp topic. |
| **Thêm** — ví dụ, workload card, checklist, failure test | bắt đầu bằng *Add / Include / Provide / Extend* | ~84 | Đắt nhất và dễ làm mục dài ra vô ích. Chỉ làm khi câu trả lời hiện tại thật sự không trả lời được câu hỏi phỏng vấn; còn lại gạch bỏ với lý do "đủ rồi". |
| Khác | — | ~252 | Đọc từng dòng. |

Thứ tự unit, nếu muốn có kết quả sớm: **27, 10, 13, 20, 28** (gateway,
overload, security, observability, lock) — nhiều mục *sửa cho đúng* nhất và là
những topic hay bị hỏi "bạn sẽ làm gì bây giờ"; sau đó **19** (24 mục, phần lớn
là trình bày DSA) và **26, 14, 21**; case study để cuối vì body là bài lưu trữ,
chỉ *guide* mới sửa được.

Ba việc **không** làm trong đợt rà này: không xoá item (`id` là khoá Sheet),
không điền `reviewed_at` cho unit chưa đọc lại, và không sửa body case study
ngoài việc bỏ link chết.

## Topics — Study Track — 326 mục

### 01-java-core-jvm — 10 mục

`docs/research/units/topics/01-java-core-jvm.md`

*Proposed follow-up changes*

- [ ] Keep all 27 IDs, but add a visible “Java SE guarantee versus HotSpot/OpenJDK implementation detail” label to the four sections.
- [ ] Replace `<1 ms` pause diagrams and “major GC” shorthand with qualified collector-specific wording.
- [ ] Mark escape-analysis flags, TLAB details, treeification thresholds, and object-layout statements as JDK-build implementation details; provide a diagnostic alternative.
- [ ] Add a small workload card to q3/q4/q6: JDK/vendor, heap/live set, allocation rate, CPU quota, memory limit, target p99/p999, and measurement method.
- [ ] Add the VT failure boundary: cheap task admission does not remove DB/HTTP/file descriptor/cpu limits; include JFR pinning and JDK 24 scope.
- [ ] Add a monotonic-clock/deadline example and a clock-jump failure test.
- [ ] Add a direct-memory/RSS/cgroup troubleshooting checklist and explicitly state NMT coverage limits.
- [ ] Replace “CHM faster than Hashtable” with “different synchronization/operation contracts; compare under the target access pattern”.
- [ ] Link q1/q4/q5 to `23-java-concurrency-coding` without duplicating implementations; link API retry/timeouts to `15`/`17`.
- [ ] Apply the remaining collector, diagnostic, benchmark, and cross-reference refinements symmetrically to EN and VI; the Batch G changes above are already integrated.

### 02-java-8-25-java-vs-go — 11 mục

`docs/research/units/topics/02-java-8-25-java-vs-go.md`

*Proposed follow-up changes*

- [ ] Replace the release prose with a table that labels each feature `final`, `preview`, or `implementation/vendor-specific`; remove the unverified JDK25 JEP count.
- [ ] Correct “record = immutable” to “shallowly immutable carrier; deep immutability is the component’s responsibility”.
- [ ] Qualify Java 8 adoption and LTS statements with vendor/support/distribution/date.
- [ ] Add migration gates for removed modules, strong encapsulation, agents, reflection, serialization, JDBC drivers, container limits, and preview flags.
- [ ] Remove unsupported cost/velocity/company claims and insert the comparison workload card.
- [ ] Rewrite q1 goroutine versus VT as a contract table: scheduling, blocking integration, cancellation/context, stack/memory, pinning/cgo, and downstream bulkheads.
- [ ] Replace fixed goroutine stack and “millions” claims with “implementation-dependent; measure”.
- [ ] Keep Native Image benefits but add metadata/build-time-init failure cases, PGO representative-workload requirement, and a native-image test gate.
- [ ] Label Valhalla as a current project/unknown rather than a shipped Java 25 feature; distinguish FFM final in JDK 22 from future Panama work.
- [ ] Explain records/sealed/patterns as ADT-like modeling, including open-world/serialization/evolution limits.
- [ ] Mirror every status and qualifier in the VI file before integration.

### 03-spring-boot-deep-build — 13 mục

`docs/research/units/topics/03-spring-boot-deep-build.md`

*Proposed follow-up changes*

- [ ] Add a version banner: target Java/Boot/Spring/Hikari/JDBC/database versions; mark Boot 4 and Spring 7 examples separately from Boot 3.
- [ ] Change q2/q3 to “proxy mode by default” and explicitly distinguish imperative thread-bound transactions from reactive context.
- [ ] Keep the `REQUIRES_NEW` pool formula/example, but label it a resource-allocation bound, not a recommendation for normal pool size.
- [ ] Move generic Saga/Outbox definitions to topic 09; keep q5’s crash-window explanation and Spring-specific `@TransactionalEventListener` semantics.
- [ ] Replace cache annotation “defaults” with provider matrix: local/shared, TTL, eviction, serialization, invalidation, `sync`, stampede, tenant key, and failure behavior.
- [ ] Update auto-configuration metadata for Boot 3+/4 and add a condition-report/debugging method.
- [ ] Replace Maven/Gradle speed claims with a build measurement table covering graph, plugins, repository, cache, configuration cache, and CI.
- [ ] Make Hikari q9/q13/q14 numeric values illustrative only; add `replicas × pool`, nested-connection, DB max-connection/process, and failover-headroom formulas.
- [ ] Add driver/database source links for MySQL 8.4, PostgreSQL current, and Oracle 26ai only if those are the pinned targets; otherwise mark the DB-specific answer unresolved.
- [ ] Add Hikari session-state leakage tests and state that pool reset does not undo arbitrary SQL/session variables.
- [ ] Expand q10 testing into a boundary matrix and link to topic 26.
- [ ] Add ObjectMapper DTO/projection and payload/PII regression guidance; never silently promise that entity serialization is safe.
- [ ] Apply the remaining provider matrices, pool formulas, cache/serialization details, and cross-reference refinements symmetrically to EN and VI; the Batch G changes above are already integrated.

### 04-rest-grpc-webflux — 11 mục

`docs/research/units/topics/04-rest-grpc-webflux.md`

*Integration record (Batch C scope)*

- [ ] Broader non-Batch-C cleanup below remains a follow-up audit, not an unverified claim of completion.
- [ ] Remove the universal gRPC size/throughput multiplier and replace it with a reproducible benchmark contract.
- [ ] Reframe “REST outside/gRPC inside” as a common topology with browser, public API, proxy, streaming, and organizational exceptions.
- [ ] Qualify `422`, server push, HTTP/1.1 connection behavior, and versioning statements by RFC/convention/version.
- [ ] Rewrite pagination around total ordering, cursor opacity/expiry, mutation consistency, arbitrary-jump needs, and index design.
- [ ] Correct “cold publisher” to explain cold/hot Reactor sources and lazy assembly/subscription.
- [ ] Add a WebFlux-versus-VT matrix tied to blocking dependency, event-loop policy, streaming/backpressure, debugging, and downstream bulkheads.
- [ ] Add gRPC deadline propagation/cancellation and flow-control crash windows; link network retry/idempotency to topics 15/17.
- [ ] Replace GraphQL “DataLoader mandatory” with batching/query-cost/cache controls and explicit N+1 failure evidence.
- [ ] Add contract-first CI steps: schema lint, breaking-change check, generated client compile, provider/consumer contract, and runtime integration.
- [ ] Mirror all protocol modal language in VI; no public content is edited by this dossier.

### 05-db-core-index-lock — 1 mục

`docs/research/units/topics/05-db-core-index-lock.md`

*Integration record (Batch D scope)*

- [ ] The broader local audit of every schema/lock recommendation remains a follow-up; Topic 06 owns distributed topology and Topic 18 owns plan-level optimization.

### 06-db-scaling — 1 mục

`docs/research/units/topics/06-db-scaling.md`

*Integration record (Batch D scope)*

- [ ] The broader local audit of every topology command, managed-service default, and restore/failover drill remains a follow-up.

### 07-sql-nosql-db-engines — 1 mục

`docs/research/units/topics/07-sql-nosql-db-engines.md`

*Integration record (Batch D scope)*

- [ ] The broader comparison of every listed engine's current version and cost/performance fit remains a follow-up.

### 08-message-queue — 17 mục

`docs/research/units/topics/08-message-queue.md`

*Expansion pass (Batch N slice, 2026-08-23)*

- [ ] The multi-tenant blueprint still needs its own fairness/tenant-cost integration review; this q2 change is the canonical broker primitive only.
*Proposed follow-up changes*

- [ ] Start with the four delivery/effect boundaries and define exactly-once by boundary.
- [ ] Replace Rabbit/Kafka personality slogans with workload contracts and failure-domain tables.
- [ ] Add explicit producer, broker, consumer, and business-effect crash matrices.
- [ ] Separate queue flow control (`prefetch`, poll, unacked, lag) from application concurrency and DB capacity.
- [ ] Add an order example with aggregate key, partition/queue scope, version check, stale-event handling, and replay.
- [ ] Add a DLQ/quarantine runbook: error class, owner, retention, replay authorization, schema check, and age alert.
- [ ] Add schema evolution examples for Protobuf/registry and state that policy/version is deployment-specific.
- [ ] Link Outbox and Inbox to topics 09/25 and Case 15 rather than restating their complete patterns.
- [ ] Apply all wording changes to EN and VI together after the canonical outline is approved.
*Open questions and falsifiers*

- [ ] Which broker/version is the example deployment targeting, and which defaults are intentionally pinned?
- [ ] Is the primary workload command/task, durable domain event, replayable analytics, or ordered aggregate stream?
- [ ] What is the tolerated message loss, duplicate cost, max lag/oldest age, and replay window?
- [ ] Which external effects are included in the claimed delivery guarantee, and what idempotency/reconciliation exists outside the broker?
- [ ] What is the DLQ owner, retention, redrive authorization, and maximum acceptable age?
- [ ] What would falsify “at-least-once plus idempotent consumer” for a particular operation? No stable business identity, no durable dedup/reconciliation, or an irreversible side effect with no provider contract would require a different product/transaction choice.
- [ ] What would falsify the Rabbit/Kafka selection? A benchmark under the actual message size, replication, consumers, retention, and failure SLO that contradicts the assumed workload should replace the heuristic.

### 09-distributed-tx-fintech — 11 mục

`docs/research/units/topics/09-distributed-tx-fintech.md`

*EN/VI parity and proposed follow-up changes*

- [ ] Keep all question IDs and answer order identical.
- [ ] Replace “Saga ensures data integrity” with “coordinates local transactions toward a declared desired state under eventual consistency.”
- [ ] Mark TCC/seat-hold equivalence as an analogy and list Try/Confirm/Cancel requirements.
- [ ] Preserve the double-entry and money representation material, but link provider-specific guarantees and legal/compliance scope rather than generalising them.
- [ ] Add metrics and test cases from the coverage matrix in both languages.
*Open questions and falsifiers*

- [ ] Should the public title change while the local key remains stable? If search/index metadata is coupled to the title, do that only in the later integration pass.
- [ ] Which provider contract should the final example use? Stripe and Adyen have different idempotency details; provider-neutral pseudocode may be safer.
- [ ] What is the project’s actual reconciliation SLA for payment, inventory, and booking? Without it, “eventual” is not an operational contract.
- [ ] Is 2PC actually available in the target databases/drivers and operated by a recovery owner? If not, remove code-like 2PC guidance and retain it as a bounded comparison.
- [ ] What is the retention window for late retries and callbacks? If it exceeds the proposed idempotency TTL, the recommendation is falsified until a durable reference is added.
- [ ] Can the ledger authority prove a zero-sum posting invariant under crash/replay? A failing property test falsifies any “exactly once money movement” wording.

### 10-system-design-rate-limit — 20 mục

`docs/research/units/topics/10-system-design-rate-limit.md`

*Expansion pass (Batch J slice, 2026-08-23)*

- [ ] Broader non-Batch-J cleanup below remains a follow-up audit.
- [ ] Replace generic capacity numbers with an assumption table and a measurement exercise; retain `86,400` as the arithmetic constant.
- [ ] Add an algorithm contract box: key, authority, clock, burst, response, atomicity, expiry, failover, and allowed overage.
- [ ] Mark RFC 2697/2698 as marker specifications and RFC 6585 as the 429 status source; label RateLimit headers as draft/version-sensitive.
- [ ] Amend the Redis example with script blocking, same-slot requirement, asynchronous replication, hot-key behavior, and a failure policy.
- [ ] Separate `rate`, `quota`, `concurrency`, `backpressure`, and `load shedding` into a decision table with metrics.
- [ ] Add a retry budget and ambiguous-outcome example for `429`/timeout; cross-link idempotency instead of implying the limiter solves duplicates.
- [ ] Keep the cache race and domain examples, but use “recommendation” labels and require revalidation for correctness-critical mutations.
- [ ] Add a crash-window table and test plan covering failover, clock skew, resharding, queue overflow, and cache invalidation loss.
- [ ] Update EN and VI together; preserve all `item_id` values and keep code identifiers/header names unchanged.
*Open questions and falsifiers*

- [ ] Which limiter authority and failure policy does the target application actually need: local best-effort, Redis with bounded overage, gateway service, or a strongly consistent quota service?
- [ ] What is the maximum acceptable overage during failover, and can the business reconcile it after the fact?
- [ ] Are the target commands idempotent? If not, what prevents a retry after a timeout from performing the business action twice?
- [ ] What is the trusted proxy chain for IP-based keys, and how are NAT/shared-IP users treated?
- [ ] Which Redis version/client and cluster topology will the final code target? Script/function behavior and defaults are version-sensitive.
- [ ] What measurements would falsify the recommendation? Examples: p99 decision latency exceeds the endpoint budget, key skew makes one shard hot, a failover loses more accepted tokens than the policy allows, or cache invalidation delay exceeds the domain freshness bound.
- [ ] If the service cannot enforce fencing/version checks at the authoritative resource, the “lock/cache/limiter preserves correctness” recommendation must be downgraded to an overload optimization.
*Gate status*

- [ ] Final version/provider choice approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.

### 11-system-design-cases — 17 mục

`docs/research/units/topics/11-system-design-cases.md`

*Expansion pass (Batch K/M slice, 2026-08-23)*

- [ ] Remaining q1/q11/q13/q14/q19/q20 state-table expansion stays queued until the corresponding payment/booking ledger is reviewed as one unit.
*Proposed follow-up changes*

- [ ] Add a compact “invariant -> authority -> projection -> failure recovery” answer frame before q1.
- [ ] Add a per-prompt metadata line for workload, freshness, duplicate tolerance, and recovery owner.
- [ ] Replace absolute queue/cache/lock/2PC wording with scoped provider/version language.
- [ ] Add explicit `UNKNOWN`, `PENDING`, `COMPENSATING`, `RECONCILIATION_REQUIRED` transitions to q1, q11, q14, and q20.
- [ ] Add provider/version callouts to upload checksums, presigned URLs, Kafka EOS, Redis failover, redirect semantics, and OAuth.
- [ ] Add failure tables for q2, q5, q10, q13, q14, q19, and q20; keep the other prompts concise.
- [ ] Add security/testing prompts to q3/q9/q10 and an invariant assertion to q12.
- [ ] Link full mechanisms to topics 08, 09, 16, 25 and Case 15 rather than repeating explanations.
- [ ] Apply the same structural changes to EN and VI only after the content outline is approved.
*Open questions and falsifiers*

- [ ] What freshness budget does each product case actually promise for search, feed, typeahead, and analytics?
- [ ] Which cases need exact global rate limiting, and what bounded overshoot is acceptable during a partition?
- [ ] Which upload provider and region are the examples targeting? The resumable session lifetime, checksum, and URL behavior are provider-specific.
- [ ] Are q13/q14 intentionally OTA examples or should they be linked to topic 16 as the single OTA canonical context?
- [ ] What compliance/privacy baseline should the payment, notification, upload, and trace examples assume?
- [ ] What would falsify the recommendation to keep a state local? A measured invariant requiring cross-resource atomicity, a provider contract that already supplies a stronger guarantee, or a workload where the local authority cannot meet the stated SLO should trigger a redesign.
- [ ] What would falsify the recommendation to use at-least-once plus idempotency? A named downstream contract that cannot tolerate replay and offers no durable deduplication or reconciliation path; then the case must state the loss/latency trade-off explicitly.

### 13-security-oauth2 — 18 mục

`docs/research/units/topics/13-security-oauth2.md`

*Proposed content changes (not applied)*

- [ ] Replace “OAuth authentication” wording with “OAuth authorization; OIDC authentication” throughout EN/VI.
- [ ] Make Authorization Code + PKCE the default public/browser flow; cite RFC 9700 and the newly published RFC 10017, while leaving provider compatibility as an open question.
- [ ] Add a token-validation checklist: trusted issuer, allowed algorithm, signature/key, `typ`, `iss`, `aud`, `exp`, `nbf`, clock skew, scopes, and resource ownership.
- [ ] Split JWT, opaque token, BFF/session, DPoP, and mTLS into a decision matrix rather than presenting JWT as the default answer.
- [ ] Mark all Keycloak endpoints, role mappers, token exchange, and Spring authority conversions as version/provider examples.
- [ ] Add refresh-token rotation/reuse detection, JWKS single-flight/unknown-`kid` recovery, and IdP outage behavior.
- [ ] Replace “secure browser storage” absolutes with a threat-model table covering HttpOnly cookie/BFF, in-memory SPA state, and Web Storage risks.
- [ ] Add negative test cases for algorithm confusion, wrong issuer/audience, key rotation, replay, mass assignment, SSRF, deserialization, and cross-tenant access.
- [ ] Separate encryption-at-rest, key management, application authorization, retention/deletion, and immutable audit into independent controls.
- [ ] Update EN and VI together, preserving all 28 IDs and code identifiers.
*Open questions and falsifiers*

- [ ] Is the target browser architecture a direct SPA, BFF, server-rendered app, native app, or a hybrid? This determines storage and PKCE guidance.
- [ ] Which IdP/Keycloak version, Spring Security version, signing algorithms, issuer topology, and regions are in scope?
- [ ] What is the maximum acceptable revocation window for access and refresh tokens, and how is emergency revocation performed during IdP/JWKS outage?
- [ ] Are service-to-service callers workload identities, OAuth clients, user-delegated calls, or all three?
- [ ] Which domain actions require resource-level authorization/fencing beyond token scopes?
- [ ] What would falsify the JWT recommendation: key rotation cannot meet outage bounds, revocation latency exceeds the risk window, token payload confidentiality is required, or audit shows browser script exposure is unacceptable?
- [ ] What would falsify the policy-cache recommendation: stale policy permits a prohibited write, policy version cannot be observed, or recovery after a policy-store outage is not testable?
*Gate status*

- [ ] Target IdP/Keycloak/Spring/browser architecture and version approved.

### 14-devops-k8s-best-practices — 21 mục

`docs/research/units/topics/14-devops-k8s-best-practices.md`

*Proposed follow-up changes*

- [ ] Rename the “2026 best practices” section to a dated “current principles reviewed on 2026-08-23” heading and attach versions to all examples.
- [ ] Add a Kubernetes version/distribution preface; pin current docs and mark alpha/beta feature gates.
- [ ] Replace “StatefulSet for DB/Kafka” with “identity/storage controller; use an operator/managed service and verify data safety.”
- [ ] Add Gateway API versus Ingress selection and implementation-conformance caveat.
- [ ] Add a probe state machine and termination timeline: readiness, endpoint state, preStop, SIGTERM, drain, grace, SIGKILL.
- [ ] Add resource requests/limits, PodDisruptionBudget, topology, autoscaling, and connection-pool assumptions to rollout examples.
- [ ] Make service-mesh mTLS, app authz, policy availability, and non-meshed traffic separate rows.
- [ ] Add image digest/signature/provenance admission and secret-mount examples; avoid claims that scan/provenance alone is sufficient.
- [ ] Add collector backpressure/self-observability and high-cardinality rules.
- [ ] Add expand-contract/migration failure cases and DB-specific lock examples; make drop operations an explicit later phase.
- [ ] Update EN/VI together without changing 17 IDs.
*Open questions and falsifiers*

- [ ] Which Kubernetes distribution and version, ingress/Gateway controller, runtime, mesh, CI provider, registry, and database versions are in scope?
- [ ] Is the target application stateless, stateful-but-replicated, or a controller? Who owns backup/restore and data failover?
- [ ] What are the actual rollout capacity, startup, request-tail, connection-drain, collector-volume, and migration lock budgets?
- [ ] Which controls are mandatory by regulatory/region requirements (KMS, audit, data residency, signing, separation of duties)?
- [ ] What would falsify the “progressive rollout” recommendation: no representative traffic, no trustworthy user SLI, insufficient spare capacity, or rollback that is not schema-compatible?
- [ ] What would falsify the “mesh mTLS” recommendation: unsupported protocols, incomplete workload coverage, CA rotation outage, policy latency, or inability to authorize at the resource boundary?
- [ ] What would falsify an expand-contract migration: old binary cannot tolerate the expanded schema, backfill saturates the primary, lock/replication lag exceeds budget, or rollback requires destructive DDL.
*Gate status*

- [ ] Target versions/distribution/controller/mesh/database approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.

### 15-network-i-o-models — 11 mục

`docs/research/units/topics/15-network-i-o-models.md`

*Integration record (Batch C scope)*

- [ ] Broader non-Batch-C cleanup below remains a follow-up audit.
- [ ] Correct HTTP/1.1 persistent-connection wording and qualify HTTP/2 server push/browser support.
- [ ] Rewrite HTTP/3 as “QUIC reduces cross-stream transport HOL” with connection-level congestion and stream-level limits.
- [ ] Scope TLS RTT/0-RTT examples to full/resumed handshakes and TCP versus QUIC; retain replay warning.
- [ ] Remove fixed MVC/VT/Go thread/stack/task numbers; replace with provider/runtime defaults plus measurement fields.
- [ ] Make SSE connection-limit/sticky-session guidance browser/HTTP-version/provider-specific and add resume/shared-pubsub alternatives.
- [ ] Add a layered deadline waterfall and safe-retry matrix, including unknown outcome and idempotency-key handoff to topic 17.
- [ ] Add keep-alive/pool failure table: client, LB, server, NAT, DB/provider timeout and validation ownership.
- [ ] Keep C10K as a historical/resource-model explanation, not a capacity claim.
- [ ] Update gRPC efficiency wording to use payload/serialization/flow-control benchmark scope; link to topic 04.
- [ ] Mirror all qualifiers in VI; no public data changes are applied.

### 16-project-concurrency-whiteboard — 7 mục

`docs/research/units/topics/16-project-concurrency-whiteboard.md`

*Open questions and falsifiers*

- [ ] Which OTA supplier/GDS contract should the example assume for hold expiry, booking idempotency, and late ticketing success?
- [ ] Is controlled overbooking a permitted product policy, and what compensation/reaccommodation authority owns the risk?
- [ ] What are the target search/book ratio, supplier p99, hold duration, connection count, and WebSocket offline retention?
- [ ] Which limiter failure mode is acceptable: fail closed, bounded regional overshoot, or degraded local budget?
- [ ] Which Java target is used by the project? This changes the wording for virtual threads, structured concurrency, and pinning.
- [ ] What would falsify the recommendation to use conditional writes over a long-held lock? A supplier API that requires a lease protocol, a measured transaction pattern that cannot meet hold latency, or an invariant spanning an external resource may justify a different protocol.
- [ ] What would falsify the “WebSocket plus status cursor” recommendation? A product contract with no offline/replay requirement and a verified loss-tolerant notification class; otherwise the live channel alone is insufficient.

### 18-query-optimization — 1 mục

`docs/research/units/topics/18-query-optimization.md`

*Integration record (Batch D scope)*

- [ ] The broader local audit of provider-specific optimizer behavior, pool sizing, and plan-regression operations remains a follow-up.

### 19-dsa-leetcode — 24 mục

`docs/research/units/topics/19-dsa-leetcode.md`

*Proposed follow-up changes*

- [ ] q1: keep six steps, replace universal interviewer claims with a recommendation, and add invariant/proof checkpoint.
- [ ] q2: define windows by predicate monotonicity and retain the negative-number counterexample.
- [ ] q3: state LC 30 equal-word-length/lowercase constraints, n/m/w, duplicate counts, offsets, and runtime assumptions.
- [ ] q4 and visual q1: state sorted/order/functional-graph preconditions.
- [ ] Prefix q1 and visual q7: justify numeric type and sentinel prefix.
- [ ] Top-K q2 and visual q10: compare sort, heap, quickselect by streaming, memory, order, ties, and worst case.
- [ ] Answer-search q3 and visual q3: write the feasibility predicate and boundary invariant before the loop.
- [ ] Graph q4 and visual q13/q14: correct DFS/BFS wording, qualify Dijkstra, and state representation/recursion assumptions.
- [ ] DP/backtracking q5 and visual q11/q15: separate enumeration from state reuse and output-sensitive cost.
- [ ] Stack/deque/interval q6 and visual q5/q6/q8: add endpoint/duplicate semantics and amortized proof sentence.
- [ ] Tree q7 and visual q12: keep global BST bounds, trie alphabet, and recursion warning.
- [ ] Bit q8 and visual q4/q7/q14: remove the 5–10x benchmark and unsupported JDK-history anecdote; add JLS/Unicode/API qualifications.
- [ ] Cross-link distributed top-K to topic 25 and preserve all 27 EN/VI IDs.
*Open questions and falsifiers*

- [ ] Which Java baseline is the learning target: 17, 21, 25, or language-neutral algorithms? A JDK claim is falsified for this dossier if the target baseline differs materially.
- [ ] Are all string questions intentionally ASCII/lowercase, or should the topic teach code points and user-perceived characters?
- [ ] What maximum n, graph depth, output size, and memory budget should examples assume? Recursion is falsified as a default if input exceeds call-stack budget.
- [ ] Should ties in top-K, intervals, BST duplicates, and output lists be deterministic?
- [ ] What would falsify the six-step interview recommendation? Consistent local interview evidence showing it harms time or communication would change the recommendation.
- [ ] What would falsify a sliding-window solution? A generated negative-value/non-monotone counterexample violating its stated invariant.
- [ ] What would falsify answer-space binary search? A feasible predicate with multiple feasible regions or an unprovable boundary.
- [ ] What would falsify a benchmark? Changed JDK/CPU/input distribution, insufficient warm-up, allocation/GC confounding, or unreported output-cost differences.
- [ ] What would falsify the canonical split? A later dossier whose primary subject is algorithmic proof rather than distributed/object ownership, or the reverse.
*Gate status*

- [ ] Editorial changes integrated into public/data.
- [ ] Browser/content validation run after a future integration change.

### 20-observability-sre — 20 mục

`docs/research/units/topics/20-observability-sre.md`

*Proposed content changes (not applied)*

- [ ] Replace “three pillars” as a rigid rule with “signals chosen by question,” adding profiles/events/business correctness where useful.
- [ ] Add a versioned OTel context/semantic-convention note and explicit messaging links/batch/fan-out rules.
- [ ] Add a signal-cost/cardinality/retention worksheet with region/provider assumptions.
- [ ] Keep RED/USE but state that SLOs may be freshness/correctness/queue-age/business outcomes, not only HTTP availability.
- [ ] Mark 99.9%/43m12s and burn-rate thresholds as 30-day/example calculations; add request-based counterexample.
- [ ] Add a multi-window alert table with traffic floor, owner, runbook, action, and “monitoring pipeline down” handling.
- [ ] Add telemetry crash windows and self-observability for collectors/evaluators/notification paths.
- [ ] Add privacy/cardinality tests and a requirement that trace context is not authorization.
- [ ] Make incident closure require user SLI plus data/security/reconciliation verification and preserve EN/VI parity.
*Integration record (Batch E scope)*

- [ ] The broader audit of every SLI/threshold, provider cost, retention, and current collector configuration remains a follow-up.
*Open questions and falsifiers*

- [ ] What are the actual user journeys and correctness/freshness invariants that should become SLIs, beyond HTTP status and latency?
- [ ] Which OTel semantic-convention version, SDK/collector distribution, backend, region, retention, and sampling policy are in scope?
- [ ] What cardinality, event volume, queue/memory, and telemetry-loss budgets are acceptable per service/environment?
- [ ] How is the alerting/notification path monitored when the primary metrics/log backend is unavailable?
- [ ] Which data is personal, financial, security-sensitive, or subject to deletion/legal hold, and who may access raw telemetry?
- [ ] What would falsify an SLO-based page: insufficient traffic, denominator manipulation, missing critical user flow, or a known correctness failure not represented in the SLI?
- [ ] What would falsify tail-sampling guidance: collector decision latency/memory exceeds budget, errors are dropped before the decision point, or backend cost forces an unsafe retention reduction?
*Gate status*

- [ ] Target telemetry backend, versions, retention, SLOs and alert thresholds approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.

### 21-linux-production-debug — 20 mục

`docs/research/units/topics/21-linux-production-debug.md`

*Proposed content changes (not applied)*

- [ ] Remove or mark unresolved the Netflix attribution; retain the first-minute sequence as repository guidance until a primary source is found.
- [ ] Add explicit host/cgroup/process scopes and PSI/cgroup v2 commands to the first-minute checklist.
- [ ] Replace universal swap/ephemeral-port/TIME_WAIT/tcp tuning numbers with runtime-read commands and version notes.
- [ ] Make the OOM table distinguish kernel OOM, cgroup OOMKilled/137, Java heap OOME, direct/native/metaspace/thread exhaustion, and exit evidence.
- [ ] Replace the 50-70% `Xmx` heuristic with a budget formula plus a clearly labeled starting example.
- [ ] Add JDK 21 impact labels for `jcmd`, heap dump, histogram, JFR and NMT; include PID/user/namespace/disk requirements.
- [ ] Add an artifact handling policy for heap/JFR/pcap files.
- [ ] Add a symptom-to-evidence table and a command rollback/cleanup column.
- [ ] Update EN/VI together while preserving all 8 IDs.
*Integration record (Batch E scope)*

- [ ] The broader audit of every command, kernel version, JDK version, and managed runtime remains a follow-up.
*Open questions and falsifiers*

- [ ] Which Linux distribution/kernel/cgroup mode, container runtime, Kubernetes version, JDK vendor/version, and cloud instance family are in scope?
- [ ] Is the service CPU-bound, I/O-bound, network-bound, or dependency-bound under the incident workload? What baseline/SLI proves it?
- [ ] What is the allowed diagnostic pause, artifact size, retention, access group, and cleanup deadline for dumps/profiles/pcaps?
- [ ] Which sysctl/FD/port settings are managed by systemd, image, node, or platform, and which are actually changeable?
- [ ] What would falsify the `Xmx`/native-memory budget: cgroup OOM with stable heap, direct-buffer/thread/metaspace growth, or JDK/runtime detection mismatch?
- [ ] What would falsify the network diagnosis: packet evidence contradicts application errors, failures are destination/zone-specific, or retries hide the original reset/timeout?
- [ ] Which primary source should replace the unresolved Netflix attribution, if the attribution is important enough to keep?
*Gate status*

- [ ] Target kernel/JDK/container/cloud versions approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.

### 22-low-level-design-ood — 8 mục

`docs/research/units/topics/22-low-level-design-ood.md`

*Proposed follow-up changes*

- [ ] Reframe the five-step framework as a communication and invariant workflow, not a universal timed ritual.
- [ ] Add explicit preconditions and complexity assumptions to LRU, limiter, allocator, and TTL examples.
- [ ] Correct the LinkedHashMap/ConcurrentHashMap concurrency wording and state that the examples are process-local unless a shared authority is introduced.
- [ ] Replace “most widely used” and interview-frequency claims with scoped teaching language unless a source is available.
- [ ] Add monotonic/injected time to limiter and TTL code; define cleanup versus validity separately.
- [ ] Add a pattern decision table based on change axis/lifecycle/routing and an anti-overengineering example.
- [ ] Add deterministic fake-clock, property, contract, and targeted-interleaving tests; label jcstress as exploratory stress evidence.
- [ ] Mirror all qualifiers, identifiers, and code terminology in EN/VI; preserve the nine persistent IDs.

### 23-java-concurrency-coding — 10 mục

`docs/research/units/topics/23-java-concurrency-coding.md`

*Proposed follow-up changes*

- [ ] Add proof labels (safety, liveness, ordering, linearizability, visibility) to every exercise.
- [ ] Keep wait/notify code but add close/shutdown and interruption semantics; compare with BlockingQueue contract.
- [ ] Make strict alternation distinguish ordering from fairness and cancellation.
- [ ] Add philosopher lock-order/resource-order proof and starvation trade-off.
- [ ] Clarify ReadWriteLock/StampedLock optimistic-read validation and copy-on-write memory cost.
- [ ] Add CompletableFuture executor choice, exception aggregation, timeout versus underlying cancellation, and shutdown.
- [ ] Correct LongAdder/ABA/lock-free wording and cite API progress limits.
- [ ] Mark StructuredTaskScope JDK 25 preview and JDK 24 pinning change; do not say “never pins”.
- [ ] Correct volatile-counter answer: 20m is possible but not guaranteed; less is possible due lost updates.
- [ ] Add jcstress/linearizability test hooks and mirror all qualifiers in VI.

### 25-microservice — 8 mục

`docs/research/units/topics/25-microservice.md`

*Open questions and falsifiers*

- [ ] Which runtime/provider versions are the examples targeting: JDK, Kafka, RabbitMQ, Redis, database, Kubernetes, and cloud region?
- [ ] Which service is allowed to own retries in each sample, and what is the absolute deadline budget across fan-out?
- [ ] What are the real SLOs, payload sizes, concurrency, tenant skew, replication factor, retention, and failure budget behind the numeric examples?
- [ ] Which cache use cases have a freshness/version contract, and which are explicitly disposable?
- [ ] What is the operational owner and maximum age for DLQ, outbox, reconciliation, job, and stale projection debt?
- [ ] What would falsify “at-least-once plus idempotency” for a given operation? A downstream effect with no stable identity, no durable dedup/reconciliation mechanism, and a loss-intolerant contract requires a different transaction or product decision.
- [ ] What would falsify the modular-monolith-first recommendation? A measured team/deployment boundary, independent scaling/isolation need, or local invariant that cannot remain safely owned may justify decomposition.
- [ ] What would falsify cache-as-derived-projection? A named read contract requiring stronger availability/freshness than the origin can provide; then the authority/replication design must be revisited rather than silently weakening the contract.

### 26-testing-strategy — 21 mục

`docs/research/units/topics/26-testing-strategy.md`

*Proposed content changes (not applied)*

- [ ] Replace any fixed pyramid ratio/“12 mocks” rule with a risk and feedback-cost heuristic.
- [ ] Add an explicit test contract template: purpose, boundary, invariant, fixture, time/randomness, fault, cleanup, evidence, owner.
- [ ] Split unit/fake/real-engine/contract/E2E tests with a table of blind spots and required evidence.
- [ ] Add Spring test-managed transaction/flush/clear/commit examples and version caveats.
- [ ] Add container image/version/parallel isolation and context-cache assumptions.
- [ ] Add virtual-clock/timezone/DST/monotonic tests and race barriers plus repeated-run/stress guidance.
- [ ] Add retry/fault-injection cases for duplicate effects, resource return, compensation and deadline budgets.
- [ ] Add open versus closed load model, coordinated-omission warning, achieved throughput and histogram reporting.
- [ ] Add a no-silent-retry flaky policy with owner, expiry, seed/order/environment capture, and a separate flake metric.
- [ ] Update EN/VI together while preserving all 13 IDs.
*Integration record (Batch E scope)*

- [ ] The broader audit of framework-specific test performance, provider matrices, and mutation/fault tooling remains a follow-up.
*Open questions and falsifiers*

- [ ] Which production DB/broker/IdP/provider versions and deployment topology must the real integration suite cover?
- [ ] What feedback-time budget and risk tiers determine which tests run per change, pre-merge, post-merge, nightly, and before production?
- [ ] Which domain invariants require real commit/unique constraint/lock/fencing/provider idempotency tests?
- [ ] What are the permitted CI parallelism, container resources, test data retention, and secret redaction rules?
- [ ] What would falsify the H2/fake shortcut: a production-only dialect/locking/schema bug, contract mismatch, or false-green migration test?
- [ ] What would falsify the selected load method: arrival model differs from production, achieved throughput is below target, percentile method hides queueing, or load generation becomes the bottleneck?
- [ ] What would falsify the flake quarantine policy: quarantine becomes permanent, the same test hides a product race, or retry rate exceeds the agreed CI budget?
*Gate status*

- [ ] Target framework/database/provider/load-tool versions approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.

### 27-api-gateway-identity-edge — 25 mục

`docs/research/units/topics/27-api-gateway-identity-edge.md`

*Integration record (Batch C scope)*

- [ ] Broader non-Batch-C cleanup below remains a follow-up audit.
- [ ] Retain the four-size arithmetic but label the `20x` multiplier and all capacity breakpoints as assumptions; add burst duration, payload, connection, token, and downstream dimensions.
- [ ] Add a small “edge contract” box: route owner, trusted ingress, identity source, authorization owner, per-hop deadline, retry budget, error contract, and rollback owner.
- [x] Replace the local Spring Cloud Gateway `5.0.2` wording with a pinned release-train note. Verify the selected Spring Boot/Cloud compatibility matrix and server flavor before integration. — đã làm 2026-09-12 (`11ae645`)
- [ ] State that route/filter order is implementation/version-specific and add an effective-chain regression test rather than relying on source/YAML order.
- [ ] Add the timeout/crash-window table, especially upstream mutation followed by response loss and the resulting idempotency/status lookup requirement.
- [ ] Separate JWT, opaque introspection, workload mTLS/SPIFFE, and application authorization into a layered decision table; do not present one as a replacement for the others.
- [ ] Add explicit rules for stripping client identity headers, trusted proxy configuration, direct-ingress testing, token/key rotation, and telemetry redaction.
- [ ] Add local-versus-remote PDP guidance with decision-cache TTL, policy version, rollout, outage, and fail-open/closed choices.
- [ ] Make gateway migration shadow routes side-effect safe and require route ownership, config hash, rollback, and parity metrics.
- [ ] Make async examples include durable acceptance, idempotency, status retrieval, duplicate/out-of-order handling, and operator recovery.
- [ ] Update EN and VI symmetrically while preserving every existing `id` and keeping protocol names/header names unchanged.
*Open questions and falsifiers*

- [ ] Which gateway implementation and release train is in scope: Spring Cloud Gateway WebFlux, Envoy, a managed edge, Kubernetes Gateway API implementation, or a combination?
- [ ] Is the gateway public, private, mesh-local, or all three? What paths can bypass it, and who owns each trust boundary?
- [ ] What are the p99/p999 end-to-end deadline, connection reuse, payload, token mix, and downstream concurrency targets at each traffic tier?
- [ ] Which routes carry mutations where a 504 can mean “committed but unknown”? What idempotency key/status lookup contract exists?
- [ ] What is the maximum acceptable JWT/JWKS, PDP, or policy-cache staleness after revocation or emergency deny?
- [ ] Should IdP/introspection/PDP failure fail closed, serve a bounded cached read, or enter an explicit degraded mode for each route class?
- [ ] What policy language/runtime, bundle delivery, decision cache, and policy version will be deployed? Who can roll it back?
- [ ] What identity headers are accepted internally, and how are direct service ingress, batch workers, and cross-region calls tested?
- [ ] Which Gateway API conformance profile and extensions are required, especially for TLS, cross-namespace routing, authorization, and rate limits?
- [ ] What evidence would falsify the proposed edge boundary? Examples: gateway p99 consumes more than the allocated hop budget, a shared pool failure takes down unrelated routes, stale policy exceeds the risk window, a retry test duplicates a mutation, or a bypass route accepts an untrusted principal.
*Gate status*

- [ ] Final gateway/identity/PDP implementation and release approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.

### 28-distributed-lock-lease — 19 mục

`docs/research/units/topics/28-distributed-lock-lease.md`

*Proposed follow-up changes*

- [ ] Put the authority/resource/failure-model questions before product names; require a named invariant and accepted duplicate/blocked behavior.
- [ ] Add the numbered invariants and crash-window table, especially pause-after-expiry, delayed release, authority failover, and external-write-after-acquire.
- [ ] Split the mechanism table into database transaction/constraint, optimistic conditional write, coordination lock, lease/election, and durable work-claim categories.
- [ ] Strengthen every TTL example with observed hold-time percentiles, renewal margin, monotonic deadline, maximum recovery time, and stale-work fencing.
- [ ] Amend Redis examples with atomic acquisition, random owner token, compare-and-delete, replication/failover scope, and the official-versus-critique Redlock evidence boundary.
- [ ] Amend etcd/Kubernetes/Consul examples to say their lease/session/election can coordinate the authority but cannot stop a stale external writer.
- [ ] Add a concrete resource-side fencing example using a monotonically increasing generation/version or database/object-store precondition.
- [ ] Add a recovery runbook: detect stuck holder, stop/drain old worker, inspect generation, force release only with authorization/audit, replay/reconcile, and verify stale-token rejection.
- [ ] Add tests for GC/CPU pause, network delay/partition, failover, lost responses, late release, renewal race, hot-key contention, starvation, and multi-lock ordering.
- [ ] Update EN and VI symmetrically, preserving every `id` and keeping product/version qualifiers equivalent.
*Open questions and falsifiers*

- [ ] What exact invariant is protected: one row, one object, one scheduler role, one external API operation, or duplicate suppression only?
- [ ] Which component is the source of truth and can it reject stale owner generations/tokens?
- [ ] What are p99/max critical-section time, GC/pause tail, network delay, authority failover time, and maximum acceptable takeover time?
- [ ] Is fairness required, or is throughput/availability more important? What is the maximum queue age/starvation window?
- [ ] Is the deployment one region or multi-region, and what quorum/replication/partition model is actually supported by the selected provider/version?
- [ ] Can every writer use the same condition/lock, including scripts, admin tools, batch jobs, and disaster-recovery paths?
- [ ] What is the policy for an unknown outcome after a timed-out acquire or protected write: query, retry with idempotency, reconcile, or manual review?
- [ ] Who can force release or fence an owner, and how are those actions authenticated, audited, and tested?
- [ ] What evidence would falsify the recommendation? Examples: stale tokens are accepted by the resource, hold/pause tails exceed the renewal budget, authority failover admits two owners, queue age/starvation violates the SLO, or recovery requires unsafe manual deletion.

## Case studies — 82 mục

### 03-tiki-scale-in-10-years — 1 mục

`docs/research/units/case-studies/03-tiki-scale-in-10-years.md`

*Integration record (Batch D scope)*

- [ ] The broader audit of historical definitions, SLOs, cloud scope, and current platform status remains a follow-up; the article's figures remain attributed and source-scoped.

### 05-scale-and-whats-next — 1 mục

`docs/research/units/case-studies/05-scale-and-whats-next.md`

*Integration record (Batch E scope)*

- [ ] The broader audit of current Tiki platform status, partner contracts, and measured operational outcomes remains a follow-up.

### 09-pegasus-catalog-product-api-architecture — 1 mục

`docs/research/units/case-studies/09-pegasus-catalog-product-api-architecture.md`

*Integration record (Batch C scope)*

- [ ] The broader catalog freshness/invalidation audit below remains a follow-up; the historical Tiki measurements are not generalized.

### 10-xac-thuc-va-phan-quyen-trong-microservices — 13 mục

`docs/research/units/case-studies/10-xac-thuc-va-phan-quyen-trong-microservices.md`

*EN/VI parity and proposed follow-up changes*

- [ ] Correct EN `ma-hoa-rsa-cho-jwt`: distinguish JWS signing from JWE encryption and explain RSA algorithm choice only with a named profile.
- [ ] Correct EN `oauth-2`: OAuth 2.0 is authorization/delegation; OIDC is the identity layer.
- [ ] Align VI and EN on issuer/audience/algorithm/type/time validation and service-side authorization.
- [ ] Replace universal JWT performance/revocation claims with the comparison table.
- [ ] Keep ACL/RBAC/PBAC examples but state that ABAC is the NIST term for subject/object/action/environment attributes; PBAC is a broader policy-based architecture label.
- [ ] Add key-rotation/introspection/gateway-bypass/BOLA tests and metrics.
- [ ] Preserve the paired IDs and fix the malformed regex/example quote before content integration.
*Open questions and falsifiers*

- [ ] Which identity provider, issuer set, access-token profile, and resource audiences does the project actually use? Without this, code examples remain protocol-neutral.
- [ ] What is the maximum acceptable stale authorization/revocation window per operation? If it is near zero, a long-lived self-contained JWT recommendation is falsified.
- [ ] Are services directly reachable or only through the gateway? Direct reachability falsifies edge-only authorization.
- [ ] What policy decision latency and attribute source availability are acceptable? If a remote PDP cannot meet the write deadline, policy caching or local enforcement needs redesign.
- [ ] Which claims are PII or tenant-sensitive? If tokens cross more trust domains than expected, claim minimisation and audience separation become mandatory.
- [ ] Can negative tests demonstrate that a valid user token cannot read another tenant/object/property? A BOLA test failure falsifies the authorization model regardless of JWT validation success.

### 11-how-to-handle-hot-deals-at-the-peak-time — 7 mục

`docs/research/units/case-studies/11-how-to-handle-hot-deals-at-the-peak-time.md`

*Open questions and falsifiers*

- [ ] Can the original Tiki Engineering page be manually accessed and version/date confirmed? Until then, detailed local timings remain unresolved.
- [ ] What exactly is the authoritative inventory/quota store and transaction/conditional-write primitive? A non-atomic implementation falsifies the oversell-prevention claim.
- [ ] What are peak RPS, hot-key skew, reservation TTL, and origin capacity? Without them, no queue size, pool size, or replica count is justified.
- [ ] Does the displayed price include tax, fees, currency conversion, and rounding? If not, the price comparison predicate is incomplete.
- [ ] What fairness/anti-bot policy is required? If one actor can consume all admission tokens, a pure FIFO wait-room recommendation is insufficient.
- [ ] What happens after a timeout when admission may have succeeded? If no query/reconciliation path exists, the retry design is unsafe.
*Gate status*

- [ ] Original Tiki source manually verified.

### 12-duplicate-booking-race-condition — 7 mục

`docs/research/units/case-studies/12-duplicate-booking-race-condition.md`

*Open questions and falsifiers*

- [ ] Which Java framework/server version routed HEAD to the GET handler? If it did not, the local causal story needs correction.
- [ ] What database engine/isolation/index/predicate was used? A missing/incorrect unique or conditional predicate falsifies the version-fix claim.
- [ ] Is the GDS API idempotent or queryable by a stable booking reference? If neither, the external side-effect safety claim remains unresolved.
- [ ] What is the business intent key and retention window? If retries outlive the key, a durable reference/constraint is required.
- [ ] Can a two-instance test force both requests through the same session with a crash after provider acceptance? If not tested, “duplicate solved” is only a local race result.
- [ ] Are GET/HEAD requests blocked at CDN, reverse proxy, framework, and service? A passing unit test alone does not falsify an edge routing path.
*Gate status*

- [ ] Framework/database/GDS versions verified.

### 13-how-discord-stores-trillions-of-messages — 17 mục

`docs/research/units/case-studies/13-how-discord-stores-trillions-of-messages.md`

*Integration record (Batch C scope)*

- [ ] The broader storage-engine/version and current-system audit below remains a follow-up; reported Discord numbers stay source-scoped.
- [ ] Add a visible “Discord report, published 2023; metrics around 2022” qualifier to both files.
- [ ] Mark 3.2m msg/s, node counts, p99s, 9-day migration and 99.9999% as reported measurements with hardware/configuration scope.
- [ ] Add a partition/replica/repair/tombstone glossary and failure table.
- [ ] Explain that static bucketing controls partition size but not popularity skew.
- [ ] Add a migration gate: dual write → backfill/checkpoint → shadow compare → staged reads → source cutover → rollback window.
- [ ] Add deletion/privacy/backup/tenant-isolation concerns to the operations section.
- [ ] Keep source-specific facts out of generic “best practice” prose and align EN/VI qualifiers.
*Open questions and falsifiers*

- [ ] Does Discord’s 2023 article still describe the current system? If current architecture matters, a newer first-party source is required.
- [ ] What exact Cassandra/Scylla versions, RF/consistency, compaction strategy, hardware, and partition distributions produced the reported numbers? Without them, benchmark reuse is falsified.
- [ ] What is the maximum partition/bucket size and hot-channel percentile? If the proposed bucket exceeds operational limits, the design fails despite balanced total storage.
- [ ] What deterministic migration verification exists beyond sampled reads? A mismatch in an un-sampled range falsifies the sufficiency of the proposed gate.
- [ ] What deletion/moderation/retention obligations apply to replicas, backups and migration snapshots? If they cannot be enforced, the storage design is incomplete.
- [ ] Can repair and tombstone cleanup complete within the maximum node-outage window? If not, zombie resurrection/latency risk remains unresolved.
*Gate status*

- [ ] Current Discord architecture/source update verified.
- [ ] EN/VI content integration applied.
- [ ] Validation passed after integration.

### 14-small-business-cloud-cost-shock — 17 mục

`docs/research/units/case-studies/14-small-business-cloud-cost-shock.md`

*EN/VI parity and proposed content changes (not applied)*

- [ ] Keep `$312`, Sep–Oct 2025 and the missing line-item/post-optimization caveat identical in EN/VI.
- [ ] Label architecture diagrams as local evidence and assumptions, not billing attribution.
- [ ] Add a cost ledger template: resource, owner, environment, region, usage driver, monthly cost, business unit, shared allocation, action, risk, rollback.
- [ ] Add a TCO table that includes labor, backup/restore, RTO/RPO and incident cost.
- [ ] Replace “one 4-core/8-GB server is enough” with a load/restore-tested hypothesis and explicit failure-domain warning.
- [ ] Add budget/anomaly alert lag, tags/CUR/Cost Explorer and owner/runbook controls.
- [ ] Keep the 90-day plan but turn thresholds into placeholders to be populated from measured unit economics.
*Integration record (Batch E scope)*

- [ ] The broader review of current provider prices, region, line items, and target workload remains a follow-up.
*Open questions and falsifiers*

- [ ] Can the original AWS bill be exported from Cost Explorer/CUR with dates, region, account and line items? Without it, causal cost claims remain unresolved.
- [ ] What is the business unit: active user, request, transaction, or revenue dollar? If undefined, the cost-recovery plan cannot measure value.
- [ ] What RTO/RPO and data-retention obligations apply? If they require multi-AZ/managed backups, a one-server recommendation is falsified.
- [ ] What is the 95th/99th percentile load and database connection/IOPS profile? If one node cannot meet it with recovery headroom, the size hypothesis is false.
- [ ] What is the total GitHub Actions cost/security posture after moving CI/CD? If minutes/artifacts/secrets exceed the removed AWS cost or risk, the substitution is not an optimization.
- [ ] Can a clean environment be recreated and a backup restored within target RTO? A failed drill falsifies “cost-optimized and safe.”
*Gate status*

- [ ] Cost Explorer/CUR line items and target region verified.
- [ ] EN/VI content integration applied.
- [ ] Validation passed after integration.

### 15-transactional-outbox-order-workflow — 15 mục

`docs/research/units/case-studies/15-transactional-outbox-order-workflow.md`

*EN/VI parity and proposed follow-up changes*

- [ ] Preserve all 11 section headings and code identifiers in both files.
- [ ] Add the “repository-authored design example” label near the beginning of both language versions.
- [ ] Make all “same transaction” statements say “same local database.”
- [ ] Rename or explain `PUBLISHED` as a relay observation; consider `RELAYED`/`BROKER_ACKED` if the example needs to distinguish broker acknowledgement from consumer completion.
- [ ] Add a lease/reclaim table for `SKIP LOCKED` relay workers and state the MySQL version/isolation assumption.
- [ ] Keep generic Saga/Outbox definitions short and link topic 09; retain local order transitions and compensation failures.
- [ ] Add status-resource expiry, authorization, terminal failure, and unknown-provider states to the `202` example.
- [ ] Expand the failure test table with provider callback replay, lease expiry, stale/gap queue, schema rollback, and retention-window expiry.
- [ ] Add the operational metrics in both languages and require trace IDs to be non-sensitive.
*Open questions and falsifiers*

- [ ] Which broker and database version should the runnable example target? Without that, SQL and acknowledgement wording remains illustrative.
- [ ] Is the relay claim model a lease, a row state, or a database advisory lock? If no reclaim path exists, the reliability claim is falsified.
- [ ] What is the deduplication/retention window? If a duplicate can arrive after Inbox cleanup, the business effect must still be protected by a durable business key.
- [ ] Is the external provider idempotent? If not, the example needs status inquiry and reconciliation rather than a retry snippet.
- [ ] What is the legal/tenant retention and replay policy? If payload deletion is required, the Outbox/event archive design needs a privacy-safe envelope or redaction model.
- [ ] Can property tests show that every accepted command has exactly one local business transition and one durable intent under crash/retry injection? A failing test falsifies the example’s correctness claim.

### 16-shopify-mysql-inventory-reservations — 1 mục

`docs/research/units/case-studies/16-shopify-mysql-inventory-reservations.md`

*Gate status*

- [ ] Production schema, MySQL patch level, workload traces and RPO/RTO verified.

### 17-ssh-server-hardening-lessons — 1 mục

`docs/research/units/case-studies/17-ssh-server-hardening-lessons.md`

*Gate status*

- [ ] Target OS/OpenSSH/PAM/firewall and actual evidence verified.

### 18-some-simple-economics-of-agi — 1 mục

`docs/research/units/case-studies/18-some-simple-economics-of-agi.md`

*Gate status*

- [ ] Local team task classes, risk tiers, ground truth and real verification metrics supplied.
