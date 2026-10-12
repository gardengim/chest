# Chest product baseline

Recorded October 11, 2026. This is the behavior baseline for the initial public release.
Changes to scope or interaction rules should update this document and their relevant
regression coverage together. It describes intended and implemented behavior; release
readiness is tracked separately in [VALIDATION.md](../VALIDATION.md).

## Purpose and boundaries

Chest is a local Minecraft Java launcher for creating instances, managing their content,
and playing Minecraft. It uses Rust, Tauri, Svelte, ordinary functions, and local files.
Game operations, credentials, downloads, and filesystem mutations belong in Rust.

Included: instance creation and management, Microsoft accounts, Vanilla/Fabric/Quilt,
compatible content and modpacks, Java selection, installation, launch/stop, logs,
import/export, news/update notices, and signed application updates.

Outside the initial release: friends/presence/chat, Chest accounts, cloud sync, server
management/hosting, Bedrock, Forge/NeoForge installation, snapshots, and releases before
1.19. Catalog discovery can show Forge/NeoForge projects, but that does not imply support
for installing their loaders or modpacks. Users can export/import setups without a
Chest-hosted social service.

## Target platforms and content

| Target | Build architecture | Acceptance requirement |
| --- | --- | --- |
| macOS | Apple Silicon and Intel | Packaged installer, credential store, Java, game launch, and update verified on each architecture |
| Windows | x86-64 | Same lifecycle checks with MSVC-built app and WebView2 |
| Linux | x86-64 | Same lifecycle checks on the selected distribution, with GTK/WebKitGTK and Secret Service |

These are release targets, not a claim that every target has passed. Minimum OS and
Linux distribution support must be recorded from actual packaged acceptance in
milestones 2–3 before publishing support promises.

- Minecraft: Mojang release entries from 1.19 onward, including yearly naming.
- Loaders: Vanilla, pinned stable Fabric, pinned stable Quilt.
- Sources: Modrinth; CurseForge requires a key issued for Chest.
- Packs: supported Modrinth `.mrpack` and CurseForge manifest packs with supported game/loaders.
- Archives: Chest `.chest.zip`, settings and game folder including worlds, with a new identity on import.
- Language/appearance: English and Korean, dark theme, pixel bevels, relative hover colors,
  native reduced-motion preference plus a user control. Light mode is outside this baseline.

## Interaction contract

| Flow | Expected behavior | Regression evidence |
| --- | --- | --- |
| Navigation | Chest opens Library/Explore; plus opens creation; profile opens Accounts & settings. Returning to an instance from another sidebar destination opens Overview. | `tests/navigation.spec.ts` |
| Creation | One page, source/content/details order. Blank names use source defaults. Untouched forms and edits reverted to defaults leave freely; changed drafts prompt Stay/Discard. Pending creation cannot be discarded. Drafts are in-session, not restored after restart. | `tests/creation-page.spec.ts`, `tests/presentation.spec.ts` |
| Pack selection | Explore selects a pack and opens creation. Create is the explicit commit that adds a queued instance. The queue runs in the background and permits navigation. | `tests/creation-page.spec.ts`, `tests/modpack.spec.ts` |
| Content selection | A dialog offers mods/resource packs/shaders and local files, without a second modpack selector. Creation compatibility follows its game/loader; already staged content is identified. Add closes selection; staged content is committed with Create. | `tests/creation-page.spec.ts`, `tests/explore.spec.ts` |
| Instance tabs | Overview presents metadata, status, updates, and news. Content, Versions, Settings, and Log own their respective controls; Overview has no duplicate Actions section. Folder location is a read-only field in Settings. | `tests/overview.spec.ts`, `tests/navigation.spec.ts` |
| Cards and menus | Single click opens. Enabled double-click starts installation/play when idle. Sidebar tabs and cards share the instance action menu with keyboard access, focus restoration, and dismissal. Browser context menus are suppressed except in text fields. | `tests/instance-menu.spec.ts`, `tests/launcher-settings.spec.ts` |
| Groups and activity | Groups are flat, never nested or merged. Expansion preserves page/background components. Expanded members retain separation; collapsed groups summarize activity across the whole tab. Reduced motion disables pulses. | `tests/sidebar-groups.spec.ts`, `tests/instance-presentation.spec.ts`, `tests/presentation.spec.ts` |
| Accounts | Microsoft identity is separate from session-only offline development testing. Sign-out requires confirmation. Release builds require authenticated ownership and reject offline debugging. | `tests/offline-debug.spec.ts`, `tests/launcher-settings.spec.ts`; native auth acceptance pending |
| Settings | Memory/Java defaults apply to new instances. UI preferences apply immediately and persist locally. Default instance folder applies to future creations; explicit creation paths override it. Existing folders are not moved. | `tests/launcher-settings.spec.ts`, `tests/navigation.spec.ts` |
| Updates | Startup checking is configurable; installation is explicit and signature-verified. Active games/installations prevent replacement/restart. Progress, retry, and restart remain available across navigation. | `tests/app-updater.spec.ts`; real signed update acceptance pending |
| Destructive actions | Stop warns about unsaved game progress. Delete confirms removal of local instance files/worlds. Busy operations disable conflicting mutations. | `tests/navigation.spec.ts`, `tests/instance-menu.spec.ts`, Rust lifecycle tests |

Labels stay short. Additional descriptions are reserved for consequences or constraints
that a label cannot communicate. Existing dialog close buttons use the framed style;
confirmation dialogs do not need a close button.

## Lifecycle guarantees and known limits

Downloads use provider checksums, restricted download hosts, staging, and conflict checks.
Minecraft's metadata supplies launch arguments; Java is spawned directly without a shell.
Refresh tokens use the OS credential store; public account metadata lives in configuration.
Credentials and shared downloaded binaries are excluded from instance archives.

One installer executes at a time, with bounded parallel file downloads. Pause takes effect
at a checkpoint after the active batch/extraction. Progress is completed-file progress,
not a byte/time estimate. A failed queued pack retains its identity for retry. Multiple
instances can run independently, but the same instance cannot have conflicting operations.

Closing Chest stops its installation work and monitoring without deliberately killing
running games. Chest does not reattach to those games after restart. Users should close
games before restarting the launcher. Persistent process supervision is future scope.

Installed content version changes, unsupported loaders, and author-disabled downloads
must report their limitations instead of silently replacing files or bypassing providers.
Resource packs are enabled in Minecraft; shaders require a compatible shader mod.

## Baseline gate

- Scope and target matrix recorded, with implementation distinct from platform acceptance.
- Navigation, creation, settings, and account behavior recorded with evidence links.
- README and milestone plan reconciled with the current application.
- Current frontend/build, core tests/lints, native compilation, and browser results recorded.

External registration, release secrets, device testing, accessibility assessment, and
performance targets remain explicit later gates. They are not unresolved product
interaction decisions and do not imply that this baseline is release-ready.
