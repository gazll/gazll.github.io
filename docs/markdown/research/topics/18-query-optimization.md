# Research — Query optimization and database workload performance

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `18-query-optimization`
EN file: `public/data/topics/18-query-optimization.json`
VI file: `public/data/topics/18-query-optimization.vi.json`

## Scope and non-goals

This record audits the local query-optimization topic: measure-first diagnosis, execution plans, statistics/cardinality, joins, plan regression and parameter sensitivity, PostgreSQL buffers/checkpoints, sargability, counting/pagination, aggregation/materialized views/OLAP, connection pools/timeouts/batching, and bulk jobs.

It is the canonical operational/performance record for query shape and database workload behavior. Index/lock/MVCC fundamentals belong to [05-db-core-index-lock.md](05-db-core-index-lock.md). Replication, sharding, and CDC belong to [06-db-scaling.md](06-db-scaling.md). Engine capability comparisons belong to [07-sql-nosql-db-engines.md](07-sql-nosql-db-engines.md). ORM architecture boundaries belong to [12-architecture-patterns.md](12-architecture-patterns.md).

The local material is written mainly for PostgreSQL, MySQL, SQL Server, Oracle, Hibernate, and HikariCP. Optimizer behavior, defaults, plan-cache rules, and metrics are provider/version-specific. Any benchmark number or pool formula must remain an example until reproduced on production-shaped data.

Evidence-policy note: a discovery ceiling of 200 candidates was available for this broad/high-risk unit. The selected ledger keeps official optimizer/framework documentation, standards/APIs, and first-party operational guidance that adds distinct evidence; generic tuning lists, duplicate explainers, and benchmark charts without workload details were excluded.

## Local content map

The complete EN and VI files were read. Structural parity check on 2026-08-23 found two sections and 12 matching item IDs in each language; every item has a non-empty answer.

| Section | Exact item IDs | Local emphasis |
| --- | --- | --- |
| Measure first — reading the execution plan | `18-query-optimization.measure-first-reading-the-execution-plan.q1` … `.q7` | Slow-query process, EXPLAIN ANALYZE, join/order, plan regression, parameter sensitivity, PostgreSQL buffers, shared buffers/checkpoints/bgwriter/full-page writes. |
| Rewriting the query & reshaping the model | `18-query-optimization.rewriting-the-query-reshaping-the-model.q1` … `.q5` | Sargability, COUNT/pagination, aggregation/materialized view/OLAP, pools/timeouts/batch/fetch, bulk jobs/queues. |

The local sequence “measure → inspect plan → form hypothesis → change one thing → remeasure” is reusable. The main risks are: treating `EXPLAIN ANALYZE` as a read-only operation, relying on a global cache-hit ratio, presenting PostgreSQL 18 behavior as all-version behavior, using Hikari’s pool formula as a law, recommending keyset pagination without a stable ordering contract, and treating a faster query as a better system without lock, freshness, cost, or correctness measurements.

## What is correct and reusable

- Start from workload evidence: total time and tail latency, frequency, rows/bytes, waits/locks, error/retry rate, and production-shaped parameters. Mean latency alone hides the incident.
- An execution plan is a tree of access and join operators. Compare estimated versus actual rows, loops, time, buffers/I/O, sort/hash spills, and whether the result shape matches the workload.
- A plan regression can arise from changed data distribution, stale/correlated statistics, bloat, parameter-sensitive cardinality, version/configuration changes, or resource pressure—not only a missing index.
- Sargability is about preserving an indexed search representation; function/expression indexes can be correct alternatives when their immutability/collation/type semantics are explicit.
- Keyset pagination needs a total/stable order and an opaque cursor contract. `(created_at, id)` is an example, not a universal ordering.
- Exact `COUNT(*)` can require visibility/table work under MVCC; estimate, counter, bounded count, or separate aggregate depends on product semantics.
- Pool size is a concurrency/resource decision. More connections can increase queueing, lock contention, memory, and context switching; the correct size must be measured against DB capacity and request deadlines.
- Batch/fetch and bulk jobs need chunking, idempotent checkpoints, backpressure, lock scope, and restart semantics. A single huge transaction is not a throughput strategy.

## Claims to verify or qualify

