# Research source expansion — durable TODO

Status: `FINAL AUDIT COMPLETE · DEPLOYMENT INPUTS OPEN`

Reviewed: `2026-08-23`

Scope: all `28` System Design topics, `18` Case Studies, and `20` System Design blueprints.

This is the durable closeout of the second research pass after baseline integration. The baseline content is integrated and validated; the final audit expands evidence and blueprint-level traceability while leaving deployment contracts explicit.

## Baseline audit

The local research records currently contain:

- `46/46` per-unit records: 28 topics + 18 case studies.
- `1,359` URL references across the records.
- `1,003` distinct URL values after local deduplication.
- `191` URLs reused by more than one record; reuse is treated as shared evidence, not new evidence.
- Every record has at least `21` URL references; the broadest record has `50`.
- Source diversity includes standards/specifications, official product documentation, original papers, first-party engineering reports, and operational/security guidance. The most represented domains are Oracle, AWS, RFC Editor, PostgreSQL, Spring, MySQL, Kubernetes, Redis, OpenTelemetry, Google SRE, and first-party engineering sites.
- Public content remains `499` topic items, `64` System Design items, `20` blueprints, and `50` SVG markers after the previous integration.

The baseline therefore already satisfies the “hundreds of sources” requirement globally. The new objective is evidence quality and coverage, not inflating counts with mirrors, search-result pages, repeated vendor landing pages, or multiple URLs for one document.

## Integration checkpoint (2026-08-23)

The first evidence-frozen slice is integrated and validated. It is intentionally narrow so repeated mechanisms remain canonical:

- [x] Topic 10: `surviving-high-load.q2` now derives concurrency/queue/priority/retry bounds from the protected resource and deadline; `rate-limiting-in-depth.q5` qualifies `429`, `Retry-After`, `503`/`504`, and optional rate-limit headers.
- [x] Topic 08: `reliability-delivery-semantics.q2` distinguishes RabbitMQ quorum queues from streams without promoting either to an external-effect guarantee.
- [x] Case 02: notification q2 now scopes APNs/FCM acceptance, token lifecycle, TTL/collapse, durable client sync, and user-delivery limits.
- [x] Case 10: upload q10 now treats presigned/session URLs as bearer capabilities and makes completion/checksum/publication idempotency explicit.
- [x] Topic 09 + Blueprint 5: payment q1/q2 and wallet/payment q1/q11 now pin provider contract scope and operate an unknown-age queue without claiming universal PSP semantics.
- [x] Blueprint 14: late-booking q14 now separates local hold expiry from supplier/GDS release and requires supplier reference/version/correlation reconciliation.
- [x] EN/VI parity and per-item provenance were updated together; immutable IDs and blueprint ownership were preserved.
- [x] Batches J–N/O were closed by the final expansion audit; every blueprint and per-unit row now has an evidence decision. Do not treat deployment-specific contract inputs as generic research facts.

## Final closeout checkpoint (2026-08-23)

| Scope | Result | Evidence record |
| --- | --- | --- |
| 28 topics + 18 case studies | `46/46` integrated records, each with a reviewed source ledger, limits/falsifiers, canonical owner, and EN/VI integration decision | [`research-system-design-source-expansion.md`](research-system-design-source-expansion.md) |
| Cross-unit synthesis dossiers | `2/2` integrated dossiers covering topology/projections and reliability/operations/recovery/testing; public-data additions and case qualifiers audited without duplicate IDs | [`research-data-topology-projections.md`](research-data-topology-projections.md), [`research-reliability-operations-recovery-testing.md`](research-reliability-operations-recovery-testing.md) |
| 20 blueprints | All rows have an evidence-routing decision. `source_items` remains an ownership/migration field; authored blueprints are not padded with copied study questions. | Final blueprint routing table in the source-expansion ledger |
| PCI/payment | PCI DSS v4.0.1 and provider-specific idempotency/status boundaries recorded; no universal PSP contract invented. | Topic 09 source ledger and payment checkpoint |
| OAuth | RFC 9700 is the security BCP; OAuth 2.1 remains an active draft, not a final RFC. | Topic 13 source ledger |
| RabbitMQ fairness/backlog | Official broker limits are separated from application-level admission/DRR fairness and recovery age. | Topic 08 source ledger and Blueprint 20 |
| Booking authority | Amadeus Search → Price → Create Orders → Order Management is recorded as one provider-specific example only. | Topic 16 source ledger and Blueprint 14 checkpoint |
| Feed/leaderboard | Hybrid fan-out, read-time privacy, durable score history, replay, checksum, and rebuild paths are recorded. | Blueprint 8/9 routing and catalog content |
| Duplicate/version audit | Exact normalized EN scan: zero duplicate section/question groups; all 46 research records contain the review date and no record has fewer than 20 URLs. | Final coverage audit and command output |

