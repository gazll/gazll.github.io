# Research — Shopify MySQL inventory reservations

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `16-shopify-mysql-inventory-reservations`

EN file: `public/data/case-studies/articles/16-shopify-mysql-inventory-reservations.html`

VI file: `public/data/case-studies/articles/16-shopify-mysql-inventory-reservations.vi.html`

Metadata: the paired case-study metadata JSON and article files were read in full.

## Scope and evidence posture

This case study is about a first-party Shopify migration from a Redis-backed reservation design to MySQL-backed inventory reservations. The engineering article was published on 2026-05-12 and reports Shopify's workload, constraints, measured outcomes and migration approach. Those observations are valuable primary evidence, but they are not a universal claim that MySQL is better than Redis or that a fixed row limit fits every shop.

The central question is authority: can the operation that consumes inventory observe and enforce the same reservation state atomically, under a bounded contention model? Redis transactions can serialize Redis commands, but they do not make an unrelated MySQL write part of the same transaction. A MySQL row-lock design can make reservation and inventory state share a transaction boundary, while moving pressure to row locks, connections, deadlocks, I/O and database capacity. The recommendation therefore depends on the invariant, contention shape, reservation lifetime and connection budget.

Discovery used a broader pool of official Shopify, MySQL, Redis, PostgreSQL, AWS, DynamoDB, ProxySQL, Stripe and OpenTelemetry material. The ledger below selects 26 distinct sources. Product documentation is version/provider scoped; the Shopify numbers remain Shopify-specific and should be remeasured before adoption.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `1-the-invariant-before-the-technology` | Starts with no oversell and reservation semantics before choosing Redis or MySQL. |
| `2-why-the-redis-design-became-expensive` | Describes cross-store coordination and operational cost in the former design. |
| `3-a-hot-counter-cannot-scale-by-wishing` | Explains contention on a popular inventory counter. |
| `4-bounded-unit-rows-and-inline-replenishment` | Introduces one-row-per-unit reservations, bounded capacity and reclamation. |
| `5-innodb-details-became-architecture` | Covers `SKIP LOCKED`, primary keys, isolation, lock order and deadlocks. |
| `6-batching-the-cart-without-changing-correctness` | Uses one transaction and batched SQL for multi-item carts. |
| `7-the-bottleneck-was-connection-occupancy` | Identifies database connection occupancy, not only query latency, as the limiting resource. |
| `8-shadow-mode-and-the-decision-boundary` | Describes shadow validation and a workload-specific migration decision. |
| `9-design-review-questions` | Provides questions for capacity, correctness, migration and operations review. |

## Local claims: fact, inference and qualification

| Local claim or design move | Evidence status | Research qualification |
| --- | --- | --- |
| Shopify moved reservations from Redis to MySQL to align reservation state with inventory authority. | First-party fact in S02; local summary in S01. | Treat as Shopify's architecture decision and rationale, not a general database ranking. |
| Redis `MULTI`/`EXEC` provides atomic execution of queued Redis commands. | Verified by S10. | This is atomic within Redis. It does not make a Redis mutation and a separate SQL transaction atomic together. |
| A Redis counter is difficult when cart reservation and inventory decrement have different authorities. | Inference from S02, S10 and the stated invariant. | The difficulty is a coordination boundary; a carefully designed single-store Redis authority can still be valid. |
| One row per inventory unit bounds the number of reservable units and makes a claim a row-lock operation. | First-party Shopify design detail in S02; mechanism verified by S03/S08. | It increases row count and write amplification. The 1,000-unit batch/cap described by Shopify is a workload choice, not a theorem. |
| `SELECT ... FOR UPDATE SKIP LOCKED` is useful for concurrent reservation workers. | Verified syntax/semantics in S03; Shopify reports using it in S02. | `SKIP LOCKED` returns an inconsistent view and is appropriate for queue-like allocation, not ordinary reporting. |
| `READ COMMITTED` can avoid a particular InnoDB gap/supremum-lock interaction. | First-party Shopify observation in S02; isolation behaviour documented in S04. | The exact lock graph depends on indexes, predicates, foreign keys and statement shape. Benchmark the actual schema. |
| Locking rows in a deterministic order lowers deadlock risk. | Recommendation supported by S06 and Shopify's S02 design. | It reduces one class of cycles; it cannot eliminate deadlocks caused by other resources or transactions. Retry remains necessary. |
| Reusing a DB connection for a reservation path can be more important than shaving query time. | Shopify measurement/interpretation in S02; operationally consistent with S17/S20. | Need application pool, transaction duration and saturation metrics before asserting this is the bottleneck elsewhere. |
| Shadow mode can compare old and candidate reservation decisions before cutover. | Shopify migration practice in S02; recommendation. | Shadow reads must not mutate stock, leak customer data or add enough load to change the production workload. |