| Claim from local content | Classification | Evidence | Scope / limitation | Confidence |
| --- | --- | --- | --- | --- |
| Measure slow-query frequency/total time/tail latency before changing SQL. | Recommendation supported by practice | [S01], [S02], [S03], [S27] | Choose metrics that match user SLO and workload; a rare high-cost query may matter more than a frequent cheap one. | High |
| PostgreSQL `EXPLAIN ANALYZE` executes the statement and reports actual rows/timing. | Verified fact | [S01], [S02] | DML/side effects require a transaction rollback or non-executing explain; timing has instrumentation overhead. | High |
| Estimated-versus-actual row error indicates statistics/correlation/model/cardinality trouble. | Verified diagnostic inference | [S01], [S04], [S05] | A mismatch is a clue, not proof; plan cost/resource pressure and parameter values also matter. | High |
| Nested loop, hash join, and merge join are cost-based alternatives. | Verified product fact | [S01], [S06], [S07] | Available operators and thresholds vary; a join operator is not inherently good/bad. | High |
| `join_collapse_limit = 8` is a universal PostgreSQL rule. | Over-absolute | [S08] | It is a PostgreSQL setting/default in a version/configuration context, not a query-order law; planner settings and explicit parentheses matter. | High |
| MySQL hash joins or optimizer switches can be assumed across releases. | Over-absolute | [S09], [S10] | MySQL optimizer features and defaults change by release; always inspect the target version’s plan. | High |
| Plan regression can come from data skew/parameter sensitivity, not only code changes. | Verified fact | [S11], [S12], [S13] | SQL Server PSP and Oracle SPM are provider-specific mitigations; PostgreSQL/MySQL mechanisms differ. | High |
| SQL Server 2022+ PSP can maintain variants for skewed parameterized equality predicates. | Verified provider/version fact | [S11] | Applies to SQL Server 2022+ and listed Azure/Fabric products; feature eligibility and compatibility level matter. | High |
| Oracle SQL Plan Management uses accepted baselines to control plan changes. | Verified provider/version fact | [S12] | Oracle 19c/23c docs and licensing/configuration scope; not a generic optimizer feature. | High |
| PostgreSQL `shared_buffers` default/25%/40% guidance is universal. | Over-absolute | [S14] | Current PostgreSQL docs give starting guidance; OS cache, workload, platform, managed service, and version change the result. | High |
| Shared buffer hit ratio is enough to diagnose I/O. | Over-absolute | [S15], [S16] | Global ratios hide hot/cold relations, OS cache, sequential scans, writeback/checkpoints, and query mix. Inspect per-query buffers and latency. | High |
| Sargable predicates preserve index access; a function/expression index may be an alternative. | Verified design principle | [S17], [S18], [S19] | Type/collation/volatility and provider syntax matter; an index still may not win for low selectivity. | High |
| Keyset pagination is better than deep OFFSET for stable ordered feeds. | Recommendation supported by complexity | [S20], [S21] | Requires a unique/tie-broken order, cursor validation, and a UX that can accept no arbitrary page jump. | High |
| `COUNT(*)` and `COUNT(1)` are generally equivalent, while `COUNT(column)` excludes NULL. | Verified SQL semantics with optimizer caveat | [S22], [S23] | Cost and exactness depend on engine/MVCC/index/path; do not replace exact count with estimate without product agreement. | High |
| Materialized views/cache/rollups/OLAP trade freshness for read cost. | Verified design implication | [S24], [S25], [S26] | Refresh/concurrency/late-data semantics must be explicit; not every dashboard needs a second store. | High |
| HikariCP `((core_count * 2) + effective_spindle_count)` is a pool-size formula. | Heuristic, not invariant | [S27], [S28] | It is a starting heuristic from a specific context; DB CPU/IO/lock/transaction behavior and workload set the limit. | High |
| Timeouts should be nested so an inner DB deadline expires before the outer request. | Recommendation | [S27], [S29] | Exact layers/framework behavior vary; a timeout must cancel work and avoid orphaned retries. | Medium-high |
| Hibernate batching/fetching can reduce round trips and N+1, but JOIN FETCH can multiply rows and identity strategies affect batching. | Verified provider fact | [S30], [S31], [S32] | Hibernate version, driver, ID generator, collection shape, and query plan matter. | High |
| `FOR UPDATE SKIP LOCKED` is useful for queue-like workers. | Verified provider feature / recommendation | [S33] | It intentionally skips locked rows and is not a general fairness or exactly-once guarantee. | High |
| Bulk jobs scale linearly by increasing workers. | Over-absolute | [S34], [S35] | Lock/index/WAL/redo/IO/queue contention and hot partitions create a ceiling; checkpoint/idempotency are essential. | High |

