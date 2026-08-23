# Research — Tiki at scale in 10 years

Status: INTEGRATED
Reviewed: 2026-08-23
Local unit: `03-tiki-scale-in-10-years`
EN file: `public/data/case-studies/articles/03-tiki-scale-in-10-years.html`
VI file: `public/data/case-studies/articles/03-tiki-scale-in-10-years.vi.html`
Metadata EN/VI: `public/data/case-studies/03-tiki-scale-in-10-years.json`, `public/data/case-studies/03-tiki-scale-in-10-years.vi.json`

## Scope and non-goals

This is a historical first-party narrative of Tiki's organizational, application and infrastructure evolution from roughly 2013 through 2020. It is useful as a longitudinal case study, not as an independently verified benchmark, a universal microservices recipe or a current description of Tiki. The reported service counts, employee counts, traffic, migration time and “fastest” claims remain attributed to the article.

The research question is: which scaling constraints changed over time, which engineering practices helped, and which lessons generalize only after workload, organization, data ownership and reliability targets are made explicit?

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| `1-xay-dung-nen-tang-talaria` | Magento-to-Talaria replacement; five engineers/six months; 2015 transition | First-party historical narrative; dates and team size self-reported |
| `2-kien-truc-phi-tap-trung-de-mo-rong-nghiep-vu` | ERP, Marketplace, centralized-to-microservices and service/team growth | Useful evolution story; service-count definition and ownership are unclear |
| `3-he-thong-phan-tan-lon` | Product/order/visit growth, real-time integrations, thousands RPS and reporting | First-party scale claims; workload dimensions and SLOs are missing |
| `4-xay-dung-ha-tang-vung-chac` | Virtualization, CI/CD, Kubernetes and Google Cloud migration | Strong chronology; migration risk, rollback and control-plane details are absent |
| `5-nhung-thoi-khac-kho-khan` | 2013 crash, 2015 dual sync, 2017 migration, 2018 crash waves and 10/10 recovery | Valuable incident memory; no postmortem evidence or causal metrics |

Both language files preserve the same five Vietnamese IDs and the same narrative structure. The English headings are translated but the IDs are not; do not rename IDs during content integration without a route/index migration plan.

## What is correct and reusable

- Scaling is multi-dimensional: the article connects product breadth, team size, data integration, traffic, release frequency, infrastructure and incident learning instead of treating “scale” as only requests per second.
- Replacing a platform can be a product and organizational decision, not merely a database migration. Talaria is presented as an answer to product scope and business evolution.
- Decentralization can increase team autonomy and business modularity, but it moves complexity into contracts, data ownership, observability and operations.
- A migration story is most useful when paired with the difficult moments: dual-sync discrepancies, long crashes, data migration pressure and deployment/recovery practices.
- CI/CD and Kubernetes are enabling mechanisms, not reliability guarantees. Their value depends on tested rollbacks, ownership, capacity, security and SLOs.
- First-party scale numbers provide context for why architectural choices were made; they should be written as reported historical observations with units and dates, not timeless targets.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Tiki had 700 codebases, 500 systems, 200+ engineers, 400m interactions/month and 5,000+ employees | First-party historical fact | Tiki introduction | Add “the article reports” and date/measurement definition; the figures are not independently verified | Medium |
| Talaria was built by five engineers in six months and replaced Magento in early 2015 | First-party historical fact | Section 1 | Define “built,” scope of migration and whether six months includes operations/data migration | Medium-to-high |
| Marketplace moved from centralized to microservices in three months and Tiki reached about 500 services | First-party historical fact | Section 2 | “Service” and “system” must be distinguished; migration completeness and runtime count are unknown | Medium |
| Product changes exceeded 20m/day, product views 4m/day, searches 3m/day and order transactions hundreds of thousands/day | First-party scale claim | Section 3 | Add time window, peak vs average, event/read/write definitions and retention/latency SLO | Medium |
| Reports were available within minutes and integrations were real-time | First-party operational claim | Section 3 | “Real-time” needs a maximum lag; reports within minutes is eventual, not synchronous consistency | Medium |
| Infrastructure grew roughly 10x while product growth was dozens of times | First-party ratio claim | Section 4 | Explain resource dimensions and denominator; this is not a universal efficiency benchmark | Low-to-medium |
| Kubernetes was adopted in 2016 and more than 40 changes/day were possible | First-party historical fact | Section 4 | Deployment frequency alone does not show lead time, failure rate or recovery | Medium |
| Hundreds of services moved to Google Cloud in under one month and it was fastest in Asia-Pacific | First-party claim, partly comparative | Section 4 | Retain as an attributed claim unless comparative evidence and scope are supplied; add migration risk/rollback details | Low |
| 2015 dual sync showed discrepancies for one month | First-party incident memory | Section 5 | Record as a crash window/data-integrity lesson; root cause, reconciliation and loss are unknown | Medium |
| 2018 crashes lasted up to four hours before successful sales waves | First-party incident memory | Section 5 | Add incident date, affected components, recovery mechanism and customer impact if available | Medium |
| Decentralization made business expansion easier | Inference | Narrative sequence | Explain mechanisms (ownership, deploy independence, bounded domains) and costs; do not treat as causal proof | Medium |
| More services and Kubernetes are the natural answer to growth | Over-absolute inference | Local chronology only | Compare modular monolith, managed services, queues, sharding and organizational alternatives | Low |