The per-unit dossiers intentionally retain their own unchecked bullets. In the final audit they are classified as optional refinement proposals, deployment inputs, falsifiers, or gate evidence—not silently marked complete just to make the count green. They remain visible so the repository does not turn an illustrative design into a false deployment specification.

## Evidence rules

- [x] Normalize and deduplicate by canonical document, not only by URL string. An HTML page and its PDF export count as one source when they contain the same document.
- [x] Prefer T1 normative sources: RFCs, W3C specifications, NIST, OWASP, PCI SSC, and other standards or security baselines.
- [x] Prefer T2 official implementation guarantees: AWS, Google Cloud, Azure, Kubernetes, Kafka, RabbitMQ, Redis, PostgreSQL, MySQL, Oracle, OpenJDK, Spring, gRPC, Envoy, OpenTelemetry, Apple, Firebase, and Elastic.
- [x] Use T3 first-party engineering reports for real production constraints: Google SRE, Meta, Discord, Shopify, Stripe, Tiki, and similar operators.
- [x] Use T4 original papers and conference proceedings for system history, workload, consistency, and measured limits.
- [x] Treat T5 secondary articles as discovery leads only; a material claim must be supported by T1–T4 or explicitly marked as an inference.
- [x] Record publication/revision date, access date, version, provider/region assumptions, and whether the source is a guarantee, observation, benchmark, or recommendation.
- [x] Keep a contradiction/limits row for every strong claim. “Exactly once”, “strong consistency”, “high availability”, “real time”, “linear scale”, and “zero downtime” must always be scoped.
- [x] Build a candidate pool up to `200` sources per unit only when useful. The selected ledger normally stays at `20+`, rises to `30–50` for broad/high-risk units, and must never be padded.
- [x] Do not integrate a new claim into `public/data/` until the claim-to-source map, limits, EN/VI wording, canonical owner, and validation gate are complete.

## Batch plan

The batches are ordered by reuse. A canonical source family is researched once, then referenced by several related units without duplicating the explanation.

| Batch | Scope | Canonical evidence families | Output |
| --- | --- | --- | --- |
| J | Blueprints 1–4, 16–17 | design review, capacity, caching, overload, retry budgets, rate limits | blueprint evidence matrix + overload limits |
| K | Blueprints 5–7, 11 | payment/ledger, Saga, Outbox, idempotency, notifications, redirects | consistency and delivery semantics ledger |
| L | Blueprints 8–10, 12 | news feed/graph, cache topology, leaderboard, autocomplete | read-model and freshness ledger |
| M | Blueprints 13–15, 18 | object upload, OTA booking/search, flash-sale inventory | integrity, reservation, and hot-key ledger |
| N | Blueprints 19–20 | API gateway/identity, RabbitMQ fairness and failure behavior | edge/security and broker fairness ledger |
| O | All 46 units | gaps, contradictions, stale versions, cross-reference ownership | final claim map; no content change until gates pass |

## Blueprint coverage matrix

`Deep refs` is the number of local System Design questions currently attached in `public/data/system-design/catalog.json`. It is not a bibliography count. `Canonical owner` identifies where the reusable technique should be explained in depth; a case study may still show how the same technique changes under a different invariant.

