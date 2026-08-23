# Research — SQL/NoSQL database engines and selection

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `07-sql-nosql-db-engines`
EN file: `public/data/topics/07-sql-nosql-db-engines.json`
VI file: `public/data/topics/07-sql-nosql-db-engines.vi.json`

## Scope and non-goals

This record audits the local comparison of relational, document, key-value, wide-column, graph, cache, search, vector, and analytical engines. It owns capability/fit language, provider-specific guarantees, and the cost of polyglot persistence. It does not replace a production capacity test or product procurement review.

Database internals and index/lock mechanics belong to [05-db-core-index-lock.md](05-db-core-index-lock.md). Replication, sharding, and CDC belong to [06-db-scaling.md](06-db-scaling.md). Query measurement and optimization belong to [18-query-optimization.md](18-query-optimization.md). Architecture and DDD selection belong to [12-architecture-patterns.md](12-architecture-patterns.md) and [24-domain-driven-design.md](24-domain-driven-design.md). Search is a read model unless the product explicitly accepts its consistency/durability contract as authoritative.

The local unit compares Oracle, MySQL/InnoDB, PostgreSQL, MongoDB, Redis, Cassandra/Scylla, Elasticsearch, ClickHouse/warehouse systems, and pgvector. “SQL,” “NoSQL,” “ACID,” “BASE,” “strong,” and “eventual” must be qualified by engine version, deployment mode, operation, read/write concern, region, and managed-service defaults.

Evidence-policy note: a discovery ceiling of 200 candidates was available for this broad/high-risk unit. The selected ledger keeps distinct official product/project documents and first-party evidence; generic engine-ranking pages, duplicate version mirrors, and unrepeatable “fastest database” claims were excluded.

## Local content map

The complete EN and VI files were read. Structural parity check on 2026-08-23 found two sections and 13 matching item IDs in each language; every item has a non-empty answer.

| Section | Exact item IDs | Local emphasis |
| --- | --- | --- |
| The big picture | `07-sql-nosql-db-engines.the-big-picture.q1` … `.q4` | SQL/NoSQL trade-offs, NoSQL families, ACID/BASE, CAP semantics. |
| Engine by engine | `07-sql-nosql-db-engines.engine-by-engine.q1` … `.q9` | Oracle, MySQL/InnoDB, PostgreSQL, MongoDB modeling/sharding, Redis, selection, Oracle/MySQL, and search engines. |

The local content is strongest when it treats engine choice as access-pattern and invariant design. It needs changes where provider marketing, “linear scale,” “strong by default,” “in-memory means fast,” “Oracle for legacy banking,” and “search is always eventually consistent” become universal claims. It also needs a clear distinction between a database’s atomicity model and a system’s distributed consistency/freshness model.

## What is correct and reusable

- SQL is valuable not only for tables: constraints, joins, transactions, declarative queries, and mature operational tooling are part of its correctness surface.
- NoSQL is a family of models, not one consistency or scalability guarantee. Document, key-value, wide-column, graph, search, and time-series systems optimize different access paths.
- A document can make an aggregate read/write atomic when its bounded size and update pattern fit the model; it can also create duplication, document-growth, migration, and contention costs.
- PostgreSQL, MySQL, Oracle, MongoDB, Cassandra, Redis, and Elasticsearch are not interchangeable products even when they can all store JSON-like values.
- Redis is useful for low-latency ephemeral or derived state, but persistence, eviction, replication, cluster, command complexity, and failover must be part of the data-loss contract.
- Cassandra is query-driven and partition-oriented; data modeling before queries, partition-size limits, consistency level, repair, and conflict semantics are essential.
- Search engines provide inverted-index relevance and near-real-time search, not automatically transactional source-of-truth semantics.
- Polyglot persistence can fit a system, but every additional engine adds data movement, schema/version, backup/restore, security, observability, and reconciliation ownership.

## Claims to verify or qualify