## Workload and invariant model

| Dimension | Explicit model for this case | What must be measured |
| --- | --- | --- |
| Authority | One inventory authority decides whether a reservation is accepted; the order/checkout result references that decision. | Which service owns stock, whether writes can bypass it, and replica lag on read paths. |
| Capacity | `available_units = physical_or_sellable_units - active_reservations - committed_sales` under the selected business policy. | SKU-level stock, reservation TTL, replenishment rate, cancellation rate and oversell tolerance. |
| Reservation | A reservation has an owner/cart or idempotency key, expiry and state; expiry must not silently release a newer reservation. | Duplicate request rate, retry windows, clock skew, expiry sweeper lag and recovery semantics. |
| Contention | Hot SKUs receive many concurrent claims; cold SKUs dominate total volume. | Hot-key percentile, concurrent claimers per SKU, queue wait and lock wait. |
| Transaction | Claim/release/replenish operations have a bounded transaction and an explicit lock order. | Transaction duration, rows locked, deadlocks, retries, rollback time and connection occupancy. |
| Batch | A cart may claim several items in one logical action; partial success policy must be explicit. | Cart size distribution, all-or-nothing rate, batch SQL duration and lock footprint. |
| Storage | Unit rows make claimable capacity explicit; a quantity counter is smaller but requires a safe conditional update. | Row count, index size, page hotness, vacuum/purge/maintenance and backup/restore time. |
| Availability | During DB degradation the system chooses fail-closed, bounded queueing or a clearly bounded fallback. | RTO/RPO, acceptable checkout errors, failover time and whether a fallback can oversell. |

Required invariants should be written as testable properties:

1. A successful reservation has exactly one authoritative owner and an expiry/state transition.
2. The system never commits more sellable inventory than the policy allows, including retries and timeouts whose outcome is unknown.
3. A release or expiry is conditional on the reservation identity/version; a late release cannot cancel a newer claim.
4. A retried request is idempotent for the same business key, or the caller receives an explicit unknown outcome rather than a second reservation.
5. Every accepted reservation is observable with a correlation ID, SKU, quantity, state transition and database transaction outcome without recording unnecessary personal data.

## Failure and crash windows

| Window | Possible outcome | Required control/recovery |
| --- | --- | --- |
| Client times out after commit | Client retries; a second reservation or duplicate order may be created. | Idempotency key plus durable reservation result lookup; do not infer failure from the timeout. See S18/S19. |
| Process dies after row lock, before commit | InnoDB rolls back when the transaction/connection is terminated. | Bounded transactions, connection cleanup and metrics for rollback/lock wait. Verify on the deployed engine. |
| Process dies after commit, before response | Reservation exists but caller does not know. | Idempotent read/retry endpoint and reconciliation; do not blindly release. |
| Two carts contend for the same unit rows | One claims rows; another skips or waits, depending on query. | Use `SKIP LOCKED` only for allocation semantics; return insufficient stock explicitly and test fairness. |
| Lock order differs between code paths | Deadlock; one transaction is aborted. | Canonical ordering, short transactions, bounded exponential retry with idempotent operation. S06 documents deadlocks as expected and retryable, not impossible. |
| Reservation expires while checkout commits | Release and commit race; old expiry can steal/cancel new state. | Conditional state/version update in the same authority and explicit transition rules. |
| Replica is read for availability | Stale stock display or checkout decision. | Route correctness-critical decision to primary/authority; replicas are for non-authoritative reads. |
| DB connection pool is exhausted | Requests queue at the pool; latency and timeout load amplify. | Pool saturation/borrow time, circuit breaking, admission control and capacity tests; do not increase pool without DB headroom. |
| Shadow path doubles database work | Candidate comparison changes the production bottleneck. | Sample, rate-limit, isolate read-only work and prove no mutation. |
| Failover or restore returns an older snapshot | Reservations and external orders diverge. | Define RPO, reconcile from order/payment truth, test restore and make the reconciliation idempotent. |

