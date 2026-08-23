# Batch H research dossier: architecture boundaries, LLD correctness, Java concurrency, DDD, and mobile choice

Status: `INTEGRATED`

Reviewed: 2026-08-23

Scope: Topics 12, 22, 23, 24 and Case Study 06

This dossier consolidates the overlap between architecture patterns, low-level design, Java concurrency exercises, DDD vocabulary, and the historical Tiki React Native decision. The goal is to make the invariant and ownership boundary explicit so the same Saga, lock, cache, event or framework discussion is not copied into five pages.

## Executive thesis

Patterns are names for trade-offs, not proof. A boundary is credible only when its semantics, invariant, owner, failure model, and executable check agree. The correct question is not whether a codebase has Clean folders, an Aggregate class, a `ConcurrentHashMap`, or a cross-platform framework; it is whether the chosen boundary makes invalid states harder to represent and recovery observable.

The batch makes five decisions:

| Area | Canonical decision | What it does not claim |
| --- | --- | --- |
| Architecture | Fitness functions and ADRs protect a boundary over time; package layout alone does not. | A passing ArchUnit/Spring Modulith rule proves business boundaries are correct. |
| LLD | TTL/cache, limiter, and object-model exercises must specify time, ownership, scope, complexity, replacement races, and test proof. | O(1) map operations imply a correct workflow or distributed guarantee. |
| Java concurrency | Async fan-out needs bounded admission, deadlines, cancellation semantics, executor ownership, and failure policy. | Future timeout, virtual threads, or a semaphore automatically stop external work. |
| DDD | Context, aggregate, event, repository and service terms are useful only when tied to language, invariant, owner and recovery. | A bounded context equals a service/database or an event equals Kafka. |
| Mobile choice | The Tiki article is a dated, first-party decision record for a mixed native/cross-platform app. | React Native, Flutter, or native is universally best today. |

## Evidence classes

| Class | Evidence | Wording rule |
| --- | --- | --- |
| Original design intent | Cockburn Hexagonal, Martin Clean, Evans DDD, GoF patterns | Describe the intent and acknowledge implementation judgment. |
| API/specification contract | JLS, Java SE concurrency APIs, HTTP/RFC, Redis/Caffeine/Android docs | Name the API/provider/version and do not extend a local contract into a system guarantee. |
| Engineering recommendation | Fitness functions, aggregate sizing, fake clocks, bounded fan-out, ACL | State the invariant, cost, failure mode and a falsifier. |
| Historical first-party case | Tiki React Native/mobile architecture article | Preserve date, team/ecosystem context, source boundary and missing measurement metadata. |

## Boundary and failure matrix

| Boundary | Invariant | Failure window | Required evidence |
| --- | --- | --- | --- |
| Architecture module | A module's internals are not imported or persisted through by another module. | New code bypasses the public API; an exception becomes permanent. | Architecture test, small named exceptions, owner and change-impact review. |
| Aggregate | Commands cannot leave the aggregate invariant false after commit. | Stale command, concurrent update, aggregate too large or too small. | Scenario/property/concurrency test, version/constraint/transaction evidence. |
| Context | One model and language is internally coherent; translation is explicit at the edge. | Same term changes meaning, legacy code leaks units/states, contract evolves incompatibly. | Glossary owner, context map, ACL/contract tests, compatibility window. |
| TTL cache | An expired value is never returned; cleanup may be delayed without changing validity. | Wall clock jumps; old cleanup deletes a replacement; cold keys leak memory. | Monotonic/injected clock, generation compare-and-remove, fake-time/property tests. |
| Async fan-out | Child work respects the parent budget and does not outlive its owner unexpectedly. | Timeout completes a future while I/O continues; unbounded queue exhausts a dependency. | Deadline/cancellation/close test, queue/permit metrics, executor shutdown test. |
| Mobile module | A module can be released, navigated, authorized, tested and rolled back under its declared runtime. | Native dependency/version drift, unsafe bridge/WebView, lifecycle duplicate, low-end device failure. | Device-tier telemetry, module contract, release artifact test, hostile WebView/bridge test. |

## Canonical ownership and duplication map

| Mechanism | Canonical owner | Batch H boundary |
| --- | --- | --- |
| Database locks, constraints, MVCC, optimistic version | Topic 05 | DDD/LLD name the invariant and required proof; provider mechanics remain in Topic 05. |
| Saga, Outbox, idempotency and ledger workflow | Topic 09; Case 15 for the concrete sequence | Architecture/DDD link to it; they do not restate delivery guarantees. |
| Broker ordering/replay/delivery | Topic 08 | DDD distinguishes domain versus integration event; broker mechanics stay canonical. |
| Distributed lease/fencing | Topic 28 | LLD explicitly labels Java locks/cache local and cannot substitute for fencing. |
| System rate-limit capacity and overload | Topic 10 | LLD owns compact token/sliding-window code and local state only. |
| Cache topology, freshness, stampede and projections | Topic 25/Case 09 | LLD owns TTL/data-structure contract; no distributed freshness claim. |
| Testing portfolio and fault injection | Topic 26 | Batch H supplies targeted proof obligations and fixtures; Topic 26 owns portfolio design. |
| Mobile framework mechanics/security | Official RN/Flutter/Android/iOS and mobile-security material | Case 06 owns Tiki's dated decision matrix and mixed-module evidence. |

