# `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h` formula ground truth

Established 2026-09-06 via real PowerPoint (Office16 x64) COM automation, not
guessed. Method: a blank deck with one rectangle (`GroundTruthRect`, left=200pt
top=150pt width=200pt height=100pt on a 960x720pt slide) had ten entrance
effects applied via `Slide.TimeLine.MainSequence.AddEffect` (Grow And Turn,
Bounce, Boomerang, Credits, Float, Sling, Stretch, Swish, Pinwheel, Spiral),
saved as `.pptx`, and the resulting `ppt/slides/slide1.xml` was inspected
directly. The produced file is kept as
`packages/core/src/__tests__/fixtures/animation-ppt-formula-ground-truth.pptx`.

## The central question: absolute or delta, centre or top-left?

**Answer: `#ppt_x`/`#ppt_y`/`#ppt_w`/`#ppt_h` are constants equal to the
shape's own AUTHORED (static, xfrm-declared) geometry as a fraction of the
slide, evaluated once, not a "current mid-animation" value. `#ppt_x`/`#ppt_y`
are the shape's CENTRE, not its top-left corner.**

The proof is Grow And Turn's own generated markup:

```xml
<p:anim from="(-#ppt_w/2)" to="(#ppt_x)" calcmode="lin" valueType="num">
  ...
  <p:attrName>ppt_x</p:attrName>
</p:anim>
```

`to="(#ppt_x)"` means "land exactly on the shape's own authored position"
(the standard resting point for a fly-in). `from="(-#ppt_w/2)"` only makes
sense as a clean authoring choice if `ppt_x` addresses the shape's CENTRE:
starting the centre at `-ppt_w/2` (half the shape's own width, negated) puts
the shape's TRAILING (right) edge exactly at slide-fraction 0, i.e. the shape
starts precisely off the left edge of the slide with no gap and no overlap.
That only lines up under a centre-based x-axis; under a top-left-based axis
the same value would leave the shape half already on-slide, which is not what
Grow-in-from-the-left looks like. `ppt_w`/`ppt_h` are the shape's own
authored width/height as a fraction of slide width/height (no centre/edge
ambiguity for a size).

## `from`/`to`/`by` live directly on `p:anim`, not only in `p:tavLst`

Confirmed by the same Grow And Turn node: it carries `from`/`to` (and, in a
sibling `p:anim`, `by="(#ppt_h/3+#ppt_w*0.1)"` with `p:cBhvr additive="sum"`,
the little overshoot-and-settle wobble after the main fly-in) as plain XML
ATTRIBUTES on `p:anim` with NO `p:tavLst` child at all. The core parser only
read `p:tavLst` before this change, so this specific shape of node was
silently dropped from `attributeAnimations` entirely (not "left unguessed",
literally invisible). `by` is a genuine DELTA (added to wherever the
attribute already stands, matching `additive="sum"`, and combined with
`autoRev` on that sibling for the there-and-back wobble); `from`/`to` are
ABSOLUTE per the centre/size convention above.

## `p:tav/@fmla` and `$`

Bounce's decaying vertical bounce is written as several successive `p:anim`
nodes (one per bounce, each shorter than the last: 1822/664/664/332/164ms),
each `calcmode="lin"` with a `p:tav/@fmla` on its first stop:

```xml
<p:tav tm="0" fmla="#ppt_y-sin(pi*$)/3">
  <p:val><p:fltVal val="0.5"/></p:val>
</p:tav>
<p:tav tm="100000">
  <p:val><p:fltVal val="1"/></p:val>
</p:tav>
```

The `p:val` on each stop (0.5, 1 here) is a literal number, NOT the position:
it is `$`, PowerPoint's own name for "the value linearly interpolated from
the raw numeric stops at this instant", which `fmla` then transforms into the
real attribute value. This project resolves each stop independently (using
that stop's own literal `p:val` as `$`) rather than reimplementing the
raw-interpolate-then-transform two-pass exactly; see "Scope and limits"
below for what that costs.

## Confirmed formula operators and functions

Across the ten effects: `+ - * /`, unary `-`, parentheses, `sin`, `pi`, and
the `$` and `#ppt_x`/`#ppt_y`/`#ppt_w`/`#ppt_h` variables (leading `#` and
surrounding parentheses both optional and both observed). `abs sqrt cos tan
atan min max e` did not occur in this sample; they are documented ECMA-376 /
PowerPoint animation-formula tokens (same family as SmartArt's `constrLst`
formula language) and are implemented for completeness, but are unverified
against a real authored file.

## What is now played vs. still falls back

The shared formula evaluator (`animation-ppt-formula.ts`) can compute a
formula exactly without knowing the shape's real geometry ONLY when the
formula is affine (linear) in its OWN target attribute and does not depend on
the other three geometry variables: this covers every `ppt_x`/`ppt_y` offset
form (`#ppt_x`, `#ppt_x+.4`, `#ppt_x-0.0242`, ...) and every `ppt_w`/`ppt_h`
scale form (`#ppt_w`, `#ppt_w*.05`, literal `0`, ...) observed above, which is
Bounce, Boomerang, Float, and the position/size components of the other
sampled effects in full. `animation-attribute-transform.ts` detects this by
evaluating the formula at three probe points; formulas that are not affine in
their own axis, or that vary when a DIFFERENT geometry variable is probed
(Grow And Turn's `-#ppt_w/2` on a `ppt_x` node, and its `by` wobble mixing
`ppt_h` and `ppt_w`) are correctly rejected rather than guessed, because they
would need the shape's real rendered box, which is not threaded into the
animation timeline builder (a deliberate scope boundary, not an oversight:
threading it would mean changing the signature of `PresentationAnimationController.fromSlide`
and, therefore, its one call site in each of the five bindings, for a case
this ground-truth run shows affects one effect family, not most of them).
A rejected component falls back to that effect's canned preset timing exactly
as before, so no formula is ever guessed in the wrong direction.
