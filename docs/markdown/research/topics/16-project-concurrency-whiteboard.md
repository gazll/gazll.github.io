# Research - Project concurrency whiteboard

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `16-project-concurrency-whiteboard`

EN file: `public/data/topics/16-project-concurrency-whiteboard.json`

VI file: `public/data/topics/16-project-concurrency-whiteboard.vi.json`

## Scope and non-goals

This topic is the interview/project narrative for an OTA-style booking system and for concurrency-focused whiteboard discussions. Its unique value is the mapping from a race or product promise to an authority, primitive, state transition, and recovery story. It is not the canonical reference for broker delivery, distributed transactions, or generic microservice resilience.

The discovery pass considered a broad, non-exhaustively counted pool of standards, official product/project documents, original papers, and first-party engineering sources. Thirty-four distinct sources were inspected and selected below. Duplicated versions, search pages, generic interview blogs, and sources that did not add a new guarantee or scope boundary were excluded. The 200-source ceiling remains a discovery allowance, not a requirement to pad the dossier.

Canonical cross-references:

- [08-message-queue](08-message-queue.md) owns Kafka/Rabbit delivery, ordering, ACK/confirm, replay, and DLQ mechanics.
- [09-distributed-tx-fintech](09-distributed-tx-fintech.md) owns Saga/Outbox/TCC, provider unknowns, and money workflow correctness.
- [25-microservice](25-microservice.md) owns retry storms, pools, cache, tracing, deployment, and idempotency synthesis.
- [11-system-design-cases](11-system-design-cases.md) owns the broader domain prompt matrix and domain comparison rubric.

## Local content map

The complete EN and VI files were read. The paired content has three sections and sixteen question records.

| Section | Exact local IDs | Current job and unique scope |
| --- | --- | --- |
| Presenting/dissecting the OTA project | `16-project-concurrency-whiteboard.presenting-dissecting-the-ota-project.q1` through `q5` | Architecture narrative, seat race, controlled overbooking, stale/slow browse/book/quote, long-running Saga |
| Technical storytelling fundamentals | `16-project-concurrency-whiteboard.technical-storytelling-fundamentals.q1` through `q7` | STAR/knowledge tree, Java concurrency primitives, WebSocket fan-out, rapid data/protocol/security review, ADR/code review |
| Whiteboard/DSA | `16-project-concurrency-whiteboard.whiteboard-dsa.q1` through `q4` | Distributed limiter across 50 instances, senior problem-solving process, edge checklist, interviewer questions |

The main overlap is intentional but should be link-shaped: OTA state transitions overlap with system-design q13/q14 and topic 09; Kafka/Outbox with topic 08/09; retry/pool/cache/observability with topic 25; Java API semantics with topic 01. This dossier owns the project context and the explanation of why one primitive is insufficient by itself.

## What is correct and reusable

- The OTA architecture correctly separates browse/search, pricing/quote, authoritative inventory/hold, booking orchestration, payment/ledger, ticketing/PNR, and notifications. Search and pricing can be projections; a seat hold and money transition cannot silently be treated as projections.
- The seat-race answer asks for an atomic conditional hold, expiry, version, and idempotent booking command. That is more useful than saying “put a lock around the method.”
- The controlled-overbooking question correctly frames overbooking as a business policy with a measured risk budget, not as an accidental side effect of an eventually consistent inventory read.
- The stale/slow browse-versus-book question distinguishes a stale quote from an authoritative final price/hold. It should preserve the user-facing “reprice/retry/expired” state rather than hiding it behind a generic 500.
- The long Saga question correctly treats compensation as a business action: release, cancel, refund, or manual review, not a database rollback.
- The Java questions are good interview prompts when their version and scope are explicit: `LongAdder` is for high-contention aggregation, `AtomicLong` for an exact single value, `Semaphore` for concurrency permits rather than a complete distributed rate limiter, and `computeIfAbsent` must not run slow blocking work while holding map coordination.
- The distributed limiter question is the right place to ask whether the budget is exact, region-local, or bounded-overshoot. A single Redis script is not automatically a globally exact limiter after failover or partition.
- WebSocket fan-out is correctly treated as connection routing plus backpressure and delivery semantics, not only a socket API question.
- The design-review and code-review checklists are valuable if they ask for an invariant, workload, failure test, and observability signal, rather than only naming technologies.

