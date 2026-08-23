# Research — How Discord stored trillions of messages

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `13-how-discord-stores-trillions-of-messages`

EN file: `public/data/case-studies/articles/13-how-discord-stores-trillions-of-messages.html`

VI file: `public/data/case-studies/articles/13-how-discord-stores-trillions-of-messages.vi.html`

Metadata: the paired case-study metadata JSON and article files were read in full.

## Scope and evidence posture

This is a first-party Discord engineering case about a large append-heavy message history: MongoDB to Cassandra, operational pressure from hot partitions/compaction/GC, a Rust data service, migration to ScyllaDB, and a dual-write/checkpoint migration process. The article was published 2023-03-06 and reports a design/migration state around 2022. Its node counts, throughput, p99s, bucket sizing, and migration duration are Discord’s workload/hardware observations, not portable benchmarks or proof of Discord’s current 2026 architecture.

The discovery pool was about 50 candidates. The 25 selected sources below are Discord’s original report, Apache Cassandra documentation, ScyllaDB documentation, and operational/observability references. Video summaries, Wikipedia, Reddit, SEO explainers, and vendor marketing that added no distinct evidence were excluded.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `1-three-generations-of-storage` | MongoDB → Cassandra → Scylla history and scale progression. |
| `2-partitioning-solved-size-not-popularity` | Channel/bucket partitioning and hot-channel problem. |
| `3-why-operations-became-the-constraint` | Quorum reads, compaction/tombstones, backlog and JVM GC. |
| `4-the-data-service-control-point` | Rust stateless service, routing and coalesced same-row reads. |
| `5-choosing-scylladb-with-eyes-open` | Scylla trade-offs and first reverse-query issue. |
| `6-migrating-trillions-without-downtime` | Token-range migrator, SQLite checkpoints, dual writes and sampled comparisons. |
| `7-reported-results` | Discord-reported throughput, node counts, storage and latency changes. |
| `8-what-to-reuse-and-what-to-remeasure` | Lessons and anti-copying caveat. |

EN/VI structures are paired. Both need the same date/workload qualifiers and a clear separation between what Discord reported, what Cassandra/Scylla docs guarantee, and what this repository recommends for another system.

## What is correct and reusable

- Partitioning solves physical distribution but not hot-key popularity. A channel with disproportionate reads/writes can overload one partition/node even when total storage is balanced.
- LSM storage makes write path and read/compaction/tombstone behavior inseparable. Deletes and TTLs create tombstones; compaction and repair windows affect latency, disk and correctness.
- A stateless data service can provide a stable query contract, route consistently, bound pathological access, and coalesce identical in-flight reads without making the database itself horizontally magical.
- A Cassandra-compatible replacement is not a drop-in performance guarantee. Query shape, partitioning, consistency, driver/protocol, compaction, hardware, and operational expertise all matter.
- Large live migrations need a baseline, dual-write/read verification, checkpoints, bounded backfill, mismatch metrics, rollback/kill switch, and an explicit cutover authority.
- Reported performance should be read as evidence of a particular Discord workload and migration, not as a vendor-neutral benchmark.

## Claims to verify or qualify

| Local claim/shape | Classification | Required qualification |
| --- | --- | --- |
| Discord moved MongoDB → Cassandra → Scylla as scale grew | First-party historical fact | Date it: 2017/early 2022 migration narrative; do not imply current architecture or an inevitable technology ladder. |
| Channel plus static time bucket solves large-message partitions | Case design | Bucket size is workload-derived; retention, deletion, read range, hot-channel skew and maximum partition size need measurement. |
| Cassandra quorum reads/replication are reliable | Provider fact with trade-off | Consistency level, replication factor, topology, repair, hinted handoff and latency determine the observed guarantee. |
| JVM GC/compaction/tombstones caused operations to become the constraint | First-party diagnosis | Preserve as Discord’s report; confirm metrics/versions if reused as a causal claim outside the case. |
| Rust coalescing same-row reads improves p99 | Case implementation inference/report | Requires cache key correctness, cancellation/backpressure, bounded fan-in and workload distribution; not a general Rust advantage. |
| Scylla has no JVM GC and shard-per-core | Vendor/project fact | Scylla version, CPU, driver shard-awareness and workload determine outcome; no guarantee of lower p99 for every schema. |
| 3.2m msg/s, 72 vs 177 nodes, 9 days, p99 numbers | First-party reported metric | Scope to Discord’s hardware/configuration/time; no independent benchmark or current result. |
| Dual writes and sampled comparisons prove migration correctness | Strong migration practice, incomplete | Sampling can miss rare partitions; require deterministic range counts/checksums, shadow reads, mismatch repair and a rollback boundary. |
| 99.9999% was blocked on tombstone-heavy ranges | Case result | Explain what “blocked” means and that tail ranges/cleanup state are workload-specific. |

