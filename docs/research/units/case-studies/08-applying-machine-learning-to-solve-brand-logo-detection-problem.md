# Research — Brand/logo detection for seller image review

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: 08-applying-machine-learning-to-solve-brand-logo-detection-problem
EN file: public/data/case-studies/articles/08-applying-machine-learning-to-solve-brand-logo-detection-problem.html
VI file: public/data/case-studies/articles/08-applying-machine-learning-to-solve-brand-logo-detection-problem.vi.html
Metadata EN/VI: public/data/case-studies/08-applying-machine-learning-to-solve-brand-logo-detection-problem.json, public/data/case-studies/08-applying-machine-learning-to-solve-brand-logo-detection-problem.vi.json

## Scope and non-goals

This case describes a seller-image moderation pipeline that uses Darknet/YOLOv3 to localize logos and ResNet to classify cropped logos, with a human-in-the-loop production role. It is a historical, narrow seven-brand experiment. It is not evidence of general counterfeit detection, trademark infringement adjudication, open-set recognition, or automatic rejection safety.

The research question is: how can a logo detector/classifier assist review while controlling false positives, unknown-brand behavior, adversarial/altered imagery, privacy/IP risk and model drift?

The local HTML contains figures whose exact training details and some metric definitions are not fully represented in text. Those gaps are kept unresolved rather than reconstructed from common YOLO/ResNet conventions.

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| 1-problem-introduction | Seller images, fake products, bot pre-filter and brand violations | Strong business motivation; legal decision boundary is not defined |
| 2-technical-approach | Darknet YOLOv3 localization followed by ResNet crop classification | Core pipeline; training/threshold/calibration details missing |
| 3-dataset-descriptions | Seven brands; Darknet validation 20/brand; ResNet 10%/1,403; training details in figure | Dataset facts partly visible; split/duplication/label policy unresolved |
| 4-evaluation-methods | mAP, precision, recall, F1 and production sample descriptions | Metrics need exact matching/threshold/data definitions |
| 5-performance-of-darknet | 91.73% mAP at IoU .5 and production mixed/unknown results | First-party reported results; tiny validation and class/open-set limits |
| 6-performance-of-darknet-resnet-the-entire-system | Two-stage improvement from 2.18% to .26% wrong known-brand assignment; precision/recall/F1 | Valuable comparative evidence; denominator/threshold/unknown notation needs clarification |
| 7-effectiveness-on-production | Three-month human-review comparison and altered/obscured/removed logos | Human-in-loop insight; production sample size/selection and table data incomplete |
| 8-conclusions | Recommender, not automatic rejection; poor performance on corrupted logos | Strong safety boundary and most reusable conclusion |

EN and VI have the same IDs and content structure. The VI text sometimes uses “accuracy” where EN uses precision; this must be corrected to preserve metric meaning. The local text's reference to “Figure 3” for production appears inconsistent with the visible figure numbering and should be checked before integration.

## What is correct and reusable

