# Research — Domain-Driven Design: bounded contexts and tactical models

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `24-domain-driven-design`
EN file: `public/data/topics/24-domain-driven-design.json`
VI file: `public/data/topics/24-domain-driven-design.vi.json`

## Scope and non-goals

This record audits the local DDD deep dive: Ubiquitous Language, bounded contexts, context maps, EventStorming, entities, value objects, aggregates, domain/integration events, repositories, factories, and domain services. It owns DDD vocabulary and modeling decisions.

The architecture-pattern overview and code-organization guidance belong to [12-architecture-patterns.md](12-architecture-patterns.md). Distributed workflow correctness, Outbox, Saga, idempotency, and ledgers belong to [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md) and [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md). Database lock/index mechanics belong to [05-db-core-index-lock.md](05-db-core-index-lock.md). DDD is a modeling approach, not a requirement to use microservices, event sourcing, or a particular framework.

Evidence-policy note: a discovery ceiling of 200 candidates was available for this broad modeling unit. The selected ledger prioritizes Evans/Brandolini primary material, official architecture guidance, original pattern references, and implementation documentation; “DDD in five minutes,” fixed workshop-color charts, and service-count advocacy were excluded.

## Local content map

The complete EN and VI files were read. Structural parity check on 2026-08-23 found two sections and eight matching item IDs in each language; every item has a non-empty answer.

| Section | Exact item IDs | Local emphasis |
| --- | --- | --- |
| Strategic — splitting the domain | `24-domain-driven-design.strategic-splitting-the-domain.q1` … `.q4` | DDD/Ubiquitous Language, bounded contexts, context mapping, EventStorming. |
| Tactical — modelling it | `24-domain-driven-design.tactical-modelling-it.q1` … `.q4` | Entity/value object, aggregate boundary, domain/integration events, repository/factory/domain service. |

The local outline has the right sequence: discover language and boundaries before choosing tactical constructs. It must more strongly state that DDD patterns are hypotheses validated with domain experts and production invariants. “Aggregate = transaction boundary,” “domain event = integration event,” fixed EventStorming colors, and “repository = collection” need scope and counterexamples.

## What is correct and reusable

- DDD addresses complexity in the domain model and communication, not generic CRUD or the mere presence of a database.
- Ubiquitous Language is local to a bounded context. The same word can intentionally mean different things in two contexts; forcing one enterprise-wide model can create ambiguity.
- A bounded context is a boundary within which a model and its language are consistent. It may be a module, service, or part of a larger deployment; deployment is a later choice.
- Context maps describe relationships and translation/ownership between contexts. They are not just a topology diagram.
- EventStorming is a collaborative domain-discovery workshop with domain experts and delivery people; it is a facilitation method, not a formal standard with one mandatory color scheme.
- Entities are defined by identity and lifecycle; value objects by value semantics and usually immutability. A value object can carry validation/invariants, not merely be a primitive wrapper.
- Aggregates protect invariants through a root and establish a useful transaction/consistency boundary. Smaller aggregates reduce contention and coordination, but cross-aggregate consistency may need an explicit workflow.
- Domain events describe meaningful state changes in the domain. Integration events are external contracts; they often need versioning, serialization, delivery, retry, and publication-after-commit semantics.
- Repositories abstract collection-like access to aggregates; factories make complex invariant-preserving creation explicit; domain services hold domain operations that do not naturally belong to one entity/value object. These are tools, not mandatory interfaces for every table.

## Claims to verify or qualify

