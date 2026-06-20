/**
 * mobile-chrome-helpers.test.ts: Unit tests for mobile chrome pure helpers.
 *
 * No Angular TestBed, pure functions only.
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
	const base = { slideCount: 5 };

	it('returns five actions', () => {
		expect(buildBarActions(base)).toHaveLength(5);
	});

	it('has the correct keys in order', () => {
		const keys = buildBarActions(base).map((a) => a.key);
		expect(keys).toStrictEqual(['slides', 'insert', 'inspector', 'comments', 'notes']);
	});

	it('has the correct labels in order', () => {
		const labels = buildBarActions(base).map((a) => a.label);
		expect(labels).toStrictEqual(['Slides', 'Insert', 'Format', 'Comments', 'Notes']);
	});

	it('enables all actions when slides exist', () => {
		expect(buildBarActions(base).every((a) => !a.disabled)).toBeTruthy();
	});

	it('disables every action when slideCount is 0', () => {
		const actions = buildBarActions({ slideCount: 0 });
		expect(actions.every((a) => a.disabled)).toBeTruthy();
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