- A two-stage detector-plus-classifier can improve precision when localization crops remove background/context and the second model specializes in brand classification. The gain is workload/data dependent.
- A small, explicit known-brand set is a closed-world evaluation, while production images contain unknown brands, no logos, altered logos, multiple logos and non-logo graphics. Unknown handling must be treated as a separate open-set problem.
- Precision, recall and F1 answer different error costs. A moderation recommender normally needs threshold curves and review capacity, not one default threshold.
- A detector mAP at IoU .5 on a small validation set does not establish production safety, robustness to occlusion, or legal correctness.
- Human-in-the-loop recommendation is an important safety boundary. The model can prioritize/flag evidence; a reviewer or policy process decides rejection and appeals.
- The production failure mode—altered, hidden, blurred or removed logos—is not an edge case if sellers can adapt behavior. It is negative evidence against automatic coverage claims.
- Model cards, data lineage, subgroup/error slices, drift monitoring and incident rollback are required for a moderation system because false positives affect sellers and false negatives affect customers/brands.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Seller image verification can help detect fake products/brand violations | First-party motivation | Tiki problem section | Detection is a signal, not legal proof; define review policy and appeals | Medium-to-high |
| Darknet YOLOv3 localizes logos and ResNet classifies crops | First-party implementation fact | Tiki technical approach | Record model versions/configs/weights, crop policy, thresholds and training code | High as local architecture |
| Seven brands are Apple, Adidas, Lego, Nike, Kingston, Calvin Klein and Bosch | First-party dataset fact | Tiki dataset section | Closed-set scope; no claim for other brands or logos | High |
| Darknet validation has 20 images/brand (140 total) and ResNet test/validation has 1,403 images | First-party count | Tiki dataset text/figure | Clarify train/validation/test split, duplicates, image source and label balance | Medium-to-high |
| Darknet reaches 91.73% mAP at IoU .5 | First-party benchmark | Tiki performance section | Standard mAP depends on matching/class/confidence protocol; small validation and one IoU threshold limit generalization | Medium |
| Darknet assigns 2.18% of 10,000 unknown images to one of seven brands | First-party production-like sample result | Tiki performance section | Define unknown sample construction, threshold, “wrong assignment” and confidence calibration | Medium |
| Mixed known/unknown sample yields precision 88.70, recall 93.02, F1 90.62 | First-party result | Tiki figure/table | EN/VI metric labels and denominators need verification; no confidence intervals or class breakdown | Medium |
| Darknet+ResNet lowers unknown wrong assignment from 2.18% to .26% | First-party comparative result | Tiki two-stage section | Keep as local sample result; verify same images, thresholds, crop failures and abstention policy | Medium |
| Two-stage mixed sample yields precision 95.68, recall 92.27, F1 94.01 | First-party result | Tiki two-stage section | Report per-brand/open-set confusion, threshold and review operating point | Medium |
| Production evaluation over three months validates usefulness | First-party deployment narrative | Tiki production section | Add request count, sampling, label quality, time period, reviewer protocol and confidence intervals | Low-to-medium |
| Human is final recommender/decision maker, not automatic rejection | First-party safety conclusion | Tiki conclusion | Preserve as canonical domain boundary unless policy/legal review changes it | High |
| Corrupted/obscured/removed logos are hard to detect | First-party negative evidence | Tiki production/conclusion | Add robustness/abstention/appeal path; do not infer impossible detection | High |
| mAP means logo localized and brand correctly | Local interpretation | Tiki evaluation text; COCO/VOC metrics | State exact evaluator and class/box matching; standard AP is not simply one binary correctness percentage | Low-to-medium |
| Figure 3 is the production result | Local cross-reference | HTML figure numbering | Verify figure asset/alt text; likely editorial reference error | Low |

## Workload, invariants, and failure model

### Workload model

- Seller-submitted product images are heterogeneous in resolution, aspect ratio, background, editing, compression, language and logo visibility.
- The production distribution includes known brands, unknown brands, no logos, counterfeit/altered logos, multiple brands, accessories and brand-like text/graphics.
- The seven-brand training/evaluation set is much narrower than the production open world. Class imbalance, long-tail brands and new counterfeit styles are expected.
- The pipeline has detector latency, crop/resize/normalization, classifier latency, thresholding, queueing and human-review capacity. A high offline score can still create an unmanageable review queue.
- Images may contain seller/customer PII, addresses, faces, barcodes, copyrighted material and trademark evidence; retention/access are part of the system boundary.

### Invariants

