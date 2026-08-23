# Research - API gateway, identity, and the edge

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `27-api-gateway-identity-edge`

EN file: `public/data/topics/27-api-gateway-identity-edge.json`

VI file: `public/data/topics/27-api-gateway-identity-edge.vi.json`

## Scope and non-goals

This dossier owns the edge-placement decision, gateway routing and filter concerns, identity verification at the edge, policy-decision boundaries, gateway introduction, and synchronous/asynchronous internal-call trade-offs in the assigned topic. It does not own the complete OAuth/OIDC protocol lesson (topic 13), rate-limiter algorithms (topic 10), generic observability/SLO design (topic 20), or distributed lock semantics (topic 28). Those units should be canonical links, not copied explanations.

The research pool covered standards, Gateway API, Spring Cloud Gateway, Envoy, OPA, Cedar, SPIFFE/SPIRE, OpenTelemetry, and HTTP semantics. The final ledger selects 33 inspected sources. Search-result pages, duplicate framework aliases, unversioned blog summaries, and configuration snippets without a corresponding official contract were excluded. The discovery pool was broad but was not padded to a fixed count; each selected source adds a distinct protocol, implementation, version, identity, authorization, failure, or operations claim.

## Local content map

Both JSON files were read in full. Each contains 6 sections and 18 items; the `id` sets are identical. EN size is 36,245 bytes and VI size is 36,593 bytes. The local draft is strong as an interview-oriented progression, but some framework versions, capacity multipliers, and “must” statements need explicit scope labels.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| The edge in four sizes | `27-api-gateway-identity-edge.the-edge-in-four-sizes.q1` through `.q3` | Daily-to-peak arithmetic, capability thresholds, and signals that a fleet/cell boundary has been crossed. |
| Gateway configuration that matters | `27-api-gateway-identity-edge.gateway-configuration-that-matters.q1` through `.q4` | Spring Cloud Gateway routing, filters, timeouts, retry/circuit behaviour, and gateway metrics. |
| Identity at the edge | `27-api-gateway-identity-edge.identity-at-the-edge.q1` through `.q4` | JWT, opaque tokens, mTLS/workload identity, key rotation, and trusted identity propagation. |
| Authorization without a bottleneck | `27-api-gateway-identity-edge.authorization-without-a-bottleneck.q1` through `.q2` | Local RBAC/ABAC, OPA/Cedar-style PDPs, decision caching, and policy rollout. |
| Introducing a gateway into a running system | `27-api-gateway-identity-edge.introducing-a-gateway-into-a-running-system.q1` through `.q3` | Shadowing, strangler migration, observability, route ownership, and rollback. |
| Internal calls: sync, async, or neither | `27-api-gateway-identity-edge.internal-calls-sync-async-or-neither.q1` through `.q2` | User-visible synchronous work versus durable asynchronous workflow boundaries. |

The complete item IDs are:

```text
27-api-gateway-identity-edge.the-edge-in-four-sizes.q1
27-api-gateway-identity-edge.the-edge-in-four-sizes.q2
27-api-gateway-identity-edge.the-edge-in-four-sizes.q3
27-api-gateway-identity-edge.gateway-configuration-that-matters.q1
27-api-gateway-identity-edge.gateway-configuration-that-matters.q2
27-api-gateway-identity-edge.gateway-configuration-that-matters.q3
27-api-gateway-identity-edge.gateway-configuration-that-matters.q4
27-api-gateway-identity-edge.identity-at-the-edge.q1
27-api-gateway-identity-edge.identity-at-the-edge.q2
27-api-gateway-identity-edge.identity-at-the-edge.q3
27-api-gateway-identity-edge.identity-at-the-edge.q4
27-api-gateway-identity-edge.authorization-without-a-bottleneck.q1
27-api-gateway-identity-edge.authorization-without-a-bottleneck.q2
27-api-gateway-identity-edge.introducing-a-gateway-into-a-running-system.q1
27-api-gateway-identity-edge.introducing-a-gateway-into-a-running-system.q2
27-api-gateway-identity-edge.introducing-a-gateway-into-a-running-system.q3
27-api-gateway-identity-edge.internal-calls-sync-async-or-neither.q1
27-api-gateway-identity-edge.internal-calls-sync-async-or-neither.q2
```

## What is correct and reusable

