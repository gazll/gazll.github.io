# Deep research dossier — DSA & LeetCode patterns

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: 19-dsa-leetcode
EN file: public/data/topics/19-dsa-leetcode.json
VI file: public/data/topics/19-dsa-leetcode.vi.json

## Scope and non-goals

This dossier audits the complete English and Vietnamese source pair for topic 19: the interview-solving framework, sliding window, LC 30 word-concatenation, two pointers, prefix sums, heaps and selection, answer-space binary search, graph traversal, dynamic programming, backtracking, monotonic structures, intervals, trees/BSTs/tries, bit manipulation, and the 15 visual traces.

The canonical ownership here is algorithmic reasoning: input predicates, invariants, proof sketches, complexity, boundary conditions, and small executable traces. Java API/runtime semantics are included only where they change implementation correctness. Java memory-model and lock design belong to [23-java-concurrency-coding.md](23-java-concurrency-coding.md); object-oriented implementation design belongs to [22-low-level-design-ood.md](22-low-level-design-ood.md); distributed top-K and rate limiting belong to [25-microservice.md](25-microservice.md) and [10-system-design-rate-limit.md](10-system-design-rate-limit.md).

Non-goals:

- no change to either runtime content file;
- no claim that a particular pattern is universally fastest;
- no benchmark conclusion without workload, runtime, hardware, warm-up, and measurement method;
- no conversion of interview heuristics into claims about every interviewer or company;
- no production treatment of distributed caches, queues, locks, or consistency.

Evidence-policy note: a discovery ceiling of 200 candidate URLs was available for this broad unit. The selected ledger contains 39 distinct substantive sources: algorithm-course material, original or near-original papers, current Java 25 API/JLS references, Unicode standards, and exact first-party problem statements. Search-result pages, duplicate explainers, and unsupported benchmark posts were not counted.

## Local content map

The complete EN and VI files were read before this dossier was written. They contain three sections, 27 items, and matching stable IDs. The draft is useful, but several claims are too absolute for a reference-quality topic.

| Section and IDs | Current emphasis | Research assessment |
| --- | --- | --- |
| The solving framework & core patterns, q1–q4 | Six-step communication, fixed/variable windows, LC 30, converging/fast-slow pointers | Keep as an interview workflow and recognition introduction. Mark interviewer behavior as heuristic and make pointer movement depend on an explicit invariant. |
| The patterns that keep coming up, q1–q8 | Prefix sum, top-K, answer-space search, graphs, DP/backtracking, monotonic stack/deque, trees/BST/trie, bits | Keep the family map. Add preconditions, tie/endpoint rules, complexity parameters, and negative examples. |
| The 15 patterns, traced step by step, q1–q15 | Visual traces for two pointers, windows, binary search, frequency, spiral, stack, prefix sum, intervals, greedy, top-K, backtracking, trees, graphs, level BFS, DP | Keep traces as worked examples, not proofs. Remove or source anecdotal runtime/JDK-history claims. |

The ID contract is critical: every future editorial change must preserve all 27 EN IDs and all 27 VI IDs. The section title displayed for the visual group is not a storage key; the item IDs are.

## Evidence and claim labels

Future content should distinguish:

- Normative fact: a problem constraint, Java specification/API guarantee, Unicode requirement, or mathematical precondition.
- Derived algorithm fact: a complexity or invariant that follows from the algorithm and input model; show parameters and proof idea.
- Recommendation: a useful interview/code-review default, not a law.
- Example: a trace chosen for teaching; it does not prove universal optimality.
- Unknown/provider limit: a fact depending on JDK, language, library, hardware, or workload.

## What is correct and reusable

