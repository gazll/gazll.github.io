# Research — Networking, protocols, and I/O models

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `15-network-i-o-models`

EN file: `public/data/topics/15-network-i-o-models.json`

VI file: `public/data/topics/15-network-i-o-models.vi.json`

## Scope and non-goals

This unit owns HTTP/HTTPS/TLS, HTTP/1.1–3, TCP/UDP/QUIC, request/server thread models, blocking/non-blocking readiness, keep-alive/pooling, gRPC transport implications, retry/timeout/backoff/circuit-breaker boundaries, realtime delivery, and the end-to-end request lifecycle. It does not own the full HTTP resource contract (topic 17), REST/gRPC/WebFlux selection details (topic 04), Java JMM/VT internals (topic 01), or observability/SRE policy (topic 20).

Protocol facts are separated from framework/provider defaults. Network behavior depends on OS/kernel, TLS library, proxy/load balancer, DNS, browser/client, HTTP version, Java/Go runtime, and database/provider. Examples such as “200 Tomcat threads”, “2 KB goroutine stacks”, “one to two RTT”, and “millions of virtual threads” are not universal capacity guarantees.

## Discovery pool and source-selection accounting

The working pool contained about fifty-five candidates from IETF HTTP/TLS/TCP/UDP/QUIC RFCs, Linux man-pages, Java NIO, Spring/Go/gRPC documentation, WHATWG realtime standards, and current proxy/runtime manuals. Duplicate RFC PDF/HTML pages, vendor benchmark posts, and generic C10K explainers were collapsed. Thirty-one distinct sources below were selected/inspected; they cover normative protocol semantics, implementation behavior, version caveats, or failure/operations details.

The discovery policy allowed up to 200 candidate sources when useful; this topic stopped at the selected set because additional candidates repeated protocol text or lacked OS/runtime/proxy version and workload scope.

## Local content map

The complete EN and VI files were read. Both contain 3 sections and 12 matching items.

| Section | Exact item IDs and current question | Local role |
| --- | --- | --- |
| Web protocols | `15-network-i-o-models.web-protocols.q1` HTTP/HTTPS/TLS 1.3; `.q2` HTTP/1.1/2/3; `.q3` REST maturity/idempotency/status/versioning | Protocol layers and semantics |
| Realtime & event-driven | `15-network-i-o-models.realtime-event-driven.q1` polling/SSE/WebSocket versus internal events; `.q2` event-driven programming; `.q3` MVC/WebFlux/Vert.x/Go I/O | Delivery and execution model |
| Threading & network programming | `15-network-i-o-models.threading-network-programming.q1` Spring request/thread pools; `.q2` TCP/UDP/blocking/nonblocking/C10K; `.q3` keepalive/pooling; `.q4` gRPC/HTTP2; `.q5` retry/timeout/backoff/breaker; `.q6` end-to-end HTTP lifecycle | Capacity, failure, and operations |

EN/VI item IDs, section counts, and item counts match. The translated sections preserve protocol names and code terms; all revised RTT/default/“usually” qualifiers must be kept at equal strength in both languages.

## What is correct and reusable

- The TLS section correctly distinguishes TLS from HTTP, identifies TLS 1.3’s handshake/record protection, and warns that 0-RTT early data has replay limitations. mTLS, certificate validation, and policy requirements should be tied to the actual deployment/security standard.
- The HTTP comparison correctly highlights persistent HTTP/1.1, HTTP/2 multiplexed streams over TCP, and HTTP/3 over QUIC/UDP. The transport-layer and HTTP-semantic layers are separate, which is a good foundation.
- The realtime section correctly separates client delivery (polling/SSE/WebSocket) from internal event-driven architecture. An internal event bus is not automatically a browser realtime channel.
- The C10K discussion correctly frames blocking-thread-per-connection versus readiness/event-loop design as a resource model, not a magic performance switch.
- The keep-alive/pooling section correctly identifies handshake amortization, socket/file-descriptor limits, idle timeouts, stale connections, and pool exhaustion as one end-to-end problem.
- The retry section correctly puts idempotency and timeouts before retry count and backoff. The HTTP lifecycle is valuable because it makes DNS, proxy, TLS, connection reuse, server queueing, DB, response streaming, and client rendering visible.

