# Research — Java concurrency coding and proof-oriented exercises

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: 23-java-concurrency-coding

EN file: public/data/topics/23-java-concurrency-coding.json

VI file: public/data/topics/23-java-concurrency-coding.vi.json

## Scope and non-goals

This unit owns Java concurrency exercises: wait/notify, Lock/Condition, ordering, bounded queues, dining philosophers, read-heavy structures, CompletableFuture, synchronizers, atomics/CAS/ABA, virtual threads, cancellation, and JMM proofs. It is a coding/proof unit, not the canonical explanation of all JMM/runtime internals (01), network retry policy (15/17), or distributed locks (28).

The evidence target is Java SE/JDK 25, with JDK 21 virtual threads and JDK 24 monitor-pinning changes explicitly distinguished. Preview APIs are not stable production contracts.

## Discovery pool and source-selection accounting

About thirty-five candidates were considered from the JLS, Java SE 25 API contracts, OpenJDK JEPs, jcstress, and official concurrency guides. Duplicate API pages, interview blogs, and lock-free benchmark claims without a proof/workload were excluded. Twenty-five distinct sources below were selected for synchronization guarantees, cancellation/lifecycle semantics, version changes, and testing evidence.

The discovery policy allowed up to 200 candidate sources when useful; this topic stopped at the selected set because additional candidates repeated API contracts or lacked proof-oriented, versioned, and workload-specific evidence.

## Local content map

Complete EN and VI files were read. Both contain 2 sections and 9 matching IDs.

| Section | Exact item IDs and current question | Role |
| --- | --- | --- |
| Classic synchronisation problems | 23-java-concurrency-coding.classic-synchronisation-problems.q1 bounded queue wait/notify and Condition; q2 strict alternation; q3 dining philosophers; q4 read-heavy locks/copy-on-write | correctness exercises |
| Async & the modern toolkit | 23-java-concurrency-coding.async-the-modern-toolkit.q1 CompletableFuture parallel/failure/timeout; q2 Latch/Barrier/Semaphore/Phaser; q3 atomics/CAS/lock-free stack/ABA; q4 virtual threads; q5 volatile counter drill | modern APIs and proof |

VI preserves item IDs and code identifiers. Final edits must preserve the difference between “can”, “may”, “at most”, preview, and guaranteed behavior.

## What is correct and reusable

- The bounded-queue implementation correctly uses a condition loop rather than a single if, and points readers to ArrayBlockingQueue/LinkedBlockingQueue for production.
- Alternation and dining-philosopher examples teach that ordering/deadlock freedom are separate from mutual exclusion. Semaphore fairness, lock ordering, and asymmetric resource acquisition are useful alternatives.
- The read-heavy comparison correctly distinguishes ReadWriteLock, StampedLock optimistic reads, and copy-on-write’s excellent read path versus write/copy cost.
- CompletableFuture composition correctly separates parallel initiation from joining, failure policy, timeout, executor choice, and cancellation. It should explicitly say an exceptional timeout does not necessarily interrupt the underlying I/O.
- The synchronizer table is a strong decision aid: one-shot completion versus reusable phase/barrier versus permits.
- CAS/ABA/LongAdder content is valuable if it distinguishes single-variable atomicity, data-structure linearizability, approximate counters, memory reclamation, and contention.
- Virtual-thread guidance correctly says blocking-style code can scale for I/O, but downstream DB/provider capacity still needs a semaphore/bulkhead and tasks need cancellation/lifetime ownership.

## Claims to verify, qualify, or remove

