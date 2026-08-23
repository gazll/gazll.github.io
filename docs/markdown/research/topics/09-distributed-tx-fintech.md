# Research — Distributed workflow correctness and money movement

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `09-distributed-tx-fintech`

EN file: `public/data/topics/09-distributed-tx-fintech.json`

VI file: `public/data/topics/09-distributed-tx-fintech.vi.json`

## Scope and non-goals

This unit should be the canonical foundation for correctness across service boundaries: local ACID boundaries, two-phase commit, Saga, transactional Outbox, TCC, command/consumer/provider idempotency, unknown outcomes, reconciliation, and ledger invariants. The money section is a domain module, not a claim that every domain needs banking-grade machinery.

It does not own generic broker mechanics (topic 08), cache or lock primitives, the full microservice failure catalogue (topic 25), or the detailed order implementation (Case Study 15). Those units should link here for workflow semantics instead of repeating this tutorial.

The initial discovery pass considered about 45 candidates. The 25 sources in the initial ledger were selected because they add normative semantics, first-party provider contracts, original pattern documentation, or concrete operational limits. Generic “Saga vs 2PC” explainers, framework marketing, and duplicate copies of the same pattern were excluded.

Evidence-policy update: the discovery ceiling is 200 candidates when a broader search adds distinct provider/version, failure, security, or operational evidence. This unit did not promote more than the 25-source selected set because the remaining candidates repeated the same Saga/Outbox/HTTP/provider contracts or lacked a reproducible guarantee. The selected set is deliberately non-padded.

## Local content map

| Local section | Exact IDs | Current job |
| --- | --- | --- |
| Distributed transaction patterns | `09-distributed-tx-fintech.distributed-transaction-patterns.q1`–`q6` | 2PC, Saga, Outbox, TCC, and service-boundary choice. |
| Correctness where money is involved | `09-distributed-tx-fintech.correctness-where-money-is-involved.q1`–`q6` | PSP unknown outcome, idempotent payment commands, ledger, money representation, double-spend, and transfer workflow. |

The EN and VI files have matching structure and IDs. The main editorial risk is not parity of headings; it is that “transaction,” “idempotency,” “exactly once,” and “rollback” are used at several different boundaries.

## What is correct and reusable

- Start with the invariant and ask whether it can remain inside one local database transaction. A distributed pattern is not an upgrade over a smaller transaction boundary.
- A compensating action is a new business operation, not a database rollback. It can fail, be delayed, be rejected, or be impossible after an irreversible side effect.
- Outbox closes the local state-to-publish-intent dual write. It does not prove a relay ran, a consumer applied the effect, or a PSP charged once.
- A provider timeout is an unknown outcome until status inquiry, callback, or reconciliation establishes the result. Treating it as failure can create a duplicate charge; treating it as success without evidence can create a false order.
- An immutable/double-entry ledger and an idempotent posting command are stronger money controls than a distributed lock. A lock may serialize attempts but is not the source of truth after crash, expiry, or failover.

## Claims to verify or qualify

| Local claim/shape | Classification | Required qualification |
| --- | --- | --- |
| Prepared 2PC transactions keep locks until resolution | Verified, bounded | PostgreSQL documents that prepared transactions continue to hold locks; say “while prepared and unresolved,” and warn that long-lived prepared transactions are operationally hazardous. |
| Modern systems trade atomicity for Saga + Outbox + idempotency | Recommendation | Not universal. Prefer one local transaction first; 2PC/XA or a managed coordinator can be valid when its participant and recovery contract is deliberate. |
| Saga “ensures data integrity” | Over-absolute | It coordinates local transactions toward a declared desired state using forward recovery/compensation. It does not make all intermediate states atomic or guarantee compensation success. |
| Few participants means choreography; many means orchestration | Source-backed heuristic | AWS describes this tendency; no universal participant count. Visibility, branching, timers, ownership, coupling, and auditability matter. |
| An orchestrator is a single point of failure | Incomplete | A naive coordinator is; a durable/replicated workflow engine changes the crash mode but not the need for workflow state, ownership, and operator intervention. |
| TCC is the same as an OTA seat hold | Analogy only | Call it TCC-like unless Try/Confirm/Cancel are explicit, idempotent, compensatable business operations with a coordinator contract. |
| Outbox guarantees the message will be sent after commit | Overstated | It durably records intent. Relay/CDC health, retry, retention, ordering, repair, and broker availability are still required. |
| Store an idempotency key and result “or via Outbox” | Ambiguous | The command claim, business transition, and returned result need one defined local atomic boundary. An Outbox can be another row in that transaction; it is not a substitute for the result/claim store. |
| Every PSP/GDS supports idempotency keys | Provider-dependent | Cite the provider contract. Otherwise use a stable merchant reference, status query/callback, and reconciliation; do not promise equivalent semantics. |
| End-of-day reconciliation is sufficient | Too narrow | Cadence depends on risk, settlement, provider SLA, and unknown age. High-risk money paths need online unknown queues and bounded escalation plus settlement reconciliation. |
| Integer minor units are always enough | Scope error | Currency exponent and rounding rules vary. Use an explicit currency/scale or a decimal library and validate against ISO 4217 and domain rules. |

