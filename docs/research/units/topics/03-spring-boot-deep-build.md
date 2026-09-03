# Research — Spring, Spring Boot, Maven/Gradle, and runtime boundaries

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `03-spring-boot-deep-build`

EN file: `public/data/topics/03-spring-boot-deep-build.json`

VI file: `public/data/topics/03-spring-boot-deep-build.vi.json`

## Scope and non-goals

This unit owns Spring container/proxy/transaction/cache/event behavior, Spring Boot auto-configuration and external configuration, Maven/Gradle dependency/build mechanics, request/bean lifecycle, Actuator/testing, and JDBC/Hikari capacity boundaries. It does not own generic database locking, API semantics, or distributed workflow correctness; those are cross-referenced to topics 05, 17, 20, 25, and the case studies.

The framework evidence is version-sensitive. The official Spring reference currently exposes the Boot 4.x/3.5 lines and Spring Framework 7.x documentation; examples must pin the repository’s exact Boot/Spring/Java version before integration. Hikari and database claims are separately scoped to the driver/database version. A Boot default is not a JDBC-driver or database guarantee.

## Discovery pool and source-selection accounting

The working discovery pool contained about fifty candidates from Spring Boot/Framework reference docs, Spring Javadocs, Hikari’s project docs, Maven/Gradle manuals, Jakarta Validation, Jackson, and current MySQL/PostgreSQL/Oracle manuals. Old Spring 2.x reference PDFs, SEO “Spring best practice” pages, duplicate API mirrors, and uncited pool-size charts were excluded. Thirty-one distinct sources below were selected/inspected; each contributes a framework contract, version status, database limit, build-resolution rule, or operational caveat.

The discovery policy allowed up to 200 candidate sources when useful; this topic stopped at the selected set because the remaining candidates repeated framework contracts or supplied uncited, version-free tuning advice.

## Local content map

The complete EN and VI JSON files were read. They contain 3 sections and 24 matching items.

| Section | Exact item IDs and current question | Local role |
| --- | --- | --- |
| IoC container & transactions | `03-spring-boot-deep-build.ioc-container-transactions.q1` IoC/scopes/lifecycle; `.q2` `@Transactional`/self-invocation; `.q3` propagation; `.q4` AOP proxy; `.q5` events/transaction/outbox; `.q6` cache defaults | Correctness at framework boundaries |
| Auto-configuration & build | `03-spring-boot-deep-build.auto-configuration-build.q1` auto-config; `.q2` starter; `.q3` Maven POM/BOM/scope/transitives; `.q4` Maven/Gradle; `.q5` profiles/config; `.q6` async/scheduled; `.q7` Actuator; `.q8` Bean Validation/errors; `.q9` Hikari high traffic; `.q10` Boot testing; `.q11` Boot 4 baseline/migration; `.q12` Boot-Hikari lifecycle; `.q13` DB-specific pool effects; `.q14` timeout/connection budget; `.q15` isolation/state leaks | Build/deploy and JDBC capacity |
| Bean lifecycle & request flow | `03-spring-boot-deep-build.bean-lifecycle-request-flow.q1` bean lifecycle; `.q2` DispatcherServlet flow; `.q3` ObjectMapper/entity boundary | Request and serialization boundary |

The VI file has the same exact item IDs, order, and counts. Section labels are translated; Java/Spring identifiers are preserved. Translation parity still needs a final qualifier pass for “proxy”, “physical transaction”, “after commit”, “preview”, and “provider default”.

## What is correct and reusable

- The local transaction explanation correctly starts from a proxy invocation and warns that self-invocation bypasses proxy advice. It also correctly distinguishes logical transaction scopes from a physical resource transaction.
- `REQUIRES_NEW` is correctly treated as an independent physical transaction that can consume another connection; the pool-deadlock warning is useful. `NESTED` is correctly scoped to savepoint-capable resource managers/JDBC rather than presented as a universal distributed rollback.
- The application-event answer correctly separates in-process event delivery from durable cross-process publication. `@TransactionalEventListener` default `AFTER_COMMIT` is useful for read-side work, but a crash after commit can lose a required side effect; an outbox row must be in the same local transaction when publication intent is part of correctness.
- The cache answer correctly warns that `@Cacheable` does not define TTL/eviction/serialization/distribution and that `sync=true` is a provider/concurrency hint with limitations.
- The Boot sections correctly explain classpath/conditional auto-configuration, back-off, external property precedence, profiles, Actuator exposure, and test slices/Testcontainers as tools rather than magic correctness.
- The Hikari material is unusually valuable because it connects pool size, connection acquisition time, DB limits, transaction duration, rolling deployment, failover, and state reset. Its numeric examples must remain examples.