## Workload, invariants, and failure model

### Workload model

Record append/read ratio, message size distribution, hot-channel skew, retention/deletion/TTL, history pagination, search/index requirements, replication factor, consistency levels, region/rack topology, p99 target, repair/compaction capacity, driver version, migration write rate and allowable read/write divergence. “Trillions of messages” alone says little about partitions or service rate.

### Invariants

1. A message is addressable by a stable channel/bucket/message ordering key and its identity is not duplicated by migration.
2. A partition remains bounded enough for read/repair/compaction operations under the chosen workload.
3. Every replica/cluster operation preserves the declared consistency/availability contract; repair and tombstone windows are operated, not assumed.
4. A migration never silently loses or duplicates a message; mismatches are measurable and recoverable before cutover.
5. Read routing/coalescing cannot return data to the wrong channel/tenant or let unbounded fan-in exhaust the service.
6. Retention/deletion and moderation/privacy requirements remain enforceable in primary, replica, backup, and migration paths.
7. Operational load (compaction, repair, streaming, disk, CPU, GC where applicable) has budgets and alerts independent of application p99.

### Crash and failure windows

| Window | Possible result | Control |
| --- | --- | --- |
| Hot partition | Local saturation despite cluster headroom | Bucketing/sharding, admission, hot-key metrics, query limits. |
| Replica unavailable during write/read | Timeout, reduced consistency or stale result | Declared consistency level, retry budget, topology/repair and user-facing degradation. |
| Tombstone/compaction backlog | Read amplification, disk pressure, p99 tail | Table TTL/delete policy, compaction strategy, repair cadence, tombstone monitoring. |
| Data service coalescer overload | Head-of-line blocking or memory growth | Bounded fan-in, deadlines, cancellation, per-key limits and fallback. |
| Dual-write one-sided failure | Source/destination divergence | Durable retry, mismatch ledger, shadow reads and cutover gate. |
| Backfill worker crashes | Missing/duplicated range work | Token-range checkpoint idempotency, range ownership, restart/reconciliation. |
| Cutover before verification | Silent data loss/stale reads | Kill switch, staged traffic, sampled/deterministic verification and rollback. |
| Delete/TTL repair window missed | Zombie data resurrection | Repair before tombstone purge, tested retention and backup policy. |

## Best-practice comparison

| Choice | Strength | Cost/limit | Scope |
| --- | --- | --- | --- |
| Cassandra | Mature wide-column ecosystem and protocol; tunable consistency | JVM/compaction/repair operations and hot partition risks | Schema/query/topology-specific. |
| ScyllaDB | Cassandra-compatible model with shard-per-core architecture and no JVM heap | Compatibility/version/driver/operations and migration cost; vendor-specific behavior | Measured workload and supported feature set. |
| Custom data service | Stable API, routing, coalescing, guardrails, observability | Additional hop/state/routing correctness and operational ownership | Useful when database access patterns need protection. |
| Time/static bucketing | Bounds partition size and pagination work | Bucket boundary, hot recent bucket, cross-bucket query complexity | Append-heavy history; measure bucket size/skew. |
| Dual-write + shadow verification | Reversible migration and mismatch visibility | Double write load, divergence, read sampling gaps | Live migration with a rollback window. |
| Snapshot/backfill only | Simple bulk transfer | Misses concurrent writes unless change capture/dual-write covers them | Offline/maintenance window only. |