| Claim from local content | Classification | Evidence | Scope / limitation | Confidence |
| --- | --- | --- | --- | --- |
| DDD focuses on domain complexity, language, and model collaboration. | Verified primary-author intent | [S01], [S02], [S11] | DDD is not a guarantee of better architecture; it requires domain participation and iteration. | High |
| Ubiquitous Language is shared within a bounded context. | Verified DDD guidance | [S01], [S02], [S07], [S12] | “Shared” means actively maintained in conversations/code/tests; it need not be globally identical. | High |
| A bounded context is a consistent model boundary. | Verified concept | [S01], [S07], [S12] | It is semantic/ownership scope, not automatically a service/database. | High |
| Context maps model relationships such as partnership, customer/supplier, conformist, or translation. | Verified DDD vocabulary | [S01], [S07], [S12] | Relationship names are useful only when they describe actual power, contract, and translation behavior. | High |
| EventStorming uses collaborative timelines and domain experts to discover events/boundaries. | Verified method description with facilitation scope | [S03], [S04], [S05] | The workshop is intentionally adaptable; official materials do not make one fixed color palette a universal standard. | High |
| Entity identity/lifecycle differs from value-object equality. | Verified DDD guidance | [S01], [S06], [S08] | Implementation may use immutable records/value types or mutable entities; persistence mapping is separate. | High |
| “Value objects should be immutable.” | Strong recommendation, not language law | [S06], [S08], [S14] | Immutability simplifies reasoning; the target language/framework may represent it differently. | Medium-high |
| Aggregate root protects invariants and is a useful transaction boundary. | Verified guidance plus recommendation | [S01], [S06], [S09], [S10] | The one-aggregate transaction default has exceptions; it is not a requirement that every aggregate map to one table/service. | High |
| Smaller aggregates reduce contention and make consistency explicit. | Recommendation/inference | [S06], [S09], [S10] | Too-small aggregates can scatter an invariant or create excessive workflows; validate with domain scenarios. | High |
| Domain events and integration events are different concepts. | Verified implementation guidance | [S06], [S13], [S16] | A system may implement both with the same internal type, but external schema/guarantees still need a boundary. | High |
| “Publish the domain event to Kafka directly in the transaction.” | Anti-pattern unless contract proves it | [S13], [S16], [S17] | External publication can fail/duplicate; use an outbox/transactional publication mechanism when atomicity with state matters. | High |
| Repository is an abstraction of a collection of aggregates. | Verified DDD vocabulary | [S01], [S06], [S12] | It should expose domain/use-case behavior, not become a generic query dump; read models may use a separate query port. | High |
| Factory encapsulates complex creation and protects invariants. | Verified DDD vocabulary | [S01], [S06], [S08] | Simple constructors/builders can be enough; a factory is not required for every entity. | High |
| Domain service holds domain logic that does not naturally fit one entity/value object. | Verified DDD vocabulary | [S01], [S06], [S08] | Avoid using it as a “miscellaneous service” for application orchestration or infrastructure calls. | High |
| DDD requires microservices or event sourcing. | False / anti-pattern | [S01], [S07], [S11], [S15] | DDD can guide a modular monolith and a relational model; deployment/event storage are separate decisions. | High |
| Event Sourcing is implied by using domain events. | False / anti-pattern | [S15], [S16] | Domain events can be transient/in-process or published from a normal state store; Event Sourcing is a distinct persistence choice. | High |
| Domain boundaries can be discovered from nouns/organizational chart alone. | Unresolved / weak heuristic | [S01], [S07], [S12] | Language, invariants, ownership, change cadence, and workflow scenarios are stronger evidence. | High |

## Workload, invariants, and failure model

| Modeling problem / invariant | DDD mechanism | Crash / failure window | Recovery / proof obligation |
| --- | --- | --- | --- |
| “Booking” means different things to search, inventory, and payment | Separate bounded-context models and context map | Translation/contract changes make one context interpret another’s event incorrectly | Version contract, explicit translation, consumer contract tests, and reconciliation owner. |
| Aggregate invariant must hold at command time | Aggregate root command with local transaction/version/constraint | Concurrent stale command; optimistic conflict; process dies before commit | Reject/retry full command with idempotency; test concurrent commands and error semantics. |
| Entity identity survives state changes | Entity identity and lifecycle rules | Duplicate creation after timeout/retry | Natural/technical identity plus uniqueness/idempotency constraint; define resurrection/merge semantics. |
| Value object must never be invalid | Constructor/factory validation and immutable value semantics | Deserialization/migration bypasses constructor | Validate at boundary and persistence migration; property tests for normalization/equality. |
| Cross-aggregate workflow eventually completes | Domain/integration event + process manager/Saga/Outbox | State commits but event publication/consumer fails or duplicates | Durable publication, idempotent consumers, retry/DLQ/reconciliation; topic 09/15 owns workflow details. |
| Legacy partner model must not corrupt domain language | ACL and anti-corruption translation | Unknown code, timeout, partial response, semantic drift | Version mapping, quarantine/manual review, metrics and contract tests; never pass raw legacy DTO inward. |
| Read model uses different query shape | Separate query model/port or CQRS | Projection lags or fails after source commit | Watermark/freshness UX, replay/backfill, deterministic IDs, deletion/tombstone policy. |
| Domain expert and developer mean different words | Ubiquitous Language glossary/examples/tests | Terminology drifts during feature work | Review glossary with scenarios and acceptance tests; measure unresolved terms and model changes. |

