---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page lists only what you **cannot** do, or can only do partially. Anything not listed here loads, edits, renders and saves; see [OpenXML conformance](/architecture/openxml-conformance) for the formal coverage manifest.
:::

## Core engine (`pptx-viewer-core`)

| Feature                                                | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.ppt` hyperlinks, OLE embeds and unsupported elements | Degrades                           | Ink, SmartArt, charts and 3D models all export from `.ppt` as a rasterised picture rather than an editable object, because PowerPoint's own genuine-edit path for ink and SmartArt relies on an undocumented shape property, and its chart and 3D fallback matches a legacy format with no public specification. See [OpenXML conformance](/architecture/openxml-conformance#ppt-export-ceiling) for the measurement evidence. |
| SmartArt layout                                        | Approximate without cached drawing | Decks saved without the cached `dsp:drawing` are laid out by the interpreter, which reproduces 226 of the 227 COM-authored gallery fixtures within 1%; see [OpenXML conformance](/architecture/openxml-conformance#smartart-layout-ground-truth) for the measurement evidence.                                                                                                                                                 |

### Animation authoring

An effect authored in the animation panel is reconciled into the slide's existing `p:timing` tree; the deck's own effects are left byte-identical. All 27 `p:animEffect/@filter` SMIL families resolve to a real reveal/conceal effect (25 of them entirely CSS-native; `wipe`/`barn` reuse the directional mask-reveal engine) that matches PowerPoint's own playback, including `pixelate`, which defaults to the same snap-to-end-state behaviour PowerPoint itself shows; see [Visual Effect Fidelity](/guide/visual-effects#pixelate-transition-filter) for the evidence and the opt-in mosaic this renderer can show instead. `image` has no gap to list either: see [OpenXML conformance](/architecture/openxml-conformance#extension-namespace-and-schema-edge-attributes).

### Detecting gaps at runtime

You do not have to guess whether a file hit a limitation. The load pipeline reports every unsupported or approximated construct it encounters on `data.warnings`, typed as `PptxCompatibilityWarning`:

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

| Effect                                                                                      | Status                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-D shapes and scenes (`a:sp3d` / `a:scene3d`)                                              | Three bevel profiles approximate    | The relaxedInset, slope and hardEdge bevels show a bright-then-dark cross-section that the single height-map model cannot reproduce, and metal materials oversaturate under high-elevation light rigs because the specular term is coupled to the diffuse elevation. Everything else in the 3-D model is COM-measured; see [Visual Effect Fidelity](/guide/visual-effects) for the provenance.                                                                              |
| WordArt envelope warps (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Can presets and fonts without files | The can presets keep a 5-18% horizontal residual because PowerPoint's glyph spacing along the cylinder is not yet derived, and fonts whose file is not obtainable fall back to a per-glyph affine fit (about 1-2% off) instead of the exact outline warp; a very short, heavily stretched paragraph can still slightly cross the neighbouring row. See [Visual Effect Fidelity](/guide/visual-effects) for the provenance.                                                  |
| Raster export of large CSS 3-D transforms                                                   | Slightly below html2canvas          | A slide carrying a large explicit CSS perspective transform rasterises a little worse through the default foreignObject export path than through the html2canvas fallback (mean channel difference about 11 units higher on the harness fixture), because Chromium decodes the transformed subtree from an SVG image at lower quality; the deck's own 3-D shapes are unaffected and export better through foreignObject. See [Exporting](/user/exporting) for the fallback. |

Reflections, soft edges and path gradients are also approximations, but hold up well against real PowerPoint; see [Visual Effect Fidelity](/guide/visual-effects) for the technique and the COM-measured evidence behind each one.

## EMF/WMF metafiles (`emf-converter` dependency)

::: info Not this repository's code
`emf-converter` is a separate npm package with its own repository; `pptx-viewer-core` only consumes it. The table below records what that package does today, so treat its own release notes as authoritative if the two ever disagree.
:::

::: warning Canvas API required
Metafile conversion needs `OffscreenCanvas` or `HTMLCanvasElement`. Pure Node.js without a canvas polyfill is not supported for EMF/WMF images (the rest of the core engine runs fine in Node).
:::

| Feature           | Status                      | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradient brushes  | Exact stops; tiling pending | GDI+ linear and radial gradients already render exactly, including colour stops, presets, blend factors and transforms. The pending release adds GDI+ `WrapMode` tiling for axis-aligned linear gradients; angled wrapped gradients and wrapped path gradients still clamp instead of tiling.                                                                         |
| Raster operations | ROP2 exact; ROP3 pending    | GDI ROP2 pen and brush modes already render exactly. The pending release adds exact per-pixel ROP3 for `BitBlt`/`StretchBlt`/`StretchDIBits`: `SRCCOPY`, `SRCPAINT`, `SRCAND`, `SRCINVERT`, `SRCERASE`, `NOTSRCCOPY`, `NOTSRCERASE`, `MERGEPAINT`, `PATCOPY`, `DSTINVERT`, `BLACKNESS`, `WHITENESS`. `MERGECOPY`, `PATPAINT` and `PATINVERT` still degrade to a copy. |
| Text              | Browser font engine         | Glyph metrics can differ from Windows GDI. The pending release honours `ExtTextOut` `dx` arrays exactly, keeps the `LOGFONT` height sign, rotates text by escapement/orientation, and fixes a face-name offset bug; without a `dx` array, glyph spacing still depends on the browser's own font substitution.                                                         |

## Related reading

- [Introduction](/guide/introduction) - what the project supports overall.
- [Architecture](/guide/architecture) - why these tradeoffs exist.
- [OpenXML conformance](/architecture/openxml-conformance) - the formal definition of "supported" used by the coverage manifest.
- [Visual Effect Fidelity](/guide/visual-effects) - CSS/SVG effect approximations confirmed against real PowerPoint.
- [Runtime Environments](/guide/runtime-environments) - where each part of `pptx-viewer` runs, and browser-sandbox platform notes.