## Pattern comparison

| Pattern | Correctness boundary | Strength | Main failure/cost | Fit here |
| --- | --- | --- | --- | --- |
| Redis counter plus SQL order write | Usually split unless all authority is Redis or an explicit protocol exists. | Low latency and small state for a single-store counter. | Cross-store unknown outcomes, reconciliation and oversell risk under retries. | Use only when the business can accept/reconcile that boundary or Redis is the true authority. |
| MySQL quantity row with conditional update | One SQL transaction can own the decision. | Compact storage and clear `UPDATE ... WHERE available >= n` predicate. | Hot-row serialization, retry/deadlock pressure and careful release/expiry logic. | Good when SKU count is large and contention is manageable. |
| MySQL one-row-per-unit with `SKIP LOCKED` | Locked unit rows in one authority. | Bounded claimable units; concurrent workers can skip occupied rows. | More rows/indexes; fairness is not guaranteed; inconsistent reads if misused. | Shopify's reported fit for bounded inventory and reservation workers. |
| Queue/worker claim | Queue lease/claim is authority if the workflow is modeled that way. | Natural backpressure and retry visibility. | Queue lag, duplicate delivery and stale leases; checkout UX becomes asynchronous. | Useful for non-immediate allocation, not a drop-in replacement for synchronous checkout. |
| Redis script / Lua | Atomic inside Redis. | One round trip and application logic near the counter. | Still cannot atomically commit an external order; script CPU/replication semantics need review. | Valid if Redis is the authoritative inventory ledger and downstream is reconciled. |
| DynamoDB conditional/transactional write | Item/transaction boundary in DynamoDB. | Conditional writes and managed horizontal scale. | Partition-key design, transaction limits/cost and cross-system effects remain. | Viable alternative; benchmark provider-specific contention and consistency. |

## Coverage matrix

| Required coverage | Status | Evidence/decision |
| --- | --- | --- |
| Definitions | Covered | Reservation, unit row, hot key, authority, `SKIP LOCKED`, connection occupancy defined above; S02–S04. |
| Invariants | Covered | No oversell, identity/version-safe release, idempotent retry, one authority. |
| Workload | Covered | Hot/cold SKU mix, cart batch, TTL, row count and pool constraints. |
| Failure/crash windows | Covered | Timeout-after-commit, deadlock, expiry race, failover, pool exhaustion and shadow load. |
| Retries/timeouts | Covered | Idempotency and unknown outcome; deadlock retry is bounded and conditional. |
| Operations/recovery | Covered | Lock/connection/transaction metrics, restore/RPO, reconciliation and shadow cutover. |
| Security/privacy | Partial | Access to reservation rows, tenant/store isolation, least privilege and redaction must be added from deployment context; this case is primarily data correctness. |
| Testing | Covered | Concurrency/property tests, failpoints, hot-key load, deadlock injection, restore and shadow safety. |
| Domain trade-offs | Covered | Flash sale, normal catalogue, perishable/expiry, multi-location and asynchronous allocation differ. |

## Contradictions and limits

