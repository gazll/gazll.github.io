# Research — Demand forecasting for Tiki Operations

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: 07-into-the-demand-forecast-of-tiki-operations
EN file: public/data/case-studies/articles/07-into-the-demand-forecast-of-tiki-operations.html
VI file: public/data/case-studies/articles/07-into-the-demand-forecast-of-tiki-operations.vi.html
Metadata EN/VI: public/data/case-studies/07-into-the-demand-forecast-of-tiki-operations.json, public/data/case-studies/07-into-the-demand-forecast-of-tiki-operations.vi.json

## Scope and non-goals

This case describes Tiki's historical demand-forecasting work for retail operations: classical time-series methods, product segmentation, DeepAR, signal/feature engineering, regional forecasting and future replenishment/workforce use. It is not a reproducible benchmark or proof that a deep model is superior for all SKUs, regions, horizons or inventory policies.

The research question is: how should a commerce forecasting system turn sparse, hierarchical, promotion-affected and often stockout-censored observations into forecasts and replenishment decisions with honest uncertainty, temporal evaluation and safe rollout?

The local claim “up to 60% more accurate” is kept as a first-party result whose baseline, horizon, split, aggregation, metric implementation and confidence interval are unresolved.

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| problem-statement | Too little stock causes stockout; too much ties cash; wrong warehouse increases delivery time; manual intuition no longer scales | Strong business framing; decision objective and censoring are not formalized |
| our-approach | Time series → clusters → classical methods → DeepAR with signals/promotions; model competition | Reusable iterative workflow; train/evaluate split needs clarification |
| forecasting-methods | Theta, INNAR, Croston and other classical methods plus DeepAR | Useful method inventory; exact six methods/formulas are partly image/code dependent |
| evaluation | MAE, MAPE, primary SMAPE; 20% used for evaluation | Metrics and split need correction/qualification; possible leakage ambiguity |
| feature-engineering | Signals pool, traffic hypothesis, data warehouse/ETL and experiments | Good production workflow; feature availability time is unspecified |
| experimental-process | OFFICIAL baseline and experiment tags, key metrics and rollout | Reusable model governance; rollback/drift gates missing |
| future-plan | Product segmentation, regional demand, automated replenishment for reliable segments and daily workforce forecast | Good staged roadmap; needs uncertainty/service-level guardrails |
| products-segmentation | Segment products to choose modeling/automation strategy | Local section; criteria/results are not fully quantified |
| forecast-by-regions | Delivery-address regional demand | Potential leakage/aggregation and geography-definition issues |
| automate-inventory-replenishment-process | Forecast to automatic replenishment | High-risk decision boundary; policy/lead-time/constraints absent |
| apply-forecast-result-into-human-resource-planning | Forecast to staffing | Decision/forecast horizon and workforce constraints absent |
| conclusion | Forecasting improves operations but needs continued experimentation | Correct high-level synthesis |

EN and VI have the same IDs and structure. The VI text uses “Signal group” where EN says “Signals pool”; this is a terminology-parity issue, not a different algorithm.

## What is correct and reusable

