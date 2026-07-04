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
});
