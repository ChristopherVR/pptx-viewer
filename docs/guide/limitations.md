---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page records known limitations; it is not an exhaustive compatibility guarantee for every Office feature or third-party extension. Check `data.warnings` after loading a deck and see [OpenXML conformance](/architecture/openxml-conformance) for the formal coverage manifest.
:::

## Core engine (`pptx-viewer-core`)

| Feature         | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.ppt` export   | Partial                            | Ink, SmartArt, charts and 3D models now reopen in PowerPoint as editable objects through an embedded OOXML round-trip package (verified by reopening in PowerPoint over COM); only PowerPoint 97-2003 itself sees the fallback. Still lossy: images other than PNG/JPEG become a placeholder, a deck's own master text-style overrides are not written, video and non-WAV audio degrade to a picture, and encrypted `.ppt` import supports RC4 CryptoAPI only. See [OpenXML conformance](/architecture/openxml-conformance#ppt-export-ceiling).        |
| SmartArt layout | Approximate without cached drawing | Decks saved without the cached `dsp:drawing` are laid out by the interpreter. Against 229 COM-authored gallery fixtures, 227 produce PowerPoint's set of shapes but only 39 match its geometry within 1%: core single-algorithm layouts (basic process/list, cycle, radial, hierarchy, org chart, pyramid) match closely, while picture, timeline, Meet the Team, Text Card and composite list/process layouts can be far off. See [OpenXML conformance](/architecture/openxml-conformance#smartart-layout-ground-truth) for the measurement evidence. |

### Animation authoring

An effect authored in the animation panel is reconciled into the slide's existing `p:timing` tree; the deck's own effects are left byte-identical. Known gaps:

- **Saved entrance/exit effects play as a fade in PowerPoint.** The writer records the right preset but emits only a fade behaviour, so a Fly In saved here plays as a Fade when the file is opened in PowerPoint (this viewer plays it correctly). Several emphasis effects (pulse, wave, bounce, colour wave, blink, shimmer) are written as a no-op.
- **Some filter families and presets are approximated on playback:** `strips` plays as an edge wipe, `wedge` as a growing hexagon, `slide`/`cover`/`uncover`/`push`/`pull` share one fly-in, and 45 PowerPoint preset IDs play a substitute effect (for example Basic Swivel and Float Out play as a fade). Blinds, Checkerboard, Wheel and Random Bars ignore their subtype.
- **Not yet supported:** `p14:bounceEnd`, triggers on a media bookmark (they load as on-click), per-letter ripple inside a by-paragraph build, and authoring the p15 transitions (they play when present in a file, but their direction options are ignored).

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

| Effect                                                                                      | Status                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-D shapes and scenes (`a:sp3d` / `a:scene3d`)                                              | Metal residual                      | Metal materials used to wash out under high-elevation light rigs; the specular light now has its own capped elevation, re-fit against 134 PowerPoint renders (mean absolute error 75.0 to 36.4 on a 0-255 scale), so a smaller residual remains. The 2026-09-16 relaxedInset/slope/hardEdge bevel fix has not yet been re-verified against a fresh PowerPoint render. See [Visual Effect Fidelity](/guide/visual-effects) for the provenance. |
| WordArt envelope warps (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Can presets and fonts without files | The can presets keep a 5-18% horizontal residual because PowerPoint's glyph spacing along the cylinder is not yet derived, and fonts whose file is not obtainable fall back to a per-glyph affine fit (about 1-2% off) instead of the exact outline warp; a very short, heavily stretched paragraph can still slightly cross the neighbouring row. See [Visual Effect Fidelity](/guide/visual-effects) for the provenance.                    |

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

| Feature           | Status                              | Notes                                                                                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradient brushes  | Exact stops; tiling in next release | GDI+ linear and radial gradients render exact colour stops, presets, blend factors and transforms. The next release adds `WrapMode` tiling at any angle and boundary-shaped path gradients (within 1-6% of Windows GDI+ depending on wrap mode). Texture (image) brushes still render solid black.       |
| Raster operations | ROP3 exact in next release          | The next release evaluates all 256 ROP3 codes exactly for `BitBlt`/`StretchBlt`/`StretchDIBits`. Bitwise ROP2 pen modes (AND/OR/XOR) are approximated.                                                                                                                                                   |
| Text              | Browser font engine                 | Glyph metrics can differ from Windows GDI. The next release honours `ExtTextOut` `dx` arrays, the `LOGFONT` height sign and escapement; without a `dx` array, spacing depends on the browser's font substitution. Rotated or sheared world transforms in plain GDI (non-GDI+) metafiles are not applied. |

## Related reading

- [Introduction](/guide/introduction) - what the project supports overall.
- [Architecture](/guide/architecture) - why these tradeoffs exist.
- [OpenXML conformance](/architecture/openxml-conformance) - the formal definition of "supported" used by the coverage manifest.
- [Visual Effect Fidelity](/guide/visual-effects) - CSS/SVG effect approximations confirmed against real PowerPoint.
- [Runtime Environments](/guide/runtime-environments) - where each part of `pptx-viewer` runs, and browser-sandbox platform notes.
