// @vitest-environment happy-dom
/**
 * Selection-scoped text edits through the real `useElementOperations` hook.
 *
 * With an inline selection active, `updateSelectedTextStyle` used to route the
 * WHOLE update through the selected runs, so a body-level key such as
 * `paragraphMarginLeft` (Increase Indent) landed on run styles the renderer
 * never reads and nothing happened. Body keys must reach `element.textStyle`
 * regardless of selection; run keys stay scoped. Bullets / Numbering act on
 * the paragraphs the selection intersects.
 */
import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import type { InlineTextSelection } from 'pptx-viewer-shared';
import {
	attachInlineListController,
	createInlineListSeed,
	initializeInlineListDom,
	inlineListBodyText,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EditorHistoryResult } from './useEditorHistory';
import { useElementOperations } from './useElementOperations';
import type { ElementOperations } from './useElementOperations';

const selectionMock = vi.hoisted(() => ({ current: null as InlineTextSelection | null }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal<typeof import('pptx-viewer-shared')>();
	return {
		...actual,
		getInlineEditorSelectionResult: (
			...args: Parameters<typeof actual.getInlineEditorSelectionResult>
		) => {
			const result = actual.getInlineEditorSelectionResult(...args);
			return result.kind === 'supported' && !result.snapshot
				? { ...result, selection: selectionMock.current }
				: result;
		},
	};
});

type TextEl = PptxElement & {
	text?: string;
	textStyle?: { paragraphMarginLeft?: number; bold?: boolean };
	textSegments?: TextSegment[];
};

function textElement(segments: TextSegment[]): PptxElement {
	return {
		id: 'shape-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: segments.map((s) => s.text).join(''),
		textStyle: { fontSize: 18 },
		textSegments: segments,
	} as PptxElement;
}

let container: HTMLDivElement;
let root: Root;
const listCleanups: Array<() => void> = [];

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	selectionMock.current = null;
});

afterEach(() => {
	listCleanups.splice(0).forEach((cleanup) => cleanup());
	window.getSelection()?.removeAllRanges();
	act(() => root.unmount());
	container.remove();
});

function nativeList(element: PptxElement, paragraph: number, start: number, end: number) {
	const seed = createInlineListSeed(element);
	if (!seed) {
		throw new Error('Expected a list seed');
	}
	const editor = document.createElement('div');
	editor.contentEditable = 'true';
	document.body.append(editor);
	expect(initializeInlineListDom(editor, seed)).toBeTruthy();
	const controller = attachInlineListController(editor, seed);
	listCleanups.push(() => {
		controller.dispose();
		editor.remove();
	});
	const text = editor.children[paragraph].querySelector('[data-pptx-list-run]')!.firstChild!;
	const range = document.createRange();
	range.setStart(text, start);
	range.setEnd(text, end);
	window.getSelection()!.removeAllRanges();
	window.getSelection()!.addRange(range);
	return { editor, controller };
}

function mount(
	element: PptxElement,
	editing = false,
): { ops: () => ElementOperations; element: () => TextEl } {
	let slides: PptxSlide[] = [{ id: 'slide-1', rId: 'rId2', slideNumber: 1, elements: [element] }];
	let latest: ElementOperations | undefined;

	function Probe(): null {
		latest = useElementOperations({
			slides,
			activeSlide: slides[0],
			activeSlideIndex: 0,
			selectedElement: slides[0].elements[0],
			selectedElementId: 'shape-1',
			editTemplateMode: false,
			templateElements: [],
			history: { markDirty: vi.fn() } as unknown as EditorHistoryResult,
			setSlides: (updater) => {
				slides = typeof updater === 'function' ? updater(slides) : updater;
				act(() => root.render(<Probe />));
			},
			setTemplateElementsBySlideId: vi.fn(),
			setSelectedElementId: vi.fn(),
			setSelectedElementIds: vi.fn(),
			setInlineEditingElementId: vi.fn(),
			setContextMenuState: vi.fn(),
			inlineEditingElementId: editing ? element.id : null,
			inlineEditingText: '',
		});
		return null;
	}

	act(() => root.render(<Probe />));
	return { ops: () => latest!, element: () => slides[0].elements[0] as TextEl };
}

