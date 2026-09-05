/**
 * `animation-keyframes-motion-family` - CSS `@keyframes` definitions for the
 * translate-driven entrance and exit effects added to close the OOXML
 * entrance/exit preset catalogue gap (Boomerang, Credits, Float Up/Down,
 * Glide, Curve Up/Down, Drop, Compress). Split out of `animation-keyframes`
 * to keep that file under the repo's file-size guideline; see
 * `animation-keyframes-rotation-family`'s module doc for the same
 * confidence caveat about how these preset IDs were matched.
 *
 * @module render/animation-keyframes-motion-family
 */

import type { EffectName } from './animation-timeline-types';

export type MotionFamilyEffectNameKeys =
	| 'boomerangIn'
	| 'boomerangOut'
	| 'creditsIn'
	| 'creditsOut'
	| 'floatUpIn'
	| 'floatDownOut'
	| 'glideIn'
	| 'glideOut'
	| 'curveUpIn'
	| 'curveDownOut'
	| 'dropIn'
	| 'dropOut'
	| 'compressIn';

export const MOTION_FAMILY_KEYFRAME_DEFINITIONS: Record<MotionFamilyEffectNameKeys, string> = {
	// Boomerang: swoops in past its resting position and springs back, like a
	// thrown object arcing back to the thrower.
	boomerangIn: `@keyframes pptx-boomerangIn {
	0% { opacity: 0; transform: translateX(120%) scale(0.7); }
	55% { opacity: 1; transform: translateX(-8%) scale(1.05); }
	100% { opacity: 1; transform: translateX(0) scale(1); }
}`,
	boomerangOut: `@keyframes pptx-boomerangOut {
	0% { opacity: 1; transform: translateX(0) scale(1); }
	45% { opacity: 1; transform: translateX(-8%) scale(1.05); }
	100% { opacity: 0; transform: translateX(120%) scale(0.7); }
}`,
	// Credits: a slow vertical scroll-and-fade, standing in for PowerPoint's
	// scrolling end-credits roll.
	creditsIn: `@keyframes pptx-creditsIn {
	0% { opacity: 0; transform: translateY(100%); }
	100% { opacity: 1; transform: translateY(0); }
}`,
	creditsOut: `@keyframes pptx-creditsOut {
	0% { opacity: 1; transform: translateY(0); }
	100% { opacity: 0; transform: translateY(-100%); }
}`,
	// Float Up / Float Down: a slow, gentle vertical drift with fade, more
	// travel and no overshoot than `riseUp`/`sinkDown`.
	floatUpIn: `@keyframes pptx-floatUpIn {
	0% { opacity: 0; transform: translateY(80px); }
	100% { opacity: 1; transform: translateY(0); }
}`,
	floatDownOut: `@keyframes pptx-floatDownOut {
	0% { opacity: 1; transform: translateY(0); }
	100% { opacity: 0; transform: translateY(80px); }
}`,
	// Glide: a smooth diagonal translate with a slight scale settle, distinct
	// from a plain cardinal-edge Fly.
	glideIn: `@keyframes pptx-glideIn {
	0% { opacity: 0; transform: translate(-30%, 30%) scale(0.9); }
	100% { opacity: 1; transform: translate(0, 0) scale(1); }
}`,
	glideOut: `@keyframes pptx-glideOut {
	0% { opacity: 1; transform: translate(0, 0) scale(1); }
	100% { opacity: 0; transform: translate(30%, -30%) scale(0.9); }
}`,
	// Curve Up / Curve Down: an arced entrance/exit path (rises while curving
	// sideways, or the reverse), approximated with a two-stage translate.
	curveUpIn: `@keyframes pptx-curveUpIn {
	0% { opacity: 0; transform: translate(-20%, 60px); }
	60% { opacity: 1; transform: translate(6%, -8px); }
	100% { opacity: 1; transform: translate(0, 0); }
}`,
	curveDownOut: `@keyframes pptx-curveDownOut {
	0% { opacity: 1; transform: translate(0, 0); }
	40% { opacity: 1; transform: translate(6%, -8px); }
	100% { opacity: 0; transform: translate(-20%, 60px); }
}`,
	// Drop: falls from above with a small bounce on landing, distinct from
	// `flyInTop`'s plain linear travel.
	dropIn: `@keyframes pptx-dropIn {
	0% { opacity: 0; transform: translateY(-120%); }
	70% { opacity: 1; transform: translateY(8%); }
	85% { transform: translateY(-4%); }
	100% { opacity: 1; transform: translateY(0); }
}`,
	dropOut: `@keyframes pptx-dropOut {
	0% { opacity: 1; transform: translateY(0); }
	15% { transform: translateY(-4%); }
	30% { transform: translateY(8%); }
	100% { opacity: 0; transform: translateY(120%); }
}`,
	// Compress: squeezes in from both horizontal edges with a small overshoot,
	// the entrance counterpart of a shrink-to-nothing exit.
	compressIn: `@keyframes pptx-compressIn {
	0% { opacity: 0; transform: scaleX(1.8); }
	60% { opacity: 1; transform: scaleX(0.92); }
	100% { opacity: 1; transform: scaleX(1); }
}`,
} satisfies Partial<Record<EffectName, string>>;
