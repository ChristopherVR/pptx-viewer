/**
 * `animation-after-effect-authoring` — pure decision logic for the animation
 * panel's "after animation" control (dim to colour / hide after animation /
 * hide on next click / don't dim).
 *
 * Playback of `afterAnimation` / `afterAnimationColor` was already fully
 * implemented (see `animation-after-effect.ts`'s
 * `applyAfterAnimationFromEditorList`); what was missing was an authoring
 * control to set them. This module is the write side's counterpart: value
 * catalog + immutable setters, matching the shape of `animation-authoring.ts`
 * (which already owns `entrance` / `exit` / `emphasis` / timing setters for
 * the same `PptxElementAnimation` entry).
 *
 * @module render/animation-after-effect-authoring
 */
import type { PptxAfterAnimationAction, PptxElementAnimation } from 'pptx-viewer-core';

import { animationFor, upsert } from './animation-authoring';

/** Option values for the "after animation" selector, in the order PowerPoint lists them. */
export const AFTER_ANIMATION_VALUES: readonly PptxAfterAnimationAction[] = [
	'none',
	'dimToColor',
	'hideAfterAnimation',
	'hideOnNextClick',
];

/** Default dim colour offered the first time a user picks "Dim after animation". */
export const DEFAULT_AFTER_ANIMATION_DIM_COLOR = '#808080';

/**
 * Sets (or clears) the "after animation" action for the element's animation
 * entry. Switching AWAY from `dimToColor` clears `afterAnimationColor`, so a
 * value left over from a prior dim choice can't silently reactivate if the
 * user picks `dimToColor` again later; switching back in supplies a fresh
 * default colour instead. Callers that want to restore a specific colour
 * should call `setAfterAnimationColor` afterwards.
 */
export function setAfterAnimation(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	action: PptxAfterAnimationAction | undefined,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => {
		const value = action === 'none' ? undefined : action;
		return {
			...cur,
			afterAnimation: value,
			afterAnimationColor:
				value === 'dimToColor'
					? (cur.afterAnimationColor ?? DEFAULT_AFTER_ANIMATION_DIM_COLOR)
					: undefined,
		};
	});
}

/**
 * Sets the dim-to colour for an entry already using `afterAnimation ===
 * 'dimToColor'`. A no-op (returns a shallow copy) when the entry does not
 * have `dimToColor` active, so a colour swatch left mounted during an
 * unrelated re-render can't accidentally turn dimming on.
 */
export function setAfterAnimationColor(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	color: string,
): PptxElementAnimation[] {
	const entry = animationFor(anims, elementId);
	if (!entry || entry.afterAnimation !== 'dimToColor') {
		return [...anims];
	}
	return upsert(anims, elementId, (cur) => ({ ...cur, afterAnimationColor: color }));
}

/** Reads the current "after animation" action, defaulting to `'none'`. */
export function getAfterAnimation(
	slideAnimations: readonly PptxElementAnimation[],
	elementId: string,
): PptxAfterAnimationAction {
	return animationFor(slideAnimations, elementId)?.afterAnimation ?? 'none';
}
