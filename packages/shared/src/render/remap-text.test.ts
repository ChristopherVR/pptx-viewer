import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { remapTextToSegments } from './remap-text';

function seg(text: string, style: TextStyle = {}): TextSegment {
	return { text, style };
}

function breakSeg(style: TextStyle = {}): TextSegment {
	return { text: '\n', style, isParagraphBreak: true };
}

describe('remapTextToSegments', () => {
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

		it('does not copy marker-carried paragraph metadata to an appended paragraph', () => {
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
				paragraphIndex: 0,
			});
			expect(appended?.paragraphLevel).toBeUndefined();
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
