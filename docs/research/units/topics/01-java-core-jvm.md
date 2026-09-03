# Research — Java Core & JVM internals

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `01-java-core-jvm`

EN file: `public/data/topics/01-java-core-jvm.json`

VI file: `public/data/topics/01-java-core-jvm.vi.json`

## Scope and non-goals

This unit owns the Java language/runtime facts that change a system-design decision: the Java Memory Model (JMM), object allocation and GC, JIT/warm-up, HotSpot process memory, Java concurrency primitives, class loading, time, and collection contracts. It is a foundation unit, not a second concurrency-pattern catalog or a performance benchmark.

The evidence below is scoped to Java SE/JDK 25 and HotSpot unless a source says otherwise. A Java language guarantee is not automatically a HotSpot implementation detail, and an Oracle JDK default is not automatically a guarantee of another vendor build, container, architecture, or future release.

## Discovery pool and source-selection accounting

The working discovery pool contained about forty candidate URLs from the Java Language Specification, Java SE 25 APIs, OpenJDK JEPs, HotSpot tuning/diagnostic guides, and implementation/project pages. Duplicate PDF/HTML versions, old JDK pages, search-result mirrors, and generic interview articles were collapsed. Twenty-five sources below were selected because each adds a distinct contract, version scope, diagnostic method, or implementation limitation. No SEO summary was used as evidence.

Excluded or deliberately not used: generic “JVM tips” blogs without a reproducible JDK/version, old Java 8-only collector advice presented as current, benchmark posts that omit heap/live-set/CPU/GC configuration, and claims that compare Java with Go using one synthetic score.

The discovery policy allowed up to 200 candidate sources when a broader search would add distinct evidence; this topic stopped at the selected set because the remaining candidates repeated contracts or lacked reproducible version/workload detail.

## Local content map

The complete EN and VI files were read. Both contain 4 sections and 27 items with matching persistent IDs. The VI file translates the prose and section labels but preserves code identifiers and cross-reference IDs.

| Section | Exact item IDs and current question | Local role |
| --- | --- | --- |
| Memory & execution model | `01-java-core-jvm.memory-execution-model.q1` JMM/happens-before/volatile; `.q2` heap/stack/escape analysis/TLAB; `.q3` Serial/Parallel/G1/ZGC/Shenandoah; `.q4` GC tuning/generations/leaks; `.q5` JIT/interpreter/C1/C2/tiered/warm-up; `.q6` JVM areas versus HotSpot RSS and `-Xmx` | Runtime semantics and capacity reasoning |
| Concurrency | `01-java-core-jvm.concurrency.q1` platform pools versus virtual threads; `.q2` structured concurrency/ScopedValue versus ThreadLocal; `.q3` ConcurrentHashMap; `.q4` synchronized/ReentrantLock/StampedLock; `.q5` CompletableFuture versus Future; `.q6` concurrency/multithreading/parallelism | Threading model and composition choices |
| Language fundamentals | `01-java-core-jvm.language-fundamentals.q1` equals/hashCode; `.q2` String pool/immutability; `.q3` checked/unchecked exceptions; `.q4` ClassLoaders; `.q5` off-heap/direct memory; `.q6` java.time; `.q7` clocks; `.q8` class-loader cast failure; `.q9` OOP pillars | Language/runtime boundaries |
| Collections & data structures | `01-java-core-jvm.collections-data-structures.q1` HashMap; `.q2` ArrayList/LinkedList; `.q3` HashSet variants; `.q4` selection cheat sheet; `.q5` HashMap/ConcurrentHashMap/capacity/load factor/threshold; `.q6` mutable keys and equals/hashCode | Data-structure contracts and failure modes |

The same exact ID suffixes exist in `01-java-core-jvm.vi.json`; this is an EN/VI structural parity fact, not proof that every qualifier is linguistically equivalent after a future edit.

## What is correct and reusable

