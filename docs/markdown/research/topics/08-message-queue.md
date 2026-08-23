# Research — Message queue: RabbitMQ vs Kafka

Status: `REVIEW`

Reviewed: 2026-08-23

Local unit: `08-message-queue`

EN file: `public/data/topics/08-message-queue.json`

VI file: `public/data/topics/08-message-queue.vi.json`

## Scope and non-goals

This topic owns broker/log mechanics, delivery semantics, acknowledgement/confirm boundaries, ordering, replay, DLQ, consumer flow control, and event contract evolution.

It should not own the full Saga/Outbox tutorial, API idempotency contract, or domain-specific booking/payment design. Those are cross-referenced from topics 09, 17, 25, 16, and the relevant cases.

## Local content map

| Section | IDs | Current job |
| --- | --- | --- |
| The two models | `08-message-queue.the-two-models.q1–q4` | RabbitMQ routing/queue, Kafka log/partition, choice, queue versus pub/sub |
| Reliability & delivery semantics | `08-message-queue.reliability-delivery-semantics.q1–q10` | at-most/at-least/exactly-once, confirms/acks, durability, ordering, DLQ, consumer dedup, Outbox, event sourcing, rebalances, schema evolution |

## What is correct and reusable

- The topic correctly separates RabbitMQ's routed work-queue model from Kafka's retained partitioned log model.
- It correctly distinguishes publisher confirmation from consumer acknowledgement and from the business side effect.
- The at-most/at-least/exactly-once table already uses a boundary-based definition; this should become the canonical wording used elsewhere.
- The emphasis on stable event IDs, idempotent consumers, aggregate keys, version checks, DLQ ownership, and oldest-message age is strong.
- It correctly warns that Outbox closes DB-to-publish-intent atomicity but does not make the consumer effect exactly once.
- It treats prefetch, poll interval, retry topic, and schema compatibility as operational concerns rather than just API trivia.

## Claims to verify or qualify

| Current claim/shape | Classification | Required qualification |
| --- | --- | --- |
| RabbitMQ is “smart broker, dumb consumer” | Teaching shorthand | Keep only as a mental model; exchanges route, but consumers still own business semantics, dedup, retries, and authorization |
| Durable queue + persistent message + quorum queue survives node loss | Overstated | Durable/persistent affects restart durability; node-loss survival depends on queue type, replicas/quorum, disk, topology, and correlated failure model |
| Kafka is “dumb broker, smart consumer” | Teaching shorthand | Useful contrast, but Kafka brokers still enforce retention, replication, ACLs, transactions, and protocol semantics |
| One consumer per partition | Correct within a consumer group | Say “at most one active consumer assignment per partition in a group”; cooperative rebalancing/static membership changes movement behavior, not the basic assignment invariant |
| RabbitMQ message disappears after ack | Simplified | Acknowledgement makes the delivery eligible for removal under the queue contract; TTL, dead-lettering, replication, and redelivery rules still matter |
| RabbitMQ has low latency / Kafka has millions of messages per second | Workload/benchmark claim | Remove universal performance adjectives. State the access pattern and require benchmark with message size, replication, consumers, retention, and failure mode |
| `acks=all` plus `min.insync.replicas` gives durability | Correct but bounded | Include replication factor, ISR, rack/zone placement, unclean leader election, retention, disk, and acknowledgement ambiguity |
| Modern Kafka clients enable idempotent producer by default | Version-sensitive | Cite the exact client/version/configuration or phrase as “verify; do not assume defaults” |
| Ordering is guaranteed by key alone | Incomplete | Key co-locates records in a partition; producer concurrency, retries, partition changes, rebalances, handler concurrency, and stale-event rules still matter |
| `prefetch` can simply be raised for a backlog | Risky | Prefetch bounds unacked work and affects memory/fairness; tune using handler cost, message size, consumer capacity, and lag age |
| DLQ after N failures is enough | Incomplete | Need classify transient/permanent failures, retry schedule, quarantine, owner, redrive safety, schema fix, and idempotent replay |
| Schema Registry `BACKWARD/FORWARD/FULL` table is universal | Scope error | Label it as a registry compatibility policy; it is not a property of every Kafka topic or RabbitMQ message |
| Event sourcing gives a “perfect audit trail” | Overstated | It gives replayable event history only if events are immutable, complete, correctly authorized, retained, and protected; audit requirements may need separate controls |
| “Only combining Publisher Confirms + Outbox closes the gap completely” | Incorrect absolute | They close the local DB/publish-intent and broker-acceptance gaps; consumer, external provider, and business-effect boundaries remain |

## Evidence and sources

