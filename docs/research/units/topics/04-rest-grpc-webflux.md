# Research — REST, gRPC, WebFlux, and reactive programming

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `04-rest-grpc-webflux`

EN file: `public/data/topics/04-rest-grpc-webflux.json`

VI file: `public/data/topics/04-rest-grpc-webflux.vi.json`

## Scope and non-goals

This unit owns HTTP/REST semantics, gRPC RPC/stream/deadline/error behavior, WebFlux/Reactor execution and backpressure, WebSocket/SSE choice, pagination/filtering, GraphQL comparison, and contract-first OpenAPI/Protobuf practice. It does not own the complete API lifecycle/idempotency/deprecation contract (topic 17), low-level TCP/HTTP transport (topic 15), or distributed workflow correctness (topic 09).

The protocol facts are scoped to the relevant RFC/specification versions; framework behavior is scoped to current Spring Framework/WebFlux and Reactor documentation as reviewed on 2026-08-23. The selection advice is conditional on workload, clients, browsers, infrastructure, and downstream resources.

## Discovery pool and source-selection accounting

The working discovery pool contained about fifty candidates across IETF HTTP RFCs, gRPC official guides/gRFC material, Spring Framework, Reactor/Reactive Streams, OpenAPI, Protobuf, GraphQL, WebSocket/SSE specifications, and pagination/cache standards. Duplicate release PDFs, generic “REST versus gRPC” SEO posts, and benchmark pages without payload/client/transport details were removed. Twenty-eight distinct sources below were inspected/selected for semantics, version scope, failure behavior, compatibility, or explicit implementation constraints.

The discovery policy allowed up to 200 candidate sources when useful; this topic stopped at the selected set because additional candidates repeated the normative specifications or lacked reproducible transport/workload details.

## Local content map

The complete EN and VI files were read. Both have 2 sections and 11 matching items.

| Section | Exact item IDs and current question | Local role |
| --- | --- | --- |
| Protocols | `04-rest-grpc-webflux.protocols.q1` REST/HTTP methods/status; `.q2` REST versus gRPC; `.q3` gRPC streams; `.q4` API versioning; `.q5` large-list pagination/filtering; `.q6` GraphQL versus REST | External/internal protocol contracts |
| Reactive / WebFlux | `04-rest-grpc-webflux.reactive-webflux.q1` Mono/Flux/event loop/backpressure; `.q2` WebFlux versus virtual threads; `.q3` Reactor error/operators; `.q4` WebSocket versus SSE; `.q5` OpenAPI/Protobuf contract-first | Execution model and contract tooling |

EN/VI item IDs and counts match. Code names (`Mono`, `Flux`, `WebClient`, `SSE`, `gRPC`, `Proto`, `OpenAPI`) should remain unchanged in translation; qualifiers such as “usually”, “hint”, “browser-dependent”, and “not a guarantee” need parity checks.

## What is correct and reusable

- The REST answer correctly separates safe from idempotent methods and explains that idempotency is a property of the semantic effect, not a promise that every request returns the same response.
- The gRPC section correctly identifies unary, server-streaming, client-streaming, and bidirectional-streaming RPCs and emphasizes deadlines/cancellation and flow control for long-lived streams.
- Keyset/cursor pagination is correctly tied to a stable, total ordering and avoids the deep-offset cost/instability of arbitrary page numbers. It should remain a workload/invariant decision rather than a universal replacement.
- The WebFlux explanation correctly treats `Mono`/`Flux` as asynchronous publishers, event-loop blocking as a failure mode, and backpressure as a demand/flow-control concern rather than merely “async syntax”.
- The WebFlux versus virtual-thread comparison is valuable when it asks whether the application has blocking dependencies, streaming/backpressure requirements, and a team able to maintain reactive composition.
- The contract-first section correctly says that OpenAPI/Protobuf can make compatibility and generated clients testable; the contract alone does not guarantee implementation parity.

## Claims to verify, qualify, or remove

