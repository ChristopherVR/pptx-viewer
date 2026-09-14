/**
 * text-style-update.test.ts: the ONE element patch every binding's
 * text-style update path applies, selection-aware.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyTextStyleUpdate } from './text-style-update';

const seg = (text: string, style: TextSegment['style'] = {}): TextSegment => ({ text, style });

const textElement = (segments: TextSegment[], textStyle: PptxElement['textStyle'] = {}) =>
	({
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: segments.map((s) => s.text).join(''),
		textStyle,
		textSegments: segments,
	}) as unknown as PptxElement;

type TextPatch = { textStyle?: PptxElement['textStyle']; textSegments?: TextSegment[] };

describe('applyTextStyleUpdate with an inline selection', () => {
	const selection = { startSegIdx: 0, startOffset: 6, endSegIdx: 0, endOffset: 11 };

	it('writes body-level keys to element.textStyle instead of the selected runs', () => {
		const el = textElement([seg('Hello world')], { paragraphMarginLeft: 0 });
		const { patch } = applyTextStyleUpdate(el, { paragraphMarginLeft: 24 }, selection);
		const p = patch as TextPatch;
		expect(p.textStyle?.paragraphMarginLeft).toBe(24);
		expect(p.textSegments?.map((s) => s.text)).toStrictEqual(['Hello world']);
		expect(p.textSegments?.some((s) => 'paragraphMarginLeft' in s.style)).toBeFalsy();
	});

	it('routes run-level keys through the selection and remaps it', () => {
		const el = textElement([seg('Hello world')]);
		const { patch, newSelection } = applyTextStyleUpdate(el, { bold: true }, selection);
		const p = patch as TextPatch;
		expect(p.textSegments?.map((s) => [s.text, Boolean(s.style.bold)])).toStrictEqual([
			['Hello ', false],
			['world', true],
		]);
		expect(newSelection).toStrictEqual({
			startSegIdx: 1,
			startOffset: 0,
			endSegIdx: 1,
			endOffset: 5,
		});
		// Mixed after the edit: the body flag must not claim the whole box is bold.
		expect(p.textStyle?.bold).toBeFalsy();
	});

	it('clears the body decoration when a run is un-underlined so CSS stops painting it', () => {
		const el = textElement([seg('Hello '), seg('world')], { underline: true });
		const { patch } = applyTextStyleUpdate(
			el,
			{ underline: false },
			{ startSegIdx: 1, startOffset: 0, endSegIdx: 1, endOffset: 5 },
		);
		const p = patch as TextPatch;
		expect(p.textStyle?.underline).toBeUndefined();
		expect(p.textSegments?.[0].style.underline).toBeTruthy();
		expect(p.textSegments?.[1].style.underline).toBeFalsy();
	});

	it('promotes the body flag when the edit makes every run agree', () => {
		const el = textElement([seg('Hello ', { bold: true }), seg('world')]);
		const { patch } = applyTextStyleUpdate(
			el,
			{ bold: true },
			{ startSegIdx: 1, startOffset: 0, endSegIdx: 1, endOffset: 5 },
		);
		expect((patch as TextPatch).textStyle?.bold).toBeTruthy();
	});

	it('uses the live segment override when one is supplied', () => {
		const el = textElement([seg('stale')]);
		const { patch } = applyTextStyleUpdate(el, { italic: true }, selection, [seg('Hello world')]);
		expect((patch as TextPatch).textSegments?.map((s) => s.text)).toStrictEqual([
			'Hello ',
			'world',
		]);
	});
});

describe('applyTextStyleUpdate without a selection', () => {
	it('applies every key to the body and to every run, as before', () => {
		const el = textElement([seg('a'), seg('b')], { fontSize: 18 });
		const { patch, newSelection } = applyTextStyleUpdate(
			el,
			{ bold: true, lineSpacing: 1.5 },
			null,
		);
		const p = patch as TextPatch;
		expect(p.textStyle).toStrictEqual({ fontSize: 18, bold: true, lineSpacing: 1.5 });
		expect(p.textSegments?.every((s) => s.style.bold && s.style.lineSpacing === 1.5)).toBeTruthy();
		expect(newSelection).toBeNull();
	});

	it('omits textSegments when the element carries none', () => {
		const el = { ...textElement([]), textSegments: undefined } as unknown as PptxElement;
		expect(applyTextStyleUpdate(el, { bold: true }, null).patch).toStrictEqual({
			textStyle: { bold: true },
		});
	});

	it('is an empty patch for an element without text properties', () => {
		const table = { type: 'table', id: 'tb', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(applyTextStyleUpdate(table, { bold: true }, null).patch).toStrictEqual({});
	});
});
