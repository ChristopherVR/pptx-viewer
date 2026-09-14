import { describe, it, expect } from 'vitest';

import {
	canonicalPlaceholderType,
	canonicalizePlaceholderTypes,
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

	it('restores the canonical schema spelling regardless of input case', () => {
		expect(normalizePlaceholderType('Title')).toBe('title');
		expect(normalizePlaceholderType('BODY')).toBe('body');
		expect(normalizePlaceholderType('ctrtitle')).toBe('ctrTitle');
		expect(normalizePlaceholderType('SLDNUM')).toBe('sldNum');
	});

	it('trims whitespace', () => {
		expect(normalizePlaceholderType('  title  ')).toBe('title');
	});

	it('passes through valid types unchanged', () => {
		expect(normalizePlaceholderType('ctrTitle')).toBe('ctrTitle');
		expect(normalizePlaceholderType('sldNum')).toBe('sldNum');
	});

	it('passes through an unknown type unchanged rather than inventing one', () => {
		expect(normalizePlaceholderType('header')).toBe('header');
	});
});

// ---------------------------------------------------------------------------
// canonicalPlaceholderType / canonicalizePlaceholderTypes
// ---------------------------------------------------------------------------

describe('canonicalPlaceholderType', () => {
	it('returns the schema spelling for any casing of a known type', () => {
		expect(canonicalPlaceholderType('ctrtitle')).toBe('ctrTitle');
		expect(canonicalPlaceholderType('CTRTITLE')).toBe('ctrTitle');
		expect(canonicalPlaceholderType('sldnum')).toBe('sldNum');
		expect(canonicalPlaceholderType('subtitle')).toBe('subTitle');
		expect(canonicalPlaceholderType('twoobjandtx')).toBe('twoObjAndTx');
		expect(canonicalPlaceholderType(' body ')).toBe('body');
		expect(canonicalPlaceholderType('title')).toBe('title');
	});

	it('returns undefined for unknown or empty values', () => {
		expect(canonicalPlaceholderType('header')).toBeUndefined();
		expect(canonicalPlaceholderType('')).toBeUndefined();
		expect(canonicalPlaceholderType(undefined)).toBeUndefined();
		expect(canonicalPlaceholderType(null)).toBeUndefined();
	});
});

describe('canonicalizePlaceholderTypes', () => {
	it('rewrites every mis-cased p:ph/@type in a parsed part and counts the changes', () => {
		const root = {
			'p:cSld': {
				'p:spTree': {
					'p:sp': [
						{ 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'ctrtitle' } } } },
						{ 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'subTitle', '@_idx': '1' } } } },
						{ 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_idx': '2' } } } },
					],
					'p:grpSp': {
						'p:sp': { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'SLDNUM' } } } },
					},
				},
			},
		};
		expect(canonicalizePlaceholderTypes(root)).toBe(2);
		const shapes = root['p:cSld']['p:spTree']['p:sp'];
		expect(shapes[0]['p:nvSpPr']['p:nvPr']['p:ph']['@_type']).toBe('ctrTitle');
		expect(shapes[1]['p:nvSpPr']['p:nvPr']['p:ph']['@_type']).toBe('subTitle');
		expect(shapes[2]['p:nvSpPr']['p:nvPr']['p:ph']).toStrictEqual({ '@_idx': '2' });
		expect(
			root['p:cSld']['p:spTree']['p:grpSp']['p:sp']['p:nvSpPr']['p:nvPr']['p:ph']['@_type'],
		).toBe('sldNum');
	});

	it('leaves unknown types and a p:ph-free part untouched', () => {
		const root = {
			'p:sp': { 'p:nvPr': { 'p:ph': { '@_type': 'header' } } },
			'p:other': { '@_type': 'ctrtitle' },
		};
		expect(canonicalizePlaceholderTypes(root)).toBe(0);
		expect(root['p:sp']['p:nvPr']['p:ph']['@_type']).toBe('header');
		expect(root['p:other']['@_type']).toBe('ctrtitle');
		expect(canonicalizePlaceholderTypes({})).toBe(0);
		expect(canonicalizePlaceholderTypes(undefined)).toBe(0);
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