| Local claim/shape | Classification | Evidence/limitation | Proposed treatment |
| --- | --- | --- | --- |
| POST is not idempotent by default | Verified HTTP semantics plus application scope | HTTP defines method semantics; an API can design a POST with an idempotency key and idempotent effect | Keep the distinction and link to topic 17 |
| `422` is the correct REST validation status | Recommendation/common convention | RFC 9110 defines core status semantics; 422 is standardized elsewhere and deployment conventions vary | Say “choose and document 4xx validation policy; 422 is a common option” |
| gRPC is always 3–10× smaller/faster than JSON REST | Unsupported benchmark claim | Encoding/CPU/HTTP2/TLS/message shape/compression/client/library and workload determine the result | Remove number; require matched benchmark |
| “REST externally, gRPC internally” | Recommendation, not law | Browser/public ecosystem, observability, proxies, streaming, org boundaries, and contract governance can reverse the choice | Present as one common topology with alternatives |
| gRPC streaming removes backpressure concerns | False | gRPC flow control can block writes/buffer; application consumption and memory still matter | Keep stream/deadline/cancel/flow-control matrix |
| API versioning with URI/header is universally safe | Incomplete recommendation | Compatibility can be additive or breaking; version signal is only one part of rollout/deprecation/client observability | Compare strategies and require contract tests/retirement plan |
| Cursor pagination is always better | Overstated | Requires stable ordering/key, cursor secrecy/expiry, snapshot/freshness policy; users needing arbitrary jumps may prefer offset/search engine tokens | Keep as a workload fit, not default law |
| GraphQL caching is hard and DataLoader is mandatory | Over-absolute | GraphQL query shape complicates generic HTTP caching, but caching can be query-aware; DataLoader is common batching/identity-map tooling, not a spec requirement | Say “requires deliberate query/batch/cache controls” |
| WebFlux publishers are always cold | Incorrectly broad | Reactor has cold and hot publishers; many factory chains are lazy but adapters/operators vary | Explain cold/hot separately |
| A blocking call blocks the whole event loop | Conditional | It blocks the event-loop thread handling that task; other loops/threads may remain available, but capacity and tail latency can collapse | Say “blocks the affected event-loop thread; enough such calls can stall the server” |
| Virtual threads make reactive obsolete | Inference | VT helps blocking-style I/O; reactive remains useful for streaming/backpressure and non-blocking composition; neither removes downstream limits | Keep a decision matrix, remove trend claim |
| SSE has a fixed six-connection limit and always needs sticky sessions | Browser/deployment-specific | Browser HTTP/1.1 connection limits and HTTP/2 behavior vary; shared pub/sub or connection routing can remove sticky-session dependency | Mark browser/provider-specific and test target clients |
| Contract-first automatically prevents drift | False | It needs generated artifacts, compatibility checks, consumer tests, review and deployment gating | Add CI process and failure case |

## Workload, invariants, and failure model

### Workload card

| Dimension | Values to record |
| --- | --- |
| Client/edge | browser/mobile/backend, proxy/LB, HTTP version, TLS/mTLS, idle/deadline limits |
| Payload | average/p95/p99 bytes, schema evolution, compression, streaming/chunking, field selection |
| Traffic | arrival rate, burst, fan-out, concurrency, response size, cacheability, ordering |
| Processing | CPU/blocking ratio, DB/HTTP calls, event-loop count, VT/executor, backpressure strategy |
| Reliability | deadline budget, retry policy, cancellation, unknown outcome, idempotency, replay tolerance |
| SLO | p50/p99/p999, throughput, error/timeout rate, memory, connection count, freshness |
| Compatibility | supported clients/versions, additive/breaking changes, generated-code rollout order |

The primary invariants are: HTTP method effect and response contract remain honest; a retry cannot duplicate an unsafe side effect without an idempotency contract; a stream has bounded memory and a cancellation/deadline path; a reactive signal is consumed at the declared demand; cursor order is stable enough to avoid duplicates/omissions under the stated consistency model; generated clients and server agree on the wire schema; and an error response does not leak sensitive fields.

### Failure/crash windows