## Claims to verify, qualify, or remove

| Local claim/shape | Classification | Evidence/limitation | Proposed treatment |
| --- | --- | --- | --- |
| TLS 1.3 is one RTT and TLS 1.2 is two | Simplified performance claim | Handshake flights, resumption, TCP/QUIC setup, client/server paths, proxies, and 0/1-RTT modes change the observed path | Say “TLS 1.3 can complete a full handshake in fewer flights; measure end-to-end TCP/QUIC+TLS” |
| 0-RTT is faster but replayable | Verified with scope | RFC 8446 requires early data to be replay-safe; the application must restrict methods/effects | Keep and connect to idempotency/anti-replay |
| PCI DSS prohibits TLS below 1.2 | Compliance claim | Policy/version scope must be cited to the exact PCI DSS version and environment; security standards change | Mark version/merchant-scope and do not state as timeless law |
| HTTP/1.1 is one request per connection | Incorrect shorthand | Persistent HTTP/1.1 reuses a connection; normal request/response concurrency is constrained, but pipelining/ordering/connection pools vary | Say “one in-flight response per ordinary persistent connection; clients use multiple connections; pipelining is a separate legacy behavior” |
| HTTP/2 server push is a current browser feature | Stale | HTTP/2 standard defines it, but major browser ecosystem support/deployment has changed | Mark as deprecated/unsupported in many clients; do not recommend without target client evidence |
| HTTP/3 eliminates head-of-line blocking | Incomplete | QUIC removes TCP packet loss HOL across independent streams, but each stream, connection congestion, CPU, and application ordering still matter | Say “reduces cross-stream transport HOL; does not remove all latency/blocking” |
| Richardson Level 3 is the definition of REST | Teaching model | Richardson maturity is an educational model, not the REST/HTTP standard | Keep as a rubric and link to RFC semantics |
| Most APIs stop at Level 2 | Inference | No universal census; adoption varies by domain/tooling | Label as observation/unknown or remove |
| SSE always has a six-connection/domain limit and needs sticky sessions | Browser/deployment-specific | HTTP/1.1 browser limits and HTTP/2 multiplexing/provider settings differ; pub/sub/shared state can avoid sticky sessions | Scope to named browser/HTTP version and show alternatives |
| Virtual threads make MVC as scalable as event loops | Inference | VT reduces per-blocked-thread OS cost but does not remove DB/CPU/socket limits; event-loop and VT have different failure/backpressure models | Compare measured resource ceilings |
| Vert.x/Go goroutines have ~2 KB stacks; VT can create millions | Implementation/marketing shorthand | Stack growth/representation/runtime version and workload differ; count is not capacity | Remove fixed numbers; report task/memory/socket/CPU limits |
| Spring MVC has a default pool around 200 threads | Provider/default-specific | Tomcat/Jetty/Undertow and Boot versions/configuration differ; virtual threads change model | Use “configured executor/connector limits” and inspect target runtime |
| gRPC/HTTP2 is efficient by definition | Recommendation | Protobuf, multiplexing, HPACK, connection reuse can help; small messages, proxy, TLS, CPU, retries, and streams can reverse result | Keep as hypothesis with benchmark and flow-control caveat |
| Retry only idempotent requests | Good safety rule but incomplete | Some non-idempotent APIs have explicit idempotency keys; some idempotent methods can still be unsafe due business implementation | Say “retry only with a proven idempotent effect/contract” |
| Circuit breaker protects the system | Conditional | It protects one call boundary if correctly scoped; it can hide recovery, fail open, or amplify half-open probes | Define state/metrics and combine with timeout/bulkhead/rate limit |

