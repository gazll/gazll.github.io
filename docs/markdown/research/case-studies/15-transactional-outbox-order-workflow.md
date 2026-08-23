# Research — From dual write to a reliable order workflow

Status: `REVIEW`

Reviewed: 2026-08-23

Local unit: `15-transactional-outbox-order-workflow`

EN file: `public/data/case-studies/articles/15-transactional-outbox-order-workflow.html`

VI file: `public/data/case-studies/articles/15-transactional-outbox-order-workflow.vi.html`

Metadata: `public/data/case-studies/15-transactional-outbox-order-workflow.json`, `public/data/case-studies/meta.json`, `public/data/case-studies/manifest.json`

## Scope and non-goals

This is an implementation/teaching case about the database-to-broker crash window. Its unique value is the concrete failure table, relay crash points, Inbox transaction, business unique key, operational metrics, and failure test matrix.

It should not compete with the canonical workflow topic on definitions of Saga, Outbox, idempotency, or delivery semantics. It should demonstrate them in one order workflow and point back to the canonical explanations.

## Local content map

| Section | Current value |
| --- | --- |
| 1. The problem is not choosing the right order | Three dual-write crash windows and client retry problem |
| 2. Start with the real-world process | Order/payment/inventory/shipping state sequence |
| 3. One commit for business row and delivery intent | Local transaction with `aggregate_version` and outbox row |
| 4. Relay publishes without pretending to be exactly-once | Relay claim/ack crash table and at-least-once wording |
| 5. Service B uses an Inbox | Transactional dedup marker plus business unique key |
| 6. Outbox transports events; a Saga controls business | Legal transitions and compensation example |
| 7. API promises only what is durable | `202 Accepted`, pending resource, client retry key |
| 8. Production work often omitted | Lag, retry, poison event, ordering, retention, reconciliation, tracing |
| 9. Failure cases that must be tested | Eight crash/duplicate/stale-event scenarios |
| 10–11 | Conclusion and review questions |

The EN/VI heading structures are paired, with language-specific prose and examples.

## What is correct and reusable

- The three write-order crash windows show why “DB first” versus “broker first” is not the real solution.
- The article correctly keeps the database transaction local and moves publication to a relay.
- The relay crash after broker acknowledgement and before marking the row complete is the right reason to require idempotent consumers.
- The Inbox marker and business unique constraint are correctly treated as separate protections: event identity versus business intent.
- The article correctly separates Outbox transport from Saga business sequencing.
- The `202 Accepted` example makes the API promise honest: durable acceptance is not workflow completion.
- The operational checklist and failure tests are more valuable than another generic pattern definition.

## Claims to verify or qualify

| Current claim/shape | Classification | Required qualification |
| --- | --- | --- |
| A local transaction commits the business row and outbox row together | Verified fact, local scope | Explicitly say “same database/transaction”; it does not include the broker or downstream service |
| “A commit preserves both; rollback removes both” | Correct but incomplete | Add local database failure/commit semantics and note that relay publication is a later step |
| `FOR UPDATE SKIP LOCKED` lets multiple relays run in parallel | Conditional | The claim requires a correct claim/lease/visibility-timeout design, bounded batch, reclaim after worker death, and a durable state transition |
| Relay marks `PUBLISHED` after broker acknowledgement | Design choice | Broker acknowledgement means broker responsibility under its contract, not consumer effect; status update failure can cause duplicates |
| Outbox is at-least-once | Correct under relay behavior | State the duplicate window and that cleanup/retention cannot precede the deduplication window |
| `aggregate_version` helps consumers detect stale/out-of-order events | Correct but not sufficient | It detects a violation only if the consumer enforces a version rule; it does not reorder or repair events automatically |
| Inbox marker and business row commit in one transaction | Strong recommendation | Keep it; specify the consumer's local store and unique key scope |
| `202 Accepted` is the right response | Workload/API recommendation | It is appropriate when durable acceptance is complete but processing is asynchronous; provide a status resource and expiry/error semantics |
| “Every service writes only its DB and its own Outbox” | Architecture recommendation | Apply only when database-per-service ownership is intentional; a modular monolith may use one DB transaction without pretending services are distributed |
| Correlation/causation IDs should travel through events | Operational recommendation | Add trace context/privacy/PII rules; IDs must not expose sensitive data |

## Evidence and sources

