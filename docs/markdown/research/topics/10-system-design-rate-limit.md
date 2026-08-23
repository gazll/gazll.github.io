# Research - System design: rate limiting and overload survival

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `10-system-design-rate-limit`

EN file: `public/data/topics/10-system-design-rate-limit.json`

VI file: `public/data/topics/10-system-design-rate-limit.vi.json`

## Scope and non-goals

This dossier owns the local rate-limiter algorithms, quota/concurrency/admission distinctions, cache and overload reasoning in the assigned topic, and the workload model used to choose among them. It does not own broker delivery semantics (topic 08), API idempotency/error contracts (topic 17), generic observability (topic 20), or the gateway implementation boundary (topic 27). Those topics should receive links, not another copy of the full algorithm discussion.

The research pool was searched across IETF specifications, Redis/Envoy/NGINX implementation documentation, cloud quota guidance, and SRE/first-party reliability material. Duplicate RFC formats, old versioned copies, search-result pages, SEO summaries, and benchmark claims without a reproducible workload were excluded. The selected ledger intentionally keeps provider-specific evidence separate from protocol facts.

## Local content map

Both JSON files were read in full. Each has 3 sections and 18 item records; the `item_id` sets are identical. The current unit is unusually strong on algorithm sketches and domain trade-offs, but several numbers and “best” defaults need scope labels.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| Framework & building blocks | `10-system-design-rate-limit.framework-building-blocks.q1` through `.q7` | Interview decomposition, rough capacity arithmetic, cache-aside/invalidation/stampede, L4/L7, CDN, and L1/L2 cache design |
| Rate limiting in depth | `10-system-design-rate-limit.rate-limiting-in-depth.q1` through `.q6` | Token/leaky/fixed/sliding windows, Redis atomic limiter, layered policy, and outage behavior |
| Surviving high load | `10-system-design-rate-limit.surviving-high-load.q1` through `.q5` | Async work, bounded queues, retry budgets, shedding, DB scaling, p99 investigation, and reversible overload control |

The complete IDs are:

```text
10-system-design-rate-limit.framework-building-blocks.q1
10-system-design-rate-limit.framework-building-blocks.q2
10-system-design-rate-limit.framework-building-blocks.q3
10-system-design-rate-limit.framework-building-blocks.q4
10-system-design-rate-limit.framework-building-blocks.q5
10-system-design-rate-limit.framework-building-blocks.q6
10-system-design-rate-limit.framework-building-blocks.q7
10-system-design-rate-limit.rate-limiting-in-depth.q1
10-system-design-rate-limit.rate-limiting-in-depth.q2
10-system-design-rate-limit.rate-limiting-in-depth.q3
10-system-design-rate-limit.rate-limiting-in-depth.q4
10-system-design-rate-limit.rate-limiting-in-depth.q5
10-system-design-rate-limit.rate-limiting-in-depth.q6
10-system-design-rate-limit.surviving-high-load.q1
10-system-design-rate-limit.surviving-high-load.q2
10-system-design-rate-limit.surviving-high-load.q3
10-system-design-rate-limit.surviving-high-load.q4
10-system-design-rate-limit.surviving-high-load.q5
```

## What is correct and reusable

- The topic correctly treats rate limiting as a control problem: define the protected resource, key, time window, burst policy, response contract, and failure mode before choosing a data structure.
- The token-bucket pseudo-code, the fixed-window boundary counterexample, sliding-window alternatives, and the Redis Lua atomicity discussion are useful teaching anchors.
- The distinction among rate, quota, concurrency, backpressure, and load shedding should remain central. A quota over a billing period is not interchangeable with a per-second rate, and a concurrency cap protects in-flight work rather than arrival volume.
- The cache material correctly recognizes TTL as a damage bound rather than a freshness proof, and it gives a realistic stale-read/invalidation race. This should be retained and linked to topic 20 for cache/telemetry measurements.
- The overload section correctly prefers bounded queues, admission control, bulkheads, timeouts, and explicit degradation over an unbounded “queue everything” design. The OTA search-versus-booking contrast is a good domain example, provided it is framed as a recommendation rather than a universal OTA guarantee.
- The Redis Cluster hash-tag example is directionally correct for keeping limiter keys in one slot. It must also state that a Redis script is atomic on one Redis execution context and that asynchronous replication/failover can change the durability of accepted limiter state.

## Claims to verify or qualify