## Workload, invariant, and capacity model

### End-to-end workload card

| Layer | Variables |
| --- | --- |
| Client/DNS | resolver/cache TTL, IPv4/IPv6, connection reuse, browser/runtime, proxy path |
| Transport | TCP/QUIC handshake/loss/congestion, local/remote port and FD limits, MTU/path changes |
| Security | TLS version/resumption/0-RTT, cert chain, mTLS, crypto CPU, session cache |
| HTTP | version, multiplexing, header/payload size, compression, streaming, idle/read/write limits |
| Server | accept backlog, connector/event loop/worker, queue, CPU, blocking calls, graceful shutdown |
| Dependencies | DB/HTTP fan-out, pool size, downstream deadlines, retry/hedge budget, provider quotas |
| Response | buffering/rendering, client cancellation, cacheability, partial stream/reconnect semantics |
| SLO | p50/p99/p999 latency, throughput, timeout/error, open connections, bytes, CPU/RSS |

The invariant is an end-to-end budget: no layer may silently reset a deadline or retry an unknown side effect; each accepted command has a known idempotency/duplicate policy; each connection/stream/task is bounded and cancellable; response ordering/stream semantics are preserved; and overload rejects or sheds work before memory/FD/DB exhaustion.

### Failure/crash windows

| Window | Failure | Crash/overload effect | Recovery |
| --- | --- | --- | --- |
| DNS lookup | stale/negative cache, resolver outage, IPv6 path failure | request waits or connects to wrong/unavailable address | bounded resolver timeout, cache metrics, Happy-Eyeballs/client policy, retry budget |
| TCP/QUIC connect | SYN/handshake loss, ephemeral-port/FD exhaustion | connection timeout, connect storm | pooling, jitter, capacity limits, port/FD metrics |
| TLS | certificate/ALPN/resumption/crypto failure | handshake latency or immediate reject | cert/ALPN telemetry, rotation test, no unsafe fallback |
| HTTP proxy/LB | idle timeout, header/body limit, retry/hedge, protocol downgrade | disconnect after server effect/partial stream | propagate deadline, idempotency, proxy-specific config/test |
| Server admission | accept/worker/event-loop/queue saturation | tail latency, 5xx/timeout, memory growth | bounded queue, overload response, load shedding, autoscaling signal |
| Blocking dependency | worker/event-loop/thread/VT pinned | unrelated requests stall or queue | isolate blocking work, bulkhead, DB/provider timeout |
| Response write | client disconnect/backpressure | server continues work or buffers | cancellation propagation and bounded response buffer |
| Retry/breaker | synchronized retries/half-open probes | retry storm or outage masking | exponential backoff+jitter, attempt budget, breaker state, retry metrics |

## Coverage matrix

| Area | Evidence coverage | Local status/gap | Proposed conclusion |
| --- | --- | --- | --- |
| Definitions | HTTP/TLS/TCP/QUIC RFCs, Java/Linux APIs | Strong | Keep layer diagram with protocol scope |
| Invariants | idempotency/deadline/connection/task bounds | Good but distributed effects repeated elsewhere | Link to 17/09; keep network boundary |
| Workload | protocol/runtime docs | Numeric defaults too prominent | Replace with workload card and formulas |
| Failure/crash windows | DNS/connect/TLS/LB/server/dependency/client | Strong narrative, add per-layer timeout | Preserve the table |
| Retries/timeouts | RFC/gRPC and application design | Need budget propagation/unknown outcome | Add deadline waterfall and safe-retry matrix |
| Operations/recovery | pool/FD/queue/GC/proxy signals | Provider-specific operations missing | Add ownership by layer and rollout tests |
| Security/privacy | TLS/0-RTT/cert/headers/cookies | PCI claim scope; realtime auth needs detail | Cite exact standard/version and avoid secret logging |
| Testing | load/fault/HTTP version/provider | Mostly conceptual | Add DNS/TLS/idle/LB/half-close/partial-write tests |
| Domain trade-offs | MVC/WebFlux/VT/Vert.x/Go | Good comparison but fixed numbers | Make each a measured hypothesis |

