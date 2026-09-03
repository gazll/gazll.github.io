# Research — Architecture patterns, DDD overview, and modular boundaries

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `12-architecture-patterns`
EN file: `public/data/topics/12-architecture-patterns.json`
VI file: `public/data/topics/12-architecture-patterns.vi.json`

## Scope and non-goals

This record audits the local architecture-pattern topic: layered, hexagonal/ports-and-adapters, Clean/Onion dependency direction, strategic/tactical DDD overview, CQRS/Event Sourcing, classic patterns and SOLID, anti-patterns, coupling/cohesion, modular monoliths/microservices, anti-corruption layers, and Java/Spring enforcement/migration practices.

It owns architectural boundary reasoning and modular enforcement. The detailed DDD language and modeling rules belong to [24-domain-driven-design.md](24-domain-driven-design.md). Distributed transaction correctness and Outbox/Saga belong to [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md), with queue mechanics in [08-message-queue.md](08-message-queue.md). Query performance belongs to [18-query-optimization.md](18-query-optimization.md).

Layered, Hexagonal, Onion, and Clean are design vocabulary, not interchangeable compliance standards. Their common idea is dependency direction and replaceable boundaries; their package names, testing conventions, and framework integrations are project choices. Claims about Spring Modulith, ArchUnit, or Java package rules are version/provider-scoped.

Evidence-policy note: a discovery ceiling of 200 candidates was available for this broad unit. The selected ledger prioritizes original author material, official framework documentation, and first-party architecture guidance; pattern listicles, template repositories, and universal SOLID/microservice claims were excluded or retained only for terminology.

## Local content map

The complete EN and VI files were read. Structural parity check on 2026-08-23 found four sections and 22 matching item IDs in each language; every item has a non-empty answer.

| Section | Exact item IDs | Local emphasis |
| --- | --- | --- |
| Architecture styles | `12-architecture-patterns.architecture-styles.q1` … `.q4` | Layered, Hexagonal, Clean dependency rule, and choosing a style. |
| Domain-Driven Design | `12-architecture-patterns.domain-driven-design.q1` … `.q4` | Strategic/tactical DDD, use/avoid criteria, CQRS/Event Sourcing. |
| Patterns & principles | `12-architecture-patterns.patterns-principles.q1` … `.q6` | GoF/distributed patterns, SOLID, anti-patterns, coupling/cohesion, modular monolith/microservices, ACL. |
| Clean & layered — building it for real | `12-architecture-patterns.clean-layered-building-it-for-real.q1` … `.q8` | Package structure, domain/JPA separation, use cases, ArchUnit, transactions/validation/mapping, tests, migration, feature packages/Spring Modulith. |

The structure is useful and unusually implementation-oriented. The main risk is teaching pattern names as solutions: “domain does not depend on JPA,” “one service equals one bounded context,” “service boundary equals consistency boundary,” “never share a database,” fixed test-pyramid timings, and “start with a modular monolith” all require scope and counterexamples.

## What is correct and reusable

- Layering reduces the number of directions in which changes can travel; it does not by itself prevent business logic from leaking into controllers, repositories, or framework entities.
- Hexagonal architecture’s driving/driven ports make the application testable without a UI/database and isolate technology adapters. The port is a behavior boundary, not merely an interface for every class.
- Clean/Onion/Hexagonal variants share an inward dependency rule: policy should not depend on details. The useful invariant is compile-time dependency direction and stable domain vocabulary, not concentric diagrams.
- DDD is a communication/modeling approach for domains where language, policy, and invariants are complex. It is not a reason to wrap trivial CRUD in ceremony.
- An aggregate is a consistency/transaction boundary, not necessarily a table or a microservice. Bounded contexts are semantic boundaries; service and database boundaries can be different.
- CQRS is selective separation of read/write models. Event Sourcing stores state transitions as the source representation and adds replay/version/schema/operational costs; neither should be default architecture.
- Coupling and cohesion are design properties to observe through change impact, dependency graphs, ownership, and failure behavior. Avoid invented universal numeric thresholds.
- A modular monolith can provide explicit module ownership, tests, and deployment simplicity. Microservices add independent deployment/scaling/team boundaries but also distributed failure and data-consistency work.
- An anti-corruption layer protects a target model from legacy semantics by translating at the boundary. It is not a synonym for an adapter that merely renames fields.
- Architecture tests are useful only when the rule matches a real boundary and is kept on the delivery path; a large frozen baseline can encode the existing problem.