| Local claim | Classification | Limitation | Proposed handling |
| --- | --- | --- | --- |
| wait must always be in while | verified API/JLS practice | condition can change/spurious wakeup/interleaving | Keep and explain predicate |
| notify is enough | unsafe simplification | another waiter may be wrong; multiple conditions need policy | Prefer notifyAll unless proof/condition queue justifies signal |
| LinkedBlockingQueue uses two locks | implementation detail | current implementation can change | Mark JDK implementation detail; use BlockingQueue contract |
| Semaphore has no ownership | verified API fact | releasing by another thread can be useful but may hide protocol bugs | Keep with ownership discipline |
| LongAdder is an exact counter | false | sum is not a consistent snapshot under concurrent updates and is unsuitable for sequence/ledger state | State approximate/statistical use |
| GC makes ABA harmless in Java | over-broad inference | GC avoids reclamation/use-after-free class of hazards, but ABA can still invalidate logical assumptions | Keep as scoped comparison, require stamp/version when identity changes |
| AtomicStampedReference solves ABA universally | incomplete | stamp overflow/algorithm invariant/reclamation and linearizability still matter | Say it detects a class of ABA, not full proof |
| lock-free means wait-free | false | lock-free system progress differs from per-thread bounded completion | Define progress properties |
| Virtual threads never pin after JDK 24 | false | monitor pinning changed; native/foreign code and other runtime cases remain | Cite JEP 491 and JFR scope |
| Do not pool virtual threads | recommendation with scope | pooling tasks is wrong when used to limit concurrency; bounded semaphores/pools may still be valid for scarce resources | Explain task-per-virtual-thread plus downstream bound |
| StructuredTaskScope in JDK 25 is final | false/current | JDK 25 API is preview/fifth preview | Mark preview and isolate example |
| StructuredTaskScope.close always waits | API semantics with scope | behavior depends on join/structure/error and preview API | cite exact API and test target build |
| CompletableFuture timeout cancels the network call | false/incomplete | orTimeout/completeOnTimeout changes stage completion; underlying task/resource cancellation needs explicit mechanism | Add cancellation test |
| commonPool parallelism is always cores minus one | default-sensitive | configured/common pool/runtime/security/container behavior can differ | Say default heuristic, inspect executor |
| volatile counter “can never reach 20m” | false | a lucky serial schedule can reach the full total; lost updates are possible, not inevitable | Replace with “not guaranteed; may be less, and 20m is possible” |
| copy-on-write is best for read-heavy data | workload recommendation | copy size, write frequency, iterator snapshot semantics and memory matter | Keep decision matrix |

## Workload, invariants, and failure model

| Dimension | Values to record |
| --- | --- |
| Threads/tasks | platform/virtual, executor, CPU quota, task count, blocking/CPU ratio |
| Shared state | ownership, invariant, atomic variables, lock order, condition predicates |
| Queue | capacity, item size, producer/consumer rate, fairness, shutdown/poison policy |
| Completion | timeout/cancellation/interrupt, child lifetime, executor shutdown |
| Contention | read/write ratio, hot key, CAS failure, lock hold time, starvation tolerance |
| SLO | throughput, p99/p999 latency, progress, memory, dropped/cancelled work |
| Proof | safety, liveness, linearizability/order, visibility, approximate/exact result |

Invariants include: queue size remains between zero and capacity; every enqueue/dequeue transition signals the right predicate; no lost interrupt/cancellation; alternation has a legal turn transition; philosopher acquisition cannot form a cycle; lock-free stack preserves nodes and ABA/version assumptions; each future completes once; cancellation releases resources; and a volatile read/write is not confused with compound atomicity.

| Failure window | Effect | Test/recovery |
| --- | --- | --- |
| wait before predicate recheck | lost/spurious wakeup or illegal dequeue | condition-loop stress test |
| interrupt while waiting | task silently continues/resource leak | preserve interrupt or propagate; test every wait |
| wrong lock order | deadlock | lock-order proof/deadlock detector/time-bounded test |
| unfair lock/semaphore | starvation | fairness/load test, not only correctness |
| barrier participant fails | BrokenBarrier/phase stuck | cancellation/arrival policy and timeout |
| future timeout | stage completes but work continues | propagate cancellation to underlying task/client |
| CAS contention/ABA | livelock or stale state | jcstress/linearizability/progress test |
| VT pinned/downstream saturated | carrier starvation/DB exhaustion | JFR and resource bulkhead |
| volatile increment race | result nondeterministic | repeat/stress; use AtomicInteger/lock/ownership |

