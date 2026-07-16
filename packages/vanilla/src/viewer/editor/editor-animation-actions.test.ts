import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createAnimationActions } from './editor-animation-actions';
import { createEditorOps } from './editor-operations';

function buildElement(id: string): PptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

function buildSlide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

describe('createAnimationActions', () => {
	it('adds an entrance animation to the selected element, with history', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.addAnimation('entrance', 'fadeIn');

		const animations = store.get().slides[0].animations;
		expect(animations).toHaveLength(1);
		expect(animations?.[0]).toMatchObject({ elementId: 'el1', entrance: 'fadeIn' });
		expect(ops.canUndo()).toBeTruthy();

		ops.undo();
		expect(store.get().slides[0].animations).toBeUndefined();
	});

	it('keeps entrance/emphasis/exit independent on the same element', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.addAnimation('entrance', 'fadeIn');
		actions.addAnimation('exit', 'fadeOut');

		const animations = store.get().slides[0].animations;
		expect(animations).toHaveLength(1);
		expect(animations?.[0]).toMatchObject({
			elementId: 'el1',
			entrance: 'fadeIn',
			exit: 'fadeOut',
		});
	});

	it('removeAnimation drops the entry for the selected element only', () => {
		const initialAnimations: PptxElementAnimation[] = [
			{ elementId: 'el1', entrance: 'fadeIn', order: 0 },
			{ elementId: 'el2', entrance: 'zoomIn', order: 1 },
		];
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a', [buildElement('el1'), buildElement('el2')]),
					animations: initialAnimations,
				},
			],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.removeAnimation();

		const animations = store.get().slides[0].animations;
		expect(animations).toHaveLength(1);
		expect(animations?.[0].elementId).toBe('el2');
	});

	it('removeAnimation is a no-op when the selected element has no animation', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.removeAnimation();

		expect(ops.canUndo()).toBeFalsy();
	});

	it('addAnimation is a no-op when nothing is selected', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: true,
			selectedElementId: null,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.addAnimation('entrance', 'fadeIn');

		expect(store.get().slides[0].animations).toBeUndefined();
		expect(ops.canUndo()).toBeFalsy();
	});

	it('is a no-op when the viewer is not editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: false,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.addAnimation('entrance', 'fadeIn');

		expect(store.get().slides[0].animations).toBeUndefined();
	});

	it('updates timing and reorders the full slide timeline', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'el1', entrance: 'fadeIn', order: 0 },
			{ elementId: 'el2', entrance: 'zoomIn', order: 1 },
		];
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a', [buildElement('el1'), buildElement('el2')]),
					animations,
				},
			],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.setAnimationTiming('el1', {
			durationMs: 1200,
			delayMs: 300,
			trigger: 'afterPrevious',
			direction: 'fromLeft',
			sequence: 'byWord',
			timingCurve: 'ease-in',
			repeatCount: 3,
			repeatMode: 'untilEndOfSlide',
		});
		actions.reorderAnimation('el2', 'up');

		const updated = store.get().slides[0].animations!;
		expect(updated.find(({ elementId }) => elementId === 'el1')).toMatchObject({
			durationMs: 1200,
			delayMs: 300,
			trigger: 'afterPrevious',
			direction: 'fromLeft',
			sequence: 'byWord',
			timingCurve: 'ease-in',
			repeatCount: 3,
			repeatMode: 'untilEndOfSlide',
			order: 1,
		});
		expect(updated.find(({ elementId }) => elementId === 'el2')?.order).toBe(0);
	});
});
