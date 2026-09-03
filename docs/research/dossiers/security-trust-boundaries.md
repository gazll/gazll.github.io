# Research - Security and trust boundaries

Status: `INTEGRATED`
Reviewed: 2026-08-23
Batch: F

This dossier is the cross-unit gate for identity, authentication, authorization, object ownership, signed callbacks, capability URLs, secrets, SSH access, and audit evidence. The core distinction is simple but often lost in system designs: proving who sent a request does not prove what that principal may do to this object, tenant, field, workflow state, or external side effect.

## Local scope

| Unit | Local responsibility in this batch | Existing canonical boundary |
| --- | --- | --- |
| Topic 13 - `13-security-oauth2` | OAuth/OIDC/JWT/opaque tokens, validation, service identity, resource authorization, webhook/capability boundaries, and key lifecycle | Topic 27 owns gateway placement/edge routing; Topic 17 owns API resource/idempotency semantics; Topic 20 owns security telemetry/incident response. |
| Case 10 - `10-xac-thuc-va-phan-quyen-trong-microservices` | Domain application of authentication versus authorization across gateway/services, ACL/RBAC/PBAC | The case keeps its illustrative microservice narrative; protocol requirements live in Topic 13. |
| Case 17 - `17-ssh-server-hardening-lessons` | Applied SSH incidents, host/bastion boundary, package provenance, and unknown-root compromise | The case keeps the incident lessons; generic incident response is Topic 20 and supply-chain standards are cited rather than repeated. |

Already integrated boundaries are reused: Topic 27 for edge authentication/routing and gateway failure, Topic 17 for API resource state and callback lifecycle, Topic 15 for transport/TLS/body limits, Topic 20 for incident and telemetry handling, and Topic 28 for lease/fencing. No UI/auth implementation is changed in this batch.

## Decision thesis

1. **OAuth is delegation; OIDC is authentication.** An access token authorizes a resource request according to its issuer/audience/scopes and the resource server's policy. An OIDC ID token describes an authentication event for the relying party; it is not a general API bearer token.
2. **Token validity is necessary, not sufficient.** The resource server must validate the trusted issuer, allowed algorithm/key, signature, audience/resource, token type/profile, time claims, and then evaluate the caller's action against the object, tenant, workflow state, and field allowlist.
3. **Gateway checks are coarse; ownership checks live at the resource boundary.** A valid user or service identity can still be forbidden from another tenant's order, another account's balance, or an internal field. Never trust client-supplied owner, role, tenant, or “isAdmin” fields.
4. **Bearer secrets are URLs or headers with a blast radius.** A presigned/capability URL grants whatever its signed principal and policy allow for its validity window; it can be copied, logged, leaked by referrer/history, or replayed. Scope method/resource/expiry/content and use a server-side one-time/revocation record for high-risk actions.
5. **Signed webhooks prove message authenticity only when the raw message, key, timestamp/nonce, and issuer scope are verified.** They do not prove the event is current, unique, authorized for the merchant/tenant, or safe to apply twice; those require replay controls, state checks, idempotency, and reconciliation.
6. **Long-lived sessions need revocation and recovery economics.** Short JWTs, refresh rotation/reuse detection, opaque introspection, sender-constrained tokens, BFF sessions, and cached keys each trade user experience, IdP availability, revocation speed, and implementation complexity.
7. **SSH hardening is layered risk reduction, not a root-cause verdict.** Port changes, key-only login, bastions, forwarding restrictions, package provenance, independent logs, credential rotation, and rebuild each protect a different boundary. A host compromise invalidates local evidence and requires containment/revocation/rebuild decisions.
8. **Audit is an evidence contract, not a token dump.** Record subject/principal, tenant, action, resource, decision, policy/version, request/correlation ID, key/issuer fingerprint, and time with privacy controls. Never log raw bearer tokens, private keys, signatures, passwords, or unnecessary personal/payment data.

## Trust model and glossary

| Term | What it proves | What it does not prove |
| --- | --- | --- |
| Authentication | A credential/assertion was accepted for a principal under an issuer/authenticator policy | The principal may access this object or perform this action. |
| Access token validation | A token is acceptable for this resource server at this time | The business action is authorized or the token was not stolen if it is bearer-only. |
| Authorization | Policy permits principal + action + resource + context | The request is authentic if the identity input was not authenticated. |
| Object-level authorization | This caller may read/mutate this exact object/tenant/field | That every object ID is safe to expose or that hiding 403 as 404 fixes ownership. |
| Scope/role/claim | A delegated/coarse attribute from a trusted issuer | Current ownership, workflow state, or all domain rules. |
| mTLS/DPoP | The request is bound to a certificate/key holder under the mechanism | The key holder is allowed to charge, refund, or mutate a given business object. |
| Webhook signature | The message bytes match a trusted sender key/secret under a scheme | The event is fresh, unique, in the right account, or safe to apply. |
| Capability URL | Possession of a time/permission-scoped URL can invoke the signed operation | The browser/user is still authorized, the URL is confidential, or the operation is one-time. |
| Audit event | A recorded decision/action with a defined evidence source | That the event is complete or immutable if the sink/access path is not protected. |

