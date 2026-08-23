# System Design & Case Studies Review TODO

This is the executable checklist for `system-design-content-review-plan.md`.

Legend: `[ ]` not started · `[-]` in progress · `[x]` complete · `[!]` blocked/needs decision.

## 0. Scope and safety

- [x] Confirm this session is data/content-only.
- [x] Leave UI/component/CSS changes from the other session untouched.
- [x] Record the current dirty worktree before editing.
- [x] Keep every research artifact under `docs/markdown/`.

## 1. Inventory

- [-] Enumerate all 28 topic pairs and 18 case-study pairs.
- [ ] Extract exact question IDs and cross-reference graph.
- [ ] Extract repeated mechanisms by question, not only by keyword.
- [ ] Record metadata/title/tag duplication.
- [x] Write `system-design-content-duplicate-matrix.md`.
- [x] Create the durable per-unit index and research-record template.
- [ ] Create one completed research record for every topic and case study listed in `system-design-research-index.md`.

## 2. Canonical ownership decisions

- [ ] Decide canonical home for Saga/choreography/orchestration.
- [ ] Decide canonical home for transactional outbox and relay choices.
- [ ] Decide canonical home for idempotency-key/API semantics.
- [ ] Decide canonical home for delivery semantics and “exactly once” boundaries.
- [ ] Decide canonical home for local DB locking versus distributed lease/fencing.
- [ ] Decide canonical home for inventory/seat reservation semantics.
- [ ] Decide canonical home for large request/upload/asynchronous job semantics.
- [ ] Decide which existing system-design pages should be shortened and cross-linked.
- [ ] Decide whether a new canonical design/topic is required; do not create one by default.

## 3. Research dossiers

- [-] Cross-topic Batch A synthesis: distributed workflow correctness.
- [ ] Batch B: scarce resources, inventory, seats, booking.
- [ ] Batch C: traffic, large requests, uploads, asynchronous work.
- [ ] Batch D: data topology, projections, replication, sharding, cache.
- [ ] Batch E: reliability, operations, recovery, and testing evidence.
- [ ] Batch F: security and trust boundaries.

For every batch:

- [ ] Local content map with exact IDs.
- [ ] Primary/first-party source list with URLs and access dates.
- [ ] Verified facts separated from inference and recommendation.
- [ ] Invariant/state-machine table.
- [ ] Domain comparison table.
- [ ] Duplicate decisions and ID migration map.
- [ ] EN/VI integration outline.
- [ ] Research gate completed before data integration.

The batch list is only a coordination order. Completion is tracked per topic/case in `system-design-research-index.md`; a batch is not complete while any unit inside it remains unchecked.

## 4. Integration, one approved batch at a time

- [ ] Update canonical content first.
- [ ] Shorten repeated case-study explanations.
- [ ] Add cross-references instead of copying mechanism tutorials.
- [ ] Update EN and VI together.
- [ ] Update metadata/catalog/manifest/index only when necessary.
- [ ] Preserve existing persistent IDs.
- [ ] Review `git diff -- public/data docs/markdown`.
- [ ] Confirm no UI file changed in the batch.

## 5. Validation and handoff

- [ ] Run `node tools/check.mjs --only tests`.
- [ ] Run `node tools/check.mjs`.
- [ ] Check EN/VI structural parity.
- [ ] Check all cross-reference targets.
- [ ] Check source links and claims manually.
- [ ] Check generated search/index data if integration requires it.
- [ ] Update this TODO and the plan status.
- [ ] Produce a concise change log with files, claims, sources, and remaining uncertainty.
