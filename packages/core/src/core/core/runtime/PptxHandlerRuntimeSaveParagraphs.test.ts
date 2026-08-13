import { describe, it, expect } from 'vitest';

import type { TextSegment, TextStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

/**
 * Regression coverage against the REAL `createParagraphsFromTextContent`.
 *
 * `rtl` is the one model field that means two different things on the same
 * slot. On an ELEMENT `textStyle` it is the paragraph direction: it is parsed
 * from `a:pPr/@rtl` (`CT_TextParagraphProperties`), it is edited alongside
 * `align` / `paragraphIndent` in the shared text-advanced panel, and
 * `resolveParagraphRtl` reads it as the paragraph default a run overrides. On a
 * RUN it is `<a:rtl val="..."/>`, a child of `CT_TextCharacterProperties`.
 *
 * The element style is spread into every run before serialisation, so leaving
 * the paragraph direction in it flattened one paragraph-level fact onto each of
 * its runs. Measured on `Non_Latin_Arabic_RTL_text_11_Slides_7_3_MB_*.pptx`, a
 * no-edit round-trip turned 0 authored run-level `<a:rtl>` elements into 52.
 */
class ParagraphRuntime extends PptxHandlerRuntime {
	public build(
		text: string | undefined,
		textStyle: TextStyle | undefined,
		segments: TextSegment[] | undefined,
	): XmlObject[] {
		return this.createParagraphsFromTextContent(text, textStyle, segments);
	}
}

/** Every `a:rPr` reachable inside one built `a:p`, runs and fields alike. */
function runProperties(paragraph: XmlObject): XmlObject[] {
	const runs = paragraph['a:r'];
	const list = Array.isArray(runs) ? runs : runs ? [runs] : [];
	return list
		.map((run) => (run as XmlObject)['a:rPr'])
		.filter((rPr): rPr is XmlObject => Boolean(rPr) && typeof rPr === 'object');
}

describe('createParagraphsFromTextContent: paragraph direction is not flattened onto runs', () => {
	const runtime = new ParagraphRuntime();
	const segment = (text: string, style?: TextStyle): TextSegment =>
		({ text, style }) as TextSegment;

	it('writes an element-level rtl as a:pPr/@rtl only', () => {
		const [paragraph] = runtime.build('مرحبا', { rtl: true } as TextStyle, [segment('مرحبا')]);
		expect((paragraph['a:pPr'] as XmlObject)['@_rtl']).toBe('1');
		for (const rPr of runProperties(paragraph)) {
			expect(rPr['a:rtl']).toBeUndefined();
		}
	});

	it('writes an element-level explicit LTR as a:pPr/@rtl="0" only', () => {
		const [paragraph] = runtime.build('hello', { rtl: false } as TextStyle, [segment('hello')]);
		expect((paragraph['a:pPr'] as XmlObject)['@_rtl']).toBe('0');
		for (const rPr of runProperties(paragraph)) {
			expect(rPr['a:rtl']).toBeUndefined();
		}
	});

	it('keeps a:rtl on a run that authored one itself', () => {
		// A run-authored `<a:rtl>` arrives on `segment.style`, which is spread
		// after the element style, so the run-only fact still reaches `a:rPr`.
		const [paragraph] = runtime.build('مرحبا', { rtl: false } as TextStyle, [
			segment('مرحبا', { rtl: true } as TextStyle),
		]);
		expect((paragraph['a:pPr'] as XmlObject)['@_rtl']).toBe('0');
		const [rPr] = runProperties(paragraph);
		expect(rPr['a:rtl']).toStrictEqual({ '@_val': '1' });
	});

	it('does not flatten rtl onto the plain-text (segmentless) path', () => {
		const [paragraph] = runtime.build('مرحبا', { rtl: true } as TextStyle, undefined);
		expect((paragraph['a:pPr'] as XmlObject)['@_rtl']).toBe('1');
		for (const rPr of runProperties(paragraph)) {
			expect(rPr['a:rtl']).toBeUndefined();
		}
	});

	it('does not flatten rtl onto the backfilled empty run of a blank paragraph', () => {
		const [paragraph] = runtime.build('', { rtl: true } as TextStyle, [segment('')]);
		expect((paragraph['a:pPr'] as XmlObject)['@_rtl']).toBe('1');
		for (const rPr of runProperties(paragraph)) {
			expect(rPr['a:rtl']).toBeUndefined();
		}
	});

	it('still propagates the other uniform element-level styles onto runs', () => {
		// `computeUniformSegmentOverrides` now receives the run-scoped style. Only
		// `rtl` may be missing from it; an element-level bold/size edit must still
		// reach a previously uniform run.
		const [paragraph] = runtime.build(
			'hello',
			{ rtl: true, bold: true, fontSize: 24 } as TextStyle,
			[segment('hello')],
		);
		const [rPr] = runProperties(paragraph);
		expect(rPr['@_b']).toBe('1');
		expect(rPr['@_sz']).toBeDefined();
		expect(rPr['a:rtl']).toBeUndefined();
	});

	it('keeps a per-paragraph rtl from segment.paragraphProperties on a:pPr', () => {
		const first = segment('one');
		(first as { paragraphProperties?: TextStyle }).paragraphProperties = {
			rtl: true,
		} as TextStyle;
		const [paragraph] = runtime.build('one', { rtl: false } as TextStyle, [first]);
		expect((paragraph['a:pPr'] as XmlObject)['@_rtl']).toBe('1');
		for (const rPr of runProperties(paragraph)) {
			expect(rPr['a:rtl']).toBeUndefined();
		}
	});
});
