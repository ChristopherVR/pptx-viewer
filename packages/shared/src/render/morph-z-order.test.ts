import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { MorphPair } from './morph-types';
import { computeZOrderSwaps } from './morph-z-order';

function el(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return { id, type: 'shape', x: 0, y: 0, width: 100, height: 50, ...overrides } as PptxElement;
}

const pair = (from: PptxElement, to: PptxElement): MorphPair => ({
	fromElement: from,
	toElement: to,
});

describe('computeZOrderSwaps', () => {
	it('writes the journey in the stage z space, offset by the template layers', () => {
		// The React presentation stage paints N master/layout shapes first and
		// gives the slide's first element z-index N. A journey written as bare
		// document indices (0/1) would sink both pictures beneath every
		// template shape for the whole morph.
		const aFrom = el('a-from');
		const bFrom = el('b-from');
		const aTo = el('a-to');
		const bTo = el('b-to');
		const pairs = [pair(aFrom, aTo), pair(bFrom, bTo)];
		// Outgoing: a under b. Incoming: b under a.
		const swaps = computeZOrderSwaps(pairs, [aFrom, bFrom], [bTo, aTo], undefined, 7);
		expect(swaps.get('a-to')).toStrictEqual({ from: 7, to: 8 });
		expect(swaps.get('b-to')).toStrictEqual({ from: 8, to: 7 });
	});

	it('keeps the swap inside the pair’s own band when other elements sit between', () => {
		// A title text box stacks between the two pictures on the incoming
		// slide: the pictures trade THEIR layers (0 and 2) and never cross it.
		const aFrom = el('a-from');
		const bFrom = el('b-from');
		const aTo = el('a-to');
		const bTo = el('b-to');
		const title = el('title', { type: 'text' });
		const pairs = [pair(aFrom, aTo), pair(bFrom, bTo)];
		const swaps = computeZOrderSwaps(pairs, [aFrom, bFrom], [bTo, title, aTo]);
		expect(swaps.get('a-to')).toStrictEqual({ from: 0, to: 2 });
		expect(swaps.get('b-to')).toStrictEqual({ from: 2, to: 0 });
		expect(swaps.has('title')).toBeFalsy();
	});

	it('emits nothing for a pair whose rank does not change', () => {
		const aFrom = el('a-from');
		const bFrom = el('b-from');
		const cFrom = el('c-from');
		const aTo = el('a-to');
		const bTo = el('b-to');
		const cTo = el('c-to');
		const pairs = [pair(aFrom, aTo), pair(bFrom, bTo), pair(cFrom, cTo)];
		// Only a and c swap; b stays in the middle.
		const swaps = computeZOrderSwaps(pairs, [aFrom, bFrom, cFrom], [cTo, bTo, aTo]);
		expect(swaps.get('a-to')).toStrictEqual({ from: 0, to: 2 });
		expect(swaps.get('c-to')).toStrictEqual({ from: 2, to: 0 });
		expect(swaps.has('b-to')).toBeFalsy();
	});

	it('skips pairs the overlay ghosts', () => {
		const aFrom = el('a-from');
		const bFrom = el('b-from');
		const aTo = el('a-to');
		const bTo = el('b-to');
		const pairs = [pair(aFrom, aTo), pair(bFrom, bTo)];
		const swaps = computeZOrderSwaps(pairs, [aFrom, bFrom], [bTo, aTo], new Set(['a-from']));
		expect(swaps.size).toBe(0);
	});

	it('steps a decomposed group’s children inside the group, by child index', () => {
		// The incoming halves are children of one group, which stacks them in
		// its own context at their child index, so the journey is written in
		// child indices and never touches the top-level band.
		const aFrom = el('a-from');
		const bFrom = el('b-from');
		const aTo = el('a-to');
		const bTo = el('b-to');
		const group = el('g', { type: 'group', children: [bTo, aTo] } as Partial<PptxElement>);
		const cover = el('cover');
		const pairs = [pair(aFrom, aTo), pair(bFrom, bTo)];
		const swaps = computeZOrderSwaps(pairs, [aFrom, bFrom], [cover, group], undefined, 3);
		expect(swaps.get('a-to')).toStrictEqual({ from: 0, to: 1 });
		expect(swaps.get('b-to')).toStrictEqual({ from: 1, to: 0 });
	});

	it('never pairs a top-level element with a group child across contexts', () => {
		const aFrom = el('a-from');
		const bFrom = el('b-from');
		const aTo = el('a-to');
		const bTo = el('b-to');
		const group = el('g', { type: 'group', children: [bTo] } as Partial<PptxElement>);
		const pairs = [pair(aFrom, aTo), pair(bFrom, bTo)];
		const swaps = computeZOrderSwaps(pairs, [aFrom, bFrom], [group, aTo]);
		expect(swaps.size).toBe(0);
	});
});