Core invariants:

1. Every accepted security assertion has a configured trust anchor, exact issuer/resource binding, allowed algorithms, time/replay rule, and key lifecycle.
2. Every state-changing resource request is authorized at the service/data boundary with server-derived subject/tenant/resource state; gateway identity headers are not authority by themselves.
3. User-controlled input cannot select an arbitrary redirect, issuer, JWKS, callback target, tenant, owner, role, field, policy, or capability resource.
4. A signed callback or retry can be delivered multiple times without creating a duplicate business effect; duplicates and unknown outcomes are observable and reconcilable.
5. Secrets, tokens, private keys, capability URLs, raw callback bodies, and sensitive claims do not leak through logs, URLs, referrers, traces, images, backups, test fixtures, or error responses.
6. Key/secret/session revocation has an owner, propagation path, expiry/reuse policy, emergency procedure, and a test that proves it takes effect.
7. High-risk authorization decisions fail closed when the policy/identity dependency is unavailable unless a bounded, explicitly approved degraded path exists.
8. SSH/host compromise response can proceed from an independent control/evidence plane and rotates all credentials reachable from the affected boundary.

## State machines and verification gates

### Authorization-code and login transaction

```text
START -> CREATE(state, nonce, PKCE) -> REDIRECT -> CALLBACK
                                      |             |
                                      v             v
                                  EXPIRED       VERIFY(state/nonce/code)
                                                    |
                                                    v
                                           TOKEN EXCHANGE -> SESSION/ID TOKEN
                                                    |
                                                    v
                                           RESOURCE TOKEN VALIDATION
```

- `state` binds the redirect response to the initiating browser/session; OIDC `nonce` binds the ID-token authentication event; PKCE binds the authorization code to the client instance.
- Exact redirect matching, one-time code use, issuer/discovery integrity, TLS, and bounded clock skew are protocol/implementation checks.
- A session/ID token is not automatically an access token; the resource server validates the token profile it receives.

### Resource authorization

```text
REQUEST -> AUTHENTICATE PRINCIPAL -> VALIDATE TOKEN/SESSION
                                      |
                                      v
                     RESOLVE TENANT + OBJECT FROM SERVER STATE
                                      |
                                      v
                         CHECK ACTION + FIELD + WORKFLOW POLICY
                         |                         |
                         v                         v
                      ALLOW                     DENY/AUDIT
```

Object IDs, tenant IDs, role names, and mutable “owner” fields from the request are selectors/inputs, not proof. Use scoped queries, policy checks, database row-level controls where appropriate, and tests that swap IDs/tenants/roles across horizontal and vertical boundaries.

### Signed webhook or provider callback

```text
RECEIVE RAW BODY -> VERIFY TLS/KEY/SIGNATURE/TIMESTAMP
                         |
                         v
                 CHECK EVENT ID + ACCOUNT + SCHEMA
                         |
                         v
                 ATOMIC DEDUPE / DURABLE ACCEPT
                         |
                         v
              ACK -> IDEMPOTENT PROCESS -> RECONCILE
```

Authenticate and validate before parsing into a business object. Use the provider's raw-byte signing scheme, constant-time comparison where applicable, key rotation policy, timestamp/nonce window, event-ID deduplication, merchant/account binding, state transition, amount/currency/tenant checks, and an idempotent effect. A 2xx acknowledgement should mean the message is durably accepted according to the provider contract, not that every downstream side effect has completed.

### Capability/presigned URL

```text
AUTHENTICATED REQUEST -> ISSUE(resource, method, constraints, expiry)
                                  |
                                  v
                            USE OR EXPIRE
                                  |
                    optional one-time/revocation check
```

A capability URL is a bearer capability. Keep it resource-specific, least-privilege, short-lived, content/method constrained, non-indexed, and absent from logs/referrers where possible. For payment, account, deletion, or sensitive export actions, issue a server-side capability record with nonce/used/revoked state or require a fresh authenticated authorization; expiry alone does not make a multi-use URL one-time.

## Failure and attack matrix