- Restating the task, extracting constraints, producing a brute-force baseline, naming the invariant, and dry-running edge cases is a sound communication workflow. Present it as a recommendation for making assumptions visible, not as a universal ranking of interviewer priorities.
- A sliding window is justified when the maintained validity condition changes monotonically as a boundary moves, or when the length is fixed. A sum threshold with negative values is a counterexample to the usual positive-number shrink rule.
- LC 30 has an important local precondition: all words have equal length. Offset lanes, required-frequency counts, reset on an unknown word, and shrinking an overrepresented word are the right state transitions for the stated problem.
- Prefix sum plus a frequency map handles negative values because a prior prefix equal to current prefix minus target identifies a matching subarray. Prefix and count types must not overflow the input domain.
- For top-K, a size-K min-heap is online and memory-bounded; sorting gives ordered output and simple code; quickselect gives expected linear selection with different worst-case and determinism trade-offs.
- Answer-space binary search is valid only with a monotone feasibility predicate over a known ordered answer domain. The proof is about preserving a true/false boundary.
- BFS gives shortest edge count in an unweighted graph when traversal marks nodes consistently. Dijkstra requires non-negative weights. DFS is not inherently cheaper: standard adjacency-list versions are both O(V + E); stack shape, ordering, early exit, and recursion depth decide practical behavior.
- DP and backtracking are not opposites. Backtracking enumerates a search tree; memoization or state compression can turn repeated subtrees into DP. Output size and reconstruction matter.
- Monotonic stacks/deques obtain amortized linear behavior because each element is inserted and removed a bounded number of times. Endpoint and duplicate policy are part of correctness.
- A BST invariant is global relative to a duplicate policy. Comparing a node only with immediate children is insufficient. A trie is appropriate when the operation is prefix-oriented and alphabet/Unicode semantics are explicit.
- Java specifications and API contracts control implementation details: integer overflow is not automatically reported, a priority-queue iterator is not sorted, binary search requires sorted input, and a String index is a UTF-16 code-unit index rather than a universal user-perceived-character index.

## Claims to verify or qualify

| Claim ID | Local claim or simplification | Classification | Evidence | Required qualification |
| --- | --- | --- | --- | --- |
| C19-01 | Interviewers evaluate process more heavily than the final answer. | Unsourced heuristic | No primary evidence in local files | Rephrase as a workflow that makes assumptions and trade-offs inspectable. |
| C19-02 | The six-step framework is the way to solve an interview problem. | Recommendation | 19-01, 19-02 support the underlying habits | Call it a practical checklist and allow interviewer/domain variation. |
| C19-03 | Variable sliding windows expand and contract while pointers never move backward. | Derived fact with precondition | 19-01, 19-02, 19-13, 19-14 | State the monotonic validity condition; arbitrary negative sums can invalidate it. |
| C19-04 | LC 30 is effectively linear because word length is at most 30. | Problem-specific complexity | 19-12 | Use n, m, w and state map/hash/substring costs. “Effectively linear” is only within published constraints and the selected runtime. |
| C19-05 | Two pointers work whenever a problem has two indices. | Over-generalized | 19-02, 19-08 | Require sorted/order structure, monotone feasibility, or a functional-graph property. |
| C19-06 | Prefix sum plus HashMap is O(n). | Average-case implementation claim | 19-17, 19-27, 19-30 | State expected hash behavior and numeric bounds; pathological hashing or overflow changes the result. |
| C19-07 | Heap, quickselect, and sort have one fixed best choice. | False universal | 19-18, 19-25, 19-26, 19-35, 19-36 | Choose by k/n, streaming, memory, order, determinism, ties, and worst-case requirements. |
| C19-08 | Dijkstra is O(E log V). | Incomplete complexity | 19-02, 19-09, 19-26 | Qualify by representation and priority queue; lazy entries, decrease-key, and dense graphs change the bound. |
| C19-09 | DFS is cheaper than BFS. | Misleading comparison | 19-02, 19-03, 19-08 | Both are O(V + E) with adjacency lists; compare frontier/stack memory, ordering, early exit, and recursion risk. |
| C19-10 | Binary search on the answer is for minimize/maximize problems. | Heuristic shorthand | 19-02, 19-16 | The necessary condition is an ordered answer domain and a monotone feasibility predicate. |
| C19-11 | Greedy coin change is a general solution. | False outside a condition | 19-21 | Keep canonical denominations as an example and show a counterexample such as 1, 3, 4 for amount 6. |
| C19-12 | Monotonic stack/deque is O(n). | Amortized claim missing proof | 19-01, 19-19 | State why each item is pushed/popped at most once and define duplicate/end-point rules. |
| C19-13 | Array lookup is 5–10x faster than HashMap lookup. | Unsupported benchmark | None | Remove the number. A local benchmark must record JDK, CPU, data, warm-up, harness, and uncertainty. |
| C19-14 | Java integer arithmetic reveals overflow. | Incorrect | 19-30 | Use a wider type, checked arithmetic, or explicit bounds reasoning. |
| C19-15 | PriorityQueue can be iterated in sorted order. | Incorrect API assumption | 19-26 | Poll a copy or sort a snapshot; iteration order is not specified. |
| C19-16 | Arrays.binarySearch only returns a generic negative not-found marker. | Incomplete | 19-25 | Input must be sorted under the chosen ordering; negative output encodes an insertion point. |
| C19-17 | Java String character indexing equals user-perceived character indexing. | Incorrect outside ASCII/BMP assumptions | 19-31, 19-32, 19-38 | Distinguish UTF-16 code units, code points, grapheme clusters, normalization, and problem alphabet. |
| C19-18 | Redis/billions-of-items top-K belongs in this topic. | Duplicate/cross-domain | 19-18, 19-25; canonical owner topic 25 | Keep an in-memory heap trace; move distributed merge, sharding, freshness, and failure semantics. |
| C19-19 | A JDK implementation note is a language guarantee. | Version/provider limit | 19-25 through 19-30 | Separate specification/API from implementation note and record the JDK version. |
| C19-20 | A visual trace proves the algorithm. | Category error | 19-01 through 19-11 | Mark it as an example and pair it with an invariant and a small oracle. |

