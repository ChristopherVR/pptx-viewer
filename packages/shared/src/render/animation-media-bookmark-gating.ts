/**
 * `animation-media-bookmark-gating`: bridges a real `<audio>`/`<video>`
 * element's live playback position to the {@link TimelineStep}s whose OOXML
 * start condition is `p:cond/@evt="onMediaBookmark"` targeting a specific
 * bookmark on that media element (`p14:bmkTgt`, an Office 2010 `p14`
 * extension - see `PptxMediaBookmarkTarget` in `pptx-viewer-core`).
 *
 * Mirrors `animation-media-end-gating.ts`'s shape (find gated steps, wire a
 * real DOM listener, apply the step via the shared `applyMediaEndedStep`),
 * but keys off the media element's `timeupdate` position crossing the
 * bookmark's authored time instead of its `ended` event:
 *
 *  - {@link resolveMediaBookmarkTimesMs} builds an elementId -> bookmarkName
 *    -> time(ms) lookup from the slide's own parsed elements, once per slide
 *    load (`PlaybackContext.mediaBookmarkTimesMs`).
 *  - {@link isBookmarkGated} / {@link findMediaBookmarkGatedSteps} identify
 *    which of a click-group's steps wait on a bookmark.
 *  - {@link wireMediaBookmarkSteps} attaches the real `timeupdate` listener,
 *    firing the gated step (via `applyMediaEndedStep`, reused unchanged: the
 *    real event IS the zero point either way) the first time playback
 *    reaches the bookmark.
 *
 * A gated step's `EffectiveStartCondition` resolves to a zero, non-auto-firing
 * delay (see `resolveEffectiveStartCondition`'s `onMediaBookmark` branch), so
 * without a real media element to wire (export/headless, or a binding that
 * has not populated `mediaBookmarkTimesMs`) the step simply never fires,
 * rather than firing at the wrong time - the same trade-off this project
 * already makes for an `onStopAudio` dependency with no real audio element.
 *
 * @module render/animation-media-bookmark-gating
 */

import type { MediaPptxElement, PptxElement } from 'pptx-viewer-core';

import { applyMediaEndedStep } from './animation-media-end-gating';
import { findMediaElementByElementId } from './animation-media-playback';
import type { PlaybackContext } from './animation-playback-engine';
import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';
import { flattenSlideElements } from './presentation-action';

/**
 * Build an elementId -> bookmarkName -> time(ms) lookup from a slide's own
 * elements. Built once per slide load and passed as
 * `PlaybackContext.mediaBookmarkTimesMs`, mirroring
 * `animation-media-end-gating`'s `resolveMediaTimeNodeElementIds`.
 */
export function resolveMediaBookmarkTimesMs(
	elements: readonly PptxElement[] | undefined,
): ReadonlyMap<string, ReadonlyMap<string, number>> {
	const map = new Map<string, ReadonlyMap<string, number>>();
	for (const element of flattenSlideElements(elements)) {
		if (element.type !== 'media') {
			continue;
		}
		const media = element as MediaPptxElement;
		if (!media.bookmarks || media.bookmarks.length === 0) {
			continue;
		}
		const byName = new Map<string, number>();
		for (const bookmark of media.bookmarks) {
			byName.set(bookmark.label, Math.round(bookmark.time * 1000));
		}
		map.set(media.id, byName);
	}
	return map;
}

/**
 * Whether `step` waits for a SPECIFIC media element to reach a specific
 * bookmark (`p:cond/@evt="onMediaBookmark"`), rather than resolving entirely
 * from a fixed computed delay.
 */
export function isBookmarkGated(step: TimelineStep): boolean {
	return (
		step.dependsOnEvent === 'onMediaBookmark' &&
		step.dependsOnShapeId !== undefined &&
		step.dependsOnBookmarkName !== undefined
	);
}

/** Steps in `group` gated on a media bookmark. */
export function findMediaBookmarkGatedSteps(
	group: TimelineClickGroup | null | undefined,
): TimelineStep[] {
	if (!group) {
		return [];
	}
	return group.steps.filter((step) => isBookmarkGated(step));
}

/**
 * Wire every bookmark-gated step in `group` to its real `<audio>`/`<video>`
 * element's `timeupdate` event, firing the step (once) the first time
 * playback crosses the bookmark's authored time. Called once per group
 * application by `animation-playback-engine`'s `applyAnimationGroupSteps`; a
 * context missing the media element, or `mediaBookmarkTimesMs`, or the named
 * bookmark is a no-op (see the module doc for why that is the right
 * trade-off).
 */
export function wireMediaBookmarkSteps(group: TimelineClickGroup, ctx: PlaybackContext): void {
	for (const step of group.steps) {
		if (step.command || !isBookmarkGated(step)) {
			continue;
		}
		const shapeId = step.dependsOnShapeId as string;
		const bookmarkName = step.dependsOnBookmarkName as string;
		const bookmarkMs = ctx.mediaBookmarkTimesMs?.get(shapeId)?.get(bookmarkName);
		if (bookmarkMs === undefined) {
			continue;
		}
		const mediaEl = findMediaElementByElementId(shapeId, ctx.frameRoot?.());
		if (!mediaEl) {
			continue;
		}
		let fired = false;
		const handler = (): void => {
			if (fired || mediaEl.currentTime * 1000 < bookmarkMs) {
				return;
			}
			fired = true;
			mediaEl.removeEventListener('timeupdate', handler);
			applyMediaEndedStep(step, ctx);
		};
		mediaEl.addEventListener('timeupdate', handler);
	}
}
