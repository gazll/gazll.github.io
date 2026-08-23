# Research - Low-level design, object design, and proof-oriented code

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: 22-low-level-design-ood

EN file: public/data/topics/22-low-level-design-ood.json

VI file: public/data/topics/22-low-level-design-ood.vi.json

## Scope and non-goals

This dossier audits the local LLD/OOD unit: interview framing, responsibility boundaries, LRU and TTL caches, token-bucket and sliding-window limiters, parking-lot/elevator models, SOLID, Strategy/State/Chain of Responsibility, thread safety, injected time, and deterministic concurrency testing.

It owns object-level boundaries and runnable-code reasoning. Topic 19 owns algorithmic invariants and complexity; topic 23 owns Java concurrency primitives and JMM exercises; topic 26 owns the test portfolio; topic 10 owns system-level rate limiting; topic 25 owns distributed cache/rate-limit and service failure semantics. Those units should be cross-referenced rather than copied here.

The discovery ceiling was 200 candidate sources for this broad unit. The selected ledger contains 30 distinct substantive sources: the GoF pattern source, the Liskov paper, official Java 25 API/JLS contracts, Redis/Guava/Caffeine documentation, HTTP standards, and testing/concurrency tools. Search-result pages, generic SOLID lists, interview-frequency claims, and duplicate API mirrors were excluded.

## Local content map

Both JSON files were read in full. They contain two sections, nine items, and matching non-empty item IDs.

| Section | Exact IDs | Local teaching job |
| --- | --- | --- |
| The LLD framework & classic problems | q1-q4 | HLD versus LLD framing, LRU, rate limiters, parking lot/elevator boundaries |
| Patterns in interview code | q1-q5 | SOLID, Strategy/State/Chain, thread safety, TTL store, testable/concurrency-safe design |

The local sequence is useful: clarify scope, model responsibilities, implement a core path, then discuss extension and concurrency. The main editorial risks are treating design principles as rules, presenting local in-memory code as distributed correctness, claiming O(1) without naming assumptions, and using wall-clock time or sleeps in tests.

## What is correct and reusable

- LLD should expose object responsibilities, public contracts, invariants, and extension axes before implementation details. It is not a smaller HLD diagram.
- An LRU cache needs an addressable lookup structure plus an order-maintaining structure. Java 25 LinkedHashMap can supply access order, while a hand-built map plus doubly linked list makes the invariant visible.
- A token bucket, fixed window, sliding-window counter, and exact sliding-window log make different burst, memory, and accuracy trade-offs. The implementation must name the time source, arithmetic, key scope, and concurrency boundary.
- Parking-lot and elevator examples correctly separate policy/scheduling from resource state. The model should state allocation, occupancy, payment, and transition invariants.
- SOLID is most useful when it explains a concrete change axis. It is not a checklist requiring an interface per class.
- Strategy, State, and Chain of Responsibility answer different questions: replaceable algorithm, lifecycle-dependent behavior, and sequential handling.
- A thread-safe collection does not make a multi-operation business invariant atomic. The linearization point and ownership of mutable state must be explicit.
- Injected Clock/Ticker, deterministic IDs, ports for I/O, property/model tests, and targeted interleavings make object-level correctness observable without exposing private implementation.

## Claims to verify or qualify

