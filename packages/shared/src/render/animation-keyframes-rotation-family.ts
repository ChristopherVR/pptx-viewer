/**
 * `animation-keyframes-rotation-family` - CSS `@keyframes` definitions for the
 * rotation/spin-driven entrance and exit effects added to close the OOXML
 * entrance/exit preset catalogue gap (Spiral In/Out, Pinwheel, Whip, Rotate,
 * Center Revolve, Light Speed, Flip, Fold, Unfold, and the exit-side
 * `spinnerOut` that pairs with the existing `spinnerIn`).
 *
 * Every one of these plays a shape whose OOXML identity is either
 * COM-confirmed by numeric presetID (`animation-preset-ground-truth.ts`) or
 * matched by NAME against the already-COM-verified authoring/catalog tables;
 * see the module doc on `EffectName` in `animation-timeline-types.ts` for what
 * that means for confidence. Each is a genuinely new visual (not a reuse of an
 * existing keyframe), split out of `animation-keyframes` to keep that file
 * under the repo's file-size guideline.
 *
 * @module render/animation-keyframes-rotation-family
 */

import type { EffectName } from './animation-timeline-types';

export type RotationFamilyEffectNameKeys =
	| 'spiralIn'
	| 'spiralOut'
	| 'pinwheelIn'
	| 'pinwheelOut'
	| 'whipIn'
	| 'whipOut'
	| 'rotateIn'
	| 'rotateOut'
	| 'centerRevolveIn'
	| 'centerRevolveOut'
	| 'spinnerOut'
	| 'lightSpeedIn'
	| 'lightSpeedOut'
	| 'flipIn'
	| 'flipOut'
	| 'foldIn'
	| 'foldOut'
	| 'unfoldIn'
	| 'unfoldOut';

