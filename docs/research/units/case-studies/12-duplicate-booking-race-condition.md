# Research — Duplicate booking race condition: HTTP method, row version, and intent

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `12-duplicate-booking-race-condition`

EN file: `public/data/case-studies/articles/12-duplicate-booking-race-condition.html`

VI file: `public/data/case-studies/articles/12-duplicate-booking-race-condition.vi.html`

Metadata: the paired case-study metadata JSON and article files were read in full.

## Scope and evidence posture

This case is a debugging and design lesson about duplicate booking under concurrent requests: a multi-instance Java backend, a stateful booking session, a one-second timestamp token, a `HEAD` request routed like `GET`, and the eventual integer `VERSION` conditional update. It is repository-authored case evidence; the reported request timings, blocked-user-agent history, and framework behavior are not independently verified production telemetry in this record.

The discovery pool was about 35 candidates. The 22 selected sources are HTTP standards, database documentation, provider idempotency contracts, security guidance, and concurrency references. Search-result anecdotes and “just use synchronized” blog posts were excluded.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `context` | OTA Python web tier, Java booking backend, GDS and `SESSION_INFO` state. |
| `evidence` | Two requests 2 ms apart, 25 ms read/write window, multi-instance deployment and grouped session query. |
| `race` | Concurrent state transition and duplicate side effect. |
| `false-fix` | User-agent/google-bot block as an incorrect diagnosis. |
| `recurrence` | Alert quiet period and later `HEAD` recurrence. |
| `correct-fix` | Integer `VERSION`, conditional update, affected-row winner, `HEAD` rejection. |
| `verification` | Two/five concurrent tests, ordinary version increments, `HEAD` test and injected delay. |
| `limits` | One-session row protection versus cross-session idempotency/unique constraints. |
| `takeaways` | Summary. |
| `anonymisation` | Removal of identifying details. |

EN/VI sections and IDs are paired. The parity risk is that a method-safety warning, version-token rule, and “one row only” limit must be equally explicit in both languages.

## What is correct and reusable

- A process-local Java `synchronized` block or cache cannot serialize a booking across multiple backend instances.
- A timestamp with one-second precision is not a safe optimistic-concurrency version when two writes can occur in the same second.
- A conditional update such as `WHERE key = ? AND version = ?`, followed by checking affected rows, gives a database-level winner for one session row.
- `HEAD` is defined by HTTP as safe and idempotent and should not trigger a booking side effect. The application/framework must reject or correctly dispatch it; user-agent blocking is not a correctness control.
- A row version protects one row/entity transition. It does not deduplicate the same business intent across different sessions, retries, providers, or order rows; that needs an idempotency key and durable uniqueness scope.
- Testing with a deterministic delay between read and write is an effective way to turn a rare race into a reproducible test, but it does not prove all production interleavings are covered.

## Claims to verify or qualify

| Local claim/shape | Classification | Required qualification |
| --- | --- | --- |
| Requests 2 ms apart overlapped a 25 ms window | Case observation | Preserve as anonymised case evidence; add capture method/clock precision if available. It is not a benchmark. |
| Googlebot/user-agent block was the cause/fix | False diagnosis | Keep as a negative example; user-agent is attacker-controlled and does not enforce business uniqueness. |
| Framework routed `HEAD` like `GET` | Framework-specific observation | HTTP defines HEAD semantics, but routing behavior depends on framework/server/version. Cite the actual framework version or make the route explicit. |
| One-second timestamp optimistic token caused duplicate | Strong causal hypothesis | Verify timestamp precision, DB update predicate, and affected-row handling; use an integer/monotonic version or a database constraint. |
| `VERSION` conditional update solves duplicate booking | Correct for one entity transition | It selects one writer for the protected row; it does not protect cross-session duplicate intent or an external GDS side effect. |
| `synchronized`/local cache is insufficient | Verified distributed-scope fact | It can serialize one process/object only; a shared lock may serialize access but still is not business idempotency or durable authority. |
| Returning 405 for HEAD fixes all duplicates | Incomplete | It removes one accidental unsafe route; POST retries, refreshes, callbacks and concurrent valid requests still require idempotency/constraints. |
| Two concurrent tests pass | Evidence of regression | Add variable delay, multiple instances, transaction failure, timeout/late response, provider duplicate and database deadlock tests. |

