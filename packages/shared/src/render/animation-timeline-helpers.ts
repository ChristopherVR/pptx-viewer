/**
 * `animation-timeline-helpers` — pure helpers for the native-animation timeline:
 * effect resolution, dynamic (motion-path / rotation / scale / colour) keyframe
 * generation, default durations, fill-mode mapping, and click-group finalisation.
 *
 * Two dynamic-keyframe builders coexist (with deliberately distinct keyframe
 * name prefixes so the two playback models never collide):
 *  - {@link buildDynamicKeyframes} (plural) — `pptx-motionPath-*` / `pptx-rotateBy-*`
 *    / `pptx-scaleBy-*`. Used by the flat {@link AnimationStep} sequencer.
 *  - {@link buildDynamicKeyframe} (singular) — `pptx-tl-motion-*` / `pptx-tl-rotate-*`
 *    / `pptx-tl-scale-*`, plus motion-path auto-rotate. Used by the click-group
 *    {@link buildTimeline} engine.
 *
 * @module render/animation-timeline-helpers
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { buildColorAnimationKeyframes } from './animation-color';
import { parseMotionPathPoints } from './animation-motion-path';
import {
	emphasisFilterKeyframeCss,
	FLY_SUBTYPE_TO_EDGE,
	PRESET_ID_TO_EFFECT,
} from './animation-presets';
import type {
	AnimationStep,
	EffectName,
	TimelineStep,
	TimelineClickGroup,
} from './animation-timeline-types';

// ==========================================================================
// Effect name resolution
// ==========================================================================

/**
 * Resolve the static {@link EffectName} for a native animation from its
 * `presetClass` + `presetId`. Returns `undefined` for path/motion/rotation/scale
 * animations (which are handled dynamically) and for unknown ids.
 */
export function resolveEffect(anim: PptxNativeAnimation): EffectName | undefined {
	const cls = anim.presetClass;
	const id = anim.presetId;
	if (cls === undefined || id === undefined) {
		return undefined;
	}
	if (cls === 'entr') {
		return applyFlyDirection(PRESET_ID_TO_EFFECT.entr[id], anim.presetSubtype);
	}
	if (cls === 'exit') {
		return applyFlyDirection(PRESET_ID_TO_EFFECT.exit[id], anim.presetSubtype);
	}
	if (cls === 'emph') {
		return PRESET_ID_TO_EFFECT.emph[id];
	}
	// For path/motion/rotation/scale, return undefined — handled dynamically.
	return undefined;
}

/**
 * Redirect a Fly In / Fly Out effect according to its `presetSubtype` code.
 * The preset tables default the fly family to the bottom edge; when a subtype
 * is present and maps to a known edge, swap in the matching directional effect.
 * A missing or unrecognised subtype preserves the bottom default so existing
 * decks are unaffected.
 */
function applyFlyDirection(
	effect: EffectName | undefined,
	subtype: number | undefined,
): EffectName | undefined {
	if (effect !== 'flyInBottom' && effect !== 'flyOutBottom') {
		return effect;
	}
	if (subtype === undefined) {
		return effect;
	}
	const edge = FLY_SUBTYPE_TO_EDGE[subtype];
	if (!edge) {
		return effect;
	}
	const prefix = effect === 'flyInBottom' ? 'flyIn' : 'flyOut';
	const suffix = `${edge.charAt(0).toUpperCase()}${edge.slice(1)}`;
	return `${prefix}${suffix}` as EffectName;
}

// ==========================================================================
// Dynamic keyframe generation (motion path / rotation / scale / colour)
// ==========================================================================

/**
 * Build a dynamic CSS `@keyframes` block for motion path, rotation, scale, or
 * colour animations that don't map to a static effect preset. Uses the
 * `pptx-motionPath-*` / `pptx-rotateBy-*` / `pptx-scaleBy-*` / `pptx-color-*`
 * name prefixes (flat-sequence model).
 */
export function buildDynamicKeyframes(
	anim: PptxNativeAnimation,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	// Motion path animation
	if (anim.motionPath) {
		const name = `pptx-motionPath-${uid}`;
		const points = parseMotionPathPoints(anim.motionPath);
		if (points.length < 2) {
			return undefined;
		}
		const kfLines: string[] = [];
		for (let i = 0; i < points.length; i++) {
			const pct = Math.round((i / (points.length - 1)) * 100);
			kfLines.push(
				`\t${pct}% { transform: translate(${points[i].x.toFixed(2)}%, ${points[i].y.toFixed(2)}%); }`,
			);
		}
		return {
			keyframeName: name,
			css: `@keyframes ${name} {\n${kfLines.join('\n')}\n}`,
		};
	}

	// Rotation animation
	if (anim.rotationBy !== undefined) {
		const name = `pptx-rotateBy-${uid}`;
		const deg = anim.rotationBy;
		return {
			keyframeName: name,
			css: `@keyframes ${name} {\n\tfrom { transform: rotate(0deg); }\n\tto { transform: rotate(${deg}deg); }\n}`,
		};
	}

	// Scale animation
	if (anim.scaleByX !== undefined || anim.scaleByY !== undefined) {
		const name = `pptx-scaleBy-${uid}`;
		const sx = anim.scaleByX ?? 1;
		const sy = anim.scaleByY ?? 1;
		return {
			keyframeName: name,
			css: `@keyframes ${name} {\n\tfrom { transform: scale(1); }\n\tto { transform: scale(${sx}, ${sy}); }\n}`,
		};
	}

	// Color animation (p:animClr)
	if (anim.colorAnimation) {
		const name = `pptx-color-${uid}`;
		const css = buildColorAnimationKeyframes(anim.colorAnimation, name);
		if (css) {
			return { keyframeName: name, css };
		}
	}

	// Filter-based emphasis (desaturate / darken / lighten)
	if (anim.presetClass === 'emph') {
		const filterName = `pptx-emph-${uid}`;
		const filterCss = emphasisFilterKeyframeCss(anim.presetId, filterName);
		if (filterCss) {
			return { keyframeName: filterName, css: filterCss };
		}
	}

	return undefined;
}

