# Research - Security: OAuth 2.0, OIDC, tokens, and application boundaries

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `13-security-oauth2`

EN file: `public/data/topics/13-security-oauth2.json`

VI file: `public/data/topics/13-security-oauth2.vi.json`

## Scope and non-goals

This dossier covers the assigned topic's OAuth/OIDC flows, JWT and opaque-token trade-offs, service authentication/authorization, Keycloak examples, boundary coding risks, secrets, and stored-data protection. It is the canonical protocol/security owner for those explanations. Topic 27 owns gateway placement and edge routing; topic 14 owns Kubernetes secret delivery and workload operations; topic 20 owns security telemetry/incident response; topic 28 owns distributed lock safety.

The discovery pool used IETF RFCs/BCPs, OpenID specifications, Spring Security and Keycloak documentation, and OWASP primary guidance. Versioned copies, search-result pages, SEO security lists, and vendor marketing claims were not selected. Browser and identity advice is explicitly qualified by client type, provider configuration, token type, and current document revision.

## Local content map

Both JSON files were read in full. Each has 6 sections and 31 items. EN is 89,440 bytes; VI is 96,638 bytes. The `item_id` sets are structurally identical.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| OAuth2 & OIDC | `13-security-oauth2.oauth2-oidc.q1` to `.q3` | Roles, modern flows, Authorization Code + PKCE, OAuth versus OIDC |
| JWT & tokens | `13-security-oauth2.jwt-tokens.q1` to `.q4` | JWT validation, stateless versus opaque sessions, access/refresh/revocation, browser storage |
| Designing the auth system | `13-security-oauth2.designing-the-auth-system.q1` to `.q7` | SSO/gateway, mTLS, OWASP controls, secrets, credential stuffing, RBAC/ABAC, API keys |
| Keycloak in practice | `13-security-oauth2.keycloak-in-practice.q1` to `.q6` | Realm/client/endpoints, Spring validation, role mapping, token exchange, production failure, build/buy |
| Secure coding at the boundary | `13-security-oauth2.secure-coding-at-the-boundary.q1` to `.q4` | Injection, mass assignment, deserialization, SSRF |
| Protecting the data you store | `13-security-oauth2.protecting-the-data-you-store.q1` to `.q7` | Encryption-at-rest limits, leak paths, retention/deletion versus audit, supply chain, object authorization, signed callbacks, capability URLs, key/session operations |

Complete IDs:

```text
13-security-oauth2.oauth2-oidc.q1 .. q3
13-security-oauth2.jwt-tokens.q1 .. q4
13-security-oauth2.designing-the-auth-system.q1 .. q7
13-security-oauth2.keycloak-in-practice.q1 .. q6
13-security-oauth2.secure-coding-at-the-boundary.q1 .. q4
13-security-oauth2.protecting-the-data-you-store.q1 .. q7
```

The range notation above expands only within the named section; no IDs are being changed or invented.

## What is correct and reusable

- The topic correctly separates OAuth authorization from OIDC authentication. An access token is for a protected resource; an ID token is an OIDC authentication artifact and should not be used as a general API bearer token.
- Authorization Code + PKCE, exact redirect matching, issuer/audience validation, key rotation, refresh-token protection, and “do not trust claims without validation” are the right security spine.
- The local comparison of JWT and opaque/session tokens is useful because it makes revocation, introspection availability, payload disclosure, and operational control explicit rather than treating “stateless” as automatically better.
- The microservice section correctly distinguishes authentication from authorization and treats service-to-service mTLS, JWT, and policy decisions as different layers. The gateway section should cross-link to topic 27 rather than repeat edge filters.
- The Keycloak section is practical, but it must pin the Keycloak/Spring versions and label endpoint/token examples as provider configuration, not OAuth requirements.
- The boundary-coding questions are valuable because OAuth does not remove mass assignment, SSRF, deserialization, injection, secrets, or data-retention risks.

## Claims to verify or qualify