- The JMM answer separates visibility, ordering, and compound atomicity. The `volatile stop` publication example is a good concrete happens-before explanation; it must remain clear that `volatile count++` is not an atomic increment.
- The content distinguishes Java specification memory areas from HotSpot implementation/process memory and correctly explains why `-Xmx` is not an RSS limit.
- The collector comparison already says workload and SLOs determine selection rather than presenting a universal winner. The JIT section correctly treats warm-up and tiered compilation as part of a latency/benchmark model.
- The virtual-thread material correctly frames blocking I/O and downstream capacity as separate concerns. Virtual threads add concurrency capacity; they do not create CPU, database, or provider capacity.
- The time section correctly rejects `LocalDateTime` as an unqualified instant and distinguishes wall-clock time from monotonic elapsed-time measurement.
- The collection sections correctly emphasize the equals/hashCode contract, mutable-key corruption, unsynchronized `HashMap`, and the fact that `ConcurrentHashMap` does not make a multi-operation business invariant atomic.

## Claims to verify, qualify, or remove

| Local claim/shape | Classification | Evidence and limitation | Proposed treatment |
| --- | --- | --- | --- |
| A happens-before edge gives visibility/order but not automatic atomicity for a read-modify-write | Verified fact | JLS §17.4–§17.5 and `java.util.concurrent` memory-consistency rules | Keep; use “a volatile access is atomic for the variable access, not for `x++`” |
| Final fields are safely initialized if construction rules are respected | Verified fact with scope | JLS final-field semantics; later mutation of reachable objects and premature `this` escape are outside the guarantee | Keep the caveat in both languages |
| `-XX:+PrintEscapeAnalysis` and `-XX:+EliminateAllocations` are normal production diagnostics | Version/build-sensitive and likely stale | Escape-analysis flags are implementation/product-build dependent and may be diagnostic/non-product; source does not make them a stable operational interface | Replace with “verify flags for the target build; use JFR/compiler logs and a benchmark first” |
| ZGC/Shenandoah pauses are `<1 ms` | Over-absolute | Oracle documents a ZGC maximum-pause goal under a millisecond for a stated collector/version, while throughput, allocation rate, hardware, safepoints, and workload still matter; Shenandoah behavior is build/provider-specific | Say “designed/targeted for low pauses; validate p99/p999 and non-GC pauses in the target build” |
| “Major GC cleans old generation” | Stale terminology | Collector-specific phases do not map cleanly to one universal “minor/major” taxonomy; G1, ZGC, and Shenandoah are not explained well by the old generational labels | Use collector-specific event names and say “full GC” only when the collector/documentation defines it |
| G1 is the default and ZGC is the low-latency choice | Verified default plus recommendation | HotSpot ergonomics selects G1 on most server-class configurations; ZGC is a starting point for a latency-sensitive workload, not a guarantee or automatic improvement | Keep with vendor/JDK/heap scope and measurement gate |
| `ThreadLocal` is replaced by ScopedValue/structured concurrency | Inference/recommendation | Scoped Values are final in JDK 25; StructuredTaskScope is still preview in JDK 25. ThreadLocal remains valid for mutable thread-scoped state, but is risky with pooled/reused threads | Reword as a choice for immutable inherited context and bounded task lifetime |
| Virtual threads are good for blocking I/O but not CPU parallelism | Verified fact with workload scope | Java 25 `Thread` API and JEP 444 explain user-mode threads and scheduler/carrier behavior; CPU work still competes for available processors | Keep; add DB/file/provider bulkheads |
| `ConcurrentHashMap` retrievals do not entail table-wide locking | Verified API fact | Java 25 API explicitly promises thread-safe retrievals and no whole-table lock; exact bins/tree mechanics are implementation details | Keep contract; remove claims about fixed internal node counts or universal speedup |
| HashMap treeification thresholds, capacity formulas, and O(1) are universal | Implementation/expected-complexity claim | API promises expected behavior under good hash dispersion; internal thresholds can change and collisions can degrade behavior | Label HotSpot/OpenJDK implementation detail and benchmark only if needed |
| `-Xmx` bounds the process | Incorrect | Heap is only one part of RSS; metaspace, code cache, direct buffers, thread stacks, GC/JIT/native libraries and mapped files also contribute | Keep the current RSS diagram and add cgroup/container accounting |
| `System.nanoTime()` is the production clock for deadlines | Verified recommendation | `System.nanoTime()` is for elapsed-time measurement and is not wall time; deadline composition still needs cancellation and resource budgets | Keep, but say it does not make an operation cancellable |

