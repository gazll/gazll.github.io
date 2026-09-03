# Research — DB core, indexes, locks, and transactions

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `05-db-core-index-lock`
EN file: `public/data/topics/05-db-core-index-lock.json`
VI file: `public/data/topics/05-db-core-index-lock.vi.json`

## Scope and non-goals

This record audits the database-engine fundamentals in the local topic: index structures and layout, MVCC and isolation, lock behavior, deadlocks, schema constraints, and the B+Tree/LSM choice. It is the canonical research record for local database correctness and storage-engine mechanics.

It does not own query-tuning workflow, plan-regression operations, connection-pool sizing, or bulk-job design; those belong to topic 18. Replication, sharding, and CDC belong to topic 06. Engine selection belongs to topic 07. Cross-service transactions belong to topic 09, and aggregate boundaries/optimistic concurrency are cross-referenced to topic 24.

The local examples use MySQL/InnoDB and PostgreSQL. Guarantees below are therefore provider- and version-scoped; an application must verify the exact managed-service configuration before treating a statement as a contract.

Evidence-policy note: a discovery ceiling of 200 candidates was available for this broad/high-risk unit. The selected ledger keeps only distinct standards, official manuals, original papers, and first-party operational evidence; duplicate version mirrors, SEO summaries, and unsupported benchmark claims were not promoted.

## Local content map

The complete EN and VI files were read. Structural parity check on 2026-08-23 found three sections and 18 matching item IDs in each language; every item has a non-empty answer. The Vietnamese section titles are translations, not alternate units. The exact IDs are:

| Section | Exact item IDs | Local emphasis |
| --- | --- | --- |
| Indexes: what they really are | `05-db-core-index-lock.indexes-what-they-really-are.q1` … `.q7` | Index families, B+Tree pages/splits, clustered and secondary indexes, composite/covering indexes, unused indexes, selectivity, UUID locality. |
| Transactions, MVCC, locking | `05-db-core-index-lock.transactions-mvcc-locking.q1` … `.q9` | Isolation anomalies/defaults, InnoDB and PostgreSQL MVCC, record/gap/next-key locks, deadlocks, EXPLAIN, LSM, ACID internals, isolation selection. |
| Modelling the schema | `05-db-core-index-lock.modelling-the-schema.q1` … `.q2` | Constraints versus application checks and hard-to-reverse schema decisions. |

The source text is strong as a teaching outline. It sometimes compresses implementation details into universal rules: B+Tree fan-out and page-fill numbers, MySQL/PostgreSQL default behavior, UUID recommendations, “fintech usually uses” isolation, and the relationship between an index type and a workload. Those are the main revision targets.

## What is correct and reusable

- An index is a maintained access path with storage, write, vacuum/compaction, and cache costs; it is not free read acceleration.
- InnoDB’s primary key is clustered and secondary entries contain the primary-key value. A long primary key can therefore multiply secondary-index space; this is an engine-specific fact, not a property of every SQL database.
- A composite B+Tree is ordered by its leading key columns. The useful prefix and the point at which a range predicate stops later-key ordering must be explained with an actual plan, not a slogan.
- MVCC makes ordinary reads and locking reads different operations. “The query saw a snapshot” does not imply that it reserved the rows that were read.
- Deadlock detection/retry is a normal correctness path for transactional applications. A retry must repeat the complete idempotent transaction, not only the failed statement.
- Database constraints are part of the invariant boundary. Application validation improves user feedback but cannot replace a unique, foreign-key, check, or exclusion constraint where the invariant must survive concurrency.
- UUIDv4, UUIDv7, sequences, and natural keys have different locality, privacy, migration, and collision properties. The topic is right to ask for measurement rather than one universal key type.

## Claims to verify or qualify

