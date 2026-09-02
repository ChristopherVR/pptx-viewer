// @vitest-environment happy-dom
/**
 * The slide-show shortcuts vanilla used to swallow.
 *
 * `mapPresentationKey` has resolved Ctrl+H (`toggleChrome`) and Ctrl+S
 * (`showAllSlides`) for as long as it has existed, and this module had no case
 * for either. That is not the same as "unbound": the handler `preventDefault()`s
 * every action the map claims, so both chords were taken off the browser AND
 * dropped, which is the one outcome worse than doing nothing.
 */
import { describe, expect, it, vi } from 'vitest';

import { attachKeyboardNavigation } from './keyboard';
import type { KeyboardHandlers } from './keyboard';

/** A root with the show shortcuts attached and every handler stubbed. */
function harness(overrides: Partial<KeyboardHandlers> = {}): {
	root: HTMLElement;
	handlers: KeyboardHandlers;
	detach: () => void;
} {
	const root = document.createElement('div');
	document.body.append(root);
	const handlers: KeyboardHandlers = {
		next: vi.fn(),
		prev: vi.fn(),
		first: vi.fn(),
		last: vi.fn(),
		escape: vi.fn(),
		isPresenting: () => true,
		toggleChrome: vi.fn(),
		showAllSlides: vi.fn(),
		...overrides,
	};
	return { root, handlers, detach: attachKeyboardNavigation(root, handlers) };
}

/** Dispatch one chord at the root and report whether it was consumed. */
function press(root: HTMLElement, key: string): boolean {
	const event = new KeyboardEvent('keydown', {
		key,
		ctrlKey: true,
		bubbles: true,
		cancelable: true,
	});
	root.dispatchEvent(event);
	return event.defaultPrevented;
}

/** Dispatch a bare or Shift-modified F5, optionally from a given target. */
function pressF5(
	root: HTMLElement,
	options: { shiftKey?: boolean; target?: HTMLElement } = {},
): boolean {
	const event = new KeyboardEvent('keydown', {
		key: 'F5',
		shiftKey: options.shiftKey ?? false,
		bubbles: true,
		cancelable: true,
	});
	(options.target ?? root).dispatchEvent(event);
	return event.defaultPrevented;
}

describe('the F5/Shift+F5 start-show keys', () => {
	it('a bare F5 starts the show from the beginning and prevents the reload', () => {
		const { root, handlers, detach } = harness({
			isPresenting: () => false,
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
		});
		try {
			expect(pressF5(root)).toBeTruthy();
			expect(handlers.startFromBeginning).toHaveBeenCalledOnce();
			expect(handlers.startFromCurrent).not.toHaveBeenCalled();
		} finally {
			detach();
			root.remove();
		}
	});

	it('shift+F5 starts the show from the current slide', () => {
		const { root, handlers, detach } = harness({
			isPresenting: () => false,
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
		});
		try {
			expect(pressF5(root, { shiftKey: true })).toBeTruthy();
			expect(handlers.startFromCurrent).toHaveBeenCalledOnce();
			expect(handlers.startFromBeginning).not.toHaveBeenCalled();
		} finally {
			detach();
			root.remove();
		}
	});

	it('does nothing and leaves the reload to the browser while a show is running', () => {
		const { root, handlers, detach } = harness({
			isPresenting: () => true,
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
		});
		try {
			expect(pressF5(root)).toBeFalsy();
			expect(handlers.startFromBeginning).not.toHaveBeenCalled();
		} finally {
			detach();
			root.remove();
		}
	});

	it('still starts the show when the caret is in a text field (read-only or mid-edit)', () => {
		const { root, handlers, detach } = harness({
			isPresenting: () => false,
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
		});
		const input = document.createElement('input');
		root.appendChild(input);
		try {
			// The form-field guard below exists for the paging shortcuts; F5 must not
			// sit behind it, matching PowerPoint starting a show with the caret in a
			// text box.
			expect(pressF5(root, { target: input })).toBeTruthy();
			expect(handlers.startFromBeginning).toHaveBeenCalledOnce();
		} finally {
			detach();
			root.remove();
		}
	});
});

describe('slide-show chrome shortcuts', () => {
	it('the Ctrl+H chord toggles the show chrome', () => {
		const { root, handlers, detach } = harness();
		try {
			expect(press(root, 'h'), 'the map claims Ctrl+H, so the show consumes it').toBeTruthy();
			expect(handlers.toggleChrome).toHaveBeenCalledOnce();
		} finally {
			detach();
			root.remove();
		}
	});

	it('the Ctrl+S chord raises the "See All Slides" navigator', () => {
		const { root, handlers, detach } = harness();
		try {
			expect(press(root, 's')).toBeTruthy();
			expect(handlers.showAllSlides).toHaveBeenCalledOnce();
		} finally {
			detach();
			root.remove();
		}
	});

	it('leaves both chords to the browser outside a running show', () => {
		const { root, handlers, detach } = harness({ isPresenting: () => false });
		try {
			expect(press(root, 's'), 'Ctrl+S is the browser save dialog in the editor').toBeFalsy();
			expect(handlers.showAllSlides).not.toHaveBeenCalled();
			expect(handlers.toggleChrome).not.toHaveBeenCalled();
		} finally {
			detach();
			root.remove();
		}
	});
});