| Claim from local content | Classification | Evidence | Scope / limitation | Confidence |
| --- | --- | --- | --- | --- |
| SQL databases offer relational queries, constraints, and ACID transactions; NoSQL models often start from access patterns and horizontal distribution. | Verified framing, not a taxonomy law | [S01], [S05], [S13], [S17] | Many SQL systems distribute and many NoSQL systems support transactions; avoid a binary “SQL strong / NoSQL eventual” table. | High |
| Document, key-value, wide-column, graph, search, and vector engines are different models. | Verified conceptual fact | [S13], [S14], [S18], [S21], [S24], [S26] | Products may combine models; classify the operation and primary access path. | High |
| ACID describes transaction properties; BASE is a family of availability/eventual-convergence trade-offs. | Useful teaching model | [S13], [S17], [S19] | BASE is not a formal protocol and eventual consistency needs convergence/conflict/freshness definition. | Medium-high |
| CAP consistency is not the same as SQL consistency, and CAP is not SQL versus NoSQL. | Verified model | [S20], [S22], [S23] | CAP concerns distributed operations during partitions; product modes and client concerns matter. | High |
| Oracle RAC uses shared storage/Cache Fusion; Data Guard supplies standby/DR capabilities. | Verified product fact | [S06], [S07], [S08] | Edition, licensing, topology, and database release constrain features and costs. | High |
| MySQL/InnoDB uses a clustered primary key, redo/undo, and buffer pool for OLTP. | Verified product fact | [S09], [S10], [S11] | Managed MySQL products may alter topology, storage, backups, and failover behavior. | High |
| PostgreSQL provides MVCC, JSONB, extension points, and rich index types. | Verified product fact | [S02], [S03], [S04] | Extensions are separately versioned/operated; availability and support vary by provider. | High |
| “PostgreSQL is rising in AI” or “Oracle remains in core banking” is a market/trend claim. | Unresolved / recommendation context | Official product docs do not establish market prevalence. | Keep as an observation only if a dated market source is added; otherwise remove and compare required capabilities. | High that local wording needs evidence |
| MongoDB embedding is faster and references are slower. | Over-absolute | [S14], [S15], [S16] | Embedding can reduce round trips/locality; duplication, document growth, write fan-out, and update consistency can reverse the trade-off. `$lookup`/transactions have their own costs. | High |
| MongoDB has atomic single-document writes and supports multi-document transactions. | Verified product fact | [S14], [S15], [S16] | Transaction guarantees depend on read/write concern, deployment, and transaction scope; they do not make arbitrary distributed workflows atomic. | High |
| MongoDB sharding is efficient with a suitable shard key; scatter-gather is expensive. | Verified design implication | [S17] | Query targeting, cardinality, monotonicity, zone layout, and data distribution determine behavior. | High |
| Redis is in-memory/mostly single-threaded and slow O(N) commands can block an event loop. | Verified with version/command scope | [S18], [S19], [S20] | Redis has more threaded/background behavior in newer releases and products; command complexity and dataset shape still matter. | High |
| Redis RDB/AOF persistence choices change loss and restart behavior. | Verified product fact | [S21] | Persistence and replication are not equivalent to synchronous durable transactions; test the selected policy. | High |
| Cassandra is query-driven and denormalized; partition-key design controls routing/locality. | Verified product fact | [S24], [S25] | Query patterns, partition growth, repair, consistency level, and compaction govern production fit. | High |
| Search engines are near-real-time read models and should normally be fed by outbox/CDC. | Verified mechanism plus recommendation | [S26], [S27], [S28] | Refresh interval, translog, durability, alias/reindex, and source-of-truth design are provider-specific. | High |
| pgvector keeps vector search inside PostgreSQL and offers exact/approximate indexes. | Verified extension fact | [S29] | ANN recall/latency, build memory, vacuum, version, and workload determine whether one engine is enough. | High |
| “Polyglot persistence is best practice.” | Recommendation requiring cost model | [S30], [S31] | It can reduce fit risk but multiplies operations, consistency, and recovery work. | Medium |

## Workload, invariants, and failure model