## Workload, invariants, and failure model

### Workload model

- Read-heavy customer interactions coexist with bursty writes for product, order, seller, inventory and fulfillment domains.
- Product data changes arrive from many sources and must propagate to search/catalog/order/reporting views with different freshness needs.
- Peak sale events create correlated load spikes, not just a stable average RPS. Averages in the article cannot size peak capacity without concurrency, payload and tail-latency data.
- The organization is itself a workload: hundreds of services and 200+ engineers create a change, dependency, ownership and incident-response graph.
- Migration workloads include schema/data movement, dual-write or dual-read reconciliation, traffic cutover, rollback and operational training.

### Invariants

1. Each business capability has a declared system of record and a contract for ownership; duplicated writable truth requires a reconciliation protocol.
2. Customer-visible reads specify freshness and correctness expectations per domain; product search may be eventually consistent while payment/order state needs stricter guarantees.
3. A deployment is reversible or has a tested forward-recovery plan; data migrations are backward-compatible across the rollout window.
4. Capacity plans cover peak traffic, dependency fan-out, queue lag, database connections, storage, and failure of a fraction of instances/zones.
5. Every service has an owner, SLO/SLI, dependency map, access policy, runbook and telemetry contract.
6. Organization and architecture boundaries remain aligned enough that a team can change a component without synchronized edits across the entire company.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| New platform receives traffic before old system is fully reconciled | Divergent product/order state | Dual-read comparison, authoritative owner and cutover/rollback criteria |
| Dual-write succeeds in one system and fails in the other | Silent data divergence | Durable change log, retry-safe writes, reconciliation and alert on age/delta |
| Service decomposition splits a transaction across domains | Partial business state | Explicit workflow/compensation or keep the transaction within an owner boundary |
| Release pipeline deploys incompatible producer/consumer | Runtime errors or data loss | Expand/contract schema, contract tests, canary and rollback-safe versioning |
| Kubernetes reschedules a stateful or overloaded workload | Latency, duplicate work or unavailable data | Readiness/liveness correctness, capacity reserves, persistent storage and disruption policy |
| Peak traffic exceeds a dependency rather than the frontend | Retry storm and cascading failure | Per-dependency budgets, admission control, load shedding and bounded retries |
| Cloud migration cutover fails | Prolonged outage or split-brain | Staged waves, checkpointed transfer, DNS/traffic rollback and reconciliation |
| High deployment frequency exceeds review/observability capacity | Change failure and operator fatigue | SLO/error budget, progressive delivery, incident learning and ownership limits |

