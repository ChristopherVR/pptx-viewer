import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	buildChartUniqueIdExtLst,
	CHART_UNIQUE_ID_EXT_URI,
	generateChartUniqueId,
	parseChartUniqueId,
	regenerateClonedUniqueId,
} from './chart-series-identity';

function localName(key: string): string {
	return key.replace(/^.*:/u, '');
}

const GUID_RE = /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/;

describe('parseChartUniqueId', () => {
	it('returns undefined for a node with no extLst', () => {
		expect(parseChartUniqueId({}, localName)).toBeUndefined();
	});

	// Real corpus shape, from e2e/fixtures/chart-data-fidelity.pptx chart1.xml.
	it('parses c16:uniqueId from a real corpus-shaped c:ser/c:extLst', () => {
		const seriesNode: XmlObject = {
			'c:idx': { '@_val': '0' },
			'c:extLst': {
				'c:ext': {
					'@_uri': CHART_UNIQUE_ID_EXT_URI,
					'@_xmlns:c16': 'http://schemas.microsoft.com/office/drawing/2014/chart',
					'c16:uniqueId': { '@_val': '{00000000-AEA2-48ED-A484-A1104AEB1B51}' },
				},
			},
		};
		expect(parseChartUniqueId(seriesNode, localName)).toBe(
			'{00000000-AEA2-48ED-A484-A1104AEB1B51}',
		);
	});

	it('parses c16:uniqueId from a c:dPt/c:extLst', () => {
		const dPtNode: XmlObject = {
			'c:idx': { '@_val': '1' },
			'c:extLst': {
				'c:ext': {
					'@_uri': CHART_UNIQUE_ID_EXT_URI,
					'c16:uniqueId': { '@_val': '{00000001-E2F1-4F77-BE80-2B425AA84908}' },
				},
			},
		};
		expect(parseChartUniqueId(dPtNode, localName)).toBe('{00000001-E2F1-4F77-BE80-2B425AA84908}');
	});

	it('ignores an extLst whose c:ext uri does not match', () => {
		const seriesNode: XmlObject = {
			'c:extLst': {
				'c:ext': { '@_uri': '{SOME-OTHER-EXTENSION}', 'c16:uniqueId': { '@_val': '{X}' } },
			},
		};
		expect(parseChartUniqueId(seriesNode, localName)).toBeUndefined();
	});

	it('finds the matching c:ext among several extLst entries', () => {
		const seriesNode: XmlObject = {
			'c:extLst': {
				'c:ext': [
					{ '@_uri': '{SOME-OTHER-EXTENSION}' },
					{ '@_uri': CHART_UNIQUE_ID_EXT_URI, 'c16:uniqueId': { '@_val': '{Y}' } },
				],
			},
		};
		expect(parseChartUniqueId(seriesNode, localName)).toBe('{Y}');
	});
});

describe('generateChartUniqueId', () => {
	it('generates a braced, uppercased GUID', () => {
		const id = generateChartUniqueId();
		expect(id).toMatch(GUID_RE);
	});

	it('generates different ids on successive calls', () => {
		const a = generateChartUniqueId();
		const b = generateChartUniqueId();
		expect(a).not.toBe(b);
	});
});

describe('buildChartUniqueIdExtLst', () => {
	it('builds a c:ext wrapper round-trippable by parseChartUniqueId', () => {
		const id = '{12345678-ABCD-EF01-2345-6789ABCDEF01}';
		const extLst = buildChartUniqueIdExtLst(id);
		const node: XmlObject = { 'c:extLst': extLst };
		expect(parseChartUniqueId(node, localName)).toBe(id);
	});
});

describe('regenerateClonedUniqueId', () => {
	it('replaces the val with a fresh, different GUID', () => {
		const original = '{00000000-AEA2-48ED-A484-A1104AEB1B51}';
		const clone: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': CHART_UNIQUE_ID_EXT_URI,
					'c16:uniqueId': { '@_val': original },
				},
			},
		};
		regenerateClonedUniqueId(clone, localName);
		const regenerated = parseChartUniqueId(clone, localName);
		expect(regenerated).toBeDefined();
		expect(regenerated).not.toBe(original);
		expect(regenerated).toMatch(GUID_RE);
	});

	it('is a no-op when the node carries no c16:uniqueId extension', () => {
		const clone: XmlObject = { 'c:idx': { '@_val': '0' } };
		expect(() => regenerateClonedUniqueId(clone, localName)).not.toThrow();
		expect(clone).toStrictEqual({ 'c:idx': { '@_val': '0' } });
	});
});
