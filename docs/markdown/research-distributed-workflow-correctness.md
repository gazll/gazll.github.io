# Research Dossier — Distributed Workflow Correctness

Status: `INTEGRATED`

Batch: A

Reviewed: 2026-08-23

Scope: Saga, transactional outbox, idempotent commands/consumers, delivery semantics, unknown external outcomes, compensation, reconciliation, and their different use in fintech, OTA/airline, commerce, and notification systems.

Non-goal: This dossier does not claim one universal provider, broker, or database implementation. It records the evidence boundary for the integrated catalog and leaves deployment-specific values as explicit unknowns.

## 1. Local content under review

Primary topic material:

- `public/data/topics/09-distributed-tx-fintech.json`
  - `distributed-transaction-patterns.q1–q5`
  - `correctness-where-money-is-involved.q1–q2`
- `public/data/topics/25-microservice.json`
  - `03-distributed-data-consistency.q1–q3,q5`
  - `09-idempotency-the-central-link.q1–q3`
- `public/data/topics/28-distributed-lock-lease.json`
  - `apply-operate-and-test-it.q2` where lock, outbox, and idempotency intersect
- `public/data/topics/11-system-design-cases.json`
  - `the-big-prompts.q1,q11,q13–q16,q18,q20`
- `public/data/topics/16-project-concurrency-whiteboard.json`
  - `presenting-dissecting-the-ota-project.q2,q5`

Case-study material:

- `public/data/case-studies/articles/15-transactional-outbox-order-workflow.html`
  - especially sections 1–9
- Related domain evidence to compare later: Case Studies 01, 11, 12, and 16.

## 2. Core model: correctness is a stack, not one pattern

The content should teach the following stack. Each layer solves a different failure window; no layer makes the others unnecessary.

| Layer | Question | Mechanism | What it can guarantee | What it cannot guarantee |
| --- | --- | --- | --- | --- |
| Local invariant | What must change atomically? | One service/database transaction, constraint, version check | Atomic local state transition | Atomicity across another database, broker, PSP, or GDS |
| Command deduplication | Is this the same client intent? | Idempotency key + request fingerprint + durable result/state | Repeated submission maps to one logical command within a stated scope/window | It cannot identify two genuinely different intents merely because payloads match |
| Durable delivery intent | Did committed state create a message to publish? | Transactional Outbox | The business row and delivery intent commit or roll back together in one local DB | It does not publish by itself and does not prevent duplicate relay publishes |
| Relay/broker delivery | Can a message be retried without loss? | Polling/CDC relay, acknowledgements/confirms, retry/DLQ | At-least-once delivery when the relay and broker are operated correctly | It does not make an external side effect exactly once |
| Consumer effect dedup | Did this consumer already apply this event? | Inbox/processed-event table + business unique constraint | Duplicate delivery becomes a no-op for the same consumer/effect | It does not fix a wrong event, wrong business key, or stale order automatically |
| Workflow coordination | Which local transition is legal next? | Explicit state machine, Saga choreography, or orchestration | Durable progress, compensation/forward recovery decisions | Compensation is not a time machine; irreversible external effects may remain |
| External outcome resolution | Did the PSP/GDS actually perform the effect? | Provider idempotency, status query, webhook, reconciliation | Turns timeout/unknown into a known business state eventually | A network timeout alone cannot tell success from failure |
| Recovery proof | Is the system converging? | Reconciliation, replay, repair, alerts, audit | Finds stuck/mismatched state and makes ownership visible | It cannot recover data or evidence that was never retained |

This stack is the main anti-duplication boundary. A page about Outbox should not re-teach provider idempotency; a page about OTA should apply both to the supplier boundary and the local hold state.

## 3. Verified claims from sources

### 3.1 Saga

**Verified fact — high confidence.** AWS describes a Saga as a sequence of local transactions where a failure leads to compensating transactions; it distinguishes forward recovery/retry from backward recovery/compensation. AWS also identifies choreography and orchestration as variants, with choreography becoming harder to track as participants grow and orchestration improving flow visibility while introducing a coordinator dependency.

Source: [AWS Prescriptive Guidance — Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html), reviewed 2026-08-23.

**Content implication — recommendation.** Explain Saga as a business workflow/recovery model, not as a distributed rollback. A compensation is a new business action that attempts to reach a desired state; it cannot erase an email, undo a ticket issuance, or retroactively remove an observation.

**Correction needed.** The local material says “beyond four or five steps, prefer orchestration.” That can be a useful heuristic, but it is not a universal threshold. Rewrite it as: choose orchestration when explicit workflow visibility, timers, branching, retries, ownership, or audit outweigh the coordinator's operational cost; choose choreography when the flow is small and event ownership remains legible.

### 3.2 Transactional Outbox

**Verified fact — high confidence.** The transactional outbox writes the business change and the message/event into the same local database transaction, then a separate relay publishes the outbox record. It avoids a database-to-broker 2PC boundary. A relay can publish more than once if it crashes after publishing and before recording completion, so consumers need idempotency.