## Best-practice comparison

| Need | Usually useful model | Limit |
| --- | --- | --- |
| Short request/response with broad clients | HTTP semantics + REST/JSON/OpenAPI | API correctness/cache/idempotency still application work |
| Internal typed RPC | gRPC/Protobuf with explicit deadlines/status/retry policy | browser/proxy/tooling and stream flow-control constraints |
| Many slow non-blocking streams | event loop/reactive + bounded demand | blocking libraries require isolation; debugging complexity |
| Blocking I/O with simple code | platform/virtual threads + bounded downstream resources | task count does not create DB/provider capacity |
| Browser one-way updates | SSE where reconnect/ordered text events fit | unidirectional; HTTP/browser/proxy limits |
| Bidirectional low-latency session | WebSocket or protocol-specific stream | auth, reconnect, backpressure, connection budget and shared state |
| Resilient call | deadline → bounded retry only when safe → jitter/bulkhead → breaker/load shed | no universal timeout/retry values; unknown outcome remains |
| Connection reuse | per-client/provider pool with idle/lifetime/validation aligned to infrastructure | too-large pools overload upstream; stale connections need tests |

## Contradiction/limits table

| Apparent conflict | Resolution |
| --- | --- |
| HTTP/2 multiplexes versus one TCP connection is always best | Multiplexing reduces connection overhead but shares congestion/connection fate; connection count, stream limits, CPU and proxy behavior remain workload-specific. |
| QUIC removes HOL versus QUIC is UDP and unreliable | QUIC provides reliable ordered streams over UDP; it removes TCP-level cross-stream HOL, not stream ordering, congestion, or application-level dependency. |
| Non-blocking I/O uses fewer threads versus more threads are simpler | Readiness can reduce thread-per-idle-connection cost; it adds state/backpressure/cancellation complexity. A VT/blocking model can be simpler if dependencies are blocking and bounded. |
| Keep-alive improves latency versus idle connections fail | Reuse amortizes handshakes, but NAT/LB/server idle/lifetime policies require validation and reconnect handling. |
| Retry improves availability versus retry causes outage | A bounded, jittered, idempotent retry can help transient faults; synchronized/unbounded retries amplify overload. |
| SSE is stateless versus reconnect loses events | The connection can be stateless at the server only if events are replayable/shared or loss is acceptable; otherwise use event IDs/resume/registry. |

## Negative evidence and anti-patterns

- Do not state HTTP/1.1 as “one connection per request”; persistent connections are a core feature, while in-flight concurrency and client pool behavior are separate.
- Do not claim HTTP/3 removes all HOL or that UDP means the application is unreliable; explain QUIC streams/congestion and the target implementation.
- Do not use “C10K solved” as proof that a service can handle ten thousand active sockets; payload, TLS, event rate, memory, CPU, FD limits and downstream work dominate.
- Do not put blocking JDBC/file/DNS/provider calls on an event loop, and do not assume virtual threads make unbounded downstream calls safe.
- Do not retry on a timeout just because no response arrived; the server may have committed the effect.
- Do not use one global timeout for DNS, connect, TLS, request headers, body, DB, response, and client rendering; derive a deadline budget and reserve margin.
- Do not enable TLS 1.3 0-RTT for unsafe effects without replay analysis/idempotency.
- Do not use `SO_KEEPALIVE`, HTTP keep-alive, pool validation, and application health checks as if they were one signal; they operate at different layers.
- Do not assume an SSE/WebSocket session survives a rolling deploy or load-balancer change; specify reconnect, resume, heartbeat, and state ownership.
- Do not publish “200 threads”, “2 KB stacks”, “one RTT”, or “millions of tasks” as capacity numbers without runtime/platform evidence.

