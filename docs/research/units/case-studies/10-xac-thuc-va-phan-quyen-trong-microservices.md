# Research — Authentication and authorization in microservices

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `10-xac-thuc-va-phan-quyen-trong-microservices`

EN file: `public/data/case-studies/articles/10-xac-thuc-va-phan-quyen-trong-microservices.html`

VI file: `public/data/case-studies/articles/10-xac-thuc-va-phan-quyen-trong-microservices.vi.html`

Metadata: the paired case-study metadata JSON entries and article files were read in full.

## Scope and evidence posture

This case owns the boundary between authentication, token validation, and authorization in a service-oriented system. It compares JWT and opaque tokens, edge/BFF enforcement with service-side enforcement, and ACL/RBAC/PBAC/ABAC vocabulary. It does not own a particular identity provider, a universal JWT lifetime, a complete OAuth client registration guide, or a domain’s resource policy.

The discovery pool was about 45 candidates. The 24 sources in the ledger were selected from IETF/OIDC standards, NIST, OWASP, OASIS, and official implementation documentation. Generic JWT tutorials, “microservices are secure inside the VPC” articles, and vendor comparison pages were excluded.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `bat-dau-tu-monolithic` | Session/cookie authentication in a monolith. |
| `bai-toan-kho-microservices` | Why identity and authorization become distributed concerns. |
| `dinh-danh` | Identity/authentication terminology. |
| `su-dung-jwt` | Self-contained access token model. |
| `ma-hoa-rsa-cho-jwt` | RSA/JWT section; EN wording currently calls signing “encryption.” |
| `su-dung-opaque-token-khi-muon-de-kiem-soat-phien-lam-viec-tot-hon` | Opaque token/introspection and revocation trade-off. |
| `oauth-2` | OAuth 2.0 section; EN currently calls OAuth authentication without OIDC qualification. |
| `kien-truc-cho-xac-thuc-va-phan-quyen` | Edge gateway/BFF and service enforcement. |
| `xac-thuc-phan-quyen-tai-lop-ria` | Edge-layer authentication/authorization. |
| `xac-thuc-phan-quyen-tai-cac-service` | Service-side checks and internal trust. |
| `access-control`, `access-control-list-acl`, `role-based-access-control-rbac`, `policy-based-access-control-pbac` | ACL/RBAC/PBAC/ABAC comparison and policy conditions. |
| `tong-ket` | Summary. |

EN and VI IDs are paired. The VI guide already says more accurately that OAuth is an authorization framework and OIDC supplies authentication; the EN body/guide must be brought to the same level.

## What is correct and reusable

- A token proves or conveys an identity/authorization context only after the recipient validates issuer, signature, time, audience/resource, token type, and key lifecycle.
- JWT is signed data by default; JWS integrity/authentication is not JWE confidentiality. RSA can be used for signatures or encryption depending on the JOSE mode, but “RSA-encrypted JWT” is not a safe generic description.
- Opaque tokens and introspection give the authorization server a revocation/active-state control point, at the cost of network availability, latency, caching, and privacy considerations.
- Gateway/BFF checks are useful for early rejection and coarse policy, but every service that owns a protected resource must enforce resource/action authorization. Internal network location is not an authorization proof.
- ACL, RBAC, and ABAC/PBAC are policy models with different administration and evaluation costs, not a maturity ladder where the last acronym is always better.

## Claims to verify or qualify