## Claims to verify or qualify

| Claim or teaching shape | Classification | Scope/limitation to show | Confidence |
| --- | --- | --- | --- |
| One seat must be held by one valid owner at a time | Recommendation from the OTA invariant | The supplier/GDS may be the ultimate authority; local hold is a reservation protocol with an expiry/confirmation contract. | High |
| Database conditional write beats a global lock for the seat invariant | Recommendation | A lock can coordinate work, but the authority must reject stale/duplicate writes; fencing/version checks are required if leases are used. | High |
| Redis distributed lock prevents double booking | Incorrect absolute | Redis documents replication/failover limits and recommends fencing for resource safety; a lock is not the inventory ledger. | High |
| Saga compensation is rollback | Incorrect | Compensation is a new business action and may fail, be partial, or require manual repair. | High |
| Orchestration is better than choreography for large workflows | Heuristic | Visibility, branching, timers, participant ownership, coordinator availability, and coupling matter; no universal participant count. | High |
| Search may be eventually consistent while booking is strong | Domain recommendation | The exact quote/hold freshness and reprice behavior are product/supplier contracts. | High |
| A Kafka key guarantees booking order | Incomplete | It provides partition co-location/order; handler concurrency, retries, replays, rebalances, and aggregate-version checks still matter. | High |
| `LongAdder` is a faster `AtomicLong` | Over-simplified | It is optimized for contention and aggregate operations; `sum()` is not a single linearizable read of a mutable exact counter. | High |
| `StampedLock` or COW solves concurrency | Incorrect as a general claim | Each fits a workload; writer starvation, optimistic-read validation, memory cost, and snapshot semantics must be considered. | High |
| `Semaphore` is a rate limiter | Incomplete | It bounds concurrent permits; it does not impose a time-window/token budget across instances without additional state and refill policy. | High |
| Virtual threads make CPU-bound work faster | Incorrect | JEP 444 targets high-concurrency blocking I/O; CPU work remains limited by CPU and scheduler resources. | High |
| Structured concurrency is production-stable in JDK 25 | Version error | `StructuredTaskScope` is a preview API in JDK 25 documentation; state the compile/runtime flag and target version. | High |
| A WebSocket connection is durable delivery | Incorrect | It is a live channel; reconnect, cursor, offline retention, duplicate, ordering, auth refresh, and backpressure are application contracts. | High |
| A lease expiry proves the previous worker stopped | Incorrect | Clocks, partitions, pauses, and delayed packets can leave an old worker active; fencing at the protected resource is required. | High |
| Add more threads when p99 rises | Anti-pattern | Tail latency can be caused by queueing, downstream saturation, connection pools, locks, GC, or retry amplification; more concurrency can worsen it. | High |

## Workload, invariants, and failure model

### OTA authority model

| Boundary | Data/state | Authority | Allowed staleness | Recovery question |
| --- | --- | --- | --- | --- |
| Browse/search | routes, fares, availability projection | Search index/cache plus supplier refresh | Product-defined seconds/minutes | Can rebuild from supplier/event source? |
| Quote | fare rules, price, expiry | Quote service/supplier contract | Bound to quote token/expiry | What happens when price changes? |
| Hold | seat/SKU ownership, expiry, version | Inventory/hold store or supplier API | No stale acceptance beyond version/expiry | Conditional claim, release, expiry sweep, reconciliation |
| Booking | durable order and command identity | Booking DB/workflow state | Pending is visible | Can resume after worker crash without a new supplier call? |
| Payment | authorization/capture/refund state | PSP plus local payment attempt/ledger | Unknown must remain visible | Stable provider key/status inquiry/settlement reconciliation |
| PNR/ticket | supplier confirmation/ticket number | GDS/airline | Callback may be delayed | Late success after local cancel/hold expiry policy |
| Client updates | WebSocket/poll/status resource | Client session is not authority | Connection can be stale | Cursor, replay, dedup, auth refresh, reconnect |