describe('updateSelectedTextStyle with an inline selection', () => {
	it('writes a body-level key to element.textStyle instead of the selected runs', () => {
		const h = mount(textElement([{ text: 'Hello world', style: {} }]));
		selectionMock.current = { startSegIdx: 0, startOffset: 6, endSegIdx: 0, endOffset: 11 };
		act(() => h.ops().updateSelectedTextStyle({ paragraphMarginLeft: 24 }));
		expect(h.element().textStyle?.paragraphMarginLeft).toBe(24);
		expect(h.element().textSegments?.map((s) => s.text)).toStrictEqual(['Hello world']);
	});

	it('scopes a run-level key to the selection and leaves the body flag honest', () => {
		const h = mount(textElement([{ text: 'Hello world', style: {} }]));
		selectionMock.current = { startSegIdx: 0, startOffset: 6, endSegIdx: 0, endOffset: 11 };
		act(() => h.ops().updateSelectedTextStyle({ bold: true }));
		expect(h.element().textSegments?.map((s) => [s.text, Boolean(s.style.bold)])).toStrictEqual([
			['Hello ', false],
			['world', true],
		]);
		expect(h.element().textStyle?.bold).toBeFalsy();
	});
});

describe('toggleSelectedBullets', () => {
	const twoParagraphs = (): TextSegment[] => [
		{ text: 'A', style: {} },
		{ text: '\n', style: {}, isParagraphBreak: true },
		{ text: 'B', style: {} },
	];

	it('bullets only the paragraph the selection touches', () => {
		const h = mount(textElement(twoParagraphs()));
		selectionMock.current = { startSegIdx: 2, startOffset: 0, endSegIdx: 2, endOffset: 1 };
		act(() => h.ops().toggleSelectedBullets('bullet'));
		expect(h.element().textSegments?.map((s) => s.text)).toStrictEqual(['A', '\n', '• ', 'B']);
	});

	it('bullets every paragraph without a selection, and toggles back off', () => {
		const h = mount(textElement(twoParagraphs()));
		act(() => h.ops().toggleSelectedBullets('numbered'));
		expect(h.element().textSegments?.map((s) => s.text)).toStrictEqual([
			'1.',
			'A',
			'\n',
			'2.',
			'B',
		]);
		act(() => h.ops().toggleSelectedBullets('numbered'));
		expect(h.element().textSegments?.map((s) => s.text)).toStrictEqual(['A', '\n', 'B']);
	});
});

describe('merged style scope with a current native list draft', () => {
	const draft = () =>
		textElement([
			{
				text: 'First',
				style: { fontSize: 18 },
				bulletInfo: { char: '◆' },
				paragraphProperties: { paragraphSpacingAfter: 12 },
			},
			{ text: '\n', style: {}, isParagraphBreak: true },
			{
				text: 'Typed words',
				style: { fontSize: 32 },
				bulletInfo: { char: '◆' },
				paragraphLevel: 1,
				paragraphProperties: { paragraphSpacingAfter: 22 },
			},
		]);

	it('combines body and selected-run updates without losing fresh text or paragraph provenance', () => {
		const h = mount(textElement([{ text: 'Old model', style: {} }]), true);
		const { controller } = nativeList(draft(), 1, 6, 11);
		act(() => h.ops().updateSelectedTextStyle({ bold: true, vAlign: 'bottom' }));
		expect(h.element()).toMatchObject({
			text: 'First\nTyped words',
			textStyle: { vAlign: 'bottom' },
		});
		const read = controller.read();
		expect(read.kind).toBe('supported');
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments).toStrictEqual(h.element().textSegments);
		expect(h.element().textSegments?.find((run) => run.text === 'words')?.style.bold).toBeTruthy();
		expect(h.element().textSegments?.find((run) => run.text === 'Typed ')?.style.bold).toBeFalsy();
		expect(
			h.element().textSegments?.find((run) => run.paragraphLevel === 1)?.paragraphProperties,
		).toStrictEqual({ paragraphSpacingAfter: 22 });
	});

	it('toggles only the fresh selected paragraph and rejects a composing draft before a model write', () => {
		const original = textElement([{ text: 'Old model', style: {} }]);
		const h = mount(original, true);
		const { editor, controller } = nativeList(draft(), 1, 0, 11);
		act(() => h.ops().toggleSelectedBullets('bullet'));
		const read = controller.read();
		expect(read.kind).toBe('supported');
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.paragraphs.map((paragraph) => paragraph.bulletMarker)).toStrictEqual([
			'◆',
			undefined,
		]);
		expect(inlineListBodyText(read.snapshot.textSegments!)).toBe('First\nTyped words');
		expect(h.element().textSegments).toStrictEqual(read.snapshot.textSegments);
		const before = h.element();
		editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		act(() => h.ops().toggleSelectedBullets('numbered'));
		expect(h.element()).toBe(before);
	});

	it('rejects another live controller with the same element ID when this hook is not editing', () => {
		const original = textElement([{ text: 'Inactive viewer', style: {} }]);
		const h = mount(original);
		nativeList(draft(), 1, 0, 11);
		act(() => {
			h.ops().updateSelectedTextStyle({ bold: true });
			h.ops().toggleSelectedBullets('numbered');
			h.ops().updateSelectedTextCase('upper');
		});
		expect(h.element()).toBe(original);
	});
});
