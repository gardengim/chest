# Responsive UI audit — 2026-10-13

Scope: the shipping Svelte UI, shared controls, overlays, and native window setup. Archived prototypes remain reference material.

## Findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Page shell | Pixel-sized gutters and a capped page width limited usable space. | Full available page width, fluid gutters, flexible grid tracks. |
| Typography and controls | Pixel dimensions did not follow the user's text size. | Text-relative sizes, browser-relative root font, growing/wrapping controls. |
| Dialogs | Fixed content minima and header rows could overflow or squeeze titles. | Viewport-bounded dialogs, flexible grids, stacked headers based on available dialog width. |
| Cards | Fixed art heights and shelf columns did not follow their container. | Proportional artwork, container-relative shelf columns, shared world/server grid minimum. |
| Forms and filters | Minimum field widths and reserved icon padding could exceed a narrow panel. | Container-bounded fields, adaptive icon padding, wrapping actions and filters. |
| Instance details | Label/value rows could exceed narrow panels with larger text. | Wrapping detail rows and flexible inventory panel padding. |
| Screenshots | Shelf columns had fixed widths. | Container-relative previews, responsive full galleries and viewport-bounded image dialogs. |
| Catalog pagination | Row calculations assumed 230px cards and 18px gaps. | Measure a probe using the same CSS dimensions as the grid; observe both text scaling and container resizing. |
| Identity artwork | Account and instance images had pixel-sized display dimensions. | Text-relative display sizes; skin crops and original artwork stay intact. |
| Dragging and dropdowns | Some offsets and menu limits assumed the original control size. | Measured drop reservation, centered drag previews, text-relative dropdown height limit. |
| Native window | Initial dimensions and a 700×580 minimum constrained sizing. | Start at 80% of the primary display's logical size; remove the application minimum. Existing configured initial size is a fallback when no display information is available. |

Relative upper bounds maintain readable text and comfortable card sizes; they are not fixed render resolutions. ResizeObserver measurements and pointer coordinates use browser pixels because those values describe the current layout.

The original SVG view boxes, symbolic rasterization grid, skin texture coordinates, and device-aligned pixel bevel remain intact. These are artwork/rendering details, not constraints on layout size. Home carousels, the dock, dropdown option lists, and long logs retain their intentional scrolling; page and dialog contents reflow.

## Verification

The responsive matrix covers 320×640, 600×480, 1150×800, and 1920×1080; 200% root text at 800×600 and 320×640. Each case checks Home and its destinations, all instance tabs, accounts, app settings, About, creation, the modpack browser, screenshot preview, and project dialog.

Checks include outer horizontal overflow, clipped button/heading content, readable narrow-dialog title width, close-button reachability, and responsive pagination. Tab bevel overhang is excluded from the label-height check because it intentionally joins the inventory panel border. Dialog screenshots are generated for visual review; this caught a squeezed project title that overflow metrics alone did not detect.

The full browser suite passed 114 tests. Svelte diagnostics, translation checks, the production web build, and native compilation checks passed. These are browser layout and compile checks, not a runtime test of every operating system, display scale, or desktop window manager.
