# Research - Message queue: RabbitMQ versus Kafka

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `08-message-queue`

EN file: `public/data/topics/08-message-queue.json`

VI file: `public/data/topics/08-message-queue.vi.json`

## Scope and non-goals

This topic owns broker and log mechanics: routing, queues/partitions, publisher confirms, consumer acknowledgements, offsets, delivery semantics, ordering, replay, DLQ/quarantine, consumer flow control, retention, and event contract evolution. It is the canonical queue reference for the catalog.

It does not own the complete Saga/Outbox tutorial, API idempotency contract, payment/ledger correctness, cache behavior, or OTA design. Link to [09-distributed-tx-fintech](09-distributed-tx-fintech.md), [25-microservice](25-microservice.md), [16-project-concurrency-whiteboard](16-project-concurrency-whiteboard.md), [11-system-design-cases](11-system-design-cases.md), and [../case-studies/15-transactional-outbox-order-workflow](../case-studies/15-transactional-outbox-order-workflow.md) instead of copying them.

The discovery pass considered a broad, non-exhaustively counted candidate pool and selected 33 distinct standards, official project/provider documents, and first-party engineering sources. Duplicated mirrors, old version pages with no distinct behavior, SEO comparisons, and generic “Rabbit is X/Kafka is Y” summaries were excluded. The 200-source ceiling is a discovery allowance; the final ledger is evidence, not a target link count.

## Local content map

The complete EN and VI files were read. They contain two sections and fourteen question records.

| Section | Exact local IDs | Current job |
| --- | --- | --- |
| The two models | `08-message-queue.the-two-models.q1` through `q4` | RabbitMQ exchange/queue routing, Kafka log/partition, choice, queue versus pub/sub |
| Reliability and delivery semantics | `08-message-queue.reliability-delivery-semantics.q1` through `q10` | At-most/at-least/exactly-once, confirms/ACKs, durability, order, DLQ, dedup, Outbox, event sourcing, rebalances, schema |

## What is correct and reusable

- The RabbitMQ-versus-Kafka contrast is useful when described as a workload model: routed work/consumer flow versus retained partitioned log/replay. It should never be a performance slogan.
- Publisher confirmation, broker durability/replication, consumer acknowledgement/offset, and business side effect are distinct boundaries. The local topic already points in this direction; make the four-boundary table canonical.
- At-most-once, at-least-once, and exactly-once are correctly treated as scoped delivery/effect contracts rather than moral rankings.
- Stable event IDs, aggregate keys, version checks, idempotent consumers, DLQ ownership, replay safety, and oldest-message age are the right operational details.
- Outbox closes the local DB-to-publish-intent dual-write gap but leaves relay, broker, consumer, external provider, and business-effect boundaries visible.
- Prefetch/poll, unacked/pending work, partition lag, retry schedule, and schema compatibility belong in the design answer, not only in an operations appendix.

## Claims to verify or qualify

