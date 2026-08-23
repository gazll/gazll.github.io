# Research — SSH server hardening lessons

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `17-ssh-server-hardening-lessons`

EN file: `public/data/case-studies/articles/17-ssh-server-hardening-lessons.html`

VI file: `public/data/case-studies/articles/17-ssh-server-hardening-lessons.vi.html`

Metadata: the paired case-study metadata JSON and article files were read in full.

## Scope and evidence posture

This is a defensive case study about SSH exposure, bastion design, package provenance and response after a suspected host compromise. The local article groups four incidents around different security boundaries and proposes an SSH baseline, a chokepoint/bastion model and signed-package checks. It does not contain enough host telemetry, disk images, authentication logs or package provenance to establish a forensic root cause. Any wording that implies the machine was “safe for two years,” that a malicious package definitely caused compromise, or that a port change stopped attacks must remain explicitly anecdotal or unresolved.

The selected evidence prioritizes OpenSSH/OpenBSD and Ubuntu documentation, NIST incident/supply-chain/zero-trust guidance, CISA, CIS, Sigstore/SLSA/in-toto and systemd/AppArmor documentation. Configuration directives are version- and distribution-sensitive. A setting that is valid on OpenSSH 10.0/OpenBSD or Ubuntu's current package is not automatically a safe drop-in for every OpenSSH version, PAM stack, automation workflow or cloud image.

Discovery used a broader pool of official standards and first-party guidance. The ledger contains 28 selected sources. It supports controls and limits, not a claim that this particular server was compromised in a particular way.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `1-four-incidents-four-different-boundaries` | Separates four observed incidents/lessons instead of treating “SSH security” as one control. |
| `2-what-each-control-does-and-does-not-do` | Explains the boundary and non-boundary of port changes, keys, bastions and package checks. |
| `3-a-safer-ssh-baseline` | Gives an SSH daemon hardening baseline and operational cautions. |
| `4-the-bastion-is-a-chokepoint-not-a-trust-anchor` | Uses a bastion as an access-control/observability point without treating it as proof of host trust. |
| `5-the-malicious-package-changes-the-threat-model` | Extends the threat model from login abuse to software supply chain and runtime compromise. |
| `6-unknown-root-compromise-is-an-incident` | Requires containment, evidence preservation, credential rotation and rebuild when root compromise is unknown. |
| `7-operating-the-design` | Covers updates, logs, key lifecycle, monitoring, backups and recovery. |
| `8-design-review-questions` | Lists questions for a real deployment review. |
| `9-primary-references` | Gives the local reference set. |

## Local claims: fact, inference and qualification

| Local claim or control | Evidence status | Research qualification |
| --- | --- | --- |
| Changing the SSH port reduces automated noise but is not authentication or authorization. | Security inference; compatible with OpenSSH/CISA guidance. | It may reduce log volume, but scanners can discover the port. Never count it as a control against a determined attacker. |
| Disable password authentication where public-key/certificate access is operationally ready. | Supported recommendation by Ubuntu/OpenSSH hardening practice. | Validate recovery and break-glass access first; key-only can create lockout and does not stop a stolen private key. |
| Disable direct root login and use named accounts plus privilege elevation. | Supported by OpenSSH/Ubuntu least-privilege practice. | Root access may still be obtained through `sudo`; audit authorization and session evidence, not just the SSH username. |
| A bastion concentrates ingress, policy and logs. | Architecture inference; compatible with zero-trust guidance. | It is a choke point, not a trust anchor. A compromised bastion can become a high-value pivot unless target authorization and host verification remain independent. |
| `AllowAgentForwarding no`, `AllowTcpForwarding no` and similar restrictions reduce pivot paths. | Supported by OpenSSH directives and threat model. | These settings can break deployment/database workflows; apply per role/Match block where possible and test required paths. |
| Signed package/provenance verification changes the malicious-package threat model. | Supported by Sigstore/SLSA/in-toto concepts. | Signature/provenance establishes an identity/build-chain claim; it does not prove the binary is bug-free or safe at runtime. |
| Unknown root compromise should be handled as an incident rather than “cleaned” in place. | Supported by NIST incident response and supply-chain guidance. | Exact containment/rebuild depends on evidence, business continuity, image availability and legal/forensic requirements. |
| Long uptime without an observed incident demonstrates safety. | Not verified; negative evidence only. | Absence of detection is not absence of compromise. Need logs, asset inventory, key history and integrity evidence. |

