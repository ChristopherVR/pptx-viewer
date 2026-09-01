import { describe, it, expect } from 'vitest';

import type { PlaceholderTextLevelStyle, XmlObject } from '../types';
import { serializePlaceholderLevelStyle } from './placeholder-level-style-serializer';

// ---------------------------------------------------------------------------
// `serializePlaceholderLevelStyle` is the inverse of `parsePlaceholderLevelStyle`.
// It used to know nothing about marR / rtl / tabLst, mapped only the four
// basic alignment tokens, and rewrote every bullet or run colour as a flat
// `a:srgbClr`, so a themed `a:schemeClr` bullet was downgraded to a literal
// hex the moment a master level style was re-serialised after an edit.
// ---------------------------------------------------------------------------

describe('serializePlaceholderLevelStyle - paragraph attributes', () => {
	it('emits marR, rtl and tabLst alongside the fields it always handled', () => {
		const style: PlaceholderTextLevelStyle = {
			marginLeft: 36,
			marginRight: 20,
			indent: -36,
			rtl: true,
			defaultTabSize: 96,
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
			tabStops: [
				{ position: 96, align: 'l' },
				{ position: 192, align: 'dec', leader: 'dot' },
			],
		};
		const node = serializePlaceholderLevelStyle(style);
		expect(node).toMatchObject({
			'@_marL': '342900',
			'@_marR': '190500',
			'@_indent': '-342900',
			'@_rtl': '1',
			'@_defTabSz': '914400',
			'@_eaLnBrk': '1',
			'@_latinLnBrk': '0',
			'@_fontAlgn': 'base',
			'@_hangingPunct': '1',
			'a:tabLst': {
				'a:tab': [
					{ '@_pos': '914400' },
					{ '@_pos': '1828800', '@_algn': 'dec', '@_leader': 'dot' },
				],
			},
		});
	});

	it('keeps a:tabLst in schema position: after the bullet group, before a:defRPr', () => {
		const node = serializePlaceholderLevelStyle({
			bulletChar: '-',
			tabStops: [{ position: 96, align: 'l' }],
			fontSize: 24,
		});
		expect(Object.keys(node)).toStrictEqual(['a:buChar', 'a:tabLst', 'a:defRPr']);
	});

	it('removes an existing a:tabLst when the edit sets an empty tab list', () => {
		const existing: XmlObject = { 'a:tabLst': { 'a:tab': { '@_pos': '914400' } } };
		const node = serializePlaceholderLevelStyle({ tabStops: [] }, existing);
		expect(node['a:tabLst']).toBeUndefined();
	});

	it.each([
		['left', 'l'],
		['center', 'ctr'],
		['right', 'r'],
		['justify', 'just'],
		['justLow', 'justLow'],
		['dist', 'dist'],
		['thaiDist', 'thaiDist'],
	])('writes alignment %s as algn="%s"', (alignment, algn) => {
		expect(serializePlaceholderLevelStyle({ alignment })['@_algn']).toBe(algn);
	});
});

describe('serializePlaceholderLevelStyle - colour preservation', () => {
	const schemeBullet: XmlObject = { 'a:schemeClr': { '@_val': 'accent1' } };

	it('re-emits a themed a:buClr verbatim instead of a flat a:srgbClr', () => {
		const node = serializePlaceholderLevelStyle({
			bulletColor: '#0070C0',
			bulletColorXml: schemeBullet,
			bulletChar: '•',
		});
		expect(node['a:buClr']).toStrictEqual(schemeBullet);
	});

	it('re-emits the preserved node even when only bulletColorXml is set', () => {
		const node = serializePlaceholderLevelStyle({ bulletColorXml: schemeBullet });
		expect(node['a:buClr']).toStrictEqual(schemeBullet);
	});

	it('falls back to a:srgbClr when there is no preserved node', () => {
		const node = serializePlaceholderLevelStyle({ bulletColor: '#FF0000' });
		expect(node['a:buClr']).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
	});

	it('prefers an edited hex over a stale literal a:srgbClr node', () => {
		const node = serializePlaceholderLevelStyle({
			bulletColor: '#00FF00',
			bulletColorXml: { 'a:srgbClr': { '@_val': 'FF0000' } },
		});
		expect(node['a:buClr']).toStrictEqual({ 'a:srgbClr': { '@_val': '00FF00' } });
	});

	it('keeps a literal a:srgbClr node (with transforms) when the hex still matches it', () => {
		const withAlpha: XmlObject = {
			'a:srgbClr': { '@_val': 'ff0000', 'a:alpha': { '@_val': '50000' } },
		};
		const node = serializePlaceholderLevelStyle({
			bulletColor: '#FF0000',
			bulletColorXml: withAlpha,
		});
		expect(node['a:buClr']).toStrictEqual(withAlpha);
	});

	it('re-emits the run colour a:solidFill as authored (colorChoiceXml)', () => {
		const solidFill: XmlObject = {
			'a:schemeClr': { '@_val': 'tx1', 'a:lumMod': { '@_val': '75000' } },
		};
		const node = serializePlaceholderLevelStyle({
			color: '#404040',
			colorChoiceXml: solidFill,
			fontSize: 24,
		});
		expect((node['a:defRPr'] as XmlObject)['a:solidFill']).toStrictEqual(solidFill);
	});
});
