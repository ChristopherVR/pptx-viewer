import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditActions } from '../editor';
import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { mountCanvasContextMenu } from './canvas-context-menu';

const t = createTranslator('en');

function stubActions() {
	return {
		paste: vi.fn(),
		resetSlide: vi.fn(),
		applyLayout: vi.fn(),
		toggleViewOption: vi.fn(),
	};
}

function shapeSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [{ id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 }],
	} as unknown as PptxSlide;
}

interface Harness {
	actions: ReturnType<typeof stubActions>;
	store: ReturnType<typeof createStore<ViewerState>>;
	viewport: HTMLElement;
	element: HTMLElement;
	destroy(): void;
}

function harness(state: Partial<ViewerState> = {}): Harness {
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
		slides: [shapeSlide()],
		...state,
	});
	const actions = stubActions();
	const menu = mountCanvasContextMenu({
		doc: document,
		store,
		getTranslator: () => t,
		viewport,
		getStageRoot: () => stage,
		getEditActions: () => actions as unknown as EditActions,
	});
	return { actions, store, viewport, element, destroy: () => menu.destroy() };
}

function rightClick(target: HTMLElement): MouseEvent {
	const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

function openMenu(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-pptx-canvas-context-menu="true"]');
}

function items(): HTMLButtonElement[] {
	return Array.from(document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item'));
}

function clickCommand(label: string): void {
	items()
		.find((node) => (node.textContent ?? '').trim() === label)
		?.click();
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('mountCanvasContextMenu', () => {
	it('opens the shared six-command menu on a right-click over empty canvas', () => {
		const context = harness();
		rightClick(context.viewport);
		const menu = openMenu();
		expect(menu).not.toBeNull();
		expect(menu?.getAttribute('role')).toBe('menu');
		expect(items()).toHaveLength(6);
		context.destroy();
	});

	it('does NOT open when the right-click landed on an interactive element', () => {
		const context = harness();
		rightClick(context.element);
		expect(openMenu()).toBeNull();
		context.destroy();
	});

	it('greys Paste when the clipboard is empty', () => {
		const context = harness({ clipboardPayload: null });
		rightClick(context.viewport);
		const paste = items().find((b) => (b.textContent ?? '').trim() === t('pptx.contextMenu.paste'));
		expect(paste?.disabled).toBeTruthy();
		context.destroy();
	});

	it('renders Grid and Guides / Ruler as menuitemcheckbox, reflecting state', () => {
		const context = harness({ showGrid: true, showRulers: false });
		rightClick(context.viewport);
		const checkboxes = document.querySelectorAll('[role="menuitemcheckbox"]');
		expect(checkboxes).toHaveLength(2);
		expect(checkboxes[0].getAttribute('aria-checked')).toBe('true');
		expect(checkboxes[1].getAttribute('aria-checked')).toBe('false');
		context.destroy();
	});

	it('routes Paste / Reset Slide / Grid / Ruler to their editor actions and closes', () => {
		const context = harness({ clipboardPayload: {} as unknown as ViewerState['clipboardPayload'] });
		rightClick(context.viewport);
		clickCommand(t('pptx.contextMenu.paste'));
		expect(context.actions.paste).toHaveBeenCalledOnce();
		expect(openMenu()).toBeNull();

		rightClick(context.viewport);
		clickCommand(t('pptx.canvasContextMenu.resetSlide'));
		expect(context.actions.resetSlide).toHaveBeenCalledOnce();

		rightClick(context.viewport);
		clickCommand(t('pptx.canvasContextMenu.gridAndGuides'));
		expect(context.actions.toggleViewOption).toHaveBeenCalledWith('showGrid');

		rightClick(context.viewport);
		clickCommand(t('pptx.canvasContextMenu.ruler'));
		expect(context.actions.toggleViewOption).toHaveBeenCalledWith('showRulers');
		context.destroy();
	});

	it('layout opens a companion list of the deck layouts, applying the picked one', () => {
		const state: Partial<ViewerState> = {
			slideMasters: [
				{
					id: 'm1',
					layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' }],
				},
			] as unknown as ViewerState['slideMasters'],
		};
		const context = harness(state);
		rightClick(context.viewport);
		clickCommand(t('pptx.canvasContextMenu.layout'));
		const layoutBtn = Array.from(
			document.querySelectorAll<HTMLButtonElement>('.pptxv-context-menu-item'),
		).find((b) => b.textContent === 'Title Slide');
		expect(layoutBtn).toBeTruthy();
		layoutBtn?.click();
		expect(context.actions.applyLayout).toHaveBeenCalledWith('ppt/slideLayouts/slideLayout1.xml');
		context.destroy();
	});

	it('format Background clears the selection and opens the inspector', () => {
		const context = harness({ selectedElementId: 'el-1', selectedElementIds: ['el-1'] });
		rightClick(context.viewport);
		clickCommand(t('pptx.canvasContextMenu.formatBackground'));
		expect(context.store.get().inspectorOpen).toBeTruthy();
		expect(context.store.get().selectedElementIds).toStrictEqual([]);
		context.destroy();
	});
});
