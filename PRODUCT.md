# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

GAZLL serves a group of Java and backend engineers preparing for senior-level technical interviews. The product owner is the primary user, with the same material and workflows available to the wider group.

Users study independently, revisit difficult material, track what they have reviewed, and practise explaining technical decisions at interview depth.

## Product Purpose

GAZLL is a bilingual backend-engineering study and interview-preparation system. It brings structured questions and answers, saved progress and notes, system-design blueprints, engineering case studies, and mock-interview practice into one connected reference.

Success means readers can build, retain, and communicate senior-level Java and backend knowledge with evidence they can trust in an interview.

## Positioning

GAZLL combines an evidence-reviewed English/Vietnamese knowledge corpus with active study workflows. Its material is cross-linked across interview questions, system design, case studies, and practice sessions instead of being a collection of disconnected articles.

## Operating Context

Readers use GAZLL for focused study, revision, interview rehearsal, and quick technical reference. They can work signed out with progress stored on the device or sign in with Google to synchronize personal study data.

The study material is organized around senior Java and backend concerns, including JVM internals, concurrency, databases, distributed systems, API design, security, operations, algorithms, and system design.

## Capabilities and Constraints

- The product is a Nuxt 4 static web application deployed through GitHub Pages.
- English is the base content language and complete Vietnamese companions provide the bilingual reader experience.
- English and Vietnamese content pairs must remain structurally identical.
- Existing `item_id` values are persistent storage keys and must not change.
- Study progress, notes, and related personal state work locally when signed out; Google sign-in enables optional synchronization.
- Product claims and version-sensitive technical guidance must remain grounded in authoritative primary sources.
- Static deployment, browser security boundaries, and the existing Google Apps Script data service remain product constraints.

## Brand Commitments

- Preserve the name GAZLL.
- Keep the product's technically precise, evidence-led voice.
- Preserve the complete EN/VI content commitment while allowing the English application shell and documented language-specific exceptions.

## Evidence on Hand

- The bilingual study corpus and its metadata live under `public/data/topics/`, `public/data/meta.json`, and `public/data/content-reviews.json`.
- System-design material lives in `public/data/system-design/`.
- Bilingual case studies and supporting local assets live in `public/data/case-studies/` and `public/assets/case-studies/`.
- Mock-interview material is represented by `public/data/interviews.json` and the Gazl Try surface.
- The application already implements study progress, notes, search, language switching, Google sign-in, statistics, and supporting knowledge collections.
- No fabricated testimonials, customer claims, benchmarks, or commercial proof should be introduced without real evidence.

## Product Principles

1. Prefer technically defensible depth over generic interview advice.
2. Keep English and Vietnamese readers on equivalent, complete learning paths.
3. Connect concepts across study questions, designs, cases, and practice instead of duplicating isolated explanations.
4. Preserve reader continuity: stable identifiers, durable progress, and dependable signed-out behavior matter more than content reshuffling.
5. Make evidence and current technical reality the basis of every substantive claim.

## Accessibility & Inclusion

Preserve accessible keyboard behavior, readable contrast, responsive layouts, semantic structure, and understandable interaction states. Accessibility remains a product requirement for both languages and for signed-in and signed-out use.