### Core invariants

1. A hold is accepted only if the authoritative record is available, unexpired, and at the expected version.
2. The same client booking command cannot create two orders or two external charges; local and provider idempotency scopes must be named separately.
3. An event can be duplicated or delayed without creating a second business effect.
4. A late callback cannot overwrite a newer terminal state without an explicit versioned transition or reconciliation policy.
5. Search/quote availability is not a promise that the hold will succeed; the UI/API must expose reprice, sold-out, pending, and manual-review outcomes.
6. A distributed worker lease is only coordination. The inventory/payment authority must reject a stale owner through version/fencing/conditional-write logic.

### Workload assumptions to label, not hide

- Search-to-book skew can be large; the topic's “browse is cheap, booking is authoritative” answer needs a measured peak search rate, hold contention, quote size, supplier latency, and retry rate.
- For a 50-instance limiter, a local-only counter can enforce a per-instance budget but not a global budget. A shared atomic decision adds network and failure latency; a regional or cell budget trades global exactness for availability.
- For fan-out, the number of connected clients, messages per conversation, average payload, reconnect burst, slow-consumer distribution, and offline retention dominate capacity more than the WebSocket API choice.
- For Java pools, concurrency is bounded by CPU, blocking fraction, downstream pool capacity, queue length, and deadline. “One thread per request” is not a capacity plan.

### Crash and race table

| Event | Unsafe answer | Safer answer |
| --- | --- | --- |
| Two buyers read `AVAILABLE` | Both insert/hold from stale reads | Conditional update/unique constraint at the hold authority; return conflict to one |
| Hold worker pauses past lease | Old worker confirms after new owner | Lease plus fencing/version; authority rejects old token |
| Booking request times out | Retry with a new idempotency/provider key | Reuse command identity, inspect local state, resume/inquire |
| PSP/GDS call times out | Mark failure and call again blindly | `UNKNOWN/PENDING`, stable reference, status inquiry/webhook, reconciliation |
| Outbox relay dies after publish | Marking row was not committed, so republish | At-least-once relay plus consumer Inbox/business key |
| WebSocket disconnects after server sends | Assume client received and processed | Persist event/cursor, reconnect from cursor, dedup on client/server |
| Limiter store partitions | Every instance fails open or continues exact global claim | Explicit fail-open/closed policy and bounded overshoot/cell budget |
| Slow fan-out client | Unlimited per-client queue | Backpressure, bounded queue, disconnect/replay policy, metrics |
| Worker crashes after claim | Claimed item disappears forever | Lease/visibility timeout, reclaim, idempotent resume |

## Best-practice comparison

| Decision | Option A | Option B | OTA interview answer |
| --- | --- | --- | --- |
| Inventory write | Pessimistic/leased lock | Optimistic version/conditional write | Prefer the authority's constraint/version; add a lease only for work ownership and fencing |
| Search availability | Synchronous supplier read | Derived index/cache | Use a projection for browse; verify/hold against authority before commit |
| Workflow | Choreography | Durable orchestration | Use orchestration when timers, branching, visibility, and compensation ownership dominate; keep participant contracts local |
| Broker | Rabbit work queue | Kafka keyed log | Pick by command routing/ack versus replay/retention/partition fan-out; do not promise global order |
| Client updates | WebSocket only | Status resource plus WebSocket/poll | WebSocket is a latency path; status resource/cursor is the recovery path |
| Limiter | Exact shared counter | Regional/cell token budget | Tie exactness to abuse/financial risk and write the partition contract |
| Java fan-out | Platform threads | Virtual threads/structured tasks | Use version-appropriate primitives, explicit deadlines, bounded downstream work, and cancellation |
| Payment | Synchronous PSP completion | Async attempt state | Use `PENDING/UNKNOWN` and idempotent resume; do not turn timeout into failure |
| Lock recovery | TTL only | TTL plus fencing/version | TTL is a liveness signal; fencing is needed to prevent delayed stale writers |

