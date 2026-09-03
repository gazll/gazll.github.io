# Research - Reliability, operations, recovery, and testing

Status: `INTEGRATED`
Reviewed: 2026-08-23
Batch: E

This dossier is the cross-unit gate for operating a system after it has been designed: user-facing SLOs, actionable alerting, incident command, production diagnosis, backup/restore, rollout safety, and tests that exercise the failure paths. It treats reliability as an observable and recoverable contract, not as a replica count or a green dashboard.

## Local scope

The primary integration scope is:

| Unit | Local responsibility in this batch | Existing canonical boundary |
| --- | --- | --- |
| Topic 20 - `20-observability-sre` | User-facing SLIs/SLOs, alert policy, incident lifecycle, async/business signals, and telemetry failure | Topic 21 owns host/JVM/network diagnosis; Topic 14 owns deployment/collector mechanics; Topic 27 owns edge metrics. |
| Topic 21 - `21-linux-production-debug` | Safe, evidence-first production diagnosis across Linux, JVM, file descriptors, memory, and network | Topic 20 owns SLO/incident signals; Topic 23 owns Java concurrency semantics; this topic must not become a command encyclopedia. |
| Topic 26 - `26-testing-strategy` | Failure-state tests, recovery/replay/restore gates, contract tests, and proof limits | Topic 20 owns operational SLOs; Topics 08/09/25 own messaging/workflow semantics. |
| Case 05 - `05-scale-and-whats-next` | Source-scoped operational lessons from Tiki's scale narrative | The case keeps Tiki chronology and recommendations; it does not become a universal SRE recipe. |
| Case 14 - `14-small-business-cloud-cost-shock` | Cost simplification with reliability, backup, restore, and operational-risk gates | The case keeps local bill evidence; it does not publish current cloud prices or promise one-server availability. |

Already integrated units are links, not duplicate tutorials: Topic 10 owns overload/admission, Topic 15 owns transport deadlines, Topic 17 owns API timeout/unknown semantics, Topic 25 owns retry/cascade/cache mechanics, Topic 28 owns leases/fencing, and Case 03 owns Tiki's broader historical platform evolution. Case 17 SSH hardening remains a security/trust-boundary unit for Batch F.

## Decision thesis

1. **Reliability is measured at the user or business boundary.** CPU, GC, queue depth, and replica health explain risk; they are not automatically the SLI. A booking service may need accepted-booking correctness, confirmation age, reconciliation lag, and user-visible latency, not only HTTP 200 rate.
2. **An SLO is a control loop, not a badge.** Define the event population, success, latency/freshness window, exclusions, target, evaluation window, and action when the error budget burns. A high target copied from current performance can create heroic toil without improving user outcomes.
3. **Page on actionable impact or imminent hard failure.** Symptom/SLO alerts are the default; cause alerts are justified when they predict an irreversible or rapidly approaching failure with an owner. Every page needs a runbook, a bounded next action, and an escalation path.
4. **Telemetry is itself a bounded dependency.** Context propagation, cardinality, collector queues, memory limits, sampling, retention, and redaction must be designed so observability cannot exhaust the application or silently erase the evidence needed for recovery.
5. **Incident response optimizes mitigation before explanation.** Declare scope and roles, stabilize with reversible actions, preserve evidence, communicate, verify user/business recovery, then learn. “Pods are green” is not recovery if queues, data, payments, or reconciliation remain wrong.
6. **A backup is not a recovery capability until restore is tested.** RPO is an observed data-loss boundary and RTO is an observed recovery time. Restore tests must include dependencies, credentials/configuration, schema/version compatibility, data integrity, traffic re-entry, and a rollback/cleanup plan.
7. **Tests are proofs of bounded behavior, not a coverage ritual.** Place each invariant at the cheapest trustworthy level: unit/property for pure rules, real-engine integration for provider behavior, contract tests for boundaries, state-machine/fault tests for retries and unknown outcomes, and controlled resilience tests for recovery claims.
8. **A green test can still be weak evidence.** It may use a closed load model, a mock instead of the real database, a test-only transaction, a stale fixture, no concurrent collision, no crash between side effect and checkpoint, or a restore path nobody has exercised.

