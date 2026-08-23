# System Design & Case Studies Content Review Plan

Status: `INTEGRATION COMPLETE`

Scope: data/content only. Do not change Vue components, CSS, layout, or unrelated UI work.

## Objective

Review the complete System Design and Case Studies library, remove accidental repetition, refresh claims against verifiable sources, and make each case study teach a domain-specific decision rather than repeat a generic pattern tutorial.

The target learning shape is:

```text
canonical pattern / mechanism
        |
        +--> fintech: correctness, auditability, reconciliation
        +--> bank: strong invariants, authorization, failure containment
        +--> OTA / airline: scarce seats, external systems, unknown outcomes
        +--> commerce: inventory reservation, peak admission, customer UX
        +--> notification: delivery semantics, expiry, provider limits
```

The same word appearing in several articles is acceptable only when the decision, invariant, or failure mode is genuinely different. A copied explanation is not.

## Non-negotiable rules

- Research first; integrate later. Do not edit `public/data` until the relevant research dossier passes its gate.
- Every material technical claim gets a source URL, source type, access/revision date, and confidence level.
- Separate `verified fact`, `local inference`, `design recommendation`, and `unknown/needs validation`.
- Never write “best practice” without naming the workload, invariant, boundary, and trade-off.
- Do not claim “exactly once” without stating the scope: producer, broker, subscription, region, acknowledgement, and side effect.
- Do not use a vendor case study as a universal rule. Record what the source actually says and what is inferred for this library.
- Preserve persistent IDs and existing cross-reference IDs unless a migration plan explicitly maps old IDs to new canonical IDs.
- EN and VI must remain structurally equivalent. Research may be written in English first, but integration requires an EN/VI content plan.
- Keep all research notes and TODO state under `docs/markdown/` so the work survives session changes.

## Working phases

### Research-unit rule

Every topic JSON pair and every case-study article pair is a separate research unit. A batch dossier may compare units and expose duplication, but it does not count as completing the units inside it.

Each unit must have a research record under `docs/markdown/research/` (one file per unit) containing:

- local content map and exact IDs/headings;
- source list with source type and reviewed date;
- verified facts versus inference/recommendation;
- current strengths, correctness risks, stale claims, and missing context;
- overlap links and proposed canonical/domain/implementation role;
- EN/VI parity notes;
- integration decision and unresolved questions.

The persistent checklist is `system-design-research-index.md`. Never mark a unit complete from a keyword scan alone.

### Phase 0 — Freeze and inventory

Read-only inventory before content edits:

- [x] Enumerate all System Design topic JSON files and EN/VI pairs.
- [x] Enumerate all Case Study metadata and EN/VI article pairs.
- [x] Extract section titles, question IDs, tags, cross-references, and repeated pattern terms.
- [x] Build a duplicate matrix with exact file/question IDs, not only keyword counts.
- [x] Record current dirty worktree and keep UI/session changes untouched.

Deliverable: `system-design-content-duplicate-matrix.md`.

### Phase 1 — Define canonical ownership

Assign each reusable mechanism one canonical home. Other pages should link to it and explain only the local application.

Initial ownership proposal; final ownership is decided after research:

| Mechanism | Candidate canonical home | Case-study responsibility |
| --- | --- | --- |
| System-design review, capacity, assumptions | `10-system-design-rate-limit` / System Design foundations | Show how a domain changes the workload envelope |
| API idempotency and request contract | `17-rest-api-design` plus a cross-reference to workflow correctness | Show client/provider semantics and replay behavior |
| Message delivery, ordering, retry, DLQ | `08-message-queue` | Show why a domain chooses queue/log/provider adapter |
| Distributed workflow, Saga, Outbox, compensation, reconciliation | `09-distributed-tx-fintech` or a new canonical workflow design | Show different invariants and failure policies by domain |
| Local DB transaction, MVCC, optimistic/pessimistic locking | `05-db-core-index-lock` | Show when the domain must stay inside one ACID boundary |
| Distributed lease/lock and fencing | `28-distributed-lock-lease` | Show why a lock is or is not the authority for a domain |
| Inventory/seat reservation and scarce-resource admission | System Design booking/inventory design plus domain cases | Focus on hold expiry, oversell policy, and UX |
| Overload controls, backpressure, load shedding | `10-system-design-rate-limit` | Focus on which traffic/features are shed first |
| Observability, SLO, incident and recovery evidence | `20-observability-sre` | Provide domain-specific signals and reconciliation dashboards |

The word “Saga” should not automatically make a page a Saga tutorial. The canonical page owns the protocol and failure model; a bank, OTA, or commerce page owns the business invariant and decision boundary.

### Phase 2 — Deep research batches

Research one batch at a time. Each batch gets a dossier in `docs/markdown/` using the template below.

#### Batch A — Distributed workflow correctness

Topics and cases to inspect:

- `09-distributed-tx-fintech`
- `11-system-design-cases` payment/order prompts
- `16-project-concurrency-whiteboard` OTA workflow
- `25-microservice` distributed consistency, messaging, idempotency sections
- `28-distributed-lock-lease` only where lease/fencing affects workflow correctness
- Case Study 15 transactional outbox

