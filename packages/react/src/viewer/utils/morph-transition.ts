/**
 * Morph transition — matches elements on consecutive slides by name
 * (!! prefix convention), element name property, or element ID, then
 * produces per-element CSS keyframe animation data to smoothly
 * interpolate position, size, opacity, rotation, fill colors, stroke
 * properties, and shape geometry.
 *
 * Supports three morph granularity modes:
 *   - "object" (default): morph matched elements as wholes
 *   - "word": animate text word-by-word between matched elements
 *   - "character": animate text character-by-character
 *
 * When no matching pairs are found, falls back to a simple crossfade.
 *
 * This module re-exports all symbols from the focused sub-modules
 * to preserve backward compatibility.
 *
 * @module utils/morph-transition
 */

// Types, interfaces, and constants
export type {
	MorphPair,
	MorphMatchResult,
	MorphAnimationStyle,
	MorphMode,
	MorphTextToken,
	MorphTextTokenPair,
	RgbaColor,
	SvgPathCommand,
} from './morph-types';
export { MORPH_EASING } from './morph-types';

// Colour parsing and interpolation
export { parseHexColor, lerpColor, rgbaToHex } from './morph-color';

// SVG path utilities
export { parseSvgPath, serializeSvgPath, equalizePaths, interpolatePaths } from './morph-svg-path';

// Element matching
export { getElementMorphName, matchMorphElements, matchMorphElementsFull } from './morph-matching';

// Text tokenization and matching
export { tokenizeText, matchTextTokens } from './morph-text';

// Animation generation and DOM injection
export {
	buildColorInterpolationProps,
	buildStrokeInterpolationProps,
	generateMorphAnimations,
	generateUnmatchedFadeOutAnimations,
	generateUnmatchedFadeInAnimations,
	generateTextMorphAnimations,
	generateFullMorphTransition,
	injectMorphKeyframes,
	cleanupMorphKeyframes,
} from './morph-animation';
