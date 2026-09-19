// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import {
	createCollaborationLivePatcher,
	createSnapshotTextPositions,
	findElementYMap,
	reconcileSlidesInYDoc,
} from 'pptx-viewer-shared';
import type { CollaborationLivePatcher, InlineTextEditSnapshot } from 'pptx-viewer-shared';
import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';

import { ElementRenderer } from '../components/ElementRenderer';
import type { ElementRendererProps } from '../components/elements/element-renderer-types';
import { InlineCollaborationContext } from '../components/elements/InlineCollaborationContext';
import { useCanvasInteractions } from './useCanvasInteractions';
import type { UseCanvasInteractionsInput } from './useCanvasInteractions';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import type { PendingInlineEditReader } from './useInlineEditingState';

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
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
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
	markDirty,
	transformCommittedText,
	canEdit = true,
	patcher,
}: {
	element: PptxElement;
	inlineEditingText: string;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
	markDirty?: () => void;
	transformCommittedText?: (text: string) => string;
	canEdit?: boolean;
	patcher?: CollaborationLivePatcher;
}) {
	const [editingId, setEditingId] = useState<string | null>(element.id);
	const latest = useRef({ canEdit, editingId, element });
	latest.current = { canEdit, editingId, element };
	const textRef = useRef(inlineEditingText);
	const snapshotRef = useRef<InlineTextEditSnapshot | undefined>(undefined);
	const readerRef = useRef<PendingInlineEditReader | undefined>(undefined);
	const elementLookup = new Map([[element.id, element]]);
	const ops = { updateElementById } as unknown as ElementOperations;
	const history = { markDirty: markDirty ?? (() => {}) } as unknown as EditorHistoryResult;
	const input: UseCanvasInteractionsInput = {
		mode: 'edit',
		canEdit,
		canvasSize: { width: 960, height: 540 },
		activeSlideIndex: 0,
		selectedElementId: element.id,
		selectedElementIds: [element.id],
		selectedElementIdSet: new Set([element.id]),
		inlineEditingElementId: editingId,
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
		setInlineEditingElementId: setEditingId,
		setInlineEditingText: () => {},
		setContextMenuState: () => {},
		setMarqueeSelectionState: () => {},
		setSnapLines: () => {},
		inlineEditingText,
		inlineEditingTextRef: patcher ? textRef : undefined,
		inlineEditingSnapshotRef: patcher ? snapshotRef : undefined,
		inlineEditingReaderRef: patcher ? readerRef : undefined,
		ops,
		history,
		transformCommittedText,
		presentationHandleAction: () => {},
		setEditingEquationOmml: () => {},
		setIsEquationDialogOpen: () => {},
	};
	const handlers = useCanvasInteractions(input);
	return (
		<InlineCollaborationContext.Provider
			value={
				patcher
					? {
							patcher,
							slideId: 's1',
							elementIds: new Set([element.id]),
							readReadOnlyElement: (id) =>
								!latest.current.canEdit && latest.current.editingId === id
									? latest.current.element
									: undefined,
							registerReader: (id, read) => {
								const entry = { elementId: id, read };
								readerRef.current = entry;
								return () => {
									if (readerRef.current === entry) {
										readerRef.current = undefined;
									}
								};
							},
						}
					: undefined
			}
		>
			<ElementRenderer
				{...baseElementRendererProps({
					element,
					inlineEditingText,
					isInlineEditing: editingId !== null,
					canInteract: canEdit,
					onInlineEditCommit: handlers.handleInlineEditCommit,
					...(patcher
						? {
								onInlineEditChange: (text: string, snapshot?: InlineTextEditSnapshot) => {
									textRef.current = text;
									snapshotRef.current = snapshot;
									patcher.patchText('s1', element.id, text);
								},
							}
						: {}),
				})}
			/>
		</InlineCollaborationContext.Provider>
	);
}

