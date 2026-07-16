/**
 * `animation-playback` — pure click-stepped playback math for the editor's
 * element-animation preset model.
 *
 * A slide carries an ordered list of {@link PptxElementAnimation}s. PowerPoint
 * groups them into "click groups": an animation triggered `onClick` /
 * `onShapeClick` / `onHover` starts a new group, while `withPrevious` /
 * `afterPrevious` / `afterDelay` animations fold into the group that precedes
 * them (running together or sequentially within that group). Advancing the
 * presentation one step reveals one more click group.
 *
 * This module derives, for a given step:
 *  - {@link revealedElementStyles}: the resolved CSS for every animation in the
 *    revealed groups (with correct cumulative delays for sequential
 *    `afterPrevious` chains); and
 *  - {@link pendingElementStyles}: the hidden styles for entrances in
 *    not-yet-revealed groups, so the host can pre-seed them without a flash.
 *
 * Pure: only the preset → CSS mapping is delegated to {@link resolveAnimationCss}
 * / {@link initialHiddenStyle} from {@link module:render/animation-css}. No
 * framework, no DOM, no RAF — the reactive hook / stateful service / RAF loop
 * stays in each binding.
 *
 * @module render/animation-playback
 */

import type { PptxAnimationTrigger, PptxElementAnimation } from 'pptx-viewer-core';

import { initialHiddenStyle, resolveAnimationCss } from './animation-css';

/** Minimal CSS-properties shape: kebab-case property → value. */
export type CSSProperties = Record<string, string>;

/** A single click-triggered group of animations that play as one step. */
export interface AnimationClickGroup {
	/** Animations belonging to this group, in document order. */
	animations: PptxElementAnimation[];
}

/**
 * Triggers that begin a brand-new click group. Everything else
 * (`withPrevious`, `afterPrevious`, `afterDelay`) folds into the current group.
 */
function startsNewGroup(trigger: PptxAnimationTrigger | undefined): boolean {
	return trigger === 'onClick' || trigger === 'onShapeClick' || trigger === 'onHover';
}

/**
 * Splits an ordered animation list into click groups. The first animation
 * always begins a group even if it isn't explicitly `onClick` (PowerPoint shows
 * the first build on the first advance). Subsequent `withPrevious` /
 * `afterPrevious` animations attach to the group in progress.
 */
export function buildClickGroups(
	animations: readonly PptxElementAnimation[],
): AnimationClickGroup[] {
	const groups: AnimationClickGroup[] = [];
	for (const animation of animations) {
		const isFirst = groups.length === 0;
		if (isFirst || startsNewGroup(animation.trigger)) {
			groups.push({ animations: [animation] });
		} else {
			groups[groups.length - 1].animations.push(animation);
		}
	}
	return groups;
}

/**
 * Builds the click groups that are effective for a running slide show.
 * `showWithAnimation=false` is the presentation-level switch from `p:showPr`:
 * no entrance should be hidden and an advance should move directly to the next
 * slide, regardless of animation records stored on that slide.
 */
export function buildPresentationClickGroups(
	animations: readonly PptxElementAnimation[],
	showWithAnimation: boolean | undefined,
): AnimationClickGroup[] {
	return showWithAnimation === false ? [] : buildClickGroups(animations);
}

/** Clamp a step into `[0, count]`. */
export function clampStep(value: number, count: number): number {
	if (value < 0) {
		return 0;
	}
	if (value > count) {
		return count;
	}
	return value;
}

/**
 * Reveal the next click group. Returns the next step, clamped to `count`.
 * Equivalent to `clampStep(step + 1, count)`.
 */
export function advanceStep(step: number, count: number): number {
	return clampStep(step + 1, count);
}

/** Parse the numeric ms duration out of a resolved style's `animation-duration`. */
export function durationOf(style: CSSProperties): number {
	const raw = style['animation-duration'];
	if (!raw) {
		return 0;
	}
	const match = /^(?<ms>\d+(?:\.\d+)?)ms$/u.exec(raw);
	return match ? Number(match.groups?.ms) : 0;
}

/**
 * Resolve the CSS for every animation in the revealed groups (the first `step`
 * groups). Within a group, `afterPrevious` animations are pushed back by the
 * accumulated duration of the preceding animations so sequential chains play in
 * order; `withPrevious` shares the running delay. The last write for an element
 * id wins (a later emphasis/exit overrides an earlier entrance), matching how a
 * single CSS `animation` shorthand can only hold one running effect.
 */
export function revealedElementStyles(
	groups: readonly AnimationClickGroup[],
	step: number,
): Map<string, CSSProperties> {
	const result = new Map<string, CSSProperties>();
	const clamped = clampStep(step, groups.length);
	const revealed = groups.slice(0, clamped);

	for (const group of revealed) {
		let runningDelayMs = 0;
		let previousDurationMs = 0;

		for (const animation of group.animations) {
			const resolved = resolveAnimationCss(animation);
			if (!resolved) {
				continue;
			}

			// Compute the in-group delay for sequential vs. concurrent triggers.
			if (animation.trigger === 'afterPrevious') {
				runningDelayMs += previousDurationMs;
			}
			// `withPrevious` (and the group's first animation) keep runningDelayMs.

			const ownDelay = animation.delayMs ?? 0;
			const totalDelay = runningDelayMs + ownDelay;
			const duration = durationOf(resolved.style);

			const style: CSSProperties = {
				...resolved.style,
				'animation-delay': `${totalDelay}ms`,
			};
			result.set(animation.elementId, style);

			previousDurationMs = duration;
		}
	}

	return result;
}

/**
 * Elements with a pending entrance (in a not-yet-revealed group, i.e. groups at
 * or beyond `step`) that should be hidden until their group plays. An element
 * an already-revealed group made visible is never re-hidden.
 */
export function pendingElementStyles(
	groups: readonly AnimationClickGroup[],
	step: number,
): Map<string, CSSProperties> {
	const result = new Map<string, CSSProperties>();
	const clamped = clampStep(step, groups.length);
	const pending = groups.slice(clamped);

	for (const group of pending) {
		for (const animation of group.animations) {
			const hidden = initialHiddenStyle(animation);
			if (Object.keys(hidden).length > 0 && !result.has(animation.elementId)) {
				result.set(animation.elementId, hidden);
			}
		}
	}

	return result;
}