## Glossary and invariants

| Term | Operational meaning for this batch | Common misuse to remove |
| --- | --- | --- |
| SLI | A measured, versioned user/business outcome with a denominator and observation point | Calling any host metric an SLI. |
| SLO | A target for an SLI over a stated window, with policy when the budget burns | Treating 99.9% as universally correct or as an SLA. |
| Error budget | Allowed SLI failure over the same scope/window as the SLO | A license to spend failures without a mitigation/review policy. |
| Alert | A notification requiring a defined human or automated action | A dashboard query that pages because it looks interesting. |
| Incident | A coordinated operational state with impact, owner, decisions, communication, and recovery evidence | A ticket with no severity/commander or an alert that never gets closed. |
| RPO | Maximum tolerable data loss measured from the authoritative recovery point | “We have replicas, therefore RPO is zero.” |
| RTO | Maximum tolerable time to restore the required user/business function | “The backup completed, therefore recovery is fast.” |
| Recovery | Service plus data, dependencies, controls, queues, and user-visible invariants are within contract | “The process restarted” or “the load balancer is healthy.” |
| Test oracle | The invariant/observable outcome that determines pass/fail | A snapshot, mock call count, or code coverage number by itself. |

Core invariants:

1. Every critical user journey has an SLI, owner, SLO/window, alert policy, runbook, and a recovery verification query.
2. Every page is actionable, deduplicated, routed to an owner, and tested when the monitoring path is degraded.
3. Telemetry is bounded by memory, queue, cardinality, sampling, privacy, and cost budgets; telemetry loss is visible.
4. An incident has one coordinating role, an explicit timeline, reversible mitigation where possible, and a closure checklist covering user impact, data correctness, backlog/freshness, security, and follow-up.
5. A backup/restore run proves the stated RPO/RTO on production-shaped data and includes configuration, secrets, permissions, schema, indexes, and dependent services.
6. A deployment/migration has a health gate, canary or staged exposure when risk warrants, progress/deadline detection, rollback or forward-fix ownership, and a data repair path.
7. Resilience tests have a hypothesis, blast-radius guard, stop condition, observable success criteria, and an evidence artifact.
8. A test that passes only with mocks, H2, an uncommitted transaction, serial execution, or a closed workload is labeled for what it does not prove.

## State machines and control loops

### SLO to action

```text
DEFINE SLI -> MEASURE DENOMINATOR -> COMPARE SLO -> BUDGET HEALTHY / BURNING
                                                   |             |
                                                   v             v
                                             NORMAL RELEASE   PAGE / TICKET / FREEZE
                                                                    |
                                                                    v
                                                     MITIGATE -> VERIFY -> LEARN
```

An SLO control loop must be stable: the measurement window, alert burn rate, paging delay, mitigation time, and release policy must be compatible. A one-minute spike may page an interactive checkout but be a ticket for a batch pipeline; the same percentage has different user and operational meaning.

### Incident lifecycle

```text
DETECT -> DECLARE -> SCOPE/ASSIGN -> STABILIZE -> RECOVER -> VERIFY -> CLOSE/LEARN
                    |                         |
                    v                         v
              COMMUNICATE                  ESCALATE
                    |                         |
                    +-----------<-------------+
```

- `DETECT` records the first signal and its reliability; manual discovery is itself evidence about monitoring.
- `DECLARE` assigns severity, incident lead, operations/communications roles, affected journeys/tenants/data, and an update cadence.
- `STABILIZE` prefers reversible actions: rollback, feature disable, traffic shift, load shedding, quota, failover, credential isolation, or a safe degraded mode.
- `RECOVER` restores the user path and drains/repairs state; it is not complete when only infrastructure is healthy.
- `VERIFY` checks SLI, backlog/queue age, outbox/CDC/reconciliation lag, duplicate/lost work, data invariants, security exposure, and customer communication.
- `CLOSE/LEARN` records timeline, impact, contributing conditions, detection/mitigation gaps, owned actions, due dates, and a later verification that actions work.