| Apparent conflict | Resolution/scope |
| --- | --- |
| “Redis transactions are atomic” vs “Redis cannot solve this.” | Both can be true: Redis commands are atomic within Redis; an external SQL/order mutation is a separate boundary. |
| `SKIP LOCKED` improves concurrency vs it can be unsafe. | It is useful for claim/queue allocation; it is not a generally consistent read and can skip locked rows or produce unfairness. |
| `READ COMMITTED` reduces a lock issue vs default MySQL isolation is `REPEATABLE READ`. | Isolation is a workload/schema decision. Scope the change to the reservation connection/transaction if possible and verify all code paths. |
| One row per unit makes capacity explicit vs it increases storage. | The design exchanges storage/index work for bounded row-level claims. A large quantity or multi-dimensional stock model may favor another schema. |
| Larger connection pools improve throughput vs connection occupancy is the bottleneck. | More connections can increase concurrency only until CPU/I/O/lock contention; pool size must be capacity-tested. |
| Shopify's measured improvement vs local adoption. | First-party measurements establish plausibility and a migration method, not a portable SLO or cost outcome. |

## Negative evidence and anti-patterns

- Do not claim that moving a counter from Redis to MySQL automatically prevents oversell; the invariant, transaction boundary and retry identity still need implementation.
- Do not use `SKIP LOCKED` for a customer-facing availability count and call the result exact. Its documented semantics are intentionally inconsistent under contention.
- Do not release a reservation by SKU and cart alone if a later reservation can reuse the same identity; use a reservation ID/version/state predicate.
- Do not “fix” pool timeouts by increasing `max_connections` without measuring database CPU, I/O, lock waits and transaction duration.
- Do not run shadow writes, expiry jobs or reconciliation without proving they are idempotent and cannot mutate live stock twice.
- Do not use replica reads for the final stock decision unless stale results are explicitly safe.
- Do not present the Shopify 1,000-row boundary, timings or connection findings as a universal capacity limit.

## Duplicate and canonical ownership

| Topic | Canonical role | Boundary |
| --- | --- | --- |
| Case 16 | Canonical applied case for inventory contention, bounded unit rows, MySQL locking and migration validation. | Keep Shopify-specific measurements and inventory schema decisions here. |
| Case 11 | Canonical peak/hot-deal architecture. | Owns admission control, price/catalog fan-out and peak traffic; link to Case 16 for inventory authority rather than repeating it. |
| Topic 08 | Canonical broker delivery/ordering/backpressure mechanics. | Owns queue semantics; it does not own the inventory invariant. |
| Topic 09 | Canonical fintech/distributed workflow correctness. | Owns money/ledger/saga/unknown outcomes; use its idempotency principles without importing financial guarantees into stock. |
| Case 15 | Canonical order outbox/inbox workflow. | Owns DB-to-event publication; inventory claim remains this case's concern. |
| Case 12 | Canonical duplicate booking race. | Owns request-level race and idempotency failure; this case applies the same discipline to inventory rows. |

## EN/VI parity review

The EN and VI files describe the same Shopify migration, reservation model, MySQL details, migration validation and review questions. Content integration was applied on 2026-08-23 while preserving the same caveats: Shopify-specific evidence, no universal 1,000-row rule, `SKIP LOCKED`'s inconsistent-read semantics, and connection occupancy as a hypothesis to measure.

## Applied changes (2026-08-23)

### English

1. Make the authority invariant the first acceptance criterion and state that Redis atomicity is single-store only.
2. Label Shopify's 1,000-unit cap, timings, row shape and connection findings as measured design parameters, not defaults.
3. Add a concrete reservation state machine (`ACTIVE → COMMITTED|RELEASED|EXPIRED`) with identity/version-conditional transitions.
4. Add an explicit timeout-after-commit/idempotency section and a recovery path for unknown checkout outcomes.
5. Clarify that `SKIP LOCKED` is for claim allocation and not an exact availability read.
6. Add operational SLOs for lock wait, deadlocks, pool borrow time, transaction duration, expiry lag and reconciliation drift.

### Vietnamese

