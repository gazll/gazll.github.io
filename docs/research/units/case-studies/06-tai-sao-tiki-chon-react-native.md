# Research — Why Tiki chose React Native

Status: `INTEGRATED`
Reviewed: 2026-08-23
Local unit: 06-tai-sao-tiki-chon-react-native
EN file: public/data/case-studies/articles/06-tai-sao-tiki-chon-react-native.html
VI file: public/data/case-studies/articles/06-tai-sao-tiki-chon-react-native.vi.html
Metadata EN/VI: public/data/case-studies/06-tai-sao-tiki-chon-react-native.json, public/data/case-studies/06-tai-sao-tiki-chon-react-native.vi.json

## Scope and non-goals

This case records a historical Tiki decision to use native, cross-platform and hybrid approaches together, with React Native selected for certain modules. The decision was made in a particular framework ecosystem, hiring market, product portfolio and team context. It should not be rewritten as a current universal recommendation for React Native, Flutter, native code or WebView.

The research question is: when does a per-module choice of native, React Native/Flutter-like cross-platform UI or WebView reduce total product risk, and what compatibility, performance, security and ownership contracts make a mixed app sustainable?

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| native-app | Java/Kotlin/Objective-C/Swift platform-specific development and performance/SDK advantages | Correct historical trade-off; “performance advantage” needs workload scope |
| cross-platform | Shared language/code and React Native/Flutter; speed/resources versus dependencies/bridge/performance | Good comparison; version/date and module-compatibility caveats needed |
| hybrid-app | Native shell with WebView; reuse website versus performance/customization | Correct category; security/privacy and navigation constraints are underdeveloped |
| mo-hinh-da-modules-ket-hop-voi-cross-platform | Per-feature/module technology choice; Livestreaming Video modules in RN | Core Tiki architecture; module boundary/dependency contract needs detail |
| loi-ich | Native-only, cross-platform-only and hybrid trade-offs | Useful decision framing; some claims are subjective/absolute |
| nhung-han-che | App size as the named cross-platform limitation | Incomplete: bridge/native modules, upgrade, profiling, memory and testing also matter |
| tai-sao-tiki-chon-react-native | Flutter maturity at decision time and existing ReactJS talent | First-party historical rationale; must not be projected onto current versions |

The EN and VI files have identical IDs and structure. The VI text mixes English technology terms, which is appropriate for API names but should be normalized for concepts such as bridge, native module, WebView and module boundary.

## What is correct and reusable

