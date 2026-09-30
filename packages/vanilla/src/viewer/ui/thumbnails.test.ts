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
	it('moves the current-page cue and delegates row spacing to the shared window', () => {
		const onSelect = vi.fn();
		const rail = createThumbnailRail(document, createTranslator(), onSelect);
		rail.render(makeSlides(3), CANVAS, slideRenderer);
		const window = rail.el.querySelector<HTMLElement>('[data-pptx-chrome="slide-window"]')!;
		expect(window.style.gap).toBe('');
		const rows = window.querySelectorAll<HTMLButtonElement>('[data-pptx-chrome="slide-row"]');
		rail.setActive(1);
		expect(rows[0].hasAttribute('aria-current')).toBeFalsy();
		expect(rows[1].getAttribute('aria-current')).toBe('page');
		expect(rows[1].querySelector('[data-pptx-chrome="slide-number"]')?.textContent).toBe('2');
		rows[2].click();
		expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('preserves slide aspect ratio inside the shared desktop rail', () => {
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(makeSlides(3), CANVAS, slideRenderer);
		const frame = rail.el.querySelector<HTMLElement>('[data-pptx-chrome="slide-frame"]');
		expect(rail.el.style.width).toBe('180px');
		expect(frame?.style.width).toBe('132px');
		expect(frame?.style.height).toBe('74.25px');
	});

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
