# Research — Pegasus catalog Product API architecture

Status: INTEGRATED
Reviewed: 2026-08-23
Local unit: 09-pegasus-catalog-product-api-architecture
EN file: public/data/case-studies/articles/09-pegasus-catalog-product-api-architecture.html
VI file: public/data/case-studies/articles/09-pegasus-catalog-product-api-architecture.vi.html
Metadata EN/VI: public/data/case-studies/09-pegasus-catalog-product-api-architecture.json, public/data/case-studies/09-pegasus-catalog-product-api-architecture.vi.json

## Scope and non-goals

This case studies a historical read-heavy catalog Product API that separates catalog access from TIKI.VN's shared database, uses Mercury/MySQL-to-Mongo replication, Pegasus in-memory caching, Kafka invalidation, compression and non-blocking/HTTP/gRPC integration. It is a first-party implementation narrative and benchmark report, not a current Tiki contract or a universal “gRPC/cache/compression/L4” recommendation.

The research question is: how can a catalog read path serve high-throughput single and multi-product requests with bounded tail latency while making cache freshness, invalidation loss, origin recovery, connection management and large-response behavior explicit?

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| entry-point | Database separation, Mercury replication, Pegasus API, Arcturus dependency, 10k RPS/TP95<5ms target, Vert.x/Kafka/gRPC/cache/CPU design and benchmark | Core architecture; freshness, authorization and failure recovery are underdocumented |
| in-mem-cache | Guava cache, decorator loaders, single/multi query merge, compression, promise cache, consistent hashing and output cache | Strong implementation detail; invalidation semantics, TTL/versioning and stampede limits need explicit contracts |
| compressor | Single/multi compressor services, gzip/Snappy, custom compression header and traffic/latency observations | Useful payload trade-off; algorithm/version/CPU/security and content-negotiation behavior need qualification |

Both language files preserve the same three IDs. VI translates “In-mem cache” to “In-memory cache” while retaining the ID. The article has no separate heading for the opening architecture list, so integration should keep entry-point as its anchor.

## What is correct and reusable

