# Research - Distributed locks, leases, and fencing

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `28-distributed-lock-lease`

EN file: `public/data/topics/28-distributed-lock-lease.json`

VI file: `public/data/topics/28-distributed-lock-lease.vi.json`

## Scope and non-goals

This dossier owns the protocol choice, authority selection, lease expiry, fencing, lock application, operations, and testing concerns in the assigned topic. It does not own the complete database-lock lesson (topic 05), distributed transaction/Saga semantics (topic 09), Kubernetes deployment guidance (topic 14), or queue consumer coordination (topic 08). Those units should link here for lease/fencing boundaries instead of repeating a generic “use Redis lock” recipe.

The research pool covered PostgreSQL, etcd, Redis, ZooKeeper, Kubernetes, Consul, DynamoDB, Google Cloud Storage preconditions, the Chubby paper, and the principal fencing-token critique. The final ledger selects 27 inspected sources. The search was broad enough to compare independent authorities and failure models; it was not padded to a fixed candidate count. Product aliases, copied Redlock tutorials, generic “distributed lock” SEO pages, and sources that did not add a distinct guarantee or failure case were excluded.

## Local content map

Both JSON files were read in full. Each contains 4 sections and 17 items; the `id` sets are identical. EN size is 34,603 bytes and VI size is 35,278 bytes. The local draft already has the most important safety warning—expiry does not stop a paused worker—but it should make authority, fencing, provider version, and correctness scope even more explicit.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| The protocol before the product | `28-distributed-lock-lease.the-protocol-before-the-product.q1` through `.q4` | Lock problem, safety/liveness/fairness, mutex/lease/election distinction, and stale holders. |
| Choose the authority before the mechanism | `28-distributed-lock-lease.choose-the-authority-before-the-mechanism.q1` through `.q5` | Database, Redis, etcd/ZooKeeper/Consul, Kubernetes, and external-resource authority choices. |
| Design for expiry and stale work | `28-distributed-lock-lease.design-for-expiry-and-stale-work.q1` through `.q4` | TTL/renewal, fencing, clock/pause/network failure, and critical-section design. |
| Apply, operate, and test it | `28-distributed-lock-lease.apply-operate-and-test-it.q1` through `.q4` | Acquire/release protocol, metrics/runbooks, and crash/partition/chaos tests. |

The complete item IDs are:

```text
28-distributed-lock-lease.the-protocol-before-the-product.q1
28-distributed-lock-lease.the-protocol-before-the-product.q2
28-distributed-lock-lease.the-protocol-before-the-product.q3
28-distributed-lock-lease.the-protocol-before-the-product.q4
28-distributed-lock-lease.choose-the-authority-before-the-mechanism.q1
28-distributed-lock-lease.choose-the-authority-before-the-mechanism.q2
28-distributed-lock-lease.choose-the-authority-before-the-mechanism.q3
28-distributed-lock-lease.choose-the-authority-before-the-mechanism.q4
28-distributed-lock-lease.choose-the-authority-before-the-mechanism.q5
28-distributed-lock-lease.design-for-expiry-and-stale-work.q1
28-distributed-lock-lease.design-for-expiry-and-stale-work.q2
28-distributed-lock-lease.design-for-expiry-and-stale-work.q3
28-distributed-lock-lease.design-for-expiry-and-stale-work.q4
28-distributed-lock-lease.apply-operate-and-test-it.q1
28-distributed-lock-lease.apply-operate-and-test-it.q2
28-distributed-lock-lease.apply-operate-and-test-it.q3
28-distributed-lock-lease.apply-operate-and-test-it.q4
```

## What is correct and reusable