- “Native versus cross-platform” is not a binary application-wide choice. A module boundary can isolate a performance-sensitive or platform-specific surface while sharing business/UI code elsewhere.
- Reuse has several dimensions: source code, design system, team skills, release pipeline, native platform behavior and third-party dependency maintenance. Sharing code does not remove platform testing.
- React Native still requires native code for platform services and unsupported/high-performance components. Current documentation describes native modules/components and a continuing migration from legacy APIs to the New Architecture.
- WebView reuse is valuable for content or flows where the web surface is authoritative, but it has a different rendering, lifecycle, security and offline/performance contract from native UI.
- Framework choice is time-dependent. The local reason “existing ReactJS talent and Flutter was too new” is a valid historical decision input, not a present-day framework comparison.
- A mixed architecture works only when modules have explicit ownership, navigation/auth/state contracts, performance budgets, native dependency policies and release/version compatibility tests.

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| Native apps use platform-specific languages and have direct SDK/performance advantages | General technical framing | Tiki article; Apple/Android docs | Performance depends on workload, implementation and profiling; direct SDK access is an integration advantage, not a guarantee | High |
| Cross-platform enables code/resource/team reuse and faster delivery | General/product claim | Tiki article; RN/Flutter architecture docs | Reuse percentage, native module work and testing cost determine actual benefit | Medium-to-high |
| Cross-platform has third-party dependency, update and native bridge risks | General technical claim | Tiki article; RN native/new architecture docs; Flutter channels | Scope to framework/version/library compatibility; do not imply every module has the same bridge overhead | High |
| Hybrid WebView reuses website code but may have performance/customization limitations | General technical claim | Tiki article; Android WebView/security docs; hybridization research | Include untrusted content, bridge security, offline behavior, memory and native/web navigation boundaries | High |
| Tiki used all three approaches and selected per module | First-party historical fact | Tiki article and series intro | Define which module types and decision criteria; current Tiki architecture is unknown | High as historical claim |
| Livestreaming Video Home/Profile/Game modules used React Native | First-party historical fact | Tiki module section | Keep as historical example; do not infer all video performance was cross-platform | Medium-to-high |
| Flutter was too new for Tiki at the decision time | First-party historical rationale | Tiki article | Add decision date and Flutter version/ecosystem evidence; this is not a current maturity statement | High as reported rationale |
| Existing ReactJS programmers made React Native attractive | First-party organizational rationale | Tiki article | Skill reuse lowers staffing cost but does not prove native/platform competence | High as rationale |
| Cross-platform-only creates future framework/performance risk | Recommendation/inference | Tiki article | Risk depends on framework governance, upgrade path, native escape hatch and product requirements | Medium |
| The main limitation is increased app size | Incomplete first-party observation | Tiki nhung-han-che | Add startup, memory, frame time, bridge/native-module, dependency, binary/privacy and test costs | Low as exhaustive claim |
| React Native New Architecture is now default/available in modern releases | Current external fact | RN official docs, reviewed 2026 | Version scope: RN 0.76+ New Architecture by default; library compatibility still matters | High |
| RN/Flutter can deliver native-feeling performance | Provider claim with conditions | RN performance; Flutter architecture | Measure frame budget, device tier, JS/Dart work, animations, bridge/platform calls; no universal guarantee | Medium |

## Workload, invariants, and failure model

### Workload model

- Features include standard commerce screens, high-interaction/livestreaming surfaces, native camera/media/push/payment/device APIs and web-reused content.
- Devices vary in CPU/GPU, memory, OS version, network quality, locale, screen size and background/lifecycle behavior.
- The organization has multiple native and JavaScript teams; framework/module upgrades create a dependency and release coordination workload.
- The mixed app may have several runtimes and rendering pipelines in one binary. Startup, memory, binary size, analytics, navigation and authentication costs can be shared even when code is modular.
- Network/API work is asynchronous and failure-prone regardless of UI framework; retries must be bounded and idempotent at the data/API layer rather than triggered by repeated taps or lifecycle recreation.

### Invariants

