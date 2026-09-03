# Research — O(1) Android build time at Tiki

Status: INTEGRATED
Reviewed: 2026-08-23
Local unit: `04-o1-android-build-time-at-tiki`
EN file: `public/data/case-studies/articles/04-o1-android-build-time-at-tiki.html`
VI file: `public/data/case-studies/articles/04-o1-android-build-time-at-tiki.vi.html`
Metadata EN/VI: `public/data/case-studies/04-o1-android-build-time-at-tiki.json`, `public/data/case-studies/04-o1-android-build-time-at-tiki.vi.json`

## Scope and non-goals

This case studies a selective local Android debug build in a modular Tiki app. The “O(1)” title is a useful intuition for reducing the amount of feature code touched by a local change, but it is not a formal asymptotic guarantee for the whole build graph, release builds, CI, configuration time, dependency resolution, resource processing or APK installation.

The research question is: how can a large modular Android project shorten the feedback loop without producing a partial artifact that hides compile/runtime failures or allowing fake dependency sources to drift from the real application?

## Local content map

| EN/VI section ID | Local subject | Evidence status |
| --- | --- | --- |
| `the-problem` | `:data` changes trigger a 5–8 minute whole-project rebuild; 10–20 builds/day | First-party developer report; historical baseline and workstation details are incomplete |
| `the-solution` | `./gradlew :app:installDebug -Ponly="home"` excludes unrelated feature modules | Core technique; must distinguish task selection from dependency closure |
| `implementation-detail` | Missing activity/Dagger references; optional bindings, fake source set and deep link | Reusable implementation pattern; drift and safety constraints need emphasis |
| `the-result` | Three modules compile, debug build takes 1–2 minutes, APK is smaller, “O(1)” framing | First-party result; no controlled benchmark or full-build comparison table |
| `the-next-step` | Target of 15 seconds | Historical aspiration, not a verified outcome |

EN and VI have the same structure and code samples. Headings are English in both files. The sample repository is `https://github.com/nlgtuankiet/modularization`; its revision should be pinned before using it as a reproducibility artifact.

## What is correct and reusable

- Modularization can reduce compile avoidance scope when a change touches only a feature's dependency closure. Android's current guidance explicitly connects modules with incremental, cached and parallel builds, while also warning that over-granularity adds overhead.
- A selective task/feature build is a developer workflow optimization, not a replacement for full build, integration-test and release gates.
- If the app module references excluded feature classes, a compile-only optional binding or generated/fake source can make the selected graph compile. This is safe only when the fake cannot be shipped accidentally and the real module is tested separately.
- Deep-linking directly into a selected feature reduces manual navigation time, but it must be guarded by an explicit debug/test contract and should not be treated as a production navigation bypass.
- Build time needs a decomposition: configuration, dependency resolution, compilation, annotation/code generation, resource processing, packaging, install and runtime startup. A smaller APK or fewer compile tasks does not prove every part is faster.
- The strongest generalizable lesson is “measure the dependency graph and optimize the local feedback loop,” not “all large Android builds are O(1).”

## Claims to verify or qualify

| Local claim | Classification | Evidence / scope | Required qualification | Confidence |
| --- | --- | --- | --- | --- |
| A shared `:data` change caused a 5–8 minute full rebuild | First-party historical measurement | Tiki `the-problem` | Add device/OS/Gradle/AGP/JDK, clean vs warm, daemon/cache and task breakdown | Medium |
| Developers build 10–20 times/day and lose 50–160 minutes | First-party derived estimate | Tiki arithmetic | Label as an illustrative estimate based on the reported range; not an organization-wide telemetry metric | Medium |
| `-Ponly` compiles only the selected feature and its required modules | First-party implementation claim | Tiki solution/sample | Explain dependency closure, configuration tasks and generated resources; verify with Gradle task graph/profile | High as technique; scope incomplete |
| Only three modules need recompilation after a data change | First-party result | Tiki article | Add exact task graph and note that configuration/resource/package/install tasks may remain | Medium |
| Fake source plus `@BindOptionalOf` solves missing references | First-party implementation claim | Tiki implementation/sample; Dagger docs | Scope to the specific Dagger version and source-set wiring; ensure fake is debug-only and cannot mask real integration failures | Medium-to-high |
| The selective build is O(1) | Inference/teaching shorthand | Tiki title/result | Replace with “approximately constant with respect to unrelated feature count under a fixed dependency closure”; full graph is not constant | Low-to-medium |
| Selective debug APK is smaller | First-party observation | Tiki result | Debug packaging and feature inclusion differ from release/AAB; do not infer production size or performance | Medium |
| Build time falls to 1–2 minutes | First-party historical benchmark | Tiki result | Add warm/cold state, machine, build variant, install time and sample size | Medium |
| The next goal is 15 seconds | First-party aspiration | Tiki next step | Keep as historical next step, not result or promise | High |
| Modern Gradle/Android tooling can improve the same bottleneck | External guidance | Android/Gradle docs reviewed 2026 | Version-specific; configuration/build cache compatibility must be profiled | High |

