# Research - System design cases

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `11-system-design-cases`

EN file: `public/data/topics/11-system-design-cases.json`

VI file: `public/data/topics/11-system-design-cases.vi.json`

## Scope and non-goals

This is the case-study and prompt matrix. Its job is to make the same core techniques produce different designs when the invariant, workload, authority, failure cost, and freshness contract change. It is not the canonical tutorial for queues, distributed transactions, cache mechanics, or microservice operations.

The research pass used a broad discovery pool; the candidate count was not exhaustively recorded. The ledger below keeps 41 distinct sources that were inspected and mapped to concrete claims. Search-result pages, duplicate versions of the same document, SEO explainers, and sources that only repeated a generic pattern were excluded. The 200-source pool ceiling is a search allowance, not a target bibliography.

Canonical cross-references:

- [08-message-queue](08-message-queue.md) owns broker mechanics, delivery boundaries, ordering, replay, DLQ, and flow control.
- [09-distributed-tx-fintech](09-distributed-tx-fintech.md) owns local atomicity, Saga, Outbox, TCC, provider idempotency, unknown outcomes, and ledger correctness.
- [25-microservice](25-microservice.md) owns overload, retries, pools, cache, observability, deployment, and idempotency synthesis.
- [16-project-concurrency-whiteboard](16-project-concurrency-whiteboard.md) owns the OTA/project interview framing.
- [../case-studies/15-transactional-outbox-order-workflow](../case-studies/15-transactional-outbox-order-workflow.md) owns the concrete order/outbox crash walkthrough.

## Local content map

The complete EN and VI files were read. They contain one section with twenty-one prompt records; the VI file is a structural companion rather than a separate curriculum.

| Prompt | Local ID | Domain and unique decision | Canonical technique owner |
| --- | --- | --- | --- |
| 1 | `11-system-design-cases.the-big-prompts.q1` | Wallet transfer; double-entry, ledger authority, PSP ambiguity | Topic 09 for mechanism; case-specific ledger application here |
| 2 | `...q2` | Notifications; accepted versus delivered, priority, provider retry | Topic 25 for retry/ops; application trade-offs here |
| 3 | `...q3` | URL shortener; redirect cacheability, mutable aliases, abuse | Topic 25 for cache; HTTP semantics here |
| 4 | `...q4` | Feed; celebrity fan-out and ranking freshness | Application-only prompt |
| 5 | `...q5` | Global rate limit; exact versus bounded approximation | Topic 16 for whiteboard algorithm; scope matrix here |
| 6 | `...q6` | Leaderboard; rank, ties, retention, rebuild | Redis/provider mechanics only by link |
| 7 | `...q7` | Disposable cache; origin authority, stampede, invalidation | Topic 25 for cache mechanics |
| 8 | `...q8` | Chat; per-conversation ordering, offline delivery, E2EE boundary | Topic 08 for stream semantics |
| 9 | `...q9` | Multilingual typeahead; normalization, evaluation, abuse | Application/search scope only |
| 10 | `...q10` | Resumable object upload; capability, checksum, scan, lifecycle | Object-store contract here |
| 11 | `...q11` | Async payment POST; local idempotency, PSP key, 201/202, UNKNOWN | Topic 09 canonical workflow |
| 12 | `...q12` | Generic design review scorecard | This topic's rubric |
| 13 | `...q13` | Travel marketplace; search projection versus authoritative hold | OTA application; topic 16 context |
| 14 | `...q14` | Late PSP success after hold expiry | Topic 09 state/reconciliation; domain policy here |
| 15 | `...q15` | E-commerce scale estimate and architecture | Arithmetic assumptions and trade-offs here |
| 16 | `...q16` | Cells and near-100M/day traffic; authority migration | Application-only prompt |
| 17 | `...q17` | p99 regression diagnosis | Topic 25 observability/resource protection |
| 18 | `...q18` | One fulfillment event, heterogeneous consumers | Topic 08 broker choice |
| 19 | `...q19` | Flash sale admission and hot-SKU capacity | Application-only capacity exercise |
| 20 | `...q20` | Redis loss, expiry, PSP success, reconciliation | Topic 09/25 mechanisms; domain authority here |
| 21 | `...q21` | Review rubric; invariant, authority, evidence and canonical ownership | This topic's rubric |

