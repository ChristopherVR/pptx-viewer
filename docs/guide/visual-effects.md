---
title: Visual Effect Fidelity
description: How specific PowerPoint visual effects are reproduced in CSS/SVG, and the COM-measured evidence behind each one.
---

# Visual effect fidelity

Slides render as HTML/CSS/SVG rather than Canvas (sharp text at any zoom, native accessibility, DOM interactivity), so a few PowerPoint effects with no exact CSS/SVG equivalent are reproduced with a specific, deliberate technique instead. This page documents the techniques that have been checked against real PowerPoint output and hold up; see [Limitations](/guide/limitations) for effects that are still open gaps.

## Reflections (`a:effectLst/a:reflection`)

Rendered as a mirrored sibling node that reflects the element's full rendered content: fill, outline and its own text body for a shape or picture, and every child (with its own fill/outline/text) for a group, recursively. `@sx` / `@sy` / `@kx` / `@ky` / `@rot` / `@fadeDir` / `@algn` are all honoured, in every one of the five bindings.

A group's own reflection (with no fill of its own) is honoured too, as are a group's own shadow/glow/soft edge, resolved onto the group's composite raster as a CSS `filter` (never a `box-shadow`, which would shadow the group's bounding rectangle instead of its content). A child inside a reflected group that itself carries a reflection is double-mirrored, matching how PowerPoint composites a group's reflection from the group's already-fully-rendered content (which includes the child's own reflection).

## Soft edges (`a:softEdge`)

Rendered as an SVG filter that feathers only the shape's alpha edge (an erode, then a blur, then a composite back into the original fill), leaving the interior fill/text sharp rather than blurring the whole element.

**COM-measured correction (2026-09-10).** The original implementation fed the authored `@rad` value directly into a single `feGaussianBlur(stdDeviation = rad)` composited `in` the source graphic. That is wrong on both the shape and the width of the transition: a Gaussian blur of a hard edge is 50% opaque exactly AT the un-blurred boundary and does not reach full opacity until roughly 3 radii inward. Measured against real PowerPoint 2016 (`Slide.Export` PNG, a 1280x720 slide, a rectangle with `a:softEdge rad="190500"` = 20px and a second fixture at `rad="381000"` = 40px, sampling a horizontal scanline through the shape's edge):

| Authored radius | Opacity at the boundary | ~50% opacity                | ~100% (saturated)          |
| --------------- | ----------------------- | --------------------------- | -------------------------- |
| 20px            | ~0%                     | ~18px inward (0.9x radius)  | ~34px inward (1.7x radius) |
| 40px            | ~0%                     | ~35px inward (0.88x radius) | ~72px inward (1.8x radius) |

Both radii confirm PowerPoint's own feather is near-transparent exactly at the authored boundary (not 50%) and reaches full opacity at roughly 1.75-1.8x the authored radius (not the ~3x a raw Gaussian blur implies), and the relationship scales linearly with the authored radius. The renderer now erodes the alpha inward by `0.9 x radius` before a narrower blur (`0.3 x radius`, so its own 3-sigma spread is ~0.85x radius) feathers it, landing within about a pixel of both measured curves. Implemented once in `packages/shared/src/render/visual-effects.ts` (`getSoftEdgeSvgFilter`), consumed identically by all five bindings.

## Path gradients (`a:gradFill/a:path`)

`circle` and `shape` path types render as a native elliptical/circular CSS/SVG radial gradient - PowerPoint's own render for those types is genuinely elliptical, so no approximation is needed.

The `rect` path type is different: PowerPoint shades toward the shape's own bounding rectangle, whose isolines are concentric rectangles with square corners (a Chebyshev/L-infinity distance field), which no native CSS or SVG radial gradient can produce (they are all elliptical). `packages/shared/src/render/path-gradient-rect.ts` renders the true rectangular field directly, as a stack of 40 nested, axis-aligned `<rect>` bands (largest first, smallest last).

**COM-measured (2026-09-10).** A fixture with an `a:gradFill path="rect"` (red/green/blue stops, a 30%-inset `a:fillToRect`) exported from PowerPoint 2016 (`Slide.Export` PNG) shows a perfectly smooth, continuous colour ramp with no visible banding at any sampled point (5px steps across the full gradient width), and the flat inner region lands exactly where the authored `fillToRect` inset places it. PowerPoint's own render has no discretisation to match; this renderer's 40 discrete bands are a deliberate trade-off against the alternative (no native squared-corner gradient primitive exists at all), and at 40 steps each visible band spans only a few CSS pixels even across a full-width gradient, which is not perceptible at normal zoom - confirmed by the same smooth-looking output on screen for the measured fixture. The underlying field shape (linear ramp along both axes, symmetric falloff, square isolines) matches PowerPoint's measured colour values exactly.

## Pixelate transition filter (`p:animEffect/@filter="pixelate"`)

Every SMIL filter family `p:animEffect/@filter` can name resolves to a real reveal/conceal effect, matched to PowerPoint's own playback. `pixelate` is the one family where that match is a snap to the end state rather than a gradual transition, because that is what PowerPoint itself shows.

**COM-measured (`e2e/fixtures/pixelate-filter.pptx`, PowerPoint 2016, `Presentation.CreateVideo`, frame-diffed against an otherwise byte-identical control deck with `filter="dissolve"` swapped in).** The `dissolve` control deck visibly dissolves: an early, mid-reveal frame differs pixel-for-pixel from a later, settled one. The `pixelate` deck does not: the earliest and latest frames of its click step are byte-for-byte identical, and the target shape is already fully painted at full opacity from the very first rendered frame of the step. PowerPoint performs no animation at all for `filter="pixelate"`, the same way it treats a build effect it cannot interpret: it silently snaps straight to the resolved end state. `pixelate` is a schema-legal `ST_TransitionFilterType` value (ECMA-376 20.1.8.49) with no host implementation in real PowerPoint.

The renderer's default therefore resolves `pixelate` to the same `cutIn`/`cutOut` keyframes the `p:animEffect/@filter="cut"` family uses (a genuine instant swap, confirmed live: `e2e/animation-pixelate-filter.spec.ts` asserts the entrance plays `pptx-cutIn`, not a gradual reveal), matching PowerPoint's own behaviour rather than animating something PowerPoint never shows. A blocky, content-preserving mosaic reveal (`packages/shared/src/render/animation-pixelate-filter.ts`: self-contained SVG `<filter>` data-URIs stepped through discrete `@keyframes` stops, each visible cell showing the element's own real content) remains available as an explicit, off-by-default option - `pixelateMosaicAnimation` (File > Options > Advanced > Slide Show > "Show a mosaic effect for Pixelate transitions") - for a viewer that would rather show something animating than PowerPoint's own instant swap. Implemented once as a shared decision function (`resolveFilterEffect` in `packages/shared/src/render/animation-filter-effects.ts`, threaded through `PresentationAnimationController.fromSlide`'s `pixelateMosaic` option), consumed identically by all five bindings.

## Cinematic transitions (`cube`, `box`, `flip`, `rotate`, `pageCurl`, `origami`, ...)

This family animates via CSS keyframes (perspective / rotate / curl) on 2-D slide layers rather than a true volumetric 3-D render. That is the deliberate design: every preset in the family gets its own keyframe set tuned to reproduce PowerPoint's own on-screen motion shape, not a generic 3-D scene.

**COM-measured** against PowerPoint 2016 `CreateVideo` frames:

- `cube` / `rotate` share one screen-flush hinge (`cube` bare, `rotate` via `isContent="1"` on the same `<p14:prism>`).
- `box` / `orbit` share a depth-receding hinge that opens a gap and foreshortens both axes (`box` via `isInverted="1"`, `orbit` via `isContent="1" isInverted="1"`).
- `doors` / `window` `horz` opens top/bottom.
- `fallOver` topples the outgoing slide off a top hinge (not the incoming one).
- `reveal` holds a genuine dark gap through the first half before the incoming slide fades in.
- `warp` is a radial zoom-blur burst, not a skew.
- `crush` crumples toward the centre rather than a flat vertical squash.
- `flythrough`, `gallery`, `ferris`, `conveyor`, `switch`, `pageCurl` (single/double), `peelOff`, `drape`, `ripple`, `flash`, `zoom` and `origami` were likewise COM-measured and match the keyframes' motion shape.
- `vortex`, `honeycomb`, `glitter`, `shred`, `fracture`, `curtains` and `airplane` are COM-confirmed to render as many independent fragments, tiles or particles in real PowerPoint (or, for `airplane`, an actual paper-plane silhouette fold); each now renders as a capped set of independently clip-path'd, transform/opacity-animated fragments built from the same measurement (`getFragmentedTransitionDescriptor` in `packages/shared/src/render/slide-transition-fragments.ts`), not a single flat layer.

## WordArt envelope glyph-outline warping (`a:prstTxWarp` inflate/deflate/can)

The `inflate`/`deflate`/`can` "envelope" family of WordArt presets bends text between an independent top and bottom curve, so a glyph's height (not just its baseline) varies with horizontal position. Two techniques cooperate to render this, chosen per glyph based on what is available:

**Glyph-outline warping (exact).** When the glyph's actual font FILE is obtainable, `packages/shared/src/render/text-warp-glyph-outline.ts` parses it with `opentype.js` and maps every point of the glyph's real vector outline (on-curve points and off-curve Bezier control points alike) through the envelope curve sampled at that POINT'S OWN horizontal position, not just the glyph's edges or centre. The glyph then renders as a single warped SVG `<path>` instead of a `<text>` element. This is exact in the sense that PowerPoint's own model is a per-point outline warp; a control point is warped along with its curve, the same approximation PowerPoint's own renderer makes. Unit-tested invariants (`text-warp-glyph-outline.test.ts`): a "straight-line" envelope (top/bottom curve coincides with the glyph's own nominal band) reproduces every point unchanged, and a `can` preset's outline keeps a constant vertical scale across the whole line (the cylinder's top and bottom curves are the SAME radius/sweep, offset by a fixed amount - provable directly from the transcribed guide formulas, see that preset's own doc comment).

A font's actual bytes are obtainable from two sources (`text-warp-outline-font-cache.ts`): a font EMBEDDED in the deck (bytes already in memory from the load pipeline, parsed synchronously, no network) and a Google Fonts catalogue webfont already resolved for on-screen text (`text-warp-outline-webfont-fetch.ts` fetches the actual `.woff2` bytes separately from the CSS `<link>`, best-effort). Both paths are wired identically into all five bindings (React, Vue, Angular, Svelte, Vanilla): each keeps a module-scoped `GlyphOutlineFontCache`, registers embedded fonts synchronously at load time, and registers webfont bytes once fetched, triggering a re-render.

**Per-glyph affine fit (fallback).** When no font file is obtainable - a system font on the reader's machine with no embedded copy and no catalogue match - the glyph still renders correctly, via an affine transform fit to the envelope curve sampled at the glyph's own left/right edges (`glyphEnvelopeMatrix` in `text-warp-glyph-matrix.ts`), split into up to 24 independently-fitted, clipped sub-bands when a single affine would miss too much curvature across an unusually wide glyph (`text-warp-glyph-slicing.ts`). This path is COM-measured directly: the envelope curve itself matches PowerPoint to within ~0.2% mean / ~1.2% max at every preset and adjust value tested, and after slicing, per-glyph rendering for an ordinary caption stays within roughly 1-2%; a short caption of very wide glyphs at `can`'s extreme adjust value (the hardest case) improves from ~6.7-6.9% / ~4.1-4.3% (4-8 glyphs sharing a line) to ~4.9-5.1% / ~2.9-3.1% once sliced. The residual floor there (~1.1-1.2%) lives in the transcribed `arcTo` curve model's own COM-measured deviation at the box's literal edge, not in the affine fit, and applies equally to the exact outline-warp path above (which samples the identical curve function, just at every outline point instead of only the glyph's edges) - so it is not a gap this outline-warping work closes, and is not expected to close without a from-scratch re-derivation of the guide-formula model itself. Whether that literal-edge case has been independently re-measured against real PowerPoint for a genuine outline-rendered `<path>` glyph (as opposed to the underlying curve function, which has) is open; see [Limitations](/guide/limitations) for the current framing of what remains unverified.

## Related reading

- [Limitations](/guide/limitations) - what is still an open, unresolved gap.
- [OpenXML conformance](/architecture/openxml-conformance) - the package-level (not visual) coverage manifest.