The local incident section is valuable because it exposes these windows but does not document all controls. The integrated case should not imply that the successful outcome proves the migration or service model is generally safe.

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Talaria, Marketplace, systems/services, infra and milestones | Kubernetes concepts; CNCF definition; GCP migration taxonomy | Define codebase/system/service/workload and distinguish logical from deployed counts |
| Invariants | Narrative values and migration success | AWS Well-Architected; GCP migration docs; SRE data integrity | Add ownership, compatibility, reconciliation, SLO and rollback invariants |
| Workload | Historical traffic/product/order figures | SRE overload; Kubernetes autoscaling; DORA metrics | Add peak/average, concurrency, fan-out, payload, dependency and growth units |
| Failure/crash windows | Four difficult moments | SRE cascading failures; Google migration guidance | Turn incidents into timeline, detection, containment, recovery and prevention table |
| Retries/timeouts | Barely covered | AWS retry/idempotency; SRE service practices | Add deadline propagation, retry budgets, idempotent writes and queue backpressure |
| Operations/recovery | CI/CD/Kubernetes and successful waves | Error budgets, PRR/dependency SLO, OpenTelemetry | Add SLOs, error budget policy, rollbacks, runbooks, telemetry and disaster drills |
| Security/privacy | Not covered | Google Cloud network/security architecture; Kubernetes security | Add IAM, secrets, network segmentation, supply-chain signing and data residency |
| Testing | Implied by migration/release | SRE testing/reliability chapters; DORA | Add load, chaos, contract, migration rehearsal, restore and security testing |
| Domain trade-offs | Centralized vs decentralized evolution | AWS OE organization/design principles; GCP migration types | Explain when modular monolith/managed service is preferable to microservices |

## Best-practice comparison

| Local lesson | Current practice / evidence | Assessment and boundary |
| --- | --- | --- |
| Replace monolith as product scope expands | GCP distinguishes rehost, replatform, refactor, re-architect and rebuild | Keep migration as a decision matrix; do not present rewrite/microservices as the default. |
| Decentralize around business capabilities | AWS OE recommends teams organized around business outcomes and ownership | Good organizational hypothesis; verify service boundaries, platform team load and data contracts. |
| Run hundreds of services on Kubernetes | Kubernetes provides declarative deployment/autoscaling primitives | It manages workload placement, not domain consistency, capacity correctness or incident response. |
| Increase changes/day with CI/CD | DORA measures throughput and instability together | Pair frequency with lead time, change failure rate, failed deployment recovery and reliability. |
| Migrate quickly to cloud | Google migration guidance recommends discover/assess, plan, deploy, optimize and workload-specific choices | “Under a month” is not a recommendation; use staged waves, rollback and data reconciliation. |
| Build infrastructure ahead of growth | SRE capacity/load testing and error budgets | Use measured saturation, tail latency and failure testing rather than infrastructure multiples. |
| Learn from crashes | SRE postmortem and incident practices | Preserve the incident timeline and add causal evidence, action owners and verification. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| 500 systems/services shows scale | “System,” “service,” codebase and deployed workload may be counted differently | Avoid comparing the number with other companies or architecture maturity. |
| Real-time integration and reports within minutes coexist | Real-time must have a bounded lag; reports are explicitly eventual | Name freshness per data product and avoid “real-time” as a binary label. |
| Decentralization increases speed | It also creates distributed transactions, version skew, network failure and operational toil | Include costs and the cases where a modular monolith is safer. |
| 40+ changes/day implies delivery excellence | Frequency can increase change failure and burnout without quality/recovery measures | Use the full DORA/SLO picture. |
| Kubernetes makes infrastructure robust | A control plane can reschedule broken workloads and amplify bad probes/configuration | Add capacity, state, security and failure-domain caveats. |
| Cloud migration in <1 month is best | Speed may reflect scope, parallel teams or a business deadline; it can increase data/cutover risk | Record it as a historical feat, not a target. |
| Successful 10/10 sales waves prove reliability | Survivorship bias; earlier crashes and unknown near misses remain | Require incident population, load envelope and recovery evidence. |

## Negative evidence and anti-patterns

