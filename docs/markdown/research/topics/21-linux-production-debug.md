# Research - Linux and JVM production debugging

Status: `INTEGRATED`

Reviewed: 2026-08-23

Local unit: `21-linux-production-debug`

EN file: `public/data/topics/21-linux-production-debug.json`

VI file: `public/data/topics/21-linux-production-debug.vi.json`

## Scope and non-goals

This dossier audits the assigned first-minute Linux checks, load/iowait/steal interpretation, file descriptors/ephemeral ports, Linux versus Java OOM, JVM thread/heap/profiling tools, and packet inspection. It owns the production-debugging workflow and evidence safety. Topic 20 owns the observability/SLO layer; topic 14 owns Kubernetes deployment/container lifecycle; topic 26 owns testing/fault injection.

The source pool prioritizes JDK 21/Oracle diagnostic documentation, Linux kernel/man-page documentation, async-profiler project material, systemd, and provider-specific CPU-credit guidance. Commands and defaults are never presented as distro/kernel/JDK universal. The local attribution to a “Netflix first 60 seconds” checklist is unresolved and should not remain as a fact without a primary source.

## Local content map

Both JSON files were read in full. Each has 2 sections and 8 items. EN is 25,267 bytes; VI is 25,027 bytes; section/item IDs match.

| Section | Exact item IDs | Current job |
| --- | --- | --- |
| Diagnosing the system | `21-linux-production-debug.diagnosing-the-system.q1` to `.q4` | First commands, load average/iowait/steal, FDs/ephemeral ports, Linux OOM versus Java OOME |
| JVM & network deep-dive on prod | `21-linux-production-debug.jvm-network-deep-dive-on-prod.q1` to `.q4` | Thread dump, heap dump/leak analysis, async-profiler/JFR safety, `ss`/tcpdump/network diagnosis |

## What is correct and reusable

- The first-minute workflow is practical because it starts with symptom, time window, host/container boundary, and low-impact commands before escalating to dumps/profilers. Keep the sequence, but make it a repository recommendation rather than a Netflix quotation.
- The topic correctly warns that host CPU/memory/load and cgroup/container limits can disagree. PSI and cgroup v2 data are useful additions to traditional `top`, `vmstat`, `iostat`, and `free`.
- The distinction between load average, CPU utilization, iowait, steal, and disk saturation is important. A non-zero `wa` or swap counter is not by itself a production incident; workload latency and pressure/user impact decide.
- File descriptor exhaustion and ephemeral-port exhaustion are different. Connection pooling/keepalive, destination cardinality, TIME_WAIT behavior, per-process limits, and systemd/Kubernetes PID/FD context should remain separate checks.
- The Linux OOM-killer versus Java heap OOME explanation is strong. RSS includes heap plus native memory, metaspace, threads, direct buffers, mapped files, and runtime/container overhead; `Xmx` alone is not a pod memory budget.
- `jcmd`, repeated thread dumps, bounded JFR, async-profiler, and heap-dump analysis are good escalation tools. The local warnings about impact, disk, permissions, and sensitive data should become explicit runbook gates.
- `ss`/`tcpdump`/DNS/TLS/MTU checks are appropriate, but packet captures and heap dumps can contain credentials/PII. Redaction, retention, access, and deletion need operational ownership.

## Claims to verify or qualify

