import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { extractSeriesNumbersWithBlanks } from './chart-blank-values';

const PREFIXES = ['c:', ''];

function createXmlLookup() {
	return {
		getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined {
			if (!parent) {
				return undefined;
			}
			for (const prefix of PREFIXES) {
				const value = parent[`${prefix}${name}`];
				if (value !== undefined) {
					return Array.isArray(value) ? (value[0] as XmlObject) : (value as XmlObject);
				}
			}
			return undefined;
		},
		getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[] {
			if (!parent) {
				return [];
			}
			for (const prefix of PREFIXES) {
				const value = parent[`${prefix}${name}`];
				if (value !== undefined) {
					return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
				}
			}
			return [];
		},
		getScalarChildByLocalName(parent: XmlObject | undefined, name: string): unknown {
			if (!parent) {
				return undefined;
			}
			for (const prefix of PREFIXES) {
				const value = parent[`${prefix}${name}`];
				if (value === undefined) {
					continue;
				}
				if (value !== null && typeof value === 'object') {
					return (value as XmlObject)['#text'];
				}
				return value;
			}
			return undefined;
		},
	};
}

function valNode(pts: Array<{ idx: number; v: number | string }>, ptCount?: number): XmlObject {
	const cache: XmlObject = {
		'c:pt': pts.map((p) => ({ '@_idx': String(p.idx), 'c:v': p.v })),
	};
	if (ptCount !== undefined) {
		cache['c:ptCount'] = { '@_val': String(ptCount) };
	}
	return { 'c:numRef': { 'c:numCache': cache } };
}

describe('extractSeriesNumbersWithBlanks', () => {
	const xml = createXmlLookup();

	it('returns an empty array when no cache is present', () => {
		expect(extractSeriesNumbersWithBlanks(undefined, xml)).toStrictEqual([]);
		expect(extractSeriesNumbersWithBlanks({}, xml)).toStrictEqual([]);
	});

	it('produces a dense array (no nulls) when every point is present', () => {
		const node = valNode([
			{ idx: 0, v: 10 },
			{ idx: 1, v: 20 },
			{ idx: 2, v: 30 },
		]);
		expect(extractSeriesNumbersWithBlanks(node, xml)).toStrictEqual([10, 20, 30]);
	});

	it('marks a missing middle index as null (blank)', () => {
		const node = valNode(
			[
				{ idx: 0, v: 10 },
				{ idx: 2, v: 30 },
			],
			3,
		);
		expect(extractSeriesNumbersWithBlanks(node, xml)).toStrictEqual([10, null, 30]);
	});

	it('treats an empty value string as a blank', () => {
		const node = valNode([
			{ idx: 0, v: 10 },
			{ idx: 1, v: '' },
			{ idx: 2, v: 30 },
		]);
		expect(extractSeriesNumbersWithBlanks(node, xml)).toStrictEqual([10, null, 30]);
	});

	it('honours a declared ptCount that exceeds the highest index', () => {
		const node = valNode([{ idx: 0, v: 5 }], 3);
		expect(extractSeriesNumbersWithBlanks(node, xml)).toStrictEqual([5, null, null]);
	});
});