## Claims to verify or qualify

| Claim from local content | Classification | Evidence | Scope / limitation | Confidence |
| --- | --- | --- | --- | --- |
| Layered architecture is familiar and low-cost but can allow framework seepage, anemic domain logic, and god services. | Inference supported by practice | [S01], [S14], [S15] | These are failure modes, not inevitable outcomes; dependency rules and module ownership can mitigate them. | Medium-high |
| Hexagonal architecture separates driving/driven adapters through ports so the application can run without UI/database. | Verified original design intent | [S01] | Cockburn’s paper is a design proposal, not a framework standard; port granularity is a judgment call. | High |
| Clean/Onion/Hexagonal share inward dependency direction but are not literally identical. | Synthesis / recommendation | [S01], [S02], [S03] | Martin/Evans terminology and implementations vary; avoid presenting one canonical folder tree. | High |
| The dependency rule is more important than concentric folders. | Recommendation supported by ArchUnit practice | [S03], [S12] | A compiler/module system or architecture test must actually enforce it. | High |
| Bounded context is a semantic model boundary, not automatically a deployable service. | Verified DDD guidance | [S04], [S06], [S07] | A service can contain multiple contexts and a context can initially live in a modular monolith. | High |
| “A bounded context usually equals one service and database” / “service boundary equals consistency boundary.” | Over-absolute local simplification | [S04], [S06], [S07], [S14] | Sometimes aligned, often useful, never a definition. Team ownership, transaction boundary, deployment, and data ownership may diverge. | High that qualification is needed |
| Aggregate is a consistency boundary with a root; keep it small and avoid cross-aggregate transactions. | Verified guidance plus recommendation | [S06], [S08], [S09] | “One transaction per aggregate” is a strong default, not a law; some domains require explicit coordination. | High |
| DDD is useful when domain language/invariants are complex and less useful for simple CRUD. | Recommendation | [S04], [S05], [S06] | Complexity and team skill are contextual; a simple-looking domain can still have high compliance risk. | Medium-high |
| CQRS should be applied per bounded context/use case, not to the whole system by default. | Verified guidance | [S10], [S11] | Read model lag, duplicate models, projections, and operational cost must be accepted. | High |
| Event Sourcing gives a history of events suitable for replay/audit. | Verified design property with limits | [S10], [S11], [S25] | It does not automatically provide a legally complete audit trail, immutable truth, easy correction, or privacy deletion. | High |
| Strategy/Factory/Builder/Decorator/Adapter/Observer/Saga/Outbox/CQRS are patterns. | Classification / teaching aid | [S13], [S14], [S15] | A pattern is a context/trade-off, not a component checklist. Saga/Outbox semantics belong to topic 09/15. | High |
| SOLID improves maintainability. | Recommendation, not theorem | [S16], [S17] | Principles can conflict with simplicity/YAGNI; measure change coupling and testability rather than count abstractions. | Medium |
| Microservices enable independent deploy/scale/team ownership but add distributed-system cost. | Verified trade-off | [S14], [S18], [S19] | Benefits require real independence; shared database, synchronous chains, and coordinated releases create a distributed monolith. | High |
| Modular monolith is a useful migration/start option. | Recommendation | [S14], [S20], [S21] | Not universal: regulatory isolation, independent scaling, blast radius, or organization may justify services earlier. | Medium-high |
| ACL translates external/legacy concepts into the target model. | Verified pattern intent | [S22], [S23] | Translation must include semantics, lifecycle, errors, retries, and ownership—not only field mapping. | High |
| Test pyramid timing examples such as 1 ms/5 ms/1 s/10 s are universal. | Unresolved / over-absolute | [S24] supports test-risk layering, not these timings. | Replace numbers with feedback/parallelism/flakiness budgets measured in the repository. | High |
| Spring Modulith can inspect modules and record event publications for retry/recovery. | Provider-specific verified fact | [S26], [S27] | Version and configuration matter; it does not enforce every business boundary or make external delivery exactly once. | High |
| ArchUnit can enforce package/layer/cycle rules from bytecode. | Provider-specific verified fact | [S12] | Tests only enforce declared rules; false positives and baseline drift need governance. | High |