| Claim from local content | Classification | Evidence | Scope / limitation | Confidence |
| --- | --- | --- | --- | --- |
| B+Tree supports equality, range, and ordered access; hash indexes are equality-oriented. | Verified fact | [S01], [S12], [S13] | Exact capabilities and optimizer use vary by engine/version. “O(1)” for a hash index should not be used as a latency guarantee. | High |
| LSM trees trade compaction and read/space amplification for write-oriented behavior. | Verified fact | [S21], [S22], [S23] | Actual performance depends on compaction policy, workload, media, cache, and configuration. | High |
| InnoDB clusters table rows by the primary key and stores the PK in secondary entries. | Verified fact | [S01], [S08] | MySQL/InnoDB 8.4 documentation; not a generic SQL rule. | High |
| Every additional index increases write/storage/maintenance work. | Verified fact | [S03], [S12] | Magnitude depends on index width, write mix, page density, vacuum/compaction, and cache. | High |
| “Three B+Tree levels can hold about one billion rows” and specific fan-out/page-fill percentages. | Unresolved / over-absolute | [S24] explains B-tree organization, but does not verify the local numeric example. | Fan-out is a function of page size, key/pointer width, fill factor, row format, compression, and engine. Remove exact numbers or label them as a reproducible toy model. | High that the local number is not portable |
| InnoDB secondary lookup can require a clustered-record lookup; a covering index can avoid it. | Verified fact | [S01], [S08] | Whether the plan is covering is query- and optimizer-dependent. PostgreSQL uses a different heap/index model and index-only scans have visibility-map conditions. | High |
| Leading-column rules matter for composite indexes, but PostgreSQL may use skip-scan in some distributions. | Verified, needs nuance | [S13], [S14] | Skip-scan is an optimizer choice, not permission to ignore column order. MySQL behavior differs by release and access path. | High |
| `EXPLAIN ANALYZE` reveals actual row counts but executes the statement. | Verified fact | [S11], [S15] | PostgreSQL wording; DML must be isolated/rolled back or explained without execution. MySQL uses different syntax/fields. | High |
| InnoDB uses undo/read views and locking reads; PostgreSQL uses tuple-version MVCC and vacuum. | Verified fact | [S06], [S07], [S16], [S17] | Internal details and visibility behavior differ by version. Long transactions have different cleanup consequences but can harm both engines. | High |
| InnoDB default isolation is commonly `REPEATABLE READ`; PostgreSQL default is `READ COMMITTED`. | Verified for documented defaults | [S05], [S18] | Defaults can be changed by driver, pool, session, managed service, or framework. The application should assert its setting. | High |
| InnoDB next-key/gap locks and PostgreSQL row locks are not interchangeable concepts. | Verified fact | [S05], [S16] | Lock range, predicate, and isolation behavior must be stated per provider. Missing/weak indexes can widen the locked search. | High |
| UUIDv7 is generally more insertion-local than UUIDv4 because it carries time-ordered bits. | Verified format fact plus inference | [S19], [S20] | RFC 9562 defines the format; locality benefit is an engineering inference and depends on generator ordering, concurrency, index, and clock behavior. It also exposes time information. | Medium-high |
| “Fintech should use RC/RR rather than SERIALIZABLE” is a safe default. | Recommendation, not fact | [S05], [S18] | Isolation must be derived from invariants and measured contention. Serializable transactions can be appropriate for a bounded workflow if retries and throughput are designed. | Medium |
| Constraint-first schema design and expand/contract migration reduce race conditions and deployment risk. | Recommendation supported by practice | [S02], [S09], [S10], [S18] | Migration tooling, lock duration, replicas, and rollback strategy still determine safety. | Medium-high |

## Workload, invariants, and failure model

| Workload / invariant | Preferred mechanism | Failure or crash window | Recovery / proof obligation |
| --- | --- | --- | --- |
| Unique booking reference or idempotency key | Unique constraint, one transaction, explicit duplicate-error mapping | Two writers pass application validation before either commits | Let one database commit win; treat duplicate-key as an idempotent result where the business contract permits. Test concurrent writers. |
| Balance cannot become negative | Row/aggregate lock or versioned conditional update plus a database constraint where expressible | Process dies after lock acquisition; deadlock victim; retry after partial external work | Roll back local transaction; retry the entire operation with the same idempotency key. Never retry a non-idempotent side effect blindly. |
| Seat/resource hold has an expiry | Atomic conditional update with an indexed owner/resource/status/time predicate | Worker dies after claiming; clock skew or delayed cleanup | A reaper must be idempotent; the authoritative transaction decides whether the hold is still valid. Locking alone is not a lease. |
| Read-your-own-write | Read from primary or use a provider-specific commit position/LSN gate | Failover moves the session to a node without the commit | Establish the required visibility token or fall back to the authoritative node; do not infer freshness from wall-clock delay. |
| Long report/read transaction | Snapshot/replica/OLAP path, bounded transaction | Snapshot retains old versions; vacuum/undo purge is delayed; writer conflicts or bloat grow | Set statement/idle-in-transaction timeouts, monitor oldest transaction age, and cancel/re-route long reads. |
| Concurrent updates to the same hot row | Short transaction, deterministic lock order, optimistic version or serialized queue | Deadlock or hot-row queueing; retry storm | Bound retries with jitter, collect deadlock graphs, and measure contention before sharding a counter. |
| Index creation/change on a live table | Online/concurrent DDL appropriate to provider | Metadata lock, invalid/partial index, long build, replica lag | Preflight size/lock impact, observe progress, validate index, and retain a rollback/removal plan. |
| Crash during commit | Redo/WAL durability settings and synchronous commit policy | Acknowledged commit may not be on a remote replica; relaxed local flush can lose recent commits on host loss | State the durability contract explicitly; test failover and loss window. ACID at one engine is not distributed durability. |

