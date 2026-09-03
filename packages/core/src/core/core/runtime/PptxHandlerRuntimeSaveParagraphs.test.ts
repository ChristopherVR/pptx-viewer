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

/** Literal text from every ordinary run in one built paragraph. */
function runTexts(paragraph: XmlObject): string[] {
	const runs = paragraph['a:r'];
	const list = Array.isArray(runs) ? runs : runs ? [runs] : [];
	return list.map((run) => {
		const text = (run as XmlObject)['a:t'];
		return typeof text === 'string'
			? text
			: String((text as XmlObject | undefined)?.['#text'] ?? '');
	});
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

	it('does not flatten rtl onto the empty run of a blank paragraph', () => {
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

/**
 * A blank line is `<a:p><a:pPr/><a:endParaRPr/></a:p>`: PowerPoint sizes it
 * from `a:endParaRPr`, and authors no run at all (§21.1.2.2.7). The writer
 * used to backfill `<a:r><a:rPr/><a:t/></a:r>` into any paragraph that ended
 * up with no runs, inventing a run the source never had and handing it a
 * resolved `a:rPr` to carry.
 */
describe('createParagraphsFromTextContent: a runless paragraph stays runless', () => {
	const runtime = new ParagraphRuntime();
	const segment = (text: string, style?: TextStyle): TextSegment =>
		({ text, style }) as TextSegment;

	it('writes no a:r for a blank paragraph between two others', () => {
		// The parse emits one "\n" separator per paragraph boundary, so a blank
		// middle paragraph arrives as two consecutive separators and contributes
		// no content of its own.
		const paragraphs = runtime.build('a\n\nb', undefined, [
			segment('a'),
			segment('\n'),
			segment('\n'),
			segment('b'),
		]);
		expect(paragraphs).toHaveLength(3);
		expect('a:r' in paragraphs[1]).toBeFalsy();
		// The blank line keeps its size: `a:endParaRPr` is still emitted.
		expect(paragraphs[1]['a:endParaRPr']).toBeDefined();
		// The paragraphs that do have text keep their runs.
		expect(paragraphs[0]['a:r']).toBeDefined();
		expect(paragraphs[2]['a:r']).toBeDefined();
	});

	it('keeps the parsed endParaRPr on the blank paragraph it belongs to', () => {
		const blank = segment('\n');
		(blank as { endParaRunProperties?: Record<string, unknown> }).endParaRunProperties = {
			'@_lang': 'zh-CN',
			'@_sz': '1000',
		};
		const paragraphs = runtime.build('a\n\nb', undefined, [
			segment('a'),
			segment('\n'),
			blank,
			segment('b'),
		]);
		expect('a:r' in paragraphs[1]).toBeFalsy();
		expect((paragraphs[1]['a:endParaRPr'] as XmlObject)['@_sz']).toBe('1000');
	});

	it('still writes the run of a paragraph whose only content is an empty run', () => {
		// PowerPoint really does author `<a:r><a:rPr/><a:t/></a:r>`: 40 of the 84
		// runs in `36_Slides_Extra_Large_*.pptx` are exactly that. A segment is
		// present, so the paragraph is not runless and the run must survive.
		const [paragraph] = runtime.build('', undefined, [segment('')]);
		expect(paragraph['a:r']).toBeDefined();
	});
});

describe('createParagraphsFromTextContent: auto-number marker detection', () => {
	const runtime = new ParagraphRuntime();

	it('keeps real paragraph text that carries runtime numbering metadata', () => {
		const content: TextSegment = {
			text: 'First item',
			style: {},
			bulletInfo: {
				autoNumType: 'arabicPeriod',
				autoNumStartAt: 1,
				paragraphIndex: 0,
			},
		};

		const [paragraph] = runtime.build(content.text, undefined, [content]);

		expect(runTexts(paragraph)).toStrictEqual(['First item']);
		expect((paragraph['a:pPr'] as XmlObject)['a:buAutoNum']).toStrictEqual({
			'@_type': 'arabicPeriod',
		});
	});

	it.each([
		['1.', { autoNumType: 'arabicPeriod' }],
		['• ', { autoNumType: 'arabicPeriod' }],
		[
			'3)',
			{
				autoNumType: 'arabicPeriod',
				autoNumStartAt: 2,
				paragraphIndex: 1,
			},
		],
	] as const)('keeps marker-like content %s that was not generated', (text, bulletInfo) => {
		const content: TextSegment = { text, style: {}, bulletInfo };

		const [paragraph] = runtime.build(content.text, undefined, [content]);

		expect(runTexts(paragraph)).toStrictEqual([text]);
	});

	it.each([
		['arabicPeriod', 2, 1, '3.'],
		['arabicPeriod', 2, 1, '3. '],
		['hindiNumPeriod', 21, 0, '२१. '],
	] as const)(
		'drops only the exact generated %s marker and preserves its content run',
		(autoNumType, autoNumStartAt, paragraphIndex, markerText) => {
			const bulletInfo = { autoNumType, autoNumStartAt, paragraphIndex };
			const [paragraph] = runtime.build(`${markerText}Item`, undefined, [
				{ text: markerText, style: {}, bulletInfo },
				{ text: 'Item', style: {} },
			]);

			expect(runTexts(paragraph)).toStrictEqual(['Item']);
			expect((paragraph['a:pPr'] as XmlObject)['a:buAutoNum']).toStrictEqual({
				'@_type': autoNumType,
				'@_startAt': String(autoNumStartAt),
			});
		},
	);
});
