# Batch B Research — scarce resources, inventory, seats, and booking

Status: `INTEGRATED`

Reviewed: 2026-08-23

Public-data integration: applied 2026-08-23

This dossier is the Batch B synthesis layer. The per-unit research records remain the evidence ledger; this file decides which mechanism is canonical, which business evidence must stay local, and what must be true before another public-data edit.

## Scope and exact local units

Batch B covers one project topic and four domain/implementation cases:

| Unit | Exact local content | Canonical job in this batch |
| --- | --- | --- |
| Topic 16 | `16-project-concurrency-whiteboard.presenting-dissecting-the-ota-project.q1-q5`; `technical-storytelling-fundamentals.q1-q7`; `whiteboard-dsa.q1-q4` | OTA authority model, hold/booking/payment/ticketing state, WebSocket recovery, limiter modes, and interview framing |
| Case 01 | HTML anchors `introduction`, `inventory-problems`, `approaches`, `architecture`, `consistency-model`, `processing-model`, `checkout-integration`, `warehouse-integration`, `overall-architecture`, `benchmark`, `Throughput`, `Latency`, `Cache Hit.`, `conclusion` | Reported Arcturus/Tiki inventory architecture, ordered processing, replay and benchmark limits |
| Case 11 | HTML anchors `1-oversold-deal-problem`, `2-the-old-deal-solution`, `2-1-change-the-deal-price-process`, `2-2-close-deals-process`, `3-the-new-deal-solution`, `3-1-price-system-replicate-the-deal-price-process`, `3-2-arcturus-inventory-process`, `3-3-checkout-process`, `3-4-system-architecture` | Flash-sale admission, price identity, deal quota, overload controls, and source-scoped Tiki evidence |
| Case 12 | HTML anchors `context`, `evidence`, `race`, `false-fix`, `recurrence`, `correct-fix`, `verification`, `limits`, `takeaways`, `anonymisation` | Concrete duplicate-booking race, HTTP method safety, row version winner, and what that fix does not prove |
| Case 16 | HTML anchors `1-the-invariant-before-the-technology` through `9-design-review-questions` | Shopify-specific Redis-to-MySQL reservation migration, bounded unit rows, MySQL locking, connection occupancy, and shadow validation |

Do not merge these into a generic Saga or distributed-lock tutorial. Topic 16 owns the OTA project narrative; Case 01 owns its reported inventory processor; Case 11 owns peak-sale admission; Case 12 owns the request race; Case 16 owns the Shopify/MySQL implementation evidence.

## Evidence policy and source accounting

The five per-unit dossiers each inspected a selected ledger of at least 20 distinct sources. Their candidate discovery pools were broader and were not padded to reach 200. The union contains substantial overlap around PostgreSQL/MySQL locking, Redis, SRE overload, Kafka, WebSocket, idempotent APIs, Kubernetes leases, OpenJDK concurrency, and AWS patterns; duplicate URLs are retained once in the synthesis map.

The strongest current evidence is:

