import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { setTrigger, TRIGGER_OPTIONS } from './animation-authoring';
import {
	bookmarkOptionValue,
	listMediaBookmarkOptions,
	parseBookmarkOptionValue,
	selectedBookmarkOptionValue,
	setTriggerBookmark,
} from './animation-bookmark-trigger';

function media(id: string, name: string, labels: string[]): PptxElement {
	return {
		id,
		type: 'media',
		name,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		mediaType: 'video',
		bookmarks: labels.map((label, index) => ({ label, time: index + 0.5 })),
	} as PptxElement;
}

describe('animation-bookmark-trigger', () => {
	it('offers "On bookmark" in the shared trigger list', () => {
		expect(TRIGGER_OPTIONS.map((o) => o.value)).toContain('onMediaBookmark');
		expect(TRIGGER_OPTIONS.find((o) => o.value === 'onMediaBookmark')?.labelKey).toBe(
			'pptx.animation.trigger.onMediaBookmark',
		);
	});

	it('lists every media bookmark, naming the clip only when there are several', () => {
		const single = listMediaBookmarkOptions([media('v1', 'Clip', ['BM1', 'BM2'])]);
		expect(single.map((o) => o.label)).toStrictEqual(['BM1', 'BM2']);
		expect(single[1]).toMatchObject({ mediaId: 'v1', bookmarkName: 'BM2' });

		const several = listMediaBookmarkOptions([
			media('v1', 'Intro', ['Start']),
			media('v2', '', ['End']),
			{ id: 's', type: 'shape' } as PptxElement,
		]);
		expect(several.map((o) => o.label)).toStrictEqual(['Intro - Start', 'Media 2 - End']);
	});

	it('round-trips an option value, including a bookmark name with odd characters', () => {
		const value = bookmarkOptionValue('ppt/slides/slide1.xml-pic-0', 'Part: 1 / A');
		expect(parseBookmarkOptionValue(value)).toStrictEqual({
			mediaId: 'ppt/slides/slide1.xml-pic-0',
			bookmarkName: 'Part: 1 / A',
		});
		expect(parseBookmarkOptionValue('')).toBeUndefined();
	});

	it('points an animation at a bookmark and reads the selection back', () => {
		const anims: PptxElementAnimation[] = [{ elementId: 'e1', entrance: 'fadeIn' }];
		const next = setTriggerBookmark(anims, 'e1', bookmarkOptionValue('v1', 'BM2'));
		expect(next[0]).toMatchObject({
			trigger: 'onMediaBookmark',
			triggerShapeId: 'v1',
			triggerBookmark: 'BM2',
		});
		expect(selectedBookmarkOptionValue(next[0])).toBe(bookmarkOptionValue('v1', 'BM2'));
		expect(selectedBookmarkOptionValue(anims[0])).toBe('');
	});

	it('clears the bookmark when the trigger changes away from it', () => {
		const withBookmark = setTriggerBookmark(
			[{ elementId: 'e1', entrance: 'fadeIn' }],
			'e1',
			bookmarkOptionValue('v1', 'BM1'),
		);
		const clicked = setTrigger(withBookmark, 'e1', 'onShapeClick');
		expect(clicked[0]?.triggerShapeId).toBeUndefined();
		expect(clicked[0]?.triggerBookmark).toBeUndefined();
		// Re-selecting the same trigger keeps the chosen target.
		expect(setTrigger(withBookmark, 'e1', 'onMediaBookmark')[0]?.triggerBookmark).toBe('BM1');
	});
});
