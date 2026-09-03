# Research — Some Simple Economics of AGI: verification as a system constraint

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `18-some-simple-economics-of-agi`

EN file: `public/data/case-studies/articles/18-some-simple-economics-of-agi.html`

VI file: `public/data/case-studies/articles/18-some-simple-economics-of-agi.vi.html`

Metadata: the paired case-study metadata JSON and article files were read in full.

## Scope and evidence posture

This case is an engineering synthesis of Christian Catalini, Xiang Hui and Jane Wu's *Some Simple Economics of AGI* (arXiv:2602.20946, version 2, 2026-02-24). The paper proposes an economic lens: the cost to automate an action (`cA`) may fall faster than the cost to verify it (`cH`), creating a measurability/verification gap. The local article translates that lens into agent architecture, provenance, blast-radius controls, independent checking, apprenticeship and a “sandwich topology.”

The paper is a current arXiv preprint, not a standard, regulation, production postmortem or established forecast. “Missing Junior Loop,” “Codifier's Curse,” “Trojan Horse externality,” “verification debt” and “sandwich topology” are useful conceptual terms in the paper/local synthesis, but they should not be presented as empirically settled laws. The research below triangulates them with scalable-oversight papers, reward/specification failure research, AI risk-management frameworks, evaluation methodology and operational observability. It does not prove an AGI timeline or that a specific oversight topology is universally safe.

The strongest portable conclusion is narrower: when an agent can create external effects faster or more cheaply than the organization can establish correctness, the organization must make the verification boundary explicit, preserve enough evidence to audit it, bound the blast radius and measure the feedback/recovery loop before increasing autonomy. The exact checker, human role, legal control and acceptance threshold depend on domain, harm, reversibility and available ground truth.

## Local content map

| Section ID | Current teaching job |
| --- | --- |
| `1-the-bottleneck-moves-from-making-to-checking` | Introduces `cA`/`cH`, verification bandwidth and the measurability gap. |
| `2-four-zones-of-agentic-work` | Classifies work by automation cost and verification cost. |
| `3-the-three-leaks-that-erode-human-verification` | Describes Missing Junior Loop, Codifier's Curse and alignment drift/Trojan Horse. |
| `3-1-the-missing-junior-loop` | Explains loss of supervised practice and future verification capacity. |
| `3-2-the-codifiers-curse` | Explains how expert codification can improve agents while reducing challenge capacity. |
| `3-3-alignment-drift-and-the-trojan-horse` | Connects proxy optimization to delayed, unverified external cost. |
| `4-why-ai-verifying-ai-is-not-independence` | Separates agreement from independent evidence. |
| `5-from-human-in-the-loop-to-a-sandwich-topology` | Proposes human intent, bounded agent execution and independent verification. |
| `6-what-this-means-for-an-engineering-team` | Translates the lens into intent, trace, separation, blast-radius and learning controls. |
| `7-a-small-scorecard-for-verification-debt` | Measures verified share, feedback latency, unknown outcomes, failure correlation and experience stock. |
| `8-what-to-keep-from-the-paper` | Keeps the verification constraint while rejecting date/model forecasts as the lesson. |
| `9-primary-reference` | Identifies the paper and its preprint status. |

## Claim classification