| Local claim/pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| OAuth 2.0 has authorization-server, client, resource-owner, and resource-server roles | Verified protocol fact | Keep the roles but explain that deployments can combine roles and that OAuth does not define a login UI. | High |
| Authorization Code + PKCE is the modern default | Verified current BCP for public/browser clients | RFC 9700 requires authorization servers to support PKCE and recommends it broadly; RFC 10017 (published Aug 2026) specifically requires it for browser public clients. Confidential-client deployment and provider compatibility still need scope. | High |
| Implicit/password grants should be avoided | Verified BCP guidance | Say “not recommended/deprecated by current security guidance” rather than imply every legacy provider has removed them. | High |
| OAuth equals authentication/SSO | Incorrect | OIDC adds an authentication protocol and ID-token claims on top of OAuth. OAuth access delegation alone does not prove a user login. | High |
| JWT is encrypted | Incorrect | A JWS JWT is signed/MACed and base64url encoded; claims remain readable. JWE is a separate encryption form and changes deployment/validation. | High |
| JWT is always better because it is stateless | Recommendation presented as fact | Stateless verification improves local availability but makes revocation, claim freshness, key rotation, payload leakage, and audience mistakes harder. Opaque sessions can be safer for high-revocation/high-risk flows. | High |
| Signature verification is enough | Incorrect | Validate algorithm allow-list, signature, issuer, audience, type/profile, time claims, key selection, and application authorization. RFC 8725 explicitly warns against algorithm and issuer/audience confusion. | High |
| JWKS rotation is automatic everywhere | Provider/framework-dependent | Spring Security can discover/cache keys and rotate within its implementation; cache refresh, startup dependency, unknown `kid`, and emergency revocation behavior are provider/version/configuration-specific. | High |
| Refresh tokens may live for a month without further controls | Unresolved policy | Lifetime is a risk/UX decision. Current BCP calls for sender-constraining or rotation/reuse detection for public-client refresh tokens; record device/session revocation and theft response. | High |
| localStorage is a safe place for long-lived tokens | Negative evidence | OWASP warns that JavaScript can read Web Storage; an XSS/third-party-script compromise can exfiltrate tokens. Prefer an appropriate BFF/HttpOnly cookie design or explicitly accept the SPA threat model. | High |
| Gateway-only authorization is sufficient | Incorrect | Gateway can perform coarse route/authentication checks; resource ownership, tenant isolation, and business authorization belong at the service/data boundary too. | High |
| mTLS proves business authorization | Incorrect | mTLS authenticates a certificate/workload/channel; it does not decide whether the caller may mutate a tenant/order/account. | High |
| Keycloak realm roles map directly to every application authority | Provider mapping | Token claims, client scopes, audience, role mappers, and Spring authority conversion must be configured; role names do not automatically equal domain permissions. | High |
| Token exchange is a generic OAuth requirement | Provider-specific | Keycloak token exchange and subject-token policies are implementation/configuration features; do not present them as a portable RFC flow without naming the extension. | High |
| Encryption at rest protects stored data completely | Incorrect | It does not prevent authorized application reads, logs, dumps, backups, analytics exports, memory exposure, compromised keys, or overbroad access. | High |
| “Hash all sensitive data” | Unsafe shorthand | Passwords require a password-hashing/KDF design; searchable/financial data may require tokenization, envelope encryption, keyed hashing, or plaintext under strict controls. | High |

## Workload, invariants, and failure model

### Workload and trust model

The final content should identify the client class (`browser public client`, native public client, confidential backend, machine-to-machine service), the identity provider/issuer, resource audience, tenant/region, token type, key algorithm, clock tolerance, and revocation requirement. It should also state whether an API call is interactive login, delegated user access, a service call, a high-risk transaction, or a background job.

Security invariants:

