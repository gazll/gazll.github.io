# Research — From dual write to a reliable order workflow

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `15-transactional-outbox-order-workflow`

EN file: `public/data/case-studies/articles/15-transactional-outbox-order-workflow.html`

VI file: `public/data/case-studies/articles/15-transactional-outbox-order-workflow.vi.html`

Metadata: `public/data/case-studies/15-transactional-outbox-order-workflow.json`, `public/data/case-studies/meta.json`, `public/data/case-studies/manifest.json`

## Scope and evidence posture

This is repository-authored teaching material, not evidence that a named company operates exactly this implementation. Its unique value is a concrete order workflow with database/broker crash windows, relay state, Inbox deduplication, business uniqueness, `202 Accepted`, operational metrics, and failure tests. The architecture is a proposed example; names such as `PUBLISHED`, `aggregate_version`, retention windows, and queue choice must not be read as externally verified production facts.

The initial discovery pass considered about 35 candidates. The 22 sources below were inspected and selected for distinct protocol, database, API, workflow, tracing, and operations claims. Reposts and framework tutorials that merely repeat the Outbox definition were excluded.

Evidence-policy update: the discovery ceiling is 200 candidates when a broader case-study search adds a distinct provider/version, crash window, security, recovery, or operational constraint. This case did not promote more than the 22-source selected set because additional candidates repeated the same Outbox/Saga/HTTP/provider contracts or were implementation tutorials without independent evidence. The record stays concise and non-padded.

## Local content map

| Section | EN/VI teaching job |
| --- | --- |
| 1. The problem is not choosing the right order | Shows DB-first/broker-first crash windows and client retry ambiguity. |
| 2. Start with the real-world process | Order/payment/inventory/shipping state sequence. |
| 3. One commit for business row and delivery intent | Same local DB transaction writes business row and outbox row with `aggregate_version`. |
| 4. Relay publishes without pretending to be exactly-once | Claim/publish/mark crash matrix and at-least-once wording. |
| 5. Service B uses an Inbox | Event identity dedup plus business unique key in one local transaction. |
| 6. Outbox transports events; a Saga controls business | Legal transitions and compensation example. |
| 7. API promises only what is durable | `202 Accepted`, pending resource, client retry key. |
| 8. Production work often omitted | Lag, retry, poison event, ordering, retention, reconciliation, tracing. |
| 9. Failure cases that must be tested | Eight crash/duplicate/stale-event scenarios. |
| 10–11 | Conclusion and design-review questions. |

EN and VI have the same section structure and code identifiers. The integration risk is qualifier drift: both languages must say “same local database,” “at-least-once,” “duplicate possible,” and “compensation is not rollback” with the same force.

## What is correct and reusable

- Writing business state and an Outbox row in one local transaction closes the state/publish-intent dual write.
- A relay can publish successfully and crash before recording completion; duplicate publication is therefore a normal path, not an exceptional bug.
- An Inbox/event-ID uniqueness check and a business intent uniqueness constraint protect different invariants. One prevents repeat processing of the same delivery; the other prevents two distinct events from creating the same business object.
- Outbox transport and Saga business sequencing are separate concerns. The case is right to keep both without calling the broker a transaction manager.
- `202 Accepted` is an honest contract when durable acceptance is complete but the workflow has not completed. The resource needs a status/expiry/error policy.
- The failure matrix and observability checklist are more useful than another generic Outbox definition.

## Claims to verify or qualify

