import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { applyImageColorEffects, parseImageColorEffects } from './image-color-effects';

function parseColor(node: XmlObject | undefined): string | undefined {
	const choice = node?.['a:srgbClr'] as XmlObject | undefined;
	if (choice) {
		return `#${String(choice['@_val']).toUpperCase()}`;
	}
	const scheme = node?.['a:schemeClr'] as XmlObject | undefined;
	if (scheme?.['@_val'] === 'accent1') {
		return '#4472C4';
	}
	return undefined;
}

function extractOpacity(node: XmlObject | undefined): number | undefined {
	const color = (node?.['a:srgbClr'] ?? node?.['a:schemeClr']) as XmlObject | undefined;
	const alpha = color?.['a:alpha'] as XmlObject | undefined;
	return alpha ? Number(alpha['@_val']) / 100000 : undefined;
}

describe('image color effects', () => {
	it('parses all five primitives independently of namespace prefix', () => {
		const result = parseImageColorEffects(
			{
				'x:grayscl': { '@_x:flag': 'keep' },
				'x:biLevel': { '@_thresh': '42500', 'x:extLst': {} },
				'x:clrChange': {
					'x:clrFrom': { 'x:schemeClr': { '@_val': 'accent1', 'x:tint': { '@_val': '20000' } } },
					'x:clrTo': { 'x:srgbClr': { '@_val': 'ABCDEF', 'x:alpha': { '@_val': '0' } } },
				},
				'x:clrRepl': { 'x:srgbClr': { '@_val': '123456' }, 'x:extLst': {} },
				'x:duotone': { 'x:srgbClr': [{ '@_val': '000000' }, { '@_val': 'FFFFFF' }] },
			},
			parseColor,
			extractOpacity,
		);
		expect(result.grayscale).toBeTruthy();
		expect(result.biLevel).toBe(42.5);
		expect(result.clrChange).toMatchObject({
			clrFrom: '#4472C4',
			clrTo: '#ABCDEF',
			clrToTransparent: true,
		});
		expect(result.clrRepl?.color).toBe('#123456');
		expect(result.duotone).toMatchObject({ color1: '#000000', color2: '#FFFFFF' });
	});

	it('round-trips untouched color choices, transforms, extensions, and prefixes', () => {
		const blip: XmlObject = {
			'x:clrChange': {
				'@_useA': '1',
				'x:clrFrom': { 'x:schemeClr': { '@_val': 'accent1', 'x:tint': { '@_val': '20000' } } },
				'x:clrTo': { 'x:srgbClr': { '@_val': 'ABCDEF', 'x:alpha': { '@_val': '0' } } },
				'x:extLst': { 'x:ext': { '@_uri': 'custom' } },
			},
			'x:extLst': { 'x:ext': {} },
		};
		const original = structuredClone(blip);
		const effects = parseImageColorEffects(blip, parseColor, extractOpacity);
		applyImageColorEffects(blip, effects, parseColor, extractOpacity);
		expect(blip).toStrictEqual(original);
	});

	it('merges edits while retaining unknown XML and schema-last extLst', () => {
		const blip: XmlObject = {
			'x:biLevel': { '@_thresh': '20000', '@_foreign': 'keep', 'x:extLst': {} },
			'x:clrRepl': { '@_foreign': 'keep', 'x:schemeClr': { '@_val': 'accent1' }, 'x:extLst': {} },
			'x:extLst': { 'x:ext': {} },
		};
		const effects = parseImageColorEffects(blip, parseColor, extractOpacity);
		effects.biLevel = 150;
		if (effects.clrRepl) {
			effects.clrRepl.color = '#102030';
		}
		applyImageColorEffects(blip, effects, parseColor, extractOpacity);
		expect(blip['x:biLevel']).toStrictEqual({
			'@_thresh': '100000',
			'@_foreign': 'keep',
			'x:extLst': {},
		});
		expect(blip['x:clrRepl']).toStrictEqual({
			'@_foreign': 'keep',
			'a:srgbClr': { '@_val': '102030' },
			'x:extLst': {},
		});
		expect(Object.keys(blip).at(-1)).toBe('x:extLst');
	});

	it('inserts newly authored effects before extLst and removes cleared effects', () => {
		const blip: XmlObject = { 'z:grayscl': {}, 'z:extLst': {} };
		applyImageColorEffects(
			blip,
			{ duotone: { color1: '#111111', color2: '#EEEEEE' } },
			parseColor,
			extractOpacity,
		);
		expect(Object.keys(blip)).toStrictEqual(['a:duotone', 'z:extLst']);
		expect(blip['z:grayscl']).toBeUndefined();
	});

	it('removes a preserved alpha transform when transparency is edited off', () => {
		const blip: XmlObject = {
			'a:clrChange': {
				'a:clrFrom': { 'a:srgbClr': { '@_val': '000000' } },
				'a:clrTo': { 'a:srgbClr': { '@_val': 'FFFFFF', 'a:alpha': { '@_val': '0' } } },
			},
		};
		const effects = parseImageColorEffects(blip, parseColor, extractOpacity);
		if (effects.clrChange) {
			effects.clrChange.clrToTransparent = false;
		}
		applyImageColorEffects(blip, effects, parseColor, extractOpacity);
		const change = blip['a:clrChange'] as XmlObject;
		const to = change['a:clrTo'] as XmlObject;
		expect(to).toStrictEqual({ 'a:srgbClr': { '@_val': 'FFFFFF' } });
	});
});