## What is correct and reusable

- The prompts usually name an invariant before a technology. That is the strongest educational pattern and should be preserved.
- The payment prompts correctly distinguish a local ledger transition, a provider call, an unknown provider result, and reconciliation. A timeout is not proof that the PSP rejected the charge.
- The notification prompt separates acceptance, provider acceptance, delivery, and read state. That prevents a queue acknowledgement from being taught as user delivery.
- The URL prompt correctly separates immutable redirects from mutable aliases and asks for abuse/takedown controls rather than treating the redirect table as only a key-value lookup.
- Feed, chat, typeahead, and upload prompts expose different freshness and ordering contracts. They are useful counterexamples to a single “eventual consistency” answer.
- The upload state machine (`UPLOADING -> PENDING_SCAN -> AVAILABLE/QUARANTINED`) keeps authorization, checksum, malware scanning, and publication as separate boundaries.
- OTA and flash-sale prompts correctly put authoritative inventory/hold state on the critical path while treating search/cache/analytics as projections.
- The scale prompts state enough arithmetic to expose assumptions: `1M/day` is about `11.6 requests/s` average, `10M/day` about `115.7 requests/s`, and `50,000 * 5 / 60` is about `4,167 requests/s` before peak-burst and cache-hit assumptions. These are prompt arithmetic, not production capacity claims.
- The review scorecard covers scope, workload, contracts, authority, failure, operations, security, and trade-offs. It should become the common rubric for the case set.

## Claims to verify or qualify

| Claim or teaching shape | Classification | Scope/limitation to show | Confidence |
| --- | --- | --- | --- |
| A local ledger transaction should be the authority for money | Recommendation grounded in invariant ownership | It is a design choice for the proposed wallet; a lock, cache, or broker cannot replace the ledger constraint. | High |
| A PSP timeout is `UNKNOWN`, not `FAILED` | Fact about ambiguous network observation | The provider may have its own status and idempotency contract; status inquiry and reconciliation are required. | High |
| Outbox plus idempotency solves payment correctness | Over-absolute if left alone | It covers named local boundaries. It does not guarantee PSP completion, consumer side effects, refund policy, or settlement correctness. | High |
| Search results may be stale while a booking hold must be authoritative | Domain recommendation | Exact freshness and hold duration must come from supplier/business contract; no universal staleness budget. | High |
| At-least-once delivery is the normal safe baseline | Scoped recommendation | Some services offer narrower exactly-once behavior, but only within named regions, client modes, or broker/stream boundaries. | High |
| A Kafka key preserves order | Fact with boundary | It co-locates records in a partition; handler concurrency, retries, replays, partition changes, and stale-event rules still matter. | High |
| RabbitMQ is suitable for commands and Kafka for events | Heuristic | Workload, replay/retention, routing, consumer count, ordering, and operator skill decide; either can implement more than the shorthand suggests. | High |
| Redis can be the global rate-limit authority | Conditional recommendation | Exactness depends on topology, replication/failover, clock/TTL behavior, atomic script, and whether bounded overshoot is acceptable. | High |
| `12ms` serialized hold capacity is about `83/s` | Arithmetic inference | It is one serialized worker/resource assumption, not a database benchmark. Include queueing, network, lock, and recovery overhead before capacity planning. | High |
| A resumable upload ETag is a complete content hash | Common false claim | S3 multipart ETags are not generally MD5; use the documented checksum algorithm and finalization response. | High |
| A presigned upload URL is harmless because it is not an API token | Incorrect security intuition | It is a time-limited capability; scope key, method, content constraints, expiry, tenant authorization, and object visibility. | High |
| `202 Accepted` means the payment succeeded | Incorrect | It means the request was accepted for processing; expose a durable status resource and terminal/unknown semantics. | High |
| A queue ACK means the customer received a notification | Incorrect | ACK means the consumer accepted the message under that broker contract; delivery/read requires a provider or client observation. | High |
| 301/308 and 302/307 can be chosen interchangeably | Incorrect | HTTP semantics distinguish permanent and temporary redirects and method-preservation details; cache behavior is also relevant. | High |
| Event sourcing automatically provides an audit trail | Overstated | Replayability depends on immutable, complete, authorized, retained events and separate privacy/audit controls. | High |
| Add a replica or Redis when p99 rises | Anti-pattern | First identify the queue, dependency, pool, lock, GC, cache, and fan-out cause; a new layer can hide overload or amplify it. | High |

