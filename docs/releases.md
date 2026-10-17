# Releasing Chest

## Unsigned 0.1.0 distribution

0.1.0 is distributed without platform signing certificates or Apple notarization.
Use the installers produced by the successful **Build verification candidates**
run, verify their inventory hashes, and attach those exact files to a draft release
with `SHA256SUMS.txt`. Release notes must identify the unsigned publisher status,
the macOS 14 minimum, platform/architecture choices, and manual updates.
OS warnings or blocks are expected; checksums establish download integrity, not
publisher identity. Human acceptance remains separate from automated checks.

Do not attach `latest.json` or unsigned updater payloads. The built-in updater
continues to require valid signatures. Users install future unsigned releases
manually from GitHub Releases. The tag-triggered workflow below is for future
releases with an updater signing key configured; it is not the unsigned release path.

## Signed updater setup (optional for future releases)

The app checks `https://github.com/gardengim/chest/releases/latest/download/latest.json`.
Only signed updater artifacts are accepted. The verification public key is committed in
`src-tauri/updater.pub` and `src-tauri/tauri.conf.json`.

The private signing key is stored locally at `~/.config/chest/updater.key`, outside this
repository. Back it up securely: installed apps trust its matching public key. Never
commit the private key. This key was generated without a password; its file permissions
restrict access to your user account.

## GitHub setup

In `gardengim/chest`, add the contents of the local private key as the Actions secret
`TAURI_SIGNING_PRIVATE_KEY`. Leave `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` empty for this key.
For notarized macOS releases, also configure `APPLE_CERTIFICATE` (base64 P12),
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`
(app-specific password), and `APPLE_TEAM_ID`.

## Release with signed updater artifacts

1. Bump the version in `package.json`, `package-lock.json`, `core/Cargo.toml`,
   `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` together; update Cargo lockfiles.
2. Run `npm run verify`, commit, and push a matching tag, for example `v0.1.1`.
   The release workflow waits for the reusable three-platform check workflow.
3. The release workflow builds macOS Apple Silicon/Intel, Windows, and Linux installers,
   their updater signatures, and `latest.json`. Jobs upload serially to avoid manifest races.
4. Inspect the draft GitHub release and publish it when ready. Draft releases are not
   advertised to existing installations.

For local signed bundles:

```sh
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.config/chest/updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri -- build
```

Updater signing and Apple code signing are separate. The repository configuration and
workflow are ready; GitHub secrets and a published signed release are required before
real updates can be delivered. Release builds check automatically at startup; Settings
also offers Check, Update, progress, and Restart. Development builds can check releases
but do not replace themselves. Updates never install automatically. Running Minecraft
instances and instance installations must finish before installation or restart.

For a local macOS bundle without an Apple distribution certificate, use explicit ad-hoc
signing (local verification only; this does not provide notarization or distributor identity):

```sh
TAURI_SIGNING_PRIVATE_KEY="$HOME/.config/chest/updater.key" TAURI_SIGNING_PRIVATE_KEY_PASSWORD='' npm run tauri -- build --bundles app --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/Chest.app
```

Release preflight checks all manifest/lockfile versions, tag, public-key agreement,
HTTPS GitHub endpoint, updater artifact generation and the macOS 14.0 WebView baseline.
Six script tests exercise valid and rejected release inputs. Actual GitHub runs, distribution signing, published manifest/artifact URLs,
and the [packaged update record](ACCEPTANCE.md) remain required.

Verify a generated updater artifact against the committed public key (also checks that a
modified copy is rejected; the original file is never changed):

```sh
cargo run --locked --manifest-path core/Cargo.toml --example verify_updater -- src-tauri/updater.pub src-tauri/target/release/bundle/macos/Chest.app.tar.gz
```

The macOS bundle declares macOS 14.0 or later. Verify dropdowns, toolbar overflow
and the other acceptance scenarios on that minimum using a real packaged device;
metadata checks and a newer WebKit test runner do not replace minimum-device testing.

## Verification candidates before release

Use the [candidate verification SOP](audit-sop.md) and its single
`npm run audit:candidate` entry point for sequential local validation and verified
CI evidence collection.

Run the manual **Build verification candidates** workflow on the chosen commit.
It builds macOS arm64/x64, Windows x64 and Linux x64 installers and uploads
14-day Actions artifacts, including `candidate-inventory.json` with source commit,
file sizes and SHA-256 hashes. It does not create a tag, release, updater manifest
or distribution signatures. This is suitable for the human acceptance gate, not
public distribution. Record the downloaded artifact hash in the acceptance record.

For automated native startup acceptance, run **Measure packaged native startup**
with that candidate run ID and exact commit. It verifies installer hashes, unpacks
payloads without installing into the host profile, then measures three empty and
three 1,000-instance launches in disposable profiles on native macOS arm64, Windows
x64 and Linux x64 runners. Linux uses Xvfb. This does not establish gameplay,
minimum OS versions, macOS Intel hardware acceptance, or distribution trust.

Run local GUI startup measurements with an unlocked desktop and record window
visibility. A locked or occluded WebView may not paint, so a window-built trace
without library-rendered is a rejected sample, not a valid zero-resource result.
The automated workflow supplies dedicated GUI sessions; human verification still
needs the actual unlocked device and normal launch path.
