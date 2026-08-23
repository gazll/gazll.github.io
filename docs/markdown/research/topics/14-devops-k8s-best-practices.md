# Research - DevOps: containers, Kubernetes, delivery, and production operations

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `14-devops-k8s-best-practices`

EN file: `public/data/topics/14-devops-k8s-best-practices.json`

VI file: `public/data/topics/14-devops-k8s-best-practices.vi.json`

## Scope and non-goals

This dossier audits the assigned Docker/Kubernetes, NGINX/observability, CI/CD/GitOps, service-mesh, zero-trust, graceful-shutdown, and online-migration material. It owns deployment mechanics and supply-chain/operational boundaries. Topic 20 owns the observability theory/SLOs; topic 27 owns gateway identity/edge routing; topic 13 owns OAuth/security protocol; topic 26 owns test strategy; topic 21 owns host/JVM debugging.

The source search deliberately used current Kubernetes/Docker/OpenTelemetry/Istio/Linkerd/GitOps/SLSA/Sigstore/database documentation. “2026 best practice” is treated as time-sensitive language, not evidence. Provider defaults and feature gates are recorded with version scope; no single mesh, ingress controller, migration tool, or CI product is treated as universal.

## Local content map

Both JSON files were read in full. Each has 3 sections and 17 items. EN is 32,265 bytes; VI is 30,075 bytes; all section/item IDs are structurally identical.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| Docker & Kubernetes | `14-devops-k8s-best-practices.docker-kubernetes.q1` to `.q6` | Image layers/multi-stage, cluster architecture, Deployment/StatefulSet, kubectl, Service/Ingress/ConfigMap/Secret, probes |
| Web server, networking & observability | `14-devops-k8s-best-practices.web-server-networking-observability.q1` to `.q4` | NGINX edge, structured logs, OTel/Jaeger tracing, RED/USE |
| CI/CD & 2026 best practices | `14-devops-k8s-best-practices.ci-cd-2026-best-practices.q1` to `.q7` | delivery strategies, mesh, architecture/platform practices, GitOps/IaC, zero trust, shutdown, migrations |

Complete IDs:

```text
14-devops-k8s-best-practices.docker-kubernetes.q1 .. q6
14-devops-k8s-best-practices.web-server-networking-observability.q1 .. q4
14-devops-k8s-best-practices.ci-cd-2026-best-practices.q1 .. q7
```

## What is correct and reusable

- Multi-stage builds, dependency/cache ordering, non-root runtime, base-image pinning, and build-secret mounts are useful and well aligned with Docker's own guidance. A smaller image is not automatically a secure image; scanning, provenance, runtime permissions, and patch cadence remain separate controls.
- The Kubernetes architecture section correctly separates API server/etcd/scheduler/controllers from kubelet/runtime/network components. Deployment versus StatefulSet is a useful workload distinction, but StatefulSet supplies identity/storage ordering, not database consensus, backups, or safe failover by itself.
- The probe section correctly distinguishes startup, readiness, and liveness. The warning against putting a fragile shared dependency in liveness is important because it can turn dependency failure into a restart storm.
- The Service/Ingress/ConfigMap/Secret explanation is reusable, especially the warning that Kubernetes Secret values are base64-encoded and are not automatically confidential. Ingress is now a frozen API in Kubernetes docs; Gateway API is the forward-looking portable API, while implementations/extensions still vary.
- The NGINX/structured-log/OTel content is a good operational bridge. It should make route cardinality, sampling, PII/token redaction, and collector capacity explicit.
- The CI/CD section has a strong supply-chain direction: immutable references, signing/provenance, staged rollout, GitOps reconciliation, and expand-contract migrations. The “2026” heading needs to become a dated, versioned principle set.
- Graceful termination correctly includes endpoint removal, SIGTERM, application drain, and bounded grace. A `preStop: sleep` is only a timing aid and can be skipped/delayed/duplicated under failure; it is not a drain protocol.

