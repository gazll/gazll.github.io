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
- A normal record must cite at least 10 distinct relevant sources. Broad or high-risk records should target 20-30 sources; a smaller set is allowed only when the topic is genuinely narrow and the record explains the limitation.
- Count sources by distinct authoritative documents, not by search-result pages, syndicated copies, link farms, or multiple URLs that repeat the same material.
- Use source diversity deliberately: standards/specifications, official implementation docs, original papers, first-party engineering reports, and operational/security guidance where relevant. Secondary material may discover leads but cannot be the sole support for a material claim.
- The source table must map important claims to sources. A long bibliography without claim-to-source mapping does not pass review.
- For time-sensitive guidance, record the document version or revision date when available and mark provider/version/region assumptions.