| Source | What it supports | Type | Reviewed |
| --- | --- | --- | --- |
| [RabbitMQ — Reliability guide](https://www.rabbitmq.com/docs/reliability) | Publisher confirms, consumer acknowledgements, retransmission and at-least-once consequences | Official broker docs | 2026-08-23 |
| [RabbitMQ — Consumer acknowledgements and publisher confirms](https://www.rabbitmq.com/docs/confirms) | Confirm/ack independence, prefetch, requeue/redelivery, publisher confirm timing | Official broker docs | 2026-08-23 |
| [RabbitMQ — Quorum queues](https://www.rabbitmq.com/docs/quorum-queues) | Replicated acknowledgement scope, manual ack, poison messages, limits and trade-offs | Official broker docs | 2026-08-23 |
| [RabbitMQ — Consumers](https://www.rabbitmq.com/docs/consumers) | Manual/automatic ack, prefetch, consumer capacity, acknowledgement timeout | Official broker docs | 2026-08-23 |
| [Apache Kafka — Message delivery semantics](https://kafka.apache.org/08/design/design/) | At-most/at-least/exactly-once boundaries and cooperation with destination storage | Official project design doc; versioned page | 2026-08-23 |
| [Apache Kafka — Documentation](https://kafka.apache.org/documentation/) | Current versioned configuration/operations documentation to use for final version-sensitive claims | Official project docs | 2026-08-23 |
| [Google Cloud Pub/Sub — Exactly-once delivery](https://cloud.google.com/pubsub/docs/exactly-once-delivery) | Example of a narrowly scoped exactly-once guarantee and its ack/region/client caveats | Official cloud docs | 2026-08-23 |
| [Confluent — Schema evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) | Compatibility modes and schema-registry scope | Official platform docs | 2026-08-23 |
| [Microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox) | Why broker confirms do not solve DB/broker dual write; consumer duplicate requirement | Original pattern reference | 2026-08-23 |

## Recommended canonical outline

1. Start with the work contract: command/task versus fact/event, ownership, replay, latency, retention, and loss/duplicate tolerance.
2. Explain RabbitMQ topology and Kafka partition/log concepts without vendor slogans as the conclusion.
3. Define the three delivery boundaries: producer → broker, broker → consumer, consumer → durable side effect.
4. Show ack/confirm, prefetch, offset, retry, and crash matrices.
5. Explain ordering as a key/partition/handler/application invariant, not a global broker promise.
6. Compare retry topic/DLX, poison handling, DLQ ownership, and safe redrive.
7. Explain Outbox and Inbox by reference to topic 09/25.
8. Explain schema evolution and event privacy/retention; distinguish domain and integration events.
9. End with a selection matrix based on workload and operational ownership, not “RabbitMQ versus Kafka” as a popularity contest.

## Decision matrix for final content

| Need | RabbitMQ-like work queue | Kafka-like log | Must still be designed by the application |
| --- | --- | --- | --- |
| One worker should handle a command | Competing consumers/queue | Consumer group can model work distribution | Idempotency, command identity, retry, expiry |
| Many independent consumers/replay | Multiple queues possible, retention/ops differ | Consumer groups and retained offsets are natural | Retention, privacy, schema, consumer lag |
| Flexible routing/priority/TTL | Strong fit when configured and measured | Usually requires topic/key/consumer design | Priority starvation, fairness, expiration |
| Per-aggregate order | Single lane/SAC narrows delivery order | Stable aggregate key maps to one partition | Version checks, gaps, replays, handler concurrency |
| Durable publish | Confirms plus durable/replicated topology | Acks/replication/ISR policy | Producer retry ambiguity and duplicate handling |
| Exactly-once business effect | Not supplied by ack/confirm | Only within stated Kafka transaction scope | Atomic dedup with effect or provider idempotency |

## Duplicate/canonical ownership

- Canonical broker mechanics: this topic.
- Canonical distributed workflow and Outbox: topic 09.
- Canonical microservice failure/retry/inbox synthesis: topic 25, but it should link rather than restate this topic's broker semantics.
- Domain-specific queue choice: system-design q18, OTA q5, flash-sale cases, and Case Studies 01/11/15/16.
- Schema and API contract overlap: topics 17, 24, 26; preserve only the part relevant to the local boundary.

## Proposed changes — not applied

- [ ] Replace “durable queue + persistent message + quorum queue” with a scoped durability checklist.
- [ ] Remove universal throughput adjectives and move benchmark claims to a source/workload table.
- [ ] Correct the RabbitMQ confirm/return explanation with the exact client/broker behavior and test scope.
- [ ] Make `exactly once` examples explicitly name the boundary and external side-effect limitation.
- [ ] Split the Outbox question into a short broker-facing explanation with a link to topic 09.
- [ ] Mark Schema Registry compatibility modes as registry-specific and add a source link.
- [ ] Add a retry/DLQ/redrive state machine with owner and poison-message policy.
- [ ] Keep event-sourcing benefits but qualify audit completeness, retention, PII erasure, and replay cost.
- [ ] Update EN/VI in the same integration batch.

## Open questions

- [ ] Which Kafka version/client should final code examples target? The repository currently mixes “modern client” wording with version-sensitive defaults.
- [ ] Should RabbitMQ examples use classic or quorum queues? The answer changes durability, prefetch, timeout, and throughput trade-offs.
- [ ] Do we want a separate event-contract section, or should it stay in this topic and cross-link to DDD/testing?
- [ ] Which metrics are common enough to keep here versus moving to observability topic 20?

## Gate status

- [x] EN/VI structure and all local questions read.
- [x] Current overlap and risky absolutes listed.
- [x] Official sources collected.
- [x] Canonical scope proposed.
- [ ] Final version targets and broker choices reviewed.
- [ ] EN/VI edit outline reviewed.
- [ ] Integration applied.
- [ ] Validation passed after integration.