Source: [Microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox), reviewed 2026-08-23.

**Verified fact — high confidence.** Debezium's Outbox Event Router captures an outbox table, routes by aggregate type, uses an aggregate ID as the emitted key by default, exposes an event ID for deduplication, and supports JSON/Avro payloads and tracing context. The aggregate key matters for Kafka partition ordering, but it does not by itself establish global order.

Source: [Debezium — Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html), reviewed 2026-08-23.

**Correction needed.** Replace any absolute wording such as “Outbox guarantees the message is sent if the transaction commits” with the operationally precise form: “Outbox makes the delivery intent durable with the business commit; a healthy relay/CDC path must eventually publish it, and operators must monitor/retry/repair relay failures.”

**Correction needed.** “CDC preserves ordering” must be scoped to the source log and chosen key/partition. Multiple aggregates, topics, consumers, and retries can have different ordering guarantees.

### 3.3 Idempotent commands and retries

**Verified fact — high confidence.** AWS recommends a unique caller-provided request identifier for operations that may be retried, and describes storing the idempotent request record atomically with the mutation. AWS also discusses returning a semantically equivalent result for retries, detecting parameter mismatch, and considering late-arriving requests.

Source: [AWS Builders' Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), reviewed 2026-08-23.

**Verified fact — provider-specific.** Stripe stores the resulting status/body for an idempotency key, compares parameters on reuse, and documents key pruning after at least 24 hours. Adyen documents a minimum seven-day key validity, account-level scope, a concurrent in-progress error path, and a warning that keys are not deduplicated across simultaneously targeted regional endpoints.

Sources:

- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests), reviewed 2026-08-23.
- [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency), reviewed 2026-08-23.

**Correction needed.** Do not copy Stripe's or Adyen's retention window into a generic system design. The example must state who owns the key, the endpoint/provider scope, the request fingerprint, the maximum late-arrival window, what happens while `IN_PROGRESS`, and when old records can be safely pruned.

**Correction needed.** “Store the key and result in the same transaction (or via outbox)” is too loose. An Outbox records delivery intent; it is not a replacement for the atomic idempotency claim/result store. The correct question is which local transaction atomically claims the logical command and records the business state/result. An outbox may be written in that same transaction for downstream work.

### 3.4 Delivery semantics and exactly-once scope

**Verified fact — high confidence.** RabbitMQ documents publisher confirms and consumer acknowledgements as separate safety boundaries. Acknowledgements support at-least-once delivery; the consumer should acknowledge only after the required processing/storage has completed.

