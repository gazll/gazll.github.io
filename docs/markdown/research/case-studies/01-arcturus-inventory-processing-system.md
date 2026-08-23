# Research — Arcturus inventory processing system

Status: INTEGRATED
Reviewed: 2026-08-23
Local unit: `01-arcturus-inventory-processing-system`
EN file: `public/data/case-studies/articles/01-arcturus-inventory-processing-system.html`
VI file: `public/data/case-studies/articles/01-arcturus-inventory-processing-system.vi.html`
Metadata EN/VI: `public/data/case-studies/01-arcturus-inventory-processing-system.json`, `public/data/case-studies/01-arcturus-inventory-processing-system.vi.json`

## Scope and non-goals

This dossier checks the article as a domain case study about high-contention inventory mutation, ordered processing, replay and cross-service reservation. It is not an independent audit of Tiki's 2019 production system, nor a recommendation to use one global queue, Kafka, Disruptor or an in-memory projection for every inventory workload. The local measurements are treated as first-party historical observations whose test environment and version boundaries must remain visible.

The main research question is: when does serializing inventory mutations improve correctness and throughput, and which durability, partitioning, retry and recovery contracts are required before the design can be considered safe?

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| `introduction` | Peak-sale overselling, cancelled orders, consistency/availability trade-off and project timeline | First-party narrative; date and outcome are not independently verified |
| `inventory-problems` | Millions of products/locations; checkout, warehouse and delivery integrations | Reusable workload framing; exact cardinalities are unspecified |
| `approaches` | Local memory, non-blocking flow, one command queue/master and proactive consistency | Core architecture; needs explicit scope and partitioning caveat |
| `architecture` | Command queue, offset, in-memory state and asynchronous persistence | Core state-machine evidence; durability boundary needs clarification |
| `consistency-model` | Replay algorithm based on database offset and processor/queue offset | Strongest reusable section; invariants should be written formally |
| `processing-model` | Single-thread sequential transactions, two rings and batched writes | Reusable for hot-key serialization; benchmark claims are scope-limited |
| `checkout-integration` | Reserve, order result, confirm or reverse | Reusable saga-like lifecycle; idempotency and expiry are missing |
| `warehouse-integration` | Removing duplicate warehouse/consumer quantity logic | Domain integration insight; ownership and event contract are missing |
| `overall-architecture` | Java 11, MySQL, Kafka, Guava, Disruptor, Gridgo, ZeroMQ and Atomik | Historical implementation inventory; versions/configuration are missing |
| `benchmark` | 350k in-memory, 120k full-I/O, 5,600 staging RPS, ~7 ms latency and 99% cache hit | First-party measurements; not comparable without workload/hardware/method details |
| un-ID `Throughput`, `Latency`, `Cache Hit.` | Benchmark chart labels | Preserve as anchors or add IDs during content integration |
| `conclusion` | Consistency and CPU optimization as central lessons | Reusable synthesis, but should not imply universal superiority |

The metadata guide contains the same five takeaways and four review lenses in both language files. The guide correctly foregrounds recovery boundaries, hot keys, backpressure and reservation idempotency; it should be retained as the reading contract rather than expanded with generic saga terminology.

## What is correct and reusable

