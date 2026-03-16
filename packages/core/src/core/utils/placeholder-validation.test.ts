import { describe, it, expect } from 'vitest';

import {
	isValidPlaceholderType,
	normalizePlaceholderType,
	getValidPlaceholderTypes,
} from './placeholder-validation';

// ---------------------------------------------------------------------------
// isValidPlaceholderType
// ---------------------------------------------------------------------------

describe('isValidPlaceholderType', () => {
	it('returns true for core OOXML placeholder types', () => {
		const coreTypes = [
			'body',
			'chart',
			'clipArt',
			'ctrTitle',
			'dgm',
			'dt',
			'ftr',
			'hdr',
			'media',
			'obj',
			'pic',
			'sldImg',
			'sldNum',
			'subTitle',
			'tbl',
			'title',
		];
		for (const t of coreTypes) {
			expect(isValidPlaceholderType(t)).toBeTruthy();
		}
	});

	it('returns true for extended placeholder types', () => {
		const extendedTypes = [
			'half',
			'qtr',
			'txAndClipArt',
			'txAndChart',
			'txAndMedia',
			'txAndObj',
			'txAndTwoObj',
			'txOverObj',
			'objAndTx',
			'twoObj',
			'twoObjAndObj',
			'twoObjAndTx',
			'twoObjOverTx',
			'objOverTx',
			'twoColTx',
			'fourObj',
		];
		for (const t of extendedTypes) {
			expect(isValidPlaceholderType(t)).toBeTruthy();
		}
	});

	it('returns false for invalid placeholder types', () => {
		expect(isValidPlaceholderType('unknown')).toBeFalsy();
		expect(isValidPlaceholderType('')).toBeFalsy();
		expect(isValidPlaceholderType('header')).toBeFalsy();
		expect(isValidPlaceholderType('TITLE')).toBeFalsy(); // case-sensitive
	});

	it('returns false for undefined-like strings', () => {
		expect(isValidPlaceholderType('undefined')).toBeFalsy();
		expect(isValidPlaceholderType('null')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// normalizePlaceholderType
// ---------------------------------------------------------------------------

describe('normalizePlaceholderType', () => {
	it('returns "body" for undefined', () => {
		expect(normalizePlaceholderType(undefined)).toBe('body');
	});

	it('returns "body" for empty string', () => {
		expect(normalizePlaceholderType('')).toBe('body');
	});

	it('returns "body" for whitespace-only', () => {
		expect(normalizePlaceholderType('   ')).toBe('body');
	});

	it('lowercases the type', () => {
		expect(normalizePlaceholderType('Title')).toBe('title');
		expect(normalizePlaceholderType('BODY')).toBe('body');
	});

	it('trims whitespace', () => {
		expect(normalizePlaceholderType('  title  ')).toBe('title');
	});

	it('passes through valid types unchanged (after normalization)', () => {
		expect(normalizePlaceholderType('ctrTitle')).toBe('ctrtitle');
		expect(normalizePlaceholderType('sldNum')).toBe('sldnum');
	});
});

// ---------------------------------------------------------------------------
// getValidPlaceholderTypes
// ---------------------------------------------------------------------------

describe('getValidPlaceholderTypes', () => {
	it('returns a Set', () => {
		const types = getValidPlaceholderTypes();
		expect(types).toBeInstanceOf(Set);
	});

	it('contains core types', () => {
		const types = getValidPlaceholderTypes();
		expect(types.has('title')).toBeTruthy();
		expect(types.has('body')).toBeTruthy();
		expect(types.has('sldNum')).toBeTruthy();
	});

	it('returns the same set on multiple calls (immutable)', () => {
		const a = getValidPlaceholderTypes();
		const b = getValidPlaceholderTypes();
		expect(a).toBe(b);
	});

	it('has at least 20 entries', () => {
		const types = getValidPlaceholderTypes();
		expect(types.size).toBeGreaterThanOrEqual(20);
	});
});