1. Đưa invariant “không oversell” và authority của inventory lên trước lựa chọn Redis/MySQL.
2. Gắn nhãn các con số/cap của Shopify là kết quả đo theo workload, không phải mặc định chung.
3. Bổ sung state machine của reservation và điều kiện version/identity khi release hoặc expire.
4. Bổ sung trường hợp timeout sau commit, idempotency key và cách tra cứu kết quả chưa biết.
5. Nói rõ `SKIP LOCKED` phục vụ claim/queue allocation, không phải phép đếm tồn kho chính xác.
6. Bổ sung metric và runbook cho lock wait, deadlock, pool borrow time, transaction, expiry lag và reconciliation.

## Open questions and falsifiers

1. Is the local product inventory single-location, multi-location, or batch/lot constrained? A unit-row schema may change materially with those dimensions.
2. What are the real p50/p95/p99 claims per SKU, cart size, reservation TTL and hot-key concurrency?
3. What is the acceptable oversell, false-out-of-stock and checkout-latency budget?
4. Can all order/payment/release paths use the same reservation authority, or do partner/warehouse systems bypass it?
5. What is the required RPO for active reservations and the reconciliation source after restore/failover?
6. What is the database connection budget after including background expiry, reporting, shadow reads and admin tools?
7. Which exact MySQL 8.x patch level, indexes, foreign keys and isolation settings are deployed?

The recommendation to adopt a MySQL row-lock design would be weakened or falsified if measured contention shows lock/connection saturation before the expected checkout SLO, if inventory is too large or multi-dimensional for unit rows, if cross-region writes require a different authority, or if restore/reconciliation cannot preserve the reservation invariant. The recommendation to keep Redis as the authority would be weakened if cross-store reconciliation produces unknown outcomes/oversells that cannot be bounded and the business requires one durable transaction boundary.

## Source ledger

