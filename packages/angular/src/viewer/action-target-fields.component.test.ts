/**
 * action-target-fields.component.test.ts: the Action Settings panel's
 * per-trigger target control, split out of `ActionSettingsPanelComponent`.
 * No Angular TestBed: direct instantiation for the pure event-value
 * extraction, matching the rest of this package.
 */
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
