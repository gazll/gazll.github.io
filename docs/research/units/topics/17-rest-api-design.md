# Research — REST API design, correctness, and lifecycle

Status: INTEGRATED

Reviewed: 2026-08-23

Local unit: 17-rest-api-design

EN file: public/data/topics/17-rest-api-design.json

VI file: public/data/topics/17-rest-api-design.vi.json

## Scope and non-goals

Canonical API-contract unit: resource/action modeling, URI and representation design, PUT/PATCH/bulk semantics, idempotency keys, Problem Details, 202 operations, cursor/cache/conditional requests, rate-limit communication, deprecation, and webhook safety. It does not own Saga/Outbox (09), broker delivery (08), transport internals (15), authentication (13/27), or provider-specific payment truth beyond the API boundary. Provider examples are not universal rules.

## Discovery pool and source-selection accounting

About sixty candidates were considered from RFC/IETF standards and drafts, OpenAPI/Google guidance, Stripe/Adyen first-party contracts, webhook/security standards, OWASP, and API lifecycle docs. Duplicate RFC formats, generic REST lists, SEO pages, and uncited provider summaries were excluded. Thirty-two distinct sources below were selected for normative semantics, competing provider scope, version status, security, or operations.

The discovery policy allowed up to 200 candidate sources when useful; this topic stopped at the selected set because additional candidates repeated RFC semantics or lacked a distinct provider, security, version, or operational contract.

## Local content map

Complete EN and VI files were read. Both contain 2 sections and 11 matching IDs.

| Section | Exact item IDs and current question | Role |
| --- | --- | --- |
| Modelling resources & URIs | 17-rest-api-design.modelling-resources-uris.q1 resources/URIs; q2 cancel/refund/ticket actions; q3 PUT/PATCH/Merge Patch/JSON Patch; q4 bulk/fields/expand | resource/mutation contract |
| Contracts, errors & lifecycle | 17-rest-api-design.contracts-errors-lifecycle.q1 Idempotency-Key; q2 RFC 9457; q3 202 polling/webhook/stream; q4 deprecation; q5 cursor/cache/conditional/rate limits; q6 outbound webhook; q7 inbound PSP webhook | production lifecycle |

VI preserves the IDs and code/header names. Qualifiers MUST/SHOULD, provider-specific, preview, and unresolved must remain equally strong in both languages.

## What is correct and reusable

- Treating charge, refund, cancel, and ticket issuance as explicit stateful commands is better than hiding effects behind GET/CRUD.
- PUT replacement, Merge Patch null deletion, JSON Patch operation lists, and PATCH’s non-inherent idempotency are correctly distinguished.
- The idempotency design has the right elements: key scope, request binding, IN_PROGRESS, result replay, mismatch, retention, and unknown outcome. The local key claim and business transition need one atomic boundary; Outbox is not a key store.
- RFC 9457 is the correct error-format anchor; trace IDs, field errors, and domain codes are extensions.
- 202 correctly separates durable acceptance from completion; status, expiry, terminal failure, and reconciliation must be defined.
- Webhook sections correctly emphasize raw bytes, signature/replay, fast durable acknowledgement, inbox deduplication, ordering, retries, and reconciliation.

## Claims to verify, qualify, or remove

| Local claim | Classification | Limit | Proposed handling |
| --- | --- | --- | --- |
| Plural nouns, hyphens, max two nesting levels are REST rules | style | RFC 9110 does not prescribe URI style | Label house convention |
| Collections must always be envelopes | recommendation | protocol does not mandate shape | Keep as evolution preference |
| Every non-CRUD action must be an action resource | recommendation | representation/state transition can be modeled otherwise | Give decision criteria |
| PUT is replacement and idempotent | verified with target scope | effect, not response/logging, is the relevant property | Keep RFC wording |
| PATCH is non-idempotent | incomplete | can be designed idempotently with conditions | Say “not guaranteed by method” |
| Merge Patch fits 95% | unsupported number | arrays, null, domain merge can reject it | Remove number |
| 207 is best for bulk | context-dependent | RFC 4918 is WebDAV; 200/202/409/422 may fit | Compare choices |
| Idempotency TTL is 24h–7d | provider examples/recommendation | Stripe/Adyen differ; local late-arrival window unknown | Separate facts/policy |
| Stripe, Adyen and VNPay use same model | unresolved | VNPay first-party contract not verified | Remove or source |
| Same key/different body must be 409 | recommendation | no universal RFC/provider requirement | Mark local policy |
| traceId/errors are RFC 9457 fields | false | extensions | Mark extension schema |
| 202 means it will complete | false | only current acceptance | Require status/reconciliation |
| LB timeout is often 60s | provider heuristic | varies by total/idle/header/body/stream | Measure deployed path |
| Deprecation/Sunset guarantees retirement | incomplete | signals do not migrate clients | Add inventory/telemetry/rollback |
| RateLimit is standardized | stale | draft-11 was active Internet-Draft on review date | Label draft; retain Retry-After |
| Cursor guarantees no duplicates | conditional | needs stable order/keyset/snapshot policy | Add invariant/load test |
| 4xx stops and 5xx retries webhooks | provider-specific | schedules/terminal codes differ | Verify provider |
| Always query PSP before trusting signed webhook | recommendation | provider authority differs | Make provider contract explicit |