## Workload, trust and invariant model

| Dimension | Model for this case | What must be measured/decided |
| --- | --- | --- |
| Human access | Named operators, automation identities and a break-glass path may all need SSH. | Account inventory, owner, MFA/key type, last use, approval and offboarding SLA. |
| Network exposure | Public SSH, private subnet access, VPN, bastion or cloud session service are different attack surfaces. | Reachability from Internet/CI/admin networks, source restrictions, IPv4/IPv6, security-group/firewall rules. |
| Authentication | Public key, SSH certificate, hardware-backed key, password or federated/MFA gateway. | Phishing/theft resistance, rotation/revocation, PAM integration and recovery procedure. |
| Authorization | Login identity is not the same as command privilege. | `AllowUsers`/groups, `sudoers`, file permissions, service accounts and privilege escalation logs. |
| Forwarding | Agent, TCP, stream-local and X11 forwarding can create pivot/data-exfiltration channels. | Required forwarding matrix per role; default deny where not needed. |
| Software supply chain | OS packages, language packages, container/image layers, deployment artifacts and startup scripts. | Repository trust, signature/provenance verification, pinned versions, SBOM/attestation and rollback image. |
| Host integrity | A root-level attacker can alter the daemon, logs, keys, binaries and monitoring. | Independent log sink, measured/rebuilt image, EDR/file-integrity coverage and evidence retention. |
| Availability | Hardening must not remove all access during a network/authentication failure. | Break-glass test, RTO/RPO, recovery console, alternate admin path and documented lockout recovery. |

Security invariants should be stated as properties, not merely config lines:

1. Every production login maps to an accountable identity and an approved authorization path.
2. A stolen or revoked user key cannot provide indefinite access; rotation/revocation is observable and tested.
3. No path from the public edge grants more privilege or network reach than the role requires.
4. A bastion, CI runner or package repository is not treated as proof that the target host is trustworthy.
5. Security-relevant logs and evidence remain available to an attacker who gains root only if they are exported to an independent control plane.
6. An administrator can recover access without weakening the baseline ad hoc during an outage.
7. A deployed artifact can be traced to an approved source/build and a known host/image state, with exceptions recorded.

## Failure and crash/incident windows

| Window | Possible outcome | Required control/recovery |
| --- | --- | --- |
| Password auth disabled before key/MFA recovery is tested | All operators are locked out. | Stage config, validate a second session, retain an approved break-glass route and use `sshd -t`/distribution-specific validation before reload. |
| Port changed but firewall/security group not updated | Service outage; operators may widen access unsafely. | Change network and daemon policy together, test IPv4/IPv6 and document rollback. |
| Private key stolen | Attacker authenticates as the key owner. | Hardware-backed keys/MFA where supported, short certificate lifetimes or rapid revocation, inventory and rotate on suspicion. |
| Bastion compromised | Attacker can attempt pivoting and observe sessions/forwarded traffic. | Target-side authorization, host-key verification, forwarding restrictions, independent logs and bastion rebuild. |
| Agent forwarding enabled to an untrusted host | Remote process may use the forwarded agent to request signatures. | Disable by default or use per-host/per-role restrictions; prefer short-lived/certified identities. |
| TCP forwarding exposes an internal service | SSH becomes an unauthorized tunnel. | Deny or constrain forwarding, monitor channels and require an explicit exception per workflow. |
| Malicious or tampered package installed | Backdoor executes with service/root privileges. | Verify source/signature/provenance, pin/allowlist artifacts, isolate build/deploy and rebuild from a trusted image when uncertain. |
| Root compromise suspected | Local logs, keys and binaries may be untrustworthy. | Contain from an independent plane, preserve evidence, revoke credentials, scope blast radius, rebuild and reconcile secrets. |
| Log collector is on the compromised host | Attacker can delete or alter evidence. | Export auth/process/package/network logs to an independent sink with access controls and retention. |
| Update introduces incompatible OpenSSH/PAM behaviour | Automation or emergency access fails. | Versioned config tests, canary host, staged rollout and tested rollback/recovery console. |
| Host image is rebuilt without key/secret rotation | Attacker retains external access. | Rotate user/host/service/cloud credentials and verify authorized-key/certificate inventories. |

