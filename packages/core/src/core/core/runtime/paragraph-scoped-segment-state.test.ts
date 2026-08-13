import { describe, it, expect } from 'vitest';

import type { PptxElementWithText, TextSegment, TextStyle, XmlObject } from '../../types';
import { preserveParagraphScopedState } from './paragraph-scoped-segment-state';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

/**
 * Regression coverage for the uniform-run collapse in the REAL
 * `applyTextBodyContent`.
 *
 * A text body whose runs all share one style is saved from the flat
 * `element.text` string so an edit to that string wins over stale segments.
 * That collapse used to set `textSegmentsForSave = undefined`, which threw away
 * the paragraph-scope state the segments carry (`paragraphProperties`,
 * `endParaRunProperties`, `paragraphLevel`, `bulletInfo`) because the
 * segmentless code path supplies none. Every authored `a:pPr` came back from a
 * round-trip as a bare `<a:pPr/>`.
 *
 * Measured on the fixture corpus, a no-edit round-trip lost these `a:pPr`
 * attribute instances across `ppt/slides/*` before the fix / after it:
 * Arabic RTL 150/60, 36-slide deck 50/34, Slide_Animations 48/36,
 * Japanese 34/26, Simplified Chinese 38/26. Every remaining difference is
 * `lvl="0"`, which the writer omits deliberately (it is the schema default and
 * PowerPoint omits it too). The 36-slide deck also lost all 9 of its `a:br`
 * soft line breaks, which now survive.
 */
class TextBodyRuntime extends PptxHandlerRuntime {
	public writeTextBody(el: PptxElementWithText): XmlObject[] {
		const shape: XmlObject = {};
		this.applyTextBodyContent(
			shape,
			el,
			() => undefined,
			() => new Map<string, string>(),
		);
		const txBody = shape['p:txBody'] as XmlObject;
		const paragraphs = txBody['a:p'];
		return Array.isArray(paragraphs) ? (paragraphs as XmlObject[]) : [paragraphs as XmlObject];
	}
}

const runtime = new TextBodyRuntime();

function element(
	text: string,
	textStyle: TextStyle,
	textSegments: TextSegment[],
): PptxElementWithText {
	return {
		id: 'el',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		text,
		textStyle,
		textSegments,
	} as unknown as PptxElementWithText;
}

function pPr(paragraph: XmlObject): XmlObject {
	return paragraph['a:pPr'] as XmlObject;
}

/** A run style shared by every segment, so the body reads as "uniform". */
const SHARED: TextStyle = { fontSize: 18 };

describe('applyTextBodyContent: the uniform-run collapse keeps paragraph scope', () => {
	it('keeps each paragraph its own a:pPr/@algn', () => {
		const paragraphs = runtime.writeTextBody(
			element('Left\nRight', { ...SHARED, align: 'left' }, [
				{ text: 'Left', style: SHARED, paragraphProperties: { align: 'left' } },
				{ text: '\n', style: SHARED, isParagraphBreak: true },
				{ text: 'Right', style: SHARED, paragraphProperties: { align: 'right' } },
			]),
		);
		expect(paragraphs).toHaveLength(2);
		expect(pPr(paragraphs[0])['@_algn']).toBe('l');
		// Was 'l': the second paragraph's own alignment went out with the
		// discarded segment list and the shape-level style took its place.
		expect(pPr(paragraphs[1])['@_algn']).toBe('r');
	});

	it('keeps per-paragraph margins, indent and spacing', () => {
		const paragraphs = runtime.writeTextBody(
			element('Flush\nIndented', SHARED, [
				{ text: 'Flush', style: SHARED, paragraphProperties: { paragraphMarginLeft: 0 } },
				{ text: '\n', style: SHARED, isParagraphBreak: true },
				{
					text: 'Indented',
					style: SHARED,
					paragraphProperties: { paragraphMarginLeft: 48, paragraphIndent: -18 },
				},
			]),
		);
		expect(pPr(paragraphs[0])['@_marL']).toBe('0');
		expect(pPr(paragraphs[1])['@_marL']).toBe(String(48 * 9525));
		expect(pPr(paragraphs[1])['@_indent']).toBe(String(-18 * 9525));
	});

	it('re-emits the authored a:endParaRPr instead of the lang stub', () => {
		const [paragraph] = runtime.writeTextBody(
			element('Only', SHARED, [
				{
					text: 'Only',
					style: SHARED,
					paragraphProperties: { align: 'center' },
					endParaRunProperties: { '@_lang': 'en-GB', '@_sz': '2400', '@_dirty': '0' },
				},
			]),
		);
		expect(paragraph['a:endParaRPr']).toStrictEqual({
			'@_lang': 'en-GB',
			'@_sz': '2400',
			'@_dirty': '0',
		});
	});

	it('keeps a soft line break as a:br inside one paragraph', () => {
		// The flat string spells `a:br` "\n", exactly as it spells a paragraph
		// terminator, so rebuilding from it split the paragraph in two and the
		// break was gone.
		const paragraphs = runtime.writeTextBody(
			element('one\ntwo', SHARED, [
				{ text: 'one', style: SHARED, paragraphProperties: { align: 'center' } },
				{ text: '\n', style: SHARED, isLineBreak: true },
				{ text: 'two', style: SHARED },
			]),
		);
		expect(paragraphs).toHaveLength(1);
		expect(paragraphs[0]['a:br']).toBeDefined();
	});

	it('still lets an edited element.text win over stale segments', () => {
		const paragraphs = runtime.writeTextBody(
			element('EDITED\nRight', { ...SHARED, align: 'left' }, [
				{ text: 'Left', style: SHARED, paragraphProperties: { align: 'left' } },
				{ text: '\n', style: SHARED, isParagraphBreak: true },
				{ text: 'Right', style: SHARED, paragraphProperties: { align: 'right' } },
			]),
		);
		const firstRun = paragraphs[0]['a:r'] as XmlObject;
		expect(firstRun['a:t']).toBe('EDITED');
		expect(pPr(paragraphs[1])['@_algn']).toBe('r');
	});

	it('leaves a body that never had paragraph state byte-identical', () => {
		const withSegments = runtime.writeTextBody(
			element('plain', SHARED, [{ text: 'plain', style: SHARED }]),
		);
		const withoutSegments = runtime.writeTextBody(
			element('plain', SHARED, []) as PptxElementWithText,
		);
		expect(withSegments).toStrictEqual(withoutSegments);
	});
});

