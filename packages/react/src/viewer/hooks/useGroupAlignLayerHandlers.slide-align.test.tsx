// @vitest-environment happy-dom
/**
 * Two behaviours of the Arrange group that used to be silent no-ops behind an
 * enabled button:
 *
 * - Align with ONE element selected. PowerPoint aligns a lone object to the
 *   slide; the handler bailed out below two elements.
 * - Layer order on a SLIDE element while edit-template mode is on. Slide
 *   elements stay interactive in that mode, but the reorder was routed by the
 *   mode flag into the template store, where the element does not exist.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GroupAlignLayerHandlers } from './element-manipulation-types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import { useGroupAlignLayerHandlers } from './useGroupAlignLayerHandlers';

function shape(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id,
		type: 'shape',
		x: 50,
		y: 40,
		width: 100,
		height: 50,
		shapeType: 'rect',
		...overrides,
	} as unknown as PptxElement;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

interface MountInput {
	slideElements: PptxElement[];
	templateElements?: PptxElement[];
	selected: PptxElement[];
	editTemplateMode?: boolean;
	canvasSize?: { width: number; height: number };
}

function mount(input: MountInput) {
	const slides: PptxSlide[] = [
		{ id: 'slide1', elements: input.slideElements } as unknown as PptxSlide,
	];
	let templateElements = input.templateElements ?? [];
	const updates: Array<{ id: string; x?: number; y?: number }> = [];
	const ops = {
		activeElements: input.editTemplateMode ? templateElements : slides[0].elements,
		updateActiveElements: (updater: (els: PptxElement[]) => PptxElement[]) => {
			if (input.editTemplateMode) {
				templateElements = updater(templateElements);
			} else {
				slides[0] = { ...slides[0], elements: updater(slides[0].elements) };
			}
		},
		updateSlides: (updater: (prev: PptxSlide[]) => PptxSlide[]) => {
			const next = updater(slides);
			slides.splice(0, slides.length, ...next);
		},
		updateElementById: (id: string, patch: Partial<PptxElement>) => {
			updates.push({ id, x: patch.x, y: patch.y });
		},
	} as unknown as ElementOperations;
	const history = { markDirty: () => {} } as unknown as EditorHistoryResult;
	const all = [...input.slideElements, ...(input.templateElements ?? [])];

	let handlers!: GroupAlignLayerHandlers;
	function Harness() {
		handlers = useGroupAlignLayerHandlers({
			activeSlide: slides[0],
			activeSlideIndex: 0,
			selectedElement: input.selected[0] ?? null,
			effectiveSelectedIds: input.selected.map((el) => el.id),
			selectedElements: input.selected,
			elementLookup: new Map(all.map((el) => [el.id, el])),
			canvasSize: input.canvasSize,
			editTemplateMode: input.editTemplateMode,
			setSelectedElementIds: () => {},
			ops,
			history,
		});
		return null;
	}
	act(() => {
		root.render(<Harness />);
	});
	return {
		handlers,
		updates,
		slideIds: () => slides[0].elements.map((el) => el.id),
		templateIds: () => templateElements.map((el) => el.id),
	};
}

describe('handleAlignElements with a single element', () => {
	it('aligns a lone element to the slide when the canvas size is known', () => {
		const lone = shape('a');
		const { handlers, updates } = mount({
			slideElements: [lone],
			selected: [lone],
			canvasSize: { width: 960, height: 540 },
		});
		act(() => {
			handlers.handleAlignElements('center');
		});
		act(() => {
			handlers.handleAlignElements('bottom');
		});
		expect(updates).toStrictEqual([
			{ id: 'a', x: 430, y: 40 },
			{ id: 'a', x: 50, y: 490 },
		]);
	});

	it('stays a no-op for a lone element without a canvas size', () => {
		const lone = shape('a');
		const { handlers, updates } = mount({ slideElements: [lone], selected: [lone] });
		act(() => {
			handlers.handleAlignElements('left');
		});
		expect(updates).toStrictEqual([]);
	});
});

describe('layer order while edit-template mode is on', () => {
	it('reorders a slide element inside the slide list, not the template store', () => {
		const back = shape('a');
		const front = shape('b');
		const tpl = shape('layout-logo');
		const { handlers, slideIds, templateIds } = mount({
			slideElements: [back, front],
			templateElements: [tpl],
			selected: [back],
			editTemplateMode: true,
		});
		act(() => {
			handlers.handleMoveLayerToEdge('front');
		});
		expect(slideIds()).toStrictEqual(['b', 'a']);
		expect(templateIds()).toStrictEqual(['layout-logo']);
	});

	it('still reorders a template element inside the template store', () => {
		const tplBack = shape('layout-a');
		const tplFront = shape('layout-b');
		const { handlers, slideIds, templateIds } = mount({
			slideElements: [shape('s')],
			templateElements: [tplBack, tplFront],
			selected: [tplBack],
			editTemplateMode: true,
		});
		act(() => {
			handlers.handleMoveLayer('forward');
		});
		expect(templateIds()).toStrictEqual(['layout-b', 'layout-a']);
		expect(slideIds()).toStrictEqual(['s']);
	});
});