| Local claim/pattern | Classification | Assessment and required qualification | Confidence |
| --- | --- | --- | --- |
| “Netflix first 60 seconds” checklist | Attribution | No primary Netflix source was verified in this pass. Keep the command order as repository guidance or add the exact first-party source; do not attribute it as a fact yet. | High unresolved |
| Load average equals CPU utilization | Incorrect | Linux load includes runnable and uninterruptible tasks; interpretation depends on CPU count, I/O, virtualization, cgroups, and task mix. | High |
| Any swap usage is a red flag | Over-absolute | Swap activity/pressure can harm latency, but a nonzero used counter may be cold pages and not active pressure. Use PSI, major faults, latency, and reclaim evidence. | High |
| High iowait proves the disk is the bottleneck | Incomplete | `iowait` is time CPUs were idle while I/O was outstanding; queue depth, device latency, filesystem, remote storage, and workload must confirm the bottleneck. | High |
| Steal means the cloud provider is at fault | Over-absolute | Steal is guest vCPU time not scheduled by the hypervisor; it may indicate host contention/credit limits but requires provider/instance evidence. | High |
| Linux default ephemeral range is 32768-60999 | Version/distro fact | Common historical default, not a promise for every kernel/distribution/container. Read `/proc/sys/net/ipv4/ip_local_port_range`. | High |
| There are about 28k ports per destination | Inference | Depends on local range, protocol/address family, binding/reuse, and destination tuple; measure per socket state and configuration. | High |
| TIME_WAIT is exactly 60 seconds | Version/config dependent | Duration and reuse behavior depend on kernel/sysctl/protocol; never hard-code it as a universal timeout. | High |
| `tcp_tw_reuse=1` is always safe | Unsafe recommendation | Semantics and safety depend on kernel/version/network; `tcp_tw_recycle` was removed and old tuning advice is dangerous. Prefer pooling/keepalive and verify current kernel docs. | High |
| OOMKilled/exit 137 always means Java heap exceeded | Incorrect | It often means cgroup/kernel killed the process; Java OOME is an in-process exception. Check kernel/cgroup events, RSS, heap, native memory, and exit evidence. | High |
| Set `Xmx` to 50-70% of pod memory | Heuristic | Useful starting heuristic for one JDK/runtime shape, not a guarantee. Include direct buffers, metaspace, thread stacks, code cache, agents, mmap, sidecars, and workload peak. | High |
| JDK 10+ always understands every container limit | Version/runtime dependent | Container-awareness improved over releases and cgroup v1/v2/JDK/vendor builds differ; verify the actual runtime flags and cgroup view. | High |
| Three thread dumps 5-10 seconds apart prove deadlock/hang | Recommendation | Repeated dumps reveal persistent stacks and lock cycles; short waits/CPU spikes/native waits can still mislead. Use JFR/profiles/request traces for confirmation. | Medium |
| `RUNNABLE socketRead0` means CPU is busy | Incorrect | Java thread state and native socket wait do not equal CPU consumption; correlate with OS thread CPU and network evidence. | High |
| Heap dump is harmless | Incorrect | JDK docs mark heap dump/class histogram high impact; it may trigger GC/pause, consume disk, and expose sensitive data. | High |
| Async-profiler overhead is always 1-3% | Unresolved benchmark | Overhead varies by event, frequency, architecture, kernel permissions, JDK, workload, and duration. Use tool/version-specific measurements. | High |

## Workload, invariants, and failure model

### Workload model

Capture: host versus cgroup/container; kernel/distro; JDK/vendor/version; CPU quota/limits and steal/credits; memory limit/current/peak; storage/device/remote filesystem; process/thread count; FD/port ranges; traffic/connections/destination cardinality; request p50/p99; GC mode; heap/native budgets; deployment/rollout timing. A one-minute snapshot is a triage point, not a diagnosis.

Diagnostic invariants:

1. Every command has an impact/privacy classification and a rollback/cleanup path.
2. Evidence has a timestamp, host/pod/PID/JDK/kernel identity, and a known collection boundary.
3. Host metrics are not substituted for cgroup/container metrics, and Java heap is not substituted for process RSS/native memory.
4. A claim of CPU, I/O, memory, FD, port, or network saturation is supported by at least two correlated signals and a user-impact metric.
5. Dumps/profiles/pcaps are stored encrypted/access-controlled, expire by policy, and are scrubbed before sharing.
6. Any emergency sysctl/limit change is recorded and reversible; permanent tuning follows a measured load test.

### Crash windows and recovery