- Separating a read API from a shared transactional database is a valid migration boundary, but it needs a declared system of record, replication lag/freshness contract and reconciliation path.
- A local cache plus event-driven invalidation can reduce origin load and latency for read-heavy catalog traffic. It is an eventually consistent projection unless invalidation and read-version rules prove stronger behavior.
- A decorator loader that checks cache then origin, and a multi-query path that fetches only missing keys, is a clear composition pattern. It must bound fan-out, response size and partial-failure behavior.
- Promise/request coalescing addresses concurrent misses for the same key, but it is not a global stampede solution and does not protect against hot keys across instances.
- Consistent hashing can improve cache locality under certain load-balancer/topology assumptions, but it only helps if routing is stable and rebalance/replication behavior is controlled.
- Compression is a CPU/bandwidth/latency trade-off. Separate single and multi payload paths can be reasonable, but the API contract must negotiate content encoding correctly and protect against decompression/resource attacks.
- Vert.x event-loop non-blocking design is relevant; synchronous DNS, Mongo access or compression on the event loop can negate the architecture.
- The benchmark is valuable as a historical workload experiment. It is not portable without request mix, payload size, client connection behavior, hardware, cache state, GC, network, LB and percentile definitions.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Pegasus separates catalog from TIKI.VN shared DB; Mercury replicates MySQL to Mongo; Pegasus reads Mongo; Arcturus owns inventory | First-party architecture fact | Tiki entry-point | Define authoritative write/read stores, replication lag, correction/replay and authorization boundary | High as historical architecture |
| Requirement is at least 10k RPS with TP95 below 5 ms | First-party target | Tiki entry point | Label as target; percentile, payload, cache state, client and deployment topology are unspecified | Medium |
| Local memory cache, Kafka invalidation, compression and nonblocking improve performance | First-party design/inference | Tiki article; Kafka/Vert.x/Guava docs | Improvement depends on freshness, event loss, CPU, cache distribution and request mix | Medium-to-high |
| Blocking DNS/compression on Vert.x event loop is unsafe | General framework fact | Vert.x official docs | Scope to blocking duration/thread pool and Vert.x version | High |
| Disruptor had no benefit over ExecutorService in the experiment | First-party experiment result | Tiki entry point | Keep as local workload result; include executor/queue/config and avoid universal library claim | Medium |
| Benchmark reached 24k RPS, TP99 20 ms for single-product with 40 connections | First-party benchmark result | Tiki article | Add hardware, response size, warm-up/cache, client and error rate; target TP95<5 and result TP99 20 are not directly comparable | Medium |
| PHP opening 2–3 connections/request causes about 15k connections and L7 halves throughput/doubles latency | First-party client/LB experiment | Tiki article | Scope to client/library/LB configuration; persistent pooling and HTTP/2 can change behavior | Medium |
| L4 is better than L7 for this API | Conditional first-party inference | Tiki benchmark | Depends on TLS termination, routing, observability, health checks and protocol; not a universal architecture rule | Low-to-medium |
| gRPC persistent connections are useful for PHP | First-party design plus gRPC guidance | Tiki article; gRPC docs | Benefit depends on channel reuse, HTTP pooling, proxy/LB and client implementation; local integration was incomplete | Medium |
| Guava cache is a suitable local map | Implementation fact | Guava docs | Cache size/expiry/refresh/eviction/error semantics need configuration and freshness policy | High as library capability |
| Promise cache prevents duplicate origin loads | First-party design claim | Tiki in-memory section | Scope to one process/key; cancellation/error/timeout and cross-instance stampede remain | Medium |
| Consistent hashing improves hit rate from 85% to 95% | First-party benchmark result | Tiki article | State topology, key distribution, rebalance and cache size; no general percentage | Low-to-medium |
| Multi-output cache handles hot deals with TP90<1 sec and large payload bandwidth | First-party benchmark/design | Tiki cache section | Add response size, hit ratio, memory/eviction, staleness and origin fallback; TP90 is not TP99 | Medium |
| Gzip single and Snappy multi improve latency from 15 to 6 ms | First-party result | Tiki compressor section | Compression level/CPU/payload/client support and percentile are unknown; preserve as local result | Medium |
| Kafka invalidation makes local catalog cache correct | Over-absolute inference | Tiki architecture | Invalidation delivery/order/duplication/loss/replay and source version are not documented; cache is eventual unless proven otherwise | Low |
| gRPC is faster than HTTP | Over-absolute inference | Tiki experiments | Compare equivalent pooling, serialization, payload, LB and observability; local text itself says pooling can remove benefit | Low |

## Workload, invariants, and failure model

### Workload model

- Read-heavy catalog API with single-product and multi-product requests, high fan-out from PHP/client applications and hot keys during promotions.
- Origin path: catalog writes/changes in Mercury/MySQL, Mongo read projection, Kafka invalidation, local Guava cache, optional output cache and compression services.
- Request cost varies by product size, number of products, cache hit/miss, decompression/sorting/merging, network hops, client connection reuse and load-balancer behavior.
- The article reports target and benchmark numbers but not product cardinality, update rate, key skew, response-size distribution, cache memory, Kafka partitions/retention, Mongo lag or failure-domain topology.
- Hot-deal output cache has a different freshness/risk budget from ordinary catalog reads; a catalog description can tolerate more staleness than price/availability fields if they share a payload.

### Invariants

