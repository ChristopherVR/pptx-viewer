import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	DECORATIVE_EXT_URI,
	isCNvPrMarkedDecorative,
	serializeDecorativeExtension,
} from './decorative-extension';

function decorativeExtLst(val = '1'): XmlObject {
	return {
		'a:ext': {
			'@_uri': DECORATIVE_EXT_URI,
			'adec:decorative': { '@_val': val },
		},
	};
}

describe('isCNvPrMarkedDecorative (issue G16)', () => {
	it('returns undefined when p:cNvPr has no a:extLst', () => {
		expect(isCNvPrMarkedDecorative({})).toBeUndefined();
		expect(isCNvPrMarkedDecorative(undefined)).toBeUndefined();
	});

	it('reads a real p:cNvPr/a:extLst/a:ext[@uri=...]/adec:decorative val="1"', () => {
		const cNvPr: XmlObject = { '@_id': '2', '@_name': 'Picture 1', 'a:extLst': decorativeExtLst() };
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeTruthy();
	});

	it('returns false for an explicit val="0"', () => {
		const cNvPr: XmlObject = { 'a:extLst': decorativeExtLst('0') };
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeFalsy();
	});

	it('returns undefined when a:extLst carries only unrelated extensions', () => {
		const cNvPr: XmlObject = {
			'a:extLst': { 'a:ext': { '@_uri': '{OTHER-UUID}', 'foo:bar': {} } },
		};
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeUndefined();
	});

	it('finds the decorative ext among an array of multiple a:ext entries', () => {
		const cNvPr: XmlObject = {
			'a:extLst': {
				'a:ext': [
					{ '@_uri': '{OTHER-UUID}', 'foo:bar': {} },
					{ '@_uri': DECORATIVE_EXT_URI, 'adec:decorative': { '@_val': '1' } },
				],
			},
		};
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeTruthy();
	});
});

describe('serializeDecorativeExtension (issue G16)', () => {
	it('is a no-op when isDecorative is undefined, preserving raw XML untouched', () => {
		const cNvPr: XmlObject = { 'a:extLst': decorativeExtLst() };
		serializeDecorativeExtension(cNvPr, undefined);
		expect(cNvPr['a:extLst']).toStrictEqual(decorativeExtLst());
	});

	it('writes a fresh decorative ext when marking true on a cNvPr with no extLst', () => {
		const cNvPr: XmlObject = { '@_id': '2' };
		serializeDecorativeExtension(cNvPr, true);
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeTruthy();
	});

	it('removes the decorative ext (not writing val="0") when cleared to false', () => {
		const cNvPr: XmlObject = { 'a:extLst': decorativeExtLst() };
		serializeDecorativeExtension(cNvPr, false);
		expect(cNvPr['a:extLst']).toBeUndefined();
	});

	it('preserves an unrelated a:ext entry when clearing the decorative one', () => {
		const cNvPr: XmlObject = {
			'a:extLst': {
				'a:ext': [
					{ '@_uri': '{OTHER-UUID}', 'foo:bar': {} },
					{ '@_uri': DECORATIVE_EXT_URI, 'adec:decorative': { '@_val': '1' } },
				],
			},
		};
		serializeDecorativeExtension(cNvPr, false);
		const extLst = cNvPr['a:extLst'] as XmlObject;
		expect(extLst['a:ext']).toStrictEqual({ '@_uri': '{OTHER-UUID}', 'foo:bar': {} });
	});

	it('preserves an unrelated a:ext entry when writing the decorative one', () => {
		const cNvPr: XmlObject = {
			'a:extLst': { 'a:ext': { '@_uri': '{OTHER-UUID}', 'foo:bar': {} } },
		};
		serializeDecorativeExtension(cNvPr, true);
		const extLst = cNvPr['a:extLst'] as XmlObject;
		const exts = extLst['a:ext'] as XmlObject[];
		expect(exts).toHaveLength(2);
		expect(exts.some((e) => e['@_uri'] === '{OTHER-UUID}')).toBeTruthy();
		expect(exts.some((e) => e['@_uri'] === DECORATIVE_EXT_URI)).toBeTruthy();
	});

	it('round-trips parse -> serialize -> parse', () => {
		const cNvPr: XmlObject = {};
		serializeDecorativeExtension(cNvPr, true);
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeTruthy();
		serializeDecorativeExtension(cNvPr, false);
		expect(isCNvPrMarkedDecorative(cNvPr)).toBeUndefined();
	});
});