| Local claim or pattern | Classification | Required qualification | Evidence |
| --- | --- | --- | --- |
| LRU get/put are O(1) with a map and doubly linked list | Verified under assumptions | Hash operations are expected constant time under a suitable hash distribution; the list operations are constant time. State capacity, allocation, and synchronization costs separately. | 22-06, 22-07 |
| LinkedHashMap is automatically a thread-safe LRU | Incorrect | LinkedHashMap is not synchronized; access-order get is a structural modification. Wrap or protect it, and define compound-operation locking. | 22-07 |
| ConcurrentHashMap makes check-then-act safe | Incorrect | Individual operations and documented compound methods have contracts; a separate containsKey followed by put is still a race. | 22-09 |
| Token bucket is the best rate limiter | Over-absolute | It is a good bounded-burst model when the policy fits. Distributed state, clock, failure mode, quotas, and fairness still need design. | 22-22, 22-23 |
| Fixed window can enforce a strict per-second limit | Incomplete | Boundary bursts can exceed the intended rolling interval. Explain the approximation or use a different algorithm. | 22-22, 22-23 |
| Redis makes a distributed limiter correct automatically | Incorrect | The read-decide-update operation must be atomic, keys must be scoped, fail-open/closed must be chosen, and replication/region semantics must be tested. | 22-20, 22-21, 22-22 |
| TTL deletion happens exactly at the deadline | Incorrect | Lazy and active expiration, clock behavior, maintenance cadence, and provider version affect observation and cleanup. Expiry is a validity rule, not necessarily a precise callback. | 22-21, 22-20 |
| LRU is the best cache policy | Over-absolute | Scan resistance, frequency, weights, TTL, workload locality, and memory budget may favor LFU, W-TinyLFU, or another policy. | 22-17, 22-18, 22-20 |
| SOLID requires abstraction everywhere | Anti-pattern | Principles are decision heuristics. Abstractions should follow a real boundary or change axis; YAGNI does not excuse untestable code or unhealthy coupling. | 22-01, 22-03, 22-04 |
| Square can always extend Rectangle | False LSP example if mutation contract differs | Substitutability is behavioral and contract-based; a subtype that violates client-observable postconditions is not a valid substitute. | 22-02 |
| State is always better than a status enum | Over-absolute | State objects help when behavior and legal transitions vary; a small stable state machine can remain an enum plus a transition table. | 22-01 |
| ReentrantLock is faster than synchronized | Unsupported universal benchmark | It has different control features such as timed/interruptible/fair acquisition; performance depends on JVM, contention, critical section, and workload. | 22-10, 22-11 |
| A timeout assertion cancels the code under test | Incorrect | Some JUnit timeout modes interrupt or run in another thread, but a timeout does not prove external I/O or side effects stopped. | 22-25 |
| One jcstress pass proves a concurrent algorithm | Incorrect | jcstress is an experimental stress harness; a pass is evidence under tested schedules, not a proof of all executions. | 22-27, 22-30 |
| Sleeping makes concurrency tests deterministic | Anti-pattern | Sleep adds timing assumptions and flakiness. Use explicit barriers, latches, injected schedulers/clocks, bounded waits, and observable state. | 22-25, 22-26, 22-27 |
| An interview design must implement every class | Interview recommendation with limit | Implement the invariant-rich core and make omitted parts explicit; production code still needs complete contracts and integration tests. | Local teaching recommendation; no universal external evidence |

## Workload, invariants, and failure model

### Workload and authority model

For each exercise record the number of keys/items, request rate, concurrency, memory cap, mutation/read ratio, expiry distribution, fairness requirement, ordering requirement, input validity, and whether state is process-local or shared. Do not transfer an in-memory answer to a multi-instance service without choosing an authority and failure contract.

| Component | Invariant / authority | Main failure window | Recovery or proof obligation |
| --- | --- | --- | --- |
| LRU | Map and list contain exactly one node per key; node order reflects the declared access policy; size never exceeds capacity. | Update/eviction interleaving, duplicate node, map/list divergence, or unsynchronized access. | Encapsulate mutation, test capacity 0/1, overwrite, eviction order, and concurrent contract; use a library when its contract is sufficient. |
| Token bucket | Tokens remain in [0, capacity]; one accepted request consumes exactly its cost; elapsed time cannot mint above capacity. | Clock rollback/jump, arithmetic overflow, negative cost, concurrent refill/deduct, or process-local limits multiplied by instance count. | Inject a monotonic time source for elapsed duration, validate inputs, make the transition atomic, and choose distributed policy explicitly. |
| Sliding window log | Only timestamps in the declared interval count; accepted request is appended exactly once. | Boundary timestamp, clock skew, queue growth, duplicate request, or per-key memory exhaustion. | Define inclusive/exclusive boundary, bound memory, use stable time, and test bursts at the edge. |
| Parking lot | A spot is free or occupied, one vehicle has at most one active ticket, and a paid ticket cannot be paid again. | Two allocators select one spot, payment retry, crash after allocation before ticket persistence. | Single owner/transaction, unique ticket/spot constraints, idempotent payment command, and recovery state. |
| Elevator | A request is assigned under a declared scheduling policy; cabin movement and door state transitions are legal. | Duplicate button press, controller restart, stale assignment, or scheduler starvation. | Idempotent request identity, explicit queue ownership, persisted/reconstructed state where needed, and bounded fairness tests. |
| TTL store | An entry is readable only before its validity deadline under the declared clock; an old expiry cannot delete a replacement. | Read observes expired value, stale cleanup removes a newer version, clock change, unbounded cold keys. | Compare-and-remove by key plus value/version, lazy plus bounded active cleanup, injected time, and memory-pressure tests. |
| Object/domain model | Illegal transitions are rejected at the owning boundary; dependencies are replaceable without leaking infrastructure into the domain. | Constructor/deserialization bypass, callback reentrancy, hidden global clock/randomness, or side effect before durable decision. | Validate at boundaries, inject ports, define transition result, and test from public behavior. |

