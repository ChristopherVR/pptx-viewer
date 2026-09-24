---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page records known limitations; it is not an exhaustive compatibility guarantee for every Office feature or third-party extension. Check `data.warnings` after loading a deck and see [OpenXML conformance](/architecture/openxml-conformance) for the formal coverage manifest.
:::

## Core engine (`pptx-viewer-core`)

| Feature         | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ppt` export   | Partial                            | Ink, SmartArt, charts and 3D models now reopen in PowerPoint as editable objects through an embedded OOXML round-trip package (verified by reopening in PowerPoint over COM); only PowerPoint 97-2003 itself sees the fallback. Still lossy: images other than PNG/JPEG become a placeholder, a deck's own master text-style overrides are not written, video and non-WAV audio degrade to a picture, and encrypted `.ppt` import supports RC4 CryptoAPI only. See [OpenXML conformance](/architecture/openxml-conformance#ppt-export-ceiling).                               |
| SmartArt layout | Approximate without cached drawing | Decks saved without the cached `dsp:drawing` are laid out by a per-point DiagramML engine (99 layouts) or the older family interpreter. Against 229 COM-authored gallery fixtures, 226 produce PowerPoint's set of shapes and 97 match its geometry within 1% (128 within 5%); font sizes rarely match exactly. The engine's hierarchy algorithms are not yet as accurate as the older interpreter, so organisation-chart style layouts still use it. See [OpenXML conformance](/architecture/openxml-conformance#smartart-layout-ground-truth) for the measurement evidence. |

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

A September 2026 audit against real PowerPoint found these gaps that are still open:

- **Saving an edited slide can still add or drop minor markup.** Equations, line breaks, inherited formatting, master text styles, theme backgrounds, comment timestamps, picture fills, media click actions, run languages and untouched charts now round-trip; a rewritten slide can still gain default attributes (`mc:Ignorable`, empty-paragraph `lang`, run `dirty`/`smtClean`) and lose a few rare ones (`a:gradFill@flip`, `a:miter@lim`, East Asian font `panose`). Unedited slides round-trip cleanly.
- **Text:** rounding of shrink-on-overflow font sizes, some text effects (reflection, inner shadow, soft edge, glow shape), decimal tabs on a comma, `hangingPunct`, and a few East Asian/Thai numbering schemes differ from PowerPoint.
- **Charts:** surface, box-and-whisker, pareto, histogram, funnel, treemap, sunburst and waterfall charts differ visibly from PowerPoint; pie-of-pie, data-label callouts and display-unit labels are approximate.
- **Animations and transitions:** the Zoom transition's direction, authoring a trigger on a media bookmark, and the exact shape of the `p14:bounceEnd` settle curve are not yet matched to PowerPoint.
- **3D models** ignore the camera, transform and lights authored in PowerPoint.
- **Editor coverage** is a subset of PowerPoint's: Edit Points, Merge Shapes, on-canvas crop handles, the empty-canvas context menu, slides-pane multi-select and several ribbon galleries are not available yet. Paste Special and the standard editing shortcuts (alignment, font size, copy/paste formatting, new slide, hyperlink, find and replace) are available in all five bindings.

## EMF/WMF metafiles (`emf-converter` dependency)

::: info Not this repository's code
`emf-converter` is a separate npm package with its own repository; `pptx-viewer-core` only consumes it. The table below records what that package does today, so treat its own release notes as authoritative if the two ever disagree.
:::

::: warning Canvas API required
Metafile conversion needs `OffscreenCanvas` or `HTMLCanvasElement`. Pure Node.js without a canvas polyfill is not supported for EMF/WMF images (the rest of the core engine runs fine in Node).
:::

| Feature                      | Status              | Notes                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradient and texture brushes | Resampling residual | Gradients, pattern brushes and EMF+ texture brushes (including compressed bitmaps, since 3.3.0) render with exact stops and tiling; the browser's pattern filtering leaves a small edge-smoothing difference from Windows GDI+ (measured in the package README).                                                                             |
| Raster operations            | Exact               | All 256 ROP3 codes and all bitwise ROP2 pen modes, including inside `BeginPath`/`EndPath` paths (since 3.3.0), evaluate exactly.                                                                                                                                                                                                             |
| Text and transforms          | Browser font engine | Glyph metrics can differ from Windows GDI: `ExtTextOut` `dx` arrays, the `LOGFONT` height sign and escapement are honoured, but without a `dx` array spacing depends on the browser's font substitution. Rotated and sheared world transforms apply to shapes, blits and text (since 3.3.0); text under a skew uses a single rotation angle. |

## Related reading

- [Introduction](/guide/introduction) - what the project supports overall.
- [Architecture](/guide/architecture) - why these tradeoffs exist.
- [OpenXML conformance](/architecture/openxml-conformance) - the formal definition of "supported" used by the coverage manifest.
- [Visual Effect Fidelity](/guide/visual-effects) - CSS/SVG effect approximations confirmed against real PowerPoint.
- [Runtime Environments](/guide/runtime-environments) - where each part of `pptx-viewer` runs, and browser-sandbox platform notes.
