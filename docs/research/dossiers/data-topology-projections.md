# Research - Data topology, projections, replication, and sharding

Status: `INTEGRATED`
Reviewed: 2026-08-23
Batch: D

This dossier is the cross-unit gate for data topology and derived-read design. It is deliberately narrower than a generic database tutorial: the decision is not whether replication, sharding, caching, search, or CDC are fashionable, but which data is authoritative, which data is disposable, what visibility contract a reader receives, and how a topology change is proved safe.

## Local scope

The primary integration scope is:

| Unit | Local responsibility in this batch | Existing canonical boundary |
| --- | --- | --- |
| Topic 05 - `05-db-core-index-lock` | Constraints, local transaction authority, MVCC/locking, and source-of-truth modeling | Topic 06 owns distributed topology; Topic 18 owns plan-level optimization. |
| Topic 06 - `06-db-scaling` | Replication lag, read consistency contracts, partition/shard keys, resharding, and CDC topology | Topic 28 owns lease/fencing; Topic 09 owns cross-service workflow/outbox guarantees. |
| Topic 07 - `07-sql-nosql-db-engines` | Engine fit and the boundary between transactional storage and search/cache/OLAP projections | Topic 08 owns broker delivery; Topic 25 owns the general microservice cache/failure vocabulary. |
| Topic 18 - `18-query-optimization` | Measured query plans and the choice between cache, materialized view, CDC projection, and OLAP | Topic 05 owns physical index/lock mechanics; Topic 20 owns operational SLOs. |
| Case 03 - `03-tiki-scale-in-10-years` | Source-scoped historical evidence about Tiki's integration and migration evolution | The case retains its historical narrative; it does not become a generic sharding tutorial. |

Already integrated units are used as links and evidence boundaries rather than rewritten here: Topic 25 for cache topology and retry/failure overlap, Topic 09 for outbox and delivery semantics, Topic 08 for broker semantics, Topic 17 for API freshness/async contracts, and Cases 09/13 for catalog projection and hot-partition/coalescing evidence.

The integrated public-data additions are five bilingual topic items and three short EN/VI case-study qualifiers. No existing persistent item ID, case anchor, figure, or source-specific measurement is deleted.

## Decision thesis

1. **Authority is explicit.** A transactional write model owns business mutations and invariants. A cache, search index, materialized view, feed, or OLAP table is a derived projection unless the design explicitly proves otherwise.
2. **Replication copies data; it does not choose a client consistency contract.** After a write, the application must decide whether the next read requires primary authority, a replica at or beyond a commit position, monotonic session visibility, or a documented stale result.
3. **A partition key is a workload and invariant decision.** It must be evaluated against access locality, write skew, tenant isolation, growth, hot keys, cross-partition constraints, privacy, and migration cost. A hash function alone does not remove a hot tenant or hot item.
4. **CDC is a change transport and rebuild input, not magic exactly-once.** A useful contract defines the snapshot boundary, event identity, ordering scope, schema evolution, deletes/tombstones, lag, replay, repair, and the projection's acknowledgement point.
5. **Projection freshness is a product contract.** Search and analytics may be eventually consistent; balance, entitlement, inventory, and payment authorization generally require an authoritative transactional path. The design must state the acceptable stale window and what happens when the projection is behind or unavailable.
6. **Query optimization starts with measurement.** An index, cache, materialized view, or OLAP copy is a hypothesis about a workload. The proof is a representative plan/latency/resource measurement plus a write, freshness, recovery, and operational budget.

## Evidence policy

The broad candidate search was capped at 200 candidates for this batch. The selected ledger below keeps distinct standards, official manuals, original/first-party architecture material, and operational documentation. Search-result summaries, duplicated vendor mirrors, and benchmark numbers without workload definitions are not treated as proof. Provider behavior is version-scoped; a managed service may change defaults or add routing/failover behavior.

### Verified facts, inference, and recommendations