## Claims to verify, qualify, or remove

| Local claim/shape | Classification | Evidence/limitation | Proposed treatment |
| --- | --- | --- | --- |
| Constructor injection is always best and `@Lazy` should never be used | Recommendation presented as rule | Constructor injection exposes required dependencies and cycles early, but legitimate lazy/plugin/proxy boundaries exist | Keep as default recommendation; label exceptions and explain why a cycle is usually a design smell |
| `@Transactional` is a ThreadLocal transaction | Incomplete fact | Imperative transaction synchronization is thread-bound; reactive transactions use Reactor context and a different transaction manager | Say “imperative resource synchronization is thread-bound; reactive context is different” |
| Self-invocation never runs a transaction | Correct for proxy mode | AspectJ weaving or explicit proxy invocation changes the mechanism; final/private methods and proxy type have other limits | Scope to default Spring proxy mode and list alternatives |
| `REQUIRES_NEW` always needs two connections | Conditional | It needs an independent physical transaction/resource connection when the manager uses a pool; non-JDBC resources/configurations differ | Say “typically another connection in a JDBC pool” and include pool/outer-thread assumptions |
| `NESTED` is a lightweight nested transaction | Misleading | Spring maps it to savepoints where supported; it is not an independent commit and does not undo external effects | Keep savepoint wording and provider capability check |
| `@TransactionalEventListener` is durable after commit | False | It is in-process callback behavior; listener/process failure or crash loses a required external effect | Use outbox for durable intent; keep listener for local/in-process use |
| Cache annotation makes caching production-safe | False/incomplete | TTL, stampede, serialization, invalidation, topology, tenant/security and failure semantics belong to the Cache provider/design | Add provider matrix and negative examples |
| Auto-configuration is loaded by `spring.factories` in current Boot | Version-stale | Boot 3+ auto-configuration imports use `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`; older mechanisms may still exist for other features | Make Boot-version table and pin target |
| A starter contains all runtime dependencies and guarantees compatible versions | Incomplete | A starter is a curated dependency descriptor; versions/BOM, exclusions, optional/transitive dependencies and application overrides still matter | Explain starter+BOM+dependency tree |
| Maven/Gradle “performance” is an inherent tool property | Unsupported broad claim | Build performance depends on graph, plugins, repository, cache, configuration cache, workers, CI and project structure | Keep a measurement workflow and avoid fixed percentages |
| Profiles are safe for secrets/environment policy | Unsafe shorthand | Profiles select configuration; secrets should use an external secret/config system and least-privilege deployment | Add security boundary and precedence test |
| `@Async` and `@Scheduled` automatically preserve transaction/security/MDC context | False/incomplete | They use executors/proxies; context propagation and transaction scope need explicit design, and self-invocation bypasses advice | Add executor, context, shutdown, overlap and error handling rules |
| Actuator endpoints are safe when enabled | Incomplete/security-sensitive | Exposure, access control, network binding, sanitization and endpoint content differ | Keep only a least-exposure checklist |
| Hikari `maximumPoolSize=10/20/50` is a high-traffic best practice | Unsupported universal | Pool size is a concurrency/DB capacity allocation; server process memory and query mix vary by MySQL/PostgreSQL/Oracle/version | Keep formulas and measurement, remove universal presets |
| Hikari resets every possible connection state | Overstated | Standard JDBC state may be reset; arbitrary session variables, driver extensions, temp tables, prepared state, and application SQL can leak | Require explicit reset/test for session state |
| Boot 4 migration is a simple Java/version bump | Incomplete | Boot/Spring/Jakarta/HTTP/observability, plugin, native image, and third-party compatibility must be tested | Add staged migration matrix and rollback gate |
| Entity serialization leaks lazy fields/PII | Risk fact with configuration scope | Jackson/Hibernate/module/proxy configuration determines actual behavior | Keep as boundary risk; use DTO/projection and serialization tests, not “never” |

## Workload and invariant model