## Duplicate/canonical ownership

| Overlap | Canonical role |
| --- | --- |
| REST resource/action/idempotency/error/version contract | `17-rest-api-design`; this topic owns transport consequences and timeout/retry boundaries. |
| REST/gRPC/WebFlux selection | `04-rest-grpc-webflux`; this topic owns lower-level HTTP/TCP/TLS/I/O mechanics. |
| Java VT/JMM/GC | `01-java-core-jvm`; this topic only applies runtime models to network servers. |
| Retry storm/circuit breaker/microservice resilience | `25-microservice`/`20-observability-sre`; this topic owns network-layer failure ordering and budgets. |
| Queue/event delivery | `08-message-queue`; this topic distinguishes internal event-driven code from client realtime delivery. |
| DB pool/transaction resource | `03-spring-boot-deep-build`/`05-db-core-index-lock`; network calls must not smuggle in a second DB tutorial. |

## Operational, security, observability, and testing notes

Signals should be partitioned by layer: DNS latency/errors/cache, connect/TCP retransmits/QUIC loss, TLS handshake/ALPN/cert expiry, HTTP protocol/status/headers/bytes, connection/stream/FD counts, server queue/event-loop/worker utilization, pool acquisition and DB time, downstream deadline/retry/breaker state, client cancellation, and SSE/WebSocket reconnect/missed-event age. Trace a single deadline and attempt ID through all layers; record whether an effect was attempted/committed, not just whether a response arrived.

Security requires TLS certificate/hostname validation, protocol downgrade policy, safe 0-RTT methods, mTLS identity mapping, proxy trust/forwarded-header handling, request smuggling/header limits, SSRF/DNS rebinding controls for outbound calls, WebSocket/SSE origin/token/reconnect handling, and redacted packet/trace payloads. PCI or sector-specific claims must cite the exact current version and scope.

Testing should include DNS/cache failure, IPv4/IPv6, TLS rotation/ALPN/mTLS/0-RTT rejection, TCP loss/reconnect, QUIC fallback where supported, HTTP/1.1 persistent/partial writes, HTTP/2 stream reset/multiplexing, HTTP/3 proxy path, idle/lifetime mismatches, FD/ephemeral-port exhaustion, slow clients, event-loop blocking, provider timeout after commit, retry storm, breaker half-open, graceful drain, and realtime reconnect/resume. Run the same tests through the production proxy/LB path.

## Integration record (Batch C scope)

- [x] Added the layered large-body transport/memory contract as `15-network-i-o-models.web-protocols.q4`.
- [x] Added the deadline, replayability, ambiguous-outcome, and retry-ownership contract as `threading-network-programming.q7`.
- [x] Mirrored the additions in EN and VI and cross-linked upload/job ownership to Topic 17.
- [ ] Broader non-Batch-C cleanup below remains a follow-up audit.

### Deferred broader audit items

- [ ] Correct HTTP/1.1 persistent-connection wording and qualify HTTP/2 server push/browser support.
- [ ] Rewrite HTTP/3 as “QUIC reduces cross-stream transport HOL” with connection-level congestion and stream-level limits.
- [ ] Scope TLS RTT/0-RTT examples to full/resumed handshakes and TCP versus QUIC; retain replay warning.
- [ ] Remove fixed MVC/VT/Go thread/stack/task numbers; replace with provider/runtime defaults plus measurement fields.
- [ ] Make SSE connection-limit/sticky-session guidance browser/HTTP-version/provider-specific and add resume/shared-pubsub alternatives.
- [ ] Add a layered deadline waterfall and safe-retry matrix, including unknown outcome and idempotency-key handoff to topic 17.
- [ ] Add keep-alive/pool failure table: client, LB, server, NAT, DB/provider timeout and validation ownership.
- [ ] Keep C10K as a historical/resource-model explanation, not a capacity claim.
- [ ] Update gRPC efficiency wording to use payload/serialization/flow-control benchmark scope; link to topic 04.
- [ ] Mirror all qualifiers in VI; no public data changes are applied.

