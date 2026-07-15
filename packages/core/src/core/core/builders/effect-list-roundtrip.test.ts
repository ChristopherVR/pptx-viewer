import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import {
	createEffectList,
	effectChild,
	mergeEffectNode,
	setEffectChild,
} from './effect-list-roundtrip';
import { PptxShapeEffectStyleExtractor } from './PptxShapeEffectStyleExtractor';
import { PptxShapeEffectXmlCodec } from './PptxShapeEffectXmlCodec';

describe('drawingML effect list round-trip', () => {
	it('finds effect children independently of namespace prefix', () => {
		const effect = { '@_rad': '9525' };
		expect(effectChild({ 'draw:glow': effect }, 'glow')).toBe(effect);
	});

	it('preserves color transforms and unknown children when color is unchanged', () => {
		const original: XmlObject = {
			'@_blurRad': '100',
			'@_vendor': 'keep',
			'draw:schemeClr': {
				'@_val': 'accent2',
				'draw:lumMod': { '@_val': '65000' },
				'draw:alpha': { '@_val': '40000' },
			},
			'x:extension': { '@_token': 'preserve' },
		};
		const generated: XmlObject = {
			'@_blurRad': '200',
			'a:srgbClr': { '@_val': '336699' },
		};
		const result = mergeEffectNode(original, generated, '#336699', '#336699', 0.4, 0.4);

		expect(result['@_blurRad']).toBe('200');
		expect(result['@_vendor']).toBe('keep');
		expect(result['draw:schemeClr']).toBe(original['draw:schemeClr']);
		expect(result['x:extension']).toStrictEqual({ '@_token': 'preserve' });
		expect(result['a:srgbClr']).toBeUndefined();
	});

	it('replaces the color choice after an edit without dropping extensions', () => {
		const original: XmlObject = {
			'draw:schemeClr': { '@_val': 'accent2' },
			'draw:extLst': { 'draw:ext': { '@_uri': 'vendor' } },
		};
		const generated: XmlObject = { 'a:srgbClr': { '@_val': 'FF0000' } };
		const result = mergeEffectNode(original, generated, '#336699', '#FF0000', undefined, undefined);

		expect(result['draw:schemeClr']).toBeUndefined();
		expect(result['a:srgbClr']).toStrictEqual({ '@_val': 'FF0000' });
		expect(result['draw:extLst']).toBe(original['draw:extLst']);
	});

	it('rebuilds alpha when opacity is edited independently of color', () => {
		const original: XmlObject = {
			'draw:schemeClr': {
				'@_val': 'accent2',
				'draw:alpha': { '@_val': '40000' },
			},
		};
		const generated: XmlObject = {
			'a:srgbClr': {
				'@_val': '336699',
				'a:alpha': { '@_val': '80000' },
			},
		};
		const result = mergeEffectNode(original, generated, '#336699', '#336699', 0.4, 0.8);

		expect(result['draw:schemeClr']).toBeUndefined();
		expect(result['a:srgbClr']).toBe(generated['a:srgbClr']);
	});

	it('surgically replaces alternate-prefixed children', () => {
		const list = createEffectList(
			{
				effectListXml: {
					'draw:glow': { '@_rad': '1' },
					'future:customEffect': { '@_val': 'keep' },
				},
			},
			{},
		);
		setEffectChild(list, 'glow', { '@_rad': '2' });

		expect(list['draw:glow']).toBeUndefined();
		expect(list['a:glow']).toStrictEqual({ '@_rad': '2' });
		expect(list['future:customEffect']).toStrictEqual({ '@_val': 'keep' });
	});

	it('extracts outer shadow and glow from an alternate DrawingML prefix', () => {
		const child = (node: XmlObject | undefined, name: string) => effectChild(node, name);
		const color = (node: XmlObject | undefined) => {
			const value = child(node, 'srgbClr')?.['@_val'];
			return value ? `#${value}` : undefined;
		};
		const opacity = (node: XmlObject | undefined) => {
			const colorNode = child(node, 'srgbClr');
			const value = child(colorNode, 'alpha')?.['@_val'];
			return value ? Number(value) / 100000 : undefined;
		};
		const extractor = new PptxShapeEffectStyleExtractor({
			emuPerPx: 9525,
			parseColor: color,
			extractColorOpacity: opacity,
		});
		const list: XmlObject = {
			'draw:outerShdw': {
				'@_blurRad': '9525',
				'@_dist': '19050',
				'@_dir': '0',
				'draw:srgbClr': { '@_val': '112233' },
			},
			'draw:glow': {
				'@_rad': '28575',
				'draw:srgbClr': {
					'@_val': '445566',
					'draw:alpha': { '@_val': '75000' },
				},
			},
		};
		const props = { 'draw:effectLst': list };

		expect(extractor.extractShadowStyle(props)).toMatchObject({
			shadowColor: '#112233',
			shadowBlur: 1,
			shadowDistance: 2,
		});
		expect(extractor.extractGlowStyle(props)).toMatchObject({
			glowColor: '#445566',
			glowRadius: 3,
			glowOpacity: 0.75,
		});

		const codec = new PptxShapeEffectXmlCodec({
			emuPerPx: 9525,
			parseColor: color,
			extractColorOpacity: opacity,
			clampUnitInterval: (value) => Math.max(0, Math.min(1, value)),
			ensureArray: (value) => (Array.isArray(value) ? value : [value as XmlObject]),
		});
		expect(codec.extractShadowStyle(props)).toMatchObject({
			effectListXml: list,
			outerShadowXml: list['draw:outerShdw'],
			outerShadowOriginalColor: '#112233',
		});
		expect(codec.extractGlowStyle(props)).toMatchObject({
			effectListXml: list,
			glowXml: list['draw:glow'],
			glowOriginalOpacity: 0.75,
		});
	});
});