| Local claim/shape | Classification | Required correction |
| --- | --- | --- |
| JWT is better/faster than opaque tokens | Workload-dependent inference | JWT avoids an introspection round trip only when local validation is acceptable; key rotation, revocation, token size, claim privacy, and policy freshness can reverse the trade-off. Benchmark the actual path. |
| “RSA encryption for JWT” | Incorrect terminology | Say RSA signing/JWS for integrity/authentication; use JWE only when confidentiality is required and specify algorithms/key management. |
| OAuth 2.0 is an authentication protocol | Incorrect | RFC 6749 defines authorization/delegation. Use OIDC when the client needs authenticated end-user identity. |
| Gateway can authenticate/authorize and services can trust it | Unsafe absolute | Gateway is a policy enforcement point and routing boundary; services must validate the caller/resource/action context or receive a cryptographically/service-authenticated assertion under an explicit trust contract. |
| Internal services are trusted because they are on a private network | Anti-pattern | NIST zero trust and OWASP BOLA guidance support resource-level checks independent of network location. |
| ACL is not popular, RBAC/PBAC is the solution | Unverified generalization | Choose by cardinality, delegation, relation/context, policy change rate, auditability and latency; PBAC/ABAC has policy/data/decision-point complexity. |
| Regex/claim conditions are sufficient policy | Incomplete | Normalize identity/tenant/resource inputs, define deny/indeterminate precedence, test policy combinations, and prevent user-controlled regex/resource confusion. |
| Long-lived JWTs simplify SSO | Security trade-off | Longer lifetime increases replay exposure and stale authorization. Use short access tokens plus refresh rotation/sender constraint/revocation strategy where risk requires it. |

## Workload, invariants, and failure model

### Workload model

Record: browser/mobile/service client type; number of issuers/audiences; token request rate; per-request latency budget; revocation SLA; key rotation cadence; policy change rate; tenant/resource cardinality; offline/online requirements; PII sensitivity; and whether tokens cross trust domains. A browser SSO session and a service-to-service workload should not share one token profile by default.

### Invariants

1. Authentication answers “who/what is presenting this credential?”; authorization answers “may that subject perform this action on this resource in this context?”
2. Every resource server validates `iss`, signature/algorithm, `exp`/time, intended `aud` or resource, token type/profile, and required subject claims according to its issuer contract.
3. A user/service cannot select a tenant, object, or action outside the server-side policy scope merely by changing a path, claim, or JSON property.
4. Key rotation and issuer metadata failures fail closed for high-risk operations and have a bounded recovery/runbook path.
5. Token, policy, introspection, and audit caches have explicit freshness and revocation semantics.
6. Policy decisions are observable without logging bearer tokens or sensitive attributes.

### Failure/crash windows

| Window | Result | Control |
| --- | --- | --- |
| Token stolen before expiry | Replay as bearer | Short TTL, audience restriction, TLS, sender-constrained DPoP/mTLS where supported, refresh rotation and incident revocation. |
| JWKS rotation during cache lifetime | False reject or, worse, stale acceptance | RFC 8414 metadata, key IDs, bounded cache refresh, overlap window, rotation test. |
| Issuer/audience mismatch | Confused-deputy/token substitution | Strict allowlist and exact validation; never accept any issuer/audience from the token. |
| Introspection endpoint unavailable | Availability versus revocation freshness | Timeout/fail-closed policy for sensitive operations; bounded cache with explicit risk. |
| Gateway bypass/direct service access | Edge-only policy bypass | Service-side authn/authz, mTLS/service identity, network policy as defense in depth. |
| Policy update races | Old permission accepted briefly | Versioned policies, decision logs, cache invalidation/freshness SLO, deny-by-default for revocation. |
| Claim/policy parser confusion | Wrong permit/deny | Typed claims, canonicalization, policy unit/property tests, deny/indeterminate handling. |
| User has valid identity but wrong object | Data exposure/BOLA | Object-level and property/action authorization with negative tests. |

## Best-practice comparison

| Model | Strength | Cost/limit | Appropriate boundary |
| --- | --- | --- | --- |
| Signed JWT access token | Local validation, low dependency latency, portable claims | Revocation/policy freshness, key rotation, privacy/token size, claim confusion | Stable resource-server audience with bounded stale authorization risk. |
| Opaque token + introspection | Central active/revocation decision and small client token | Network/latency/availability, cache staleness, authorization-server load | High revocation sensitivity or centralized policy control. |
| Gateway/BFF enforcement | Coarse reject, centralized routing/rate policy, simpler clients | Bypass risk, policy concentration, incomplete resource context | Edge authentication and coarse admission, never sole resource authorization. |
| Service-side enforcement | Resource owner sees actual subject/action/resource and survives edge bypass | Policy duplication or PDP dependency; needs shared identity contract | Every protected resource/action. |
| ACL | Direct object exception/ownership policy | Large per-object administration and drift | Small explicit sharing sets. |
| RBAC | Simple role assignment and audit | Role explosion, weak context/object relations | Stable job/function permissions. |
| ABAC/PBAC | Subject/resource/action/environment conditions and central policy | Attribute quality, policy evaluation, caching, explainability | Multi-tenant/contextual policies with a capable PDP/PEP model. |

