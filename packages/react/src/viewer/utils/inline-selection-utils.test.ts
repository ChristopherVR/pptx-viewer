import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { applyStyleToSelectedSegments } from './inline-selection-utils';
import type { InlineTextSelection } from './inline-selection-utils';

function seg(text: string, style: Partial<TextStyle> = {}): TextSegment {
	return { text, style: style as TextStyle };
}

function paraBrk(style: Partial<TextStyle> = {}): TextSegment {
	return { text: '\n', style: style as TextStyle, isParagraphBreak: true };
}

describe('applyStyleToSelectedSegments', () => {
	it('should apply style to a single fully-selected segment', () => {
		const segments = [seg('Hello')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 0,
			endSegIdx: 0,
			endOffset: 5,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		expect(newSegments).toHaveLength(1);
		expect(newSegments[0].text).toBe('Hello');
		expect(newSegments[0].style.bold).toBeTruthy();
	});

	it('should split a single segment when partially selected at start', () => {
		const segments = [seg('Hello World')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 0,
			endSegIdx: 0,
			endOffset: 5,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		expect(newSegments).toHaveLength(2);
		expect(newSegments[0].text).toBe('Hello');
		expect(newSegments[0].style.bold).toBeTruthy();
		expect(newSegments[1].text).toBe(' World');
		expect(newSegments[1].style.bold).toBeUndefined();
	});

	it('should split a single segment when partially selected in the middle', () => {
		const segments = [seg('Hello World!')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 6,
			endSegIdx: 0,
			endOffset: 11,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { italic: true });
		expect(newSegments).toHaveLength(3);
		expect(newSegments[0].text).toBe('Hello ');
		expect(newSegments[0].style.italic).toBeUndefined();
		expect(newSegments[1].text).toBe('World');
		expect(newSegments[1].style.italic).toBeTruthy();
		expect(newSegments[2].text).toBe('!');
		expect(newSegments[2].style.italic).toBeUndefined();
	});

	it('should apply style across multiple segments', () => {
		const segments = [seg('Hello '), seg('World'), seg('!')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 0,
			endSegIdx: 2,
			endOffset: 1,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { underline: true });
		expect(newSegments).toHaveLength(3);
		expect(newSegments[0].style.underline).toBeTruthy();
		expect(newSegments[1].style.underline).toBeTruthy();
		expect(newSegments[2].style.underline).toBeTruthy();
	});

	it('should split start and end segments when selection is partial', () => {
		const segments = [seg('AAA'), seg('BBB'), seg('CCC')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 1,
			endSegIdx: 2,
			endOffset: 2,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		// "A" | "AA" (bold) | "BBB" (bold) | "CC" (bold) | "C"
		expect(newSegments).toHaveLength(5);
		expect(newSegments[0].text).toBe('A');
		expect(newSegments[0].style.bold).toBeUndefined();
		expect(newSegments[1].text).toBe('AA');
		expect(newSegments[1].style.bold).toBeTruthy();
		expect(newSegments[2].text).toBe('BBB');
		expect(newSegments[2].style.bold).toBeTruthy();
		expect(newSegments[3].text).toBe('CC');
		expect(newSegments[3].style.bold).toBeTruthy();
		expect(newSegments[4].text).toBe('C');
		expect(newSegments[4].style.bold).toBeUndefined();
	});

	it('should preserve paragraph break segments unchanged', () => {
		const segments = [seg('Line 1'), paraBrk(), seg('Line 2')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 0,
			endSegIdx: 2,
			endOffset: 6,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		expect(newSegments).toHaveLength(3);
		expect(newSegments[0].style.bold).toBeTruthy();
		expect(newSegments[1].isParagraphBreak).toBeTruthy();
		expect(newSegments[1].style.bold).toBeUndefined();
		expect(newSegments[2].style.bold).toBeTruthy();
	});

	it('should not modify segments outside the selection range', () => {
		const segments = [
			seg('Before', { italic: true }),
			seg('Selected'),
			seg('After', { italic: true }),
		];
		const selection: InlineTextSelection = {
			startSegIdx: 1,
			startOffset: 0,
			endSegIdx: 1,
			endOffset: 8,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		expect(newSegments).toHaveLength(3);
		expect(newSegments[0].style.italic).toBeTruthy();
		expect(newSegments[0].style.bold).toBeUndefined();
		expect(newSegments[1].style.bold).toBeTruthy();
		expect(newSegments[2].style.italic).toBeTruthy();
		expect(newSegments[2].style.bold).toBeUndefined();
	});

	it('should preserve existing styles on selected segments', () => {
		const segments = [seg('Bold text', { bold: true, fontSize: 24 })];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 0,
			endSegIdx: 0,
			endOffset: 9,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { italic: true });
		expect(newSegments[0].style.bold).toBeTruthy();
		expect(newSegments[0].style.italic).toBeTruthy();
		expect(newSegments[0].style.fontSize).toBe(24);
	});

	it('should preserve bulletInfo on the first sub-segment when splitting', () => {
		const bullet = { char: '•' };
		const segments = [{ text: 'Bullet item', style: {} as TextStyle, bulletInfo: bullet }];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 7,
			endSegIdx: 0,
			endOffset: 11,
		};
		const { newSegments } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		// "Bullet " (with bulletInfo) | "item" (bold, no bulletInfo)
		expect(newSegments).toHaveLength(2);
		expect(newSegments[0].bulletInfo).toStrictEqual(bullet);
		expect(newSegments[1].bulletInfo).toBeUndefined();
	});

	it('should return correct newSelection for single-segment split', () => {
		const segments = [seg('Hello World')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 6,
			endSegIdx: 0,
			endOffset: 11,
		};
		const { newSelection } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		// After split: ["Hello "][0], ["World"][1]
		// The selected part is at index 1, offset 0 to 5
		expect(newSelection.startSegIdx).toBe(1);
		expect(newSelection.startOffset).toBe(0);
		expect(newSelection.endSegIdx).toBe(1);
		expect(newSelection.endOffset).toBe(5);
	});

	it('should return correct newSelection for multi-segment selection', () => {
		const segments = [seg('AAA'), seg('BBB'), seg('CCC')];
		const selection: InlineTextSelection = {
			startSegIdx: 0,
			startOffset: 1,
			endSegIdx: 2,
			endOffset: 2,
		};
		const { newSelection } = applyStyleToSelectedSegments(segments, selection, { bold: true });
		// Result: "A"[0] | "AA"[1](bold) | "BBB"[2](bold) | "CC"[3](bold) | "C"[4]
		expect(newSelection.startSegIdx).toBe(1);
		expect(newSelection.startOffset).toBe(0);
		expect(newSelection.endSegIdx).toBe(3);
		expect(newSelection.endOffset).toBe(2);
	});
});