- The four edge sizes are a teaching taxonomy, not a product taxonomy. The useful move is to connect traffic shape, protected resource, blast radius, and operating model rather than to prescribe a gateway at a particular requests-per-day number.
- An extra hop consumes more than CPU: it adds queueing, a connection pool, TLS state, health checks, timeout budget, retry opportunity, tracing, and a failure boundary. This is a sound design heuristic when measured with production-shaped traffic.
- Route matching and filters are separate concerns. The effective order must be tested for the selected gateway implementation and release; a YAML order is not by itself a portable contract.
- Authentication at the edge can reject obviously invalid traffic and reduce downstream work, but service-level authentication and object-level authorization remain necessary at a separate trust boundary.
- JWT verification is local after the required keys are available; opaque-token introspection centralizes revocation/freshness decisions but introduces a dependency and latency budget. Neither is universally better.
- mTLS/workload identity proves a workload-level relationship. It does not by itself answer which end user may access which object. SPIFFE/SPIRE and application authorization solve different layers.
- The local draft correctly treats gateway failure behaviour, route-level timeouts, retry limits, circuit breaking, and metrics as one control loop. A retry or circuit setting without a total deadline and downstream budget is incomplete.
- A gateway migration should begin with route ownership, shadow/observation, identity and error-contract compatibility, then a reversible traffic cutover. A gateway is not safe merely because it is in front of the service.
- User-facing commands that require an immediate decision can remain synchronous; long-running or independently retryable work should expose a durable operation/command boundary rather than holding a gateway request open.

## Claims to verify or qualify

| Local claim or pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| `86,400` seconds per day and the `20x` peak heuristic | Fact plus heuristic | The arithmetic is exact. A 20x peak is only a scenario assumption. Keep the multiplier beside the measured arrival distribution and include burst duration. | High |
| `10k`, `100k`, `1M`, and `100M` requests/day imply four gateway capability tiers | Recommendation | Useful for interview framing, not a sizing law. A low-volume payment or identity route may need stronger isolation than a high-volume public read. | High that it is non-universal |
| A gateway adds a measurable fixed latency cost | Inference | There is processing, queueing, connection, TLS, and observability work, but the magnitude depends on implementation, reuse, payload, and saturation. Replace fixed claims with a p50/p95/p99 measurement plan. | High |
| Spring Cloud Gateway route predicates run before filters | Framework model | The route must match before its filter chain applies, but global/default/route filter ordering and pre/post execution are implementation/version details. Test the effective chain on the pinned release. | High |
| Spring Cloud Gateway 5.0.2 starter names and Java LTS statement | Version-sensitive | The local text mentions 5.0.2 while current reference pages reviewed expose 5.0.3 pages. Pin a compatible Spring Boot/Cloud train and Java runtime; do not teach a moving version as timeless. | High |
| Per-route timeout can override a global timeout | Provider fact with scope | Spring Cloud Gateway 5.0.3 documents global connect/response settings and per-route metadata, including a negative response timeout disabling the global value. Verify the exact server flavor and release. | High |
| Circuit breaking prevents downstream failure | Over-absolute | A circuit breaker limits selected calls and routes failures according to its policy; it cannot repair a bad dependency, make a request idempotent, or cover calls bypassing the gateway. | High |
| Retry improves availability | Conditional recommendation | Retries can amplify overload. Retry only operations with a safe semantic contract, bounded attempts, jitter, a total deadline, and a retry budget. | High |
| JWT validation at the gateway is sufficient | Incorrect absolute | The gateway can validate signature and registered claims, but the service must enforce its own trust boundary and resource/object authorization. Key cache and issuer/audience configuration are part of the correctness contract. | High |
| Opaque introspection gives stronger revocation | Conditional | It can obtain a fresher central decision, at the cost of dependency availability, latency, rate limits, and cache semantics. Provider introspection guarantees must be checked. | High |
| Forwarding `X-User-Id` or similar headers is safe after gateway auth | Unsafe absolute | The gateway must strip client-supplied identity headers, write trusted values, and ensure every alternate route has the same rule. Prefer a signed/verified internal identity contract where the threat model requires it. | High |
| OPA or Cedar makes authorization a bottleneck | Unresolved generalization | A remote PDP can become a bottleneck; local bundles, decision caching, batching, and bounded policy complexity can change the shape. Measure policy latency and stale-decision risk. | High that the blanket claim is unsupported |
| SPIFFE mTLS replaces end-user authorization | Incorrect | Workload identity and user/business authorization are separate facts. Combine workload authentication with application claims and object-level policy. | High |
| Gateway API makes all gateway implementations portable | Incorrect absolute | Gateway API standardizes Kubernetes resources and conformance profiles, but implementations, versions, extensions, policy attachment, and provider-specific features differ. | High |
| A 504 means the backend did not execute | Incorrect | RFC 9110 describes a gateway timeout when a timely response was not received; the upstream may have committed work before the response was lost. Use idempotency/status lookup for ambiguous mutations. | High |
| Asynchronous internal work is always more scalable | Conditional | It removes the user request from the long work, but introduces durable intent, duplicate delivery, ordering, status, compensation, and recovery requirements. | High |