| Claim or teaching shape | Classification | Required scope/qualification | Confidence |
| --- | --- | --- | --- |
| RabbitMQ is “smart broker, dumb consumer” | Teaching shorthand | Exchanges route, but consumers still own business validation, dedup, retries, authorization, and side effects. | High |
| Kafka is “dumb broker, smart consumer” | Teaching shorthand | Kafka enforces retention, replication, ACLs, partition protocol, transactions, and group coordination. | High |
| Durable queue + persistent message + quorum queue survives node loss | Overstated | Depends on queue type, replicas/quorum, disk, topology, failure correlation, and acknowledgement timing. | High |
| RabbitMQ is low latency and Kafka is high throughput | Unverified universal benchmark | State message size, replication, consumers, retention, batching, failure mode, and measured workload. | High |
| One consumer per partition | Correct only within a consumer group | At most one active assignment per partition in a group; rebalances and handler concurrency still affect effects. | High |
| Kafka key guarantees order | Incomplete | Key co-locates records in a partition; producer retries, multiple in-flight work, replays, partition changes, and application version checks remain. | High |
| `acks=all` means the event is durable everywhere | Incorrect | ISR/min-insync/replication/rack/disk/unclean-election/retention scope it; it does not mean every consumer processed it. | High |
| Rabbit ACK means the message was processed exactly once | Incorrect | ACK is a consumer protocol boundary; crash before/after business commit can cause loss or redelivery depending on timing. | High |
| DLQ after N attempts is reliability | Incomplete | Classify errors, quarantine, owner, schema fix, replay auth, idempotency, retention, and age/action. | High |
| Schema Registry compatibility is a property of all messages | Scope error | It is a configured registry/subject/version policy; Rabbit payloads and other serializers need their own contract. | High |
| Outbox plus publisher confirm closes every gap | Incorrect | It covers local intent and broker acceptance; consumer/external/business effect remain separate. | High |
| Exactly-once is impossible | Over-generalized | Kafka transactions, SQS FIFO dedup, and Pub/Sub exactly-once demonstrate scoped guarantees; arbitrary effects still need idempotency. | High |
| Event sourcing gives a perfect audit trail | Overstated | Replay history must be immutable, complete, authorized, retained, protected, and privacy-compatible; audit may need separate controls. | High |

## Workload, invariants, and failure model

### Delivery boundary model

| Boundary | Question | Typical evidence/control |
| --- | --- | --- |
| Producer -> broker | Did the broker accept/store the publication? | Rabbit publisher confirm; Kafka producer acknowledgement/transaction; durable outbox intent |
| Broker retention/commit | Can the record be replayed after a consumer crash? | Kafka retention/offset; Rabbit queue/ack/requeue; SQS visibility; provider retention |
| Broker -> consumer | Did this delivery become acknowledged/committed? | Rabbit consumer ACK; Kafka offset; Pub/Sub ACK; visibility timeout |
| Consumer -> business effect | Did the durable side effect happen once? | Local transaction + Inbox/business key/version; external provider idempotency/reconciliation |

The last boundary is why “delivery guarantee” and “business effect guarantee” must not be collapsed into one word.

### Workload model

| Workload | Strong questions before selecting a broker |
| --- | --- |
| Command/task | Is routing selective? Is work acknowledged after a local side effect? What is the retry/DLQ owner? |
| Domain event | How many independent consumers need the fact? What is retention/replay and schema evolution? |
| Ordered aggregate stream | What key defines order? Can one hot key limit throughput? How are stale versions handled? |
| High fan-out analytics | Can consumers start at a historical offset? What is lag/retention/cost? |
| Low-latency work queue | What is the prefetch/unacked memory bound and what happens to a slow consumer? |
| External side effect | What stable identity, dedup, timeout/unknown, and reconciliation contract exists? |

### Invariants

1. A message is not considered business-complete merely because it was published, confirmed, delivered, or ACKed.
2. Every retry/replay path has a stable event/command identity and a deduplication or reconciliation policy.
3. Ordering is named at the smallest useful scope: aggregate/key/partition/queue, not “global” by default.
4. The consumer ACK/offset follows the durable side effect boundary, unless the product explicitly chooses loss over duplicate work.
5. A DLQ is a quarantine state with owner, retention, diagnosis, replay authorization, and age alert.
6. Event schemas evolve under a named compatibility policy; a registry default is not a universal contract.

### Crash windows