## Workload, invariants, and failure model

| Architectural workload / invariant | Boundary mechanism | Crash / failure window | Recovery / proof obligation |
| --- | --- | --- | --- |
| Business rule must be testable without infrastructure | Domain/application port; adapter outside policy | Framework upgrade or DB replacement leaks types into domain | Compile-time dependency test and domain-only tests remain green without DB/UI. |
| One use case must atomically update owned state | Application transaction around local repository operations | Process dies before commit; external call times out inside transaction | Keep external calls outside the local transaction or use a durable workflow; retry idempotently. |
| Module owns a table/schema | Module API/port; no direct cross-module repository/table access | Another module bypasses boundary; schema migration breaks hidden consumer | Architecture test, ownership metadata, migration contract, and access review. |
| Read model is derived from domain state | Domain/integration event + durable publication/CDC | Commit succeeds, publication delayed/duplicated, projection crashes | Replayable event/CDC, idempotent projection, versioned schema, lag/freshness SLO. |
| Legacy semantics must not contaminate target model | ACL with explicit translation and error mapping | Legacy timeout/partial response; unknown code/value | Retry/dead-letter/manual reconciliation and contract tests; do not pass legacy DTOs inward. |
| Service split is independently deployable | Owned data, API/event contract, bounded sync dependency | Version skew, network partition, deployment mismatch | Backward-compatible contract, timeout/circuit breaker, compatibility window and rollback. |
| Aggregate invariant is protected under concurrency | Aggregate root command + version/lock/constraint | Stale command or optimistic conflict | Return conflict and retry command with idempotency; do not expose mutable entity graph. |
| Architecture rule must survive refactoring | ArchUnit/compiler/Spring Modulith verification | Rule disabled or baseline updated to allow violation | Fail CI, review rule changes, and keep a small documented exception list. |

### Workload model

Choose a style using change and failure dimensions, not “cleaner” diagrams: rate of domain-rule change, number of adapters, transaction scope, expected data ownership, team/module ownership, independent scaling need, latency budget, recovery model, and regulatory/security boundary. A simple CRUD screen with one repository may be layered; a payment authorization with invariants, external providers, and reconciliation may benefit from ports and an explicit application/use-case boundary even when deployed in one process.

## Best-practice comparison

| Style / boundary | Dependency rule | Strength | Failure mode / cost | Suitable evidence |
| --- | --- | --- | --- | --- |
| Conventional layered | Controller → service → repository/detail | Familiar onboarding and fast CRUD delivery | Business logic leaks into framework/service; package-by-layer coupling; god service | Layer dependency checks, change-impact review, service size and integration tests. |
| Hexagonal / ports-adapters | Domain/application inward; adapters implement ports | Testable policy and replaceable I/O; explicit driving/driven edges | Too many ports/indirection; ports mirror tables instead of behavior | Domain tests without adapters; adapter contract tests; dependency graph. |
| Clean/Onion variant | Policy does not depend on details | Clear dependency direction and framework isolation | Folder ceremony, mapping duplication, false purity | Compiler/ArchUnit rule; measure framework leakage and change isolation. |
| Modular monolith | Modules expose APIs/events; internal details hidden | One deployment/local transaction, explicit future service seams | Runtime is still one blast radius; developers can bypass boundaries | Module tests, API ownership, schema access, Spring Modulith/ArchUnit. |
| Microservices | Service owns data/runtime and communicates over network | Independent deploy/scale/failure ownership | Distributed transactions, versioning, observability, network failures | Team/release independence and SLO evidence, not service count. |
| CQRS | Write model and read model optimized separately | Query shape/read scaling and model clarity | Lag, duplicate models, rebuild/backfill and consistency UX | Freshness SLO, projection replay, idempotency, read-model rebuild test. |
| Event Sourcing | Events are state representation | Temporal reconstruction and event-driven model | Schema evolution, replay cost, correction/privacy, event contract | Event versioning, snapshot/replay benchmark, redaction/deletion policy. |

