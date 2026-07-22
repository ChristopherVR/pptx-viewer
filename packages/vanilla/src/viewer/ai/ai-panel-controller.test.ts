import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createAiFocusController } from './ai-panel-controller';

function setup(overrides: Partial<ReturnType<typeof createInitialViewerState>> = {}) {
	const store = createStore({ ...createInitialViewerState(), ...overrides });
	const requestOpen = vi.fn();
	const controller = createAiFocusController({ store, requestOpen });
	return { store, requestOpen, controller };
}

describe('createAiFocusController', () => {
	it('derives live focus targets from the current selection', () => {
		const { controller } = setup({ currentSlide: 2 });
		// Nothing selected -> whole-slide target.
		expect(controller.getLiveTargets()).toStrictEqual([{ kind: 'slide', slideIndex: 2 }]);
	});

	it('starts pick mode, requests the panel open, and turns a click into a target', () => {
		const { controller, requestOpen } = setup({ currentSlide: 1 });
		controller.startPicking();
		expect(controller.isPicking()).toBeTruthy();
		expect(requestOpen).toHaveBeenCalledOnce();

		controller.addPick(1, 'el-9');
		// The pick becomes the assistant's effective focus, winning over selection.
		expect(controller.hasPicks()).toBeTruthy();
		expect(controller.getEffectiveTargets()).toStrictEqual([
			{ kind: 'element', slideIndex: 1, elementId: 'el-9' },
		]);
		// And it produces a persistent `pick` highlight on the canvas.
		expect(controller.getHighlights()).toStrictEqual([
			{ slideIndex: 1, elementId: 'el-9', variant: 'pick' },
		]);
	});

	it('dedupes repeated picks of the same element', () => {
		const { controller } = setup();
		controller.addPick(0, 'el-1');
		controller.addPick(0, 'el-1');
		expect(controller.getHighlights()).toHaveLength(1);
	});

	it('pins the live focus so it survives a later selection change', () => {
		const { controller, store } = setup({ currentSlide: 0, selectedElementIds: ['a'] });
		controller.pinFocus();
		expect(controller.isPinned()).toBeTruthy();
		store.set({ selectedElementIds: ['b'], selectedElementId: 'b' });
		// Still pinned to the original selection.
		expect(controller.getEffectiveTargets()).toStrictEqual([
			{ kind: 'element', slideIndex: 0, elementId: 'a' },
		]);
	});

	it('flashes a live tool target as an active highlight and marks the canvas animating', () => {
		vi.useFakeTimers();
		const { controller } = setup({ currentSlide: 3 });
		controller.flashToolTarget({ slideIndex: 3, elementIds: ['t1'] });
		expect(controller.isAnimating()).toBeTruthy();
		expect(controller.getHighlights()).toStrictEqual([
			{ slideIndex: 3, elementId: 't1', variant: 'active' },
		]);
		// Settles after the flash window.
		vi.advanceTimersByTime(3000);
		expect(controller.isAnimating()).toBeFalsy();
		expect(controller.getHighlights()).toStrictEqual([]);
		vi.useRealTimers();
	});

	it('bumps the prefill nonce for Ask / Fix and opens the panel', () => {
		const { controller, requestOpen } = setup();
		const before = controller.getPrefill().nonce;
		controller.askAboutSelection();
		expect(controller.getPrefill().nonce).toBe(before + 1);
		expect(controller.getPrefill().text).toBe('');
		expect(requestOpen).toHaveBeenCalledOnce();
	});
});