## Coverage matrix

| Gate area | Current coverage | Gap/proposed treatment |
| --- | --- | --- |
| Definitions | Partial | Correct OAuth/OIDC/JWT/JWS/JWE/authn/authz terminology. |
| Invariants | Partial | Add issuer/audience/algorithm/type/time/object checks as a verification contract. |
| Workload | Weak | Add token size, RPS, revocation SLA, policy freshness and client type worksheet. |
| Failure/crash windows | Weak | Add key rotation, introspection outage, gateway bypass, replay, policy cache and BOLA rows. |
| Retries/timeouts | Weak | Define introspection timeout/fail mode, JWKS refresh, token endpoint retry and no blind bearer replay. |
| Operations/recovery | Partial | Metrics: auth failures by reason, JWKS refresh, introspection latency/error, policy decision latency/cache age, deny/indeterminate, token revocation. |
| Security/privacy | Strong foundation | Add bearer-token redaction, claim minimisation, tenant isolation, DPoP/mTLS scope, PII policy and audit access. |
| Testing | Partial | Add algorithm-confusion, issuer/audience, expired/not-yet-valid, key rotation, BOLA/property and policy precedence tests. |
| Domain trade-offs | Partial | State bank/fintech uses stronger revocation/audit and service boundaries; low-risk read APIs may use a different freshness budget. |

## Contradictions and limits

| Tension | Why both can be valid | Scope |
| --- | --- | --- |
| JWT is stateless versus revocation is centralized | Local verification avoids a call, but a revoked bearer token remains valid until expiry unless another control exists | Token TTL, risk, audience, issuer and revocation SLA. |
| Gateway centralization versus service autonomy | A gateway can reduce repeated edge work, but it cannot infer every resource relationship | Resource owner must enforce at the service/PDP boundary. |
| RBAC simplicity versus ABAC expressiveness | RBAC is easier to reason about for stable roles; ABAC handles context but adds policy/data complexity | Tenant count, delegation, policy churn and audit need. |
| DPoP reduces replay versus deployment complexity | Sender-constrained tokens need key lifecycle and client/resource-server support | RFC 9449 support and client type; not a drop-in bearer replacement. |
| Fail-open improves availability versus fail-closed improves authorization safety | An outage may affect reads differently from money/privileged writes | Per-operation risk policy, not one global switch. |
| Token claims improve latency versus claim minimisation | More claims can reduce lookups but increase staleness, exposure and privacy | Use only claims needed by the resource server. |

## Negative evidence and anti-patterns

- Do not say “JWT is encrypted” unless the exact JWE encryption profile is implemented; a signed JWT is readable by token holders.
- Do not call OAuth 2.0 login/authentication without OIDC or another identity protocol.
- Do not accept `alg` from an untrusted token, a wildcard issuer, a missing/unchecked audience, or a token meant for another resource server.
- Do not put authorization decisions only in a gateway or API gateway plugin when services are directly reachable, asynchronously consume events, or own object-level relationships.
- Do not log `Authorization` headers, refresh tokens, full JWTs, or raw sensitive policy attributes.
- Do not use a regex policy engine as a substitute for canonical identifiers and explicit allow/deny semantics.
- Do not assume an internal service call is trusted because it uses a private IP; authenticate service identity and authorize the operation.
- Do not extend token TTL to hide an unavailable introspection service without measuring replay and revocation risk.

## Duplicate/canonical ownership

- Canonical identity/token protocol vocabulary: this case and its supporting RFC ledger.
- Generic API idempotency and error semantics: topic 17; this case should link to it.
- Service failure/retry and policy-cache operations: topic 25/20; keep only auth-specific failure windows here.
- Domain authorization: bank/fintech, OTA, and admin cases own the resource policy examples.
- OAuth/OIDC implementation details should not be copied into every microservice design prompt.