| Local claim or pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| `1 day ~ 10^5 seconds`, then average QPS examples | Heuristic | Use `86,400 seconds` for arithmetic; call peak multipliers and payload sizes assumptions, not facts about a generic system. | High |
| “One I/O-bound instance handles a few thousand QPS” and “a primary handles a few thousand writes/sec” | Unresolved benchmark | Depends on CPU, query shape, payload, storage, indexes, durability, runtime, network, and tail-latency target. Replace with a capacity-test method. | High that it is workload-dependent |
| Token bucket allows a sustained rate plus a burst capacity | Verified algorithm fact | State whether tokens are fractional/integer, clock source, refill precision, and whether the key is local or shared. | High |
| Leaky bucket smooths output | Verified algorithm family | NGINX implements a leaky-bucket-style request limiter, but not every library uses identical queue/drop semantics. | High |
| Fixed windows can admit roughly twice the nominal rate at a boundary | Inference from algorithm | True for a simple independently reset counter under an adversarial boundary; state window/key and do not call it a universal exact factor for weighted variants. | High |
| Redis Lua makes a limiter atomic | Provider fact with scope | Redis executes a script atomically on the executing server, blocking other activity during execution. It does not make a multi-shard operation atomic and does not make acknowledged state durable across every failover. | High |
| Redis Cluster multi-key Lua works with a hash tag | Provider fact | All keys used by the command/script must map to one hash slot. Hash tags solve placement, not cross-shard availability or strong consistency. | High |
| `TIME` in a limiter solves clock consistency | Over-absolute | It gives Redis server time for that execution, reducing application-clock disagreement for one authority. It does not give one global clock across independent shards or remove failover/clock assumptions. | High |
| `ceil(capacity/rate*2)` is a safe expiry | Repository design example | It is a cleanup heuristic. It must be tested against refill precision, idle periods, clock behavior, retries, and the selected algorithm. | High |
| `429` plus `Retry-After` is the response contract | Partly verified | RFC 6585 defines 429 and says a response may include explanatory details; `Retry-After` is useful but its exact presence/value is an API policy. Header drafts are not yet a stable RFC at review time. | High |
| Rate limit should fail open when Redis is down | Recommendation, not fact | Depends on threat and resource: public reads may degrade open; payment, credential, or abuse controls usually need a bounded closed/degraded policy. Record the choice and alert on it. | High |
| “More consumers/instances solve high load” | Negative evidence | Shared hot keys, downstream saturation, partitions, queue limits, and retry multiplication can make horizontal scale worsen the outage. | High |
| TTL is a freshness guarantee | Incorrect absolute | TTL bounds how long an entry can remain without refresh under normal cache operation; invalidation loss, stale readers, failover, and clock behavior still exist. | High |
| Delayed double-delete solves cache races | Overstated | It is a mitigation with a delay assumption, not a proof. Versioned keys, authoritative re-read, or transactional invalidation may be stronger for correctness-critical data. | High |
| Rate limiting, quota, concurrency, backpressure and shedding are interchangeable | Incorrect | They control different dimensions and must be named separately in the design and metrics. | High |

## Workload, invariants, and failure model

### Workload model

For each limiter, the final content should expose at least:

| Variable | Meaning | Required assumption |
| --- | --- | --- |
| `R_peak`, `R_sustained` | Arrival rate at the enforcement point | Specify average, p95/p99 burst, and whether retries are included. |
| `K` | Limiting key | User, API key, tenant, IP, route, resource, or a composite; define spoofing and cardinality. |
| `C` | Capacity/burst | Tokens, concurrent requests, bytes, jobs, or provider quota units. |
| `S` | Service time distribution | Use p50/p95/p99 and tail under dependency failure, not only a mean. |
| `Q_max` | Queue/admission bound | A finite bound with an explicit overflow response; no unbounded memory queue. |
| `D` | Downstream budget | DB connections, provider quota, CPU, memory, broker publish capacity, or cost budget. |
| `F` | Failure policy | Fail open, fail closed, local fallback, or reject with retry guidance; include its blast radius. |

Core invariants are: (1) no accepted request may exceed the documented policy except for a documented approximation/burst; (2) limiter state for one key is updated atomically at the chosen authority; (3) a rejected request has a stable, machine-readable outcome; (4) queue and concurrency bounds are finite; (5) critical business state remains authoritative in its database/ledger; (6) retries do not silently multiply the budget; and (7) stale cache data cannot authorize a correctness-critical decision.

### Crash and failure windows