1. A model never converts a low-confidence or unknown prediction into a definitive brand/legal claim; it can abstain and route to review.
2. Evaluation splits are image/product/seller separated where leakage would otherwise occur; near-duplicate images cannot cross train/test.
3. Detection and classification metrics use an explicit IoU, confidence threshold, NMS, class mapping and unknown/abstain policy.
4. Every prediction is traceable to model/data/version, input hash, threshold, crop and reviewer outcome without retaining unnecessary raw image content.
5. The review action is auditable, reversible/appealable and separate from model output; automatic rejection is disabled unless a separate risk/legal review authorizes it.
6. Model thresholds are chosen against reviewer capacity and asymmetric error cost, then monitored by brand, image type, seller segment and time.
7. Production drift, adversarial adaptation, corrupt/blank images and service failure result in abstention/manual review rather than silent approval/rejection.
8. Training data has documented licensing/consent, brand labels, annotation quality, provenance and retention policy.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| Detector misses a small/occluded logo | Classifier never sees the evidence; false negative | Localization recall by size/occlusion, multi-crop/abstain and human review |
| Detector crops a logo-like graphic/background | ResNet confidently assigns a known brand | Calibration, hard negatives, unknown class/threshold and evidence overlay |
| Unknown brand resembles a known brand | False positive brand flag/rejection | Open-set threshold, unknown/abstain class, reviewer confirmation |
| Multiple logos/brands occur | Single-label classifier collapses evidence | Multi-label policy, per-crop aggregation and reviewer UI |
| Altered/removed/blurred logo | False negative or nonsensical crop | Robustness set, image-quality check, manual review and adversarial monitoring |
| Train/test near-duplicates or same seller split | Offline metrics inflated | Grouped split by product/seller/image hash and fresh temporal test |
| Confidence threshold changes after deployment | Precision/recall/review load shifts | Versioned threshold, canary, queue SLO and rollback |
| Model/weight/preprocessing mismatch | Silent prediction degradation | Artifact contract, checksum, preprocessing version and shadow evaluation |
| Inference service times out | Moderation backlog or inconsistent decisions | Bounded timeout, retry once only if inference is idempotent, durable queue and manual fallback |
| Reviewer label becomes training data without audit | Feedback loop amplifies bias/errors | Label provenance, adjudication, sampling and versioned retraining |
| Raw image/log access expands | Privacy/IP exposure | Least privilege, encryption, retention and redacted telemetry |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | YOLO/Darknet, ResNet, logo, mAP, precision/recall/F1 | YOLOv3/ResNet papers; COCO API; scikit-learn | Define detection/classification, known/unknown, abstain, IoU and operating point. |
| Invariants | Human-in-loop and seven-brand scope | NIST AI RMF; model-card guidance; Google ML rules | Add split/data lineage, threshold, audit, reviewer and no-automatic-rejection invariants. |
| Workload | 10k/11,313+1,844 samples and corrupted logos | COCO evaluation; Google monitoring | Add open-world, class/quality/size/occlusion/seller and review-capacity distributions. |
| Failure/crash windows | Altered/removed logos noted | Google production ML; OWASP ML/ATLAS | Add crop, unknown, model mismatch, drift, timeout and feedback-loop failures. |
| Retries/timeouts | Not covered | AWS idempotency/backoff; queue guidance | Add inference queue retry, dedupe and manual fallback. |
| Operations/recovery | Three-month production comparison | NIST AI RMF/Playbook; OpenTelemetry | Add threshold/queue/feedback monitoring, rollback and incident process. |
| Security/privacy | Not covered | OWASP MASVS/ML Top 10; NIST Privacy | Add image/PII/IP retention, access, model supply chain and adversarial threat model. |
| Testing | Offline metrics and production sample | COCO/scikit; Google dataset/rules | Add grouped/temporal splits, robustness, open-set, calibration, reviewer agreement and load tests. |
| Domain trade-offs | Human recommender and altered-logo failure | WIPO trademark context; NIST AI RMF | Keep legal/review boundary and asymmetric seller/customer harm explicit. |

## Best-practice comparison

| Local approach | Best-practice comparison | Assessment and boundary |
| --- | --- | --- |
| Darknet detector then ResNet classifier | Cascaded detection/classification can trade recall, precision and latency | Keep as an experiment; measure end-to-end errors, crop loss and review load, not only component scores. |
| mAP at IoU .5 | COCO-style evaluation reports AP across IoU thresholds/size/max detections; VOC .5 is a different convention | Document evaluator and add IoU/size/threshold slices appropriate to logo objects. |
| Seven known brands | Closed-set classification | Add unknown/abstain/open-set evaluation and expand by risk/volume, not arbitrary class count. |
| Unknown-image assignment test | Open-set/error analysis | Strong negative test; define sampling and thresholds, add hard negatives and brand-like non-logo images. |
| Precision/recall/F1 at one operating point | Threshold curves, calibrated confidence and capacity-aware selection | Choose threshold using asymmetric cost and human-review queue SLO. |
| Human recommender | Human-in-loop AI risk control | Preserve; add reviewer agreement, appeals, reason codes and automation boundary. |
| Three-month production comparison | Continuous monitoring and model card | Add drift, subgroup/error slices, versioned labels, rollback and post-deployment validation. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| 91.73% mAP means production-ready logo detection | Small 140-image validation, IoU .5 and closed seven-brand data do not cover open-world images | Use as historical benchmark only; report uncertainty and slices. |
| A known-brand classifier can identify unknown brands | Softmax-like closed-set models tend to assign a known label unless they have abstention/open-set controls | Treat unknown/low-confidence as review, not a brand fact. |
| Higher precision is always better | Raising threshold can reduce recall and miss counterfeit indicators; review capacity and harm are asymmetric | Select a documented operating point and show PR curves/confusion. |
| Two-stage model reduces wrong assignment | Crop failures or shared artifacts can create correlated errors; same test sample may favor the pipeline | Use independent/fresh/robust tests and end-to-end attribution. |
| Three months proves production effectiveness | Sample selection, reviewer labels, seasonality, threshold changes and base rates may be unknown | State what was measured and how labels were audited. |
| Automatic detection equals trademark/counterfeit determination | Legal/brand adjudication requires evidence and policy beyond pixels | Keep human/legal review and appeal boundary. |
| Precision/accuracy terminology is interchangeable | Accuracy, precision, recall and F1 have different denominators | Fix EN/VI metric labels and definitions. |

