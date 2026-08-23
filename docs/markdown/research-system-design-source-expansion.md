# Source expansion ledger — System Design, topics, and case studies

Status: `FINAL AUDIT COMPLETE · DEPLOYMENT INPUTS OPEN`

Reviewed: `2026-08-23`

Scope: the complete local corpus — `28` topics, `18` case studies, and `20` System Design blueprints.

This dossier is the evidence layer for the durable checklist in [`research-source-expansion.todo.md`](research-source-expansion.todo.md). It is deliberately separate from `public/data/`: research can be reviewed, challenged, and corrected before it becomes teaching content.

## Audit result

The existing 46 per-unit records contain `1,359` URL references and `1,003` distinct URL values after local deduplication. Every record contains at least `21` URL references and the broadest contains `50`. The URL count is not a quality score: many records reuse shared standards and official documentation, and the ledger treats the same document as one piece of evidence even when it appears in multiple units.

The source-expansion problem is therefore not “find a few more links.” It is:

1. connect each blueprint to the right evidence without copying a tutorial into every case;
2. scope guarantees by product, version, region, and failure window;
3. separate correctness invariants from freshness, latency, cost, and availability preferences;
4. preserve counterexamples and operational limits;
5. identify which evidence belongs to a canonical topic and which belongs only to a domain case.

## Evidence vocabulary

| Class | What it is good for | Typical examples |
| --- | --- | --- |
| T1 — normative | protocol semantics, security requirements, interoperability | RFC Editor, W3C, NIST, OWASP |
| T2 — official implementation | versioned guarantees, configuration behavior, quotas, failure semantics | AWS, Google Cloud, Azure, Kubernetes, Kafka, RabbitMQ, Redis, PostgreSQL, OpenJDK, Spring |
| T3 — first-party engineering | production workload, incidents, architecture evolution, measured trade-offs | Google SRE, Meta, Discord, Shopify, Stripe, Tiki |
| T4 — original research | system design, consistency models, workload characterization, evaluation method | USENIX, OSDI, ATC, ACM, arXiv originals |
| T5 — secondary discovery | terminology and leads only | blogs, reposts, aggregators, search-result pages |

## Verified synthesis from the expansion pass

These are evidence-backed synthesis statements, not universal recipes. The final teaching text must retain the limit in the last column.