## Technical primitive evidence and limits

| Primitive | Suitable use | Not a substitute for |
| --- | --- | --- |
| `BlockingQueue` | Bounded handoff/backpressure inside one process | A durable broker or cross-instance work claim |
| `AtomicLong` | Exact atomic scalar update/read | A distributed counter or multi-field invariant |
| `LongAdder` | High-contention metrics/frequency aggregation | An exact linearizable balance/rate decision |
| Immutable object | Safe sharing/snapshot value | Durable versioning or validation at a database |
| Copy-on-write collection | Many reads, rare small writes | Large/high-write collections or distributed state |
| `StampedLock` optimistic read | Read-heavy in-process structure with validation | Cross-process locking or a guarantee without validation |
| `Semaphore` | Limit concurrent permits | Time-based rate, distributed budget, fairness under partitions |
| `ConcurrentHashMap.computeIfAbsent` | Atomic map initialization for short computation | Blocking network/database workflow inside the mapping function |
| `ThreadPoolExecutor` | Explicit queue/rejection/backpressure policy | A reason to increase concurrency without downstream capacity |
| Virtual threads | Many blocking I/O tasks with structured cancellation | CPU scaling, unbounded external calls, missing deadlines |
| WebSocket | Low-latency live updates | Offline durability, replay, or delivery confirmation |
| Redis lease | Coordination hint | Fenced ownership/inventory/money authority |

## Coverage matrix

| Required area | Local coverage | Evidence/owner | Gap to close before integration |
| --- | --- | --- | --- |
| Definitions | OTA components, concurrency primitives, limiter, whiteboard process | Local EN/VI; OpenAPI; Java docs | Define authority, projection, lease, fencing, cursor, and compensation once |
| Invariants | Seat uniqueness, order/payment identity, per-conversation order, limiter budget | Local prompts; PostgreSQL/Redis/Kafka docs | Add explicit invariant/assertion to every answer, including WebSocket and Java examples |
| Workload | Search skew, 50 instances, fan-out, blocking/CPU distinction | Local prompts; Tail at Scale; JEP 444 | Add numeric assumptions for peak, payload, connection count, supplier p99, and retry budget |
| Failure/crash windows | Race, late callback, lease pause, outbox, reconnect, partition | Local q1-q5; AWS Outbox; Redis lock docs | Add a concise state diagram for hold/payment/ticketing and a reconnect cursor case |
| Retries/timeouts | PSP/GDS, WebSocket reconnect, limiter store, gRPC-style deadlines | gRPC deadline/retry; AWS idempotency; SRE | Propagate one absolute deadline and show which layer owns retry |
| Operations/recovery | Reclaim, reconciliation, fan-out backpressure, limiter outage | K8s Lease/probes; OTel | Add metrics: hold conflict, stale-fence reject, quote age, supplier unknown age, queue age, reconnect lag |
| Security/privacy | Auth, tenant/PNR/payment boundary, trace propagation | OAuth RFC 9700, W3C Trace Context, RFC 6455 | Add origin/session/auth-refresh and PII minimization details to WebSocket answer |
| Testing | Code review/DSA checklist and system race prompts | Pact, Testcontainers, Chaos Mesh | Add deterministic two-buyer race, clock pause, partition, duplicate callback, reconnect replay tests |
| Domain trade-offs | Strong hold/payment versus stale browse/analytics | Local OTA prompts; Azure microservices; Spanner | State supplier/GDS authority and whether controlled overbooking is allowed |

## Contradictions and limits

