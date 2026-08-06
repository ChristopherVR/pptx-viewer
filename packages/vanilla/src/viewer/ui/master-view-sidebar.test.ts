import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createMasterViewSidebar } from './master-view-sidebar';

function renderStage(slide: PptxSlide): HTMLElement {
	const el = document.createElement('div');
	el.dataset.slideId = slide.id;
	return el;
}

describe('master view sidebar', () => {
	it('switches between the shared Slide, Notes, and Handout tabs', () => {
		const onTabChange = vi.fn();
		const onBackground = vi.fn();
		const sidebar = createMasterViewSidebar(document, createTranslator());
		sidebar.render({
			tab: 'notes',
			masters: [],
			active: { masterIndex: 0, layoutIndex: null },
			canvasSize: { width: 960, height: 540 },
			notesBackground: '#abcdef',
			notesPlaceholders: [{ type: 'body' }, { type: 'sldImg' }],
			notesMasterPresent: true,
			handoutMasterPresent: false,
			handoutSlidesPerPage: 4,
			renderStage,
			onSelect: vi.fn(),
			onTabChange,
			onCollapse: vi.fn(),
			onHandoutSlidesPerPageChange: vi.fn(),
			onMasterBackgroundColorChange: onBackground,
		});

		const tabs = sidebar.el.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		expect(tabs).toHaveLength(3);
		expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
		expect(sidebar.el.textContent).toContain('Body');
		expect(sidebar.el.textContent).toContain('Slide Image');
		// The aria-label is the translated Background card label (en dictionary).
		const background = sidebar.el.querySelector<HTMLInputElement>('input[aria-label="Background"]');
		expect(background?.value).toBe('#abcdef');
		if (background) {
			background.value = '#123456';
			background.dispatchEvent(new Event('input'));
		}
		expect(onBackground).toHaveBeenCalledWith('#123456');
		tabs[2]?.click();
		expect(onTabChange).toHaveBeenCalledWith('handout');
	});

	it('renders master thumbnails and history-aware handout layout controls', () => {
		const onSelect = vi.fn();
		const onCount = vi.fn();
		const sidebar = createMasterViewSidebar(document, createTranslator());
		const base = {
			active: { masterIndex: 0, layoutIndex: null },
			canvasSize: { width: 960, height: 540 },
			handoutSlidesPerPage: 6,
			notesMasterPresent: false,
			handoutMasterPresent: true,
			renderStage,
			onSelect,
			onTabChange: vi.fn(),
			onCollapse: vi.fn(),
			onHandoutSlidesPerPageChange: onCount,
			onMasterBackgroundColorChange: vi.fn(),
		};
		sidebar.render({
			...base,
			tab: 'slides',
			masters: [
				{
					path: 'master-1',
					name: 'Corporate',
					elements: [],
					layouts: [{ path: 'layout-1', name: 'Title', elements: [] }],
				},
			],
		});
		const thumbs = sidebar.el.querySelectorAll<HTMLButtonElement>('.pptxv-master-thumb');
		expect(thumbs).toHaveLength(2);
		thumbs[1]?.click();
		expect(onSelect).toHaveBeenCalledWith(0, 0);

		sidebar.render({
			...base,
			tab: 'handout',
			masters: [],
			handoutBackground: '#ffffff',
			handoutPlaceholders: [],
		});
		const selected = sidebar.el.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
		expect(selected?.textContent).toBe('6');
		sidebar.el.querySelectorAll<HTMLButtonElement>('.pptxv-master-count')[3]?.click();
		expect(onCount).toHaveBeenCalledWith(4);
	});
});
