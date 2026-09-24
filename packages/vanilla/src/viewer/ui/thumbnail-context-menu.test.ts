import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditActions } from '../editor';
import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { createThumbnailContextMenu } from './thumbnail-context-menu';
import type { ThumbnailContextMenuState } from './thumbnail-rail-menu';

const t = createTranslator('en');

function slides(count: number): PptxSlide[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `s${i}`,
		slideNumber: i + 1,
		elements: [],
	})) as unknown as PptxSlide[];
}

function stubEditActions(): {
	sections: { addSection: ReturnType<typeof vi.fn> };
	applyLayout: ReturnType<typeof vi.fn>;
} {
	return {
		applyLayout: vi.fn(),
		sections: { addSection: vi.fn() },
	};
}

function harness(overrides: Partial<{ actions: ReturnType<typeof stubEditActions> }> = {}) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const store = createStore<ViewerState>({ ...createInitialViewerState(), slides: slides(5) });
	const actions = overrides.actions ?? stubEditActions();
	const addSlideAfter = vi.fn();
	const duplicateSlides = vi.fn();
	const deleteSlides = vi.fn();
	const toggleHideSlides = vi.fn();
	const menu = createThumbnailContextMenu({
		doc: document,
		store,
		getTranslator: () => t,
		getEditActions: () => actions as unknown as EditActions,
		addSlideAfter,
		duplicateSlides,
		deleteSlides,
		toggleHideSlides,
		host,
	});
	return {
		menu,
		host,
		store,
		actions,
		addSlideAfter,
		duplicateSlides,
		deleteSlides,
		toggleHideSlides,
	};
}

function openMenu(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-pptx-slide-pane-context-menu="true"]');
}

function clickCommand(label: string): void {
	Array.from(document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item'))
		.find((node) => (node.textContent ?? '').trim() === label)
		?.click();
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('createThumbnailContextMenu', () => {
	it('renders the shared six-command set for a single-slide target', () => {
		const { menu } = harness();
		const state: ThumbnailContextMenuState = { x: 10, y: 10, index: 0, selectedIndexes: [0] };
		menu.open(state, slides(5));
		const el = openMenu();
		expect(el).not.toBeNull();
		expect(el?.getAttribute('role')).toBe('menu');
		expect(document.querySelectorAll('.pptxv-context-menu-item')).toHaveLength(6);
	});

	it('new Slide inserts after the target and closes', () => {
		const { menu, addSlideAfter } = harness();
		menu.open({ x: 0, y: 0, index: 2, selectedIndexes: [2] }, slides(5));
		clickCommand(t('pptx.slidesPane.contextMenu.newSlide'));
		expect(addSlideAfter).toHaveBeenCalledWith(2);
		expect(openMenu()).toBeNull();
	});

	it('duplicate/Delete act on the whole selection', () => {
		const { menu, duplicateSlides, deleteSlides } = harness();
		menu.open({ x: 0, y: 0, index: 1, selectedIndexes: [0, 1, 2] }, slides(5));
		clickCommand(t('pptx.slidesPane.contextMenu.duplicateCount', { count: 3 }));
		expect(duplicateSlides).toHaveBeenCalledWith([0, 1, 2]);

		menu.open({ x: 0, y: 0, index: 1, selectedIndexes: [0, 1, 2] }, slides(5));
		clickCommand(t('pptx.slidesPane.contextMenu.deleteCount', { count: 3 }));
		expect(deleteSlides).toHaveBeenCalledWith([0, 1, 2]);
	});

	it('add Section targets the right-clicked slide', () => {
		const actions = stubEditActions();
		const { menu } = harness({ actions });
		menu.open({ x: 0, y: 0, index: 3, selectedIndexes: [3] }, slides(5));
		clickCommand(t('pptx.slidesPane.contextMenu.addSection'));
		expect(actions.sections.addSection).toHaveBeenCalledWith(t('pptx.sections.defaultName'), 3);
	});

	it('layout opens a companion list of the deck layouts', () => {
		const store = createStore<ViewerState>({
			...createInitialViewerState(),
			slides: slides(2),
			slideMasters: [
				{
					id: 'm1',
					layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' }],
				},
			] as unknown as ViewerState['slideMasters'],
		});
		const actions = stubEditActions();
		const host = document.createElement('div');
		document.body.appendChild(host);
		const menu = createThumbnailContextMenu({
			doc: document,
			store,
			getTranslator: () => t,
			getEditActions: () => actions as unknown as EditActions,
			addSlideAfter: vi.fn(),
			duplicateSlides: vi.fn(),
			deleteSlides: vi.fn(),
			toggleHideSlides: vi.fn(),
			host,
		});
		menu.open({ x: 0, y: 0, index: 0, selectedIndexes: [0] }, slides(2));
		clickCommand(t('pptx.slidesPane.contextMenu.layout'));
		const layoutBtn = Array.from(
			document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item'),
		).find((b) => b.textContent === 'Title Slide');
		expect(layoutBtn).toBeTruthy();
		layoutBtn?.click();
		expect(actions.applyLayout).toHaveBeenCalledWith('ppt/slideLayouts/slideLayout1.xml');
	});
});
