# Batch C Research - traffic, large requests, uploads, and asynchronous work

Status: `INTEGRATED`

Reviewed: 2026-08-23

This is the Batch C synthesis layer. It does not replace the per-unit research records; it resolves overlap before any new `public/data` edit.

## Local scope

The selected units are:

| Unit | Exact role kept after deduplication |
| --- | --- |
| Topic 04 - REST/gRPC/WebFlux | Protocol semantics, streaming, pagination, reactive backpressure, and transport choice. |
| Topic 10 - system-design rate limit | Capacity arithmetic, rate/quota/concurrency/admission controls, overload and shedding. |
| Topic 15 - network/I/O models | HTTP lifecycle, connection reuse, deadlines, retry composition, and I/O resource budgets. |
| Topic 17 - REST API design | Canonical API contract for bulk, 202 jobs, pagination, conditional requests, and webhooks. It was already integrated in Batch A; Batch C only adds cross-links or a narrowly scoped large-body contract if needed. |
| Topic 27 - API gateway/identity edge | Edge ownership, request hygiene, per-hop budgets, and sync-versus-async boundary. |
| Case 09 - Pegasus catalog API | First-party implementation evidence for high-throughput reads, compression, cache amplification, and connection pressure. |
| Case 13 - Discord message storage | First-party implementation evidence for hot partitions, request coalescing, migration checkpoints, and reported results. |

Cases 01 and 15 remain linked examples, not Batch C owners: Case 01 owns inventory command replay and Case 15 owns outbox/order crash windows. Topic 08 owns broker delivery; Topic 25 owns retry-storm and consumer resilience synthesis; Topic 17 owns API idempotency and 202 semantics.

## Decision thesis

1. A large body is a resource budget, not just a bigger JSON field. Set limits at every hop, reject before expensive buffering or parsing, and make the error contract explicit (`413 Content Too Large` under RFC 9110, or a provider-specific equivalent).
2. Use inline request bodies for small, bounded, atomic commands. Stream when the server can consume incrementally. Use a direct object-storage multipart/resumable session when the body is large, long-lived, retry-prone, or should bypass application bandwidth. The upload session is a durable business resource with ownership, expiry, checksum and completion semantics.
3. `202 Accepted` is safe only when acceptance created durable work identity and a status/recovery path. A queue put, Kubernetes Job, or workflow run is not automatically idempotent, cancellable, or exactly once.
4. Rate limit, quota, concurrency limit, queue backpressure, admission control, and overload shedding solve different problems. A limit can protect a budget while a full queue still destroys latency; a semaphore can cap concurrency while allowing an unbounded wait queue. State the policy and the metric separately.
5. Retrying a large request requires replayable bytes, a stable intent key, a body checksum and a known provider boundary. A timeout after an upload part, `CompleteMultipartUpload`, or a mutation is `UNKNOWN` until status is queried; retrying with a new object key or job ID can duplicate the business effect.
6. Request coalescing is a bounded amplification control, not a cache and not a global lock. It works only for equivalent requests that meet at the same owner; the system still needs a deadline, cancellation, bounded waiters, stale/error policy and a fallback when the owner dies.

## Canonical ownership

| Repeated concept | Canonical owner | Keep in Batch C units |
| --- | --- | --- |
| HTTP method/status/header semantics | Topic 04 and Topic 17 | Use only the large-body or transport consequence in 15/27. |
| API idempotency, 202, pagination, webhooks | Topic 17 | Link from gateway and network answers; do not re-teach the full contract. |
| Broker ACK/order/replay/DLQ | Topic 08 | Explain why an async boundary needs those semantics, not another broker tutorial. |
| Retry storms and consumer Inbox | Topic 25 | Keep gateway/network retry budgets and body-replay hazards. |
| Rate/quota/concurrency/admission | Topic 10 | Case 09/13 use only their local workload evidence. |
| HTTP lifecycle and connection pool | Topic 15 | Gateway and Pegasus reuse the resource-budget model. |
| Gateway trust/identity/edge controls | Topic 27 | Keep route ownership, deadline, header hygiene and migration boundary. |
| Large upload state/checksum/resume | Batch C synthesis, with object-store-specific examples | No existing unit owns the complete upload lifecycle; add a compact canonical module to Topic 17 or the closest existing large-body item, not a new topic by default. |
| Catalog read amplification | Case 09 | Keep Pegasus-specific cache/compression/connection measurements. |
| Hot-key coalescing and storage migration | Case 13 | Keep Discord-specific routing, checkpoints and reported results. |