All sources were reviewed on `2026-08-23`. Tier `S1` means official first-party documentation or the original engineering report; `S2` means standards/primary technical paper or provider documentation of narrower scope; `S3` means local repository content.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | Local EN/VI case files listed above — repository case study | S3; reviewed 2026-08-23 | Local section map, Shopify migration narrative, local design parameters and review questions. |
| S02 | [Scaling inventory reservations](https://shopify.engineering/scaling-inventory-reservations) — Shopify Engineering | S1; published 2026-05-12 | Shopify's Redis-to-MySQL rationale, bounded inventory rows, `SKIP LOCKED`, isolation/locking details, batching, connection occupancy, shadow mode and reported measurements. |
| S03 | [Locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) — MySQL 8.4 Reference Manual | S1; MySQL 8.4/current | `FOR UPDATE`, `FOR SHARE`, lock scope and `SKIP LOCKED`/`NOWAIT` semantics and inconsistent-read warning. |
| S04 | [InnoDB transaction isolation levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) — MySQL | S1; MySQL 8.4/current | `REPEATABLE READ` default and differences among `READ COMMITTED`, `REPEATABLE READ` and other levels. |
| S05 | [InnoDB transaction model](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-model.html) — MySQL | S1; MySQL 8.4/current | Transaction boundaries, consistent reads and locking reads in InnoDB. |
| S06 | [Deadlocks in InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html) — MySQL | S1; MySQL 8.4/current | Deadlocks are possible, one transaction is rolled back, and applications should retry transactions safely. |
| S07 | [Performance Schema `data_locks` table](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-data-locks-table.html) — MySQL | S1; MySQL 8.4/current | Inspecting held/requested data locks for diagnosis; observation is not itself a correctness fix. |
| S08 | [Clustered and secondary indexes](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html) — MySQL | S1; MySQL 8.4/current | InnoDB clustered primary-key storage and why key/index shape affects row access and lock footprint. |
| S09 | [Metadata locking](https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html) — MySQL | S1; MySQL 8.4/current | DDL/metadata locks can block concurrent operations and need operational scheduling. |
| S10 | [Transactions](https://redis.io/docs/latest/develop/using-commands/transactions/) — Redis | S1; Redis current docs | `MULTI`/`EXEC` command queuing/atomic execution, `WATCH` optimistic concurrency and lack of rollback semantics. |
| S11 | [Programmability with Lua/EVAL](https://redis.io/docs/latest/develop/programmability/eval-intro/) — Redis | S1; Redis current docs | Lua scripts execute atomically in Redis and have script determinism/resource considerations; external stores remain outside the boundary. |
| S12 | [PostgreSQL `SELECT`](https://www.postgresql.org/docs/current/sql-select.html) — PostgreSQL project | S1; current PostgreSQL docs | PostgreSQL row locks, `SKIP LOCKED`, `NOWAIT` and the queue-like/inconsistent-read qualification. |
| S13 | [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — PostgreSQL project | S1; current PostgreSQL docs | Provider-specific isolation and serialization behaviour; alternatives are not interchangeable with MySQL defaults. |
| S14 | [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) — PostgreSQL project | S1; current PostgreSQL docs | Uniqueness/check constraints as database-enforced invariants, with provider-specific syntax and timing. |
| S15 | [Condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html) — Amazon DynamoDB | S1; current docs | Conditional writes as an alternative single-item concurrency boundary and their expression/key scope. |
| S16 | [Transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) — Amazon DynamoDB | S1; current docs | DynamoDB transaction boundaries and limits/cost trade-offs for an alternative design. |
| S17 | [ProxySQL multiplexing](https://proxysql.com/documentation/multiplexing/) — ProxySQL | S1; current docs | Connection multiplexing eligibility and constraints; pooling/proxying does not remove transaction/lock occupancy. |
| S18 | [ProxySQL statistics](https://proxysql.com/documentation/stats/) — ProxySQL | S1; current docs | Query, connection and hostgroup statistics useful for locating pool/proxy saturation. |
| S19 | [Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) — AWS Well-Architected | S1; current framework | Failure recovery, tested recovery procedures, observability and workload-specific reliability decisions. |
| S20 | [Performance Efficiency Pillar](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html) — AWS Well-Architected | S1; current framework | Load testing, demand/resource matching, monitoring and capacity selection rather than topology-based guesses. |
| S21 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — Amazon Builders' Library | S1; first-party guidance | Retry ambiguity, caller-request identity and avoiding duplicate side effects. |
| S22 | [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Stripe | S1; current API docs | Provider-specific idempotency-key retention/parameter semantics; example of an external API contract, not a universal default. |
| S23 | [Database spans](https://opentelemetry.io/docs/specs/semconv/db/database-spans/) — OpenTelemetry | S1; semantic conventions current | Database span attributes and instrumentation guidance for latency/error/operation visibility; avoid sensitive values. |
| S24 | [Histograms and summaries](https://prometheus.io/docs/practices/histograms/) — Prometheus | S1; current docs | Percentile/latency measurement trade-offs for lock wait, pool borrow and reservation path SLOs. |
| S25 | [MySQL transaction statements](https://dev.mysql.com/doc/refman/8.4/en/commit.html) — MySQL | S1; MySQL 8.4/current | Explicit `COMMIT`/`ROLLBACK` boundaries and the need to verify when autocommit/application frameworks change behaviour. |
| S26 | [InnoDB performance monitoring](https://dev.mysql.com/doc/refman/8.4/en/innodb-monitoring.html) — MySQL | S1; MySQL 8.4/current | Engine monitoring counters and diagnostic approach for lock, transaction and internal pressure. |

## Gate status

- [x] Complete EN/VI sections and metadata read.
- [x] First-party Shopify evidence separated from portable database semantics.
- [x] Discovery pool broadened; selected ledger has 26 distinct sources.
- [x] Workload, invariants, crash windows, comparison, coverage, limits, anti-patterns and falsifiers recorded.
- [x] Duplicate/canonical ownership and EN/VI parity recorded.
- [ ] Production schema, MySQL patch level, workload traces and RPO/RTO verified.
- [x] EN/VI content integration applied.
- [x] Validation passed after integration.