| Workload / invariant | Engine candidate | Failure / crash window | Recovery / proof obligation |
| --- | --- | --- | --- |
| Ledger, balance, booking state, uniqueness | Relational engine with constraints/transactions; possibly a specialized ledger | Commit acknowledged locally but replica/derived store lags; deadlock/serialization retry | Define local durability, idempotency, uniqueness, and reconciliation. Search/cache cannot be authoritative unless its own contract proves it. |
| Flexible catalog/document aggregate | MongoDB or PostgreSQL JSONB when aggregate fits size/update pattern | Partial document rewrite, schema drift, document growth, duplicate embedded values | Version schema, validate required fields, bound document size, migrate duplicates, and test concurrent updates. |
| High-volume query-driven event/time-series data | Cassandra/Scylla, time-series extension, or columnar store | Hot partition, tombstone/compaction pressure, late/out-of-order event, node loss | Model query first, cap partitions, define retention/repair, and validate consistency/freshness. |
| Cache/session/rate limit | Redis | Eviction, restart, failover, replica lag, split-brain/lock expiry | Treat as disposable or define persistence/RPO; use fencing for locks and never store sole durable business state without explicit proof. |
| Full-text/faceted search | Elasticsearch/OpenSearch or hosted search | Source commit succeeds but index refresh/update fails or duplicates; reindex partial | Outbox/CDC, deterministic document ID, retry/DLQ, alias swap, replay, and source-of-truth fallback. |
| Analytics/aggregations over large history | Columnar OLAP/warehouse | Late data, materialized view lag, ingestion duplication, expensive ad hoc query | Define freshness/accuracy window, dedupe key, backfill/recompute, and cost budget. |
| Vector similarity | pgvector or dedicated vector engine | Index build/recall trade-off, stale embeddings, deleted source not removed | Track embedding model/version, source ID, tombstone/delete propagation, recall target, and re-embedding plan. |
| Cross-engine workflow | Source relational transaction + outbox/CDC + derived stores | Crash between source commit and consumer effect; replay/ordering/schema mismatch | Idempotent consumers, durable offsets, event versioning, reconciliation, and deletion/retention process. |

## Best-practice comparison

| Capability / trade-off | Oracle | MySQL/InnoDB | PostgreSQL | MongoDB | Cassandra/Scylla | Redis | Search / OLAP / vector |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Best fit hypothesis | Enterprise relational workloads, RAC/DR/Oracle ecosystem | Familiar OLTP with clustered PK and managed options | Complex relational/JSON/query workloads and extensions | Document-shaped aggregates and flexible schema | High-scale partitioned/query-driven workloads | Derived low-latency data/cache/stream primitives | Specialized read/analytics/vector access paths |
| Correctness boundary | Relational transaction; RAC/standby semantics are separate | InnoDB local transaction; replication contract separate | MVCC transaction; extension/replica contract separate | Single-document atomicity; multi-doc transaction when justified | Partition/consistency-level semantics; not arbitrary relational invariants | Command/transaction/persistence/replication mode dependent | Index/materialization/ingestion contract, normally not source transaction |
| Schema evolution | Strong schema/tooling; migration and edition cost | Strong schema; online DDL/version scope | Strong schema plus JSONB; migration/extension scope | Flexible does not mean no schema; validation/migrations remain needed | Query-driven denormalized schema; changing queries can require new tables | Key/value contract is application-owned | Index/schema/template/model version is operational data |
| Scale lever | Vertical/RAC/partition/replication | Vertical/read replicas/partition/sharding products | Vertical/replicas/partition/sharding extensions/products | Sharding with shard-key/query targeting | Nodes/partitions/replication | Memory/nodes/cluster/streams | Shards/partitions/columnar/ANN/index replicas |
| Main negative evidence | Licensing/topology complexity does not prove correctness | Read replicas do not provide read-your-write automatically | Extensions/JSONB do not remove bloat/vacuum/plan work | Embedding everything creates duplication/growth | Adding nodes does not fix a hot partition | In-memory does not mean durable or safe as ledger | Near-real-time/fast query does not mean fresh/transactional |

### Selection rubric

