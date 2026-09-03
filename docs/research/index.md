# System Design & Case Studies Research Index

Status: `FINAL SOURCE AUDIT COMPLETE · DEPLOYMENT INPUTS OPEN`

This is the durable per-unit checklist. Each row must eventually link to one research file under `docs/research/units/`. The synthesis dossiers help compare units; they do not replace these records.

## Research record contract

Each unit record must cover:

- exact local file(s), sections/questions/headings, and EN/VI pair;
- what the current content gets right;
- claims that need verification, qualification, or removal;
- authoritative/first-party sources with reviewed date;
- broad candidate-source search plus a selected source ledger (normally 20+ inspected sources; 30-50 for broad/high-risk units, up to 200 only when every source adds distinct evidence);
- coverage matrix, contradiction/limits table, negative evidence/anti-patterns, and explicit unknowns;
- workload, invariant, consistency, failure, recovery, and operational trade-offs;
- duplicate/canonical ownership decision;
- proposed content changes, integration records, and remaining follow-ups;
- EN/VI parity and cross-reference migration notes;
- open questions and confidence level.

Status values: `TODO`, `RESEARCHING`, `REVIEW`, `READY`, `INTEGRATED`.

## Topics — 28 units

| # | Key | Title | Research file | Status | Main review lens |
| ---: | --- | --- | --- | --- | --- |
| 01 | `01-java-core-jvm` | Java Core & JVM internals | `research/topics/01-java-core-jvm.md` | INTEGRATED | JVM/JMM claims that affect system-design capacity, latency, and concurrency reasoning |
| 02 | `02-java-8-25-java-vs-go` | Java 8 → 25 evolution & Java vs Go | `research/topics/02-java-8-25-java-vs-go.md` | INTEGRATED | Version-sensitive claims, virtual threads, runtime trade-offs, and evidence date |
| 03 | `03-spring-boot-deep-build` | Spring & Spring Boot + Maven/Gradle | `research/topics/03-spring-boot-deep-build.md` | INTEGRATED | Transaction boundaries, framework defaults, cache/events, build and runtime claims |
| 04 | `04-rest-grpc-webflux` | REST/gRPC & reactive programming | `research/topics/04-rest-grpc-webflux.md` | INTEGRATED | Protocol semantics, backpressure, deadlines, retries, and reactive versus virtual-thread scope |
| 05 | `05-db-core-index-lock` | Database indexes, transactions, locking | `research/topics/05-db-core-index-lock.md` | INTEGRATED | MVCC/locking accuracy, constraints, deadlocks, and local authority boundaries |
| 06 | `06-db-scaling` | Replication, sharding, partitioning | `research/topics/06-db-scaling.md` | INTEGRATED | Consistency models, lag, routing, resharding, restore, and blast radius |
| 07 | `07-sql-nosql-db-engines` | SQL/NoSQL engines | `research/topics/07-sql-nosql-db-engines.md` | INTEGRATED | Engine-specific guarantees, workload fit, integrity, and stale comparisons |
| 08 | `08-message-queue` | RabbitMQ vs Kafka | `research/topics/08-message-queue.md` | INTEGRATED | Delivery semantics, ordering, confirms, replay, DLQ, schemas, and exactly-once scope |
| 09 | `09-distributed-tx-fintech` | Transactions across services | `research/topics/09-distributed-tx-fintech.md` | INTEGRATED | Saga/Outbox/idempotency/TCC/ledger correctness and canonical ownership |
| 10 | `10-system-design-rate-limit` | System-design foundations, high load, rate limit | `research/topics/10-system-design-rate-limit.md` | INTEGRATED | Capacity derivation, overload controls, cache topology, and review method |
| 11 | `11-system-design-cases` | Real system-design prompts | `research/topics/11-system-design-cases.md` | INTEGRATED | Prompt-level duplication, domain invariants, and case-to-pattern boundaries |
| 12 | `12-architecture-patterns` | DDD, Clean, Hexagonal, patterns | `research/topics/12-architecture-patterns.md` | INTEGRATED | Boundary/dependency claims, CQRS/event sourcing fit, and anti-pattern overreach |
| 13 | `13-security-oauth2` | OAuth2, OIDC, JWT, auth system | `research/topics/13-security-oauth2.md` | INTEGRATED | Protocol correctness, token lifecycle, authorization boundaries, and OWASP claims |
| 14 | `14-devops-k8s-best-practices` | Docker, K8s, Nginx, logging, CI/CD | `research/topics/14-devops-k8s-best-practices.md` | INTEGRATED | Version/currentness, workload fit, operational defaults, and “best practice” qualifiers |
| 15 | `15-network-i-o-models` | Networking, protocols, I/O models | `research/topics/15-network-i-o-models.md` | INTEGRATED | HTTP/1–3, TLS, TCP/QUIC, threading, pooling, and latency claims |
| 16 | `16-project-concurrency-whiteboard` | OTA project, concurrency, realtime, whiteboard | `research/topics/16-project-concurrency-whiteboard.md` | INTEGRATED | OTA domain invariants, hold/booking state machine, external authority, interview overlap |
| 17 | `17-rest-api-design` | REST API design and lifecycle | `research/topics/17-rest-api-design.md` | INTEGRATED | Resource contracts, idempotency, errors, pagination, versioning, and compatibility |
| 18 | `18-query-optimization` | Query plan and optimization | `research/topics/18-query-optimization.md` | INTEGRATED | EXPLAIN/optimizer accuracy, indexing advice, measurement, and engine scope |
| 19 | `19-dsa-leetcode` | DSA patterns and presentation | `research/topics/19-dsa-leetcode.md` | INTEGRATED | Algorithm complexity, modern language claims, and separation from system-design cases |
| 20 | `20-observability-sre` | Observability and SRE | `research/topics/20-observability-sre.md` | INTEGRATED | SLI/SLO/error budget, alerting, tracing, incident and recovery evidence |
| 21 | `21-linux-production-debug` | Linux and production troubleshooting | `research/topics/21-linux-production-debug.md` | INTEGRATED | Command/runtime accuracy, safe diagnosis, JVM/network signals, and current tooling |
| 22 | `22-low-level-design-ood` | Low-level design and code | `research/topics/22-low-level-design-ood.md` | INTEGRATED | Pattern fit, concurrency correctness, testability, and code-level duplication |
| 23 | `23-java-concurrency-coding` | Java concurrency coding | `research/topics/23-java-concurrency-coding.md` | INTEGRATED | JMM, synchronizers, async APIs, cancellation, and Java-version scope |
| 24 | `24-domain-driven-design` | Strategic/tactical DDD | `research/topics/24-domain-driven-design.md` | INTEGRATED | Bounded contexts, aggregates, events, transaction boundaries, and terminology |
| 25 | `25-microservice` | Microservices at scale | `research/topics/25-microservice.md` | INTEGRATED | Retry storms, consistency, queues, caching, idempotency, and overlap with 08/09/20/28 |
| 26 | `26-testing-strategy` | Testing strategy | `research/topics/26-testing-strategy.md` | INTEGRATED | Test pyramid limits, contract/integration/failure tests, and proof versus ritual |
| 27 | `27-api-gateway-identity-edge` | API gateway and identity edge | `research/topics/27-api-gateway-identity-edge.md` | INTEGRATED | Gateway boundary, authn/authz, rate limits, failure isolation, and migration claims |
| 28 | `28-distributed-lock-lease` | Distributed locks and leases | `research/topics/28-distributed-lock-lease.md` | INTEGRATED | Authority, fencing, expiry, fairness, DB alternatives, and false certainty |

