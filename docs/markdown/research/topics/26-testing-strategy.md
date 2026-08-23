# Research - Testing strategy: truthful tests, failures, and scale

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `26-testing-strategy`

EN file: `public/data/topics/26-testing-strategy.json`

VI file: `public/data/topics/26-testing-strategy.vi.json`

## Scope and non-goals

This dossier audits the assigned test-purpose/test-double material, integration tests with real databases and containers, Spring transaction/context behavior, consumer/provider contracts, time/race/failure/load tests, and flaky-test policy. It owns test portfolio reasoning. Topic 13 owns security controls (this topic adds security tests); topic 28 owns distributed-lock invariants (this topic tests them); topic 20 owns telemetry/SLO definitions; topic 14 owns delivery/deployment test gates.

The source pool used original/first-party testing essays, Testcontainers/Pact/JUnit/Spring/OpenJDK/jqwik/PIT/WireMock documentation, PostgreSQL semantics, and Google research on CI/flakiness. The “test pyramid” is treated as a heuristic shape, not a fixed percentage rule. Framework versions, database images, transaction behavior, load tools, and CI scheduling are recorded as scope rather than universal best practice.

## Local content map

Both JSON files were read in full. Each has 3 sections and 13 items. EN is 41,117 bytes; VI is 45,534 bytes; item IDs and section shape match.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| What a test is for | `26-testing-strategy.what-a-test-is-for.q1` to `.q4` | Behavior versus implementation, test doubles, blind spots/budget, data/property-based testing |
| Integration tests that tell the truth | `26-testing-strategy.integration-tests-that-tell-the-truth.q1` to `.q4` | H2 versus real DB/Testcontainers, transaction flush/commit, Spring context, Pact contracts |
| Testing what usually breaks | `26-testing-strategy.testing-what-usually-breaks.q1` to `.q5` | Time, races, dependency failure, load/latency, flaky-test policy |

## What is correct and reusable

- The topic correctly asks what a test protects before choosing a tool. Behavior-oriented assertions are more resilient to refactoring than verifying an internal call sequence, although interaction behavior can itself be a contract when the side effect is the requirement.
- The dummy/stub/spy/mock/fake table is useful if “mock” is not used as a synonym for every test double. A fake must be validated against the real dependency's contract; a mock should usually sit at a boundary the team owns.
- The blind-spot list is strong: SQL dialect/locking, schema/migrations, serialization, time, concurrency, configuration, dependency failure, and operations are all places a green unit suite can lie.
- The H2 versus real PostgreSQL/MySQL and `@Transactional` discussion is high-value. Spring test-managed rollback can hide commit/flush/constraint/after-commit/outbox behavior; explicitly forcing flush/clear or using a real commit test is needed for those contracts.
- Testcontainers, contract tests, property-based testing, virtual clocks, barriers/latches, fault injection, and open/closed load tests give a coherent path from deterministic unit checks to production-shaped failure tests.
- The local flaky-test policy correctly rejects endless retries and demands an owner/deadline. It should add a measured quarantine budget and distinguish test flake from product nondeterminism.
- The topic correctly warns that coverage percentage is not proof and that the test pyramid has no universal ratio. Keep the “many fast, fewer high-level” heuristic but select the shape from risk/feedback cost.

## Claims to verify or qualify

