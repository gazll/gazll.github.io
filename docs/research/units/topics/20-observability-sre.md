# Research - Observability and SRE: signals, SLOs, alerting, and incidents

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `20-observability-sre`

EN file: `public/data/topics/20-observability-sre.json`

VI file: `public/data/topics/20-observability-sre.vi.json`

## Scope and non-goals

This dossier owns the assigned topic's metrics/logs/traces/profiles, context propagation, RED/USE, cardinality, SLI/SLO/SLA/error budgets, alerting, incident response, and structured-log correlation. It is the canonical observability/SRE owner. Topic 21 owns Linux/JVM diagnostic commands; topic 14 owns Kubernetes/collector deployment mechanics; topic 27 owns gateway metrics; topic 13 owns security controls and token privacy.

The discovery pool used OpenTelemetry and W3C specifications, Prometheus/Grafana implementation docs, Google SRE books/workbooks, NIST incident-response guidance, and first-party logging/telemetry docs. The three-pillar shorthand is treated as a useful taxonomy, not a law: profiles, events, continuous verification, and domain-specific signals may be required. Provider costs, retention, sampling defaults, and alert thresholds are not universal.

## Local content map

Both JSON files were read in full. Each has 2 sections and 8 items. EN is 25,717 bytes; VI is 27,154 bytes. All section/item IDs match.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| The three pillars & how to measure | `20-observability-sre.the-three-pillars-how-to-measure.q1` to `.q4` | Signals, OTel context through services/queues, RED/USE, cardinality |
| SLOs, alerting & incidents | `20-observability-sre.slos-alerting-incidents.q1` to `.q4` | SLI/SLO/SLA/error budget, alert fatigue, incident response/postmortem, structured logs |

## What is correct and reusable

- The metrics/logs/traces distinction is a good starting point: metrics show aggregate behavior, logs show discrete events/context, and traces connect work across boundaries. The local “metric -> trace -> logs” flow should be labeled a practical workflow, not a required architecture.
- W3C Trace Context and OpenTelemetry context propagation are appropriate canonical references. The topic correctly warns that messaging context is not always a simple parent-child chain: batches and fan-out may require links, and trace context is not an authorization mechanism.
- RED (rate, errors, duration) and USE (utilization, saturation, errors) are useful lenses, but neither is a complete SLI set. Queue age, freshness, correctness, data loss, and business success can be more important than host resource utilization.
- The cardinality section correctly identifies unbounded labels such as `user_id`, raw path, and trace ID as a cost/reliability risk. Route normalization, exemplars, logs/traces, and bounded dimensions are stronger than simply increasing storage.
- SLO/error-budget material correctly makes the target an explicit policy and distinguishes time-based from request-based SLIs. The 99.9% and burn-rate numbers are examples and must retain their evaluation window/threshold context.
- The incident sequence—declare, stabilize, coordinate, verify recovery, then learn—is operationally useful. Verification must include user outcomes, queues/data reconciliation, security, and durable recovery, not only “pods are green.”
- Structured logs with correlation IDs and redaction are reusable, provided the topic distinguishes trace IDs from user identifiers and keeps cardinality/privacy controls explicit.

## Claims to verify or qualify

| Local claim/pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| Observability has exactly three pillars | Teaching shorthand | Metrics/logs/traces are common signals; OpenTelemetry also documents profiles and events. Explain the chosen signals by question/cost, not a fixed count. | High |
| Metrics are cheap/constant, logs cost years, traces cost days | Provider/retention heuristic | Storage, ingestion, sampling, compression, cardinality, region, and vendor pricing differ. Replace with a measurement/retention table. | High that it is non-universal |
| Trace context automatically survives async messaging | Incorrect absolute | Propagation must be explicitly injected/extracted; message batches/fan-out may use links; library and broker instrumentation conventions vary. | High |
| `traceparent` can be trusted as identity | Incorrect | W3C Trace Context correlates telemetry; it is untrusted input and must not authorize a user or service. | High |
| RED/USE are the SRE golden signals | Scope error | Google SRE discusses latency/traffic/errors/saturation; RED/USE is a useful derivative taxonomy, not a complete service contract. | High |
| p99 is always better than averages | Incomplete | Tail percentiles expose user pain, but aggregation/window, histogram buckets, sample size, coordinated omission, and request mix still matter. | High |
| 99.9% availability equals 43m12s downtime | Arithmetic example | True only for a 30-day time window and time-based availability; request-based SLO/error-budget math differs. State the window. | High |
| A burn-rate threshold is a universal alert threshold | Recommendation | Google SRE multi-window examples are a design pattern; target, window, traffic volume, and paging policy must be chosen for the service. | High |
| A page should be based on CPU/GC/queue symptoms | Incomplete | Page on actionable user-impact/SLO risk when possible; symptom alerts can be tickets/dashboards unless they predict a bounded impact with an owner. | High |
| Tail sampling preserves all important traces | Overstated | Tail sampling depends on collector capacity, decision latency, memory, policies, and upstream drop; it improves selection, not guaranteed completeness. | High |
| Structured logs are safe by default | Incorrect | JSON structure does not prevent tokens/PII/PCI/secrets, cardinality explosion, or malicious field injection. | High |
| A postmortem is complete when a root cause is named | Incorrect | Incident learning needs evidence, contributing factors, detection/recovery, customer impact, action owners, and follow-up verification; avoid a single-cause story. | High |

