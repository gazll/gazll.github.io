# Research — Transactions across services (fintech)

Status: `REVIEW`

Reviewed: 2026-08-23

Local unit: `09-distributed-tx-fintech`

EN file: `public/data/topics/09-distributed-tx-fintech.json`

VI file: `public/data/topics/09-distributed-tx-fintech.vi.json`

## Scope and non-goals

This topic is the strongest candidate for the canonical explanation of distributed workflow correctness: local transaction boundaries, 2PC trade-offs, Saga, Outbox, TCC, idempotent provider calls, unknown outcomes, and ledger correctness.

It must not become a generic explanation of every queue, cache, lock, or database technique. Those belong to topics 08, 05, 17, 25, and 28 and should be linked rather than copied.

## Local content map

| Section | IDs | Current job |
| --- | --- | --- |
| Distributed transaction patterns | `...distributed-transaction-patterns.q1–q5` | 2PC, Saga, Outbox, TCC, service-boundary choice |
| Correctness where money is involved | `...correctness-where-money-is-involved.q1–q6` | PSP unknown outcome, payment idempotency, ledger, money representation, double-spend, transfer workflow |

The local EN/VI files are structurally paired. The main overlap is with `25-microservice.03`, `25-microservice.09`, system-design prompts q1/q11/q14–q16/q20, OTA q5, and Case Study 15.

## What is correct and reusable

- The topic correctly starts from the local consistency boundary instead of assuming a global transaction exists.
- It distinguishes a compensating business action from a database rollback.
- It correctly treats Outbox as a local database transaction plus a separate relay, and recognizes duplicate relay publication.
- It correctly treats provider timeouts as `UNKNOWN/PENDING` rather than proof of failure.
- The double-entry, immutable-ledger, monetary representation, and DB-level conditional-write material is valuable fintech-specific content.
- The advice that a distributed lock is not the authority for a balance is important and should remain visible.

## Claims to verify or qualify

| Claim in current content | Classification | Evidence / action | Confidence |
| --- | --- | --- | --- |
| 2PC participants can remain in-doubt and keep locks while prepared | Verified with scope | PostgreSQL documents that prepared transactions continue holding locks and warns against leaving them open; say “while unresolved/long-lived”, not that every 2PC failure holds locks forever | High |
| Modern systems trade distributed atomicity for Saga + Outbox + idempotency | Recommendation | Good teaching summary, but not a universal replacement. First ask whether the invariant can stay in one local transaction or whether an existing coordinator/2PC contract is appropriate | High |
| Saga “ensures data integrity” | Needs qualification | AWS describes local transactions and compensation; rewrite as “drives the workflow toward a declared desired state under controlled eventual consistency” | High |
| Choreography is suitable for a few participants; orchestration for many | Source-backed heuristic | AWS states this trade-off; avoid an absolute participant count and include visibility, branching, timers, ownership, and coordinator HA | High |
| Orchestrator can be a single point of failure | Needs qualification | A naive orchestrator can be; a durable/replicated workflow service changes the failure mode but does not remove workflow ownership/cost | High |
| TCC is exactly the same as an OTA seat hold | Inference / analogy | Apache Seata defines Try/Confirm/Cancel as a business-coded resource protocol. Call a seat hold “TCC-like” unless all three idempotent phases and a coordinator contract are actually implemented | High |
| Publisher Confirms + Outbox “close the gap” | Needs boundary | Confirms establish broker responsibility; Outbox closes DB/business-state-to-publish-intent atomicity. Neither proves the consumer or PSP side effect occurred once | High |
| Outbox guarantees the message will be sent if DB commit succeeds | Overstated | Say delivery intent is durable; relay/CDC health, retry, retention, and repair are required for eventual publication | High |
| “Store idempotency key + result in same transaction (or via Outbox)” | Incorrectly broad | Outbox is not a substitute for an idempotency claim/result store. The logical command claim, business transition, and result must have a defined local atomic boundary; an Outbox may be written in that transaction | High |
| Every PSP/GDS call can use an idempotency key | Provider-dependent | Make the provider contract explicit. Where no provider idempotency exists, use a stable reference plus status inquiry/reconciliation and do not claim equivalent protection | High |
| End-of-day reconciliation is sufficient | Too narrow | Reconciliation cadence depends on risk and settlement contract. Add online repair/unknown-age thresholds plus periodic settlement reconciliation | Medium |

## Evidence and sources