- A lock is a coordination primitive, not a transaction. It can reduce concurrent attempts but cannot roll back a remote side effect, prove that a holder is still running, or repair an already-visible stale write.
- Safety, liveness, fairness, and observability are different properties. A TTL can improve liveness while making safety dependent on fencing and on the protected resource’s ability to reject stale work.
- A mutex, lease, and leader election have different ownership shapes. A per-resource critical section, a recoverable expiring claim, and one active controller should not be represented by the same vague “lock” requirement.
- The authority must be selected before the client API. If a database owns the invariant, a conditional write/constraint or transaction is generally stronger than a separate lock service. If a controller role is owned by Kubernetes/etcd, use its election/Lease semantics and keep actions restartable.
- PostgreSQL row locks and advisory locks are useful when the protected work is local to the same database transaction/session, but lock lifetime, deadlock behavior, and connection-pool boundaries matter.
- etcd’s concurrency lock coordinates ownership of etcd keys and uses revisions/leases; its own guidance warns that a lease alone cannot guarantee mutual exclusion for an external resource. This is central evidence against using a lease as the business correctness boundary.
- Redis `SET NX PX` plus a random value and compare-and-delete is a useful single-instance coordination pattern under a stated failure model. Redis replication/failover, multi-node assumptions, client pauses, and external side effects must be documented. The official Redlock page and independent fencing critique are intentionally shown as competing evidence, not silently merged.
- ZooKeeper ephemeral/sequential recipes provide a coordination model with session ownership and ordered acquisition. They still do not make an arbitrary external system reject stale work.
- Fencing is the durable answer when an old holder can resume. The resource must compare a monotonically increasing token/version/generation and reject a lower or stale token. If the resource cannot do this, call the lock an availability/admission optimization, not a correctness proof.
- Optimistic concurrency can be the better primitive for a single business row/item: a version/generation/ETag precondition makes stale writers fail without a separate long-lived lock.

## Claims to verify or qualify

| Local claim or pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| A lock lets one claimant enter a critical section | Definition | This is the intended coordination property; it is only a safety guarantee if the authority and resource enforce one owner under the stated failure model. | High |
| TTL/lease expiry prevents a crashed worker from blocking forever | Conditional fact | It improves liveness if the authority can expire the claim, but a paused process may continue after expiry. Fencing or an equivalent resource-side check is required for strict safety. | High |
| Compare-and-delete protects Redis unlock | Provider fact with scope | A random ownership value plus conditional deletion prevents one client from deleting another’s current key on the same Redis authority. It does not cover stale external writes or every failover model. | High |
| A longer TTL makes the lock safer | Incorrect absolute | It can reduce expiry during normal work but increases recovery time and does not eliminate process pauses, partitions, or stale ownership. Measure hold-time distribution and use renewal/fencing. | High |
| A successful acquire proves exclusive business execution | Incorrect | It proves only what the authority’s protocol promises at that moment. The protected database/object/storage service must enforce the business invariant. | High |
| Redlock is universally safe | Unsupported absolute | Redis documents safety/liveness assumptions for its algorithm; Kleppmann’s critique identifies timing/partition/fencing limits. Choose and document the failure model rather than using a universal claim. | High that universal wording is unsupported |
| etcd lease alone is enough for an external resource | Contradicted by official docs | etcd’s learning material explicitly distinguishes its lock/key coordination from arbitrary external resources and points toward fencing/authority at the resource. | High |
| Advisory lock equals a row lock | Incorrect | PostgreSQL advisory locks are application-defined and can be session- or transaction-level; they do not automatically protect a row or force unrelated writers to participate. | High |
| `SKIP LOCKED` gives fair work distribution | Incorrect absolute | PostgreSQL documents it as useful for queue-like tables but gives an inconsistent view and can skip locked rows; fairness and starvation require a separate design/test. | High |
| Leader election makes every action safe | Incorrect | Election chooses an active controller; a stale controller can still issue work after a partition/pause unless actions are idempotent and resource-side guarded. | High |
| Kubernetes Lease is a generic cross-system lock | Incorrect | The Lease API supports coordination/heartbeats/election in Kubernetes; its use and authorization scope are cluster-specific and do not fence arbitrary external writes. | High |
| Consul session invalidation is proof that the client stopped | Incorrect | Session invalidation can make a lock available according to Consul’s model; it cannot kill a process or stop an already-issued external request. | High |
| Optimistic version checks remove all races | Conditional | They prevent stale writes only where every writer uses the same condition and authority. They do not serialize multi-row/multi-resource workflows or make a remote side effect atomic. | High |
| Clock time is the only lease concern | Incomplete | Pause duration, monotonic deadline handling, network delay, failover, renewal margin, scheduler starvation, and resource-side token checks all affect safety/liveness. | High |

## Workload, invariants, and failure model

### Workload model

Declare these values before selecting a lock product:

| Dimension | Values to measure or declare | Why it changes the design |
| --- | --- | --- |
| Protected key | Key cardinality, hot-key skew, tenant/resource ownership, multi-key scope | A global key creates a bottleneck; multiple keys may need an atomic transaction or ordered acquisition. |
| Critical-section time | p50/p95/p99/max, pause/GC tail, external call duration, queue wait | TTL and renewal margin must cover tail behavior, but a huge TTL worsens recovery. |
| Contention | Acquire rate, waiters, hold time, fairness/starvation tolerance | A lock may be the wrong shape for a high-volume work queue or hot row. |
| Side effect | Same database, object store, API, payment provider, scheduler, file, or hardware | The authority that can reject stale work differs; a remote API may need an idempotency key instead of a lock. |
| Failure model | Process crash, pause, clock skew, packet loss, partition, authority failover, stale replica, operator restart | Safety and liveness claims depend on which failures are admitted. |
| Recovery | Maximum blocked time, takeover owner, replay/repair, manual override, fencing token source | A lease without a repair/observability path merely changes a deadlock into ambiguous work. |
| Consistency | Strict mutual exclusion, at-most-one visible write, last-writer-wins, best-effort duplicate suppression | “Lock” is not a requirement until the required invariant is named. |
| Deployment | Single region, multi-zone, multi-region, Kubernetes, managed Redis/DB, version/topology | Quorum/failover/latency and clock/network assumptions change across topology. |

### Safety invariants

1. At most one valid fencing token can be accepted for the protected business operation at a time, or the design explicitly accepts duplicate/best-effort execution.
2. Every acquire, renew, release, and takeover is scoped to the resource key and ownership token; a late release cannot delete a newer owner’s claim.
3. A worker stops issuing new protected writes when ownership/renewal is lost or when the local deadline is exceeded.
4. The protected authority rejects stale tokens/versions where the operation requires strict safety; a separate lock cannot substitute for this check.
5. A dead or unreachable holder eventually becomes recoverable within a declared bound, unless the system intentionally chooses manual recovery.
6. All writers that can violate the invariant participate in the same lock/condition/version protocol. A lock around one code path is not a global invariant.
7. Lock state, fencing/generation, owner, wait, renewal, expiry, and recovery actions are observable without exposing secrets or allowing arbitrary operator writes.

### Crash and failure windows

| Window | Failure | Result if there is only a lock/lease | Safer response |
| --- | --- | --- | --- |
| Acquire response lost | Authority accepted the claim but client times out | Client may retry and see “already held”; or a second non-atomic implementation may duplicate work | Use unique owner token, inspect/renew state, and make the work idempotent. |
| Holder pauses before renew | GC/CPU starvation/VM freeze exceeds lease | Authority grants takeover while old process later resumes | Stop on renewal loss and enforce a fencing token at the resource. |
| Network partition | Client cannot reach authority but can reach resource | Old client may continue with stale ownership belief | Resource-side fencing/conditional write; otherwise downgrade the guarantee. |
| Authority failover | Accepted state is lost, delayed, or read from a stale replica | Two clients can believe they own the key under some topologies | Use the provider’s documented quorum/consistency model, or choose a business authority with a conditional write. |
| Release after expiry | Old client sends unlock after a new owner acquired | Unconditional delete releases the new owner | Compare ownership token or use server-side conditional release. |
| Renewal race | Renew arrives after takeover or on a different session | Old holder may extend a stale claim or falsely report health | Renew only with owner/session condition; record generation and reject late renewals. |
| Partial multi-resource acquire | Client owns A but times out acquiring B | Deadlock, leaked partial ownership, or inconsistent work | Ordered acquisition, bounded rollback/release, or a durable workflow with compensation. |
| Protected write after lock service success | Lock authority says A owns, resource does not observe ownership | A stale or duplicate write can still commit | Send fencing/version/conditional token to the protected resource. |
| Leader elected, action response lost | Controller cannot tell whether reconciliation committed | Repeated action may duplicate external effects | Idempotent reconciliation and resource status/read-after-write, not election alone. |
| Operator force release | Manual deletion races with active holder | New work overlaps old work | Require fencing, audit/authorization, and an explicit drain/stop procedure. |

## Comparison table

