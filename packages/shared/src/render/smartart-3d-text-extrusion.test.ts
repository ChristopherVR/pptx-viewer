import { describe, expect, it } from 'vitest';

import { smartArt3DTextLayers, TEXT_LAYER_STEP } from './smartart-3d-text-extrusion';
import type { SmartArt3DTextBlock } from './smartart-3d-types';

function block(overrides: Partial<SmartArt3DTextBlock> = {}): SmartArt3DTextBlock {
	return {
		lines: [{ text: 'Alpha', dy: 0 }],
		x: 0,
		y: 0,
		z: 2,
		maxWidth: 200,
		maxHeight: 80,
		color: '#ffffff',
		fontSize: 40,
		...overrides,
	};
}

describe('smartArt3DTextLayers', () => {
	it('is undefined for a flat label', () => {
		expect(smartArt3DTextLayers(block())).toBeUndefined();
		expect(smartArt3DTextLayers(block({ extrusion: 0 }))).toBeUndefined();
	});

	it('stacks side layers from the face to the front copy at the full depth', () => {
		const layers = smartArt3DTextLayers(block({ extrusion: 2.94 }))!;
		expect(layers.frontZ).toBeCloseTo(4.94, 6);
		expect(layers.sideZ[0]).toBe(2);
		expect(layers.sideZ).toHaveLength(Math.ceil(2.94 / TEXT_LAYER_STEP));
		for (let i = 1; i < layers.sideZ.length; i++) {
			expect(layers.sideZ[i] - layers.sideZ[i - 1]).toBeLessThanOrEqual(TEXT_LAYER_STEP);
		}
		expect(layers.sideZ.at(-1)).toBeLessThan(layers.frontZ);
	});

	it("shades the sides from the extrusion colour, or the text's own", () => {
		// White letters read (164, 172, 175)-ish walls in the Bird's Eye export.
		expect(smartArt3DTextLayers(block({ extrusion: 1 }))!.sideColor).toBe('#b0b0b0');
		expect(
			smartArt3DTextLayers(block({ extrusion: 1, extrusionColor: '#000000' }))!.sideColor,
		).toBe('#000000');
	});
});