Questions to verify:

- When does a local ACID boundary beat a distributed workflow?
- Saga choreography versus orchestration: participant count, visibility, coupling, failure recovery, and operational ownership.
- Outbox guarantees and non-guarantees: relay crash, duplicate publish, ordering scope, retention, replay, schema evolution.
- Idempotency key scope, request fingerprint, concurrent `IN_PROGRESS`, expiry, late requests, and result replay.
- Forward recovery, compensation, unknown external outcome, timeout, retry budget, and reconciliation.
- Why “exactly once” is usually a scoped delivery property, not a business-side-effect guarantee.

#### Batch B — Scarce resources: inventory, seats, booking

Topics and cases to inspect:

- OTA flight booking design and whiteboard material
- flash-sale booking/inventory designs
- `05-db-core-index-lock`, `28-distributed-lock-lease`
- Case Studies 01, 11, 12, and 16

Questions to verify:

- Hold versus commit versus confirmation; expiry and abandoned work.
- Strong invariant location: database constraint, partition owner, reservation service, or external supplier.
- Overbooking policy and reconciliation with airline/GDS/provider systems.
- Why “book succeeds before every read model is fresh” can be correct for OTA, while a ledger balance cannot be treated the same way.
- Hot item admission, queue fairness, bounded work, and user-visible pending states.

#### Batch C — Traffic, large requests, and asynchronous work

Topics and cases to inspect:

- object storage/resumable upload design
- REST/API design and network/I/O topics
- rate limiting, backpressure, queueing, and request coalescing
- Discord and catalog/search cases where read amplification matters

Questions to verify:

- When to stream, paginate, chunk, upload directly to object storage, or create an asynchronous job.
- Request-size limits, timeout/deadline budget, checksum/integrity, resumability, and cancellation.
- Admission control versus queueing versus rate limiting.
- How retries interact with large bodies and partially completed work.

#### Batch D — Data topology and consistency

Topics and cases to inspect:

- replication, sharding, partitioning, cache topology, CDC, and search projections
- distributed cache and news-feed designs
- Discord, Pegasus, and data-scaling material

Questions to verify:

- Source of truth versus derived projections.
- Read-after-write, monotonic reads, stale-while-revalidate, and repair/rebuild.
- Hot partitions, tenant isolation, key selection, ordering scope, and migration safety.

#### Batch E — Reliability and operations

Topics and cases to inspect:

- retry storms, pool exhaustion, circuit breakers, bulkheads, deadlines
- SLOs/alerts/incidents, testing, deployment and migration sections
- operational lessons from production case studies

Questions to verify:

- Retry ownership and budget across call chains.
- Queue lag, outbox lag, reconciliation lag, and unknown-state inventory.
- Restore, replay, backfill, rollback, canary, and failure-injection evidence.

#### Batch F — Security and trust boundaries

Topics and cases to inspect:

- API gateway/identity edge, OAuth/OIDC, authorization, object ownership, webhook verification
- upload, payment, provider callback, and multi-tenant case boundaries

Questions to verify:

- Authentication versus authorization versus object-level authorization.
- Capability URLs, key scope, webhook authenticity, replay protection, and audit evidence.

### Completed batches G-I

- Batch G: Topics 01-03 and Case 04 — JVM/Java evolution, Spring/build boundaries, Android build measurement.
- Batch H: Topics 12/22/23/24 and Case 06 — architecture fitness, LLD contracts, Java async, DDD boundaries, and mobile decision scope.
- Batch I: Topics 11/14/19 and Cases 02/07/08/18 — prompt deduplication, delivery rollout, DSA proof, experimentation, forecasting, ML evaluation, and verification economics.
- Final audit: metadata/title/tag duplication, 233 reference targets, canonical ownership, preserved IDs, and final data-only validation are recorded in `research-final-coverage-audit.md`.

## Research dossier template

Each batch dossier must contain:

1. Scope and non-goals.
2. Existing local content map with exact IDs.
3. Glossary and invariant table.
4. Verified claims with primary source links.
5. Design implications and trade-off matrix.
6. Domain comparison: what changes for bank/fintech, OTA/airline, commerce, notification, and other relevant domains.
7. Duplicate decisions: keep, merge, shorten, relink, or retire; no deletion without ID mapping.
8. Proposed canonical outline and case-study outline.
9. Claims that remain uncertain or require a source/owner.
10. Integration checklist for EN, VI, metadata, cross-references, and validation.

Source priority:

1. Standards, RFCs, protocol/database/vendor documentation, and official product guarantees.
2. Peer-reviewed papers or original engineering papers.
3. First-party engineering posts from the company that operated the system.
4. Named expert pattern references, used for terminology and comparison rather than as proof of a vendor guarantee.
5. Secondary articles only to discover leads; do not use them as the sole support for a material claim.

### Deep-research evidence minimum

