# System Design & Case Studies Research Index

Status: `IN PROGRESS`

This is the durable per-unit checklist. Each row must eventually link to one research file under `docs/markdown/research/`. The synthesis dossiers help compare units; they do not replace these records.

## Research record contract

Each unit record must cover:

- exact local file(s), sections/questions/headings, and EN/VI pair;
- what the current content gets right;
- claims that need verification, qualification, or removal;
- authoritative/first-party sources with reviewed date;
- workload, invariant, consistency, failure, recovery, and operational trade-offs;
- duplicate/canonical ownership decision;
- proposed content changes without applying them yet;
- EN/VI parity and cross-reference migration notes;
- open questions and confidence level.

Status values: `TODO`, `RESEARCHING`, `REVIEW`, `READY`, `INTEGRATED`.

## Topics — 28 units

| # | Key | Title | Research file | Status | Main review lens |
| ---: | --- | --- | --- | --- | --- |
| 01 | `01-java-core-jvm` | Java Core & JVM internals | `research/topics/01-java-core-jvm.md` | TODO | JVM/JMM claims that affect system-design capacity, latency, and concurrency reasoning |
| 02 | `02-java-8-25-java-vs-go` | Java 8 → 25 evolution & Java vs Go | `research/topics/02-java-8-25-java-vs-go.md` | TODO | Version-sensitive claims, virtual threads, runtime trade-offs, and evidence date |
| 03 | `03-spring-boot-deep-build` | Spring & Spring Boot + Maven/Gradle | `research/topics/03-spring-boot-deep-build.md` | TODO | Transaction boundaries, framework defaults, cache/events, build and runtime claims |
| 04 | `04-rest-grpc-webflux` | REST/gRPC & reactive programming | `research/topics/04-rest-grpc-webflux.md` | TODO | Protocol semantics, backpressure, deadlines, retries, and reactive versus virtual-thread scope |
| 05 | `05-db-core-index-lock` | Database indexes, transactions, locking | `research/topics/05-db-core-index-lock.md` | TODO | MVCC/locking accuracy, constraints, deadlocks, and local authority boundaries |
| 06 | `06-db-scaling` | Replication, sharding, partitioning | `research/topics/06-db-scaling.md` | TODO | Consistency models, lag, routing, resharding, restore, and blast radius |
| 07 | `07-sql-nosql-db-engines` | SQL/NoSQL engines | `research/topics/07-sql-nosql-db-engines.md` | TODO | Engine-specific guarantees, workload fit, integrity, and stale comparisons |
| 08 | `08-message-queue` | RabbitMQ vs Kafka | `research/topics/08-message-queue.md` | TODO | Delivery semantics, ordering, confirms, replay, DLQ, schemas, and exactly-once scope |
| 09 | `09-distributed-tx-fintech` | Transactions across services | `research/topics/09-distributed-tx-fintech.md` | REVIEW | Saga/Outbox/idempotency/TCC/ledger correctness and canonical ownership |
| 10 | `10-system-design-rate-limit` | System-design foundations, high load, rate limit | `research/topics/10-system-design-rate-limit.md` | TODO | Capacity derivation, overload controls, cache topology, and review method |
| 11 | `11-system-design-cases` | Real system-design prompts | `research/topics/11-system-design-cases.md` | TODO | Prompt-level duplication, domain invariants, and case-to-pattern boundaries |
| 12 | `12-architecture-patterns` | DDD, Clean, Hexagonal, patterns | `research/topics/12-architecture-patterns.md` | TODO | Boundary/dependency claims, CQRS/event sourcing fit, and anti-pattern overreach |
| 13 | `13-security-oauth2` | OAuth2, OIDC, JWT, auth system | `research/topics/13-security-oauth2.md` | TODO | Protocol correctness, token lifecycle, authorization boundaries, and OWASP claims |
| 14 | `14-devops-k8s-best-practices` | Docker, K8s, Nginx, logging, CI/CD | `research/topics/14-devops-k8s-best-practices.md` | TODO | Version/currentness, workload fit, operational defaults, and “best practice” qualifiers |
| 15 | `15-network-i-o-models` | Networking, protocols, I/O models | `research/topics/15-network-i-o-models.md` | TODO | HTTP/1–3, TLS, TCP/QUIC, threading, pooling, and latency claims |
| 16 | `16-project-concurrency-whiteboard` | OTA project, concurrency, realtime, whiteboard | `research/topics/16-project-concurrency-whiteboard.md` | TODO | OTA domain invariants, hold/booking state machine, external authority, interview overlap |
| 17 | `17-rest-api-design` | REST API design and lifecycle | `research/topics/17-rest-api-design.md` | TODO | Resource contracts, idempotency, errors, pagination, versioning, and compatibility |
| 18 | `18-query-optimization` | Query plan and optimization | `research/topics/18-query-optimization.md` | TODO | EXPLAIN/optimizer accuracy, indexing advice, measurement, and engine scope |
| 19 | `19-dsa-leetcode` | DSA patterns and presentation | `research/topics/19-dsa-leetcode.md` | TODO | Algorithm complexity, modern language claims, and separation from system-design cases |
| 20 | `20-observability-sre` | Observability and SRE | `research/topics/20-observability-sre.md` | TODO | SLI/SLO/error budget, alerting, tracing, incident and recovery evidence |
| 21 | `21-linux-production-debug` | Linux and production troubleshooting | `research/topics/21-linux-production-debug.md` | TODO | Command/runtime accuracy, safe diagnosis, JVM/network signals, and current tooling |
| 22 | `22-low-level-design-ood` | Low-level design and code | `research/topics/22-low-level-design-ood.md` | TODO | Pattern fit, concurrency correctness, testability, and code-level duplication |
| 23 | `23-java-concurrency-coding` | Java concurrency coding | `research/topics/23-java-concurrency-coding.md` | TODO | JMM, synchronizers, async APIs, cancellation, and Java-version scope |
| 24 | `24-domain-driven-design` | Strategic/tactical DDD | `research/topics/24-domain-driven-design.md` | TODO | Bounded contexts, aggregates, events, transaction boundaries, and terminology |
| 25 | `25-microservice` | Microservices at scale | `research/topics/25-microservice.md` | TODO | Retry storms, consistency, queues, caching, idempotency, and overlap with 08/09/20/28 |
| 26 | `26-testing-strategy` | Testing strategy | `research/topics/26-testing-strategy.md` | TODO | Test pyramid limits, contract/integration/failure tests, and proof versus ritual |
| 27 | `27-api-gateway-identity-edge` | API gateway and identity edge | `research/topics/27-api-gateway-identity-edge.md` | TODO | Gateway boundary, authn/authz, rate limits, failure isolation, and migration claims |
| 28 | `28-distributed-lock-lease` | Distributed locks and leases | `research/topics/28-distributed-lock-lease.md` | TODO | Authority, fencing, expiry, fairness, DB alternatives, and false certainty |