The primary invariant is not “a request got a connection”; it is: the intended business transition, its transaction scope, emitted durable intent, response contract, and resource release are all explicit. A local ACID transaction protects only resources enlisted in that transaction manager. A Spring annotation cannot make a broker, cache, HTTP provider, or event listener atomic with the database.

| Workload dimension | Required input | Consequence |
| --- | --- | --- |
| Request concurrency | arrival rate, burst, service time, blocking ratio, fan-out | executor and pool demand; queue age/tail latency |
| Transaction | read/write set, duration, isolation, nested/outer calls, rollback rules | lock/connection occupancy and retry behavior |
| DB | engine/version, max connections/processes, CPU/IO, replicas, failover | same Hikari pool has different server-side cost and failure behavior |
| Runtime | Boot/Spring/JDK/driver/Hikari versions, Java flags, container limits | defaults and instrumentation differ |
| Cache | hit rate, key cardinality, value size, TTL/invalidation, tenant/security | memory, staleness, stampede and data exposure |
| Build | modules, transitive graph, repositories, cache/CI topology | Maven/Gradle resolution and build latency |
| Async | scheduler period, overlap policy, queue capacity, shutdown deadline | duplicate jobs, backlog, lost context, graceful-deploy behavior |
| API boundary | payload schema, Jackson modules, unknown fields, null/default policy | backward compatibility and PII/secret exposure |

## Failure/crash windows and recovery

| Window | Failure | Observable symptom | Required recovery/design |
| --- | --- | --- | --- |
| Before proxy invocation | Direct `new`, self-call, final/private method, wrong proxy type | No transaction/cache/async advice | Bean/proxy integration test; call through designed boundary |
| After DB commit, before event listener | JVM crash/listener failure | DB state committed but side effect absent | Same-transaction outbox + relay/reconciliation; listener only for non-critical local work |
| Outer transaction holds connection while `REQUIRES_NEW` waits | Pool exhaustion/deadlock | acquisition timeout, request pile-up, DB connections near cap | bound nesting, size pool from actual `C_m`, split workflow or avoid nested physical transactions |
| Transaction rolls back after event publication | Consumer sees event for uncommitted/rolled-back state | phantom downstream action | publish after commit/outbox; test crash/order |
| Cache hit returns stale/unauthorized value | stale business decision or cross-tenant leakage | unexpected data/authorization defect | key includes authority/tenant where needed; TTL/invalidation/read-after-write policy |
| Async task outlives request/transaction | missing context, closed resource, duplicate work | wrong tenant/auth/MDC, connection errors | explicit context capture, task ownership, cancellation, durable job state where needed |
| Hikari gives dead/expired connection | acquisition/validation/SQL exception | burst of connection failures during failover/network idle timeout | align `maxLifetime`/keepalive/validation with DB/LB, jitter/retry only at safe boundary |
| Rolling deployment exhausts DB | each replica opens max pool | DB rejects connections, old/new replicas fail | budget `replicas × pool`, reserve failover headroom, warm/drain gates |
| ObjectMapper/entity graph recursion/lazy load | large payload/query storm/PII leak | serialization latency, N+1 queries, stack overflow | DTOs/projections, explicit views, query/serialization tests |
| Auto-config changes after dependency upgrade | different bean/condition/order | startup failure or silent default change | condition report, dependency lock/BOM, startup contract tests |

## Coverage matrix

| Area | Evidence coverage | Local status/gap | Proposed conclusion |
| --- | --- | --- | --- |
| Definitions | Spring/Boot/Hikari/Maven/Gradle contracts | Strong | Keep concise contract boxes |
| Invariants | local transaction/proxy/cache/resource ownership | Strong but outbox boundary is repeated elsewhere | Link to topic 09 rather than repeat Saga |
| Workload | Hikari/DB/pool examples | Stronger than most topics; DB-specific evidence incomplete | Require engine/version/connection budget inputs |
| Failure/crash windows | events, transactions, pool, cache, serialization | Present, add async shutdown/boot upgrade windows | Keep the table above as the teaching spine |
| Retries/timeouts | JDBC/Hikari and network hints | No universal retry rule | Link to 15/17; define only acquisition/transaction/resource timeout boundaries here |
| Operations/recovery | Actuator, JFR/metrics, pool/DB signals | Need provider-specific dashboards | Add signal ownership and safe rollout/rollback |
| Security/privacy | Actuator/config/cache/Jackson/session state | Needs stronger warning | Add secret redaction, endpoint auth, tenant-aware keys, DTO boundary |
| Testing | Boot slices/Testcontainers | Good, but contract/failure tests need naming | Add proxy/context/pool/cache/serialization regression matrix |
| Domain trade-offs | MVC/JDBC/cache/build choices | Numeric presets are risky | Turn them into decisions tied to workload and failure budget |