## Workload, invariants, and failure model

### Shared decision frame

Every prompt should answer these in order:

1. What must never happen? Examples: negative available balance, double booking, duplicate charge, unauthorized object visibility, or a notification sent after opt-out.
2. Which store and transaction enforce it? Name the authority, unique key/version, and isolation/conditional-write rule.
3. Which data is a projection? Name its maximum tolerated staleness, rebuild source, and invalidation/replay path.
4. What is the largest retry/duplicate/crash window? Include client timeout, broker redelivery, worker crash, provider timeout, and late callback.
5. What does the user see during `PENDING`, `UNKNOWN`, or degraded service? Define an honest API state and repair owner.

### Domain invariant matrix

| Case family | Primary invariant | Usually acceptable to be stale | Strong boundary / recovery |
| --- | --- | --- | --- |
| Wallet/payment | Every posted transfer has balanced entries; one command cannot debit twice | Search, notifications, balance projection | Ledger DB constraint/transaction; provider idempotency/status inquiry; reconciliation |
| Notification | A requested message is policy-eligible and not duplicated beyond declared contract | Provider delivery/read telemetry | Preference check, durable intent, dedup key, provider callback verification, DLQ owner |
| URL shortener | A code resolves according to alias version and access policy | Click counts and analytics rollups | Alias row and redirect semantics; abuse/takedown path |
| Feed | A visible item obeys privacy and ranking contract | Ranking freshness and fan-out lag | Privacy/ACL authority; versioned feed projection; cursor pagination |
| Rate limiter | Admission does not exceed the declared exact or bounded budget | Approximate counters/telemetry | Atomic counter/token decision; explicit overshoot bound and fail-open/closed policy |
| Leaderboard | Rank is calculated from accepted score/version; ties deterministic | Global aggregation during rebuild | Score authority, atomic update, stable tie key, snapshot/rebuild |
| Cache | Cache never becomes the authority for protected money/inventory state | Disposable public/read data | TTL/invalidation/version check; origin fallback and stampede control |
| Chat | Per-conversation order and delivery state are honest | Presence, search index, unread count | Conversation key/partition, durable message ID, cursor/ack, offline retention |
| Typeahead | Query normalization and suggestion policy are consistent | Index freshness and personalization | Locale-aware index contract, abuse limits, measured relevance/latency |
| Upload | Only authorized, verified, scanned objects become visible | Progress and analytics | Capability scope, checksum/finalization, quarantine, lifecycle cleanup |
| OTA/flash sale | A seat/SKU is held at most once for its version/expiry | Search availability and cached price | Conditional hold/lease authority; expiry version; late supplier/payment reconciliation |

### Failure/crash windows that each case should expose

| Window | Bad shortcut | Required teaching outcome |
| --- | --- | --- |
| Client times out after durable command | Generate a new command on every retry | Reuse idempotency key/fingerprint and return the stored state/result |
| DB commits but publish fails | Treat DB success as event success | Outbox/CDC intent, relay retry, age/repair metric |
| Broker accepts but consumer dies before effect/ACK | Assume exactly once from ACK | Inbox/business unique key; redelivery becomes a no-op or explicit conflict |
| Provider call times out | Mark failed and issue a second charge/booking | Preserve `UNKNOWN/PENDING`; inquire/reconcile using stable provider reference |
| Cache/Redis loses state | Treat cached hold/rate token as authority | Re-check authoritative store; fence old workers; choose fail-open/closed by risk |
| Late callback after expiry/cancel | Blindly apply callback | Versioned state transition; refund/release/manual review policy |
| Projection is stale or missing | Serve it as an availability promise | Label freshness and route final decision to authority |
| Retry/DLQ replay after schema or policy change | Replay blindly | Quarantine, compatibility check, authorization, dry-run, bounded redrive |

## Best-practice comparison