## Workload, invariants, and failure model

### Workload model

Record at least the following before selecting a placement or policy:

| Dimension | Values to measure or declare | Why it changes the design |
| --- | --- | --- |
| Arrival | Average and peak RPS, burst duration, open-loop arrival, tenant/route skew | Averages hide queueing and hot tenants; closed-loop tests can hide overload. |
| Request shape | Payload size, compression, streaming, upload/download ratio, HTTP/1.1 versus HTTP/2/3 | Buffers, connection counts, memory, and timeout interpretation change. |
| Connections | New TLS handshakes, keep-alive reuse, idle timeout, upstream pool size, connection acquisition p99 | A gateway can saturate sockets or pools while CPU is low. |
| Identity | JWT/opaque/mTLS mix, token size, issuer/audience cardinality, JWKS rotation, introspection hit rate | Verification CPU, cache misses, dependency calls, and trust boundaries differ. |
| Authorization | Local rules, remote PDP calls, bundle size, decision-cache TTL, policy churn, deny/allow ratio | Policy latency and stale decisions can dominate the request budget. |
| Failure | Dependency error rate, slow responses, resets, partial regions, IdP/PDP/JWKS unavailability | Retry and circuit behavior can turn a partial failure into a fleet outage. |
| Traffic topology | Public edge, internal gateway, service mesh, cross-region, cross-namespace | Trust and route ownership differ at each hop; one policy cannot be assumed everywhere. |
| User contract | Deadline, synchronous result, accepted/processing response, polling/webhook, cancellation | Determines whether the gateway owns completion or only durable acceptance. |

### Invariants

1. A request must not reach a protected service without an authenticated principal or an explicitly documented anonymous route.
2. A client cannot choose or overwrite the principal, tenant, issuer, route owner, or authorization result through an untrusted header.
3. Every hop has a bounded timeout that fits inside the end-to-end deadline; retries consume the same budget rather than extending it invisibly.
4. A gateway policy decision is tied to the verified token/workload identity, request route, resource, and policy version. A cached decision has an explicit staleness bound.
5. A mutation remains safe under gateway timeout, client retry, duplicate delivery, or response loss. The gateway is not the business idempotency store.
6. A route change is observable, attributable to an owner, and reversible without leaving two incompatible identity or error contracts active indefinitely.
7. Telemetry carries correlation and policy/version metadata without putting tokens, raw authorization headers, or sensitive payloads into labels or logs.

### Crash and failure windows

| Window | What can happen | Required handling |
| --- | --- | --- |
| Gateway accepts, upstream not reached | Process crash or queue rejection | Return a clear retryable error or preserve a durable command; do not pretend the mutation happened. |
| Upstream reached, response lost | Gateway/client sees timeout or 504 after a commit | Require idempotency/status lookup for mutations; do not blindly replay. |
| Gateway retries after partial upstream work | Second attempt overlaps the first | Safe operation semantics, idempotency key, retry budget, and downstream deduplication. |
| JWT accepted, service sees a different policy | Policy/config rollout races with in-flight requests | Version policies, log decision version, and define rollout overlap/revocation behavior. |
| JWKS rotation during cache miss | Key is unknown or stale | Refresh with bounded single-flight behavior, keep old keys only for documented overlap, and fail closed for unverifiable tokens. |
| Introspection/PDP unavailable | Auth or authorization dependency cannot answer | Choose per route: bounded fail-closed, cached decision with explicit TTL, or documented degraded anonymous/read-only mode. Alert on the mode. |
| Client-supplied identity header reaches service | Header injection or alternate route bypass | Strip at every trust boundary, overwrite from verified identity, and test direct/private ingress paths. |
| Gateway config is partially rolled out | Different replicas route or authorize differently | Version/config hash metrics, staged rollout, compatibility window, and rapid rollback. |
| Cross-namespace route or policy attachment | Resource is attached outside expected ownership boundary | Explicit namespace/reference grants, admission policy, and audit of route/policy ownership. |
| Async command accepted, worker dies | User sees accepted but work is not progressing | Durable queue/outbox, consumer idempotency, status model, retry/DLQ and operator replay. |

## Comparison table

