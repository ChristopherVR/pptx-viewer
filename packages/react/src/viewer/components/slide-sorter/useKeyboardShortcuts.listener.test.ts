// @vitest-environment happy-dom
/**
 * The sorter's keydown listener identity, pinned.
 *
 * Escape never closed React's slide sorter, and every obvious probe said it
 * should: the effect ran, the listener was on `window`, and the key reached
 * `window`. All true. What was false was the assumption that the listener
 * present when Escape was dispatched was still there when the dispatch got to
 * it. The hook re-subscribed whenever any of its fifteen parameters changed,
 * i.e. on every render of the viewer, and the editor's own shortcut listener -
 * registered before the sorter existed, so dispatched first - sets state on
 * Escape. The browser takes a microtask checkpoint after each listener returns,
 * React flushed that render there, this effect's cleanup removed the sorter's
 * listener, and the replacement it registered could not receive an event
 * already in flight.
 *
 * So the invariant worth pinning is not "the listener exists" but "it is the
 * SAME listener": one registration, never swapped while the sorter is open.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from './useKeyboardShortcuts';

type Params = Parameters<typeof useKeyboardShortcuts>[0];

let host: HTMLDivElement;
let root: Root;

/** Every callback stubbed, so a test only names the one it cares about. */
function paramsWith(overrides: Partial<Params> = {}): Params {
	return {
		slides: [
			{ id: 'slide-1', elements: [] },
			{ id: 'slide-2', elements: [] },
		] as Params['slides'],
		activeSlideIndex: 0,
		canEdit: true,
		selectedSlideIds: ['slide-1'],
		selectedIndexes: [0],
		contextMenu: null,
		setContextMenu: vi.fn(),
		setSelectedSlideIds: vi.fn(),
		setZoom: vi.fn(),
		onClose: vi.fn(),
		handleDeleteSelected: vi.fn(),
		handleCopySelected: vi.fn(),
		handlePaste: vi.fn(),
		handleDuplicateSelected: vi.fn(),
		handleSelectAll: vi.fn(),
		...overrides,
	};
}

/**
 * A component that does nothing but run the hook. Declared once, at module
 * level: a `Probe` re-declared per render would be a different component type
 * each time, so React would remount it and re-run the effect for a reason that
 * has nothing to do with the dependency list under test.
 */
function Probe({ params }: { params: Params }): null {
	useKeyboardShortcuts(params);
	return null;
}

/** Mount (or re-render) the probe with a given parameter snapshot. */
function render(params: Params): void {
	act(() => {
		root.render(React.createElement(Probe, { params }));
	});
}

beforeEach(() => {
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	host.remove();
});

describe('slide-sorter keydown listener identity', () => {
	it('registers keydown on window exactly once, however often the sorter re-renders', () => {
		const windowAdd = vi.spyOn(window, 'addEventListener');
		const windowRemove = vi.spyOn(window, 'removeEventListener');

		render(paramsWith());
		// The viewer re-renders constantly while the sorter is open, and its
		// overlay props are inline arrows, so every one of these is a fresh
		// identity for the parameters the hook used to list as dependencies.
		render(paramsWith({ onClose: vi.fn(), selectedSlideIds: ['slide-2'] }));
		render(paramsWith({ onClose: vi.fn(), contextMenu: { x: 1, y: 2, slideIndex: 0 } }));

		expect(windowAdd.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
		expect(
			windowRemove.mock.calls.filter(([type]) => type === 'keydown'),
			'a listener torn down and rebuilt mid-dispatch is a listener that misses the key',
		).toHaveLength(0);
	});

	it('still closes on Escape after the parameters change', () => {
		const onClose = vi.fn();
		render(paramsWith());
		// The re-render that used to swap the listener out.
		render(paramsWith({ onClose }));

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(
			onClose,
			'Escape must reach the CURRENT onClose, not the one captured at mount',
		).toHaveBeenCalledOnce();
	});

	// The end-to-end half of this - Escape actually dismissing the overlay while
	// the editor's listener re-renders the viewer underneath it - is asserted in
	// `e2e/keyboard-shortcuts.spec.ts`, against a real browser. It cannot be
	// reproduced here: the defect needs the browser's post-listener microtask
	// checkpoint to land React's flush INSIDE the dispatch, and neither `act` nor
	// `flushSync` reproduces that ordering, so a unit test written to look like
	// the race would pass against the buggy hook and prove nothing.
});