| Claim | Classification | Qualification |
| --- | --- | --- |
| PostgreSQL streaming replication is asynchronous by default, so a primary acknowledgement can precede remote replay. | Verified provider fact | The loss window depends on synchronous settings, WAL durability, failover policy, and the observed replay position. It is not a universal PostgreSQL guarantee. |
| PostgreSQL logical replication starts with an initial snapshot and then applies ongoing changes; conflicts can stop a subscription. | Verified provider fact | The application still needs a source snapshot boundary, schema compatibility, conflict policy, replay/repair procedure, and lag monitoring. |
| A replica can serve stale data even when it is healthy. | Derived from replication semantics | “Healthy” must be separated into process health, connectivity, replay lag, and visibility of the caller's required commit position. |
| Cassandra and Dynamo-style systems make partition-key and query-shape design central to scalability. | Verified product/documentation fact | The correct key depends on bounded partitions, cardinality, write distribution, query patterns, repair, and consistency level. |
| Search indexes and materialized views are rebuildable projections. | Design recommendation | This is safe only when the authority, event history/snapshot, deletes, schema version, and repair path are actually retained. |
| CDC provides exactly-once end-to-end processing. | Unsupported universal claim | A log or connector can provide useful ordering and delivery guarantees, but the sink's side effect, checkpoint, retry, and deduplication boundary still determine end-to-end behavior. |
| Dual-write is a safe migration strategy. | Recommendation requiring proof | It needs idempotency, parity checks, a backfill/checkpoint plan, conflict handling, staged cutover, rollback, and a repair path. |
| A cached or denormalized projection may be used for authorization, charging, or decrementing stock. | Unsafe default | Only use it if the projection is the deliberate authority and its consistency/transaction guarantees are designed as such. Otherwise re-check the authority. |

## Canonical ownership and duplicate decisions

| Repeated mechanism | Canonical owner | What other units should retain |
| --- | --- | --- |
| Local constraints, MVCC, row/range locks, deadlocks | Topic 05 | The invariant and provider scope; do not repeat distributed lock/fencing material. |
| Replication, read visibility, shard/partition key, resharding, CDC topology | Topic 06 | Domain-specific trade-offs and source-scoped case evidence. |
| SQL/NoSQL engine fit and projection boundary | Topic 07 | Engine-specific guarantees, not a generic “SQL versus NoSQL” scorecard. |
| EXPLAIN, plan regression, query rewrite, materialized read shape | Topic 18 | Measured examples and provider caveats; do not turn every index suggestion into a topology lesson. |
| Cache stampede, stale values, retry/failure containment | Topic 25 | Links from catalog/feed examples; Topic 25 remains the reusable mechanism home. |
| Transactional outbox, event relay, consumer idempotency | Topic 09 and Topic 08 | CDC may be a database-change pipeline; it does not replace the service outbox when the business event must be transactionally coupled to a service write. |
| Hot partitions and bounded request coalescing | Cases 09 and 13 | Reported workload evidence and local implementation choices; avoid copying their numbers as generic limits. |
| Migration safety | Topic 06 plus Topic 18 for data-shape verification | Each case keeps its historical incident/sequence and states what the source does not prove. |

## State machines and proof obligations

### Projection lifecycle

```text
SNAPSHOT -> CATCHING_UP -> LIVE -> STALE -> REBUILDING -> LIVE
                         |       |       |
                         v       v       v
                       PAUSED  FAILED  REPAIR_REQUIRED
```

- `SNAPSHOT` records the source position/watermark at which the snapshot is valid.
- `CATCHING_UP` applies changes after that position; the projection is not live until the gap is closed.
- `LIVE` exposes a freshness metric and the last applied position, not merely a process-up flag.
- `STALE` is a product-visible state when the freshness budget is exceeded; callers either use the authority, show a stale result, or fail according to the domain contract.
- `REBUILDING` writes a versioned target or isolated index/table, verifies counts/checksums/semantic samples, and swaps only after the target is complete.
- `FAILED` and `PAUSED` require replay, repair, or a deliberate source-of-truth fallback. A restart is not a repair proof.

The projection watermark must advance monotonically within its declared ordering scope. A single global order should not be implied when the source only guarantees per-partition, per-key, or per-table order.