## Coverage matrix

| Required evidence area | Current local coverage | Evidence quality | Proposed treatment |
| --- | --- | --- | --- |
| Definitions | Four architecture styles, DDD, patterns | Broad; names can blur | Define shared core and document variant-specific differences. |
| Invariants | Dependency direction, module ownership, aggregate boundary | Good, but service/BC statements too absolute | Use invariant/transaction/data ownership matrix. |
| Workload | CRUD versus complex booking/payment | Useful examples | Add change rate, adapters, team, scaling, latency, and failure axes. |
| Failure / crash windows | Distributed monolith, Saga/CQRS mentions | Partial | Add local transaction, event publication, projection, service version, and ACL failure windows. |
| Retries / timeouts | Mostly distributed-pattern references | Insufficient | Add deadline, retry, idempotency, circuit-breaker and fallback ownership. |
| Operations / recovery | Migration and Spring Modulith hints | Partial | Add replay/backfill, rollback, module extraction, event registry, and restore drills. |
| Security / privacy | Sparse | Insufficient | Add boundary auth, data minimization, ACL/PII mapping, event redaction and deletion. |
| Testing | ArchUnit, pyramid, Testcontainers | Strong direction, timing numbers risky | Add test contracts per boundary and repository-specific latency/flakiness budgets. |
| Domain trade-offs | DDD/fintech/OTA | Strong but overlaps topic 24 | Keep overview; link detailed context/aggregate examples to topic 24. |

## Contradictions and limits

| Local simplification | Counterexample / limit | Resolution |
| --- | --- | --- |
| “Layered is bad; Clean is good.” | Layered can be adequate and Clean can become ceremony or still leak details. | Evaluate dependency/change/failure evidence, not labels. |
| “Hexagonal means every dependency needs a port.” | A port should represent a meaningful application boundary; wrapping trivial data access can increase noise. | Use ports where policy depends on replaceable or failure-prone I/O. |
| “Bounded context = service + database.” | A context can be a module; a service can contain multiple contexts; shared read models can be deliberately derived. | Treat semantic ownership, transaction scope, deployment, and storage as separate axes. |
| “One transaction must equal one aggregate.” | Cross-aggregate workflows sometimes need explicit coordination or a local transaction around multiple owned records. | Use as default; document exceptions and workflow/reconciliation proof. |
| “Event Sourcing gives perfect audit.” | Events can be buggy, corrected, redacted, incomplete, or operationally unreplayable. | Define audit authority, corrections, retention, privacy, and replay tests. |
| “Microservices remove coupling.” | They replace in-process coupling with API/schema/time/network coupling. | Require independent release/ownership evidence and contract tests. |
| “Start modular monolith.” | Some isolation/blast-radius/regulatory/team constraints can justify services. | Present as a default option with explicit exceptions. |
| “Architecture tests guarantee architecture.” | Tests enforce only the rules written and can be bypassed through reflection, shared DB, or generated code. | Pair tests with ownership/review/runtime evidence. |

## Negative evidence and anti-patterns

- Do not create a controller → service → repository class for every CRUD field when it adds no boundary or behavior.
- Do not expose JPA entities, lazy collections, `EntityManager`, framework annotations, or transport DTOs in domain policy simply to avoid mapping work.
- Do not call a remote service while holding a database transaction; timeout and retry can amplify locks and create distributed partial commits.
- Do not split a service while keeping a shared mutable database, synchronous call chain, coordinated release, and no independent ownership; this is a distributed monolith.
- Do not adopt CQRS/Event Sourcing for a read/write model that has no query/write asymmetry, temporal requirement, or scale/replay justification.
- Do not use a domain event as a promise that an external integration completed; define publication/consumer/retry semantics separately.
- Do not make an ACL a passive DTO mapper if the legacy system has different meanings, states, units, errors, or identity rules.
- Do not freeze a huge ArchUnit baseline and call it enforcement; make new violations fail and keep exceptions explicit.
- Do not use SOLID as a license for speculative interfaces, dependency injection everywhere, or abstractions without a change/failure reason.
- Do not measure test quality by fixed milliseconds; measure feedback time, determinism, coverage of boundary risks, and production-like behavior.

