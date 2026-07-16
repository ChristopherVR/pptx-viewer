import { describe, expect, it } from 'vitest';

import type { EffectDagBlur, EffectDagPresetShadow, XmlObject } from '../../types';
import { parseEffectDagContainer, serializeEffectDagContainer } from './effect-dag-containers';
import { PptxEffectDagExtractor } from './PptxEffectDagExtractor';

describe('typed effectDag blur and preset shadow primitives', () => {
	it('parses namespace-prefix-independent blur and preset shadow children', () => {
		const tree = parseEffectDagContainer({
			'd:blur': { '@_rad': '50800', '@_grow': 'true', '@_vendor': 'keep' },
			'd:prstShdw': {
				'@_prst': 'shdw14',
				'@_dist': '38100',
				'@_dir': '5400000',
				'd:schemeClr': { '@_val': 'accent1', 'd:alpha': { '@_val': '35000' } },
			},
		})!;

		expect(tree.children[0]).toMatchObject({
			kind: 'blur',
			radiusEmu: 50800,
			grow: true,
		});
		expect(tree.children[1]).toMatchObject({
			kind: 'prstShdw',
			preset: 'shdw14',
			distanceEmu: 38100,
			direction: 5400000,
		});
	});

	it('overlays typed edits while preserving unknown XML and color transforms', () => {
		const tree = parseEffectDagContainer({
			'x:blur': { '@_rad': '100', '@_grow': '0', '@_vendor': 'keep' },
			'x:prstShdw': {
				'@_prst': 'shdw2',
				'@_dist': '200',
				'x:srgbClr': {
					'@_val': '112233',
					'x:tint': { '@_val': '25000' },
					'x:alpha': { '@_val': '60000' },
				},
				'x:extLst': { 'x:ext': { '@_uri': 'vendor' } },
			},
		})!;
		const blur = tree.children[0] as EffectDagBlur;
		const shadow = tree.children[1] as EffectDagPresetShadow;
		blur.radiusEmu = 9525;
		blur.grow = true;
		shadow.preset = 'shdw20';
		shadow.distanceEmu = 38100;
		shadow.direction = 10800000;

		const output = serializeEffectDagContainer(tree)!;
		expect(output['a:blur']).toStrictEqual({
			'@_rad': '9525',
			'@_grow': '1',
			'@_vendor': 'keep',
		});
		const shadowXml = output['a:prstShdw'] as XmlObject;
		expect(shadowXml['@_prst']).toBe('shdw20');
		expect(shadowXml['@_dist']).toBe('38100');
		expect(shadowXml['@_dir']).toBe('10800000');
		expect(shadowXml['x:srgbClr']).toStrictEqual({
			'@_val': '112233',
			'x:tint': { '@_val': '25000' },
			'x:alpha': { '@_val': '60000' },
		});
		expect(shadowXml['x:extLst']).toStrictEqual({ 'x:ext': { '@_uri': 'vendor' } });
	});

	it('does not expose invalid simple-type values as editable typed fields', () => {
		const tree = parseEffectDagContainer({
			'a:blur': { '@_rad': '-1', '@_grow': 'sometimes' },
			'a:prstShdw': { '@_prst': 'shdw21', '@_dist': '-20', '@_dir': '21600000' },
		})!;

		expect(tree.children[0]).toStrictEqual({
			kind: 'blur',
			xml: { '@_rad': '-1', '@_grow': 'sometimes' },
		});
		expect(tree.children[1]).toStrictEqual({
			kind: 'prstShdw',
			xml: { '@_prst': 'shdw21', '@_dist': '-20', '@_dir': '21600000' },
		});
	});

	it('parses nested containers and blend children with arbitrary prefixes', () => {
		const tree = parseEffectDagContainer({
			'd:cont': {
				'@_type': 'tree',
				'd:blend': {
					'@_blend': 'screen',
					'd:cont': { '@_type': 'sib', 'd:blur': { '@_rad': '12700' } },
				},
			},
		})!;

		expect(tree.children[0]).toMatchObject({
			kind: 'cont',
			type: 'tree',
			children: [{ kind: 'blend', mode: 'screen' }],
		});
	});

	it('discovers a prefixed effectDag through the shape codec extractor', () => {
		const extractor = new PptxEffectDagExtractor({
			emuPerPx: 9525,
			parseColor: () => undefined,
			extractColorOpacity: () => undefined,
			ensureArray: (value) => (Array.isArray(value) ? value : [value as XmlObject]),
		});
		const style = extractor.extractEffectDagStyle({
			'd:effectDag': { '@_type': 'tree', 'd:blur': { '@_rad': '9525' } },
		});

		expect(style.effectDagTree).toMatchObject({
			type: 'tree',
			children: [{ kind: 'blur', radiusEmu: 9525 }],
		});
	});
});

describe('typed effectDag alpha outset primitive', () => {
	it('parses and edits a signed coordinate while preserving foreign attributes', () => {
		const tree = parseEffectDagContainer({
			'd:alphaOutset': { '@_rad': '-12700', '@_vendor': 'kept' },
		})!;
		const outset = tree.children[0];
		expect(outset).toMatchObject({ kind: 'alphaOutset', radiusEmu: -12700 });
		if (outset?.kind !== 'alphaOutset') {
			throw new Error('expected alpha outset');
		}
		outset.radiusEmu = 25400;
		expect(serializeEffectDagContainer(tree)?.['a:alphaOutset']).toStrictEqual({
			'@_rad': '25400',
			'@_vendor': 'kept',
		});
	});

	it('does not expose a coordinate outside the ST_Coordinate bounds', () => {
		const tree = parseEffectDagContainer({
			'a:alphaOutset': { '@_rad': '27273042316901' },
		})!;
		expect(tree.children[0]).toMatchObject({ kind: 'alphaOutset' });
		expect(tree.children[0]).not.toHaveProperty('radiusEmu');
	});

	it('applies and preserves the default zero radius', () => {
		const tree = parseEffectDagContainer({ 'a:alphaOutset': { '@_vendor': 'kept' } })!;
		expect(tree.children[0]).toMatchObject({ kind: 'alphaOutset', radiusEmu: 0 });
		expect(serializeEffectDagContainer(tree)?.['a:alphaOutset']).toStrictEqual({
			'@_vendor': 'kept',
		});
	});
});
