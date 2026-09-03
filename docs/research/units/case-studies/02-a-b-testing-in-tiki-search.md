# Research — A/B testing in Tiki Search

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: `02-a-b-testing-in-tiki-search`
EN file: `public/data/case-studies/articles/02-a-b-testing-in-tiki-search.html`
VI file: `public/data/case-studies/articles/02-a-b-testing-in-tiki-search.vi.html`
Metadata EN/VI: `public/data/case-studies/02-a-b-testing-in-tiki-search.json`, `public/data/case-studies/02-a-b-testing-in-tiki-search.vi.json`

## Scope and non-goals

This case is specifically about statistical interpretation of click-through rate (CTR) experiments in Tiki Search. The local article explicitly excludes experiment architecture, assignment infrastructure, logging and user splitting. This dossier preserves that boundary while identifying the minimum data-quality and operational contracts required for the statistical result to be trustworthy.

It is not evidence that Mann–Whitney U is always better than a t-test, that bucketing is generally inferior, or that a p-value threshold alone is a product decision rule. The simulation conclusions are conditional on the generated view, latent CTR and click distributions, user-level independence assumptions, sample size and implementation choices.

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| `naive-approach` | CTR per customer and why averaging can produce misleading differences | Strong motivation; estimand and exposure definition need explicit naming |
| `statistical-tests` | Null/alternative hypotheses; t-test and Mann–Whitney U | Reusable comparison; assumptions and one/two-sided choice need qualification |
| `ctr-distribution` | Simulated views, CTR and clicks | Exact simulation parameters are local facts; not a production data model |
| `modelling-the-ctr-distribution` | Lognormal views, beta latent CTR and binomial clicks | Useful stress-test construction; parameter realism is unknown |
| `bucketing` | Hash users into buckets and compare weighted averages | Reusable alternative; bucket unit, variance and multiple comparisons need detail |
| `the-real-data` | A/A data, simulation calibration and no ground-truth sensitivity on real A/B | Important methodological boundary |
| `conclusion` | No silver bullet; simulate distributions and assess false positives/sensitivity | Strong synthesis if kept conditional |
| `what-s-next` | MDE/duration, non-rate metrics, bootstrap | Correct roadmap; needs links to experiment-design canonical content |
| `references` | Tiki Engineering and GitHub source | First-party provenance; external Russian webinar should be identified as secondary/context |
| `were-hiring` | Editorial recruitment block | Not part of the technical case |

The EN and VI files use the same section IDs and experiments. The VI heading text for the modelling section is translated while retaining the same ID. Code and figures should remain semantically identical during integration.

## What is correct and reusable