## State machines and invariants

### Upload session

```text
INITIATED -> PARTIAL -> VERIFYING -> COMPLETE
     |           |          |            |
     +------> ABORTED <-----+        immutable object
     +------> EXPIRED
```

Invariant: a part belongs to exactly one authorized upload session and is accepted only for the expected upload ID, part number/range, checksum and size. Completion is a conditional, idempotent transition over the recorded part manifest; it must not publish the object or trigger downstream processing before integrity and authorization pass. Abort/expiry must stop future parts and reclaim incomplete artifacts according to the object-store contract.

### Asynchronous job

```text
ACCEPTED -> RUNNING -> SUCCEEDED
     |          |          |
     +------> CANCELLED  FAILED -> RETRYABLE/TERMINAL
     +------> EXPIRED    UNKNOWN -> INQUIRY/RECONCILIATION
```

Invariant: one client intent maps to one durable job identity; retries return or resume that identity. A worker claim has a visibility/lease deadline and a fencing or version rule where the resource is correctness-sensitive. Cancellation is cooperative and must state whether already committed side effects are compensated. Progress is advisory unless the job contract defines a monotonic checkpoint.

### Coalesced read

```text
MISS -> OWNER_RUNNING -> VALUE | ERROR | STALE_FALLBACK
          |       |
          +-------+-- waiter deadline/cancel
```

Invariant: only equivalent keys may share a flight; a waiter cannot mutate the owner request or extend the global deadline. A crashed owner removes or expires the flight, and the next request may retry under a stampede budget.

## Decision table

| Need | Preferred boundary | Why | Required failure contract |
| --- | --- | --- | --- |
| Small atomic command | Inline HTTP/gRPC body | Simple validation and one request budget | Size limit, idempotency, deadline, 4xx/5xx distinction |
| Large but one-shot body | Streaming endpoint | Avoids full buffering | Incremental validation, cancellation, byte/time budget, checksum if persisted |
| Large/unstable client upload | Direct multipart/resumable object upload | Parts retry independently and application bandwidth is bypassed | Upload ID, owner, part manifest, checksums, expiry/abort cleanup, complete idempotency |
| CPU/heavy or long work | Durable job plus `202` status resource | Request does not hold an edge/server thread | Durable acceptance, progress, cancellation, retry owner, terminal/unknown state |
| Many identical reads | Request coalescing/singleflight | Suppresses simultaneous backend work | Same-key scope, waiter cap, deadline, owner crash, stale/error fallback |
| Sustained excess traffic | Admission + bounded queue + shedding | Keeps critical work alive | Priority/fairness, `Retry-After`, queue age, overload trigger/recovery |
| Per-client budget | Rate/quota policy | Controls time-window or token allocation | Key authority, clock, burst/overage, response hints, outage behavior |
| Downstream scarce slots | Concurrency limit/bulkhead | Prevents pool/CPU exhaustion | Acquire deadline, queue bound, rejection metric, release on cancellation |

## Workload and sizing contract

Do not use a single RPS number for Batch C. Record:

- request and response size distributions, not only averages;
- upload part size, parallel parts per client, active sessions, retry rate, checksum CPU and object-store egress/ingress;
- peak arrival rate, burst duration, search-to-detail ratio, hot-key percentile, coalescing hit ratio and waiter count;
- per-hop deadline, queue wait, service time, connection-pool size, downstream concurrency and retry attempts;
- tenant fairness, priority classes, maximum accepted work, retention and deletion cost;
- p50/p95/p99/p999 latency, rejected/expired/cancelled/unknown work, bytes buffered, queue age, pool occupancy and origin saturation.

Capacity equations are a first estimate only:

```text
wire bandwidth = arrival_rate * encoded_request_bytes
buffer memory  = concurrent_streams * per-stream-buffer * safety_factor
job capacity   = workers * effective_service_rate * utilization_target
retry load     = original_load * (1 + downstream_retry_attempts)
```

The architecture changes when the body no longer fits the edge buffer, when queue wait consumes the deadline, when object-store multipart cleanup becomes material, or when one key/tenant consumes the shared pool. Those thresholds are measurements, not constants.

## Failure matrix

| Failure window | Unsafe shortcut | Safer contract |
| --- | --- | --- |
| Client disconnects during upload | Keep buffering or restart from byte zero | Abort/cancel the stream, retain a resumable session if policy allows, and reconcile stored parts. |
| Part upload times out | Create a new upload ID and retry all parts | Reuse upload ID/part number, checksum and query/list the part before retry. |
| Complete call times out | Assume object is absent and complete again | Query object/upload status by stable ID; make completion idempotent and downstream event deduplicated. |
| Request accepted before DB commit | Return `202` with an in-memory job | Commit job identity/status/outbox before acknowledging acceptance. |
| Worker dies after claim | Let visibility expire without idempotency | Reclaim with a lease/version; apply the business key once and record checkpoint. |
| Queue fills | Increase threads or queue without limit | Reject/degrade by priority, bound queue memory, expose retry timing and protect the origin. |
| Retry after 413/429/timeout | Retry blindly at every layer | Classify refusal, propagate one deadline, apply one retry owner and honor `Retry-After` where present. |
| Coalescer owner crashes | Leave waiters forever or stampede immediately | Expire the flight, cancel waiters by deadline and apply jittered retry/admission. |
| Hot catalog key | Add replicas without shaping reads | Consistent routing + bounded singleflight/cache; monitor hot-key skew and stale fallback. |
| Migration checkpoint skips data | Trust sampled comparison only | Persist range/checkpoint, compare counts/checksums, quarantine mismatch and retain rollback reads. |

## Domain comparison

| Domain | Strongest priority | Can be stale/deferred | Must not be hidden |
| --- | --- | --- | --- |
| Bank/fintech mutation | Ledger/invariant and authorization | Analytics, notifications, some read models | Unknown provider result, duplicate charge, rejected admission |
| Catalog/search | Read latency and origin protection | Price projection, product metadata, cache | Version/freshness, stale fallback, hot-key overload |
| Media/file upload | Byte integrity, ownership, quota and malware/policy checks | Thumbnail/transcode/indexing | Partial upload, checksum failure, expiry, processing job state |
| Discord-like history read | Hot-key isolation and predictable read cost | Compaction/repair and some derived counters | Partition skew, migration mismatch, deletion/retention obligations |
| General async export/report | Durable job identity and resource fairness | Progress detail and notification timing | Accepted versus running, cancellation boundary, terminal failure |

## Claims to keep qualified