## Workload, invariants, and failure model

| Workload / invariant | Optimization mechanism | Crash / failure window | Recovery / proof obligation |
| --- | --- | --- | --- |
| Interactive p99 must meet SLO | Query plan and resource budget measured at representative parameters | Plan switches under skew; connection queue extends tail; timeout leaves work running | Query cancel/timeout, plan-shape monitoring, parameter buckets, bounded retries, and SLO alert. |
| Pagination must not skip/duplicate records | Stable unique order and keyset cursor | Concurrent insert/update changes order; cursor tampering/expiry | Define snapshot/freshness semantics, cursor signing/expiry, tie-breaker, and replay test. |
| Exact count displayed to user | Database count or maintained counter | Count scan blocks/lag; counter update lost/duplicated | State exact/approximate contract; reconcile counters or show “about.” |
| Aggregated dashboard has freshness SLA | Rollup/materialized view/OLAP | Refresh fails or late event arrives after aggregate | Track refresh watermark, replay/backfill, late-data correction, and user-visible timestamp. |
| Bulk update must be restartable | Chunked keyset/ID ranges, checkpoint, idempotent update | Worker dies after commit before checkpoint; duplicate chunk | Use deterministic chunk and safe predicate; checkpoint transactionally or make rerun harmless. |
| Pool protects DB capacity | Bounded pool, queue, timeout, separate slow/batch capacity | Pool exhaustion, timeout storm, retry amplification | Measure active/idle/pending, DB waits/locks, cancellation, and retry budget; do not merely raise max pool. |
| Optimizer statistics represent data | ANALYZE/autovacuum/histograms/extended stats | Data distribution changes before stats; plan cached from old assumptions | Schedule/analyze by change rate; compare plan and stats age; use provider-specific plan controls cautiously. |
| Worker claims a row once enough for work item | `SKIP LOCKED`/status transition/idempotency key | Worker crashes after claim or before effect; lock releases and item reappears | Persist state machine/attempt, lease/visibility timeout, idempotent effect and dead-letter/manual repair. |

## Best-practice comparison

| Problem | PostgreSQL | MySQL 8.4 | SQL Server | Oracle | Hibernate/Hikari application layer | Research conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| Plan evidence | EXPLAIN/ANALYZE, buffers, `pg_stat_statements`, stats | EXPLAIN variants, optimizer trace/histograms, performance schema | Actual plans, Query Store, PSP | AWR/ASH/plan history, SQL Plan Management | SQL logs/metrics, query count, pool waits | Collect engine and application evidence together. |
| Plan instability | Stats/parameter/correlation/bloat; provider controls differ | Stats/index/optimizer changes and prepared statements | PSP variants and Query Store | Accepted baselines/evolution | Query-shape/parameter diversity | Pinning/hints are last-resort controls with lifecycle cost. |
| Pagination | Keyset row comparison, stable unique order | Same conceptual pattern; syntax/index differs | Keyset/seek patterns | Keyset/analytic options | DTO/cursor mapping | Test correctness under concurrent writes, not only speed. |
| Aggregation | Materialized views, rollups, extensions | Summary tables/replicas/OLAP | Indexed views/columnstore | Materialized views/analytic engine | Batch/fetch/projection | Freshness and recomputation are part of the result contract. |
| Pool/concurrency | Server process/worker/IO and locks | Threads/connection/metadata/locks | Worker/parallelism/tempdb | Sessions/CPU/IO | Pool and retry layer | Connection count is a queueing control, not a throughput dial. |
| Bulk work | COPY/CTE/chunks/`SKIP LOCKED` | `LOAD DATA`, batch/chunks | Batch/bulk/locking | Direct path/parallel options | JDBC batch/version/ID strategy | Benchmark one worker, then bounded concurrency with recovery. |

## Coverage matrix

