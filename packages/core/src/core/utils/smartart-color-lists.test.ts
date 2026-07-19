import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { buildSmartArtColorLists, parseSmartArtColorListHexes } from './smartart-color-lists';
import type { SmartArtColorListDeps } from './smartart-color-lists';

// ---------------------------------------------------------------------------
// Test doubles mirroring the runtime XML/colour accessors.
// ---------------------------------------------------------------------------

const THEME: Record<string, string> = {
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
};

function localNameOf(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

function getChild(node: XmlObject | undefined, name: string): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	for (const [key, value] of Object.entries(node)) {
		if (localNameOf(key) === name && value && typeof value === 'object' && !Array.isArray(value)) {
			return value as XmlObject;
		}
	}
	return undefined;
}

function resolveScheme(colorNode: XmlObject | undefined): string | undefined {
	const val = String(colorNode?.['@_val'] ?? '').trim();
	return val ? THEME[val] : undefined;
}

/** Resolve a single-colour container (`{ 'a:srgbClr': … }` / `{ 'a:schemeClr': … }`). */
function parseColorChoice(colorChoice: XmlObject | undefined): string | undefined {
	if (!colorChoice) {
		return undefined;
	}
	const srgbNode = colorChoice['a:srgbClr'] as XmlObject | undefined;
	if (srgbNode?.['@_val']) {
		return `#${String(srgbNode['@_val']).toUpperCase()}`;
	}
	const scheme = colorChoice['a:schemeClr'] as XmlObject | undefined;
	if (scheme) {
		return resolveScheme(scheme);
	}
	return undefined;
}

const DEPS: SmartArtColorListDeps = { getChild, parseColorChoice, resolveScheme };

function srgb(...vals: string[]): Record<string, unknown> {
	return { 'a:srgbClr': vals.map((v) => ({ '@_val': v })) };
}

// ---------------------------------------------------------------------------
// parseSmartArtColorListHexes
// ---------------------------------------------------------------------------
describe('parseSmartArtColorListHexes', () => {
	it('returns [] for an undefined list', () => {
		expect(parseSmartArtColorListHexes(undefined, DEPS)).toStrictEqual([]);
	});

	it('parses ALL colours in a multi-colour list (not just the first)', () => {
		const list: XmlObject = srgb('FF0000', '00FF00', '0000FF');
		expect(parseSmartArtColorListHexes(list, DEPS)).toStrictEqual([
			'#FF0000',
			'#00FF00',
			'#0000FF',
		]);
	});

	it('resolves scheme colours via the theme map', () => {
		const list: XmlObject = {
			'a:schemeClr': [{ '@_val': 'accent1' }, { '@_val': 'accent2' }, { '@_val': 'accent3' }],
		};
		expect(parseSmartArtColorListHexes(list, DEPS)).toStrictEqual([
			'#4472C4',
			'#ED7D31',
			'#A5A5A5',
		]);
	});
});

// ---------------------------------------------------------------------------
// buildSmartArtColorLists
// ---------------------------------------------------------------------------
describe('buildSmartArtColorLists', () => {
	it('spreads a 3-colour node0 fill list instead of collapsing to one', () => {
		const styleLbls: XmlObject[] = [
			{
				'@_name': 'node0',
				'dgm:fillClrLst': { '@_meth': 'cycle', ...srgb('FF0000', '00FF00', '0000FF') },
			},
		];
		const result = buildSmartArtColorLists(styleLbls, DEPS);
		expect(result.fillColors).toStrictEqual(['#FF0000', '#00FF00', '#0000FF']);
		expect(result.fillInterpolation).toStrictEqual({ method: 'cycle' });
	});

	it('captures span method + hue direction interpolation metadata', () => {
		const styleLbls: XmlObject[] = [
			{
				'@_name': 'node1',
				'dgm:fillClrLst': {
					'@_meth': 'span',
					'@_hueDir': 'cw',
					'a:schemeClr': [{ '@_val': 'accent1' }, { '@_val': 'accent6' }],
				},
			},
		];
		const result = buildSmartArtColorLists(styleLbls, DEPS);
		expect(result.fillColors).toStrictEqual(['#4472C4', '#70AD47']);
		expect(result.fillInterpolation).toStrictEqual({ method: 'span', hueDirection: 'cw' });
	});

	it('uses the node styleLbl palette, ignoring unrelated fill labels', () => {
		const styleLbls: XmlObject[] = [
			{ '@_name': 'bgShp', 'dgm:fillClrLst': srgb('111111') },
			{ '@_name': 'node0', 'dgm:fillClrLst': srgb('AA0000', 'BB0000', 'CC0000') },
		];
		const result = buildSmartArtColorLists(styleLbls, DEPS);
		expect(result.fillColors).toStrictEqual(['#AA0000', '#BB0000', '#CC0000']);
	});

	it('parses text/effect colour lists off the primary styleLbl', () => {
		const styleLbls: XmlObject[] = [
			{
				'@_name': 'node0',
				'dgm:fillClrLst': srgb('123456'),
				'dgm:txFillClrLst': srgb('FFFFFF'),
				'dgm:effectClrLst': srgb('000000'),
			},
		];
		const result = buildSmartArtColorLists(styleLbls, DEPS);
		expect(result.textFillColors).toStrictEqual(['#FFFFFF']);
		expect(result.effectColors).toStrictEqual(['#000000']);
		expect(result.textLineColors).toBeUndefined();
	});

	it('falls back to first-of-each when no node styleLbl is recognised', () => {
		const styleLbls: XmlObject[] = [
			{ '@_name': 'foo', 'dgm:linClrLst': srgb('101010', '202020') },
			{ '@_name': 'bar', 'dgm:linClrLst': srgb('303030') },
		];
		const result = buildSmartArtColorLists(styleLbls, DEPS);
		// No fill lists at all, so the fill palette is empty.
		expect(result.fillColors).toStrictEqual([]);
		// Primary is the first label with any colour (foo) -> its full line list.
		expect(result.lineColors).toStrictEqual(['#101010', '#202020']);
	});
});