- A ratio metric such as CTR can have a heavy-tailed denominator. “Average CTR” is not one estimand: it may mean the mean of per-user ratios, total clicks divided by total views, or a ratio of aggregated means. Those answer different product questions.
- A/A experiments are a practical calibration check for assignment, logging and false-positive rate. Under the simulation's null and assumptions, approximately 5% of tests reject at alpha 0.05; this is a property of that setup, not proof that a production pipeline has a 5% error rate.
- Comparing multiple estimators on a simulated distribution that resembles production is a useful model-selection workflow, provided the simulation is fitted without using the test outcome and validated on held-out A/A data.
- Mann–Whitney U is a test of rank/distributional differences for independent samples; it is not automatically a test of a business CTR mean or an uplift in the ratio of totals.
- Bucketing can reduce the effect of noisy individual observations in some settings, but it changes the effective analysis unit, weighting and variance. Its result needs a prespecified estimator and cluster-aware uncertainty.
- Real A/B data cannot reveal sensitivity to an unknown true uplift without an external ground truth. A/A tests can assess calibration; historical or synthetic injected effects can assess power only under assumptions.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Per-customer CTR is clicks/views and naive averages can differ even for identical variants | First-party fact plus statistical framing | Tiki `naive-approach` | State whether users with zero views are excluded and whether exposure is one search, session or user | High |
| User-level observations are independent, while sessions may be dependent | First-party assumption | Tiki `statistical-tests` | Independence depends on randomization/analysis unit and user carryover; repeated sessions require clustering or user aggregation | Medium |
| The simulation uses lognormal views (`mu=5`, `sigma²=1.3`), beta CTR (`success_rate=.02`, `beta=100`) and binomial clicks | Local reproducible fact | Tiki code/HTML | Preserve exact parameterization and library version; do not call it a measured Tiki distribution | High |
| A/A p-values are approximately uniform and alpha .05 yields about 5% false positives | Simulation result | Tiki figures/code; ASA/NIST explain p-value scope | Report Monte Carlo error, number of repetitions, test implementation and null validity | High for simulation; low for production |
| Mann–Whitney performs better in tested scenarios | Conditional first-party result | Tiki parameter sweep | “Better” needs metric (power/sensitivity at controlled FPR), effect size, ties and distribution; not a universal recommendation | Medium |
| Bucketing generally performs worse but can win for regular/high-beta distributions | Conditional first-party result | Tiki bucketing simulation | Define bucket size, random seed, weighting, cluster count and variance estimator; verify on current data | Medium |
| If the CTR distribution shifts left, both methods perform poorly | Conditional simulation inference | Tiki conclusion | Distinguish low baseline signal from test weakness; evaluate absolute/relative effect and sample size | Medium |
| A/A data should be taken from a holdout or independent experiment population | Recommendation | Tiki `the-real-data`; Microsoft data-quality guidance | Protect randomization, avoid contamination and validate telemetry completeness | High |
| Real A/B sensitivity cannot be known without ground truth | Statistical limitation | Tiki plus power literature | Power analysis and injected-effect replay provide conditional estimates; they do not recover unknown causal truth | High |
| `np.float` and `np.int` in the sample are stale NumPy aliases | Code maintenance observation | Local code; current NumPy APIs | Update only in a content/code integration decision; do not silently change the historical sample | High |
| The simulation is a complete experiment design | Incorrect overreach | Local article says architecture/logging/splitting are out of scope | Keep scope boundary explicit and link to a full experimentation topic | High |

## Workload, estimand, invariants, and failure model

### Workload and estimand model

- Unit of randomization: likely customer/user, but the local article does not define assignment persistence, login/device identity or cross-device behavior.
- Unit of analysis: the article uses per-customer CTR; sessions, searches and impressions can be nested within users and therefore are not automatically independent.
- Outcome: clicks and views are counts; zero-view users, bot traffic, duplicate impressions, delayed clicks and exposure eligibility affect the denominator.
- Distribution: local synthetic views are lognormal and latent CTR is beta-distributed, then clicks are binomial. The resulting distribution has a high-variance denominator and a bounded rate, but its realism is unverified.
- Experiment cadence: the next-step section asks about MDE and duration; the current case does not define a fixed horizon, peeking policy, sequential method or stopping rule.

### Statistical and data invariants

1. Treatment assignment is random, stable for the analysis window and independent of potential outcomes except through treatment.
2. The analysis population and denominator are defined before looking at treatment results. Exclusions must be symmetric or explicitly modelled.
3. Each user contributes according to a declared weighting rule; a user cannot silently enter both arms or multiple buckets.
4. Exposure, click and attribution events are deduplicated and joined with bounded lateness; missing telemetry is measured separately by variant.
5. The null distribution used for a p-value matches the test, unit, dependence structure, tie behavior and predeclared alternative.
6. A/A false-positive rate, sample-ratio mismatch (SRM), balance and logging health are checked before interpreting an A/B uplift.
7. If many metrics, variants, slices or repeated looks are tested, the error-control policy is declared; a single unadjusted p-value is not the invariant.
8. A statistically detectable change is not automatically a material, safe or durable product effect; effect size and decision thresholds remain separate.

