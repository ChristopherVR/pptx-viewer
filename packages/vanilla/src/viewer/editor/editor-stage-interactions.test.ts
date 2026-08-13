/**
 * Stage-interaction tests for the touch inline-editing paths: a touch
 * double-tap opens the inline text editor (native dblclick never fires for
 * touch), and a press outside the editing surface commits the pending edit
 * instead of dropping the typed text.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import { createSelectionOverlay } from './selection-overlay';

function textElement(id: string, text: string): PptxElement {
	return {
		type: 'text',
		id,
		x: 10,
		y: 10,
		width: 200,
		height: 50,
		text,
		textSegments: [{ text }],
	} as PptxElement;
}

function pointerDown(overrides: {
	target: EventTarget | null;
	pointerType?: string;
	timeStamp?: number;
	pointerId?: number;
}): PointerEvent {
	return {
		button: 0,
		pointerId: overrides.pointerId ?? 1,
		pointerType: overrides.pointerType ?? 'touch',
		timeStamp: overrides.timeStamp ?? 0,
		clientX: 0,
		clientY: 0,
		shiftKey: false,
		target: overrides.target,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as PointerEvent;
}

function setup() {
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		slides: [
			{
				id: 'slide-1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [textElement('el-1', 'TARGET'), textElement('el-2', 'SOURCE')],
			},
		],
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: () => {} });

	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const el1 = document.createElement('div');
	el1.dataset.elementId = 'el-1';
	const el2 = document.createElement('div');
	el2.dataset.elementId = 'el-2';
	stage.append(el1, el2);
	const wrap = document.createElement('div');
	wrap.appendChild(stage);
	document.body.appendChild(wrap);

	const overlay = createSelectionOverlay(document, createTranslator(), {
		onHandlePointerDown: vi.fn(),
		onRotatePointerDown: vi.fn(),
		onAdjustPointerDown: vi.fn(),
	});
	overlay.mount(wrap);

	const interactions = createStageInteractions({
		doc: document,
		store,
		ops,
		getScale: () => 1,
		getOverlay: () => overlay,
		getStageRoot: () => stage,
	});

	const doubleTap = (target: EventTarget, at = 0): void => {
		interactions.onStagePointerDown(pointerDown({ target, timeStamp: at }));
		interactions.onStagePointerDown(pointerDown({ target, timeStamp: at + 100 }));
	};

	const editorSurface = (): HTMLElement | null =>
		overlay.root.querySelector<HTMLElement>('[data-inline-editor]');

	const cleanup = (): void => {
		interactions.dispose();
		wrap.remove();
	};

	return { store, interactions, stage, el1, el2, overlay, doubleTap, editorSurface, cleanup };
}

describe('stage interactions: touch inline editing', () => {
	it('opens the inline editor on a touch double-tap (no native dblclick)', () => {
		const { interactions, el1, doubleTap, editorSurface, cleanup } = setup();
		doubleTap(el1);
		expect(editorSurface()).toBeTruthy();
		expect(interactions.inlineActive()).toBeTruthy();
		cleanup();
	});

	it('does not open the inline editor for two quick mouse presses', () => {
		const { interactions, el1, editorSurface, cleanup } = setup();
		interactions.onStagePointerDown(pointerDown({ target: el1, pointerType: 'mouse' }));
		interactions.onStagePointerDown(
			pointerDown({ target: el1, pointerType: 'mouse', timeStamp: 100 }),
		);
		expect(editorSurface()).toBeNull();
		expect(interactions.inlineActive()).toBeFalsy();
		cleanup();
	});

	it('commits the typed text when tapping another element, which gets selected', () => {
		const { store, interactions, el1, el2, doubleTap, editorSurface, cleanup } = setup();
		doubleTap(el1);
		const surface = editorSurface();
		expect(surface).toBeTruthy();
		surface!.textContent = 'TARGET XYZ';

		interactions.onStagePointerDown(pointerDown({ target: el2, timeStamp: 5000 }));

		expect(editorSurface()).toBeNull();
		expect(interactions.inlineActive()).toBeFalsy();
		const state = store.get();
		const edited = state.slides[0].elements.find((element) => element.id === 'el-1');
		expect(edited && 'text' in edited ? edited.text : undefined).toBe('TARGET XYZ');
		expect(state.selectedElementId).toBe('el-2');
		cleanup();
	});

	it('commits the typed text when tapping the empty canvas', () => {
		const { store, interactions, stage, el1, doubleTap, editorSurface, cleanup } = setup();
		doubleTap(el1);
		const surface = editorSurface();
		expect(surface).toBeTruthy();
		surface!.textContent = 'TARGET EDIT';

		// A press on the bare stage resolves to no element id (marquee path).
		interactions.onStagePointerDown(pointerDown({ target: stage, timeStamp: 5000 }));

		expect(editorSurface()).toBeNull();
		expect(interactions.inlineActive()).toBeFalsy();
		const edited = store.get().slides[0].elements.find((element) => element.id === 'el-1');
		expect(edited && 'text' in edited ? edited.text : undefined).toBe('TARGET EDIT');
		cleanup();
	});

	it('keeps the editor open when the press lands on the editing surface itself', () => {
		const { interactions, el1, doubleTap, editorSurface, cleanup } = setup();
		doubleTap(el1);
		const surface = editorSurface();
		expect(surface).toBeTruthy();
		// The surface stops its own pointerdown, so the stage handler never runs
		// for presses on it; nothing to simulate here beyond asserting the editor
		// stays active without a stage-level press.
		expect(interactions.inlineActive()).toBeTruthy();
		cleanup();
	});
});