## Workload, invariants, and failure model

### Workload and authority model

For each workflow record participants, local stores, authoritative state, command identity, maximum latency, retry source, timeout semantics, compensation reversibility, provider contract, data residency/PII, and reconciliation SLA. A bank transfer, OTA seat hold, and email notification may all be called a Saga but have different authorities and failure costs.

Core money invariants:

1. A posted ledger is append-only or corrected by explicit compensating entries; balances are derived or reconciled from postings.
2. Every business intent has a stable idempotency key scoped to tenant/account/operation and a request fingerprint; conflicting payload reuse is rejected.
3. A command is not marked successful until the local durable evidence for that promise is committed.
4. Provider `UNKNOWN` is a durable state with an owner, retry/status-query policy, age threshold, and reconciliation path.
5. A debit/credit transfer posts both sides atomically within the ledger authority, or remains pending; it never “half succeeds” invisibly.
6. Compensation is modelled as a state transition with its own idempotency and audit trail, not an in-memory undo.

### Crash windows and recovery

| Failure window | Unsafe interpretation | Safer state/control |
| --- | --- | --- |
| Client timeout before local commit | “The request failed” | Retry same command key; return the stored result if committed. |
| Local business commit without event publish | “Downstream never needs to know” | Transactional Outbox/CDC, relay monitoring, retention, repair. |
| Relay publish succeeds, relay crashes before marking sent | “It was not published” | At-least-once relay; stable event ID and consumer Inbox/idempotent effect. |
| Consumer effect commits before ack/offset | “It will run only once” | Redelivery is expected; deduplicate in the same local transaction as the effect. |
| PSP request times out after transmission | “Payment failed” | `UNKNOWN/PENDING`; provider status query/callback/reconciliation; do not blindly create a new payment intent. |
| Saga participant fails after a prior step | “Database rollback is available” | Forward retry, compensation, manual action, and explicit `COMPENSATING/RECONCILIATION_REQUIRED`. |
| Prepared 2PC coordinator unavailable | “Locks are harmless” | Alert on prepared age/count; durable coordinator/recovery procedure; abort ordinary long-lived use. |
| Idempotency record expires before late retry | “The old key is safe forever” | Retention/expiry must exceed provider/client retry and reconciliation windows, or use a durable business reference. |

## Best-practice comparison

| Pattern | Correctness boundary | Strength | Failure/operational cost | Good fit / poor fit |
| --- | --- | --- | --- | --- |
| One local ACID transaction | One database/authority | Strongest and simplest invariant | Requires co-location; may limit ownership/scale | Ledger posting, order admission; poor fit only when the split is real. |
| 2PC/XA | Coordinator + prepared participants | Atomic commit across participants when all implement protocol | In-doubt recovery, held locks/resources, coordinator and participant availability | Deliberate bounded participants; poor fit for long human/provider workflows. |
| Saga orchestration | Durable workflow state + local transactions | Explicit visibility, branching, timers, retries and compensation | Coordinator state/HA, non-atomic intermediate state, compensation design | Long multi-service workflow; not a ledger substitute. |
| Saga choreography | Events + local transactions | Fewer central components and loose event reaction | Hidden coupling, difficult dependency tracing and failure recovery | Small stable participant set; poor fit for complex branching/ownership. |
| Transactional Outbox | Local DB row + outbox intent | Closes state/event dual-write | Relay lag, duplicate publication, cleanup, schema/repair | Reliable integration events; not a provider transaction. |
| TCC | Try reservation + Confirm/Cancel business phases | Explicit resource protocol and short locks | Intrusive business implementation, empty rollback/hanging/idempotency cases | Resources with real reserve/commit/release semantics. |
| Provider idempotency/reference | Provider-specific command scope | Safe retries for that provider’s contract | TTL, parameter mismatch, provider outages and unknown status | Payment/order API when documented; never infer from HTTP alone. |
| Reconciliation | Independent evidence comparison | Repairs unknown/drift states | Delay, manual queues, false positives and cost | PSP settlement, ledger-vs-provider, inventory drift; not a replacement for online controls. |