### Domain-to-boundary heuristic

For each candidate boundary ask: Which terms change meaning? Which invariants must be atomic? Which team owns the decision? Which workflow crosses it? How often does each side change? What failure/freshness contract is acceptable? A boundary is stronger when these answers align; a table/entity count or service-count target is weak evidence.

## Best-practice comparison

| Concept | Primary question | Good fit | Negative signal | Evidence / test |
| --- | --- | --- | --- | --- |
| Ubiquitous Language | Do experts and code use the same meaning? | Complex policy and recurring ambiguity | Glossary is a noun list nobody uses | Scenario review, code/test names, unresolved-term log. |
| Bounded Context | Where is one model internally consistent? | Different meanings/invariants/ownership | Boundary drawn only by deployment or org chart | Context map, translation contract, change-impact evidence. |
| Entity | Does identity/lifecycle matter over time? | Account, booking, shipment, payment attempt | Value is immutable and identity irrelevant | Identity/equality/lifecycle tests. |
| Value Object | Is value equality plus invariant the meaning? | Money, address, date range, currency, PNR format | Primitive obsession or mutable shared value | Immutable construction/property/equality tests. |
| Aggregate | What must be consistent together? | Small invariant cluster commanded through root | Unbounded graph, cross-service transaction, high contention | Concurrent command tests, transaction/lock/version evidence. |
| Domain Event | What meaningful domain fact changed? | In-process policy reaction, audit candidate, integration input | Event merely mirrors CRUD row update | Event naming/payload review and invariant scenario. |
| Integration Event | What external contract should another context consume? | Async collaboration/projection/workflow | Leaks internal entity/DB schema | Versioned schema, compatibility, idempotency/replay tests. |
| Repository | How does a use case load/save an aggregate? | Aggregate collection abstraction | Generic `findAll`/query dump or cross-context joins | Port contract and adapter integration test. |
| Factory | What creation logic is nontrivial or invariant-heavy? | Complex aggregate/value construction | One-line constructor wrapper | Invalid-input and creation invariant tests. |
| Domain Service | What domain operation spans objects without natural owner? | Pure domain calculation/collaboration | Application orchestration, HTTP/DB calls, miscellaneous logic | Pure unit/property tests and dependency check. |
| EventStorming | What events, commands, policies, actors, and boundaries exist? | Early discovery with mixed expertise | Treating a workshop as final architecture | Decision log, scenario validation, revisit after implementation. |

## Coverage matrix

| Required evidence area | Current local coverage | Evidence quality | Proposed treatment |
| --- | --- | --- | --- |
| Definitions | Strategic/tactical DDD vocabulary | Strong | Add semantic versus deployment distinction to each definition. |
| Invariants | Aggregate/value object/identity intent | Good but qualitative | Add invariant statement, owner, transaction, version/constraint, and failure response. |
| Workload | Domain modeling examples | Moderate | Add complexity/change/team/latency/freshness dimensions. |
| Failure / crash windows | Event/publication concerns implied | Partial | Add stale command, duplicate event, projection lag, ACL timeout, and migration windows. |
| Retries / timeouts | Mostly cross-reference | Insufficient | Link 09/15 and state idempotency/deadline boundary for DDD commands. |
| Operations / recovery | Sparse | Insufficient | Add replay, reconciliation, glossary/model migration, event schema, and projection recovery. |
| Security / privacy | Sparse | Insufficient | Add PII minimization in aggregates/events, authorization at commands, deletion/redaction policy. |
| Testing | Unit/scenario direction | Partial | Add property/concurrency, contract, adapter, replay, migration, and language-consistency tests. |
| Domain trade-offs | Core of topic | Strong but needs evidence discipline | Treat boundaries and aggregate sizes as hypotheses validated with experts/production. |

## Contradictions and limits

