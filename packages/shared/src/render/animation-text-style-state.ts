/**
 * `animation-text-style-state` - pure merge/revert helpers for carrying a
 * {@link TextStyleAnimationDescriptor} through `animation-playback-engine.ts`'s
 * step-start and step-cleanup writes, mirroring how `carryBuildState` already
 * carries `build`/`chartReveal`/`diagramReveal` forward so one step's write
 * never clobbers a concern a DIFFERENT still-active step on the same element
 * owns.
 *
 * @module render/animation-text-style-state
 */

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';

/**
 * Merge a step's text-style override onto whatever the element already
 * carries (from a still-active earlier step), on step START. The new step's
 * fields win on a conflict; fields it does not mention pass through
 * unchanged.
 */
export function mergeTextStyleOnStart(
	carried: TextStyleAnimationDescriptor | undefined,
	stepStyle: TextStyleAnimationDescriptor | undefined,
): TextStyleAnimationDescriptor | undefined {
	if (!stepStyle) {
		return carried;
	}
	return { ...carried, ...stepStyle };
}

/**
 * Resolve the text-style override left after a step's CLEANUP.
 *
 * `holdEndState` mirrors `p:cTn/@fill="hold"/"freeze"/"transition"` (see
 * `animation-fill-repeat.ts`'s `shouldHoldEndState`, the same flag that keeps
 * a CSS animation's final frame attached instead of clearing it): when set,
 * the step's fields stay merged in permanently; otherwise only the KEYS this
 * step itself set are reverted, so a different still-active step's fields
 * (e.g. a concurrent colour change) are not clobbered.
 */
export function resolveTextStyleOnCleanup(
	carried: TextStyleAnimationDescriptor | undefined,
	stepStyle: TextStyleAnimationDescriptor | undefined,
	holdEndState: boolean | undefined,
): TextStyleAnimationDescriptor | undefined {
	if (!stepStyle) {
		return carried;
	}
	if (holdEndState) {
		return { ...carried, ...stepStyle };
	}
	if (!carried) {
		return undefined;
	}
	const remaining: TextStyleAnimationDescriptor = { ...carried };
	for (const key of Object.keys(stepStyle) as Array<keyof TextStyleAnimationDescriptor>) {
		delete remaining[key];
	}
	return Object.keys(remaining).length > 0 ? remaining : undefined;
}