| Decision | Option A | Option B | Decision rule for this case set |
| --- | --- | --- | --- |
| State | Authoritative local transaction | Distributed workflow | Keep money/hold invariant local where possible; use workflow for external steps |
| Publication | Outbox/CDC | Direct DB + broker dual write | Use durable intent when event publication is part of the committed business transition |
| Delivery | At-most-once | At-least-once + idempotent consumer | Prefer the latter for recoverable business work; use at-most-once only when loss is explicitly cheaper |
| Event transport | RabbitMQ work queue | Kafka retained partitioned log | Choose by routing/ack/backlog versus replay/retention/partition order, then benchmark |
| Search/feed | Read authority synchronously | Derived index/cache | Use projection for high-volume reads; do not let it promise stock, seat, money, or permission |
| Rate limit | Exact global counter | Per-cell/token approximation | Pick exactness from abuse/financial risk; publish an overshoot and outage contract |
| Upload | Proxy bytes through app | Direct resumable object-store upload | Prefer direct capability when authorization, checksum, scan, quota, and lifecycle remain explicit |
| Payment API | Synchronous completion | Durable async acceptance | Use `201` only for committed resource creation; use `202`/status for unresolved external work |
| Lock | Redis/distributed lease | Database conditional write/version | Treat locks as coordination; enforce invariant at the authority and use fencing/version checks |
| Scaling | Add cache/replica | Diagnose queue/pool/dependency | Measure first; tail latency and retry amplification can make added capacity counterproductive |

## Coverage matrix

| Required area | Local coverage | Evidence/owner | Gap to close before integration |
| --- | --- | --- | --- |
| Definitions | Each prompt names the system and desired result | Local EN/VI question text; RFC 9110/9457 | Add a short glossary for authority, projection, unknown, and durable acceptance |
| Invariants | Strongest in wallet, booking, upload, rate limit, chat | Local prompts; PostgreSQL constraints/locking; Redis docs | Require every remaining prompt to state one non-negotiable invariant |
| Workload | Scale arithmetic, fan-out, hot SKU, average/peak distinction | Local q13/q15/q19; Tail at Scale | Label all numbers as assumptions and add burst/size/tenant distribution fields |
| Failure/crash windows | Payment, outbox, Redis loss, late callback, retry | Topics 09/25 and case 15; AWS Outbox; SRE | Add a per-case “first incorrect assumption” failure table |
| Retries/timeouts | Payment, notifications, client retry, PSP unknown | gRPC deadline/retry; SRE; Stripe/AWS | Add deadline budget, retry owner, jitter, and retry budget to q2/q11/q14/q17 |
| Operations/recovery | DLQ, reconciliation, rebuild, lifecycle, lag | Rabbit/Kafka/S3/GCS/Stripe docs | Add alert owner, threshold, runbook action, and repair authorization |
| Security/privacy | Upload capability, URL abuse, notification consent, trace context | RFC 9700/9457, OAuth, W3C Trace Context, S3 docs | Add tenant isolation, PII minimization, replay authorization, and abuse limits to each relevant prompt |
| Testing | Review rubric and failure cases | Pact, Testcontainers, Chaos Mesh | Turn cases into scenario tests with invariant assertions and crash injection |
| Domain trade-offs | Strong versus eventual examples across 20 prompts | Local matrix | Make “what may be stale” explicit rather than repeating “eventual consistency” |

## Contradictions and limits

| Apparent rule | Counter-evidence or boundary | Final wording |
| --- | --- | --- |
| Exactly-once is impossible | Kafka transactions, Pub/Sub exactly-once, and SQS FIFO offer scoped guarantees | Exactly-once may exist inside a named broker/region/client boundary; it does not automatically extend to arbitrary DB, PSP, email, or human effect |
| Redis is a distributed lock authority | Redis documentation discusses async-replication failover safety limits and fencing tokens | Use Redis coordination only with explicit failure model; protect the resource with fencing/version/authority checks |
| 2PC is always wrong | PostgreSQL/Jakarta/Oracle support prepared/XA transactions; Spanner offers serializable distributed transactions | Compare latency, blocking/in-doubt recovery, participant support, and business need; do not ban or default it universally |
| Search index is just a cache | OpenSearch/Elastic support rich indexed query semantics and pagination | It is a derived query system with its own freshness/rebuild contract, not necessarily a byte cache |
| `ETag` is a checksum | S3 documents multipart ETag/checksum differences; GCS documents CRC32C/MD5 scope | Name the provider and checksum algorithm; verify at finalization |
| Readiness/liveness are interchangeable | Kubernetes removes unready pods from traffic but restarts liveness failures; bad probes can cascade | Use startup/readiness for availability gating and conservative liveness for process health |
| 301/302 only differ in SEO | RFC 9110 defines method and cache semantics | Use the HTTP semantic distinction; SEO is only one consumer |