## Coverage matrix

| Gate area | Current coverage | Research decision |
| --- | --- | --- |
| Definitions | Strong but overloaded | Define local transaction, workflow, Saga, Outbox, TCC, idempotency, unknown, compensation, and ledger separately. |
| Invariants | Strong in money section | Make the authority and atomic boundary explicit in every example. |
| Workload | Partial | Add participant count only as one input; include latency, reversibility, provider contract, and risk. |
| Failure/crash windows | Partial | Add the eight windows above and distinguish timeout, reject, duplicate, and unknown. |
| Retries/timeouts | Partial | Add one retry owner, deadline budget, jitter, bounded attempts, provider retry rules, and late-response handling. |
| Operations/recovery | Partial | Add outbox oldest age, relay errors, prepared transaction age, unknown queue age, compensation debt, reconciliation drift, and manual runbooks. |
| Security/privacy | Partial | Add PCI scope, tokenisation, least privilege, audit immutability, PII minimisation, tenant-scoped idempotency, and redaction. |
| Testing | Partial | Add crash injection after commit/publish/ack, duplicate/late callback, compensation failure, provider timeout, ledger balance, and replay tests. |
| Domain trade-offs | Strong starting point | Keep bank/fintech as a module; make OTA, commerce, and notification cases own their authority and loss priority. |

## Contradictions and limits

| Guarantee/advice | Competing view | Limit to record |
| --- | --- | --- |
| 2PC gives atomic commit | Prepared state can hold locks and requires external recovery | Atomicity is not free availability; PostgreSQL recommends external management and short prepared duration. |
| Saga “rollback” | Compensation changes business state forward | It may be impossible or rejected; intermediate states are observable. |
| Orchestration improves visibility | Central workflow state adds a control-plane dependency | Replicate/durable the workflow and alert on stuck executions. |
| Stripe and Adyen both support idempotency | Their key scope, retention and response semantics differ | Provider-specific contract; do not merge into one universal TTL. |
| Integer money avoids floating-point error | Currency exponent, tax/fee rounding, and FX still need policy | Store currency and scale; test rounding and reconciliation. |
| Outbox + confirms is “exactly once” | Relay and consumer crash can duplicate; external side effects are outside broker transaction | Name each boundary and use Inbox/provider idempotency/reconciliation. |
| Eventual consistency is acceptable | Not for a ledger posting or double-spend invariant | Use local authority or reservation/conditional write at the invariant boundary. |

## Negative evidence and anti-patterns

- Do not introduce Saga because a service boundary exists if the invariant can remain in one local transaction.
- Do not use a distributed lock as the ledger authority, as proof of payment, or as a substitute for a conditional state transition.
- Do not call compensation a rollback or assume it restores the exact previous state.
- Do not retry a timed-out non-idempotent provider request with a new key until the original outcome is resolved.
- Do not put the idempotency key only in a cache with a short TTL when late callbacks/retries can arrive after expiry.
- Do not rely on a “successful HTTP response” as evidence that an external side effect is settled; provider contracts define that boundary.
- Do not make an orchestrator stateless if workflow recovery depends on in-memory timers or callbacks.
- Do not use a schema-compatible event as proof that a consumer still understands its business meaning.
- Do not label a ledger “immutable” while allowing destructive updates, mutable historical balances, or un-audited admin correction.

## Duplicate/canonical ownership

Proposed canonical role: keep the stable topic key `09-distributed-tx-fintech`, but broaden the introduction/title in the eventual content to “distributed workflow correctness,” with a clearly labelled money/fintech module. This avoids duplicating Saga/Outbox across every domain while preserving the existing route key.

| Repeated topic | Keep here | Other owner |
| --- | --- | --- |
| Local ACID vs distributed workflow | Decision rule and failure semantics | DB/core topic for engine-specific transactions |
| Saga/Outbox/TCC | Canonical definitions and boundaries | Case 15 for concrete order implementation |
| Broker ack/partition/replay | Only the workflow boundary | Topic 08 |
| Consumer Inbox | Relationship to workflow and duplicate effect | Topic 25 / Case 15 implementation |
| Payment/ledger | Invariants, unknown outcome, reconciliation | Bank/fintech case studies for provider and settlement details |
| Booking/inventory | Generic unknown/compensation distinction | OTA q5, Cases 11/12/16 for domain authority |

## Integration record (Batch A scope)

