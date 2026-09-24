---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page records known limitations; it is not an exhaustive compatibility guarantee for every Office feature or third-party extension. Check `data.warnings` after loading a deck and see [OpenXML conformance](/architecture/openxml-conformance) for the formal coverage manifest.
:::

## Core engine (`pptx-viewer-core`)

| Feature         | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ppt` export   | Partial                            | Ink, SmartArt, charts and 3D models now reopen in PowerPoint as editable objects through an embedded OOXML round-trip package (verified by reopening in PowerPoint over COM); only PowerPoint 97-2003 itself sees the fallback. Still lossy: images other than PNG/JPEG become a placeholder, a deck's own master text-style overrides are not written, video and non-WAV audio degrade to a picture, and encrypted `.ppt` import supports RC4 CryptoAPI only. See [OpenXML conformance](/architecture/openxml-conformance#ppt-export-ceiling). |
| SmartArt layout | Approximate without cached drawing | Decks saved without the cached `dsp:drawing` are laid out by a per-point DiagramML engine (67 layouts) or the older family interpreter. Against 229 COM-authored gallery fixtures, 227 produce PowerPoint's set of shapes and 87 match its geometry within 1% (110 within 5%); font sizes rarely match exactly. Picture, timeline and numbered-list layouts remain furthest off. See [OpenXML conformance](/architecture/openxml-conformance#smartart-layout-ground-truth) for the measurement evidence.                                        |

### Animation authoring

An effect authored in the animation panel is reconciled into the slide's existing `p:timing` tree; the deck's own effects are left byte-identical. Known gaps:

- **A few saved effects still fall back to a fade in PowerPoint.** Entrance, exit and emphasis effects are written with PowerPoint's own behaviour tree (Fly In, Float, Bounce, Grow & Turn, the filter reveals, Pulse, Teeter, Wave and others, verified by reopening in PowerPoint); Crawl and Spiral still save as a fade, and Blink is an approximation.
- **Some filter families and presets are approximated on playback:** `strips` plays as an edge wipe, `wedge` as a growing hexagon, `slide`/`cover`/`uncover`/`push`/`pull` share one fly-in, and 45 PowerPoint preset IDs play a substitute effect (for example Basic Swivel and Float Out play as a fade). Box, Circle, Diamond and Plus play only their "out" direction.
- **Partially supported:** the `p14:bounceEnd` settle curve is an approximation not yet fitted against PowerPoint's own frames; triggers on a media bookmark play correctly but cannot be authored in the animation panel yet; per-letter ripple inside a by-paragraph build is not played; p15 transitions play when present in a file but cannot be authored, and their direction options are ignored.

### Detecting gaps at runtime

You do not have to guess whether a file hit a limitation. The load pipeline reports many unsupported or approximated constructs (not all: animation substitutes, for example, raise no warning) on `data.warnings`, typed as `PptxCompatibilityWarning`:

```ts
interface PptxCompatibilityWarning {
	code: string; // stable machine-readable code
	message: string;
	severity: 'info' | 'warning';
	scope: 'presentation' | 'slide' | 'element' | 'save';
	slideId?: string; // present for slide/element-scoped warnings
	elementId?: string;
	xmlPath?: string; // where in the package the construct lives
}
```

Check `data.warnings` after `load()` (and after `save()`) if your application needs to surface fidelity notices to users or gate features per file.

See [Runtime Environments](/guide/runtime-environments) for where each part of `pptx-viewer` runs (browser / Node.js / Web Worker) and platform-specific behaviour that follows from the browser sandbox rather than from a missing feature.

## Framework viewers (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning CSS-based rendering trades some visual effects for fidelity elsewhere
Slides render as HTML/CSS rather than Canvas, giving sharp text at any zoom, native accessibility, and DOM interactivity. The tradeoff is that a few PowerPoint effects have no exact CSS equivalent and are approximated.
:::

### Visual effect approximations

| Effect                                                                                      | Status                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-D shapes and scenes (`a:sp3d` / `a:scene3d`)                                              | Metal residual                                  | Metal materials used to wash out under high-elevation light rigs; the specular light now has its own capped elevation, re-fit against 134 PowerPoint renders (mean absolute error 75.0 to 36.4 on a 0-255 scale), so a smaller residual remains. The 2026-09-16 relaxedInset/slope/hardEdge bevel fix has not yet been re-verified against a fresh PowerPoint render. See [Visual Effect Fidelity](/guide/visual-effects) for the provenance. |
| WordArt envelope warps (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Can interior and fonts without files unverified | The can presets now place glyphs by PowerPoint's measured linear spacing law (COM-derived, independent of the curve adjust value). Still open: re-measuring the remaining interior outline error of the can presets against PowerPoint, and validating against PowerPoint the traced-outline path used for fonts whose file is not obtainable. See [Visual Effect Fidelity](/guide/visual-effects) for the provenance.                        |

Reflections, soft edges and path gradients are also approximations, but hold up well against real PowerPoint; see [Visual Effect Fidelity](/guide/visual-effects) for the technique and the COM-measured evidence behind each one.

### Known rendering and editing gaps (2026-09 audit)

A September 2026 audit against real PowerPoint found these open gaps; fixes are in progress:

- **Saving an edited slide can lose detail.** A slide is rewritten when anything on it changes, and the rewrite can drop equations, turn soft line breaks into paragraphs, pin inherited formatting (anchors, insets, autofit, bullets, master fonts) onto untouched shapes, flatten theme backgrounds, and shift modern-comment timestamps by the local time zone. Unedited slides round-trip cleanly.
- **Text:** date fields based on the stock master date placeholder show `datetimeFigureOut`; theme per-script fonts (Japanese, Thai, Devanagari, Arabic) are not applied; run gradient fills restart on every word; picture bullets show a plain bullet; vertical text modes, text columns, distributed alignment, mixed run sizes and some text effects (reflection, inner shadow, soft edge) differ from PowerPoint.
- **Charts:** stock, surface, box-and-whisker, pareto, histogram, funnel, treemap, sunburst and waterfall charts differ visibly from PowerPoint; scatter X axes, trendline equations and pie-of-pie are approximate.
- **Tables and pictures:** built-in table styles ignore fill transparency (Themed Style 2 renders invisible), auto-grown rows are clipped by the table frame, table text ignores the master's other-text style, and Recolor Grayscale/Washout are not applied.
- **3D models** ignore the camera, transform and lights authored in PowerPoint.
- **Editor coverage** is a subset of PowerPoint's: Edit Points, Merge Shapes, on-canvas crop handles, Paste Special, many standard shortcuts (paragraph alignment, font size, copy/paste formatting) and several ribbon galleries are not available yet.

## EMF/WMF metafiles (`emf-converter` dependency)

::: info Not this repository's code
`emf-converter` is a separate npm package with its own repository; `pptx-viewer-core` only consumes it. The table below records what that package does today, so treat its own release notes as authoritative if the two ever disagree.
:::

::: warning Canvas API required
Metafile conversion needs `OffscreenCanvas` or `HTMLCanvasElement`. Pure Node.js without a canvas polyfill is not supported for EMF/WMF images (the rest of the core engine runs fine in Node).
:::

| Feature                      | Status                     | Notes                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradient and texture brushes | Compressed texture brushes | GDI+ linear, radial and path gradients render exact stops, presets and transforms, with `WrapMode` tiling at any angle (within 1-6% of Windows GDI+). GDI pattern brushes paint their real tiled pattern (since 3.2.0). EMF+ texture brushes whose embedded bitmap is compressed (the usual case) still render solid black.   |
| Raster operations            | Bitwise ROP2 in paths      | All 256 ROP3 codes are exact for `BitBlt`/`StretchBlt`/`StretchDIBits`, and bitwise ROP2 pen modes are exact for ordinary shapes (since 3.2.0); inside `BeginPath`/`EndPath` paths they are still approximated.                                                                                                               |
| Text and transforms          | Browser font engine        | Glyph metrics can differ from Windows GDI. `ExtTextOut` `dx` arrays, the `LOGFONT` height sign and escapement are honoured; without a `dx` array, spacing depends on the browser's font substitution. Rotated or sheared world transforms apply to vector shapes (since 3.2.0) but not yet to bitmap blits or text placement. |

## Related reading

- [Introduction](/guide/introduction) - what the project supports overall.
- [Architecture](/guide/architecture) - why these tradeoffs exist.
- [OpenXML conformance](/architecture/openxml-conformance) - the formal definition of "supported" used by the coverage manifest.
- [Visual Effect Fidelity](/guide/visual-effects) - CSS/SVG effect approximations confirmed against real PowerPoint.
- [Runtime Environments](/guide/runtime-environments) - where each part of `pptx-viewer` runs, and browser-sandbox platform notes.