Score the candidate on these questions, in order: (1) what invariant must be atomic, (2) what access patterns and joins exist, (3) what freshness and recovery window is acceptable, (4) what data volume/skew/write rate exists, (5) how schema changes and deletes propagate, (6) which team can operate it, (7) how backup/restore and regional failure are tested, and (8) what security/compliance boundary it must satisfy. A polyglot choice is justified only when the second engine’s distinct access path pays for the extra data and operations contract.

## Coverage matrix

| Required evidence area | Current local coverage | Evidence quality | Proposed treatment |
| --- | --- | --- | --- |
| Definitions | SQL/NoSQL families, ACID/BASE, CAP | Broad, but binary comparisons risk teaching errors | Add “model vs product vs operation” terminology. |
| Invariants | Ledger/booking/cache/search examples | Good domain direction | Add authoritative owner, constraint, freshness, and reconciliation fields. |
| Workload | OLTP, catalog, search, analytics, vector | Good breadth, few quantitative dimensions | Add cardinality, skew, read/write ratio, latency percentile, and freshness/RPO. |
| Failure / crash windows | Some replication/search caveats | Partial | Add cache loss, document partial migration, index lag, reindex, compaction, and cross-engine crash windows. |
| Retries / timeouts | Mentioned indirectly | Insufficient | Add per-engine client timeout, idempotency, retry, circuit-breaker, and backfill rules. |
| Operations / recovery | Backup/HA appears for Oracle/MySQL | Uneven | Add restore test, version upgrade, rebuild/reindex, repair, failover, and cost runbooks. |
| Security / privacy | Sparse | Insufficient | Add encryption, IAM/ACL, PII in replicas/indexes/logs, tenant isolation, and deletion propagation. |
| Testing | Decision guidance | Insufficient | Add production-shaped benchmark, fault injection, consistency tests, schema migration, replay, and restore drills. |
| Domain trade-offs | OTA/fintech mappings | Valuable but some universal statements | Convert mappings to explicitly scoped workload hypotheses. |

## Contradictions and limits

| Local simplification | Counterexample / limit | Resolution |
| --- | --- | --- |
| SQL = strong, NoSQL = eventual | MongoDB supports transactions; DynamoDB has strong/transactional modes; relational replicas can be stale. | Describe the selected operation and client concern. |
| NoSQL scales linearly | Hot partitions, secondary indexes, cross-partition queries, repair, compaction, and coordination create nonlinear limits. | Say “can scale horizontally for a modeled access pattern under measured conditions.” |
| Mongo embedding is always faster | Duplication/update fan-out/document growth can dominate. | Compare locality versus mutation/fan-out and use a representative document. |
| Redis is safe for sessions/locks because it is fast | Restart/failover/TTL and clock behavior can invalidate a lock; cache eviction can lose sessions. | State whether state is disposable and use fencing/renewal for coordination. |
| Cassandra eventual consistency is fine for history | History may have audit/legal correctness requirements; stale or conflicting records can be unacceptable. | Specify the history invariant and reconciliation/repair SLA. |
| Search is eventually consistent, so it can be ignored | Search lag, duplicate documents, stale deletes, and reindex downtime are product-visible. | Publish freshness and availability behavior, not a vague “eventual” label. |
| Oracle versus MySQL is a brand decision | Schema, workload, operations, HA/DR, support, licensing, and team experience dominate. | Require a weighted decision record and failure/restore evidence. |

## Negative evidence and anti-patterns

- Do not choose “NoSQL” to avoid data modeling; every NoSQL engine has a model, and a poor partition/document/key design is still a schema failure.
- Do not place a ledger, balance, or unique booking authority in Redis, Elasticsearch, or a Cassandra table without a proof of the needed invariant and recovery path.
- Do not dual-write a relational source and search/cache directly from request code; use an outbox/CDC path with idempotent document identity and replay.
- Do not embed an unbounded child collection or frequently updated child into a document merely to avoid a join.
- Do not add a MongoDB shard key with low cardinality, monotonic hotspot, or no route for the most common query.
- Do not call a Cassandra partition “a table” and then allow unbounded time/tenant growth; model retention and partition rollover.
- Do not use Redis `KEYS` or other unbounded commands in a latency-sensitive path; inspect command complexity and scan behavior.
- Do not equate RDB/AOF persistence with a synchronous replicated business commit, or assume a replica is a backup.
- Do not make a search index the only copy of data because “the index is fast”; index loss/rebuild is a normal operational event.
- Do not add an engine for one query without assigning ownership for schema evolution, upgrades, access control, backup/restore, and incident response.