## Coverage matrix

| Gate area | Current coverage | Gap/proposed treatment |
| --- | --- | --- |
| Definitions | Strong case vocabulary | Define partition, bucket, token range, replica, quorum, SSTable, tombstone, compaction, repair. |
| Invariants | Partial | Add partition bound, migration equality, delete/repair and tenant/privacy invariants. |
| Workload | Partial | Label every Discord number and add a remeasurement worksheet. |
| Failure/crash windows | Strong direction | Add replica outage, compaction stall, checkpoint crash, cutover rollback and deletion resurrection. |
| Retries/timeouts | Partial | Add driver retry/consistency interaction, deadline propagation and no unbounded range retries. |
| Operations/recovery | Strong | Add compaction/repair/tombstone/disk/streaming/queue metrics and an operational runbook. |
| Security/privacy | Weak | Add message retention/deletion, moderation/legal hold, tenant authorization, encrypted backups and migration access. |
| Testing | Partial | Add partition skew, tombstone stress, node loss, repair, range restart, mismatch injection and rollback drills. |
| Domain trade-offs | Strong for chat history | Do not copy into financial/booking workloads where consistency and invariant ownership differ. |

## Contradictions and limits

| Tension | Why both can be true | Scope |
| --- | --- | --- |
| Availability versus consistency | Cassandra favors availability/partition tolerance with tunable consistency; quorum is not a global serializable transaction | RF, consistency level, topology and repair. |
| Static buckets versus hot recent bucket | Buckets bound size but newest bucket may concentrate all traffic | Channel skew and bucket duration. |
| Tombstone grace versus disk/latency | Retaining tombstones avoids zombies; retaining them too long increases compaction/read cost | Repair SLA, `gc_grace_seconds`/Scylla tombstone mode and failure duration. |
| Scylla compatibility versus identical behavior | Cassandra protocol/schema compatibility does not imply identical query plans, compaction or operational semantics | Exact versions/features/drivers. |
| Dual writes versus migration safety | Dual writes preserve new changes but double write load and can diverge | Idempotency, mismatch policy, source authority and rollback window. |
| Read coalescing versus freshness | Coalescing reduces duplicate work but can share a stale/error result | TTL/deadline/cancellation/error fan-in policy. |

## Negative evidence and anti-patterns

- Do not infer “trillions” means a system should choose a wide-column database; access pattern and invariant matter more than row count.
- Do not use a single unbounded channel partition or assume hashing removes hot-key skew.
- Do not delete tombstones aggressively without a repair/failure-duration proof.
- Do not treat quorum reads as strong consistency across all application effects or regions.
- Do not perform a live migration from a snapshot alone while writes continue.
- Do not call sampled shadow reads proof of equality without documenting sampling coverage and a deterministic mismatch repair path.
- Do not use a compatibility protocol claim as a reason to skip query/driver/compaction/load tests.
- Do not capture message contents in traces/metrics by default; chat history is sensitive retained data.

## Duplicate/canonical ownership

- This case owns Discord’s historical storage/migration narrative and the concrete partition/data-service/verification lessons.
- Topic 08 owns generic log/queue delivery semantics.
- Topic 20/25 owns generic observability/failure/overload mechanics; this case keeps storage-specific signals.
- Case 16 owns relational inventory contention; do not use this case to recommend Scylla for money/inventory invariants.
- Data privacy/retention should link to the project’s data governance topic rather than repeating legal policy here.

## Integration record (Batch C scope)

- [x] Added explicit historical/source scope and production deletion, backup, tenant-isolation, and authorization caveats.
- [x] Added hot-key versus bucket-size boundaries, bounded single-flight semantics, and a migration gate to both EN and VI.
- [ ] The broader storage-engine/version and current-system audit below remains a follow-up; reported Discord numbers stay source-scoped.