## Operational, security, observability, and testing concerns

- **Operations:** document module/service ownership, deployment dependency graph, event publication/replay, migration/rollback, and who can repair a projection or translate a legacy failure. Track architecture exceptions as expiring decisions.
- **Observability:** preserve correlation/causation IDs across ports, adapters, events, and ACLs; measure transaction duration/lock wait, remote latency/timeouts/retries, event publication lag, projection lag, module boundary violations, and contract failures.
- **Security/privacy:** enforce authorization at use-case boundaries, avoid leaking sensitive domain objects/PII in DTOs/events/logs, define ACL data minimization, and make deletion/retention compatible with CQRS/event history.
- **Testing:** domain property/concurrency tests; application use-case tests with fake ports; adapter contract/integration tests; architecture tests; consumer-driven contracts; projection replay/backfill; migration rollback; and fault injection for timeouts/duplicates.
- **Delivery:** start with a small enforceable dependency rule, then expand. CI should fail on new unwanted dependencies, but exceptions require an owner, reason, expiry, and test.

## Duplicate / canonical ownership

| Subject | Canonical dossier | Boundary |
| --- | --- | --- |
| Detailed bounded contexts, context maps, aggregates, value objects | [24-domain-driven-design.md](24-domain-driven-design.md) | This topic keeps the overview and selection criteria. |
| Distributed transaction, Saga, Outbox, idempotency | [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md) | Link only; do not make architecture-patterns a second workflow dossier. |
| Queue semantics | [08-message-queue.md](08-message-queue.md) | Broker mechanics and consumer behavior live there. |
| Concrete order/outbox case | [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md) | Case study owns sequence/crash details. |
| Query/ORM performance | [18-query-optimization.md](18-query-optimization.md) | Architecture section only states boundary/test implications. |
| Database primitives | [05-db-core-index-lock.md](05-db-core-index-lock.md) | Keep data ownership/invariant bridge. |

## Integration record (Batch H scope)

Batch H integrated `12-architecture-patterns.clean-layered-building-it-for-real.q9` in EN/VI. The item turns architecture fitness functions and ADRs into executable boundary checks, ownership/change-impact evidence, and explicit review triggers; it does not treat a package rule or diagram as proof that the boundary is correct.

The change preserves all existing IDs and cross-references. Saga/Outbox, queue delivery, database primitives, and detailed DDD vocabulary remain owned by Topics 09, 08, 05, and 24 respectively. The remaining version, exception-governance, and target-workload questions stay in this record.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Remaining follow-up changes

1. Rewrite the four style definitions around dependency/change/failure invariants; avoid presenting one folder tree as the architecture.
2. Replace “bounded context = service + dedicated DB” and “service boundary = consistency boundary” with a four-axis comparison: semantic model, transaction, data ownership, deployment.
3. Add explicit event publication/projection crash windows and link Outbox/Saga to topics 08/09/15.
4. Mark CQRS/Event Sourcing as selective; add read-model lag, replay, schema evolution, correction, and privacy deletion obligations.
5. Add a concrete package example with `domain`, `application`, `port.in`, `port.out`, adapters, but state that names are implementation choices.
6. Keep ArchUnit/Spring Modulith practices, but add version and escape-hatch limitations; use exact repository item links rather than textual references such as “12.15.”
7. Replace fixed test timings with measurable repository budgets and a risk-to-test matrix.
8. Add operational/security concerns to every pattern recommendation and retain a migration/strangler path with rollback.
9. Reduce repeated Saga/Outbox definitions and make cross-references canonical in both languages.

## EN/VI and cross-reference plan