## Operational, security, observability, and testing concerns

- **Operations:** maintain a per-engine runbook for backup/restore, point-in-time recovery, failover, upgrade, index rebuild, compaction/repair, cache flush, reindex, and migration rollback. Record version and managed-service differences.
- **Observability:** measure source and derived-store lag, query p95/p99, error/retry/timeout rates, connection/pool saturation, disk/memory, cache hit/eviction, partition/key skew, index refresh/rebuild, compaction/repair, and restore age. Tag by engine and workload, not only endpoint.
- **Security/privacy:** enforce least privilege per engine and connector; encrypt data and replication links; audit admin/DDL; redact PII from search documents, cache values, events, and query logs; implement deletion across every copy and backup retention policy.
- **Testing:** benchmark representative cardinality/skew and cold/warm cache; test concurrent invariants, failover and stale reads, document migration, shard/partition movement, search replay/reindex, vector recall, compaction/repair, backup restore, and schema rollback. Verify managed-provider settings separately from local open-source defaults.
- **Cost:** include storage amplification, replicas, egress, cross-region traffic, indexing, compaction/repair, backup, licenses/support, on-call expertise, and replay/backfill compute. Latency alone is not a sufficient engine-selection metric.

## Duplicate / canonical ownership

| Subject | Canonical dossier | Boundary |
| --- | --- | --- |
| Index/lock/MVCC internals | [05-db-core-index-lock.md](05-db-core-index-lock.md) | Engine comparison should link to mechanics, not repeat lock algorithms. |
| Replication/sharding/CDC | [06-db-scaling.md](06-db-scaling.md) | This file states fit; topic 06 owns topology/freshness details. |
| Query tuning | [18-query-optimization.md](18-query-optimization.md) | Keep only engine-specific optimizer/feature differences here. |
| Architecture boundary | [12-architecture-patterns.md](12-architecture-patterns.md) | Polyglot choice must fit module ownership. |
| DDD domain model | [24-domain-driven-design.md](24-domain-driven-design.md) | Use bounded context/invariant language before selecting storage. |
| Distributed transaction / Outbox | [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md) and [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md) | Search/cache/warehouse projections are downstream workflows. |

## Current-vs-proposed content gaps

1. Replace the SQL/NoSQL binary table with a capability matrix that separates data model, transaction scope, read concern, replication, query routing, and operational burden.
2. Add version/provider labels to Oracle 23c/26, MySQL 8.4, PostgreSQL 18, MongoDB current, Redis current, Cassandra/Scylla, Elasticsearch/OpenSearch, ClickHouse, and pgvector examples.
3. Replace unsupported trend statements (“rising in AI,” “legacy core banking stays Oracle”) with capability requirements or dated evidence.
4. Add an authoritative-source decision rubric and an explicit polyglot cost/recovery checklist.
5. Expand Mongo embedding/reference and sharding sections with document growth, fan-out, `$lookup`, shard-key query targeting, read/write concern, and transaction limits.
6. Expand Redis with persistence/eviction/replication/lock-fencing and command-complexity failure modes.
7. Expand Cassandra/Scylla with partition growth, repair, compaction/tombstones, consistency level, and hot-key failure modes.
8. Make search and vector indexes explicit derived/read models, including stale delete/reindex and embedding versioning.
9. Add security, deletion propagation, restore tests, and benchmark acceptance criteria in both language versions.

## EN/VI and cross-reference plan

Preserve all 13 item IDs and the two-section order. Translate “source of truth,” “derived read model,” “freshness budget,” “bounded staleness,” “partition key,” “scatter-gather,” “repair,” and “reindex” consistently. Keep engine names, settings, commands, consistency levels, and URLs unchanged. Both languages should use the same capability/negative-evidence tables; examples may retain the same OTA/fintech data but must be labelled as workload hypotheses.

