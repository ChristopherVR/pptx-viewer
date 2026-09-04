/**
 * Wheel spoke-count keyframes for the slide-transition overlay.
 *
 * `p:wheel/@spokes` (CT_WheelTransition, ECMA-376 S19.3.1.53) offers 1, 2, 3,
 * 4, or 8 spokes: PowerPoint reveals the incoming slide through N pie sectors
 * that sweep out simultaneously from evenly-spaced starting angles, closing
 * into a full circle together. A single animated CSS custom property drives
 * an N-way `repeating-conic-gradient` mask so every sector advances in lock
 * step without needing N separate `animation-delay`d layers.
 *
 * Requires `@property` support for the custom property to interpolate
 * smoothly (Chrome/Edge 85+, Safari 16.4+, Firefox 128+); on an older engine
 * the mask still applies, it just snaps from fully-hidden to fully-revealed
 * at the end of the transition instead of sweeping, which is a strictly safe
 * degradation (never a stuck or corrupted mask).
 *
 * Extracted from `slide-transition-keyframes` to keep that module at its
 * original size; `SLIDE_TRANSITION_KEYFRAMES` concatenates this block.
 *
 * @module render/slide-transition-wheel-keyframes
 */

import { WHEEL_SPOKE_COUNTS } from './slide-transition-types';

/** The animated custom property driving every wheel sweep (0..1 progress). */
const PROPERTY_NAME = '--pptx-tr-wheel-progress';

/** Build the `repeating-conic-gradient` mask expression for one spoke count. */
function wheelMaskExpression(spokeAngleDeg: number): string {
	return `repeating-conic-gradient(from -90deg, #000 0deg, #000 calc(var(${PROPERTY_NAME}) * ${spokeAngleDeg}deg), transparent 0deg, transparent ${spokeAngleDeg}deg)`;
}

/** Build the `@keyframes pptx-tr-wheel-in-N` block for one spoke count. */
function buildWheelKeyframe(spokes: number): string {
	const spokeAngleDeg = 360 / spokes;
	const mask = wheelMaskExpression(spokeAngleDeg);
	return `
@keyframes pptx-tr-wheel-in-${spokes} {
	from {
		${PROPERTY_NAME}: 0;
		-webkit-mask-image: ${mask};
		mask-image: ${mask};
	}
	to {
		${PROPERTY_NAME}: 1;
		-webkit-mask-image: ${mask};
		mask-image: ${mask};
	}
}`;
}

/** Resolve the `@keyframes` name for a resolved spoke count. */
export function wheelKeyframeName(spokes: number): string {
	return `pptx-tr-wheel-in-${spokes}`;
}

/**
 * The `@property` registration plus one `@keyframes pptx-tr-wheel-in-N` block
 * per PowerPoint-offered spoke count (1/2/3/4/8).
 */
export const WHEEL_MASK_KEYFRAMES = `
/* ── Wheel (N-spoke conic-gradient mask reveal) ─────────────────────── */
@property ${PROPERTY_NAME} {
	syntax: '<number>';
	inherits: false;
	initial-value: 0;
}
${WHEEL_SPOKE_COUNTS.map(buildWheelKeyframe).join('\n')}
`;
