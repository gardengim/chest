# Directional navigation

Directional controls use `src/icons/triangle.svg`, a 5×3 integer-pixel triangle whose source points up. `DirectionIcon.svelte` rotates that source; it supports standard and compact sizes. Dropdowns and native disclosures use the same asset as a CSS mask. Do not add inline arrow SVGs, Unicode chevrons, or separate direction assets.

`NavigationControls.svelte` owns previous/next button geometry, arrows, labels, tooltips, status placement and shared button feedback. Home shelves use it directly for scrolling. `Pagination.svelte` adds page-boundary handling and the localized `current / total` status for News, Screenshots and catalog views. Catalog item ranges remain supplementary information beneath that counter.

Use `Button.svelte` for interaction feedback. Navigation uses `aria-disabled` with activation blocked by Button, keeping focus in place when a request is pending or a page reaches its boundary. Disabled controls are omitted from sequential Tab navigation. Catalog paging preserves its control nodes and total while requesting another page, so keyboard focus and the counter remain stable through loading.

Forward/right and backward/left retain the same visual meaning across navigation controls. Links to a specific instance or world page use `arrow-bend-right`; play/launch uses the right-pointing triangle. News items do not add decorative direction triangles. Expand/collapse uses the same glyph oriented to match the content direction. Card artwork and other identity icons remain independent of this navigation vocabulary.

Verification covers actual scrolling and page changes, both disabled boundaries, repeated activation during loading, retained keyboard focus, shared arrow geometry, responsive layout, and accessibility checks across the app.

Only render shelf navigation when the measured result area overflows horizontally or has additional unrendered items. Hide View all together with the scroll arrows when all results fit; render only View all when extra items exist beyond a shelf limit but horizontal scrolling is unnecessary. Measurements update after filtering, content changes and resizing. Full-page `Pagination` renders only for two or more pages, covering News, catalog results, and both Home and instance screenshots. Non-paginated News shows More only when additional articles exist beyond its preview limit.

Sidebar and dock reordering share `reorder.ts`: list insertion, drag-threshold checks, and layout-offset hit testing. Layout offsets exclude FLIP animation transforms, keeping targets stable while items animate. The dock supports either axis, both visible/hidden lists, and its existing hold/drop targets. Dragging uses the sidebar's faded preview and neutral feedback rather than green insertion/group outlines; keyboard focus remains visible in neutral gray.

Dock visible/hidden groups use one item-rendering snippet and one sizing observer action. Vertical groups stretch to the same natural label width instead of assigning an independent width to the hidden group. During dragging, measured dock dimensions clamp its anchor to the entire available viewport area as it expands; preserve the original target positions when they still fit. Do not limit expansion to the space remaining below/right of the collapsed dock. The drag preview is independently bounded to the viewport.

Page and horizontal shelf scrollbars use `Scrollbar.svelte` for measurement, reveal, dragging, keyboard navigation and teardown. `PageScrollbar.svelte` only supplies the page target/label; HomeShelf supplies its result area and receives navigation measurements from the same observer. All scrollbar appearance lives in `style.css`, shared between axes. Native bars are hidden on these hosts so macOS/WebView overlay rendering cannot replace the square thumb with a rounded system bar. Do not add component-local scrollbar pseudo-elements or hover/width overrides. Other native scroll regions inherit the centralized global fallback styling.

## Global feedback

`NotificationStack.svelte` renders the shared message queue in a fixed container
near the top of the window. Messages persist across page navigation; newer messages
cover older ones with a small offset and shadow. Overflow stays inside the window.
Keyboard focus reveals the full stack; hover and mouse focus do not move click
targets. During a modal, the container is hosted inside it so message controls
remain interactive.

Errors announce through an alert without stealing focus. Success and warning
messages use status announcements. Instance failures include the instance name
and icon. Dismissal acknowledges an active failure and clears its sidebar issue
state; returning to the instance does not create a duplicate. The install action's
accessible name includes progress, and instance headings label the main region.
