# Research — Java 8 → 25 evolution and Java versus Go

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `02-java-8-25-java-vs-go`

EN file: `public/data/topics/02-java-8-25-java-vs-go.json`

VI file: `public/data/topics/02-java-8-25-java-vs-go.vi.json`

## Scope and non-goals

This unit owns the versioned Java language/runtime timeline from Java 8 through JDK 25 and a workload-based comparison with Go. It covers feature status, migration risk, concurrency/runtime economics, Native Image, and a polyglot decision framework. It does not own a universal language ranking, company adoption claims, or a benchmark result without a reproducible workload.

Version scope is explicit: Java SE/JDK 25 and Go 1.25 are the evidence anchors reviewed on 2026-08-23. “LTS” is a vendor distribution/support label, not a property that makes every JDK build equivalent. Preview features are not production-stable APIs.

## Discovery pool and selection

The working pool contained about forty-five candidates: Oracle/OpenJDK JEP and release-note pages for Java 8/11/17/21/25, Oracle and vendor support roadmaps, Go specification/runtime/release pages, and GraalVM Native Image documentation. Duplicate JEP mirrors, old benchmark articles, language-war commentary, and vendor marketing comparisons were excluded. Twenty-six distinct sources below were inspected/selected for feature status, support/version scope, runtime semantics, or a stated migration limitation.

The discovery policy allowed up to 200 candidate sources when a broader search would add distinct evidence; this topic stopped at the selected set because additional candidates repeated release notes, runtime contracts, or non-reproducible benchmark claims.

## Local content map

The complete EN and VI files were read. Both have two sections and 13 matching items.

| Section | Exact item IDs and current question | Local role |
| --- | --- | --- |
| Release timeline | `02-java-8-25-java-vs-go.release-timeline.q1` Java 8; `.q2` Java 11; `.q3` Java 13–16 groundwork; `.q4` Java 17; `.q5` Java 21; `.q6` Java 25; `.q7` why enterprises use LTS | Version history and migration framing |
| Java vs Go (2025–2026) | `02-java-8-25-java-vs-go.java-vs-go-2025-2026.q1` virtual threads/goroutines; `.q2` performance comparison; `.q3` selection/polyglot; `.q4` Native Image; `.q5` Loom/Valhalla/Panama; `.q6` records/sealed/pattern style | Decision framework, not a scorecard |

The VI file preserves every ID and the same two-section/q-count structure. It should be audited for qualifiers after editing because “preview”, “final”, “LTS”, “default”, and “usually” are easy to overstate in translation.

## What is correct and reusable

- The timeline is useful because it ties features to migration decisions rather than listing syntax. Java 8’s lambdas/default methods/streams/`java.time`, Java 11’s standard `HttpClient`, Java 17’s records/sealed classes, Java 21’s virtual threads, and JDK 25’s Scoped Values/compact headers are all relevant anchors, subject to exact JEP status.
- The local content correctly presents Java versus Go as a workload and organization choice, not a benchmark victory. The strongest comparison dimensions are blocking model, runtime/GC, binary/deployment, ecosystem, observability, and team constraints.
- The Native Image section correctly identifies closed-world reachability and reflection/resource metadata as the trade-off behind small/fast-starting binaries.
- The records/sealed/pattern section is a good teaching analogy for algebraic-data-type-like modeling, provided it is labeled an analogy: Java does not expose a single feature formally named “ADT”.

## Claims to verify, qualify, or remove

