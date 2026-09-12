// @vitest-environment happy-dom
import type { InlineEditRect } from 'pptx-viewer-shared';
import { measureSvgViewportRect } from 'pptx-viewer-shared';
import React, { act } from 'react';
/**
 * Tests for the inline (on-canvas) SmartArt node text editor.
 *
 * Exercises the commit (Enter / blur), cancel (Escape), Shift+Enter newline,
 * and double-commit-guard behaviour against a real (happy-dom) DOM so the
 * keyboard wiring is covered, not just the markup.
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SmartArtEditableLayer } from './SmartArtEditableLayer';
import { SmartArtInlineNodeEditor } from './SmartArtInlineNodeEditor';

const RECT: InlineEditRect = { left: 10, top: 20, width: 120, height: 40 };

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

function mount(props: {
	initialText: string;
	onCommit: (t: string) => void;
	onCancel: () => void;
}): HTMLTextAreaElement {
	act(() => {
		root.render(
			<SmartArtInlineNodeEditor
				initialText={props.initialText}
				rect={RECT}
				onCommit={props.onCommit}
				onCancel={props.onCancel}
			/>,
		);
	});
	const ta = container.querySelector('textarea');
	if (!ta) {
		throw new Error('textarea not rendered');
	}
	return ta;
}

function keyDown(el: HTMLElement, key: string, shiftKey = false): void {
	act(() => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
	});
}

/**
 * Set a controlled `<textarea>`'s value the way React expects: via the native
 * value setter (so React's internal value tracker registers the change) then a
 * bubbling `input` event. Assigning `el.value` directly is silently ignored by
 * React's onChange because the tracker sees no change.
 */
function typeValue(el: HTMLTextAreaElement, text: string): void {
	const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
	act(() => {
		setter?.call(el, text);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	});
}

/** Fire a blur the way React's delegated listener observes it (bubbling focusout). */
function blur(el: HTMLElement): void {
	act(() => {
		el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
	});
}

describe('smartArtInlineNodeEditor', () => {
	it('preserves default screen-rectangle measurement for non-2D consumers', () => {
		act(() => {
			root.render(
				<SmartArtEditableLayer
					smartArtData={{ nodes: [{ id: 'n1', text: 'Alpha' }] }}
					canEdit
					onCommitNodeText={vi.fn()}
				>
					<svg>
						<g data-smartart-node-id='n1'>
							<text>Alpha</text>
						</g>
					</svg>
				</SmartArtEditableLayer>,
			);
		});
		const text = container.querySelector('text')!;
		Object.assign(text, {
			getBoundingClientRect: () => ({ left: 150, top: 260, width: 80, height: 12 }),
		});
		Object.assign(container.firstElementChild!, {
			getBoundingClientRect: () => ({ left: 100, top: 200, width: 400, height: 300 }),
		});
		act(() => text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
		const editor = container.querySelector('textarea')!;
		expect(editor.style.left).toBe('46px');
		expect(editor.style.top).toBe('56px');
		expect(editor.style.width).toBe('88px');
		expect(editor.style.height).toBe('20px');
		expect(editor.style.fontSize).toBe('10px');
	});

	it('places the editable layer and font in local SVG coordinates', () => {
		act(() => {
			root.render(
				<SmartArtEditableLayer
					smartArtData={{ nodes: [{ id: 'n1', text: 'Alpha' }] }}
					canEdit
					onCommitNodeText={vi.fn()}
					measureNodeRect={measureSvgViewportRect}
				>
					<svg>
						<g data-smartart-node-id='n1'>
							<text>Alpha</text>
						</g>
					</svg>
				</SmartArtEditableLayer>,
			);
		});
		const text = container.querySelector('text')!;
		Object.assign(text, {
			getBBox: () => ({ x: 10, y: 20, width: 80, height: 12 }),
			getCTM: () => ({ a: 2, b: 0, c: 0, d: 2, e: 5, f: 10 }),
		});
		act(() => text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
		const editor = container.querySelector('textarea')!;
		expect(editor.style.left).toBe('21px');
		expect(editor.style.top).toBe('46px');
		expect(editor.style.width).toBe('168px');
		expect(editor.style.height).toBe('32px');
		expect(editor.style.fontSize).toBe('20px');
	});

	it('renders with the initial text', () => {
		const ta = mount({ initialText: 'Hello', onCommit: vi.fn(), onCancel: vi.fn() });
		expect(ta.value).toBe('Hello');
	});

	it('commits the current value on Enter', () => {
		const onCommit = vi.fn();
		const ta = mount({ initialText: 'Start', onCommit, onCancel: vi.fn() });
		typeValue(ta, 'Edited');
		keyDown(ta, 'Enter');
		expect(onCommit).toHaveBeenCalledWith('Edited');
	});

	it('cancels on Escape without committing', () => {
		const onCommit = vi.fn();
		const onCancel = vi.fn();
		const ta = mount({ initialText: 'Start', onCommit, onCancel });
		keyDown(ta, 'Escape');
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('does not commit on Shift+Enter (newline)', () => {
		const onCommit = vi.fn();
		const ta = mount({ initialText: 'Line', onCommit, onCancel: vi.fn() });
		keyDown(ta, 'Enter', true);
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('commits on blur (click-away)', () => {
		const onCommit = vi.fn();
		const ta = mount({ initialText: 'Bye', onCommit, onCancel: vi.fn() });
		blur(ta);
		expect(onCommit).toHaveBeenCalledWith('Bye');
	});

	it('does not double-commit when blur follows Enter', () => {
		const onCommit = vi.fn();
		const ta = mount({ initialText: 'Once', onCommit, onCancel: vi.fn() });
		keyDown(ta, 'Enter');
		blur(ta);
		expect(onCommit).toHaveBeenCalledOnce();
	});

	it('does not commit after Escape even if blur fires', () => {
		const onCommit = vi.fn();
		const onCancel = vi.fn();
		const ta = mount({ initialText: 'Esc', onCommit, onCancel });
		keyDown(ta, 'Escape');
		blur(ta);
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onCommit).not.toHaveBeenCalled();
	});
});