- The central trade-off is domain-specific: an inventory reservation has a materially different correctness requirement from a read-only catalog projection. The article is strongest when it explains why a hot key can justify serialization.
- A queue offset can be more than consumer bookkeeping when it is part of a recoverable state machine. The useful claim is conditional: replay is safe only if the command log is durable, the offset is durably coordinated with the projection, and commands are idempotent or replay-safe.
- Separating a low-latency decision path from batched persistence is a valid performance shape when bounded buffers, lag limits and recovery are explicit.
- Reserve/confirm/reverse is a sound cross-service lifecycle for an operation that cannot atomically update checkout, order and inventory over HTTP. It is a saga-like domain workflow, not a promise of global serializability.
- Unifying warehouse adjustments and customer purchase mutations reduces the chance that two code paths implement different quantity rules. It does not by itself solve event ordering, authorization or reconciliation.
- Disruptor's bounded ring and single-writer style are relevant implementation choices for a hot, in-process handoff, but the library is not the source of durability or distributed ordering.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Locking the database protected consistency but reduced throughput, while relaxing consistency caused overselling/cancellations | First-party fact plus inference | Tiki article; no incident data or competing design measurements | Present as the motivating Tiki workload, not as a universal database conclusion | Medium |
| Every inventory mutation passes through one ordered command queue | First-party implementation claim | Tiki `architecture`, `warehouse-integration` | Define whether “one” means one logical stream, partition, SKU/warehouse key or one process | Medium |
| Persistent state is recoverable when the DB offset lags the processor offset | First-party design claim | Tiki `consistency-model` | State which store owns the command log, how offsets are committed, and how replay avoids duplicate side effects | Medium pending source/code evidence |
| Database offset is never ahead of the latest processor/queue offset | Local invariant | Tiki algorithm | Keep as an invariant only after defining crash ordering and atomicity of offset persistence | High as article text; unknown as production guarantee |
| A single thread sequentially processes transactions and avoids conflicts | First-party fact plus inference | Tiki `processing-model`; LMAX describes single-writer-friendly low-latency design | Scope to a partition/key group; one global thread is a capacity and availability bottleneck | High |
| Disruptor reaches up to 1M transactions/s | First-party benchmark claim | Tiki article; LMAX documents the mechanism but not Tiki's result | Add hardware, event size, producer count, persistence, percentile and reproducibility details; do not compare to 120k full-I/O | Low-to-medium |
| Full-I/O throughput is 120k transactions/s and staging reaches 5,600 requests/s | First-party benchmark/production-like observation | Tiki benchmark section | Label environments separately; request mix, concurrency, DB durability and bottleneck are unknown | Medium |
| Average latency is about 7 ms and cache hit is 99% | First-party chart reading | Tiki chart | Add window, percentile, cache key/freshness and whether misses/DB writes are included | Low-to-medium |
| HTTP cannot atomically update order and inventory | General distributed-systems fact | HTTP semantics plus transactional-outbox/saga literature | Say “a normal cross-service HTTP call does not provide a shared transaction”; an application can still coordinate with a workflow or transaction manager | High |
| Reserve then confirm/reverse handles checkout consistency | First-party design plus recommendation | Tiki `checkout-integration`; AWS saga guidance | Add reservation TTL, idempotency key, duplicate/out-of-order handling and reconciliation | High as pattern; incomplete locally |
| Warehouse and customer changes should share one command path | First-party design rationale | Tiki `warehouse-integration` | Keep as a domain choice when the quantity invariant is shared; separate authorization/read models may remain | Medium-to-high |
| Eventual consistency is acceptable | Inference | Tiki `consistency-model` says eventual consistency | Explain which invariant is synchronous (available quantity/reservation) and which views are eventual (warehouse/reporting/search) | Medium |

## Workload, invariants, and failure model

### Workload model

- High read volume and bursty write volume during flash sales; contention is concentrated on a subset of SKU/location keys rather than uniformly distributed across all products.
- Writers include checkout reservations, order confirmation/cancellation, warehouse inbound/outbound adjustments and possibly delivery-related corrections. Their arrival order can differ from business time.
- The local article reports millions of products and warehouse locations but does not specify key skew, batch size, event payload, partition count, replication factor, network topology, storage class or retention window.
- The benchmark has at least three distinct workloads: in-memory transaction processing, full I/O, and staging HTTP requests. They must not be presented as one throughput number.

### Safety invariants

1. For every inventory key, committed available quantity plus reserved quantity must never imply more sellable units than the authoritative stock policy permits.
2. A reservation has a unique business idempotency key; a repeated reserve/confirm/reverse request has the same effect as one request.
3. Commands for the same ordering key are applied in a deterministic order. If the key is SKU + warehouse, a product-wide invariant must not be split across unrelated partitions without a coordination rule.
4. A durable checkpoint must identify exactly which commands are reflected in durable state. A checkpoint must not advance past a mutation that can be lost, and replay must not double-apply a non-idempotent side effect.
5. The system must expose a bounded state for queue lag, in-memory buffer occupancy and persistence failure. Unbounded buffering is not a recovery strategy.
6. Confirmation and compensation are allowed to be eventually consistent only where the product policy accepts a temporary “reserved/pending” state; the customer-facing decision must specify its timeout and fallback.

### Crash windows and recovery