## Negative evidence and anti-patterns

- Do not copy a generic “microservices + Kafka + Redis” diagram into every prompt. The local authority and failure cost decide whether those components exist.
- Do not call a queue, cache, lock, or read replica the source of truth merely because it is faster.
- Do not retry non-idempotent PSP/GDS operations with a new provider key after an ambiguous timeout.
- Do not use a single global distributed lock as the solution to a ledger or inventory invariant; serialize or conditionally write at the authority instead.
- Do not make notification delivery, search freshness, or analytics completeness a synchronous checkout invariant unless the product contract truly requires it.
- Do not expose an uploaded object before malware/policy scanning just because the checksum passed.
- Do not use an unbounded queue to “absorb” overload; it converts rejection into memory growth and tail latency.
- Do not use `SKIP LOCKED`, TTL, or a scheduled job without a reclaim/rebuild/reconciliation path.
- Do not present one provider's idempotency retention, exactly-once, or cache behavior as a platform-neutral fact.
- Do not use “eventual consistency” as a conclusion without naming the stale read, maximum age, and authoritative retry path.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Keep in this topic |
| --- | --- | --- |
| Rabbit/Kafka delivery, ACK/confirm, replay, DLQ | Topic 08 | One-line selection criteria and domain application |
| Saga, Outbox, TCC, provider unknown/idempotency | Topic 09 | Domain-specific invariant and state choice |
| Retry storm, pool, cache, HPA, tracing, Inbox | Topic 25 | Diagnosis prompt and observed trade-off |
| OTA seat race and interview storytelling | Topic 16 | Prompt-specific context and compare with q13/q14 |
| Concrete order Outbox/Inbox crash matrix | Case 15 | Link only; do not duplicate SQL walkthrough |
| URL redirect status semantics | This prompt family | Keep q3 application; RFC 9110 is evidence |
| Upload capability/checksum/scan/lifecycle | This prompt family | Keep q10 application; provider docs are scope evidence |
| Domain matrix and review rubric | This topic | Canonical role for the catalog |

## Current-vs-proposed content gaps

| Current content risk | Proposed change (not applied) | Evidence/owner |
| --- | --- | --- |
| Similar techniques recur across prompts without an explicit owner | Add a canonical-link line and domain-specific “keep/move” note to each prompt family | Topics 08/09/16/25 and Case 15 |
| “Eventual consistency” can hide the actual user contract | Add authority, allowed staleness, and recovery owner fields | Local prompt matrix; RFC/provider docs |
| Numeric scale examples can be mistaken for capacity benchmarks | Mark them as arithmetic assumptions and add peak/size/tenant distributions | Prompt data; measured system workload still required |
| Payment/upload/hold cases mix provider guarantees with generic rules | Add provider/version/region callouts and explicit unknown states | Stripe, AWS S3, GCS, RFCs |
| Review rubric lacks a mandatory falsifier | Add “what evidence would change this design?” to q12 | Local rubric; SRE/fault-testing sources |


## Integration record (Batch I scope)

Batch I integrated `11-system-design-cases.the-big-prompts.q21` in EN/VI. The new rubric reviews invariant, authority, workload, failure, proof and canonical ownership, and explicitly differentiates bank/fintech, OTA, notification and other domain contracts without copying Saga, Outbox, broker, cache or lease tutorials.

The item preserves all existing IDs and the prompt matrix. Remaining work is to apply the more granular state/failure tables to selected prompts; those changes stay follow-up work so the domain-specific cases do not become duplicated mechanism chapters.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Expansion pass (Batch K/M slice, 2026-08-23)

- [x] Enriched `the-big-prompts.q2` with APNs/FCM token lifecycle, TTL/collapse limits, durable in-app sync, and the distinction between provider acceptance and user delivery.
- [x] Enriched `the-big-prompts.q10` with bearer-capability handling for presigned/session URLs, log hygiene, idempotent completion, part manifests, and final checksum publication.
- [x] Mirrored both changes in EN/VI without changing prompt IDs or moving generic notification/upload mechanics out of their canonical topic owners.
- [x] Added per-item provenance in `public/data/content-reviews.json` using Apple, Firebase, AWS S3, and Google Cloud Storage documentation.
- [ ] Remaining q1/q11/q13/q14/q19/q20 state-table expansion stays queued until the corresponding payment/booking ledger is reviewed as one unit.