## Workload, invariants, and failure model

### Workload model

- A multi-module Android project has an app module, shared data/DI modules and many feature modules. The expensive change is a shared module whose ABI or generated code invalidates many downstream tasks.
- The developer path is a selected feature debug install, not a clean release artifact. It optimizes time-to-first-interaction for a narrow feature.
- The build graph includes configuration, dependency resolution, Kotlin/Java compilation, annotation processing/code generation, resource merging, manifest processing, packaging, device install and app startup.
- The relevant growth variable is not total module count alone; it is the transitive closure and ABI/resource/code-generation coupling of the changed module.

### Invariants

1. The selected build must compile and launch the selected feature against the same public interfaces and generated contracts used by the full app.
2. Any fake/optional binding must be limited to the selected debug path and must fail loudly if a production/release task attempts to package it.
3. Full build, CI, instrumentation and release paths remain authoritative for cross-feature integration, resource collisions, shrinker rules, manifest merging and packaging.
4. The `only` selector must be validated: unknown feature names, empty values and invalid dependency closures must fail rather than silently build the wrong graph.
5. Build outputs are reproducible from a pinned toolchain and dependency lock/version policy; no dynamic dependency or untrusted cache result may change behavior unexpectedly.
6. A measured speedup must not trade away correctness, test coverage or developer visibility of failures that will later block CI.

### Failure/crash windows

| Window | Possible result | Required recovery/diagnostic |
| --- | --- | --- |
| Real feature class is excluded but fake source compiles | Selected build passes while full app integration is broken | Full-graph CI, contract/instrumentation tests and explicit fake-source ownership |
| Fake source drifts from real constructor/API | Local build gives false confidence or fails only after re-enable | Compile-time interface contract, generated API check and periodic selected/full parity test |
| `:data` ABI changes but Gradle incorrectly reuses cache | Stale classes or runtime mismatch | Build-cache correctness, clean/uncached verification and cache key/input review |
| Configuration cache or plugin is incompatible | Configuration failure or stale configuration | Version matrix, configuration-cache problems report and fallback path |
| Dynamic dependency changes during resolution | Non-reproducible build and broad invalidation | Pin versions/lockfiles and isolate repository/network failures |
| Selected debug artifact omits required resource/manifest/provider | Runtime crash or feature appears healthy only after navigation | Launch/deep-link smoke tests, resource/manifest assertions and full variant tests |
| Selective build is used for release/CI | Missing features, shrinker/packaging/signing defects | Gate selector to debug/local tasks and reject it in release pipelines |
| Remote build cache serves untrusted or incompatible artifact | Supply-chain risk or nondeterministic build | Authenticated cache, provenance, isolation and periodic clean rebuild |
| Device install/startup is the new bottleneck | Compile speed improves but feedback loop does not | Measure build, install, startup and navigation separately |

## Coverage matrix

