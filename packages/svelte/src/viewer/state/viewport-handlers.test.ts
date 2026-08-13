// @vitest-environment happy-dom
/**
 * The slide-show shortcuts Svelte used to swallow.
 *
 * `mapPresentationKey` has resolved Ctrl+H (`toggleChrome`) and Ctrl+S
 * (`showAllSlides`) for as long as it has existed, and `handleShowKey` had no
 * case for either: they fell into its `default`, which returns `true`. So the
 * show reported the key as handled, `preventDefault()` had already run, and
 * nothing happened - the browser did not get the chord back either.
 */
import { describe, expect, it, vi } from 'vitest';

import { createViewportHandlers } from './viewport-handlers';
import type { ViewportHandlersDeps } from './viewport-handlers';

/** Handlers over stub collaborators; only the two chords under test matter. */
function harness(overrides: Partial<ViewportHandlersDeps> = {}): {
	handlers: ReturnType<typeof createViewportHandlers>;
	toggleChrome: ReturnType<typeof vi.fn>;
	showAllSlides: ReturnType<typeof vi.fn>;
} {
	const toggleChrome = vi.fn();
	const showAllSlides = vi.fn();
	const handlers = createViewportHandlers({
		getRootEl: () => undefined,
		viewer: { isFullscreen: true, slideCount: 3, goTo: vi.fn(), handleNavigationKey: () => false },
		controller: { onKeyDown: vi.fn(), capturesKeyboard: () => false },
		getEditingActive: () => false,
		presentation: { advance: vi.fn(), retreat: () => false, previousSlide: vi.fn() },
		toggleChrome,
		showAllSlides,
		...overrides,
	} as unknown as ViewportHandlersDeps);
	return { handlers, toggleChrome, showAllSlides };
}

/** One Ctrl chord; reports whether the show consumed it. */
function press(handlers: ReturnType<typeof createViewportHandlers>, key: string): boolean {
	const event = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
	handlers.onKeydown(event);
	return event.defaultPrevented;
}

describe('slide-show chrome shortcuts', () => {
	it('the Ctrl+H chord toggles the show chrome', () => {
		const { handlers, toggleChrome } = harness();

		expect(press(handlers, 'h'), 'the map claims Ctrl+H, so the show consumes it').toBeTruthy();
		expect(toggleChrome).toHaveBeenCalledOnce();
	});

	it('the Ctrl+S chord raises the "See All Slides" navigator', () => {
		const { handlers, showAllSlides } = harness();

		expect(press(handlers, 's')).toBeTruthy();
		expect(showAllSlides).toHaveBeenCalledOnce();
	});

	it('leaves both chords alone outside a running show', () => {
		const { handlers, toggleChrome, showAllSlides } = harness({
			viewer: {
				isFullscreen: false,
				slideCount: 3,
				goTo: vi.fn(),
				handleNavigationKey: () => false,
			} as unknown as ViewportHandlersDeps['viewer'],
		});

		expect(press(handlers, 's'), 'Ctrl+S is the browser save dialog in the editor').toBeFalsy();
		expect(showAllSlides).not.toHaveBeenCalled();
		expect(toggleChrome).not.toHaveBeenCalled();
	});
});