| Local proposition | Classification | Scope/qualification |
| --- | --- | --- |
| The paper models a falling cost to automate (`cA`) and a slower/biologically or institutionally bounded cost to verify (`cH`). | Verified description of S02. | This is a model/lens, not a measured universal law. The meaning of “cost” and the curves depends on task, evaluator, evidence and liability. |
| Agent output can grow faster than trustworthy verification. | Inference supported by S02, S12, S16 and S17, not a universal empirical estimate. | More output is harmful only when verification, recovery or accountability cannot keep pace; some domains have cheap formal checks. |
| “Verifiable share” is a useful capacity metric. | Recommendation/inference from S02 and this dossier. | It needs a defined denominator, confidence threshold, evidence type and sampling policy; a high score can still miss rare catastrophic failures. |
| Missing junior practice can reduce future expert verification capacity. | Paper hypothesis/conceptual argument in S02. | Plausible organizational risk; local team should measure skill progression, incident practice and reviewer diversity rather than assert it as fact. |
| Expert codification can strengthen automation while weakening challenge capacity. | Paper concept/inference. | It is not an argument to preserve inefficient work; practice and independent challenge can be deliberately designed. |
| Proxy optimization can improve a dashboard while violating the real outcome. | Well-supported failure pattern across specification-gaming/reward-hacking literature (S19–S22). | The exact proxy, evaluator and failure mode must be documented; no single paper proves all production cases. |
| A second AI's agreement is not independent verification. | Inference supported by shared-data/correlated-error concerns and S16; recursive-critique research explores a possible countermeasure in S14. | AI checking may add useful evidence, but independence is a property of data, model, execution path, incentives and ground truth—not a label. |
| Sandwich topology can scale safe leverage. | Recommendation/design metaphor from S02. | It fails if the bottom verifier is ceremonial, overloaded, correlated with the generator or unable to stop/recover the action. |
| Trace/provenance, canaries, scoped credentials and reversible writes improve governability. | Engineering recommendation supported by S03–S08, S23–S29. | They make evidence and containment better; they do not establish semantic correctness by themselves. |
| Human oversight is required/structured in every domain. | False as a universal claim. | Legal requirements vary by jurisdiction/use case; EU AI Act and NIST/ISO guidance have scopes and do not define one universal workflow. |

## Workload and invariant model

The local article needs a task-level model before a team can score “verification debt.” For each agent action define:

| Dimension | Required model | Example measurement |
| --- | --- | --- |
| Intent | What outcome, forbidden action and authority boundary did the owner approve? | Versioned task spec, policy ID, input provenance and owner. |
| External effect | What state, money, code, access, communication or safety outcome can change? | Effect class, reversibility, affected tenants/records and maximum blast radius. |
| Ground truth | What evidence can establish success/failure, and how soon? | Formal invariant, test, simulator, independent data, human review or post-hoc reconciliation. |
| Verification share | Which actions receive meaningful evidence before release? | `verified actions / externally effective actions`, with sampling and risk-weighted denominator. |
| Confidence | What error rate/coverage is acceptable for this risk tier? | False-accept/false-reject, calibration, confidence intervals and rare-event sampling. |
| Feedback latency | Time from wrong action to detection and containment. | p50/p95 detection, rollback/reconciliation time and customer exposure window. |
| Unknown outcome | Can a timeout/partial tool failure leave an external effect uncertain? | Durable intent, operation ID, idempotency and reconciliation status. |
| Failure correlation | Do generator/checker share model, data, prompt, tools, evaluator or incentives? | Disagreement under adversarial and out-of-distribution cases; diversity matrix. |
| Experience stock | How do operators/reviewers practice rare and novel cases? | Supervised simulations, shadow rotations, incident reviews and skill progression. |
| Drift | What changes model, tools, data, policies, users or environment? | Versioned release, distribution shift, eval decay and rollback trigger. |
| Accountability | Who can approve, stop, reverse and bear the consequence? | Named owner, escalation SLA, audit record and liability/regulated role. |

Suggested invariants for a production agent:

1. No externally effective action exceeds the declared permission, budget, batch size, data scope or time window.
2. Every action has a durable intent, actor/model/tool version, input provenance, decision and effect record sufficient for audit without storing unnecessary sensitive data.
3. A checker must introduce defined new evidence or a defined independent authority; agreement alone is not acceptance.
4. A timeout or partial failure is an unknown state until queried/reconciled; it is not silently treated as success or rollback.
5. High-impact or irreversible actions require an acceptance mechanism whose error and coverage are measured against an appropriate ground truth.
6. The system can stop new work, contain active work and recover/reconcile already applied effects within the declared risk budget.
7. Evaluation and training feedback preserve disagreement, near misses and novel cases instead of optimizing only the visible benchmark.
8. Human oversight has enough time, information and authority to intervene; “human in the loop” is not satisfied by an automatic click-through.

## Failure and crash windows

