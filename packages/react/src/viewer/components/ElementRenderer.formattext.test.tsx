// @vitest-environment happy-dom
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import React, { act } from 'react';
/**
 * Regression test for the inline formatting shortcut wiring.
 *
 * The bug: InlineTextEditor implemented Ctrl/Cmd+B/I/U via `onFormatText`, but
 * no provider was ever wired above {@link ElementRenderer}, so the shortcuts
 * were inert. These tests render THROUGH ElementRenderer and assert that the
 * shortcuts reach the handler when provided and stay inert when absent.
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

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

function makeTextElement(style: TextStyle = {}): PptxElement {
	return {
		id: 'tx_1',
		type: 'text',
		x: 0,
		y: 0,
		width: 300,
		height: 80,
		text: 'Hello',
		textStyle: style,
	} as PptxElement;
}

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
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

function mount(props: ElementRendererProps): void {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
}

function pressShortcut(el: HTMLElement, key: string): void {
	act(() => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true }));
	});
}

function getInlineEditor(): HTMLElement {
	const editor = container.querySelector('[data-inline-editor]');
	if (!editor) {
		throw new Error('inline editor not rendered');
	}
	return editor as HTMLElement;
}

function selectSegment(editor: HTMLElement, index: number): void {
	const segment = editor.querySelector<HTMLElement>(`[data-seg-idx="${String(index)}"]`);
	if (!segment) {
		throw new Error(`segment ${String(index)} not rendered`);
	}
	const range = document.createRange();
	range.selectNodeContents(segment);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

describe('elementRenderer - inline formatting shortcut wiring', () => {
	it('toggles bold through onFormatText on Ctrl+B while inline editing', () => {
		const onFormatText = vi.fn<(updates: Partial<TextStyle>) => void>();
		mount(makeProps({ onFormatText }));

		pressShortcut(getInlineEditor(), 'b');

		expect(onFormatText).toHaveBeenCalledOnce();
		expect(onFormatText.mock.calls[0][0]).toStrictEqual({ bold: true });
	});

	it('toggles italic and underline from the current element style', () => {
		const onFormatText = vi.fn<(updates: Partial<TextStyle>) => void>();
		mount(makeProps({ element: makeTextElement({ italic: true }), onFormatText }));

		const editor = getInlineEditor();
		pressShortcut(editor, 'i');
		pressShortcut(editor, 'u');

		expect(onFormatText).toHaveBeenCalledTimes(2);
		expect(onFormatText.mock.calls[0][0]).toStrictEqual({ italic: false });
		expect(onFormatText.mock.calls[1][0]).toStrictEqual({ underline: true });
	});

	it.each([
		{ key: 'b', property: 'bold', firstValue: true, selectedValue: false, expected: true },
		{ key: 'b', property: 'bold', firstValue: false, selectedValue: true, expected: false },
		{ key: 'i', property: 'italic', firstValue: true, selectedValue: false, expected: true },
		{ key: 'i', property: 'italic', firstValue: false, selectedValue: true, expected: false },
		{ key: 'u', property: 'underline', firstValue: true, selectedValue: false, expected: true },
		{ key: 'u', property: 'underline', firstValue: false, selectedValue: true, expected: false },
	] as const)(
		'toggles $property from the selected non-first run',
		({ key, property, firstValue, selectedValue, expected }) => {
			const onFormatText = vi.fn<(updates: Partial<TextStyle>) => void>();
			mount(
				makeProps({
					element: {
						...makeTextElement(),
						text: 'Always Target',
						textSegments: [
							{ text: 'Always ', style: { [property]: firstValue } },
							{ text: 'Target', style: { [property]: selectedValue } },
						],
					} as PptxElement,
					onFormatText,
				}),
			);

			const editor = getInlineEditor();
			selectSegment(editor, 1);
			pressShortcut(editor, key);

			expect(onFormatText).toHaveBeenCalledOnce();
			expect(onFormatText.mock.calls[0][0]).toStrictEqual({ [property]: expected });
		},
	);

	it('is inert when no handler is provided', () => {
		mount(makeProps({ onFormatText: undefined }));

		// Must not throw; the shortcut simply does nothing.
		pressShortcut(getInlineEditor(), 'b');
	});

	it.each([
		{
			name: 'content-carrying first run',
			segments: [
				{
					text: 'Item',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
				},
			],
			contentSegmentIndex: 0,
		},
		{
			name: 'dedicated marker run',
			segments: [
				{
					text: '1. ',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
				},
				{ text: 'Item', style: {} },
			],
			contentSegmentIndex: 1,
		},
	])(
		'excludes the rendered number for a $name from committed text',
		({ segments, contentSegmentIndex }) => {
			const onInlineEditChange = vi.fn<(text: string) => void>();
			mount(
				makeProps({
					element: {
						...makeTextElement(),
						text: 'Item',
						textSegments: segments,
					} as PptxElement,
					onInlineEditChange,
				}),
			);

			const editor = getInlineEditor();
			const marker = editor.querySelector<HTMLElement>('[data-pptx-bullet-marker]');
			const content = editor.querySelector<HTMLElement>(
				`[data-seg-idx="${String(contentSegmentIndex)}"]`,
			);
			expect(marker?.textContent).toBe('1.');
			expect(marker?.contentEditable).toBe('false');
			expect(content).not.toBeNull();

			act(() => {
				if (content) {
					content.textContent = 'Item edited';
				}
				editor.dispatchEvent(new Event('input', { bubbles: true }));
			});

			expect(onInlineEditChange).toHaveBeenLastCalledWith('Item edited');
		},
	);
});
