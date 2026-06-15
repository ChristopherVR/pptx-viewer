import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	clampNotesFontSize,
	formatElapsed,
	notesSegmentsToSpans,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
} from './presenter-view-utils';

describe('formatElapsed', () => {
	it('formats sub-hour durations as MM:SS', () => {
		expect(formatElapsed(0)).toBe('00:00');
		expect(formatElapsed(1000)).toBe('00:01');
		expect(formatElapsed(90000)).toBe('01:30');
		expect(formatElapsed(3599000)).toBe('59:59');
	});

	it('switches to HH:MM:SS at one hour', () => {
		expect(formatElapsed(3600000)).toBe('01:00:00');
		expect(formatElapsed(3661000)).toBe('01:01:01');
	});

	it('floors sub-second values', () => {
		expect(formatElapsed(999)).toBe('00:00');
		expect(formatElapsed(1500)).toBe('00:01');
	});
});

describe('clampNotesFontSize', () => {
	it('returns in-range values unchanged', () => {
		expect(clampNotesFontSize(16)).toBe(16);
		expect(clampNotesFontSize(NOTES_FONT_SIZE_DEFAULT)).toBe(NOTES_FONT_SIZE_DEFAULT);
	});

	it('clamps to the min/max', () => {
		expect(clampNotesFontSize(0)).toBe(NOTES_FONT_SIZE_MIN);
		expect(clampNotesFontSize(100)).toBe(NOTES_FONT_SIZE_MAX);
	});
});

describe('notesSegmentsToSpans', () => {
	const seg = (overrides: Partial<TextSegment>): TextSegment => ({
		text: 'hello',
		style: {},
		...overrides,
	});

	it('maps paragraph breaks to break nodes', () => {
		const spans = notesSegmentsToSpans([seg({ isParagraphBreak: true })]);
		expect(spans[0]).toStrictEqual({ kind: 'break', key: 'br-0' });
	});

	it('maps styled runs to text nodes with CSS', () => {
		const spans = notesSegmentsToSpans([
			seg({
				text: 'bold',
				style: { bold: true, italic: true, color: '#ff0000', fontSize: 18 },
			}),
		]);
		const node = spans[0];
		expect(node.kind).toBe('text');
		if (node.kind === 'text') {
			expect(node.text).toBe('bold');
			expect(node.style.fontWeight).toBe('bold');
			expect(node.style.fontStyle).toBe('italic');
			expect(node.style.color).toBe('#ff0000');
			expect(node.style.fontSize).toBe('18pt');
		}
	});

	it('combines underline and strikethrough into one text-decoration', () => {
		const spans = notesSegmentsToSpans([seg({ style: { underline: true, strikethrough: true } })]);
		const node = spans[0];
		if (node.kind === 'text') {
			expect(node.style.textDecoration).toBe('underline line-through');
		}
	});
});
