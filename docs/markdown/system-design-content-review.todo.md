# System Design & Case Studies Review TODO

This is the executable checklist for `system-design-content-review-plan.md`.

Legend: `[ ]` not started · `[-]` in progress · `[x]` complete · `[!]` blocked/needs decision.

## 0. Scope and safety

- [x] Confirm this session is data/content-only.
- [x] Leave UI/component/CSS changes from the other session untouched.
- [x] Record the current dirty worktree before editing.
- [x] Keep every research artifact under `docs/markdown/`.

## 1. Inventory

- [x] Enumerate all 28 topic pairs and 18 case-study pairs.
- [x] Extract exact question IDs and cross-reference graph.
- [x] Extract repeated mechanisms by question, not only by keyword.
- [x] Record metadata/title/tag duplication; the final scan and decisions are in `research-final-coverage-audit.md`.
- [x] Write `system-design-content-duplicate-matrix.md`.
- [x] Create the durable per-unit index and research-record template.
- [x] Create one completed research record for every topic and case study listed in `system-design-research-index.md`.

## 2. Canonical ownership decisions

- [x] Decide canonical home for Saga/choreography/orchestration: Topic 09 owns the mechanism; Topic 16 and cases retain domain state machines.
- [x] Decide canonical home for transactional outbox and relay choices: Topic 09 owns guarantees; Case 15 owns the concrete crash/relay workflow.
- [x] Decide canonical home for idempotency-key/API semantics: Topic 17 owns API contract; Topic 09 owns provider/money correctness; Topic 25 owns consumer/inbox relation.
- [x] Decide canonical home for delivery semantics and exactly-once boundaries: Topic 08 owns broker semantics; Topics 09/25 own workflow/consumer boundaries.
- [x] Decide canonical home for local DB locking versus distributed lease/fencing: Topic 05 owns local constraints/locks; Topic 28 owns distributed lease/fencing.
- [x] Decide canonical home for inventory/seat reservation semantics: Topic 16 owns the OTA narrative; Cases 01/11/12/16 retain distinct inventory, peak-sale, incident, and Shopify evidence.
- [x] Decide canonical home for large request/upload/asynchronous job semantics: Topic 17 owns the API resource and `202` job contract; Topic 15 owns transport/body budgets; Topic 27 owns edge enforcement; Topic 10 owns overload/admission; Cases 09/13 retain workload-specific evidence.
- [x] Decide which existing system-design pages should be shortened and cross-linked; apply targeted shortening and cross-references while preserving unique evidence.
- [x] Decide whether a new canonical design/topic is required; reuse Topic 09 and do not create a duplicate catalog design.

## 3. Research dossiers

- [x] Cross-topic Batch A synthesis: distributed workflow correctness — research gate and integration complete for Topics 08, 09, 17, 25, 28 and Case 15. Broader duplicate cleanup and the next batches remain.
- [x] Batch B: scarce resources, inventory, seats, booking — synthesis dossier and public-data integration complete for Topics 16 and Cases 01/11/12/16.
- [x] Batch C: traffic, large requests, uploads, asynchronous work — synthesis, public EN/VI integration, catalog/index synchronization, and validation complete.
- [x] Batch D: data topology, projections, replication, sharding, cache. Synthesis, public EN/VI integration, case qualifiers, index synchronization, and validation complete.
- [x] Batch E: reliability, operations, recovery, and testing evidence. Synthesis, public EN/VI integration, case qualifiers, index synchronization, and validation complete.
- [x] Batch F: security and trust boundaries — synthesis dossier, public EN/VI integration, case qualifiers, index synchronization, and validation complete for Topic 13 and Cases 10/17.
- [x] Batch F: add three bilingual Topic 13 items and paired EN/VI qualifiers for Cases 10/17; preserve existing IDs, figures, and source-scoped uncertainty.
- [x] Batch F: rebuild `content-index.json`, verify Topic 13 parity and case anchors, and run the full validation gate.
- [x] Batch F: inspect the selected RFC/OIDC/NIST/OWASP/AWS/Stripe/OpenSSH/CISA/Sigstore source claims; keep provider/version and deployment evidence as open questions.
- [x] Batch G: JVM, Java release evolution, Spring boundaries, and Android build feedback synthesis dossier completed for Topics 01-03 and Case 04.
- [x] Batch G: add two bilingual items to each of Topics 01-03 and the paired EN/VI measurement qualifier to Case 04; preserve IDs, anchors, figures, commands, and source-scoped uncertainty.
- [x] Batch G: rebuild `content-index.json`, verify Topic 01-03 parity and Case 04 anchors, and run the full validation gate.
- [x] Batch G: inspect the selected JLS/JEP/Oracle/OpenJDK/Go/GraalVM/Spring/Gradle/Android/Dagger/Tiki sources; keep provider, workload, version, and reproduction metadata as open questions.
- [x] Batch H: architecture, LLD, Java concurrency, DDD, and mobile decision synthesis dossier completed for Topics 12/22/23/24 and Case 06.
- [x] Batch H: add one bilingual item to each of Topics 12/22/23/24 and the paired EN/VI qualifier to Case 06; preserve IDs, anchors, figures, series links, and historical scope.
- [x] Batch H: rebuild `content-index.json`, verify EN/VI parity and Case 06 anchors, and run the full validation gate.
- [x] Batch H: inspect the selected original architecture/DDD, Java SE/JLS, OpenJDK, Redis/Caffeine, Android, React Native/Flutter, OWASP and Tiki sources; keep version, workload, ownership and reproduction unknowns explicit.
- [x] Batch I: system-design review, Kubernetes delivery, DSA proof, Tiki experiments/forecast/ML, and verification-economics dossier completed for Topics 11/14/19 and Cases 02/07/08/18.
- [x] Batch I: add one bilingual item to Topics 11/14/19 and paired EN/VI evidence qualifiers to Cases 02/07/08/18; preserve IDs, anchors, figures, references, and historical scope.
- [x] Batch I: rebuild `content-index.json`, verify EN/VI parity and case anchors, and run the full validation gate.
- [x] Batch I: inspect selected Kubernetes/GitHub/SLSA/ExP/Tiki/forecast/ML/NIST/AGI sources; keep versions, denominators, workload, dataset, and team-capacity limits explicit.

