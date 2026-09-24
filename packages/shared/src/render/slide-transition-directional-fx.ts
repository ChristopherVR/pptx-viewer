/**
 * `slide-transition-directional-fx` — direction/pattern-aware `@keyframes` for
 * `vortex`, `ripple` and `glitter`, split out of `p14-transition-keyframes` to
 * keep that module under the project's per-file LOC budget.
 *
 * These three p14 transitions previously played one fixed animation regardless
 * of the authored `@dir`/`@pattern` (COM-verified valid direction sets now live
 * in `TRANSITION_VALID_DIRECTIONS`, core): a deck authored with, say,
 * `p14:vortex dir="d"` played identically to `dir="u"`. The variants below are
 * this project's own approximation (not individually frame-matched against
 * PowerPoint's `CreateVideo` output the way e.g. `slide-transition-cinematic`'s
 * fallOver was), chosen to read as a plausible directional version of the
 * existing non-directional keyframe while genuinely varying per token.
 *
 * @module render/slide-transition-directional-fx
 */

/** Vortex: rotate + scale spiral, biased toward the authored direction. */
export const VORTEX_DIRECTIONAL_KEYFRAMES = `
@keyframes pptx-tr-vortex-in-left { from { transform: translateX(-40%) rotate(720deg) scale(0); opacity: 0; } to { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; } }
@keyframes pptx-tr-vortex-out-left { from { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; } to { transform: translateX(-40%) rotate(-720deg) scale(0); opacity: 0; } }
@keyframes pptx-tr-vortex-in-right { from { transform: translateX(40%) rotate(-720deg) scale(0); opacity: 0; } to { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; } }
@keyframes pptx-tr-vortex-out-right { from { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; } to { transform: translateX(40%) rotate(720deg) scale(0); opacity: 0; } }
@keyframes pptx-tr-vortex-in-up { from { transform: translateY(-40%) rotate(720deg) scale(0); opacity: 0; } to { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; } }
@keyframes pptx-tr-vortex-out-up { from { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; } to { transform: translateY(-40%) rotate(-720deg) scale(0); opacity: 0; } }
@keyframes pptx-tr-vortex-in-down { from { transform: translateY(40%) rotate(-720deg) scale(0); opacity: 0; } to { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; } }
@keyframes pptx-tr-vortex-out-down { from { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; } to { transform: translateY(40%) rotate(720deg) scale(0); opacity: 0; } }
`;

/**
 * Ripple: expanding-ring clip-path, originating from the authored diagonal
 * corner instead of always the slide centre. `TRANSITION_VALID_DIRECTIONS`
 * only offers the four diagonals (`lu`/`ld`/`ru`/`rd`, COM-verified); the
 * unset default keeps the existing centre-origin `pptx-tr-ripple-in`.
 */
export const RIPPLE_DIRECTIONAL_KEYFRAMES = `
@keyframes pptx-tr-ripple-in-lu { from { clip-path: circle(0% at 0% 0%); opacity: 0.5; } 30% { clip-path: circle(20% at 0% 0%); opacity: 0.7; } 60% { clip-path: circle(55% at 0% 0%); opacity: 0.9; } to { clip-path: circle(150% at 0% 0%); opacity: 1; } }
@keyframes pptx-tr-ripple-in-ru { from { clip-path: circle(0% at 100% 0%); opacity: 0.5; } 30% { clip-path: circle(20% at 100% 0%); opacity: 0.7; } 60% { clip-path: circle(55% at 100% 0%); opacity: 0.9; } to { clip-path: circle(150% at 100% 0%); opacity: 1; } }
@keyframes pptx-tr-ripple-in-ld { from { clip-path: circle(0% at 0% 100%); opacity: 0.5; } 30% { clip-path: circle(20% at 0% 100%); opacity: 0.7; } 60% { clip-path: circle(55% at 0% 100%); opacity: 0.9; } to { clip-path: circle(150% at 0% 100%); opacity: 1; } }
@keyframes pptx-tr-ripple-in-rd { from { clip-path: circle(0% at 100% 100%); opacity: 0.5; } 30% { clip-path: circle(20% at 100% 100%); opacity: 0.7; } 60% { clip-path: circle(55% at 100% 100%); opacity: 0.9; } to { clip-path: circle(150% at 100% 100%); opacity: 1; } }
`;