| Local claim/pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| Tests coupled to implementation break on refactor | General testing observation | Often true for brittle interaction tests; not every interaction is accidental. Assert externally observable behavior unless the interaction itself is the contract. | High |
| “12 mocks in one test is a smell” | Heuristic | Useful design signal, not a threshold. A complex orchestration boundary may legitimately have many collaborators; prefer simpler ports/fixtures where confidence improves. | High |
| Test pyramid means fixed unit/integration/E2E proportions | Incorrect absolute | Fowler describes a rule of thumb and later discusses alternative shapes; no universal percentage fits every system. | High |
| H2 is an adequate PostgreSQL substitute | Negative evidence | Dialect, locking, transaction, DDL, planner, extension, and isolation differences can hide bugs. Use H2 only for behavior it demonstrably models. | High |
| `@Transactional` test means production transaction behavior was tested | Incorrect | Test-managed transactions often roll back and may never exercise commit/after-commit/outbox/real constraint boundaries; Spring documents preemptive-timeout caveats. | High |
| Testcontainers makes integration tests production-identical | Overstated | It runs real dependencies in a controlled environment, but image version/config/topology/data volume/network/managed-service differences remain. | High |
| Pact contract tests replace end-to-end tests | Incorrect | A contract verifies agreed interactions; it does not prove deployment wiring, workflows, data invariants, auth, or third-party behavior end to end. | High |
| A green race test proves concurrency correctness | Incorrect | One schedule is weak evidence. Use controlled barriers, repeated runs, database invariants/unique constraints, stress tools, and production telemetry. | High |
| `Clock.fixed` tests all time bugs | Incomplete | It makes a scenario deterministic; timezone/DST, monotonic durations, scheduler drift, persistence serialization, and multiple process clocks still need tests. | High |
| Retry/timeout tests need only mocked exceptions | Incomplete | Mocks check branch logic; fault-injection/integration tests check connection reuse, resource release, deadlines, duplicate effects, and state recovery. | High |
| p99 load number is comparable across tools | Incorrect | Open/closed model, warm-up, arrival process, coordinated omission, achieved throughput, payload/cache mix, and percentile method matter. | High |
| Retry a flaky test until green | Negative evidence | Retries hide signal and can create false confidence; quarantine only with owner/deadline and measure flake rate. | High |
| Mutation score/coverage proves quality | Incorrect | They expose some missing assertions/mutants; surviving equivalent mutants, untested integration/ops/domain paths, and generated code remain. | High |

## Workload, invariants, and failure model

### Workload and test model

For each test tier, state feedback budget, data volume, dependency topology/version, parallelism, isolation strategy, time source, random seed/order, network fault, load model, and artifact retention. The “right” test portfolio is a risk-weighted allocation: revenue/correctness/security/concurrency changes get deeper tests; trivial formatting changes should not start a full distributed environment unless the pipeline policy requires it.

Test invariants:

1. Assertions protect behavior/domain invariants, not only implementation calls.
2. Every external dependency contract is either exercised with the real dependency, verified by a contract, or explicitly marked as a fake assumption.
3. Tests that claim transaction/commit/lock/ordering behavior cross the real boundary at least once.
4. Test data is isolated, deterministic/replayable, and cleaned without hiding the behavior under test.
5. Time, randomness, concurrency, retries, and faults have controllable seeds/barriers/deadlines and leave evidence on failure.
6. Load results include achieved throughput, arrival model, warm-up, percentile method, resource saturation, and error/timeout rate.
7. A flaky test has an owner, failure history, quarantine expiry, and a remediation path; retries do not turn failures green silently.

### Crash and failure windows

| Window | Failure | Recovery/control |
| --- | --- | --- |
| Test setup/cleanup | Data leakage/order dependence changes later tests | Unique namespace/transaction/fixture, deterministic teardown, and explicit cleanup verification. |
| Mock/fake boundary | Fake accepts behavior real DB/provider rejects | Contract test and a scheduled real dependency integration suite; pin versions. |
| Spring test transaction | Rollback hides commit/constraint/outbox/after-commit behavior | `flush`/`clear`, real commit test, or a separate integration scenario with observable external boundary. |
| Context cache/parallel test | Shared mutable singleton/database/port causes cross-test races | Group cache keys, isolate state, use resource locks/containers, and verify parallel safety. |
| Time transition | Sleep is flaky or timezone/DST/clock jump changes result | Inject `Clock`, test instants/zone rules, use monotonic duration, await condition with deadline only where necessary. |
| Race schedule | Test misses the interleaving that violates a uniqueness/invariant rule | Barriers/latches, many repetitions, real DB constraint/lock, and stress harness for memory-level behavior. |
| Dependency retry/failure | Connection/resource remains leaked or effect repeats | Fault-injection test 500/429/delay/reset/broker stop; assert resource return, idempotency and compensation. |
| Load run | Closed-loop client hides queueing/arrival overload or coordinated omission | Compare open/closed models, record achieved rate, use warm-up, histogram/percentiles, and isolate load generator. |
| CI flake | Failure is retried/quarantined without learning | Capture seed/order/environment, classify, owner, deadline, and report flake rate separately from product failures. |

