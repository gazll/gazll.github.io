# System Design Cross-Reference Audit

Status: `FINAL READ-ONLY AUDIT`
Reviewed: `2026-08-23`
Scope: current `public/data/` after Batches A-I; this file records the final read-only reference audit and does not itself change public content.

## Why this exists

The library already uses parenthesized item IDs as cross-references, for example
`(08-message-queue.reliability-delivery-semantics.q6)`. This audit measures which
items are being reused most often. A high count is not automatically a problem:
it can mean that an item is a good canonical explanation. It is a review signal
for checking whether the target is canonical, whether the pointer is useful,
and whether the referring page still adds a domain-specific decision.

The audit intentionally does not decide merges or rewrite data. Those decisions
belong to the per-unit research records and the duplicate matrix.

## Method

- Scan all existing files under `public/data/` for valid cross-reference syntax.
- Count raw occurrences in both languages; EN/VI copies therefore normally count
  separately.
- Deduplicate target IDs to identify the breadth of the reference graph.
- Validate target existence with the repository content validator before any
  integration work.

Initial snapshot:

- 56 data files contain at least one cross-reference.
- 227 unique target item IDs are referenced.
- The counts below are raw occurrences across EN and VI files, not unique
  referring pages.

Final rerun on 2026-08-23:

- 56 data files contain at least one cross-reference.
- 920 raw occurrences were found across EN and VI files.
- 233 unique target item IDs are referenced.
- The scan is intentionally conservative: it counts the repository's parenthesized item-reference form and leaves prose mentions outside the graph.

The final high-frequency targets remain canonical owners rather than merge candidates. The leading counts are Topic 25 consumer idempotency (`22`), Topic 08 delivery semantics (`20`), Topic 23 async toolkit (`18`), Topic 09 Outbox (`16`), Topic 20 observability (`14`), Topic 12 architecture (`14`), and Topic 24 DDD (`14`). Each referring item must still add a local invariant, workload, authority, or failure decision.

## Most-referenced targets

| Raw uses | Target item | Initial review signal |
| ---: | --- | --- |
| 18 | `23-java-concurrency-coding.async-the-modern-toolkit.q4` | Verify that concurrency explanations are not being used as a generic async tutorial outside the Java/concurrency context. |
| 18 | `24-domain-driven-design.tactical-modelling-it.q3` | Candidate canonical aggregate-boundary explanation; domain cases should keep their own invariant and boundary decision. |
| 16 | `08-message-queue.reliability-delivery-semantics.q6` | Candidate canonical delivery-semantics explanation; check that consumers still state their side-effect/idempotency contract. |
| 14 | `12-architecture-patterns.clean-layered-building-it-for-real.q2` | Candidate canonical architecture-boundary explanation; avoid copying generic layering prose into case studies. |
| 14 | `20-observability-sre.slos-alerting-incidents.q4` | Candidate canonical SLO/alerting explanation; referring pages should add domain-specific evidence and recovery signals. |
| 14 | `25-microservice.09-idempotency-the-central-link.q1` | Strong canonical candidate for idempotency vocabulary; provider and workflow records must retain local key scope and replay semantics. |
| 12 | `09-distributed-tx-fintech.distributed-transaction-patterns.q3` | Outbox/dual-write overlap hotspot; compare with topic 25 and Case Study 15 before selecting final owner. |
| 12 | `25-microservice.05-caching-pitfalls.q4` | Check whether cache invalidation guidance is repeated instead of applying a local freshness/SLO decision. |
| 10 | `17-rest-api-design.contracts-errors-lifecycle.q4` | Candidate API error-contract owner; external-provider cases should add provider-specific unknown-state handling. |
| 10 | `12-architecture-patterns.clean-layered-building-it-for-real.q8` | Check if architectural pattern taxonomy is copied into unrelated designs. |
| 10 | `25-microservice.05-caching-pitfalls.q1` | Candidate cache correctness owner; retain local read-after-write and repair decisions in cases. |
| 10 | `10-system-design-rate-limit.framework-building-blocks.q3` | Candidate rate-limit/admission-control owner; case studies should explain which traffic is admitted or shed. |
| 10 | `17-rest-api-design.contracts-errors-lifecycle.q2` | Candidate request-contract owner; do not let this replace idempotency or provider callback analysis. |
| 10 | `18-query-optimization.rewriting-the-query-reshaping-the-model.q4` | Candidate query-shape owner; catalog/feed cases should retain their access-pattern and freshness context. |
| 10 | `24-domain-driven-design.tactical-modelling-it.q2` | Candidate aggregate/invariant owner; verify duplicate wording around transaction boundaries. |
| 8 | `24-domain-driven-design.strategic-splitting-the-domain.q3` | Candidate bounded-context owner; case studies should show ownership and integration consequences. |
| 8 | `09-distributed-tx-fintech.distributed-transaction-patterns.q6` | Review whether this is a second workflow canonical explanation or a local comparison that should point to one owner. |
| 8 | `08-message-queue.reliability-delivery-semantics.q7` | Check queue retry/DLQ ownership against topic 08's proposed canonical outline. |
| 8 | `22-low-level-design-ood.the-lld-framework-classic-problems.q3` | Verify that reusable LLD mechanics are not crowding out case-specific object ownership. |
| 8 | `18-query-optimization.measure-first-reading-the-execution-plan.q2` | Candidate measurement/execution-plan owner; preserve workload assumptions in referring cases. |
| 8 | `09-distributed-tx-fintech.correctness-where-money-is-involved.q3` | Money/ledger domain explanation should remain distinct from generic outbox and Saga mechanics. |
| 8 | `25-microservice.01-cascading-failure-retry-storm.q5` | Candidate retry-storm owner; downstream cases must state retry budget and deadline ownership. |
| 8 | `09-distributed-tx-fintech.correctness-where-money-is-involved.q1` | Unknown external outcome is a domain-specific correctness problem; compare with OTA/provider cases. |
| 8 | `25-microservice.05-caching-pitfalls.q7` | Review whether repair/invalidation guidance is generic or tied to a particular cache topology. |
| 8 | `12-architecture-patterns.clean-layered-building-it-for-real.q4` | Check for repeated architecture trade-off prose. |

## Review priorities

### Distributed correctness cluster

The most important duplicate review is the cluster around topic 09, topic 25,
Case Study 15, topic 11 payment/order prompts, and topic 16 OTA booking. The
canonical page should own protocol mechanics and failure semantics. Each domain
page should own its invariant, authority boundary, user-visible state, and
recovery/reconciliation policy.

### Delivery and idempotency cluster

Topic 08 should own broker delivery, acknowledgement, ordering, retry, and DLQ
semantics. Topic 25 or the final workflow-canonical page should own the general
idempotency contract. Payment, booking, and notification pages must retain the
provider-specific key scope, expiry, unknown result, and side-effect rules.

### Architecture and data-access cluster

The frequent DDD, clean-layer, caching, and query-optimization references are
not necessarily accidental duplication. During per-unit review, distinguish a
mechanism explanation from a local choice such as aggregate ownership, read
model freshness, hot-key handling, query shape, or rebuild/repair policy.

## Final follow-up status

- [x] Compare every high-frequency target with its assigned per-unit research
  record and decide whether it is canonical, too broad, or misleading.
- [x] Review the distributed workflow, message delivery, idempotency, booking,
  cache, and retry clusters before rewriting any content.
- [x] Confirm all references resolve after ID-preserving rewrites.
- [x] Add a cross-reference only when the target owns the explanation and the
  referring item adds a distinct domain decision.
- [x] Re-run this audit after the final integration batches and record the date/change
  summary here.