### Failure windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| Assignment created but exposure event is lost | Triggered population differs by variant; biased CTR | Reconcile assignment/exposure counts and quarantine affected window |
| User is re-randomized after app/cache/login change | Treatment contamination and dependent outcomes | Stable assignment key, explicit identity merge and SRM/A/A checks |
| Click arrives after experiment end | Late attribution changes arms asymmetrically | Watermark/attribution window and backfill policy |
| Bot or scraper generates views without realistic clicks | Denominator inflation and false negative/positive | Bot filtering rules applied independently of treatment and audited |
| A/A sample ratio differs from configured ratio | Assignment or telemetry defect masquerades as effect | Stop analysis; diagnose SRM before p-values |
| Analyst peeks and stops after significance | Type-I error inflation | Fixed horizon or sequential procedure with alpha spending |
| Same user appears in multiple overlapping experiments | Interference/carryover and non-independent outcomes | Layering/exclusion policy, interaction analysis or cluster randomization |
| Test implementation changes the metric code | Metric drift and incomparable runs | Version metric definitions and replay historical events |
| Bootstrap/bucket code resamples users incorrectly | Underestimated variance | Resample at randomization unit and validate coverage on synthetic nulls |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | CTR, A/A, t-test, Mann–Whitney, bucketing | SciPy docs; NIST handbook; ASA | Define estimand, randomization unit, analysis unit, exposure and bucket weighting |
| Invariants | Implicit independent users and equal null distributions | Google/Microsoft experimentation papers | Add assignment stability, SRM, telemetry completeness, contamination and multiple-testing rules |
| Workload | Synthetic heavy-tailed views and bounded CTR | Tiki source code; Microsoft metric-design guidance | Show production distribution diagnostics and effect-size/MDE range |
| Failure/crash windows | Real-data caveat but no pipeline failure model | Microsoft telemetry-loss/data-quality guidance | Add delayed events, missing logs, re-randomization and experiment-version windows |
| Retries/timeouts | Not covered | AWS idempotent APIs/retry guidance; Microsoft telemetry loss | Add event ingestion retry/dedupe, attribution watermark and query timeout policy |
| Operations/recovery | A/A/holdout validation suggested | Microsoft trustworthy experimentation lifecycle | Add SRM alert, metric freshness, population counts, data backfill and rollback procedure |
| Security/privacy | Not covered | NIST Privacy Framework; Microsoft data-quality principles | Avoid exposing user-level experiment data; define retention, access, hashing and sensitive-query controls |
| Testing | Simulation and figures | SciPy permutation tests; Google ML rules | Add reproducible seeds, null calibration, power curves, metamorphic tests and metric contract tests |
| Domain trade-offs | Sensitivity vs FPR; bucket vs rank test | ASA; Microsoft CUPED; Google long-term work | Separate statistical significance, business MDE, short-term CTR and long-term search quality |

## Best-practice comparison