| Window | Failure | Recovery/control |
| --- | --- | --- |
| Snapshot collection during a spike | The command itself adds CPU/I/O/locks or changes timing | Start low impact; record command impact; bound duration and sampling. |
| `jcmd GC.class_histogram`/heap dump | GC/pause, disk full, sensitive heap copied | Check disk/access, use bounded capture, notify owner, encrypt, and delete after analysis. |
| JFR/async-profiler attach | Attach/perf/seccomp/namespace failure or extra overhead | Verify same user/PID namespace/permissions; use low-impact profile first and time-box recording. |
| Kernel OOM decision | Process/sidecar killed after memory pressure | Capture kernel/cgroup events and previous RSS/PSI; adjust request/limit/heap/native budgets only after evidence. |
| FD exhaustion | Accept/connect/log/telemetry operations fail; recovery may require restart | Identify per-process/systemd/container limits and leak; drain/restart with a bounded plan and fix pool/close paths. |
| Ephemeral port exhaustion | New outbound connections fail while existing ones work | Measure tuple/destination/TIME_WAIT/pool behavior; prefer keepalive/pooling or scale source IPs only with network review. |
| DNS/TLS/MTU/network path | Requests timeout, reset, or fail only for some destinations | Correlate `ss`, packet capture, resolver metrics, TLS handshake, route/MTU evidence; avoid blind retry storms. |
| Profile/dump shared externally | Credentials/PII/private code leaks | Classify, redact, restrict, expire, and rotate anything exposed; record chain of custody for incident evidence. |

## Production-debug comparison

| Symptom | First evidence | Escalation | Main false positive |
| --- | --- | --- | --- |
| High latency with CPU saturation | cgroup/host CPU, run queue/PSI, process/thread CPU | JFR/CPU profile, hot methods, lock/GC, request trace | Host CPU high while the container is throttled elsewhere or vice versa |
| High latency with I/O pressure | `vmstat`, PSI I/O, `iostat`, device/filesystem latency | process I/O, DB/storage traces, filesystem/remote volume | High `wa` from unrelated workload or idle CPUs waiting on a small I/O burst |
| Memory growth/OOM | cgroup memory.events/current/max, RSS, heap/GC | NMT, class histogram, heap dump, direct/native buffers | Heap looks stable while native/thread/mapped memory grows |
| Thread pool stall | repeated thread dumps, pool metrics, queue/active count | JFR locks/park, request/dependency traces, DB pool | `RUNNABLE` state misread as CPU; transient blocked stacks |
| Cannot open connections | FD counts/limits, `ss` state/destination/ports | pool/keepalive/TIME_WAIT, DNS/TLS, kernel range | FD limit blamed when ephemeral ports or remote SYN queue is full |
| Network resets/timeouts | `ss`, counters, packet capture, endpoint/route/TLS | service mesh/gateway/remote logs, MTU/DNS | Capture taken after the event or on the wrong namespace/interface |

## Coverage matrix

| Gate area | Evidence and local coverage | Gap to close before integration |
| --- | --- | --- |
| Definitions | load/iowait/steal, FD/port, OOM/OOME, thread/heap/profile/network | Add cgroup v2/PSI definitions and host/container boundary diagrams. |
| Invariants | Correlated evidence, low-impact tools, dump privacy | Add command impact/permission/cleanup metadata to every runbook step. |
| Workload | CPU/memory/storage/network/JVM assumptions | Replace default numbers with runtime-read commands and measured budgets. |
| Failure/crash windows | OOM, FD/port, attach/dump, DNS/TLS/MTU | Add evidence preservation and recovery ownership for each window. |
| Retries/timeouts | Network timeout/reset and pool behavior | Add cumulative request deadlines and retry ownership; no blind `curl`/client loops. |
| Operations/recovery | Runbook sequence and safe escalation | Add exact environment/version capture and post-change rollback/checks. |
| Security/privacy | Heap/pcap/dump sensitivity is noted | Add classification, storage/retention, redaction and credential-rotation procedure. |
| Testing | Local tests/examples are diagnostic | Add repeatable load/chaos scenarios for cgroup OOM, CPU throttle, I/O pressure, FD/port exhaustion and packet loss. |
| Domain trade-offs | Java/Kubernetes/cloud context | Mark AWS credit and JDK-specific guidance as provider/runtime examples. |

