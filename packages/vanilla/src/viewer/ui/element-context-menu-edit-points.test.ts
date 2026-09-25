import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditActions } from '../editor';
import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { mountElementContextMenu } from './element-context-menu';

const t = createTranslator('en');

function slideWith(locks?: { noEditPoints?: boolean }): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{ id: 'el-1', type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 100, height: 50, locks },
		],
	} as unknown as PptxSlide;
}

function mount(slide: PptxSlide) {
	const viewport = document.createElement('div');
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const element = document.createElement('div');
	element.dataset.elementId = 'el-1';
	stage.appendChild(element);
	viewport.appendChild(stage);
	document.body.appendChild(viewport);
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		editable: true,
		slides: [slide],
	});
	const startEditPoints = vi.fn(() => true);
	const menu = mountElementContextMenu({
		doc: document,
		store,
		getTranslator: () => t,
		viewport,
		getStageRoot: () => stage,
		getEditActions: () => ({}) as unknown as EditActions,
		selectElement: (id) => store.set({ selectedElementId: id, selectedElementIds: [id] }),
		openComments: vi.fn(),
		openHyperlink: vi.fn(),
		getAi: () => null,
		startEditPoints,
	});
	element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
	return { startEditPoints, destroy: () => menu.destroy() };
}

function editPointsItem(): HTMLButtonElement | undefined {
	return Array.from(document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item')).find(
		(node) => node.textContent?.trim() === t('pptx.contextMenu.editPoints'),
	);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('element context menu: Edit Points', () => {
	it('offers Edit Points on a shape and starts it on the right-clicked element', () => {
		const context = mount(slideWith());
		const item = editPointsItem();
		expect(item).toBeDefined();
		expect(item?.disabled).toBeFalsy();
		item?.click();
		expect(context.startEditPoints).toHaveBeenCalledWith('el-1');
		context.destroy();
	});

	it('greys Edit Points out for a noEditPoints lock', () => {
		const context = mount(slideWith({ noEditPoints: true }));
		expect(editPointsItem()?.disabled).toBeTruthy();
		context.destroy();
	});
});