| Local claim/shape | Classification | Evidence/limitation | Proposed treatment |
| --- | --- | --- | --- |
| Java 8 is the longest-running LTS and remains the enterprise default | Broad/current claim | Adoption/support depends on organization and vendor; Oracle lists current Java versions separately and vendors have different support windows | Replace with “many estates still run Java 8; verify the vendor/support and dependency constraints” |
| Java 8→11 is the most painful migration; 11→17→21 is mostly dependency bumping | Over-absolute inference | Strong encapsulation, removed modules, bytecode/driver/framework changes, reflection, agents, GC/container defaults, and build plugins can make any hop difficult | Make migration risk a dependency/runtime test matrix, not a release-number heuristic |
| Java 17 records are immutable data classes | Partly false shorthand | Record components are final references and records constrain representation, but referenced objects can be mutable; defensive copies remain necessary | Say “shallowly immutable record carrier” |
| Java 21 pattern matching/record patterns are final and exhaustive | Version-sensitive | Pattern matching for switch and record patterns reached final status in JDK 21, but syntax/preview history matters; guarded patterns and future additions need exact JEP scope | Cite JEPs and separate final from preview syntax |
| JDK 25 shipped “18 JEPs” and the listed features are all final | Needs verification | OpenJDK’s JDK25 list mixes final, preview, and other categories; Structured Concurrency remains preview while Scoped Values is final | Use the official JEP list and label each feature status individually; remove an unverified count |
| Compact Object Headers are an 8-byte default in JDK 25 | Version/build-sensitive | JEP 519 adds the feature and flag; object size depends on layout, compressed references, alignment, fields, and build flags | State the JEP/flag and require `jol`/heap measurement for size claims |
| Generational Shenandoah is product/default in JDK 25 | Provider/version-dependent | Shenandoah availability and defaults differ by OpenJDK distribution; Oracle HotSpot collector docs do not establish a universal Shenandoah default | Cite the target distribution or mark unresolved |
| LTS releases are every two years and most vendors designate the same set | Support-policy claim | Cadence is defined by OpenJDK release process, but vendor support length/designation differs | Link vendor roadmaps and record the selected distribution |
| Goroutines start around 2 KB and automatically yield on blocking I/O | Implementation shorthand | Stack growth, runtime version, syscall path, scheduler and cgo behavior are implementation details; 2 KB is not a stable capacity promise | Remove fixed size; say goroutines are user-space scheduled and measure Go version/runtime behavior |
| Go and Java have a fixed performance gap or “Java wins throughput / Go wins startup” | Unsupported universal | Results depend on allocation, GC, serialization, framework, CPU, TLS, I/O, concurrency, and tuning | Replace all numeric/slogan comparisons with a test plan |
| Native Image gives millisecond startup and always lower memory | Marketing-style overreach | Native Image may improve startup/footprint for a workload, but build metadata, image heap, GC, code paths, and RSS need measurement; PGO requires representative paths | Keep as a conditional benefit, not a guarantee |
| Valhalla/Panama/Loom roadmap wording predicts future Java | Inference/unknown | Project status can change; Panama FFM is final in JDK 22, Loom features have mixed status, Valhalla remains a project | Split delivered facts, current previews, and future unknowns |
| Records/sealed/patterns “create algebraic data types” | Analogy | They can express a closed hierarchy and data-oriented dispatch, but Java’s nominal type system and mutability/serialization rules still apply | Say “ADT-like modeling style” and demonstrate exhaustiveness limits |

## Release and feature status ledger

| Release | Stable evidence | Preview/qualification |
| --- | --- | --- |
| Java 8 | Lambdas/default methods/streams, Optional, `java.time`, method references | The API/library ecosystem and module system are pre-Java 9; do not infer current security/support from language age |
| Java 11 | Local variable syntax in lambda parameters, standard HTTP Client, removed Java EE/CORBA modules from JDK, later LTS support | Collector/runtime defaults and framework minimums still depend on distribution and application |
| Java 13–16 | Text blocks, switch expressions, records and pattern previews, sealed classes preview | “Laid groundwork” is a historical interpretation; only JEP status is normative |
| Java 17 | Records, sealed classes, pattern matching for `instanceof`, strong encapsulation era, long-term support for many vendors | Frameworks and agents that used internal APIs may need migration work |
| Java 21 | Virtual threads, record patterns, pattern matching for switch, sequenced collections, Generational ZGC; FFM final in JDK 22 rather than 21 | Structured Concurrency and Scoped Values were preview in 21; do not call them final for a Java 21 target |
| Java 25 | Scoped Values final (JEP 506), compact source/constructor features, compact object headers, AOT-related JEPs; Structured Concurrency fifth preview (JEP 505) | Exact GA/binary support and defaults must be tied to a selected distribution; preview APIs require preview compilation/runtime flags |