## Workload, invariants, and failure model

### Workload model

For any runtime claim, record at least:

| Dimension | Values to record | Why it changes the conclusion |
| --- | --- | --- |
| JDK/runtime | vendor, major/minor, HotSpot/OpenJ9, flags, preview features | Defaults, diagnostics, collectors, and preview APIs vary |
| Deployment | physical/VM/container, CPU quota, memory limit, NUMA, architecture | Ergonomics, RSS, carrier parallelism, and GC headroom change |
| Allocation | allocation rate, object size/lifetime, live set, humongous objects, direct buffers | Determines GC work and whether heap or native memory is the bottleneck |
| Request shape | CPU time, blocking ratio, fan-out, payload size, concurrency, cancellation rate | Determines platform-thread/virtual-thread/reactive fit and queue pressure |
| SLO | throughput, p50/p99/p999 latency, pause budget, startup, memory ceiling | “Fast” and “low pause” are meaningless without a target |
| correctness | publication, ordering, atomicity, ownership, stale-read tolerance | A throughput optimization cannot weaken the invariant |

The principal invariants are: no data race for shared mutable state; every publication path has a happens-before or ownership proof; task count does not exceed downstream capacity; connection/file-descriptor/native-memory budgets stay within the process/container limit; collection keys remain stable while indexed; wall-clock timestamps are not used as elapsed-time clocks; and all cancellation/interrupt paths eventually release resources.

### Failure and crash windows

| Window | What can happen | Detection/recovery |
| --- | --- | --- |
| Before JIT warm-up | Cold code has higher latency and different allocation/GC behavior | Warm-up separately; use representative steady-state and startup tests |
| Safepoint/GC/native stall | Application threads pause or an external/native call blocks a carrier | JFR, GC logs, thread dumps, native metrics; do not attribute every pause to GC |
| Heap is below `-Xmx` but RSS exceeds cgroup | Native memory or thread/direct-buffer growth triggers OOM kill | NMT where applicable, process/cgroup RSS, thread count, direct-memory metrics, crash-loop alert |
| VT blocks while pinned/native | Carrier is occupied; concurrency collapses without a correctness error | JFR virtual-thread events; remove long blocking sections from native/foreign boundaries and bound downstream work |
| Thread interruption/cancellation | Code ignores interrupt or closes a resource late | Test cancellation at each blocking boundary; preserve interrupt status and use structured scopes where available |
| Class-loader redeploy | Old loader/classes remain reachable through threads, ThreadLocals, caches, or native callbacks | Heap/class-loader analysis, lifecycle cleanup, redeploy soak test |
| Mutable HashMap key changes | Entry becomes unreachable by lookup; business cache/dedup can silently miss | Immutable key/value objects, defensive copies, invariant tests |
| Clock moves backward/forward | TTL, token expiry, retries, and ordering decisions fire early/late | Wall clock for timestamps; monotonic deadlines for elapsed time; NTP/clock-skew telemetry |

## Coverage matrix