## Negative evidence and anti-patterns

- Do not extrapolate seven-brand mAP to all brands, counterfeit styles, image sources or geographies.
- Do not treat an unknown image forced into a known class as a correct prediction; measure abstention and open-set error explicitly.
- Do not evaluate near-duplicate product images across train/test or tune thresholds on the final production sample.
- Do not claim a classifier is a legal counterfeit detector or automatically reject sellers from one model score.
- Do not optimize only precision/recall without reviewer load, calibration, class/quality slices and harm analysis.
- Do not use a single confidence threshold across brands with different logo sizes, prevalence and annotation quality without evidence.
- Do not expose raw images, seller identities or trademark evidence in routine logs/traces.
- Do not retrain on unreviewed model decisions or feedback without checking label bias and feedback loops.
- Do not use a detector failure on obscured logos as proof the task is impossible; use it as a boundary for review/robustness work.

## Operational, security, observability and testing concerns

- Prediction SLIs: request latency/error/timeout, detector recall, crop-empty rate, classifier abstain rate, confidence calibration, per-brand precision/recall/F1, unknown assignment, review queue age and auto/manual decision ratio.
- Data/model monitoring: image quality/size/format, seller/brand/region/time slices, drift in embeddings/confidence, near-duplicate rate, label delay, reviewer disagreement and appeal overturn rate.
- Artifact provenance: dataset/version, annotation tool, image hash, model code/weights, preprocessing, threshold/NMS, evaluator version and approval owner.
- Security/privacy: encrypted object storage, short retention, role-based image access, signed model artifacts, dependency scanning, isolation from untrusted image parsing and redacted telemetry.
- Adversarial threats: pasted logos, adversarial perturbations, watermark/occlusion, image recompression, logo-like text and poisoning of seller/reviewer labels. Track threat assumptions rather than claiming robustness.
- Tests: grouped seller/product split, temporal holdout, open-set/unknown, small/occluded/blurred/cropped/multiple logos, hard-negative, calibration, threshold/queue simulation, service timeout/replay, canary and rollback.
- Human controls: show crop/evidence/confidence/model version, permit “unknown/not enough evidence,” record reason codes, sample disagreements for adjudication and support appeal/review.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic computer vision metrics/model definitions | ML/computer-vision fundamentals topic | Keep the Tiki pipeline and evidence caveats; link for metric formulas. |
| AI risk, model cards and security | ML security/AI governance topic | Use current frameworks; own the human-review and marketplace harm boundary. |
| Image moderation/brand protection | This case | Own seven-brand scope, detector→classifier experiment, open-set tests and reviewer workflow. |
| Generic message queue/inference delivery | Topic 08-message-queue | Mention durable inference/retry only where needed; do not duplicate queue semantics. |
| Catalog/seller/product domain | Case 09 Pegasus and commerce cases | Cross-link product/catalog context without repeating API/cache architecture. |

## Integration record (Batch I scope)

Batch I integrated the paired EN/VI evidence qualifier before the conclusions. It requires dataset/split/duplicate/evaluator/IoU/NMS/averaging/unknown/reviewer denominators before interpreting mAP or production observations, and sets the model boundary as a human-reviewed evidence/triage signal rather than an automatic counterfeit or trademark adjudicator.

The Tiki pipeline, seven-brand scope, figures, model names and three-month observation remain preserved. Open-set, occlusion, manipulated-logo, calibration, appeal, privacy, provenance and false-positive-harm evidence remain explicit follow-up requirements.

Gate passed on 2026-08-23: content index rebuild, EN/VI article parity, case-anchor checks, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