### Invariant model

Before selecting an isolation level or index, name the invariant, its owner, and its observation point: `(resource, time-window) is held at most once`, `ledger entries sum to balance`, or `idempotency_key maps to one result`. Then identify whether the proof needs a unique constraint, a row/range lock, a conditional write, a serializable retry, or an asynchronous reconciliation process. “Use a stronger isolation level” is not a substitute for an invariant model.

## Best-practice comparison

| Decision | InnoDB / MySQL 8.4 | PostgreSQL 18 docs | LSM implementation such as RocksDB | Research conclusion |
| --- | --- | --- | --- | --- |
| Primary storage layout | Clustered PK; secondary entries carry PK. | Heap plus separate indexes; index-only scans need visibility information. | Sorted immutable files plus memtables and compaction. | Explain the physical consequence of the chosen engine; do not transfer InnoDB advice to PostgreSQL unchanged. |
| Default transaction behavior | `REPEATABLE READ` by default; consistent reads use read views; locking reads have lock semantics. | `READ COMMITTED` by default; each statement normally gets a snapshot. | Not a relational transaction/isolation substitute; API guarantees are implementation-specific. | Choose based on invariant and provider contract, then verify with concurrency tests. |
| Composite index | Ordered key parts and included PK; descending/covering features are version-specific. | Multicolumn indexes, `INCLUDE`, partial/expression indexes; skip-scan may apply. | Key/prefix design and bloom/filter/compaction settings, not a SQL composite-index analogue. | Keep “leftmost prefix” as a useful heuristic with a provider caveat and a plan example. |
| Random versus time-ordered IDs | Random clustered PKs can cause page churn; short PKs reduce secondary width. | Random UUIDs do not cluster heap rows; indexes still have locality and bloat effects. | Key distribution affects memtable/SSTable behavior and compaction. | UUIDv7 is a candidate, not a default; check privacy, clock, migration, and observed write amplification. |
| Deadlock response | InnoDB detects and aborts a victim; application retries. | PostgreSQL can raise serialization/deadlock errors; transaction must be retried. | Engine-specific conflict/compaction/backpressure behavior. | Retry complete idempotent units and preserve a deterministic lock order. |

## Coverage matrix

| Required evidence area | Current local coverage | Evidence quality | Proposed treatment |
| --- | --- | --- | --- |
| Definitions | Index families, MVCC, ACID, locks, constraints | Good teaching coverage; some “default” language is broad | Add provider/version labels and distinguish physical index from search-engine index. |
| Invariants | Constraint examples and account/booking examples | Good intent, but examples are not formal proofs | Add invariant → constraint/lock/version mechanism table. |
| Workload model | OLTP, OTA, write-heavy LSM, warehouse bitmap | Useful but mostly qualitative | Add read/write ratio, hot-key, range, skew, and freshness dimensions. |
| Failure / crash windows | Deadlocks, long transactions, replica durability mention | Partial | Add crash-after-commit, stale snapshot, DDL lock, and retry-storm windows. |
| Retries / timeouts | Deadlock/serialization retry appears | Needs end-to-end idempotency and deadlines | State retry boundary, jitter, attempt budget, and transaction timeout. |
| Operations / recovery | EXPLAIN and lock inspection examples | Good starting point; lacks runbooks | Add `data_locks`/transaction age, vacuum/undo, index build, WAL/redo and failover drills. |
| Security / privacy | Sparse | Insufficient | Add least-privilege DDL, sensitive data in indexes/logs, UUIDv7 timestamp leakage, and query redaction. |
| Testing | Concurrent transaction examples implied | Insufficient | Add deterministic race/deadlock tests, isolation matrix, crash/failover tests, and plan-shape regression. |
| Domain trade-offs | OTA and fintech examples | Recommendations need qualification | Keep examples as workload hypotheses; require domain invariant and RTO/RPO evidence. |