## Workload, invariants, and failure model

### Workload and SLI model

For every service, define request mix, user journey, success semantics, dependency scope, regions, traffic volume, payload sensitivity, and telemetry budget. A useful SLI can be availability, latency, freshness, correctness, queue age, durability, or a business outcome; choose the denominator deliberately. A checkout service may need “accepted payment not duplicated” and reconciliation lag, while a search service may tolerate stale results but not an empty result storm.

Observability invariants:

1. Every user-impacting request has a low-cardinality metric route/status dimension and a correlation path to sampled trace/log detail.
2. Context is propagated only across trusted/defined boundaries and is never used as authorization.
3. SLI denominators and exclusions are versioned; alerts use the same contract as the SLO.
4. Telemetry failure cannot consume unbounded application memory or block the critical business path.
5. High-cardinality/user-sensitive values are kept in controlled logs/traces with retention/redaction, not primary metric labels.
6. Alerts are actionable, owned, deduplicated, linked to a runbook, and tested when the evaluator/telemetry pipeline is degraded.
7. Recovery is verified using user SLI plus correctness/data/security checks, not only infrastructure health.

### Crash and failure windows

| Window | Failure | Detection/recovery |
| --- | --- | --- |
| Before instrumentation initializes | Early startup failure is absent from app telemetry | Use platform logs/exit codes/startup diagnostics and a synthetic/black-box SLI. |
| Context not injected/extracted | Trace splits at gateway, queue, batch, or async task | Test propagation at every protocol boundary; use links for batch/fan-out and record the boundary explicitly. |
| Sampling decision before error | A failed request is dropped by head sampling | Tail sampling/always-keep error policy where capacity allows; retain error metrics/logs independently. |
| Collector queue fills | Telemetry is dropped or consumes pod/node memory | Bound queues, monitor collector self-telemetry, prioritize error/latency signals, and define a degraded mode. |
| Cardinality spike | Metrics backend rejects/expands series; queries time out | Normalize route labels, cap dimensions, drop unsafe attributes, and alert on series/cardinality growth. |
| Log pipeline/agent outage | Correlation detail disappears while service continues | Maintain metrics/SLI independent of logs, buffer only within a bounded budget, and use local incident capture. |
| Alert evaluator or notification outage | No page despite SLO burn | Monitor the monitoring path, use independent synthetic/heartbeat alerts, and document manual checks. |
| Incident stabilizes but data is wrong | Availability recovers while duplicates/stale state remain | Reconcile business invariants, queue/backlog/freshness, security exposure, and customer-visible state before closure. |
| Retention/deletion boundary | Sensitive telemetry persists longer than allowed or required evidence is removed | Apply data classification/retention/legal hold and separate immutable incident evidence from raw sensitive payloads. |

## Best-practice comparison

| Question | Metric | Log | Trace | Profile/event/business signal |
| --- | --- | --- | --- | --- |
| Is the service healthy? | Best aggregate latency/error/rate view | Too expensive/noisy alone | Sampled detail | SLO/business correctness may be decisive |
| Which request/record failed? | Exemplar/link | Strong discrete context | Strong causal path | Event/audit record may be required |
| Where did latency go? | Histogram + dependency dimensions | Timing fields can help | Best per-hop critical path | Profile for CPU/lock/alloc causes |
| What caused a one-off? | Low-cardinality symptom | Request-safe details | Correlated spans | Controlled dump/profile with sensitive-data handling |
| What should page? | SLO/error-budget burn | Usually ticket/context | Usually investigation | Business/data/security invariants can page |

