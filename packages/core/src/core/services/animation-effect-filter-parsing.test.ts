import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseAnimEffectFilter, parseFilterToken } from './animation-effect-filter-parsing';

describe('parseFilterToken', () => {
	it('parses a family with a subtype', () => {
		expect(parseFilterToken('wipe(up)')).toStrictEqual({ family: 'wipe', subtype: 'up' });
	});

	it('parses a bare family with no subtype', () => {
		expect(parseFilterToken('dissolve')).toStrictEqual({ family: 'dissolve', subtype: undefined });
	});

	it('lowercases the family but preserves subtype casing', () => {
		expect(parseFilterToken('BARN(inVertical)')).toStrictEqual({
			family: 'barn',
			subtype: 'inVertical',
		});
	});

	it('parses a numeric subtype', () => {
		expect(parseFilterToken('wheel(4)')).toStrictEqual({ family: 'wheel', subtype: '4' });
	});

	it('returns undefined for an empty or malformed token', () => {
		expect(parseFilterToken('')).toBeUndefined();
		expect(parseFilterToken('   ')).toBeUndefined();
		expect(parseFilterToken('123')).toBeUndefined();
	});
});

describe('parseAnimEffectFilter', () => {
	it('parses filter + transition off a p:animEffect child', () => {
		const childTnList: XmlObject = {
			'p:animEffect': {
				'@_filter': 'checkerboard(across)',
				'@_transition': 'in',
			},
		};
		expect(parseAnimEffectFilter(childTnList)).toStrictEqual({
			family: 'checkerboard',
			subtype: 'across',
			transition: 'in',
			raw: 'checkerboard(across)',
		});
	});

	it('honours only the first candidate of a ;-separated fallback list', () => {
		const childTnList: XmlObject = {
			'p:animEffect': { '@_filter': 'barn(inVertical);wipe(up)' },
		};
		expect(parseAnimEffectFilter(childTnList)).toStrictEqual({
			family: 'barn',
			subtype: 'inVertical',
			transition: undefined,
			raw: 'barn(inVertical);wipe(up)',
		});
	});

	it('returns undefined when p:animEffect has no @filter', () => {
		const childTnList: XmlObject = { 'p:animEffect': { '@_transition': 'out' } };
		expect(parseAnimEffectFilter(childTnList)).toBeUndefined();
	});

	it('returns undefined when there is no p:animEffect at all', () => {
		expect(parseAnimEffectFilter({})).toBeUndefined();
		expect(parseAnimEffectFilter(undefined)).toBeUndefined();
	});

	it('reads the first entry when p:animEffect was normalised to an array', () => {
		const childTnList: XmlObject = {
			'p:animEffect': [{ '@_filter': 'slide(fromLeft)', '@_transition': 'out' }],
		};
		expect(parseAnimEffectFilter(childTnList)).toStrictEqual({
			family: 'slide',
			subtype: 'fromLeft',
			transition: 'out',
			raw: 'slide(fromLeft)',
		});
	});

	it('ignores an invalid @transition value', () => {
		const childTnList: XmlObject = {
			'p:animEffect': { '@_filter': 'fade', '@_transition': 'sideways' },
		};
		expect(parseAnimEffectFilter(childTnList)).toStrictEqual({
			family: 'fade',
			subtype: undefined,
			transition: undefined,
			raw: 'fade',
		});
	});
});