## Workload, invariants, and failure model

| Dimension | Required decision |
| --- | --- |
| Caller | browser/mobile/backend/provider, proxy retry, clock skew, client versions |
| Effect | create/reserve/charge/refund/cancel, reversible/unknown, external authority |
| Key | tenant/account/endpoint/provider scope, entropy, result storage, retention |
| Data | payload/bulk size, fields, cursor index/order, PII |
| Async | acceptance/completion, status TTL, webhook/stream, manual reconciliation |
| Compatibility | oldest client, additive/breaking fields, version retirement |
| Security | authorization, replay, HMAC, SSRF, secrets, tenant isolation |
| SLO | latency, attempt budget, unknown rate, webhook lag, freshness, sunset date |

Invariants: one caller intent maps to one command identity; key reuse with a different request cannot silently create a new effect; a response does not claim an effect it cannot prove; cursor order is deterministic under its stated consistency; accepted async work is queryable/reconciliable; errors are machine-readable/non-sensitive; required webhook work is durable before acknowledgement; supported clients survive rollout.

| Crash window | Failure | Recovery |
| --- | --- | --- |
| Claim then process dies | stuck IN_PROGRESS | atomic lease/expiry/recovery |
| Commit then response lost | caller retries | stored result or PENDING/UNKNOWN |
| PSP timeout | effect may exist | provider key/status/reconcile |
| Async worker dies | pending forever | durable state/outbox/queue and lease |
| Duplicate/out-of-order webhook | double/stale transition | unique inbox + version/transition rule |
| Valid signature replay | old event re-applied | timestamp/nonce window + dedup |
| Cursor view changes | duplicate/omitted item | stable keyset/snapshot/version contract |
| Old client after sunset | outage | usage telemetry, brownout, migration, rollback |

## Coverage matrix

| Area | Evidence | Gap | Decision |
| --- | --- | --- | --- |
| Definitions | RFC 9110/5789/7396/6902/9457, AIP | low | standards versus style |
| Invariants | key/result, cursor, async, webhook | low | make testable |
| Workload | provider windows, bulk/cursor/async | provider inputs | contract card first |
| Failure/crash | unknown/retry/replay/order/retirement | low | retain table |
| Retries/timeouts | Retry-After/provider/AWS | endpoint policy | propagate deadline/attempt |
| Operations/recovery | lag/DLQ/reconcile/deprecation | ownership | assign runbook owner |
| Security/privacy | HMAC, SSRF, errors, RateLimit | low | raw-body/replay/PII/tenant tests |
| Testing | contract/provider/mixed-version/fault | suite naming | add regression matrix |
| Domain trade-offs | bank/fintech/OTA/commerce | good | cases keep unique invariants |

## Best-practice comparison

| Choice | Fit | Limitation |
| --- | --- | --- |
| Resource URI | durable addressable state | per-resource auth/state still required |
| Action resource | explicit command/transition | idempotency/legal state/async contract |
| PUT | complete replacement | partial clients can erase fields |
| Merge Patch | object partial update | arrays/explicit null problematic |
| JSON Patch | ordered/testable paths | path authorization/validation/atomicity |
| Idempotency-Key | unsafe POST with retry/unknown | scope, retention, result, mismatch/provider |
| 202 status resource | long-running work | durable state, expiry, auth, reconcile |
| Cursor/keyset | large mutable next-page | stable order/index; no arbitrary jumps |
| ETag/If-Match | cache/optimistic concurrency | validator/conflict policy |
| Webhook | partner push, at-least-once | signature/replay/dedup/retry/SSRF |
| Deprecation | controlled breaking migration | client inventory/support horizon |

## Contradiction/limits table

| Conflict | Resolution |
| --- | --- |
| REST style versus actions | Actions are fine when explicit; do not hide effects behind read verbs. |
| HTTP idempotency versus business idempotency | Payment/create needs domain/provider contract. |
| RFC 9457 versus local fields | Core members standard; trace/field/domain fields are extensions. |
| 202 versus completion | Acceptance is not completion. |
| RateLimit draft versus X-RateLimit headers | Draft can change; deployed headers are conventions/hints, not SLA. |
| Signature versus provider authority | Integrity does not settle freshness/state race. |
| Cursor versus snapshot | Keyset continuation is not automatically a snapshot. |