1. Every accepted token has a trusted issuer, allowed algorithm/key, valid signature, expected audience/resource, valid time window, and an explicit token type/profile.
2. Authentication success is not authorization success; the resource server enforces tenant/resource ownership and action policy.
3. Redirect URIs, `state`, PKCE verifier/challenge, and OIDC `nonce` are transaction-specific and bound to the user agent/client.
4. An access token is not logged, copied into untrusted headers, or persisted in a storage location whose compromise is outside the accepted threat model.
5. Refresh/session revocation and key rotation have an operational path that remains usable during IdP/JWKS outage.
6. Secrets are scoped, rotated, auditable, and never supplied through source code, image layers, query strings, or unredacted logs.
7. Authorization decisions are fail-closed for high-risk actions unless a documented, bounded degraded mode exists.

### Crash windows and recovery

| Window | Failure or attack | Required behavior/recovery |
| --- | --- | --- |
| Authorization redirect before callback | `state`/PKCE/nonce missing, reused, or mismatched | Reject the transaction; do not exchange the code; record a privacy-safe security event. |
| Code issued, client loses response | User retries and the code is single-use/expired | Restart the flow or use a safe transaction state; never accept a code without the verifier. |
| JWKS fetch at resource-server startup | IdP or metadata endpoint unavailable | Decide whether cached trusted keys permit startup; do not silently accept unverifiable tokens; alert on stale-key age. |
| New `kid` appears | Key rotation arrives before cache refresh | Refresh metadata/JWKS with bounded backoff; reject unknown key until verified; prevent refresh storms. |
| Access token expires during request | Request may reach service after expiry | Validate at the resource-server boundary; clients renew only through the documented flow, not by extending claims locally. |
| Refresh token replay | Stolen token used after legitimate rotation | Reuse detection/sender-constraining should revoke the session family or device according to provider policy. |
| Introspection endpoint is slow/down | Synchronous auth dependency becomes an outage | Cache only within a bounded staleness/revocation policy; choose fail-closed for sensitive operations and instrument auth dependency separately. |
| Gateway strips/injects identity header incorrectly | Service trusts attacker-controlled `X-User-*` or stale identity | Strip at the trusted boundary, authenticate the gateway-to-service channel, and re-validate/authorize at the service. |
| Policy engine unavailable | ABAC/resource policy cannot be evaluated | Fail closed for writes/high-risk actions; optionally use a versioned, bounded local policy cache for low-risk reads. |
| Secret/key leaked to logs/backups/image | Long-lived compromise survives code fix | Rotate/revoke, locate copies, invalidate sessions/tokens, and preserve a separate audit trail without logging the secret. |
| Deletion request versus immutable audit | Privacy deletion conflicts with legal/audit retention | Separate personal identity from immutable event references, document retention authority, and use cryptographic/tokenized references where allowed. |

## Best-practice comparison

| Choice | Advantages | Failure/operational cost | Fit |
| --- | --- | --- | --- |
| Short JWT access token + rotated refresh token | Local verification, low per-request IdP dependency | Revocation is indirect; claim/audience mistakes and browser storage risk | Ordinary APIs when resource servers can validate and revocation window is acceptable |
| Opaque access token + introspection | Central revocation and small client-visible token | IdP latency/availability, cache staleness, introspection load | High-revocation/high-risk access or a provider with strong introspection operations |
| Server-side session/BFF + HttpOnly cookie | Tokens stay off browser JS path; centralized session control | Session store/CSRF/SameSite/deployment complexity | Browser applications handling sensitive user sessions |
| SPA direct Authorization Code + PKCE | Standards-based, no client secret, browser-friendly | XSS/third-party script can act as the user; refresh-token storage is difficult | Public SPA with a deliberately accepted threat model and hardened CSP/dependencies |
| mTLS / certificate-bound token | Strong workload/client binding and reduced bearer replay | PKI/cert rotation, proxies, device support, termination topology | Service-to-service or regulated channels where certificate lifecycle is owned |
| DPoP | Sender-constrained proof at HTTP layer | Key storage, nonce/replay handling, library/provider support | Browser/native/public clients where mTLS is not practical and the provider supports it |
| RBAC | Explainable role assignments | Role explosion and stale broad roles | Stable coarse permissions and administration |
| ABAC/policy engine | Resource/tenant/context-aware decisions | Policy latency, cache invalidation, language/tooling/availability | Multi-tenant or delegated policy with a clear PDP ownership model |
| API key | Simple service identification/quotas | Bearer secret, weak user delegation and rotation/revocation unless designed | Low-risk server-to-server integration with scoped, rotated keys |
| OAuth access token | Delegation, scopes/audience/issuer ecosystem | Protocol/configuration complexity and token lifecycle | User/service delegated API access with a real authorization server |