## Workload, invariant, and failure model

### Comparison workload card

Every Java-versus-Go statement should attach:

| Dimension | Java variables | Go variables |
| --- | --- | --- |
| Runtime | JDK vendor/version, HotSpot/OpenJ9, GC, JIT warm-up | Go version, GC settings, `GOMAXPROCS`, cgroup limits |
| Request | payload, serialization, TLS, fan-out, CPU/blocking mix, cancellation | same request path and client behavior; avoid a different framework or protocol |
| Concurrency | platform/virtual executor, queue/bulkhead, connection pool | goroutine admission, channel/worker limits, runtime scheduler |
| Memory | heap/live set, direct/native memory, code cache, thread stacks | heap/live set, goroutine stacks, runtime metadata, cgo/native allocations |
| SLO | cold start, steady p50/p99/p999, throughput, RSS, CPU, error/timeout rate | same metrics and failure injection |
| correctness | ordering, idempotency, deadlines, cancellation, numeric precision, schema | same invariants; a faster runtime that drops cancellation is not equivalent |

The invariant is functional equivalence under the same protocol and failure schedule. “Startup” means process-ready plus dependency readiness, not only executable launch. “Memory” means RSS/container usage, not just Java heap or Go heap. “Throughput” must include error rate and tail latency.

### Failure/crash windows

| Window | Java risk | Go risk | Recovery/test |
| --- | --- | --- | --- |
| Warm-up/first request | JIT compilation, class loading, lazy initialization | compilation/linking, lazy initialization; less adaptive JIT in the standard toolchain | cold and warmed load tests separately |
| GC pressure | collector pause/concurrent CPU, direct/native memory outside heap | GC CPU/latency and soft memory limit interaction | allocation/live-set sweep, GC traces, RSS/cgroup test |
| Unbounded admission | VT tasks or async stages overwhelm DB/provider | goroutines/channels grow queues and memory | bounded semaphore/worker/connection tests |
| Unknown network result | retry may duplicate side effect unless idempotent | same; runtime choice does not solve protocol ambiguity | idempotency key/status inquiry/reconciliation test |
| Native/dynamic feature | reflection/JNI/resources missing in Native Image; FFM/JNI process crash | cgo pointer/lifetime/native crash | native-image metadata tests and native boundary fault injection |
| Version migration | removed modules, strong encapsulation, bytecode/agent/framework mismatch | module/toolchain/API/runtime changes | compile + integration + production-like canary on each hop |
| Preview API | source/runtime flags or later API change | experiment/toolchain availability | keep preview code isolated and pin toolchain |

## Coverage matrix

| Area | Selected evidence | Local coverage/gap | Proposed conclusion |
| --- | --- | --- | --- |
| Definitions | JLS/JEPs, Go memory model/runtime docs | Strong feature inventory | Add status labels to every feature |
| Invariants | Java/Go memory models, API compatibility docs | Functional comparison is implicit | State same workload/invariant before comparing |
| Workload | Native Image PGO and Go GC/runtime docs | Local tables lack reproducible variables | Replace slogans with the workload card |
| Failure/crash windows | migration, GC, native image, goroutine/VT admission | Present but scattered | Add one cross-runtime failure table |
| Retries/timeouts | gRPC/HTTP topics cross-linked, not runtime-specific | Runtime section should not invent network semantics | Link to 04/15/17; require propagated deadlines |
| Operations/recovery | JFR/Go pprof/diagnostics and deployment docs | Need exact commands/version scope | Add observability checklist, not a single tool winner |
| Security/privacy | JDK strong encapsulation, Native Image metadata, Go/cgo | Underdeveloped | Mention secrets/logs, reflection/resource exposure, cgo/native boundary; defer auth |
| Testing | migration matrix, benchmark parity, native-image reachability tests | Current prose over-focuses on feature demos | Add contract/load/chaos tests with same client and data |
| Domain trade-offs | binary/startup, ecosystem, I/O/CPU, team | Good framework but unsupported company/cost numbers | Remove unsupported `$50k`/percentage claims and company lists unless sourced |