| Window | Failure | Recovery/observation |
| --- | --- | --- |
| Client times out after server side effect | retry creates duplicate command or unknown state | idempotency key/status query/reconciliation; trace attempt and effect separately |
| gRPC deadline expires | server work may continue if application ignores cancellation | propagate deadline, check cancellation, stop child work; measure orphan work |
| stream consumer is slow | framework buffers, write blocks, memory grows, or connection is closed | flow-control metrics, bounded buffers, backpressure policy, cancellation test |
| event-loop blocking call | affected loop stalls unrelated requests | isolate blocking work or choose MVC/VT; detect with thread/loop latency |
| HTTP/2/QUIC connection failure | multiplexed streams fail/retry at different layers | connection retry policy with method idempotency and deadline budget |
| cursor data changes | duplicates/omissions or invalid cursor | stable unique ordering, snapshot/version token, documented freshness |
| GraphQL deep/broad query | resolver fan-out/DoS/N+1 | query depth/cost limits, batching, timeouts, field auth, cache policy |
| schema rollout | old client cannot decode or new client assumes absent field | additive-first rollout, compatibility checks, generated client matrix, rollback |
| SSE/WebSocket disconnect | missed event/reconnect storm | resume token/last event ID, heartbeat, backoff/jitter, connection budget |

## Coverage matrix

| Area | Evidence coverage | Local status/gap | Proposed conclusion |
| --- | --- | --- | --- |
| Definitions | RFC 9110/9111, gRPC, GraphQL/OpenAPI/Proto, Reactor | Strong | Keep protocol versus framework layers separate |
| Invariants | method idempotency, cursor ordering, stream demand, schema compatibility | Good but distributed effects need API link | Add explicit invariant cards |
| Workload | gRPC performance/flow control, Spring WebFlux | Present; remove numeric claims | Require matched payload/client/load tests |
| Failure/crash windows | deadlines, event loop, streams, retries, reconnects | Strong concepts, scattered | Add one failure table and cancellation requirement |
| Retries/timeouts | gRPC deadlines/retry, HTTP semantics | Need end-to-end budget/idempotency | Link 15/17 and state per-method policy |
| Operations/recovery | gRPC metrics/health/shutdown, Reactor hooks, stream monitoring | Needs concrete dashboard ownership | Add latency, queue/demand, cancellation, reconnect, schema metrics |
| Security/privacy | GraphQL query controls, error fields, metadata, browser channels | Underdeveloped | Add query cost, auth per field/RPC, origin/token, error redaction |
| Testing | contract/generated code and integration | Good direction | Add protocol conformance, backpressure, deadline, reconnect, compatibility tests |
| Domain trade-offs | REST/gRPC/GraphQL/WebFlux/VT | Useful | Keep as conditional selection matrix, not trend statement |

## Best-practice comparison

| Need | REST/HTTP | gRPC | GraphQL | Reactive/WebFlux versus VT |
| --- | --- | --- | --- | --- |
| Browser/public ecosystem | broad tooling/cache/proxy support | needs gateway/transcoding/client support | flexible client reads, own auth/query controls | MVC/VT often simpler for blocking stacks |
| Strong typed internal contract | OpenAPI/codegen | Protobuf/codegen and RPC status | schema/type system and resolver contract | reactive if streams/backpressure dominate |
| Bidirectional stream | WebSocket/SSE/HTTP streaming, infrastructure-specific | native bidi stream | subscriptions with implementation-specific transport | reactive composition can model demand; VT can host blocking session but needs bounds |
| Cache/conditional GET | standardized HTTP cache validators | application/client cache; not generic HTTP cache semantics | query-aware/persisted/query cache | no runtime choice supplies cache invalidation |
| Large list | cursor/keyset with stable order | paged RPC with explicit token | query fields/connection convention | bound fan-out and serialized payload |
| Failure policy | HTTP status + problem body + idempotency | status/deadline/retry service config | errors can be partial per response | cancellation and downstream budgets in both |

## Contradiction/limits table

| Competing guarantee | Resolution |
| --- | --- |
| HTTP semantics are version-independent versus HTTP/1/2/3 behavior differs | RFC 9110 defines common semantics; framing, transport, multiplexing, and failure behavior are version-specific. |
| gRPC write returns versus bytes are on the wire | gRPC flow-control docs explicitly distinguish passing data to the framework from network delivery; application-level completion still needs a contract. |
| WebFlux is non-blocking versus it can call blocking APIs | The framework can run blocking code, but placing it on event-loop threads violates the intended capacity model; Spring recommends MVC when the application relies on blocking persistence APIs. |
| VT is simpler versus reactive is more scalable | Both can be appropriate. VT simplifies blocking-style code; reactive gives explicit demand/stream composition. Downstream capacity and correctness dominate. |
| GraphQL reduces overfetching versus resolver amplification | Client-selected fields reduce some overfetching but can create resolver fan-out/N+1 and query-cost risk without batching/limits. |
| Protobuf compatibility versus schema safety | Wire compatibility is conditional on field evolution rules and rollout order; generated code does not prove business semantics or old-client behavior. |