### Recovery proof

```text
BACKUP INVENTORY -> ISOLATED RESTORE -> INTEGRITY CHECK -> DEPENDENCIES/CONFIG
       -> REPLAY OR CATCH-UP -> TRAFFIC SMOKE -> SLO + BUSINESS RECONCILIATION
       -> EVIDENCE ARTIFACT -> APPROVE RETURN / ROLLBACK
```

The recovery artifact should record backup ID and age, WAL/log position or snapshot, restore duration, data checksum/control totals, schema/application version, configuration/secret source, queue/replay position, observed RPO/RTO, failed steps, and operator approval. A restore to a blank database without application traffic or business checks proves only that bytes can be copied.

## Failure and evidence matrix

| Failure window | What can look healthy while being broken | Evidence and recovery obligation |
| --- | --- | --- |
| SLI denominator excludes errors | Dashboard says 99.99% while failed/unknown requests are not counted | Version the event definition, test denominator/exclusions, and compare with independent user/business signals. |
| Alert evaluator or notification path fails | Service is burning budget but nobody is paged | Monitor the monitoring path, use an independent heartbeat/synthetic signal, and retain manual escalation. |
| Trace/metric pipeline overloads | Application is healthy but investigation evidence is dropped or telemetry consumes memory | Bound queue/memory/cardinality, prioritize error signals, monitor collector self-metrics, and document degraded telemetry. |
| Retry/circuit action amplifies load | Each client sees a timeout while downstream receives a retry storm | Budget attempts across the call chain, include deadline remaining, cap concurrency, and shed/reject safely. |
| Rollout stalls after partial exposure | Old and new versions both serve traffic with incompatible schema/config | Detect progress deadline, keep expand/contract compatibility, halt/ramp back, and define forward-fix/rollback. |
| Host/JVM diagnosis changes the system | Heap dump, profiler, packet capture, or debug flag worsens memory/latency | Use bounded, reversible, permissioned captures; record overhead and stop conditions; prefer evidence before intervention. |
| Backup exists but restore is untested | Missing WAL/config/credentials/indexes or RTO is exceeded | Isolated restore rehearsal with production-shaped data, dependencies, control totals, and timed traffic return. |
| Incident service recovers but state does not | Queue, outbox, CDC, refund, inventory, or reconciliation backlog remains | Verify lag, replay duplicates/gaps, domain invariants, manual break queue, and customer-visible correction. |
| Test suite passes only in a friendly model | Real engine locks, time, concurrency, network, or provider schema differs | Run focused real-engine/contract/fault tests and label what unit tests intentionally do not prove. |
| Chaos/failure test has no guardrail | Test itself causes uncontrolled outage or data loss | Pre-production rehearsal, blast-radius target, stop condition, rollback, owner, and evidence review. |

## Decision table by workload

| Workload/domain | Primary reliability signals | Recovery/testing emphasis | What not to page on alone |
| --- | --- | --- | --- |
| Bank/fintech command/ledger | Accepted command correctness, duplicate/unknown outcome, ledger reconciliation age/value, authorization latency, durable commit | Restore/PITR, immutable ledger/control totals, provider timeout reconciliation, idempotent replay, audit evidence | CPU, average latency, or HTTP success without ledger checks. |
| OTA booking | Search latency/freshness, hold expiry, confirm/unknown age, supplier error/timeout, reconciliation backlog, customer promise | Supplier contract/fault tests, timeout-after-commit, replay/compensation, manual break queue, reservation invariant | Search index freshness as proof that a booking exists. |
| Commerce/fulfillment | Order acceptance, inventory delta, pick/ship age, carrier acknowledgement, refund age, queue/backlog | Event replay, physical/control-total reconciliation, partner contract tests, offline scan duplicates, staged migration | Pod count or API 200 while inventory/finance diverges. |
| Search/catalog | User-visible search success/latency, projection freshness/lag, index error rate, reindex progress | Versioned reindex, alias rollback, source-vs-index parity, stale fallback | Database CPU alone or a green index cluster with stale documents. |
| Batch/analytics | Completion deadline, queue age, freshness/watermark, row/control totals, late/corrected data | Checkpoint/restart, idempotent chunk replay, schema compatibility, restore/warehouse rebuild | Interactive p99 as the only success criterion. |
| Small early-stage product | Critical journey availability, restore/RTO/RPO, cost per business unit, on-call load, deploy rollback time | Reproducible environment, backup restore, smoke/load test, simple staged deploy, budget/anomaly response | Enterprise topology count, 100% uptime target, or infrastructure spend without unit economics. |

