# Candidate verification SOP

Use this procedure for a repeatable audit handoff. It creates unsigned candidates
and evidence only. Stop at human verification; tagging, signing, publishing and
consolidation require their own authorization and acceptance record.

## 1. Freeze and validate

Commit the application changes and record the full commit. Use Node 22+, the
repository's Rust/platform build dependencies, Python 3.12+ and authenticated GitHub
CLI access. Install the browser once with `npx playwright install chromium`, or
set `CHEST_BROWSER_EXECUTABLE` to an installed Chrome executable.

Run the single entry point from the repository root:

```sh
npm run audit:candidate -- local --output /path/to/new-local-evidence
```

This runs `npm run verify`, then the native build **sequentially**, saving separate
logs, source/working-tree information and an executable identity. A failure stops
later stages. Output must be a new directory whose parent exists. Never run another
build or browser suite concurrently in the same checkout: they share `dist`, ports
and test output. Review recorded uncommitted changes before accepting the evidence.
The Mac build includes only the current `.app`; old updater archives are excluded.
No GUI launch, sign-in or normal user profile is used by this command.

For macOS icon/compositing regressions, install WebKit once with
`npx playwright install webkit`, then run the focused Retina checks:

```sh
CHEST_TEST_BROWSER=webkit npm test -- tests/button-rendering.spec.ts tests/buttons.spec.ts tests/toolbars.spec.ts tests/settings-edits.spec.ts
```

Run this separately from the local audit command. It uses WebKit at device scale 2;
normal browser verification continues to use Chromium. Native app visual review
still checks the system WebView and actual display.

## 2. Run platform workflows

Push the frozen source. Start **Build verification candidates** and **Measure
offline resource workloads** in GitHub Actions on that ref; the push also starts
**Check Chest**. Record all three run IDs and their source commits. Wait for success
on every target. For a failure, inspect the failed job and retained browser traces;
fix the cause, then repeat only affected checks with clearly identified sources.
Cancel superseded runs to avoid runner contention.

After the candidate build passes, start **Measure packaged native startup** with
the candidate build's run ID and **exact full commit**, not the current branch tip.
Wait for all three native hosts. The fourth installer target, Intel Mac, still
requires actual-device acceptance.

## 3. Collect and verify evidence

```sh
npm run audit:candidate -- collect --candidate CANDIDATE_RUN --check CHECK_RUN --resources RESOURCE_RUN --startup STARTUP_RUN --output /path/to/new-ci-evidence
```

The command requires successful completed runs, matching candidate/check application and build inputs,
all four installer targets with exact sizes/hashes, and complete native readiness
samples. Test/tooling-only follow-ups may validate an existing candidate; the script
compares application trees, dependency files, compiler configuration and package
metadata (excluding script commands), and records both source commits.
Resource evidence may use a UI-only predecessor only when its Core tree
and resource workflow match exactly; both source identities remain recorded.
Downloads remain in the output directory with inventories and summaries. On macOS,
read-only DMG integrity/architecture/version and Linux package headers are also
checked; mounted volumes are detached afterward. Other hosts retain verified
hashes but need a Mac inspection for that extra static check.

Failed or partial collection produces no successful `handoff.json`. Keep its
diagnostics; retry into a new directory. Do not silently merge partial runs or
count timeout/early-exit measurements as zero resource use. Artifacts expire after
14 days; store needed inventories and reports in the repository, never installer
binaries, account data or signing secrets.

## 4. Report and stop

Update the completion report with source hashes, run links, measurements and their
limits. Keep older measurements tied to their actual binary. Commit/push the report
and reusable tooling. Complete [human acceptance](ACCEPTANCE.md) on an **unlocked
desktop**, starting with ordinary startup and Home → world Play / server Join.
Include authentication, native accessibility, visual review, gameplay/recovery and
signed update acceptance. The script deliberately never marks human acceptance
complete or publishes a release.
