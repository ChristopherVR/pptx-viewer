import { describe, it, expect } from 'vitest';

import type { PptxSmartArtData } from '../types';
import { setSmartArtNodeStyle } from './smartart-editing-node-style';

function data(): PptxSmartArtData {
	return {
		nodes: [
			{ id: '1', text: 'One' },
			{ id: '2', text: 'Two', style: { fillColor: '#000000', bold: true } },
		],
		drawingShapes: [{ id: 's', x: 0, y: 0, width: 10, height: 10 }],
	};
}

describe('setSmartArtNodeStyle', () => {
	it('sets a style on a node that had none', () => {
		const next = setSmartArtNodeStyle(data(), '1', { fillColor: '#FF0000', fontColor: '#FFFFFF' });
		expect(next.nodes[0].style).toStrictEqual({ fillColor: '#FF0000', fontColor: '#FFFFFF' });
	});

	it('shallow-merges a partial onto an existing style', () => {
		const next = setSmartArtNodeStyle(data(), '2', { italic: true, fillColor: '#00FF00' });
		expect(next.nodes[1].style).toStrictEqual({ fillColor: '#00FF00', bold: true, italic: true });
	});

	it('removes a key when the partial sets it to undefined', () => {
		const next = setSmartArtNodeStyle(data(), '2', { bold: undefined });
		expect(next.nodes[1].style).toStrictEqual({ fillColor: '#000000' });
	});

	it('drops the style field entirely when no keys remain', () => {
		const next = setSmartArtNodeStyle(data(), '2', { fillColor: undefined, bold: undefined });
		expect(next.nodes[1].style).toBeUndefined();
		expect(next.nodes[1]).not.toHaveProperty('style');
	});

	it('clears drawingShapes to force a reflow', () => {
		const next = setSmartArtNodeStyle(data(), '1', { fillColor: '#FF0000' });
		expect(next.drawingShapes).toBeUndefined();
	});

	it('is immutable: the input is not mutated', () => {
		const input = data();
		const snapshot = JSON.parse(JSON.stringify(input));
		setSmartArtNodeStyle(input, '1', { fillColor: '#FF0000' });
		expect(input).toStrictEqual(snapshot);
	});

	it('returns the same reference when the node id is not found', () => {
		const input = data();
		expect(setSmartArtNodeStyle(input, 'missing', { fillColor: '#FF0000' })).toBe(input);
	});
});
