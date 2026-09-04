import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	extractCBhvrAttrs,
	extractChildCalcMode,
	normalizeCalcMode,
} from './native-animation-cbhvr-attrs';

describe('extractCBhvrAttrs', () => {
	it('parses additive, accumulate, xfrmType, and override', () => {
		const cBhvr: XmlObject = {
			'@_additive': 'sum',
			'@_accumulate': 'always',
			'@_xfrmType': 'img',
			'@_override': 'childStyle',
		};
		expect(extractCBhvrAttrs(cBhvr)).toStrictEqual({
			cBhvrAdditive: 'sum',
			cBhvrAccumulate: 'always',
			cBhvrXfrmType: 'img',
			cBhvrOverride: 'childStyle',
		});
	});

	it('returns undefined for a cBhvr with none of the four attributes', () => {
		expect(extractCBhvrAttrs({ '@_id': '1' })).toBeUndefined();
	});

	it('returns undefined for an unrecognised value', () => {
		expect(extractCBhvrAttrs({ '@_additive': 'bogus' })).toBeUndefined();
	});

	it('returns undefined for a missing cBhvr node', () => {
		expect(extractCBhvrAttrs(undefined)).toBeUndefined();
	});
});

describe('normalizeCalcMode / extractChildCalcMode', () => {
	it('normalizes discrete/lin/fmla and rejects anything else', () => {
		expect(normalizeCalcMode('discrete')).toBe('discrete');
		expect(normalizeCalcMode('lin')).toBe('lin');
		expect(normalizeCalcMode('fmla')).toBe('fmla');
		expect(normalizeCalcMode('bogus')).toBeUndefined();
		expect(normalizeCalcMode(undefined)).toBeUndefined();
	});

	it("finds @_calcmode on the winning p:anim node ('discrete' style toggle)", () => {
		const childTnList: XmlObject = {
			'p:anim': {
				'@_calcmode': 'discrete',
				'p:cBhvr': { 'p:attrNameLst': { 'p:attrName': 'style.visibility' } },
			},
		};
		expect(extractChildCalcMode(childTnList)).toBe('discrete');
	});

	it('returns undefined when no p:anim carries @_calcmode', () => {
		expect(extractChildCalcMode({ 'p:anim': { 'p:cBhvr': {} } })).toBeUndefined();
	});

	it('returns undefined for a missing childTnLst', () => {
		expect(extractChildCalcMode(undefined)).toBeUndefined();
	});
});