## Control comparison

| Control/design | Primary boundary | Helps with | Does not prove/prevent |
| --- | --- | --- | --- |
| Non-default SSH port | Discovery/noise | Some commodity scans and log noise. | Targeted discovery, credential theft, host compromise or authorization failure. |
| Public-key authentication | Authentication | Removes password guessing and enables key identity. | Stolen private keys, bad authorization, malicious authorized keys or root compromise. |
| MFA/security key/certificate | Authentication/session lifetime | Raises theft/phishing cost and can shorten credential lifetime. | Vulnerable authorized commands, compromised host, unsafe `sudo`, supply-chain backdoor. |
| `PermitRootLogin no` + named users | Accountability/authorization | Reduces direct root login and improves attribution. | Privilege escalation through `sudo` or a service. |
| Bastion/VPN/private access | Network edge/control point | Reduces public reachability and centralizes policy/logging. | Compromised bastion, stolen valid identity or target-side misconfiguration. |
| Forwarding restrictions | Lateral movement/data path | Removes unused agent/TCP/X11 tunnels. | A permitted command, direct application vulnerability or host root access. |
| Package signatures/provenance | Supply chain | Links artifact to signer/build/materials under the system's trust policy. | Correctness, absence of vulnerabilities, runtime behaviour or compromised signer. |
| Immutable rebuild | Host recovery | Removes unknown local modifications and provides a repeatable baseline. | Stolen external credentials, poisoned source/image, incomplete data/secret rotation. |
| Independent logging/monitoring | Detection/forensics | Preserves evidence and alerts on suspicious access. | Prevention; gaps/delay or root-level tampering before export. |

## Coverage matrix

| Required coverage | Status | Evidence/decision |
| --- | --- | --- |
| Definitions | Covered | Bastion, host key, user key, certificate, forwarding, provenance, root compromise and break-glass are separated. |
| Invariants | Covered | Accountability, least privilege, revocation, independent evidence and recoverability above. |
| Workload | Covered | Human/automation/break-glass access, network paths and package/deployment flows. |
| Failure/crash windows | Covered | Lockout, stolen key, bastion compromise, forwarding, package tamper, root compromise and update failures. |
| Retries/timeouts | Partial | SSH connection retry/reconnect policy is deployment-specific; repeated retries can amplify lockout/noise. Add explicit CI/operator limits. |
| Operations/recovery | Covered | Canary config, independent logs, rotation, rebuild, evidence preservation and RTO/RPO. |
| Security/privacy | Covered | Authentication, authorization, key lifecycle, forwarding, supply chain, logs and secret rotation. |
| Testing | Covered | Config syntax, second-session test, firewall matrix, canary, restore/rebuild, artifact verification and incident exercise. |
| Domain trade-offs | Covered | Interactive admin, CI/CD, database tunnel, emergency access, public service and regulated workloads differ. |

## Contradictions and limits

| Apparent conflict | Resolution/scope |
| --- | --- |
| “Key-only SSH is secure” vs stolen keys remain valid. | Key-only removes password guessing but requires key protection, inventory, revocation and authorization review. |
| “Bastion improves security” vs bastion is a high-value target. | It can reduce exposure and centralize controls; it must not be the only trust anchor or evidence source. |
| “Disable all forwarding” vs real deployment needs tunnels/agent access. | Default deny and grant narrowly scoped, monitored exceptions; a broken deployment is not a safe deployment. |
| “Package signature verified” vs malicious signed artifact. | Signature verifies the signer/build claim under the trust policy. Review source, build isolation, provenance, vulnerability and runtime controls separately. |
| “Long uptime is evidence of safety” vs no evidence of compromise. | It is weak negative evidence at most. Detection coverage and retention determine what can be inferred. |
| “Latest OpenSSH setting” vs target distribution package. | OpenBSD manual, Ubuntu packaging, PAM and compile-time/default differences must be checked on the actual host. |
| “Rebuild is always enough” vs forensic/legal requirements. | Rebuild is a containment/recovery choice; preserve evidence first where required and rotate all external credentials. |

