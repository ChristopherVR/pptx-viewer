import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	P15_TRANSITION_PRESETS,
	PRSTTRANS_EXT_URI,
	parseP15FromExtLst,
	buildP15ExtLst,
} from './p15-transition-parser';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

/** Minimal mock of IPptxXmlLookupService handling namespace-prefixed keys. */
function createMockXmlLookupService(): IPptxXmlLookupService {
	return {
		getChildByLocalName(parent: XmlObject | undefined, localName: string): XmlObject | undefined {
			if (!parent) {
				return undefined;
			}
			const suffix = `:${localName}`;
			for (const key of Object.keys(parent)) {
				if (key === localName || key.endsWith(suffix)) {
					const val = parent[key];
					if (val && typeof val === 'object' && !Array.isArray(val)) {
						return val as XmlObject;
					}
				}
			}
			return undefined;
		},
		getChildrenArrayByLocalName(parent: XmlObject | undefined, localName: string): XmlObject[] {
			if (!parent) {
				return [];
			}
			const suffix = `:${localName}`;
			for (const key of Object.keys(parent)) {
				if (key === localName || key.endsWith(suffix)) {
					const val = parent[key];
					if (Array.isArray(val)) {
						return val.filter(
							(e: unknown): e is XmlObject =>
								typeof e === 'object' && e !== null && !Array.isArray(e),
						);
					}
					if (val && typeof val === 'object') {
						return [val as XmlObject];
					}
				}
			}
			return [];
		},
		getScalarChildByLocalName(): string | undefined {
			return undefined;
		},
	};
}

function getXmlLocalName(xmlKey: string): string {
	if (!xmlKey) {
		return '';
	}
	const withoutAttr = xmlKey.startsWith('@_') ? xmlKey.slice(2) : xmlKey;
	const idx = withoutAttr.lastIndexOf(':');
	return idx < 0 ? withoutAttr : withoutAttr.slice(idx + 1);
}

describe('p15_TRANSITION_PRESETS', () => {
	it('contains the documented preset transition names', () => {
		for (const name of [
			'fracture',
			'peelOff',
			'pageCurlDouble',
			'pageCurlSingle',
			'airplane',
			'origami',
			'fallOver',
			'drape',
			'curtains',
			'wind',
			'prestige',
			'crush',
		]) {
			expect(P15_TRANSITION_PRESETS.has(name)).toBeTruthy();
		}
	});

	it('has 12 entries', () => {
		expect(P15_TRANSITION_PRESETS.size).toBe(12);
	});

	it('does not contain standard or p14 transition types', () => {
		expect(P15_TRANSITION_PRESETS.has('cut')).toBeFalsy();
		expect(P15_TRANSITION_PRESETS.has('fade')).toBeFalsy();
		expect(P15_TRANSITION_PRESETS.has('vortex')).toBeFalsy();
	});
});

describe('parseP15FromExtLst', () => {
	const lookup = createMockXmlLookupService();

	it('parses prst="fracture" from a p15:prstTrans extension', () => {
		const extLst: XmlObject = {
			'p:ext': {
				'@_uri': PRSTTRANS_EXT_URI,
				'p15:prstTrans': { '@_prst': 'fracture' },
			},
		};
		const result = parseP15FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.type).toBe('fracture');
	});

	it.each([
		'peelOff',
		'pageCurlDouble',
		'pageCurlSingle',
		'airplane',
		'origami',
		'fallOver',
		'drape',
		'curtains',
		'wind',
		'prestige',
		'crush',
	] as const)('parses prst="%s"', (prst) => {
		const extLst: XmlObject = {
			'p:ext': {
				'@_uri': PRSTTRANS_EXT_URI,
				'p15:prstTrans': { '@_prst': prst },
			},
		};
		const result = parseP15FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result!.type).toBe(prst);
	});

	it('parses invX/invY booleans', () => {
		const extLst: XmlObject = {
			'p:ext': {
				'@_uri': PRSTTRANS_EXT_URI,
				'p15:prstTrans': { '@_prst': 'peelOff', '@_invX': '1', '@_invY': '0' },
			},
		};
		const result = parseP15FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result!.invX).toBeTruthy();
		expect(result!.invY).toBeFalsy();
	});

	it('returns undefined for an unknown prst value', () => {
		const extLst: XmlObject = {
			'p:ext': {
				'@_uri': PRSTTRANS_EXT_URI,
				'p15:prstTrans': { '@_prst': 'notARealPreset' },
			},
		};
		expect(parseP15FromExtLst(extLst, lookup, getXmlLocalName)).toBeUndefined();
	});

	it('returns undefined when there is no prstTrans element', () => {
		const extLst: XmlObject = {
			'p:ext': { '@_uri': '{OTHER}', 'p14:vortex': {} },
		};
		expect(parseP15FromExtLst(extLst, lookup, getXmlLocalName)).toBeUndefined();
	});
});

describe('buildP15ExtLst', () => {
	it('fabricates a p15:prstTrans ext with prst and namespace', () => {
		const result = buildP15ExtLst('fracture');
		const ext = result['p:ext'] as XmlObject;
		expect(ext['@_uri']).toBe(PRSTTRANS_EXT_URI);
		const prstTrans = ext['p15:prstTrans'] as XmlObject;
		expect(prstTrans['@_prst']).toBe('fracture');
		expect(prstTrans['@_xmlns:p15']).toBe(
			'http://schemas.microsoft.com/office/powerpoint/2012/main',
		);
	});

	it('emits invX/invY only when true', () => {
		const result = buildP15ExtLst('peelOff', true, false);
		const prstTrans = (result['p:ext'] as XmlObject)['p15:prstTrans'] as XmlObject;
		expect(prstTrans['@_invX']).toBe('1');
		expect(prstTrans['@_invY']).toBeUndefined();
	});
});