1. Add a task/label contract: logo box, brand class, unknown/no-logo/multiple-logo, image-quality failure and reviewer decision.
2. Document exact dataset counts, train/validation/test/group split, duplicate policy, annotation quality and image provenance; keep figure-only unknowns unresolved.
3. Replace unqualified mAP wording with evaluator, IoU threshold(s), NMS/confidence, class averaging and size/occlusion slices.
4. Present Darknet and Darknet+ResNet results in one table with identical samples, thresholds, denominators, confidence intervals and abstention counts.
5. Add open-set/unknown evaluation and threshold/precision-recall/review-capacity curves.
6. Explain that the model is a recommender/evidence signal, not automatic counterfeit or trademark adjudication; preserve human review/appeal.
7. Add production monitoring, model/data/threshold versioning, drift, feedback-loop and rollback requirements.
8. Add privacy/IP/security and adversarial robustness sections for seller images and model artifacts.
9. Correct VI precision/accuracy terminology and verify the Figure 3 cross-reference in both languages.
10. Retain the three-month production result only with sample/label/period details; otherwise mark it as a first-party qualitative deployment observation.

## EN/VI and cross-reference plan

- Preserve all eight IDs and model names. Keep YOLOv3, Darknet, ResNet, mAP, IoU, precision, recall and F1 unchanged in code/metric labels.
- Add a shared bilingual glossary for detector, classifier, crop, known/unknown, open set, abstain, confidence, threshold, false positive/negative, reviewer and appeal.
- Correct the VI “accuracy” translations to the exact English metric where applicable; do not translate metric denominators loosely.
- Apply the human-in-loop/legal boundary and unknown-data caveat identically in EN/VI.
- Link generic CV/AI-risk topics to canonical owners; link this case from marketplace moderation/brand-protection content.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| What evaluator/code produced 91.73% mAP? | Training/eval script, config, weights and dataset manifest | Recalculation under the stated protocol differs materially or uses leakage. |
| Are splits grouped by seller/product and temporally separated? | Manifest and image hashes | Near duplicates or same product appear in train/test and the result collapses on a fresh set. |
| What do “unknown” and “wrong assignment” mean? | Label schema, threshold and confusion matrix | Unknown set is actually known-brand data or metric excludes abstentions/crop failures. |
| Are two-stage gains on independent identical samples? | Paired evaluation manifest and per-stage errors | Gain disappears on fresh/occluded/open-set samples or comes from changed thresholds. |
| How large and representative was production traffic? | Request count, sampling, three-month timeline and reviewer labels | Production precision/recall/review load differs materially from the reported sample. |
| What is the acceptable false-positive harm to sellers? | Policy/legal/appeal requirements and cost matrix | Model threshold cannot meet seller-fairness/review/appeal constraints. |
| Can images/model artifacts be retained and accessed safely? | Data inventory, retention and threat model | Privacy/IP/security controls cannot isolate raw images or model supply chain. |
| What is the auto-action boundary? | Product policy and human-review design | Any automatic rejection is required without calibrated evidence and appeal. |

## Discovery pool and exclusions

The discovery pool contained approximately 49 candidates; 27 distinct sources were selected. Duplicate YOLO/ResNet mirrors, generic computer-vision tutorials, leaderboard/marketing pages, unverified “mAP explained” posts and unrelated brand-protection SEO pages were excluded. The final ledger prioritizes the Tiki first-party case, original YOLO/ResNet papers, official evaluation code, NIST/OWASP AI-risk guidance and first-party ML testing/monitoring documentation.

## Sources

