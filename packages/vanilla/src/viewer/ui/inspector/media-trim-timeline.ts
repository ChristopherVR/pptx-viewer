import type { MediaBookmark } from 'pptx-viewer-core';
import type { MediaTrimHandle } from 'pptx-viewer-shared';
import {
	formatMediaTime,
	mediaTimeFromPointer,
	mediaTimelineGeometry,
	mediaTrimEndSeconds,
	mediaTrimRangeForDrag,
} from 'pptx-viewer-shared';

import { createEl } from '../../render';

export interface MediaTrimTimelineOptions {
	/** Commit a new trim window (both edges, in ms) after a handle drag. */
	onTrimChange(trimStartMs: number, trimEndMs: number): void;
	/** Scrub the preview to a time in seconds (bar click / bookmark click). */
	onSeek(seconds: number): void;
}

export interface MediaTrimTimelineState {
	/** Clip duration in seconds; 0 until the preview reports its metadata. */
	duration: number;
	trimStartMs: number;
	trimEndMs: number;
	currentTime: number;
	bookmarks: readonly MediaBookmark[];
	canEdit: boolean;
}

/**
 * The media trim timeline (React's `TrimTimeline`, also present in Vue,
 * Angular and Svelte): a scrub bar with draggable start/end handles, a
 * playhead, and a tick per bookmark. The percentage/clamping maths lives in
 * `pptx-viewer-shared/media-trim-timeline`, so a trim dragged in vanilla lands
 * on exactly the same millisecond it would in any other binding.
 *
 * Pointer capture is taken on the handle itself, so a fast drag that leaves the
 * bar keeps trimming instead of silently stopping at the edge.
 */
export function createMediaTrimTimeline(doc: Document, options: MediaTrimTimelineOptions) {
	const el = createEl(doc, 'div', 'pptxv-media-timeline');
	const times = createEl(doc, 'div', 'pptxv-media-timeline-times');
	const startLabel = createEl(doc, 'span', 'pptxv-media-timeline-time');
	const endLabel = createEl(doc, 'span', 'pptxv-media-timeline-time');
	times.append(startLabel, endLabel);

	const bar = createEl(doc, 'div', 'pptxv-media-timeline-bar');
	const region = createEl(doc, 'div', 'pptxv-media-timeline-region');
	const playhead = createEl(doc, 'div', 'pptxv-media-timeline-playhead');
	const startHandle = createEl(doc, 'div', 'pptxv-media-timeline-handle is-start');
	const endHandle = createEl(doc, 'div', 'pptxv-media-timeline-handle is-end');
	const marks = createEl(doc, 'div', 'pptxv-media-timeline-marks');
	bar.append(region, marks, playhead, startHandle, endHandle);
	el.append(times, bar);

	let state: MediaTrimTimelineState = {
		duration: 0,
		trimStartMs: 0,
		trimEndMs: 0,
		currentTime: 0,
		bookmarks: [],
		canEdit: false,
	};

	const pointerSeconds = (clientX: number): number => {
		const rect = bar.getBoundingClientRect();
		return mediaTimeFromPointer(clientX, rect.left, rect.width, state.duration || 1);
	};

	bar.addEventListener('click', (event) => {
		if (event.target === startHandle || event.target === endHandle) {
			return;
		}
		options.onSeek(pointerSeconds(event.clientX));
	});

	const dragHandle = (node: HTMLElement, handle: MediaTrimHandle): void => {
		node.addEventListener('pointerdown', (event) => {
			if (!state.canEdit) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			node.setPointerCapture(event.pointerId);
			const move = (moveEvent: PointerEvent): void => {
				const range = mediaTrimRangeForDrag(
					handle,
					pointerSeconds(moveEvent.clientX),
					state.duration,
					state.trimStartMs,
					state.trimEndMs,
				);
				options.onTrimChange(Math.round(range.trimStartMs), Math.round(range.trimEndMs));
			};
			const up = (): void => {
				node.removeEventListener('pointermove', move);
				node.removeEventListener('pointerup', up);
				node.removeEventListener('pointercancel', up);
			};
			node.addEventListener('pointermove', move);
			node.addEventListener('pointerup', up);
			node.addEventListener('pointercancel', up);
		});
	};
	dragHandle(startHandle, 'start');
	dragHandle(endHandle, 'end');

	return {
		el,
		update(next: MediaTrimTimelineState) {
			state = next;
			const geometry = mediaTimelineGeometry(
				next.duration,
				next.trimStartMs,
				next.trimEndMs,
				next.currentTime,
			);
			// `trimEndMs` is p14:trim/@end's distance from the clip's tail.
			const endSeconds = mediaTrimEndSeconds(next.duration, next.trimEndMs);
			startLabel.textContent = formatMediaTime(next.trimStartMs / 1000);
			endLabel.textContent = formatMediaTime(endSeconds);
			region.style.left = `${geometry.startPercent}%`;
			region.style.width = `${Math.max(0, geometry.endPercent - geometry.startPercent)}%`;
			playhead.style.left = `${geometry.playheadPercent}%`;
			startHandle.style.left = `${geometry.startPercent}%`;
			endHandle.style.left = `${geometry.endPercent}%`;
			startHandle.hidden = !next.canEdit;
			endHandle.hidden = !next.canEdit;

			marks.textContent = '';
			const duration = next.duration > 0 ? next.duration : 1;
			for (const bookmark of next.bookmarks) {
				const mark = createEl(doc, 'button', 'pptxv-media-timeline-mark');
				mark.type = 'button';
				mark.style.left = `${Math.max(0, Math.min(100, (bookmark.time / duration) * 100))}%`;
				mark.title = bookmark.label ?? '';
				mark.setAttribute('aria-label', bookmark.label || formatMediaTime(bookmark.time));
				mark.addEventListener('click', (event) => {
					event.stopPropagation();
					options.onSeek(bookmark.time);
				});
				marks.appendChild(mark);
			}
		},
	};
}