| Local approach | Best-practice comparison | Assessment and boundary |
| --- | --- | --- |
| Compare t-test and Mann–Whitney on simulated CTR | Use an estimand-first decision: mean/ratio/rank, unit and dependence determine the estimator | Keep the comparison, but name the target estimand and report calibration plus power, not only “better.” |
| A/A p-value distribution | A/A is a guardrail for randomization and telemetry, not a proof of all causal assumptions | Add SRM, exposure counts, identity stability, missingness and repeated-look checks. |
| Lognormal/beta/binomial simulation | Simulation is useful when parameters are fitted from pre-experiment data and sensitivity-tested | Add empirical quantile plots, zero-inflation, overdispersion and user/session dependence; reserve a holdout. |
| User bucketing | Clustered/aggregated analysis can reduce outlier influence but changes weighting and effective sample size | Treat bucket size as a hyperparameter selected on pre-experiment/A/A data; use cluster-aware variance. |
| Mann–Whitney U | Nonparametric rank test handles some non-normality but does not estimate every business CTR estimand | Consider permutation/bootstrap or generalized linear/binomial models when the estimand is a ratio/count effect. |
| Statistical p-value threshold | ASA/NIST require interpretation with effect size, uncertainty, design and context | Add confidence intervals, MDE, practical threshold, power and decision rule. |
| “No silver bullet” | Microsoft/Google large-scale platforms use layered diagnostics, variance reduction and long-term checks | Retain the conclusion and connect it to CUPED, SRM, telemetry and long-term/carryover analysis. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| Mann–Whitney is better in the tested cases | It tests ranks/distributions and can answer a different question from mean CTR or ratio-of-sums | Do not replace the t-test without specifying the estimand and reporting both when useful. |
| A/A alpha .05 means 5% false positives | Uniform p-values require a valid null, independent/appropriate unit and fixed analysis plan | A broken assignment or repeated peeking can produce a different rate. |
| Per-user CTR avoids aggregate distortion | Users with few views have noisy ratios; total CTR weights heavy users more | Declare per-user versus impression-weighted estimand and show both if product meaning differs. |
| Buckets smooth the metric | Too few buckets reduces effective N; too many can reproduce noisy users; weighted bucket averages can be biased | Tune and validate bucket count using pre-period/A/A only. |
| Simulation can choose the best test | Misspecified distribution, hidden dependence or logging bias can reverse the ranking | Require production calibration and out-of-sample A/A validation. |
| A statistically significant uplift is a win | Small effects can be operationally irrelevant; short-term CTR can harm long-term satisfaction or revenue | Include practical MDE, guardrail metrics and long-term follow-up. |
| Bootstrap is a universal next step | Resampling the wrong unit or ignoring sequential/cluster structure gives invalid uncertainty | Bootstrap at randomization unit and test coverage under null simulations. |

## Negative evidence and anti-patterns

- Do not use the local parameter sweep as evidence that Mann–Whitney dominates for all CTR distributions, traffic levels or metrics.
- Do not divide aggregate clicks by aggregate views and call it equivalent to the mean of user CTRs.
- Do not include zero-exposure users in a CTR denominator without defining the estimand; do not silently drop them after seeing the result.
- Do not compare p-values from repeated daily looks without a sequential/error-control plan.
- Do not tune bucket size, alpha, outlier trimming or metric transformation on the same A/B outcome used for the final claim.
- Do not use an A/A pass to certify a system with missing exposure events, identity collisions or SRM.
- Do not report only p-values; a statistically significant result can be tiny, unstable or caused by a denominator/telemetry defect.
- Do not use current SciPy/NumPy code assumptions to rewrite the historical figures; mark stale APIs and reproduce separately with pinned dependencies.

## Operational, security, observability and testing concerns

- Experiment registry: immutable experiment ID, variant allocation, salt/version, analysis unit, start/end, metric definition version, eligible population and guardrails.
- Data quality metrics: assignment/exposure/click counts per arm, SRM p-value, missingness/latency, duplicate rate, bot rate, identity collisions, denominator zero rate and event watermark lag.
- Statistical monitoring: A/A calibration over time, p-value histogram, effect confidence interval, MDE/power curve, multiple-testing family and sequential-look log.
- Reproducibility: pin SciPy/NumPy/statsmodels versions, persist random seeds and simulation parameters, store code commit and data snapshot, and use a fresh validation period.
- Privacy/security: hash or pseudonymize user IDs, restrict raw click logs, enforce query access by experiment ownership, aggregate small cells and apply retention/deletion rules. The statistical method does not authorize exposing user-level data.
- Tests: metric contract tests against hand-calculated CTR, assignment determinism tests, SRM fixture tests, null simulations, injected-effect simulations, permutation/bootstrap coverage, late-event backfill, duplicate event handling and cross-device identity cases.
- Operational recovery: if telemetry is late or lost, pause decisioning, record the affected window, backfill if possible, rerun with the same predeclared population and publish a correction rather than silently extending the test.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic p-values, confidence intervals and test definitions | Statistics/system-design fundamentals | Use compact definitions and keep the search-CTR estimand example here. |
| Experiment platform architecture, assignment and logging | A/B experimentation platform topic (exact shared slug to confirm during integration) | Explicitly out of local article scope; link rather than duplicate. |
| Search CTR distribution and method-selection simulation | This case | Own the Tiki-specific distributions, code, A/A calibration and bucketing comparison. |
| CUPED, SRM, telemetry loss and long-term experimentation | Canonical experimentation best-practice topic / external references | Cite and cross-link; do not repeat full platform guidance here. |
| Bootstrap/permutation implementation | Statistical inference topic | Keep a short “next step” and link to canonical method material. |