## Case studies — 18 units

| # | Key | Title | Research file | Status | Main review lens |
| ---: | --- | --- | --- | --- | --- |
| 01 | `01-arcturus-inventory-processing-system` | Arcturus inventory processing | `research/case-studies/01-arcturus-inventory-processing-system.md` | INTEGRATED | First-party architecture evidence, ordered processing, eventual consistency, and benchmark scope |
| 02 | `02-a-b-testing-in-tiki-search` | A/B testing in Tiki Search | `research/case-studies/02-a-b-testing-in-tiki-search.md` | INTEGRATED | Experiment design, statistics, false positives, bucketing, and source fidelity |
| 03 | `03-tiki-scale-in-10-years` | TIKI at scale in 10 years | `research/case-studies/03-tiki-scale-in-10-years.md` | INTEGRATED | Timeline/source provenance, architecture evolution, organization versus technology claims |
| 04 | `04-o1-android-build-time-at-tiki` | O(1) Android build time | `research/case-studies/04-o1-android-build-time-at-tiki.md` | INTEGRATED | What O(1) means in context, Gradle/module mechanics, measurements, and limits |
| 05 | `05-scale-and-whats-next` | Scale and what is next | `research/case-studies/05-scale-and-whats-next.md` | INTEGRATED | Operations/people/process claims, evidence versus interpretation, and overlap with inventory cases |
| 06 | `06-tai-sao-tiki-chon-react-native` | Why Tiki chose React Native | `research/case-studies/06-tai-sao-tiki-chon-react-native.md` | INTEGRATED | Historical decision context, native boundary, team constraints, and version date |
| 07 | `07-into-the-demand-forecast-of-tiki-operations` | Demand forecasting at Tiki Operations | `research/case-studies/07-into-the-demand-forecast-of-tiki-operations.md` | INTEGRATED | Forecasting data/metrics, leakage, operational decisions, and source claims |
| 08 | `08-applying-machine-learning-to-solve-brand-logo-detection-problem` | Brand/logo detection ML | `research/case-studies/08-applying-machine-learning-to-solve-brand-logo-detection-problem.md` | INTEGRATED | Dataset/model claims, evaluation, synthetic data, and reproducibility boundaries |
| 09 | `09-pegasus-catalog-product-api-architecture` | Pegasus catalog API architecture | `research/case-studies/09-pegasus-catalog-product-api-architecture.md` | INTEGRATED | Denormalization, cache/projection freshness, async sync, and first-party evidence |
| 10 | `10-xac-thuc-va-phan-quyen-trong-microservices` | Authn/authz in microservices | `research/case-studies/10-xac-thuc-va-phan-quyen-trong-microservices.md` | INTEGRATED | JWT/OAuth boundary, service authorization, trust model, and source accuracy |
| 11 | `11-how-to-handle-hot-deals-at-the-peak-time` | Hot deals at peak time | `research/case-studies/11-how-to-handle-hot-deals-at-the-peak-time.md` | INTEGRATED | Inventory peak processing, queues, price propagation, and relation to Arcturus |
| 12 | `12-duplicate-booking-race-condition` | Fixing one race condition twice | `research/case-studies/12-duplicate-booking-race-condition.md` | INTEGRATED | Incident evidence, check-then-act, atomic write, HTTP semantics, and what the fix does not prove |
| 13 | `13-how-discord-stores-trillions-of-messages` | Discord message storage | `research/case-studies/13-how-discord-stores-trillions-of-messages.md` | INTEGRATED | First-party architecture claims, hot partitions, migrations, request coalescing, and reported results |
| 14 | `14-small-business-cloud-cost-shock` | Small-business cloud-cost shock | `research/case-studies/14-small-business-cloud-cost-shock.md` | INTEGRATED | Cost evidence, right-sizing, fixed floor, architecture fitness, and generalization limits |
| 15 | `15-transactional-outbox-order-workflow` | Transactional Outbox order workflow | `research/case-studies/15-transactional-outbox-order-workflow.md` | INTEGRATED | Crash windows, relay/inbox, Saga boundary, at-least-once, and duplicate reduction |
| 16 | `16-shopify-mysql-inventory-reservations` | Shopify MySQL inventory reservations | `research/case-studies/16-shopify-mysql-inventory-reservations.md` | INTEGRATED | First-party source, reservation invariant, SKIP LOCKED, connection pressure, and Redis comparison |
| 17 | `17-ssh-server-hardening-lessons` | Four SSH compromises | `research/case-studies/17-ssh-server-hardening-lessons.md` | INTEGRATED | Incident/source provenance, boundary controls, threat model, and non-universal lessons |
| 18 | `18-some-simple-economics-of-agi` | Verification becomes scarce | `research/case-studies/18-some-simple-economics-of-agi.md` | INTEGRATED | Paper fidelity, engineering inference, provenance, evaluation, and claim scope |

