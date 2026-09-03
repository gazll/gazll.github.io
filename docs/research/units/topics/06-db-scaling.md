# Research — Database scaling, replication, partitioning, and CDC

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `06-db-scaling`
EN file: `public/data/topics/06-db-scaling.json`
VI file: `public/data/topics/06-db-scaling.vi.json`

## Scope and non-goals

This record audits the local unit’s replication/consistency, partitioning/sharding, identifier generation, CAP/PACELC, consensus, ORM N+1, and CDC material. It is the canonical scaling record for data topology, freshness, ownership, rebalancing, and change propagation.

It does not own broker delivery semantics or the generic Outbox/Saga definition. Those are [08-message-queue.md](08-message-queue.md), [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md), and the concrete [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md). Query-shape and ORM performance belong to topic 18. DDD boundary discovery belongs to topics 12 and 24.

The local topic spans several systems: MySQL, PostgreSQL, Cassandra/Scylla, Kafka/Debezium, consensus systems, and JPA/Hibernate. No statement about “replication,” “strong consistency,” “CAP,” or “CDC” is portable across all of them. The deployment’s version, topology, failure detector, clock model, and client routing are part of the contract.

Evidence-policy note: a discovery ceiling of 200 candidates was available for this broad/high-risk unit. The selected ledger keeps only sources that add a distinct protocol guarantee, provider/version limit, failure window, recovery operation, or original model; duplicate mirrors, SEO summaries, and unsourced capacity charts were excluded.

## Local content map

The complete EN and VI files were read. Structural parity check on 2026-08-23 found two sections and 11 matching item IDs in each language; every item has a non-empty answer.

| Section | Exact item IDs | Local emphasis |
| --- | --- | --- |
| Replication & consistency | `06-db-scaling.replication-consistency.q1` … `.q4` | Async/semi-sync/sync and lag, read-after-write, single-primary versus multi-master, Cassandra/Scylla six-node join and empty balances. |
| Sharding & partitioning | `06-db-scaling.sharding-partitioning.q1` … `.q7` | Partition versus shard, resharding/consistent hashing, Snowflake/UUID, CAP/PACELC, Raft/Paxos, JPA N+1, CDC/Debezium. |

The content correctly treats freshness and topology as workload decisions. It needs qualification where it turns a provider mode into a universal definition: “synchronous,” “multi-master conflict resolution,” exact replica counts, vnode counts, DynamoDB/Spanner CAP labels, Cassandra bootstrap flags, Snowflake bit capacity, and the claim that one particular business domain rarely uses a topology.

## What is correct and reusable

- Asynchronous replication gives a remote apply/visibility window; semi-synchronous protocols reduce one class of loss window but their acknowledgment point must be named; “synchronous” is not one cross-product guarantee.
- Read-after-write is an application routing/visibility problem. A fixed sleep is not a consistency protocol.
- Single-primary simplifies write ownership and conflict handling but still needs failure detection, fencing, promotion, and client routing. Multi-primary adds conflict/order semantics; it is not automatically active-active correctness.
- A shard key is simultaneously a data-distribution, routing, locality, hot-key, privacy, and resharding decision. A hash ring does not move data by itself.
- CAP’s consistency means a linearizability-like guarantee in a distributed model; it is not SQL ACID consistency, and “AP database” is not a product-wide label independent of operation and configuration. PACELC adds the latency/consistency trade-off when no partition is occurring.
- Consensus algorithms replicate an ordered log/state machine under explicit assumptions. A quorum number is not a universal availability rule outside the algorithm/topology.
- Cassandra’s eventual/reconciliation behavior makes mutable balances a poor fit unless the design uses an appropriate conditional/linearizable mechanism and reconciliation; local examples should not be read as a recipe for a financial ledger.
- CDC is a change-propagation mechanism with snapshot, ordering, duplicate, schema, delete/tombstone, and offset/recovery semantics. Debezium Outbox is a bridge, not a replacement for a transactional boundary.

## Claims to verify or qualify

