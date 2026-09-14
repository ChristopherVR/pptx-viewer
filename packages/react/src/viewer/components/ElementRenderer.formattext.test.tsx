// @vitest-environment happy-dom
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	getActiveInlineListSelection,
	inlineListBodyText,
	remapTextToSegments,
	setElementBullets,
} from 'pptx-viewer-shared';
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

function mount(props: ElementRendererProps, key?: string): void {
	act(() => {
		root.render(<ElementRenderer key={key} {...props} />);
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

describe('elementRenderer live list session transitions', () => {
	it('activates exactly three list items from native paragraphs ending in a nested metric BR', () => {
		const change = vi.fn();
		const element = {
			...makeTextElement(),
			text: 'Title',
			textSegments: [{ text: 'Title', style: { fontSize: 24 } }],
		} as PptxElement;
		const props = makeProps({ element, inlineEditingText: 'Title', onInlineEditChange: change });
		mount(props);
		const oldEditor = getInlineEditor();
		const second = document.createElement('div');
		second.textContent = 'Second';
		const blank = document.createElement('div');
		const run = document.createElement('span');
		run.dataset.segIdx = '0';
		const metric = document.createElement('span');
		metric.style.letterSpacing = '0px';
		metric.append(document.createElement('br'));
		run.append(metric);
		blank.append(run);
		act(() => {
			oldEditor.append(second, blank);
			oldEditor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		const body = 'Title\nSecond\n';
		expect(change).toHaveBeenLastCalledWith(body);
		window.getSelection()!.setBaseAndExtent(metric, 0, metric, 0);
		const draft = {
			...element,
			text: body,
			textSegments: remapTextToSegments(
				body,
				'textSegments' in element ? element.textSegments : undefined,
				{ fontSize: 24 },
			),
		};
		mount({
			...props,
			inlineEditingText: body,
			element: { ...draft, ...setElementBullets(draft, 'bullet') } as PptxElement,
		});
		const editor = getInlineEditor();
		const paragraphs = editor.querySelectorAll('[data-pptx-list-paragraph]');
		expect(paragraphs).toHaveLength(3);
		expect(getActiveInlineListSelection()).toMatchObject({
			kind: 'supported',
			bodyRange: { start: body.length, end: body.length },
			snapshot: { text: body },
		});
		const sheet = document.querySelector(
			`[data-pptx-list-presentation="${editor.dataset.pptxListSession}"]`,
		)!;
		expect(sheet.textContent).toMatch(/nth-child\(3\)::before\s*\{[^}]*content:\s*"•"/);
		act(() => {
			paragraphs[2].querySelector('[data-pptx-list-run]')!.textContent = 'Third';
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(change).toHaveBeenLastCalledWith(
			'Title\nSecond\nThird',
			expect.objectContaining({ text: 'Title\nSecond\nThird' }),
		);
		expect(editor.querySelectorAll('[data-pptx-list-paragraph]')).toHaveLength(3);
	});

	it('retires a plain draft on a mismatched list model without committing stale text on blur', () => {
		const cancel = vi.fn();
		const commit = vi.fn();
		const element = {
			...makeTextElement(),
			textSegments: [{ text: 'One', style: {} }],
		} as PptxElement;
		const props = makeProps({
			element,
			inlineEditingText: 'One',
			onInlineEditCancel: cancel,
			onInlineEditCommit: commit,
		});
		mount(props);
		const editor = getInlineEditor();
		const text = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT).nextNode()!;
		act(() => {
			text.textContent = 'One typed';
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		window.getSelection()!.setBaseAndExtent(text, 9, text, 9);
		mount({
			...props,
			element: {
				...element,
				textSegments: [{ text: 'One', style: {}, bulletInfo: { char: '◆' } }],
			} as PptxElement,
		});
		expect(getInlineEditor().querySelector('[data-pptx-list-paragraph]')).toBeNull();
		expect(cancel).toHaveBeenCalledOnce();
		act(() => editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
		expect(commit).not.toHaveBeenCalled();
	});

	it('activates live list editing after a plain-text list command and preserves the caret', () => {
		const onInlineEditChange = vi.fn();
		const element = {
			...makeTextElement(),
			text: 'Hello world',
			textSegments: [{ text: 'Hello world', style: { fontSize: 24 } }],
		} as PptxElement;
		const props = makeProps({ element, inlineEditingText: 'Hello world', onInlineEditChange });
		mount(props);
		const oldEditor = getInlineEditor();
		const walker = document.createTreeWalker(oldEditor, NodeFilter.SHOW_TEXT);
		const text = walker.nextNode()!;
		window.getSelection()!.setBaseAndExtent(text, 3, text, 3);
		mount({
			...props,
			element: {
				...element,
				textSegments: [{ text: 'Hello world', style: { fontSize: 24 }, bulletInfo: { char: '◆' } }],
			} as PptxElement,
		});
		const editor = getInlineEditor();
		expect(editor.querySelector('[data-pptx-list-paragraph]')).not.toBeNull();
		expect(window.getSelection()?.anchorOffset).toBe(3);
		expect(window.getSelection()?.anchorNode?.textContent).toContain('Hello');
		expect(onInlineEditChange).toHaveBeenLastCalledWith(
			'Hello world',
			expect.objectContaining({
				elementId: 'tx_1',
				text: 'Hello world',
			}),
		);
	});

	it('activates from the freshly typed plain draft rather than the pre-edit model', () => {
		const onInlineEditChange = vi.fn();
		const element: PptxElement = {
			id: 'typed-list',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 80,
			text: 'Hello',
			textSegments: [{ text: 'Hello', style: { fontSize: 24 } }],
		};
		const props = makeProps({ element, inlineEditingText: 'Hello', onInlineEditChange });
		mount(props);
		const editor = getInlineEditor();
		const text = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT).nextNode() as Text;
		act(() => {
			text.data = 'Hello typed';
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(onInlineEditChange).toHaveBeenLastCalledWith('Hello typed');
		window.getSelection()!.setBaseAndExtent(text, 8, text, 8);
		mount({
			...props,
			inlineEditingText: 'Hello typed',
			element: {
				...element,
				text: 'Hello typed',
				textSegments: [{ text: 'Hello typed', style: { fontSize: 24 }, bulletInfo: { char: '◆' } }],
			},
		});
		expect(onInlineEditChange).toHaveBeenLastCalledWith(
			'Hello typed',
			expect.objectContaining({ text: 'Hello typed' }),
		);
		expect(getActiveInlineListSelection()).toMatchObject({
			kind: 'supported',
			bodyRange: { start: 8, end: 8 },
		});
	});

	it('preserves a noncollapsed selection across paragraphs when activating a list', () => {
		const segments = [
			{ text: 'First', style: { fontSize: 24 } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: 'Second', style: { fontSize: 28, italic: true } },
		];
		const element: PptxElement = {
			id: 'range-list',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 100,
			textSegments: segments,
		};
		const props = makeProps({ element, inlineEditingText: 'First\nSecond' });
		mount(props);
		const editor = getInlineEditor();
		const first = editor.querySelector('[data-seg-idx="0"]')!.firstChild!;
		const last = editor.querySelector('[data-seg-idx="2"]')!.firstChild!;
		window.getSelection()!.setBaseAndExtent(first, 1, last, 3);
		mount({
			...props,
			element: {
				...element,
				textSegments: segments.map((segment) =>
					segment.isParagraphBreak ? segment : { ...segment, bulletInfo: { char: '◆' } },
				),
			},
		});
		expect(getActiveInlineListSelection()).toMatchObject({
			kind: 'supported',
			bodyRange: { start: 1, end: 9 },
			snapshot: { text: 'First\nSecond' },
		});
	});

	it('preserves a soft break and its caret when the paragraph becomes a list', () => {
		const segments = [
			{ text: 'One', style: { fontSize: 24 } },
			{ text: '\n', style: { fontSize: 24 }, isLineBreak: true },
			{ text: 'Two', style: { fontSize: 24 } },
		];
		const element: PptxElement = {
			id: 'soft-list',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 100,
			textSegments: segments,
		};
		const onInlineEditChange = vi.fn();
		const props = makeProps({
			element,
			inlineEditingText: inlineListBodyText(segments),
			onInlineEditChange,
		});
		mount(props);
		const text = getInlineEditor().querySelector('[data-seg-idx="2"]')!.firstChild!;
		window.getSelection()!.setBaseAndExtent(text, 2, text, 2);
		mount({
			...props,
			element: {
				...element,
				textSegments: segments.map((segment, index) =>
					index === 0 ? { ...segment, bulletInfo: { char: '◆' } } : segment,
				),
			},
		});
		expect(getActiveInlineListSelection()).toMatchObject({
			kind: 'supported',
			bodyRange: { start: 6, end: 6 },
			snapshot: { text: 'One\nTwo' },
		});
		expect(getInlineEditor().querySelectorAll('[data-pptx-list-paragraph]')).toHaveLength(1);
		expect(
			onInlineEditChange.mock.lastCall?.[1].textSegments.some(
				(segment: { isLineBreak?: boolean }) => segment.isLineBreak,
			),
		).toBeTruthy();
	});

	it('replaces unmanaged native paragraph children only at the explicit list activation boundary', () => {
		const original = { text: 'One', style: { fontSize: 24 } };
		const element: PptxElement = {
			id: 'native-list',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 100,
			textSegments: [original],
		};
		const change = vi.fn();
		const props = makeProps({ element, inlineEditingText: 'One', onInlineEditChange: change });
		mount(props);
		const editor = getInlineEditor();
		const added = document.createElement('div');
		const addedText = document.createTextNode('Two');
		added.append(addedText);
		act(() => {
			editor.append(added);
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(change).toHaveBeenLastCalledWith('One\nTwo');
		window.getSelection()!.setBaseAndExtent(addedText, 1, addedText, 1);
		mount({
			...props,
			inlineEditingText: 'One\nTwo',
			element: {
				...element,
				textSegments: [
					{ ...original, bulletInfo: { char: '◆' } },
					{ text: '\n', style: {}, isParagraphBreak: true },
					{ text: 'Two', style: { fontSize: 24 }, bulletInfo: { char: '◆' } },
				],
			},
		});
		expect(getInlineEditor().querySelectorAll('[data-pptx-list-paragraph]')).toHaveLength(2);
		expect(getActiveInlineListSelection()).toMatchObject({
			kind: 'supported',
			bodyRange: { start: 5, end: 5 },
			snapshot: { text: 'One\nTwo' },
		});
		expect(change).toHaveBeenLastCalledWith(
			'One\nTwo',
			expect.objectContaining({ text: 'One\nTwo' }),
		);
	});

	it('preserves the final empty paragraph and its caret during list activation', () => {
		const segments = [
			{ text: 'One', style: { fontSize: 24 } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: '', style: {}, paragraphInsertionStyle: { fontSize: 24 } },
		];
		const element: PptxElement = {
			id: 'empty-list',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 100,
			textSegments: [segments[0]],
		};
		const change = vi.fn();
		const props = makeProps({ element, inlineEditingText: 'One', onInlineEditChange: change });
		mount(props);
		const editor = getInlineEditor();
		// A current empty block in the uncontrolled DOM, rather than an authored
		// trailing paragraph that the legacy view renderer intentionally hides.
		const empty = document.createElement('div');
		act(() => {
			editor.append(empty);
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(change).toHaveBeenLastCalledWith('One\n');
		window.getSelection()!.setBaseAndExtent(empty, 0, empty, 0);
		mount({
			...props,
			inlineEditingText: 'One\n',
			element: {
				...element,
				textSegments: segments.map((segment) =>
					segment.isParagraphBreak ? segment : { ...segment, bulletInfo: { char: '◆' } },
				),
			},
		});
		expect(getInlineEditor().querySelectorAll('[data-pptx-list-paragraph]')).toHaveLength(2);
		expect(getActiveInlineListSelection()).toMatchObject({
			kind: 'supported',
			bodyRange: { start: 4, end: 4 },
			snapshot: { text: 'One\n' },
		});
	});

	it('keeps the activated native session and body nodes when bullets are turned off', () => {
		const plain = { text: 'Body', style: { fontSize: 24 } };
		const element: PptxElement = {
			id: 'off-list',
			type: 'text',
			x: 0,
			y: 0,
			width: 300,
			height: 80,
			textSegments: [plain],
		};
		const onInlineEditChange = vi.fn();
		const props = makeProps({ element, inlineEditingText: 'Body', onInlineEditChange });
		mount(props);
		mount({
			...props,
			element: { ...element, textSegments: [{ ...plain, bulletInfo: { char: '◆' } }] },
		});
		const editor = getInlineEditor();
		const session = editor.dataset.pptxListSession;
		const paragraph = editor.querySelector('[data-pptx-list-paragraph]');
		const body = editor.querySelector('[data-pptx-list-run]')!.firstChild;
		mount({
			...props,
			element: { ...element, textSegments: [{ ...plain, bulletInfo: { char: '◆', none: true } }] },
		});
		expect(getInlineEditor()).toBe(editor);
		expect(editor.dataset.pptxListSession).toBe(session);
		expect(editor.querySelector('[data-pptx-list-paragraph]')).toBe(paragraph);
		expect(editor.querySelector('[data-pptx-list-run]')!.firstChild).toBe(body);
		expect(onInlineEditChange).toHaveBeenLastCalledWith(
			'Body',
			expect.objectContaining({
				textSegments: [
					expect.objectContaining({ bulletInfo: expect.objectContaining({ none: true }) }),
				],
			}),
		);
	});

	it('paints an empty listed paragraph with its authored body insertion style', () => {
		const style = { fontSize: 32, bold: true, italic: true, underline: true, color: '#cc00aa' };
		const onInlineEditChange = vi.fn();
		mount(
			makeProps({
				element: {
					...makeTextElement(),
					text: '',
					textSegments: [
						{ text: '', style: {}, bulletInfo: { char: '◆' }, paragraphInsertionStyle: style },
					],
				} as PptxElement,
				onInlineEditChange,
			}),
		);
		const editor = getInlineEditor();
		const body = editor.querySelector<HTMLElement>('[data-pptx-list-run]')!;
		expect(body.style.fontSize).toBe('32px');
		expect(body.style.fontWeight).toBe('bold');
		expect(body.style.fontStyle).toBe('italic');
		expect(body.style.textDecoration).toContain('underline');
		act(() => {
			body.textContent = 'Typed';
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(onInlineEditChange).toHaveBeenLastCalledWith(
			'Typed',
			expect.objectContaining({
				textSegments: [
					expect.objectContaining({ text: 'Typed', style: expect.objectContaining(style) }),
				],
			}),
		);
	});

	it.each([
		{ key: 'b', property: 'bold' },
		{ key: 'i', property: 'italic' },
		{ key: 'u', property: 'underline' },
	] as const)(
		'toggles $property from authored list body rather than marker or absent run override',
		({ key, property }) => {
			for (const kind of ['marker', 'inherited', 'literal'] as const) {
				const format = vi.fn<(updates: Partial<TextStyle>) => void>();
				const body = {
					text: kind === 'literal' ? '1. Body' : 'Body',
					style: kind === 'inherited' ? {} : { [property]: true },
					bulletInfo: { char: '◆' },
				};
				// A different key mounts a separate renderer instance for each case.
				const props = makeProps({
					element: {
						...makeTextElement(kind === 'inherited' ? { [property]: true } : {}),
						id: `toggle-${kind}-${property}`,
						textSegments:
							kind === 'literal'
								? [body]
								: [{ text: '◆ ', style: { [property]: false }, bulletInfo: { char: '◆' } }, body],
					} as PptxElement,
					onFormatText: format,
				});
				mount(props, kind);
				pressShortcut(getInlineEditor(), key);
				expect(format).toHaveBeenCalledExactlyOnceWith({ [property]: false });
			}
		},
	);

	it('projects element decorations onto listed runs without overriding explicit false or changing no-op metadata', () => {
		const segments = [
			{ text: 'Inherited words ', style: { fontSize: 24 }, bulletInfo: { char: '◆' } },
			{ text: 'Plain words', style: { fontSize: 24, underline: false, strikethrough: false } },
		];
		mount(
			makeProps({
				element: {
					...makeTextElement({ underline: true, strikethrough: true }),
					textSegments: segments,
				} as PptxElement,
			}),
		);
		const editor = getInlineEditor();
		const runs = editor.querySelectorAll<HTMLElement>('[data-pptx-list-run]');
		expect(editor.style.textDecoration).toBe('none');
		expect(runs[0].style.textDecoration).toContain('underline');
		expect(runs[0].style.textDecoration).toContain('line-through');
		expect(runs[1].style.textDecoration).not.toContain('underline');
		expect(runs[1].style.textDecoration).not.toContain('line-through');
		const read = getActiveInlineListSelection();
		expect(read?.kind).toBe('supported');
		if (read?.kind === 'supported') {
			expect(read.snapshot.textSegments).toStrictEqual(segments);
		}
	});

	it.each([false, true])(
		'removes and restores inherited underline on a multiword run (metric children: %s)',
		(metricChildren) => {
			const cancel = vi.fn();
			const source = { text: 'One two three', style: { fontSize: 24 }, bulletInfo: { char: '◆' } };
			const element = {
				...makeTextElement({ underline: true }),
				textSegments: [source],
			} as PptxElement;
			const props = makeProps({ element, onInlineEditCancel: cancel });
			mount(props);
			const editor = getInlineEditor();
			const initialRun = editor.querySelector<HTMLElement>('[data-pptx-list-run]')!;
			expect(initialRun.style.textDecoration).toContain('underline');
			if (metricChildren) {
				// Mirrors the existing renderer's per-word metric spans without requiring an installed font.
				initialRun.replaceChildren(
					...['One ', 'two ', 'three'].map((text) => {
						const span = document.createElement('span');
						span.style.textDecoration = 'underline';
						span.textContent = text;
						return span;
					}),
				);
			}
			for (const underline of [false, true, false]) {
				mount({
					...props,
					element: {
						...element,
						textSegments: [{ ...source, style: { ...source.style, underline } }],
					} as PptxElement,
				});
				expect(cancel).not.toHaveBeenCalled();
				expect(getInlineEditor()).toBe(editor);
				const read = getActiveInlineListSelection();
				expect(read?.kind).toBe('supported');
				if (read?.kind === 'supported') {
					expect(read.snapshot.text).toBe(source.text);
					for (const segment of read.snapshot.textSegments ?? []) {
						expect(segment.style).toMatchObject({ fontSize: 24, underline });
					}
				}
				const nodes = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
					acceptNode: (node) =>
						node.parentElement?.closest('[data-pptx-bullet-marker]')
							? NodeFilter.FILTER_REJECT
							: NodeFilter.FILTER_ACCEPT,
				});
				let node = nodes.nextNode();
				while (node) {
					let ancestor = node.parentElement;
					let decorated = false;
					while (ancestor && ancestor !== editor) {
						decorated ||= (
							ancestor.style.textDecoration || ancestor.style.textDecorationLine
						).includes('underline');
						ancestor = ancestor.parentElement;
					}
					expect(decorated).toBe(underline);
					node = nodes.nextNode();
				}
			}
		},
	);

	it('invalidates superseded list DOM on model Undo instead of committing it back on blur', () => {
		const element = {
			...makeTextElement(),
			text: 'Original',
			textSegments: [{ text: 'Original', style: {}, bulletInfo: { char: '•' } }],
		} as PptxElement;
		const cancel = vi.fn();
		const commit = vi.fn();
		const change = vi.fn();
		const props = makeProps({
			element,
			onInlineEditCancel: cancel,
			onInlineEditCommit: commit,
			onInlineEditChange: change,
		});
		mount(props);
		const editor = getInlineEditor();
		act(() => {
			editor.querySelector('[data-pptx-list-run]')!.textContent = 'Original typed';
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		});
		// A formatting command first commits the already-visible typed body.
		mount({
			...props,
			element: {
				...element,
				text: 'Original typed',
				textSegments: [
					{ text: 'Original typed', style: { bold: true }, bulletInfo: { char: '•' } },
				],
			} as PptxElement,
		});
		expect(cancel).not.toHaveBeenCalled();
		// Model history restores the earlier body; this is not a new text input.
		mount(props);
		expect(cancel).toHaveBeenCalledExactlyOnceWith();
		change.mockClear();
		act(() => editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
		expect(commit).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});
});

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

			expect(onInlineEditChange).toHaveBeenLastCalledWith(
				'Item edited',
				expect.objectContaining({
					elementId: 'tx_1',
					text: 'Item edited',
					textSegments: [
						expect.objectContaining({
							text: 'Item edited',
							bulletInfo: expect.objectContaining({ autoNumType: 'arabicPeriod' }),
						}),
					],
				}),
			);
		},
	);
});
