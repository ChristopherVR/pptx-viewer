/**
 * The hidden-slide cue in the thumbnail rail and the slide sorter.
 *
 * A slide the author hid is deliberately still LISTED in both (hiding only
 * removes it from the slide show), so the cue is the only thing telling a user
 * that a slide will be skipped. These assert all three signals: the neutral
 * marker attribute, the shape-based slash on the number (colour alone is not an
 * accessible signal), and the description that reaches assistive tech WITHOUT
 * disturbing the "Go to slide {{n}}" accessible name the e2e suite pins.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { HIDDEN_SLIDE_SLASH_GRADIENT } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openSlideSorterOverlay } from './slide-sorter-overlay';
import { createThumbnailRail } from './thumbnails';

const CANVAS = { width: 960, height: 540 };

function slideRenderer(slide: PptxSlide): HTMLElement {
	const el = document.createElement('div');
	el.dataset.slideId = slide.id;
	return el;
}

function makeSlides(hiddenIndexes: readonly number[]): PptxSlide[] {
	return Array.from({ length: 3 }, (_, index) => ({
		id: `slide-${index}`,
		rId: `rId-${index}`,
		slideNumber: index + 1,
		elements: [],
		hidden: hiddenIndexes.includes(index),
	})) as PptxSlide[];
}

function renderRail(hiddenIndexes: readonly number[]): HTMLElement {
	const rail = createThumbnailRail(document, createTranslator(), vi.fn());
	rail.render(makeSlides(hiddenIndexes), CANVAS, slideRenderer);
	return rail.el;
}

describe('thumbnail rail hidden-slide cue', () => {
	it('marks only the hidden slide, and still lists every slide', () => {
		const el = renderRail([1]);
		const buttons = el.querySelectorAll<HTMLButtonElement>('.pptxv-thumb');
		expect(buttons).toHaveLength(3);
		expect(buttons[0].getAttribute('data-pptx-slide-hidden')).toBeNull();
		expect(buttons[1].getAttribute('data-pptx-slide-hidden')).toBe('true');
		expect(buttons[2].getAttribute('data-pptx-slide-hidden')).toBeNull();
	});

	it('carries a cue that is not colour alone: the number is slashed', () => {
		const el = renderRail([1]);
		const num = el
			.querySelectorAll<HTMLButtonElement>('.pptxv-thumb')[1]
			.querySelector<HTMLElement>('.pptxv-thumb-num');
		// The slash itself is a stylesheet rule keyed off the marker attribute, so
		// the contract asserted here is that the shared mark is a shape.
		expect(num?.textContent).toBe('2');
		expect(HIDDEN_SLIDE_SLASH_GRADIENT).toContain('linear-gradient');
	});

	it('exposes the state to assistive tech as a description, not the name', () => {
		const el = renderRail([1]);
		const button = el.querySelectorAll<HTMLButtonElement>('.pptxv-thumb')[1];
		// The accessible NAME must stay exactly what every parity spec matches on.
		expect(button.getAttribute('aria-label')).toBe('Go to slide 2');
		const describedBy = button.getAttribute('aria-describedby');
		expect(describedBy).toBe('pptx-hidden-slide-rail-1');
		expect(el.querySelector(`#${describedBy}`)?.textContent).toContain('Hidden');
	});

	it('leaves a visible slide with no description at all', () => {
		const button = renderRail([1]).querySelectorAll<HTMLButtonElement>('.pptxv-thumb')[0];
		expect(button.getAttribute('aria-describedby')).toBeNull();
		expect(button.querySelector('.pptxv-thumb-hidden')).toBeNull();
	});
});

describe('slide sorter hidden-slide cue', () => {
	function openSorter(hiddenIndexes: readonly number[]): HTMLElement {
		const host = document.createElement('div');
		document.body.replaceChildren(host);
		openSlideSorterOverlay(document, host, createTranslator(), {
			slides: makeSlides(hiddenIndexes),
			current: 0,
			onSelect: vi.fn(),
			onReorder: vi.fn(),
			onDelete: vi.fn(),
			onDuplicate: vi.fn(),
			onToggleHidden: vi.fn(),
		});
		return host;
	}

	it('marks the hidden card and spells the state out in words', () => {
		const host = openSorter([2]);
		const cards = host.querySelectorAll<HTMLElement>('.pptxv-sorter-card');
		expect(cards).toHaveLength(3);
		expect(cards[2].getAttribute('data-pptx-slide-hidden')).toBe('true');
		expect(cards[2].querySelector('.pptxv-sorter-hidden')?.textContent).toBe('Hidden');
		expect(cards[0].getAttribute('data-pptx-slide-hidden')).toBeNull();
	});

	it('describes the hidden card without changing its accessible name', () => {
		const host = openSorter([2]);
		const preview = host
			.querySelectorAll<HTMLElement>('.pptxv-sorter-card')[2]
			.querySelector<HTMLButtonElement>('button');
		expect(preview?.getAttribute('aria-label')).toBe('Slide 3');
		expect(preview?.getAttribute('aria-describedby')).toBe('pptx-hidden-slide-sorter-2');
	});

	it('keeps the rail and sorter description ids apart (both can be mounted)', () => {
		const rail = renderRail([2]);
		const host = openSorter([2]);
		const railId = rail
			.querySelectorAll<HTMLButtonElement>('.pptxv-thumb')[2]
			.getAttribute('aria-describedby');
		const sorterId = host
			.querySelectorAll<HTMLElement>('.pptxv-sorter-card')[2]
			.querySelector('button')
			?.getAttribute('aria-describedby');
		expect(railId).not.toBe(sorterId);
	});
});