| Synthesis | Evidence | Limit that must remain visible |
| --- | --- | --- |
| A system-design review should begin with workload, invariants, recovery targets, and explicit trade-offs; the technology list is downstream of those constraints. | [AWS Well-Architected definitions](https://docs.aws.amazon.com/wellarchitected/2025-02-25/framework/definitions.html), [Azure Well-Architected](https://learn.microsoft.com/en-us/azure/well-architected/), [Google SRE service best practices](https://sre.google/sre-book/service-best-practices/) | These frameworks are review lenses, not a proof that a workload will meet an SLO. Measurements and drills remain necessary. |
| Retry is a capacity multiplier. Exponential backoff, jitter, a per-request limit, and a retry budget reduce the chance that a partial failure becomes a cascade. | [Google SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/), [Google SRE handling overload](https://sre.google/sre-book/handling-overload/), [AWS backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/), [Envoy circuit breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking) | A retry is safe only when the operation is safe to repeat or carries an idempotency key. Different layers must not multiply retries. |
| A Saga is a sequence of local transactions plus compensation/retry logic; it is not a distributed ACID transaction. | [Azure Saga pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga), [AWS Saga pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/saga-pattern.html), [AWS Saga orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) | Compensation may be impossible, partial, delayed, or semantically different from undo. A ledger, external payment authority, or irreversible step needs a separate reconciliation path. |
| Transactional Outbox closes the local state/event dual-write window, but the relay and consumers still need at-least-once handling, deduplication, and replay. | [Azure Cosmos transactional outbox sample](https://learn.microsoft.com/en-us/samples/azure-samples/cosmos-db-design-patterns/transactional-outbox/), [Azure messaging options](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/messaging), [AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Outbox atomicity is local to the storage boundary. It does not make downstream side effects atomic or erase poison messages, schema evolution, or duplicate delivery. |
| “Exactly once” is a scoped product property, not a universal distributed-systems guarantee. Kafka, Pub/Sub, SQS FIFO, and RabbitMQ expose different boundaries and failure windows. | [Kafka documentation](https://kafka.apache.org/documentation/), [Pub/Sub exactly-once](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery?hl=en), [SQS FIFO deduplication](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html), [RabbitMQ confirms](https://www.rabbitmq.com/docs/next/confirms) | Application side effects still need idempotency. Pub/Sub exactly-once is regional and subscription-specific; SQS FIFO deduplication has a finite interval; broker acknowledgements do not prove business completion. |
| Strong consistency is appropriate for some invariants, while eventual or stale reads are often acceptable for search, feeds, analytics, and projections. | [Spanner external consistency](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency?hl=en), [DynamoDB global tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables_HowItWorks.html), [Azure event-driven architecture](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven) | “Eventual is fine” is a domain decision. Booking, money, inventory, authorization, and uniqueness need an explicitly named source of truth and invariant. |
| Cache-aside, edge caching, stale serving, and invalidation are useful only when the freshness window and source of truth are explicit. | [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching), [RFC 9111 HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html), [CloudFront expiration](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html), [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) | Invalidation is distributed work. A cache hit is not evidence of current business truth; stampedes, negative caching, private-data leakage, and regional lag need separate controls. |
| A rate limiter and a circuit breaker solve different problems: quota/fairness versus fast failure/backpressure. They may be layered, but their failure mode and ownership must be named. | [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/), [Envoy global rate limiting](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting.html), [Envoy overload manager](https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager) | A distributed quota store can itself become a bottleneck. Fail-open and fail-closed are product/security decisions, not safe defaults. |
| Large-object upload design requires resumability, integrity validation, capability expiry, and cleanup of abandoned parts. | [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html), [S3 upload integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html), [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [Cloud Storage resumable uploads](https://docs.cloud.google.com/storage/docs/resumable-uploads?authuser=09) | A signed URL/session URI is a bearer capability. It must be scoped, transmitted securely, expired, and treated as potentially shareable. |
| Mobile push delivery is best effort: ordering, collapse, TTL, throttling, and token rotation affect whether a notification arrives. | [APNs notification requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns?changes=_3_4), [APNs token authentication](https://developer.apple.com/documentation/UserNotifications/establishing-a-token-based-connection-to-apns?changes=_2), [FCM collapsible messages](https://firebase.google.com/docs/cloud-messaging/customize-messages/collapsible-message-types), [FCM message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan?authuser=2) | A push notification is a hint to sync, not durable business state. Critical data needs a server-side inbox/replay endpoint. |
| Read-optimized feeds and graphs can scale by accepting a defined consistency model and moving expensive privacy/relationship reads to a specialized layer. | [TAO paper](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf), [FlightTracker paper](https://www.usenix.org/system/files/osdi20-shi.pdf), [Redis leaderboard](https://redis.io/docs/latest/develop/use-cases/leaderboard/) | TAO’s workload and guarantees are Facebook-specific. A feed, graph, and leaderboard differ in privacy, ranking, freshness, and rebuild requirements. |
| Autocomplete needs a latency budget, debounce/backpressure, a prefix/infix decision, and an index-memory budget. | [Elastic search-as-you-type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type), [Elastic suggesters](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters), [Elastic Search UI debounce](https://www.elastic.co/docs/reference/search-ui/guides-using-search-as-you-type) | A fast suggestion index is not a complete search engine. Popularity, authorization, freshness, language analysis, and abuse limits remain product concerns. |
| Kubernetes probes and autoscaling are control loops. Incorrect liveness checks can restart overloaded pods and amplify an outage. | [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/), [Kubernetes HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/), [Kubernetes disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/) | Probe and HPA values depend on startup time, dependency behavior, workload shape, and resource requests. They are not portable magic numbers. |
| Java 25’s `StructuredTaskScope` remains preview API in the current JDK documentation; virtual threads do not remove downstream capacity limits. | [JDK 25 StructuredTaskScope API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html), [JDK structured concurrency guide](https://docs.oracle.com/en/java/javase/25/core/structured-concurrency.html), [JEP 505](https://openjdk.org/jeps/505) | Mark preview/version status in teaching content. Virtual threads improve waiting-task scalability; they do not make a database, CPU, connection pool, or external API infinite. |
| Production ML quality requires training/serving parity, leakage checks, slice metrics, model-age monitoring, and real-world outcome checks. | [Google production ML monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring), [Google production ML questions](https://developers.google.com/machine-learning/crash-course/production-ml-systems/questions), [MLflow evaluation](https://mlflow.org/docs/latest/ml/evaluation) | Offline metrics are not business impact. Labels can be delayed, data can drift, and an online rollout still needs rollback and cost controls. |

## Canonical expansion source pool

The following is the first canonical expansion set selected from the current research pass. It is intentionally a list of documents, not a list of search-result URLs. A repeated document in several unit records remains one source in the global count.

### A. Design method, reliability, overload, and operations

- [AWS Well-Architected definitions](https://docs.aws.amazon.com/wellarchitected/2025-02-25/framework/definitions.html) — T2; current pillar terminology and scope.
- [AWS Well-Architected pillars](https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/the-pillars-of-the-framework.html) — T2; review dimensions and trade-offs.
- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/) — T2; workload requirements, review process, and five pillars.
- [Azure reliability design patterns](https://learn.microsoft.com/en-us/azure/well-architected/reliability/design-patterns) — T2; saga, throttling, sharding, sequential convoy, and fault isolation.
- [Azure mission-critical design principles](https://learn.microsoft.com/en-us/azure/well-architected/mission-critical/mission-critical-design-principles) — T2; blast-radius reduction, baseline testing, and recovery-oriented design.
- [Google SRE service best practices](https://sre.google/sre-book/service-best-practices/) — T3; production service review and operational expectations.
- [Google SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) — T3; overload, retries, load shedding, and failure amplification.
- [Google SRE handling overload](https://sre.google/sre-book/handling-overload/) — T3; retry budgets and the “retry only at the appropriate layer” rule.
- [Google SRE production environment](https://sre.google/sre-book/production-environment/) — T3; launch, capacity, and recovery practices.
- [Google SRE incident management](https://sre.google/sre-book/managing-incidents/) — T3; restoring service under cascading failure.
- [AWS exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — T3; contention and retry spreading.
- [AWS retry with backoff pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html) — T2; retry applicability and limits.
- [AWS making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — T3; idempotency keys and intent identity.
- [Envoy circuit breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking) — T2; connection, pending, active-request, and retry budgets.
- [Envoy overload manager](https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager) — T2; resource-pressure actions and load shedding.
- [Envoy global rate limiting](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting.html) — T2; local plus global quota layering.
- [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/) — T2; startup/readiness/liveness semantics and cascading-failure caution.
- [Kubernetes HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/) — T2; startup readiness and scaling-loop behavior.
- [Kubernetes disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/) — T2; voluntary/involuntary disruption and PDB scope.
- [OpenTelemetry specification](https://opentelemetry.io/docs/specs/otel/) — T2; context, signal, version, and stability vocabulary.
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/) — T2; consistent trace/metric/log attributes.
- [OpenTelemetry logs](https://opentelemetry.io/docs/specs/otel/logs/) — T2; correlation between logs and traces.
- [OpenTelemetry database conventions](https://opentelemetry.io/docs/specs/semconv/db/) — T2; database span/metric naming and migration status.

### B. Data ownership, consistency, Saga, Outbox, and reconciliation

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — T2; isolation levels and serializability.
- [Google Spanner external consistency](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency?hl=en) — T2; MVCC and external-consistency semantics.
- [Spanner transactions](https://docs.cloud.google.com/spanner/docs/transactions?authuser=19&hl=en) — T2; serializable/external-consistency scope.
- [Spanner transaction options](https://cloud.google.com/spanner/docs/reference/rest/v1/TransactionOptions) — T2; serializable versus repeatable-read behavior.
- [Spanner schema design](https://docs.cloud.google.com/spanner/docs/whitepapers/optimizing-schema-design?authuser=3) — T2; locality, indexes, and cross-split cost.
- [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) — T2; regional ACID transaction boundary.
- [DynamoDB global tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables_HowItWorks.html) — T2; replication, conflict resolution, and cross-region read limits.
- [DynamoDB global-table design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-global-table-design.html) — T2; MREC/MRSC and conditional-write scope.
- [AWS Saga pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/saga-pattern.html) — T2; local transaction sequence and compensation.
- [AWS Saga orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) — T2; coordinator and database-per-service motivation.
- [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) — T2; dual-write failure window.
- [Azure Saga pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) — T2; compensable, pivot, and retryable transactions.
- [Azure transactional Outbox with Cosmos DB](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos) — T2; transactional batch, change feed, and idempotent consumer.
- [Azure Cosmos Outbox sample](https://learn.microsoft.com/en-us/samples/azure-samples/cosmos-db-design-patterns/transactional-outbox/) — T2/T4; runnable crash-window demonstration.
- [Azure asynchronous messaging options](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/messaging) — T2; idempotency, ordering, DLQ, schema, and backpressure.
- [Azure event-driven architecture](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven) — T2; eventual consistency, ordering, replay, and error handlers.
- [Azure compensating transaction](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction) — T2; compensation limits and recovery.
- [Stripe idempotency](https://stripe.com/blog/idempotency) — T3; client intent identity under retries.
- [PCI DSS v4.0.1 publication](https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1) — T1; limited revision, active-version and effective-date scope.
- [PCI DSS document library](https://www.pcisecuritystandards.org/document_library/?class=pcidss&doc=pci_dss) — T1; current standard and supporting-document location; assessment scope remains organization/provider-specific.

### C. Messaging, broker safety, ordering, and fairness

- [Apache Kafka documentation](https://kafka.apache.org/documentation/) — T2; partition ordering and processing guarantees.
- [RabbitMQ quorum queues](https://www.rabbitmq.com/docs/quorum-queues) — T2; Raft replication, publisher confirms, consumer acks, poison messages, and DLX limits.
- [RabbitMQ consumers](https://www.rabbitmq.com/docs/consumers) — T2; round-robin delivery, consumer priority, activity, and prefetch interaction.
- [RabbitMQ priority support](https://www.rabbitmq.com/docs/priority) — T2; priority ordering, alternative queue design, and starvation limits.
- [RabbitMQ flow control](https://www.rabbitmq.com/docs/flow-control) — T2; publisher backpressure when queues or replicated components fall behind.
- [RabbitMQ memory and disk alarms](https://www.rabbitmq.com/docs/alarms) — T2; resource watermarks and publishing connection blocking.
- [RabbitMQ confirms and acknowledgements](https://www.rabbitmq.com/docs/next/confirms) — T2; publisher/consumer responsibility boundaries.
- [RabbitMQ streams](https://www.rabbitmq.com/docs/streams) — T2; offset/ack and superstream behavior.
- [RabbitMQ network partitions](https://www.rabbitmq.com/docs/partitions) — T2; leader reachability and partition failure behavior.
- [RabbitMQ dead-letter exchanges](https://www.rabbitmq.com/docs/next/dlx) — T2; cycle handling and at-least-once DLX caveats.
- [Amazon SQS FIFO exactly-once processing](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html) — T2; finite deduplication interval.
- [Amazon SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) — T2; at-least-once delivery and redelivery window.
- [Google Pub/Sub exactly-once delivery](https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery?hl=en) — T2; regional/subscription scope, ack behavior, and publish-side duplicates.
- [Azure publisher/subscriber pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/publisher-subscriber) — T2; idempotency, ordering, poison messages, correlation, and backpressure.

### D. HTTP, caches, quotas, and read paths

- [MDN HTTP caching guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) — T2; cacheability and revalidation concepts.
- [MDN Cache-Control reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control) — T2; directive semantics.
- [RFC 9111 HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html) — T1; normative cache behavior.
- [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — T1; status codes, redirects, Location, and method preservation.
- [RFC 9205 building protocols with HTTP](https://www.rfc-editor.org/rfc/rfc9205.pdf) — T1; redirect and HTTP protocol design considerations.
- [CloudFront expiration and stale serving](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) — T2; stale-while-revalidate and stale-if-error.
- [Cloud CDN caching](https://docs.cloud.google.com/cdn/docs/caching?authuser=2&hl=en) — T2; cache keys and negative caching.
- [Cloud CDN invalidation](https://docs.cloud.google.com/cdn/docs/cache-invalidation-overview?hl=en) — T2; invalidation scope, latency, and stampede risk.
- [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) — T2; bounded staleness and stampede protection.
- [Redis eviction policies](https://redis.io/docs/latest/develop/reference/eviction/) — T2; LRU/LFU/TTL and memory behavior.
- [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/) — T2; fixed/sliding-window implementation considerations.
- [Redis INCR](https://redis.io/docs/latest/commands/incr/) — T2; atomic counter primitive and rate-limit building block.
- [Redis leaderboard](https://redis.io/docs/latest/develop/use-cases/leaderboard/) — T2; sorted-set ranking, windows, and metadata separation.
- [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) — T2; rank complexity and update behavior.

### E. Product blueprints: feed, chat, notifications, search, upload, booking

- [RFC 6455 WebSocket](https://www.rfc-editor.org/rfc/rfc6455.html) — T1; handshake, frames, control messages, and close behavior.
- [APNs notification requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns?changes=_3_4) — T2; best effort, expiration, ordering, throttling, and connection behavior.
- [APNs token authentication](https://developer.apple.com/documentation/UserNotifications/establishing-a-token-based-connection-to-apns?changes=_2) — T2; token refresh and team/topic boundary.
- [APNs device registration](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns?changes=la) — T2; device-token lifecycle and multi-device storage.
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) — T2; delivery model and platform scope.
- [FCM collapsible messages](https://firebase.google.com/docs/cloud-messaging/customize-messages/collapsible-message-types) — T2; no ordering guarantee and collapse-key semantics.
- [FCM message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan?authuser=2) — T2; TTL, offline storage, and replacement behavior.
- [Elastic search-as-you-type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type) — T2; prefix/infix fields and index-size trade-off.
- [Elastic search suggesters](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters) — T2; completion versus phrase/term suggestion.
- [Elastic Search UI as-you-type](https://www.elastic.co/docs/reference/search-ui/guides-using-search-as-you-type) — T2; debounce and interactive query pressure.
- [TAO paper](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf) — T4; read-optimized graph workload and consistency choice.
- [FlightTracker paper](https://www.usenix.org/system/files/osdi20-shi.pdf) — T4; consistency across read-optimized online stores.
- [Meta News Feed ranking](https://engineering.fb.com/2021/01/26/core-infra/news-feed-ranking/) — T3; candidate generation, ranking passes, integrity and fallback scope in a first-party feed system.
- [LinkedIn Feed Infrastructure](https://engineering.linkedin.com/teams/data/data-infrastructure/feed-infrastructure) — T3; source-of-truth activities, timeline indexes, graph decoration, and second-pass ranking in a first-party feed platform.
- [Redis leaderboard](https://redis.io/docs/latest/develop/use-cases/leaderboard/) — T2; exact rank and score update path.
- [DynamoDB gaming profile design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-schema-gaming-profile.html) — T2; atomic counters, conditions, and transactions.
- [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) — T2; part lifecycle and completion/abort.
- [S3 upload integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html) — T2; full-object and part checksums.
- [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) — T2; time-limited bearer capabilities.
- [S3 abort-incomplete multipart lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-configuration-examples.html) — T2; cost cleanup.
- [Google Cloud Storage resumable uploads](https://docs.cloud.google.com/storage/docs/resumable-uploads?authuser=09) — T2; resume and session-URI behavior.
- [Google Cloud Storage signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls?authuser=09) — T2; capability scope and expiration.
- [Google Cloud Storage checksums](https://docs.cloud.google.com/storage/docs/data-validation?hl=en) — T2; CRC32C/MD5 integrity behavior.
- [Shopify inventory reservations](https://shopify.engineering/scaling-inventory-reservations) — T3; reservation state and database contention.
- [Amadeus booking FAQ](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/) — T2; provider-specific search/price/order/management flow and consolidator/ticketing boundary.
- [Amadeus Postman booking workflow](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/developer-tools/postman/) — T2; provider-specific Search → Price → Create Orders sequence, last updated 2025-10-23.

### F. API gateway, identity, and security edge

- [RFC 6749 OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749.html) — T1; protocol roles and grant semantics.
- [RFC 7636 PKCE](https://www.rfc-editor.org/rfc/rfc7636.html) — T1; authorization-code interception defense.
- [RFC 9700 OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html) — T1; current security baseline.
- [OAuth 2.1 Authorization Framework draft -15](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/) — T1; active Internet-Draft status and intended RFC status `(None)`, not a final standard.
- [RFC 9068 JWT access-token profile](https://www.rfc-editor.org/rfc/rfc9068.html) — T1; JWT access-token interoperability.
- [RFC 9449 DPoP](https://www.rfc-editor.org/rfc/rfc9449.html) — T1; sender-constrained token proof.
- [RFC 7519 JWT](https://www.rfc-editor.org/rfc/rfc7519.html) — T1; token claims and validation vocabulary.
- [RFC 8725 JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html) — T1; algorithm/key/claim validation risks.
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) — T1; API abuse and authorization risks.
- [OWASP Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — T1; object-level authorization boundary.
- [OWASP SSRF prevention](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery_Prevention_Cheat_Sheet) — T1; gateway/fetcher trust boundary.
- [Kubernetes Gateway API HTTPRoute](https://gateway-api.sigs.k8s.io/reference/api-types/httproute/) — T2; route attachment and timeout contract.
- [Envoy life of a request](https://www.envoyproxy.io/docs/envoy/latest/intro/life_of_a_request.html) — T2; routing, pools, filters, early termination, and load balancing.

### G. JVM, frameworks, build systems, ML, and experimentation

- [JDK 25 StructuredTaskScope API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) — T2; preview status and cancellation semantics.
- [JDK 25 structured concurrency guide](https://docs.oracle.com/en/java/javase/25/core/structured-concurrency.html) — T2; task lifetime and observability.
- [JEP 505 Structured Concurrency](https://openjdk.org/jeps/505) — T2; design rationale and preview evolution.
- [JDK 25 ScopedValue API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ScopedValue.html) — T2; immutable context propagation and version scope.
- [Spring Boot graceful shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html) — T2; stop phase and request-drain behavior.
- [Spring Boot Actuator endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html) — T2; operational endpoints and security boundary.
- [Spring Boot metrics](https://docs.spring.io/spring-boot/reference/actuator/metrics.html) — T2; JVM/system/virtual-thread telemetry.
- [Gradle user manual](https://docs.gradle.org/current/userguide/userguide.pdf) — T2; incremental and cache-aware build concepts.
- [Google production ML monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring) — T2; leakage, slices, skew, model age, and live quality.
- [Google production ML questions](https://developers.google.com/machine-learning/crash-course/production-ml-systems/questions) — T2; data reliability, feature value, and feedback loops.
- [Google precision/recall guidance](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall) — T2; task-dependent metric choice.
- [MLflow evaluation](https://mlflow.org/docs/latest/ml/evaluation) — T2; thresholded validation and metric provenance.
- [MLflow deployment](https://mlflow.org/docs/latest/ml/deployment) — T2; packaging, dependency, and serving boundaries.
- [Forecast evaluation pitfalls](https://arxiv.org/abs/2203.10716) — T4; time-series evaluation and leakage risks.

## Per-unit evidence routing

This table is the bridge from the shared source pool to every local record. It names the next evidence family and the claim/limit that must be checked there. The detailed source rows remain in each per-unit dossier; this table prevents the same generic explanation from being copied into every case study.

| Unit | Primary expansion sources | Claim/limit to verify |
| --- | --- | --- |
| Topic 01 — Java Core/JVM | [JDK 25 `StructuredTaskScope`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html), [JDK 25 structured concurrency](https://docs.oracle.com/en/java/javase/25/core/structured-concurrency.html) | Separate Java specification facts, HotSpot implementation facts, and local benchmark results. |
| Topic 02 — Java 8→25/Go | [JEP 505](https://openjdk.org/jeps/505), [JDK 25 JEP inventory](https://openjdk.org/projects/jdk/25/jeps-since-jdk-21) | Pin release/version and keep preview APIs out of “stable Java” claims. |
| Topic 03 — Spring/build | [Spring graceful shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html), [Spring Actuator](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html), [Gradle manual](https://docs.gradle.org/current/userguide/userguide.pdf) | Defaults and release trains are version-sensitive; build speed is workload-specific. |
| Topic 04 — REST/gRPC/WebFlux | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), [Google SRE overload](https://sre.google/sre-book/handling-overload/) | Deadline, cancellation, backpressure, and retry behavior must be stated per protocol/client. |
| Topic 05 — DB indexes/locks | [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [Spanner transactions](https://docs.cloud.google.com/spanner/docs/transactions?authuser=19&hl=en) | Isolation names do not by themselves prove application-level invariant safety. |
| Topic 06 — replication/sharding | [DynamoDB global tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables_HowItWorks.html), [Spanner schema design](https://docs.cloud.google.com/spanner/docs/whitepapers/optimizing-schema-design?authuser=3) | State lag, conflict resolution, locality, failover, and reshard/restore assumptions. |
| Topic 07 — SQL/NoSQL engines | [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html), [Spanner external consistency](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency?hl=en) | Compare guarantees and workload fit, not vendor labels or raw throughput. |
| Topic 08 — RabbitMQ/Kafka | [Kafka docs](https://kafka.apache.org/documentation/), [Rabbit quorum queues](https://www.rabbitmq.com/docs/quorum-queues), [Rabbit confirms](https://www.rabbitmq.com/docs/next/confirms) | Ordering/delivery/processing guarantees, tenant fairness, poison messages, and backlog limits. |
| Topic 09 — distributed transactions | [Azure Saga](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga), [Azure Outbox](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos), [Stripe idempotency](https://stripe.com/blog/idempotency) | Compensation is not rollback; ledger and external-authority reconciliation remain explicit. |
| Topic 10 — load/rate limit | [SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/), [Envoy overload](https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager), [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/) | Retry budgets, load shedding, quota scope, and fail-open/closed choices need numbers and owners. |
| Topic 11 — system-design cases | [Azure cloud patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/), [Azure WAF workloads](https://learn.microsoft.com/en-us/azure/well-architected/workloads) | Use the prompt as a domain application of canonical mechanisms, not another generic pattern catalog. |
| Topic 12 — architecture/DDD | [Azure microservice patterns](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/patterns?source=recommendations), [Azure tactical DDD](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-ddd) | Bounded context, aggregate, CQRS, and event sourcing must be scoped to ownership and invariant needs. |
| Topic 13 — OAuth/OIDC/JWT | [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), [OWASP API Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | Token verification is not object authorization; rotation, audience, issuer, algorithm, and revocation are separate. |
| Topic 14 — K8s/DevOps | [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/), [Kubernetes HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/), [Kubernetes disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/) | Probe/HPA/PDB control loops can amplify load; pin version and test startup/drain behavior. |
| Topic 15 — networking/I/O | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html), [Envoy request lifecycle](https://www.envoyproxy.io/docs/envoy/latest/intro/life_of_a_request.html) | Protocol semantics, pool limits, cancellation, and tail latency are not interchangeable with thread count. |
| Topic 16 — OTA/booking | [Shopify inventory reservations](https://shopify.engineering/scaling-inventory-reservations), [Dynamo gaming/conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-schema-gaming-profile.html), [Azure Saga](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) | Search freshness may be eventual; booking authority, hold expiry, and external provider reconciliation are correctness-critical. |
| Topic 17 — REST API lifecycle | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), [AWS idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), [MDN caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) | Status/redirect/idempotency/pagination semantics must survive client retry and response loss. |
| Topic 18 — query optimization | [Elastic search-as-you-type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type), [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [Cloud CDN caching](https://docs.cloud.google.com/cdn/docs/caching?authuser=2&hl=en) | Query-plan advice must be measured on a versioned engine/schema/data distribution. |
| Topic 19 — DSA | [Google metric guidance](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall), [JDK 25 API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html) | Complexity proof and language/runtime behavior should not be mixed with system-scale claims. |
| Topic 20 — observability/SRE | [SRE SLOs](https://sre.google/sre-book/service-level-objectives/), [OpenTelemetry spec](https://opentelemetry.io/docs/specs/otel/), [OpenTelemetry logs](https://opentelemetry.io/docs/specs/otel/logs/) | Signals must map to user journeys, error budgets, and recovery actions; telemetry is not reliability by itself. |
| Topic 21 — Linux/debug | [OpenTelemetry context](https://opentelemetry.io/docs/specs/otel/context/), [SRE incident management](https://sre.google/sre-book/managing-incidents/) | Diagnosis must be safe, evidence-led, and separated from a production-changing remediation. |
| Topic 22 — low-level design/OOD | [Azure cloud patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/), [JDK structured concurrency](https://docs.oracle.com/en/java/javase/25/core/structured-concurrency.html) | Apply patterns to state/ownership/testability; avoid pattern names without a failure or change pressure. |
| Topic 23 — Java concurrency | [JDK 25 `StructuredTaskScope`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html), [JDK 25 `ScopedValue`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ScopedValue.html) | Preview status, cancellation, interruption, and downstream capacity must remain explicit. |
| Topic 24 — DDD | [Azure domain analysis](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis), [Azure tactical DDD](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-ddd) | A bounded context is a model/ownership boundary, not automatically a deployable microservice. |
| Topic 25 — microservices at scale | [Azure microservice patterns](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/patterns?source=recommendations), [SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/), [Azure messaging](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/messaging) | Distribution adds partial failure, retries, consistency and operations; do not turn patterns into defaults. |
| Topic 26 — testing strategy | [Kubernetes disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/), [SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) | Unit tests cannot prove system-level failure behavior; include contract, load, restore, and fault-injection evidence. |
| Topic 27 — gateway/identity edge | [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), [Gateway API HTTPRoute](https://gateway-api.sigs.k8s.io/reference/api-types/httproute/), [Envoy circuit breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking) | Edge authentication, service authorization, quotas, and business idempotency are separate layers. |
| Topic 28 — lock/lease | [Redis distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/), [Dynamo conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html), [Dynamo gaming condition example](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-schema-gaming-profile.html) | A lease expiry does not revoke stale work; fencing/conditional authority is the actual correctness control. |
| Case 01 — Arcturus inventory | [Azure event-driven](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven), [Rabbit quorum queues](https://www.rabbitmq.com/docs/quorum-queues) | Ordered processing and eventual consistency need workload and recovery evidence. |
| Case 02 — Tiki Search A/B | [Google metric guidance](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall), [Google production ML questions](https://developers.google.com/machine-learning/crash-course/production-ml-systems/questions) | Experiment metrics, randomization, power, and guardrails are distinct from a model metric. |
| Case 03 — TIKI scale timeline | [AWS WAF definitions](https://docs.aws.amazon.com/wellarchitected/2025-02-25/framework/definitions.html), [SRE production environment](https://sre.google/sre-book/production-environment/) | Preserve first-party historical evidence and label later engineering inference. |
| Case 04 — Android build | [Gradle manual](https://docs.gradle.org/current/userguide/userguide.pdf), [Spring/Java version evidence](https://openjdk.org/projects/jdk/25/jeps-since-jdk-21) | “O(1)” is a scoped build-time result, not a claim about all projects or all build inputs. |
| Case 05 — scale and next | [Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/), [SRE service best practices](https://sre.google/sre-book/service-best-practices/) | Separate people/process evidence from technology prescriptions. |
| Case 06 — React Native choice | [Azure WAF trade-offs](https://learn.microsoft.com/en-us/azure/well-architected/reliability/tradeoffs) | Keep historical team/product constraints; do not turn one migration choice into a current framework ranking. |
| Case 07 — demand forecast | [Google ML monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring), [forecast evaluation pitfalls](https://arxiv.org/abs/2203.10716) | Check leakage, time splits, drift, slices, and the operational decision the forecast drives. |
| Case 08 — logo detection ML | [Google ML monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring), [MLflow evaluation](https://mlflow.org/docs/latest/ml/evaluation) | Dataset/model/metric claims need reproducibility and real-world slice limits. |
| Case 09 — Pegasus catalog | [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/), [CloudFront stale serving](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) | Projection/cache freshness and source-of-truth boundaries must be visible. |
| Case 10 — microservice auth | [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), [OWASP BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) | Token authentication does not establish object or tenant authorization. |
| Case 11 — hot deals | [Shopify reservations](https://shopify.engineering/scaling-inventory-reservations), [Dynamo gaming profile](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-schema-gaming-profile.html), [SRE overload](https://sre.google/sre-book/handling-overload/) | Protect inventory truth, cap admission, and distinguish queue acceptance from booking success. |
| Case 12 — duplicate booking | [AWS idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Check-then-act, response loss, and retry intent must be tested at the mutation boundary. |
| Case 13 — Discord messages | [Discord trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages), [TAO paper](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf) | First-party architecture numbers describe a particular workload and migration, not a generic database prescription. |
| Case 14 — cloud cost shock | [AWS WAF cost pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html), [Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/) | Cost is a workload/time/region/contract fact; preserve the fixed-floor and utilization assumptions. |
| Case 15 — transactional Outbox | [Azure Outbox sample](https://learn.microsoft.com/en-us/samples/azure-samples/cosmos-db-design-patterns/transactional-outbox/), [Azure messaging](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/messaging), [AWS Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Demonstrate the dual-write crash window, at-least-once relay, consumer dedupe, replay, and poison handling. |
| Case 16 — Shopify reservations | [Shopify reservations](https://shopify.engineering/scaling-inventory-reservations), [Dynamo condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html) | Reservation semantics, database locking, connection pressure, and expiration/reconciliation are separate decisions. |
| Case 17 — SSH hardening | [OWASP Top Ten](https://owasp.org/www-project-top-ten/), [SRE incident management](https://sre.google/sre-book/managing-incidents/) | Keep incident evidence and threat-model scope; do not generalize four incidents into a probability claim. |
| Case 18 — verification/AGI economics | [Google production ML monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring), [MLflow evaluation](https://mlflow.org/docs/latest/ml/evaluation) | Preserve paper provenance and mark engineering extrapolation separately from measured results. |

## Claim-to-unit routing

The same mechanism is routed to one canonical topic and then specialized in cases/blueprints:

| Mechanism | Canonical deep explanation | Specialized applications | Do not repeat as a second generic tutorial |
| --- | --- | --- | --- |
| Saga/compensation | Topic 09 | payment ledger, OTA, order workflow, multi-service case studies | do not restate Saga definitions in every case |
| Transactional Outbox | Topic 09 + Case 15 | order workflow, inventory, notifications | cases should show crash window and domain consequence |
| Idempotency | Topic 17/09 | duplicate booking, payment, message consumers, notification sends | distinguish HTTP intent idempotency from event-consumer dedupe |
| Cache/invalidation | Topic 10/06 | catalog, feed, search, rate limit, gateway | each case only adds freshness/privacy/hot-key specifics |
| Capacity/overload/retry | Topic 10/20 | flash sale, broker fairness, API gateway, high-load blueprints | avoid copying retry advice without a workload/failure model |
| Distributed lock/lease/fencing | Topic 28 | inventory, booking, leader election, worker ownership | do not call a TTL lock “correct” without fencing/authority |
| Booking truth | Topic 16 | OTA search, duplicate booking, flash sale | search projections may lag; booking authority may not |
| API identity edge | Topic 27 | authn/authz case, gateway blueprint, service-to-service calls | keep authentication, authorization, quota, and identity propagation distinct |

## Contradictions and limits to preserve

| Tempting statement | Safer wording | Owner |
| --- | --- | --- |
| “The queue guarantees exactly once.” | “The broker provides a scoped delivery/processing guarantee; the application still makes side effects idempotent.” | Topic 08 |
| “Saga rolls back the transaction.” | “Saga runs compensating actions where the domain permits; it may end in a pending/reconciliation state.” | Topic 09 |
| “Redis lock prevents double booking.” | “A lease can coordinate attempts; the authoritative conditional write/fencing rule prevents stale owners from committing.” | Topic 28 + Topic 16 |
| “The search result is the inventory.” | “Search is a read model; the booking/inventory authority validates availability again.” | Topic 16 |
| “Add retries for reliability.” | “Retry only bounded, transient, repeatable operations with a budget and backoff; otherwise shed or surface failure.” | Topic 10/20 |
| “More replicas means more availability.” | “Replicas help only when routing, quorum, failover, recovery, and consistency behavior are tested.” | Topic 06/20 |
| “Virtual threads solve concurrency.” | “Virtual threads make blocking waits cheaper; downstream pools and external services remain finite.” | Topic 01/02/23 |
| “Push notification delivered.” | “Provider accepted the request; delivery may be delayed, collapsed, reordered, or expire.” | Blueprint 6 |
| “Signed URL is safe.” | “Signed URL is a bearer capability with bounded permissions and lifetime.” | Blueprint 13/Topic 27 |
| “A high offline AUC proves the model.” | “Offline metrics must be leakage-free, sliced, monitored, and connected to a real-world outcome.” | Cases 02/07/08/18 |

## Targeted integration checkpoint (2026-08-23)

The first evidence-frozen slice of the expansion pass is now integrated into the public bilingual data. It deliberately edits existing canonical answers instead of creating another Saga/Outbox/retry/upload tutorial.

| Local unit | Integrated IDs | Evidence and limit preserved |
| --- | --- | --- |
| Topic 10 — overload/rate policy | `10-system-design-rate-limit.surviving-high-load.q2`, `...rate-limiting-in-depth.q5` | Resource-derived queue/concurrency/retry bounds; caller-facing `429` is not a universal internal header contract; `503`/`504` and unsafe retry stay distinct. |
| Topic 08 — RabbitMQ delivery | `08-message-queue.reliability-delivery-semantics.q2` | Quorum queue versus stream is a workload choice; confirms/ACKs still stop short of external-effect correctness. |
| Case 02 — notification | `11-system-design-cases.the-big-prompts.q2` | APNs/FCM provider acceptance, token/TTL/collapse scope, and durable client sync are separate from user read/delivery. |
| Case 10 — object upload | `11-system-design-cases.the-big-prompts.q10` | Presigned/session URL is a bearer capability; completion, checksum and publication are separate control-plane transitions. |
| Topic 09 — payment/ledger authority | `09-distributed-tx-fintech.correctness-where-money-is-involved.q1/q2` | Provider contract is version/account scoped; unknown payments carry age/owner/inquiry/deadline fields; local idempotency, provider idempotency and reconciliation remain separate. |
| Blueprint 5 — wallet/payment contract | `11-system-design-cases.the-big-prompts.q1/q11` | Wallet and async-payment cases link to the canonical provider checklist; `202`/Outbox proves durable intent, not settled money. |
| Blueprint 14 — late booking webhook | `11-system-design-cases.the-big-prompts.q14` | Local hold expiry is not proof of supplier/GDS release; late success must query the selected authority using supplier reference/version/correlation data. |

The paired `content-reviews.json` entries were refreshed on 2026-08-23 with the claim type, target documentation and canonical URLs. The final audit below closes the remaining research rows; only deployment-specific inputs stay open.

## Final expansion audit (2026-08-23)

This closeout answers every gap that was previously open. It adds evidence and ownership decisions to the research layer; it does not invent a provider, region, traffic envelope, SLO, or compliance scope that the repository does not know.

`source_items` in `public/data/system-design/catalog.json` is a migration/ownership field, not a bibliography. Therefore authored blueprints keep their existing prompt-origin metadata and are mapped to evidence here instead of being forced to claim study-track questions or duplicated explanations.

### Blueprint evidence routing

| Blueprint(s) | Canonical owner | Evidence links | Decision boundary |
| --- | --- | --- | --- |
| 1, 3, 16, 17 | Topic 10 + Topic 20 | [Google SRE overload](https://sre.google/sre-book/handling-overload/), [SRE SLOs](https://sre.google/sre-book/service-level-objectives/), [Envoy overload manager](https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager) | Capacity and overload controls are workload-derived; tier numbers in the blueprint are teaching assumptions, not production limits. |
| 2, 10 | Topic 10 + Topic 06 | [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/), [Cloud CDN caching](https://docs.cloud.google.com/cdn/docs/caching) | Cache placement is a freshness/source-of-truth decision; hit ratio alone is not a correctness or availability guarantee. |
| 4 | Topic 10 | [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/), [Google SRE overload](https://sre.google/sre-book/handling-overload/) | Quota scope, fairness, fail-open/closed, and retry budget must be selected per route and failure mode. |
| 5 | Topic 09 + Topic 05 | [PCI DSS v4.0.1 publication](https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1), [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Money authority, provider idempotency, ledger posting, and PCI scope are separate contracts. |
| 6, 7, 11 | Topic 11 + Topic 17 | [Firebase message handling](https://firebase.google.com/docs/cloud-messaging/receive-messages), [Apple remote notifications](https://developer.apple.com/documentation/usernotifications) | Provider acceptance, token lifecycle, expiry/collapse, durable client sync, and user-visible delivery are different states. |
| 8 | Topic 11 + feed topology | [TAO paper](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf), [Meta News Feed ranking](https://engineering.fb.com/2021/01/26/core-infra/news-feed-ranking/), [LinkedIn Feed Infrastructure](https://engineering.linkedin.com/teams/data/data-infrastructure/feed-infrastructure) | Hybrid fan-out is a workload choice. Privacy is checked on read; celebrity thresholds, ranking, and freshness are tunable operational policies. |
| 9 | Topic 11 + Topic 18 | [Redis leaderboard](https://redis.io/docs/latest/develop/use-cases/leaderboard/), [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) | The sorted index is derived serving state; the durable score log, checksum, replay, and season snapshot own recovery/audit. |
| 12 | Topic 18 | [Elastic search-as-you-type](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type), [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) | Prefix/infix and ranking guidance must be measured on a pinned engine, schema, data distribution, and freshness contract. |
| 13 | Topic 17 + object storage | [Google Cloud Storage signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls), [Cloud Storage request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions) | A signed URL is a bounded bearer capability; checksum, completion, publication, and cleanup remain separate transitions. |
| 14, 15, 18 | Topic 16 + Topic 28 | [Amadeus booking FAQ](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/), [Amadeus booking workflow](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/developer-tools/postman/), [Shopify inventory reservations](https://shopify.engineering/scaling-inventory-reservations) | Search is a read model. The selected supplier/GDS/airline or inventory authority confirms price, availability, hold, booking, and late outcomes. |
| 19 | Topic 27 | [RFC 9700](https://datatracker.ietf.org/doc/rfc9700/), [OAuth 2.1 Internet-Draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/), [Gateway API HTTPRoute](https://gateway-api.sigs.k8s.io/reference/api-types/httproute/) | OAuth security guidance, gateway routing, workload identity, and resource authorization are separate layers. |
| 20 | Topic 08 + Topic 10 + Topic 25 | [RabbitMQ consumers](https://www.rabbitmq.com/docs/consumers), [RabbitMQ priority](https://www.rabbitmq.com/docs/priority), [RabbitMQ flow control](https://www.rabbitmq.com/docs/flow-control), [RabbitMQ alarms](https://www.rabbitmq.com/docs/alarms), [RabbitMQ quorum queues](https://www.rabbitmq.com/docs/quorum-queues) | RabbitMQ provides delivery/backpressure primitives; tenant fairness belongs to the durable admission/DRR scheduler, not to prefetch or message priority alone. |

### Gap decisions and limits

| Previously open gap | Evidence-backed decision | Remaining input that must not be guessed |
| --- | --- | --- |
| Blueprint-level links | The routing table maps all 20 blueprints to a canonical owner and evidence family without duplicating the explanation or altering migrated `source_items`. | Whether a deployment will adopt a particular provider, version, or managed service. |
| PCI DSS and payment-provider guidance | PCI SSC describes v4.0.1 as a limited revision with corrections/clarifications and no added or deleted requirements; v4.0 retired after 2024-12-31. Payment content treats PCI as a card-data/compliance boundary, not a PSP workflow guarantee. | CDE scope, SAQ/ROC path, acquirer/brand obligations, tokenization/P2PE choice, PSP API version, account, region, and retention. |
| OAuth 2.1 status | RFC 9700 is the current OAuth 2.0 Security BCP. The IETF OAuth 2.1 document remains an active Internet-Draft with intended RFC status `(None)` at the reviewed revision; it is not taught as a final RFC. | IdP, browser architecture, deployed profile, issuer/audience, key rotation, revocation window, and provider compatibility. |
| RabbitMQ fairness and large backlog | Official RabbitMQ docs support consumer/publisher flow control, resource alarms, quorum replication, and priority caveats. Priority can starve lower classes; fairness is therefore owned by the blueprint's admission and cost-aware scheduler, with bounded backlog and oldest-age recovery signals. | RabbitMQ major/minor version, queue type/topology, disk/RAM limits, payload/consumer profile, tenant weights, and tested recovery objective. |
| Booking/external authority | Amadeus documents a provider-specific Search → Price (latest price/availability) → Create Orders → Order Management flow and notes consolidator/ticketing boundaries. This is evidence for an authority/reconciliation pattern, not a universal GDS/airline contract. | Selected supplier/GDS/airline, hold/ticketing/cancellation rules, idempotency/status APIs, overbooking policy, and commercial/legal contract. |
| Feed fan-out | TAO, Meta, and LinkedIn sources support read-optimized graph/feed layers and ranking/fan-out concerns. The blueprint keeps hybrid push/pull, bounded merge sources, read-time visibility, freshness/lag metrics, and a deterministic fallback. | Follower distribution, privacy/delete SLA, ranking freshness, hot-account threshold, retained timeline depth, and regional replication. |
| Leaderboard rebuild | Redis documents sorted-set rank/update primitives; the blueprint explicitly keeps a durable score log, immutable season snapshot/checksum, fresh-index replay, and head/tail verification. Redis complexity is not treated as durability or audit proof. | Score authority/anti-cheat policy, member count, board sharding, rebuild RTO, retention, and exact-vs-approximate rank product contract. |
| Version/revision audit | All 46 per-unit records have a `Reviewed: 2026-08-23` marker, selected source rows carry review dates, and provider/version limits are recorded where currentness matters. | The actual deployment matrix and upgrade/revalidation owner; a review date does not freeze a vendor's future behavior. |
| Duplicate/semantic-overlap rerun | The final normalized EN scan found zero duplicate section titles and zero duplicate topic questions. Canonical ownership and cross-reference matrices were rerun; repeated Saga/Outbox/idempotency/booking/lease vocabulary remains domain-qualified rather than copied as another tutorial. | New content must rerun the same scan before integration. |

No additional public-data edit was required for this closeout: the feed, leaderboard, booking, OAuth, and RabbitMQ blueprints already contain the decisions above, and the existing EN/VI data/parity gate passes. The new evidence is recorded here and in the affected source ledgers so a future deployment can replace open inputs with named contracts.

## Open research gaps before integration

- [x] Add blueprint-level evidence links to the catalog/deep-dive mapping without copying full explanations into every blueprint.
- [x] Verify current PCI DSS 4.0.1 and payment-provider guidance for the payment-ledger blueprint; keep regulatory claims versioned.
- [x] Verify current OAuth 2.1 status versus RFC 9700; do not describe a draft or meeting slide as a final standard.
- [x] Add the base RabbitMQ quorum-queue versus streams comparison and extend it with tenant-fairness and very-large-backlog evidence in the multi-tenant blueprint.
- [x] Add booking-provider/external-authority evidence where available; do not infer airline/GDS behavior from a generic Saga article.
- [x] Add a focused feed fan-out comparison (fan-out-on-write, fan-out-on-read, hybrid) with privacy and celebrity/hot-key limits.
- [x] Add a focused leaderboard rebuild/reconciliation path; Redis sorted-set complexity is not a durability or audit guarantee.
- [x] Add version/revision dates to all time-sensitive Java, Spring, Kubernetes, Kafka, RabbitMQ, Redis, FCM, and Elastic claims in the per-unit records.
- [x] Re-run the duplicate/semantic-overlap scan after any new question or section is introduced.

## Integration gate

No new source-backed claim is ready for `public/data/` until the affected record contains:

- a local content location;
- the claim classification (`source fact`, `inference`, or `teaching recommendation`);
- one or more canonical sources and a scope/limit;
- a counterexample or negative evidence row where the claim is easy to overgeneralize;
- the workload, invariant, failure, recovery, and operational consequence;
- the canonical-owner decision and cross-reference target;
- EN/VI parity notes;
- a validation result after integration.

Targeted slice status:

- [x] Six targeted bilingual slices updated with immutable IDs preserved.
- [x] Ten per-item provenance records are current and source URLs are HTTPS.
- [x] Targeted JSON/parity/content-review checks passed before the full repository gate.
- [x] Complete the remaining J–N/O blueprint/unit rows with an evidence decision and mark this expansion dossier `FINAL AUDIT COMPLETE`.

Deployment-specific provider/version, traffic, SLO, compliance, retention, rollout, and owner inputs remain open by design. They are implementation gates, not missing research claims.
