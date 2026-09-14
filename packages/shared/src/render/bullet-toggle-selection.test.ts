/**
 * bullet-toggle-selection.test.ts: with an inline selection active, Bullets /
 * Numbering touch only the paragraphs the selection intersects (PowerPoint),
 * and the selection is remapped over the inserted / removed marker segments.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { isBulletMarkerSegment, toggleElementBullets } from './bullet-toggle';
import {
	selectionBulletKind,
	setSelectionBullets,
	toggleSelectionBullets,
} from './bullet-toggle-selection';

const seg = (text: string, extra: Partial<TextSegment> = {}): TextSegment => ({
	text,
	style: { fontSize: 18 },
	...extra,
});
const brk = (): TextSegment => ({ text: '\n', style: {}, isParagraphBreak: true });
const loadedBullet = (text: string): TextSegment[] => [
	seg('• ', { bulletInfo: { char: '•' } }),
	seg(text),
];

const textElement = (segments: TextSegment[]): PptxElement =>
	({
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: segments.map((s) => s.text).join(''),
		textStyle: { fontSize: 18 },
		textSegments: segments,
	}) as unknown as PptxElement;

const texts = (patch: Partial<PptxElement>): string[] =>
	(patch as { textSegments: TextSegment[] }).textSegments.map((s) => s.text);

describe('selectionBulletKind', () => {
	it('reads the paragraphs the selection intersects, mixed when they disagree', () => {
		const el = textElement([...loadedBullet('A'), brk(), seg('B'), brk(), seg('C')]);
		expect(
			selectionBulletKind(el, { startSegIdx: 1, startOffset: 0, endSegIdx: 1, endOffset: 1 }),
		).toBe('bullet');
		expect(
			selectionBulletKind(el, { startSegIdx: 3, startOffset: 0, endSegIdx: 5, endOffset: 1 }),
		).toBe('none');
		expect(
			selectionBulletKind(el, { startSegIdx: 1, startOffset: 0, endSegIdx: 3, endOffset: 1 }),
		).toBe('mixed');
		expect(selectionBulletKind(el, null)).toBe('mixed');
	});
});

describe('toggleSelectionBullets', () => {
	it('bullets only the selected paragraph and shifts the selection past its marker', () => {
		const el = textElement([seg('A'), brk(), seg('B'), brk(), seg('C')]);
		const { patch, newSelection } = toggleSelectionBullets(el, 'bullet', {
			startSegIdx: 2,
			startOffset: 0,
			endSegIdx: 2,
			endOffset: 1,
		});
		expect(texts(patch)).toStrictEqual(['A', '\n', '• ', 'B', '\n', 'C']);
		expect(newSelection).toStrictEqual({
			startSegIdx: 3,
			startOffset: 0,
			endSegIdx: 3,
			endOffset: 1,
		});
	});

	it('applies to every paragraph a multi-paragraph selection touches, numbering consecutively', () => {
		const el = textElement([seg('A'), brk(), seg('B'), brk(), seg('C')]);
		const { patch, newSelection } = toggleSelectionBullets(el, 'numbered', {
			startSegIdx: 0,
			startOffset: 1,
			endSegIdx: 2,
			endOffset: 1,
		});
		expect(texts(patch)).toStrictEqual(['1.', 'A', '\n', '2.', 'B', '\n', 'C']);
		expect(newSelection).toStrictEqual({
			startSegIdx: 1,
			startOffset: 1,
			endSegIdx: 4,
			endOffset: 1,
		});
	});

	it('turns the selected paragraphs off when they are all already in that state', () => {
		const el = textElement([...loadedBullet('A'), brk(), ...loadedBullet('B')]);
		const { patch, newSelection } = toggleSelectionBullets(el, 'bullet', {
			startSegIdx: 4,
			startOffset: 0,
			endSegIdx: 4,
			endOffset: 1,
		});
		expect(texts(patch)).toStrictEqual(['• ', 'A', '\n', 'B']);
		expect(newSelection).toStrictEqual({
			startSegIdx: 3,
			startOffset: 0,
			endSegIdx: 3,
			endOffset: 1,
		});
		const segments = (patch as { textSegments: TextSegment[] }).textSegments;
		expect(segments[3].bulletInfo).toStrictEqual({ none: true });
	});

	it('applies the kind to a mixed selection rather than turning it off', () => {
		const el = textElement([...loadedBullet('A'), brk(), seg('B')]);
		const { patch } = toggleSelectionBullets(el, 'bullet', {
			startSegIdx: 1,
			startOffset: 0,
			endSegIdx: 3,
			endOffset: 1,
		});
		const segments = (patch as { textSegments: TextSegment[] }).textSegments;
		expect(segments.filter((s) => isBulletMarkerSegment(s))).toHaveLength(2);
	});

	it('is the whole-element toggle when there is no selection', () => {
		const el = textElement([seg('A'), brk(), seg('B')]);
		const { patch, newSelection } = toggleSelectionBullets(el, 'bullet', null);
		expect(patch).toStrictEqual(toggleElementBullets(el, 'bullet'));
		expect(newSelection).toBeNull();
	});

	it('acts on a live segment override and clears the inert listType', () => {
		const el = {
			...textElement([seg('stale')]),
			textStyle: { fontSize: 18, listType: 'none' },
		} as unknown as PptxElement;
		const { patch } = setSelectionBullets(el, 'bullet', null, [seg('live')]);
		expect(texts(patch)).toStrictEqual(['• ', 'live']);
		expect((patch as { textStyle: { listType?: string } }).textStyle.listType).toBeUndefined();
	});
});
