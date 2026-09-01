/**
 * bullet-toggle.test.ts: the ribbon Bullets / Numbering buttons must author a
 * real `bulletInfo` (what the renderer and save writer read), not the inert
 * `TextStyle.listType` every binding used to write.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveParagraphBullet } from './bullet-list';
import {
	bulletInfoForKind,
	elementBulletKind,
	isBulletMarkerSegment,
	paragraphBulletKind,
	setElementBullets,
	toggleElementBullets,
	toggleParagraphBullet,
} from './bullet-toggle';
import { buildParagraphs } from './text-paragraphs';

const seg = (text: string, extra: Partial<TextSegment> = {}): TextSegment => ({
	text,
	style: { fontSize: 18 },
	...extra,
});

const brk = (): TextSegment => ({ text: '\n', style: {}, isParagraphBreak: true });

/** What core produces on load for a bulleted paragraph: marker + run. */
const loadedBullet = (text: string): TextSegment[] => [
	seg('• ', { bulletInfo: { char: '•' }, paragraphLevel: 1 }),
	seg(text),
];

const textElement = (segments: TextSegment[], listType?: 'bullet' | 'none'): PptxElement =>
	({
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: segments.map((s) => s.text).join(''),
		textStyle: { fontSize: 18, ...(listType ? { listType } : {}) },
		textSegments: segments,
	}) as unknown as PptxElement;

describe('bulletInfoForKind', () => {
	it('authors the three OOXML bullet forms', () => {
		expect(bulletInfoForKind('bullet')).toStrictEqual({ char: '•' });
		expect(bulletInfoForKind('numbered', 2)).toStrictEqual({
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 2,
		});
		expect(bulletInfoForKind('none')).toStrictEqual({ none: true });
	});
});

describe('paragraphBulletKind', () => {
	it('reads the resolved bullet, including one core inherited from the layout', () => {
		expect(paragraphBulletKind(loadedBullet('Item'))).toBe('bullet');
		expect(
			paragraphBulletKind([
				seg('1.', { bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 } }),
				seg('Item'),
			]),
		).toBe('numbered');
		expect(paragraphBulletKind([seg('Plain')])).toBe('none');
		expect(paragraphBulletKind([seg('Off', { bulletInfo: { none: true } })])).toBe('none');
		expect(paragraphBulletKind([])).toBe('none');
	});

	it("honours a style listType of 'none' as suppression", () => {
		const para = [seg('• ', { bulletInfo: { char: '•' }, style: { listType: 'none' } }), seg('X')];
		expect(paragraphBulletKind(para)).toBe('none');
	});
});

describe('toggleParagraphBullet', () => {
	it('turns a plain paragraph into a bullet the renderer draws once', () => {
		const next = toggleParagraphBullet([seg('Item')], 'bullet');
		expect(next).toHaveLength(2);
		expect(next[0].bulletInfo).toStrictEqual({ char: '•' });
		expect(isBulletMarkerSegment(next[0])).toBeTruthy();
		expect(next[1].text).toBe('Item');
		expect(next[1].bulletInfo).toBeUndefined();
		expect(resolveParagraphBullet(next[0])?.marker).toBe('•');
	});

	it('switches a loaded bullet to numbering without leaving the old glyph behind', () => {
		const next = toggleParagraphBullet(loadedBullet('Item'), 'numbered', 1);
		expect(next.map((s) => s.text)).toStrictEqual(['2.', 'Item']);
		expect(next[0].bulletInfo).toStrictEqual({
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 1,
		});
		expect(resolveParagraphBullet(next[0])?.marker).toBe('2.');
	});

	it('turns a bullet off with an explicit buNone and drops the marker segment', () => {
		const next = toggleParagraphBullet(loadedBullet('Item'), 'none');
		expect(next).toHaveLength(1);
		expect(next[0].text).toBe('Item');
		expect(next[0].bulletInfo).toStrictEqual({ none: true });
		expect(paragraphBulletKind(next)).toBe('none');
	});

	it('keeps the paragraph-level fields on whichever segment ends up first', () => {
		const on = toggleParagraphBullet(loadedBullet('Item'), 'numbered');
		expect(on[0].paragraphLevel).toBe(1);
		const off = toggleParagraphBullet(loadedBullet('Item'), 'none');
		expect(off[0].paragraphLevel).toBe(1);
	});

	it("clears the inert listType so a stale 'none' cannot suppress the new marker", () => {
		const next = toggleParagraphBullet([seg('Item', { style: { listType: 'none' } })], 'bullet');
		expect(next[0].style.listType).toBeUndefined();
		expect(next[1].style.listType).toBeUndefined();
		expect(paragraphBulletKind(next)).toBe('bullet');
	});

	it('leaves an empty paragraph alone', () => {
		expect(toggleParagraphBullet([], 'bullet')).toStrictEqual([]);
	});
});

describe('setElementBullets / toggleElementBullets', () => {
	it('numbers every paragraph consecutively and clears the element listType', () => {
		const el = textElement([seg('A'), brk(), seg('B'), brk(), seg('C')], 'none');
		const patch = setElementBullets(el, 'numbered');
		const segments = (patch as { textSegments: TextSegment[] }).textSegments;
		const markers = segments.filter((s) => isBulletMarkerSegment(s)).map((s) => s.text);
		expect(markers).toStrictEqual(['1.', '2.', '3.']);
		expect((patch as { textStyle: { listType?: string } }).textStyle.listType).toBeUndefined();
		// Separators survive so the paragraph count is unchanged.
		expect(segments.filter((s) => s.isParagraphBreak)).toHaveLength(2);
	});

	it('renders through buildParagraphs with one marker per paragraph and the runs intact', () => {
		const el = textElement([seg('A'), brk(), seg('B')]);
		const next = { ...el, ...setElementBullets(el, 'bullet') } as PptxElement;
		const paragraphs = buildParagraphs(next);
		expect(paragraphs).toHaveLength(2);
		for (const [i, para] of paragraphs.entries()) {
			expect(para.bulletMarker).toBe('•');
			expect(para.runs.map((r) => r.text).join('')).toBe(i === 0 ? 'A' : 'B');
		}
	});

	it('toggles off when the element is already in that state, on otherwise', () => {
		const el = textElement([...loadedBullet('A'), brk(), ...loadedBullet('B')]);
		expect(elementBulletKind(el)).toBe('bullet');
		const off = { ...el, ...toggleElementBullets(el, 'bullet') } as PptxElement;
		expect(elementBulletKind(off)).toBe('none');
		const numbered = { ...el, ...toggleElementBullets(el, 'numbered') } as PptxElement;
		expect(elementBulletKind(numbered)).toBe('numbered');
		const back = { ...numbered, ...toggleElementBullets(numbered, 'bullet') } as PptxElement;
		expect(elementBulletKind(back)).toBe('bullet');
	});

	it('synthesises segments for an element that only carries text', () => {
		const el = {
			type: 'text',
			id: 't2',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'One\nTwo',
			textStyle: { fontSize: 14 },
		} as unknown as PptxElement;
		const patch = setElementBullets(el, 'bullet');
		const segments = (patch as { textSegments: TextSegment[] }).textSegments;
		expect(segments.map((s) => s.text)).toStrictEqual(['• ', 'One', '\n', '• ', 'Two']);
	});
});
