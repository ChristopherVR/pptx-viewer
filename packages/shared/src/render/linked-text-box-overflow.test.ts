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
