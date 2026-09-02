import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import { createPptxViewer, PptxViewer } from './PptxViewer';
import type { PptxViewerInstance } from './types';

/**
 * B1: entering the show "from current slide" must land on a slide the show
 * actually includes, not the raw active slide. Every way of entering the show
 * from current (status-bar button, ribbon From Current Slide, Shift+F5,
 * `setMode('present')`, mobile toolbar) funnels through `enterPresentation()`,
 * so this exercises that single seam.
 */

let active: PptxViewerInstance[] = [];

function mount(): { container: HTMLElement; viewer: PptxViewerInstance } {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = createPptxViewer(container);
	active.push(viewer);
	return { container, viewer };
}

function asViewer(viewer: PptxViewerInstance): PptxViewer {
	return viewer as PptxViewer;
}

function slides(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_v, index) =>
			({
				id: `s${String(index + 1)}`,
				rId: `rId${String(index + 1)}`,
				slideNumber: index + 1,
				elements: [],
			}) as PptxSlide,
	);
}

afterEach(() => {
	for (const viewer of active) {
		viewer.destroy();
	}
	active = [];
	document.body.replaceChildren();
});

describe('entering the show seeds a slide the show includes', () => {
	it('starts on the authored range start when the active slide is outside it', async () => {
		const { viewer } = mount();
		const instance = asViewer(viewer);
		instance.store.set({
			slides: slides(3),
			currentSlide: 0,
			presentationProperties: {
				...instance.store.get().presentationProperties,
				showSlidesMode: 'range',
				// 1-based: slides 2..3.
				showSlidesFrom: 2,
				showSlidesTo: 3,
			},
		});
		await instance.enterPresentation();
		expect(instance.store.get().currentSlide).toBe(1);
	});

	it('leaves the active slide alone when the show already includes it', async () => {
		const { viewer } = mount();
		const instance = asViewer(viewer);
		instance.store.set({
			slides: slides(3),
			currentSlide: 2,
			presentationProperties: {
				...instance.store.get().presentationProperties,
				showSlidesMode: 'range',
				showSlidesFrom: 2,
				showSlidesTo: 3,
			},
		});
		await instance.enterPresentation();
		expect(instance.store.get().currentSlide).toBe(2);
	});
});
