# Batch G research dossier: JVM, Java evolution, Spring boundaries, and Android build feedback

Status: `INTEGRATED`

Reviewed: 2026-08-23

Scope: Topics 01-03 and Case Study 04

This dossier is the synthesis layer for Batch G. It does not replace the per-unit records; it records the decisions that prevent the same runtime, transaction, build, or benchmark claim from being copied into several pages.

## Executive thesis

The useful unit of comparison is a bounded workload and an explicit contract. Java language and JVM guarantees, HotSpot behavior, framework defaults, build-tool behavior, and a historical team result are different evidence classes. The content now labels those classes instead of turning an implementation detail or a local measurement into a universal rule.

The main boundary decisions are:

| Question | Canonical answer | What other units should do |
| --- | --- | --- |
| What does a virtual thread or goroutine buy? | More practical blocking concurrency when the runtime and downstream resources permit it; not more CPU, DB connections, file descriptors, memory, or provider quota. | Keep admission, deadlines, cancellation, and bulkheads in the owning API/system-design topic. |
| Is a concurrent collection operation enough for a workflow? | No. A `ConcurrentHashMap` operation can be safe while a read-modify-write or multi-key invariant is still racy. | Send cross-service correctness to Topics 05, 09, 17, 25, or 28 as appropriate. |
| Are Java 25 features all production-ready? | No. Each feature must be labeled final, preview, incubator, or implementation/vendor-specific for the pinned build. | Do not repeat a version claim in framework or case-study prose without the same status label. |
| What does Spring transaction context follow? | It follows the execution/context model: imperative thread-bound resources, reactive Reactor context, or a separately configured async executor are distinct boundaries. | Keep generic Saga/outbox ownership in Topic 09; keep transport and API deadlines in Topics 15/17. |
| Does a shorter Android debug build prove O(1) build time? | It can describe a fixed dependency closure and selective workflow; it does not describe the whole clean/release/CI/install/startup pipeline. | Treat the Tiki result as historical evidence with a reproducibility card, not as a universal Gradle theorem. |

## Evidence classification

| Class | Examples in this batch | Required wording |
| --- | --- | --- |
| Specification/API fact | JLS memory actions, `ConcurrentHashMap` operation contract, Java SE API, Spring documented behavior | State the guarantee and its boundary; name the target version where relevant. |
| Delivered or preview platform feature | JEP 491 in JDK 24; `ScopedValue` final in JDK 25; `StructuredTaskScope` preview in JDK 25 | Include release and status; do not present preview behavior as a stable baseline. |
| Implementation behavior | HotSpot GC, pinning diagnostics, direct memory, class loading, build-task graph | Attribute it to the implementation/toolchain and require measurement. |
| Engineering recommendation | Bulkheads, monotonic deadlines, outbox, dependency locks, selected-build guardrails | Explain the invariant and failure mode; avoid “always” and “best” without workload. |
| Historical first-party observation | Tiki's selective Android build workflow and reported result | Preserve the original scope and uncertainty; request reproduction metadata before generalizing. |

## Coverage and failure matrix

| Area | Invariant | Typical failure | Required proof |
| --- | --- | --- | --- |
| JVM concurrency | Every shared-state transition has a happens-before or ownership argument. | A safe individual map call is composed into an unsafe multi-step workflow. | JMM reasoning plus stress/jcstress/property tests and a workload benchmark. |
| Virtual-thread admission | In-flight work stays within CPU, memory, socket, DB, and provider budgets. | Thread count rises while a downstream pool or quota saturates. | Queue age, downstream p99, rejection, cancellation, RSS/cgroup, and connection metrics. |
| Cancellation and deadlines | Parent cancellation reaches child work and resource cleanup. | Timed-out requests continue doing I/O or hold a connection. | Monotonic deadline tests, interrupt/cancellation tests, shutdown/rollback tests. |
| Java upgrade | The build, runtime, flags, agents, reflection, drivers, and base image are compatible. | A feature compiles but fails under the production vendor/image or at runtime. | Pinned toolchain, dependency lock/BOM, migration test, canary, rollback. |
| Spring transactions | The transaction boundary covers the authority that must commit atomically. | Self-invocation bypasses a proxy; async/reactive work escapes the original context. | Proxy/context tests, crash-window test, database integration test, outbox/reconciliation when needed. |
| Connection pools | Total and nested connections fit the database and failover budget. | `replicas x pool` or `REQUIRES_NEW` demand exhausts the database. | Pool/DB telemetry, saturation test, failover headroom, and transaction-duration distribution. |
| Auto-configuration | A conditionally created bean is understood and reproducible for the selected classpath/properties. | An upgrade silently changes a condition, property, serializer, endpoint, or driver. | Condition report, dependency convergence, contract tests, and artifact/SBOM review. |
| Android selective build | A selected debug artifact cannot hide required production integration. | Optional fake binding or deep link passes locally while release/full graph fails. | Full-vs-selected parity, release rejection, artifact inspection, deep-link smoke test. |
| Build speed | Faster feedback does not remove required correctness work from release/CI. | Cache or task exclusion produces stale/poisoned output or shifts time to install/startup. | Build scans/Build Analyzer, clean/cache-disabled comparison, cache provenance, end-to-end timing. |

