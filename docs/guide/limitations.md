---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page lists only what you **cannot** do, or can only do partially. Anything not listed here loads, edits, renders and saves; see [OpenXML conformance](/architecture/openxml-conformance) for the formal coverage manifest.
:::

## Core engine (`pptx-viewer-core`)

| Feature                                                | Status                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ppt` hyperlinks, OLE embeds and unsupported elements | Degrades                           | Ink and SmartArt still export as a rasterised picture: PowerPoint keeps both genuinely editable through an undocumented shape property (`OfficeArtTertiaryFOPT` id `0x3A9`) that a from-scratch reproduction attempt could not replicate. Charts also export as a picture, which matches PowerPoint's own ceiling: it re-embeds a legacy MS Graph object with no public specification, so writing one natively is not planned; 3D models degrade to a picture the same way PowerPoint's own export does, so that is not a gap either. Hyperlinks, click-actions, OLE embeds and WAV audio all round-trip losslessly; see [OpenXML conformance](/architecture/openxml-conformance#ppt-export-ceiling) for the measurement evidence. |
| SmartArt layout                                        | Approximate without cached drawing | When the file carries PowerPoint's own pre-computed drawing, that exact layout is used. Otherwise a DiagramML interpreter rebuilds it, matching PowerPoint's shape set on 226 of 227 measured gallery fixtures and its geometry within 1% for the cycle, radial, hierarchy and pyramid families. Still open: exact font sizes on multi-role item templates, deep org charts beyond the third generation, the snake-connector lane, and one blank paragraph in the Bubble Picture List preset; see [OpenXML conformance](/architecture/openxml-conformance#smartart-layout-ground-truth) for the measurement evidence.                                                                                                              |

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

| Effect                                                                                      | Rendered as                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-D shapes and scenes (`a:sp3d` / `a:scene3d`)                                              | Camera presets, explicit `a:camera` overrides (single-axis and combined), extrusion panels, lighting rigs, bevel profiles and materials are all COM-measured and implemented as exact CSS/SVG techniques (`matrix3d` homographies, `translateZ` side panels, an SVG lighting filter). Two gaps remain: three bevel profiles (`relaxedInset`, `slope`, `hardEdge`) measure a bright-bump-then-dark-trough cross-section that the single monotonic height-map model cannot fully reproduce, and a specular/diffuse elevation-coupling bug surfaced once the light-rig elevation was itself COM-calibrated, oversaturating `metal` and raising `matte`'s mean brightness error to ~47.4 under high-elevation rigs. See [Visual Effect Fidelity](/guide/visual-effects) for the full measurement provenance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| WordArt envelope warps (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Per-glyph outline warping (an exact, point-by-point warp of the glyph's real vector outline when its font file is obtainable) and the vertical envelope are measured and done. Horizontal glyph placement now matches PowerPoint's edge-to-edge box-fill spacing too, dropping an 8-shape fixture's overall interior mean error from ~20.74%/~21.98% to ~9.68%/~9.51%; `inflate`/`deflate` land at ~2.6-3.4%, but the `can` presets (which widen only the gaps between glyphs, not the glyphs themselves) still leave a ~5.3-18.5% residual no alternative horizontal model tested has closed. A multi-paragraph block's rows can no longer grossly invert order, but a deep descender/ascender in a very short, heavily-stretched paragraph can still slightly cross into a neighbouring row (COM-unverified, open). When no font file is obtainable, a per-glyph affine fit stands in for the exact outline warp, accurate to roughly 1-2% for ordinary captions (pre-dates the horizontal fix, not re-measured against it). `wide-glyph-can`'s vanilla-vs-other-bindings slice-count mismatch (a missing shared font-substitution step in vanilla's WordArt renderer) is fixed. See [Visual Effect Fidelity](/guide/visual-effects) for the full measurement provenance. |

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