| Gate | Local coverage | External evidence reviewed | Gap / action for integrated content |
| --- | --- | --- | --- |
| Definitions | Feature module, data module, fake source, optional binding, deep link | Android modularization; Gradle task/build cache docs; Dagger | Define selected graph, compile avoidance, configuration/build cache and debug-only fake. |
| Invariants | Selected feature must compile/run; full app implied | Android/Gradle guidance | State full-build authority, fake-source exclusion and reproducibility guarantees. |
| Workload | 5–8 minute baseline, 1–2 minute selected build | Android Build Analyzer; Gradle profiling | Add task graph, cold/warm, clean/incremental, machine, variant and install timings. |
| Failure/crash windows | Missing references and fake source | Gradle cache/config docs; Android variants | Add stale cache, generated code, resource/manifest and release misuse failures. |
| Retries/timeouts | Not covered | Gradle CLI/cache; CI build practice | Add network/dependency retry limits, cache fallback and CI timeout policy. |
| Operations/recovery | Local developer workflow only | Gradle build cache, Bazel remote cache, Android tooling | Add cache invalidation, clean-build fallback, toolchain upgrade and rollback instructions. |
| Security/privacy | Not covered | Bazel remote cache; Android app links/WebView/security docs | Protect build artifacts, credentials, signing keys and debug deep links. |
| Testing | Deep link and sample behavior implied | Android testing, Build Analyzer, module guidance | Add selected/full parity, instrumentation, fake-boundary, release and clean-build tests. |
| Domain trade-offs | Faster local feedback vs full dependency graph | Android modularization warns too fine/coarse; Gradle cache scope | Explain when selective build, modularization, build cache or Bazel is appropriate. |

## Best-practice comparison

| Local decision | Current practice / evidence | Assessment and boundary |
| --- | --- | --- |
| Compile a selected feature dependency closure | Android recommends modularization for build performance and ownership | Strong fit; measure closure and avoid over-granularity. |
| Property-based task selection (`-Ponly`) | Gradle supports task selection, lazy configuration and build/configuration caches | Good workflow, but property logic is custom and must be tested against all variants. |
| Fake missing activity/Dagger binding | Optional binding is a DI mechanism, not a general build isolation guarantee | Use a debug-only adapter/contract; keep fake behavior explicit and fail on unintended release packaging. |
| Smaller debug APK | Feature selection and variant packaging can reduce artifact contents | Compare equivalent debug variants; release/AAB size and runtime behavior need separate measurements. |
| Build cache/configuration cache | Gradle distinguishes task output caching from configuration graph reuse | Adopt only after compatibility/profile checks; cache misses and invalidation are normal. |
| More modules | Modules can improve compile avoidance and parallelism | Too fine-grained creates configuration/boilerplate overhead; ownership and boundaries matter. |
| Alternative remote build system | Bazel remote cache can share artifacts across machines | It adds infrastructure, hermeticity and security complexity; not a free replacement for the custom workflow. |

## Contradictions and limits

| Local statement or implication | Competing guarantee / limitation | Consequence |
| --- | --- | --- |
| O(1) build time | Gradle still configures the graph and compiles the transitive closure; closure can grow with shared APIs/resources | Use conditional complexity language and report measured task counts. |
| Excluding modules makes the app compile | Compilation can be made artificially easy by fakes while runtime wiring is absent | Full-graph/feature contract tests remain mandatory. |
| Smaller APK means faster development | Install/startup, device I/O and runtime data can dominate; release artifacts differ | Measure end-to-end feedback loop. |
| Build cache always makes builds faster | Cache lookup/upload, invalidation and remote latency can cost more than recomputation | Benchmark clean, warm, cache hit/miss and changed-module scenarios. |
| Configuration cache is a universal switch | Plugins and build logic may be incompatible or change behavior | Pin Gradle/AGP and have a compatibility gate/fallback. |
| More modules solve scale | Fine-grained modules add build configuration and maintenance overhead | Use dependency graph data and ownership needs to choose granularity. |
| Deep link saves navigation time | It can bypass real navigation/auth/state paths or expose debug entry points | Restrict to test/debug and add equivalent user-flow tests. |

## Negative evidence and anti-patterns