## Duplication and canonical ownership

Batch G intentionally adds cross-references rather than another pattern tutorial:

- Topic 01 owns JVM/JMM/GC/collection mechanics and links runnable concurrency exercises to Topic 23.
- Topic 02 owns Java release-status and Java-versus-Go comparison methodology. It does not own API timeouts, database admission, or a universal language verdict.
- Topic 03 owns Spring proxy/context/auto-configuration/build boundaries. Topic 09 remains the canonical home for generic Saga and transactional outbox guarantees.
- Case 04 owns the Tiki selective-build narrative, its fake-source/deep-link guardrails, and historical measurement limits. Generic Gradle cache/configuration-cache and Android modularization guidance remains linked to the appropriate platform/build material.
- Topics 10, 15, 17, 20, 25, and 26 remain the owners for overload, transport budgets, API job contracts, observability, microservice consumer behavior, and testing strategy. Batch G does not copy those mechanisms.

## Integration map

| Unit | Integrated public change | Preserved |
| --- | --- | --- |
| Topic 01 | Two bilingual q7 items: virtual-thread admission/JEP 491/preview structured concurrency; concurrent-map multi-step atomicity. | Existing item IDs, EN/VI shape, Java identifiers, and cross-reference graph. |
| Topic 02 | Two bilingual items: release-status matrix and matched Java/Go benchmark contract. | Existing feature timeline, version labels, code identifiers, and comparison scope. |
| Topic 03 | Two bilingual items: imperative/reactive/async transaction context and reproducible Spring/build upgrades. | Existing item IDs, generic Saga/outbox ownership, and framework-specific qualifiers. |
| Case 04 | Paired article qualifier after the result section. | Existing anchors, figures, commands, code, historical number, and EN/VI article structure. |

## Open questions and falsifiers

- The final JVM examples still require a pinned JDK vendor/build, base image, compiler flags, and support policy.
- GC, Native Memory Tracking, direct-buffer, class-loader, and RSS conclusions remain workload and implementation-dependent.
- Structured concurrency remains preview for the researched JDK 25 API; the selected build must opt in or use a later final API.
- Spring pool formulas and transaction recommendations need actual replica count, nested-connection behavior, database max connections, driver timeouts, and failover headroom.
- The Android case cannot be reproduced from the article alone until the repository history, Gradle/AGP/JDK/Kotlin/Dagger versions, graph, hardware, cache state, and sample size are recovered.
- A selected Android build is falsified if a release artifact contains fake classes, if full-vs-selected parity fails, or if cache correctness/end-to-end developer time does not improve.

## Gate record

Completed 2026-08-23 after the Batch G public changes:

- `node tools/build-content-index.mjs` rebuilt the index at 492 items.
- `node tools/validate-content.mjs --stats` passed with 28 topics, 492 items, 20 blueprints, and 50 SVG markers; no thin item remained.
- `node tools/check.mjs` passed all stages: diagrams, ESM syntax, logging, and 241 tests.
- EN/VI IDs and section counts were checked for Topics 01-03; Case 04 anchors and the paired qualifier were checked.
- `git diff --check` passed.

## Selected source ledger

The per-unit records contain the full ledgers. The following primary/first-party sources are the synthesis set used for Batch G; access/review date is 2026-08-23 unless the unit record says otherwise.

### Java, JVM, and concurrency

