import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { resolveAxisCount, resolveAxisNodes } from './smartart-layout-interpreter-axis-count';

describe('resolveAxisNodes', () => {
	it('is undecidable (undefined) for an empty axis list', () => {
		expect(resolveAxisNodes([], [], undefined, undefined, undefined)).toBeUndefined();
	});

	it('is undecidable (undefined) with no context when hop 0 is neither ch nor self', () => {
		const nodes: PptxSmartArtNode[] = [{ id: 'a', text: 'A' }];
		expect(resolveAxisNodes(nodes, ['des'], undefined, undefined, undefined)).toBeUndefined();
		expect(resolveAxisNodes(nodes, ['root'], undefined, undefined, undefined)).toBeUndefined();
	});

	it('bare "ch" resolves to the diagram\'s own top-level points', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], undefined, undefined);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'three']);
	});

	/**
	 * `smartart-layout-interpreter-axis-count.ts`'s `selectRange`: a
	 * `dgm:forEach`/`dgm:if` with a `@cnt` but NO explicit `@st` (ECMA-376
	 * default `st=1`) was silently returning EVERY matched node instead of
	 * just the first `@cnt` of them - COM-verified via `basic-venn--hier5
	 * .pptx`'s `circ1Tx` `forEachOrigin` (`axis="ch" cnt="1"`, no `st`): its
	 * anchor resolved to ALL THREE top-level points instead of just the
	 * first, folding three unrelated points' text into one shape.
	 */
	it('count without an explicit start defaults start to 1 (does not return every node)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], undefined, [1]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one']);
	});

	it('neither start nor count is still a true no-op (every matched node)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const nodes = [one, two];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], undefined, undefined);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('an explicit start still behaves exactly as before (unaffected by the count-defaulting fix)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], [2], [1]);
		expect(result?.map((n) => n.id)).toStrictEqual(['two']);
	});

	/**
	 * `Phased Process`'s `circ1Tx`: a compound `presOf axis="desOrSelf"`
	 * anchored by its OWN `forEachOrigin` (`axis="ch ch" st="2 1" cnt="1 1"` -
	 * "point 2's first child"), resolved via the `context` parameter instead
	 * of the diagram root.
	 */
	it('an explicit context anchors hop 0 instead of the diagram root', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Node Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
		const nodes = [one, two, three];
		// Anchored at "Node One": desOrSelf should be [one, two], never "three".
		const result = resolveAxisNodes(nodes, ['desOrSelf'], ['node'], undefined, undefined, [one]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('a context lets hop 0 accept every single-hop axis token, not just ch/self', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'a' };
		const nodes = [a, b];
		expect(
			resolveAxisNodes(nodes, ['ancst'], undefined, undefined, undefined, [b])?.map((n) => n.id),
		).toStrictEqual(['a']);
	});
});

describe('resolveAxisCount', () => {
	it("matches resolveAxisNodes's own length", () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const nodes = [one, two];
		expect(resolveAxisCount(nodes, ['ch'], ['node'], undefined, undefined)).toBe(2);
	});
});