## Duplicate and canonical ownership

| Repeated mechanism | Canonical owner | Batch E treatment |
| --- | --- | --- |
| Retry storm, timeout, circuit breaker, bulkhead, backpressure | Topic 25 plus Topic 10 for admission/overload | Add test/incident/recovery evidence; do not re-teach algorithm variants. |
| API timeout/unknown/idempotency | Topic 17 | Verify incident and test paths use the same outcome contract. |
| Broker/outbox/consumer replay | Topics 08/09 and Case 15 | Measure lag and repair; do not call an outbox an SLO by itself. |
| Cache invalidation/coalescing | Topic 25 and Cases 09/13 | Keep projection freshness and recovery checks only. |
| Database restore/CDC recovery | Topics 05/06/07/18 | Retain engine-specific backup/restore and reconciliation obligations. |
| Kubernetes probes/PDB/rollout | Topic 14 | Case/topic content states the failure boundary and links to provider docs; no second K8s tutorial. |
| SLO, alerting, incident, telemetry | Topic 20 | Canonical method and user/business signal vocabulary. |
| Linux/JVM/network diagnosis | Topic 21 | Canonical evidence-first production commands and safety limits. |
| Test levels, contract, integration, fault injection | Topic 26 | Canonical proof selection and test oracle. |
| Tiki operations | Case 05 | Domain-specific workflow and operator evidence. |
| Cost simplification | Case 14 | Local bill/cost hypothesis plus recovery/security gates. |

## Coverage matrix

| Gate area | Topic 20 | Topic 21 | Topic 26 | Cases 05/14 |
| --- | --- | --- | --- | --- |
| Definitions | Strong signals/SLO vocabulary; three-pillars shorthand needs scope | Strong Linux/JVM/network terms; version/command caveats required | Strong test-double/integration/fault vocabulary | Historical terms need source and date scope |
| Invariants | SLI denominator, telemetry boundedness, recovery verification | Do-no-harm diagnosis, evidence preservation, permission boundaries | Observable behavior, real provider boundary, deterministic failure oracle | Operational state/data/cost/recovery invariants missing in narrative |
| Workload | Request mix, async age/freshness, telemetry volume | CPU/I/O/memory/network/container/JVM workload | Open/closed load, concurrency, provider/version, data shape | Tiki operations and small-business workload assumptions |
| Failure/recovery | Alert/collector/incident/queue/reconciliation windows | OOM, FD/port, deadlock, network and capture overhead | Retry/timeout/race/restore/contract/chaos windows | Production incidents, cloud simplification, backup/restore |
| Operations | Runbooks, ownership, error budget, postmortem, telemetry cost | Safe command order, capture limits, rollback | CI feedback, quarantine policy, evidence artifact | Operator workflow, cost ledger, ownership and rollback |
| Security/privacy | PII/secrets/cardinality/telemetry retention | Privileged commands, heap/log/packet data | Test secrets, production data, fault-test access | Address/POD/logs, IAM, backups, CI secrets |
| Testing | Alert/SLI/telemetry pipeline tests | Reproduce with safe load/capture and failure drills | Real engine, contract, property, fault, recovery | Restore, reconciliation, environment recreation, unit economics |

## Negative evidence and anti-patterns