| Boundary | Failure/attack | Unsafe shortcut | Required control/evidence |
| --- | --- | --- | --- |
| OAuth redirect | Code injection/open redirect/CSRF | Compare redirect loosely or trust arbitrary return URL | Exact registered URI, state/PKCE/nonce binding, one-time code, no open redirect. |
| Token validation | `alg=none`, key confusion, wrong issuer/audience, unknown `kid` | “Signature verifies, so accept” | Algorithm/key allowlist, issuer/audience/resource/type/time validation, bounded JWKS refresh and stale-key policy. |
| Browser session | XSS/extension/third-party script steals bearer token | Store long-lived token in localStorage by default | BFF/HttpOnly/SameSite design where suitable, CSP/dependency controls, short lifetime/rotation, explicit threat model. |
| Service call | Gateway header spoofing or confused deputy | Trust `X-User`, `X-Tenant`, or client role fields | Strip/rewrite at trusted boundary, authenticated gateway-service channel, service-level authorization and audience. |
| Object API | IDOR/BOLA or mass assignment | Object ID/role in URL/body is enough | Server-side scoped lookup, action/field allowlist, tenant policy, horizontal/vertical authorization tests. |
| Policy dependency | PDP/IdP/introspection outage | Fail open for all writes or cache forever | Risk-tiered fail closed, bounded policy/key cache, stale age alert, emergency owner and audit. |
| Webhook | Forged, replayed, duplicate, wrong account, altered body | Trust IP/referer or parse/re-serialize before verify | Raw body signature, provider key, timestamp/nonce/event ID, atomic dedupe, account/state/idempotency/reconciliation. |
| Capability URL | URL copied to logs/chat/referrer or used after user revoke | Treat expiry as authorization and one-time guarantee | Least privilege, short expiry, method/content constraints, referrer/log controls, revoke/used record for high risk. |
| Secret/key lifecycle | Key leaked, rotation breaks old/new traffic, stale session survives | Rotate only the source file or delete one token | Inventory/owner, overlap window, emergency revocation, usage evidence, session family invalidation, tested rollback. |
| SSH host | Stolen key, root compromise, bastion pivot, agent/TCP forwarding | Non-default port or bastion equals secure | Individual short-lived identity, MFA/certificates, forwarding restrictions, independent logs, rebuild and rotate from outside host. |
| Audit | Logs contain tokens/PII or are deleted with the host | Log raw request/Authorization header for debugging | Structured privacy-safe event, independent sink, clock/tamper controls, retention/deletion policy, evidence access audit. |

## Domain comparison

| Domain | Strong boundary | Allowed flexibility | Security-specific failure to avoid |
| --- | --- | --- | --- |
| Bank/fintech | Transaction authorization, account/tenant ownership, step-up/fresh confirmation, immutable audit/control totals | Short-lived cached identity for low-risk reads; explicit pending/unknown provider state | Valid user token authorizes another account, stale policy authorizes transfer, callback replay duplicates money. |
| OTA booking | User/tenant/order ownership, supplier credentials, booking state and confirmation correlation | Browse/search can be public/stale; capability link may download a specific itinerary for a short window | Search result or supplier callback alone confirms booking/payment; leaked URL exposes another passenger. |
| Commerce | Seller/tenant/product/order ownership, price/inventory mutation policy, webhook merchant binding | Catalog/search/index can be derived; public product read may be anonymous | Mass assignment changes seller/price/status; valid seller token crosses tenant; payment callback changes any order. |
| Multi-tenant SaaS | Tenant derived from trusted session/service context and object query scope | Read-only policy cache with stated staleness | Client sends tenant ID/role and receives another tenant's data through cache, export, search, or async job. |
| Internal platform/SSH | Workload/operator identity, command/resource authorization, provenance and independent evidence | Break-glass access with time/approval/audit controls | Bastion/host is trusted forever; root compromise leaves keys, CI credentials, and local logs valid. |
| File upload/export | User/object authorization at issue time plus object key/method/content/expiry | Direct storage transfer via short capability | Presigned URL is treated as user identity, can upload arbitrary type/path, or remains in logs/referrer. |

## Duplicate and canonical ownership

