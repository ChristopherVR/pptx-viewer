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
			crudActions: [],
			onCrudAction: vi.fn(),
		});

		const tabs = sidebar.el.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		expect(tabs).toHaveLength(3);
		expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
		expect(sidebar.el.textContent).toContain('Body');
		expect(sidebar.el.textContent).toContain('Slide Image');
		// The aria-label is the translated pptx.master.backgroundColorLabel key
		// (English resolves to this literal string), distinct from the card's
		// visible pptx.master.notesMasterBackground heading.
		const background = sidebar.el.querySelector<HTMLInputElement>(
			'input[aria-label="Master background color"]',
		);
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
			crudActions: [],
			onCrudAction: vi.fn(),
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

	// B4: the sidebar's Insert/Duplicate/Delete/Rename Layout/Master row.
	it('renders one button per CRUD action, disabled with a reason, and runs on click', () => {
		const onCrudAction = vi.fn();
		const sidebar = createMasterViewSidebar(document, createTranslator());
		sidebar.render({
			tab: 'slides',
			masters: [{ path: 'master-1', name: 'Corporate', elements: [], layouts: [] }],
			active: { masterIndex: 0, layoutIndex: null },
			canvasSize: { width: 960, height: 540 },
			notesMasterPresent: false,
			handoutMasterPresent: false,
			handoutSlidesPerPage: 4,
			editable: true,
			renderStage,
			onSelect: vi.fn(),
			onTabChange: vi.fn(),
			onCollapse: vi.fn(),
			onHandoutSlidesPerPageChange: vi.fn(),
			onMasterBackgroundColorChange: vi.fn(),
			crudActions: [
				{ id: 'addLayout', labelKey: 'pptx.masterView.addLayout', enabled: true },
				{
					id: 'deleteMaster',
					labelKey: 'pptx.masterView.deleteMaster',
					enabled: false,
					disabledReasonKey: 'pptx.masterView.lastMaster',
				},
			],
			onCrudAction,
		});

		const addLayout = sidebar.el.querySelector<HTMLButtonElement>(
			'[data-testid="pptx-master-crud-addLayout"]',
		);
		const deleteMaster = sidebar.el.querySelector<HTMLButtonElement>(
			'[data-testid="pptx-master-crud-deleteMaster"]',
		);
		expect(addLayout?.disabled).toBeFalsy();
		expect(deleteMaster?.disabled).toBeTruthy();
		expect(deleteMaster?.title).toBe('The last slide master cannot be deleted.');

		addLayout?.click();
		expect(onCrudAction).toHaveBeenCalledExactlyOnceWith('addLayout');
	});
});