| Window | Possible result | Required recovery/observability |
| --- | --- | --- |
| Command accepted by broker, processor crashes before applying | Replay from broker; no business effect should be visible | Durable consumer position, command ID and replay counter |
| In-memory mutation applied, persistence ring loses event | Visible state can roll back after restart | Do not advance durable checkpoint; replay from last durable boundary; alert on divergence |
| DB batch commits, process crashes before checkpoint | Replay can duplicate writes | Idempotent upsert/version check or atomic checkpoint-plus-state transaction |
| Broker publish/ack uncertainty | Duplicate or missing downstream event | Producer idempotence/transactional outbox where applicable; consumer dedupe and reconciliation |
| Reserve succeeds, order response times out | Stock remains held or is accidentally released | Reservation TTL, state machine, retry-safe confirm/reverse and a sweeper |
| Confirm arrives before reserve observation or reverse arrives twice | Out-of-order/duplicate lifecycle | Per-reservation state transitions with monotonic version and terminal-state rules |
| MySQL or disk falls behind | Memory grows, latency rises, then data loss or admission failure | Backpressure, bounded queue, load shedding, lag SLO and degraded admission policy |
| Single processor dies or is partitioned | Key availability and failover depend on ownership | Replayable log, fencing/lease, standby, deterministic partition reassignment and recovery drill |

The local design documents the replay concept but not all of these crash windows. “Eventual consistency” must therefore not be used as a substitute for a stated recovery contract.

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Queue, offset, local memory, batch persistence, reservation | Kafka design; LMAX Disruptor; AWS Saga | Define logical log, projection, checkpoint, reservation and compensation in a glossary |
| Invariants | DB offset relation and sequential processing | MySQL isolation/locks; Kafka ordering scope | State key, partition and checkpoint atomicity; add quantity invariant |
| Workload | Peak sales, products, warehouses, checkout and warehouse writers | Google SRE overload; AWS Well-Architected | Add skew, burst, payload, concurrency and capacity assumptions |
| Failure/crash windows | Replay when offsets differ; reverse order implied | Outbox, Kafka, SRE cascading failures | Add explicit crash table and recovery sequence |
| Retries/timeouts | Reserve/confirm/reverse lifecycle but no values | AWS idempotent APIs; AWS backoff/jitter; Temporal-style retry distinction | Add retry ownership, deadline budget, TTL and non-retryable errors |
| Operations/recovery | Offset replay is described | SRE overload/cascading; OpenTelemetry messaging | Add lag, queue saturation, checkpoint age, replay, reconciliation and runbook metrics |
| Security/privacy | Barely covered | Kafka ACL/security docs; OWASP/least-privilege practice | Add producer/consumer ACLs, operator authorization, audit trail and no sensitive payload logs |
| Testing | Benchmark charts and staging result | LMAX/Java/Kafka testing guidance | Add property tests, crash injection, duplicate/out-of-order tests, load and failover tests |
| Domain trade-offs | Consistency vs availability; checkout vs warehouse | AWS Saga; MySQL isolation; SRE degraded service | Separate hard reservation invariant from eventual reporting/search views |

## Best-practice comparison

| Decision in the case | Comparable practice | Assessment and boundary |
| --- | --- | --- |
| Single ordered mutation path | Actor/single-writer or partitioned log | Good for concentrated contention. Partition by a key only after proving all cross-key invariants and reassignment behavior. |
| In-memory state plus asynchronous durable writes | Materialized projection with replay/checkpoint | Valid only with a durable source log, bounded lag and idempotent replay. It is not equivalent to “memory is durable.” |
| Reserve/confirm/reverse | Saga with forward recovery/compensation | Canonical domain ownership remains this case for inventory lifecycle; generic saga mechanics belong to the distributed-transaction topic. |
| Queue offset tied to DB state | Checkpointed stream processor | Prefer an explicit checkpoint protocol and versioned state; if DB and log cannot commit together, document duplicate replay and dedupe. |
| Disruptor and non-blocking I/O | In-process low-latency queue/event loop | Optimize after profiling; neither removes broker, storage or network bottlenecks. Never perform blocking DB/compression work on an event loop. |
| Batch persistence | Write coalescing / bulk DB operations | Useful for throughput, but increases crash window and staleness; batch size and maximum age need SLOs. |
| “Eventual consistency” | Explicit consistency budget | Name each read model and its maximum acceptable staleness; inventory admission and financial settlement should not share the same budget blindly. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| One queue gives a simple order | Kafka order is normally per partition, not global; a single logical queue may hide partitioning | Content must name the ordering key and partition scope. |
| Async persistence is safe after replay | A crash after an external side effect and before a checkpoint can repeat the side effect | Use idempotency or transactional integration; replay alone is insufficient. |
| A single thread is high-throughput | It serializes work and can be blocked by one slow key or storage operation | Add bounded batching, sharding/failover and slow-key isolation. |
| 350k in-memory and 120k full-I/O are “throughput” | They measure different paths and may use different payloads/concurrency | Keep separate labels and do not infer production capacity. |
| 99% cache hit implies good performance | A hit can be stale, hot-key biased or measured before invalidation lag | Pair hit rate with freshness, invalidation lag, tail latency and correctness checks. |
| Compensation restores correctness | A compensating action may fail, arrive late or be forbidden after downstream side effects | Model pending/failed-compensation states and operator reconciliation. |
| More retries improve availability | Retries can amplify overload and duplicate reservations | Budget retries by deadline and make the operation idempotent. |