- Do not call a selective debug workflow a release build, CI replacement or formal O(1) algorithm.
- Do not add fakes to silence compile errors without a test that exercises the real module in the full graph.
- Do not allow `-Ponly` to change production/release packaging without an explicit safety review.
- Do not enable remote build cache for signed artifacts or private source-derived outputs without access controls, provenance and cache poisoning defenses.
- Do not diagnose every slow build with more heap or more workers; profile configuration, invalidation, annotation processing, resource merging and dependency resolution first.
- Do not use dynamic dependency versions while measuring performance; a resolution change can invalidate the comparison.
- Do not over-modularize solely to chase a smaller task count; module boundaries also affect API stability, testability and developer ownership.
- Do not use a deep link smoke test as proof that the normal navigation, authentication, analytics and state restoration paths work.

## Operational, security, observability and testing concerns

- Build metrics: clean/warm/incremental durations, configuration time, task count/execution time, cache hit/miss/upload, annotation processing, resource merge, packaging, install and startup-to-feature-ready.
- Build graph telemetry: changed module, invalidated tasks, dependency closure size, generated-source set, selected feature, Gradle/AGP/JDK/Kotlin versions and machine profile.
- CI gates: full debug/release build, all tests, lint/static analysis, selected-feature smoke matrix, clean build, cache-disabled build and reproducibility comparison.
- Fake safety: put fakes in a clearly named debug/test source set; assert release variants have no fake classes; expose an explicit “selected build” marker in the artifact and logs.
- Cache security: authenticate remote caches, isolate branches/tenants, avoid secrets in task inputs/outputs, verify artifact provenance and provide a clean rebuild path.
- Dependency security: pin versions, verify checksums/signatures where available, scan Gradle plugins and generated code, and keep Android/AGP/Kotlin versions supported.
- Deep-link security: use a debug-only URI scheme or guarded intent, validate parameters, avoid sensitive data in URIs/logs and test exported activity behavior on supported Android versions.
- Recovery: when a custom selector or cache fails, fall back to the canonical full or ordinary feature build; document the switch and preserve the failure for diagnosis.

## Duplicate / canonical ownership

| Concern | Canonical owner | This case's role |
| --- | --- | --- |
| Generic Gradle performance, build cache and configuration cache | Gradle/Android build-performance material | Link to current docs; own the Tiki selective-build narrative and measured caveats. |
| Android modularization | Android app-architecture topic | Cite principles and trade-offs; do not duplicate a full modularization tutorial. |
| Dependency injection and optional bindings | DI topic / Dagger documentation | Explain only why the local fake compiles. |
| CI build acceleration | GitHub Actions/build-performance topic if present | Keep local developer feedback loop separate from CI cache/runner optimization. |
| Selective feature build and debug deep link | This case | Own the custom `-Ponly` workflow, fake-source risk and test contract. |

## Integration record (Batch G scope)

Batch G integrated the paired EN/VI measurement qualifier immediately after the result section. It narrows `O(1)` to the selected debug workflow under a fixed dependency closure, records that the reported numbers are historical first-party observations with incomplete reproduction metadata, and makes the full graph/release pipeline authoritative.

The qualifier also keeps optional bindings and deep links inside guarded debug/test paths, requires Build Analyzer or Gradle profiling for reproduction, and prevents a fake source from hiding cross-feature failures or entering a production artifact. Existing anchors, figures, code, and EN/VI article structure were preserved.

Gate passed on 2026-08-23: content index rebuilt; `validate-content.mjs --stats`, the complete `check.mjs` gate, case-anchor checks, and `git diff --check` succeeded.

## Proposed follow-up changes

1. Change the title/subtitle wording to make “O(1)” explicitly conditional on a fixed dependency closure and local debug workflow.
2. Add a baseline/result table separating clean, warm, incremental, selected, install and startup times, with machine/toolchain/version fields.
3. Show the dependency graph and identify which tasks still run even when feature modules are excluded.
4. Mark `@BindOptionalOf` and fake source behavior as version-specific Dagger implementation details; link the sample commit.
5. Add a hard rule that fake sources are debug/test-only and release/CI tasks reject the selector.
6. Add selected/full parity tests, fake drift detection, deep-link smoke tests and a clean-build fallback.
7. Add current Android/Gradle alternatives—module boundaries, build cache, configuration cache, non-transitive R, KSP and Build Analyzer—as options to measure, not guaranteed fixes.
8. Preserve the 15-second figure as a historical next step rather than an achieved benchmark.
9. Keep EN/VI code and diagrams aligned; the Batch G qualifier is already integrated, while the remaining version, graph, artifact, and reproducibility details stay follow-up work.