- Do not use service count as a maturity, performance or reliability metric.
- Do not split a database or transaction boundary merely to create a microservice; define data ownership and recovery first.
- Do not use deployment frequency as a proxy for safe delivery without failure rate, recovery time and customer impact.
- Do not migrate stateful systems with dual writes but no reconciliation, idempotency and cutover rollback.
- Do not put every team on a shared platform without platform capacity, paved roads, ownership and incident support.
- Do not autoscale from CPU alone when queue depth, database connections, memory, downstream quotas or business backlog are the real bottleneck.
- Do not call a migration successful because traffic moved; verify data parity, tail latency, security controls and rollback readiness.
- Do not infer that a historical Tiki decision remains optimal after cloud, framework, organization or traffic characteristics change.

## Operational, security, observability and testing concerns

- Service catalog: owner, repository, deploy artifact, data stores, dependencies, SLOs, criticality, RTO/RPO, access policy and deprecation state.
- Golden signals and business SLIs: latency percentiles, traffic, errors, saturation, queue lag, product freshness, order correctness, reconciliation delta and customer-impact rate.
- Change safety: immutable artifacts, provenance/signing, dependency scanning, canary/blue-green, schema expand/contract, automated rollback and migration checkpoints.
- Kubernetes operations: resource requests/limits, HPA signals, disruption budgets, topology/failure domains, probe semantics, cluster upgrade plan, stateful backup/restore and admission policy.
- Cloud security: least-privilege IAM, separate environments/projects, secret management, network segmentation, encryption, audit logs, data residency and vendor exit/recovery plan.
- Testing: load and soak at peak-shaped traffic, dependency failure, retry storm, queue saturation, node/zone loss, database restore, schema compatibility, migration rehearsal, chaos, contract and security tests.
- Organizational safety: error-budget policy, on-call ownership, incident command, postmortems, toil budget, platform SLO and limits on service sprawl.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic microservice decomposition and distributed transaction patterns | System-design topics for microservices/distributed transactions | Keep the longitudinal Tiki decision context and link to canonical pattern material. |
| Queue semantics, outbox and replay | Topic `08-message-queue` and Case 15/transactional-outbox evidence | Mention only where the historical timeline requires it. |
| Infrastructure scaling and cloud migration | This case for Tiki's chronology; generic cloud/SRE guidance remains external/canonical | Own the time-series of constraints and difficult moments, not a cloud-provider tutorial. |
| Inventory/search/fulfillment domain implementations | Other assigned cases 01, 05, 07 and 09 | Cross-link the domain evidence; avoid repeating their algorithms or benchmarks here. |
| Team/organization operating model | Generic organization/engineering-practice topic if created | Keep reported team/service evolution and qualify causality. |

## Proposed content changes (not yet applied)

1. Add a date/unit column to every scale number and label it as “reported by Tiki Engineering.”
2. Define `codebase`, `system`, `service`, `product change`, `view`, `search`, `order transaction`, `real-time` and `report within minutes`.
3. Add a timeline table for Talaria, Marketplace, Kubernetes, cloud migration and each incident, with what changed, why, result and unknowns.
4. Reframe “decentralization” as a trade-off table: autonomy/parallelism versus data contracts, observability, consistency, platform toil and incident coordination.
5. Replace infrastructure multiples and “fastest in Asia-Pacific” with attributed historical claims and an explicit “not independently verified” note.
6. Add SLO/error-budget/DORA measures alongside “40+ changes/day”; do not invent values if they are unavailable.
7. Add a migration safety subsection covering discovery, dependency graph, dual-write/dual-read, parity checks, staged cutover, rollback and restore.
8. Add a failure-mode table for the 2015 dual-sync discrepancy and 2018 crashes; preserve unknown root causes as open questions.
9. Link Arcturus, demand forecasting, Pegasus and operations case studies for domain-specific evidence; keep generic queue/saga material canonical elsewhere.

## EN/VI and cross-reference plan

- Preserve the five existing Vietnamese IDs in both EN/VI files; translate text only, not IDs or timeline entities.
- Use the same table and labels for reported numbers, dates, units, confidence and unknowns in both languages.
- Standardize `decentralized`, `microservice`, `system of record`, `data parity`, `cutover`, `rollback`, `SLO`, `error budget`, `change failure rate` and `recovery time`.
- Keep the “values” conclusion (curious, daring, pragmatic) as a first-party cultural interpretation, separate from verified engineering outcomes.
- Cross-link domain cases by evidence rather than repeating the same generic advice about microservices, queues, saga or outbox.

