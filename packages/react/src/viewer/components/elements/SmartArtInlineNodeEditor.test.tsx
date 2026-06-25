// @vitest-environment happy-dom
import type { InlineEditRect } from 'pptx-viewer-shared';
import React, { act } from 'react';
/**
 * Tests for the inline (on-canvas) SmartArt node text editor.
 *
 * Exercises the commit (Enter / blur), cancel (Escape), Shift+Enter newline,
 * and double-commit-guard behaviour against a real (happy-dom) DOM so the
 * keyboard wiring is covered, not just the markup.
 */
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

describe('smartArtInlineNodeEditor', () => {
	it('renders with the initial text', () => {
		const ta = mount({ initialText: 'Hello', onCommit: vi.fn(), onCancel: vi.fn() });
		expect(ta.value).toBe('Hello');
	});

	it('commits the current value on Enter', () => {
		const onCommit = vi.fn();
		const ta = mount({ initialText: 'Start', onCommit, onCancel: vi.fn() });
		act(() => {
			ta.value = 'Edited';
			ta.dispatchEvent(new Event('input', { bubbles: true }));
		});
		keyDown(ta, 'Enter');
		expect(onCommit).toHaveBeenCalledWith('Edited');
	});

	it('cancels on Escape without committing', () => {
		const onCommit = vi.fn();
		const onCancel = vi.fn();
		const ta = mount({ initialText: 'Start', onCommit, onCancel });
		keyDown(ta, 'Escape');
		expect(onCancel).toHaveBeenCalledTimes(1);
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
		act(() => {
			ta.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
		});
		expect(onCommit).toHaveBeenCalledWith('Bye');
	});

	it('does not double-commit when blur follows Enter', () => {
		const onCommit = vi.fn();
		const ta = mount({ initialText: 'Once', onCommit, onCancel: vi.fn() });
		keyDown(ta, 'Enter');
		act(() => {
			ta.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
		});
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it('does not commit after Escape even if blur fires', () => {
		const onCommit = vi.fn();
		const onCancel = vi.fn();
		const ta = mount({ initialText: 'Esc', onCommit, onCancel });
		keyDown(ta, 'Escape');
		act(() => {
			ta.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
		});
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onCommit).not.toHaveBeenCalled();
	});
});
