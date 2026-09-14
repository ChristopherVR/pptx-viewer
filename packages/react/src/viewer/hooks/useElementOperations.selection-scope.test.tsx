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
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EditorHistoryResult } from './useEditorHistory';
import { useElementOperations } from './useElementOperations';
import type { ElementOperations } from './useElementOperations';

const selectionMock = vi.hoisted(() => ({ current: null as InlineTextSelection | null }));

vi.mock(import('../utils/inline-selection-utils'), async (importOriginal) => {
	const actual = await importOriginal<typeof import('../utils/inline-selection-utils')>();
	return { ...actual, getInlineEditorSelection: () => selectionMock.current };
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

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	selectionMock.current = null;
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function mount(element: PptxElement): { ops: () => ElementOperations; element: () => TextEl } {
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
			inlineEditingElementId: null,
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