| Source | What it supports | Type | Reviewed |
| --- | --- | --- | --- |
| [PostgreSQL — PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html) | Prepared state, commit/rollback later, transaction remains resource-heavy; not for ordinary application use | Official database docs | 2026-08-23 |
| [AWS — Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) | Local transactions, forward/backward recovery, choreography/orchestration trade-offs | Official architecture guidance | 2026-08-23 |
| [AWS — Saga orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) | Orchestrator responsibilities, retries/timeouts/failures, coordinator trade-offs | Official architecture guidance | 2026-08-23 |
| [Apache Seata — TCC mode](https://seata.apache.org/docs/v2.1/user/mode/tcc/) | Try reserves, Confirm commits, Cancel releases/reverts; phases are implemented as business code | Official project docs | 2026-08-23 |
| [Microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox) | Local DB + outbox atomicity, relay, duplicate publication, consumer idempotency | Original pattern reference | 2026-08-23 |
| [Debezium — Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) | Outbox schema, event ID, aggregate key, routing, payload and tracing options | Official project docs | 2026-08-23 |
| [AWS Builders' Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) | Caller intent, atomic idempotency session, semantic-equivalent response, late requests | First-party engineering guidance | 2026-08-23 |
| [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests) | One provider's key/result retention, parameter comparison, concurrent/validation behavior | Official provider docs | 2026-08-23 |
| [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency) | Different provider scope/retention and concurrent retry behavior | Official provider docs | 2026-08-23 |

## Recommended canonical model

Use this order in the final topic:

1. Name the invariant and ask whether the data can remain in one local ACID boundary.
2. Explain 2PC/XA as a real option with operational cost, not a forbidden magic word.
3. Introduce the correctness stack: local transaction → command idempotency → Outbox → relay → consumer Inbox/business constraint → workflow state machine → external reconciliation.
4. Compare Saga choreography and orchestration by visibility, coupling, participant behavior, timers, and ownership.
5. Show a failure table for relay crash, duplicate delivery, stale event, provider timeout, compensation failure, and late callback.
6. Keep TCC as a comparison and state exactly when it is appropriate: reservation is a first-class business protocol, not just a `HELD` column.
7. Separate fintech ledger correctness from the general workflow mechanism.
8. End with a domain matrix rather than a universal architecture diagram.

## Domain boundary

| Domain | Keep in this topic | Move/application owned by cases |
| --- | --- | --- |
| Bank/fintech | Ledger invariant, double-entry, posting/authorization boundary, idempotent money command, unknown PSP result, reconciliation | Wallet prompt, settlement workflow, provider-specific implementation |
| OTA/airline | Generic unknown-outcome and compensation rules | Seat hold, quote binding, GDS/PNR/ticket pivot, supplier authority and expiry |
| Commerce | Generic Outbox/Saga mechanics | Inventory admission, hot SKU, refund/release policy, cell migration |
| Notification | Generic delivery/idempotency distinction | Accepted/sent/provider-accepted/delivered/read states, expiry and provider failover |

## Duplicate/canonical ownership decision

Provisional decision: keep this topic as the canonical workflow foundation, but generalize its title/intro from “fintech transaction” to “distributed workflow correctness” only after checking metadata, search, and cross-reference implications. Keep the money-specific section as a clearly labeled domain module.

The following should not repeat the full tutorial:

- `25-microservice.03`: keep failure mechanics, relay comparison, and exact-once scope; link here for fundamentals.
- `25-microservice.09`: keep consumer Inbox/idempotency relation; link here and to API topic for command semantics.
- Case Study 15: retain concrete crash windows and implementation/test evidence.
- OTA q5: retain supplier/PSP state machine and reconciliation.
- E-commerce q14–q16/q20: retain domain races, admission, cells, and authority migration.

## Proposed changes — not applied

- [ ] Replace universal “modern systems trade…” wording with a decision tree: local ACID first, then workflow pattern when the split is real.
- [ ] Qualify 2PC lock wording and link to PostgreSQL prepared-transaction documentation.
- [ ] Split command idempotency from consumer idempotency and from provider idempotency.
- [ ] Replace “TCC exactly equals seat hold” with “TCC-like only when Try/Confirm/Cancel are explicit and idempotent”.
- [ ] Add a state-transition table that distinguishes `UNKNOWN`, `FAILED`, `COMPENSATING`, `RECONCILIATION_REQUIRED`, and terminal success.
- [ ] Add outbox relay health/retention/repair requirements and per-aggregate ordering scope.
- [ ] Preserve the ledger sections, but link them to DB core and API design instead of repeating their principles elsewhere.
- [ ] Update EN and VI together after the canonical outline is approved.

## Open questions

- [ ] Should the public topic key remain stable while only the title/intro becomes more general?
- [ ] Do we want one System Design catalog design built from this topic, or is the topic route sufficient?
- [ ] Which provider contract should the examples use for the final teaching flow: Stripe, Adyen, or provider-neutral pseudocode?
- [ ] What exact reconciliation SLA should each domain case state, and which values are examples versus measured facts?

## Gate status

- [x] Local files and exact sections read.
- [x] Initial overlap map recorded.
- [x] Sources collected and claims scoped.
- [x] Proposed canonical role recorded.
- [ ] Final owner decision reviewed.
- [ ] EN/VI content outline reviewed.
- [ ] Integration applied.
- [ ] Validation passed after integration.
