// @vitest-environment happy-dom
/**
 * G20: trim-end stop + fade in/out for PresentationMediaController.
 *
 * This used to be React-local logic (deleted in favour of the shared
 * `scheduleMediaTrimAndFade`, see `media-controller.tsx`); this test proves
 * the wiring, not the scheduling maths itself (covered directly in
 * `packages/shared/src/render/media-trim-fade-scheduler.test.ts`).
 */
import type { MediaPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentationMediaController } from './media-controller';

let container: HTMLDivElement;
let root: Root;
let mediaEl: HTMLVideoElement | null = null;

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
	vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
		function (this: HTMLMediaElement) {
			Object.defineProperty(this, 'paused', { value: true, configurable: true });
		},
	);
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function videoElement(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		id: 'video-el-1',
		type: 'media',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		mediaType: 'video',
		mediaPath: 'ppt/media/media1.mp4',
		...overrides,
	} as MediaPptxElement;
}

function renderController(element: MediaPptxElement): void {
	act(() => {
		root.render(
			<PresentationMediaController
				element={element}
				isPresentationMode
				shouldAutoPlay={false}
				isFullScreen={false}
			>
				{({ mediaRef, onPlay }) => (
					<video
						ref={(node: HTMLVideoElement | null) => {
							mediaRef.current = node;
							mediaEl = node;
						}}
						onPlay={onPlay}
					/>
				)}
			</PresentationMediaController>,
		);
	});
}

describe('presentationMediaController trim-end + fade (G20)', () => {
	it('stops at duration - trimEndMs (distance from the tail), not at trimEndMs itself', () => {
		// COM-verified semantics (see PptxHandlerRuntimeMediaParsingUtils.ts):
		// trimEndMs is a distance from the clip's end, not an absolute stop.
		renderController(videoElement({ trimEndMs: 5000 }));
		const el = mediaEl!;
		Object.defineProperty(el, 'duration', { value: 20, configurable: true });
		Object.defineProperty(el, 'paused', { value: false, configurable: true, writable: true });

		act(() => {
			el.dispatchEvent(new Event('play'));
		});
		act(() => {
			vi.advanceTimersByTime(15_000);
		});

		expect(el.pause).toHaveBeenCalledWith();
		expect(el.currentTime).toBe(15);
	});

	it('seeks to trimStartMs on play', () => {
		renderController(videoElement({ trimStartMs: 2500 }));
		const el = mediaEl!;
		Object.defineProperty(el, 'paused', { value: false, configurable: true, writable: true });

		act(() => {
			el.dispatchEvent(new Event('play'));
		});

		expect(el.currentTime).toBe(2.5);
	});

	it('does nothing extra when the element has no trim or fade', () => {
		renderController(videoElement());
		const el = mediaEl!;
		Object.defineProperty(el, 'paused', { value: false, configurable: true, writable: true });

		expect(() => {
			act(() => {
				el.dispatchEvent(new Event('play'));
			});
			act(() => {
				vi.advanceTimersByTime(60_000);
			});
		}).not.toThrow();
		expect(el.pause).not.toHaveBeenCalled();
	});
});