## Negative evidence and anti-patterns

- Do not copy the “one global processor” shape to a workload whose invariants span many keys or whose write rate exceeds one processor's bounded capacity.
- Do not call a Kafka delivery guarantee exactly-once for a MySQL side effect without describing the database boundary, consumer commit order and dedupe.
- Do not let the queue grow without a hard bound while the database is unavailable; this converts a dependency outage into process OOM and data loss.
- Do not use cache hit rate as a proxy for inventory correctness or freshness.
- Do not retry reserve, confirm or reverse blindly; a timeout may mean the original request committed.
- Do not use saga compensation to hide a missing business policy. A release after payment capture, picking or delivery may not be semantically reversible.
- Do not benchmark the Disruptor with an in-memory synthetic event and present the result as end-to-end inventory capacity.

## Operational, security, observability and testing concerns

- Metrics: per-key and global command lag, oldest unpersisted command age, ring occupancy, DB batch age/size/error rate, replay count, checkpoint age, reservation age by state, duplicate/late event count, compensation failure, negative-stock invariant violations and reconciliation delta.
- Traces: propagate a correlation/idempotency key from checkout through reserve, order result and compensation; record broker topic/partition/offset without putting customer or payment data in spans.
- Alerts: lag SLO breach, no checkpoint progress, queue saturation, replay storm, dead-letter growth, cache invalidation gap and reconciliation mismatch.
- Security: ACL command producers and consumers by topic/key scope; authenticate warehouse operators; authorize manual adjustments; sign/audit high-risk stock changes; encrypt transport and storage; redact customer/order identifiers in logs.
- Tests: model-based state-machine tests for reserve/confirm/reverse; property tests for quantity non-negativity and conservation; duplicate/out-of-order delivery; crash at every checkpoint boundary; broker replay; database deadlock/timeout; full queue/backpressure; partition failover; clock skew and expiration; load tests with Zipf-like hot-key distributions.
- Recovery drills: stop the processor after in-memory apply, after DB commit and after external publish; restore from the log; compare a rebuilt projection with authoritative inventory; rehearse manual reconciliation and reservation expiry.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic saga/orchestration/choreography | Topic `09-distributed-tx-fintech` (as recorded in the shared matrix) | Keep only the inventory reserve/confirm/reverse state machine and its domain trade-offs. |
| Generic outbox/relay semantics | Topic `09-distributed-tx-fintech` and Case 15 implementation evidence | Mention as an integration option; do not re-teach the outbox pattern here. |
| Generic queue delivery/order semantics | Topic `08-message-queue` | State the key-specific ordering requirement and point to the canonical topic. |
| Inventory/warehouse hot-key domain | This case | Own contention, quantity invariants, reservation lifecycle and warehouse/customer convergence. |
| General stream processing/checkpoint theory | Topic `08-message-queue` or future stream-processing owner | Use only the minimum needed to explain Arcturus recovery. |

## Integration record (applied 2026-08-23)

1. Add a small “contract before implementation” box defining inventory key, available/reserved quantity, authoritative source, command ID, checkpoint and maximum staleness.
2. Rewrite “one queue” as “one ordered stream per invariant/partition key” unless Tiki can provide evidence that the historical deployment truly used one global stream.
3. Turn the offset algorithm into a numbered state-transition table, including crash points and the exact moment a checkpoint is durable.
4. Label the three benchmark classes separately and add hardware, concurrency, payload, storage durability, test duration, percentile and warm-up fields; retain unknowns instead of estimating them.
5. Expand checkout integration with reservation TTL, idempotency key, late/duplicate events, terminal states and a reconciliation worker.
6. Add a backpressure section for persistence lag and a failover section for single-processor ownership.
7. Qualify “eventual consistency” by naming synchronous inventory admission versus eventual warehouse/reporting/search projections.
8. Replace the unqualified “1M tx/s” wording with “reported in-memory benchmark under the article's unspecified test conditions.”
9. Keep the Disruptor explanation short and link to the queue canonical topic; the domain invariant should remain the focus.