### Read-after-write and monotonic session visibility

```text
WRITE_AUTHORITY
      |
      v
RETURN COMMIT TOKEN / LSN / VERSION
      |
      +--> REPLICA CAUGHT UP TO TOKEN --> READ REPLICA
      |
      +--> NOT CAUGHT UP -------------> PRIMARY FALLBACK
      |
      +--> STALENESS ALLOWED ----------> READ WITH FRESHNESS LABEL
      |
      +--> DEADLINE EXPIRED -----------> TIMEOUT / UNKNOWN, NOT A SILENT DOWNGRADE
```

The token is a visibility contract for the caller, not a promise that every replica is globally linearizable. A session can require monotonic reads without requiring all users to observe one total order. Analytics and public search may select a stale branch; money, entitlement, and inventory should not silently do so.

### Shard or partition migration

```text
DISCOVER -> BACKFILL -> DUAL_VERIFY -> DUAL_READ/CUTOVER -> DRAIN -> RETIRE
              |             |               |
              v             v               v
           ABORT         REPAIR          ROLLBACK
```

The migration record needs a source position/checkpoint, idempotent copy key, old/new routing decision, parity result, duplicate/omission handling, and an explicit rollback/restore boundary. “The new shard returns the same sampled rows” is evidence, not a complete proof; compare counts, checksums where meaningful, semantic invariants, deletes/tombstones, and error classes over a defined window.

## Invariant and failure matrix

| Requirement | Authority and mechanism | Failure window | Required observation/recovery |
| --- | --- | --- | --- |
| A balance or inventory mutation is valid | Primary/leader transaction, constraints, conditional write or explicit serialization | Client times out after commit; replica has not replayed | Return or recover an idempotent result; carry commit token; never infer “not committed” from a timeout. |
| User sees their own profile update | Commit token/LSN or primary read | Request is routed to a lagging replica | Route until token is visible, then expire to an explicit stale/timeout policy. |
| Search reflects a product change within 30 seconds | CDC projection with measured watermark | Connector pause, poison event, schema mismatch | Mark stale, alert on lag, quarantine/replay the event, and provide authoritative fallback for critical actions. |
| A tenant's partition remains bounded | Access-shaped partition key plus bounded time/bucket dimension | One tenant, item, or time bucket becomes hot | Rate-limit/coalesce/queue before storage, split the key with a documented read fan-out, and monitor skew. |
| Shard migration loses no rows | Snapshot + CDC/backfill + parity and staged routing | Writes arrive during copy or delete races with replay | Define ordering/checkpoint semantics, dual-verify, reconcile tombstones, and keep rollback/repair available. |
| Materialized view remains usable after rebuild | Versioned target and atomic/controlled alias swap | Target is partially built or has a different schema | Keep old version serving, validate freshness and semantics, then switch and retain a rollback window. |
| Cache outage does not corrupt a mutation | Cache is optimization; authority is called for correctness | Cache returns stale/missing value or invalidation is lost | Fail to authority or reject according to domain; never convert a cache hit into an authorization/stock proof without a contract. |
| CDC consumer restarts | Durable checkpoint plus idempotent projection write | Event is delivered again or checkpoint is ahead of the side effect | Apply by event identity/version, checkpoint after the durable effect, and repair gaps from source/log. |

## Decision table by domain

| Domain | Authority | Acceptable derived staleness | What must remain strongly protected | Typical projection strategy |
| --- | --- | --- | --- | --- |
| Bank/fintech ledger | Account/ledger transaction boundary | Statements/search can lag; balance authorization normally cannot | No lost update, no double-spend, idempotent command/result, auditability, and explicit durability/failover RPO | CDC to statements, risk/search/analytics; token-aware reads for recent writes. |
| OTA booking | Supplier/booking authority plus local reservation state | Search, availability display, and analytics may be stale for a stated window | Hold/confirm/cancel state machine, idempotency, supplier correlation, and reconciliation of UNKNOWN outcomes | Cache/search/read model for browse; authoritative confirm and compensation/retry workflow for book. |
| Commerce catalog | Product/catalog authority | Search and facets may be seconds behind; checkout must revalidate price/availability | SKU identity, price/version, inventory authority, tenant/data visibility | CDC or outbox to search/cache/materialized categories; versioned reindex and stale fallback. |
| Notifications/feed | Message/event authority | Feed fan-out and unread counters may be eventually consistent | Do not silently drop the accepted message; deduplicate and preserve recipient/privacy boundary | Per-user or per-channel projections, bounded hot-key strategy, replayable repair. |
| Analytics/BI | Append-only event/fact history and governed dimensions | Minutes/hours depending on reporting SLA | Reproducibility, late-arriving data policy, schema/version lineage, and access control | CDC/stream/batch into columnar/OLAP models; rebuild/reconcile rather than ad hoc dual writes. |