function mount(props: {
	element: PptxElement;
	inlineEditingText: string;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
	markDirty?: () => void;
	transformCommittedText?: (text: string) => string;
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

describe('inline edit permission transitions', () => {
	it.each([false, true])(
		'preserves only accepted shared text on permission loss (composing=%s)',
		(composing) => {
			const doc = new Y.Doc();
			const element = makeTextElement();
			const factories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
				createTextPositions: (text: import('pptx-viewer-shared').YTextEditableLike) =>
					createSnapshotTextPositions(text as unknown as Y.Text, {
						read: () => Y.snapshot(doc),
						equal: Y.equalSnapshots,
						subscribeBeforeObservers: (listener: () => void) => {
							doc.on('beforeObserverCalls', listener);
							return () => doc.off('beforeObserverCalls', listener);
						},
					}),
			};
			reconcileSlidesInYDoc([{ id: 's1', slideNumber: 1, elements: [element] }], doc, factories);
			const patcher = createCollaborationLivePatcher();
			patcher.configure(doc, factories, true);
			const update = vi.fn((_id: string, updates: Partial<PptxElement>) =>
				reconcileSlidesInYDoc(
					[{ id: 's1', slideNumber: 1, elements: [{ ...element, ...updates } as PptxElement] }],
					doc,
					factories,
				),
			);
			const props = { element, inlineEditingText: 'Hello', updateElementById: update, patcher };
			act(() => root.render(<Harness {...props} />));
			const editor = getInlineEditor();
			const node = editor.querySelector('span')!.firstChild as Text;
			const range = document.createRange();
			range.setStart(node, 0);
			range.collapse(true);
			window.getSelection()!.removeAllRanges();
			window.getSelection()!.addRange(range);
			act(() => {
				const before = new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' });
				Object.defineProperty(before, 'getTargetRanges', { value: () => [range.cloneRange()] });
				editor.dispatchEvent(before);
				node.insertData(0, 'A');
				editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
			});
			const body = findElementYMap(doc, 's1', element.id)!.get('textBody') as Y.Text;
			act(() =>
				doc.transact(() => {
					body.insert(body.length, 'Z', {});
					findElementYMap(doc, 's1', element.id)!.set('text', body.toString());
				}, 'peer'),
			);
			if (composing) {
				act(() => {
					editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
					editor.querySelector('span')!.append('UNACCEPTED');
					editor.dispatchEvent(
						new InputEvent('input', {
							bubbles: true,
							inputType: 'insertCompositionText',
							isComposing: true,
						}),
					);
				});
			}
			const writes = vi.fn();
			doc.on('update', writes);
			act(() => root.render(<Harness {...props} canEdit={false} />));
			expect(container.querySelector('[data-inline-editor]')).toBeNull();
			expect(update).toHaveBeenCalledExactlyOnceWith(
				element.id,
				expect.objectContaining({ text: 'AHelloZ' }),
			);
			expect(body.toString()).toBe('AHelloZ');
			expect(writes).not.toHaveBeenCalled();
			patcher.dispose();
			doc.destroy();
		},
	);

	it('retains the accepted draft and removes the native editable surface on permission loss', () => {
		const updateElementById = vi.fn();
		const props = {
			element: makeTextElement(),
			inlineEditingText: 'Accepted draft',
			updateElementById,
		};
		mount(props);
		expect(getInlineEditor()).toBeTruthy();
		act(() => root.render(<Harness {...props} canEdit={false} />));
		expect(container.querySelector('[data-inline-editor]')).toBeNull();
		act(() => root.render(<Harness {...props} canEdit />));
		expect(updateElementById).toHaveBeenCalledExactlyOnceWith(
			'tx_1',
			expect.objectContaining({ text: 'Accepted draft' }),
		);
		expect(container.querySelector('[data-inline-editor]')).toBeNull();
	});

	it('does not render an editable low-level element when interaction is disabled', () => {
		act(() =>
			root.render(<ElementRenderer {...baseElementRendererProps({ canInteract: false })} />),
		);
		expect(container.querySelector('[data-inline-editor]')).toBeNull();
		expect(container.textContent).toContain('Hello');
	});
});

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

	it('does not resize or dirty an unchanged spAutoFit shape on blur', () => {
		stubScrollHeight(42);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		const markDirty = vi.fn<() => void>();
		mount({
			element: makeTextElement({ height: 162 }),
			inlineEditingText: 'Hello',
			updateElementById,
			markDirty,
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		expect(updateElementById).not.toHaveBeenCalled();
		expect(markDirty).not.toHaveBeenCalled();
	});

	it('resizes when autocorrect changes otherwise unchanged text', () => {
		stubScrollHeight(55);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		mount({
			element: makeTextElement(),
			inlineEditingText: 'Hello',
			updateElementById,
			transformCommittedText: () => '“Hello”',
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		expect(updateElementById).toHaveBeenCalledWith(
			'tx_1',
			expect.objectContaining({ text: '“Hello”', height: 55 }),
		);
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

/**
 * Regression test for the `a:normAutofit` ("Shrink text on overflow") editor
 * behaviour: typing past capacity in a normAutofit box must recompute
 * `autoFitFontScale`/`autoFitLineSpacingReduction`, not just leave the last
 * authored (or default) values in place. Runs through the same real-hook,
 * real-DOM harness as the `spAutoFit` suite above.
 */
describe('useCanvasInteractions - normAutofit editor font shrink', () => {
	it('shrinks fontScale/lnSpcReduction on commit when the text overflows the box', () => {
		// happy-dom's stubbed scrollHeight cannot vary per candidate step, so
		// every rung in the staircase measures as "still overflowing" and the
		// decision lands on the smallest (floor) rung.
		stubScrollHeight(400);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		mount({
			element: makeTextElement({ height: 40, textStyle: { autoFitMode: 'normal' } }),
			inlineEditingText: 'A very long line of text that overflows the shrink-to-fit box',
			updateElementById,
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		expect(updateElementById).toHaveBeenCalledOnce();
		const [, updates] = updateElementById.mock.calls[0];
		expect(updates.textStyle).toMatchObject({
			autoFitFontScale: 0.25,
			autoFitLineSpacingReduction: 0.2,
		});
	});

	it('does not touch textStyle for spAutoFit (shape-resize mode)', () => {
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

		const [, updates] = updateElementById.mock.calls[0];
		expect(updates.textStyle).toBeUndefined();
	});

	it('leaves textStyle alone when the (stubbed) content already fits the box', () => {
		stubScrollHeight(10);
		const updateElementById = vi.fn<(elementId: string, updates: Partial<PptxElement>) => void>();
		mount({
			element: makeTextElement({ height: 40, textStyle: { autoFitMode: 'normal' } }),
			inlineEditingText: 'Short',
			updateElementById,
		});

		act(() => {
			getInlineEditor().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});

		const [, updates] = updateElementById.mock.calls[0];
		expect(updates.textStyle).toBeUndefined();
	});
});
