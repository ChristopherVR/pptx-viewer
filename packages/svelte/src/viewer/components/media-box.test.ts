import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * MediaBox tests: playable-source resolution (embedded data URL, then the
 * mediaDataUrls map), native video/audio controls, the poster-only fallback,
 * and the labelled unavailable-media box, mirroring the vanilla media tests.
 */

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MP4_DATA_URL = 'data:video/mp4;base64,AAAA';
const MP3_DATA_URL = 'data:audio/mpeg;base64,AAAA';

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, mediaDataUrls = new Map<string, string>()): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls, zIndex: 2 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
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
		const target = mountEl(
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
		const target = mountEl(
			mediaElement({ mediaType: 'video', mediaPath: 'ppt/media/movie.mp4' }),
			urls,
		);
		expect(target.querySelector('video')?.getAttribute('src')).toBe('blob:movie');
	});

	it('renders a native <audio controls> for audio media', () => {
		const target = mountEl(mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }));
		const audio = target.querySelector<HTMLAudioElement>('audio');
		expect(audio).toBeTruthy();
		expect(audio?.getAttribute('src')).toBe(MP3_DATA_URL);
		expect(audio?.hasAttribute('controls')).toBeTruthy();
		expect(target.querySelector('video')).toBeNull();
	});

	it('falls back to the poster image when no playable source exists', () => {
		const target = mountEl(mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL }));
		expect(target.querySelector('video')).toBeNull();
		expect(target.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URL);
	});

	it('renders a labelled fallback box when the media is unavailable', () => {
		const target = mountEl(mediaElement({ mediaType: 'video' }));
		expect(target.querySelector('video')).toBeNull();
		expect(target.querySelector('img')).toBeNull();
		const container = target.querySelector<HTMLElement>('[data-element-id="m1"]');
		expect(container?.classList.contains('pptx-svelte-media-fallback')).toBeTruthy();
		expect(container?.textContent).toContain('Media');
	});
});