| Mechanism/authority | Safety/liveness shape | Good fit | Main limitation or crash window |
| --- | --- | --- | --- |
| PostgreSQL row lock / transaction | Database transaction owns lock; release on commit/rollback | Mutating rows in the same PostgreSQL authority | Holds database resources, deadlocks/timeouts; cannot protect a remote side effect by itself. |
| PostgreSQL advisory lock | Application-defined key, session- or transaction-scoped | Coordinating code paths that all use the same PostgreSQL authority | Unrelated writers do not participate; session pooling and leaked sessions change semantics. |
| `SELECT ... FOR UPDATE SKIP LOCKED` | Row claims can support queue-like work | Multiple workers claiming independent database jobs | Inconsistent view, skipped rows, starvation/fairness concerns; not a general mutex. |
| Optimistic version/CAS/ETag | Resource rejects stale version/generation | Single item/row/object where all writers can conditionally update | No automatic multi-resource atomicity; retry/merge policy remains domain-specific. |
| Redis single-instance token lock | Key TTL plus random ownership token and conditional release | Best-effort coordination in one Redis authority with explicit failure tolerance | Async replication/failover, pause/partition and external side effects can violate stronger assumptions. |
| Redis Redlock | Multiple independent Redis masters/quorum timing model | A provider-specific coordination choice when its assumptions are accepted | Timing/quorum/fencing debate; official algorithm does not make arbitrary external resources reject stale clients. |
| etcd concurrency lock | Revision-ordered key plus session/lease | Coordination among clients already using etcd | Lease alone does not fence an external resource; quorum/availability and latency are part of the contract. |
| ZooKeeper ephemeral sequential recipe | Session-owned ephemeral nodes and predecessor ordering | Ordered lock acquisition and controller coordination | Session loss/partition semantics need testing; external resource still needs fencing for stale writes. |
| Kubernetes Lease/election | Lease/renewal selects one active controller | Kubernetes leader election, heartbeats, controller roles | Cluster API scope and election do not fence arbitrary external business writes. |
| Consul session/lock | Session invalidation releases/invalidates lock according to Consul | Service coordination with Consul as authority | Advisory/session semantics are not process termination or external-write fencing. |
| Durable queue claim | Work item state/visibility timeout, ack/retry | Independent jobs and replayable work | Duplicate/out-of-order delivery and poison work require idempotency and operations. |

## Coverage matrix

| Area | Evidence inspected | Current local coverage | Proposed content treatment |
| --- | --- | --- | --- |
| Definitions | PostgreSQL, etcd, Redis, ZooKeeper, K8s, Consul docs | Mutex/lease/election and safety/liveness are separated | Keep the vocabulary table and add “authority” and “fencing” to the glossary. |
| Invariants | etcd guarantees/why, Redis locks, Chubby, Kleppmann, conditional-write docs | Stale-holder warning is strong | Make resource-side fencing/conditional write a numbered invariant, not a footnote. |
| Workload | Product docs plus local critical-section examples | Critical section, TTL and contention are discussed | Add key skew, hold-time percentile, pause tail, topology, and external-side-effect fields. |
| Failure/crash windows | etcd leases, Redis failover assumptions, ZooKeeper sessions, K8s/Consul sessions | Pause, partition, release race, and failover are present | Add the explicit crash-window table and distinguish authority loss from worker loss. |
| Retries/timeouts | Provider APIs, queue/optimistic-write semantics | Retry/release/renew logic is discussed | Tie acquire/renew retries to a monotonic deadline; never retry an unknown external write without idempotency. |
| Operations/recovery | PostgreSQL locks, etcd elections, K8s Lease, Consul sessions | Metrics/runbooks and manual recovery are introduced | Add owner/generation/config version, forced-release audit, stuck-holder and stale-write alerts. |
| Security/privacy | K8s/Consul/DB authority and operator boundaries | Operator and ownership concerns exist | Add least-privilege key namespaces, lock-value secrecy, secure force-release, and tenant isolation. |
| Testing | Provider semantics, crash/partition model | Chaos and unit tests are planned | Add pause/GC, delayed packets, authority failover, late release, stale fencing, hot-key and starvation tests. |
| Domain trade-offs | Database, Redis, etcd, object-store conditional writes, Chubby | DB/Redis/K8s examples exist | Keep bank/fintech correctness versus scheduler/duplicate suppression examples clearly scoped. |

## Contradictions and limits