## Contradictions and limits

| Competing interpretation | Evidence boundary | Teaching implication |
| --- | --- | --- |
| Host load versus container pressure | Linux load/proc describes host/task state; cgroup v2 and PSI expose resource pressure/limits at different scopes. | Always state the observation scope and compare host, cgroup, and process. |
| Swap counter versus memory pressure | `free`/proc counters are not the same as active reclaim/stall; PSI and cgroup events are stronger pressure evidence. | Do not page on a nonzero swap-used value alone. |
| Heap versus RSS | JDK heap tools cover Java heap; NMT/OS/cgroup cover native/threads/mmap/agents and limits. | Memory budgets must include all components. |
| JDK docs versus vendor/runtime | JDK 21 Oracle docs describe JDK 21 behavior; JDK 8, vendor builds, flags, containers and cgroup versions differ. | Pin JDK/runtime before giving a flag or default. |
| JFR versus async-profiler | Both are powerful, but event availability/overhead/permissions differ by JDK/kernel/tool version. | Pick by symptom and validate overhead on the actual image. |
| Provider CPU credit versus Linux steal | AWS burstable credit behavior is provider/instance-specific; steal is a virtualization signal, not a complete credit diagnosis. | Use provider metrics plus OS evidence. |

## Negative evidence and anti-patterns

- Do not run heap dumps, `GC.class_histogram`, `kill -3`, full packet captures, or high-frequency profiles on a busy service without impact/secret/disk approval.
- Do not tune `tcp_tw_recycle`, blindly enable `tcp_tw_reuse`, or copy old sysctl recipes without reading the actual kernel version and workload.
- Do not raise `ulimit -n` as the only FD fix; find the leak, pool behavior, inherited systemd/container limit, and downstream failure.
- Do not raise `Xmx` to the cgroup limit; reserve native/thread/direct/metaspace/sidecar headroom based on measured peaks.
- Do not infer CPU work from Java `RUNNABLE` or infer a deadlock from one thread dump.
- Do not equate `iowait` with a specific disk device or equate high `%util` with SSD saturation across every storage stack.
- Do not treat `dmesg`/kernel logs as complete inside a container; capture node/cgroup/runtime evidence with appropriate permissions.
- Do not share heap/pcap/JFR artifacts in chat/tickets without redaction and expiry.
- Do not hide a production regression by restarting before preserving enough evidence to compare with baseline.

## Duplicate/canonical ownership

| Repeated concept | Canonical owner | Action |
| --- | --- | --- |
| RED/USE, SLO, alerting, telemetry privacy | `20-observability-sre` | Link from this diagnostic runbook; keep command-level evidence here. |
| Pod probes, shutdown, resource limits, rollout | `14-devops-k8s-best-practices` | Link container lifecycle; keep Linux/JVM interpretation here. |
| Gateway/mesh network tracing and 504s | `27-api-gateway-identity-edge` | Link edge-specific symptoms. |
| Test/load/chaos methodology | `26-testing-strategy` | Link reproducible fault scenarios. |
| JVM memory/thread/profiling details | This topic | Keep the deep-dive canonical here; avoid repeating it in generic SRE text. |

## Proposed content changes (not applied)

- [ ] Remove or mark unresolved the Netflix attribution; retain the first-minute sequence as repository guidance until a primary source is found.
- [ ] Add explicit host/cgroup/process scopes and PSI/cgroup v2 commands to the first-minute checklist.
- [ ] Replace universal swap/ephemeral-port/TIME_WAIT/tcp tuning numbers with runtime-read commands and version notes.
- [ ] Make the OOM table distinguish kernel OOM, cgroup OOMKilled/137, Java heap OOME, direct/native/metaspace/thread exhaustion, and exit evidence.
- [ ] Replace the 50-70% `Xmx` heuristic with a budget formula plus a clearly labeled starting example.
- [ ] Add JDK 21 impact labels for `jcmd`, heap dump, histogram, JFR and NMT; include PID/user/namespace/disk requirements.
- [ ] Add an artifact handling policy for heap/JFR/pcap files.
- [ ] Add a symptom-to-evidence table and a command rollback/cleanup column.
- [ ] Update EN/VI together while preserving all 8 IDs.

