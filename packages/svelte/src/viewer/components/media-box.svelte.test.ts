import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * MediaBox tests: playable-source resolution (embedded data URL, then the
 * mediaDataUrls map), native video/audio controls, the poster-only fallback,
 * the labelled unavailable-media box (mirroring the vanilla media tests), and
 * presentation-mode autoplay wiring (mirroring Vue's `ElementMediaBox.vue`
 * autoplay behaviour, mocking the shared `startMediaAutoplay` the same way
 * `smart-art-3d-view.test.ts` mocks `mountSmartArt3D`).
 *
 * This file is named `*.svelte.test.ts` (not plain `.test.ts`) so its own
 * module body can use runes: `mountEl` below wraps the mounted component's
 * props in `$state(...)` so `presenting` stays reactive after mount (a plain
 * object passed to `mount(Component, { props })` is only read once via a
 * getter; svelte's `prop()` helper explicitly special-cases a `$state`-proxied
 * props object for exactly this "imperative mount + later prop update" case).
 */

// Mock the shared autoplay helper so tests can assert it was invoked (and
// with what args) without depending on real (start-of-)playback semantics.
const { startMediaAutoplay } = vi.hoisted(() => ({ startMediaAutoplay: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		startMediaAutoplay: (...args: Parameters<typeof actual.startMediaAutoplay>) =>
			startMediaAutoplay(...args),
	};
});

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MP4_DATA_URL = 'data:video/mp4;base64,AAAA';
const MP3_DATA_URL = 'data:audio/mpeg;base64,AAAA';

let cleanup: (() => void) | undefined;

interface MountResult {
	target: HTMLElement;
	/** Reactively updates the mounted instance's `presenting` prop. */
	setPresenting: (value: boolean) => void;
}

function mountEl(
	element: PptxElement,
	mediaDataUrls = new Map<string, string>(),
	presenting = false,
): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ element, mediaDataUrls, zIndex: 2, presenting });
	const instance = mount(ElementRenderer, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return {
		target,
		setPresenting: (value: boolean) => {
			props.presenting = value;
			flushSync();
		},
	};
}

beforeEach(() => {
	startMediaAutoplay.mockReset();
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

function mediaElement(overrides: Record<string, unknown>): PptxElement {
	return {
		type: 'media',
		id: 'm1',
		x: 40,
		y: 60,
		width: 320,
		height: 180,
		...overrides,
	} as PptxElement;
}

describe('mediaBox', () => {
	it('renders a native <video> with controls and poster from embedded data', () => {
		const { target } = mountEl(
			mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL, posterFrameData: PNG_DATA_URL }),
		);
		const container = target.querySelector<HTMLElement>('[data-element-id="m1"]');
		const style = container?.getAttribute('style') ?? '';
		expect(style).toContain('left: 40px');
		expect(style).toContain('z-index: 2');

		const video = container?.querySelector<HTMLVideoElement>('video');
		expect(video).toBeTruthy();
		expect(video?.getAttribute('src')).toBe(MP4_DATA_URL);
		expect(video?.hasAttribute('controls')).toBeTruthy();
		expect(video?.getAttribute('poster')).toBe(PNG_DATA_URL);
	});

	it('resolves mediaPath through the mediaDataUrls map', () => {
		const urls = new Map([['ppt/media/movie.mp4', 'blob:movie']]);
		const { target } = mountEl(
			mediaElement({ mediaType: 'video', mediaPath: 'ppt/media/movie.mp4' }),
			urls,
		);
		expect(target.querySelector('video')?.getAttribute('src')).toBe('blob:movie');
	});

	it('renders a native <audio controls> for audio media', () => {
		const { target } = mountEl(mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }));
		const audio = target.querySelector<HTMLAudioElement>('audio');
		expect(audio).toBeTruthy();
		expect(audio?.getAttribute('src')).toBe(MP3_DATA_URL);
		expect(audio?.hasAttribute('controls')).toBeTruthy();
		expect(target.querySelector('video')).toBeNull();
	});

	it('falls back to the poster image when no playable source exists', () => {
		const { target } = mountEl(mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL }));
		expect(target.querySelector('video')).toBeNull();
		expect(target.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URL);
	});

	it('renders a labelled fallback box when the media is unavailable', () => {
		const { target } = mountEl(mediaElement({ mediaType: 'video' }));
		expect(target.querySelector('video')).toBeNull();
		expect(target.querySelector('img')).toBeNull();
		const container = target.querySelector<HTMLElement>('[data-element-id="m1"]');
		expect(container?.classList.contains('pptx-svelte-media-fallback')).toBeTruthy();
		expect(container?.textContent).toContain('Media');
	});

	describe('presentation-mode autoplay', () => {
		it('does not autoplay when presenting is false', () => {
			mountEl(mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }), undefined, false);
			expect(startMediaAutoplay).not.toHaveBeenCalled();
		});

		it('starts autoplay once the video element is mounted and presenting is true', () => {
			const { target } = mountEl(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				undefined,
				true,
			);
			const video = target.querySelector<HTMLVideoElement>('video');
			expect(startMediaAutoplay).toHaveBeenCalledExactlyOnceWith(video, { trimStartMs: undefined });
		});

		it('passes trimStartMs through to the shared autoplay helper', () => {
			const { target } = mountEl(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL, trimStartMs: 1500 }),
				undefined,
				true,
			);
			const video = target.querySelector<HTMLVideoElement>('video');
			expect(startMediaAutoplay).toHaveBeenCalledExactlyOnceWith(video, { trimStartMs: 1500 });
		});

		it('autoplays audio elements the same way as video', () => {
			const { target } = mountEl(
				mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }),
				undefined,
				true,
			);
			const audio = target.querySelector<HTMLAudioElement>('audio');
			expect(startMediaAutoplay).toHaveBeenCalledExactlyOnceWith(audio, { trimStartMs: undefined });
		});

		it('pauses playback when presenting flips from true to false', async () => {
			const { target, setPresenting } = mountEl(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				undefined,
				true,
			);
			expect(startMediaAutoplay).toHaveBeenCalledOnce();

			const video = target.querySelector<HTMLVideoElement>('video');
			// `startMediaAutoplay` is mocked (it never actually starts real
			// playback), so drive happy-dom's real `play()` directly to put the
			// element into a "currently playing" state before flipping.
			await video?.play();
			expect(video?.paused).toBeFalsy();

			setPresenting(false);
			expect(video?.paused).toBeTruthy();
		});
	});
});