1. Mercury/MySQL is the declared source of truth for catalog writes; Mongo/cache/output projections carry a version or timestamp sufficient to detect staleness.
2. A catalog change invalidates or versions every affected cache key, including single-product, multi-product and derived output keys.
3. Duplicate, delayed or out-of-order invalidation events cannot make a newer cached version be replaced by an older one.
4. If an invalidation is lost or the consumer is down, the system has TTL/version revalidation/reconciliation and a documented maximum staleness policy.
5. Multi-product responses preserve requested identity/order and have bounded missing-key fan-out, payload size, CPU and memory; partial failure is explicit.
6. Promise/request coalescing is bounded by timeout/cancellation and does not leave a permanently stuck future after origin failure.
7. Compression is negotiated via standard semantics or a documented header; decompression and compression have resource limits and safe fallback.
8. A cache hit does not bypass authorization or expose tenant/seller/private catalog data through an incorrect cache key.
9. Every benchmark and SLO names percentile, path, payload, cache state, client topology and error rate.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| Catalog write commits but Kafka invalidation is not published | Local cache remains stale | Transactional outbox/CDC or periodic version reconciliation; measure invalidation lag |
| Invalidation published but consumer/cache process is down | Stale entries survive restart | Durable consumer offset, replay, boot invalidation/version scan and TTL |
| Older invalidation arrives after newer event | Fresh cache is incorrectly evicted/refreshed with old data | Per-key version/sequence compare and idempotent invalidation |
| Cache miss origin load fails after promise created | All waiters fail or future remains stuck | Timeout/cancellation, clear failed promise, bounded retry and fallback |
| Many instances miss the same hot key | Local promise cache does not coalesce globally; origin stampede | Distributed request coalescing/admission, stale-while-revalidate, hot-key prewarm and origin quotas |
| Multi-query has partial cache hits and origin timeout | Partial/empty response, inconsistent ordering or huge fan-out | Per-key deadline, bounded concurrency, explicit partial/error contract and metrics |
| Compression CPU blocks event loop or compressor dies | Tail latency and request backlog | Worker pool/separate service, CPU saturation limit, uncompressed fallback and circuit breaker |
| L7 proxy opens/terminates connections unexpectedly | Throughput/latency changes, sticky behavior or retry duplication | Measure topology, connection reuse, HTTP/2, health checks and retry policy |
| Mongo replication lag or stale read | Catalog response violates freshness | Read concern/version watermark, lag SLO and origin fallback for critical fields |
| Output cache serves large stale/hot payload | Bandwidth/memory exhaustion or outdated promotion data | Size/TTL/stale-if-error policy, admission control, eviction and purge |
| gRPC channel/HTTP connection reaches concurrent-stream limit | Client-side queueing and tail latency | Reuse/pool channels, set deadlines, observe queueing and load balance |
| Cache key omits tenant/locale/authorization dimension | Cross-user/tenant data leak | Key review, authorization-before-cache and security tests |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Mercury/Mongo/Pegasus, cache, invalidation, compression, gRPC/LB | Kafka, Guava, Vert.x, gRPC, RFC 9111 | Define source of truth, projection/version, freshness, cache key, coalescing and content encoding. |
| Invariants | Architecture and cache flow implied | Kafka ordering; Mongo replication; HTTP caching | Add version/order/staleness/auth/response-shape invariants. |
| Workload | 10k target, 24k benchmark, single/multi/hot deal | SRE overload; gRPC performance | Add payload, skew, cache state, concurrency, connection/LB and error distributions. |
| Failure/crash windows | Invalidation/cache/connection behavior partially described | Kafka reliability; Guava refresh; CloudFront stale | Add lost/duplicate/out-of-order event, lag, stampede, compressor and cache-key failures. |
| Retries/timeouts | Mostly absent | gRPC deadlines; AWS idempotency/backoff; SRE | Add per-hop deadline, retry budget, idempotent GET, no blind retry for side effects and origin fallback. |
| Operations/recovery | Benchmark/architecture only | OpenTelemetry, SRE overload/cascading | Add lag, cache age/hit, coalescing, origin load, compression, queue and recovery runbook. |
| Security/privacy | Not covered | RFC 9111 authenticated caching; OWASP; cloud security | Add cache key/auth, PII/tenant isolation, image/catalog access and artifact secrets. |
| Testing | Experiments and charts | Kafka/Guava/gRPC/HTTP docs | Add property, stale/order, fault injection, load, cache stampede, LB/client and compression tests. |
| Domain trade-offs | Latency/throughput vs cache freshness/complexity | RFC 9111; SRE; Mongo/Kafka docs | Separate safe-to-stale catalog fields from price/availability and define business budgets. |