| Window | Failure mode | Control/recovery question |
| --- | --- | --- |
| Intent is underspecified | Agent satisfies literal/prompt proxy but violates business/safety intent. | What invariant, forbidden action and escalation boundary were versioned before execution? |
| Generation succeeds, tool call times out | External effect may have happened; retry can duplicate it. | Is there an operation ID, idempotency contract, effect query and reconciliation path? |
| Checker sees same context/model blind spot | Generator and checker agree on the same wrong answer. | What independent data, model family, execution test, adversarial case or human evidence is added? |
| Human reviewer is overloaded | Review becomes rubber-stamping, sampling shrinks or high-risk items wait too long. | What queue/budget/SLO caps autonomy and routes high-risk items? |
| Output is plausible but not executable/safe | Demo quality masks integration, security or operational failure. | Canaries, sandbox, dry-run, property tests, policy gates and bounded rollout. |
| Proxy improves while real outcome degrades | Reward/specification gaming; dashboard looks healthy. | Which delayed outcome, user harm, invariant or independent audit can falsify the proxy? |
| Training/eval data is contaminated or narrow | The agent/checker overfits known benchmark cases. | Holdout, adversarial, distribution-shift and provenance tests; preserve unseen scenarios. |
| Model/tool/policy update drifts | Previously valid checker/calibration no longer applies. | Version all components, shadow/replay evaluation, change approval and rollback. |
| Agent gains excessive permission | One prompt/tool error causes large blast radius. | Read-only first, scoped credentials, budgets, rate/time limits, leases and kill switch. |
| Audit trace is incomplete/tampered | Team cannot establish what happened or who approved it. | Append-only/independent storage, access controls, clock/correlation checks and retention. |
| Junior work is fully automated | Short-term throughput rises; future operators lose practice. | Protected supervised practice, simulations, rotations and incident-based learning. |
| Downstream state is eventually reconciled | Exposure grows before a wrong action is found. | Define maximum exposure window, compensation/rollback and customer/partner communication. |

## Comparison table

| Oversight design | New evidence | Strength | Main limit/failure | Appropriate use |
| --- | --- | --- | --- | --- |
| End-outcome test only | Result/property after execution | Cheap and objective when a strong oracle exists. | Can miss process violations, unsafe intermediate effects or rare cases. | Formal builds, narrow data transforms, isolated simulations. |
| Process supervision | Intermediate steps/critique/trace | Finds errors earlier and can train better behavior. | More expensive; a plausible trace can be fabricated or share the same blind spot. | Long-horizon work with meaningful intermediate invariants. |
| Same-model self-critique | Additional model pass | Low latency/cost; can catch shallow errors. | Correlated errors, sycophancy and shared context. | Low-risk prefilter, never the sole high-impact authority without validation. |
| Diverse AI checker | Different model/data/prompt/evaluator | Can reduce some correlated failures. | “Different” may still share training data/objective; requires disagreement calibration. | Medium-risk triage with independent holdouts and human escalation. |
| Human review | Accountable judgment/ground truth | Handles novelty, context and responsibility when trained and resourced. | Capacity bottleneck, automation bias, fatigue and loss of expertise. | High-impact/ambiguous actions with a real stop authority. |
| Debate/adversarial review | Competing arguments or attacks | Surfaces weaknesses and may make evidence easier to judge. | Debate can optimize persuasion; theoretical/empirical results are task-scoped. | Adversarial testing and research, with independent adjudication. |
| Sandbox/canary/shadow | Observed effect without full blast radius | Measures integration and real workload before commitment. | Shadow may not reproduce side effects; canary still exposes a subset. | Deployment, infrastructure, tool-use and policy changes. |
| Human intent → agent execution → independent verification | Layered control | Aligns authority, scalable work and release evidence. | Bottom layer can become a queue or ceremony; requires capacity and explicit stop/recovery. | Architecture pattern, not an automatic safety guarantee. |

## Coverage matrix

