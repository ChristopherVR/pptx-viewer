/**
 * A PowerPoint bookmark trigger is its own interactive sequence, independent of
 * the click sequence. The loader hands its effects over FIRST, gated on the
 * bookmark (see core's `native-animation-interactive-walk`); the timeline must
 * turn them into the slide-entry group, so applying that group at slide start
 * wires the media listener, and must NOT let them eat a click.
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { isBookmarkGated } from './animation-media-bookmark-gating';
import { buildTimeline } from './animation-timeline-builder';

const bookmarkEffect: PptxNativeAnimation = {
	targetId: 'shape-a',
	presetClass: 'entr',
	presetId: 10,
	durationMs: 500,
	trigger: 'onMediaBookmark',
	triggerShapeId: 'video-1',
	triggerBookmark: 'BM1',
	groupAutoStart: true,
	startConditions: [
		{
			event: 'onMediaBookmark',
			delay: 0,
			bookmarkTarget: { shapeId: 'video-1', bookmarkName: 'BM1' },
		},
	],
};

const clickEffect: PptxNativeAnimation = {
	targetId: 'shape-b',
	presetClass: 'entr',
	presetId: 10,
	durationMs: 500,
	trigger: 'onClick',
};

describe('bookmark-triggered sequences in the timeline', () => {
	it('arm at slide entry and leave the first click to the click sequence', () => {
		const timeline = buildTimeline([bookmarkEffect, clickEffect]);
		expect(timeline.clickGroups).toHaveLength(2);
		const [entry, click] = timeline.clickGroups;
		expect(entry?.autoAdvance).toBeTruthy();
		expect(entry?.steps).toHaveLength(1);
		expect(isBookmarkGated(entry!.steps[0]!)).toBeTruthy();
		expect(entry?.steps[0]?.dependsOnBookmarkName).toBe('BM1');
		expect(click?.autoAdvance).toBeFalsy();
		expect(click?.steps[0]?.elementId).toBe('shape-b');
		// Hidden until the bookmark fires.
		expect(timeline.entranceElementIds.has('shape-a')).toBeTruthy();
	});
});