| Local simplification | Counterexample / limit | Resolution |
| --- | --- | --- |
| Every context should become a service/database | Modular monolith can preserve semantic boundaries with simpler local transactions; one service may contain multiple contexts. | Choose deployment after semantic/ownership/failure evidence. |
| Aggregate equals one table | An aggregate can span tables or be persisted as a document; a table can serve a read model. | Define invariant boundary first, then map persistence. |
| One transaction per aggregate always | Some local workflows require multiple owned records; cross-aggregate process coordination can be correct. | Treat as default and document exceptions with proof/reconciliation. |
| Domain event equals Kafka event | In-process domain event and external integration contract have different delivery/schema guarantees. | Name them separately; publish after commit through a durable mechanism when needed. |
| EventStorming colors are a standard | Facilitators adapt formats/colors; the useful output is shared understanding and scenarios. | Preserve color legend as local convention, not universal fact. |
| Value objects are only immutable data classes | They also encode value semantics/validation; implementation language may use records or constrained types. | Test equality/normalization/invariants, not annotations. |
| Repository should expose every query | Query models and reporting paths may need direct read ports; generic repositories hide expensive access patterns. | Keep aggregate repository narrow and use explicit query ports. |
| DDD is always worth the ceremony | Simple CRUD/low-risk domains may benefit more from a straightforward model. | Use complexity and change risk as entry criteria. |

## Negative evidence and anti-patterns

- Do not call a package a bounded context because it has a name; demonstrate distinct language, invariants, ownership, and translation.
- Do not split one aggregate into many entities merely to make classes smaller if the invariant can be violated between them.
- Do not put the entire object graph inside an aggregate; unbounded loading and cross-aggregate transaction coupling are failure signals.
- Do not use “domain service” as a dumping ground for application orchestration, repositories, HTTP clients, or framework logic.
- Do not create a repository for every table or expose `findAll` across a context without a use-case/result-shape reason.
- Do not serialize JPA entities or internal aggregates as integration events; define an external contract and version it.
- Do not emit integration messages before the source transaction commits unless the design explicitly handles rollback/compensation.
- Do not make EventStorming a one-day ceremony with no decision log, scenario tests, or domain-expert follow-up.
- Do not use Event Sourcing solely to obtain an audit trail; legal/audit requirements include retention, correction, access, redaction, and evidentiary controls.
- Do not claim a bounded context is “correct” until concurrency, failure, translation, and model-change scenarios have been tested.

## Operational, security, observability, and testing concerns

- **Operations:** version context contracts and mappings; assign owners for aggregates, events, projections, ACLs, glossary, and reconciliation. Keep model/schema migration and replay runbooks.
- **Observability:** emit command/context/aggregate identifiers, causation/correlation IDs, version/conflict outcomes, event publication/projection lag, ACL translation errors, retries/DLQ, and reconciliation age without logging sensitive domain payloads.
- **Security/privacy:** authorize commands at application boundaries; minimize PII in aggregates/events; encrypt/protect event stores and projections; define deletion/redaction/tombstone behavior for immutable-looking history and backups.
- **Testing:** domain example/property tests; aggregate concurrency/version tests; repository/adapter integration tests; event schema/consumer contract tests; replay/idempotency/duplicate tests; ACL mapping and unknown-code tests; migration and projection rebuild tests.
- **Team practice:** record disputed terms and boundary decisions. Revisit contexts when business language or invariants change; DDD models are living artifacts, not one-time diagrams.

## Duplicate / canonical ownership

| Subject | Canonical dossier | Boundary |
| --- | --- | --- |
| Architecture styles/package/enforcement/modular monolith | [12-architecture-patterns.md](12-architecture-patterns.md) | This topic supplies detailed DDD vocabulary and modeling tests. |
| Database lock/optimistic version mechanics | [05-db-core-index-lock.md](05-db-core-index-lock.md) | This topic names aggregate boundaries; DB topic owns provider mechanics. |
| Saga/Outbox/idempotency/ledger | [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md) | Use one canonical workflow definition. |
| Concrete order workflow | [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md) | Case study owns end-to-end sequence and crash windows. |
| Queue/event delivery | [08-message-queue.md](08-message-queue.md) | This topic distinguishes domain/integration semantics only. |
| Query/read model optimization | [18-query-optimization.md](18-query-optimization.md) | DDD may motivate a read model; performance mechanics live there. |

## Integration record (Batch H scope)

Batch H integrated `24-domain-driven-design.tactical-modelling-it.q5` in EN/VI. The item adds an executable boundary worksheet connecting language, owner, invariant, transaction authority, context relationship, failure, evolution, and production evidence. It explicitly distinguishes a model or workshop artifact from a tested boundary.

Topic 12 owns architecture style and enforcement; Topic 09 owns Outbox/Saga/idempotency; Topic 05 owns database locking/version mechanics; Topic 08 owns broker delivery. The new item links those owners instead of duplicating their mechanisms. Domain-specific aggregate size, privacy, replay, and freshness remain workload questions.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Remaining follow-up changes

