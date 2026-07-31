// @vitest-environment happy-dom
/**
 * The keydown listener's registration, pinned.
 *
 * The hook used to register the same handler on the viewer container AND on
 * `window`, described in a comment as a "fallback". A window listener already
 * receives events that bubble out of the container, so it was never a fallback:
 * every key pressed inside the viewer ran the handler twice. Ctrl+D produced two
 * duplicates, Ctrl+V two pastes, one arrow press nudged two pixels and one
 * ArrowRight skipped two slides. All of that reads as an editor bug, which is
 * why it survived so long, so the single registration is asserted directly.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { UseKeyboardShortcutsInput } from './useKeyboardShortcuts';

let host: HTMLDivElement;
let root: Root;
let container: HTMLDivElement;

/** Every callback stubbed, so a test only names the one it cares about. */
function inputWith(
	containerEl: HTMLDivElement,
	overrides: Partial<UseKeyboardShortcutsInput> = {},
): UseKeyboardShortcutsInput {
	return {
		containerRef: { current: containerEl },
		mode: 'edit',
		canEdit: true,
		inlineEditingElementId: null,
		tableEditorState: null,
		activeTool: 'select',
		hasSelection: true,
		effectiveSelectedIds: ['el-1'],
		onDelete: vi.fn(),
		onCopy: vi.fn(),
		onCut: vi.fn(),
		onPaste: vi.fn(),
		onDuplicate: vi.fn(),
		onUndo: vi.fn(),
		onRedo: vi.fn(),
		onSelectAll: vi.fn(),
		onEscape: vi.fn(),
		onNudge: vi.fn(),
		...overrides,
	};
}

/** Mount a component that does nothing but run the hook. */
function mount(input: UseKeyboardShortcutsInput): void {
	function Probe(): null {
		useKeyboardShortcuts(input);
		return null;
	}
	act(() => {
		root.render(React.createElement(Probe));
	});
}

beforeEach(() => {
	host = document.createElement('div');
	container = document.createElement('div');
	document.body.append(host, container);
	root = createRoot(host);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	host.remove();
	container.remove();
});

describe('useKeyboardShortcuts listener registration', () => {
	it('registers keydown once, on window, and never on the container', () => {
		const containerAdd = vi.spyOn(container, 'addEventListener');
		const windowAdd = vi.spyOn(window, 'addEventListener');

		mount(inputWith(container));

		expect(containerAdd.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);
		expect(windowAdd.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
	});

	it('runs an action exactly once for a key targeted inside the container', () => {
		const onDuplicate = vi.fn();
		mount(inputWith(container, { onDuplicate }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }),
		);

		expect(onDuplicate).toHaveBeenCalledOnce();
	});

	it('nudges by one slide pixel per press, not two', () => {
		const onNudge = vi.fn();
		mount(inputWith(container, { onNudge }));

		container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

		expect(onNudge).toHaveBeenCalledExactlyOnceWith(1, 0);
	});

	it('detaches on unmount', () => {
		const onDelete = vi.fn();
		mount(inputWith(container, { onDelete }));
		act(() => {
			root.unmount();
		});
		root = createRoot(host);

		container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

		expect(onDelete).not.toHaveBeenCalled();
	});
});