1. Every module has a stable ownership/API boundary, supported platform/version matrix and an explicit native escape hatch.
2. Navigation, authentication, deep links, analytics, accessibility, localization, back behavior and state restoration are consistent across native/RN/WebView boundaries.
3. UI meets a declared frame-time budget on target low/mid/high device tiers; performance is measured in release-like builds, not only development mode.
4. Native modules and third-party packages are compatible with the selected RN/Flutter/framework version and architecture; upgrades are gated by build and runtime tests.
5. WebView content is authenticated/authorized, origin-restricted, updated, isolated and prevented from invoking unsafe native bridges.
6. A module failure degrades or contains the feature without corrupting shared session/auth/order state.
7. Network requests have deadlines, cancellation, retry policy and idempotency semantics; a screen remount must not duplicate mutations.
8. Build/release produces one auditable artifact with dependency provenance, privacy manifests/permissions and reproducible native/JS assets.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| JS/Dart bundle loads while native module version is incompatible | Startup crash, missing feature or silent no-op | Versioned native-module contract, startup health check and compatibility matrix |
| Legacy bridge queues a large payload or synchronous native call | Dropped frames, input lag or memory pressure | Payload limits, profiling, background/native worker path and frame-budget tests |
| New Architecture migration leaves a library on legacy APIs | Build/runtime failure on one platform | Library support inventory, interop policy and staged rollout |
| WebView loads stale/partial/untrusted content | Broken flow, data exposure or bridge exploit | Origin allowlist, HTTPS, CSP/web security, minimal bridge and kill switch |
| Module upgrade changes navigation/auth lifecycle | Lost session, duplicate screen/analytics or deep-link failure | Contract tests across module boundaries and state restoration tests |
| Native dependency or OS SDK update breaks one platform | Release block or platform-specific regression | Pin/upgrade policy, matrix CI, canary and rollback |
| Network timeout occurs after mutation is accepted | Duplicate order/payment/action on retry | Idempotency key, server status query, cancellation and user-visible pending state |
| Mixed runtimes increase binary/startup/memory load | Low-end devices kill process or experience jank | Per-module budgets, startup tracing, memory pressure tests and feature flags |
| Team stops maintaining a cross-platform package | Security/update gap or forked native code | Ownership, dependency health score, replacement/retirement plan |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Native, cross-platform, hybrid, module | RN/Flutter architecture; Android WebView | Define runtime, bridge, native module/component, WebView boundary and module ownership. |
| Invariants | Per-module choice and reusable code implied | Android modularization; RN native platform | Add navigation/auth/version/performance/security contracts. |
| Workload | Commerce app, livestream modules, team skill context | RN performance; Flutter architecture | Add device tiers, frame budget, startup/memory/network and release workloads. |
| Failure/crash windows | Dependencies/update/performance mentioned | RN New Architecture; WebView security; hybrid research | Add bridge, WebView, lifecycle, upgrade and mixed-runtime failures. |
| Retries/timeouts | Not covered | gRPC/RN network practices; AWS idempotency | Add UI mutation retry/cancellation/idempotency boundary. |
| Operations/recovery | Framework choice rationale only | RN release/architecture docs; SRE practices | Add dependency ownership, upgrade/canary/rollback and kill switches. |
| Security/privacy | Barely covered | Android WebView bridge guidance; OWASP MASVS/MASTG | Add origin/bridge/PII/permissions/secrets and supply-chain controls. |
| Testing | No systematic matrix | RN testing docs; Android/iOS testing docs | Add module contract, platform matrix, performance, accessibility and release-like tests. |
| Domain trade-offs | Speed/reuse vs performance/control | RN/Flutter current docs and hybrid research | Keep time-scoped choice matrix and avoid universal framework claims. |

## Best-practice comparison

| Option | Strengths | Costs/limits and when it fits |
| --- | --- | --- |
| Native per platform | Direct SDK/accessibility/platform behavior and maximum control | Two implementation tracks, duplicated feature work and staffing; strongest for platform-specific/high-performance surfaces. |
| React Native | Shared JS/React code with native modules/components and a mature production path | JS/UI frame budget, package/architecture compatibility, native escape hatches and two-platform testing remain. |
| Flutter | Shared Dart/UI/rendering stack with platform channels and module embedding | Different ecosystem/skills, platform channel work, rendered-widget fidelity/accessibility and binary/runtime trade-offs; decision is version-specific. |
| WebView hybrid | Reuse web content and web release path | Browser lifecycle/security/bridge/offline/performance constraints; suitable when web is the source of truth and native integration is narrow. |
| Mixed modules | Choose the best fit per feature and contain risk | More runtimes, build/dependency complexity, navigation/auth/analytics consistency and larger operational test matrix. |

The article's mixed strategy is therefore a reasonable domain architecture, but only if the organization pays the integration tax deliberately.

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| Cross-platform is faster because code is shared | Native modules, library migration, platform QA and debugging can consume the saved coding time | Measure total lead time and maintenance, not line-of-code reuse. |
| Native is always faster | Platform-specific code can be poorly implemented; RN/Flutter can meet a frame budget for many screens | Benchmark representative interactions on target devices. |
| WebView reuses the website cheaply | Web/native bridges, auth, cookies, offline, accessibility and security add integration work | Use a restricted WebView contract and total-cost estimate. |
| One framework avoids duplicated technology | A single framework can create a common-mode upgrade/performance failure | Mixed modules can be safer, but increase integration surface. |
| Flutter was too new | Current Flutter and RN versions are materially different from the historical decision point | Keep the rationale dated and re-evaluate with current versions. |
| New Architecture removes bridge limitations | Native modules/libraries still need migration and performance depends on payload/work | Treat architecture migration as a compatibility project, not a free speedup. |
| App size is the main limitation | Startup, memory, frame time, package health, privacy and testing can dominate | Expand limitations section with measured budgets. |