## Best-practice comparison

| Problem | Usually appropriate baseline | Do not assume |
| --- | --- | --- |
| Required dependency | constructor injection and one clear ownership boundary | `@Lazy` is always bad or a cycle is harmless |
| Critical DB + event intent | one local transaction writes business row and outbox; relay is separate | application event is durable or listener is transactional with the DB |
| Independent audit/notification transaction | `REQUIRES_NEW` only with an explicit pool/deadlock budget; often outbox is safer | “new transaction” is free or has the same connection |
| Cache | provider-specific TTL/invalidation/serialization/security contract | annotation defaults match the domain |
| High traffic JDBC | measure query/transaction/concurrency and cap pool below DB budget | more connections always increase throughput |
| Configuration | typed `@ConfigurationProperties`, external secret/config source, precedence test | profiles are a secret manager or one environment file is authoritative |
| Async jobs | explicit executor/queue/overlap/idempotency/shutdown policy | `@Async` is a durable job queue |
| Build | BOM/constraints, dependency graph/lock, reproducible CI and cache measurements | Maven or Gradle’s brand predicts build time |
| JSON boundary | explicit DTO/projection and compatibility tests | entity graphs are safe to expose |

## Contradictions and limits

| Apparent conflict | Resolution |
| --- | --- |
| “Spring transaction is thread-bound” versus reactive transaction context | The statement is correct for imperative synchronization; Reactor-based transaction managers carry context through Reactor rather than a normal thread-local. Do not mix models. |
| “REQUIRES_NEW isolates failure” versus “it can deadlock” | Independent commit/rollback is a semantic benefit; waiting for another connection while outer threads hold connections is a resource failure mode. |
| “After-commit event is safe” versus outbox | After-commit prevents publishing an event for a rolled-back transaction, but it does not make the callback durable across process failure. |
| “Hikari resets connection” versus session leakage | Pool code resets documented JDBC state; application/driver/database session variables require explicit evidence and cleanup tests. |
| “Boot auto-config reduces code” versus hidden behavior | Auto-config is conditional and backs off, but dependency/version changes can change the bean graph. Condition reports and startup tests are part of the contract. |
| “Test slice is fast” versus system confidence | A slice isolates a boundary; it cannot prove driver, transaction, container, serialization, or network behavior that was excluded. |

## Negative evidence and anti-patterns

- Do not add `@Transactional` to every public method and assume it defines the business boundary; long transactions hold locks/connections and can accidentally include network calls.
- Do not call a proxied method through `this`, `new`, or a private/final path and expect AOP advice.
- Do not publish a required event from an `@TransactionalEventListener` and call it reliable without an outbox/relay/reconciliation design.
- Do not use `REQUIRES_NEW` to “fix” every rollback problem; it can amplify connection pressure and create audit/business inconsistency.
- Do not set Hikari max pool to the request thread count, CPU count, or a blog’s “20”; derive it from query service time, DB capacity, nested connections, replica count, and failover headroom.
- Do not retry a transaction that may have committed without an idempotent command/constraint and an unknown-outcome policy.
- Do not expose Actuator broadly, bind management endpoints on the public interface, or return config/env/heap data without access control and redaction.
- Do not cache authorization-sensitive data without tenant/user/key and invalidation analysis; a cache hit is not an authorization check.
- Do not assume `@Async` creates a durable queue, preserves transaction/security/MDC context, or shuts down gracefully by default.
- Do not serialize JPA entities as public contracts; lazy loading, cycles, internal fields, and PII are application-specific failure risks.
- Do not rely on Maven nearest-wins or Gradle forced versions without dependency analysis, because a build can be green while runtime ABI/security behavior changes.

## Duplicate/canonical ownership