- Forecasting is a decision-support component, not the inventory policy itself. A forecast must be paired with lead time, service-level target, order constraints, supply uncertainty, capacity, cash and substitution rules.
- A model competition that includes simple/classical baselines and a global probabilistic model is healthier than assuming one architecture wins across every series.
- DeepAR's relevant contribution is a joint model over many related series that can produce probabilistic forecasts and use static/dynamic features; its suitability depends on data availability, likelihood and horizon.
- Product and regional hierarchy matters. Forecasts for SKU/warehouse, category, region and total should be evaluated at the levels where decisions are made and reconciled if coherent totals are required.
- Stockouts censor observed sales: zero sales may mean no demand or no availability. Training blindly on sales can underforecast popular unavailable items.
- Time-based validation is essential. A random split or using future promotion/stock variables in a feature can overstate accuracy.
- SMAPE/MAPE/MAE are point-error views. Replenishment and staffing need quantiles/distributions, calibration, service-level and cost metrics as well.
- Segment-gated automation and human review are safer than a single model/threshold applied to every product.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Too little stock causes stockouts, too much wastes cash and wrong warehouse increases delivery time | Domain fact/inference | Tiki problem statement; inventory literature | Make cost/constraint assumptions explicit; trade-offs differ by margin, lead time and service level | High |
| Manual merchandiser intuition no longer scales to millions of products/warehouses | First-party problem framing | Tiki article | Historical Tiki scope; human forecasts remain valuable for causal/promotion exceptions | Medium-to-high |
| Six classical methods were compared, including Theta, INNAR and Croston | First-party implementation fact | Tiki methods section | Preserve exact method list/version; no claim that these are best current methods | High |
| DeepAR uses signals/promotions and competes per product | First-party implementation claim | Tiki approach/feature sections | State training population, likelihood, horizon, feature availability and fallback | Medium-to-high |
| Twenty percent of each time series was used to evaluate all models | First-party evaluation description | Tiki evaluation | Clarify whether the last 20% is chronological holdout; random/overlapping windows could leak future information | Medium |
| SMAPE is primary and is 0–100% | Local metric claim | Tiki evaluation; M4 literature | Formula/zero-denominator convention is in an image/not fully machine-readable; metric variants and scale conventions differ | Medium |
| DeepAR/competition improved accuracy by up to 60% | First-party result | Tiki evaluation | Add baseline, horizon, product/region aggregation, split, metric, uncertainty and number of series | Low-to-medium |
| Model competition chooses the best method per product | First-party workflow claim | Tiki approach | Avoid test-set selection leakage; use rolling-origin validation and stability/operational criteria | Medium |
| Traffic is a useful signal for demand | First-party hypothesis | Tiki feature engineering | A feature must be known at forecast origin; traffic may be endogenous or unavailable in future | Medium |
| Weekly forecast supports inventory planning | First-party design claim | Tiki article | Lead-time and replenishment cadence may require daily/multi-horizon distributions | Medium |
| Regional demand can be inferred from delivery address | Roadmap recommendation | Tiki future plan | Address is observed after ordering and can have privacy/coverage/selection bias; define forecast origin and geography | Medium |
| Forecast can automate replenishment for reliable segments | Recommendation | Tiki roadmap; AWS supply planning; inventory research | Gate on calibrated uncertainty, service level, constraints, stockout correction and override | High as recommendation; incomplete locally |
| Forecast can inform workforce planning | Recommendation | Tiki roadmap | Staffing has labor, shift, skill and lead-time constraints; forecast error needs scenario buffers | Medium |

## Workload, invariants, and failure model

### Workload model

- Millions of SKU/product series across warehouses, regions and categories; many are intermittent, new, discontinued, promotional or structurally changing.
- Observations have multiple clocks: order time, shipment/delivery time, inventory availability, promotion schedule, traffic, replenishment lead time and workforce planning horizon.
- Forecast cadence is locally described as weekly, but decisions may need daily horizons, lead-time sums and regional/warehouse allocations.
- Feature pipelines include data warehouse/ETL, signals, promotions and traffic; delayed or corrected data is expected.
- The model fleet includes classical per-series methods and a global probabilistic model; selection, training, inference, backfill and rollout have different compute/latency constraints.

### Invariants

