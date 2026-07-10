import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderMediaElement } from './media';

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MP4_DATA_URL = 'data:video/mp4;base64,AAAA';
const MP3_DATA_URL = 'data:audio/mpeg;base64,AAAA';

function makeContext(mediaDataUrls = new Map<string, string>()): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls,
		t: createTranslator(),
		smartArt3D: false,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

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

describe('renderMediaElement', () => {
	it('returns null for non-media elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderMediaElement(el, 0, makeContext())).toBeNull();
	});

	it('renders a native <video> with controls and poster from embedded data', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL, posterFrameData: PNG_DATA_URL }),
			2,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('m1');
		expect(node.style.left).toBe('40px');
		expect(node.style.zIndex).toBe('2');

		const video = node.querySelector<HTMLVideoElement>('video');
		expect(video).toBeTruthy();
		expect(video?.getAttribute('src')).toBe(MP4_DATA_URL);
		expect(video?.controls).toBeTruthy();
		expect(video?.getAttribute('poster')).toBe(PNG_DATA_URL);
	});

	it('resolves mediaPath through the mediaDataUrls map', () => {
		const urls = new Map([['ppt/media/movie.mp4', 'blob:movie']]);
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', mediaPath: 'ppt/media/movie.mp4' }),
			0,
			makeContext(urls),
		) as HTMLElement;
		expect(node.querySelector('video')?.getAttribute('src')).toBe('blob:movie');
	});

	it('renders a native <audio controls> for audio media', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;
		const audio = node.querySelector<HTMLAudioElement>('audio');
		expect(audio).toBeTruthy();
		expect(audio?.getAttribute('src')).toBe(MP3_DATA_URL);
		expect(audio?.controls).toBeTruthy();
		expect(node.querySelector('video')).toBeNull();
	});

	it('falls back to the poster image when no playable source exists', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('video')).toBeNull();
		expect(node.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URL);
	});

	it('renders a labelled fallback box when the media is unavailable', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video' }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('video')).toBeNull();
		expect(node.querySelector('img')).toBeNull();
		expect(node.classList.contains('pptxv-placeholder')).toBeTruthy();
		expect(node.textContent).toContain('Media');
	});
});