Preserve all 22 item IDs, section order, and code identifiers. Translate `driving adapter`, `driven adapter`, `dependency direction`, `bounded context`, `aggregate`, `projection`, `anti-corruption layer`, `modular monolith`, and `strangler migration` consistently. Keep `@ApplicationModuleTest`, ArchUnit rules, package names, and links unchanged. The EN/VI tables must preserve the same qualifications; do not translate “usually” or “default” as an absolute rule.

## Open questions and falsifiers

- What is the actual target stack/version (Java/Spring/Modulith/ArchUnit) and which module boundaries are intended? A package/enforcement recommendation is falsified if the tool/version cannot observe or enforce the chosen boundary.
- Which business invariants need a local transaction, and which can be reconciled asynchronously? The proposed aggregate/module boundary is falsified by a required invariant crossing it without an explicit coordination design.
- Do teams actually deploy/scale/recover modules independently? If not, a microservice split is not justified by the stated benefit.
- What is the required projection freshness, replay time, and privacy deletion SLA? A CQRS/Event Sourcing recommendation is incomplete until these are measurable.
- Which legacy semantics cannot be represented directly in the target model? An ACL design is falsified if it merely copies DTOs and loses units, states, identity, or error meaning.
- What percentage of current dependency violations is expected to remain, and who owns the exceptions? An architecture-test plan is falsified if it cannot make new violations visible without freezing all progress.
- Which fixed test timing numbers in the local content have benchmark evidence? Without repository measurements, they remain unknown and should be removed.

## Sources

Source ledger. Tier `T1` = original paper/primary author; `T2` = official framework/project documentation; `T3` = first-party engineering/reference material. All entries reviewed on 2026-08-23. Pattern roundups and secondary explainers were used only to find terminology and were not used as evidence when primary material was available.