- database authority and lock scope: [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [PostgreSQL concurrency control](https://www.postgresql.org/docs/current/mvcc.html), MySQL 8.4 locking reads and transaction-isolation records in Case 16/12;
- lease coordination and its boundary: [Kubernetes Leases](https://kubernetes.io/docs/concepts/architecture/leases/) and [Redis distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/);
- live-client transport: [RFC 6455 WebSocket](https://www.rfc-editor.org/rfc/rfc6455.html), plus the Topic 16 WebSocket/reconnect evidence;
- overload/admission: [Google SRE handling overload](https://sre.google/sre-book/handling-overload/), [Google SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/), and AWS load-shedding/retry guidance;
- inventory implementation evidence: [Shopify scaling inventory reservations](https://shopify.engineering/scaling-inventory-reservations), [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html), and the version-scoped MySQL transaction/deadlock sources in Case 16;
- external workflow boundaries: AWS Saga/Outbox guidance, AWS idempotent APIs, Stripe provider idempotency, Kafka/RabbitMQ delivery docs, and the Topic 09/08/17 canonical units already integrated in Batch A.

Shopify and Tiki numbers are case evidence, not portable capacity limits. The Tiki source-access limitation is explicit in Case 11: the linked first-party pages were not fully fetchable during review, so reported timings/components remain local-case observations until manually verified.

## Decision thesis

Scarce-resource correctness has four different authorities that must not be collapsed:

1. **Projection authority**: search, catalog, fare, price, and availability views can be stale and rebuildable.
2. **Admission authority**: a conditional write or transactional inventory service decides whether a scarce unit/quota is actually held.
3. **Workflow authority**: a durable order/booking state machine records the command identity, pending/unknown outcome, expiry, compensation, and reconciliation owner.
4. **External authority**: a GDS, airline, PSP, warehouse or provider may decide the final outcome outside the local transaction.

A lock or lease only coordinates workers. The admission authority must reject stale or duplicate writes through a constraint, conditional update, version/fencing token, or an explicitly scoped single-store transaction. A WebSocket only carries live updates. A queue only supplies its own delivery/retention contract. A Saga only supplies a recovery protocol; compensation is a new business action, not database rollback.

## Canonical ownership map

| Concern | Canonical owner | Keep in Batch B units |
| --- | --- | --- |
| Conditional DB write, row lock, unique constraint | Topic 05 | Case-specific schema and measured lock footprint |
| Lease expiry and fencing | Topic 28 | Why an OTA worker, scheduled job, or inventory claim needs stale-writer rejection |
| Broker ACK/order/replay/DLQ | Topic 08 | Why an inventory or booking workload chooses a command queue or keyed log |
| Saga/Outbox/provider unknown | Topic 09 | OTA hold/payment/ticketing transitions and provider-specific reconciliation |
| API idempotency/result/error/202 | Topic 17 | Booking and reservation endpoint contract only |
| Retry storm/pool/cache/observability | Topic 25 | Project-specific metrics and overload decision |
| OTA authority and state machine | Topic 16 | Full project narrative and reusable OTA whiteboard |
| Arcturus ordered inventory processor | Case 01 | Historical/report-specific architecture, replay and benchmark limits |
| Tiki hot-deal admission | Case 11 | Price/deal-quota/inventory boundary and source caveats |
| Duplicate booking repair | Case 12 | HTTP method bug, row-version winner and regression test evidence |
| Shopify MySQL reservations | Case 16 | Unit-row design, `SKIP LOCKED`, lock order, batching, pool occupancy and shadow migration |

## Invariants and state machines

### Reservation/inventory invariant

For a scarce resource `r`, a successful admission must satisfy:

```text
accepted(r, intent, expectedVersion)
  => authoritative state changed exactly once
  && reservation identity is durable
  && expiry/release is conditional on identity/version
  && the committed sellable quantity remains within policy
```

The exact quantity formula is domain-owned. A unit-row design, a conditional quantity update, a quota ledger, or a provider hold can all be valid. Redis atomicity is sufficient only if Redis is the chosen authority for the complete invariant; a Redis mutation plus a separate SQL order write is a dual-write boundary.

### OTA state machine

```text
SEARCH_PROJECTION
    -> QUOTED(expiry, priceVersion)
    -> HELD(holdId, owner, expiry, version)
    -> BOOKING(orderId, commandId)
    -> PAYMENT_PENDING / PAYMENT_UNKNOWN
    -> TICKET_PENDING / TICKETED

HELＤ -> EXPIRED | RELEASED | REPRICE_REQUIRED
BOOKING -> FAILED | MANUAL_REVIEW
PAYMENT_UNKNOWN -> CONFIRMED | FAILED | RECONCILIATION_REQUIRED
TICKET_PENDING -> TICKETED | REFUND_PENDING | MANUAL_REVIEW
```

The spelling of the states can remain local to the content. The required properties are visible pending/unknown states, terminal-state transition rules, stable identities, expiry, and a recovery owner. A late provider callback must not overwrite a newer terminal state without an explicit versioned transition or reconciliation policy.

### Inventory reservation state machine

```text
AVAILABLE -> ACTIVE(reservationId, owner, expiresAt, version)
ACTIVE -> COMMITTED | RELEASED | EXPIRED
EXPIRED/RELEASED -> AVAILABLE
```

Every release/expiry must include the reservation identity or version. A late sweeper must not release a newer reservation that reused the same SKU/unit. A retry after a lost response must read the durable reservation result or return an explicit unknown state; it must not create a new business key by default.

## Workload and failure model

| Workload dimension | Must be stated before choosing a mechanism |
| --- | --- |
| Hot-key skew | p50/p95/p99 concurrent claimers per SKU/seat, last-unit contention, fairness requirement |
| Read/write split | browse/search/price read volume versus authoritative hold/commit/cancel writes |
| Batch shape | cart size, all-or-nothing policy, rows locked, transaction duration, deadlock rate |
| External latency | supplier/PSP/GDS p50/p95/p99, timeout-after-commit probability, callback delay |
| Retry/reconnect | client retry rate, provider retry schedule, WebSocket reconnect burst, duplicate window |
| Capacity | DB CPU/I/O/lock waits, pool occupancy, queue age, in-memory buffer, broker lag, admission rate |
| Recovery | RTO/RPO, replay retention, reservation TTL, reconciliation SLA, operator repair authorization |
| Domain policy | overbooking tolerance, partial cart success, price revalidation, manual review, fail-open/closed |

| Crash/race window | Unsafe conclusion | Required control |
| --- | --- | --- |
| Two buyers read `AVAILABLE` | Both may insert a hold | Conditional write/unique constraint at the authority; one explicit conflict |
| Worker lease expires while paused | Old worker is stopped | Fencing/version check at the protected write; lease alone is insufficient |
| Commit succeeds, response is lost | Reservation/payment failed | Durable command identity and result/status lookup |
| Provider call times out | Provider definitely failed | `UNKNOWN/PENDING`, stable provider key/reference, inquiry/webhook/reconciliation |
| Expiry races with checkout | Old sweeper frees newer hold | Identity/version-conditional transition |
| Queue ACK/offset uncertain | Business effect exactly once | Consumer idempotency/inbox/business key and replay policy |
| WebSocket send returns | Client received and persisted event | Durable cursor/status, reconnect replay, dedup, bounded per-client queue |
| DB/Redis partition | Global limit still exact | Explicit fail-open/closed/cell budget and bounded overshoot |
| Hot sale overwhelms origin | More retries will recover it | Admission control, waiting room/queue, load shedding, retry budget and recovery plan |

## Pattern comparison

| Pattern | Correctness boundary | Fit | Non-guarantee that must be written |
| --- | --- | --- | --- |
| Conditional quantity update | One authoritative SQL/DynamoDB item decision | Compact inventory, manageable hot-key contention | Hot-row waits, deadlocks, retry must repeat the transaction |
| One row per unit + `SKIP LOCKED` | Claimed rows in one DB authority | Bounded unit inventory and worker allocation; Shopify case | Inconsistent view/fairness; not a general availability count |
| Redis counter/script | Atomic inside Redis | Valid only when Redis owns the inventory invariant or reconciliation is accepted | Does not atomically commit SQL/order/provider state |
| Queue worker claim | Queue lease/visibility plus handler | Asynchronous allocation and backpressure | Lag, redelivery, stale lease and delayed checkout result |
| DB row lock | Transaction-scoped protection of selected rows | Short local transaction | Never hold it across a supplier/PSP/network call |
| Distributed lease | Worker coordination/liveness | Single active coordinator or scheduled work | Paused old worker can still write unless fenced |
| Optimistic version | One entity transition winner | Low contention, clear versioned state | Does not deduplicate a new intent or external effect |
| WebSocket | Live notification channel | Low-latency client updates | No offline durability, replay, receipt or business authority |
| Saga/orchestrator | Recovery across local transactions | Long workflow with timers/branching/compensation | No automatic rollback or universal convergence |

## Domain comparison

| Domain | Correctness focus | What may be eventual | What must be authoritative |
| --- | --- | --- | --- |
| OTA seats | No duplicate hold, supplier authority, expiry, late PNR/ticket callback | Search availability, notifications, analytics | Hold/booking command, supplier result, payment state |
| Flash sale | Price/deal identity, quota and hot-SKU admission, overload | Catalog/cache/SOLD_OUT projection within stated lag | Inventory + quota admission and checkout revalidation |
| Warehouse inventory | Ordered mutations, replay/checkpoint, reconciliation | Read models and downstream fan-out | Inventory mutation stream/checkpoint and quantity policy |
| Shopify-style reservations | Row/unit claim, expiry-safe release, connection/lock budget | Shadow comparison, display availability, analytics | MySQL reservation/inventory transaction in the reported design |
| Duplicate booking incident | One request/entity transition, method safety, cross-session intent | Bot/traffic signals and UI status | DB conditional update plus business idempotency/provider contract |

## Contradictions and limits

| Apparent rule | Resolution |
| --- | --- |
| “Use a lock for every race” | First name the authority and invariant. A constraint/conditional update often enforces the invariant more directly; a lease is for worker coordination and needs fencing. |
| “Redis is atomic, therefore no oversell” | Atomicity is within Redis. A separate order/DB/provider write remains a cross-system boundary. |
| “`SKIP LOCKED` is the fast exact inventory read” | It is suitable for queue-like claiming and may skip locked rows/inconsistent views. It is not automatically a customer-facing count. |
| “Saga makes the booking consistent” | It structures recovery. Compensation can fail or be partial; provider authority and reconciliation remain. |
| “WebSocket is real-time reliable delivery” | It is a channel. Durable status/cursor/reconnect/dedup/backpressure are application contracts. |
| “The local version fix solved duplicate booking” | It selects one writer for one row. It does not solve cross-session intent, provider duplicate, or response-loss ambiguity. |
| “Shopify improved by 1,000 rows, so use 1,000” | The number is a measured design parameter; local schema, hot-key distribution and pool capacity decide the limit. |
| “Overbooking is an eventual-consistency bug” | It can be an explicit product/risk policy. The policy must be measured and visible rather than accidental. |

## Negative evidence and anti-patterns

- Do not decrement a read replica, cache, or search index and call it a seat/inventory hold.
- Do not hold a DB row lock while waiting for a GDS, PSP, warehouse or HTTP callback.
- Do not retry an unknown external call with a new key.
- Do not treat TTL expiry as fencing or proof that an old process stopped.
- Do not use a WebSocket send callback as the only business-event record.
- Do not use `LongAdder` for an exact balance/limit or `Semaphore` as a distributed time-rate contract.
- Do not use unbounded queues, unlimited reconnect buffers, or global fan-out from the checkout request.
- Do not present Tiki/Shopify timings, component names, or unit caps as universal benchmarks.
- Do not collapse OTA payment/provider unknown states into a generic failure.
- Do not claim a two-request race test proves cross-instance booking correctness.

## Integration record (applied 2026-08-23)

1. Topic 16: keep the OTA architecture and state-machine narrative; add authority labels, explicit hold/payment/ticket transitions, reconnect cursor, limiter partition modes, and version labels. Cross-reference Topics 08/09/17/25/28 rather than repeating their generic tutorials.
2. Case 16: preserve Shopify-specific evidence; add the reservation state machine, timeout-after-commit path, identity/version-safe expiry, and clear `SKIP LOCKED`/connection-occupancy limits in EN/VI.
3. Case 12: preserve the incident timeline; add HTTP method semantics, integer version/affected-row winner, status/reconciliation path, BOLA/session ownership tests, and the one-row-only limitation.
4. Case 11: retain Tiki source-access caveat; add price identity/revalidation, quota/inventory atomic-boundary wording, hot-key admission, overload controls and source-scoped metrics.
5. Case 01: retain reported architecture/benchmarks; add explicit checkpoint/replay/quantity invariants, crash windows, idempotent reserve/confirm/reverse, bounded buffers and workload assumptions.

No question or HTML anchor should be deleted. Any shortened generic prose must retain the immutable ID, a cross-reference, and the unique domain evidence.

## EN/VI parity and validation gate

- Keep EN/VI section IDs, item IDs, HTML anchors, diagrams, code identifiers, state names, quantities and version numbers aligned.
- Translate qualifiers as well as conclusions: authoritative versus projection, bounded overshoot, unknown outcome, fencing, stale callback, and source-scoped measurement must remain equally strong.
- Run JSON/HTML structure checks, cross-reference validation, `node tools/validate-content.mjs --stats`, `git diff --check`, and the full `node tools/check.mjs` after the batch.
- The five Batch B index rows were changed from `REVIEW` to `INTEGRATED` after the public-data and validation gates passed; unresolved provider and workload questions remain explicitly open below.

## Unknowns and falsifiers

- The supplier/GDS authority and idempotency contract are unknown until the deployed provider contract is named; a late-success test or provider duplicate falsifies a simpler local-only workflow.
- The correct reservation schema is unknown until hot-key skew, cart size, lock wait, pool occupancy and deadlock rates are measured; a shadow/load test falsifies a portable unit-row or quantity-counter limit.
- The acceptable overbooking/fail-open policy is product and risk input, not derivable from a cache or queue choice.
- Tiki detailed metrics remain unresolved until the original first-party source is manually accessible and dated.
- A WebSocket design is incomplete if reconnect, offline retention, cursor replay, auth refresh and slow-consumer behavior are not tested.
- A lease design is incomplete if a paused old worker can still commit to the authority; a stale-fence injection test falsifies the design.
- A replay design is incomplete if checkpoint advancement, mutation and external effects do not have a durable/idempotent boundary.

## Gate status

- [x] Exact local IDs/anchors and per-unit roles mapped.
- [x] Selected source ledgers and source-access limitations recorded in the five per-unit dossiers.
- [x] Invariants, state machines, workload, failure windows, comparisons, contradictions and anti-patterns synthesized.
- [x] Canonical ownership and no-delete rules recorded.
- [x] EN/VI integration outline and validation gate recorded.
- [x] Public EN/VI content updated.
- [x] Cross-reference/index integration applied.
- [x] Batch B validation passed after integration.