- Do not page on every symptom metric; a page without an owner/action is alert noise.
- Do not define an SLO from the easiest metric while excluding timeouts, rejected work, stale data, or unknown outcomes users experience.
- Do not equate replicas, backups, or a completed backup job with a tested RPO/RTO.
- Do not close an incident because pods are ready, CPU is normal, or traffic returned; verify domain state and backlog.
- Do not take a heap dump, enable verbose logging, or run a packet capture without a bounded impact/privacy plan.
- Do not retry the same operation independently at every layer; compose an attempt/deadline budget across the call chain.
- Do not use H2, an uncommitted test transaction, or a mock as evidence of production lock/commit behavior.
- Do not let a flaky test be retried invisibly until green; quarantine with an owner and deadline while preserving failure evidence.
- Do not call a chaos experiment “resilience” when it has no hypothesis, stop condition, recovery check, or artifact.
- Do not copy Tiki's operational scale or a `$312` bill into a capacity/cost recommendation without the original workload, date, region, and assumptions.

## Unknowns and falsifiers

| Unknown | How to measure/resolve | Falsifier |
| --- | --- | --- |
| Which user/business outcome is critical? | Journey map, support data, revenue/risk analysis, domain owner | Host metrics improve while customers still fail or wait. |
| What is the correct SLO denominator? | Event schema, synthetic and server-side reconciliation | Exclusions hide real failures or denominator changes between releases. |
| Can the team respond within the budget? | Page drill, on-call load, TTM/MTTR, runbook rehearsal | Alert arrives after the budget is gone or no owner can act. |
| What is the actual RPO/RTO? | Timed restore/failover with production-shaped data and dependencies | Restore misses target, lacks config/WAL/credentials, or returns wrong control totals. |
| Does a retry policy help? | Fault test with downstream load, attempt counts, deadline and queue metrics | Retries increase overload or produce duplicate/unknown side effects. |
| Does a test provide confidence? | Mutation/fault/contract/real-engine/recovery evidence | Test is green while the real provider, concurrent path, or restore path fails. |
| Is simplification cost-safe? | 90-day cost ledger plus load/restore/rollback drills | Savings remove recovery/security capability or increase risk-adjusted unit cost. |
| Is observability sustainable? | Telemetry volume/cardinality/queue/memory/cost and drop metrics | Collector/backend failure affects application or leaves no recoverable evidence. |

## Selected source ledger

Reviewed 2026-08-23. The candidate search was capped at 200 candidates; the selected ledger keeps 43 distinct standards, official implementation documents, first-party reliability guidance, and testing references. Numbers in this dossier are examples or provider-scoped unless the source defines the exact window/contract.

### SLOs, incidents, and operational practice