### Crash and concurrency windows

1. A process can die after an in-memory mutation and before a response. If the promise must survive restart, the object is not the authority; use durable storage or report the result as process-local.
2. A caller can time out after an external effect succeeded. Retrying a method named put, pay, reserve, or enqueue requires idempotency or status inquiry, even when the local object is thread-safe.
3. A cache loader can run concurrently or fail after a stale value was served. Define single-flight, stale-if-error, cancellation, and negative-caching behavior.
4. A rate limiter can fail while the downstream dependency is already overloaded. Fail-open protects availability for callers but can violate the downstream protection objective; fail-closed protects capacity but can deny legitimate traffic.
5. A lock can protect a local critical section while another process or external system remains unaware. Distributed authority and fencing belong to topic 28, not to a Java synchronized block.

## Best-practice comparison

| Decision | Good fit | Benefit | Cost / limit |
| --- | --- | --- | --- |
| Plain class with private state | Small, single-owner exercise | Easy to reason about and test | Not safe for shared concurrent callers without a contract |
| Immutable value/object plus pure function | Validation, pricing, policy, transformations | No shared mutation; deterministic tests | Copies/allocations and explicit state transitions |
| Composition and injected ports | Real change axis, I/O, clock, persistence, policy | Low coupling and replaceable tests | More wiring; interfaces without a consumer need are noise |
| LinkedHashMap access-order LRU | Bounded local cache with simple policy | Library implementation and clear contract | Not synchronized; approximate policy needs a different mechanism |
| Manual map + list LRU | Interview proof of data-structure invariant | Shows why O(1) operations work | More bug surface; must define synchronization and eviction callbacks |
| Token bucket | Bounded bursts and average-rate policy | O(1) state per key | Distributed consistency and clock/failure policy remain |
| Exact sliding log | Small scope where exact rolling history matters | Precise window | O(requests in window) memory and cleanup |
| Caffeine/Guava-style local cache | Production JVM local cache | Eviction, expiry, loader, stats and tested implementation | Library/version semantics and process-local scope |
| Redis-backed limiter/store | Shared state across service instances | Common authority and atomic scripts/commands | Network dependency, failover/region semantics, cost and hot keys |

## Coverage matrix