## Review worksheet used by the integrated items

For every new pattern or boundary, answer these fields before calling it a best practice:

1. What semantic term or state is being protected?
2. Which object/module/team is the authority and who can change it?
3. Which invariant must be true immediately, and which freshness may be eventual?
4. What is the linearization point or transaction boundary?
5. What happens on timeout, duplicate, stale command, crash, replay, restart, version skew and deletion?
6. Which resource is bounded: CPU, memory, queue, DB connection, socket, frame time, bundle size or team capacity?
7. Which check, metric, contract test, property test, or runbook would falsify the recommendation?

## Integration map

| Unit | Public integration | Preserved |
| --- | --- | --- |
| Topic 12 | Fitness functions/ADR item for executable architecture boundaries and change-impact evidence. | Existing 22 IDs, Clean/DDD terminology, cross-reference ownership and EN/VI structure. |
| Topic 22 | TTL cache contract item for monotonic time, cleanup validity, replacement races, local/distributed scope and tests. | Existing 9 IDs, complexity claims, Java names, provider caveats and EN/VI structure. |
| Topic 23 | Async fan-out item for bounded admission, deadlines, cancellation, executor lifecycle and unknown external outcomes. | Existing 9 IDs, JLS/JEP status, API names, proof vocabulary and EN/VI structure. |
| Topic 24 | DDD executable boundary worksheet connecting language, invariant, owner, authority, context relationship and recovery. | Existing 8 IDs, DDD terms, event/outbox ownership and EN/VI structure. |
| Case 06 | Paired qualifier after the historical Tiki result, separating dated rationale/team judgment from current framework recommendation/benchmark. | Existing anchors, figures, series links, article narrative and EN/VI parity. |

## Anti-patterns and negative evidence

- Do not call a package a bounded context because it has a folder name; show language, owner, invariant, translation and failure evidence.
- Do not make an architecture fitness rule so broad that teams bypass it, or so weak that it only reports violations after release.
- Do not use `ConcurrentHashMap` as proof that check-then-act, TTL cleanup, or a multi-key business invariant is atomic.
- Do not use a wall clock for elapsed TTL or assert that a background cleaner determines validity.
- Do not use `CompletableFuture.orTimeout` as proof that a blocking supplier or external request stopped.
- Do not submit unbounded fan-out to the common pool, create one executor per request, or hide rejection as a retry.
- Do not equate domain event, integration event and Event Sourcing; their storage, schema, delivery and privacy contracts differ.
- Do not make an aggregate enormous to avoid eventual consistency or tiny enough that every invariant becomes a distributed workflow.
- Do not treat a Tiki historical React Native choice as a current framework benchmark or universal architecture rule.
- Do not put arbitrary WebView/native bridge content behind sensitive actions without origin, capability, lifecycle and hostile-content tests.

## Open questions and falsifiers

- Which exact Java/Spring/ArchUnit/Spring Modulith versions, compiler flags and preview policy are targeted? The API/tooling advice is falsified by the pinned build.
- Which architecture rules are truly owned, and which existing violations are allowed temporarily? A rule without an owner or exception expiry is not governance.
- What is the required aggregate contention, command rate and freshness SLA? Aggregate sizing is falsified by lock/serialization latency or invariant violations under load.
- What does cancellation mean for the actual HTTP/DB/file/provider resource? A post-timeout I/O or permit leak falsifies the async contract.
- What are TTL key count, expiry distribution, memory budget, restart behavior and whether cache state is disposable? Measurements may falsify the selected cache policy.
- Which mobile modules use which runtime, which native dependencies support the selected architecture, and what are the low-end frame/startup/memory budgets? Device telemetry and release-like tests decide.
- What decision date and versions support the article's claim that Flutter was too new? Repository history/package manifests can falsify an unqualified present-tense reading.

## Gate record

Completed 2026-08-23:

- Content index rebuilt after the five-unit integration.
- EN/VI item IDs and counts match for Topics 12, 22, 23 and 24; Case 06 article anchors and paired qualifier match.
- `node tools/validate-content.mjs --stats` passed; complete `node tools/check.mjs` passed; `git diff --check` passed.

## Selected source ledger

The per-unit records contain the complete ledgers. This synthesis list retains 41 primary/first-party sources that support the integrated claims.