## Proposed follow-up changes

- [ ] Add a compact “invariant -> authority -> projection -> failure recovery” answer frame before q1.
- [ ] Add a per-prompt metadata line for workload, freshness, duplicate tolerance, and recovery owner.
- [ ] Replace absolute queue/cache/lock/2PC wording with scoped provider/version language.
- [ ] Add explicit `UNKNOWN`, `PENDING`, `COMPENSATING`, `RECONCILIATION_REQUIRED` transitions to q1, q11, q14, and q20.
- [ ] Add provider/version callouts to upload checksums, presigned URLs, Kafka EOS, Redis failover, redirect semantics, and OAuth.
- [ ] Add failure tables for q2, q5, q10, q13, q14, q19, and q20; keep the other prompts concise.
- [ ] Add security/testing prompts to q3/q9/q10 and an invariant assertion to q12.
- [ ] Link full mechanisms to topics 08, 09, 16, 25 and Case 15 rather than repeating explanations.
- [ ] Apply the same structural changes to EN and VI only after the content outline is approved.

## EN/VI and cross-reference plan

- Preserve all `item_id` values and the one-to-one section/question structure.
- Keep state names, API status codes, field names, formulas, and protocol terms identical; translate the explanation around them.
- When a source qualification changes an English claim, update the paired Vietnamese claim in the same commit.
- Use the same canonical links in both language files; do not create a translation-only technique owner.
- Validate structural parity and run content checks after integration; no integration is performed by this dossier task.

## Open questions and falsifiers

- [ ] What freshness budget does each product case actually promise for search, feed, typeahead, and analytics?
- [ ] Which cases need exact global rate limiting, and what bounded overshoot is acceptable during a partition?
- [ ] Which upload provider and region are the examples targeting? The resumable session lifetime, checksum, and URL behavior are provider-specific.
- [ ] Are q13/q14 intentionally OTA examples or should they be linked to topic 16 as the single OTA canonical context?
- [ ] What compliance/privacy baseline should the payment, notification, upload, and trace examples assume?
- [ ] What would falsify the recommendation to keep a state local? A measured invariant requiring cross-resource atomicity, a provider contract that already supplies a stronger guarantee, or a workload where the local authority cannot meet the stated SLO should trigger a redesign.
- [ ] What would falsify the recommendation to use at-least-once plus idempotency? A named downstream contract that cannot tolerate replay and offers no durable deduplication or reconciliation path; then the case must state the loss/latency trade-off explicitly.

## Source ledger

All URLs below were inspected on 2026-08-23. Tier `T1` is a standard/specification or original paper, `T2` is official implementation/provider documentation, `T3` is first-party engineering guidance, and `T4` is an original pattern/practitioner reference used only where it adds a distinct model.