| Crash/failure | Unsafe shortcut | Recovery design |
| --- | --- | --- |
| DB commit succeeds, publish fails | Direct dual write and hope for retry | Transactional Outbox/CDC, relay age and repair |
| Broker confirms, producer loses response | Publish again with no identity | Stable event ID and consumer dedup; broker-specific producer idempotence where scoped |
| Consumer effect commits, ACK/offset fails | Treat redelivery as exceptional | Inbox/business unique key makes redelivery a safe no-op or explicit conflict |
| Consumer ACKs before effect | Assume ACK means success | ACK after local durable effect, or explicitly accept loss |
| Worker dies with unacked/pending message | Increase prefetch forever | Bounded prefetch, visibility/lease/requeue policy, reclaim and age metrics |
| Poison message retries forever | Infinite redelivery | Bounded retry, quarantine/DLQ, owner, safe replay |
| Rebalance during handler work | Assume partition order equals effect order | Commit/ack discipline, pause/claim policy, aggregate version checks |
| Schema changes during replay | Replay current code against incompatible event | Compatibility checks, versioned consumer, quarantine and migration |
| Broker failover loses an acknowledged record | Treat acknowledgement as global durability | Replication/ISR/quorum/region contract and reconciliation |

## Best-practice comparison

| Decision | RabbitMQ-shaped option | Kafka-shaped option | Selection rule |
| --- | --- | --- | --- |
| Primary abstraction | Exchange -> queue -> consumer | Topic -> partition -> consumer group | Use the model that matches routing/replay/ordering needs |
| Work distribution | Competing consumers, prefetch, ACK/requeue | Group assignment, poll/offset, lag | Size flow control from handler time, payload, backlog age |
| Replay | Queue retention/DLX strategy | Native retained log and offsets | Choose replay as a first-class requirement, not an afterthought |
| Ordering | Queue/stream/partition topology and consumer behavior | Per partition, usually keyed | State exact order scope and hot-key trade-off |
| Publication confirmation | Publisher confirms | Producer ACK/transaction | Neither proves business side effect |
| Replication | Queue type/quorum/topology | RF/ISR/min-insync/election | Name failure domain and acknowledged durability |
| Retry | Requeue/retry queue/DLX | Retry topic/backoff/DLQ | Avoid hot-loop redelivery; preserve identity and age |
| Schema | Application serializer/contract | Registry compatibility policy | Version every event contract and test old/new consumers |
| Exactly-once | Consumer idempotency/transactional effect | Kafka transaction within Kafka boundary | Do not extend either to arbitrary external systems |

## Coverage matrix

| Required area | Local coverage | Evidence | Gap before integration |
| --- | --- | --- | --- |
| Definitions | Rabbit/log model and delivery vocabulary | Rabbit/Kafka/SQS/Pub/Sub docs | Add a four-boundary glossary and avoid broker slogans |
| Invariants | Identity, ACK-after-effect, key order, DLQ ownership | Local content; AWS Outbox; broker docs | Add explicit invariant to every reliability question |
| Workload | Routing/replay/order/flow-control selection | Broker docs; SRE overload | Add message size, consumer count, retention, replication, failure-domain fields |
| Failure/crash windows | Dual write, ACK, rebalance, poison, failover | Rabbit/Kafka/AWS/Debezium | Add a versioned event and stale-event example |
| Retries/timeouts | Retry queues/topics, backoff, DLQ | gRPC retry; SRE; provider queue docs | Add attempt budget, jitter, `Retry-After`, and age thresholds |
| Operations/recovery | Lag/oldest age, pending/unacked, replay, quarantine | Rabbit/Kafka/PubSub/SQS | Add runbook owner and safe redrive authorization |
| Security/privacy | Trace propagation, schema/payload and replay boundaries | W3C Trace Context, OTel, RFC 9457 | Add auth/tenant/PII constraints to redrive and observability |
| Testing | Contract/integration/chaos | Pact, Testcontainers, Chaos Mesh | Add crash-after-effect/ACK and rebalance tests |
| Domain trade-offs | Command/event, order/fan-out, money/external effect | Topics 09/11/16/25 | Link domain cases without repeating their workflow tutorials |

## Contradictions and limits

