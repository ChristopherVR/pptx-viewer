import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { readCropInsets as insets } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { createCropModeController } from './crop-mode-controller';
import { createCropActions } from './editor-crop-actions';
import { createEditorOps } from './editor-operations';

const picture = {
	type: 'picture',
	id: 'pic',
	x: 100,
	y: 100,
	width: 200,
	height: 100,
	imageData: 'data:image/png;base64,AAAA',
} as PptxElement;

function setup(scale = 2) {
	const slide: PptxSlide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [picture] };
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		slides: [slide],
		editable: true,
		selectedElementId: 'pic',
		selectedElementIds: ['pic'],
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
	const actions = createCropActions({ doc: document, store, ops });
	const root = document.createElement('div');
	const wrap = document.createElement('div');
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	wrap.appendChild(stage);
	root.appendChild(wrap);
	document.body.appendChild(root);
	const controller = createCropModeController({
		doc: document,
		store,
		getTranslator: () => createTranslator('en'),
		getScale: () => scale,
		getStageWrap: () => wrap,
		actions,
	});
	controller.attach(root);
	store.subscribe(() => controller.sync());
	return {
		store,
		ops,
		actions,
		root,
		controller,
		pic: () => store.get().slides[0].elements[0],
		overlay: () => document.querySelector<HTMLElement>('[data-pptx-crop-overlay="true"]'),
	};
}

const pointer = (type: string, x: number, y: number): PointerEvent =>
	new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });

function key(target: HTMLElement, name: string): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('createCropModeController', () => {
	it('draws the overlay over the picture with a ghost, a frame and eight handles', () => {
		const ctx = setup();
		expect(ctx.overlay()).toBeNull();
		ctx.actions.enterCropMode();
		const overlay = ctx.overlay()!;
		expect(overlay.parentElement?.className).toBe('pptxv-stage');
		expect(overlay.style.left).toBe('100px');
		expect(overlay.style.width).toBe('200px');
		expect(overlay.querySelector('[data-pptx-crop-frame]')).not.toBeNull();
		expect(overlay.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
		const handles = overlay.querySelectorAll('[data-pptx-crop-handle]');
		expect([...handles].map((node) => node.getAttribute('data-pptx-crop-handle'))).toStrictEqual([
			'nw',
			'n',
			'ne',
			'e',
			'se',
			's',
			'sw',
			'w',
		]);
		expect(handles[0].getAttribute('aria-label')).toBe('Crop handle');
		expect(handles[0].querySelector('path')?.getAttribute('fill')).toBe('#000000');
	});

	it('a handle drag crops live in slide pixels, Escape restores with no undo step', () => {
		const ctx = setup(2);
		ctx.actions.enterCropMode();
		const west = ctx.overlay()!.querySelector<HTMLElement>('[data-pptx-crop-handle="w"]')!;
		west.dispatchEvent(pointer('pointerdown', 10, 10));
		// 40 client px at zoom 2 is 20 slide px: 10% of the 200px-wide picture.
		document.dispatchEvent(pointer('pointermove', 50, 10));
		expect(insets(ctx.pic()).cropLeft).toBeCloseTo(0.1);
		expect(ctx.pic().x).toBeCloseTo(120);
		// The overlay tracks the live frame.
		expect(ctx.overlay()!.style.left).toBe('120px');
		document.dispatchEvent(pointer('pointerup', 50, 10));

		const escape = key(ctx.root, 'Escape');
		expect(escape.defaultPrevented).toBeTruthy();
		expect(ctx.store.get().cropSession).toBeNull();
		expect(insets(ctx.pic()).cropLeft).toBe(0);
		expect(ctx.pic().x).toBe(100);
		expect(ctx.ops.canUndo()).toBeFalsy();
		expect(ctx.overlay()).toBeNull();
		// Escape was consumed by crop mode, so the selection survives it.
		expect(ctx.store.get().selectedElementIds).toStrictEqual(['pic']);
	});

	it('commits the crop on Enter as exactly one undo step', () => {
		const ctx = setup(1);
		ctx.actions.enterCropMode();
		const south = ctx.overlay()!.querySelector<HTMLElement>('[data-pptx-crop-handle="s"]')!;
		south.dispatchEvent(pointer('pointerdown', 0, 0));
		document.dispatchEvent(pointer('pointermove', 0, -10));
		document.dispatchEvent(pointer('pointermove', 0, -25));
		document.dispatchEvent(pointer('pointerup', 0, -25));
		expect(insets(ctx.pic()).cropBottom).toBeCloseTo(0.25);

		key(ctx.root, 'Enter');
		expect(ctx.store.get().cropSession).toBeNull();
		expect(insets(ctx.pic()).cropBottom).toBeCloseTo(0.25);
		ctx.ops.undo();
		expect(insets(ctx.pic()).cropBottom).toBe(0);
		expect(ctx.pic().height).toBe(100);
		expect(ctx.ops.canUndo()).toBeFalsy();
	});

	it('commits on a selection change and on a press outside the overlay', () => {
		const ctx = setup(1);
		ctx.actions.enterCropMode();
		ctx.actions.previewCrop({
			x: 100,
			y: 100,
			width: 100,
			height: 100,
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0.5,
			cropBottom: 0,
		});
		ctx.store.set({ selectedElementId: null, selectedElementIds: [] });
		expect(ctx.store.get().cropSession).toBeNull();
		expect(ctx.ops.canUndo()).toBeTruthy();

		ctx.store.set({ selectedElementId: 'pic', selectedElementIds: ['pic'] });
		ctx.actions.enterCropMode();
		ctx.root.dispatchEvent(pointer('pointerdown', 0, 0));
		expect(ctx.store.get().cropSession).toBeNull();
	});
});