## Coverage matrix

| Gate area | Evidence and local coverage | Gap to close before integration |
| --- | --- | --- |
| Definitions | OAuth roles, OIDC, JWT/opaque, access/refresh, RBAC/ABAC, API key | Add a one-line “OAuth is not login” warning near every beginner flow. |
| Invariants | issuer/audience/algorithm/time validation, PKCE, service authorization | Add explicit resource-owner/tenant checks and token type/profile validation. |
| Workload | Browser, mobile, microservice, Keycloak, high-risk data | Label exact client/provider/region assumptions for every code sample. |
| Failure/crash windows | JWKS, revocation, refresh replay, policy/secret outages | Add stale-key/session-cache bounds and operator recovery steps. |
| Retries/timeouts | Token endpoint/introspection/JWKS concerns are mentioned | Add retry budgets and single-flight refresh to avoid IdP storms. |
| Operations/recovery | Secret rotation, brute-force/credential stuffing, audit | Add dashboards/runbooks for unknown `kid`, auth latency, refresh reuse, and policy deny spikes. |
| Security/privacy | OWASP controls, storage, SSRF/deserialization/mass assignment | Add log redaction and trace/baggage rules; state data residency/legal retention is deployment-specific. |
| Testing | Flow, token, Keycloak, boundary attack material | Add negative JWT corpus, rotation/outage, redirect replay, tenant isolation, and secret-scan tests. |
| Domain trade-offs | Fintech/regulatory and ordinary API examples | Separate mandatory control from “good default”; threat model and regulation decide. |

## Contradictions and limits

| Competing guarantee | Evidence boundary | Teaching implication |
| --- | --- | --- |
| JWT availability vs revocation | JWT resource servers can validate locally; RFC 7662 introspection centralizes active-state checks. | Choose based on revocation window and dependency budget, not “stateless always wins.” |
| Browser convenience vs token confidentiality | RFC 10017 supports Code + PKCE for browser public clients, while OWASP warns that Web Storage is script-readable. | PKCE protects code exchange; it does not make an XSS-compromised browser safe. Consider BFF/HttpOnly sessions. |
| mTLS vs DPoP | RFC 8705 binds to TLS client certificates; RFC 9449 binds HTTP requests to a proof key. | These are different deployment/crypto/lifecycle choices, not interchangeable checkbox controls. |
| Coarse gateway checks vs domain authorization | Gateway can reject unauthenticated routes; resource servers know the object/tenant/business state. | Keep both where threat and cost justify it; never trust a forwarded user header as authorization. |
| Keycloak feature vs portable OAuth | Realm/client roles, token exchange, mappers, and admin endpoint behavior are Keycloak configuration. | Cite Keycloak for the example and RFCs for portable protocol claims. |
| Encryption vs deletion/audit | Encryption limits exposure at rest but does not establish retention or deletion semantics. | Treat key destruction, tokenization, audit identity, and legal hold as separate controls. |
| OWASP awareness vs conformance | OWASP Top 10 is awareness guidance; API Top 10 categories do not prove a control implementation. | Use the lists to find tests/threats, not as a compliance certificate. |

## Negative evidence and anti-patterns