## Integration record (Batch D scope)

- [x] Added EN/VI evidence qualifiers around the reported scale figures, real-time integration wording, and the 2015/2017 migration outcomes.
- [x] Added a source-of-truth, CDC/change-contract, parity, staged-cutover, rollback, and repair boundary without rewriting Tiki's historical narrative.
- [ ] The broader audit of historical definitions, SLOs, cloud scope, and current platform status remains a follow-up; the article's figures remain attributed and source-scoped.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| What do the service/system/codebase counts include? | Historical inventory or engineering metrics definition | Counts use incompatible units; any comparative claim becomes invalid. |
| What were peak and tail workloads? | Time-series dashboards, request mix, concurrency and dependency budgets | A design passes averages but violates peak SLO or overload safety. |
| Which data stores owned which business facts? | Service/data ownership map and schema history | Two services remained writable sources without reliable reconciliation. |
| How was the one-month dual-sync discrepancy detected and repaired? | Incident report, parity queries and backfill logs | Divergence was silent, unrecoverable or customer-impacting beyond the narrative. |
| What made the 2018 waves succeed? | Capacity/load tests, change diffs and incident timeline | Success depended on an unrepeatable one-off condition or the same failure recurs under equivalent load. |
| Was the cloud migration truly complete in under a month? | Scope, wave list, data transfer and cutover records | The claim excludes critical dependencies/data or cannot be reproduced for the stated scope. |
| Did service decomposition improve delivery reliability? | DORA/SLO/incident data before and after | Change failure, recovery time or customer incidents worsened after decomposition. |
| Are Kubernetes and CI/CD still the current platform choices? | Repository/platform inventory and supported versions | Version/EOL/security changes make the historical tool choice unsafe today. |

## Discovery pool and exclusions

The discovery pool contained approximately 42 candidates; 26 distinct sources were selected. Duplicated versions of the same Tiki article, generic “microservices scale” SEO posts, vendor case studies without methods, and sources that only repeated Kubernetes definitions were excluded. The ledger combines Tiki first-party history with official SRE, DORA, Kubernetes and cloud-migration guidance.

## Sources

