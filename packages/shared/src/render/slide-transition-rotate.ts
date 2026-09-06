/**
 * `slide-transition-rotate`: the p15/p14 "Rotate" slide transition
 * (`<p14:prism isContent="1"/>`, `prismFamilyTypeForFlags` in
 * `p14-prism-family`), split out of `slide-transition-cinematic` to keep that
 * module under the project's per-file LOC budget.
 *
 * Rotate shares Cube's OOXML element and used to share the fantasy that it was
 * an in-plane 2-D spin+scale, collapsed to a cw/ccw binary that silently
 * dropped the up/down directions. MEASURED via COM `Presentation.CreateVideo`
 * frame extraction (a two-slide deck authored through this SDK's own
 * `SlideBuilder.setTransition`, so the XML PowerPoint reopens is exactly what
 * `PptxSlideTransitionService` writes): Rotate's motion is the same
 * screen-flush-hinge family as Cube - one face shrinks to a thin sliver while
 * the other grows from one as a trapezoid, with no depth gap opening between
 * them - not a flat spinning disc. The keyframes below reproduce that with
 * Cube's own recipe (translateX/Y + rotateY/X, no `translateZ`), under their
 * own `pptx-tr-rotate-*` names with a slightly wider perspective and shallower
 * opacity floor than Cube so the two declarations stay distinct even though
 * the measured motion shape is the same family.
 *
 * @module render/slide-transition-rotate
 */

/**
 * `@keyframes` for every Rotate direction. Folded into
 * `CINEMATIC_TRANSITION_KEYFRAMES` (and from there into the injected
 * `SLIDE_TRANSITION_KEYFRAMES` aggregate every binding shares) so no binding
 * wires this up itself.
 */
export const ROTATE_TRANSITION_KEYFRAMES = `
/* ── Rotate (screen-flush hinge, like Cube, reached via \`isContent="1"\`
   instead of Cube's bare element) ───────────────────────────────────── */
@keyframes pptx-tr-rotate-out-left { from { transform: perspective(1500px) translateX(0) rotateY(0deg); } to { transform: perspective(1500px) translateX(-50%) rotateY(-90deg); opacity: .55; } }
@keyframes pptx-tr-rotate-in-left { from { transform: perspective(1500px) translateX(50%) rotateY(90deg); opacity: .55; } to { transform: perspective(1500px) translateX(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-rotate-out-right { from { transform: perspective(1500px) translateX(0) rotateY(0deg); } to { transform: perspective(1500px) translateX(50%) rotateY(90deg); opacity: .55; } }
@keyframes pptx-tr-rotate-in-right { from { transform: perspective(1500px) translateX(-50%) rotateY(-90deg); opacity: .55; } to { transform: perspective(1500px) translateX(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-rotate-out-up { from { transform: perspective(1500px) translateY(0) rotateX(0deg); } to { transform: perspective(1500px) translateY(-50%) rotateX(90deg); opacity: .55; } }
@keyframes pptx-tr-rotate-in-up { from { transform: perspective(1500px) translateY(50%) rotateX(-90deg); opacity: .55; } to { transform: perspective(1500px) translateY(0) rotateX(0deg); opacity: 1; } }
@keyframes pptx-tr-rotate-out-down { from { transform: perspective(1500px) translateY(0) rotateX(0deg); } to { transform: perspective(1500px) translateY(50%) rotateX(-90deg); opacity: .55; } }
@keyframes pptx-tr-rotate-in-down { from { transform: perspective(1500px) translateY(-50%) rotateX(90deg); opacity: .55; } to { transform: perspective(1500px) translateY(0) rotateX(0deg); opacity: 1; } }
`;
