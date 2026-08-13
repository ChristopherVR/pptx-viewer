// @vitest-environment happy-dom
/**
 * Regression harness for "an inspector edit does not arm Undo".
 *
 * Wires the REAL {@link useEditorHistory} to the REAL {@link useElementOperations}
 * and drives the exact call the properties inspector makes
 * (`ViewerSidePanels` passes `ops.updateSelectedElement` as its
 * `onUpdateElement`), then asserts the ribbon's Undo predicate and that undo
 * actually restores the pre-edit value.
 *
 * The defect it pins: the history effect gated the expensive deep comparison
 * behind a cheap hash built from slide / element COUNTS plus a pointer-commit
 * nonce. An inspector edit rewrites a property in place, so every count stayed
 * the same and no pointer interaction had occurred: the hash was byte-identical
 * before and after and the effect returned before it could push a snapshot. The
 * edit rendered, `canUndo` stayed false, and Ctrl+Z was a no-op, while dragging
 * the same element on canvas worked because the drag bumped the pointer nonce.
 *
 * The sibling `useEditorHistory.test.ts` cannot catch this: it re-implements the
 * hook's pure helpers rather than running the hook, so it never evaluates the
 * gate at all.
 */
import type { PptxElement, PptxSlide, ShapeStyle } from 'pptx-viewer-core';
import React, { act, useCallback, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { CanvasSize, ElementContextMenuState } from '../types';
import { useEditorHistory } from './useEditorHistory';
import { useElementOperations } from './useElementOperations';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const ELEMENT_ID = 'shape-1';

function makeElement(): PptxElement {
	return {
		id: ELEMENT_ID,
		type: 'shape',
		x: 100,
		y: 50,
		width: 200,
		height: 80,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#3b82f6', lineColor: '#c00000' },
	} as unknown as PptxElement;
}

function makeSlides(): PptxSlide[] {
	return [
		{
			id: 'slide-1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [makeElement()],
		} as unknown as PptxSlide,
		// A second slide so the harness can NAVIGATE. Selecting a slide is the one
		// interaction that changes editor state without changing the document, and
		// the history effect used to be unable to tell the two apart.
		{
			id: 'slide-2',
			rId: 'rId2',
			slideNumber: 2,
			elements: [],
		} as unknown as PptxSlide,
	];
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface HarnessApi {
	canUndo: () => boolean;
	undo: () => void;
	/** The live element, as the canvas would render it. */
	element: () => PptxElement;
	/** Exactly what the inspector calls for a property field. */
	updateSelectedElement: (updates: Partial<PptxElement>) => void;
	/** Exactly what the inspector's fill / stroke controls call. */
	updateSelectedShapeStyle: (updates: Partial<ShapeStyle>) => void;
	/** A handler that reports a commit without changing the deck. */
	markDirtyOnly: () => void;
	/** Exactly what a thumbnail click does: move the active slide. */
	goToSlide: (index: number) => void;
	/** How many times the hook has reported "this document is dirty". */
	dirtyReports: () => number;
	/** The active slide index the hook is currently seeing. */
	activeSlideIndex: () => number;
}

let api: HarnessApi | null = null;
let dirtyReportCount = 0;

function noopDispatch<T>(): React.Dispatch<React.SetStateAction<T>> {
	return () => {};
}

function Harness(): React.ReactElement {
	const [slides, setSlides] = useState<PptxSlide[]>(makeSlides);
	const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 960, height: 540 });
	const [activeSlideIndex, setActiveSlideIndex] = useState(0);
	const [templateElementsBySlideId, setTemplateElementsBySlideId] = useState<
		Record<string, PptxElement[]>
	>({});
	const [selectedElementId, setSelectedElementId] = useState<string | null>(ELEMENT_ID);
	const [selectedElementIds, setSelectedElementIds] = useState<string[]>([ELEMENT_ID]);

	// No pointer interaction is ever in flight in this harness: the whole point
	// is that a KEYBOARD / control edit must be undoable without one.
	const hasActivePointerInteraction = useCallback(() => false, []);

	const history = useEditorHistory({
		slides,
		canvasSize,
		activeSlideIndex,
		templateElementsBySlideId,
		selectedElementId,
		selectedElementIds,
		editTemplateMode: false,
		headerFooter: {} as never,
		loading: false,
		error: null,
		hasActivePointerInteraction,
		pointerCommitNonce: 0,
		// The real composition passes `setIsDirty`; counting the calls is what
		// distinguishes "reported dirty once, for the edit" from "reported dirty
		// for a navigation too".
		onDirty: useCallback(() => {
			dirtyReportCount += 1;
		}, []),
		setSlides,
		setCanvasSize,
		setActiveSlideIndex,
		setTemplateElementsBySlideId,
		setSelectedElementId,
		setSelectedElementIds,
		setEditTemplateMode: noopDispatch<boolean>(),
		setHeaderFooter: noopDispatch<never>(),
	});

	const activeSlide = slides[activeSlideIndex];
	const selectedElement = useMemo(
		() => activeSlide?.elements.find((el) => el.id === selectedElementId) ?? null,
		[activeSlide, selectedElementId],
	);

	const ops = useElementOperations({
		slides,
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		editTemplateMode: false,
		templateElements: [],
		history,
		setSlides,
		setTemplateElementsBySlideId,
		setSelectedElementId,
		setSelectedElementIds,
		setInlineEditingElementId: noopDispatch<string | null>(),
		setContextMenuState: noopDispatch<ElementContextMenuState | null>(),
	});

	const slidesRef = useRef(slides);
	slidesRef.current = slides;
	const historyRef = useRef(history);
	historyRef.current = history;
	const activeIndexRef = useRef(activeSlideIndex);
	activeIndexRef.current = activeSlideIndex;

	api = {
		canUndo: () => historyRef.current.canUndo,
		undo: () => historyRef.current.handleUndo(),
		element: () => slidesRef.current[0].elements[0],
		updateSelectedElement: ops.updateSelectedElement,
		updateSelectedShapeStyle: ops.updateSelectedShapeStyle,
		markDirtyOnly: () => historyRef.current.markDirty(),
		goToSlide: setActiveSlideIndex,
		dirtyReports: () => dirtyReportCount,
		activeSlideIndex: () => activeIndexRef.current,
	};

	return <div />;
}