## EN/VI parity and cross-reference plan

The EN and VI structures/IDs match. Keep Linux commands, `/proc` paths, sysctl names, JDK flags, exit codes, and metric names unchanged. Translate uncertainty and version scope equally; do not turn a heuristic into an imperative in Vietnamese. Cross-link the canonical SLO/operations and Kubernetes/test topics instead of duplicating definitions.

## Integration record (Batch E scope)

- [x] Added `21-linux-production-debug.jvm-network-deep-dive-on-prod.q5` in EN/VI for evidence-first production diagnosis, bounded captures, privacy, reversibility, and post-incident regression.
- [x] Qualified profiler/heap/packet-capture overhead and preserved the provider/JDK/kernel/container scope of existing commands.
- [ ] The broader audit of every command, kernel version, JDK version, and managed runtime remains a follow-up.

## Open questions and falsifiers

- [ ] Which Linux distribution/kernel/cgroup mode, container runtime, Kubernetes version, JDK vendor/version, and cloud instance family are in scope?
- [ ] Is the service CPU-bound, I/O-bound, network-bound, or dependency-bound under the incident workload? What baseline/SLI proves it?
- [ ] What is the allowed diagnostic pause, artifact size, retention, access group, and cleanup deadline for dumps/profiles/pcaps?
- [ ] Which sysctl/FD/port settings are managed by systemd, image, node, or platform, and which are actually changeable?
- [ ] What would falsify the `Xmx`/native-memory budget: cgroup OOM with stable heap, direct-buffer/thread/metaspace growth, or JDK/runtime detection mismatch?
- [ ] What would falsify the network diagnosis: packet evidence contradicts application errors, failures are destination/zone-specific, or retries hide the original reset/timeout?
- [ ] Which primary source should replace the unresolved Netflix attribution, if the attribution is important enough to keep?

## Source ledger

All selected sources were inspected/reviewed on 2026-08-23. Tier A is official JDK/kernel/man-page/project documentation; Tier B is provider-specific operational documentation. Commands/defaults are version-scoped below.