| Competing guarantee or advice | Evidence boundary | Teaching implication |
| --- | --- | --- |
| Redis official Redlock guidance versus fencing critique | Redis documents safety/liveness conditions for Redlock; Kleppmann argues that timing assumptions do not protect an external resource from a stale client. | Present the algorithm and critique together. Select it only with an explicit failure model and resource-side fencing when correctness requires it. |
| Lease expiry versus stale execution | etcd/Kubernetes/Consul sessions can expire or invalidate ownership; none kills a paused process or cancels every in-flight request. | Lease expiry is liveness; fencing/conditional resource acceptance is safety. |
| Database lock versus application advisory lock | PostgreSQL row locks participate in row/transaction behavior; advisory locks are cooperative application keys. | Use row/constraint/version authority when the row is the invariant; document every participating writer for advisory locks. |
| `SKIP LOCKED` throughput versus fairness | PostgreSQL explicitly positions it for queue-like access and warns of inconsistent reads. | It can improve worker throughput but is not FIFO or starvation-free. Measure queue age and add a fairness policy if required. |
| Leader election versus business serialization | Chubby/K8s/etcd election chooses a controller; business resources may still receive stale/duplicate commands. | Leader election reduces active controllers; it does not replace idempotency or fencing. |
| Long TTL versus quick recovery | Long TTL reduces ordinary expiry but increases blocked time after a dead holder. | Choose TTL from observed hold/pause tails and recovery budget, then add renewal and fencing rather than relying on duration alone. |
| Optimistic versus pessimistic coordination | Conditional writes avoid a separate lock but may produce conflicts/retries; locks reduce overlap but hold resources and can deadlock. | Choose from contention, conflict cost, invariant owner, and user latency, not from a universal “best” primitive. |

## Negative evidence and anti-patterns

- Do not use `SETNX` followed by a separate `EXPIRE` without handling the crash between commands; use the provider’s atomic conditional/TTL operation or a transaction with a stated model.
- Do not delete a lock key unconditionally. A late release can remove a newer owner’s claim; compare the ownership token on the authority.
- Do not treat TTL expiry as a process kill. A stopped renewal tells the authority to make the claim available; it does not stop an old thread, JVM, VM, request, or external call.
- Do not protect a database invariant with a Redis lock while allowing other writers to use the database directly. Enforce a unique/conditional/version constraint at the database.
- Do not use a lock to make a remote payment, API, file, or object-store side effect exactly once. Use the provider’s idempotency/precondition contract and reconcile unknown outcomes.
- Do not renew forever while the worker is unable to make progress. Renewal must be tied to health/progress and a bounded operation deadline, otherwise a stuck owner can defeat liveness.
- Do not acquire multiple locks in arbitrary order. Use a total order, a single authority transaction, or a workflow that can safely compensate/retry.
- Do not call `SKIP LOCKED` a fair scheduler. Track queue age/starvation and use an explicit queue or priority policy when fairness matters.
- Do not use a Kubernetes Lease, Consul session, or etcd election as a universal lock for external systems without a fencing/conditional-write path.
- Do not expose lock keys, owner tokens, force-release endpoints, or diagnostic values to untrusted tenants. Namespace, authorize, audit, and rate-limit operator controls.
- Do not alert only on lock count. A low count with a long hold, repeated renew failure, growing queue age, or stale fencing rejection can be the real incident signal.

## Duplicate/canonical ownership

| Concept | Canonical owner | Action for this topic |
| --- | --- | --- |
| Row/table/index/transaction locks and database isolation | `05-db-core-index-lock` | Keep the cross-system authority choice and fencing boundary; link for PostgreSQL lock mechanics. |
| Database engines and conditional writes | `07-sql-nosql-db-engines` and `05-db-core-index-lock` | Use provider examples only to show invariant ownership; do not duplicate engine tuning. |
| Saga/outbox/unknown payment outcomes | `09-distributed-tx-fintech` and Case Study 15 | Link when a lock protects a workflow; the workflow’s compensation/idempotency contract remains there. |
| Broker consumer claims and redelivery | `08-message-queue` | Distinguish queue visibility/ack from a lock; link for delivery semantics. |
| Kubernetes deployment/Lease operations | `14-devops-k8s-best-practices` | Use Kubernetes Lease as a scoped example and link for cluster operations. |
| Rate-limit token consumption and overload | `10-system-design-rate-limit` | Do not serialize token consumption with a distributed lock; use an atomic limiter primitive. |
| Test coordination and concurrency testing | `26-testing-strategy` | Link for test layers; this dossier owns the lock-specific failure matrix. |