| Alerting pattern | Benefit | Limit |
| --- | --- | --- |
| Symptom/SLO-based | Tied to user impact and action | Needs enough traffic and a good denominator |
| Cause/resource-based | Detects saturation early | Can be noisy/non-actionable without impact mapping |
| Multi-window burn rate | Fast detection plus confirmation | Thresholds and traffic floor need service-specific tuning |
| Static threshold | Simple and transparent | Breaks with seasonality/traffic mix; often causes fatigue |
| Synthetic/black-box | Tests complete user path | Coverage/cost and false positives; cannot replace internal signals |

## Coverage matrix

| Gate area | Evidence and local coverage | Gap to close before integration |
| --- | --- | --- |
| Definitions | Signals, OTel, RED/USE, SLI/SLO/SLA/error budget | Add profiles/events and explicitly distinguish telemetry signal from business audit. |
| Invariants | Propagation, low-cardinality labels, SLO denominator, bounded pipeline | Add a versioned SLI contract and denominator/exclusion examples. |
| Workload | Latency mix, queue/backlog, cardinality, retention | Add volume/cardinality/retention estimates by environment and region. |
| Failure/crash windows | Context loss, sampling/drop, collector/alert outage, stale recovery | Add monitoring-the-monitoring and emergency evidence capture. |
| Retries/timeouts | Correlation across gateway/queue/dependency | Add trace attributes for retry attempt/deadline and avoid double-counting retries in SLIs. |
| Operations/recovery | Runbooks, incidents, postmortem/reconciliation | Add owner, action, severity, and verification fields to every page. |
| Security/privacy | Redaction, baggage/trace trust, PII/cardinality | Add data classification and retention/deletion rules for logs/traces/profiles. |
| Testing | Local test content covers alerting/trace behavior conceptually | Add telemetry contract, cardinality, sampling, alert-rule, outage and synthetic-path tests. |
| Domain trade-offs | Correctness/freshness/payment examples | Mark business SLI choices as domain-specific; do not equate availability with correctness. |

## Contradictions and limits

| Competing guarantee | Source boundary | Teaching implication |
| --- | --- | --- |
| OpenTelemetry semantic stability | OTel semantic conventions have mixed/stable/development areas and opt-in migration guidance. | Pin semantic-convention version and avoid assuming attribute names never change. |
| Head versus tail sampling | Head sampling is cheap/early; tail sampling can select on outcome but needs collector state/capacity. | Choose by cost/error-detection objective and measure drop rate. |
| Metrics versus detail | Metrics need bounded dimensions; logs/traces can carry detail but cost/privacy risk grows. | Use exemplars/links and sampled detail instead of putting identity in labels. |
| Time-based versus request-based SLO | Google SRE documents heterogeneous workloads and client-visible SLIs; request-based and time-window math differ. | State denominator/window and exclusions in the content. |
| Symptom versus cause alerting | Google SRE favors actionable alerts; resource symptoms can be predictive but not always customer-impacting. | Page when action is required or bounded impact is likely; ticket/dashboard otherwise. |
| Availability versus correctness | A service can return 200 with duplicate payment/stale authorization or be unavailable while preserving data. | Track correctness, freshness, and reconciliation as separate SLIs. |
| Logs versus privacy/audit | OTel/log systems support structured correlation, but no format automatically redacts or meets retention law. | Redaction, access, retention, and legal hold are separate design controls. |

## Negative evidence and anti-patterns

- Do not put `user_id`, raw URL, order ID, or trace ID into a high-volume Prometheus label without an explicit cardinality budget.
- Do not copy arbitrary inbound `baggage` into logs/metrics or use `traceparent`/baggage as an identity or authorization proof.
- Do not alert on every exception, pod restart, CPU spike, or log line without an owner/action and user-impact relationship.
- Do not use averages to hide a p99/p99.9 regression, and do not infer tail latency from a small/biased sample without stating the method.
- Do not treat an “all green” dashboard as proof that payments, data correctness, freshness, or security recovery is complete.
- Do not make telemetry exporters synchronous/unbounded on the request critical path.
- Do not increase sampling/cardinality/retention in an incident without an ingestion/storage budget; the observability system can become the second outage.
- Do not declare an incident closed before backlog, duplicate/no-op rate, reconciliation debt, or customer-visible state is checked.
- Do not copy sensitive request bodies or tokens into logs/traces “for debugging”; use redacted fields and controlled short-lived capture.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Action |
| --- | --- | --- |
| JVM/Linux commands, heap/profile safety | `21-linux-production-debug` | Link as the deep-diagnostic playbook. |
| Kubernetes collector/sidecar/DaemonSet deployment | `14-devops-k8s-best-practices` | Keep only telemetry architecture assumptions here. |
| Gateway RED/504/trace headers | `27-api-gateway-identity-edge` | Keep gateway-specific metrics and edge failure mapping there. |
| OAuth/security event privacy | `13-security-oauth2` | Link data handling and trust boundaries. |
| Broker context/consumer lag | `08-message-queue` | Keep broker delivery semantics there; this topic owns cross-signal measurement. |
| Incident workflow and postmortem case examples | This topic, with NIST/Google evidence | Keep the lifecycle and SLO alerting here; case studies can show a concrete incident. |