| Repeated mechanism | Canonical owner | Batch F treatment |
| --- | --- | --- |
| OAuth/OIDC/JWT/opaque token protocol | Topic 13 | Own requirements, validation, lifecycle, and threat-model limits. |
| Gateway placement and edge auth | Topic 27 | Link for edge enforcement; Topic 13 explains token/authorization semantics. |
| API resource/idempotency/webhook lifecycle | Topic 17 | Topic 13 adds authenticity/replay/authorization; Topic 17 owns API state and response contract. |
| Payment/provider callback correctness | Topic 09 and relevant cases | Security verifies authenticity/account/state; workflow owns unknown/reconciliation effect. |
| Generic incident response/telemetry | Topic 20 | SSH compromise evidence and audit requirements link there. |
| SSH baseline and host compromise | Case 17 | Keep applied incident lessons; do not expand into an entire Linux admin manual. |
| Supply-chain provenance | Topic 14/26 and Case 17 | Cite SLSA/Sigstore and retain package/image incident boundary. |

## Coverage matrix

| Gate area | Topic 13 | Case 10 | Case 17 |
| --- | --- | --- | --- |
| Definitions | OAuth/OIDC/token/security boundary strong; current BCP/version labels needed | Authn/authz/ACL/RBAC/PBAC narrative; protocol details must link out | SSH/bastion/forwarding/provenance/root compromise separated |
| Invariants | Issuer/audience/algorithm, ownership, secret/revocation, callback replay | Tenant/resource/action policy and edge/service split | Individual accountability, least privilege, independent evidence, rebuild/rotation |
| Workload | Browser/native/confidential/service/high-risk transaction differences | Microservice hops, gateway, policy engine, multi-tenant resources | Human/CI/break-glass access, bastion and package/deploy paths |
| Failure/recovery | IdP/JWKS/introspection outage, key rotation, replay, leaked secret | Service/gateway header/policy mismatch and cached decision | Stolen key, root compromise, bastion, forwarding, malicious package |
| Operations | Key/session inventory, revocation, audit, alerting, privacy | Policy ownership, rollout, authorization drift tests | Canary config, log export, rebuild, credential rotation, response evidence |
| Security/privacy | Raw tokens/PII/claims/URLs, CSP, retention | Tenant isolation and over-privileged roles | Secrets, host logs, packages, identity and forensic data |
| Testing | Protocol negative tests, BOLA/mass assignment, callback replay, key rotation | Cross-tenant/action matrix and policy failure | Config/version, access/forwarding, provenance, compromise/rebuild drills |

## Negative evidence and anti-patterns

- Do not call OAuth login, OIDC ID-token validation, access-token validation, and resource authorization the same check.
- Do not accept an ID token at an API because it is a valid JWT; validate the expected access-token audience/profile.
- Do not choose a JWKS URL, issuer, redirect URI, tenant, owner, or policy endpoint from an untrusted request parameter.
- Do not trust gateway-added identity headers unless the service authenticates the gateway path and strips client copies; still enforce object ownership at the service.
- Do not return all object fields or bind a request body directly into a domain entity; allowlist fields and policy-check each sensitive transition.
- Do not verify a webhook after parsing/re-serializing if the provider signs the raw bytes; do not trust IP/referer alone.
- Do not treat a signed callback as unique, current, authorized for this account, or safe to retry without state/idempotency checks.
- Do not treat a capability URL as a user session, or assume expiry makes a URL confidential, one-time, or instantly revocable.
- Do not log Authorization headers, refresh tokens, private keys, webhook secrets, presigned URLs, or raw sensitive payloads.
- Do not use a bastion, SSH port change, key-only login, artifact signature, or benchmark pass as proof that a host cannot be compromised.
- Do not rebuild a compromised host without preserving required evidence and rotating credentials reachable from it.

## Unknowns and falsifiers

| Unknown | How to resolve | Falsifier |
| --- | --- | --- |
| Which clients/IdP/token profiles are in scope? | Inventory browser/native/backend flows, issuers, audiences, token types and libraries | A client cannot use PKCE/rotation/sender constraint as assumed or an API accepts a different token profile. |
| What is the accepted revocation window? | Risk owner, session/device policy, incident drill | Stolen token remains usable beyond the stated window or logout is expected to be immediate but cache is longer. |
| Where is object/tenant ownership enforced? | Trace request through gateway/service/DB/cache/async worker | A valid token can swap an object/tenant ID or an async job runs under a broader identity. |
| What callback/capability URL does a provider actually sign? | Provider contract, raw-body fixture, key rotation and replay tests | Framework parsing changes bytes, account binding is absent, or a duplicate changes state twice. |
| What happens when IdP/JWKS/PDP is down? | Fault injection and staged failover by risk tier | Sensitive writes fail open, keys refresh storm, or stale policy has no alert/expiry. |
| What evidence survives host compromise? | Independent sink, cloud audit, key-use logs, image/provenance records | Local logs/keys are the only evidence or cannot be trusted after root access. |
| Can the system rotate/rebuild without lockout? | Canary key/config rollout, second-session/break-glass test, credential rotation drill | Rotation strands operators, leaves old credentials active, or rollback is untested. |