| # | Blueprint | Deep refs | Canonical owner | Expansion batch | Evidence gap to close |
| ---: | --- | ---: | --- | --- | --- |
| 1 | design-review-framework | 5 | Topic 10 — design method and capacity | J | link review gates to standards and operational evidence |
| 2 | traffic-caching-building-blocks | 4 | Topic 10 — cache/traffic building blocks | J | cache key, invalidation, stale serving, stampede limits |
| 3 | surviving-high-load | 5 | Topic 10 + Topic 20 — overload and SRE | J | retry budgets, load shedding, graceful degradation |
| 4 | distributed-rate-limiter | 8 | Topic 10 — rate limiting | J | local/global quota, fairness, fail-open/fail-closed |
| 5 | payment-ledger | 2 | Topic 09 + Topic 05 — ledger correctness | K | ledger invariant, idempotency, reconciliation, external authority |
| 6 | notification-service | 1 | Blueprint-only prompt under Topic 11 | K | APNs/FCM best-effort, ordering, collapse, expiry, token lifecycle |
| 7 | url-shortener | 1 | Topic 17 — HTTP/API lifecycle | K | redirect semantics, key generation, cacheability, abuse controls |
| 8 | news-feed | 1 | Topic 11 + data topology dossier | L | fan-out choices, privacy at read time, freshness, hot users |
| 9 | realtime-leaderboard | 1 | Blueprint-only prompt under Topic 11 | L | exact rank, ties, windows, atomic score updates, rebuild path |
| 10 | distributed-cache | 1 | Topic 10 + Topic 06 — cache and replication | L | source of truth, invalidation, eviction, regional staleness |
| 11 | chat-messaging | 1 | Topic 11 + Topic 04/15 — realtime transport | K | connection lifecycle, ordering scope, replay, backpressure |
| 12 | autocomplete-typeahead | 1 | Topic 18 — query/search optimization | L | prefix/infix trade-off, index memory, debounce, ranking freshness |
| 13 | object-storage-large-upload | 1 | Topic 17 — API contract + storage | M | resumability, checksums, bearer URLs, abort/lifecycle cleanup |
| 14 | ota-flight-booking | 5 | Topic 16 — booking invariant | M | external authority, hold expiry, compensation, reconciliation |
| 15 | high-traffic-booking-search | 2 | Topic 16 + Topic 18 — search/read model | M | stale search versus booking truth, cache invalidation, hot routes |
| 16 | scaling-1m-to-10m-requests | 2 | Topic 10 — capacity model | J | measurement thresholds and operational scaling triggers |
| 17 | scaling-technique-catalogue | 2 | Topic 10 — decision framework | J | when each technique is not needed and its failure cost |
| 18 | flash-sale-booking-inventory-bottleneck | 2 | Topic 16 + Topic 28 — inventory/lease | M | oversell invariant, queue fairness, lease/fencing, admission control |
| 19 | api-gateway-identity-edge | 19 | Topic 27 — gateway and identity | N | OAuth security BCP, authorization boundary, retry/rate-limit coupling |
| 20 | multi-tenant-rabbitmq-fairness | 0 | Topic 08 — broker semantics | N | tenant isolation, prefetch, quorum/stream choice, poison messages |

## Unit checklist — topics

The URL number is the local deduplicated URL-match count used for triage. It is a baseline, not a completion score.

| # | Unit | URLs | Next evidence lens | Batch | Status |
| ---: | --- | ---: | --- | --- | --- |
| 01 | Java Core & JVM | 25 | Java 25 preview/currentness, memory/concurrency limits | O | [x] |
| 02 | Java 8 → 25 and Java vs Go | 26 | version matrix, virtual-thread scope, benchmark caveats | O | [x] |
| 03 | Spring/Spring Boot/build | 31 | framework defaults, graceful shutdown, build reproducibility | O | [x] |
| 04 | REST/gRPC/WebFlux | 28 | deadlines, cancellation, backpressure, retry scope | O | [x] |
| 05 | DB indexes/transactions/locks | 25 | isolation anomalies, constraints, lock ownership | O | [x] |
| 06 | replication/sharding/partitioning | 30 | consistency modes, lag, failover, resharding | O | [x] |
| 07 | SQL/NoSQL engines | 34 | workload fit, guarantees, cost and operational limits | O | [x] |
| 08 | RabbitMQ vs Kafka | 36 | ordering, replay, confirms, exactly-once scope | N/O | [x] |
| 09 | distributed transactions/fintech | 43 | Saga, Outbox, TCC, ledger and reconciliation ownership | K/O | [x] |
| 10 | system-design foundations/high load/rate limit | 22 | capacity derivation, overload and cache evidence | J/O | [x] |
| 11 | system-design cases | 36 | prompt grouping and technique ownership | O | [x] |
| 12 | architecture patterns/DDD/Clean/Hexagonal | 31 | boundaries, aggregates, CQRS/event sourcing limits | O | [x] |
| 13 | OAuth2/OIDC/JWT/security | 27 | OAuth BCP, token lifecycle, authorization and abuse | N/O | [x] |
| 14 | Docker/K8s/Nginx/CI/CD | 31 | probes, disruption budgets, rollout and supply chain | O | [x] |
| 15 | networking/protocols/I/O | 31 | HTTP/2/3, TLS, QUIC, pools, timeout budgets | O | [x] |
| 16 | OTA/concurrency/realtime/whiteboard | 36 | booking truth, holds, external authority, reconciliation | M/O | [x] |
| 17 | REST API design/lifecycle | 32 | compatibility, idempotency, pagination, redirect semantics | K/M/O | [x] |
| 18 | query optimization | 38 | optimizer evidence, plans, statistics and measurement | L/O | [x] |
| 19 | DSA/LeetCode | 39 | complexity proofs, implementation/version scope | O | [x] |
| 20 | observability/SRE | 23 | SLOs, error budgets, overload, incident/recovery drills | J/O | [x] |
| 21 | Linux/production troubleshooting | 21 | current tooling, safe diagnosis, kernel/runtime evidence | O | [x] |
| 22 | low-level design/OOD | 30 | pattern fit, state ownership, testability and concurrency | O | [x] |
| 23 | Java concurrency coding | 25 | JMM, cancellation, structured concurrency, version scope | O | [x] |
| 24 | strategic/tactical DDD | 31 | bounded contexts, aggregates, events, transaction boundary | O | [x] |
| 25 | microservices at scale | 50 | retry storms, ownership, consistency, operational burden | O | [x] |
| 26 | testing strategy | 25 | proof by contract/integration/failure/load/restore tests | O | [x] |
| 27 | API gateway/identity edge | 33 | OAuth, authorization, quotas, failure isolation | N/O | [x] |
| 28 | distributed locks/leases | 27 | fencing, expiry, authority, fairness, DB alternatives | M/O | [x] |