## Negative evidence and anti-patterns

- Do not choose a framework from a benchmark on a different device, release mode, screen complexity or version.
- Do not place a high-frequency/large-payload interaction across a bridge without measuring serialization, scheduling and frame impact.
- Do not allow arbitrary WebView content to call broad native bridges or access tokens/cookies by default.
- Do not mix native/RN/WebView screens without a shared navigation, auth, analytics, accessibility and error contract.
- Do not assume ReactJS skills remove the need for Android/iOS lifecycle, signing, permissions, store and native debugging expertise.
- Do not migrate to a new architecture or framework version without auditing every native dependency and running both platforms.
- Do not retry a mutation on every screen focus/remount; lifecycle and network retry need server-side idempotency.
- Do not measure only the happy-path high-end device; low-end memory pressure and poor networks often determine real UX.

## Operational, security, observability and testing concerns

- Module registry: owner, platform support, framework version, native dependencies, New Architecture status, permissions, binary size, startup cost, SLO and deprecation date.
- Performance telemetry: JS/UI frame time, dropped frames, startup stages, memory/GC, bridge/native call latency, network queue, WebView load and device tier.
- Release safety: pin JS/native dependencies, lockfile and Gradle/Pods versions, build provenance, staged rollout, feature flags, crash-free sessions and fast rollback.
- WebView security: HTTPS/origin allowlist, certificate policy, safe navigation, minimal typed bridge, no sensitive token injection into arbitrary JS, content security policy and patch cadence.
- Privacy: minimize identifiers in JS/native logs, review permissions, isolate third-party packages, protect local storage/cookies and document data flows across runtimes.
- Tests: shared module contract tests, native unit/instrumentation tests, RN/Flutter component tests, WebView hostile-content tests, accessibility/localization, deep links, offline/resume, low-memory, background/foreground and release-like performance.
- Network reliability: request deadlines, cancellation on unmount, dedupe/idempotency, retry budget with jitter, offline queue where appropriate and explicit pending state.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic mobile architecture and framework comparison | Mobile architecture topic | Keep the Tiki decision matrix and dated rationale; link to generic principles. |
| React Native mechanics/current migration | Official RN docs / mobile framework topic | Cite current behavior; do not duplicate the full New Architecture guide. |
| Android/iOS native lifecycle/security | Platform-specific topics | Mention boundary requirements and link out. |
| WebView security | Mobile security/WebView topic | Keep the hybrid decision trade-off and link to canonical security guidance. |
| Mixed-module strategy and Tiki Livestreaming example | This case | Own module-level selection, organizational rationale and historical scope. |

## Integration record (Batch H scope)

Batch H integrated a paired EN/VI qualifier after the historical result paragraph. It preserves the Tiki decision while stating its date/scope boundary: React Native is not a universal current winner; framework versions, New Architecture status, native-module compatibility, platform depth, device-tier budgets, dependency health, ownership, release/testing and rollback contracts must be evaluated.

The qualifier also separates the article's team judgment about performance from a benchmark and makes the multi-module choice conditional on explicit navigation, auth/session, state-restoration, accessibility, offline, native-boundary and lifecycle tests. Existing anchors, figures, series links and article structure were preserved.

Gate passed on 2026-08-23: content index rebuild, EN/VI article parity, case-anchor checks, `validate-content.mjs --stats`, complete `check.mjs`, and `git diff --check` succeeded.

## Proposed follow-up changes

