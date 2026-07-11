import { describe, expect, it } from 'vitest';

import { DEFAULT_RIBBON_TAB, isRibbonTab, RIBBON_TABS } from './ribbon-tabs';

describe('ribbon-tabs', () => {
	it('lists File / Home / Insert / View in that order', () => {
		expect(RIBBON_TABS.map((tab) => tab.id)).toStrictEqual(['file', 'home', 'insert', 'view']);
	});

	it('every tab has a pptx.ribbon.tab.* label key', () => {
		for (const tab of RIBBON_TABS) {
			expect(tab.labelKey).toBe(`pptx.ribbon.tab.${tab.id}`);
		}
	});

	it('defaults to the Home tab', () => {
		expect(DEFAULT_RIBBON_TAB).toBe('home');
	});

	it('isRibbonTab recognizes registered ids only', () => {
		expect(isRibbonTab('home')).toBeTruthy();
		expect(isRibbonTab('design')).toBeFalsy();
	});
});