| Required evidence area | Current local coverage | Evidence quality | Proposed treatment |
| --- | --- | --- | --- |
| Definitions | Plans, joins, sargability, pagination, pools | Strong | Add provider/version scope beside every feature. |
| Invariants | Pagination/count/bulk correctness implied | Partial | State ordering, exactness, idempotency, freshness, and timeout invariants explicitly. |
| Workload | OLTP/dashboard/bulk examples | Good but qualitative | Add rate, skew, cardinality, width, p95/p99, concurrency, and cache state. |
| Failure / crash windows | Plan regression and bulk mention | Partial | Add EXPLAIN side effects, timeout cancellation, pool retry, projection refresh, and checkpoint gaps. |
| Retries / timeouts | Pool/queue guidance | Needs full policy | Add deadline hierarchy, retry budget, cancellation, duplicate effects, and DLQ/manual repair. |
| Operations / recovery | PostgreSQL metrics/checkpoints | Uneven | Add Query Store/plan history, restore/rebuild, stats maintenance, and incident runbook. |
| Security / privacy | Sparse | Insufficient | Add redaction, query injection/type safety, index/log PII, least privilege, and cursor protection. |
| Testing | Measure-first and query examples | Partial | Add plan regression, cardinality buckets, concurrency, load, timeout/cancellation, and rollback tests. |
| Domain trade-offs | OTA/fintech/reporting examples | Useful | Keep examples but make exactness/freshness/consistency requirements explicit. |

## Contradictions and limits

| Local simplification | Counterexample / limit | Resolution |
| --- | --- | --- |
| “Use EXPLAIN ANALYZE to inspect any query.” | It executes DML and can cause side effects; timing changes the workload. | Use a transaction rollback/safe clone for writes and disclose overhead. |
| “Low shared-buffer hit ratio means the DB is slow.” | OS cache, scan type, workload mix, checkpoints, and per-query behavior make a global ratio ambiguous. | Pair per-query buffers with latency, I/O waits, checkpoint/writeback, and storage telemetry. |
| “Force the join order / add a hint.” | Hints/plan controls can become stale when data/version/workload changes. | Fix evidence root cause first; use scoped plan control with review/expiry. |
| “A prepared statement has one plan.” | PostgreSQL generic/custom plans and SQL Server PSP can produce different strategies; other engines differ. | Identify engine, cache mode, parameter distribution, and plan lifecycle. |
| “Keyset pagination always replaces OFFSET.” | It cannot offer arbitrary page jumps and requires a stable total order; changing sort/filter requires a new cursor. | Offer cursor semantics where UX/domain supports it; otherwise bound OFFSET or precompute. |
| “Materialized view/cache solves aggregation.” | Refresh lag, late events, invalidation and rebuild are new correctness paths. | Publish watermark/freshness and replay/backfill policy. |
| “More pool connections improve throughput.” | Beyond DB concurrency capacity they increase queueing, locks, memory and context switching. | Tune to measured bottleneck and preserve headroom. |
| “Batch size 50/100 and pool formula are best practice.” | Driver, row width, key generation, WAL/redo, lock and network constraints differ. | Treat as starting parameters and benchmark/recover. |

## Negative evidence and anti-patterns

- Do not optimize a query from a toy dataset, warm cache, one parameter, or average latency only.
- Do not run `EXPLAIN ANALYZE` on production DML without a safe rollback/clone plan.
- Do not add a covering index for every slow query; index width/write amplification and cache eviction can make the workload worse.
- Do not globally disable sequential scans, force join order, clear plan caches, or add hints to hide stale statistics without recording why and how the control expires.
- Do not use `SELECT *`, deep OFFSET, unbounded `COUNT(*)`, leading-wildcard predicates, implicit casts, or per-row network/API calls in a database transaction and call it an indexing problem.
- Do not raise the connection pool after pool exhaustion without checking DB CPU, lock waits, disk, and upstream retry amplification.
- Do not use one global “slow query” threshold for all workloads; batch/reporting and interactive SLOs differ.
- Do not enable global eager fetching to fix N+1; choose projection/join/batch fetch from the result shape.
- Do not increase bulk worker count while ignoring lock order, checkpoint gaps, duplicate effects, WAL/redo bandwidth, and dead-letter handling.
- Do not replace exact user-visible totals with estimates without labeling the result and obtaining product agreement.

## Operational, security, observability, and testing concerns

