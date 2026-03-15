/**
 * Core preset clip-paths: basic shapes, rectangle variants, and arrows.
 *
 * Split from the full OOXML preset geometry map for file-size compliance.
 * Each entry maps a lowercase OOXML preset geometry name to a CSS
 * `clip-path` value (a `polygon(...)`, `ellipse(...)`, `circle(...)`,
 * or `inset(...)` expression). Entries with `undefined` values indicate
 * shapes that are handled by other means (e.g. `border-radius` for
 * rounded rectangles, or special-case rendering for cylinders).
 *
 * Format: `lowercaseOoxmlName: "css-clip-path-value" | undefined`
 */

/**
 * Core clip-path lookup for basic shapes, rectangle variants, and arrows.
 *
 * Merged into the master `PRESET_SHAPE_CLIP_PATHS` record by
 * `preset-shape-clip-paths.ts`.
 */
export const CLIP_PATHS_CORE: Record<string, string | undefined> = {
  // ── Lines ─────────────────────────────────────────────────────────────
  line: undefined, // rendered as a line element, not clipped
  lineinv: undefined, // inverse line — rendered as a line element

  // ── Basic Shapes ──────────────────────────────────────────────────────
  rect: undefined, // no clip needed — full rectangle
  roundrect: undefined, // handled by border-radius
  ellipse: "ellipse(50% 50% at 50% 50%)",
  oval: "ellipse(50% 50% at 50% 50%)",
  triangle: "polygon(50% 0%, 0% 100%, 100% 100%)",
  rttriangle: "polygon(0% 0%, 100% 100%, 0% 100%)",
  righttriangle: "polygon(0% 0%, 100% 100%, 0% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  parallelogram: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)",
  trapezoid: "polygon(18% 0%, 82% 0%, 100% 100%, 0% 100%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  heptagon:
    "polygon(50% 0%, 89% 19%, 100% 61%, 78% 98%, 22% 98%, 0% 61%, 11% 19%)",
  octagon:
    "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  decagon:
    "polygon(50% 0%, 79% 5%, 97% 25%, 100% 50%, 97% 75%, 79% 95%, 50% 100%, 21% 95%, 3% 75%, 0% 50%, 3% 25%, 21% 5%)",
  dodecagon:
    "polygon(50% 0%, 75% 7%, 93% 25%, 100% 50%, 93% 75%, 75% 93%, 50% 100%, 25% 93%, 7% 75%, 0% 50%, 7% 25%, 25% 7%)",
  pie: "polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)",
  piewedge: "polygon(100% 0%, 100% 100%, 0% 100%, 0% 55%, 55% 0%)",
  chord: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  frame:
    "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 15%, 15% 15%, 15% 85%, 85% 85%, 85% 15%, 0% 15%)",
  halfframe: "polygon(0% 0%, 100% 0%, 100% 15%, 15% 15%, 15% 100%, 0% 100%)",
  cross:
    "polygon(33% 0%, 67% 0%, 67% 33%, 100% 33%, 100% 67%, 67% 67%, 67% 100%, 33% 100%, 33% 67%, 0% 67%, 0% 33%, 33% 33%)",
  plus: "polygon(33% 0%, 67% 0%, 67% 33%, 100% 33%, 100% 67%, 67% 67%, 67% 100%, 33% 100%, 33% 67%, 0% 67%, 0% 33%, 33% 33%)",
  corner: "polygon(0% 0%, 60% 0%, 60% 40%, 100% 40%, 100% 100%, 0% 100%)",
  diagstripe: "polygon(0% 100%, 0% 50%, 50% 0%, 100% 0%)",
  donut: "circle(50% at 50% 50%)",
  nosmoking: "circle(50% at 50% 50%)",
  blockarc:
    "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%, 25% 85%, 10% 50%, 25% 15%)",
  heart:
    "polygon(50% 20%, 75% 0%, 100% 10%, 100% 40%, 50% 100%, 0% 40%, 0% 10%, 25% 0%)",
  lightningbolt:
    "polygon(38% 0%, 62% 36%, 50% 36%, 80% 100%, 38% 58%, 50% 58%, 20% 0%)",
  sun: "polygon(50% 0%, 57% 15%, 68% 5%, 67% 20%, 80% 10%, 75% 25%, 90% 20%, 82% 32%, 100% 32%, 85% 42%, 100% 50%, 85% 58%, 100% 68%, 82% 68%, 90% 80%, 75% 75%, 80% 90%, 67% 80%, 68% 95%, 57% 85%, 50% 100%, 43% 85%, 32% 95%, 33% 80%, 20% 90%, 25% 75%, 10% 80%, 18% 68%, 0% 68%, 15% 58%, 0% 50%, 15% 42%, 0% 32%, 18% 32%, 10% 20%, 25% 25%, 20% 10%, 33% 20%, 32% 5%, 43% 15%)",
  moon: "polygon(40% 0%, 10% 30%, 10% 70%, 40% 100%, 100% 100%, 75% 70%, 75% 30%, 100% 0%)",
  cloud: "ellipse(50% 50% at 50% 50%)",
  smileyface: "ellipse(50% 50% at 50% 50%)",
  foldedcorner: "polygon(0% 0%, 100% 0%, 100% 80%, 80% 100%, 0% 100%)",
  can: undefined, // cylinder — rendered as special case
  cylinder: undefined,
  cube: "polygon(10% 0%, 100% 0%, 100% 90%, 90% 100%, 0% 100%, 0% 10%)",
  bevel: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  funnel: "polygon(0% 0%, 100% 0%, 60% 40%, 60% 100%, 40% 100%, 40% 40%)",
  teardrop: "polygon(50% 0%, 100% 50%, 50% 100%, 15% 85%, 0% 50%)",
  plaque: "inset(0 round 18px)",
  arc: "polygon(50% 0%, 67% 2%, 81% 10%, 92% 22%, 98% 38%, 100% 50%, 98% 62%, 92% 78%, 81% 90%, 67% 98%, 50% 100%, 50% 75%, 58% 74%, 66% 70%, 72% 64%, 76% 56%, 78% 50%, 76% 44%, 72% 36%, 66% 30%, 58% 26%, 50% 25%)",
  wave: "polygon(0% 20%, 25% 0%, 75% 20%, 100% 0%, 100% 80%, 75% 100%, 25% 80%, 0% 100%)",
  doublewave:
    "polygon(0% 15%, 25% 0%, 50% 15%, 75% 0%, 100% 15%, 100% 85%, 75% 100%, 50% 85%, 25% 100%, 0% 85%)",

  // ── Rectangle Variants ────────────────────────────────────────────────
  round1rect: "inset(0 0 0 0 round 0 18px 0 0)",
  round2samerect: "inset(0 round 18px 18px 0 0)",
  round2diagrect: "inset(0 round 18px 0 18px 0)",
  snip1rect: "polygon(0% 0%, 85% 0%, 100% 15%, 100% 100%, 0% 100%)",
  snip2samerect:
    "polygon(15% 0%, 85% 0%, 100% 15%, 100% 100%, 0% 100%, 0% 15%)",
  snip2diagrect:
    "polygon(15% 0%, 100% 0%, 100% 85%, 85% 100%, 0% 100%, 0% 15%)",
  sniproundrect: "inset(0 round 18px)",
  nonisoscelestrapezoid: "polygon(10% 0%, 80% 0%, 100% 100%, 0% 100%)",
  plaquetabs:
    "polygon(0% 0%, 15% 0%, 15% 15%, 0% 15%, 0% 0%, 100% 0%, 100% 15%, 85% 15%, 85% 0%, 100% 0%, 100% 100%, 85% 100%, 85% 85%, 100% 85%, 100% 100%, 0% 100%, 0% 85%, 15% 85%, 15% 100%, 0% 100%)",
  squaretabs:
    "polygon(0% 0%, 15% 0%, 15% 15%, 0% 15%, 0% 0%, 100% 0%, 100% 15%, 85% 15%, 85% 0%, 100% 0%, 100% 100%, 85% 100%, 85% 85%, 100% 85%, 100% 100%, 0% 100%, 0% 85%, 15% 85%, 15% 100%, 0% 100%)",

  // ── Arrows ────────────────────────────────────────────────────────────
  rightarrow:
    "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)",
  rtarrow:
    "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)",
  leftarrow:
    "polygon(40% 0%, 40% 20%, 100% 20%, 100% 80%, 40% 80%, 40% 100%, 0% 50%)",
  uparrow:
    "polygon(50% 0%, 100% 40%, 80% 40%, 80% 100%, 20% 100%, 20% 40%, 0% 40%)",
  downarrow:
    "polygon(20% 0%, 80% 0%, 80% 60%, 100% 60%, 50% 100%, 0% 60%, 20% 60%)",
  leftrightarrow:
    "polygon(0% 50%, 20% 0%, 20% 25%, 80% 25%, 80% 0%, 100% 50%, 80% 100%, 80% 75%, 20% 75%, 20% 100%)",
  updownarrow:
    "polygon(50% 0%, 100% 20%, 75% 20%, 75% 80%, 100% 80%, 50% 100%, 0% 80%, 25% 80%, 25% 20%, 0% 20%)",
  quadarrow:
    "polygon(50% 0%, 65% 20%, 58% 20%, 58% 42%, 80% 42%, 80% 35%, 100% 50%, 80% 65%, 80% 58%, 58% 58%, 58% 80%, 65% 80%, 50% 100%, 35% 80%, 42% 80%, 42% 58%, 20% 58%, 20% 65%, 0% 50%, 20% 35%, 20% 42%, 42% 42%, 42% 20%, 35% 20%)",
  leftrightuparrow:
    "polygon(50% 0%, 70% 20%, 58% 20%, 58% 42%, 80% 42%, 80% 30%, 100% 50%, 80% 70%, 80% 58%, 58% 58%, 58% 100%, 42% 100%, 42% 58%, 20% 58%, 20% 70%, 0% 50%, 20% 30%, 20% 42%, 42% 42%, 42% 20%, 30% 20%)",
  bentuparrow:
    "polygon(50% 0%, 100% 30%, 75% 30%, 75% 65%, 100% 65%, 100% 100%, 0% 100%, 0% 65%, 25% 65%)",
  curvedrightarrow:
    "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)",
  curvedleftarrow:
    "polygon(40% 0%, 40% 20%, 100% 20%, 100% 80%, 40% 80%, 40% 100%, 0% 50%)",
  curveduparrow:
    "polygon(50% 0%, 100% 40%, 80% 40%, 80% 100%, 20% 100%, 20% 40%, 0% 40%)",
  curveddownarrow:
    "polygon(20% 0%, 80% 0%, 80% 60%, 100% 60%, 50% 100%, 0% 60%, 20% 60%)",
  stripedrightarrow:
    "polygon(0% 25%, 8% 25%, 12% 25%, 12% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 12% 80%, 12% 75%, 8% 75%, 0% 75%)",
  notchedrightarrow:
    "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%, 15% 50%)",
  homeplate: "polygon(0% 0%, 80% 0%, 100% 50%, 80% 100%, 0% 100%)",
  chevron: "polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%, 25% 50%)",
  rightarrowcallout:
    "polygon(0% 0%, 60% 0%, 60% 15%, 75% 15%, 100% 50%, 75% 85%, 60% 85%, 60% 100%, 0% 100%)",
  leftarrowcallout:
    "polygon(40% 0%, 100% 0%, 100% 100%, 40% 100%, 40% 85%, 25% 85%, 0% 50%, 25% 15%, 40% 15%)",
  uparrowcallout:
    "polygon(0% 40%, 15% 40%, 15% 25%, 50% 0%, 85% 25%, 85% 40%, 100% 40%, 100% 100%, 0% 100%)",
  downarrowcallout:
    "polygon(0% 0%, 100% 0%, 100% 60%, 85% 60%, 85% 75%, 50% 100%, 15% 75%, 15% 60%, 0% 60%)",
  leftrightarrowcallout:
    "polygon(25% 0%, 75% 0%, 75% 15%, 85% 15%, 100% 50%, 85% 85%, 75% 85%, 75% 100%, 25% 100%, 25% 85%, 15% 85%, 0% 50%, 15% 15%, 25% 15%)",
  updownarrowcallout:
    "polygon(0% 25%, 15% 25%, 15% 15%, 50% 0%, 85% 15%, 85% 25%, 100% 25%, 100% 75%, 85% 75%, 85% 85%, 50% 100%, 15% 85%, 15% 75%, 0% 75%)",
  quadarrowcallout:
    "polygon(30% 0%, 42% 15%, 42% 25%, 25% 25%, 25% 42%, 15% 42%, 0% 30%, 0% 70%, 15% 58%, 25% 58%, 25% 75%, 42% 75%, 42% 85%, 30% 100%, 70% 100%, 58% 85%, 58% 75%, 75% 75%, 75% 58%, 85% 58%, 100% 70%, 100% 30%, 85% 42%, 75% 42%, 75% 25%, 58% 25%, 58% 15%, 70% 0%)",
  bentarrow:
    "polygon(50% 0%, 100% 35%, 75% 35%, 75% 65%, 100% 65%, 100% 100%, 0% 100%, 0% 65%, 25% 65%)",
  uturnarrow:
    "polygon(30% 0%, 70% 0%, 70% 60%, 100% 60%, 50% 100%, 0% 60%, 30% 60%)",
  circulararrow: "ellipse(50% 50% at 50% 50%)",
  leftcirculararrow: "ellipse(50% 50% at 50% 50%)",
  leftrightcirculararrow: "ellipse(50% 50% at 50% 50%)",
};
