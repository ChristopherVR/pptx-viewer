/**
 * mobile-chrome-helpers.test.ts — Unit tests for mobile chrome pure helpers.
 *
 * No Angular TestBed — pure functions only.
 *
 * Source: packages/angular/src/viewer/mobile-chrome-helpers.ts
 */

import { describe, expect, it } from 'vitest';

import { buildBarActions, sheetAfterNavigate, toggleSheet } from './mobile-chrome-helpers';
import type { MobileSheetKey } from './mobile-chrome-helpers';

// ---------------------------------------------------------------------------
// toggleSheet
// ---------------------------------------------------------------------------

describe('toggleSheet', () => {
	it('opens slides when nothing is open', () => {
		expect(toggleSheet(null, 'slides')).toBe('slides');
	});

	it('opens menu when nothing is open', () => {
		expect(toggleSheet(null, 'menu')).toBe('menu');
	});

	it('closes slides when slides is already open (toggle)', () => {
		expect(toggleSheet('slides', 'slides')).toBeNull();
	});

	it('closes menu when menu is already open (toggle)', () => {
		expect(toggleSheet('menu', 'menu')).toBeNull();
	});

	it('switches from slides to menu', () => {
		expect(toggleSheet('slides', 'menu')).toBe('menu');
	});

	it('switches from menu to slides', () => {
		expect(toggleSheet('menu', 'slides')).toBe('slides');
	});
});

// ---------------------------------------------------------------------------
// buildBarActions
// ---------------------------------------------------------------------------

describe('buildBarActions', () => {
	const base = {
		activeIndex: 2,
		slideCount: 5,
		canPresent: true,
		slidesOpen: false,
		menuOpen: false,
	};

	it('returns six actions', () => {
		expect(buildBarActions(base)).toHaveLength(6);
	});

	it('has the correct keys in order', () => {
		const keys = buildBarActions(base).map((a) => a.key);
		expect(keys).toStrictEqual(['prev', 'slides', 'find', 'present', 'menu', 'next']);
	});

	it('disables prev when activeIndex is 0', () => {
		const actions = buildBarActions({ ...base, activeIndex: 0 });
		expect(actions.find((a) => a.key === 'prev')!.disabled).toBeTruthy();
	});

	it('enables prev when activeIndex > 0', () => {
		const actions = buildBarActions({ ...base, activeIndex: 1 });
		expect(actions.find((a) => a.key === 'prev')!.disabled).toBeFalsy();
	});

	it('disables next when on the last slide', () => {
		const actions = buildBarActions({ ...base, activeIndex: 4 });
		expect(actions.find((a) => a.key === 'next')!.disabled).toBeTruthy();
	});

	it('enables next when not on the last slide', () => {
		const actions = buildBarActions({ ...base, activeIndex: 3 });
		expect(actions.find((a) => a.key === 'next')!.disabled).toBeFalsy();
	});

	it('disables slides/find/present when slideCount is 0', () => {
		const actions = buildBarActions({ ...base, activeIndex: 0, slideCount: 0 });
		expect(actions.find((a) => a.key === 'slides')!.disabled).toBeTruthy();
		expect(actions.find((a) => a.key === 'find')!.disabled).toBeTruthy();
		expect(actions.find((a) => a.key === 'present')!.disabled).toBeTruthy();
	});

	it('disables present when canPresent is false', () => {
		const actions = buildBarActions({ ...base, canPresent: false });
		expect(actions.find((a) => a.key === 'present')!.disabled).toBeTruthy();
	});

	it('enables present when canPresent is true and slides exist', () => {
		const actions = buildBarActions({ ...base, canPresent: true });
		expect(actions.find((a) => a.key === 'present')!.disabled).toBeFalsy();
	});

	it('never disables the menu button', () => {
		const actions = buildBarActions({ ...base, slideCount: 0, canPresent: false });
		expect(actions.find((a) => a.key === 'menu')!.disabled).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// sheetAfterNavigate
// ---------------------------------------------------------------------------

describe('sheetAfterNavigate', () => {
	const cases: Array<[MobileSheetKey, MobileSheetKey]> = [
		[null, null],
		['slides', 'slides'],
		['menu', null],
	];

	it.each(cases)('(%s) → %s', (input, expected) => {
		expect(sheetAfterNavigate(input)).toBe(expected);
	});
});
