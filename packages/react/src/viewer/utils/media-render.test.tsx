// @vitest-environment happy-dom
/**
 * `renderMediaElement`'s online-video branch: a linked YouTube/Vimeo URL is a
 * web page, not a media stream, so `<video src>` cannot decode it and shows
 * nothing. See `pptx-viewer-shared`'s `online-video` module for the URL
 * recognition/normalisation this renders on top of.
 */
import type { MediaPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { renderMediaElement } from './media-render';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function media(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		type: 'media',
		id: 'm1',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		...overrides,
	} as MediaPptxElement;
}

function paint(element: MediaPptxElement): HTMLDivElement {
	act(() => {
		root.render(<>{renderMediaElement(element, new Map())}</>);
	});
	return container;
}

describe('renderMediaElement online video', () => {
	it('renders a provider iframe for a linked YouTube URL instead of <video>', () => {
		const node = paint(
			media({ mediaPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', isLinked: true }),
		);
		const iframe = node.querySelector('iframe');
		expect(iframe).toBeTruthy();
		expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
		expect(iframe?.getAttribute('title')).toBe('Online video');
		expect(node.querySelector('video')).toBeNull();
	});

	it('keeps the native <video> for a plain linked media file', () => {
		const node = paint(
			media({ mediaData: 'data:video/mp4;base64,AAAA', mediaPath: 'ppt/media/movie.mp4' }),
		);
		expect(node.querySelector('iframe')).toBeNull();
	});
});