## Claims to verify or qualify

| Local claim/pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| Multi-stage/smaller images reduce risk | Recommendation with partial fact | They reduce shipped build tooling/size in the described image, but vulnerability count, patch latency, libc/runtime compatibility, and non-root settings still require measurement. | High |
| Pinning a base image tag is reproducible | Incomplete | A mutable tag is not an immutable identity; pin a digest and maintain a controlled update process. Digest pinning alone does not prove provenance. | High |
| `ARG`/`ENV` can carry build secrets | Negative evidence | Docker explicitly warns against this because values can persist in layers/metadata; use BuildKit secret mounts or an external secret path. | High |
| Kubernetes `etcd` is Raft-backed | Provider fact | State it for Kubernetes' control-plane design; managed distributions and topology/backup operations still differ. | High |
| Deployment is for stateless apps and StatefulSet for DB/Kafka | Teaching shorthand | Controllers express identity/storage/update semantics; database safety depends on the database/operator/backup/replication contract. Avoid “StatefulSet makes it safe.” | High |
| Readiness protects traffic during startup/shutdown | Kubernetes fact with implementation scope | Readiness controls endpoint eligibility through the platform; it cannot instantly terminate already-established connections or repair an application drain bug. | High |
| Liveness should never check dependencies | Recommendation | Avoid shared dependency checks in liveness by default; a carefully designed local invariant may justify one. Explain the cascading-restart risk, not an absolute prohibition. | High |
| Kubernetes Secret is encrypted | Incorrect | Secret data is base64-encoded in manifests/API representation; encryption at rest, RBAC, KMS, external secret systems, and log controls must be configured. | High |
| Ingress is the modern Kubernetes networking API | Stale | Kubernetes docs say Ingress is stable but frozen and recommend Gateway API for new features. Gateway implementations have conformance/extension/version scope. | High |
| A service mesh gives zero trust automatically | Incorrect | Istio/Linkerd can provide mTLS/traffic policy, but mTLS is not application authorization; identity trust domains, policy, non-meshed traffic, and failure behavior still need design. | High |
| Retry at every layer improves availability | Negative evidence | Retry multiplication can overload a failing dependency. Use one owner, deadlines, retry budgets, idempotency, and response classification. | High |
| GitOps means any deployment tool that uses Git | Over-absolute | OpenGitOps defines declarative, versioned/immutable, pulled, continuously reconciled principles; actual tooling may implement only part. | High |
| SLSA level/provenance proves the binary is safe | Incorrect | Provenance describes build origin/process under a level; it does not prove source correctness, runtime configuration, dependencies' absence of vulnerabilities, or business security. | High |
| `preStop: sleep 15` guarantees draining | Incorrect | Hook timing is bounded by pod termination grace and can fail/repeat; readiness/endpoint state/application server drain must be coordinated and measured. | High |
| Flyway/Liquibase versioned migration is zero downtime | Incorrect | Migration tools order/apply scripts; zero downtime requires forward/backward-compatible schema, lock/DDL behavior, backfill plan, dual read/write and rollback strategy for the target DB. | High |

## Workload, invariants, and failure model

### Workload model

The deployment design should state: cluster version and distribution; node/zone topology; pod replicas and disruption budget; CPU/memory requests/limits; startup time; request rate/tail latency; connection pool sizes; image size/pull rate; rollout batch; dependency availability; log/trace volume/cardinality; migration table size/write rate; and maximum tolerated termination/rollback window.

Key invariants:

1. Only an image whose digest, provenance/signature policy, vulnerability gate, and configuration are known may be promoted.
2. A rollout never sends traffic to a pod that is not ready, and it never removes more capacity than the availability budget permits.
3. Liveness restarts only a locally non-progressing process; dependency degradation should normally remove readiness or trigger a controlled degraded mode.
4. Secrets are delivered via an authorized runtime path, not baked into image layers or logs.
5. Every migration is compatible with the old and new application during the overlap window and has a measured lock/backfill budget.
6. Shutdown stops new work, drains or cancels in-flight work according to endpoint semantics, and exits before the platform's kill deadline.
7. Telemetry pipelines have bounded memory/queues and do not create a higher-severity outage when the collector/backend is unavailable.