## Unit checklist — case studies

| # | Unit | URLs | Next evidence lens | Batch | Status |
| ---: | --- | ---: | --- | --- | --- |
| 01 | Arcturus inventory processing | 27 | ordered processing, eventual consistency, benchmark scope | M/O | [x] |
| 02 | Tiki Search A/B testing | 28 | randomization, power, guardrails, false positives | O | [x] |
| 03 | TIKI at scale in 10 years | 26 | timeline provenance and architecture evolution | O | [x] |
| 04 | O(1) Android build time | 27 | what O(1) means, Gradle/module measurement limits | O | [x] |
| 05 | Scale and what is next | 27 | operations/people/process evidence and inference | O | [x] |
| 06 | Why Tiki chose React Native | 27 | historical constraints, native boundary, version date | O | [x] |
| 07 | Tiki demand forecasting | 28 | leakage, drift, slices, operational decisions | O | [x] |
| 08 | brand/logo detection ML | 27 | dataset, synthetic data, metrics, reproducibility | O | [x] |
| 09 | Pegasus catalog API | 28 | denormalization, projection freshness, cache invalidation | L/O | [x] |
| 10 | authn/authz in microservices | 25 | trust boundaries, JWT/OAuth scope, service authorization | N/O | [x] |
| 11 | hot deals at peak time | 25 | hot keys, inventory admission, queues, propagation | M/O | [x] |
| 12 | duplicate booking race condition | 21 | check-then-act, atomic write, HTTP retry semantics | M/O | [x] |
| 13 | Discord message storage | 25 | hot partitions, migrations, coalescing, result scope | L/O | [x] |
| 14 | small-business cloud cost shock | 23 | cost evidence, fixed floor, architecture fitness | O | [x] |
| 15 | transactional Outbox order workflow | 36 | dual-write crash windows, relay, inbox, replay | K/O | [x] |
| 16 | Shopify MySQL inventory reservations | 25 | reservation invariant, locking, connection pressure | M/O | [x] |
| 17 | SSH server hardening lessons | 27 | incident provenance, boundary controls, threat model | N/O | [x] |
| 18 | verification becomes scarce / AGI economics | 34 | paper fidelity, evaluation and engineering inference | O | [x] |

## Research workflow

- [x] Baseline local records and URLs audited.
- [x] Blueprint deep-reference counts separated from bibliography counts.
- [x] Finish batches J–N/O and add the selected canonical sources to the affected records.
- [x] Add a claim-to-source row for every material statement introduced or retained.
- [x] Add a counterexample/limit row for each “exactly once”, consistency, availability, real-time, or linear-scaling statement.
- [x] Mark stale/version-sensitive material with provider and revision date.
- [x] Run an exact duplicate scan over headings/questions and a semantic overlap review for shared tags.
- [x] Review canonical ownership so Saga, Outbox, idempotency, cache, request-size, booking, and lease explanations are not repeated as independent tutorials.
- [x] Update EN and VI together only after the evidence wording is frozen.
- [x] Run content validation, tests, diagram checks, ESM checks, logging checks, and `git diff --check` after integration.
- [x] Mark this file `FINAL AUDIT COMPLETE` only when all 46 unit rows and all 20 blueprint rows have an evidence decision.

## Session hand-off

If a future session receives a named deployment contract or a source changes, update the affected dossier first, then migrate only the scoped EN/VI claim after the same gates pass. Do not fill the remaining implementation inputs from generic defaults.