1. Every feature used at forecast origin was available at that origin; future promotions, stock levels, deliveries or labels cannot leak into training/evaluation.
2. Train/validation/test windows respect time and product/warehouse identity; repeated rolling windows do not overlap labels in a way that invalidates uncertainty.
3. Forecast horizon, frequency, target definition and aggregation are explicit. “Demand” is not automatically “observed sales.”
4. Forecasts are non-negative/count-compatible where required and obey business constraints or are reconciled before use.
5. Probabilistic forecasts are calibrated at declared quantiles/coverage; a lower point error does not justify a higher stockout risk.
6. Evaluation includes naive/seasonal baselines and is stratified by product lifecycle, intermittency, promotion, region, volume and stockout status.
7. A model artifact records code/data/features/parameters/version, training cutoff, horizon, metrics and approval status.
8. Automation has a safe fallback, policy guardrails, approval/override, audit and rollback; an experiment model cannot silently become replenishment truth.
9. Data corrections, missing feeds, model failure and drift produce a visible “unknown/manual” state rather than fabricated confidence.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| ETL/feed late or partially loaded | Forecast runs on incomplete data and silently shifts demand | Data freshness gates, completeness/control totals and delayed/failed run status |
| Stockout or listing suppression hides demand | Sales model learns low demand for unavailable items | Censoring flags, availability-aware target, lost-sales model or separate imputation |
| Promotion/price feature known only after origin | Offline score inflated; production forecast fails | Feature availability contract and point-in-time joins |
| Random/overlapping split leaks future patterns | Reported 60% improvement is not causal/generalizable | Rolling-origin/time split, fresh holdout and leakage tests |
| Model artifact/feature schema mismatch | Inference error or silent wrong values | Registry schema/version checks and canary inference |
| Global model has no cold-start series | New products cannot be forecast | Static features, analog/baseline fallback and explicit coverage |
| Demand regime/promotion changes | Drift, underforecast and stockouts | Drift/coverage monitoring, retraining trigger and human override |
| Forecast completes but replenishment constraints reject it | No feasible order or excess stock | Constraint solver/policy, partial/fallback plan and operator queue |
| Regional address data is delayed/biased | Wrong warehouse allocation or privacy exposure | Forecast-origin definition, geographic aggregation and privacy review |
| Model service times out during planning | Missing forecast blocks operations or stale result is reused | Time budget, last-known/versioned result, fallback and alert |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Forecasting, SMAPE/MAE/MAPE, DeepAR, segmentation | Amazon DeepAR; OTexts; M4 | Define target/demand, origin, horizon, point/distributional forecast and decision. |
| Invariants | 20% evaluation and model competition implied | OTexts TSCV/hierarchies; Google ML rules | Add temporal leakage, availability, coherence, calibration and artifact invariants. |
| Workload | Millions of products/warehouses, weekly, signals | Amazon scale paper; M5 literature | Add intermittency, stockout censoring, promotions, cold start, horizon and skew. |
| Failure/crash windows | ETL/experimentation future plans | Google ML monitoring; AWS model docs | Add pipeline completeness, drift, schema, timeout and decision fallback. |
| Retries/timeouts | Not covered | Temporal retry; AWS backoff/idempotency | Add pipeline/model job retry budget, run ID and stale-result policy. |
| Operations/recovery | OFFICIAL/experiment tags and rollouts | NIST AI RMF; AWS/SRE; ML registry practice | Add approval, registry, rollback, drift, reconciliation and runbook. |
| Security/privacy | Not covered | NIST AI RMF/privacy; regional data guidance | Add address/behavior access, retention, feature minimization and audit. |
| Testing | Simulated/real experiments implied | OTexts TSCV; Google ML testing rules | Add leakage tests, rolling backtests, calibration, segment and decision simulation. |
| Domain trade-offs | Stockout vs overstock, warehouse/time, human/automation | Inventory/censored-demand papers; OR-Tools | Evaluate business cost/service level, not SMAPE alone. |

## Best-practice comparison

