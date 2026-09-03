# Batch I research dossier: system-design review, Kubernetes delivery, experiments, forecasting, ML evidence, and verification economics

Status: `INTEGRATED`

Reviewed: 2026-08-23

Scope: Topic 11, Topic 14, Topic 19, Cases 02, 07, 08 and 18

This dossier closes the remaining REVIEW units. It is the synthesis layer for design-review quality, current platform delivery guidance, historical Tiki experiments, demand forecasting, logo detection, and an AGI-economics side note. The common principle is evidence-bound claims: every number, recommendation, and “best practice” needs a declared scope, owner, failure model, and falsifier.

## Executive thesis

There are three kinds of content in this batch:

1. System-design prompts need a reusable review rubric, but each domain must fill it with its own invariant, authority, freshness, failure cost and recovery path.
2. DevOps advice is version/provider/distribution-specific. Kubernetes probes, rolling updates, image provenance, migrations and mesh policy are separate controls with separate failure modes.
3. Historical experiment and ML/forecast case studies are valuable evidence, but their reported numbers are not portable without the dataset, denominator, split, baseline, evaluator, time horizon, and decision context.

The batch therefore prefers an explicit “what would falsify this?” question over a larger list of named tools.

## Canonical review frame

| Field | Minimum question | Evidence expected |
| --- | --- | --- |
| Invariant | What must never be false, and what is allowed to be stale/approximate? | State machine, constraint/version, policy and conflict response. |
| Authority | Which store/provider/team decides when sources disagree? | One write owner, read contract, reconciliation and escalation owner. |
| Workload | What are peak rate, distribution, size, tenant/hot-key shape, burst, quota and budget? | Units, capacity arithmetic, p99/p999 and headroom. |
| Failure | What happens on timeout, duplicate, retry, partition, crash, replay, late success, drift or rollback? | Unknown/pending states, idempotency, runbook and metrics. |
| Evidence | What test/metric/holdout/trace proves the claim and what would reverse it? | Reproducible protocol, provenance, confidence/coverage, falsifier. |
| Ownership | Which topic/case is canonical for the mechanism? | Cross-reference and domain-specific adaptation only. |

## Unit decisions and integration boundaries

| Unit | Integrated claim boundary | Canonical ownership retained |
| --- | --- | --- |
| Topic 11 | Use invariant → authority → workload → failure → evidence → owner to review prompts. | Topics 08/09/17/25/28 own broker, workflow, API, cache and lease mechanisms. |
| Topic 14 | Rollout/termination is a state machine: startup, ready, drain, promote, rollback; supply-chain evidence is not runtime authorization. | Topics 20/27/13/28/26 own observability, edge identity, security protocol, leases and testing portfolio. |
| Topic 19 | Prove correctness, complexity, measurement and regression separately; state preconditions and Java implementation boundaries. | Topics 01/22/23/25 own JVM, object design, concurrency and distributed mechanics. |
| Case 02 | Tiki Search A/B result is scoped to assignment, analysis unit, telemetry and historical code; A/A checks calibrate but do not cure bias. | Generic statistics/platform architecture remains external/canonical. |
| Case 07 | Forecast gains require point-in-time target/split/metric/baseline evidence and operational outcome gates. | Forecasting methods and inventory/replenishment cases are cross-linked, not copied. |
| Case 08 | Logo detector/classifier is a human-reviewed evidence signal; mAP/accuracy need full evaluator/data protocol and open-set/harm controls. | CV metrics, AI governance and marketplace policy remain linked owners. |
| Case 18 | Verification share is a local denominator-dependent capacity measure; the paper is a conceptual preprint, not an AGI timeline forecast. | AI governance/observability/security controls remain separate canonical topics. |

## Contradiction and limit matrix

| Simplification | Why it fails | Integrated resolution |
| --- | --- | --- |
| “Kubernetes probe green means service healthy” | A probe can only test its endpoint; liveness failures can create restart cascades and readiness does not prove business correctness. | Keep startup/readiness/liveness distinct; test the user path and dependency failure separately. |
| “Rolling deploy is zero downtime by default” | Old/new binaries overlap, connections drain asynchronously, and schema/worker compatibility can fail. | Expand-contract, termination timeline, capacity/PDB and compatible rollback are required. |
| “Signed/provenanced image is safe” | Provenance establishes build lineage; it does not establish least privilege, business correctness or runtime authorization. | Use digest/signature/SBOM/provenance plus admission, policy and runtime controls. |
| “A/B p-value proves the treatment caused the result” | Wrong assignment/analysis unit, SRM, missing telemetry, multiple looks, spillover or biased denominator invalidate inference. | Declare estimand, randomization, data-quality gates, effect/interval and guardrails. |
| “60% more accurate forecast” | The baseline, metric, horizon, split, weighting, censored demand and target may be unknown. | Treat as historical observation until point-in-time reproduction and operational evaluation exist. |
| “91.73% mAP/very high accuracy proves logo enforcement” | Detection/classification metrics depend on protocol and known-set; counterfeit/trademark decisions need policy and human evidence. | Add open-set, calibration, reviewer/appeal and false-positive harm boundaries. |
| “A second model verifies the first” | Shared data/model/context/objective can produce correlated errors. | Independence is a tested property of evidence, not a model label. |