- S3's multipart workflow is one provider contract, not a universal object-storage rule. S3 documents independent, out-of-order parts, a 10,000-part range, checksums, explicit complete/abort and incomplete-upload billing/lifecycle; Google Cloud, Azure and tus expose different session and checksum details.
- HTTP defines semantics but not one global request-size limit. RFC 9110's `413 Content Too Large` is a response semantic; edge, proxy, framework and application limits still need to align.
- gRPC flow control protects streaming receivers; it does not make unary calls bounded or make a completed business mutation retry-safe. gRPC's retry guide treats a response header as the commit point for further RPC retries.
- A `202` response means accepted for processing, not completed. The status resource, retention, authorization and idempotency contract are application responsibilities.
- A queue visibility timeout is a redelivery mechanism, not proof that an old worker stopped. Correctness-sensitive work needs idempotency and, where necessary, fencing/version checks.
- Request coalescing reduces concurrent duplicate reads only inside the routing/owner scope. It is not a replacement for cache freshness, persistence, or global admission control.
- RateLimit headers remain version-sensitive: the active IETF Internet-Draft is not an RFC and its hints are not an SLA. `Retry-After` and a documented application contract are still required.
- Pegasus and Discord numbers are source-specific reports. Without payload, hardware, topology, cache state, connection counts, workload skew and percentile definitions they are not portable capacity targets.

## Negative evidence / anti-patterns

- Do not proxy a multi-gigabyte upload through every application hop merely because the API can accept JSON.
- Do not set a generous global body limit and assume per-route authorization, decompression and parser limits are covered.
- Do not retry a non-replayable streaming body or a timed-out external mutation with a new idempotency/job/upload key.
- Do not use an unbounded executor or queue as asynchronous architecture; it only moves the outage into memory and latency.
- Do not call a semaphore a rate limiter, or a rate limiter an overload controller.
- Do not use a cache/coalescer result as the authority for a correctness-critical mutation.
- Do not call HTTP/2 or HTTP/3 a universal latency win without measuring handshake reuse, multiplexing, flow control, loss and payload.
- Do not treat a successful upload part as a published immutable object; completion and integrity verification are separate transitions.
- Do not treat a sampled migration comparison as proof that unsampled ranges, tombstones, deletes and backups are correct.

## Integration order

1. Keep Topic 17's existing API contract as canonical; add only a compact large-body/upload lifecycle and cross-reference it from the transport/edge topics.
2. Integrate Topic 04 with streaming/backpressure/pagination/deadline qualifiers and a benchmark contract.
3. Integrate Topic 10 with the rate/quota/concurrency/admission/shedding table and overload failure tests.
4. Integrate Topic 15 with the layered deadline, connection-pool, retry/body-replay and flow-control boundaries.
5. Integrate Topic 27 with edge size limits, trusted ingress/header hygiene, per-hop budget and durable async acceptance.
6. Integrate Case 09 with source-scoped payload/compression/connection metrics and cache/read-amplification limits.
7. Integrate Case 13 with hot-key/coalescing scope, partition/repair risks, migration gates, deletion/privacy and reported-result qualifiers.

No question ID, HTML anchor, figure, code identifier or source-specific result may be deleted. EN/VI qualifiers must be mirrored before a status moves to `INTEGRATED`.

## Open questions and falsifiers

- Is the intended upload protocol a direct provider multipart API, tus, or an application-owned chunk store? The provider's part/checksum/expiry rules decide the exact state machine.
- Which routes may stream, which require full validation before side effects, and which need a durable job?
- What are the maximum body/header/decompression limits at CDN, gateway, framework, service and downstream?
- What is the trusted identity and quota owner for upload sessions and async jobs?
- Which operations are replayable after a timeout, and which provider query proves an ambiguous result?
- What is the acceptable queue wait/deadline budget and priority policy under overload?
- What deletion, malware scanning, retention, legal hold and backup obligations apply to incomplete and completed objects?
- What newer first-party Discord/Pegasus evidence would invalidate the historical implementation conclusions?

## Source ledger (selected; reviewed 2026-08-23)

The seven per-unit dossiers retain their full ledgers. This synthesis selects the following standards and first-party documents for cross-unit claims; provider values remain provider-scoped.