## Contradictions and limits

| Local simplification | Competing guarantee / limit | Resolution |
| --- | --- | --- |
| “B+Tree is the default and best balanced choice.” | Many engines use B-tree variants, but hash, BRIN, GiST/GIN, bitmap, inverted, and LSM paths solve different access patterns. | Say “common general-purpose choice for relational OLTP,” then name the access pattern and engine. |
| “A snapshot prevents phantom rows.” | PostgreSQL repeatable-read semantics and InnoDB consistent reads differ from locking reads; predicate protection is not a generic MVCC property. | Separate snapshot visibility from predicate/range locking and serializable validation. |
| “Serializable is usually unnecessary for fintech.” | Strong isolation may be required for a specific invariant; lower isolation plus explicit constraints can also be correct. | Make it an invariant-driven recommendation with contention/retry measurements. |
| “Random UUIDs fragment the database.” | The effect differs between clustered InnoDB rows, PostgreSQL heap/index behavior, UUID representation, concurrency, and storage. | Keep the qualitative risk, remove portable percentages, and require a benchmark. |
| “A covering index makes the query fast.” | It can reduce heap/clustered lookups but increases write/storage cost and may not satisfy visibility or selectivity needs. | Verify `EXPLAIN`, row width, cache, and write budget. |
| “ACID means committed data is safe everywhere.” | Local durability settings and asynchronous replication create a remote-loss window. | Specify the durability boundary and failover contract. |

## Negative evidence and anti-patterns

- Do not add indexes by column popularity alone; a low-selectivity or write-heavy index can increase cost without reducing meaningful work.
- Do not use `SELECT *`, leading-wildcard predicates, implicit casts, or functions on the indexed side and then conclude that “the index is broken”; first inspect the actual plan (deep query-remediation belongs to topic 18).
- Do not use `SHOW ENGINE INNODB STATUS` or a single lock snapshot as proof that a race cannot occur; they are observations, not a correctness proof.
- Do not hold a database transaction while making a network call, waiting for a user, or doing unbounded work.
- Do not retry only the last SQL statement after a deadlock/serialization failure; the transaction snapshot and prior writes are gone.
- Do not create a surrogate key and omit a natural uniqueness constraint when the business invariant is uniqueness.
- Do not treat a soft-delete flag, JSON payload, or application enum as a complete schema design; define uniqueness, validation, migration, and retention semantics.
- Do not reorder UUIDv4 bytes as an undocumented “optimization”; if time order is required, use a documented format/generator and account for timestamp disclosure.
- Do not tune `innodb_flush_log_at_trx_commit` or PostgreSQL `synchronous_commit` for latency without recording the acknowledged-commit loss window and running a failure drill.

## Operational, security, observability, and testing concerns

- **Observability:** capture normalized query identity, plan hash/shape, actual versus estimated rows where safe, lock wait/deadlock events, oldest transaction age, undo/vacuum pressure, WAL/redo flush latency, index build progress, and duplicate/serialization retry counts. Redact values and secrets.
- **Operations:** establish per-operation statement/lock/idle-in-transaction timeouts; monitor connection saturation separately from lock contention; schedule statistics maintenance and validate schema/index changes on production-shaped data.
- **Recovery:** test host crash after local commit, primary failover before replica apply, deadlock retry, partial DDL, and long-transaction cancellation. Record RPO in seconds/LSN, not only “durable.”
- **Security/privacy:** restrict DDL and lock-inspection permissions; prevent sensitive fields from appearing in query logs, index definitions, EXPLAIN output, backups, and deadlock reports; treat UUIDv7 timestamps as metadata.
- **Testing:** use two or more concurrent sessions for lost-update/write-skew/phantom cases; test both configured isolation defaults and explicit transaction settings; use real engine containers for lock/MVCC semantics rather than H2-like substitutes; add plan regression tests for representative cardinality buckets.

## Duplicate / canonical ownership