1. Make semantic context boundaries explicitly independent from service/database boundaries; remove any “usually equals” teaching shortcut.
2. Add a boundary worksheet: language, invariants, owner, change cadence, workflow, consistency, failure, and translation.
3. Add aggregate command/concurrency examples and distinguish local DB transaction, optimistic version, constraint, and cross-aggregate workflow.
4. Separate domain events, integration events, and Event Sourcing; link Outbox/Saga to 09/15 rather than repeating definitions.
5. Qualify EventStorming colors/format as facilitation convention and retain the domain-expert validation step.
6. Add repository/query-port boundaries, factory/domain-service anti-patterns, and persistence mapping tests.
7. Add event/projection/ACL operational recovery, privacy/deletion, observability, and replay requirements.
8. Preserve all exact IDs and update EN/VI together; replace ambiguous textual cross-references with dossier/item links.

## EN/VI and cross-reference plan

Preserve all eight IDs and section order. Translate `Ubiquitous Language`, `bounded context`, `context map`, `aggregate root`, `value object`, `domain event`, `integration event`, `repository`, `factory`, `domain service`, `anti-corruption layer`, `replay`, and `reconciliation` consistently. Keep event names, IDs, code terms, and links unchanged. Both languages should explicitly label deployment/transaction claims as recommendations or scope-limited facts.

## Open questions and falsifiers

- Which domain experts/teams own each term, invariant, and context? A proposed boundary is falsified if no accountable owner can validate its language and failure behavior.
- Which invariant must be atomic, and what is the observed contention/volume? An aggregate boundary is falsified if it cannot protect the invariant or creates unacceptable contention.
- What model changes cross contexts, and what translation/versioning policy handles them? A context map is incomplete if it has arrows but no contract, owner, or compatibility test.
- What is the acceptable event/projection freshness, replay time, and deletion SLA? An integration-event/read-model design is falsified by an unrecoverable or privacy-incompatible projection.
- Does the system actually need temporal reconstruction, or only a normal audit record? Event Sourcing remains unjustified unless replay/correction/privacy/storage costs are accepted.
- Which EventStorming outputs were validated by domain experts after implementation? A workshop-only model is falsified by recurring terminology disputes or scenario failures.
- Which repository/factory/domain-service abstractions reduce change coupling in measured code? If an abstraction adds mapping/indirection without protecting a boundary, remove it.

## Sources

Source ledger. Tier `T1` = original author/primary DDD material; `T2` = official architecture/framework documentation; `T3` = first-party technical reference. All entries reviewed on 2026-08-23. Secondary material was used only for triangulation/terminology, not to establish universal guarantees.

