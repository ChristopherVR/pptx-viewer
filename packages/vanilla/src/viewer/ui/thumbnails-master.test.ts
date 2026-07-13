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
		expect(rail.el.textContent).toContain('Corporate');
		expect(rail.el.textContent).toContain('Title');
		(rail.el.querySelectorAll('button')[1] as HTMLButtonElement).click();
		expect(select).toHaveBeenCalledWith(0, 0);
	});
});