## Java versus Go comparison

| Decision dimension | Java 25 | Go 1.25 | What must be measured |
| --- | --- | --- | --- |
| Blocking request style | Platform or virtual threads; rich mature JVM ecosystem | Goroutines with runtime scheduler; simple blocking-style code | concurrent sockets, heap/RSS, p99, downstream saturation |
| CPU-bound work | JIT can optimize hot code; GC/JIT CPU cost | ahead-of-time compiled standard toolchain; GC/runtime cost | same algorithm, warm-up, CPU profile and allocation |
| Startup/deployment | JIT JVM needs runtime; Native Image changes build/runtime constraints | native binary is a common deployment form | readiness, image size, RSS, TLS/cert/resource behavior |
| Dynamic framework features | HotSpot supports reflection/class loading; Native Image needs reachability metadata | static linking is simpler but cgo/reflection/runtime plugins still have scope | full integration tests and upgrade effort |
| Context propagation | ScopedValue is immutable/bounded in JDK 25; ThreadLocal remains | `context.Context` convention plus explicit passing | cancellation and child-lifetime tests |
| Tooling | JFR, async-profiler ecosystem, heap/thread tools | pprof, execution tracer, runtime diagnostics | incident time-to-diagnosis with the team’s actual skills |
| Ecosystem/teams | Java/Spring/JVM libraries and existing estate | compact deployment and strong network/cloud tooling | hiring, support, dependency/security update cost; no universal dollar value |

## Contradiction/limits table

| Competing claim | Resolution and scope |
| --- | --- |
| “LTS is safer” versus “latest is better” | LTS can reduce upgrade frequency for a chosen vendor, but security/support and dependency compatibility still require updates. Latest can contain useful features but may have shorter vendor support or more migration churn. |
| “Native Image is like Go” versus “Native Image is Java” | It changes compilation/reachability/runtime constraints; Java language/API compatibility is not identical to a HotSpot JVM. Treat it as a distinct deployment target. |
| “Virtual threads and goroutines are the same” | Both are user-space scheduling models, but scheduler, blocking integration, stack representation, cancellation/context, GC, and library behavior differ. Compare contracts, not labels. |
| “Records are immutable” versus defensive copying | The record’s component references are final; referenced collections/objects can still mutate. |
| “Pattern switch is exhaustive” versus open evolution | Exhaustiveness is checked for a known sealed hierarchy/type at compile time; adding permitted subtypes or crossing module/version boundaries creates compatibility work. |
| “Go has no runtime tuning” versus `GOMAXPROCS`/GC behavior | Go exposes fewer knobs in the standard path, but version, cgroup, runtime, GC and cgo behavior still affect capacity. |

## Negative evidence and anti-patterns

- Do not retain the local numeric claims about a “13% velocity gap”, “over `$50k/year`” service cost, or a universal “3–10×” protocol/runtime difference unless a repository-linked, reproducible source and workload are added.
- Do not infer language choice from Google/Netflix/Cloudflare name-dropping. A company architecture is evidence only for its own constraints and date.
- Do not migrate 8→11→17→21/25 by changing the compiler alone; run dependency, reflection, agent, serialization, TLS, container, and integration tests at every hop.
- Do not make JDK 25 preview APIs part of a stable library contract without isolating the preview boundary and pinning the toolchain.
- Do not present Native Image as a drop-in “free startup win”; missing reflection/resources and build-time initialization can produce runtime failures, while native builds consume time/memory.
- Do not compare Java warmed-up throughput with Go cold-start latency, or compare a Spring MVC/JSON service with a minimal Go handler.
- Do not treat goroutine/virtual-thread count as the capacity metric; the scarce resource is usually CPU, memory, sockets, database connections, queue depth, or external quota.
- Do not call an ADT analogy a Java language guarantee, and do not hide nullable/default/serialization behavior behind a sealed hierarchy diagram.