## Integration record (Batch I scope)

Batch I integrated the paired EN/VI interpretation qualifier before the article's “What's next?” section. It makes randomization/analysis unit, denominator, identity and bot handling, SRM/telemetry loss, multiple looks, effect size/intervals, power/MDE and long-term guardrails explicit; A/A calibration and simulation are framed as validity checks rather than universal fixes.

The historical Tiki Search analysis, code/figure pairing and external repository provenance remain intact. Experiment-platform architecture and generic statistical definitions stay cross-referenced rather than duplicated.

Gate passed on 2026-08-23: content index rebuild, EN/VI article parity, case-anchor checks, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

1. Add an “estimand and unit” box distinguishing mean user CTR, impression-weighted CTR and ratio-of-totals.
2. State the assignment and analysis-unit assumptions beside the tests, including repeated sessions and cross-device identity.
3. Rename “better” to a measurable criterion such as power at controlled false-positive rate, and show confidence intervals/effect sizes.
4. Add a production A/A gate: SRM, exposure/click completeness, identity stability, bot filtering and p-value calibration.
5. Mark every simulation parameter as synthetic, pin the dependency versions, replace deprecated NumPy aliases in a future code-maintenance change and preserve the historical result separately.
6. Explain Mann–Whitney's rank/distribution estimand and ties; add permutation/bootstrap only as alternatives matched to the declared randomization unit.
7. Define bucket weighting, bucket-count selection and cluster-aware uncertainty; remove “generally worse” unless the evidence table includes the tested parameter range.
8. Add a practical MDE/duration/guardrail section and a note that short-term CTR may not predict long-term search quality.
9. Keep the scope statement that experiment architecture/logging are not covered, then link to the canonical experimentation topic.

## EN/VI and cross-reference plan

- Preserve all IDs and code/figure pairings. Keep `modelling-the-ctr-distribution` as the stable cross-language anchor despite the translated VI heading.
- Use one bilingual glossary for `estimand`, `randomization unit`, `analysis unit`, `exposure`, `denominator`, `sample-ratio mismatch`, `false-positive rate`, `power`, `MDE`, `bucket`, `carryover` and `telemetry loss`.
- Correct the same claims in both languages; do not let the VI “accuracy/sensitivity” wording imply a different metric.
- Keep the external GitHub reference as provenance and label the Russian webinar as contextual/secondary if retained.
- Link generic statistics and experimentation platform pages into this case; link this case from those pages for the heavy-tailed CTR example.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| What is the actual randomization and analysis unit? | Experiment registry and event schema | Users are re-randomized, sessions are the real unit, or treatment spills across users; user-independent tests then misstate uncertainty. |
| How are zero views, repeated clicks, bots and delayed clicks handled? | Metric SQL and event watermark policy | Variant-specific missingness or attribution windows change the result after backfill. |
| Does the real CTR distribution match the simulation? | Pre-period quantiles, zero-inflation, overdispersion and dependence diagnostics | An out-of-sample A/A or injected-effect replay reverses the method ranking. |
| Are p-values calibrated under the production pipeline? | Repeated A/A tests with fixed analysis plan | SRM, p-value non-uniformity or false-positive rate outside the declared tolerance. |
| Is bucketing selected without outcome leakage? | Bucket-size selection log and pre-period data | Bucket choice changes after treatment results or effective sample size is too small. |
| Are multiple metrics/slices/looks controlled? | Experiment analysis plan and platform audit | A significant result disappears under prespecified family-wise/FDR/sequential correction. |
| Does CTR correlate with long-term search quality? | Long-term holdout and guardrail analysis | CTR uplift reduces satisfaction, conversion, retention or query success. |
| Can current code reproduce the figures? | Pinned environment and source commit | Deprecated APIs, missing seeds or absent data prevent reproduction; then the exact historical figure is unresolved. |