## Case studies — 18 units

| # | Key | Title | Research file | Status | Main review lens |
| ---: | --- | --- | --- | --- | --- |
| 01 | `01-arcturus-inventory-processing-system` | Arcturus inventory processing | `research/case-studies/01-arcturus-inventory-processing-system.md` | TODO | First-party architecture evidence, ordered processing, eventual consistency, and benchmark scope |
| 02 | `02-a-b-testing-in-tiki-search` | A/B testing in Tiki Search | `research/case-studies/02-a-b-testing-in-tiki-search.md` | TODO | Experiment design, statistics, false positives, bucketing, and source fidelity |
| 03 | `03-tiki-scale-in-10-years` | TIKI at scale in 10 years | `research/case-studies/03-tiki-scale-in-10-years.md` | TODO | Timeline/source provenance, architecture evolution, organization versus technology claims |
| 04 | `04-o1-android-build-time-at-tiki` | O(1) Android build time | `research/case-studies/04-o1-android-build-time-at-tiki.md` | TODO | What O(1) means in context, Gradle/module mechanics, measurements, and limits |
| 05 | `05-scale-and-whats-next` | Scale and what is next | `research/case-studies/05-scale-and-whats-next.md` | TODO | Operations/people/process claims, evidence versus interpretation, and overlap with inventory cases |
| 06 | `06-tai-sao-tiki-chon-react-native` | Why Tiki chose React Native | `research/case-studies/06-tai-sao-tiki-chon-react-native.md` | TODO | Historical decision context, native boundary, team constraints, and version date |
| 07 | `07-into-the-demand-forecast-of-tiki-operations` | Demand forecasting at Tiki Operations | `research/case-studies/07-into-the-demand-forecast-of-tiki-operations.md` | TODO | Forecasting data/metrics, leakage, operational decisions, and source claims |
| 08 | `08-applying-machine-learning-to-solve-brand-logo-detection-problem` | Brand/logo detection ML | `research/case-studies/08-applying-machine-learning-to-solve-brand-logo-detection-problem.md` | TODO | Dataset/model claims, evaluation, synthetic data, and reproducibility boundaries |
| 09 | `09-pegasus-catalog-product-api-architecture` | Pegasus catalog API architecture | `research/case-studies/09-pegasus-catalog-product-api-architecture.md` | TODO | Denormalization, cache/projection freshness, async sync, and first-party evidence |
| 10 | `10-xac-thuc-va-phan-quyen-trong-microservices` | Authn/authz in microservices | `research/case-studies/10-xac-thuc-va-phan-quyen-trong-microservices.md` | TODO | JWT/OAuth boundary, service authorization, trust model, and source accuracy |
| 11 | `11-how-to-handle-hot-deals-at-the-peak-time` | Hot deals at peak time | `research/case-studies/11-how-to-handle-hot-deals-at-the-peak-time.md` | TODO | Inventory peak processing, queues, price propagation, and relation to Arcturus |
| 12 | `12-duplicate-booking-race-condition` | Fixing one race condition twice | `research/case-studies/12-duplicate-booking-race-condition.md` | TODO | Incident evidence, check-then-act, atomic write, HTTP semantics, and what the fix does not prove |
| 13 | `13-how-discord-stores-trillions-of-messages` | Discord message storage | `research/case-studies/13-how-discord-stores-trillions-of-messages.md` | TODO | First-party architecture claims, hot partitions, migrations, request coalescing, and reported results |
| 14 | `14-small-business-cloud-cost-shock` | Small-business cloud-cost shock | `research/case-studies/14-small-business-cloud-cost-shock.md` | TODO | Cost evidence, right-sizing, fixed floor, architecture fitness, and generalization limits |
| 15 | `15-transactional-outbox-order-workflow` | Transactional Outbox order workflow | `research/case-studies/15-transactional-outbox-order-workflow.md` | REVIEW | Crash windows, relay/inbox, Saga boundary, at-least-once, and duplicate reduction |
| 16 | `16-shopify-mysql-inventory-reservations` | Shopify MySQL inventory reservations | `research/case-studies/16-shopify-mysql-inventory-reservations.md` | TODO | First-party source, reservation invariant, SKIP LOCKED, connection pressure, and Redis comparison |
| 17 | `17-ssh-server-hardening-lessons` | Four SSH compromises | `research/case-studies/17-ssh-server-hardening-lessons.md` | TODO | Incident/source provenance, boundary controls, threat model, and non-universal lessons |
| 18 | `18-some-simple-economics-of-agi` | Verification becomes scarce | `research/case-studies/18-some-simple-economics-of-agi.md` | TODO | Paper fidelity, engineering inference, provenance, evaluation, and claim scope |

## Per-unit completion gate

- [ ] Local EN/VI content read completely, not only title/tags.
- [ ] Exact sections/questions/headings recorded.
- [ ] At least one authoritative or first-party source for each material claim; no source means label as inference or remove.
- [ ] Current/stale/unsupported claims listed.
- [ ] Invariants, workload, failure model, and operational consequences stated.
- [ ] Duplicate and canonical owner recorded.
- [ ] Proposed change does not delete unique domain evidence.
- [ ] EN/VI integration and cross-reference plan recorded.
- [ ] Reviewer status changed to `REVIEW` before any `public/data` edit.
- [ ] Status changed to `READY` only after evidence and structure review.
- [ ] Status changed to `INTEGRATED` only after validation passes.

## Current progress

- Cross-topic synthesis dossier: `../research-distributed-workflow-correctness.md` — draft only.
- Duplicate matrix: `../system-design-content-duplicate-matrix.md` — initial inventory only.
- Per-unit records: `research/` — 2/46 units have a review draft; 44 remain TODO.