## Workload, invariants, authority, and failure model

### Workload and authority

Algorithm choice depends on the workload model. Each future answer should expose n, m, k, V, E, word length, value range, duplicate policy, output-order requirement, and whether the input is a stream or reusable collection.

| Authority layer | Establishes | Does not establish |
| --- | --- | --- |
| Problem statement and constraints | Valid input alphabet/ranges, equal-length words, required output, and allowed order | Production performance outside those constraints |
| Mathematical invariant/proof | Correctness and complexity for the stated model | JIT, cache, allocation, GC, or provider performance |
| Java SE/JLS/Unicode specification | Overflow, shifts, String indexing, collection contracts, ordering guarantees | A universal benchmark or different library’s behavior |
| Library implementation note | A current implementation’s complexity/data structure | A permanent cross-version guarantee |
| Local benchmark | A measured comparison for a named workload/environment | General “array is X times faster” conclusions |
| Interview heuristic | A communication/time-management default | A claim about every interviewer/company |

### Invariant matrix

| Family | Workload assumption | Core invariant | Proof obligation |
| --- | --- | --- | --- |
| Fixed window | Exactly k elements | Window contains the declared range and aggregate updates once | Induction over each shift |
| Variable window | Validity becomes recoverable by moving a boundary | After contraction, the chosen boundary is valid and minimal/maximal for the current other boundary | Prove monotonicity; name counterexamples |
| Two pointers | Sorted order, partition, or functional graph | Discarded region cannot contain a solution | Order/monotonicity or relative-speed proof |
| Prefix plus map | Associative addition in chosen numeric type | Prior prefix equals current prefix minus target exactly when subarray matches | Numeric bounds, sentinel, duplicate-prefix frequency |
| Frequency map | Equality/normalization policy is defined | Counts describe processed state, not accidental whole-input state | Key equality, Unicode, count overflow |
| Top-K heap | Online/bounded-memory selection | Root is weakest retained candidate | Comparator, tie policy, heap size, output ordering |
| Quickselect | Selection boundary only | Partition relation holds and recursion enters target side | Expected/worst-case bound and duplicates |
| Answer-space search | Ordered answer domain and monotone predicate | Search interval brackets the boundary and shrinks | Boundary proof, termination, overflow-safe midpoint |
| BFS/DFS | Graph representation and identity defined | Visited/finished policy prevents repeated work | Directed/undirected semantics and disconnected components |
| Dijkstra | Non-negative edge weights | Extracted minimum tentative distance is final | Reject negative weights; handle stale heap entries |
| DP | State contains all continuation information | Recurrence/base/order cover every valid state | State sufficiency, transition proof, reconstruction |
| Backtracking | Search tree represents choices | Undo restores exact parent state | No leaked mutation; pruning is sound; output cost is explicit |
| Monotonic stack/deque | Dominance relation and active range defined | Order and active indices remain valid after each push/pop | Strict/non-strict comparison and endpoints |
| Intervals/spiral | Closed/half-open endpoint convention | Resolved and unresolved regions partition input | Sort key, ties, empty row/column guards |
| Trees/BST/trie | Node/key/alphabet semantics defined | Traversal covers reachable nodes; BST bounds hold globally | Null, duplicates, recursion, Unicode |
| Bits | Width and signedness explicit | Operations preserve intended fixed-width representation | JLS shift/overflow rules; BitSet/BigInteger choice |

### Failure and crash windows

