# Research — Hot deals at peak time: price and inventory admission

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `11-how-to-handle-hot-deals-at-the-peak-time`

EN file: `public/data/case-studies/articles/11-how-to-handle-hot-deals-at-the-peak-time.html`

VI file: `public/data/case-studies/articles/11-how-to-handle-hot-deals-at-the-peak-time.vi.html`

Metadata: the paired case-study metadata JSON and article files were read in full.

## Scope and evidence posture

This case studies flash-sale admission where price, deal quota, inventory, checkout, cache freshness, and overload interact. Its distinctive content is the reported Tiki/Talaria evolution from a MySQL/MongoDB/cache path to a price system plus Arcturus inventory admission and a checkout revalidation step. It does not prove that the design is universal, nor does it own generic broker, Saga, Outbox, or inventory-ledger theory.

The discovery pool was about 50 candidates. The ledger keeps 25 inspected standards/official docs, first-party engineering guidance, and queueing/waiting-room examples. Generic flash-sale blogs, vendor benchmarks, and copied “秒杀” recipes were excluded.

Important source limitation: the local article links the original [Tiki Engineering post](https://engineering.tiki.vn/pegasus-catalog-product-api-architecture-f217c8623c9b) and a [Tiki Engineering Medium copy](https://medium.com/tiki-engineering/how-to-handle-hot-deals-at-the-peak-time-821908b9d340). On review date, the Medium page returned 403 and the direct engineering page could not be fetched by the research tool. Therefore the detailed Tiki numbers and named component behaviour are recorded as “local article reports / source access unresolved,” not independently verified facts. They must remain scoped to the original case when integrated.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `1-oversold-deal-problem` | Old design and oversell/availability risk. |
| `2-the-old-deal-solution` | MySQL deal state, Mongo product, Pegasus cache and synchronization/locking issues. |
| `2-1-change-the-deal-price-process` | Price-process change. |
| `2-2-close-deals-process` | Deal-close/event propagation. |
| `3-the-new-deal-solution` | New price/inventory split. |
| `3-1-price-system-replicate-the-deal-price-process` | Price replication and unique price/deal identity. |
| `3-2-arcturus-inventory-process` | Inventory plus deal-quota atomic admission. |
| `3-3-checkout-process` | Checkout revalidates price identity and calls inventory admission. |
| `3-4-system-architecture` | End-to-end architecture. |

The VI wording is generally more precise about deal quota. EN/VI structure is paired, but both need the same caveats about source access, workload-derived timings, and the difference between price freshness and inventory authority.

## What is correct and reusable

- A cached product/price view is not the authority for a scarce inventory admission decision.
- Checkout must bind a price/deal identity and revalidate it at the point where inventory/quota is admitted; a client-visible price alone is stale data.
- Price eligibility and inventory/deal quota should be decided by one authoritative conditional/transactional boundary for the scarce resource, or the system must explicitly accept oversell/false rejection risk.
- Eventual synchronization can be safe for display/cache projections when identity/version is carried and stale/reordered/duplicate events are handled. It is not enough for the final admission invariant.
- Peak protection is an overload problem as well as a correctness problem: load shedding, queue/waiting room, deadlines, retry budgets, and origin protection can preserve useful work.
- A “sold out” event should be a state transition with idempotent handling and versioning, not a best-effort cache flip.

## Claims to verify or qualify

| Local claim/shape | Classification | Required qualification |
| --- | --- | --- |
| Tiki’s old 10-second sync/DB-locking caused the stated incident | Local first-party report, source access unresolved | Keep as “the case reports”; manually verify the original before calling it independently verified. |
| New price system has high consistency and availability | Architecture claim | Define which fields, replica/failure model, and read/write path. CAP/consistency is not a binary product label. |
| Unique price ID/deal ID solves stale price | Good invariant, incomplete | Bind price identity to SKU/deal/validity and revalidate at checkout; identity alone does not authorize inventory. |
| Arcturus atomically checks inventory and deal quota | Case-specific design fact | State the storage/conditional-write mechanism and transaction boundary; if source does not specify it, mark implementation unknown. |
| No overlapping deal for an SKU/time | Domain rule | A useful admission invariant, but time-zone, clock, schedule update, and race semantics need definition. |
| `system-price <= pegasus-price` is sufficient | Case algorithm, not universal | Clarify currency/rounding, tax/fee context, price version, monotonicity, and what happens if price is missing or stale. |
| SOLD_OUT sync improves from 1–2 seconds to 5–6 seconds | Local reported metric | Keep as a Tiki 2022/2023 workload metric only; do not present as a general cache target. |
| Load shedding/retry can protect the peak | Recommendation | Only if admission is idempotent, retries are bounded/jittered, and rejecting/queueing does not create a second oversell path. |

## Workload, invariants, and failure model

### Workload model

Capture normal/peak checkout RPS, burst duration, hot-SKU skew, cart size, inventory unit/quantity model, deal quota, price update rate, acceptable staleness by field, cache hit ratio, origin capacity, customer fairness, wait-room capacity, and supplier/payment latency. The scarce invariant is usually “accepted checkout cannot exceed available inventory/quota,” while display price and search results may tolerate bounded staleness.

### Invariants

1. A checkout decision uses a specific price/deal version or rejects/reprices; it never silently mixes an old displayed price with an unrelated current inventory decision.
2. Inventory and deal quota admission is atomic at its authority, or the business explicitly accepts oversell/compensation.
3. A SKU/deal schedule has one active authoritative rule; overlapping active deals are rejected or resolved deterministically.
4. Price/cache/event updates carry identity/version and are idempotent; older events cannot overwrite newer state.
5. A SOLD_OUT transition is idempotent, observable, and cannot reopen a deal from a stale/reordered event.
6. Retries use the same checkout/admission intent key; a timeout is not permission to create a second reservation.
7. Overload protection rejects or queues work before origin state can be corrupted; wait-room position/fairness is a defined product contract.

### Failure/crash windows

| Window | Unsafe result | Safer control |
| --- | --- | --- |
| Cache shows price A; deal changes to B | Customer charged/accepted with stale terms | Price ID/version, checkout revalidation, explicit reprice/reject. |
| Inventory reserve succeeds; response times out | Client repeats and double-reserves | Stable intent key, reservation status, idempotent claim. |
| Price accepted; inventory call times out | Unknown reservation state | Query by intent, `PENDING/UNKNOWN`, reconcile; do not blindly retry new intent. |
| Inventory succeeds; SOLD_OUT event lost | Further requests admitted | Durable event/CDC, authoritative quota check remains the last line, alert on projection lag. |
| SOLD_OUT arrives before an earlier availability event | Deal reopens | Version/sequence, monotonic state transition, ignore stale event. |
| Retry storm reaches price/inventory origin | Cascading overload | Deadline budget, one retry owner, exponential backoff+jitter, load shedding and queue age SLO. |
| Waiting room admits too many users at once | Origin still melts | Admission tokens, origin capacity feedback, concurrency limits, graceful degradation. |
| Partial schedule/config rollout | Different nodes use different deal rules | Versioned config, atomic activation, audit and rollback. |

## Best-practice comparison

| Pattern | Correctness contribution | Peak/ops contribution | Main limit |
| --- | --- | --- | --- |
| Cache/replicated price projection | Low-latency display and read scale | Absorbs reads | Stale/reordered data; not inventory authority. |
| Price ID/version binding | Prevents ambiguous price use | Makes revalidation and diagnosis possible | Needs version lifecycle and client UX for reprice. |
| Conditional DB write/transaction | Enforces quota/inventory invariant | Backpressure at one authority | Hot keys, locks, connection capacity, deadlocks. |
| Queue/waiting room | Converts unbounded burst to controlled admission | Protects origin and gives fairness/position | Delay, abandonment, fairness abuse, queue-state durability. |
| Load shedding | Keeps useful work within capacity | Fast failure and recovery | Must choose who/what to shed; may lose sales. |
| Retry/backoff/jitter | Handles transient failure | Avoids synchronized retry storm | Cannot repair unknown non-idempotent effects. |
| Async projection/event | Fast fan-out and cache invalidation | Decouples consumers | Lag, duplicates, out-of-order events, replay policy. |

## Coverage matrix

| Gate area | Current coverage | Gap/proposed treatment |
| --- | --- | --- |
| Definitions | Partial | Define display price, authoritative price, deal quota, inventory reserve, accepted checkout, sold-out projection. |
| Invariants | Strong direction | State exact atomic boundary and version/intent rules. |
| Workload | Weak | Add a measured peak/burst/hot-key worksheet; do not keep generic “high traffic” language. |
| Failure/crash windows | Partial | Add timeout/unknown, lost/reordered SOLD_OUT, config split-brain, retry storm and wait-room admission. |
| Retries/timeouts | Partial | Add deadline propagation, one retry owner, idempotency key, jitter, and retry budget. |
| Operations/recovery | Partial | Track price projection lag, stale-version rejects, inventory contention, reservation age, queue age, SOLD_OUT propagation, origin saturation and redrive. |
| Security/privacy | Weak | Add abuse/bot/fairness protection, tenant/admin schedule authorization, price tamper resistance, PII minimisation and audit. |
| Testing | Partial | Add hot-key load, concurrent last-unit, price flip during checkout, duplicate/reordered events, dependency timeout, queue failover and recovery tests. |
| Domain trade-offs | Strong starting point | Keep Tiki-specific sequence; compare OTA/banking priorities only in domain-owned cases. |

## Contradictions and limits

| Tension | Why both can be true | Scope |
| --- | --- | --- |
| Strong consistency versus availability | Admission may reject/wait during authority failure while display/search remains available | Separate fields and business consequences; do not label the whole system one consistency level. |
| Queueing versus sales conversion | A waiting room protects origin but adds delay/abandonment | Fairness, SLA, traffic shape and product policy. |
| Retry versus overload | Retries recover transient faults but amplify overload | Retry only classified transient errors, with deadlines/jitter/budget and idempotent intent. |
| Cache freshness versus cache hit ratio | Short TTL reduces stale price but increases origin load | Use versioned invalidation and measure origin headroom. |
| One hot counter versus distributed throughput | A single counter is easy to reason about but serializes contention | Use conditional/unit rows/cells only after measuring skew and capacity. |
| AWS virtual waiting-room example versus current availability | The official implementation blog is useful architecture evidence, but the solution page reports discontinuation | Do not recommend the discontinued product without a current replacement review. |

## Negative evidence and anti-patterns

- Do not decrement inventory in a cache and later “sync” the authoritative ledger without a crash/reconciliation design.
- Do not trust the price sent by the browser or an eventually consistent catalog cache for final admission.
- Do not compare prices with floating-point arithmetic or without currency/rounding/tax scope.
- Do not run unlimited immediate retries during a flash sale; that turns rejection into a retry-amplified outage.
- Do not let a stale SOLD_OUT/availability event overwrite a newer state; require version/sequence or monotonic transitions.
- Do not scale only the stateless web tier while the hot inventory key, connection pool, or origin is the bottleneck.
- Do not treat a waiting room as a correctness mechanism; it reduces load but cannot prevent oversell if the authority is wrong.
- Do not copy Tiki’s component names, seconds, or capacities into another domain without the original workload and source verification.

## Duplicate/canonical ownership

- Broker delivery/retry mechanics: topic 08.
- Saga/Outbox/provider idempotency: topic 09 and Case 15.
- Hot inventory data authority and database contention: Case 16.
- OTA booking race and method/idempotency semantics: Case 12.
- This case owns the interaction between peak admission, price identity, inventory/quota authority, and overload controls; it should not repeat all patterns from those units.

## EN/VI parity and applied content changes (2026-08-23)

- [x] Label Tiki metrics and component behaviour as reported by the linked first-party case, with source-access limitation in the research record, not as universal facts.
- [x] Keep the VI precision around “deal quota” in EN as well.
- [x] Add price identity/version, explicit `UNKNOWN` reservation state, and revalidation language.
- [x] State the atomic boundary for Arcturus inventory + quota; if unknown, say so rather than inferring a database transaction.
- [x] Add stale/reordered event handling and monotonic SOLD_OUT transition.
- [x] Add peak controls: wait-room/token admission, load shedding, deadline/retry budget, origin protection and metrics.
- [x] Preserve the domain trade-off without claiming that every bank, fintech, or flash-sale system has the same priority.
- [x] Translate all qualifiers and source-status notes identically in EN/VI.

## Open questions and falsifiers

- [ ] Can the original Tiki Engineering page be manually accessed and version/date confirmed? Until then, detailed local timings remain unresolved.
- [ ] What exactly is the authoritative inventory/quota store and transaction/conditional-write primitive? A non-atomic implementation falsifies the oversell-prevention claim.
- [ ] What are peak RPS, hot-key skew, reservation TTL, and origin capacity? Without them, no queue size, pool size, or replica count is justified.
- [ ] Does the displayed price include tax, fees, currency conversion, and rounding? If not, the price comparison predicate is incomplete.
- [ ] What fairness/anti-bot policy is required? If one actor can consume all admission tokens, a pure FIFO wait-room recommendation is insufficient.
- [ ] What happens after a timeout when admission may have succeeded? If no query/reconciliation path exists, the retry design is unsafe.

## Source ledger

All sources were reviewed on `2026-08-23`. `S1` is an official standard/product/project document; `S2` is first-party engineering/SRE guidance; `S3` is a first-party architecture example. The two Tiki URLs are first-party candidates but were not fully fetchable in this review.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | [How to handle hot deals at the peak time](https://medium.com/tiki-engineering/how-to-handle-hot-deals-at-the-peak-time-821908b9d340) — Tiki Engineering | S2; original post, access returned 403 on review | Candidate source for Tiki’s old/new architecture and reported timings; exact claims remain source-access unresolved. |
| S02 | [Pegasus catalog/product API architecture](https://engineering.tiki.vn/pegasus-catalog-product-api-architecture-f217c8623c9b) — Tiki Engineering | S2; linked first-party post, safe-open failure on review | Candidate first-party context for Pegasus; not independently verified during this run. |
| S03 | [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | S2; current web edition | Overload, queue growth, retry amplification, deadlines, jitter, retry budgets, load shedding, and realistic overload tests. |
| S04 | [Handling Overload](https://sre.google/sre-book/handling-overload/) — Google SRE | S2; SRE book chapter | Client-side throttling, load shedding and overload protection; capacity is not infinite. |
| S05 | [Reliable Product Launches at Scale](https://sre.google/sre-book/reliable-product-launches/) — Google SRE | S2; SRE book chapter | Launch/peak planning, staged rollout, monitoring and rollback discipline. |
| S06 | [Using load shedding to avoid overload](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/) — AWS Builders’ Library | S2; current/redirected first-party article | Load shedding as a deliberate overload control; service-specific admission and degradation. |
| S07 | [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — AWS Builders’ Library | S2; current/redirected first-party article | Timeout selection, retry multiplication, exponential backoff and jitter; retry only safe/transient operations. |
| S08 | [Avoiding insurmountable queue backlogs](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/) — AWS Builders’ Library | S2; current/redirected first-party article | Queue backlog growth, arrival/service rate, admission and recovery. |
| S09 | [Avoiding overload by putting the smaller service in control](https://aws.amazon.com/builders-library/avoiding-overload-in-distributed-systems-by-putting-the-smaller-service-in-control/) — AWS Builders’ Library | S2; current/redirected first-party article | Backpressure/control should be placed where capacity and overload are visible. |
| S10 | [Waiting Room overview](https://developers.cloudflare.com/waiting-room/about/) — Cloudflare | S1/S2; current docs, reviewed 2026 | Queueing visitors before origin capacity is exceeded, cookie/position model and origin protection scope. |
| S11 | [Waiting Room cookie](https://developers.cloudflare.com/waiting-room/reference/waiting-room-cookie/) — Cloudflare | S1/S2; current docs | Queue identity/cookie data and security/privacy considerations; not a scarce-inventory invariant. |
| S12 | [Monitor a Waiting Room](https://developers.cloudflare.com/waiting-room/how-to/monitor-waiting-room/) — Cloudflare | S1/S2; current docs | Queue and origin monitoring signals. |
| S13 | [SeatGeek virtual waiting room](https://aws.amazon.com/blogs/architecture/build-a-virtual-waiting-room-with-amazon-dynamodb-and-aws-lambda-at-seatgeek/) — AWS Architecture Blog | S3; first-party case, current page | DynamoDB/Lambda queueing architecture and token admission example. |
| S14 | [Virtual Waiting Room on AWS](https://aws.amazon.com/jp/solutions/implementations/virtual-waiting-room-on-aws/?nc1=h_ls) — AWS | S1; solution page reviewed 2026 | Negative evidence: solution page reports discontinuation; do not copy it as a current product recommendation. |
| S15 | [DynamoDB expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.html) — AWS | S1; current docs | Conditional expressions and atomic condition checks as an implementation alternative. |
| S16 | [DynamoDB conditional operations](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/example_dynamodb_Scenario_ConditionalOperations_section.html) — AWS | S1; current SDK examples | Conditional write/read outcome and optimistic admission example; provider-specific. |
| S17 | [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) — AWS | S1; current docs | Multi-item transactional scope and limits; not a universal database transaction claim. |
| S18 | [InnoDB locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) — Oracle/MySQL | S1; MySQL 8.4 | `FOR UPDATE`, `NOWAIT`, `SKIP LOCKED`, locks and inconsistent queue-like views. |
| S19 | [InnoDB transaction model](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-transaction-model.html) — Oracle/MySQL | S1; MySQL 8.4 | Isolation/locking model and need to measure engine/query behaviour. |
| S20 | [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Stripe | S1; current API docs | Provider-specific repeated-request key/result semantics; useful for checkout retry comparison. |
| S21 | [Message delivery semantics](https://kafka.apache.org/40/design/design/) — Apache Kafka | S1; Kafka 4.0 | At-least/exactly-once scope, producer/consumer retry boundaries and external-effect limitation. |
| S22 | [Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) — AWS | S1; current framework | Reliability design, recovery testing and dependency/overload considerations. |
| S23 | [Cost Optimization/Well-Architected workload demand](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html) — AWS | S1; publication June 2024, current revision | Demand/supply analysis, buffers/throttles and data-backed sizing; relevant to peak cost/overprovisioning. |
| S24 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | S1; RFC 9110, 2022 | 202/Retry-After, method idempotency and safe retry boundaries for checkout APIs. |
| S25 | [Messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/) — OpenTelemetry | S1; conventions 1.44.0 family | Trace correlation for price/inventory/checkout messages and safe operational observability. |

## Excluded discovery candidates

Generic flash-sale architecture articles were excluded because they repeated “cache + queue + lock” without defining the inventory authority, duplicate/timeout behavior, or measured workload. AWS waiting-room material was retained only with the discontinuation caveat. Tiki source access failure is recorded rather than silently replaced with a secondary repost.

## Gate status

- [x] Complete EN/VI sections and metadata read.
- [x] First-party source access limitation recorded.
- [x] Discovery pool broadened; selected ledger has 25 distinct sources/candidates with status.
- [x] Workload, invariants, crash windows, comparison, coverage, limits, anti-patterns and falsifiers recorded.
- [x] Duplicate/canonical role and EN/VI parity plan recorded.
- [ ] Original Tiki source manually verified.
- [x] EN/VI case content integrated.
- [x] Validation passed after integration.
