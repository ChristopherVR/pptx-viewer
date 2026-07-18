---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page lists what you **cannot** do, or can only do partially.
:::

## Core engine (`pptx-viewer-core`)

| Feature              | Status                                   | Notes                                                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legacy binary `.ppt` | Not supported                            | `load()` rejects non-ZIP input with an explicit error (`"Legacy .ppt is not supported."`). Convert to `.pptx` first.                                                                                                                                                     |
| OLE objects          | Read-only                                | Embedded Excel/Word/PDF/Visio content renders as its preview image; the embedded file can be downloaded or opened in a new tab, but not edited in place: a browser cannot run the native application that owns the object.                                               |
| SmartArt layout      | Approximate without cached drawing       | Diagrams are decomposed into positioned shapes. When the file carries PowerPoint's own pre-computed drawing part, that exact layout is used; otherwise an algorithmic layout engine approximates it, so complex custom layouts may not match PowerPoint pixel-for-pixel. |
| Encryption           | Decrypt both schemes, encrypt Agile only | Decryption handles ECMA-376 Standard (Office 2007) and Agile (Office 2010+) encryption. Encryption writes the Agile scheme with AES-128 or AES-256 (the default).                                                                                                        |
| Element coordinates  | Rounded to whole pixels                  | Positions and sizes are converted from EMU to pixels (9,525 EMU per pixel) and rounded on load, so sub-pixel EMU offsets are quantized. Presentation-level dimensions keep their exact EMU values (`widthEmu` / `heightEmu`).                                            |
| Archive size         | Guarded, configurable                    | Loading enforces a zip-bomb guard: 500 MiB total uncompressed budget by default (raise it via the `maxUncompressedBytes` load option) and a hard cap of 65,536 archive entries. Exceeding either throws `ZipBombError`.                                                  |

::: info What does round-trip
Everything else survives load, edit, and save: SmartArt text and structural edits, chart data and formatting, animations, unknown vendor extensions (preserved verbatim), VBA macros, embedded fonts, and Strict OOXML files (normalised to Transitional on load, converted back to Strict on save by default). See [OpenXML conformance](/architecture/openxml-conformance).
:::

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

## Runtime environments

| Environment              | Works     | Caveats                                                                                                                                                                              |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser                  | Yes       | The full feature set: parsing, rendering, editing, export, collaboration.                                                                                                            |
| Node.js (and serverless) | Core only | `pptx-viewer-core` (load, edit, save, Markdown/SVG conversion, encryption) is DOM-free. The UI bindings, raster export (`html2canvas`), and EMF/WMF conversion are browser features. |
| Web Worker               | Core only | Same scope as Node.js: the engine has no DOM dependency.                                                                                                                             |

## Framework viewers (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning CSS-based rendering trades some visual effects for fidelity elsewhere
Slides render as HTML/CSS rather than Canvas, giving sharp text at any zoom, native accessibility, and DOM interactivity. The tradeoff is that a few PowerPoint effects have no exact CSS equivalent and are approximated.
:::

### Visual effect approximations

| Effect                               | Rendered as                                 |
| ------------------------------------ | ------------------------------------------- |
| `backdrop-filter`-style effects      | Semi-transparent background fallback        |
| Blend modes (`mix-blend-mode`)       | Opacity-based fallbacks                     |
| 3D rotations (`rotateX` / `rotateY`) | Flattened to 2D                             |
| Path gradients                       | Approximated as elliptical radial gradients |

### Platform-bound behaviour

| Area                      | Limitation                | Notes                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts                     | Browser font availability | Text uses fonts available in the browser; missing fonts fall back to system defaults, which can shift text metrics and layout. Fonts embedded in the PPTX are injected when present.                                                                                               |
| Media codecs              | Browser codec support     | Audio/video playback depends on the browser (WMV and legacy codecs may not play); DRM-protected media will not play.                                                                                                                                                               |
| Morph transitions         | Partial                   | Elements with no counterpart on the next slide crossfade instead of morphing.                                                                                                                                                                                                      |
| Chart direct manipulation | Varies by chart kind      | Bar, line, scatter, and bubble marks can be dragged to new values on the canvas (click a mark to select, double-click the title to rename). Pie, radar, and stacked marks are click-to-select with values edited in the inspector. Map and 3D surface charts render as static SVG. |
| Raster export             | `html2canvas` fidelity    | PNG/JPEG/PDF export rasterizes the DOM through `html2canvas`, which cannot reproduce `backdrop-filter`, CSS custom properties, or CSS 3D transforms; approximations are applied and some fidelity is lost. Use the SVG export for a vector alternative.                            |
| Export resolution         | Browser canvas cap        | Canvas exports are capped by the browser's maximum canvas size (typically 16,384 or 32,768 pixels per side).                                                                                                                                                                       |
| Small screens             | Dense panels need space   | The UI adapts down to ~360px phones, but the most data-dense panels (for example the full chart editor) are best used on a tablet or larger.                                                                                                                                       |

## EMF/WMF metafiles (`emf-converter` dependency)

::: warning Canvas API required
Metafile conversion needs `OffscreenCanvas` or `HTMLCanvasElement`. Pure Node.js without a canvas polyfill is not supported for EMF/WMF images (the rest of the core engine runs fine in Node).
:::

| Feature           | Status              | Notes                                                                       |
| ----------------- | ------------------- | --------------------------------------------------------------------------- |
| Gradient brushes  | Simplified          | GDI+ linear and path gradients render with their primary colour only.       |
| Raster operations | Not applied         | GDI ROP blending modes (XOR, NOT, AND, ...) are ignored.                    |
| Clipping          | Single path only    | Combined GDI region operations (union/intersect/exclude) are not supported. |
| Output size       | Clamped             | Output is clamped to 4096 x 4096 pixels.                                    |
| Text              | Browser font engine | Glyph metrics can differ from Windows GDI.                                  |

## Related reading

- [Introduction](/guide/introduction) - what the project supports overall.
- [Architecture](/guide/architecture) - why these tradeoffs exist.
- [OpenXML conformance](/architecture/openxml-conformance) - the formal definition of "supported" used by the coverage manifest.