## Duplicate/canonical ownership

| Overlap | Canonical role |
| --- | --- |
| Java JMM, locks, VT runtime | `01-java-core-jvm` owns semantic/runtime facts; `23-java-concurrency-coding` owns exercises and proof/test patterns. |
| REST/gRPC/reactive versus VT | `04-rest-grpc-webflux` owns protocol/reactive selection; this unit owns only the runtime side of VT and Java release status. |
| Network thread/I/O comparison | `15-network-i-o-models` owns transport/server lifecycle and C10K; this unit owns JVM/Go runtime characteristics. |
| Native Image operations | This unit owns closed-world/migration trade-offs; Spring native deployment and framework compatibility belong in `03-spring-boot-deep-build` if used. |
| LTS/support policy | Keep a short version matrix here; exact vendor support dates should live in a release-maintenance note, not be copied into every topic. |

## Operational, security, observability, and testing notes

For a fair deployment comparison, record image/build time, binary/image size, readiness, RSS at idle and load, CPU quota, GC/runtime pauses, connection pool behavior, TLS/certificate loading, and graceful shutdown. Java needs JFR/GC logs/heap/native-memory/thread signals; Go needs pprof/trace/runtime and cgroup signals. The same alert should be expressed as a service SLO, not as a runtime-specific metric.

Security review must cover dependency patch cadence, container base image, JDK/Go crypto provider behavior, reflection/resource reachability, secrets in heap/logs/core dumps, and cgo/native code. Native Image reachability metadata may expose resources or include code that was assumed unreachable; it is not a security boundary. Go’s static binary does not remove supply-chain or native-library risk.

Testing should include a behavior contract suite shared by both implementations, protocol/serialization compatibility, cancellation and deadline propagation, load at the same concurrency, failure injection, restart/rolling deployment, and representative Native Image profile/reachability tests. A benchmark that changes framework, payload, client, or data distribution answers a different question.

## Integration record (Batch G scope)

Batch G integrated two paired bilingual items while preserving every existing ID: `02-java-8-25-java-vs-go.release-timeline.q8` labels final, preview, incubator, and implementation/vendor-specific behavior and pins the JDK/provider/build contract; `02-java-8-25-java-vs-go.java-vs-go-2025-2026.q7` adds a matched Java/Go benchmark contract covering cold and warm behavior, p50/p99, CPU/RSS, startup, GC, and downstream limits.

The public changes deliberately avoid a universal Java-versus-Go verdict. Virtual-thread or goroutine count is not service capacity, Native Image is a separate target with reachability constraints, and JDK 25 preview APIs must be treated as preview in the selected toolchain. Provider support, workload, quotas, and migration cost remain explicit falsifiers.

Gate passed on 2026-08-23: content index rebuilt; `validate-content.mjs --stats`, the complete `check.mjs` gate, EN/VI parity checks, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] Replace the release prose with a table that labels each feature `final`, `preview`, or `implementation/vendor-specific`; remove the unverified JDK25 JEP count.
- [ ] Correct “record = immutable” to “shallowly immutable carrier; deep immutability is the component’s responsibility”.
- [ ] Qualify Java 8 adoption and LTS statements with vendor/support/distribution/date.
- [ ] Add migration gates for removed modules, strong encapsulation, agents, reflection, serialization, JDBC drivers, container limits, and preview flags.
- [ ] Remove unsupported cost/velocity/company claims and insert the comparison workload card.
- [ ] Rewrite q1 goroutine versus VT as a contract table: scheduling, blocking integration, cancellation/context, stack/memory, pinning/cgo, and downstream bulkheads.
- [ ] Replace fixed goroutine stack and “millions” claims with “implementation-dependent; measure”.
- [ ] Keep Native Image benefits but add metadata/build-time-init failure cases, PGO representative-workload requirement, and a native-image test gate.
- [ ] Label Valhalla as a current project/unknown rather than a shipped Java 25 feature; distinguish FFM final in JDK 22 from future Panama work.
- [ ] Explain records/sealed/patterns as ADT-like modeling, including open-world/serialization/evolution limits.
- [ ] Mirror every status and qualifier in the VI file before integration.