## Operational and safety matrix

| Area | Signals/tests that matter |
| --- | --- |
| Kubernetes rollout | Pod readiness age, startup failures, termination/drain latency, active requests, connection close, rollout pause, error/p99 guardrails, PDB and spare capacity. |
| Supply chain | Artifact digest, provenance/attestation verification, SBOM, dependency/image scan, admission decision, workflow identity and permission changes. |
| Database migration | Old/new binary compatibility, DDL lock/replication lag, backfill rate, checksum, pause/rollback, dual-read/write reconciliation and destructive-step approval. |
| Experiment | Exposure completeness, SRM, identity stability, bot filtering, event watermark, A/A p-value calibration, effect/CI/power, slice multiplicity and long-term guardrails. |
| Forecast | Rolling-origin error by SKU/region/horizon, stockout censoring, interval coverage/CRPS/quantile loss, service level, excess inventory, cost, overrides and drift. |
| Logo ML | Dataset/image provenance, grouped/temporal split, IoU/NMS/threshold, class and slice metrics, unknown/abstain, calibration, reviewer load, appeals, drift and poisoning/adversarial cases. |
| Agent verification | Durable intent/effect trace, model/tool/data/permission versions, verified-share denominator, queue capacity, false accepts, exposure window, kill switch and reconciliation latency. |

## Duplicate/canonical ownership

- Topic 11 owns the prompt-review rubric and domain comparison. It links the mechanism chapters instead of repeating Saga, Outbox, broker, cache or lease internals.
- Topic 14 owns deployment/lifecycle integration. Topic 20 owns SLO/observability definitions; Topic 27 owns gateway identity/edge policy; Topic 13 owns OAuth/OIDC/JWT; Topic 28 owns leases/fencing.
- Topic 19 owns algorithmic preconditions/proofs and interview presentation. Topic 22 owns object contracts and deterministic local concurrency; Topic 26 owns the testing portfolio.
- Cases 02, 07 and 08 own Tiki-specific historical evidence. They do not become general statistics, forecasting, or computer-vision textbooks.
- Case 18 owns the verification-economics lens and operational translation. It does not assert AGI arrival, model capability, legal compliance, or universal human oversight.

## Open questions and falsifiers

- The target Kubernetes distribution/version, controller/mesh, runtime, CI provider, registry, database and policy profile are still deployment inputs, not global facts.
- A rollout recommendation is falsified by missing representative traffic, untrustworthy user SLIs, incompatible schema rollback, insufficient spare capacity, or unbounded drain/orphan work.
- An A/B conclusion is falsified by SRM, re-randomization/spillover, missing exposure/click events, uncorrected multiple looks, or a long-term guardrail regression.
- A forecast claim is falsified by leakage, non-chronological evaluation, censored demand, a weak/unknown baseline, under-covered intervals, or worse inventory/service outcomes.
- A logo model claim is falsified by duplicate/seller leakage, a mismatched evaluator, open-set failure, calibration collapse, unacceptable reviewer/appeal burden, or false-positive harm.
- Verification-share claims are falsified by an undefined denominator, correlated checker errors, reviewer overload, missing traces, or recovery slower than the declared exposure budget.

## Gate record

Completed 2026-08-23 after Batch I integration:

- Content index rebuilt and EN/VI item parity checked for Topics 11, 14 and 19.
- Case 02/07/08/18 article anchors and paired qualifiers checked.
- `node tools/validate-content.mjs --stats`, complete `node tools/check.mjs`, and `git diff --check` passed.

## Selected source ledger

The per-unit records contain the full 20–50 source ledgers. This synthesis retains 48 primary/first-party sources used for the integrated claims.

### Kubernetes, delivery, operations and supply chain

