import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderMediaElement } from './media';

const MP4_DATA_URL = 'data:video/mp4;base64,AAAA';

function makeContext(presenting: boolean): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting,
		interactive: !presenting,
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
		mediaType: 'video',
		mediaData: MP4_DATA_URL,
		...overrides,
	} as PptxElement;
}

describe('media fullScrn overlay wiring', () => {
	it('stays at the authored frame until playback actually starts', () => {
		const node = renderMediaElement(
			mediaElement({ fullScreen: true }),
			0,
			makeContext(true),
		) as HTMLElement;
		expect(node.style.width).not.toBe('100%');
		expect(node.querySelector('.pptxv-media-fullscreen-stop')).toBeNull();
	});

	it('switches to the full-slide overlay once the clip starts playing', () => {
		const node = renderMediaElement(
			mediaElement({ fullScreen: true }),
			0,
			makeContext(true),
		) as HTMLElement;
		const video = node.querySelector<HTMLVideoElement>('video')!;

		video.dispatchEvent(new Event('play'));

		expect(node.style.width).toBe('100%');
		expect(node.style.height).toBe('100%');
		const stopButton = node.querySelector<HTMLButtonElement>('.pptxv-media-fullscreen-stop');
		expect(stopButton).toBeTruthy();
		expect(stopButton?.getAttribute('aria-label')).toBe('Stop full-screen playback');
	});

	it('reverts to the authored frame and removes the stop button on pause', () => {
		const node = renderMediaElement(
			mediaElement({ fullScreen: true }),
			0,
			makeContext(true),
		) as HTMLElement;
		const video = node.querySelector<HTMLVideoElement>('video')!;

		video.dispatchEvent(new Event('play'));
		video.dispatchEvent(new Event('pause'));

		expect(node.style.width).toBe('320px'); // back to the authored (painted) width
		expect(node.querySelector('.pptxv-media-fullscreen-stop')).toBeNull();
	});

	it('does not overlay an authored fullScrn clip on the authoring canvas', () => {
		const node = renderMediaElement(
			mediaElement({ fullScreen: true }),
			0,
			makeContext(false),
		) as HTMLElement;
		const video = node.querySelector<HTMLVideoElement>('video')!;

		video.dispatchEvent(new Event('play'));

		expect(node.style.width).not.toBe('100%');
		expect(node.querySelector('.pptxv-media-fullscreen-stop')).toBeNull();
	});

	it('clicking the stop button pauses playback', () => {
		const node = renderMediaElement(
			mediaElement({ fullScreen: true }),
			0,
			makeContext(true),
		) as HTMLElement;
		const video = node.querySelector<HTMLVideoElement>('video')!;
		video.dispatchEvent(new Event('play'));
		Object.defineProperty(video, 'paused', { value: false, configurable: true });
		let paused = false;
		video.pause = () => {
			paused = true;
			Object.defineProperty(video, 'paused', { value: true, configurable: true });
		};

		node.querySelector<HTMLButtonElement>('.pptxv-media-fullscreen-stop')!.click();

		expect(paused).toBeTruthy();
	});

	it('never activates for media not authored fullScrn', () => {
		const node = renderMediaElement(mediaElement({}), 0, makeContext(true)) as HTMLElement;
		const video = node.querySelector<HTMLVideoElement>('video')!;

		video.dispatchEvent(new Event('play'));

		expect(node.style.width).not.toBe('100%');
		expect(node.querySelector('.pptxv-media-fullscreen-stop')).toBeNull();
	});
});