export const ROTATION_FAMILY_KEYFRAME_DEFINITIONS: Record<RotationFamilyEffectNameKeys, string> = {
	// Spiral In/Out: several full turns while scaling, more revolutions than
	// `spinnerIn`'s single 720deg sweep so the two read as distinct effects.
	spiralIn: `@keyframes pptx-spiralIn {
	0% { opacity: 0; transform: rotate(-1080deg) scale(0.1); }
	100% { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	spiralOut: `@keyframes pptx-spiralOut {
	0% { opacity: 1; transform: rotate(0deg) scale(1); }
	100% { opacity: 0; transform: rotate(1080deg) scale(0.1); }
}`,
	// Pinwheel: a faster, tighter spin-and-grow than Spiral, standing in for
	// PowerPoint's own multi-blade pinwheel sweep.
	pinwheelIn: `@keyframes pptx-pinwheelIn {
	0% { opacity: 0; transform: rotate(-360deg) scale(0.2); }
	70% { opacity: 1; transform: rotate(20deg) scale(1.05); }
	100% { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	pinwheelOut: `@keyframes pptx-pinwheelOut {
	0% { opacity: 1; transform: rotate(0deg) scale(1); }
	30% { opacity: 1; transform: rotate(-20deg) scale(1.05); }
	100% { opacity: 0; transform: rotate(360deg) scale(0.2); }
}`,
	// Whip: a fast diagonal snap into place with a small overshoot, distinct
	// from Bounce's vertical bob.
	whipIn: `@keyframes pptx-whipIn {
	0% { opacity: 0; transform: translate(40%, -20%) rotate(-15deg) scale(0.6); }
	70% { opacity: 1; transform: translate(-4%, 2%) rotate(2deg) scale(1.04); }
	100% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
}`,
	whipOut: `@keyframes pptx-whipOut {
	0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
	30% { opacity: 1; transform: translate(-4%, 2%) rotate(-2deg) scale(1.04); }
	100% { opacity: 0; transform: translate(40%, -20%) rotate(15deg) scale(0.6); }
}`,
	// Rotate: a single plain 360deg turn with fade, simpler than Wheel (which
	// also scales) or Spinner (which has more turns).
	rotateIn: `@keyframes pptx-rotateIn {
	from { opacity: 0; transform: rotate(-180deg); }
	to { opacity: 1; transform: rotate(0deg); }
}`,
	rotateOut: `@keyframes pptx-rotateOut {
	from { opacity: 1; transform: rotate(0deg); }
	to { opacity: 0; transform: rotate(180deg); }
}`,
	// Center Revolve: rotates around its own center while pulsing scale, as if
	// orbiting a fixed point before settling.
	centerRevolveIn: `@keyframes pptx-centerRevolveIn {
	0% { opacity: 0; transform: rotate(-540deg) scale(0.3); }
	60% { opacity: 1; transform: rotate(20deg) scale(1.1); }
	100% { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	centerRevolveOut: `@keyframes pptx-centerRevolveOut {
	0% { opacity: 1; transform: rotate(0deg) scale(1); }
	40% { opacity: 1; transform: rotate(-20deg) scale(1.1); }
	100% { opacity: 0; transform: rotate(540deg) scale(0.3); }
}`,
	// Exit-side pair for the existing `spinnerIn` (rotate + scale entrance);
	// no exit keyframe existed for the Spinner family before this pass.
	spinnerOut: `@keyframes pptx-spinnerOut {
	from { opacity: 1; transform: rotate(0deg) scale(1); }
	to { opacity: 0; transform: rotate(720deg) scale(0.4); }
}`,
	// Light Speed: a fast diagonal skew-swoop, approximating the well-known
	// "Light Speed" transition (skew + slide + fade).
	lightSpeedIn: `@keyframes pptx-lightSpeedIn {
	0% { opacity: 0; transform: translateX(60%) skewX(-30deg); }
	60% { opacity: 1; transform: translateX(-4%) skewX(6deg); }
	100% { opacity: 1; transform: translateX(0) skewX(0deg); }
}`,
	lightSpeedOut: `@keyframes pptx-lightSpeedOut {
	0% { opacity: 1; transform: translateX(0) skewX(0deg); }
	100% { opacity: 0; transform: translateX(60%) skewX(30deg); }
}`,
	// Flip: a 3D card-flip about the Y axis, distinct from Swivel's smaller
	// 90deg rotateY (Flip completes a full 180deg turn).
	flipIn: `@keyframes pptx-flipIn {
	0% { opacity: 0; transform: perspective(800px) rotateY(-180deg); }
	100% { opacity: 1; transform: perspective(800px) rotateY(0deg); }
}`,
	flipOut: `@keyframes pptx-flipOut {
	0% { opacity: 1; transform: perspective(800px) rotateY(0deg); }
	100% { opacity: 0; transform: perspective(800px) rotateY(180deg); }
}`,
	// Fold: a rotateX "closing book" reveal pinned at the top edge.
	foldIn: `@keyframes pptx-foldIn {
	0% { opacity: 0; transform: perspective(800px) rotateX(-90deg); transform-origin: top center; }
	100% { opacity: 1; transform: perspective(800px) rotateX(0deg); transform-origin: top center; }
}`,
	foldOut: `@keyframes pptx-foldOut {
	0% { opacity: 1; transform: perspective(800px) rotateX(0deg); transform-origin: top center; }
	100% { opacity: 0; transform: perspective(800px) rotateX(-90deg); transform-origin: top center; }
}`,
	// Unfold: the mirror rotateX reveal pinned at the bottom edge, so an
	// authored Fold/Unfold pair reads as opposite hinge directions.
	unfoldIn: `@keyframes pptx-unfoldIn {
	0% { opacity: 0; transform: perspective(800px) rotateX(90deg); transform-origin: bottom center; }
	100% { opacity: 1; transform: perspective(800px) rotateX(0deg); transform-origin: bottom center; }
}`,
	unfoldOut: `@keyframes pptx-unfoldOut {
	0% { opacity: 1; transform: perspective(800px) rotateX(0deg); transform-origin: bottom center; }
	100% { opacity: 0; transform: perspective(800px) rotateX(90deg); transform-origin: bottom center; }
}`,
} satisfies Partial<Record<EffectName, string>>;
