# Worlds and server bookmarks

Worlds and Servers open from Home’s bottom dock (expand More when hidden). They can
also be added as horizontal Home shelves by dragging their icons into the visible group.
Their implementation stays local;
there is no server hosting, cloud synchronization, or automatic world migration.

## Worlds

- Lists worlds from registered Chest instances, including custom instance locations.
- Reads names and recorded Minecraft versions from gzip-compressed `level.dat`.
  Missing, corrupt or unfamiliar metadata displays Unknown rather than claiming compatibility.
- Search includes world and instance names. Open instance returns to its Overview.
- Back up saves a ZIP containing a `world/` folder. Existing backups are never replaced;
  choose a new filename. To restore manually, extract that folder into a closed instance's
  `game/saves` directory under a new folder name.
- Copy creates a new folder in another instance. It preserves the source and never
  edits `level.dat` to pretend the world has been converted. Minecraft's own world name
  is retained; the copied folder has a unique generated name.
- Copy warns about a different recorded Minecraft version or source instance loader.
  Matching versions are not proof of mod compatibility. The original loader and mod set
  of an externally imported world may be unknown.
- Backups and copies reject active Chest-managed source instances; copies also reject
  active or unprepared targets. An externally launched game is not tracked by Chest.
- Copying is staged and failed copies are removed. Archives stream to disk, incomplete
  backups are removed on reported failure, and stale `session.lock` files are omitted.
  A force-quit or machine shutdown can leave an incomplete backup or staging directory;
  automatic recovery and backup rotation are not implemented.
- Links and special files are rejected. Metadata is capped at 8 MiB compressed and
  decompressed; recursive copies/archives are limited to 64 folder levels.

The global index is rebuilt on opening Worlds, when a Worlds shelf first comes into
view, or when pressing Refresh. Per-instance metadata
loads when that instance's Worlds tab is opened. Neither adds startup scanning or polling.

## Servers

Bookmarks contain a name, address, optional preferred instance, and optional expected
Minecraft version and loader supplied by the user. They persist in Chest configuration.
Deleting an instance clears its preferred-instance references without deleting bookmarks.

Add to instance explicitly appends a bookmark to Minecraft's `servers.dat`, preserving
existing entries, resource-pack choices, icons, and other NBT fields. Duplicate addresses
are skipped. The instance must be idle, and version/loader differences are shown before
adding. Removing a bookmark requires confirmation and leaves existing Minecraft lists
unchanged. An instance's Servers tab can bookmark its existing entries and copy addresses.

Server requirements are not discovered or verified by network probing. Mods, configuration,
plugins and protocol proxies may change compatibility. No automatic connection or
background status polling is performed.

## Verification

`core/src/worlds.rs` and `core/src/server_bookmarks.rs` cover metadata, copying, archives,
busy instances, traversal, symbolic links, preservation, persistence, and address checks.
`tests/worlds-servers.spec.ts` covers on-demand scans, search, backup cancellation,
copy guidance, bookmark dialogs, existing server imports and creation navigation guards.
Native file-picker behavior and packaged Windows/Linux acceptance remain manual checks.

## Card artwork

World cards read `icon.png` from the selected save only when the card comes into
view. Server cards prefer the icon already cached in the preferred instance's
`servers.dat`, then Chest's local cache. Missing/stale server artwork triggers a
status-only request with a three-second deadline and bounded response/image sizes.
No login or recurring polling is involved. Direct hostnames/IPs and explicit ports
are supported; otherwise the standard 25565 port is used (SRV-only destinations
currently depend on an existing Minecraft icon cache). Successful icons are cached
for a day. Invalid or missing artwork leaves the normal placeholder visible.

All shared cards use their real gallery image or instance screenshots first.
When no background is available, a blurred enlargement of the displayed icon is
used behind the normal foreground icon and text gradient. Branded artwork is not
sent through the symbolic-icon pixelation pipeline.