## EN/VI and cross-reference plan

The 12 exact IDs and three-section structure are aligned. Preserve RFC names, header names, status codes, socket options, Java/Go class names, and formula units. Translate “may”, “can”, “typically”, “target”, and “not a guarantee” with equal strength. Link to topics `01-java-core-jvm`, `03-spring-boot-deep-build`, `04-rest-grpc-webflux`, `08-message-queue`, `17-rest-api-design`, `20-observability-sre`, and `25-microservice`.

## Explicit unknowns and falsifiers

- What OS/kernel, proxy/LB, DNS, browser/client, and HTTP versions are deployed? A protocol/timeout recommendation is falsified by a path-specific limit or observed tail latency.
- What are the real request payload/connection/stream distributions and SLOs? Any “HTTP2/gRPC/QUIC is faster” claim remains unresolved until a matched benchmark.
- Does the service perform blocking calls on event loops or unbounded work on VT/goroutine/task executors? A thread-model recommendation is falsified by event-loop stalls, carrier starvation, queue growth, or downstream saturation.
- What is the provider/LB idle/lifetime/timeout contract? Pool/keepalive tuning is falsified by stale-connection failures or reconnect storms under fault tests.
- Can the server distinguish accepted/committed/unknown effects after a client timeout? If not, retries need idempotency or reconciliation; a safe-retry claim is falsified by duplicate side effects.
- Are realtime events replayable/shared across replicas? If not, a stateless SSE/WebSocket recommendation is false for missed-event guarantees.

Confidence: high for RFC/API/Linux semantics; medium for framework/runtime defaults; low for exact RTT, capacity, and protocol-performance claims without the production path and workload.

## Sources