1. [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
2. [Google SRE: Production Services Best Practices](https://sre.google/sre-book/service-best-practices/)
3. [Google SRE: Embracing Risk](https://sre.google/sre-book/embracing-risk/)
4. [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)
5. [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
6. [Google SRE: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)
7. [Google SRE Workbook: Incident Response](https://sre.google/workbook/incident-response/)
8. [Google SRE Workbook: Error Budget Policy](https://sre.google/workbook/error-budget-policy/)
9. [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/)
10. [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
11. [Google SRE: Data Integrity](https://sre.google/sre-book/data-integrity/)
12. [Google Cloud: CRE incident-mitigation lessons](https://cloud.google.com/blog/products/management-tools/shrinking-the-time-to-mitigate-production-incidents)
13. [Google Cloud: Production Readiness Review](https://cloud.google.com/blog/products/gcp/how-sres-find-the-landmines-in-a-service-cre-life-lessons)
14. [NIST SP 800-61 Rev. 3 incident response](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
15. [NIST SP 800-34 contingency planning](https://csrc.nist.gov/pubs/sp/800/34/r1/final)

### Telemetry and alerting reliability

16. [OpenTelemetry Context](https://opentelemetry.io/docs/specs/otel/context/)
17. [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
18. [OpenTelemetry Messaging Spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/)
19. [OpenTelemetry Collector Resiliency](https://opentelemetry.io/docs/collector/resiliency/)
20. [OpenTelemetry Collector Internal Telemetry](https://opentelemetry.io/docs/collector/internal-telemetry/)
21. [OpenTelemetry Collector Processors](https://opentelemetry.io/docs/collector/components/processor/)
22. [OpenTelemetry Collector Troubleshooting](https://opentelemetry.io/docs/collector/troubleshooting/)
23. [Prometheus Recording and Alerting Rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
24. [Prometheus Histograms and Summaries](https://prometheus.io/docs/practices/histograms/)
25. [Prometheus Alerting Rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)

### Deployment, disruption, and recovery

26. [Kubernetes Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
27. [Kubernetes Disruptions and PodDisruptionBudgets](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
28. [Kubernetes Rolling Update and Rollback](https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/)
29. [Kubernetes PDB configuration task](https://kubernetes.io/docs/tasks/run-application/configure-pdb/)
30. [AWS Well-Architected Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
31. [AWS Reliability Pillar PDF](https://docs.aws.amazon.com/pdfs/wellarchitected/latest/reliability-pillar/wellarchitected-reliability-pillar.pdf)
32. [AWS Backup Restore Testing](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html)
33. [AWS Fault Injection Service](https://docs.aws.amazon.com/fis/)
34. [AWS DevOps Guidance](https://docs.aws.amazon.com/pdfs/wellarchitected/latest/devops-guidance/devops-guidance.pdf)
35. [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
36. [PostgreSQL Continuous Archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
37. [Testcontainers](https://testcontainers.com/)

### Test strategy and service boundaries

38. [Pact contract testing introduction](https://docs.pact.io/)
39. [Pact consumer tests](https://docs.pact.io/consumer)
40. [Pact specification](https://docs.pact.io/implementation_guides/pact_specification)
41. [Martin Fowler: Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
42. [AWS Fault Injection experiment execution](https://docs.aws.amazon.com/fis/latest/userguide/run-experiment.html)
43. [Google SRE: Testing for Reliability](https://sre.google/sre-book/testing-reliability/)

## Integration record (applied 2026-08-23)

The five bilingual topic items and the EN/VI qualifiers for Cases 05 and 14 listed in the integration map were already present in `public/data` when this dossier was re-audited. No duplicate item IDs or article anchors were added. The generated content index contains all five topic IDs; EN/VI parity, case anchors, references, and the full validation gate were rerun after this closeout.

- [x] Topic 20 (two items), Topic 21, and Topic 26 (two items) are present in EN/VI with their persistent IDs unchanged.
- [x] Cases 05 and 14 contain the historical/reliability and cost/recovery qualifiers in both article languages.
- [x] Provenance is recorded in this dossier's 43-source ledger and the per-item review metadata.

## Integration map and gate

| Public unit | Proposed smallest patch | Evidence it must not claim |
| --- | --- | --- |
| Topic 20 | Two bilingual items: async/business SLO signals; alert/incident closure and telemetry failure boundary | No universal three-pillars count, alert threshold, or availability target. |
| Topic 21 | One bilingual item: safe, bounded production diagnosis and evidence capture | No universal profiler overhead or command order independent of kernel/JDK/container. |
| Topic 26 | Two bilingual items: distributed failure-state tests; recovery/restore/cutover proof | No claim that test pyramid proportions or coverage prove production reliability. |
| Case 05 | EN/VI qualifier for historical operational scale and SLO/ownership/recovery unknowns | No current Tiki metrics or causal proof from a historical narrative. |
| Case 14 | EN/VI qualifier for cost/availability hypothesis and restore/security gate | No fixed price, one-server guarantee, or cost saving without line items and workload. |

Gate status:

- [x] Exact EN/VI maps for five units recorded.
- [x] Candidate source pool searched broadly; selected ledger has 43 distinct sources.
- [x] Facts, inferences, recommendations, limits, falsifiers, state machines, and failure matrix recorded.
- [x] Canonical ownership and duplicate boundaries recorded.
- [x] Add five bilingual topic items and EN/VI case qualifiers.
- [x] Rebuild content index, verify parity/case anchors, and run the full check gate.
- [x] Mark per-unit records and this dossier `INTEGRATED` after validation passed.