| Required area | Evidence inspected | Local coverage | Gap before integration |
| --- | --- | --- | --- |
| Definitions and object boundaries | GoF, Fowler, Java APIs | HLD/LLD, SOLID, patterns and composition are covered | Replace generic “nouns become classes” with invariant/change-axis guidance |
| Invariants and complexity | Java collections, Redis, local code | LRU, TTL, limiter, allocation and state transitions are listed | Add explicit preconditions to examples and avoid unconditional O(1) wording |
| Workload and authority | Redis/provider docs and local examples | Local versus shared state and key scope are distinguished | Add process/instance/region assumptions beside each distributed extension |
| Failure/crash windows | HTTP, Redis expiry, cache and testing docs | Timeout, stale cleanup, restart, fail-open and callback cases are covered | Add fault-injection scenarios to the integrated examples |
| Retry/timeout/cancellation | RFC 6585/9110, JUnit, CompletableFuture | 429, bounded waits and cancellation limits are noted | Ensure expected rejection is not confused with cancellation of external work |
| Operations/recovery | Caffeine/Redis and testing sources | Metrics, memory bound, cleanup, hot keys and restart scope are named | Add owner/alert/repair fields for production variants |
| Security/privacy | HTTP/API boundary and cache scope | Avoid untrusted key cardinality, secret logging, tenant leakage and unbounded input | Add tenant/key authorization and payload-size tests where examples become APIs |
| Testing/proof | JUnit, jqwik, jcstress | Example/property/contract/integration/concurrency layers are separated | Add deterministic clock and targeted interleaving fixtures |
| Domain trade-offs | GoF plus local parking/elevator/cache examples | Pattern choice is tied to change, lifecycle, routing, and state authority | Keep interview simplification labeled; do not present it as production architecture |

## Contradictions and limits

| Tension | Resolution |
| --- | --- |
| Manual LRU demonstrates the invariant versus library cache is safer in production | Keep manual code as a bounded teaching implementation; recommend LinkedHashMap/Caffeine only after stating concurrency, TTL, weight, and observability requirements. |
| In-memory rate limiter is simple versus distributed limiter is consistent across instances | They solve different scopes. The former is process-local admission; the latter adds a shared authority and network failure. |
| Lazy TTL cleanup is cheap versus expired entries consume memory | Lazy read validation is a correctness check; active sampling/heap/timing-wheel cleanup is a resource policy. Neither promises an exact deletion callback without a scheduler/contract. |
| Global lock is easiest versus fine-grained locks scale better | Global serialization may be correct for a small object; sharding/lock striping adds complexity and does not automatically preserve cross-key invariants. |
| SOLID abstraction versus YAGNI | Abstract a real variation or boundary. Keep code easy to change and test without inventing speculative extension points. |
| State objects versus enum transition table | Use state objects when behavior/data varies by state and transitions are numerous; use a table/enum when the state machine is small and explicit. |
| Stress testing versus proof | Stress explores schedules; JMM reasoning, linearization points, model tests, and invariants provide the argument. Use them together. |

## Negative evidence and anti-patterns

- Do not say “expected O(1)” without naming hash, capacity, comparator, allocation, and synchronization assumptions.
- Do not use access-order LinkedHashMap concurrently without an external synchronization policy.
- Do not write contains-then-put, read-then-increment, or check-then-remove for a business invariant and call the container concurrent.
- Do not use wall-clock currentTimeMillis for elapsed-duration arithmetic when clock jumps can change correctness; use an injected monotonic source for the interval and wall time only for timestamps.
- Do not use a periodic refill thread when lazy refill is sufficient, but do not omit active cleanup when cold-key memory is bounded by the requirement.
- Do not claim a 429 or Retry-After header makes a client retry safe; it communicates overload policy, not mutation idempotency.
- Do not let a cache store authorization-sensitive data without tenant/key isolation, invalidation, stale-data policy, and eviction telemetry.
- Do not put network, database, or user callbacks inside a lock unless their blocking and reentrancy contract is deliberate.
- Do not use Thread.sleep as a synchronization primitive or retry a flaky test until it passes.
- Do not create a deep inheritance hierarchy, a 20-method interface, or a class per pattern merely to recite SOLID.
- Do not use an unbounded queue, map, or per-key timestamp log for attacker-controlled keys without a memory/admission policy.

## Operational, security, observability, and testing notes

Measure cache hit/miss, eviction reason, size/weight, loader latency/error, stale serve, stampede/single-flight wait, TTL cleanup lag, limiter allowed/denied, key cardinality, hot-key skew, Redis latency/error/failover, lock wait, queue depth, parking allocation conflict, elevator wait/starvation, and test flake/timeout rate. Keep labels bounded and do not record raw tokens, user identifiers, or cached sensitive values.

For each production-facing variant define: owner, instance/region scope, source of time, persistence/restart behavior, fail-open/closed choice, idempotency key, maximum memory, cleanup budget, alert threshold, and repair/reconciliation path.

