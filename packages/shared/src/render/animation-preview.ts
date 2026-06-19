/**
 * `animation-preview` — pure preview-descriptor construction for the editor's
 * animation panel: map an editor preset (+ direction / timing) to a CSS
 * keyframe name, definition and shorthand. The DOM player that injects the
 * `<style>` and toggles the element animation stays in each binding.
 *
 * @module render/animation-preview
 */

import type {
	PptxAnimationPreset,
	PptxAnimationDirection,
	PptxAnimationTimingCurve,
} from 'pptx-viewer-core';

import { getEffectKeyframes } from './animation-keyframes';
import type { EffectName } from './animation-timeline-types';

// ==========================================================================
// Preview keyframes generation
// ==========================================================================

/** Map editor-level animation presets to the internal effect names used by
 *  the keyframe definition table. */
const PRESET_TO_EFFECT: Record<string, string> = {
	fadeIn: 'fadeIn',
	flyIn: 'flyInBottom',
	zoomIn: 'zoomIn',
	fadeOut: 'fadeOut',
	flyOut: 'flyOutBottom',
	zoomOut: 'zoomOut',
	spin: 'spin',
	pulse: 'pulse',
	colorWave: 'colorWave',
	bounce: 'bounce',
	flash: 'flash',
};

/** Direction-aware fly-in/out effect name overrides. */
const DIRECTION_FLY_MAP: Partial<
	Record<PptxAnimationDirection, { flyIn: string; flyOut: string }>
> = {
	fromLeft: { flyIn: 'flyInLeft', flyOut: 'flyOutLeft' },
	fromRight: { flyIn: 'flyInRight', flyOut: 'flyOutRight' },
	fromTop: { flyIn: 'flyInTop', flyOut: 'flyOutTop' },
	fromBottom: { flyIn: 'flyInBottom', flyOut: 'flyOutBottom' },
	fromTopLeft: { flyIn: 'flyInTop', flyOut: 'flyOutTop' },
	fromTopRight: { flyIn: 'flyInTop', flyOut: 'flyOutTop' },
	fromBottomLeft: { flyIn: 'flyInBottom', flyOut: 'flyOutBottom' },
	fromBottomRight: { flyIn: 'flyInBottom', flyOut: 'flyOutBottom' },
};

/**
 * Resolve the CSS @keyframes effect name for a given preset and direction.
 */
function resolvePreviewEffect(
	preset: PptxAnimationPreset,
	direction?: PptxAnimationDirection,
): string | undefined {
	if ((preset === 'flyIn' || preset === 'flyOut') && direction) {
		const dirMap = DIRECTION_FLY_MAP[direction];
		if (dirMap) {
			return preset === 'flyIn' ? dirMap.flyIn : dirMap.flyOut;
		}
	}
	return PRESET_TO_EFFECT[preset];
}

/**
 * Map a timing curve name to a CSS easing string.
 * Supports the standard OOXML timing curves plus cubic-bezier extraction.
 */
export function timingCurveToCss(
	curve?: PptxAnimationTimingCurve,
	cubicBezierValues?: string,
): string {
	if (cubicBezierValues) {
		// Validate cubic-bezier format: "x1,y1,x2,y2"
		const parts = cubicBezierValues.split(',').map((s) => s.trim());
		if (parts.length === 4 && parts.every((p) => !Number.isNaN(Number(p)))) {
			return `cubic-bezier(${parts.join(', ')})`;
		}
	}
	switch (curve) {
		case 'ease':
			return 'ease';
		case 'ease-in':
			return 'ease-in';
		case 'ease-out':
			return 'ease-out';
		case 'linear':
			return 'linear';
		default:
			return 'ease';
	}
}

// ==========================================================================
// Preview animation descriptor
// ==========================================================================

export interface AnimationPreviewDescriptor {
	/** CSS @keyframes name. */
	keyframeName: string;
	/** Full CSS @keyframes definition block. */
	keyframesCss: string;
	/** CSS animation shorthand value to apply. */
	cssAnimation: string;
	/** Duration in ms. */
	durationMs: number;
}

/**
 * Build a preview animation descriptor for a given preset.
 *
 * Returns `undefined` if the preset doesn't have a known effect.
 */
export function buildPreviewAnimation(
	preset: PptxAnimationPreset,
	options?: {
		direction?: PptxAnimationDirection;
		durationMs?: number;
		timingCurve?: PptxAnimationTimingCurve;
		cubicBezier?: string;
	},
): AnimationPreviewDescriptor | undefined {
	if (preset === 'none') {
		return undefined;
	}

	const effectName = resolvePreviewEffect(preset, options?.direction);
	if (!effectName) {
		return undefined;
	}

	const keyframeName = `pptx-${effectName}`;
	const keyframesCss = getEffectKeyframes(effectName as EffectName);
	if (!keyframesCss) {
		return undefined;
	}

	const duration = options?.durationMs ?? 600;
	const easing = timingCurveToCss(options?.timingCurve, options?.cubicBezier);

	return {
		keyframeName,
		keyframesCss,
		cssAnimation: `${keyframeName} ${duration}ms ${easing} 0ms 1 normal both`,
		durationMs: duration,
	};
}

// ==========================================================================
// Timing curve extraction from OOXML bezier values
// ==========================================================================

/**
 * Parse OOXML timing curve bezier values from `a:cTn/a:timing/a:curve`.
 *
 * OOXML stores bezier control points as attributes:
 * - `x1`, `y1` — first control point (0..100000 range)
 * - `x2`, `y2` — second control point (0..100000 range)
 *
 * Returns a CSS `cubic-bezier()` string, or undefined if not parseable.
 */
export function parseOoxmlBezierCurve(
	x1: number | undefined,
	y1: number | undefined,
	x2: number | undefined,
	y2: number | undefined,
): string | undefined {
	if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
		return undefined;
	}

	// OOXML values are in 0..100000 range, CSS cubic-bezier uses 0..1
	const cx1 = Math.max(0, Math.min(1, x1 / 100000));
	const cy1 = y1 / 100000; // y can exceed 0..1 range for overshoot
	const cx2 = Math.max(0, Math.min(1, x2 / 100000));
	const cy2 = y2 / 100000;

	return `${cx1.toFixed(4)},${cy1.toFixed(4)},${cx2.toFixed(4)},${cy2.toFixed(4)}`;
}