## Negative evidence and anti-patterns

- Never use GET for charge/cancel/refund or store a key without request binding, scope, result/unknown state, retention, and recovery.
- Outbox transports intent; it does not make a POST idempotent.
- Do not retry an unsafe timeout without a provider key/status query.
- Do not expose SQL, stack traces, provider bodies, internal URLs, or secrets in Problem Details.
- Do not fetch arbitrary callback URLs without SSRF/DNS/IP/egress controls.
- Do not verify a re-serialized body when a provider signs raw bytes.
- Do not acknowledge required webhook work before durable inbox/state transition or retry forever without quarantine.
- Do not use an unstable/raw offset as a cursor or deprecate only by sending a header.

## Duplicate/canonical ownership

09 owns distributed workflow/provider correctness; 17 owns API key/result contract. 08/25 own broker/consumer semantics; 15 owns transport budgets; 13/27 own auth; 20/26 own observability/testing portfolios. Payment/OTA/commerce cases retain provider/domain invariants and link here rather than repeating the generic recipe.

## Operational, security, observability, and testing notes

Track key claims/hits/mismatches/in-progress age/expiry, unknown PSP results, status age, payload size, cursor invalidation, ETag conflicts, 429/Retry-After, webhook attempts/age/replay/duplicates/DLQ, provider status, version usage and client versions. Correlate command/provider/event/reconciliation IDs without treating them as secrets.

Test IDOR/resource authorization, tenant key scope, replay/timestamp/nonce, constant-time HMAC, raw-body handling, key rotation, webhook SSRF/redirect/DNS rebinding, size limits, cache poisoning, cursor tampering, error redaction, same-key/different-body/concurrent requests, lost response/timeout-after-commit, provider unknown outcomes, async crash/expiry, cursor mutations, mixed-version schemas, duplicate/order/replay/bad signatures, DLQ/redrive, and deprecation brownouts.

## Integration record

- [x] Label URI/envelope rules as house style; remove the Merge Patch percentage heuristic.
- [x] Distinguish command/API, provider, consumer/inbox, and transport retry idempotency scopes with cross-references; a diagram remains optional follow-up.
- [x] Replace generic retention with a policy formula and keep Stripe/Adyen values scoped.
- [x] Remove the VNPay equivalence and keep traceId/errors as extensions.
- [x] Make 202 include durable status, expiry, terminal/reconciliation states, and Retry-After/Link guidance.
- [x] Update deprecation guidance with telemetry, migration, brownout, and rollback.
- [x] Mark the RateLimit draft as active, not an RFC.
- [x] Preserve the cursor/ETag/If-Match and webhook raw-body/replay/SSRF/order controls.
- [x] Add the durable upload-session resource and truthful `202` job contract as q8/q9; mirror both in VI.
- [x] Mirror the qualifiers in VI and integrate the paired public-data files.

## EN/VI and cross-reference plan

Keep 11 IDs and all headers/statuses/code identifiers. Cross-reference 08-message-queue, 09-distributed-tx-fintech, 13-security-oauth2, 15-network-i-o-models, 20-observability-sre, 25-microservice and 26-testing-strategy. Cases add provider/domain evidence only.

## Explicit unknowns and falsifiers

- Endpoint key scope/result/retention/late-arrival is unknown until the domain contract exists; late retry/cross-tenant collision falsifies it.
- Provider/region authority is unknown until current first-party docs/sandbox; Stripe/Adyen cannot prove another PSP.
- A restart/restore test falsifies durable 202 acceptance if work is lost/unqueryable.
- Usage telemetry falsifies a safe version-retirement plan if old clients remain.
- Cursor mutation tests falsify no-duplicate/no-omission claims.
- Provider docs must settle raw signing, timestamps/sequences, retry codes, replay and authority.
- Recheck RateLimit draft status before integration.

Confidence: high for RFC/PATCH/Problem Details; high for Stripe/Adyen within scope; medium for style; low for provider-neutral webhook/idempotency/rate-limit assumptions.

## Sources