## Discovery pool and exclusions

The discovery pool contained approximately 45 candidates; 28 distinct sources were selected. Duplicate mirrors of Microsoft/Google papers, general blog explainers, SEO “p-value calculator” pages, and sources that only repeated the definition of A/B testing were excluded. The selected ledger emphasizes statistical standards, official scientific-computing documentation, original experimentation papers and first-party Microsoft/Google practice reports.

## Sources

All sources were reviewed on 2026-08-23. Page revisions are recorded only when exposed by the source; no current software behavior is inferred from an old Tiki article.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [A/B Testing in Tiki Search](https://engineering.tiki.vn/a-b-testing-in-tiki-search/) — Tiki Engineering | T1 first-party; article page reviewed, historical experiment | Local CTR simulation, tests, bucketing, A/A and conclusions. |
| 2 | [A/B testing source and simulations](https://github.com/bachan/articles/tree/master/ab_testing_in_tiki_search_1) — Tiki author repository | T1 first-party artifact; repository revision not pinned in article | Code parameters, SciPy/NumPy implementation and reproducibility/staleness checks. |
| 3 | [Online Experimentation at Microsoft](https://www.microsoft.com/en-us/research/publication/online-experimentation-at-microsoft/) — Microsoft Research | T1 first-party paper; 2009 | Randomization, platform/cultural challenges and why controlled experiments need engineering support. |
| 4 | [Online controlled experiments: lessons and pitfalls](https://exp-platform.com/Documents/ExPThinkWeek2009Public.pdf) — Microsoft ExP | T1 first-party paper; 2009 PDF | Experiment validity, practical pitfalls and platform-scale context. |
| 5 | [The benefits of controlled experimentation at scale](https://www.microsoft.com/en-us/research/publication/the-benefits-of-controlled-experimentation-at-scale/) — Microsoft Research | T1 first-party; 2017 | Product/team/portfolio benefits and organizational scope; not a statistical guarantee. |
| 6 | [Data quality: building blocks for trustworthy A/B analysis](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/data-quality-fundamental-building-blocks-for-trustworthy-a-b-testing-analysis) — Microsoft ExP | T1 first-party; current article | Missingness, sensitivity and data quality as prerequisites for analysis. |
| 7 | [Trustworthy experimentation under telemetry loss](https://www.microsoft.com/en-us/research/publication/trustworthy-experimentation-under-telemetry-loss/) — Microsoft Research | T1 first-party paper; revision not stated | Telemetry loss can bias results and reduce power; supports late/missing event failure analysis. |
| 8 | [Patterns of trustworthy experimentation: pre-experiment stage](https://www.microsoft.com/en-us/research/?p=680556) — Microsoft ExP | T1 first-party; 2020 page | Seed balance, retrospective A/A and variance-reduction workflow. |
| 9 | [Patterns of trustworthy experimentation: post-experiment stage](https://www.microsoft.com/en-us/research/?p=806938) — Microsoft ExP | T1 first-party; page revision not stated | Triggered analysis, counterfactual logging and data-quality checks. |
| 10 | [Beyond power analysis: metric sensitivity](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/beyond-power-analysis-metric-sensitivity-in-a-b-tests/) — Microsoft ExP | T1 first-party; 2021 | Metric transformations, outliers, proportions and CUPED as sensitivity tools. |
| 11 | [Deep dive into variance reduction](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/deep-dive-into-variance-reduction/) — Microsoft ExP | T1 first-party; 2022-11-15 | CUPED/ANCOVA equivalence and variance-reduction limits. |
| 12 | [Why tenant-randomized A/B tests are challenging](https://www.microsoft.com/en-us/research/articles/why-tenant-randomized-a-b-test-is-challenging-and-tenant-pairing-may-not-work/) — Microsoft ExP | T1 first-party; current article | Randomization/analysis-unit mismatch, Delta method, CUPED and cluster-level concerns. |
| 13 | [Overlapping experiment infrastructure](https://research.google.com/pubs/archive/36500.pdf) — Google Research | T1 original paper; revision not stated | Layered experiments, interference/overlap and platform-scale methodology. |
| 14 | [Focus on the long term](https://research.google.com/pubs/archive/43887.pdf) — Google Research | T1 original paper; revision not stated | A/A definition, long-term effects, carryover and short-term/long-term distinction. |
| 15 | [Online experimentation with multi-armed bandits](https://research.google.com/pubs/archive/42550.pdf) — Google Research | T1 original paper; revision not stated | Trade-off between fixed randomized experiments and adaptive allocation; not a replacement for this case's tests. |
| 16 | [ASA statement on statistical significance and p-values](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf) — American Statistical Association | T1 professional statement; 2016 | P-values are not the probability a hypothesis is true; effect size, uncertainty and context are required. |
| 17 | [P-values](https://www.itl.nist.gov/div898/handbook/prc/section1/prc131.htm) — NIST/SEMATECH e-Handbook | T1 official handbook; page revision not stated | Definition and interpretation limits for p-values. |
| 18 | [Confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section1/prc14.htm) — NIST/SEMATECH | T1 official handbook; page revision not stated | Uncertainty intervals and repeated-sampling interpretation. |
| 19 | [NIST/SEMATECH e-Handbook landing page](https://www.nist.gov/programs-projects/nistsematech-engineering-statistics-handbook) — NIST | T1 official; current landing page | Statistical-method provenance and scope. |
| 20 | [`mannwhitneyu`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html) — SciPy | T1 official API; current docs | Independent-sample rank test, exact/asymptotic methods and ties. |
| 21 | [`ttest_ind`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html) — SciPy | T1 official API; current docs | Independent-sample t-test variants and assumptions/options. |
| 22 | [`permutation_test`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.permutation_test.html) — SciPy | T1 official API; current docs | Permutation testing, exchangeability and alternative hypotheses. |
| 23 | [`multipletests`](https://www.statsmodels.org/dev/generated/statsmodels.stats.multitest.multipletests.html) — statsmodels | T1 official API; current development docs | Family-wise/FDR correction choices when multiple metrics or slices are tested. |
| 24 | [Google ML: dividing datasets](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets) — Google Developers | T1 official training material; current page | Held-out evaluation, representative test data and avoiding duplicate train/test examples. |
| 25 | [Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml/) — Google Developers | T1 official guidance; current page | Test on future data and keep training/serving behavior aligned; applicable by analogy to experiment telemetry. |
| 26 | [Improving sensitivity with pre-experiment data](https://doi.org/10.1145/2433396.2433413) — Deng, Xu, Kohavi, Walker / ACM WSDM | T1 original paper; WSDM 2013 | CUPED/variance reduction rationale and its dependence on pre-period correlation. |
| 27 | [Causal Inference for Statistics](https://doi.org/10.1017/CBO9781139025751) — Imbens and Rubin | T1 original academic monograph; 2015 | Potential-outcome/causal-design boundary; not a Tiki-specific implementation source. |
| 28 | [Detecting network effects](https://doi.org/10.1145/3097983.3098192) — Saveski et al., ACM KDD | T1 original paper; 2017 | Interference/network effects as a limit to independent-user experiments. |