## Workload, invariants, and failure model

### Workload model

The case assumes a stateful OTA flow (`Init → Booking → Complete/Error`), an HTTP endpoint that was reachable by GET/POST and accidentally HEAD, multiple application instances, a Java booking service, and an external GDS. Add request rate, session-key cardinality, transaction latency distribution, database isolation, provider timeout, retry policy, and cross-region behavior before generalizing.

### Invariants

1. A state-changing booking is never performed through GET or HEAD; allowed methods are explicit and enforced at every route/proxy layer.
2. At most one valid transition from the same session/version can win the local row update.
3. The booking intent has a durable key scoped to the business operation, not only a session row.
4. A duplicate request returns the existing result/status or a conflict, rather than creating a second reservation/PNR/payment.
5. A timeout/unknown GDS result is persisted as unknown/pending and reconciled, not retried as a new intent.
6. Cross-session/business uniqueness and external provider idempotency are separate from optimistic row versioning.

### Crash and race windows

| Window | Unsafe outcome | Control |
| --- | --- | --- |
| Two readers see same version | Both attempt booking | Conditional update/row lock plus affected-row winner. |
| Write succeeds, response lost | Client refreshes/retries | Durable idempotency key and status lookup. |
| GDS accepts, local update fails | Local system retries | Stable provider reference/status inquiry/reconciliation. |
| Local row update wins, GDS call fails | Booking marked too early or reservation stuck | State machine separates local admission from provider completion. |
| `HEAD` reaches state-changing handler | Non-user probe creates booking | Route method allowlist and 405/Allow; test via proxy/framework. |
| Timestamp wraps within precision | False equal token | Integer/DB version, compare-and-swap and sufficient width. |
| App instance dies while local lock held | Another instance proceeds without lock | Durable DB state/constraint, not process-local mutex. |
| Duplicate sessions/intent keys differ | Same customer buys twice | Business unique constraint/idempotency scope and fraud/product policy. |

## Best-practice comparison

| Mechanism | Protects | Does not protect |
| --- | --- | --- |
| HTTP method allowlist/405 | Accidental unsafe GET/HEAD dispatch | Duplicate POST, callbacks, cross-channel intent. |
| Process-local `synchronized` | Threads sharing one process/object | Other instances, restarts, queue workers, provider retries. |
| DB row lock (`FOR UPDATE`) | Concurrent transaction access to selected row | Long external call inside lock, cross-row/business duplicates, lock timeout. |
| Optimistic integer version | One entity transition; detects stale writer | Missing events, new intent key, external side effect, row deletion/recreation. |
| Unique business constraint | Same scoped intent/object uniqueness | Provider outcome, semantic equivalence, wrong key scope. |
| API idempotency key/result | Repeated same intent and response | Key expiry, payload mismatch, provider without contract, malicious key reuse. |
| External provider reference/status | Unknown provider outcome | Provider bugs, reconciliation delay, local duplicate without stable reference. |

## Coverage matrix

| Gate area | Current coverage | Gap/proposed treatment |
| --- | --- | --- |
| Definitions | Strong | Distinguish concurrency control, idempotency, uniqueness, safe HTTP methods and provider outcome. |
| Invariants | Strong for one row | Add cross-session intent and provider invariants explicitly. |
| Workload | Partial | Add multi-instance/latency/timeout/session cardinality assumptions. |
| Failure/crash windows | Partial | Add response loss, GDS unknown, row-update failure, lock/deadlock and proxy method routing. |
| Retries/timeouts | Weak | Add same-key retry, deadline budget, no new key on unknown, provider status query. |
| Operations/recovery | Partial | Metrics for affected-row conflicts, duplicate key conflict, HEAD/405 count, booking pending/unknown age, GDS reconciliation, version-skew rate. |
| Security/privacy | Partial | Add BOLA/session ownership checks, method abuse, request fingerprint privacy, PNR/PII redaction and audit. |
| Testing | Strong starting set | Add chaos/latency, cross-instance, provider callback, unique key conflict and full transaction retry tests. |
| Domain trade-offs | Strong | Keep GDS/OTA details here; generic idempotency belongs to topic 09/17. |