### Crash windows and recovery

| Window | Failure/crash | Recovery/control |
| --- | --- | --- |
| Image build before push | Secret appears in layer/history or unpinned base changes | Reject build, rotate secret, rebuild from clean context, scan history/layers, enforce secret mounts/digest policy. |
| Pull/startup during rollout | Registry/network failure or slow startup | Keep old replicas ready; use startup probe and pull backoff; do not mark readiness from process-start alone. |
| Readiness update versus connection drain | Endpoint removed after traffic already arrived | Application-level drain, server connection limits, endpoint state observation, and enough grace for request budgets. |
| Liveness probe during DB outage | All pods restart and lose capacity | Liveness must be local; readiness/degraded mode handles shared dependency failure; add probe-failure alerts and rollout pause. |
| Deployment controller/etcd unavailable | Desired state cannot reconcile; existing workload may continue | Observe API/etcd health separately, keep last known workload stable, and use a documented manual/managed control-plane recovery path. |
| Mesh CA/JWKS/policy outage | New connections fail or policy decisions fail | Cache only bounded trust material, fail closed for high-risk auth, define non-mesh behavior, and provide rotation/rollback runbooks. |
| Collector/backend overload | Telemetry queues consume pod/node memory or drop high-value data | Bound queues, batch/sampling, protect application memory, monitor collector self-telemetry, and preserve error/latency signals first. |
| GitOps controller outage/drift | Git change is not applied or emergency fix is overwritten | Expose reconciliation age/error, define emergency break-glass ownership, and reconcile the authoritative state after recovery. |
| Migration lock/backfill exceeds budget | DDL blocks requests or old/new binaries disagree | Pause/rollback the forward-compatible step, throttle backfill, use online tooling only when verified for the DB/version, and reconcile schema/data. |

## Best-practice comparison

| Decision | Option A | Option B | Evidence-based selection rule |
| --- | --- | --- | --- |
| Workload controller | Deployment | StatefulSet/operator/managed service | Use Deployment for replaceable replicas; StatefulSet only when identity/storage ordering is needed, and use a database/operator contract for data safety. |
| External traffic API | Ingress | Gateway API/controller | Ingress remains stable/frozen; use Gateway API for new role-oriented/richer routing when the chosen implementation supports required features. |
| Secret delivery | Kubernetes Secret | External secret/KMS/workload identity | Kubernetes Secret is an API object, not a complete secret-management system; choose based on rotation, audit, KMS, and blast radius. |
| Probes | Liveness/readiness/startup | Application drain/health endpoint | Use each for its distinct signal; never substitute probes for graceful shutdown or dependency circuit breaking. |
| Rollout | Blue-green | Canary/progressive | Blue-green simplifies rollback but needs double capacity; canary reduces blast radius but needs representative traffic, metrics, and automated/manual promotion criteria. |
| Service-to-service security | Mesh mTLS | App-level OAuth/workload identity | mTLS authenticates channel/workload; app authorization and resource ownership remain at the service. Select based on identity lifecycle and protocol coverage. |
| Telemetry deployment | Agent/DaemonSet | Gateway/collector tier | Use a bounded local agent for collection and a scalable gateway for routing/processing; either can become an outage if queues/backpressure are unbounded. |
| Delivery control | GitOps reconciliation | Push CI/CD | GitOps gives an auditable desired-state loop; push delivery may be simpler for some targets. The invariant is reproducible, authorized, observable promotion, not the label. |
| Schema evolution | Expand-contract | Online migration tool | Expand-contract is the compatibility protocol; online tools reduce a specific lock/copy risk and still require DB/version testing. |

