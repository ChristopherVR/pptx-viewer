import { describe, it, expect } from 'vitest';

import { isCurrentLayout, scopeLayoutOptionsToSlide } from './layout-gallery';

const OFFICE = 'ppt/slideMasters/slideMaster1.xml';
const IMPORTED = 'ppt/slideMasters/slideMaster2.xml';

const option = (path: string, name: string, masterPath?: string) => ({ path, name, masterPath });

describe('scopeLayoutOptionsToSlide', () => {
	it("keeps only the active slide's master", () => {
		const options = [
			option('l1', 'Title Slide', OFFICE),
			option('l2', 'Title and Content', OFFICE),
			option('l3', 'Title Slide', IMPORTED),
		];

		expect(scopeLayoutOptionsToSlide(options, 'l1').map((o) => o.path)).toStrictEqual(['l1', 'l2']);
	});

	it('collapses duplicate names within the master, preferring the active one', () => {
		const options = [
			option('l1', 'Title and Content', OFFICE),
			option('l2', 'Title and Content', OFFICE),
		];

		expect(scopeLayoutOptionsToSlide(options, 'l2').map((o) => o.path)).toStrictEqual(['l2']);
	});

	it('preserves document order', () => {
		const options = [
			option('l1', 'A', OFFICE),
			option('l2', 'B', OFFICE),
			option('l3', 'C', OFFICE),
		];

		expect(scopeLayoutOptionsToSlide(options, 'l2').map((o) => o.name)).toStrictEqual([
			'A',
			'B',
			'C',
		]);
	});

	it('falls back to every layout when scoping cannot be established', () => {
		const withMasters = [option('l1', 'A', OFFICE), option('l2', 'B', IMPORTED)];

		// No active layout at all.
		expect(scopeLayoutOptionsToSlide(withMasters, undefined)).toHaveLength(2);
		// Active layout is not among the options, so its master is unknown.
		expect(scopeLayoutOptionsToSlide(withMasters, 'missing')).toHaveLength(2);
		// Core resolved no master metadata for any option.
		expect(scopeLayoutOptionsToSlide([option('l1', 'A'), option('l2', 'B')], 'l1')).toHaveLength(2);
	});

	it('returns the input array itself when no scoping applies', () => {
		// Callers memoise on the result; handing back a fresh array every pass
		// would invalidate that memo and re-render the menu continuously.
		const options = [option('l1', 'A', OFFICE)];

		expect(scopeLayoutOptionsToSlide(options, undefined)).toBe(options);
	});
});

describe('isCurrentLayout', () => {
	it('matches on path only when an active layout is known', () => {
		expect(isCurrentLayout({ path: 'l1' }, 'l1')).toBeTruthy();
		expect(isCurrentLayout({ path: 'l1' }, 'l2')).toBeFalsy();
		expect(isCurrentLayout({ path: 'l1' }, undefined)).toBeFalsy();
	});
});