| Source | Relevance | Type | Reviewed |
| --- | --- | --- | --- |
| [Microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox) | Atomic local business change + outbox, relay, duplicate publication, consumer idempotency | Original pattern reference | 2026-08-23 |
| [Debezium — Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) | Event ID, aggregate key, routing, schema/payload/tracing and insert-only outbox behavior | Official project docs | 2026-08-23 |
| [RabbitMQ — Reliability guide](https://www.rabbitmq.com/docs/reliability) | Publisher confirms and consumer acknowledgements are distinct boundaries; ack timing affects redelivery | Official broker docs | 2026-08-23 |
| [AWS — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) | Client timeout, repeated command, request ID, atomic idempotency state and semantic-equivalent response | First-party engineering guidance | 2026-08-23 |
| [AWS — Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) | Saga as local transactions plus forward recovery/compensation; choreography/orchestration trade-off | Official architecture guidance | 2026-08-23 |

This article is repository-authored teaching material, not evidence that a specific company operates exactly this implementation. The final page should label code as a design example unless an original production source is added.

## Canonical/domain/implementation role

- Canonical mechanism owner: topic 09 after its outline is approved.
- Queue/delivery semantics owner: topic 08.
- Consumer Inbox/idempotency owner: topic 25 section 09, with API command semantics in topic 17.
- This case's unique role: show the crash window and how the pieces compose in a reliable order workflow.

## Proposed content shape — not applied

1. Keep the opening crash-window table; it is the hook and the evidence.
2. Add a short callout linking to the canonical Outbox/Saga/idempotency sections instead of repeating their full definitions.
3. Keep the local order state machine and legal transition table.
4. Keep the relay crash matrix, but explicitly distinguish broker ack, consumer ack, and business effect.
5. Keep the Inbox SQL and add a sentence about transaction isolation/unique constraint ownership.
6. Keep `aggregate_version`, but explain that it is a validation signal, not automatic repair.
7. Keep the API `202` contract and add status-resource expiry/manual escalation.
8. Expand the production checklist with `outbox_oldest_age`, relay failure rate, duplicate/no-op rate, DLQ age, and reconciliation debt.
9. Retain the test list and add: duplicate provider callback, late compensation, retention-window expiry, and a crashed worker after claim.
10. Shorten generic prose after all cross-references are available.

## Duplicate decisions

| Repeated concept | Keep here? | Reason |
| --- | --- | --- |
| DB/broker dual-write crash window | Yes | This is the case's main implementation evidence |
| Generic Outbox definition | Shorten/link | Canonical topic 09 owns it |
| Generic Saga definition | Shorten/link | The case only needs order transitions and refund policy |
| Generic idempotency key | Shorten/link | Keep client retry example; API semantics belong to topic 17/09 |
| Inbox transaction | Yes | Concrete consumer implementation is this case's distinctive value |
| Queue choice RabbitMQ/Kafka | Minimal | Point to topic 08; only state the workload contract needed by this order flow |
| Reconciliation and lag metrics | Yes | Case-specific operational ownership is useful |

## EN/VI and cross-reference plan

- Preserve the same 11-section structure in both files.
- Translate the state names/code identifiers unchanged.
- Use the same claim qualifiers in both languages, especially “at-least-once”, “local transaction”, “unknown”, and “compensation is not rollback”.
- Add cross-references with the existing repository syntax only after canonical IDs are finalized.
- Do not change metadata title/tags until the duplicate/canonical review decides whether the case remains in the distributed-patterns category.

## Open questions

- [ ] Does the final case need a named broker (RabbitMQ/Kafka), or should it remain broker-neutral?
- [ ] What retention/deduplication window should the example state? It cannot be copied from Stripe/Adyen without a domain contract.
- [ ] Should the example include a provider-side idempotency call, or keep PSP behavior abstract and focus on local workflow correctness?
- [ ] Is `PUBLISHED` the right outbox state name when publication and consumer processing are separate, or should the example use `RELAYED`/`ACKED` plus a separate delivery observation?

## Gate status

- [x] EN/VI article headings and full body read.
- [x] Unique implementation value identified.
- [x] Claims requiring qualification listed.
- [x] Sources collected.
- [ ] Final canonical cross-reference IDs decided.
- [ ] EN/VI edit outline approved.
- [ ] Integration applied.
- [ ] Validation passed after integration.
