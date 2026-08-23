# Research - Microservice reliability and system design

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `25-microservice`

EN file: `public/data/topics/25-microservice.json`

VI file: `public/data/topics/25-microservice.vi.json`

## Scope and non-goals

This is the broad reliability and operations topic: overload, deadlines, retry storms, pools, virtual threads, broker behavior, cache correctness, data bottlenecks, observability, deployment/autoscaling/jobs, idempotency, and a final system-design rubric. It should synthesize decisions and link to deeper canonical topics; it should not duplicate the full queue tutorial, distributed-workflow tutorial, or the OTA case.

The discovery pass used a broad, non-exhaustively counted pool across standards, current project/provider documentation, original papers, and first-party engineering/SRE material. Fifty distinct sources were inspected and selected because each adds a behavior, counterexample, version boundary, failure mode, or operational control. Duplicate mirrors, old version pages that added no distinct claim, SEO summaries, and generic “microservices best practices” posts were excluded. The 200-source ceiling is a search ceiling, not a bibliography target.

Canonical cross-references:

- [08-message-queue](08-message-queue.md) owns broker delivery, ordering, ACK/confirm, replay, DLQ, and schema mechanics.
- [09-distributed-tx-fintech](09-distributed-tx-fintech.md) owns local atomicity, Saga, Outbox, provider idempotency, unknown outcomes, and ledger correctness.
- [16-project-concurrency-whiteboard](16-project-concurrency-whiteboard.md) owns the OTA/project concurrency narrative.
- [11-system-design-cases](11-system-design-cases.md) owns domain-specific prompt applications.
- [../case-studies/15-transactional-outbox-order-workflow](../case-studies/15-transactional-outbox-order-workflow.md) owns the concrete outbox/inbox crash walkthrough.

## Local content map

The complete EN and VI files were read. There are ten sections and fifty-one question records. The compact ranges below preserve the exact section/question prefixes and should be expanded to individual IDs only if the integration tooling needs a row per question.

| Section | Exact local ID range | Current job |
| --- | --- | --- |
| 01 Cascading failure and retry storm | `25-microservice.cascading-failure-retry-storm.q1` - `q6` | Capacity arithmetic, amplification, deadlines, circuit breaker, bulkhead, load shedding |
| 02 Connection and thread pools | `25-microservice.connection-thread-pools.q1` - `q5` | Pool sizing, Hikari/PgBouncer/RDS Proxy, executor queues, virtual threads |
| 03 Distributed correctness | `25-microservice.distributed-correctness.q1` - `q5` | 2PC/Outbox/Saga, consistency levels, exactly-once scope, source selection |
| 04 Broker operations | `25-microservice.broker-operations.q1` - `q4` | Rabbit/Kafka choice, ordering, poison messages, confirms |
| 05 Cache | `25-microservice.cache.q1` - `q12` | Stampede, hot keys, negative cache, TTL/invalidation, Redis atomicity/eviction, cache stack |
| 06 Data bottlenecks | `25-microservice.data-bottlenecks.q1` - `q3` | Hot partitions, replica lag/RYW, N+1 |
| 07 Observability | `25-microservice.observability.q1` - `q3` | Trace context, RED/USE/business signals, sampling/probes |
| 08 Deployment/autoscale/jobs | `25-microservice.deployment-autoscale-jobs.q1` - `q4` | Compatibility, rollout, HPA/probes, restartable jobs/leases |
| 09 Idempotency | `25-microservice.idempotency.q1` - `q3` | API key/result, Inbox, relation between command/consumer/outbox |
| 10 System design | `25-microservice.system-design.q1` - `q6` | Rubric, e-wallet scale estimate, modular monolith, authority, fintech trade-offs |

The local content contains strong technical instincts but also several teaching heuristics that must be labeled as examples: Hikari pool numbers, “10-50 lightweight tasks,” p99.9 plus margin, retry multipliers, HPA timing, cache “mandatory/worth it,” and provider defaults.

## What is correct and reusable