1. Add a decision table with criteria: platform API depth, frame budget, offline needs, team skill, time-to-market, dependency health, binary/startup budget and long-term ownership.
2. Date the Flutter/React Native comparison and state that framework maturity is version-specific.
3. Expand the hybrid section with WebView origin/bridge/security, cookie/auth, offline, accessibility and lifecycle constraints.
4. Add the module contract: navigation, auth/session, analytics, error, state restoration, native APIs and release compatibility.
5. Expand limitations beyond app size: startup, memory, frame time, bridge payload, native-module maintenance, upgrade risk, dependency supply chain and test matrix.
6. Add a current-version note: RN New Architecture availability/default status and migration obligations, without rewriting the historical reason Tiki chose RN.
7. Add performance and reliability test requirements for Livestreaming/interactive modules and low-end devices.
8. Add network retry/idempotency guidance for mutations and prevent lifecycle-triggered duplicates.
9. Keep EN/VI structure identical and cross-link the series parts only when those local files are available; do not invent their content.

## EN/VI and cross-reference plan

- Preserve all seven IDs and the series links. Keep React Native, Flutter, WebView, Java, Kotlin, Objective-C, Swift, Fabric and TurboModule unchanged.
- Standardize translations for native module, native component, bridge, platform channel, module boundary, frame budget, startup, binary size, dependency compatibility and origin allowlist.
- Apply the same historical/version caveats in both languages; current docs should not be translated as if they described Tiki's original decision.
- Link generic mobile/framework and security topics to the canonical owner; link this case from them for Tiki's mixed-module evidence.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| When exactly was the RN/Flutter decision made and which versions were evaluated? | Architecture decision record, package manifests and release history | The stated “Flutter too new” rationale does not match the actual decision date/tooling. |
| Which modules use which runtime today? | Module inventory and dependency graph | Shared runtime boundaries create unowned cross-platform regressions or untestable coupling. |
| What performance budget did Livestreaming require? | Device-tier traces and user metrics | RN module misses frame/startup/memory SLO and native alternative materially improves it. |
| How many native dependencies lack current architecture support? | Dependency compatibility matrix | Upgrade requires forks/unmaintained packages that outweigh code reuse. |
| How is WebView content/auth isolated? | Threat model, bridge code and cookie/token flow | Untrusted content can invoke sensitive native actions or expose user/session data. |
| Does mixed architecture reduce total lead time? | Ownership/maintenance/incident and release metrics | Integration/testing/upgrade cost exceeds savings from shared code. |
| Are network retries idempotent? | API contracts and duplicate mutation telemetry | Lifecycle/network retries produce duplicate orders/payments/actions. |

## Discovery pool and exclusions

The discovery pool contained approximately 46 candidates; 27 distinct sources were selected. Duplicate RN/Flutter overview pages, framework marketing benchmarks, SEO comparisons and unreviewed community snippets were excluded. The ledger prioritizes Tiki's original decision, current official React Native/Flutter/Android/iOS documentation, security guidance and an original hybridization study.

## Sources

