/**
 * Thumbnail-rail tests for the display contract: the rail must never carry an
 * inline `display` style, because presentation mode and the mobile layout hide
 * it with stylesheet rules (`.pptxv-presenting .pptxv-thumbs` / the mobile
 * media query) that inline styles would override, leaking thumbnail content
 * into the presented slide show.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createThumbnailRail } from './thumbnails';

const CANVAS = { width: 960, height: 540 };

function slideRenderer(slide: PptxSlide): HTMLElement {
	const el = document.createElement('div');
	el.dataset.slideId = slide.id;
	return el;
}

function makeSlides(count: number): PptxSlide[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `slide-${index}`,
		rId: `rId-${index}`,
		slideNumber: index + 1,
		elements: [],
	})) as PptxSlide[];
}

describe('thumbnail rail display contract', () => {
	it('never sets an inline display style (small deck)', () => {
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(makeSlides(3), CANVAS, slideRenderer);
		expect(rail.el.style.display).toBe('');
		expect(rail.el.classList.contains('pptxv-thumbs-virtualized')).toBeFalsy();
	});

	it('switches to the virtualized class (not an inline style) for large decks', () => {
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(makeSlides(100), CANVAS, slideRenderer);
		expect(rail.el.style.display).toBe('');
		expect(rail.el.classList.contains('pptxv-thumbs-virtualized')).toBeTruthy();
	});

	it('drops the virtualized class again when the deck shrinks', () => {
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(makeSlides(100), CANVAS, slideRenderer);
		rail.render(makeSlides(3), CANVAS, slideRenderer);
		expect(rail.el.classList.contains('pptxv-thumbs-virtualized')).toBeFalsy();
	});

	it('drops the virtualized class in master view', () => {
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(makeSlides(100), CANVAS, slideRenderer);
		rail.renderMasters(
			[{ path: 'master-1', name: 'Corporate', elements: [], layouts: [] }],
			CANVAS,
			slideRenderer,
			vi.fn(),
			{ masterIndex: 0, layoutIndex: null },
		);
		expect(rail.el.style.display).toBe('');
		expect(rail.el.classList.contains('pptxv-thumbs-virtualized')).toBeFalsy();
	});

	it('setVisible toggles the hidden attribute', () => {
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.setVisible(false);
		expect(rail.el.hidden).toBeTruthy();
		rail.setVisible(true);
		expect(rail.el.hidden).toBeFalsy();
	});
});