| Topic | Canonical responsibility | Link / boundary |
| --- | --- | --- |
| Query plans and rewrites | Measurement, EXPLAIN workflows, parameter sensitivity, pools, pagination, bulk jobs | [18-query-optimization.md](../topics/18-query-optimization.md); topic 05 should explain mechanics and link out. |
| Replication, sharding, consensus, CDC | Topology and freshness/failover | [06-db-scaling.md](../topics/06-db-scaling.md). |
| SQL/NoSQL engine selection | Product capability and fit | [07-sql-nosql-db-engines.md](../topics/07-sql-nosql-db-engines.md). |
| Distributed transaction correctness | Outbox, Saga, idempotency, ledger workflow | [09-distributed-tx-fintech.md](../topics/09-distributed-tx-fintech.md); this topic owns only the local transaction primitive. |
| Broker and delivery semantics | Queue, consumer, ordering, redelivery | [08-message-queue.md](../topics/08-message-queue.md). |
| Outbox/order case | Concrete workflow and crash windows | [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md). |
| Aggregate/version semantics | DDD aggregate transaction boundary and optimistic version | [24-domain-driven-design.md](24-domain-driven-design.md). |

The repeated Saga/Outbox references should be one-sentence cross-links, not redefinitions. A local phrase such as “12.15” or “12.21” should be replaced by an exact item ID or a stable dossier link; the repository’s persistence key is the JSON `id`.

## Current-vs-proposed content gaps

1. Keep the index-family overview, but replace universal complexity and page-fill figures with a toy model clearly labelled as such, or remove them.
2. Add a provider table for InnoDB versus PostgreSQL: physical row layout, default isolation, ordinary read, locking read, deadlock/serialization error, and durability setting.
3. Split “snapshot prevents phantoms” into visibility, predicate locking, and serializable conflict detection.
4. Add an invariant-first decision sequence: constraint → conditional update/version → row/range lock → serializable only when justified, with retry boundaries.
5. Move detailed EXPLAIN/plan-tuning procedure to topic 18 and retain only a mechanics bridge.
6. Make UUIDv7 a candidate with benefits, timestamp/privacy cost, generator/clock caveat, and benchmark acceptance criteria.
7. Add schema migration safety: expand/contract, online/concurrent index behavior, rollback, and long-running transaction interaction.
8. Add negative examples for missing natural uniqueness, long transactions, network calls inside transactions, and non-idempotent retries.
9. Add explicit security and test questions to both language files; preserve all item IDs and section order.

## EN/VI and cross-reference plan

Keep the exact 18 IDs and answer structure in both languages. Translate the qualification words consistently: `fact`/`verified fact`, `recommendation`, `inference`, and `unknown`; do not turn a qualified English claim into a categorical Vietnamese sentence. Preserve code tokens, SQLSTATE/error codes, provider names, and links. Use the same comparison and invariant tables in both languages, with examples localized only in prose.

## Integration record (Batch D scope)

- [x] Added `05-db-core-index-lock.modelling-the-schema.q3` in EN/VI to define transactional authority, derived projections, CDC/outbox input, freshness, and rebuild boundaries.
- [x] Preserved all existing IDs, section order, and provider-specific index/MVCC evidence.
- [ ] The broader local audit of every schema/lock recommendation remains a follow-up; Topic 06 owns distributed topology and Topic 18 owns plan-level optimization.

## Open questions and falsifiers

- Which production engine/version and managed service are the target? A claim about isolation, synchronous commit, index build, or UUID support is falsified for this dossier’s scope if the deployment uses a different provider or driver default.
- What are the measured write/read mix, hot-key distribution, index sizes, p95/p99 latency, and page/cache behavior? A UUIDv7 recommendation is falsified if a production-shaped benchmark shows no material improvement or unacceptable timestamp/privacy cost.
- What exact invariant requires range/predicate protection rather than a unique/conditional write? A proposed lower isolation level is falsified by a concurrency test that permits a forbidden state.
- What is the allowed acknowledged-commit loss window during primary failure? The durability recommendation is incomplete until RPO and failover timeline are measured.
- Which schema migrations run online, and what is the largest table/oldest transaction during the change? The DDL advice is falsified by a staging test that cannot meet lock and replica-lag budgets.
- Which local numeric examples have benchmark artifacts (engine version, schema, page size, fill factor, hardware, dataset, workload)? Without them they remain teaching estimates, not facts.

## Sources

Source ledger. Tier `T1` = standard/original paper; `T2` = official implementation/reference documentation; `T3` = first-party engineering guidance. All entries were reviewed on 2026-08-23. The discovery pool intentionally excluded SEO explainers, reposts, duplicate language/version pages, and vendor marketing claims that did not add a guarantee or failure detail.