## Negative evidence and anti-patterns

- Do not advertise a port change as a security fix or use it to justify leaving authentication weak.
- Do not copy a hardening snippet without testing the target OpenSSH version, PAM, `Match` precedence, IPv6, automation and break-glass path.
- Do not leave a shared private key in CI, an engineer laptop or a bastion and call the system attributable.
- Do not forward an SSH agent to a host that is not trusted to request signatures.
- Do not allow unrestricted TCP forwarding when the bastion is supposed to be a network policy boundary.
- Do not rely on host-local logs after root compromise; they are evidence candidates, not automatically trustworthy records.
- Do not treat an artifact hash, package signature or SBOM as proof of runtime safety.
- Do not rotate only the SSH key after compromise; inspect/revoke cloud, database, CI, deployment and application secrets reachable from the host.
- Do not equate a CIS benchmark pass with incident-free operation or a complete threat model; benchmarks are baselines, not risk acceptance.

## Duplicate and canonical ownership

| Topic | Canonical role | Boundary |
| --- | --- | --- |
| Case 17 | Canonical applied case for SSH host hardening, bastion limits, package provenance and unknown-root response. | Keep host/access/supply-chain controls and their operational caveats here. |
| Case 10 | Canonical identity/authentication/authorization in microservices. | Owns OAuth/OIDC/JWT/opaque-token and service authorization; link rather than repeat SSH account details. |
| Case 13 | Storage scale/operations case. | Owns large-scale storage migration and operations, not host-hardening baselines. |
| Case 14 | Cloud cost/architecture fitness. | Owns cost governance; security controls should not be removed merely for savings. |
| Repository security guidance | Shared implementation policy if one exists. | This dossier proposes changes only; it does not replace deployment-specific runbooks or incident response plans. |

## EN/VI parity review

The EN and VI files cover the same four incidents, SSH baseline, bastion boundary, malicious-package threat model, unknown-root response and operating questions. Batch F adds a paired evidence-boundary qualifier; both versions retain the uncertainty that local evidence does not identify a forensic root cause and avoid promising that the baseline prevents compromise.

## Proposed changes (not applied)

### English

1. Label every incident as an observation/lesson unless logs or forensic evidence support a causal claim.
2. Put the “what it does not do” column next to each hardening control, especially port changes, key-only login and bastions.
3. Add target-version validation for `sshd_config`, PAM, IPv6, `Match` blocks and CI/break-glass access.
4. Split supply-chain verification into source/build provenance, artifact signature, deployment authorization and runtime monitoring.
5. Add a concrete suspected-root-compromise runbook: contain, preserve, revoke, scope, rebuild, restore, validate and document.
6. Define metrics for failed auth by identity/source, key age, unused keys, forwarding channels, package provenance failures, log-export health and rebuild time.

### Vietnamese

1. Gắn nhãn từng incident là observation/lesson nếu chưa có log hoặc forensic evidence chứng minh nguyên nhân.
2. Đặt phần “control này không làm được gì” cạnh từng hardening control, nhất là đổi port, key-only và bastion.
3. Bổ sung kiểm tra version của `sshd_config`, PAM, IPv6, `Match` và đường truy cập CI/break-glass.
4. Tách source/build provenance, chữ ký artifact, quyền deploy và runtime monitoring thành các lớp riêng.
5. Bổ sung runbook khi nghi root compromise: cô lập, giữ bằng chứng, revoke, scope, rebuild, restore, validate và ghi nhận.
6. Bổ sung metric cho auth fail, tuổi key, key không dùng, forwarding, provenance fail, log-export và thời gian rebuild.

## Integration record (Batch F scope)

- Added paired EN/VI evidence-boundary qualifiers before the four-incident section.
- The qualifier preserves the source-scoped nature of the story, separates control effectiveness from forensic proof, and requires evidence preservation, credential rotation, and independently tested recovery during a real incident.
- OS/OpenSSH/PAM/firewall selection and actual host evidence remain open; this integration does not convert the article into a forensic report.

## Open questions and falsifiers