| Local approach | Best-practice comparison | Assessment and boundary |
| --- | --- | --- |
| Classical methods plus DeepAR competition | Benchmark simple/seasonal/intermittent methods against global probabilistic models | Keep the competition; report per-segment/horizon stability and operational cost. |
| 20% evaluation slice | Rolling-origin temporal cross-validation and fresh holdout | Use a chronological, leakage-tested split; specify whether 20% is the final horizon or multiple windows. |
| SMAPE/MAE/MAPE | Point metrics plus quantile/CRPS/calibration and inventory cost/service level | Keep SMAPE for comparability only; add decision metrics. |
| Signals/promotions/traffic | Point-in-time feature store and availability contract | Traffic/promotions help only if known or forecast at origin and not post-treatment proxies. |
| Product segmentation | Hierarchical/intermittent/cold-start stratification | Segment by demand characteristics and decision risk, not only volume. |
| Regional forecasts | Coherent hierarchical/grouped forecasts | Reconcile product/warehouse/region totals if downstream allocations require it. |
| Automated replenishment | Forecast + lead-time/supply uncertainty + policy/optimization | Gate automation; provide feasible fallback and human override. |
| Daily workforce plan | Scenario forecasts and capacity/shift constraints | Use quantiles/scenarios; monitor schedule stability and labor outcomes. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| SMAPE is a complete accuracy measure | It is a point metric with zero/low-denominator and symmetry conventions; it ignores cost/calibration | Report formula/variant, MASE/RMSSE/MAE and decision metrics. |
| 60% more accurate means business improvement | Baseline, horizon, aggregation and cost are unspecified; accuracy may improve on low-value series | Require per-segment, weighted, holdout and inventory outcome evidence. |
| Observed sales equal demand | Stockouts/lost sales censor demand and promotions/availability change observations | Model availability/censoring or qualify target as observed sales. |
| Best model per product is optimal | Test-set selection, unstable winner and operational complexity can overfit | Use nested/rolling validation, champion/challenger and simplicity/latency criteria. |
| DeepAR is better for many series | It needs related data, training coverage, likelihood and features; classical models can win on small/intermittent series | Segment and retain robust baselines. |
| Weekly forecasts are enough | Lead-time and replenishment decisions may need daily/horizon distributions | Define decision cadence and aggregate distributions correctly. |
| Regional delivery address gives future demand | Address may be unknown at forecast time and is privacy/selection biased | Use origin-available geography and validate allocation effects. |
| Forecast automation reduces manual work | Bad forecasts move risk to stockouts, excess, route and labor decisions | Add policy guardrails, manual review and outcome monitoring. |

## Negative evidence and anti-patterns

- Do not random-split time series or join future promotions/stock availability into historical features.
- Do not train on sales during stockouts as if they were unconstrained demand.
- Do not select a model on the final test window separately for every product without controlling selection leakage.
- Do not use “SMAPE improved” as proof that replenishment cost, stockout rate, service level or delivery time improved.
- Do not claim a point forecast is probabilistic; do not automate from a mean without uncertainty, lead time and policy.
- Do not let a global model hide poor coverage for cold-start, sparse, discontinued or regional series.
- Do not use delivery address after order placement as a feature for a forecast that is supposed to guide pre-order allocation.
- Do not retry stale forecast jobs until a result appears; mark the run stale and use a versioned fallback.
- Do not remove merchandiser/operator review for promotions, assortments, supply disruptions or policy exceptions.

## Operational, security, observability and testing concerns

- Data SLIs: freshness/completeness by source, late-arrival distribution, stockout/availability coverage, feature nulls, schema drift, duplicate IDs and point-in-time join violations.
- Model SLIs: forecast error by horizon/segment/region, bias, coverage/calibration, quantile loss/CRPS, drift, fallback rate, inference latency and artifact reproducibility.
- Decision SLIs: stockout/service level, excess/aging inventory, fill rate, cancellation, lead-time/delivery, replenishment override, workforce overtime and route/pick consequences.
- Experiment registry: OFFICIAL baseline, experiment ID, data cutoff, model code/feature version, forecast horizon, approval, rollout percentage, rollback target and owner.
- Security/privacy: minimize raw customer address/behavior features, aggregate geography, restrict feature-store access, encrypt data, define retention/deletion and audit model inputs/exports.
- Testing: point-in-time feature tests, time-split/rolling backtests, synthetic stockout/censoring, promotion shocks, cold-start, hierarchy coherence, non-negativity, quantile calibration, model-serving contract, load/timeout and rollback tests.
- Recovery: preserve last-known-good forecast with version and age, pause automated orders when data/model gates fail, rerun from immutable snapshot, compare outputs and record manual decisions.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic forecasting/statistical metrics | Forecasting fundamentals topic | Keep Tiki's data/model/rollout story and link for formulas. |
| Inventory hot-key consistency | Case 01 Arcturus | Link for mutation correctness; do not repeat its queue algorithm. |
| Inventory/replenishment domain policy | Case 05 Operations | Own the forecast-to-decision boundary and link to operations workflow. |
| Queue/ETL delivery semantics | Topic 08-message-queue / Case 15 outbox | Mention pipeline idempotency and checkpoints, not generic messaging theory. |
| Demand forecasting, segmentation and model governance | This case | Own Tiki-specific model competition, regional demand and automation gates. |