## EN/VI parity and proposed follow-up changes

- [ ] Correct EN `ma-hoa-rsa-cho-jwt`: distinguish JWS signing from JWE encryption and explain RSA algorithm choice only with a named profile.
- [ ] Correct EN `oauth-2`: OAuth 2.0 is authorization/delegation; OIDC is the identity layer.
- [ ] Align VI and EN on issuer/audience/algorithm/type/time validation and service-side authorization.
- [ ] Replace universal JWT performance/revocation claims with the comparison table.
- [ ] Keep ACL/RBAC/PBAC examples but state that ABAC is the NIST term for subject/object/action/environment attributes; PBAC is a broader policy-based architecture label.
- [ ] Add key-rotation/introspection/gateway-bypass/BOLA tests and metrics.
- [ ] Preserve the paired IDs and fix the malformed regex/example quote before content integration.

## Integration record (Batch F scope)

- Added paired EN/VI review-boundary qualifiers at the service authorization section.
- The qualifier explicitly limits the historical JWT/RSA/OAuth narrative: token validity and gateway authentication do not prove tenant/object/field permission.
- It also requires trusted ownership checks across service hops, caches, exports, workers, and IdP/JWKS/policy outages.
- Broader example cleanup, target-provider choices, and negative tests remain follow-up questions below; no persistent case IDs or figures were changed.

## Open questions and falsifiers

- [ ] Which identity provider, issuer set, access-token profile, and resource audiences does the project actually use? Without this, code examples remain protocol-neutral.
- [ ] What is the maximum acceptable stale authorization/revocation window per operation? If it is near zero, a long-lived self-contained JWT recommendation is falsified.
- [ ] Are services directly reachable or only through the gateway? Direct reachability falsifies edge-only authorization.
- [ ] What policy decision latency and attribute source availability are acceptable? If a remote PDP cannot meet the write deadline, policy caching or local enforcement needs redesign.
- [ ] Which claims are PII or tenant-sensitive? If tokens cross more trust domains than expected, claim minimisation and audience separation become mandatory.
- [ ] Can negative tests demonstrate that a valid user token cannot read another tenant/object/property? A BOLA test failure falsifies the authorization model regardless of JWT validation success.

## Source ledger

