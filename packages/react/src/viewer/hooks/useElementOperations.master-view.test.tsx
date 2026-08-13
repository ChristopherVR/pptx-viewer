// @vitest-environment happy-dom
/**
 * View > Slide Master write routing.
 *
 * React built a pseudo-slide keyed on the master's ARCHIVE PATH and then let
 * `updateElementById` fall into the template store, where `buildSaveSlides`
 * looks parts up by real slide id: the key never matched, so every master-view
 * edit showed on screen and was dropped on save. These tests drive the real
 * `useElementOperations` hook (not a re-implementation of it) and assert the
 * edit lands on the master / layout / notes model instead.
 */
import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { EditorHistoryResult } from './useEditorHistory';
import { useElementOperations } from './useElementOperations';
import type { ElementOperations, MasterViewRouting } from './useElementOperations';

const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout1.xml';

function shape(id: string, x = 0): PptxElement {
	return { id, type: 'shape', x, y: 0, width: 10, height: 10 } as PptxElement;
}

function makeMasters(): PptxSlideMaster[] {
	return [
		{
			path: MASTER_PATH,
			elements: [shape('slide-master-slideMaster1-shape-0')],
			layouts: [{ path: LAYOUT_PATH, elements: [shape('slide-layout-slideLayout1-shape-0')] }],
		} as PptxSlideMaster,
	];
}

const slide: PptxSlide = {
	id: 'ppt/slides/slide1.xml',
	rId: 'rId2',
	slideNumber: 1,
	elements: [shape('ppt/slides/slide1.xml-shape-0')],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

interface Harness {
	ops: () => ElementOperations;
	slideMasters: () => PptxSlideMaster[];
	notesMaster: () => PptxNotesMaster | undefined;
	setSlides: ReturnType<typeof vi.fn>;
	setTemplateElementsBySlideId: ReturnType<typeof vi.fn>;
	markDirty: ReturnType<typeof vi.fn>;
}

/** Mount the real hook with a master-view routing block wired to local state. */
function mount(target: MasterViewRouting['target']): Harness {
	let masters = makeMasters();
	let notes: PptxNotesMaster | undefined = {
		path: 'ppt/notesMasters/notesMaster1.xml',
		elements: [shape('notes-master-shape-0')],
	};
	let handout: PptxHandoutMaster | undefined;
	let latest: ElementOperations | undefined;
	const setSlides = vi.fn();
	const setTemplateElementsBySlideId = vi.fn();
	const markDirty = vi.fn();

	function Probe(): null {
		latest = useElementOperations({
			slides: [slide],
			activeSlide: slide,
			activeSlideIndex: 0,
			selectedElement: null,
			selectedElementId: null,
			editTemplateMode: false,
			templateElements: [],
			masterView: {
				target,
				slideMasters: masters,
				notesMaster: notes,
				handoutMaster: handout,
				setSlideMasters: ((next: PptxSlideMaster[]) => {
					masters = next;
				}) as MasterViewRouting['setSlideMasters'],
				setNotesMaster: ((next: PptxNotesMaster) => {
					notes = next;
				}) as MasterViewRouting['setNotesMaster'],
				setHandoutMaster: ((next: PptxHandoutMaster) => {
					handout = next;
				}) as MasterViewRouting['setHandoutMaster'],
			},
			history: { markDirty } as unknown as EditorHistoryResult,
			setSlides,
			setTemplateElementsBySlideId,
			setSelectedElementId: vi.fn(),
			setSelectedElementIds: vi.fn(),
			setInlineEditingElementId: vi.fn(),
			setContextMenuState: vi.fn(),
		});
		return null;
	}

	act(() => root.render(<Probe />));
	return {
		ops: () => latest!,
		slideMasters: () => masters,
		notesMaster: () => notes,
		setSlides,
		setTemplateElementsBySlideId,
		markDirty,
	};
}

describe('useElementOperations master-view routing', () => {
	it('exposes the master shape tree as the active element list', () => {
		const h = mount({ tab: 'slides', masterIndex: 0, layoutIndex: null });
		expect(h.ops().activeElements.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
		]);
	});

	it('writes a master edit into the master model, not into slides', () => {
		const h = mount({ tab: 'slides', masterIndex: 0, layoutIndex: null });
		act(() => h.ops().updateElementById('slide-master-slideMaster1-shape-0', { x: 42 }));

		expect(h.slideMasters()[0].elements?.[0].x).toBe(42);
		expect(h.setSlides).not.toHaveBeenCalled();
		expect(h.setTemplateElementsBySlideId).not.toHaveBeenCalled();
		expect(h.markDirty).toHaveBeenCalledWith();
	});

	it('routes a layout edit to the layout while the master stays put', () => {
		const h = mount({ tab: 'slides', masterIndex: 0, layoutIndex: 0 });
		expect(h.ops().activeElements.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
			'slide-layout-slideLayout1-shape-0',
		]);

		act(() => h.ops().updateElementById('slide-layout-slideLayout1-shape-0', { x: 7 }));
		expect(h.slideMasters()[0].layouts?.[0].elements?.[0].x).toBe(7);
		expect(h.slideMasters()[0].elements?.[0].x).toBe(0);
	});

	it('routes a notes-master edit to the notes master', () => {
		const h = mount({ tab: 'notes', masterIndex: 0, layoutIndex: null });
		act(() => h.ops().updateElementById('notes-master-shape-0', { x: 5 }));
		expect(h.notesMaster()?.elements?.[0].x).toBe(5);
	});

	it('deletes through the active-element list without touching slides', () => {
		const h = mount({ tab: 'slides', masterIndex: 0, layoutIndex: 0 });
		act(() =>
			h
				.ops()
				.updateActiveElements((els) =>
					els.filter((el) => el.id !== 'slide-layout-slideLayout1-shape-0'),
				),
		);
		expect(h.slideMasters()[0].layouts?.[0].elements).toStrictEqual([]);
		expect(h.slideMasters()[0].elements).toHaveLength(1);
		expect(h.setSlides).not.toHaveBeenCalled();
	});

	it('leaves the ordinary slide path alone when the master view is closed', () => {
		const h = mount(null);
		act(() => h.ops().updateElementById('ppt/slides/slide1.xml-shape-0', { x: 3 }));

		// The ordinary path is a React state update, so `setSlides` receives a
		// FUNCTIONAL updater, never a literal array. Assert on what that updater
		// actually produces: the edit must land on the active slide's element.
		expect(h.setSlides).toHaveBeenCalledOnce();
		const updater = h.setSlides.mock.calls[0]?.[0] as (prev: PptxSlide[]) => PptxSlide[];
		expect(updater).toBeTypeOf('function');
		expect(updater([slide])[0].elements[0].x).toBe(3);
		expect(h.markDirty).toHaveBeenCalledWith();
		// ...and nothing leaks into the master model.
		expect(h.slideMasters()[0].elements?.[0].x).toBe(0);
	});
});