## Integration record (Batch I scope)

Batch I integrated the paired EN/VI measurement qualifier before the conclusion. It narrows the historical “up to 60%” observation to a claim that requires baseline, target semantics, forecast origin/horizon, chronological evaluation, metric formula, weighting, uncertainty and leakage evidence; it also gates automation on stockout, service, excess-inventory, labour and operator-outcome signals.

The article's Tiki methods, figures, model names and roadmap remain intact. Forecasting formula detail, censored-demand research and inventory/replenishment authority stay in their documented source/case boundaries.

Gate passed on 2026-08-23: content index rebuild, EN/VI article parity, case-anchor checks, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

1. Define demand target, forecast origin, horizon, cadence, SKU/warehouse/region keys and whether target is observed sales or censored demand.
2. Replace “up to 60% more accurate” with an attributed result table containing baseline, metric formula, horizon, temporal split, aggregation, series count and confidence/variance; keep unknowns explicit.
3. Explain the 20% evaluation slice and confirm it is chronological/rolling; add leakage tests and a fresh final holdout.
4. Include naive/seasonal/intermittent baselines, DeepAR likelihood/features, training coverage and cold-start fallback.
5. Add point plus probabilistic metrics: MAE/SMAPE/MAPE with formula/zero convention, MASE/RMSSE, quantile loss/coverage/CRPS and inventory service/cost metrics.
6. Add stockout-censored demand, promotion/price availability and feature-at-origin contracts.
7. Add product/warehouse/region hierarchy coherence and address privacy/forecast-origin limits.
8. Turn OFFICIAL/experiment tags into a model registry/champion-challenger/rollback workflow with drift/data gates.
9. Gate automated replenishment and workforce planning by segment, uncertainty, constraints, operator override and outcome monitoring.
10. Align EN/VI “Signals pool” terminology and preserve all IDs.

## EN/VI and cross-reference plan

- Preserve the 13 IDs and code/figure references. Keep DeepAR, Theta, INNAR, Croston, SMAPE, MAE, MAPE and OFFICIAL unchanged.
- Standardize demand versus sales, forecast origin, horizon, intermittent demand, censored demand, point forecast, probabilistic forecast, quantile, calibration, leakage, backtest and replenishment.
- Add the same formula/definition and caveat for SMAPE in both languages; if the formula is only in an image, add accessible text during integration.
- Keep the same historical 60% wording and unresolved evidence note in both languages.
- Cross-link Cases 01 and 05 for inventory/workflow decisions; keep model-method detail here.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| Is the 20% split chronological and leakage-free? | Training/evaluation code, cutoffs and feature timestamps | Random/overlapping split or future feature leakage materially inflates the result. |
| What is the exact SMAPE formula/zero convention? | Source code/image formula and metric library version | Recalculation changes rankings or percentage interpretation. |
| What baseline/horizon produced the 60% result? | Experiment report with per-segment/horizon results | Fresh temporal holdout does not reproduce the gain or business cost worsens. |
| Are sales censored by stockouts and listing availability? | Availability/inventory history joined point-in-time | Stockout correction materially changes forecasts and model ranking. |
| Which series can DeepAR cover/cold-start? | Training coverage, static features and fallback metrics | New/sparse products fail at a rate that makes global automation unsafe. |
| Are forecasts coherent across product/warehouse/region? | Aggregation/reconciliation checks | Downstream allocation receives inconsistent totals or double counts. |
| Are probabilistic forecasts calibrated? | Coverage/quantile/CRPS evaluation on fresh data | Nominal intervals systematically under-cover during peaks/promotions. |
| Does automation improve operations? | Controlled rollout with stockout/excess/service-level/cost metrics | Model error improves while inventory/customer/workforce outcomes deteriorate. |
| What data/privacy rules apply to delivery address? | Data inventory, purpose/retention/access review | Address cannot be used at forecast origin or fails privacy minimization. |