| Apparent rule | Counter-evidence or scope | Final wording |
| --- | --- | --- |
| “Rabbit is at-most-once unless configured” | Rabbit docs describe manual ACK/redelivery/duplicates and multiple queue semantics | State the chosen ACK, durability, queue type, and crash boundary |
| “Kafka is always at-least-once” | Kafka transactions/EOS and producer/idempotence settings alter named internal boundaries | State producer/consumer config and whether external effects are included |
| “Exactly-once does not exist” | SQS FIFO, Pub/Sub regional exactly-once, Kafka EOS | Use a boundary/provider/region/client-qualified guarantee |
| “A quorum means no loss” | Quorum/ISR acknowledgement still depends on disk, topology, retention, election, and correlated failures | Describe the failure domain and recovery objective |
| “One key means order” | Partition changes, handler parallelism, retry/replay, stale messages | Per-key/partition order plus application version enforcement |
| “DLQ is the end state” | A poison message may be a schema bug, transient outage, auth issue, or malicious payload | Quarantine with diagnosis, owner, retention, and replay policy |
| “Schema registry solves compatibility” | Registry policy applies to configured subjects/serializers; code and semantics can still break | Test wire and business compatibility, with pinned policy/version |

## Negative evidence and anti-patterns

- Do not choose a broker from throughput claims without message size, batching, replication, consumers, retention, and failure-mode benchmarks.
- Do not ACK before the local durable effect merely to increase apparent throughput.
- Do not use an unbounded prefetch/poll queue to hide a slow consumer; it shifts the failure to memory and redelivery latency.
- Do not requeue a poison message in a tight loop or let a DLQ become an unowned archive.
- Do not treat a Kafka partition key as a global order or a Rabbit queue as a global broadcast without the topology that proves it.
- Do not publish directly after a DB commit when the event is part of the business transition and no recovery/repair exists.
- Do not extend Kafka/SQS/Pub/Sub exactly-once wording to a payment, database, email, or human-visible effect.
- Do not replay old events without schema compatibility, authorization, rate limits, and idempotent consumer behavior.
- Do not put sensitive payloads into trace attributes or expose raw DLQ payloads to every operator.
- Do not call an event history an audit trail unless retention, immutability, authorization, redaction, and completeness are designed.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Keep here |
| --- | --- | --- |
| Broker/log/ACK/order/replay/DLQ/schema | This topic | Full mechanics and decision tables |
| Outbox/Saga/provider unknown | Topic 09 | Boundary explanation and links only |
| Retry/pool/cache/observability | Topic 25 | Link operational interactions; avoid full cache/retry tutorial |
| OTA/booking use | Topic 16 and Topic 11 | Broker choice applied to domain, not a second broker tutorial |
| Order outbox/inbox crash | Case 15 | Concrete failure matrix link |
| Consumer Inbox/idempotency | Topic 25/09 | Queue-specific integration point only |

## Current-vs-proposed content gaps

| Current content risk | Proposed change (not applied) | Evidence/owner |
| --- | --- | --- |
| Rabbit/Kafka contrast can read as a technology verdict | Lead with workload, retention, routing, order, and failure-domain questions | Rabbit/Kafka/SQS/Pub/Sub docs |
| Delivery labels can collapse broker and business effect | Add producer, broker, consumer, and business-effect boundary table | Rabbit/Kafka/AWS Outbox |
| DLQ is named without a complete operating contract | Add error classification, owner, retention, replay authorization, and age action | Rabbit/SQS/Pub/Sub docs plus local runbook |
| Order/key advice can imply global order | Add per-key/partition/queue scope, hot-key, handler concurrency, and stale-version rule | Kafka design and local application invariant |
| Schema evolution is registry-centric | Add serializer/registry/version scope and consumer compatibility tests | Protobuf/Confluent/Pact |


## Integration record (Batch A scope)

The canonical broker/effect boundary, workload-based RabbitMQ/Kafka comparison, scoped delivery semantics, DLQ ownership, ordering limits, and schema-evolution qualifiers were integrated into both EN and VI. Existing item IDs were preserved; Outbox/Saga, workflow, consumer-idempotency, OTA, and order-crash explanations point to their canonical units instead of being duplicated here. The remaining bullets below are follow-up provider/version checks, not missing public-data integration.