- [x] EN/VI HTML content updated with checkpoint/replay, crash-window, reservation-contract and benchmark-boundary qualifiers.
- [x] Historical metrics remain source-scoped; no unsupported capacity default was added.

## EN/VI and cross-reference plan

- Preserve identical section IDs and diagrams in EN/VI; add IDs to the three benchmark subheadings in both files if the content integration step permits.
- Translate the invariant vocabulary consistently: `available`, `reserved`, `committed`, `released`, `checkpoint`, `replay`, `duplicate`, `late event`, `compensation`, `reconciliation`.
- Keep product/library names and code identifiers unchanged; do not translate Kafka, MySQL, Disruptor or idempotency keys.
- Add the same caveat text and the same benchmark table to both languages. The current local EN/VI structure is substantially aligned, but the research dossier itself is not an applied content change.
- Cross-link from the generic saga and queue topics to this case for inventory-specific trade-offs, not the reverse for generic definitions.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| What exactly is the ordering key and partition count? | Historical deployment/configuration or architecture diagram | A cross-key invariant requiring global order, or measured hot-key skew that makes the chosen partition unsafe. |
| Is the command log durable before the in-memory mutation? | Broker durability, producer ack and retention configuration | A crash test showing accepted commands can disappear or replay cannot reconstruct state. |
| How are DB state and checkpoint committed? | Schema, transaction code or recovery run | A duplicate non-idempotent write after crash, or a DB checkpoint ahead of state. |
| How are reserve/confirm/reverse requests deduplicated and expired? | API contract, state table and sweeper metrics | Duplicate or late events change final quantity, or abandoned reservations exhaust stock. |
| What do 350k/120k/5,600 numbers measure? | Benchmark scripts, hardware, payload and test report | Reproduction materially below the claim under the same stated conditions, or the path excludes required work. |
| What happens when MySQL is unavailable for longer than the buffer? | Capacity/runbook and chaos test | Unbounded memory growth, silent command loss or unsafe admission. |
| Can one processor fail over without split-brain? | Lease/fencing and failover drill | Two owners mutate the same key or failover loses ordering. |
| Is 99% cache hit compatible with the inventory freshness policy? | Hit/miss and invalidation-age telemetry | A high hit rate coexists with customer-visible stale/oversold decisions. |

## Discovery pool and exclusions

The discovery pool contained approximately 40 candidates; 27 distinct sources were selected for the ledger below. Duplicate mirrors of the Tiki article (including the Medium repost), generic “microservices best practices” posts, search-result snippets, and vendor marketing pages without a guarantee or implementation detail were excluded. The final ledger favors standards, official product documentation, original papers and first-party engineering reports; it is not a 200-link bibliography.

## Sources