## Contradictions and limits

| Advice | Limit/competing guarantee |
| --- | --- |
| Reject HEAD with 405 | Correct HTTP defense, but a valid POST can still be duplicated. |
| Use `FOR UPDATE` | It serializes a selected row but can increase lock wait/deadlock and should not hold an external GDS call in the transaction. |
| Use `SKIP LOCKED` | It returns an inconsistent view and is for queue-like work, not necessarily booking correctness. |
| Use SERIALIZABLE | It can abort transactions that must be retried in full; retrying a non-idempotent provider call is unsafe. |
| Use a timestamp token | It is only safe if precision/monotonicity exceeds all relevant writes; one second did not in this case. |
| Use a UUID idempotency key | It identifies an intent only if the client reuses it and the server stores it durably with the result/effect. |
| Use user-agent/IP blocking | It may reduce noise but is spoofable, harms legitimate clients, and cannot establish a business invariant. |

## Negative evidence and anti-patterns

- Do not mutate state on GET or HEAD, even if the current browser “never” sends HEAD; crawlers, proxies, uptime checks and SDKs can.
- Do not use `synchronized`, an in-memory map, or a single-node cache as a distributed booking lock.
- Do not use wall-clock timestamps as compare-and-swap versions unless precision, monotonicity and clock semantics are demonstrated.
- Do not return success before the durable local state/result is committed.
- Do not create a new provider request after a timeout merely because the local response was absent.
- Do not assume one session ID is the same as customer/business intent; define scope and payload equivalence.
- Do not use a row version as a substitute for a unique constraint when the invariant is “one order/reference/PNR per intent.”
- Do not claim exact-once GDS booking without a provider contract and reconciliation evidence.

## Duplicate/canonical ownership

- This case owns the concrete OTA race, accidental HTTP method path, version-token fix and reproduction tests.
- Topic 09 owns generic command/provider idempotency and unknown-outcome workflow.
- Topic 17 owns HTTP/API idempotency/error semantics.
- Topic 25 owns distributed failure/retry composition; topic 08 owns broker semantics.
- Case 11/16 own flash-sale and inventory authority; do not merge their domain constraints into this OTA case.

## EN/VI parity and applied content changes (2026-08-23)

- [x] Keep the same race timeline, IDs and test matrix in both languages.
- [x] Label the request timings and historical bot-blocking evidence as case observations, not independent production benchmarks.
- [x] Add RFC 9110 method semantics and a route contract: GET/HEAD safe, POST state-changing, 405 with `Allow`.
- [x] Show integer `VERSION` compare-and-swap and affected-row winner, then link to business idempotency/unique key.
- [x] Add `UNKNOWN/PENDING` for GDS outcomes and a status/reconciliation path.
- [x] Add negative BOLA/session ownership tests and a provider callback replay test.
- [x] Explain that a local version protects one row only; do not imply it prevents cross-session duplicate booking.

## Open questions and falsifiers

- [ ] Which Java framework/server version routed HEAD to the GET handler? If it did not, the local causal story needs correction.
- [ ] What database engine/isolation/index/predicate was used? A missing/incorrect unique or conditional predicate falsifies the version-fix claim.
- [ ] Is the GDS API idempotent or queryable by a stable booking reference? If neither, the external side-effect safety claim remains unresolved.
- [ ] What is the business intent key and retention window? If retries outlive the key, a durable reference/constraint is required.
- [ ] Can a two-instance test force both requests through the same session with a crash after provider acceptance? If not tested, “duplicate solved” is only a local race result.
- [ ] Are GET/HEAD requests blocked at CDN, reverse proxy, framework, and service? A passing unit test alone does not falsify an edge routing path.

## Source ledger