| Required coverage | Status | Evidence/decision |
| --- | --- | --- |
| Definitions | Covered | `cA`, `cH`, verification bandwidth/share/debt, ground truth, independence, proxy, blast radius and sandwich topology. |
| Invariants | Covered | Permission, trace, independent evidence, unknown-outcome, high-impact acceptance, recovery and learning invariants. |
| Workload | Covered | Action effect, risk tier, verification cost, reviewer queue, task horizon, drift and experience stock. |
| Failure/crash windows | Covered | Timeout/duplicate, correlated checker, proxy gaming, overload, drift, permission and audit failures. |
| Retries/timeouts | Covered | Durable intent, idempotency, effect query and explicit unknown state. |
| Operations/recovery | Covered | Kill switch, canary/shadow, rollback/reconcile, incident loop, audit retention and SLOs. |
| Security/privacy | Covered | Scoped credentials, data provenance/minimization, prompt/tool abuse, adversarial ML, audit access and policy scope. |
| Testing | Covered | Holdout/adversarial/shift tests, process/outcome eval, calibration, disagreement, replay, red team and chaos/failpoint tests. |
| Domain trade-offs | Covered | Formal software checks, finance/medical/security, long-horizon agent operations, creative/tacit work and regulated high-risk use. |

## Contradictions, limits and scope table

| Claim/approach | Competing evidence or limit | Decision for this dossier |
| --- | --- | --- |
| `cA` falls while `cH` remains bounded. | S02 is a conceptual economic model; METR S10/S11 measure particular task/time-horizon capabilities, not all verification cost. | Use the curves as a question about local capacity, not as a forecast or law. Measure per task/risk tier. |
| Verification is easier than generation. | S12 finds useful human+model assistance on selected tasks; S14 studies recursive critique; neither establishes reliability for all domains or superhuman outputs. | Require task-specific oracle/ground truth and failure analysis before relying on cheaper checks. |
| AI can verify AI at scale. | S16 reports confirmation-bias concerns in simple protocols; shared model/data/objective creates correlated errors. | AI checking is a candidate layer; independence and acceptance thresholds must be demonstrated. |
| Process supervision is better than final-answer supervision. | S17 is a math/reasoning study with a particular training setup; process traces can be incomplete or gamed. | Use process evidence when it has validated correlation with the true outcome; keep outcome checks. |
| Debate creates scalable oversight. | S13 proposes/illustrates a protocol and states empirical/theoretical open questions; persuasion is not truth. | Use debate as adversarial evidence, not sole adjudication. |
| Recursive self-critique scales. | S14 is a preprint (v4) with experiments under its task/model conditions. | Track as promising research, not a production guarantee; test correlated and adversarial failures. |
| Human-in-the-loop protects users. | Human overload, automation bias and lack of stop authority can make review ceremonial; S16 is a direct warning. | Specify reviewer capacity, time, information, authority and measured miss rate. |
| Trace/provenance solves accountability. | S03–S08/S27–S28 support governance/evidence, but logs can be incomplete, tampered or semantically ambiguous. | Treat provenance as evidence input and control, not truth or safety proof. |
| Industry safety frameworks are universal. | NIST/ISO are frameworks; EU AI Act is jurisdiction/use-case law; provider policies are self-governance. | Record version, jurisdiction, product and risk scope in every implementation decision. |

## Negative evidence and anti-patterns

- Do not use “AGI is coming” or a model benchmark as evidence that a particular agent is safe, autonomous or economically viable.
- Do not calculate verification debt from output count alone; include effect severity, evidence quality, sampling, false accepts and exposure time.
- Do not let a second model approve the first solely because it has a different prompt or a higher confidence score.
- Do not store a verbose chain-of-thought transcript as a substitute for a compact, auditable execution trace and independent tests; privacy, security and reliability needs differ by system.
- Do not accept an agent's self-reported tool result when an external system can query the effect.
- Do not treat a human approval click, “human in the loop” label or policy checkbox as oversight without time, information and stop authority.
- Do not scale agent concurrency before measuring reviewer queue, rollback/reconciliation time and worst-case blast radius.
- Do not train only on resolved/common cases; that erases disagreement, novelty and the practice needed for future reviewers.
- Do not optimize proxy metrics (tickets closed, tests passed, latency, engagement, cost) without a delayed outcome/invariant that can falsify them.
- Do not infer independence from model-family diversity alone; shared data, tools, prompts, reward and evaluator can preserve correlated failure.
- Do not apply high-risk legal requirements from one jurisdiction to every product, or claim framework alignment without a documented mapping.