The distributed-workflow correctness stack, money-specific authority boundaries, provider-unknown state, idempotency scope, Outbox/Inbox limits, Saga compensation qualifiers, and reconciliation requirements were integrated into both EN and VI. Existing IDs were preserved; Topic 08 owns broker mechanics, Topic 17 owns the API contract, Topic 25 owns consumer/retry interactions, and Case 15 owns the concrete relay crash workflow. A payment-contract checkpoint on 2026-08-23 added provider/version scope and an operational unknown queue without selecting Stripe or Adyen as a universal default. Remaining decisions are provider-specific, accounting/compliance-specific, or deployment-specific.

## Payment-contract checkpoint (2026-08-23)

The public answers now distinguish three contracts instead of treating “idempotent payment” as one switch:

| Boundary | Integrated rule | Evidence and limit |
| --- | --- | --- |
| Local command | Claim a scoped key and canonical fingerprint; commit business state, result and Outbox intent together | PostgreSQL uniqueness and AWS Outbox guidance; local durability does not settle an external payment |
| Provider command | Pin API/version, account/region, key lifetime, mismatch/concurrent-reuse behavior, status inquiry, webhook authenticity/replay and settlement/reversal semantics | Stripe and Adyen expose provider-specific behavior; exact retention and failover scope must be verified for the chosen integration |
| Unknown recovery | Store `unknown_since`, next inquiry, owner, risk tier and reconciliation deadline; query/reconcile before a new logical charge | Stripe lifecycle/webhook guidance supports asynchronous and duplicate-delivery handling; no universal age threshold was found |

The wallet and asynchronous-payment case prompts link to this canonical checklist. The OTA late-webhook case adds the separate supplier-authority rule: local hold expiry is not proof that a GDS/airline inventory mutation was released. Supplier-specific expiry and idempotency behavior remains an explicit open contract, not an inferred fact.

## EN/VI parity and proposed follow-up changes

- [ ] Keep all question IDs and answer order identical.
- [ ] Replace “Saga ensures data integrity” with “coordinates local transactions toward a declared desired state under eventual consistency.”
- [x] Add the correctness stack: local ACID → command idempotency → Outbox → relay → consumer Inbox/constraint → workflow state → provider reconciliation.
- [x] Split command idempotency, consumer deduplication, and provider idempotency into three separate examples.
- [x] Replace “Outbox guarantees delivery” with durable intent plus relay/retention/repair requirements.
- [ ] Mark TCC/seat-hold equivalence as an analogy and list Try/Confirm/Cancel requirements.
- [x] Add explicit `UNKNOWN`, `PENDING`, `COMPENSATING`, and `RECONCILIATION_REQUIRED` states.
- [ ] Preserve the double-entry and money representation material, but link provider-specific guarantees and legal/compliance scope rather than generalising them.
- [ ] Add metrics and test cases from the coverage matrix in both languages.

## Open questions and falsifiers

- [ ] Should the public title change while the local key remains stable? If search/index metadata is coupled to the title, do that only in the later integration pass.
- [ ] Which provider contract should the final example use? Stripe and Adyen have different idempotency details; provider-neutral pseudocode may be safer.
- [ ] What is the project’s actual reconciliation SLA for payment, inventory, and booking? Without it, “eventual” is not an operational contract.
- [ ] Is 2PC actually available in the target databases/drivers and operated by a recovery owner? If not, remove code-like 2PC guidance and retain it as a bounded comparison.
- [ ] What is the retention window for late retries and callbacks? If it exceeds the proposed idempotency TTL, the recommendation is falsified until a durable reference is added.
- [ ] Can the ledger authority prove a zero-sum posting invariant under crash/replay? A failing property test falsifies any “exactly once money movement” wording.

## Source ledger

The reviewed date for every ledger row is `2026-08-23`; each row records its URL/title, organization, tier, version or revision, and exact claims supported. Provider-specific idempotency and payment/compliance pages remain separate evidence rather than being merged into a universal contract.