All sources were reviewed on 2026-08-23. “Current page” means the page was live at review time; where a page did not expose a revision, that is recorded rather than inferred.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Arcturus: Inventory Processing System](https://engineering.tiki.vn/arcturus-inventory-processing-system/) — Tiki Engineering | T1 first-party; article posted 2021-09-19; historical 2019 system | Local problem, architecture, offset replay, processing model, integrations and reported benchmarks. |
| 2 | [Kafka Design](https://kafka.apache.org/40/design/design/) — Apache Kafka | T1 official; Kafka 4.0 documentation page | Log/partition/offset model; default at-least-once and exactly-once scope limits. |
| 3 | [Kafka semantics](https://kafka.apache.org/documentation/#semantics) — Apache Kafka | T1 official; current documentation, revision not stated | Producer/consumer delivery and ordering claims that must be scoped to partitions and commit behavior. |
| 4 | [InnoDB transaction isolation](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) — Oracle MySQL | T1 official; MySQL 8.4 Reference Manual | Isolation levels, snapshot reads and the difference between database isolation and cross-service atomicity. |
| 5 | [InnoDB locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) — Oracle MySQL | T1 official; MySQL 8.4 Reference Manual | `FOR UPDATE`/`FOR SHARE`, locking behavior and why lock scope/indexes matter. |
| 6 | [InnoDB lock waits](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-understanding-innodb-locking.html) — Oracle MySQL | T1 official; MySQL 8.4 Reference Manual | Blocked transactions, lock queues and operational diagnostics. |
| 7 | [LMAX Disruptor User Guide](https://lmax-exchange.github.io/disruptor/user-guide/) — LMAX Exchange | T1 first-party; 4.0.0-SNAPSHOT page at review | Ring buffer, preallocation, consumer sequences and the fact that it is an in-process messaging library. |
| 8 | [Disruptor design](https://lmax-exchange.github.io/disruptor/disruptor.html) — LMAX Exchange | T1 first-party; revision not stated | Single-writer/cache-friendly rationale and bounded-buffer limitations. |
| 9 | [Java concurrency package](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html) — Oracle | T1 official; Java SE 21 API | Java executor/concurrency primitives and why an in-process queue does not supply durable delivery. |
| 10 | [Vert.x Core](https://vertx.io/docs/vertx-core/java/) — Eclipse Foundation | T1 official; current page, revision not stated | Event-loop non-blocking rule and danger of blocking DB/compression work on the event loop. |
| 11 | [Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) — AWS | T1 official guidance; current page | Local transactions, eventual consistency, forward recovery and compensation. |
| 12 | [Saga orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) — AWS | T1 official guidance; current page | Orchestrator responsibilities, observability and idempotent participants. |
| 13 | [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox) — Chris Richardson / Microservices.io | T2 canonical pattern reference; current page | DB-plus-message atomicity problem, relay crash duplicate and consumer idempotency. |
| 14 | [Polling publisher](https://microservices.io/patterns/data/polling-publisher.html) — Microservices.io | T2 pattern reference; current page | Outbox relay ordering and polling trade-offs. |
| 15 | [Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) — Debezium | T1 official implementation docs; stable docs at review | A concrete CDC/outbox option and its schema/routing assumptions; not evidence that Arcturus used it. |
| 16 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — Amazon Builders’ Library | T1 first-party; current article | Request IDs, semantic equivalence, late-arriving requests and retry-safe side effects. |
| 17 | [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — Amazon Builders’ Library | T1 first-party; current article | Retry amplification, timeout budgets and jitter; exact service values remain workload-specific. |
| 18 | [Exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — AWS Architecture Blog | T1 first-party; updated 2023-05 | Why synchronized retries create load spikes and why backoff/jitter helps. |
| 19 | [Handling overload](https://sre.google/sre-book/handling-overload/) — Google SRE | T1 first-party; SRE book chapter | Queue growth, load shedding, degraded responses, retry budgets and overload protection. |
| 20 | [Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | T1 first-party; SRE book chapter | Retry/load amplification, queue memory, crash cascades and early rejection. |
| 21 | [Production services best practices](https://sre.google/sre-book/service-best-practices/) — Google SRE | T1 first-party; SRE book chapter | Load testing beyond rated capacity, dynamic timeouts, graceful degradation and retry jitter. |
| 22 | [RabbitMQ reliability guide](https://www.rabbitmq.com/docs/reliability) — RabbitMQ | T1 official; current docs | A broker comparison point: acknowledgements, redelivery and recovery are separate from application side effects. |
| 23 | [Exactly-once delivery](https://cloud.google.com/pubsub/docs/exactly-once-delivery) — Google Cloud Pub/Sub | T1 official; current docs | Exactly-once is a provider/region/client-library scoped feature, not a universal distributed transaction. |
| 24 | [OpenTelemetry messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) — OpenTelemetry | T1 specification; development status, semconv 1.44.0 registry | Producer/consumer/process/settle spans, message context propagation and low-cardinality attributes. |
| 25 | [CloudEvents specification](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md) — CNCF CloudEvents | T1 specification; v1.0.2 | Portable event envelope and correlation metadata; does not define delivery or business idempotency. |
| 26 | [AWS Well-Architected Framework](https://docs.aws.amazon.com/pdfs/wellarchitected/2024-06-27/framework/wellarchitected-framework-2024-06-27.pdf) — AWS | T1 official; 2024-06-27 revision | Idempotency-token and reliability guidance; not a substitute for a case-specific invariant proof. |
| 27 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | T1 Internet Standard; RFC 9110, June 2022 | HTTP method semantics and why ordinary HTTP calls do not create a shared transaction across services. |
