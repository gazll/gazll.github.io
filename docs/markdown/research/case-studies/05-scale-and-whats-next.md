# Research — Scale and what’s next: Tiki operations

Status: INTEGRATED
Reviewed: 2026-08-23
Local unit: `05-scale-and-whats-next`
EN file: `public/data/case-studies/articles/05-scale-and-whats-next.html`
VI file: `public/data/case-studies/articles/05-scale-and-whats-next.vi.html`
Metadata EN/VI: `public/data/case-studies/05-scale-and-whats-next.json`, `public/data/case-studies/05-scale-and-whats-next.vi.json`

## Scope and non-goals

This case describes Tiki's Operations Product around order fulfillment, delivery, after-sales and finance. It is a first-party product/operations narrative from the early 2020 period, not a current WMS/TMS/ERP specification and not evidence that a single platform should own all of those domains.

The research question is: how should a high-volume commerce operations platform combine inventory truth, warehouse work, carrier integration, returns and financial reconciliation while retaining operator usability and recoverability?

The dead `work.plonely.com` companion link is recorded as a content gap, not silently replaced with an invented design.

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| `order-fulfilment` | Paper shelf lists to batch picking, route optimization, PDA workflow and product/location/quantity inventory | Strong operational narrative; exact process state machine and inventory ownership are missing |
| `delivery-after-sales-finance` | GHN, VNPost, Tiki Express, 11k+ wards/communes, Excel-to-API/mobile, delivery proof, returns and accounting | Useful integration/workload map; external contracts, reconciliation and privacy are not documented |
| `what-s-next` | Inventory/order balancing, ML/optimization, picking priority, cycle checks, routing, finance warehouse, project tracking and operator co-design | Good roadmap; no prioritization criteria, safety gates or outcome measurements |

EN and VI use identical section IDs and structure. The English text is a translation with some absolute wording (“exact to the penny”) that should be scoped to accounting reconciliation rather than treated as a universal distributed-consistency guarantee.

## What is correct and reusable

- Fulfillment is a stateful workflow, not a CRUD screen: order release, wave/batch pick, item confirmation, exception, pack, handoff and delivery proof have different actors and failure/retry rules.
- Inventory must be modeled at product/variant, location, quantity and state granularity. “Quantity” without available/reserved/damaged/in-transit distinctions is insufficient for replenishment and customer promises.
- Route planning is a constrained optimization problem. Capacity, time windows, depot/driver constraints and dropped/late deliveries matter; an “optimal route” is not simply shortest distance.
- Carrier and partner integrations should use explicit state transitions, idempotency keys, timestamps, evidence and reconciliation. An API success response is not proof that physical handoff occurred.
- Finance needs a separately governed ledger/reconciliation model. Exact arithmetic within an accounting system does not make asynchronous source ingestion complete or correct.
- Operator co-design, manual exception handling and cycle-check suggestions are reliability features: they provide a controlled path when automation meets damaged stock, missing scans, partner outages or unusual orders.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Daily sales exceeded an entire October 2014 month | First-party historical claim | Tiki introduction | Add date, currency/order definition and source metric; do not use as a current scale number | Medium |
| Operation Product was built in-house for Operations, Finance, Accounting and Admin | First-party product claim | Tiki introduction | Define module boundaries, ownership and integration contracts | Medium-to-high |
| Batch picking plus optimal route improved picking | First-party design claim | `order-fulfilment` | “Optimal” needs objective, constraints, solver time limit and human override; outcome data is absent | Medium |
| Detailed inventory tracks product, location and quantity | First-party feature claim | `order-fulfilment` | Add SKU/lot/serial/state/available-reserved definitions and authoritative write path | High as local text; incomplete model |
| Delivery covers GHN, VNPost and Tiki Express and more than 11k wards/communes | First-party historical scope | `delivery-after-sales-finance` | Partner coverage and ward count are time/region-specific; confirm current source data before updating | Medium |
| Excel → API → mobile app modernizes operations | First-party workflow narrative | Tiki article | Add import validation, versioning, duplicate handling, offline behavior and rollback | Medium |
| Delivery status/timestamps/proof-of-delivery support operations | First-party feature claim | Tiki article | Define authoritative event, evidence retention, late/out-of-order update policy and customer visibility | High as design intent |
| Finance must be accurate to the penny | First-party requirement, over-absolute wording | Tiki article | Say ledger arithmetic/reconciliation requires exact decimal semantics; completeness and source correctness remain separate | High as requirement; too broad as claim |
| Data from many sources must reconcile | General systems fact plus local requirement | Tiki article; Stripe/Adyen/AWS guidance | Add reconciliation keys, cutoffs, idempotency and break resolution | High |
| ML and optimization should automate replenishment/routing | Roadmap recommendation | `what-s-next` | Gate by segment, forecast uncertainty, service-level risk and operator override; no universal automation claim | Medium |
| Real-time routing is desirable | Product aspiration | Tiki article | Define update frequency, traffic source, route stability and cost; real-time may increase churn/driver burden | Medium |
| Operator co-design improves the system | Design recommendation | Tiki article | Treat as hypothesis measured by task time, error rate, adoption and exception recovery | Medium |