| Choice | Primary guarantee | Main failure/crash window | Strength | Limit / use boundary |
| --- | --- | --- | --- | --- |
| CDN/WAF edge | Cache/edge filtering and coarse abuse control | Stale policy/cache or provider path unavailable | Removes public load before origin | Not a substitute for business authorization or private service routing. |
| L4 load balancer | Connection/packet distribution | Healthy transport but unhealthy application | Low protocol overhead and simple blast radius | Cannot inspect application identity or object policy. |
| L7 reverse proxy/gateway | Route, HTTP policy, auth integration, timeout and telemetry | Request may be sent while response is lost; shared pools can fail together | Centralized edge contract and migration point | Becomes a critical shared dependency if unbounded in scope. |
| Service mesh waypoint/sidecar | Workload-to-workload transport policy and telemetry | Identity/sidecar/control-plane outage or bypass | Localizes service identity and mTLS | Does not automatically solve user authorization or business workflow. |
| JWT at gateway plus service validation | Offline signature/claims verification | Key rotation/cache gap, clock/skew and issuer/audience misconfiguration | Low per-request dependency latency after warm cache | Revocation/freshness is not instantaneous; claims are not object authorization. |
| Opaque token introspection | Central validity/revocation decision | IdP/introspection outage, latency, rate limit, stale cache | Fresher central control | Adds a synchronous dependency; cache policy changes security semantics. |
| mTLS/SPIFFE workload identity | Authenticated workload identity and trust domain | Credential rotation, trust-domain mismatch, stale workload registration | Strong service-to-service identity | Not end-user permission or domain authorization. |
| Local RBAC/ABAC | Bounded, local authorization decision | Stale policy/config rollout | Predictable latency and smaller blast radius | Policy distribution, revocation and consistency must be designed. |
| Remote PDP (OPA/Cedar-style) | Central policy evaluation or decision service | PDP latency/outage and policy bundle/version mismatch | Shared policy language, audit, separation of duties | Needs caching/bundles, quotas, versioning and a failure mode. |
| Synchronous call | Immediate response and validation | Held connections, timeout, ambiguous outcome | Good for short, user-visible decisions | Coupled latency and availability across dependencies. |
| Durable async command | Durable intent and independently retryable work | Duplicate/out-of-order work, status lag, poison messages | Bounded request latency and recovery | Requires idempotency, status, ordering/compensation and operations. |

## Coverage matrix

| Area | Evidence inspected | Current local coverage | Proposed content treatment |
| --- | --- | --- | --- |
| Definitions | RFC 9110/9457, Gateway API, Envoy/Spring docs | Gateway, edge, filter, identity and async terms are introduced | Keep a short glossary; distinguish reverse proxy, gateway, mesh, PDP, issuer, audience, principal, and workload identity. |
| Invariants | RFC 9700, RFC 9068, OIDC, SPIFFE, Envoy auth filters | Trust boundary and identity header warnings exist | Add an explicit seven-item invariant box and mark business authorization as service-owned. |
| Workload | Gateway/Spring/Envoy timeout and circuit docs; local tier arithmetic | Peak heuristics and gateway pools are discussed | Replace fixed tier implications with an assumption and measurement table. |
| Failure/crash windows | RFC 9110, Envoy transient failures/routing, Spring timeout/CB docs | Retry, timeout, circuit, rollout and 504 concerns are present | Add the window table; explicitly cover response loss after mutation and stale key/policy caches. |
| Retries/timeouts | Spring timeout/CB, Envoy routing/transient failures, AWS/SRE material from linked topics | Local draft discusses retries/timeouts | Require total deadline, retry safety, jitter/budget, and per-hop accounting. |
| Operations/recovery | Spring Actuator, Gateway API ownership/TLS/namespace docs, SPIFFE/SPIRE | Metrics, migration and rollout are discussed | Add config version/owner, JWKS/PDP health, route rollback, and degraded-mode runbooks. |
| Security/privacy | OAuth/OIDC RFCs, Envoy JWT/ext_authz/TLS, OPA/Cedar, SPIFFE, OTel | JWT, mTLS and trusted headers are covered | Add token/header/log redaction, key rotation, trust-domain, cross-namespace and direct-ingress tests. |
| Testing | Official implementation docs and failure model | Migration and load test intent exists | Add filter-order, route-bypass, key rotation, policy cache, timeout/retry, ambiguous mutation, and shadow-parity tests. |
| Domain trade-offs | Provider docs and local examples | Payment/read and async examples exist | Label low-volume/high-risk versus high-volume/low-risk examples as recommendations, not universal domain facts. |

## Contradictions and limits