| Claim from local content | Classification | Evidence | Scope / limitation | Confidence |
| --- | --- | --- | --- | --- |
| Async replication acknowledges before a replica applies; semi-sync waits at a defined replica acknowledgment point. | Verified with provider scope | [S01], [S03], [S04] | MySQL semi-sync normally waits for receipt/logging, not necessarily replay; PostgreSQL synchronous commit mode can wait for flush/write/replay depending on setting. | High |
| “Synchronous replication waits for every replica.” | Over-absolute | [S01], [S02] | Quorum/standby selection and acknowledgment mode vary; MySQL classic replication is not generally synchronous, and NDB is a different product. | High |
| Replica lag has transport, flush, and replay components; bytes/LSN and time are different signals. | Verified fact | [S02], [S05] | Metric names and precision vary by engine/provider; idle replicas make time-based metrics misleading. | High |
| Read-after-write can use primary routing, stickiness, or a commit LSN/GTID gate. | Recommendation supported by mechanics | [S02], [S05], [S06] | The client must understand failover timelines and provider token semantics. A sleep cannot prove visibility. | High |
| Single-primary avoids concurrent write conflicts but requires fencing and promotion correctness. | Inference from topology mechanics | [S04], [S05] | The application still sees duplicate effects during retry/failover unless writes are idempotent. | High |
| Multi-primary requires conflict resolution such as LWW, CRDT, or application merge. | Verified design implication | [S04], [S07], [S08] | Some products reject conflicting transactions instead; “conflict resolution” must specify product and data type. | High |
| Cassandra quorum intuition uses `R + W > RF` for overlap. | Verified model with limits | [S09] | It assumes the stated consistency levels, replica placement, failure model, and no subtle read-repair/repair issue; it does not make arbitrary workloads linearizable. | High |
| Adding six Cassandra/Scylla nodes without correct bootstrap/streaming can leave data absent or topology unsafe. | Provider/project-specific fact | [S10], [S11] | Flags and topology protocols differ by Cassandra/Scylla version. Never copy a flag without a versioned runbook. | High |
| Mutable balance in eventually reconciled storage can appear empty/stale or lose a business update. | Risk/inference | [S09], [S10], [S12] | Exact outcome depends on timestamps, consistency level, repair, idempotency, and application conflict rules. | Medium-high |
| Consistent hashing limits the mapping change set but does not eliminate rebalancing cost. | Verified concept | [S13], [S14] | Vnodes/ranges, replicas, streaming bandwidth, compaction, and hotspot distribution still matter. | High |
| Snowflake-like IDs combine time, worker, and sequence; UUIDv7 has time-ordered bits. | Verified format/design fact | [S15], [S16] | Bit allocation, epoch, clock handling, privacy, and throughput are implementation choices; local “4096 IDs/ms” is not universal. | High |
| CAP is not “SQL versus NoSQL,” and PACELC adds a normal-operation latency/consistency dimension. | Verified model | [S17], [S18], [S19] | Product mode, operation, client consistency level, and region topology determine the actual guarantee. | High |
| A 3-node consensus group tolerates one failure and a 5-node group two. | Verified quorum arithmetic under standard majority model | [S20], [S21] | Only while the group is configured and network/clock/storage assumptions hold; it says nothing about application data correctness. | High |
| CDC is at-least-once in many practical pipelines and consumers need idempotency/order keys. | Recommendation supported by implementation behavior | [S22], [S23] | Exact delivery/ordering contract depends on connector, source, partition key, offset storage, and sink. | High |
| “Debezium solves the dual-write problem.” | Over-absolute | [S22], [S24] | Outbox reduces the application dual-write race; connector outage, duplicate delivery, schema evolution, sink failure, and consumer side effects remain. | High |
| “N+1 is fixed by JOIN FETCH.” | Over-absolute | [S25], [S26] | Join fetch can multiply rows/cartesian results; DTO projection, batch fetch, entity graph, or a purpose-built query may be safer. | High |

## Workload, invariants, and failure model