All sources were reviewed on `2026-08-23`. `S1` is a standard/official specification; `S2` is official security/implementation guidance; `S3` is a formal policy specification.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | [RFC 6749 — OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html) — IETF | S1; Proposed Standard, 2012; updated by RFC 9700 | OAuth roles, authorization/delegation model and grant terminology; not an end-user authentication protocol. |
| S02 | [RFC 6750 — Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html) — IETF | S1; Standards Track, 2012 | Bearer replay/threat model, TLS requirement and resource-server use. |
| S03 | [RFC 7519 — JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519.html) — IETF | S1; Standards Track, 2015 | JWT claims/serialization; a JWT format does not itself imply encryption. |
| S04 | [RFC 8725 — JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html) — IETF | S1; BCP, 2020 | Algorithm allowlist, issuer/audience validation, explicit typing, key entropy and cross-JWT confusion controls. |
| S05 | [RFC 9068 — JWT Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068.html) — IETF | S1; Standards Track, 2021 | Access-token profile, `typ`, issuer/audience/subject and signed JWT access-token requirements. |
| S06 | [RFC 7662 — OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662.html) — IETF | S1; Standards Track, 2015 | Active/revoked token query, authorization-server/resource-server relationship, TLS/client auth and caching trade-off. |
| S07 | [RFC 9700 — OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html) — IETF | S1; BCP 240, January 2025 | PKCE, redirect/CSRF/mix-up protections, audience restriction, refresh rotation, sender constraint and insecure-flow deprecation. |
| S08 | [RFC 7636 — PKCE](https://www.rfc-editor.org/rfc/rfc7636.html) — IETF | S1; Standards Track, 2015 | Code-verifier/challenge protection for public/native and other OAuth clients. |
| S09 | [RFC 8414 — Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414.html) — IETF | S1; Standards Track, 2018 | Issuer, endpoints, JWKS and supported-method discovery. |
| S10 | [RFC 8707 — Resource Indicators](https://www.rfc-editor.org/rfc/rfc8707.html) — IETF | S1; Standards Track, 2020 | Explicit protected-resource audience selection and token restriction. |
| S11 | [RFC 9207 — OAuth Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207.html) — IETF | S1; Standards Track, 2022 | Mix-up mitigation using issuer identification. |
| S12 | [RFC 9449 — DPoP](https://www.rfc-editor.org/rfc/rfc9449.html) — IETF | S1; Standards Track, 2023 | Per-request proof-of-possession and key-bound access-token replay reduction; proof alone is not authorization. |
| S13 | [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0-18.html) — OpenID Foundation | S1; second errata edition | Authentication built on OAuth 2.0 and identity Claims/nonce semantics. |
| S14 | [XACML 3.0 Core plus Errata 01](https://www.oasis-open.org/standard/xacmlv3-0/) — OASIS | S3; Standard 2013 + Errata 01 2017 | Policy Enforcement Point/Decision Point model, subject/resource/action/environment attributes and Permit/Deny/Indeterminate/NotApplicable. |
| S15 | [SP 800-162 ABAC](https://csrc.nist.gov/pubs/sp/800/162/upd2/final) — NIST | S2; final with 2019 update | ABAC definition and subject/object/action/environment policy evaluation. |
| S16 | [SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) — NIST | S2; Digital Identity Guidelines 4th revision, 2025 | Authentication assurance, authenticator/session requirements, and distinction between integrity/authentication and confidentiality. |
| S17 | [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) — OWASP | S2; 2023 edition | API risk taxonomy including broken authentication/authorization and unrestricted sensitive flows. |
| S18 | [API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — OWASP | S2; 2023 edition | A valid user/session ID is not enough; object-level authorization must be enforced. |
| S19 | [SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) — NIST | S2; final 2020 | No implicit trust from network location; resource-centric, continuously evaluated access. |
| S20 | [SP 800-53 Rev. 5.1](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) — NIST | S2; update 1 | Access control, identification/authentication, audit, least privilege, configuration and privacy control families. |
| S21 | [Envoy external authorization filter](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/security/ext_authz_filter) — Envoy | S2; current docs | Gateway/sidecar external authorization is an enforcement integration; it does not remove resource-owner policy design. |
| S22 | [OPA Policy Language](https://www.openpolicyagent.org/docs/latest/policy-language/) — Open Policy Agent | S2; current docs | A policy decision engine can separate policy from application code; policy distribution/evaluation remains an operational dependency. |
| S23 | [Keycloak token introspection](https://www.keycloak.org/docs-api/latest/rest-api/index.html#_tokenintrospection) — Keycloak | S2; current API docs | An implementation example of introspection endpoint behaviour; provider configuration/version still matters. |
| S24 | [JWS](https://www.rfc-editor.org/rfc/rfc7515.html) and [JWE](https://www.rfc-editor.org/rfc/rfc7516.html) — IETF | S1; JOSE standards | Signature/integrity and encryption/confidentiality are different JOSE objects; supports correcting the RSA wording. |

## Excluded discovery candidates

JWT blog posts and “JWT versus session” benchmarks were excluded when they omitted revocation, audience, key rotation, or workload details. OAuth tutorials that used “authentication” colloquially were not used to override RFC 6749/OIDC terminology. Vendor-specific gateway/PDP pages were kept only as implementation examples, never as universal architecture proof.

## Gate status

- [x] Complete EN/VI article sections, IDs and metadata read.
- [x] Discovery pool broadened; selected ledger has 24 distinct inspected sources.
- [x] Local terminology errors and over-absolute claims identified.
- [x] Workload, invariants, crash windows, comparison, coverage, limits, anti-patterns and falsifiers recorded.
- [x] EN/VI parity and canonical ownership recorded.
- [x] EN/VI content integration applied for the Batch F qualifier.
- [x] Validation passed after integration.
