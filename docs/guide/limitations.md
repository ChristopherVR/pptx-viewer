---
title: Limitations
description: What is and isn't supported across the core engine, the React viewer, and the EMF converter — read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers an enormous surface of the OpenXML specification, but some features are intentionally approximated or read-only. The caveats below are grouped by package. Knowing them up front avoids surprises in production.
:::

## Core engine (`pptx-viewer-core`)

::: warning Embedded OLE objects are read-only
OLE objects (embedded Excel, Word, etc.) are recognised and their preview images are displayed, but their internal content **cannot be edited**. OLE2 is an opaque binary container; deserialising and re-serialising the internal object structure (e.g. an embedded Excel workbook) would require embedding the full application runtime.
:::

- **SmartArt uses static shape decomposition** — SmartArt diagrams are decomposed into individual positioned shapes using PowerPoint's own pre-computed drawing data (13 layout types). The shapes are fully editable, but there is no live SmartArt reflow engine — moving or reordering shapes won't automatically recalculate the layout the way PowerPoint's built-in engine does.
- **Chart editing is data-level only** — You can add/remove series, edit data points, add/remove categories, and change chart type. Structural chart properties (axis formatting, legend placement, data labels, trendlines, error bars) are parsed for display but not exposed for programmatic editing.
- **Strict OOXML conformance is normalised** — Office 365 can save files in ISO/IEC 29500 Strict mode, which uses different namespace URIs than the common Transitional (ECMA-376) format. The engine maps 46+ namespace URI pairs on load (Strict → Transitional) and converts back on save. Features relying on strict-only extensions outside these mapped namespaces may not round-trip.

## React viewer (`pptx-viewer`)

::: warning CSS-based rendering trades some visual effects for fidelity elsewhere
Slides render as HTML/CSS rather than Canvas, giving sharp text at any zoom, native accessibility, and DOM interactivity. The tradeoff is that some effects are approximated: `backdrop-filter` becomes a semi-transparent background, `mix-blend-mode` maps to opacity fallbacks, CSS 3D transforms (`rotateX`/`rotateY`) flatten to 2D, and path gradients approximate as elliptical radials.
:::

- **Font availability** — Text renders using fonts available in the browser. Missing fonts fall back to system defaults, which may affect text metrics and layout fidelity. Embedded fonts in the PPTX are deobfuscated and injected into the DOM when available.
- **Embedded media** — Audio/video playback depends on browser codec support (browsers may not support WMV or legacy codecs). DRM-protected media will not play.
- **Animation triggers** — 40+ animation presets are supported with `onClick`, `withPrevious`, `afterPrevious`, `afterDelay`, `onHover`, and `onShapeClick` triggers. Advanced OOXML timing-tree conditions (compound triggers, multiple simultaneous conditions) are parsed but simplified for playback.
- **Morph transitions** — Morph matches elements across slides via three strategies: explicit `!!` naming, element ID matching, and proximity matching (within 300px). Position, size, opacity, rotation, and colour are interpolated. Shape-geometry morphing (between different shape types) and intelligent text-token morphing are not implemented — unmatched elements crossfade.
- **Chart interactivity** — Charts render as static SVG with hover tooltips. They are not editable via the chart surface — use the inspector panel's chart data editor instead.
- **Print and export fidelity** — Raster exports (PNG/JPEG/PDF) go through `html2canvas`, which does not support `backdrop-filter`, CSS custom properties (`var()`), or CSS 3D transforms. The library preprocesses CSS to approximate these, but some fidelity is lost. An SVG export path is available as a vector alternative.
- **Maximum export resolution** — Canvas-based exports are constrained by the browser's maximum canvas size (typically 16384×16384 or 32768×32768 pixels, depending on browser and GPU).
- **Mobile support** — Touch interactions (drag, pinch-zoom) are supported, but the toolbar, inspector panels, and dialogs are designed for desktop viewport sizes.
- **3D models** — Rendering GLB/GLTF 3D models requires optional peer dependencies (`three`, `@react-three/fiber`, `@react-three/drei`). Without them, the element falls back to its poster image — see [Installation](/guide/installation#optional-peer-dependencies).

## EMF converter (`emf-converter`)

::: warning Canvas API required
The library needs either `OffscreenCanvas` (for Web Worker support) or `HTMLCanvasElement` to be available in the runtime. Pure Node.js without a canvas polyfill is not supported.
:::

- **Gradient brushes are simplified** — GDI+ `LinearGradient` and `PathGradient` brush types extract only the primary colour rather than rendering full multi-stop gradient fills. The Canvas 2D API has no direct equivalent for GDI+ path gradients.
- **No raster operations (ROP)** — `SetROP2` is acknowledged, but GDI raster-operation blending modes (XOR, NOT, AND, etc.) have no direct Canvas 2D equivalent and are not applied.
- **Limited clipping** — `IntersectClipRect` and `SelectClipPath` are supported. Complex GDI region clipping (combining multiple regions with union/intersect/exclude) is not, as Canvas 2D only supports a single clip path.
- **Maximum canvas size** — Output is clamped to 4096×4096 pixels to prevent excessive memory use from malformed or very large metafiles.
- **Font rendering** — Text is rendered with the browser's font engine and CSS font matching, so glyph metrics and kerning may differ from the original Windows GDI text rendering.

## Related reading

- [Introduction](/guide/introduction) — what the project supports overall.
- [Architecture](/guide/architecture) — why these tradeoffs exist (CSS rendering, namespace normalisation, deferred image processing).