## Integration record (Batch D scope)

- [x] Added `07-sql-nosql-db-engines.engine-by-engine.q10` in EN/VI to make search/cache/OLAP projection freshness, event identity, deletes, replay, and rebuild explicit.
- [x] Kept the existing search-engine boundary as the canonical introduction; the new item adds the operational proof required to rebuild a projection.
- [ ] The broader comparison of every listed engine's current version and cost/performance fit remains a follow-up.

## Open questions and falsifiers

- What are the actual domain invariants and authoritative write stores? Any engine mapping is falsified if it cannot enforce or reconcile the invariant under its documented failure mode.
- What are the measured data volume, growth, skew, write/read ratio, p95/p99, query shapes, and freshness/RPO/RTO budgets? “Scalable” is unresolved without them.
- Which managed providers, versions, editions, and extensions are available? A capability claim is falsified if the target service removes or changes the feature.
- What is the restore objective for each engine and derived store? A polyglot architecture is incomplete if any store cannot be rebuilt from an authoritative source within the RTO.
- What data must be deleted and how quickly across replicas, caches, indexes, events, vector stores, and backups? A selection recommendation is incomplete until privacy deletion is executable.
- What benchmark would reject the second engine: cost, p99, write amplification, recall, freshness, or operational toil? Record the threshold before choosing.
- Can the team operate every selected engine during a regional failure? If not, the polyglot recommendation is falsified by the support/on-call constraint.

## Sources

Source ledger. Tier `T1` = standard/original paper; `T2` = official product/project documentation; `T3` = first-party engineering/reference material. All entries reviewed on 2026-08-23. The selection favors primary sources and excludes SEO comparisons, copied “SQL versus NoSQL” charts, and unrepeatable vendor benchmarks.