| ID | URL / title | Organization | Tier | Version / revision | Claims supported |
| --- | --- | --- | --- | --- | --- |
| S01 | [Clustered and Secondary Indexes](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html) | MySQL | T2 | 8.4 Reference Manual | InnoDB clustered PK, secondary PK payload, short-PK trade-off. |
| S02 | [Best Practices for InnoDB Tables](https://dev.mysql.com/doc/refman/8.4/en/innodb-best-practices.html) | MySQL | T2 | 8.4 | Short transactions, locking reads, FK/index practice. |
| S03 | [Optimization and Indexes](https://dev.mysql.com/doc/refman/8.4/en/optimization-indexes.html) | MySQL | T2 | 8.4 | Index read benefit versus insert/update/storage cost. |
| S04 | [Optimizing InnoDB Queries](https://dev.mysql.com/doc/refman/8.4/en/optimizing-innodb-queries.html) | MySQL | T2 | 8.4 | Primary-key width, covering-index and lookup considerations. |
| S05 | [Deadlocks in InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html) | MySQL | T2 | 8.4 | Victim rollback, lock order, retry, range-lock behavior. |
| S06 | [Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html) | MySQL | T2 | 8.4 | Read views and snapshot semantics. |
| S07 | [InnoDB Transaction Model](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-model.html) | MySQL | T2 | 8.4 | MVCC/undo and two-phase locking model. |
| S08 | [InnoDB Information Schema Transactions](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-transactions.html) | MySQL | T2 | 8.4 | Transaction/lock inspection and operational evidence. |
| S09 | [Online DDL Performance](https://dev.mysql.com/doc/refman/8.4/en/innodb-online-ddl-performance.html) | MySQL | T2 | 8.4 | DDL locking and concurrency risks. |
| S10 | [Constraint Handling](https://dev.mysql.com/doc/refman/8.4/en/constraints.html) | MySQL | T2 | 8.4 | Engine constraint behavior and schema invariant boundary. |
| S11 | [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Plan estimates, actual rows, loops, execution side effect. |
| S12 | [Indexes](https://www.postgresql.org/docs/current/indexes.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Index types, maintenance cost, usage examination. |
| S13 | [Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Leading columns, ordering, skip-scan qualification. |
| S14 | [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | INCLUDE, partial, concurrent, expression-index limits. |
| S15 | [EXPLAIN command](https://www.postgresql.org/docs/current/sql-explain.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | `ANALYZE` execution warning and options. |
| S16 | [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Defaults, isolation anomalies, serialization retry. |
| S17 | [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Row/table locks and lock-release behavior. |
| S18 | [SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Per-transaction isolation and read-only/deferrable scope. |
| S19 | [UUID data type](https://www.postgresql.org/docs/current/datatype-uuid.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Native UUID support and RFC 9562 relationship. |
| S20 | [RFC 9562: Universally Unique IDentifiers](https://www.rfc-editor.org/rfc/rfc9562.html) | IETF | T1 | May 2024 | UUIDv4/v7 layout, timestamp/randomness and security considerations. |
| S21 | [Compaction](https://github.com/facebook/rocksdb/wiki/Compaction) | Meta / RocksDB project | T2/T3 | Project wiki, reviewed revision | LSM compaction styles and read/write/space amplification. |
| S22 | [RocksDB Tuning Guide](https://github.com/facebook/rocksdb/wiki/RocksDB-Tuning-Guide) | Meta / RocksDB project | T2/T3 | Project wiki, reviewed revision | Compaction backlog, write amplification, workload tuning. |
| S23 | [RocksDB: Evolution of LSM-tree based storage](https://www.usenix.org/sites/default/files/fast21_full-proceedings-interior.pdf) | USENIX / RocksDB authors | T1/T3 | FAST 2021 proceedings | Research evidence for LSM design trade-offs. |
| S24 | [Organization and Maintenance of Large Ordered Indexes](https://rtheunissen.github.io/bst/docs/references/1972_bayer_mccreight.pdf) | Bayer and McCreight | T1 | Original B-tree paper, 1972 | B-tree page/height organization; does not verify local capacity figures. |
| S25 | [PostgreSQL Data Definition](https://www.postgresql.org/docs/current/ddl.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Declarative constraints and schema-level enforcement. |

The duplicate PostgreSQL UUID page was screened out of the selected ledger because S19 already covers the same document and claim.

## Discovery exclusions

Excluded candidates were generic “indexing tips” pages, copied CAP/ACID summaries, benchmark posts without reproducible schema/workload, duplicate MySQL/PostgreSQL language mirrors, and pages that asserted UUID or isolation superiority without provider/version details. They were not used as evidence.