- Do not accept any JWT algorithm advertised by the token header; configure a trusted algorithm/key family and validate the issuer/audience/type profile.
- Do not use an ID token as an API access token merely because it is a JWT containing a user identifier.
- Do not put client secrets in a browser, mobile binary, public repository, Docker `ARG`, or frontend environment variable.
- Do not store long-lived refresh/access tokens in `localStorage` and call the result “secure SSO”; document the XSS and third-party-script threat if a public SPA must do so.
- Do not trust `X-User`, `X-Roles`, or tenant headers from an untrusted hop. Strip and re-inject only after authenticating the hop, then authorize against resource state.
- Do not make every microservice call an online introspection/OPA/Keycloak call without a latency, cache, single-flight, and outage plan.
- Do not equate mTLS with least privilege, or RBAC role names with resource ownership.
- Do not log access/refresh tokens, authorization codes, PKCE verifiers, cookies, raw passwords, private keys, or full sensitive request bodies.
- Do not claim encryption-at-rest solves data leakage, compromised application credentials, backups, analytics exports, or deletion obligations.
- Do not deserialize attacker-controlled polymorphic data or bind request JSON directly into privileged domain entities.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Action |
| --- | --- | --- |
| OAuth/OIDC/JWT/Keycloak/security boundary | Topic 13 (this dossier) | Keep protocol facts and security controls here. |
| Gateway route/filter placement, edge JWKS/introspection and forwarded headers | Topic 27 | Link from the “gateway” questions; do not duplicate all edge failure semantics here. |
| Kubernetes Secret/External Secrets, pod identity and mesh operations | Topic 14 | Keep deployment mechanics there; keep secret lifecycle/threat model here. |
| SLO/telemetry/redaction/incident response | Topic 20 | Cross-link operational signals and security-event handling. |
| API error/idempotency semantics | Topic 17 and Case Study 15 | Link for client retries/unknown outcomes. |
| Supply-chain image/provenance controls | Topic 14 | Mention threat, not a second CI/CD tutorial. |

## Proposed content changes (not applied)

- [ ] Replace “OAuth authentication” wording with “OAuth authorization; OIDC authentication” throughout EN/VI.
- [ ] Make Authorization Code + PKCE the default public/browser flow; cite RFC 9700 and the newly published RFC 10017, while leaving provider compatibility as an open question.
- [ ] Add a token-validation checklist: trusted issuer, allowed algorithm, signature/key, `typ`, `iss`, `aud`, `exp`, `nbf`, clock skew, scopes, and resource ownership.
- [ ] Split JWT, opaque token, BFF/session, DPoP, and mTLS into a decision matrix rather than presenting JWT as the default answer.
- [ ] Mark all Keycloak endpoints, role mappers, token exchange, and Spring authority conversions as version/provider examples.
- [ ] Add refresh-token rotation/reuse detection, JWKS single-flight/unknown-`kid` recovery, and IdP outage behavior.
- [ ] Replace “secure browser storage” absolutes with a threat-model table covering HttpOnly cookie/BFF, in-memory SPA state, and Web Storage risks.
- [ ] Add negative test cases for algorithm confusion, wrong issuer/audience, key rotation, replay, mass assignment, SSRF, deserialization, and cross-tenant access.
- [ ] Separate encryption-at-rest, key management, application authorization, retention/deletion, and immutable audit into independent controls.
- [ ] Update EN and VI together, preserving all 28 IDs and code identifiers.

## EN/VI parity and cross-reference plan

The EN/VI structures and IDs match exactly. Integrate security qualifiers as paired edits, not by translating only headings. Keep protocol names, claim names, endpoint paths, HTTP headers, and code identifiers unchanged. Vietnamese explanations should retain the same distinction between “fact” and “khuyến nghị” so the VI page does not turn a provider-specific default into a universal rule.

## Integration record (Batch F scope)

- Added paired q5/q6/q7 items under Protecting the data you store: object-level and tenant authorization, webhook/capability replay boundaries, and operational key rotation/session revocation/audit.
- Preserved every existing item ID; EN/VI item IDs and section order remain identical.
- Reused canonical ownership instead of duplicating Topic 27 edge routing, Topic 17 API lifecycle, Topic 20 incident telemetry, or Topic 28 lease/fencing.
- Rebuilt public/data/content-index.json; the repository validator reports 486 total items with no thin item below the configured threshold.
- Remaining provider/version and browser-architecture decisions stay open below; INTEGRATED means the reviewed Batch F scope is in public data, not that deployment-specific policy is universal.