## Workload, invariants, and failure model

### Workload model

- Orders arrive in bursts and create coupled work: inventory allocation, wave release, picking, packing, carrier handoff, customer notifications and finance entries.
- Warehouse work is location-sensitive. A single SKU can be distributed across bins/warehouses, with limited worker/device capacity and exceptions such as damaged, missing or substituted stock.
- Delivery integrates multiple carrier APIs and more than 11k historical geographic units. Partner availability, route/ETA semantics and status vocabularies differ.
- After-sales creates reverse logistics: return authorization, pickup, receipt, inspection, refund/credit, restock or write-off.
- Finance ingests orders, payments, fees, refunds, delivery charges, inventory movements and operational expenses with different cutoffs and correction paths.
- ML/optimization is a decision service with model/version latency and uncertainty; it must not directly mutate irreversible business state without policy checks.

### Invariants

1. Every physical or logical inventory movement has a unique movement/event ID, source, actor/system, timestamp and before/after or delta semantics.
2. Available stock, reserved stock, picked stock, in-transit stock, returned stock and damaged/write-off stock have non-overlapping or explicitly reconcilable states.
3. A pick task cannot be completed twice; partial/short pick and substitution are explicit outcomes.
4. A shipment/order status transition is monotonic or versioned; late carrier events cannot move a delivered/refunded order back to an earlier state without an explicit correction workflow.
5. Carrier calls, webhooks and mobile retries are idempotent; an uncertain timeout is reconciled rather than assumed failed.
6. Financial postings use exact decimal/ledger semantics, immutable audit history and reversible correction entries; source reconciliation is complete before close.
7. Route plans satisfy capacity/time-window/driver/depot constraints and expose a feasible fallback when optimization times out.
8. ML/optimization recommendations are versioned, explainable enough for operators, bounded by safety policies and never silently override a manual exception.
9. PII, addresses, phone numbers, payment and proof-of-delivery artifacts are accessible only to authorized roles and retained for a defined period.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| Order allocated but wave release fails | Stock is reserved without work or customer promise ages | State machine, timeout/sweeper and operator queue |
| Worker scans item and device loses network before ack | Duplicate scan or missing pick | Idempotent scan ID, offline queue, conflict resolution and audit |
| Batch route generated with stale location/stock | Impossible or inefficient pick path | Version input snapshot, validate feasibility and re-plan/override |
| Carrier API times out after accepting request | Duplicate shipment/label or unknown state | Idempotency key, query/reconcile endpoint, bounded retry and manual exception |
| Carrier webhook arrives late/out of order | Delivered/returned state regresses | Event version/timestamp policy and terminal-state correction workflow |
| Delivery proof upload succeeds locally but not centrally | Customer/finance cannot prove handoff | Durable upload, checksum, retry/resume, retention and reconciliation |
| Return received but inspection/refund fails | Stock and financial state diverge | Saga/workflow with compensating/correction entries and operator queue |
| Source import/partner feed has duplicate/missing rows | Finance close or inventory balance is wrong | Batch ID, control totals, schema validation, idempotent upsert and break report |
| Ledger posts before operational source is final | Premature close or later manual correction | Cutoff/watermark, suspense account and controlled adjustment entries |
| Optimization service times out | No route or stale route | Feasible heuristic fallback, time limit, partial solution status and operator control |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Picking, routing, delivery, after-sales, finance | GS1 EPCIS/traceability; OR-Tools; OpenAPI/RFC | Define inventory state, event, task, shipment, proof, return and reconciliation record. |
| Invariants | Product/location/quantity and accounting accuracy implied | GS1; PCI DSS; Stripe/Adyen reconciliation docs | Add movement IDs, monotonic states, ledger/reconciliation and access invariants. |
| Workload | Orders, partners, wards, warehouse and finance sources | OR-Tools routing; AWS Supply Chain | Add burst, batch, geography, offline and partner-rate-limit assumptions. |
| Failure/crash windows | Manual exceptions and multi-source reconciliation implied | Temporal workflows/retry; AWS idempotency; SRE overload | Add explicit state/retry/recovery table. |
| Retries/timeouts | Not detailed | Temporal retry policies; AWS backoff; OpenAPI webhooks | Define per-operation deadline, idempotency key and retry owner. |
| Operations/recovery | Operator UX, cycle checks, reconciliation need | Google SRE; OpenTelemetry; AWS OE | Add queues, break reports, SLOs, close/reopen, replay and runbooks. |
| Security/privacy | Not covered | PCI DSS; NIST Privacy Framework; cloud security | Add role/access, PII/address/POD retention, payment boundaries and audit. |
| Testing | Co-design and future automation implied | OR-Tools constraints/time limits; workflow testing | Add state-machine, partner contract, offline, financial control-total, load and chaos tests. |
| Domain trade-offs | Automation vs human operations; speed vs accuracy | GS1, SRE, OR-Tools | Keep operator override, feasible fallback and service-level trade-offs explicit. |

