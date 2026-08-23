# Research Records

This folder contains one research record per System Design topic and Case Study.

Use `../system-design-research-index.md` as the durable status source. A synthesis note such as `../research-distributed-workflow-correctness.md` does not mark an individual unit complete.

## Record template

```markdown
# Research — <title>

Status: `TODO | RESEARCHING | REVIEW | READY | INTEGRATED`
Reviewed: YYYY-MM-DD
Local unit: <key>
EN file: <path>
VI file: <path>

## Scope and non-goals

## Local content map

## What is correct and reusable

## Claims to verify or qualify

| Claim | Classification | Source | Scope/limitation | Confidence |
| --- | --- | --- | --- | --- |

## Workload, invariants, and failure model

## Best-practice comparison

## Duplicate/canonical ownership

## Proposed content changes (not yet applied)

## EN/VI and cross-reference plan

## Open questions

## Sources
```

Source rules:

- Prefer standards, official specifications, vendor guarantees, original papers, and first-party engineering posts.
- Record access/revision dates.
- Distinguish source fact from the author's inference and from this repository's teaching recommendation.
- Do not present a benchmark, architecture number, or vendor implementation as universal.
- Search broadly enough to build a candidate pool of up to 200 sources when useful. The candidate-pool size is not a license to pad the final bibliography: only sources that add distinct evidence, scope, counterexample, or operational detail belong in the selected set.
- The selected set should normally contain at least 20 inspected sources, 30-50 for broad or high-risk records, and may reach 200 when every source materially improves coverage. A narrow-topic exception must be justified in the record.
- Count sources by distinct authoritative documents, not by search-result pages, syndicated copies, link farms, or multiple URLs that repeat the same material.
- Use source diversity deliberately: standards/specifications, official implementation docs, original papers, first-party engineering reports, and operational/security guidance where relevant. Secondary material may discover leads but cannot be the sole support for a material claim.
- The source table must map important claims to sources. A long bibliography without claim-to-source mapping does not pass review.
- For time-sensitive guidance, record the document version or revision date when available and mark provider/version/region assumptions.
- Add a coverage matrix for definitions, invariants, workload, failure/crash windows, retries/timeouts, operations/recovery, security/privacy, testing, and domain trade-offs. Add a contradiction/limits table and explicit unknowns; a large bibliography without coverage does not pass review.