## Proposed content changes (not applied)

- [ ] Replace “three pillars” as a rigid rule with “signals chosen by question,” adding profiles/events/business correctness where useful.
- [ ] Add a versioned OTel context/semantic-convention note and explicit messaging links/batch/fan-out rules.
- [ ] Add a signal-cost/cardinality/retention worksheet with region/provider assumptions.
- [ ] Keep RED/USE but state that SLOs may be freshness/correctness/queue-age/business outcomes, not only HTTP availability.
- [ ] Mark 99.9%/43m12s and burn-rate thresholds as 30-day/example calculations; add request-based counterexample.
- [ ] Add a multi-window alert table with traffic floor, owner, runbook, action, and “monitoring pipeline down” handling.
- [ ] Add telemetry crash windows and self-observability for collectors/evaluators/notification paths.
- [ ] Add privacy/cardinality tests and a requirement that trace context is not authorization.
- [ ] Make incident closure require user SLI plus data/security/reconciliation verification and preserve EN/VI parity.

## EN/VI parity and cross-reference plan

The EN and VI files have identical 2-section/8-item structures. Keep metric names (`rate`, `errors`, `duration`, `utilization`, `saturation`), W3C headers, OTel attributes, and SLO formulas unchanged. Translate the scope words (“example”, “recommendation”, “unknown”, “provider-specific”) with equal force. Cross-links should point to topics 14, 21, 27, 13, and 08 only for their canonical boundaries.

## Integration record (Batch E scope)

- [x] Added `20-observability-sre.slos-alerting-incidents.q5` in EN/VI for async/business SLIs: completion age, freshness, outbox/CDC/reconciliation lag, unknown work, and recovery verification.
- [x] Added `20-observability-sre.slos-alerting-incidents.q6` in EN/VI for bounded telemetry failure, collector health, missing-data alerts, and independent monitoring-path checks.
- [ ] The broader audit of every SLI/threshold, provider cost, retention, and current collector configuration remains a follow-up.

## Open questions and falsifiers

- [ ] What are the actual user journeys and correctness/freshness invariants that should become SLIs, beyond HTTP status and latency?
- [ ] Which OTel semantic-convention version, SDK/collector distribution, backend, region, retention, and sampling policy are in scope?
- [ ] What cardinality, event volume, queue/memory, and telemetry-loss budgets are acceptable per service/environment?
- [ ] How is the alerting/notification path monitored when the primary metrics/log backend is unavailable?
- [ ] Which data is personal, financial, security-sensitive, or subject to deletion/legal hold, and who may access raw telemetry?
- [ ] What would falsify an SLO-based page: insufficient traffic, denominator manipulation, missing critical user flow, or a known correctness failure not represented in the SLI?
- [ ] What would falsify tail-sampling guidance: collector decision latency/memory exceeds budget, errors are dropped before the decision point, or backend cost forces an unsafe retention reduction?

## Source ledger

