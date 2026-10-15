# Loader support

Chest ships one executable. Loader modules perform no discovery, downloads or
installation during startup. All loaders use the same Java launch machinery;
their installation supplies the main class, libraries and arguments.

| Loader | Initial scope |
| --- | --- |
| Vanilla, Fabric, Quilt | Existing Minecraft 1.19+ release support |
| Forge | Modern installer format, Minecraft 1.19+ releases |
| NeoForge | Stable numeric loader releases for Minecraft 1.20.2–1.21.x |

NeoForge's historical 1.20.1 fork, beta/snapshot loaders and year-based Minecraft
version schemes are excluded for now. The selector returns no compatible choices
where no stable release exists. Pack imports reject unsupported NeoForge versions
before downloading their content.

## Installation

- Forge versions come from its official Maven metadata. NeoForge versions come
  from its official Maven version API and are filtered by Minecraft version.
- Installer JARs are downloaded from official Maven repositories and checked
  against their published SHA-1 sidecars.
- Chest validates the installer's game version, loader version and profile ID
  before executing it with the instance's matching Java runtime.
- The official `--installClient` command runs in a disposable directory with an
  empty launcher profile. It never targets the user's normal `.minecraft` folder.
- Existing declared libraries seed the installer cache. The installer handles
  its processors; Chest verifies published runtime library hashes and copies the
  generated libraries into its shared cache after successful processing.
- Prepared profiles ignore Chest's original vanilla client JAR filename to avoid
  duplicate Minecraft modules alongside the patched client.
- On macOS, older JNA libraries in Forge-family profiles are replaced with
  Mojang's SHA-1-verified 5.13.0 artifacts, and Forge's module merge arguments are
  updated to match. This addresses the [upstream JNA crash](https://github.com/java-native-access/jna/issues/1452).
- The merged launch profile is published only when the full installation
  finishes. Missing generated files are detected before launch.
- Cancellation stops the installer process; processing has a 20-minute timeout.
  Pause requests take effect at the next installation boundary, rather than
  suspending the official installer midway through a processor.
- Installer failures copy a bounded output tail into the instance Log.

Installation runs Java code from the official installer. It is isolated from the
normal Minecraft directory, but it is not an operating-system sandbox.

## Content providers

Both Modrinth and CurseForge use the instance's exact loader and game version
for mod compatibility. Forge and NeoForge remain separate loader identities.
Both pack manifest formats accept these loaders.

CurseForge discovery and downloads already exist, but require a key issued for
Chest (`CHEST_CURSEFORGE_API_KEY`). Apply through the
[official CurseForge API documentation](https://docs.curseforge.com/rest-api/).
Live provider validation and release key provisioning remain dependent on that
access. No key is bundled or exposed to the frontend.

For individual files blocked from third-party download, use the project's
Website button, download the file in the browser, then use Content → + → Choose
file. Chest does not bypass author distribution restrictions. Restricted files
inside modpacks still stop the import; a guided pack-resume flow remains future
work.

## Validation commands

```sh
cargo test --manifest-path core/Cargo.toml --lib
npm run check
cargo check --manifest-path src-tauri/Cargo.toml
CHEST_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test tests/forge.spec.ts tests/fabric.spec.ts tests/modpack.spec.ts

# Live downloads and installation, in disposable data:
cargo run --manifest-path core/Cargo.toml --example inspect_loader -- neoforge 1.21.1 21.1.172
cargo run --manifest-path core/Cargo.toml --example inspect_loader -- forge 1.20.1 47.4.0

# Optional development-only offline launch; automatically stops after rendering:
cargo run --manifest-path core/Cargo.toml --example inspect_loader -- neoforge 1.21.1 21.1.172 --launch-smoke
```

The smoke example never reads real accounts. Production authentication is
unchanged. Windows/Linux packaged acceptance and authenticated multiplayer
remain separate validation steps.