- The overload section starts with queueing and service time rather than a framework choice. The idealized arithmetic (`200 / 0.020 = 10,000/s`; `200 / 5 = 40/s`) is useful if explicitly labeled as a closed-system estimate with no overhead.
- The retry-storm example correctly shows layered amplification and the need for deadlines, bounded attempts, jitter, retry budgets, and load shedding.
- The topic correctly separates a semaphore bulkhead, an executor/thread pool, a connection pool, and a rate limiter. They bound different resources.
- The virtual-thread content is timely when version-labeled: JDK 21 delivered virtual threads; JDK 24 changed synchronized pinning behavior; JDK 25 structured task scope remains preview in the inspected API docs.
- The pool section correctly warns that unbounded executor queues make `maximumPoolSize` ineffective and that database capacity is bounded by the database/proxy, not only application replicas.
- The distributed-correctness section correctly separates 2PC/XA, Saga/compensation, Outbox/CDC, Inbox, and scoped exactly-once claims.
- The broker section correctly distinguishes Rabbit publisher confirms from consumer ACK and Kafka partition order from end-to-end business order.
- The cache section covers stampede, hot key, negative cache, TTL jitter, delayed double delete, Redis atomic commands, eviction, and cache hierarchy. It correctly warns that a fintech balance should not become a plain cache-aside example.
- The observability section asks for RED/USE, queue age, pool saturation, business correctness, histograms, cardinality, fan-out, and trace propagation instead of only request logs.
- Deployment and jobs content correctly requires compatibility before rollout, readiness/startup/liveness separation, HPA loop awareness, leases/fencing, idempotent CronJobs, and restartable chunks.
- The idempotency section correctly models atomic `IN_PROGRESS`/stored-result state, consumer Inbox, and the relation between caller command, relay, and consumer.
- The final system-design rubric correctly prioritizes authority/invariants, failure state, recovery, security, evidence, and scale assumptions over a fashionable component list.

## Claims to verify or qualify

| Claim or teaching shape | Classification | Scope/limitation to show | Confidence |
| --- | --- | --- | --- |
| `200` threads at `20ms` gives `10k/s`, at `5s` gives `40/s` | Arithmetic inference | Closed workload with ideal concurrency and no queue/network/CPU overhead; use for intuition, not capacity commitment. | High |
| Three retrying layers amplify by `8x` | Arithmetic model | Only if every layer retries twice for the same failure and attempts multiply independently; real policies/deadlines may differ. | High |
| Use p99.9 plus a margin as timeout | Recommendation | Derive from deadline budget, error cost, fan-out, region/provider, and measured distribution; a percentile is not a universal timeout. | High |
| Circuit breaker prevents cascading failure | Conditional recommendation | It protects a caller/resource when thresholds and fallback are sound; it can cause false opens, synchronized probes, or hide a real outage. | High |
| Semaphore and thread-pool bulkheads are interchangeable | Incorrect | One bounds permits; one schedules/queues tasks; connection pools and downstream limits are separate. | High |
| Retry only transient failures | Recommendation | Need status/error classification, idempotency, absolute deadline, attempt budget, jitter, `Retry-After`, and one retry owner. | High |
| Virtual threads eliminate pool sizing | Incorrect | They reduce thread cost for blocking I/O; DB/socket/concurrency admission and CPU capacity remain bounded. | High |
| `synchronized` always pins a virtual thread | Stale version claim | JDK 21-23 behavior and JDK 24 JEP 491 differ; confirm target runtime and remaining native/monitor pinning cases. | High |
| `maximumPoolSize` provides a hard executor cap | Incomplete | An unbounded queue can prevent growth beyond core; a bounded queue plus rejection changes backpressure. | High |
| `maximumPoolSize = replicas * pool` is safe | Arithmetic upper bound, not recommendation | It estimates possible DB connections; proxies/pinning, failover, admin connections, and workload mix change the effective limit. | High |
| Hikari `connectionTimeout` is a query timeout | Incorrect | It is pool acquisition wait; query/socket/transaction timeouts are separate. | High |
| Kafka exactly-once makes a DB/email/payment effect exactly once | Incorrect scope | Kafka transactions/EOS can cover Kafka read/write/offset boundaries; arbitrary external effects need their own idempotency/reconciliation. | High |
| Kafka key guarantees global event order | Incorrect scope | It provides per-partition order; partitions, retries, consumer concurrency, replay, and aggregate version rules remain. | High |
| Rabbit quorum queue is the best queue for every workload | Incorrect | Quorum replication changes latency/backlog/poison/fan-out trade-offs; Rabbit docs state unsuitable workloads. | High |
| DLQ after N attempts solves poison messages | Incomplete | Need permanent/transient classification, quarantine, schema/policy owner, replay authorization, and age/action metrics. | High |
| Cache invalidation makes data correct | Incomplete | Invalidation races, missed events, version ordering, stale replicas, eviction, and origin failures remain. | High |
| Redis `WAIT` provides strong consistency | Incorrect | It waits for replica acknowledgement under a replication model; it is not a consensus/linearizability guarantee. | High |
| `MULTI/EXEC` rolls back on command failure | Incorrect | Redis transactions queue/execute commands and do not provide general rollback; application logic handles errors. | High |
| TTL is a durable expiration event | Incorrect | Expiration/eviction is not a reliable workflow trigger; use a durable job/event if a business action must happen. | High |
| HPA will instantly fix a traffic spike | Incorrect | It is a delayed feedback loop, depends on metrics/readiness/resource capacity, and cannot fix a saturated DB/broker/provider. | High |
| CronJob runs exactly once | Incorrect | Kubernetes documents approximate scheduling; jobs must tolerate duplicate/missed execution and restart. | High |
| Trace IDs can contain request/user data | Security error | W3C Trace Context warns about privacy/security; use opaque IDs and control propagation/trust. | High |
| Idempotency key alone prevents duplicate effect | Incomplete | Atomic claim/result, fingerprint, `IN_PROGRESS` behavior, retention, downstream key, and reconciliation are required. | High |

