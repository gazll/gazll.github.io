# System Design & Case Studies Duplicate Matrix

Status: `INITIAL INVENTORY — NO CONTENT MERGED`

This matrix records overlap found during the first read. A keyword hit is only a signal; the final decision must compare the actual invariant, failure model, and audience of each item.

## Decision vocabulary

- `canonical`: owns the reusable mechanism and its guarantees/non-guarantees.
- `domain case`: owns the business invariant, external boundary, and domain-specific trade-offs.
- `implementation case`: owns a concrete implementation, incident, benchmark, or migration.
- `cross-reference`: keep a short local explanation and link to the canonical item.
- `rewrite`: keep the item but change its job so it stops teaching the same lesson.
- `hold`: do not change until the research dossier or source evidence resolves the question.

## Initial ownership map

| Mechanism | Provisional canonical owner | Keep as domain/implementation evidence | First action |
| --- | --- | --- | --- |
| 2PC limits and local consistency boundary | `09-distributed-tx-fintech.distributed-transaction-patterns.q1` | `25-microservice.03...q1`, Case 15 problem section | Keep one explanation; make the others failure-specific and cross-reference it |
| Saga choreography/orchestration/compensation | `09-distributed-tx-fintech.distributed-transaction-patterns.q2` | OTA q5, e-commerce q14–q16, Case 15 section 6 | Move domain state machines and irreversible pivots into cases |
| Transactional Outbox | `09-distributed-tx-fintech.distributed-transaction-patterns.q3` plus `25-microservice.03...q2` relay comparison | Case 15 sections 1–5, e-commerce q15/q16 | Canonical owns atomicity and relay limits; cases own crash evidence and operational choices |
| Idempotent command/API | `09...correctness-where-money-is-involved.q2` and `17-rest-api-design` | Payment q1/q11, OTA q2/q5, flash-sale q20 | Split API contract, provider contract, and consumer/inbox semantics instead of repeating one recipe |
| Idempotent consumer/inbox | `25-microservice.09...q2` | Case 15 section 5, e-commerce q16/q18/q20 | Keep the consumer-specific part in microservice material; cases show the unique business constraint |
| Unknown external outcome and reconciliation | `09...correctness-where-money-is-involved.q1` | Payment q1/q11, OTA q5, booking q14/q20 | Keep the payment version precise; rewrite OTA/commerce versions around provider authority and expiry |
| Delivery semantics and ordering | `08-message-queue` | `25-microservice.04`, Case 15 section 4, q18 | Canonical owns broker semantics; cases state why a command queue or replayable log fits |
| Local DB locks and constraints | `05-db-core-index-lock` | `28-distributed-lock-lease`, booking/inventory cases | Do not use a distributed lock as a substitute for the domain constraint |
| Distributed lease/fencing | `28-distributed-lock-lease` | flash-sale q20, scheduled-worker examples | Keep lock protocol generic; cases explain whether the lock is actually the authority |
| Inventory/seat reservation | booking/inventory design cluster | Arcturus, hot deals, OTA, duplicate booking, Shopify | Treat as a domain cluster, not as another generic Saga tutorial |

## Exact overlap groups

### Group A — 2PC, dual write, and Outbox

| Item | Current role | Provisional decision |
| --- | --- | --- |
| `09-distributed-tx-fintech.distributed-transaction-patterns.q1` | Explains why 2PC is avoided | `canonical`; verify lock/in-doubt wording |
| `09-distributed-tx-fintech.distributed-transaction-patterns.q3` | Explains Outbox and DB/broker atomicity gap | `canonical`; add relay liveness and ordering limits |
| `25-microservice.03-distributed-data-consistency.q1` | Repeats dual-write failure | `cross-reference`; keep code-specific failure analysis |
| `25-microservice.03-distributed-data-consistency.q2` | Repeats Outbox and adds polling/CDC | `rewrite`; keep relay choice and move core definition to canonical |
| Case 15 sections 1–4 | Teaches crash windows and relay duplicate | `implementation case`; retain its concrete crash table |
| `11-system-design-cases...q15/q16/q18` | Applies outbox to e-commerce scale | `domain case`; remove generic definition and focus on scale/migration |
| `16-project-concurrency-whiteboard...q5` | Applies outbox to OTA | `domain case`; focus on supplier boundary and unknown outcome |

### Group B — Saga, compensation, and state machines