## Anti-patterns and falsifiers

- **“Replica equals backup.”** A replica can copy corruption, an accidental delete, or a bad migration. Backups need retention, point-in-time recovery, restore tests, and an independent failure boundary.
- **“Eventual consistency is okay.”** It is only okay after naming the stale read, the maximum/typical window, the domain action that cannot use it, and the fallback when the window is exceeded.
- **“CAP says SQL or NoSQL.”** CAP applies to a distributed system under a network partition; a product label does not select a consistency contract. State the failure model and the operation-level guarantee.
- **“Dual write without parity is migration.”** Two successful writes do not prove matching semantics, deletes, ordering, retries, or historical backfill.
- **“Hashing solves hot keys.”** A single popular key remains hot; randomizing it can make reads fan out and can destroy ordering or atomicity. Use bounded buckets, admission control, coalescing, or a domain-specific aggregate design.
- **“CDC is exactly once.”** At-least-once delivery plus idempotent/versioned projection writes is often the honest end-to-end design. State where duplicates and gaps are handled.
- **“Search is the source of truth.”** Search indexes optimize retrieval and may lag or omit data; authorization, charging, and inventory decisions should consult the authority unless the search store is deliberately designed as the authority.
- **“Add an index blindly.”** Verify plan shape, cardinality, selectivity, write amplification, cache footprint, vacuum/compaction, and rollback/removal cost.

Falsifiers to keep visible: a measured workload may show that a replica never meets a freshness budget; a projection may require a non-rebuildable manual correction; a shard key may satisfy average load while violating tenant isolation; a materialized view may be cheaper and safer than a cache; and a provider may not expose the commit position needed for the intended read contract. In those cases the design must change or narrow its guarantee.

## Integration map

| Public unit | Added/updated content | Why this is the smallest useful patch |
| --- | --- | --- |
| Topic 05 | Source of truth versus derived projection, CDC/rebuild/freshness boundary | Extends schema modeling without duplicating Topic 06 topology. |
| Topic 06 | Lag-aware read contract and safe partition-key/migration criteria | Makes replication/sharding operational rather than a list of product features. |
| Topic 07 | Search/cache/OLAP as derived projections with event/rebuild requirements | Adds engine selection consequences without repeating query tuning. |
| Topic 18 | Materialized/read-model/OLAP decision and refresh/rebuild proof | Connects query measurement to freshness and migration cost. |
| Case 03 | Evidence boundary plus integration/migration contract qualifiers | Preserves Tiki history while preventing historical numbers from becoming universal capacity claims. |

## Selected source ledger

Reviewed 2026-08-23. Links are first-party or standards sources unless explicitly marked as an architecture essay.

### Relational storage, replication, and query plans