| Current shape | Classification | Required qualification |
| --- | --- | --- |
| A local transaction commits business row and Outbox together | Verified design fact | Say “same database and transaction”; broker and downstream stores are outside that atomic boundary. |
| Commit preserves both and rollback removes both | Correct local model | Also state database durability/commit semantics and that relay publication is later. |
| `FOR UPDATE SKIP LOCKED` lets multiple relays run safely | Conditional recommendation | Requires short transactions, claim/lease/visibility timeout, reclaim after worker death, deterministic ordering, and idempotent publication. MySQL says skipped rows are an inconsistent view suited to queue-like work, not general transactions. |
| Relay marks `PUBLISHED` after broker acknowledgement | Design choice | Broker ack means broker responsibility under that broker contract; it does not mean consumer or business effect. Marking failure can duplicate. Consider `RELAYED`/`ACKED` terminology. |
| Outbox is at-least-once | Correct under relay/retry model | State duplicate window, retention, repair and consumer effect boundary. It is not a universal delivery guarantee. |
| `aggregate_version` detects stale/out-of-order events | Correct only if enforced | It is a validation signal; it does not reorder, repair, or prevent a later event from arriving first. Define gap/stale/duplicate actions. |
| Inbox marker and business row commit together | Strong recommendation | Specify consumer store, isolation, unique key scope, payload conflict handling, and what happens after the marker exists but downstream notification fails. |
| `202 Accepted` is the right response | API recommendation | Appropriate only after durable acceptance; include status resource, retry key, expiry, terminal failure, and authorization. |
| Every service writes only its DB and Outbox | Architecture recommendation | Applies to database-per-service ownership; a modular monolith may use one DB transaction and need no pretend-distributed boundary. |
| Correlation/causation IDs should travel in events | Operations recommendation | Add trace-context propagation, privacy/redaction and sampling rules; identifiers must not expose secrets/PII. |

## Workload, invariants, and failure model

### Workload contract

The case assumes short order commands, a local relational database, an asynchronous broker, multiple relay/consumer instances, retries, and potentially irreversible external payment/shipping calls. It does not specify message size, peak rate, broker type, database version, isolation level, retry/retention windows, or provider idempotency; those are intentionally open. Add them before presenting code as production-ready.

Required invariants:

1. `orders.state` and its corresponding Outbox intent commit atomically in one local database transaction.
2. Each Outbox record has a stable event ID, aggregate ID, aggregate version, type/schema version, creation time, and ownership/retention policy.
3. A relay claim can expire and be reclaimed without losing or concurrently publishing a row indefinitely.
4. A consumer commits Inbox identity and its local business effect atomically, or repeats safely.
5. A business unique key protects intent (for example, one order/payment attempt), independently of transport event identity.
6. Legal state transitions reject stale, missing, duplicate, and late events explicitly.
7. The API promise reflects durable acceptance, not downstream completion.
8. Every stuck item has a measurable age, an owner, a repair/redrive path, and an audit trail.

### Crash windows

| Window | Expected outcome | Control/test |
| --- | --- | --- |
| DB transaction fails before commit | No business row and no Outbox row | Rollback test; client may retry same command key. |
| DB commit succeeds, process dies before response | Order is accepted but client is uncertain | Query/status resource and idempotent command key. |
| Relay claims row then dies before publish | Lease expires/reclaim; no permanent loss | Visibility timeout and oldest-claimed alert. |
| Broker accepts, relay dies before Outbox update | Duplicate publish | Stable event ID; consumer Inbox/unique effect. |
| Consumer effect commits, ack/offset lost | Redelivery | Inbox marker/effect same local transaction; no-op duplicate. |
| Consumer marks Inbox before effect | Lost effect | Never commit marker separately from effect unless effect is inherently idempotent and recoverable. |
| Event arrives stale/out of order | Reject/no-op/gap queue according to policy | Version property tests and repair path. |
| Provider call times out after transmission | Unknown external outcome | Provider reference/status query/reconciliation; do not create a new intent. |
| Compensation fails or expires | Partial workflow remains | `COMPENSATING`/`RECONCILIATION_REQUIRED`, alert and manual runbook. |

## Best-practice comparison