| Window | What can happen | Recovery/control |
| --- | --- | --- |
| Before limiter state write | Request is rejected or limiter timeout occurs | Use a bounded decision timeout and a documented fail-open/closed policy; measure decision errors separately from business 5xx. |
| After token consume, before upstream request | Capacity is consumed although work never starts | Choose whether this is acceptable; refunding is dangerous unless the request identity is idempotent and refund is atomic. |
| Upstream timeout after accepted request | Client retries and consumes more capacity; original work may still complete | Bound retries, use idempotency for commands, expose `Retry-After` only when safe, and measure ambiguous outcomes. |
| Redis primary acknowledges then fails before replica receives state | A failover may forget accepted tokens | Redis documentation explicitly describes asynchronous-replication write-loss scenarios; strict quotas need a stronger authority or an accepted overage policy. |
| Redis Cluster reshard/failover during a script | `MOVED`, `ASK`, timeout, or partial client knowledge | Use a cluster-aware client, one hash slot per script, retry only safe decisions, and test failover/reshard. |
| Cache invalidation lost or delayed | Old representation survives past intended freshness | Version keys, durable invalidation/rebuild, authoritative read before mutation, and an explicit stale budget. |
| Queue fills or dependency is slow | Tail latency and memory grow; retries amplify load | Enforce admission, max queue age, per-dependency bulkheads, timeout budgets, and load shedding. |
| Autoscaling reacts after saturation | New replicas start cold and add connection/cache/retry storms | Warm-up, readiness that reflects local capacity, connection limits, and a scale-out signal that precedes hard saturation. |

## Best-practice comparison

| Mechanism | Controls | Strength | Failure/operation cost | Appropriate example |
| --- | --- | --- | --- | --- |
| Token bucket | Arrival rate + burst | Simple, predictable admission; local or shared | Shared state, time precision, failover overage | Per-tenant API requests with a documented burst |
| Leaky bucket / paced queue | Output rate | Smooths downstream traffic | Queueing latency and bounded-queue design are mandatory | Protecting a provider that dislikes bursts |
| Fixed window | Count per reset interval | Very cheap and easy to explain | Boundary overshoot; synchronized resets | Coarse public quota where approximation is acceptable |
| Sliding log | Exact recent arrivals | Accurate window | Storage and cleanup cost grows with event count | Low-volume high-value or audit-sensitive key |
| Sliding counter | Weighted recent counts | Lower state/cost than log, approximate | Boundary approximation and clock/window details | General API rate policy at moderate scale |
| Concurrency semaphore | In-flight work | Direct protection of pools/CPU/DB slots | Leaked permits, fairness, queue behavior | Booking/payment calls with bounded provider concurrency |
| Local limiter | Per-instance arrivals | Low latency, survives shared-store outage | Policy scales with replica count; hot-key unfairness | Best-effort edge read protection |
| Shared Redis/Envoy service | Fleet-wide policy | Consistent key budget within authority scope | Network hop, store outage, hot keys, failover semantics | Per-tenant or API-key limits where overage matters |
| Admission + load shedding | Work accepted | Preserves critical path under overload | Product degradation and prioritization policy | Search degraded while booking/payment remains protected |

The recommended sequence is: use a local transaction/constraint for correctness, then use a rate limiter to control abuse/overload, then use concurrency/bulkheads for the finite dependency, and finally use a bounded queue only when delayed work is genuinely safe. A limiter is not a substitute for a database invariant or an idempotency key.

## Coverage matrix

| Gate area | Evidence and local coverage | Gap to close before integration |
| --- | --- | --- |
| Definitions | Token/leaky/fixed/sliding algorithms; rate/quota/concurrency distinction | Add one sentence that protocol markers (RFC 2697/2698) are not a complete API policy. |
| Invariants | Atomic consume, burst, key, authority, `429` response | Add an explicit allowed-overage/failover invariant for shared stores. |
| Workload | QPS, peak ratio, payload, queue and downstream limits | Replace generic “few thousand QPS” claims with a benchmark worksheet. |
| Failure/crash windows | Redis failover, cache race, retry/queue overload | Add a state diagram for “accepted but upstream outcome unknown.” |
| Retries/timeouts | `Retry-After`, dependency timeout, retry storms | Put retry budget and idempotency at every client/dependency hop. |
| Operations/recovery | Hot keys, cold cache, rebuild, backpressure, autoscaling | Add runbook signals: limiter decision errors, overage, key skew, queue age, rejected work. |
| Security/privacy | IP/user/tenant keys, abuse controls | Add spoofed forwarded-IP/header trust boundary and key privacy rules. |
| Testing | Boundary tests and load/p99 investigation are present | Add clock skew, failover, reshard, Redis script latency, and retry-storm tests. |
| Domain trade-offs | Fintech authority and OTA revalidation examples | Mark each as domain recommendation, not a claim about every fintech/OTA. |