## Best-practice comparison

| Local decision/idea | Comparable practice | Assessment and boundary |
| --- | --- | --- |
| Batch picking with route optimization | Constrained VRP with capacities/time windows and explicit search limits | Strong fit; “optimal” must become an objective plus feasible/timeout status. |
| Inventory detail by location/quantity | Event/traceability model such as GS1 EPCIS | Use movement events and state projections; GS1 is a vocabulary/interchange aid, not Tiki's schema. |
| Excel/API/mobile workflow | Versioned import/API with idempotency and control totals | Keep human-friendly entry but validate, stage, dedupe and reconcile every batch. |
| Carrier states and proof | Webhook/event workflow with correlation and replay | Model state transitions and evidence, not just current status columns. |
| Finance data warehouse/reconciliation | Immutable ledger + source reconciliation/suspense | Separate exact arithmetic from completeness and late corrections. |
| ML for replenishment/picking | Probabilistic forecast/optimization with service-level guardrails | Automate only reliable segments and provide a safe manual/heuristic fallback. |
| Operator co-design | Human-in-the-loop workflow and progressive automation | Measure operator error/time/adoption; do not treat “smart” as success by itself. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| Exact finance to the penny | Exact decimal arithmetic does not guarantee complete, timely or correctly mapped source data | Add control totals, reconciliation status, suspense and correction entries. |
| Real-time routing | Frequent re-optimization can destabilize routes and burden workers/drivers; maps/traffic data may be stale | Define freshness, route-change threshold and human acceptance. |
| Optimal route | VRP is computationally hard; solvers may return good/partial solutions under a time limit | Record objective, constraints, solver status and fallback. |
| One operations product across domains | Shared UI/platform can become a coupling point and privilege boundary | Keep domain ownership, APIs and role separation explicit. |
| ML automates replenishment | Forecast error, stockout-censored demand, cold starts and promotions make recommendations uncertain | Require confidence/segment gates and observe business outcomes, not only model metrics. |
| Partner APIs create delivery truth | Partner outages, duplicate webhooks and physical reality can disagree with API state | Reconcile against scans/proof and expose unknown/pending states. |
| More automation reduces manual work | Exception workload can grow and become harder if no controlled manual path exists | Design operator queue, override and audit as first-class features. |

