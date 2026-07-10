---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated or read-only. This page lists only what you **cannot** do.
:::

## Core engine (`pptx-viewer-core`)

- **OLE objects are read-only.** Embedded Excel/Word content renders as its preview image, and the embedded file can be downloaded or opened in a new tab, but it cannot be edited in place: a browser cannot run the native application that owns the object.
- **SmartArt layout can be approximate.** Diagrams are decomposed into positioned shapes. When a file carries PowerPoint's own pre-computed drawing data that exact layout is used; when it doesn't, an algorithmic layout engine approximates it, so complex custom layouts may not match PowerPoint pixel-for-pixel.

Everything else round-trips: SmartArt text and structural edits, chart data and formatting, and Strict OOXML files (normalised to Transitional on load, converted back on save) all survive load, edit, and save.

## Framework viewers (React, Vue 3, Angular)

::: warning CSS-based rendering trades some visual effects for fidelity elsewhere
Slides render as HTML/CSS rather than Canvas, giving sharp text at any zoom, native accessibility, and DOM interactivity. The tradeoff: `backdrop-filter` becomes a semi-transparent background, `mix-blend-mode` maps to opacity fallbacks, CSS 3D transforms (`rotateX`/`rotateY`) flatten to 2D, and path gradients approximate as elliptical radials.
:::

- **Fonts** - text uses fonts available in the browser; missing fonts fall back to system defaults, which can shift text metrics and layout. Fonts embedded in the PPTX are injected when present.
- **Media codecs** - audio/video playback depends on browser codec support (WMV and legacy codecs may not play); DRM-protected media will not play.
- **Morph transitions** - elements with no counterpart on the next slide crossfade instead of morphing.
- **Chart direct manipulation varies by chart kind** - bar, line, scatter, and bubble marks can be dragged to new values on the canvas (click a mark to select it, double-click the title to rename it); pie, radar, and stacked marks are click-to-select with values edited in the inspector; map and 3D surface charts render as static SVG.
- **Raster export fidelity** - PNG/JPEG/PDF export goes through `html2canvas`, which cannot reproduce `backdrop-filter`, CSS custom properties, or CSS 3D transforms; approximations are applied and some fidelity is lost. Use the SVG export for a vector alternative.
- **Maximum export resolution** - canvas exports are capped by the browser's maximum canvas size (typically 16384 or 32768 pixels per side).
- **Small screens** - the UI adapts down to ~360px phones, but the most data-dense panels (for example the full chart editor) are best used on a tablet or larger.

## Vanilla JS and Svelte viewers

Both bindings share the same CSS-based rendering (and its tradeoffs, above) but are newer and not
yet at parity with React/Vue/Angular. See [PORTING.md](https://github.com/ChristopherVR/pptx-viewer/blob/main/PORTING.md)
for the full tracked gap.

- **`pptx-vanilla-viewer`** - viewing, presenting, and a first editing pass (behind `editable`:
  select, drag/resize/rotate, inline text editing, undo/redo, delete/duplicate, save/download).
  No property/inspector panel, add-new-element, z-order/group operations, template
  (master/layout) editing, export, animation/transition playback, notes panel, or collaboration.
- **`pptx-svelte-viewer`** - viewing and presenting only, no editing of any kind yet. Element
  rendering is otherwise at parity with vanilla (table/chart/SmartArt/media/ink/OLE all render
  for real); only `contentPart`, `zoom`, and `model3d` fall back to a placeholder in both.

## EMF/WMF metafiles (`emf-converter` dependency)

::: warning Canvas API required
Metafile conversion needs `OffscreenCanvas` or `HTMLCanvasElement`. Pure Node.js without a canvas polyfill is not supported.
:::

- **Gradient brushes are simplified** - GDI+ linear and path gradients render with their primary colour only.
- **No raster operations** - GDI ROP blending modes (XOR, NOT, AND, ...) are not applied.
- **Limited clipping** - single-path clipping only; combined GDI region operations (union/intersect/exclude) are not supported.
- **Maximum canvas size** - output is clamped to 4096x4096 pixels.
- **Font rendering** - text uses the browser's font engine, so glyph metrics can differ from Windows GDI.

## Related reading

- [Introduction](/guide/introduction) - what the project supports overall.
- [Architecture](/guide/architecture) - why these tradeoffs exist.
