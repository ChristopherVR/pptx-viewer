import type {
	PptxAnimationTimelineAnchor,
	PptxElement,
	PptxElementAnimation,
	PptxSlide,
} from 'pptx-viewer-core';
import { motionPathPresetById } from 'pptx-viewer-shared';
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

	it('setAnimationEffect sets one bucket on the selected element and marks dirty', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.setAnimationEffect('entrance', 'fadeIn');

		const animations = store.get().slides[0].animations;
		expect(animations).toHaveLength(1);
		expect(animations?.[0]).toMatchObject({ elementId: 'el1', entrance: 'fadeIn' });
		expect(store.get().dirty).toBeTruthy();
		expect(ops.canUndo()).toBeTruthy();
	});

	it('setAnimationEffect with none clears the bucket and drops an empty entry', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'el1', entrance: 'fadeIn', exit: 'fadeOut', order: 0 },
		];
		const store = createStore({
			...createInitialViewerState(),
			slides: [{ ...buildSlide('a', [buildElement('el1')]), animations }],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.setAnimationEffect('exit', 'none');
		expect(store.get().slides[0].animations?.[0]).toMatchObject({
			elementId: 'el1',
			entrance: 'fadeIn',
		});
		expect(store.get().slides[0].animations?.[0].exit).toBeUndefined();

		actions.setAnimationEffect('entrance', 'none');
		expect(store.get().slides[0].animations).toHaveLength(0);
	});

	it('sets a trigger shape and supports drag-order placement', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'a', entrance: 'fadeIn', order: 0 },
			{ elementId: 'b', entrance: 'fadeIn', order: 1 },
			{ elementId: 'c', entrance: 'fadeIn', order: 2 },
		];
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a', [buildElement('a'), buildElement('b'), buildElement('c')]),
					animations,
				},
			],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'a',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.setAnimationTiming('a', { trigger: 'onShapeClick', triggerShapeId: 'button-1' });
		actions.moveAnimation('c', 0);

		const updated = store.get().slides[0].animations!;
		expect(updated.find(({ elementId }) => elementId === 'a')?.triggerShapeId).toBe('button-1');
		expect(
			[...updated]
				.sort((left, right) => left.order! - right.order!)
				.map(({ elementId }) => elementId),
		).toStrictEqual(['c', 'a', 'b']);
	});

	it('moves an editor-authored effect ahead of a deck-native anchor', () => {
		const animations: PptxElementAnimation[] = [{ elementId: 'el1', entrance: 'fadeIn', order: 1 }];
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a', [buildElement('el1')]),
					animations,
					animationTimelineAnchors: [
						{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] },
					] as PptxAnimationTimelineAnchor[],
				},
			],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.reorderAnimation('el1', 'up');

		expect(store.get().slides[0].animations?.[0]).toMatchObject({ elementId: 'el1', order: 0 });
	});

	it('moveAnimation can drop an editor effect onto a native anchor slot', () => {
		const animations: PptxElementAnimation[] = [{ elementId: 'el1', entrance: 'fadeIn', order: 1 }];
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a', [buildElement('el1')]),
					animations,
					animationTimelineAnchors: [
						{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] },
					] as PptxAnimationTimelineAnchor[],
				},
			],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.moveAnimation('el1', 0);

		expect(store.get().slides[0].animations?.[0]).toMatchObject({ elementId: 'el1', order: 0 });
	});

	it('applies, keeps, edits and clears a motion path on the selected element', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: true,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.applyMotionPath('arcUp');
		expect(store.get().slides[0].animations?.[0]).toMatchObject({
			elementId: 'el1',
			motionPath: motionPathPresetById('arcUp')?.path,
			motionPathEditMode: 'relative',
		});

		// A path coexists with a preset on the same entry rather than replacing it.
		actions.addAnimation('entrance', 'fadeIn');
		expect(store.get().slides[0].animations?.[0]).toMatchObject({
			entrance: 'fadeIn',
			motionPath: motionPathPresetById('arcUp')?.path,
		});

		// The canvas end-handle drag commit.
		actions.setMotionPathData('M 0 0 L 0.4 0.1');
		expect(store.get().slides[0].animations?.[0].motionPath).toBe('M 0 0 L 0.4 0.1');

		// `custom` is the inspector's read-only marker for a dragged path; picking
		// it again must not snap the geometry back to a catalogue entry.
		actions.applyMotionPath('custom');
		expect(store.get().slides[0].animations?.[0].motionPath).toBe('M 0 0 L 0.4 0.1');

		actions.applyMotionPath('none');
		const cleared = store.get().slides[0].animations?.[0];
		expect(cleared?.motionPath).toBeUndefined();
		expect(cleared?.entrance).toBe('fadeIn');
	});

	it('refuses motion-path edits without a selection or edit rights', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', [buildElement('el1')])],
			currentSlide: 0,
			editable: false,
			selectedElementId: 'el1',
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createAnimationActions({ store, ops });

		actions.applyMotionPath('lineRight');
		actions.setMotionPathData('M 0 0 L 0.4 0.1');
		expect(store.get().slides[0].animations).toBeUndefined();

		store.set({ editable: true, selectedElementId: undefined });
		actions.applyMotionPath('lineRight');
		expect(store.get().slides[0].animations).toBeUndefined();
	});
});