## EN/VI and cross-reference plan

The exact ID map is already aligned. Keep feature names/JEP numbers, version numbers, compiler flags, and code identifiers unchanged. Translate “final”, “preview”, “goal”, “expected”, “vendor default”, and “unknown” precisely; do not convert a recommendation into a fact.

Cross-reference `01-java-core-jvm` for JMM/GC/collections, `04-rest-grpc-webflux` for REST/gRPC/reactive, `15-network-i-o-models` for network/I/O lifecycle, `03-spring-boot-deep-build` for framework/runtime baseline, and `26-testing-strategy` for parity/load/contract testing.

## Explicit unknowns and falsifiers

- Which JDK distribution and support contract does the project target? A support claim is falsified by the selected vendor’s roadmap or security policy.
- Which exact JDK 25 feature set is enabled, and are preview flags acceptable? The release table is falsified by the official JEP status or compiler/runtime behavior for the pinned build.
- Does the target workload benefit from JIT warm-up or Native Image? A controlled cold/steady benchmark with equal behavior, SLO, RSS and CPU budget can falsify the recommendation.
- Does the service use reflection, dynamic proxies, resource loading, serialization, JNI, or FFM? A Native Image integration test failing at runtime falsifies “drop-in compatibility”.
- What are the actual DB/socket/provider quotas? A VT/goroutine recommendation is falsified if bounded admission still cannot keep downstream p99/error budgets.
- Which team/support/ecosystem constraint dominates? A language recommendation without a named owner, support window, and migration budget is unresolved.

Confidence: high for delivered JEP/API/Go specification facts; medium for support policy and runtime behavior; low for any performance or organizational conclusion until a matched benchmark and target distribution are named.

## Sources