| Source | Use in this synthesis |
| --- | --- |
| [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Method/idempotency vocabulary, field limits, `202`, `413 Content Too Large`, deadlines and range semantics. |
| [RFC 9111 - HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html) | Cache freshness, validation and stale response boundaries. |
| [RFC 9113 - HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html) | Multiplexing and stream/connection flow-control scope. |
| [RFC 9114 - HTTP/3](https://www.rfc-editor.org/rfc/rfc9114.html) | QUIC/HTTP/3 transport and stream scope; no universal latency claim. |
| [RFC 9457 - Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html) | Error envelope for size, quota, cancellation and async failures. |
| [IETF RateLimit header draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) | Version-sensitive quota hints and non-SLA caveat. |
| [gRPC Deadlines](https://grpc.io/docs/guides/deadlines/) | Absolute deadline, cancellation and propagation. |
| [gRPC Flow Control](https://grpc.io/docs/guides/flow-control/) | Streaming receiver protection and deadlock caveat. |
| [gRPC Retry](https://grpc.io/docs/guides/retry/) | Retry commit point, attempts, backoff/jitter and retry throttling. |
| [Reactive Streams](https://www.reactive-streams.org/) | Non-blocking backpressure contract. |
| [Spring WebFlux reference](https://docs.spring.io/spring-framework/reference/web/webflux.html) | Framework/runtime scope for reactive HTTP. |
| [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) | Multipart state, independent parts, completion/abort, checksums and cleanup. |
| [S3 object integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) | Provider checksum options and verification limits. |
| [Google Cloud resumable uploads](https://cloud.google.com/storage/docs/resumable-uploads) | A different provider's resumable session contract. |
| [tus resumable upload protocol](https://tus.io/protocols/resumable-upload) | Open resumable-upload protocol and extension scope. |
| [Azure Put Block](https://learn.microsoft.com/en-us/rest/api/storageservices/put-block) | Block-upload alternative and provider-specific part semantics. |
| [Azure Put Block List](https://learn.microsoft.com/en-us/rest/api/storageservices/put-block-list) | Explicit commit/list boundary for block uploads. |
| [Envoy overload manager](https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager) | Resource-pressure actions and overload scope. |
| [NGINX `client_max_body_size`](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size) | Edge body-limit implementation example. |
| [Google SRE - Handling Overload](https://sre.google/sre-book/handling-overload/) | Queueing, load shedding, graceful degradation and retry budgets. |
| [AWS SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) | Redelivery/claim-liveness boundary, not exactly-once execution. |
| [Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) | Batch-job completion/retry semantics and controller scope. |
| [Temporal Workflows](https://docs.temporal.io/workflows) | Durable workflow execution as a distinct option from a raw queue/job. |
| [OpenTelemetry HTTP semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/) | Request/response and error observability; avoid sensitive body attributes. |
| [OpenTelemetry messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) | Queue/job correlation and processing signals. |
| [CloudEvents specification](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md) | Event envelope/correlation only; not delivery or idempotency. |
| [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm) | Cursor pagination terminology; not an endorsement of GraphQL for every API. |
| [Tiki Pegasus source article](https://engineering.tiki.vn/pegasus-catalog-product-api-architecture-f217c8623c9b) | Case 09 local architecture and reported workload; historical/source-scoped. |
| [Discord - How Discord stores trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) | Case 13 local architecture/migration/reporting; historical/source-scoped. |

## Gate status

- [x] Exact local units and canonical ownership mapped.
- [x] Existing per-unit ledgers reviewed; selected cross-unit standards and provider contracts refreshed.
- [x] Invariants, state machines, workload, failure windows, domain matrix and anti-patterns recorded.
- [x] Large-body/upload/async/coalescing overlap separated from Batch A and Batch B owners.
- [x] Public EN/VI content integrated: 10 bilingual topic items plus Pegasus and Discord case qualifiers.
- [x] Cross-reference/index integration applied: content index 474 items and System Design catalog source mapping updated to 63 moved questions.
- [x] Batch C validation passed after integration: content validation, full check, and 241 tests.