All sources were reviewed on 2026-08-23. Current framework statements are version-scoped and do not retroactively validate the historical Tiki decision.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [Why Tiki chose React Native](https://engineering.tiki.vn/tai-sao-tiki-chon-react-native/) — Tiki Engineering | T1 first-party; historical article, revision not stated | Native/cross-platform/hybrid comparison, mixed modules, Livestreaming example and historical rationale. |
| 2 | [How Tiki uses React Native](https://engineering.tiki.vn/tiki-su-dung-react-native-nhu-the-nao/) — Tiki Engineering | T1 first-party; series introduction, historical | Series context and the boundary of the assigned article; parts 2–4 are not local assigned units. |
| 3 | [React Native performance overview](https://reactnative.dev/docs/performance) — React Native | T1 official; page last updated 2026-08-12 | Frame budgets, JS/UI thread distinction and performance troubleshooting. |
| 4 | [React Native native platform](https://reactnative.dev/docs/native-platform) — React Native | T1 official; page last updated 2026-08-12 | Native modules/components, legacy APIs and New Architecture migration. |
| 5 | [About the New Architecture](https://reactnative.dev/architecture/landing-page) — React Native | T1 official; current page | Motivation, production scale claim and architecture scope. |
| 6 | [The New Architecture is here](https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here) — React Native/Meta | T1 first-party; 2024-10-23, RN 0.76 | New Architecture default, direct native interfaces and migration requirement. |
| 7 | [React Native testing overview](https://reactnative.dev/docs/testing-overview) — React Native | T1 official; current docs | Unit/component/integration/E2E testing layers. |
| 8 | [React Native releases](https://reactnative.dev/blog) — React Native | T1 first-party; current release archive | Version cadence and why historical framework claims need a date/version. |
| 9 | [Expo Modules API overview](https://docs.expo.dev/modules/overview/) — Expo | T1 official; current docs | A maintained native-module integration option; provider-specific, not a Tiki fact. |
| 10 | [Flutter architectural overview](https://docs.flutter.dev/resources/architectural-overview) — Flutter | T1 official; current docs | Layered rendering, embedders, compilation and platform integration. |
| 11 | [Flutter platform channels](https://docs.flutter.dev/platform-integration/platform-channels) — Flutter | T1 official; current docs | Dart/native channel boundary, serialization and platform code. |
| 12 | [Flutter app architecture](https://docs.flutter.dev/app-architecture) — Flutter | T1 official; current docs | Feature/repository/service architecture and maintainability context. |
| 13 | [Flutter performance](https://docs.flutter.dev/perf) — Flutter | T1 official; current docs | Performance profiling and version-specific optimization guidance. |
| 14 | [Android app modularization](https://developer.android.com/topic/modularization) — Android Developers | T1 official; last updated 2026-03-05 | Module boundaries, ownership, testability, build benefits and granularity pitfalls. |
| 15 | [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview) — Android Developers | T1 official; current docs | Web content embedding, lifecycle and platform integration. |
| 16 | [Insecure WebView native bridges](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges) — Android Developers | T1 official security guidance; current page | Bridge exposure, untrusted content and native-call risks. |
| 17 | [Reduce app size](https://developer.android.com/topic/performance/reduce-apk-size) — Android Developers | T1 official; current docs | APK/AAB size trade-offs and measurement; does not prove framework-specific size. |
| 18 | [UIKit](https://developer.apple.com/documentation/uikit) — Apple Developer | T1 official; current platform docs | Native iOS UI/lifecycle/platform boundary; exact OS version is app-specific. |
| 19 | [OWASP MASVS](https://mas.owasp.org/MASVS/) — OWASP | T1 security standard; current project version | Mobile storage, platform interaction, network and code-quality controls. |
| 20 | [OWASP MASTG WebViews](https://mas.owasp.org/MASTG/knowledge/android/MASVS-PLATFORM/MASTG-KNOW-0012/) — OWASP | T1 security testing guide; current page | WebView/native bridge testing and attack surface. |
| 21 | [A large-scale analysis of Android-Web hybridization](https://arxiv.org/abs/2008.01725) — academic original study | T1 original research; 2020 | Evidence that hybrid apps can create sensitive data flows between Android and JavaScript; context-specific, not universal prevalence. |
| 22 | [BabelView: code injection attacks in mobile WebViews](https://arxiv.org/abs/1709.05690) — academic original study | T1 original research; 2017 | WebView code-injection threat model and why bridge/content isolation matters. |
| 23 | [Android app links](https://developer.android.com/training/app-links) — Android Developers | T1 official; current docs | Verified/deep-link behavior and security boundaries. |
| 24 | [Android app architecture guide](https://developer.android.com/topic/architecture) — Android Developers | T1 official; current docs | Layered architecture, lifecycle and state-management concerns across modules. |
| 25 | [React Native New Architecture interop](https://github.com/reactwg/react-native-new-architecture/blob/main/docs/turbo-modules.md) — React Native Working Group | T1 first-party project docs; revision not pinned | Legacy bridge/TurboModule migration and typed native integration scope. |
| 26 | [Flutter FAQ](https://docs.flutter.dev/resources/faq) — Flutter | T1 official; current docs | Performance depends on app architecture and platform-channel usage. |
| 27 | [gRPC performance best practices](https://grpc.io/docs/guides/performance/) — gRPC | T1 official; current docs | Reusing channels, concurrency and connection/stream limits; supporting evidence for network contracts, not UI framework choice. |