## EN/VI and cross-reference plan

- Preserve the five IDs and code commands in both languages; do not translate Gradle task names, properties, module names, class names or deep-link URIs.
- Standardize `dependency closure`, `compile avoidance`, `incremental build`, `build cache`, `configuration cache`, `fake source`, `optional binding`, `debug-only`, `release variant` and `reproducible build`.
- Add the same conditional “O(1)” caveat and measurement table to both languages.
- Link generic Gradle/Android modularization topics from this case; link this case from the build-optimization topic as a historical example.

## Open questions and falsifiers

| Unknown | What would answer it | What would falsify the proposed recommendation |
| --- | --- | --- |
| What Gradle/AGP/JDK/Kotlin/Dagger versions produced the report? | Repository history, lockfiles and build scans | The workflow depends on obsolete APIs or behaves differently on supported toolchains. |
| What exactly is excluded and what remains in the task graph? | `--dry-run`, build scan and task input report | Shared resource/codegen/manifest work still scales with the whole project. |
| Can a fake source ever ship? | Variant artifact inspection and CI rule | A release artifact contains fake classes or bypasses a required production binding. |
| How often does fake/API drift occur? | Full-vs-selected parity CI and history | A selected build passes while full integration fails at a material rate. |
| Are cache hits correct and beneficial? | Clean/cache-disabled comparison, cache provenance and hit/miss metrics | Stale outputs, cache poisoning or lookup cost erases the measured gain. |
| Does the workflow improve end-to-end developer time? | Build + install + startup telemetry | Compile time falls but install/startup/navigation remains the dominant delay. |
| Is 15 seconds realistic? | Repeated measurements on target hardware/graph | Reproduction under the intended workflow cannot approach it without removing required validation. |

## Discovery pool and exclusions

The discovery pool contained approximately 38 candidates; 26 distinct sources were selected. The Medium repost of the Tiki article, generic Gradle SEO posts, old Stack Overflow answers, unpinned framework benchmark claims and duplicate Android documentation mirrors were excluded. The ledger prioritizes the Tiki artifact, Android/Gradle/Dagger/Bazel official documentation and build-system specifications.

## Sources

All sources were reviewed on 2026-08-23. Current Gradle/Android guidance is version-sensitive and is not treated as evidence that the historical Tiki setup used the same versions.