| Workload / invariant | Scaling mechanism | Crash / partition window | Recovery and proof obligation |
| --- | --- | --- | --- |
| Wallet/ledger commit must not be lost or double-applied | Single write owner or consensus-backed store; local transaction and idempotency key | Primary acknowledges; replica has not applied; client retries after timeout | Define RPO and fencing. Reconcile by transaction/idempotency identity, not by timestamp alone. |
| Booking confirmation must be visible to the submitting user | Primary read or LSN/GTID/commit-token gate | Router sends read to stale replica after write/failover | Keep a bounded primary window or carry a visibility token; measure worst-case apply delay. |
| Historical/reporting reads tolerate bounded staleness | Read replicas/OLAP with explicit freshness budget | Replica lag or stale snapshot | Expose freshness timestamp/LSN; shed or reroute when budget is exceeded. |
| Hot key such as one flight/seat/resource | Key decomposition, partition-local queue, conditional write, or deliberate serialization | Hot partition overload; retry amplification | Monitor per-key/partition p99 and queue depth; do not assume adding nodes fixes a single hot key. |
| Shard routing by tenant/account | Stable high-cardinality key and directory/versioned mapping | Reshard mapping changes while requests are in flight | Dual-read/dual-write or versioned routing, checksummed migration, cutover and rollback plan. |
| Cassandra node replacement/join | Correct bootstrap/streaming, repair policy, topology validation | Node starts without data or leaves hinted/repair gaps; cleanup deletes before convergence | Stop unsafe cleanup, inspect ownership/endpoints, stream/repair, validate reads, then remove old topology. |
| CDC projection/search/cache | Source transaction + log/CDC + idempotent consumer | Commit succeeds; connector/sink is down; duplicate after offset replay; tombstone lost | Outbox/CDC offset and sink idempotency, replayable history, schema/tombstone contract, lag SLO. |
| Consensus leader change | Majority log replication and term/index checks | Leader crashes after client response or before commit; network partition | Only committed entries become authoritative; clients retry with request identity; monitor quorum and disk fsync. |
| ORM request loads collection graph | Query shape/projection/batch fetch | N+1 or cartesian explosion saturates DB and pool | Query count/row-width budgets in tests; load representative cardinalities. |

### Consistency vocabulary to preserve

For each read path state: **source**, **visibility guarantee**, **maximum accepted staleness**, **routing rule**, and **behavior during failover**. For each write path state: **owner**, **acknowledgment point**, **deduplication key**, **replay behavior**, and **reconciliation owner**. This prevents “strong” or “eventual” from becoming an untestable label.

## Best-practice comparison

| Decision | Single-primary relational replication | Cassandra-style quorum/eventual model | Consensus replicated state machine | CDC / Debezium | Recommendation boundary |
| --- | --- | --- | --- | --- | --- |
| Write conflict | One owner; failover/fencing needed | Concurrent versions may reconcile by timestamp/level/application | Ordered log rejects/serializes by leader/quorum | No write conflict resolution; propagates source result | Pick the model that can prove the domain invariant. |
| Read freshness | Primary or synchronous/LSN-gated replica | Consistency level and repair/read-repair dependent | Committed state at quorum/leader semantics | Projection is behind source by connector/sink lag | Make freshness observable and part of API behavior. |
| Scale lever | Read replicas, partitioning, sharding | Partitions/nodes and query-driven denormalization | Shard the state machine; each group has a limit | More partitions/connectors/sinks; source remains bottleneck | Scaling a consumer does not scale the source write path. |
| Partition failure | Failover can create stale/unknown client routing | Availability may continue with conflicts/stale data | Minority cannot commit new state | Stream pauses/replays; offsets determine recovery | State whether preserving writes or preserving linearizable state wins. |
| Rebalance | Replica rebuild/reshard with migration | Bootstrap/stream/repair/cleanup | Membership change protocol | Topic/partition reassignment and consumer replay | Treat movement as a data migration, not a metadata-only action. |
| Security | Replication credentials and topology exposure | Node-to-node auth/encryption, data ownership | Quorum membership and log access | Connector secrets, PII in events, sink ACLs | Threat-model data copied to every replica and projection. |

## Coverage matrix

