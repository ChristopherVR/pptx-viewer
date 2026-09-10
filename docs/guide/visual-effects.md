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

## Related reading

- [Limitations](/guide/limitations) - what is still an open, unresolved gap.
- [OpenXML conformance](/architecture/openxml-conformance) - the package-level (not visual) coverage manifest.