All sources were reviewed on `2026-08-23`. The local case is repository-authored evidence; external sources below support protocol and mechanism claims.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | Local EN/VI case files listed above — repository case study | S3; reviewed 2026-08-23 | The anonymised timeline, state names, timestamp/version design, observed test cases and claimed fix; not independent production evidence. |
| S02 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | S1; RFC 9110 / STD 97, 2022 | GET/HEAD safe and idempotent, POST not inherently idempotent, 405/Allow and retry semantics. |
| S03 | [HEAD method](https://www.rfc-editor.org/rfc/rfc9110.html#name-head) — IETF | S1; RFC 9110 §9.3.2 | HEAD is like GET without response content and must not have side effects; exact routing remains implementation-specific. |
| S04 | [Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) — Oracle/MySQL | S1; MySQL 8.4 | `FOR UPDATE`, `NOWAIT`, `SKIP LOCKED`, lock release and inconsistent queue-like views. |
| S05 | [InnoDB Locking and Transaction Model](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-transaction-model.html) — Oracle/MySQL | S1; MySQL 8.4 | Lock/isolation behaviour and engine-specific concurrency scope. |
| S06 | [How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html) — Oracle/MySQL | S1; MySQL 8.4 | Short transactions, consistent order, lower isolation considerations and retrying the whole transaction. |
| S07 | [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — PostgreSQL | S1; current PostgreSQL 18 | Read committed/repeatable read/serializable behavior and concurrency scope. |
| S08 | [Serialization Failure Handling](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html) — PostgreSQL | S1; current PostgreSQL 18 | Serialization/deadlock retries must repeat the complete transaction; external side effects need idempotency. |
| S09 | [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) — PostgreSQL | S1; current PostgreSQL 18 | Unique/primary/exclusion constraints as durable business invariants. |
| S10 | [INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html) — PostgreSQL | S1; current PostgreSQL 18 | Atomic conflict handling useful for idempotent claims. |
| S11 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — AWS | S2; current first-party article | Stable caller intent, atomic idempotency state, late retries and semantic mismatch. |
| S12 | [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Stripe | S1; current API docs | Concrete provider key retention/parameter/concurrency semantics; not universal. |
| S13 | [DynamoDB conditional operations](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/example_dynamodb_Scenario_ConditionalOperations_section.html) — AWS | S1; current SDK example | A non-SQL compare-and-set/conditional write example and failed-condition outcome. |
| S14 | [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) — AWS | S1; current docs | Multi-item transaction scope/limits; provider-specific alternative. |
| S15 | [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) — OWASP | S2; 2023 edition | Broken authentication/authorization and unrestricted sensitive business-flow risks. |
| S16 | [Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — OWASP | S2; 2023 edition | Session/user identity comparison alone does not establish object authorization. |
| S17 | [Java Language Specification, Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) — Oracle | S1; Java SE 21 | Synchronization visibility/locking is within the Java memory/process model; it does not establish cross-process serialization. |
| S18 | [Jakarta Servlet Specification](https://jakarta.ee/specifications/servlet/6.1/jakarta-servlet-spec-6.1) — Eclipse Foundation | S1; Servlet 6.1 | Framework-level HTTP dispatch contract reference; actual routing still depends on server/framework configuration. |
| S19 | [Idempotency-Key header draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header) — IETF HTTPAPI WG | S1-draft; draft-07/expired history, not a standard | Candidate terminology and the warning that the header draft is not normative/current; do not present it as an RFC guarantee. |
| S20 | [Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF | S1; RFC 9457, 2023 | Structured conflict/validation/pending error responses; not idempotency itself. |
| S21 | [HTTP server semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) — OpenTelemetry | S1; conventions 1.44.0 family | Request method/status/route tracing and privacy-aware correlation for diagnosing HEAD/POST paths. |
| S22 | [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | S2; current web edition | Retry amplification, deadlines, jitter, retry budgets and load/failure testing. |

## Excluded discovery candidates

The IETF Idempotency-Key document was retained only as a draft/negative-evidence source; it is not cited as a final HTTP standard. “Use synchronized” posts were excluded because they do not cover multiple instances or crash recovery. Generic race-condition articles were excluded when they did not define the database predicate, affected-row result, or external side-effect boundary.

## Gate status

- [x] Complete EN/VI local sections and metadata read.
- [x] Source discovery pool broadened; selected ledger has 22 sources with draft/provider scope noted.
- [x] Local observations separated from standards-backed facts and recommendations.
- [x] Workload, invariants, crash windows, comparison, coverage, limits, anti-patterns and falsifiers recorded.
- [x] Duplicate ownership and EN/VI parity plan recorded.
- [ ] Framework/database/GDS versions verified.
- [x] EN/VI case integration applied.
- [x] Validation passed after integration.
