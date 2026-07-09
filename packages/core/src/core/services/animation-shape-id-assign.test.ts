import { describe, expect, it } from 'vitest';

import type { PptxElement, PptxElementAnimation } from '../types';
import { remapEditorAnimationsToShapeIds } from './animation-shape-id-assign';

function el(id: string, shapeId?: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeId,
	} as PptxElement;
}

describe('remapEditorAnimationsToShapeIds', () => {
	it('remaps elementId to an existing element.shapeId (real-file element)', () => {
		const elements = [el('slide1-shape-0', '2'), el('slide1-shape-1', '3')];
		const anims: PptxElementAnimation[] = [{ elementId: 'slide1-shape-1', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		expect(out[0].elementId).toBe('3');
		// Original array is not mutated.
		expect(anims[0].elementId).toBe('slide1-shape-1');
	});

	it('mints a fresh shapeId for an SDK element that has none, and stamps it', () => {
		const target = el('sdk-el', undefined);
		const elements = [el('other', '2'), target];
		const anims: PptxElementAnimation[] = [{ elementId: 'sdk-el', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		// Minted above the max existing shapeId (2).
		expect(out[0].elementId).toBe('3');
		expect(target.shapeId).toBe('3');
	});

	it('mints above the reserved id floor to avoid the spTree root collision', () => {
		const target = el('sdk-el', undefined);
		const anims: PptxElementAnimation[] = [{ elementId: 'sdk-el' }];
		// reservedMaxId 1 models the implicit <p:spTree> group cNvPr id.
		const out = remapEditorAnimationsToShapeIds([target], anims, 1);
		expect(out[0].elementId).toBe('2');
		expect(target.shapeId).toBe('2');
	});

	it('remaps a triggerShapeId reference', () => {
		const elements = [el('trigger-el', '4'), el('target-el', '5')];
		const anims: PptxElementAnimation[] = [
			{ elementId: 'target-el', triggerShapeId: 'trigger-el', trigger: 'onShapeClick' },
		];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		expect(out[0].elementId).toBe('5');
		expect(out[0].triggerShapeId).toBe('4');
	});

	it('leaves an unresolvable elementId untouched', () => {
		const elements = [el('slide1-shape-0', '2')];
		const anims: PptxElementAnimation[] = [{ elementId: 'does-not-exist', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		expect(out[0].elementId).toBe('does-not-exist');
	});

	it('resolves an element nested inside a group', () => {
		const child = el('group-child', '6');
		const group: PptxElement = {
			type: 'group',
			id: 'group-0',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [child],
		} as PptxElement;
		const anims: PptxElementAnimation[] = [{ elementId: 'group-child', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds([group], anims);
		expect(out[0].elementId).toBe('6');
	});
});