## Best-practice comparison

| Test type | Confidence | Speed/isolation | Typical blind spot | Use it for |
| --- | --- | --- | --- | --- |
| Behavior-focused unit | High for pure/domain logic | Fast, deterministic | DB/protocol/runtime semantics | Rules, money calculations, mapping, error policy |
| Sociable unit/fake | Medium/high if fake has contract | Fast/moderate | Fake drift | Owned ports and deterministic orchestration |
| Real dependency integration | High for dependency semantics | Slower/isolated environment | Managed topology/provider quirks | SQL/locking/schema/serialization/transactions |
| Consumer/provider contract | High for agreed interaction | Fast relative to E2E | Workflow/data/auth/deployment wiring | Independently released APIs/events |
| Component/API E2E | High path confidence | Moderate/slow | Uncovered branches, external provider | Revenue-critical user journeys |
| Fault injection | High for selected failure boundary | Expensive/controlled | Unmodeled failures | Retry/timeout/compensation/resource cleanup |
| Race/stress/concurrency | Evidence for schedules/invariants | Nondeterministic/expensive | Missed schedules/weak assertions | Unique winners, locks, memory model, queues |
| Load/stress/spike/soak | Capacity/tail evidence | Expensive/environment-sensitive | Nonrepresentative workload | Capacity, p99, saturation, leaks, recovery |
| Mutation testing | Assertion strength signal | CPU/time expensive | Equivalent mutants/integration | Find unasserted branches in high-risk code |

## Coverage matrix

| Gate area | Evidence and local coverage | Gap to close before integration |
| --- | --- | --- |
| Definitions | Test doubles, pyramid, unit/integration/contract/E2E/load/flaky | Add risk-based selection and no fixed test-ratio claim. |
| Invariants | Behavior, commit/flush, concurrency winner, idempotency, cleanup | Put domain invariant examples beside each test tier. |
| Workload | H2/real DB, containers, context cache, load models | Add versions, image tags, schema size, arrival rate and environment limits. |
| Failure/crash windows | Time/race/retry/timeout/load/flaky | Add broker/provider/database crash and restore sequences. |
| Retries/timeouts | WireMock/Toxiproxy-style faults, deadline/resource assertions | Add retry-owner/budget and duplicate-effect checks. |
| Operations/recovery | CI cache/parallel/quarantine, artifacts | Add test result retention, triage ownership, and reproducible command line. |
| Security/privacy | Boundary risks are present indirectly | Add token/role/tenant/SSRF/deserialization/secrets/PII test cases; never store production data. |
| Testing of testing | Mutation, flake history, contract verification | Add mutation budget and contract-provider compatibility matrix. |
| Domain trade-offs | Money/idempotency/DB locking/booking examples | Keep domain examples, but state which invariant makes a deeper test mandatory. |

## Contradictions and limits