## Negative evidence and anti-patterns

- Do not use an uncited `3–10×` REST/gRPC claim to choose a protocol; run the same schema/payload/compression/TLS/client/load test.
- Do not retry every `UNAVAILABLE`, `5xx`, or timeout; determine whether the operation is idempotent and whether the server may have committed the effect.
- Do not block a WebFlux event loop with JDBC/JPA, file, DNS, or a slow third-party client; isolate it or use a server model suited to the dependency.
- Do not add unbounded `buffer`, `flatMap` concurrency, GraphQL resolver fan-out, or stream queues and call the result backpressure-aware.
- Do not use offset pagination on a mutating high-volume table and promise no duplicates/omissions; state ordering/snapshot semantics.
- Do not treat HTTP status, gRPC status, GraphQL `errors`, and domain error codes as interchangeable; define the boundary and machine-readable contract.
- Do not make a WebSocket/SSE client reconnect immediately forever; use jitter, heartbeat, resume semantics, authentication renewal, and a connection budget.
- Do not expose GraphQL introspection/query depth/resolver errors without an environment and privacy policy.
- Do not evolve Protobuf by reusing field numbers or changing incompatible types; reserve removed fields and test mixed-version readers/writers.
- Do not assume OpenAPI code generation validates actual server behavior; add contract/integration/consumer tests.

## Duplicate/canonical ownership

| Overlap | Canonical role |
| --- | --- |
| REST method/status/idempotency/errors/version lifecycle | `17-rest-api-design` owns the full HTTP contract; this unit keeps protocol foundations and links out. |
| HTTP/TLS/HTTP1–3/TCP/connection lifecycle | `15-network-i-o-models` owns transport and I/O; this unit keeps only protocol consequences needed for selection. |
| JMM/VT runtime | `01-java-core-jvm`; this unit compares WebFlux/VT at the application model level. |
| Retry/timeout/circuit breaker | `15`/`25` own call-chain policy; gRPC deadline/flow-control facts remain here. |
| Outbox/Saga/external side effects | `09` owns distributed workflow; APIs only declare the boundary. |
| Contract/testing governance | `26-testing-strategy` owns test portfolio; this unit lists protocol-specific tests. |

## Operational, security, observability, and testing notes

Observe HTTP/gRPC status and deadline exhaustion, request/stream duration, cancellation/orphan work, retries/hedges, connection/stream counts, flow-control stalls, event-loop blocking, Reactor queue/demand/buffer, WebSocket/SSE reconnect and missed-event counts, cursor invalidation, GraphQL query cost/resolver fan-out, schema version and compatibility failures, and payload/serialization size. Trace parent deadlines and attempt/effect IDs, but do not place tokens or sensitive payloads in metadata/logs.

Security differs by boundary: browser CORS/origin/cookies/SSE/WebSocket token exposure, gRPC mTLS/metadata/field authorization, GraphQL field/query-cost authorization, and REST cache/privacy headers all need explicit policy. Problem details and gRPC error details can leak internal state; redact and classify.

Tests should cover method idempotency/conditional requests, gRPC status/deadline/cancellation/flow control, HTTP/2/3 proxy behavior where deployed, WebFlux event-loop blocking, Reactor error/retry/backpressure, WebSocket/SSE reconnect/resume, GraphQL depth/alias/N+1/partial errors, cursor mutation/ordering, mixed-version OpenAPI/Proto compatibility, generated client/server parity, and load at p99/p999 with realistic payloads.

## Integration record (Batch C scope)

- [x] Added the matched REST/gRPC benchmark and flow-control contract as `04-rest-grpc-webflux.protocols.q7`.
- [x] Added bounded reactive backpressure, cancellation, scheduler, and replayable-history guidance as `04-rest-grpc-webflux.reactive-webflux.q6`.
- [x] Mirrored both additions in EN and VI without changing existing IDs or deleting protocol evidence.
- [ ] Broader non-Batch-C cleanup below remains a follow-up audit, not an unverified claim of completion.

### Deferred broader audit items