| Apparent rule | Counter-evidence or scope | Final wording |
| --- | --- | --- |
| A lock is the solution to a race | Redis documents failover/mutual-exclusion limits; DB constraints can reject stale writes directly | A lock coordinates; the authoritative write and fencing/version rule enforce correctness |
| Distributed transactions are never usable | PostgreSQL/Jakarta/Oracle support prepared/XA; Spanner documents serializable distributed transactions | Compare participant support, blocking/in-doubt recovery, latency, and invariant need |
| A Saga always converges | AWS/Azure describe compensation, pivot, retryable steps and failure handling | A Saga is a recovery protocol; convergence is a design goal requiring idempotent steps and repair |
| Virtual threads replace pool design | JEP 444 says CPU work remains CPU-bound and external resource limits remain | Virtual threads change thread cost, not downstream capacity, deadline, or admission control |
| WebSocket gives real-time reliability | RFC 6455 defines the channel, not application replay/durability | Add durable cursor/status and reconnect semantics |
| Exact global limiter is one Redis command | Topology/failover/partition and clock behavior change the guarantee | Name topology and bounded-overshoot policy; benchmark latency/failure behavior |
| Strong consistency is impossible at scale | Spanner provides a managed, scoped example; Cassandra chooses query-first eventual trade-offs | State the chosen database/provider and cost/latency/region boundary |
| `computeIfAbsent` is safe for any initialization | Java docs require short/simple mapping and can block other updates | Keep mapping functions short; perform I/O outside the map coordination path |

## Negative evidence and anti-patterns

- Do not use a single “OTA Saga diagram” for every supplier. Supplier APIs may be authoritative, asynchronous, non-idempotent, or unavailable; the contract determines the workflow.
- Do not reserve by decrementing a read replica, cache, or search index. Read models can inform admission but cannot silently own the seat.
- Do not retry a timed-out capture/ticket call with a new key; the first call may have succeeded.
- Do not call a TTL lease a fencing mechanism. A paused process can wake after expiry unless the authority rejects its old token.
- Do not put blocking PSP/GDS/database calls inside `computeIfAbsent`, a global JVM lock, or an unbounded executor queue.
- Do not use `LongAdder` for an exact limit, balance, or sequence decision merely because it benchmarks well for metrics.
- Do not fan out to every WebSocket connection synchronously from a booking request; bound queues and make delivery resumable.
- Do not make a WebSocket `send` callback the only record that a client received a business event.
- Do not claim a limiter is “global” without describing regions, replication, partition behavior, clock, token refill, and admission response.
- Do not use a liveness probe to detect downstream supplier slowness; Kubernetes can restart every pod and amplify the outage.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Keep here |
| --- | --- | --- |
| Broker delivery/order/replay/DLQ | Topic 08 | The OTA reason for keyed event/command choice |
| Saga/Outbox/provider unknown | Topic 09 | OTA hold/payment/ticketing application and compensation policy |
| Retry storm/pool/cache/observability | Topic 25 | Interview diagnosis and project-specific metrics |
| Broad domain prompt matrix | Topic 11 | Link to q13/q14/q20; avoid copying full questions |
| Java/JVM primitive reference | Topic 01 | Version caveat and one project example only |
| OTA project architecture and concurrency story | This topic | Canonical project narrative |
| WebSocket reconnect/cursor | This topic | Keep because it is part of the project contract |
| Distributed rate-limit whiteboard | This topic | Keep algorithm and invariant; link generic limiter details elsewhere |

## Current-vs-proposed content gaps

| Current content risk | Integrated change / remaining gap | Evidence/owner |
| --- | --- | --- |
| OTA diagram shows components but not authority transitions | Applied: distinguish search projection, local hold/order state, supplier/GDS, PSP and ticketing; chosen supplier contract remains open | AWS Saga/Outbox; Stripe state docs; supplier behavior is not inferred |
| “Lock” language can hide stale-worker writes | Applied: conditional version/fencing example and late-worker handling | PostgreSQL/Redis/Kubernetes Lease docs |
| WebSocket section can imply durable delivery | Applied: cursor, reconnect, dedup, offline retention, backpressure and auth refresh | RFC 6455/8441; OTel/W3C |
| Java primitive advice is version/workload sensitive | Applied: JDK version labels and exact-vs-approximate operation notes | JDK 21/24/25 docs |
| Limiter whiteboard does not force a partition contract | Applied: exact, regional and bounded-overshoot modes with fail-open/closed policy | Redis limiter/replication docs |


