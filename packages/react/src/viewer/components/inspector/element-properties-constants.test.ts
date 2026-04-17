import { describe, it, expect, expectTypeOf } from 'vitest';

import { SELECT_CLS, NUMBER_CLS, BTN_CLS } from './element-properties-constants';

describe('element-properties-constants CSS classes', () => {
	it('sELECT_CLS is a non-empty string', () => {
		expect(SELECT_CLS).toBeTruthy();
		expectTypeOf(SELECT_CLS).toBeString();
	});

	it('nUMBER_CLS is a non-empty string', () => {
		expect(NUMBER_CLS).toBeTruthy();
		expectTypeOf(NUMBER_CLS).toBeString();
	});

	it('bTN_CLS is a non-empty string', () => {
		expect(BTN_CLS).toBeTruthy();
		expectTypeOf(BTN_CLS).toBeString();
	});

	it('nUMBER_CLS equals SELECT_CLS', () => {
		expect(NUMBER_CLS).toBe(SELECT_CLS);
	});

	it('bTN_CLS contains flex-related classes', () => {
		expect(BTN_CLS).toContain('inline-flex');
	});
});