Testing should include:

- table tests for empty, singleton, capacity zero/one, overwrite, duplicate, expiry boundary, negative/invalid input, and deterministic tie policy;
- property tests for LRU capacity/order, token conservation, sliding-window inclusion, legal state transitions, and TTL replacement safety;
- contract tests for Redis command/script atomicity, HTTP 429/Retry-After semantics, cache loader errors, and library version behavior;
- targeted concurrency tests with barriers/latches around the linearization point, bounded timeouts, and public-state assertions;
- jcstress or equivalent stress tests for JMM-sensitive code, with outcomes interpreted as evidence rather than proof;
- restart/fault tests for any claim that survives process death or external timeout.

## Duplicate / canonical ownership

| Repeated concept | Canonical owner | Topic 22 role |
| --- | --- | --- |
| Algorithmic patterns and asymptotic proof | Topic 19 | Use only enough complexity to explain the object invariant; link for algorithm families. |
| Java JMM, atomics, locks, virtual threads | Topic 23 and topic 01 | Use API-specific implications and cross-link; do not reproduce the full JMM lesson. |
| Rate-limit algorithms and distributed admission | Topic 10 | Owns system topology, capacity, overload, and failure policy; topic 22 owns compact code and local state. |
| Cache strategy, stampede, invalidation and distributed freshness | Topic 25 and case 09 | Owns service/cache topology and freshness; topic 22 owns data-structure exercise and local policy. |
| Distributed lock/lease/fencing | Topic 28 | LLD may state that a Java lock is process-local; it does not own distributed authority. |
| Testing portfolio and fault injection | Topic 26 | Topic 22 owns deterministic object fixtures and proof obligations; 26 owns the overall test strategy. |
| Domain state machines and aggregate invariants | Topic 24 / case-specific records | Topic 22 uses parking/elevator/booking examples only to teach boundaries; cases own business authority. |

## Integration record (Batch H scope)

Batch H integrated `22-low-level-design-ood.patterns-in-interview-code.q6` in EN/VI. The item makes TTL cache correctness explicit: injected monotonic time, expired-read semantics, bounded cleanup, compare-and-remove/versioning, process-local scope, restart/distribution limits, and deterministic tests.

This is deliberately an LLD/data-structure exercise. Topic 10 owns system-wide rate-limit capacity, Topic 25 owns cache topology/freshness, Topic 28 owns distributed leases, and Topic 17 owns API idempotency. The record keeps library/provider and workload assumptions open.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] Reframe the five-step framework as a communication and invariant workflow, not a universal timed ritual.
- [ ] Add explicit preconditions and complexity assumptions to LRU, limiter, allocator, and TTL examples.
- [ ] Correct the LinkedHashMap/ConcurrentHashMap concurrency wording and state that the examples are process-local unless a shared authority is introduced.
- [ ] Replace “most widely used” and interview-frequency claims with scoped teaching language unless a source is available.
- [ ] Add monotonic/injected time to limiter and TTL code; define cleanup versus validity separately.
- [ ] Add a pattern decision table based on change axis/lifecycle/routing and an anti-overengineering example.
- [ ] Add deterministic fake-clock, property, contract, and targeted-interleaving tests; label jcstress as exploratory stress evidence.
- [ ] Mirror all qualifiers, identifiers, and code terminology in EN/VI; preserve the nine persistent IDs.

## EN/VI parity and cross-reference plan

The EN and VI files have two sections, nine matching IDs, and non-empty answers. Integration must preserve all IDs, code identifiers, formulas, status words, HTTP codes, Java method names, and complexity notation. Translate modal strength equally: “must”, “should”, “may”, “typically”, “process-local”, “provider-specific”, and “unknown” must not be weakened or strengthened in VI.

Cross-links should point to topic 10 for system-level rate limiting, topic 19 for algorithms, topic 23 for JMM/concurrency, topic 25/case 09 for distributed cache, topic 26 for test strategy, and topic 28 for distributed locking. Keep LLD-specific examples and invariants local.

## Open questions and falsifiers