## Open questions and falsifiers

- [ ] Is the target browser architecture a direct SPA, BFF, server-rendered app, native app, or a hybrid? This determines storage and PKCE guidance.
- [ ] Which IdP/Keycloak version, Spring Security version, signing algorithms, issuer topology, and regions are in scope?
- [ ] What is the maximum acceptable revocation window for access and refresh tokens, and how is emergency revocation performed during IdP/JWKS outage?
- [ ] Are service-to-service callers workload identities, OAuth clients, user-delegated calls, or all three?
- [ ] Which domain actions require resource-level authorization/fencing beyond token scopes?
- [ ] What would falsify the JWT recommendation: key rotation cannot meet outage bounds, revocation latency exceeds the risk window, token payload confidentiality is required, or audit shows browser script exposure is unacceptable?
- [ ] What would falsify the policy-cache recommendation: stale policy permits a prohibited write, policy version cannot be observed, or recovery after a policy-store outage is not testable?

## Source ledger

All selected sources were inspected/reviewed on 2026-08-23. Tier A is an RFC/standard/specification or official project documentation; Tier B is first-party security guidance. Current pages must be pinned to the chosen implementation version before code examples are integrated.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 13-01 | [RFC 6749 - The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html), IETF | A; RFC, Oct 2012 | OAuth roles, authorization code/client credentials/resource-owner model, token endpoint concepts. | 2026-08-23 |
| 13-02 | [RFC 9700 - Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html), IETF | A; BCP 240, Jan 2025 | Exact redirect matching, PKCE support/enforcement, implicit/password deprecation guidance, refresh protection, sender/audience restriction, mix-up/CSRF threats. | 2026-08-23 |
| 13-03 | [RFC 7636 - Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636.html), IETF | A; RFC, Sep 2015 | `code_verifier`/`code_challenge` binding and authorization-code interception mitigation. | 2026-08-23 |
| 13-04 | [RFC 10017 - OAuth 2.0 for Browser-Based Applications](https://www.rfc-editor.org/rfc/rfc10017.html), IETF | A; BCP 212, Aug 2026 | Browser public-client Code + PKCE, browser threat model, CORS/session-history context, and XSS/token-storage limitations. | 2026-08-23 |
| 13-05 | [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414.html), IETF | A; RFC, Jun 2018 | Issuer metadata, authorization/token endpoints, JWKS URI and supported PKCE metadata. | 2026-08-23 |
| 13-06 | [RFC 9068 - JWT Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068.html), IETF | A; RFC, Oct 2021 | JWT access-token profile, `typ`, issuer/audience and scope/profile validation context. | 2026-08-23 |
| 13-07 | [RFC 8725 - JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html), IETF | A; BCP, Feb 2020 | Algorithm allow-lists, issuer/audience validation, explicit typing, key/claim confusion defenses. | 2026-08-23 |
| 13-08 | [RFC 7662 - OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662.html), IETF | A; RFC, Oct 2015 | Active/opaque-token introspection contract and its authorization-server dependency. | 2026-08-23 |
| 13-09 | [RFC 8705 - OAuth 2.0 Mutual-TLS Client Authentication](https://www.rfc-editor.org/rfc/rfc8705.html), IETF | A; RFC, Feb 2020 | mTLS client authentication and certificate-bound access-token scope. | 2026-08-23 |
| 13-10 | [RFC 9449 - OAuth 2.0 Demonstrating Proof of Possession](https://www.rfc-editor.org/rfc/rfc9449.html), IETF | A; RFC, Sep 2023 | DPoP proof/key binding, replay window/nonce considerations, and sender-constrained bearer reduction. | 2026-08-23 |
| 13-11 | [RFC 8707 - Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html), IETF | A; RFC, Feb 2020 | Resource/audience restriction for tokens in multi-resource deployments. | 2026-08-23 |
| 13-12 | [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0-18.html), OpenID Foundation | A; Final 1.0 incorporating errata set 2 | OIDC authentication request, ID token, nonce, claims, UserInfo, and OAuth relationship. | 2026-08-23 |
| 13-13 | [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html), OpenID Foundation | A; Final 1.0 incorporating errata set 2 | Provider discovery, issuer and endpoint metadata; deployment trust still needs configuration. | 2026-08-23 |
| 13-14 | [OAuth 2.0 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html), Spring Security | A; current reference, Spring Security line not pinned | Issuer/JWK discovery, signature/exp/nbf/iss validation, audience configuration, key rotation behavior, and scope-to-authority mapping in Spring. | 2026-08-23 |
| 13-15 | [Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/), Keycloak | A; current “latest” guide, version must be pinned | Realm/client concepts, client scopes/roles, service accounts, token endpoints, role mapping, and provider-specific administration. | 2026-08-23 |
| 13-16 | [OWASP Top 10](https://owasp.org/www-project-top-ten/), OWASP Foundation | A/B; 2025 project edition at review date | Current web-risk awareness categories and limits of using Top 10 as a control checklist. | 2026-08-23 |
| 13-17 | [OWASP API Security Top 10 release notes](https://owasp.org/API-Security/editions/2023/en/0x04-release-notes/), OWASP Foundation | A/B; 2023 edition | API-specific risks including authorization, SSRF, unrestricted sensitive flows and resource abuse. | 2026-08-23 |
| 13-18 | [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), OWASP | B; current cheat sheet | Authentication controls, password/credential attack handling, error/timing considerations, and MFA guidance. | 2026-08-23 |
| 13-19 | [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), OWASP | B; current cheat sheet | Cookie attributes, session identifiers, Web Storage/token risks, rotation and invalidation. | 2026-08-23 |
| 13-20 | [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), OWASP | B; current cheat sheet | Secret inventory, least privilege, rotation, revocation, dynamic credentials, and leakage paths. | 2026-08-23 |
| 13-21 | [Server-Side Request Forgery Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), OWASP | B; current cheat sheet | SSRF allowlist/network-egress/redirect/DNS risks and provider/cloud metadata concerns. | 2026-08-23 |
| 13-22 | [Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html), OWASP | B; current cheat sheet | Untrusted object parsing, gadget/RCE/DoS risks, type allowlists and safer formats. | 2026-08-23 |
| 13-23 | [Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html), OWASP | B; current cheat sheet | DTO allowlists, bindable fields, privilege/property overposting controls. | 2026-08-23 |
| 13-24 | [Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html), OWASP | B; current cheat sheet | Parameterization, context-aware encoding/validation, and injection beyond SQL. | 2026-08-23 |
| 13-25 | [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), OWASP | B; current cheat sheet | CSRF tokens, SameSite limitations, and state-changing browser request protection. | 2026-08-23 |
| 13-26 | [Spring Boot OAuth2 reference](https://docs.spring.io/spring-boot/reference/security/oauth2.html), Spring | A; current reference, version not pinned | Spring Boot resource-server/client integration entry points; code examples remain version-sensitive. | 2026-08-23 |
| 13-27 | [OAuth 2.1 Authorization Framework draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/), IETF OAuth WG | A; active Internet-Draft -15, last updated 2026-03-02; intended RFC status `(None)` | OAuth 2.1 status is work in progress, not a final RFC; teaching content must cite RFC 9700 for the current security BCP and pin provider compatibility separately. | 2026-08-23 |

## Gate status

- [x] Complete EN/VI files and exact IDs read.
- [x] Broad standards/implementation/security source pool inspected and selected sources mapped to claims.
- [x] Coverage matrix, contradiction/limits, negative evidence, crash windows, security/privacy, testing and domain trade-offs recorded.
- [x] Duplicate/canonical role and EN/VI parity plan recorded.
- [ ] Target IdP/Keycloak/Spring/browser architecture and version approved.
- [x] Content changes integrated into `public/data`.
- [x] Validation run after integration.
