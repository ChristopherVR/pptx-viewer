import { describe, it, expect } from 'vitest';
import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { remapTextToSegments } from './remap-text';

describe('remapTextToSegments', () => {
	it('should return fallback segment when originalSegments is undefined', () => {
		const result = remapTextToSegments('Hello', undefined, undefined);
		expect(result.length).toBe(1);
		expect(result[0].text).toBe('Hello');
	});

	it('should return fallback segment when originalSegments is empty', () => {
		const result = remapTextToSegments('Hello', [], undefined);
		expect(result.length).toBe(1);
		expect(result[0].text).toBe('Hello');
	});

	it('should preserve style from original segment for single-segment text', () => {
		const style: TextStyle = { bold: true, fontSize: 24 };
		const original: TextSegment[] = [{ text: 'Hello', style }];
		const result = remapTextToSegments('World', original, undefined);
		expect(result.length).toBe(1);
		expect(result[0].text).toBe('World');
		expect(result[0].style.bold).toBe(true);
		expect(result[0].style.fontSize).toBe(24);
	});

	it('should distribute new text proportionally across multiple segments', () => {
		const original: TextSegment[] = [
			{ text: 'AB', style: { bold: true } },
			{ text: 'CD', style: { italic: true } },
		];
		const result = remapTextToSegments('1234', original, undefined);
		// 'AB' has length 2, 'CD' has length 2
		// New text '1234' should split: '12' gets bold style, '34' gets italic style
		expect(result.length).toBe(2);
		expect(result[0].text).toBe('12');
		expect(result[0].style.bold).toBe(true);
		expect(result[1].text).toBe('34');
		expect(result[1].style.italic).toBe(true);
	});

	it('should put extra characters on the last segment', () => {
		const original: TextSegment[] = [
			{ text: 'A', style: { bold: true } },
			{ text: 'B', style: { italic: true } },
		];
		const result = remapTextToSegments('XYZW', original, undefined);
		// First segment gets 1 char ('X'), last segment gets the rest ('YZW')
		expect(result[0].text).toBe('X');
		expect(result[1].text).toBe('YZW');
	});

	it('should handle multi-paragraph text with newlines', () => {
		const original: TextSegment[] = [
			{ text: 'Line1', style: { bold: true } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: 'Line2', style: { italic: true } },
		];
		const result = remapTextToSegments('AAA\nBBB', original, undefined);

		// Should produce segments for first paragraph, a break, and second paragraph
		const breaks = result.filter((s) => s.isParagraphBreak);
		expect(breaks.length).toBe(1);

		const nonBreaks = result.filter((s) => !s.isParagraphBreak);
		expect(nonBreaks[0].text).toBe('AAA');
		expect(nonBreaks[0].style.bold).toBe(true);
	});

	it('should handle empty new text', () => {
		const original: TextSegment[] = [
			{ text: 'Hello', style: { bold: true } },
		];
		const result = remapTextToSegments('', original, undefined);
		expect(result.length).toBeGreaterThanOrEqual(1);
		expect(result[0].text).toBe('');
	});

	it('should inherit element text style as fallback', () => {
		const elementStyle: TextStyle = { fontSize: 18, color: '#FF0000' };
		const result = remapTextToSegments('Test', undefined, elementStyle);
		expect(result[0].style.fontSize).toBe(18);
		expect(result[0].style.color).toBe('#FF0000');
	});

	it('should handle adding a new paragraph beyond original paragraphs', () => {
		const original: TextSegment[] = [
			{ text: 'Only', style: { bold: true } },
		];
		const result = remapTextToSegments('Line1\nLine2\nLine3', original, undefined);

		const breaks = result.filter((s) => s.isParagraphBreak);
		expect(breaks.length).toBe(2);
	});

	it('should preserve bulletInfo on first segment of each paragraph', () => {
		const bulletInfo = { level: 0, char: '\u2022' };
		const original: TextSegment[] = [
			{ text: 'Item 1', style: { bold: true }, bulletInfo },
		];
		const result = remapTextToSegments('New text', original, undefined);
		expect(result[0].bulletInfo).toBeDefined();
		expect(result[0].bulletInfo?.char).toBe('\u2022');
	});
});