| Competing guarantee or advice | Evidence boundary | Teaching implication |
| --- | --- | --- |
| Central introspection freshness versus local availability | Opaque introspection can make a central validity decision; JWT is locally verifiable after key distribution. Neither source promises zero-staleness and zero-dependency failure. | Choose token mode by revocation need, latency budget, IdP availability, cache policy, and threat model. |
| Gateway rejection versus service defense | Envoy/Spring filters can reject at the edge, while identity/authorization standards do not make the gateway the only trust boundary. | Validate again at the service and enforce object-level policy there. |
| Retry availability versus overload safety | Envoy documents retry conditions/budgets and transient failure behavior; SRE/AWS guidance treats retries as a potential amplifier. | A retry policy must state operation safety, total deadline, max attempts, jitter, and budget. |
| Gateway API portability versus implementation capability | Gateway API defines common resources/conformance, while Spring and Envoy expose provider/version-specific filters and policies. | Teach the portable route model separately from implementation extensions and pin the release. |
| mTLS workload identity versus end-user authorization | SPIFFE proves a workload identity within a trust domain; it does not encode domain object permissions. | Use both layers where required; do not map a service certificate directly to user authority. |
| Cache availability versus revocation speed | Local JWT/JWKS or PDP caches reduce dependency load but extend the stale window. | State the maximum acceptable stale decision and the emergency invalidation path. |
| 504 versus business outcome | RFC 9110 defines the gateway timeout observation, not whether an upstream mutation committed. | Model unknown outcome and query/idempotency recovery explicitly. |
| Single shared gateway versus cells | A centralized gateway simplifies policy; high blast radius and shared pools can make it the outage. | Choose fleet/cell boundaries from dependency and failure budgets, not request volume alone. |

## Negative evidence and anti-patterns

- Do not make the gateway the only authorization check for object-level or tenant-level access. A direct/private route, service-to-service caller, batch worker, or future ingress can bypass the assumption.
- Do not trust client-provided `X-User-*`, `X-Forwarded-*`, tenant, role, or policy headers. Strip and overwrite them at every boundary; define the trusted proxy chain.
- Do not retry every timeout, `429`, `502`, `503`, or `504` with the same policy. This can multiply load and duplicate a mutation whose response was lost.
- Do not use an unbounded remote PDP call on the critical path without a latency budget, cache/bundle plan, circuit behavior, and a decision for fail-open versus fail-closed.
- Do not treat a warm JWKS cache as proof that key rotation and issuer/audience configuration are correct. Test unknown `kid`, removed key, algorithm confusion, clock skew, and refresh storms.
- Do not put raw tokens, authorization headers, policy input, or high-cardinality principals in logs/metrics. Record safe reason codes, policy version, issuer, route, and correlation identifiers only as permitted.
- Do not add a gateway hop to fix a service ownership problem. An unowned route, duplicated authorization policy, and unclear error contract become harder to debug behind a shared proxy.
- Do not hold a synchronous gateway request open while a workflow waits on multiple providers, queues, or human action. Return a durable operation state when completion is not bounded.
- Do not assume a Gateway API resource is portable just because the YAML validates. Check conformance profile, implementation version, policy attachment, cross-namespace references, and extension behavior.
- Do not allow a migration shadow path to execute mutations. Shadow must be read-only or side-effect isolated, otherwise it is a duplicate business operation.

## Duplicate/canonical ownership

| Concept | Canonical owner | Action for this topic |
| --- | --- | --- |
| OAuth/OIDC flow, JWT claims, PKCE, token exchange, session and secret storage | `13-security-oauth2` | Keep edge-specific placement and failure examples; link for protocol definitions and secure coding. |
| Rate algorithms, token buckets, quotas, overload and limiter atomicity | `10-system-design-rate-limit` | Use route-level placement and identity-key examples; do not repeat the limiter implementation. |
| RED/USE, trace context, SLOs, alerts and incident response | `20-observability-sre` | Specify gateway signals and labels, then link for telemetry and alert design. |
| Broker delivery, outbox, retries/DLQ and consumer idempotency | `08-message-queue`, `09-distributed-tx-fintech`, Case Study 15 | Keep only the gateway request-to-command boundary and status contract. |
| Distributed lock/lease/fencing | `28-distributed-lock-lease` | Do not use a gateway lock as a correctness guarantee; link when leader routing or config rollout needs coordination. |
| Database constraints/idempotency and payment workflow | `05-db-core-index-lock`, `09-distributed-tx-fintech`, Case Study 15 | The gateway owns the ambiguous response and propagation concern; the domain owner enforces the mutation invariant. |
| Kubernetes ingress/gateway resources and mesh operations | `14-devops-k8s-best-practices` | Link for cluster/container deployment; this topic owns edge semantics and identity placement. |

## Integration record (Batch C scope)

- [x] Added the edge contract for large-body streaming, durable async acceptance, `UNKNOWN` outcomes, and retry boundaries as `internal-calls-sync-async-or-neither.q3`.
- [x] Mirrored the addition in EN and VI and kept gateway ownership separate from Topic 17 upload/job state.
- [ ] Broader non-Batch-C cleanup below remains a follow-up audit.

