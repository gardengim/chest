# Card-button feedback and relative dates — 2026-10-15

Owner reports automatic refresh, focus outlines, error styling and VoiceOver work
on their current Mac. Card-button outlines/hover and long last-played timestamps
required the follow-up below. Other devices and the previously untried data,
slow-storage, heavy-artwork/log and whole-app performance checks remain pending.

## Corrections

Card actions already use `Button.svelte`. Card CSS had replaced its border with
the same color as the hover highlight, so that highlight could not change visibly.
It also replaced the shared raised/drop shadow. Both overrides are removed;
translucent surfaces and blur remain, while the standard button owns borders,
hover/push/press/focus and disabled feedback. No separate card-button implementation
or duplicated hover/press selectors were introduced.

World dates use the reusable `relativeTime` formatter, with native locale plural
forms and word order for all seven languages. Examples: “Last played: 1 hour ago”
and “Last played: 2 days ago”. Very recent/future clock-skew timestamps show the
localized equivalent of “now”; absent/invalid timestamps are omitted. The visible
list updates each minute; its timer stops when no longer subscribed. Month/year
values are approximate relative durations, not calendar dates.

## Validation

- Svelte diagnostics: zero errors/warnings.
- 24 focused Chromium tests and the same 24 WebKit/Retina tests passed.
- Coverage checks actual border changes on hover and shadow changes while pressed
  for world/server/content card actions, retained backdrop transparency, stable
  icon rendering, localized singular/plural dates, invalid/future timestamps and
  a card's text changing from one day ago to two days ago without reopening it.

Pause for human review of these two visual/text corrections. Previously recorded
passes remain historical observations; no release is published by this change.

Application revision: `23b7a47a0386f0c9797549675b2d35d5d357c8fd`. The optimized local app was rebuilt
and its ad-hoc signature passed deep/strict verification.
[Artifact identity](evidence/2026-10-15-card-feedback/candidate.json),
[build log](evidence/2026-10-15-card-feedback/build.txt),
[Chromium checks](evidence/2026-10-15-card-feedback/chromium.txt),
[WebKit checks](evidence/2026-10-15-card-feedback/webkit.txt).
