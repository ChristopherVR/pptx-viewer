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

/** A `!!Circle` group of the deck's centre box, with the given children. */
function circle(idPrefix: string, children: PptxElement[]): PptxElement {
	return group(
		{ id: `${idPrefix}-circle`, name: '!!Circle', x: 505, y: 225, width: 270, height: 270 },
		children,
	);
}

describe('flattenMorphElements', () => {
	it('leaves a slide without !! group content completely untouched', () => {
		const elements = [
			el({ id: 'a' }),
			group({ id: 'g', x: 10, y: 20 }, [el({ id: 'g-c1' }), el({ id: 'g-c2' })]),
		];
		expect(needsMorphFlattening(elements)).toBeFalsy();
		const flat = flattenMorphElements(elements, []);
		expect(flat).toHaveLength(2);
		// Identity-preserving: an untouched element is not even copied.
		expect(flat[1]).toBe(elements[1]);
	});

	it('decomposes two corresponding groups into absolute coordinates', () => {
		// Both topic slides of the issue #131 deck wrap the centre artwork in a
		// `!!Circle` group. Those two containers pair, so PowerPoint descends
		// into them and carries their contents through: the centre disc holds
		// RGB 39,40,42 for the whole of a measured topic -> topic transition.
		const elements = [
			circle('a', [
				el({ id: 'content', name: '!!Content', x: 0, y: 0, width: 270, height: 270 }),
				el({ id: 'button', name: 'Rectangle 4', x: 73, y: 189, width: 124, height: 31 }),
			]),
		];
		const counterpart = [circle('b', [el({ id: 'other', name: '!!Content' })])];
		expect(needsMorphFlattening(elements)).toBeTruthy();
		const flat = flattenMorphElements(elements, counterpart);
		expect(flat.map((e) => e.id)).toStrictEqual(['content', 'button']);
		// Absolute = group origin + child offset.
		expect(flat[0]).toMatchObject({ x: 505, y: 225, width: 270, height: 270 });
		expect(flat[1]).toMatchObject({ x: 578, y: 414, width: 124, height: 31 });
	});

	it('keeps a group whole when the counterpart has no group to pair it with', () => {
		// The overview slide of the issue #131 deck keeps the same `!!Content`
		// shape TOP-LEVEL. PowerPoint matches level by level, so the group stays
		// one object and dissolves: the disc's centre pixel reads RGB 39,40,42 at
		// 0ms, 174,194,204 (the artwork behind it) from 324ms to 449ms, and
		// 39,40,42 again by 983ms.
		const elements = [circle('a', [el({ id: 'content', name: '!!Content' })])];
		const counterpart = [el({ id: 'toplevel', name: '!!Content', x: 505, y: 225 })];
		const flat = flattenMorphElements(elements, counterpart);
		expect(flat.map((e) => e.id)).toStrictEqual(['a-circle']);
	});

	it('pairs corresponding groups by plain name or by an identical box', () => {
		const elements = [
			group({ id: 'a-g', name: 'Centre', x: 10, y: 20 }, [el({ id: 'a-c', name: '!!X' })]),
		];
		expect(
			flattenMorphElements(elements, [group({ id: 'b-g', name: 'Centre' }, [])]).map((e) => e.id),
		).toStrictEqual(['a-c']);
		expect(
			flattenMorphElements(elements, [
				group({ id: 'b-g', name: 'Elsewhere', x: 10, y: 20 }, []),
			]).map((e) => e.id),
		).toStrictEqual(['a-c']);
		// Neither name nor box agrees: one object.
		expect(
			flattenMorphElements(elements, [
				group({ id: 'b-g', name: 'Elsewhere', x: 900, y: 900 }, []),
			]).map((e) => e.id),
		).toStrictEqual(['a-g']);
	});

	it('does not pair a group with a non-group of the same box', () => {
		const elements = [group({ id: 'a-g', x: 10, y: 20 }, [el({ id: 'a-c', name: '!!X' })])];
		const counterpart = [el({ id: 'b', type: 'shape', x: 10, y: 20 })];
		expect(flattenMorphElements(elements, counterpart).map((e) => e.id)).toStrictEqual(['a-g']);
	});

	it('decomposes when the !!-named shape is nested deeper than one level', () => {
		const elements = [
			group({ id: 'outer', x: 100, y: 100 }, [
				group({ id: 'inner', x: 10, y: 10 }, [el({ id: 'deep', name: '!!Deep', x: 5, y: 5 })]),
			]),
		];
		const counterpart = [
			group({ id: 'b-outer', x: 100, y: 100 }, [
				group({ id: 'b-inner', x: 10, y: 10 }, [el({ id: 'b-deep', name: '!!Deep' })]),
			]),
		];
		expect(needsMorphFlattening(elements)).toBeTruthy();
		const flat = flattenMorphElements(elements, counterpart);
		expect(flat.map((e) => e.id)).toStrictEqual(['deep']);
		expect(flat[0]).toMatchObject({ x: 115, y: 115 });
	});

	it('stops descending where the counterpart stops nesting', () => {
		// Outer groups pair, inner ones do not, so the inner group is the unit.
		const elements = [
			group({ id: 'outer', x: 100, y: 100 }, [
				group({ id: 'inner', x: 10, y: 10 }, [el({ id: 'deep', name: '!!Deep', x: 5, y: 5 })]),
			]),
		];
		const counterpart = [
			group({ id: 'b-outer', x: 100, y: 100 }, [el({ id: 'b-flat', name: '!!Deep', x: 900 })]),
		];
		const flat = flattenMorphElements(elements, counterpart);
		expect(flat.map((e) => e.id)).toStrictEqual(['inner']);
		expect(flat[0]).toMatchObject({ x: 110, y: 110 });
	});

	it('keeps a sibling group whole when only its neighbour holds a !! shape', () => {
		const elements = [
			group({ id: 'named', x: 0, y: 0 }, [el({ id: 'n-c', name: '!!Keep' })]),
			group({ id: 'plain', x: 400, y: 0 }, [el({ id: 'p-c' })]),
		];
		const counterpart = [group({ id: 'b-named', x: 0, y: 0 }, [el({ id: 'b-c', name: '!!Keep' })])];
		const flat = flattenMorphElements(elements, counterpart);
		expect(flat.map((e) => e.id)).toStrictEqual(['n-c', 'plain']);
	});

	it('does not mutate the input elements', () => {
		const child = el({ id: 'c', name: '!!X', x: 1, y: 2 });
		const elements = [group({ id: 'g', x: 50, y: 60 }, [child])];
		flattenMorphElements(elements, [group({ id: 'b', x: 50, y: 60 }, [])]);
		expect(child.x).toBe(1);
		expect(child.y).toBe(2);
	});

	it('ignores an empty group', () => {
		const elements = [group({ id: 'g' }, [])];
		expect(needsMorphFlattening(elements)).toBeFalsy();
		expect(flattenMorphElements(elements, []).map((e) => e.id)).toStrictEqual(['g']);
	});
});