All sources were reviewed on `2026-08-23`. `S1` is a standard/official specification or provider/project documentation; `S2` is first-party engineering/architecture guidance; `S3` is an original pattern/reference or primary technical source.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | [PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html) — PostgreSQL | S1; current PostgreSQL 18 docs | Prepared transaction persists state for later commit/rollback; external transaction manager required; long-lived prepared transactions are resource-heavy. |
| S02 | [Two-Phase Transactions](https://www.postgresql.org/docs/current/two-phase.html) — PostgreSQL | S1; current PostgreSQL 18 docs | PostgreSQL’s 2PC commands and X/Open XA model/scope; prepared state is intended to be short. |
| S03 | [pg_locks](https://www.postgresql.org/docs/current/view-pg-locks.html) — PostgreSQL | S1; current docs | Prepared transactions continue to hold locks; lock observation and recovery evidence. |
| S04 | [Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) — AWS Prescriptive Guidance | S1/S2; current guidance | Local transactions, forward recovery, compensation, choreography/orchestration heuristic and coordinator trade-off. |
| S05 | [Saga orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) — AWS | S1/S2; current guidance | Orchestrator responsibilities, retries/timeouts/failures and visibility/centralisation trade-offs. |
| S06 | [Handling errors in Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html) — AWS | S1; current service docs | Retry/Catch are state-machine controls with error matching and backoff; provider-specific workflow semantics. |
| S07 | [TCC Mode](https://seata.apache.org/docs/v2.1/user/mode/tcc/) — Apache Seata | S1; docs 2.1 | Try reserves, Confirm commits, Cancel releases; intrusive business implementation and idempotency/empty-rollback concerns. |
| S08 | [Saga Mode](https://seata.apache.org/docs/user/mode/saga/) — Apache Seata | S1; current project docs | Seata’s state-machine Saga implementation and compensation model; framework scope, not a universal Saga guarantee. |
| S09 | [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox) — Chris Richardson / Microservices.io | S3; current pattern page | Local DB/outbox atomicity, relay crash duplicate and idempotent consumer requirement. |
| S10 | [Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) — Debezium | S1; stable docs | CDC/router schema, event ID, aggregate key, routing, tracing and payload controls. |
| S11 | [Transactional outbox with Cosmos DB](https://learn.microsoft.com/en-us/samples/azure-samples/cosmos-db-design-patterns/transactional-outbox/) — Microsoft Azure | S1/S2; sample reviewed current | Transactional batch plus change feed gives durable intent and at-least-once relay; consumer idempotency still required. |
| S12 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — AWS Builders’ Library | S2; current first-party article | Caller intent, idempotency session, request/result atomicity, late requests, semantic equivalence and payload mismatch. |
| S13 | [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Stripe | S1; current API docs | One provider’s key retention, parameter comparison and concurrent/validation semantics; not universal. |
| S14 | [API idempotency](https://docs.adyen.com/development-resources/api-idempotency) — Adyen | S1; current API docs | A second provider’s scope, key/region behaviour and retry contract; useful contradiction to S13. |
| S15 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | S1; RFC 9110 / STD 97, 2022 | Safe/idempotent method semantics, POST retry caveat, 202 Accepted, 405/Allow and why HTTP method semantics do not prove business idempotency. |
| S16 | [Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF | S1; RFC 9457, 2023 | A standard error representation useful for distinguishing retryable, unknown, conflict and validation states; it does not define retries. |
| S17 | [Currency codes](https://www.iso.org/iso-4217-currency-codes.html) — ISO | S1; ISO 4217 catalogue page | Currency code/exponent is external domain data; monetary scale/rounding must be explicit. |
| S18 | [Ledger architecture](https://docs.moderntreasury.com/platform/ledger-architecture) — Modern Treasury | S2; current provider docs | Double-entry ledger concepts, immutable entries, accounts and posting authority; vendor model must be checked against project requirements. |
| S19 | [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) — PostgreSQL | S1; current PostgreSQL 18 docs | Database uniqueness/check/foreign-key constraints as local invariants, not application-only locks. |
| S20 | [INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html) — PostgreSQL | S1; current PostgreSQL 18 docs | Atomic conflict handling and affected-row semantics useful for idempotent local claims. |
| S21 | [Messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/) — OpenTelemetry | S1; semantic conventions 1.44.0 family | Correlating workflow command/event/consumer traces without putting sensitive payloads in telemetry. |
| S22 | [Workflow executions](https://docs.temporal.io/workflow-execution) — Temporal | S1; current project docs | Durable workflow state/replay model and activity retry/timeout scope; durable engine changes orchestrator failure mode, not business invariants. |
| S23 | [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | S2; current web edition | Deadlines, retry amplification, jitter, retry budgets and load/failure testing. |
| S24 | [PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/) — PCI Security Standards Council | S1; PCI DSS v4.x family, current standards page | Payment-card data security/compliance boundary; not a workflow guarantee and not a substitute for provider contract. |
| S25 | [XA Transactions](https://www.opengroup.org/standards/xa) — The Open Group | S1; XA specification family | The transaction-manager/resource-manager model that frames 2PC/XA; implementation/version/vendor support must be verified separately. |

### Per-source review-date map for the compact S01-S25 ledger

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
| S23 | 2026-08-23 |
| S24 | 2026-08-23 |
| S25 | 2026-08-23 |

## Excluded discovery candidates

Framework-specific “distributed transaction” tutorials were retained only when they documented a real protocol (S07/S08/S22). Blog reposts of the Microservices.io Outbox page, generic payment advice without a provider contract, and ledger vendor marketing without a technical guarantee were excluded or used only as terminology discovery. No source was found that proves a universal idempotency TTL, universal reconciliation cadence, or universal Saga participant-count threshold.

## Gate status

- [x] Complete EN/VI local sections and IDs read.
- [x] Discovery pool broadened; selected ledger has 25 distinct inspected sources.
- [x] Facts, inferences, recommendations, unknowns and provider/version scope separated.
- [x] Workload, invariants, crash windows, comparison, coverage, contradictions, anti-patterns and falsifiers recorded.
- [x] Canonical/duplicate decision recorded.
- [x] Public title/key decision reviewed; Topic 09 remains the canonical workflow home.
- [x] EN/VI integration applied in Batch A.
- [x] Validation passed after integration and rechecked in the final gate.

## Research gate addendum (highest-quality evidence pass)

The existing dossier was expanded with a second discovery pass because this is a broad, high-risk money/workflow topic. The candidate pool was broad but not exhaustively counted; 41 distinct sources are retained across the original ledger and the addendum below. The pool included standards, database specifications, original papers, workflow/broker implementation docs, provider contracts, security/compliance material, and first-party operations guidance. Duplicate mirrors, reposts, generic “Saga versus 2PC” explainers, and vendor pages without a stated guarantee were excluded. The selected count is a research record, not a claim that every architecture needs all 41 sources.

### Additional coverage matrix

| Gate area | Additional evidence inspected | Exact boundary retained |
| --- | --- | --- |
| Definitions | Original Sagas paper, AWS/Azure Saga guidance, XA/Jakarta/2PC docs | Saga is a sequence of local transactions plus business compensation; XA is a coordinator/resource protocol; neither is a universal architecture rule. |
| Invariants | PostgreSQL constraints, partial/conditional uniqueness, isolation/locking, Spanner serializability | State the invariant and local authority first; distributed coordination does not replace the constraint. |
| Workload | Spanner transaction/isolation limits, Kafka design, Pub/Sub delivery, SRE retry guidance | Latency, participant count, region, retry rate, and transaction duration are workload assumptions, not pattern properties. |
| Failure/crash windows | Prepared/in-doubt transactions, Outbox/CDC, provider PaymentIntent/webhook behavior | `UNKNOWN` remains a durable state until inquiry/reconciliation; compensation can fail and be observable. |
| Retries/timeouts | Stripe API/payment state, Pub/Sub, Kafka, SRE, trace propagation | Provider key scope, webhook ordering, and retry retention are provider/version-specific. |
| Operations/recovery | Logical decoding/CDC, durable workflow execution, broker EOS scope, reconciliation | Relay/connector/workflow health and repair are separate from local commit correctness. |
| Security/privacy | PCI DSS, OAuth Security BCP, W3C Trace Context, provider webhook signatures | Workflow correctness does not prove card-data compliance, authorization, or safe telemetry. |
| Testing | Existing source set plus broker/provider state and replay documentation | Test crash-after-side-effect, duplicate callback, stale version, retention expiry, and operator redrive. |
| Domain trade-offs | Spanner strong consistency, Cassandra/query-first contrast elsewhere, Stripe/Adyen contract differences | Prefer the strongest local/provider guarantee that fits the domain; do not infer that every distributed system must use Saga. |

### Contradiction and limit addendum

| Competing statement | Evidence on both sides | Required wording |
| --- | --- | --- |
| “2PC is unusable at scale” | PostgreSQL/Oracle/Jakarta support prepared/XA; prepared resources can remain in-doubt and block or consume capacity | 2PC is a real option with coordinator, participant, latency, and recovery cost; the decision is workload/provider-specific. |
| “Strong distributed transactions are impossible” | Spanner documents serializable/external consistency in a managed scope; Sagas trade atomicity for workflow recovery | Strong guarantees exist at a price and within a provider/region contract; do not use a blanket impossibility claim. |
| “Exactly-once is impossible” | Kafka/Pub/Sub expose scoped EOS/exactly-once; external PSP/DB effects remain outside those scopes | Say “exactly once within named boundaries,” then design idempotency/reconciliation at the next boundary. |
| “Provider idempotency key means duplicate charge is impossible” | Stripe and Adyen expose different retention, region, concurrent-request, and response rules | Treat the provider contract as evidence for one integration only; local key, provider key, and settlement reconciliation are separate. |
| “A Saga guarantees data integrity” | Saga guidance explicitly includes compensation, pivot, retryable steps, and failure handling | A Saga is a convergence/recovery protocol; intermediate and compensating states are part of the product contract. |

### Negative evidence and anti-pattern addendum

- Do not choose Saga merely because services are separate; first test whether the money/hold invariant belongs in one local transaction or a provider-supported atomic boundary.
- Do not use a distributed lock to “protect the balance” while the ledger remains unconstrained. A lock can expire, fail over, or be bypassed; the ledger transition must reject invalid state.
- Do not equate a durable Outbox row with a published, consumed, settled, or refunded business effect.
- Do not let a workflow engine’s retry policy repeat a non-idempotent provider operation without a stable provider reference and status inquiry.
- Do not copy Stripe’s v1 retention or API v2 behavior into a provider-neutral contract. The integration must pin API version, account/region scope, key lifetime, and response semantics.
- Do not use an end-of-day reconciliation job as the only repair path for a high-risk `UNKNOWN` payment if the business cannot tolerate that age of uncertainty.
- Do not call a TCC reservation a real TCC implementation unless Try/Confirm/Cancel are explicit, idempotent, owned, and coordinated under a documented expiry/rollback policy.
- Do not treat trace/correlation IDs as safe places for PAN, account number, PNR, or user identity; propagate opaque IDs and authorize replay/redrive.

### Current-vs-proposed content gap

| Current dossier/content risk | Proposed follow-up or applied decision | Evidence/limit |
| --- | --- | --- |
| 2PC and Saga can read as mutually exclusive choices | Add a decision tree: local ACID -> provider atomic contract/XA if justified -> Saga/Outbox when the boundary is real | PostgreSQL/XA/Spanner scope and measured workload |
| Provider idempotency is described generically | Applied in Topic 09 q1/q2: pin provider/version/account scope, retention, mismatch/concurrency, inquiry, webhook and settlement semantics; keep the final provider choice open | Stripe/Adyen docs are examples, not a universal contract; the chosen provider/version is still unresolved |
| Reconciliation is mainly end-of-day | Applied in Topic 09 q1: durable unknown-age fields, owner, next inquiry, deadline, age/risk buckets and escalation; no magic threshold was invented | Product/finance must supply the actual risk and settlement SLA |
| Ledger guidance risks becoming a vendor pattern | Keep double-entry/invariant language; label Modern Treasury as practitioner evidence and make accounting/compliance assumptions explicit | Domain accounting and PCI review |
| Outbox/CDC can appear to imply completion | Add a boundary diagram: local commit -> relay -> broker -> consumer -> external effect -> reconciliation | Debezium/AWS/broker docs and case 15 |
| TCC/OTA analogy can be overread | Use “TCC-like” unless all phases and coordinator guarantees are present | Supplier/API contract and implementation state machine |

### Explicit unknowns and falsifiers

- Unknown: the repository content does not name a target PSP/GDS, API version, account/region, idempotency retention, webhook retry policy, or settlement SLA. These must remain placeholders.
- Unknown: no source establishes a universal reconciliation cadence, idempotency TTL, Saga participant count, or safe transaction duration.
- Unknown: the intended database isolation level, connection pool, replication topology, and failover behavior are not product requirements; they cannot be inferred from the pattern name.
- Falsifier for “local ledger first”: an invariant genuinely spans an external resource whose provider offers a stronger atomic protocol and whose latency/recovery contract is acceptable. Then compare XA/provider transaction or redesign the product boundary.
- Falsifier for “Saga + Outbox”: an irreversible effect has no stable identity, no compensating action, and no inquiry/reconciliation path. The workflow then needs a stronger provider contract or a user-visible manual gate.
- Falsifier for “provider key + local key”: the provider does not guarantee key scope across the relevant region/account/failover window and cannot answer status. The design must add a durable reference/settlement process and may not promise duplicate prevention.

### Additional inspected source ledger

The rows below are additional distinct sources; together with S01-S25 above they bring the inspected selected set to 43. Each URL, document/version scope, review date, and supported claim is recorded explicitly.

| ID | URL/title | Organization/type | Tier | Version/revision | Reviewed | Exact claims supported |
| --- | --- | --- | --- | --- | --- | --- |
| S26 | [Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | AWS, architecture guidance | T2 | Current AWS docs | 2026-08-23 | Same-local-transaction intent, relay/CDC alternatives, duplicate consumer requirement, ordering caveat |
| S27 | [Saga distributed transactions pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) | Microsoft Azure, architecture guidance | T2 | Current docs | 2026-08-23 | Compensable, pivot, and retryable steps; compensation is not rollback |
| S28 | [Microservices architecture](https://learn.microsoft.com/en-us/azure/architecture/microservices/) | Microsoft Azure, architecture guidance | T2 | Current docs | 2026-08-23 | Data autonomy, eventual consistency, chatty/complexity trade-offs, modular decomposition scope |
| S29 | [Spanner transactions](https://docs.cloud.google.com/spanner/docs/transactions?hl=en) | Google Cloud, database docs | T2 | Current docs; provider/region scope | 2026-08-23 | Serializable transaction behavior, abort/retry and strong distributed transaction counterexample |
| S30 | [Spanner isolation levels](https://docs.cloud.google.com/spanner/docs/isolation-levels) | Google Cloud, database docs | T2 | Current docs; provider/region scope | 2026-08-23 | Serializable versus repeatable-read trade-offs and abort behavior |
| S31 | [Spanner: Google’s globally-distributed database](https://research.google.com/archive/spanner-osdi2012.pdf) | Google Research, original paper | T1 | OSDI 2012; historical design | 2026-08-23 | Historical evidence for synchronous replication/external consistency; not a universal product guarantee |
| S32 | [Sagas](https://doi.org/10.1145/38713.38742) | Garcia-Molina and Salem, original paper | T1 | SIGMOD Record, 1987 | 2026-08-23 | Original local-transaction sequence and compensating transaction model |
| S33 | [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | PostgreSQL, database docs | T2 | Current docs; verify deployed major version | 2026-08-23 | Read Committed/Repeatable Read/Serializable behavior and retry implications |
| S34 | [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) | PostgreSQL, database docs | T2 | Current docs; verify deployed major version | 2026-08-23 | Row/table/advisory lock scope, deadlock and transaction lifetime |
| S35 | [PostgreSQL logical decoding output](https://www.postgresql.org/docs/current/logicaldecoding-walsender.html) | PostgreSQL, database docs | T2 | Current docs; verify deployed major version | 2026-08-23 | Logical decoding/replication-slot boundary for CDC relay and retention risk |
| S36 | [Pub/Sub exactly-once delivery](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery?hl=en) | Google Cloud, messaging docs | T2 | Current docs; regional pull/client scope | 2026-08-23 | Scoped exactly-once acknowledgement/redelivery semantics; higher-latency/unsupported-mode caveats |
| S37 | [Kafka design](https://kafka.apache.org/42/design/design/) | Apache Kafka, project design | T2 | Kafka 4.2 design page | 2026-08-23 | Transaction/offset boundary and why Kafka EOS does not cover arbitrary PSP/DB effects |
| S38 | [PaymentIntent lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle?locale=en-GB) | Stripe, provider docs | T2 | Current docs; Stripe API/provider scope | 2026-08-23 | `processing`, `succeeded`, `requires_action`, cancellation, and asynchronous payment states |
| S39 | [Stripe webhooks](https://docs.stripe.com/webhooks?lang=node) | Stripe, provider docs | T2 | Current docs; live/test mode scope | 2026-08-23 | Duplicate/unordered event delivery, signature verification, retry behavior |
| S40 | [Stripe API v2 overview](https://docs.stripe.com/api-v2-overview) | Stripe, provider docs | T2 | API v2; compare with v1 idempotency docs | 2026-08-23 | Provider/version-specific idempotency retention and re-execution differences |
| S41 | [OAuth 2.0 Security BCP](https://datatracker.ietf.org/doc/rfc9700/) | IETF, BCP | T1 | RFC 9700, 2025 | 2026-08-23 | PKCE, refresh-token/sender constraints and secure provider/workflow authorization |
| S42 | [Just Published: PCI DSS v4.0.1](https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1) | PCI Security Standards Council | T1 | PCI DSS v4.0.1, published 2024-06-11 | 2026-08-23 | Limited revision, corrections/clarifications, no added/deleted requirements, and v4.0 retirement timing |
| S43 | [PCI DSS document library](https://www.pcisecuritystandards.org/document_library/?class=pcidss&doc=pci_dss) | PCI Security Standards Council | T1 | Current library; version must be pinned to the assessment | 2026-08-23 | Current standard/supporting-document location and assessment-scope reminder |
