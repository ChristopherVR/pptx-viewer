import JSZip from 'jszip';
import { hasTextProperties, PptxHandler, PresentationBuilder } from 'pptx-viewer-core';
import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { remapTextToSegments } from './remap-text';
import { buildParagraphs } from './text-paragraphs';

const asBuffer = (bytes: Uint8Array): ArrayBuffer =>
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

async function paragraphXml(bytes: Uint8Array, body: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const paragraph = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/gu)].find((match) =>
		match[0].includes(`>${body}<`),
	);
	expect(paragraph, `missing native paragraph ${body}`).toBeDefined();
	return paragraph![0].match(/<a:pPr\b[\s\S]*?<\/a:pPr>/u)?.[0] ?? '';
}

describe('remapped paragraph provenance save/reload', () => {
	it.each([
		['First\nInserted\nLast', false],
		['Last', false],
		['First\nInserted\nLast', true],
		['Last', true],
	] as const)(
		'preserves surviving paragraph XML after %s (numbered=%s)',
		async (text, numbered) => {
			const { handler: seedHandler, data: seed, createSlide } = await PresentationBuilder.create();
			const slide = createSlide('Blank')
				.addText('First\nLast', { x: 40, y: 40, width: 300, height: 160 })
				.build();
			const element = slide.elements[0];
			if (!hasTextProperties(element)) {
				throw new Error('expected text');
			}
			const paragraph = (body: string, after: number): TextSegment => ({
				text: body,
				style: { fontSize: 20, fontFamily: 'Arial', color: '#CC6600' },
				bulletInfo: {
					...(numbered ? { autoNumType: 'romanUcPeriod', autoNumStartAt: 4 } : { char: '◆' }),
					fontFamily: 'Arial',
					color: '#CC6600',
				},
				paragraphLevel: 1,
				paragraphProperties: {
					paragraphSpacingBefore: 10,
					paragraphSpacingAfter: after,
					lineSpacing: 1.25,
				},
				endParaRunProperties: { '@_sz': '2000' },
			});
			element.textSegments = [
				paragraph('First', 14),
				{ text: '\n', style: {}, isParagraphBreak: true },
				paragraph('Last', 5),
			];
			seed.slides.push(slide);
			const initial = await seedHandler.save(seed.slides);
			const handler = new PptxHandler();
			const loaded = await handler.load(asBuffer(initial));
			const source = loaded.slides[0].elements[0];
			if (!hasTextProperties(source)) {
				throw new Error('expected loaded text');
			}
			const sourceLast = source.textSegments?.find((segment) => segment.text === 'Last');
			const edited = {
				...source,
				text,
				textSegments: remapTextToSegments(text, source.textSegments, source.textStyle),
			};
			const saved = await handler.save([
				{ ...loaded.slides[0], isDirty: true, elements: [edited] },
			]);
			const originalProperties = await paragraphXml(initial, 'Last');
			expect(originalProperties).toContain('a:spcAft');
			expect(originalProperties).toContain(numbered ? 'a:buAutoNum' : 'a:buChar');
			await expect(paragraphXml(saved, 'Last')).resolves.toBe(originalProperties);
			const reloaded = await new PptxHandler().load(asBuffer(saved));
			const result = reloaded.slides[0].elements[0];
			if (!hasTextProperties(result)) {
				throw new Error('expected reloaded text');
			}
			expect(result.textSegments?.find((segment) => segment.text === 'Last')?.style).toStrictEqual(
				sourceLast?.style,
			);
			const bodies = result.textSegments
				?.filter((segment) => !segment.bulletInfo && segment.text !== '\n')
				.map((segment) => segment.text);
			expect(bodies).toStrictEqual(text.split('\n'));
			expect(buildParagraphs(result).map((item) => item.bulletMarker)).toStrictEqual(
				buildParagraphs(edited).map((item) => item.bulletMarker),
			);
		},
		30_000,
	);
});

function seg(text: string, style: TextStyle = {}): TextSegment {
	return { text, style };
}

