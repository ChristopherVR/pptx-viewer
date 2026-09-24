/**
 * chart-event-helpers.ts: Small typed DOM-event readers shared by the chart
 * inspector control components. They narrow `event.target` to the right element
 * type and pull the value out, returning `null` when the target is unexpected so
 * callers can bail without firing a no-op edit.
 *
 * @module angular-viewer/chart-event-helpers
 */

import { isSelectControl, isCheckboxControl } from './control-event-targets';

/** Read the string value from an `<input>` or `<select>` change/input event. */
export function stringFromEvent(event: Event): string | null {
	const target = event.target;
	if (target instanceof HTMLInputElement || isSelectControl(target)) {
		return target.value;
	}
	return null;
}

/** Read the value from a `<select>` change event. */
export function selectValue(event: Event): string | null {
	const target = event.target;
	return isSelectControl(target) ? target.value : null;
}

/** Read the checked state from a checkbox `<input>` change event. */
export function boolFromEvent(event: Event): boolean {
	const target = event.target;
	return isCheckboxControl(target) ? target.checked : false;
}

/**
 * Read a numeric value from an `<input type="number">`. Returns `null` for an
 * empty field (a "clear the override" signal) and `undefined` for a non-finite
 * entry (ignore). A finite parse returns the number.
 */
export function numFromEvent(event: Event): number | null | undefined {
	const raw = stringFromEvent(event);
	if (raw === null || raw === '') {
		return null;
	}
	const num = Number.parseFloat(raw);
	return Number.isFinite(num) ? num : undefined;
}
