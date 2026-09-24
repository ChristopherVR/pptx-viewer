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
		onStartShowFromBeginning: vi.fn(),
		onStartShowFromCurrent: vi.fn(),
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
	it.each([{ ctrlKey: true }, { metaKey: true }])(
		'does not prevent unavailable paste: %j',
		(modifiers) => {
			const onPaste = vi.fn();
			const input = inputWith(container, { canPaste: false, hasSelection: false, onPaste });
			mount(input);
			const empty = new KeyboardEvent('keydown', {
				key: 'v',
				...modifiers,
				bubbles: true,
				cancelable: true,
			});
			container.dispatchEvent(empty);
			expect(empty.defaultPrevented).toBeFalsy();
			expect(onPaste).not.toHaveBeenCalled();
			input.canPaste = true;
			const populated = new KeyboardEvent('keydown', {
				key: 'v',
				...modifiers,
				bubbles: true,
				cancelable: true,
			});
			container.dispatchEvent(populated);
			expect(populated.defaultPrevented).toBeTruthy();
			expect(onPaste).toHaveBeenCalledOnce();
		},
	);

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

describe('useKeyboardShortcuts: the new PowerPoint editor shortcuts', () => {
	it('ctrl+E aligns the selected text center', () => {
		const onAlignCenter = vi.fn();
		mount(inputWith(container, { onAlignCenter }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }),
		);

		expect(onAlignCenter).toHaveBeenCalledOnce();
	});

	it('ctrl+] steps the font size up', () => {
		const onIncreaseFontSize = vi.fn();
		mount(inputWith(container, { onIncreaseFontSize }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: ']', ctrlKey: true, bubbles: true }),
		);

		expect(onIncreaseFontSize).toHaveBeenCalledOnce();
	});

	it('ctrl+shift+c copies the format and ctrl+shift+v pastes it', () => {
		const onCopyFormat = vi.fn();
		const onPasteFormat = vi.fn();
		mount(inputWith(container, { onCopyFormat, onPasteFormat }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey: true, bubbles: true }),
		);
		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, shiftKey: true, bubbles: true }),
		);

		expect(onCopyFormat).toHaveBeenCalledOnce();
		expect(onPasteFormat).toHaveBeenCalledOnce();
	});

	it('ctrl+m inserts a new slide', () => {
		const onNewSlide = vi.fn();
		mount(inputWith(container, { onNewSlide }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, bubbles: true }),
		);

		expect(onNewSlide).toHaveBeenCalledOnce();
	});

	it('ctrl+k opens the hyperlink dialog', () => {
		const onHyperlink = vi.fn();
		mount(inputWith(container, { onHyperlink }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
		);

		expect(onHyperlink).toHaveBeenCalledOnce();
	});

	it('ctrl+h opens find and replace', () => {
		const onFindReplace = vi.fn();
		mount(inputWith(container, { onFindReplace }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }),
		);

		expect(onFindReplace).toHaveBeenCalledOnce();
	});

	it('ctrl+space clears character formatting', () => {
		const onClearFormatting = vi.fn();
		mount(inputWith(container, { onClearFormatting }));

		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: ' ', ctrlKey: true, bubbles: true }),
		);

		expect(onClearFormatting).toHaveBeenCalledOnce();
	});

	it('tab and shift+tab cycle the selection', () => {
		const onCycleSelectionNext = vi.fn();
		const onCycleSelectionPrev = vi.fn();
		mount(inputWith(container, { onCycleSelectionNext, onCycleSelectionPrev }));

		container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		container.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
		);

		expect(onCycleSelectionNext).toHaveBeenCalledOnce();
		expect(onCycleSelectionPrev).toHaveBeenCalledOnce();
	});
});

describe('useKeyboardShortcuts F5 / Shift+F5 start-show keys', () => {
	// These are resolved via the separate `mapSlideShowStartKey`, checked ahead
	// of `mapEditorKey`'s `canEdit` / text-input gates, so F5 must still start
	// the show with editing disabled and must never reach `mapEditorKey`
	// (which would otherwise treat a bare F5 as NO_ACTION and let it through
	// to the browser's own reload).
	it('a bare F5 starts the show from the beginning and prevents the default reload', () => {
		const onStartShowFromBeginning = vi.fn();
		mount(inputWith(container, { onStartShowFromBeginning }));

		const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
		container.dispatchEvent(event);

		expect(onStartShowFromBeginning).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('shift+F5 starts the show from the current slide', () => {
		const onStartShowFromCurrent = vi.fn();
		mount(inputWith(container, { onStartShowFromCurrent }));

		const event = new KeyboardEvent('keydown', {
			key: 'F5',
			shiftKey: true,
			bubbles: true,
			cancelable: true,
		});
		container.dispatchEvent(event);

		expect(onStartShowFromCurrent).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('f5 while presenting does nothing and leaves the reload unprevented', () => {
		const onStartShowFromBeginning = vi.fn();
		mount(inputWith(container, { mode: 'present', onStartShowFromBeginning }));

		const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
		container.dispatchEvent(event);

		expect(onStartShowFromBeginning).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeFalsy();
	});

	it('f5 still starts the show when editing is disabled (read-only viewer)', () => {
		const onStartShowFromBeginning = vi.fn();
		mount(inputWith(container, { canEdit: false, onStartShowFromBeginning }));

		container.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));

		expect(onStartShowFromBeginning).toHaveBeenCalledOnce();
	});

	it('f5 still starts the show with the caret in a text input', () => {
		const onStartShowFromBeginning = vi.fn();
		mount(inputWith(container, { onStartShowFromBeginning }));
		const textInput = document.createElement('input');
		container.append(textInput);

		textInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));

		expect(onStartShowFromBeginning).toHaveBeenCalledOnce();
	});
});