## Expansion pass (Batch N slice, 2026-08-23)

- [x] Extended `reliability-delivery-semantics.q2` with an explicit queue-type choice: quorum queues for replicated queue semantics versus streams for retained append/replay and fan-out workloads.
- [x] Kept the boundary limit visible: queue type does not turn publisher confirmation or consumer ACK into an external business-effect guarantee.
- [x] Mirrored the wording in EN/VI and refreshed per-item provenance with RabbitMQ confirms, quorum-queue, streams, and reliability documentation.
- [ ] The multi-tenant blueprint still needs its own fairness/tenant-cost integration review; this q2 change is the canonical broker primitive only.

## Proposed follow-up changes

- [ ] Start with the four delivery/effect boundaries and define exactly-once by boundary.
- [ ] Replace Rabbit/Kafka personality slogans with workload contracts and failure-domain tables.
- [ ] Add explicit producer, broker, consumer, and business-effect crash matrices.
- [ ] Separate queue flow control (`prefetch`, poll, unacked, lag) from application concurrency and DB capacity.
- [ ] Add an order example with aggregate key, partition/queue scope, version check, stale-event handling, and replay.
- [ ] Add a DLQ/quarantine runbook: error class, owner, retention, replay authorization, schema check, and age alert.
- [ ] Add schema evolution examples for Protobuf/registry and state that policy/version is deployment-specific.
- [ ] Link Outbox and Inbox to topics 09/25 and Case 15 rather than restating their complete patterns.
- [ ] Apply all wording changes to EN and VI together after the canonical outline is approved.

## EN/VI and cross-reference plan

- Preserve both section structures and all fourteen question IDs.
- Keep broker names, configuration names, state names, formulas, and delivery labels unchanged in translation.
- Use the same scoped qualifiers in EN/VI: “within a consumer group,” “within Kafka,” “provider/region-specific,” “at-least-once delivery,” and “business effect.”
- Add links to topics 09/25/16/11 and Case 15 only after public anchors are approved.
- Validate structural parity and content checks after integration; this record does not modify public content.

## Open questions and falsifiers

- [ ] Which broker/version is the example deployment targeting, and which defaults are intentionally pinned?
- [ ] Is the primary workload command/task, durable domain event, replayable analytics, or ordered aggregate stream?
- [ ] What is the tolerated message loss, duplicate cost, max lag/oldest age, and replay window?
- [ ] Which external effects are included in the claimed delivery guarantee, and what idempotency/reconciliation exists outside the broker?
- [ ] What is the DLQ owner, retention, redrive authorization, and maximum acceptable age?
- [ ] What would falsify “at-least-once plus idempotent consumer” for a particular operation? No stable business identity, no durable dedup/reconciliation, or an irreversible side effect with no provider contract would require a different product/transaction choice.
- [ ] What would falsify the Rabbit/Kafka selection? A benchmark under the actual message size, replication, consumers, retention, and failure SLO that contradicts the assumed workload should replace the heuristic.

## Source ledger

All URLs below were inspected on 2026-08-23. Tier `T1` is a standard/specification, `T2` official implementation/provider documentation, and `T3` first-party engineering guidance. Version labels are intentionally explicit where the source is versioned.

