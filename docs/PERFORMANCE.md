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

## Weekend resource audit

Startup JS fell 20.5%, bundled license notices 74.8%, and the local production executable 37.3%. Backdrop work, log updates, scrollbar reads and news scheduling now have explicit bounds. These are asset/workload improvements; native CPU/RSS reductions have not been measured.

See the [audit findings, completed tasks and measurements](https://github.com/gardengim/chest/blob/d03df505cad0463362f093d8d06fb59c0f352a76/docs/audits/2026-10-11.md) for scope and limitations.

## Startup continuation — October 12, 2026

Overlapped critical local initialization, deferred optional artwork/network work,
and split unselected pages out of the startup bundle. Main JS is 35.6% smaller.
Production-browser fixtures verify that optional requests can remain unresolved
without blocking library navigation, and newer activity events beat the initial
snapshot. See the [startup audit and raw measurements](https://github.com/gardengim/chest/blob/d03df505cad0463362f093d8d06fb59c0f352a76/docs/audits/2026-10-12-startup.md) for verification,
benchmark methodology and native measurement limits.

## Shared UI continuation — October 13, 2026

Removed progress-triggered instance file scans: a five-progress-event regression
reproduced six total scans before the fix and one afterward; status transitions still
refresh files. Screenshot artwork now shares pending work and has a 16 MiB retained
string budget in addition to the 64-entry limit. Shelf measurements are batched,
unused visibility observation is skipped, and local gallery metadata reads use the
blocking pool. Browser library workloads remain within their existing smoke budgets.
See the [UI/performance audit](https://github.com/gardengim/chest/blob/d03df505cad0463362f093d8d06fb59c0f352a76/docs/audits/2026-10-13-ui-performance.md) for implementation,
coverage and native measurement limits.

## Finalization remediation — October 14, 2026

Instance shelves/pages render a maximum of 24 cards with explicit View all/pagination;
filtering still searches the entire library. `scripts/measure-startup.mjs --instances`
accepts 1–1000 and records diagnostic JS heap/DOM counts after filtering. Browser
fixtures remain synthetic IPC, not native resource measurements.

`scripts/measure-native-startup.py` waits for readiness and rejects dead/zero-RSS
samples. Outputs/logs are outside fresh profiles, owned profiles are cleaned unless
`--keep-profile` is set, and artifact SHA/platform/sample boundaries are recorded.
Use `--idle-seconds 30` for short sampling or `--idle-seconds 3600` for a one-hour
main-process sample on macOS/Linux. These samples explicitly exclude separate
WebView/GPU/network processes and JVMs; complete-app attribution and Windows resource
sampling remain platform acceptance work. Startup sampling itself is portable.
On macOS pass the executable inside `Chest.app/Contents/MacOS/chest`; the bundle
context matters for AppKit/WebView startup. A raw target executable that never
reports readiness is a rejected sample, not a zero-cost startup.

PNG-only derivatives bound local card/background image work. The native decoder
allows up to 36 million pixels, 8192 per dimension, 16 MiB encoded input and 128 MiB
decoder allocation. Derivative disk retention is 128 MiB/256 files. These are
individual workload/cache limits, not total application RSS guarantees. The image
cache is optional for display; an unwritable cache does not modify originals.
Native and live frontend log strings each have their own conservative 16 MiB global
retention budget in addition to per-instance line limits.

See the [remediation results](https://github.com/gardengim/chest/blob/d03df505cad0463362f093d8d06fb59c0f352a76/docs/audits/2026-10-14-remediation.md) and
[raw measurement record](measurements/2026-10-14-remediation.json) for candidate
measurements and remaining human verification gates.
