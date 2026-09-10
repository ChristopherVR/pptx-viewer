/**
 * action-target-fields.component.test.ts: the Action Settings panel's
 * per-trigger target control, split out of `ActionSettingsPanelComponent`.
 * No Angular TestBed: direct instantiation for the pure event-value
 * extraction, matching the rest of this package.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { ActionTargetFieldsComponent } from './action-target-fields.component';

function fakeEvent(value: string, checked?: boolean): Event {
	const target = { value, checked } as unknown as HTMLInputElement;
	return { target } as unknown as Event;
}

describe('actionTargetFieldsComponent event-value helpers', () => {
	const component = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ActionTargetFieldsComponent(),
	);

	it('inputValue reads the target element value', () => {
		expect(component['inputValue'](fakeEvent('https://example.com/'))).toBe('https://example.com/');
	});

	it('checkedValue reads the target checkbox state', () => {
		expect(component['checkedValue'](fakeEvent('', true))).toBeTruthy();
		expect(component['checkedValue'](fakeEvent('', false))).toBeFalsy();
	});

	it('numberValue parses the target element value (the slide-number spinner)', () => {
		expect(component['numberValue'](fakeEvent('3'))).toBe(3);
	});
});

describe('actionTargetFieldsComponent runProgram target field', () => {
	// No Angular TestBed here (see the file header), so the template predicate
	// is asserted at the source level, matching
	// `action-settings-panel.component.test.ts`'s "wave-4 action types" specs.
	const source = readFileSync(path.join(__dirname, 'action-target-fields.component.ts'), 'utf8');

	it('shows the target input for "Run program", on the same branch as openFile/openPresentation', () => {
		expect(source).toContain(
			"type() === 'openFile' || type() === 'openPresentation' || type() === 'runProgram'",
		);
	});

	it('that branch writes into action().url via urlChange, using the same inputValue helper', () => {
		const component = runInInjectionContext(
			Injector.create({ providers: [] }),
			() => new ActionTargetFieldsComponent(),
		);
		// The branch shares one <input> for openFile/openPresentation/runProgram,
		// so proving the helper it wires to `urlChange` reads the typed value
		// proves typing into a runProgram target emits the right string, without
		// needing a renderer to select the type first.
		expect(source).toContain('(input)="urlChange.emit(inputValue($event))"');
		expect(component['inputValue'](fakeEvent('notepad.exe C:\\temp\\notes.txt'))).toBe(
			'notepad.exe C:\\temp\\notes.txt',
		);
	});
});