## Workload, invariants, and failure model

### Resource model

For every microservice answer, name the constrained resource and the queue in front of it:

| Resource | Useful signal | Typical protection | Failure if only concurrency is increased |
| --- | --- | --- | --- |
| CPU | run queue, CPU saturation, GC | admission, bounded executor, autoscale | CPU contention and tail latency |
| Downstream HTTP/PSP | in-flight, p99, deadline expiry | per-dependency bulkhead, deadline, retry budget | retry storm/provider throttling |
| DB connections | pool wait, active/idle, DB queue | pool cap, proxy, transaction shortening | pool starvation/DB overload |
| Broker consumer | lag/oldest age, unacked/pending | prefetch/poll, bounded worker, DLQ | memory growth and duplicate redelivery |
| Cache/origin | hit rate, hot key, origin p99 | singleflight, TTL jitter, admission, L1/L2 | stampede/hot-partition collapse |
| Scheduler/job | lease age, run duration, missed runs | idempotent chunk, lease/fence, bounded concurrency | duplicate work or permanent gap |

The simple relationship `concurrency ~= throughput * service time` is a planning estimate, not proof of capacity. Tail service time, queueing, fan-out, retries, and downstream limits must be measured. A request that fans out to `n` dependencies increases timeout/error exposure and often makes the slowest dependency dominate the tail.

### Invariants by section

| Section | Invariant to preserve | State that may be eventually consistent |
| --- | --- | --- |
| Retry/overload | No retry policy may exceed the absolute deadline or resource budget | Aggregate telemetry and adaptive thresholds |
| Pools | Work cannot create more effective DB/HTTP concurrency than downstream capacity | Pool metrics and capacity estimates |
| Distributed correctness | Each local transition is atomic; external ambiguity is visible | Read models and workflow projections |
| Broker | A duplicate/redelivery cannot create a second business effect | Consumer lag and replay indexes |
| Cache | Protected authority is not replaced by stale/evicted data | Disposable public/read data |
| Data | Read-your-writes/version contract is honored where promised | Asynchronous indexes and replicas outside the contract |
| Observability | Signals preserve correlation without leaking sensitive data | Sampled traces/logs, if aggregate metrics remain accurate |
| Deploy/jobs | Old and new versions can coexist during rollout; job rerun is safe | Rollout metadata/status |
| Idempotency | Same operation identity maps to one accepted transition/result within stated scope | A status projection may lag the source command state |
| System design | Every component has an owner, failure mode, and recovery path | Non-authoritative analytics |

### Failure/crash matrix

| Window | Common bad behavior | Required recovery/control |
| --- | --- | --- |
| Deadline expires while downstream continues | Request returns but spawned work keeps consuming resources | Propagate cancellation/deadline; stop or detach work deliberately |
| Retry begins at several layers | Multiplicative traffic and synchronized backoff | One retry owner, bounded attempts, jitter, retry budget, load shedding |
| Circuit opens during transient blip | Every request fails fast forever | Half-open jitter/probes, reset policy, fallback that is safe and observable |
| Pool wait exceeds deadline | Threads pile up behind a saturated pool | Bound queue, fail fast/`429`/degrade, tune pool to downstream |
| DB commit succeeds but event publish fails | Direct dual-write or lost event | Outbox/CDC, relay age/repair, idempotent consumer |
| Consumer effect succeeds before ACK | Duplicate redelivery | Inbox/business unique key and transactional effect/marker |
| Redis primary fails after write | Replica misses latest state; stale lock/cache/limit | Authority re-check, fencing/version, fail-open/closed policy, reconciliation |
| Cache expires under hot-key load | Stampede to origin | Singleflight/request coalescing, TTL jitter, admission, stale policy |
| Projection/replica lags | Client reads old state after write | Version token/session guarantee or route to authority |
| Rolling deploy crosses schema change | Old consumer/producer cannot parse | Expand-contract, compatibility policy, rollback/roll-forward plan |
| HPA/readiness feedback is delayed | Scaling oscillation or all pods marked unhealthy | Startup/readiness separation, stabilization, dependency-aware alerts |
| Job worker dies after claim | Work is lost or duplicated | Lease/visibility timeout, reclaim, idempotent chunk, reconciliation |
| Idempotency row `IN_PROGRESS` is abandoned | Permanent 409 or unsafe re-execution | Lease/expiry and explicit recovery decision; do not guess side effect outcome |