## Integration record (applied 2026-08-23)

- [x] Add an explicit OTA state machine: `QUOTED -> HELD -> BOOKING -> PAYMENT_PENDING/UNKNOWN -> TICKETED`, with expiry/cancel/refund/manual-review paths.
- [x] Mark supplier/GDS authority and local projection authority on the architecture narrative.
- [x] Replace “distributed lock prevents race” wording with conditional write/version/fencing examples.
- [x] Add late-callback and unknown-outcome handling for payment, PNR, ticketing, and hold expiry.
- [x] Add limiter modes for exact, regional, and bounded-overshoot budgets across 50 instances.
- [x] Add WebSocket reconnect/cursor/dedup/backpressure requirements and security constraints.
- [x] Add Java version labels: JDK 21 for virtual threads, JDK 24 for the synchronized pinning change, and preview status for JDK 25 structured concurrency.
- [x] Add a failure-oriented code-review rubric: invariant, deadline, retry owner, idempotency, stale-version rejection, metric, and test.
- [x] Keep EN/VI question IDs unchanged and update all qualifiers in both languages together.

## OTA authority checkpoint (2026-08-23)

The booking answers now keep three freshness/authority decisions separate:

| Layer | Contract | Failure consequence |
| --- | --- | --- |
| Browse/search | Projection with `observed_at`, version and an explicit non-binding freshness budget | Stale data may be shown, but it cannot authorize a booking |
| Local hold/order | Conditional write with hold ID, version/fence and expiry checked by the authority | Expiry worker may release only the matching active version; stale workers are rejected |
| Supplier/GDS and PSP | Provider reference, quote/hold version, correlation ID, status inquiry and provider-specific retry rules | Timeout or late callback is `UNKNOWN`; local expiry is not proof that external inventory was released |

This is intentionally not a generic airline guarantee. The final design still needs the chosen GDS/airline contract for hold lifetime, booking idempotency, late ticketing success, cancellation and overbooking policy.

## EN/VI and cross-reference plan

- Preserve all 16 question IDs and section order.
- Keep Java class names, API names, state names, HTTP status codes, and formulas identical in EN/VI.
- Translate the explanatory trade-off, not the guarantee; terms such as `UNKNOWN`, `fencing`, `at-least-once`, and `backpressure` should have a stable glossary translation.
- Link topic 08/09/25 and case 15 in both language versions once their public content anchors are final.
- Validate structural parity after integration; no public data is changed by this research record.

## Open questions and falsifiers

- [ ] Which OTA supplier/GDS contract should the example assume for hold expiry, booking idempotency, and late ticketing success?
- [ ] Is controlled overbooking a permitted product policy, and what compensation/reaccommodation authority owns the risk?
- [ ] What are the target search/book ratio, supplier p99, hold duration, connection count, and WebSocket offline retention?
- [ ] Which limiter failure mode is acceptable: fail closed, bounded regional overshoot, or degraded local budget?
- [ ] Which Java target is used by the project? This changes the wording for virtual threads, structured concurrency, and pinning.
- [ ] What would falsify the recommendation to use conditional writes over a long-held lock? A supplier API that requires a lease protocol, a measured transaction pattern that cannot meet hold latency, or an invariant spanning an external resource may justify a different protocol.
- [ ] What would falsify the “WebSocket plus status cursor” recommendation? A product contract with no offline/replay requirement and a verified loss-tolerant notification class; otherwise the live channel alone is insufficient.

## Source ledger

All URLs below were inspected on 2026-08-23. Tier `T1` is a standard/specification or original paper, `T2` official implementation/provider documentation, `T3` first-party engineering guidance, and `T4` original pattern/practitioner material.