| Window | Defect | Consequence | Prevention/test |
| --- | --- | --- | --- |
| Before validation | Unbounded n, m, graph, or recursion depth | OOM, StackOverflowError, or algorithmic DoS | Bound input and use iterative forms where needed |
| Window update | Count changed after boundary or over-limit token not removed | Valid answer skipped or invalid window reported | Assert state after each transition on small traces |
| Prefix update | Missing sentinel or int overflow | Index-zero matches disappear or false matches appear | Prove numeric type and compare with brute force |
| Heap comparator | Reversed threshold or subtracting ints | Wrong top-K or comparator contract failure | Compare methods, explicit ties, property tests |
| Binary boundary | Interval does not shrink or predicate is non-monotone | Infinite loop or plausible wrong answer | Empty/singleton/all-false/all-true/adjacent-boundary tests |
| Recursion/undo | Depth follows input or mutation leaks | Stack overflow, exponential blow-up, state contamination | Iterative alternative, restoration assertions, pruning counters |
| Shortest path | Negative edge or premature finalization | Wrong distances with a terminating program | Validate weights and differential-test small graphs |
| Text/bit boundary | Surrogate, shift width, signed shift, or high bit ignored | Incorrect Unicode or signed-bit result | Non-BMP text, negative numbers, width-edge tests |
| Shared collection | PriorityQueue/HashMap/BitSet mutated concurrently | Race or nondeterministic logical result | Single ownership or topic 23’s documented concurrency boundary |

## Best-practice decision matrix

| Need | Prefer | Invariant to state | Typical bound | Do not claim |
| --- | --- | --- | --- | --- |
| Fixed-length aggregate | Fixed window | Exactly k active elements | O(n), usually O(1) extra state | Variable shrinking is valid |
| Monotone valid region | Variable window | Counts/predicate valid after contraction | Often O(n) expected | Negative sums preserve the rule |
| Pair in sorted data | Converging pointers | Discarded side cannot contain answer | O(n) after sorting | Unsorted input has the same proof |
| Target sum with negatives | Prefix plus map | Prior prefix = current minus target | O(n) expected, O(n) space | Hashing is worst-case constant time |
| Online top-K | Size-K min-heap | Root is weakest retained item | O(n log k), O(k) space | PriorityQueue iteration is sorted |
| Selection only | Quickselect | Partition relation around rank | O(n) expected; worst depends on pivot | Deterministic linear time without its algorithm |
| Feasible objective | Binary search on answer | Feasibility has one boundary | O(log R) predicate calls | Objective wording proves monotonicity |
| Reachability/shortest hops | BFS | First discovery has minimum edge depth | O(V + E) | Weighted shortest paths |
| General traversal | DFS/iterative DFS | Visited/active states are coherent | O(V + E) | DFS is always cheaper/safer recursively |
| Non-negative weighted paths | Dijkstra | Extracted minimum is final | Heap/representation dependent | Negative edges are safe |
| Repeated subproblems | DP | State, recurrence, base, order | States × transition cost | Memoization fixes insufficient state |
| Output enumeration | Backtracking | Undo restores parent | Output-sensitive, often exponential | Pruning is automatically sound |
| Next greater/window extremum | Monotonic stack/deque | Dominated active indices removed | O(n) amortized | Duplicate semantics are interchangeable |
| Interval merge | Sort then scan | Sorted prefix fully resolved | O(n log n) | Tie rules can stay implicit |
| BST validation | Global bounds/stack | Whole-subtree ordering holds | O(n), O(h) auxiliary | Immediate-child checks suffice |
| Large bit vector | BitSet/BigInteger as appropriate | Representation matches width | Depends on represented words/bits | int/long rules extend automatically |

## Coverage matrix

| Required area | Local coverage | Evidence quality | Treatment before integration |
| --- | --- | --- | --- |
| Definitions | Pattern names/templates are strong | Good | Add precise trigger/precondition beside each pattern |
| Invariants | Present in some answers, implicit in traces | Partial | State invariant before code and after transitions |
| Workload | Basic n constraints; LC 30 is explicit | Partial | Parameterize n/m/k/V/E/w, range, stream/batch, order |
| Failure/crash | Edge cases are mentioned | Partial | Add overflow, recursion, allocation, comparator, negative-edge windows |
| Retries/timeouts | Not applicable to ordinary solutions | N/A locally | Keep distributed retry prose in system topics |
| Operations/recovery | Complexity discussed; telemetry sparse | Partial | Add profiling/benchmark boundary and resource ceiling |
| Security/privacy | Mostly absent | Partial | Add input-size/algorithmic-DoS, adversarial keys, Unicode, redaction |
| Testing | Dry runs and edge cases | Partial | Add oracle, property/differential tests, seeds, adversarial boundaries |
| Domain trade-offs | A few interview/company examples | Weak | Retain examples without company-frequency claims; link canonical owners |

## Contradictions, version limits, and provider limits