## Coverage matrix

| Gate area | Evidence and local coverage | Gap to close before integration |
| --- | --- | --- |
| Definitions | Containers, controllers, probes, Service/Ingress/Gateway, mesh, GitOps, migration | Add version headers and explicitly distinguish API standard from controller implementation. |
| Invariants | Readiness, rollout capacity, secret separation, migration compatibility, bounded drain | Add request/connection and PodDisruptionBudget assumptions to examples. |
| Workload | High-volume logs/traces, startup, rollout, DB migration | Add concrete sizing worksheet for image pulls, collector volume, connection pools, and backfill. |
| Failure/crash windows | Probes, shutdown, CA/JWKS, GitOps, migration, collector | Add API-server/etcd, registry, node-pressure, and DNS failure paths. |
| Retries/timeouts | Mesh/gateway retries and pod start/pull/backoff are mentioned | Specify one retry owner and cumulative deadline; test retry storms during rollouts. |
| Operations/recovery | Rollback, observability, GitOps, schema migration | Add runbook ownership, reconciliation age, rollout pause criteria, and restore/backup verification. |
| Security/privacy | Secret base64 caveat, mTLS, image signing/SBOM/provenance | Add RBAC/Pod Security/NetworkPolicy and log/trace redaction references. |
| Testing | Probe/rollout/migration concepts | Add conformance, upgrade/rollback, node drain, chaos, restore, image admission, and old/new schema compatibility tests. |
| Domain trade-offs | Stateful DB/Kafka, platform product, fintech migration warning | Mark “2026” examples as recommendations and keep banking/regulated requirements provider/region-specific. |

## Contradictions and limits

| Claim conflict | Source boundary | Teaching implication |
| --- | --- | --- |
| Ingress versus Gateway API | Kubernetes says Ingress is stable/frozen and recommends Gateway for new features; Gateway API is a separate SIG project with implementation conformance and extensions. | Do not call Gateway universally supported; choose and pin a controller. |
| StatefulSet versus database safety | StatefulSet guarantees stable identities/storage ordering, not application-level replication/consensus/backup correctness. | A DB operator/managed service may be the safer production choice. |
| Mesh mTLS versus zero trust | Istio/Linkerd document automatic/strict mTLS, but mTLS authenticates the channel; authorization policy and non-meshed paths are separate. | Teach identity, authorization, and policy availability as separate controls. |
| SLSA/provenance versus security | SLSA levels describe provenance/build integrity; Sigstore signs/verifies artifacts; neither proves runtime or source correctness. | Keep provenance, signing, scanning, and runtime policy as independent checks. |
| Probe success versus user success | A probe can be healthy while a dependency/business flow is broken, and an over-sensitive liveness probe can restart a healthy process. | Pick probe semantics from user-serving invariants and test dependency failure. |
| Migration tool versus zero downtime | Flyway version/checksum ordering and gh-ost online copying are tool behaviors; lock levels and compatibility are DB/version-specific. | Expand-contract and measured lock/backfill budgets remain required. |

## Negative evidence and anti-patterns

