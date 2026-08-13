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