describe('preserveParagraphScopedState', () => {
	it('returns the base list untouched when there is nothing to preserve', () => {
		expect(
			preserveParagraphScopedState(undefined, 'a\nb', [{ text: 'a\nb', style: {} }]),
		).toBeUndefined();
	});

	it('returns the base list untouched when there are no source segments', () => {
		expect(preserveParagraphScopedState(undefined, 'a', undefined)).toBeUndefined();
		expect(preserveParagraphScopedState(undefined, 'a', [])).toBeUndefined();
	});

	it('rebuilds one state-carrying segment per paragraph of the flat text', () => {
		const rebuilt = preserveParagraphScopedState(undefined, 'a\nb\nc', [
			{ text: 'a', style: {}, paragraphProperties: { align: 'left' } },
			{ text: '\n', style: {} },
			{ text: 'b', style: {}, paragraphLevel: 2 },
			{ text: '\n', style: {} },
			{ text: 'c', style: {}, paragraphProperties: { align: 'right' } },
		]);
		expect(rebuilt?.map((segment) => segment.text)).toStrictEqual(['a\n', 'b\n', 'c']);
		expect(rebuilt?.[0].paragraphProperties).toStrictEqual({ align: 'left' });
		expect(rebuilt?.[1].paragraphLevel).toBe(2);
		expect(rebuilt?.[2].paragraphProperties).toStrictEqual({ align: 'right' });
	});

	it('does not invent state for paragraphs an edit added', () => {
		const rebuilt = preserveParagraphScopedState(undefined, 'a\nb\nEXTRA', [
			{ text: 'a', style: {}, paragraphProperties: { align: 'left' } },
			{ text: '\n', style: {} },
			{ text: 'b', style: {}, paragraphProperties: { align: 'right' } },
		]);
		expect(rebuilt?.[2].paragraphProperties).toBeUndefined();
	});

	it('carries state onto a style-remapped run list without clobbering it', () => {
		const remapped: TextSegment[] = [
			{ text: 'bo', style: { bold: true } },
			{ text: 'ld\n', style: {} },
			{ text: 'next', style: {} },
		];
		const result = preserveParagraphScopedState(remapped, 'bold\nnext', [
			{ text: 'bold', style: {}, paragraphProperties: { align: 'center' } },
			{ text: '\n', style: {} },
			{ text: 'next', style: {}, paragraphProperties: { align: 'right' } },
		]);
		expect(result?.[0].paragraphProperties).toStrictEqual({ align: 'center' });
		expect(result?.[0].style).toStrictEqual({ bold: true });
		expect(result?.[1].paragraphProperties).toBeUndefined();
		expect(result?.[2].paragraphProperties).toStrictEqual({ align: 'right' });
	});

	it('ignores a zero outline level, which is the schema default', () => {
		expect(
			preserveParagraphScopedState(undefined, 'a', [{ text: 'a', style: {}, paragraphLevel: 0 }]),
		).toBeUndefined();
	});
});