## Negative evidence and anti-patterns

- Do not put inventory, carrier, return and accounting state in one mutable table without ownership, versioning and correction semantics.
- Do not treat an Excel import as a trusted source; stage it, validate schema/control totals and make retries idempotent.
- Do not retry a label/shipment/refund command without an idempotency key and an uncertainty-reconciliation path.
- Do not accept a route solely because a solver returned it; validate capacity, time windows, worker/driver constraints and current stock.
- Do not let a forecast directly trigger irreversible replenishment without lead-time, service-level, budget and override guardrails.
- Do not store proof-of-delivery images or addresses in broad operational logs.
- Do not close finance based on “all API calls succeeded”; reconcile counts, amounts, fees, refunds and cutoff windows.
- Do not remove operator controls in pursuit of full automation; manual correction is part of the reliability boundary.

## Operational, security, observability and testing concerns

- Workflow SLIs: order-to-wave age, pick completion/short-pick rate, scan duplicate rate, pack/hand-off latency, carrier acknowledgement lag, delivery promise error, return cycle time and refund aging.
- Inventory SLIs: available/reserved delta, negative/oversold attempts, location accuracy, movement event lag, reconciliation variance, stale allocation and cycle-count adjustment rate.
- Finance SLIs: source control-total variance, unreconciled item age/value, duplicate posting, late event count, close duration, suspense balance and correction rate.
- Optimization/ML SLIs: feasible-solution rate, solver timeout, route churn, constraint violations, recommendation acceptance, override rate, stockout/overstock/service-level outcome and model drift.
- Event traces: correlation/order/fulfillment/return IDs, source, event version, attempt and watermark; avoid addresses/payment details in high-cardinality telemetry.
- Security: role-based access by warehouse/region/finance function; least privilege for carrier/payment APIs; encrypt address/POD artifacts; segregate payment card data to a PCI-scoped provider; audit exports and manual adjustments.
- Testing: contract tests for each carrier, webhook replay/out-of-order tests, device offline/duplicate scan tests, route constraint/property tests, inventory conservation, ledger double-entry/control-total, close/reopen, disaster restore and load/chaos tests.
- Recovery: replay a workflow from its event history or batch ID, rebuild projections, compare with physical counts and ledger, hold affected customer/finance actions when invariants are unknown, and document operator resolution.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic saga/outbox/message queue | Topics `09-distributed-tx-fintech`, `08-message-queue` and Case 15 | Keep only order/return/carrier domain state transitions and link to canonical mechanics. |
| Inventory hot-key processing | Case 01 Arcturus | Cross-link for concurrency/serialization; do not duplicate its benchmark/offset algorithm. |
| Demand forecasting | Case 07 | Own the operational decision boundary and downstream guardrails; leave model details to Case 07. |
| Catalog/API/cache | Case 09 Pegasus | Link only where catalog/location data is a dependency. |
| Fulfillment, carrier, return and finance operations | This case | Own the end-to-end operator workflow, reconciliation and human-in-loop trade-offs. |
| Generic route optimization | OR-Tools/optimization topic | Explain constraints and fallback; do not reproduce solver documentation. |

## Proposed content changes (not yet applied)

1. Split the broad narrative into explicit state machines for order fulfillment, shipment, return and accounting/reconciliation.
2. Add an inventory state table with available/reserved/picked/in-transit/returned/damaged quantities and movement IDs.
3. Replace “optimal route” with objective, constraints, solver time limit, feasible fallback and operator override.
4. Add integration contracts for carriers: idempotency key, request/response status, webhook version, proof artifact, timeout and reconciliation endpoint.
5. Add a batch-import contract for Excel/API/mobile: schema version, control totals, staging, dedupe, approval, retry and rollback.
6. Reword “absolute accuracy” to an accounting requirement with exact arithmetic plus completeness/reconciliation controls.
7. Add operational SLOs, break queues, close/reopen workflow, suspense and correction entries; do not invent monetary/latency numbers.
8. Turn ML/optimization roadmap into gated automation: reliable segment, uncertainty/service-level threshold, human override, canary and rollback.
9. Mark the `work.plonely.com` companion link as unavailable unless a verified replacement is supplied.
10. Keep EN/VI structure identical and cross-link Cases 01, 07 and 09 instead of repeating generic patterns.