## Coverage matrix

| Area | Evidence | Gap | Conclusion |
| --- | --- | --- | --- |
| Definitions | JLS, java.util.concurrent/atomic/locks APIs | strong | keep contracts before code |
| Invariants | queue/order/deadlock/linearizability/JMM | needs explicit proof labels | annotate safety/liveness |
| Workload | queue/contended CAS/VT/downstream | examples lack dimensions | add workload card |
| Failure/crash | interrupt/cancel/barrier/ABA/pinning | good themes | preserve table |
| Retries/timeouts | Future/gRPC/network links | timeout underlying work unclear | add cancellation boundary |
| Operations/recovery | JFR/thread dumps/executor metrics | mostly absent | link 01/20/21 |
| Security/privacy | thread names/contexts/heap dumps | underdeveloped | no secrets in task context/logs |
| Testing | jcstress and deterministic coordination | needs named suite | add stress/linearizability/fault tests |
| Domain trade-offs | exact ledger vs approximate metrics, bound resources | strong potential | distinguish business correctness |

## Best-practice comparison

| Need | Prefer | Limit |
| --- | --- | --- |
| bounded producer/consumer | BlockingQueue | shutdown/interrupt and capacity policy |
| one-shot signal | CountDownLatch | cannot reset |
| reusable phase | Phaser/CyclicBarrier | participant failure/phase lifecycle |
| resource permits | Semaphore | does not protect object invariants |
| exact single value/update | AtomicInteger/LongAdder only when semantics fit | LongAdder not a snapshot/sequence |
| complex invariant | lock/ownership/transaction | contention/hold time/deadlock proof |
| lock-free structure | CAS + linearizability/progress proof | ABA, contention, reclamation/version |
| parallel async calls | explicit executor + allOf/structured scope | failure/cancel/timeout must be designed |
| blocking high concurrency | virtual threads + downstream bulkhead | not CPU capacity or unlimited DB |
| read-heavy immutable snapshot | copy-on-write | writes allocate/copy and memory spikes |

## Contradiction/limits table

| Conflict | Resolution |
| --- | --- |
| volatile visibility versus counter correctness | visibility/order is not atomic read-modify-write |
| lock-free versus wait-free | global system progress differs from each operation’s bounded completion |
| LongAdder speed versus exact balance | LongAdder is for metrics under contention, not financial/sequence invariants |
| VT cheap versus scarce resources | task admission and DB/socket/provider capacity are separate |
| timeout versus cancellation | future completion timeout is not necessarily interruption/close of underlying work |
| JDK 24 pinning fix versus no pinning | monitors changed; native/foreign/runtime cases remain |
| structured scope versus final API | JDK 25 StructuredTaskScope is preview |

## Negative evidence and anti-patterns

- Do not use if around wait, busy-spin on a condition, call notify without a predicate proof, or ignore interrupts.
- Do not use a concurrent collection as proof that a multi-step business invariant is atomic.
- Do not call LongAdder for exact balances/IDs or AtomicStampedReference a complete ABA proof.
- Do not catch Future timeout and assume the supplier/network stopped.
- Do not submit unbounded CPU work to commonPool or create one executor per request.
- Do not use virtual-thread count as a DB/provider capacity plan or pool virtual threads merely to bound a scarce resource.
- Do not claim one observed volatile-counter output is a theorem; a particular run is illustrative only.
- Do not benchmark locks/CAS/collections without workload, contention, CPU, JDK, warm-up and correctness checks.

## Duplicate/canonical ownership

01-java-core-jvm owns JMM/GC/runtime foundations; 23 owns runnable exercises and proof tests. 04/15 own reactive/network I/O; 17 owns API idempotency; 25/28 own distributed concurrency/leases; 26 owns testing portfolio; 20/21 own operations. Keep examples linked, not duplicated.

## Operational, security, observability, and testing notes