function breakSeg(style: TextStyle = {}): TextSegment {
	return { text: '\n', style, isParagraphBreak: true };
}

describe('remapTextToSegments', () => {
	describe('unchanged paragraph provenance', () => {
		it('bounds interior alignment work and retains positional fallback for oversized ambiguous ranges', () => {
			const source: TextSegment[] = Array.from({ length: 102 }, (_, index) => ({
				text: `Body ${index}`,
				style: {},
				paragraphProperties: { paragraphSpacingAfter: index },
			}));
			const original = source.flatMap((item, index) => (index ? [breakSeg(), item] : [item]));
			const edited = [
				'Body 0',
				'Inserted',
				...source.slice(1, -1).map((item) => item.text),
				'Changed end',
			];
			const result = remapTextToSegments(edited.join('\n'), original, {}).filter(
				(item) => !item.isParagraphBreak,
			);
			expect(result.map((item) => item.text)).toStrictEqual(edited);
			expect(result[0]).toStrictEqual(source[0]);
			expect(result[1].paragraphProperties).toStrictEqual(source[1].paragraphProperties);
			expect(result.at(-1)?.paragraphProperties).toBeUndefined();
		});

		const paragraph = (text: string, index: number): TextSegment =>
			Object.freeze({
				text,
				style: Object.freeze({
					fontSize: 18 + index,
					color: index ? '#009900' : '#cc3300',
					bold: Boolean(index),
				}),
				bulletInfo: Object.freeze({ char: index ? '◆' : '»', fontFamily: 'Arial' }),
				paragraphLevel: index,
				paragraphProperties: Object.freeze({
					paragraphSpacingBefore: 6 + index,
					paragraphSpacingAfter: 14 - index,
					lineSpacing: 1.25,
				}),
				endParaRunProperties: Object.freeze({ '@_sz': String(1800 + index * 100) }),
			});
		const group = (segments: TextSegment[]) => {
			const paragraphs: TextSegment[][] = [[]];
			for (const segment of segments) {
				if (segment.isParagraphBreak || segment.text === '\n') {
					paragraphs.push([]);
				} else {
					paragraphs.at(-1)!.push(segment);
				}
			}
			return paragraphs;
		};

		it('keeps an unchanged suffix after a middle insertion without donating its paragraph metadata', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const result = group(
				remapTextToSegments('First\nInserted\nLast', [first, breakSeg(), last], {}),
			);
			expect(result[0][0]).toStrictEqual(first);
			expect(result[2][0]).toStrictEqual(last);
			expect(result[1][0].paragraphProperties).toBeUndefined();
			expect(result[1][0].endParaRunProperties).toBeUndefined();
			expect(result[1][0].paragraphLevel).toBeUndefined();
		});

		it('keeps surviving rich paragraphs after deleting the first paragraph', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			expect(remapTextToSegments('Last', [first, breakSeg(), last], {})).toStrictEqual([last]);
		});

		it.each(['Fir\nst\nLast', 'Joined\nLast'])(
			'keeps the suffix for split/join text %s',
			(text) => {
				const last = paragraph('Last', 2);
				const source = text.startsWith('Joined')
					? [paragraph('First', 0), breakSeg(), paragraph('Second', 1), breakSeg(), last]
					: [paragraph('First', 0), breakSeg(), last];
				expect(group(remapTextToSegments(text, source, {})).at(-1)![0]).toStrictEqual(last);
			},
		);

		it('matches duplicate body text from the corresponding ends, not the first global match', () => {
			const first = paragraph('Same', 0),
				last = paragraph('Same', 1);
			const result = group(
				remapTextToSegments('Same\nInserted\nSame', [first, breakSeg(), last], {}),
			);
			expect(result[0][0]).toStrictEqual(first);
			expect(result[2][0]).toStrictEqual(last);
			// Deleting an indistinguishable duplicate retains the first prefix deterministically.
			expect(remapTextToSegments('Same', [first, breakSeg(), last], {})).toStrictEqual([first]);
		});

		it('preserves a shifted empty paragraph whose metadata rides its terminator', () => {
			const empty = { ...paragraph('\n', 2), isParagraphBreak: true };
			const last = paragraph('Last', 1);
			const source = [paragraph('First', 0), breakSeg(), empty, last];
			const result = group(remapTextToSegments('First\nInserted\n\nLast', source, {}));
			expect(result[2][0].paragraphProperties).toBe(empty.paragraphProperties);
			expect(result[2][0].paragraphLevel).toBe(2);
			expect(result[3][0]).toStrictEqual(last);
		});

		it('matches body text while retaining a proven dedicated display marker', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const marker = { ...last, text: '◆ ' };
			const body = { text: 'Last', style: { italic: true } };
			const result = group(
				remapTextToSegments('First\nInserted\nLast', [first, breakSeg(), marker, body], {}),
			);
			expect(result[2]).toStrictEqual([marker, body]);
		});

		it('keeps no-op and append-only noninheritance controls', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const source = [first, breakSeg(first.style), last];
			expect(remapTextToSegments('First\nLast', source, {})).toStrictEqual(source);
			const appended = group(remapTextToSegments('First\nLast\nAppended', source, {}));
			expect(appended[1][0]).toStrictEqual(last);
			expect(appended[2][0].paragraphProperties).toBeUndefined();
			expect(appended[2][0].endParaRunProperties).toBeUndefined();
		});

		it('keeps leading and trailing blank paragraph provenance', () => {
			const leading = { ...paragraph('\n', 0), isParagraphBreak: true };
			const trailing = paragraph('', 2);
			const result = group(
				remapTextToSegments('First\n', [leading, paragraph('First', 1), breakSeg(), trailing], {}),
			);
			expect(result[0][0]).toStrictEqual(paragraph('First', 1));
			expect(result[1][0]).toStrictEqual(trailing);
			const inserted = group(
				remapTextToSegments('First\nInserted\n', [paragraph('First', 1), breakSeg(), trailing], {}),
			);
			expect(inserted[2][0]).toStrictEqual(trailing);
		});

		it('retains literal marker-like body text without a proven display-marker index', () => {
			const literal = { ...paragraph('1.', 1), bulletInfo: { autoNumType: 'arabicPeriod' } };
			const result = group(
				remapTextToSegments(
					'First\nInserted\n1.',
					[paragraph('First', 0), breakSeg(), literal],
					{},
				),
			);
			expect(result[2][0]).toStrictEqual(literal);
		});

		it('does not treat a long middle insertion as an appended numbered continuation', () => {
			const marker: TextSegment = {
				text: 'IV.',
				style: {},
				paragraphLevel: 2,
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 0 },
				paragraphProperties: { paragraphSpacingAfter: 12 },
			};
			const source = [paragraph('First', 0), breakSeg(), marker, seg('Last')];
			const result = group(remapTextToSegments('First\nA\nB\nC\nLast', source, {}));
			expect(result[4][0]).toStrictEqual(marker);
			for (const [index, inserted] of result.slice(1, 4).entries()) {
				expect(inserted[0].paragraphLevel).toBeUndefined();
				expect(inserted[0].paragraphProperties).toBeUndefined();
				expect(inserted[0].bulletInfo?.paragraphIndex).toBe(index);
			}
		});

		it('renumbers a shifted suffix without changing its authored numbering or run metadata', () => {
			const first: TextSegment = {
				text: 'IV.',
				style: { fontSize: 24 },
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 0 },
			};
			const last: TextSegment = {
				...paragraph('V.', 0),
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 1 },
			};
			const source = [first, seg('First'), breakSeg(), last, seg('Last')];
			const deleted = remapTextToSegments('Last', source, {});
			expect(deleted[0]).toStrictEqual({
				...last,
				text: 'IV.',
				bulletInfo: { ...last.bulletInfo, paragraphIndex: 0 },
			});
			const inserted = group(remapTextToSegments('First\nInserted\nLast', source, {}));
			expect(inserted[2][0]).toStrictEqual({
				...last,
				text: 'VI.',
				bulletInfo: { ...last.bulletInfo, paragraphIndex: 2 },
			});
			expect(source[3]).toBe(last);
		});

		it('does not count suppressed paragraphs in a surviving numbered sequence', () => {
			const hidden: TextSegment = {
				text: 'Suppressed',
				style: { listType: 'none' },
				bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
			};
			const marker: TextSegment = {
				text: '2.',
				style: {},
				bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 1 },
			};
			const result = remapTextToSegments(
				'Suppressed\nLast',
				[seg('Heading'), breakSeg(), hidden, breakSeg(), marker, seg('Last')],
				{},
			);
			expect(group(result)[1][0]).toStrictEqual({
				...marker,
				text: '1.',
				bulletInfo: { ...marker.bulletInfo, paragraphIndex: 0 },
			});
			expect(result[0]).toStrictEqual(hidden);
		});

		it('keeps positional fallback in a wholly replaced ambiguous region', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const result = group(
				remapTextToSegments('New first\nNew last', [first, breakSeg(), last], {}),
			);
			expect(result[0][0]).toStrictEqual({ ...first, text: 'New first' });
			expect(result[1][0]).toStrictEqual({ ...last, text: 'New last' });
		});
	});

	describe('fallback behaviour', () => {
		it('returns single segment with fallback style when no original segments', () => {
			const result = remapTextToSegments('Hello', undefined, { bold: true });
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('Hello');
			expect(result[0].style.bold).toBeTruthy();
		});

		it('returns single segment when original segments array is empty', () => {
			const result = remapTextToSegments('Hello', [], { italic: true });
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('Hello');
			expect(result[0].style.italic).toBeTruthy();
		});

		it('uses empty style when no elementTextStyle provided', () => {
			const result = remapTextToSegments('Hello', undefined, undefined);
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('Hello');
		});
	});

	describe('single paragraph remapping', () => {
		it('preserves styles from original segments', () => {
			const original = [seg('Hello', { bold: true }), seg(' World', { italic: true })];
			const result = remapTextToSegments('Hello World', original, {});
			expect(result).toHaveLength(2);
			expect(result[0].style.bold).toBeTruthy();
			expect(result[1].style.italic).toBeTruthy();
		});

		it('distributes text proportionally across segments', () => {
			const original = [seg('AB', { bold: true }), seg('CDE', { italic: true })];
			const result = remapTextToSegments('XYZWQ', original, {});
			expect(result[0].text).toBe('XY');
			expect(result[1].text).toBe('ZWQ');
		});

		it('handles shorter new text', () => {
			const original = [seg('Hello', { bold: true }), seg(' World', { italic: true })];
			const result = remapTextToSegments('Hi', original, {});
			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result[0].text).toBe('Hi');
			expect(result[0].style.bold).toBeTruthy();
		});

		it('handles empty new text', () => {
			const original = [seg('Hello', { bold: true })];
			const result = remapTextToSegments('', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('');
		});

		it('handles original segments with empty text', () => {
			const original = [seg('', { bold: true })];
			const result = remapTextToSegments('New text', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('New text');
			expect(result[0].style.bold).toBeTruthy();
		});
	});

	describe('multi-paragraph remapping', () => {
		it('splits new text by newlines and remaps each paragraph', () => {
			const original = [seg('Line 1', { bold: true }), breakSeg(), seg('Line 2', { italic: true })];
			const result = remapTextToSegments('AAA\nBBB', original, {});
			const texts = result.map((s) => s.text);
			expect(texts).toContain('\n');
			expect(result[0].text).toBe('AAA');
			expect(result[0].style.bold).toBeTruthy();
			expect(result[1].isParagraphBreak).toBeTruthy();
			expect(result[2].text).toBe('BBB');
			expect(result[2].style.italic).toBeTruthy();
		});

		it('handles more new paragraphs than original', () => {
			const original = [seg('One', { bold: true })];
			const result = remapTextToSegments('A\nB\nC', original, {});
			const breaks = result.filter((s) => s.isParagraphBreak);
			expect(breaks).toHaveLength(2);
		});

		it('handles fewer new paragraphs than original', () => {
			const original = [
				seg('P1', { bold: true }),
				breakSeg(),
				seg('P2', { italic: true }),
				breakSeg(),
				seg('P3', {}),
			];
			const result = remapTextToSegments('OnlyOne', original, {});
			const breaks = result.filter((s) => s.isParagraphBreak);
			expect(breaks).toHaveLength(0);
			expect(result[0].text).toBe('OnlyOne');
		});
	});

	describe('bullet info preservation', () => {
		it('preserves bulletInfo on the first segment of a paragraph', () => {
			const bulletInfo = { type: 'numbered' };
			const original: TextSegment[] = [{ text: 'Item 1', style: { bold: true }, bulletInfo }];
			const result = remapTextToSegments('New item', original, {});
			expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
		});

		it.each(['1.Item edited', '1. Item edited'])(
			'removes the rendered number from edited text %j without consuming content',
			(newText) => {
				const bulletInfo = {
					autoNumType: 'arabicPeriod',
					autoNumStartAt: 1,
					paragraphIndex: 0,
				};
				const original: TextSegment[] = [{ text: '1. ', style: {}, bulletInfo }, seg('Item')];
				const result = remapTextToSegments(newText, original, {});

				expect(result.map((segment) => segment.text)).toStrictEqual(['1. ', 'Item edited']);
				expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
			},
		);

		it('removes a rendered character bullet without consuming content', () => {
			const bulletInfo = { char: '•' };
			const original: TextSegment[] = [{ text: '• ', style: {}, bulletInfo }, seg('Item')];
			const result = remapTextToSegments('•Item edited', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['• ', 'Item edited']);
			expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
		});

		it.each(['1. Item edited', '1.  Item edited'])(
			'preserves an authored leading space in edited text %j',
			(newText) => {
				const bulletInfo = { autoNumType: 'arabicPeriod', paragraphIndex: 0 };
				const original: TextSegment[] = [{ text: '1. ', style: {}, bulletInfo }, seg(' Item')];
				const result = remapTextToSegments(newText, original, {});

				expect(result.map((segment) => segment.text)).toStrictEqual(['1. ', ' Item edited']);
			},
		);

		it('keeps paragraph metadata on the marker and content styles on their runs', () => {
			const paragraphProperties = { paragraphSpacingBefore: 8 };
			const endParaRunProperties = { '@_sz': '1800' };
			const original: TextSegment[] = [
				{
					text: '1. ',
					style: { color: '#FF0000' },
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
					paragraphLevel: 2,
					paragraphProperties,
					endParaRunProperties,
				},
				seg('Bold', { bold: true }),
				seg(' plain', { italic: true }),
			];
			const result = remapTextToSegments('1.Bold plus plain', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['1. ', 'Bold', ' plus plain']);
			expect(result[0].paragraphLevel).toBe(2);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[0].endParaRunProperties).toBe(endParaRunProperties);
			expect(result[1].style.bold).toBeTruthy();
			expect(result[2].style.italic).toBeTruthy();
		});

		it('keeps marker-like content when an auto-number has no runtime paragraph index', () => {
			const bulletInfo = { autoNumType: 'arabicPeriod' };
			const original: TextSegment[] = [{ text: '1.', style: {}, bulletInfo }];
			const result = remapTextToSegments('1.Item', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['1.Item']);
			expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
		});

		it('keeps marker-like text typed into a marker-only empty paragraph', () => {
			const bulletInfo = { autoNumType: 'arabicPeriod', paragraphIndex: 0 };
			const original: TextSegment[] = [{ text: '1.', style: {}, bulletInfo }];
			const result = remapTextToSegments('1.Item', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['1.', '1.Item']);
		});

		it('continues a numbered list when a new paragraph is appended', () => {
			const original: TextSegment[] = [
				{
					text: '1. ',
					style: { color: '#4472C4' },
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
				},
				seg('First item', { bold: true }),
			];
			const before = structuredClone(original);

			const result = remapTextToSegments('First item\nSecond item', original, {});
			const appended = result.slice(result.findIndex((segment) => segment.isParagraphBreak) + 1);

			expect(appended.map((segment) => segment.text)).toStrictEqual(['2. ', 'Second item']);
			expect(appended[0].bulletInfo).toStrictEqual({
				autoNumType: 'arabicPeriod',
				paragraphIndex: 1,
			});
			expect(appended[1].style.bold).toBeTruthy();
			expect(original).toStrictEqual(before);
		});

		it('continues multiple appended paragraphs from a custom numbered-list start', () => {
			const original: TextSegment[] = [
				{
					text: 'd)',
					style: {},
					bulletInfo: {
						autoNumType: 'alphaLcParenR',
						autoNumStartAt: 3,
						paragraphIndex: 1,
					},
				},
				seg('Fourth'),
			];

			const result = remapTextToSegments('Fourth\nFifth\nSixth', original, {});
			const markers = result.filter((segment) => segment.bulletInfo?.autoNumType);

			expect(markers.map((segment) => segment.text)).toStrictEqual(['d)', 'e)', 'f)']);
			expect(markers.map((segment) => segment.bulletInfo?.paragraphIndex)).toStrictEqual([1, 2, 3]);
		});

		it('continues numbering when bulletInfo is carried by the content run', () => {
			const original: TextSegment[] = [
				{
					text: 'First',
					style: {},
					bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 0 },
				},
			];

			const result = remapTextToSegments('First\nSecond', original, {});
			const appended = result.at(-1);

			expect(appended?.text).toBe('Second');
			expect(appended?.bulletInfo).toStrictEqual({
				autoNumType: 'romanUcPeriod',
				paragraphIndex: 1,
			});
		});

		it.each([
			['a character bullet', '• ', { char: '•' }],
			[
				'a picture bullet',
				'• ',
				{ imageDataUrl: 'data:image/png;base64,AA==', imageRelId: 'rId7' },
			],
			['an auto-number without a runtime paragraph index', '1.', { autoNumType: 'arabicPeriod' }],
		] as const)('does not invent a numbered sequence for %s', (_name, marker, bulletInfo) => {
			const original: TextSegment[] = [{ text: marker, style: {}, bulletInfo }, seg('First')];

			const result = remapTextToSegments(`First\nSecond`, original, {});
			const appended = result.slice(result.findIndex((segment) => segment.isParagraphBreak) + 1);
			const appendedBullet = appended.find((segment) => segment.bulletInfo)?.bulletInfo;

			expect(appendedBullet).toStrictEqual(bulletInfo);
			expect(appendedBullet?.paragraphIndex).toBeUndefined();
		});

		it('advances an empty appended paragraph before it receives text', () => {
			const original: TextSegment[] = [
				{
					text: '1.',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
				},
				seg('First'),
			];
			const result = remapTextToSegments('First\n', original, {});
			const appended = result.slice(result.findIndex((segment) => segment.isParagraphBreak) + 1);

			expect(appended[0].bulletInfo?.paragraphIndex).toBe(1);
		});
	});

	describe('paragraph metadata preservation', () => {
		it('keeps paragraph properties, level and end-run properties after a text edit', () => {
			const paragraphProperties = {
				paragraphSpacingBefore: 8,
				paragraphSpacingAfter: 12,
				lineSpacing: 1.5,
			};
			const endParaRunProperties = { '@_sz': '1800' };
			const original: TextSegment[] = [
				{
					text: 'Original',
					style: { fontSize: 18 },
					paragraphLevel: 2,
					paragraphProperties,
					endParaRunProperties,
				},
			];

			const result = remapTextToSegments('Edited', original, {});

			expect(result[0].paragraphLevel).toBe(2);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[0].endParaRunProperties).toBe(endParaRunProperties);
		});

		it('keeps each paragraph own metadata on its first remapped segment', () => {
			const firstProperties = { paragraphSpacingAfter: 6 };
			const secondProperties = { paragraphSpacingBefore: 10 };
			const original: TextSegment[] = [
				{
					text: 'First',
					style: { bold: true },
					paragraphProperties: firstProperties,
				},
				breakSeg(),
				{
					text: 'Second',
					style: { italic: true },
					paragraphProperties: secondProperties,
				},
			];

			const result = remapTextToSegments('First edited\nSecond edited', original, {});
			const paragraphs = result.filter((segment) => !segment.isParagraphBreak);

			expect(paragraphs[0].paragraphProperties).toBe(firstProperties);
			expect(paragraphs[1].paragraphProperties).toBe(secondProperties);
		});

		it('keeps metadata only on the first run of a remapped paragraph', () => {
			const paragraphProperties = { paragraphSpacingBefore: 5 };
			const original: TextSegment[] = [
				{
					text: 'Bold',
					style: { bold: true },
					paragraphProperties,
				},
				seg(' plain', { italic: true }),
			];

			const result = remapTextToSegments('Bold edited plain', original, {});

			expect(result).toHaveLength(2);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[1].paragraphProperties).toBeUndefined();
		});

		it('keeps paragraph metadata when all paragraph text is deleted', () => {
			const paragraphProperties = { paragraphSpacingBefore: 4 };
			const original: TextSegment[] = [
				{
					text: 'Delete me',
					style: {},
					paragraphLevel: 1,
					paragraphProperties,
				},
			];

			const result = remapTextToSegments('', original, {});

			expect(result[0].text).toBe('');
			expect(result[0].paragraphLevel).toBe(1);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
		});

		it('does not impose paragraph metadata policy on a newly appended paragraph', () => {
			const paragraphProperties = { paragraphSpacingAfter: 9 };
			const original: TextSegment[] = [
				{
					text: 'Existing',
					style: { bold: true },
					paragraphLevel: 2,
					paragraphProperties,
				},
			];

			const result = remapTextToSegments('Existing\nNew', original, {});
			const paragraphs = result.filter((segment) => !segment.isParagraphBreak);

			expect(paragraphs[0].paragraphProperties).toBe(paragraphProperties);
			expect(paragraphs[1].style.bold).toBeTruthy();
			expect(paragraphs[1].paragraphLevel).toBeUndefined();
			expect(paragraphs[1].paragraphProperties).toBeUndefined();
		});

		it('continues a marker and list level without copying unrelated paragraph metadata', () => {
			const paragraphProperties = { paragraphSpacingAfter: 9 };
			const original: TextSegment[] = [
				{
					text: '1.',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
					paragraphLevel: 2,
					paragraphProperties,
					endParaRunProperties: { '@_sz': '1800' },
				},
				seg('Item'),
			];

			const result = remapTextToSegments('1.Item\n1.New', original, {});
			const lastBreakIndex = result.reduce(
				(index, segment, current) => (segment.isParagraphBreak ? current : index),
				-1,
			);
			const appended = result[lastBreakIndex + 1];

			expect(appended?.bulletInfo).toStrictEqual({
				autoNumType: 'arabicPeriod',
				paragraphIndex: 1,
			});
			expect(appended?.text).toBe('2.');
			expect(appended?.paragraphLevel).toBe(2);
			expect(appended?.paragraphProperties).toBeUndefined();
			expect(appended?.endParaRunProperties).toBeUndefined();
		});

		it('keeps metadata carried by an empty non-final paragraph terminator', () => {
			const paragraphProperties = { paragraphSpacingAfter: 7 };
			const endParaRunProperties = { '@_sz': '1400' };
			const original: TextSegment[] = [
				{
					text: '\n',
					style: { fontSize: 14 },
					isParagraphBreak: true,
					paragraphProperties,
					endParaRunProperties,
				},
				seg('After'),
			];

			const result = remapTextToSegments('\nAfter edit', original, {});

			expect(result[0].text).toBe('');
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[0].endParaRunProperties).toBe(endParaRunProperties);
		});
	});

	describe('segment metadata preservation', () => {
		it('preserves equationXml on an untouched commit (click in, click away)', () => {
			const omml = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };
			const original: TextSegment[] = [
				{ text: '[Equation]', style: { fontFamily: 'Cambria Math' }, equationXml: omml },
			];
			const result = remapTextToSegments('[Equation]', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].equationXml).toBe(omml);
			expect(result[0].text).toBe('[Equation]');
		});

		it('preserves equationXml and equationNumber when the text was edited', () => {
			const omml = { 'm:oMathPara': {} };
			const original: TextSegment[] = [
				{ text: '[Equation]', style: {}, equationXml: omml, equationNumber: '(1)' },
			];
			const result = remapTextToSegments('renamed', original, {});
			expect(result[0].equationXml).toBe(omml);
			expect(result[0].equationNumber).toBe('(1)');
		});

		it('preserves field metadata (fieldType, fieldGuid, fieldGuidAttr)', () => {
			const original: TextSegment[] = [
				{
					text: '4',
					style: {},
					fieldType: 'slidenum',
					fieldGuid: '{ABC}',
					fieldGuidAttr: 'id',
				},
			];
			const result = remapTextToSegments('5', original, {});
			expect(result[0].fieldType).toBe('slidenum');
			expect(result[0].fieldGuid).toBe('{ABC}');
			expect(result[0].fieldGuidAttr).toBe('id');
		});

		it('preserves metadata through the empty-original-text remap path', () => {
			const omml = { 'm:oMath': {} };
			const original: TextSegment[] = [{ text: '', style: { bold: true }, equationXml: omml }];
			const result = remapTextToSegments('typed', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].equationXml).toBe(omml);
		});

		it('does not invent metadata on plain segments', () => {
			const original: TextSegment[] = [seg('plain', { bold: true })];
			const result = remapTextToSegments('plain', original, {});
			expect(result[0].equationXml).toBeUndefined();
			expect(result[0].fieldType).toBeUndefined();
		});
	});

	// Issue: audit item 11. A field run (`a:fld`) displays computed text
	// (`substituteFieldText` in `text-field-substitution.ts` REPLACES a
	// fieldType-tagged segment's stored text wholesale at render, regardless of
	// what is actually stored). The inline editor renders a field's live value
	// as ordinary editable text with no atomic/read-only boundary, so a user who
	// types real content directly after a field (a very common edit: "Page "
	// + <slidenum field> + " of 10") extends the LAST segment of the paragraph,
	// which is the field segment here. `copySegmentMetadata` then carries
	// `fieldType` onto that merged text, and the next render calls
	// `substituteFieldText` on the WHOLE merged string, discarding everything
	// the user typed beyond the field's own original text - silently, with no
	// error and no visual difference until the deck is re-rendered.
	describe('field-run (a:fld) boundary', () => {
		it('does not let literal text typed after a field merge into the field segment', () => {
			// "Page " (literal) + "3" (fieldType: slidenum, the paragraph's LAST
			// segment) -> user appends " of 10" right after the field.
			const original: TextSegment[] = [
				seg('Page '),
				{ text: '3', style: {}, fieldType: 'slidenum' },
			];
			const result = remapTextToSegments('Page 3 of 10', original, {});

			// The field segment's own text must stay bounded to what it originally
			// held; anything typed beyond it belongs to a new, non-field segment.
			const fieldSeg = result.find((s) => s.fieldType === 'slidenum');
			expect(fieldSeg?.text).toBe('3');

			// The literal " of 10" the user typed must survive as its own segment
			// carrying NO fieldType, or it is silently discarded by field
			// substitution on every subsequent render.
			const literalTail = result.find((s) => s.fieldType === undefined && s.text.includes('of 10'));
			expect(literalTail?.text).toBe(' of 10');

			// Concatenating every segment's stored text must reproduce exactly what
			// was typed - nothing invented, nothing dropped.
			expect(result.map((s) => s.text).join('')).toBe('Page 3 of 10');
		});

		it('still lets a field run be renamed/shortened when the edit stays within it', () => {
			const original: TextSegment[] = [
				seg('Page '),
				{ text: '3', style: {}, fieldType: 'slidenum' },
			];
			const result = remapTextToSegments('Page ', original, {});
			expect(result.map((s) => s.text).join('')).toBe('Page ');
		});
	});
});
