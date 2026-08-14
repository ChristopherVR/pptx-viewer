import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { flattenMorphElements, morphGroupChildPairs, needsMorphFlattening } from './morph-flatten';

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
		const counterpart = [
			circle('b', [
				el({ id: 'other', name: '!!Content', x: 0, y: 0, width: 270, height: 270 }),
				el({ id: 'other-button', name: 'Rectangle 4', x: 73, y: 189, width: 124, height: 31 }),
			]),
		];
		expect(needsMorphFlattening(elements)).toBeTruthy();
		const flat = flattenMorphElements(elements, counterpart);
		expect(flat.map((e) => e.id)).toStrictEqual(['content', 'button']);
		// Absolute = group origin + child offset.
		expect(flat[0]).toMatchObject({ x: 505, y: 225, width: 270, height: 270 });
		expect(flat[1]).toMatchObject({ x: 578, y: 414, width: 124, height: 31 });
	});

	it('keeps a paired group whole when it does not hold the same cast', () => {
		// The hub slide's `!!Circle` is the disc plus "Select Challenge"; a topic
		// slide's is the disc plus a button and three paragraphs. PowerPoint
		// dissolves one whole panel into the other: exported at 62.5fps with
		// `CreateVideo`, every frame of that morph is a clean linear blend of the
		// two end states. Decomposing instead leaves one departure and four
		// arrivals, which fade out by 23% and in from 42% and so leave the middle
		// of the transition empty (issue #146).
		const hub = [circle('a', [el({ id: 'disc', name: '!!Content' }), el({ id: 'select' })])];
		const topic = [
			circle('b', [
				el({ id: 'b-disc', name: '!!Content' }),
				el({ id: 'b-button' }),
				el({ id: 'b-title' }),
				el({ id: 'b-body' }),
				el({ id: 'b-challenge' }),
			]),
		];

		expect(flattenMorphElements(hub, topic).map((e) => e.id)).toStrictEqual(['a-circle']);
		expect(flattenMorphElements(topic, hub).map((e) => e.id)).toStrictEqual(['b-circle']);
	});

	it('decomposes a paired group whose children merely moved or were restyled', () => {
		// Topic to topic: the same cast, same boxes, different words. They
		// correspond, so each child carries its own morph.
		const a = [
			circle('a', [
				el({ id: 'a-disc', name: '!!Content', width: 270, height: 270 }),
				el({ id: 'a-body', name: 'TextBox 11', x: 41, y: 95, width: 193, height: 36 }),
			]),
		];
		const b = [
			circle('b', [
				el({ id: 'b-disc', name: '!!Content', width: 270, height: 270 }),
				// A different name and a different box, but plainly the same
				// paragraph: overlap decides it.
				el({ id: 'b-body', name: 'TextBox 6', x: 52, y: 95, width: 172, height: 36 }),
			]),
		];

		expect(flattenMorphElements(a, b).map((e) => e.id)).toStrictEqual(['a-disc', 'a-body']);
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
		const twinChild = [el({ id: 'b-c', name: '!!X' })];
		expect(
			flattenMorphElements(elements, [group({ id: 'b-g', name: 'Centre' }, twinChild)]).map(
				(e) => e.id,
			),
		).toStrictEqual(['a-c']);
		expect(
			flattenMorphElements(elements, [
				group({ id: 'b-g', name: 'Elsewhere', x: 10, y: 20 }, twinChild),
			]).map((e) => e.id),
		).toStrictEqual(['a-c']);
		// Neither name nor box agrees: one object.
		expect(
			flattenMorphElements(elements, [
				group({ id: 'b-g', name: 'Elsewhere', x: 900, y: 900 }, twinChild),
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
			group({ id: 'b-outer', x: 100, y: 100 }, [
				el({ id: 'b-flat', name: '!!Deep', x: 10, y: 10 }),
			]),
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

	it('sees past a wrapper group only one of the two slides has', () => {
		// The loader used to flatten a nested `p:grpSp` into its parent's child
		// list, so a morph never saw one. It now keeps the wrapper (its name,
		// fill, locks and animation identity have to survive a round-trip), and
		// the issue #131 deck wraps three of `!!Circle`'s five children in a plain
		// `Group 3` on one topic slide and not on the previous one. Comparing the
		// casts as authored reads five objects against three, refuses to
		// decompose, and the disc stops being carried through - which is exactly
		// what PowerPoint's own render of 4 -> 5 does NOT do (the disc's centre
		// pixel holds RGB 39,40,42 for the whole transition).
		const flat = [
			circle('a', [
				el({ id: 'a-disc', name: '!!Content', width: 270, height: 270 }),
				el({ id: 'a-button', name: 'Rectangle 4', x: 73, y: 189, width: 124, height: 31 }),
				el({ id: 'a-title', name: 'TextBox 9', x: 28, y: 60, width: 214, height: 29 }),
				el({ id: 'a-body', name: 'TextBox 11', x: 41, y: 95, width: 193, height: 36 }),
			]),
		];
		const wrapped = [
			circle('b', [
				el({ id: 'b-disc', name: '!!Content', width: 270, height: 270 }),
				group({ id: 'b-wrap', name: 'Group 3', x: 28, y: 60, width: 214, height: 71 }, [
					el({ id: 'b-title', name: 'TextBox 5', x: 0, y: 0, width: 214, height: 29 }),
					el({ id: 'b-body', name: 'TextBox 6', x: 13, y: 35, width: 193, height: 36 }),
				]),
				el({ id: 'b-button', name: 'Rectangle 4', x: 73, y: 189, width: 124, height: 31 }),
			]),
		];

		expect(flattenMorphElements(flat, wrapped).map((e) => e.id)).toStrictEqual([
			'a-disc',
			'a-button',
			'a-title',
			'a-body',
		]);
		expect(flattenMorphElements(wrapped, flat).map((e) => e.id)).toStrictEqual([
			'b-disc',
			'b-title',
			'b-body',
			'b-button',
		]);
		// The expanded leaves land in the wrapper's space, then the group's.
		const [, title] = flattenMorphElements(wrapped, flat);
		expect(title).toMatchObject({ id: 'b-title', x: 505 + 28, y: 225 + 60 });
	});

	it('descends into a wrapper both slides have, even with no !! name inside', () => {
		// Once `!!Circle`'s cast has corresponded one for one, its members ARE
		// each other's counterparts, so the unnamed `Group 3` inside pairs with
		// its twin and its paragraphs animate individually. PowerPoint crossfades
		// them (issue #160); requiring `!!` all the way down carries the whole
		// wrapper as one object instead.
		const panel = (prefix: string, words: string): PptxElement =>
			circle(prefix, [
				el({ id: `${prefix}-disc`, name: '!!Content', width: 270, height: 270 }),
				group({ id: `${prefix}-wrap`, name: 'Group 3', x: 28, y: 60, width: 214, height: 71 }, [
					el({
						id: `${prefix}-title`,
						type: 'text',
						name: 'TextBox 5',
						width: 214,
						height: 29,
						text: words,
					} as Partial<PptxElement> & { id: string }),
					el({ id: `${prefix}-body`, name: 'TextBox 6', x: 13, y: 35, width: 193, height: 36 }),
				]),
			]);

		expect(
			flattenMorphElements([panel('a', 'Open Integration')], [panel('b', 'Tactical Edge')]).map(
				(e) => e.id,
			),
		).toStrictEqual(['a-disc', 'a-title', 'a-body']);
	});

	it('does not mutate the input elements', () => {
		const child = el({ id: 'c', name: '!!X', x: 1, y: 2 });
		const elements = [group({ id: 'g', x: 50, y: 60 }, [child])];
		flattenMorphElements(elements, [
			group({ id: 'b', x: 50, y: 60 }, [el({ id: 'b-c', name: '!!X', x: 1, y: 2 })]),
		]);
		expect(child.x).toBe(1);
		expect(child.y).toBe(2);
	});

	it('ignores an empty group', () => {
		const elements = [group({ id: 'g' }, [])];
		expect(needsMorphFlattening(elements)).toBeFalsy();
		expect(flattenMorphElements(elements, []).map((e) => e.id)).toStrictEqual(['g']);
	});
});

describe('morphGroupChildPairs', () => {
	/** The centre panel of a topic slide: disc, button, title, body. */
	const panel = (prefix: string, title: string, bodyWidth: number): PptxElement =>
		circle(prefix, [
			el({ id: `${prefix}-disc`, name: '!!Content', width: 270, height: 270 }),
			el({ id: `${prefix}-button`, name: 'Rectangle 4', x: 73, y: 189, width: 124, height: 31 }),
			el({
				id: `${prefix}-title`,
				type: 'text',
				name: 'TextBox 5',
				x: 28,
				y: 60,
				width: 214,
				height: 29,
				text: title,
			} as Partial<PptxElement> & { id: string }),
			el({
				id: `${prefix}-body`,
				type: 'text',
				name: 'TextBox 6',
				x: 52,
				y: 95,
				width: bodyWidth,
				height: 36,
				text: `${title} body`,
			} as Partial<PptxElement> & { id: string }),
		]);

	it('pairs the children of two groups it decomposed', () => {
		// The pairing that justified taking the groups apart is evidence the
		// matcher cannot rebuild from the flat list, and without it the two
		// re-worded text boxes fall through to the proximity pass, which refuses
		// "same place, different words" (issue #160).
		const pairs = morphGroupChildPairs(
			[panel('a', 'Cyber and EM Spectrum', 172)],
			[panel('b', 'AI Decision Advantage', 193)],
		);
		expect(Object.fromEntries(pairs)).toStrictEqual({
			'a-disc': 'b-disc',
			'a-button': 'b-button',
			'a-title': 'b-title',
			'a-body': 'b-body',
		});
	});

	it('reports nothing for groups it would not decompose', () => {
		const hub = [circle('a', [el({ id: 'disc', name: '!!Content' }), el({ id: 'select' })])];
		const topic = [
			circle('b', [
				el({ id: 'b-disc', name: '!!Content' }),
				el({ id: 'b-button' }),
				el({ id: 'b-title' }),
			]),
		];
		expect(morphGroupChildPairs(hub, topic).size).toBe(0);
		expect(morphGroupChildPairs([el({ id: 'plain' })], [el({ id: 'other' })]).size).toBe(0);
	});

	it('descends into nested groups that also correspond', () => {
		// A nested group is only taken apart on the same terms as a top-level one:
		// it has to hold a `!!`-named descendant of its own.
		const nest = (prefix: string, words: string): PptxElement =>
			circle(prefix, [
				el({ id: `${prefix}-disc`, name: '!!Content', width: 270, height: 270 }),
				group({ id: `${prefix}-inner`, name: 'Group 3', x: 28, y: 60, width: 214, height: 119 }, [
					el({ id: `${prefix}-mark`, name: '!!Mark', width: 20, height: 20 }),
					el({
						id: `${prefix}-line`,
						type: 'text',
						name: 'TextBox 5',
						y: 30,
						width: 214,
						height: 29,
						text: words,
					} as Partial<PptxElement> & { id: string }),
				]),
			]);
		const pairs = morphGroupChildPairs(
			[nest('a', 'Open Integration')],
			[nest('b', 'Tactical Edge')],
		);
		expect(pairs.get('a-inner')).toBe('b-inner');
		expect(pairs.get('a-line')).toBe('b-line');
	});

	it('pairs the paragraphs inside an unnamed wrapper both slides have', () => {
		// The wording is what makes two text boxes look unrelated (same place,
		// different words), so nothing but this pairing can carry them through -
		// and the wrapper carries no `!!` name of its own (issue #160).
		const wrapPanel = (prefix: string, words: string): PptxElement =>
			circle(prefix, [
				el({ id: `${prefix}-disc`, name: '!!Content', width: 270, height: 270 }),
				group({ id: `${prefix}-wrap`, name: 'Group 3', x: 28, y: 60, width: 214, height: 71 }, [
					el({
						id: `${prefix}-title`,
						type: 'text',
						name: 'TextBox 5',
						width: 214,
						height: 29,
						text: words,
					} as Partial<PptxElement> & { id: string }),
				]),
			]);
		const pairs = morphGroupChildPairs(
			[wrapPanel('a', 'Open Integration')],
			[wrapPanel('b', 'Tactical Edge')],
		);
		expect(pairs.get('a-wrap')).toBe('b-wrap');
		expect(pairs.get('a-title')).toBe('b-title');
	});

	it('pairs across a wrapper only one slide has', () => {
		// Three objects against "one object and a wrapper holding two". The casts
		// only line up once the wrapper is out of the way, and it is the pairing
		// they then produce that carries the disc through 4 -> 5 (issue #131).
		const flat = circle('a', [
			el({ id: 'a-disc', name: '!!Content', width: 270, height: 270 }),
			el({ id: 'a-title', name: 'TextBox 9', x: 28, y: 60, width: 214, height: 29 }),
			el({ id: 'a-body', name: 'TextBox 11', x: 41, y: 95, width: 193, height: 36 }),
		]);
		const wrapped = circle('b', [
			el({ id: 'b-disc', name: '!!Content', width: 270, height: 270 }),
			group({ id: 'b-wrap', name: 'Group 3', x: 28, y: 60, width: 214, height: 71 }, [
				el({ id: 'b-title', name: 'TextBox 5', width: 214, height: 29 }),
				el({ id: 'b-body', name: 'TextBox 6', x: 13, y: 35, width: 193, height: 36 }),
			]),
		]);
		expect(Object.fromEntries(morphGroupChildPairs([flat], [wrapped]))).toStrictEqual({
			'a-disc': 'b-disc',
			'a-title': 'b-title',
			'a-body': 'b-body',
		});
	});
});
