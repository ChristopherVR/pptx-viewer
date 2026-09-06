/**
 * `animation-timeline-builder-helpers` - small pure helpers used by
 * `animation-timeline-builder`'s click-group and sequence builders, split out
 * to keep those modules under the file-size limit.
 *
 * @module render/animation-timeline-builder-helpers
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { resolveColorAnimationTargets } from './animation-color';
import { resolveTextStyleAnimation } from './animation-text-style-resolve';
import type { EffectName, TimelineStep } from './animation-timeline-types';

/** Clamp a value into the closed unit interval. */
export function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Map an animation's parsed `accel`/`decel` fractions to a CSS timing function.
 *
 * PowerPoint's `accel` is the fraction of the duration spent easing in and
 * `decel` the fraction spent easing out. We translate the actual magnitudes to
 * a `cubic-bezier(accel, 0, 1 - decel, 1)` curve so a gentle 10% accel differs
 * from an aggressive 80% accel (the old keyword mapping collapsed both to a flat
 * `ease-in`). With neither set we keep the neutral `ease` default so existing
 * decks are unchanged.
 */
export function cssEasingForAnimation(anim: PptxNativeAnimation): string {
	const accel = anim.accel !== undefined && anim.accel > 0 ? clamp01(anim.accel) : 0;
	const decel = anim.decel !== undefined && anim.decel > 0 ? clamp01(anim.decel) : 0;
	if (accel === 0 && decel === 0) {
		return 'ease';
	}
	const x1 = accel.toFixed(3);
	const x2 = (1 - decel).toFixed(3);
	return `cubic-bezier(${x1}, 0, ${x2}, 1)`;
}

/**
 * Resolve the active-color-animation paint targets for a step, or `undefined`
 * when the animation drives no fill / stroke colour (so the field stays absent).
 *
 * `tavColorApplied` must be `true` only when `buildColorTavKeyframe`
 * actually produced a keyframe block for this step: `anim.attrName` alone
 * isn't enough, because it can name a colour attribute whose `p:tavLst`
 * stops couldn't be resolved to CSS colours (e.g. scheme-colour tokens), in
 * which case the step falls back to an unrelated effect and must NOT be
 * flagged as animating fill/stroke, or the renderer would suppress the
 * shape's static paint for an animation that never actually runs.
 */
export function stepColorTargets(
	anim: PptxNativeAnimation,
	tavColorApplied: boolean,
): TimelineStep['colorTargets'] {
	// `p:animClr`'s own from/to/by ramp is the primary source; a `p:tavLst`
	// colour ramp on a generic `p:anim` node (see `buildColorTavKeyframe`)
	// names the same kind of attribute, so it resolves paint targets the
	// same way once there's no dedicated colour animation to defer to.
	const colorSource = anim.colorAnimation ?? (tavColorApplied ? anim.attrName : undefined);
	if (!colorSource) {
		return undefined;
	}
	const targets = resolveColorAnimationTargets(colorSource);
	return targets.length > 0 ? targets : undefined;
}

/**
 * Resolve a fallback {@link EffectName} for an animation whose preset we do
 * not model (no static effect and no dynamic keyframe).
 *
 * Without this, an unmapped animation was silently dropped, which broke slide
 * visibility semantics: an unmapped **entrance** was never registered as
 * hidden-until-its-start, so it stayed visible from the very first frame; an
 * unmapped **exit** never hid its element. We substitute a neutral fade so the
 * element still transitions in (entrance) or out (exit) at the correct time.
 *
 * Emphasis / motion-path presets carry no show/hide semantics, so a missing
 * one is safe to skip and returns `undefined`.
 */
export function fallbackEffectForClass(
	presetClass: PptxNativeAnimation['presetClass'],
): EffectName | undefined {
	if (presetClass === 'entr') {
		return 'fadeIn';
	}
	if (presetClass === 'exit') {
		return 'fadeOut';
	}
	if (presetClass === 'emph') {
		// Emphasis carries no show/hide semantics, but an unmapped emphasis must
		// still animate (previously it was silently dropped and rendered inert).
		// A neutral pulse is a safe stand-in that reads as "this element is being
		// emphasised" regardless of the specific unmapped preset.
		return 'pulse';
	}
	return undefined;
}

/**
 * An emphasis whose visible work is entirely a `p:set`/`p:anim` text-style
 * change (no mapped preset effect, no transform). Such a step must not fall
 * through to the neutral `pulse` safety net.
 */
export function isTextStyleOnlyEmphasis(anim: PptxNativeAnimation): boolean {
	return anim.presetClass === 'emph' && resolveTextStyleAnimation(anim) !== undefined;
}