### Deferred broader audit items

- [ ] Add a visible “Discord report, published 2023; metrics around 2022” qualifier to both files.
- [ ] Mark 3.2m msg/s, node counts, p99s, 9-day migration and 99.9999% as reported measurements with hardware/configuration scope.
- [ ] Add a partition/replica/repair/tombstone glossary and failure table.
- [ ] Explain that static bucketing controls partition size but not popularity skew.
- [ ] Add a migration gate: dual write → backfill/checkpoint → shadow compare → staged reads → source cutover → rollback window.
- [ ] Add deletion/privacy/backup/tenant-isolation concerns to the operations section.
- [ ] Keep source-specific facts out of generic “best practice” prose and align EN/VI qualifiers.

## Open questions and falsifiers

- [ ] Does Discord’s 2023 article still describe the current system? If current architecture matters, a newer first-party source is required.
- [ ] What exact Cassandra/Scylla versions, RF/consistency, compaction strategy, hardware, and partition distributions produced the reported numbers? Without them, benchmark reuse is falsified.
- [ ] What is the maximum partition/bucket size and hot-channel percentile? If the proposed bucket exceeds operational limits, the design fails despite balanced total storage.
- [ ] What deterministic migration verification exists beyond sampled reads? A mismatch in an un-sampled range falsifies the sufficiency of the proposed gate.
- [ ] What deletion/moderation/retention obligations apply to replicas, backups and migration snapshots? If they cannot be enforced, the storage design is incomplete.
- [ ] Can repair and tombstone cleanup complete within the maximum node-outage window? If not, zombie resurrection/latency risk remains unresolved.

## Source ledger