All sources were reviewed on 2026-08-23. Model and evaluator versions are recorded because YOLO/Darknet, ResNet implementations and metric protocols are not interchangeable.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Applying machine learning to brand logo detection](https://engineering.tiki.vn/applying-machine-learning-to-solve-brand-logo-detection-problem/) — Tiki Engineering | T1 first-party; historical article, revision not stated | Business problem, seven brands, Darknet→ResNet pipeline, local metrics, production observation and human-in-loop conclusion. |
| 2 | [Darknet repository](https://github.com/pjreddie/DARKNET) — Joseph Redmon / Darknet | T1 first-party project; repository revision not pinned | Darknet framework provenance and historical YOLO implementation context. |
| 3 | [YOLO: real-time object detection](https://pjreddie.com/darknet/yolo/) — Darknet project | T1 first-party project page; current page | YOLO/Darknet usage and model-family context; not evidence for Tiki's benchmark. |
| 4 | [YOLOv3](https://arxiv.org/abs/1804.02767) — Redmon and Farhadi | T1 original paper; 2018 | YOLOv3 architecture/evaluation context and version distinction. |
| 5 | [Deep residual learning for image recognition](https://openaccess.thecvf.com/content_cvpr_2016/html/He_Deep_Residual_Learning_CVPR_2016_paper.html) — He et al., CVPR | T1 original peer-reviewed paper; 2016 | ResNet residual architecture and benchmark provenance. |
| 6 | [COCO evaluation API](https://github.com/cocodataset/cocoapi/blob/master/MatlabAPI/CocoEval.m) — COCO Dataset | T1 official evaluation code; current master | IoU thresholds .50:.05:.95, precision/recall arrays, area ranges and max detections. |
| 7 | [COCO dataset/detection task](https://cocodataset.org/dataset/detection-2017.htm) — COCO | T1 first-party dataset; 2017 task | Standard detection-task context; Tiki's 140-image test is not COCO-comparable. |
| 8 | [scikit-learn metrics API](https://scikit-learn.org/stable/api/sklearn.metrics.html) — scikit-learn | T1 official; 1.9.0 docs at review | Precision, recall, F1 and average-precision API definitions. |
| 9 | [Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html) — scikit-learn | T1 official; 1.9.0 docs | Classification metric denominators and multiclass averaging caveats. |
| 10 | [Dataset splitting](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets) — Google Developers | T1 official training material; current page | Separate representative train/validation/test sets and duplicate avoidance. |
| 11 | [Production ML monitoring pipelines](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring) — Google Developers | T1 official training material; current page | Leakage, partition isolation, monitoring and production data drift. |
| 12 | [Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml/) — Google Developers | T1 official guidance; current page | Training/serving consistency, test data over time and production ML discipline. |
| 13 | [AI Risk Management Framework 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10) — NIST | T1 official; AI 100-1, 2023 | Govern/map/measure/manage functions and lifecycle risk controls. |
| 14 | [AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — NIST AIRC | T1 official; excerpt of AI RMF 1.0 | Continuous risk management, contingency processes and model evaluation. |
| 15 | [AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/) — NIST AIRC | T1 official; current playbook | Suggested actions for governance, measurement, testing and incident management. |
| 16 | [OWASP Machine Learning Security Top 10](https://owasp.org/www-project-machine-learning-security-top-10/) — OWASP | T1 security guidance; current project version | ML-specific threats such as data poisoning, model theft, input manipulation and supply chain. |
| 17 | [MITRE ATLAS](https://atlas.mitre.org/) — MITRE | T1 threat knowledge base; current site | Adversarial ML tactics/techniques and threat-model vocabulary. |
| 18 | [Model Cards for Model Reporting](https://modelcards.withgoogle.com/about) — Google | T1 first-party model-reporting guidance; current site | Intended use, limitations, performance slices and transparent model documentation. |
| 19 | [TensorFlow object detection COCO evaluation](https://github.com/tensorflow/models/blob/master/research/object_detection/metrics/coco_evaluation.py) — TensorFlow | T1 official implementation; repository revision not pinned | How a common implementation surfaces AP/AR and IoU evaluation. |
| 20 | [Torchvision object detection finetuning](https://pytorch.org/tutorials/intermediate/torchvision_tutorial.html) — PyTorch | T1 official tutorial; current docs | Dataset/annotation/evaluation pipeline example; not evidence for Tiki results. |
| 21 | [NIST Privacy Framework](https://www.nist.gov/privacy-framework) — NIST | T1 official framework; current | Privacy risk/data lifecycle controls relevant to seller images and identifiers. |
| 22 | [OWASP MASVS](https://mas.owasp.org/MASVS/) — OWASP | T1 security standard; current project version | Mobile/service storage, network, code and platform-interaction controls where images are processed. |
| 23 | [Trademark protection](https://www.wipo.int/en/web/trademarks) — WIPO | T1 first-party international organization; current | Trademark/legal context; pixels/model scores are not legal adjudication. |
| 24 | [WIPO anti-counterfeiting resources](https://www.wipo.int/en/web/enforcement) — WIPO | T1 first-party; current page | Enforcement/evidence context and need for policy/legal process. |
| 25 | [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — OpenTelemetry | T1 specification; semconv 1.44.0 registry | Telemetry naming for HTTP, model service, events and errors. |
| 26 | [HTTP semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/) — OpenTelemetry | T1 specification; mixed stability | Service latency/error instrumentation and versioned convention caveat. |
| 27 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — Amazon Builders’ Library | T1 first-party; current article | Idempotent inference submission/replay and late response handling. |
