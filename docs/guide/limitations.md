---
title: Limitations
description: What is not supported across the core engine and the viewer bindings - read before adopting the library.
---

# Limitations

::: warning Read this before adopting
`pptx-viewer` covers a large surface of the OpenXML specification, but some things are approximated, read-only, or bounded by the browser platform. This page lists what you **cannot** do, or can only do partially.
:::

## Core engine (`pptx-viewer-core`)

| Feature              | Status                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy binary `.ppt` | Import only, never written                   | `load()` detects the PowerPoint 97-2003 compound file and converts it through the OpenXML pipeline, so a `.ppt` opens and edits like any other deck. Saving always writes `.pptx` (as PowerPoint itself does), and a save name is re-extensioned accordingly. Password-protected `.ppt` files are rejected with `EncryptedPptError`: legacy RC4 encryption is not decrypted. Fidelity is bounded by the format: it predates DrawingML, so there is no theme font scheme to carry over: the converter synthesizes one named "Imported PPT" whose major and minor fonts are both the deck's first collected font (falling back to Arial), and effects with no binary equivalent are degraded. |
| OLE objects          | Read-only                                    | Embedded Excel/Word/PDF/Visio content renders as its preview image; the embedded file can be downloaded or opened in a new tab, but not edited in place: a browser cannot run the native application that owns the object.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| SmartArt layout      | Approximate without cached drawing           | Diagrams are decomposed into positioned shapes. When the file carries PowerPoint's own pre-computed drawing part, that exact layout is used; otherwise an algorithmic layout engine approximates it, so complex custom layouts may not match PowerPoint pixel-for-pixel.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Encryption           | Decrypt both schemes, encrypt Agile only     | Decryption handles ECMA-376 Standard (Office 2007) and Agile (Office 2010+) encryption. Encryption writes the Agile scheme with AES-128 or AES-256 (the default).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Header &amp; footer  | Round-trips; text not yet inherited          | The Header &amp; Footer dialog's flags and its footer/date text load from and save to the slide master, which is where PowerPoint keeps them (`p:hf` is not a legal child of `p:presentation`), so `SlideMaster.HeadersFooters` reports them correctly on reopen. What is not implemented is placeholder-text INHERITANCE: PowerPoint leaves each slide's `ftr` / `dt` placeholder empty and lets it inherit the master's string, and an empty placeholder does not currently reach the canvas, so the footer is invisible in the viewer even though the file carries it.                                                                                                                   |
| Element coordinates  | Rounded to whole pixels                      | Positions and sizes are converted from EMU to pixels (9,525 EMU per pixel) and rounded on load, so sub-pixel EMU offsets are quantized. Presentation-level dimensions keep their exact EMU values (`widthEmu` / `heightEmu`).                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Archive size         | Guarded, configurable                        | Loading enforces a zip-bomb guard: 500 MiB total uncompressed budget by default (raise it via the `maxUncompressedBytes` load option) and a hard cap of 65,536 archive entries. Exceeding either throws `ZipBombError`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Animation authoring  | Presets, timing and order round-trip         | Effects added, retimed, resequenced or deleted in the animation panel are written into the slide's real `p:timing` tree, so PowerPoint plays them. What the panel does **not** author is listed under [Animation authoring](#animation-authoring) below.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Transition authoring | Every modelled type round-trips              | All 58 transition effects (`PptxTransitionType` is 59 members counting `none`), including the Office 2010+/2013+/2016 extension effects, are authored into the markup PowerPoint reads (an `mc:AlternateContent` Choice with a `p:fade` fallback). The remaining gaps are listed under [Transition authoring](#transition-authoring) below.                                                                                                                                                                                                                                                                                                                                                 |
| Ink and handwriting  | Read and round-tripped; authored its own way | PowerPoint's own pen and highlighter ink (a `p:contentPart` referencing an InkML part) loads, renders in all five bindings and survives a save. The editor's own Draw tool writes strokes in a different, also-valid form and does not author pressure. See [Ink and handwriting](#ink-and-handwriting) below.                                                                                                                                                                                                                                                                                                                                                                              |

::: info What does round-trip
Everything else survives load, edit, and save: SmartArt text and structural edits, chart data and formatting, unknown vendor extensions (preserved verbatim), VBA macros, embedded fonts, and Strict OOXML files (normalised to Transitional on load, converted back to Strict on save by default). See [OpenXML conformance](/architecture/openxml-conformance).

"Survives" means the construct comes back, not that its editor-side identity does. Ink is the case to know about: a slide inked in PowerPoint round-trips as ink, but strokes drawn with this editor's own Draw tool are saved as a freeform shape and reopen as one (see [Ink and handwriting](#ink-and-handwriting)).

A file the editor never touched round-trips its **whole** timing tree verbatim, including everything the typed model does not expose (`p:tavLst` keyframes, `p:excl` exclusivity, `p:bldP` build attributes, `@fill` / `@restart`).
:::

### Animation authoring

An effect authored in the animation panel is reconciled into the slide's existing
`p:timing` tree rather than replacing it: the deck's own effects are left byte-identical,
and only the effects this editor added are ever retimed, resequenced or removed. The
editor records which time nodes it owns in a `p:ext` under `p:timing` so a later save can
tell them apart.

Within that, these are the gaps:

| Area                                                                                                                                      | Status                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reordering relative to a deck's own effects                                                                                               | Editor-authored only          | Drag-to-reorder sequences the effects this editor added among themselves; it cannot move them ahead of or behind effects the deck already had.                                                                                                                                                                                                                                                                                                                                    |
| Effect sound (`p:stSnd`), "after animation" dim                                                                                           | No UI                         | The model carries `soundRId` / `afterAnimation`, but no binding exposes a control for them and no relationship is registered for a newly chosen sound.                                                                                                                                                                                                                                                                                                                            |
| Preset coverage in playback                                                                                                               | 42 of 200 non-path preset IDs | PowerPoint's preset catalogue is 266 entries: 68 entrance, 68 exit, 64 emphasis and 66 motion paths. Motion paths are played by a separate path engine; of the other 200, 42 have a dedicated playback effect (39 in `PRESET_ID_TO_EFFECT` plus 3 filter-based emphasis presets). Unmapped presets fall back to a generic fade/pulse that preserves show/hide semantics rather than being dropped. The saved file keeps the real preset ID, so PowerPoint plays the right effect. |
| `p:animRot` / `p:animScale` absolute `from`/`to`, `p:tavLst` keyframes, `p:txEl` paragraph ranges, `p:excl` exclusivity, `p:bldP/@bldLvl` | Parsed, not played            | Round-trip is lossless; the in-app slide show approximates these rather than honouring them.                                                                                                                                                                                                                                                                                                                                                                                      |

### Transition authoring

| Area                                            | Status                    | Notes                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cube / Rotate / Box / Orbit                     | Round-trip as themselves  | PowerPoint has no element of its own for these: it writes all four as `p14:prism`, told apart by `isContent` and `isInverted`. Both flags are now written and read, so each comes back as itself. The legacy generic `prism` token still writes the bare element, which PowerPoint reads as Cube, and therefore reloads as `cube`. |
| Transition duration                             | Authored as `p14:dur`     | `CT_SlideTransition` has no `dur` attribute, so the duration goes out in the Office 2010 namespace with an `mc:Ignorable` declaration on the slide root. Readers older than PowerPoint 2010 fall back to the `spd` speed.                                                                                                          |
| Transition sound                                | Preserved, not authorable | A sound already on a transition round-trips; the sound pickers in the UI are inert and no media part is registered for a new one.                                                                                                                                                                                                  |
| Speed (`slow` / `med` / `fast`), morph `option` | Preserved, no UI          | Both round-trip and drive playback but no binding exposes a control.                                                                                                                                                                                                                                                               |

### Ink and handwriting

Real pen ink is not a shape. PowerPoint writes it as a `p:contentPart` inside an
`mc:AlternateContent` branch, pointing at a separate InkML part that holds the
strokes in the digitizer's own device units. Reading that needs four things to
be right at once, so treat ink support as new: `contentPart` must be in the
`p14` capability set or the whole branch is skipped, InkML's compact difference
encoding must be decoded (PowerPoint writes `100 200,'40'46,"0"-5`, where the
sign doubles as the separator, so splitting on whitespace decodes a 31-point
stroke to a single point), brushes must be found where PowerPoint nests them in
`<inkml:definitions>` rather than as direct children, and the rewritten part
must have exactly one root element.

What holds today:

- A slide inked in PowerPoint loads, renders in **all five bindings**, and
  survives a save. Strokes are normalised from the part's device units into the
  element box, and each takes its colour, width and opacity from its own brush.
- Stroke pressure from the InkML `F` channel drives variable-width rendering.
- A content part whose strokes were not edited keeps its original InkML part
  byte-for-byte; the part is rebuilt only when the stroke list actually changes.

What does not:

| Area                 | Status                         | Notes                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draw tool output     | Freeform stroke shape, not ink | Strokes drawn in the editor are saved as an `a:custGeom` shape with a stroked, unfilled path, not as the `p:contentPart` + InkML part PowerPoint's own pen writes. PowerPoint renders them correctly, but they reopen as a freeform shape rather than as editable ink, and they are not selectable with PowerPoint's ink tools. |
| Authored pressure    | Not written                    | The Draw tool records no per-point pressure, so a drawn stroke has a single width. Pressure that came IN with a file is preserved and rendered.                                                                                                                                                                                 |
| Multi-colour drawing | Collapses to the first stroke  | All strokes of one drawn ink element share one `a:ln`, so a drawing that mixes colours or widths saves with the first stroke's colour and width applied to every path.                                                                                                                                                          |
| InkML channels       | `X`, `Y` and `F`               | Position and pressure are used. Timing, tilt, azimuth and any other declared channel are decoded positionally and then ignored.                                                                                                                                                                                                 |
| Curved traces        | Sampled, not interpolated      | Pressure rendering samples an SVG path's `C` / `Q` curves at their control points and endpoints, so pressure circles on a heavily curved stroke trail the true curve slightly.                                                                                                                                                  |

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

| Effect                                                                                  | Rendered as                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backdrop-filter`-style effects                                                         | Semi-transparent background fallback                                                                                                                                                  |
| Blend modes (`mix-blend-mode`)                                                          | Opacity-based fallbacks                                                                                                                                                               |
| 3D rotations (`rotateX` / `rotateY`)                                                    | Flattened to 2D                                                                                                                                                                       |
| 3D extrusion / bevel / contour / material (`a:sp3d`)                                    | CSS `box-shadow` / `filter` approximation, not true geometry or lighting; `extrusionClr` / `contourClr` colours are honoured                                                          |
| Reflections (`a:effectLst` reflection)                                                  | `-webkit-box-reflect`: renders in Chromium / WebKit only, not Firefox                                                                                                                 |
| Soft edges (`a:softEdge`)                                                               | SVG alpha-feather filter (feathers the edge, not a whole-element blur)                                                                                                                |
| Path gradients                                                                          | Approximated as elliptical radial gradients                                                                                                                                           |
| WordArt envelope warps (`inflate` / `deflate` / `can` / `slant` / ...)                  | CSS transform approximation; path warps (arch / circle / wave) use true SVG `textPath`                                                                                                |
| Cinematic 3-D transitions (`cube`, `box`, `flip`, `rotate`, `pageCurl`, `origami`, ...) | Animated via CSS keyframes (perspective / rotate / curl), not a true 3-D render. `box` reuses the `cube` keyframes: it is Cube's inverted twin and has no distinct CSS approximation. |

### Platform-bound behaviour

| Area                      | Limitation                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts                     | Browser font availability | Text uses fonts available in the browser; missing fonts fall back to system defaults, which can shift text metrics and layout. Fonts embedded in the PPTX are injected when present.                                                                                                                                                                                                                                                                     |
| Media codecs              | Browser codec support     | Audio/video playback depends on the browser (WMV and legacy codecs may not play); DRM-protected media will not play.                                                                                                                                                                                                                                                                                                                                     |
| Morph transitions         | Partial                   | Elements with no counterpart on the next slide crossfade instead of morphing.                                                                                                                                                                                                                                                                                                                                                                            |
| Chart direct manipulation | Varies by chart kind      | Bar, line, area, scatter, and bubble marks can be dragged to new values on the canvas (click a mark to select, double-click the title to rename); every mark also shows a hover tooltip. Pie, doughnut, radar, and stacked/percent-stacked marks are click-to-select with values edited in the inspector. Map and 3D surface charts render as static SVG. All five bindings (React, Vue, Angular, Svelte, and vanilla) support the full interaction set. |
| Raster export             | `html2canvas` fidelity    | PNG/JPEG/PDF export rasterizes the DOM through `html2canvas`, which cannot reproduce `backdrop-filter`, CSS custom properties, or CSS 3D transforms; approximations are applied and some fidelity is lost. Use the SVG export for a vector alternative.                                                                                                                                                                                                  |
| Export resolution         | Browser canvas cap        | Canvas exports are capped by the browser's maximum canvas size (typically 16,384 or 32,768 pixels per side).                                                                                                                                                                                                                                                                                                                                             |
| Small screens             | Dense panels need space   | The UI adapts down to ~360px phones, but the most data-dense panels (for example the full chart editor) are best used on a tablet or larger.                                                                                                                                                                                                                                                                                                             |

## EMF/WMF metafiles (`emf-converter` dependency)

::: info Not this repository's code
`emf-converter` is a separate npm package with its own repository; `pptx-viewer-core` only consumes it. The table below records what that package does today, so treat its own release notes as authoritative if the two ever disagree.
:::

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
