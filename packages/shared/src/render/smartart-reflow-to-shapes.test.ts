/**
 * Unit tests for `rebuildDrawingShapesIfCleared`'s colour-list interpolation.
 *
 * Regression test for the "SmartArt colour interpolation never called" bug:
 * every binding's structural-edit reflow path routes through this function, so
 * a fix here reaches all five without a per-binding patch.
 */

import type { PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { rebuildDrawingShapesIfCleared } from './smartart-reflow-to-shapes';

const BOX = { width: 400, height: 300 };

function n(id: string, text: string): PptxSmartArtNode {
	return { id, text };
}

function data(overrides: Partial<PptxSmartArtData> = {}): PptxSmartArtData {
	return {
		nodes: [n('1', 'A'), n('2', 'B'), n('3', 'C'), n('4', 'D'), n('5', 'E')],
		drawingShapes: [],
		layout: 'list',
		...overrides,
	};
}

describe('rebuildDrawingShapesIfCleared - colour interpolation', () => {
	it('spreads a span colour list across the rebuilt shapes', () => {
		const rebuilt = rebuildDrawingShapesIfCleared(
			data({
				colorTransform: {
					fillColors: ['#000000', '#ffffff'],
					lineColors: [],
					fillInterpolation: { method: 'span' },
				},
			}),
			'list',
			['#000000', '#ffffff'],
			'flat',
			'el1',
			BOX,
		);
		const fills = (rebuilt.drawingShapes ?? []).map((s) => s.fillColor);
		expect(fills[0]).toBe('#000000');
		expect(fills[4]).toBe('#ffffff');
		expect(new Set(fills).size).toBe(5);
	});

	it('cycles a repeat colour list instead of interpolating', () => {
		const rebuilt = rebuildDrawingShapesIfCleared(
			data({
				colorTransform: {
					fillColors: ['#111111', '#222222'],
					lineColors: [],
					fillInterpolation: { method: 'repeat' },
				},
			}),
			'list',
			['#111111', '#222222'],
			'flat',
			'el1',
			BOX,
		);
		const fills = (rebuilt.drawingShapes ?? []).map((s) => s.fillColor);
		expect(fills).toStrictEqual(['#111111', '#222222', '#111111', '#222222', '#111111']);
	});
});