let root: Root | null = null;

function mount(): HarnessApi {
	dirtyReportCount = 0;
	const container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
	act(() => {
		root?.render(<Harness />);
	});
	if (!api) {
		throw new Error('harness did not mount');
	}
	return api;
}

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	root = null;
	api = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('history records content-only edits', () => {
	it('starts with an empty undo stack', () => {
		const harness = mount();
		expect(harness.canUndo()).toBeFalsy();
	});

	it('arms Undo for a numeric geometry edit that changes no element count', () => {
		const harness = mount();

		act(() => {
			harness.updateSelectedElement({ x: 400 } as Partial<PptxElement>);
		});

		expect(harness.element().x).toBe(400);
		expect(harness.canUndo()).toBeTruthy();
	});

	it('restores the pre-edit value when that edit is undone', () => {
		const harness = mount();

		act(() => {
			harness.updateSelectedElement({ x: 400 } as Partial<PptxElement>);
		});
		act(() => {
			harness.undo();
		});

		expect(harness.element().x).toBe(100);
	});

	it('arms Undo for a shape-style edit (the connector arrowhead / fill path)', () => {
		const harness = mount();

		act(() => {
			harness.updateSelectedShapeStyle({ tailEndType: 'diamond' } as Partial<ShapeStyle>);
		});

		expect(harness.canUndo()).toBeTruthy();
	});

	it('restores the previous shape style when that edit is undone', () => {
		const harness = mount();

		act(() => {
			harness.updateSelectedShapeStyle({ tailEndType: 'diamond' } as Partial<ShapeStyle>);
		});
		act(() => {
			harness.undo();
		});

		const style = (harness.element() as unknown as { shapeStyle: ShapeStyle }).shapeStyle;
		expect(style.tailEndType).toBeUndefined();
	});

	it('records one entry per edit, so successive edits undo one at a time', () => {
		const harness = mount();

		act(() => {
			harness.updateSelectedElement({ x: 400 } as Partial<PptxElement>);
		});
		act(() => {
			harness.updateSelectedElement({ y: 300 } as Partial<PptxElement>);
		});
		act(() => {
			harness.undo();
		});

		// Only the second edit is rolled back.
		expect(harness.element().y).toBe(50);
		expect(harness.element().x).toBe(400);
		expect(harness.canUndo()).toBeTruthy();
	});

	it('pushes nothing when a handler reports a commit but changes no state', () => {
		const harness = mount();

		act(() => {
			harness.markDirtyOnly();
		});

		expect(harness.canUndo()).toBeFalsy();
	});
});

/**
 * Navigation is not an edit.
 *
 * The tracking effect decided "the deck changed" by serializing the WHOLE
 * history snapshot, and that snapshot carries `activeSlideIndex` so undo can
 * return the user to the slide the edit happened on. Selecting a slide changes
 * nothing else, so it read as a document mutation and the effect did both of
 * the things it does for a real edit:
 *
 *  - called `onDirty`, which is what `state.isDirty` and through it
 *    `useAutosave` gate on. Merely clicking through a deck therefore wrote a
 *    crash-recovery snapshot, and the NEXT visit offered to "recover unsaved
 *    changes" for a presentation the user had only read. Measured on the
 *    running demos: IndexedDB held zero records after load and one after a
 *    single thumbnail click, while Angular and Vanilla - which raise dirty from
 *    explicit commit choke points - stayed empty throughout.
 *  - pushed an undo entry, so Ctrl+Z walked back through navigation.
 *
 * The gate is now the document alone. `activeSlideIndex` still rides in the
 * stored snapshot, and the last test here pins that it stays CURRENT, or undo
 * would jump the user to wherever they happened to be before navigating.
 */
describe('navigating between slides is not an edit', () => {
	it('reports no dirty and pushes no undo entry for a slide selection', () => {
		const harness = mount();

		act(() => {
			harness.goToSlide(1);
		});
		act(() => {
			harness.goToSlide(0);
		});

		expect(harness.activeSlideIndex()).toBe(0);
		expect(harness.dirtyReports()).toBe(0);
		expect(harness.canUndo()).toBeFalsy();
	});

	it('still records the next real edit, so the gate cannot swallow one', () => {
		const harness = mount();

		act(() => {
			harness.goToSlide(1);
		});
		act(() => {
			harness.goToSlide(0);
		});
		act(() => {
			harness.updateSelectedElement({ x: 400 } as Partial<PptxElement>);
		});

		expect(harness.element().x).toBe(400);
		expect(harness.dirtyReports()).toBeGreaterThan(0);
		expect(harness.canUndo()).toBeTruthy();
	});

	it('undoes an edit made after navigating back to the slide it was made on', () => {
		const harness = mount();

		act(() => {
			harness.goToSlide(1);
		});
		act(() => {
			harness.goToSlide(0);
		});
		act(() => {
			harness.updateSelectedElement({ x: 400 } as Partial<PptxElement>);
		});
		act(() => {
			harness.undo();
		});

		expect(harness.element().x).toBe(100);
		// The stored snapshot tracked the navigation even though it did not act on
		// it, so undo restores the slide the edit happened on, not slide 2.
		expect(harness.activeSlideIndex()).toBe(0);
	});
});
