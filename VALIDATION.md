# Chest verification record

## Current automated baseline — October 11, 2026

Host: macOS Apple Silicon. Browser tests use installed Google Chrome through Playwright;
this is browser verification, not native WebKit or packaged-app acceptance.

| Command | Result |
| --- | --- |
| `npm run check:release` / `npm run test:scripts` | Passed: release inputs agree; five rejection/regression tests |
| `npm run check` | Passed: zero errors or warnings |
| `npm run build` | Passed |
| `cargo test --manifest-path core/Cargo.toml` | Passed: 54 tests on macOS; examples compile |
| `cargo clippy --manifest-path core/Cargo.toml --all-targets -- -D warnings` | Passed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Passed on macOS arm64 |
| `CHEST_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test` | Passed: all 63 tests |

These results establish the automated portion of milestone 1. The current behavior
contract is [docs/BASELINE.md](docs/BASELINE.md), and the dependency-ordered release gates
are in [PLAN.md](PLAN.md).

## What the tests establish

Rust tests cover persistence and corrupted-config preservation, metadata argument handling,
checksum/path/archive validation, independent instance identity, file conflicts, compatible
content/dependencies, loader metadata, modpack staging/queue recovery, pause checkpoints,
busy-operation guards, and the distinction between startup failure and game crash.
They also cover session-only development identities, news source/link validation,
installed-release comparison, and provider receipt boundaries.

Browser tests cover creation defaults, source/content/details flow, leaving pristine or
reverted forms without confirmation, changed/pending draft guards, navigation reset to
Overview, local preference persistence, Korean, compatible content selection, catalog
pagination, background identity/stale-response protection, flat sidebar groups, and
instance activity presentation. They exercise shared instance menus on cards/icons/sidebar,
native-context suppression with text-field exceptions, keyboard/focus/dismissal behavior,
Java selection/checking UI, default-location submission, sign-out confirmation, and updater
progress/retry/restart state across navigation.

Native operations in browser tests use test IPC stubs. They prove frontend contracts and
requests, not actual credential exchange, file-picker behavior, Java execution, OS process
management, or signed artifact installation. The new axe audit covers home, creation, discard confirmation, all instance tabs,
accounts/settings and Korean settings under WCAG A/AA automated rules. It found and
resolved button, hint, folder-path and developer-summary contrast failures. A keyboard
skip link is tested. This does not establish screen-reader or native WebView acceptance.
Three browser scale workloads test up to 1,000 instances; native memory and long sessions
remain unmeasured. See [performance evidence](docs/PERFORMANCE.md).

## Previously recorded live checks

Fabric, catalog/Quilt, and modpack checks were rerun successfully October 11 after the
hardening changes. Other rows remain historical. None establishes packaged gameplay acceptance.

| Check | Recorded evidence |
| --- | --- |
| Live Mojang metadata/download verification | Release 26.3 metadata downloaded and SHA-1 verified; 66 library downloads/classpath entries parsed; Java 25 requirement confirmed |
| Live Fabric metadata/download verification | Minecraft 1.21.4 + Fabric 0.19.5: 8 official Maven libraries SHA-1 verified and reused; merged KnotClient entry point confirmed (`cargo run --manifest-path core/Cargo.toml --example inspect_fabric`) |
| Live Modrinth and Quilt verification | Mod Menu on Minecraft 1.21.4: 70 search results, 6 matching releases; 3 files including required dependencies verified, repeated add preserved files, disabled-file conflict rejected. Quilt 0.30.1: 11 official loader libraries verified and KnotClient confirmed (`inspect_catalog` example) |
| Live Modrinth pack import | Fabulously Optimized 8.2.0 for Minecraft 1.21.4: 46 mods verified, Fabric 0.19.3 pinned, project artwork preserved, game data published into temporary storage; no Minecraft installation or gameplay performed (`inspect_modpack` example) |
| Adoptium runtime metadata | Java 25 Linux x64 JRE package resolved |
| Screenshot inspection | Home and Overview previously checked at 1150×800; Minecraft-inspired Creation and Overview visually checked at 1150×800 and Overview at 700×650, without horizontal overflow; Explore and project details visually checked at desktop; combined Library-above-Explore page and tabbed creation form/modpack gallery and install dialog checked at 1150×800 and 700×650 |

Live CurseForge search/download still requires a key issued for Chest.

## Open acceptance gates