## Selected source ledger

Reviewed 2026-08-23. The candidate search was capped at 200 candidates; this selected ledger keeps 43 distinct standards, official guidance, primary specifications, and first-party implementation documents. Protocol requirements, provider features, and local recommendations are labeled separately.

### OAuth, OIDC, tokens, and identity assurance

1. [RFC 9700 - OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html)
2. [RFC 6749 - OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html)
3. [RFC 6750 - OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)
4. [RFC 7636 - PKCE](https://www.rfc-editor.org/rfc/rfc7636.html)
5. [RFC 8414 - Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414.html)
6. [RFC 8705 - OAuth mTLS](https://www.rfc-editor.org/rfc/rfc8705.html)
7. [RFC 9068 - JWT Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068.html)
8. [RFC 9449 - OAuth 2.0 DPoP](https://www.rfc-editor.org/rfc/rfc9449.html)
9. [RFC 7519 - JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519.html)
10. [RFC 8725 - JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
11. [OpenID Connect Core 1.0 incorporating errata](https://openid.net/specs/openid-connect-core-1_0.html)
12. [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html)
13. [NIST SP 800-63-4 Digital Identity Guidelines](https://www.nist.gov/publications/nist-sp-800-63-4-digital-identity-guidelines)
14. [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
15. [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)

### Authorization, object ownership, replay, and callbacks

16. [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
17. [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
18. [OWASP API Security Project](https://owasp.org/www-project-api-security/)
19. [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
20. [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
21. [OWASP Third-Party Payment Gateway Integration Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html)
22. [AWS S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
23. [AWS Prescriptive Guidance: presigned URL guardrails](https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/overview.html)
24. [AWS IAM signature authentication methods](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-authentication-methods.html)
25. [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signatures)
26. [Stripe webhook best practices](https://docs.stripe.com/webhooks)
27. [Google Zanzibar paper and deployment summary](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)
28. [OpenFGA documentation](https://openfga.dev/docs)

### SSH, supply chain, and incident trust

29. [OpenBSD sshd_config manual](https://man.openbsd.org/sshd_config)
30. [OpenBSD ssh-keygen manual](https://man.openbsd.org/ssh-keygen)
31. [OpenSSH release notes](https://www.openssh.com/releasenotes.html)
32. [Ubuntu OpenSSH server guidance](https://ubuntu.com/server/docs/how-to/security/openssh-server/)
33. [CISA enhanced visibility and hardening guidance](https://www.cisa.gov/resources-tools/resources/enhanced-visibility-and-hardening-guidance-communications-infrastructure)
34. [NIST SP 800-61 Rev. 3 incident response](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
35. [NIST SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
36. [NIST SP 800-53 Rev. 5 controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
37. [NIST SP 800-92 log management](https://csrc.nist.gov/pubs/sp/800/92/final)
38. [CISA Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)

### Artifact provenance and deployment evidence

39. [Sigstore Cosign overview](https://docs.sigstore.dev/cosign/overview/)
40. [Sigstore signature verification](https://docs.sigstore.dev/cosign/verifying/verify/)
41. [SLSA Provenance v1](https://slsa.dev/provenance/v1)
42. [in-toto project](https://in-toto.io/)
43. [GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations)

## Integration map and gate

| Public unit | Proposed smallest patch | Evidence it must not claim |
| --- | --- | --- |
| Topic 13 | Three bilingual items: object-level authorization, webhook/capability verification, and audit/key/revocation operations | No universal token-storage answer, instant revocation, or signature-as-authorization claim. |
| Case 10 | EN/VI qualifier at service authorization boundary | The historical article is illustrative; valid JWT/RSA/OAuth does not prove tenant/resource permission. |
| Case 17 | EN/VI source/forensic qualifier around incidents and SSH controls | Hardening controls reduce risk; they do not identify the local root cause or guarantee no compromise. |

Gate status:

- [x] Exact local maps and canonical ownership recorded.
- [x] Candidate source pool searched broadly; selected ledger has 43 distinct sources.
- [x] Facts, protocol requirements, recommendations, limits, failure matrix, state machines, and falsifiers recorded.
- [x] EN/VI parity plan and duplicate boundaries recorded.
- [x] Add three bilingual Topic 13 items and EN/VI case qualifiers.
- [x] Rebuild content index, verify parity/case anchors, and run the full check gate.
- [x] Mark per-unit records and this dossier `INTEGRATED` only after validation passes.