/**
 * Build a dynamic CSS `@keyframes` block for the click-group timeline engine.
 * Uses the `pptx-tl-motion-*` / `pptx-tl-rotate-*` / `pptx-tl-scale-*` /
 * `pptx-tl-color-*` prefixes and supports motion-path auto-rotate.
 */
export function buildDynamicKeyframe(
	anim: PptxNativeAnimation,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (anim.motionPath) {
		const name = `pptx-tl-motion-${uid}`;
		const points = parseMotionPathPoints(anim.motionPath);
		if (points.length < 2) {
			return undefined;
		}
		const lines: string[] = [];
		for (let i = 0; i < points.length; i++) {
			const pct = Math.round((i / (points.length - 1)) * 100);
			const tx = points[i].x.toFixed(2);
			const ty = points[i].y.toFixed(2);

			if (anim.motionPathRotateAuto) {
				// Compute the tangent angle at this point using the direction
				// to the next point (or from the previous point for the last one).
				const next = i < points.length - 1 ? points[i + 1] : points[i];
				const prev = i > 0 ? points[i - 1] : points[i];
				const dx = i < points.length - 1 ? next.x - points[i].x : points[i].x - prev.x;
				const dy = i < points.length - 1 ? next.y - points[i].y : points[i].y - prev.y;
				const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
				lines.push(
					`\t${pct}% { transform: translate(${tx}%, ${ty}%) rotate(${angleDeg.toFixed(2)}deg); }`,
				);
			} else {
				lines.push(`\t${pct}% { transform: translate(${tx}%, ${ty}%); }`);
			}
		}
		return {
			keyframeName: name,
			css: `@keyframes ${name} {\n${lines.join('\n')}\n}`,
		};
	}
	if (anim.rotationBy !== undefined) {
		const name = `pptx-tl-rotate-${uid}`;
		return {
			keyframeName: name,
			css: `@keyframes ${name} {\n\tfrom { transform: rotate(0deg); }\n\tto { transform: rotate(${anim.rotationBy}deg); }\n}`,
		};
	}
	if (anim.scaleByX !== undefined || anim.scaleByY !== undefined) {
		const name = `pptx-tl-scale-${uid}`;
		const sx = anim.scaleByX ?? 1;
		const sy = anim.scaleByY ?? 1;
		return {
			keyframeName: name,
			css: `@keyframes ${name} {\n\tfrom { transform: scale(1); }\n\tto { transform: scale(${sx}, ${sy}); }\n}`,
		};
	}
	// Color animation (p:animClr)
	if (anim.colorAnimation) {
		const name = `pptx-tl-color-${uid}`;
		const css = buildColorAnimationKeyframes(anim.colorAnimation, name);
		if (css) {
			return { keyframeName: name, css };
		}
	}
	// Filter-based emphasis (desaturate / darken / lighten)
	if (anim.presetClass === 'emph') {
		const filterName = `pptx-tl-emph-${uid}`;
		const filterCss = emphasisFilterKeyframeCss(anim.presetId, filterName);
		if (filterCss) {
			return { keyframeName: filterName, css: filterCss };
		}
	}
	return undefined;
}

// ==========================================================================
// Naming, durations, fill modes, group finalisation
// ==========================================================================

export function cssKeyframeName(effect: EffectName | string): string {
	return `pptx-${effect}`;
}

export function defaultDuration(presetClass: PptxNativeAnimation['presetClass']): number {
	switch (presetClass) {
		case 'entr':
			return 500;
		case 'exit':
			return 500;
		case 'emph':
			return 800;
		case 'path':
			return 1000;
		default:
			return 500;
	}
}

export function fillModeForClass(
	presetClass: PptxNativeAnimation['presetClass'],
): AnimationStep['fillMode'] {
	switch (presetClass) {
		case 'entr':
			return 'both';
		case 'exit':
			return 'forwards';
		case 'emph':
			return 'both';
		default:
			return 'both';
	}
}

export function finalizeClickGroup(
	steps: TimelineStep[],
	options?: { autoAdvance?: boolean; autoAdvanceDelayMs?: number },
): TimelineClickGroup {
	let maxEnd = 0;
	for (const step of steps) {
		const end = step.delayMs + step.durationMs;
		if (end > maxEnd) {
			maxEnd = end;
		}
	}
	const group: TimelineClickGroup = { steps, totalDurationMs: maxEnd };
	if (options?.autoAdvance) {
		group.autoAdvance = true;
		group.autoAdvanceDelayMs = options.autoAdvanceDelayMs ?? 0;
	}
	return group;
}
