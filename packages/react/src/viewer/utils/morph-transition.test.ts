import { describe, it, expect } from 'vitest';
import {
	matchMorphElements,
	generateMorphAnimations,
} from './morph-transition';
import type { MorphPair } from './morph-transition';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

function makeElement(
	overrides: Partial<PptxElement> & { id: string; type: PptxElement['type'] },
): PptxElement {
	return {
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function makeSlide(elements: PptxElement[]): PptxSlide {
	return {
		id: 'slide-1',
		elements,
	} as PptxSlide;
}

describe('matchMorphElements', () => {
	it('should match elements by !! naming convention', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'text', text: '!!title', x: 10, y: 10 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'b', type: 'text', text: '!!title', x: 50, y: 50 }),
		]);
		const pairs = matchMorphElements(from, to);
		expect(pairs.length).toBe(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('should match elements by ID when names do not match', () => {
		const from = makeSlide([
			makeElement({ id: 'elem1', type: 'shape', x: 0, y: 0 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'elem1', type: 'shape', x: 100, y: 100 }),
		]);
		const pairs = matchMorphElements(from, to);
		expect(pairs.length).toBe(1);
		expect(pairs[0].fromElement.id).toBe('elem1');
		expect(pairs[0].toElement.id).toBe('elem1');
	});

	it('should match by type and proximity as third pass', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 10, y: 10 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'b', type: 'shape', x: 20, y: 20 }),
		]);
		const pairs = matchMorphElements(from, to);
		// IDs differ, no !! names, but same type and within 300px
		expect(pairs.length).toBe(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('should not match by proximity when distance exceeds 300px', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 0, y: 0 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'b', type: 'shape', x: 500, y: 500 }),
		]);
		const pairs = matchMorphElements(from, to);
		expect(pairs.length).toBe(0);
	});

	it('should not match elements of different types by proximity', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 10, y: 10 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'b', type: 'image', x: 15, y: 15 }),
		]);
		const pairs = matchMorphElements(from, to);
		expect(pairs.length).toBe(0);
	});

	it('should prefer !! naming over ID matching', () => {
		const from = makeSlide([
			makeElement({ id: 'shared', type: 'text', text: '!!hero', x: 0, y: 0 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'different', type: 'text', text: '!!hero', x: 50, y: 50 }),
			makeElement({ id: 'shared', type: 'text', text: 'other', x: 100, y: 100 }),
		]);
		const pairs = matchMorphElements(from, to);
		// Should match by name first (!!hero -> !!hero), not by id
		const heroPair = pairs.find((p) => p.fromElement.id === 'shared');
		expect(heroPair).toBeDefined();
		expect(heroPair!.toElement.id).toBe('different');
	});

	it('should return empty array when both slides have no elements', () => {
		const from = makeSlide([]);
		const to = makeSlide([]);
		expect(matchMorphElements(from, to)).toEqual([]);
	});

	it('should handle unmatched elements on both slides', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 0, y: 0 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'b', type: 'image', x: 500, y: 500 }),
		]);
		const pairs = matchMorphElements(from, to);
		expect(pairs.length).toBe(0);
	});
});

describe('generateMorphAnimations', () => {
	it('should generate animation for each pair', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 50, y: 50, width: 200, height: 100 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 1000);
		expect(anims.length).toBe(1);
		expect(anims[0].elementId).toBe('b');
	});

	it('should include translate transform from position delta', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 10, y: 20, width: 100, height: 50 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 50, y: 70, width: 100, height: 50 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		// translate should be from - to: (10-50, 20-70) = (-40, -50)
		expect(anims[0].keyframes).toContain('translate(-40px, -50px)');
	});

	it('should include scale transform from size delta', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 200, height: 100 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		// scale: from/to = 200/100=2, 100/50=2
		expect(anims[0].keyframes).toContain('scale(2, 2)');
	});

	it('should include rotation transform from rotation delta', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50, rotation: 45 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 0, y: 0, width: 100, height: 50, rotation: 0 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('rotate(45deg)');
	});

	it('should include duration in animation string', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 750);
		expect(anims[0].animation).toContain('750ms');
	});

	it('should include ease-in-out timing function', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].animation).toContain('ease-in-out');
	});

	it('should return empty array for empty pairs', () => {
		expect(generateMorphAnimations([], 500)).toEqual([]);
	});

	it('should generate unique keyframe names for each pair', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 50, y: 50, width: 100, height: 50 }),
			},
			{
				fromElement: makeElement({ id: 'c', type: 'shape', x: 0, y: 0, width: 100, height: 50 }),
				toElement: makeElement({ id: 'd', type: 'shape', x: 50, y: 50, width: 100, height: 50 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		const name0 = anims[0].animation.split(' ')[0];
		const name1 = anims[1].animation.split(' ')[0];
		expect(name0).not.toBe(name1);
	});

	it('should handle opacity in keyframes', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50, opacity: 0.5 }),
				toElement: makeElement({ id: 'b', type: 'shape', x: 0, y: 0, width: 100, height: 50, opacity: 1 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('opacity: 0.5');
		expect(anims[0].keyframes).toContain('opacity: 1');
	});
});
