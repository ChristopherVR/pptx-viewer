---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page records known limitations; it is not an exhaustive compatibility guarantee for every Office feature or third-party extension. Check `data.warnings` after loading a deck and see [OpenXML conformance](/architecture/openxml-conformance) for the formal coverage manifest.
:::

## Core engine (`pptx-viewer-core`)

| Feature         | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ppt` export   | Partial                            | Ink, SmartArt, charts and 3D models now reopen in PowerPoint as editable objects through an embedded OOXML round-trip package (verified by reopening in PowerPoint over COM); only PowerPoint 97-2003 itself sees the fallback. Still lossy: images other than PNG/JPEG become a placeholder, a deck's own master text-style overrides are not written, video and non-WAV audio degrade to a picture, and encrypted `.ppt` import supports RC4 CryptoAPI only. See [OpenXML conformance](/architecture/openxml-conformance#ppt-export-ceiling).                                          |
| SmartArt layout | Approximate without cached drawing | Decks saved without the cached `dsp:drawing` are laid out by a per-point DiagramML engine (131 layouts) or the older family interpreter. Against 229 COM-authored gallery fixtures, 228 produce PowerPoint's set of shapes, 126 match its geometry within 1% (161 within 5%) and 114 match every font size. Layouts whose boxes grow with their text (Vertical Bullet List, Vertical Box List), org-chart assistants and the Meet the Team cards remain inexact. See [OpenXML conformance](/architecture/openxml-conformance#smartart-layout-ground-truth) for the measurement evidence. |

### Animation authoring

An effect authored in the animation panel is reconciled into the slide's existing `p:timing` tree; the deck's own effects are left byte-identical. Known gaps:

- **A few saved effects still fall back to a fade in PowerPoint.** Entrance, exit and emphasis effects are written with PowerPoint's own behaviour tree (Fly In, Float, Bounce, Grow & Turn, the filter reveals, Pulse, Teeter, Wave and others, verified by reopening in PowerPoint); Crawl and Spiral still save as a fade, and Blink is an approximation.
- **Some filter families and presets are approximated on playback:** `strips` plays as an edge wipe, `wedge` as a growing hexagon, `slide`/`cover`/`uncover`/`push`/`pull` share one fly-in, and 45 PowerPoint preset IDs play a substitute effect (for example Basic Swivel and Float Out play as a fade).
- **Partially supported:** per-letter ripple inside a by-paragraph build is not played; a `p14:bounceEnd` of 100% (no travel left, which PowerPoint itself renders erratically) is clamped to 95%. Media-bookmark triggers ("On bookmark"), the p15 transitions with their direction options, and the Zoom transition's In/Out direction are authored in all five bindings, and the Bounce End settle curve is fitted to PowerPoint's own frames.

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

| Effect                                                                                      | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3-D shapes and scenes (`a:sp3d` / `a:scene3d`)                                              | Metal residual                     | Metal materials used to wash out under high-elevation light rigs; the specular light now has its own capped elevation, re-fit against 134 PowerPoint renders (mean absolute error 75.0 to 36.4 on a 0-255 scale), so a smaller residual remains. The 2026-09-16 relaxedInset/slope/hardEdge bevel fix has not yet been re-verified against a fresh PowerPoint render. See [Visual Effect Fidelity](/guide/visual-effects) for the provenance.                                                                                                                                                                                                                                                                                                                                  |
| WordArt envelope warps (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Can presets inexact at some depths | Glyphs are placed by arc length along the top and bottom curves. Re-measured against PowerPoint `Slide.Export` (1920 px wide, Noto Sans, Verdana and Arial, 2026-09-25): the can presets score ink IoU 0.94-0.97 with a mean contour error of 0.8-1.7 px (95th percentile 1.5-6 px) at most depths, and `inflate` / `deflate` 0.96-0.97. At 9 of 20 swept `adj` values (`textCanUp` 80000-93333, `textCanDown` 3333-23333) PowerPoint ends one or both text rows about 1.2% of the box width short and leans the glyphs; that is not modelled (IoU 0.73-0.86 there). Fonts whose file is not obtainable use an outline traced from the browser's own rendering, which agrees with the real font file to within 0.002 IoU. See [Visual Effect Fidelity](/guide/visual-effects). |

Reflections, soft edges and path gradients are also approximations, but hold up well against real PowerPoint; see [Visual Effect Fidelity](/guide/visual-effects) for the technique and the COM-measured evidence behind each one.

### Known rendering and editing gaps (2026-09 audit)

A September 2026 audit against real PowerPoint found these gaps that are still open:

- **Saving an edited slide can still touch minor markup.** Equations, line breaks, inherited formatting, master text styles, theme backgrounds, comment timestamps, picture fills, media click actions, run languages, run properties, inner-shadow colours, gradient insets and untouched charts now round-trip; so do bullet colours on an inherited bullet, authored default tab alignment, animation and play-across-slides audio metadata, and an unused comment-author list. A small residue remains on a rewritten slide: some run attributes (`err`, `b`) and ruby-run properties are written out explicitly, some shapes gain an explicit outline width, and `docProps` revision, modified time and slide counts are refreshed. Unedited slides round-trip cleanly.
- **Text:** East Asian line breaking follows PowerPoint's hanging punctuation (`hangingPunct`) and kinsoku rules (`eaLnBrk`) inside a run, but a break between two differently formatted runs of East Asian text still follows the browser's own rules, and a hanging `、` or `。` directly followed by a closing bracket wraps with it instead of hanging (not yet compared with PowerPoint).
- **Charts:** data-label boxes and callouts are sized from an estimate of the label text's width rather than a measurement, and pie labels at the `bestFit` position sit nearer the centre than PowerPoint places them.
- **3D models** ignore the camera, transform and lights authored in PowerPoint.
- **Editor coverage** is a subset of PowerPoint's: several ribbon galleries are not available yet. Edit Points (with the Freeform: Shape and Curve drawing tools), Merge Shapes, on-canvas picture cropping (crop handles, Crop to Aspect Ratio, Fill, Fit), Paste Special, the empty-canvas and element context menus, slides-pane multi-select, real in-place animation preview and the standard editing shortcuts are available in all five bindings.

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