## EN/VI and cross-reference plan

- Preserve the three IDs and the bilingual process vocabulary for `pick`, `wave`, `short pick`, `handoff`, `proof of delivery`, `return`, `refund`, `reconciliation`, `control total`, `suspense` and `cutoff`.
- Add the same state-machine and failure tables to EN/VI; do not translate external partner names or API fields.
- Mark historical counts and dead links identically in both languages.
- Keep operator-facing wording concrete and avoid translating “real-time” or “exact” into stronger guarantees than the English source.
- Link generic queue/saga/outbox material to canonical topics; link inventory and forecasting details to Cases 01 and 07.

## Integration record (Batch E scope)

- [x] Added EN/VI operational qualifiers separating the first-party fulfillment narrative from current SLO, capacity, ownership, reconciliation, and recovery guarantees.
- [x] Added source-of-truth, break-queue, control-total, replay, partner-retry, and operator-correction boundaries without rewriting the historical case.
- [ ] The broader audit of current Tiki platform status, partner contracts, and measured operational outcomes remains a follow-up.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| Which system owns allocatable inventory? | Data ownership/schema/event map | Multiple writers can change available stock without a common invariant or reconciliation. |
| Are warehouse scans online/offline and how are duplicates handled? | PDA/mobile protocol and event IDs | A retry after disconnect creates duplicate picks or loses physical movement. |
| What exactly is “optimal” in route planning? | Objective/constraints/solver settings and outcome metrics | Solver timeout/route churn or constraint violations outweigh distance/picking gains. |
| How are carrier status and proof reconciled? | Partner contracts, webhook logs and proof store | API state diverges from physical scans/customer claims without recovery. |
| How are finance source feeds closed? | Batch IDs, control totals, cutoff and break-management runbook | Unreconciled value/volume remains open or corrections overwrite history. |
| Which ML segments are reliable enough to automate? | Backtests, service-level outcomes and override/drift data | Automation raises stockouts, overstock, route failures or operator workload. |
| What privacy/regulatory constraints apply to addresses/POD/payment? | Data inventory, retention and PCI/privacy assessment | The design cannot limit access or delete/retain evidence according to policy. |
| Is the linked companion tool still available? | Verified first-party URL/archive | No source can verify it; keep the link marked unavailable. |

## Discovery pool and exclusions

The discovery pool contained approximately 43 candidates; 27 distinct sources were selected. Duplicate Tiki scale narratives, generic ERP/WMS marketing pages, route-optimization SEO content, and payment pages without reconciliation semantics were excluded. The final set prioritizes Tiki first-party context, GS1 standards, official optimization/workflow/API/security documentation and first-party reliability guidance.

## Sources

