# Editor appearance

## Baseline and scope

React on port 4173 is the visual reference for the five bindings. Preserve the
compact Office-style editor, existing light/dark themes and all editing actions.
Changes to the editor chrome must reach React, Vue, Angular, Svelte and Vanilla.

## Ownership

- Theme colors come from the existing `--pptx-*` variables and shared theme presets.
- Editor layout and CSS belong to `packages/shared/src/render/editor-chrome/`.
- Bindings attach semantic `data-pptx-chrome` hooks and render the shared stylesheet.
- Framework state and event wiring remain in each binding.
- Demo upload styles live separately in `demos/shared/dropzone.css`.

## Layout

- Title bar: existing shared 36px metrics.
- Ribbon: 32px primary row, 35px tabs, at least 82px content, 1px bottom border.
- Labelled controls: 6px icon-to-label spacing. Split buttons have joined inner
  edges. Font family and size fields reserve 120px and 64px, respectively, so
  selection changes never move neighboring controls.
- Slide rail: 180px default width. Reserve space for the number and padding before
  sizing the preview; preserve the authored aspect ratio when the rail is resized.
  Rows have a 4px gap. Current slides share a 3px orange marker, highlighted
  background, orange number and 1px preview border. Both ARIA current-slide values
  (`true` and `page`) must receive the same treatment.
- Inspector: existing 288px default width, small bordered cards with 12px gaps.
- Collapsed notes: a full-width 25.5px strip above the existing 29px status bar.
- Fit view: 4px horizontal and 16px vertical padding, maximum scale 1 in the
  ordinary editor. Explicit host overrides and presentation enlargement remain available.
- Theme editor: Design > Edit Theme opens a panel docked to the right of the
  editor body, below the ribbon. Opening or dismissing it must preserve the deck.

## Verification

Use the user's existing five frontend pages. Do not start or stop development
servers independently. Check geometry, selected thumbnails, notes expansion and
theme-editor dismissal as well as package builds, types and focused regressions.
Keep existing mobile sheets and collapsed-ribbon behavior working.

## Font fields

The user prefers the Vue 4175 font-name and point-size fields. Both fields use
12px text with an 18px line height and a 16px chevron in every binding, including
React. This is an explicit exception to the React visual baseline. Widths remain
120px and 64px so decimal point sizes do not move adjacent controls. The existing
shared `pptx-ui-select` owns their trigger, popup, option groups and keyboard
interaction; only binding event handlers apply formatting.

Joined font, paragraph, clipboard and layer-order controls paint one continuous
muted background. Disabled opacity belongs to their buttons, preserving the
group background. Home ribbon artwork belongs to the shared ribbon icon
catalogue; bindings render those nodes where local icon-library versions differ.
