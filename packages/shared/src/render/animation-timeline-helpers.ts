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
import { resolveFilterEffect } from './animation-filter-effects';
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
import { buildTransformKeyframes } from './animation-transform-keyframes';

// ==========================================================================
// Effect name resolution
// ==========================================================================

/**
 * Resolve the static {@link EffectName} for a native animation from its
 * `presetClass` + `presetId`. Returns `undefined` for path/motion/rotation/scale
 * animations (which are handled dynamically) and for unknown ids.
 *
 * `presetId` is the PRIMARY selector. When it is absent, or present but not
 * in {@link PRESET_ID_TO_EFFECT} (a preset a tool other than PowerPoint wrote,
 * or one this catalogue does not yet cover), the animation's parsed
 * `p:animEffect/@filter` (`anim.effectFilter`) is consulted as a FALLBACK via
 * `resolveFilterEffect`, so a deck whose only description of the effect is
 * the filter string (no recognisable `presetId`) still resolves to a real
 * effect instead of falling straight to the neutral safety net. `path`-class
 * animations (motion path) never consult the filter: `p:animEffect` filters
 * describe reveal/conceal transitions, not motion.
 */
export function resolveEffect(anim: PptxNativeAnimation): EffectName | undefined {
	const cls = anim.presetClass;
	const id = anim.presetId;
	if (cls !== undefined && id !== undefined) {
		if (cls === 'entr') {
			const effect = applyFlyDirection(PRESET_ID_TO_EFFECT.entr[id], anim.presetSubtype);
			if (effect) {
				return effect;
			}
		} else if (cls === 'exit') {
			const effect = applyFlyDirection(PRESET_ID_TO_EFFECT.exit[id], anim.presetSubtype);
			if (effect) {
				return effect;
			}
		} else if (cls === 'emph') {
			const effect = PRESET_ID_TO_EFFECT.emph[id];
			if (effect) {
				return effect;
			}
		} else {
			// path/motion/rotation/scale: handled dynamically, never via filter.
			return undefined;
		}
	}
	return resolveFilterEffect(anim);
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
 * Express one motion-path coordinate as a CSS length measured against the SLIDE.
 *
 * OOXML motion-path numbers are fractions of the slide, but a CSS
 * `translate(%)` resolves against the ELEMENT's own box, so every parsed path
 * used to under-travel by the ratio between the two (a small shape barely
 * moved). The offset is therefore emitted as `calc(var(--pptx-slide-w) * f)`;
 * a binding sets those custom properties on its slide stage, and the fallback
 * is the default canvas size so an unset stage still travels a sane distance.
 *
 * @param percent - Sampled coordinate in percent-of-slide units (path * 100).
 * @param axis - `w` for the horizontal offset, `h` for the vertical one.
 */
const FLAT_TRANSFORM_PREFIXES = {
	motion: 'pptx-motionPath',
	rotationAbsolute: 'pptx-rotateAbs',
	rotationRelative: 'pptx-rotateBy',
	scaleAbsolute: 'pptx-scaleAbs',
	scaleRelative: 'pptx-scaleBy',
	transform: 'pptx-transform',
} as const;

const TIMELINE_TRANSFORM_PREFIXES = {
	motion: 'pptx-tl-motion',
	rotationAbsolute: 'pptx-tl-rotateAbs',
	rotationRelative: 'pptx-tl-rotate',
	scaleAbsolute: 'pptx-tl-scaleAbs',
	scaleRelative: 'pptx-tl-scale',
	transform: 'pptx-tl-transform',
} as const;

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
	const transform = buildTransformKeyframes(anim, uid, FLAT_TRANSFORM_PREFIXES);
	if (transform) {
		return transform;
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
	const transform = buildTransformKeyframes(anim, uid, TIMELINE_TRANSFORM_PREFIXES);
	if (transform) {
		return transform;
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
	// `@concurrent`/`@nextAc`/`@prevAc` are constant across every step governed
	// by the same enclosing `p:seq` (ECMA-376 S19.5.60), so the first step that
	// carries one speaks for the whole group.
	for (const step of steps) {
		if (group.seqConcurrent === undefined && step.seqConcurrent !== undefined) {
			group.seqConcurrent = step.seqConcurrent;
		}
		if (group.seqNextAction === undefined && step.seqNextAction !== undefined) {
			group.seqNextAction = step.seqNextAction;
		}
		if (group.seqPrevAction === undefined && step.seqPrevAction !== undefined) {
			group.seqPrevAction = step.seqPrevAction;
		}
	}
	return group;
}