## Contradictions and limits

| Competing guarantee | What the sources/local draft actually support | Teaching implication |
| --- | --- | --- |
| Exact quota vs high availability | Redis Cluster documentation describes asynchronous replication and possible acknowledged-write loss during failure. | A fleet-wide limiter may choose availability with bounded overage; strict accounting needs a stronger authority or reconciliation. |
| Smoothness vs latency | NGINX leaky-bucket behavior can delay requests; token bucket can admit a burst. | State whether the objective is fairness, low latency, or downstream smoothing. |
| Fail open vs fail closed | Envoy exposes configurable failure behavior; Google/AWS guidance emphasizes overload protection but does not prescribe one policy for every endpoint. | Make the policy per route/risk tier, not a global slogan. |
| Standard headers vs draft headers | RFC 6585 standardizes 429; the RateLimit header specification reviewed here is an Internet-Draft (`-11`), not a final RFC. | Treat `RateLimit-*` fields as a compatibility decision and keep fallback headers/documentation. |
| More retry vs more availability | AWS and Envoy guidance warns that retries can amplify load; Envoy recommends retry budgets. | Retry only safe/idempotent operations, bound total time, and instrument retry volume. |
| Cache latency vs correctness | Cache-aside reduces origin load but invalidation and stale-read races remain. | Cache search/catalog projections; revalidate price, inventory, policy, ledger, or authorization before commit. |

## Negative evidence and anti-patterns

- Do not use a Redis `GET` followed by `SET` for a shared consume decision; concurrent clients can both pass.
- Do not run a long Lua script or an unbounded key scan in the same Redis instance that handles the limiter; scripts block server activity.
- Do not put `user_id`, raw URL, or arbitrary header values into high-cardinality metrics labels. Keep limiter key cardinality bounded and use logs/traces for sampled diagnosis.
- Do not trust `X-Forwarded-For` as an identity key until the trusted proxy chain is explicit; an attacker can choose the header at the public edge.
- Do not retry every `429`, `502`, `503`, or timeout with the same backoff. A retry budget, jitter, operation idempotency, and total deadline are required.
- Do not treat a cache invalidation event as proof that every reader has observed the new value.
- Do not advertise “exactly N requests per second” if the chosen store can lose accepted state on failover or if multiple local limiters are independently enforcing the policy.

## Duplicate/canonical ownership

| Concept | Canonical owner | Action for this topic |
| --- | --- | --- |
| Broker acks, retry topics, DLQ, consumer flow control | `08-message-queue` | Link from the high-load/async examples; do not reproduce broker semantics. |
| Saga/Outbox/unknown provider outcomes | `09-distributed-tx-fintech` and Case Study 15 | Mention only when a limiter protects a workflow; the workflow invariant belongs there. |
| Generic cache pitfalls and invalidation | Existing microservice/cache material and topic 20 for measurements | Keep the race example because it is used to reason about overload; consolidate definitions during integration. |
| Gateway/edge identity and per-route filters | `27-api-gateway-identity-edge` | This topic owns the algorithm and policy; topic 27 owns placement and trust boundary. |
| SLO/RED/USE and alert design | `20-observability-sre` | Link metrics/runbook sections rather than duplicating formulas. |
| Distributed locks used by the limiter | `28-distributed-lock-lease` | Do not present a lock as a replacement for atomic token consumption. |

## Integration record (Batch C scope)

- [x] Added byte/concurrency/retry-aware capacity thresholds as `10-system-design-rate-limit.framework-building-blocks.q7`.
- [x] Added limiter outage modes and bounded overload-controller recovery as `rate-limiting-in-depth.q6` and `surviving-high-load.q5`.
- [x] Mirrored the additions in EN and VI; existing rate-limit/cache evidence remains in its canonical questions.

## Expansion pass (Batch J slice, 2026-08-23)

