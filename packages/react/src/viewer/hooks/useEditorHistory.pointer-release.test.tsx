// @vitest-environment happy-dom
/**
 * Regression harness for "committing inline text by clicking away is not
 * undoable".
 *
 * Wires the REAL {@link useEditorHistory} to the REAL {@link useElementOperations}
 * and reproduces the exact ordering the canvas mousedown handlers produce:
 * `handleCanvasMouseDown` / `handleElementMouseDown` call
 * `handleInlineEditCommit()` (which updates the element and `markDirty()`s)
 * and then, still inside the same pointerdown, arm `marqueeStateRef` /
 * `dragStateRef`. By the time React runs the history effect the pointer
 * interaction is already active, so the effect defers. A plain click never
 * moves, so `processPointerUp` never bumps `pointerCommitNonce`, and nothing
 * else re-runs the effect: the committed text sat outside the undo stack until
 * the NEXT edit's snapshot swallowed it, so one Undo reverted two changes.
 *
 * The sibling `useEditorHistory.content-edit.test.tsx` cannot catch this: its
 * `hasActivePointerInteraction` is a constant `false`.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
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

const ELEMENT_ID = 'text-1';

function makeSlides(): PptxSlide[] {
	return [
		{
			id: 'slide-1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [
				{
					id: ELEMENT_ID,
					type: 'text',
					x: 100,
					y: 50,
					width: 200,
					height: 80,
					text: 'before',
				} as unknown as PptxElement,
			],
		} as unknown as PptxSlide,
	];
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface HarnessApi {
	canUndo: () => boolean;
	undo: () => void;
	element: () => PptxElement;
	/** What `handleInlineEditCommit` ends up calling. */
	updateElementById: (id: string, updates: Partial<PptxElement>) => void;
	/** Arms / releases the drag, marquee, resize or adjust refs. */
	setPointerActive: (active: boolean) => void;
	/** A pointer-up re-render that changes none of the history effect's deps. */
	rerender: () => void;
	/** What a MOVED pointer-up does in addition. */
	bumpPointerCommitNonce: () => void;
	dirtyReports: () => number;
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
	const [pointerCommitNonce, setPointerCommitNonce] = useState(0);
	// Stands in for `setMarqueeSelectionState(null)` / `clearSelection()` on
	// pointer-up: a state change the history effect does not depend on.
	const [, setUnrelated] = useState(0);

	// The real gate reads the drag / resize / marquee / adjust refs, which the
	// pointerdown handlers assign synchronously AFTER committing inline text.
	const pointerActiveRef = useRef(false);
	const hasActivePointerInteraction = useCallback(() => pointerActiveRef.current, []);

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
		pointerCommitNonce,
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
		inlineEditingElementId: null,
		inlineEditingText: '',
	});

	const slidesRef = useRef(slides);
	slidesRef.current = slides;
	const historyRef = useRef(history);
	historyRef.current = history;

	api = {
		canUndo: () => historyRef.current.canUndo,
		undo: () => historyRef.current.handleUndo(),
		element: () => slidesRef.current[0].elements[0],
		updateElementById: ops.updateElementById,
		setPointerActive: (active) => {
			pointerActiveRef.current = active;
		},
		rerender: () => setUnrelated((n) => n + 1),
		bumpPointerCommitNonce: () => setPointerCommitNonce((n) => n + 1),
		dirtyReports: () => dirtyReportCount,
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

/** Let the hook's deferred re-check observe the released pointer. */
async function settle(): Promise<void> {
	await act(async () => {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 80);
		});
	});
}

/**
 * The pointerdown ordering: commit the inline text, THEN arm the pointer
 * interaction, all before React gets to render.
 */
function commitTextThenArmPointer(harness: HarnessApi, text: string): void {
	act(() => {
		harness.updateElementById(ELEMENT_ID, { text } as Partial<PptxElement>);
		harness.setPointerActive(true);
	});
}

/** The pointerup of a plain click: nothing moved, so no nonce bump. */
function releasePointerWithoutMove(harness: HarnessApi): void {
	act(() => {
		harness.setPointerActive(false);
		harness.rerender();
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('a text commit deferred behind a pointer interaction', () => {
	it('is still swallowed while the pointer is down', () => {
		const harness = mount();

		commitTextThenArmPointer(harness, 'after');

		expect(harness.element().text).toBe('after');
		expect(harness.canUndo()).toBeFalsy();
	});

	it('arms Undo once a plain click (no move) releases the pointer', async () => {
		const harness = mount();

		commitTextThenArmPointer(harness, 'after');
		releasePointerWithoutMove(harness);
		await settle();

		expect(harness.canUndo()).toBeTruthy();
		expect(harness.dirtyReports()).toBeGreaterThan(0);
	});

	it('restores the pre-edit text when that entry is undone', async () => {
		const harness = mount();

		commitTextThenArmPointer(harness, 'after');
		releasePointerWithoutMove(harness);
		await settle();
		act(() => {
			harness.undo();
		});

		expect(harness.element().text).toBe('before');
	});

	it('keeps the click-away commit and the next edit as separate undo steps', async () => {
		const harness = mount();

		commitTextThenArmPointer(harness, 'after');
		releasePointerWithoutMove(harness);
		await settle();
		act(() => {
			harness.updateElementById(ELEMENT_ID, { x: 400 } as Partial<PptxElement>);
		});
		act(() => {
			harness.undo();
		});

		// Only the geometry edit is rolled back; the text commit is its own entry.
		expect(harness.element().x).toBe(100);
		expect(harness.element().text).toBe('after');
		expect(harness.canUndo()).toBeTruthy();
	});

	it('still records a commit released by a moved pointer (the drag path)', async () => {
		const harness = mount();

		commitTextThenArmPointer(harness, 'after');
		act(() => {
			harness.setPointerActive(false);
			harness.bumpPointerCommitNonce();
		});
		await settle();

		expect(harness.canUndo()).toBeTruthy();
	});

	it('pushes nothing when the pointer is released with no commit pending', async () => {
		const harness = mount();

		act(() => {
			harness.setPointerActive(true);
			// A re-render mid-interaction that the effect happens to observe.
			harness.rerender();
		});
		releasePointerWithoutMove(harness);
		await settle();

		expect(harness.canUndo()).toBeFalsy();
		expect(harness.dirtyReports()).toBe(0);
	});
});