| # | Source URL and title | Organization/type | Tier | Version/revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | [RFC 9110 - HTTP Semantics](https://www.ietf.org/ietf-ftp/rfc/rfc9110.html) | IETF, standard | T1 | RFC 9110, 2022 | 2026-08-23 | 301/302/307/308 method and permanence semantics |
| 2 | [RFC 9111 - HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111) | IETF, standard | T1 | RFC 9111, 2022 | 2026-08-23 | Freshness, `max-age`, `s-maxage`, invalidation limits |
| 3 | [RFC 6585 - Additional HTTP Status Codes](https://datatracker.ietf.org/doc/rfc6585/) | IETF, standard | T1 | RFC 6585, 2012 | 2026-08-23 | 429 and `Retry-After` boundary |
| 4 | [RFC 9457 - Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc9457) | IETF, standard | T1 | RFC 9457, 2023 | 2026-08-23 | Structured error/status details; do not expose debug data |
| 5 | [W3C Trace Context](https://www.w3.org/TR/trace-context/) | W3C, recommendation | T1 | Recommendation, 2021 | 2026-08-23 | `traceparent`/`tracestate`, propagation, privacy/security boundaries |
| 6 | [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/rfc9700/) | IETF, BCP | T1 | RFC 9700, 2025 | 2026-08-23 | PKCE, refresh-token rotation/sender constraint, avoid insecure flows |
| 7 | [OpenAPI Specification](https://spec.openapis.org/oas/) | OpenAPI Initiative, specification | T1 | Current site includes 3.2.0/3.1.x; verify chosen version | 2026-08-23 | API contract, versioned schema, spec-version scope |
| 8 | [AWS S3 - Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) | AWS, object-store docs | T2 | Current AWS docs | 2026-08-23 | Time-limited capability, signer/permission/expiry scope |
| 9 | [AWS S3 - Multipart upload overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) | AWS, object-store docs | T2 | Current AWS docs | 2026-08-23 | Independent parts, completion/abort, storage and ETag caveat |
| 10 | [AWS S3 - Checking object integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html) | AWS, object-store docs | T2 | Current AWS docs | 2026-08-23 | Checksum algorithms and multipart checksum semantics |
| 11 | [AWS S3 - Aborting incomplete multipart uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/abort-mpu.html) | AWS, object-store docs | T2 | Current AWS docs | 2026-08-23 | Orphaned parts remain billed until abort/lifecycle cleanup |
| 12 | [AWS S3 - Lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html) | AWS, object-store docs | T2 | Current AWS docs | 2026-08-23 | `AbortIncompleteMultipartUpload` as cleanup mechanism |
| 13 | [Google Cloud Storage - Resumable uploads](https://docs.cloud.google.com/storage/docs/resumable-uploads?authuser=09) | Google Cloud, object-store docs | T2 | Current GCS docs | 2026-08-23 | Session URI, offset recovery, one-week session scope |
| 14 | [Google Cloud Storage - Data validation](https://docs.cloud.google.com/storage/docs/data-validation?hl=en) | Google Cloud, object-store docs | T2 | Current GCS docs | 2026-08-23 | CRC32C/MD5 validation scope and provider differences |
| 15 | [Stripe - Idempotent requests](https://docs.stripe.com/api/idempotent_requests?javascript=false&lang=node) | Stripe, API docs | T2 | API v1 page; retention is provider/version-specific | 2026-08-23 | Key/result reuse, parameter mismatch, pruning caveat |
| 16 | [Stripe - API v2 overview](https://docs.stripe.com/api-v2-overview) | Stripe, API docs | T2 | API v2 page; differs from v1 | 2026-08-23 | Different idempotency retention/re-execution scope |
| 17 | [Stripe - PaymentIntent lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle?locale=en-GB) | Stripe, payment docs | T2 | Current docs | 2026-08-23 | `processing`, `succeeded`, `requires_action`, cancellation/async states |
| 18 | [Stripe - Webhooks](https://docs.stripe.com/webhooks?lang=node) | Stripe, webhook docs | T2 | Current docs | 2026-08-23 | Duplicate/unordered events, signature verification, retry behavior |
| 19 | [AWS Builders' Library - Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) | AWS, engineering article | T3 | Current article | 2026-08-23 | Caller intent, stable token, late retry semantics |
| 20 | [Apache Kafka Documentation](https://kafka.apache.org/documentation/) | Apache Kafka, project docs | T2 | Current site; verify deployed client/broker version | 2026-08-23 | Topic/partition/consumer-group and configuration scope |
| 21 | [Apache Kafka - Design](https://kafka.apache.org/42/design/design/) | Apache Kafka, project design | T2 | Kafka 4.2 design page | 2026-08-23 | Partition order, replication, EOS boundaries, retention/compaction |
| 22 | [RabbitMQ - Reliability](https://www.rabbitmq.com/docs/reliability) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Publisher confirms, consumer ACK, redelivery and duplicates |
| 23 | [RabbitMQ - Confirms and acknowledgements](https://www.rabbitmq.com/docs/confirms) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Confirm/ACK independence, prefetch, requeue |
| 24 | [RabbitMQ - Quorum queues](https://www.rabbitmq.com/docs/quorum-queues) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Replication/ack scope, poison/backlog trade-offs |
| 25 | [AWS SQS - Queue types](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-types.html) | AWS, queue docs | T2 | Current docs | 2026-08-23 | Standard at-least-once/best-effort order vs FIFO scope |
| 26 | [Google Cloud Pub/Sub - Exactly-once delivery](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery?hl=en) | Google Cloud, queue docs | T2 | Current docs | 2026-08-23 | Region/pull/client-scoped exactly-once and latency caveat |
| 27 | [Redis - Rate limiting](https://redis.io/learn/develop/java/spring/rate-limiting/fixed-window) | Redis, project tutorial | T2 | Current docs/tutorial | 2026-08-23 | Atomic counter pattern and fixed-window edge-spike limitation |
| 28 | [Redis - Sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Score ordering, tie ordering, leaderboard primitives |
| 29 | [Redis - Distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Lease safety/liveness limits, random release token, fencing recommendation |
| 30 | [Redis - Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Async replication/failover loss and `WAIT` not strong consistency |
| 31 | [Redis - Eviction](https://redis.io/docs/latest/develop/reference/eviction/) | Redis, project docs | T2 | Current docs | 2026-08-23 | `noeviction`, LRU/LFU/random/volatile policies and approximation |
| 32 | [OpenSearch - Autocomplete](https://docs.opensearch.org/latest/search-plugins/searching-data/autocomplete/) | OpenSearch, project docs | T2 | Current docs | 2026-08-23 | Prefix/edge-ngram/completion trade-offs and query cost |
| 33 | [Elasticsearch - Paginate search results](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results) | Elastic, product docs | T2 | Current docs | 2026-08-23 | `search_after` plus PIT for stable deep pagination |
| 34 | [Cassandra - Data modeling introduction](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html) | Apache Cassandra, project docs | T2 | Current docs | 2026-08-23 | Query-first partition modeling, denormalized read paths |
| 35 | [Google SRE - Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) | Google, first-party SRE book | T3 | Current online edition | 2026-08-23 | Retry storms, jitter/budget, load shedding, overload tests |
| 36 | [OpenTelemetry - Messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) | OpenTelemetry, specification | T1 | Current semantic conventions | 2026-08-23 | Producer/consumer correlation and messaging observability |
| 37 | [Apple - Sending notification requests to APNs](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns?changes=_3_4) | Apple, provider docs | T2 | Current docs | 2026-08-23 | Provider response/token boundary; acceptance is not user read/delivery |
| 38 | [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) | Google Firebase, provider docs | T2 | Current docs | 2026-08-23 | Registration tokens, provider send boundary, and delivery limits |
| 39 | [Firebase - Collapsible message types](https://firebase.google.com/docs/cloud-messaging/customize-messages/collapsible-message-types) | Google Firebase, provider docs | T2 | Current docs | 2026-08-23 | Collapse/coalescing behavior and why every notification cannot be treated as a durable event |
| 40 | [Firebase - Message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan?authuser=2) | Google Firebase, provider docs | T2 | Current docs | 2026-08-23 | TTL/expiry behavior and bounded delivery expectations |
| 41 | [Apple - Token-based APNs connection](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns?changes=_2) | Apple, provider docs | T2 | Current docs | 2026-08-23 | Token-based provider authentication and lifecycle scope |

## Excluded/low-value candidates

- Duplicate RFC mirrors, duplicate PDF/HTML copies of the same paper, and versioned vendor pages that did not add a changed guarantee were collapsed to one canonical URL.
- Generic “system design interview” lists and SEO cache/queue explainers were not used as evidence because they did not define a provider/version boundary or a failure guarantee.
- Provider-specific CDN/SEO guides were kept out of generic recommendations unless a case explicitly needs CDN behavior; RFC 9110/9111 remain the generic HTTP evidence.
- Historical papers such as Dynamo, Dapper, and Spanner remain useful for provenance but were not added to this ledger when the current prompt only needed a scoped implementation fact already covered by current official documentation.

## Gate status

- [x] Complete EN/VI source files and exact local IDs read.
- [x] Domain-specific scope and duplicate owners mapped.
- [x] Broad discovery pass completed; selected sources are claim-mapped.
- [x] Workload, invariant, failure, operational, security, testing, and trade-off coverage recorded.
- [x] Contradiction, negative evidence, unknowns, and falsifiers recorded.
- [x] Public EN/VI content updated for the Batch K/M q2 and q10 slice.
- [x] Provenance and canonical-owner integration applied for that slice.
- [x] Validation passed after integration: JSON parse, EN/VI parity, content review-key validation, and the repository gate.
