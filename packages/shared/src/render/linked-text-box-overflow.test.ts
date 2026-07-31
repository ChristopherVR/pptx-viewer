/**
 * Contract tests for the shared `a:linkedTxbx` overflow helpers.
 *
 * These pin the pieces every binding now renders through, so a regression shows
 * up here rather than in five separate view layers:
 *
 *  - `getOverflowSegments` tolerating a missing sibling list, which is what lets
 *    each binding call it unconditionally at its text-render site;
 *  - `buildParagraphs` honouring `segmentOverrides` (the seam Vue, Svelte and
 *    Vanilla use to paint a chain member's slice); and
 *  - `buildTextBlockStyle` clipping a chain member, without which the text a
 *    successor box paints ALSO spills out of its predecessor and renders twice.
 *
 * The exhaustive distribution/chain-building cases live next to the algorithm in
 * `pptx-viewer-core`; this file only covers the render-side contract.
 */
import type { PptxElement, PptxElementWithText, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildSlideOverflowMap,
	getOverflowSegments,
	isLinkedTextBox,
} from './linked-text-box-overflow';
import { buildTextBlockStyle } from './text-block-style';
import { buildParagraphs } from './text-paragraphs';

/**
 * A box small enough that `estimateTextBoxCapacity` resolves to exactly 3
 * characters: 60px wide and 30px tall minus the default 7px insets leaves
 * 46x16px, and an 18pt (24px) font gives floor(46 / (24 * 0.6)) = 3 chars on
 * the single line that fits. Pinning the geometry keeps the split deterministic.
 */
function linkedBox(id: string, seq: number, segments?: TextSegment[]): PptxElementWithText {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 60,
		height: 30,
		textStyle: { fontSize: 18 },
		linkedTxbxId: 7,
		linkedTxbxSeq: seq,
		...(segments ? { textSegments: segments } : {}),
	} as PptxElementWithText;
}

function plainBox(id: string, segments: TextSegment[]): PptxElementWithText {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		textSegments: segments,
	} as PptxElementWithText;
}

/** Head holds the chain's whole text; the tail is authored empty, as PowerPoint writes it. */
function chain(): [PptxElementWithText, PptxElementWithText] {
	return [linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]), linkedBox('tail', 1)];
}

/**
 * A group wrapping the given children. Children carry group-relative x/y but
 * SLIDE-scale width/height, which is exactly how the loader and `groupElements`
 * build one, and why the capacity estimate needs no coordinate correction.
 */
function group(id: string, children: PptxElement[]): PptxElement {
	return {
		type: 'group',
		id,
		x: 100,
		y: 100,
		width: 400,
		height: 300,
		children,
	} as PptxElement;
}