1. Which exact OS image, OpenSSH version, PAM modules and cloud firewall rules are in scope?
2. Are operator keys individual, shared, hardware-backed, short-lived certificates or long-lived files?
3. Does the deployment require agent/TCP forwarding, and can each use be replaced by a scoped service or session gateway?
4. What independent log sink, retention period and clock synchronization exist?
5. Which package repositories, CI runners, image registries and deployment principals are trusted, and how is provenance verified?
6. Is there an immutable rebuild path with tested restoration of data and secrets?
7. What evidence exists for the four incidents: auth logs, process history, package manifests, cloud audit logs, disk/image snapshots and key usage?

The recommendation to treat an unknown root compromise as an incident would be weakened only if trustworthy independent evidence proves the event was limited to a non-privileged, fully contained account and no credentials/artifacts were exposed. The recommendation to rebuild and rotate would be strengthened by any evidence that local logs/binaries/authorized keys were modified, a root-capable process executed, a package provenance check failed, or a credential was used from an unexpected source. The SSH baseline would need revision if it causes unacceptable lockout, breaks required automation, or conflicts with a stronger managed identity/session service.

## Source ledger

All sources were reviewed on `2026-08-23`. Tier `S1` means official first-party documentation/standard; `S2` means official baseline or primary implementation guidance; `S3` means local repository content.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | Local EN/VI case files listed above — repository case study | S3; reviewed 2026-08-23 | Four local incidents/lessons, SSH baseline, bastion framing, malicious-package scenario and unknown-root response. |
| S02 | [sshd_config](https://man.openbsd.org/sshd_config) — OpenBSD/OpenSSH | S1; OpenBSD manual for OpenSSH 10.0, reviewed 2026-08-23 | Directive meanings and scope for root login, password auth, forwarding, users, attempts, keepalives and `Match` configuration. |
| S03 | [ssh-keygen](https://man.openbsd.org/ssh-keygen) — OpenBSD/OpenSSH | S1; OpenBSD manual/OpenSSH 10.0 | Key generation, fingerprints, certificates and key-management concepts; key possession remains an authentication factor, not authorization proof. |
| S04 | [OpenSSH release notes](https://www.openssh.com/releasenotes.html) — OpenSSH project | S1; current releases page reviewed 2026-08-23 | Version drift and security/behaviour changes require checking the deployed package rather than assuming one manual applies everywhere. |
| S05 | [OpenSSH server](https://ubuntu.com/server/docs/how-to/security/openssh-server/) — Ubuntu | S1; current Ubuntu Server documentation | Ubuntu package/configuration workflow, service reload/testing, key/password and access-hardening considerations. |
| S06 | [Automatic updates](https://ubuntu.com/server/docs/how-to/software/automatic-updates/) — Ubuntu | S1; current docs | Update automation, unattended-update trade-offs and need for staged/operational validation. |
| S07 | [AppArmor](https://ubuntu.com/server/docs/security/apparmor) — Ubuntu | S1; current docs | Mandatory access-control profile concept and confinement limits; a host with SSH hardening still needs service/runtime controls. |
| S08 | [CIS Benchmarks — Ubuntu Linux](https://www.cisecurity.org/benchmark/ubuntu_linux) — CIS | S2; current benchmark catalogue reviewed 2026-08-23 | Benchmark baseline as a configuration reference; benchmark compliance is not proof of absence of compromise. |
| S09 | [Incident Response Recommendations and Considerations](https://csrc.nist.gov/pubs/sp/800/61/r3/final) — NIST | S1; SP 800-61 Rev. 3, 2025-04 | Preparation, detection, response, recovery, evidence, roles and continuous improvement for suspected compromise. |
| S10 | [Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) — NIST | S1; SP 800-207, 2020-08 | Network location/bastion is not implicit trust; access should be policy- and resource-centric. |
| S11 | [Security and Privacy Controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) — NIST | S1; SP 800-53 Rev. 5 Update 1, 2021-12 | Least privilege, audit, configuration, incident response, authentication and system integrity control families. |
| S12 | [Cybersecurity Supply Chain Risk Management Practices](https://csrc.nist.gov/pubs/sp/800/161/r1/final) — NIST | S1; SP 800-161 Rev. 1, 2022-05 | Supplier/software provenance, acquisition risk, integrity and supply-chain control planning. |
| S13 | [Guide to Computer Security Log Management](https://csrc.nist.gov/pubs/sp/800/92/final) — NIST | S1; SP 800-92, 2006-09 | Log generation, transport, storage, review and independent retention; old guidance remains scoped to log management concepts. |
| S14 | [Secure by Design](https://www.cisa.gov/securebydesign) — CISA | S1; current guidance hub | Security ownership, default-safe design and reducing burden on operators; not an SSH-specific config checklist. |
| S15 | [Joint advisory on cyber-hygiene improvement after proactive threat hunt](https://www.cisa.gov/sites/default/files/2025-08/joint-advisory-cisa-identifies-areas-for-cyber-hygiene-improvement-after-conducting-proactive-threat-hunt-508c.pdf) — CISA and partners | S1; 2025-08 PDF | Real-world hygiene gaps, identity/access, exposure and logging lessons; does not prove the local case's cause. |
| S16 | [Cosign overview](https://docs.sigstore.dev/cosign/overview/) — Sigstore | S1; current Cosign docs | Artifact signing/verification model and trust workflow; signatures are scoped to the signing policy. |
| S17 | [Verify signatures](https://docs.sigstore.dev/cosign/verifying/verify/) — Sigstore | S1; current Cosign docs | Verification commands/identity and issuer constraints; verification must be bound to an expected signer policy. |
| S18 | [Keyless signing](https://docs.sigstore.dev/cosign/signing/signing_with_keyless/) — Sigstore | S1; current Cosign docs | Keyless identity and transparency-log workflow; it does not make a malicious authorized build harmless. |
| S19 | [SLSA Provenance v1](https://slsa.dev/provenance/v1) — SLSA | S1; v1 specification | Provenance predicate/materials/build claims and their limits; provenance is not a vulnerability-free guarantee. |
| S20 | [in-toto](https://in-toto.io/) — in-toto project | S1; current specification/project docs | Supply-chain layout/step attestations and verification intent. |
| S21 | [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html) — systemd | S1; current systemd manual | Service sandboxing, capability/filesystem/network restrictions and version/unit compatibility caveats. |
| S22 | [SSH transport protocol](https://www.rfc-editor.org/rfc/rfc4253) — IETF RFC 4253 | S1; 2006 standard | SSH transport/security-layer concepts and protocol scope; it does not prescribe a host hardening baseline. |
| S23 | [SSH authentication protocol](https://www.rfc-editor.org/rfc/rfc4252) — IETF RFC 4252 | S1; 2006 standard | Authentication protocol mechanisms and separation from later authorization policy. |
| S24 | [GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations) — GitHub | S1; current Actions docs | Example of build provenance/attestation verification in CI/CD; provider-specific trust roots and workflow. |
| S25 | [OpenTelemetry trace semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/trace/) — OpenTelemetry | S1; semantic conventions current | Correlation/trace context for access and deployment operations; do not put secrets or private keys in attributes. |
| S26 | [CISA Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) — CISA | S1; continuously updated catalogue reviewed 2026-08-23 | Prioritization evidence for exploited software vulnerabilities; absence from the catalogue is not safety proof. |
| S27 | [OpenSCAP Security Guide](https://www.open-scap.org/security-policies/scap-security-guide/) — OpenSCAP project | S2; current project/docs | Machine-readable baseline/checking approach and the need to map checks to the actual OS/profile. |
| S28 | [Ubuntu security notices](https://ubuntu.com/security/notices) — Ubuntu | S1; continuously updated notices reviewed 2026-08-23 | Package vulnerability/update evidence for Ubuntu; version/repository scope must match the deployed host. |

## Gate status

- [x] Complete EN/VI sections and metadata read.
- [x] Local incident narrative separated from forensic fact.
- [x] Discovery pool broadened; selected ledger has 28 distinct sources.
- [x] Workload/trust invariants, incident windows, comparison, coverage, limits, anti-patterns and falsifiers recorded.
- [x] Duplicate/canonical ownership and EN/VI parity recorded.
- [ ] Target OS/OpenSSH/PAM/firewall and actual evidence verified.
- [x] EN/VI content integration applied for the Batch F qualifier.
- [x] Validation passed after integration.