| # | Source (title — organization) | Tier / type | Version or revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [JDK release notes index](https://www.oracle.com/java/technologies/javase/jdk-relnotes-index.html) — Oracle | A / release index | Current Java SE versions including 8, 11, 17, 21, 25, 26 | 2026-08-23 | Release availability and version-specific release-note scope |
| 2 | [JEP 286: Local-Variable Type Inference](https://openjdk.org/jeps/286) — OpenJDK | A / delivered JEP | JDK 10 | 2026-08-23 | `var` feature status; not a Java 8 feature |
| 3 | [JEP 321: HTTP Client](https://openjdk.org/jeps/321) — OpenJDK | A / delivered JEP | JDK 11 | 2026-08-23 | Standard HTTP Client status and async/HTTP2 scope |
| 4 | [JEP 395: Records](https://openjdk.org/jeps/395) — OpenJDK | A / delivered JEP | JDK 16 | 2026-08-23 | Record syntax/semantics and shallow immutability boundary |
| 5 | [JEP 409: Sealed Classes](https://openjdk.org/jeps/409) — OpenJDK | A / delivered JEP | JDK 17 | 2026-08-23 | Sealed hierarchy and permitted-subclass scope |
| 6 | [JEP 440: Record Patterns](https://openjdk.org/jeps/440) — OpenJDK | A / delivered JEP | JDK 21 | 2026-08-23 | Record-pattern status and deconstruction |
| 7 | [JEP 441: Pattern Matching for switch](https://openjdk.org/jeps/441) — OpenJDK | A / delivered JEP | JDK 21 | 2026-08-23 | Pattern switch status/exhaustiveness rules |
| 8 | [JEP 444: Virtual Threads](https://openjdk.org/jeps/444) — OpenJDK | A / delivered JEP | JDK 21 | 2026-08-23 | VT runtime model and concurrency scope |
| 9 | [JEP 454: Foreign Function & Memory API](https://openjdk.org/jeps/454) — OpenJDK | A / delivered JEP | JDK 22 | 2026-08-23 | FFM final status; do not place it in Java 21 final feature list |
| 10 | [JEP 506: Scoped Values](https://openjdk.org/jeps/506) — OpenJDK | A / delivered JEP | JDK 25 final | 2026-08-23 | Scoped Values final status and immutable context model |
| 11 | [JEP 505: Structured Concurrency](https://openjdk.org/jeps/505) — OpenJDK | A / preview JEP | JDK 25 fifth preview | 2026-08-23 | Structured Concurrency is still preview in JDK 25 |
| 12 | [JEPs integrated since JDK 21](https://openjdk.org/projects/jdk/25/jeps-since-jdk-21) — OpenJDK | A / release feature index | JDK 25 | 2026-08-23 | JDK 25 feature list/status; JEP 519/506/505 and AOT features |
| 13 | [JEP 519: Compact Object Headers](https://openjdk.org/jeps/519) — OpenJDK | A / delivered JEP | JDK 25 | 2026-08-23 | Header feature/flag scope; no universal object-size claim |
| 14 | [Java language updates](https://docs.oracle.com/en/java/javase/25/language/java-se-language-updates.pdf) — Oracle | A / language guide | Release 25 | 2026-08-23 | Feature timeline cross-check and final/preview labels |
| 15 | [JDK 25 migration guide](https://docs.oracle.com/en/java/javase/25/migrate/jdk-migration-guide.pdf) — Oracle | A / migration guide | JDK 25 | 2026-08-23 | Removed/changed behavior and migration qualification |
| 16 | [Java SE support roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html) — Oracle | A / vendor support policy | Reviewed current page | 2026-08-23 | Oracle LTS/support terminology; not all vendors |
| 17 | [Go memory model](https://go.dev/ref/mem) — Go project | A / language specification | Current Go memory model | 2026-08-23 | Happens-before, channels/locks/atomics, DRF-SC scope |
| 18 | [Go 1.25 release notes](https://go.dev/doc/go1.25) — Go project | A / release notes | Go 1.25, 2025-08-12 | 2026-08-23 | Container-aware `GOMAXPROCS`, runtime and toolchain changes |
| 19 | [Go 1.25 release blog](https://go.dev/blog/go1.25) — Go project | A / first-party release post | Go 1.25 | 2026-08-23 | Release context and feature scope |
| 20 | [Go GC guide](https://go.dev/doc/gc-guide) — Go project | A / runtime guide | Current guide | 2026-08-23 | GC CPU/latency/memory-limit trade-offs; no “free runtime” claim |
| 21 | [Go mutex or channel](https://go.dev/wiki/MutexOrChannel) — Go project | A / first-party guidance | Current wiki | 2026-08-23 | No universal channel-over-mutex rule; choose by invariant |
| 22 | [Go concurrency codewalk](https://go.dev/doc/codewalk/sharemem/) — Go project | A / first-party tutorial | Current page | 2026-08-23 | Channel/ownership model and its limitations as teaching material |
| 23 | [Go runtime package](https://pkg.go.dev/runtime) — Go project | A / API/runtime docs | Go 1.25 package docs | 2026-08-23 | Scheduler/GC/runtime APIs are version-sensitive |
| 24 | [Native Image reference](https://www.graalvm.org/latest/reference-manual/native-image/) — GraalVM/Oracle | A / implementation docs | Latest docs, reviewed date | 2026-08-23 | Closed-world analysis and reflection/JNI/resource metadata |
| 25 | [Native Image reachability metadata](https://www.graalvm.org/jdk25/reference-manual/native-image/metadata/) — GraalVM/Oracle | A / versioned implementation docs | JDK 25 | 2026-08-23 | Runtime dynamic-feature failure and metadata requirements |
| 26 | [Native Image PGO guide](https://www.graalvm.org/latest/reference-manual/native-image/guides/optimize-native-executable-with-pgo/) — GraalVM/Oracle | A / first-party performance guide | Latest; PGO workflow | 2026-08-23 | PGO benefits depend on representative paths; examples are not universal benchmarks |