- [x] Enriched `surviving-high-load.q2` with resource-derived bounds for concurrency, queue capacity, priority lanes, retry budget, oldest-age/deadline signals, and hysteretic recovery routing to q5.
- [x] Qualified `rate-limiting-in-depth.q5`: `429`/`Retry-After` and rate-limit headers are caller-contract choices, not a promise that every internal layer emits identical fields; `503`/`504` and unsafe retries remain separate cases.
- [x] Mirrored both changes in EN/VI without changing immutable IDs, section order, or canonical ownership.
- [x] Added per-item provenance in `public/data/content-reviews.json` using Google SRE, AWS, Envoy, RFC 6585, and RFC 9110 sources.
- [ ] Broader non-Batch-J cleanup below remains a follow-up audit.

### Deferred broader audit items

- [ ] Replace generic capacity numbers with an assumption table and a measurement exercise; retain `86,400` as the arithmetic constant.
- [ ] Add an algorithm contract box: key, authority, clock, burst, response, atomicity, expiry, failover, and allowed overage.
- [ ] Mark RFC 2697/2698 as marker specifications and RFC 6585 as the 429 status source; label RateLimit headers as draft/version-sensitive.
- [ ] Amend the Redis example with script blocking, same-slot requirement, asynchronous replication, hot-key behavior, and a failure policy.
- [ ] Separate `rate`, `quota`, `concurrency`, `backpressure`, and `load shedding` into a decision table with metrics.
- [ ] Add a retry budget and ambiguous-outcome example for `429`/timeout; cross-link idempotency instead of implying the limiter solves duplicates.
- [ ] Keep the cache race and domain examples, but use “recommendation” labels and require revalidation for correctness-critical mutations.
- [ ] Add a crash-window table and test plan covering failover, clock skew, resharding, queue overflow, and cache invalidation loss.
- [ ] Update EN and VI together; preserve all `item_id` values and keep code identifiers/header names unchanged.

## EN/VI parity and cross-reference plan

The EN/VI files have identical sections and item IDs, so the integration batch should update them symmetrically. The current VI text is longer in bytes because examples and Vietnamese wording expand, not because it has extra questions. Each inserted qualification should have the same classification (`fact`, `inference`, `recommendation`, `unknown`) in both languages. Links should point to the canonical topic keys above only after the catalog owner confirms them.

## Open questions and falsifiers

- [ ] Which limiter authority and failure policy does the target application actually need: local best-effort, Redis with bounded overage, gateway service, or a strongly consistent quota service?
- [ ] What is the maximum acceptable overage during failover, and can the business reconcile it after the fact?
- [ ] Are the target commands idempotent? If not, what prevents a retry after a timeout from performing the business action twice?
- [ ] What is the trusted proxy chain for IP-based keys, and how are NAT/shared-IP users treated?
- [ ] Which Redis version/client and cluster topology will the final code target? Script/function behavior and defaults are version-sensitive.
- [ ] What measurements would falsify the recommendation? Examples: p99 decision latency exceeds the endpoint budget, key skew makes one shard hot, a failover loses more accepted tokens than the policy allows, or cache invalidation delay exceeds the domain freshness bound.
- [ ] If the service cannot enforce fencing/version checks at the authoritative resource, the “lock/cache/limiter preserves correctness” recommendation must be downgraded to an overload optimization.

## Source ledger