| Required area | Evidence coverage | Local status/gap | Research conclusion |
| --- | --- | --- | --- |
| Definitions | JLS, Java SE APIs, JEPs, HotSpot guide | Strong; terminology needs collector/version labels | Keep a short contract-first glossary |
| Invariants | JMM happens-before, final fields, CHM/HashMap API | Strong; multi-key CHM invariants need explicit warning | Add a “single operation vs business transaction” box |
| Workload | HotSpot ergonomics/collector selection, Thread API | Present but examples read like defaults | Add a required benchmark matrix and container quota row |
| Failure/crash windows | NMT, GC, VT pinning, class-loader leaks, stale keys | Mostly narrative | Add the table above in concise form |
| Retries/timeouts | CompletableFuture/VT cancellation and monotonic clock | Local answers mention timeouts but not budget propagation | Link to topic 15/17 for network budgets; keep runtime cancellation boundary here |
| Operational/recovery | JFR, NMT, GC logs, thread dumps | Good tools list; no recovery runbook | Add “signal → hypothesis → safe action” examples |
| Security/privacy | class loaders, direct/native memory, serialized data | Underdeveloped | Mention class-loader isolation, secret retention in heap/direct memory, and not logging payloads; defer auth to topic 13 |
| Testing | JMM litmus/stress, JFR/GC, collection property tests | Mostly interview-oriented | Add jcstress reference and repeatable latency/heap tests |
| Domain trade-offs | latency/throughput/CPU/I/O and data structure choices | Strong conceptual fit | Mark all numeric examples as workload hypotheses |

## Best-practice comparison

| Decision | Prefer | Avoid assuming | Evidence boundary |
| --- | --- | --- | --- |
| Publication of immutable configuration | final fields plus safe publication, or a volatile/lock edge | “constructor finished” alone when `this` escaped | JLS final-field/happens-before rules |
| CPU-bound parallel work | bounded executor/ForkJoin design sized to CPU and measured | millions of virtual threads or unbounded `parallelStream` | JDK executor/Thread API; workload benchmark |
| Blocking high-concurrency I/O | virtual threads with explicit downstream bulkheads | equating cheap threads with cheap DB/provider calls | JEP 444 and Thread API |
| Reactive pipeline | WebFlux/Reactor when non-blocking composition/backpressure is a primary need | putting JDBC/JPA blocking calls on the event loop | Spring/WebFlux and Reactor docs (topic 04) |
| Low-pause GC | choose a collector after allocation/live-set/SLO test | a fixed `<1 ms` promise | HotSpot collector guides |
| Shared map | HashMap under ownership/external lock; CHM for concurrent map operations | assuming `compute`/`get` chains form a business transaction | Java SE API contract |
| Elapsed deadline | monotonic time | wall-clock subtraction across NTP changes | `System.nanoTime` API contract |

## Contradictions, limits, and provider scope

| Apparent conflict | Resolution |
| --- | --- |
| “G1 is default” versus “choose ZGC for latency” | The first is a HotSpot ergonomic default; the second is a starting recommendation for a particular SLO. Neither is a universal performance result. |
| “Virtual threads scale” versus “thread count still hurts” | VT reduces per-blocked-thread OS resource cost, but task objects, stacks, scheduler carriers, sockets, DB connections, queues, and downstream work remain bounded. |
| “volatile makes it visible” versus “volatile counter is wrong” | Visibility/order for individual accesses is different from atomicity of a read-modify-write sequence. |
| JVM heap area versus process RSS | The JLS describes logical runtime areas; HotSpot exposes implementation memory outside the Java heap. A tool or vendor may account for it differently. |
| `ThreadLocal` versus ScopedValue | ScopedValue is immutable, bounded inherited context in JDK 25; ThreadLocal is still a supported mutable per-thread facility. The choice depends on lifetime and mutability. |
| “O(1) HashMap” versus collision slowdown | O(1) is expected under good hash distribution and a specific implementation; it is not a worst-case guarantee for arbitrary keys. |

## Negative evidence and anti-patterns

- Do not tune `-Xmx`, GC, or thread counts from one local run and call the result a production best practice.
- Do not use `volatile` as a substitute for a lock/CAS/ownership proof when multiple fields must change together.
- Do not use a virtual-thread executor as a hidden queue for an unbounded database, HTTP provider, or file-system workload; put the bound at the scarce resource.
- Do not add a large fixed thread pool because a graph shows “one request = one thread”; measure blocking time, queue age, CPU saturation, and downstream capacity first.
- Do not interpret a low heap-usage chart as proof that native/direct memory is safe, or use `-Xmx` as the container memory budget.
- Do not publish mutable objects or `this` from a constructor and then rely on final-field semantics to protect the whole object graph.
- Do not claim `ConcurrentHashMap` makes a check-then-act sequence atomic, or that an iterator is a consistent snapshot.
- Do not use `LocalDateTime` for an event that must be ordered across machines, and do not use wall time for a timeout.
- Do not use a mutable key in a hash map, and do not “fix” a class-loader conflict by comparing only class names.