## Duplicate and canonical ownership

| Topic | Canonical role | Boundary |
| --- | --- | --- |
| Case 18 | Canonical case for verification economics, agent oversight capacity, correlated checking, experience stock and verification debt. | Keep the economic lens and organizational/agent governance synthesis here. |
| Case 10 | Canonical identity and authorization design. | Owns service authentication/authorization; this case only references scoped credentials and approvals. |
| Topic 08 | Canonical message delivery/backpressure mechanics. | Owns broker semantics; this case references queues/timeouts only as agent-operation infrastructure. |
| Topic 09 | Canonical distributed money/workflow correctness. | Owns financial invariants/ledger/saga; this case uses the generic unknown-outcome and verification framing. |
| Case 12 | Canonical duplicate/race/idempotency failure. | Owns request-level race; this case applies the lesson to agent tool effects. |
| Case 17 | Canonical host/supply-chain hardening. | Owns SSH, package provenance and root compromise; this case only maps agent permission/provenance to the need for that dossier. |
| Case 13 | Canonical large-scale storage operations. | Owns storage scale/migration; this case does not repeat its platform lessons. |

## EN/VI parity review

The EN and VI files preserve the same paper lens, four agentic-work zones, three “leaks,” AI-checker independence argument, sandwich topology, engineering controls, scorecard and primary reference. No content integration was applied. Both versions should preserve these caveats: arXiv preprint status, conceptual terminology, no AGI timeline claim, and no universal guarantee from human/AI oversight.

## Proposed changes (not applied)

### English

1. Label the paper's terms as conceptual framework/hypotheses and keep production recommendations in a separate “engineering interpretation” block.
2. Define the denominator and evidence threshold for “verified share”; add risk-weighted and rare-event caveats.
3. Add a concrete action envelope: intent ID, model/tool versions, scoped credential, budget, timeout, idempotency key, dry-run/canary, approval and reconciliation.
4. Replace “AI verifying AI is not independence” with a more precise statement: agreement is not independent evidence unless the checker adds demonstrably different information and its miss rate is measured.
5. Add a high-impact release gate with owner, stop authority, evidence, maximum exposure and rollback/recovery SLO.
6. Make “Missing Junior Loop” an organizational measurement question and propose supervised practice/rotations rather than a blanket anti-automation conclusion.
7. Add jurisdiction/provider/version scope for NIST, ISO, EU AI Act and provider safety frameworks.

### Vietnamese

1. Gắn nhãn các thuật ngữ của paper là conceptual framework/hypothesis; tách phần engineering interpretation khỏi kết luận đã được chứng minh.
2. Định nghĩa mẫu số và ngưỡng evidence của “verified share”, gồm risk-weighting và rare-event caveat.
3. Bổ sung action envelope: intent ID, version model/tool, credential giới hạn, budget, timeout, idempotency, dry-run/canary, approval và reconciliation.
4. Viết chính xác hơn rằng model thứ hai chỉ tạo independent evidence khi đưa vào thông tin/đường kiểm tra khác biệt và đã đo miss rate.
5. Bổ sung release gate cho tác vụ high-impact: owner, quyền stop, evidence, exposure tối đa và SLO rollback/recovery.
6. Biến “Missing Junior Loop” thành câu hỏi đo lường về năng lực tổ chức, kèm supervised practice/rotation thay vì phản đối tự động hóa chung chung.
7. Ghi rõ phạm vi jurisdiction/provider/version của NIST, ISO, EU AI Act và các safety framework của nhà cung cấp.

## Open questions and falsifiers

1. For each planned agent, what is the unit of action, external effect, risk tier and true denominator for verified share?
2. What independent ground truth exists before release, and what is the measured false-accept rate on holdout/adversarial/shifted cases?
3. Which effects are reversible, how long is the maximum exposure window, and what is the tested rollback/reconciliation time?
4. Can the system query whether a timed-out tool action happened, or does it need a durable idempotency/reconciliation protocol?
5. Which model, data, tool, prompt, evaluator and reward components are shared between generator and checker?
6. What reviewer capacity, queue SLO and escalation path exist at peak agent throughput?
7. How are junior operators trained on rare failures, and how is their judgment evaluated without exposing customers to unsafe practice?
8. Which jurisdiction, product risk category, privacy obligations and provider/model version apply?
9. Which audit/provenance records are independent of the agent host and protected from tampering?

