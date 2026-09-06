/**
 * `animation-after-effect`: playback for the "after animation" end-state
 * behaviour (`PptxElementAnimation.afterAnimation` / `afterAnimationColor`):
 * dim-to-color, hide-after-animation, and hide-on-next-click.
 *
 * `pptx-viewer-core`'s native-timing parser (`native-animation-after-effect.ts`)
 * already decodes PowerPoint's genuine `p:subTnLst` after-effect shape onto
 * `PptxNativeAnimation.afterAnimationAction` / `afterAnimationColor`, so a
 * real-world deck's build is visible before this module runs. What
 * {@link applyAfterAnimationFromEditorList} adds is precedence: it OVERRIDES
 * that native value from the editor's per-element animation list (the model
 * the animation panel writes `afterAnimation` into) whenever that list has an
 * entry, so an edit made through this app's own UI always wins over whatever
 * was on disk. Both lists are already keyed by the same `element.id` after
 * `reconcileAnimationTargets` runs at load time.
 *
 * @module render/animation-after-effect
 */
import type { PptxElementAnimation, PptxNativeAnimation } from 'pptx-viewer-core';
import { resolveThemeColorRef } from 'pptx-viewer-core';

import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';

/**
 * Merge each element's `afterAnimation` / `afterAnimationColor` from the
 * editor animation list onto its matching native animation(s), so the
 * timeline builder can act on it. Exit effects are skipped: PowerPoint's
 * after-animation behaviour describes what happens once an entrance or
 * emphasis effect finishes, not an exit (which already ends by hiding).
 */
export function applyAfterAnimationFromEditorList(
	nativeAnimations: readonly PptxNativeAnimation[],
	editorAnimations: readonly PptxElementAnimation[] | undefined,
): PptxNativeAnimation[] {
	if (!editorAnimations || editorAnimations.length === 0) {
		return [...nativeAnimations];
	}
	const byElement = new Map<string, PptxElementAnimation>();
	for (const ea of editorAnimations) {
		if (ea.afterAnimation && ea.afterAnimation !== 'none') {
			byElement.set(ea.elementId, ea);
		}
	}
	if (byElement.size === 0) {
		return [...nativeAnimations];
	}
	return nativeAnimations.map((anim) => {
		if (!anim.targetId || anim.presetClass === undefined || anim.presetClass === 'exit') {
			return anim;
		}
		const ea = byElement.get(anim.targetId);
		if (!ea) {
			return anim;
		}
		return {
			...anim,
			afterAnimationAction: ea.afterAnimation,
			afterAnimationColor: ea.afterAnimationColor,
			// The editor's own model has no theme-colour-ref concept (it always
			// writes a concrete hex); clear a native scheme ref so a stale one
			// never survives an edit that overrides the colour.
			afterAnimationColorRef: undefined,
		};
	});
}

/**
 * Build a single-ended `@keyframes` block that recolors an element's text
 * to `color` and holds it. Deliberately has only a `100%` stop: a CSS
 * animation with no `0%` stop interpolates from the element's own current
 * computed style, which is exactly "dim FROM whatever it looked like" without
 * needing to know that color up front.
 */
export function buildAfterAnimationDimKeyframes(color: string, keyframeName: string): string {
	return `@keyframes ${keyframeName} {\n\t100% { color: ${color}; }\n}`;
}

/**
 * Append a near-instant, permanently-held dim animation to a step's CSS
 * animation shorthand, timed to start the moment the step's own effect ends.
 * CSS's `animation` property accepts a comma-separated list, so this plays
 * alongside the step's main effect without disturbing it.
 */
export function appendDimAnimation(
	cssAnimation: string,
	keyframeName: string,
	startDelayMs: number,
): string {
	return `${cssAnimation}, ${keyframeName} 1ms linear ${Math.max(0, startDelayMs)}ms 1 forwards`;
}

/** Per-step fields {@link resolveAfterAnimationStepFields} resolves. */
export interface AfterAnimationStepFields {
	/** The step's CSS animation shorthand, possibly with a dim keyframe appended. */
	cssAnimation: string;
	/** See {@link import('./animation-timeline-types').TimelineStep.holdEndState}. */
	holdEndState: boolean;
	/** See {@link import('./animation-timeline-types').TimelineStep.hideAfterEffect}. */
	hideAfterEffect?: boolean;
	/** See {@link import('./animation-timeline-types').TimelineStep.pendingHideOnNextClick}. */
	pendingHideOnNextClick?: boolean;
	/** A `@keyframes` block to append to the timeline's dynamic CSS, when `afterAnimationAction` is `dimToColor`. */
	dimKeyframeBlock?: string;
}

/**
 * Resolve a step's "after animation" end-state fields from its merged
 * `afterAnimationAction` (see {@link applyAfterAnimationFromEditorList}),
 * folding them onto the step's already-computed `cssAnimation` and
 * `@fill`-derived `holdEndState`. Shared by both the main click-group loop
 * and the interactive/hover sequence builder in `animation-timeline-builder`,
 * so an "after animation" behaviour authored on an `onShapeClick` /
 * `onHover`-triggered effect is honoured exactly like a main-sequence one.
 */
export function resolveAfterAnimationStepFields(
	anim: Pick<
		PptxNativeAnimation,
		'afterAnimationAction' | 'afterAnimationColor' | 'afterAnimationColorRef'
	>,
	cssAnimation: string,
	baseHoldEndState: boolean,
	dimStartDelayMs: number,
	dimKeyframeName: string,
	themeColorMap?: Readonly<Record<string, string>>,
): AfterAnimationStepFields {
	const dimColor =
		anim.afterAnimationColor ??
		(anim.afterAnimationColorRef
			? resolveThemeColorRef(anim.afterAnimationColorRef, themeColorMap)
			: undefined);
	if (anim.afterAnimationAction === 'dimToColor' && dimColor) {
		return {
			cssAnimation: appendDimAnimation(cssAnimation, dimKeyframeName, dimStartDelayMs),
			holdEndState: true,
			dimKeyframeBlock: buildAfterAnimationDimKeyframes(dimColor, dimKeyframeName),
		};
	}
	if (anim.afterAnimationAction === 'hideAfterAnimation') {
		return { cssAnimation, holdEndState: baseHoldEndState, hideAfterEffect: true };
	}
	if (anim.afterAnimationAction === 'hideOnNextClick') {
		return { cssAnimation, holdEndState: baseHoldEndState, pendingHideOnNextClick: true };
	}
	return { cssAnimation, holdEndState: baseHoldEndState };
}

/**
 * Walk a list of click-groups and, for every step carrying a pending
 * "hide on next click" marker, splice a zero-duration synthetic exit step
 * into the NEXT group (or the end of the current one, if it is the last
 * group) so the element hides the next time the viewer advances.
 *
 * Mutates and returns the same array.
 */
export function injectHideOnNextClickSteps(groups: TimelineClickGroup[]): TimelineClickGroup[] {
	for (let i = 0; i < groups.length; i++) {
		const pending = groups[i].steps.filter((step) => step.pendingHideOnNextClick);
		if (pending.length === 0) {
			continue;
		}
		const target = groups[i + 1] ?? groups[i];
		for (const step of pending) {
			const hideStep: TimelineStep = {
				elementId: step.elementId,
				cssAnimation: '',
				keyframeName: '',
				trigger: 'onClick',
				delayMs: 0,
				durationMs: 0,
				fillMode: 'forwards',
				presetClass: 'exit',
			};
			target.steps.push(hideStep);
		}
	}
	return groups;
}