| Approach | What it closes | What remains open | Use in this case |
| --- | --- | --- | --- |
| Inline DB write + broker publish | Low latency in the happy path | Two writes can diverge on crash/timeout | Keep only where loss/duplication is explicitly acceptable. |
| Transactional Outbox + polling relay | Local business state/intent atomicity | Relay lag, duplicate publication, retention/repair | Primary teaching pattern here. |
| CDC/outbox router | Reads committed outbox changes from log/CDC | Connector lag/schema/config/offset/replay operations | Alternative relay; mention instead of implying polling is the only method. |
| Broker transaction | Atomic broker records/offsets in supported scope | External DB and provider effects | Not a replacement for local Outbox when business DB is separate. |
| Consumer Inbox | Event identity and local effect dedup boundary | Expiry, storage growth, business intent conflicts | Keep as concrete Service B implementation. |
| Saga workflow | Business sequence, retry, compensation | Non-atomic intermediate states and failed compensation | Keep short; topic 09 owns generic definition. |
| Provider idempotency key | Provider-specific repeated-request safety | TTL, parameter mismatch, unknown outcome, provider scope | Add as optional external boundary, never assume. |

## Coverage matrix

| Gate area | Current coverage | Proposed evidence/repair |
| --- | --- | --- |
| Definitions | Strong | Link generic definitions to topics 08/09/25; keep case-specific wording. |
| Invariants | Strong but implicit | Turn them into a numbered contract and SQL/property-test assertions. |
| Workload | Weak | State assumed QPS/latency/message size only as placeholders; require measured values before tuning. |
| Failure/crash windows | Strong | Add lease expiry, unknown provider outcome, marker-before-effect, and late compensation. |
| Retries/timeouts | Partial | Choose one retry owner per hop; use deadlines, jitter, retry budget and non-retriable classification. |
| Operations/recovery | Partial | Add `outbox_oldest_age`, claimed/expired rows, relay publish/mark mismatch, Inbox growth, DLQ age, reconciliation debt, and runbooks. |
| Security/privacy | Partial | Add tenant-scoped authorization on status/replay, payload minimisation, encryption, secret/PII redaction and retention/deletion. |
| Testing | Strong list | Add fault injection after each durable boundary, concurrent duplicate command, provider callback replay, lease theft, schema rollback and retention expiry. |
| Domain trade-offs | Partial | State that inventory/payment/shipping authority and compensation semantics belong to the chosen domain case. |

## Contradictions and limits

| Advice/guarantee | Limit or competing guarantee |
| --- | --- |
| `SKIP LOCKED` improves relay concurrency | MySQL documents an inconsistent view; it is appropriate for queue-like claiming, not a general correctness read. |
| “Published” means delivered | Broker publisher confirmation and consumer acknowledgement are distinct. `PUBLISHED` is a local relay state, not business completion. |
| Outbox makes delivery reliable | It makes intent durable; a dead relay, expired row, broken CDC connector, schema error, retention deletion, or unavailable broker can still delay publication. |
| Inbox gives exactly-once processing | It gives a local dedup boundary if identity/effect commit together; external calls and expired markers remain open. |
| `202` guarantees the order will finish | It only states that the request was accepted for processing; a later terminal failure or manual reconciliation is valid. |
| Aggregate version prevents out-of-order events | It can detect a stale/gap condition only if a consumer checks it; it cannot recover a missing event. |
| One DB-per-service is always best | It creates asynchronous workflow cost; a modular monolith may preserve a stronger local boundary at lower cost. |

## Negative evidence and anti-patterns

- Do not mark an Outbox row `PUBLISHED` before the broker’s documented publisher confirmation.
- Do not delete Outbox records based on row age alone; retention must exceed duplicate/redrive/reconciliation needs and support audit/privacy policy.
- Do not claim exactly-once because a UUID is present. Identity only helps if a durable uniqueness check is atomic with the effect.
- Do not use an in-memory relay lock, process-local mutex, or cache as the only claim/recovery mechanism.
- Do not retry a provider call with a new key after a timeout unless the original intent is resolved or the provider contract makes the call idempotent.
- Do not let a replay route call non-idempotent email, charge, reserve, or ship effects without a replay mode and side-effect policy.
- Do not expose internal event payloads or replay controls through the `202` status resource without tenant/role authorization.
- Do not present a fixed polling interval, batch size, lease duration, or retention period as a best practice without load/failure measurements.

