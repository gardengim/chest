# Collection controls

`Toolbar.svelte` owns the complete collection header: optional heading, Add, search, secondary tools, and navigation when additional content is available. `HomeShelf` supplies its heading and navigation snippets to the collection's toolbar, so controls live outside the horizontally scrolling results. Avoid separate headers, tool rows, and duplicate refresh buttons.

The toolbar follows content sizes and available width. The title takes spare space, search grows within a useful range, and controls use their natural text sizes. Narrow layouts can put the title and navigation on additional rows; the toolbar never forces a fixed-width row or horizontal scrolling.

## Priority overflow

Pass actions as `ToolbarItem` entries with stable `id`, translated `label`, `content` snippet, and `priority`. Higher priority stays visible longer. Add uses 100 and appears before search; secondary filters use 10 and Refresh 0. Layout selectors use the dedicated `trailing` snippet rather than an overflow item. Widths are measured from the rendered controls. Items that do not fit move into a vertical ellipsis (⋮) popover. They are rendered once in their current location; state lives in the collection, so changing placement preserves its selections.

When content overflows, View all and previous/next belong to the separate `navigation` snippet and never enter overflow. The shelf hides this snippet when all content fits. Keep search visible and allow it to wrap when necessary. `filters` supports a flexible field next to search, such as catalog source. Complex catalog filters retain a responsive grid below the main row.

The overflow popover supports keyboard Tab navigation, Escape dismissal with focus restoration, and outside-click dismissal. It is a dialog of native controls, not an ARIA menu that would require changing their keyboard semantics.

## Shared controls

- `SearchField.svelte` is the only search input implementation. Bind `value`; supply a specific accessible `searchLabel`. Borders, icon, placeholder, size, and focus treatment are shared.
- `AddButton.svelte` supplies the common plus, Add label, accent, and feedback. Creation headings can still say “New instance”.
- Reuse `Button`, `Select`, and `LayoutSwitch` for tool contents. Do not add per-view toolbar gaps, control heights, or search styling.
- `LayoutSwitch` configures the reusable `SegmentedControl` with gallery/list pixel icons. The control accepts typed value/options, icon or text labels, whole-control/per-option disabled states, a group label, and an optional form field name. It renders native radio inputs inside adjacent button-styled labels, with a unique default group name so selectors stay independent. Native radios own mutual exclusion, focus, arrow-key navigation, and disabled-option skipping; no custom keyboard or tab-stop logic is needed. `button.css` supplies the same visuals and interaction effects to `Button` and radio labels. Unselected options inherit normal button hover, press, focus and disabled feedback; selected options stay recessed/highlighted and unchanged on hover/press. There is no outer frame, divider layer, or custom animation lifecycle. The toolbar trailing slot anchors the control at the right edge after navigation and keeps it outside overflow.
- `status` can supply a short count for views without a shelf heading.

Regression coverage includes actual single-row header alignment, filtering, priority overflow, retained layout selection after resizing, focus restoration, visible navigation outside overflow, dropdown labels and widths, and narrow/enlarged-text layouts.