/**
 * Glitter: particle dissolve, biased by direction (a small drift toward the
 * authored edge) and by pattern (diamond keeps the original saturate/contrast
 * dissolve; hexagon adds a hue-rotate sweep so the two patterns read as
 * genuinely different sparkle textures, matching `p14:glitter/@pattern`).
 */
export const GLITTER_DIRECTIONAL_KEYFRAMES = `
@keyframes pptx-tr-glitter-diamond-in-l { from { opacity: 0; transform: translateX(-6%); filter: brightness(1.5) contrast(1.3) blur(2px); } 60% { opacity: 0.7; transform: translateX(-2%); filter: brightness(1.2) contrast(1.1) blur(1px); } to { opacity: 1; transform: translateX(0); filter: brightness(1) contrast(1) blur(0); } }
@keyframes pptx-tr-glitter-diamond-in-r { from { opacity: 0; transform: translateX(6%); filter: brightness(1.5) contrast(1.3) blur(2px); } 60% { opacity: 0.7; transform: translateX(2%); filter: brightness(1.2) contrast(1.1) blur(1px); } to { opacity: 1; transform: translateX(0); filter: brightness(1) contrast(1) blur(0); } }
@keyframes pptx-tr-glitter-diamond-in-u { from { opacity: 0; transform: translateY(-6%); filter: brightness(1.5) contrast(1.3) blur(2px); } 60% { opacity: 0.7; transform: translateY(-2%); filter: brightness(1.2) contrast(1.1) blur(1px); } to { opacity: 1; transform: translateY(0); filter: brightness(1) contrast(1) blur(0); } }
@keyframes pptx-tr-glitter-diamond-in-d { from { opacity: 0; transform: translateY(6%); filter: brightness(1.5) contrast(1.3) blur(2px); } 60% { opacity: 0.7; transform: translateY(2%); filter: brightness(1.2) contrast(1.1) blur(1px); } to { opacity: 1; transform: translateY(0); filter: brightness(1) contrast(1) blur(0); } }
@keyframes pptx-tr-glitter-hexagon-in-l { from { opacity: 0; transform: translateX(-6%); filter: brightness(1.5) contrast(1.3) blur(2px) hue-rotate(20deg); } 60% { opacity: 0.7; transform: translateX(-2%); filter: brightness(1.2) contrast(1.1) blur(1px) hue-rotate(8deg); } to { opacity: 1; transform: translateX(0); filter: brightness(1) contrast(1) blur(0) hue-rotate(0deg); } }
@keyframes pptx-tr-glitter-hexagon-in-r { from { opacity: 0; transform: translateX(6%); filter: brightness(1.5) contrast(1.3) blur(2px) hue-rotate(20deg); } 60% { opacity: 0.7; transform: translateX(2%); filter: brightness(1.2) contrast(1.1) blur(1px) hue-rotate(8deg); } to { opacity: 1; transform: translateX(0); filter: brightness(1) contrast(1) blur(0) hue-rotate(0deg); } }
@keyframes pptx-tr-glitter-hexagon-in-u { from { opacity: 0; transform: translateY(-6%); filter: brightness(1.5) contrast(1.3) blur(2px) hue-rotate(20deg); } 60% { opacity: 0.7; transform: translateY(-2%); filter: brightness(1.2) contrast(1.1) blur(1px) hue-rotate(8deg); } to { opacity: 1; transform: translateY(0); filter: brightness(1) contrast(1) blur(0) hue-rotate(0deg); } }
@keyframes pptx-tr-glitter-hexagon-in-d { from { opacity: 0; transform: translateY(6%); filter: brightness(1.5) contrast(1.3) blur(2px) hue-rotate(20deg); } 60% { opacity: 0.7; transform: translateY(2%); filter: brightness(1.2) contrast(1.1) blur(1px) hue-rotate(8deg); } to { opacity: 1; transform: translateY(0); filter: brightness(1) contrast(1) blur(0) hue-rotate(0deg); } }
`;

/** All directional-fx keyframes concatenated, for one-shot `<style>` injection. */
export const DIRECTIONAL_FX_KEYFRAMES = `${VORTEX_DIRECTIONAL_KEYFRAMES}\n${RIPPLE_DIRECTIONAL_KEYFRAMES}\n${GLITTER_DIRECTIONAL_KEYFRAMES}`;