- **Observability:** use normalized query IDs plus endpoint/tenant/workload tags; record count, total time, p50/p95/p99, rows/bytes, plan hash/shape, estimated/actual rows, buffers/I/O, temp spills, waits/locks, pool pending time, retries/timeouts, and freshness watermark. Redact literal values.
- **Plan lifecycle:** keep before/after plans, parameter buckets, stats age, schema/index change, engine version/config, and rollback action. Query Store/plan baselines are controls, not substitutes for diagnosis.
- **Timeouts/retries:** set DB statement/lock timeout shorter than application deadline, and application shorter than HTTP/client deadline; ensure cancellation reaches the DB; bound retries with jitter and idempotency.
- **Security:** parameterize SQL and validate dynamic identifiers; restrict EXPLAIN/plan/statistics access; redact PII in query logs, plans, traces, cursor tokens, and aggregate exports; protect signed cursors and tenant filters.
- **Testing:** plan-shape tests on production-shaped distributions; p95/p99 load tests at concurrency; isolation/locking tests; query count/row-width tests for ORM; timeout/cancel/duplicate bulk tests; materialized-view freshness/backfill; restore/index rebuild. Do not promote a microbenchmark as a universal result.
- **Operations:** cap batch and pool concurrency, provide pause/resume, checkpoint, dead-letter/manual repair, and a rollback path; monitor autovacuum/vacuum, statistics, checkpoint/WAL/redo, temp disk, and storage latency.

## Duplicate / canonical ownership

| Subject | Canonical dossier | Boundary |
| --- | --- | --- |
| Index structures, MVCC, locks, deadlocks | [05-db-core-index-lock.md](05-db-core-index-lock.md) | Topic 18 uses the mechanics but owns measurement/remediation. |
| Replication, sharding, CDC | [06-db-scaling.md](06-db-scaling.md) | Keep freshness/topology implications linked, not duplicated. |
| Engine capability | [07-sql-nosql-db-engines.md](07-sql-nosql-db-engines.md) | This dossier can cite provider behavior for a tuning decision. |
| Architecture/ORM boundary | [12-architecture-patterns.md](12-architecture-patterns.md) | This topic owns N+1/query shape and performance tests. |
| Outbox/Saga bulk workflow | [09-distributed-tx-fintech.md](09-distributed-tx-fintech.md) and [15-transactional-outbox-order-workflow.md](../case-studies/15-transactional-outbox-order-workflow.md) | Link queue/workflow correctness; keep database job mechanics here. |

## Current-vs-proposed content gaps

1. Add an explicit safety note that `EXPLAIN ANALYZE` executes the statement and show a transaction rollback pattern for DML.
2. Replace global cache-ratio advice with per-query buffers plus storage/checkpoint/writeback and wait evidence.
3. Add provider/version table for PostgreSQL, MySQL, SQL Server PSP, Oracle SPM, and Hibernate; remove unscoped defaults.
4. Preserve “measure first,” but require parameter/cardinality buckets, plan hash/shape, total and tail latency, and a before/after change record.
5. Define keyset cursor ordering, tie-breaker, filter/sort compatibility, signing/expiry, and concurrent-write behavior.
6. Split exact count, approximate count, cached counter, and bounded count into explicit product contracts.
7. Qualify Hikari and pool formulas as heuristics; add Little’s Law/queueing evidence without making a universal pool equation.
8. Add timeout cancellation and retry/idempotency semantics, including bulk chunk recovery and `SKIP LOCKED` fairness limits.
9. Add security/privacy/redaction and testing/restore/rebuild requirements in both language versions.

## EN/VI and cross-reference plan

Preserve all 12 IDs and section order. Translate `estimated rows`, `actual rows`, `plan regression`, `parameter sensitivity`, `sargable`, `keyset/cursor`, `watermark`, `backpressure`, `checkpoint`, and `query cancellation` consistently. Keep SQL syntax, setting names, provider versions, and metric names unchanged. Ensure qualifications such as “heuristic,” “provider-specific,” “approximate,” and “unknown” remain explicit in both languages.

## Integration record (Batch D scope)

- [x] Added `18-query-optimization.rewriting-the-query-reshaping-the-model.q6` in EN/VI to distinguish cache, materialized view, CDC projection, and OLAP by freshness, rebuild, and operational cost.
- [x] Connected the decision back to measured plans and the canonical outbox/CDC boundaries without adding another generic indexing tutorial.
- [ ] The broader local audit of provider-specific optimizer behavior, pool sizing, and plan-regression operations remains a follow-up.