## Best-practice comparison

| Decision | Option A | Option B | Recommended teaching boundary |
| --- | --- | --- | --- |
| Timeout | Per-hop independent timeout | Propagated absolute deadline | Use an end-to-end deadline plus per-hop budget; document cancellation |
| Retry | Every client/middleware retries | One designated layer retries | Prefer one owner with idempotency/error classification and budget |
| Overload | Unbounded queue | Shed/reject/degrade early | Bound queues and protect the most valuable work; expose retryability |
| Bulkhead | Semaphore | Executor/connection-pool bound | Choose the resource: permits, tasks, sockets, DB connections, or provider quota |
| Executor | Huge queue | Bounded queue/rejection | Tune from workload/downstream capacity; make backpressure visible |
| Java concurrency | Platform threads | Virtual threads | Use virtual threads for blocking I/O where supported; still cap external resources |
| DB pooling | Per-replica pool | Proxy/transaction pooling | Calculate aggregate connections and pinning; benchmark transaction/session behavior |
| Cross-service state | 2PC/XA | Saga + Outbox + Inbox | Ask whether the invariant can be local; compare recovery/blocking/participant support |
| Broker | Rabbit work queue | Kafka retained log | Choose routing/ACK/backlog versus replay/partition/retention, not slogans |
| Cache | Cache-aside everywhere | Authority plus bounded projection | Do not cache money/inventory as if it were disposable; state stale policy |
| Lock | TTL distributed lock | Conditional write + fencing | Lock coordinates; authority rejects stale writers |
| Observability | Sampled traces only | RED/USE + business correctness + traces | Keep low-cardinality aggregates and trace sampled details |
| Deploy | Big-bang/rollback | Expand-contract/canary/repair | Compatibility is required; rollback may be less safe than roll-forward |
| Jobs | Cron schedule as truth | Durable work/lease/idempotent chunk | Treat scheduler as a trigger, not a uniqueness guarantee |
| Idempotency | Key as a header | Key plus atomic state/result and downstream contract | Define scope, fingerprint, retention, concurrent behavior, replay policy |

## Coverage matrix

| Required area | Local coverage | Evidence/owner | Remaining gap before integration |
| --- | --- | --- | --- |
| Definitions | Ten sections cover the main reliability vocabulary | gRPC, Envoy, Kafka, Rabbit, Redis, K8s docs | Add a short glossary and distinguish “delivery,” “effect,” “state,” and “observation” |
| Invariants | Distributed correctness, cache authority, idempotency, system rubric | PostgreSQL, AWS Outbox, Redis locks, Kafka/Rabbit | Require an invariant field in every system-design answer |
| Workload | Queue arithmetic, pool aggregation, lag/throughput, cache hot keys | SRE, Tail at Scale, Hikari/RDS Proxy | Mark all numeric examples as assumptions and add fan-out/size/tenant distribution |
| Failure/crash windows | Retry, relay, ACK, failover, cache, rollout, job, `IN_PROGRESS` | AWS/SRE, broker docs, K8s, Redis | Add named recovery owner and repair SLA to q3/q4/q8/q9 |
| Retries/timeouts | Deadline, backoff/jitter, budgets, classification, Envoy/gRPC | gRPC, Envoy, SRE | Separate client/middleware/provider retry scope and add `Retry-After` handling |
| Operations/recovery | DLQ, pool saturation, HPA, leases, CronJob, rebuild | Rabbit, K8s, RDS Proxy, Chaos Mesh | Add runbook action for every alert; no dashboard-only claims |
| Security/privacy | Trace propagation, API/schema, cache/Redis, provider calls | W3C, OpenAPI, Protobuf, OAuth references | Add tenant isolation, secret/redrive authorization, PII/cardinality rules |
| Testing | Contract, integration, real dependencies, chaos | Pact, Testcontainers, Chaos Mesh | Add invariant assertions and crash-after-side-effect tests |
| Domain trade-offs | Fintech/system-design section and cache/async distinctions | Topic 09/11; Azure/Spanner/Cassandra | Keep domain examples linked; avoid repeating full OTA/payment patterns |

## Contradictions and limits