| # | Source URL and title | Organization/type | Tier | Version/revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | [RabbitMQ - Reliability](https://www.rabbitmq.com/docs/reliability) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Confirm/ACK boundaries, redelivery, at-least-once duplicates |
| 2 | [RabbitMQ - Confirms](https://www.rabbitmq.com/docs/confirms) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Publisher confirms, consumer ACK, prefetch, requeue |
| 3 | [RabbitMQ - Quorum queues](https://www.rabbitmq.com/docs/quorum-queues) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Replication/ack scope, poison/backlog/fan-out limits |
| 4 | [RabbitMQ - Consumers](https://www.rabbitmq.com/docs/consumers) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Ack timeout, prefetch, consumer capacity |
| 5 | [Apache Kafka Documentation](https://kafka.apache.org/documentation/) | Apache Kafka, project docs | T2 | Current site; verify deployed version | 2026-08-23 | Topic/partition/group concepts and operational references |
| 6 | [Apache Kafka - Design](https://kafka.apache.org/42/design/design/) | Apache Kafka, project design | T2 | Kafka 4.2 design page | 2026-08-23 | Per-partition order, ISR, election, retention, transactions |
| 7 | [Kafka producer configurations](https://kafka.apache.org/40/configuration/producer-configs/) | Apache Kafka, project config docs | T2 | Kafka 4.0 | 2026-08-23 | `acks`, producer idempotence, transactions; version scope |
| 8 | [AWS SQS - Queue types](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-types.html) | AWS, queue docs | T2 | Current docs | 2026-08-23 | Standard at-least-once/best-effort order and FIFO scope |
| 9 | [AWS SQS - FIFO exactly-once processing](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html) | AWS, queue docs | T2 | Current docs | 2026-08-23 | Five-minute FIFO dedup window and scope |
| 10 | [Google Cloud Pub/Sub - Exactly-once delivery](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery?hl=en) | Google Cloud, queue docs | T2 | Current docs | 2026-08-23 | Regional/pull/client exactly-once scope and latency caveat |
| 11 | [Google Cloud Pub/Sub - Subscription overview](https://docs.cloud.google.com/pubsub/docs/subscription-overview) | Google Cloud, queue docs | T2 | Current docs | 2026-08-23 | Default at-least-once, optional ordering key/region |
| 12 | [Azure Service Bus - Message loss and duplicates](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-message-loss-and-duplicates) | Microsoft Azure, queue docs | T2 | Current docs | 2026-08-23 | Peek-lock at-least-once, receive-delete loss/duplicate trade-off |
| 13 | [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) | Redis, project docs | T2 | Current docs | 2026-08-23 | Consumer groups, pending entries, ACK/reassignment |
| 14 | [AWS - Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | DB/business write to publish-intent atomicity and duplicate consumers |
| 15 | [Microservices.io - Transactional outbox](https://microservices.io/patterns/data/transactional-outbox) | Original pattern reference | T4 | Current page | 2026-08-23 | Relay duplicate boundary and consumer idempotency |
| 16 | [Debezium - Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) | Debezium, project docs | T2 | Stable docs | 2026-08-23 | Outbox ID/aggregate key/payload/routing and insert-only model |
| 17 | [Confluent - Schema evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) | Confluent, platform docs | T2 | Current platform docs | 2026-08-23 | BACKWARD/FORWARD/FULL compatibility scope |
| 18 | [Protocol Buffers - Proto3 guide](https://protobuf.dev/programming-guides/proto3/) | Google, protocol docs | T1 | Current docs | 2026-08-23 | Reserved fields and wire/source evolution constraints |
| 19 | [W3C Trace Context](https://www.w3.org/TR/trace-context/) | W3C, recommendation | T1 | Recommendation, 2021 | 2026-08-23 | Trace propagation, privacy, security, and trust boundary |
| 20 | [OpenTelemetry - Messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) | OpenTelemetry, specification | T1 | Current semantic conventions | 2026-08-23 | Producer/consumer correlation and messaging attributes |
| 21 | [Google SRE - Handling overload](https://sre.google/sre-book/handling-overload/) | Google, SRE book | T3 | Current online edition | 2026-08-23 | Throttling, retry boundary, load shedding/overload behavior |
| 22 | [gRPC - Retry](https://grpc.io/docs/guides/retry/) | gRPC, official docs | T2 | Current docs | 2026-08-23 | Retry classification, attempt/backoff/jitter/throttle scope |
| 23 | [Google - Dapper tracing](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) | Google Research, original paper | T1 | 2010 | 2026-08-23 | Tracing correlation/sampling motivation for async systems |
| 24 | [RFC 9457 - Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) | IETF, standard | T1 | RFC 9457, 2023 | 2026-08-23 | Structured error/quarantine API response; avoid debug leakage |
| 25 | [RFC 6585 - Additional HTTP status codes](https://datatracker.ietf.org/doc/rfc6585/) | IETF, standard | T1 | RFC 6585, 2012 | 2026-08-23 | 429 and `Retry-After` for consumer/API backpressure |
| 26 | [Pact - How contract testing works](https://pactflow.io/how-pact-works/) | PactFlow, testing docs | T3 | Current docs | 2026-08-23 | Consumer/provider contract verification |
| 27 | [Testcontainers - Getting started](https://testcontainers.com/getting-started/) | Testcontainers, project docs | T2 | Current docs | 2026-08-23 | Real broker/database integration test lifecycle |
| 28 | [Chaos Mesh - Network chaos](https://chaos-mesh.org/docs/simulate-network-chaos-in-physical-nodes/) | Chaos Mesh, project docs | T2 | Current docs | 2026-08-23 | Delay/loss/partition testing for consumers and producers |
| 29 | [AWS - Prescriptive guidance on Saga patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html) | AWS, architecture guidance | T2 | Current docs | 2026-08-23 | Why workflow/compensation is separate from broker delivery |
| 30 | [AWS S3 lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html) | AWS, object-store docs | T2 | Current docs | 2026-08-23 | Example of provider lifecycle, not a queue guarantee; used to contrast durable cleanup |
| 31 | [Kubernetes - CronJobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) | Kubernetes, official docs | T2 | Current docs | 2026-08-23 | Approximate scheduled trigger and idempotent job boundary |
| 32 | [Cloud Pub/Sub subscription retry policy](https://cloud.google.com/pubsub/docs/subscription-retry-policy) | Google Cloud, queue docs | T2 | Current docs | 2026-08-23 | Exponential retry/backoff and message retry scope |
| 33 | [RabbitMQ - Streams](https://www.rabbitmq.com/docs/streams) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Append/replay/fan-out shape and limits distinct from task queues |
| 34 | [RabbitMQ - Priority support](https://www.rabbitmq.com/docs/priority) | RabbitMQ, project docs | T2 | RabbitMQ 4.3 docs | 2026-08-23 | Consumer/message priority, separate-channel guidance, starvation and strict-priority limits |
| 35 | [RabbitMQ - Flow control](https://www.rabbitmq.com/docs/flow-control) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Publisher backpressure when queues or replicated components fall behind |
| 36 | [RabbitMQ - Memory and disk alarms](https://www.rabbitmq.com/docs/alarms) | RabbitMQ, project docs | T2 | Current docs | 2026-08-23 | Resource watermarks and publishing-connection blocking under pressure |

## Excluded/low-value candidates

- Duplicate Rabbit/Kafka pages and old Kafka design versions were collapsed unless a versioned default or changed guarantee was distinct.
- “RabbitMQ versus Kafka benchmark” pages were excluded because benchmark hardware/workload/replication/retention were not comparable or reproducible.
- Generic exactly-once articles were excluded when they omitted region, client, transaction, or external-effect boundaries.
- Provider-specific retry/DLQ tutorials were retained only where they supplied a concrete counterexample to a universal delivery claim.

## Gate status

- [x] Complete EN/VI files and exact local IDs read.
- [x] Queue/log canonical role and overlap owners mapped.
- [x] Broad discovery completed; 36 selected sources mapped to claims.
- [x] Coverage, contradictions, negative evidence, and falsifiers recorded.
- [x] Public EN/VI content updated in Batch A.
- [x] Cross-reference/index integration applied in Batch A.
- [x] Validation passed after integration and rechecked in the final gate.
- [x] Batch N broker-type expansion integrated and validated in EN/VI.