| ID | URL / title | Organization | Tier | Version / revision | Claims supported |
| --- | --- | --- | --- | --- | --- |
| S01 | [What is PostgreSQL?](https://www.postgresql.org/docs/current/intro-whatis.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Relational features, extensibility, transactional database scope. |
| S02 | [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | JSON/JSONB storage and GIN/query trade-offs. |
| S03 | [MVCC Introduction](https://www.postgresql.org/docs/current/mvcc.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | PostgreSQL MVCC and concurrency consequences. |
| S04 | [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Declarative relational invariants. |
| S05 | [MySQL 8.4 Reference Manual](https://dev.mysql.com/doc/refman/8.4/en/) | MySQL | T2 | 8.4 LTS reference | Product/version scope, SQL/InnoDB features and defaults. |
| S06 | [RAC Database Instance](https://docs.oracle.com/en/database/oracle/oracle-database/26/adrac/rac_db_instance.html) | Oracle | T2 | Oracle Database 26 docs | RAC instance/cache-fusion topology. |
| S07 | [Oracle Data Guard Examples](https://docs.oracle.com/en/database/oracle/oracle-database/23/sbydb/examples-of-using-oracle-data-guard.html) | Oracle | T2 | Oracle Database 23 docs | Standby/DR capabilities and provider scope. |
| S08 | [Physical Storage Structures](https://docs.oracle.com/en/database/oracle/oracle-database/23/cncpt/physical-storage-structures.html) | Oracle | T2 | Oracle Database 23 docs | Oracle redo/undo/storage concepts. |
| S09 | [InnoDB Clustered and Secondary Indexes](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html) | MySQL | T2 | 8.4 | InnoDB physical layout and PK/secondary trade-off. |
| S10 | [InnoDB Transaction Model](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-model.html) | MySQL | T2 | 8.4 | InnoDB MVCC/redo/undo transaction scope. |
| S11 | [InnoDB Buffer Pool](https://dev.mysql.com/doc/refman/8.4/en/innodb-buffer-pool.html) | MySQL | T2 | 8.4 | Buffering and memory/storage behavior. |
| S12 | [MongoDB Data Modeling](https://www.mongodb.com/docs/manual/core/data-model-design/) | MongoDB | T2 | Current manual reviewed 2026-08-23 | Document modeling and aggregate-oriented trade-offs. |
| S13 | [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/) | MongoDB | T2 | Current manual | Single-document atomicity and multi-document transaction scope/cost. |
| S14 | [Embedding versus References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/) | MongoDB | T2 | Current manual | Locality, duplication, growth, and reference trade-offs. |
| S15 | [MongoDB Read and Write Concerns](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/) | MongoDB | T2 | Current manual | Read concern, write concern, causal/linearizable scope. |
| S16 | [MongoDB Default Read/Write Settings](https://www.mongodb.com/docs/manual/reference/mongodb-defaults/) | MongoDB | T2 | Current manual | Defaults and rollback/visibility qualification. |
| S17 | [MongoDB Sharding](https://www.mongodb.com/docs/manual/sharding/index.html) | MongoDB | T2 | Current manual | Shard keys, targeted versus scatter-gather queries. |
| S18 | [Redis Data Types](https://redis.io/docs/latest/develop/data-types/) | Redis | T2 | Current docs | Key/value structures and command model. |
| S19 | [Redis Latency Optimization](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/) | Redis | T2 | Current docs | Single-thread/slow-command latency considerations. |
| S20 | [Redis Commands](https://redis.io/docs/latest/commands/) | Redis | T2 | Current docs | Command complexity and operational anti-pattern scope. |
| S21 | [Redis Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) | Redis | T2 | Current docs | RDB/AOF persistence and recovery trade-offs. |
| S22 | [Redis Cluster Specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) | Redis | T2 | Current docs | Hash slots, cluster routing, failure/topology limits. |
| S23 | [Cassandra Data Modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html) | Apache Cassandra | T2 | Current project docs | Query-driven schema and partition-key design. |
| S24 | [Cassandra Dynamo-style Architecture](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) | Apache Cassandra | T2 | Current project docs | Consistency levels, repair, timestamps, reconciliation. |
| S25 | [Cassandra Compaction](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/index.html) | Apache Cassandra | T2 | Current project docs | Tombstones, compaction, storage/repair consequences. |
| S26 | [Elasticsearch Near Real-time Search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search) | Elastic | T2 | Current docs reviewed 2026-08-23 | Refresh/search visibility delay and NRT scope. |
| S27 | [Elasticsearch Translog](https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-translog.html) | Elastic | T2 | Current reference | Durability/flush behavior and source/index distinction. |
| S28 | [Elasticsearch Reindex API](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-reindex.html) | Elastic | T2 | Current reference | Reindex/recovery and alias/migration operational scope. |
| S29 | [pgvector](https://github.com/pgvector/pgvector) | pgvector project | T2/T3 | Current README/repository reviewed 2026-08-23 | Exact/ANN search, HNSW/IVFFlat, PostgreSQL integration/trade-offs. |
| S30 | [ClickHouse: What is a Columnar Database?](https://clickhouse.com/resources/engineering/what-is-columnar-database) | ClickHouse | T3 | First-party engineering article | Row versus columnar scan/aggregation fit; not used for universal benchmarks. |
| S31 | [ClickHouse: What is OLAP?](https://clickhouse.com/resources/engineering/what-is-olap) | ClickHouse | T3 | First-party engineering article | OLTP/OLAP workload distinction. |
| S32 | [DynamoDB Read Consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html) | AWS | T2 | Current docs | Product-specific eventual/strong/transactional read modes. |
| S33 | [DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html) | AWS | T2 | Current docs | Product-specific change-stream scope and retention. |
| S34 | [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html) | IETF | T1 | May 2024 | UUIDv4/v7 identity/time/privacy considerations. |

## Discovery exclusions

Excluded candidates included generic vendor-vendor comparison pages, “fastest database” lists, unsourced Oracle-versus-Postgres market claims, reposted CAP diagrams, and blog benchmarks without schema, consistency mode, hardware, or data distribution. Duplicate official version mirrors were collapsed to the current/provider-specific document.
