import { registerPptxWebControls } from 'pptx-viewer-shared';
// @vitest-environment happy-dom
/**
 * Home > Clipboard is the shared `pptx-ui-ribbon-home-clipboard` strip: this
 * adapter reflects selection/clipboard/edit state into it and maps its single
 * `home-request` intent onto the native handlers.
 */
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClipboardGroup } from './ClipboardGroup';
import type { ClipboardGroupProps } from './ClipboardGroup';

registerPptxWebControls();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function props(overrides: Partial<ClipboardGroupProps> = {}): ClipboardGroupProps {
	return {
		canEdit: true,
		hasSelection: true,
		canPaste: true,
		onCopy: vi.fn<() => void>(),
		onCut: vi.fn<() => void>(),
		onPaste: vi.fn<() => void>(),
		onToggleFormatPainter: vi.fn<() => void>(),
		...overrides,
	};
}
const button = (id: string, scope: ParentNode = container) =>
	scope.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.clipboard.${id}"]`)!;

describe('clipboard group', () => {
	it('renders the group and routes each button to its native handler once', () => {
		const p = props();
		act(() => root.render(<ClipboardGroup {...p} />));
		expect(container.querySelector('[data-ribbon-group="home.clipboard"]')).not.toBeNull();
		act(() => button('paste').click());
		act(() => button('cut').click());
		act(() => button('copy').click());
		act(() => button('formatPainter').click());
		expect(p.onPaste).toHaveBeenCalledOnce();
		expect(p.onCut).toHaveBeenCalledOnce();
		expect(p.onCopy).toHaveBeenCalledOnce();
		expect(p.onToggleFormatPainter).toHaveBeenCalledOnce();
	});

	it('gates Cut/Copy on the selection and Paste on the clipboard and edit rights', () => {
		const p = props({ hasSelection: false, canPaste: false });
		act(() => root.render(<ClipboardGroup {...p} />));
		expect(button('paste').disabled).toBeTruthy();
		expect(button('cut').disabled).toBeTruthy();
		expect(button('copy').disabled).toBeTruthy();
		act(() => button('copy').click());
		expect(p.onCopy).not.toHaveBeenCalled();
		act(() => root.render(<ClipboardGroup {...props({ canEdit: false })} />));
		expect(button('paste').disabled).toBeTruthy();
		expect(button('cut').disabled).toBeTruthy();
		expect(button('copy').disabled).toBeFalsy();
	});

	it('reflects the armed Format Painter and hides it when the host offers none', () => {
		act(() => root.render(<ClipboardGroup {...props({ formatPainterActive: true })} />));
		expect(button('formatPainter').getAttribute('data-active')).toBe('true');
		expect(button('formatPainter').getAttribute('aria-pressed')).toBe('true');
		act(() => root.render(<ClipboardGroup {...props({ canActivateFormatPainter: false })} />));
		expect(button('formatPainter').disabled).toBeTruthy();
		expect(button('formatPainter').getAttribute('data-active')).toBe('false');
		act(() => root.render(<ClipboardGroup {...props({ onToggleFormatPainter: undefined })} />));
		expect(button('formatPainter').hidden).toBeTruthy();
	});

	it('emits one intent under StrictMode and follows a replaced callback', () => {
		const first = props();
		act(() =>
			root.render(
				<StrictMode>
					<ClipboardGroup {...first} />
				</StrictMode>,
			),
		);
		act(() => button('copy').click());
		expect(first.onCopy).toHaveBeenCalledOnce();
		const second = props();
		act(() =>
			root.render(
				<StrictMode>
					<ClipboardGroup {...second} />
				</StrictMode>,
			),
		);
		act(() => button('copy').click());
		expect(first.onCopy).toHaveBeenCalledOnce();
		expect(second.onCopy).toHaveBeenCalledOnce();
	});

	it('keeps two mounted instances independent across a remount', () => {
		const other = document.createElement('div');
		document.body.appendChild(other);
		const otherRoot = createRoot(other);
		const a = props();
		const b = props({ hasSelection: false });
		act(() => root.render(<ClipboardGroup {...a} />));
		act(() => otherRoot.render(<ClipboardGroup {...b} />));
		expect(button('copy', container).disabled).toBeFalsy();
		expect(button('copy', other).disabled).toBeTruthy();
		act(() => otherRoot.unmount());
		act(() => button('copy', container).click());
		expect(a.onCopy).toHaveBeenCalledOnce();
		expect(b.onCopy).not.toHaveBeenCalled();
		other.remove();
	});
});