1. [Kubernetes cluster architecture](https://kubernetes.io/docs/concepts/architecture/) - control-plane/node responsibilities and versioned-doc scope.
2. [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) - declarative rolling update and rollback mechanics.
3. [Liveness, readiness and startup probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/) - probe semantics and cascading-failure cautions.
4. [Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) - state/termination behavior.
5. [Container lifecycle hooks](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/) - preStop/postStart scope and timing caveats.
6. [Pod and Endpoint termination flow](https://kubernetes.io/docs/tutorials/services/pods-and-endpoint-termination-flow/) - endpoint/drain sequence.
7. [Resource management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) - requests/limits/scheduling/enforcement.
8. [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) - stable/frozen API and Gateway recommendation.
9. [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/) - API/controller boundary.
10. [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/) - object encoding, RBAC and encryption-at-rest scope.
11. [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) - admission/security profile scope.
12. [RBAC good practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/) - least-privilege risks.
13. [Docker build best practices](https://docs.docker.com/build/building/best-practices/) - layers, pinning, non-root and reproducibility.
14. [Docker build secrets](https://docs.docker.com/build/building/secrets/) - secret mounts versus ARG/ENV.
15. [OpenTelemetry Collector on Kubernetes](https://opentelemetry.io/docs/collector/install/kubernetes/) - deployment modes and version scope.
16. [Istio security best practices](https://istio.io/latest/docs/ops/best-practices/security/) - mTLS/policy separation.
17. [Istio traffic management](https://istio.io/latest/docs/concepts/traffic-management/) - retry/timeout/route implementation scope.
18. [OpenGitOps 1.0](https://opengitops.dev/blog/1.0-announcement/) - declarative/versioned/reconciled delivery principles.
19. [SLSA security levels](https://slsa.dev/spec/v1.0/levels) - provenance/build-integrity limits.
20. [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) - OIDC-backed artifact provenance workflow.
21. [Flyway versioned migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/versioned-migrations) - ordered/checksummed migration behavior.
22. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) - provider-specific DDL lock scope.

### Experiments and forecasting

23. [A/B Testing in Tiki Search](https://engineering.tiki.vn/a-b-testing-in-tiki-search/) - historical local methods/results.
24. [Tiki A/B source and simulations](https://github.com/bachan/articles/tree/master/ab_testing_in_tiki_search_1) - code/provenance and parameter scope.
25. [Online Experimentation at Microsoft](https://www.microsoft.com/en-us/research/publication/online-experimentation-at-microsoft/) - platform/randomization practice.
26. [Data quality for trustworthy A/B analysis](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/data-quality-fundamental-building-blocks-for-trustworthy-a-b-testing-analysis) - missingness and data-quality gates.
27. [Trustworthy experimentation under telemetry loss](https://www.microsoft.com/en-us/research/publication/trustworthy-experimentation-under-telemetry-loss/) - telemetry bias/power impact.
28. [Data-Driven Metric Development](https://www.exp-platform.com/Documents/2016KDDMetricDevelopmentLessonsDengShi.pdf) - metric sensitivity and long-term interpretation.
29. [Into the demand forecast of Tiki Operations](https://engineering.tiki.vn/into-the-demand-forecast-of-tiki-operations/) - historical Tiki data/model/roadmap.
30. [DeepAR original paper](https://arxiv.org/abs/1704.04110) - related-series probabilistic forecasting.
31. [SageMaker DeepAR](https://docs.aws.amazon.com/sagemaker/latest/dg/deepar.html) - provider features/context/prediction window limits.
32. [Forecasting: Principles and Practice](https://otexts.com/fpp3/) - forecasting workflow and method scope.
33. [Time-series cross-validation](https://otexts.com/fpp3/tscv.html) - rolling-origin evaluation.
34. [Forecast accuracy measures](https://otexts.com/fpp3/accuracy.html) - metric definitions/limitations.
35. [Hierarchical and grouped time series](https://otexts.com/fpp3/hierarchical.html) - coherence and reconciliation.
36. [Demand forecasting under lost-sales stock policies](https://www.sciencedirect.com/science/article/pii/S0169207023000961) - stockout/censoring bias.
37. [Google dataset splitting](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets) - representative train/validation/test and future leakage.
38. [Google Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml/) - training/serving and future-data testing.

### Logo ML and verification economics

39. [Tiki brand/logo detection case](https://engineering.tiki.vn/applying-machine-learning-to-solve-brand-logo-detection-problem/) - historical pipeline/metrics/production observation.
40. [YOLOv3 paper](https://arxiv.org/abs/1804.02767) - model-family context, not Tiki benchmark proof.
41. [Deep residual learning](https://openaccess.thecvf.com/content_cvpr_2016/html/He_Deep_Residual_Learning_CVPR_2016_paper.html) - ResNet provenance.
42. [COCO evaluation API](https://github.com/cocodataset/cocoapi/blob/master/MatlabAPI/CocoEval.m) - IoU/AP/AR evaluator semantics.
43. [scikit-learn metrics](https://scikit-learn.org/stable/modules/model_evaluation.html) - precision/recall/F1/AP denominators.
44. [NIST AI RMF 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10) - govern/map/measure/manage lifecycle.
45. [OWASP Machine Learning Security Top 10](https://owasp.org/www-project-machine-learning-security-top-10/) - poisoning/input/model/supply-chain threats.
46. [Model Cards](https://modelcards.withgoogle.com/about) - intended use, slices and limitations.
47. [Some Simple Economics of AGI](https://arxiv.org/abs/2602.20946) - conceptual `cA`/`cH` verification lens; preprint status.
48. [METR task-horizon research](https://metr.org/notes/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) - task-specific capability measurement; not AGI forecast or safety proof.