All selected sources were reviewed on 2026-08-23. Tier A means a standard/specification or first-party project implementation document; Tier B means first-party operational guidance. “Current” means the publisher’s current page at review time and must be pinned before code integration.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 10-01 | [RFC 2697 - A Single Rate Three Color Marker](https://datatracker.ietf.org/doc/rfc2697), IETF | A; RFC, Aug 1999 | Token-bucket-style committed rate/burst marker terminology and limits; not a full HTTP API policy. | 2026-08-23 |
| 10-02 | [RFC 2698 - A Two Rate Three Color Marker](https://datatracker.ietf.org/doc/html/rfc2698), IETF | A; RFC, Aug 1999 | Two-rate token-bucket marker and peak/committed-rate distinction. | 2026-08-23 |
| 10-03 | [RFC 6585 - Additional HTTP Status Codes](https://datatracker.ietf.org/doc/html/rfc6585), IETF | A; RFC, Apr 2012 | `429 Too Many Requests` semantics and the fact that a response may explain the condition. | 2026-08-23 |
| 10-04 | [RateLimit header fields for HTTP](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), IETF | A; Internet-Draft `-11`, 2026-05-23; not a final RFC | Proposed `RateLimit`/policy fields and their draft status; do not present them as stable standards. | 2026-08-23 |
| 10-05 | [Introduction to Redis programmability and `EVAL`](https://redis.io/docs/latest/develop/interact/programmability/eval-intro/), Redis | A; current Redis docs | A Redis script executes atomically on the server and blocks other activity while running; slow scripts are an operational risk. | 2026-08-23 |
| 10-06 | [Redis Lua API](https://redis.io/docs/latest/develop/interact/programmability/lua-api/), Redis | A; current Redis docs | Script key declaration, cluster slot constraints, and the fact that script atomicity is scoped to one Redis execution context. | 2026-08-23 |
| 10-07 | [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/), Redis | A; current Redis Open Source docs; version selector includes 8.x/7.x | 16,384 hash slots, hash tags for same-slot multi-key scripts, quorum/availability behavior, and acknowledged-write loss scenarios. | 2026-08-23 |
| 10-08 | [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/), Redis | A; current Redis docs | Replication is asynchronous by default and replication/failover affects durability and staleness. | 2026-08-23 |
| 10-09 | [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/), Redis | A; current specification | Slot ownership, node failure detection, failover, and cross-slot restrictions. | 2026-08-23 |
| 10-10 | [Redis functions](https://redis.io/docs/latest/develop/programmability/functions-intro/), Redis | A; Redis 7+ feature docs; current page | Functions persist with the library and have deployment/replication implications distinct from ad hoc script caching. | 2026-08-23 |
| 10-11 | [Rate limit HTTP filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_filter), Envoy | A; Envoy 1.40.0-dev documentation | Route descriptors, external rate-limit service, `429`, statistics, and configurable failure behavior. | 2026-08-23 |
| 10-12 | [Rate Limit Quota filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_quota_filter), Envoy | A; Envoy 1.40.0-dev documentation | Quota assignments, expirations, fallback, and quota-specific operational scope. | 2026-08-23 |
| 10-13 | [Circuit breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking), Envoy | A; Envoy 1.40.0-dev documentation | Concurrency/pending/retry limits, backpressure, per-cluster scope, and fuzzy distributed counters. | 2026-08-23 |
| 10-14 | [HTTP routing and retry semantics](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing.html), Envoy | A; Envoy 1.40.0-dev documentation | Overall request timeout, retry conditions, retry budgets, and retry-storm risk. | 2026-08-23 |
| 10-15 | [Module `ngx_http_limit_req_module`](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html), NGINX | A; current NGINX docs | Leaky-bucket-style limiting, shared memory zone, burst/delay/nodelay, status behavior, and dry-run. | 2026-08-23 |
| 10-16 | [Module `ngx_http_limit_conn_module`](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html), NGINX | A; current NGINX docs | Concurrent-connection limiting is a different control from request-rate limiting. | 2026-08-23 |
| 10-17 | [Rate limiting](https://docs.cloud.google.com/service-infrastructure/docs/rate-limiting?hl=en), Google Cloud | B; provider documentation, current page | Service-consumer quota dimensions and provider-specific enforcement; not a universal algorithm guarantee. | 2026-08-23 |
| 10-18 | [REL05: How do you design interactions in a distributed system to mitigate or withstand failures?](https://wa.aws.amazon.com/wellarchitected/2020-07-02T19-33-23/wat.question.REL_5.en.html), AWS | B; Well-Architected guidance, 2020 page | Timeouts, retries, backoff, and graceful degradation as a combined failure-control problem. | 2026-08-23 |
| 10-19 | [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter), AWS Builders' Library | B; current Builder Center page | Retry multiplication, timeout budgeting, exponential backoff, and jitter. | 2026-08-23 |
| 10-20 | [Handling overload](https://sre.google/sre-book/handling-overload/), Google SRE | B; SRE book, current web edition | Client-side throttling, overload behavior, fairness, and protecting backends from bursts. | 2026-08-23 |
| 10-21 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html), IETF | A; RFC 9110, Jun 2022 | 503/504 semantics, intermediary boundaries, and why gateway timeout is not proof of upstream non-execution. | 2026-08-23 |
| 10-22 | [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/), Cloudflare | B; current provider docs | A provider-specific edge policy example; useful as a counterexample to treating all rate-limit dimensions as portable. | 2026-08-23 |

## Gate status

- [x] Complete EN/VI files and exact item IDs read.
- [x] Broad candidate discovery completed; selected sources are mapped to claims.
- [x] Coverage matrix, contradiction/limits, negative evidence, crash windows, and domain trade-offs recorded.
- [x] Duplicate/canonical ownership and EN/VI plan recorded.
- [ ] Final version/provider choice approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.
