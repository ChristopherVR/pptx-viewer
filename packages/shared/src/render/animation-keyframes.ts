/**
 * `animation-keyframes` - CSS `@keyframes` definitions for every static
 * native-animation effect, keyed by {@link EffectName}. Pure data + a lookup
 * helper. Names are prefixed `pptx-` (distinct from `animation-css`'s
 * `pptx-vue-` editor-preset keyframes).
 *
 * The entrance/exit/emphasis base tables each live in their own module (kept
 * under the repo's file-size guideline); this module composes them into the
 * single {@link getEffectKeyframes} lookup.
 *
 * @module render/animation-keyframes
 */

import { BLINK_SHIMMER_KEYFRAME_DEFINITIONS } from './animation-emphasis-blink-shimmer';
import type { BlinkShimmerEffectName } from './animation-emphasis-blink-shimmer';
import { EMPHASIS_KEYFRAME_DEFINITIONS } from './animation-keyframes-emphasis-base';
import { ENTRANCE_KEYFRAME_DEFINITIONS } from './animation-keyframes-entrance';
import { EXIT_KEYFRAME_DEFINITIONS } from './animation-keyframes-exit';
import { EXIT_SHAPE_KEYFRAME_DEFINITIONS } from './animation-keyframes-exit-shapes';
import type { ExitShapeEffectName } from './animation-keyframes-exit-shapes';
import { MOTION_FAMILY_KEYFRAME_DEFINITIONS } from './animation-keyframes-motion-family';
import type { MotionFamilyEffectNameKeys } from './animation-keyframes-motion-family';
import { ROTATION_FAMILY_KEYFRAME_DEFINITIONS } from './animation-keyframes-rotation-family';
import type { RotationFamilyEffectNameKeys } from './animation-keyframes-rotation-family';
import type { EffectName } from './animation-timeline-types';

// ==========================================================================
// CSS @keyframes definitions for each effect
// ==========================================================================

// Box/Checkerboard/Blinds/Wheel/RandomBars/Diamond/Plus/Wedge EXIT keyframes
// live in `animation-keyframes-exit-shapes` (split out to stay under the
// repo's file-size cap) and are merged in below.
type BaseEffectName = Exclude<
	EffectName,
	| ExitShapeEffectName
	| RotationFamilyEffectNameKeys
	| MotionFamilyEffectNameKeys
	| BlinkShimmerEffectName
>;

const BASE_KEYFRAME_DEFINITIONS = {
	...ENTRANCE_KEYFRAME_DEFINITIONS,
	...EXIT_KEYFRAME_DEFINITIONS,
	...EMPHASIS_KEYFRAME_DEFINITIONS,
} as Record<BaseEffectName, string>;

const KEYFRAME_DEFINITIONS: Record<EffectName, string> = {
	...BASE_KEYFRAME_DEFINITIONS,
	...EXIT_SHAPE_KEYFRAME_DEFINITIONS,
	...ROTATION_FAMILY_KEYFRAME_DEFINITIONS,
	...MOTION_FAMILY_KEYFRAME_DEFINITIONS,
	...BLINK_SHIMMER_KEYFRAME_DEFINITIONS,
};

// ==========================================================================
// Public helper: get keyframe CSS for an effect name
// ==========================================================================

export function getEffectKeyframes(effect: EffectName): string {
	return KEYFRAME_DEFINITIONS[effect] ?? '';
}