The request is for a durable, evidence-backed refresh rather than a short summary. Therefore every one of the 28 topic records and 18 case-study records must meet the same research bar before integration. The goal is high-confidence and transparent content, not an impossible claim that any explanation can never be challenged:

- [x] Search broadly and build a candidate source pool of up to 200 sources when useful; do not use the number as a reason to include weak or duplicate material.
- [x] At least 20 distinct, relevant, inspected sources are selected for a normal unit; broad or high-risk units target 30-50 and may use up to 200 when every source adds distinct evidence.
- [x] The source set is not padded with SEO pages, reposts, search-result pages, or duplicate vendor documentation.
- [x] Material claims map to one or more sources, with source type, organization, URL, reviewed date, version/revision when available, and scope/limitations.
- [x] The record includes current best practices from standards/specifications, official implementation docs, original papers, and first-party engineering reports when those source types exist.
- [x] The record covers workload, invariants, failure modes, retry/timeout behavior, operational signals, security/privacy boundaries, testing/recovery, and domain-specific trade-offs where relevant.
- [x] The record includes a coverage matrix, a contradiction/limits table, negative evidence or anti-patterns, and explicit unknowns/falsifiers.
- [x] The record explicitly lists facts, inferences, recommendations, and unresolved/unknown items; source count alone never marks a record ready.

If a unit cannot reasonably reach twenty inspected sources, keep it in `REVIEW`, document why, and add a focused uncertainty note rather than filling the bibliography with weak sources.

## Phase 3 — Research gate before integration

A batch is ready only when all boxes are true:

- [x] Each important claim has a source or is explicitly labeled inference/recommendation.
- [x] The unit meets the deep-research evidence minimum, or documents a justified narrow-topic exception.
- [x] Source scope and limitations are recorded.
- [x] No “exactly once”, “strong consistency”, “zero downtime”, or similar absolute claim is unqualified.
- [x] The canonical page and each case study have distinct jobs.
- [x] Domain invariants and user-visible semantics are written before component choices.
- [x] Failure states include unknown, retry, compensation, reconciliation, and manual escalation where relevant.
- [x] Numbers include units, workload assumptions, and a citation or derivation.
- [x] The proposed EN/VI structure is equivalent.
- [x] Cross-reference migration preserves old IDs or includes an explicit redirect/map.

Gate result: all 46 per-unit records and all nine batch dossiers document these checks; unresolved deployment-specific values remain labeled as unknowns/falsifiers rather than hidden assumptions.

## Phase 4 — Controlled integration

After a batch passes its research gate:

- [x] Update canonical topic content first.
- [x] Replace repeated explanations in case studies with a short principle plus a domain-specific application and a cross-reference.
- [x] Add or update diagrams only when they clarify a boundary, state machine, or failure path; diagrams must have editable source where supported.
- [x] Update both language variants with matching structure and terminology.
- [x] Update `meta.json`, `manifest.json`, `catalog.json`, and `content-index.json` only when required by the data model.
- [x] Validate IDs, cross-references, metadata, EN/VI parity, and source links.
- [x] Review the data-only diff before starting the next batch.

## Validation commands

Run the smallest relevant checks during each batch, then the full gate before handoff:

```text
node tools/check.mjs --only tests
node tools/check.mjs
```

Also verify manually:

- every changed EN/VI route resolves;
- every old cross-reference still resolves;
- every source link is reachable and supports the nearby claim;
- no UI file is part of the data-review diff;
- no unrelated dirty change was overwritten.

## Current observed duplication hotspots

This was the initial inventory signal. Final ownership and metadata decisions are recorded in `system-design-content-duplicate-matrix.md` and `research-final-coverage-audit.md`:

- Saga/Outbox/idempotency: `09-distributed-tx-fintech`, `11-system-design-cases`, `16-project-concurrency-whiteboard`, `25-microservice`, Case Study 15, and parts of the OTA/e-commerce designs.
- Queue/retry/backpressure: `08-message-queue`, `10-system-design-rate-limit`, `11-system-design-cases`, `25-microservice`, flash-sale and order cases.
- Lock/concurrency/reservation: `05-db-core-index-lock`, `09-distributed-tx-fintech`, `16-project-concurrency-whiteboard`, `28-distributed-lock-lease`, and booking/inventory cases.
- Idempotent API/request semantics: `04-rest-grpc-webflux`, `09-distributed-tx-fintech`, `11-system-design-cases`, `17-rest-api-design`, `25-microservice`, `28-distributed-lock-lease`, and several case studies.
- Large request/upload/read amplification: object-storage design, REST/API design, network/I/O, catalog/search, and Discord material.

The duplicate matrix will turn these signals into exact question-level decisions.

## Definition of done

- [x] All planned batches have a research dossier and a completed gate.
- [x] Every reusable pattern has one canonical explanation and stable cross-references.
- [x] Each case study states its domain invariant, consistency target, failure policy, and why it does not simply copy another domain.
- [x] Repeated text is shortened or redirected without losing useful evidence.
- [x] EN/VI data stays structurally aligned.
- [x] Validation passes and the final diff is data-only for this workstream.