| Required evidence area | Current local coverage | Evidence quality | Proposed treatment |
| --- | --- | --- | --- |
| Definitions | Replication modes, sharding, CAP, consensus, CDC | Broad but several provider terms are compressed | Add a scope column for product/version/ack point. |
| Invariants | Read-your-write, balances, booking, key distribution | Good examples, not yet formal | Add owner/visibility/dedup/reconciliation fields. |
| Workload | OTA, fintech, history, hot keys, ORM | Useful domain framing | Add request rate, skew, freshness budget, RPO/RTO, and cross-shard query assumptions. |
| Failure / crash windows | Lag and Cassandra join failure are present | Partial | Add acknowledge-before-apply, failover fencing, CDC offset replay, reshard cutover, and quorum-loss windows. |
| Retries / timeouts | Idempotency and retry are implied | Needs explicit policy | Add deadline propagation, retry budget, duplicate handling, and circuit breaking. |
| Operations / recovery | Cassandra checks and CDC mentions | Needs runbook detail | Add lag/LSN, repair/stream, ownership, quorum, offset, and rollback evidence. |
| Security / privacy | Sparse | Insufficient | Add replica/connector ACLs, encryption, tenant isolation, ID timestamp leakage, and PII deletion propagation. |
| Testing | Mostly conceptual | Insufficient | Add failover/partition, stale-read, reshard, CDC duplicate/replay, and ORM query-count tests. |
| Domain trade-offs | Fintech/OTA examples | Valuable but domain assertions need scope | Convert to workload hypotheses and link to case-study ownership. |

## Contradictions and limits

| Local simplification | Counter-guarantee / scope | Resolution |
| --- | --- | --- |
| “Semi-sync means the replica has the commit.” | MySQL’s documented semi-sync acknowledgment can be receipt/logging; PostgreSQL `remote_apply` is a different, stronger wait point. | Name the exact acknowledgment stage and provider setting. |
| “Synchronous means all replicas.” | Many systems wait for a configured set/quorum, not every replica. | Document the quorum and failure behavior. |
| “CAP says Cassandra is AP and Spanner is CP.” | CAP applies to a distributed operation under a partition; client consistency modes, transaction scope, region topology, and availability policy change the observed behavior. | Use operation-level examples; avoid product badges. |
| “Consistent hashing means only a small amount of data moves.” | Mapping movement is small in ideal hash space; replicas still stream, repair, compact, and consume network/disk. | Separate mapping churn from physical rebalancing. |
| “Cassandra `R+W>RF` guarantees the balance.” | Overlap does not supply a ledger invariant, uniqueness, or arbitrary transaction semantics. | Use a purpose-built transactional/linearizable design or explicit reconciliation. |
| “CDC is exactly once if offsets are committed.” | Crash between sink effect and offset commit produces a duplicate; exactly-once requires an end-to-end transactional sink contract. | Require idempotent consumers and verify sink semantics. |
| “Snowflake is better than UUID.” | It can be compact/orderable but leaks time and needs worker/clock coordination. | Choose from locality, privacy, offline generation, collision, and shard routing requirements. |

## Negative evidence and anti-patterns

- Do not place user reads on a replica and add a fixed 100 ms sleep after writes; measure and carry a visibility token or use an authoritative read.
- Do not call all replication acknowledgments “durable” without distinguishing local flush, remote receive, remote flush, and remote replay.
- Do not add nodes to a Cassandra/Scylla ring with bootstrap/repair flags copied from another release; verify the exact version and topology tool.
- Do not run cleanup/removal before streaming and repair convergence is proven; a range metadata change is not data recovery.
- Do not shard on a low-cardinality or naturally hot key, and do not hide scatter-gather cost behind a generic repository.
- Do not assume a consistent-hash ring solves tenant moves, cross-shard transactions, secondary indexes, or hot partitions.
- Do not publish the same business event through an application dual write and CDC without a deduplication contract; consumers will see two identities or two orderings.
- Do not treat Debezium outbox routing as a guarantee that a downstream side effect completed.
- Do not use multi-primary for balances merely because it reduces write latency; first define conflict semantics and legal/accounting invariants.
- Do not fix ORM N+1 by globally enabling eager loading; it can turn one query into a wide cartesian graph and exhaust the pool.