## Integration record (Batch A scope)

The authority-first decision, lease-expiry versus safety distinction, fencing requirement, provider/version limits, optimistic-concurrency alternative, and lock-versus-idempotency/Outbox boundary were integrated into both EN and VI. Existing IDs were preserved and the topic now links to Topics 05, 08, 09, 14, and the relevant case evidence. Remaining bullets are implementation-specific follow-ups, not missing integration.

## Proposed follow-up changes

- [ ] Put the authority/resource/failure-model questions before product names; require a named invariant and accepted duplicate/blocked behavior.
- [ ] Add the numbered invariants and crash-window table, especially pause-after-expiry, delayed release, authority failover, and external-write-after-acquire.
- [ ] Split the mechanism table into database transaction/constraint, optimistic conditional write, coordination lock, lease/election, and durable work-claim categories.
- [ ] Strengthen every TTL example with observed hold-time percentiles, renewal margin, monotonic deadline, maximum recovery time, and stale-work fencing.
- [ ] Amend Redis examples with atomic acquisition, random owner token, compare-and-delete, replication/failover scope, and the official-versus-critique Redlock evidence boundary.
- [ ] Amend etcd/Kubernetes/Consul examples to say their lease/session/election can coordinate the authority but cannot stop a stale external writer.
- [ ] Add a concrete resource-side fencing example using a monotonically increasing generation/version or database/object-store precondition.
- [ ] Add a recovery runbook: detect stuck holder, stop/drain old worker, inspect generation, force release only with authorization/audit, replay/reconcile, and verify stale-token rejection.
- [ ] Add tests for GC/CPU pause, network delay/partition, failover, lost responses, late release, renewal race, hot-key contention, starvation, and multi-lock ordering.
- [ ] Update EN and VI symmetrically, preserving every `id` and keeping product/version qualifiers equivalent.

## EN/VI parity and cross-reference plan

The EN and VI files have identical section and item counts and identical `id` values. Integrate changes in pairs. The central “lock for coordination, authority for correctness” rule, the safety/liveness distinction, and every provider-specific caveat must appear in both languages. Keep code tokens such as `SET NX`, `FOR UPDATE`, fencing/generation, Lease, and `SKIP LOCKED` unchanged so examples remain searchable.

## Open questions and falsifiers

- [ ] What exact invariant is protected: one row, one object, one scheduler role, one external API operation, or duplicate suppression only?
- [ ] Which component is the source of truth and can it reject stale owner generations/tokens?
- [ ] What are p99/max critical-section time, GC/pause tail, network delay, authority failover time, and maximum acceptable takeover time?
- [ ] Is fairness required, or is throughput/availability more important? What is the maximum queue age/starvation window?
- [ ] Is the deployment one region or multi-region, and what quorum/replication/partition model is actually supported by the selected provider/version?
- [ ] Can every writer use the same condition/lock, including scripts, admin tools, batch jobs, and disaster-recovery paths?
- [ ] What is the policy for an unknown outcome after a timed-out acquire or protected write: query, retry with idempotency, reconcile, or manual review?
- [ ] Who can force release or fence an owner, and how are those actions authenticated, audited, and tested?
- [ ] What evidence would falsify the recommendation? Examples: stale tokens are accepted by the resource, hold/pause tails exceed the renewal budget, authority failover admits two owners, queue age/starvation violates the SLO, or recovery requires unsafe manual deletion.

## Source ledger