For every batch:

- [x] Local content map with exact IDs.
- [x] Candidate source pool searched broadly (up to 200 where useful), without counting it as final evidence automatically.
- [x] Selected source ledger normally has 20+ inspected sources; broad/high-risk units target 30-50 or more, up to 200 when justified.
- [x] Primary/first-party source list with URLs, versions/revisions, and access dates.
- [x] Verified facts separated from inference and recommendation.
- [x] Coverage matrix for definitions, invariants, workload, failures, retry/timeout, operations/recovery, security/privacy, testing, and domain trade-offs.
- [x] Contradiction/limits table, anti-patterns/negative evidence, and explicit unknowns/falsifiers.
- [x] Invariant/state-machine table.
- [x] Domain comparison table.
- [x] Duplicate decisions and ID migration map.
- [x] EN/VI integration outline.
- [x] Research gate completed before data integration.

The batch list is only a coordination order. Completion is tracked per topic/case in `system-design-research-index.md`; a batch is not complete while any unit inside it remains unchecked.

## 4. Integration, one approved batch at a time

- [x] Update canonical content first for the integrated Batch A units: Topics 08, 09, 17, 25, 28 and Case 15.
- [x] Shorten repeated case-study explanations in Case 15; apply targeted qualifiers/cross-links elsewhere without deleting unique case evidence.
- [x] Add cross-references instead of copying mechanism tutorials in the integrated Batch A units.
- [x] Update EN and VI together for every integrated unit.
- [x] Update metadata/catalog/manifest only when necessary; `content-index.json` was synchronized after Topic 09 question edits.
- [x] Preserve existing persistent IDs in the integrated units.
- [x] Review `git diff -- public/data docs/markdown`.
- [x] Confirm the Batch A patch did not edit UI files; pre-existing UI-session changes remain untouched.
- [x] Integrate Batch C ownership: Topic 17 upload/job resources, Topic 15 transport budgets, Topic 27 edge enforcement, Topic 10 overload policy, and source-scoped Case 09/13 evidence.
- [x] Add ten bilingual Batch C topic items and preserve every existing item ID, case anchor, figure, and source-specific measurement.
- [x] Synchronize `content-index.json` and migrated System Design `source_items` after Batch C additions.
- [x] Batch D: add the five bilingual data-topology items and three EN/VI Case 03 evidence/migration qualifiers.
- [x] Batch D: synchronize the content index, verify EN/VI IDs and case anchors, and run the full validation gate.
- [x] Batch E: add five bilingual reliability/operations/testing items and EN/VI qualifiers for Cases 05 and 14.
- [x] Batch E: synchronize the content index, verify EN/VI IDs and case anchors, and run the full validation gate.
- [x] Batch F-I: synchronize the index, research records, duplicate decisions, bilingual content, case anchors, and final audit after each integration batch.

## 5. Validation and handoff

- [x] Run `node tools/validate-content.mjs --stats` for the current data set.
- [x] Run `node tools/check.mjs --only tests` (covered by the full gate).
- [x] Run `node tools/check.mjs`.
- [x] Check EN/VI structural parity for the integrated Batch A pairs.
- [x] Check all cross-reference targets through the content validation gate.
- [x] Check the selected Batch D source links and claims manually; broader per-unit link review remains tracked in the research records.
- [x] Check the selected Batch E source links and claims manually; provider/version and local workload unknowns remain in the research records.
- [x] Check generated search/index data; the Topic 09 question index is synchronized.
- [x] Update this TODO and close the integration phase; deployment-specific questions remain explicitly recorded in the research dossiers.
- [x] Produce a concise change log with files, claims, sources, and remaining uncertainty in `research-final-coverage-audit.md` and the batch dossiers.