### Architecture, DDD and modular boundaries

1. [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) - Alistair Cockburn: ports/adapters and driving/driven boundary.
2. [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - Robert C. Martin: dependency rule and policy/details.
3. [Onion Architecture](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) - Jeffrey Palermo: dependency direction variant.
4. [DDD Reference](https://www.domainlanguage.com/ddd/reference/) - Eric Evans/Domain Language: context, aggregate and model vocabulary.
5. [Strategic DDD and Domain Analysis](https://learn.microsoft.com/en-nz/azure/architecture/microservices/model/domain-analysis) - Microsoft: bounded contexts/context maps.
6. [Tactical DDD](https://learn.microsoft.com/en-ca/azure/architecture/microservices/model/tactical-ddd) - Microsoft: entities, value objects, aggregates and events.
7. [Domain Model for Microservices](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-domain-model) - Microsoft: aggregate/model trade-offs.
8. [DDD Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) - Martin Fowler: aggregate root and transaction boundary teaching.
9. [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html) - Martin Fowler: model/language boundary.
10. [EventStorming](https://www.eventstorming.com/) - Alberto Brandolini: collaborative discovery and adaptable workshop.
11. [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) - Martin Fowler: history/replay costs and boundaries.
12. [CQRS](https://martinfowler.com/bliki/CQRS.html) - Martin Fowler: selective read/write separation.
13. [Anti-Corruption Layer](https://microservices.io/patterns/refactoring/anti-corruption-layer.html) - Chris Richardson: semantic translation boundary.
14. [Spring Modulith fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html) - Spring: module verification and public API convention.
15. [Spring Modulith events](https://docs.spring.io/spring-modulith/reference/events.html) - Spring: publication registry/retry implementation scope.
16. [ArchUnit user guide](https://www.archunit.org/userguide/html/000_Index.html) - ArchUnit: executable dependency rules.

### Java concurrency and LLD contracts

17. [JLS SE 25, Threads and Locks](https://docs.oracle.com/javase/specs/jls/se25/html/jls-17.html) - Oracle: happens-before and synchronization.
18. [ConcurrentHashMap API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) - Oracle: per-operation/concurrent map contract.
19. [CompletableFuture API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html) - Oracle: completion, timeout and cancellation scope.
20. [ExecutorService API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html) - Oracle: lifecycle/shutdown/cancellation.
21. [ThreadPoolExecutor API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html) - Oracle: queues, rejection and bounded execution.
22. [Semaphore API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Semaphore.html) - Oracle: permit/fairness contract.
23. [Clock API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html) - Oracle: injectable wall-clock source boundary.
24. [JEP 444: Virtual Threads](https://openjdk.org/jeps/444) - OpenJDK: virtual-thread model and downstream limits.
25. [JEP 491](https://openjdk.org/jeps/491) - OpenJDK: JDK 24 monitor-pinning change and remaining cases.
26. [StructuredTaskScope Java 25 API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) - Oracle: preview structured lifetime/cancellation.
27. [jcstress](https://openjdk.org/projects/code-tools/jcstress/) - OpenJDK: exploratory concurrency stress evidence.
28. [Caffeine design](https://github.com/ben-manes/caffeine/wiki/Design) - Caffeine: admission/eviction design scope.
29. [Caffeine eviction](https://github.com/ben-manes/caffeine/wiki/Eviction) - Caffeine: expiry/maintenance/test ticker.
30. [Redis EXPIRE](https://redis.io/docs/latest/commands/expire/) - Redis: provider TTL/clock/persistence semantics.
31. [Redis eviction](https://redis.io/docs/latest/develop/reference/eviction/) - Redis: eviction policy/provider scope.
32. [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) - IETF: 429 and Retry-After semantics.

### Mobile framework and Tiki evidence

33. [Why Tiki chose React Native](https://engineering.tiki.vn/tai-sao-tiki-chon-react-native/) - Tiki Engineering: historical decision and mixed modules.
34. [React Native performance](https://reactnative.dev/docs/performance) - React Native: JS/UI performance measurement.
35. [React Native native platform](https://reactnative.dev/docs/native-platform) - React Native: native modules/components and boundary.
36. [The New Architecture is here](https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here) - React Native/Meta: version/date-specific architecture status.
37. [Flutter architectural overview](https://docs.flutter.dev/resources/architectural-overview) - Flutter: rendering/platform boundary.
38. [Flutter platform channels](https://docs.flutter.dev/platform-integration/platform-channels) - Flutter: Dart/native serialization boundary.
39. [Android app modularization](https://developer.android.com/topic/modularization) - Android Developers: module ownership and build/test trade-offs.
40. [Insecure WebView native bridges](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges) - Android Developers: bridge threat boundary.
41. [OWASP MASVS](https://mas.owasp.org/MASVS/) - OWASP: mobile security controls.