- [ ] Remove the universal gRPC size/throughput multiplier and replace it with a reproducible benchmark contract.
- [ ] Reframe “REST outside/gRPC inside” as a common topology with browser, public API, proxy, streaming, and organizational exceptions.
- [ ] Qualify `422`, server push, HTTP/1.1 connection behavior, and versioning statements by RFC/convention/version.
- [ ] Rewrite pagination around total ordering, cursor opacity/expiry, mutation consistency, arbitrary-jump needs, and index design.
- [ ] Correct “cold publisher” to explain cold/hot Reactor sources and lazy assembly/subscription.
- [ ] Add a WebFlux-versus-VT matrix tied to blocking dependency, event-loop policy, streaming/backpressure, debugging, and downstream bulkheads.
- [ ] Add gRPC deadline propagation/cancellation and flow-control crash windows; link network retry/idempotency to topics 15/17.
- [ ] Replace GraphQL “DataLoader mandatory” with batching/query-cost/cache controls and explicit N+1 failure evidence.
- [ ] Add contract-first CI steps: schema lint, breaking-change check, generated client compile, provider/consumer contract, and runtime integration.
- [ ] Mirror all protocol modal language in VI; no public content is edited by this dossier.

## EN/VI and cross-reference plan

Preserve the 11 IDs and section order. Keep RFC names, media types, status codes, gRPC codes, Reactor operators, and schema field names identical. Translate “idempotent”, “safe”, “best effort”, “deadline”, “backpressure”, “preview”, and “provider-specific” consistently. Cross-reference `15-network-i-o-models`, `17-rest-api-design`, `01-java-core-jvm`, `09-distributed-tx-fintech`, `20-observability-sre`, and `26-testing-strategy` rather than duplicating their full material.

## Explicit unknowns and falsifiers

- Which clients, proxies, load balancers, HTTP versions, and browser targets are in scope? A protocol choice is falsified by a deployed intermediary/client that cannot preserve the required semantics or SLO.
- Is the workload mostly blocking JDBC/HTTP or genuinely non-blocking streaming? A WebFlux/VT recommendation is falsified by event-loop blocking, orphan work, or measured tail latency/resource cost.
- What are payload sizes, compression, TLS, serialization, connection reuse and concurrency? Any gRPC/REST performance claim is unresolved until a matched benchmark.
- Do cursors need stable snapshot semantics, arbitrary page jumps, or real-time freshness? The pagination recommendation is falsified by product requirements or duplicate/omission tests.
- What is the schema rollout order and oldest client? Contract compatibility is falsified by a mixed-version integration/consumer test.
- What query-cost, field-level auth, and cache model does GraphQL require? “GraphQL reduces chattiness” is not sufficient evidence for adoption.

Confidence: high for RFC/spec/API semantics; medium for framework/provider defaults; low for protocol/runtime performance and adoption recommendations until the target workload is named.

## Sources