## Best-practice comparison

| Local approach | Comparable practice | Assessment and boundary |
| --- | --- | --- |
| Local Guava cache with Kafka invalidation | Cache-aside/read-through plus event invalidation/versioning | Good read path; add TTL/version/reconciliation because event delivery is not a global freshness proof. |
| Promise cache | Single-process request coalescing | Useful for same-key concurrent misses; pair with hot-key admission/stale-while-revalidate across instances. |
| Consistent hashing | Stable key-to-cache ownership | Can improve locality but needs topology stability, rebalance policy and failure replication. |
| Multi-query merge of missing keys | Bounded fan-out/batch read | Good cache efficiency; cap keys, bytes, concurrency and per-key deadline. |
| L4 vs L7 experiment | Transport/proxy trade-off | Keep benchmark as topology-specific; L7 may provide routing/observability/features that are worth cost. |
| REST/HTTP and gRPC | Protocol choice with connection reuse/deadlines | Compare end-to-end with equivalent pooling, payloads and LB; protocol name alone is not performance proof. |
| Gzip/Snappy and separate compressor | Content encoding/compression service | Negotiate safely, measure CPU/bandwidth/tail latency and cap decompression resources. |
| Hot-deal output cache | Explicit freshness/stale-while-revalidate/stale-if-error policy | Suitable only when stale content is acceptable and purge/recovery is defined. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| Kafka invalidation keeps cache correct | Kafka can deliver duplicates, delays and failures; order is partition-scoped | Use versioned invalidation plus TTL/reconciliation and state the freshness bound. |
| Local cache is enough | Multiple instances create separate caches and hot-key stampede | Decide local/distributed cache/consistent routing from workload and failure requirements. |
| 24k RPS/20ms proves 10k RPS/<5ms target | Different percentile, path and likely payload/cache/client conditions | Keep target and benchmark separate; do not infer target satisfaction. |
| L4 doubles performance | L4/L7 behavior depends on TLS, pooling, routing, protocol and observability | Reproduce with specified topology and client. |
| gRPC is faster | HTTP pooling may remove connection overhead; serialization/server implementation can dominate | Compare equivalent transport and include operational complexity. |
| Compression reduces latency | CPU can saturate, event loops can block and bandwidth may not be the bottleneck | Measure CPU/tail/error and use per-payload policy. |
| Cache hit rate implies API quality | Hits can be stale/unauthorized or biased to hot keys | Pair hit rate with age/freshness, invalidation lag, correctness and origin load. |
| Promise cache prevents stampede | It coalesces within one process/key and can amplify a failing origin to many waiters | Add timeout, cross-instance strategy and failure isolation. |

## Negative evidence and anti-patterns

- Do not use the local RPS/latency numbers as a capacity promise without the missing benchmark dimensions.
- Do not treat a Kafka invalidation topic as a transactional cache invalidation guarantee unless write/change publication and replay are proven.
- Do not cache responses before checking authorization or including tenant/locale/field-selection dimensions in the key.
- Do not allow a failed promise/future to remain indefinitely or retry every waiter independently.
- Do not fan out unbounded multi-product misses to Mongo or let a 200 KB/large output cache consume memory without admission/eviction controls.
- Do not compress synchronously on a Vert.x event loop or trust unbounded decompression input.
- Do not conclude L4 is always better than L7; measure the required routing, TLS, observability and retry semantics.
- Do not retry GETs through a proxy without considering duplicate load, deadlines and stale fallback; do not retry side effects if this API later gains mutations.
- Do not expose the same cache object for public catalog, private seller data and authorization-sensitive fields without an explicit key/security design.

