/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Morph transition types/constants now live in `pptx-viewer-shared`
 * (`render/morph-types`). This shim preserves the historical React import
 * surface.
 *
 * @module utils/morph-types
 */
export type {
	MorphPair,
	MorphMatchResult,
	MorphAnimationStyle,
	MorphMode,
	MorphTextToken,
	MorphTextTokenPair,
	RgbaColor,
	SvgPathCommand,
} from 'pptx-viewer-shared';
export { MORPH_EASING, PROXIMITY_THRESHOLD } from 'pptx-viewer-shared';