| # | Source (title — organization) | Tier / type | Version or revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | resources, methods, safe/idempotent semantics, status classes, version-independent semantics |
| 2 | [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | cacheability, validators, freshness and conditional response scope |
| 3 | [RFC 9457: Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF/RFC Editor | A / standard | July 2023 | 2026-08-23 | machine-readable HTTP error format and extension fields |
| 4 | [RFC 5789: PATCH](https://www.rfc-editor.org/rfc/rfc5789.html) — IETF/RFC Editor | A / standard | March 2010 | 2026-08-23 | PATCH partial-update semantics and conditional/idempotency caveat |
| 5 | [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | HTTP/2 framing/multiplexing/stream scope used by gRPC |
| 6 | [gRPC core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/) — gRPC project | A / official guide | Current guide | 2026-08-23 | four RPC types, streaming and deadline concepts |
| 7 | [gRPC deadlines](https://grpc.io/docs/guides/deadlines/) — gRPC project | A / official guide | Last updated/current | 2026-08-23 | no default deadline in gRPC generally, propagation, server cancellation |
| 8 | [gRPC flow control](https://grpc.io/docs/guides/flow-control/) — gRPC project | A / official guide | Current guide | 2026-08-23 | receiver demand, buffered writes, stream backpressure boundary |
| 9 | [gRPC error handling](https://grpc.io/docs/guides/error/) — gRPC project | A / official guide | Last updated 2025-09-22 | 2026-08-23 | transport/application error status and resource-exhaustion examples |
| 10 | [gRPC status codes](https://grpc.io/docs/guides/status-codes/) — gRPC project | A / official guide | Last updated 2024-08-21 | 2026-08-23 | retry guidance and `UNAVAILABLE`/`ABORTED`/`FAILED_PRECONDITION` scope |
| 11 | [gRPC retry](https://grpc.io/docs/guides/retry/) — gRPC project | A / official guide | Current guide | 2026-08-23 | retryable codes, max attempts, exponential backoff/jitter, committed RPC boundary |
| 12 | [gRPC service config](https://grpc.io/docs/guides/service-config/) — gRPC project | A / official guide | Current guide | 2026-08-23 | per-method retry/hedging/deadline/wait-for-ready configuration |
| 13 | [gRPC performance best practices](https://grpc.io/docs/guides/performance/) — gRPC project | A / official guide | Current guide | 2026-08-23 | performance is language/workload/configuration dependent; benchmark scope |
| 14 | [Spring WebFlux overview](https://docs.spring.io/spring-framework/reference/web/webflux/new-framework.html) — Spring | A / official reference | Framework current | 2026-08-23 | non-blocking/backpressure model, event loops, MVC versus WebFlux fit |
| 15 | [WebClient synchronous use](https://docs.spring.io/spring-framework/reference/web/webflux-webclient/client-synchronous.html) — Spring | A / official reference | Framework current | 2026-08-23 | avoid per-response blocking and combine/await semantics |
| 16 | [Reactor error handling](https://projectreactor.io/docs/core/release/reference/coreFeatures/error-handling.html) — Project Reactor | A / official reference | Current release docs | 2026-08-23 | errors are terminal signals and recovery/retry operators |
| 17 | [Reactor reference: backpressure](https://projectreactor.io/docs/core/release/reference/#_backpressure) — Project Reactor | A / official reference | Current release docs | 2026-08-23 | demand/backpressure, hot/cold and operator behavior scope |
| 18 | [Reactive Streams](https://www.reactive-streams.org/) — Reactive Streams project | A / specification | Current spec/project page | 2026-08-23 | asynchronous stream processing and non-blocking backpressure contract |
| 19 | [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) — OpenAPI Initiative | A / specification | Published latest v3.2.0; revisions listed by project | 2026-08-23 | language-agnostic HTTP contract, tooling, schema-version scope |
| 20 | [Protobuf proto3 guide](https://protobuf.dev/programming-guides/proto3/) — Google/Protocol Buffers | A / official language guide | Current guide | 2026-08-23 | message/schema rules, compatibility caveats and generated code |
| 21 | [Protobuf encoding](https://protobuf.dev/programming-guides/encoding/) — Google/Protocol Buffers | A / wire-format guide | Editions 2023+ examples | 2026-08-23 | wire format, field order/non-canonical serialization, size claims must be measured |
| 22 | [Protobuf version support](https://protobuf.dev/support/version-support/) — Google/Protocol Buffers | A / support policy | Current page | 2026-08-23 | runtime/gencode compatibility and version pinning |
| 23 | [GraphQL specification](https://spec.graphql.org/October2021/) — GraphQL Specification Project | A / specification | October 2021 stable edition; draft/release pages also exist | 2026-08-23 | query/type/execution model; not a caching or batching prescription |
| 24 | [GraphQL specification versions](https://spec.graphql.org/) — GraphQL Specification Project | A / release index | Latest release September 2025; draft June 2026 listed | 2026-08-23 | current-version status; local examples must pin edition |
| 25 | [WebSocket Protocol RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html) — IETF/RFC Editor | A / standard | December 2011 | 2026-08-23 | WebSocket framing/connection protocol boundary |
| 26 | [Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — WHATWG | A / living standard | Living standard reviewed date | 2026-08-23 | EventSource/SSE parsing, reconnect and `Last-Event-ID` semantics |
| 27 | [AIP-121 Resource-oriented design](https://google.aip.dev/121) — Google API Improvement Proposals | A / first-party design guidance | Current AIP | 2026-08-23 | resource naming/relationships; guidance, not HTTP law |
| 28 | [OpenAPI Initiative home/spec index](https://spec.openapis.org/) — OpenAPI Initiative | A / specification index | Current publication list | 2026-08-23 | distinction between normative spec and schema/tooling iterations |