The recommendation to cap autonomy until verification capacity is demonstrated would be falsified or weakened if a defined task family has a validated, independent, low-false-accept oracle, bounded reversible effects and recovery faster than the risk budget across distribution shifts. It would be strengthened by rising output with falling verified share, reviewer queue saturation, delayed discovery of wrong effects, repeated agreement failures under adversarial tests, or unqueryable timeout outcomes. The recommendation to use AI-assisted checking would be falsified for a task if it does not outperform a simple baseline/human process on held-out cases, increases automation bias, or adds no independent evidence. The recommendation to preserve supervised practice would need revision if a measured training simulator/rotation produces equal or better judgment transfer without real-user exposure.

## Source ledger

All sources were reviewed on `2026-08-23`. Tier `S1` means an official framework, standard, first-party engineering/safety report or original research paper; `S2` means a primary preprint or implementation specification with narrower evidence; `S3` means local repository content. Preprints and provider frameworks are explicitly not treated as universal guarantees.

| ID | URL — title / organization | Tier; version/revision | Exact claims supported |
| --- | --- | --- | --- |
| S01 | Local EN/VI case files listed above — repository case study | S3; reviewed 2026-08-23 | Local synthesis, section map, `cA`/`cH`, four zones, three leaks, sandwich topology, scorecard and engineering proposals. |
| S02 | [Some Simple Economics of AGI](https://arxiv.org/abs/2602.20946) — Christian Catalini, Xiang Hui, Jane Wu | S2; arXiv v2, 2026-02-24 | Original paper's automation/verification cost curves, measurability gap, verification bandwidth, rents/ground truth/provenance and conceptual organizational risks. |
| S03 | [AI Risk Management Framework 1.0](https://www.nist.gov/itl/ai-risk-management-framework) — NIST | S1; AI 100-1, 2023-01 | Govern/map/measure/manage lifecycle, trustworthy characteristics and risk-management framing; not a model-safety certificate. |
| S04 | [AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) — NIST | S1; AI 600-1, 2024-07 | GenAI-specific risks including confabulation, data/privacy, information integrity, configuration and evaluation considerations. |
| S05 | [AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/) — NIST AIRC | S1; current resource reviewed 2026-08-23 | Practical suggested actions for Govern/Map/Measure/Manage; suggestions require local tailoring. |
| S06 | [AI RMF measure function resources](https://airc.nist.gov/airmf-resources/measure/) — NIST AIRC | S1; current resource | Measurement, testing, evaluation, monitoring, uncertainty and documentation considerations. |
| S07 | [ISO/IEC 42001](https://www.iso.org/standard/42001) — ISO | S1; 2023 standard page reviewed 2026-08-23 | AI management-system scope, continual improvement and organizational governance; certification/implementation details are not a technical safety proof. |
| S08 | [Regulation (EU) 2024/1689 — AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) — European Union | S1; consolidated text 2026-07-27 | Risk categories, provider/deployer obligations, human oversight, transparency and high-risk scope for the EU legal context. |
| S09 | [OECD AI Principles](https://oecd.ai/en/ai-principles) — OECD | S1; OECD principles/current site | Human-centred values, robustness/security/safety, transparency, accountability and risk-management principles; non-binding policy guidance. |
| S10 | [Time Horizons](https://metr.org/time-horizons/) — METR | S1; current methodology/site reviewed 2026-08-23 | Task-horizon measurement concept and limits: benchmark/task definitions do not equal general autonomy or verification capacity. |
| S11 | [RE-Bench: Evaluating Frontier AI R&D Capabilities](https://metr.org/AI_R_D_Evaluation_Report.pdf) — METR | S1; report version reviewed 2026-08-23 | Agent evaluation on selected research/engineering tasks, horizon and benchmark limitations, and why results should be scoped to the task suite. |
| S12 | [Measuring Progress on Scalable Oversight for Large Language Models](https://arxiv.org/abs/2211.03540) — Bowman et al. | S2; arXiv v2, 2022-11-11 | Experimental framing for supervising systems that may exceed unaided human ability and results for human+model assistance on selected QA tasks. |
| S13 | [AI Safety via Debate](https://arxiv.org/abs/1805.00899) — Irving, Christiano, Amodei | S2; arXiv 2018-05-02 | Debate proposal, limited MNIST demonstration and explicit theoretical/empirical limitations; supports adversarial-review research, not a production guarantee. |
| S14 | [Scalable Oversight for Superhuman AI via Recursive Self-Critiquing](https://arxiv.org/abs/2502.04675) — Wen et al. | S2; arXiv v4, 2026-01-15 | Recursive critique hypothesis and Human/Human-AI/AI-AI experiments; preprint/task-scoped evidence, not proof of independent correctness. |
| S15 | [Steering LLMs via Scalable Interactive Oversight](https://arxiv.org/abs/2602.04210) — Zhou et al. | S2; arXiv v2, 2026-02-06 | Interactive decomposition of complex intent and reported web-development evaluation; preprint and task-specific result, not universal human-control evidence. |
| S16 | [Confirmation Bias: A Challenge for Scalable Oversight](https://ojs.aaai.org/index.php/AAAI/article/view/41124) — Recchia et al. | S1; AAAI-26, vol. 40 no. 44, published 2026-03-14 | Confirmation bias and simple-protocol limits; participants can become more confident in incorrect AI answers, while results are restricted to tested protocols/settings. |
| S17 | [Let's Verify Step by Step](https://cdn.openai.com/improving-mathematical-reasoning-with-process-supervision/Lets_Verify_Step_by_Step.pdf) — OpenAI | S1; 2023 paper/report PDF | Process supervision/step-level feedback in mathematical reasoning and PRM800K; supports process-evidence distinction, not general-domain proof. |
| S18 | [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) — Bai et al./Anthropic | S2; arXiv 2022-12-15 | AI feedback/constitutional principles approach and its experimental scope; model-generated feedback is not automatically independent ground truth. |
| S19 | [Specification gaming: the flip side of AI ingenuity](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/) — Google DeepMind | S1; first-party article, 2020-04-27 | Examples of agents optimizing a specified proxy rather than intended goal; illustration, not a quantitative production failure rate. |
| S20 | [Goal misgeneralization](https://deepmind.google/blog/goal-misgeneralization/) — Google DeepMind | S1; first-party research article, 2022-11-23 | Goal misgeneralization concept and examples where capability generalizes but intended goal does not. |
| S21 | [Reward tampering](https://www.anthropic.com/research/reward-tampering) — Anthropic | S1; first-party research, reviewed 2026-08-23 | Reward-system tampering risks and experimental setup; supports proxy/evaluator threat model, not a claim about every deployed agent. |
| S22 | [Reward Gaming](https://openreview.net/forum?id=yb3HOXO3lX2) — primary research paper | S2; OpenReview version/reviewed 2026-08-23 | Reward-hacking/gaming examples and research framing; publication/review status and task scope must be checked before treating findings as settled. |
| S23 | [Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations](https://csrc.nist.gov/pubs/ai/100/2/e2023/final) — NIST | S1; AI 100-2e2023, 2023-01 | Attack taxonomy, lifecycle and mitigation vocabulary for evasion, poisoning, privacy and abuse cases. |
| S24 | [MITRE ATLAS](https://atlas.mitre.org/) — MITRE | S1; current knowledge base reviewed 2026-08-23 | Adversarial tactics/techniques for machine-learning systems; use as threat-model vocabulary, not a complete control catalogue. |
| S25 | [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — OWASP | S1; current project page reviewed 2026-08-23 | Prompt injection, insecure output/tool use, excessive agency, supply-chain and data risks; project guidance, not a universal risk ranking. |
| S26 | [Inspect AI](https://inspect.aisi.org.uk/) — UK AI Security Institute | S1; current evaluation framework/docs reviewed 2026-08-23 | Evaluation/task/scorer framework concepts, reproducibility and extensible safety testing; framework adoption does not prove model safety. |
| S27 | [Trace semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/trace/) — OpenTelemetry | S1; semantic conventions current, reviewed 2026-08-23 | Trace context/correlation concepts for recording agent execution and linking tool effects; privacy/redaction remain deployment responsibilities. |
| S28 | [GenAI agent spans](https://github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai/gen-ai-agent-spans.md) — OpenTelemetry | S1; development semantic-convention document reviewed 2026-08-23 | Emerging attributes for agent/tool spans and the fact that the convention is evolving; do not treat draft fields as stable contract. |
| S29 | [Frontier Safety Framework](https://deepmind.google/discover/blog/introducing-the-frontier-safety-framework/) — Google DeepMind | S1; first-party framework, reviewed 2026-08-23 | Provider-specific capability/risk thresholds and mitigations; self-governance framework, not external certification. |
| S30 | [Preparedness Framework](https://openai.com/index/preparedness-framework/) — OpenAI | S1; provider policy/framework, current page reviewed 2026-08-23 | Provider-specific frontier capability risk evaluations and safeguards; scope is OpenAI policy, not an industry standard. |
| S31 | [Responsible Scaling Policy](https://www.anthropic.com/news/anthropics-responsible-scaling-policy) — Anthropic | S1; provider policy, current page reviewed 2026-08-23 | Provider-specific capability thresholds, safety measures and deployment policy; not evidence that independent oversight is solved. |
| S32 | [AIRC AI risk-management resources](https://www.nist.gov/itl/ai-risk-management-framework/airc) — NIST | S1; current resource hub | AI resource centre, evaluation and governance material; supports process/documentation mapping rather than a single technical control. |
| S33 | [NIST Privacy Framework](https://www.nist.gov/privacy-framework) — NIST | S1; current framework | Privacy-risk management and data-minimization framing for traces, prompts, tool inputs and reviewers. |
| S34 | [Model Cards for Model Reporting](https://arxiv.org/abs/1810.03993) — Mitchell et al. | S2; arXiv 2018-10 | Reporting scope, intended use, limitations and performance context; documentation does not replace deployment evaluation. |
| S35 | [Datasheets for Datasets](https://arxiv.org/abs/1803.09010) — Gebru et al. | S2; arXiv 2018-03 | Dataset provenance, motivation, composition, collection and limitations; supports evidence lineage and bias review. |

## Excluded and low-value discovery candidates

SEO “AGI will replace all jobs” forecasts, vendor benchmark summaries without task definitions, social-media claims about model autonomy, repeated copies of the arXiv abstract, and generic “AI checker is safe” posts were excluded. They added no independent evidence about verification, failure, scope, or operations. Provider policy pages were retained only when they supplied a concrete risk/evaluation framework and are explicitly marked as provider-specific.

## Integration record (Batch I scope)

Batch I integrated the paired EN/VI evidence-boundary qualifier before the primary reference. It defines `verifiable share` as a local, denominator-dependent capacity measure, rejects model agreement as automatic independent evidence, and preserves the paper's status as a conceptual preprint lens rather than an AGI-timeline forecast.

The existing paper summary, engineering interpretation, verification scorecard, provenance controls, bounded permissions, unknown outcomes and reconciliation guidance remain intact. Real team risk tiers, ground truth and reviewer capacity are still open empirical inputs.

Gate passed on 2026-08-23: content index rebuild, EN/VI article parity, primary-reference anchor checks, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Gate status

- [x] Complete EN/VI sections and metadata read.
- [x] Paper claims separated from engineering inference, recommendation and unknown.
- [x] Broad/high-risk source pool searched; selected ledger has 35 distinct sources.
- [x] Workload/invariants, crash windows, comparison, coverage, contradictions, limits, anti-patterns and falsifiers recorded.
- [x] Duplicate/canonical ownership and EN/VI parity recorded.
- [ ] Local team task classes, risk tiers, ground truth and real verification metrics supplied.
- [x] EN/VI content integration applied in Batch I.
- [x] Validation passed after integration on 2026-08-23.