| Apparent rule | Counter-evidence/scope | Final wording |
| --- | --- | --- |
| “At-least-once everywhere” is the only possible guarantee | Kafka transactions, Pub/Sub exactly-once, and SQS FIFO show scoped alternatives | Name the broker, region, client, and boundary; still design arbitrary effects for duplicates unless proven otherwise |
| “Exactly once” solves duplicates | Kafka EOS does not cover an external DB/PSP/email effect | Use “exactly once within X” and Inbox/idempotency outside X |
| “Redis is strongly consistent if `WAIT` returns” | Redis docs state async replication and `WAIT` limits | Treat it as an acknowledgement/latency trade-off, not consensus or linearizability |
| “TTL invalidates safely” | Expiry, eviction, delayed invalidation, and origin writes race | Use version/invalidation/rebuild and never make expiry a sole business trigger |
| “HPA fixes load” | HPA is a delayed metric-driven loop and cannot create DB/provider capacity | Scale the bottleneck and protect the system while the loop catches up |
| “Readiness failure is a healthy restart signal” | Readiness removes traffic; liveness restarts; bad probes can cascade | Keep process health and dependency readiness separate |
| “2PC is always bad” | PostgreSQL, Jakarta, Oracle, and Spanner support distributed transaction variants | Compare operational/resource cost and required atomicity |
| “Microservices require one database per service” | Modular monolith and bounded-context decomposition guidance allow a staged split | Make ownership and transaction boundary explicit; architecture is not a database-count slogan |
| “Cache improves p99” | Stampede, hot keys, invalidation and eviction can worsen p99 | Measure hit/miss/origin/purge behavior and prove the stale contract |

## Negative evidence and anti-patterns

- Do not retry at every layer. A retry policy without one owner, deadline, budget, and idempotency contract is an overload generator.
- Do not use a breaker, bulkhead, or timeout as a substitute for a capacity model; each protects a different failure boundary.
- Do not use an unbounded queue to avoid `429`, rejection, or user-visible backpressure. It moves failure into memory and tail latency.
- Do not size every connection pool independently. Aggregate replicas, pool maxima, failover headroom, proxy pinning, admin traffic, and long transactions.
- Do not use virtual threads to create unlimited database calls or CPU tasks.
- Do not call Kafka EOS or Rabbit confirm an end-to-end business guarantee.
- Do not use Redis cache/lock/stream state as the authority for money or inventory without a documented loss/failover/fencing contract.
- Do not treat DLQ as a graveyard. Quarantine needs an owner, schema/policy diagnosis, safe replay, retention, and age alert.
- Do not use a trace ID containing user/email/payment data, or accept untrusted propagated trace state without security controls.
- Do not let liveness depend on a slow downstream dependency; a dependency outage must not restart the entire fleet.
- Do not use a CronJob timestamp as a unique business operation identity.
- Do not store only “processed=true” for an idempotent API when the caller needs the original response or when a side effect may have happened before the crash.
- Do not claim a cache invalidation or replica read is fresh without a version/read-your-writes contract.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Keep in this topic |
| --- | --- | --- |
| Rabbit/Kafka semantics | Topic 08 | Operations synthesis, queue/pool impact, and link |
| Saga/Outbox/TCC/provider unknown | Topic 09 | Failure-mechanics summary and link; no full payment tutorial |
| OTA race/whiteboard | Topic 16 | Generic resilience implications only |
| Order Outbox/Inbox crash walkthrough | Case 15 | Link to implementation evidence |
| Cache/overload/retry/pool/observability/deploy | This topic | Canonical broad microservice synthesis |
| API idempotency protocol | Topic 17 if present; topic 09 for workflow/provider | Keep local/consumer relation and link to canonical API contract |
| Java primitive semantics | Topic 01 | Keep production implications and version qualifiers |
| Domain prompt applications | Topic 11 | Keep only the rubric and cross-reference |

## Post-integration follow-up gaps

| Current content risk | Follow-up audit or evidence gap | Evidence/owner |
| --- | --- | --- |
| Numeric pool/retry/cache heuristics look like defaults | Label assumptions and add provider/runtime/workload scope beside each number | JDK/Hikari/RDS/Kafka/Redis docs |
| Retry, breaker, bulkhead, and pool boundaries are easy to conflate | Add one resource/queue/deadline/retry-owner decision flow | SRE/gRPC/Envoy |
| EOS/ACK/Outbox language can imply end-to-end completion | Add explicit broker-to-business-effect boundary table | Kafka/Rabbit/AWS/Debezium |
| Cache section mixes disposable reads with protected state | Mark authority, freshness/version, invalidation, eviction, and rebuild policy per example | Redis/PostgreSQL/provider docs |
| Operations sections list metrics but not actions | Add threshold, owner, runbook, repair authorization, and falsifier for each alert | K8s/Rabbit/OTel/Chaos sources |


## Integration record

