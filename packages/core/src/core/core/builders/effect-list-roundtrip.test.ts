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

	it('extracts inner shadow, soft edge, and reflection independently of prefix', () => {
		const child = (node: XmlObject | undefined, name: string) => effectChild(node, name);
		const color = (node: XmlObject | undefined) => {
			const value = child(node, 'schemeClr')?.['@_val'];
			return value === 'accent1' ? '#336699' : undefined;
		};
		const opacity = (node: XmlObject | undefined) => {
			const value = child(child(node, 'schemeClr'), 'alpha')?.['@_val'];
			return value ? Number(value) / 100000 : undefined;
		};
		const codec = new PptxShapeEffectXmlCodec({
			emuPerPx: 9525,
			parseColor: color,
			extractColorOpacity: opacity,
			clampUnitInterval: (value) => Math.max(0, Math.min(1, value)),
			ensureArray: (value) => (Array.isArray(value) ? value : [value as XmlObject]),
		});
		const list: XmlObject = {
			'draw:innerShdw': {
				'@_blurRad': '19050',
				'@_dist': '9525',
				'@_dir': '0',
				'draw:schemeClr': {
					'@_val': 'accent1',
					'draw:alpha': { '@_val': '40000' },
				},
			},
			'draw:softEdge': { '@_rad': '28575', 'x:future': { '@_value': 'keep' } },
			'draw:reflection': {
				'@_blurRad': '38100',
				'@_stA': '50000',
				'@_endA': '0',
				'@_dist': '19050',
				'@_algn': 'b',
				'x:extLst': { 'x:ext': { '@_uri': 'vendor' } },
			},
		};
		const props = { 'draw:effectLst': list };

		expect(codec.extractInnerShadowStyle(props)).toMatchObject({
			innerShadowColor: '#336699',
			innerShadowOpacity: 0.4,
			innerShadowBlur: 2,
			innerShadowXml: list['draw:innerShdw'],
		});
		expect(codec.extractSoftEdgeStyle(props)).toMatchObject({
			softEdgeRadius: 3,
			softEdgeXml: list['draw:softEdge'],
		});
		expect(codec.extractReflectionStyle(props)).toMatchObject({
			reflectionBlurRadius: 4,
			reflectionStartOpacity: 0.5,
			reflectionDistance: 2,
			reflectionAlignment: 'b',
			reflectionXml: list['draw:reflection'],
		});
	});

	it('surgically edits modeled effects without dropping transforms or extensions', () => {
		const codec = new PptxShapeEffectXmlCodec({
			emuPerPx: 9525,
			parseColor: () => '#336699',
			extractColorOpacity: () => 0.4,
			clampUnitInterval: (value) => Math.max(0, Math.min(1, value)),
			ensureArray: (value) => (Array.isArray(value) ? value : [value as XmlObject]),
		});
		const inner: XmlObject = {
			'@_vendor': 'keep',
			'draw:schemeClr': {
				'@_val': 'accent1',
				'draw:lumMod': { '@_val': '70000' },
				'draw:alpha': { '@_val': '40000' },
			},
			'x:extLst': { 'x:ext': { '@_uri': 'inner' } },
		};
		const soft: XmlObject = { '@_rad': '9525', '@_vendor': 'keep', 'x:extLst': {} };
		const reflection: XmlObject = {
			'@_stA': '30000',
			'@_vendor': 'keep',
			'x:extLst': { 'x:ext': { '@_uri': 'reflection' } },
		};

		const innerResult = codec.buildInnerShadowXml({
			innerShadowColor: '#336699',
			innerShadowOpacity: 0.4,
			innerShadowBlur: 3,
			innerShadowXml: inner,
			innerShadowOriginalColor: '#336699',
			innerShadowOriginalOpacity: 0.4,
		});
		expect(innerResult?.['draw:schemeClr']).toBe(inner['draw:schemeClr']);
		expect(innerResult?.['@_vendor']).toBe('keep');
		expect(innerResult?.['x:extLst']).toBe(inner['x:extLst']);
		expect(innerResult?.['@_blurRad']).toBe('28575');

		const softResult = codec.buildSoftEdgeXml({ softEdgeRadius: 2, softEdgeXml: soft });
		expect(softResult).toMatchObject({ '@_rad': '19050', '@_vendor': 'keep' });
		expect(softResult?.['x:extLst']).toBe(soft['x:extLst']);

		const reflectionResult = codec.buildReflectionXml({
			reflectionStartOpacity: 0.6,
			reflectionDistance: 2,
			reflectionXml: reflection,
		});
		expect(reflectionResult).toMatchObject({
			'@_stA': '60000',
			'@_dist': '19050',
			'@_vendor': 'keep',
		});
		expect(reflectionResult?.['x:extLst']).toBe(reflection['x:extLst']);
	});

	it('emits reflection fixed percentages within their schema bounds', () => {
		const codec = new PptxShapeEffectXmlCodec({
			emuPerPx: 9525,
			parseColor: () => undefined,
			extractColorOpacity: () => undefined,
			clampUnitInterval: (value) => Math.max(0, Math.min(1, value)),
			ensureArray: (value) => (Array.isArray(value) ? value : [value as XmlObject]),
		});
		const result = codec.buildReflectionXml({
			reflectionStartOpacity: 2,
			reflectionEndOpacity: -1,
			reflectionStartPosition: 1.5,
			reflectionEndPosition: -0.5,
		});

		expect(result).toMatchObject({
			'@_stA': '100000',
			'@_endA': '0',
			'@_stPos': '100000',
			'@_endPos': '0',
		});
	});
});
