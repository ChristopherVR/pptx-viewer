import { describe, expect, it } from 'vitest';

import { DEFAULT_RIBBON_TAB, isRibbonTab, RIBBON_TABS } from './ribbon-tabs';

describe('ribbon-tabs registry', () => {
	it('implements the React ribbon tabs in display order', () => {
		expect(RIBBON_TABS.map((tab) => tab.id)).toStrictEqual([
			'file',
			'home',
			'insert',
			'draw',
			'design',
			'transitions',
			'animations',
			'slideShow',
			'record',
			'review',
			'view',
			'help',
		]);
	});

	it('every entry has a non-empty i18n label key', () => {
		for (const tab of RIBBON_TABS) {
			expect(tab.labelKey.length).toBeGreaterThan(0);
			expect(tab.labelKey.startsWith('pptx.ribbon.tab.')).toBeTruthy();
		}
	});

	it('defaults to the Home tab', () => {
		expect(DEFAULT_RIBBON_TAB).toBe('home');
		expect(isRibbonTab(DEFAULT_RIBBON_TAB)).toBeTruthy();
	});

	it('rejects ids that are not in the registry', () => {
		expect(isRibbonTab('file')).toBeTruthy();
		expect(isRibbonTab('draw')).toBeTruthy();
		expect(isRibbonTab('bogus')).toBeFalsy();
	});
});