- Do not put credentials in Docker `ARG`/`ENV`, image layers, Git, Helm values, or unredacted CI logs.
- Do not use `latest` or a mutable tag as the production identity without a digest/provenance policy.
- Do not use a StatefulSet as a substitute for database replication, consensus, backups, restore tests, or fencing.
- Do not make liveness depend on a shared database, IdP, queue, or third-party API unless the restart policy and failure model explicitly justify it.
- Do not set readiness to “process has a listening socket” if migrations/cache warm-up/connection draining make the instance unable to serve safely.
- Do not enable retries in client, gateway, mesh, and service independently; the product of retry factors is an outage amplifier.
- Do not claim sidecars/mesh/ambient mode are available or equivalent across all Kubernetes distributions and versions.
- Do not expose raw request paths/user IDs as high-cardinality metrics labels; normalize routes and use sampled logs/traces for detail.
- Do not run a destructive/drop migration in the same release that still has old binaries or an unverified rollback path.
- Do not treat a passing image scan as proof that a signed/provenanced image is safe to run with privileged permissions.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Action |
| --- | --- | --- |
| RED/USE, SLO, traces, logs, cardinality | `20-observability-sre` | Keep only deployment integration and cross-link the canonical definitions. |
| Gateway authentication, route filters, timeout/retry policy | `27-api-gateway-identity-edge` | Link from Ingress/Gateway/mesh examples. |
| OAuth/OIDC, JWT, secrets threat model, injection | `13-security-oauth2` | Keep platform delivery mechanics here and security protocol/coding detail there. |
| Distributed locks/leader leases | `28-distributed-lock-lease` | Link from controller/leader-election examples. |
| Testing and failure injection | `26-testing-strategy` | Keep a short deployment test checklist; avoid another test taxonomy. |
| Outbox/Saga/async workflow | `08`, `09`, and Case Study 15 | Keep only migration/shutdown/deployment boundary examples. |

## Integration record (Batch I scope)

Batch I integrated `14-devops-k8s-best-practices.ci-cd-2026-best-practices.q8` in EN/VI. The item adds a rollout/termination state machine covering startup/readiness/liveness, drain and endpoint removal, resource/disruption budgets, progressive promotion, schema-compatible rollback, and the boundary between provenance evidence and runtime authorization.

The content keeps Kubernetes API versus controller/distribution behavior version-scoped and leaves the selected cluster, mesh, registry, database and CI versions open. Generic SLO/observability, gateway identity, security protocol, distributed lease and testing ownership remain in Topics 20, 27, 13, 28 and 26.

Gate passed on 2026-08-23: content index rebuild, EN/VI parity, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

- [ ] Rename the “2026 best practices” section to a dated “current principles reviewed on 2026-08-23” heading and attach versions to all examples.
- [ ] Add a Kubernetes version/distribution preface; pin current docs and mark alpha/beta feature gates.
- [ ] Replace “StatefulSet for DB/Kafka” with “identity/storage controller; use an operator/managed service and verify data safety.”
- [ ] Add Gateway API versus Ingress selection and implementation-conformance caveat.
- [ ] Add a probe state machine and termination timeline: readiness, endpoint state, preStop, SIGTERM, drain, grace, SIGKILL.
- [ ] Add resource requests/limits, PodDisruptionBudget, topology, autoscaling, and connection-pool assumptions to rollout examples.
- [ ] Make service-mesh mTLS, app authz, policy availability, and non-meshed traffic separate rows.
- [ ] Add image digest/signature/provenance admission and secret-mount examples; avoid claims that scan/provenance alone is sufficient.
- [ ] Add collector backpressure/self-observability and high-cardinality rules.
- [ ] Add expand-contract/migration failure cases and DB-specific lock examples; make drop operations an explicit later phase.
- [ ] Update EN/VI together without changing 17 IDs.

## EN/VI parity and cross-reference plan

The EN and VI structures have the same 3 sections/17 IDs. Keep Kubernetes resource names, CLI commands, probe names, HTTP headers, migration states, and artifact terms unchanged. Translate the version/failure qualifiers with equal strength; in particular, do not soften “Secret is base64, not encryption” or “Ingress is frozen” in the VI version.

## Open questions and falsifiers