## Open questions and falsifiers

- Which target engines/versions/providers and drivers are in production? Any default/feature claim is falsified if it is not confirmed in that deployment.
- What are the latency SLOs, query frequency, parameter/cardinality distribution, concurrency, row width, cache state, and storage profile? A proposed rewrite is unproven without a representative comparison.
- What is the exact correctness contract for counts, ordering, freshness, and pagination under concurrent writes? A keyset/count recommendation is falsified by a reproducible skip/duplicate or unacceptable UX case.
- What is the DB capacity ceiling in CPU, I/O, locks, WAL/redo, temp disk, and connections? A pool/batch increase is falsified if tail latency or error/retry amplification worsens.
- Can the system cancel timed-out DB work and prevent orphaned retries? If not, timeout guidance is incomplete.
- What is the restore/rebuild/backfill objective for materialized views, indexes, and bulk jobs? A performance design is incomplete until recovery meets the RTO.
- Which local pool-size/batch/timeout/timing numbers have benchmark artifacts? Unbacked numbers remain hypotheses.

## Sources

Source ledger. Tier `T1` = original research/standard; `T2` = official database/framework documentation; `T3` = first-party engineering guidance. All entries reviewed on 2026-08-23. Secondary and SEO material was excluded unless it provided terminology only.

| ID | URL / title | Organization | Tier | Version / revision | Claims supported |
| --- | --- | --- | --- | --- | --- |
| S01 | [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Plan tree, estimates/actuals, loops, examples. |
| S02 | [EXPLAIN command](https://www.postgresql.org/docs/current/sql-explain.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | `ANALYZE` executes, options/overhead, safety. |
| S03 | [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Normalized query statistics and tracking scope. |
| S04 | [Planner Statistics Details](https://www.postgresql.org/docs/current/planner-stats-details.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Histograms, correlation, selectivity, extended-statistics diagnosis. |
| S05 | [ANALYZE](https://www.postgresql.org/docs/current/sql-analyze.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Statistics maintenance and sampling. |
| S06 | [Query Planning](https://www.postgresql.org/docs/current/planner-optimizer.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Cost-based plan/operator selection. |
| S07 | [Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Join/scan plan interpretation and tuning workflow. |
| S08 | [Runtime Config: Query Planning](https://www.postgresql.org/docs/current/runtime-config-query.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | `join_collapse_limit` and planner settings scope. |
| S09 | [MySQL EXPLAIN](https://dev.mysql.com/doc/refman/8.4/en/explain.html) | MySQL | T2 | MySQL 8.4 | MySQL plan fields and version-specific explain behavior. |
| S10 | [Controlling the Optimizer](https://dev.mysql.com/doc/refman/8.4/en/controlling-optimizer.html) | MySQL | T2 | MySQL 8.4 | Optimizer switches/hints and caution. |
| S11 | [Parameter Sensitive Plan Optimization](https://learn.microsoft.com/en-us/sql/relational-databases/performance/parameter-sensitive-plan-optimization?view=sql-server-ver17) | Microsoft | T2 | SQL Server 2022+ / SQL Server 2025 page reviewed 2026-08-23 | PSP variants, equality/skew eligibility, compatibility scope. |
| S12 | [Overview of SQL Plan Management](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgsql/overview-of-sql-plan-management.html) | Oracle | T2 | Oracle Database 19c docs | Plan history/baselines and upgrade/regression control. |
| S13 | [Query Store](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitor-and-tune-for-performance?view=sql-server-ver17) | Microsoft | T2 | SQL Server current docs | Plan/runtime history and monitoring scope. |
| S14 | [Resource Configuration](https://www.postgresql.org/docs/current/runtime-config-resource.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | `shared_buffers` starting guidance and platform qualification. |
| S15 | [Monitoring Database Activity](https://www.postgresql.org/docs/current/monitoring.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Monitoring views and limits of aggregate metrics. |
| S16 | [Monitoring Stats](https://www.postgresql.org/docs/current/monitoring-stats.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Stats snapshots, blocks read/hit, waits and interpretation. |
| S17 | [Indexes on Expressions](https://www.postgresql.org/docs/current/indexes-expressional.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Function/expression indexes and maintenance scope. |
| S18 | [Indexes on Expressions](https://dev.mysql.com/doc/refman/8.4/en/functional-indexes.html) | MySQL | T2 | MySQL 8.4 | Functional-index syntax/limitations. |
| S19 | [Troubleshoot High CPU Usage — SARGability](https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/troubleshoot-high-cpu-usage-issues) | Microsoft | T2 | Current SQL Server troubleshooting guide, reviewed 2026-08-23 | SARGable predicates, function/computation on a searched column, and provider-specific non-SARGable examples. |
| S20 | [LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Unstable ordering and deep OFFSET cost/semantics. |
| S21 | [Keyset Pagination](https://use-the-index-luke.com/no-offset) | Markus Winand | T3 | First-party technical book site, reviewed 2026-08-23 | Seek/keyset pagination terminology and trade-off. |
| S22 | [Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | `COUNT` semantics and aggregate behavior. |
| S23 | [MySQL Aggregate Functions](https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html) | MySQL | T2 | MySQL 8.4 | `COUNT(*)`, `COUNT(expr)`, NULL semantics. |
| S24 | [Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Refreshable derived results and index use. |
| S25 | [ClickHouse Columnar Databases](https://clickhouse.com/resources/engineering/what-is-columnar-database) | ClickHouse | T3 | First-party article reviewed 2026-08-23 | Columnar/OLAP workload fit; no universal benchmark claim. |
| S26 | [ClickHouse OLAP](https://clickhouse.com/resources/engineering/what-is-olap) | ClickHouse | T3 | First-party article reviewed 2026-08-23 | OLTP versus analytic workload distinction. |
| S27 | [HikariCP Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) | HikariCP project | T3 | Wiki reviewed 2026-08-23 | Pool-size heuristic and queueing/DB bottleneck warning. |
| S28 | [HikariCP README](https://github.com/brettwooldridge/HikariCP) | HikariCP project | T3 | Current repository | Pool configuration/metrics and version scope. |
| S29 | [Java JDBC `setQueryTimeout`](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/Statement.html) | Oracle / Java SE | T2 | Java SE 21 API | Statement timeout API semantics and driver-dependence. |
| S30 | [Hibernate ORM User Guide](https://docs.hibernate.org/orm/6.6/userguide/html_single/) | Hibernate project | T2 | Hibernate 6.6 guide | Fetching, N+1, batching, projections and query shape. |
| S31 | [Hibernate `@BatchSize`](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/annotations/BatchSize.html) | Hibernate project | T2 | Current Javadocs | Batch fetching round-trip behavior. |
| S32 | [Hibernate 7 Short Guide](https://docs.hibernate.org/orm/7.3/introduction/html_single/) | Hibernate project | T2 | Hibernate 7.3 guide | JDBC batching, fetch size, driver/version caveats. |
| S33 | [SELECT Locking Clauses](https://www.postgresql.org/docs/current/sql-select.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | `FOR UPDATE`, `SKIP LOCKED`, queue-worker limits. |
| S34 | [COPY](https://www.postgresql.org/docs/current/sql-copy.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Bulk-load path and error/transaction considerations. |
| S35 | [MySQL LOAD DATA](https://dev.mysql.com/doc/refman/8.4/en/load-data.html) | MySQL | T2 | MySQL 8.4 | Bulk-load behavior and provider scope. |
| S36 | [Autovacuum](https://www.postgresql.org/docs/current/routine-vacuuming.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | Bloat, visibility, vacuum and long-transaction interaction. |
| S37 | [PostgreSQL Checkpoints](https://www.postgresql.org/docs/current/wal-configuration.html) | PostgreSQL Global Development Group | T2 | PostgreSQL 18 current docs | WAL/checkpoint/writeback behavior and tuning scope. |
| S38 | [SQL Server Query Processing Architecture](https://learn.microsoft.com/en-us/sql/relational-databases/query-processing-architecture-guide?view=sql-server-ver17) | Microsoft | T2 | SQL Server current docs | Compilation/cache/parameter sensitivity context. |

## Discovery exclusions

Excluded candidates were generic “10 SQL tricks” posts, vendor pool-size calculators, benchmark charts without dataset/concurrency/cache details, and duplicate pages that restated PostgreSQL `EXPLAIN`. The keyset source is secondary/first-party technical education and is used for terminology only; provider guarantees remain sourced to database documentation.