Source: [RabbitMQ — Reliability guide](https://www.rabbitmq.com/docs/reliability), reviewed 2026-08-23.

**Verified fact — scoped guarantee.** Kafka documents at-least-once behavior by default and explains that exactly-once processing requires coordination between consumed offsets and the output; Kafka transactions/processing guarantees apply within Kafka-managed boundaries and require cooperation from the destination system.

Source: [Apache Kafka — Message delivery semantics](https://kafka.apache.org/documentation/#semantics), reviewed 2026-08-23. If the integration uses the older page currently linked in the repository, replace it with the current documentation link after validating the final page.

**Verified fact — scoped cloud guarantee.** Google Pub/Sub's exactly-once delivery applies to pull subscriptions in a single region, depends on successful acknowledgement handling, and still requires the subscriber to track processing progress to prevent duplicate work when acknowledgement fails. Publish-side duplicates and multi-region conditions remain relevant.

Source: [Google Cloud Pub/Sub — Exactly-once delivery](https://cloud.google.com/pubsub/docs/exactly-once-delivery), reviewed 2026-08-23.

**Content rule.** Every “exactly once” sentence must specify:

- producer or consumer side;
- broker/subscription and client mode;
- region and ordering scope;
- acknowledgement/transaction boundary;
- destination side effect;
- duplicate behavior outside that boundary.

For payment, ticketing, inventory, or email, the safe teaching default is: durable intent + at-least-once delivery + idempotent effect + reconciliation, unless a stronger end-to-end contract is explicitly proven.

### 3.5 Unknown external outcome

**Verified fact — high confidence.** AWS explains that a timeout after a potentially mutating request does not tell the caller whether the effect happened; blindly retrying can create a second resource. The recommended design uses a caller request identifier, an atomic server-side idempotency session, and a way to determine the existing result.

Source: [AWS Builders' Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), reviewed 2026-08-23.

**Domain recommendation.** Model `UNKNOWN`/`PENDING` explicitly after a PSP/GDS timeout. Resolve it with provider status lookup, webhook, or reconciliation. Never convert a transport timeout directly into business failure when the provider may have committed a charge or issued a ticket.

This recommendation is stronger for payment/ticketing because the external system is a separate authority. It is not a universal rule for every non-mutating read.

## 4. Proposed canonical outline

The canonical workflow page should be short enough to be reusable and deep enough to prevent pattern cargo culting:

1. Start with the invariant and local transaction boundary.
2. Explain why a database transaction cannot atomically include a broker/PSP/GDS.
3. Compare command idempotency, Outbox, Inbox, and business constraints.
4. Show the relay crash matrix and at-least-once consequence.
5. Introduce the Saga state machine, choreography/orchestration decision, and compensation limits.
6. Model timeout/unknown outcomes and reconciliation.
7. Define observability: outbox age, relay failure, consumer lag, duplicate rate, unknown age, reconciliation debt.
8. End with a decision checklist and explicit non-goals.

The canonical page should not contain a long bank, OTA, flash-sale, or notification implementation. Those belong to the domain cases below.

## 5. Domain decision matrix

| Domain | Primary invariant | Where strong consistency belongs | Where eventual consistency is acceptable | Main failure/recovery behavior | What not to copy blindly |
| --- | --- | --- | --- | --- | --- |
| Bank / fintech ledger | No money created/lost; balanced postings; no double debit/capture; auditable history | Ledger/account authorization and posting boundary; DB constraints and local ACID | Read projections, notifications, settlement views, non-authoritative analytics | Unknown PSP state, status inquiry, webhook, settlement reconciliation, reversing entries | A distributed lock is not the ledger authority; a Saga is not a license to make a double-entry posting eventually balanced |
| OTA / airline | One seat/itinerary cannot be confirmed twice under the supplier contract; quote/hold/ticket state is honest | Local hold/booking transition and supplier command identity; final supplier authority | Search freshness, availability cache, customer progress UI, non-authoritative projections | Hold expiry, late payment, GDS/PSP timeout, PNR/ticket lookup, compensation/refund, manual reconciliation | A local “available” cache is not proof of sellable inventory; seat hold is TCC-like only if the full Try/Confirm/Cancel contract exists |
| Commerce | Inventory cannot oversell under the chosen sellable-inventory policy; one order intent is deduplicated | Inventory reservation/commit and order/payment intent within their owning services | Search index, notification, fulfillment fan-out, customer-visible pending workflow | Outbox/queue retry, refund or release, stale event rejection, repair/replay | “Payment first, inventory later” is not always safe; choose the order and compensation policy from the product invariant |
| Notification | Accepted/durable/attempted/provider-accepted/delivered/read are different states | Durable acceptance, preference/policy decision, deduplication | Provider delivery and read receipt, subject to provider contract and expiry | Retry within deadline, provider failover, DLQ, expired message; no fake “read” guarantee | A successful broker publish is not delivery to a person |

## 6. Specific changes to make during integration

The core edits below were applied in Batch A; any remaining wording or provider-specific work is follow-up:

- Generalize the canonical explanation around a “distributed workflow correctness stack” and keep fintech ledger material as one domain module.
- Shorten `25-microservice.03` to failure-mechanics and links: dual-write failure, relay choice, state-machine trade-off, and exact-once scope. Remove repeated introductory definitions.
- Keep Case 15 as an implementation case. Its unique value is the crash-window table, transactional Inbox query, business unique key, lag/poison/replay checklist, and test matrix.
- Keep OTA q5 as a domain case. Its unique value is the supplier/PSP boundary, seat hold expiry, ticket-issue pivot, `UNKNOWN`, and reconciliation.
- Keep e-commerce q14–q16 and q20 as domain cases. Their unique value is late webhook/hold races, hot-SKU admission, cell/authority migration, and replay across payment/inventory.
- Keep `28...q2` as the explicit “lock does not replace idempotency/outbox” relationship, but link to canonical pages instead of repeating their internals.
- Replace absolute “standard way”, “exactly once”, “guaranteed sent”, and universal step-count thresholds with scoped language and sources.

## 7. Research uncertainties

- [x] Reuse Topic 09 as the canonical workflow home; no new duplicate catalog design is required in this pass.
- [x] Keep first-party case claims source-scoped; Cases 01, 11, and 16 retain their own verification boundaries.
- [x] Keep provider key retention/scope explicit; Stripe and Adyen semantics are not generalized.
- [x] Use `TCC-like` for OTA seat holds unless the full Try/Confirm/Cancel contract is explicitly implemented.
- [x] Require source of truth, trigger/cadence, owner, terminal state, and manual escalation for every reconciliation contract.

## 8. Integration gate for Batch A

- [x] Exact local IDs mapped.
- [x] Initial duplicate groups recorded.
- [x] Primary/first-party sources collected.
- [x] Facts separated from recommendations and corrections.
- [x] Domain trade-off matrix drafted.
- [x] Final canonical-owner decision approved for the current catalog.
- [x] EN/VI outline approved.
- [x] Data edits applied in Batch A.
- [x] Content and structural validation passed after integration and rechecked in the final gate.