- [ ] Which Kubernetes distribution and version, ingress/Gateway controller, runtime, mesh, CI provider, registry, and database versions are in scope?
- [ ] Is the target application stateless, stateful-but-replicated, or a controller? Who owns backup/restore and data failover?
- [ ] What are the actual rollout capacity, startup, request-tail, connection-drain, collector-volume, and migration lock budgets?
- [ ] Which controls are mandatory by regulatory/region requirements (KMS, audit, data residency, signing, separation of duties)?
- [ ] What would falsify the “progressive rollout” recommendation: no representative traffic, no trustworthy user SLI, insufficient spare capacity, or rollback that is not schema-compatible?
- [ ] What would falsify the “mesh mTLS” recommendation: unsupported protocols, incomplete workload coverage, CA rotation outage, policy latency, or inability to authorize at the resource boundary?
- [ ] What would falsify an expand-contract migration: old binary cannot tolerate the expanded schema, backfill saturates the primary, lock/replication lag exceeds budget, or rollback requires destructive DDL.

## Source ledger

All selected sources were inspected/reviewed on 2026-08-23. Tier A is an official specification/project implementation document; Tier B is first-party operational/security guidance. “Current” pages show the publisher's current version selector and must be pinned for integration.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 14-01 | [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/), Kubernetes | A; docs version v1.36 selected by current site | Control-plane/node components, API/etcd/controller architecture, and versioned documentation scope. | 2026-08-23 |
| 14-02 | [Nodes](https://kubernetes.io/docs/concepts/architecture/nodes/), Kubernetes | A; v1.36 current page | kubelet, runtime, kube-proxy/node responsibilities and node failure boundary. | 2026-08-23 |
| 14-03 | [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), Kubernetes | A; v1.36 current page | Declarative rollout, ReplicaSet, rolling-update/maxSurge/maxUnavailable and rollback mechanics. | 2026-08-23 |
| 14-04 | [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/), Kubernetes | A; v1.36 current page | Stable pod identity/storage and ordered deployment/update behavior; no database-consensus guarantee. | 2026-08-23 |
| 14-05 | [Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/), Kubernetes | A; v1.36 current page | Probe semantics, startup gating, readiness traffic removal, and liveness cascading-failure warning. | 2026-08-23 |
| 14-06 | [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/), Kubernetes | A; v1.36 current page | Pod termination/grace, restart behavior, container states, and lifecycle scope. | 2026-08-23 |
| 14-07 | [Container Lifecycle Hooks](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/), Kubernetes | A; v1.36 current page | `preStop`/postStart delivery and failure/timing caveats. | 2026-08-23 |
| 14-08 | [Explore Termination Behavior for Pods and Their Endpoints](https://kubernetes.io/docs/tutorials/services/pods-and-endpoint-termination-flow/), Kubernetes | A; v1.36 tutorial | Endpoint removal/termination ordering and why application drain is still needed. | 2026-08-23 |
| 14-09 | [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/), Kubernetes | A; v1.36 current page | Secret object encoding, encryption-at-rest configuration, RBAC exposure and limits. | 2026-08-23 |
| 14-10 | [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/), Kubernetes | A; v1.36 current page | Non-secret configuration behavior, update/mount scope and size/consistency considerations. | 2026-08-23 |
| 14-11 | [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/), Kubernetes | A; v1.36 current page | Ingress is stable/frozen and Gateway API is recommended for new features. | 2026-08-23 |
| 14-12 | [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/), Kubernetes | A; v1.36 current page | Kubernetes Gateway API concept and controller/implementation boundary. | 2026-08-23 |
| 14-13 | [Building best practices](https://docs.docker.com/build/building/best-practices/), Docker | A; current Docker Build docs | Layer/cache ordering, small images, non-root, pinning and reproducible build recommendations. | 2026-08-23 |
| 14-14 | [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), Docker | A; current BuildKit docs | Separate build/runtime stages and selective artifact copying. | 2026-08-23 |
| 14-15 | [Build secrets](https://docs.docker.com/build/building/secrets/), Docker | A; current BuildKit docs | Secret mounts and why `ARG`/`ENV` are inappropriate for build secrets. | 2026-08-23 |
| 14-16 | [Install the Collector with Kubernetes](https://opentelemetry.io/docs/collector/install/kubernetes/), OpenTelemetry | A; current docs | Kubernetes collector deployment entry points; deployment mode and chart/operator version must be selected. | 2026-08-23 |
| 14-17 | [Security best practices](https://istio.io/latest/docs/ops/best-practices/security/), Istio | A; current Istio docs | mTLS modes, strictness, default-deny/authorization separation, and version/feature maturity. | 2026-08-23 |
| 14-18 | [Traffic Management](https://istio.io/latest/docs/concepts/traffic-management/), Istio | A; current Istio docs | Virtual routing, retries/timeouts/traffic policy and sidecar/mesh behavior scope. | 2026-08-23 |
| 14-19 | [Automatic mTLS](https://linkerd.io/docs/features/automatic-mtls/), Linkerd | A; current Linkerd docs | Automatic mTLS identity/cert rotation and the fact that non-meshed traffic is not automatically protected. | 2026-08-23 |
| 14-20 | [OpenGitOps 1.0](https://opengitops.dev/blog/1.0-announcement/), OpenGitOps | A; GitOps 1.0 principles announcement | Declarative, versioned/immutable, pulled, continuously reconciled principles. | 2026-08-23 |
| 14-21 | [SLSA security levels](https://slsa.dev/spec/v1.0/levels), SLSA | A; SLSA v1.0 | Provenance/build-integrity levels and the limit that provenance is not application/runtime security. | 2026-08-23 |
| 14-22 | [Signing containers](https://docs.sigstore.dev/cosign/signing/signing_with_containers/), Sigstore/Cosign | A; current docs | Container signing workflow and artifact identity; verification policy remains an admission/operations choice. | 2026-08-23 |
| 14-23 | [Versioned migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/versioned-migrations), Redgate Flyway | A; current Flyway docs | Ordered, checksum-validated versioned migrations and immutability expectation. | 2026-08-23 |
| 14-24 | [Rolling out updates from a single schema to multiple production databases](https://documentation.red-gate.com/flyway/deploying-database-changes-using-flyway/rolling-out-updates-from-a-single-schema-to-multiple-production-databases), Redgate Flyway | A; current page; URL may change with docs navigation | Forward-compatible/expand-contract rollout reasoning; final link/version needs recheck at integration. | 2026-08-23 |
| 14-25 | [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html), PostgreSQL | A; PostgreSQL 18 current docs | DB-specific DDL lock behavior and version/provider scope. | 2026-08-23 |
| 14-26 | [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html), PostgreSQL | A; PostgreSQL 18 current docs | `CONCURRENTLY` index behavior and different lock/transaction trade-offs. | 2026-08-23 |
| 14-27 | [gh-ost](https://github.com/github/gh-ost), GitHub | A; repository/main documentation reviewed | MySQL online schema-copy/binlog workflow, throttling/pausing and tool-specific limits. | 2026-08-23 |
| 14-28 | [Resource management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/), Kubernetes | A; v1.36 current page | Requests/limits, scheduling and resource pressure assumptions. | 2026-08-23 |
| 14-29 | [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/), Kubernetes | A; v1.36 current page | Baseline/restricted pod security policy scope; enforcement depends on admission/configuration. | 2026-08-23 |
| 14-30 | [RBAC good practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/), Kubernetes | A; v1.36 current page | Least-privilege/service-account/RBAC operational risks. | 2026-08-23 |
| 14-31 | [Logging architecture](https://kubernetes.io/docs/concepts/cluster-administration/logging/), Kubernetes | A; v1.36 current page | Container/node logging paths and the need for a cluster-level log backend/retention policy. | 2026-08-23 |

## Gate status

- [x] Complete EN/VI files and exact IDs read.
- [x] Broad official/specification source pool inspected and selected sources mapped to claims.
- [x] Coverage matrix, contradiction/limits, negative evidence, crash windows, operations, security, testing, and domain trade-offs recorded.
- [x] Duplicate/canonical ownership and EN/VI parity plan recorded.
- [ ] Target versions/distribution/controller/mesh/database approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.