## Per-unit completion gate

- [x] Local EN/VI content read completely, not only title/tags.
- [x] Exact sections/questions/headings recorded.
- [x] Candidate source pool searched broadly; selected ledger normally has 20+ inspected authoritative/first-party sources, or a documented narrow-topic exception.
- [x] At least one authoritative or first-party source for each material claim; no source means label as inference or remove.
- [x] Coverage matrix, contradiction/limits table, negative evidence/anti-patterns, and explicit unknowns recorded.
- [x] Current/stale/unsupported claims listed.
- [x] Invariants, workload, failure model, and operational consequences stated.
- [x] Duplicate and canonical owner recorded.
- [x] Proposed change does not delete unique domain evidence.
- [x] EN/VI integration and cross-reference plan recorded.
- [x] Reviewer status changed to `REVIEW` before any `public/data` edit.
- [x] Status changed to `READY` only after evidence and structure review.
- [x] Status changed to `INTEGRATED` only after validation passes.

## Current progress

- Baseline source audit: `46/46` records, `1,359` URL references, and `1,003` distinct URLs after local deduplication. The durable follow-up is `dossiers/source-expansion-closeout.md`; the initial canonical expansion ledger is `dossiers/system-design-source-expansion.md`.
- Source expansion is deliberately blueprint-first: `source_items` in `public/data/system-design/catalog.json` are deep-dive question references, not bibliography counts. The new ledger maps all 20 blueprints to canonical topic owners and evidence gaps before any further public-data edit.
- Targeted expansion checkpoint (2026-08-23): EN/VI data and provenance were integrated for overload/rate policy (`10...q2/q5`), RabbitMQ queue-type semantics (`08...q2`), notification provider limits (`11...q2`), and upload bearer/checksum controls (`11...q10`). The final source audit below closes the remaining blueprint evidence rows without inventing deployment contracts.
- Payment/booking checkpoint (2026-08-23): Topic 09 q1/q2 and Blueprint 5 q1/q11 now carry provider-contract scope, unknown-age recovery and settlement limits; Blueprint 14 q14 now separates local hold expiry from supplier/GDS release. The chosen PSP/GDS contract remains an explicit TODO.
- Final expansion closeout (2026-08-23): PCI DSS v4.0.1, OAuth 2.1 draft status versus RFC 9700, RabbitMQ fairness/backpressure, Amadeus booking authority, feed fan-out, leaderboard rebuild, version dates, and duplicate/semantic ownership were rechecked in [`dossiers/system-design-source-expansion.md`](dossiers/system-design-source-expansion.md) and [`dossiers/source-expansion-closeout.md`](dossiers/source-expansion-closeout.md). All 46 unit rows and all 20 blueprint rows have an evidence decision; provider/version/traffic/SLO/compliance inputs remain intentionally open.
- Cross-topic synthesis dossier: `../research-distributed-workflow-correctness.md` — integrated; deployment-specific unknowns remain explicit.
- Cross-unit synthesis dossiers: `research-data-topology-projections.md` and `research-reliability-operations-recovery-testing.md` — integrated; their scoped EN/VI items and case qualifiers are present without duplicate IDs.
- Duplicate matrix: `../system-design-content-duplicate-matrix.md` — final ownership audit applied.
- Per-unit records: `research/` — 46/46 units have a review record and are integrated (Batch A: 6, Batch B: 5, Batch C: 6 new units, Batch D: 5, Batch E: 5, Batch F: 3, Batch G: 4, Batch H: 5, Batch I: 7); 0 remain TODO or REVIEW. Topics 17 and 25 were integrated locally after the agents stopped before a safe patch.