| # | URL / title / organization | Tier; version or revision | Exact claims supported |
| --- | --- | --- | --- |
| 1 | [O(1) Android build time at Tiki](https://engineering.tiki.vn/o1-android-build-time-at-tiki/) — Tiki Engineering | T1 first-party; historical article, page revision not stated | Baseline, `-Ponly` workflow, fake source/Dagger detail, deep link and reported result. |
| 2 | [Modularization sample](https://github.com/nlgtuankiet/modularization) — Tiki author repository | T1 first-party artifact; repository revision not pinned | Example project structure, optional Dagger binding and selective feature implementation. |
| 3 | [Optimize your build speed](https://developer.android.com/build/optimize-your-build) — Android Developers | T1 official; page last updated 2024-01-03 | Modularization, profiling, static debug config, KSP, configuration cache and build-speed caveats. |
| 4 | [Guide to Android app modularization](https://developer.android.com/topic/modularization) — Android Developers | T1 official; page last updated 2026-03-05 | Module benefits, build performance, ownership and too-fine/too-coarse pitfalls. |
| 5 | [Build Analyzer](https://developer.android.com/build/build-analyzer) — Android Developers | T1 official; current page redirected from Studio docs | Profiling build tasks and diagnosing performance bottlenecks. |
| 6 | [Gradle performance](https://docs.gradle.org/current/userguide/performance.html) — Gradle | T1 official; Gradle 9.7.0 page at review | General build-performance methods, profiling and configuration/build cache distinction. |
| 7 | [Build cache performance](https://docs.gradle.org/current/userguide/build_cache_performance.html) — Gradle | T1 official; Gradle 9.7.0 | Cache gains depend on module/change structure and must be measured. |
| 8 | [Gradle build cache](https://docs.gradle.org/current/userguide/build_cache.html) — Gradle | T1 official; current docs | Local/remote task-output cache, input hashes and cacheability. |
| 9 | [Build cache use cases](https://docs.gradle.org/current/userguide/build_cache_use_cases.html) — Gradle | T1 official; current docs | Clean-build confidence, cache population and cache-hit use cases. |
| 10 | [Configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html) — Gradle | T1 official; Gradle 9.7.0 | Reusing configured task graphs, behavior differences and compatibility/security caveats. |
| 11 | [Enabling configuration cache](https://docs.gradle.org/current/userguide/configuration_cache_enabling.html) — Gradle | T1 official; current docs | Opt-in/configuration and the need to resolve problems before adoption. |
| 12 | [Gradle command-line interface](https://docs.gradle.org/current/userguide/command_line_interface.html) — Gradle | T1 official; current docs | Task selection, `--build-cache`, `--configuration-cache` and diagnostics. |
| 13 | [Gradle optimizations](https://docs.gradle.org/current/userguide/gradle_optimizations.html) — Gradle | T1 official; current docs | Incremental execution and build-cache principles. |
| 14 | [Dagger developer guide](https://dagger.dev/dev-guide/) — Dagger | T1 official; current docs | Component/module/binding model and version-aware DI boundaries. |
| 15 | [Optional bindings](https://dagger.dev/dev-guide/optional-bindings.html) — Dagger | T1 official; current docs | `@BindsOptionalOf` semantics and limits; not a production fake-safety mechanism. |
| 16 | [Remote caching](https://bazel.build/remote/caching) — Bazel | T1 official; current docs | Remote artifact cache, reproducibility, authentication and cache poisoning concerns. |
| 17 | [Build encyclopedia](https://bazel.build/concepts/build-reflection) — Bazel | T1 official; current docs | Hermetic/action input concepts applicable when comparing build systems. |
| 18 | [Android build variants](https://developer.android.com/build/build-variants) — Android Developers | T1 official; current docs | Variant-specific source/configuration and why debug/release paths differ. |
| 19 | [Dynamic feature modules](https://developer.android.com/studio/projects/dynamic-feature-modules) — Android Developers | T1 official; current docs | Feature modularity and delivery boundary; not the same as local selective compilation. |
| 20 | [App links/deep links](https://developer.android.com/training/app-links) — Android Developers | T1 official; current docs | Intent/deep-link behavior and verification/security scope. |
| 21 | [Android testing](https://developer.android.com/training/testing) — Android Developers | T1 official; current docs | Unit/instrumented/UI testing layers needed beyond a selected build. |
| 22 | [Kotlin Symbol Processing](https://kotlinlang.org/docs/ksp-overview.html) — Kotlin | T1 official; current docs | Annotation-processing alternative and version/tooling scope. |
| 23 | [Gradle Java plugin](https://docs.gradle.org/current/userguide/java_plugin.html) — Gradle | T1 official; current docs | Source sets, compilation tasks and dependency relationships. |
| 24 | [Android resource configurations](https://developer.android.com/build/gradle-tips) — Android Developers | T1 official; current docs | Build-variant/resource choices and the risk of optimizing only one path. |
| 25 | [Gradle best practices for performance](https://docs.gradle.org/current/userguide/best_practices_performance.html) — Gradle | T1 official; Gradle 9.7.0 | Avoiding eager/dynamic build logic and measuring cache/configuration effects. |
| 26 | [Gradle directory layout and caches](https://docs.gradle.org/current/userguide/directory_layout.html) — Gradle | T1 official; current docs | Cache locations and operational cleanup/isolation considerations. |