## Canonical/domain/implementation role

- Canonical mechanism owner: topic 09 for Outbox/Saga/idempotency/workflow correctness.
- Queue and delivery owner: topic 08.
- Consumer Inbox/idempotency relationship: topic 25, with this case retaining the concrete local transaction.
- Unique implementation value here: the crash-window matrix, relay claim state, Inbox SQL/constraint, order transitions, API `202` contract, metrics, and tests.
- Domain authority: payment, inventory, shipping and compensation policy should be replaced with the relevant domain case rather than copied into every Outbox tutorial.

## Integration record (Batch A scope)

The order-specific crash matrix, expiring relay claim, conditional publication update, Inbox/business-key split, `202` pending contract, provider-unknown state, reconciliation metrics, and failure-test matrix were integrated into both EN and VI. The article remains a repository-authored implementation case; no vendor deployment claim was added. Existing anchors, figures, code identities, and metadata IDs were preserved. Remaining proposal bullets are measured-workload or provider-selection follow-ups.

## EN/VI parity and proposed follow-up changes

- [ ] Preserve all 11 section headings and code identifiers in both files.
- [ ] Add the “repository-authored design example” label near the beginning of both language versions.
- [ ] Make all “same transaction” statements say “same local database.”
- [ ] Rename or explain `PUBLISHED` as a relay observation; consider `RELAYED`/`BROKER_ACKED` if the example needs to distinguish broker acknowledgement from consumer completion.
- [ ] Add a lease/reclaim table for `SKIP LOCKED` relay workers and state the MySQL version/isolation assumption.
- [ ] Keep generic Saga/Outbox definitions short and link topic 09; retain local order transitions and compensation failures.
- [ ] Add status-resource expiry, authorization, terminal failure, and unknown-provider states to the `202` example.
- [ ] Expand the failure test table with provider callback replay, lease expiry, stale/gap queue, schema rollback, and retention-window expiry.
- [ ] Add the operational metrics in both languages and require trace IDs to be non-sensitive.

## Open questions and falsifiers

- [ ] Which broker and database version should the runnable example target? Without that, SQL and acknowledgement wording remains illustrative.
- [ ] Is the relay claim model a lease, a row state, or a database advisory lock? If no reclaim path exists, the reliability claim is falsified.
- [ ] What is the deduplication/retention window? If a duplicate can arrive after Inbox cleanup, the business effect must still be protected by a durable business key.
- [ ] Is the external provider idempotent? If not, the example needs status inquiry and reconciliation rather than a retry snippet.
- [ ] What is the legal/tenant retention and replay policy? If payload deletion is required, the Outbox/event archive design needs a privacy-safe envelope or redaction model.
- [ ] Can property tests show that every accepted command has exactly one local business transition and one durable intent under crash/retry injection? A failing test falsifies the example’s correctness claim.

## Source ledger

The reviewed date for every ledger row is `2026-08-23`; each row records its URL/title, organization, tier, version or revision, and exact claims supported. The case-specific workflow remains separated from generic topic definitions so its unique evidence is the crash matrix, relay/inbox state, API status contract, and recovery tests.

