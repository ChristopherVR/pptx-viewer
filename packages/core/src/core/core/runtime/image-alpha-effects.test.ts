import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { applyImageAlphaEffects, parseImageAlphaEffects } from './image-alpha-effects';

function parseColor(node: XmlObject | undefined): string | undefined {
	const color = node?.['a:srgbClr'] as XmlObject | undefined;
	return color?.['@_val'] ? `#${String(color['@_val'])}` : undefined;
}

describe('drawingML image alpha effects', () => {
	it('parses strict percentages and the default alphaModFix amount', () => {
		const blip: XmlObject = {
			'd:alphaBiLevel': { '@_thresh': '42.5%' },
			'd:alphaRepl': { '@_a': '75%' },
			'd:alphaModFix': { '@_vendor': 'kept' },
		};
		const effects = parseImageAlphaEffects(blip, parseColor);
		expect(effects).toMatchObject({ alphaBiLevel: 42.5, alphaRepl: 75, alphaModFix: 100 });
		applyImageAlphaEffects(blip, effects, parseColor);
		expect(blip).toStrictEqual({
			'd:alphaBiLevel': { '@_thresh': '42.5%' },
			'd:alphaRepl': { '@_a': '75%' },
			'd:alphaModFix': { '@_vendor': 'kept' },
		});
	});

	it('parses arbitrary prefixes and preserves every alpha payload', () => {
		const blip: XmlObject = {
			'd:alphaInv': {
				'@_vendor': 'inverse',
				'd:srgbClr': { '@_val': '112233', 'd:alpha': { '@_val': '50000' } },
			},
			'd:alphaCeiling': { '@_vendor': 'ceiling' },
			'd:alphaFloor': { '@_vendor': 'floor' },
			'd:alphaMod': {
				'@_vendor': 'modulate',
				'd:cont': { '@_type': 'sib', 'd:alphaModFix': { '@_amt': '40000' } },
			},
			'd:alphaRepl': { '@_a': '75000', '@_vendor': 'replace' },
			'd:alphaBiLevel': { '@_thresh': '50000', '@_vendor': 'threshold' },
		};
		const effects = parseImageAlphaEffects(blip, parseColor);
		expect(effects.alphaInv?.color).toBe('#112233');
		expect(effects.alphaMod?.contRawXml).toStrictEqual((blip['d:alphaMod'] as XmlObject)['d:cont']);

		const output = structuredClone(blip);
		applyImageAlphaEffects(output, effects, parseColor);
		expect(output).toStrictEqual(blip);
	});

	it('edits known values while retaining unknown attributes', () => {
		const blip: XmlObject = {
			'd:alphaInv': { '@_vendor': 'inverse', 'd:schemeClr': { '@_val': 'accent1' } },
			'd:alphaBiLevel': { '@_thresh': '25000', '@_vendor': 'threshold' },
		};
		const effects = parseImageAlphaEffects(blip, parseColor);
		effects.alphaInv = { ...effects.alphaInv, color: '#ABCDEF' };
		effects.alphaBiLevel = 80;
		applyImageAlphaEffects(blip, effects, parseColor);

		expect(blip['d:alphaInv']).toStrictEqual({
			'@_vendor': 'inverse',
			'a:srgbClr': { '@_val': 'ABCDEF' },
		});
		expect(blip['d:alphaBiLevel']).toStrictEqual({
			'@_thresh': '80000',
			'@_vendor': 'threshold',
		});
	});

	it('does not serialize out-of-range fixed percentages', () => {
		const blip: XmlObject = {
			'a:alphaBiLevel': { '@_thresh': '50000' },
			'a:alphaRepl': { '@_a': '50000' },
		};
		applyImageAlphaEffects(blip, { alphaBiLevel: 101, alphaRepl: -1 }, parseColor);
		expect(blip).toStrictEqual({});
	});

	it('does not create alphaMod without its required cont child', () => {
		const blip: XmlObject = {};
		applyImageAlphaEffects(blip, { alphaMod: {} }, parseColor);
		expect(blip).toStrictEqual({});
	});
});