| Competing guarantee | Source boundary | Teaching implication |
| --- | --- | --- |
| Pyramid versus alternative shapes | Fowler's 2018 pyramid is a heuristic; 2021 “test shapes” documents variation. | Use the portfolio that minimizes risk/feedback cost, not a prescribed ratio. |
| In-memory DB speed versus truth | H2/SQLite/fakes speed local feedback but differ from production engines. | Use a two-tier strategy: fast tests plus pinned real-engine integration. |
| Spring rollback isolation versus commit realism | Test-managed rollback is convenient; it can hide commit/flush/after-commit behavior. | Add explicit committed-boundary tests instead of removing all rollback tests. |
| Contract versus E2E | Pact validates interaction expectations; E2E validates a deployed path. | Keep both where workflow wiring/auth/data matters; do not duplicate every scenario. |
| Parallel CI speed versus isolation | JUnit parallel is opt-in/configurable and shared resources may race. | Parallelize only after resource ownership and thread safety are explicit. |
| Load p99 versus user latency | Closed clients/coordinated omission can under-report queueing; different tools use different histograms. | Report workload model, achieved throughput, warm-up, and measurement method. |
| Flake retry versus signal | Retries reduce transient CI noise but hide nondeterminism and increase cost. | Use bounded diagnostic retries only with separate reporting; never silently pass a flaky result. |

## Negative evidence and anti-patterns

- Do not assert private methods or mock every collaborator solely to reach a coverage percentage.
- Do not use H2 as proof of PostgreSQL/MySQL locking, isolation, DDL, extensions, or query behavior.
- Do not assume `@Transactional` tests exercised a commit, database constraint, outbox relay trigger, or after-commit callback.
- Do not share mutable static data, ports, files, clock state, or database rows across parallel tests without an explicit lock/isolation rule.
- Do not use `Thread.sleep` as synchronization; use an injected clock, condition, barrier, or bounded poll with diagnostics.
- Do not claim a green race test proves the lock is safe; assert a unique winner and use the real authority/fencing/version check.
- Do not mock a third-party SDK's serialization/auth/retry behavior and call it an integration test.
- Do not run closed-loop load only and report a flattering p99 without achieved arrival rate, open-model comparison, and saturation.
- Do not quarantine flaky tests without an owner/expiry or retry them until the dashboard is green.
- Do not include real customer tokens/PII/payment data in fixtures, dumps, logs, contract artifacts, or load captures.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Action |
| --- | --- | --- |
| Security controls and attack taxonomy | `13-security-oauth2` | Add security test cases here, link control definitions there. |
| Distributed-lock protocol/fencing | `28-distributed-lock-lease` | Test invariants here, canonical algorithm there. |
| Broker delivery/Outbox/Saga | `08`, `09`, Case Study 15 | Keep integration/fault test examples; do not restate broker guarantees. |
| Observability/SLO/alert testing | `20-observability-sre` | Keep test assertions for telemetry; canonical signal/SLO definitions there. |
| Kubernetes rollout/collector/migration operations | `14-devops-k8s-best-practices` | Link deployment gates and keep portfolio guidance here. |

## Proposed content changes (not applied)

- [ ] Replace any fixed pyramid ratio/“12 mocks” rule with a risk and feedback-cost heuristic.
- [ ] Add an explicit test contract template: purpose, boundary, invariant, fixture, time/randomness, fault, cleanup, evidence, owner.
- [ ] Split unit/fake/real-engine/contract/E2E tests with a table of blind spots and required evidence.
- [ ] Add Spring test-managed transaction/flush/clear/commit examples and version caveats.
- [ ] Add container image/version/parallel isolation and context-cache assumptions.
- [ ] Add virtual-clock/timezone/DST/monotonic tests and race barriers plus repeated-run/stress guidance.
- [ ] Add retry/fault-injection cases for duplicate effects, resource return, compensation and deadline budgets.
- [ ] Add open versus closed load model, coordinated-omission warning, achieved throughput and histogram reporting.
- [ ] Add a no-silent-retry flaky policy with owner, expiry, seed/order/environment capture, and a separate flake metric.
- [ ] Update EN/VI together while preserving all 13 IDs.

## EN/VI parity and cross-reference plan

The EN/VI files have identical sections and IDs. Keep framework annotations, class names, configuration properties, SQL, HTTP status codes, test-double names, and test states unchanged. Translate “must/should/example/unknown” with equal strength. Cross-links should reference the canonical topics after integration, not copied paragraphs.

## Integration record (Batch E scope)

