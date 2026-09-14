import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createApplyToSelected } from './editor-apply-to-selected';
import { createArrangeActions } from './editor-arrange-actions';
import { createEditorOps } from './editor-operations';

function box(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' } as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

/**
 * Layer order while edit-template mode is on. Slide elements stay selectable
 * in that mode, but the reorder used to resolve its store from the mode flag
 * and so rewrote the template store, where the element does not exist: the
 * button silently did nothing.
 */
describe('createArrangeActions z-order routing', () => {
	function setup(selectedElementId: string) {
		const store = createStore({
			...createInitialViewerState(),
			slides: [slide('a', [box('back'), box('front')])],
			templateElementsBySlideId: { a: [box('layout-back'), box('layout-front')] },
			currentSlide: 0,
			editable: true,
			editTemplateMode: true,
			selectedElementId,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const applyToSelected = createApplyToSelected(store, ops);
		return { store, actions: createArrangeActions({ store, ops, applyToSelected }) };
	}

	it('reorders a slide element inside the slide list, not the template store', () => {
		const { store, actions } = setup('back');
		actions.bringToFront();
		expect(store.get().slides[0].elements.map((el) => el.id)).toStrictEqual(['front', 'back']);
		expect(store.get().templateElementsBySlideId.a.map((el) => el.id)).toStrictEqual([
			'layout-back',
			'layout-front',
		]);
	});

	it('still reorders a template element inside the template store', () => {
		const { store, actions } = setup('layout-back');
		actions.bringForward();
		expect(store.get().templateElementsBySlideId.a.map((el) => el.id)).toStrictEqual([
			'layout-front',
			'layout-back',
		]);
		expect(store.get().slides[0].elements.map((el) => el.id)).toStrictEqual(['back', 'front']);
	});
});
