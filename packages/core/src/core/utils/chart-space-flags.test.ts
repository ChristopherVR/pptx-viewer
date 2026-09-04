import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseChartSpaceFlags } from './chart-space-flags';

const xmlLookup = {
	getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined {
		if (!parent) {
			return undefined;
		}
		const key = Object.keys(parent).find((k) => k.replace(/^.*:/u, '') === name);
		return key ? (parent[key] as XmlObject | undefined) : undefined;
	},
};

describe('parseChartSpaceFlags', () => {
	it('parses c:date1904 and c:roundedCorners when present with explicit values', () => {
		const chartSpace: XmlObject = {
			'c:date1904': { '@_val': '1' },
			'c:roundedCorners': { '@_val': '0' },
		};
		expect(parseChartSpaceFlags(chartSpace, xmlLookup)).toStrictEqual({
			date1904: true,
			roundedCorners: false,
		});
	});

	it('treats a present element with no @val as true (CT_Boolean default)', () => {
		const chartSpace: XmlObject = { 'c:roundedCorners': {} };
		expect(parseChartSpaceFlags(chartSpace, xmlLookup)).toStrictEqual({ roundedCorners: true });
	});

	it('omits both flags when the chart declares neither element', () => {
		const chartSpace: XmlObject = { 'c:chart': {} };
		expect(parseChartSpaceFlags(chartSpace, xmlLookup)).toStrictEqual({});
	});

	it('returns an empty object for an absent chartSpace', () => {
		expect(parseChartSpaceFlags(undefined, xmlLookup)).toStrictEqual({});
	});
});
