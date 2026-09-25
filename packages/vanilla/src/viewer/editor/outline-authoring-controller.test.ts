import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { createOutlineAuthoringController } from './outline-authoring-controller';

const t = createTranslator('en');
/** Detach every controller so no session keeps a window keyboard listener. */
const cleanups: Array<() => void> = [];
const SIZE = { width: 1280, height: 720 };

function setup() {
	const wrap = document.createElement('div');
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	wrap.appendChild(stage);
	document.body.appendChild(wrap);
	// jsdom has no layout: give the stage-sized overlays a 1:1 client rect.
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
		left: 0,
		top: 0,
		width: SIZE.width,
		height: SIZE.height,
		right: SIZE.width,
		bottom: SIZE.height,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	} as DOMRect);
	const slide: PptxSlide = {
		id: 's1',
		slideNumber: 1,
		elements: [
			{ id: 'r1', type: 'shape', shapeType: 'rect', x: 100, y: 100, width: 200, height: 100 },
		],
	} as unknown as PptxSlide;
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		editable: true,
		canvasSize: SIZE,
		slides: [slide],
	});
	const applyElementPatch = vi.fn((id: string, patch: Partial<PptxElement>) => {
		const state = store.get();
		store.set({
			slides: state.slides.map((s) => ({
				...s,
				elements: s.elements.map((el) =>
					el.id === id ? ({ ...el, ...patch } as PptxElement) : el,
				),
			})),
		});
	});
	const insertElement = vi.fn((element: PptxElement) => {
		const state = store.get();
		store.set({
			slides: state.slides.map((s) => ({ ...s, elements: [...s.elements, element] })),
			selectedElementId: element.id,
		});
	});
	const controller = createOutlineAuthoringController({
		doc: document,
		store,
		getTranslator: () => t,
		getScale: () => 1,
		getStageWrap: () => wrap,
		applyElementPatch,
		insertElement,
	});
	store.subscribe(() => controller.sync());
	cleanups.push(() => controller.detach());
	return { stage, store, controller, applyElementPatch, insertElement };
}

function pointer(target: Element, type: string, x: number, y: number, extra: object = {}): void {
	target.dispatchEvent(
		new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, ...extra }),
	);
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('edit points (vanilla)', () => {
	it('renders a target per vertex and commits a vertex drag as custom geometry', () => {
		const { stage, controller, applyElementPatch } = setup();
		expect(controller.startEditPoints('r1')).toBeTruthy();
		const overlay = stage.querySelector('[data-pptx-edit-points-overlay="true"]');
		expect(overlay?.getAttribute('data-pptx-edit-points-element')).toBe('r1');
		expect(overlay?.getAttribute('aria-label')).toBe(t('pptx.editPoints.overlay'));
		const nodes = stage.querySelectorAll('[data-pptx-edit-points-target^="node:"]');
		expect(nodes).toHaveLength(4);
		expect(controller.isEditingPoints('r1')).toBeTruthy();

		const corner = stage.querySelector('[data-pptx-edit-points-target="node:0:2"]')!;
		pointer(corner, 'pointerdown', 300, 200, { button: 0 });
		pointer(overlay!, 'pointermove', 340, 240);
		pointer(overlay!, 'pointerup', 340, 240);
		expect(applyElementPatch).toHaveBeenCalledOnce();
		expect(applyElementPatch.mock.calls[0][1]).toMatchObject({
			shapeType: 'custom',
			width: 240,
			height: 140,
		});
		// The session survives its own commit.
		expect(stage.querySelector('[data-pptx-edit-points-overlay="true"]')).not.toBeNull();
	});

	it('opens the vertex menu and leaves the mode on Escape', () => {
		const { stage, store, controller } = setup();
		controller.startEditPoints('r1');
		const corner = stage.querySelector('[data-pptx-edit-points-target="node:0:1"]')!;
		pointer(corner, 'contextmenu', 300, 100);
		const menu = stage.querySelector('[data-pptx-edit-points-menu="true"]');
		expect(menu?.getAttribute('role')).toBe('menu');
		expect(
			menu
				?.querySelector('[data-pptx-edit-points-command="corner-point"]')
				?.getAttribute('aria-checked'),
		).toBe('true');

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(stage.querySelector('[data-pptx-edit-points-menu="true"]')).toBeNull();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(store.get().editPointsElementId).toBeNull();
		expect(stage.querySelector('[data-pptx-edit-points-overlay="true"]')).toBeNull();
	});

	it('refuses a noEditPoints shape', () => {
		const { store, controller } = setup();
		const state = store.get();
		store.set({
			slides: state.slides.map((s) => ({
				...s,
				elements: s.elements.map((el) => ({ ...el, locks: { noEditPoints: true } })),
			})),
		});
		expect(controller.startEditPoints('r1')).toBeFalsy();
	});
});

describe('freeform shape and curve tools (vanilla)', () => {
	it('arms the overlay and inserts a custom shape on clicks + double-click', () => {
		const { stage, store, controller, insertElement } = setup();
		controller.armFreeformTool('freeformShape');
		const overlay = stage.querySelector('[data-pptx-freeform-tool-overlay="freeformShape"]')!;
		expect(overlay).not.toBeNull();
		for (const [x, y] of [
			[10, 10],
			[200, 10],
			[200, 150],
		]) {
			pointer(overlay, 'pointerdown', x, y, { button: 0 });
			pointer(overlay, 'pointerup', x, y);
		}
		pointer(overlay, 'dblclick', 200, 150);
		expect(insertElement).toHaveBeenCalledOnce();
		expect(insertElement.mock.calls[0][0]).toMatchObject({ type: 'shape', shapeType: 'custom' });
		expect(store.get().freeformTool).toBeNull();
		expect(stage.querySelector('[data-pptx-freeform-tool-overlay]')).toBeNull();
	});

	it('arming a tool ends Edit Points', () => {
		const { stage, store, controller } = setup();
		controller.startEditPoints('r1');
		controller.armFreeformTool('curve');
		expect(store.get().editPointsElementId).toBeNull();
		expect(stage.querySelector('[data-pptx-edit-points-overlay]')).toBeNull();
		expect(stage.querySelector('[data-pptx-freeform-tool-overlay="curve"]')).not.toBeNull();
	});
});
