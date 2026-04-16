import { describe, it, expect } from 'vitest';

import type { PptxCustomShow, PptxSlide } from '../types/presentation';
import {
	findCustomShow,
	resolveCustomShowSlideIndices,
	getCustomShowNames,
	navigateCustomShow,
	getCustomShowPositionLabel,
} from './custom-show-utils';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const slides: PptxSlide[] = [
	{ id: 's1', rId: 'rId2', slideNumber: 1, elements: [] },
	{ id: 's2', rId: 'rId3', slideNumber: 2, elements: [] },
	{ id: 's3', rId: 'rId4', slideNumber: 3, elements: [] },
	{ id: 's4', rId: 'rId5', slideNumber: 4, elements: [] },
	{ id: 's5', rId: 'rId6', slideNumber: 5, elements: [] },
] as PptxSlide[];

const shows: PptxCustomShow[] = [
	{ name: 'Executive Summary', id: '0', slideRIds: ['rId2', 'rId5', 'rId6'] },
	{ name: 'Technical Deep Dive', id: '1', slideRIds: ['rId3', 'rId4'] },
];

// ---------------------------------------------------------------------------
// findCustomShow
// ---------------------------------------------------------------------------

describe('findCustomShow', () => {
	it('finds by id', () => {
		expect(findCustomShow(shows, '0')?.name).toBe('Executive Summary');
	});

	it('finds by name (case-insensitive)', () => {
		expect(findCustomShow(shows, 'executive summary')?.id).toBe('0');
	});

	it('returns undefined for unknown name/id', () => {
		expect(findCustomShow(shows, 'nonexistent')).toBeUndefined();
	});

	it('returns undefined for empty array', () => {
		expect(findCustomShow([], '0')).toBeUndefined();
	});

	it('returns undefined for undefined input', () => {
		expect(findCustomShow(undefined, '0')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// resolveCustomShowSlideIndices
// ---------------------------------------------------------------------------

describe('resolveCustomShowSlideIndices', () => {
	it('resolves rIds to 0-based slide indices in custom show order', () => {
		const indices = resolveCustomShowSlideIndices(shows[0], slides);
		// rId2 → 0, rId5 → 3, rId6 → 4
		expect(indices).toStrictEqual([0, 3, 4]);
	});

	it('resolves second show correctly', () => {
		const indices = resolveCustomShowSlideIndices(shows[1], slides);
		// rId3 → 1, rId4 → 2
		expect(indices).toStrictEqual([1, 2]);
	});

	it('skips unresolvable rIds', () => {
		const show: PptxCustomShow = { name: 'Bad', id: '99', slideRIds: ['rId2', 'rIdBogus', 'rId6'] };
		const indices = resolveCustomShowSlideIndices(show, slides);
		expect(indices).toStrictEqual([0, 4]);
	});

	it('returns empty array for empty slideRIds', () => {
		const show: PptxCustomShow = { name: 'Empty', id: '99', slideRIds: [] };
		expect(resolveCustomShowSlideIndices(show, slides)).toStrictEqual([]);
	});

	it('preserves custom show order (not slide order)', () => {
		const show: PptxCustomShow = { name: 'Reverse', id: '99', slideRIds: ['rId6', 'rId2'] };
		const indices = resolveCustomShowSlideIndices(show, slides);
		expect(indices).toStrictEqual([4, 0]); // reverse of natural order
	});
});

// ---------------------------------------------------------------------------
// getCustomShowNames
// ---------------------------------------------------------------------------

describe('getCustomShowNames', () => {
	it('returns all show names', () => {
		expect(getCustomShowNames(shows)).toStrictEqual(['Executive Summary', 'Technical Deep Dive']);
	});

	it('returns empty for undefined', () => {
		expect(getCustomShowNames(undefined)).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// navigateCustomShow
// ---------------------------------------------------------------------------

describe('navigateCustomShow', () => {
	const filtered = [0, 3, 4]; // Executive Summary show indices

	it('navigates to next slide in custom show', () => {
		expect(navigateCustomShow(0, 1, filtered)).toBe(3);
	});

	it('navigates to previous slide in custom show', () => {
		expect(navigateCustomShow(3, -1, filtered)).toBe(0);
	});

	it('stays at last slide when navigating forward without wrap', () => {
		expect(navigateCustomShow(4, 1, filtered)).toBe(4);
	});

	it('stays at first slide when navigating backward without wrap', () => {
		expect(navigateCustomShow(0, -1, filtered)).toBe(0);
	});

	it('wraps forward when enabled', () => {
		expect(navigateCustomShow(4, 1, filtered, true)).toBe(0);
	});

	it('wraps backward when enabled', () => {
		expect(navigateCustomShow(0, -1, filtered, true)).toBe(4);
	});

	it('jumps to first slide when current is not in custom show', () => {
		expect(navigateCustomShow(2, 1, filtered)).toBe(0);
	});

	it('returns current index for empty filtered list', () => {
		expect(navigateCustomShow(0, 1, [])).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getCustomShowPositionLabel
// ---------------------------------------------------------------------------

describe('getCustomShowPositionLabel', () => {
	const filtered = [0, 3, 4];

	it('returns "1 of 3" for first slide', () => {
		expect(getCustomShowPositionLabel(0, filtered)).toBe('1 of 3');
	});

	it('returns "3 of 3" for last slide', () => {
		expect(getCustomShowPositionLabel(4, filtered)).toBe('3 of 3');
	});

	it('returns empty string for slide not in show', () => {
		expect(getCustomShowPositionLabel(2, filtered)).toBe('');
	});
});