| Overlap | Canonical role |
| --- | --- |
| Outbox/Saga/idempotency | Topic `09-distributed-tx-fintech` owns distributed workflow correctness; this unit owns the Spring event/transaction boundary that motivates an outbox. |
| API error/serialization/idempotency | `17-rest-api-design` owns HTTP contract; this unit owns ObjectMapper/validation/proxy integration. |
| DB isolation/locking/connection authority | `05-db-core-index-lock` owns DB semantics; this unit owns transaction-manager/JDBC pool integration. |
| Retry/timeout/circuit breaker | `15-network-i-o-models` and `25-microservice` own network/call-chain policy; this unit only identifies JDBC/executor resource windows. |
| Observability | `20-observability-sre` owns SLI/SLO/alerts; this unit names Spring/Hikari/Actuator signals. |
| Test strategy | `26-testing-strategy` owns the test portfolio; this unit maps Spring slice/Testcontainers/proxy tests to its boundaries. |

## Operational, security, observability, and testing notes

Monitor startup condition evaluation, bean creation failures, active profiles/config source, executor queue and rejection, scheduler overlap/lag, transaction duration/rollback/timeout, connection acquisition/usage/idle/validation, pool saturation, DB active connections, cache hit/miss/eviction/stampede, event/outbox lag, serialization latency/payload size, and Actuator endpoint access. Correlate request/transaction/outbox identifiers without putting secrets or full payloads into logs.

The security boundary includes external config precedence, secret stores, Actuator exposure/authentication, cache tenant isolation, JDBC credentials/session state, serialized fields, deserialization/reflection, and dependency supply chain. Hikari does not encrypt credentials; the deployment secret mechanism must own that concern. A profile is selection, not authorization.

Tests should include: proxy/self-invocation and final/private method behavior; commit/rollback/`REQUIRES_NEW`/savepoint tests against the target database; event crash window/outbox relay; pool exhaustion and rolling-deploy budget; driver/network failover; cache TTL/stampede/tenant isolation; async context/cancellation/shutdown; auto-config condition changes; validation/problem serialization; ObjectMapper unknown/null/renamed field compatibility; dependency convergence and reproducible build; Testcontainers for real DB semantics; and contract tests for public JSON.

## Integration record (Batch G scope)

Batch G integrated two paired bilingual items while preserving every existing ID: `03-spring-boot-deep-build.ioc-container-transactions.q7` distinguishes imperative thread-bound transactions, reactive Reactor context, and `@Async` executor boundaries; `03-spring-boot-deep-build.auto-configuration-build.q16` turns framework/build upgrades into a reproducibility and supply-chain gate.

The public changes keep generic Saga/Outbox ownership in Topic 09 and focus this unit on Spring-specific proxy/context/crash behavior plus pinned Java/Boot/Spring/plugin/driver/database artifacts, dependency constraints, Testcontainers/contracts, and canary validation. Exact target versions and database behavior remain open until the application pins them.

Gate passed on 2026-08-23: content index rebuilt; `validate-content.mjs --stats`, the complete `check.mjs` gate, EN/VI parity checks, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] Add a version banner: target Java/Boot/Spring/Hikari/JDBC/database versions; mark Boot 4 and Spring 7 examples separately from Boot 3.
- [ ] Change q2/q3 to “proxy mode by default” and explicitly distinguish imperative thread-bound transactions from reactive context.
- [ ] Keep the `REQUIRES_NEW` pool formula/example, but label it a resource-allocation bound, not a recommendation for normal pool size.
- [ ] Move generic Saga/Outbox definitions to topic 09; keep q5’s crash-window explanation and Spring-specific `@TransactionalEventListener` semantics.
- [ ] Replace cache annotation “defaults” with provider matrix: local/shared, TTL, eviction, serialization, invalidation, `sync`, stampede, tenant key, and failure behavior.
- [ ] Update auto-configuration metadata for Boot 3+/4 and add a condition-report/debugging method.
- [ ] Replace Maven/Gradle speed claims with a build measurement table covering graph, plugins, repository, cache, configuration cache, and CI.
- [ ] Make Hikari q9/q13/q14 numeric values illustrative only; add `replicas × pool`, nested-connection, DB max-connection/process, and failover-headroom formulas.
- [ ] Add driver/database source links for MySQL 8.4, PostgreSQL current, and Oracle 26ai only if those are the pinned targets; otherwise mark the DB-specific answer unresolved.
- [ ] Add Hikari session-state leakage tests and state that pool reset does not undo arbitrary SQL/session variables.
- [ ] Expand q10 testing into a boundary matrix and link to topic 26.
- [ ] Add ObjectMapper DTO/projection and payload/PII regression guidance; never silently promise that entity serialization is safe.
- [ ] Apply the remaining provider matrices, pool formulas, cache/serialization details, and cross-reference refinements symmetrically to EN and VI; the Batch G changes above are already integrated.