- What is the target JDK and is preview API usage allowed? A source-level claim is falsified by the pinned compiler/runtime or by a different API status.
- Are the examples process-local or expected to survive restart and span instances? A restart or multi-instance test falsifies any unqualified durability/consistency promise.
- What are the maximum key count, request rate, memory budget, and expiry distribution? Allocation/latency or memory measurements can falsify the selected data structure.
- What does “fair” mean for the limiter/elevator: per-key, global, weighted, FIFO, or starvation-free? An adversarial schedule can falsify an unstated fairness claim.
- Can a targeted test observe a stale TTL cleanup deleting a replacement? If yes, key-only removal is falsified; compare-and-remove/versioning is required.
- Can a client retry after a lost response and create two external effects? If yes, local thread safety did not establish idempotency.
- Does a cache scan workload collapse hit rate under LRU? If yes, use a measured admission/eviction policy rather than the default.
- Does an abstraction reduce change cost in a real extension test? If not, the abstraction is speculative and should be removed or simplified.
- What would falsify the deterministic concurrency strategy? A test that passes only with sleeps, fails under a bounded explicit schedule, or asserts timing rather than state.

## Source-to-claim mapping

| Mapping | Claim supported | Sources |
| --- | --- | --- |
| C22-01 | LRU access-order structure, expected constant-time map operations, and lack of built-in synchronization | 22-06, 22-07 |
| C22-02 | ConcurrentHashMap is not a blanket transaction across multiple calls | 22-09 |
| C22-03 | Lock/fairness/interruptible acquisition are different controls, not a universal speed claim | 22-10, 22-11 |
| C22-04 | JMM happens-before/volatile and compound atomicity require language-level reasoning | 22-30 |
| C22-05 | Redis atomic counter/script/expiry patterns are scoped distributed mechanisms | 22-20, 22-21, 22-22 |
| C22-06 | 429 and Retry-After communicate overload/retry timing, not business idempotency | 22-23, 22-24 |
| C22-07 | Caffeine/Guava expiry, eviction, loader and test-clock behavior are library contracts | 22-17, 22-18, 22-19 |
| C22-08 | Timeout tests, property tests, and stress tests have different evidence boundaries | 22-25, 22-26, 22-27 |
| C22-09 | Strategy/State/Chain are distinct pattern intents; patterns are not mandatory architecture | 22-01 |
| C22-10 | Substitutability is behavioral and contract based | 22-02 |
| C22-11 | Composition/YAGNI/DI are design trade-offs, not interface-count rules | 22-03, 22-04, 22-05 |

## Source ledger

All sources were reviewed on 2026-08-23. “A” means a standard, official API/project document, or original paper/book. “B” means first-party engineering guidance or an authoritative secondary explanation. Provider/library behavior remains version-scoped.