All sources were reviewed on 2026-08-23. Provider documentation is used for the specific behavior it documents; it is not evidence that Tiki used that provider or that the historical architecture had the same contract.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Scale and what’s next](https://engineering.tiki.vn/scale-and-whats-next/) — Tiki Engineering | T1 first-party; early-2020 historical article | Fulfillment, delivery, after-sales, finance and roadmap narrative. |
| 2 | [Tiki @ Scale in 10 Years](https://engineering.tiki.vn/tiki-scale-in-10-years/) — Tiki Engineering | T1 first-party; historical article | Historical sales/scale context; not an independent current metric. |
| 3 | [EPCIS 2.0 Standard](https://ref.gs1.org/standards/epcis/2.0.0/) — GS1 | T1 standard; Release 2.0 ratified June 2022 | Event/traceability vocabulary and sharing model for physical/digital supply-chain events. |
| 4 | [Global Traceability Standard](https://ref.gs1.org/standards/global-traceability/2.0.0/) — GS1 | T1 standard; Release 2.0 ratified August 2017 | Traceability roles, events and data-sharing boundaries. |
| 5 | [Vehicle Routing](https://developers.google.com/optimization/routing?hl=en) — Google OR-Tools | T1 official; page current at review | VRP, capacity/time-window/resource constraints and computational limits. |
| 6 | [Common routing tasks](https://developers.google.com/optimization/routing/routing_tasks) — Google OR-Tools | T1 official; published 2026 page | Solution/time limits and initial routes/fallback concepts. |
| 7 | [Routing options](https://developers.google.com/optimization/routing/routing_options) — Google OR-Tools | T1 official; last updated 2026-03-18 | Search/solution limits, partial success, infeasibility and metaheuristics. |
| 8 | [Route Optimization API](https://developers.google.com/maps/documentation/route-optimization) — Google Maps Platform | T1 official; current docs | Task/vehicle constraints and API/provider boundary; not proof of optimality. |
| 9 | [AWS Supply Chain User Guide](https://docs.aws.amazon.com/aws-supply-chain/latest/userguide/supplychain-ug.pdf) — AWS | T1 official; current PDF reviewed | Raw-data association, data model and supply planning concepts. |
| 10 | [Supply planning overview](https://docs.aws.amazon.com/aws-supply-chain/latest/userguide/supply-planning.html) — AWS | T1 official; URL checked, page availability/version must be reconfirmed | Inventory planning terminology; unresolved if the URL/version changes. |
| 11 | [Temporal Workflows](https://docs.temporal.io/workflows) — Temporal Technologies | T1 official; current docs | Durable workflow history, deterministic replay and external activities. |
| 12 | [Temporal Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies) — Temporal Technologies | T1 official; current docs | Activity retry defaults, backoff, timeouts and non-retryable errors. |
| 13 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — Amazon Builders’ Library | T1 first-party; current article | Idempotency keys, late requests and side-effect-safe retries. |
| 14 | [Exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — AWS Architecture Blog | T1 first-party; updated 2023-05 | Retry synchronization and load amplification. |
| 15 | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | T1 Internet Standard; RFC 9110, 2022 | HTTP method/status semantics; partner API contract limits. |
| 16 | [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) — OpenAPI Initiative | T1 specification; latest page at review | Explicit API schemas, operation contracts and versioning; does not define business idempotency. |
| 17 | [Stripe reconciliation](https://docs.stripe.com/reports/reconciliation) — Stripe | T1 first-party product docs; current page | Payout/balance reconciliation concepts and the need to reconcile rather than trust one feed. |
| 18 | [Adyen reconciliation](https://docs.adyen.com/account/reconciliation/) — Adyen | T1 first-party product docs; URL/provider version should be reconfirmed | Payment accounting/reconciliation reports and batch/settlement distinctions. |
| 19 | [PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/) — PCI Security Standards Council | T1 industry standard; current DSS page | Payment-data security boundary; exact applicable version/scope requires assessment. |
| 20 | [NIST Privacy Framework](https://www.nist.gov/privacy-framework) — NIST | T1 official framework; current page | Privacy risk identification, governance and data lifecycle considerations. |
| 21 | [Handling overload](https://sre.google/sre-book/handling-overload/) — Google SRE | T1 first-party chapter; current online edition | Backpressure, graceful degradation and bounded retries. |
| 22 | [Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) — Google SRE | T1 first-party chapter; current online edition | Queue/resource exhaustion, retry amplification and early rejection. |
| 23 | [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — OpenTelemetry | T1 specification; semconv 1.44.0 registry | Consistent HTTP/database/messaging/event telemetry and correlation. |
| 24 | [Messaging semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) — OpenTelemetry | T1 specification; development status | Producer/consumer/process/settle spans, event context and messaging diagnostics. |
| 25 | [Warehouse management documentation](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/) — Microsoft Learn | T1 official product docs; current page | Comparison vocabulary for warehouse work, mobile operations and inventory processes; not a Tiki implementation source. |
| 26 | [AWS operational excellence](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/organization.html) — AWS | T1 official; current page | Ownership, operating model and continuous improvement concerns. |
| 27 | [Data integrity](https://sre.google/sre-book/data-integrity/) — Google SRE | T1 first-party chapter; current online edition | Integrity, backup/restore, corruption detection and recovery concepts. |
