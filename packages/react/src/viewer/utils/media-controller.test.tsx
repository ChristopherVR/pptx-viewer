// @vitest-environment happy-dom
/**
 * Play-across-slides audio in the PresentationMediaController.
 *
 * Regression: the persistent-audio branch resolved its source as
 * `element.mediaData ?? undefined`, so audio whose bytes live in the
 * mediaDataUrls map (the normal case for a loaded .pptx) never registered,
 * AND the branch still returned early, so the inline element never played
 * either. The controller now receives the same resolved src the inline path
 * renders with (`resolvedDataUrl`) and only skips inline playback when the
 * persistent registration actually has a source.
 */
import type { MediaPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PresentationMediaController } from './media-controller';
import { hasPersistentAudio, stopAllPersistentAudio } from './media-persistent-audio';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
	vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	stopAllPersistentAudio();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function audioElement(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		id: 'audio-el-1',
		type: 'media',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		mediaType: 'audio',
		mediaPath: 'ppt/media/media1.mp3',
		playAcrossSlides: true,
		...overrides,
	} as MediaPptxElement;
}

function renderController(element: MediaPptxElement, resolvedDataUrl: string | undefined): void {
	act(() => {
		root.render(
			<PresentationMediaController
				element={element}
				isPresentationMode
				shouldAutoPlay
				resolvedDataUrl={resolvedDataUrl}
				isFullScreen={false}
			>
				{({ mediaRef }) => (
					<audio
						ref={(node: HTMLAudioElement | null) => {
							mediaRef.current = node;
						}}
					/>
				)}
			</PresentationMediaController>,
		);
	});
}

describe('play-across-slides in PresentationMediaController', () => {
	it('registers persistent audio from the mediaDataUrls-resolved src when mediaData is unset', () => {
		const element = audioElement({ loop: true, volume: 0.5, trimStartMs: 2000 });
		expect(element.mediaData).toBeUndefined();

		// Same resolution the inline path (renderMediaElement) performs.
		const mediaDataUrls = new Map([['ppt/media/media1.mp3', 'data:audio/mpeg;base64,AAAA']]);
		const resolved = element.mediaData ?? mediaDataUrls.get(element.mediaPath ?? '');

		renderController(element, resolved);

		expect(hasPersistentAudio('audio-el-1')).toBeTruthy();
		const detached = document.querySelector<HTMLAudioElement>(
			'[data-pptx-persistent-audio="audio-el-1"]',
		);
		expect(detached?.getAttribute('src')).toBe('data:audio/mpeg;base64,AAAA');
		// The element's playback settings are honored like the inline path.
		expect(detached?.loop).toBeTruthy();
		expect(detached?.volume).toBe(0.5);
	});

	it('prefers element.mediaData over the map-resolved src', () => {
		const element = audioElement({ mediaData: 'data:audio/mpeg;base64,BBBB' });
		renderController(element, 'data:audio/mpeg;base64,AAAA');

		const detached = document.querySelector<HTMLAudioElement>(
			'[data-pptx-persistent-audio="audio-el-1"]',
		);
		expect(detached?.getAttribute('src')).toBe('data:audio/mpeg;base64,BBBB');
	});

	it('falls through to inline playback when no source resolves at all', () => {
		vi.useFakeTimers();
		const element = audioElement();
		renderController(element, undefined);

		expect(hasPersistentAudio('audio-el-1')).toBeFalsy();
		// The auto-play effect no longer returns early: the inline element's
		// delayed play (100 ms) still runs.
		act(() => {
			vi.advanceTimersByTime(150);
		});
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledWith();
	});
});
