# UI audit and consolidation — 2026-10-10

Historical implementation audit. For the current product contract and verification counts,
see [BASELINE.md](BASELINE.md) and [VALIDATION.md](../VALIDATION.md).

## Button consolidation

Audited all 60 button call sites across 11 components, including form actions, retries, notifications, dialog controls, instance quick actions and context menus, gallery cards, layout selectors, inventory tabs, and sidebar icons.

- `Button.svelte` is the only component that renders a native `<button>`. It forwards native events, accessibility attributes, form attributes, classes, and styles; defaults to `type="button"`; form submissions explicitly opt into `type="submit"`.
- Three color tones (`neutral`, `accent`, `danger`) share one hover lift, one press depth, one focus outline, one disabled opacity, and one transition duration. Reduced-motion settings disable transitions. Colors can be overridden with CSS custom properties without duplicating interaction rules.
- Five structural shapes (`button`, `plain`, `card`, `tab`, `rail`) retain the established inventory design. Tabs stay attached to their panels and express pressing through their inset bevel. Sidebar items now use vertical pixel tabs with a slate palette, opening into the main area when selected; creation remains a separate square + control. The account tab stays pinned at the bottom and uses a geometric pixel user icon. Card content and tab/menu keyboard behavior remain with their semantic components.
- Removed the old primary/secondary/danger/subtle implementations, separate menu hover outlines, selector bevel definitions, repeated card hover rules, sidebar interaction rules, and conflicting one-/two-pixel press depths from `style.css`. Page styles now set layout and contextual colors. The launch button retains its state-dependent label swap and progress content.
- `Tabs` and `LayoutSwitch` remain small semantic wrappers around `Button`; they own roving focus and selection bindings rather than implementing another button.

Verification: the full browser suite includes 24 tests, with explicit coverage for pointer/focus/disabled feedback across shapes, anchored tabs, card navigation, dialog cancellation, form submission, and menu keyboard navigation. Type checking and production build pass. Browser layouts inspected at 1150×800 and 700×650. No backend changes were needed for this pass.

Reviewed every frontend source file: the application shell and pages, Explore, loader selection, instance menu, artwork and icons, both stylesheets, types, and the native/browser API boundary. Reviewed the browser tests alongside each flow. Backend installation and authentication work is outside this UI pass.

## Findings addressed

| Area | Finding | Change |
| --- | --- | --- |
| Styling | The original rounded UI and subsequent inventory theme were separate cascading implementations. Removed screens still had styles. | One readable `style.css`; removed `theme.css`, over 70 obsolete/empty rules, and 87 superseded declarations; combined 25 repeated selector definitions. Removed the banner, topbar, icon picker, creation preview, and old sidebar slot styling. Responsive and reduced-motion behavior remain. |
| Gallery surfaces | Library and Explore cards separately specified borders, backgrounds, and hover states. | Shared card surface and hover rules. Their different metadata, artwork sizes, and list content remain local. Catalog filter columns adapt to the number of controls. |
| Tabs | Creation used keyboard-accessible tabs, while instance pages used ordinary navigation buttons with the same appearance. | `Tabs.svelte` owns both inventory tab bars, including roving focus, arrow/Home/End keys, selected state, and panel relationships. Per-instance tab memory and creation drafts remain. |
| Layout selection | Library and Explore repeated the Gallery/List controls. | `LayoutSwitch.svelte` owns the pressed state, labels, styling hooks, and bindings. Each section keeps its own layout choice. |
| Runtime settings | Defaults and instance settings duplicated memory constraints, Java input, and slightly different help text. | `RuntimeFields.svelte` supplies the same fields, limits, disabled state, and explanation in both forms. |
| Instance actions | Toolbar labels/icons, menu labels/icons, busy states, and copy/export permissions were computed separately. | `instance-ui.ts` describes the state once. The toolbar and menu consume it; Settings uses the same permissions. Retry consistently represents installation, including when a previously installed instance needs repair. |
| Action execution | Duplicate/export/folder/delete logic was repeated across page buttons and the menu. | One typed `instanceAction` handler with shared guards and confirmations. Folder actions are consistently unavailable in browser preview. Sidebar left-click navigation and right-click menus remain. |
| Queued packs | After a preparation failure, Settings could offer copy/export or metadata changes that the menu disallowed or the backend rejected. | Copy/export and metadata changes remain disabled until pack metadata is ready. Retry and deletion remain available when the instance is inactive. |
| Project releases | Modpack and ordinary content dialogs separately rendered essentially the same release loading/select/empty states. | One release-selection block with flow-specific guidance and actions. |
| Modpack browsing | Main Explore displayed an “Add to instance” selector for packs that create new instances, locking filters to an unrelated selected instance. | Packs browse independently with editable version/loader filters. Returning to ordinary content restores the selected target. |
| Dialog lifecycle | App and Explore duplicated native dialog mounting/cleanup. | One small `showDialog` action. Cancellation rules stay with each flow because sign-in, confirmation, and active downloads differ. |
| Navigation during requests | Content/Console requests wrote results using the current destination after awaiting. Saving also reread the selected instance after awaiting. | Capture the originating instance ID before requests; save a snapshot of that editor. Late responses cannot populate a different instance’s page. |