## EN/VI and cross-reference plan

The structures and IDs are aligned. Preserve all annotations, property names, SQL, exception types, and version numbers. The translation should retain modal words (`must`, `should`, `may`, `typically`, `preview`, `provider-specific`) with the same strength. Cross-reference `05-db-core-index-lock`, `09-distributed-tx-fintech`, `15-network-i-o-models`, `17-rest-api-design`, `20-observability-sre`, `25-microservice`, and `26-testing-strategy` rather than reproducing their full mechanisms.

## Explicit unknowns and falsifiers

- Which exact Boot/Spring/Java line is the application’s target? Any auto-config/proxy/property claim is falsified by the target version’s reference/source or an integration test showing different behavior.
- Which transaction manager and resource type are used? The `REQUIRES_NEW`/NESTED recommendation is falsified if the resource does not provide the assumed separate connection/savepoint semantics.
- What are actual query service-time distributions, nested connection count, replica count, and DB max connections? A pool-size recommendation is unresolved until measured and is falsified by DB saturation, tail-latency regression, or failover failure.
- Which cache provider/topology and tenant/security policy apply? A cache recommendation is falsified by stale/unauthorized reads or stampede under a controlled test.
- Which JDBC driver/server idle and failover timeouts apply? Hikari lifetime/keepalive alignment remains unknown until driver/database docs and fault tests are pinned.
- Is a required event allowed to be lost after a commit? If no, a listener-only design is falsified by a process crash test; an outbox/relay/reconciliation path is required.
- What JSON compatibility policy and PII classification apply? Entity serialization remains unsafe until schema/field/authorization tests prove the boundary.

Confidence: high for Spring/Hikari/Maven/Gradle API/documented behavior; medium for current Boot 4 migration and DB-specific capacity; low for numeric “high traffic” values until the service workload and target versions are named.

## Sources