| # | Source (title — organization) | Tier / type | Version or revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [RFC 8446: TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446.html) — IETF/RFC Editor | A / standard | August 2018 | 2026-08-23 | handshake/early-data/0-RTT replay scope and TLS record security |
| 2 | [RFC 9001: Using TLS to secure QUIC](https://www.rfc-editor.org/rfc/rfc9001.html) — IETF/RFC Editor | A / standard | May 2021 | 2026-08-23 | QUIC/TLS handshake integration and transport security |
| 3 | [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | common HTTP semantics, methods, status, cache/resource concepts |
| 4 | [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | HTTP cache freshness/validation boundary |
| 5 | [RFC 9112: HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | HTTP/1.1 framing, persistence and connection semantics |
| 6 | [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | frames, streams, multiplexing, flow control and push scope |
| 7 | [RFC 9114: HTTP/3](https://www.rfc-editor.org/rfc/rfc9114.html) — IETF/RFC Editor | A / standard | June 2022 | 2026-08-23 | HTTP/3 mapping to QUIC and stream behavior |
| 8 | [RFC 9000: QUIC](https://www.rfc-editor.org/rfc/rfc9000.html) — IETF/RFC Editor | A / standard | May 2021 | 2026-08-23 | reliable ordered streams over UDP, connection/stream flow and 0-RTT relation |
| 9 | [RFC 9002: QUIC loss detection and congestion control](https://www.rfc-editor.org/rfc/rfc9002.html) — IETF/RFC Editor | A / standard | May 2021 | 2026-08-23 | QUIC congestion/loss limits; why HTTP/3 does not eliminate all latency |
| 10 | [RFC 9293: Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc9293.html) — IETF/RFC Editor | A / standard | August 2022 | 2026-08-23 | TCP reliable ordered byte-stream model and retransmission scope |
| 11 | [RFC 768: User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768.html) — IETF/RFC Editor | A / standard | August 1980 | 2026-08-23 | UDP datagram/no reliability/order guarantee; QUIC builds above it |
| 12 | [RFC 6455: WebSocket](https://www.rfc-editor.org/rfc/rfc6455.html) — IETF/RFC Editor | A / standard | December 2011 | 2026-08-23 | WebSocket upgrade/framing/full-duplex boundary |
| 13 | [Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — WHATWG | A / living standard | Reviewed living standard | 2026-08-23 | EventSource/reconnect/Last-Event-ID behavior |
| 14 | [Java NIO channels package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/package-summary.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | selectable/non-blocking channels and readiness is a hint, not guarantee |
| 15 | [Selector API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/Selector.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | selector multiplexing/selection lifecycle |
| 16 | [SocketChannel API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SocketChannel.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | selectable stream socket behavior and blocking/non-blocking mode |
| 17 | [Linux socket(7)](https://man7.org/linux/man-pages/man7/socket.7.html) — Linux man-pages | A / OS implementation manual | man-pages 6.18 context | 2026-08-23 | sockets, non-blocking `O_NONBLOCK`, options and FD boundary |
| 18 | [Linux epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html) — Linux man-pages | A / OS implementation manual | man-pages current | 2026-08-23 | readiness, level/edge-triggered semantics and EAGAIN drain requirement |
| 19 | [Linux tcp(7)](https://man7.org/linux/man-pages/man7/tcp.7.html) — Linux man-pages | A / OS implementation manual | man-pages 6.18 context | 2026-08-23 | TCP socket options, timers and Linux-specific behavior |
| 20 | [Linux udp(7)](https://man7.org/linux/man-pages/man7/udp.7.html) — Linux man-pages | A / OS implementation manual | current man-pages | 2026-08-23 | UDP socket/queue/error behavior; implementation scope |
| 21 | [Spring WebFlux overview](https://docs.spring.io/spring-framework/reference/web/webflux/new-framework.html) — Spring | A / official reference | Framework current | 2026-08-23 | event-loop/non-blocking/backpressure and MVC/WebFlux fit |
| 22 | [Spring Boot servlet web server](https://docs.spring.io/spring-boot/reference/web/servlet.html) — Spring | A / official reference | Boot current | 2026-08-23 | Boot server/container configuration boundary; no universal 200-thread claim |
| 23 | [gRPC core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/) — gRPC project | A / official guide | Current guide | 2026-08-23 | RPC streaming/deadline model over HTTP/2 ecosystem |
| 24 | [gRPC deadlines](https://grpc.io/docs/guides/deadlines/) — gRPC project | A / official guide | Current guide | 2026-08-23 | no default deadline, propagation and cancellation |
| 25 | [gRPC flow control](https://grpc.io/docs/guides/flow-control/) — gRPC project | A / official guide | Current guide | 2026-08-23 | stream demand, buffering and write/transport distinction |
| 26 | [gRPC keepalive](https://grpc.io/docs/guides/keepalive/) — gRPC project | A / official guide | Current guide | 2026-08-23 | keepalive/ping policy and misuse risk |
| 27 | [Go `net/http` package](https://pkg.go.dev/net/http) — Go project | A / API docs | Go 1.25 package docs | 2026-08-23 | HTTP server/client and transport/pooling configuration scope |
| 28 | [Go `net` package](https://pkg.go.dev/net) — Go project | A / API docs | Go 1.25 package docs | 2026-08-23 | TCP/UDP/listener/timeout APIs; no universal goroutine capacity |
| 29 | [Go diagnostics](https://go.dev/doc/diagnostics) — Go project | A / official guide | Current guide | 2026-08-23 | pprof/trace/runtime diagnostic approach |
| 30 | [Go 1.25 release notes](https://go.dev/doc/go1.25) — Go project | A / release notes | Go 1.25 | 2026-08-23 | runtime/container-aware `GOMAXPROCS` version scope |
| 31 | [HTTP/3 implementation status](https://www.rfc-editor.org/info/rfc9114/) — RFC Editor/IETF | A / standard info | RFC 9114 publication status | 2026-08-23 | standard versus deployed-client/provider support distinction |
