import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createAiFocusController } from './ai-panel-controller';
import { mountAiPickInterception } from './ai-pick-interception';

function buildDom() {
	const viewport = document.createElement('div');
	const stage = document.createElement('div');
	stage.className = 'pptxv-stage';
	const el = document.createElement('div');
	el.dataset.elementId = 'el-5';
	const inner = document.createElement('span');
	el.appendChild(inner);
	stage.appendChild(el);
	viewport.appendChild(stage);
	document.body.appendChild(viewport);
	return { viewport, stage, inner };
}

describe('mountAiPickInterception', () => {
	it('turns a canvas click into a pick while in pick mode, blocking the editor', () => {
		const { viewport, stage, inner } = buildDom();
		const store = createStore({ ...createInitialViewerState(), currentSlide: 2 });
		const controller = createAiFocusController({ store, requestOpen: () => undefined });
		const picker = mountAiPickInterception({
			viewport,
			store,
			controller,
			getStageRoot: () => stage,
		});

		// A stage handler stands in for the editor's own pointerdown selection.
		const editorHandler = vi.fn();
		stage.addEventListener('pointerdown', editorHandler);

		controller.startPicking();
		const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
		inner.dispatchEvent(event);

		// The pick was captured and the element handed to the assistant...
		expect(controller.getHighlights()).toStrictEqual([
			{ slideIndex: 2, elementId: 'el-5', variant: 'pick' },
		]);
		// ...the event was claimed (default prevented) and never reached the editor.
		expect(event.defaultPrevented).toBeTruthy();
		expect(editorHandler).not.toHaveBeenCalled();

		picker.destroy();
	});

	it('ignores clicks when not in pick mode', () => {
		const { viewport, stage, inner } = buildDom();
		const store = createStore(createInitialViewerState());
		const controller = createAiFocusController({ store, requestOpen: () => undefined });
		mountAiPickInterception({ viewport, store, controller, getStageRoot: () => stage });

		inner.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
		expect(controller.hasPicks()).toBeFalsy();
	});
});
