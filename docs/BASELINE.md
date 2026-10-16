# Chest product baseline

Updated October 15, 2026. This is the behavior baseline for the initial public release.
Changes to scope or interaction rules should update this document and their relevant
regression coverage together. It describes intended and implemented behavior; release
readiness is tracked separately in [VALIDATION.md](../VALIDATION.md).

## Purpose and boundaries

Chest is a local Minecraft Java launcher for creating instances, managing their content,
and playing Minecraft. It uses Rust, Tauri, Svelte, ordinary functions, and local files.
Game operations, credentials, downloads, and filesystem mutations belong in Rust.

Included: instance creation and management, Microsoft accounts, Vanilla/Fabric/Quilt/Forge/NeoForge,
compatible content and modpacks, Java selection, installation, launch/stop, logs,
import/export, news/update notices, and signed application updates. Global Worlds and Servers provide world backup/copy
and local server bookmarks with compatibility guidance.

Outside the initial release: friends/presence/chat, Chest accounts, cloud sync, dedicated server
management/hosting, Bedrock, legacy Forge, beta/snapshot loaders, and releases before
1.19. NeoForge initially supports stable numeric loaders for Minecraft 1.20.2–1.21.x.
Users can export/import setups without a Chest-hosted social service.
See [loader support](LOADERS.md) for installation and validation limits.

## Target platforms and content

| Target | Build architecture | Acceptance requirement |
| --- | --- | --- |
| macOS 14+ | Apple Silicon and Intel | Packaged installer, credential store, Java, game launch, and update verified on each architecture |
| Windows | x86-64 | Same lifecycle checks with MSVC-built app and WebView2 |
| Linux | x86-64 | Same lifecycle checks on the selected distribution, with GTK/WebKitGTK and Secret Service |

These are release targets, not a claim that every target has passed. macOS 14.0 is the
packaging minimum, matching the Safari 17 WebView features used by core controls.
Packaged acceptance on that minimum and each architecture remains required. Windows
requires current WebView2; Linux requires a current WebKitGTK 4.1 runtime with Popover
API support. Record the accepted Linux distribution/runtime versions before release.

- Minecraft: Mojang release entries from 1.19 onward, including yearly naming.
- Loaders: Vanilla, pinned stable Fabric, Quilt, Forge and NeoForge within the scope above.
- Sources: Modrinth; CurseForge requires a key issued for Chest.
- Packs: supported Modrinth `.mrpack` and CurseForge manifest packs with supported game/loaders.
- Archives: Chest `.chest.zip`, settings and game folder including worlds, with a new identity on import.
- Language/appearance: English, Korean, Spanish, Japanese, Simplified/Traditional Chinese
  and Arabic (RTL). Light/Dark/System is independent of the color scheme; one imported
  scheme can contain both palettes. Pixel bevels, frames and artwork remain independent
  of palette colors. Reduced motion follows the system preference plus a user control.

## Interaction contract