- [x] Add an opening decision flow: invariant/authority -> workload/queue -> deadline -> retry owner -> protection -> recovery -> evidence.
- [x] Scope numeric examples as assumptions rather than universal capacity limits.
- [x] Add an explicit retry budget/decorator-order example and identify the single retry owner.
- [x] Replace absolute circuit-breaker/bulkhead/pool/cache language with provider/version/workload scope.
- [x] Add the aggregate connection equation with proxy pinning and failover headroom.
- [x] Add the broker producer-confirm/retention/ACK/business-effect boundary.
- [x] Add cache authority and invalidation/version rules while retaining fintech balance warnings.
- [x] Add observability privacy/cardinality controls and business-correctness metrics.
- [x] Add rollout compatibility and job lease/fencing/replay runbooks.
- [x] Add `IN_PROGRESS` recovery, result retention, fingerprint, and downstream idempotency.
- [x] Keep EN/VI sections and IDs paired; integrate only the paired public-data files.

## EN/VI and cross-reference plan

- Preserve all section and question IDs, including the 12-question cache block.
- Keep formulas, code identifiers, protocol names, version numbers, and state names identical in EN/VI.
- Translate the qualification, not only the headline: “scoped exactly once,” “local transaction,” “bounded overshoot,” “stale projection,” and “unknown outcome” must remain precise.
- Use links to topics 08/09/16/11 and Case 15 instead of duplicating their canonical explanations.
- Run structural parity/content validation only after the integration owner applies the public changes.

## Open questions and falsifiers

- [ ] Which runtime/provider versions are the examples targeting: JDK, Kafka, RabbitMQ, Redis, database, Kubernetes, and cloud region?
- [ ] Which service is allowed to own retries in each sample, and what is the absolute deadline budget across fan-out?
- [ ] What are the real SLOs, payload sizes, concurrency, tenant skew, replication factor, retention, and failure budget behind the numeric examples?
- [ ] Which cache use cases have a freshness/version contract, and which are explicitly disposable?
- [ ] What is the operational owner and maximum age for DLQ, outbox, reconciliation, job, and stale projection debt?
- [ ] What would falsify “at-least-once plus idempotency” for a given operation? A downstream effect with no stable identity, no durable dedup/reconciliation mechanism, and a loss-intolerant contract requires a different transaction or product decision.
- [ ] What would falsify the modular-monolith-first recommendation? A measured team/deployment boundary, independent scaling/isolation need, or local invariant that cannot remain safely owned may justify decomposition.
- [ ] What would falsify cache-as-derived-projection? A named read contract requiring stronger availability/freshness than the origin can provide; then the authority/replication design must be revisited rather than silently weakening the contract.

## Source ledger

All URLs below were inspected on 2026-08-23. Tier `T1` is a standard/specification or original paper, `T2` official implementation/provider documentation, and `T3` first-party engineering guidance. Version labels are included where the source is explicitly versioned; “current docs” is not a promise that a deployed system has the same defaults.