1. [PostgreSQL MVCC and concurrency control](https://www.postgresql.org/docs/current/mvcc.html)
2. [PostgreSQL warm standby and streaming replication](https://www.postgresql.org/docs/current/warm-standby.html)
3. [PostgreSQL logical decoding](https://www.postgresql.org/docs/current/logicaldecoding.html)
4. [PostgreSQL logical replication](https://www.postgresql.org/docs/current/logical-replication.html)
5. [PostgreSQL row filters](https://www.postgresql.org/docs/16/logical-replication-row-filter.html)
6. [PostgreSQL column lists](https://www.postgresql.org/docs/current/logical-replication-col-lists.html)
7. [PostgreSQL logical replication conflicts](https://www.postgresql.org/docs/18/logical-replication-conflicts.html)
8. [PostgreSQL declarative partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
9. [PostgreSQL materialized views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
10. [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
11. [PostgreSQL indexes](https://www.postgresql.org/docs/current/indexes.html)
12. [MySQL replication](https://dev.mysql.com/doc/refman/8.4/en/replication.html)
13. [MySQL Group Replication](https://dev.mysql.com/doc/refman/8.4/en/group-replication.html)
14. [MySQL clustered and secondary indexes](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html)
15. [MySQL deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html)
16. [MySQL transaction model](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-model.html)

### Distributed data models and engine behavior

17. [Cassandra data modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html)
18. [Cassandra repair](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/repair.html)
19. [Cassandra topology changes](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/topo_changes.html)
20. [Cassandra Dynamo-style consistency](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html)
21. [Cassandra compaction](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/index.html)
22. [MongoDB data modeling](https://www.mongodb.com/docs/manual/data-modeling/)
23. [MongoDB read isolation, consistency, and recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
24. [MongoDB sharding](https://www.mongodb.com/docs/manual/sharding/)
25. [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)
26. [MongoDB read concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
27. [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
28. [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
29. [Redis data types](https://redis.io/docs/latest/develop/data-types/)
30. [AWS DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)
31. [AWS DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)

### CDC, messaging, and derived projections

32. [Debezium architecture](https://debezium.io/documentation/reference/stable/architecture.html)
33. [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)
34. [Apache Kafka message delivery semantics](https://kafka.apache.org/documentation/#semantics)
35. [Elasticsearch near real-time search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search)
36. [Elasticsearch reindex API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-reindex)
37. [RFC 9562 UUID formats](https://www.rfc-editor.org/rfc/rfc9562.html)

### Cross-cutting architecture references

38. [Martin Fowler: Leader and Followers](https://martinfowler.com/articles/patterns-of-distributed-systems/leader-follower.html)
39. [Martin Fowler: NoSQL key points](https://martinfowler.com/articles/nosqlKeyPoints.html)
40. [AWS Prescriptive Guidance: database decomposition and joins](https://docs.aws.amazon.com/prescriptive-guidance/latest/database-decomposition/joins.html)
41. [Google Cloud network architecture](https://docs.cloud.google.com/architecture/network-architecture)

## Integration record (applied 2026-08-23)

The five bilingual topic items and three EN/VI Case 03 qualifiers listed in the integration map were already present in `public/data` when this dossier was re-audited. No duplicate item IDs or second copy of the case anchors was created. The generated content index contains all five topic IDs; EN/VI parity, case anchors, references, and the full validation gate were rerun after this closeout.

- [x] Topic 05, Topic 06 (two items), Topic 07, and Topic 18 are present in EN/VI with their persistent IDs unchanged.
- [x] Case 03 contains the evidence, integration, and migration qualifiers in both article languages.
- [x] Provenance is recorded in this dossier's 41-source ledger and the per-item review metadata.

## Gate and remaining uncertainty

- [x] Exact local maps were read for Topics 05, 06, 07, 18 and Case 03.
- [x] Candidate source search was broad; the selected ledger contains 41 distinct sources.
- [x] Verified facts are separated from inference and recommendation.
- [x] State machines, invariant/failure matrix, domain comparison, anti-patterns, and falsifiers are recorded.
- [x] Canonical ownership and duplicate boundaries are recorded.
- [x] Add the five bilingual topic items and three EN/VI Case 03 qualifiers.
- [x] Rebuild content index and run content parity, tests, and the full check gate.
- [x] Mark the five unit records and this dossier `INTEGRATED` after validation passed.

Open uncertainties remain provider/version/configuration specific: exact failover visibility tokens in managed services, cross-region RPO, CDC ordering across tables/partitions, schema-change compatibility, delete/tombstone retention, and the economic point at which a projection is cheaper than serving the authority. These are design inputs to measure, not gaps to hide with a stronger-sounding consistency label.