| # | Source URL and title | Organization/type | Tier | Version/revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | [AWS - Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | Local transactions, compensation, choreography/orchestration trade-offs |
| 2 | [AWS - Saga orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | Durable coordinator responsibilities, branching/retry/timeout scope |
| 3 | [AWS - Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | Local write plus durable publish intent; duplicate consumer requirement |
| 4 | [AWS Builders' Library - Idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) | AWS, engineering article | T3 | Current article | 2026-08-23 | Caller intent, safe retries, late request/response handling |
| 5 | [PostgreSQL - Explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html) | PostgreSQL, database docs | T2 | PostgreSQL 17 | 2026-08-23 | Row lock scope/lifetime, deadlock and advisory-lock limits |
| 6 | [PostgreSQL - Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) | PostgreSQL, database docs | T2 | Current docs | 2026-08-23 | Unique/foreign/exclusion constraint as local invariant enforcement |
| 7 | [PostgreSQL - Partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) | PostgreSQL, database docs | T2 | Current docs | 2026-08-23 | Conditional uniqueness, planner/predicate scope |
| 8 | [Apache Kafka - Documentation](https://kafka.apache.org/documentation/) | Apache Kafka, project docs | T2 | Current site; verify deployment version | 2026-08-23 | Topic/partition/key/consumer-group contract |
| 9 | [Apache Kafka - Design](https://kafka.apache.org/42/design/design/) | Apache Kafka, project design | T2 | Kafka 4.2 design page | 2026-08-23 | Per-partition order, replication, transactions/EOS boundary |
| 10 | [RabbitMQ - Reliability](https://www.rabbitmq.com/docs/reliability) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Publisher confirm versus consumer ACK and redelivery |
| 11 | [Redis - Distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Lease safety/liveness limits and fencing-token warning |
| 12 | [Redis - Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Async replication/failover and `WAIT` scope |
| 13 | [Redis - Rate limiting tutorial](https://redis.io/learn/develop/java/spring/rate-limiting/fixed-window) | Redis, project tutorial | T2 | Current tutorial | 2026-08-23 | Atomic fixed-window counter and edge-spike limitation |
| 14 | [Redis - Sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Score/tie/rank behavior for leaderboard example |
| 15 | [W3C Trace Context](https://www.w3.org/TR/trace-context/) | W3C, recommendation | T1 | Recommendation, 2021 | 2026-08-23 | Trace propagation, security and PII boundary |
| 16 | [OpenTelemetry - Messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) | OpenTelemetry, specification | T1 | Current semantic conventions | 2026-08-23 | Producer/consumer correlation and messaging signals |
| 17 | [RFC 6455 - WebSocket Protocol](https://datatracker.ietf.org/doc/rfc6455/) | IETF, standard | T1 | RFC 6455, 2011 | 2026-08-23 | Handshake, bidirectional channel, TLS/origin security scope |
| 18 | [RFC 8441 - WebSockets over HTTP/2](https://datatracker.ietf.org/doc/rfc8441/) | IETF, standard | T1 | RFC 8441, 2018 | 2026-08-23 | Extended CONNECT/H2 multiplexing boundary |
| 19 | [gRPC - Deadlines](https://grpc.io/docs/guides/deadlines/) | gRPC, official docs | T2 | Current docs | 2026-08-23 | Explicit deadlines, propagation, cancellation and clock-skew handling |
| 20 | [gRPC - Retry](https://grpc.io/docs/guides/retry/) | gRPC, official docs | T2 | Current docs | 2026-08-23 | Retryable status, max attempts, backoff/jitter and retry throttle |
| 21 | [OpenJDK JEP 444 - Virtual Threads](https://openjdk.org/jeps/444) | OpenJDK, JEP | T1 | Delivered JDK 21 | 2026-08-23 | I/O concurrency, CPU-bound limit, per-task creation guidance |
| 22 | [OpenJDK JEP 491 - Synchronize without pinning](https://openjdk.org/jeps/491) | OpenJDK, JEP | T1 | Delivered JDK 24 | 2026-08-23 | Version-specific synchronized/pinning behavior |
| 23 | [JDK 25 StructuredTaskScope API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) | Oracle/OpenJDK API docs | T2 | JDK 25 preview API | 2026-08-23 | Structured fork/join/cancellation and preview status |
| 24 | [JDK 21 ConcurrentHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) | Oracle/JDK API docs | T2 | JDK 21 | 2026-08-23 | `computeIfAbsent` atomicity and short mapping guidance; LongAdder example |
| 25 | [JDK 21 ThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html) | Oracle/JDK API docs | T2 | JDK 21 | 2026-08-23 | Queue/core/max/reject order and `CallerRuns` feedback |
| 26 | [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) | Google Research, original paper | T1 | Communications of ACM, 2013 | 2026-08-23 | Fan-out/tail latency and hedging/replication trade-offs |
| 27 | [Dapper distributed tracing](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) | Google Research, original paper | T1 | 2010 paper | 2026-08-23 | Low-overhead ubiquitous tracing and sampling rationale |
| 28 | [Kubernetes - Leases](https://kubernetes.io/docs/concepts/architecture/leases/) | Kubernetes, official docs | T2 | Current docs; API/version scope | 2026-08-23 | Lease object and leader-election coordination |
| 29 | [Kubernetes - Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/) | Kubernetes, official docs | T2 | Current docs | 2026-08-23 | Readiness traffic removal, liveness restart, startup probe, cascade risk |
| 30 | [Microsoft - Microservices architecture](https://learn.microsoft.com/en-us/azure/architecture/microservices/) | Microsoft Azure, architecture guidance | T2 | Current docs | 2026-08-23 | Bounded contexts, data autonomy, chatty/complexity/eventual-consistency trade-offs |
| 31 | [Google Cloud Spanner - Transactions](https://docs.cloud.google.com/spanner/docs/transactions?hl=en) | Google Cloud, database docs | T2 | Current docs; regional/provider scope | 2026-08-23 | Serializable/external consistency and abort/retry scope |
| 32 | [Pact - How contract testing works](https://pactflow.io/how-pact-works/) | PactFlow, testing docs | T3 | Current docs | 2026-08-23 | Consumer/provider contract test boundary and broker workflow |
| 33 | [Testcontainers - Getting started](https://testcontainers.com/getting-started/) | Testcontainers, project docs | T2 | Current docs | 2026-08-23 | Real dependency integration tests and lifecycle |
| 34 | [Chaos Mesh - Network chaos](https://chaos-mesh.org/docs/simulate-network-chaos-in-physical-nodes/) | Chaos Mesh, project docs | T2 | Current docs | 2026-08-23 | Delay/loss/partition fault injection |
| 35 | [Amadeus API FAQ - flight booking](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/) | Amadeus, provider documentation | T2 | Self-Service API docs; provider/market/consolidator scope | 2026-08-23 | Search → Price confirmation → Create Orders → Order Management flow, ticketing and cancellation boundaries |
| 36 | [Amadeus Postman booking workflow](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/developer-tools/postman/) | Amadeus, provider documentation | T2 | Guide last updated 2025-10-23; provider/API scope | 2026-08-23 | Concrete Search → Flight Offers Price → Flight Create Orders sequence; not a universal GDS contract |

## Excluded/low-value candidates

- Duplicate HTML/PDF versions of Dapper, Sagas, or broker design papers were collapsed to one source; the original paper is used only when it adds historical semantics.
- Generic “Java concurrency interview questions” pages were excluded because the JDK API documentation defines the behavior and version scope more reliably.
- Cloud provider lock/queue tutorials were not treated as a universal distributed-lock guarantee; Redis and Kubernetes sources are retained only with their topology limits.
- Generic WebSocket scaling blogs were excluded where RFC 6455 plus the project’s own reconnect contract was enough; a protocol specification does not prove delivery durability.

## Gate status

- [x] Complete EN/VI source files and exact IDs read.
- [x] OTA-specific authority, concurrency, and duplicate ownership mapped.
- [x] Broad discovery and selected claim-mapped source ledger completed.
- [x] Coverage, contradictions, negative evidence, and falsifiers recorded.
- [x] Public EN/VI content updated.
- [x] Cross-reference/index integration applied.
- [x] Validation passed after integration.