| Simplification | Counterexample/limit | Resolution |
| --- | --- | --- |
| Sliding window solves subarray sum | Negative values make a sum predicate non-monotone | Use prefix sums unless the input domain proves monotonicity |
| O(n) is always faster | Allocation, cache, GC, JIT, distribution, and output cost matter | Separate asymptotic proof from measurement |
| PriorityQueue is sorted | API specifies heap-head retrieval, not ordered iteration | Poll a copy or sort a snapshot |
| binarySearch returns only a negative marker | It requires sorted input and encodes insertion point | Teach the complete contract |
| Java char is a character | UTF-16 code units differ from code points/graphemes | State ASCII/BMP assumption or use suitable text semantics |
| Dijkstra is universal | Negative edges violate correctness | State alternatives and reject invalid input |
| Recursion is cleaner | Input-sized depth can crash | Offer iterative forms and state stack budget |
| Array beats HashMap by fixed factor | Runtime/workload/hardware vary | Remove the number unless a reproducible benchmark is supplied |
| Current JDK note is permanent | Implementation changes across versions | Record JDK 25 and distinguish API from implementation |
| Visual trace is proof | One trace misses branch and boundary classes | Pair trace with invariant and oracle |

## Negative evidence and anti-patterns

- Do not choose a pattern from a keyword without writing the predicate, order, and invariant.
- Do not use variable-window shrinking for a sum threshold with arbitrary negative values.
- Do not call a hash-map solution worst-case O(1) without the expected-hash assumption.
- Do not use int subtraction as a comparator or unsafe midpoint arithmetic.
- Do not treat PriorityQueue iteration, HashMap order, or BitSet thread safety as stronger than the Java API.
- Do not validate a BST only against immediate children.
- Do not use Dijkstra with negative edges or finalize a weighted node on first discovery.
- Do not turn a pruning heuristic into a proof without showing that discarded branches cannot contain answers.
- Do not call a recurrence DP until the state contains all information needed for the continuation.
- Do not use recursion against unbounded external input without a depth/memory plan.
- Do not report a toy benchmark as a language/library law; record warm-up, repetitions, input distribution, allocation/GC, output cost, and runtime.
- Do not expand the visual traces by duplicating distributed top-K, rate limiting, or cache policy from their canonical topics.

## Security, operations, and testing

### Security and resource safety

Treat n, m, k, word length, graph edges, recursion depth, and alphabet size as resource controls when input is external. Bound them before allocation. Hash-based approaches rely on expected hashing; adversarial keys require bounded work or a safer representation. Do not log raw strings, tokens, or graph payloads that may contain personal data. Unicode normalization, confusables, code points, and grapheme boundaries are correctness and sometimes security boundaries. Exponential output, deep recursion, huge maps, and backtracking can become algorithmic denial of service.

### Operations and measurement

For a productionized algorithm, record input-size distribution, queue/stream lag, p50/p95/p99, allocations/GC, CPU, peak memory, error/timeout rate, and result-size distribution. Keep correctness separate from JIT/hardware observations. Benchmark with a named JDK and representative data using a proper harness; compare with a brute-force oracle on small cases.

### Testing

- Use a simple brute-force oracle for small arrays, strings, graphs, and interval sets.
- Use properties for window counts, prefix-map results, heap size/threshold, BST ordering, graph reachability, interval coverage, and backtracking restoration.
- Differential-test BFS/DFS reachability, Dijkstra on non-negative graphs, and DP against exhaustive enumeration on small domains.
- Include empty, singleton, all-equal, duplicate, max/min integer, negative, disconnected, cyclic, self-loop, overflow-adjacent, non-BMP, and invalid-input cases.
- Persist random seeds and failing inputs; a green rerun without the failure case is not evidence.
- If a trace claims amortized O(n), instrument pushes/pops and assert the bound on generated inputs.

## Duplicate / canonical ownership

| Repeated subject | Canonical owner | Topic 19 action |
| --- | --- | --- |
| JVM integer, String, collection, and implementation semantics | [01-java-core-jvm.md](01-java-core-jvm.md) and [02-java-8-25-java-vs-go.md](02-java-8-25-java-vs-go.md) | Keep only facts needed to prevent algorithm bugs |
| Java Memory Model, locks, atomics, shared collections | [23-java-concurrency-coding.md](23-java-concurrency-coding.md) | Mention ownership/thread-safety boundary; do not duplicate |
| Query/index/database performance | [18-query-optimization.md](18-query-optimization.md) | Keep primitives; move database workload tuning |
| Distributed top-K/cache/sharding/aggregation | [25-microservice.md](25-microservice.md) | Keep in-memory heap trace; cross-reference distributed semantics |
| Rate limiter algorithms and quota authority | [10-system-design-rate-limit.md](10-system-design-rate-limit.md) | Do not turn token/window trace into a distributed design |
| Object boundaries and implementation patterns | [22-low-level-design-ood.md](22-low-level-design-ood.md) | Cross-link for testable object contracts |
| Property/concurrency/load testing | [26-testing-strategy.md](26-testing-strategy.md) | Keep algorithm oracles/properties; link for portfolio guidance |