## Operational, security, observability, and testing concerns

- **Replication:** alert on transport, write/flush/replay lag, oldest missing WAL/binlog position, promotion timeline, fencing state, and read-routing errors. A single “lag seconds” gauge is not enough.
- **Sharding:** record shard-map version, per-shard p95/p99, hot-key distribution, cross-shard query count, rebalance bytes, throttling, and cutover checksums. Keep a migration pause/rollback switch.
- **Cassandra/Scylla:** monitor ownership, pending ranges, bootstrap/stream progress, hints, repair age, tombstones, disk, compaction, clock skew, and consistency errors. Validate per-key endpoints and repair history before declaring recovery.
- **CDC:** measure source-to-sink lag, connector task state, offsets, duplicates, tombstones, schema history, dead-letter/replay count, and sink idempotency. Keep PII deletion and retention propagation visible.
- **Security/privacy:** encrypt node/replica/connector links, isolate tenant keys, restrict topology and offset access, redact payloads, and evaluate whether Snowflake/UUIDv7 timestamps reveal creation time or worker information.
- **Testing:** inject primary crash at each acknowledgment point, replica delay, split-brain routing, stale read, shard-map race, node bootstrap failure, CDC duplicate/out-of-order/tombstone replay, and ORM collection cardinality. Test the exact client driver and managed service, not only a local mock.

## Duplicate / canonical ownership

| Repeated subject | Canonical dossier | Boundary |
| --- | --- | --- |
| Queue ordering/redelivery/consumer backpressure | [08-message-queue.md](08-message-queue.md) | This topic only covers CDC as a scaling/data-propagation concern. |
| Outbox, Saga, idempotency, distributed transaction | [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md) | Link to the workflow proof; do not redefine it here. |
| Concrete order/outbox crash windows | [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md) | Case study owns the end-to-end sequence. |
| Query plans, N+1 diagnosis, pools, batch/fetch | [18-query-optimization.md](18-query-optimization.md) | Keep only topology-related consequences here. |
| Architecture boundary/modular monolith | [12-architecture-patterns.md](12-architecture-patterns.md) | Shard/service boundary is not automatically a bounded context. |
| DDD context/aggregate ownership | [24-domain-driven-design.md](24-domain-driven-design.md) | Use its language for ownership/invariants. |

## Current-vs-proposed content gaps

1. Replace the three-mode replication table with an acknowledgment-stage table (`local flush`, `remote receive`, `remote flush`, `remote apply`) and provider/version examples.
2. Add a read-freshness contract template: source, token/LSN, max staleness, routing, failover behavior, and user-visible fallback.
3. Separate mapping rehash from physical streaming/repair and provide a versioned reshard cutover sequence.
4. Qualify exact Cassandra/Scylla commands and flags; add “do not copy across versions” warnings and repair/cleanup prerequisites.
5. Convert CAP/PACELC product labels into operation-level scenarios and state which guarantee is sacrificed during a partition.
6. Remove or scope exact vnode, Snowflake bit/throughput, and replica-count examples unless they are labelled as implementation examples.
7. Add CDC crash windows, duplicate/tombstone/schema evolution, replay and sink-idempotency sections; link generic Outbox to topics 08/09/15.
8. Move N+1 implementation details to topic 18 and retain a short cross-reference plus a query-count test requirement.
9. Add security, PII deletion, tenant isolation, observability, and failure-injection questions in both languages.

## EN/VI and cross-reference plan

Preserve all 11 IDs and section order. Translate `acknowledgment point`, `visibility token`, `replay`, `fencing`, `repair`, `bootstrap`, `tombstone`, and `quorum` consistently; keep product commands and configuration names unchanged. Tables should be semantically identical in EN/VI. Avoid translating `strong consistency` into a generic “data always correct”; retain the exact guarantee and its scope.

## Integration record (Batch D scope)