All sources were reviewed on 2026-08-23. Historical Tiki figures are not upgraded to present-day facts merely because current platform documentation exists.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Tiki @ Scale in 10 Years](https://engineering.tiki.vn/tiki-scale-in-10-years/) — Tiki Engineering | T1 first-party; historical article, page revision not stated | Milestones, reported counts, traffic, infrastructure chronology and incidents. |
| 2 | [Scale and what’s next](https://engineering.tiki.vn/scale-and-whats-next/) — Tiki Engineering | T1 first-party; early-2020 article | Operations/finance/fulfillment scale context and next-step themes. |
| 3 | [AWS Well-Architected Framework](https://docs.aws.amazon.com/pdfs/wellarchitected/2024-06-27/framework/wellarchitected-framework-2024-06-27.pdf) — AWS | T1 official; 2024-06-27 revision | Reliability, operational excellence, least privilege and workload-specific trade-offs. |
| 4 | [Operational excellence: organization](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/organization.html) — AWS | T1 official; current page | Team ownership, business outcomes and organizational capability. |
| 5 | [Operational excellence design principles](https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/oe-design-principles.html) — AWS | T1 official; 2024-06-27 framework | Small autonomous teams, operations as code, safe change and learning. |
| 6 | [DORA metrics](https://dora.dev/guides/dora-metrics/) — DORA/Google Cloud | T1 research guidance; current page | Throughput/instability metrics and why deployment frequency alone is incomplete. |
| 7 | [DORA research](https://dora.dev/) — DORA/Google Cloud | T1 first-party research program; current page | Organizational capabilities and the limits of simplistic performance comparisons. |
| 8 | [Google SRE book](https://sre.google/sre-book/) — Google | T1 first-party book; 2017 edition online | SLOs, error budgets, incident response, capacity and reliability practices. |
| 9 | [Handling overload](https://sre.google/sre-book/handling-overload/) — Google SRE | T1 first-party chapter; current online edition | Load shedding, retry budgets, queue growth and degraded responses. |
| 10 | [Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | T1 first-party chapter; current online edition | Dependency overload, queues, retries, resource exhaustion and failure cascades. |
| 11 | [Production services best practices](https://sre.google/sre-book/service-best-practices/) — Google SRE | T1 first-party chapter; current online edition | Load testing above rated capacity, dynamic timeouts and graceful degradation. |
| 12 | [Defining SLOs with dependencies](https://cloud.google.com/blog/products/devops-sre/defining-slos-for-services-with-dependencies-cre-life-lessons) — Google Cloud SRE | T1 first-party; current blog | Dependency budgets and service-level objective composition. |
| 13 | [Error budgets and maintenance windows](https://cloud.google.com/blog/products/management-tools/sre-error-budgets-and-maintenance-windows) — Google Cloud SRE | T1 first-party; current blog | Error-budget decision making and maintenance/change risk. |
| 14 | [Migrate to Google Cloud: get started](https://docs.cloud.google.com/architecture/migration-to-gcp-getting-started?hl=en) — Google Cloud | T1 official; current guide | Rehost/replatform/refactor/re-architect/rebuild distinctions and migration phases. |
| 15 | [Migration planning overview](https://docs.cloud.google.com/migration-center/docs/migration-planning-overview?authuser=3) — Google Cloud | T1 official; current guide | Discovery, dependency mapping, migration waves and foundation planning. |
| 16 | [Building a large-scale migration program](https://cloud.google.com/building-a-large-scale-migration) — Google Cloud | T1 first-party white paper page; current | Discover/assess, plan, migrate and optimize program structure; not proof of Tiki's speed claim. |
| 17 | [Architect your workloads across regions](https://docs.cloud.google.com/architecture/migrate-across-regions/architect-workloads?authuser=2) — Google Cloud | T1 official; reviewed 2024-07-24 | Landing zone, workload, storage and decommissioning considerations. |
| 18 | [Kubernetes concepts](https://kubernetes.io/docs/concepts/) — Kubernetes | T1 official; page modified 2020-06-22, current docs | What Kubernetes manages and the distinction between workload/platform abstractions. |
| 19 | [Autoscaling workloads](https://kubernetes.io/docs/concepts/workloads/autoscaling/) — Kubernetes | T1 official; current docs, last modified 2025-11-23 | HPA/VPA/event-driven scaling and limits of the scaling signal. |
| 20 | [Deployment API/concept](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) — Kubernetes | T1 official; current docs | Declarative rollout, controlled replacement and rollback behavior. |
| 21 | [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — OpenTelemetry | T1 specification; semconv 1.44.0 registry | Consistent HTTP/database/messaging telemetry and cross-service correlation. |
| 22 | [Prometheus documentation](https://prometheus.io/docs/introduction/overview/) — Prometheus | T1 official; current docs | Time-series metrics, labels and pull model; exact deployment suitability remains workload-specific. |
| 23 | [CNCF cloud-native definition](https://github.com/cncf/toc/blob/main/DEFINITION.md) — CNCF | T1 project definition; revision not pinned | Terms such as containers, service meshes, microservices and declarative APIs; not a maturity score. |
| 24 | [The Twelve-Factor App](https://12factor.net/) — Heroku/community project | T2 first-party methodology; current site | Config, disposability, backing services and deployment ideas; not a complete reliability/security standard. |
| 25 | [AWS database decomposition: joins](https://docs.aws.amazon.com/prescriptive-guidance/latest/database-decomposition/joins.html) — AWS Prescriptive Guidance | T1 official; current page | Data ownership, eventual consistency, CQRS, retries and compensation when decomposing a database. |
| 26 | [Cloud network/security architectures](https://docs.cloud.google.com/architecture/network-architecture) — Google Cloud | T1 official; reviewed 2025-01-13 | Hybrid migration, zero-trust and cloud data-plane security considerations. |