| # | Source URL and title | Organization/type | Tier | Version/revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | [Google SRE - Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) | Google, SRE book | T3 | Current online edition | 2026-08-23 | Retry storms, jitter/budgets, load shedding, overload testing |
| 2 | [Google SRE - Handling overload](https://sre.google/sre-book/handling-overload/) | Google, SRE book | T3 | Current online edition | 2026-08-23 | Client throttling, retry only immediate layer, overload response |
| 3 | [gRPC - Deadlines](https://grpc.io/docs/guides/deadlines/) | gRPC, official docs | T2 | Current docs | 2026-08-23 | No default deadline, propagation, cancellation, clock skew |
| 4 | [gRPC - Retry](https://grpc.io/docs/guides/retry/) | gRPC, official docs | T2 | Current docs | 2026-08-23 | Explicit retry policy, max attempts, backoff/jitter, throttle |
| 5 | [Envoy - Circuit breaking](https://envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking) | Envoy, official docs | T2 | Envoy current/latest docs; verify deployed version | 2026-08-23 | Connection/pending/active/retry limits; uncoordinated distributed limits |
| 6 | [Envoy - Timeouts](https://www.envoyproxy.io/docs/envoy/latest/faq/configuration/timeouts.html?highlight=timeout) | Envoy, official docs | T2 | Envoy current/latest docs | 2026-08-23 | Route/connect/per-try timeout boundaries and defaults scope |
| 7 | [Envoy - Router retries](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/router_filter) | Envoy, official docs | T2 | Envoy current/latest docs | 2026-08-23 | Outer timeout, per-try timeout, jitter, retry policy/Retry-After |
| 8 | [OpenJDK JEP 444 - Virtual Threads](https://openjdk.org/jeps/444) | OpenJDK, JEP | T1 | Delivered JDK 21 | 2026-08-23 | Blocking I/O concurrency, CPU-bound limitation, no pooling requirement |
| 9 | [OpenJDK JEP 491 - Synchronize without pinning](https://openjdk.org/jeps/491) | OpenJDK, JEP | T1 | Delivered JDK 24 | 2026-08-23 | JDK version change to synchronized pinning behavior |
| 10 | [JDK 25 StructuredTaskScope API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) | Oracle/JDK API docs | T2 | JDK 25 preview | 2026-08-23 | Structured fork/join/cancel semantics and preview scope |
| 11 | [JDK 21 ThreadPoolExecutor API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html) | Oracle/JDK API docs | T2 | JDK 21 | 2026-08-23 | Core/queue/max/rejection ordering and CallerRuns |
| 12 | [JDK 21 ConcurrentHashMap API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) | Oracle/JDK API docs | T2 | JDK 21 | 2026-08-23 | Atomic `computeIfAbsent`, short mapping guidance, LongAdder use case |
| 13 | [HikariCP](https://github.com/brettwooldridge/HikariCP) | HikariCP, project README | T2 | Repository/current README; verify library version | 2026-08-23 | Pool sizing, acquisition timeout, lifetime/keepalive/leak settings |
| 14 | [PgBouncer configuration](https://www.pgbouncer.org/config) | PgBouncer, project docs | T2 | Current docs | 2026-08-23 | Session/transaction/statement pooling and prepared-statement scope |
| 15 | [AWS RDS Proxy - How it works](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html) | AWS, database proxy docs | T2 | Current AWS docs | 2026-08-23 | Pooling/multiplexing, transaction reuse, proxy boundary |
| 16 | [AWS RDS Proxy - Connections](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-connections.html) | AWS, database proxy docs | T2 | Current AWS docs | 2026-08-23 | Pinning/connection limits/timeout considerations |
| 17 | [AWS RDS Proxy - Usage scenarios](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-best-practices.usage-scenarios.html) | AWS, database proxy docs | T2 | Current AWS docs | 2026-08-23 | Fleet replicas and pool aggregation/oversubscription |
| 18 | [AWS - Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | Dual-write boundary, relay duplicates, idempotent consumers |
| 19 | [AWS - Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | Local transactions/compensation and orchestration/choreography scope |
| 20 | [Sagas](https://doi.org/10.1145/38713.38742) | Garcia-Molina and Salem, original paper | T1 | SIGMOD Record, 1987 | 2026-08-23 | Original sequence-of-local-transactions/compensation model |
| 21 | [PostgreSQL - PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html) | PostgreSQL, database docs | T2 | Current docs | 2026-08-23 | Prepared/in-doubt resource lifetime and operational warning |
| 22 | [PostgreSQL - Explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html) | PostgreSQL, database docs | T2 | PostgreSQL 17 | 2026-08-23 | Row/advisory locks, release, deadlock and transaction boundaries |
| 23 | [PostgreSQL - UPDATE and SKIP LOCKED](https://www.postgresql.org/docs/current/sql-update.html) | PostgreSQL, database docs | T2 | Current docs | 2026-08-23 | Batch claim/`SKIP LOCKED` caveat and final non-skip pass |
| 24 | [Apache Kafka Documentation](https://kafka.apache.org/documentation/) | Apache Kafka, project docs | T2 | Current site; verify deployed version | 2026-08-23 | Current broker/client concepts and operational configuration |
| 25 | [Apache Kafka - Design](https://kafka.apache.org/42/design/design/) | Apache Kafka, project design | T2 | Kafka 4.2 design page | 2026-08-23 | Partition order, ISR, unclean election, transactions/EOS, compaction |
| 26 | [Kafka producer configurations](https://kafka.apache.org/40/configuration/producer-configs/) | Apache Kafka, project config docs | T2 | Kafka 4.0 config page | 2026-08-23 | `acks`, idempotence, transactional ID; version-specific defaults |
| 27 | [Kafka topic configurations](https://kafka.apache.org/43/configuration/topic-configs/) | Apache Kafka, project config docs | T2 | Kafka 4.3 config page | 2026-08-23 | Retention/cleanup and replication-related topic settings |
| 28 | [RabbitMQ - Reliability](https://www.rabbitmq.com/docs/reliability) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Confirm/ACK boundaries, redelivery, at-least-once duplicates |
| 29 | [RabbitMQ - Confirms](https://www.rabbitmq.com/docs/confirms) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Confirm/consumer ACK independence, prefetch/requeue |
| 30 | [RabbitMQ - Quorum queues](https://www.rabbitmq.com/docs/quorum-queues) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Replication, poison messages, backlog/fan-out/latency limits |
| 31 | [RabbitMQ - Consumers](https://www.rabbitmq.com/docs/consumers) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Ack timeout, prefetch and consumer capacity |
| 32 | [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Consumer groups, pending entries, ACK/reassignment |
| 33 | [Redis Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Async replication/failover loss and `WAIT` boundary |
| 34 | [Redis Distributed Locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Redlock safety/liveness limits and fencing-token recommendation |
| 35 | [Redis Eviction](https://redis.io/docs/latest/develop/reference/eviction/) | Redis, project docs | T2 | Current docs | 2026-08-23 | `maxmemory-policy`, approximate LRU/LFU and noeviction scope |
| 36 | [Redis Administration and memory](https://redis.io/docs/latest/operate/oss_and_stack/management/admin/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Fragmentation/persistence memory overhead and sizing caveat |
| 37 | [OpenTelemetry instrumentation concepts](https://opentelemetry.io/docs/concepts/instrumentation/) | OpenTelemetry, project docs | T1 | Current docs, last updated 2026 | 2026-08-23 | Instrumentation/semantic convention boundary |
| 38 | [OpenTelemetry messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) | OpenTelemetry, specification | T1 | Current semantic conventions | 2026-08-23 | Producer/consumer correlation and messaging attributes |
| 39 | [W3C Trace Context](https://www.w3.org/TR/trace-context/) | W3C, recommendation | T1 | Recommendation, 2021 | 2026-08-23 | `traceparent`/`tracestate`, privacy/security/DoS boundaries |
| 40 | [Kubernetes - Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/) | Kubernetes, official docs | T2 | Current docs | 2026-08-23 | Startup/readiness/liveness semantics and cascade warning |
| 41 | [Kubernetes - Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/) | Kubernetes, official docs | T2 | Current docs | 2026-08-23 | Missing/not-ready metric handling and feedback-loop scope |
| 42 | [Kubernetes - Leases](https://kubernetes.io/docs/concepts/architecture/leases/) | Kubernetes, official docs | T2 | Current docs; API/version scope | 2026-08-23 | Lease/leader-election coordination, not fencing by itself |
| 43 | [Kubernetes - CronJobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) | Kubernetes, official docs | T2 | Current docs | 2026-08-23 | Approximate scheduling, duplicate/missed job and idempotency requirement |
| 44 | [OpenAPI Specification](https://spec.openapis.org/oas/) | OpenAPI Initiative, specification | T1 | Current site; choose a pinned version | 2026-08-23 | API schema/evolution/version boundary |
| 45 | [Protocol Buffers - Proto3 guide](https://protobuf.dev/programming-guides/proto3/) | Google, protocol specification/docs | T1 | Current docs | 2026-08-23 | Reserved fields and wire/source compatibility considerations |
| 46 | [Confluent Schema Evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) | Confluent, platform docs | T2 | Current platform docs | 2026-08-23 | BACKWARD/FORWARD/FULL compatibility policy scope |
| 47 | [Pact contract testing](https://pactflow.io/how-pact-works/) | PactFlow, testing docs | T3 | Current docs | 2026-08-23 | Consumer/provider contract boundary and verification |
| 48 | [Testcontainers getting started](https://testcontainers.com/getting-started/) | Testcontainers, project docs | T2 | Current docs | 2026-08-23 | Real dependency integration test lifecycle |
| 49 | [Chaos Mesh - Network chaos](https://chaos-mesh.org/docs/simulate-network-chaos-in-physical-nodes/) | Chaos Mesh, project docs | T2 | Current docs | 2026-08-23 | Network delay/loss/partition fault injection |
| 50 | [Microsoft - Microservices architecture](https://learn.microsoft.com/en-us/azure/architecture/microservices/) | Microsoft Azure, architecture guidance | T2 | Current docs | 2026-08-23 | Bounded contexts, data autonomy, chatty/complexity/eventual consistency |

## Excluded/low-value candidates

- Old Kafka design pages and duplicate API/Javadoc pages were excluded when a current versioned design/config page supported the same claim; version-specific rows remain where defaults or semantics matter.
- Generic circuit-breaker/cache/virtual-thread benchmarks were excluded because results vary by hardware, workload, provider, and version; official behavior plus a local benchmark is stronger evidence.
- Search-result pages, vendor comparison SEO, reposts of the SRE/Outbox/Saga material, and “exactly once” marketing pages without a boundary were excluded.
- A provider-specific cache/CDN guide is not used as a generic cache contract. It belongs in an application dossier only when the provider and deployment are named.

## Gate status

- [x] Complete EN/VI source files and exact section/question ranges read.
- [x] Broad source discovery completed; 50 distinct inspected sources selected.
- [x] Claims separated into facts, inferences, recommendations, unknowns, and version/provider limits.
- [x] Coverage matrix, contradictions, negative evidence, duplicate ownership, and falsifiers recorded.
- [x] Public EN/VI content updated.
- [x] Cross-reference/index integration applied.
- [x] Validation passed after integration.