| Area | Evidence still required |
| --- | --- |
| Delivery | Successful GitHub check/release runs, signed installers on each target architecture, macOS signing/notarization, and a real signed A → B update |
| Authentication | Chest's own authorized Microsoft registration; owning-account login, cancellation, expiry/refresh, account switching/sign-out, and OS credential storage |
| Game lifecycle | Complete installation and real Vanilla/Fabric/Quilt gameplay, automatic/manual Java on target platforms, logs, normal/crash exit, stop, and launcher close/restart behavior |
| Providers | Live CurseForge with Chest's key, supported pack gameplay, and author-disabled download handling |
| Recovery/security | Independent review and packaged tests for interrupted operations, disk failure, corrupt state, and recovery |
| Accessibility | Keyboard-only complete workflows, native WebViews, screen readers, contrast, scaling, and translation review |
| Performance | Measured startup, memory, large libraries, scrolling/images/logs, and long sessions; budgets based on representative workloads |
| Beta/public release | Unfamiliar-user results, supported OS minimums backed by device evidence, support/recovery documentation, and resolved release blockers |

## Local packaging and release verification

On macOS 27.0.1 arm64, the release app and signed updater archive built successfully.
Explicit ad-hoc bundle signing passed `codesign --verify --deep --strict`; no Apple
certificate/notarization was supplied, so this is local packaging evidence only.

- App: `src-tauri/target/release/bundle/macos/Chest.app` (arm64).
- Updater: `Chest.app.tar.gz`, with `.sig`, in the same directory.
- Archive SHA-256: `437c2a690d380a7c1b34c4be2459ba3e782067d5591fefb5d94908428de88b1e`.
- `verify_updater` example verified the committed public key against the archive/signature
  and rejected a one-byte modification, using the updater's Minisign verification format.
- Release checks validate both Cargo locks, package locks/manifests, tag, key, HTTPS
  endpoint and updater artifact flag; release jobs depend on the reusable check workflow.

Additional focused tests cover callback validation, maintenance/job exclusion, bounded
fragmented logs and imported Java override replacement. See [security review](docs/SECURITY.md).
Recovery guidance and a packaged/beta record are in [RECOVERY](docs/RECOVERY.md) and
[ACCEPTANCE](docs/ACCEPTANCE.md).

Network-enabled GitHub inspection confirmed authentication works and `gardengim/chest`
exists publicly, with no default branch, releases or workflow runs. This local folder has
no `.git` checkout. No repository upload, secret change, tag, workflow run or publication
was performed. Workflow files exist for Linux, Windows, and macOS, but real signed A → B
updates, distribution signing, cross-platform gameplay, and beta participants remain gates.
No release-readiness claim follows from native compilation or browser mocks.

[docs/UI-AUDIT.md](docs/UI-AUDIT.md) remains a historical implementation audit. Its test
counts and snapshots are historical; use this record for the current automated baseline.

## Reliability continuation — isolated testing

Added `CHEST_TEST_PROFILE` for packaged acceptance: explicit absolute empty/marked directory,
canonical path separation (including symlink aliases), stable per-profile credential service,
and separate WebView storage. Normal credential naming is unchanged. macOS requires 14+
for this test mode; app replacement is blocked and automatic update checks are suppressed.
See [test profile usage](docs/TEST-PROFILES.md). New tests cover profile identity/separation,
unsafe adoption, interrupted HTTP body, checksum mismatch, HTTP 503, blocked filesystem
writes, verified cache reuse, and missing/unexecutable/wrong-version Java. These failures
preserve the prior destination and allow a verified retry. Loopback server tests require
permission to bind local sockets; the full verification command was run with that access.
The two Unix-specific tests are not included in Windows's test count.

The macOS packaged process started with `/private/tmp/chest-acceptance-20261011` and was
closed after inspection was blocked. Native UI automation failed to initialize because
ScreenCaptureKit returned error -3811 (audio/video capture failure). No manual keyboard,
VoiceOver, native creation/gameplay or UI-scaling pass is claimed. No account was signed in.
Existing browser accessibility checks still pass; this does not replace native assessment.

Final rebuilt macOS app passes strict ad-hoc code-signature verification. Its updater
signature verifies against the committed key and a modified artifact is rejected.
Final `npm run verify` passes: 63 browser, 54 Rust and five release-script tests,
Svelte/build, Clippy and native compilation. Apple distribution signing/notarization
remain unperformed.