All selected sources were inspected/reviewed on 2026-08-23. Tier A is a standard/specification or official project documentation; Tier B is first-party SRE/incident guidance. Current semantic conventions and vendor pages are version-sensitive.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 20-01 | [Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/), OpenTelemetry | A; current docs | Signal roles, observability concepts, metrics/logs/traces and broader signal context. | 2026-08-23 |
| 20-02 | [Signals](https://opentelemetry.io/docs/concepts/signals/), OpenTelemetry | A; current docs | OTel signal taxonomy, including traces, metrics, logs, baggage and profiles. | 2026-08-23 |
| 20-03 | [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/), OpenTelemetry | A; current docs | Explicit inject/extract propagation, W3C Trace Context, baggage security caveats and boundary loss. | 2026-08-23 |
| 20-04 | [Messaging span semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/), OpenTelemetry | A; current spec page | Message creation/consumption context, links, batch/fan-out semantics and messaging attributes. | 2026-08-23 |
| 20-05 | [OpenTelemetry logs specification](https://opentelemetry.io/docs/specs/otel/logs/), OpenTelemetry | A; current specification | Structured log record model, correlation fields and signal interoperation; export/retention remain backend choices. | 2026-08-23 |
| 20-06 | [HTTP metrics semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/), OpenTelemetry | A; development/mixed stability page | Low-cardinality route guidance, HTTP metric attributes, method/status/error semantics and cardinality warnings. | 2026-08-23 |
| 20-07 | [Semantic conventions](https://opentelemetry.io/docs/specs/semconv/), OpenTelemetry | A; version 1.44.0 page at review | Convention versioning/stability and common signal naming; pin version before implementation. | 2026-08-23 |
| 20-08 | [Sampling](https://opentelemetry.io/docs/concepts/sampling/), OpenTelemetry | A; current docs | Head/tail sampling concepts, cost/coverage trade-off and collector decision requirements. | 2026-08-23 |
| 20-09 | [Collector](https://opentelemetry.io/docs/collector/), OpenTelemetry | A; current docs | Receiver/processor/exporter architecture, deployment/resiliency and self-observability scope. | 2026-08-23 |
| 20-10 | [Trace Context](https://www.w3.org/TR/trace-context/), W3C | A; Recommendation | `traceparent`/`tracestate` syntax and propagation semantics; no authorization guarantee. | 2026-08-23 |
| 20-11 | [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/), Google SRE | B; SRE book web edition | SLI/SLO/SLA/error-budget concepts, client-visible measurement, heterogeneous workloads and the non-100% target principle. | 2026-08-23 |
| 20-12 | [Production Services Best Practices](https://sre.google/sre-book/service-best-practices/), Google SRE | B; SRE book web edition | Monitoring outputs, paging/ticketing/logging roles, error budgets and service ownership. | 2026-08-23 |
| 20-13 | [Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/), Google SRE | B; SRE book web edition | Monitoring goals, white/black-box views, latency/traffic/errors/saturation and practical signal selection. | 2026-08-23 |
| 20-14 | [Practical alerting](https://sre.google/sre-book/practical-alerting/), Google SRE | B; SRE book web edition | Alert distribution/tails, actionable pages, ticket/dashboard separation and alert fatigue. | 2026-08-23 |
| 20-15 | [Monitoring](https://sre.google/workbook/monitoring/), Google SRE Workbook | B; current workbook | Metrics with purpose, SLO-oriented monitoring and signal quality. | 2026-08-23 |
| 20-16 | [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/), Google SRE Workbook | B; current workbook | Multi-window/multi-burn-rate examples, traffic floor considerations and SLO alert design. | 2026-08-23 |
| 20-17 | [Alerting](https://prometheus.io/docs/practices/alerting/), Prometheus | A; current docs | Alerting intent, symptom/actionability and Prometheus-specific alert rules/labels. | 2026-08-23 |
| 20-18 | [Histograms and summaries](https://prometheus.io/docs/practices/histograms/), Prometheus | A; current docs | Quantile/histogram/summary trade-offs and why averages/aggregation can hide tail behavior. | 2026-08-23 |
| 20-19 | [Understand labels](https://grafana.com/docs/loki/latest/get-started/labels/), Grafana Loki | A; current docs | Loki label/cardinality behavior and the operational reason to keep labels bounded. | 2026-08-23 |
| 20-20 | [Alerting best practices](https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/), Grafana | A; current docs | Alert ownership, grouping/deduplication, notification routing and runbook-oriented practice. | 2026-08-23 |
| 20-21 | [SP 800-61r3 Incident Response](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r3.pdf), NIST | A; Rev. 3, Apr 2025 | Incident response preparation/detection/response/recovery/learning and cybersecurity incident scope. | 2026-08-23 |
| 20-22 | [NIST revises SP 800-61](https://www.nist.gov/news-events/news/2025/04/nist-revises-sp-800-61-incident-response-recommendations-and-considerations), NIST | B; Apr 2025 announcement | Revision status: SP 800-61r3 supersedes r2 and aligns incident response with CSF 2.0. | 2026-08-23 |
| 20-23 | [Google SRE: Handling overload](https://sre.google/sre-book/handling-overload/), Google SRE | B; SRE book web edition | Overload/throttling context for linking admission/telemetry symptoms to user impact. | 2026-08-23 |

## Gate status

- [x] Complete EN/VI files and exact IDs read.
- [x] Broad official/standards/SRE source pool inspected and claims mapped.
- [x] Coverage matrix, contradiction/limits, negative evidence, crash windows, operations, privacy, testing, and domain trade-offs recorded.
- [x] Duplicate/canonical ownership and EN/VI parity plan recorded.
- [ ] Target telemetry backend, versions, retention, SLOs and alert thresholds approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.