- [x] Added `06-db-scaling.sharding-partitioning.q8` in EN/VI to define workload-shaped shard keys, hot-key/tenant trade-offs, and a checkpointed migration gate.
- [x] Kept replication, CDC, provider/version, repair, lag, and failure-boundary evidence source-scoped; no universal CAP or exactly-once claim was added.
- [ ] The broader local audit of every topology command, managed-service default, and restore/failover drill remains a follow-up.

## Open questions and falsifiers

- Which exact MySQL/PostgreSQL/Cassandra/Scylla/managed-service versions and topology are in scope? Any recommendation about sync mode, bootstrap, repair, or read concern is falsified for a deployment outside that scope.
- What is the business RPO for an acknowledged booking/ledger write, and which acknowledgment point satisfies it? If a failover drill loses more or less than the stated window, update the contract.
- What freshness budget is acceptable per read route? A primary-stickiness recommendation is falsified if it exceeds latency/cost budgets or cannot survive failover.
- What is the shard-key distribution, 99.9th-percentile hot-key load, and cross-shard query rate? A shard key is falsified by observed hotspots or unacceptable scatter-gather.
- What guarantees does the exact CDC connector/sink provide on crash between side effect and offset commit? If end-to-end exactly-once cannot be proven, retain at-least-once plus idempotency.
- What deletes/PII must propagate to every replica, search index, cache, warehouse, and backup? A CDC design is incomplete until deletion and retention are testable.
- Does the domain require linearizability, serializability, monotonic reads, or only bounded staleness? A CAP/PACELC classification is invalid if it does not name the operation and invariant.

## Sources

Source ledger. Tier `T1` = standard/original paper; `T2` = official implementation/reference documentation; `T3` = first-party engineering report. All entries reviewed on 2026-08-23. Duplicate language pages, vendor-neutral CAP charts, unsourced benchmark claims, and SEO explainers were screened out.