- [x] Added `26-testing-strategy.testing-what-usually-breaks.q6` in EN/VI for timeout-after-commit, retry, unknown outcome, consumer checkpoint, and domain-invariant tests.
- [x] Added `26-testing-strategy.testing-what-usually-breaks.q7` in EN/VI for restore/replay/cutover evidence, RPO/RTO, parity, dependency/configuration recovery, and repeatable drills.
- [ ] The broader audit of framework-specific test performance, provider matrices, and mutation/fault tooling remains a follow-up.

## Open questions and falsifiers

- [ ] Which production DB/broker/IdP/provider versions and deployment topology must the real integration suite cover?
- [ ] What feedback-time budget and risk tiers determine which tests run per change, pre-merge, post-merge, nightly, and before production?
- [ ] Which domain invariants require real commit/unique constraint/lock/fencing/provider idempotency tests?
- [ ] What are the permitted CI parallelism, container resources, test data retention, and secret redaction rules?
- [ ] What would falsify the H2/fake shortcut: a production-only dialect/locking/schema bug, contract mismatch, or false-green migration test?
- [ ] What would falsify the selected load method: arrival model differs from production, achieved throughput is below target, percentile method hides queueing, or load generation becomes the bottleneck?
- [ ] What would falsify the flake quarantine policy: quarantine becomes permanent, the same test hides a product race, or retry rate exceeds the agreed CI budget?

## Source ledger