## Operational, security, observability and testing concerns

- API SLIs: RPS, p50/p95/p99 per endpoint/query size, error/timeout, response bytes, cache hit/miss/stale, origin latency/load, Mongo lag, Kafka consumer lag and invalidation age.
- Cache SLIs: entries/bytes, evictions, load success/error, coalesced waiters, hot-key distribution, version gaps, stale-served count, purge/reconciliation delta and memory pressure.
- Compression SLIs: payload ratio, CPU/time, event-loop blocking, compressor queue, decompression failures and fallback rate by encoding/client.
- Client/LB SLIs: connections/request, reuse, HTTP/2 streams/channel queue, L4/L7 distribution, retries, backend selection and connection churn.
- Traces: request ID, product IDs only in controlled low-cardinality form, cache decision/version, origin query, Kafka partition/offset, compressor and client/LB spans using OpenTelemetry; avoid sensitive seller data.
- Security: cache authorization/key review, tenant/locale isolation, TLS, Kafka/Mongo ACLs, secret management, dependency patching, deserialization/compression limits, rate limits and audit of privileged cache purge.
- Testing: deterministic cache state, duplicate/out-of-order/lost invalidation, version regression, Mongo lag, Kafka restart/replay, promise timeout, hot-key stampede, multi-query partial failure, compressor fuzz/zip-bomb, LB topology, gRPC stream limits, client retry and cache poisoning.
- Recovery: rebuild caches from Mongo/version source, replay invalidations from durable offset, invalidate all affected keys after uncertainty, serve origin/degraded response with freshness label and verify parity before re-enabling hot output cache.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic queue delivery/order/invalidation semantics | Topic 08-message-queue | Keep Kafka/cache event scope and link for delivery guarantees. |
| Generic outbox/CDC publication | Topic 09-distributed-tx-fintech and Case 15 | Mention as a way to close write-to-invalidation gap; do not duplicate pattern tutorial. |
| Inventory consistency | Case 01 Arcturus | Arcturus owns mutation/inventory; Pegasus owns catalog read separation and cache freshness. |
| Generic caching patterns | Cache/API performance topic | Keep Tiki implementation and benchmark; link for cache-aside/stampede definitions. |
| Catalog Product API, cache/compression/LB trade-offs | This case | Own Mercury/Pegasus flow, single/multi query, invalidation, client/LB and compressor evidence. |

## Integration record (Batch C scope)

- [x] Added source-scoped evidence boundaries for throughput, connection, cache, payload, and bandwidth figures.
- [x] Added bounded local single-flight/coalescing and compression CPU/size trade-offs to both EN and VI articles.
- [ ] The broader catalog freshness/invalidation audit below remains a follow-up; the historical Tiki measurements are not generalized.

### Deferred broader audit items

1. Add a source-of-truth/read-model diagram with write, replication, invalidation, cache, origin fallback and reconciliation boundaries.
2. Define catalog freshness by field: product metadata versus price/availability, and add version/timestamp/watermark semantics.
3. Explain how write commit and Kafka invalidation are made reliable; if unknown, state the lost-invalidation window and TTL/reconciliation requirement.
4. Add cache-key dimensions, TTL/eviction/refresh, authorization and tenant/locale isolation.
5. Add bounded multi-query fan-out, partial failure/ordering/response-size and promise timeout/error behavior.
6. Separate single-product and multi-product/hot-deal benchmark tables; include payload, cache state, concurrency, client connections, topology, hardware, duration and p95/p99.
7. Reword L4/L7 and gRPC conclusions as workload-specific observations; compare equivalent HTTP pooling/channel reuse.
8. Document compression negotiation, algorithm/library versions, CPU budget, decompression limits and fallback.
9. Add observability/recovery/chaos tests for invalidation gaps, Mongo lag, Kafka replay, cache stampede, compressor failure and LB/client churn.
10. Preserve EN/VI IDs and link generic queue/outbox/inventory topics rather than duplicating them.