| Flow | Expected behavior | Regression evidence |
| --- | --- | --- |
| Navigation | Chest opens customizable Home shelves. The bottom dock reorders/adds/hides shelves, persists layout, and opens hidden tools as full pages; sidebar stays limited to Chest, instances/groups, Create, and Settings. Returning to an instance opens Overview. | `tests/navigation.spec.ts`, `tests/home.spec.ts` |
| Creation | One page, source/content/details order. Blank names use source defaults. Untouched forms and edits reverted to defaults leave freely; changed drafts prompt Cancel/Discard. Pending creation cannot be discarded. Drafts are in-session, not restored after restart. | `tests/creation-page.spec.ts`, `tests/presentation.spec.ts` |
| Pack selection | Explore selects a pack and opens creation. Create is the explicit commit that adds a queued instance. The queue runs in the background and permits navigation. | `tests/creation-page.spec.ts`, `tests/modpack.spec.ts` |
| Content selection | A dialog offers mods/resource packs/shaders and local files, without a second modpack selector. Creation compatibility follows its game/loader; already staged content is identified. Add closes selection; staged content is committed with Create. | `tests/creation-page.spec.ts`, `tests/explore.spec.ts` |
| Instance tabs | Overview presents metadata, status, updates, and news. Contents, Versions, Settings, and Log own their respective controls; Overview has no duplicate Actions section. Folder location is a read-only field in Settings. Worlds, Servers and Screenshots appear for available local files; settings include per-instance accounts, window, arguments, environment, hooks and log behavior. | `tests/overview.spec.ts`, `tests/navigation.spec.ts` |
| Cards and menus | Single click opens. Enabled double-click starts installation/launch when idle. Sidebar tabs and cards share the instance action menu with keyboard access, focus restoration, and dismissal. Browser context menus are suppressed except in text fields. | `tests/instance-menu.spec.ts`, `tests/launcher-settings.spec.ts` |
| Groups and activity | Groups are flat, never nested or merged. Expansion preserves page/background components. Expanded members retain separation; collapsed groups summarize activity across the whole tab. Reduced motion disables pulses. | `tests/sidebar-groups.spec.ts`, `tests/instance-presentation.spec.ts`, `tests/presentation.spec.ts` |
| Accounts | Microsoft identity is separate from session-only offline development testing. Sign-out requires confirmation. Release builds require authenticated ownership and reject offline debugging. | `tests/offline-debug.spec.ts`, `tests/launcher-settings.spec.ts`; native auth acceptance pending |
| Settings | Memory/Java defaults apply to new instances. UI preferences preview immediately and persist only after Save; Discard restores the saved values. Leaving changed settings offers Save/Discard/Cancel. Instance settings use one atomic Save and staged Restore defaults. Default instance folder applies to future creations; explicit creation paths override it. Existing folders are not moved. | `tests/launcher-settings.spec.ts`, `tests/navigation.spec.ts` |
| Updates | Startup checking is configurable; installation is explicit and signature-verified. Active games/installations prevent replacement/restart. Progress, retry, and restart remain available across navigation. | `tests/app-updater.spec.ts`; real signed update acceptance pending |
| Destructive actions | Stop warns about unsaved game progress. Delete confirms removal of local instance files/worlds. Busy operations disable conflicting mutations. | `tests/navigation.spec.ts`, `tests/instance-menu.spec.ts`, Rust lifecycle tests |

Language defaults to the first supported browser language; an explicit choice persists.
Translation dictionaries load on demand. User names, provider content, raw logs and
license texts retain their original text.

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

### Launcher feature extensions

Settings has Accounts, Settings and About tabs, plus Development in debug builds.
Development owns offline testing and the Microsoft application override; ordinary users
use Chest's bundled public client ID. Chest is MIT licensed; About shows
project links and searchable dependency licenses. Installed release builds can create
desktop shortcuts for instances. These hand off to the running normal-profile launcher;
development and test profiles do not create shortcuts. Content selection/management
shares category tabs and list/gallery cards, without embedding Explore as the list.
Content lists support search and enabled/disabled mod filtering, with category result counts.
Instances, screenshots, worlds, servers and Contents use 24-item pages; Home shelves
show up to 24 items with View all. Filtering covers the full collection before paging;
world/server deep links reveal the correct page and focus the target card.
Installed content can be refreshed after external file changes. Logs support search and
copying the displayed lines; neither operation changes the stored log.
Shared data packs are applied explicitly to a selected world, preserving existing files.
Commands and environment settings remain local and are excluded from exported archives.

Evidence: `tests/launcher-features.spec.ts`, `core/src/launch_settings.rs`,
`core/src/instance_files.rs`, and `src-tauri/src/shortcuts.rs` tests. Native Windows/Linux
shortcut activation remains a packaged acceptance gate.

World/server management: see [Worlds and servers](WORLDS-AND-SERVERS.md) for ownership,
compatibility, backup behavior and acceptance limits.