All sources were reviewed on `2026-08-23`. The case itself is not a production source; it is explicitly separated from the external evidence below.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox) — Chris Richardson / Microservices.io | S3; current pattern page | Local DB/outbox atomicity, relay duplicate window, idempotent consumers. |
| S02 | [Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) — Debezium | S1; stable docs | Outbox event ID, aggregate key, routing, payload, tracing and CDC relay shape. |
| S03 | [Reliability Guide](https://www.rabbitmq.com/docs/reliability) — RabbitMQ | S1; docs 4.3 | Publisher/consumer acknowledgement boundaries, retransmit/redelivery and shared reliability responsibility. |
| S04 | [Publisher Confirms](https://www.rabbitmq.com/docs/confirms) — RabbitMQ | S1; docs 4.3 | Publisher confirms are independent from consumer acks; confirm loss can produce duplicates; ack after effect. |
| S05 | [Design: Message Delivery Semantics](https://kafka.apache.org/40/design/design/) — Apache Kafka | S1; Kafka 4.0 | Kafka at-least/exactly-once scope and offset/output transaction boundary. |
| S06 | [Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) — Oracle/MySQL | S1; MySQL 8.4 | `FOR UPDATE`, `SKIP LOCKED`, lock release, inconsistent view and queue-like use. |
| S07 | [InnoDB Locking and Transaction Model](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-transaction-model.html) — Oracle/MySQL | S1; MySQL 8.4 | Lock types, isolation and deadlock model relevant to relay claims. |
| S08 | [How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html) — Oracle/MySQL | S1; MySQL 8.4 | Short transactions, consistent lock order, retry whole transaction and `READ COMMITTED` considerations. |
| S09 | [Performance Schema data locks](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-data-locks-table.html) — Oracle/MySQL | S1; MySQL 8.4 | Observing held/waiting locks and avoiding undocumented lock-ID assumptions. |
| S10 | [Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) — AWS | S1/S2; current guidance | Saga local transactions, compensation and choreography/orchestration trade-off. |
| S11 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — AWS Builders’ Library | S2; current | Client timeout, stable request identity, atomic idempotency state and late retry semantics. |
| S12 | [Transactional outbox with Cosmos DB](https://learn.microsoft.com/en-us/samples/azure-samples/cosmos-db-design-patterns/transactional-outbox/) — Microsoft Azure | S1/S2; current sample | Transactional batch plus change feed as an alternative relay, with at-least-once downstream delivery. |
| S13 | [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Stripe | S1; current API docs | Provider-specific key retention, parameter mismatch and concurrent request behaviour. |
| S14 | [API idempotency](https://docs.adyen.com/development-resources/api-idempotency) — Adyen | S1; current API docs | Provider-specific scope/region/response constraints; contradiction to universal provider wording. |
| S15 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | S1; RFC 9110 / STD 97 | 202 Accepted, safe/idempotent methods, POST retry caution, 405/Allow semantics. |
| S16 | [Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF | S1; RFC 9457, 2023 | Structured error states for pending/conflict/validation; not a retry guarantee. |
| S17 | [PostgreSQL PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html) — PostgreSQL | S1; current PostgreSQL 18 | 2PC prepared state, later commit/rollback, external coordinator and operational warning. |
| S18 | [PostgreSQL Two-Phase Transactions](https://www.postgresql.org/docs/current/two-phase.html) — PostgreSQL | S1; current PostgreSQL 18 | 2PC commands, XA-like scope and short prepared duration. |
| S19 | [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) — PostgreSQL | S1; current PostgreSQL 18 | Unique/check/foreign-key constraints as durable local invariants. |
| S20 | [INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html) — PostgreSQL | S1; current PostgreSQL 18 | Atomic local conflict handling useful for Inbox/business-key examples. |
| S21 | [Messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/) — OpenTelemetry | S1; semantic conventions 1.44.0 family | Producer/consumer trace correlation and message-operation attributes; avoid payload secrets. |
| S22 | [Workflow executions](https://docs.temporal.io/workflow-execution) — Temporal | S1; current project docs | Durable workflow state/replay and activity retries; workflow engine is not a ledger/provider guarantee. |

### Per-source review-date map for the compact S01-S22 ledger

The compact source table above keeps the date in this normalized map; every listed source row was inspected on 2026-08-23.

| Source ID | Reviewed |
| --- | --- |
| S01 | 2026-08-23 |
| S02 | 2026-08-23 |
| S03 | 2026-08-23 |
| S04 | 2026-08-23 |
| S05 | 2026-08-23 |
| S06 | 2026-08-23 |
| S07 | 2026-08-23 |
| S08 | 2026-08-23 |
| S09 | 2026-08-23 |
| S10 | 2026-08-23 |
| S11 | 2026-08-23 |
| S12 | 2026-08-23 |
| S13 | 2026-08-23 |
| S14 | 2026-08-23 |
| S15 | 2026-08-23 |
| S16 | 2026-08-23 |
| S17 | 2026-08-23 |
| S18 | 2026-08-23 |
| S19 | 2026-08-23 |
| S20 | 2026-08-23 |
| S21 | 2026-08-23 |
| S22 | 2026-08-23 |

## Excluded discovery candidates

Generic Outbox reposts and framework-specific samples were excluded when they had no additional crash, schema, or recovery evidence. A provider’s “idempotency” marketing page was not used unless it documented key scope/retention/parameter rules. Exact relay batch/lease/retention numbers were not found in the external sources and remain placeholders to be measured, not copied.

## Gate status

- [x] Complete EN/VI article structure and metadata read.
- [x] Case’s repository-authored evidence posture separated from external evidence.
- [x] Discovery pool broadened; selected ledger has 22 distinct inspected sources.
- [x] Workload, invariants, crash windows, comparisons, coverage, limits, anti-patterns and falsifiers recorded.
- [x] Canonical ownership and EN/VI parity plan recorded.
- [x] Final broker/database/provider choices are intentionally left as explicit implementation unknowns; the failure contract is approved.
- [x] EN/VI article integration applied in Batch A.
- [x] Validation passed after integration and rechecked in the final gate.

## Research gate addendum (highest-quality evidence pass)

This case is deliberately narrow: one order workflow and the DB-to-broker crash window. The initial 22-source ledger is enough for the core pattern, but the expanded pass inspected a broad, non-exhaustively counted candidate pool and retained 36 distinct sources after adding broker/version, schema, tracing, testing, overload, and replay evidence. The narrow-case exception is therefore about reader-facing scope, not weak evidence. Duplicate Outbox pages, reposts, generic “exactly once” claims without a boundary, and provider marketing without a documented contract were excluded.

### Additional coverage and limits

| Gate area | Added evidence | Case-specific boundary |
| --- | --- | --- |
| Definitions | AWS Outbox, Debezium, broker docs | `PUBLISHED` means the named broker publication boundary, not downstream business completion. |
| Invariants | PostgreSQL partial/unique constraints and local transaction docs | Inbox event identity and business intent key are separate local invariants. |
| Workload | Rabbit/Kafka/SQS/Pub/Sub flow-control and delivery docs | Batch size, relay concurrency, dedup window, retention, and broker are examples to measure, not defaults. |
| Failure/crash windows | Debezium EOS, broker confirms/ACKs, SRE overload | Crash after broker acceptance and before local status update can produce a duplicate; the consumer must tolerate it. |
| Retries/timeouts | AWS idempotency, Stripe/Adyen, RFC 9110/6585 | `202`/pending and `Retry-After` are API choices; PSP key scope is provider-specific. |
| Operations/recovery | DLQ/replay, schema compatibility, trace/messaging conventions | Outbox age, relay error, duplicate/no-op, DLQ age, and reconciliation debt need owners and thresholds. |
| Security/privacy | W3C Trace Context, OpenTelemetry, RFC 9457 | Correlation IDs must be opaque; redrive/status access must be tenant-authorized and PII-aware. |
| Testing | Pact, Testcontainers, Chaos Mesh | Unit tests cannot prove crash windows; inject failure after effect, ACK, claim, and callback. |
| Domain trade-offs | AWS/Azure Saga and provider state docs | Keep the example broker/order-neutral unless the implementation explicitly names one. |

### Contradiction/limits addendum

| Tempting conclusion | Evidence/limit | Case wording |
| --- | --- | --- |
| Outbox makes delivery exactly once | AWS/Microservices.io/Debezium describe relay duplicates and consumer idempotency | Outbox makes the local intent durable; publication and business effect remain separate boundaries. |
| `PUBLISHED` means the order is processed | Rabbit/Kafka distinguish broker confirmation/offset from consumer effect | Rename or qualify the status as broker-accepted/relayed; retain order state separately. |
| `SKIP LOCKED` is a complete relay scheduler | PostgreSQL documents queue-like use but claim/lease/reclaim is application logic | Use bounded claim/lease, reclaim after worker death, and an age/recovery path. |
| A single Inbox row prevents every duplicate | Provider callback, business retries, replay, and key-retention windows can differ | Keep event ID, client command key, business unique key, and provider key scopes explicit. |
| `202 Accepted` is a successful order | RFC 9110 defines accepted-for-processing, not completed | Return a durable status resource with pending, terminal failure, expiry, and manual-review semantics. |
| Broker choice is the reliability design | Rabbit/Kafka/SQS/Pub/Sub expose different, scoped guarantees | Select a broker from the case workload; correctness still comes from local state/idempotency/reconciliation. |

### Negative evidence and anti-pattern addendum

- Do not write the order row, publish directly, and rely on a client retry to repair the missing event.
- Do not mark an outbox row complete before the broker’s documented confirmation, and do not interpret that confirmation as consumer completion.
- Do not ACK/commit the consumer before the Inbox marker and business transition are durably committed, unless the case explicitly chooses loss.
- Do not use `SKIP LOCKED` without a lease/claim expiry, reclaim worker, duplicate-safe publication, and oldest-row alert.
- Do not redrive a DLQ event directly into production without schema compatibility, authorization, rate limiting, and an invariant/no-op check.
- Do not copy Stripe/Adyen idempotency retention into the local Inbox or outbox cleanup window.
- Do not put full order/payment/PII payloads into trace attributes or expose raw DLQ messages to all operators.
- Do not add Saga prose until the local order state machine and compensation/late-callback policy are clear; the case is an implementation composition, not a second pattern encyclopedia.

### Current-vs-proposed content gap

| Gap in current article | Proposed change (not applied) | Evidence/owner |
| --- | --- | --- |
| Relay state name can imply end-to-end completion | Use `RELAYED`/`BROKER_ACKED` or define `PUBLISHED` explicitly; keep consumer/order state separate | Rabbit/Kafka confirm/ACK docs |
| Claim/lease details are conceptual | Show claim timestamp/lease expiry/reclaim and duplicate-safe status update | PostgreSQL lock/UPDATE docs; measured implementation |
| Retention is a question, not a contract | Add a formula/decision: dedup and outbox retention must exceed maximum retry/replay/recovery window | Provider/broker retention and product SLA |
| Consumer Inbox and business key are explained but not scoped | Add key owner, uniqueness scope, transaction boundary, and behavior for `IN_PROGRESS`/stale event | PostgreSQL constraints; topic 09/25 |
| Failure test list lacks schema/replay/security detail | Add incompatible event, authorized redrive, duplicate provider callback, late compensation, and retention-expiry tests | Confluent/Pact/Testcontainers/Chaos Mesh |
| Metrics are listed without action | Add threshold, owner, runbook, and manual repair authorization per metric | Operations owner; no external source can supply repository SLOs |

### Explicit unknowns and falsifiers

- Unknown: the article does not select RabbitMQ, Kafka, SQS, or Pub/Sub; broker-specific ACK/confirm terminology must remain illustrative until implementation choice is approved.
- Unknown: relay lease duration, batch size, outbox retention, Inbox retention, and replay window are not measured repository values.
- Unknown: the target database engine/isolation level and whether the sample is a modular monolith or database-per-service deployment are not fixed by the pattern.
- Unknown: no external source establishes the repository’s order state machine, refund SLA, or manual escalation authority; those remain product decisions.
- Falsifier for the local Outbox recommendation: if the database/provider already supplies a stronger atomic commit boundary that includes the required consumer or external effect at acceptable cost, compare it explicitly rather than treating Outbox as mandatory.
- Falsifier for the Inbox recommendation: if the downstream operation is provably idempotent by an external contract and no local state is needed, the marker may be redundant; the proof and scope must be documented.
- Falsifier for `202`: if the endpoint contract requires synchronous completion and can bound every external step within the deadline, a synchronous response may be correct; otherwise `202`/status remains the honest contract.

### Additional inspected source ledger

The rows below are additional distinct sources. Together with S01-S22 above, they produce 36 selected sources. Every row records URL, organization/type, tier, document version/revision, review date, and the precise claim used.

| ID | URL/title | Organization/type | Tier | Version/revision | Reviewed | Exact claims supported |
| --- | --- | --- | --- | --- | --- | --- |
| S23 | [Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | AWS, architecture guidance | T2 | Current AWS docs | 2026-08-23 | Dual-write motivation, local atomic intent, relay/CDC, duplicate consumer behavior |
| S24 | [Debezium exactly-once delivery](https://debezium.io/documentation/reference/configuration/eos.html) | Debezium, project docs | T2 | Stable/current docs | 2026-08-23 | Connector-level EOS scope; arbitrary downstream side effects remain outside it |
| S25 | [SQS queue types](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-types.html) | AWS, queue docs | T2 | Current docs | 2026-08-23 | Standard at-least-once versus FIFO scope, useful broker counterexample |
| S26 | [Pub/Sub exactly-once delivery](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery?hl=en) | Google Cloud, messaging docs | T2 | Current docs; regional pull/client scope | 2026-08-23 | Scoped exactly-once acknowledgement and unsupported-mode caveats |
| S27 | [Kafka design](https://kafka.apache.org/42/design/design/) | Apache Kafka, project design | T2 | Kafka 4.2 design page | 2026-08-23 | Transaction/offset boundary, partition order, replay/retention scope |
| S28 | [Schema evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) | Confluent, platform docs | T2 | Current platform docs | 2026-08-23 | BACKWARD/FORWARD/FULL compatibility is a configured registry policy |
| S29 | [W3C Trace Context](https://www.w3.org/TR/trace-context/) | W3C, recommendation | T1 | Recommendation, 2021 | 2026-08-23 | Opaque trace propagation and privacy/security boundaries |
| S30 | [Messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) | OpenTelemetry, specification | T1 | Current semantic conventions | 2026-08-23 | Producer/consumer correlation and message-operation telemetry |
| S31 | [Pact contract testing](https://pactflow.io/how-pact-works/) | PactFlow, testing docs | T3 | Current docs | 2026-08-23 | Consumer/provider contract verification, not end-to-end crash proof |
| S32 | [Testcontainers getting started](https://testcontainers.com/getting-started/) | Testcontainers, project docs | T2 | Current docs | 2026-08-23 | Real broker/database integration lifecycle |
| S33 | [Chaos Mesh network chaos](https://chaos-mesh.org/docs/simulate-network-chaos-in-physical-nodes/) | Chaos Mesh, project docs | T2 | Current docs | 2026-08-23 | Delay/loss/partition injection for relay/consumer testing |
| S34 | [Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) | Google, SRE book | T3 | Current online edition | 2026-08-23 | Retry amplification, jitter/budget, load shedding, crash/failure tests |
| S35 | [Additional HTTP status codes](https://datatracker.ietf.org/doc/rfc6585/) | IETF, standard | T1 | RFC 6585, 2012 | 2026-08-23 | `429`/`Retry-After` for relay/status API backpressure |
| S36 | [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) | PostgreSQL, database docs | T2 | Current docs; verify deployed major | 2026-08-23 | Conditional uniqueness example for one active business state; predicate scope |
