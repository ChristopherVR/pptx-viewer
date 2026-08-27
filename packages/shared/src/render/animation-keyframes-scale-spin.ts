/**
 * `animation-keyframes-scale-spin` — CSS `@keyframes` definitions for the
 * `stretch` and `newsflash` SMIL/ECMA-376 `p:animEffect/@filter` families
 * (see `animation-filter-effects`'s module doc for how these fit the rest of
 * the filter fallback). Split out of `animation-keyframes` to keep that
 * file under the repo's file-size guideline; merged back into its
 * `KEYFRAME_DEFINITIONS` lookup table.
 *
 * Neither family has a dedicated mask shape (`animation-mask-reveal`):
 * both are transform-only, not reveals.
 *  - `stretch` is a directional non-uniform SCALE: the element stretches out
 *    from the named edge (pinned there via `transform-origin`) past its
 *    resting size, then snaps back, standing in for the classic "elastic
 *    bar" stretch transition.
 *  - `newsflash` is a spin-and-zoom from/to a near-zero point: rotation
 *    settles to/from 0deg as scale grows/shrinks from/to near zero, with a
 *    small overshoot for a "snap into place" read, approximating
 *    PowerPoint's own Newsflash effect.
 *
 * @module render/animation-keyframes-scale-spin
 */

import type { EffectName } from './animation-timeline-types';

type ScaleSpinEffectName =
	| 'stretchInLeft'
	| 'stretchInRight'
	| 'stretchInTop'
	| 'stretchInBottom'
	| 'stretchOutLeft'
	| 'stretchOutRight'
	| 'stretchOutTop'
	| 'stretchOutBottom'
	| 'newsflashIn'
	| 'newsflashOut';

export const SCALE_SPIN_KEYFRAME_DEFINITIONS: Record<ScaleSpinEffectName, string> = {
	stretchInLeft: `@keyframes pptx-stretchInLeft {
	0% { opacity: 0; transform: scaleX(0.02); transform-origin: left center; }
	60% { opacity: 1; transform: scaleX(1.06); transform-origin: left center; }
	100% { opacity: 1; transform: scaleX(1); transform-origin: left center; }
}`,
	stretchInRight: `@keyframes pptx-stretchInRight {
	0% { opacity: 0; transform: scaleX(0.02); transform-origin: right center; }
	60% { opacity: 1; transform: scaleX(1.06); transform-origin: right center; }
	100% { opacity: 1; transform: scaleX(1); transform-origin: right center; }
}`,
	stretchInTop: `@keyframes pptx-stretchInTop {
	0% { opacity: 0; transform: scaleY(0.02); transform-origin: center top; }
	60% { opacity: 1; transform: scaleY(1.06); transform-origin: center top; }
	100% { opacity: 1; transform: scaleY(1); transform-origin: center top; }
}`,
	stretchInBottom: `@keyframes pptx-stretchInBottom {
	0% { opacity: 0; transform: scaleY(0.02); transform-origin: center bottom; }
	60% { opacity: 1; transform: scaleY(1.06); transform-origin: center bottom; }
	100% { opacity: 1; transform: scaleY(1); transform-origin: center bottom; }
}`,
	// Exit-side `stretch`: the element squeezes back toward the named edge
	// (the mirror of the entrance stretch, no overshoot) rather than being
	// revealed away from it.
	stretchOutLeft: `@keyframes pptx-stretchOutLeft {
	0% { opacity: 1; transform: scaleX(1); transform-origin: left center; }
	100% { opacity: 0; transform: scaleX(0.02); transform-origin: left center; }
}`,
	stretchOutRight: `@keyframes pptx-stretchOutRight {
	0% { opacity: 1; transform: scaleX(1); transform-origin: right center; }
	100% { opacity: 0; transform: scaleX(0.02); transform-origin: right center; }
}`,
	stretchOutTop: `@keyframes pptx-stretchOutTop {
	0% { opacity: 1; transform: scaleY(1); transform-origin: center top; }
	100% { opacity: 0; transform: scaleY(0.02); transform-origin: center top; }
}`,
	stretchOutBottom: `@keyframes pptx-stretchOutBottom {
	0% { opacity: 1; transform: scaleY(1); transform-origin: center bottom; }
	100% { opacity: 0; transform: scaleY(0.02); transform-origin: center bottom; }
}`,
	newsflashIn: `@keyframes pptx-newsflashIn {
	0% { opacity: 0; transform: rotate(-180deg) scale(0.05); }
	70% { opacity: 1; transform: rotate(8deg) scale(1.08); }
	100% { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	// Exit-side `newsflash`: spins and zooms away toward a point, the mirror
	// of the entrance.
	newsflashOut: `@keyframes pptx-newsflashOut {
	0% { opacity: 1; transform: rotate(0deg) scale(1); }
	30% { opacity: 1; transform: rotate(-8deg) scale(1.08); }
	100% { opacity: 0; transform: rotate(180deg) scale(0.05); }
}`,
} satisfies Partial<Record<EffectName, string>>;