### Deferred broader audit items

- [ ] Retain the four-size arithmetic but label the `20x` multiplier and all capacity breakpoints as assumptions; add burst duration, payload, connection, token, and downstream dimensions.
- [ ] Add a small “edge contract” box: route owner, trusted ingress, identity source, authorization owner, per-hop deadline, retry budget, error contract, and rollback owner.
- [ ] Replace the local Spring Cloud Gateway `5.0.2` wording with a pinned release-train note. Verify the selected Spring Boot/Cloud compatibility matrix and server flavor before integration.
- [ ] State that route/filter order is implementation/version-specific and add an effective-chain regression test rather than relying on source/YAML order.
- [ ] Add the timeout/crash-window table, especially upstream mutation followed by response loss and the resulting idempotency/status lookup requirement.
- [ ] Separate JWT, opaque introspection, workload mTLS/SPIFFE, and application authorization into a layered decision table; do not present one as a replacement for the others.
- [ ] Add explicit rules for stripping client identity headers, trusted proxy configuration, direct-ingress testing, token/key rotation, and telemetry redaction.
- [ ] Add local-versus-remote PDP guidance with decision-cache TTL, policy version, rollout, outage, and fail-open/closed choices.
- [ ] Make gateway migration shadow routes side-effect safe and require route ownership, config hash, rollback, and parity metrics.
- [ ] Make async examples include durable acceptance, idempotency, status retrieval, duplicate/out-of-order handling, and operator recovery.
- [ ] Update EN and VI symmetrically while preserving every existing `id` and keeping protocol names/header names unchanged.

## EN/VI parity and cross-reference plan

The EN and VI files have the same 6 sections and 18 item IDs. The integration pass should make the same classifications and cross-links in both languages. English currently uses more framework names and the Vietnamese version has a slightly larger byte size; this is not a structural mismatch. Any replacement of “must”, “always”, tier boundary, or “secure” should carry the same `fact`, `inference`, `recommendation`, or `unknown` label in both files.

## Open questions and falsifiers

- [ ] Which gateway implementation and release train is in scope: Spring Cloud Gateway WebFlux, Envoy, a managed edge, Kubernetes Gateway API implementation, or a combination?
- [ ] Is the gateway public, private, mesh-local, or all three? What paths can bypass it, and who owns each trust boundary?
- [ ] What are the p99/p999 end-to-end deadline, connection reuse, payload, token mix, and downstream concurrency targets at each traffic tier?
- [ ] Which routes carry mutations where a 504 can mean “committed but unknown”? What idempotency key/status lookup contract exists?
- [ ] What is the maximum acceptable JWT/JWKS, PDP, or policy-cache staleness after revocation or emergency deny?
- [ ] Should IdP/introspection/PDP failure fail closed, serve a bounded cached read, or enter an explicit degraded mode for each route class?
- [ ] What policy language/runtime, bundle delivery, decision cache, and policy version will be deployed? Who can roll it back?
- [ ] What identity headers are accepted internally, and how are direct service ingress, batch workers, and cross-region calls tested?
- [ ] Which Gateway API conformance profile and extensions are required, especially for TLS, cross-namespace routing, authorization, and rate limits?
- [ ] What evidence would falsify the proposed edge boundary? Examples: gateway p99 consumes more than the allocated hop budget, a shared pool failure takes down unrelated routes, stale policy exceeds the risk window, a retry test duplicates a mutation, or a bypass route accepts an untrusted principal.

## Source ledger

