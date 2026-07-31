/**
 * animation-author-fields.ts: maps each control in the animation authoring panel
 * to the shared `set*` patch builder behind it.
 *
 * The panel had fourteen near-identical handlers, one per control, each of them
 * "read the value off the event, bail if it is not usable, call the matching
 * shared setter, emit the new list". That is copy-paste, and copy-paste is how a
 * control quietly ends up with the wrong guard: they had already drifted into
 * three different bail conditions for the same `<select>` shape. Collapsing them
 * to two dispatch tables means the panel keeps exactly ONE select handler and
 * ONE number handler, and adding a control is a row here rather than another
 * copied method.
 *
 * The setters themselves stay in `pptx-viewer-shared` (re-exported through
 * `animation-author-helpers.ts`); this file only names them.
 */
import type { PptxElementAnimation } from 'pptx-viewer-core';

import {
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
	setDelay,
	setDuration,
	setRepeatCount,
	setRepeatMode,
	setSequence,
	setTimingCurve,
	setTrigger,
	setTriggerShapeId,
} from './animation-author-helpers';

/**
 * A patch builder: takes the current list plus the element and the new value,
 * and returns the next list. Every shared `set*` helper has this shape.
 *
 * The value is typed `string` / `number` here rather than each setter's own
 * union: the DOM only ever hands us the raw control value, and the setters
 * already normalise anything they do not recognise.
 */
type SelectSetter = (
	animations: readonly PptxElementAnimation[],
	elementId: string,
	value: never,
) => PptxElementAnimation[];

type NumberSetter = (
	animations: readonly PptxElementAnimation[],
	elementId: string,
	value: number,
) => PptxElementAnimation[];

/** Controls backed by a `<select>` (or any control yielding a string). */
export const ANIMATION_SELECT_SETTERS = {
	entrance: setAnimationEntrance,
	emphasis: setAnimationEmphasis,
	exit: setAnimationExit,
	sequence: setSequence,
	trigger: setTrigger,
	timingCurve: setTimingCurve,
	repeatMode: setRepeatMode,
} as const satisfies Record<string, SelectSetter>;

/** Controls backed by a numeric `<input>`. */
export const ANIMATION_NUMBER_SETTERS = {
	duration: setDuration,
	delay: setDelay,
	repeatCount: setRepeatCount,
} as const satisfies Record<string, NumberSetter>;

export type AnimationSelectField = keyof typeof ANIMATION_SELECT_SETTERS;
export type AnimationNumberField = keyof typeof ANIMATION_NUMBER_SETTERS;

/**
 * The trigger-shape picker is the one `<select>` that does NOT follow the table:
 * its empty option means "no trigger shape" and must reach the setter as
 * `undefined` rather than being skipped, so it keeps a dedicated path.
 */
export const setTriggerShape = setTriggerShapeId;

/** Extract the string value from a `<select>` change event, or undefined. */
export function stringFromSelect(event: Event): string | undefined {
	const target = event.target;
	if (!(target instanceof HTMLSelectElement)) {
		return undefined;
	}
	return target.value;
}

/** Extract a finite number from an `<input>` change event, or null. */
export function numberFromInput(event: Event): number | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	const parsed = parseFloat(target.value);
	return Number.isFinite(parsed) ? parsed : null;
}