| ID | URL / title | Organization | Tier | Version / revision | Claims supported |
| --- | --- | --- | --- | --- | --- |
| S01 | [DDD Reference](https://www.domainlanguage.com/ddd/reference/) | Eric Evans / Domain Language | T1 | Maintained reference reviewed 2026-08-23 | DDD vocabulary: model, language, context, aggregate, repository, factory/service. |
| S02 | [DDD Overview](https://www.domainlanguage.com/training/ddd-overview/) | Eric Evans / Domain Language | T1/T3 | First-party training material | Strategic modeling, collaboration, context maps. |
| S03 | [EventStorming](https://www.eventstorming.com/) | Alberto Brandolini / EventStorming | T1/T3 | Official site reviewed 2026-08-23 | Collaborative workshop purpose and adaptable format. |
| S04 | [EventStorming Book](https://www.eventstorming.com/book/) | Alberto Brandolini | T1/T3 | Official book page, reviewed 2026-08-23 | Workshop history and facilitation scope. |
| S05 | [EventStorming at Avanscoperta](https://www.avanscoperta.it/en/eventstorming/) | Avanscoperta | T3 | First-party training page | Format variants and no fixed universal process claim. |
| S06 | [Tactical DDD](https://learn.microsoft.com/en-ca/azure/architecture/microservices/model/tactical-ddd) | Microsoft | T2 | Azure Architecture Center, reviewed 2026-08-23 | Entity/value object/aggregate/domain service/event guidance. |
| S07 | [Strategic DDD and Domain Analysis](https://learn.microsoft.com/en-nz/azure/architecture/microservices/model/domain-analysis) | Microsoft | T2 | Azure Architecture Center | Bounded contexts, context maps, relationship patterns. |
| S08 | [Domain Model for Microservices](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-domain-model) | Microsoft | T2 | .NET Architecture guide | Aggregate/entity/value object and CRUD exception. |
| S09 | [DDD Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | Aggregate root/transaction-boundary teaching material. |
| S10 | [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | Context/model/language boundary terminology. |
| S11 | [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | Complexity/strategic-tactical framing. |
| S12 | [Context Mapping Reference](https://www.domainlanguage.com/ddd/reference/#context-mapping) | Eric Evans / Domain Language | T1 | DDD Reference anchor | Context relationships and translation boundary. |
| S13 | [Domain Events Design and Implementation](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation) | Microsoft | T2 | .NET Architecture guide | Domain versus integration event, transaction/handler behavior. |
| S14 | [Value Object](https://martinfowler.com/bliki/ValueObject.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | Value equality/immutability semantics. |
| S15 | [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) | Martin Fowler | T3 | First-party article, reviewed 2026-08-23 | Event history/replay and operational/privacy limitations. |
| S16 | [Event Narrative](https://martinfowler.com/eaaDev/EventNarrative.html) | Martin Fowler | T3 | First-party article, reviewed 2026-08-23 | Event-sourced history/correction trade-offs. |
| S17 | [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html) | Chris Richardson / microservices.io | T3 | Pattern reference reviewed 2026-08-23 | Atomic state/publication boundary and duplicate consumer warning. |
| S18 | [Anti-Corruption Layer](https://microservices.io/patterns/refactoring/anti-corruption-layer.html) | Chris Richardson / microservices.io | T3 | Pattern reference | Translation/protection of model boundary. |
| S19 | [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html) | Martin Fowler | T3 | EAA catalog | Repository collection abstraction and domain boundary. |
| S20 | [Factory](https://martinfowler.com/eaaCatalog/abstractFactory.html) | Martin Fowler | T3 | EAA catalog | Factory vocabulary; used as triangulation, not a required pattern. |
| S21 | [Domain Service](https://martinfowler.com/eaaCatalog/serviceLayer.html) | Martin Fowler | T3 | EAA catalog | Service-layer/domain-operation terminology; scope caveat. |
| S22 | [CQRS](https://martinfowler.com/bliki/CQRS.html) | Martin Fowler | T3 | Bliki, reviewed 2026-08-23 | CQRS selective/per-context and eventual consistency cost. |
| S23 | [Saga Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga.html) | AWS | T2 | Current Prescriptive Guidance | Cross-context compensation boundary; link only, canonical detail in topic 09. |
| S24 | [Spring Modulith Events](https://docs.spring.io/spring-modulith/reference/events.html) | Spring | T2 | Spring Modulith 2.1 docs | Transactional publication registry/retry/testing implementation example. |
| S25 | [Spring Modulith Application Modules](https://docs.spring.io/spring-modulith/reference/fundamentals.html) | Spring | T2 | Spring Modulith 2.1 docs | Module boundaries and verification. |
| S26 | [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html) | ArchUnit project | T2 | Current user guide | Compile/bytecode architecture enforcement. |
| S27 | [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Provider mechanics for aggregate concurrency examples. |
| S28 | [Hibernate Optimistic Locking](https://docs.hibernate.org/orm/current/userguide/html_single/Hibernate_User_Guide.html#locking) | Hibernate project | T2 | Current guide, reviewed 2026-08-23 | Version checks and stale aggregate update behavior. |
| S29 | [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html) | IETF | T1 | May 2024 | Identity format/security only when domain examples use UUIDs. |
| S30 | [CloudEvents Specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) | CNCF CloudEvents | T1/T2 | Current specification reviewed 2026-08-23 | External event envelope/metadata terminology; not a domain-model standard. |
| S31 | [Eventuate Tram Outbox](https://eventuate.io/docs/manual/eventuate-tram/latest/getting-started.html) | Eventuate / Chris Richardson | T3 | First-party implementation docs | Implementation triangulation for outbox publication/retry, not universal delivery. |

## Discovery exclusions

Excluded candidates were “DDD in five minutes” posts, fixed EventStorming color charts presented as standards, generic entity/DTO tutorials, microservice vendor material that equated contexts to services, and event-sourcing advocacy without privacy/replay/correction analysis. The primary DDD references and Microsoft/Fowler material were retained; implementation pages are explicitly labelled as examples, not definitions.