## EN/VI and cross-reference plan

- Preserve entry-point, in-mem-cache and compressor IDs; keep component names, Kafka topic, headers, algorithms and protocol names unchanged.
- Standardize source of truth, read projection, freshness, staleness, invalidation, version/watermark, cache stampede, request coalescing, tail latency, content encoding and connection reuse.
- Translate the same benchmark caveats and unresolved contracts in both languages.
- Link generic cache/queue/outbox topics to canonical owners; link this case from catalog/API performance content for the Tiki evidence.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| Which store is authoritative and what is Mongo replication lag? | Data ownership, replication/read settings and lag dashboards | API can return stale/incorrect catalog with no bounded policy or reconciliation. |
| How is write-to-Kafka invalidation made atomic/recoverable? | Producer/CDC/outbox code and failure tests | A catalog write can commit while invalidation is permanently lost. |
| How are invalidation versions/order handled? | Event schema and consumer logic | Older/duplicate events overwrite newer cache state. |
| What are cache TTL/size/refresh/eviction and stale-serving rules? | Guava/config and product freshness policy | Memory/freshness or hot-deal requirements cannot be met under origin/cache outage. |
| Does promise cache survive origin timeout/failure? | Implementation tests/metrics | A stuck future or retry fan-out amplifies an outage. |
| Are benchmark paths comparable to the 10k/5ms target? | Scripts, hardware, payload, cache/LB/client details | Reproduction fails under the same target path or error rates are omitted. |
| Does L4/gRPC benefit persist with modern pooling/HTTP2? | Controlled equivalent benchmark | Pooling/topology removes benefit or operational complexity exceeds gain. |
| Can compressed/output cache responses be safely served stale? | Field-level freshness/security policy | Stale price/availability or unauthorized payload is possible. |
| Are cache keys authorization/locale/tenant complete? | Key design and security tests | Cross-user/tenant/private data can be served from cache. |

## Discovery pool and exclusions

The discovery pool contained approximately 47 candidates; 28 distinct sources were selected. Duplicate Tiki reposts, generic cache-stampede explainers, unverified protocol benchmarks, obsolete library pages without version context and vendor marketing claims were excluded. The final ledger prioritizes Tiki's first-party implementation, Vert.x/Kafka/Guava/gRPC/RFC documentation, official cache/LB guidance and SRE/observability sources.

## Sources