## Duplicate/canonical ownership

| Overlap | Canonical role |
| --- | --- |
| JMM, Java memory visibility, atomics, locks | This unit owns the language/runtime contract; coding exercises and stress-test recipes belong to `23-java-concurrency-coding`. |
| Virtual threads versus reactive/I/O models | This unit owns Java thread/runtime semantics; `04-rest-grpc-webflux` and `15-network-i-o-models` own protocol and server-model trade-offs. |
| GC/native memory/latency | This unit owns JVM mechanics; `20-observability-sre` and `21-linux-production-debug` should own dashboards and incident procedure. |
| HashMap/CHM and data structures | This unit owns Java collection contracts; DB indexes/locks belong to `05-db-core-index-lock`, not an in-memory collection analogy. |
| Retry/timeout/cancellation | This unit owns task cancellation and clocks; network retry policy belongs to `15` and API idempotency to `17`. |

Do not copy the full JMM/VT/GC explanation into case studies. A case may cite the relevant exact question and add only its domain invariant, measured workload, and failure evidence.

## Operational, security, observability, and testing notes

Operational signals should include GC pause and concurrent-cycle failure, allocation rate, live-set/heap occupancy, native/RSS/cgroup memory, direct-buffer usage, thread and virtual-thread counts, carrier utilization, executor queue age, lock contention, class-loader count, and collection hit/miss or resize indicators. JFR, GC unified logs, `jcmd`, heap/class-loader analysis, and NMT are complementary; NMT is a HotSpot/JVM diagnostic and does not account for every third-party native allocation.

Security/privacy concerns are runtime concerns rather than an authentication tutorial: do not place credentials or personal data in thread names, MDC/ThreadLocal/ScopedValue, JFR events, heap dumps, GC logs, or exception messages; bound retained direct buffers and class-loader/plugin inputs; treat deserialization/reflection/class loading as a separate trust boundary. Link to topic 13 for protocol/auth details.

Tests should include JMM litmus or jcstress tests for lock-free/publication code, property tests for collection-key stability, cancellation/interrupt tests, class-loader redeploy tests, GC and native-memory soak tests, and benchmark forks with warm-up, steady-state, and cold-start phases. A benchmark result without JDK/vendor/flags/hardware/workload is an unresolved claim, not evidence.

## Integration record (Batch G scope)

Batch G integrated two paired bilingual items while preserving every existing ID: `01-java-core-jvm.concurrency.q7` covers virtual-thread admission boundaries, JEP 491, and the JDK 25 preview status of `StructuredTaskScope`; `01-java-core-jvm.collections-data-structures.q7` separates per-operation `ConcurrentHashMap` safety from multi-step atomicity. EN/VI structures and IDs remain identical.

The public changes are intentionally scoped: a virtual thread is a scheduling primitive, not extra CPU, database, socket, memory, or downstream quota; monitor pinning guidance is JDK-version-sensitive; and a concurrent map does not make a multi-key workflow atomic. The remaining GC, native-memory, vendor-build, workload, and preview-flag questions stay open in this record.