## Integration record (Batch I scope)

Batch I integrated `19-dsa-leetcode.the-solving-framework-core-patterns.q5` in EN/VI. The item separates correctness proof, complexity accounting, measurement, and regression evidence, and makes preconditions, oracles, amortized work, Java API behavior, JIT/GC and benchmark scope explicit.

Topic 19 remains the canonical home for algorithmic patterns and interview proof; Topic 22 owns object-level design and Topic 26 owns the broader testing portfolio. The new item does not duplicate distributed top-K, cache, rate-limit or concurrency mechanisms.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] q1: keep six steps, replace universal interviewer claims with a recommendation, and add invariant/proof checkpoint.
- [ ] q2: define windows by predicate monotonicity and retain the negative-number counterexample.
- [ ] q3: state LC 30 equal-word-length/lowercase constraints, n/m/w, duplicate counts, offsets, and runtime assumptions.
- [ ] q4 and visual q1: state sorted/order/functional-graph preconditions.
- [ ] Prefix q1 and visual q7: justify numeric type and sentinel prefix.
- [ ] Top-K q2 and visual q10: compare sort, heap, quickselect by streaming, memory, order, ties, and worst case.
- [ ] Answer-search q3 and visual q3: write the feasibility predicate and boundary invariant before the loop.
- [ ] Graph q4 and visual q13/q14: correct DFS/BFS wording, qualify Dijkstra, and state representation/recursion assumptions.
- [ ] DP/backtracking q5 and visual q11/q15: separate enumeration from state reuse and output-sensitive cost.
- [ ] Stack/deque/interval q6 and visual q5/q6/q8: add endpoint/duplicate semantics and amortized proof sentence.
- [ ] Tree q7 and visual q12: keep global BST bounds, trie alphabet, and recursion warning.
- [ ] Bit q8 and visual q4/q7/q14: remove the 5–10x benchmark and unsupported JDK-history anecdote; add JLS/Unicode/API qualifications.
- [ ] Cross-link distributed top-K to topic 25 and preserve all 27 EN/VI IDs.

## EN/VI parity and cross-reference plan

The EN and VI sources currently have matching three-section structure, 27 IDs, and non-empty answers. Future integration must update both files together, preserve IDs exactly, and translate claim strength equally: must, should, example, heuristic, provider-specific, and unknown cannot be weakened or strengthened in translation.

Keep identifiers, asymptotic symbols, constraints, endpoint notation, Java class/method names, and problem numbers unchanged. Use the same visual trace order. Cross-links should point to canonical topics instead of copying paragraphs into topic 19 and another dossier.

## Open questions and falsifiers

- [ ] Which Java baseline is the learning target: 17, 21, 25, or language-neutral algorithms? A JDK claim is falsified for this dossier if the target baseline differs materially.
- [ ] Are all string questions intentionally ASCII/lowercase, or should the topic teach code points and user-perceived characters?
- [ ] What maximum n, graph depth, output size, and memory budget should examples assume? Recursion is falsified as a default if input exceeds call-stack budget.
- [ ] Should ties in top-K, intervals, BST duplicates, and output lists be deterministic?
- [ ] What would falsify the six-step interview recommendation? Consistent local interview evidence showing it harms time or communication would change the recommendation.
- [ ] What would falsify a sliding-window solution? A generated negative-value/non-monotone counterexample violating its stated invariant.
- [ ] What would falsify answer-space binary search? A feasible predicate with multiple feasible regions or an unprovable boundary.
- [ ] What would falsify a benchmark? Changed JDK/CPU/input distribution, insufficient warm-up, allocation/GC confounding, or unreported output-cost differences.
- [ ] What would falsify the canonical split? A later dossier whose primary subject is algorithmic proof rather than distributed/object ownership, or the reverse.

## Source-to-claim mapping

The ledger IDs are the only source identifiers used in this dossier. This mapping is claim-oriented; it does not inflate the count with duplicate sources.