Observe executor queue/rejection, active/completed/cancelled tasks, task age, lock contention/hold time, deadlocks, blocked threads, CAS failure, queue depth/oldest age, barrier/phase stuck, VT pinned events/carrier utilization, downstream semaphore wait, and cancellation/orphan work. Thread names, MDC, ThreadLocal/ScopedValue and heap/JFR dumps must not contain secrets or uncontrolled PII.

Use deterministic latches/barriers for functional tests; jcstress for JMM/atomic interleavings; linearizability/history checking for concurrent data structures; randomized/fairness/starvation tests; timeouts that fail the test without leaving tasks; JFR/thread dumps for pinning/deadlock; and fault tests for interrupt, cancellation, executor shutdown, queue closure, provider timeout, and DB saturation.

## Integration record (Batch H scope)

Batch H integrated `23-java-concurrency-coding.async-the-modern-toolkit.q6` in EN/VI. The item adds a resource-first contract for async fan-out: bounded admission, monotonic deadlines, failure policy, cancellation versus future completion, executor lifecycle, preview structured concurrency status, idempotent mutation recovery, and tests for orphan work.

Topic 01 remains the JVM/JMM foundation; Topic 17 owns API idempotency/deadlines; Topics 20/21 own operations; Topic 26 owns the test portfolio. This unit owns runnable Java concurrency reasoning and does not turn a timeout or virtual-thread count into a proof of cancellation or capacity.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] Add proof labels (safety, liveness, ordering, linearizability, visibility) to every exercise.
- [ ] Keep wait/notify code but add close/shutdown and interruption semantics; compare with BlockingQueue contract.
- [ ] Make strict alternation distinguish ordering from fairness and cancellation.
- [ ] Add philosopher lock-order/resource-order proof and starvation trade-off.
- [ ] Clarify ReadWriteLock/StampedLock optimistic-read validation and copy-on-write memory cost.
- [ ] Add CompletableFuture executor choice, exception aggregation, timeout versus underlying cancellation, and shutdown.
- [ ] Correct LongAdder/ABA/lock-free wording and cite API progress limits.
- [ ] Mark StructuredTaskScope JDK 25 preview and JDK 24 pinning change; do not say “never pins”.
- [ ] Correct volatile-counter answer: 20m is possible but not guaranteed; less is possible due lost updates.
- [ ] Add jcstress/linearizability test hooks and mirror all qualifiers in VI.

## EN/VI and cross-reference plan

Preserve all 9 IDs, Java class names, exception names, and code. Translate proof strength equally. Link 01 for JMM/VT foundations, 04/15 for I/O, 17 for idempotency/timeouts, 20/21 for operations, 26 for testing, and 28 for distributed leases.

## Explicit unknowns and falsifiers

- What is the target JDK/vendor and are preview flags allowed? API/status claims are falsified by the pinned compiler/runtime.
- What exact safety/liveness/linearizability property is required? A history/stress test can falsify an implementation that only “looks synchronized”.
- Does a timeout cancel the actual I/O/resource? A test observing work after future completion falsifies the claim.
- What queue rates/capacity/interrupt policy apply? A backlog/close/fault test falsifies an unbounded or shutdown-safe claim.
- Are reads approximate metrics or exact business state? A concurrent sum discrepancy falsifies use of LongAdder for exact state.
- What native/foreign/blocking paths remain with VT? JFR pinning/resource tests falsify “unbounded scalable” guidance.

Confidence: high for JLS/API/JEP contracts; medium for implementation/performance; low for benchmark conclusions without a target workload.

## Sources