1. [Java SE 25 JLS](https://docs.oracle.com/javase/specs/jls/se25/html/index.html) - Oracle: language and memory-model contracts.
2. [VarHandle API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/invoke/VarHandle.html) - Oracle: access modes and atomicity boundaries.
3. [java.util.concurrent package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/package-summary.html) - Oracle: executor and synchronizer contracts.
4. [Thread API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html) - Oracle: platform and virtual-thread API scope.
5. [JEP 444: Virtual Threads](https://openjdk.org/jeps/444) - OpenJDK: delivered virtual-thread model.
6. [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491) - OpenJDK: JDK 24 monitor-pinning change and remaining limits.
7. [StructuredTaskScope Java 25 API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) - Oracle: preview structured lifetime/cancellation API.
8. [JEP 505: Structured Concurrency](https://openjdk.org/jeps/505) - OpenJDK: preview status and evolution.
9. [JEP 506: Scoped Values](https://openjdk.org/jeps/506) - OpenJDK: delivered immutable context propagation.
10. [HotSpot GC Tuning Guide](https://docs.oracle.com/en/java/javase/25/gctuning/index.html) - Oracle: collector goals and tuning method.
11. [Available collectors](https://docs.oracle.com/en/java/javase/25/gctuning/available-collectors.html) - Oracle: collector trade-offs.
12. [Diagnostic tools](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html) - Oracle: JFR, `jcmd`, and NMT workflow.
13. [ConcurrentHashMap API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) - Oracle: operation contracts and weak-snapshot limits.
14. [HashMap API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) - Oracle: complexity, mutability, and synchronization scope.
15. [java.time package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/package-summary.html) - Oracle: clock-domain and time-type contracts.

### Java releases, Go, and native images

16. [JDK release notes index](https://www.oracle.com/java/technologies/javase/jdk-relnotes-index.html) - Oracle: release/version evidence.
17. [JEP 286: Local-Variable Type Inference](https://openjdk.org/jeps/286) - OpenJDK: Java 10 feature status.
18. [JEP 321: HTTP Client](https://openjdk.org/jeps/321) - OpenJDK: Java 11 HTTP client status.
19. [JEP 395: Records](https://openjdk.org/jeps/395) - OpenJDK: Java 16 record semantics.
20. [JEP 409: Sealed Classes](https://openjdk.org/jeps/409) - OpenJDK: Java 17 sealed hierarchy.
21. [JEPs integrated since JDK 21](https://openjdk.org/projects/jdk/25/jeps-since-jdk-21) - OpenJDK: Java 25 feature/status cross-check.
22. [Go memory model](https://go.dev/ref/mem) - Go project: happens-before and data-race scope.
23. [Go 1.25 release notes](https://go.dev/doc/go1.25) - Go project: version-sensitive runtime/toolchain changes.
24. [Go GC guide](https://go.dev/doc/gc-guide) - Go project: GC CPU/latency/memory trade-offs.
25. [Go mutex or channel](https://go.dev/wiki/MutexOrChannel) - Go project: no universal primitive rule.
26. [Native Image reference](https://www.graalvm.org/latest/reference-manual/native-image/) - GraalVM: closed-world/reachability boundary.
27. [Native Image metadata](https://www.graalvm.org/jdk25/reference-manual/native-image/metadata/) - GraalVM: reflection/resource metadata.
28. [Native Image PGO guide](https://www.graalvm.org/latest/reference-manual/native-image/guides/optimize-native-executable-with-pgo/) - GraalVM: representative-profile requirement.

### Spring, dependency/build reproducibility, and Android

29. [Spring Boot auto-configuration](https://docs.spring.io/spring-boot/4.0/reference/using/auto-configuration.html) - Spring: classpath/condition/back-off behavior.
30. [Spring Boot observability](https://docs.spring.io/spring-boot/reference/actuator/observability.html) - Spring: observation and Actuator boundary.
31. [Spring Framework transaction management](https://docs.spring.io/spring-framework/reference/data-access/transaction.html) - Spring: transaction abstraction and resource boundary.
32. [Spring Framework AOP](https://docs.spring.io/spring-framework/reference/core/aop.html) - Spring: proxy/interception model.
33. [HikariCP README](https://github.com/brettwooldridge/HikariCP) - HikariCP: pool configuration and sizing caveats.
34. [Gradle performance](https://docs.gradle.org/current/userguide/performance.html) - Gradle: build-performance measurement and trade-offs.
35. [Gradle configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html) - Gradle: configuration-state reuse and compatibility.
36. [Gradle dependency constraints](https://docs.gradle.org/current/userguide/dependency_constraints.html) - Gradle: reproducible dependency intent.
37. [Maven dependency mechanism](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html) - Apache Maven: dependency mediation and scope.
38. [Android Build Analyzer](https://developer.android.com/build/build-analyzer) - Android: task/build diagnosis.
39. [Optimize build speed](https://developer.android.com/build/optimize-your-build) - Android: measured build optimization guidance.
40. [Android Gradle tips](https://developer.android.com/build/gradle-tips) - Android: build configuration and cache guidance.
41. [Android modularization](https://developer.android.com/topic/modularization) - Android: module-boundary trade-offs.
42. [Dagger optional bindings](https://dagger.dev/dev-guide/optional-bindings.html) - Dagger: optional-binding semantics; version details remain to pin.
43. [Tiki: O(1) Android build time](https://engineering.tiki.vn/o1-android-build-time-at-tiki/) - Tiki Engineering: historical first-party workflow/result.

Note: the per-unit Case 04 ledger remains authoritative for the exact Dagger version and documentation revision used in the article review.