All selected sources were inspected on 2026-08-23. Tier A means a standard, specification, or first-party implementation document; Tier B means first-party operational/architecture guidance. “Current” means the publisher’s page at review time; pin the actual dependency and re-check release notes before integration.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 27-01 | [Spring Cloud Gateway Server WebFlux](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux.html), Spring | A; current reference, release heading varies by page; local content says 5.0.2, current pages observed 5.0.3 | Server flavor, WebFlux/Netty boundary, and version-pinning requirement. | 2026-08-23 |
| 27-02 | [Route Predicate Factories and Filter Factories](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/configuring-route-predicate-factories-and-filter-factories.html), Spring | A; Spring Cloud Gateway 5.0.3 reference page observed | Route matching/filter configuration model and implementation-specific filter behavior. | 2026-08-23 |
| 27-03 | [Global Filters](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/global-filters.html), Spring | A; Spring Cloud Gateway 5.0.3 reference page observed | Global/default/route filter participation, ordering concerns, metrics and path tags; exact effective order must be tested. | 2026-08-23 |
| 27-04 | [HTTP timeouts configuration](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/http-timeouts-configuration.html), Spring | A; Spring Cloud Gateway 5.0.3 reference page observed | Global connect/response timeout settings, per-route metadata, Duration format, and provider-specific override semantics. | 2026-08-23 |
| 27-05 | [HTTP client configuration](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/http-client.html), Spring | A; Spring Cloud Gateway 5.0.3 reference page observed | Gateway HTTP client behavior, connection configuration, TLS/client options and the need to budget pools and timeouts. | 2026-08-23 |
| 27-06 | [CircuitBreaker GatewayFilter Factory](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/gatewayfilter-factories/circuitbreaker-filter-factory.html), Spring | A; Spring Cloud Gateway 5.0.3 reference page observed; Resilience4J integration | Circuit-breaker filter placement, fallback/status handling, and why a breaker is not a business idempotency mechanism. | 2026-08-23 |
| 27-07 | [RequestRateLimiter GatewayFilter Factory](https://docs.spring.io/spring-cloud-gateway/reference/5.0-SNAPSHOT/spring-cloud-gateway-server-webflux/gatewayfilter-factories/requestratelimiter-factory.html), Spring | A; 5.0-SNAPSHOT reference; snapshot and version-sensitive | Gateway rate-limit placement and provider-specific filter contract; not used as evidence for algorithm correctness. | 2026-08-23 |
| 27-08 | [Actuator API](https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/actuator-api.html), Spring | A; current 5.0.x reference | Route/config inspection and operational endpoint boundary; exposure must be secured. | 2026-08-23 |
| 27-09 | [Gateway API introduction](https://gateway-api.sigs.k8s.io/docs/introduction/), Kubernetes SIG Network | A; Gateway API site, current channel/conformance docs | Gateway API’s role-oriented Kubernetes model and its distinction from an implementation. | 2026-08-23 |
| 27-10 | [Gateway API overview](https://gateway-api.sigs.k8s.io/docs/concepts/api-overview/), Kubernetes SIG Network | A; current Gateway API docs | GatewayClass/Gateway/Route resource relationships, delegation and portability limits. | 2026-08-23 |
| 27-11 | [Gateway API TLS guide](https://gateway-api.sigs.k8s.io/guides/user-guides/tls/), Kubernetes SIG Network | A; current guide; version/conformance must be pinned | TLS termination, listener and certificate-reference concepts; implementation support differs. | 2026-08-23 |
| 27-12 | [Gateway API multiple namespaces](https://gateway-api.sigs.k8s.io/guides/user-guides/multiple-ns/), Kubernetes SIG Network | A; current guide; version/conformance must be pinned | Cross-namespace route/reference permissions and the need for explicit ownership boundaries. | 2026-08-23 |
| 27-13 | [Transient failures](https://www.envoyproxy.io/docs/envoy/latest/faq/load_balancing/transient_failures), Envoy | A; Envoy latest docs, 1.40.0-dev site | Transient failure/retry context and the risk of treating all failures as retryable. | 2026-08-23 |
| 27-14 | [Circuit breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking), Envoy | A; Envoy latest docs, 1.40.0-dev site | Pending/request/retry limits, per-cluster scope, and fuzzy distributed counters. | 2026-08-23 |
| 27-15 | [HTTP routing](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing.html), Envoy | A; Envoy latest docs, 1.40.0-dev site | Route timeout/retry behavior, retry budgets, and the distinction between request timeout and backend outcome. | 2026-08-23 |
| 27-16 | [JWT authentication filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/jwt_authn_filter), Envoy | A; Envoy latest docs, 1.40.0-dev site | JWT issuer/audience/JWKS validation placement and provider-specific filter configuration. | 2026-08-23 |
| 27-17 | [External authorization filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter), Envoy | A; Envoy latest docs, 1.40.0-dev site | Synchronous external authorization call, request/response forwarding choices, and dependency failure surface. | 2026-08-23 |
| 27-18 | [Rate limit filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_filter), Envoy | A; Envoy latest docs, 1.40.0-dev site | Route descriptors, external rate-limit service, `429`, stats, and configurable failure behavior. | 2026-08-23 |
| 27-19 | [TLS](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/security/ssl), Envoy | A; Envoy latest docs, 1.40.0-dev site | TLS termination/origination, certificate validation and the implementation-specific security boundary. | 2026-08-23 |
| 27-20 | [Response code details](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_conn_man/response_code_details), Envoy | A; Envoy latest docs, 1.40.0-dev site | Gateway diagnostic detail codes and the value of distinguishing local rejection, reset, timeout, and upstream response. | 2026-08-23 |
| 27-21 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html), IETF | A; RFC 9110 / STD 97, 2022 | 502/503/504 meaning, intermediary behavior, timeout observation, and the limits of HTTP method idempotency for business effects. | 2026-08-23 |
| 27-22 | [Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html), IETF | A; RFC 9457, 2023 | Structured error representation for route/auth/policy/pending/conflict errors; it does not define retry policy. | 2026-08-23 |
| 27-23 | [HTTP API authorization](https://www.openpolicyagent.org/docs/http-api-authorization), Open Policy Agent | A; current OPA docs | OPA decision API shape, input/decision boundary, and remote PDP dependency considerations. | 2026-08-23 |
| 27-24 | [Policy performance](https://www.openpolicyagent.org/docs/policy-performance), Open Policy Agent | A; current OPA docs | Policy evaluation/indexing/performance considerations; examples are not universal latency SLOs. | 2026-08-23 |
| 27-25 | [Cedar authorization documentation](https://docs.cedarpolicy.com/), AWS Cedar project | A; Cedar 4.5 docs | Cedar policy/authorization model and the need to distinguish language semantics from deployment/runtime guarantees. | 2026-08-23 |
| 27-26 | [SPIFFE concepts](https://spiffe.io/docs/latest/spiffe/concepts/), SPIFFE project | A; latest SPIFFE docs, v1.15.2 family | Trust domains, workload identity, SVID types and the difference between workload and user identity. | 2026-08-23 |
| 27-27 | [SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/), SPIFFE project | A; current Workload API specification | Workload API delivery/rotation model and application integration boundary for SVIDs. | 2026-08-23 |
| 27-28 | [SPIFFE specifications](https://spiffe.io/docs/latest/spiffe-specs/), SPIFFE project | A; latest specifications, v1.15.2 family | SPIFFE specification/version scope and the need to pin implementation support. | 2026-08-23 |
| 27-29 | [HTTP semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/), OpenTelemetry | A; current semantic conventions, versioned specification | Standard HTTP span/attribute naming boundary and why telemetry must avoid raw secrets/high-cardinality identity. | 2026-08-23 |
| 27-30 | [OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html), IETF | A; RFC 9700, 2025 | Current OAuth attack mitigations and the requirement to treat token validation/redirect/trust details as security protocol concerns. | 2026-08-23 |
| 27-31 | [JSON Web Token Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068.html), IETF | A; RFC 9068, 2021 | JWT access-token claims/profile and validation scope; profile conformance does not replace resource authorization. | 2026-08-23 |
| 27-32 | [OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662.html), IETF | A; RFC 7662, 2015 | Introspection response and active-token decision model; deployment latency/cache/revocation scope remains provider-specific. | 2026-08-23 |
| 27-33 | [Spring Security OAuth2 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html), Spring | A; current Spring Security reference; dependency version must be pinned | Issuer/JWK discovery and JWT resource-server validation behavior; framework defaults are not a universal identity contract. | 2026-08-23 |

## Discovery exclusions and unresolved source limits

- Spring Cloud Gateway documentation has separate WebFlux and Web MVC paths and moving release headings. Older aliases and snapshot pages were not treated as stable compatibility evidence; the exact release train remains unresolved.
- Envoy `latest` documentation is useful for current implementation behavior but is not a pinned deployment contract. The final content must name the Envoy release and xDS/control-plane version.
- Gateway API documentation defines resources and conformance, not the behavior of every implementation extension or policy attachment. A passing manifest validation will not falsify an implementation gap.
- OPA performance examples and Cedar documentation describe engines/languages, not the target workload’s p99 or availability. A benchmark under the target policy set is still required.
- RFC 9068/9700 and RFC 7662 define protocol boundaries; issuer-specific claims, key rotation overlap, introspection caching, and revocation latency remain unknown until the selected identity provider is named.
- Search-result duplicates, copied Spring/Envoy snippets, SEO comparisons of “API gateway vs service mesh”, and unverified fixed-latency/throughput numbers were excluded because they added no independent evidence.

## Gate status

- [x] Complete EN/VI files and exact item IDs read.
- [x] Broad discovery performed; 33 selected sources mapped to claims with URL, organization, tier, revision, and review date.
- [x] Definitions, invariants, workload, failure/crash windows, retries/timeouts, operations/recovery, security/privacy, testing, and domain trade-offs covered.
- [x] Comparison table, contradiction/limits table, negative evidence, duplicate/canonical ownership, EN/VI parity plan, and falsifiers recorded.
- [x] Version/provider scope and unresolved source limits recorded.
- [ ] Final gateway/identity/PDP implementation and release approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.
