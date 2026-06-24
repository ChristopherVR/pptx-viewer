import { describe, it, expect, beforeEach } from 'vitest';

import type { PptxSmartArtData, PptxSmartArtNode } from '../types';
import { decomposeSmartArt } from './smartart-decompose';
import { resetDecomposeCounter } from './smartart-helpers';
import { applyNodeStylesToElements } from './smartart-node-style-apply';

beforeEach(() => {
	resetDecomposeCounter();
});

const bounds = { x: 0, y: 0, width: 400, height: 300 };

describe('decomposeSmartArt honours per-node style', () => {
	it('overrides the fill / font colour of the matching content shape', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'A', style: { fillColor: '#FF0000', fontColor: '#FFFFFF', bold: true } },
			{ id: '2', text: 'B' },
		];
		const data: PptxSmartArtData = { resolvedLayoutType: 'list', nodes };
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		const shapes = result!.filter((e) => e.type === 'shape');
		const first = shapes[0];
		if (first.type !== 'shape') {
			throw new Error('expected a shape element');
		}
		expect(first.shapeStyle.fillColor).toBe('#FF0000');
		expect(first.shapeStyle.fillMode).toBe('solid');
		expect(first.textStyle?.color).toBe('#FFFFFF');
		expect(first.textStyle?.bold).toBeTruthy();
		// Second node has no override: its palette fill is left as-is.
		const second = shapes[1];
		if (second.type !== 'shape') {
			throw new Error('expected a shape element');
		}
		expect(second.shapeStyle.fillColor).not.toBe('#FF0000');
	});
});

describe('applyNodeStylesToElements', () => {
	it('returns the input unchanged when no node carries a style', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: [{ id: '1', text: 'A' }],
		};
		const elements = decomposeSmartArt(data, bounds)!;
		const out = applyNodeStylesToElements(elements, data.nodes);
		expect(out).toStrictEqual(elements);
	});

	it('overrides the line colour as the shape stroke', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: [{ id: '1', text: 'A', style: { lineColor: '#0000FF' } }],
		};
		const elements = decomposeSmartArt(data, bounds)!;
		const first = elements.find((e) => e.type === 'shape');
		if (!first || first.type !== 'shape') {
			throw new Error('expected a shape element');
		}
		expect(first.shapeStyle.strokeColor).toBe('#0000FF');
	});
});
