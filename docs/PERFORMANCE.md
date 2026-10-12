# Performance workloads

## Repeatable local checks

- `cargo run --locked --manifest-path core/Cargo.toml --example measure_library`
  creates temporary libraries of 100, 500 and 1,000 instances, measures Core construction
  once and reports the median of five missing-icon scans. No user's data or network is used.
- `npm test -- tests/performance.spec.ts --workers=1` measures browser library readiness
  and filtering for the same sizes, using IPC fixtures. Each test attaches timings.json.
  Current regression budgets: readiness under five seconds, filter under two seconds.
  These are shared-runner smoke budgets, not a claim about native startup latency.

## October 11, 2026 local findings

macOS Apple Silicon, debug Rust build, concurrent release compilation (noisy measurements):

| Instances | Icon scan before | After removing repeated config clone/lookup |
| --- | --- | --- |
| 100 | 3.09 ms | 0.63 ms |
| 500 | 477.43 ms | 4.09 ms |
| 1,000 | 1,400.79 ms | 19.20 ms |

The previous scan cloned and searched the whole config for every instance. It now resolves
paths directly from its existing validated instance snapshot. Other single-path lookups
borrow the config instead of cloning the full library. Absolute timings vary with caches,
CPU load and filesystems; the workload establishes the regression path and explains the
removed quadratic work. The scan above contains no custom artwork; large images require
separate measurement.

A final run without concurrent compilation measured icon scans at 0.49 / 2.40 / 4.08 ms
and Core construction at 16.80 / 2.80 / 4.33 ms respectively (single startup sample each).
The browser 100/500/1,000 workloads passed locally. Rust log tests also exercise a 100-KiB
newline-free stream and fragmented tokens, with bounded collection and redaction.

## Remaining measurement gates

Measure packaged WebView startup cold/warm, populated image libraries, scroll/frame pacing,
process memory, active game logs, and a one-hour idle/running session on each supported
platform. Record hardware, build, memory and disk; compare before/after on the same device.
Do not infer memory stability or native smoothness from mocked browser tests. Add tighter
budgets only after representative device measurements; virtualization may be appropriate
if real large libraries exceed them.