| Item | Current role | Provisional decision |
| --- | --- | --- |
| `09...distributed-transaction-patterns.q2` | Choreography/orchestration and compensation | `canonical`; explicitly distinguish business compensation from rollback |
| `09...distributed-transaction-patterns.q4` | TCC versus Saga | `canonical comparison`; label OTA seat hold as TCC-like unless the full contract exists |
| `25-microservice.03...q3` | Saga traps and a “four or five steps” heuristic | `rewrite`; remove universal threshold and cite a decision framework |
| Case 15 section 6 | Order workflow example | `implementation case`; keep legal transitions and refund intent |
| `11...q14` | Payment/hold state machine under late webhook | `domain case`; keep expiry race and user-visible state |
| `11...q15/q16` | E-commerce Saga evolution and cells | `domain case`; focus on authority boundaries, migration, and replay |
| `16...q5` | OTA long-running booking Saga | `domain case`; keep GDS/PSP pivots and reconciliation |

### Group C — Idempotency and duplicate effects

| Item | Current role | Provisional decision |
| --- | --- | --- |
| `09...correctness-where-money-is-involved.q2` | Payment idempotency key and IN_PROGRESS | `canonical for provider/payment command`; correct the “or via outbox” shortcut |
| `25...09-idempotency-the-central-link.q1` | General idempotency key | `cross-reference`; keep general mental model only if it adds something unique |
| `25...09-idempotency-the-central-link.q2` | Consumer idempotency and Inbox | `canonical for consumer side`; keep separate from API command dedup |
| `25...09-idempotency-the-central-link.q3` | Why idempotency connects layers | `rewrite` into a short synthesis/cross-reference |
| `11...q1/q11` | Wallet/payment API and PSP unknown outcome | `domain case`; keep ledger/provider semantics |
| `11...q14/q16/q20` | Late webhook, replay, flash-sale race | `domain case`; keep state/constraint-specific dedup |
| `16...q2/q5` | Seat hold and OTA workflow | `domain case`; keep supplier reconciliation and hold expiry |
| Case 15 section 5 | Inbox unique constraint and business key | `implementation case`; retain concurrent-consumer example |
| `28...apply-operate-and-test-it.q2` | Lock does not remove idempotency/outbox need | `cross-reference`; keep the relationship, not a second tutorial |

### Group D — Queue, retry, ordering, and “exactly once”

| Item | Current role | Provisional decision |
| --- | --- | --- |
| `08-message-queue` | Broker/log semantics and reliability | `canonical`; owns delivery vocabulary |
| `25...01-cascading-failure-retry-storm` | Request retry budget and overload | `canonical for call-chain failure`; link from workflow material |
| `25...04-messaging-event-driven-at-scale` | Queue buildup, ordering, DLQ, publisher confirms | `rewrite/cross-reference`; retain implementation-specific RabbitMQ details |
| Case 15 sections 4, 8, 9 | Relay retry, poison event, ordering, tests | `implementation case`; keep operational checklist |
| `11...q18` | RabbitMQ vs Kafka by command/replay use case | `domain case`; focus on workload and ownership |
| `25...03...q5` | Exactly-once boundary | `canonical candidate`; align terminology with Kafka/Google documented scopes |

### Group E — Booking/inventory correctness

| Item | Current role | Provisional decision |
| --- | --- | --- |
| `16...q1–q5` | OTA browse/hold/payment/ticketing | `domain case cluster`; do not collapse into payment tutorial |
| `11...q13/q14` | Travel marketplace and late payment webhook | `domain case`; focus on search-vs-book authority and hold expiry |
| `11...q19/q20` | Flash-sale admission and cache loss | `domain case`; focus on hot SKU, bounded load, and cache non-authority |
| Case 01 | Ordered in-memory inventory processing | `implementation case`; preserve reported architecture/benchmark boundaries |
| Case 11 | Peak hot-deal operations | `implementation case`; compare with Arcturus only where implementation differs |
| Case 12 | Incident/race-condition repair | `incident case`; keep evidence and failed fix, not generic lock theory |
| Case 16 | Shopify reservation architecture | `implementation case`; keep source-specific MySQL/connection insight |

## No-delete policy for integration

Before shortening or merging an item:

- [ ] Capture the old question/article ID.
- [ ] Decide whether the ID remains with the canonical item or the domain case.
- [ ] Add a cross-reference or migration alias for every moved concept.
- [ ] Check all references in `public/data/content-index.json`, `catalog.json`, and written `[[...]]` links.
- [ ] Preserve any unique evidence, benchmark, incident timeline, or domain invariant.

## Open questions

- [ ] Should `09-distributed-tx-fintech` be generalized and renamed to “Distributed workflow correctness”, with its money section retained as a domain module?
- [ ] Is the current System Design catalog sufficient to expose one canonical workflow design, or is a new catalog design needed without creating another Study Track duplicate?
- [ ] Which existing case-study claims are first-party facts versus teaching examples and need an evidence label?
- [ ] What is the retention contract for idempotency keys in each example: caller, service, provider, and late-arrival window?