All sources were reviewed on 2026-08-23. Current library/provider pages are used to qualify the historical case; their current defaults are not attributed to Pegasus.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Pegasus Catalog Product API Architecture](https://engineering.tiki.vn/pegasus-catalog-product-api-architecture/) — Tiki Engineering | T1 first-party; historical article, revision not stated | Mercury/Pegasus/Arcturus architecture, cache/invalidation/compression, client/LB/gRPC experiments and benchmarks. |
| 2 | [Vert.x Core Java documentation](https://vertx.io/docs/vertx-core/java/) — Eclipse Foundation | T1 official; current docs | Event-loop execution, non-blocking requirement and worker execution boundary. |
| 3 | [Vert.x WorkerExecutor API](https://vertx.io/docs/4.4.9/apidocs/io/vertx/core/WorkerExecutor.html) — Eclipse Foundation | T1 official; Vert.x 4.4.9 API | Blocking work on separate worker pool and returning to original context; version-specific. |
| 4 | [Kafka design](https://kafka.apache.org/40/design/design/) — Apache Kafka | T1 official; Kafka 4.0 page | Partition offsets, at-least-once default, exactly-once scope and ordering limits. |
| 5 | [Kafka semantics](https://kafka.apache.org/documentation/#semantics) — Apache Kafka | T1 official; current docs | Producer/consumer delivery, retries/commit and message ordering scope. |
| 6 | [Guava cache guide](https://github.com/google/guava/wiki/cachesexplained) — Google Guava | T1 official project docs; current wiki | Size/time/reference eviction, refresh and local cache semantics. |
| 7 | [LoadingCache API](https://guava.dev/releases/22.0/api/docs/com/google/common/cache/LoadingCache.html) — Google Guava | T1 official; Guava 22.0 API | Refresh behavior, old-value retention and load coalescing/version scope. |
| 8 | [gRPC performance best practices](https://grpc.io/docs/guides/performance/) — gRPC | T1 official; current docs | Reuse channels, HTTP/2 stream limits, channel pools and stream trade-offs. |
| 9 | [gRPC guides](https://grpc.io/docs/guides/) — gRPC | T1 official; current docs | Protocol/tooling scope and version/provider boundary. |
| 10 | [HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html) — IETF | T1 Internet Standard; RFC 9111, June 2022 | Cache keys, freshness, validation, stale/must-revalidate and invalidation limits. |
| 11 | [CloudFront expiration/stale serving](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) — AWS | T1 official; current docs | stale-while-revalidate and stale-if-error as provider-specific cache policies. |
| 12 | [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) — Redis | T1 official product docs; current | Cache-aside flow and hot-key/cache-stampede failure. |
| 13 | [Cache layer architecture](https://redis.io/blog/cache-layer-architecture-guide/) — Redis | T1 first-party blog; current | Stampede/thundering-herd terminology; not a universal solution. |
| 14 | [Consistent hashing](https://dl.acm.org/doi/10.1145/258533.258660) — Karger et al., ACM | T1 original research; 1997 | Consistent-hash rationale and remapping behavior; exact cache gain is workload-specific. |
| 15 | [MongoDB replication](https://www.mongodb.com/docs/manual/replication/) — MongoDB | T1 official; current docs | Replica-set replication/read concern and lag/freshness boundaries. |
| 16 | [MySQL replication](https://dev.mysql.com/doc/refman/8.4/en/replication.html) — Oracle MySQL | T1 official; MySQL 8.4 docs | Source replication concepts and the need to qualify Mercury's historical setup. |
| 17 | [Snappy](https://github.com/google/snappy) — Google | T1 official project; repository revision not pinned | Snappy compression provenance and speed/ratio trade-off context. |
| 18 | [GZIP file format](https://www.rfc-editor.org/rfc/rfc1952.html) — IETF | T1 informational RFC; RFC 1952, 1996 | Gzip format/content coding context; HTTP negotiation remains RFC 9111/9110. |
| 19 | [Envoy load balancing overview](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/overview) — Envoy | T1 official; current docs | Upstream routing/load-balancing behavior and topology-specific trade-offs. |
| 20 | [AWS Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html) — AWS | T1 official; current docs | Layer-4 load-balancing capabilities; not proof L4 is always faster. |
| 21 | [AWS Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) — AWS | T1 official; current docs | Layer-7 routing/HTTP capabilities and operational trade-offs. |
| 22 | [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — OpenTelemetry | T1 specification; semconv 1.44.0 registry | Common HTTP/database/messaging telemetry and version/stability scope. |
| 23 | [Messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) — OpenTelemetry | T1 specification; development status | Producer/consumer/process/settle spans, context propagation and message attributes. |
| 24 | [HTTP semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/) — OpenTelemetry | T1 specification; mixed stability | HTTP latency/error instrumentation and convention-version migration. |
| 25 | [Handling overload](https://sre.google/sre-book/handling-overload/) — Google SRE | T1 first-party chapter; current online edition | Degraded responses, local copies, load shedding, utilization and retry budgets. |
| 26 | [Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | T1 first-party chapter; current online edition | Queue/memory exhaustion, retry amplification and cache/dependency failure cascades. |
| 27 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — Amazon Builders’ Library | T1 first-party; current article | Idempotent request/retry handling and late-arriving responses. |
| 28 | [Exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — AWS Architecture Blog | T1 first-party; updated 2023-05 | Retry synchronization and backoff/jitter behavior. |
