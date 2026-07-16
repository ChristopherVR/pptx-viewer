import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { toggleElementFlip } from './element-flip-controls.component';
import { connectorStylePatch } from './element-misc-properties.component';
import { clampImageCrop, replacementImagePatch } from './image-crop-wash-panel.component';
import { shapeTypePatch } from './shape-authoring-panel.component';
import { textWarpPatch } from './text-warp-gallery.component';

const shape = {
	type: 'shape',
	id: 'shape-1',
	x: 0,
	y: 0,
	width: 100,
	height: 60,
	shapeType: 'rect',
	shapeStyle: { fillColor: '#123456', strokeColor: '#abcdef' },
} as PptxElement;

describe('angular inspector authoring parity', () => {
	it('preserves connector style while updating an arrow end', () => {
		const patch = connectorStylePatch(shape, { connectorEndArrow: 'triangle' }) as {
			shapeStyle: Record<string, unknown>;
		};
		expect(patch.shapeStyle.fillColor).toBe('#123456');
		expect(patch.shapeStyle.connectorEndArrow).toBe('triangle');
	});

	it('toggles horizontal and vertical element flips independently', () => {
		expect(toggleElementFlip(shape, 'flipHorizontal')).toStrictEqual({ flipHorizontal: true });
		expect(toggleElementFlip({ ...shape, flipVertical: true }, 'flipVertical')).toStrictEqual({
			flipVertical: false,
		});
	});

	it('sets round rectangle defaults without discarding the shape style', () => {
		const patch = shapeTypePatch(shape, 'roundRect') as {
			shapeType: string;
			shapeAdjustments: { adj: number };
			shapeStyle: Record<string, unknown>;
		};
		expect(patch.shapeType).toBe('roundRect');
		expect(patch.shapeAdjustments.adj).toBe(16667);
		expect(patch.shapeStyle.strokeColor).toBe('#abcdef');
	});

	it('clamps crop values to the editor range', () => {
		expect(clampImageCrop(-1)).toBe(0);
		expect(clampImageCrop(0.42)).toBe(0.42);
		expect(clampImageCrop(2)).toBe(0.8);
	});

	it('replaces archived image sources with the selected data URL', () => {
		expect(replacementImagePatch('data:image/png;base64,new')).toStrictEqual({
			imageData: 'data:image/png;base64,new',
			imagePath: undefined,
			svgData: undefined,
			svgPath: undefined,
		});
	});

	it('preserves text style while applying and clearing text warp', () => {
		const text = { ...shape, type: 'text', textStyle: { bold: true } } as PptxElement;
		const warped = textWarpPatch(text, 'textArchUp') as { textStyle: Record<string, unknown> };
		expect(warped.textStyle).toMatchObject({ bold: true, textWarpPreset: 'textArchUp' });
		const cleared = textWarpPatch(text, 'textNoShape') as { textStyle: Record<string, unknown> };
		expect(cleared.textStyle.bold).toBeTruthy();
		expect(cleared.textStyle.textWarpPreset).toBeUndefined();
	});
});