Gate passed on 2026-08-23: content index rebuilt; `validate-content.mjs --stats`, the complete `check.mjs` gate, EN/VI parity checks, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] Keep all 27 IDs, but add a visible “Java SE guarantee versus HotSpot/OpenJDK implementation detail” label to the four sections.
- [ ] Replace `<1 ms` pause diagrams and “major GC” shorthand with qualified collector-specific wording.
- [ ] Mark escape-analysis flags, TLAB details, treeification thresholds, and object-layout statements as JDK-build implementation details; provide a diagnostic alternative.
- [ ] Add a small workload card to q3/q4/q6: JDK/vendor, heap/live set, allocation rate, CPU quota, memory limit, target p99/p999, and measurement method.
- [ ] Add the VT failure boundary: cheap task admission does not remove DB/HTTP/file descriptor/cpu limits; include JFR pinning and JDK 24 scope.
- [ ] Add a monotonic-clock/deadline example and a clock-jump failure test.
- [ ] Add a direct-memory/RSS/cgroup troubleshooting checklist and explicitly state NMT coverage limits.
- [ ] Replace “CHM faster than Hashtable” with “different synchronization/operation contracts; compare under the target access pattern”.
- [ ] Link q1/q4/q5 to `23-java-concurrency-coding` without duplicating implementations; link API retry/timeouts to `15`/`17`.
- [ ] Apply the remaining collector, diagnostic, benchmark, and cross-reference refinements symmetrically to EN and VI; the Batch G changes above are already integrated.

## EN/VI parity and cross-reference plan

IDs, section counts, and question counts match exactly. Proposed edits should be made as paired changes, preserving Java identifiers (`volatile`, `VarHandle`, `ScopedValue`, `ConcurrentHashMap`, `System.nanoTime`) and the same classification of fact/inference/recommendation. The Vietnamese phrasing should not turn “goal”, “expected”, or “implementation detail” into a guarantee.

Cross-reference targets: `23-java-concurrency-coding` for runnable synchronization/CAS exercises; `04-rest-grpc-webflux` for WebFlux; `15-network-i-o-models` for socket/thread-pool network behavior; `17-rest-api-design` for API timeout/idempotency; `20-observability-sre` and `21-linux-production-debug` for operations; `05-db-core-index-lock` for database concurrency.

## Explicit unknowns and falsifiers

- Which exact JDK vendor/build and container base image will the final examples target? A recommendation is falsified if the chosen build does not expose the cited flag/API or changes the default.
- What heap/live-set/allocation rate and p99/p999 SLO justify G1 versus ZGC/Shenandoah? A collector recommendation is falsified by a controlled benchmark where it misses the target or increases CPU/memory cost beyond the budget.
- Which native/direct allocations are made by the final application? RSS safety is unresolved until cgroup pressure and NMT/allocator evidence are collected.
- Does the application rely on mutable ThreadLocal state, thread affinity, JNI, or foreign calls? If yes, the ScopedValue/VT migration recommendation needs redesign or pinning evidence.
- Are HashMap keys immutable for their full indexed lifetime? One mutable-key regression test would falsify the assumption.
- Are all timeouts expressed as monotonic deadlines and propagated to child operations? A clock-jump or cancellation test that leaves work running would falsify the current design.
- Do the exact JDK 25 preview APIs remain enabled in the project’s compiler/runtime configuration? If not, StructuredTaskScope content must remain conceptual or target a final API later.

Confidence: high for Java SE/JDK 25 contracts cited below; medium for HotSpot implementation behavior and any performance recommendation until the repository’s target workload is benchmarked.

## Sources