## Deliberate boundaries

- Inventory tabs change panels; category and layout controls filter or change presentation. They retain different semantics even though they share basic button styles.
- Library cards describe local instances; project cards describe remote content. A generic configurable card component would add props and branches without removing their distinct content.
- LoaderPicker already shares compatible-loader loading, stale-response protection, and retry behavior between creation and Versions. No second picker was introduced.
- Artwork and icon drawings are unchanged. Instance artwork remains derived from local/project data, with its existing fallback; no user icon selection was added.
- Native operations remain behind `api.ts`. Browser examples continue to reject installation, authentication, and launch operations. No store, router, form schema, generic request framework, or dependency was added.

## Follow-up consolidation completed

All maintenance items identified above have now been applied:

- `HomePage.svelte`, `CreatePage.svelte`, `InstancePage.svelte`, and `SettingsPage.svelte` separate the four page responsibilities from the shell. Creation/import and default-settings submission live with their forms. App retains navigation, shared event data, action guards, confirmations, and durable in-session drafts. Library choices, custom creation values, default-setting edits, individual instance editors, and pending Create/Save submission guards survive navigation.
- `ProjectDialog.svelte` owns release loading, compatible target selection, install feedback, and project actions. Explore owns search, filters, pagination, and gallery selection. Both content and modpack discovery reuse the same detail component.
- Dialogs mount into the `#overlays` container through `showDialog`, with their Svelte ownership restored during teardown. Dark dialogs now have identical colors regardless of their opening page. Removed all four creation-panel dialog color overrides. Native modal focus, Escape cancellation rules, focus restoration, and cleanup remain intact.
- `ArtworkImage.svelte` replaces the instance-only image wrapper and both project image branches. One implementation handles missing/broken images and resets when the source changes. Instance art retains the grass-block fallback; projects retain the existing cube icon, with card/detail sizing preserved.
- Shared status descriptions and compact download-count formatting use small ordinary functions; no new runtime dependency or state framework was introduced.

There are no deferred implementation items from this audit. The deliberate boundaries above remain: static icon drawings and fonts, native APIs, and the distinct content of library/project cards retain their existing responsibilities.

## Verification

- `npm run check`: zero errors or warnings.
- `npm run build`: passed.
- Full Playwright suite with installed Google Chrome: 22 tests passed.
- Added coverage for overlay color consistency, modal focus restoration/cleanup, broken-image fallback/recovery, draft retention across extracted pages, and pending submission guards after page remount. Added regression coverage for instance-tab keyboard/panel behavior and late content responses after navigation. Extended existing tests for matching queued-pack menu/Settings guards and independent modpack filters.
- Browser previews inspected at 1150×800 and 700×650: Library/Explore, creation, instance Overview/Settings, modpack gallery, and project dialog. This is browser UI verification; native installation/gameplay was not rerun for this frontend-only change.


## Inventory refinement

- Neutral gray surfaces retain green for actions and selected controls.
- One pixel unit defines frame, bevel, and depth measurements; controls share a 40px height.
- Discovery categories now use Tabs, including encoded IDs for multiword accessible labels.
- The instance header blends into provider gallery backgrounds, with async source metadata lookup and a small presentation component.
- Library/search alignment and screenshot navigation have regression coverage.
