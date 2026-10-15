# Provider descriptions

Project dialogs use three regions: a compact header, a flexible description panel,
and a controls footer. The header groups the unframed project icon, provider/title,
author/download metadata and summary, with Website beside Close. The footer pairs
target/release selection with the primary action for every content kind, stacking only
when space is insufficient. Mods, resource packs and shaders keep the instance picker
beside Add even before a target is chosen; selecting a target reveals the compatible
release picker in the same choice group. Guidance and errors sit below the action row.
The dialog occupies 90% of viewport height and up to 94% of viewport width (capped
at 64 rem), within shared dialog margins. All layout rules live in ProjectDialog;
the previous overlapping global project-dialog rules have been removed. Descriptions scroll independently with
the shared pixel scrollbar; exceptionally small windows allow header/controls to
scroll rather than clip inaccessible controls.

Initial focus goes to the project heading without a visible ring, rather than the
Close button. Keyboard navigation retains normal focus indicators on controls and
closing restores focus to the invoking card. The shared dialog action supports an
optional initial-focus target without changing other dialogs' default behavior.

`catalog_description.rs` requests Modrinth project `body` (Markdown) or CurseForge
`mods/{id}/description` (HTML), only on opening a dialog. Requests time out after 15
seconds, response JSON is capped at 1 MiB, and description bodies at 512 KiB. Provider
keys stay in Rust. Loading/errors/retries do not affect release requests or installation.
Closed or changed projects ignore stale replies.

`ProjectDescription.svelte` owns the panel lifecycle for all catalog kinds/providers.
The renderer is loaded on demand. `rich-description.ts` converts Markdown with Marked
and sanitizes both formats with DOMPurify, using the same explicit tag/attribute list.
Scripts, forms, active embeds, SVG markup, styles, IDs, classes and fixed dimensions
are removed. Headings/lists/tables/code/images use shared themed presentation. Tables
contain their own overflow; long text/code wrap. The shared scrollbar's container
placement changes geometry only, leaving global pixel styling intact.

Embeds become external links. Links accept HTTP/HTTPS with no credentials and open
in the system browser on desktop. Images accept HTTPS only, load lazily with no
referrer, retain original pixels, and are limited to 100 per description. CSP permits
HTTPS images for author-hosted artwork; it does not permit remote scripts or frames.
Broken images fall back to their alt text. Provider styles never override Chest colors.

API references: [Modrinth project](https://docs.modrinth.com/api/operations/getproject/),
[CurseForge descriptions](https://docs.curseforge.com/rest-api/).
Sanitizer: [DOMPurify](https://github.com/cure53/DOMPurify).

Regression tests cover both formats, independent scrolling, pixel scrollbar placement,
light/dark styling, narrow windows at doubled text size, unsafe markup/URLs, failures,
retry, late responses, external link dispatch and existing dialog/install workflows.