| ID | URL / title | Organization | Tier | Version / revision | Claims supported |
| --- | --- | --- | --- | --- | --- |
| S01 | [MySQL Replication](https://dev.mysql.com/doc/refman/8.4/en/replication.html) | MySQL | T2 | 8.4 Reference Manual | Async default, semi-sync acknowledgment scope, NDB distinction. |
| S02 | [Synchronous Replication](https://www.postgresql.org/docs/current/warm-standby.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Streaming/synchronous standby modes, `remote_apply`, lag positions. |
| S03 | [High Availability, Load Balancing, and Replication](https://www.postgresql.org/docs/current/high-availability.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | PostgreSQL HA topology and failure boundaries. |
| S04 | [MySQL Group Replication](https://dev.mysql.com/doc/refman/8.4/en/group-replication.html) | MySQL | T2 | 8.4 | Single-primary/multi-primary, membership, certification/failover. |
| S05 | [Monitoring Replication](https://www.postgresql.org/docs/current/monitoring-stats.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | WAL/standby monitoring and metric scope. |
| S06 | [Streaming Replication Protocol](https://www.postgresql.org/docs/current/protocol-replication.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Replication positions and protocol-level visibility. |
| S07 | [MySQL Group Replication Consistency Guarantees](https://dev.mysql.com/doc/refman/8.4/en/group-replication-consistency-guarantees.html) | MySQL | T2 | 8.4 | Group replication consistency modes and client behavior. |
| S08 | [MySQL Group Replication Write Concurrency](https://dev.mysql.com/doc/refman/8.4/en/group-replication-summary.html) | MySQL | T2 | 8.4 | Certification/order and multi-primary conflict scope. |
| S09 | [Dynamo-style consistency](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) | Apache Cassandra | T2 | Current project docs | Consistency levels, `R+W>RF` intuition, repair, timestamps/LWW. |
| S10 | [Topology Changes](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/topo_changes.html) | Apache Cassandra | T2 | Current project docs | Bootstrap, streaming, replacement and repair safety. |
| S11 | [nodetool bootstrap](https://cassandra.apache.org/doc/latest/cassandra/managing/tools/nodetool/bootstrap.html) | Apache Cassandra | T2 | Current project docs | Bootstrap monitoring and operational state. |
| S12 | [Read Repair](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/read_repair.html) | Apache Cassandra | T2 | Stable project docs | Read-repair limitations and convergence scope. |
| S13 | [Data Modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html) | Apache Cassandra | T2 | Current project docs | Query-driven partition-key design and denormalization. |
| S14 | [Dynamo: Amazon’s Highly Available Key-value Store](https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store) | Amazon Science | T1/T3 | Original paper page, 2007 | Consistent hashing, versioning, availability/conflict trade-off. |
| S15 | [Announcing Snowflake](https://blog.x.com/engineering/en_us/a/2010/announcing-snowflake) | X/Twitter Engineering | T3 | 2010 first-party post | Time/worker/sequence identifier design and trade-offs. |
| S16 | [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html) | IETF | T1 | May 2024 | UUIDv4/v7 format and timestamp/security implications. |
| S17 | [Consistency Tradeoffs in Modern Distributed Database System Design](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf) | Daniel Abadi | T1 | PACELC paper, 2012 | PACELC model and limits of CAP-only framing. |
| S18 | [CAP Twelve Years Later](https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/) | Eric Brewer / InfoQ | T3 | 2012 primary-author essay | CAP terminology and the need to avoid database badges. |
| S19 | [DynamoDB Read Consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html) | AWS | T2 | Current docs reviewed 2026-08-23 | Product-specific strong/eventual/transactional read modes. |
| S20 | [Raft project and paper](https://raft.github.io/) | Raft authors | T1 | Project/original paper | Leader, log, term, quorum, membership assumptions. |
| S21 | [In Search of an Understandable Consensus Algorithm](https://www.usenix.org/node/184041) | USENIX / Raft authors | T1 | USENIX ATC 2014 | Consensus safety and failure model. |
| S22 | [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) | Debezium / Red Hat | T2 | Stable docs reviewed 2026-08-23 | Outbox routing, key/payload, schema/tombstone/snapshot behavior. |
| S23 | [Debezium Delivery Guarantees](https://debezium.io/documentation/reference/stable/architecture.html) | Debezium / Red Hat | T2 | Stable architecture docs | Connector offsets, replay and delivery/recovery scope. |
| S24 | [Kafka Message Delivery Guarantees](https://kafka.apache.org/documentation/#semantics) | Apache Kafka | T2 | Current documentation | At-most/at-least/exactly-once terminology and transaction boundary. |
| S25 | [Hibernate ORM User Guide](https://docs.hibernate.org/orm/6.6/userguide/html_single/) | Hibernate project | T2 | 6.6 guide, reviewed 2026-08-23 | Fetching, batch fetching, JDBC batching, query-shape limitations. |
| S26 | [Hibernate `@BatchSize`](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/annotations/BatchSize.html) | Hibernate project | T2 | Current Javadocs | Batch fetch reduces round trips but is not a universal N+1 fix. |
| S27 | [The Part-Time Parliament](https://www.microsoft.com/en-us/research/publication/part-time-parliament/) | Leslie Lamport / Microsoft Research | T1 | Original Paxos paper, 1998 | Consensus terminology and quorum assumptions. |
| S28 | [DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html) | AWS | T2 | Current docs | Product-specific change stream ordering/retention scope. |
| S29 | [ScyllaDB Topology Changes](https://opensource.docs.scylladb.com/stable/operating-scylla/procedures/cluster-management/adding-nodes-to-a-cluster.html) | ScyllaDB | T2 | Stable Scylla docs | Provider/version distinction from Apache Cassandra operations. |
| S30 | [Cassandra Repair](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/repair.html) | Apache Cassandra | T2 | Current project docs | Anti-entropy repair and convergence/recovery obligations. |

## Discovery exclusions

The pool excluded CAP/BASE infographics, copied Cassandra bootstrap tutorials, generic “Kafka exactly once” claims without a sink boundary, ID benchmarks without clock/worker assumptions, and ORM blog posts that did not distinguish join fetch from batch fetch. Cassandra and Scylla pages were not merged into one guarantee: commands and topology behavior remain provider/version-specific.