All sources were reviewed on `2026-08-23`. `S1` is official project/vendor documentation; `S2` is first-party engineering guidance; `S3` is an official migration/implementation document.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | [How Discord Stores Trillions of Messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) — Discord Engineering | S2; published 2023-03-06; reports 2022-era state | MongoDB/Cassandra history, hot partitions, data service, Scylla selection/migration and all Discord-reported metrics. |
| S02 | [How Discord Stores Billions of Messages](https://discord.com/blog/how-discord-stores-billions-of-messages) — Discord Engineering | S2; historical 2017-era post | Earlier MongoDB/Cassandra migration, channel/bucket reasoning and historical workload context. |
| S03 | [Storage Engine](https://cassandra.apache.org/doc/stable/cassandra/architecture/storage-engine.html) — Apache Cassandra | S1; stable docs | Commit log, memtable, SSTable and read/write path. |
| S04 | [Compaction overview](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/compaction/overview.html) — Apache Cassandra | S1; stable docs | SSTable read amplification, compaction, TTL/delete tombstones and disk reclamation. |
| S05 | [Tombstones](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html) — Apache Cassandra | S1; current docs | Tombstone grace, zombie resurrection risk, repair dependency and TTL behavior. |
| S06 | [Unified Compaction Strategy](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/compaction/ucs.html) — Apache Cassandra | S1; stable docs | Read/write trade-offs, large SSTable/repair impact and tombstone options. |
| S07 | [Data modeling introduction](https://cassandra.apache.org/doc/stable/cassandra/developing/data-modeling/intro.html) — Apache Cassandra | S1; stable docs | Query-first partition/data-model design and partition-size reasoning. |
| S08 | [Cassandra guarantees](https://cassandra.apache.org/doc/stable/cassandra/architecture/guarantees.html) — Apache Cassandra | S1; stable docs | CAP/availability/consistency trade-off and scope of Cassandra guarantees. |
| S09 | [Hints](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/hints.html) — Apache Cassandra | S1; stable docs | Hints, read repair and anti-entropy repair as eventual-consistency mechanisms. |
| S10 | [Repair](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/repair.html) — Apache Cassandra | S1; stable docs | Repair is operational work, its I/O cost and consequences of missed repair. |
| S11 | [Read repair](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/read_repair.html) — Apache Cassandra | S1; stable docs | Read-path repair/speculative retry behavior and consistency limits. |
| S12 | [Hardware choices](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/hardware.html) — Apache Cassandra | S1; stable docs | Commitlog/SSTable I/O and compaction hardware considerations. |
| S13 | [Scylla system requirements](https://docs.scylladb.com/manual/stable/getting-started/system-requirements.html) — ScyllaDB | S1; current/manual stable | Shard-per-core architecture, CPU/storage requirements and sizing scope. |
| S14 | [CQL drivers](https://docs.scylladb.com/stable/drivers/cql-drivers.html) — ScyllaDB | S1; current docs | Driver support, shard-aware routing and version compatibility. |
| S15 | [Migration tools overview](https://docs.scylladb.com/manual/stable/using-scylla/mig-tool-review.html) — ScyllaDB | S1; current/manual stable | SSTable/CQL/Spark migration choices and their transformation/scale trade-offs. |
| S16 | [Apache Cassandra to ScyllaDB migration process](https://docs.scylladb.com/manual/stable/operating-scylla/procedures/cassandra-to-scylla-migration-process.html) — ScyllaDB | S3; current procedure | Schema, dual writes, snapshot/backfill, validation, mismatch tracking, throttling and migration limitations. |
| S17 | [Scylla CQL DDL/tombstone GC](https://docs.scylladb.com/manual/stable/cql/ddl.html) — ScyllaDB | S1; current/manual stable | Consistency-level read routing, tombstone GC/repair modes and out-of-order write limits. |
| S18 | [Scylla compaction](https://docs.scylladb.com/manual/stable/kb/compaction.html) — ScyllaDB | S1; current/manual stable | LCS/TWCS trade-offs, TTL patterns and tombstone/compaction write amplification. |
| S19 | [Scylla CQL native protocol](https://java-driver.docs.scylladb.com/stable/manual/core/native_protocol/) — ScyllaDB Java driver | S1; current driver docs | Cassandra protocol negotiation and feature/version compatibility during mixed clusters. |
| S20 | [Cassandra partitioners](https://cassandra.apache.org/doc/stable/cassandra/architecture/partitioners.html) — Apache Cassandra | S1; stable docs | Token/partition distribution and why key design affects routing/skew. |
| S21 | [Cassandra consistency levels](https://cassandra.apache.org/doc/stable/cassandra/developing/query-language/consistency.html) — Apache Cassandra | S1; stable docs | Read/write consistency-level scope and trade-offs. |
| S22 | [OpenTelemetry messaging conventions](https://opentelemetry.io/docs/specs/semconv/messaging/) — OpenTelemetry | S1; conventions 1.44.0 family | Correlating migration/read/write/message operations without default payload capture. |
| S23 | [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | S2; current web edition | Load/queue/backpressure/retry and failure-mode testing applicable to the data service. |
| S24 | [Rust async runtime](https://tokio.rs/tokio/tutorial) — Tokio project | S1; current tutorial | Async task/concurrency primitives used as implementation context; not evidence of Discord’s code or performance. |
| S25 | [Cassandra FAQ](https://cassandra.apache.org/doc/stable/cassandra/overview/faq/index.html) — Apache Cassandra | S1; stable docs | Disk/tombstone/repair caveats and consistency-level operational guidance. |

## Excluded discovery candidates

Video summaries, Reddit discussions and Wikipedia were used only to locate the original Discord post and then excluded from the evidence ledger. Scylla vendor material was retained for implementation/compatibility claims but cannot independently validate Discord’s reported benchmark numbers. No source was found that proves Discord’s architecture is current in 2026.

## Gate status

- [x] Complete EN/VI sections and metadata read.
- [x] First-party date/workload scope recorded.
- [x] Discovery pool broadened; selected ledger has 25 distinct sources.
- [x] Workload, invariants, crash windows, comparison, coverage, limits, anti-patterns and falsifiers recorded.
- [x] EN/VI parity and canonical ownership recorded.
- [ ] Current Discord architecture/source update verified.
- [ ] EN/VI content integration applied.
- [ ] Validation passed after integration.
