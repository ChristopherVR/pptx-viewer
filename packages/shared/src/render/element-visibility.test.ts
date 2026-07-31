import { describe, expect, it } from 'vitest';

import { filterRenderedElements, isElementHidden, isElementRendered } from './element-visibility';

describe('element-visibility', () => {
	describe('isElementHidden', () => {
		it('reports an element the Selection Pane hid', () => {
			expect(isElementHidden({ hidden: true })).toBeTruthy();
		});

		it('treats an absent or false flag as visible', () => {
			expect(isElementHidden({})).toBeFalsy();
			expect(isElementHidden({ hidden: false })).toBeFalsy();
		});

		it('tolerates a missing element', () => {
			expect(isElementHidden(undefined)).toBeFalsy();
			expect(isElementHidden(null)).toBeFalsy();
		});
	});

	describe('isElementRendered', () => {
		it('is the inverse of isElementHidden', () => {
			expect(isElementRendered({ hidden: true })).toBeFalsy();
			expect(isElementRendered({ hidden: false })).toBeTruthy();
			expect(isElementRendered({})).toBeTruthy();
		});
	});

	describe('filterRenderedElements', () => {
		it('drops hidden entries but keeps the original order', () => {
			const a = { id: 'a' };
			const b = { id: 'b', hidden: true };
			const c = { id: 'c' };
			expect(filterRenderedElements([a, b, c])).toStrictEqual([a, c]);
		});

		it('returns the same array reference when nothing is hidden', () => {
			const input = [{ id: 'a' }, { id: 'b' }];
			expect(filterRenderedElements(input)).toBe(input);
		});
	});
});