All selected sources were inspected/reviewed on 2026-08-23. Tier A is official framework/project/specification documentation; Tier B is original/first-party engineering research or guidance. Versioned docs are not universal contracts.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 26-01 | [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html), Martin Fowler/Thoughtworks | B; published 2018-02-26 | Granularity, unit/integration/contract/E2E trade-offs, behavior versus implementation, and pyramid as a rule of thumb. | 2026-08-23 |
| 26-02 | [On the Diverse and Fantastical Shapes of Testing](https://martinfowler.com/articles/2021-test-shapes.html), Martin Fowler/Thoughtworks | B; 2021 essay | Alternatives to a fixed pyramid shape and the need to adapt portfolio to context. | 2026-08-23 |
| 26-03 | [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html), Martin Fowler/Thoughtworks | B; current essay page | Sources/mitigation of nondeterminism and why retrying is not a fix. | 2026-08-23 |
| 26-04 | [Testing Strategies in a Microservice Architecture](https://martinfowler.com/articles/microservice-testing/), Martin Fowler/Thoughtworks | B; current essay page | Microservice test-level trade-offs and the distinction between integration/contract/component/E2E. | 2026-08-23 |
| 26-05 | [Testcontainers getting started](https://testcontainers.com/getting-started/), Testcontainers | A; current docs | Real dependency containers, lifecycle and environment assumptions. | 2026-08-23 |
| 26-06 | [Testcontainers guides](https://testcontainers.com/guides/), Testcontainers | A; current docs | Integration examples and provider/image/configuration scope. | 2026-08-23 |
| 26-07 | [Pact introduction](https://docs.pact.io/), Pact Foundation | A; current docs | Consumer-driven contract model and provider verification boundary. | 2026-08-23 |
| 26-08 | [Pact Specification](https://docs.pact.io/implementation_guides/pact_specification), Pact Foundation | A; current specification | Interaction contract structure and what is/is not encoded by a Pact. | 2026-08-23 |
| 26-09 | [JUnit User Guide 6.0.1](https://docs.junit.org/current/user-guide/junit-user-guide-6.0.1.pdf), JUnit | A; 6.0.1, released 2025-10-31 | Parallel execution/configuration, timeouts, thread modes and version-specific runner behavior. | 2026-08-23 |
| 26-10 | [Context Caching](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html), Spring Framework | A; current reference | Context-cache key, static cache, default max size and `@DirtiesContext`/fork implications. | 2026-08-23 |
| 26-11 | [Transaction Management](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html), Spring Framework | A; current reference | Test-managed transaction rollback, propagation, flush/commit boundary and preemptive-timeout caveat. | 2026-08-23 |
| 26-12 | [Context Pausing](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/context-pausing.html), Spring Framework | A; current Spring 7 reference | New/version-sensitive context lifecycle option; do not assume older Spring supports it. | 2026-08-23 |
| 26-13 | [jcstress](https://openjdk.org/projects/code-tools/jcstress/), OpenJDK | A; experimental Code Tools project | Concurrency stress harness purpose and limitation as an experimental JVM/memory-model tool. | 2026-08-23 |
| 26-14 | [PIT Mutation Testing](https://pitest.org/), PIT | A; current project docs | Mutation testing purpose and mutation-score limits. | 2026-08-23 |
| 26-15 | [jqwik User Guide](https://jqwik.net/docs/current/user-guide.html), jqwik | A; user guide 1.10.1 | Property-based generators, shrinking, seeds and reproducibility. | 2026-08-23 |
| 26-16 | [QuickCheck: A Lightweight Tool for Random Testing](https://www.cs.tufts.edu/~nr/cs257/archive/john-hughes/quick.pdf), John Hughes et al. | A/B; original paper/PDF, 2000-era research | Original property-based testing motivation and counterexample shrinking concept. | 2026-08-23 |
| 26-17 | [De-Flake Your Tests: Automatically Locating Root Causes of Flaky Tests in Code at Google](https://research.google/pubs/de-flake-your-tests-automatically-locating-root-causes-of-flaky-tests-in-code-at-google/), Google Research | B; ICSME 2020 paper | Flaky-test impact and a specific 428-project study; the reported accuracy is not a universal benchmark. | 2026-08-23 |
| 26-18 | [Advances in Continuous Integration Testing at Google](https://research.google/pubs/advances-in-continuous-integration-testing-at-google/), Google Research | B; 2018 presentation | Large-scale CI scheduling/selection cost and feedback-latency trade-offs. | 2026-08-23 |
| 26-19 | [What Breaks Google?](https://research.google/pubs/what-breaks-google/), Google Research | B; 2023 presentation | Test selection/bug prediction and the limits of running every test at large scale. | 2026-08-23 |
| 26-20 | [PostgreSQL MVCC](https://www.postgresql.org/docs/current/mvcc.html), PostgreSQL | A; PostgreSQL 18 current docs | Database concurrency/visibility boundary that in-memory substitutes may not model. | 2026-08-23 |
| 26-21 | [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html), PostgreSQL | A; PostgreSQL 18 current docs | Isolation behavior and anomaly/locking scope for real integration tests. | 2026-08-23 |
| 26-22 | [WireMock documentation](https://wiremock.org/docs/), WireMock | A; current docs | HTTP stubbing/fault responses and request matching scope; not a real network/dependency substitute. | 2026-08-23 |
| 26-23 | [wrk2](https://github.com/giltene/wrk2), Gil Tene | B; project repository | Open-loop constant-rate load generation and coordinated-omission-aware latency measurement intent. | 2026-08-23 |
| 26-24 | [Gatling reference](https://gatling.io/docs/gatling/reference/current/), Gatling | A; current docs; tool/version must be pinned | Load-model/tool configuration boundary; exact percentile semantics require the chosen version. | 2026-08-23 |
| 26-25 | [JUnit 6.0.1 API assertions](https://docs.junit.org/6.0.1/api/org.junit.jupiter.api/org/junit/jupiter/api/Assertions.html), JUnit | A; 6.0.1 API | Timeout assertion variants and the difference between same-thread and preemptive timeout effects. | 2026-08-23 |

## Gate status

- [x] Complete EN/VI files and exact IDs read.
- [x] Broad official/framework/research source pool inspected and selected sources mapped to claims.
- [x] Coverage matrix, contradiction/limits, negative evidence, crash windows, operations, security/privacy, testing, and domain trade-offs recorded.
- [x] Duplicate/canonical ownership and EN/VI parity plan recorded.
- [ ] Target framework/database/provider/load-tool versions approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.