describe('getOverflowSegments', () => {
	it('splits the chain text so each box renders only its own slice', () => {
		const [head, tail] = chain();
		expect(getOverflowSegments(head, [head, tail])?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, [head, tail])?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('returns undefined for an element that is not in a chain', () => {
		const plain = plainBox('p1', [{ text: 'Hello', style: {} }]);
		expect(getOverflowSegments(plain, [plain])).toBeUndefined();
	});

	// The nullable sibling list is the whole reason each binding can call this
	// helper unconditionally: a surface that renders an element outside any slide
	// must degrade to the element's own segments, not throw.
	it('returns undefined when the caller has no sibling list', () => {
		const [head] = chain();
		expect(getOverflowSegments(head, undefined)).toBeUndefined();
		expect(getOverflowSegments(head, [])).toBeUndefined();
	});

	it('returns undefined for a chain of one, so a lone box keeps its own text', () => {
		const [head] = chain();
		expect(getOverflowSegments(head, [head])).toBeUndefined();
	});
});

/**
 * Chain resolution has to descend into `p:grpSp`. Every binding passes the
 * slide's TOP-LEVEL element list to `getOverflowSegments`, including at a group
 * child's own render site, so before the walk existed a chain authored inside a
 * group resolved to no chain at all: the head painted the whole text and the
 * successor rendered blank, in all five bindings.
 *
 * `a:linkedTxbx/@id` is scoped to the slide part, not to a branch of the shape
 * tree, so a chain is resolved wherever its members sit, group boundaries
 * included. The expected splits below are the same 'ABC' / 'DEFGHIJ' the
 * top-level cases assert, which is the point: nesting must not change them.
 */
describe('getOverflowSegments across group nesting', () => {
	it('resolves a chain authored entirely inside a group', () => {
		const [head, tail] = chain();
		const slide = [group('g1', [head, tail])];
		expect(getOverflowSegments(head, slide)?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, slide)?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('resolves a chain inside a nested group', () => {
		const [head, tail] = chain();
		const slide = [group('outer', [group('inner', [head, tail])])];
		expect(getOverflowSegments(head, slide)?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, slide)?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	// Deliberate: OOXML does not confine a chain to one group, so a chain that
	// crosses a group boundary flows rather than breaking. Seq ordering, not
	// nesting, decides who paints what.
	it('flows a chain whose head is grouped and whose successor is not', () => {
		const [head, tail] = chain();
		const slide = [group('g1', [head]), tail];
		expect(getOverflowSegments(head, slide)?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, slide)?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('flows a chain split across two sibling groups', () => {
		const [head, tail] = chain();
		const slide = [group('g1', [head]), group('g2', [tail])];
		expect(getOverflowSegments(head, slide)?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, slide)?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	// Sequence, not document order, orders the chain: a successor authored
	// BEFORE its head, in an earlier group, still receives the overflow.
	it('orders by seq, not by position in the tree', () => {
		const [head, tail] = chain();
		const slide = [group('g1', [tail]), head];
		expect(getOverflowSegments(head, slide)?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, slide)?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('leaves a lone grouped box alone, so a one-member chain keeps its text', () => {
		const [head] = chain();
		expect(getOverflowSegments(head, [group('g1', [head])])).toBeUndefined();
	});

	it('does not confuse two chains with different ids in the same group', () => {
		const [head, tail] = chain();
		const other = linkedBox('other', 0, [{ text: 'ZZZZZZ', style: {} }]);
		(other as { linkedTxbxId?: number }).linkedTxbxId = 8;
		const slide = [group('g1', [head, other, tail])];
		expect(getOverflowSegments(head, slide)?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(other, slide)).toBeUndefined();
	});

	it('maps grouped and nested members in one pass', () => {
		const [head, tail] = chain();
		const map = buildSlideOverflowMap([group('outer', [group('inner', [head]), tail])]);
		expect(map.get('head')?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(map.get('tail')?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('survives a cyclic group tree instead of recursing forever', () => {
		const [head, tail] = chain();
		const cycle = group('g1', [head, tail]) as PptxElement & { children: PptxElement[] };
		cycle.children.push(cycle);
		expect(getOverflowSegments(head, [cycle])?.map((s) => s.text)).toStrictEqual(['ABC']);
	});
});

describe('isLinkedTextBox', () => {
	it('is true only for an element carrying a linkedTxbxId', () => {
		const [head] = chain();
		expect(isLinkedTextBox(head)).toBeTruthy();
		expect(isLinkedTextBox(plainBox('p1', []))).toBeFalsy();
		expect(isLinkedTextBox({ type: 'image', id: 'i1' } as PptxElement)).toBeFalsy();
	});
});

describe('buildSlideOverflowMap', () => {
	it('maps every chain member to its distributed slice in one pass', () => {
		const [head, tail] = chain();
		const map = buildSlideOverflowMap([head, tail]);
		expect(map.get('head')?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(map.get('tail')?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('is empty for a slide with no linked boxes, so the common case costs nothing', () => {
		expect(buildSlideOverflowMap([plainBox('p1', [{ text: 'Hello', style: {} }])]).size).toBe(0);
	});
});

describe('buildParagraphs with segmentOverrides', () => {
	it("renders the override instead of the element's own segments", () => {
		const [head, tail] = chain();
		const overrides = getOverflowSegments(tail, [head, tail]);
		// The tail authors no text at all; everything it paints comes from the chain.
		expect(buildParagraphs(tail).flatMap((p) => p.runs.map((r) => r.text))).toStrictEqual([]);
		expect(
			buildParagraphs(tail, undefined, overrides).flatMap((p) => p.runs.map((r) => r.text)),
		).toStrictEqual(['DEFGHIJ']);
	});

	it('keeps the head from painting the successor text as well', () => {
		const [head, tail] = chain();
		const overrides = getOverflowSegments(head, [head, tail]);
		expect(
			buildParagraphs(head, undefined, overrides).flatMap((p) => p.runs.map((r) => r.text)),
		).toStrictEqual(['ABC']);
	});

	it('is a strict no-op when no override is passed', () => {
		const plain = plainBox('p1', [{ text: 'Hello', style: {} }]);
		expect(buildParagraphs(plain, undefined, undefined)).toStrictEqual(buildParagraphs(plain));
	});

	it('still reads paragraph structure from the overridden segments', () => {
		const el = plainBox('p1', [{ text: 'ignored', style: {} }]);
		const paras = buildParagraphs(el, undefined, [
			{ text: 'One', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Two', style: {} },
		]);
		expect(paras.map((p) => p.runs.map((r) => r.text).join(''))).toStrictEqual(['One', 'Two']);
	});
});

describe('buildTextBlockStyle clipping', () => {
	it('clips a chain member so its overflow does not paint twice', () => {
		const [head] = chain();
		expect(buildTextBlockStyle(head).overflow).toBe('hidden');
	});

	it('leaves a normal text box visible', () => {
		expect(buildTextBlockStyle(plainBox('p1', [])).overflow).toBe('visible');
	});

	// A no-wrap body deliberately spills, but a linked box must still clip or the
	// successor's text is drawn by both boxes. React resolves the conflict the
	// same way (its `overflow: hidden` is appended last).
	it('wins over the wrap="none" spill for a linked box', () => {
		const el = linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]);
		el.textStyle = { ...el.textStyle, textWrap: 'none' };
		expect(buildTextBlockStyle(el).overflow).toBe('hidden');
	});
});