All selected sources were inspected on 2026-08-23. Tier A means a standard, first-party specification, implementation document, or original research paper; Tier B means first-party operational/provider guidance. “Current” is the publisher’s current page at review time and must be pinned to the deployed version before integration.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 28-01 | [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html), PostgreSQL | A; current PostgreSQL 18 docs at review; deployed major version unresolved | Row/table/advisory lock modes, transaction lifetime, deadlock behavior, and lock-release scope. | 2026-08-23 |
| 28-02 | [SELECT](https://www.postgresql.org/docs/current/sql-select.html), PostgreSQL | A; current PostgreSQL 18 docs at review | `FOR UPDATE`, `NOWAIT`, `SKIP LOCKED`, and queue-like access limitations. | 2026-08-23 |
| 28-03 | [System administration functions: advisory locks](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS), PostgreSQL | A; current PostgreSQL 18 docs at review | Session-level versus transaction-level advisory locks and cooperative application-key semantics. | 2026-08-23 |
| 28-04 | [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html), PostgreSQL | A; current PostgreSQL 18 docs at review | Isolation behavior, serialization failures, and retry/transaction scope relevant to lock alternatives. | 2026-08-23 |
| 28-05 | [etcd API concurrency reference](https://etcd.io/docs/v3.6/dev-guide/api_concurrency_reference_v3/), etcd | A; etcd v3.6 developer docs | `Mutex`, `Election`, session/lease relationship, revisions, and concurrency API scope. | 2026-08-23 |
| 28-06 | [How to create locks](https://etcd.io/docs/v3.6/tasks/developer/how-to-create-locks/), etcd | A; etcd v3.6 task docs | Lock key creation/ownership flow and etcd-specific lock implementation boundary. | 2026-08-23 |
| 28-07 | [How to conduct leader elections](https://etcd.io/docs/v3.7/tasks/operator/how-to-conduct-elections/), etcd | A; etcd v3.7 task docs | Election/lease usage for one active controller and leader-loss behavior. | 2026-08-23 |
| 28-08 | [API guarantees](https://etcd.io/docs/v3.6/learning/api_guarantees/), etcd | A; etcd v3.6 learning docs | Linearizable/serializable consistency terminology and provider-specific guarantees. | 2026-08-23 |
| 28-09 | [Why etcd](https://etcd.io/docs/v3.6/learning/why/), etcd | A; etcd v3.6 learning docs | The distinction between etcd coordination and protecting arbitrary external resources; lease/lock limits and fencing implication. | 2026-08-23 |
| 28-10 | [etcd API overview](https://etcd.io/docs/v3.6/learning/api/), etcd | A; etcd v3.6 learning docs | Key/value, lease, watch, revision and transaction building blocks used by coordination. | 2026-08-23 |
| 28-11 | [Distributed locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/), Redis | A; current Redis docs | Single-instance random-token lock, compare-and-delete, Redlock algorithm, safety/liveness assumptions, clock drift and fencing disclaimer. | 2026-08-23 |
| 28-12 | [`SET` command](https://redis.io/docs/latest/commands/set/), Redis | A; current Redis command docs | Atomic conditional set and expiration options used by a Redis acquisition example; exact command/version must be pinned. | 2026-08-23 |
| 28-13 | [Introduction to Redis programmability and `EVAL`](https://redis.io/docs/latest/develop/interact/programmability/eval-intro/), Redis | A; current Redis docs | Server-side script atomicity and blocking behavior; script scope is not an external transaction. | 2026-08-23 |
| 28-14 | [ZooKeeper recipes](https://zookeeper.apache.org/doc/r3.7.2/recipes.html), Apache ZooKeeper | A; ZooKeeper 3.7.2 docs | Ephemeral/sequential lock recipe, predecessor watching, session ownership, and ordered acquisition pattern. | 2026-08-23 |
| 28-15 | [ZooKeeper CLI](https://zookeeper.apache.org/doc/current/zookeeperCLI.html), Apache ZooKeeper | A; current documentation | Session/ephemeral inspection and operational command boundary; not evidence of external fencing. | 2026-08-23 |
| 28-16 | [Leases](https://kubernetes.io/docs/concepts/architecture/leases/), Kubernetes | A; current Kubernetes docs | Lease objects for heartbeats, node/controller coordination, and Kubernetes API scope. | 2026-08-23 |
| 28-17 | [Coordinated leader election](https://kubernetes.io/docs/concepts/cluster-administration/coordinated-leader-election/), Kubernetes | A; current Kubernetes docs | Kubernetes leader-election behavior and the distinction between active controller selection and business-write fencing. | 2026-08-23 |
| 28-18 | [Lease API](https://kubernetes.io/docs/reference/kubernetes-api/coordination/lease-v1/), Kubernetes | A; current Kubernetes API reference | Lease fields, holder identity, renew time/duration and versioned API contract. | 2026-08-23 |
| 28-19 | [Consul sessions](https://developer.hashicorp.com/consul/docs/automate/session), HashiCorp Consul | A; current Consul docs; exact Consul version unresolved | Session TTL/renewal/invalidation behavior and session-based lock lifecycle. | 2026-08-23 |
| 28-20 | [Consul session API](https://developer.hashicorp.com/consul/api-docs/session), HashiCorp Consul | A; current API docs; version/provider scope | Session create/renew/destroy API and invalidation semantics; does not terminate a stale client. | 2026-08-23 |
| 28-21 | [Consul lock command](https://developer.hashicorp.com/consul/commands/lock), HashiCorp Consul | A; current CLI docs; version/provider scope | Consul lock command behavior and its advisory/session coordination boundary. | 2026-08-23 |
| 28-22 | [The Chubby lock service for loosely-coupled distributed systems](https://www.usenix.org/legacy/events/osdi06/tech/full_papers/burrows/burrows.pdf), Google, USENIX | A; OSDI 2006 original paper | Lock-service design, sessions, sequencers and the operational rationale for making clients/resource operations robust to stale ownership. | 2026-08-23 |
| 28-23 | [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html), Martin Kleppmann | B; independent technical critique, 2016 | Counterexample to treating timing-based distributed locks as protection for external resources; fencing-token argument and Redlock limits. | 2026-08-23 |
| 28-24 | [Optimistic locking with version number](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BestPractices_OptimisticLocking.html), AWS DynamoDB | A; current DynamoDB docs; provider/version scope | Version-attribute conditional write and conflict failure as an alternative to a separate lock. | 2026-08-23 |
| 28-25 | [Implement optimistic locking with version number](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BestPractices_ImplementingVersionControl.html), AWS DynamoDB | A; current DynamoDB docs | Version-control implementation shape and stale-write rejection boundary. | 2026-08-23 |
| 28-26 | [Working with items](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html), AWS DynamoDB | A; current DynamoDB docs | Conditional writes/updates and item-level authority; exact capacity/transaction behavior remains provider-specific. | 2026-08-23 |
| 28-27 | [Request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions?authuser=14), Google Cloud Storage | A; current Cloud Storage docs; provider/region/API scope | Generation/metageneration preconditions as resource-side stale-write protection and their retry/latency considerations. | 2026-08-23 |

## Discovery exclusions and unresolved source limits

- PostgreSQL links use the current documentation path; the deployed major version and extension/driver behavior remain unknown. Advisory-lock semantics also depend on connection/session ownership in the actual pool.
- etcd pages span v3.6 and v3.7 documentation. The API and concurrency behavior must be checked against the deployed etcd/client version; a page version is not a deployment guarantee.
- Redis documentation is first-party evidence of the algorithm’s stated assumptions, not proof that those assumptions hold in a target topology. The Redlock critique is retained as a competing limit, not as a replacement product specification.
- ZooKeeper, Kubernetes, and Consul session/election mechanisms coordinate their own authorities. No inspected source proves that a stale client is physically stopped or that an arbitrary external resource will reject its late write without fencing.
- DynamoDB and Google Cloud Storage conditional-write examples are provider-specific alternatives. They do not imply that every database/object store offers identical compare-and-swap semantics.
- Original/secondary candidates that repeated the same Redis token-delete snippet or asserted “exactly once with a lock” without a resource-side condition were excluded. No SEO benchmark was used to support TTL, throughput, or fairness numbers.

## Gate status

- [x] Complete EN/VI files and exact item IDs read.
- [x] Broad discovery performed; 27 selected sources mapped to claims with URL, organization, tier, revision, and review date.
- [x] Definitions, invariants, workload, failure/crash windows, retries/timeouts, operations/recovery, security/privacy, testing, and domain trade-offs covered.
- [x] Comparison table, contradiction/limits table, negative evidence, duplicate/canonical ownership, EN/VI parity plan, and falsifiers recorded.
- [x] Version/provider scope and unresolved source limits recorded.
- [x] Final authority/product/failure model approved at the content-contract level; deployment-specific choices remain explicit unknowns.
- [x] Content changes integrated into `public/data` in Batch A.
- [x] Validation run after integration and rechecked in the final gate.
