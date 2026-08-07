// @vitest-environment happy-dom
/**
 * Unplayable-media fallback (issue #147).
 *
 * A slide-transition overlay renders the outgoing slide through
 * `StaticElementRenderer`, which deliberately passes NO media map: a ghost must
 * not mount a second decoder for a video the live stage is already playing. The
 * media renderer therefore fell back to the poster frame AND to the play badge
 * that goes with it, so `solution-explorer.pptx` painted a mystery play
 * triangle across the middle of every morph out of its slide-2 background
 * video. The badge (and the typed placeholder box) is authoring chrome; the
 * surface rules now come from the shared `mediaFallbackVisual`.
 */
import type { MediaPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { renderMediaElement } from './media-render';
import type { RenderMediaOptions } from './media-render';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const PNG_DATA_URL = 'data:image/png;base64,AAAA';

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

function paint(element: MediaPptxElement, options: RenderMediaOptions): HTMLDivElement {
	act(() => {
		root.render(<>{renderMediaElement(element, new Map(), options)}</>);
	});
	return container;
}

describe('renderMediaElement fallback chrome', () => {
	// The surface a transition overlay, a thumbnail and a presenter-console pane
	// all report.
	const still: RenderMediaOptions = { preview: true, showTransport: false };

	it('paints the poster frame with no play badge on a still of a slide', () => {
		const node = paint(media({ posterFrameData: PNG_DATA_URL }), still);
		expect(node.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URL);
		expect(node.querySelector('[data-pptx-media-chrome]')).toBeNull();
	});

	it('paints nothing at all for unresolvable media on a still', () => {
		const node = paint(media(), still);
		expect(node.textContent).toBe('');
		expect(node.querySelector('svg')).toBeNull();
	});

	it('paints no missing-media mark on a still, only the poster', () => {
		const node = paint(media({ mediaMissing: true, posterFrameData: PNG_DATA_URL }), still);
		expect(node.querySelector('img')?.className).not.toContain('opacity-50');
		expect(node.querySelector('[data-pptx-media-chrome]')).toBeNull();
	});

	it('paints no chrome during a running show either', () => {
		const node = paint(media({ posterFrameData: PNG_DATA_URL }), { isPresentationMode: true });
		expect(node.querySelector('img')).toBeTruthy();
		expect(node.querySelector('[data-pptx-media-chrome]')).toBeNull();
	});

	it('keeps the play badge over the poster on the authoring canvas', () => {
		const node = paint(media({ posterFrameData: PNG_DATA_URL }), {});
		expect(node.querySelector('[data-pptx-media-chrome="play"]')).toBeTruthy();
	});

	it('keeps the typed placeholder box on the authoring canvas', () => {
		const node = paint(media(), {});
		expect(node.querySelector('[data-pptx-media-chrome="placeholder"]')).toBeTruthy();
		expect(node.textContent).toContain('Video');
	});

	it('keeps the missing-media mark and the dimmed poster on the canvas', () => {
		const node = paint(media({ mediaMissing: true, posterFrameData: PNG_DATA_URL }), {});
		expect(node.querySelector('img')?.className).toContain('opacity-50');
		expect(node.querySelector('[data-pptx-media-chrome="missing"]')).toBeTruthy();
	});
});
