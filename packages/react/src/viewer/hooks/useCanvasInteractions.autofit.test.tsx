// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ElementRenderer } from '../components/ElementRenderer';
import type { ElementRendererProps } from '../components/elements/element-renderer-types';
import { useCanvasInteractions } from './useCanvasInteractions';
import type { UseCanvasInteractionsInput } from './useCanvasInteractions';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

/**
 * Regression test for the `a:spAutoFit` ("Resize shape to fit text") editor
 * behaviour: typing into an autofit text box and committing (blur) must grow
 * or shrink the shape, not just re-segment its text. This renders the REAL
 * `useCanvasInteractions` hook through `ElementRenderer` (not a mock
 * `onInlineEditCommit`), so it exercises the actual `[data-inline-editor]`
 * DOM lookup in `handleInlineEditCommit`, not just the shared decision
 * function in isolation (already covered by
 * `shape-autofit-resize.test.ts`'s `resolveInlineEditAutoFitHeight` suite).
 */

let container: HTMLDivElement;
let root: Root;
let originalScrollHeightDescriptor: PropertyDescriptor | undefined;

function stubScrollHeight(value: number): void {
	originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		'scrollHeight',
	);
	Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
		configurable: true,
		get: () => value,
	});
}

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
	if (originalScrollHeightDescriptor) {
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeightDescriptor);
		originalScrollHeightDescriptor = undefined;
	}
});

function makeTextElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'tx_1',
		type: 'text',
		x: 0,
		y: 0,
		width: 300,
		height: 40,
		text: 'Hello',
		textSegments: [{ text: 'Hello', style: {} }],
		textStyle: { autoFitMode: 'shrink' },
		...overrides,
	} as PptxElement;
}

function baseElementRendererProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: makeTextElement(),
		isSelected: true,
		isInlineEditing: true,
		inlineEditingText: 'Hello',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: true,
		imageAltText: 'Slide element',
		showResizeHandles: false,
		renderInk: true,
		renderGroups: true,
		adjustmentHandles: [],
		onResizePointerDown: vi.fn<() => void>(),
		onAdjustmentPointerDown: vi.fn<() => void>(),
		onInlineEditChange: vi.fn<() => void>(),
		onInlineEditCommit: vi.fn<() => void>(),
		onInlineEditCancel: vi.fn<() => void>(),
		...overrides,
	};
}

/** Harness: runs the real hook, then renders ElementRenderer wired to it. */
function Harness({
	element,
	inlineEditingText,
	updateElementById,
}: {
	element: PptxElement;
	inlineEditingText: string;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
}) {
	const elementLookup = new Map([[element.id, element]]);
	const ops = { updateElementById } as unknown as ElementOperations;
	const history = { markDirty: () => {} } as unknown as EditorHistoryResult;
	const input: UseCanvasInteractionsInput = {
		mode: 'edit',
		canEdit: true,
		canvasSize: { width: 960, height: 540 },
		activeSlideIndex: 0,
		selectedElementId: element.id,
		selectedElementIds: [element.id],
		selectedElementIdSet: new Set([element.id]),
		inlineEditingElementId: element.id,
		effectiveSelectedIds: [element.id],
		elementLookup,
		activeTool: 'select',
		editTemplateMode: false,
		editorScale: 1,
		canvasStageRef: { current: null },
		dragStateRef: { current: null },
		resizeStateRef: { current: null },
		shapeAdjustmentDragStateRef: { current: null },
		marqueeStateRef: { current: null },
		justInteractedRef: { current: false },
		setInlineEditingElementId: () => {},
		setInlineEditingText: () => {},
		setContextMenuState: () => {},
		setMarqueeSelectionState: () => {},
		setSnapLines: () => {},
		inlineEditingText,
		ops,
		history,
		presentationHandleAction: () => {},
		setEditingEquationOmml: () => {},
		setIsEquationDialogOpen: () => {},
	};
	const handlers = useCanvasInteractions(input);
	return (
		<ElementRenderer
			{...baseElementRendererProps({
				element,
				inlineEditingText,
				onInlineEditCommit: handlers.handleInlineEditCommit,
			})}
		/>
	);
}

function mount(props: {
	element: PptxElement;
	inlineEditingText: string;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
}): void {
	act(() => {
		root.render(<Harness {...props} />);
	});
}

function getInlineEditor(): HTMLElement {
	const editor = container.querySelector('[data-inline-editor]');
	if (!editor) {
		throw new Error('inline editor not rendered');
	}
	return editor as HTMLElement;
}

describe('useCanvasInteractions - spAutoFit editor resize', () => {
	it('grows a spAutoFit shape to the measured content height on commit (blur)', () => {
		stubScrollHeight(250);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		mount({
			element: makeTextElement({ height: 40 }),
			inlineEditingText: 'A much longer line of text that wraps to several lines',
			updateElementById,
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		expect(updateElementById).toHaveBeenCalledOnce();
		const [elementId, updates] = updateElementById.mock.calls[0];
		expect(elementId).toBe('tx_1');
		expect(updates.height).toBe(250);
	});

	it('does not touch height for normAutofit (font-shrink mode)', () => {
		stubScrollHeight(250);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		mount({
			element: makeTextElement({ height: 40, textStyle: { autoFitMode: 'normal' } }),
			inlineEditingText: 'Some text',
			updateElementById,
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		expect(updateElementById).toHaveBeenCalledOnce();
		const [, updates] = updateElementById.mock.calls[0];
		expect(updates.height).toBeUndefined();
	});

	it('does not touch height for a shape with no autofit at all', () => {
		stubScrollHeight(250);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		mount({
			element: makeTextElement({ height: 40, textStyle: {} }),
			inlineEditingText: 'Some text',
			updateElementById,
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		const [, updates] = updateElementById.mock.calls[0];
		expect(updates.height).toBeUndefined();
	});
});