| ID | URL, title, organization | Tier; version/revision | Exact claims supported | Reviewed |
| --- | --- | --- | --- | --- |
| 21-01 | [The `jcmd` command](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jcmd.html), Oracle | A; Java SE 21 docs | Same-host/effective-user requirement, command list, impact labels, heap/class histogram/JFR operations. | 2026-08-23 |
| 21-02 | [The `java` command](https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html), Oracle | A; Java SE 21 docs | JVM flags, heap-dump/NMT/container-related runtime options and version scope. | 2026-08-23 |
| 21-03 | [Diagnostic Tools](https://docs.oracle.com/en/java/javase/21/troubleshoot/diagnostic-tools.html), Oracle | A; Java SE 21 troubleshooting guide | Recommended JDK diagnostic tools and interpretation boundaries. | 2026-08-23 |
| 21-04 | [Native Memory Tracking](https://docs.oracle.com/en/java/javase/21/vm/native-memory-tracking.html), Oracle | A; Java SE 21 | NMT modes/overhead and that it does not track every third-party/native allocation. | 2026-08-23 |
| 21-05 | [The `jfr` command](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jfr.html), Oracle | A; Java SE 21 docs | Recording/start/stop/dump, default/profile settings, disk/age/size and overhead controls. | 2026-08-23 |
| 21-06 | [async-profiler README](https://github.com/async-profiler/async-profiler/blob/master/README.md), async-profiler project | A; repository `master` reviewed; release/image version not pinned | Sampling modes (CPU/wall/alloc/lock/native), low-overhead intent, permissions and tool-specific limitations. | 2026-08-23 |
| 21-07 | [Pressure Stall Information](https://docs.kernel.org/accounting/psi.html), Linux kernel | A; current kernel docs | CPU/memory/I/O pressure-stall metrics and pressure interpretation. | 2026-08-23 |
| 21-08 | [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html), Linux kernel | A; current kernel docs | cgroup resource limits/events, memory/cpu control and container-scope evidence. | 2026-08-23 |
| 21-09 | [The `/proc` Filesystem](https://docs.kernel.org/filesystems/proc.html), Linux kernel | A; current kernel docs | `/proc` process/system files and scope/field behavior; distro exposure can vary. | 2026-08-23 |
| 21-10 | [IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html), Linux kernel | A; current kernel docs | TCP/IP sysctl names and version-sensitive semantics for port/reuse/tuning claims. | 2026-08-23 |
| 21-11 | [proc_loadavg(5)](https://man7.org/linux/man-pages/man5/proc_loadavg.5.html), Linux man-pages | A; man-pages 6.x page, distro/kernel dependent | Load-average fields and runnable/uninterruptible task interpretation. | 2026-08-23 |
| 21-12 | [proc_stat(5)](https://man7.org/linux/man-pages/man5/proc_stat.5.html), Linux man-pages | A; man-pages current page | CPU counters, iowait/steal fields and their measurement limitations. | 2026-08-23 |
| 21-13 | [getrlimit(2)](https://man7.org/linux/man-pages/man2/getrlimit.2.html), Linux man-pages | A; man-pages current page | Per-process resource limits including `RLIMIT_NOFILE` and inherited limit scope. | 2026-08-23 |
| 21-14 | [tcp(7)](https://man7.org/linux/man-pages/man7/tcp.7.html), Linux man-pages | A; man-pages current page | TCP states/options and version/configuration caveats; not a universal TIME_WAIT duration. | 2026-08-23 |
| 21-15 | [ss(8)](https://man7.org/linux/man-pages/man8/ss.8.html), Linux man-pages | A; iproute2/man-pages current page | Socket-state/diagnostic command behavior and filtering. | 2026-08-23 |
| 21-16 | [tcpdump(8)](https://man7.org/linux/man-pages/man8/tcpdump.8.html), Linux man-pages | A; libpcap/tcpdump current page | Packet capture filters/output and the need to protect captured content. | 2026-08-23 |
| 21-17 | [systemd.exec(5)](https://man7.org/linux/man-pages/man5/systemd.exec.5.html), systemd/man-pages | A; systemd current page | `LimitNOFILE`/service execution limits and service-manager scope. | 2026-08-23 |
| 21-18 | [Key concepts for burstable performance instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html), AWS | B; current EC2 docs | CPU-credit/baseline behavior for AWS burstable families; provider-specific evidence only. | 2026-08-23 |
| 21-19 | [Concepts overview](https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html), Linux kernel | A; current kernel docs | Kernel memory-management terminology and interpretation boundary. | 2026-08-23 |
| 21-20 | [JDK 21 troubleshooting](https://docs.oracle.com/en/java/javase/21/troubleshoot/index.html), Oracle | A; Java SE 21 | JDK 21 troubleshooting index and version scope for diagnostic guidance. | 2026-08-23 |
| 21-21 | [Linux kernel networking documentation](https://docs.kernel.org/networking/), Linux kernel | A; current docs index | Protocol-specific documentation boundary; use the exact kernel/version page for final tuning. | 2026-08-23 |

## Gate status

- [x] Complete EN/VI files and exact IDs read.
- [x] Broad official JDK/kernel/man-page/project source pool inspected and claims mapped.
- [x] Coverage matrix, contradiction/limits, negative evidence, crash windows, privacy, testing and provider/runtime scope recorded.
- [x] Duplicate/canonical ownership and EN/VI parity plan recorded.
- [ ] Target kernel/JDK/container/cloud versions approved.
- [ ] Content changes integrated into `public/data`.
- [ ] Validation run after integration.