| Mapping | Claim supported | Sources |
| --- | --- | --- |
| M19-01 | Algorithm families, graph search, heaps, DP, and proof-oriented teaching | 19-01, 19-02, 19-07, 19-08, 19-09, 19-10 |
| M19-02 | BFS queue/visited behavior and unweighted shortest paths | 19-03, 19-04, 19-08 |
| M19-03 | DP state/reuse and worked correctness reasoning | 19-05, 19-06, 19-21, 19-22 |
| M19-04 | LC 30 constraints, equal word length, duplicates, output | 19-12 |
| M19-05 | Sliding-window and prefix-sum boundaries | 19-13, 19-14, 19-15, 19-17 |
| M19-06 | Answer-space feasibility example | 19-16, 19-25, 19-02 |
| M19-07 | Top-K problem shape and frequency selection | 19-18, 19-25, 19-26 |
| M19-08 | Monotonic stack and interval examples | 19-19, 19-20 |
| M19-09 | Greedy counterexample and backtracking output | 19-21, 19-22 |
| M19-10 | Tree/BST and grid-graph constraints | 19-23, 19-24, 19-08, 19-09 |
| M19-11 | Java binary-search sorted precondition/insertion point | 19-25 |
| M19-12 | Java heap head/complexity/iterator/thread-safety contract | 19-26 |
| M19-13 | Java expected HashMap complexity and order/thread boundary | 19-27 |
| M19-14 | ArrayDeque/Deque behavior and amortized operations | 19-28, 19-29, 19-39 |
| M19-15 | Java overflow and shift semantics | 19-30 |
| M19-16 | UTF-16/code-point and Unicode segmentation boundary | 19-31, 19-32, 19-38 |
| M19-17 | BitSet and arbitrary-precision alternatives | 19-33, 19-34 |
| M19-18 | Quickselect-style and deterministic selection | 19-35, 19-36 |
| M19-19 | Functional-cycle analysis and tortoise/hare scope | 19-37 |
| M19-20 | API contract versus implementation note | 19-25, 19-26, 19-27, 19-39 |

## Source ledger

All selected sources were reviewed on 2026-08-23. Tier A is a specification, official API, official problem statement, or university course source. Tier B is original/first-party research or publisher-hosted primary material. Versioned statements are intentionally scoped.

