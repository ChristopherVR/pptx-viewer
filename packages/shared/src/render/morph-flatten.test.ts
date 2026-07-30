import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { flattenMorphElements, needsMorphFlattening } from './morph-flatten';

function el(overrides: Partial<PptxElement> & { id: string }): PptxElement {
	return {
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function group(
	overrides: Partial<PptxElement> & { id: string },
	children: PptxElement[],
): PptxElement {
	return { ...el({ ...overrides, type: 'group' }), children } as PptxElement;
}

describe('flattenMorphElements', () => {
	it('leaves a slide without !! group content completely untouched', () => {
		const elements = [
			el({ id: 'a' }),
			group({ id: 'g', x: 10, y: 20 }, [el({ id: 'g-c1' }), el({ id: 'g-c2' })]),
		];
		expect(needsMorphFlattening(elements)).toBeFalsy();
		const flat = flattenMorphElements(elements);
		expect(flat).toHaveLength(2);
		// Identity-preserving: an untouched element is not even copied.
		expect(flat[1]).toBe(elements[1]);
	});

	it('decomposes a group holding a !!-named child into absolute coordinates', () => {
		// The issue #131 deck wraps its centre artwork in a `!!Circle` group on
		// the topic slides while the overview slide keeps the same shape
		// top-level, so the pair only matches once the group is decomposed.
		const elements = [
			group({ id: 'circle', name: '!!Circle', x: 505, y: 225, width: 270, height: 270 }, [
				el({ id: 'content', name: '!!Content', x: 0, y: 0, width: 270, height: 270 }),
				el({ id: 'button', name: 'Rectangle 4', x: 73, y: 189, width: 124, height: 31 }),
			]),
		];
		expect(needsMorphFlattening(elements)).toBeTruthy();
		const flat = flattenMorphElements(elements);
		expect(flat.map((e) => e.id)).toStrictEqual(['content', 'button']);
		// Absolute = group origin + child offset.
		expect(flat[0]).toMatchObject({ x: 505, y: 225, width: 270, height: 270 });
		expect(flat[1]).toMatchObject({ x: 578, y: 414, width: 124, height: 31 });
	});

	it('decomposes when the !!-named shape is nested deeper than one level', () => {
		const elements = [
			group({ id: 'outer', x: 100, y: 100 }, [
				group({ id: 'inner', x: 10, y: 10 }, [el({ id: 'deep', name: '!!Deep', x: 5, y: 5 })]),
			]),
		];
		expect(needsMorphFlattening(elements)).toBeTruthy();
		const flat = flattenMorphElements(elements);
		expect(flat.map((e) => e.id)).toStrictEqual(['deep']);
		expect(flat[0]).toMatchObject({ x: 115, y: 115 });
	});

	it('keeps a sibling group whole when only its neighbour holds a !! shape', () => {
		const elements = [
			group({ id: 'named', x: 0, y: 0 }, [el({ id: 'n-c', name: '!!Keep' })]),
			group({ id: 'plain', x: 400, y: 0 }, [el({ id: 'p-c' })]),
		];
		const flat = flattenMorphElements(elements);
		expect(flat.map((e) => e.id)).toStrictEqual(['n-c', 'plain']);
	});

	it('does not mutate the input elements', () => {
		const child = el({ id: 'c', name: '!!X', x: 1, y: 2 });
		const elements = [group({ id: 'g', x: 50, y: 60 }, [child])];
		flattenMorphElements(elements);
		expect(child.x).toBe(1);
		expect(child.y).toBe(2);
	});

	it('ignores an empty group', () => {
		const elements = [group({ id: 'g' }, [])];
		expect(needsMorphFlattening(elements)).toBeFalsy();
		expect(flattenMorphElements(elements).map((e) => e.id)).toStrictEqual(['g']);
	});
});