| ID | Source | Type / version | Claims supported |
| --- | --- | --- | --- |
| 22-01 | [Design Patterns: Elements of Reusable Object-Oriented Software](https://www.oreilly.com/library/view/design-patterns-elements/0201633612/) | A; GoF book, 1994 | Strategy, State, Chain, composition, and pattern intent |
| 22-02 | [A behavioral notion of subtyping](https://dl.acm.org/doi/10.1145/197320.197383) | A; Liskov and Wing, ACM TOPLAS 1994 | Behavioral substitutability and contract reasoning |
| 22-03 | [Yagni](https://martinfowler.com/bliki/Yagni.html) | B; Martin Fowler, 2015 essay | Speculative complexity and evolutionary design limits |
| 22-04 | [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) | B; Martin Fowler, 2004 essay | DI as a mechanism and composition boundary |
| 22-05 | [Dependency Composition](https://martinfowler.com/articles/dependency-composition.html) | B; Martin Fowler, reviewed current | Composition, testability, and incidental coupling |
| 22-06 | [java.util package summary](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/package-summary.html) | A; Java SE 25 | Collections contract and implementation scope |
| 22-07 | [LinkedHashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedHashMap.html) | A; Java SE 25 | Access-order LRU shape, expected map complexity, synchronization limitation |
| 22-08 | [HashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) | A; Java SE 25 | Hash map performance assumptions and non-synchronized behavior |
| 22-09 | [ConcurrentHashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) | A; Java SE 25 | Concurrent operations, atomic map methods, weak ordering/snapshot limits |
| 22-10 | [ReentrantLock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html) | A; Java SE 25 | Fairness, ownership, reentrancy, timed/interruptible lock operations |
| 22-11 | [java.util.concurrent.locks package](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/package-summary.html) | A; Java SE 25 | Lock/Condition framework and trade-off against monitors |
| 22-12 | [BlockingQueue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/BlockingQueue.html) | A; Java SE 25 | Blocking, interruption, capacity and producer/consumer boundary |
| 22-13 | [ArrayDeque](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html) | A; Java SE 25 | Deque operations, null policy, and non-thread-safe scope |
| 22-14 | [PriorityQueue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) | A; Java SE 25 | Heap operations, tie ordering, comparator and complexity scope |
| 22-15 | [Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html) | A; Java SE 25 | Injectable time source and wall/monotonic boundary |
| 22-16 | [CompletableFuture](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html) | A; Java SE 25 | Async completion, timeout, cancellation and executor scope |
| 22-17 | [Caffeine design](https://github.com/ben-manes/caffeine/wiki/Design) | A; current project docs | Window TinyLFU, admission, concurrency and workload adaptation |
| 22-18 | [Caffeine eviction](https://github.com/ben-manes/caffeine/wiki/Eviction) | A; project docs revised 2025 | Size/weight/time/reference eviction, maintenance and Ticker testing |
| 22-19 | [Guava CacheBuilder](https://guava.dev/releases/snapshot/api/docs/com/google/common/cache/CacheBuilder.html) | A; current project API | Guava cache contract and Caffeine migration/version boundary |
| 22-20 | [Redis key eviction](https://redis.io/docs/latest/develop/reference/eviction/) | A; current Redis docs | LRU/LFU/TTL/noeviction policy and approximate eviction scope |
| 22-21 | [Redis EXPIRE](https://redis.io/docs/latest/commands/expire/) | A; current Redis command docs | Expiration precision, absolute time, persistence and clock caveats |
| 22-22 | [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/) | A; current Redis use-case docs | Fixed/sliding/token bucket shapes, atomic scripts and shared-instance scope |
| 22-23 | [RFC 6585 Additional HTTP Status Codes](https://www.rfc-editor.org/rfc/rfc6585.html) | A; RFC 6585, 2012 | 429 semantics and optional Retry-After |
| 22-24 | [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | A; RFC 9110, 2022 | Method/status/retry semantics and limits of HTTP idempotency |
| 22-25 | [JUnit 5 User Guide](https://docs.junit.org/current/user-guide/) | A; current JUnit guide | Timeout modes, test lifecycle, concurrency and side-effect caveats |
| 22-26 | [jqwik User Guide](https://jqwik.net/docs/current/user-guide.html) | A; current jqwik guide | Property-based generation, shrinking, seeds and reproducibility |
| 22-27 | [jcstress](https://openjdk.org/projects/code-tools/jcstress/) | A; OpenJDK Code Tools | Experimental concurrency stress testing and evidence limits |
| 22-28 | [JLS 17 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se25/html/jls-17.html) | A; Java SE 25 | Happens-before, synchronization, volatile and data-race semantics |
| 22-29 | [JEP 444 Virtual Threads](https://openjdk.org/jeps/444) | A; delivered JDK 21 JEP | Task/thread model and why cheap threads do not remove downstream bounds |
| 22-30 | [JEP 491 Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491) | A; delivered JDK 24 JEP | Version-scoped virtual-thread monitor behavior and remaining blocking cases |

## Gate status

- [x] Complete EN/VI files and exact item IDs read.
- [x] Discovery pool considered broadly; selected ledger has 30 distinct sources.
- [x] Source-to-claim mapping, workload/invariants, failure windows, coverage, contradictions/limits, negative evidence, security, operations, testing, and falsifiers recorded.
- [x] Duplicate/canonical ownership and EN/VI parity plan recorded.
- [x] EN/VI content integration applied in Batch H; validation passed on 2026-08-23.
