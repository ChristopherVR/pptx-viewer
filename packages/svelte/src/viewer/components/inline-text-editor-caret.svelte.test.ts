/**
 * Regression: mounting the inline editor must place the caret at the END of
 * the seeded text (typing appends), the contract shared by all five bindings
 * via the shared `placeCaretAtEnd`. Focus alone leaves the caret at the start,
 * which is the parity bug this pins.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { InlineListController } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import InlineTextEditor from './InlineTextEditor.svelte';
import ParagraphGroup from './ribbon/home/ParagraphGroup.svelte';

function textElement(): PptxElement {
	return {
		id: 'el-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: 'TARGET',
		textSegments: [{ text: 'TARGET', style: {} }],
	} as unknown as PptxElement;
}

describe('inline text editor caret placement', () => {
	it('keeps the live editor and caret through pointer list toggles', () => {
		const host = document.createElement('div');
		document.body.append(host);
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = true;
		const element = {
			...textElement(),
			textSegments: [{ text: 'TARGET', style: {}, bulletInfo: { char: '◆' } }],
		} as PptxElement;
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
		editor.select(element.id);
		const onclose = vi.fn();
		const component = mount(InlineTextEditor, {
			target: host,
			props: {
				get element() {
					return editor.selectedElement!;
				},
				box: { x: 0, y: 0, width: 200, height: 50 },
				scale: 1,
				oncommit: vi.fn(),
				onclose,
				onregister: (controller) => {
					editor.inlineListController = controller;
				},
			},
		});
		const toolbar = mount(ParagraphGroup, { target: host, props: { editor } });
		flushSync();
		const root = host.querySelector<HTMLElement>('[data-inline-editor]')!;
		const selection = window.getSelection()!;
		const range = document.createRange();
		range.setStart(root.querySelector('[data-pptx-list-run]')!.firstChild!, 3);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		const caretNode = selection.anchorNode;
		const caretOffset = selection.anchorOffset;
		try {
			for (const label of ['Bullet List', 'Bullet List', 'Numbered List']) {
				const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
				const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
				button.dispatchEvent(down);
				// jsdom does not perform the browser's mousedown focus default.
				// Apply it in native order only when the control did not cancel it.
				if (!down.defaultPrevented) {
					button.focus();
				}
				button.click();
				flushSync();
				expect(down.defaultPrevented).toBeTruthy();
				expect(document.activeElement).toBe(root);
				expect(onclose).not.toHaveBeenCalled();
				expect(selection.anchorNode).toBe(caretNode);
				expect(selection.anchorOffset).toBe(caretOffset);
				expect(editor.inlineListController?.read().kind).toBe('supported');
			}
		} finally {
			unmount(toolbar);
			unmount(component);
			host.remove();
		}
	});

	it('activates a plain editor once when its model becomes a list and keeps the caret', () => {
		const host = document.createElement('div');
		document.body.append(host);
		let element = $state<PptxElement>(textElement());
		let controller: InlineListController | undefined;
		const component = mount(InlineTextEditor, {
			target: host,
			props: {
				get element() {
					return element;
				},
				box: { x: 0, y: 0, width: 200, height: 50 },
				scale: 1,
				oncommit: vi.fn(),
				onclose: vi.fn(),
				onregister: (value) => {
					controller = value;
				},
			},
		});
		flushSync();
		const root = host.querySelector<HTMLElement>('[data-inline-editor]')!;
		const range = document.createRange();
		range.setStart(root.firstChild!, 3);
		range.collapse(true);
		window.getSelection()!.removeAllRanges();
		window.getSelection()!.addRange(range);
		element = {
			...element,
			textSegments: [{ text: 'TARGET', style: {}, bulletInfo: { char: '◆' } }],
		} as PptxElement;
		flushSync();
		expect(controller?.read().kind).toBe('supported');
		const first = root.firstElementChild;
		expect(first?.hasAttribute('data-pptx-list-paragraph')).toBeTruthy();
		expect(window.getSelection()!.anchorOffset).toBe(3);
		flushSync();
		expect(root.firstElementChild).toBe(first);
		unmount(component);
		host.remove();
	});

	it('reconciles same-body style history and cancels an external body replacement without committing', () => {
		const host = document.createElement('div');
		document.body.append(host);
		let element = $state<PptxElement>({
			...textElement(),
			text: 'First',
			textSegments: [{ text: 'First', style: { bold: false }, bulletInfo: { char: '◆' } }],
		} as PptxElement);
		const original = $state.snapshot(element);
		let controller: InlineListController | undefined;
		const oncommit = vi.fn();
		const onclose = vi.fn();
		const component = mount(InlineTextEditor, {
			target: host,
			props: {
				get element() {
					return element;
				},
				box: { x: 10, y: 20, width: 200, height: 50 },
				scale: 1.5,
				oncommit,
				onclose,
				onregister: (value) => {
					controller = value;
				},
			},
		});
		flushSync();
		const root = host.querySelector<HTMLElement>('[data-inline-editor]')!;
		const first = root.firstElementChild;
		expect(root.style.transform).toBe('scale(1.5)');
		expect(root.style.width).toBe('200px');
		const before = controller!.read();
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const formatted = {
			...before.snapshot,
			textSegments: before.snapshot.textSegments!.map((segment) => ({
				...segment,
				style: { ...segment.style, bold: true },
			})),
		};
		expect(controller!.format(formatted).kind).toBe('supported');
		element = { ...element, textSegments: formatted.textSegments } as PptxElement;
		// Immediate model Undo, without an intervening component render.
		element = original;
		const undone = controller!.read();
		expect(
			undone.kind === 'supported' &&
				undone.snapshot.textSegments?.some((segment) => segment.style.bold === true),
		).toBeFalsy();
		expect(root.firstElementChild).toBe(first);
		expect(onclose).not.toHaveBeenCalled();
		element = {
			...element,
			text: 'Replaced',
			textSegments: [{ text: 'Replaced', style: {} }],
		} as PptxElement;
		flushSync();
		expect(onclose).toHaveBeenCalledOnce();
		expect(oncommit).not.toHaveBeenCalled();
		unmount(component);
		host.remove();
	});

	it('keeps a list session native-owned and commits its current rich snapshot', () => {
		const host = document.createElement('div');
		document.body.append(host);
		const element = textElement();
		if (element.type !== 'text') {
			throw new Error('text fixture');
		}
		element.textSegments = [
			{ text: 'First', style: { bold: true, color: '#CC00AA' }, bulletInfo: { char: '◆' } },
		];
		const oncommit = vi.fn();
		const component = mount(InlineTextEditor, {
			target: host,
			props: {
				element,
				box: { x: 0, y: 0, width: 200, height: 50 },
				scale: 1,
				oncommit,
				onclose: () => {},
			},
		});
		flushSync();
		const editor = host.querySelector<HTMLElement>('[data-inline-editor]')!;
		const first = editor.querySelector<HTMLElement>('[data-pptx-list-paragraph]')!;
		expect(first).not.toBeNull();
		const next = first.cloneNode(true) as HTMLElement;
		next.firstElementChild!.textContent = 'New';
		editor.append(next);
		editor.dispatchEvent(new Event('input'));
		editor.dispatchEvent(new Event('blur'));
		expect(oncommit).toHaveBeenCalledWith(
			'First\nNew',
			expect.objectContaining({
				elementId: element.id,
				textSegments: expect.arrayContaining([
					expect.objectContaining({ text: 'New', style: expect.objectContaining({ bold: true }) }),
				]),
			}),
		);
		unmount(component);
		host.remove();
	});

	it('collapses the selection to the end of the seeded text on mount', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);

		const component = mount(InlineTextEditor, {
			target: host,
			props: {
				element: textElement(),
				box: { x: 0, y: 0, width: 200, height: 50 },
				scale: 1,
				oncommit: () => {},
				onclose: () => {},
			},
		});
		flushSync();

		const editor = host.querySelector<HTMLElement>('[data-inline-editor]');
		expect(editor).not.toBeNull();
		expect(editor!.textContent).toBe('TARGET');

		const sel = window.getSelection();
		expect(sel).not.toBeNull();
		expect(sel!.rangeCount).toBe(1);
		const range = sel!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		const endsAtEnd =
			(range.endContainer === editor && range.endOffset === editor!.childNodes.length) ||
			(range.endContainer.nodeType === Node.TEXT_NODE &&
				range.endContainer.textContent === 'TARGET' &&
				range.endOffset === 'TARGET'.length);
		expect(endsAtEnd).toBeTruthy();

		unmount(component);
		host.remove();
	});
});
