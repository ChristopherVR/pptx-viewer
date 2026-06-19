/**
 * Thin re-export shim. The native-animation timeline helpers (effect
 * resolution, dynamic keyframe generation, durations, fill modes, click-group
 * finalisation) and the colour-interpolation helpers now live in
 * `pptx-viewer-shared` (`render/animation-timeline-helpers` + `render/animation-color`).
 *
 * `EffectName` was historically a bare `string` alias here; the shared barrel
 * exports the richer string-literal union of the same name, which is a strict
 * subset-compatible replacement for the call sites in this binding.
 */
export type { EffectName } from 'pptx-viewer-shared';
export {
	resolveEffect,
	buildDynamicKeyframe,
	cssKeyframeName,
	defaultDuration,
	fillModeForClass,
	finalizeClickGroup,
	// Colour interpolation + p:animClr keyframe generation.
	hexToRgb,
	rgbToHex,
	rgbToHsl,
	hslToRgb,
	interpolateColor,
	buildColorAnimationKeyframes,
} from 'pptx-viewer-shared';
