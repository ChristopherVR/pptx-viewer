/**
 * Timing/motion write-side helpers for the animation write service: direction
 * -> presetSubtype, editor trigger -> OOXML nodeType, and timing-curve ->
 * accel/decel. Split out of `animation-write-mappings.ts` (which composes
 * the preset id tables) to keep that module under the repo's file-size
 * guideline.
 *
 * @module services/animation-write-mappings-motion
 */
import type { PptxAnimationTrigger } from '../types';

/** Maps editor direction values to OOXML presetSubtype values for fly effects. */
export const DIRECTION_TO_SUBTYPE: Record<string, number> = {
	fromBottom: 4,
	fromLeft: 8,
	fromRight: 2,
	fromTop: 1,
	fromTopLeft: 9,
	fromTopRight: 3,
	fromBottomLeft: 12,
	fromBottomRight: 6,
};

/** Maps editor trigger names to OOXML nodeType attribute values. */
export function triggerToNodeType(trigger: PptxAnimationTrigger): string {
	switch (trigger) {
		case 'afterPrevious':
			return 'afterEffect';
		case 'withPrevious':
			return 'withEffect';
		case 'afterDelay':
			return 'afterEffect';
		case 'onHover':
			return 'mouseOver';
		case 'onShapeClick':
			return 'clickEffect';
		case 'onClick':
		default:
			return 'clickEffect';
	}
}

/** Maps editor timing curve to OOXML animation formula filter values. */
export function timingCurveToAccelDecel(curve: string | undefined): {
	accel: number;
	decel: number;
} {
	switch (curve) {
		case 'ease-in':
			return { accel: 100000, decel: 0 };
		case 'ease-out':
			return { accel: 0, decel: 100000 };
		case 'ease':
			return { accel: 50000, decel: 50000 };
		case 'linear':
		default:
			return { accel: 0, decel: 0 };
	}
}