| # | Source (title — organization) | Tier | Version/revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [JLS SE 25](https://docs.oracle.com/javase/specs/jls/se25/html/index.html) — Oracle | A specification | SE 25 §§17.2–17.5 | 2026-08-23 | wait/notify, JMM, happens-before, final fields |
| 2 | [JLS SE 25 PDF](https://docs.oracle.com/javase/specs/jls/se25/jls25.pdf) — Oracle | A specification | JLS 25 | 2026-08-23 | volatile/JMM/data-race semantics |
| 3 | [java.util.concurrent package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/package-summary.html) — Oracle | A API contract | Java 25 | 2026-08-23 | memory consistency, queues, futures, synchronizers |
| 4 | [BlockingQueue API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/BlockingQueue.html) — Oracle | A API contract | Java 25 | 2026-08-23 | bounded producer/consumer operations and interruption |
| 5 | [ArrayBlockingQueue API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ArrayBlockingQueue.html) — Oracle | A API contract | Java 25 | 2026-08-23 | bounded FIFO implementation contract/fairness option |
| 6 | [LinkedBlockingQueue API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/LinkedBlockingQueue.html) — Oracle | A API contract | Java 25 | 2026-08-23 | linked blocking queue contract; implementation detail caution |
| 7 | [Semaphore API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Semaphore.html) — Oracle | A API contract | Java 25 | 2026-08-23 | permits, fairness, no ownership |
| 8 | [CountDownLatch API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CountDownLatch.html) — Oracle | A API contract | Java 25 | 2026-08-23 | one-shot completion/latch memory effects |
| 9 | [CyclicBarrier API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CyclicBarrier.html) — Oracle | A API contract | Java 25 | 2026-08-23 | reusable barrier and broken phase behavior |
| 10 | [Phaser API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Phaser.html) — Oracle | A API contract | Java 25 | 2026-08-23 | dynamic phased synchronization/termination |
| 11 | [CompletableFuture API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html) — Oracle | A API contract | Java 25 | 2026-08-23 | stages, async executor defaults, timeout completion, cancellation scope |
| 12 | [ExecutorService API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html) — Oracle | A API contract | Java 25 | 2026-08-23 | submit/shutdown/cancellation/lifecycle |
| 13 | [ThreadPoolExecutor API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html) — Oracle | A API contract | Java 25 | 2026-08-23 | bounded queues, rejection, pool sizing semantics |
| 14 | [atomic package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/package-summary.html) — Oracle | A API contract | Java 25 | 2026-08-23 | CAS, AtomicStampedReference, LongAdder scope |
| 15 | [AtomicStampedReference API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/AtomicStampedReference.html) — Oracle | A API contract | Java 25 | 2026-08-23 | reference+stamp atomic update; algorithm still needs proof |
| 16 | [LongAdder API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html) — Oracle | A API contract | Java 25 | 2026-08-23 | high-contention statistics and non-snapshot sum |
| 17 | [ReentrantLock API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html) — Oracle | A API contract | Java 25 | 2026-08-23 | lock/fairness/interruptible acquisition |
| 18 | [StampedLock API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/StampedLock.html) — Oracle | A API contract | Java 25 | 2026-08-23 | optimistic read validation and non-reentrant limits |
| 19 | [ReadWriteLock API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/ReadWriteLock.html) — Oracle | A API contract | Java 25 | 2026-08-23 | read/write lock contract |
| 20 | [JEP 444 Virtual Threads](https://openjdk.org/jeps/444) — OpenJDK | A delivered JEP | JDK 21 | 2026-08-23 | VT scheduling, blocking I/O, pinning/resource scope |
| 21 | [JEP 491 Synchronize VT without Pinning](https://openjdk.org/jeps/491) — OpenJDK | A delivered JEP | JDK 24 | 2026-08-23 | monitor pinning change and remaining native/foreign cases |
| 22 | [StructuredTaskScope API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) — Oracle | A preview API | JDK 25 preview | 2026-08-23 | structured task lifetime/join/cancel and preview status |
| 23 | [JEP 505 Structured Concurrency](https://openjdk.org/jeps/505) — OpenJDK | A preview JEP | JDK 25 fifth preview | 2026-08-23 | current preview evolution |
| 24 | [jcstress](https://openjdk.org/projects/code-tools/jcstress/) — OpenJDK | A testing tool | current project | 2026-08-23 | concurrency stress harness for JVM/library/hardware correctness |
| 25 | [Java concurrency developer guide](https://docs.oracle.com/en/java/javase/25/core/concurrency.html) — Oracle | A official guide | Java 25 | 2026-08-23 | executor/atomic/synchronizer selection context |