| # | Source (title — organization) | Tier / type | Version or revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [Spring Boot reference](https://docs.spring.io/spring-boot/reference/) — Spring | A / official reference | Current Boot 4.x/3.5 lines observed | 2026-08-23 | Current documentation/version navigation; pinning requirement |
| 2 | [System requirements](https://docs.spring.io/spring-boot/reference/system-requirements.html) — Spring | A / official reference | Current Boot line | 2026-08-23 | Java baseline/support scope; do not generalize across Boot generations |
| 3 | [Auto-configuration](https://docs.spring.io/spring-boot/reference/using/auto-configuration.html) — Spring | A / official reference | Boot current | 2026-08-23 | Classpath conditions, opt-in annotation, back-off, condition report |
| 4 | [Externalized configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html) — Spring | A / official reference | Boot current | 2026-08-23 | Property-source precedence, profiles, `ConfigurationProperties`, external files |
| 5 | [Profiles](https://docs.spring.io/spring-boot/reference/features/profiles.html) — Spring | A / official reference | Boot current | 2026-08-23 | Profile activation/selection; not a secret/authorization mechanism |
| 6 | [Actuator](https://docs.spring.io/spring-boot/reference/actuator/index.html) — Spring | A / official reference | Boot current | 2026-08-23 | Management/production endpoints and observability boundary |
| 7 | [Actuator endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html) — Spring | A / official reference | Boot current | 2026-08-23 | Exposure/access/sanitization configuration scope |
| 8 | [Testing](https://docs.spring.io/spring-boot/reference/testing/index.html) — Spring | A / official reference | Boot current | 2026-08-23 | Test support and slice/integration boundary |
| 9 | [Testcontainers](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html) — Spring | A / official reference | Boot current | 2026-08-23 | Real dependency integration tests and service connection support |
| 10 | [Bean scopes](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | Singleton/prototype/request/session scopes and lifecycle assumptions |
| 11 | [Bean lifecycle/nature](https://docs.spring.io/spring-framework/reference/core/beans/factory-nature.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | PostConstruct/PreDestroy, post-processors, lifecycle and proxy timing |
| 12 | [Declarative transaction annotations](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html) — Spring Framework | A / official reference | Framework 7.0.x docs | 2026-08-23 | Proxy mode, self-invocation, defaults and rollback rules |
| 13 | [Transaction propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | REQUIRED/REQUIRES_NEW/NESTED logical/physical and pool consequences |
| 14 | [Transaction-bound events](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | `AFTER_COMMIT`, fallback, reactive context, listener failure boundary |
| 15 | [AOP proxying](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | JDK/CGLIB proxies, self-invocation/final/private limitations |
| 16 | [Cache annotations](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | `@Cacheable`, keys, `sync`, proxy behavior and provider responsibilities |
| 17 | [`@Cacheable` Javadoc](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html) — Spring | A / API contract | Current API | 2026-08-23 | `sync` is a hint with limitations; annotation does not define backend TTL |
| 18 | [Scheduling and `@Async`](https://docs.spring.io/spring-framework/reference/integration/scheduling.html) — Spring Framework | A / official reference | Framework current | 2026-08-23 | executor/scheduler proxies, async return/error/shutdown scope |
| 19 | [HikariCP README](https://github.com/brettwooldridge/HikariCP) — HikariCP | A / first-party project docs | Current project docs | 2026-08-23 | pool properties, max size, timeouts, lifetime/keepalive and fixed-pool guidance |
| 20 | [HikariCP FAQ](https://github.com/brettwooldridge/HikariCP/wiki/FAQ) — HikariCP | A / first-party project docs | Current wiki | 2026-08-23 | pool-locking formula, MySQL lifetime example, not optimal-size proof |
| 21 | [Maven dependency mechanism](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html) — Apache Maven | A / official manual | Current Maven guide | 2026-08-23 | transitive dependencies, mediation, scope, BOM/dependency management |
| 22 | [Gradle dependency constraints](https://docs.gradle.org/current/userguide/dependency_constraints.html) — Gradle | A / official manual | Gradle 9.7.x docs | 2026-08-23 | constraints versus dependencies, strict/rich versions, publication scope |
| 23 | [Gradle dependency management](https://docs.gradle.org/current/userguide/core_dependency_management.html) — Gradle | A / official manual | Gradle 9.7.x docs | 2026-08-23 | graph/variant/artifact resolution and dependency locking |
| 24 | [Gradle dependency resolution](https://docs.gradle.org/current/userguide/dependency_management.html) — Gradle | A / official manual | Current Gradle docs | 2026-08-23 | resolution strategies can mask problems; prefer constraints where possible |
| 25 | [Gradle build performance](https://docs.gradle.org/current/userguide/performance.html) — Gradle | A / official manual | Current Gradle docs | 2026-08-23 | measure build scans/profiles/repositories/dependencies rather than claim tool speed |
| 26 | [MySQL 8.4 server system variables](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html) — Oracle/MySQL | A / database manual | MySQL 8.4 | 2026-08-23 | `max_connections`, timeout and server resource scope; not Hikari sizing proof |
| 27 | [PostgreSQL connection settings](https://www.postgresql.org/docs/current/runtime-config-connection.html) — PostgreSQL | A / database manual | Current PostgreSQL docs | 2026-08-23 | connection/process settings and server-side limits |
| 28 | [PostgreSQL resource consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html) — PostgreSQL | A / database manual | Current PostgreSQL docs | 2026-08-23 | shared memory/workers/resource costs; version/provider scope |
| 29 | [pgJDBC documentation](https://jdbc.postgresql.org/documentation/use/) — PostgreSQL JDBC | A / driver docs | Current driver docs | 2026-08-23 | JDBC connection/timeout/driver behavior scope |
| 30 | [Oracle `PROCESSES` parameter](https://docs.oracle.com/en/database/oracle/oracle-database/26/refrn/PROCESSES.html) — Oracle Database | A / database manual | Oracle Database 26ai | 2026-08-23 | Oracle process/connection ceiling; not directly equal to Hikari pool size |
| 31 | [Jackson documentation/features](https://github.com/FasterXML/jackson-docs/wiki/JacksonFeatures) — FasterXML/Jackson | A / first-party project docs | Current project wiki; verify pinned Jackson version | 2026-08-23 | JSON module/serialization feature scope; entity exposure remains application-specific |
