/**
 * `element-action-options` - the option catalogue for an element's "Action
 * Settings" inspector panel (PowerPoint's Insert > Action dialog).
 *
 * WHY shared: the mapping from `ElementActionType` to a translation key is
 * plain data that every binding's action panel needs verbatim, and the two
 * types that take an extra input (`url`, `slide`) are a rule, not a rendering
 * decision. Keeping the list here means adding a new action kind updates all
 * five bindings at once instead of five hand-typed copies drifting apart.
 *
 * @module render/element-action-options
 */
import type { ElementActionType } from 'pptx-viewer-core';

/** One entry of the action-type select, with its dictionary key. */
export interface ElementActionOption {
	value: ElementActionType;
	labelKey: string;
}

/** Action kinds selectable for an element's click / hover trigger. */
export const ELEMENT_ACTION_TYPE_OPTIONS: readonly ElementActionOption[] = [
	{ value: 'none', labelKey: 'pptx.hyperlink.actionNone' },
	{ value: 'url', labelKey: 'pptx.action.gotoUrl' },
	{ value: 'slide', labelKey: 'pptx.action.gotoSlide' },
	{ value: 'firstSlide', labelKey: 'pptx.hyperlink.actionFirstSlide' },
	{ value: 'lastSlide', labelKey: 'pptx.hyperlink.actionLastSlide' },
	{ value: 'prevSlide', labelKey: 'pptx.hyperlink.actionPrevSlide' },
	{ value: 'nextSlide', labelKey: 'pptx.hyperlink.actionNextSlide' },
	{ value: 'endShow', labelKey: 'pptx.hyperlink.actionEndShow' },
];

/**
 * Action kinds that stay unusable until the user supplies a target.
 *
 * WHY this is a shared rule rather than a per-binding `if`: `url` and `slide`
 * serialise to an OOXML action that parses straight back as `none` while their
 * target is missing, so the panel that just wrote one would immediately read it
 * back as "no action". Every binding needs the same test to know when a picked
 * type may be committed and when it must only be held in the panel.
 */
export function actionTypeNeedsTarget(type: ElementActionType): boolean {
	return type === 'url' || type === 'slide';
}

/**
 * The action type an Action Settings trigger should show right now.
 *
 * WHY: a panel that derives its select purely from the committed element
 * round-trips a freshly picked "Go to URL" back to "None" (see
 * {@link actionTypeNeedsTarget}), so the input the user still has to fill in
 * never appears and those two action kinds are unreachable. The locally picked
 * ("pending") type therefore wins until the element really carries an action.
 *
 * @param pendingType - The type the user just picked, if any.
 * @param committedType - The type read back off the element.
 */
export function resolveActionType(
	pendingType: ElementActionType | undefined,
	committedType: ElementActionType | undefined,
): ElementActionType {
	return pendingType ?? committedType ?? 'none';
}

/**
 * Whether a picked action type can be written to the element yet.
 *
 * Target-free kinds (navigation verbs, `none`) commit on the spot; `url` and
 * `slide` wait for their target so the write cannot round-trip to `none` and
 * wipe the choice the user is halfway through making.
 *
 * @param target - The target values the panel currently holds.
 */
export function canCommitActionType(
	type: ElementActionType,
	target: { url?: string; slideIndex?: number },
): boolean {
	if (type === 'url') {
		return Boolean(target.url);
	}
	if (type === 'slide') {
		return typeof target.slideIndex === 'number';
	}
	return true;
}

/**
 * Clamp a user-entered, 1-based slide number to a valid 0-based slide index.
 *
 * The inspector shows slide numbers the way the audience sees them (1-based),
 * while `ElementAction.slideIndex` is 0-based; doing the conversion here keeps
 * the off-by-one out of every binding's template.
 *
 * @returns The 0-based index, or `undefined` when the input is not a number.
 */
export function toSlideIndex(oneBased: number, slideCount: number): number | undefined {
	if (!Number.isFinite(oneBased)) {
		return undefined;
	}
	const zeroBased = Math.round(oneBased) - 1;
	return Math.max(0, Math.min(Math.max(slideCount - 1, 0), zeroBased));
}