## Discovery pool and exclusions

The discovery pool contained approximately 52 candidates; 28 distinct sources were selected. Duplicate versions of DeepAR/M4/OTexts pages, generic “AI forecasting” marketing posts, unverified benchmark summaries and SEO explanations of SMAPE were excluded. The ledger prioritizes Tiki's first-party article, original/first-party probabilistic forecasting research, official forecasting documentation, formal evaluation guidance and inventory/censoring research.

## Sources

All sources were reviewed on 2026-08-23. Model/provider versions and paper dates are recorded because forecast behavior and APIs change; none of the current provider claims is attributed to Tiki without local evidence.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Into the demand forecast of Tiki Operations](https://engineering.tiki.vn/into-the-demand-forecast-of-tiki-operations/) — Tiki Engineering | T1 first-party; historical article, revision not stated | Problem, methods, evaluation, feature engineering, model competition, regions and roadmap. |
| 2 | [DeepAR: probabilistic forecasting with autoregressive recurrent networks](https://arxiv.org/abs/1704.04110) — Salinas et al. / Amazon Research | T1 original paper; 2017 | Joint related-series probabilistic RNN model and training/forecasting concept. |
| 3 | [Probabilistic demand forecasting at scale](https://www.amazon.science/publications/probabilistic-demand-forecasting-at-scale) — Amazon Science | T1 first-party paper page; 2017 | Retail demand as a distribution and platform-scale forecasting motivation. |
| 4 | [Probabilistic demand forecasting at scale PDF](https://assets.amazon.science/68/94/93cae3094bb2be29556247c01e1d/probabilistic-demand-forecasting-at-scale.pdf) — Amazon Science | T1 original paper PDF; 2017 | Detailed DeepAR/demand platform claims and probabilistic output rationale. |
| 5 | [SageMaker DeepAR algorithm](https://docs.aws.amazon.com/sagemaker/latest/dg/deepar.html) — AWS | T1 official; current SageMaker AI docs | Related-series training, static/dynamic features, context/prediction windows and new-series limits. |
| 6 | [DeepAR hyperparameters](https://docs.aws.amazon.com/sagemaker/latest/dg/deepar_hyperparameters.html) — AWS | T1 official; current docs | Likelihood choices, prediction horizon and probabilistic/quantile output; provider/version scope. |
| 7 | [A multi-horizon quantile recurrent forecaster](https://www.amazon.science/publications/a-multi-horizon-quantile-recurrent-forecaster) — Amazon Science | T1 original/first-party paper page; 2017 | Quantile forecasts and multi-horizon decision relevance. |
| 8 | [Probabilistic demand forecasting with graph neural networks](https://www.amazon.science/publications/probabilistic-demand-forecasting-with-graph-neural-networks) — Amazon Science | T1 original paper page; 2023 | Cross-article relationships, probabilistic outputs and graph-based extensions; not a Tiki recommendation. |
| 9 | [Robust probabilistic time-series forecasting](https://cdn.amazon.science/aa/ca/c5e6fb2e4053a39174ebc655d1a4/robust-probabilistic-time-series-forecasting.pdf) — Amazon/AWS AI Labs | T1 original paper; 2025/2026 page artifact | Robustness to input perturbation and why uncertainty outputs need robustness tests. |
| 10 | [Amazon Forecast developer guide](https://docs.aws.amazon.com/forecast/latest/dg/forecast.dg.pdf) — AWS | T1 official; current archived/developer guide | Probabilistic forecast/quantile concepts and provider-specific limits. |
| 11 | [The M4 Competition](https://www.sciencedirect.com/science/article/pii/S0169207019301128) — International Journal of Forecasting | T1 original peer-reviewed paper; 2020 | Large-scale comparative evaluation, point plus interval forecasts and competition caveats. |
| 12 | [M4 metrics](https://isf.forecasters.org/wp-content/uploads/gravity_forms/2-dd30f7ae09136fa695c552259bdb3f99/2019/06/M4.pdf) — International Institute of Forecasters | T1 competition material; 2019 | sMAPE/MASE metric context; exact implementations still need local verification. |
| 13 | [M5 competition](https://mcompetitions.unic.ac.cy/the-m5/) — M Competitions / University of Nicosia | T1 competition source; historical M5 | Hierarchical retail demand, uncertainty and Walmart dataset context. |
| 14 | [Forecasting: Principles and Practice, 3rd ed.](https://otexts.com/fpp3/) — Hyndman/Athanasopoulos, OTexts | T2 authoritative open textbook; online updated 2026-03-09 | Method selection, accuracy interpretation and forecasting workflow. |
| 15 | [Time-series cross-validation](https://otexts.com/fpp3/tscv.html) — OTexts | T2 authoritative textbook chapter; online current | Rolling-origin evaluation and why training residuals are not test forecasts. |
| 16 | [Hierarchical and grouped time series](https://www.otexts.com/fpp3/hierarchical.html) — OTexts | T2 authoritative textbook chapter; online current | Product/region hierarchy and coherent forecast requirement. |
| 17 | [Forecast reconciliation](https://otexts.com/fpp3/reconciliation.html) — OTexts | T2 authoritative textbook chapter; online current | Summing matrix and methods to reconcile forecasts. |
| 18 | [Distributional forecast accuracy](https://otexts.com/fpp3/distaccuracy.html) — OTexts | T2 authoritative textbook chapter; online current | Quantile score, CRPS and why point error is insufficient for decisions. |
| 19 | [Forecast accuracy measures](https://otexts.com/fpp3/accuracy.html) — OTexts | T2 authoritative textbook chapter; online current | MAE/MAPE/MASE and metric limitations; exact SMAPE variant still needs local source. |
| 20 | [Forecasting data and methods](https://otexts.com/fpp3/data-methods.html) — OTexts | T2 authoritative textbook chapter; online current | Model choice depends on data, resources and use, not a universal method. |
| 21 | [Demand forecasting under lost-sales stock policies](https://www.sciencedirect.com/science/article/pii/S0169207023000961) — International Journal of Production Economics | T1 peer-reviewed research; 2023 | Stockouts make sales underestimate unobservable demand and create censoring bias. |
| 22 | [A censored-data multiperiod inventory problem](https://pubsonline.informs.org/doi/10.1287/msom.1110.0340) — INFORMS | T1 peer-reviewed research; 2012 | Inventory decisions with censored demand and why naive demand observations are insufficient. |
| 23 | [On the hardness of inventory management with censored demand](https://arxiv.org/abs/1710.05739) — academic original paper | T1 original research; 2017 | Computational/statistical difficulty of censored-demand inventory management. |
| 24 | [Datasets: dividing the original dataset](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets) — Google Developers | T1 official training material; current page | Representative train/validation/test sets, future/generalization and duplicate avoidance. |
| 25 | [Production ML monitoring pipelines](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring) — Google Developers | T1 official training material; current page | Label leakage, data partitioning and monitoring/data drift concerns. |
| 26 | [Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml/) — Google Developers | T1 official guidance; current page | Testing future data and aligning training/serving behavior. |
| 27 | [AI Risk Management Framework 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10) — NIST | T1 official standard/guidance; AI 100-1, 2023 | Govern/map/measure/manage lifecycle risk, testing, monitoring and contingency. |
| 28 | [Probabilistic forecasting for intermittent demand](https://doi.org/10.1016/j.ejor.2024.01.032) — European Journal of Operational Research | T1 peer-reviewed research; 2024 | Intermittent retail demand, probabilistic distributions and trade-off between forecast and inventory performance. |