| # | Source (title — organization) | Tier | Version/revision | Reviewed | Claims supported |
| ---: | --- | --- | --- | --- | --- |
| 1 | [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) — IETF | A standard | June 2022 | 2026-08-23 | methods, idempotency, status, conditionals, 202 |
| 2 | [RFC 9111 HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html) — IETF | A standard | June 2022 | 2026-08-23 | freshness and validators |
| 3 | [RFC 5789 PATCH](https://www.rfc-editor.org/rfc/rfc5789.html) — IETF | A standard | March 2010 | 2026-08-23 | PATCH/non-inherent idempotency |
| 4 | [RFC 7396 JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396.html) — IETF | A standard | October 2014 | 2026-08-23 | null deletion/array limitations |
| 5 | [RFC 6902 JSON Patch](https://www.rfc-editor.org/rfc/rfc6902.html) — IETF | A standard | April 2013 | 2026-08-23 | ordered patch operations |
| 6 | [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF | A standard | July 2023 | 2026-08-23 | error members/extensions |
| 7 | [RFC 4918 WebDAV/207](https://www.rfc-editor.org/rfc/rfc4918.html) — IETF | A standard | June 2007 | 2026-08-23 | 207 scope |
| 8 | [RFC 8594 Sunset](https://www.rfc-editor.org/rfc/rfc8594.html) — IETF | A standard | May 2019 | 2026-08-23 | sunset signal |
| 9 | [RFC 9745 Deprecation](https://www.rfc-editor.org/rfc/rfc9745.html) — IETF | A standard | March 2025 | 2026-08-23 | deprecation signal |
| 10 | [RFC 7240 Prefer](https://www.rfc-editor.org/rfc/rfc7240.html) — IETF | A standard | June 2014 | 2026-08-23 | async/response preference |
| 11 | [RFC 8288 Web Linking](https://www.rfc-editor.org/rfc/rfc8288.html) — IETF | A standard | October 2017 | 2026-08-23 | Link relations |
| 12 | [RateLimit header fields](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) — IETF HTTPAPI WG | A- active draft | draft-11, updated 2026-05-23 | 2026-08-23 | quota hints/no SLA/privacy |
| 13 | [AIP-121 Resource-oriented design](https://google.aip.dev/121) — Google | A guidance | current | 2026-08-23 | resource naming |
| 14 | [AIP-136 Custom methods](https://google.aip.dev/136) — Google | A guidance | current | 2026-08-23 | action methods |
| 15 | [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) — OpenAPI Initiative | A specification | latest published v3.2.0 | 2026-08-23 | HTTP contract/codegen |
| 16 | [AWS idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — AWS | A guidance | current article | 2026-08-23 | caller intent/result replay |
| 17 | [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Stripe | A provider docs | current | 2026-08-23 | key/result/parameter behavior |
| 18 | [Stripe idempotency post](https://stripe.com/blog/idempotency) — Stripe | A first-party post | 2015 context | 2026-08-23 | motivation, not current policy |
| 19 | [Adyen API idempotency](https://docs.adyen.com/development-resources/api-idempotency) — Adyen | A provider docs | current; minimum 7 days stated | 2026-08-23 | provider scope/retention/region |
| 20 | [RFC 2104 HMAC](https://www.rfc-editor.org/rfc/rfc2104.html) — IETF | A standard | February 1997 | 2026-08-23 | HMAC construction |
| 21 | [RFC 9421 HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421.html) — IETF | A standard | February 2024 | 2026-08-23 | signature concepts |
| 22 | [Stripe webhooks](https://docs.stripe.com/webhooks) — Stripe | A provider docs | current | 2026-08-23 | signature/event/retry |
| 23 | [Adyen webhooks](https://docs.adyen.com/development-resources/webhooks) — Adyen | A provider docs | current | 2026-08-23 | webhook auth/ack/retry |
| 24 | [OWASP SSRF prevention](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery_Prevention_Cheat_Sheet) — OWASP | A security guidance | current | 2026-08-23 | callback URL/SSRF |
| 25 | [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html) — IETF | A standard | July 2002 | 2026-08-23 | timestamps |
| 26 | [Stripe API errors](https://docs.stripe.com/api/errors) — Stripe | A provider docs | current | 2026-08-23 | provider errors/request IDs |
| 27 | [IANA HTTP status registry](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) — IANA | A registry | current | 2026-08-23 | status scope |
| 28 | [IANA HTTP field registry](https://www.iana.org/assignments/http-fields/http-fields.xhtml) — IANA | A registry | current | 2026-08-23 | header scope |
| 29 | [JSON Schema specification](https://json-schema.org/specification) — JSON Schema | A specification | current versions | 2026-08-23 | validation boundary |
| 30 | [Google API design guide](https://cloud.google.com/apis/design) — Google | A guidance | current | 2026-08-23 | resource/API lifecycle |
| 31 | [RFC 9110 info](https://www.rfc-editor.org/info/rfc9110/) — RFC Editor | A index | RFC status | 2026-08-23 | semantic version scope |
| 32 | [Stripe API reference](https://docs.stripe.com/api) — Stripe | A provider index | current | 2026-08-23 | endpoint contract must be checked |