| ID | Source | Tier/revision | Distinct evidence |
| --- | --- | --- | --- |
| 19-01 | [MIT 6.006 Spring 2020 lecture notes](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/) | A; course page | Course coverage of heaps, graph search, shortest paths, DP, trees, and analysis |
| 19-02 | [MIT 6.006 Spring 2020 course PDF](https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/d9265b3b33d238ff914b0223ac8e7628_MIT6_006S20_r10.pdf) | A; Spring 2020 | Invariants, graph exploration, complexity, and proof reasoning |
| 19-03 | [MIT 6.006 BFS lecture](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/8f89fd0ad2e9af6dbe075dd503e81d18_MIT6_006F11_lec13_orig.pdf) | A; Fall 2011 | BFS queue/depth behavior |
| 19-04 | [MIT 6.006 BFS recitation](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/6d8aaabf67d391877f978172b293d7be_MIT6_006F11_rec13.pdf) | A; Fall 2011 | Adjacency-list/matrix and BFS implementation trade-offs |
| 19-05 | [MIT 6.006 Dynamic Programming subproblems](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/28461a74f81101874a13d9679a40584d_MIT6_006S20_lec16.pdf) | A; Spring 2020 | DP state, recurrence, and reuse |
| 19-06 | [MIT 6.006 problem-set solutions](https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/23d4cf5421c77bb55b3735f7e8f70dfe_MIT6_006S20_ps5_solutions.pdf) | A; Spring 2020 | Worked correctness and complexity exercises |
| 19-07 | [MIT 6.006 Fall 2011 final](https://www.ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/c316e062020649db5cda5785036c6fb8_MIT6_006F11_final.pdf) | A; Fall 2011 | Assessment examples for algorithm choice and edge conditions |
| 19-08 | [Princeton Algorithms undirected graphs keynote](https://algs4.cs.princeton.edu/lectures/keynote/41UndirectedGraphs.pdf) | A; course material | BFS/DFS and graph traversal |
| 19-09 | [Princeton Algorithms shortest paths keynote](https://algs4.cs.princeton.edu/lectures/keynote/44ShortestPaths-2x2.pdf) | A; course material | Weighted shortest paths and priority queues |
| 19-10 | [Princeton Algorithms union-find keynote](https://algs4.cs.princeton.edu/lectures/keynote/00Intro%2B15UnionFind.pdf) | A; course material | Connectivity as a distinct tool |
| 19-11 | [Princeton COS 226 final report](https://algs4.cs.princeton.edu/home/CS2013-final-report.pdf) | A; curriculum report | Curriculum map for queues, graphs, strings, and structures |
| 19-12 | [LeetCode 30: Substring with Concatenation of All Words](https://leetcode.com/problems/substring-with-concatenation-of-all-words/) | A; current problem statement | Equal word length, lowercase bounds, duplicates, and output |
| 19-13 | [LeetCode 3: Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | A; current problem statement | Variable-window distinct-character constraint |
| 19-14 | [LeetCode 76: Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/) | A; current problem statement | Count-based contraction predicate |
| 19-15 | [LeetCode 239: Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) | A; current problem statement | Fixed-window deque shape |
| 19-16 | [LeetCode 410: Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/) | A; current problem statement | Feasibility predicate for answer search |
| 19-17 | [LeetCode 560: Subarray Sum Equals K](https://leetcode.com/problems/subarray-sum-equals-k/) | A; current problem statement | Prefix-sum counting shape |
| 19-18 | [LeetCode 347: Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/) | A; current problem statement | Top-K frequency output and order scope |
| 19-19 | [LeetCode 739: Daily Temperatures](https://leetcode.com/problems/daily-temperatures/) | A; current problem statement | Next-greater monotonic stack |
| 19-20 | [LeetCode 56: Merge Intervals](https://leetcode.com/problems/merge-intervals/) | A; current problem statement | Sort-and-scan interval invariant |
| 19-21 | [LeetCode 322: Coin Change](https://leetcode.com/problems/coin-change/) | A; current problem statement | Limits of greedy coin change |
| 19-22 | [LeetCode 78: Subsets](https://leetcode.com/problems/subsets/) | A; current problem statement | Backtracking/enumeration output |
| 19-23 | [LeetCode 98: Validate Binary Search Tree](https://leetcode.com/problems/validate-binary-search-tree/) | A; current problem statement | Whole-subtree BST ordering |
| 19-24 | [LeetCode 200: Number of Islands](https://leetcode.com/problems/number-of-islands/) | A; current problem statement | Grid graph traversal and visited state |
| 19-25 | [Java Arrays, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html) | A; Java SE 25 API | binarySearch contract and implementation-note boundary |
| 19-26 | [Java PriorityQueue, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) | A; Java SE 25 API | Heap head, bounds, unordered iterator, synchronization |
| 19-27 | [Java HashMap, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) | A; Java SE 25 API | Expected map complexity, order, synchronization |
| 19-28 | [Java ArrayDeque, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html) | A; Java SE 25 API | Deque operations, null, amortized bound, thread boundary |
| 19-29 | [Java Deque, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Deque.html) | A; Java SE 25 API | Queue/deque operation semantics |
| 19-30 | [Java Language Specification, JDK 25](https://docs.oracle.com/javase/specs/jls/se25/jls25.pdf) | A; Java SE 25 | Integer arithmetic, shifts, signedness, overflow |
| 19-31 | [Java String, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html) | A; Java SE 25 API | UTF-16 indexing and code-point methods |
| 19-32 | [Java Character, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Character.html) | A; Java SE 25 API | Code-unit/code-point representation |
| 19-33 | [Java BigInteger, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigInteger.html) | A; Java SE 25 API | Arbitrary precision and cost boundary |
| 19-34 | [Java BitSet, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/BitSet.html) | A; Java SE 25 API | Growable bit-vector and thread-safety contract |
| 19-35 | [Hoare, Algorithm 65: FIND](https://doi.org/10.1145/366622.366647) | B; original CACM paper metadata | Quickselect-style selection origin |
| 19-36 | [Selection in Worst Case Linear Time](https://www.sciencedirect.com/science/article/pii/S0022000073800339) | B; original research paper | Deterministic linear selection guarantee |
| 19-37 | [Sedgewick, The Complexity of Finding Cycles in Periodic Functions](https://sedgewick.io/wp-content/themes/sedgewick/papers/1982Cycles.pdf) | B; research paper | Tortoise/hare cycle-finding context |
| 19-38 | [Unicode Standard Annex #29: Text Segmentation](https://unicode.org/reports/tr29/) | A; current versioned annex | Grapheme/word/sentence boundary distinction |
| 19-39 | [Java Collections Framework overview, JDK 25](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/doc-files/coll-overview.html) | A; Java SE 25 API | Collection contracts and interface/implementation boundary |

## Gate status

- [x] Complete EN/VI source pair read; section/item inventory recorded.
- [x] Candidate-source ceiling and no-padding selection policy recorded.
- [x] Workload, invariants, authority, crash windows, contradictions, provider/version limits, negative evidence, security, operations, and testing coverage recorded.
- [x] Duplicate/canonical ownership and EN/VI parity plan recorded.
- [x] Source-to-claim mapping and 39-source ledger recorded.
- [ ] Editorial changes integrated into public/data.
- [ ] Browser/content validation run after a future integration change.
