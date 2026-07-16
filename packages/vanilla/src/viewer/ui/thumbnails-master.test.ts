import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createThumbnailRail } from './thumbnails';

describe('master thumbnail rail', () => {
	it('renders master and layout navigation targets', () => {
		const slideRenderer = (slide: PptxSlide) => {
			const el = document.createElement('div');
			el.dataset.slideId = slide.id;
			return el;
		};
		const select = vi.fn();
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.renderMasters(
			[
				{
					path: 'master-1',
					name: 'Corporate',
					elements: [],
					layouts: [{ path: 'layout-1', name: 'Title', elements: [] }],
				},
			],
			{ width: 960, height: 540 },
			slideRenderer,
			select,
			{ masterIndex: 0, layoutIndex: null },
		);

		expect(rail.el.querySelectorAll('button')).toHaveLength(2);
		expect(rail.el.tagName).toBe('ASIDE');
		expect(rail.el.getAttribute('role')).toBe('navigation');
		expect(rail.el.getAttribute('aria-label')).toBe('Slides');
		expect(rail.el.querySelector('button')?.getAttribute('aria-current')).toBe('page');
		expect(rail.el.textContent).toContain('Corporate');
		expect(rail.el.textContent).toContain('Title');
		(rail.el.querySelectorAll('button')[1] as HTMLButtonElement).click();
		expect(select).toHaveBeenCalledWith(0, 0);
	});

	it('virtualizes large slide decks and keeps the active slide rendered', () => {
		const slides = Array.from({ length: 100 }, (_, index) => ({
			id: `slide-${index}`,
			rId: `rId-${index}`,
			slideNumber: index + 1,
			elements: [],
		})) as PptxSlide[];
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(slides, { width: 960, height: 540 }, (slide) => {
			const el = document.createElement('div');
			el.dataset.slideId = slide.id;
			return el;
		});
		expect(rail.el.querySelector('[data-virtualized="true"]')).toBeTruthy();
		expect(rail.el.querySelectorAll('.pptxv-thumb').length).toBeLessThan(30);

		rail.setActive(80);
		expect(rail.el.querySelector('[data-slide-index="80"]')?.getAttribute('aria-current')).toBe(
			'page',
		);
	});

	it('groups section slides and dispatches section controls', () => {
		const slides = Array.from({ length: 3 }, (_, index) => ({
			id: `slide-${index}`,
			rId: `rId-${index}`,
			slideNumber: index + 1,
			sectionId: index < 2 ? 'section-1' : undefined,
			elements: [],
		})) as PptxSlide[];
		const actions = {
			toggle: vi.fn(),
			rename: vi.fn(),
			delete: vi.fn(),
			move: vi.fn(),
		};
		const rail = createThumbnailRail(document, createTranslator(), vi.fn());
		rail.render(
			slides,
			{ width: 960, height: 540 },
			() => document.createElement('div'),
			[{ id: 'section-1', name: 'Opening', slideIds: ['1', '2'] }],
			actions,
		);

		expect(rail.el.querySelectorAll('.pptxv-thumb-section')).toHaveLength(2);
		expect(rail.el.textContent).toContain('Opening (2)');
		expect(rail.el.textContent).toContain('Ungrouped Slides (1)');
		(rail.el.querySelector('.pptxv-thumb-section-toggle') as HTMLButtonElement).click();
		expect(actions.toggle).toHaveBeenCalledWith('section-1');
		expect(rail.el.querySelectorAll('.pptxv-thumb')).toHaveLength(3);
	});
});