| # | Source (title — organization) | Tier / type | Version or revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [Java SE 25 JLS](https://docs.oracle.com/javase/specs/jls/se25/html/index.html) — Oracle | A / language specification | SE 25, especially §§17.2–17.5 | 2026-08-23 | JMM actions, wait/notify, happens-before, final fields, class/language semantics |
| 2 | [JLS SE 25 PDF](https://docs.oracle.com/javase/specs/jls/se25/jls25.pdf) — Oracle | A / specification release | JLS 25 PDF | 2026-08-23 | Volatile write/read edge, data-race definition, correctly synchronized programs |
| 3 | [VarHandle API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/invoke/VarHandle.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Plain/opaque/acquire/release/volatile access modes and CAS boundaries |
| 4 | [java.util.concurrent package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/package-summary.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Memory-consistency effects, executors, queues, futures, synchronizers |
| 5 | [Thread API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Platform versus virtual threads, carrier scheduling, blocking I/O/CPU scope |
| 6 | [JEP 444: Virtual Threads](https://openjdk.org/jeps/444) — OpenJDK | A / delivered JEP | JDK 21; updated 2025-10-30 | 2026-08-23 | VT model, scheduler/carrier relationship, pinning guidance, not CPU scaling |
| 7 | [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491) — OpenJDK | A / delivered JEP | JDK 24 | 2026-08-23 | Monitor pinning change, remaining native/foreign pinning, diagnostic scope |
| 8 | [StructuredTaskScope API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) — Oracle | A / preview API | JDK 25 preview | 2026-08-23 | Structured lifetime, join/cancel behavior, default virtual-thread factory, preview status |
| 9 | [JEP 505: Structured Concurrency](https://openjdk.org/jeps/505) — OpenJDK | A / preview JEP | JDK 25 fifth preview | 2026-08-23 | API evolution and non-final status |
| 10 | [JEP 506: Scoped Values](https://openjdk.org/jeps/506) — OpenJDK | A / delivered JEP | JDK 25 final | 2026-08-23 | Immutable, bounded context propagation; distinction from ThreadLocal |
| 11 | [HotSpot GC Tuning Guide](https://docs.oracle.com/en/java/javase/25/gctuning/index.html) — Oracle | A / implementation guide | Release 25, G33936-03, July 2026 | 2026-08-23 | Collector behavior, tuning method, HotSpot scope |
| 12 | [Available collectors](https://docs.oracle.com/en/java/javase/25/gctuning/available-collectors.html) — Oracle | A / HotSpot guide | Java 25 | 2026-08-23 | Serial/Parallel/G1/ZGC intent, stated pause/throughput trade-offs, workload caveat |
| 13 | [GC ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html) — Oracle | A / HotSpot guide | Java 25 | 2026-08-23 | G1/Serial defaults, heap defaults, tiered compiler, goals not always met |
| 14 | [G1 tuning](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html) — Oracle | A / HotSpot guide | Java 25 | 2026-08-23 | G1 pause target is a goal, not an absolute; allocation/live-set trade-offs |
| 15 | [Other GC considerations](https://docs.oracle.com/en/java/javase/25/gctuning/other-considerations.html) — Oracle | A / implementation guide | Java 25 | 2026-08-23 | Metaspace is native memory, class unloading, compact-header scope |
| 16 | [JVM Guide](https://docs.oracle.com/en/java/javase/25/vm/java-virtual-machine-guide.pdf) — Oracle | A / implementation/diagnostics guide | Java 25 | 2026-08-23 | HotSpot process memory and Native Memory Tracking coverage limits |
| 17 | [Java launcher/native memory options](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html) — Oracle | A / tool specification | JDK 25 | 2026-08-23 | `-Xmx`, NMT modes, option scope and diagnostics |
| 18 | [Diagnostic tools](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html) — Oracle | A / operations guide | Java 25 | 2026-08-23 | JFR, `jcmd`, NMT baseline/diff, diagnostic workflow |
| 19 | [HashMap API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Expected complexity, load factor/capacity, unsynchronized access, fail-fast limits |
| 20 | [ConcurrentHashMap API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Thread-safe operations, non-locking retrievals, no null, weak snapshot assumptions |
| 21 | [Collections framework overview](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/doc-files/coll-overview.html) — Oracle | A / API guide | Java SE 25 | 2026-08-23 | Collection interfaces, ordering and mutability distinctions |
| 22 | [String API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | String immutability and value semantics; pool discussion is implementation/runtime scoped |
| 23 | [ClassLoader API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ClassLoader.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Loader identity, delegation, class identity and cast failures |
| 24 | [ByteBuffer API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/ByteBuffer.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Direct-buffer semantics and explicit resource/GC caveats |
| 25 | [java.time package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/package-summary.html) — Oracle | A / API contract | Java SE 25 | 2026-08-23 | Instant/offset/local types, time-zone rules, and clock-domain choices |