| ID | URL / title | Organization | Tier | Version / revision | Claims supported |
| --- | --- | --- | --- | --- | --- |
| S01 | [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) | Alistair Cockburn | T1 | Original article, 2005 | Ports/adapters, driving/driven sides, testing without UI/DB. |
| S02 | [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | Robert C. Martin | T1/T3 | Author article, 2012 | Dependency rule and policy/details separation; not a formal standard. |
| S03 | [Onion Architecture](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) | Jeffrey Palermo | T3 | Author series, 2008 | Onion variant and dependency direction. |
| S04 | [DDD Reference](https://www.domainlanguage.com/ddd/reference/) | Eric Evans / Domain Language | T1 | Maintained reference reviewed 2026-08-23 | Ubiquitous Language, bounded context, aggregate/core-domain vocabulary. |
| S05 | [DDD Overview](https://www.domainlanguage.com/training/ddd-overview/) | Eric Evans / Domain Language | T1/T3 | First-party training material | Strategic DDD and model complexity/communication. |
| S06 | [Domain Model for Microservices](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-domain-model) | Microsoft | T2 | .NET architecture guide, reviewed 2026-08-23 | Entity/value object/aggregate and CRUD exception. |
| S07 | [Strategic DDD and Domain Analysis](https://learn.microsoft.com/en-nz/azure/architecture/microservices/model/domain-analysis) | Microsoft | T2 | Azure Architecture Center, reviewed 2026-08-23 | Bounded contexts, context maps, relationship types. |
| S08 | [Tactical DDD](https://learn.microsoft.com/en-ca/azure/architecture/microservices/model/tactical-ddd) | Microsoft | T2 | Azure Architecture Center, reviewed 2026-08-23 | Aggregate boundaries, value objects, domain services/events. |
| S09 | [Aggregate Design](https://martinfowler.com/bliki/DDD_Aggregate.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | Aggregate root and transaction-boundary teaching guidance. |
| S10 | [CQRS](https://martinfowler.com/bliki/CQRS.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | Selective/per-context CQRS and complexity/eventual consistency. |
| S11 | [Domain Events Design and Implementation](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation) | Microsoft | T2 | .NET architecture guide | Domain versus integration events and transaction/handler scope. |
| S12 | [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html) | ArchUnit project | T2 | Current user guide | Bytecode dependency, layer, cycle, and rule enforcement. |
| S13 | [Design Patterns](https://refactoring.guru/design-patterns) | Secondary terminology reference | T4 | Reviewed 2026-08-23 | Used only for names; not used for guarantees. |
| S14 | [Microservices](https://martinfowler.com/articles/microservices.html) | Martin Fowler | T3 | First-party article, 2014 | Independent deployment, service trade-offs, evolutionary architecture. |
| S15 | [Yet Another Optimization Article](https://martinfowler.com/ieeeSoftware/yetOptimization.pdf) | Martin Fowler | T3 | IEEE Software article | Measure-before-optimization principle; not used for timing constants. |
| S16 | [The Principles of OOD](https://web.archive.org/web/20200101000000/https://www.objectmentor.com/resources/articles/srp.pdf) | Robert C. Martin / Object Mentor | T3 | Archived author material | SOLID/SRP terminology; archived and limited evidence. |
| S17 | [Agile Principles, Patterns, and Practices](https://www.pearson.com/en-us/subject-catalog/p/agile-principles-patterns-and-practices-in-c/P200000003285) | Pearson / Robert C. Martin | T3 | Book catalog, reviewed 2026-08-23 | SOLID as guidance, not a formal guarantee. |
| S18 | [Modular Monoliths](https://martinfowler.com/articles/modular-monolith.html) | Martin Fowler | T3 | First-party article, reviewed 2026-08-23 | Modular monolith boundaries and extraction trade-offs. |
| S19 | [Microservices Architecture Style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices) | Microsoft | T2 | Azure Architecture Center, current docs | Service independence, data ownership, distributed cost. |
| S20 | [Spring Modulith Reference](https://docs.spring.io/spring-modulith/reference/index.html) | Spring | T2 | Spring Modulith 2.1 docs, reviewed 2026-08-23 | Functional modules, module detection and application structure. |
| S21 | [Spring Modulith Events](https://docs.spring.io/spring-modulith/reference/events.html) | Spring | T2 | Spring Modulith 2.1 docs | Publication registry, retries, event externalization/testing scope. |
| S22 | [Anti-Corruption Layer](https://microservices.io/patterns/refactoring/anti-corruption-layer.html) | Chris Richardson / microservices.io | T3 | Pattern reference, reviewed 2026-08-23 | ACL intent and translation boundary. |
| S23 | [Context Mapping](https://www.domainlanguage.com/ddd/reference/#context-mapping) | Eric Evans / Domain Language | T1 | DDD Reference anchor | Context relationship and translation ownership. |
| S24 | [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) | Martin Fowler | T3 | First-party article, 2012 | Relative test scope/feedback trade-off; not fixed runtimes. |
| S25 | [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) | Martin Fowler | T3 | First-party article, reviewed 2026-08-23 | Event history/replay and operational/privacy limitations. |
| S26 | [Spring Modulith Application Modules](https://docs.spring.io/spring-modulith/reference/fundamentals.html) | Spring | T2 | Spring Modulith 2.1 docs | Module boundaries and verification. |
| S27 | [Spring Modulith Testing](https://docs.spring.io/spring-modulith/reference/testing.html) | Spring | T2 | Spring Modulith 2.1 docs | Module-focused integration tests. |
| S28 | [Strangler Fig Application](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html) | AWS | T2 | Current Prescriptive Guidance | Incremental migration and coexistence. |
| S29 | [A Note on the History of Structuring Systems](https://www.cs.lafayette.edu/~gexia/cs301/resources/parnas.html) | David Parnas | T1 | 1972 paper/reprint | Information hiding and independent module change. |
| S30 | [Modular Monoliths Research](https://arxiv.org/abs/2401.11867) | Academic authors | T1/T3 | arXiv 2024, reviewed 2026-08-23 | Research triangulation; not treated as universal evidence. |
| S31 | [Application Architecture Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/) | Microsoft | T2 | Azure Architecture Center, current | Pattern trade-off catalog; individual pages used only where scoped. |

## Discovery exclusions

Excluded candidates were pattern-name listicles, “Clean Architecture folder template” repositories without an architectural contract, SOLID claims presented as laws, and microservice vendor pages that counted services rather than independent ownership/recovery. A few secondary pattern pages were retained only to confirm terminology; they do not support guarantees.
