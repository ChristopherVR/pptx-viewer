/**
 * chart-event-helpers.test.ts: Vitest unit tests for chart-event-helpers.ts.
 *
 * The chart inspector control components read DOM values exclusively through
 * these helpers, so testing them validates the value extraction the controls
 * depend on. Pure DOM, no Angular compiler / TestBed (see PORTING.md).
 *
 * @module angular-viewer/chart-event-helpers.test
 */

import { describe, expect, it } from 'vitest';

import { boolFromEvent, numFromEvent, selectValue, stringFromEvent } from './chart-event-helpers';

/** Build a change event whose target is an `<input>` with the given props. */
function inputEvent(props: Partial<HTMLInputElement>): Event {
	const input = document.createElement('input');
	Object.assign(input, props);
	const event = new Event('change');
	Object.defineProperty(event, 'target', { value: input });
	return event;
}

/** Build a change event whose target is a `<select>` with the given value. */
function selectEvent(value: string): Event {
	const select = document.createElement('select');
	const option = document.createElement('option');
	option.value = value;
	select.appendChild(option);
	select.value = value;
	const event = new Event('change');
	Object.defineProperty(event, 'target', { value: select });
	return event;
}

describe('stringFromEvent', () => {
	it('reads an input value', () => {
		expect(stringFromEvent(inputEvent({ value: 'hello' }))).toBe('hello');
	});

	it('reads a select value', () => {
		expect(stringFromEvent(selectEvent('opt'))).toBe('opt');
	});

	it('returns null for an unexpected target', () => {
		expect(stringFromEvent(new Event('change'))).toBeNull();
	});
});

describe('selectValue', () => {
	it('reads a select value', () => {
		expect(selectValue(selectEvent('r'))).toBe('r');
	});

	it('returns null for a non-select target', () => {
		expect(selectValue(inputEvent({ value: 'x' }))).toBeNull();
	});
});

describe('boolFromEvent', () => {
	it('reads a checked checkbox', () => {
		expect(boolFromEvent(inputEvent({ type: 'checkbox', checked: true }))).toBeTruthy();
	});

	it('reads an unchecked checkbox', () => {
		expect(boolFromEvent(inputEvent({ type: 'checkbox', checked: false }))).toBeFalsy();
	});

	it('returns false for a non-input target', () => {
		expect(boolFromEvent(new Event('change'))).toBeFalsy();
	});
});

describe('numFromEvent', () => {
	it('parses a finite number', () => {
		expect(numFromEvent(inputEvent({ value: '42.5' }))).toBeCloseTo(42.5);
	});

	it('returns null for an empty field (clear signal)', () => {
		expect(numFromEvent(inputEvent({ value: '' }))).toBeNull();
	});

	it('returns undefined for a non-finite entry (ignore signal)', () => {
		expect(numFromEvent(inputEvent({ value: 'abc' }))).toBeUndefined();
	});
});
